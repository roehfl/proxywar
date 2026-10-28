import { createRng } from "../rng";
import type { GameEvent, GameState, Mission, Orders } from "../types";
import { resolveCombat } from "./combat";
import { resolveConditions } from "./conditions";
import { resolveDiplomacy } from "./diplomacy";
import { resolveEconomy } from "./economy";
import { resolveGrowth } from "./growth";
import { recoverHeroes } from "./heroes";
import { resolveMovement } from "./movement";
import { applyLoyalty } from "./traits";
import { resolveVictory } from "./victory";

export interface TurnResult {
  state: GameState;
  events: GameEvent[];
}

/**
 * 정각 처리 한 번. 원본을 바꾸지 않고 새 상태와 이벤트를 돌려준다.
 * orders는 validatePlan을 통과한 확정 명령이다. 난수는 (매치 시드, 새 턴, 용도)에서 만든다.
 * 순서: 메모 저장 → 충성 판정 → 이동 → 조건 판정·반응 → 전투 → 생산·건설·모집·유지비 → 레벨업 → 회복 → 외교 정산
 * → 탈락·종료
 */
export function processTurn(prev: GameState, orders: Orders): TurnResult {
  if (prev.ended) throw new Error("match already ended");
  const state: GameState = JSON.parse(JSON.stringify(prev));
  state.turn += 1;
  const rng = (purpose: string) => createRng(state.matchSeed, state.turn, purpose);
  const events: GameEvent[] = [];
  saveMemos(state, orders);
  const missions = collectMissions(state, orders);
  applyLoyalty(state, missions, rng("loyalty"), events);
  resolveMovement(state, missions, events);
  resolveConditions(state, missions, events);
  resolveCombat(state, missions, rng("turn"), events);
  resolveEconomy(state, orders, missions, events);
  resolveGrowth(state, rng("growth"), events);
  recoverHeroes(state, events);
  resolveDiplomacy(state, orders, events);
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

/** 참모 메모: 이번 계획의 메모를 다음 시야로 넘긴다(메모가 없으면 비운다) */
function saveMemos(state: GameState, orders: Orders): void {
  for (const seat of state.seats) {
    if (seat.eliminatedAt === null) seat.memo = orders[seat.id]?.memo ?? "";
  }
}
