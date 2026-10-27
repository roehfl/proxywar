import { BALANCE } from "../data/balance";
import { ownedNodes, scoreOf } from "../summary";
import type { GameEvent, GameState, MatchResult, SeatId } from "../types";

/** 탈락 → 과반 연속 기록 → 종료 판정 */
export function resolveVictory(state: GameState, events: GameEvent[]): void {
  for (const seat of state.seats) {
    if (seat.eliminatedAt !== null || ownedNodes(state, seat.id).length > 0) continue;
    seat.eliminatedAt = state.turn;
    seat.capital = null;
    for (const hero of state.heroes) {
      if (hero.seat !== seat.id) continue;
      hero.status = "out";
      hero.troops = 0;
    }
    events.push({ kind: "eliminated", seat: seat.id });
  }
  updateMajority(state);
  const result = checkEnd(state);
  if (result) {
    state.ended = result;
    events.push({ kind: "matchEnded", result });
  }
}

function updateMajority(state: GameState): void {
  const need = Math.floor(state.map.nodes.length / 2) + 1;
  const leader = state.seats.find((s) => s.eliminatedAt === null && ownedNodes(state, s.id).length >= need);
  const seat = leader ? leader.id : null;
  if (seat !== null && seat === state.majority.seat) state.majority.streak += 1;
  else state.majority = { seat, streak: seat === null ? 0 : 1 };
}

function checkEnd(state: GameState): MatchResult | null {
  if (state.majority.seat !== null && state.majority.streak >= BALANCE.victory.majorityStreak) {
    return finish(state, "earlyVictory", state.majority.seat);
  }
  const alive = state.seats.filter((s) => s.eliminatedAt === null);
  if (alive.length <= 1) return finish(state, "lastStanding", alive.length === 1 ? alive[0].id : null);
  if (state.turn >= state.maxTurns) return finish(state, "turnLimit", null);
  return null;
}

function finish(state: GameState, reason: MatchResult["reason"], forced: SeatId | null): MatchResult {
  const scores = state.seats.map((s) => scoreOf(state, s.id));
  const ranking = [...state.seats]
    .sort((a, b) => {
      if (a.id === forced) return -1;
      if (b.id === forced) return 1;
      const ea = a.eliminatedAt ?? Number.POSITIVE_INFINITY;
      const eb = b.eliminatedAt ?? Number.POSITIVE_INFINITY;
      if (ea !== eb) return eb - ea;
      return scores[b.id] - scores[a.id] || a.id - b.id;
    })
    .map((s) => s.id);
  return { reason, winner: ranking[0], ranking, scores };
}
