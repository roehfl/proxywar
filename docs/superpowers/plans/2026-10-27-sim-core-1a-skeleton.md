# 1a 코어 뼈대 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 규칙 참모 6명이 맵 1장에서 120턴 매치를 결정적으로 끝까지 돌고, `npm run sim -- run <설정>`이 `match.json`과 `report.md`를 남긴다.

**Architecture:** `packages/core`(순수 TypeScript, Node API 금지)에 게임 상태 타입, 시드 난수, 맵·수치 데이터, 명령 검증, 턴 처리(`processTurn` = 이동 → 전투 → 생산·모집·유지비 → 승리·탈락)와 규칙 참모를 둔다. `processTurn`은 상태를 JSON 복제한 뒤 단계 함수들이 복제본을 고쳐 새 상태와 이벤트 목록을 돌려준다. `packages/sim`(Node)은 실행 설정 검증, 매치 실행기, Markdown 보고서, CLI를 맡는다.

**Tech Stack:** Node 24.11.1, npm 11.6.2 workspaces, TypeScript 7.0.2, zod 4.6.7, vitest 5.0.5, tsx 4.23.15, @types/node(설치 시점 최신).

**설계서:** `docs/superpowers/specs/2026-10-27-sim-core-design.md`(승인 2026-10-27)의 하위 프로젝트 1을 4슬라이스로 나눈 것 중 1a다(결정 기록 `docs/design/brainstorm-log.md`). 1b 규칙 완성, 1c LLM 참모, 1d 측정은 각자 계획을 따로 쓴다.

**1a 범위:** 맵 1장, 자원 4종 생산, 모집과 유지비, 영웅이 이끄는 이동·공격·방어, 전투·점령·후퇴, 수도 이전, 탈락, 조기 승리·턴 제한·마지막 생존, 점수, 단순 규칙 참모, `run` CLI, 기본 `report.md`.
**1a에서 하지 않는 것(1b 이후):** 시야(1a 참모는 전체 상태를 본다), 건물, 세팅 5종, 참모 메모, 조건부 명령, 제약·확정 순서, 외교, 영웅 성장·아웃라이어·부상·포로, 세팅 프리셋, LLM, `batch`·`replay`·`report` 명령.

**설계서 대비 변경(이유 포함):**
1. **`processTurn(state, orders)`는 난수를 인자로 받지 않는다.** 상태의 `matchSeed`와 새 턴 번호로 만든다. 설계서 3절의 "무작위는 (매치 시드, 턴, 자리)에서" 규칙과 같고, 호출자가 다른 난수를 넘기는 실수가 없어진다.
2. **탈락한 자리는 살아 있는 자리보다 아래이고, 탈락끼리는 늦게 탈락한 쪽이 위다.** 탈락 시점에는 거점·병력이 0이라 "그 시점의 점수"가 모두 0이 되므로 탈락 순서로 가른다.
3. **비율 수치는 정수 연산이 되게 백분율·나눗셈으로 둔다**(유지비 "병사 20명당 식량 1", 탈영 10%, 후퇴 생존 40%, 수도 함락 손실 30%). 부동소수 오차로 올림·내림이 1씩 어긋나는 것을 막는다. 전투 손실만 실수 비율이다.
4. **영웅의 1a 능력치는 4종 모두 등급 기준값**(1★ 10, 2★ 12, 3★ 14, 4★ 16, 5★ 18)이다. 설계서에 레벨 1 값이 없다. 성장은 1b.
5. **영웅이 병력을 데려가는 방법은 임무의 `draw`**(현재 거점 수비대에서 꺼낼 병력 수, 통솔 상한까지)다. 설계서는 "영웅이 부대를 이끈다"만 정했다.
6. **1a 실행 설정의 참모 종류는 `rule` 하나**다. `llm`은 1c에서 더한다.
7. **(실행 중 반영) 모집 상한은 그 자리의 현재 수도 기준이다**(사용자 결정 2026-10-27). `recruitCap(state, seat, node)`가 현재 수도면 30, 도시나 현재 수도가 아닌 원래 수도 거점이면 20, 나머지 0을 돌려준다. 거점 타입만 보면 수도가 농장으로 옮겨진 자리가 다시는 모집할 수 없다는 코드 리뷰 지적에서 나왔다. 같은 리뷰로 `orders.ts`의 거점 존재 확인을 `Object.hasOwn`으로, `initState`의 맵을 깊은 복사로 바꾸고 자리 수 검사를 더했으며, 난수 고정값 테스트를 더했다.
8. **(실행 중 반영) Task 7 전투 버그 수정.** 점령한 영웅이 같은 턴에 그 거점 방어에서 빠져, 뒤에 정산되는 다른 자리 부대가 병력 1로 빼앗을 수 있었다. 점령 뒤 공격 영웅을 `committed`에서 빼고, 공격 승리 때 `defenderLoss`는 후퇴한 방어 영웅이 지킨 병력을 뺀 값으로 고쳤다. 회귀 테스트(여러 시드)와 순위·탈락 자리 명령 테스트를 더했다.
9. **(실행 중 반영) 규칙 참모에 합동 공격을 더했다.** 계획대로 만든 규칙 참모는 영웅마다 혼자 깰 목표만 고르고 다른 영웅이 고른 목표는 피해서, `rule6` 매치가 T2 이후 118턴 동안 정체됐다(영웅들이 88·18·20명으로 흩어져 요새 방어 90 × 1.3을 아무도 못 넘음). 설계서 5.5의 "평범한 플레이어"에 못 미치므로, 수치·상수는 그대로 두고 단계를 셋으로 바꿨다: ① 혼자 깰 수 있는 목표 공격 ② 혼자 못 깨는 목표는 인접한 남은 영웅(병력이 있는 2명 이상)이 합쳐 넘으면 함께 공격 ③ 나머지는 전선 이동·병력 보충·방어. 반영 뒤 같은 설정 매치에서 자리 간 점령 287건, 수도 함락 12건, 탈락 2자리가 나왔다. 테스트 1개 추가.
10. **(실행 중 반영) Task 10~12 코드 리뷰 수정.** ① 전선의 약한 영웅이 보충하러 한 칸 들어갔다가 다음 턴 다시 전선으로 나가는 왕복(시드 1–8에서 8–41회)을 막으려고, 3단계에서 병력 보충(`regroupStep`)을 전선·내부 가리지 않고 먼저 본다. ② 합동 공격은 같은 수비대를 나눠 꺼낸 뒤 실제로 병력을 든 영웅만 그룹에 넣는다. ③ CLI는 `--out` 값이 없으면 사용법을 낸다. ④ 실행 설정은 모르는 키를 거부하고(`.strict()`), `name`은 `^[\w-]+$`만 받는다. ⑤ 보고서의 조기 승리 문구는 수치 표에서 턴 수를 읽는다. 참모에게 상태 사본을 넘기는 일은 LLM 참모가 붙는 1c로 미뤘다. 반영 뒤 시드 1·2·3 매치는 82·84·74턴에 조기 승리로 끝났다(승자가 모두 다름). 테스트 2개 추가.

**수치·맵 시작값(제안, 사용자 검토 대상).** 설계서 5.4대로 이 계획에서 처음 제안한다. 실측으로 조정한다.

| 항목 | 값 |
|---|---|
| 맵 `ring6` | 거점 30개. 자리마다 수도 1 + 농장 1 + 광산 1. 이웃 자리 사이에 요새 1(6개). 안쪽 고리 6개(희귀 자원지 3, 도시 3). 이웃 수도까지 4칸 |
| 턴당 생산 (금/식량/자재/희귀) | 수도 6/5/3/0, 도시 4/2/1/0, 요새 1/1/1/0, 농장 1/6/0/0, 광산 1/0/6/0, 희귀 자원지 1/0/0/2 |
| 중립 수비대 | 도시 40, 요새 60, 농장 20, 광산 20, 희귀 자원지 40 |
| 지형 방어 배수 | 수도 1.3, 도시 1.1, 요새 1.5, 나머지 1.0 |
| 모집 | 10명 단위, 10명당 금 5·식량 5, 턴당 상한 현재 수도 30·도시 20(점령한 남의 원래 수도도 20). 다른 거점은 모집 불가 |
| 유지비 | 병사 20명당 식량 1(올림). 모자라면 식량 0, 모든 병력 10% 탈영 |
| 시작 | 금 50, 식량 50, 자재 20, 희귀 0, 수도 수비대 60, 영웅 5명 모두 수도에 병력 0 |
| 영웅 | 공격·방어 배수 `1 + (무력 − 10) × 0.03`(3★ 1.12, 5★ 1.24), 통솔 1당 병력 상한 10(3★ 140) |
| 전투 | 양쪽 힘에 무작위 ±10%. 이긴 쪽 손실 = 병력 × (진 쪽 힘 ÷ 이긴 쪽 힘) × 0.6(올림). 공격이 지면 공격 병력 60% 손실(올림), 방어 손실은 같은 식. 동률이면 방어 승 |
| 점령 | 수비대 0, 그 자리의 다른 자리 영웅은 인접 아군 거점으로 후퇴(병력 40% 유지), 갈 곳이 없으면 `out` |
| 수도 함락 | 자원 30% 손실, 수비대가 가장 많은 아군 거점으로 이전 |
| 승리 | 거점 16개(과반) 12턴 연속, 또는 마지막 생존, 또는 턴 제한 뒤 점수 1위 |
| 점수 | 거점 1개당 10 + 병력 10명당 1 |
| 규칙 참모 | 수도에 30 남기고 꺼냄, 추정 방어력 × 1.3을 넘을 때만 공격, 식량은 예상 유지비 5턴 치를 남기고 모집 |

**실행 주체:** 모든 단계를 에이전트가 실행한다(의존성 설치 포함, 공통 G-004). 명령은 모두 `D:/game/proxywar`에서 실행한다.

**브랜치·커밋:** 실행 시작 때 사용자에게 묻는다. 승인되면 `sim-core-1a` 브랜치를 만들고, 첫 커밋으로 승인된 설계 문서(설계서·결정 기록·AGENTS.md·설계 보고서·이 계획)를 넣은 뒤 Task마다 끝에서 커밋한다. 승인이 없으면 커밋 단계를 건너뛴다. push·main 머지는 하지 않는다. 검증 출력은 실제로 읽고 Expected와 대조한 뒤에만 다음 단계로 간다(공통 G-006).

---

## 파일 구조

```
package.json                     workspaces, 스크립트(test·typecheck·sim)
tsconfig.base.json               공통 컴파일 옵션
vitest.config.ts                 테스트 위치
.gitignore                       node_modules/, runs/ 추가
packages/core/
  package.json                   @proxywar/core, zod
  tsconfig.json                  src만, types: [] (Node API 금지 장치)
  tsconfig.test.json             src + test, Node 타입
  src/types.ts                   상태·명령·이벤트 타입
  src/rng.ts                     시드 난수
  src/data/balance.json          수치 표
  src/data/balance.ts            BALANCE, recruitCap
  src/data/maps/ring6.json       맵 1장
  src/map.ts                     getMap, neighbors, nodeType, bfs, compareText
  src/setup.ts                   매치 설정 zod 스키마
  src/state.ts                   initState
  src/summary.ts                 ownedNodes, totalTroops, scoreOf
  src/orders.ts                  validatePlan
  src/rules/power.ts             전투력·통솔 상한·방어자
  src/rules/movement.ts          이동 단계
  src/rules/combat.ts            전투 단계(점령·후퇴·수도 이전)
  src/rules/economy.ts           생산·모집·유지비 단계
  src/rules/victory.ts           탈락·과반·종료 판정
  src/rules/turn.ts              processTurn
  src/staff/types.ts             Staff 인터페이스
  src/staff/rule-staff.ts        규칙 참모
  src/index.ts                   공개 API
  test/helpers.ts                makeSetup, makeState, heroOf, noOrders
  test/*.test.ts
packages/sim/
  package.json                   @proxywar/sim
  tsconfig.json
  configs/rule6.json             규칙 참모 6명 실행 설정
  src/config.ts                  실행 설정 zod 스키마
  src/runner.ts                  runMatch, staffFor, seatMetrics
  src/report.ts                  renderReport
  src/run-command.ts             runCommand
  src/cli.ts                     명령줄 진입점
  test/*.test.ts
```

---

### Task 1: 저장소 뼈대와 의존성

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `vitest.config.ts`, `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/tsconfig.test.json`, `packages/sim/package.json`, `packages/sim/tsconfig.json`
- Modify: `.gitignore`

- [ ] **Step 1: 브랜치·커밋 여부를 사용자에게 묻고, 승인되면 브랜치를 만들어 설계 문서를 커밋한다**

```bash
git -C D:/game/proxywar switch -c sim-core-1a
git -C D:/game/proxywar add AGENTS.md docs/design/brainstorm-log.md docs/superpowers/specs/2026-10-27-sim-core-design.md docs/archive/reports/proxywar-sim-core_design.html docs/superpowers/plans/2026-10-27-sim-core-1a-skeleton.md
git -C D:/game/proxywar commit -m "docs: 시뮬레이션 코어 설계서·설계 보고서·1a 계획"
```
Expected: `Switched to a new branch 'sim-core-1a'`, 커밋 1개(파일 5개).

- [ ] **Step 2: 루트 `package.json`을 만든다**

```json
{
  "name": "proxywar",
  "private": true,
  "type": "module",
  "workspaces": ["packages/core", "packages/sim"],
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc -p packages/core/tsconfig.json && tsc -p packages/core/tsconfig.test.json && tsc -p packages/sim/tsconfig.json",
    "sim": "tsx packages/sim/src/cli.ts"
  }
}
```

- [ ] **Step 3: `tsconfig.base.json`과 `vitest.config.ts`를 만든다**

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "preserve",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true
  }
}
```

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["packages/*/test/**/*.test.ts"] },
});
```

- [ ] **Step 4: 두 패키지의 `package.json`·`tsconfig`를 만든다**

`packages/core/package.json`:
```json
{
  "name": "@proxywar/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" }
}
```

`packages/core/tsconfig.json` (`types: []`로 Node 전역 타입을 막아 core가 Node API를 쓰면 타입 검사가 실패한다):
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "lib": ["ES2023"], "types": [] },
  "include": ["src"]
}
```

`packages/core/tsconfig.test.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "types": ["node"] },
  "include": ["src", "test"]
}
```

`packages/sim/package.json`:
```json
{
  "name": "@proxywar/sim",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "dependencies": { "@proxywar/core": "0.0.0" }
}
```

`packages/sim/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "lib": ["ES2023"], "types": ["node"] },
  "include": ["src", "test"]
}
```

- [ ] **Step 5: `.gitignore` 끝의 두 줄을 바꾼다**

바꿀 부분:
```
# 공통 스킬·서브에이전트 정션은 .git/info/exclude에 있다(D:/game/tools/link-common.sh)
# 엔진별 무시 규칙은 엔진 결정 후 추가
```
바꾼 뒤:
```
# 공통 스킬·서브에이전트 정션은 .git/info/exclude에 있다(D:/game/tools/link-common.sh)

# Node
node_modules/

# 시뮬레이션 실행 결과
runs/
```

- [ ] **Step 6: 의존성을 설치한다**

```bash
npm install -D -E typescript@7.0.2 vitest@5.0.5 tsx@4.23.15 @types/node
npm install -E zod@4.6.7 -w @proxywar/core -w @proxywar/sim
```
Expected: 두 명령 모두 `added N packages` 형태로 끝나고 `ERR!`이 없다. 루트 `package.json`에 `devDependencies` 4개가, 두 패키지 `package.json`에 `"zod": "4.6.7"`이 생긴다. `node_modules/@proxywar/core`가 `packages/core`로 연결된다.

- [ ] **Step 7: 도구 버전과 빈 테스트 실행을 확인한다**

```bash
npx tsc --version
npx vitest --version
npx vitest run --passWithNoTests
```
Expected: `Version 7.0.2`, `vitest/5.0.5`(뒤에 플랫폼 문자열), `No test files found` 뒤 종료 코드 0.

- [ ] **Step 8: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add package.json package-lock.json tsconfig.base.json vitest.config.ts .gitignore packages/core/package.json packages/core/tsconfig.json packages/core/tsconfig.test.json packages/sim/package.json packages/sim/tsconfig.json
git -C D:/game/proxywar commit -m "chore(sim): npm workspaces·TypeScript·vitest 뼈대"
```

---

### Task 2: 상태 타입과 시드 난수

**Files:**
- Create: `packages/core/src/types.ts`, `packages/core/src/rng.ts`
- Test: `packages/core/test/rng.test.ts`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`packages/core/test/rng.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { createRng } from "../src/rng";

describe("createRng", () => {
  it("같은 부분이면 같은 수열을 낸다", () => {
    const a = createRng(7, 3, "turn");
    const b = createRng(7, 3, "turn");
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });

  it("부분이 하나라도 다르면 다른 수열을 낸다", () => {
    expect(createRng(7, 3, "turn").next()).not.toBe(createRng(7, 4, "turn").next());
  });

  it("next는 0 이상 1 미만이다", () => {
    const rng = createRng(1);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("range는 min 이상 max 미만이다", () => {
    const rng = createRng(2);
    for (let i = 0; i < 1000; i++) {
      const v = rng.range(0.9, 1.1);
      expect(v).toBeGreaterThanOrEqual(0.9);
      expect(v).toBeLessThan(1.1);
    }
  });

  it("shuffle은 원소를 보존하고 원본을 바꾸지 않는다", () => {
    const items = ["a", "b", "c", "d", "e"];
    const out = createRng(3).shuffle(items);
    expect([...out].sort()).toEqual(items);
    expect(items).toEqual(["a", "b", "c", "d", "e"]);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run packages/core/test/rng.test.ts`
Expected: FAIL — `../src/rng`를 찾지 못함(`Failed to resolve import`).

- [ ] **Step 3: 타입과 난수를 구현한다**

`packages/core/src/types.ts`:
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

export interface NodeState {
  id: NodeId;
  owner: SeatId | null;
  garrison: number;
}

export interface HeroStats {
  might: number;
  command: number;
  admin: number;
  mobility: number;
}

export interface Hero {
  id: string;
  seat: SeatId;
  name: string;
  grade: number;
  growth: number;
  stats: HeroStats;
  location: NodeId;
  troops: number;
  status: "active" | "out";
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
  | { kind: "defend"; hero: string };

export interface Recruit {
  node: NodeId;
  amount: number;
}

export interface Plan {
  missions: Mission[];
  recruits: Recruit[];
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
  | { kind: "matchEnded"; result: MatchResult };
```

`packages/core/src/rng.ts`:
```ts
export interface Rng {
  /** 0 이상 1 미만 */
  next(): number;
  /** min 이상 max 미만 */
  range(min: number, max: number): number;
  /** 원본을 바꾸지 않고 섞은 사본을 돌려준다 */
  shuffle<T>(items: readonly T[]): T[];
}

function hashParts(parts: readonly (string | number)[]): number {
  let h = 2166136261;
  for (const ch of parts.join("|")) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 부분들(매치 시드, 턴, 용도 등)에서 결정적인 난수열을 만든다(mulberry32). */
export function createRng(...parts: (string | number)[]): Rng {
  let a = hashParts(parts);
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    shuffle: (items) => {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run packages/core/test/rng.test.ts`
Expected: `Tests  5 passed`.

- [ ] **Step 5: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add packages/core/src/types.ts packages/core/src/rng.ts packages/core/test/rng.test.ts
git -C D:/game/proxywar commit -m "feat(core): 상태 타입과 시드 난수"
```

---

### Task 3: 맵과 수치 데이터

**Files:**
- Create: `packages/core/src/data/balance.json`, `packages/core/src/data/balance.ts`, `packages/core/src/data/maps/ring6.json`, `packages/core/src/map.ts`
- Test: `packages/core/test/map.test.ts`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`packages/core/test/map.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { bfs, getMap, neighbors } from "../src/map";

const map = getMap("ring6");

describe("ring6", () => {
  it("거점 30개, 수도 6개, 간선 36개다", () => {
    expect(map.nodes).toHaveLength(30);
    expect(map.capitals).toHaveLength(6);
    expect(map.edges).toHaveLength(36);
  });

  it("거점 id는 중복이 없고 수도는 capital 타입이다", () => {
    const ids = map.nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(30);
    for (const c of map.capitals) {
      expect(map.nodes.find((n) => n.id === c)?.type).toBe("capital");
    }
  });

  it("간선은 있는 거점끼리만 잇고 중복이 없다", () => {
    const ids = new Set(map.nodes.map((n) => n.id));
    const keys = new Set<string>();
    for (const [a, b] of map.edges) {
      expect(a).not.toBe(b);
      expect(ids.has(a) && ids.has(b)).toBe(true);
      keys.add([a, b].sort().join("-"));
    }
    expect(keys.size).toBe(36);
  });

  it("모든 거점이 이어져 있다", () => {
    expect(Object.keys(bfs(map, "c0").dist)).toHaveLength(30);
  });

  it("이웃 수도까지 최단 거리는 4다", () => {
    for (let i = 0; i < 6; i++) {
      expect(bfs(map, map.capitals[i]).dist[map.capitals[(i + 1) % 6]]).toBe(4);
    }
  });

  it("neighbors는 양방향 간선을 모두 찾는다", () => {
    expect(neighbors(map, "f0").sort()).toEqual(["c0", "x5"]);
  });

  it("bfs는 passable이 거짓인 거점 너머로 퍼지지 않는다", () => {
    const { dist } = bfs(map, "c0", (n) => n === "f0");
    expect(Object.keys(dist).sort()).toEqual(["c0", "f0", "m0", "x5"]);
  });

  it("없는 맵은 예외다", () => {
    expect(() => getMap("nope")).toThrow("unknown map: nope");
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run packages/core/test/map.test.ts`
Expected: FAIL — `../src/map`을 찾지 못함.

- [ ] **Step 3: 수치 표를 만든다**

`packages/core/src/data/balance.json`:
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
  "hero": { "baseStatByGrade": [10, 12, 14, 16, 18], "mightBonusPerPoint": 0.03, "troopsPerCommand": 10 },
  "combat": { "randomSpread": 0.1, "winnerLossFactor": 0.6, "loserAttackerLossFactor": 0.6, "routedKeepPercent": 40 },
  "capitalLossPercent": 30,
  "victory": { "majorityStreak": 12 },
  "score": { "perNode": 10, "troopsPerPoint": 10 }
}
```

`packages/core/src/data/balance.ts`:
```ts
import type { NodeType } from "../types";
import balance from "./balance.json";

export const BALANCE = balance;

/** 그 거점 타입의 턴당 모집 상한. 모집할 수 없는 타입은 0. */
export function recruitCap(type: NodeType): number {
  return type === "capital" || type === "city" ? BALANCE.recruit.capPerTurn[type] : 0;
}
```

- [ ] **Step 4: 맵을 만든다**

`packages/core/src/data/maps/ring6.json` — 자리 i의 수도 `ci`, 농장 `fi`, 광산 `mi`. 자리 i와 i+1 사이의 요새 `xi`(`mi`와 `f(i+1)`을 잇는다). 안쪽 고리 `i0`~`i5`(짝수는 희귀 자원지, 홀수는 도시)이고 `xi`가 `ii`와 이어진다.
```json
{
  "id": "ring6",
  "capitals": ["c0", "c1", "c2", "c3", "c4", "c5"],
  "nodes": [
    { "id": "c0", "type": "capital" }, { "id": "c1", "type": "capital" }, { "id": "c2", "type": "capital" },
    { "id": "c3", "type": "capital" }, { "id": "c4", "type": "capital" }, { "id": "c5", "type": "capital" },
    { "id": "f0", "type": "farm" }, { "id": "f1", "type": "farm" }, { "id": "f2", "type": "farm" },
    { "id": "f3", "type": "farm" }, { "id": "f4", "type": "farm" }, { "id": "f5", "type": "farm" },
    { "id": "m0", "type": "mine" }, { "id": "m1", "type": "mine" }, { "id": "m2", "type": "mine" },
    { "id": "m3", "type": "mine" }, { "id": "m4", "type": "mine" }, { "id": "m5", "type": "mine" },
    { "id": "x0", "type": "fortress" }, { "id": "x1", "type": "fortress" }, { "id": "x2", "type": "fortress" },
    { "id": "x3", "type": "fortress" }, { "id": "x4", "type": "fortress" }, { "id": "x5", "type": "fortress" },
    { "id": "i0", "type": "rare" }, { "id": "i1", "type": "city" }, { "id": "i2", "type": "rare" },
    { "id": "i3", "type": "city" }, { "id": "i4", "type": "rare" }, { "id": "i5", "type": "city" }
  ],
  "edges": [
    ["c0", "f0"], ["c0", "m0"], ["c1", "f1"], ["c1", "m1"], ["c2", "f2"], ["c2", "m2"],
    ["c3", "f3"], ["c3", "m3"], ["c4", "f4"], ["c4", "m4"], ["c5", "f5"], ["c5", "m5"],
    ["m0", "x0"], ["x0", "f1"], ["m1", "x1"], ["x1", "f2"], ["m2", "x2"], ["x2", "f3"],
    ["m3", "x3"], ["x3", "f4"], ["m4", "x4"], ["x4", "f5"], ["m5", "x5"], ["x5", "f0"],
    ["x0", "i0"], ["x1", "i1"], ["x2", "i2"], ["x3", "i3"], ["x4", "i4"], ["x5", "i5"],
    ["i0", "i1"], ["i1", "i2"], ["i2", "i3"], ["i3", "i4"], ["i4", "i5"], ["i5", "i0"]
  ]
}
```

`packages/core/src/map.ts`:
```ts
import ring6 from "./data/maps/ring6.json";
import type { GameMap, NodeId, NodeType } from "./types";

const MAPS: Record<string, GameMap> = { ring6: ring6 as GameMap };

export function getMap(id: string): GameMap {
  const map = MAPS[id];
  if (!map) throw new Error(`unknown map: ${id}`);
  return map;
}

/** 로캘과 무관한 문자열 비교(정렬을 결정적으로 유지한다). */
export function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function neighbors(map: GameMap, node: NodeId): NodeId[] {
  const out: NodeId[] = [];
  for (const [a, b] of map.edges) {
    if (a === node) out.push(b);
    else if (b === node) out.push(a);
  }
  return out;
}

export function nodeType(map: GameMap, node: NodeId): NodeType {
  const found = map.nodes.find((n) => n.id === node);
  if (!found) throw new Error(`unknown node: ${node}`);
  return found.type;
}

export interface BfsResult {
  dist: Record<NodeId, number>;
  prev: Record<NodeId, NodeId | null>;
}

/** from에서 너비 우선 탐색. passable이 거짓인 거점은 도달은 하되 그 너머로 퍼지지 않는다. */
export function bfs(map: GameMap, from: NodeId, passable: (node: NodeId) => boolean = () => true): BfsResult {
  const dist: Record<NodeId, number> = { [from]: 0 };
  const prev: Record<NodeId, NodeId | null> = { [from]: null };
  const queue: NodeId[] = [from];
  while (queue.length > 0) {
    const node = queue.shift()!;
    if (node !== from && !passable(node)) continue;
    for (const next of neighbors(map, node).sort(compareText)) {
      if (next in dist) continue;
      dist[next] = dist[node] + 1;
      prev[next] = node;
      queue.push(next);
    }
  }
  return { dist, prev };
}
```

- [ ] **Step 5: 통과와 타입 검사를 확인한다**

Run: `npx vitest run packages/core/test/map.test.ts`
Expected: `Tests  8 passed`.

Run: `npx tsc -p packages/core/tsconfig.json`
Expected: 출력 없음, 종료 코드 0. JSON 기본 import에서 `TS1259`가 나오면 `tsconfig.base.json`의 `compilerOptions`에 `"allowSyntheticDefaultImports": true`를 넣고 다시 실행한다.

- [ ] **Step 6: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add packages/core/src/data packages/core/src/map.ts packages/core/test/map.test.ts
git -C D:/game/proxywar commit -m "feat(core): ring6 맵과 수치 표 시작값"
```

---

### Task 4: 매치 설정과 초기 상태

**Files:**
- Create: `packages/core/src/setup.ts`, `packages/core/src/state.ts`, `packages/core/src/summary.ts`, `packages/core/test/helpers.ts`
- Test: `packages/core/test/state.test.ts`

- [ ] **Step 1: 테스트 도우미와 실패하는 테스트를 쓴다**

`packages/core/test/helpers.ts`:
```ts
import type { MatchSetup } from "../src/setup";
import { initState } from "../src/state";
import type { GameState, Hero, Orders } from "../src/types";

export function makeSetup(seed = 1): MatchSetup {
  return {
    map: "ring6",
    turns: 120,
    seed,
    seats: Array.from({ length: 6 }, (_, i) => ({
      name: `Seat${i}`,
      heroes: Array.from({ length: 5 }, (_, j) => ({ name: `H${i}${j}`, grade: 3, growth: 1 })),
    })),
  };
}

export function makeState(seed = 1): GameState {
  return initState(makeSetup(seed));
}

export function heroOf(state: GameState, id: string): Hero {
  const hero = state.heroes.find((h) => h.id === id);
  if (!hero) throw new Error(`no hero ${id}`);
  return hero;
}

export function noOrders(): Orders {
  return Array.from({ length: 6 }, () => ({ missions: [], recruits: [] }));
}
```

`packages/core/test/state.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { MatchSetupSchema } from "../src/setup";
import { scoreOf } from "../src/summary";
import { heroOf, makeSetup, makeState } from "./helpers";

describe("MatchSetupSchema", () => {
  it("올바른 설정을 받아들이고 성장 계수 기본값을 채운다", () => {
    const raw = JSON.parse(JSON.stringify(makeSetup()));
    delete raw.seats[0].heroes[0].growth;
    const parsed = MatchSetupSchema.parse(raw);
    expect(parsed.seats[0].heroes[0].growth).toBe(1);
  });

  it("자리가 6개가 아니면 거부한다", () => {
    const raw = makeSetup();
    expect(() => MatchSetupSchema.parse({ ...raw, seats: raw.seats.slice(0, 5) })).toThrow();
  });
});

describe("initState", () => {
  const state = makeState();

  it("자리마다 시작 수도를 갖는다", () => {
    for (let i = 0; i < 6; i++) {
      expect(state.seats[i].capital).toBe(`c${i}`);
      expect(state.nodes[`c${i}`]).toEqual({ id: `c${i}`, owner: i, garrison: 60 });
    }
  });

  it("수도가 아닌 거점은 타입별 중립 수비대를 갖는다", () => {
    expect(state.nodes.x0).toEqual({ id: "x0", owner: null, garrison: 60 });
    expect(state.nodes.f0.garrison).toBe(20);
    expect(state.nodes.i0.garrison).toBe(40);
    expect(state.nodes.i1.garrison).toBe(40);
  });

  it("영웅 30명이 수도에서 병력 0으로 시작하고 능력치는 등급 기준값이다", () => {
    expect(state.heroes).toHaveLength(30);
    const hero = heroOf(state, "s2h4");
    expect(hero).toMatchObject({ seat: 2, name: "H24", location: "c2", troops: 0, status: "active" });
    expect(hero.stats).toEqual({ might: 14, command: 14, admin: 14, mobility: 14 });
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

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run packages/core/test/state.test.ts`
Expected: FAIL — `../src/setup`을 찾지 못함.

- [ ] **Step 3: 설정 스키마, 초기 상태, 집계를 구현한다**

`packages/core/src/setup.ts`:
```ts
import { z } from "zod";

export const HeroSetupSchema = z.object({
  name: z.string().min(1),
  grade: z.number().int().min(1).max(5),
  growth: z.number().positive().default(1),
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

`packages/core/src/state.ts`:
```ts
import { BALANCE } from "./data/balance";
import { getMap } from "./map";
import type { MatchSetup } from "./setup";
import type { GameState, Hero, NodeState, SeatState } from "./types";

export function initState(setup: MatchSetup): GameState {
  const map = getMap(setup.map);
  const nodes: Record<string, NodeState> = {};
  for (const node of map.nodes) {
    nodes[node.id] = { id: node.id, owner: null, garrison: BALANCE.neutralGarrison[node.type] };
  }
  const seats: SeatState[] = setup.seats.map((seat, i) => {
    const capital = map.capitals[i];
    nodes[capital] = { id: capital, owner: i, garrison: BALANCE.start.capitalGarrison };
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
        location: map.capitals[i],
        troops: 0,
        status: "active",
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

`packages/core/src/summary.ts`:
```ts
import { BALANCE } from "./data/balance";
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

export function scoreOf(state: GameState, seat: SeatId): number {
  return (
    ownedNodes(state, seat).length * BALANCE.score.perNode +
    Math.floor(totalTroops(state, seat) / BALANCE.score.troopsPerPoint)
  );
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run packages/core/test/state.test.ts`
Expected: `Tests  8 passed`.

- [ ] **Step 5: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add packages/core/src/setup.ts packages/core/src/state.ts packages/core/src/summary.ts packages/core/test/helpers.ts packages/core/test/state.test.ts
git -C D:/game/proxywar commit -m "feat(core): 매치 설정 스키마와 초기 상태"
```

---

### Task 5: 명령 검증

**Files:**
- Create: `packages/core/src/orders.ts`
- Test: `packages/core/test/orders.test.ts`

규칙: 임무는 그 자리의 활동 중인 영웅에게 하나씩. `draw`는 0 이상 정수. `move`는 인접한 아군 거점으로, `attack`은 인접한 아군이 아닌 거점으로. 모집은 아군 수도·도시에서 10명 단위로, 같은 거점 합계가 턴당 상한 이하. 잘못된 항목은 빼고 이유를 남긴다(1c에서 규칙 참모 대체를 붙인다). 임무가 없는 영웅은 제자리에 있는다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`packages/core/test/orders.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { validatePlan } from "../src/orders";
import type { GameState, Mission, Plan, Recruit } from "../src/types";
import { heroOf, makeState } from "./helpers";

function reasons(state: GameState, plan: Plan): string[] {
  return validatePlan(state, 0, plan).issues.map((i) => i.reason);
}

function missionsOnly(...missions: Mission[]): Plan {
  return { missions, recruits: [] };
}

function recruitsOnly(...recruits: Recruit[]): Plan {
  return { missions: [], recruits };
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
      ],
      recruits: [{ node: "c0", amount: 30 }],
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
  ])("잘못된 임무를 뺀다: %s", (_, mission, reason) => {
    expect(reasons(makeState(), missionsOnly(mission))).toEqual([reason]);
  });

  it("활동하지 않는 영웅의 임무를 뺀다", () => {
    const state = makeState();
    heroOf(state, "s0h0").status = "out";
    expect(reasons(state, missionsOnly({ kind: "defend", hero: "s0h0" }))).toEqual(["hero not active"]);
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

  it("같은 거점 모집 합계가 상한을 넘으면 넘는 항목을 뺀다", () => {
    const checked = validatePlan(makeState(), 0, recruitsOnly({ node: "c0", amount: 20 }, { node: "c0", amount: 20 }));
    expect(checked.plan.recruits).toEqual([{ node: "c0", amount: 20 }]);
    expect(checked.issues).toEqual([{ item: "recruit", index: 1, reason: "over cap" }]);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run packages/core/test/orders.test.ts`
Expected: FAIL — `../src/orders`를 찾지 못함.

- [ ] **Step 3: 구현한다**

`packages/core/src/orders.ts`:
```ts
import { BALANCE, recruitCap } from "./data/balance";
import { neighbors, nodeType } from "./map";
import type { GameState, Mission, Plan, Recruit, SeatId } from "./types";

export interface PlanIssue {
  item: "mission" | "recruit";
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
  return { plan: { missions, recruits }, issues };
}

function missionIssue(state: GameState, seat: SeatId, mission: Mission, used: ReadonlySet<string>): string | null {
  const hero = state.heroes.find((h) => h.id === mission.hero);
  if (!hero) return "unknown hero";
  if (hero.seat !== seat) return "not your hero";
  if (hero.status !== "active") return "hero not active";
  if (used.has(hero.id)) return "duplicate hero";
  if (mission.kind === "defend") return null;
  if (mission.draw !== undefined && (!Number.isInteger(mission.draw) || mission.draw < 0)) return "bad draw";
  const dest = mission.kind === "move" ? mission.to : mission.target;
  if (!(dest in state.nodes)) return "unknown node";
  if (!neighbors(state.map, hero.location).includes(dest)) return "not adjacent";
  const owner = state.nodes[dest].owner;
  if (mission.kind === "move" && owner !== seat) return "move target not own";
  if (mission.kind === "attack" && owner === seat) return "attack target is own";
  return null;
}

function recruitIssue(state: GameState, seat: SeatId, recruit: Recruit, already: number): string | null {
  if (!(recruit.node in state.nodes)) return "unknown node";
  if (state.nodes[recruit.node].owner !== seat) return "not own node";
  const cap = recruitCap(nodeType(state.map, recruit.node));
  if (cap === 0) return "cannot recruit here";
  const unit = BALANCE.recruit.unit;
  if (!Number.isInteger(recruit.amount) || recruit.amount <= 0 || recruit.amount % unit !== 0) return "bad amount";
  if (already + recruit.amount > cap) return "over cap";
  return null;
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run packages/core/test/orders.test.ts`
Expected: `Tests  16 passed`.

- [ ] **Step 5: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add packages/core/src/orders.ts packages/core/test/orders.test.ts
git -C D:/game/proxywar commit -m "feat(core): 참모 계획 항목별 검증"
```

---

### Task 6: 전투력 계산과 이동 단계

**Files:**
- Create: `packages/core/src/rules/power.ts`, `packages/core/src/rules/movement.ts`
- Test: `packages/core/test/power.test.ts`, `packages/core/test/movement.test.ts`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`packages/core/test/power.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { defensePower, heroModifier, troopCap } from "../src/rules/power";
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
});
```

`packages/core/test/movement.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { resolveMovement } from "../src/rules/movement";
import type { GameEvent, Mission } from "../src/types";
import { heroOf, makeState } from "./helpers";

describe("resolveMovement", () => {
  it("move는 병력을 꺼내 인접 아군 거점으로 옮긴다", () => {
    const state = makeState();
    state.nodes.f0.owner = 0;
    state.nodes.f0.garrison = 0;
    const events: GameEvent[] = [];
    resolveMovement(state, new Map<string, Mission>([["s0h0", { kind: "move", hero: "s0h0", to: "f0", draw: 20 }]]), events);
    expect(heroOf(state, "s0h0")).toMatchObject({ location: "f0", troops: 20 });
    expect(state.nodes.c0.garrison).toBe(40);
    expect(events).toEqual([
      { kind: "drew", seat: 0, hero: "s0h0", node: "c0", amount: 20 },
      { kind: "moved", seat: 0, hero: "s0h0", from: "c0", to: "f0" },
    ]);
  });

  it("꺼내는 병력은 수비대와 통솔 상한을 넘지 않고, attack은 이 단계에서 움직이지 않는다", () => {
    const state = makeState();
    state.nodes.c0.garrison = 500;
    resolveMovement(state, new Map<string, Mission>([["s0h0", { kind: "attack", hero: "s0h0", target: "f0", draw: 1000 }]]), []);
    expect(heroOf(state, "s0h0")).toMatchObject({ location: "c0", troops: 140 });
    expect(state.nodes.c0.garrison).toBe(360);
  });

  it("defend와 임무 없는 영웅은 그대로다", () => {
    const state = makeState();
    const events: GameEvent[] = [];
    resolveMovement(state, new Map<string, Mission>([["s0h0", { kind: "defend", hero: "s0h0" }]]), events);
    expect(heroOf(state, "s0h0")).toMatchObject({ location: "c0", troops: 0 });
    expect(events).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run packages/core/test/power.test.ts packages/core/test/movement.test.ts`
Expected: FAIL — `../src/rules/power`, `../src/rules/movement`를 찾지 못함.

- [ ] **Step 3: 구현한다**

`packages/core/src/rules/power.ts`:
```ts
import { BALANCE } from "../data/balance";
import { nodeType } from "../map";
import type { GameState, Hero, NodeId } from "../types";

/** 영웅 무력에 따른 공격·방어 배수. 영웅이 없으면 1. */
export function heroModifier(hero: Hero | undefined): number {
  if (!hero) return 1;
  return 1 + (hero.stats.might - BALANCE.hero.baseStatByGrade[0]) * BALANCE.hero.mightBonusPerPoint;
}

export function troopCap(hero: Hero): number {
  return hero.stats.command * BALANCE.hero.troopsPerCommand;
}

export function bestHero(heroes: readonly Hero[]): Hero | undefined {
  let best: Hero | undefined;
  for (const h of heroes) if (!best || h.stats.might > best.stats.might) best = h;
  return best;
}

export function sumTroops(heroes: readonly Hero[]): number {
  return heroes.reduce((sum, h) => sum + h.troops, 0);
}

/** 거점 주인의 영웅 중 그 거점에 있는 활동 영웅. exclude는 이번 턴 공격에 나선 영웅. */
export function defenders(state: GameState, node: NodeId, exclude: ReadonlySet<string> = new Set()): Hero[] {
  const owner = state.nodes[node].owner;
  if (owner === null) return [];
  return state.heroes.filter(
    (h) => h.status === "active" && h.seat === owner && h.location === node && !exclude.has(h.id),
  );
}

/** 무작위 폭을 뺀 방어력. 규칙 참모의 추정에도 쓴다. */
export function defensePower(state: GameState, node: NodeId, exclude: ReadonlySet<string> = new Set()): number {
  const heroes = defenders(state, node, exclude);
  const troops = state.nodes[node].garrison + sumTroops(heroes);
  return troops * heroModifier(bestHero(heroes)) * BALANCE.terrain[nodeType(state.map, node)];
}

/** 무작위 폭을 뺀 공격력 */
export function attackPower(heroes: readonly Hero[]): number {
  return sumTroops(heroes) * heroModifier(bestHero(heroes));
}
```

`packages/core/src/rules/movement.ts`:
```ts
import type { GameEvent, GameState, Hero, Mission } from "../types";
import { troopCap } from "./power";

/** 영웅이 서 있는 거점 수비대에서 병력을 꺼낸다(수비대와 통솔 상한까지). */
export function drawTroops(state: GameState, hero: Hero, requested: number, events: GameEvent[]): void {
  const node = state.nodes[hero.location];
  const amount = Math.max(0, Math.min(requested, node.garrison, troopCap(hero) - hero.troops));
  if (amount === 0) return;
  node.garrison -= amount;
  hero.troops += amount;
  events.push({ kind: "drew", seat: hero.seat, hero: hero.id, node: node.id, amount });
}

/** 이동 단계: move·attack의 병력 꺼내기와 move의 이동. 공격 자체는 전투 단계에서 한다. */
export function resolveMovement(state: GameState, missions: ReadonlyMap<string, Mission>, events: GameEvent[]): void {
  for (const hero of state.heroes) {
    const mission = missions.get(hero.id);
    if (!mission || mission.kind === "defend" || hero.status !== "active") continue;
    drawTroops(state, hero, mission.draw ?? 0, events);
    if (mission.kind === "move") {
      const from = hero.location;
      hero.location = mission.to;
      events.push({ kind: "moved", seat: hero.seat, hero: hero.id, from, to: mission.to });
    }
  }
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run packages/core/test/power.test.ts packages/core/test/movement.test.ts`
Expected: `Tests  6 passed`.

- [ ] **Step 5: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add packages/core/src/rules/power.ts packages/core/src/rules/movement.ts packages/core/test/power.test.ts packages/core/test/movement.test.ts
git -C D:/game/proxywar commit -m "feat(core): 전투력 계산과 이동 단계"
```

---

### Task 7: 전투 단계

**Files:**
- Create: `packages/core/src/rules/combat.ts`
- Test: `packages/core/test/combat.test.ts`

규칙: 같은 자리가 같은 거점을 공격하는 영웅들은 한 부대로 합친다. 부대들은 시드로 섞은 순서로 하나씩 정산한다. 공격에 나선 영웅은 출발 거점 방어에 끼지 않는다. 정산 직전에 활동 중이고 병력이 있고 목표와 인접한 영웅만 싸운다. 점령되면 그 거점에 있던 다른 자리 영웅(방어 영웅과 아직 정산 전인 공격 영웅 모두)은 후퇴한다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`packages/core/test/combat.test.ts`:
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
    expect(state.nodes.f0).toEqual({ id: "f0", owner: 0, garrison: 0 });
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
    expect(heroOf(state, "s0h0")).toMatchObject({ location: "c0", troops: 4 });
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
    expect(heroOf(state, "s0h0")).toMatchObject({ location: "c0", troops: 4, status: "active" });
    expect(events).toContainEqual({ kind: "heroRouted", seat: 0, hero: "s0h0", to: "c0", troops: 4 });
  });

  it("후퇴할 아군 거점이 없으면 영웅은 out이 된다", () => {
    const state = makeState();
    state.nodes.x5.owner = 0;
    state.nodes.x5.garrison = 0;
    Object.assign(heroOf(state, "s0h0"), { location: "x5", troops: 10 });
    state.nodes.m5.owner = 5;
    Object.assign(heroOf(state, "s5h0"), { location: "m5", troops: 200 });
    run(state, attack("s5h0", "x5"));
    expect(state.nodes.x5.owner).toBe(5);
    expect(heroOf(state, "s0h0")).toMatchObject({ status: "out", troops: 0 });
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
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run packages/core/test/combat.test.ts`
Expected: FAIL — `../src/rules/combat`을 찾지 못함.

- [ ] **Step 3: 구현한다**

`packages/core/src/rules/combat.ts`:
```ts
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
  committed: ReadonlySet<string>,
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
    events.push({ ...battle, winner: "attacker", attackerLoss, defenderLoss: defendTroops });
    capture(state, target, seat, attackers, events);
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
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run packages/core/test/combat.test.ts`
Expected: `Tests  6 passed`.

- [ ] **Step 5: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add packages/core/src/rules/combat.ts packages/core/test/combat.test.ts
git -C D:/game/proxywar commit -m "feat(core): 전투·점령·후퇴·수도 이전"
```

---

### Task 8: 생산·모집·유지비 단계

**Files:**
- Create: `packages/core/src/rules/economy.ts`
- Test: `packages/core/test/economy.test.ts`

순서: 살아 있는 자리마다 생산 → 모집(그 자리의 확정 명령 순서대로) → 유지비. 모집 때 거점을 잃었으면 `notOwned`, 자원이 모자라면 `unaffordable`로 건너뛴다. 유지비를 못 내면 식량을 전부 내고 모든 수비대·영웅 병력이 10%(내림 후 남은 수 기준) 탈영한다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`packages/core/test/economy.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { resolveEconomy } from "../src/rules/economy";
import type { GameEvent } from "../src/types";
import { heroOf, makeState, noOrders } from "./helpers";

describe("resolveEconomy", () => {
  it("수도 생산을 더하고 유지비(병사 20명당 식량 1, 올림)를 뺀다", () => {
    const state = makeState();
    resolveEconomy(state, noOrders(), []);
    expect(state.seats[0].treasury).toEqual({ gold: 56, food: 52, material: 23, rare: 0 });
  });

  it("생산 뒤 모집하고 늘어난 병력으로 유지비를 낸다", () => {
    const state = makeState();
    const orders = noOrders();
    orders[0].recruits.push({ node: "c0", amount: 30 });
    const events: GameEvent[] = [];
    resolveEconomy(state, orders, events);
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
    resolveEconomy(state, orders, events);
    expect(state.nodes.c0.garrison).toBe(60);
    expect(events).toContainEqual({ kind: "recruitSkipped", seat: 0, node: "c0", reason: "unaffordable" });
  });

  it("그사이 잃은 거점에서는 모집을 건너뛴다", () => {
    const state = makeState();
    state.nodes.c0.owner = 5;
    const orders = noOrders();
    orders[0].recruits.push({ node: "c0", amount: 10 });
    const events: GameEvent[] = [];
    resolveEconomy(state, orders, events);
    expect(events).toContainEqual({ kind: "recruitSkipped", seat: 0, node: "c0", reason: "notOwned" });
  });

  it("유지비를 못 내면 식량을 모두 내고 병력 10%가 탈영한다", () => {
    const state = makeState();
    state.seats[0].treasury.food = 0;
    state.nodes.c0.garrison = 400;
    heroOf(state, "s0h0").troops = 15;
    const events: GameEvent[] = [];
    resolveEconomy(state, noOrders(), events);
    expect(state.seats[0].treasury.food).toBe(0);
    expect(state.nodes.c0.garrison).toBe(360);
    expect(heroOf(state, "s0h0").troops).toBe(13);
    expect(events).toContainEqual({ kind: "upkeep", seat: 0, food: 5, deserted: 42 });
  });

  it("탈락한 자리는 처리하지 않는다", () => {
    const state = makeState();
    state.seats[1].eliminatedAt = 0;
    resolveEconomy(state, noOrders(), []);
    expect(state.seats[1].treasury).toEqual({ gold: 50, food: 50, material: 20, rare: 0 });
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run packages/core/test/economy.test.ts`
Expected: FAIL — `../src/rules/economy`를 찾지 못함.

- [ ] **Step 3: 구현한다**

`packages/core/src/rules/economy.ts`:
```ts
import { BALANCE } from "../data/balance";
import { nodeType } from "../map";
import { totalTroops } from "../summary";
import type { GameEvent, GameState, NodeId, Orders, Resources, SeatId } from "../types";

const KEYS = ["gold", "food", "material", "rare"] as const;

/** 생산·성장 단계: 살아 있는 자리마다 생산 → 모집 → 유지비 */
export function resolveEconomy(state: GameState, orders: Orders, events: GameEvent[]): void {
  for (const seat of state.seats) {
    if (seat.eliminatedAt !== null) continue;
    collectIncome(state, seat.id, events);
    for (const recruit of orders[seat.id]?.recruits ?? []) {
      recruitAt(state, seat.id, recruit.node, recruit.amount, events);
    }
    payUpkeep(state, seat.id, events);
  }
}

function collectIncome(state: GameState, seat: SeatId, events: GameEvent[]): void {
  const gain: Resources = { gold: 0, food: 0, material: 0, rare: 0 };
  for (const node of Object.values(state.nodes)) {
    if (node.owner !== seat) continue;
    const produced = BALANCE.production[nodeType(state.map, node.id)];
    for (const k of KEYS) gain[k] += produced[k];
  }
  const treasury = state.seats[seat].treasury;
  for (const k of KEYS) treasury[k] += gain[k];
  events.push({ kind: "income", seat, gain });
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

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run packages/core/test/economy.test.ts`
Expected: `Tests  6 passed`.

- [ ] **Step 5: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add packages/core/src/rules/economy.ts packages/core/test/economy.test.ts
git -C D:/game/proxywar commit -m "feat(core): 생산·모집·유지비 단계"
```

---

### Task 9: 승리·탈락 판정과 processTurn

**Files:**
- Create: `packages/core/src/rules/victory.ts`, `packages/core/src/rules/turn.ts`
- Test: `packages/core/test/turn.test.ts`

규칙: 거점이 0개인 자리는 탈락(영웅 모두 `out`, 수도 없음). 과반(30개 중 16개)을 가진 자리가 같으면 연속 기록을 늘리고, 바뀌거나 없으면 새로 센다. 종료 판정 순서는 과반 12턴 → 생존 1자리 이하 → 턴 제한. 순위는 강제 승자(조기 승리·마지막 생존) → 생존 자리(점수 높은 순) → 탈락 자리(늦게 탈락한 순) → 자리 번호.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`packages/core/test/turn.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { processTurn } from "../src/rules/turn";
import type { GameEvent } from "../src/types";
import { heroOf, makeState, noOrders } from "./helpers";

function battleOf(events: GameEvent[]) {
  const battle = events.find((e) => e.kind === "battle");
  if (!battle || battle.kind !== "battle") throw new Error("no battle");
  return battle;
}

describe("processTurn", () => {
  it("원본 상태를 바꾸지 않고 턴을 1 올린다", () => {
    const state = makeState();
    const before = JSON.stringify(state);
    const { state: next } = processTurn(state, noOrders());
    expect(JSON.stringify(state)).toBe(before);
    expect(next.turn).toBe(1);
  });

  it("끝난 매치는 처리하지 않는다", () => {
    const state = makeState();
    state.ended = { reason: "turnLimit", winner: 0, ranking: [0, 1, 2, 3, 4, 5], scores: [0, 0, 0, 0, 0, 0] };
    expect(() => processTurn(state, noOrders())).toThrow("match already ended");
  });

  it("거점을 모두 잃은 자리는 탈락한다", () => {
    const state = makeState();
    state.nodes.m0.owner = 5;
    state.nodes.m0.garrison = 0;
    Object.assign(heroOf(state, "s5h0"), { location: "m0", troops: 500 });
    const orders = noOrders();
    orders[5].missions.push({ kind: "attack", hero: "s5h0", target: "c0" });
    const { state: next, events } = processTurn(state, orders);
    expect(next.seats[0]).toMatchObject({ eliminatedAt: 1, capital: null });
    expect(next.heroes.filter((h) => h.seat === 0).every((h) => h.status === "out")).toBe(true);
    expect(events).toContainEqual({ kind: "eliminated", seat: 0 });
    expect(next.ended).toBeNull();
  });

  it("과반을 12턴 연속 가지면 조기 승리한다", () => {
    const state = makeState();
    const others = new Set(["c1", "c2", "c3", "c4", "c5"]);
    for (const n of state.map.nodes.filter((n) => !others.has(n.id)).slice(0, 16)) state.nodes[n.id].owner = 0;
    state.majority = { seat: 0, streak: 11 };
    const { state: next, events } = processTurn(state, noOrders());
    expect(next.majority).toEqual({ seat: 0, streak: 12 });
    expect(next.ended).toMatchObject({ reason: "earlyVictory", winner: 0 });
    expect(next.ended?.ranking[0]).toBe(0);
    expect(events.at(-1)?.kind).toBe("matchEnded");
  });

  it("과반이 없으면 연속 기록이 끊긴다", () => {
    const state = makeState();
    state.majority = { seat: 0, streak: 5 };
    expect(processTurn(state, noOrders()).state.majority).toEqual({ seat: null, streak: 0 });
  });

  it("턴 제한에 닿으면 점수 순으로 순위를 매기고 동점은 자리 번호 순이다", () => {
    const state = makeState();
    state.maxTurns = 1;
    state.nodes.c3.garrison = 200;
    const { state: next } = processTurn(state, noOrders());
    expect(next.ended).toEqual({
      reason: "turnLimit",
      winner: 3,
      ranking: [3, 0, 1, 2, 4, 5],
      scores: [16, 16, 16, 30, 16, 16],
    });
  });

  it("한 자리만 남으면 마지막 생존으로 끝난다", () => {
    const state = makeState();
    for (let i = 1; i < 6; i++) state.seats[i].eliminatedAt = 0;
    const { state: next } = processTurn(state, noOrders());
    expect(next.ended).toMatchObject({ reason: "lastStanding", winner: 0 });
  });

  it("같은 시드·같은 명령이면 같은 결과, 시드가 다르면 전투 힘이 달라진다", () => {
    const orders = noOrders();
    orders[0].missions.push({ kind: "attack", hero: "s0h0", target: "f0", draw: 40 });
    const a = processTurn(makeState(1), orders);
    const b = processTurn(makeState(1), orders);
    const c = processTurn(makeState(2), orders);
    expect(a).toEqual(b);
    expect(battleOf(c.events).attackPower).not.toBe(battleOf(a.events).attackPower);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run packages/core/test/turn.test.ts`
Expected: FAIL — `../src/rules/turn`을 찾지 못함.

- [ ] **Step 3: 구현한다**

`packages/core/src/rules/victory.ts`:
```ts
import { BALANCE } from "../data/balance";
import { ownedNodes, scoreOf } from "../summary";
import type { GameEvent, GameState, MatchResult, SeatId } from "../types";

/** 탈락 → 과반 연속 기록 → 종료 판정 */
export function resolveVictory(state: GameState, events: GameEvent[]): void {
  for (const seat of state.seats) {
    if (seat.eliminatedAt !== null || ownedNodes(state, seat.id).length > 0) continue;
    seat.eliminatedAt = state.turn;
    seat.capital = null;
    for (const hero of state.heroes) {
      if (hero.seat !== seat.id) continue;
      hero.status = "out";
      hero.troops = 0;
    }
    events.push({ kind: "eliminated", seat: seat.id });
  }
  updateMajority(state);
  const result = checkEnd(state);
  if (result) {
    state.ended = result;
    events.push({ kind: "matchEnded", result });
  }
}

function updateMajority(state: GameState): void {
  const need = Math.floor(state.map.nodes.length / 2) + 1;
  const leader = state.seats.find((s) => s.eliminatedAt === null && ownedNodes(state, s.id).length >= need);
  const seat = leader ? leader.id : null;
  if (seat !== null && seat === state.majority.seat) state.majority.streak += 1;
  else state.majority = { seat, streak: seat === null ? 0 : 1 };
}

function checkEnd(state: GameState): MatchResult | null {
  if (state.majority.seat !== null && state.majority.streak >= BALANCE.victory.majorityStreak) {
    return finish(state, "earlyVictory", state.majority.seat);
  }
  const alive = state.seats.filter((s) => s.eliminatedAt === null);
  if (alive.length <= 1) return finish(state, "lastStanding", alive.length === 1 ? alive[0].id : null);
  if (state.turn >= state.maxTurns) return finish(state, "turnLimit", null);
  return null;
}

function finish(state: GameState, reason: MatchResult["reason"], forced: SeatId | null): MatchResult {
  const scores = state.seats.map((s) => scoreOf(state, s.id));
  const ranking = [...state.seats]
    .sort((a, b) => {
      if (a.id === forced) return -1;
      if (b.id === forced) return 1;
      const ea = a.eliminatedAt ?? Number.POSITIVE_INFINITY;
      const eb = b.eliminatedAt ?? Number.POSITIVE_INFINITY;
      if (ea !== eb) return eb - ea;
      return scores[b.id] - scores[a.id] || a.id - b.id;
    })
    .map((s) => s.id);
  return { reason, winner: ranking[0], ranking, scores };
}
```

`packages/core/src/rules/turn.ts`:
```ts
import { createRng } from "../rng";
import type { GameEvent, GameState, Mission, Orders } from "../types";
import { resolveCombat } from "./combat";
import { resolveEconomy } from "./economy";
import { resolveMovement } from "./movement";
import { resolveVictory } from "./victory";

export interface TurnResult {
  state: GameState;
  events: GameEvent[];
}

/**
 * 정각 처리 한 번. 원본을 바꾸지 않고 새 상태와 이벤트를 돌려준다.
 * orders는 validatePlan을 통과한 확정 명령이다. 난수는 (매치 시드, 새 턴)에서 만든다.
 */
export function processTurn(prev: GameState, orders: Orders): TurnResult {
  if (prev.ended) throw new Error("match already ended");
  const state: GameState = JSON.parse(JSON.stringify(prev));
  state.turn += 1;
  const rng = createRng(state.matchSeed, state.turn, "turn");
  const events: GameEvent[] = [];
  const missions = collectMissions(state, orders);
  resolveMovement(state, missions, events);
  resolveCombat(state, missions, rng, events);
  resolveEconomy(state, orders, events);
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

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run packages/core/test/turn.test.ts`
Expected: `Tests  8 passed`.

- [ ] **Step 5: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add packages/core/src/rules/victory.ts packages/core/src/rules/turn.ts packages/core/test/turn.test.ts
git -C D:/game/proxywar commit -m "feat(core): 탈락·승리 판정과 processTurn"
```

---

### Task 10: 규칙 참모와 core 공개 API

**Files:**
- Create: `packages/core/src/staff/types.ts`, `packages/core/src/staff/rule-staff.ts`, `packages/core/src/index.ts`
- Test: `packages/core/test/rule-staff.test.ts`

규칙 참모(1a, 세팅 없음): 영웅을 id 순으로 보며
1. 서 있는 거점에서 꺼낼 수 있는 병력(수도는 30을 남김, 통솔 상한까지)을 더한 힘이 인접한 아군이 아닌 거점의 추정 방어력 × 1.3을 넘으면, 그중 방어력이 가장 낮은 곳(동률은 id 순)을 공격한다. 이미 다른 영웅이 고른 목표는 고르지 않는다.
2. 아니면, 전선(인접한 아군이 아닌 거점이 있는 곳)이 아니면 가장 가까운 전선 쪽으로 병력을 꺼내 한 칸 이동한다.
3. 전선에 있고 병력이 통솔 상한의 절반 미만이면, 꺼낼 수 있는 병력이 상한의 절반 이상인 다른 아군 거점(가장 많은 곳) 쪽으로 병력 없이 한 칸 이동한다.
4. 그 밖에는 방어.
모집은 아군 수도·도시(id 순)에서 10명씩 상한까지, 금이 되고 남는 식량이 예상 유지비 5턴 치 이상일 때만 한다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`packages/core/test/rule-staff.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { validatePlan } from "../src/orders";
import { processTurn } from "../src/rules/turn";
import { rulePlan, ruleStaff } from "../src/staff/rule-staff";
import { makeState } from "./helpers";

describe("rulePlan", () => {
  it("시작 상태에서 모든 자리의 계획이 검증을 통과한다", () => {
    const state = makeState();
    for (let seat = 0; seat < 6; seat++) {
      expect(validatePlan(state, seat, rulePlan(state, seat)).issues).toEqual([]);
    }
  });

  it("첫 턴에 첫 영웅이 수도에서 30을 꺼내 가장 약한 이웃(동률은 id 순)을 공격하고 나머지는 방어한다", () => {
    const plan = rulePlan(makeState(), 0);
    expect(plan.missions[0]).toEqual({ kind: "attack", hero: "s0h0", target: "f0", draw: 30 });
    expect(plan.missions.slice(1).map((m) => m.kind)).toEqual(["defend", "defend", "defend", "defend"]);
  });

  it("식량을 유지비 5턴 치 남기는 만큼 수도에서 모집한다", () => {
    expect(rulePlan(makeState(), 0).recruits).toEqual([{ node: "c0", amount: 30 }]);
  });

  it("ruleStaff는 rulePlan과 같은 계획을 비동기로 낸다", async () => {
    const state = makeState();
    expect(await ruleStaff.plan({ state, seat: 2 })).toEqual(rulePlan(state, 2));
  });

  it("30턴 동안 모든 자리의 계획이 검증을 통과하고 첫 턴에 농장을 얻는다", () => {
    let state = makeState();
    for (let turn = 1; turn <= 30; turn++) {
      const plans = state.seats.map((s) => rulePlan(state, s.id));
      const checked = plans.map((p, seat) => validatePlan(state, seat, p));
      for (const c of checked) expect(c.issues).toEqual([]);
      state = processTurn(state, checked.map((c) => c.plan)).state;
      if (turn === 1) expect(state.nodes.f0.owner).toBe(0);
    }
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run packages/core/test/rule-staff.test.ts`
Expected: FAIL — `../src/staff/rule-staff`를 찾지 못함.

- [ ] **Step 3: 구현한다**

`packages/core/src/staff/types.ts`:
```ts
import type { GameState, Plan, SeatId } from "../types";

/** 1a는 전체 상태를 넘긴다. 1b에서 시야 보고서로 바꾼다. */
export interface StaffInput {
  state: GameState;
  seat: SeatId;
}

export interface Staff {
  plan(input: StaffInput): Promise<Plan>;
}
```

`packages/core/src/staff/rule-staff.ts`:
```ts
import { BALANCE, recruitCap } from "../data/balance";
import { bfs, compareText, neighbors } from "../map";
import { defensePower, heroModifier, troopCap } from "../rules/power";
import { ownedNodes, totalTroops } from "../summary";
import type { GameState, Hero, Mission, NodeId, Plan, Recruit, SeatId } from "../types";
import type { Staff } from "./types";

/** 수도에 남겨 둘 수비대(1b에서 안전장치 세팅으로 바뀐다) */
const CAPITAL_RESERVE = 30;
/** 추정 방어력의 이 배수를 넘을 때만 공격한다 */
const ATTACK_MARGIN = 1.3;
/** 모집 뒤 식량은 예상 유지비의 이 턴 수만큼 남긴다 */
const FOOD_RESERVE_TURNS = 5;

export const ruleStaff: Staff = {
  plan: async ({ state, seat }) => rulePlan(state, seat),
};

export function rulePlan(state: GameState, seat: SeatId): Plan {
  return { missions: planMissions(state, seat), recruits: planRecruits(state, seat) };
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

function planMissions(state: GameState, seat: SeatId): Mission[] {
  const missions: Mission[] = [];
  const left: Record<NodeId, number> = {};
  const claimed = new Set<NodeId>();
  const heroes = state.heroes
    .filter((h) => h.seat === seat && h.status === "active")
    .sort((a, b) => compareText(a.id, b.id));
  for (const hero of heroes) {
    const here = hero.location;
    const garrison = left[here] ?? state.nodes[here].garrison;
    const draw = Math.max(0, Math.min(garrison - reserveAt(state, seat, here), troopCap(hero) - hero.troops));
    const force = (hero.troops + draw) * heroModifier(hero);
    const target: { node: NodeId; def: number } | undefined = neighbors(state.map, here)
      .filter((n) => state.nodes[n].owner !== seat && !claimed.has(n))
      .map((n) => ({ node: n, def: defensePower(state, n) }))
      .filter((t) => force > t.def * ATTACK_MARGIN)
      .sort((a, b) => a.def - b.def || compareText(a.node, b.node))[0];
    if (target) {
      claimed.add(target.node);
      left[here] = garrison - draw;
      missions.push({ kind: "attack", hero: hero.id, target: target.node, draw });
      continue;
    }
    if (!isFrontier(state, seat, here)) {
      const step = stepToward(state, seat, here, (n) => isFrontier(state, seat, n));
      if (step) {
        left[here] = garrison - draw;
        missions.push({ kind: "move", hero: hero.id, to: step, draw });
        continue;
      }
    } else {
      const step = regroupStep(state, seat, hero, draw);
      if (step) {
        missions.push({ kind: "move", hero: hero.id, to: step, draw: 0 });
        continue;
      }
    }
    missions.push({ kind: "defend", hero: hero.id });
  }
  return missions;
}

function planRecruits(state: GameState, seat: SeatId): Recruit[] {
  const { gold, food } = state.seats[seat].treasury;
  const { unit, costPerUnit } = BALANCE.recruit;
  let spentGold = 0;
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

`packages/core/src/index.ts`:
```ts
export type * from "./types";
export { createRng, type Rng } from "./rng";
export { BALANCE, recruitCap } from "./data/balance";
export { bfs, compareText, getMap, neighbors, nodeType } from "./map";
export { HeroSetupSchema, MatchSetupSchema, SeatSetupSchema, type MatchSetup } from "./setup";
export { initState } from "./state";
export { ownedNodes, scoreOf, totalTroops } from "./summary";
export { validatePlan, type CheckedPlan, type PlanIssue } from "./orders";
export { processTurn, type TurnResult } from "./rules/turn";
export { rulePlan, ruleStaff } from "./staff/rule-staff";
export type { Staff, StaffInput } from "./staff/types";
```

- [ ] **Step 4: 통과와 core 전체 검사를 확인한다**

Run: `npx vitest run packages/core`
Expected: `Test Files  10 passed`, `Tests  77 passed`(rng 6, map 8, state 8, orders 19, power 3, movement 3, combat 7, economy 6, turn 10, rule-staff 7. 변경 7~10 반영으로 rng +1, orders +3, combat +1, turn +2, rule-staff +2).

Run: `npx tsc -p packages/core/tsconfig.json && npx tsc -p packages/core/tsconfig.test.json`
Expected: 출력 없음, 종료 코드 0.

- [ ] **Step 5: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add packages/core/src/staff packages/core/src/index.ts packages/core/test/rule-staff.test.ts
git -C D:/game/proxywar commit -m "feat(core): 규칙 참모와 공개 API"
```

---

### Task 11: 실행 설정과 매치 실행기

**Files:**
- Create: `packages/sim/src/config.ts`, `packages/sim/src/runner.ts`, `packages/sim/configs/rule6.json`
- Test: `packages/sim/test/runner.test.ts`

- [ ] **Step 1: 실행 설정 파일을 만든다**

`packages/sim/configs/rule6.json`:
```json
{
  "name": "rule6-smoke",
  "map": "ring6",
  "turns": 120,
  "seed": 1,
  "seats": [
    { "name": "Aster", "staff": { "kind": "rule" }, "heroes": [
      { "name": "Aster-1", "grade": 3 }, { "name": "Aster-2", "grade": 3 }, { "name": "Aster-3", "grade": 3 },
      { "name": "Aster-4", "grade": 3 }, { "name": "Aster-5", "grade": 3 } ] },
    { "name": "Briar", "staff": { "kind": "rule" }, "heroes": [
      { "name": "Briar-1", "grade": 3 }, { "name": "Briar-2", "grade": 3 }, { "name": "Briar-3", "grade": 3 },
      { "name": "Briar-4", "grade": 3 }, { "name": "Briar-5", "grade": 3 } ] },
    { "name": "Cobalt", "staff": { "kind": "rule" }, "heroes": [
      { "name": "Cobalt-1", "grade": 3 }, { "name": "Cobalt-2", "grade": 3 }, { "name": "Cobalt-3", "grade": 3 },
      { "name": "Cobalt-4", "grade": 3 }, { "name": "Cobalt-5", "grade": 3 } ] },
    { "name": "Dune", "staff": { "kind": "rule" }, "heroes": [
      { "name": "Dune-1", "grade": 3 }, { "name": "Dune-2", "grade": 3 }, { "name": "Dune-3", "grade": 3 },
      { "name": "Dune-4", "grade": 3 }, { "name": "Dune-5", "grade": 3 } ] },
    { "name": "Ember", "staff": { "kind": "rule" }, "heroes": [
      { "name": "Ember-1", "grade": 3 }, { "name": "Ember-2", "grade": 3 }, { "name": "Ember-3", "grade": 3 },
      { "name": "Ember-4", "grade": 3 }, { "name": "Ember-5", "grade": 3 } ] },
    { "name": "Frost", "staff": { "kind": "rule" }, "heroes": [
      { "name": "Frost-1", "grade": 3 }, { "name": "Frost-2", "grade": 3 }, { "name": "Frost-3", "grade": 3 },
      { "name": "Frost-4", "grade": 3 }, { "name": "Frost-5", "grade": 3 } ] }
  ]
}
```

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`packages/sim/test/runner.test.ts`:
```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseRunConfig, type RunConfig } from "../src/config";
import { runMatch, staffFor } from "../src/runner";

const raw = JSON.parse(readFileSync(new URL("../configs/rule6.json", import.meta.url), "utf8"));
const config = parseRunConfig(raw);

function run(c: RunConfig) {
  return runMatch(c, c.seats.map((s) => staffFor(s.staff)));
}

describe("runMatch", () => {
  it("규칙 참모 6명이 매치를 끝까지 돌고 모든 계획이 검증을 통과한다", async () => {
    const record = await run(config);
    expect(record.turns.length).toBeGreaterThan(0);
    expect(record.turns.length).toBeLessThanOrEqual(120);
    expect(record.turns.at(-1)?.turn).toBe(record.turns.length);
    expect(record.result.ranking).toHaveLength(6);
    expect(record.turns.every((t) => t.issues.every((list) => list.length === 0))).toBe(true);
    expect(record.turns[0].metrics).toHaveLength(6);
  });

  it("같은 설정이면 같은 기록을 낸다", async () => {
    expect(JSON.stringify(await run(config))).toBe(JSON.stringify(await run(config)));
  });

  it("시드가 다르면 기록이 달라진다", async () => {
    const a = await run(config);
    const b = await run({ ...config, seed: config.seed + 1 });
    expect(JSON.stringify(b.turns)).not.toBe(JSON.stringify(a.turns));
  });

  it("자리가 6개가 아니거나 참모 종류가 없으면 설정을 거부한다", () => {
    expect(() => parseRunConfig({ ...raw, seats: raw.seats.slice(0, 5) })).toThrow();
    expect(() =>
      parseRunConfig({ ...raw, seats: raw.seats.map((s: object) => ({ ...s, staff: { kind: "llm" } })) }),
    ).toThrow();
  });
});
```

- [ ] **Step 3: 실패를 확인한다**

Run: `npx vitest run packages/sim/test/runner.test.ts`
Expected: FAIL — `../src/config`를 찾지 못함.

- [ ] **Step 4: 구현한다**

`packages/sim/src/config.ts`:
```ts
import { MatchSetupSchema, SeatSetupSchema } from "@proxywar/core";
import { z } from "zod";

/** 1a는 규칙 참모만. 1c에서 llm을 더한다. */
export const StaffConfigSchema = z.object({ kind: z.literal("rule") });

export const SeatConfigSchema = SeatSetupSchema.extend({ staff: StaffConfigSchema });

export const RunConfigSchema = MatchSetupSchema.extend({
  name: z.string().min(1),
  seats: z.array(SeatConfigSchema).length(6),
});

export type StaffConfig = z.infer<typeof StaffConfigSchema>;
export type RunConfig = z.infer<typeof RunConfigSchema>;

export function parseRunConfig(raw: unknown): RunConfig {
  return RunConfigSchema.parse(raw);
}
```

`packages/sim/src/runner.ts`:
```ts
import {
  initState,
  ownedNodes,
  processTurn,
  ruleStaff,
  scoreOf,
  totalTroops,
  validatePlan,
  type GameEvent,
  type GameState,
  type MatchResult,
  type Plan,
  type PlanIssue,
  type Resources,
  type Staff,
} from "@proxywar/core";
import type { RunConfig, StaffConfig } from "./config";

export interface SeatMetrics {
  seat: number;
  nodes: number;
  troops: number;
  score: number;
  treasury: Resources;
  eliminated: boolean;
}

export interface TurnRecord {
  turn: number;
  /** 참모가 낸 원래 계획(자리 순) */
  plans: Plan[];
  /** 검증에서 빠진 항목(자리 순) */
  issues: PlanIssue[][];
  events: GameEvent[];
  metrics: SeatMetrics[];
}

export interface MatchRecord {
  version: 1;
  config: RunConfig;
  initialState: GameState;
  turns: TurnRecord[];
  result: MatchResult;
}

const EMPTY_PLAN: Plan = { missions: [], recruits: [] };

export function staffFor(config: StaffConfig): Staff {
  switch (config.kind) {
    case "rule":
      return ruleStaff;
  }
}

export function seatMetrics(state: GameState): SeatMetrics[] {
  return state.seats.map((s) => ({
    seat: s.id,
    nodes: ownedNodes(state, s.id).length,
    troops: totalTroops(state, s.id),
    score: scoreOf(state, s.id),
    treasury: { ...s.treasury },
    eliminated: s.eliminatedAt !== null,
  }));
}

/** 참모 호출 → 검증 → 처리를 매치가 끝날 때까지 반복한다. 첫 호출은 초기 상태로 한다. */
export async function runMatch(config: RunConfig, staffs: readonly Staff[]): Promise<MatchRecord> {
  const initialState = initState(config);
  let state = initialState;
  const turns: TurnRecord[] = [];
  while (state.ended === null) {
    const current = state;
    const plans = await Promise.all(
      current.seats.map((s) =>
        s.eliminatedAt === null ? staffs[s.id].plan({ state: current, seat: s.id }) : Promise.resolve(EMPTY_PLAN),
      ),
    );
    const checked = plans.map((plan, seat) => validatePlan(current, seat, plan));
    const { state: next, events } = processTurn(
      current,
      checked.map((c) => c.plan),
    );
    turns.push({ turn: next.turn, plans, issues: checked.map((c) => c.issues), events, metrics: seatMetrics(next) });
    state = next;
  }
  return { version: 1, config, initialState, turns, result: state.ended! };
}
```

- [ ] **Step 5: 통과를 확인한다**

Run: `npx vitest run packages/sim/test/runner.test.ts`
Expected: `Tests  4 passed`.

- [ ] **Step 6: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add packages/sim/src/config.ts packages/sim/src/runner.ts packages/sim/configs/rule6.json packages/sim/test/runner.test.ts
git -C D:/game/proxywar commit -m "feat(sim): 실행 설정과 매치 실행기"
```

---

### Task 12: 보고서와 run CLI

**Files:**
- Create: `packages/sim/src/report.ts`, `packages/sim/src/run-command.ts`, `packages/sim/src/cli.ts`
- Test: `packages/sim/test/report.test.ts`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`packages/sim/test/report.test.ts`:
```ts
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderReport } from "../src/report";
import { runCommand } from "../src/run-command";

const configPath = fileURLToPath(new URL("../configs/rule6.json", import.meta.url));

describe("run 명령과 보고서", () => {
  it("match.json과 report.md를 쓰고 보고서에 순위·추이·사건·무효 명령이 들어간다", async () => {
    const dir = await mkdtemp(join(tmpdir(), "proxywar-"));
    try {
      const { record, outDir } = await runCommand(configPath, dir);
      expect(outDir).toBe(dir);
      expect(existsSync(join(dir, "match.json"))).toBe(true);
      const saved = JSON.parse(readFileSync(join(dir, "match.json"), "utf8"));
      expect(saved.turns).toHaveLength(record.turns.length);

      const md = readFileSync(join(dir, "report.md"), "utf8");
      expect(md).toBe(renderReport(record));
      expect(md).toContain("# 매치 보고서: rule6-smoke");
      expect(md.split("\n").filter((line) => /^\| [1-6] \| /.test(line))).toHaveLength(6);
      expect(md).toContain("## 거점 수 추이");
      expect(md).toContain("점령:");
      expect(md).toContain("## 무효 명령\n\n없음");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run packages/sim/test/report.test.ts`
Expected: FAIL — `../src/report`를 찾지 못함.

- [ ] **Step 3: 구현한다**

`packages/sim/src/report.ts`:
```ts
import type { GameEvent, MatchResult } from "@proxywar/core";
import type { MatchRecord } from "./runner";

const REASON: Record<MatchResult["reason"], string> = {
  earlyVictory: "조기 승리(과반 12턴 유지)",
  lastStanding: "마지막 생존",
  turnLimit: "턴 제한",
};

export function renderReport(record: MatchRecord): string {
  const names = record.config.seats.map((s) => s.name);
  const name = (seat: number | null): string => (seat === null ? "중립" : names[seat]);
  const last = record.turns[record.turns.length - 1];
  const result = record.result;
  const lines: string[] = [];

  lines.push(`# 매치 보고서: ${record.config.name}`, "");
  lines.push(`- 맵: ${record.config.map} · 시드: ${record.config.seed} · 진행 턴: ${last.turn}/${record.config.turns}`);
  lines.push(`- 종료: ${REASON[result.reason]} · 승자: ${name(result.winner)}`, "");

  lines.push("## 최종 순위", "", "| 순위 | 자리 | 점수 | 거점 | 병력 | 탈락 |", "|---|---|---|---|---|---|");
  result.ranking.forEach((seat, i) => {
    const m = last.metrics[seat];
    lines.push(`| ${i + 1} | ${name(seat)} | ${result.scores[seat]} | ${m.nodes} | ${m.troops} | ${m.eliminated ? "예" : ""} |`);
  });

  lines.push("", "## 거점 수 추이", "", `| 턴 | ${names.join(" | ")} |`, `|---|${names.map(() => "---").join("|")}|`);
  for (const t of record.turns) {
    if (t.turn % 10 !== 0 && t !== last) continue;
    lines.push(`| ${t.turn} | ${t.metrics.map((m) => m.nodes).join(" | ")} |`);
  }

  lines.push("", "## 주요 사건", "");
  for (const t of record.turns) {
    for (const e of t.events) {
      const text = describe(e, name);
      if (text) lines.push(`- T${t.turn} ${text}`);
    }
  }

  const issues = record.turns.flatMap((t) =>
    t.issues.flatMap((list, seat) => list.map((i) => `- T${t.turn} ${name(seat)}: ${i.item}[${i.index}] ${i.reason}`)),
  );
  lines.push("", "## 무효 명령", "", ...(issues.length > 0 ? issues : ["없음"]), "");
  return lines.join("\n");
}

function describe(e: GameEvent, name: (seat: number | null) => string): string | null {
  switch (e.kind) {
    case "captured":
      return `점령: ${e.node} (${name(e.from)} → ${name(e.to)})`;
    case "capitalMoved":
      return `수도 함락: ${name(e.seat)} ${e.from} → ${e.to ?? "없음"}`;
    case "eliminated":
      return `탈락: ${name(e.seat)}`;
    default:
      return null;
  }
}
```

`packages/sim/src/run-command.ts`:
```ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseRunConfig } from "./config";
import { renderReport } from "./report";
import { runMatch, staffFor, type MatchRecord } from "./runner";

/** 설정 파일로 매치 하나를 돌려 outDir(없으면 runs/<시각>-<이름>)에 기록과 보고서를 쓴다. */
export async function runCommand(configPath: string, outDir?: string): Promise<{ record: MatchRecord; outDir: string }> {
  const config = parseRunConfig(JSON.parse(await readFile(configPath, "utf8")));
  const dir = outDir ?? join("runs", `${new Date().toISOString().replace(/[:.]/g, "-")}-${config.name}`);
  const record = await runMatch(
    config,
    config.seats.map((s) => staffFor(s.staff)),
  );
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "match.json"), JSON.stringify(record));
  await writeFile(join(dir, "report.md"), renderReport(record));
  return { record, outDir: dir };
}
```

`packages/sim/src/cli.ts`:
```ts
import { runCommand } from "./run-command";

const [command, configPath, ...rest] = process.argv.slice(2);
if (command !== "run" || configPath === undefined) {
  console.error("usage: npm run sim -- run <config.json> [--out <dir>]");
  process.exit(1);
}
const outIndex = rest.indexOf("--out");
const { record, outDir } = await runCommand(configPath, outIndex >= 0 ? rest[outIndex + 1] : undefined);
const winner = record.config.seats[record.result.winner].name;
console.log(`${record.result.reason} · 승자 ${winner} · ${record.turns.length}턴 → ${outDir}`);
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run packages/sim/test/report.test.ts`
Expected: `Tests  1 passed`.

- [ ] **Step 5: CLI를 실제로 돌리고 보고서를 읽는다**

```bash
npm run sim -- run packages/sim/configs/rule6.json --out runs/1a-check
```
Expected: 마지막 줄이 `<earlyVictory|lastStanding|turnLimit> · 승자 <이름> · <N>턴 → runs/1a-check` 형태다. `runs/1a-check/report.md`를 열어 최종 순위 6줄, 거점 수 추이 표, 점령 사건, "무효 명령 없음"을 눈으로 확인한다. 거점 수가 매치 내내 1에 머물거나 아무 사건이 없으면 실패로 보고 원인을 찾는다.

- [ ] **Step 6: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add packages/sim/src/report.ts packages/sim/src/run-command.ts packages/sim/src/cli.ts packages/sim/test/report.test.ts
git -C D:/game/proxywar commit -m "feat(sim): Markdown 보고서와 run 명령"
```

---

### Task 13: 전체 검증과 문서 갱신

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: 전체 테스트와 타입 검사를 돌린다**

Run: `npm test`
Expected: `Test Files  12 passed`, `Tests  83 passed`(core 77, sim 6).

Run: `npm run typecheck`
Expected: 출력 없음(스크립트 머리줄 제외), 종료 코드 0.

- [ ] **Step 2: 완료 기준을 대조한다**

설계서 7절 기준 1("규칙 참모 6명이 120턴 매치를 결정적으로 완주하고 `report.md`가 나온다")을 확인한다. 근거는 Task 11 테스트(완주·같은 설정 같은 기록)와 Task 12 Step 5의 실제 보고서다. 매치가 120턴 전에 끝났다면 종료 이유와 턴 수를 보고에 적는다(조기 종료도 규칙대로의 완주다). 기준 2~5는 1c·1d 범위다.

- [ ] **Step 3: AGENTS.md를 갱신한다**

"지금 어디에 있나" 절의 문장 `코어 구현은 4슬라이스로 나눴고 1a 계획을 썼다(`docs/superpowers/plans/2026-10-27-sim-core-1a-skeleton.md`, 사용자 검토 대기).`를 다음으로 바꾼다:
```
코어 구현은 4슬라이스(1a 뼈대·1b 규칙 완성·1c LLM 참모·1d 측정)이고, 1a 구현 완료(계획 `docs/superpowers/plans/2026-10-27-sim-core-1a-skeleton.md`). 다음은 1b 계획.
```

"어디에 무엇이 있나" 절의 첫 줄 앞에 다음 줄을 넣는다:
```
- `packages/core/` — 순수 TypeScript 규칙 코어(Node API 금지, `tsconfig.json`의 `types: []`가 막는다). `packages/sim/` — 빠른 턴 모드 도구. 실행 `npm run sim -- run <설정 JSON>`, 테스트 `npm test`, 타입 검사 `npm run typecheck`. 실행 결과는 `runs/`(git 제외)
```

- [ ] **Step 4: 구현 보고서를 만든다**

`design-report` 스킬로 `docs/archive/reports/proxywar-sim-core-1a_implementation.html`을 만든다. 변경 파일, 테스트 결과(Step 1 출력), Task 12 Step 5 실행 결과(종료 이유·승자·턴 수), 설계서 대비 변경 6개, 다음 슬라이스(1b)를 담는다.

- [ ] **Step 5: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add AGENTS.md docs/archive/reports/proxywar-sim-core-1a_implementation.html
git -C D:/game/proxywar commit -m "docs: 1a 코어 뼈대 구현 완료 기록"
```
