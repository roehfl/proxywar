import { describe, expect, it } from "vitest";
import { validatePlan } from "../src/orders";
import type { GameState, Mission, Plan, Recruit } from "../src/types";
import { heroOf, makeState } from "./helpers";

function reasons(state: GameState, plan: Plan): string[] {
  return validatePlan(state, 0, plan).issues.map((i) => i.reason);
}

function missionsOnly(...missions: Mission[]): Plan {
  return { missions, recruits: [] };
}

function recruitsOnly(...recruits: Recruit[]): Plan {
  return { missions: [], recruits };
}

describe("validatePlan", () => {
  it("올바른 명령은 그대로 통과한다", () => {
    const state = makeState();
    state.nodes.f0.owner = 0;
    const plan: Plan = {
      missions: [
        { kind: "move", hero: "s0h0", to: "f0", draw: 10 },
        { kind: "attack", hero: "s0h1", target: "m0" },
        { kind: "defend", hero: "s0h2" },
      ],
      recruits: [{ node: "c0", amount: 30 }],
    };
    const checked = validatePlan(state, 0, plan);
    expect(checked.issues).toEqual([]);
    expect(checked.plan).toEqual(plan);
  });

  it.each<[string, Mission, string]>([
    ["없는 영웅", { kind: "defend", hero: "nope" }, "unknown hero"],
    ["남의 영웅", { kind: "defend", hero: "s1h0" }, "not your hero"],
    ["중립 거점으로 이동", { kind: "move", hero: "s0h0", to: "f0" }, "move target not own"],
    ["인접하지 않은 공격", { kind: "attack", hero: "s0h0", target: "x0" }, "not adjacent"],
    ["음수 draw", { kind: "attack", hero: "s0h0", target: "f0", draw: -5 }, "bad draw"],
    ["소수 draw", { kind: "attack", hero: "s0h0", target: "f0", draw: 1.5 }, "bad draw"],
    ["없는 거점", { kind: "attack", hero: "s0h0", target: "zz" }, "unknown node"],
    ["프로토타입 키 거점", { kind: "attack", hero: "s0h0", target: "toString" }, "unknown node"],
  ])("잘못된 임무를 뺀다: %s", (_, mission, reason) => {
    expect(reasons(makeState(), missionsOnly(mission))).toEqual([reason]);
  });

  it("활동하지 않는 영웅의 임무를 뺀다", () => {
    const state = makeState();
    heroOf(state, "s0h0").status = "out";
    expect(reasons(state, missionsOnly({ kind: "defend", hero: "s0h0" }))).toEqual(["hero not active"]);
  });

  it("아군 거점 공격을 뺀다", () => {
    const state = makeState();
    state.nodes.f0.owner = 0;
    expect(reasons(state, missionsOnly({ kind: "attack", hero: "s0h0", target: "f0" }))).toEqual([
      "attack target is own",
    ]);
  });

  it("같은 영웅의 두 번째 임무를 뺀다", () => {
    const checked = validatePlan(
      makeState(),
      0,
      missionsOnly({ kind: "defend", hero: "s0h0" }, { kind: "attack", hero: "s0h0", target: "f0" }),
    );
    expect(checked.plan.missions).toEqual([{ kind: "defend", hero: "s0h0" }]);
    expect(checked.issues).toEqual([{ item: "mission", index: 1, reason: "duplicate hero" }]);
  });

  it.each<[string, Recruit, string]>([
    ["농장에서 모집", { node: "f0", amount: 10 }, "cannot recruit here"],
    ["남의 수도에서 모집", { node: "c1", amount: 10 }, "not own node"],
    ["10명 단위가 아님", { node: "c0", amount: 25 }, "bad amount"],
    ["0명", { node: "c0", amount: 0 }, "bad amount"],
  ])("잘못된 모집을 뺀다: %s", (_, recruit, reason) => {
    const state = makeState();
    state.nodes.f0.owner = 0;
    expect(reasons(state, recruitsOnly(recruit))).toEqual([reason]);
  });

  it("수도를 옮긴 자리는 새 수도에서 수도 상한까지 모집한다", () => {
    const state = makeState();
    state.nodes.f0.owner = 0;
    state.seats[0].capital = "f0";
    expect(reasons(state, recruitsOnly({ node: "f0", amount: 30 }))).toEqual([]);
  });

  it("점령한 남의 원래 수도는 도시 상한까지만 모집한다", () => {
    const state = makeState();
    state.nodes.c1.owner = 0;
    expect(reasons(state, recruitsOnly({ node: "c1", amount: 20 }))).toEqual([]);
    expect(reasons(state, recruitsOnly({ node: "c1", amount: 30 }))).toEqual(["over cap"]);
  });

  it("같은 거점 모집 합계가 상한을 넘으면 넘는 항목을 뺀다", () => {
    const checked = validatePlan(makeState(), 0, recruitsOnly({ node: "c0", amount: 20 }, { node: "c0", amount: 20 }));
    expect(checked.plan.recruits).toEqual([{ node: "c0", amount: 20 }]);
    expect(checked.issues).toEqual([{ item: "recruit", index: 1, reason: "over cap" }]);
  });
});
