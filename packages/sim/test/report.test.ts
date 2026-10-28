import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseRunConfig } from "../src/config";
import { renderReport } from "../src/report";
import { runCommand } from "../src/run-command";
import { runMatch, staffFor } from "../src/runner";

const configPath = fileURLToPath(new URL("../configs/rule6.json", import.meta.url));
const presetsPath = fileURLToPath(new URL("../configs/rule6-presets.json", import.meta.url));

describe("run 명령과 보고서", () => {
  it("match.json과 report.md를 쓰고 보고서에 순위·추이·사건·무효 명령이 들어간다", async () => {
    const dir = await mkdtemp(join(tmpdir(), "proxywar-"));
    try {
      const { record, outDir } = await runCommand(configPath, dir);
      expect(outDir).toBe(dir);
      expect(existsSync(join(dir, "match.json"))).toBe(true);
      const saved = JSON.parse(readFileSync(join(dir, "match.json"), "utf8"));
      expect(saved.turns).toHaveLength(record.turns.length);

      const md = readFileSync(join(dir, "report.md"), "utf8");
      expect(md).toBe(renderReport(record));
      expect(md).toContain("# 매치 보고서: rule6-smoke");
      expect(md.split("\n").filter((line) => /^\| [1-6] \| /.test(line))).toHaveLength(6);
      expect(md).toContain("## 거점 수 추이");
      expect(md).toContain("점령:");
      expect(md).toContain("| 순위 | 자리 | 점수 | 거점 | 병력 | 건물 | 영웅 레벨 | 탈락 |");
      expect(md).toContain("## 세팅");
      expect(md).toContain("| Aster | balanced | 3·3·3·3·3·3 | 식량 자제 | 3 | 없음 |");
      expect(md).toContain("## 영웅·건설·명령 통계");
      expect(md).toContain(
        "| 자리 | 레벨업 | 부상 | 포로로 잡힘 | 명령 불복 | 신중 후퇴 | 후퇴 기준 | 조건 발동 | 건설 | 확정 수정 |",
      );
      expect(md).toContain("## 무효 명령\n\n없음");
      expect(md).toContain("### 약속 기록\n\n없음");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("외교 절에 자리별 제안 결과·약속 기록·마지막 관계가 들어간다", async () => {
    const config = parseRunConfig(JSON.parse(readFileSync(presetsPath, "utf8")));
    const md = renderReport(await runMatch(config, config.seats.map((s) => staffFor(s.staff))));
    expect(md).toContain("## 외교\n\n| 자리 | 제안 | 수락됨 | 거절됨 | 만료 | 무효 | 실패 | 깬 약속 |");
    expect(md).toContain("불가침 성립:");
    expect(md).toContain("### 마지막 관계\n\n| 쌍 | 관계 |");
  });
});
