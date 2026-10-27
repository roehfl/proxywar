import { describe, expect, it } from "vitest";
import { createRng } from "../src/rng";
import { injuryPercent, recoverHeroes, releasePrisoners, rollInjury, routHero } from "../src/rules/heroes";
import type { GameEvent } from "../src/types";
import { heroOf, makeState } from "./helpers";

describe("heroes", () => {
  it("부상 확률은 30%에 용맹 1점당 10%p를 더한다", () => {
    const hero = heroOf(makeState(), "s0h0");
    const percents = [1, 3, 5].map((valor) => {
      hero.traits.valor = valor;
      return injuryPercent(hero);
    });
    expect(percents).toEqual([10, 30, 50]);
  });

  it("부상하면 병력을 서 있는 거점에 맡기고 3턴 뒤까지 빠진다(일부 시드에서만)", () => {
    let injured = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const state = makeState();
      const hero = heroOf(state, "s0h0");
      hero.troops = 10;
      const events: GameEvent[] = [];
      rollInjury(state, hero, createRng(seed, "test"), events);
      if (hero.status === "injured") {
        injured += 1;
        expect(hero).toMatchObject({ troops: 0, injuredUntil: 3 });
        expect(state.nodes.c0.garrison).toBe(70);
        expect(events).toEqual([{ kind: "heroInjured", seat: 0, hero: "s0h0", until: 3 }]);
      } else {
        expect(hero).toMatchObject({ status: "active", troops: 10 });
        expect(events).toEqual([]);
      }
    }
    expect(injured).toBeGreaterThan(0);
    expect(injured).toBeLessThan(40);
  });

  it("후퇴할 아군 거점이 있으면 병력 40%를 데리고 물러나고 지킨 병력을 돌려준다", () => {
    const state = makeState();
    state.nodes.f0.owner = 0;
    Object.assign(heroOf(state, "s0h0"), { location: "f0", troops: 10 });
    const events: GameEvent[] = [];
    expect(routHero(state, heroOf(state, "s0h0"), 5, createRng(1, "test"), events)).toBe(4);
    expect(heroOf(state, "s0h0").location).toBe("c0");
    expect(events[0]).toEqual({ kind: "heroRouted", seat: 0, hero: "s0h0", to: "c0", troops: 4 });
  });

  it("후퇴할 곳이 없으면 점령한 자리의 포로가 된다", () => {
    const state = makeState();
    state.nodes.x5.owner = 0;
    Object.assign(heroOf(state, "s0h0"), { location: "x5", troops: 10 });
    const events: GameEvent[] = [];
    expect(routHero(state, heroOf(state, "s0h0"), 5, createRng(1, "test"), events)).toBe(0);
    expect(heroOf(state, "s0h0")).toMatchObject({ status: "captured", captor: 5, troops: 0 });
    expect(events).toEqual([{ kind: "heroCaptured", seat: 0, hero: "s0h0", by: 5 }]);
  });

  it("부상한 영웅은 injuredUntil 턴의 처리 끝에 회복한다", () => {
    const state = makeState();
    Object.assign(heroOf(state, "s0h0"), { status: "injured", injuredUntil: 3 });
    state.turn = 2;
    recoverHeroes(state, []);
    expect(heroOf(state, "s0h0").status).toBe("injured");
    state.turn = 3;
    const events: GameEvent[] = [];
    recoverHeroes(state, events);
    expect(heroOf(state, "s0h0")).toMatchObject({ status: "active", injuredUntil: null });
    expect(events).toEqual([{ kind: "heroRecovered", seat: 0, hero: "s0h0" }]);
  });

  it("잡고 있던 자리의 포로를 풀면 각자 현재 수도로 돌아가고, 수도가 없으면 out이 된다", () => {
    const state = makeState();
    Object.assign(heroOf(state, "s1h0"), { status: "captured", captor: 0, location: "x0" });
    Object.assign(heroOf(state, "s2h0"), { status: "captured", captor: 0 });
    Object.assign(heroOf(state, "s3h0"), { status: "captured", captor: 4 });
    state.seats[2].capital = null;
    const events: GameEvent[] = [];
    releasePrisoners(state, 0, events);
    expect(heroOf(state, "s1h0")).toMatchObject({ status: "active", captor: null, location: "c1", troops: 0 });
    expect(heroOf(state, "s2h0")).toMatchObject({ status: "out", captor: null });
    expect(heroOf(state, "s3h0")).toMatchObject({ status: "captured", captor: 4 });
    expect(events).toEqual([
      { kind: "heroReleased", seat: 1, hero: "s1h0", to: "c1" },
      { kind: "heroReleased", seat: 2, hero: "s2h0", to: null },
    ]);
  });
});
