export type SeatId = number;
export type NodeId = string;
export type NodeType = "capital" | "city" | "fortress" | "farm" | "mine" | "rare";

export interface Resources {
  gold: number;
  food: number;
  material: number;
  rare: number;
}

export interface MapNode {
  id: NodeId;
  type: NodeType;
}

export interface GameMap {
  id: string;
  /** capitals[seat] = 그 자리의 시작 수도 */
  capitals: NodeId[];
  nodes: MapNode[];
  edges: [NodeId, NodeId][];
}

export type BuildingKind = "production" | "barracks" | "walls";
/** 건물 종류별 레벨(0이면 없음) */
export type Buildings = Record<BuildingKind, number>;

export interface NodeState {
  id: NodeId;
  owner: SeatId | null;
  garrison: number;
  buildings: Buildings;
}

export interface HeroStats {
  might: number;
  command: number;
  admin: number;
  mobility: number;
}

export type TraitKind = "loyalty" | "caution" | "valor";
/** 1~5, 지정하지 않으면 3 */
export type Traits = Record<TraitKind, number>;

export type HeroStatus = "active" | "injured" | "captured" | "out";

export interface Hero {
  id: string;
  seat: SeatId;
  name: string;
  grade: number;
  growth: number;
  stats: HeroStats;
  level: number;
  exp: number;
  traits: Traits;
  location: NodeId;
  troops: number;
  status: HeroStatus;
  /** 부상이면 이 턴의 처리 끝에 회복한다 */
  injuredUntil: number | null;
  /** 포로면 잡고 있는 자리 */
  captor: SeatId | null;
}

export interface SeatState {
  id: SeatId;
  name: string;
  capital: NodeId | null;
  treasury: Resources;
  eliminatedAt: number | null;
}

export interface MatchResult {
  reason: "earlyVictory" | "lastStanding" | "turnLimit";
  winner: SeatId;
  ranking: SeatId[];
  /** scores[seat] */
  scores: number[];
}

export interface GameState {
  matchSeed: number;
  turn: number;
  maxTurns: number;
  map: GameMap;
  nodes: Record<NodeId, NodeState>;
  seats: SeatState[];
  heroes: Hero[];
  majority: { seat: SeatId | null; streak: number };
  ended: MatchResult | null;
}

export type Mission =
  | { kind: "move"; hero: string; to: NodeId; draw?: number }
  | { kind: "attack"; hero: string; target: NodeId; draw?: number }
  | { kind: "defend"; hero: string }
  | { kind: "govern"; hero: string };

export interface Recruit {
  node: NodeId;
  amount: number;
}

export interface Build {
  node: NodeId;
  building: BuildingKind;
}

export interface Plan {
  missions: Mission[];
  recruits: Recruit[];
  builds: Build[];
}

/** orders[seat] = 그 자리의 확정 명령 */
export type Orders = Plan[];

export type GameEvent =
  | { kind: "drew"; seat: SeatId; hero: string; node: NodeId; amount: number }
  | { kind: "moved"; seat: SeatId; hero: string; from: NodeId; to: NodeId }
  | {
      kind: "battle";
      node: NodeId;
      attacker: SeatId;
      heroes: string[];
      attackTroops: number;
      attackPower: number;
      defender: SeatId | null;
      defendTroops: number;
      defendPower: number;
      winner: "attacker" | "defender";
      attackerLoss: number;
      defenderLoss: number;
    }
  | { kind: "captured"; node: NodeId; from: SeatId | null; to: SeatId }
  | { kind: "heroRouted"; seat: SeatId; hero: string; to: NodeId; troops: number }
  | { kind: "capitalMoved"; seat: SeatId; from: NodeId; to: NodeId | null; lost: Resources }
  | { kind: "income"; seat: SeatId; gain: Resources }
  | { kind: "recruited"; seat: SeatId; node: NodeId; amount: number }
  | { kind: "recruitSkipped"; seat: SeatId; node: NodeId; reason: "notOwned" | "unaffordable" }
  | { kind: "upkeep"; seat: SeatId; food: number; deserted: number }
  | { kind: "eliminated"; seat: SeatId }
  | { kind: "matchEnded"; result: MatchResult }
  | { kind: "disobeyed"; seat: SeatId; hero: string; mission: Mission["kind"] }
  | { kind: "hesitated"; seat: SeatId; hero: string; node: NodeId }
  | { kind: "heroInjured"; seat: SeatId; hero: string; until: number }
  | { kind: "heroRecovered"; seat: SeatId; hero: string }
  | { kind: "heroCaptured"; seat: SeatId; hero: string; by: SeatId }
  | { kind: "heroReleased"; seat: SeatId; hero: string; to: NodeId | null }
  | { kind: "levelUp"; seat: SeatId; hero: string; level: number; stats: HeroStats }
  | { kind: "built"; seat: SeatId; node: NodeId; building: BuildingKind; level: number }
  | { kind: "buildSkipped"; seat: SeatId; node: NodeId; building: BuildingKind; reason: "notOwned" | "unaffordable" };
