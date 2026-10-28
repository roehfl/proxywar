import {
  buildingLevels,
  confirmPlan,
  heroLevels,
  initState,
  ownedNodes,
  processTurn,
  ruleStaff,
  scoreOf,
  totalTroops,
  validatePlan,
  viewOf,
  type Correction,
  type GameEvent,
  type GameState,
  type MatchResult,
  type Plan,
  type PlanIssue,
  type Resources,
  type Staff,
} from "@proxywar/core";
import type { RunConfig, StaffConfig } from "./config";

export interface SeatMetrics {
  seat: number;
  nodes: number;
  troops: number;
  score: number;
  /** 건물 레벨 합 */
  buildings: number;
  /** out이 아닌 영웅의 (레벨 − 1) 합 */
  heroLevels: number;
  treasury: Resources;
  eliminated: boolean;
}

export interface TurnRecord {
  turn: number;
  /** 참모가 낸 원래 계획(자리 순) */
  plans: Plan[];
  /** 검증에서 빠진 항목(자리 순) */
  issues: PlanIssue[][];
  /** 확정 때 제약(상시 명령 + 안전장치)이 고친 임무(자리 순) */
  corrections: Correction[][];
  events: GameEvent[];
  metrics: SeatMetrics[];
}

export interface MatchRecord {
  version: 4;
  config: RunConfig;
  initialState: GameState;
  turns: TurnRecord[];
  result: MatchResult;
}

const EMPTY_PLAN: Plan = { missions: [], recruits: [], builds: [] };

export function staffFor(config: StaffConfig): Staff {
  switch (config.kind) {
    case "rule":
      return ruleStaff;
  }
}

export function seatMetrics(state: GameState): SeatMetrics[] {
  return state.seats.map((s) => ({
    seat: s.id,
    nodes: ownedNodes(state, s.id).length,
    troops: totalTroops(state, s.id),
    score: scoreOf(state, s.id),
    buildings: buildingLevels(state, s.id),
    heroLevels: heroLevels(state, s.id),
    treasury: { ...s.treasury },
    eliminated: s.eliminatedAt !== null,
  }));
}

/** 참모 호출(자리별 시야) → 검증 → 확정 → 처리를 매치가 끝날 때까지 반복한다. 첫 호출은 초기 상태로 한다. */
export async function runMatch(config: RunConfig, staffs: readonly Staff[]): Promise<MatchRecord> {
  const initialState = initState(config);
  let state = initialState;
  const turns: TurnRecord[] = [];
  while (state.ended === null) {
    const current = state;
    const plans = await Promise.all(
      current.seats.map((s) =>
        s.eliminatedAt === null ? staffs[s.id].plan({ view: viewOf(current, s.id) }) : Promise.resolve(EMPTY_PLAN),
      ),
    );
    const confirmed = plans.map((plan, seat) => {
      const checked = validatePlan(current, seat, plan);
      return { issues: checked.issues, ...confirmPlan(current, seat, checked.plan) };
    });
    const { state: next, events } = processTurn(
      current,
      confirmed.map((c) => c.plan),
    );
    turns.push({
      turn: next.turn,
      plans,
      issues: confirmed.map((c) => c.issues),
      corrections: confirmed.map((c) => c.corrections),
      events,
      metrics: seatMetrics(next),
    });
    state = next;
  }
  return { version: 4, config, initialState, turns, result: state.ended! };
}
