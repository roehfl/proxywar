import { BALANCE } from "../data/balance";
import { compareText } from "../map";
import type { Rng } from "../rng";
import type { GameEvent, GameState, Hero } from "../types";

const STATS = ["might", "command", "admin", "mobility"] as const;

export function levelCap(hero: Hero): number {
  return BALANCE.hero.levelCapByGrade[hero.grade - 1];
}

/** 지금 레벨에서 다음 레벨까지 필요한 경험치 */
export function expToNext(hero: Hero): number {
  return BALANCE.hero.expPerLevel * hero.level;
}

/** 경험치를 쌓는다. 레벨 상한이면 쌓지 않는다. */
export function gainExp(hero: Hero, amount: number): void {
  if (hero.level < levelCap(hero)) hero.exp += amount;
}

/** 생산·성장 단계 끝: 경험치가 찬 영웅을 영웅 id 순으로 레벨업한다. */
export function resolveGrowth(state: GameState, rng: Rng, events: GameEvent[]): void {
  for (const hero of [...state.heroes].sort((a, b) => compareText(a.id, b.id))) {
    while (hero.level < levelCap(hero) && hero.exp >= expToNext(hero)) {
      hero.exp -= expToNext(hero);
      hero.level += 1;
      raiseStats(hero, rng);
      events.push({ kind: "levelUp", seat: hero.seat, hero: hero.id, level: hero.level, stats: { ...hero.stats } });
    }
    if (hero.level >= levelCap(hero)) hero.exp = 0;
  }
}

/** 능력치마다 등급 기준 상승폭 × 숨은 성장 계수 × 무작위 폭 */
function raiseStats(hero: Hero, rng: Rng): void {
  const base = BALANCE.hero.gainPerLevelByGrade[hero.grade - 1] * hero.growth;
  const spread = BALANCE.hero.gainSpread;
  for (const stat of STATS) hero.stats[stat] += base * rng.range(1 - spread, 1 + spread);
}
