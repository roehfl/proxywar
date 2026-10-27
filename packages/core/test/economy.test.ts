import { describe, expect, it } from "vitest";
import { resolveEconomy } from "../src/rules/economy";
import type { GameEvent, Mission } from "../src/types";
import { heroOf, makeState, noOrders } from "./helpers";

const none = new Map<string, Mission>();

describe("resolveEconomy", () => {
  it("수도 생산을 더하고 유지비(병사 20명당 식량 1, 올림)를 뺀다", () => {
    const state = makeState();
    resolveEconomy(state, noOrders(), none, []);
    expect(state.seats[0].treasury).toEqual({ gold: 56, food: 52, material: 23, rare: 0 });
  });

  it("생산 뒤 모집하고 늘어난 병력으로 유지비를 낸다", () => {
    const state = makeState();
    const orders = noOrders();
    orders[0].recruits.push({ node: "c0", amount: 30 });
    const events: GameEvent[] = [];
    resolveEconomy(state, orders, none, events);
    expect(state.nodes.c0.garrison).toBe(90);
    expect(state.seats[0].treasury.gold).toBe(41);
    expect(state.seats[0].treasury.food).toBe(35);
    expect(events).toContainEqual({ kind: "recruited", seat: 0, node: "c0", amount: 30 });
  });

  it("자원이 모자라면 모집을 건너뛴다", () => {
    const state = makeState();
    state.seats[0].treasury.gold = 0;
    const orders = noOrders();
    orders[0].recruits.push({ node: "c0", amount: 30 });
    const events: GameEvent[] = [];
    resolveEconomy(state, orders, none, events);
    expect(state.nodes.c0.garrison).toBe(60);
    expect(events).toContainEqual({ kind: "recruitSkipped", seat: 0, node: "c0", reason: "unaffordable" });
  });

  it("그사이 잃은 거점에서는 모집을 건너뛴다", () => {
    const state = makeState();
    state.nodes.c0.owner = 5;
    const orders = noOrders();
    orders[0].recruits.push({ node: "c0", amount: 10 });
    const events: GameEvent[] = [];
    resolveEconomy(state, orders, none, events);
    expect(events).toContainEqual({ kind: "recruitSkipped", seat: 0, node: "c0", reason: "notOwned" });
  });

  it("유지비를 못 내면 식량을 모두 내고 병력 10%가 탈영한다", () => {
    const state = makeState();
    state.seats[0].treasury.food = 0;
    state.nodes.c0.garrison = 400;
    heroOf(state, "s0h0").troops = 15;
    const events: GameEvent[] = [];
    resolveEconomy(state, noOrders(), none, events);
    expect(state.seats[0].treasury.food).toBe(0);
    expect(state.nodes.c0.garrison).toBe(360);
    expect(heroOf(state, "s0h0").troops).toBe(13);
    expect(events).toContainEqual({ kind: "upkeep", seat: 0, food: 5, deserted: 42 });
  });

  it("탈락한 자리는 처리하지 않는다", () => {
    const state = makeState();
    state.seats[1].eliminatedAt = 0;
    resolveEconomy(state, noOrders(), none, []);
    expect(state.seats[1].treasury).toEqual({ gold: 50, food: 50, material: 20, rare: 0 });
  });

  it("운영 중인 영웅은 서 있는 거점 생산을 내정 × 3%만큼 늘리고 경험치 5를 얻는다", () => {
    const state = makeState();
    const events: GameEvent[] = [];
    resolveEconomy(state, noOrders(), new Map([["s0h0", { kind: "govern", hero: "s0h0" }]]), events);
    // 수도 생산 6/5/3 × 142% 내림 = 8/7/4, 유지비 3
    expect(state.seats[0].treasury).toEqual({ gold: 58, food: 54, material: 24, rare: 0 });
    expect(events).toContainEqual({ kind: "income", seat: 0, gain: { gold: 8, food: 7, material: 4, rare: 0 } });
    expect(heroOf(state, "s0h0").exp).toBe(5);
  });

  it("한 거점에 운영 영웅이 둘이면 내정이 가장 높은 쪽만 반영하고 둘 다 경험치를 얻는다", () => {
    const state = makeState();
    heroOf(state, "s0h1").stats.admin = 20;
    const missions = new Map<string, Mission>([
      ["s0h0", { kind: "govern", hero: "s0h0" }],
      ["s0h1", { kind: "govern", hero: "s0h1" }],
    ]);
    const events: GameEvent[] = [];
    resolveEconomy(state, noOrders(), missions, events);
    // 수도 생산 6/5/3 × (100 + 20 × 3)% 내림 = 9/8/4, 유지비 3
    expect(events).toContainEqual({ kind: "income", seat: 0, gain: { gold: 9, food: 8, material: 4, rare: 0 } });
    expect(state.seats[0].treasury).toEqual({ gold: 59, food: 55, material: 24, rare: 0 });
    expect(heroOf(state, "s0h0").exp).toBe(5);
    expect(heroOf(state, "s0h1").exp).toBe(5);
  });

  it("생산 건물은 레벨당 그 거점 생산을 50% 늘린다", () => {
    const state = makeState();
    state.nodes.c0.buildings.production = 1;
    resolveEconomy(state, noOrders(), none, []);
    // 6/5/3 × 150% 내림 = 9/7/4
    expect(state.seats[0].treasury).toEqual({ gold: 59, food: 54, material: 24, rare: 0 });
  });

  it("생산 뒤에 건물을 짓고 금 20·자재 30을 낸다", () => {
    const state = makeState();
    state.seats[0].treasury.material = 30;
    const orders = noOrders();
    orders[0].builds.push({ node: "c0", building: "walls" });
    const events: GameEvent[] = [];
    resolveEconomy(state, orders, none, events);
    expect(state.nodes.c0.buildings.walls).toBe(1);
    expect(state.seats[0].treasury).toMatchObject({ gold: 36, material: 3 });
    expect(events).toContainEqual({ kind: "built", seat: 0, node: "c0", building: "walls", level: 1 });
  });

  it("두 번째 레벨은 금 40·자재 60이고, 모자라면 짓지 않는다", () => {
    const state = makeState();
    state.nodes.c0.buildings.walls = 1;
    state.seats[0].treasury.material = 50;
    const orders = noOrders();
    orders[0].builds.push({ node: "c0", building: "walls" });
    const events: GameEvent[] = [];
    resolveEconomy(state, orders, none, events);
    expect(state.nodes.c0.buildings.walls).toBe(1);
    expect(events).toContainEqual({
      kind: "buildSkipped",
      seat: 0,
      node: "c0",
      building: "walls",
      reason: "unaffordable",
    });
  });

  it("그사이 잃은 거점에는 짓지 않는다", () => {
    const state = makeState();
    state.nodes.c0.owner = 5;
    const orders = noOrders();
    orders[0].builds.push({ node: "c0", building: "production" });
    const events: GameEvent[] = [];
    resolveEconomy(state, orders, none, events);
    expect(state.nodes.c0.buildings.production).toBe(0);
    expect(events).toContainEqual({
      kind: "buildSkipped",
      seat: 0,
      node: "c0",
      building: "production",
      reason: "notOwned",
    });
  });
});
