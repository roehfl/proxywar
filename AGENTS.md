# AGENTS.md — proxywar (가제)

플레이어가 AI를 연결하는 서버 턴제 전쟁 시뮬레이션. 프롬프트 없이 세팅값(boolean·1~5)으로만 참모 AI를 조율하고, 영웅을 육성해 거점 발전·공격·방어·정형 외교로 겨룬다. 월드 서버, 클라이언트는 PC·모바일 등 다중 플랫폼. 목표는 미정.
공통 규칙은 상위 폴더의 `D:/game/AGENTS.md`(자동 로드)에 있다. 이 문서에는 이 게임에만 해당하는 것만 둔다.

## 지금 어디에 있나

2026-10-27 게임 폴더 생성. 첫 게임 규칙 설계서 승인(`docs/superpowers/specs/2026-10-27-game-rules-design.md`). 기술 설계는 하위 프로젝트로 나눴고, 1번 시뮬레이션 코어·빠른 턴 모드 설계서 승인(`docs/superpowers/specs/2026-10-27-sim-core-design.md`). 코어 구현은 4슬라이스(1a 뼈대·1b 규칙 완성·1c LLM 참모·1d 측정)이고, 1a 구현 완료(계획 `docs/superpowers/plans/2026-10-27-sim-core-1a-skeleton.md`, 실행 중 변경 7~10은 계획 머리말). 1b는 세 조각(1b-1 영웅·건물, 1b-2 시야·세팅·제약·조건부 명령, 1b-3 외교)이고 1b-1 구현 완료(계획 `docs/superpowers/plans/2026-10-27-sim-core-1b-1-heroes-buildings.md`, 실행 중 변경 8~10은 계획 머리말, 브랜치 `sim-core-1b-1`). 1b-2 구현 완료(계획 `docs/superpowers/plans/2026-10-28-sim-core-1b-2-view-settings-conditions.md`, 실행 중 변경 6~7은 계획 머리말, main `757c814`). 1b-3 구현 완료(계획 `docs/superpowers/plans/2026-10-28-sim-core-1b-3-diplomacy.md`, 실행 중 변경 5~6은 계획 머리말, main에 커밋). 1b(규칙 완성)가 끝났다. 다음은 1c 계획. 서버·연동·클라이언트·메타 설계는 아직 없음.

## 어디에 무엇이 있나

- `packages/core/` — 순수 TypeScript 규칙 코어(Node API 금지, `tsconfig.json`의 `types: []`가 막는다). `packages/sim/` — 빠른 턴 모드 도구. 실행 `npm run sim -- run <설정 JSON>`, 테스트 `npm test`, 타입 검사 `npm run typecheck`. 실행 결과는 `runs/`(git 제외)
- `docs/design/brainstorm-log.md` — 확정된 결정과 열린 질문. 질문·설계 절의 전제는 여기 있는 것뿐이다(공통 G-007)
- `docs/superpowers/specs/` — 설계서
- `docs/archive/reports/` — 지난 HTML 보고서
- `harness/` — 이 게임의 하네스 교훈 색인(`LESSONS.md`, L-NNN)과 라이브러리. 루프와 범위 판정 기준은 `D:/game/harness/README.md`
- `.claude/skills/`, `.claude/agents/` — 이 게임 전용. 공통 것은 정션(`.claude/skills/<공통 스킬>`, `.claude/agents/_common`)이라 git에 들어가지 않는다. 공통 스킬과 같은 이름의 게임 스킬은 만들지 않는다

## 하지 않는 것

- 승인된 설계·구현 계획 없이 게임 프로젝트·코드 파일을 만들기.

이 문서는 이 게임의 기본 하네스다. 모든 게임에 해당하는 규칙은 여기 두지 않고 공통 하네스로 보낸다(`harness-reflect` 범위 판정). 여기 추가되는 규칙은 출처 항목을 `<!-- L-NNN -->` 주석으로 단다.
