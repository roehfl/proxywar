import { nodeType } from "../map";
import type { BuildingKind, GameState, NodeId, SeatId } from "../types";
import balance from "./balance.json";

export const BALANCE = balance;

export const BUILDING_KINDS: readonly BuildingKind[] = ["production", "barracks", "walls"];

/**
 * 그 자리가 그 거점에서 한 턴에 모집할 수 있는 상한.
 * 현재 수도는 수도 상한, 도시와 (현재 수도가 아닌) 원래 수도 거점은 도시 상한, 나머지는 0이고,
 * 그 거점의 병영 레벨당 상한을 더한다.
 */
export function recruitCap(state: GameState, seat: SeatId, node: NodeId): number {
  const barracks = state.nodes[node].buildings.barracks * BALANCE.buildings.barracksCapPerLevel;
  if (state.seats[seat].capital === node) return BALANCE.recruit.capPerTurn.capital + barracks;
  const type = nodeType(state.map, node);
  const base = type === "capital" || type === "city" ? BALANCE.recruit.capPerTurn.city : 0;
  return base + barracks;
}

/** 지형 방어 배수에 성벽 레벨만큼 더한 값 */
export function terrainOf(state: GameState, node: NodeId): number {
  return (
    BALANCE.terrain[nodeType(state.map, node)] +
    state.nodes[node].buildings.walls * BALANCE.buildings.wallsTerrainPerLevel
  );
}

/** 건물을 level로 올리는 비용 */
export function buildCost(level: number): { gold: number; material: number } {
  const { gold, material } = BALANCE.buildings.costPerLevel;
  return { gold: gold * level, material: material * level };
}
