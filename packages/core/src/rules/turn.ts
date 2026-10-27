import { createRng } from "../rng";
import type { GameEvent, GameState, Mission, Orders } from "../types";
import { resolveCombat } from "./combat";
import { resolveEconomy } from "./economy";
import { resolveMovement } from "./movement";
import { resolveVictory } from "./victory";

export interface TurnResult {
  state: GameState;
  events: GameEvent[];
}

/**
 * 정각 처리 한 번. 원본을 바꾸지 않고 새 상태와 이벤트를 돌려준다.
 * orders는 validatePlan을 통과한 확정 명령이다. 난수는 (매치 시드, 새 턴)에서 만든다.
 */
export function processTurn(prev: GameState, orders: Orders): TurnResult {
  if (prev.ended) throw new Error("match already ended");
  const state: GameState = JSON.parse(JSON.stringify(prev));
  state.turn += 1;
  const rng = createRng(state.matchSeed, state.turn, "turn");
  const events: GameEvent[] = [];
  const missions = collectMissions(state, orders);
  resolveMovement(state, missions, events);
  resolveCombat(state, missions, rng, events);
  resolveEconomy(state, orders, events);
  resolveVictory(state, events);
  return { state, events };
}

function collectMissions(state: GameState, orders: Orders): Map<string, Mission> {
  const missions = new Map<string, Mission>();
  orders.forEach((plan, seat) => {
    if (state.seats[seat]?.eliminatedAt !== null) return;
    for (const mission of plan.missions) missions.set(mission.hero, mission);
  });
  return missions;
}
