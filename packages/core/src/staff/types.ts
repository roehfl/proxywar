import type { GameState, Plan, SeatId } from "../types";

/** 1a는 전체 상태를 넘긴다. 1b에서 시야 보고서로 바꾼다. */
export interface StaffInput {
  state: GameState;
  seat: SeatId;
}

export interface Staff {
  plan(input: StaffInput): Promise<Plan>;
}
