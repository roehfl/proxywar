# EXPERIENCE — 2026-10-27-proxywar-sim-core-1a (proxywar, 범위: 게임)

모드: probe-less. 과제: 시뮬레이션 코어 설계서 승인, 1a 뼈대 계획, subagent-driven-development로 1a 구현·리뷰·커밋(`harness/runs/2026-10-27-proxywar-sim-core-1a/task.md` L3).
RUN 경로는 세션 폴더 `D:/game/proxywar` 기준. 편집 번호는 `RUN/DECISION.md` 결정 표(L7~L12)를 따른다. 사용자 확정 2026-10-27("권고대로"): 게임 범위는 4 채택, 5·6 보류. 범위 조정 없음. 공통 범위 편집 1~3은 `D:/game/harness/library/proxywar/2026-10-27-proxywar-sim-core-1a/EXPERIENCE.md`.
새 L 번호는 쓰지 않았다. 4는 기존 L-003(킥오프, 보류)의 재관찰이라 L-003을 채택으로 올리고 적용 조건을 넓혔다.

## 적용 조건

- 편집 4(L-003): proxywar 규칙 코어(`packages/core`)·규칙 참모의 설계서나 구현 계획에 규칙 문구(우선순위·처리 순서·대상 기준)를 적을 때, 특히 수치·우선순위가 붙는 대상(거점 타입, 현재 수도 같은)이 점령·이전으로 바뀔 수 있을 때. 1b 계획이 바로 이 경우다.
- 범위 근거: 결함이 턴마다 소유·타입이 바뀌는 이 게임의 거점 규칙 문구에 있다. 두 관찰 모두 proxywar라 게임에 둔다. 다른 게임에서 재관찰되면 공통 승격을 낸다(`RUN/DECISION.md` L10·L24).

## 관찰된 결함

### 편집 4 — 규칙 문구의 대상 기준이 모호함 (L-003 재관찰)
- `RUN/reference/evidence.md` L7 (C4, 리뷰 발견 → 사용자 결정): 1a 계획의 "모집 상한 수도 30·도시 20"이 거점 타입 기준인지 현재 수도 기준인지 모호했다. 타입 기준이면 수도가 농장으로 옮겨진 자리는 다시는 모집하지 못한다. 품질 리뷰가 찾고 사용자가 "현재 수도 기준"을 골랐다.
- 사용자 결정 기록(Composer 확인, `RUN/DECISION.md` L10): `docs/superpowers/plans/2026-10-27-sim-core-1a-skeleton.md` L23·L36, `docs/design/brainstorm-log.md` L59.
- 원 항목: L-003 `library/2026-10-27-proxywar-kickoff/EXPERIENCE.md`(킥오프 C4, 우선순위 4단계를 추상 목록으로만 적고 구체 상황으로 풀지 않아 사용자가 바로잡음 → 3단계). 둘 다 추상 규칙 문구를 구체 상황으로 풀지 않아 리뷰·사용자가 바로잡았다(`RUN/candidates/domain/RATIONALE.md` L5).
- 재관찰: proxywar/2026-10-27-proxywar-sim-core-1a

## 편집

`patch/`는 `RUN/composed/game/`을 그대로 복사했다(`diff -r` 같음). 보류한 5·6은 composed에 없다.

- `patch/.claude/skills/sim-rules/SKILL.md` → `D:/game/proxywar/.claude/skills/sim-rules/SKILL.md`(신규 스킬): 규칙 코어·참모 설계서·계획을 쓰고 구현·리뷰할 때 쓰는 판단 기준. 불릿 1개 "규칙 문구는 대상의 상태가 바뀌는 상황으로 풀어 본다 … 어느 기준인지 계획에 적는다 `<!-- L-003 -->`". description·머리말은 남은 불릿에 맞게 "리뷰·사용자 결정으로 바로잡힌 것"으로 고쳤다(`RUN/DECISION.md` L29).

## 효과

미검증 · 사용자 채택 (probe-less, 네 축 비교 없음).
C4는 리뷰가 찾아 사용자 결정으로 끝난 지점이고, 이 편집은 그 결정을 계획 작성 때 앞당겨 묻게 한다(`RUN/DECISION.md` L19). 다음 1b 계획에서 상태가 바뀌는 대상의 기준이 다시 빠져 리뷰·사용자가 바로잡으면 반증으로 기록한다.

## 상태

| 편집 | 교훈 ID | 상태 | 비고 |
|---|---|---|---|
| 4 | L-003 (기존 행 갱신) | 채택 | 게임 `LESSONS.md` L-003 행 상태 보류 → 채택, 적용 조건 확대, 항목 열에 이 항목 추가 |
| 5 | 없음 | 보류 (재관찰 대기) | 아래 참고. patch·색인 없음 |
| 6 | 없음 | 보류 (재관찰 대기) | 아래 참고. patch·색인 없음 |

### 보류 — 편집 5: 참모 휴리스틱·시작 수치는 여러 시드로 끝까지 실측
- 편집: `sim-rules/SKILL.md` 불릿 2 "참모 휴리스틱·시작 수치를 넣는 Task에 여러 시드로 끝까지 돌려 점령 수·정체 턴·왕복 수를 보는 실측 단계를 둔다"(`RUN/candidates/domain/patch/game/.claude/skills/sim-rules/SKILL.md`).
- 근거: `RUN/reference/evidence.md` L21(계획대로 만든 규칙 참모가 T2 이후 118턴 정체, Task 12 Step 5 CLI 실측에서야 드러나 서브에이전트 NEEDS_CONTEXT), L22(이어진 리뷰가 전선 왕복 진동 181건을 찾음), L33(자기 보고). 사용자 교정이 아니고 NEEDS_CONTEXT는 에이전트가 풀었다(`RUN/DECISION.md` L11).
- 재발 경로: 1b~1d가 같은 휴리스틱·수치를 다시 만진다. 그 과제에서 같은 퇴행이 늦게 드러나면 재관찰로 올린다.
- 채택 시: 절차형 문장 대신 "휴리스틱의 성공 기준은 여러 시드 끝까지 실측(점령 수·정체 턴·왕복 수)이다" 같은 기준 문장으로 다듬는다(`RUN/DECISION.md` L20). 번호는 그 시점 게임 색인의 다음 빈 번호(지금은 L-004). 점유하지 않았다.

### 보류 — 편집 6: 같은 턴 정산 순서에 따라 갈리는 규칙은 여러 시드로 시험
- 편집: `sim-rules/SKILL.md` 불릿 3(`RUN/candidates/domain/patch/game/.claude/skills/sim-rules/SKILL.md`).
- 근거: `RUN/reference/evidence.md` L20(점령 영웅이 `committed`에 남는 Critical 버그를 리뷰 탐침이 찾음), L23(시드 하나 회귀 테스트로는 안 드러나 시드 8개로 고침). 사용자 교정이 아니고 리뷰가 막았다(`RUN/DECISION.md` L12).
- 관계: 공통 보류 편집 2(테스트가 결함을 잡는지 확인)와 근거 줄이 같지만 층위가 다르다. 이 불릿은 확인이 실패했을 때 이 게임에서 고치는 방법이다(`RUN/DECISION.md` L21·L30).
- 번호: 채택되면 그 시점 게임 색인의 다음 빈 번호(5가 먼저 채택되지 않으면 L-004). 점유하지 않았다.
- 재관찰: proxywar/2026-10-27-proxywar-sim-core-1b-1 (사용자 결정 C2·C3) → L-004 불릿의 "여러 시드로 결과가 같은지 시험" 구절로 흡수돼 채택. `library/2026-10-27-proxywar-sim-core-1b-1/EXPERIENCE.md`
