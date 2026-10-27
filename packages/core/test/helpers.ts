import type { MatchSetup } from "../src/setup";
import { initState } from "../src/state";
import type { GameState, Hero, Orders } from "../src/types";

export function makeSetup(seed = 1): MatchSetup {
  return {
    map: "ring6",
    turns: 120,
    seed,
    seats: Array.from({ length: 6 }, (_, i) => ({
      name: `Seat${i}`,
      heroes: Array.from({ length: 5 }, (_, j) => ({ name: `H${i}${j}`, grade: 3, growth: 1 })),
    })),
  };
}

export function makeState(seed = 1): GameState {
  return initState(makeSetup(seed));
}

export function heroOf(state: GameState, id: string): Hero {
  const hero = state.heroes.find((h) => h.id === id);
  if (!hero) throw new Error(`no hero ${id}`);
  return hero;
}

export function noOrders(): Orders {
  return Array.from({ length: 6 }, () => ({ missions: [], recruits: [] }));
}
