import { BALANCE, buildCost, recruitCapAt } from "../data/balance";
import { bfs, compareText, neighbors, nodeType } from "../map";
import { RESOURCE_KINDS, totalOf } from "../resources";
import { attackModifier, defensePower, troopCap } from "../rules/power";
import { ownedNodes, totalTroops } from "../summary";
import type {
  Board,
  Build,
  Condition,
  Mission,
  NodeId,
  PendingOffer,
  Plan,
  Proposal,
  Recruit,
  RelationKind,
  ResourceAmounts,
  Response,
  SeatId,
} from "../types";
import { boardOf, type MyHero, type PublicSeat, type SeatView } from "../view";
import type { Staff } from "./types";

// 성향 1~5별 값. 3(balanced)이 1b-1 규칙 참모의 상수다.
/** 공격성: 추정 공격력이 추정 방어력의 이 배수를 넘을 때만 공격한다 */
const ATTACK_MARGIN_BY_AGGRESSION = [1.7, 1.5, 1.3, 1.15, 1.0];
/** 위험 감수: 병력이 통솔 상한의 이 비율 아래인 영웅은 약하다(채우러 돌아가거나 운영한다) */
const WEAK_RATIO_BY_RISK = [0.7, 0.6, 0.5, 0.4, 0.3];
/** 위험 감수가 이 값 이하면 공격 임무에 조건을 붙인다 */
const CONDITION_MAX_RISK = 2;
/** 내정↔군사: 턴당 최대 건설 수와, 건설 뒤에도 남길 금 */
const MAX_BUILDS_BY_FOCUS = [2, 2, 1, 1, 0];
const BUILD_GOLD_RESERVE_BY_FOCUS = [5, 10, 15, 20, 20];
/** 식량 자제 지침: 모집 뒤 식량을 예상 유지비의 이 턴 수만큼 남긴다 */
const FOOD_RESERVE_TURNS = { on: 5, off: 1 };
/** 동맹 신의: 이 관계인 상대의 거점은 공격 목표에서 뺀다 */
const SPARED_BY_FIDELITY: readonly (readonly RelationKind[])[] = [
  [],
  ["alliance"],
  ["nonAggression", "alliance"],
  ["nonAggression", "alliance"],
  ["nonAggression", "alliance"],
];
/** 동맹 신의가 이 값 이상이면 먼저 제안한다(그 밖에는 응답만 한다) */
const PROPOSE_MIN_FIDELITY = 4;
/** 동맹 신의가 이 값이면 불가침 상대에게 동맹을 제안한다 */
const ALLIANCE_FIDELITY = 5;
/** 받은 동맹은 동맹 신의가 이 값 이상일 때 수락한다 */
const ACCEPT_ALLIANCE_MIN_FIDELITY = 3;
/** 공격성이 이 값 이하일 때 국경을 맞댄 상대에게 이 턴 수의 불가침을 제안한다 */
const TRUCE_MAX_AGGRESSION = 3;
const TRUCE_TURNS = 24;
/** 보복 성향이 이 값 이상이면 전쟁 상대의 거점을 먼저 노리고, 전쟁 상대의 불가침·동맹을 거절한다 */
const RETALIATE_MIN = 4;
/** 식량이 모자라고 금이 minGold 이상이면 금 gold를 주고 식량 food를 받는 교환을 제안한다 */
const FOOD_TRADE = { minGold: 40, gold: 20, food: 20 };
/** 포로 몸값: 금 = 레벨 × 이 값 */
const RANSOM_GOLD_PER_LEVEL = 10;

export const ruleStaff: Staff = {
  plan: async ({ view }) => rulePlan(view),
};

/** 한 번의 계획에서 쓰는 시야와 세팅 값 */
interface Ctx {
  view: SeatView;
  seat: SeatId;
  board: Board;
  margin: number;
  weakRatio: number;
  capitalReserve: number;
  /** 현재 수도에서의 맵 거리. 수도가 없으면 null(원정 제한 없음) */
  capitalDist: Record<NodeId, number> | null;
  /** 거점 수가 가장 적은 상대 자리들 */
  weakest: Set<SeatId>;
  /** 공격 목표에서 빼는 상대(동맹 신의, 동맹 공격 금지) */
  spared: Set<SeatId>;
  /** 나와 전쟁 중인 자리 */
  enemies: Set<SeatId>;
}

export function rulePlan(view: SeatView): Plan {
  const { tendency, safeguards } = view.settings;
  const rivals = view.seats.filter((s) => s.id !== view.seat && !s.eliminated);
  const fewest = Math.min(...rivals.map((s) => s.nodes));
  const sparedKinds = new Set<RelationKind>(SPARED_BY_FIDELITY[tendency.fidelity - 1]);
  if (safeguards.noAllyAttack) sparedKinds.add("alliance");
  const ctx: Ctx = {
    view,
    seat: view.seat,
    board: boardOf(view),
    margin: ATTACK_MARGIN_BY_AGGRESSION[tendency.aggression - 1],
    weakRatio: WEAK_RATIO_BY_RISK[tendency.risk - 1],
    capitalReserve: (safeguards.capitalMin ?? 0) * BALANCE.constraints.capitalMinPerLevel,
    capitalDist: view.capital === null ? null : bfs(view.map, view.capital).dist,
    weakest: new Set(rivals.filter((s) => s.nodes === fewest).map((s) => s.id)),
    spared: new Set(view.relations.filter((r) => sparedKinds.has(r.kind)).map((r) => r.seat)),
    enemies: new Set(view.relations.filter((r) => r.kind === "war").map((r) => r.seat)),
  };
  const builds = planBuilds(ctx);
  const buildGold = builds.reduce((sum, b) => sum + buildCost(view.nodes[b.node].buildings[b.building] + 1).gold, 0);
  return { missions: planMissions(ctx), recruits: planRecruits(ctx, buildGold), builds, ...planDiplomacy(ctx) };
}

function relationTo(ctx: Ctx, seat: SeatId): RelationKind {
  return ctx.view.relations.find((r) => r.seat === seat)?.kind ?? "neutral";
}

/** 아군 거점인가(안 보이는 거점은 아군이 아니다) */
function mine(ctx: Ctx, node: NodeId): boolean {
  return ctx.view.nodes[node]?.owner === ctx.seat;
}

function reserveAt(ctx: Ctx, node: NodeId): number {
  return ctx.view.capital === node ? ctx.capitalReserve : 0;
}

function isFrontier(ctx: Ctx, node: NodeId): boolean {
  return neighbors(ctx.view.map, node).some((n) => !mine(ctx, n));
}

/** 원정 불허 영웅은 현재 수도에서 원정 범위를 넘는 거점으로 가거나 치지 않는다 */
function inRange(ctx: Ctx, hero: MyHero, node: NodeId): boolean {
  if (hero.standing.expedition || ctx.capitalDist === null) return true;
  return (ctx.capitalDist[node] ?? Infinity) <= BALANCE.constraints.expeditionRange;
}

/** 공격 여유: 공격성 배수와 영웅들의 후퇴 기준값 중 큰 값 */
function marginOf(ctx: Ctx, heroes: readonly MyHero[]): number {
  const retreat = heroes.map((h) =>
    h.standing.retreatAt === null ? 0 : BALANCE.constraints.retreatRatioByLevel[h.standing.retreatAt - 1],
  );
  return Math.max(ctx.margin, ...retreat);
}

/** 아군 거점만 지나 goal을 만족하는 가장 가까운 아군 거점으로 가는 첫 걸음. 없으면 null. */
function stepToward(ctx: Ctx, from: NodeId, goal: (node: NodeId) => boolean): NodeId | null {
  const { dist, prev } = bfs(ctx.view.map, from, (n) => mine(ctx, n));
  const target: NodeId | undefined = Object.keys(dist)
    .filter((n) => n !== from && mine(ctx, n) && goal(n))
    .sort((a, b) => dist[a] - dist[b] || compareText(a, b))[0];
  if (target === undefined) return null;
  let step = target;
  while (prev[step] !== from) step = prev[step]!;
  return step;
}

/** 약한 영웅이 병력을 받으러 돌아갈 첫 걸음. 돌아갈 필요가 없거나 갈 곳이 없으면 null. */
function regroupStep(ctx: Ctx, hero: MyHero, draw: number): NodeId | null {
  const need = troopCap(hero) * ctx.weakRatio;
  if (hero.troops + draw >= need) return null;
  const spare = (n: NodeId): number => ctx.view.nodes[n].garrison - reserveAt(ctx, n);
  const source: NodeId | undefined = ownedNodes(ctx.view, ctx.seat)
    .filter((n) => n !== hero.location && spare(n) >= need)
    .sort((a, b) => spare(b) - spare(a) || compareText(a, b))[0];
  if (source === undefined) return null;
  return stepToward(ctx, hero.location, (n) => n === source);
}

/** 거점별로 이미 꺼내기로 한 뒤 남은 수비대(left)를 보고, 영웅이 서 있는 곳에서 꺼낼 수 있는 병력 */
function drawFor(ctx: Ctx, hero: MyHero, left: Record<NodeId, number>): number {
  const garrison = left[hero.location] ?? ctx.view.nodes[hero.location].garrison;
  return Math.max(0, Math.min(garrison - reserveAt(ctx, hero.location), troopCap(hero) - hero.troops));
}

/** 공격 목표 정렬 키(작을수록 먼저): 보복 → 희귀 우선 → 약한 상대 우선 → 확장 욕구 */
function targetRank(ctx: Ctx, node: NodeId): number[] {
  const { guidelines, tendency } = ctx.view.settings;
  const owner = ctx.view.nodes[node].owner;
  const neutral = owner === null ? 0 : 1;
  const expansion = tendency.expansion <= 2 ? 1 - neutral : tendency.expansion >= 4 ? neutral : 0;
  return [
    tendency.retaliation >= RETALIATE_MIN && owner !== null && ctx.enemies.has(owner) ? 0 : 1,
    guidelines.rareFirst && nodeType(ctx.view.map, node) === "rare" ? 0 : 1,
    guidelines.weakFirst && owner !== null && ctx.weakest.has(owner) ? 0 : 1,
    expansion,
  ];
}

function compareRank(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

/** froms에 인접한 아군이 아닌 거점(claimed와 빼는 상대의 거점 제외)을 정렬 키 → 추정 방어력 → id 순으로 */
function attackTargets(
  ctx: Ctx,
  froms: readonly NodeId[],
  claimed: ReadonlySet<NodeId>,
): { node: NodeId; def: number; rank: number[] }[] {
  const nodes = new Set(froms.flatMap((f) => neighbors(ctx.view.map, f)));
  return [...nodes]
    .filter((n) => {
      const owner = ctx.view.nodes[n].owner;
      return !mine(ctx, n) && !claimed.has(n) && (owner === null || !ctx.spared.has(owner));
    })
    .map((n) => ({ node: n, def: defensePower(ctx.board, n), rank: targetRank(ctx, n) }))
    .sort((a, b) => compareRank(a.rank, b.rank) || a.def - b.def || compareText(a.node, b.node));
}

function cautiousCondition(): Condition {
  return { trigger: { kind: "ratioBelow", value: 3 }, react: { kind: "defend" } };
}

function planMissions(ctx: Ctx): Mission[] {
  const { view } = ctx;
  const planned = new Map<string, Mission>();
  const left: Record<NodeId, number> = {};
  const claimed = new Set<NodeId>();
  const heroes = view.myHeroes.filter((h) => h.status === "active").sort((a, b) => compareText(a.id, b.id));
  const idle = (): MyHero[] => heroes.filter((h) => !planned.has(h.id));
  const takeDraw = (hero: MyHero): number => {
    const draw = drawFor(ctx, hero, left);
    left[hero.location] = (left[hero.location] ?? view.nodes[hero.location].garrison) - draw;
    return draw;
  };
  const attack = (hero: MyHero, target: NodeId): Mission => {
    const mission: Mission = { kind: "attack", hero: hero.id, target, draw: takeDraw(hero) };
    if (view.settings.tendency.risk <= CONDITION_MAX_RISK) mission.when = cautiousCondition();
    return mission;
  };

  // 0) 수도 방어 전담: 현재 수도에 있으면 지키고, 밖에 있으면 수도로 한 걸음(못 가면 지킨다)
  const capital = view.capital;
  if (capital !== null) {
    for (const hero of heroes) {
      if (!hero.standing.guardCapital) continue;
      const step = hero.location === capital ? null : stepToward(ctx, hero.location, (n) => n === capital);
      planned.set(
        hero.id,
        step !== null && inRange(ctx, hero, step)
          ? { kind: "move", hero: hero.id, to: step, draw: 0 }
          : { kind: "defend", hero: hero.id },
      );
    }
  }

  // 1) 혼자 깰 수 있는 목표 중 정렬상 첫째를 공격한다
  for (const hero of idle()) {
    const force = (hero.troops + drawFor(ctx, hero, left)) * attackModifier(hero);
    const margin = marginOf(ctx, [hero]);
    const target = attackTargets(ctx, [hero.location], claimed).find(
      (t) => inRange(ctx, hero, t.node) && force > t.def * margin,
    );
    if (!target) continue;
    claimed.add(target.node);
    planned.set(hero.id, attack(hero, target.node));
  }

  // 2) 혼자 못 깨는 목표는 인접한 남은 영웅들이 합쳐 넘을 수 있으면 함께 공격한다
  for (const target of attackTargets(ctx, idle().map((h) => h.location), claimed)) {
    // 같은 거점 수비대를 앞 영웅이 다 꺼내면 뒤 영웅은 병력 0이 되므로, 실제로 병력을 든 영웅만 센다
    const trial = { ...left };
    let troops = 0;
    const group = idle().filter((h) => {
      if (!neighbors(view.map, h.location).includes(target.node) || !inRange(ctx, h, target.node)) return false;
      const draw = drawFor(ctx, h, trial);
      trial[h.location] = (trial[h.location] ?? view.nodes[h.location].garrison) - draw;
      troops += h.troops + draw;
      return h.troops + draw > 0;
    });
    if (group.length < 2) continue;
    if (troops * Math.max(...group.map((h) => attackModifier(h))) <= target.def * marginOf(ctx, group)) continue;
    claimed.add(target.node);
    for (const h of group) planned.set(h.id, attack(h, target.node));
  }

  // 3) 나머지: 약하면 병력 있는 거점까지 돌아간다(전선이든 내부든). 전선이면 지키고,
  //    내부에서 채울 병력도 없이 약하면 거점을 운영하며, 아니면 전선으로 나간다(갈 전선이 없으면 운영)
  for (const hero of idle()) {
    const draw = drawFor(ctx, hero, left);
    const back = regroupStep(ctx, hero, draw);
    if (back !== null && inRange(ctx, hero, back)) {
      planned.set(hero.id, { kind: "move", hero: hero.id, to: back, draw: 0 });
      continue;
    }
    const here = hero.location;
    if (isFrontier(ctx, here)) {
      planned.set(hero.id, { kind: "defend", hero: hero.id });
      continue;
    }
    const weak = hero.troops + draw < troopCap(hero) * ctx.weakRatio;
    const step = weak ? null : stepToward(ctx, here, (n) => isFrontier(ctx, n));
    if (step === null || !inRange(ctx, hero, step)) planned.set(hero.id, { kind: "govern", hero: hero.id });
    else planned.set(hero.id, { kind: "move", hero: hero.id, to: step, draw: takeDraw(hero) });
  }
  return heroes.map((h) => planned.get(h.id)!);
}

/**
 * 턴당 최대 (내정↔군사) 건: 현재 수도 생산 → 아군 농장·광산 생산(id 순) → 현재 수도 성벽 → 현재 수도 병영 중
 * 최고 레벨이 아니고 자재가 되며 짓고 나서 금이 (남길 금) 이상 남는 후보를 앞에서부터. 한 거점에는 하나만.
 */
function planBuilds(ctx: Ctx): Build[] {
  const { view } = ctx;
  const capital = view.capital;
  if (capital === null) return [];
  const focus = view.settings.tendency.focus;
  const maxBuilds = MAX_BUILDS_BY_FOCUS[focus - 1];
  const reserve = BUILD_GOLD_RESERVE_BY_FOCUS[focus - 1];
  let { gold, material } = view.treasury;
  const resourceNodes = ownedNodes(view, ctx.seat).filter((n) => ["farm", "mine"].includes(nodeType(view.map, n)));
  const candidates: Build[] = [
    { node: capital, building: "production" },
    ...resourceNodes.map((node): Build => ({ node, building: "production" })),
    { node: capital, building: "walls" },
    { node: capital, building: "barracks" },
  ];
  const builds: Build[] = [];
  for (const c of candidates) {
    if (builds.length >= maxBuilds) break;
    if (builds.some((b) => b.node === c.node)) continue;
    const level = view.nodes[c.node].buildings[c.building] + 1;
    if (level > BALANCE.buildings.maxLevel) continue;
    const cost = buildCost(level);
    if (material < cost.material || gold - cost.gold < reserve) continue;
    builds.push(c);
    gold -= cost.gold;
    material -= cost.material;
  }
  return builds;
}

/** buildGold는 같은 계획의 건설에 먼저 쓴 금 */
function planRecruits(ctx: Ctx, buildGold: number): Recruit[] {
  const { view } = ctx;
  const { gold, food } = view.treasury;
  const { unit, costPerUnit } = BALANCE.recruit;
  const reserveTurns = view.settings.guidelines.foodCaution ? FOOD_RESERVE_TURNS.on : FOOD_RESERVE_TURNS.off;
  let spentGold = buildGold;
  let spentFood = 0;
  let troops = totalTroops(ctx.board, ctx.seat);
  const recruits: Recruit[] = [];
  for (const node of ownedNodes(view, ctx.seat)) {
    const cap = recruitCapAt(view, view.capital, node);
    let amount = 0;
    while (amount + unit <= cap) {
      const nextGold = spentGold + costPerUnit.gold;
      const nextFood = spentFood + costPerUnit.food;
      const upkeep = Math.ceil((troops + unit) / BALANCE.upkeep.soldiersPerFood);
      if (gold < nextGold || food - nextFood < upkeep * reserveTurns) break;
      spentGold = nextGold;
      spentFood = nextFood;
      troops += unit;
      amount += unit;
    }
    if (amount > 0) recruits.push({ node, amount });
  }
  return recruits;
}

/** 외교: 받은 제안에 모두 응답하고, 동맹 신의 4·5면 불가침 → 동맹 → 자원 교환 → 포로 교환 순으로 먼저 제안한다 */
function planDiplomacy(ctx: Ctx): { proposals: Proposal[]; responses: Response[] } {
  const { view, seat } = ctx;
  const { tendency, guidelines } = view.settings;
  const responses = view.incoming.map((offer) => ({ id: offer.id, accept: accepts(ctx, offer) }));
  const proposals: Proposal[] = [];
  if (tendency.fidelity < PROPOSE_MIN_FIDELITY) return { proposals, responses };
  // 상대 하나에 턴당 1건
  const used = new Set<SeatId>();
  const add = (p: Proposal): void => {
    proposals.push(p);
    used.add(p.to);
  };
  const rivals = view.seats.filter((s) => s.id !== seat && !s.eliminated);
  const open = (pick: (s: PublicSeat) => boolean): PublicSeat[] => rivals.filter((s) => !used.has(s.id) && pick(s));
  const byNodes = (a: PublicSeat, b: PublicSeat): number => b.nodes - a.nodes || a.id - b.id;
  const at = (...kinds: RelationKind[]) => (s: PublicSeat): boolean => kinds.includes(relationTo(ctx, s.id));

  if (tendency.aggression <= TRUCE_MAX_AGGRESSION) {
    const border = new Set(
      ownedNodes(view, seat).flatMap((n) => neighbors(view.map, n).map((m) => view.nodes[m]?.owner ?? null)),
    );
    const waiting = new Set(view.outgoing.map((o) => o.to));
    const target = open((s) => border.has(s.id) && !waiting.has(s.id) && at("neutral", "war")(s)).sort(byNodes)[0];
    if (target) add({ kind: "nonAggression", to: target.id, turns: TRUCE_TURNS });
  }
  if (tendency.fidelity >= ALLIANCE_FIDELITY) {
    const target = open(at("nonAggression")).sort(byNodes)[0];
    if (target) add({ kind: "alliance", to: target.id });
  }
  const upkeep = Math.ceil(totalTroops(ctx.board, seat) / BALANCE.upkeep.soldiersPerFood);
  const reserveTurns = guidelines.foodCaution ? FOOD_RESERVE_TURNS.on : FOOD_RESERVE_TURNS.off;
  if (view.treasury.food < upkeep * reserveTurns && view.treasury.gold >= FOOD_TRADE.minGold) {
    const partner = open(at("nonAggression", "alliance"))[0];
    if (partner) add({ kind: "trade", to: partner.id, give: { gold: FOOD_TRADE.gold }, get: { food: FOOD_TRADE.food } });
  }
  const captives = (s: PublicSeat) =>
    view.foreignHeroes
      .filter((h) => h.status === "captured" && h.captor === seat && h.seat === s.id)
      .sort((a, b) => compareText(a.id, b.id));
  const held = (s: PublicSeat) =>
    view.myHeroes.filter((h) => h.status === "captured" && h.captor === s.id).sort((a, b) => compareText(a.id, b.id));
  const swap = open((s) => captives(s).length > 0 && held(s).length > 0)[0];
  const ransom = open((s) => captives(s).length > 0)[0];
  if (swap) {
    const n = Math.min(captives(swap).length, held(swap).length);
    const release = captives(swap).slice(0, n).map((h) => h.id);
    const receive = held(swap).slice(0, n).map((h) => h.id);
    add({ kind: "prisoners", to: swap.id, release, receive, pay: {}, ask: {} });
  } else if (ransom) {
    const hero = captives(ransom)[0];
    const ask = { gold: RANSOM_GOLD_PER_LEVEL * hero.level };
    add({ kind: "prisoners", to: ransom.id, release: [hero.id], receive: [], pay: {}, ask });
  }
  return { proposals, responses };
}

/** 받은 제안을 수락하나. 교환은 받는 양이 주는 양 이상이고 주는 자원이 시작 금고 아래로 내려가지 않을 때 */
function accepts(ctx: Ctx, offer: PendingOffer): boolean {
  const { tendency } = ctx.view.settings;
  const grudge = relationTo(ctx, offer.from) === "war" && tendency.retaliation >= RETALIATE_MIN;
  switch (offer.kind) {
    case "nonAggression":
      return !grudge;
    case "alliance":
      return !grudge && tendency.fidelity >= ACCEPT_ALLIANCE_MIN_FIDELITY;
    case "trade":
      return totalOf(offer.give) >= totalOf(offer.get) && keepsStart(ctx, offer.get);
    case "prisoners":
      return offer.release.length >= offer.receive.length && keepsStart(ctx, offer.ask);
  }
}

/** 주는 자원마다, 주고 나서도 시작 금고 이상 남는가 */
function keepsStart(ctx: Ctx, give: ResourceAmounts): boolean {
  return RESOURCE_KINDS.every((kind) => {
    const amount = give[kind] ?? 0;
    return amount === 0 || ctx.view.treasury[kind] - amount >= BALANCE.start.treasury[kind];
  });
}
