import { describe, expect, it } from "vitest";
import { INFO_ITEMS, PRESET_NAMES, SettingsSetupSchema, resolveSettings } from "../src/settings";

const DEFAULT_INFO = {
  items: Object.fromEntries(INFO_ITEMS.map((item) => [item, { on: true, detail: 3 }])),
  memoLength: 3,
};

describe("resolveSettings", () => {
  it("balanced는 1b-1 규칙 참모의 값(성향 3, 식량 자제, 수도 최소 수비 3)이다", () => {
    expect(resolveSettings("balanced")).toEqual({
      preset: "balanced",
      tendency: { aggression: 3, expansion: 3, risk: 3, fidelity: 3, focus: 3, retaliation: 3 },
      guidelines: { foodCaution: true, rareFirst: false, weakFirst: false },
      safeguards: { capitalMin: 3, noAllyAttack: false },
      info: DEFAULT_INFO,
    });
  });

  it("프리셋에 바꿀 값만 덮어쓴다", () => {
    const settings = resolveSettings(
      SettingsSetupSchema.parse({ preset: "aggressive", tendency: { risk: 2 }, safeguards: { capitalMin: null } }),
    );
    expect(settings.tendency).toEqual({ aggression: 5, expansion: 4, risk: 2, fidelity: 2, focus: 4, retaliation: 4 });
    expect(settings.guidelines).toEqual({ foodCaution: true, rareFirst: false, weakFirst: true });
    expect(settings.safeguards).toEqual({ capitalMin: null, noAllyAttack: false });
  });

  it("프리셋 없이 값만 주면 balanced 위에 덮는다", () => {
    const settings = resolveSettings(SettingsSetupSchema.parse({ guidelines: { rareFirst: true } }));
    expect(settings.preset).toBe("balanced");
    expect(settings.guidelines).toEqual({ foodCaution: true, rareFirst: true, weakFirst: false });
  });

  it("정보 구성은 항목별로 덮는다", () => {
    const settings = resolveSettings(
      SettingsSetupSchema.parse({ info: { items: { enemyTroops: { on: false } }, memoLength: 5 } }),
    );
    expect(settings.info.items.enemyTroops).toEqual({ on: false, detail: 3 });
    expect(settings.info.items.standings).toEqual({ on: true, detail: 3 });
    expect(settings.info.memoLength).toBe(5);
  });

  it.each(PRESET_NAMES)("프리셋 %s는 성향 6개가 모두 1~5 정수다", (name) => {
    const values = Object.values(resolveSettings(name).tendency);
    expect(values).toHaveLength(6);
    for (const v of values) expect(Number.isInteger(v) && v >= 1 && v <= 5).toBe(true);
  });

  it.each<[string, unknown]>([
    ["모르는 프리셋", "berserk"],
    ["범위 밖 성향", { tendency: { risk: 6 } }],
    ["모르는 성향", { tendency: { greed: 3 } }],
    ["수도 최소 수비 0", { safeguards: { capitalMin: 0 } }],
    ["모르는 정보 항목", { info: { items: { gossip: { on: true } } } }],
  ])("잘못된 세팅을 거부한다: %s", (_, raw) => {
    expect(() => SettingsSetupSchema.parse(raw)).toThrow();
  });
});
