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

export interface NodeState {
  id: NodeId;
  owner: SeatId | null;
  garrison: number;
}

export interface HeroStats {
  might: number;
  command: number;
  admin: number;
  mobility: number;
}

export interface Hero {
  id: string;
  seat: SeatId;
  name: string;
  grade: number;
  growth: number;
  stats: HeroStats;
  location: NodeId;
  troops: number;
  status: "active" | "out";
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
  | { kind: "defend"; hero: string };

export interface Recruit {
  node: NodeId;
  amount: number;
}

export interface Plan {
  missions: Mission[];
  recruits: Recruit[];
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
  | { kind: "heroRouted"; seat: SeatId; hero: string; to: NodeId | null; troops: number }
  | { kind: "capitalMoved"; seat: SeatId; from: NodeId; to: NodeId | null; lost: Resources }
  | { kind: "income"; seat: SeatId; gain: Resources }
  | { kind: "recruited"; seat: SeatId; node: NodeId; amount: number }
  | { kind: "recruitSkipped"; seat: SeatId; node: NodeId; reason: "notOwned" | "unaffordable" }
  | { kind: "upkeep"; seat: SeatId; food: number; deserted: number }
  | { kind: "eliminated"; seat: SeatId }
  | { kind: "matchEnded"; result: MatchResult };
