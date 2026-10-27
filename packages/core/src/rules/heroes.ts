import { BALANCE } from "../data/balance";
import { compareText, neighbors } from "../map";
import type { Rng } from "../rng";
import type { GameEvent, GameState, Hero, SeatId } from "../types";

/** 전투에서 진 영웅의 부상 확률(%): 기본값에 용맹 보정을 더하고 0~100으로 자른다 */
export function injuryPercent(hero: Hero): number {
  const percent = BALANCE.injury.percent + (hero.traits.valor - 3) * BALANCE.traits.valorInjuryPercentPerPoint;
  return Math.max(0, Math.min(100, percent));
}

/** 확률대로 부상시킨다. 부상한 영웅의 병력은 서 있는 아군 거점 수비대로 들어간다. */
export function rollInjury(state: GameState, hero: Hero, rng: Rng, events: GameEvent[]): void {
  if (rng.next() * 100 >= injuryPercent(hero)) return;
  const node = state.nodes[hero.location];
  if (node.owner === hero.seat) node.garrison += hero.troops;
  hero.troops = 0;
  hero.status = "injured";
  hero.injuredUntil = state.turn + BALANCE.injury.turns;
  events.push({ kind: "heroInjured", seat: hero.seat, hero: hero.id, until: hero.injuredUntil });
}

/**
 * 거점을 잃은 영웅(활동·부상). 인접 아군 거점(id 순 첫째)으로 병력 일부를 데리고 후퇴하고,
 * 활동 중이던 영웅은 부상 판정을 받는다. 갈 곳이 없으면 captor의 포로가 된다.
 * 후퇴하며 지킨 병력(포로면 0)을 돌려준다.
 */
export function routHero(state: GameState, hero: Hero, captor: SeatId, rng: Rng, events: GameEvent[]): number {
  const refuge = neighbors(state.map, hero.location)
    .filter((n) => state.nodes[n].owner === hero.seat)
    .sort(compareText)[0];
  if (refuge === undefined) {
    hero.status = "captured";
    hero.captor = captor;
    hero.troops = 0;
    hero.injuredUntil = null;
    events.push({ kind: "heroCaptured", seat: hero.seat, hero: hero.id, by: captor });
    return 0;
  }
  hero.location = refuge;
  hero.troops = Math.floor((hero.troops * BALANCE.combat.routedKeepPercent) / 100);
  const kept = hero.troops;
  events.push({ kind: "heroRouted", seat: hero.seat, hero: hero.id, to: refuge, troops: kept });
  if (hero.status === "active") rollInjury(state, hero, rng, events);
  return kept;
}

/** 부상 기간이 끝난 영웅을 활동으로 되돌린다(턴 처리 끝). */
export function recoverHeroes(state: GameState, events: GameEvent[]): void {
  for (const hero of state.heroes) {
    if (hero.status !== "injured" || hero.injuredUntil === null || hero.injuredUntil > state.turn) continue;
    hero.status = "active";
    hero.injuredUntil = null;
    events.push({ kind: "heroRecovered", seat: hero.seat, hero: hero.id });
  }
}

/** captor가 잡고 있던 포로를 풀어 각자의 현재 수도로 보낸다. 수도가 없으면 out. */
export function releasePrisoners(state: GameState, captor: SeatId, events: GameEvent[]): void {
  for (const hero of state.heroes) {
    if (hero.status !== "captured" || hero.captor !== captor) continue;
    const home = state.seats[hero.seat].capital;
    hero.captor = null;
    hero.troops = 0;
    if (home === null) {
      hero.status = "out";
    } else {
      hero.status = "active";
      hero.location = home;
    }
    events.push({ kind: "heroReleased", seat: hero.seat, hero: hero.id, to: home });
  }
}
