import { BALANCE } from "../data/balance";
import { compareText } from "../map";
import type { Rng } from "../rng";
import type { GameEvent, GameState, Hero, Mission } from "../types";

/** 충성 판정(턴 처리 시작): 충성이 낮은 영웅은 확률적으로 이동·공격·운영 임무 대신 제자리를 지킨다. */
export function applyLoyalty(state: GameState, missions: Map<string, Mission>, rng: Rng, events: GameEvent[]): void {
  for (const hero of [...state.heroes].sort((a, b) => compareText(a.id, b.id))) {
    const mission = missions.get(hero.id);
    if (!mission || mission.kind === "defend") continue;
    const percent = BALANCE.traits.disobeyPercentByLoyalty[hero.traits.loyalty - 1];
    if (percent === 0 || rng.next() * 100 >= percent) continue;
    missions.set(hero.id, { kind: "defend", hero: hero.id });
    events.push({ kind: "disobeyed", seat: hero.seat, hero: hero.id, mission: mission.kind });
  }
}

/** 신중 기준: 무작위 폭을 뺀 부대 공격력이 방어력 × 이 값보다 낮으면 물러난다. 0이면 물러나지 않는다. */
export function cautionRatio(hero: Hero): number {
  return BALANCE.traits.cautionRatioByCaution[hero.traits.caution - 1];
}
