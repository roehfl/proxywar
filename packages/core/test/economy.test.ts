import { describe, expect, it } from "vitest";
import { resolveEconomy } from "../src/rules/economy";
import type { GameEvent } from "../src/types";
import { heroOf, makeState, noOrders } from "./helpers";

describe("resolveEconomy", () => {
  it("수도 생산을 더하고 유지비(병사 20명당 식량 1, 올림)를 뺀다", () => {
    const state = makeState();
    resolveEconomy(state, noOrders(), []);
    expect(state.seats[0].treasury).toEqual({ gold: 56, food: 52, material: 23, rare: 0 });
  });

  it("생산 뒤 모집하고 늘어난 병력으로 유지비를 낸다", () => {
    const state = makeState();
    const orders = noOrders();
    orders[0].recruits.push({ node: "c0", amount: 30 });
    const events: GameEvent[] = [];
    resolveEconomy(state, orders, events);
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
    resolveEconomy(state, orders, events);
    expect(state.nodes.c0.garrison).toBe(60);
    expect(events).toContainEqual({ kind: "recruitSkipped", seat: 0, node: "c0", reason: "unaffordable" });
  });

  it("그사이 잃은 거점에서는 모집을 건너뛴다", () => {
    const state = makeState();
    state.nodes.c0.owner = 5;
    const orders = noOrders();
    orders[0].recruits.push({ node: "c0", amount: 10 });
    const events: GameEvent[] = [];
    resolveEconomy(state, orders, events);
    expect(events).toContainEqual({ kind: "recruitSkipped", seat: 0, node: "c0", reason: "notOwned" });
  });

  it("유지비를 못 내면 식량을 모두 내고 병력 10%가 탈영한다", () => {
    const state = makeState();
    state.seats[0].treasury.food = 0;
    state.nodes.c0.garrison = 400;
    heroOf(state, "s0h0").troops = 15;
    const events: GameEvent[] = [];
    resolveEconomy(state, noOrders(), events);
    expect(state.seats[0].treasury.food).toBe(0);
    expect(state.nodes.c0.garrison).toBe(360);
    expect(heroOf(state, "s0h0").troops).toBe(13);
    expect(events).toContainEqual({ kind: "upkeep", seat: 0, food: 5, deserted: 42 });
  });

  it("탈락한 자리는 처리하지 않는다", () => {
    const state = makeState();
    state.seats[1].eliminatedAt = 0;
    resolveEconomy(state, noOrders(), []);
    expect(state.seats[1].treasury).toEqual({ gold: 50, food: 50, material: 20, rare: 0 });
  });
});
