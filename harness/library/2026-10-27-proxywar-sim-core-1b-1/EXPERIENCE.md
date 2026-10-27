# EXPERIENCE — 2026-10-27-proxywar-sim-core-1b-1 (proxywar, 범위: 게임)

모드는 probe-less다. 과제 내용: 1b-1(영웅 성장·특성·부상·포로·건물·점수) 계획을 세부 규칙 제안표와 함께 썼고, subagent-driven-development로 구현·리뷰·커밋했다(`harness/runs/2026-10-27-proxywar-sim-core-1b-1/task.md` L3).
RUN 경로는 세션 폴더 `D:/game/proxywar` 기준이다. 편집 번호는 `RUN/DECISION.md` 결정 표(L7~L10)를 따른다. 사용자 확정은 2026-10-27("권고대로")이다. 게임 범위는 4 채택이고, 범위 조정은 없다. 공통 범위 편집 1~3은 `D:/game/harness/library/proxywar/2026-10-27-proxywar-sim-core-1b-1/EXPERIENCE.md`에 있다.
새 번호는 L-004다. 게임 LESSONS는 L-003까지 있고, 1a에서 보류된 #5·#6은 번호를 점유하지 않았다(`RUN/DECISION.md` L17·L29).

## 적용 조건

- 편집 4(L-004): proxywar 규칙 코어(`packages/core`)의 계획에 규칙을 적거나 그 규칙을 고칠 때 해당한다. 특히 같은 턴 같은 단계에서 대상 상태(출격 영웅의 출발 거점, 운영 거점, 수도)가 바뀔 수 있는 규칙이 그렇다. 바로 다음 과제인 1b-2 계획(시야·세팅·제약·조건부 명령)이 적용 대상이다(`RUN/DECISION.md` L17).
- 범위 근거: 이 결함은 이 게임의 턴 처리와 거점·영웅·수도 규칙에 붙어 있다. 이 게임은 같은 단계의 사건을 시드로 섞어 하나씩 정산한다(`packages/core/src/rules/combat.ts` L55 `rng.shuffle`). 관찰은 모두 proxywar에서 나왔고, hsl(실시간 액션)에는 같은 구조가 없다(`RUN/DECISION.md` L10·L22).

## 관찰된 결함

### 편집 4 — 같은 단계 안에서 대상이 먼저 바뀌는 정산 순서를 풀어 보지 않음
- `RUN/reference/evidence.md` L5 (C2, 리뷰 발견 → 사용자 결정): 제안표는 "거점을 잃은 영웅은 후퇴·포로"라고만 적었다. 공격하러 나간 영웅의 출발 거점이 같은 전투 단계에서 먼저 함락되는 경우는 정하지 않았다. 그 결과 시드 10개 중 4개에서 영웅이 싸우지도 못하고 포로가 됐다. 사용자는 "1B"(출격 영웅은 자기 공격을 치름)를 골랐다.
- `RUN/reference/evidence.md` L6 (C3, 같은 리뷰 → 사용자 결정): 운영 거점을 잃고 후퇴한 영웅이 피난한 거점에서 운영 보정을 받는지 정하지 않았다. 사용자는 "2A"(지금대로)를 골랐다.
- `RUN/reference/evidence.md` L22 (수정 쪽): 1B를 직접 고칠 때 같은 단계의 다른 상태 변화(수도 이전, 즉시 부상 판정)를 함께 풀지 않았다. 재리뷰가 Important 2건을 찾았다. 진 공격 영웅의 부상 판정이 순서에 따라 1회 또는 2회 됐고, 수도가 `null`로 남는 생존 상태가 생겼다.
- `RUN/reference/evidence.md` L30 (자기 보고): L-003이 채택돼 있었지만 L-003은 대상 기준만 다루고 처리 순서는 다루지 않았다.
- C4의 30% 손실(`RUN/reference/evidence.md` L7, 전사 L1026)도 같은 순서 운이 남은 사례다(`RUN/DECISION.md` L10).
- 관련 항목:
  - L-003 `library/2026-10-27-proxywar-kickoff/EXPERIENCE.md`, `library/2026-10-27-proxywar-sim-core-1a/EXPERIENCE.md`: 대상이 무엇인지(타입 기준 / 현재 상태 기준)를 다룬다. 이 항목은 대상이 같은 턴 안에서 언제 바뀌는지를 다룬다. 층위가 달라 겹치지 않는다(`RUN/DECISION.md` L17).
  - 1a 보류 편집 6(같은 턴 정산 순서에 따라 갈리는 규칙은 여러 시드로 시험, `library/2026-10-27-proxywar-sim-core-1a/EXPERIENCE.md` 보류 절): 이번에 사용자 결정 두 건(C2·C3)으로 재관찰돼 이 불릿의 마지막 구절로 흡수됐다(`RUN/candidates/domain/RATIONALE.md` L5).

## 편집

`patch/`는 `RUN/composed/game/`을 그대로 복사했다(`diff -r` 결과 같음).

- `patch/.claude/skills/sim-rules/SKILL.md` → `D:/game/proxywar/.claude/skills/sim-rules/SKILL.md`: 불릿 2를 더했다(`<!-- L-004 -->`). 같은 턴 안에서 대상이 먼저 바뀌는 정산 순서로도 규칙을 풀어 본다. 계획에는 어느 순서에서도 결과가 같은 규칙을 적는다. 고칠 때는 같은 단계의 다른 상태 변화와 함께 다시 풀고, 여러 시드로 결과가 같은지 시험한다. description에 "1b-1 영웅·건물"을 더했다. 불릿 1(L-003)은 그대로 두었다.

## 효과

미검증 · 사용자 채택 (probe-less라 네 축 비교 없음).
C2·C3은 리뷰가 찾고 사용자 결정으로 닫은 빈칸이다. 이 불릿은 그 질문을 계획 작성 때로 앞당긴다. 1b-2 계획이나 수정에서 같은 단계의 순서 운이 다시 리뷰·사용자에 의해 바로잡히면, 이 불릿이 막지 못했다는 반증으로 기록한다.

## 상태

| 편집 | 교훈 ID | 상태 | 비고 |
|---|---|---|---|
| 4 | L-004 (새 행) | 채택 | 게임 `LESSONS.md`에 L-004 행 추가 |
