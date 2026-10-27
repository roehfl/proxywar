import { BALANCE, recruitCap } from "../data/balance";
import { bfs, compareText, neighbors } from "../map";
import { defensePower, heroModifier, troopCap } from "../rules/power";
import { ownedNodes, totalTroops } from "../summary";
import type { GameState, Hero, Mission, NodeId, Plan, Recruit, SeatId } from "../types";
import type { Staff } from "./types";

/** 수도에 남겨 둘 수비대(1b에서 안전장치 세팅으로 바뀐다) */
const CAPITAL_RESERVE = 30;
/** 추정 방어력의 이 배수를 넘을 때만 공격한다 */
const ATTACK_MARGIN = 1.3;
/** 모집 뒤 식량은 예상 유지비의 이 턴 수만큼 남긴다 */
const FOOD_RESERVE_TURNS = 5;

export const ruleStaff: Staff = {
  plan: async ({ state, seat }) => rulePlan(state, seat),
};

export function rulePlan(state: GameState, seat: SeatId): Plan {
  return { missions: planMissions(state, seat), recruits: planRecruits(state, seat), builds: [] };
}

function reserveAt(state: GameState, seat: SeatId, node: NodeId): number {
  return state.seats[seat].capital === node ? CAPITAL_RESERVE : 0;
}

function isFrontier(state: GameState, seat: SeatId, node: NodeId): boolean {
  return neighbors(state.map, node).some((n) => state.nodes[n].owner !== seat);
}

/** 아군 거점만 지나 goal을 만족하는 가장 가까운 아군 거점으로 가는 첫 걸음. 없으면 null. */
function stepToward(state: GameState, seat: SeatId, from: NodeId, goal: (node: NodeId) => boolean): NodeId | null {
  const { dist, prev } = bfs(state.map, from, (n) => state.nodes[n].owner === seat);
  const target: NodeId | undefined = Object.keys(dist)
    .filter((n) => n !== from && state.nodes[n].owner === seat && goal(n))
    .sort((a, b) => dist[a] - dist[b] || compareText(a, b))[0];
  if (target === undefined) return null;
  let step = target;
  while (prev[step] !== from) step = prev[step]!;
  return step;
}

/** 전선의 약한 영웅이 병력을 받으러 돌아갈 첫 걸음. 돌아갈 필요가 없거나 갈 곳이 없으면 null. */
function regroupStep(state: GameState, seat: SeatId, hero: Hero, draw: number): NodeId | null {
  const half = troopCap(hero) / 2;
  if (hero.troops + draw >= half) return null;
  const source: NodeId | undefined = ownedNodes(state, seat)
    .filter((n) => n !== hero.location && state.nodes[n].garrison - reserveAt(state, seat, n) >= half)
    .sort(
      (a, b) =>
        state.nodes[b].garrison - reserveAt(state, seat, b) - (state.nodes[a].garrison - reserveAt(state, seat, a)) ||
        compareText(a, b),
    )[0];
  if (source === undefined) return null;
  return stepToward(state, seat, hero.location, (n) => n === source);
}

/** 거점별로 이미 꺼내기로 한 뒤 남은 수비대(left)를 보고, 영웅이 서 있는 곳에서 꺼낼 수 있는 병력 */
function drawFor(state: GameState, seat: SeatId, hero: Hero, left: Record<NodeId, number>): number {
  const garrison = left[hero.location] ?? state.nodes[hero.location].garrison;
  return Math.max(0, Math.min(garrison - reserveAt(state, seat, hero.location), troopCap(hero) - hero.troops));
}

/** froms에 인접한 아군이 아닌 거점(claimed 제외)을 추정 방어력이 낮은 순으로 */
function attackTargets(
  state: GameState,
  seat: SeatId,
  froms: readonly NodeId[],
  claimed: ReadonlySet<NodeId>,
): { node: NodeId; def: number }[] {
  const nodes = new Set(froms.flatMap((f) => neighbors(state.map, f)));
  return [...nodes]
    .filter((n) => state.nodes[n].owner !== seat && !claimed.has(n))
    .map((n) => ({ node: n, def: defensePower(state, n) }))
    .sort((a, b) => a.def - b.def || compareText(a.node, b.node));
}

function planMissions(state: GameState, seat: SeatId): Mission[] {
  const planned = new Map<string, Mission>();
  const left: Record<NodeId, number> = {};
  const claimed = new Set<NodeId>();
  const heroes = state.heroes
    .filter((h) => h.seat === seat && h.status === "active")
    .sort((a, b) => compareText(a.id, b.id));
  const idle = (): Hero[] => heroes.filter((h) => !planned.has(h.id));
  const takeDraw = (hero: Hero): number => {
    const draw = drawFor(state, seat, hero, left);
    left[hero.location] = (left[hero.location] ?? state.nodes[hero.location].garrison) - draw;
    return draw;
  };

  // 1) 혼자 깰 수 있는 가장 약한 이웃을 공격한다
  for (const hero of heroes) {
    const force = (hero.troops + drawFor(state, seat, hero, left)) * heroModifier(hero);
    const target = attackTargets(state, seat, [hero.location], claimed).find((t) => force > t.def * ATTACK_MARGIN);
    if (!target) continue;
    claimed.add(target.node);
    planned.set(hero.id, { kind: "attack", hero: hero.id, target: target.node, draw: takeDraw(hero) });
  }

  // 2) 혼자 못 깨는 목표는 인접한 남은 영웅들이 합쳐 넘을 수 있으면 함께 공격한다
  for (const target of attackTargets(state, seat, idle().map((h) => h.location), claimed)) {
    // 같은 거점 수비대를 앞 영웅이 다 꺼내면 뒤 영웅은 병력 0이 되므로, 실제로 병력을 든 영웅만 센다
    const trial = { ...left };
    let troops = 0;
    const group = idle().filter((h) => {
      if (!neighbors(state.map, h.location).includes(target.node)) return false;
      const draw = drawFor(state, seat, h, trial);
      trial[h.location] = (trial[h.location] ?? state.nodes[h.location].garrison) - draw;
      troops += h.troops + draw;
      return h.troops + draw > 0;
    });
    if (group.length < 2) continue;
    if (troops * Math.max(...group.map((h) => heroModifier(h))) <= target.def * ATTACK_MARGIN) continue;
    claimed.add(target.node);
    for (const h of group) planned.set(h.id, { kind: "attack", hero: h.id, target: target.node, draw: takeDraw(h) });
  }

  // 3) 나머지: 약하면 병력 있는 거점까지 돌아가고(전선이든 내부든), 아니면 전선으로 가거나 지킨다
  for (const hero of idle()) {
    const back = regroupStep(state, seat, hero, drawFor(state, seat, hero, left));
    if (back !== null) {
      planned.set(hero.id, { kind: "move", hero: hero.id, to: back, draw: 0 });
      continue;
    }
    const here = hero.location;
    const step = isFrontier(state, seat, here) ? null : stepToward(state, seat, here, (n) => isFrontier(state, seat, n));
    if (step === null) planned.set(hero.id, { kind: "defend", hero: hero.id });
    else planned.set(hero.id, { kind: "move", hero: hero.id, to: step, draw: takeDraw(hero) });
  }
  return heroes.map((h) => planned.get(h.id)!);
}

function planRecruits(state: GameState, seat: SeatId): Recruit[] {
  const { gold, food } = state.seats[seat].treasury;
  const { unit, costPerUnit } = BALANCE.recruit;
  let spentGold = 0;
  let spentFood = 0;
  let troops = totalTroops(state, seat);
  const recruits: Recruit[] = [];
  for (const node of ownedNodes(state, seat)) {
    const cap = recruitCap(state, seat, node);
    let amount = 0;
    while (amount + unit <= cap) {
      const nextGold = spentGold + costPerUnit.gold;
      const nextFood = spentFood + costPerUnit.food;
      const upkeep = Math.ceil((troops + unit) / BALANCE.upkeep.soldiersPerFood);
      if (gold < nextGold || food - nextFood < upkeep * FOOD_RESERVE_TURNS) break;
      spentGold = nextGold;
      spentFood = nextFood;
      troops += unit;
      amount += unit;
    }
    if (amount > 0) recruits.push({ node, amount });
  }
  return recruits;
}
