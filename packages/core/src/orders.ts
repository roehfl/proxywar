import { BALANCE, BUILDING_KINDS, recruitCap } from "./data/balance";
import { neighbors } from "./map";
import { allied, relationOf } from "./relations";
import { covers, totalOf, validAmounts } from "./resources";
import type { Build, GameState, Mission, NodeId, Plan, Proposal, Recruit, Response, SeatId } from "./types";

export interface PlanIssue {
  item: "mission" | "recruit" | "build" | "proposal" | "response";
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
  const proposals: Proposal[] = [];
  const targeted = new Set<SeatId>();
  (plan.proposals ?? []).forEach((proposal, index) => {
    const reason = proposalIssue(state, seat, proposal, targeted);
    if (reason) {
      issues.push({ item: "proposal", index, reason });
    } else {
      targeted.add(proposal.to);
      proposals.push(proposal);
    }
  });
  const responses: Response[] = [];
  const answered = new Set<string>();
  (plan.responses ?? []).forEach((response, index) => {
    const reason = responseIssue(state, seat, response, answered);
    if (reason) {
      issues.push({ item: "response", index, reason });
    } else {
      answered.add(response.id);
      responses.push(response);
    }
  });
  return { plan: { missions, recruits, builds, proposals, responses, memo: plan.memo }, issues };
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
  // 활동 중인 영웅은 아군이나 동맹 거점에 서 있으므로 방어에는 더 볼 것이 없다. 운영은 아군 거점에서만 한다
  if (mission.kind === "defend") return null;
  if (mission.kind === "govern") return state.nodes[location].owner === seat ? null : "govern not own node";
  if (mission.draw !== undefined && (!Number.isInteger(mission.draw) || mission.draw < 0)) return "bad draw";
  const dest = mission.kind === "move" ? mission.to : mission.target;
  if (!Object.hasOwn(state.nodes, dest)) return "unknown node";
  if (!neighbors(state.map, location).includes(dest)) return "not adjacent";
  const owner = state.nodes[dest].owner;
  if (mission.kind === "move" && owner !== seat && (owner === null || !allied(state, seat, owner))) {
    return "move target not own";
  }
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

/** 상대 하나에 턴당 1건. 관계는 계획 시점 것으로 본다 */
function proposalIssue(state: GameState, seat: SeatId, p: Proposal, targeted: ReadonlySet<SeatId>): string | null {
  if (!Number.isInteger(p.to) || p.to === seat || state.seats[p.to] === undefined) return "unknown seat";
  if (state.seats[p.to].eliminatedAt !== null) return "seat eliminated";
  if (targeted.has(p.to)) return "one proposal per seat";
  const relation = relationOf(state, seat, p.to).kind;
  const treasury = state.seats[seat].treasury;
  switch (p.kind) {
    case "nonAggression":
      if (!BALANCE.diplomacy.truceTurns.includes(p.turns)) return "bad turns";
      return relation === "neutral" || relation === "war" ? null : "already at peace";
    case "alliance":
      return relation === "alliance" ? "already allied" : null;
    case "trade":
      if (!validAmounts(p.give) || !validAmounts(p.get)) return "bad amount";
      if (totalOf(p.give) + totalOf(p.get) === 0) return "empty trade";
      return covers(treasury, p.give) ? null : "cannot afford";
    case "prisoners":
      if (!validAmounts(p.pay) || !validAmounts(p.ask)) return "bad amount";
      if (p.release.length + p.receive.length === 0) return "no prisoners";
      if (new Set([...p.release, ...p.receive]).size !== p.release.length + p.receive.length) return "duplicate hero";
      if (!p.release.every((id) => isPrisoner(state, id, p.to, seat))) return "not your prisoner";
      if (!p.receive.every((id) => isPrisoner(state, id, seat, p.to))) return "not their prisoner";
      return covers(treasury, p.pay) ? null : "cannot afford";
    case "declareWar":
      return relation === "war" ? "already at war" : null;
    case "breakTreaty":
      return relation === "nonAggression" || relation === "alliance" ? null : "no treaty";
    default:
      return "unknown proposal";
  }
}

/** owner 자리의 영웅 id가 captor에게 잡혀 있는가 */
export function isPrisoner(state: GameState, id: string, owner: SeatId, captor: SeatId): boolean {
  const hero = state.heroes.find((h) => h.id === id);
  return hero !== undefined && hero.seat === owner && hero.status === "captured" && hero.captor === captor;
}

function responseIssue(state: GameState, seat: SeatId, r: Response, answered: ReadonlySet<string>): string | null {
  const offer = state.diplomacy.pending.find((p) => p.id === r.id);
  if (offer === undefined || offer.to !== seat) return "unknown proposal";
  if (answered.has(r.id)) return "duplicate response";
  return typeof r.accept === "boolean" ? null : "bad response";
}
