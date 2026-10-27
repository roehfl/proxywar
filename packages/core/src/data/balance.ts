import { nodeType } from "../map";
import type { GameState, NodeId, SeatId } from "../types";
import balance from "./balance.json";

export const BALANCE = balance;

/**
 * 그 자리가 그 거점에서 한 턴에 모집할 수 있는 상한.
 * 현재 수도는 수도 상한, 도시와 (현재 수도가 아닌) 원래 수도 거점은 도시 상한, 나머지는 0.
 */
export function recruitCap(state: GameState, seat: SeatId, node: NodeId): number {
  if (state.seats[seat].capital === node) return BALANCE.recruit.capPerTurn.capital;
  const type = nodeType(state.map, node);
  return type === "capital" || type === "city" ? BALANCE.recruit.capPerTurn.city : 0;
}
