import { describe, expect, it } from "vitest";
import { resolveMovement } from "../src/rules/movement";
import type { GameEvent, Mission } from "../src/types";
import { heroOf, makeState } from "./helpers";

describe("resolveMovement", () => {
  it("move는 병력을 꺼내 인접 아군 거점으로 옮긴다", () => {
    const state = makeState();
    state.nodes.f0.owner = 0;
    state.nodes.f0.garrison = 0;
    const events: GameEvent[] = [];
    resolveMovement(state, new Map<string, Mission>([["s0h0", { kind: "move", hero: "s0h0", to: "f0", draw: 20 }]]), events);
    expect(heroOf(state, "s0h0")).toMatchObject({ location: "f0", troops: 20 });
    expect(state.nodes.c0.garrison).toBe(40);
    expect(events).toEqual([
      { kind: "drew", seat: 0, hero: "s0h0", node: "c0", amount: 20 },
      { kind: "moved", seat: 0, hero: "s0h0", from: "c0", to: "f0" },
    ]);
  });

  it("꺼내는 병력은 수비대와 통솔 상한을 넘지 않고, attack은 이 단계에서 움직이지 않는다", () => {
    const state = makeState();
    state.nodes.c0.garrison = 500;
    resolveMovement(state, new Map<string, Mission>([["s0h0", { kind: "attack", hero: "s0h0", target: "f0", draw: 1000 }]]), []);
    expect(heroOf(state, "s0h0")).toMatchObject({ location: "c0", troops: 140 });
    expect(state.nodes.c0.garrison).toBe(360);
  });

  it("defend와 임무 없는 영웅은 그대로다", () => {
    const state = makeState();
    const events: GameEvent[] = [];
    resolveMovement(state, new Map<string, Mission>([["s0h0", { kind: "defend", hero: "s0h0" }]]), events);
    expect(heroOf(state, "s0h0")).toMatchObject({ location: "c0", troops: 0 });
    expect(events).toEqual([]);
  });
});
