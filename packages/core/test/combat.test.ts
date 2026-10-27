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
    expect(state.nodes.f0).toEqual({ id: "f0", owner: 0, garrison: 0, buildings: { production: 0, barracks: 0, walls: 0 } });
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
    const hero = heroOf(state, "s0h0");
    expect(hero.location).toBe("c0");
    // 남은 4명은 영웅에게 있거나, 부상했으면 수도 수비대로 들어갔다
    expect(hero.troops + state.nodes.c0.garrison).toBe(64);
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
    expect(heroOf(state, "s0h0").location).toBe("c0");
    expect(events).toContainEqual({ kind: "heroRouted", seat: 0, hero: "s0h0", to: "c0", troops: 4 });
    expect(events[0]).toMatchObject({ kind: "battle", defendTroops: 10, defenderLoss: 6 });
  });

  it("후퇴하다 부상한 방어 영웅이 데리고 간 병력도 방어 손실에서 뺀다", () => {
    let injured = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const state = makeState();
      state.nodes.f0.owner = 0;
      state.nodes.f0.garrison = 0;
      Object.assign(heroOf(state, "s0h0"), { location: "f0", troops: 10 });
      state.nodes.x5.owner = 5;
      Object.assign(heroOf(state, "s5h0"), { location: "x5", troops: 200 });
      const events: GameEvent[] = [];
      resolveCombat(state, new Map([attack("s5h0", "f0")]), createRng(seed, "test"), events);
      expect(events[0]).toMatchObject({ kind: "battle", defendTroops: 10, defenderLoss: 6 });
      if (heroOf(state, "s0h0").status === "injured") {
        injured += 1;
        // 지킨 4명은 부상과 함께 피난처 수비대(60)로 들어갔다
        expect(state.nodes.c0.garrison).toBe(64);
      }
    }
    expect(injured).toBeGreaterThan(0);
    expect(injured).toBeLessThan(40);
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

  it("후퇴할 아군 거점이 없으면 영웅은 점령한 자리의 포로가 된다", () => {
    const state = makeState();
    state.nodes.x5.owner = 0;
    state.nodes.x5.garrison = 0;
    Object.assign(heroOf(state, "s0h0"), { location: "x5", troops: 10 });
    state.nodes.m5.owner = 5;
    Object.assign(heroOf(state, "s5h0"), { location: "m5", troops: 200 });
    const events = run(state, attack("s5h0", "x5"));
    expect(state.nodes.x5.owner).toBe(5);
    expect(heroOf(state, "s0h0")).toMatchObject({ status: "captured", captor: 5, troops: 0 });
    expect(events).toContainEqual({ kind: "heroCaptured", seat: 0, hero: "s0h0", by: 5 });
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

  it("전투에 나선 영웅은 경험치 10을 얻고 이긴 쪽은 10을 더 얻는다", () => {
    const state = makeState();
    state.nodes.f0.owner = 0;
    state.nodes.f0.garrison = 0;
    Object.assign(heroOf(state, "s0h1"), { location: "f0", troops: 100 });
    state.nodes.x5.owner = 5;
    Object.assign(heroOf(state, "s5h0"), { location: "x5", troops: 10 });
    run(state, attack("s5h0", "f0"));
    expect(state.nodes.f0.owner).toBe(0);
    expect(heroOf(state, "s0h1").exp).toBe(20);
    expect(heroOf(state, "s5h0").exp).toBe(10);
  });

  it("공격에서 진 영웅은 일부 시드에서 부상해 남은 병력을 출발 거점에 맡긴다", () => {
    let injured = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const state = makeState();
      heroOf(state, "s0h0").troops = 10;
      state.nodes.f0.garrison = 100;
      const events: GameEvent[] = [];
      resolveCombat(state, new Map([attack("s0h0", "f0")]), createRng(seed, "test"), events);
      const hero = heroOf(state, "s0h0");
      if (hero.status === "injured") {
        injured += 1;
        expect(hero).toMatchObject({ troops: 0, injuredUntil: 3 });
        expect(state.nodes.c0.garrison).toBe(64);
        expect(events.at(-1)).toEqual({ kind: "heroInjured", seat: 0, hero: "s0h0", until: 3 });
      } else {
        expect(hero.troops).toBe(4);
      }
    }
    expect(injured).toBeGreaterThan(0);
    expect(injured).toBeLessThan(40);
  });

  it("운영 중인 영웅은 서 있는 거점 방어에 끼지 않는다", () => {
    const state = makeState();
    state.nodes.f0.owner = 0;
    state.nodes.f0.garrison = 0;
    Object.assign(heroOf(state, "s0h0"), { location: "f0", troops: 100 });
    state.nodes.x5.owner = 5;
    Object.assign(heroOf(state, "s5h0"), { location: "x5", troops: 10 });
    const events = run(state, ["s0h0", { kind: "govern", hero: "s0h0" }], attack("s5h0", "f0"));
    expect(events[0]).toMatchObject({ kind: "battle", defendTroops: 0, winner: "attacker" });
    expect(state.nodes.f0.owner).toBe(5);
    expect(heroOf(state, "s0h0").location).toBe("c0");
  });

  it("신중 5 영웅은 공격력이 방어력 × 1.2에 못 미치면 물러나고, 신중 3은 그대로 싸운다", () => {
    for (const [caution, hesitates] of [
      [5, true],
      [3, false],
    ] as const) {
      const state = makeState();
      const hero = heroOf(state, "s0h0");
      hero.troops = 50;
      hero.traits.caution = caution;
      state.nodes.f0.garrison = 50;
      // 공격력 50 × 1.12 = 56, 방어력 50 × 1.0 = 50
      const events = run(state, attack("s0h0", "f0"));
      if (hesitates) {
        expect(events).toEqual([{ kind: "hesitated", seat: 0, hero: "s0h0", node: "f0" }]);
        expect(heroOf(state, "s0h0")).toMatchObject({ location: "c0", troops: 50 });
      } else {
        expect(events[0]?.kind).toBe("battle");
      }
    }
  });

  it("신중해 물러난 영웅은 같은 전투 단계의 뒤 공격에서 제 거점 방어에 다시 낀다", () => {
    let hesitatedFirst = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const state = makeState();
      const hero = heroOf(state, "s0h0");
      Object.assign(hero, { troops: 50 });
      hero.traits.caution = 5;
      state.nodes.f0.garrison = 50;
      state.nodes.m0.owner = 5;
      state.nodes.m0.garrison = 0;
      Object.assign(heroOf(state, "s5h0"), { location: "m0", troops: 90 });
      const events: GameEvent[] = [];
      resolveCombat(state, new Map([attack("s0h0", "f0"), attack("s5h0", "c0")]), createRng(seed, "test"), events);
      const hesitatedAt = events.findIndex((e) => e.kind === "hesitated");
      const battleAt = events.findIndex((e) => e.kind === "battle" && e.node === "c0");
      expect(battleAt).toBeGreaterThanOrEqual(0);
      const battle = events[battleAt];
      if (hesitatedAt >= 0 && hesitatedAt < battleAt) {
        hesitatedFirst += 1;
        // 물러난 영웅의 50명이 수비대 60에 더해져 항상 막아낸다
        expect(battle).toMatchObject({ defendTroops: 110, winner: "defender" });
        expect(state.nodes.c0.owner).toBe(0);
      } else {
        // 공격이 먼저 정산되면 영웅은 아직 공격에 나선 상태라 수비대 60만 맞선다
        expect(battle).toMatchObject({ defendTroops: 60 });
      }
    }
    expect(hesitatedFirst).toBeGreaterThan(0);
  });

  it("점령된 거점의 건물은 종류마다 한 레벨씩 내려간다", () => {
    const state = makeState();
    state.nodes.f0.owner = 0;
    state.nodes.f0.garrison = 0;
    state.nodes.f0.buildings = { production: 2, barracks: 0, walls: 1 };
    state.nodes.x5.owner = 5;
    Object.assign(heroOf(state, "s5h0"), { location: "x5", troops: 100 });
    run(state, attack("s5h0", "f0"));
    expect(state.nodes.f0).toMatchObject({ owner: 5, buildings: { production: 1, barracks: 0, walls: 0 } });
  });
});
