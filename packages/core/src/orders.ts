import { BALANCE, BUILDING_KINDS, recruitCap } from "./data/balance";
import { neighbors } from "./map";
import type { Build, GameState, Mission, NodeId, Plan, Recruit, SeatId } from "./types";

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
  const builds: Build[] = [];
  const builtAt = new Set<NodeId>();
  plan.builds.forEach((build, index) => {
    const reason = buildIssue(state, seat, build, builtAt);
    if (reason) {
      issues.push({ item: "build", index, reason });
    } else {
      builtAt.add(build.node);
      builds.push(build);
    }
  });
  return { plan: { missions, recruits, builds, memo: plan.memo }, issues };
}

function missionIssue(state: GameState, seat: SeatId, mission: Mission, used: ReadonlySet<string>): string | null {
  const hero = state.heroes.find((h) => h.id === mission.hero);
  if (!hero) return "unknown hero";
  if (hero.seat !== seat) return "not your hero";
  if (hero.status !== "active") return "hero not active";
  if (used.has(hero.id)) return "duplicate hero";
  const reason = targetIssue(state, seat, hero.location, mission);
  if (reason !== null || mission.when === undefined) return reason;
  return conditionIssue(state, mission, mission.kind === "move" ? mission.to : hero.location);
}

function targetIssue(state: GameState, seat: SeatId, location: NodeId, mission: Mission): string | null {
  // 활동 중인 영웅은 늘 아군 거점에 서 있으므로 방어·운영에는 더 볼 것이 없다
  if (mission.kind === "defend" || mission.kind === "govern") return null;
  if (mission.draw !== undefined && (!Number.isInteger(mission.draw) || mission.draw < 0)) return "bad draw";
  const dest = mission.kind === "move" ? mission.to : mission.target;
  if (!Object.hasOwn(state.nodes, dest)) return "unknown node";
  if (!neighbors(state.map, location).includes(dest)) return "not adjacent";
  const owner = state.nodes[dest].owner;
  if (mission.kind === "move" && owner !== seat) return "move target not own";
  if (mission.kind === "attack" && owner === seat) return "attack target is own";
  return null;
}

/**
 * 조건의 거점은 영웅이 조건을 판정받는 자리(at: 이동이면 도착 거점, 아니면 지금 위치)의 이웃이어야 한다.
 * 아군 거점 피습은 at 자신도 된다. 병력 비율은 공격 임무에만 붙는다.
 */
function conditionIssue(state: GameState, mission: Mission, at: NodeId): string | null {
  const { trigger, react } = mission.when!;
  const near = (node: NodeId): boolean => Object.hasOwn(state.nodes, node) && neighbors(state.map, at).includes(node);
  const bad = "bad condition";
  switch (trigger.kind) {
    case "enemyNear":
      break;
    case "targetEmpty":
      if (trigger.node === undefined ? mission.kind !== "attack" : !near(trigger.node)) return bad;
      break;
    case "ratioBelow":
      if (mission.kind !== "attack" || !Number.isInteger(trigger.value) || trigger.value < 1 || trigger.value > 5) {
        return bad;
      }
      break;
    case "allyAttacked":
      if (trigger.node !== at && !near(trigger.node)) return bad;
      break;
    default:
      return bad;
  }
  switch (react.kind) {
    case "retreat":
    case "defend":
      return null;
    case "advance":
    case "reinforce":
      return near(react.node) ? null : bad;
    default:
      return bad;
  }
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

/** 건설은 거점마다 턴당 하나다 */
function buildIssue(state: GameState, seat: SeatId, build: Build, builtAt: ReadonlySet<NodeId>): string | null {
  if (!Object.hasOwn(state.nodes, build.node)) return "unknown node";
  if (state.nodes[build.node].owner !== seat) return "not own node";
  if (!BUILDING_KINDS.includes(build.building)) return "unknown building";
  if (builtAt.has(build.node)) return "one build per node";
  if (state.nodes[build.node].buildings[build.building] >= BALANCE.buildings.maxLevel) return "max level";
  return null;
}
