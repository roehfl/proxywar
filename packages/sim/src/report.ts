import { BALANCE, type GameEvent, type MatchResult } from "@proxywar/core";
import type { MatchRecord } from "./runner";

const REASON: Record<MatchResult["reason"], string> = {
  earlyVictory: `조기 승리(과반 ${BALANCE.victory.majorityStreak}턴 유지)`,
  lastStanding: "마지막 생존",
  turnLimit: "턴 제한",
};

/** 자리별로 세는 영웅·건설 사건 */
const STAT_KINDS = ["levelUp", "heroInjured", "heroCaptured", "disobeyed", "hesitated", "built"] as const;
type StatKind = (typeof STAT_KINDS)[number];
const STAT_LABELS: Record<StatKind, string> = {
  levelUp: "레벨업",
  heroInjured: "부상",
  heroCaptured: "포로로 잡힘",
  disobeyed: "명령 불복",
  hesitated: "신중 후퇴",
  built: "건설",
};

export function renderReport(record: MatchRecord): string {
  const names = record.config.seats.map((s) => s.name);
  const name = (seat: number | null): string => (seat === null ? "중립" : names[seat]);
  const heroNames = new Map(record.initialState.heroes.map((h) => [h.id, h.name]));
  const heroName = (id: string): string => heroNames.get(id) ?? id;
  const last = record.turns[record.turns.length - 1];
  const result = record.result;
  const lines: string[] = [];

  lines.push(`# 매치 보고서: ${record.config.name}`, "");
  lines.push(`- 맵: ${record.config.map} · 시드: ${record.config.seed} · 진행 턴: ${last.turn}/${record.config.turns}`);
  lines.push(`- 종료: ${REASON[result.reason]} · 승자: ${name(result.winner)}`, "");

  lines.push(
    "## 최종 순위",
    "",
    "| 순위 | 자리 | 점수 | 거점 | 병력 | 건물 | 영웅 레벨 | 탈락 |",
    "|---|---|---|---|---|---|---|---|",
  );
  result.ranking.forEach((seat, i) => {
    const m = last.metrics[seat];
    lines.push(
      `| ${i + 1} | ${name(seat)} | ${result.scores[seat]} | ${m.nodes} | ${m.troops} | ${m.buildings} | ${m.heroLevels} | ${m.eliminated ? "예" : ""} |`,
    );
  });

  lines.push("", "## 거점 수 추이", "", `| 턴 | ${names.join(" | ")} |`, `|---|${names.map(() => "---").join("|")}|`);
  for (const t of record.turns) {
    if (t.turn % 10 !== 0 && t !== last) continue;
    lines.push(`| ${t.turn} | ${t.metrics.map((m) => m.nodes).join(" | ")} |`);
  }

  lines.push("", "## 주요 사건", "");
  for (const t of record.turns) {
    for (const e of t.events) {
      const text = describe(e, name, heroName);
      if (text) lines.push(`- T${t.turn} ${text}`);
    }
  }

  const counts = names.map(() => Object.fromEntries(STAT_KINDS.map((k) => [k, 0])) as Record<StatKind, number>);
  for (const t of record.turns) {
    for (const e of t.events) if (isStat(e)) counts[e.seat][e.kind] += 1;
  }
  lines.push(
    "",
    "## 영웅·건설 통계",
    "",
    `| 자리 | ${STAT_KINDS.map((k) => STAT_LABELS[k]).join(" | ")} |`,
    `|---|${STAT_KINDS.map(() => "---").join("|")}|`,
  );
  names.forEach((n, seat) => lines.push(`| ${n} | ${STAT_KINDS.map((k) => counts[seat][k]).join(" | ")} |`));

  const issues = record.turns.flatMap((t) =>
    t.issues.flatMap((list, seat) => list.map((i) => `- T${t.turn} ${name(seat)}: ${i.item}[${i.index}] ${i.reason}`)),
  );
  lines.push("", "## 무효 명령", "", ...(issues.length > 0 ? issues : ["없음"]), "");
  return lines.join("\n");
}

function isStat(e: GameEvent): e is Extract<GameEvent, { kind: StatKind }> {
  return (STAT_KINDS as readonly string[]).includes(e.kind);
}

function describe(e: GameEvent, name: (seat: number | null) => string, heroName: (id: string) => string): string | null {
  switch (e.kind) {
    case "captured":
      return `점령: ${e.node} (${name(e.from)} → ${name(e.to)})`;
    case "capitalMoved":
      return `수도 함락: ${name(e.seat)} ${e.from} → ${e.to ?? "없음"}`;
    case "capitalRestored":
      return `수도 재지정: ${name(e.seat)} → ${e.to}`;
    case "eliminated":
      return `탈락: ${name(e.seat)}`;
    case "heroCaptured":
      return `포로: ${heroName(e.hero)} (${name(e.seat)} → ${name(e.by)})`;
    case "heroReleased":
      return `석방: ${heroName(e.hero)} (${name(e.seat)})`;
    default:
      return null;
  }
}
