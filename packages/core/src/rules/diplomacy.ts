import { bfs, compareText } from "../map";
import { isPrisoner } from "../orders";
import { allied, relationOf, setRelation } from "../relations";
import { covers, transfer } from "../resources";
import { ownedNodes } from "../summary";
import type {
  GameEvent,
  GameState,
  Orders,
  PendingOffer,
  PromiseEntry,
  RelationKind,
  SeatId,
  SettleReason,
} from "../types";
import { freeHero } from "./heroes";

type Pair = [SeatId, SeatId];
type Alive = (seat: SeatId) => boolean;

/** 쌍 하나의 이번 턴 적대 행위 */
interface Hostility {
  pair: Pair;
  /** 상대 거점을 친(전투가 일어난) 자리 */
  attackers: Set<SeatId>;
  /** 선전포고한 자리 */
  declarers: Set<SeatId>;
  /** 파기한 자리 */
  breakers: Set<SeatId>;
}

function pairOf(x: SeatId, y: SeatId): Pair {
  return x < y ? [x, y] : [y, x];
}

function keyOf([a, b]: Pair): string {
  return `${a}-${b}`;
}

/**
 * 외교 정산(회복 뒤, 탈락·종료 앞). 관계는 여기서만 바뀐다.
 * 적대 행위 모으기 → 응답 정산 → 적대 행위 적용 → 불가침 만료 → 귀환 → 새 제안 전달.
 * 적대 행위가 있는 쌍의 수락은 무효이므로 응답 정산과 적대 행위 적용의 순서가 결과를 바꾸지 않는다.
 * 응답 정산 안의 순서(같은 금고를 쓰는 두 거래, 같은 쌍의 두 수락)는 시드가 아닌 제안 id 순으로 고정한다.
 * 거점이 0인 자리(이번 턴 끝에 탈락)의 수락은 무효이고 그 자리와는 제안을 주고받지 않는다.
 */
export function resolveDiplomacy(state: GameState, orders: Orders, events: GameEvent[]): void {
  const alive: Alive = (seat) => state.seats[seat].eliminatedAt === null && ownedNodes(state, seat).length > 0;
  const hostile = collectHostility(state, orders, events);
  settleOffers(state, orders, hostile, alive, events);
  applyHostility(state, hostile, events);
  expireTruces(state, events);
  returnHeroes(state, events);
  deliverOffers(state, orders, alive, events);
}

/** 이번 턴 전투(중립 거점 제외)와 선전포고·파기 통보를 쌍별로 모은다 */
function collectHostility(state: GameState, orders: Orders, events: readonly GameEvent[]): Map<string, Hostility> {
  const hostile = new Map<string, Hostility>();
  const add = (by: SeatId, other: SeatId, act: "attackers" | "declarers" | "breakers"): void => {
    const pair = pairOf(by, other);
    const entry = hostile.get(keyOf(pair)) ?? { pair, attackers: new Set(), declarers: new Set(), breakers: new Set() };
    entry[act].add(by);
    hostile.set(keyOf(pair), entry);
  };
  for (const e of events) {
    if (e.kind === "battle" && e.defender !== null) add(e.attacker, e.defender, "attackers");
  }
  orders.forEach((plan, seat) => {
    if (state.seats[seat]?.eliminatedAt !== null) return;
    for (const p of plan.proposals ?? []) {
      if (p.kind === "declareWar") add(seat, p.to, "declarers");
      else if (p.kind === "breakTreaty") add(seat, p.to, "breakers");
    }
  });
  return hostile;
}

/** 지난 정산에 전달된 제안을 id 순으로 정산하고 대기 목록을 비운다 */
function settleOffers(
  state: GameState,
  orders: Orders,
  hostile: ReadonlyMap<string, Hostility>,
  alive: Alive,
  events: GameEvent[],
): void {
  const answers = new Map<string, boolean>();
  orders.forEach((plan, seat) => {
    if (state.seats[seat]?.eliminatedAt !== null) return;
    for (const r of plan.responses ?? []) answers.set(r.id, r.accept);
  });
  for (const offer of state.diplomacy.pending) {
    const settle = (result: "accepted" | "rejected" | "expired" | "voided" | "failed", reason?: SettleReason) =>
      events.push({
        kind: "proposalSettled",
        id: offer.id,
        from: offer.from,
        to: offer.to,
        offer: offer.kind,
        result,
        ...(reason === undefined ? {} : { reason }),
      });
    const answer = answers.get(offer.id);
    if (answer === undefined) {
      settle("expired");
    } else if (!answer) {
      settle("rejected");
    } else if (!alive(offer.from) || !alive(offer.to)) {
      settle("voided", "gone");
    } else if (hostile.has(keyOf(pairOf(offer.from, offer.to)))) {
      settle("voided", "hostile");
    } else {
      const blocked = blockOf(state, offer);
      if (blocked !== null) {
        settle(blocked.result, blocked.reason);
      } else {
        settle("accepted");
        applyOffer(state, offer, events);
      }
    }
  }
  state.diplomacy.pending = [];
}

/** 지금 상태에서 수락을 성립시킬 수 없는 이유 */
function blockOf(state: GameState, offer: PendingOffer): { result: "voided" | "failed"; reason: SettleReason } | null {
  const relation = relationOf(state, offer.from, offer.to).kind;
  const from = state.seats[offer.from].treasury;
  const to = state.seats[offer.to].treasury;
  switch (offer.kind) {
    case "nonAggression":
      return relation === "neutral" || relation === "war" ? null : { result: "voided", reason: "stale" };
    case "alliance":
      return relation === "alliance" ? { result: "voided", reason: "stale" } : null;
    case "trade":
      return covers(from, offer.give) && covers(to, offer.get) ? null : { result: "failed", reason: "unaffordable" };
    case "prisoners": {
      const held =
        offer.release.every((id) => isPrisoner(state, id, offer.to, offer.from)) &&
        offer.receive.every((id) => isPrisoner(state, id, offer.from, offer.to));
      if (!held) return { result: "failed", reason: "prisoner" };
      return covers(from, offer.pay) && covers(to, offer.ask) ? null : { result: "failed", reason: "unaffordable" };
    }
  }
}

function applyOffer(state: GameState, offer: PendingOffer, events: GameEvent[]): void {
  const from = state.seats[offer.from].treasury;
  const to = state.seats[offer.to].treasury;
  switch (offer.kind) {
    case "nonAggression":
    case "alliance": {
      const until = offer.kind === "nonAggression" ? state.turn + offer.turns : null;
      changeRelation(state, offer.from, offer.to, offer.kind, "accepted", events, until);
      record(state, { turn: state.turn, kind: "formed", treaty: offer.kind, seats: pairOf(offer.from, offer.to) }, events);
      return;
    }
    case "trade":
      transfer(from, to, offer.give);
      transfer(to, from, offer.get);
      return;
    case "prisoners":
      transfer(from, to, offer.pay);
      transfer(to, from, offer.ask);
      for (const id of [...offer.release, ...offer.receive]) {
        freeHero(state, state.heroes.find((h) => h.id === id)!, events);
      }
      return;
  }
}

/**
 * 쌍마다 전투나 선전포고가 있으면 전쟁, 그것 없이 파기만 있으면 중립. 불가침·동맹을 깬 쪽은 약속 기록에 남는다.
 * 쌍마다 한 번에 정해지므로 쌍 안의 행위 순서는 결과를 바꾸지 않는다.
 */
function applyHostility(state: GameState, hostile: ReadonlyMap<string, Hostility>, events: GameEvent[]): void {
  const turn = state.turn;
  const sorted = [...hostile.values()].sort((p, q) => p.pair[0] - q.pair[0] || p.pair[1] - q.pair[1]);
  const bySeat = (seats: ReadonlySet<SeatId>): SeatId[] => [...seats].sort((x, y) => x - y);
  for (const { pair, attackers, declarers, breakers } of sorted) {
    const before = relationOf(state, pair[0], pair[1]).kind;
    if (before === "nonAggression" || before === "alliance") {
      const acts = [
        ["attack", attackers],
        ["war", declarers],
        ["break", breakers],
      ] as const;
      for (const [how, seats] of acts) {
        for (const by of bySeat(seats)) {
          record(state, { turn, kind: "broken", treaty: before, seats: pair, by, how }, events);
        }
      }
    }
    for (const by of bySeat(declarers)) record(state, { turn, kind: "declared", seats: pair, by }, events);
    const war = attackers.size > 0 || declarers.size > 0;
    const next: RelationKind = war ? "war" : "neutral";
    if (next === before) continue;
    const cause = attackers.size > 0 ? "attack" : war ? "declareWar" : "breakTreaty";
    changeRelation(state, pair[0], pair[1], next, cause, events);
  }
}

/** 만료 턴이 된 불가침은 중립으로 */
function expireTruces(state: GameState, events: GameEvent[]): void {
  for (const r of [...state.diplomacy.relations]) {
    if (r.kind !== "nonAggression" || r.until === null || r.until > state.turn) continue;
    record(state, { turn: state.turn, kind: "expired", treaty: "nonAggression", seats: [r.a, r.b] }, events);
    changeRelation(state, r.a, r.b, "neutral", "expired", events);
  }
}

/**
 * 동맹이 아닌 자리의 거점에 서 있는 영웅(활동·부상, 동맹이 끝난 쪽)은 병력을 그대로 데리고
 * 가장 가까운 아군 거점(맵 거리, 동률은 id)으로 돌아간다. 아군 거점이 없으면 탈락 판정에 맡긴다.
 */
function returnHeroes(state: GameState, events: GameEvent[]): void {
  for (const hero of state.heroes) {
    if (hero.status !== "active" && hero.status !== "injured") continue;
    const owner = state.nodes[hero.location].owner;
    if (owner === null || owner === hero.seat || allied(state, owner, hero.seat)) continue;
    const { dist } = bfs(state.map, hero.location);
    const home = ownedNodes(state, hero.seat).sort((a, b) => dist[a] - dist[b] || compareText(a, b))[0];
    if (home === undefined) continue;
    events.push({ kind: "heroReturned", seat: hero.seat, hero: hero.id, from: hero.location, to: home });
    hero.location = home;
  }
}

/** 이번 계획의 제안(통보 제외)을 대기 목록에 넣는다. 다음 정산까지 응답이 없으면 만료된다 */
function deliverOffers(state: GameState, orders: Orders, alive: Alive, events: GameEvent[]): void {
  orders.forEach((plan, seat) => {
    if (state.seats[seat] === undefined || !alive(seat)) return;
    (plan.proposals ?? []).forEach((p, index) => {
      if (p.kind === "declareWar" || p.kind === "breakTreaty" || !alive(p.to)) return;
      const offer: PendingOffer = { ...p, id: `${state.turn}-${seat}-${index}`, from: seat };
      state.diplomacy.pending.push(offer);
      events.push({ kind: "proposalDelivered", id: offer.id, from: seat, to: p.to, offer: p.kind });
    });
  });
}

function changeRelation(
  state: GameState,
  x: SeatId,
  y: SeatId,
  kind: RelationKind,
  cause: "accepted" | "attack" | "declareWar" | "breakTreaty" | "expired",
  events: GameEvent[],
  until: number | null = null,
): void {
  const from = relationOf(state, x, y).kind;
  setRelation(state, x, y, kind, until);
  events.push({ kind: "relationChanged", seats: pairOf(x, y), from, to: kind, cause });
}

function record(state: GameState, entry: PromiseEntry, events: GameEvent[]): void {
  state.diplomacy.promises.push(entry);
  events.push({ kind: "promise", entry });
}
