import { describe, expect, it } from "vitest";
import { terrainOf } from "../src/data/balance";
import { attackModifier, defensePower, heroModifier, troopCap } from "../src/rules/power";
import { heroOf, makeState } from "./helpers";

describe("power", () => {
  it("3성 영웅은 배수 1.12, 병력 상한 140이다", () => {
    const hero = heroOf(makeState(), "s0h0");
    expect(heroModifier(hero)).toBeCloseTo(1.12);
    expect(troopCap(hero)).toBe(140);
    expect(heroModifier(undefined)).toBe(1);
  });

  it("중립 요새 방어력은 수비대 × 1.5다", () => {
    expect(defensePower(makeState(), "x0")).toBeCloseTo(90);
  });

  it("수도 방어력은 수비대와 영웅 병력 합 × 최고 영웅 배수 × 1.3이고, 제외한 영웅은 빠진다", () => {
    const state = makeState();
    heroOf(state, "s0h0").troops = 40;
    expect(defensePower(state, "c0")).toBeCloseTo(100 * 1.12 * 1.3);
    expect(defensePower(state, "c0", new Set(["s0h0"]))).toBeCloseTo(60 * 1.12 * 1.3);
  });

  it("용맹은 공격 배수에만 점당 0.03을 더한다", () => {
    const hero = heroOf(makeState(), "s0h0");
    hero.traits.valor = 5;
    expect(attackModifier(hero)).toBeCloseTo(1.18);
    expect(heroModifier(hero)).toBeCloseTo(1.12);
    hero.traits.valor = 1;
    expect(attackModifier(hero)).toBeCloseTo(1.06);
    expect(attackModifier(undefined)).toBe(1);
  });

  it("통솔이 소수면 병력 상한을 내림한다", () => {
    const hero = heroOf(makeState(), "s0h0");
    hero.stats.command = 14.79;
    expect(troopCap(hero)).toBe(147);
  });

  it("성벽은 레벨당 지형 배수에 0.1을 더하고 방어력에 들어간다", () => {
    const state = makeState();
    state.nodes.c0.buildings.walls = 2;
    expect(terrainOf(state, "c0")).toBeCloseTo(1.5);
    expect(defensePower(state, "c0")).toBeCloseTo(60 * 1.12 * 1.5);
  });
});
