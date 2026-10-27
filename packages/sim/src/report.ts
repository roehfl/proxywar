import { BALANCE, type GameEvent, type MatchResult } from "@proxywar/core";
import type { MatchRecord } from "./runner";

const REASON: Record<MatchResult["reason"], string> = {
  earlyVictory: `조기 승리(과반 ${BALANCE.victory.majorityStreak}턴 유지)`,
  lastStanding: "마지막 생존",
  turnLimit: "턴 제한",
};

export function renderReport(record: MatchRecord): string {
  const names = record.config.seats.map((s) => s.name);
  const name = (seat: number | null): string => (seat === null ? "중립" : names[seat]);
  const last = record.turns[record.turns.length - 1];
  const result = record.result;
  const lines: string[] = [];

  lines.push(`# 매치 보고서: ${record.config.name}`, "");
  lines.push(`- 맵: ${record.config.map} · 시드: ${record.config.seed} · 진행 턴: ${last.turn}/${record.config.turns}`);
  lines.push(`- 종료: ${REASON[result.reason]} · 승자: ${name(result.winner)}`, "");

  lines.push("## 최종 순위", "", "| 순위 | 자리 | 점수 | 거점 | 병력 | 탈락 |", "|---|---|---|---|---|---|");
  result.ranking.forEach((seat, i) => {
    const m = last.metrics[seat];
    lines.push(`| ${i + 1} | ${name(seat)} | ${result.scores[seat]} | ${m.nodes} | ${m.troops} | ${m.eliminated ? "예" : ""} |`);
  });

  lines.push("", "## 거점 수 추이", "", `| 턴 | ${names.join(" | ")} |`, `|---|${names.map(() => "---").join("|")}|`);
  for (const t of record.turns) {
    if (t.turn % 10 !== 0 && t !== last) continue;
    lines.push(`| ${t.turn} | ${t.metrics.map((m) => m.nodes).join(" | ")} |`);
  }

  lines.push("", "## 주요 사건", "");
  for (const t of record.turns) {
    for (const e of t.events) {
      const text = describe(e, name);
      if (text) lines.push(`- T${t.turn} ${text}`);
    }
  }

  const issues = record.turns.flatMap((t) =>
    t.issues.flatMap((list, seat) => list.map((i) => `- T${t.turn} ${name(seat)}: ${i.item}[${i.index}] ${i.reason}`)),
  );
  lines.push("", "## 무효 명령", "", ...(issues.length > 0 ? issues : ["없음"]), "");
  return lines.join("\n");
}

function describe(e: GameEvent, name: (seat: number | null) => string): string | null {
  switch (e.kind) {
    case "captured":
      return `점령: ${e.node} (${name(e.from)} → ${name(e.to)})`;
    case "capitalMoved":
      return `수도 함락: ${name(e.seat)} ${e.from} → ${e.to ?? "없음"}`;
    case "eliminated":
      return `탈락: ${name(e.seat)}`;
    default:
      return null;
  }
}
