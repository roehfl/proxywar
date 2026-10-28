import { describe, expect, it } from "vitest";
import { allied, relationOf, setRelation } from "../src/relations";
import { makeState } from "./helpers";

describe("relations", () => {
  it("시작 상태는 모든 쌍이 중립이고 대기 제안·약속 기록이 비어 있다", () => {
    const state = makeState();
    expect(state.diplomacy).toEqual({ relations: [], pending: [], promises: [] });
    expect(relationOf(state, 3, 1)).toEqual({ a: 1, b: 3, kind: "neutral", until: null });
  });

  it("관계는 쌍마다 하나이고 자리 순서와 상관없다", () => {
    const state = makeState();
    setRelation(state, 4, 2, "nonAggression", 30);
    expect(relationOf(state, 2, 4)).toEqual({ a: 2, b: 4, kind: "nonAggression", until: 30 });
    setRelation(state, 2, 4, "alliance");
    expect(state.diplomacy.relations).toEqual([{ a: 2, b: 4, kind: "alliance", until: null }]);
    expect(allied(state, 4, 2)).toBe(true);
    expect(allied(state, 4, 4)).toBe(false);
  });

  it("중립으로 바꾸면 목록에서 빠지고, 목록은 (a, b) 순이다", () => {
    const state = makeState();
    setRelation(state, 5, 0, "war");
    setRelation(state, 1, 0, "war");
    setRelation(state, 3, 2, "alliance");
    expect(state.diplomacy.relations.map((r) => [r.a, r.b])).toEqual([
      [0, 1],
      [0, 5],
      [2, 3],
    ]);
    setRelation(state, 0, 1, "neutral");
    expect(state.diplomacy.relations.map((r) => [r.a, r.b])).toEqual([
      [0, 5],
      [2, 3],
    ]);
  });
});
