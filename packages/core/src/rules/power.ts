import { BALANCE, terrainOf } from "../data/balance";
import type { GameState, Hero, NodeId } from "../types";

/** 영웅 무력에 따른 방어 배수(공격은 attackModifier). 영웅이 없으면 1. */
export function heroModifier(hero: Hero | undefined): number {
  if (!hero) return 1;
  return 1 + (hero.stats.might - BALANCE.hero.baseStatByGrade[0]) * BALANCE.hero.mightBonusPerPoint;
}

/** 공격 배수: 무력 배수에 용맹 보정을 더한다. 영웅이 없으면 1. */
export function attackModifier(hero: Hero | undefined): number {
  if (!hero) return 1;
  return heroModifier(hero) + (hero.traits.valor - 3) * BALANCE.traits.valorBonusPerPoint;
}

/** 통솔 1당 병력 상한(성장으로 통솔이 소수가 되므로 내림) */
export function troopCap(hero: Hero): number {
  return Math.floor(hero.stats.command * BALANCE.hero.troopsPerCommand);
}

export function bestHero(heroes: readonly Hero[]): Hero | undefined {
  let best: Hero | undefined;
  for (const h of heroes) if (!best || h.stats.might > best.stats.might) best = h;
  return best;
}

export function sumTroops(heroes: readonly Hero[]): number {
  return heroes.reduce((sum, h) => sum + h.troops, 0);
}

/** 거점 주인의 영웅 중 그 거점에 있는 활동 영웅. exclude는 이번 턴 공격에 나섰거나 운영 중인 영웅. */
export function defenders(state: GameState, node: NodeId, exclude: ReadonlySet<string> = new Set()): Hero[] {
  const owner = state.nodes[node].owner;
  if (owner === null) return [];
  return state.heroes.filter(
    (h) => h.status === "active" && h.seat === owner && h.location === node && !exclude.has(h.id),
  );
}

/** 무작위 폭을 뺀 방어력. 규칙 참모의 추정과 신중 판정에도 쓴다. */
export function defensePower(state: GameState, node: NodeId, exclude: ReadonlySet<string> = new Set()): number {
  const heroes = defenders(state, node, exclude);
  const troops = state.nodes[node].garrison + sumTroops(heroes);
  return troops * heroModifier(bestHero(heroes)) * terrainOf(state, node);
}

/** 무작위 폭을 뺀 공격력(무력이 가장 높은 영웅의 공격 배수) */
export function attackPower(heroes: readonly Hero[]): number {
  return sumTroops(heroes) * attackModifier(bestHero(heroes));
}
