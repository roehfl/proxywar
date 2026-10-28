import { describe, expect, it } from "vitest";
import { relationOf, setRelation } from "../src/relations";
import { processTurn } from "../src/rules/turn";
import type { GameEvent, GameState, Mission, Plan } from "../src/types";
import { heroOf, makeState, noOrders } from "./helpers";

/** 자리별 계획 일부만 준 턴 처리 */
function turn(state: GameState, ...entries: [number, Partial<Plan>][]) {
  const orders = noOrders();
  for (const [seat, plan] of entries) orders[seat] = { missions: [], recruits: [], builds: [], ...plan };
  return processTurn(state, orders);
}

/** s0h0(x0, 병력 100)이 자리 1의 f1을 칠 수 있게 두고 그 공격 임무를 돌려준다 */
function frontline(state: GameState): Mission {
  state.nodes.x0.owner = 0;
  state.nodes.f1.owner = 1;
  Object.assign(heroOf(state, "s0h0"), { location: "x0", troops: 100 });
  return { kind: "attack", hero: "s0h0", target: "f1" };
}

function settled(events: GameEvent[]): [string, string, string | undefined][] {
  return events.flatMap((e) => (e.kind === "proposalSettled" ? [[e.id, e.result, e.reason]] : []));
}

describe("외교 정산", () => {
  it("제안은 외교 정산에서 전달되고, 다음 턴의 수락으로 성립한다", () => {
    const first = turn(makeState(), [0, { proposals: [{ kind: "nonAggression", to: 1, turns: 12 }] }]);
    expect(first.state.diplomacy.pending).toEqual([{ kind: "nonAggression", to: 1, turns: 12, id: "1-0-0", from: 0 }]);
    expect(first.events).toContainEqual({ kind: "proposalDelivered", id: "1-0-0", from: 0, to: 1, offer: "nonAggression" });

    const { state, events } = turn(first.state, [1, { responses: [{ id: "1-0-0", accept: true }] }]);
    expect(relationOf(state, 0, 1)).toEqual({ a: 0, b: 1, kind: "nonAggression", until: 14 });
    expect(state.diplomacy.promises).toEqual([{ turn: 2, kind: "formed", treaty: "nonAggression", seats: [0, 1] }]);
    expect(state.diplomacy.pending).toEqual([]);
    expect(settled(events)).toEqual([["1-0-0", "accepted", undefined]]);
    expect(events).toContainEqual({
      kind: "relationChanged",
      seats: [0, 1],
      from: "neutral",
      to: "nonAggression",
      cause: "accepted",
    });
  });

  it("거절과 무응답은 거절·만료로 끝나고 관계는 그대로다", () => {
    const state = makeState();
    state.diplomacy.pending.push(
      { kind: "alliance", to: 1, id: "0-0-0", from: 0 },
      { kind: "alliance", to: 3, id: "0-2-0", from: 2 },
    );
    const { state: next, events } = turn(state, [1, { responses: [{ id: "0-0-0", accept: false }] }]);
    expect(settled(events)).toEqual([
      ["0-0-0", "rejected", undefined],
      ["0-2-0", "expired", undefined],
    ]);
    expect(next.diplomacy).toEqual({ relations: [], pending: [], promises: [] });
  });

  it("같은 쌍에 전투·선전포고·파기가 있으면 그 턴의 수락은 무효다", () => {
    const state = makeState();
    const attack = frontline(state);
    setRelation(state, 4, 5, "nonAggression", 50);
    state.diplomacy.pending.push(
      { kind: "alliance", to: 1, id: "0-0-0", from: 0 },
      { kind: "alliance", to: 3, id: "0-2-0", from: 2 },
      { kind: "alliance", to: 5, id: "0-4-0", from: 4 },
    );
    const { state: next, events } = turn(
      state,
      [0, { missions: [attack] }],
      [1, { responses: [{ id: "0-0-0", accept: true }] }],
      [2, { proposals: [{ kind: "declareWar", to: 3 }] }],
      [3, { responses: [{ id: "0-2-0", accept: true }] }],
      [4, { proposals: [{ kind: "breakTreaty", to: 5 }] }],
      [5, { responses: [{ id: "0-4-0", accept: true }] }],
    );
    expect(settled(events)).toEqual([
      ["0-0-0", "voided", "hostile"],
      ["0-2-0", "voided", "hostile"],
      ["0-4-0", "voided", "hostile"],
    ]);
    expect(next.diplomacy.relations.map((r) => [r.a, r.b, r.kind])).toEqual([
      [0, 1, "war"],
      [2, 3, "war"],
    ]);
  });

  it("불가침·동맹 상대를 친 기습과 선전포고·파기는 깬 쪽을 약속 기록에 남긴다", () => {
    const state = makeState();
    const attack = frontline(state);
    setRelation(state, 0, 1, "nonAggression", 50);
    setRelation(state, 2, 3, "alliance");
    setRelation(state, 4, 5, "alliance");
    const { state: next, events } = turn(
      state,
      [0, { missions: [attack] }],
      [2, { proposals: [{ kind: "declareWar", to: 3 }] }],
      [4, { proposals: [{ kind: "breakTreaty", to: 5 }] }],
    );
    expect(next.diplomacy.promises).toEqual([
      { turn: 1, kind: "broken", treaty: "nonAggression", seats: [0, 1], by: 0, how: "attack" },
      { turn: 1, kind: "broken", treaty: "alliance", seats: [2, 3], by: 2, how: "war" },
      { turn: 1, kind: "declared", seats: [2, 3], by: 2 },
      { turn: 1, kind: "broken", treaty: "alliance", seats: [4, 5], by: 4, how: "break" },
    ]);
    expect(events.filter((e) => e.kind === "relationChanged")).toEqual([
      { kind: "relationChanged", seats: [0, 1], from: "nonAggression", to: "war", cause: "attack" },
      { kind: "relationChanged", seats: [2, 3], from: "alliance", to: "war", cause: "declareWar" },
      { kind: "relationChanged", seats: [4, 5], from: "alliance", to: "neutral", cause: "breakTreaty" },
    ]);
  });

  it("중립 상대를 치면 약속 기록 없이 전쟁이 되고, 이미 전쟁이면 바뀌지 않는다", () => {
    const neutral = makeState();
    const first = turn(neutral, [0, { missions: [frontline(neutral)] }]);
    expect(relationOf(first.state, 0, 1).kind).toBe("war");
    expect(first.state.diplomacy.promises).toEqual([]);
    expect(first.events).toContainEqual({ kind: "relationChanged", seats: [0, 1], from: "neutral", to: "war", cause: "attack" });

    const war = makeState();
    setRelation(war, 0, 1, "war");
    const second = turn(war, [0, { missions: [frontline(war)] }]);
    expect(second.events.some((e) => e.kind === "relationChanged")).toBe(false);
  });

  it("불가침은 만료 턴의 외교 정산에서 중립이 된다", () => {
    const state = makeState();
    setRelation(state, 0, 1, "nonAggression", 1);
    setRelation(state, 2, 3, "nonAggression", 2);
    const { state: next, events } = processTurn(state, noOrders());
    expect(next.diplomacy.relations).toEqual([{ a: 2, b: 3, kind: "nonAggression", until: 2 }]);
    expect(next.diplomacy.promises).toEqual([{ turn: 1, kind: "expired", treaty: "nonAggression", seats: [0, 1] }]);
    expect(events).toContainEqual({
      kind: "relationChanged",
      seats: [0, 1],
      from: "nonAggression",
      to: "neutral",
      cause: "expired",
    });
  });

  it("자원 교환은 두 금고가 될 때 맞바꾸고, 모자라면 실패한다", () => {
    const state = makeState();
    state.diplomacy.pending.push(
      { kind: "trade", to: 1, give: { gold: 20 }, get: { food: 30 }, id: "0-0-0", from: 0 },
      { kind: "trade", to: 3, give: { gold: 100 }, get: {}, id: "0-2-0", from: 2 },
    );
    const base = processTurn(state, noOrders()).state;
    const { state: next, events } = turn(
      state,
      [1, { responses: [{ id: "0-0-0", accept: true }] }],
      [3, { responses: [{ id: "0-2-0", accept: true }] }],
    );
    const diff = (seat: number) => ({
      gold: next.seats[seat].treasury.gold - base.seats[seat].treasury.gold,
      food: next.seats[seat].treasury.food - base.seats[seat].treasury.food,
    });
    expect([diff(0), diff(1), diff(2), diff(3)]).toEqual([
      { gold: -20, food: 30 },
      { gold: 20, food: -30 },
      { gold: 0, food: 0 },
      { gold: 0, food: 0 },
    ]);
    expect(settled(events)).toEqual([
      ["0-0-0", "accepted", undefined],
      ["0-2-0", "failed", "unaffordable"],
    ]);
  });

  it("포로 교환은 풀린 영웅을 각자의 현재 수도로 보내고 자원을 옮기며, 포로 상태가 바뀌었으면 실패한다", () => {
    const setup = (): GameState => {
      const state = makeState();
      Object.assign(heroOf(state, "s1h0"), { status: "captured", captor: 0 });
      Object.assign(heroOf(state, "s0h4"), { status: "captured", captor: 1 });
      state.diplomacy.pending.push({
        kind: "prisoners",
        to: 1,
        release: ["s1h0"],
        receive: ["s0h4"],
        pay: {},
        ask: { gold: 10 },
        id: "0-0-0",
        from: 0,
      });
      return state;
    };
    const accept: [number, Partial<Plan>] = [1, { responses: [{ id: "0-0-0", accept: true }] }];
    const state = setup();
    const base = processTurn(state, noOrders()).state;
    const { state: next, events } = turn(state, accept);
    expect(heroOf(next, "s1h0")).toMatchObject({ status: "active", location: "c1", captor: null, troops: 0 });
    expect(heroOf(next, "s0h4")).toMatchObject({ status: "active", location: "c0", captor: null, troops: 0 });
    expect(next.seats[0].treasury.gold - base.seats[0].treasury.gold).toBe(10);
    expect(next.seats[1].treasury.gold - base.seats[1].treasury.gold).toBe(-10);
    expect(events).toContainEqual({ kind: "heroReleased", seat: 1, hero: "s1h0", to: "c1" });
    expect(events).toContainEqual({ kind: "heroReleased", seat: 0, hero: "s0h4", to: "c0" });

    const moved = setup();
    Object.assign(heroOf(moved, "s0h4"), { status: "active", captor: null });
    const failed = turn(moved, accept);
    expect(settled(failed.events)).toEqual([["0-0-0", "failed", "prisoner"]]);
    expect(heroOf(failed.state, "s1h0").status).toBe("captured");
  });

  it("같은 쌍의 두 수락은 id 순으로 정산하고, 이미 성립한 관계의 수락은 무효다", () => {
    const state = makeState();
    state.diplomacy.pending.push(
      { kind: "nonAggression", to: 1, turns: 12, id: "0-0-0", from: 0 },
      { kind: "nonAggression", to: 0, turns: 48, id: "0-1-0", from: 1 },
    );
    const { state: next, events } = turn(
      state,
      [0, { responses: [{ id: "0-1-0", accept: true }] }],
      [1, { responses: [{ id: "0-0-0", accept: true }] }],
    );
    expect(settled(events)).toEqual([
      ["0-0-0", "accepted", undefined],
      ["0-1-0", "voided", "stale"],
    ]);
    expect(relationOf(next, 0, 1)).toMatchObject({ kind: "nonAggression", until: 13 });
  });

  it("동맹이 끝나면 상대 거점에 있던 영웅은 병력을 그대로 데리고 가장 가까운 아군 거점으로 돌아간다", () => {
    const state = makeState();
    setRelation(state, 0, 1, "alliance");
    state.nodes.x0.owner = 0;
    state.nodes.f1.owner = 1;
    Object.assign(heroOf(state, "s0h0"), { location: "f1", troops: 30 });
    const { state: next, events } = turn(state, [1, { proposals: [{ kind: "breakTreaty", to: 0 }] }]);
    expect(heroOf(next, "s0h0")).toMatchObject({ status: "active", location: "x0", troops: 30 });
    expect(events).toContainEqual({ kind: "heroReturned", seat: 0, hero: "s0h0", from: "f1", to: "x0" });
  });

  it("거점이 0인 자리의 수락은 무효이고, 그 자리와는 제안을 주고받지 않는다", () => {
    const state = makeState();
    state.nodes.c5.owner = 4;
    state.diplomacy.pending.push({ kind: "alliance", to: 5, id: "0-4-0", from: 4 });
    const { state: next, events } = turn(
      state,
      [0, { proposals: [{ kind: "alliance", to: 5 }] }],
      [5, { responses: [{ id: "0-4-0", accept: true }], proposals: [{ kind: "alliance", to: 0 }] }],
    );
    expect(settled(events)).toEqual([["0-4-0", "voided", "gone"]]);
    expect(next.diplomacy.pending).toEqual([]);
    expect(next.seats[5].eliminatedAt).toBe(1);
  });
});
