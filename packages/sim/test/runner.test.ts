import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseRunConfig, type RunConfig } from "../src/config";
import { runMatch, staffFor } from "../src/runner";

const raw = JSON.parse(readFileSync(new URL("../configs/rule6.json", import.meta.url), "utf8"));
const config = parseRunConfig(raw);

function run(c: RunConfig) {
  return runMatch(c, c.seats.map((s) => staffFor(s.staff)));
}

describe("runMatch", () => {
  it("규칙 참모 6명이 매치를 끝까지 돌고 모든 계획이 검증을 통과한다", async () => {
    const record = await run(config);
    expect(record.turns.length).toBeGreaterThan(0);
    expect(record.turns.length).toBeLessThanOrEqual(120);
    expect(record.turns.at(-1)?.turn).toBe(record.turns.length);
    expect(record.result.ranking).toHaveLength(6);
    expect(record.turns.every((t) => t.issues.every((list) => list.length === 0))).toBe(true);
    expect(record.turns[0].metrics).toHaveLength(6);
  });

  it("같은 설정이면 같은 기록을 낸다", async () => {
    expect(JSON.stringify(await run(config))).toBe(JSON.stringify(await run(config)));
  });

  it("시드가 다르면 기록이 달라진다", async () => {
    const a = await run(config);
    const b = await run({ ...config, seed: config.seed + 1 });
    expect(JSON.stringify(b.turns)).not.toBe(JSON.stringify(a.turns));
  });

  it("자리가 6개가 아니거나 참모 종류가 없으면 설정을 거부한다", () => {
    expect(() => parseRunConfig({ ...raw, seats: raw.seats.slice(0, 5) })).toThrow();
    expect(() =>
      parseRunConfig({ ...raw, seats: raw.seats.map((s: object) => ({ ...s, staff: { kind: "llm" } })) }),
    ).toThrow();
  });

  it("모르는 키(오타)와 경로에 못 쓰는 이름을 거부한다", () => {
    expect(() => parseRunConfig({ ...raw, turn: 3 })).toThrow();
    expect(() => parseRunConfig({ ...raw, name: "a/b" })).toThrow();
    const heroTypo = JSON.parse(JSON.stringify(raw));
    heroTypo.seats[0].heroes[0].growht = 2;
    expect(() => parseRunConfig(heroTypo)).toThrow();
  });
});
