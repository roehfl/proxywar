import { z } from "zod";
import presets from "./data/presets.json";
import type { Guidelines, InfoItem, InfoSettings, PresetName, Safeguards, SeatSettings, Tendency } from "./types";

export const PRESET_NAMES = [
  "balanced",
  "aggressive",
  "economic",
  "defensive",
  "diplomatic",
] as const satisfies readonly PresetName[];

export const INFO_ITEMS = [
  "enemyTroops",
  "enemyMoves",
  "diplomacy",
  "lastTurn",
  "heroDetail",
  "standings",
  "exploration",
] as const satisfies readonly InfoItem[];

/** 세팅의 1~5 값 */
export const LevelSchema = z.number().int().min(1).max(5);

const InfoItemSetupSchema = z.object({ on: z.boolean(), detail: LevelSchema }).partial().strict();

// 측정 도구라 모르는 키(오타)를 조용히 버리지 않고 거부한다(.strict)
const SettingsObjectSchema = z
  .object({
    preset: z.enum(PRESET_NAMES).default("balanced"),
    tendency: z
      .object({
        aggression: LevelSchema,
        expansion: LevelSchema,
        risk: LevelSchema,
        fidelity: LevelSchema,
        focus: LevelSchema,
        retaliation: LevelSchema,
      })
      .partial()
      .strict()
      .optional(),
    guidelines: z
      .object({ foodCaution: z.boolean(), rareFirst: z.boolean(), weakFirst: z.boolean() })
      .partial()
      .strict()
      .optional(),
    safeguards: z
      .object({ capitalMin: LevelSchema.nullable(), noAllyAttack: z.boolean() })
      .partial()
      .strict()
      .optional(),
    info: z
      .object({
        items: z
          .object({
            enemyTroops: InfoItemSetupSchema,
            enemyMoves: InfoItemSetupSchema,
            diplomacy: InfoItemSetupSchema,
            lastTurn: InfoItemSetupSchema,
            heroDetail: InfoItemSetupSchema,
            standings: InfoItemSetupSchema,
            exploration: InfoItemSetupSchema,
          })
          .partial()
          .strict()
          .optional(),
        memoLength: LevelSchema.optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

/** 자리 세팅: 프리셋 이름, 또는 프리셋(기본 balanced) + 바꿀 값 */
export const SettingsSetupSchema = z.union([z.enum(PRESET_NAMES), SettingsObjectSchema]);
export type SettingsSetup = z.infer<typeof SettingsSetupSchema>;

const PRESETS = presets as Record<PresetName, { tendency: Tendency; guidelines: Guidelines; safeguards: Safeguards }>;

/** 정보 구성 기본값: 모두 켬, 상세도 3, 메모 길이 3 */
function defaultInfo(): InfoSettings {
  const items = {} as InfoSettings["items"];
  for (const item of INFO_ITEMS) items[item] = { on: true, detail: 3 };
  return { items, memoLength: 3 };
}

/** 프리셋 이름 또는 프리셋 + 바꿀 값을 완전한 세팅으로 푼다 */
export function resolveSettings(input: SettingsSetup): SeatSettings {
  const spec: z.infer<typeof SettingsObjectSchema> = typeof input === "string" ? { preset: input } : input;
  const base = PRESETS[spec.preset];
  const info = defaultInfo();
  for (const item of INFO_ITEMS) Object.assign(info.items[item], spec.info?.items?.[item]);
  info.memoLength = spec.info?.memoLength ?? info.memoLength;
  return {
    preset: spec.preset,
    tendency: { ...base.tendency, ...spec.tendency },
    guidelines: { ...base.guidelines, ...spec.guidelines },
    safeguards: { ...base.safeguards, ...spec.safeguards },
    info,
  };
}
