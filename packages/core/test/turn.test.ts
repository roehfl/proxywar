import { describe, expect, it } from "vitest";
import { processTurn } from "../src/rules/turn";
import type { GameEvent } from "../src/types";
import { heroOf, makeState, noOrders } from "./helpers";

function battleOf(events: GameEvent[]) {
  const battle = events.find((e) => e.kind === "battle");
  if (!battle || battle.kind !== "battle") throw new Error("no battle");
  return battle;
}

describe("processTurn", () => {
  it("원본 상태를 바꾸지 않고 턴을 1 올린다", () => {
    const state = makeState();
    const before = JSON.stringify(state);
    const { state: next } = processTurn(state, noOrders());
    expect(JSON.stringify(state)).toBe(before);
    expect(next.turn).toBe(1);
  });

  it("끝난 매치는 처리하지 않는다", () => {
    const state = makeState();
    state.ended = { reason: "turnLimit", winner: 0, ranking: [0, 1, 2, 3, 4, 5], scores: [0, 0, 0, 0, 0, 0] };
    expect(() => processTurn(state, noOrders())).toThrow("match already ended");
  });

  it("거점을 모두 잃은 자리는 탈락한다", () => {
    const state = makeState();
    state.nodes.m0.owner = 5;
    state.nodes.m0.garrison = 0;
    Object.assign(heroOf(state, "s5h0"), { location: "m0", troops: 500 });
    const orders = noOrders();
    orders[5].missions.push({ kind: "attack", hero: "s5h0", target: "c0" });
    const { state: next, events } = processTurn(state, orders);
    expect(next.seats[0]).toMatchObject({ eliminatedAt: 1, capital: null });
    expect(next.heroes.filter((h) => h.seat === 0).every((h) => h.status === "out")).toBe(true);
    expect(events).toContainEqual({ kind: "eliminated", seat: 0 });
    expect(next.ended).toBeNull();
  });

  it("과반을 12턴 연속 가지면 조기 승리한다", () => {
    const state = makeState();
    const others = new Set(["c1", "c2", "c3", "c4", "c5"]);
    for (const n of state.map.nodes.filter((n) => !others.has(n.id)).slice(0, 16)) state.nodes[n.id].owner = 0;
    state.majority = { seat: 0, streak: 11 };
    const { state: next, events } = processTurn(state, noOrders());
    expect(next.majority).toEqual({ seat: 0, streak: 12 });
    expect(next.ended).toMatchObject({ reason: "earlyVictory", winner: 0 });
    expect(next.ended?.ranking[0]).toBe(0);
    expect(events.at(-1)?.kind).toBe("matchEnded");
  });

  it("과반이 없으면 연속 기록이 끊긴다", () => {
    const state = makeState();
    state.majority = { seat: 0, streak: 5 };
    expect(processTurn(state, noOrders()).state.majority).toEqual({ seat: null, streak: 0 });
  });

  it("턴 제한에 닿으면 점수 순으로 순위를 매기고 동점은 자리 번호 순이다", () => {
    const state = makeState();
    state.maxTurns = 1;
    state.nodes.c3.garrison = 200;
    const { state: next } = processTurn(state, noOrders());
    expect(next.ended).toEqual({
      reason: "turnLimit",
      winner: 3,
      ranking: [3, 0, 1, 2, 4, 5],
      scores: [16, 16, 16, 30, 16, 16],
    });
  });

  it("탈락한 자리는 살아 있는 자리 아래이고, 탈락끼리는 늦게 탈락한 쪽이 위다", () => {
    const state = makeState();
    state.maxTurns = 1;
    state.nodes.c3.garrison = 200;
    state.seats[4].eliminatedAt = 0;
    state.seats[5].eliminatedAt = 1;
    expect(processTurn(state, noOrders()).state.ended?.ranking).toEqual([3, 0, 1, 2, 5, 4]);
  });

  it("탈락한 자리의 명령은 처리하지 않는다", () => {
    const state = makeState();
    state.seats[1].eliminatedAt = 0;
    heroOf(state, "s1h0").troops = 100;
    const orders = noOrders();
    orders[1].missions.push({ kind: "attack", hero: "s1h0", target: "f1" });
    const { state: next } = processTurn(state, orders);
    expect(next.nodes.f1.owner).toBeNull();
    expect(heroOf(next, "s1h0").location).toBe("c1");
  });

  it("한 자리만 남으면 마지막 생존으로 끝난다", () => {
    const state = makeState();
    for (let i = 1; i < 6; i++) state.seats[i].eliminatedAt = 0;
    const { state: next } = processTurn(state, noOrders());
    expect(next.ended).toMatchObject({ reason: "lastStanding", winner: 0 });
  });

  it("같은 시드·같은 명령이면 같은 결과, 시드가 다르면 전투 힘이 달라진다", () => {
    const orders = noOrders();
    orders[0].missions.push({ kind: "attack", hero: "s0h0", target: "f0", draw: 40 });
    const a = processTurn(makeState(1), orders);
    const b = processTurn(makeState(1), orders);
    const c = processTurn(makeState(2), orders);
    expect(a).toEqual(b);
    expect(battleOf(c.events).attackPower).not.toBe(battleOf(a.events).attackPower);
  });

  it("부상한 영웅은 세 번의 턴 처리 동안 빠졌다가 세 번째 처리 끝에 회복한다", () => {
    let state = makeState();
    Object.assign(heroOf(state, "s0h0"), { status: "injured", injuredUntil: 3 });
    for (let turn = 1; turn <= 2; turn++) {
      state = processTurn(state, noOrders()).state;
      expect(heroOf(state, "s0h0").status).toBe("injured");
    }
    const { state: next, events } = processTurn(state, noOrders());
    expect(heroOf(next, "s0h0").status).toBe("active");
    expect(events).toContainEqual({ kind: "heroRecovered", seat: 0, hero: "s0h0" });
  });

  it("탈락한 자리가 잡고 있던 포로는 풀려나 자기 수도로 돌아간다", () => {
    const state = makeState();
    Object.assign(heroOf(state, "s1h0"), { status: "captured", captor: 0 });
    state.nodes.m0.owner = 5;
    state.nodes.m0.garrison = 0;
    Object.assign(heroOf(state, "s5h0"), { location: "m0", troops: 500 });
    const orders = noOrders();
    orders[5].missions.push({ kind: "attack", hero: "s5h0", target: "c0" });
    const { state: next, events } = processTurn(state, orders);
    expect(next.seats[0].eliminatedAt).toBe(1);
    expect(heroOf(next, "s1h0")).toMatchObject({ status: "active", captor: null, location: "c1" });
    expect(events).toContainEqual({ kind: "heroReleased", seat: 1, hero: "s1h0", to: "c1" });
  });
});
