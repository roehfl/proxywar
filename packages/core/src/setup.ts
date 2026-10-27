import { z } from "zod";
import { BALANCE } from "./data/balance";

const TraitValueSchema = z.number().int().min(1).max(5);

/** 지정하지 않은 특성은 3(보통)이다 */
export const TraitsSetupSchema = z
  .object({ loyalty: TraitValueSchema, caution: TraitValueSchema, valor: TraitValueSchema })
  .partial()
  .strict();

export const HeroSetupSchema = z
  .object({
    name: z.string().min(1),
    grade: z.number().int().min(1).max(5),
    growth: z.number().positive().default(1),
    traits: TraitsSetupSchema.default({}),
  })
  .strict()
  .refine((h) => Object.keys(h.traits).length <= BALANCE.hero.traitSlotsByGrade[h.grade - 1], {
    message: "too many traits for grade",
    path: ["traits"],
  });

export const SeatSetupSchema = z.object({
  name: z.string().min(1),
  heroes: z.array(HeroSetupSchema).length(5),
});

export const MatchSetupSchema = z.object({
  map: z.string().default("ring6"),
  turns: z.number().int().min(1).max(120).default(120),
  seed: z.number().int(),
  seats: z.array(SeatSetupSchema).length(6),
});

export type MatchSetup = z.infer<typeof MatchSetupSchema>;
