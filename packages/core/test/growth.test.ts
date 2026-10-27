import { describe, expect, it } from "vitest";
import { createRng } from "../src/rng";
import { gainExp, resolveGrowth } from "../src/rules/growth";
import type { GameEvent } from "../src/types";
import { heroOf, makeState } from "./helpers";

const STATS = ["might", "command", "admin", "mobility"] as const;

describe("growth", () => {
  it("경험치가 20 × 레벨만큼 차면 레벨이 오르고 능력치 4종이 0.7 × 0.5~1.5씩 오른다(3성, 성장 계수 1)", () => {
    const state = makeState();
    const hero = heroOf(state, "s0h0");
    gainExp(hero, 25);
    const events: GameEvent[] = [];
    resolveGrowth(state, createRng(1, "test"), events);
    expect(hero).toMatchObject({ level: 2, exp: 5 });
    for (const stat of STATS) {
      expect(hero.stats[stat]).toBeGreaterThanOrEqual(14 + 0.35);
      expect(hero.stats[stat]).toBeLessThan(14 + 1.05);
    }
    expect(events).toEqual([{ kind: "levelUp", seat: 0, hero: "s0h0", level: 2, stats: hero.stats }]);
  });

  it("숨은 성장 계수가 2면 상승폭 범위도 두 배다", () => {
    const state = makeState();
    const hero = heroOf(state, "s0h0");
    hero.growth = 2;
    gainExp(hero, 20);
    resolveGrowth(state, createRng(1, "test"), []);
    for (const stat of STATS) {
      expect(hero.stats[stat]).toBeGreaterThanOrEqual(14 + 0.7);
      expect(hero.stats[stat]).toBeLessThan(14 + 2.1);
    }
  });

  it("경험치가 넉넉하면 한 번에 여러 레벨이 오른다", () => {
    const state = makeState();
    const hero = heroOf(state, "s0h0");
    gainExp(hero, 20 + 40 + 10);
    const events: GameEvent[] = [];
    resolveGrowth(state, createRng(1, "test"), events);
    expect(hero).toMatchObject({ level: 3, exp: 10 });
    expect(events.map((e) => e.kind)).toEqual(["levelUp", "levelUp"]);
  });

  it("레벨 상한(1성 10)에 닿으면 경험치를 버리고 더 쌓지 않는다", () => {
    const state = makeState();
    const hero = heroOf(state, "s0h0");
    Object.assign(hero, { grade: 1, level: 9, exp: 0 });
    gainExp(hero, 9 * 20 + 15);
    resolveGrowth(state, createRng(1, "test"), []);
    expect(hero).toMatchObject({ level: 10, exp: 0 });
    gainExp(hero, 50);
    expect(hero.exp).toBe(0);
  });
});
