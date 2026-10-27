import { describe, expect, it } from "vitest";
import { validatePlan } from "../src/orders";
import { processTurn } from "../src/rules/turn";
import { rulePlan, ruleStaff } from "../src/staff/rule-staff";
import { heroOf, makeState } from "./helpers";

describe("rulePlan", () => {
  it("시작 상태에서 모든 자리의 계획이 검증을 통과한다", () => {
    const state = makeState();
    for (let seat = 0; seat < 6; seat++) {
      expect(validatePlan(state, seat, rulePlan(state, seat)).issues).toEqual([]);
    }
  });

  it("첫 턴에 첫 영웅이 수도에서 30을 꺼내 가장 약한 이웃(동률은 id 순)을 공격하고 나머지는 방어한다", () => {
    const plan = rulePlan(makeState(), 0);
    expect(plan.missions[0]).toEqual({ kind: "attack", hero: "s0h0", target: "f0", draw: 30 });
    expect(plan.missions.slice(1).map((m) => m.kind)).toEqual(["defend", "defend", "defend", "defend"]);
  });

  it("혼자 못 깨는 이웃은 인접한 영웅들이 합쳐 넘으면 함께 공격한다", () => {
    const state = makeState();
    for (const n of ["f0", "m0"]) Object.assign(state.nodes[n], { owner: 0, garrison: 0 });
    const troops = [88, 18, 20, 0, 0];
    troops.forEach((t, j) => Object.assign(heroOf(state, `s0h${j}`), { location: "f0", troops: t }));
    const plan = rulePlan(state, 0);
    expect(validatePlan(state, 0, plan).issues).toEqual([]);
    expect(plan.missions).toEqual([
      { kind: "attack", hero: "s0h0", target: "x5", draw: 0 },
      { kind: "attack", hero: "s0h1", target: "x5", draw: 0 },
      { kind: "attack", hero: "s0h2", target: "x5", draw: 0 },
      { kind: "defend", hero: "s0h3" },
      { kind: "defend", hero: "s0h4" },
    ]);
  });

  it("약한 영웅은 병력 있는 거점까지 돌아가 채운 뒤 전선으로 나간다(전선과 내부를 왕복하지 않는다)", () => {
    const state = makeState();
    for (const n of ["f0", "m0", "x5"]) Object.assign(state.nodes[n], { owner: 0, garrison: 0 });
    state.nodes.c0.garrison = 200;
    for (let j = 1; j < 5; j++) heroOf(state, `s0h${j}`).status = "out";
    const hero = heroOf(state, "s0h0");
    Object.assign(hero, { location: "x5", troops: 10 });
    expect(rulePlan(state, 0).missions[0]).toEqual({ kind: "move", hero: "s0h0", to: "f0", draw: 0 });
    hero.location = "f0";
    expect(rulePlan(state, 0).missions[0]).toEqual({ kind: "move", hero: "s0h0", to: "c0", draw: 0 });
    hero.location = "c0";
    expect(rulePlan(state, 0).missions[0]).toEqual({ kind: "move", hero: "s0h0", to: "m0", draw: 130 });
  });

  it("식량을 유지비 5턴 치 남기는 만큼 수도에서 모집한다", () => {
    expect(rulePlan(makeState(), 0).recruits).toEqual([{ node: "c0", amount: 30 }]);
  });

  it("전선이 아닌 거점에서 채울 병력도 없는 영웅은 거점을 운영한다", () => {
    const state = makeState();
    for (const n of ["f0", "m0"]) Object.assign(state.nodes[n], { owner: 0, garrison: 0 });
    const plan = rulePlan(state, 0);
    expect(validatePlan(state, 0, plan).issues).toEqual([]);
    expect(plan.missions.map((m) => m.kind)).toEqual(["govern", "govern", "govern", "govern", "govern"]);
  });

  it("자재가 되면 수도 생산 건물을 먼저 짓고 남은 금으로 모집한다", () => {
    const state = makeState();
    state.seats[0].treasury.material = 30;
    const plan = rulePlan(state, 0);
    expect(plan.builds).toEqual([{ node: "c0", building: "production" }]);
    expect(plan.recruits).toEqual([{ node: "c0", amount: 30 }]);
  });

  it("짓고 나면 금이 15 아래로 떨어질 때는 짓지 않는다", () => {
    const state = makeState();
    Object.assign(state.seats[0].treasury, { gold: 30, material: 30 });
    expect(rulePlan(state, 0).builds).toEqual([]);
  });

  it("수도 생산이 최고 레벨이면 아군 농장·광산 생산, 그것도 다 차면 수도 성벽을 짓는다", () => {
    const state = makeState();
    Object.assign(state.seats[0].treasury, { gold: 200, material: 200 });
    state.nodes.c0.buildings.production = 3;
    state.nodes.f0.owner = 0;
    expect(rulePlan(state, 0).builds).toEqual([{ node: "f0", building: "production" }]);
    state.nodes.f0.buildings.production = 3;
    expect(rulePlan(state, 0).builds).toEqual([{ node: "c0", building: "walls" }]);
  });

  it("ruleStaff는 rulePlan과 같은 계획을 비동기로 낸다", async () => {
    const state = makeState();
    expect(await ruleStaff.plan({ state, seat: 2 })).toEqual(rulePlan(state, 2));
  });

  it("30턴 동안 모든 자리의 계획이 검증을 통과하고 첫 턴에 농장을 얻는다", () => {
    let state = makeState();
    for (let turn = 1; turn <= 30; turn++) {
      const plans = state.seats.map((s) => rulePlan(state, s.id));
      const checked = plans.map((p, seat) => validatePlan(state, seat, p));
      for (const c of checked) expect(c.issues).toEqual([]);
      state = processTurn(state, checked.map((c) => c.plan)).state;
      if (turn === 1) expect(state.nodes.f0.owner).toBe(0);
    }
  });
});
