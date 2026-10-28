import { BALANCE, BUILDING_KINDS, terrainOf } from "../data/balance";
import { compareText, neighbors } from "../map";
import { allied, relationOf } from "../relations";
import type { Rng } from "../rng";
import type { GameEvent, GameState, Hero, Mission, NodeId, NodeState, Resources, SeatId } from "../types";
import { gainExp } from "./growth";
import { rollInjury, routHero } from "./heroes";
import { attackPower, bestHero, defensePower, defenders, heroModifier, sumTroops } from "./power";
import { hesitationOf } from "./traits";

/** troops에서 fraction만큼(올림) 잃는 수 */
function lose(troops: number, fraction: number): number {
  return Math.min(troops, Math.ceil(troops * fraction));
}

function shrinkHeroes(heroes: readonly Hero[], fraction: number): number {
  let lost = 0;
  for (const hero of heroes) {
    const l = lose(hero.troops, fraction);
    hero.troops -= l;
    lost += l;
  }
  return lost;
}

/**
 * 전투 단계: 같은 자리·같은 목표의 공격을 한 부대로 묶어 시드 순서로 정산한다.
 * 아직 정산되지 않은 공격 영웅은 출발 거점이 먼저 함락돼도 그 자리에서 후퇴하지 않고 자기 공격을 치른다.
 * 진 공격 영웅의 후퇴·부상 판정과, 공격하지 못한 채 남의 거점에 서 있게 된 영웅(신중 후퇴, 병력 없음, 목표가 이미 아군이 됨)의
 * 후퇴 판정은 끝에 한 번 한다.
 * 목표가 이번 단계에서 불가침·동맹 상대에게 넘어갔으면 그 공격은 일어나지 않는다(기습은 턴 시작에 상대 것이던 거점을 칠 때만).
 * 그래서 결과가 정산 순서에 따라 갈리지 않는다.
 */
export function resolveCombat(
  state: GameState,
  missions: ReadonlyMap<string, Mission>,
  rng: Rng,
  events: GameEvent[],
): void {
  /** 턴 시작의 거점 주인(주인은 전투 단계에서만 바뀐다) */
  const startOwners = Object.fromEntries(Object.values(state.nodes).map((n) => [n.id, n.owner]));
  const groups = new Map<string, Hero[]>();
  /** 공격에 나섰거나 운영 중이라 서 있는 거점 방어에 끼지 않는 영웅 */
  const committed = new Set<string>();
  /** 공격 임무가 아직 정산되지 않은 영웅 */
  const unresolved = new Set<string>();
  /** 이번 단계에서 공격에 진 영웅(후퇴·부상 판정은 끝에) */
  const lost = new Set<string>();
  for (const hero of state.heroes) {
    const mission = missions.get(hero.id);
    if (!mission || hero.status !== "active") continue;
    if (mission.kind === "govern") committed.add(hero.id);
    if (mission.kind !== "attack") continue;
    const key = `${hero.seat}|${mission.target}`;
    groups.set(key, [...(groups.get(key) ?? []), hero]);
    committed.add(hero.id);
    unresolved.add(hero.id);
  }
  for (const key of rng.shuffle([...groups.keys()].sort(compareText))) {
    const [seatText, target] = key.split("|");
    const seat = Number(seatText);
    const owner = state.nodes[target].owner;
    if (owner !== null && owner !== seat && owner !== startOwners[target] && atPeace(state, seat, owner)) {
      for (const hero of groups.get(key)!) unresolved.delete(hero.id);
      continue;
    }
    resolveAttack(state, seat, target, groups.get(key)!, committed, unresolved, lost, rng, events);
  }
  settleAfterCombat(state, lost, rng, events);
  restoreCapitals(state, events);
}

function resolveAttack(
  state: GameState,
  seat: SeatId,
  target: NodeId,
  group: readonly Hero[],
  committed: Set<string>,
  unresolved: Set<string>,
  lost: Set<string>,
  rng: Rng,
  events: GameEvent[],
): void {
  for (const hero of group) unresolved.delete(hero.id);
  const node = state.nodes[target];
  const ready = group.filter(
    (h) => h.status === "active" && h.troops > 0 && neighbors(state.map, h.location).includes(target),
  );
  if (ready.length === 0 || node.owner === seat) return;
  const attackers = withoutHesitant(state, seat, target, ready, committed, events);
  if (attackers.length === 0) return;
  const defHeroes = defenders(state, target, committed);
  const attackTroops = sumTroops(attackers);
  const defendTroops = node.garrison + sumTroops(defHeroes);
  const spread = BALANCE.combat.randomSpread;
  const aPow = attackPower(attackers) * rng.range(1 - spread, 1 + spread);
  const dPow =
    defendTroops * heroModifier(bestHero(defHeroes)) * terrainOf(state, target) * rng.range(1 - spread, 1 + spread);
  const battle = {
    kind: "battle" as const,
    node: target,
    attacker: seat,
    heroes: attackers.map((h) => h.id),
    attackTroops,
    attackPower: aPow,
    defender: node.owner,
    defendTroops,
    defendPower: dPow,
  };
  if (aPow > dPow) {
    const attackerLoss = shrinkHeroes(attackers, (dPow / aPow) * BALANCE.combat.winnerLossFactor);
    const event = { ...battle, winner: "attacker" as const, attackerLoss, defenderLoss: 0 };
    events.push(event);
    awardExp(attackers, defHeroes);
    const kept = capture(state, target, seat, attackers, (id) => unresolved.has(id) || lost.has(id), rng, events);
    // 점령한 영웅은 이제 그 거점의 방어자다(출발 거점에서만 빠진다)
    for (const hero of attackers) committed.delete(hero.id);
    // 방어 영웅은 후퇴하며 병력 일부를 지키므로 그만큼은 손실이 아니다
    event.defenderLoss = defendTroops - defHeroes.reduce((sum, h) => sum + (kept.get(h.id) ?? 0), 0);
  } else {
    const fraction = (aPow / dPow) * BALANCE.combat.winnerLossFactor;
    const garrisonLoss = lose(node.garrison, fraction);
    node.garrison -= garrisonLoss;
    const defenderLoss = garrisonLoss + shrinkHeroes(defHeroes, fraction);
    const attackerLoss = shrinkHeroes(attackers, BALANCE.combat.loserAttackerLossFactor);
    events.push({ ...battle, winner: "defender", attackerLoss, defenderLoss });
    awardExp(defHeroes, attackers);
    for (const hero of attackers) lost.add(hero.id);
  }
}

/**
 * 전투 단계 끝: 남의 거점(동맹 거점 제외)에 서 있는 영웅(활동·부상)은 그 거점 주인에게서 후퇴하거나 포로가 되고
 * (활동이면 부상 판정 포함), 아군·동맹 거점에 남은 진 공격 영웅은 부상 판정을 받는다.
 * 관계는 외교 정산에서만 바뀌므로 여기서는 턴 시작의 관계다.
 */
function settleAfterCombat(state: GameState, lost: ReadonlySet<string>, rng: Rng, events: GameEvent[]): void {
  for (const hero of state.heroes) {
    if (hero.status !== "active" && hero.status !== "injured") continue;
    const owner = state.nodes[hero.location].owner;
    if (owner !== null && owner !== hero.seat && !allied(state, owner, hero.seat)) {
      routHero(state, hero, owner, rng, events);
    }
    else if (lost.has(hero.id) && hero.status === "active") rollInjury(state, hero, rng, events);
  }
}

/** 수도를 잃고 옮길 곳이 없던 자리가 그 뒤 출격한 영웅의 점령으로 거점을 얻었으면 수도를 다시 정한다(손실은 함락 때 냈다). */
function restoreCapitals(state: GameState, events: GameEvent[]): void {
  for (const seat of state.seats) {
    if (seat.capital !== null || seat.eliminatedAt !== null) continue;
    const next = pickCapital(state, seat.id);
    if (next === null) continue;
    seat.capital = next;
    events.push({ kind: "capitalRestored", seat: seat.id, to: next });
  }
}

/** 새 수도: 수비대가 가장 많은 아군 거점(동률은 id 순) */
function pickCapital(state: GameState, seat: SeatId): NodeId | null {
  const next: NodeState | undefined = Object.values(state.nodes)
    .filter((n) => n.owner === seat)
    .sort((a, b) => b.garrison - a.garrison || compareText(a.id, b.id))[0];
  return next?.id ?? null;
}

/** 신중·후퇴 기준 판정: 무작위 폭을 뺀 부대 공격력이 방어력 × 기준보다 낮으면 그 영웅은 물러나 제자리를 지킨다. */
function withoutHesitant(
  state: GameState,
  seat: SeatId,
  target: NodeId,
  ready: readonly Hero[],
  committed: Set<string>,
  events: GameEvent[],
): Hero[] {
  const power = attackPower(ready);
  const def = defensePower(state, target, committed);
  return ready.filter((hero) => {
    const { ratio, reason } = hesitationOf(hero);
    if (ratio === 0 || power >= def * ratio) return true;
    committed.delete(hero.id);
    events.push({ kind: "hesitated", seat, hero: hero.id, node: target, reason });
    return false;
  });
}

function awardExp(winners: readonly Hero[], losers: readonly Hero[]): void {
  for (const hero of [...winners, ...losers]) gainExp(hero, BALANCE.exp.battle);
  for (const hero of winners) gainExp(hero, BALANCE.exp.victory);
}

/**
 * 점령: 건물 손상, 그 거점에 있던 남의 영웅(활동·부상) 후퇴·포로, 수도 이전. 후퇴한 영웅별로 지킨 병력을 돌려준다.
 * 판정을 끝으로 미룬 영웅(아직 공격 전이거나 이미 공격에 진 영웅, deferred)은 여기서 후퇴하지 않는다.
 */
function capture(
  state: GameState,
  target: NodeId,
  seat: SeatId,
  attackers: readonly Hero[],
  deferred: (heroId: string) => boolean,
  rng: Rng,
  events: GameEvent[],
): Map<string, number> {
  const node = state.nodes[target];
  const from = node.owner;
  node.owner = seat;
  node.garrison = 0;
  for (const kind of BUILDING_KINDS) node.buildings[kind] = Math.max(0, node.buildings[kind] - 1);
  const kept = new Map<string, number>();
  for (const hero of state.heroes) {
    if (hero.status !== "active" && hero.status !== "injured") continue;
    if (hero.location !== target || hero.seat === seat || deferred(hero.id)) continue;
    kept.set(hero.id, routHero(state, hero, seat, rng, events));
  }
  for (const hero of attackers) hero.location = target;
  events.push({ kind: "captured", node: target, from, to: seat });
  if (from !== null && state.seats[from].capital === target) moveCapital(state, from, target, events);
  return kept;
}

function moveCapital(state: GameState, seat: SeatId, from: NodeId, events: GameEvent[]): void {
  const seatState = state.seats[seat];
  const t = seatState.treasury;
  const pct = BALANCE.capitalLossPercent;
  const lost: Resources = {
    gold: Math.floor((t.gold * pct) / 100),
    food: Math.floor((t.food * pct) / 100),
    material: Math.floor((t.material * pct) / 100),
    rare: Math.floor((t.rare * pct) / 100),
  };
  t.gold -= lost.gold;
  t.food -= lost.food;
  t.material -= lost.material;
  t.rare -= lost.rare;
  seatState.capital = pickCapital(state, seat);
  events.push({ kind: "capitalMoved", seat, from, to: seatState.capital, lost });
}

function atPeace(state: GameState, x: SeatId, y: SeatId): boolean {
  const kind = relationOf(state, x, y).kind;
  return kind === "nonAggression" || kind === "alliance";
}
