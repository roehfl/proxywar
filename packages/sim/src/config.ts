import { MatchSetupSchema, SeatSetupSchema } from "@proxywar/core";
import { z } from "zod";

// 측정 도구라 설정 오타(모르는 키)를 조용히 버리지 않고 거부한다(.strict)

/** 1a는 규칙 참모만. 1c에서 llm을 더한다. */
export const StaffConfigSchema = z.object({ kind: z.literal("rule") }).strict();

export const SeatConfigSchema = SeatSetupSchema.extend({ staff: StaffConfigSchema }).strict();

export const RunConfigSchema = MatchSetupSchema.extend({
  /** 출력 폴더 이름에 들어가므로 영문·숫자·_·- 만 */
  name: z.string().regex(/^[\w-]+$/),
  seats: z.array(SeatConfigSchema).length(6),
}).strict();

export type StaffConfig = z.infer<typeof StaffConfigSchema>;
export type RunConfig = z.infer<typeof RunConfigSchema>;

export function parseRunConfig(raw: unknown): RunConfig {
  return RunConfigSchema.parse(raw);
}
