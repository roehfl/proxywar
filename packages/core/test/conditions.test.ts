import { describe, expect, it } from "vitest";
import { resolveConditions } from "../src/rules/conditions";
import { processTurn } from "../src/rules/turn";
import type { Condition, GameEvent, Mission } from "../src/types";
import { heroOf, makeState, noOrders } from "./helpers";

function defendWhen(hero: string, when: Condition): [string, Mission] {
  return [hero, { kind: "defend", hero, when }];
}

describe("resolveConditions", () => {
  it("적 접근 → 후퇴: 이웃 아군 거점 중 수도에 가장 가까운 곳으로 병력과 함께 옮겨 지킨다", () => {
    const state = makeState();
    state.nodes.f0.owner = 0;
    state.nodes.x5.owner = 5;
    Object.assign(heroOf(state, "s0h0"), { location: "f0", troops: 50 });
    Object.assign(heroOf(state, "s5h0"), { location: "x5", troops: 30 });
    const missions = new Map([defendWhen("s0h0", { trigger: { kind: "enemyNear" }, react: { kind: "retreat" } })]);
    const events: GameEvent[] = [];
    resolveConditions(state, missions, events);
    expect(heroOf(state, "s0h0")).toMatchObject({ location: "c0", troops: 50 });
    expect(missions.get("s0h0")).toEqual({ kind: "defend", hero: "s0h0" });
    expect(events).toEqual([
      { kind: "conditionMet", seat: 0, hero: "s0h0", trigger: "enemyNear", react: "retreat" },
      { kind: "moved", seat: 0, hero: "s0h0", from: "f0", to: "c0" },
    ]);
  });

  it("병력이 없는 적 영웅은 접근으로 보지 않는다", () => {
    const state = makeState();
    state.nodes.f0.owner = 0;
    state.nodes.x5.owner = 5;
    Object.assign(heroOf(state, "s0h0"), { location: "f0", troops: 50 });
    Object.assign(heroOf(state, "s5h0"), { location: "x5", troops: 0 });
    const entry = defendWhen("s0h0", { trigger: { kind: "enemyNear" }, react: { kind: "retreat" } });
    const missions = new Map([entry]);
    const events: GameEvent[] = [];
    resolveConditions(state, missions, events);
    expect(events).toEqual([]);
    expect(missions.get("s0h0")).toEqual(entry[1]);
    expect(heroOf(state, "s0h0").location).toBe("f0");
  });

  it("대상 거점이 빔 → 진격: 수비대도 지키는 영웅도 없으면 지금 병력으로 공격한다", () => {
    for (const [garrison, advances] of [
      [0, true],
      [20, false],
    ] as const) {
      const state = makeState();
      state.nodes.f0.garrison = garrison;
      heroOf(state, "s0h0").troops = 30;
      const missions = new Map([
        defendWhen("s0h0", { trigger: { kind: "targetEmpty", node: "f0" }, react: { kind: "advance", node: "f0" } }),
      ]);
      resolveConditions(state, missions, []);
      if (advances) expect(missions.get("s0h0")).toEqual({ kind: "attack", hero: "s0h0", target: "f0", draw: 0 });
      else expect(missions.get("s0h0")?.kind).toBe("defend");
    }
  });

  it("병력 비율은 같은 자리·같은 목표 부대 전체로 판정한다", () => {
    const ratioBelow = (value: number): Mission => ({
      kind: "attack",
      hero: "s0h0",
      target: "f0",
      when: { trigger: { kind: "ratioBelow", value }, react: { kind: "defend" } },
    });
    const setUp = () => {
      const state = makeState();
      state.nodes.f0.garrison = 50;
      heroOf(state, "s0h0").troops = 50;
      heroOf(state, "s0h1").troops = 20;
      return state;
    };
    // 혼자면 공격력 50 × 1.12 = 56 < 방어력 50 × 1.2 = 60 → 방어
    let state = setUp();
    let missions = new Map<string, Mission>([["s0h0", ratioBelow(3)]]);
    resolveConditions(state, missions, []);
    expect(missions.get("s0h0")).toEqual({ kind: "defend", hero: "s0h0" });
    // s0h1이 함께 치면 70 × 1.12 = 78.4 ≥ 60 → 그대로
    state = setUp();
    missions = new Map<string, Mission>([
      ["s0h0", ratioBelow(3)],
      ["s0h1", { kind: "attack", hero: "s0h1", target: "f0" }],
    ]);
    resolveConditions(state, missions, []);
    expect(missions.get("s0h0")).toEqual(ratioBelow(3));
    // 기준 1(0.8)이면 혼자서도 56 ≥ 40 → 그대로
    state = setUp();
    missions = new Map<string, Mission>([["s0h0", ratioBelow(1)]]);
    resolveConditions(state, missions, []);
    expect(missions.get("s0h0")).toEqual(ratioBelow(1));
  });

  it("아군 거점 피습 → 증원: 그 거점을 치는 다른 자리 임무가 있으면 옮겨 지킨다", () => {
    for (const [enemy, reinforces] of [
      [{ kind: "attack", hero: "s5h0", target: "f0" }, true],
      [{ kind: "defend", hero: "s5h0" }, false],
    ] as const) {
      const state = makeState();
      state.nodes.f0.owner = 0;
      state.nodes.x5.owner = 5;
      Object.assign(heroOf(state, "s5h0"), { location: "x5", troops: 30 });
      const missions = new Map<string, Mission>([
        [
          "s0h0",
          {
            kind: "govern",
            hero: "s0h0",
            when: { trigger: { kind: "allyAttacked", node: "f0" }, react: { kind: "reinforce", node: "f0" } },
          },
        ],
        ["s5h0", enemy],
      ]);
      resolveConditions(state, missions, []);
      expect(heroOf(state, "s0h0").location).toBe(reinforces ? "f0" : "c0");
      expect(missions.get("s0h0")?.kind).toBe(reinforces ? "defend" : "govern");
    }
  });

  it("조건은 한 스냅숏에서 모두 판정하고 반응을 한꺼번에 적용해, 영웅 처리 순서와 결과가 무관하다", () => {
    for (const reversed of [false, true]) {
      const state = makeState();
      Object.assign(state.nodes.f0, { owner: 5, garrison: 0 });
      state.nodes.x5.owner = 5;
      Object.assign(heroOf(state, "s5h0"), { location: "x5", troops: 30 });
      heroOf(state, "s0h0").troops = 30;
      heroOf(state, "s0h1").troops = 30;
      if (reversed) state.heroes.reverse();
      const missions = new Map<string, Mission>([
        defendWhen("s0h0", { trigger: { kind: "targetEmpty", node: "f0" }, react: { kind: "advance", node: "f0" } }),
        ["s0h1", { kind: "attack", hero: "s0h1", target: "f0" }],
        defendWhen("s5h0", { trigger: { kind: "allyAttacked", node: "f0" }, react: { kind: "reinforce", node: "f0" } }),
      ]);
      resolveConditions(state, missions, []);
      // s5h0이 f0에 들어가도, s0h0의 "빔"은 반응 전 스냅숏으로 판정한다
      expect(missions.get("s0h0")).toEqual({ kind: "attack", hero: "s0h0", target: "f0", draw: 0 });
      expect(heroOf(state, "s5h0").location).toBe("f0");
      expect(missions.get("s5h0")).toEqual({ kind: "defend", hero: "s5h0" });
    }
  });
});

describe("processTurn의 조건 판정·반응 단계", () => {
  it("이동 뒤·전투 앞에 판정한다(이동해 온 거점에서 적 접근을 보고 후퇴)", () => {
    const state = makeState();
    state.nodes.f0.owner = 0;
    state.nodes.f0.garrison = 0;
    state.nodes.x5.owner = 5;
    Object.assign(heroOf(state, "s5h0"), { location: "x5", troops: 30 });
    const orders = noOrders();
    orders[0].missions.push({
      kind: "move",
      hero: "s0h0",
      to: "f0",
      when: { trigger: { kind: "enemyNear" }, react: { kind: "retreat" } },
    });
    const { state: next, events } = processTurn(state, orders);
    expect(events.filter((e) => e.kind === "moved" || e.kind === "conditionMet")).toEqual([
      { kind: "moved", seat: 0, hero: "s0h0", from: "c0", to: "f0" },
      { kind: "conditionMet", seat: 0, hero: "s0h0", trigger: "enemyNear", react: "retreat" },
      { kind: "moved", seat: 0, hero: "s0h0", from: "f0", to: "c0" },
    ]);
    expect(heroOf(next, "s0h0").location).toBe("c0");
  });
});
