import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseRunConfig } from "./config";
import { renderReport } from "./report";
import { runMatch, staffFor, type MatchRecord } from "./runner";

/** 설정 파일로 매치 하나를 돌려 outDir(없으면 runs/<시각>-<이름>)에 기록과 보고서를 쓴다. */
export async function runCommand(configPath: string, outDir?: string): Promise<{ record: MatchRecord; outDir: string }> {
  const config = parseRunConfig(JSON.parse(await readFile(configPath, "utf8")));
  const dir = outDir ?? join("runs", `${new Date().toISOString().replace(/[:.]/g, "-")}-${config.name}`);
  const record = await runMatch(
    config,
    config.seats.map((s) => staffFor(s.staff)),
  );
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "match.json"), JSON.stringify(record));
  await writeFile(join(dir, "report.md"), renderReport(record));
  return { record, outDir: dir };
}
