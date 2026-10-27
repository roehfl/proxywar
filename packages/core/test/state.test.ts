import { describe, expect, it } from "vitest";
import { MatchSetupSchema } from "../src/setup";
import { initState } from "../src/state";
import { scoreOf } from "../src/summary";
import { heroOf, makeSetup, makeState } from "./helpers";

const NO_BUILDINGS = { production: 0, barracks: 0, walls: 0 };

describe("MatchSetupSchema", () => {
  it("올바른 설정을 받아들이고 성장 계수·특성 기본값을 채운다", () => {
    const raw = JSON.parse(JSON.stringify(makeSetup()));
    delete raw.seats[0].heroes[0].growth;
    delete raw.seats[0].heroes[0].traits;
    const parsed = MatchSetupSchema.parse(raw);
    expect(parsed.seats[0].heroes[0].growth).toBe(1);
    expect(parsed.seats[0].heroes[0].traits).toEqual({});
  });

  it("자리가 6개가 아니면 거부한다", () => {
    const raw = makeSetup();
    expect(() => MatchSetupSchema.parse({ ...raw, seats: raw.seats.slice(0, 5) })).toThrow();
  });

  it.each<[string, number, object]>([
    ["1성에 특성 2개", 1, { loyalty: 2, valor: 4 }],
    ["3성에 특성 3개", 3, { loyalty: 2, caution: 4, valor: 4 }],
    ["범위 밖 값", 5, { valor: 6 }],
    ["모르는 특성", 5, { greed: 3 }],
  ])("특성 설정 오류를 거부한다: %s", (_, grade, traits) => {
    const raw = JSON.parse(JSON.stringify(makeSetup()));
    Object.assign(raw.seats[0].heroes[0], { grade, traits });
    expect(() => MatchSetupSchema.parse(raw)).toThrow();
  });

  it("등급 슬롯 수만큼 특성을 받는다(5성 3개)", () => {
    const raw = JSON.parse(JSON.stringify(makeSetup()));
    Object.assign(raw.seats[0].heroes[0], { grade: 5, traits: { loyalty: 1, caution: 5, valor: 2 } });
    expect(MatchSetupSchema.parse(raw).seats[0].heroes[0].traits).toEqual({ loyalty: 1, caution: 5, valor: 2 });
  });
});

describe("initState", () => {
  const state = makeState();

  it("자리마다 시작 수도를 갖는다", () => {
    for (let i = 0; i < 6; i++) {
      expect(state.seats[i].capital).toBe(`c${i}`);
      expect(state.nodes[`c${i}`]).toEqual({ id: `c${i}`, owner: i, garrison: 60, buildings: NO_BUILDINGS });
    }
  });

  it("수도가 아닌 거점은 타입별 중립 수비대를 갖고 건물이 없다", () => {
    expect(state.nodes.x0).toEqual({ id: "x0", owner: null, garrison: 60, buildings: NO_BUILDINGS });
    expect(state.nodes.f0.garrison).toBe(20);
    expect(state.nodes.i0.garrison).toBe(40);
    expect(state.nodes.i1.garrison).toBe(40);
  });

  it("영웅 30명이 수도에서 병력 0, 레벨 1, 경험치 0, 특성 3으로 시작하고 능력치는 등급 기준값이다", () => {
    expect(state.heroes).toHaveLength(30);
    const hero = heroOf(state, "s2h4");
    expect(hero).toMatchObject({
      seat: 2,
      name: "H24",
      location: "c2",
      troops: 0,
      status: "active",
      level: 1,
      exp: 0,
      injuredUntil: null,
      captor: null,
    });
    expect(hero.stats).toEqual({ might: 14, command: 14, admin: 14, mobility: 14 });
    expect(hero.traits).toEqual({ loyalty: 3, caution: 3, valor: 3 });
  });

  it("설정한 특성은 기본값 3을 덮는다", () => {
    const setup = makeSetup();
    setup.seats[1].heroes[2].traits = { caution: 5 };
    expect(heroOf(initState(setup), "s1h2").traits).toEqual({ loyalty: 3, caution: 5, valor: 3 });
  });

  it("자원은 시작값이고 자리마다 따로다", () => {
    const fresh = makeState();
    expect(fresh.seats[0].treasury).toEqual({ gold: 50, food: 50, material: 20, rare: 0 });
    fresh.seats[0].treasury.gold = 0;
    expect(fresh.seats[1].treasury.gold).toBe(50);
  });

  it("턴 0에서 끝나지 않은 상태로 시작한다", () => {
    expect(state.turn).toBe(0);
    expect(state.maxTurns).toBe(120);
    expect(state.majority).toEqual({ seat: null, streak: 0 });
    expect(state.ended).toBeNull();
  });

  it("시작 점수는 거점 1개 10점 + 병력 60명 6점이다", () => {
    expect(scoreOf(state, 0)).toBe(16);
  });

  it("건물 레벨 합 × 3과 (영웅 레벨 − 1) 합 × 2가 점수에 더해지고 out 영웅은 빠진다", () => {
    const fresh = makeState();
    fresh.nodes.c0.buildings = { production: 2, barracks: 0, walls: 1 };
    Object.assign(heroOf(fresh, "s0h0"), { level: 3 });
    Object.assign(heroOf(fresh, "s0h1"), { level: 2 });
    Object.assign(heroOf(fresh, "s0h2"), { level: 5, status: "out" });
    expect(scoreOf(fresh, 0)).toBe(16 + 9 + 6);
  });
});
