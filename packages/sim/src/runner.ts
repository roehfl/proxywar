import {
  initState,
  ownedNodes,
  processTurn,
  ruleStaff,
  scoreOf,
  totalTroops,
  validatePlan,
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
  treasury: Resources;
  eliminated: boolean;
}

export interface TurnRecord {
  turn: number;
  /** 참모가 낸 원래 계획(자리 순) */
  plans: Plan[];
  /** 검증에서 빠진 항목(자리 순) */
  issues: PlanIssue[][];
  events: GameEvent[];
  metrics: SeatMetrics[];
}

export interface MatchRecord {
  version: 1;
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
    treasury: { ...s.treasury },
    eliminated: s.eliminatedAt !== null,
  }));
}

/** 참모 호출 → 검증 → 처리를 매치가 끝날 때까지 반복한다. 첫 호출은 초기 상태로 한다. */
export async function runMatch(config: RunConfig, staffs: readonly Staff[]): Promise<MatchRecord> {
  const initialState = initState(config);
  let state = initialState;
  const turns: TurnRecord[] = [];
  while (state.ended === null) {
    const current = state;
    const plans = await Promise.all(
      current.seats.map((s) =>
        s.eliminatedAt === null ? staffs[s.id].plan({ state: current, seat: s.id }) : Promise.resolve(EMPTY_PLAN),
      ),
    );
    const checked = plans.map((plan, seat) => validatePlan(current, seat, plan));
    const { state: next, events } = processTurn(
      current,
      checked.map((c) => c.plan),
    );
    turns.push({ turn: next.turn, plans, issues: checked.map((c) => c.issues), events, metrics: seatMetrics(next) });
    state = next;
  }
  return { version: 1, config, initialState, turns, result: state.ended! };
}
