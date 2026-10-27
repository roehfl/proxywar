import { describe, expect, it } from "vitest";
import { createRng } from "../src/rng";
import { resolveCombat } from "../src/rules/combat";
import type { GameEvent, Mission } from "../src/types";
import { heroOf, makeState } from "./helpers";

function attack(hero: string, target: string): [string, Mission] {
  return [hero, { kind: "attack", hero, target }];
}

function run(state: ReturnType<typeof makeState>, ...missions: [string, Mission][]): GameEvent[] {
  const events: GameEvent[] = [];
  resolveCombat(state, new Map(missions), createRng(1, "test"), events);
  return events;
}

describe("resolveCombat", () => {
  it("약한 중립 거점을 점령하고 영웅이 들어가며 손실은 힘의 비율을 따른다", () => {
    const state = makeState();
    heroOf(state, "s0h0").troops = 100;
    const events = run(state, attack("s0h0", "f0"));
    expect(state.nodes.f0).toEqual({ id: "f0", owner: 0, garrison: 0 });
    const hero = heroOf(state, "s0h0");
    expect(hero.location).toBe("f0");
    expect(hero.troops).toBeGreaterThanOrEqual(86);
    expect(hero.troops).toBeLessThanOrEqual(91);
    expect(events.map((e) => e.kind)).toEqual(["battle", "captured"]);
    expect(events[1]).toEqual({ kind: "captured", node: "f0", from: null, to: 0 });
  });

  it("공격이 지면 공격 병력 60%를 잃고 제자리에 남는다", () => {
    const state = makeState();
    heroOf(state, "s0h0").troops = 10;
    state.nodes.f0.garrison = 100;
    const events = run(state, attack("s0h0", "f0"));
    expect(heroOf(state, "s0h0")).toMatchObject({ location: "c0", troops: 4 });
    expect(state.nodes.f0.owner).toBeNull();
    expect(state.nodes.f0.garrison).toBeGreaterThanOrEqual(91);
    expect(state.nodes.f0.garrison).toBeLessThanOrEqual(94);
    expect(events[0]).toMatchObject({ kind: "battle", winner: "defender", attackerLoss: 6 });
  });

  it("같은 자리가 같은 목표를 공격하면 한 부대로 싸운다", () => {
    const state = makeState();
    heroOf(state, "s0h0").troops = 30;
    heroOf(state, "s0h1").troops = 30;
    state.nodes.f0.garrison = 50;
    const events = run(state, attack("s0h0", "f0"), attack("s0h1", "f0"));
    expect(state.nodes.f0.owner).toBe(0);
    expect(heroOf(state, "s0h1").location).toBe("f0");
    const battles = events.filter((e) => e.kind === "battle");
    expect(battles).toHaveLength(1);
    expect(battles[0]).toMatchObject({ heroes: ["s0h0", "s0h1"], attackTroops: 60 });
  });

  it("점령된 거점의 방어 영웅은 인접 아군 거점으로 병력 40%를 데리고 후퇴한다", () => {
    const state = makeState();
    state.nodes.f0.owner = 0;
    state.nodes.f0.garrison = 0;
    Object.assign(heroOf(state, "s0h0"), { location: "f0", troops: 10 });
    state.nodes.x5.owner = 5;
    Object.assign(heroOf(state, "s5h0"), { location: "x5", troops: 200 });
    const events = run(state, attack("s5h0", "f0"));
    expect(state.nodes.f0.owner).toBe(5);
    expect(heroOf(state, "s0h0")).toMatchObject({ location: "c0", troops: 4, status: "active" });
    expect(events).toContainEqual({ kind: "heroRouted", seat: 0, hero: "s0h0", to: "c0", troops: 4 });
    expect(events[0]).toMatchObject({ kind: "battle", defendTroops: 10, defenderLoss: 6 });
  });

  it("같은 턴에 방금 점령한 거점은 점령한 영웅이 지킨다(정산 순서와 무관)", () => {
    for (let seed = 1; seed <= 8; seed++) {
      const state = makeState();
      state.nodes.m0.owner = 0;
      Object.assign(heroOf(state, "s0h0"), { location: "m0", troops: 140 });
      state.nodes.f1.owner = 1;
      Object.assign(heroOf(state, "s1h0"), { location: "f1", troops: 1 });
      const events: GameEvent[] = [];
      resolveCombat(state, new Map([attack("s0h0", "x0"), attack("s1h0", "x0")]), createRng(seed, "test"), events);
      expect(state.nodes.x0.owner).toBe(0);
      expect(heroOf(state, "s0h0")).toMatchObject({ location: "x0", status: "active" });
      expect(events.some((e) => e.kind === "heroRouted")).toBe(false);
    }
  });

  it("후퇴할 아군 거점이 없으면 영웅은 out이 된다", () => {
    const state = makeState();
    state.nodes.x5.owner = 0;
    state.nodes.x5.garrison = 0;
    Object.assign(heroOf(state, "s0h0"), { location: "x5", troops: 10 });
    state.nodes.m5.owner = 5;
    Object.assign(heroOf(state, "s5h0"), { location: "m5", troops: 200 });
    run(state, attack("s5h0", "x5"));
    expect(state.nodes.x5.owner).toBe(5);
    expect(heroOf(state, "s0h0")).toMatchObject({ status: "out", troops: 0 });
  });

  it("수도가 함락되면 자원 30%를 잃고 수비대가 가장 많은 아군 거점으로 수도를 옮긴다", () => {
    const state = makeState();
    state.nodes.f0.owner = 0;
    state.nodes.f0.garrison = 30;
    state.nodes.m0.owner = 5;
    state.nodes.m0.garrison = 0;
    Object.assign(heroOf(state, "s5h0"), { location: "m0", troops: 500 });
    const events = run(state, attack("s5h0", "c0"));
    expect(state.nodes.c0.owner).toBe(5);
    expect(state.seats[0].capital).toBe("f0");
    expect(state.seats[0].treasury).toEqual({ gold: 35, food: 35, material: 14, rare: 0 });
    expect(events).toContainEqual({
      kind: "capitalMoved",
      seat: 0,
      from: "c0",
      to: "f0",
      lost: { gold: 15, food: 15, material: 6, rare: 0 },
    });
    expect(heroOf(state, "s0h3").location).toBe("f0");
  });
});
