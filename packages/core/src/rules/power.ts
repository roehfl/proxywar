import { BALANCE } from "../data/balance";
import { nodeType } from "../map";
import type { GameState, Hero, NodeId } from "../types";

/** 영웅 무력에 따른 공격·방어 배수. 영웅이 없으면 1. */
export function heroModifier(hero: Hero | undefined): number {
  if (!hero) return 1;
  return 1 + (hero.stats.might - BALANCE.hero.baseStatByGrade[0]) * BALANCE.hero.mightBonusPerPoint;
}

export function troopCap(hero: Hero): number {
  return hero.stats.command * BALANCE.hero.troopsPerCommand;
}

export function bestHero(heroes: readonly Hero[]): Hero | undefined {
  let best: Hero | undefined;
  for (const h of heroes) if (!best || h.stats.might > best.stats.might) best = h;
  return best;
}

export function sumTroops(heroes: readonly Hero[]): number {
  return heroes.reduce((sum, h) => sum + h.troops, 0);
}

/** 거점 주인의 영웅 중 그 거점에 있는 활동 영웅. exclude는 이번 턴 공격에 나선 영웅. */
export function defenders(state: GameState, node: NodeId, exclude: ReadonlySet<string> = new Set()): Hero[] {
  const owner = state.nodes[node].owner;
  if (owner === null) return [];
  return state.heroes.filter(
    (h) => h.status === "active" && h.seat === owner && h.location === node && !exclude.has(h.id),
  );
}

/** 무작위 폭을 뺀 방어력. 규칙 참모의 추정에도 쓴다. */
export function defensePower(state: GameState, node: NodeId, exclude: ReadonlySet<string> = new Set()): number {
  const heroes = defenders(state, node, exclude);
  const troops = state.nodes[node].garrison + sumTroops(heroes);
  return troops * heroModifier(bestHero(heroes)) * BALANCE.terrain[nodeType(state.map, node)];
}

/** 무작위 폭을 뺀 공격력 */
export function attackPower(heroes: readonly Hero[]): number {
  return sumTroops(heroes) * heroModifier(bestHero(heroes));
}
