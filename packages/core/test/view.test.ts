import { describe, expect, it } from "vitest";
import { defensePower } from "../src/rules/power";
import type { HeroStatus } from "../src/types";
import { boardOf, viewOf, visibleNodes } from "../src/view";
import { heroOf, makeState } from "./helpers";

const sorted = (set: Set<string>): string[] => [...set].sort();

describe("visibleNodes", () => {
  it("시작 상태에서는 수도와 그 1칸 이웃만 보인다(3성 기동 14)", () => {
    expect(sorted(visibleNodes(makeState(), 0))).toEqual(["c0", "f0", "m0"]);
  });

  it("아군 거점마다 1칸 이웃이 보인다", () => {
    const state = makeState();
    state.nodes.i0.owner = 0;
    expect(sorted(visibleNodes(state, 0))).toEqual(["c0", "f0", "i0", "i1", "i5", "m0", "x0"]);
  });

  it("기동 15 이상인 활동 영웅은 서 있는 거점에서 2칸까지 본다", () => {
    const state = makeState();
    heroOf(state, "s0h0").stats.mobility = 15;
    expect(sorted(visibleNodes(state, 0))).toEqual(["c0", "f0", "m0", "x0", "x5"]);
  });

  it.each<[HeroStatus]>([["injured"], ["captured"]])("%s 영웅은 시야를 주지 않는다", (status) => {
    const state = makeState();
    const hero = heroOf(state, "s0h0");
    hero.status = status;
    hero.stats.mobility = 20;
    expect(sorted(visibleNodes(state, 0))).toEqual(["c0", "f0", "m0"]);
  });

  it("첩보망 레벨 L인 아군 거점은 1 + L칸까지 본다", () => {
    const state = makeState();
    state.nodes.c0.buildings.intel = 1;
    expect(sorted(visibleNodes(state, 0))).toEqual(["c0", "f0", "m0", "x0", "x5"]);
    state.nodes.c0.buildings.intel = 2;
    expect(sorted(visibleNodes(state, 0))).toEqual(["c0", "f0", "f1", "i0", "i5", "m0", "m5", "x0", "x5"]);
  });
});

describe("viewOf", () => {
  it("시작 상태: 보이는 거점, 내 영웅(성장 계수 없음), 내 금고·수도·세팅·메모, 공개 순위", () => {
    const state = makeState();
    const view = viewOf(state, 0);
    expect(Object.keys(view.nodes)).toEqual(["c0", "f0", "m0"]);
    expect(view.nodes.f0).toEqual(state.nodes.f0);
    expect(view.myHeroes.map((h) => h.id)).toEqual(["s0h0", "s0h1", "s0h2", "s0h3", "s0h4"]);
    expect(view.myHeroes[0]).not.toHaveProperty("growth");
    expect(view.myHeroes[0].traits).toEqual({ loyalty: 3, caution: 3, valor: 3 });
    expect(view.foreignHeroes).toEqual([]);
    expect(view).toMatchObject({ seat: 0, turn: 0, maxTurns: 120, capital: "c0", memo: "" });
    expect(view.treasury).toEqual(state.seats[0].treasury);
    expect(view.settings.preset).toBe("balanced");
    expect(view.seats[3]).toEqual({ id: 3, name: "Seat3", nodes: 1, score: 16, eliminated: false });
    expect(view.map.nodes).toHaveLength(30);
  });

  it("보이는 거점의 남의 영웅은 특성·경험치·성장 계수·상시 명령 없이, 안 보이는 거점의 영웅은 보이지 않는다", () => {
    const state = makeState();
    state.nodes.f0.owner = 1;
    Object.assign(heroOf(state, "s1h0"), { location: "f0", troops: 40 });
    const view = viewOf(state, 0);
    expect(view.foreignHeroes.map((h) => h.id)).toEqual(["s1h0"]);
    const seen = view.foreignHeroes[0];
    expect(seen).toMatchObject({ seat: 1, location: "f0", troops: 40, level: 1, grade: 3 });
    for (const key of ["growth", "traits", "exp", "standing"]) expect(seen).not.toHaveProperty(key);
  });

  it("내가 잡은 포로는 어디 있든 보이고, 남이 잡은 포로는 보이는 거점에 있어도 보이지 않는다", () => {
    const state = makeState();
    Object.assign(heroOf(state, "s2h0"), { status: "captured", captor: 0, location: "c2" });
    Object.assign(heroOf(state, "s3h0"), { status: "captured", captor: 1, location: "f0" });
    expect(viewOf(state, 0).foreignHeroes.map((h) => h.id)).toEqual(["s2h0"]);
  });

  it("시야는 복사본이라 고쳐도 상태가 바뀌지 않는다", () => {
    const state = makeState();
    const view = viewOf(state, 0);
    view.nodes.c0.garrison = 0;
    view.myHeroes[0].troops = 99;
    expect(state.nodes.c0.garrison).toBe(60);
    expect(heroOf(state, "s0h0").troops).toBe(0);
  });

  it("boardOf로 계산한 보이는 거점의 방어력은 상태로 계산한 값과 같다", () => {
    const state = makeState();
    state.nodes.f0.owner = 1;
    state.nodes.f0.buildings.walls = 2;
    const hero = heroOf(state, "s1h0");
    Object.assign(hero, { location: "f0", troops: 40 });
    hero.stats.might = 20;
    expect(defensePower(boardOf(viewOf(state, 0)), "f0")).toBe(defensePower(state, "f0"));
  });
});
