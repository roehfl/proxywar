import { BALANCE } from "../data/balance";
import { bfs, compareText, neighbors } from "../map";
import { allied } from "../relations";
import type { Condition, GameEvent, GameState, Hero, Mission, NodeId } from "../types";
import { attackPower, defenders, defensePower } from "./power";

/**
 * 조건 판정·반응 단계(충성 판정과 이동 뒤, 전투 앞).
 * 조건은 모두 같은 스냅숏(이동 뒤 상태, 충성 판정 뒤 임무)에서 판정하고, 그다음 반응을 한꺼번에 적용한다.
 * 반응이 다른 조건을 다시 부르지 않는다. 그래서 영웅 처리 순서와 결과가 무관하다.
 */
export function resolveConditions(state: GameState, missions: Map<string, Mission>, events: GameEvent[]): void {
  const committed = committedOf(state, missions);
  const fired: { hero: Hero; when: Condition }[] = [];
  for (const hero of state.heroes) {
    const mission = missions.get(hero.id);
    if (hero.status !== "active" || mission?.when === undefined) continue;
    if (triggered(state, missions, committed, hero, mission, mission.when)) fired.push({ hero, when: mission.when });
  }
  for (const { hero, when } of fired) {
    events.push({ kind: "conditionMet", seat: hero.seat, hero: hero.id, trigger: when.trigger.kind, react: when.react.kind });
    missions.set(hero.id, react(state, hero, when, events));
  }
}

/** 공격·운영 임무를 받아 서 있는 거점 방어에 끼지 않는 활동 영웅(전투 단계와 같은 기준) */
function committedOf(state: GameState, missions: ReadonlyMap<string, Mission>): Set<string> {
  const out = new Set<string>();
  for (const hero of state.heroes) {
    const kind = missions.get(hero.id)?.kind;
    if (hero.status === "active" && (kind === "attack" || kind === "govern")) out.add(hero.id);
  }
  return out;
}

function triggered(
  state: GameState,
  missions: ReadonlyMap<string, Mission>,
  committed: ReadonlySet<string>,
  hero: Hero,
  mission: Mission,
  when: Condition,
): boolean {
  const trigger = when.trigger;
  switch (trigger.kind) {
    case "enemyNear":
      // 동맹(턴 시작 관계)의 영웅은 적으로 세지 않는다
      return neighbors(state.map, hero.location).some((n) =>
        state.heroes.some(
          (h) =>
            h.seat !== hero.seat &&
            !allied(state, h.seat, hero.seat) &&
            h.status === "active" &&
            h.troops > 0 &&
            h.location === n,
        ),
      );
    case "targetEmpty": {
      const node = trigger.node ?? (mission.kind === "attack" ? mission.target : null);
      if (node === null) return false;
      return state.nodes[node].garrison === 0 && defenders(state, node, committed).length === 0;
    }
    case "ratioBelow": {
      if (mission.kind !== "attack") return false;
      const target = mission.target;
      const group = state.heroes.filter((h) => {
        const m = missions.get(h.id);
        return (
          h.seat === hero.seat &&
          h.status === "active" &&
          h.troops > 0 &&
          m?.kind === "attack" &&
          m.target === target &&
          neighbors(state.map, h.location).includes(target)
        );
      });
      const ratio = BALANCE.conditions.ratioByValue[trigger.value - 1];
      return attackPower(group) < defensePower(state, target, committed) * ratio;
    }
    case "allyAttacked":
      return (
        state.nodes[trigger.node].owner === hero.seat &&
        state.heroes.some((h) => {
          const m = missions.get(h.id);
          return h.seat !== hero.seat && h.status === "active" && m?.kind === "attack" && m.target === trigger.node;
        })
      );
  }
}

function react(state: GameState, hero: Hero, when: Condition, events: GameEvent[]): Mission {
  const stay: Mission = { kind: "defend", hero: hero.id };
  const r = when.react;
  switch (r.kind) {
    case "defend":
      return stay;
    case "advance":
      return state.nodes[r.node].owner === hero.seat ? stay : { kind: "attack", hero: hero.id, target: r.node, draw: 0 };
    case "reinforce":
      if (state.nodes[r.node].owner === hero.seat) relocate(hero, r.node, events);
      return stay;
    case "retreat": {
      const to = retreatTo(state, hero);
      if (to !== null) relocate(hero, to, events);
      return stay;
    }
  }
}

function relocate(hero: Hero, to: NodeId, events: GameEvent[]): void {
  const from = hero.location;
  hero.location = to;
  events.push({ kind: "moved", seat: hero.seat, hero: hero.id, from, to });
}

/** 이웃 아군 거점 중 현재 수도에 가장 가까운 곳(아군 거점만 지난 거리, 닿지 않으면 가장 멂, 동률은 id). 없으면 null */
function retreatTo(state: GameState, hero: Hero): NodeId | null {
  const capital = state.seats[hero.seat].capital;
  const dist = capital === null ? {} : bfs(state.map, capital, (n) => state.nodes[n].owner === hero.seat).dist;
  const far = (n: NodeId): number => dist[n] ?? Infinity;
  const refuge = neighbors(state.map, hero.location)
    .filter((n) => state.nodes[n].owner === hero.seat)
    .sort((a, b) => far(a) - far(b) || compareText(a, b))[0];
  return refuge ?? null;
}
