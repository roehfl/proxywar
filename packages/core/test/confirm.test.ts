import { describe, expect, it } from "vitest";
import { confirmPlan } from "../src/confirm";
import type { GameState, Mission, Plan } from "../src/types";
import { heroOf, makeState } from "./helpers";

function confirm(state: GameState, ...missions: Mission[]) {
  return confirmPlan(state, 0, { missions, recruits: [], builds: [] });
}

const defend = (hero: string): Mission => ({ kind: "defend", hero });

describe("confirmPlan", () => {
  it("상시 명령이 없고 수도에서 최소 수비를 넘겨 꺼내지 않으면 계획(메모 포함)을 그대로 둔다", () => {
    const plan: Plan = {
      missions: [{ kind: "attack", hero: "s0h0", target: "f0", draw: 30 }, { kind: "govern", hero: "s0h1" }],
      recruits: [{ node: "c0", amount: 30 }],
      builds: [],
      memo: "m",
    };
    expect(confirmPlan(makeState(), 0, plan)).toEqual({ plan, corrections: [] });
  });

  it("수도 방어 전담: 공격·운영은 방어로, 수도 쪽 이동은 두고 다른 이동은 방어로 바꾼다", () => {
    const state = makeState();
    for (const n of ["f0", "x5"]) state.nodes[n].owner = 0;
    for (let j = 0; j < 4; j++) heroOf(state, `s0h${j}`).standing.guardCapital = true;
    for (const id of ["s0h2", "s0h3"]) heroOf(state, id).location = "f0";
    const attack: Mission = { kind: "attack", hero: "s0h0", target: "m0", draw: 0 };
    const govern: Mission = { kind: "govern", hero: "s0h1" };
    const home: Mission = { kind: "move", hero: "s0h2", to: "c0" };
    const away: Mission = { kind: "move", hero: "s0h3", to: "x5" };
    const { plan, corrections } = confirm(state, attack, govern, home, away);
    expect(plan.missions).toEqual([defend("s0h0"), defend("s0h1"), home, defend("s0h3")]);
    expect(corrections).toEqual([
      { hero: "s0h0", rule: "guardCapital", before: attack, after: defend("s0h0") },
      { hero: "s0h1", rule: "guardCapital", before: govern, after: defend("s0h1") },
      { hero: "s0h3", rule: "guardCapital", before: away, after: defend("s0h3") },
    ]);
  });

  it("수도 방어 전담: 반응이 방어가 아닌 조건은 조건만 뺀다", () => {
    const state = makeState();
    for (const id of ["s0h0", "s0h1"]) heroOf(state, id).standing.guardCapital = true;
    const flee: Mission = { kind: "defend", hero: "s0h0", when: { trigger: { kind: "enemyNear" }, react: { kind: "retreat" } } };
    const hold: Mission = { kind: "defend", hero: "s0h1", when: { trigger: { kind: "enemyNear" }, react: { kind: "defend" } } };
    const { plan, corrections } = confirm(state, flee, hold);
    expect(plan.missions).toEqual([defend("s0h0"), hold]);
    expect(corrections).toEqual([{ hero: "s0h0", rule: "guardCapital", before: flee, after: defend("s0h0") }]);
  });

  it("원정 불허: 현재 수도에서 2칸 넘는 공격·이동은 방어로, 먼 진격 조건은 조건만 뺀다", () => {
    const state = makeState();
    for (const n of ["f0", "x5", "i5"]) state.nodes[n].owner = 0;
    for (let j = 0; j < 5; j++) heroOf(state, `s0h${j}`).location = "x5";
    for (let j = 0; j < 4; j++) heroOf(state, `s0h${j}`).standing.expedition = false;
    // 수도 c0에서 f0 1칸, x5 2칸, m5·i5 3칸
    const farAttack: Mission = { kind: "attack", hero: "s0h0", target: "m5", draw: 0 };
    const nearMove: Mission = { kind: "move", hero: "s0h1", to: "f0" };
    const farMove: Mission = { kind: "move", hero: "s0h2", to: "i5" };
    const farAdvance: Mission = {
      kind: "defend",
      hero: "s0h3",
      when: { trigger: { kind: "enemyNear" }, react: { kind: "advance", node: "m5" } },
    };
    const allowed: Mission = { kind: "attack", hero: "s0h4", target: "m5", draw: 0 };
    const { plan, corrections } = confirm(state, farAttack, nearMove, farMove, farAdvance, allowed);
    expect(plan.missions).toEqual([defend("s0h0"), nearMove, defend("s0h2"), defend("s0h3"), allowed]);
    expect(corrections.map((c) => [c.hero, c.rule])).toEqual([
      ["s0h0", "expedition"],
      ["s0h2", "expedition"],
      ["s0h3", "expedition"],
    ]);
  });

  it("수도 최소 수비: 수도에서 꺼내는 병력을 영웅 id 순으로 수비대 − L × 10까지 채우고 넘는 만큼 줄인다", () => {
    const cases: [number | null, number, number, string[]][] = [
      [3, 20, 10, ["s0h1"]],
      [5, 10, 0, ["s0h0", "s0h1"]],
      [null, 20, 20, []],
    ];
    for (const [capitalMin, draw0, draw1, corrected] of cases) {
      const state = makeState();
      state.seats[0].settings.safeguards.capitalMin = capitalMin;
      const { plan, corrections } = confirm(
        state,
        { kind: "attack", hero: "s0h1", target: "f0", draw: 20 },
        { kind: "attack", hero: "s0h0", target: "m0", draw: 20 },
      );
      expect(plan.missions).toEqual([
        { kind: "attack", hero: "s0h1", target: "f0", draw: draw1 },
        { kind: "attack", hero: "s0h0", target: "m0", draw: draw0 },
      ]);
      expect(corrections.map((c) => c.hero)).toEqual(corrected);
      expect(corrections.every((c) => c.rule === "capitalMin")).toBe(true);
    }
  });

  it("수도 최소 수비: 통솔 상한 때문에 어차피 못 꺼내는 몫은 세지 않는다", () => {
    const state = makeState();
    heroOf(state, "s0h0").troops = 130; // 상한 140이라 10만 더 꺼낸다
    const big: Mission = { kind: "attack", hero: "s0h0", target: "f0", draw: 50 };
    const small: Mission = { kind: "attack", hero: "s0h1", target: "m0", draw: 20 };
    expect(confirm(state, big, small)).toEqual({
      plan: { missions: [big, small], recruits: [], builds: [] },
      corrections: [],
    });
  });

  it("방어로 바뀐 영웅의 꺼내기는 수도 몫에서 빠진다(상시 명령 다음에 안전장치)", () => {
    const state = makeState();
    heroOf(state, "s0h0").standing.guardCapital = true;
    const guarded: Mission = { kind: "attack", hero: "s0h0", target: "f0", draw: 30 };
    const other: Mission = { kind: "attack", hero: "s0h1", target: "m0", draw: 30 };
    const { plan, corrections } = confirm(state, guarded, other);
    expect(plan.missions).toEqual([defend("s0h0"), other]);
    expect(corrections.map((c) => c.rule)).toEqual(["guardCapital"]);
  });

  it("수도가 없으면 제약을 적용하지 않는다", () => {
    const state = makeState();
    state.seats[0].capital = null;
    heroOf(state, "s0h0").standing.guardCapital = true;
    const attack: Mission = { kind: "attack", hero: "s0h0", target: "f0", draw: 60 };
    expect(confirm(state, attack).corrections).toEqual([]);
  });
});
