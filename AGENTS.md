# AGENTS.md — proxywar (가제)

플레이어가 AI를 연결하는 서버 턴제 전쟁 시뮬레이션. 프롬프트 없이 세팅값(boolean·1~5)으로만 참모 AI를 조율하고, 영웅을 육성해 거점 발전·공격·방어·정형 외교로 겨룬다. 플랫폼·목표는 미정.
공통 규칙은 상위 폴더의 `D:/game/AGENTS.md`(자동 로드)에 있다. 이 문서에는 이 게임에만 해당하는 것만 둔다.

## 지금 어디에 있나

2026-10-27 게임 폴더 생성. 첫 게임 규칙 설계서 승인(`docs/superpowers/specs/2026-10-27-game-rules-design.md`). 기술 설계(서버·연동·클라이언트)는 아직 없음.

## 어디에 무엇이 있나

- `docs/design/brainstorm-log.md` — 확정된 결정과 열린 질문. 질문·설계 절의 전제는 여기 있는 것뿐이다(공통 G-007)
- `docs/superpowers/specs/` — 설계서
- `docs/archive/reports/` — `design-report` 스킬이 만드는 HTML 보고서
- `harness/` — 이 게임의 하네스 교훈 색인(`LESSONS.md`, L-NNN)과 라이브러리. 루프와 범위 판정 기준은 `D:/game/harness/README.md`
- `.claude/skills/`, `.claude/agents/` — 이 게임 전용. 공통 것은 정션(`.claude/skills/<공통 스킬>`, `.claude/agents/_common`)이라 git에 들어가지 않는다. 공통 스킬과 같은 이름의 게임 스킬은 만들지 않는다

## 하지 않는 것

- 승인된 설계·구현 계획 없이 게임 프로젝트·코드 파일을 만들기.

이 문서는 이 게임의 기본 하네스다. 모든 게임에 해당하는 규칙은 여기 두지 않고 공통 하네스로 보낸다(`harness-reflect` 범위 판정). 여기 추가되는 규칙은 출처 항목을 `<!-- L-NNN -->` 주석으로 단다.
