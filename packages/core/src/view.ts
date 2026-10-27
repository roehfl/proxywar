import { BALANCE } from "./data/balance";
import { bfs, compareText } from "./map";
import { ownedNodes, scoreOf } from "./summary";
import type { Board, GameMap, GameState, Hero, NodeId, NodeState, Resources, SeatId, SeatSettings } from "./types";

/** 내 영웅. 숨은 성장 계수는 내 것도 숨긴다(아웃라이어는 겉으로 표시되지 않는다) */
export type MyHero = Omit<Hero, "growth">;
/** 남의 영웅. 특성·경험치·숨은 성장 계수·상시 명령을 숨긴다 */
export type ForeignHero = Omit<Hero, "growth" | "traits" | "exp" | "standing">;

/** 모든 자리에 공개되는 정보 */
export interface PublicSeat {
  id: SeatId;
  name: string;
  nodes: number;
  score: number;
  eliminated: boolean;
}

/** 참모가 받는 자리별 보고서 데이터. 지금 상태의 스냅숏이고, 지난 턴 사건은 1c에서 더한다 */
export interface SeatView {
  seat: SeatId;
  turn: number;
  maxTurns: number;
  /** 맵 구조(거점 id·종류·인접)는 모두 안다 */
  map: GameMap;
  /** 보이는 거점만 */
  nodes: Record<NodeId, NodeState>;
  /** 내 영웅 전부(부상·포로·out 포함) */
  myHeroes: MyHero[];
  /** 보이는 거점에 있는 남의 활동·부상 영웅과 내가 잡은 포로 */
  foreignHeroes: ForeignHero[];
  capital: NodeId | null;
  treasury: Resources;
  settings: SeatSettings;
  /** 지난 계획의 참모 메모 */
  memo: string;
  seats: PublicSeat[];
}

/**
 * 자리의 시야: 아군 거점에서 1 + 첩보망 레벨 칸, 활동 영웅이 서 있는 거점에서 1칸(기동 15 이상이면 2칸).
 * 참모를 부를 때의 상태로 계산한다.
 */
export function visibleNodes(state: GameState, seat: SeatId): Set<NodeId> {
  const seen = new Set<NodeId>();
  const within = (from: NodeId, radius: number): void => {
    for (const [node, dist] of Object.entries(bfs(state.map, from).dist)) if (dist <= radius) seen.add(node);
  };
  const v = BALANCE.view;
  for (const node of ownedNodes(state, seat)) {
    within(node, v.nodeRadius + state.nodes[node].buildings.intel * v.intelRadiusPerLevel);
  }
  for (const hero of state.heroes) {
    if (hero.seat !== seat || hero.status !== "active") continue;
    within(hero.location, hero.stats.mobility >= v.scoutMobility ? v.scoutRadius : v.heroRadius);
  }
  return seen;
}

/** 자리의 시야. 상태와 공유하지 않는 복사본이다. */
export function viewOf(state: GameState, seat: SeatId): SeatView {
  const seen = visibleNodes(state, seat);
  const nodes: Record<NodeId, NodeState> = {};
  for (const id of [...seen].sort(compareText)) nodes[id] = state.nodes[id];
  const myHeroes: MyHero[] = state.heroes.filter((h) => h.seat === seat).map(({ growth: _growth, ...hero }) => hero);
  const foreignHeroes: ForeignHero[] = state.heroes
    .filter((h) =>
      h.status === "active" || h.status === "injured"
        ? h.seat !== seat && seen.has(h.location)
        : h.status === "captured" && h.captor === seat,
    )
    .map(({ growth: _growth, traits: _traits, exp: _exp, standing: _standing, ...hero }) => hero);
  const me = state.seats[seat];
  const view: SeatView = {
    seat,
    turn: state.turn,
    maxTurns: state.maxTurns,
    map: state.map,
    nodes,
    myHeroes,
    foreignHeroes,
    capital: me.capital,
    treasury: me.treasury,
    settings: me.settings,
    memo: me.memo,
    seats: state.seats.map((s) => ({
      id: s.id,
      name: s.name,
      nodes: ownedNodes(state, s.id).length,
      score: scoreOf(state, s.id),
      eliminated: s.eliminatedAt !== null,
    })),
  };
  return JSON.parse(JSON.stringify(view));
}

/** 시야를 전투력·병력 계산용 판으로 */
export function boardOf(view: SeatView): Board<MyHero | ForeignHero> {
  return { map: view.map, nodes: view.nodes, heroes: [...view.myHeroes, ...view.foreignHeroes] };
}
