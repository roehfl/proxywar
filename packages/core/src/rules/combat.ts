import { BALANCE, BUILDING_KINDS, terrainOf } from "../data/balance";
import { compareText, neighbors } from "../map";
import type { Rng } from "../rng";
import type { GameEvent, GameState, Hero, Mission, NodeId, NodeState, Resources, SeatId } from "../types";
import { gainExp } from "./growth";
import { rollInjury, routHero } from "./heroes";
import { attackPower, bestHero, defensePower, defenders, heroModifier, sumTroops } from "./power";
import { cautionRatio } from "./traits";

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
  /** 공격에 나섰거나 운영 중이라 서 있는 거점 방어에 끼지 않는 영웅 */
  const committed = new Set<string>();
  for (const hero of state.heroes) {
    const mission = missions.get(hero.id);
    if (!mission || hero.status !== "active") continue;
    if (mission.kind === "govern") committed.add(hero.id);
    if (mission.kind !== "attack") continue;
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
  const ready = group.filter(
    (h) => h.status === "active" && h.troops > 0 && neighbors(state.map, h.location).includes(target),
  );
  if (ready.length === 0 || node.owner === seat) return;
  const attackers = withoutHesitant(state, seat, target, ready, committed, events);
  if (attackers.length === 0) return;
  const defHeroes = defenders(state, target, committed);
  const attackTroops = sumTroops(attackers);
  const defendTroops = node.garrison + sumTroops(defHeroes);
  const spread = BALANCE.combat.randomSpread;
  const aPow = attackPower(attackers) * rng.range(1 - spread, 1 + spread);
  const dPow =
    defendTroops * heroModifier(bestHero(defHeroes)) * terrainOf(state, target) * rng.range(1 - spread, 1 + spread);
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
    awardExp(attackers, defHeroes);
    const kept = capture(state, target, seat, attackers, rng, events);
    // 점령한 영웅은 이제 그 거점의 방어자다(출발 거점에서만 빠진다)
    for (const hero of attackers) committed.delete(hero.id);
    // 방어 영웅은 후퇴하며 병력 일부를 지키므로 그만큼은 손실이 아니다
    event.defenderLoss = defendTroops - defHeroes.reduce((sum, h) => sum + (kept.get(h.id) ?? 0), 0);
  } else {
    const fraction = (aPow / dPow) * BALANCE.combat.winnerLossFactor;
    const garrisonLoss = lose(node.garrison, fraction);
    node.garrison -= garrisonLoss;
    const defenderLoss = garrisonLoss + shrinkHeroes(defHeroes, fraction);
    const attackerLoss = shrinkHeroes(attackers, BALANCE.combat.loserAttackerLossFactor);
    events.push({ ...battle, winner: "defender", attackerLoss, defenderLoss });
    awardExp(defHeroes, attackers);
    for (const hero of attackers) rollInjury(state, hero, rng, events);
  }
}

/** 신중 판정: 무작위 폭을 뺀 부대 공격력이 방어력 × 기준보다 낮으면 그 영웅은 물러나 제자리를 지킨다. */
function withoutHesitant(
  state: GameState,
  seat: SeatId,
  target: NodeId,
  ready: readonly Hero[],
  committed: Set<string>,
  events: GameEvent[],
): Hero[] {
  const power = attackPower(ready);
  const def = defensePower(state, target, committed);
  return ready.filter((hero) => {
    const ratio = cautionRatio(hero);
    if (ratio === 0 || power >= def * ratio) return true;
    committed.delete(hero.id);
    events.push({ kind: "hesitated", seat, hero: hero.id, node: target });
    return false;
  });
}

function awardExp(winners: readonly Hero[], losers: readonly Hero[]): void {
  for (const hero of [...winners, ...losers]) gainExp(hero, BALANCE.exp.battle);
  for (const hero of winners) gainExp(hero, BALANCE.exp.victory);
}

/** 점령: 건물 손상, 그 거점에 있던 남의 영웅(활동·부상) 후퇴·포로, 수도 이전. 후퇴한 영웅별로 지킨 병력을 돌려준다. */
function capture(
  state: GameState,
  target: NodeId,
  seat: SeatId,
  attackers: readonly Hero[],
  rng: Rng,
  events: GameEvent[],
): Map<string, number> {
  const node = state.nodes[target];
  const from = node.owner;
  node.owner = seat;
  node.garrison = 0;
  for (const kind of BUILDING_KINDS) node.buildings[kind] = Math.max(0, node.buildings[kind] - 1);
  const kept = new Map<string, number>();
  for (const hero of state.heroes) {
    if (hero.status !== "active" && hero.status !== "injured") continue;
    if (hero.location !== target || hero.seat === seat) continue;
    kept.set(hero.id, routHero(state, hero, seat, rng, events));
  }
  for (const hero of attackers) hero.location = target;
  events.push({ kind: "captured", node: target, from, to: seat });
  if (from !== null && state.seats[from].capital === target) moveCapital(state, from, target, events);
  return kept;
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
