import { BALANCE } from "./data/balance";
import { getMap } from "./map";
import type { MatchSetup } from "./setup";
import type { Buildings, GameMap, GameState, Hero, NodeState, SeatState } from "./types";

function noBuildings(): Buildings {
  return { production: 0, barracks: 0, walls: 0 };
}

export function initState(setup: MatchSetup): GameState {
  // 모듈의 맵 데이터를 상태가 공유하지 않도록 복사한다
  const map: GameMap = JSON.parse(JSON.stringify(getMap(setup.map)));
  if (setup.seats.length !== map.capitals.length) {
    throw new Error(`map ${map.id} needs ${map.capitals.length} seats, got ${setup.seats.length}`);
  }
  const nodes: Record<string, NodeState> = {};
  for (const node of map.nodes) {
    nodes[node.id] = {
      id: node.id,
      owner: null,
      garrison: BALANCE.neutralGarrison[node.type],
      buildings: noBuildings(),
    };
  }
  const seats: SeatState[] = setup.seats.map((seat, i) => {
    const capital = map.capitals[i];
    nodes[capital] = { id: capital, owner: i, garrison: BALANCE.start.capitalGarrison, buildings: noBuildings() };
    return { id: i, name: seat.name, capital, treasury: { ...BALANCE.start.treasury }, eliminatedAt: null };
  });
  const heroes: Hero[] = setup.seats.flatMap((seat, i) =>
    seat.heroes.map((h, j): Hero => {
      const base = BALANCE.hero.baseStatByGrade[h.grade - 1];
      return {
        id: `s${i}h${j}`,
        seat: i,
        name: h.name,
        grade: h.grade,
        growth: h.growth,
        stats: { might: base, command: base, admin: base, mobility: base },
        level: 1,
        exp: 0,
        traits: { loyalty: 3, caution: 3, valor: 3, ...h.traits },
        location: map.capitals[i],
        troops: 0,
        status: "active",
        injuredUntil: null,
        captor: null,
      };
    }),
  );
  return {
    matchSeed: setup.seed,
    turn: 0,
    maxTurns: setup.turns,
    map,
    nodes,
    seats,
    heroes,
    majority: { seat: null, streak: 0 },
    ended: null,
  };
}
