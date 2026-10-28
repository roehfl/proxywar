import { BALANCE } from "./data/balance";
import { bfs, compareText } from "./map";
import { allied } from "./relations";
import { troopCap } from "./rules/power";
import type { GameState, Hero, Mission, NodeId, Plan, SeatId } from "./types";

export type ConstraintRule = "guardCapital" | "expedition" | "noAllyAttack" | "capitalMin";

/** 제약이 고친 임무 하나 */
export interface Correction {
  hero: string;
  rule: ConstraintRule;
  before: Mission;
  after: Mission;
}

export interface ConfirmedPlan {
  plan: Plan;
  corrections: Correction[];
}

type Fix = (before: Mission, rule: ConstraintRule, after: Mission) => Mission;

/**
 * 확정: 검증을 통과한 계획에 제약(상시 명령 + 안전장치)을 적용한다. 직접 수정(사람 조작)은 1b에서 비어 있다.
 * 수도 방어 전담 → 원정 불허 → 동맹 공격 금지가 임무 종류를, 그 뒤 수도 최소 수비가 수도에서 꺼내는 병력을 고친다.
 * "현재 수도"는 확정 시점의 수도다. 꺼내기는 전투 앞 이동 단계에서 일어나 그 사이에 수도가 바뀌지 않는다.
 * 동맹은 확정 시점의 관계다. 같은 계획의 파기는 그 턴 외교 정산에서 효력이 생기므로 이번 턴 공격은 막힌다.
 * 후퇴 기준은 여기서 고치지 않고 전투의 물러남 판정에서 강제한다.
 */
export function confirmPlan(state: GameState, seat: SeatId, plan: Plan): ConfirmedPlan {
  const capital = state.seats[seat].capital;
  if (capital === null) return { plan, corrections: [] };
  const corrections: Correction[] = [];
  const fix: Fix = (before, rule, after) => {
    corrections.push({ hero: before.hero, rule, before, after });
    return after;
  };
  const ownDist = bfs(state.map, capital, (n) => state.nodes[n].owner === seat).dist;
  const mapDist = bfs(state.map, capital).dist;
  const far = (node: NodeId): boolean => (mapDist[node] ?? Infinity) > BALANCE.constraints.expeditionRange;
  const noAllyAttack = state.seats[seat].settings.safeguards.noAllyAttack;
  const allyNode = (node: NodeId): boolean => {
    const owner = state.nodes[node].owner;
    return owner !== null && allied(state, seat, owner);
  };
  const missions = plan.missions.map((mission) => {
    const hero = heroById(state, mission.hero);
    let m = mission;
    if (hero.standing.guardCapital) {
      // 수도로 가는 최단 경로(아군 거점만 지남)의 다음 거점으로 가는 이동만 둔다
      const from = ownDist[hero.location];
      const homeward = m.kind === "move" && from !== undefined && ownDist[m.to] === from - 1;
      if (m.kind !== "defend" && !homeward) m = fix(m, "guardCapital", { kind: "defend", hero: m.hero });
      else if (m.when !== undefined && m.when.react.kind !== "defend") m = fix(m, "guardCapital", withoutCondition(m));
    }
    if (!hero.standing.expedition) {
      const dest = m.kind === "move" ? m.to : m.kind === "attack" ? m.target : null;
      const react = m.when?.react;
      if (dest !== null && far(dest)) {
        m = fix(m, "expedition", { kind: "defend", hero: m.hero });
      } else if (react !== undefined && (react.kind === "advance" || react.kind === "reinforce") && far(react.node)) {
        m = fix(m, "expedition", withoutCondition(m));
      }
    }
    if (noAllyAttack) {
      const react = m.when?.react;
      if (m.kind === "attack" && allyNode(m.target)) {
        m = fix(m, "noAllyAttack", { kind: "defend", hero: m.hero });
      } else if (react?.kind === "advance" && allyNode(react.node)) {
        m = fix(m, "noAllyAttack", withoutCondition(m));
      }
    }
    return m;
  });
  limitCapitalDraws(state, seat, capital, missions, fix);
  return { plan: { ...plan, missions }, corrections };
}

/** 현재 수도에서 꺼내는 병력 합이 수도 수비대 − 최소 수비를 넘지 않게, 영웅 id 순으로 채우고 넘는 만큼 줄인다 */
function limitCapitalDraws(state: GameState, seat: SeatId, capital: NodeId, missions: Mission[], fix: Fix): void {
  const level = state.seats[seat].settings.safeguards.capitalMin;
  if (level === null) return;
  let allowance = Math.max(0, state.nodes[capital].garrison - level * BALANCE.constraints.capitalMinPerLevel);
  const order = missions
    .map((m, index) => ({ m, index }))
    .filter(
      ({ m }) =>
        (m.kind === "move" || m.kind === "attack") &&
        (m.draw ?? 0) > 0 &&
        heroById(state, m.hero).location === capital,
    )
    .sort((a, b) => compareText(a.m.hero, b.m.hero));
  for (const { m, index } of order) {
    if (m.kind !== "move" && m.kind !== "attack") continue;
    const hero = heroById(state, m.hero);
    // 통솔 상한 때문에 어차피 못 꺼내는 몫은 세지 않는다(이동 단계의 drawTroops와 같은 기준)
    const need = Math.max(0, Math.min(m.draw ?? 0, troopCap(hero) - hero.troops));
    const give = Math.min(need, allowance);
    allowance -= give;
    if (give < need) missions[index] = fix(m, "capitalMin", { ...m, draw: give });
  }
}

function heroById(state: GameState, id: string): Hero {
  const hero = state.heroes.find((h) => h.id === id);
  if (!hero) throw new Error(`unknown hero: ${id}`);
  return hero;
}

function withoutCondition(mission: Mission): Mission {
  const copy = { ...mission };
  delete copy.when;
  return copy;
}
