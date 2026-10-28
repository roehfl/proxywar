# EXPERIENCE — 2026-10-28-proxywar-sim-core-1b-2 (proxywar, 범위: 게임)

모드는 probe-less다. 과제 내용: 1b-2(시야·세팅 5종·제약·조건부 명령) 계획을 쓰고, 하네스 정리를 거쳐 main에서 구현한 뒤 커밋·푸시했다(`harness/runs/2026-10-28-proxywar-sim-core-1b-2/task.md` L3).
RUN 경로는 세션 폴더 `D:/game/proxywar` 기준이다. 편집 번호는 `RUN/DECISION.md` 결정 표(L7~L9)를 따른다. 사용자 확정은 2026-10-28("권고대로")이다. 게임 범위는 2·3 보류이고, 범위 조정은 없다. 공통 범위 편집 1(채택, G-004 확장)은 `D:/game/harness/library/proxywar/2026-10-28-proxywar-sim-core-1b-2/EXPERIENCE.md`에 있다.
이 항목은 보류 기록이다. 채택된 게임 편집이 없어 `patch/`와 게임 색인 행을 두지 않았고, L 번호도 점유하지 않았다(게임 `LESSONS.md`는 L-004까지).

## 적용 조건

- 편집 2: 슬라이스 구현을 커밋한 뒤 AGENTS.md "지금 어디에 있나"의 진행 상태 문장을 갱신할 때. 교훈이 아니라 사실 정정이다.
- 편집 3: 회귀 기준값(rule6 시드 1~8 같은)을 뽑는 1회용 스크립트를 저장소 밖에서 tsx로 돌릴 때.
- 범위 근거: 2는 이 게임의 진행 상태 문장이다. 3은 tsx·Node ESM 툴체인 지식이고 이 툴체인을 쓰는 게임은 proxywar 하나다. 다른 게임 LESSONS에 재관찰이 없다(`RUN/DECISION.md` L8·L9 범위 근거 열).

## 관찰된 결함

### 편집 2 — AGENTS.md가 커밋 뒤에도 "main에서 커밋 전"으로 남음
- `RUN/reference/evidence.md` L14: 구현은 `757c814`(38 files)로 main에 푸시됐다. `RUN/task.md` L5도 같다.
- Composer 확인(`RUN/DECISION.md` L8): 게임 HEAD `757c814`의 AGENTS.md 8행에 "main에서 커밋 전"이 그대로 남아 있다.
- 사용자 교정이 아니다. 사용자가 바로잡은 C1~C5(`RUN/reference/evidence.md` L3~L7) 어느 것과도 대응하지 않는다.

### 편집 3 — 기준값 추출 스크립트가 세 번째 시도에 실행됨
- `RUN/reference/evidence.md` L19: tsx가 `.ts`의 top-level await를 거부했다(cjs로 처리). `.mts`로 바꾸자 `D:` 경로 ESM import를 Node가 거부했다. `file:///` URL로 바꿔 세 번째에 실행됐다.
- 사용자 교정이 아니라 에이전트가 스스로 넘긴 재시도이고, 비용은 재시도 2회였다(`RUN/DECISION.md` L9).

## 편집

채택된 편집이 없어 `patch/`는 두지 않았다. 보류 편집의 원본은 RUN에 남아 있다.

- 편집 2: `RUN/candidates/invariant/patch/game/AGENTS.md` L8. "main에서 커밋 전" → "main `757c814`".
- 편집 3: `RUN/candidates/domain/patch/game/.claude/skills/sim-rules/SKILL.md` L12~L15. "구현 실행 메모" 절을 새로 두고 한 줄을 넣는다. 1회용 스크립트는 `.mts`로 쓰고 저장소 모듈은 `file:///D:/game/proxywar/...` URL로 import한다.

## 효과

해당 없음 (보류, probe-less).

## 상태

| 편집 | 교훈 ID | 상태 | 비고 |
|---|---|---|---|
| 2 | 없음 | 보류 | 사실 정정이라 교훈 행을 두지 않는다. 사용자가 고르면 후보 patch를 `D:/game/proxywar/AGENTS.md`에 그대로 반영한다(`RUN/DECISION.md` L29) |
| 3 | 없음 | 보류 (재관찰 대기) | 아래 참고. patch·색인 없음 |

### 보류 — 편집 3의 재관찰 조건
- 같은 실패(저장소 밖 tsx 스크립트의 cjs 처리, `D:` 경로 ESM 거부)가 다음 슬라이스 회귀 비교에서 다시 나오면 재관찰로 올린다. 1b-3도 기본 세팅 회귀를 완료 기준에 둘 가능성이 높다(`RUN/candidates/domain/RATIONALE.md` L3).
- 채택 시 위치를 함께 정한다. sim-rules는 "리뷰·사용자 결정으로 바로잡힌 규칙 판단 기준"을 담는 스킬이라 툴체인 절차 메모를 넣으면 성격이 흐려진다. 사용자 취향(원칙 중심, 절차 거부)도 고려해 sim-rules 또는 게임 `tools/` 스크립트 중에서 고른다(`RUN/DECISION.md` L9).
- 번호: 채택되면 그 시점 게임 색인의 다음 빈 번호를 쓴다(지금은 L-005). 점유하지 않았다.
- `D:/` 경로 ESM 거부는 Windows 환경 지식이기도 하다. Node를 쓰는 게임이 하나뿐이라 공통 확장은 제안하지 않았다(`RUN/DECISION.md` L13). 다른 게임에서 Node를 쓰게 되어 재관찰되면 공통 승격을 검토한다.
