import type { Plan } from "../types";
import type { SeatView } from "../view";

/** 참모는 자기 시야(보고서 데이터)만 받는다 */
export interface StaffInput {
  view: SeatView;
}

export interface Staff {
  plan(input: StaffInput): Promise<Plan>;
}
