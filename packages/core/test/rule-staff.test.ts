import { describe, expect, it } from "vitest";
import { confirmPlan } from "../src/confirm";
import { validatePlan } from "../src/orders";
import { processTurn } from "../src/rules/turn";
import { PRESET_NAMES } from "../src/settings";
import { MatchSetupSchema } from "../src/setup";
import { initState } from "../src/state";
import { rulePlan, ruleStaff } from "../src/staff/rule-staff";
import type { GameState, Plan } from "../src/types";
import { viewOf } from "../src/view";
import { heroOf, makeSetup, makeState } from "./helpers";

function planOf(state: GameState, seat = 0): Plan {
  return rulePlan(viewOf(state, seat));
}

const ALL_DEFEND = ["defend", "defend", "defend", "defend", "defend"];

describe("rulePlan", () => {
  it("시작 상태에서 모든 자리의 계획이 검증을 통과한다", () => {
    const state = makeState();
    for (let seat = 0; seat < 6; seat++) {
      expect(validatePlan(state, seat, planOf(state, seat)).issues).toEqual([]);
    }
  });

  it("첫 턴에 첫 영웅이 수도에서 30을 꺼내 가장 약한 이웃(동률은 id 순)을 공격하고 나머지는 방어한다", () => {
    const plan = planOf(makeState());
    expect(plan.missions[0]).toEqual({ kind: "attack", hero: "s0h0", target: "f0", draw: 30 });
    expect(plan.missions.slice(1).map((m) => m.kind)).toEqual(["defend", "defend", "defend", "defend"]);
  });

  it("혼자 못 깨는 이웃은 인접한 영웅들이 합쳐 넘으면 함께 공격한다", () => {
    const state = makeState();
    for (const n of ["f0", "m0"]) Object.assign(state.nodes[n], { owner: 0, garrison: 0 });
    const troops = [88, 18, 20, 0, 0];
    troops.forEach((t, j) => Object.assign(heroOf(state, `s0h${j}`), { location: "f0", troops: t }));
    const plan = planOf(state);
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
    expect(planOf(state).missions[0]).toEqual({ kind: "move", hero: "s0h0", to: "f0", draw: 0 });
    hero.location = "f0";
    expect(planOf(state).missions[0]).toEqual({ kind: "move", hero: "s0h0", to: "c0", draw: 0 });
    hero.location = "c0";
    expect(planOf(state).missions[0]).toEqual({ kind: "move", hero: "s0h0", to: "m0", draw: 130 });
  });

  it("식량을 유지비 5턴 치 남기는 만큼 수도에서 모집한다", () => {
    expect(planOf(makeState()).recruits).toEqual([{ node: "c0", amount: 30 }]);
  });

  it("전선이 아닌 거점에서 채울 병력도 없는 영웅은 거점을 운영한다", () => {
    const state = makeState();
    for (const n of ["f0", "m0"]) Object.assign(state.nodes[n], { owner: 0, garrison: 0 });
    const plan = planOf(state);
    expect(validatePlan(state, 0, plan).issues).toEqual([]);
    expect(plan.missions.map((m) => m.kind)).toEqual(["govern", "govern", "govern", "govern", "govern"]);
  });

  it("자재가 되면 수도 생산 건물을 먼저 짓고 남은 금으로 모집한다", () => {
    const state = makeState();
    Object.assign(state.seats[0].treasury, { gold: 40, food: 200, material: 30 });
    state.nodes.i1.owner = 0;
    const plan = planOf(state);
    expect(plan.builds).toEqual([{ node: "c0", building: "production" }]);
    // 금 40 − 건설 20 = 20으로 4단위(수도 30 + 도시 10). 건설 금을 빼지 않으면 도시가 20이 된다
    expect(plan.recruits).toEqual([
      { node: "c0", amount: 30 },
      { node: "i1", amount: 10 },
    ]);
  });

  it("짓고 나면 금이 15 아래로 떨어질 때는 짓지 않는다", () => {
    const state = makeState();
    Object.assign(state.seats[0].treasury, { gold: 30, material: 30 });
    expect(planOf(state).builds).toEqual([]);
  });

  it("수도 생산이 최고 레벨이면 아군 농장·광산 생산, 그것도 다 차면 수도 성벽을 짓는다", () => {
    const state = makeState();
    Object.assign(state.seats[0].treasury, { gold: 200, material: 200 });
    state.nodes.c0.buildings.production = 3;
    state.nodes.f0.owner = 0;
    expect(planOf(state).builds).toEqual([{ node: "f0", building: "production" }]);
    state.nodes.f0.buildings.production = 3;
    expect(planOf(state).builds).toEqual([{ node: "c0", building: "walls" }]);
  });

  it("ruleStaff는 rulePlan과 같은 계획을 비동기로 낸다", async () => {
    const view = viewOf(makeState(), 2);
    expect(await ruleStaff.plan({ view })).toEqual(rulePlan(view));
  });

  it("30턴 동안 모든 자리의 계획이 검증을 통과하고 첫 턴에 농장을 얻는다", () => {
    let state = makeState();
    for (let turn = 1; turn <= 30; turn++) {
      const current = state;
      const checked = current.seats.map((s) => validatePlan(current, s.id, planOf(current, s.id)));
      for (const c of checked) expect(c.issues).toEqual([]);
      state = processTurn(
        current,
        checked.map((c) => c.plan),
      ).state;
      if (turn === 1) expect(state.nodes.f0.owner).toBe(0);
    }
  });
});

describe("rulePlan의 세팅", () => {
  it("공격성이 공격 여유 배수를 정한다(3이면 1.3, 5면 1.0)", () => {
    const state = makeState();
    state.nodes.f0.garrison = 28;
    state.nodes.m0.garrison = 40;
    // 첫 영웅이 30을 꺼내 30 × 1.12 = 33.6. f0 방어력 28 × 1.3 = 36.4는 못 넘고 28 × 1.0은 넘는다
    expect(planOf(state).missions.map((m) => m.kind)).toEqual(ALL_DEFEND);
    state.seats[0].settings.tendency.aggression = 5;
    expect(planOf(state).missions[0]).toEqual({ kind: "attack", hero: "s0h0", target: "f0", draw: 30 });
  });

  it("확장 욕구가 낮으면 남의 거점, 높으면 중립 거점을 먼저 친다", () => {
    const state = makeState();
    Object.assign(state.nodes.m0, { owner: 1, garrison: 10 });
    // 보통은 방어력이 낮은 m0(Seat1, 10)
    expect(planOf(state).missions[0]).toMatchObject({ kind: "attack", target: "m0" });
    state.seats[0].settings.tendency.expansion = 5;
    expect(planOf(state).missions[0]).toMatchObject({ kind: "attack", target: "f0" });
    state.seats[0].settings.tendency.expansion = 1;
    expect(planOf(state).missions[0]).toMatchObject({ kind: "attack", target: "m0" });
  });

  it("희귀 자원지 우선 지침을 켜면 희귀 자원지를 먼저 친다", () => {
    const state = makeState();
    for (const n of ["m0", "x0"]) Object.assign(state.nodes[n], { owner: 0, garrison: 0 });
    for (let j = 1; j < 5; j++) heroOf(state, `s0h${j}`).status = "out";
    Object.assign(heroOf(state, "s0h0"), { location: "x0", troops: 100 });
    // x0의 이웃 f1(농장 20)과 i0(희귀 40). 보통은 방어력이 낮은 f1
    expect(planOf(state).missions[0]).toMatchObject({ kind: "attack", target: "f1" });
    state.seats[0].settings.guidelines.rareFirst = true;
    expect(planOf(state).missions[0]).toMatchObject({ kind: "attack", target: "i0" });
  });

  it("약한 상대 우선 지침을 켜면 거점 수가 가장 적은 자리의 거점을 먼저 친다", () => {
    const state = makeState();
    for (const n of ["m0", "x0"]) Object.assign(state.nodes[n], { owner: 0, garrison: 0 });
    for (let j = 1; j < 5; j++) heroOf(state, `s0h${j}`).status = "out";
    Object.assign(heroOf(state, "s0h0"), { location: "x0", troops: 100 });
    // Seat1은 거점 3개(c1·f1·m1), Seat2~5는 2개씩. f1과 i0은 방어력이 20으로 같아 보통은 id 순 f1
    Object.assign(state.nodes.f1, { owner: 1, garrison: 20 });
    state.nodes.m1.owner = 1;
    Object.assign(state.nodes.i0, { owner: 2, garrison: 20 });
    for (const s of [3, 4, 5]) state.nodes[`f${s}`].owner = s;
    expect(planOf(state).missions[0]).toMatchObject({ kind: "attack", target: "f1" });
    state.seats[0].settings.guidelines.weakFirst = true;
    expect(planOf(state).missions[0]).toMatchObject({ kind: "attack", target: "i0" });
  });

  it("내정↔군사가 턴당 건설 수를 정한다(1이면 2건, 5면 짓지 않음)", () => {
    const state = makeState();
    Object.assign(state.seats[0].treasury, { gold: 200, material: 200 });
    state.nodes.f0.owner = 0;
    expect(planOf(state).builds).toEqual([{ node: "c0", building: "production" }]);
    state.seats[0].settings.tendency.focus = 1;
    expect(planOf(state).builds).toEqual([
      { node: "c0", building: "production" },
      { node: "f0", building: "production" },
    ]);
    state.seats[0].settings.tendency.focus = 5;
    expect(planOf(state).builds).toEqual([]);
  });

  it("식량 자제 지침을 끄면 식량을 유지비 1턴 치만 남기고 모집한다", () => {
    const state = makeState();
    state.seats[0].treasury.food = 30;
    expect(planOf(state).recruits).toEqual([{ node: "c0", amount: 20 }]);
    state.seats[0].settings.guidelines.foodCaution = false;
    expect(planOf(state).recruits).toEqual([{ node: "c0", amount: 30 }]);
  });

  it("수도 최소 수비만큼 수도 수비대를 남기고 꺼낸다(5면 50, 끄면 0)", () => {
    const state = makeState();
    state.seats[0].settings.safeguards.capitalMin = 5;
    // 10만 꺼내 11.2로는 f0(20 × 1.3)을 못 넘는다
    expect(planOf(state).missions.map((m) => m.kind)).toEqual(ALL_DEFEND);
    state.seats[0].settings.safeguards.capitalMin = null;
    expect(planOf(state).missions[0]).toEqual({ kind: "attack", hero: "s0h0", target: "f0", draw: 60 });
  });

  it("수도 방어 전담 영웅은 수도에 있으면 지키고, 밖에 있으면 수도로 한 걸음 돌아온다", () => {
    const state = makeState();
    heroOf(state, "s0h0").standing.guardCapital = true;
    // 첫 영웅이 지키므로 공격은 다음 영웅이 한다
    const first = planOf(state).missions;
    expect(first[0]).toEqual({ kind: "defend", hero: "s0h0" });
    expect(first[1]).toEqual({ kind: "attack", hero: "s0h1", target: "f0", draw: 30 });
    state.nodes.f0.owner = 0;
    heroOf(state, "s0h0").location = "f0";
    expect(planOf(state).missions[0]).toEqual({ kind: "move", hero: "s0h0", to: "c0", draw: 0 });
  });

  it("원정 불허 영웅은 현재 수도에서 2칸 넘는 거점을 치지 않는다", () => {
    const state = makeState();
    for (const n of ["f0", "x5"]) Object.assign(state.nodes[n], { owner: 0, garrison: 0 });
    for (let j = 1; j < 5; j++) heroOf(state, `s0h${j}`).status = "out";
    const hero = heroOf(state, "s0h0");
    Object.assign(hero, { location: "x5", troops: 100 });
    // x5의 이웃 m5(광산 20)와 i5(도시 40)는 수도 c0에서 3칸
    expect(planOf(state).missions[0]).toMatchObject({ kind: "attack", target: "m5" });
    hero.standing.expedition = false;
    expect(planOf(state).missions[0]).toEqual({ kind: "defend", hero: "s0h0" });
  });

  it("후퇴 기준이 있으면 공격 여유를 그 기준값과 비교해 큰 쪽으로 본다", () => {
    const state = makeState();
    state.nodes.f0.garrison = 25;
    state.nodes.m0.garrison = 40;
    // 33.6은 25 × 1.3 = 32.5를 넘지만 25 × 1.4 = 35는 못 넘는다
    expect(planOf(state).missions[0]).toMatchObject({ kind: "attack", target: "f0" });
    for (let j = 0; j < 5; j++) heroOf(state, `s0h${j}`).standing.retreatAt = 5;
    expect(planOf(state).missions.map((m) => m.kind)).toEqual(ALL_DEFEND);
  });

  it("위험 감수가 2 이하면 공격 임무에 '병력 비율 아래 3 → 방어' 조건을 붙인다", () => {
    const state = makeState();
    expect(planOf(state).missions[0]).not.toHaveProperty("when");
    state.seats[0].settings.tendency.risk = 2;
    expect(planOf(state).missions[0]).toEqual({
      kind: "attack",
      hero: "s0h0",
      target: "f0",
      draw: 30,
      when: { trigger: { kind: "ratioBelow", value: 3 }, react: { kind: "defend" } },
    });
  });

  it("세팅·상시 명령이 섞여도 30턴 동안 검증과 확정에서 고쳐지는 항목이 없다", () => {
    const setup = makeSetup();
    setup.seats.forEach((seat, i) => {
      seat.settings = PRESET_NAMES[i % PRESET_NAMES.length];
    });
    setup.seats[5].settings = { preset: "aggressive", tendency: { risk: 2 } };
    setup.seats[0].heroes[0].standing = { guardCapital: true };
    setup.seats[1].heroes[0].standing = { retreatAt: 4 };
    setup.seats[2].heroes[1].standing = { expedition: false };
    setup.seats[3].heroes[0].standing = { guardCapital: true, expedition: false };
    let state = initState(MatchSetupSchema.parse(setup));
    for (let turn = 1; turn <= 30 && state.ended === null; turn++) {
      const current = state;
      const confirmed = current.seats.map((s) => {
        const checked = validatePlan(current, s.id, planOf(current, s.id));
        expect(checked.issues).toEqual([]);
        return confirmPlan(current, s.id, checked.plan);
      });
      for (const c of confirmed) expect(c.corrections).toEqual([]);
      state = processTurn(
        current,
        confirmed.map((c) => c.plan),
      ).state;
    }
  });
});
