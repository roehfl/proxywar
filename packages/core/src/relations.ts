import type { GameState, Relation, RelationKind, SeatId } from "./types";

type WithDiplomacy = Pick<GameState, "diplomacy">;

function pair(x: SeatId, y: SeatId): [SeatId, SeatId] {
  return x < y ? [x, y] : [y, x];
}

/** 두 자리의 관계. 기록이 없으면 중립이다 */
export function relationOf(state: WithDiplomacy, x: SeatId, y: SeatId): Relation {
  const [a, b] = pair(x, y);
  return state.diplomacy.relations.find((r) => r.a === a && r.b === b) ?? { a, b, kind: "neutral", until: null };
}

export function allied(state: WithDiplomacy, x: SeatId, y: SeatId): boolean {
  return x !== y && relationOf(state, x, y).kind === "alliance";
}

/** 관계를 바꾼다. 중립은 목록에서 빼고, 목록은 (a, b) 순을 지킨다 */
export function setRelation(
  state: WithDiplomacy,
  x: SeatId,
  y: SeatId,
  kind: RelationKind,
  until: number | null = null,
): void {
  const [a, b] = pair(x, y);
  const rest = state.diplomacy.relations.filter((r) => !(r.a === a && r.b === b));
  if (kind !== "neutral") rest.push({ a, b, kind, until });
  state.diplomacy.relations = rest.sort((p, q) => p.a - q.a || p.b - q.b);
}
