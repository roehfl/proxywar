# 1b-1 영웅·건물 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 영웅이 매치 안에서 경험치로 성장하고 특성(충성·신중·용맹)대로 움직이며 패하면 부상·포로가 되고, 거점에 생산·병영·성벽을 지을 수 있으며, 점수에 거점 발전도와 영웅 성장이 들어간다. 규칙 참모 6명 매치가 이 규칙으로 끝까지 돈다.

**Architecture:** 1a 구조(직렬화 가능한 상태 + `processTurn` 순수 함수 + 규칙 참모)를 그대로 쓴다. 상태에 영웅 레벨·경험치·특성·부상·포로와 거점 건물 레벨을 더하고, 새 규칙은 단계 함수로 나눠 `rules/growth.ts`(경험치·레벨업), `rules/traits.ts`(충성·신중), `rules/heroes.ts`(부상·후퇴·포로·회복·석방)에 둔다. `processTurn`의 순서는 충성 판정 → 이동 → 전투 → 생산·건설·모집·유지비 → 레벨업 → 회복 → 탈락·종료다. 규칙 참모는 운영 임무와 건설을 더 낸다.

**Tech Stack:** 1a와 같다(Node 24.11.1, TypeScript 7.0.2, zod 4.6.7, vitest 5.0.5, tsx 4.23.15). 새 의존성 없음.

**설계서:** `docs/superpowers/specs/2026-10-27-sim-core-design.md`(승인 2026-10-27) 하위 프로젝트 1의 1b를 세 조각으로 나눈 것 중 첫째다(결정 기록 `docs/design/brainstorm-log.md`의 "1b는 세 조각으로 나눈다"). 게임 규칙은 `docs/superpowers/specs/2026-10-27-game-rules-design.md` 2·3.5·5절. 1a 계획 `docs/superpowers/plans/2026-10-27-sim-core-1a-skeleton.md`의 머리말 "실행 중 변경"도 현행 규칙이다.

**1b-1 범위:** 영웅 레벨·경험치·레벨업 성장(등급 기준 상승폭 × 숨은 성장 계수 × 무작위 폭), 레벨 상한, 특성 3종과 등급별 슬롯, 충성 불복·신중 후퇴·용맹 보정, 부상과 회복, 포로와 석방, 운영 임무, 건물 3종(생산·병영·성벽)과 건설 명령, 점령 시 건물 손상, 점수 확장, 규칙 참모의 운영·건설, 보고서의 영웅·건설 통계.

**1b-1에서 하지 않는 것:** 시야·보고서 데이터(참모는 여전히 전체 상태를 본다), 세팅 5종·프리셋, 참모 메모 칸과 정보 구성, 제약·확정 순서, 조건부 명령(이상 1b-2), 외교 6종과 포로 교환(1b-3), 정보 건물(아래 제안표 참고), LLM·`replay`(1c), `batch`·`report` 명령(1d).

**설계서 대비 변경(이유 포함):**
1. **정보 건물은 1b-1에 넣지 않는다.** 정보 건물의 효과는 보고서 길이 예산(1c)과 시야(1b-2)에만 닿아서, 지금 넣으면 효과 없는 건물이 된다. 첩보망은 시야와 함께 1b-2에, 참모부는 예산과 함께 1c에 둔다.
2. **기동 능력치는 1b-1에서 쓰지 않는다.** 설계서 용도가 "이동·정찰"이고 이동은 한 칸 고정이라, 정찰(시야)과 함께 1b-2에서 쓴다. 레벨업으로 오르기는 한다.
3. **1a의 "후퇴할 곳이 없으면 out"은 포로로 바뀐다.** `out`은 탈락한 자리의 영웅에게만 남는다.
4. **임무에 `govern`(거점 운영)을 더한다.** 게임 규칙 설계서 3.5의 "거점 운영" 임무이고, 내정 능력치를 쓰는 곳이다.
5. **난수는 용도별로 나눈다.** 전투는 1a와 같은 `(매치 시드, 턴, "turn")`, 충성 판정은 `"loyalty"`, 레벨업은 `"growth"`다. 부상 판정은 전투 난수에서 뽑으므로 첫 부상 판정 뒤의 전투 값은 1a와 달라진다.
6. **규칙 참모 3단계가 바뀐다.** 1a에서는 내부 거점의 약한 영웅도 채울 병력이 없으면 빈손으로 전선에 나갔다. 이제는 운영 임무를 받는다. 전선 영웅은 그대로 방어, 내부의 강한 영웅은 그대로 전선으로 간다.
7. **매치 기록 `version`이 2가 된다.** 상태·지표·이벤트 모양이 바뀌었기 때문이다.
8. **(실행 중 반영) 리뷰 지적으로 테스트 5개를 보강했다.**
   - 부상한 방어 영웅의 후퇴 손실 계산(시드 1~40), 신중으로 물러난 영웅의 방어 합류, 같은 거점 운영 영웅 중 최고 내정만 세기를 새로 테스트한다.
   - 석방 테스트는 시작 위치를 x0으로 바꿔 수도 귀환을 실제로 확인한다.
   - 규칙 참모 건설 테스트는 도시를 더해 건설 금 차감이 모집량을 바꾸는지 확인한다. 두 테스트는 소스를 일부러 틀리게 바꿨을 때 실패하는 것도 확인했다.
   - 소스는 바꾸지 않았다. 테스트는 131개에서 134개가 됐다. Task 10 Step 2에서는 "금 15 아래면 짓지 않는다" 테스트가 구현 전에도 통과했다(건설이 늘 빈 배열이었기 때문).
9. **(실행 중 반영) 리뷰가 찾은 규칙 문구의 빈칸. 앞의 둘은 사용자 확인 대기이고, 지금 동작을 그대로 둔다.**
   - 공격하러 나간 영웅의 출발 거점이 같은 전투 단계에서 먼저 함락되면, 그 영웅은 싸우기 전에 후퇴·부상·포로 판정을 받는다. 1a의 `out`과 같은 순서 의존이다.
   - 운영하던 거점을 잃고 후퇴한 영웅이 부상하지 않았으면, 피난한 거점에서 운영 보정과 경험치를 받는다. 제안표 문구("경제 단계 시점에 서 있는 아군 거점")대로다.
   - 기록만 해 둔다: 운영 영웅이 후퇴하며 잃은 병력은 전투 이벤트의 `defenderLoss`에 들어가지 않는다. 서로의 포로를 잡은 두 자리가 같은 턴에 탈락하면 석방 사건이 한쪽에만 남는다(최종 상태는 같다). 후퇴하다 부상한 영웅이 맡긴 병력이 수도 이전 대상을 바꿀 수 있다.
10. **(실행 중 반영) 실측: 매치가 1a보다 길어졌다.**
   - `rule6` 시드 1은 120턴 턴 제한으로 끝났다(승자 Ember, Cobalt T91 탈락). `rule6-traits` 시드 1도 턴 제한이다(승자 Ember, Dune T88 탈락).
   - 두 매치 모두 정체는 없다. 자리 간 점령이 각각 415건·352건이고, 10턴 넘게 끊긴 구간이 없다.
   - 리뷰어가 시드 1~8을 비교했다. 1a 코드는 8개 모두 T65~99에 조기 승리했고, 지금 코드는 3개가 턴 제한, 5개가 T74~116에 조기 승리했다.
   - 건설·운영·부상·성장을 하나씩 꺼 봐도 턴 제한 비율은 조금만 줄어든다. 한 가지 원인이 아니라 여러 변경이 쌓인 결과다.
   - 시드 1에서는 Briar가 과반을 11턴 지키다 끊겼다. 수치 조정은 1d 범위라 하지 않았다.

**세부 규칙·수치(제안, 사용자 검토 대상).** 결정 기록에 따라 이 계획에서 처음 제안하고, 구현 전에 사용자가 검토해 확정한다(Task 1 Step 1). 수치는 1d 측정으로 조정한다.

| 항목 | 제안 |
|---|---|
| 운영 `govern` | 영웅이 서 있는 아군 거점의 생산을 `내정 × 3%` 늘린다(3성 42%). 같은 거점에 여럿이면 내정이 가장 높은 한 명만 센다. 대상은 경제 단계 시점에 영웅이 서 있는 아군 거점이다. 운영 중인 영웅은 그 거점 방어에 끼지 않는다. 운영 1턴에 경험치 5 |
| 경험치 | 전투에 나선 영웅(공격·방어 모두) 10, 이긴 쪽 10 더. 운영 5 |
| 레벨 | 1에서 시작. 다음 레벨까지 `20 × 현재 레벨`. 상한 1성 10, 2성 11, 3성 12, 4성 13, 5성 14. 상한에 닿으면 경험치를 버린다 |
| 레벨업 상승 | 능력치 4종마다 `등급 기준 상승폭 × 숨은 성장 계수 × 무작위(0.5~1.5)`. 기준 상승폭은 1성 0.5, 2성 0.6, 3성 0.7, 4성 0.8, 5성 0.9. 능력치는 소수로 두고 통솔의 병력 상한만 내림한다 |
| 특성 | 충성·신중·용맹, 값 1~5, 지정하지 않으면 3. 지정할 수 있는 특성 수(슬롯)는 1성 1, 2성 1, 3성 2, 4성 2, 5성 3 |
| 충성 | 턴 처리 시작에 이동·공격·운영 임무가 제자리 방어로 바뀔 확률. 충성 1 20%, 2 10%, 3~5 0% |
| 신중 | 공격 직전, 무작위 폭을 뺀 부대 공격력이 방어력 × 기준보다 낮으면 그 영웅은 공격하지 않고 제자리를 지킨다. 기준은 신중 4 1.0, 5 1.2, 1~3은 없음. 판정은 부대 전체 힘으로 한 번 한다 |
| 용맹 | 공격 배수에 `(용맹 − 3) × 0.03`을 더한다(부대에서 무력이 가장 높은 영웅의 값). 부상 확률에 `(용맹 − 3) × 10%p`를 더한다 |
| 부상 | 공격에서 진 영웅과, 거점을 잃고 후퇴한 활동 영웅이 확률 30%(+용맹 보정, 0~100으로 자름)로 부상한다. 남은 병력은 서 있는 아군 거점 수비대로 들어간다. 다음 3번의 턴 처리 동안 임무를 받지 못하고, 3번째 처리 끝에 회복한다 |
| 포로 | 거점을 잃은 영웅(활동·부상)에게 후퇴할 인접 아군 거점이 없으면 그 거점을 점령한 자리의 포로가 된다. 병력 0. 잡은 자리가 탈락하면 풀려나 자기 자리의 현재 수도로 돌아간다(수도가 없으면 out). 포로 교환은 1b-3 |
| 건물 | 거점마다 생산·병영·성벽, 각 레벨 0~3. 한 거점에 턴당 하나. 레벨 L로 올리는 비용 금 `20 × L`, 자재 `30 × L`. 경제 단계에서 생산 뒤·모집 앞에 짓는다. 효과는 다음 턴부터(생산은 다음 생산, 병영은 다음 계획의 모집 상한, 성벽은 다음 전투) |
| 생산 건물 | 그 거점 생산 `+ 레벨 × 50%`(운영 보정과 더한 뒤 자원별 내림) |
| 병영 | 그 거점 모집 상한 `+ 레벨 × 10`. 병영이 있으면 농장·광산·요새·희귀 자원지에서도 모집할 수 있다 |
| 성벽 | 그 거점 지형 방어 배수 `+ 레벨 × 0.1` |
| 점령 시 건물 | 종류마다 한 레벨씩 내려간다 |
| 점수 | `거점 × 10 + 병력 ÷ 10(내림) + 건물 레벨 합 × 3 + (영웅 레벨 − 1) 합 × 2`. 영웅 항은 out이 아닌 영웅(부상·포로 포함)만 센다 |
| 규칙 참모 건설 | 턴당 최대 1건. 현재 수도 생산 → 아군 농장·광산 생산(id 순) → 현재 수도 성벽 → 현재 수도 병영 순으로, 최고 레벨이 아니고 자재가 되며 짓고 나서 금이 15 이상 남는 첫 후보. 금은 모집보다 먼저 쓴다 |
| 규칙 참모 운영 | 전선이 아닌 거점에서, 채울 병력이 없어 약한(병력이 통솔 상한의 절반 미만) 영웅은 운영한다 |

**실행 주체:** 모든 단계를 에이전트가 실행한다(공통 G-004). 명령은 모두 `D:/game/proxywar`에서 실행한다.

**브랜치·커밋:** 실행 시작 때 사용자에게 묻는다. 승인되면 `sim-core-1b-1` 브랜치를 만들고, 첫 커밋으로 설계 문서(결정 기록·AGENTS.md·이 계획)를 넣은 뒤 Task마다 끝에서 커밋한다. 승인이 없으면 커밋 단계를 건너뛴다. push·main 머지는 하지 않는다. 검증 출력은 실제로 읽고 Expected와 대조한 뒤에만 다음 단계로 간다(공통 G-006).

**기준선(2026-10-27 확인):** `npm test` → `Test Files  12 passed`, `Tests  83 passed`. `npm run typecheck` → 오류 없음.

---

## 파일 구조

```
packages/core/
  src/types.ts                   Modify: 건물·특성·영웅 상태·운영 임무·건설 명령·새 이벤트
  src/data/balance.json          Modify: hero·exp·traits·injury·govern·buildings·score 수치
  src/data/balance.ts            Modify: BUILDING_KINDS, recruitCap(병영), terrainOf, buildCost
  src/setup.ts                   Modify: 영웅 특성 설정과 슬롯 검사
  src/state.ts                   Modify: 건물·레벨·특성·부상·포로 초기값
  src/orders.ts                  Modify: 운영 임무, 건설 명령 검증
  src/rules/power.ts             Modify: attackModifier(용맹), troopCap 내림, 성벽
  src/rules/movement.ts          Modify: 운영 임무는 움직이지 않는다
  src/rules/growth.ts            Create: gainExp, resolveGrowth(레벨업)
  src/rules/traits.ts            Create: applyLoyalty, cautionRatio
  src/rules/heroes.ts            Create: injuryPercent, rollInjury, routHero, recoverHeroes, releasePrisoners
  src/rules/combat.ts            Modify: 운영 영웅 방어 제외, 신중 후퇴, 전투 경험치, 부상·포로, 건물 손상
  src/rules/economy.ts           Modify: 운영 보정·경험치, 생산 건물, 건설
  src/rules/victory.ts           Modify: 탈락 때 포로 석방
  src/rules/turn.ts              Modify: 충성·성장·회복 단계 연결
  src/summary.ts                 Modify: buildingLevels, heroLevels, 점수 확장
  src/staff/rule-staff.ts        Modify: 용맹 반영 추정, 운영, 건설
  src/index.ts                   Modify: 새 공개 API
  test/helpers.ts                Modify: 특성·건설 기본값
  test/growth.test.ts            Create
  test/traits.test.ts            Create
  test/heroes.test.ts            Create
  test/{state,power,movement,orders,combat,economy,turn,rule-staff}.test.ts   Modify
packages/sim/
  configs/rule6-traits.json      Create: 등급·특성이 섞인 규칙 참모 6명
  src/runner.ts                  Modify: 기록 version 2, 건물·영웅 레벨 지표
  src/report.ts                  Modify: 순위표 열, 포로·석방 사건, 영웅·건설 통계
  test/runner.test.ts            Modify
  test/report.test.ts            Modify
```

---

### Task 1: 상태 타입·수치·초기 상태

**Files:**
- Modify: `packages/core/src/types.ts`, `packages/core/src/data/balance.json`, `packages/core/src/setup.ts`, `packages/core/src/state.ts`, `packages/core/src/orders.ts`, `packages/core/src/rules/movement.ts`, `packages/core/src/staff/rule-staff.ts`, `packages/sim/src/runner.ts`
- Test: `packages/core/test/helpers.ts`, `packages/core/test/state.test.ts`, `packages/core/test/combat.test.ts`, `packages/core/test/movement.test.ts`, `packages/core/test/orders.test.ts`

- [ ] **Step 1: 제안표 검토와 브랜치·커밋 여부를 사용자에게 묻는다**

머리말의 "세부 규칙·수치" 표를 보여 주고 확정 또는 수정을 받는다. 수정이 있으면 이 계획의 해당 표·코드·테스트 기대값을 먼저 고친다. 확정되면 `docs/design/brainstorm-log.md`의 "1b의 세부 규칙…" 줄 바로 아래에 다음 줄을 넣는다(수정이 있었으면 그 내용으로):
```
- **1b-1 세부 규칙 확정**: `docs/superpowers/plans/2026-10-27-sim-core-1b-1-heroes-buildings.md` 머리말 제안표대로(운영 임무, 경험치·레벨 상한·레벨업 상승폭, 특성 3종과 슬롯, 부상 3턴·포로, 건물 3종 레벨 0~3, 점수 확장). 정보 건물은 1b-2(첩보망)·1c(참모부)로, 기동 능력치의 용도는 1b-2로 미룬다.
```
브랜치·커밋이 승인되면:
```bash
git -C D:/game/proxywar switch -c sim-core-1b-1
git -C D:/game/proxywar add AGENTS.md docs/design/brainstorm-log.md docs/superpowers/plans/2026-10-27-sim-core-1b-1-heroes-buildings.md
git -C D:/game/proxywar commit -m "docs: 1b 세 조각 분할과 1b-1 영웅·건물 계획"
```
Expected: `Switched to a new branch 'sim-core-1b-1'`, 커밋 1개(파일 3개).

- [ ] **Step 2: `state.test.ts`를 새 초기 상태에 맞춰 바꾸고 특성 설정 테스트를 더한다**

`packages/core/test/state.test.ts` 전체:
```ts
import { describe, expect, it } from "vitest";
import { MatchSetupSchema } from "../src/setup";
import { initState } from "../src/state";
import { scoreOf } from "../src/summary";
import { heroOf, makeSetup, makeState } from "./helpers";

const NO_BUILDINGS = { production: 0, barracks: 0, walls: 0 };

describe("MatchSetupSchema", () => {
  it("올바른 설정을 받아들이고 성장 계수·특성 기본값을 채운다", () => {
    const raw = JSON.parse(JSON.stringify(makeSetup()));
    delete raw.seats[0].heroes[0].growth;
    delete raw.seats[0].heroes[0].traits;
    const parsed = MatchSetupSchema.parse(raw);
    expect(parsed.seats[0].heroes[0].growth).toBe(1);
    expect(parsed.seats[0].heroes[0].traits).toEqual({});
  });

  it("자리가 6개가 아니면 거부한다", () => {
    const raw = makeSetup();
    expect(() => MatchSetupSchema.parse({ ...raw, seats: raw.seats.slice(0, 5) })).toThrow();
  });

  it.each<[string, number, object]>([
    ["1성에 특성 2개", 1, { loyalty: 2, valor: 4 }],
    ["3성에 특성 3개", 3, { loyalty: 2, caution: 4, valor: 4 }],
    ["범위 밖 값", 5, { valor: 6 }],
    ["모르는 특성", 5, { greed: 3 }],
  ])("특성 설정 오류를 거부한다: %s", (_, grade, traits) => {
    const raw = JSON.parse(JSON.stringify(makeSetup()));
    Object.assign(raw.seats[0].heroes[0], { grade, traits });
    expect(() => MatchSetupSchema.parse(raw)).toThrow();
  });

  it("등급 슬롯 수만큼 특성을 받는다(5성 3개)", () => {
    const raw = JSON.parse(JSON.stringify(makeSetup()));
    Object.assign(raw.seats[0].heroes[0], { grade: 5, traits: { loyalty: 1, caution: 5, valor: 2 } });
    expect(MatchSetupSchema.parse(raw).seats[0].heroes[0].traits).toEqual({ loyalty: 1, caution: 5, valor: 2 });
  });
});

describe("initState", () => {
  const state = makeState();

  it("자리마다 시작 수도를 갖는다", () => {
    for (let i = 0; i < 6; i++) {
      expect(state.seats[i].capital).toBe(`c${i}`);
      expect(state.nodes[`c${i}`]).toEqual({ id: `c${i}`, owner: i, garrison: 60, buildings: NO_BUILDINGS });
    }
  });

  it("수도가 아닌 거점은 타입별 중립 수비대를 갖고 건물이 없다", () => {
    expect(state.nodes.x0).toEqual({ id: "x0", owner: null, garrison: 60, buildings: NO_BUILDINGS });
    expect(state.nodes.f0.garrison).toBe(20);
    expect(state.nodes.i0.garrison).toBe(40);
    expect(state.nodes.i1.garrison).toBe(40);
  });

  it("영웅 30명이 수도에서 병력 0, 레벨 1, 경험치 0, 특성 3으로 시작하고 능력치는 등급 기준값이다", () => {
    expect(state.heroes).toHaveLength(30);
    const hero = heroOf(state, "s2h4");
    expect(hero).toMatchObject({
      seat: 2,
      name: "H24",
      location: "c2",
      troops: 0,
      status: "active",
      level: 1,
      exp: 0,
      injuredUntil: null,
      captor: null,
    });
    expect(hero.stats).toEqual({ might: 14, command: 14, admin: 14, mobility: 14 });
    expect(hero.traits).toEqual({ loyalty: 3, caution: 3, valor: 3 });
  });

  it("설정한 특성은 기본값 3을 덮는다", () => {
    const setup = makeSetup();
    setup.seats[1].heroes[2].traits = { caution: 5 };
    expect(heroOf(initState(setup), "s1h2").traits).toEqual({ loyalty: 3, caution: 5, valor: 3 });
  });

  it("자원은 시작값이고 자리마다 따로다", () => {
    const fresh = makeState();
    expect(fresh.seats[0].treasury).toEqual({ gold: 50, food: 50, material: 20, rare: 0 });
    fresh.seats[0].treasury.gold = 0;
    expect(fresh.seats[1].treasury.gold).toBe(50);
  });

  it("턴 0에서 끝나지 않은 상태로 시작한다", () => {
    expect(state.turn).toBe(0);
    expect(state.maxTurns).toBe(120);
    expect(state.majority).toEqual({ seat: null, streak: 0 });
    expect(state.ended).toBeNull();
  });

  it("시작 점수는 거점 1개 10점 + 병력 60명 6점이다", () => {
    expect(scoreOf(state, 0)).toBe(16);
  });
});
```

`packages/core/test/helpers.ts`에서 영웅 설정과 `noOrders`를 바꾼다:
```ts
      heroes: Array.from({ length: 5 }, (_, j) => ({ name: `H${i}${j}`, grade: 3, growth: 1, traits: {} })),
```
```ts
export function noOrders(): Orders {
  return Array.from({ length: 6 }, () => ({ missions: [], recruits: [], builds: [] }));
}
```

- [ ] **Step 3: 테스트가 실패하는지 본다**

Run: `npx vitest run packages/core/test/state.test.ts`
Expected: FAIL. `traits`가 모르는 키로 거부되거나(`Unrecognized key`), 초기 상태에 `buildings`·`level`이 없어 `toEqual`·`toMatchObject`가 실패한다.

- [ ] **Step 4: `types.ts`를 바꾼다**

`packages/core/src/types.ts` 전체:
```ts
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

export type BuildingKind = "production" | "barracks" | "walls";
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
  location: NodeId;
  troops: number;
  status: HeroStatus;
  /** 부상이면 이 턴의 처리 끝에 회복한다 */
  injuredUntil: number | null;
  /** 포로면 잡고 있는 자리 */
  captor: SeatId | null;
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
  | { kind: "defend"; hero: string }
  | { kind: "govern"; hero: string };

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
  | { kind: "matchEnded"; result: MatchResult }
  | { kind: "disobeyed"; seat: SeatId; hero: string; mission: Mission["kind"] }
  | { kind: "hesitated"; seat: SeatId; hero: string; node: NodeId }
  | { kind: "heroInjured"; seat: SeatId; hero: string; until: number }
  | { kind: "heroRecovered"; seat: SeatId; hero: string }
  | { kind: "heroCaptured"; seat: SeatId; hero: string; by: SeatId }
  | { kind: "heroReleased"; seat: SeatId; hero: string; to: NodeId | null }
  | { kind: "levelUp"; seat: SeatId; hero: string; level: number; stats: HeroStats }
  | { kind: "built"; seat: SeatId; node: NodeId; building: BuildingKind; level: number }
  | { kind: "buildSkipped"; seat: SeatId; node: NodeId; building: BuildingKind; reason: "notOwned" | "unaffordable" };
```
(`heroRouted.to`는 Task 6에서 `NodeId`로 좁힌다.)

- [ ] **Step 5: 수치 표를 바꾼다**

`packages/core/src/data/balance.json` 전체:
```json
{
  "production": {
    "capital": { "gold": 6, "food": 5, "material": 3, "rare": 0 },
    "city": { "gold": 4, "food": 2, "material": 1, "rare": 0 },
    "fortress": { "gold": 1, "food": 1, "material": 1, "rare": 0 },
    "farm": { "gold": 1, "food": 6, "material": 0, "rare": 0 },
    "mine": { "gold": 1, "food": 0, "material": 6, "rare": 0 },
    "rare": { "gold": 1, "food": 0, "material": 0, "rare": 2 }
  },
  "neutralGarrison": { "capital": 0, "city": 40, "fortress": 60, "farm": 20, "mine": 20, "rare": 40 },
  "terrain": { "capital": 1.3, "city": 1.1, "fortress": 1.5, "farm": 1.0, "mine": 1.0, "rare": 1.0 },
  "recruit": {
    "unit": 10,
    "costPerUnit": { "gold": 5, "food": 5 },
    "capPerTurn": { "capital": 30, "city": 20 }
  },
  "upkeep": { "soldiersPerFood": 20, "desertionPercent": 10 },
  "start": {
    "treasury": { "gold": 50, "food": 50, "material": 20, "rare": 0 },
    "capitalGarrison": 60
  },
  "hero": {
    "baseStatByGrade": [10, 12, 14, 16, 18],
    "mightBonusPerPoint": 0.03,
    "troopsPerCommand": 10,
    "levelCapByGrade": [10, 11, 12, 13, 14],
    "gainPerLevelByGrade": [0.5, 0.6, 0.7, 0.8, 0.9],
    "gainSpread": 0.5,
    "expPerLevel": 20,
    "traitSlotsByGrade": [1, 1, 2, 2, 3]
  },
  "exp": { "battle": 10, "victory": 10, "govern": 5 },
  "traits": {
    "disobeyPercentByLoyalty": [20, 10, 0, 0, 0],
    "cautionRatioByCaution": [0, 0, 0, 1, 1.2],
    "valorBonusPerPoint": 0.03,
    "valorInjuryPercentPerPoint": 10
  },
  "injury": { "percent": 30, "turns": 3 },
  "govern": { "percentPerAdmin": 3 },
  "buildings": {
    "maxLevel": 3,
    "costPerLevel": { "gold": 20, "material": 30 },
    "productionPercentPerLevel": 50,
    "barracksCapPerLevel": 10,
    "wallsTerrainPerLevel": 0.1
  },
  "combat": { "randomSpread": 0.1, "winnerLossFactor": 0.6, "loserAttackerLossFactor": 0.6, "routedKeepPercent": 40 },
  "capitalLossPercent": 30,
  "victory": { "majorityStreak": 12 },
  "score": { "perNode": 10, "troopsPerPoint": 10, "perBuildingLevel": 3, "perHeroLevel": 2 }
}
```

- [ ] **Step 6: 설정 스키마와 초기 상태를 바꾼다**

`packages/core/src/setup.ts` 전체:
```ts
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
```

`packages/core/src/state.ts` 전체:
```ts
import { BALANCE } from "./data/balance";
import { getMap } from "./map";
import type { MatchSetup } from "./setup";
import type { Buildings, GameMap, GameState, Hero, NodeState, SeatState } from "./types";

function noBuildings(): Buildings {
  return { production: 0, barracks: 0, walls: 0 };
}

export function initState(setup: MatchSetup): GameState {
  // 모듈의 맵 데이터를 상태가 공유하지 않도록 복사한다
  const map: GameMap = JSON.parse(JSON.stringify(getMap(setup.map)));
  if (setup.seats.length !== map.capitals.length) {
    throw new Error(`map ${map.id} needs ${map.capitals.length} seats, got ${setup.seats.length}`);
  }
  const nodes: Record<string, NodeState> = {};
  for (const node of map.nodes) {
    nodes[node.id] = {
      id: node.id,
      owner: null,
      garrison: BALANCE.neutralGarrison[node.type],
      buildings: noBuildings(),
    };
  }
  const seats: SeatState[] = setup.seats.map((seat, i) => {
    const capital = map.capitals[i];
    nodes[capital] = { id: capital, owner: i, garrison: BALANCE.start.capitalGarrison, buildings: noBuildings() };
    return { id: i, name: seat.name, capital, treasury: { ...BALANCE.start.treasury }, eliminatedAt: null };
  });
  const heroes: Hero[] = setup.seats.flatMap((seat, i) =>
    seat.heroes.map((h, j): Hero => {
      const base = BALANCE.hero.baseStatByGrade[h.grade - 1];
      return {
        id: `s${i}h${j}`,
        seat: i,
        name: h.name,
        grade: h.grade,
        growth: h.growth,
        stats: { might: base, command: base, admin: base, mobility: base },
        level: 1,
        exp: 0,
        traits: { loyalty: 3, caution: 3, valor: 3, ...h.traits },
        location: map.capitals[i],
        troops: 0,
        status: "active",
        injuredUntil: null,
        captor: null,
      };
    }),
  );
  return {
    matchSeed: setup.seed,
    turn: 0,
    maxTurns: setup.turns,
    map,
    nodes,
    seats,
    heroes,
    majority: { seat: null, streak: 0 },
    ended: null,
  };
}
```

- [ ] **Step 7: 컴파일이 깨지는 곳을 맞춘다(건설 검증은 Task 3)**

`packages/core/src/orders.ts`:
- `PlanIssue`의 `item: "mission" | "recruit";`를 `item: "mission" | "recruit" | "build";`로 바꾼다.
- `return { plan: { missions, recruits }, issues };`를 `return { plan: { missions, recruits, builds: [] }, issues };`로 바꾼다(건설 검증은 Task 3에서 채운다).
- `missionIssue`의 `if (mission.kind === "defend") return null;`를 `if (mission.kind === "defend" || mission.kind === "govern") return null;`로 바꾼다. 활동 중인 영웅은 늘 아군 거점에 서 있으므로 운영 임무에 더 볼 것이 없다.

`packages/core/src/rules/movement.ts`의 `resolveMovement` 안 조건을 바꾼다:
```ts
    if (!mission || mission.kind === "defend" || mission.kind === "govern" || hero.status !== "active") continue;
```

`packages/core/src/staff/rule-staff.ts`의 `rulePlan`:
```ts
export function rulePlan(state: GameState, seat: SeatId): Plan {
  return { missions: planMissions(state, seat), recruits: planRecruits(state, seat), builds: [] };
}
```

`packages/sim/src/runner.ts`:
```ts
const EMPTY_PLAN: Plan = { missions: [], recruits: [], builds: [] };
```

`packages/core/test/combat.test.ts` 첫 테스트의 거점 기대값:
```ts
    expect(state.nodes.f0).toEqual({ id: "f0", owner: 0, garrison: 0, buildings: { production: 0, barracks: 0, walls: 0 } });
```

`packages/core/test/orders.test.ts`:
- `missionsOnly`는 `return { missions, recruits: [], builds: [] };`, `recruitsOnly`는 `return { missions: [], recruits, builds: [] };`로 바꾼다.
- "올바른 명령은 그대로 통과한다"의 `plan`에 `builds: [],`를 `recruits` 줄 다음에 넣는다.

`packages/core/test/movement.test.ts`의 세 번째 테스트를 바꾼다:
```ts
  it("defend·govern과 임무 없는 영웅은 그대로다", () => {
    const state = makeState();
    const events: GameEvent[] = [];
    resolveMovement(
      state,
      new Map<string, Mission>([
        ["s0h0", { kind: "defend", hero: "s0h0" }],
        ["s0h1", { kind: "govern", hero: "s0h1" }],
      ]),
      events,
    );
    expect(heroOf(state, "s0h0")).toMatchObject({ location: "c0", troops: 0 });
    expect(heroOf(state, "s0h1")).toMatchObject({ location: "c0", troops: 0 });
    expect(events).toEqual([]);
  });
```

- [ ] **Step 8: 전체 테스트와 타입 검사를 돌린다**

Run: `npm test`
Expected: `Test Files  12 passed`, `Tests  89 passed`.

Run: `npm run typecheck`
Expected: 오류 없음, 종료 코드 0.

- [ ] **Step 9: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add packages/core/src/types.ts packages/core/src/data/balance.json packages/core/src/setup.ts packages/core/src/state.ts packages/core/src/orders.ts packages/core/src/rules/movement.ts packages/core/src/staff/rule-staff.ts packages/sim/src/runner.ts packages/core/test/helpers.ts packages/core/test/state.test.ts packages/core/test/combat.test.ts packages/core/test/movement.test.ts packages/core/test/orders.test.ts
git -C D:/game/proxywar commit -m "feat(core): 영웅 레벨·특성·부상·포로와 거점 건물 상태"
```

---

### Task 2: 건물 수치 도우미와 전투력

**Files:**
- Modify: `packages/core/src/data/balance.ts`, `packages/core/src/rules/power.ts`, `packages/core/src/rules/combat.ts`
- Test: `packages/core/test/power.test.ts`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`packages/core/test/power.test.ts` 전체:
```ts
import { describe, expect, it } from "vitest";
import { terrainOf } from "../src/data/balance";
import { attackModifier, defensePower, heroModifier, troopCap } from "../src/rules/power";
import { heroOf, makeState } from "./helpers";

describe("power", () => {
  it("3성 영웅은 배수 1.12, 병력 상한 140이다", () => {
    const hero = heroOf(makeState(), "s0h0");
    expect(heroModifier(hero)).toBeCloseTo(1.12);
    expect(troopCap(hero)).toBe(140);
    expect(heroModifier(undefined)).toBe(1);
  });

  it("중립 요새 방어력은 수비대 × 1.5다", () => {
    expect(defensePower(makeState(), "x0")).toBeCloseTo(90);
  });

  it("수도 방어력은 수비대와 영웅 병력 합 × 최고 영웅 배수 × 1.3이고, 제외한 영웅은 빠진다", () => {
    const state = makeState();
    heroOf(state, "s0h0").troops = 40;
    expect(defensePower(state, "c0")).toBeCloseTo(100 * 1.12 * 1.3);
    expect(defensePower(state, "c0", new Set(["s0h0"]))).toBeCloseTo(60 * 1.12 * 1.3);
  });

  it("용맹은 공격 배수에만 점당 0.03을 더한다", () => {
    const hero = heroOf(makeState(), "s0h0");
    hero.traits.valor = 5;
    expect(attackModifier(hero)).toBeCloseTo(1.18);
    expect(heroModifier(hero)).toBeCloseTo(1.12);
    hero.traits.valor = 1;
    expect(attackModifier(hero)).toBeCloseTo(1.06);
    expect(attackModifier(undefined)).toBe(1);
  });

  it("통솔이 소수면 병력 상한을 내림한다", () => {
    const hero = heroOf(makeState(), "s0h0");
    hero.stats.command = 14.79;
    expect(troopCap(hero)).toBe(147);
  });

  it("성벽은 레벨당 지형 배수에 0.1을 더하고 방어력에 들어간다", () => {
    const state = makeState();
    state.nodes.c0.buildings.walls = 2;
    expect(terrainOf(state, "c0")).toBeCloseTo(1.5);
    expect(defensePower(state, "c0")).toBeCloseTo(60 * 1.12 * 1.5);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 본다**

Run: `npx vitest run packages/core/test/power.test.ts`
Expected: FAIL. `terrainOf`·`attackModifier`를 import할 수 없다(`is not a function` 또는 export 없음).

- [ ] **Step 3: 수치 도우미를 쓴다**

`packages/core/src/data/balance.ts` 전체:
```ts
import { nodeType } from "../map";
import type { BuildingKind, GameState, NodeId, SeatId } from "../types";
import balance from "./balance.json";

export const BALANCE = balance;

export const BUILDING_KINDS: readonly BuildingKind[] = ["production", "barracks", "walls"];

/**
 * 그 자리가 그 거점에서 한 턴에 모집할 수 있는 상한.
 * 현재 수도는 수도 상한, 도시와 (현재 수도가 아닌) 원래 수도 거점은 도시 상한, 나머지는 0이고,
 * 그 거점의 병영 레벨당 상한을 더한다.
 */
export function recruitCap(state: GameState, seat: SeatId, node: NodeId): number {
  const barracks = state.nodes[node].buildings.barracks * BALANCE.buildings.barracksCapPerLevel;
  if (state.seats[seat].capital === node) return BALANCE.recruit.capPerTurn.capital + barracks;
  const type = nodeType(state.map, node);
  const base = type === "capital" || type === "city" ? BALANCE.recruit.capPerTurn.city : 0;
  return base + barracks;
}

/** 지형 방어 배수에 성벽 레벨만큼 더한 값 */
export function terrainOf(state: GameState, node: NodeId): number {
  return (
    BALANCE.terrain[nodeType(state.map, node)] +
    state.nodes[node].buildings.walls * BALANCE.buildings.wallsTerrainPerLevel
  );
}

/** 건물을 level로 올리는 비용 */
export function buildCost(level: number): { gold: number; material: number } {
  const { gold, material } = BALANCE.buildings.costPerLevel;
  return { gold: gold * level, material: material * level };
}
```

`packages/core/src/rules/power.ts` 전체:
```ts
import { BALANCE, terrainOf } from "../data/balance";
import type { GameState, Hero, NodeId } from "../types";

/** 영웅 무력에 따른 방어 배수(공격은 attackModifier). 영웅이 없으면 1. */
export function heroModifier(hero: Hero | undefined): number {
  if (!hero) return 1;
  return 1 + (hero.stats.might - BALANCE.hero.baseStatByGrade[0]) * BALANCE.hero.mightBonusPerPoint;
}

/** 공격 배수: 무력 배수에 용맹 보정을 더한다. 영웅이 없으면 1. */
export function attackModifier(hero: Hero | undefined): number {
  if (!hero) return 1;
  return heroModifier(hero) + (hero.traits.valor - 3) * BALANCE.traits.valorBonusPerPoint;
}

/** 통솔 1당 병력 상한(성장으로 통솔이 소수가 되므로 내림) */
export function troopCap(hero: Hero): number {
  return Math.floor(hero.stats.command * BALANCE.hero.troopsPerCommand);
}

export function bestHero(heroes: readonly Hero[]): Hero | undefined {
  let best: Hero | undefined;
  for (const h of heroes) if (!best || h.stats.might > best.stats.might) best = h;
  return best;
}

export function sumTroops(heroes: readonly Hero[]): number {
  return heroes.reduce((sum, h) => sum + h.troops, 0);
}

/** 거점 주인의 영웅 중 그 거점에 있는 활동 영웅. exclude는 이번 턴 공격에 나섰거나 운영 중인 영웅. */
export function defenders(state: GameState, node: NodeId, exclude: ReadonlySet<string> = new Set()): Hero[] {
  const owner = state.nodes[node].owner;
  if (owner === null) return [];
  return state.heroes.filter(
    (h) => h.status === "active" && h.seat === owner && h.location === node && !exclude.has(h.id),
  );
}

/** 무작위 폭을 뺀 방어력. 규칙 참모의 추정과 신중 판정에도 쓴다. */
export function defensePower(state: GameState, node: NodeId, exclude: ReadonlySet<string> = new Set()): number {
  const heroes = defenders(state, node, exclude);
  const troops = state.nodes[node].garrison + sumTroops(heroes);
  return troops * heroModifier(bestHero(heroes)) * terrainOf(state, node);
}

/** 무작위 폭을 뺀 공격력(무력이 가장 높은 영웅의 공격 배수) */
export function attackPower(heroes: readonly Hero[]): number {
  return sumTroops(heroes) * attackModifier(bestHero(heroes));
}
```

`packages/core/src/rules/combat.ts`의 실제 전투 방어력도 성벽을 쓰게 한다:
- import 두 줄을 `import { BALANCE, terrainOf } from "../data/balance";`와 `import { compareText, neighbors } from "../map";`로 바꾼다.
- `resolveAttack`의 `BALANCE.terrain[nodeType(state.map, target)] *`를 `terrainOf(state, target) *`로 바꾼다.

- [ ] **Step 4: 테스트가 통과하는지 본다**

Run: `npx vitest run packages/core/test/power.test.ts`
Expected: `Tests  6 passed`.

Run: `npm test`
Expected: `Tests  92 passed`.

Run: `npm run typecheck`
Expected: 오류 없음.

- [ ] **Step 5: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add packages/core/src/data/balance.ts packages/core/src/rules/power.ts packages/core/src/rules/combat.ts packages/core/test/power.test.ts
git -C D:/game/proxywar commit -m "feat(core): 병영·성벽 수치, 용맹 공격 배수"
```

---

### Task 3: 명령 검증(운영·건설·병영 상한)

**Files:**
- Modify: `packages/core/src/orders.ts`
- Test: `packages/core/test/orders.test.ts`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`packages/core/test/orders.test.ts` 전체:
```ts
import { describe, expect, it } from "vitest";
import { validatePlan } from "../src/orders";
import type { Build, BuildingKind, GameState, HeroStatus, Mission, Plan, Recruit } from "../src/types";
import { heroOf, makeState } from "./helpers";

function reasons(state: GameState, plan: Plan): string[] {
  return validatePlan(state, 0, plan).issues.map((i) => i.reason);
}

function missionsOnly(...missions: Mission[]): Plan {
  return { missions, recruits: [], builds: [] };
}

function recruitsOnly(...recruits: Recruit[]): Plan {
  return { missions: [], recruits, builds: [] };
}

function buildsOnly(...builds: Build[]): Plan {
  return { missions: [], recruits: [], builds };
}

describe("validatePlan", () => {
  it("올바른 명령은 그대로 통과한다", () => {
    const state = makeState();
    state.nodes.f0.owner = 0;
    const plan: Plan = {
      missions: [
        { kind: "move", hero: "s0h0", to: "f0", draw: 10 },
        { kind: "attack", hero: "s0h1", target: "m0" },
        { kind: "defend", hero: "s0h2" },
        { kind: "govern", hero: "s0h3" },
      ],
      recruits: [{ node: "c0", amount: 30 }],
      builds: [
        { node: "c0", building: "production" },
        { node: "f0", building: "walls" },
      ],
    };
    const checked = validatePlan(state, 0, plan);
    expect(checked.issues).toEqual([]);
    expect(checked.plan).toEqual(plan);
  });

  it.each<[string, Mission, string]>([
    ["없는 영웅", { kind: "defend", hero: "nope" }, "unknown hero"],
    ["남의 영웅", { kind: "defend", hero: "s1h0" }, "not your hero"],
    ["중립 거점으로 이동", { kind: "move", hero: "s0h0", to: "f0" }, "move target not own"],
    ["인접하지 않은 공격", { kind: "attack", hero: "s0h0", target: "x0" }, "not adjacent"],
    ["음수 draw", { kind: "attack", hero: "s0h0", target: "f0", draw: -5 }, "bad draw"],
    ["소수 draw", { kind: "attack", hero: "s0h0", target: "f0", draw: 1.5 }, "bad draw"],
    ["없는 거점", { kind: "attack", hero: "s0h0", target: "zz" }, "unknown node"],
    ["프로토타입 키 거점", { kind: "attack", hero: "s0h0", target: "toString" }, "unknown node"],
  ])("잘못된 임무를 뺀다: %s", (_, mission, reason) => {
    expect(reasons(makeState(), missionsOnly(mission))).toEqual([reason]);
  });

  it.each<[HeroStatus]>([["out"], ["injured"], ["captured"]])("활동하지 않는 영웅의 임무를 뺀다: %s", (status) => {
    const state = makeState();
    heroOf(state, "s0h0").status = status;
    expect(reasons(state, missionsOnly({ kind: "govern", hero: "s0h0" }))).toEqual(["hero not active"]);
  });

  it("아군 거점 공격을 뺀다", () => {
    const state = makeState();
    state.nodes.f0.owner = 0;
    expect(reasons(state, missionsOnly({ kind: "attack", hero: "s0h0", target: "f0" }))).toEqual([
      "attack target is own",
    ]);
  });

  it("같은 영웅의 두 번째 임무를 뺀다", () => {
    const checked = validatePlan(
      makeState(),
      0,
      missionsOnly({ kind: "defend", hero: "s0h0" }, { kind: "attack", hero: "s0h0", target: "f0" }),
    );
    expect(checked.plan.missions).toEqual([{ kind: "defend", hero: "s0h0" }]);
    expect(checked.issues).toEqual([{ item: "mission", index: 1, reason: "duplicate hero" }]);
  });

  it.each<[string, Recruit, string]>([
    ["농장에서 모집", { node: "f0", amount: 10 }, "cannot recruit here"],
    ["남의 수도에서 모집", { node: "c1", amount: 10 }, "not own node"],
    ["10명 단위가 아님", { node: "c0", amount: 25 }, "bad amount"],
    ["0명", { node: "c0", amount: 0 }, "bad amount"],
  ])("잘못된 모집을 뺀다: %s", (_, recruit, reason) => {
    const state = makeState();
    state.nodes.f0.owner = 0;
    expect(reasons(state, recruitsOnly(recruit))).toEqual([reason]);
  });

  it("수도를 옮긴 자리는 새 수도에서 수도 상한까지 모집한다", () => {
    const state = makeState();
    state.nodes.f0.owner = 0;
    state.seats[0].capital = "f0";
    expect(reasons(state, recruitsOnly({ node: "f0", amount: 30 }))).toEqual([]);
  });

  it("점령한 남의 원래 수도는 도시 상한까지만 모집한다", () => {
    const state = makeState();
    state.nodes.c1.owner = 0;
    expect(reasons(state, recruitsOnly({ node: "c1", amount: 20 }))).toEqual([]);
    expect(reasons(state, recruitsOnly({ node: "c1", amount: 30 }))).toEqual(["over cap"]);
  });

  it("같은 거점 모집 합계가 상한을 넘으면 넘는 항목을 뺀다", () => {
    const checked = validatePlan(makeState(), 0, recruitsOnly({ node: "c0", amount: 20 }, { node: "c0", amount: 20 }));
    expect(checked.plan.recruits).toEqual([{ node: "c0", amount: 20 }]);
    expect(checked.issues).toEqual([{ item: "recruit", index: 1, reason: "over cap" }]);
  });

  it("병영 레벨당 모집 상한이 10 늘고, 병영이 있으면 농장에서도 모집한다", () => {
    const state = makeState();
    state.nodes.c0.buildings.barracks = 1;
    state.nodes.f0.owner = 0;
    state.nodes.f0.buildings.barracks = 1;
    expect(reasons(state, recruitsOnly({ node: "c0", amount: 40 }, { node: "f0", amount: 10 }))).toEqual([]);
    expect(reasons(state, recruitsOnly({ node: "c0", amount: 50 }))).toEqual(["over cap"]);
    expect(reasons(state, recruitsOnly({ node: "f0", amount: 20 }))).toEqual(["over cap"]);
  });

  it.each<[string, Build, string]>([
    ["없는 거점", { node: "zz", building: "walls" }, "unknown node"],
    ["남의 거점", { node: "c1", building: "walls" }, "not own node"],
    ["없는 건물", { node: "c0", building: "tower" as BuildingKind }, "unknown building"],
  ])("잘못된 건설을 뺀다: %s", (_, build, reason) => {
    expect(reasons(makeState(), buildsOnly(build))).toEqual([reason]);
  });

  it("최고 레벨(3) 건물은 더 짓지 못한다", () => {
    const state = makeState();
    state.nodes.c0.buildings.walls = 3;
    expect(reasons(state, buildsOnly({ node: "c0", building: "walls" }))).toEqual(["max level"]);
  });

  it("한 거점에는 턴당 하나만 짓는다", () => {
    const checked = validatePlan(
      makeState(),
      0,
      buildsOnly({ node: "c0", building: "walls" }, { node: "c0", building: "production" }),
    );
    expect(checked.plan.builds).toEqual([{ node: "c0", building: "walls" }]);
    expect(checked.issues).toEqual([{ item: "build", index: 1, reason: "one build per node" }]);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 본다**

Run: `npx vitest run packages/core/test/orders.test.ts`
Expected: FAIL. 건설 항목이 빈 배열로 돌아와 "올바른 명령"의 `checked.plan`이 다르고, 건설 오류 테스트의 issues가 비어 있다. 병영 테스트는 Task 2의 `recruitCap`으로 이미 통과한다.

- [ ] **Step 3: 건설 검증을 쓴다**

`packages/core/src/orders.ts` 전체:
```ts
import { BALANCE, BUILDING_KINDS, recruitCap } from "./data/balance";
import { neighbors } from "./map";
import type { Build, GameState, Mission, NodeId, Plan, Recruit, SeatId } from "./types";

export interface PlanIssue {
  item: "mission" | "recruit" | "build";
  index: number;
  reason: string;
}

export interface CheckedPlan {
  plan: Plan;
  issues: PlanIssue[];
}

/** 잘못된 항목을 빼고 이유를 남긴다. 남은 항목은 processTurn이 그대로 믿는다. */
export function validatePlan(state: GameState, seat: SeatId, plan: Plan): CheckedPlan {
  const issues: PlanIssue[] = [];
  const missions: Mission[] = [];
  const used = new Set<string>();
  plan.missions.forEach((mission, index) => {
    const reason = missionIssue(state, seat, mission, used);
    if (reason) {
      issues.push({ item: "mission", index, reason });
    } else {
      used.add(mission.hero);
      missions.push(mission);
    }
  });
  const recruits: Recruit[] = [];
  const perNode: Record<string, number> = {};
  plan.recruits.forEach((recruit, index) => {
    const reason = recruitIssue(state, seat, recruit, perNode[recruit.node] ?? 0);
    if (reason) {
      issues.push({ item: "recruit", index, reason });
    } else {
      perNode[recruit.node] = (perNode[recruit.node] ?? 0) + recruit.amount;
      recruits.push(recruit);
    }
  });
  const builds: Build[] = [];
  const builtAt = new Set<NodeId>();
  plan.builds.forEach((build, index) => {
    const reason = buildIssue(state, seat, build, builtAt);
    if (reason) {
      issues.push({ item: "build", index, reason });
    } else {
      builtAt.add(build.node);
      builds.push(build);
    }
  });
  return { plan: { missions, recruits, builds }, issues };
}

function missionIssue(state: GameState, seat: SeatId, mission: Mission, used: ReadonlySet<string>): string | null {
  const hero = state.heroes.find((h) => h.id === mission.hero);
  if (!hero) return "unknown hero";
  if (hero.seat !== seat) return "not your hero";
  if (hero.status !== "active") return "hero not active";
  if (used.has(hero.id)) return "duplicate hero";
  // 활동 중인 영웅은 늘 아군 거점에 서 있으므로 방어·운영에는 더 볼 것이 없다
  if (mission.kind === "defend" || mission.kind === "govern") return null;
  if (mission.draw !== undefined && (!Number.isInteger(mission.draw) || mission.draw < 0)) return "bad draw";
  const dest = mission.kind === "move" ? mission.to : mission.target;
  if (!Object.hasOwn(state.nodes, dest)) return "unknown node";
  if (!neighbors(state.map, hero.location).includes(dest)) return "not adjacent";
  const owner = state.nodes[dest].owner;
  if (mission.kind === "move" && owner !== seat) return "move target not own";
  if (mission.kind === "attack" && owner === seat) return "attack target is own";
  return null;
}

function recruitIssue(state: GameState, seat: SeatId, recruit: Recruit, already: number): string | null {
  if (!Object.hasOwn(state.nodes, recruit.node)) return "unknown node";
  if (state.nodes[recruit.node].owner !== seat) return "not own node";
  const cap = recruitCap(state, seat, recruit.node);
  if (cap === 0) return "cannot recruit here";
  const unit = BALANCE.recruit.unit;
  if (!Number.isInteger(recruit.amount) || recruit.amount <= 0 || recruit.amount % unit !== 0) return "bad amount";
  if (already + recruit.amount > cap) return "over cap";
  return null;
}

/** 건설은 거점마다 턴당 하나다 */
function buildIssue(state: GameState, seat: SeatId, build: Build, builtAt: ReadonlySet<NodeId>): string | null {
  if (!Object.hasOwn(state.nodes, build.node)) return "unknown node";
  if (state.nodes[build.node].owner !== seat) return "not own node";
  if (!BUILDING_KINDS.includes(build.building)) return "unknown building";
  if (builtAt.has(build.node)) return "one build per node";
  if (state.nodes[build.node].buildings[build.building] >= BALANCE.buildings.maxLevel) return "max level";
  return null;
}
```

- [ ] **Step 4: 테스트가 통과하는지 본다**

Run: `npx vitest run packages/core/test/orders.test.ts`
Expected: `Tests  27 passed`.

Run: `npm test`
Expected: `Tests  100 passed`.

Run: `npm run typecheck`
Expected: 오류 없음.

- [ ] **Step 5: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add packages/core/src/orders.ts packages/core/test/orders.test.ts
git -C D:/game/proxywar commit -m "feat(core): 운영 임무·건설 명령 검증"
```

---

### Task 4: 경험치와 레벨업

**Files:**
- Create: `packages/core/src/rules/growth.ts`
- Test: `packages/core/test/growth.test.ts`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`packages/core/test/growth.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { createRng } from "../src/rng";
import { gainExp, resolveGrowth } from "../src/rules/growth";
import type { GameEvent } from "../src/types";
import { heroOf, makeState } from "./helpers";

const STATS = ["might", "command", "admin", "mobility"] as const;

describe("growth", () => {
  it("경험치가 20 × 레벨만큼 차면 레벨이 오르고 능력치 4종이 0.7 × 0.5~1.5씩 오른다(3성, 성장 계수 1)", () => {
    const state = makeState();
    const hero = heroOf(state, "s0h0");
    gainExp(hero, 25);
    const events: GameEvent[] = [];
    resolveGrowth(state, createRng(1, "test"), events);
    expect(hero).toMatchObject({ level: 2, exp: 5 });
    for (const stat of STATS) {
      expect(hero.stats[stat]).toBeGreaterThanOrEqual(14 + 0.35);
      expect(hero.stats[stat]).toBeLessThan(14 + 1.05);
    }
    expect(events).toEqual([{ kind: "levelUp", seat: 0, hero: "s0h0", level: 2, stats: hero.stats }]);
  });

  it("숨은 성장 계수가 2면 상승폭 범위도 두 배다", () => {
    const state = makeState();
    const hero = heroOf(state, "s0h0");
    hero.growth = 2;
    gainExp(hero, 20);
    resolveGrowth(state, createRng(1, "test"), []);
    for (const stat of STATS) {
      expect(hero.stats[stat]).toBeGreaterThanOrEqual(14 + 0.7);
      expect(hero.stats[stat]).toBeLessThan(14 + 2.1);
    }
  });

  it("경험치가 넉넉하면 한 번에 여러 레벨이 오른다", () => {
    const state = makeState();
    const hero = heroOf(state, "s0h0");
    gainExp(hero, 20 + 40 + 10);
    const events: GameEvent[] = [];
    resolveGrowth(state, createRng(1, "test"), events);
    expect(hero).toMatchObject({ level: 3, exp: 10 });
    expect(events.map((e) => e.kind)).toEqual(["levelUp", "levelUp"]);
  });

  it("레벨 상한(1성 10)에 닿으면 경험치를 버리고 더 쌓지 않는다", () => {
    const state = makeState();
    const hero = heroOf(state, "s0h0");
    Object.assign(hero, { grade: 1, level: 9, exp: 0 });
    gainExp(hero, 9 * 20 + 15);
    resolveGrowth(state, createRng(1, "test"), []);
    expect(hero).toMatchObject({ level: 10, exp: 0 });
    gainExp(hero, 50);
    expect(hero.exp).toBe(0);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 본다**

Run: `npx vitest run packages/core/test/growth.test.ts`
Expected: FAIL, `Cannot find module '../src/rules/growth'` 또는 같은 뜻의 해석 오류.

- [ ] **Step 3: 성장 단계를 쓴다**

`packages/core/src/rules/growth.ts`:
```ts
import { BALANCE } from "../data/balance";
import { compareText } from "../map";
import type { Rng } from "../rng";
import type { GameEvent, GameState, Hero } from "../types";

const STATS = ["might", "command", "admin", "mobility"] as const;

export function levelCap(hero: Hero): number {
  return BALANCE.hero.levelCapByGrade[hero.grade - 1];
}

/** 지금 레벨에서 다음 레벨까지 필요한 경험치 */
export function expToNext(hero: Hero): number {
  return BALANCE.hero.expPerLevel * hero.level;
}

/** 경험치를 쌓는다. 레벨 상한이면 쌓지 않는다. */
export function gainExp(hero: Hero, amount: number): void {
  if (hero.level < levelCap(hero)) hero.exp += amount;
}

/** 생산·성장 단계 끝: 경험치가 찬 영웅을 영웅 id 순으로 레벨업한다. */
export function resolveGrowth(state: GameState, rng: Rng, events: GameEvent[]): void {
  for (const hero of [...state.heroes].sort((a, b) => compareText(a.id, b.id))) {
    while (hero.level < levelCap(hero) && hero.exp >= expToNext(hero)) {
      hero.exp -= expToNext(hero);
      hero.level += 1;
      raiseStats(hero, rng);
      events.push({ kind: "levelUp", seat: hero.seat, hero: hero.id, level: hero.level, stats: { ...hero.stats } });
    }
    if (hero.level >= levelCap(hero)) hero.exp = 0;
  }
}

/** 능력치마다 등급 기준 상승폭 × 숨은 성장 계수 × 무작위 폭 */
function raiseStats(hero: Hero, rng: Rng): void {
  const base = BALANCE.hero.gainPerLevelByGrade[hero.grade - 1] * hero.growth;
  const spread = BALANCE.hero.gainSpread;
  for (const stat of STATS) hero.stats[stat] += base * rng.range(1 - spread, 1 + spread);
}
```

- [ ] **Step 4: 테스트가 통과하는지 본다**

Run: `npx vitest run packages/core/test/growth.test.ts`
Expected: `Tests  4 passed`.

Run: `npm test`
Expected: `Test Files  13 passed`, `Tests  104 passed`.

- [ ] **Step 5: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add packages/core/src/rules/growth.ts packages/core/test/growth.test.ts
git -C D:/game/proxywar commit -m "feat(core): 경험치와 레벨업 성장"
```

---

### Task 5: 특성 판정과 영웅 상태 변화

**Files:**
- Create: `packages/core/src/rules/traits.ts`, `packages/core/src/rules/heroes.ts`
- Test: `packages/core/test/traits.test.ts`, `packages/core/test/heroes.test.ts`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`packages/core/test/traits.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { createRng } from "../src/rng";
import { applyLoyalty, cautionRatio } from "../src/rules/traits";
import type { GameEvent, Mission } from "../src/types";
import { heroOf, makeState } from "./helpers";

describe("applyLoyalty", () => {
  it("충성 1 영웅은 일부 시드에서 임무 대신 제자리를 지키고 그 사실을 남긴다", () => {
    let disobeyed = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const state = makeState();
      heroOf(state, "s0h0").traits.loyalty = 1;
      const missions = new Map<string, Mission>([["s0h0", { kind: "attack", hero: "s0h0", target: "f0" }]]);
      const events: GameEvent[] = [];
      applyLoyalty(state, missions, createRng(seed, "test"), events);
      if (events.length > 0) {
        disobeyed += 1;
        expect(missions.get("s0h0")).toEqual({ kind: "defend", hero: "s0h0" });
        expect(events).toEqual([{ kind: "disobeyed", seat: 0, hero: "s0h0", mission: "attack" }]);
      } else {
        expect(missions.get("s0h0")?.kind).toBe("attack");
      }
    }
    expect(disobeyed).toBeGreaterThan(0);
    expect(disobeyed).toBeLessThan(40);
  });

  it("충성 3 이상 영웅과 방어 임무는 바뀌지 않는다", () => {
    const state = makeState();
    heroOf(state, "s0h1").traits.loyalty = 1;
    heroOf(state, "s0h2").traits.loyalty = 5;
    for (let seed = 1; seed <= 20; seed++) {
      const missions = new Map<string, Mission>([
        ["s0h0", { kind: "govern", hero: "s0h0" }],
        ["s0h1", { kind: "defend", hero: "s0h1" }],
        ["s0h2", { kind: "attack", hero: "s0h2", target: "f0" }],
      ]);
      const events: GameEvent[] = [];
      applyLoyalty(state, missions, createRng(seed, "test"), events);
      expect(events).toEqual([]);
    }
  });
});

describe("cautionRatio", () => {
  it("신중 4는 1.0, 5는 1.2이고 1~3은 물러나지 않는다(0)", () => {
    const hero = heroOf(makeState(), "s0h0");
    const ratios = [1, 2, 3, 4, 5].map((caution) => {
      hero.traits.caution = caution;
      return cautionRatio(hero);
    });
    expect(ratios).toEqual([0, 0, 0, 1, 1.2]);
  });
});
```

`packages/core/test/heroes.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { createRng } from "../src/rng";
import { injuryPercent, recoverHeroes, releasePrisoners, rollInjury, routHero } from "../src/rules/heroes";
import type { GameEvent } from "../src/types";
import { heroOf, makeState } from "./helpers";

describe("heroes", () => {
  it("부상 확률은 30%에 용맹 1점당 10%p를 더한다", () => {
    const hero = heroOf(makeState(), "s0h0");
    const percents = [1, 3, 5].map((valor) => {
      hero.traits.valor = valor;
      return injuryPercent(hero);
    });
    expect(percents).toEqual([10, 30, 50]);
  });

  it("부상하면 병력을 서 있는 거점에 맡기고 3턴 뒤까지 빠진다(일부 시드에서만)", () => {
    let injured = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const state = makeState();
      const hero = heroOf(state, "s0h0");
      hero.troops = 10;
      const events: GameEvent[] = [];
      rollInjury(state, hero, createRng(seed, "test"), events);
      if (hero.status === "injured") {
        injured += 1;
        expect(hero).toMatchObject({ troops: 0, injuredUntil: 3 });
        expect(state.nodes.c0.garrison).toBe(70);
        expect(events).toEqual([{ kind: "heroInjured", seat: 0, hero: "s0h0", until: 3 }]);
      } else {
        expect(hero).toMatchObject({ status: "active", troops: 10 });
        expect(events).toEqual([]);
      }
    }
    expect(injured).toBeGreaterThan(0);
    expect(injured).toBeLessThan(40);
  });

  it("후퇴할 아군 거점이 있으면 병력 40%를 데리고 물러나고 지킨 병력을 돌려준다", () => {
    const state = makeState();
    state.nodes.f0.owner = 0;
    Object.assign(heroOf(state, "s0h0"), { location: "f0", troops: 10 });
    const events: GameEvent[] = [];
    expect(routHero(state, heroOf(state, "s0h0"), 5, createRng(1, "test"), events)).toBe(4);
    expect(heroOf(state, "s0h0").location).toBe("c0");
    expect(events[0]).toEqual({ kind: "heroRouted", seat: 0, hero: "s0h0", to: "c0", troops: 4 });
  });

  it("후퇴할 곳이 없으면 점령한 자리의 포로가 된다", () => {
    const state = makeState();
    state.nodes.x5.owner = 0;
    Object.assign(heroOf(state, "s0h0"), { location: "x5", troops: 10 });
    const events: GameEvent[] = [];
    expect(routHero(state, heroOf(state, "s0h0"), 5, createRng(1, "test"), events)).toBe(0);
    expect(heroOf(state, "s0h0")).toMatchObject({ status: "captured", captor: 5, troops: 0 });
    expect(events).toEqual([{ kind: "heroCaptured", seat: 0, hero: "s0h0", by: 5 }]);
  });

  it("부상한 영웅은 injuredUntil 턴의 처리 끝에 회복한다", () => {
    const state = makeState();
    Object.assign(heroOf(state, "s0h0"), { status: "injured", injuredUntil: 3 });
    state.turn = 2;
    recoverHeroes(state, []);
    expect(heroOf(state, "s0h0").status).toBe("injured");
    state.turn = 3;
    const events: GameEvent[] = [];
    recoverHeroes(state, events);
    expect(heroOf(state, "s0h0")).toMatchObject({ status: "active", injuredUntil: null });
    expect(events).toEqual([{ kind: "heroRecovered", seat: 0, hero: "s0h0" }]);
  });

  it("잡고 있던 자리의 포로를 풀면 각자 현재 수도로 돌아가고, 수도가 없으면 out이 된다", () => {
    const state = makeState();
    Object.assign(heroOf(state, "s1h0"), { status: "captured", captor: 0, location: "x0" });
    Object.assign(heroOf(state, "s2h0"), { status: "captured", captor: 0 });
    Object.assign(heroOf(state, "s3h0"), { status: "captured", captor: 4 });
    state.seats[2].capital = null;
    const events: GameEvent[] = [];
    releasePrisoners(state, 0, events);
    expect(heroOf(state, "s1h0")).toMatchObject({ status: "active", captor: null, location: "c1", troops: 0 });
    expect(heroOf(state, "s2h0")).toMatchObject({ status: "out", captor: null });
    expect(heroOf(state, "s3h0")).toMatchObject({ status: "captured", captor: 4 });
    expect(events).toEqual([
      { kind: "heroReleased", seat: 1, hero: "s1h0", to: "c1" },
      { kind: "heroReleased", seat: 2, hero: "s2h0", to: null },
    ]);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 본다**

Run: `npx vitest run packages/core/test/traits.test.ts packages/core/test/heroes.test.ts`
Expected: FAIL, 두 파일 모두 모듈을 찾지 못한다.

- [ ] **Step 3: 특성 판정을 쓴다**

`packages/core/src/rules/traits.ts`:
```ts
import { BALANCE } from "../data/balance";
import { compareText } from "../map";
import type { Rng } from "../rng";
import type { GameEvent, GameState, Hero, Mission } from "../types";

/** 충성 판정(턴 처리 시작): 충성이 낮은 영웅은 확률적으로 이동·공격·운영 임무 대신 제자리를 지킨다. */
export function applyLoyalty(state: GameState, missions: Map<string, Mission>, rng: Rng, events: GameEvent[]): void {
  for (const hero of [...state.heroes].sort((a, b) => compareText(a.id, b.id))) {
    const mission = missions.get(hero.id);
    if (!mission || mission.kind === "defend") continue;
    const percent = BALANCE.traits.disobeyPercentByLoyalty[hero.traits.loyalty - 1];
    if (percent === 0 || rng.next() * 100 >= percent) continue;
    missions.set(hero.id, { kind: "defend", hero: hero.id });
    events.push({ kind: "disobeyed", seat: hero.seat, hero: hero.id, mission: mission.kind });
  }
}

/** 신중 기준: 무작위 폭을 뺀 부대 공격력이 방어력 × 이 값보다 낮으면 물러난다. 0이면 물러나지 않는다. */
export function cautionRatio(hero: Hero): number {
  return BALANCE.traits.cautionRatioByCaution[hero.traits.caution - 1];
}
```

- [ ] **Step 4: 부상·후퇴·포로·회복·석방을 쓴다**

`packages/core/src/rules/heroes.ts`:
```ts
import { BALANCE } from "../data/balance";
import { compareText, neighbors } from "../map";
import type { Rng } from "../rng";
import type { GameEvent, GameState, Hero, SeatId } from "../types";

/** 전투에서 진 영웅의 부상 확률(%): 기본값에 용맹 보정을 더하고 0~100으로 자른다 */
export function injuryPercent(hero: Hero): number {
  const percent = BALANCE.injury.percent + (hero.traits.valor - 3) * BALANCE.traits.valorInjuryPercentPerPoint;
  return Math.max(0, Math.min(100, percent));
}

/** 확률대로 부상시킨다. 부상한 영웅의 병력은 서 있는 아군 거점 수비대로 들어간다. */
export function rollInjury(state: GameState, hero: Hero, rng: Rng, events: GameEvent[]): void {
  if (rng.next() * 100 >= injuryPercent(hero)) return;
  const node = state.nodes[hero.location];
  if (node.owner === hero.seat) node.garrison += hero.troops;
  hero.troops = 0;
  hero.status = "injured";
  hero.injuredUntil = state.turn + BALANCE.injury.turns;
  events.push({ kind: "heroInjured", seat: hero.seat, hero: hero.id, until: hero.injuredUntil });
}

/**
 * 거점을 잃은 영웅(활동·부상). 인접 아군 거점(id 순 첫째)으로 병력 일부를 데리고 후퇴하고,
 * 활동 중이던 영웅은 부상 판정을 받는다. 갈 곳이 없으면 captor의 포로가 된다.
 * 후퇴하며 지킨 병력(포로면 0)을 돌려준다.
 */
export function routHero(state: GameState, hero: Hero, captor: SeatId, rng: Rng, events: GameEvent[]): number {
  const refuge = neighbors(state.map, hero.location)
    .filter((n) => state.nodes[n].owner === hero.seat)
    .sort(compareText)[0];
  if (refuge === undefined) {
    hero.status = "captured";
    hero.captor = captor;
    hero.troops = 0;
    hero.injuredUntil = null;
    events.push({ kind: "heroCaptured", seat: hero.seat, hero: hero.id, by: captor });
    return 0;
  }
  hero.location = refuge;
  hero.troops = Math.floor((hero.troops * BALANCE.combat.routedKeepPercent) / 100);
  const kept = hero.troops;
  events.push({ kind: "heroRouted", seat: hero.seat, hero: hero.id, to: refuge, troops: kept });
  if (hero.status === "active") rollInjury(state, hero, rng, events);
  return kept;
}

/** 부상 기간이 끝난 영웅을 활동으로 되돌린다(턴 처리 끝). */
export function recoverHeroes(state: GameState, events: GameEvent[]): void {
  for (const hero of state.heroes) {
    if (hero.status !== "injured" || hero.injuredUntil === null || hero.injuredUntil > state.turn) continue;
    hero.status = "active";
    hero.injuredUntil = null;
    events.push({ kind: "heroRecovered", seat: hero.seat, hero: hero.id });
  }
}

/** captor가 잡고 있던 포로를 풀어 각자의 현재 수도로 보낸다. 수도가 없으면 out. */
export function releasePrisoners(state: GameState, captor: SeatId, events: GameEvent[]): void {
  for (const hero of state.heroes) {
    if (hero.status !== "captured" || hero.captor !== captor) continue;
    const home = state.seats[hero.seat].capital;
    hero.captor = null;
    hero.troops = 0;
    if (home === null) {
      hero.status = "out";
    } else {
      hero.status = "active";
      hero.location = home;
    }
    events.push({ kind: "heroReleased", seat: hero.seat, hero: hero.id, to: home });
  }
}
```

- [ ] **Step 5: 테스트가 통과하는지 본다**

Run: `npx vitest run packages/core/test/traits.test.ts packages/core/test/heroes.test.ts`
Expected: `Tests  9 passed`(traits 3, heroes 6).

Run: `npm test`
Expected: `Test Files  15 passed`, `Tests  113 passed`.

Run: `npm run typecheck`
Expected: 오류 없음.

- [ ] **Step 6: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add packages/core/src/rules/traits.ts packages/core/src/rules/heroes.ts packages/core/test/traits.test.ts packages/core/test/heroes.test.ts
git -C D:/game/proxywar commit -m "feat(core): 충성·신중 판정과 부상·포로·회복·석방"
```

---

### Task 6: 전투 단계

**Files:**
- Modify: `packages/core/src/rules/combat.ts`, `packages/core/src/types.ts`
- Test: `packages/core/test/combat.test.ts`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`packages/core/test/combat.test.ts` 전체:
```ts
import { describe, expect, it } from "vitest";
import { createRng } from "../src/rng";
import { resolveCombat } from "../src/rules/combat";
import type { GameEvent, Mission } from "../src/types";
import { heroOf, makeState } from "./helpers";

function attack(hero: string, target: string): [string, Mission] {
  return [hero, { kind: "attack", hero, target }];
}

function run(state: ReturnType<typeof makeState>, ...missions: [string, Mission][]): GameEvent[] {
  const events: GameEvent[] = [];
  resolveCombat(state, new Map(missions), createRng(1, "test"), events);
  return events;
}

describe("resolveCombat", () => {
  it("약한 중립 거점을 점령하고 영웅이 들어가며 손실은 힘의 비율을 따른다", () => {
    const state = makeState();
    heroOf(state, "s0h0").troops = 100;
    const events = run(state, attack("s0h0", "f0"));
    expect(state.nodes.f0).toEqual({ id: "f0", owner: 0, garrison: 0, buildings: { production: 0, barracks: 0, walls: 0 } });
    const hero = heroOf(state, "s0h0");
    expect(hero.location).toBe("f0");
    expect(hero.troops).toBeGreaterThanOrEqual(86);
    expect(hero.troops).toBeLessThanOrEqual(91);
    expect(events.map((e) => e.kind)).toEqual(["battle", "captured"]);
    expect(events[1]).toEqual({ kind: "captured", node: "f0", from: null, to: 0 });
  });

  it("공격이 지면 공격 병력 60%를 잃고 제자리에 남는다", () => {
    const state = makeState();
    heroOf(state, "s0h0").troops = 10;
    state.nodes.f0.garrison = 100;
    const events = run(state, attack("s0h0", "f0"));
    const hero = heroOf(state, "s0h0");
    expect(hero.location).toBe("c0");
    // 남은 4명은 영웅에게 있거나, 부상했으면 수도 수비대로 들어갔다
    expect(hero.troops + state.nodes.c0.garrison).toBe(64);
    expect(state.nodes.f0.owner).toBeNull();
    expect(state.nodes.f0.garrison).toBeGreaterThanOrEqual(91);
    expect(state.nodes.f0.garrison).toBeLessThanOrEqual(94);
    expect(events[0]).toMatchObject({ kind: "battle", winner: "defender", attackerLoss: 6 });
  });

  it("같은 자리가 같은 목표를 공격하면 한 부대로 싸운다", () => {
    const state = makeState();
    heroOf(state, "s0h0").troops = 30;
    heroOf(state, "s0h1").troops = 30;
    state.nodes.f0.garrison = 50;
    const events = run(state, attack("s0h0", "f0"), attack("s0h1", "f0"));
    expect(state.nodes.f0.owner).toBe(0);
    expect(heroOf(state, "s0h1").location).toBe("f0");
    const battles = events.filter((e) => e.kind === "battle");
    expect(battles).toHaveLength(1);
    expect(battles[0]).toMatchObject({ heroes: ["s0h0", "s0h1"], attackTroops: 60 });
  });

  it("점령된 거점의 방어 영웅은 인접 아군 거점으로 병력 40%를 데리고 후퇴한다", () => {
    const state = makeState();
    state.nodes.f0.owner = 0;
    state.nodes.f0.garrison = 0;
    Object.assign(heroOf(state, "s0h0"), { location: "f0", troops: 10 });
    state.nodes.x5.owner = 5;
    Object.assign(heroOf(state, "s5h0"), { location: "x5", troops: 200 });
    const events = run(state, attack("s5h0", "f0"));
    expect(state.nodes.f0.owner).toBe(5);
    expect(heroOf(state, "s0h0").location).toBe("c0");
    expect(events).toContainEqual({ kind: "heroRouted", seat: 0, hero: "s0h0", to: "c0", troops: 4 });
    expect(events[0]).toMatchObject({ kind: "battle", defendTroops: 10, defenderLoss: 6 });
  });

  it("같은 턴에 방금 점령한 거점은 점령한 영웅이 지킨다(정산 순서와 무관)", () => {
    for (let seed = 1; seed <= 8; seed++) {
      const state = makeState();
      state.nodes.m0.owner = 0;
      Object.assign(heroOf(state, "s0h0"), { location: "m0", troops: 140 });
      state.nodes.f1.owner = 1;
      Object.assign(heroOf(state, "s1h0"), { location: "f1", troops: 1 });
      const events: GameEvent[] = [];
      resolveCombat(state, new Map([attack("s0h0", "x0"), attack("s1h0", "x0")]), createRng(seed, "test"), events);
      expect(state.nodes.x0.owner).toBe(0);
      expect(heroOf(state, "s0h0")).toMatchObject({ location: "x0", status: "active" });
      expect(events.some((e) => e.kind === "heroRouted")).toBe(false);
    }
  });

  it("후퇴할 아군 거점이 없으면 영웅은 점령한 자리의 포로가 된다", () => {
    const state = makeState();
    state.nodes.x5.owner = 0;
    state.nodes.x5.garrison = 0;
    Object.assign(heroOf(state, "s0h0"), { location: "x5", troops: 10 });
    state.nodes.m5.owner = 5;
    Object.assign(heroOf(state, "s5h0"), { location: "m5", troops: 200 });
    const events = run(state, attack("s5h0", "x5"));
    expect(state.nodes.x5.owner).toBe(5);
    expect(heroOf(state, "s0h0")).toMatchObject({ status: "captured", captor: 5, troops: 0 });
    expect(events).toContainEqual({ kind: "heroCaptured", seat: 0, hero: "s0h0", by: 5 });
  });

  it("수도가 함락되면 자원 30%를 잃고 수비대가 가장 많은 아군 거점으로 수도를 옮긴다", () => {
    const state = makeState();
    state.nodes.f0.owner = 0;
    state.nodes.f0.garrison = 30;
    state.nodes.m0.owner = 5;
    state.nodes.m0.garrison = 0;
    Object.assign(heroOf(state, "s5h0"), { location: "m0", troops: 500 });
    const events = run(state, attack("s5h0", "c0"));
    expect(state.nodes.c0.owner).toBe(5);
    expect(state.seats[0].capital).toBe("f0");
    expect(state.seats[0].treasury).toEqual({ gold: 35, food: 35, material: 14, rare: 0 });
    expect(events).toContainEqual({
      kind: "capitalMoved",
      seat: 0,
      from: "c0",
      to: "f0",
      lost: { gold: 15, food: 15, material: 6, rare: 0 },
    });
    expect(heroOf(state, "s0h3").location).toBe("f0");
  });

  it("전투에 나선 영웅은 경험치 10을 얻고 이긴 쪽은 10을 더 얻는다", () => {
    const state = makeState();
    state.nodes.f0.owner = 0;
    state.nodes.f0.garrison = 0;
    Object.assign(heroOf(state, "s0h1"), { location: "f0", troops: 100 });
    state.nodes.x5.owner = 5;
    Object.assign(heroOf(state, "s5h0"), { location: "x5", troops: 10 });
    run(state, attack("s5h0", "f0"));
    expect(state.nodes.f0.owner).toBe(0);
    expect(heroOf(state, "s0h1").exp).toBe(20);
    expect(heroOf(state, "s5h0").exp).toBe(10);
  });

  it("공격에서 진 영웅은 일부 시드에서 부상해 남은 병력을 출발 거점에 맡긴다", () => {
    let injured = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const state = makeState();
      heroOf(state, "s0h0").troops = 10;
      state.nodes.f0.garrison = 100;
      const events: GameEvent[] = [];
      resolveCombat(state, new Map([attack("s0h0", "f0")]), createRng(seed, "test"), events);
      const hero = heroOf(state, "s0h0");
      if (hero.status === "injured") {
        injured += 1;
        expect(hero).toMatchObject({ troops: 0, injuredUntil: 3 });
        expect(state.nodes.c0.garrison).toBe(64);
        expect(events.at(-1)).toEqual({ kind: "heroInjured", seat: 0, hero: "s0h0", until: 3 });
      } else {
        expect(hero.troops).toBe(4);
      }
    }
    expect(injured).toBeGreaterThan(0);
    expect(injured).toBeLessThan(40);
  });

  it("운영 중인 영웅은 서 있는 거점 방어에 끼지 않는다", () => {
    const state = makeState();
    state.nodes.f0.owner = 0;
    state.nodes.f0.garrison = 0;
    Object.assign(heroOf(state, "s0h0"), { location: "f0", troops: 100 });
    state.nodes.x5.owner = 5;
    Object.assign(heroOf(state, "s5h0"), { location: "x5", troops: 10 });
    const events = run(state, ["s0h0", { kind: "govern", hero: "s0h0" }], attack("s5h0", "f0"));
    expect(events[0]).toMatchObject({ kind: "battle", defendTroops: 0, winner: "attacker" });
    expect(state.nodes.f0.owner).toBe(5);
    expect(heroOf(state, "s0h0").location).toBe("c0");
  });

  it("신중 5 영웅은 공격력이 방어력 × 1.2에 못 미치면 물러나고, 신중 3은 그대로 싸운다", () => {
    for (const [caution, hesitates] of [
      [5, true],
      [3, false],
    ] as const) {
      const state = makeState();
      const hero = heroOf(state, "s0h0");
      hero.troops = 50;
      hero.traits.caution = caution;
      state.nodes.f0.garrison = 50;
      // 공격력 50 × 1.12 = 56, 방어력 50 × 1.0 = 50
      const events = run(state, attack("s0h0", "f0"));
      if (hesitates) {
        expect(events).toEqual([{ kind: "hesitated", seat: 0, hero: "s0h0", node: "f0" }]);
        expect(heroOf(state, "s0h0")).toMatchObject({ location: "c0", troops: 50 });
      } else {
        expect(events[0]?.kind).toBe("battle");
      }
    }
  });

  it("점령된 거점의 건물은 종류마다 한 레벨씩 내려간다", () => {
    const state = makeState();
    state.nodes.f0.owner = 0;
    state.nodes.f0.garrison = 0;
    state.nodes.f0.buildings = { production: 2, barracks: 0, walls: 1 };
    state.nodes.x5.owner = 5;
    Object.assign(heroOf(state, "s5h0"), { location: "x5", troops: 100 });
    run(state, attack("s5h0", "f0"));
    expect(state.nodes.f0).toMatchObject({ owner: 5, buildings: { production: 1, barracks: 0, walls: 0 } });
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 본다**

Run: `npx vitest run packages/core/test/combat.test.ts`
Expected: FAIL. 포로·경험치·부상·운영·신중·건물 손상 테스트가 실패한다(예: `status: "out"`이 `"captured"`가 아님, `exp`가 0).

- [ ] **Step 3: 전투 단계를 바꾼다**

`packages/core/src/rules/combat.ts` 전체:
```ts
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
```

`packages/core/src/types.ts`의 후퇴 이벤트를 좁힌다(갈 곳이 없으면 이제 `heroCaptured`다):
```ts
  | { kind: "heroRouted"; seat: SeatId; hero: string; to: NodeId; troops: number }
```

- [ ] **Step 4: 테스트가 통과하는지 본다**

Run: `npx vitest run packages/core/test/combat.test.ts`
Expected: `Tests  12 passed`.

Run: `npm test`
Expected: `Tests  118 passed`. `rule-staff.test.ts`의 30턴 테스트와 `turn.test.ts`가 깨지면 그 출력을 읽고 원인을 적는다(부상·포로로 영웅 상태가 바뀐 것은 정상이고, 검증 issues가 생기면 버그다).

Run: `npm run typecheck`
Expected: 오류 없음.

- [ ] **Step 5: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add packages/core/src/rules/combat.ts packages/core/src/types.ts packages/core/test/combat.test.ts
git -C D:/game/proxywar commit -m "feat(core): 전투의 신중 후퇴·경험치·부상·포로·건물 손상"
```

---

### Task 7: 경제 단계(운영·생산 건물·건설)

**Files:**
- Modify: `packages/core/src/rules/economy.ts`, `packages/core/src/rules/turn.ts`
- Test: `packages/core/test/economy.test.ts`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`packages/core/test/economy.test.ts` 전체:
```ts
import { describe, expect, it } from "vitest";
import { resolveEconomy } from "../src/rules/economy";
import type { GameEvent, Mission } from "../src/types";
import { heroOf, makeState, noOrders } from "./helpers";

const none = new Map<string, Mission>();

describe("resolveEconomy", () => {
  it("수도 생산을 더하고 유지비(병사 20명당 식량 1, 올림)를 뺀다", () => {
    const state = makeState();
    resolveEconomy(state, noOrders(), none, []);
    expect(state.seats[0].treasury).toEqual({ gold: 56, food: 52, material: 23, rare: 0 });
  });

  it("생산 뒤 모집하고 늘어난 병력으로 유지비를 낸다", () => {
    const state = makeState();
    const orders = noOrders();
    orders[0].recruits.push({ node: "c0", amount: 30 });
    const events: GameEvent[] = [];
    resolveEconomy(state, orders, none, events);
    expect(state.nodes.c0.garrison).toBe(90);
    expect(state.seats[0].treasury.gold).toBe(41);
    expect(state.seats[0].treasury.food).toBe(35);
    expect(events).toContainEqual({ kind: "recruited", seat: 0, node: "c0", amount: 30 });
  });

  it("자원이 모자라면 모집을 건너뛴다", () => {
    const state = makeState();
    state.seats[0].treasury.gold = 0;
    const orders = noOrders();
    orders[0].recruits.push({ node: "c0", amount: 30 });
    const events: GameEvent[] = [];
    resolveEconomy(state, orders, none, events);
    expect(state.nodes.c0.garrison).toBe(60);
    expect(events).toContainEqual({ kind: "recruitSkipped", seat: 0, node: "c0", reason: "unaffordable" });
  });

  it("그사이 잃은 거점에서는 모집을 건너뛴다", () => {
    const state = makeState();
    state.nodes.c0.owner = 5;
    const orders = noOrders();
    orders[0].recruits.push({ node: "c0", amount: 10 });
    const events: GameEvent[] = [];
    resolveEconomy(state, orders, none, events);
    expect(events).toContainEqual({ kind: "recruitSkipped", seat: 0, node: "c0", reason: "notOwned" });
  });

  it("유지비를 못 내면 식량을 모두 내고 병력 10%가 탈영한다", () => {
    const state = makeState();
    state.seats[0].treasury.food = 0;
    state.nodes.c0.garrison = 400;
    heroOf(state, "s0h0").troops = 15;
    const events: GameEvent[] = [];
    resolveEconomy(state, noOrders(), none, events);
    expect(state.seats[0].treasury.food).toBe(0);
    expect(state.nodes.c0.garrison).toBe(360);
    expect(heroOf(state, "s0h0").troops).toBe(13);
    expect(events).toContainEqual({ kind: "upkeep", seat: 0, food: 5, deserted: 42 });
  });

  it("탈락한 자리는 처리하지 않는다", () => {
    const state = makeState();
    state.seats[1].eliminatedAt = 0;
    resolveEconomy(state, noOrders(), none, []);
    expect(state.seats[1].treasury).toEqual({ gold: 50, food: 50, material: 20, rare: 0 });
  });

  it("운영 중인 영웅은 서 있는 거점 생산을 내정 × 3%만큼 늘리고 경험치 5를 얻는다", () => {
    const state = makeState();
    const events: GameEvent[] = [];
    resolveEconomy(state, noOrders(), new Map([["s0h0", { kind: "govern", hero: "s0h0" }]]), events);
    // 수도 생산 6/5/3 × 142% 내림 = 8/7/4, 유지비 3
    expect(state.seats[0].treasury).toEqual({ gold: 58, food: 54, material: 24, rare: 0 });
    expect(events).toContainEqual({ kind: "income", seat: 0, gain: { gold: 8, food: 7, material: 4, rare: 0 } });
    expect(heroOf(state, "s0h0").exp).toBe(5);
  });

  it("생산 건물은 레벨당 그 거점 생산을 50% 늘린다", () => {
    const state = makeState();
    state.nodes.c0.buildings.production = 1;
    resolveEconomy(state, noOrders(), none, []);
    // 6/5/3 × 150% 내림 = 9/7/4
    expect(state.seats[0].treasury).toEqual({ gold: 59, food: 54, material: 24, rare: 0 });
  });

  it("생산 뒤에 건물을 짓고 금 20·자재 30을 낸다", () => {
    const state = makeState();
    state.seats[0].treasury.material = 30;
    const orders = noOrders();
    orders[0].builds.push({ node: "c0", building: "walls" });
    const events: GameEvent[] = [];
    resolveEconomy(state, orders, none, events);
    expect(state.nodes.c0.buildings.walls).toBe(1);
    expect(state.seats[0].treasury).toMatchObject({ gold: 36, material: 3 });
    expect(events).toContainEqual({ kind: "built", seat: 0, node: "c0", building: "walls", level: 1 });
  });

  it("두 번째 레벨은 금 40·자재 60이고, 모자라면 짓지 않는다", () => {
    const state = makeState();
    state.nodes.c0.buildings.walls = 1;
    state.seats[0].treasury.material = 50;
    const orders = noOrders();
    orders[0].builds.push({ node: "c0", building: "walls" });
    const events: GameEvent[] = [];
    resolveEconomy(state, orders, none, events);
    expect(state.nodes.c0.buildings.walls).toBe(1);
    expect(events).toContainEqual({
      kind: "buildSkipped",
      seat: 0,
      node: "c0",
      building: "walls",
      reason: "unaffordable",
    });
  });

  it("그사이 잃은 거점에는 짓지 않는다", () => {
    const state = makeState();
    state.nodes.c0.owner = 5;
    const orders = noOrders();
    orders[0].builds.push({ node: "c0", building: "production" });
    const events: GameEvent[] = [];
    resolveEconomy(state, orders, none, events);
    expect(state.nodes.c0.buildings.production).toBe(0);
    expect(events).toContainEqual({
      kind: "buildSkipped",
      seat: 0,
      node: "c0",
      building: "production",
      reason: "notOwned",
    });
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 본다**

Run: `npx vitest run packages/core/test/economy.test.ts`
Expected: FAIL. 운영·생산 건물·건설 테스트가 실패한다(생산 보정이 없고 `built` 이벤트가 없다). 타입 검사로는 `resolveEconomy`의 인자 수가 맞지 않는다.

- [ ] **Step 3: 경제 단계를 바꾼다**

`packages/core/src/rules/economy.ts` 전체:
```ts
import { BALANCE, buildCost } from "../data/balance";
import { nodeType } from "../map";
import { totalTroops } from "../summary";
import type { Build, GameEvent, GameState, Hero, Mission, NodeId, Orders, Resources, SeatId } from "../types";
import { gainExp } from "./growth";

const KEYS = ["gold", "food", "material", "rare"] as const;

/** 생산·성장 단계: 살아 있는 자리마다 생산 → 건설 → 모집 → 유지비, 끝으로 운영한 영웅의 경험치 */
export function resolveEconomy(
  state: GameState,
  orders: Orders,
  missions: ReadonlyMap<string, Mission>,
  events: GameEvent[],
): void {
  const governors = governorsOf(state, missions);
  for (const seat of state.seats) {
    if (seat.eliminatedAt !== null) continue;
    collectIncome(state, seat.id, governors, events);
    for (const build of orders[seat.id]?.builds ?? []) buildAt(state, seat.id, build, events);
    for (const recruit of orders[seat.id]?.recruits ?? []) {
      recruitAt(state, seat.id, recruit.node, recruit.amount, events);
    }
    payUpkeep(state, seat.id, events);
  }
  for (const hero of governors) gainExp(hero, BALANCE.exp.govern);
}

/** 운영 임무를 받았고, 지금도 활동 중이며 아군 거점에 서 있는 영웅 */
function governorsOf(state: GameState, missions: ReadonlyMap<string, Mission>): Hero[] {
  return state.heroes.filter(
    (h) =>
      h.status === "active" && missions.get(h.id)?.kind === "govern" && state.nodes[h.location].owner === h.seat,
  );
}

/** 거점 생산 × (100% + 생산 건물 레벨 × 50% + 운영 영웅 최고 내정 × 3%), 자원별 내림 */
function collectIncome(state: GameState, seat: SeatId, governors: readonly Hero[], events: GameEvent[]): void {
  const gain: Resources = { gold: 0, food: 0, material: 0, rare: 0 };
  for (const node of Object.values(state.nodes)) {
    if (node.owner !== seat) continue;
    const admin = Math.max(0, ...governors.filter((h) => h.location === node.id).map((h) => h.stats.admin));
    const percent =
      100 +
      node.buildings.production * BALANCE.buildings.productionPercentPerLevel +
      admin * BALANCE.govern.percentPerAdmin;
    const produced = BALANCE.production[nodeType(state.map, node.id)];
    for (const k of KEYS) gain[k] += Math.floor((produced[k] * percent) / 100);
  }
  const treasury = state.seats[seat].treasury;
  for (const k of KEYS) treasury[k] += gain[k];
  events.push({ kind: "income", seat, gain });
}

function buildAt(state: GameState, seat: SeatId, build: Build, events: GameEvent[]): void {
  const node = state.nodes[build.node];
  if (node.owner !== seat) {
    events.push({ kind: "buildSkipped", seat, node: build.node, building: build.building, reason: "notOwned" });
    return;
  }
  const level = node.buildings[build.building] + 1;
  const cost = buildCost(level);
  const treasury = state.seats[seat].treasury;
  if (treasury.gold < cost.gold || treasury.material < cost.material) {
    events.push({ kind: "buildSkipped", seat, node: build.node, building: build.building, reason: "unaffordable" });
    return;
  }
  treasury.gold -= cost.gold;
  treasury.material -= cost.material;
  node.buildings[build.building] = level;
  events.push({ kind: "built", seat, node: build.node, building: build.building, level });
}

function recruitAt(state: GameState, seat: SeatId, node: NodeId, amount: number, events: GameEvent[]): void {
  if (state.nodes[node].owner !== seat) {
    events.push({ kind: "recruitSkipped", seat, node, reason: "notOwned" });
    return;
  }
  const units = amount / BALANCE.recruit.unit;
  const gold = units * BALANCE.recruit.costPerUnit.gold;
  const food = units * BALANCE.recruit.costPerUnit.food;
  const treasury = state.seats[seat].treasury;
  if (treasury.gold < gold || treasury.food < food) {
    events.push({ kind: "recruitSkipped", seat, node, reason: "unaffordable" });
    return;
  }
  treasury.gold -= gold;
  treasury.food -= food;
  state.nodes[node].garrison += amount;
  events.push({ kind: "recruited", seat, node, amount });
}

function payUpkeep(state: GameState, seat: SeatId, events: GameEvent[]): void {
  const treasury = state.seats[seat].treasury;
  const cost = Math.ceil(totalTroops(state, seat) / BALANCE.upkeep.soldiersPerFood);
  if (treasury.food >= cost) {
    treasury.food -= cost;
    events.push({ kind: "upkeep", seat, food: cost, deserted: 0 });
    return;
  }
  const paid = treasury.food;
  treasury.food = 0;
  const keep = (n: number): number => Math.floor((n * (100 - BALANCE.upkeep.desertionPercent)) / 100);
  let deserted = 0;
  for (const node of Object.values(state.nodes)) {
    if (node.owner !== seat) continue;
    const left = keep(node.garrison);
    deserted += node.garrison - left;
    node.garrison = left;
  }
  for (const hero of state.heroes) {
    if (hero.seat !== seat || hero.status !== "active") continue;
    const left = keep(hero.troops);
    deserted += hero.troops - left;
    hero.troops = left;
  }
  events.push({ kind: "upkeep", seat, food: paid, deserted });
}
```

`packages/core/src/rules/turn.ts`의 경제 호출을 바꾼다:
```ts
  resolveEconomy(state, orders, missions, events);
```

- [ ] **Step 4: 테스트가 통과하는지 본다**

Run: `npx vitest run packages/core/test/economy.test.ts`
Expected: `Tests  11 passed`.

Run: `npm test`
Expected: `Tests  123 passed`.

Run: `npm run typecheck`
Expected: 오류 없음.

- [ ] **Step 5: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add packages/core/src/rules/economy.ts packages/core/src/rules/turn.ts packages/core/test/economy.test.ts
git -C D:/game/proxywar commit -m "feat(core): 운영 보정·생산 건물·건설"
```

---

### Task 8: 턴 처리 연결과 탈락 때 포로 석방

**Files:**
- Modify: `packages/core/src/rules/turn.ts`, `packages/core/src/rules/victory.ts`
- Test: `packages/core/test/turn.test.ts`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`packages/core/test/turn.test.ts`의 `describe("processTurn", …)` 블록 끝(마지막 `it` 다음)에 넣는다:
```ts
  it("부상한 영웅은 세 번의 턴 처리 동안 빠졌다가 세 번째 처리 끝에 회복한다", () => {
    let state = makeState();
    Object.assign(heroOf(state, "s0h0"), { status: "injured", injuredUntil: 3 });
    for (let turn = 1; turn <= 2; turn++) {
      state = processTurn(state, noOrders()).state;
      expect(heroOf(state, "s0h0").status).toBe("injured");
    }
    const { state: next, events } = processTurn(state, noOrders());
    expect(heroOf(next, "s0h0").status).toBe("active");
    expect(events).toContainEqual({ kind: "heroRecovered", seat: 0, hero: "s0h0" });
  });

  it("탈락한 자리가 잡고 있던 포로는 풀려나 자기 수도로 돌아간다", () => {
    const state = makeState();
    Object.assign(heroOf(state, "s1h0"), { status: "captured", captor: 0 });
    state.nodes.m0.owner = 5;
    state.nodes.m0.garrison = 0;
    Object.assign(heroOf(state, "s5h0"), { location: "m0", troops: 500 });
    const orders = noOrders();
    orders[5].missions.push({ kind: "attack", hero: "s5h0", target: "c0" });
    const { state: next, events } = processTurn(state, orders);
    expect(next.seats[0].eliminatedAt).toBe(1);
    expect(heroOf(next, "s1h0")).toMatchObject({ status: "active", captor: null, location: "c1" });
    expect(events).toContainEqual({ kind: "heroReleased", seat: 1, hero: "s1h0", to: "c1" });
  });
```

- [ ] **Step 2: 테스트가 실패하는지 본다**

Run: `npx vitest run packages/core/test/turn.test.ts`
Expected: FAIL 2개(회복과 석방이 아직 `processTurn`에 없다).

- [ ] **Step 3: 턴 처리와 탈락 판정을 바꾼다**

`packages/core/src/rules/turn.ts` 전체:
```ts
import { createRng } from "../rng";
import type { GameEvent, GameState, Mission, Orders } from "../types";
import { resolveCombat } from "./combat";
import { resolveEconomy } from "./economy";
import { resolveGrowth } from "./growth";
import { recoverHeroes } from "./heroes";
import { resolveMovement } from "./movement";
import { applyLoyalty } from "./traits";
import { resolveVictory } from "./victory";

export interface TurnResult {
  state: GameState;
  events: GameEvent[];
}

/**
 * 정각 처리 한 번. 원본을 바꾸지 않고 새 상태와 이벤트를 돌려준다.
 * orders는 validatePlan을 통과한 확정 명령이다. 난수는 (매치 시드, 새 턴, 용도)에서 만든다.
 * 순서: 충성 판정 → 이동 → 전투 → 생산·건설·모집·유지비 → 레벨업 → 회복 → 탈락·종료
 */
export function processTurn(prev: GameState, orders: Orders): TurnResult {
  if (prev.ended) throw new Error("match already ended");
  const state: GameState = JSON.parse(JSON.stringify(prev));
  state.turn += 1;
  const rng = (purpose: string) => createRng(state.matchSeed, state.turn, purpose);
  const events: GameEvent[] = [];
  const missions = collectMissions(state, orders);
  applyLoyalty(state, missions, rng("loyalty"), events);
  resolveMovement(state, missions, events);
  resolveCombat(state, missions, rng("turn"), events);
  resolveEconomy(state, orders, missions, events);
  resolveGrowth(state, rng("growth"), events);
  recoverHeroes(state, events);
  resolveVictory(state, events);
  return { state, events };
}

function collectMissions(state: GameState, orders: Orders): Map<string, Mission> {
  const missions = new Map<string, Mission>();
  orders.forEach((plan, seat) => {
    if (state.seats[seat]?.eliminatedAt !== null) return;
    for (const mission of plan.missions) missions.set(mission.hero, mission);
  });
  return missions;
}
```

`packages/core/src/rules/victory.ts`:
- import에 `import { releasePrisoners } from "./heroes";`를 더한다.
- 머리 주석을 `/** 탈락(잡고 있던 포로 석방) → 과반 연속 기록 → 종료 판정 */`으로 바꾼다.
- 탈락 처리의 영웅 루프와 이벤트를 다음으로 바꾼다:
```ts
    for (const hero of state.heroes) {
      if (hero.seat !== seat.id) continue;
      hero.status = "out";
      hero.troops = 0;
      hero.injuredUntil = null;
      hero.captor = null;
    }
    events.push({ kind: "eliminated", seat: seat.id });
    releasePrisoners(state, seat.id, events);
```

- [ ] **Step 4: 테스트가 통과하는지 본다**

Run: `npx vitest run packages/core/test/turn.test.ts`
Expected: `Tests  12 passed`.

Run: `npm test`
Expected: `Tests  125 passed`.

Run: `npm run typecheck`
Expected: 오류 없음.

- [ ] **Step 5: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add packages/core/src/rules/turn.ts packages/core/src/rules/victory.ts packages/core/test/turn.test.ts
git -C D:/game/proxywar commit -m "feat(core): 충성·성장·회복 단계 연결과 탈락 때 포로 석방"
```

---

### Task 9: 점수 확장

**Files:**
- Modify: `packages/core/src/summary.ts`
- Test: `packages/core/test/state.test.ts`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`packages/core/test/state.test.ts`의 `describe("initState", …)` 블록 마지막 `it`("시작 점수는…") 다음에 넣는다:
```ts
  it("건물 레벨 합 × 3과 (영웅 레벨 − 1) 합 × 2가 점수에 더해지고 out 영웅은 빠진다", () => {
    const fresh = makeState();
    fresh.nodes.c0.buildings = { production: 2, barracks: 0, walls: 1 };
    Object.assign(heroOf(fresh, "s0h0"), { level: 3 });
    Object.assign(heroOf(fresh, "s0h1"), { level: 2 });
    Object.assign(heroOf(fresh, "s0h2"), { level: 5, status: "out" });
    expect(scoreOf(fresh, 0)).toBe(16 + 9 + 6);
  });
```

- [ ] **Step 2: 테스트가 실패하는지 본다**

Run: `npx vitest run packages/core/test/state.test.ts`
Expected: FAIL, `expected 16 to be 31`.

- [ ] **Step 3: 점수를 바꾼다**

`packages/core/src/summary.ts` 전체:
```ts
import { BALANCE, BUILDING_KINDS } from "./data/balance";
import { compareText } from "./map";
import type { GameState, NodeId, SeatId } from "./types";

export function ownedNodes(state: GameState, seat: SeatId): NodeId[] {
  return Object.values(state.nodes)
    .filter((n) => n.owner === seat)
    .map((n) => n.id)
    .sort(compareText);
}

/** 아군 거점 수비대 + 활동 중인 영웅의 병력 */
export function totalTroops(state: GameState, seat: SeatId): number {
  const garrison = Object.values(state.nodes)
    .filter((n) => n.owner === seat)
    .reduce((sum, n) => sum + n.garrison, 0);
  const heroes = state.heroes
    .filter((h) => h.seat === seat && h.status === "active")
    .reduce((sum, h) => sum + h.troops, 0);
  return garrison + heroes;
}

/** 아군 거점의 건물 레벨 합(거점 발전도) */
export function buildingLevels(state: GameState, seat: SeatId): number {
  return Object.values(state.nodes)
    .filter((n) => n.owner === seat)
    .reduce((sum, n) => sum + BUILDING_KINDS.reduce((s, k) => s + n.buildings[k], 0), 0);
}

/** out이 아닌 영웅(부상·포로 포함)의 (레벨 − 1) 합(영웅 성장) */
export function heroLevels(state: GameState, seat: SeatId): number {
  return state.heroes
    .filter((h) => h.seat === seat && h.status !== "out")
    .reduce((sum, h) => sum + h.level - 1, 0);
}

export function scoreOf(state: GameState, seat: SeatId): number {
  return (
    ownedNodes(state, seat).length * BALANCE.score.perNode +
    Math.floor(totalTroops(state, seat) / BALANCE.score.troopsPerPoint) +
    buildingLevels(state, seat) * BALANCE.score.perBuildingLevel +
    heroLevels(state, seat) * BALANCE.score.perHeroLevel
  );
}
```

- [ ] **Step 4: 테스트가 통과하는지 본다**

Run: `npx vitest run packages/core/test/state.test.ts`
Expected: `Tests  15 passed`.

Run: `npm test`
Expected: `Tests  126 passed`. `turn.test.ts`의 "턴 제한" 테스트 점수(`[16, 16, 16, 30, 16, 16]`)는 건물·레벨업이 없으므로 그대로다.

- [ ] **Step 5: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add packages/core/src/summary.ts packages/core/test/state.test.ts
git -C D:/game/proxywar commit -m "feat(core): 점수에 거점 발전도와 영웅 성장"
```

---

### Task 10: 규칙 참모의 운영·건설

**Files:**
- Modify: `packages/core/src/staff/rule-staff.ts`
- Test: `packages/core/test/rule-staff.test.ts`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`packages/core/test/rule-staff.test.ts`의 `describe("rulePlan", …)` 블록 안, "식량을 유지비 5턴 치…" 테스트 다음에 넣는다:
```ts
  it("전선이 아닌 거점에서 채울 병력도 없는 영웅은 거점을 운영한다", () => {
    const state = makeState();
    for (const n of ["f0", "m0"]) Object.assign(state.nodes[n], { owner: 0, garrison: 0 });
    const plan = rulePlan(state, 0);
    expect(validatePlan(state, 0, plan).issues).toEqual([]);
    expect(plan.missions.map((m) => m.kind)).toEqual(["govern", "govern", "govern", "govern", "govern"]);
  });

  it("자재가 되면 수도 생산 건물을 먼저 짓고 남은 금으로 모집한다", () => {
    const state = makeState();
    state.seats[0].treasury.material = 30;
    const plan = rulePlan(state, 0);
    expect(plan.builds).toEqual([{ node: "c0", building: "production" }]);
    expect(plan.recruits).toEqual([{ node: "c0", amount: 30 }]);
  });

  it("짓고 나면 금이 15 아래로 떨어질 때는 짓지 않는다", () => {
    const state = makeState();
    Object.assign(state.seats[0].treasury, { gold: 30, material: 30 });
    expect(rulePlan(state, 0).builds).toEqual([]);
  });

  it("수도 생산이 최고 레벨이면 아군 농장·광산 생산, 그것도 다 차면 수도 성벽을 짓는다", () => {
    const state = makeState();
    Object.assign(state.seats[0].treasury, { gold: 200, material: 200 });
    state.nodes.c0.buildings.production = 3;
    state.nodes.f0.owner = 0;
    expect(rulePlan(state, 0).builds).toEqual([{ node: "f0", building: "production" }]);
    state.nodes.f0.buildings.production = 3;
    expect(rulePlan(state, 0).builds).toEqual([{ node: "c0", building: "walls" }]);
  });
```

- [ ] **Step 2: 테스트가 실패하는지 본다**

Run: `npx vitest run packages/core/test/rule-staff.test.ts`
Expected: FAIL 4개(운영 대신 `move`, 건설이 빈 배열).

- [ ] **Step 3: 규칙 참모를 바꾼다**

`packages/core/src/staff/rule-staff.ts` 전체:
```ts
import { BALANCE, buildCost, recruitCap } from "../data/balance";
import { bfs, compareText, neighbors, nodeType } from "../map";
import { attackModifier, defensePower, troopCap } from "../rules/power";
import { ownedNodes, totalTroops } from "../summary";
import type { Build, GameState, Hero, Mission, NodeId, Plan, Recruit, SeatId } from "../types";
import type { Staff } from "./types";

/** 수도에 남겨 둘 수비대(1b-2에서 안전장치 세팅으로 바뀐다) */
const CAPITAL_RESERVE = 30;
/** 추정 방어력의 이 배수를 넘을 때만 공격한다 */
const ATTACK_MARGIN = 1.3;
/** 모집 뒤 식량은 예상 유지비의 이 턴 수만큼 남긴다 */
const FOOD_RESERVE_TURNS = 5;
/** 건설 뒤에도 금을 수도 모집 한 턴 치(30명 = 15)만큼 남긴다 */
const BUILD_GOLD_RESERVE = 15;

export const ruleStaff: Staff = {
  plan: async ({ state, seat }) => rulePlan(state, seat),
};

export function rulePlan(state: GameState, seat: SeatId): Plan {
  const builds = planBuilds(state, seat);
  const buildGold = builds.reduce((sum, b) => sum + buildCost(state.nodes[b.node].buildings[b.building] + 1).gold, 0);
  return { missions: planMissions(state, seat), recruits: planRecruits(state, seat, buildGold), builds };
}

function reserveAt(state: GameState, seat: SeatId, node: NodeId): number {
  return state.seats[seat].capital === node ? CAPITAL_RESERVE : 0;
}

function isFrontier(state: GameState, seat: SeatId, node: NodeId): boolean {
  return neighbors(state.map, node).some((n) => state.nodes[n].owner !== seat);
}

/** 아군 거점만 지나 goal을 만족하는 가장 가까운 아군 거점으로 가는 첫 걸음. 없으면 null. */
function stepToward(state: GameState, seat: SeatId, from: NodeId, goal: (node: NodeId) => boolean): NodeId | null {
  const { dist, prev } = bfs(state.map, from, (n) => state.nodes[n].owner === seat);
  const target: NodeId | undefined = Object.keys(dist)
    .filter((n) => n !== from && state.nodes[n].owner === seat && goal(n))
    .sort((a, b) => dist[a] - dist[b] || compareText(a, b))[0];
  if (target === undefined) return null;
  let step = target;
  while (prev[step] !== from) step = prev[step]!;
  return step;
}

/** 전선의 약한 영웅이 병력을 받으러 돌아갈 첫 걸음. 돌아갈 필요가 없거나 갈 곳이 없으면 null. */
function regroupStep(state: GameState, seat: SeatId, hero: Hero, draw: number): NodeId | null {
  const half = troopCap(hero) / 2;
  if (hero.troops + draw >= half) return null;
  const source: NodeId | undefined = ownedNodes(state, seat)
    .filter((n) => n !== hero.location && state.nodes[n].garrison - reserveAt(state, seat, n) >= half)
    .sort(
      (a, b) =>
        state.nodes[b].garrison - reserveAt(state, seat, b) - (state.nodes[a].garrison - reserveAt(state, seat, a)) ||
        compareText(a, b),
    )[0];
  if (source === undefined) return null;
  return stepToward(state, seat, hero.location, (n) => n === source);
}

/** 거점별로 이미 꺼내기로 한 뒤 남은 수비대(left)를 보고, 영웅이 서 있는 곳에서 꺼낼 수 있는 병력 */
function drawFor(state: GameState, seat: SeatId, hero: Hero, left: Record<NodeId, number>): number {
  const garrison = left[hero.location] ?? state.nodes[hero.location].garrison;
  return Math.max(0, Math.min(garrison - reserveAt(state, seat, hero.location), troopCap(hero) - hero.troops));
}

/** froms에 인접한 아군이 아닌 거점(claimed 제외)을 추정 방어력이 낮은 순으로 */
function attackTargets(
  state: GameState,
  seat: SeatId,
  froms: readonly NodeId[],
  claimed: ReadonlySet<NodeId>,
): { node: NodeId; def: number }[] {
  const nodes = new Set(froms.flatMap((f) => neighbors(state.map, f)));
  return [...nodes]
    .filter((n) => state.nodes[n].owner !== seat && !claimed.has(n))
    .map((n) => ({ node: n, def: defensePower(state, n) }))
    .sort((a, b) => a.def - b.def || compareText(a.node, b.node));
}

function planMissions(state: GameState, seat: SeatId): Mission[] {
  const planned = new Map<string, Mission>();
  const left: Record<NodeId, number> = {};
  const claimed = new Set<NodeId>();
  const heroes = state.heroes
    .filter((h) => h.seat === seat && h.status === "active")
    .sort((a, b) => compareText(a.id, b.id));
  const idle = (): Hero[] => heroes.filter((h) => !planned.has(h.id));
  const takeDraw = (hero: Hero): number => {
    const draw = drawFor(state, seat, hero, left);
    left[hero.location] = (left[hero.location] ?? state.nodes[hero.location].garrison) - draw;
    return draw;
  };

  // 1) 혼자 깰 수 있는 가장 약한 이웃을 공격한다
  for (const hero of heroes) {
    const force = (hero.troops + drawFor(state, seat, hero, left)) * attackModifier(hero);
    const target = attackTargets(state, seat, [hero.location], claimed).find((t) => force > t.def * ATTACK_MARGIN);
    if (!target) continue;
    claimed.add(target.node);
    planned.set(hero.id, { kind: "attack", hero: hero.id, target: target.node, draw: takeDraw(hero) });
  }

  // 2) 혼자 못 깨는 목표는 인접한 남은 영웅들이 합쳐 넘을 수 있으면 함께 공격한다
  for (const target of attackTargets(state, seat, idle().map((h) => h.location), claimed)) {
    // 같은 거점 수비대를 앞 영웅이 다 꺼내면 뒤 영웅은 병력 0이 되므로, 실제로 병력을 든 영웅만 센다
    const trial = { ...left };
    let troops = 0;
    const group = idle().filter((h) => {
      if (!neighbors(state.map, h.location).includes(target.node)) return false;
      const draw = drawFor(state, seat, h, trial);
      trial[h.location] = (trial[h.location] ?? state.nodes[h.location].garrison) - draw;
      troops += h.troops + draw;
      return h.troops + draw > 0;
    });
    if (group.length < 2) continue;
    if (troops * Math.max(...group.map((h) => attackModifier(h))) <= target.def * ATTACK_MARGIN) continue;
    claimed.add(target.node);
    for (const h of group) planned.set(h.id, { kind: "attack", hero: h.id, target: target.node, draw: takeDraw(h) });
  }

  // 3) 나머지: 약하면 병력 있는 거점까지 돌아간다(전선이든 내부든). 전선이면 지키고,
  //    내부에서 채울 병력도 없이 약하면 거점을 운영하며, 아니면 전선으로 나간다(갈 전선이 없으면 운영)
  for (const hero of idle()) {
    const draw = drawFor(state, seat, hero, left);
    const back = regroupStep(state, seat, hero, draw);
    if (back !== null) {
      planned.set(hero.id, { kind: "move", hero: hero.id, to: back, draw: 0 });
      continue;
    }
    const here = hero.location;
    if (isFrontier(state, seat, here)) {
      planned.set(hero.id, { kind: "defend", hero: hero.id });
      continue;
    }
    const weak = hero.troops + draw < troopCap(hero) / 2;
    const step = weak ? null : stepToward(state, seat, here, (n) => isFrontier(state, seat, n));
    if (step === null) planned.set(hero.id, { kind: "govern", hero: hero.id });
    else planned.set(hero.id, { kind: "move", hero: hero.id, to: step, draw: takeDraw(hero) });
  }
  return heroes.map((h) => planned.get(h.id)!);
}

/**
 * 턴당 최대 1건: 현재 수도 생산 → 아군 농장·광산 생산(id 순) → 현재 수도 성벽 → 현재 수도 병영 중
 * 최고 레벨이 아니고 자재가 되며 짓고 나서 금이 BUILD_GOLD_RESERVE 이상 남는 첫 후보.
 */
function planBuilds(state: GameState, seat: SeatId): Build[] {
  const capital = state.seats[seat].capital;
  if (capital === null) return [];
  const { gold, material } = state.seats[seat].treasury;
  const resourceNodes = ownedNodes(state, seat).filter((n) => ["farm", "mine"].includes(nodeType(state.map, n)));
  const candidates: Build[] = [
    { node: capital, building: "production" },
    ...resourceNodes.map((node): Build => ({ node, building: "production" })),
    { node: capital, building: "walls" },
    { node: capital, building: "barracks" },
  ];
  const pick = candidates.find((c) => {
    const level = state.nodes[c.node].buildings[c.building] + 1;
    if (level > BALANCE.buildings.maxLevel) return false;
    const cost = buildCost(level);
    return material >= cost.material && gold - cost.gold >= BUILD_GOLD_RESERVE;
  });
  return pick ? [pick] : [];
}

/** buildGold는 같은 계획의 건설에 먼저 쓴 금 */
function planRecruits(state: GameState, seat: SeatId, buildGold: number): Recruit[] {
  const { gold, food } = state.seats[seat].treasury;
  const { unit, costPerUnit } = BALANCE.recruit;
  let spentGold = buildGold;
  let spentFood = 0;
  let troops = totalTroops(state, seat);
  const recruits: Recruit[] = [];
  for (const node of ownedNodes(state, seat)) {
    const cap = recruitCap(state, seat, node);
    let amount = 0;
    while (amount + unit <= cap) {
      const nextGold = spentGold + costPerUnit.gold;
      const nextFood = spentFood + costPerUnit.food;
      const upkeep = Math.ceil((troops + unit) / BALANCE.upkeep.soldiersPerFood);
      if (gold < nextGold || food - nextFood < upkeep * FOOD_RESERVE_TURNS) break;
      spentGold = nextGold;
      spentFood = nextFood;
      troops += unit;
      amount += unit;
    }
    if (amount > 0) recruits.push({ node, amount });
  }
  return recruits;
}
```

- [ ] **Step 4: 테스트가 통과하는지 본다**

Run: `npx vitest run packages/core/test/rule-staff.test.ts`
Expected: `Tests  11 passed`(1a의 7개 그대로 + 새 4개).

Run: `npm test`
Expected: `Tests  130 passed`.

Run: `npm run typecheck`
Expected: 오류 없음.

- [ ] **Step 5: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add packages/core/src/staff/rule-staff.ts packages/core/test/rule-staff.test.ts
git -C D:/game/proxywar commit -m "feat(core): 규칙 참모의 운영·건설"
```

---

### Task 11: 공개 API, 매치 기록·보고서, 등급·특성 혼합 실행

**Files:**
- Modify: `packages/core/src/index.ts`, `packages/sim/src/runner.ts`, `packages/sim/src/report.ts`
- Create: `packages/sim/configs/rule6-traits.json`
- Test: `packages/sim/test/runner.test.ts`, `packages/sim/test/report.test.ts`

- [ ] **Step 1: 실행 설정을 만든다**

`packages/sim/configs/rule6-traits.json`(등급 슬롯을 지킨다: 1·2성 1개, 3·4성 2개, 5성 3개):
```json
{
  "name": "rule6-traits",
  "map": "ring6",
  "turns": 120,
  "seed": 1,
  "seats": [
    { "name": "Aster", "staff": { "kind": "rule" }, "heroes": [
      { "name": "Aster-1", "grade": 1, "growth": 1.5, "traits": { "valor": 5 } },
      { "name": "Aster-2", "grade": 1, "growth": 1.5, "traits": { "valor": 5 } },
      { "name": "Aster-3", "grade": 1, "growth": 1.5, "traits": { "valor": 5 } },
      { "name": "Aster-4", "grade": 1, "growth": 1.5, "traits": { "valor": 5 } },
      { "name": "Aster-5", "grade": 1, "growth": 1.5, "traits": { "valor": 5 } } ] },
    { "name": "Briar", "staff": { "kind": "rule" }, "heroes": [
      { "name": "Briar-1", "grade": 5, "traits": { "loyalty": 5, "caution": 5, "valor": 1 } },
      { "name": "Briar-2", "grade": 5, "traits": { "loyalty": 5, "caution": 5, "valor": 1 } },
      { "name": "Briar-3", "grade": 5, "traits": { "loyalty": 5, "caution": 5, "valor": 1 } },
      { "name": "Briar-4", "grade": 5, "traits": { "loyalty": 5, "caution": 5, "valor": 1 } },
      { "name": "Briar-5", "grade": 5, "traits": { "loyalty": 5, "caution": 5, "valor": 1 } } ] },
    { "name": "Cobalt", "staff": { "kind": "rule" }, "heroes": [
      { "name": "Cobalt-1", "grade": 3, "traits": { "loyalty": 1, "valor": 4 } },
      { "name": "Cobalt-2", "grade": 3, "traits": { "loyalty": 1, "valor": 4 } },
      { "name": "Cobalt-3", "grade": 3, "traits": { "loyalty": 1, "valor": 4 } },
      { "name": "Cobalt-4", "grade": 3, "traits": { "loyalty": 1, "valor": 4 } },
      { "name": "Cobalt-5", "grade": 3, "traits": { "loyalty": 1, "valor": 4 } } ] },
    { "name": "Dune", "staff": { "kind": "rule" }, "heroes": [
      { "name": "Dune-1", "grade": 2, "traits": { "caution": 4 } },
      { "name": "Dune-2", "grade": 2, "traits": { "caution": 4 } },
      { "name": "Dune-3", "grade": 2, "traits": { "caution": 4 } },
      { "name": "Dune-4", "grade": 2, "traits": { "caution": 4 } },
      { "name": "Dune-5", "grade": 2, "traits": { "caution": 4 } } ] },
    { "name": "Ember", "staff": { "kind": "rule" }, "heroes": [
      { "name": "Ember-1", "grade": 4, "traits": { "loyalty": 2, "caution": 4 } },
      { "name": "Ember-2", "grade": 4, "traits": { "loyalty": 2, "caution": 4 } },
      { "name": "Ember-3", "grade": 4, "traits": { "loyalty": 2, "caution": 4 } },
      { "name": "Ember-4", "grade": 4, "traits": { "loyalty": 2, "caution": 4 } },
      { "name": "Ember-5", "grade": 4, "traits": { "loyalty": 2, "caution": 4 } } ] },
    { "name": "Frost", "staff": { "kind": "rule" }, "heroes": [
      { "name": "Frost-1", "grade": 3 }, { "name": "Frost-2", "grade": 3 }, { "name": "Frost-3", "grade": 3 },
      { "name": "Frost-4", "grade": 3 }, { "name": "Frost-5", "grade": 3 } ] }
  ]
}
```

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`packages/sim/test/runner.test.ts`:
- `const config = parseRunConfig(raw);` 다음 줄에 넣는다:
```ts
const traitsRaw = JSON.parse(readFileSync(new URL("../configs/rule6-traits.json", import.meta.url), "utf8"));
```
- `describe("runMatch", …)` 블록 끝에 넣는다:
```ts
  it("등급·특성이 섞인 매치도 끝까지 돌고 레벨업·건설·부상·명령 불복이 일어난다", async () => {
    const record = await run(parseRunConfig(traitsRaw));
    expect(record.version).toBe(2);
    expect(record.turns.every((t) => t.issues.every((list) => list.length === 0))).toBe(true);
    const kinds = [...new Set(record.turns.flatMap((t) => t.events.map((e) => e.kind)))];
    for (const kind of ["levelUp", "built", "heroInjured", "disobeyed"]) expect(kinds).toContain(kind);
    expect(record.turns.at(-1)?.metrics[0]).toHaveProperty("heroLevels");
  });
```

`packages/sim/test/report.test.ts`의 `expect(md).toContain("점령:");` 다음 줄에 넣는다:
```ts
      expect(md).toContain("| 순위 | 자리 | 점수 | 거점 | 병력 | 건물 | 영웅 레벨 | 탈락 |");
      expect(md).toContain("## 영웅·건설 통계");
```

- [ ] **Step 3: 테스트가 실패하는지 본다**

Run: `npx vitest run packages/sim`
Expected: FAIL. `record.version`이 1이고, 보고서에 새 열·절이 없다.

- [ ] **Step 4: 공개 API를 더한다**

`packages/core/src/index.ts` 전체:
```ts
export type * from "./types";
export { createRng, type Rng } from "./rng";
export { BALANCE, BUILDING_KINDS, buildCost, recruitCap, terrainOf } from "./data/balance";
export { bfs, compareText, getMap, neighbors, nodeType } from "./map";
export { HeroSetupSchema, MatchSetupSchema, SeatSetupSchema, TraitsSetupSchema, type MatchSetup } from "./setup";
export { initState } from "./state";
export { buildingLevels, heroLevels, ownedNodes, scoreOf, totalTroops } from "./summary";
export { validatePlan, type CheckedPlan, type PlanIssue } from "./orders";
export { processTurn, type TurnResult } from "./rules/turn";
export { rulePlan, ruleStaff } from "./staff/rule-staff";
export type { Staff, StaffInput } from "./staff/types";
```

- [ ] **Step 5: 매치 기록을 바꾼다**

`packages/sim/src/runner.ts`:
- import 목록에 `buildingLevels,`와 `heroLevels,`를 `initState,` 앞에 더한다.
- `SeatMetrics`에 `score: number;` 다음 두 필드를 더한다:
```ts
  /** 건물 레벨 합 */
  buildings: number;
  /** out이 아닌 영웅의 (레벨 − 1) 합 */
  heroLevels: number;
```
- `MatchRecord`의 `version: 1;`을 `version: 2;`로, `runMatch`의 반환 `version: 1`을 `version: 2`로 바꾼다.
- `seatMetrics`의 `score: scoreOf(state, s.id),` 다음에 넣는다:
```ts
    buildings: buildingLevels(state, s.id),
    heroLevels: heroLevels(state, s.id),
```

- [ ] **Step 6: 보고서를 바꾼다**

`packages/sim/src/report.ts` 전체:
```ts
import { BALANCE, type GameEvent, type MatchResult } from "@proxywar/core";
import type { MatchRecord } from "./runner";

const REASON: Record<MatchResult["reason"], string> = {
  earlyVictory: `조기 승리(과반 ${BALANCE.victory.majorityStreak}턴 유지)`,
  lastStanding: "마지막 생존",
  turnLimit: "턴 제한",
};

/** 자리별로 세는 영웅·건설 사건 */
const STAT_KINDS = ["levelUp", "heroInjured", "heroCaptured", "disobeyed", "hesitated", "built"] as const;
type StatKind = (typeof STAT_KINDS)[number];
const STAT_LABELS: Record<StatKind, string> = {
  levelUp: "레벨업",
  heroInjured: "부상",
  heroCaptured: "포로로 잡힘",
  disobeyed: "명령 불복",
  hesitated: "신중 후퇴",
  built: "건설",
};

export function renderReport(record: MatchRecord): string {
  const names = record.config.seats.map((s) => s.name);
  const name = (seat: number | null): string => (seat === null ? "중립" : names[seat]);
  const heroNames = new Map(record.initialState.heroes.map((h) => [h.id, h.name]));
  const heroName = (id: string): string => heroNames.get(id) ?? id;
  const last = record.turns[record.turns.length - 1];
  const result = record.result;
  const lines: string[] = [];

  lines.push(`# 매치 보고서: ${record.config.name}`, "");
  lines.push(`- 맵: ${record.config.map} · 시드: ${record.config.seed} · 진행 턴: ${last.turn}/${record.config.turns}`);
  lines.push(`- 종료: ${REASON[result.reason]} · 승자: ${name(result.winner)}`, "");

  lines.push(
    "## 최종 순위",
    "",
    "| 순위 | 자리 | 점수 | 거점 | 병력 | 건물 | 영웅 레벨 | 탈락 |",
    "|---|---|---|---|---|---|---|---|",
  );
  result.ranking.forEach((seat, i) => {
    const m = last.metrics[seat];
    lines.push(
      `| ${i + 1} | ${name(seat)} | ${result.scores[seat]} | ${m.nodes} | ${m.troops} | ${m.buildings} | ${m.heroLevels} | ${m.eliminated ? "예" : ""} |`,
    );
  });

  lines.push("", "## 거점 수 추이", "", `| 턴 | ${names.join(" | ")} |`, `|---|${names.map(() => "---").join("|")}|`);
  for (const t of record.turns) {
    if (t.turn % 10 !== 0 && t !== last) continue;
    lines.push(`| ${t.turn} | ${t.metrics.map((m) => m.nodes).join(" | ")} |`);
  }

  lines.push("", "## 주요 사건", "");
  for (const t of record.turns) {
    for (const e of t.events) {
      const text = describe(e, name, heroName);
      if (text) lines.push(`- T${t.turn} ${text}`);
    }
  }

  const counts = names.map(() => Object.fromEntries(STAT_KINDS.map((k) => [k, 0])) as Record<StatKind, number>);
  for (const t of record.turns) {
    for (const e of t.events) if (isStat(e)) counts[e.seat][e.kind] += 1;
  }
  lines.push(
    "",
    "## 영웅·건설 통계",
    "",
    `| 자리 | ${STAT_KINDS.map((k) => STAT_LABELS[k]).join(" | ")} |`,
    `|---|${STAT_KINDS.map(() => "---").join("|")}|`,
  );
  names.forEach((n, seat) => lines.push(`| ${n} | ${STAT_KINDS.map((k) => counts[seat][k]).join(" | ")} |`));

  const issues = record.turns.flatMap((t) =>
    t.issues.flatMap((list, seat) => list.map((i) => `- T${t.turn} ${name(seat)}: ${i.item}[${i.index}] ${i.reason}`)),
  );
  lines.push("", "## 무효 명령", "", ...(issues.length > 0 ? issues : ["없음"]), "");
  return lines.join("\n");
}

function isStat(e: GameEvent): e is Extract<GameEvent, { kind: StatKind }> {
  return (STAT_KINDS as readonly string[]).includes(e.kind);
}

function describe(e: GameEvent, name: (seat: number | null) => string, heroName: (id: string) => string): string | null {
  switch (e.kind) {
    case "captured":
      return `점령: ${e.node} (${name(e.from)} → ${name(e.to)})`;
    case "capitalMoved":
      return `수도 함락: ${name(e.seat)} ${e.from} → ${e.to ?? "없음"}`;
    case "eliminated":
      return `탈락: ${name(e.seat)}`;
    case "heroCaptured":
      return `포로: ${heroName(e.hero)} (${name(e.seat)} → ${name(e.by)})`;
    case "heroReleased":
      return `석방: ${heroName(e.hero)} (${name(e.seat)})`;
    default:
      return null;
  }
}
```

- [ ] **Step 7: 테스트가 통과하는지 본다**

Run: `npx vitest run packages/sim`
Expected: `Tests  7 passed`(runner 6, report 1).

Run: `npm test`
Expected: `Test Files  15 passed`, `Tests  131 passed`.

Run: `npm run typecheck`
Expected: 오류 없음.

- [ ] **Step 8: 두 설정으로 실제 매치를 돌려 보고서를 읽는다**

Run: `npm run sim -- run packages/sim/configs/rule6.json`
Run: `npm run sim -- run packages/sim/configs/rule6-traits.json`
Expected: 각각 `<종료 이유> · 승자 <이름> · <턴 수>턴 → runs/<시각>-<이름>` 한 줄.

두 `report.md`를 열어 다음을 읽고 결과를 적는다(Task 12의 보고 재료):
- 종료 이유·승자·턴 수.
- "영웅·건설 통계" 표에서 자리마다 레벨업·건설이 0보다 큰지, Cobalt(충성 1)에 명령 불복이 있는지.
- "주요 사건"의 자리 간 점령이 매치 내내 있는지. 1a 변경 9처럼 수십 턴 동안 자리 간 점령이 없는 정체가 보이면 수치를 고치지 말고 구간과 원인 추정을 적어 사용자에게 알린다(수치 조정은 1d 범위다).

- [ ] **Step 9: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add packages/core/src/index.ts packages/sim/src/runner.ts packages/sim/src/report.ts packages/sim/configs/rule6-traits.json packages/sim/test/runner.test.ts packages/sim/test/report.test.ts
git -C D:/game/proxywar commit -m "feat(sim): 기록 version 2, 영웅·건설 통계 보고서, 등급·특성 혼합 설정"
```

---

### Task 12: 전체 검증과 문서 갱신

**Files:**
- Modify: `AGENTS.md`, `docs/superpowers/plans/2026-10-27-sim-core-1b-1-heroes-buildings.md`(머리말)
- Create: `docs/archive/reports/proxywar-sim-core-1b-1_implementation.html`

- [ ] **Step 1: 전체 테스트와 타입 검사를 돌린다**

Run: `npm test`
Expected: `Test Files  15 passed`, `Tests  131 passed`(core 124, sim 7).

Run: `npm run typecheck`
Expected: 오류 없음, 종료 코드 0.

- [ ] **Step 2: 범위를 대조한다**

머리말 "1b-1 범위"의 항목마다 그 항목을 구현한 Task와 테스트를 짚는다. 빠진 것이 있으면 보고에 적는다. 실행 중 계획과 다르게 한 것은 머리말 "설계서 대비 변경" 끝에 "(실행 중 반영)" 번호로 이유와 함께 더한다(1a 계획 방식).

- [ ] **Step 3: AGENTS.md를 갱신한다**

"지금 어디에 있나" 절의 `1b는 세 조각(…)으로 나눴고 1b-1 계획을 썼다(…, 제안표 검토 대기).` 문장을 다음으로 바꾼다:
```
1b는 세 조각(1b-1 영웅·건물, 1b-2 시야·세팅·제약·조건부 명령, 1b-3 외교)이고 1b-1 구현 완료(계획 `docs/superpowers/plans/2026-10-27-sim-core-1b-1-heroes-buildings.md`). 다음은 1b-2 계획.
```

- [ ] **Step 4: 구현 보고서를 만든다**

`design-report` 스킬로 `docs/archive/reports/proxywar-sim-core-1b-1_implementation.html`을 만든다. 변경 파일, 테스트 결과(Step 1 출력), Task 11 Step 8의 두 매치 결과(종료 이유·승자·턴 수, 영웅·건설 통계 요약, 정체 여부), 확정된 세부 규칙 표, 설계서 대비 변경, 다음 조각(1b-2)을 담는다.

- [ ] **Step 5: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add AGENTS.md docs/superpowers/plans/2026-10-27-sim-core-1b-1-heroes-buildings.md docs/archive/reports/proxywar-sim-core-1b-1_implementation.html
git -C D:/game/proxywar commit -m "docs: 1b-1 영웅·건물 구현 완료 기록"
```
