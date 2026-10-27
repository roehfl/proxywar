import { BALANCE, buildCost } from "../data/balance";
import { nodeType } from "../map";
import { totalTroops } from "../summary";
import type { Build, GameEvent, GameState, Hero, Mission, NodeId, Orders, Resources, SeatId } from "../types";
import { gainExp } from "./growth";

const KEYS = ["gold", "food", "material", "rare"] as const;

/** 생산·성장 단계: 살아 있는 자리마다 생산 → 건설 → 모집 → 유지비, 끝으로 운영한 영웅의 경험치 */
export function resolveEconomy(
  state: GameState,
  orders: Orders,
  missions: ReadonlyMap<string, Mission>,
  events: GameEvent[],
): void {
  const governors = governorsOf(state, missions);
  for (const seat of state.seats) {
    if (seat.eliminatedAt !== null) continue;
    collectIncome(state, seat.id, governors, events);
    for (const build of orders[seat.id]?.builds ?? []) buildAt(state, seat.id, build, events);
    for (const recruit of orders[seat.id]?.recruits ?? []) {
      recruitAt(state, seat.id, recruit.node, recruit.amount, events);
    }
    payUpkeep(state, seat.id, events);
  }
  for (const hero of governors) gainExp(hero, BALANCE.exp.govern);
}

/** 운영 임무를 받았고, 지금도 활동 중이며 아군 거점에 서 있는 영웅 */
function governorsOf(state: GameState, missions: ReadonlyMap<string, Mission>): Hero[] {
  return state.heroes.filter(
    (h) =>
      h.status === "active" && missions.get(h.id)?.kind === "govern" && state.nodes[h.location].owner === h.seat,
  );
}

/** 거점 생산 × (100% + 생산 건물 레벨 × 50% + 운영 영웅 최고 내정 × 3%), 자원별 내림 */
function collectIncome(state: GameState, seat: SeatId, governors: readonly Hero[], events: GameEvent[]): void {
  const gain: Resources = { gold: 0, food: 0, material: 0, rare: 0 };
  for (const node of Object.values(state.nodes)) {
    if (node.owner !== seat) continue;
    const admin = Math.max(0, ...governors.filter((h) => h.location === node.id).map((h) => h.stats.admin));
    const percent =
      100 +
      node.buildings.production * BALANCE.buildings.productionPercentPerLevel +
      admin * BALANCE.govern.percentPerAdmin;
    const produced = BALANCE.production[nodeType(state.map, node.id)];
    for (const k of KEYS) gain[k] += Math.floor((produced[k] * percent) / 100);
  }
  const treasury = state.seats[seat].treasury;
  for (const k of KEYS) treasury[k] += gain[k];
  events.push({ kind: "income", seat, gain });
}

function buildAt(state: GameState, seat: SeatId, build: Build, events: GameEvent[]): void {
  const node = state.nodes[build.node];
  if (node.owner !== seat) {
    events.push({ kind: "buildSkipped", seat, node: build.node, building: build.building, reason: "notOwned" });
    return;
  }
  const level = node.buildings[build.building] + 1;
  const cost = buildCost(level);
  const treasury = state.seats[seat].treasury;
  if (treasury.gold < cost.gold || treasury.material < cost.material) {
    events.push({ kind: "buildSkipped", seat, node: build.node, building: build.building, reason: "unaffordable" });
    return;
  }
  treasury.gold -= cost.gold;
  treasury.material -= cost.material;
  node.buildings[build.building] = level;
  events.push({ kind: "built", seat, node: build.node, building: build.building, level });
}

function recruitAt(state: GameState, seat: SeatId, node: NodeId, amount: number, events: GameEvent[]): void {
  if (state.nodes[node].owner !== seat) {
    events.push({ kind: "recruitSkipped", seat, node, reason: "notOwned" });
    return;
  }
  const units = amount / BALANCE.recruit.unit;
  const gold = units * BALANCE.recruit.costPerUnit.gold;
  const food = units * BALANCE.recruit.costPerUnit.food;
  const treasury = state.seats[seat].treasury;
  if (treasury.gold < gold || treasury.food < food) {
    events.push({ kind: "recruitSkipped", seat, node, reason: "unaffordable" });
    return;
  }
  treasury.gold -= gold;
  treasury.food -= food;
  state.nodes[node].garrison += amount;
  events.push({ kind: "recruited", seat, node, amount });
}

function payUpkeep(state: GameState, seat: SeatId, events: GameEvent[]): void {
  const treasury = state.seats[seat].treasury;
  const cost = Math.ceil(totalTroops(state, seat) / BALANCE.upkeep.soldiersPerFood);
  if (treasury.food >= cost) {
    treasury.food -= cost;
    events.push({ kind: "upkeep", seat, food: cost, deserted: 0 });
    return;
  }
  const paid = treasury.food;
  treasury.food = 0;
  const keep = (n: number): number => Math.floor((n * (100 - BALANCE.upkeep.desertionPercent)) / 100);
  let deserted = 0;
  for (const node of Object.values(state.nodes)) {
    if (node.owner !== seat) continue;
    const left = keep(node.garrison);
    deserted += node.garrison - left;
    node.garrison = left;
  }
  for (const hero of state.heroes) {
    if (hero.seat !== seat || hero.status !== "active") continue;
    const left = keep(hero.troops);
    deserted += hero.troops - left;
    hero.troops = left;
  }
  events.push({ kind: "upkeep", seat, food: paid, deserted });
}
