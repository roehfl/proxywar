import { describe, expect, it } from "vitest";
import { bfs, getMap, neighbors } from "../src/map";

const map = getMap("ring6");

describe("ring6", () => {
  it("거점 30개, 수도 6개, 간선 36개다", () => {
    expect(map.nodes).toHaveLength(30);
    expect(map.capitals).toHaveLength(6);
    expect(map.edges).toHaveLength(36);
  });

  it("거점 id는 중복이 없고 수도는 capital 타입이다", () => {
    const ids = map.nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(30);
    for (const c of map.capitals) {
      expect(map.nodes.find((n) => n.id === c)?.type).toBe("capital");
    }
  });

  it("간선은 있는 거점끼리만 잇고 중복이 없다", () => {
    const ids = new Set(map.nodes.map((n) => n.id));
    const keys = new Set<string>();
    for (const [a, b] of map.edges) {
      expect(a).not.toBe(b);
      expect(ids.has(a) && ids.has(b)).toBe(true);
      keys.add([a, b].sort().join("-"));
    }
    expect(keys.size).toBe(36);
  });

  it("모든 거점이 이어져 있다", () => {
    expect(Object.keys(bfs(map, "c0").dist)).toHaveLength(30);
  });

  it("이웃 수도까지 최단 거리는 4다", () => {
    for (let i = 0; i < 6; i++) {
      expect(bfs(map, map.capitals[i]).dist[map.capitals[(i + 1) % 6]]).toBe(4);
    }
  });

  it("neighbors는 양방향 간선을 모두 찾는다", () => {
    expect(neighbors(map, "f0").sort()).toEqual(["c0", "x5"]);
  });

  it("bfs는 passable이 거짓인 거점 너머로 퍼지지 않는다", () => {
    const { dist } = bfs(map, "c0", (n) => n === "f0");
    expect(Object.keys(dist).sort()).toEqual(["c0", "f0", "m0", "x5"]);
  });

  it("없는 맵은 예외다", () => {
    expect(() => getMap("nope")).toThrow("unknown map: nope");
  });
});
