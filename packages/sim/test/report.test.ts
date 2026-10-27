import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderReport } from "../src/report";
import { runCommand } from "../src/run-command";

const configPath = fileURLToPath(new URL("../configs/rule6.json", import.meta.url));

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
      expect(md).toContain("## 무효 명령\n\n없음");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
