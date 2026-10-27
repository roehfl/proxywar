import { BALANCE, recruitCap } from "./data/balance";
import { neighbors } from "./map";
import type { GameState, Mission, Plan, Recruit, SeatId } from "./types";

export interface PlanIssue {
  item: "mission" | "recruit" | "build";
  index: number;
  reason: string;
}

export interface CheckedPlan {
  plan: Plan;
  issues: PlanIssue[];
}

/** 잘못된 항목을 빼고 이유를 남긴다. 남은 항목은 processTurn이 그대로 믿는다. */
export function validatePlan(state: GameState, seat: SeatId, plan: Plan): CheckedPlan {
  const issues: PlanIssue[] = [];
  const missions: Mission[] = [];
  const used = new Set<string>();
  plan.missions.forEach((mission, index) => {
    const reason = missionIssue(state, seat, mission, used);
    if (reason) {
      issues.push({ item: "mission", index, reason });
    } else {
      used.add(mission.hero);
      missions.push(mission);
    }
  });
  const recruits: Recruit[] = [];
  const perNode: Record<string, number> = {};
  plan.recruits.forEach((recruit, index) => {
    const reason = recruitIssue(state, seat, recruit, perNode[recruit.node] ?? 0);
    if (reason) {
      issues.push({ item: "recruit", index, reason });
    } else {
      perNode[recruit.node] = (perNode[recruit.node] ?? 0) + recruit.amount;
      recruits.push(recruit);
    }
  });
  return { plan: { missions, recruits, builds: [] }, issues };
}

function missionIssue(state: GameState, seat: SeatId, mission: Mission, used: ReadonlySet<string>): string | null {
  const hero = state.heroes.find((h) => h.id === mission.hero);
  if (!hero) return "unknown hero";
  if (hero.seat !== seat) return "not your hero";
  if (hero.status !== "active") return "hero not active";
  if (used.has(hero.id)) return "duplicate hero";
  if (mission.kind === "defend" || mission.kind === "govern") return null;
  if (mission.draw !== undefined && (!Number.isInteger(mission.draw) || mission.draw < 0)) return "bad draw";
  const dest = mission.kind === "move" ? mission.to : mission.target;
  if (!Object.hasOwn(state.nodes, dest)) return "unknown node";
  if (!neighbors(state.map, hero.location).includes(dest)) return "not adjacent";
  const owner = state.nodes[dest].owner;
  if (mission.kind === "move" && owner !== seat) return "move target not own";
  if (mission.kind === "attack" && owner === seat) return "attack target is own";
  return null;
}

function recruitIssue(state: GameState, seat: SeatId, recruit: Recruit, already: number): string | null {
  if (!Object.hasOwn(state.nodes, recruit.node)) return "unknown node";
  if (state.nodes[recruit.node].owner !== seat) return "not own node";
  const cap = recruitCap(state, seat, recruit.node);
  if (cap === 0) return "cannot recruit here";
  const unit = BALANCE.recruit.unit;
  if (!Number.isInteger(recruit.amount) || recruit.amount <= 0 || recruit.amount % unit !== 0) return "bad amount";
  if (already + recruit.amount > cap) return "over cap";
  return null;
}
