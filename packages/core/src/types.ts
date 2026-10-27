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

export type BuildingKind = "production" | "barracks" | "walls" | "intel";
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

/** 영웅별 상시 명령: 게임이 강제한다 */
export interface StandingOrders {
  /** 수도 방어 전담 */
  guardCapital: boolean;
  /** 후퇴 기준 1~5, null이면 없음 */
  retreatAt: number | null;
  /** 원정 허용(끄면 현재 수도에서 원정 범위 밖으로 가거나 치지 못한다) */
  expedition: boolean;
}

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
  standing: StandingOrders;
  location: NodeId;
  troops: number;
  status: HeroStatus;
  /** 부상이면 이 턴의 처리 끝에 회복한다 */
  injuredUntil: number | null;
  /** 포로면 잡고 있는 자리 */
  captor: SeatId | null;
}

export type TendencyKind = "aggression" | "expansion" | "risk" | "fidelity" | "focus" | "retaliation";
/** 성향 1~5. focus는 1 내정 ~ 5 군사다 */
export type Tendency = Record<TendencyKind, number>;

export type GuidelineKind = "foodCaution" | "rareFirst" | "weakFirst";
/** 지침: 참모에게 알리기만 하고 게임은 강제하지 않는다 */
export type Guidelines = Record<GuidelineKind, boolean>;

/** 안전장치: 게임이 강제한다 */
export interface Safeguards {
  /** 수도 최소 수비 1~5(수비대 × 10), null이면 끔 */
  capitalMin: number | null;
  /** 동맹 공격 금지(1b-3에서 쓴다) */
  noAllyAttack: boolean;
}

export type InfoItem =
  | "enemyTroops"
  | "enemyMoves"
  | "diplomacy"
  | "lastTurn"
  | "heroDetail"
  | "standings"
  | "exploration";

/** 정보 구성: 켠 항목만 보고서 글에 들어간다(1c) */
export interface InfoSettings {
  items: Record<InfoItem, { on: boolean; detail: number }>;
  /** 참모 메모 길이 1~5 */
  memoLength: number;
}

export type PresetName = "balanced" | "aggressive" | "economic" | "defensive" | "diplomatic";

/** 자리 세팅(상시 명령은 영웅마다 Hero.standing에 있다) */
export interface SeatSettings {
  preset: PresetName;
  tendency: Tendency;
  guidelines: Guidelines;
  safeguards: Safeguards;
  info: InfoSettings;
}

export interface SeatState {
  id: SeatId;
  name: string;
  capital: NodeId | null;
  treasury: Resources;
  eliminatedAt: number | null;
  settings: SeatSettings;
  /** 지난 계획의 참모 메모(다음 시야에 들어간다) */
  memo: string;
}

/** 전투력·병력 계산에 쓰는 영웅 정보 */
export type BoardHero = Pick<Hero, "id" | "seat" | "status" | "location" | "troops" | "stats">;

/** 전투력·모집 상한·병력 계산에 쓰는 판. GameState와 시야(boardOf)가 모두 맞는다 */
export interface Board<H extends BoardHero = BoardHero> {
  map: GameMap;
  nodes: Record<NodeId, NodeState>;
  heroes: readonly H[];
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

/** 조건부 명령의 조건. 판정은 이동 뒤·전투 앞 한 스냅숏에서 한다 */
export type Trigger =
  | { kind: "enemyNear" }
  | { kind: "targetEmpty"; node?: NodeId }
  | { kind: "ratioBelow"; value: number }
  | { kind: "allyAttacked"; node: NodeId };

/** 조건이 참일 때 임무 대신 하는 반응 */
export type Reaction =
  | { kind: "retreat" }
  | { kind: "advance"; node: NodeId }
  | { kind: "reinforce"; node: NodeId }
  | { kind: "defend" };

export interface Condition {
  trigger: Trigger;
  react: Reaction;
}

export type Mission = (
  | { kind: "move"; hero: string; to: NodeId; draw?: number }
  | { kind: "attack"; hero: string; target: NodeId; draw?: number }
  | { kind: "defend"; hero: string }
  | { kind: "govern"; hero: string }
) & { when?: Condition };

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
  /** 다음 호출의 자신에게 남기는 참모 메모 */
  memo?: string;
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
  | { kind: "capitalRestored"; seat: SeatId; to: NodeId }
  | { kind: "income"; seat: SeatId; gain: Resources }
  | { kind: "recruited"; seat: SeatId; node: NodeId; amount: number }
  | { kind: "recruitSkipped"; seat: SeatId; node: NodeId; reason: "notOwned" | "unaffordable" }
  | { kind: "upkeep"; seat: SeatId; food: number; deserted: number }
  | { kind: "eliminated"; seat: SeatId }
  | { kind: "matchEnded"; result: MatchResult }
  | { kind: "disobeyed"; seat: SeatId; hero: string; mission: Mission["kind"] }
  | { kind: "hesitated"; seat: SeatId; hero: string; node: NodeId; reason: "caution" | "standing" }
  | { kind: "heroInjured"; seat: SeatId; hero: string; until: number }
  | { kind: "heroRecovered"; seat: SeatId; hero: string }
  | { kind: "heroCaptured"; seat: SeatId; hero: string; by: SeatId }
  | { kind: "heroReleased"; seat: SeatId; hero: string; to: NodeId | null }
  | { kind: "levelUp"; seat: SeatId; hero: string; level: number; stats: HeroStats }
  | { kind: "built"; seat: SeatId; node: NodeId; building: BuildingKind; level: number }
  | { kind: "buildSkipped"; seat: SeatId; node: NodeId; building: BuildingKind; reason: "notOwned" | "unaffordable" }
  | { kind: "conditionMet"; seat: SeatId; hero: string; trigger: Trigger["kind"]; react: Reaction["kind"] };
