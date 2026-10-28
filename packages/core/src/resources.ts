import type { ResourceAmounts, Resources } from "./types";

export const RESOURCE_KINDS: readonly (keyof Resources)[] = ["gold", "food", "material", "rare"];

/** 아는 자원만 있고 모두 0 이상 정수인가 */
export function validAmounts(amounts: ResourceAmounts): boolean {
  return Object.entries(amounts).every(
    ([kind, value]) => (RESOURCE_KINDS as readonly string[]).includes(kind) && Number.isInteger(value) && value! >= 0,
  );
}

export function totalOf(amounts: ResourceAmounts): number {
  return RESOURCE_KINDS.reduce((sum, kind) => sum + (amounts[kind] ?? 0), 0);
}

/** 금고가 amounts를 낼 수 있는가 */
export function covers(treasury: Resources, amounts: ResourceAmounts): boolean {
  return RESOURCE_KINDS.every((kind) => treasury[kind] >= (amounts[kind] ?? 0));
}

/** from 금고에서 to 금고로 amounts를 옮긴다(covers를 먼저 확인한다) */
export function transfer(from: Resources, to: Resources, amounts: ResourceAmounts): void {
  for (const kind of RESOURCE_KINDS) {
    const amount = amounts[kind] ?? 0;
    from[kind] -= amount;
    to[kind] += amount;
  }
}
