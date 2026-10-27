import { BALANCE } from "../data/balance";
import { compareText, neighbors, nodeType } from "../map";
import type { Rng } from "../rng";
import type { GameEvent, GameState, Hero, Mission, NodeId, NodeState, Resources, SeatId } from "../types";
import { attackPower, bestHero, defenders, heroModifier, sumTroops } from "./power";

/** troops에서 fraction만큼(올림) 잃는 수 */
function lose(troops: number, fraction: number): number {
  return Math.min(troops, Math.ceil(troops * fraction));
}

function shrinkHeroes(heroes: readonly Hero[], fraction: number): number {
  let lost = 0;
  for (const hero of heroes) {
    const l = lose(hero.troops, fraction);
    hero.troops -= l;
    lost += l;
  }
  return lost;
}

/** 전투 단계: 같은 자리·같은 목표의 공격을 한 부대로 묶어 시드 순서로 정산한다. */
export function resolveCombat(
  state: GameState,
  missions: ReadonlyMap<string, Mission>,
  rng: Rng,
  events: GameEvent[],
): void {
  const groups = new Map<string, Hero[]>();
  const committed = new Set<string>();
  for (const hero of state.heroes) {
    const mission = missions.get(hero.id);
    if (!mission || mission.kind !== "attack" || hero.status !== "active") continue;
    const key = `${hero.seat}|${mission.target}`;
    groups.set(key, [...(groups.get(key) ?? []), hero]);
    committed.add(hero.id);
  }
  for (const key of rng.shuffle([...groups.keys()].sort(compareText))) {
    const [seatText, target] = key.split("|");
    resolveAttack(state, Number(seatText), target, groups.get(key)!, committed, rng, events);
  }
}

function resolveAttack(
  state: GameState,
  seat: SeatId,
  target: NodeId,
  group: readonly Hero[],
  committed: Set<string>,
  rng: Rng,
  events: GameEvent[],
): void {
  const node = state.nodes[target];
  const attackers = group.filter(
    (h) => h.status === "active" && h.troops > 0 && neighbors(state.map, h.location).includes(target),
  );
  if (attackers.length === 0 || node.owner === seat) return;
  const defHeroes = defenders(state, target, committed);
  const attackTroops = sumTroops(attackers);
  const defendTroops = node.garrison + sumTroops(defHeroes);
  const spread = BALANCE.combat.randomSpread;
  const aPow = attackPower(attackers) * rng.range(1 - spread, 1 + spread);
  const dPow =
    defendTroops *
    heroModifier(bestHero(defHeroes)) *
    BALANCE.terrain[nodeType(state.map, target)] *
    rng.range(1 - spread, 1 + spread);
  const battle = {
    kind: "battle" as const,
    node: target,
    attacker: seat,
    heroes: attackers.map((h) => h.id),
    attackTroops,
    attackPower: aPow,
    defender: node.owner,
    defendTroops,
    defendPower: dPow,
  };
  if (aPow > dPow) {
    const attackerLoss = shrinkHeroes(attackers, (dPow / aPow) * BALANCE.combat.winnerLossFactor);
    const event = { ...battle, winner: "attacker" as const, attackerLoss, defenderLoss: 0 };
    events.push(event);
    capture(state, target, seat, attackers, events);
    // 점령한 영웅은 이제 그 거점의 방어자다(출발 거점에서만 빠진다)
    for (const hero of attackers) committed.delete(hero.id);
    // 방어 영웅은 후퇴하며 병력 일부를 지키므로 그만큼은 손실이 아니다
    event.defenderLoss = defendTroops - sumTroops(defHeroes);
  } else {
    const fraction = (aPow / dPow) * BALANCE.combat.winnerLossFactor;
    const garrisonLoss = lose(node.garrison, fraction);
    node.garrison -= garrisonLoss;
    const defenderLoss = garrisonLoss + shrinkHeroes(defHeroes, fraction);
    const attackerLoss = shrinkHeroes(attackers, BALANCE.combat.loserAttackerLossFactor);
    events.push({ ...battle, winner: "defender", attackerLoss, defenderLoss });
  }
}

function capture(state: GameState, target: NodeId, seat: SeatId, attackers: readonly Hero[], events: GameEvent[]): void {
  const node = state.nodes[target];
  const from = node.owner;
  node.owner = seat;
  node.garrison = 0;
  for (const hero of state.heroes) {
    if (hero.status === "active" && hero.location === target && hero.seat !== seat) routHero(state, hero, events);
  }
  for (const hero of attackers) hero.location = target;
  events.push({ kind: "captured", node: target, from, to: seat });
  if (from !== null && state.seats[from].capital === target) moveCapital(state, from, target, events);
}

function routHero(state: GameState, hero: Hero, events: GameEvent[]): void {
  const refuge: NodeId | undefined = neighbors(state.map, hero.location)
    .filter((n) => state.nodes[n].owner === hero.seat)
    .sort(compareText)[0];
  if (refuge === undefined) {
    hero.status = "out";
    hero.troops = 0;
  } else {
    hero.location = refuge;
    hero.troops = Math.floor((hero.troops * BALANCE.combat.routedKeepPercent) / 100);
  }
  events.push({ kind: "heroRouted", seat: hero.seat, hero: hero.id, to: refuge ?? null, troops: hero.troops });
}

function moveCapital(state: GameState, seat: SeatId, from: NodeId, events: GameEvent[]): void {
  const seatState = state.seats[seat];
  const t = seatState.treasury;
  const pct = BALANCE.capitalLossPercent;
  const lost: Resources = {
    gold: Math.floor((t.gold * pct) / 100),
    food: Math.floor((t.food * pct) / 100),
    material: Math.floor((t.material * pct) / 100),
    rare: Math.floor((t.rare * pct) / 100),
  };
  t.gold -= lost.gold;
  t.food -= lost.food;
  t.material -= lost.material;
  t.rare -= lost.rare;
  const next: NodeState | undefined = Object.values(state.nodes)
    .filter((n) => n.owner === seat)
    .sort((a, b) => b.garrison - a.garrison || compareText(a.id, b.id))[0];
  seatState.capital = next?.id ?? null;
  events.push({ kind: "capitalMoved", seat, from, to: seatState.capital, lost });
}
