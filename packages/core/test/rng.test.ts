import { describe, expect, it } from "vitest";
import { createRng } from "../src/rng";

describe("createRng", () => {
  it("같은 부분이면 같은 수열을 낸다", () => {
    const a = createRng(7, 3, "turn");
    const b = createRng(7, 3, "turn");
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });

  it("부분이 하나라도 다르면 다른 수열을 낸다", () => {
    expect(createRng(7, 3, "turn").next()).not.toBe(createRng(7, 4, "turn").next());
  });

  it("next는 0 이상 1 미만이다", () => {
    const rng = createRng(1);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("range는 min 이상 max 미만이다", () => {
    const rng = createRng(2);
    for (let i = 0; i < 1000; i++) {
      const v = rng.range(0.9, 1.1);
      expect(v).toBeGreaterThanOrEqual(0.9);
      expect(v).toBeLessThan(1.1);
    }
  });

  it("shuffle은 원소를 보존하고 원본을 바꾸지 않는다", () => {
    const items = ["a", "b", "c", "d", "e"];
    const out = createRng(3).shuffle(items);
    expect([...out].sort()).toEqual(items);
    expect(items).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("수열과 섞는 순서가 고정돼 있다(바뀌면 저장된 기록을 재생할 수 없다)", () => {
    expect(createRng(1).next()).toBe(0.8317172497045249);
    expect(createRng(5).shuffle(["a", "b", "c", "d", "e"])).toEqual(["c", "a", "e", "d", "b"]);
  });
});
