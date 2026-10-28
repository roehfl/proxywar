import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseRunConfig } from "../src/config";
import { runMatch, staffFor } from "../src/runner";

const raw = JSON.parse(readFileSync(new URL("../configs/rule6.json", import.meta.url), "utf8"));

/**
 * 1b-1 코드(커밋 d86127b)로 뽑은 rule6 시드 1~8의 결과. hash는 턴별 [사건, 지표]의 sha256 앞 16자다.
 * 세팅을 주지 않은 매치(balanced, 수도 최소 수비 3, 상시 명령 없음)는 1b-2·1b-3에서도 이 매치를 그대로 만든다.
 * 1b-3의 외교 사건(전투가 부르는 전쟁 같은)은 매치를 바꾸지 않으므로 해시에서 뺀다.
 */
const DIPLOMACY_EVENTS = new Set(["proposalDelivered", "proposalSettled", "relationChanged", "promise", "heroReturned"]);

const EXPECTED = [
  { seed: 1, reason: "turnLimit", turns: 120, winner: 5, ranking: [5, 3, 2, 0, 4, 1], hash: "5ab5d5c823266791" },
  { seed: 2, reason: "earlyVictory", turns: 91, winner: 0, ranking: [0, 3, 5, 1, 4, 2], hash: "20e62617477b02bc" },
  { seed: 3, reason: "turnLimit", turns: 120, winner: 1, ranking: [1, 3, 5, 2, 0, 4], hash: "2b9563ab1d66c039" },
  { seed: 4, reason: "earlyVictory", turns: 72, winner: 0, ranking: [0, 2, 3, 1, 5, 4], hash: "085b32a4806c7909" },
  { seed: 5, reason: "earlyVictory", turns: 80, winner: 5, ranking: [5, 2, 1, 0, 3, 4], hash: "3cc578f8fb4989fe" },
  { seed: 6, reason: "earlyVictory", turns: 95, winner: 1, ranking: [1, 0, 4, 2, 3, 5], hash: "806ec1174f30da27" },
  { seed: 7, reason: "earlyVictory", turns: 103, winner: 4, ranking: [4, 2, 1, 0, 5, 3], hash: "8be28322bec1567a" },
  { seed: 8, reason: "turnLimit", turns: 120, winner: 1, ranking: [1, 2, 4, 5, 0, 3], hash: "d61cba2f397b5194" },
];

describe("기본 세팅 회귀", () => {
  it.each(EXPECTED)("rule6 시드 $seed는 1b-1과 같은 매치다", async ({ seed, hash, ...result }) => {
    const config = parseRunConfig({ ...raw, seed });
    const record = await runMatch(
      config,
      config.seats.map((s) => staffFor(s.staff)),
    );
    expect({
      reason: record.result.reason,
      turns: record.turns.length,
      winner: record.result.winner,
      ranking: record.result.ranking,
    }).toEqual(result);
    const digest = createHash("sha256")
      .update(
        JSON.stringify(record.turns.map((t) => [t.events.filter((e) => !DIPLOMACY_EVENTS.has(e.kind)), t.metrics])),
      )
      .digest("hex")
      .slice(0, 16);
    expect(digest).toBe(hash);
  });
});
