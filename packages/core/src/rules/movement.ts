import type { GameEvent, GameState, Hero, Mission } from "../types";
import { troopCap } from "./power";

/** 영웅이 서 있는 거점 수비대에서 병력을 꺼낸다(수비대와 통솔 상한까지). */
export function drawTroops(state: GameState, hero: Hero, requested: number, events: GameEvent[]): void {
  const node = state.nodes[hero.location];
  const amount = Math.max(0, Math.min(requested, node.garrison, troopCap(hero) - hero.troops));
  if (amount === 0) return;
  node.garrison -= amount;
  hero.troops += amount;
  events.push({ kind: "drew", seat: hero.seat, hero: hero.id, node: node.id, amount });
}

/** 이동 단계: move·attack의 병력 꺼내기와 move의 이동. 공격 자체는 전투 단계에서 한다. */
export function resolveMovement(state: GameState, missions: ReadonlyMap<string, Mission>, events: GameEvent[]): void {
  for (const hero of state.heroes) {
    const mission = missions.get(hero.id);
    if (!mission || mission.kind === "defend" || hero.status !== "active") continue;
    drawTroops(state, hero, mission.draw ?? 0, events);
    if (mission.kind === "move") {
      const from = hero.location;
      hero.location = mission.to;
      events.push({ kind: "moved", seat: hero.seat, hero: hero.id, from, to: mission.to });
    }
  }
}
