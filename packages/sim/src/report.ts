import {
  BALANCE,
  type GameEvent,
  type GuidelineKind,
  type MatchResult,
  type PromiseEntry,
  type RelationKind,
  type StandingOrders,
} from "@proxywar/core";
import type { MatchRecord } from "./runner";

const REASON: Record<MatchResult["reason"], string> = {
  earlyVictory: `조기 승리(과반 ${BALANCE.victory.majorityStreak}턴 유지)`,
  lastStanding: "마지막 생존",
  turnLimit: "턴 제한",
};

/** 자리별로 세는 사건(물러남은 이유별)과 확정 수정 */
const STAT_COLUMNS = [
  "levelUp",
  "heroInjured",
  "heroCaptured",
  "disobeyed",
  "caution",
  "standing",
  "conditionMet",
  "built",
  "corrected",
] as const;
type StatColumn = (typeof STAT_COLUMNS)[number];
const STAT_LABELS: Record<StatColumn, string> = {
  levelUp: "레벨업",
  heroInjured: "부상",
  heroCaptured: "포로로 잡힘",
  disobeyed: "명령 불복",
  caution: "신중 후퇴",
  standing: "후퇴 기준",
  conditionMet: "조건 발동",
  built: "건설",
  corrected: "확정 수정",
};

const RELATION_LABELS: Record<RelationKind, string> = {
  neutral: "중립",
  war: "전쟁",
  nonAggression: "불가침",
  alliance: "동맹",
};

const BREAK_LABELS: Record<Extract<PromiseEntry, { kind: "broken" }>["how"], string> = {
  attack: "기습",
  war: "선전포고",
  break: "파기",
};

const GUIDELINE_LABELS: Record<GuidelineKind, string> = {
  foodCaution: "식량 자제",
  rareFirst: "희귀 우선",
  weakFirst: "약한 상대 우선",
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
    "## 세팅",
    "",
    "| 자리 | 프리셋 | 성향(공격·확장·위험·신의·내정군사·보복) | 지침 | 수도 최소 수비 | 상시 명령 |",
    "|---|---|---|---|---|---|",
  );
  for (const seat of record.initialState.seats) {
    const { preset, tendency: t, guidelines, safeguards } = seat.settings;
    const onGuidelines = (Object.keys(GUIDELINE_LABELS) as GuidelineKind[])
      .filter((k) => guidelines[k])
      .map((k) => GUIDELINE_LABELS[k]);
    const standing = record.initialState.heroes
      .filter((h) => h.seat === seat.id)
      .flatMap((h) => standingText(h.standing).map((text) => `${h.name} ${text}`));
    const tendency = [t.aggression, t.expansion, t.risk, t.fidelity, t.focus, t.retaliation].join("·");
    lines.push(
      `| ${seat.name} | ${preset} | ${tendency} | ${onGuidelines.join(", ") || "없음"} | ${safeguards.capitalMin ?? "끔"} | ${standing.join(", ") || "없음"} |`,
    );
  }
  lines.push("");

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

  const counts = names.map(() => Object.fromEntries(STAT_COLUMNS.map((k) => [k, 0])) as Record<StatColumn, number>);
  for (const t of record.turns) {
    for (const e of t.events) {
      const stat = statOf(e);
      if (stat) counts[stat[0]][stat[1]] += 1;
    }
    t.corrections.forEach((list, seat) => {
      counts[seat].corrected += list.length;
    });
  }
  lines.push(
    "",
    "## 영웅·건설·명령 통계",
    "",
    `| 자리 | ${STAT_COLUMNS.map((k) => STAT_LABELS[k]).join(" | ")} |`,
    `|---|${STAT_COLUMNS.map(() => "---").join("|")}|`,
  );
  names.forEach((n, seat) => lines.push(`| ${n} | ${STAT_COLUMNS.map((k) => counts[seat][k]).join(" | ")} |`));
  lines.push("", ...renderDiplomacy(record, name));

  const issues = record.turns.flatMap((t) =>
    t.issues.flatMap((list, seat) => list.map((i) => `- T${t.turn} ${name(seat)}: ${i.item}[${i.index}] ${i.reason}`)),
  );
  lines.push("", "## 무효 명령", "", ...(issues.length > 0 ? issues : ["없음"]), "");
  return lines.join("\n");
}

/** 외교: 자리별 제안 결과(낸 쪽 기준)와 깬 약속, 약속 기록, 마지막 관계 */
function renderDiplomacy(record: MatchRecord, name: (seat: number | null) => string): string[] {
  const counts = record.config.seats.map(() => ({
    delivered: 0,
    accepted: 0,
    rejected: 0,
    expired: 0,
    voided: 0,
    failed: 0,
    broken: 0,
  }));
  const promises: string[] = [];
  const relations = new Map<string, { seats: [number, number]; kind: RelationKind }>();
  for (const t of record.turns) {
    for (const e of t.events) {
      if (e.kind === "proposalDelivered") counts[e.from].delivered += 1;
      else if (e.kind === "proposalSettled") counts[e.from][e.result] += 1;
      else if (e.kind === "relationChanged") relations.set(e.seats.join(","), { seats: e.seats, kind: e.to });
      else if (e.kind === "promise") {
        if (e.entry.kind === "broken") counts[e.entry.by].broken += 1;
        promises.push(`- T${t.turn} ${promiseText(e.entry, name)}`);
      }
    }
  }
  const pairs = [...relations.values()]
    .filter((r) => r.kind !== "neutral")
    .sort((p, q) => p.seats[0] - q.seats[0] || p.seats[1] - q.seats[1])
    .map((r) => `| ${name(r.seats[0])} · ${name(r.seats[1])} | ${RELATION_LABELS[r.kind]} |`);
  return [
    "## 외교",
    "",
    "| 자리 | 제안 | 수락됨 | 거절됨 | 만료 | 무효 | 실패 | 깬 약속 |",
    "|---|---|---|---|---|---|---|---|",
    ...counts.map(
      (c, seat) =>
        `| ${name(seat)} | ${c.delivered} | ${c.accepted} | ${c.rejected} | ${c.expired} | ${c.voided} | ${c.failed} | ${c.broken} |`,
    ),
    "",
    "### 약속 기록",
    "",
    ...(promises.length > 0 ? promises : ["없음"]),
    "",
    "### 마지막 관계",
    "",
    ...(pairs.length > 0 ? ["| 쌍 | 관계 |", "|---|---|", ...pairs] : ["모두 중립"]),
  ];
}

function promiseText(entry: PromiseEntry, name: (seat: number | null) => string): string {
  const [a, b] = entry.seats;
  const pair = `${name(a)} · ${name(b)}`;
  switch (entry.kind) {
    case "formed":
      return `${RELATION_LABELS[entry.treaty]} 성립: ${pair}`;
    case "expired":
      return `불가침 만료: ${pair}`;
    case "broken":
      return `${RELATION_LABELS[entry.treaty]} 깸(${BREAK_LABELS[entry.how]}): ${name(entry.by)} — ${pair}`;
    case "declared":
      return `선전포고: ${name(entry.by)} → ${name(entry.by === a ? b : a)}`;
  }
}

function standingText(orders: StandingOrders): string[] {
  const out: string[] = [];
  if (orders.guardCapital) out.push("수도 방어");
  if (orders.retreatAt !== null) out.push(`후퇴 ${orders.retreatAt}`);
  if (!orders.expedition) out.push("원정 불허");
  return out;
}

/** 통계 표에서 세는 사건이면 [자리, 열] */
function statOf(e: GameEvent): [number, StatColumn] | null {
  switch (e.kind) {
    case "levelUp":
    case "heroInjured":
    case "heroCaptured":
    case "disobeyed":
    case "conditionMet":
    case "built":
      return [e.seat, e.kind];
    case "hesitated":
      return [e.seat, e.reason];
    default:
      return null;
  }
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
