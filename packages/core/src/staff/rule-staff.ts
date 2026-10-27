import { BALANCE, buildCost, recruitCapAt } from "../data/balance";
import { bfs, compareText, neighbors, nodeType } from "../map";
import { attackModifier, defensePower, troopCap } from "../rules/power";
import { ownedNodes, totalTroops } from "../summary";
import type { Board, Build, Condition, Mission, NodeId, Plan, Recruit, SeatId } from "../types";
import { boardOf, type MyHero, type SeatView } from "../view";
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
}

export function rulePlan(view: SeatView): Plan {
  const { tendency, safeguards } = view.settings;
  const rivals = view.seats.filter((s) => s.id !== view.seat && !s.eliminated);
  const fewest = Math.min(...rivals.map((s) => s.nodes));
  const ctx: Ctx = {
    view,
    seat: view.seat,
    board: boardOf(view),
    margin: ATTACK_MARGIN_BY_AGGRESSION[tendency.aggression - 1],
    weakRatio: WEAK_RATIO_BY_RISK[tendency.risk - 1],
    capitalReserve: (safeguards.capitalMin ?? 0) * BALANCE.constraints.capitalMinPerLevel,
    capitalDist: view.capital === null ? null : bfs(view.map, view.capital).dist,
    weakest: new Set(rivals.filter((s) => s.nodes === fewest).map((s) => s.id)),
  };
  const builds = planBuilds(ctx);
  const buildGold = builds.reduce((sum, b) => sum + buildCost(view.nodes[b.node].buildings[b.building] + 1).gold, 0);
  return { missions: planMissions(ctx), recruits: planRecruits(ctx, buildGold), builds };
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

/** 공격 목표 정렬 키(작을수록 먼저): 희귀 우선 → 약한 상대 우선 → 확장 욕구 */
function targetRank(ctx: Ctx, node: NodeId): number[] {
  const { guidelines, tendency } = ctx.view.settings;
  const owner = ctx.view.nodes[node].owner;
  const neutral = owner === null ? 0 : 1;
  const expansion = tendency.expansion <= 2 ? 1 - neutral : tendency.expansion >= 4 ? neutral : 0;
  return [
    guidelines.rareFirst && nodeType(ctx.view.map, node) === "rare" ? 0 : 1,
    guidelines.weakFirst && owner !== null && ctx.weakest.has(owner) ? 0 : 1,
    expansion,
  ];
}

function compareRank(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

/** froms에 인접한 아군이 아닌 거점(claimed 제외)을 정렬 키 → 추정 방어력 → id 순으로 */
function attackTargets(
  ctx: Ctx,
  froms: readonly NodeId[],
  claimed: ReadonlySet<NodeId>,
): { node: NodeId; def: number; rank: number[] }[] {
  const nodes = new Set(froms.flatMap((f) => neighbors(ctx.view.map, f)));
  return [...nodes]
    .filter((n) => !mine(ctx, n) && !claimed.has(n))
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
