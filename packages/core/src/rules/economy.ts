import { BALANCE } from "../data/balance";
import { nodeType } from "../map";
import { totalTroops } from "../summary";
import type { GameEvent, GameState, NodeId, Orders, Resources, SeatId } from "../types";

const KEYS = ["gold", "food", "material", "rare"] as const;

/** 생산·성장 단계: 살아 있는 자리마다 생산 → 모집 → 유지비 */
export function resolveEconomy(state: GameState, orders: Orders, events: GameEvent[]): void {
  for (const seat of state.seats) {
    if (seat.eliminatedAt !== null) continue;
    collectIncome(state, seat.id, events);
    for (const recruit of orders[seat.id]?.recruits ?? []) {
      recruitAt(state, seat.id, recruit.node, recruit.amount, events);
    }
    payUpkeep(state, seat.id, events);
  }
}

function collectIncome(state: GameState, seat: SeatId, events: GameEvent[]): void {
  const gain: Resources = { gold: 0, food: 0, material: 0, rare: 0 };
  for (const node of Object.values(state.nodes)) {
    if (node.owner !== seat) continue;
    const produced = BALANCE.production[nodeType(state.map, node.id)];
    for (const k of KEYS) gain[k] += produced[k];
  }
  const treasury = state.seats[seat].treasury;
  for (const k of KEYS) treasury[k] += gain[k];
  events.push({ kind: "income", seat, gain });
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
