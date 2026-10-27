import { z } from "zod";

export const HeroSetupSchema = z.object({
  name: z.string().min(1),
  grade: z.number().int().min(1).max(5),
  growth: z.number().positive().default(1),
}).strict();

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
