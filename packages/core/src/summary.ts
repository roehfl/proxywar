import { BALANCE, BUILDING_KINDS } from "./data/balance";
import { compareText } from "./map";
import type { Board, GameState, NodeId, SeatId } from "./types";

export function ownedNodes(board: Pick<Board, "nodes">, seat: SeatId): NodeId[] {
  return Object.values(board.nodes)
    .filter((n) => n.owner === seat)
    .map((n) => n.id)
    .sort(compareText);
}

/** 아군 거점 수비대 + 활동 중인 영웅의 병력 */
export function totalTroops(board: Pick<Board, "nodes" | "heroes">, seat: SeatId): number {
  const garrison = Object.values(board.nodes)
    .filter((n) => n.owner === seat)
    .reduce((sum, n) => sum + n.garrison, 0);
  const heroes = board.heroes
    .filter((h) => h.seat === seat && h.status === "active")
    .reduce((sum, h) => sum + h.troops, 0);
  return garrison + heroes;
}

/** 아군 거점의 건물 레벨 합(거점 발전도) */
export function buildingLevels(state: GameState, seat: SeatId): number {
  return Object.values(state.nodes)
    .filter((n) => n.owner === seat)
    .reduce((sum, n) => sum + BUILDING_KINDS.reduce((s, k) => s + n.buildings[k], 0), 0);
}

/** out이 아닌 영웅(부상·포로 포함)의 (레벨 − 1) 합(영웅 성장) */
export function heroLevels(state: GameState, seat: SeatId): number {
  return state.heroes
    .filter((h) => h.seat === seat && h.status !== "out")
    .reduce((sum, h) => sum + h.level - 1, 0);
}

export function scoreOf(state: GameState, seat: SeatId): number {
  return (
    ownedNodes(state, seat).length * BALANCE.score.perNode +
    Math.floor(totalTroops(state, seat) / BALANCE.score.troopsPerPoint) +
    buildingLevels(state, seat) * BALANCE.score.perBuildingLevel +
    heroLevels(state, seat) * BALANCE.score.perHeroLevel
  );
}
