import { BALANCE } from "./data/balance";
import { compareText } from "./map";
import type { GameState, NodeId, SeatId } from "./types";

export function ownedNodes(state: GameState, seat: SeatId): NodeId[] {
  return Object.values(state.nodes)
    .filter((n) => n.owner === seat)
    .map((n) => n.id)
    .sort(compareText);
}

/** 아군 거점 수비대 + 활동 중인 영웅의 병력 */
export function totalTroops(state: GameState, seat: SeatId): number {
  const garrison = Object.values(state.nodes)
    .filter((n) => n.owner === seat)
    .reduce((sum, n) => sum + n.garrison, 0);
  const heroes = state.heroes
    .filter((h) => h.seat === seat && h.status === "active")
    .reduce((sum, h) => sum + h.troops, 0);
  return garrison + heroes;
}

export function scoreOf(state: GameState, seat: SeatId): number {
  return (
    ownedNodes(state, seat).length * BALANCE.score.perNode +
    Math.floor(totalTroops(state, seat) / BALANCE.score.troopsPerPoint)
  );
}
