import { describe, expect, it } from "vitest";
import { createRng } from "../src/rng";
import { applyLoyalty, cautionRatio, hesitationOf } from "../src/rules/traits";
import type { GameEvent, Mission } from "../src/types";
import { heroOf, makeState } from "./helpers";

describe("applyLoyalty", () => {
  it("충성 1 영웅은 일부 시드에서 임무 대신 제자리를 지키고 그 사실을 남긴다", () => {
    let disobeyed = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const state = makeState();
      heroOf(state, "s0h0").traits.loyalty = 1;
      const missions = new Map<string, Mission>([["s0h0", { kind: "attack", hero: "s0h0", target: "f0" }]]);
      const events: GameEvent[] = [];
      applyLoyalty(state, missions, createRng(seed, "test"), events);
      if (events.length > 0) {
        disobeyed += 1;
        expect(missions.get("s0h0")).toEqual({ kind: "defend", hero: "s0h0" });
        expect(events).toEqual([{ kind: "disobeyed", seat: 0, hero: "s0h0", mission: "attack" }]);
      } else {
        expect(missions.get("s0h0")?.kind).toBe("attack");
      }
    }
    expect(disobeyed).toBeGreaterThan(0);
    expect(disobeyed).toBeLessThan(40);
  });

  it("충성 3 이상 영웅과 방어 임무는 바뀌지 않는다", () => {
    const state = makeState();
    heroOf(state, "s0h1").traits.loyalty = 1;
    heroOf(state, "s0h2").traits.loyalty = 5;
    for (let seed = 1; seed <= 20; seed++) {
      const missions = new Map<string, Mission>([
        ["s0h0", { kind: "govern", hero: "s0h0" }],
        ["s0h1", { kind: "defend", hero: "s0h1" }],
        ["s0h2", { kind: "attack", hero: "s0h2", target: "f0" }],
      ]);
      const events: GameEvent[] = [];
      applyLoyalty(state, missions, createRng(seed, "test"), events);
      expect(events).toEqual([]);
    }
  });
});

describe("cautionRatio", () => {
  it("신중 4는 1.0, 5는 1.2이고 1~3은 물러나지 않는다(0)", () => {
    const hero = heroOf(makeState(), "s0h0");
    const ratios = [1, 2, 3, 4, 5].map((caution) => {
      hero.traits.caution = caution;
      return cautionRatio(hero);
    });
    expect(ratios).toEqual([0, 0, 0, 1, 1.2]);
  });
});

describe("hesitationOf", () => {
  it("신중 기준과 후퇴 기준 중 큰 값을 쓰고, 후퇴 기준이 더 크면 이유는 standing이다", () => {
    const hero = heroOf(makeState(), "s0h0");
    expect(hesitationOf(hero)).toEqual({ ratio: 0, reason: "caution" });
    hero.standing.retreatAt = 4;
    expect(hesitationOf(hero)).toEqual({ ratio: 1.2, reason: "standing" });
    hero.traits.caution = 5;
    expect(hesitationOf(hero)).toEqual({ ratio: 1.2, reason: "caution" });
    hero.standing.retreatAt = 5;
    expect(hesitationOf(hero)).toEqual({ ratio: 1.4, reason: "standing" });
  });
});
