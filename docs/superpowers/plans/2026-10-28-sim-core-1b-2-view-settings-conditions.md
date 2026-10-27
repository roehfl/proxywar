# 1b-2 시야·세팅·제약·조건부 명령 구현 계획

> Task 순서대로 구현한다. 단계는 체크박스(`- [ ]`)로 진행을 표시한다.

**Goal:** 참모가 전체 상태 대신 자기 시야 안의 보고서 데이터로 계획하고, 자리마다 세팅 5종(프리셋 또는 직접 값)을 갖고, 게임이 상시 명령·안전장치로 계획을 고쳐 확정하며, 임무에 붙은 조건이 턴 처리 중에 반응한다. 규칙 참모 6명 매치가 이 규칙으로 끝까지 돈다.

**Architecture:** 1a·1b-1 구조(직렬화 가능한 상태 + `processTurn` 순수 함수 + 규칙 참모)를 그대로 쓴다. 새 모듈은 `view.ts`(자리별 시야와 보고서 데이터), `settings.ts`(세팅 스키마·프리셋), `confirm.ts`(제약 적용과 확정), `rules/conditions.ts`(조건 판정·반응)다. `processTurn`의 순서는 충성 판정 → 이동 → **조건 판정·반응** → 전투 → 생산·건설·모집·유지비 → 레벨업 → 회복 → 탈락·종료다. 참모 입력은 `{ state, seat }`에서 `{ view }`로 바뀌고, 실행기는 참모 호출 → 검증 → 확정 → 처리 순서로 돈다.

**Tech Stack:** 1a와 같다(Node 24.11.1, TypeScript 7.0.2, zod 4.6.7, vitest 5.0.5, tsx 4.23.15). 새 의존성 없음.

**설계서:** `docs/superpowers/specs/2026-10-27-sim-core-design.md`(승인 2026-10-27) 하위 프로젝트 1의 1b를 세 조각으로 나눈 것 중 둘째다(결정 기록 `docs/design/brainstorm-log.md`의 "1b는 세 조각으로 나눈다"). 게임 규칙은 `docs/superpowers/specs/2026-10-27-game-rules-design.md` 2(시야)·3.2~3.6절. 1a·1b-1 계획 머리말의 "실행 중 변경"도 현행 규칙이다.

**1b-2 범위:** 자리별 시야 계산과 보고서 데이터(`SeatView`), 첩보망 건물, 기동 능력치의 시야 용도, 세팅 5종 스키마와 프리셋, 실행 설정의 세팅·상시 명령, 규칙 참모가 시야와 세팅으로 계획하기, 제약(상시 명령 + 안전장치) 적용과 수정 기록, 조건부 명령(조건 4종·반응 4종), 참모 메모 칸(상태에 저장하고 다음 시야에 넣음), 기록 version 3과 보고서의 세팅·수정·조건 통계.

**1b-2에서 하지 않는 것:**
- 외교 6종, 동맹 시야 공유, "동맹 신의"·"보복 성향" 성향과 "동맹 공격 금지" 안전장치의 효과(1b-3). 값은 스키마와 상태에 둔다.
- 보고서 글, 정보 구성에 따른 항목 선택과 길이 예산 자르기, 참모 메모 길이 자르기(1c). 정보 구성은 스키마와 상태에만 둔다.
- 지난 턴 사건에서 나오는 정보(정보 구성의 "적 이동 기록"·"지난 턴 결과"). 사건마다 누가 볼 수 있는지 거르는 일이 보고서 글과 함께 가야 해서 1c로 미룬다(아래 설계서 대비 변경 3).
- 사람 조작(직접 수정·수동 재계획·탐험). 확정 순서의 "직접 수정" 칸은 타입만 두고 비워 둔다(설계서 1절).
- 규칙 참모의 첩보망 건설. 규칙 참모는 1칸 이웃만 공격하므로 넓은 시야를 쓰지 않는다.

**설계서 대비 변경(이유 포함):**
1. **규칙 참모의 성향은 "행동 후보의 점수 가중치"(설계서 5.5)가 아니라 지금 휴리스틱의 매개변수로 쓴다.** 1a·1b-1 규칙 참모는 점수 비교가 아니라 단계별 규칙(혼자 공격 → 함께 공격 → 나머지)이다. 점수식으로 다시 짜면 1b-1 결과와 비교할 기준이 사라진다. 성향마다 어느 매개변수를 움직이는지는 제안표에 적는다.
2. **기본 세팅(프리셋 `balanced`, 수도 최소 수비 3, 상시 명령 없음)은 1b-1 규칙 참모와 같은 매치를 만든다.** 지금 상수(공격 여유 1.3, 수도 예비 30, 약한 영웅 50%, 식량 5턴, 건설 1건·남길 금 15)가 `balanced`의 값이다. 시야를 받아도 규칙 참모가 쓰는 정보는 모두 1칸 안이라 판단이 같다. 이 일치를 회귀 테스트로 둔다(1b-1 코드로 `rule6` 시드 1~8의 종료 사유·턴·승자·순위를 먼저 뽑는다).
3. **정보 구성의 "적 이동 기록"·"지난 턴 결과"는 1c로 간다.** 1b-2의 시야 데이터는 지금 상태의 스냅숏이다.
4. **"후퇴 기준" 상시 명령은 확정 때 계획을 고치지 않고, 전투에서 신중과 같은 판정으로 강제한다.** 공격 직전의 병력 비율을 봐야 의미가 있는 명령이라서다. 나머지 상시 명령과 안전장치는 확정 때 고친다.
5. **매치 기록 `version`이 3이 된다.** 참모 입력·확정 수정 내역·세팅이 들어가기 때문이다.
6. **(실행 중 반영) 구현은 계획 코드 그대로 했다.**
   - 사용자 결정으로 `main`에서 커밋 없이 진행했다(Task별 커밋 단계는 건너뜀).
   - Task마다 테스트 수가 Expected와 같았다(146 → 153 → 171 → 178 → 188 → 195 → 197 → 205 → 217 → 218). 타입 오류도 없었다. Task 3의 스프레드 대안은 쓰지 않았다.
   - 회귀 테스트 8개는 Task 1부터 끝까지 통과했다. 기본 세팅의 시야 기반 규칙 참모는 1b-1과 같은 매치를 만든다.
   - 별도 코드 리뷰는 하지 않았다.
7. **(실행 중 반영) 실측(2026-10-28).**
   - `rule6`: 턴 제한, 승자 Frost, 120턴(회귀 기준과 같다). `rule6-traits`: T63 조기 승리, 승자 Ember. `rule6-presets` 시드 1: T81 조기 승리, 승자 Ember(diplomatic).
   - 세 매치와 프리셋 시드 1~8 모두 확정 수정 0건, 무효 명령 0건이다. 규칙 참모가 상시 명령·안전장치를 미리 지킨다.
   - 프리셋 시드 1~8: 조기 승리 6개, 턴 제한 2개(시드 6·7). 조건 발동은 매치당 12~63건으로 대부분 Frost(aggressive, 위험 감수 2)와 위험 감수 1·2인 프리셋에서 나왔다. 후퇴 기준 물러남은 매치당 0~2건(Briar-1, 후퇴 기준 4)이다.
   - 시드 1~8 평균 순위: Cobalt(economic) 2.0, Frost(aggressive + 위험 감수 2) 2.6, Dune(defensive) 3.0, Ember(diplomatic) 3.75, Aster(balanced) 4.5, Briar(aggressive) 5.1. 자리 위치가 고정이라 프리셋 효과와 섞여 있다. 가설 A 판정은 1d의 자리 순환 배치로 한다.

**세부 규칙·수치(사용자 확정 2026-10-28).** 결정 기록에 따라 이 계획에서 처음 제안했고, Task를 쓰기 전에 사용자가 제안표대로 확정했다(후퇴 기준은 전투 직전 판정, 지난 턴 사건 정보는 1c). 수치는 1d 측정으로 조정한다. "현재 수도"는 모두 그 판단 시점의 수도다(L-003). 같은 단계에서 대상이 바뀔 수 있는 규칙은 판단 시점을 적었다(L-004).

#### 시야
| 항목 | 제안 |
|---|---|
| 보이는 거점 | 다음의 합집합. ① 아군 거점과 그 1칸 이웃 ② 활동 영웅이 서 있는 거점에서, 기동 15 이상이면 2칸 이내 ③ 첩보망 레벨 L인 아군 거점에서 `1 + L`칸 이내. 계산은 참모 호출 때의 상태로 한다 |
| 기동 15 | 3성은 시작 14라 레벨업 1~2번 뒤, 4·5성은 처음부터 2칸이다. 1·2성은 레벨 상한 근처에서야 닿는다 |
| 보이는 거점의 정보 | 주인, 수비대, 건물 레벨, 그 거점에 있는 영웅(자리·이름·등급·레벨·능력치·병력·상태) |
| 남의 영웅에서 숨기는 것 | 특성, 경험치, 숨은 성장 계수. 숨은 성장 계수는 내 영웅도 숨긴다(아웃라이어는 겉으로 표시되지 않는다, 게임 규칙 5.5) |
| 안 보이는 거점 | 맵 구조(id·종류·인접)만. 주인·수비대·건물·영웅은 모른다 |
| 공개 정보 | 모든 자리의 이름·거점 수·점수·탈락 여부, 현재 턴·최대 턴. 남의 금고와 현재 수도 위치는 숨긴다 |
| 내 정보 | 금고, 현재 수도, 내 영웅 전부(부상·포로 포함, 포로면 잡은 자리), 내가 잡은 포로, 내 세팅, 지난 참모 메모 |
| 첩보망 `intel` | 네 번째 건물. 비용·최고 레벨·점령 손상·점수는 다른 건물과 같다(금 `20 × L`, 자재 `30 × L`, 레벨 0~3) |

#### 세팅 5종
| 종류 | 항목(키) | 값 | 1b-2에서 |
|---|---|---|---|
| 성향 | 공격성 `aggression`, 확장 욕구 `expansion`, 위험 감수 `risk`, 동맹 신의 `fidelity`, 내정↔군사 `focus`(1 내정 ~ 5 군사), 보복 성향 `retaliation` | 1~5 | 규칙 참모가 앞의 넷 중 `aggression`·`expansion`·`risk`·`focus`를 쓴다. `fidelity`·`retaliation`은 1b-3 |
| 지침 | 식량 부족 시 모집 자제 `foodCaution`, 희귀 자원지 우선 `rareFirst`, 약한 상대 우선 `weakFirst` | boolean | 규칙 참모가 쓴다. 게임은 강제하지 않는다 |
| 안전장치 | 수도 최소 수비 `capitalMin`, 동맹 공격 금지 `noAllyAttack` | 끔 또는 1~5 / boolean | `capitalMin`은 확정 때 강제. `noAllyAttack`은 1b-3 |
| 정보 구성 | 시야 내 적 병력·적 이동 기록·외교 이력·지난 턴 결과·영웅 상세·순위표·탐험 보고 각각 켬/끔 + 상세도, 참모 메모 길이 | boolean + 1~5 / 1~5 | 스키마와 상태만(1c) |
| 상시 명령(영웅별) | 수도 방어 전담 `guardCapital`, 후퇴 기준 `retreatAt`, 원정 허용 `expedition` | boolean / 끔 또는 1~5 / boolean(기본 켬) | 확정·전투에서 강제 |

#### 프리셋
| 프리셋 | 공격성 | 확장 | 위험 | 신의 | 내정↔군사 | 보복 | 지침 | 수도 최소 수비 |
|---|---|---|---|---|---|---|---|---|
| `balanced` 균형(기본) | 3 | 3 | 3 | 3 | 3 | 3 | 식량 자제 | 3 |
| `aggressive` 공격형 | 5 | 4 | 4 | 2 | 4 | 4 | 식량 자제, 약한 상대 우선 | 2 |
| `economic` 내정형 | 2 | 2 | 2 | 3 | 1 | 3 | 식량 자제, 희귀 우선 | 4 |
| `defensive` 수비형 | 1 | 2 | 1 | 4 | 2 | 3 | 식량 자제 | 5 |
| `diplomatic` 외교형 | 2 | 3 | 2 | 5 | 3 | 1 | 식량 자제 | 3 |

외교형은 1b-2에서는 내정형에 가까운 판단을 하고, 차이는 1b-3에서 드러난다. 실행 설정에서는 자리마다 `settings`에 프리셋 이름을 주거나, 프리셋 이름 + 바꿀 값(`{ "preset": "aggressive", "tendency": { "risk": 2 } }`)을 준다. 없으면 `balanced`다. 상시 명령은 영웅 설정의 `standing`에 둔다.

#### 규칙 참모가 세팅을 쓰는 법
| 세팅 | 값별 동작(1 → 5) | `balanced`(3) = 1b-1 |
|---|---|---|
| 공격성 | 공격 여유 배수(추정 공격력이 추정 방어력의 몇 배를 넘어야 공격하나) 1.7 / 1.5 / 1.3 / 1.15 / 1.0 | 1.3 |
| 위험 감수 | "약한 영웅"(병력을 채우러 돌아가거나 운영하는) 기준, 통솔 상한의 70% / 60% / 50% / 40% / 30%. 1·2면 공격 임무마다 조건 "병력 비율 아래 3 → 방어"를 붙인다 | 50%, 조건 없음 |
| 확장 욕구 | 공격 목표 우선: 1·2 남의 거점 먼저, 3 방어력 순, 4·5 중립 먼저 | 방어력 순 |
| 내정↔군사 | 턴당 건설 최대 2 / 2 / 1 / 1 / 0건, 건설 뒤 남길 금 5 / 10 / 15 / 20 / — | 1건, 15 |
| 식량 자제 | 켜면 모집 뒤 식량을 예상 유지비 5턴치 남기고, 끄면 1턴치 | 켬(5턴) |
| 희귀 우선 | 켜면 공격 목표 중 희귀 자원지 먼저 | 끔 |
| 약한 상대 우선 | 켜면 공격 목표 중 거점 수가 가장 적은 자리(중립 제외)의 거점 먼저 | 끔 |
| 목표 정렬 | 희귀 우선 → 약한 상대 우선 → 확장 욕구 → 추정 방어력 → id. 이 순서로 정렬한 뒤 공격 여유를 넘는 첫 목표를 고른다 | 방어력 → id |
| 수도 최소 수비 | 현재 수도에 `L × 10`을 남기고 꺼낸다(끔이면 0) | 30 |
| 상시 명령 | 미리 지킨다. 수도 방어 전담 영웅은 현재 수도에 있으면 방어, 아니면 수도로 한 걸음. 원정 불허 영웅은 현재 수도에서 2칸 넘는 목표·이동을 고르지 않는다. 후퇴 기준이 있으면 공격 여유를 `max(공격 여유, 후퇴 기준값)`으로 본다 | 없음 |

#### 제약과 확정(`confirmPlan`, 검증 뒤·처리 전)
| 순서 | 제약 | 고치는 법 |
|---|---|---|
| 1 | 수도 방어 전담 | 공격·운영 임무는 방어로. 이동은 현재 수도로 가는 최단 경로(아군 거점만 지남)의 다음 거점이면 두고, 아니면 방어로. 붙은 조건은 반응이 방어일 때만 두고 아니면 조건만 뺀다 |
| 2 | 원정 불허 | 공격 목표·이동 거점이 현재 수도에서 맵 거리 2칸을 넘으면 방어로. 진격·증원 반응의 거점이 그러면 조건만 뺀다 |
| 3 | 수도 최소 수비 L | 현재 수도에서 꺼내는 병력(이동·공격 임무의 `draw`) 합이 `수도 수비대 − L × 10`(0 이상)을 넘지 않게, 영웅 id 순으로 앞에서부터 채우고 넘는 만큼 줄인다 |

- 1·2는 임무 종류를, 3은 꺼내는 병력을 고친다. 3은 1·2를 적용한 뒤의 임무로 계산한다.
- "현재 수도"는 확정 시점의 수도다. 꺼내기는 이동 단계(전투 앞)에서 일어나므로 그 사이에 수도가 바뀌지 않는다.
- 고친 내역은 `{ hero, rule, before, after }`로 기록하고 보고서에 수를 낸다.
- **후퇴 기준 L**은 전투에서 신중 판정과 함께 본다. 기준값은 1~5 → 0.6 / 0.8 / 1.0 / 1.2 / 1.4이고, 영웅의 물러남 기준은 `max(신중 기준, 후퇴 기준값)`이다. 판정 방식(공격 직전, 무작위 폭을 뺀 부대 공격력 대 방어력, 부대 전체로 한 번)은 1b-1 신중과 같다. 사건은 `hesitated`에 이유(`caution` / `standing`)를 더한다.

#### 조건부 명령
임무 하나에 조건 하나(`when: { trigger, react }`)를 붙일 수 있다. 충성 판정과 이동 뒤, 전투 앞의 "조건 판정·반응" 단계에서 처리한다.

| 조건 `trigger` | 참이 되는 때 |
|---|---|
| 적 접근 `enemyNear` | 다른 자리의 활동 영웅(병력 1 이상)이 이 영웅이 서 있는 거점의 이웃 거점에 있다 |
| 대상 거점이 빔 `targetEmpty { node }` | `node`(이 영웅 위치의 이웃)의 수비대가 0이고 그곳을 지키는 영웅이 없다. 공격 임무는 `node`를 생략하면 공격 목표다 |
| 병력 비율 `ratioBelow { value }` | 공격 임무에만. 같은 자리·같은 목표 부대의 무작위 폭을 뺀 공격력이 목표 방어력 × 기준보다 낮다. 기준 1~5 → 0.8 / 1.0 / 1.2 / 1.4 / 1.6 |
| 아군 거점 피습 `allyAttacked { node }` | 아군 거점 `node`(이 영웅의 위치나 그 이웃)를 이번 턴 공격하는 다른 자리 임무가 있다 |

| 반응 `react` | 하는 일 |
|---|---|
| 후퇴 `retreat` | 이웃 아군 거점 중 현재 수도에 가장 가까운 곳(아군 거점만 지난 거리, 동률은 id)으로 병력과 함께 옮겨 방어한다. 없으면 제자리 방어 |
| 진격 `advance { node }` | 이웃 거점 `node`를 지금 병력으로(더 꺼내지 않고) 공격한다. `node`가 아군이면 제자리 방어 |
| 증원 `reinforce { node }` | 이웃 아군 거점 `node`로 옮겨 방어한다. 아군이 아니면 제자리 방어 |
| 방어 `defend` | 제자리 방어 |

- **판정은 한 스냅숏에서 모두 동시에 한다.** 조건은 이동 뒤 상태와 충성 판정 뒤의 임무로 판정하고, 그다음 반응을 한꺼번에 적용한다. 반응이 다른 조건을 다시 부르지 않는다(한 번만 돈다). 그래서 영웅 처리 순서로 결과가 갈리지 않는다(L-004).
- 충성 판정으로 방어로 바뀐 임무는 조건도 함께 사라진다.
- 병력 비율의 방어력은 1b-1 전투와 같이, 공격·운영 임무를 받은 방어 쪽 영웅을 빼고 계산한다(스냅숏의 임무 기준).
- 검증(`validatePlan`): 조건의 `node`는 있는 거점이어야 하고, 이동 임무면 도착 거점 기준, 아니면 지금 위치 기준으로 이웃이어야 한다(`allyAttacked`는 위치 자신도 된다). `ratioBelow`는 공격 임무에만, `value`는 1~5 정수. 잘못되면 그 임무 전체를 뺀다(1b-1과 같은 항목 단위).
- 사건: 조건이 참이면 `conditionMet { seat, hero, trigger, react }`, 이어서 반응의 결과(`moved` 등).

#### 참모 메모·기록·보고서
| 항목 | 제안 |
|---|---|
| 참모 메모 | 계획에 `memo`(문자열, 선택)를 더한다. 처리 때 자리 상태 `memo`에 저장하고 다음 시야에 넣는다. 규칙 참모는 비운다. 길이 자르기는 1c |
| 참모 입력 | `StaffInput = { view: SeatView }`. 규칙 참모는 `view`만 본다(전체 상태를 받지 않는다) |
| 실행기 | 참모 호출(시야) → 검증 → 확정 → 처리. 턴 기록에 확정 수정 내역을 더한다 |
| 기록 | `version: 3`. 자리별 세팅은 초기 상태에 들어 있다 |
| 보고서 | 자리별 세팅 요약(프리셋·바꾼 값), 확정 수정 수, 조건 발동 수, 후퇴 기준 물러남 수 |
| 새 실행 설정 | `rule6-presets.json`: 다섯 프리셋이 섞이고 상시 명령이 몇 개 붙은 규칙 참모 6명 |

**실행 주체:** 모든 단계를 에이전트가 실행한다(공통 G-004). 명령은 모두 `D:/game/proxywar`에서 실행한다.

**브랜치·커밋:** 실행 시작 때 사용자에게 묻는다. 승인되면 `sim-core-1b-2` 브랜치를 만들고, 첫 커밋으로 설계 문서(결정 기록·AGENTS.md·이 계획)를 넣은 뒤 Task마다 끝에서 커밋한다. push·main 머지는 하지 않는다. 검증 출력은 실제로 읽고 Expected와 대조한 뒤에만 다음 단계로 간다(공통 G-006).

**기준선(2026-10-28 확인):** `npm test` → `Test Files  15 passed`, `Tests  138 passed`. `npm run typecheck` → 오류 없음. 회귀 기준값(1b-1 코드, `rule6` 시드 1~8)은 Task 1에 있다.

---

## 파일 구조

```
packages/core/
  src/types.ts                   Modify: 첩보망, Board, 세팅·상시 명령, 조건부 명령, 메모, 새 이벤트
  src/data/balance.json          Modify: view·conditions·constraints 수치
  src/data/presets.json          Create: 세팅 프리셋 5개
  src/data/balance.ts            Modify: BUILDING_KINDS에 intel, recruitCapAt, terrainOf가 Board를 받음
  src/settings.ts                Create: 세팅 스키마, 프리셋, resolveSettings
  src/setup.ts                   Modify: 자리 settings, 영웅 standing
  src/state.ts                   Modify: 첩보망·세팅·메모·상시 명령 초기값
  src/summary.ts                 Modify: ownedNodes·totalTroops가 Board를 받음
  src/view.ts                    Create: visibleNodes, viewOf, boardOf, SeatView
  src/orders.ts                  Modify: 조건부 명령 검증, 메모 통과
  src/confirm.ts                 Create: confirmPlan(상시 명령 + 안전장치)
  src/rules/power.ts             Modify: Board를 받는 전투력 계산
  src/rules/conditions.ts        Create: resolveConditions(조건 판정·반응)
  src/rules/traits.ts            Modify: hesitationOf(신중 + 후퇴 기준)
  src/rules/combat.ts            Modify: 물러남 판정에 후퇴 기준과 이유
  src/rules/turn.ts              Modify: 메모 저장, 조건 판정·반응 단계
  src/staff/types.ts             Modify: StaffInput = { view }
  src/staff/rule-staff.ts        Modify: 시야와 세팅으로 계획
  src/index.ts                   Modify: 새 공개 API
  test/helpers.ts                Modify: 세팅·상시 명령 기본값
  test/view.test.ts              Create
  test/settings.test.ts          Create
  test/conditions.test.ts        Create
  test/confirm.test.ts           Create
  test/{state,orders,combat,traits,turn,rule-staff}.test.ts   Modify
packages/sim/
  configs/rule6-presets.json     Create: 프리셋 5개와 상시 명령이 섞인 규칙 참모 6명
  src/runner.ts                  Modify: 시야로 참모 호출, 확정, 기록 version 3
  src/report.ts                  Modify: 세팅 표, 영웅·건설·명령 통계
  test/regression.test.ts        Create: 기본 세팅 = 1b-1 매치
  test/runner.test.ts            Modify
  test/report.test.ts            Modify
```

테스트 수는 Task마다 Expected에 적었다. 기준선 138개에서 Task 10 끝에 218개(core 202, sim 16)가 된다.

---

### Task 1: 회귀 기준과 브랜치

**Files:**
- Create: `packages/sim/test/regression.test.ts`

- [ ] **Step 1: 브랜치·커밋 여부를 사용자에게 묻는다**

제안표는 계획을 쓰기 전에 확정됐고 결정 기록에도 들어갔다. 브랜치·커밋이 승인되면:
```bash
git -C D:/game/proxywar switch -c sim-core-1b-2
git -C D:/game/proxywar add AGENTS.md docs/design/brainstorm-log.md docs/superpowers/plans/2026-10-28-sim-core-1b-2-view-settings-conditions.md
git -C D:/game/proxywar commit -m "docs: 1b-2 시야·세팅·제약·조건부 명령 계획"
```
Expected: `Switched to a new branch 'sim-core-1b-2'`, 커밋 1개(파일 3개).

- [ ] **Step 2: 회귀 테스트를 쓴다**

`packages/sim/test/regression.test.ts`:
```ts
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseRunConfig } from "../src/config";
import { runMatch, staffFor } from "../src/runner";

const raw = JSON.parse(readFileSync(new URL("../configs/rule6.json", import.meta.url), "utf8"));

/**
 * 1b-1 코드(커밋 d86127b)로 뽑은 rule6 시드 1~8의 결과. hash는 턴별 [사건, 지표]의 sha256 앞 16자다.
 * 세팅을 주지 않은 매치(balanced, 수도 최소 수비 3, 상시 명령 없음)는 1b-2에서도 이 매치를 그대로 만든다.
 */
const EXPECTED = [
  { seed: 1, reason: "turnLimit", turns: 120, winner: 5, ranking: [5, 3, 2, 0, 4, 1], hash: "5ab5d5c823266791" },
  { seed: 2, reason: "earlyVictory", turns: 91, winner: 0, ranking: [0, 3, 5, 1, 4, 2], hash: "20e62617477b02bc" },
  { seed: 3, reason: "turnLimit", turns: 120, winner: 1, ranking: [1, 3, 5, 2, 0, 4], hash: "2b9563ab1d66c039" },
  { seed: 4, reason: "earlyVictory", turns: 72, winner: 0, ranking: [0, 2, 3, 1, 5, 4], hash: "085b32a4806c7909" },
  { seed: 5, reason: "earlyVictory", turns: 80, winner: 5, ranking: [5, 2, 1, 0, 3, 4], hash: "3cc578f8fb4989fe" },
  { seed: 6, reason: "earlyVictory", turns: 95, winner: 1, ranking: [1, 0, 4, 2, 3, 5], hash: "806ec1174f30da27" },
  { seed: 7, reason: "earlyVictory", turns: 103, winner: 4, ranking: [4, 2, 1, 0, 5, 3], hash: "8be28322bec1567a" },
  { seed: 8, reason: "turnLimit", turns: 120, winner: 1, ranking: [1, 2, 4, 5, 0, 3], hash: "d61cba2f397b5194" },
];

describe("기본 세팅 회귀", () => {
  it.each(EXPECTED)("rule6 시드 $seed는 1b-1과 같은 매치다", async ({ seed, hash, ...result }) => {
    const config = parseRunConfig({ ...raw, seed });
    const record = await runMatch(
      config,
      config.seats.map((s) => staffFor(s.staff)),
    );
    expect({
      reason: record.result.reason,
      turns: record.turns.length,
      winner: record.result.winner,
      ranking: record.result.ranking,
    }).toEqual(result);
    const digest = createHash("sha256")
      .update(JSON.stringify(record.turns.map((t) => [t.events, t.metrics])))
      .digest("hex")
      .slice(0, 16);
    expect(digest).toBe(hash);
  });
});
```

- [ ] **Step 3: 지금 코드에서 통과하는지 본다**

Run: `npm test -- packages/sim/test/regression.test.ts`
Expected: `Tests  8 passed`. 실패하면 기준값을 뽑은 뒤 코드가 바뀐 것이다. 진행하지 말고 `git log`로 확인해 보고한다.

Run: `npm test`
Expected: `Test Files  16 passed`, `Tests  146 passed`.

- [ ] **Step 4: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add packages/sim/test/regression.test.ts
git -C D:/game/proxywar commit -m "test(sim): 기본 세팅 회귀 기준(1b-1 rule6 시드 1~8)"
```

이후 모든 Task에서 이 테스트가 깨지면 그 Task가 기본 세팅의 동작을 바꾼 것이다. 기대값을 고치지 말고 원인을 찾는다.

---

### Task 2: 첩보망과 시야 계산

**Files:**
- Modify: `packages/core/src/types.ts`, `packages/core/src/data/balance.json`, `packages/core/src/data/balance.ts`, `packages/core/src/state.ts`, `packages/core/src/index.ts`
- Create: `packages/core/src/view.ts`
- Test: `packages/core/test/view.test.ts`(새 파일), `packages/core/test/state.test.ts`, `packages/core/test/combat.test.ts`, `packages/core/test/orders.test.ts`

- [ ] **Step 1: 시야 테스트를 쓴다**

`packages/core/test/view.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import type { HeroStatus } from "../src/types";
import { visibleNodes } from "../src/view";
import { heroOf, makeState } from "./helpers";

const sorted = (set: Set<string>): string[] => [...set].sort();

describe("visibleNodes", () => {
  it("시작 상태에서는 수도와 그 1칸 이웃만 보인다(3성 기동 14)", () => {
    expect(sorted(visibleNodes(makeState(), 0))).toEqual(["c0", "f0", "m0"]);
  });

  it("아군 거점마다 1칸 이웃이 보인다", () => {
    const state = makeState();
    state.nodes.i0.owner = 0;
    expect(sorted(visibleNodes(state, 0))).toEqual(["c0", "f0", "i0", "i1", "i5", "m0", "x0"]);
  });

  it("기동 15 이상인 활동 영웅은 서 있는 거점에서 2칸까지 본다", () => {
    const state = makeState();
    heroOf(state, "s0h0").stats.mobility = 15;
    expect(sorted(visibleNodes(state, 0))).toEqual(["c0", "f0", "m0", "x0", "x5"]);
  });

  it.each<[HeroStatus]>([["injured"], ["captured"]])("%s 영웅은 시야를 주지 않는다", (status) => {
    const state = makeState();
    const hero = heroOf(state, "s0h0");
    hero.status = status;
    hero.stats.mobility = 20;
    expect(sorted(visibleNodes(state, 0))).toEqual(["c0", "f0", "m0"]);
  });

  it("첩보망 레벨 L인 아군 거점은 1 + L칸까지 본다", () => {
    const state = makeState();
    state.nodes.c0.buildings.intel = 1;
    expect(sorted(visibleNodes(state, 0))).toEqual(["c0", "f0", "m0", "x0", "x5"]);
    state.nodes.c0.buildings.intel = 2;
    expect(sorted(visibleNodes(state, 0))).toEqual(["c0", "f0", "f1", "i0", "i5", "m0", "m5", "x0", "x5"]);
  });
});
```

`packages/core/test/orders.test.ts`의 "최고 레벨(3) 건물은 더 짓지 못한다" 테스트 바로 앞에 더한다:
```ts
  it("첩보망도 짓는다", () => {
    expect(reasons(makeState(), buildsOnly({ node: "c0", building: "intel" }))).toEqual([]);
  });
```

`packages/core/test/state.test.ts`:
- 7번 줄 `const NO_BUILDINGS = { production: 0, barracks: 0, walls: 0 };`를 `const NO_BUILDINGS = { production: 0, barracks: 0, walls: 0, intel: 0 };`로 바꾼다.
- "건물 레벨 합 × 3과…" 테스트의 `fresh.nodes.c0.buildings = { production: 2, barracks: 0, walls: 1 };`를 `fresh.nodes.c0.buildings = { production: 2, barracks: 0, walls: 0, intel: 1 };`로 바꾼다(레벨 합 3은 같고, 첩보망도 점수에 들어가는지 본다).

`packages/core/test/combat.test.ts`:
- 첫 테스트의 `buildings: { production: 0, barracks: 0, walls: 0 }`를 `buildings: { production: 0, barracks: 0, walls: 0, intel: 0 }`로 바꾼다.
- "점령된 거점의 건물은…" 테스트의 `state.nodes.f0.buildings = { production: 2, barracks: 0, walls: 1 };`를 `state.nodes.f0.buildings = { production: 2, barracks: 0, walls: 1, intel: 1 };`로, 마지막 줄의 `buildings: { production: 1, barracks: 0, walls: 0 }`를 `buildings: { production: 1, barracks: 0, walls: 0, intel: 0 }`로 바꾼다.

- [ ] **Step 2: 실패를 확인한다**

Run: `npm test -- packages/core/test/view.test.ts packages/core/test/orders.test.ts`
Expected: FAIL. `view.test.ts`는 `Cannot find module '../src/view'`, 첩보망 건설은 `unknown building`으로 빠진다.

- [ ] **Step 3: 첩보망을 더한다**

`packages/core/src/types.ts`의 건물 타입:
```ts
export type BuildingKind = "production" | "barracks" | "walls" | "intel";
```

`packages/core/src/data/balance.ts`:
```ts
export const BUILDING_KINDS: readonly BuildingKind[] = ["production", "barracks", "walls", "intel"];
```

`packages/core/src/state.ts`의 `noBuildings`:
```ts
function noBuildings(): Buildings {
  return { production: 0, barracks: 0, walls: 0, intel: 0 };
}
```

첩보망의 비용·최고 레벨·점령 손상·점수는 `BUILDING_KINDS`와 `buildCost`를 그대로 따르므로 다른 코드는 바꾸지 않는다.

- [ ] **Step 4: 시야 수치와 계산을 더한다**

`packages/core/src/data/balance.json`의 `  "combat": {` 줄 바로 앞에 넣는다:
```json
  "view": { "nodeRadius": 1, "heroRadius": 1, "scoutRadius": 2, "scoutMobility": 15, "intelRadiusPerLevel": 1 },
```

`packages/core/src/view.ts`:
```ts
import { BALANCE } from "./data/balance";
import { bfs } from "./map";
import { ownedNodes } from "./summary";
import type { GameState, NodeId, SeatId } from "./types";

/**
 * 자리의 시야: 아군 거점에서 1 + 첩보망 레벨 칸, 활동 영웅이 서 있는 거점에서 1칸(기동 15 이상이면 2칸).
 * 참모를 부를 때의 상태로 계산한다.
 */
export function visibleNodes(state: GameState, seat: SeatId): Set<NodeId> {
  const seen = new Set<NodeId>();
  const within = (from: NodeId, radius: number): void => {
    for (const [node, dist] of Object.entries(bfs(state.map, from).dist)) if (dist <= radius) seen.add(node);
  };
  const v = BALANCE.view;
  for (const node of ownedNodes(state, seat)) {
    within(node, v.nodeRadius + state.nodes[node].buildings.intel * v.intelRadiusPerLevel);
  }
  for (const hero of state.heroes) {
    if (hero.seat !== seat || hero.status !== "active") continue;
    within(hero.location, hero.stats.mobility >= v.scoutMobility ? v.scoutRadius : v.heroRadius);
  }
  return seen;
}
```

`packages/core/src/index.ts`의 `export { processTurn, … }` 줄 바로 앞에 넣는다:
```ts
export { visibleNodes } from "./view";
```

- [ ] **Step 5: 통과를 확인한다**

Run: `npm test -- packages/core/test/view.test.ts`
Expected: `Tests  6 passed`.

Run: `npm test`
Expected: `Test Files  17 passed`, `Tests  153 passed`. 회귀 테스트 8개도 통과한다(첩보망 0은 지표·사건에 닿지 않는다).

Run: `npm run typecheck`
Expected: 오류 없음.

- [ ] **Step 6: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add packages/core
git -C D:/game/proxywar commit -m "feat(core): 첩보망 건물과 자리별 시야 계산"
```

---

### Task 3: 세팅 5종·프리셋·상시 명령

**Files:**
- Modify: `packages/core/src/types.ts`, `packages/core/src/setup.ts`, `packages/core/src/state.ts`, `packages/core/src/index.ts`
- Create: `packages/core/src/settings.ts`, `packages/core/src/data/presets.json`
- Test: `packages/core/test/settings.test.ts`(새 파일), `packages/core/test/state.test.ts`, `packages/core/test/helpers.ts`

- [ ] **Step 1: 세팅 테스트를 쓴다**

`packages/core/test/settings.test.ts`:
```ts
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
```

`packages/core/test/helpers.ts`의 `makeSetup`을 바꾼다(자리에 `settings`, 영웅에 `standing`):
```ts
export function makeSetup(seed = 1): MatchSetup {
  return {
    map: "ring6",
    turns: 120,
    seed,
    seats: Array.from({ length: 6 }, (_, i) => ({
      name: `Seat${i}`,
      settings: "balanced" as const,
      heroes: Array.from({ length: 5 }, (_, j) => ({
        name: `H${i}${j}`,
        grade: 3,
        growth: 1,
        traits: {},
        standing: {},
      })),
    })),
  };
}
```

`packages/core/test/state.test.ts`:
- 첫 테스트("올바른 설정을 받아들이고…")를 다음으로 바꾼다:
```ts
  it("올바른 설정을 받아들이고 성장 계수·특성·상시 명령·세팅 기본값을 채운다", () => {
    const raw = JSON.parse(JSON.stringify(makeSetup()));
    delete raw.seats[0].heroes[0].growth;
    delete raw.seats[0].heroes[0].traits;
    delete raw.seats[0].heroes[0].standing;
    delete raw.seats[0].settings;
    const parsed = MatchSetupSchema.parse(raw);
    expect(parsed.seats[0].heroes[0].growth).toBe(1);
    expect(parsed.seats[0].heroes[0].traits).toEqual({});
    expect(parsed.seats[0].heroes[0].standing).toEqual({});
    expect(parsed.seats[0].settings).toBe("balanced");
  });
```
- `describe("MatchSetupSchema"` 블록 끝("등급 슬롯 수만큼…" 테스트 뒤)에 더한다:
```ts
  it.each<[string, object]>([
    ["범위 밖 후퇴 기준", { retreatAt: 6 }],
    ["모르는 상시 명령", { charge: true }],
  ])("상시 명령 오류를 거부한다: %s", (_, standing) => {
    const raw = JSON.parse(JSON.stringify(makeSetup()));
    raw.seats[0].heroes[0].standing = standing;
    expect(() => MatchSetupSchema.parse(raw)).toThrow();
  });
```
- `describe("initState"` 블록 끝에 더한다:
```ts
  it("자리 세팅은 프리셋을 풀어 두고, 참모 메모는 비어 있다", () => {
    expect(state.seats[0].settings.preset).toBe("balanced");
    expect(state.seats[0].settings.safeguards.capitalMin).toBe(3);
    expect(state.seats[0].memo).toBe("");
    const setup = makeSetup();
    setup.seats[2].settings = "economic";
    expect(initState(setup).seats[2].settings.tendency.focus).toBe(1);
  });

  it("상시 명령은 지정하지 않으면 전담 끔·후퇴 기준 없음·원정 허용이고, 지정한 것만 덮는다", () => {
    expect(heroOf(state, "s0h0").standing).toEqual({ guardCapital: false, retreatAt: null, expedition: true });
    const setup = makeSetup();
    setup.seats[0].heroes[1].standing = { guardCapital: true };
    expect(heroOf(initState(setup), "s0h1").standing).toEqual({ guardCapital: true, retreatAt: null, expedition: true });
  });
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm test -- packages/core/test/settings.test.ts packages/core/test/state.test.ts`
Expected: FAIL. `Cannot find module '../src/settings'`, `state.test.ts`는 `standing`·`settings`가 모르는 키로 거부된다(`Unrecognized key`).

- [ ] **Step 3: 세팅 타입을 더한다**

`packages/core/src/types.ts`에서 `export type HeroStatus = …` 줄 바로 앞에 넣는다:
```ts
/** 영웅별 상시 명령: 게임이 강제한다 */
export interface StandingOrders {
  /** 수도 방어 전담 */
  guardCapital: boolean;
  /** 후퇴 기준 1~5, null이면 없음 */
  retreatAt: number | null;
  /** 원정 허용(끄면 현재 수도에서 원정 범위 밖으로 가거나 치지 못한다) */
  expedition: boolean;
}
```
`Hero`의 `traits: Traits;` 줄 바로 뒤에 넣는다:
```ts
  standing: StandingOrders;
```
`export interface SeatState` 바로 앞에 넣는다:
```ts
export type TendencyKind = "aggression" | "expansion" | "risk" | "fidelity" | "focus" | "retaliation";
/** 성향 1~5. focus는 1 내정 ~ 5 군사다 */
export type Tendency = Record<TendencyKind, number>;

export type GuidelineKind = "foodCaution" | "rareFirst" | "weakFirst";
/** 지침: 참모에게 알리기만 하고 게임은 강제하지 않는다 */
export type Guidelines = Record<GuidelineKind, boolean>;

/** 안전장치: 게임이 강제한다 */
export interface Safeguards {
  /** 수도 최소 수비 1~5(수비대 × 10), null이면 끔 */
  capitalMin: number | null;
  /** 동맹 공격 금지(1b-3에서 쓴다) */
  noAllyAttack: boolean;
}

export type InfoItem =
  | "enemyTroops"
  | "enemyMoves"
  | "diplomacy"
  | "lastTurn"
  | "heroDetail"
  | "standings"
  | "exploration";

/** 정보 구성: 켠 항목만 보고서 글에 들어간다(1c) */
export interface InfoSettings {
  items: Record<InfoItem, { on: boolean; detail: number }>;
  /** 참모 메모 길이 1~5 */
  memoLength: number;
}

export type PresetName = "balanced" | "aggressive" | "economic" | "defensive" | "diplomatic";

/** 자리 세팅(상시 명령은 영웅마다 Hero.standing에 있다) */
export interface SeatSettings {
  preset: PresetName;
  tendency: Tendency;
  guidelines: Guidelines;
  safeguards: Safeguards;
  info: InfoSettings;
}
```
`SeatState`의 `eliminatedAt: number | null;` 줄 바로 뒤에 넣는다:
```ts
  settings: SeatSettings;
  /** 지난 계획의 참모 메모(다음 시야에 들어간다) */
  memo: string;
```

- [ ] **Step 4: 프리셋과 세팅 스키마를 만든다**

`packages/core/src/data/presets.json`:
```json
{
  "balanced": {
    "tendency": { "aggression": 3, "expansion": 3, "risk": 3, "fidelity": 3, "focus": 3, "retaliation": 3 },
    "guidelines": { "foodCaution": true, "rareFirst": false, "weakFirst": false },
    "safeguards": { "capitalMin": 3, "noAllyAttack": false }
  },
  "aggressive": {
    "tendency": { "aggression": 5, "expansion": 4, "risk": 4, "fidelity": 2, "focus": 4, "retaliation": 4 },
    "guidelines": { "foodCaution": true, "rareFirst": false, "weakFirst": true },
    "safeguards": { "capitalMin": 2, "noAllyAttack": false }
  },
  "economic": {
    "tendency": { "aggression": 2, "expansion": 2, "risk": 2, "fidelity": 3, "focus": 1, "retaliation": 3 },
    "guidelines": { "foodCaution": true, "rareFirst": true, "weakFirst": false },
    "safeguards": { "capitalMin": 4, "noAllyAttack": false }
  },
  "defensive": {
    "tendency": { "aggression": 1, "expansion": 2, "risk": 1, "fidelity": 4, "focus": 2, "retaliation": 3 },
    "guidelines": { "foodCaution": true, "rareFirst": false, "weakFirst": false },
    "safeguards": { "capitalMin": 5, "noAllyAttack": false }
  },
  "diplomatic": {
    "tendency": { "aggression": 2, "expansion": 3, "risk": 2, "fidelity": 5, "focus": 3, "retaliation": 1 },
    "guidelines": { "foodCaution": true, "rareFirst": false, "weakFirst": false },
    "safeguards": { "capitalMin": 3, "noAllyAttack": false }
  }
}
```

`packages/core/src/settings.ts`:
```ts
import { z } from "zod";
import presets from "./data/presets.json";
import type { Guidelines, InfoItem, InfoSettings, PresetName, Safeguards, SeatSettings, Tendency } from "./types";

export const PRESET_NAMES = [
  "balanced",
  "aggressive",
  "economic",
  "defensive",
  "diplomatic",
] as const satisfies readonly PresetName[];

export const INFO_ITEMS = [
  "enemyTroops",
  "enemyMoves",
  "diplomacy",
  "lastTurn",
  "heroDetail",
  "standings",
  "exploration",
] as const satisfies readonly InfoItem[];

/** 세팅의 1~5 값 */
export const LevelSchema = z.number().int().min(1).max(5);

const InfoItemSetupSchema = z.object({ on: z.boolean(), detail: LevelSchema }).partial().strict();

// 측정 도구라 모르는 키(오타)를 조용히 버리지 않고 거부한다(.strict)
const SettingsObjectSchema = z
  .object({
    preset: z.enum(PRESET_NAMES).default("balanced"),
    tendency: z
      .object({
        aggression: LevelSchema,
        expansion: LevelSchema,
        risk: LevelSchema,
        fidelity: LevelSchema,
        focus: LevelSchema,
        retaliation: LevelSchema,
      })
      .partial()
      .strict()
      .optional(),
    guidelines: z
      .object({ foodCaution: z.boolean(), rareFirst: z.boolean(), weakFirst: z.boolean() })
      .partial()
      .strict()
      .optional(),
    safeguards: z
      .object({ capitalMin: LevelSchema.nullable(), noAllyAttack: z.boolean() })
      .partial()
      .strict()
      .optional(),
    info: z
      .object({
        items: z
          .object({
            enemyTroops: InfoItemSetupSchema,
            enemyMoves: InfoItemSetupSchema,
            diplomacy: InfoItemSetupSchema,
            lastTurn: InfoItemSetupSchema,
            heroDetail: InfoItemSetupSchema,
            standings: InfoItemSetupSchema,
            exploration: InfoItemSetupSchema,
          })
          .partial()
          .strict()
          .optional(),
        memoLength: LevelSchema.optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

/** 자리 세팅: 프리셋 이름, 또는 프리셋(기본 balanced) + 바꿀 값 */
export const SettingsSetupSchema = z.union([z.enum(PRESET_NAMES), SettingsObjectSchema]);
export type SettingsSetup = z.infer<typeof SettingsSetupSchema>;

const PRESETS = presets as Record<PresetName, { tendency: Tendency; guidelines: Guidelines; safeguards: Safeguards }>;

/** 정보 구성 기본값: 모두 켬, 상세도 3, 메모 길이 3 */
function defaultInfo(): InfoSettings {
  const items = {} as InfoSettings["items"];
  for (const item of INFO_ITEMS) items[item] = { on: true, detail: 3 };
  return { items, memoLength: 3 };
}

/** 프리셋 이름 또는 프리셋 + 바꿀 값을 완전한 세팅으로 푼다 */
export function resolveSettings(input: SettingsSetup): SeatSettings {
  const spec: z.infer<typeof SettingsObjectSchema> = typeof input === "string" ? { preset: input } : input;
  const base = PRESETS[spec.preset];
  const info = defaultInfo();
  for (const item of INFO_ITEMS) Object.assign(info.items[item], spec.info?.items?.[item]);
  info.memoLength = spec.info?.memoLength ?? info.memoLength;
  return {
    preset: spec.preset,
    tendency: { ...base.tendency, ...spec.tendency },
    guidelines: { ...base.guidelines, ...spec.guidelines },
    safeguards: { ...base.safeguards, ...spec.safeguards },
    info,
  };
}
```

- [ ] **Step 5: 설정 스키마와 초기 상태에 넣는다**

`packages/core/src/setup.ts` 전체:
```ts
import { z } from "zod";
import { BALANCE } from "./data/balance";
import { LevelSchema, SettingsSetupSchema } from "./settings";

const TraitValueSchema = z.number().int().min(1).max(5);

/** 지정하지 않은 특성은 3(보통)이다 */
export const TraitsSetupSchema = z
  .object({ loyalty: TraitValueSchema, caution: TraitValueSchema, valor: TraitValueSchema })
  .partial()
  .strict();

/** 지정하지 않은 상시 명령은 수도 방어 전담 끔, 후퇴 기준 없음, 원정 허용이다 */
export const StandingSetupSchema = z
  .object({ guardCapital: z.boolean(), retreatAt: LevelSchema.nullable(), expedition: z.boolean() })
  .partial()
  .strict();

export const HeroSetupSchema = z
  .object({
    name: z.string().min(1),
    grade: z.number().int().min(1).max(5),
    growth: z.number().positive().default(1),
    traits: TraitsSetupSchema.default({}),
    standing: StandingSetupSchema.default({}),
  })
  .strict()
  .refine((h) => Object.keys(h.traits).length <= BALANCE.hero.traitSlotsByGrade[h.grade - 1], {
    message: "too many traits for grade",
    path: ["traits"],
  });

export const SeatSetupSchema = z.object({
  name: z.string().min(1),
  settings: SettingsSetupSchema.default("balanced"),
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
- import에 `import { resolveSettings } from "./settings";`를 더한다.
- 자리 생성 줄(`return { id: i, name: seat.name, capital, … };`)을 다음으로 바꾼다:
```ts
    return {
      id: i,
      name: seat.name,
      capital,
      treasury: { ...BALANCE.start.treasury },
      eliminatedAt: null,
      settings: resolveSettings(seat.settings),
      memo: "",
    };
```
- 영웅 생성의 `traits: { loyalty: 3, caution: 3, valor: 3, ...h.traits },` 줄 바로 뒤에 넣는다:
```ts
        standing: { guardCapital: false, retreatAt: null, expedition: true, ...h.standing },
```

`packages/core/src/index.ts`의 setup 줄을 바꾸고 바로 뒤에 settings 줄을 넣는다:
```ts
export {
  HeroSetupSchema,
  MatchSetupSchema,
  SeatSetupSchema,
  StandingSetupSchema,
  TraitsSetupSchema,
  type MatchSetup,
} from "./setup";
export { INFO_ITEMS, PRESET_NAMES, SettingsSetupSchema, resolveSettings, type SettingsSetup } from "./settings";
```

- [ ] **Step 6: 통과를 확인한다**

Run: `npm test -- packages/core/test/settings.test.ts packages/core/test/state.test.ts`
Expected: 모두 통과(settings 14개, state는 기존 + 4개).

Run: `npm test`
Expected: `Test Files  18 passed`, `Tests  171 passed`. 회귀 테스트 8개 통과.

Run: `npm run typecheck`
Expected: 오류 없음. `resolveSettings`의 스프레드가 `number | undefined`로 잡혀 타입 오류가 나면, 바꿀 값에서 `undefined`를 빼는 작은 함수(`Object.fromEntries(Object.entries(x ?? {}).filter(([, v]) => v !== undefined))`)를 같은 파일에 두고 세 곳에 쓴다.

- [ ] **Step 7: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add packages/core
git -C D:/game/proxywar commit -m "feat(core): 세팅 5종·프리셋·상시 명령 설정과 초기 상태"
```

---

### Task 4: 판(Board) 일반화, 시야 데이터, 참모 메모

전투력·모집 상한·병력 계산이 전체 상태 대신 "판"(`map`·`nodes`·`heroes`)을 받게 해, 규칙 참모가 시야로도 같은 함수를 쓰게 한다. 동작은 바뀌지 않는다.

**Files:**
- Modify: `packages/core/src/types.ts`, `packages/core/src/rules/power.ts`, `packages/core/src/data/balance.ts`, `packages/core/src/summary.ts`, `packages/core/src/view.ts`, `packages/core/src/orders.ts`, `packages/core/src/rules/turn.ts`, `packages/core/src/index.ts`
- Test: `packages/core/test/view.test.ts`, `packages/core/test/turn.test.ts`, `packages/core/test/orders.test.ts`

- [ ] **Step 1: 시야 데이터·메모 테스트를 쓴다**

`packages/core/test/view.test.ts`의 import를 다음으로 바꾸고, 파일 끝에 `describe("viewOf")`를 더한다:
```ts
import { describe, expect, it } from "vitest";
import { defensePower } from "../src/rules/power";
import type { HeroStatus } from "../src/types";
import { boardOf, viewOf, visibleNodes } from "../src/view";
import { heroOf, makeState } from "./helpers";
```
```ts
describe("viewOf", () => {
  it("시작 상태: 보이는 거점, 내 영웅(성장 계수 없음), 내 금고·수도·세팅·메모, 공개 순위", () => {
    const state = makeState();
    const view = viewOf(state, 0);
    expect(Object.keys(view.nodes)).toEqual(["c0", "f0", "m0"]);
    expect(view.nodes.f0).toEqual(state.nodes.f0);
    expect(view.myHeroes.map((h) => h.id)).toEqual(["s0h0", "s0h1", "s0h2", "s0h3", "s0h4"]);
    expect(view.myHeroes[0]).not.toHaveProperty("growth");
    expect(view.myHeroes[0].traits).toEqual({ loyalty: 3, caution: 3, valor: 3 });
    expect(view.foreignHeroes).toEqual([]);
    expect(view).toMatchObject({ seat: 0, turn: 0, maxTurns: 120, capital: "c0", memo: "" });
    expect(view.treasury).toEqual(state.seats[0].treasury);
    expect(view.settings.preset).toBe("balanced");
    expect(view.seats[3]).toEqual({ id: 3, name: "Seat3", nodes: 1, score: 16, eliminated: false });
    expect(view.map.nodes).toHaveLength(30);
  });

  it("보이는 거점의 남의 영웅은 특성·경험치·성장 계수·상시 명령 없이, 안 보이는 거점의 영웅은 보이지 않는다", () => {
    const state = makeState();
    state.nodes.f0.owner = 1;
    Object.assign(heroOf(state, "s1h0"), { location: "f0", troops: 40 });
    const view = viewOf(state, 0);
    expect(view.foreignHeroes.map((h) => h.id)).toEqual(["s1h0"]);
    const seen = view.foreignHeroes[0];
    expect(seen).toMatchObject({ seat: 1, location: "f0", troops: 40, level: 1, grade: 3 });
    for (const key of ["growth", "traits", "exp", "standing"]) expect(seen).not.toHaveProperty(key);
  });

  it("내가 잡은 포로는 어디 있든 보이고, 남이 잡은 포로는 보이는 거점에 있어도 보이지 않는다", () => {
    const state = makeState();
    Object.assign(heroOf(state, "s2h0"), { status: "captured", captor: 0, location: "c2" });
    Object.assign(heroOf(state, "s3h0"), { status: "captured", captor: 1, location: "f0" });
    expect(viewOf(state, 0).foreignHeroes.map((h) => h.id)).toEqual(["s2h0"]);
  });

  it("시야는 복사본이라 고쳐도 상태가 바뀌지 않는다", () => {
    const state = makeState();
    const view = viewOf(state, 0);
    view.nodes.c0.garrison = 0;
    view.myHeroes[0].troops = 99;
    expect(state.nodes.c0.garrison).toBe(60);
    expect(heroOf(state, "s0h0").troops).toBe(0);
  });

  it("boardOf로 계산한 보이는 거점의 방어력은 상태로 계산한 값과 같다", () => {
    const state = makeState();
    state.nodes.f0.owner = 1;
    state.nodes.f0.buildings.walls = 2;
    const hero = heroOf(state, "s1h0");
    Object.assign(hero, { location: "f0", troops: 40 });
    hero.stats.might = 20;
    expect(defensePower(boardOf(viewOf(state, 0)), "f0")).toBe(defensePower(state, "f0"));
  });
});
```

`packages/core/test/turn.test.ts`의 import에 `import { viewOf } from "../src/view";`를 더하고, `describe("processTurn"` 블록의 첫 테스트 뒤에 넣는다:
```ts
  it("참모 메모를 자리 상태에 남기고, 메모가 없는 자리는 비운다", () => {
    const state = makeState();
    state.seats[1].memo = "old";
    const orders = noOrders();
    orders[0].memo = "Hold f0; Seat2 is weak.";
    const { state: next } = processTurn(state, orders);
    expect(next.seats[0].memo).toBe("Hold f0; Seat2 is weak.");
    expect(next.seats[1].memo).toBe("");
    expect(viewOf(next, 0).memo).toBe("Hold f0; Seat2 is weak.");
  });
```

`packages/core/test/orders.test.ts`의 "같은 영웅의 두 번째 임무를 뺀다" 테스트 뒤에 넣는다:
```ts
  it("참모 메모는 그대로 넘긴다", () => {
    const plan: Plan = { missions: [], recruits: [], builds: [], memo: "note" };
    expect(validatePlan(makeState(), 0, plan).plan.memo).toBe("note");
  });
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm test -- packages/core/test/view.test.ts packages/core/test/turn.test.ts packages/core/test/orders.test.ts`
Expected: FAIL. `viewOf`·`boardOf`가 없고(`is not a function`), 메모가 저장되지 않는다.

- [ ] **Step 3: Board 타입과 메모 칸을 더한다**

`packages/core/src/types.ts`에서 `export interface MatchResult` 바로 앞에 넣는다:
```ts
/** 전투력·병력 계산에 쓰는 영웅 정보 */
export type BoardHero = Pick<Hero, "id" | "seat" | "status" | "location" | "troops" | "stats">;

/** 전투력·모집 상한·병력 계산에 쓰는 판. GameState와 시야(boardOf)가 모두 맞는다 */
export interface Board<H extends BoardHero = BoardHero> {
  map: GameMap;
  nodes: Record<NodeId, NodeState>;
  heroes: readonly H[];
}
```
`Plan`을 바꾼다:
```ts
export interface Plan {
  missions: Mission[];
  recruits: Recruit[];
  builds: Build[];
  /** 다음 호출의 자신에게 남기는 참모 메모 */
  memo?: string;
}
```

- [ ] **Step 4: 전투력·모집 상한·병력 계산이 Board를 받게 한다**

`packages/core/src/rules/power.ts` 전체:
```ts
import { BALANCE, terrainOf } from "../data/balance";
import type { Board, BoardHero, Hero, NodeId } from "../types";

/** 영웅 무력에 따른 방어 배수(공격은 attackModifier). 영웅이 없으면 1. */
export function heroModifier(hero: Pick<Hero, "stats"> | undefined): number {
  if (!hero) return 1;
  return 1 + (hero.stats.might - BALANCE.hero.baseStatByGrade[0]) * BALANCE.hero.mightBonusPerPoint;
}

/** 공격 배수: 무력 배수에 용맹 보정을 더한다. 영웅이 없으면 1. */
export function attackModifier(hero: Pick<Hero, "stats" | "traits"> | undefined): number {
  if (!hero) return 1;
  return heroModifier(hero) + (hero.traits.valor - 3) * BALANCE.traits.valorBonusPerPoint;
}

/** 통솔 1당 병력 상한(성장으로 통솔이 소수가 되므로 내림) */
export function troopCap(hero: Pick<Hero, "stats">): number {
  return Math.floor(hero.stats.command * BALANCE.hero.troopsPerCommand);
}

export function bestHero<H extends Pick<Hero, "stats">>(heroes: readonly H[]): H | undefined {
  let best: H | undefined;
  for (const h of heroes) if (!best || h.stats.might > best.stats.might) best = h;
  return best;
}

export function sumTroops(heroes: readonly Pick<Hero, "troops">[]): number {
  return heroes.reduce((sum, h) => sum + h.troops, 0);
}

/** 거점 주인의 영웅 중 그 거점에 있는 활동 영웅. exclude는 이번 턴 공격에 나섰거나 운영 중인 영웅. */
export function defenders<H extends BoardHero>(
  board: Board<H>,
  node: NodeId,
  exclude: ReadonlySet<string> = new Set(),
): H[] {
  const owner = board.nodes[node].owner;
  if (owner === null) return [];
  return board.heroes.filter(
    (h) => h.status === "active" && h.seat === owner && h.location === node && !exclude.has(h.id),
  );
}

/** 무작위 폭을 뺀 방어력. 규칙 참모의 추정(시야 판)과 신중 판정에도 쓴다. */
export function defensePower(board: Board, node: NodeId, exclude: ReadonlySet<string> = new Set()): number {
  const heroes = defenders(board, node, exclude);
  const troops = board.nodes[node].garrison + sumTroops(heroes);
  return troops * heroModifier(bestHero(heroes)) * terrainOf(board, node);
}

/** 무작위 폭을 뺀 공격력(무력이 가장 높은 영웅의 공격 배수) */
export function attackPower(heroes: readonly Pick<Hero, "troops" | "stats" | "traits">[]): number {
  return sumTroops(heroes) * attackModifier(bestHero(heroes));
}
```

`packages/core/src/data/balance.ts`의 import를 바꾸고, `recruitCap`·`terrainOf`를 다음으로 바꾼다(`recruitCapAt`을 더한다):
```ts
import { nodeType } from "../map";
import type { Board, BuildingKind, GameState, NodeId, SeatId } from "../types";
import balance from "./balance.json";
```
```ts
/**
 * 그 자리가 그 거점에서 한 턴에 모집할 수 있는 상한.
 * 현재 수도는 수도 상한, 도시와 (현재 수도가 아닌) 원래 수도 거점은 도시 상한, 나머지는 0이고,
 * 그 거점의 병영 레벨당 상한을 더한다.
 */
export function recruitCap(state: GameState, seat: SeatId, node: NodeId): number {
  return recruitCapAt(state, state.seats[seat].capital, node);
}

/** recruitCap을 현재 수도(capital)와 판으로 계산한다. 규칙 참모가 시야로 쓴다. */
export function recruitCapAt(board: Pick<Board, "map" | "nodes">, capital: NodeId | null, node: NodeId): number {
  const barracks = board.nodes[node].buildings.barracks * BALANCE.buildings.barracksCapPerLevel;
  if (capital === node) return BALANCE.recruit.capPerTurn.capital + barracks;
  const type = nodeType(board.map, node);
  const base = type === "capital" || type === "city" ? BALANCE.recruit.capPerTurn.city : 0;
  return base + barracks;
}

/** 지형 방어 배수에 성벽 레벨만큼 더한 값 */
export function terrainOf(board: Pick<Board, "map" | "nodes">, node: NodeId): number {
  return (
    BALANCE.terrain[nodeType(board.map, node)] +
    board.nodes[node].buildings.walls * BALANCE.buildings.wallsTerrainPerLevel
  );
}
```

`packages/core/src/summary.ts`의 import와 앞의 두 함수(`buildingLevels`·`heroLevels`·`scoreOf`는 그대로 `GameState`를 받는다):
```ts
import { BALANCE, BUILDING_KINDS } from "./data/balance";
import { compareText } from "./map";
import type { Board, GameState, NodeId, SeatId } from "./types";

export function ownedNodes(board: Pick<Board, "nodes">, seat: SeatId): NodeId[] {
  return Object.values(board.nodes)
    .filter((n) => n.owner === seat)
    .map((n) => n.id)
    .sort(compareText);
}

/** 아군 거점 수비대 + 활동 중인 영웅의 병력 */
export function totalTroops(board: Pick<Board, "nodes" | "heroes">, seat: SeatId): number {
  const garrison = Object.values(board.nodes)
    .filter((n) => n.owner === seat)
    .reduce((sum, n) => sum + n.garrison, 0);
  const heroes = board.heroes
    .filter((h) => h.seat === seat && h.status === "active")
    .reduce((sum, h) => sum + h.troops, 0);
  return garrison + heroes;
}
```

- [ ] **Step 5: 시야 데이터를 만든다**

`packages/core/src/view.ts` 전체:
```ts
import { BALANCE } from "./data/balance";
import { bfs, compareText } from "./map";
import { ownedNodes, scoreOf } from "./summary";
import type { Board, GameMap, GameState, Hero, NodeId, NodeState, Resources, SeatId, SeatSettings } from "./types";

/** 내 영웅. 숨은 성장 계수는 내 것도 숨긴다(아웃라이어는 겉으로 표시되지 않는다) */
export type MyHero = Omit<Hero, "growth">;
/** 남의 영웅. 특성·경험치·숨은 성장 계수·상시 명령을 숨긴다 */
export type ForeignHero = Omit<Hero, "growth" | "traits" | "exp" | "standing">;

/** 모든 자리에 공개되는 정보 */
export interface PublicSeat {
  id: SeatId;
  name: string;
  nodes: number;
  score: number;
  eliminated: boolean;
}

/** 참모가 받는 자리별 보고서 데이터. 지금 상태의 스냅숏이고, 지난 턴 사건은 1c에서 더한다 */
export interface SeatView {
  seat: SeatId;
  turn: number;
  maxTurns: number;
  /** 맵 구조(거점 id·종류·인접)는 모두 안다 */
  map: GameMap;
  /** 보이는 거점만 */
  nodes: Record<NodeId, NodeState>;
  /** 내 영웅 전부(부상·포로·out 포함) */
  myHeroes: MyHero[];
  /** 보이는 거점에 있는 남의 활동·부상 영웅과 내가 잡은 포로 */
  foreignHeroes: ForeignHero[];
  capital: NodeId | null;
  treasury: Resources;
  settings: SeatSettings;
  /** 지난 계획의 참모 메모 */
  memo: string;
  seats: PublicSeat[];
}

/**
 * 자리의 시야: 아군 거점에서 1 + 첩보망 레벨 칸, 활동 영웅이 서 있는 거점에서 1칸(기동 15 이상이면 2칸).
 * 참모를 부를 때의 상태로 계산한다.
 */
export function visibleNodes(state: GameState, seat: SeatId): Set<NodeId> {
  const seen = new Set<NodeId>();
  const within = (from: NodeId, radius: number): void => {
    for (const [node, dist] of Object.entries(bfs(state.map, from).dist)) if (dist <= radius) seen.add(node);
  };
  const v = BALANCE.view;
  for (const node of ownedNodes(state, seat)) {
    within(node, v.nodeRadius + state.nodes[node].buildings.intel * v.intelRadiusPerLevel);
  }
  for (const hero of state.heroes) {
    if (hero.seat !== seat || hero.status !== "active") continue;
    within(hero.location, hero.stats.mobility >= v.scoutMobility ? v.scoutRadius : v.heroRadius);
  }
  return seen;
}

/** 자리의 시야. 상태와 공유하지 않는 복사본이다. */
export function viewOf(state: GameState, seat: SeatId): SeatView {
  const seen = visibleNodes(state, seat);
  const nodes: Record<NodeId, NodeState> = {};
  for (const id of [...seen].sort(compareText)) nodes[id] = state.nodes[id];
  const myHeroes: MyHero[] = state.heroes.filter((h) => h.seat === seat).map(({ growth: _growth, ...hero }) => hero);
  const foreignHeroes: ForeignHero[] = state.heroes
    .filter((h) =>
      h.status === "active" || h.status === "injured"
        ? h.seat !== seat && seen.has(h.location)
        : h.status === "captured" && h.captor === seat,
    )
    .map(({ growth: _growth, traits: _traits, exp: _exp, standing: _standing, ...hero }) => hero);
  const me = state.seats[seat];
  const view: SeatView = {
    seat,
    turn: state.turn,
    maxTurns: state.maxTurns,
    map: state.map,
    nodes,
    myHeroes,
    foreignHeroes,
    capital: me.capital,
    treasury: me.treasury,
    settings: me.settings,
    memo: me.memo,
    seats: state.seats.map((s) => ({
      id: s.id,
      name: s.name,
      nodes: ownedNodes(state, s.id).length,
      score: scoreOf(state, s.id),
      eliminated: s.eliminatedAt !== null,
    })),
  };
  return JSON.parse(JSON.stringify(view));
}

/** 시야를 전투력·병력 계산용 판으로 */
export function boardOf(view: SeatView): Board<MyHero | ForeignHero> {
  return { map: view.map, nodes: view.nodes, heroes: [...view.myHeroes, ...view.foreignHeroes] };
}
```

- [ ] **Step 6: 메모를 검증에서 넘기고 처리에서 저장한다**

`packages/core/src/orders.ts`의 `validatePlan` 마지막 줄:
```ts
  return { plan: { missions, recruits, builds, memo: plan.memo }, issues };
```

`packages/core/src/rules/turn.ts`:
- `processTurn` 문서 주석의 순서 줄을 바꾼다:
```ts
 * 순서: 메모 저장 → 충성 판정 → 이동 → 전투 → 생산·건설·모집·유지비 → 레벨업 → 회복 → 탈락·종료
```
- 본문의 `const missions = collectMissions(state, orders);` 줄 바로 앞에 `saveMemos(state, orders);`를 넣는다.
- 파일 끝에 더한다:
```ts
/** 참모 메모: 이번 계획의 메모를 다음 시야로 넘긴다(메모가 없으면 비운다) */
function saveMemos(state: GameState, orders: Orders): void {
  for (const seat of state.seats) {
    if (seat.eliminatedAt === null) seat.memo = orders[seat.id]?.memo ?? "";
  }
}
```

`packages/core/src/index.ts`:
- balance 줄: `export { BALANCE, BUILDING_KINDS, buildCost, recruitCap, recruitCapAt, terrainOf } from "./data/balance";`
- view 줄: `export { boardOf, viewOf, visibleNodes, type ForeignHero, type MyHero, type PublicSeat, type SeatView } from "./view";`

- [ ] **Step 7: 통과를 확인한다**

Run: `npm test -- packages/core/test/view.test.ts packages/core/test/turn.test.ts packages/core/test/orders.test.ts`
Expected: 모두 통과.

Run: `npm test`
Expected: `Test Files  18 passed`, `Tests  178 passed`. 회귀 테스트 8개 통과.

Run: `npm run typecheck`
Expected: 오류 없음.

- [ ] **Step 8: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add packages/core
git -C D:/game/proxywar commit -m "feat(core): 자리별 시야 데이터, 판 일반화, 참모 메모 저장"
```

---

### Task 5: 조건부 명령 타입과 검증

**Files:**
- Modify: `packages/core/src/types.ts`, `packages/core/src/orders.ts`
- Test: `packages/core/test/orders.test.ts`

- [ ] **Step 1: 검증 테스트를 쓴다**

`packages/core/test/orders.test.ts`의 "아군 거점 공격을 뺀다" 테스트 바로 앞에 넣는다:
```ts
  it("조건부 명령은 위치(이동이면 도착 거점) 기준으로 맞으면 그대로 통과한다", () => {
    const state = makeState();
    state.nodes.f0.owner = 0;
    const plan = missionsOnly(
      {
        kind: "move",
        hero: "s0h0",
        to: "f0",
        when: { trigger: { kind: "enemyNear" }, react: { kind: "reinforce", node: "c0" } },
      },
      {
        kind: "defend",
        hero: "s0h1",
        when: { trigger: { kind: "allyAttacked", node: "c0" }, react: { kind: "retreat" } },
      },
      {
        kind: "attack",
        hero: "s0h2",
        target: "m0",
        when: { trigger: { kind: "ratioBelow", value: 3 }, react: { kind: "defend" } },
      },
      {
        kind: "attack",
        hero: "s0h3",
        target: "m0",
        when: { trigger: { kind: "targetEmpty" }, react: { kind: "advance", node: "f0" } },
      },
      {
        kind: "govern",
        hero: "s0h4",
        when: { trigger: { kind: "allyAttacked", node: "f0" }, react: { kind: "reinforce", node: "f0" } },
      },
    );
    const checked = validatePlan(state, 0, plan);
    expect(checked.issues).toEqual([]);
    expect(checked.plan).toEqual(plan);
  });

  it.each<[string, Mission]>([
    [
      "방어에 병력 비율",
      { kind: "defend", hero: "s0h0", when: { trigger: { kind: "ratioBelow", value: 3 }, react: { kind: "defend" } } },
    ],
    [
      "병력 비율 값 0",
      {
        kind: "attack",
        hero: "s0h0",
        target: "m0",
        when: { trigger: { kind: "ratioBelow", value: 0 }, react: { kind: "defend" } },
      },
    ],
    [
      "공격이 아닌데 대상 없는 빔",
      { kind: "defend", hero: "s0h0", when: { trigger: { kind: "targetEmpty" }, react: { kind: "defend" } } },
    ],
    [
      "이웃이 아닌 대상 빔",
      {
        kind: "defend",
        hero: "s0h0",
        when: { trigger: { kind: "targetEmpty", node: "x0" }, react: { kind: "defend" } },
      },
    ],
    [
      "이웃이 아닌 진격",
      { kind: "defend", hero: "s0h0", when: { trigger: { kind: "enemyNear" }, react: { kind: "advance", node: "x0" } } },
    ],
    [
      "없는 거점 증원",
      {
        kind: "defend",
        hero: "s0h0",
        when: { trigger: { kind: "enemyNear" }, react: { kind: "reinforce", node: "zz" } },
      },
    ],
    [
      "먼 아군 거점 피습",
      {
        kind: "defend",
        hero: "s0h0",
        when: { trigger: { kind: "allyAttacked", node: "x0" }, react: { kind: "defend" } },
      },
    ],
    [
      "이동 뒤 기준으로 이웃이 아닌 증원",
      {
        kind: "move",
        hero: "s0h0",
        to: "f0",
        when: { trigger: { kind: "enemyNear" }, react: { kind: "reinforce", node: "m0" } },
      },
    ],
    [
      "모르는 조건",
      {
        kind: "defend",
        hero: "s0h0",
        when: { trigger: { kind: "panic" }, react: { kind: "defend" } },
      } as unknown as Mission,
    ],
  ])("잘못된 조건이 붙은 임무를 뺀다: %s", (_, mission) => {
    const state = makeState();
    state.nodes.f0.owner = 0;
    expect(reasons(state, missionsOnly(mission))).toEqual(["bad condition"]);
  });
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm test -- packages/core/test/orders.test.ts`
Expected: FAIL. 타입 검사 전이라 테스트는 돌고, 잘못된 조건 9개가 issues 없이 통과해 `["bad condition"]`과 다르다.

- [ ] **Step 3: 조건 타입을 더한다**

`packages/core/src/types.ts`의 `Mission`을 다음으로 바꾸고, 그 바로 앞에 조건 타입을 넣는다:
```ts
/** 조건부 명령의 조건. 판정은 이동 뒤·전투 앞 한 스냅숏에서 한다 */
export type Trigger =
  | { kind: "enemyNear" }
  | { kind: "targetEmpty"; node?: NodeId }
  | { kind: "ratioBelow"; value: number }
  | { kind: "allyAttacked"; node: NodeId };

/** 조건이 참일 때 임무 대신 하는 반응 */
export type Reaction =
  | { kind: "retreat" }
  | { kind: "advance"; node: NodeId }
  | { kind: "reinforce"; node: NodeId }
  | { kind: "defend" };

export interface Condition {
  trigger: Trigger;
  react: Reaction;
}

export type Mission = (
  | { kind: "move"; hero: string; to: NodeId; draw?: number }
  | { kind: "attack"; hero: string; target: NodeId; draw?: number }
  | { kind: "defend"; hero: string }
  | { kind: "govern"; hero: string }
) & { when?: Condition };
```

- [ ] **Step 4: 검증을 더한다**

`packages/core/src/orders.ts`의 `missionIssue`를 다음 세 함수로 바꾼다:
```ts
function missionIssue(state: GameState, seat: SeatId, mission: Mission, used: ReadonlySet<string>): string | null {
  const hero = state.heroes.find((h) => h.id === mission.hero);
  if (!hero) return "unknown hero";
  if (hero.seat !== seat) return "not your hero";
  if (hero.status !== "active") return "hero not active";
  if (used.has(hero.id)) return "duplicate hero";
  const reason = targetIssue(state, seat, hero.location, mission);
  if (reason !== null || mission.when === undefined) return reason;
  return conditionIssue(state, mission, mission.kind === "move" ? mission.to : hero.location);
}

function targetIssue(state: GameState, seat: SeatId, location: NodeId, mission: Mission): string | null {
  // 활동 중인 영웅은 늘 아군 거점에 서 있으므로 방어·운영에는 더 볼 것이 없다
  if (mission.kind === "defend" || mission.kind === "govern") return null;
  if (mission.draw !== undefined && (!Number.isInteger(mission.draw) || mission.draw < 0)) return "bad draw";
  const dest = mission.kind === "move" ? mission.to : mission.target;
  if (!Object.hasOwn(state.nodes, dest)) return "unknown node";
  if (!neighbors(state.map, location).includes(dest)) return "not adjacent";
  const owner = state.nodes[dest].owner;
  if (mission.kind === "move" && owner !== seat) return "move target not own";
  if (mission.kind === "attack" && owner === seat) return "attack target is own";
  return null;
}

/**
 * 조건의 거점은 영웅이 조건을 판정받는 자리(at: 이동이면 도착 거점, 아니면 지금 위치)의 이웃이어야 한다.
 * 아군 거점 피습은 at 자신도 된다. 병력 비율은 공격 임무에만 붙는다.
 */
function conditionIssue(state: GameState, mission: Mission, at: NodeId): string | null {
  const { trigger, react } = mission.when!;
  const near = (node: NodeId): boolean => Object.hasOwn(state.nodes, node) && neighbors(state.map, at).includes(node);
  const bad = "bad condition";
  switch (trigger.kind) {
    case "enemyNear":
      break;
    case "targetEmpty":
      if (trigger.node === undefined ? mission.kind !== "attack" : !near(trigger.node)) return bad;
      break;
    case "ratioBelow":
      if (mission.kind !== "attack" || !Number.isInteger(trigger.value) || trigger.value < 1 || trigger.value > 5) {
        return bad;
      }
      break;
    case "allyAttacked":
      if (trigger.node !== at && !near(trigger.node)) return bad;
      break;
    default:
      return bad;
  }
  switch (react.kind) {
    case "retreat":
    case "defend":
      return null;
    case "advance":
    case "reinforce":
      return near(react.node) ? null : bad;
    default:
      return bad;
  }
}
```

- [ ] **Step 5: 통과를 확인한다**

Run: `npm test -- packages/core/test/orders.test.ts`
Expected: 모두 통과.

Run: `npm test`
Expected: `Test Files  18 passed`, `Tests  188 passed`.

Run: `npm run typecheck`
Expected: 오류 없음.

- [ ] **Step 6: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add packages/core
git -C D:/game/proxywar commit -m "feat(core): 조건부 명령 타입과 검증"
```

---

### Task 6: 조건 판정·반응 단계

**Files:**
- Create: `packages/core/src/rules/conditions.ts`
- Modify: `packages/core/src/types.ts`, `packages/core/src/data/balance.json`, `packages/core/src/rules/turn.ts`
- Test: `packages/core/test/conditions.test.ts`(새 파일)

- [ ] **Step 1: 조건 테스트를 쓴다**

`packages/core/test/conditions.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { resolveConditions } from "../src/rules/conditions";
import { processTurn } from "../src/rules/turn";
import type { Condition, GameEvent, Mission } from "../src/types";
import { heroOf, makeState, noOrders } from "./helpers";

function defendWhen(hero: string, when: Condition): [string, Mission] {
  return [hero, { kind: "defend", hero, when }];
}

describe("resolveConditions", () => {
  it("적 접근 → 후퇴: 이웃 아군 거점 중 수도에 가장 가까운 곳으로 병력과 함께 옮겨 지킨다", () => {
    const state = makeState();
    state.nodes.f0.owner = 0;
    state.nodes.x5.owner = 5;
    Object.assign(heroOf(state, "s0h0"), { location: "f0", troops: 50 });
    Object.assign(heroOf(state, "s5h0"), { location: "x5", troops: 30 });
    const missions = new Map([defendWhen("s0h0", { trigger: { kind: "enemyNear" }, react: { kind: "retreat" } })]);
    const events: GameEvent[] = [];
    resolveConditions(state, missions, events);
    expect(heroOf(state, "s0h0")).toMatchObject({ location: "c0", troops: 50 });
    expect(missions.get("s0h0")).toEqual({ kind: "defend", hero: "s0h0" });
    expect(events).toEqual([
      { kind: "conditionMet", seat: 0, hero: "s0h0", trigger: "enemyNear", react: "retreat" },
      { kind: "moved", seat: 0, hero: "s0h0", from: "f0", to: "c0" },
    ]);
  });

  it("병력이 없는 적 영웅은 접근으로 보지 않는다", () => {
    const state = makeState();
    state.nodes.f0.owner = 0;
    state.nodes.x5.owner = 5;
    Object.assign(heroOf(state, "s0h0"), { location: "f0", troops: 50 });
    Object.assign(heroOf(state, "s5h0"), { location: "x5", troops: 0 });
    const entry = defendWhen("s0h0", { trigger: { kind: "enemyNear" }, react: { kind: "retreat" } });
    const missions = new Map([entry]);
    const events: GameEvent[] = [];
    resolveConditions(state, missions, events);
    expect(events).toEqual([]);
    expect(missions.get("s0h0")).toEqual(entry[1]);
    expect(heroOf(state, "s0h0").location).toBe("f0");
  });

  it("대상 거점이 빔 → 진격: 수비대도 지키는 영웅도 없으면 지금 병력으로 공격한다", () => {
    for (const [garrison, advances] of [
      [0, true],
      [20, false],
    ] as const) {
      const state = makeState();
      state.nodes.f0.garrison = garrison;
      heroOf(state, "s0h0").troops = 30;
      const missions = new Map([
        defendWhen("s0h0", { trigger: { kind: "targetEmpty", node: "f0" }, react: { kind: "advance", node: "f0" } }),
      ]);
      resolveConditions(state, missions, []);
      if (advances) expect(missions.get("s0h0")).toEqual({ kind: "attack", hero: "s0h0", target: "f0", draw: 0 });
      else expect(missions.get("s0h0")?.kind).toBe("defend");
    }
  });

  it("병력 비율은 같은 자리·같은 목표 부대 전체로 판정한다", () => {
    const ratioBelow = (value: number): Mission => ({
      kind: "attack",
      hero: "s0h0",
      target: "f0",
      when: { trigger: { kind: "ratioBelow", value }, react: { kind: "defend" } },
    });
    const setUp = () => {
      const state = makeState();
      state.nodes.f0.garrison = 50;
      heroOf(state, "s0h0").troops = 50;
      heroOf(state, "s0h1").troops = 20;
      return state;
    };
    // 혼자면 공격력 50 × 1.12 = 56 < 방어력 50 × 1.2 = 60 → 방어
    let state = setUp();
    let missions = new Map<string, Mission>([["s0h0", ratioBelow(3)]]);
    resolveConditions(state, missions, []);
    expect(missions.get("s0h0")).toEqual({ kind: "defend", hero: "s0h0" });
    // s0h1이 함께 치면 70 × 1.12 = 78.4 ≥ 60 → 그대로
    state = setUp();
    missions = new Map<string, Mission>([
      ["s0h0", ratioBelow(3)],
      ["s0h1", { kind: "attack", hero: "s0h1", target: "f0" }],
    ]);
    resolveConditions(state, missions, []);
    expect(missions.get("s0h0")).toEqual(ratioBelow(3));
    // 기준 1(0.8)이면 혼자서도 56 ≥ 40 → 그대로
    state = setUp();
    missions = new Map<string, Mission>([["s0h0", ratioBelow(1)]]);
    resolveConditions(state, missions, []);
    expect(missions.get("s0h0")).toEqual(ratioBelow(1));
  });

  it("아군 거점 피습 → 증원: 그 거점을 치는 다른 자리 임무가 있으면 옮겨 지킨다", () => {
    for (const [enemy, reinforces] of [
      [{ kind: "attack", hero: "s5h0", target: "f0" }, true],
      [{ kind: "defend", hero: "s5h0" }, false],
    ] as const) {
      const state = makeState();
      state.nodes.f0.owner = 0;
      state.nodes.x5.owner = 5;
      Object.assign(heroOf(state, "s5h0"), { location: "x5", troops: 30 });
      const missions = new Map<string, Mission>([
        [
          "s0h0",
          {
            kind: "govern",
            hero: "s0h0",
            when: { trigger: { kind: "allyAttacked", node: "f0" }, react: { kind: "reinforce", node: "f0" } },
          },
        ],
        ["s5h0", enemy],
      ]);
      resolveConditions(state, missions, []);
      expect(heroOf(state, "s0h0").location).toBe(reinforces ? "f0" : "c0");
      expect(missions.get("s0h0")?.kind).toBe(reinforces ? "defend" : "govern");
    }
  });

  it("조건은 한 스냅숏에서 모두 판정하고 반응을 한꺼번에 적용해, 영웅 처리 순서와 결과가 무관하다", () => {
    for (const reversed of [false, true]) {
      const state = makeState();
      Object.assign(state.nodes.f0, { owner: 5, garrison: 0 });
      state.nodes.x5.owner = 5;
      Object.assign(heroOf(state, "s5h0"), { location: "x5", troops: 30 });
      heroOf(state, "s0h0").troops = 30;
      heroOf(state, "s0h1").troops = 30;
      if (reversed) state.heroes.reverse();
      const missions = new Map<string, Mission>([
        defendWhen("s0h0", { trigger: { kind: "targetEmpty", node: "f0" }, react: { kind: "advance", node: "f0" } }),
        ["s0h1", { kind: "attack", hero: "s0h1", target: "f0" }],
        defendWhen("s5h0", { trigger: { kind: "allyAttacked", node: "f0" }, react: { kind: "reinforce", node: "f0" } }),
      ]);
      resolveConditions(state, missions, []);
      // s5h0이 f0에 들어가도, s0h0의 "빔"은 반응 전 스냅숏으로 판정한다
      expect(missions.get("s0h0")).toEqual({ kind: "attack", hero: "s0h0", target: "f0", draw: 0 });
      expect(heroOf(state, "s5h0").location).toBe("f0");
      expect(missions.get("s5h0")).toEqual({ kind: "defend", hero: "s5h0" });
    }
  });
});

describe("processTurn의 조건 판정·반응 단계", () => {
  it("이동 뒤·전투 앞에 판정한다(이동해 온 거점에서 적 접근을 보고 후퇴)", () => {
    const state = makeState();
    state.nodes.f0.owner = 0;
    state.nodes.f0.garrison = 0;
    state.nodes.x5.owner = 5;
    Object.assign(heroOf(state, "s5h0"), { location: "x5", troops: 30 });
    const orders = noOrders();
    orders[0].missions.push({
      kind: "move",
      hero: "s0h0",
      to: "f0",
      when: { trigger: { kind: "enemyNear" }, react: { kind: "retreat" } },
    });
    const { state: next, events } = processTurn(state, orders);
    expect(events.filter((e) => e.kind === "moved" || e.kind === "conditionMet")).toEqual([
      { kind: "moved", seat: 0, hero: "s0h0", from: "c0", to: "f0" },
      { kind: "conditionMet", seat: 0, hero: "s0h0", trigger: "enemyNear", react: "retreat" },
      { kind: "moved", seat: 0, hero: "s0h0", from: "f0", to: "c0" },
    ]);
    expect(heroOf(next, "s0h0").location).toBe("c0");
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm test -- packages/core/test/conditions.test.ts`
Expected: FAIL, `Cannot find module '../src/rules/conditions'`.

- [ ] **Step 3: 수치와 사건 타입을 더한다**

`packages/core/src/data/balance.json`의 `  "combat": {` 줄 바로 앞에 넣는다:
```json
  "conditions": { "ratioByValue": [0.8, 1.0, 1.2, 1.4, 1.6] },
```

`packages/core/src/types.ts`의 `GameEvent` 끝(`buildSkipped` 줄 뒤, 세미콜론 앞)에 더한다:
```ts
  | { kind: "conditionMet"; seat: SeatId; hero: string; trigger: Trigger["kind"]; react: Reaction["kind"] }
```
(앞 줄 끝의 `;`를 이 줄 끝으로 옮긴다.)

- [ ] **Step 4: 조건 판정·반응을 만든다**

`packages/core/src/rules/conditions.ts`:
```ts
import { BALANCE } from "../data/balance";
import { bfs, compareText, neighbors } from "../map";
import type { Condition, GameEvent, GameState, Hero, Mission, NodeId } from "../types";
import { attackPower, defenders, defensePower } from "./power";

/**
 * 조건 판정·반응 단계(충성 판정과 이동 뒤, 전투 앞).
 * 조건은 모두 같은 스냅숏(이동 뒤 상태, 충성 판정 뒤 임무)에서 판정하고, 그다음 반응을 한꺼번에 적용한다.
 * 반응이 다른 조건을 다시 부르지 않는다. 그래서 영웅 처리 순서와 결과가 무관하다.
 */
export function resolveConditions(state: GameState, missions: Map<string, Mission>, events: GameEvent[]): void {
  const committed = committedOf(state, missions);
  const fired: { hero: Hero; when: Condition }[] = [];
  for (const hero of state.heroes) {
    const mission = missions.get(hero.id);
    if (hero.status !== "active" || mission?.when === undefined) continue;
    if (triggered(state, missions, committed, hero, mission, mission.when)) fired.push({ hero, when: mission.when });
  }
  for (const { hero, when } of fired) {
    events.push({ kind: "conditionMet", seat: hero.seat, hero: hero.id, trigger: when.trigger.kind, react: when.react.kind });
    missions.set(hero.id, react(state, hero, when, events));
  }
}

/** 공격·운영 임무를 받아 서 있는 거점 방어에 끼지 않는 활동 영웅(전투 단계와 같은 기준) */
function committedOf(state: GameState, missions: ReadonlyMap<string, Mission>): Set<string> {
  const out = new Set<string>();
  for (const hero of state.heroes) {
    const kind = missions.get(hero.id)?.kind;
    if (hero.status === "active" && (kind === "attack" || kind === "govern")) out.add(hero.id);
  }
  return out;
}

function triggered(
  state: GameState,
  missions: ReadonlyMap<string, Mission>,
  committed: ReadonlySet<string>,
  hero: Hero,
  mission: Mission,
  when: Condition,
): boolean {
  const trigger = when.trigger;
  switch (trigger.kind) {
    case "enemyNear":
      return neighbors(state.map, hero.location).some((n) =>
        state.heroes.some((h) => h.seat !== hero.seat && h.status === "active" && h.troops > 0 && h.location === n),
      );
    case "targetEmpty": {
      const node = trigger.node ?? (mission.kind === "attack" ? mission.target : null);
      if (node === null) return false;
      return state.nodes[node].garrison === 0 && defenders(state, node, committed).length === 0;
    }
    case "ratioBelow": {
      if (mission.kind !== "attack") return false;
      const target = mission.target;
      const group = state.heroes.filter((h) => {
        const m = missions.get(h.id);
        return (
          h.seat === hero.seat &&
          h.status === "active" &&
          h.troops > 0 &&
          m?.kind === "attack" &&
          m.target === target &&
          neighbors(state.map, h.location).includes(target)
        );
      });
      const ratio = BALANCE.conditions.ratioByValue[trigger.value - 1];
      return attackPower(group) < defensePower(state, target, committed) * ratio;
    }
    case "allyAttacked":
      return (
        state.nodes[trigger.node].owner === hero.seat &&
        state.heroes.some((h) => {
          const m = missions.get(h.id);
          return h.seat !== hero.seat && h.status === "active" && m?.kind === "attack" && m.target === trigger.node;
        })
      );
  }
}

function react(state: GameState, hero: Hero, when: Condition, events: GameEvent[]): Mission {
  const stay: Mission = { kind: "defend", hero: hero.id };
  const r = when.react;
  switch (r.kind) {
    case "defend":
      return stay;
    case "advance":
      return state.nodes[r.node].owner === hero.seat ? stay : { kind: "attack", hero: hero.id, target: r.node, draw: 0 };
    case "reinforce":
      if (state.nodes[r.node].owner === hero.seat) relocate(hero, r.node, events);
      return stay;
    case "retreat": {
      const to = retreatTo(state, hero);
      if (to !== null) relocate(hero, to, events);
      return stay;
    }
  }
}

function relocate(hero: Hero, to: NodeId, events: GameEvent[]): void {
  const from = hero.location;
  hero.location = to;
  events.push({ kind: "moved", seat: hero.seat, hero: hero.id, from, to });
}

/** 이웃 아군 거점 중 현재 수도에 가장 가까운 곳(아군 거점만 지난 거리, 닿지 않으면 가장 멂, 동률은 id). 없으면 null */
function retreatTo(state: GameState, hero: Hero): NodeId | null {
  const capital = state.seats[hero.seat].capital;
  const dist = capital === null ? {} : bfs(state.map, capital, (n) => state.nodes[n].owner === hero.seat).dist;
  const far = (n: NodeId): number => dist[n] ?? Infinity;
  const refuge = neighbors(state.map, hero.location)
    .filter((n) => state.nodes[n].owner === hero.seat)
    .sort((a, b) => far(a) - far(b) || compareText(a, b))[0];
  return refuge ?? null;
}
```

- [ ] **Step 5: 턴 처리에 연결한다**

`packages/core/src/rules/turn.ts`:
- import에 `import { resolveConditions } from "./conditions";`를 더한다.
- 문서 주석의 순서 줄:
```ts
 * 순서: 메모 저장 → 충성 판정 → 이동 → 조건 판정·반응 → 전투 → 생산·건설·모집·유지비 → 레벨업 → 회복 → 탈락·종료
```
- `resolveMovement(state, missions, events);` 줄 바로 뒤에 넣는다:
```ts
  resolveConditions(state, missions, events);
```

- [ ] **Step 6: 통과를 확인한다**

Run: `npm test -- packages/core/test/conditions.test.ts`
Expected: `Tests  7 passed`.

Run: `npm test`
Expected: `Test Files  19 passed`, `Tests  195 passed`. 회귀 테스트 8개 통과(규칙 참모는 아직 조건을 붙이지 않는다).

Run: `npm run typecheck`
Expected: 오류 없음.

- [ ] **Step 7: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add packages/core
git -C D:/game/proxywar commit -m "feat(core): 조건 판정·반응 단계(한 스냅숏 동시 판정)"
```

---

### Task 7: 후퇴 기준(전투의 물러남 판정)

**Files:**
- Modify: `packages/core/src/types.ts`, `packages/core/src/data/balance.json`, `packages/core/src/rules/traits.ts`, `packages/core/src/rules/combat.ts`
- Test: `packages/core/test/traits.test.ts`, `packages/core/test/combat.test.ts`

- [ ] **Step 1: 테스트를 쓰고 기존 기대값에 이유를 더한다**

`packages/core/test/traits.test.ts`의 import를 `import { applyLoyalty, cautionRatio, hesitationOf } from "../src/rules/traits";`로 바꾸고 파일 끝에 더한다:
```ts
describe("hesitationOf", () => {
  it("신중 기준과 후퇴 기준 중 큰 값을 쓰고, 후퇴 기준이 더 크면 이유는 standing이다", () => {
    const hero = heroOf(makeState(), "s0h0");
    expect(hesitationOf(hero)).toEqual({ ratio: 0, reason: "caution" });
    hero.standing.retreatAt = 4;
    expect(hesitationOf(hero)).toEqual({ ratio: 1.2, reason: "standing" });
    hero.traits.caution = 5;
    expect(hesitationOf(hero)).toEqual({ ratio: 1.2, reason: "caution" });
    hero.standing.retreatAt = 5;
    expect(hesitationOf(hero)).toEqual({ ratio: 1.4, reason: "standing" });
  });
});
```

`packages/core/test/combat.test.ts`:
- "신중 5 영웅은…" 테스트의 기대 사건을 `[{ kind: "hesitated", seat: 0, hero: "s0h0", node: "f0", reason: "caution" }]`로 바꾼다.
- 그 테스트 바로 뒤에 더한다:
```ts
  it("후퇴 기준(상시 명령)은 신중과 같은 판정으로 물러나게 하고 이유를 standing으로 남긴다", () => {
    for (const [retreatAt, hesitates] of [
      [4, true],
      [1, false],
    ] as const) {
      const state = makeState();
      const hero = heroOf(state, "s0h0");
      hero.troops = 50;
      hero.standing.retreatAt = retreatAt;
      state.nodes.f0.garrison = 50;
      // 공격력 56, 방어력 50: 기준 1.2(4)면 60에 못 미쳐 물러나고, 0.6(1)이면 싸운다
      const events = run(state, attack("s0h0", "f0"));
      if (hesitates) {
        expect(events).toEqual([{ kind: "hesitated", seat: 0, hero: "s0h0", node: "f0", reason: "standing" }]);
      } else {
        expect(events[0]?.kind).toBe("battle");
      }
    }
  });
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm test -- packages/core/test/traits.test.ts packages/core/test/combat.test.ts`
Expected: FAIL. `hesitationOf`가 없고, 사건에 `reason`이 없으며, 후퇴 기준 4 영웅이 싸운다.

- [ ] **Step 3: 수치·사건 타입·판정을 바꾼다**

`packages/core/src/data/balance.json`의 `  "combat": {` 줄 바로 앞에 넣는다:
```json
  "constraints": { "capitalMinPerLevel": 10, "expeditionRange": 2, "retreatRatioByLevel": [0.6, 0.8, 1.0, 1.2, 1.4] },
```

`packages/core/src/types.ts`의 `hesitated` 사건:
```ts
  | { kind: "hesitated"; seat: SeatId; hero: string; node: NodeId; reason: "caution" | "standing" }
```

`packages/core/src/rules/traits.ts` 끝에 더한다:
```ts
/**
 * 물러남 기준: 신중 기준과 후퇴 기준(상시 명령) 중 큰 값. 0이면 물러나지 않는다.
 * 후퇴 기준이 더 크면 이유는 standing이다.
 */
export function hesitationOf(hero: Hero): { ratio: number; reason: "caution" | "standing" } {
  const caution = cautionRatio(hero);
  const level = hero.standing.retreatAt;
  const standing = level === null ? 0 : BALANCE.constraints.retreatRatioByLevel[level - 1];
  return standing > caution ? { ratio: standing, reason: "standing" } : { ratio: caution, reason: "caution" };
}
```

`packages/core/src/rules/combat.ts`:
- import의 `import { cautionRatio } from "./traits";`를 `import { hesitationOf } from "./traits";`로 바꾼다.
- `withoutHesitant`를 다음으로 바꾼다:
```ts
/** 신중·후퇴 기준 판정: 무작위 폭을 뺀 부대 공격력이 방어력 × 기준보다 낮으면 그 영웅은 물러나 제자리를 지킨다. */
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
    const { ratio, reason } = hesitationOf(hero);
    if (ratio === 0 || power >= def * ratio) return true;
    committed.delete(hero.id);
    events.push({ kind: "hesitated", seat, hero: hero.id, node: target, reason });
    return false;
  });
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npm test -- packages/core/test/traits.test.ts packages/core/test/combat.test.ts`
Expected: 모두 통과.

Run: `npm test`
Expected: `Test Files  19 passed`, `Tests  197 passed`. 회귀 테스트 8개 통과(rule6에는 신중 4·5 영웅과 후퇴 기준이 없어 `hesitated`가 나오지 않는다).

Run: `npm run typecheck`
Expected: 오류 없음. `packages/sim/src/report.ts`는 `hesitated`의 `reason`을 아직 쓰지 않으므로 타입 오류가 없다.

- [ ] **Step 5: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add packages/core
git -C D:/game/proxywar commit -m "feat(core): 후퇴 기준 상시 명령을 전투 물러남 판정으로 강제"
```

---

### Task 8: 제약과 확정(`confirmPlan`)

**Files:**
- Create: `packages/core/src/confirm.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/confirm.test.ts`(새 파일)

- [ ] **Step 1: 확정 테스트를 쓴다**

`packages/core/test/confirm.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { confirmPlan } from "../src/confirm";
import type { GameState, Mission, Plan } from "../src/types";
import { heroOf, makeState } from "./helpers";

function confirm(state: GameState, ...missions: Mission[]) {
  return confirmPlan(state, 0, { missions, recruits: [], builds: [] });
}

const defend = (hero: string): Mission => ({ kind: "defend", hero });

describe("confirmPlan", () => {
  it("상시 명령이 없고 수도에서 최소 수비를 넘겨 꺼내지 않으면 계획(메모 포함)을 그대로 둔다", () => {
    const plan: Plan = {
      missions: [{ kind: "attack", hero: "s0h0", target: "f0", draw: 30 }, { kind: "govern", hero: "s0h1" }],
      recruits: [{ node: "c0", amount: 30 }],
      builds: [],
      memo: "m",
    };
    expect(confirmPlan(makeState(), 0, plan)).toEqual({ plan, corrections: [] });
  });

  it("수도 방어 전담: 공격·운영은 방어로, 수도 쪽 이동은 두고 다른 이동은 방어로 바꾼다", () => {
    const state = makeState();
    for (const n of ["f0", "x5"]) state.nodes[n].owner = 0;
    for (let j = 0; j < 4; j++) heroOf(state, `s0h${j}`).standing.guardCapital = true;
    for (const id of ["s0h2", "s0h3"]) heroOf(state, id).location = "f0";
    const attack: Mission = { kind: "attack", hero: "s0h0", target: "m0", draw: 0 };
    const govern: Mission = { kind: "govern", hero: "s0h1" };
    const home: Mission = { kind: "move", hero: "s0h2", to: "c0" };
    const away: Mission = { kind: "move", hero: "s0h3", to: "x5" };
    const { plan, corrections } = confirm(state, attack, govern, home, away);
    expect(plan.missions).toEqual([defend("s0h0"), defend("s0h1"), home, defend("s0h3")]);
    expect(corrections).toEqual([
      { hero: "s0h0", rule: "guardCapital", before: attack, after: defend("s0h0") },
      { hero: "s0h1", rule: "guardCapital", before: govern, after: defend("s0h1") },
      { hero: "s0h3", rule: "guardCapital", before: away, after: defend("s0h3") },
    ]);
  });

  it("수도 방어 전담: 반응이 방어가 아닌 조건은 조건만 뺀다", () => {
    const state = makeState();
    for (const id of ["s0h0", "s0h1"]) heroOf(state, id).standing.guardCapital = true;
    const flee: Mission = { kind: "defend", hero: "s0h0", when: { trigger: { kind: "enemyNear" }, react: { kind: "retreat" } } };
    const hold: Mission = { kind: "defend", hero: "s0h1", when: { trigger: { kind: "enemyNear" }, react: { kind: "defend" } } };
    const { plan, corrections } = confirm(state, flee, hold);
    expect(plan.missions).toEqual([defend("s0h0"), hold]);
    expect(corrections).toEqual([{ hero: "s0h0", rule: "guardCapital", before: flee, after: defend("s0h0") }]);
  });

  it("원정 불허: 현재 수도에서 2칸 넘는 공격·이동은 방어로, 먼 진격 조건은 조건만 뺀다", () => {
    const state = makeState();
    for (const n of ["f0", "x5", "i5"]) state.nodes[n].owner = 0;
    for (let j = 0; j < 5; j++) heroOf(state, `s0h${j}`).location = "x5";
    for (let j = 0; j < 4; j++) heroOf(state, `s0h${j}`).standing.expedition = false;
    // 수도 c0에서 f0 1칸, x5 2칸, m5·i5 3칸
    const farAttack: Mission = { kind: "attack", hero: "s0h0", target: "m5", draw: 0 };
    const nearMove: Mission = { kind: "move", hero: "s0h1", to: "f0" };
    const farMove: Mission = { kind: "move", hero: "s0h2", to: "i5" };
    const farAdvance: Mission = {
      kind: "defend",
      hero: "s0h3",
      when: { trigger: { kind: "enemyNear" }, react: { kind: "advance", node: "m5" } },
    };
    const allowed: Mission = { kind: "attack", hero: "s0h4", target: "m5", draw: 0 };
    const { plan, corrections } = confirm(state, farAttack, nearMove, farMove, farAdvance, allowed);
    expect(plan.missions).toEqual([defend("s0h0"), nearMove, defend("s0h2"), defend("s0h3"), allowed]);
    expect(corrections.map((c) => [c.hero, c.rule])).toEqual([
      ["s0h0", "expedition"],
      ["s0h2", "expedition"],
      ["s0h3", "expedition"],
    ]);
  });

  it("수도 최소 수비: 수도에서 꺼내는 병력을 영웅 id 순으로 수비대 − L × 10까지 채우고 넘는 만큼 줄인다", () => {
    const cases: [number | null, number, number, string[]][] = [
      [3, 20, 10, ["s0h1"]],
      [5, 10, 0, ["s0h0", "s0h1"]],
      [null, 20, 20, []],
    ];
    for (const [capitalMin, draw0, draw1, corrected] of cases) {
      const state = makeState();
      state.seats[0].settings.safeguards.capitalMin = capitalMin;
      const { plan, corrections } = confirm(
        state,
        { kind: "attack", hero: "s0h1", target: "f0", draw: 20 },
        { kind: "attack", hero: "s0h0", target: "m0", draw: 20 },
      );
      expect(plan.missions).toEqual([
        { kind: "attack", hero: "s0h1", target: "f0", draw: draw1 },
        { kind: "attack", hero: "s0h0", target: "m0", draw: draw0 },
      ]);
      expect(corrections.map((c) => c.hero)).toEqual(corrected);
      expect(corrections.every((c) => c.rule === "capitalMin")).toBe(true);
    }
  });

  it("수도 최소 수비: 통솔 상한 때문에 어차피 못 꺼내는 몫은 세지 않는다", () => {
    const state = makeState();
    heroOf(state, "s0h0").troops = 130; // 상한 140이라 10만 더 꺼낸다
    const big: Mission = { kind: "attack", hero: "s0h0", target: "f0", draw: 50 };
    const small: Mission = { kind: "attack", hero: "s0h1", target: "m0", draw: 20 };
    expect(confirm(state, big, small)).toEqual({
      plan: { missions: [big, small], recruits: [], builds: [] },
      corrections: [],
    });
  });

  it("방어로 바뀐 영웅의 꺼내기는 수도 몫에서 빠진다(상시 명령 다음에 안전장치)", () => {
    const state = makeState();
    heroOf(state, "s0h0").standing.guardCapital = true;
    const guarded: Mission = { kind: "attack", hero: "s0h0", target: "f0", draw: 30 };
    const other: Mission = { kind: "attack", hero: "s0h1", target: "m0", draw: 30 };
    const { plan, corrections } = confirm(state, guarded, other);
    expect(plan.missions).toEqual([defend("s0h0"), other]);
    expect(corrections.map((c) => c.rule)).toEqual(["guardCapital"]);
  });

  it("수도가 없으면 제약을 적용하지 않는다", () => {
    const state = makeState();
    state.seats[0].capital = null;
    heroOf(state, "s0h0").standing.guardCapital = true;
    const attack: Mission = { kind: "attack", hero: "s0h0", target: "f0", draw: 60 };
    expect(confirm(state, attack).corrections).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm test -- packages/core/test/confirm.test.ts`
Expected: FAIL, `Cannot find module '../src/confirm'`.

- [ ] **Step 3: 확정을 만든다**

`packages/core/src/confirm.ts`:
```ts
import { BALANCE } from "./data/balance";
import { bfs, compareText } from "./map";
import { troopCap } from "./rules/power";
import type { GameState, Hero, Mission, NodeId, Plan, SeatId } from "./types";

export type ConstraintRule = "guardCapital" | "expedition" | "capitalMin";

/** 제약이 고친 임무 하나 */
export interface Correction {
  hero: string;
  rule: ConstraintRule;
  before: Mission;
  after: Mission;
}

export interface ConfirmedPlan {
  plan: Plan;
  corrections: Correction[];
}

type Fix = (before: Mission, rule: ConstraintRule, after: Mission) => Mission;

/**
 * 확정: 검증을 통과한 계획에 제약(상시 명령 + 안전장치)을 적용한다. 직접 수정(사람 조작)은 1b에서 비어 있다.
 * 수도 방어 전담 → 원정 불허가 임무 종류를, 그 뒤 수도 최소 수비가 수도에서 꺼내는 병력을 고친다.
 * "현재 수도"는 확정 시점의 수도다. 꺼내기는 전투 앞 이동 단계에서 일어나 그 사이에 수도가 바뀌지 않는다.
 * 후퇴 기준은 여기서 고치지 않고 전투의 물러남 판정에서 강제한다.
 */
export function confirmPlan(state: GameState, seat: SeatId, plan: Plan): ConfirmedPlan {
  const capital = state.seats[seat].capital;
  if (capital === null) return { plan, corrections: [] };
  const corrections: Correction[] = [];
  const fix: Fix = (before, rule, after) => {
    corrections.push({ hero: before.hero, rule, before, after });
    return after;
  };
  const ownDist = bfs(state.map, capital, (n) => state.nodes[n].owner === seat).dist;
  const mapDist = bfs(state.map, capital).dist;
  const far = (node: NodeId): boolean => (mapDist[node] ?? Infinity) > BALANCE.constraints.expeditionRange;
  const missions = plan.missions.map((mission) => {
    const hero = heroById(state, mission.hero);
    let m = mission;
    if (hero.standing.guardCapital) {
      // 수도로 가는 최단 경로(아군 거점만 지남)의 다음 거점으로 가는 이동만 둔다
      const from = ownDist[hero.location];
      const homeward = m.kind === "move" && from !== undefined && ownDist[m.to] === from - 1;
      if (m.kind !== "defend" && !homeward) m = fix(m, "guardCapital", { kind: "defend", hero: m.hero });
      else if (m.when !== undefined && m.when.react.kind !== "defend") m = fix(m, "guardCapital", withoutCondition(m));
    }
    if (!hero.standing.expedition) {
      const dest = m.kind === "move" ? m.to : m.kind === "attack" ? m.target : null;
      const react = m.when?.react;
      if (dest !== null && far(dest)) {
        m = fix(m, "expedition", { kind: "defend", hero: m.hero });
      } else if (react !== undefined && (react.kind === "advance" || react.kind === "reinforce") && far(react.node)) {
        m = fix(m, "expedition", withoutCondition(m));
      }
    }
    return m;
  });
  limitCapitalDraws(state, seat, capital, missions, fix);
  return { plan: { ...plan, missions }, corrections };
}

/** 현재 수도에서 꺼내는 병력 합이 수도 수비대 − 최소 수비를 넘지 않게, 영웅 id 순으로 채우고 넘는 만큼 줄인다 */
function limitCapitalDraws(state: GameState, seat: SeatId, capital: NodeId, missions: Mission[], fix: Fix): void {
  const level = state.seats[seat].settings.safeguards.capitalMin;
  if (level === null) return;
  let allowance = Math.max(0, state.nodes[capital].garrison - level * BALANCE.constraints.capitalMinPerLevel);
  const order = missions
    .map((m, index) => ({ m, index }))
    .filter(
      ({ m }) =>
        (m.kind === "move" || m.kind === "attack") &&
        (m.draw ?? 0) > 0 &&
        heroById(state, m.hero).location === capital,
    )
    .sort((a, b) => compareText(a.m.hero, b.m.hero));
  for (const { m, index } of order) {
    if (m.kind !== "move" && m.kind !== "attack") continue;
    const hero = heroById(state, m.hero);
    // 통솔 상한 때문에 어차피 못 꺼내는 몫은 세지 않는다(이동 단계의 drawTroops와 같은 기준)
    const need = Math.max(0, Math.min(m.draw ?? 0, troopCap(hero) - hero.troops));
    const give = Math.min(need, allowance);
    allowance -= give;
    if (give < need) missions[index] = fix(m, "capitalMin", { ...m, draw: give });
  }
}

function heroById(state: GameState, id: string): Hero {
  const hero = state.heroes.find((h) => h.id === id);
  if (!hero) throw new Error(`unknown hero: ${id}`);
  return hero;
}

function withoutCondition(mission: Mission): Mission {
  const copy = { ...mission };
  delete copy.when;
  return copy;
}
```

`packages/core/src/index.ts`의 `export { validatePlan, … }` 줄 바로 뒤에 넣는다:
```ts
export { confirmPlan, type ConfirmedPlan, type ConstraintRule, type Correction } from "./confirm";
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npm test -- packages/core/test/confirm.test.ts`
Expected: `Tests  8 passed`.

Run: `npm test`
Expected: `Test Files  20 passed`, `Tests  205 passed`.

Run: `npm run typecheck`
Expected: 오류 없음.

- [ ] **Step 5: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add packages/core
git -C D:/game/proxywar commit -m "feat(core): 확정 순서의 제약(수도 방어 전담·원정 불허·수도 최소 수비)"
```

---

### Task 9: 규칙 참모가 시야와 세팅으로 계획하기

규칙 참모는 `SeatView`만 받는다. 세팅은 제안표의 "규칙 참모가 세팅을 쓰는 법"대로 지금 휴리스틱의 매개변수가 되고, 상시 명령·안전장치는 확정 전에 미리 지킨다. `balanced`의 값은 1b-1 상수와 같다.

**Files:**
- Modify: `packages/core/src/staff/types.ts`, `packages/core/src/staff/rule-staff.ts`, `packages/sim/src/runner.ts`
- Test: `packages/core/test/rule-staff.test.ts`

- [ ] **Step 1: 규칙 참모 테스트를 시야로 바꾸고 세팅 테스트를 더한다**

`packages/core/test/rule-staff.test.ts` 전체:
```ts
import { describe, expect, it } from "vitest";
import { confirmPlan } from "../src/confirm";
import { validatePlan } from "../src/orders";
import { processTurn } from "../src/rules/turn";
import { PRESET_NAMES } from "../src/settings";
import { MatchSetupSchema } from "../src/setup";
import { initState } from "../src/state";
import { rulePlan, ruleStaff } from "../src/staff/rule-staff";
import type { GameState, Plan } from "../src/types";
import { viewOf } from "../src/view";
import { heroOf, makeSetup, makeState } from "./helpers";

function planOf(state: GameState, seat = 0): Plan {
  return rulePlan(viewOf(state, seat));
}

const ALL_DEFEND = ["defend", "defend", "defend", "defend", "defend"];

describe("rulePlan", () => {
  it("시작 상태에서 모든 자리의 계획이 검증을 통과한다", () => {
    const state = makeState();
    for (let seat = 0; seat < 6; seat++) {
      expect(validatePlan(state, seat, planOf(state, seat)).issues).toEqual([]);
    }
  });

  it("첫 턴에 첫 영웅이 수도에서 30을 꺼내 가장 약한 이웃(동률은 id 순)을 공격하고 나머지는 방어한다", () => {
    const plan = planOf(makeState());
    expect(plan.missions[0]).toEqual({ kind: "attack", hero: "s0h0", target: "f0", draw: 30 });
    expect(plan.missions.slice(1).map((m) => m.kind)).toEqual(["defend", "defend", "defend", "defend"]);
  });

  it("혼자 못 깨는 이웃은 인접한 영웅들이 합쳐 넘으면 함께 공격한다", () => {
    const state = makeState();
    for (const n of ["f0", "m0"]) Object.assign(state.nodes[n], { owner: 0, garrison: 0 });
    const troops = [88, 18, 20, 0, 0];
    troops.forEach((t, j) => Object.assign(heroOf(state, `s0h${j}`), { location: "f0", troops: t }));
    const plan = planOf(state);
    expect(validatePlan(state, 0, plan).issues).toEqual([]);
    expect(plan.missions).toEqual([
      { kind: "attack", hero: "s0h0", target: "x5", draw: 0 },
      { kind: "attack", hero: "s0h1", target: "x5", draw: 0 },
      { kind: "attack", hero: "s0h2", target: "x5", draw: 0 },
      { kind: "defend", hero: "s0h3" },
      { kind: "defend", hero: "s0h4" },
    ]);
  });

  it("약한 영웅은 병력 있는 거점까지 돌아가 채운 뒤 전선으로 나간다(전선과 내부를 왕복하지 않는다)", () => {
    const state = makeState();
    for (const n of ["f0", "m0", "x5"]) Object.assign(state.nodes[n], { owner: 0, garrison: 0 });
    state.nodes.c0.garrison = 200;
    for (let j = 1; j < 5; j++) heroOf(state, `s0h${j}`).status = "out";
    const hero = heroOf(state, "s0h0");
    Object.assign(hero, { location: "x5", troops: 10 });
    expect(planOf(state).missions[0]).toEqual({ kind: "move", hero: "s0h0", to: "f0", draw: 0 });
    hero.location = "f0";
    expect(planOf(state).missions[0]).toEqual({ kind: "move", hero: "s0h0", to: "c0", draw: 0 });
    hero.location = "c0";
    expect(planOf(state).missions[0]).toEqual({ kind: "move", hero: "s0h0", to: "m0", draw: 130 });
  });

  it("식량을 유지비 5턴 치 남기는 만큼 수도에서 모집한다", () => {
    expect(planOf(makeState()).recruits).toEqual([{ node: "c0", amount: 30 }]);
  });

  it("전선이 아닌 거점에서 채울 병력도 없는 영웅은 거점을 운영한다", () => {
    const state = makeState();
    for (const n of ["f0", "m0"]) Object.assign(state.nodes[n], { owner: 0, garrison: 0 });
    const plan = planOf(state);
    expect(validatePlan(state, 0, plan).issues).toEqual([]);
    expect(plan.missions.map((m) => m.kind)).toEqual(["govern", "govern", "govern", "govern", "govern"]);
  });

  it("자재가 되면 수도 생산 건물을 먼저 짓고 남은 금으로 모집한다", () => {
    const state = makeState();
    Object.assign(state.seats[0].treasury, { gold: 40, food: 200, material: 30 });
    state.nodes.i1.owner = 0;
    const plan = planOf(state);
    expect(plan.builds).toEqual([{ node: "c0", building: "production" }]);
    // 금 40 − 건설 20 = 20으로 4단위(수도 30 + 도시 10). 건설 금을 빼지 않으면 도시가 20이 된다
    expect(plan.recruits).toEqual([
      { node: "c0", amount: 30 },
      { node: "i1", amount: 10 },
    ]);
  });

  it("짓고 나면 금이 15 아래로 떨어질 때는 짓지 않는다", () => {
    const state = makeState();
    Object.assign(state.seats[0].treasury, { gold: 30, material: 30 });
    expect(planOf(state).builds).toEqual([]);
  });

  it("수도 생산이 최고 레벨이면 아군 농장·광산 생산, 그것도 다 차면 수도 성벽을 짓는다", () => {
    const state = makeState();
    Object.assign(state.seats[0].treasury, { gold: 200, material: 200 });
    state.nodes.c0.buildings.production = 3;
    state.nodes.f0.owner = 0;
    expect(planOf(state).builds).toEqual([{ node: "f0", building: "production" }]);
    state.nodes.f0.buildings.production = 3;
    expect(planOf(state).builds).toEqual([{ node: "c0", building: "walls" }]);
  });

  it("ruleStaff는 rulePlan과 같은 계획을 비동기로 낸다", async () => {
    const view = viewOf(makeState(), 2);
    expect(await ruleStaff.plan({ view })).toEqual(rulePlan(view));
  });

  it("30턴 동안 모든 자리의 계획이 검증을 통과하고 첫 턴에 농장을 얻는다", () => {
    let state = makeState();
    for (let turn = 1; turn <= 30; turn++) {
      const current = state;
      const checked = current.seats.map((s) => validatePlan(current, s.id, planOf(current, s.id)));
      for (const c of checked) expect(c.issues).toEqual([]);
      state = processTurn(
        current,
        checked.map((c) => c.plan),
      ).state;
      if (turn === 1) expect(state.nodes.f0.owner).toBe(0);
    }
  });
});

describe("rulePlan의 세팅", () => {
  it("공격성이 공격 여유 배수를 정한다(3이면 1.3, 5면 1.0)", () => {
    const state = makeState();
    state.nodes.f0.garrison = 28;
    state.nodes.m0.garrison = 40;
    // 첫 영웅이 30을 꺼내 30 × 1.12 = 33.6. f0 방어력 28 × 1.3 = 36.4는 못 넘고 28 × 1.0은 넘는다
    expect(planOf(state).missions.map((m) => m.kind)).toEqual(ALL_DEFEND);
    state.seats[0].settings.tendency.aggression = 5;
    expect(planOf(state).missions[0]).toEqual({ kind: "attack", hero: "s0h0", target: "f0", draw: 30 });
  });

  it("확장 욕구가 낮으면 남의 거점, 높으면 중립 거점을 먼저 친다", () => {
    const state = makeState();
    Object.assign(state.nodes.m0, { owner: 1, garrison: 10 });
    // 보통은 방어력이 낮은 m0(Seat1, 10)
    expect(planOf(state).missions[0]).toMatchObject({ kind: "attack", target: "m0" });
    state.seats[0].settings.tendency.expansion = 5;
    expect(planOf(state).missions[0]).toMatchObject({ kind: "attack", target: "f0" });
    state.seats[0].settings.tendency.expansion = 1;
    expect(planOf(state).missions[0]).toMatchObject({ kind: "attack", target: "m0" });
  });

  it("희귀 자원지 우선 지침을 켜면 희귀 자원지를 먼저 친다", () => {
    const state = makeState();
    for (const n of ["m0", "x0"]) Object.assign(state.nodes[n], { owner: 0, garrison: 0 });
    for (let j = 1; j < 5; j++) heroOf(state, `s0h${j}`).status = "out";
    Object.assign(heroOf(state, "s0h0"), { location: "x0", troops: 100 });
    // x0의 이웃 f1(농장 20)과 i0(희귀 40). 보통은 방어력이 낮은 f1
    expect(planOf(state).missions[0]).toMatchObject({ kind: "attack", target: "f1" });
    state.seats[0].settings.guidelines.rareFirst = true;
    expect(planOf(state).missions[0]).toMatchObject({ kind: "attack", target: "i0" });
  });

  it("약한 상대 우선 지침을 켜면 거점 수가 가장 적은 자리의 거점을 먼저 친다", () => {
    const state = makeState();
    for (const n of ["m0", "x0"]) Object.assign(state.nodes[n], { owner: 0, garrison: 0 });
    for (let j = 1; j < 5; j++) heroOf(state, `s0h${j}`).status = "out";
    Object.assign(heroOf(state, "s0h0"), { location: "x0", troops: 100 });
    // Seat1은 거점 3개(c1·f1·m1), Seat2~5는 2개씩. f1과 i0은 방어력이 20으로 같아 보통은 id 순 f1
    Object.assign(state.nodes.f1, { owner: 1, garrison: 20 });
    state.nodes.m1.owner = 1;
    Object.assign(state.nodes.i0, { owner: 2, garrison: 20 });
    for (const s of [3, 4, 5]) state.nodes[`f${s}`].owner = s;
    expect(planOf(state).missions[0]).toMatchObject({ kind: "attack", target: "f1" });
    state.seats[0].settings.guidelines.weakFirst = true;
    expect(planOf(state).missions[0]).toMatchObject({ kind: "attack", target: "i0" });
  });

  it("내정↔군사가 턴당 건설 수를 정한다(1이면 2건, 5면 짓지 않음)", () => {
    const state = makeState();
    Object.assign(state.seats[0].treasury, { gold: 200, material: 200 });
    state.nodes.f0.owner = 0;
    expect(planOf(state).builds).toEqual([{ node: "c0", building: "production" }]);
    state.seats[0].settings.tendency.focus = 1;
    expect(planOf(state).builds).toEqual([
      { node: "c0", building: "production" },
      { node: "f0", building: "production" },
    ]);
    state.seats[0].settings.tendency.focus = 5;
    expect(planOf(state).builds).toEqual([]);
  });

  it("식량 자제 지침을 끄면 식량을 유지비 1턴 치만 남기고 모집한다", () => {
    const state = makeState();
    state.seats[0].treasury.food = 30;
    expect(planOf(state).recruits).toEqual([{ node: "c0", amount: 20 }]);
    state.seats[0].settings.guidelines.foodCaution = false;
    expect(planOf(state).recruits).toEqual([{ node: "c0", amount: 30 }]);
  });

  it("수도 최소 수비만큼 수도 수비대를 남기고 꺼낸다(5면 50, 끄면 0)", () => {
    const state = makeState();
    state.seats[0].settings.safeguards.capitalMin = 5;
    // 10만 꺼내 11.2로는 f0(20 × 1.3)을 못 넘는다
    expect(planOf(state).missions.map((m) => m.kind)).toEqual(ALL_DEFEND);
    state.seats[0].settings.safeguards.capitalMin = null;
    expect(planOf(state).missions[0]).toEqual({ kind: "attack", hero: "s0h0", target: "f0", draw: 60 });
  });

  it("수도 방어 전담 영웅은 수도에 있으면 지키고, 밖에 있으면 수도로 한 걸음 돌아온다", () => {
    const state = makeState();
    heroOf(state, "s0h0").standing.guardCapital = true;
    // 첫 영웅이 지키므로 공격은 다음 영웅이 한다
    const first = planOf(state).missions;
    expect(first[0]).toEqual({ kind: "defend", hero: "s0h0" });
    expect(first[1]).toEqual({ kind: "attack", hero: "s0h1", target: "f0", draw: 30 });
    state.nodes.f0.owner = 0;
    heroOf(state, "s0h0").location = "f0";
    expect(planOf(state).missions[0]).toEqual({ kind: "move", hero: "s0h0", to: "c0", draw: 0 });
  });

  it("원정 불허 영웅은 현재 수도에서 2칸 넘는 거점을 치지 않는다", () => {
    const state = makeState();
    for (const n of ["f0", "x5"]) Object.assign(state.nodes[n], { owner: 0, garrison: 0 });
    for (let j = 1; j < 5; j++) heroOf(state, `s0h${j}`).status = "out";
    const hero = heroOf(state, "s0h0");
    Object.assign(hero, { location: "x5", troops: 100 });
    // x5의 이웃 m5(광산 20)와 i5(도시 40)는 수도 c0에서 3칸
    expect(planOf(state).missions[0]).toMatchObject({ kind: "attack", target: "m5" });
    hero.standing.expedition = false;
    expect(planOf(state).missions[0]).toEqual({ kind: "defend", hero: "s0h0" });
  });

  it("후퇴 기준이 있으면 공격 여유를 그 기준값과 비교해 큰 쪽으로 본다", () => {
    const state = makeState();
    state.nodes.f0.garrison = 25;
    state.nodes.m0.garrison = 40;
    // 33.6은 25 × 1.3 = 32.5를 넘지만 25 × 1.4 = 35는 못 넘는다
    expect(planOf(state).missions[0]).toMatchObject({ kind: "attack", target: "f0" });
    for (let j = 0; j < 5; j++) heroOf(state, `s0h${j}`).standing.retreatAt = 5;
    expect(planOf(state).missions.map((m) => m.kind)).toEqual(ALL_DEFEND);
  });

  it("위험 감수가 2 이하면 공격 임무에 '병력 비율 아래 3 → 방어' 조건을 붙인다", () => {
    const state = makeState();
    expect(planOf(state).missions[0]).not.toHaveProperty("when");
    state.seats[0].settings.tendency.risk = 2;
    expect(planOf(state).missions[0]).toEqual({
      kind: "attack",
      hero: "s0h0",
      target: "f0",
      draw: 30,
      when: { trigger: { kind: "ratioBelow", value: 3 }, react: { kind: "defend" } },
    });
  });

  it("세팅·상시 명령이 섞여도 30턴 동안 검증과 확정에서 고쳐지는 항목이 없다", () => {
    const setup = makeSetup();
    setup.seats.forEach((seat, i) => {
      seat.settings = PRESET_NAMES[i % PRESET_NAMES.length];
    });
    setup.seats[5].settings = { preset: "aggressive", tendency: { risk: 2 } };
    setup.seats[0].heroes[0].standing = { guardCapital: true };
    setup.seats[1].heroes[0].standing = { retreatAt: 4 };
    setup.seats[2].heroes[1].standing = { expedition: false };
    setup.seats[3].heroes[0].standing = { guardCapital: true, expedition: false };
    let state = initState(MatchSetupSchema.parse(setup));
    for (let turn = 1; turn <= 30 && state.ended === null; turn++) {
      const current = state;
      const confirmed = current.seats.map((s) => {
        const checked = validatePlan(current, s.id, planOf(current, s.id));
        expect(checked.issues).toEqual([]);
        return confirmPlan(current, s.id, checked.plan);
      });
      for (const c of confirmed) expect(c.corrections).toEqual([]);
      state = processTurn(
        current,
        confirmed.map((c) => c.plan),
      ).state;
    }
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm test -- packages/core/test/rule-staff.test.ts`
Expected: FAIL. `rulePlan`이 아직 `(state, seat)`를 받아 시야를 넘기면 `Cannot read properties of undefined`로 깨진다.

- [ ] **Step 3: 참모 입력을 시야로 바꾼다**

`packages/core/src/staff/types.ts` 전체:
```ts
import type { Plan } from "../types";
import type { SeatView } from "../view";

/** 참모는 자기 시야(보고서 데이터)만 받는다 */
export interface StaffInput {
  view: SeatView;
}

export interface Staff {
  plan(input: StaffInput): Promise<Plan>;
}
```

- [ ] **Step 4: 규칙 참모를 다시 쓴다**

`packages/core/src/staff/rule-staff.ts` 전체:
```ts
import { BALANCE, buildCost, recruitCapAt } from "../data/balance";
import { bfs, compareText, neighbors, nodeType } from "../map";
import { attackModifier, defensePower, troopCap } from "../rules/power";
import { ownedNodes, totalTroops } from "../summary";
import type { Board, Build, Condition, Mission, NodeId, Plan, Recruit, SeatId } from "../types";
import { boardOf, type MyHero, type SeatView } from "../view";
import type { Staff } from "./types";

// 성향 1~5별 값. 3(balanced)이 1b-1 규칙 참모의 상수다.
/** 공격성: 추정 공격력이 추정 방어력의 이 배수를 넘을 때만 공격한다 */
const ATTACK_MARGIN_BY_AGGRESSION = [1.7, 1.5, 1.3, 1.15, 1.0];
/** 위험 감수: 병력이 통솔 상한의 이 비율 아래인 영웅은 약하다(채우러 돌아가거나 운영한다) */
const WEAK_RATIO_BY_RISK = [0.7, 0.6, 0.5, 0.4, 0.3];
/** 위험 감수가 이 값 이하면 공격 임무에 조건을 붙인다 */
const CONDITION_MAX_RISK = 2;
/** 내정↔군사: 턴당 최대 건설 수와, 건설 뒤에도 남길 금 */
const MAX_BUILDS_BY_FOCUS = [2, 2, 1, 1, 0];
const BUILD_GOLD_RESERVE_BY_FOCUS = [5, 10, 15, 20, 20];
/** 식량 자제 지침: 모집 뒤 식량을 예상 유지비의 이 턴 수만큼 남긴다 */
const FOOD_RESERVE_TURNS = { on: 5, off: 1 };

export const ruleStaff: Staff = {
  plan: async ({ view }) => rulePlan(view),
};

/** 한 번의 계획에서 쓰는 시야와 세팅 값 */
interface Ctx {
  view: SeatView;
  seat: SeatId;
  board: Board;
  margin: number;
  weakRatio: number;
  capitalReserve: number;
  /** 현재 수도에서의 맵 거리. 수도가 없으면 null(원정 제한 없음) */
  capitalDist: Record<NodeId, number> | null;
  /** 거점 수가 가장 적은 상대 자리들 */
  weakest: Set<SeatId>;
}

export function rulePlan(view: SeatView): Plan {
  const { tendency, safeguards } = view.settings;
  const rivals = view.seats.filter((s) => s.id !== view.seat && !s.eliminated);
  const fewest = Math.min(...rivals.map((s) => s.nodes));
  const ctx: Ctx = {
    view,
    seat: view.seat,
    board: boardOf(view),
    margin: ATTACK_MARGIN_BY_AGGRESSION[tendency.aggression - 1],
    weakRatio: WEAK_RATIO_BY_RISK[tendency.risk - 1],
    capitalReserve: (safeguards.capitalMin ?? 0) * BALANCE.constraints.capitalMinPerLevel,
    capitalDist: view.capital === null ? null : bfs(view.map, view.capital).dist,
    weakest: new Set(rivals.filter((s) => s.nodes === fewest).map((s) => s.id)),
  };
  const builds = planBuilds(ctx);
  const buildGold = builds.reduce((sum, b) => sum + buildCost(view.nodes[b.node].buildings[b.building] + 1).gold, 0);
  return { missions: planMissions(ctx), recruits: planRecruits(ctx, buildGold), builds };
}

/** 아군 거점인가(안 보이는 거점은 아군이 아니다) */
function mine(ctx: Ctx, node: NodeId): boolean {
  return ctx.view.nodes[node]?.owner === ctx.seat;
}

function reserveAt(ctx: Ctx, node: NodeId): number {
  return ctx.view.capital === node ? ctx.capitalReserve : 0;
}

function isFrontier(ctx: Ctx, node: NodeId): boolean {
  return neighbors(ctx.view.map, node).some((n) => !mine(ctx, n));
}

/** 원정 불허 영웅은 현재 수도에서 원정 범위를 넘는 거점으로 가거나 치지 않는다 */
function inRange(ctx: Ctx, hero: MyHero, node: NodeId): boolean {
  if (hero.standing.expedition || ctx.capitalDist === null) return true;
  return (ctx.capitalDist[node] ?? Infinity) <= BALANCE.constraints.expeditionRange;
}

/** 공격 여유: 공격성 배수와 영웅들의 후퇴 기준값 중 큰 값 */
function marginOf(ctx: Ctx, heroes: readonly MyHero[]): number {
  const retreat = heroes.map((h) =>
    h.standing.retreatAt === null ? 0 : BALANCE.constraints.retreatRatioByLevel[h.standing.retreatAt - 1],
  );
  return Math.max(ctx.margin, ...retreat);
}

/** 아군 거점만 지나 goal을 만족하는 가장 가까운 아군 거점으로 가는 첫 걸음. 없으면 null. */
function stepToward(ctx: Ctx, from: NodeId, goal: (node: NodeId) => boolean): NodeId | null {
  const { dist, prev } = bfs(ctx.view.map, from, (n) => mine(ctx, n));
  const target: NodeId | undefined = Object.keys(dist)
    .filter((n) => n !== from && mine(ctx, n) && goal(n))
    .sort((a, b) => dist[a] - dist[b] || compareText(a, b))[0];
  if (target === undefined) return null;
  let step = target;
  while (prev[step] !== from) step = prev[step]!;
  return step;
}

/** 약한 영웅이 병력을 받으러 돌아갈 첫 걸음. 돌아갈 필요가 없거나 갈 곳이 없으면 null. */
function regroupStep(ctx: Ctx, hero: MyHero, draw: number): NodeId | null {
  const need = troopCap(hero) * ctx.weakRatio;
  if (hero.troops + draw >= need) return null;
  const spare = (n: NodeId): number => ctx.view.nodes[n].garrison - reserveAt(ctx, n);
  const source: NodeId | undefined = ownedNodes(ctx.view, ctx.seat)
    .filter((n) => n !== hero.location && spare(n) >= need)
    .sort((a, b) => spare(b) - spare(a) || compareText(a, b))[0];
  if (source === undefined) return null;
  return stepToward(ctx, hero.location, (n) => n === source);
}

/** 거점별로 이미 꺼내기로 한 뒤 남은 수비대(left)를 보고, 영웅이 서 있는 곳에서 꺼낼 수 있는 병력 */
function drawFor(ctx: Ctx, hero: MyHero, left: Record<NodeId, number>): number {
  const garrison = left[hero.location] ?? ctx.view.nodes[hero.location].garrison;
  return Math.max(0, Math.min(garrison - reserveAt(ctx, hero.location), troopCap(hero) - hero.troops));
}

/** 공격 목표 정렬 키(작을수록 먼저): 희귀 우선 → 약한 상대 우선 → 확장 욕구 */
function targetRank(ctx: Ctx, node: NodeId): number[] {
  const { guidelines, tendency } = ctx.view.settings;
  const owner = ctx.view.nodes[node].owner;
  const neutral = owner === null ? 0 : 1;
  const expansion = tendency.expansion <= 2 ? 1 - neutral : tendency.expansion >= 4 ? neutral : 0;
  return [
    guidelines.rareFirst && nodeType(ctx.view.map, node) === "rare" ? 0 : 1,
    guidelines.weakFirst && owner !== null && ctx.weakest.has(owner) ? 0 : 1,
    expansion,
  ];
}

function compareRank(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

/** froms에 인접한 아군이 아닌 거점(claimed 제외)을 정렬 키 → 추정 방어력 → id 순으로 */
function attackTargets(
  ctx: Ctx,
  froms: readonly NodeId[],
  claimed: ReadonlySet<NodeId>,
): { node: NodeId; def: number; rank: number[] }[] {
  const nodes = new Set(froms.flatMap((f) => neighbors(ctx.view.map, f)));
  return [...nodes]
    .filter((n) => !mine(ctx, n) && !claimed.has(n))
    .map((n) => ({ node: n, def: defensePower(ctx.board, n), rank: targetRank(ctx, n) }))
    .sort((a, b) => compareRank(a.rank, b.rank) || a.def - b.def || compareText(a.node, b.node));
}

function cautiousCondition(): Condition {
  return { trigger: { kind: "ratioBelow", value: 3 }, react: { kind: "defend" } };
}

function planMissions(ctx: Ctx): Mission[] {
  const { view } = ctx;
  const planned = new Map<string, Mission>();
  const left: Record<NodeId, number> = {};
  const claimed = new Set<NodeId>();
  const heroes = view.myHeroes.filter((h) => h.status === "active").sort((a, b) => compareText(a.id, b.id));
  const idle = (): MyHero[] => heroes.filter((h) => !planned.has(h.id));
  const takeDraw = (hero: MyHero): number => {
    const draw = drawFor(ctx, hero, left);
    left[hero.location] = (left[hero.location] ?? view.nodes[hero.location].garrison) - draw;
    return draw;
  };
  const attack = (hero: MyHero, target: NodeId): Mission => {
    const mission: Mission = { kind: "attack", hero: hero.id, target, draw: takeDraw(hero) };
    if (view.settings.tendency.risk <= CONDITION_MAX_RISK) mission.when = cautiousCondition();
    return mission;
  };

  // 0) 수도 방어 전담: 현재 수도에 있으면 지키고, 밖에 있으면 수도로 한 걸음(못 가면 지킨다)
  const capital = view.capital;
  if (capital !== null) {
    for (const hero of heroes) {
      if (!hero.standing.guardCapital) continue;
      const step = hero.location === capital ? null : stepToward(ctx, hero.location, (n) => n === capital);
      planned.set(
        hero.id,
        step !== null && inRange(ctx, hero, step)
          ? { kind: "move", hero: hero.id, to: step, draw: 0 }
          : { kind: "defend", hero: hero.id },
      );
    }
  }

  // 1) 혼자 깰 수 있는 목표 중 정렬상 첫째를 공격한다
  for (const hero of idle()) {
    const force = (hero.troops + drawFor(ctx, hero, left)) * attackModifier(hero);
    const margin = marginOf(ctx, [hero]);
    const target = attackTargets(ctx, [hero.location], claimed).find(
      (t) => inRange(ctx, hero, t.node) && force > t.def * margin,
    );
    if (!target) continue;
    claimed.add(target.node);
    planned.set(hero.id, attack(hero, target.node));
  }

  // 2) 혼자 못 깨는 목표는 인접한 남은 영웅들이 합쳐 넘을 수 있으면 함께 공격한다
  for (const target of attackTargets(ctx, idle().map((h) => h.location), claimed)) {
    // 같은 거점 수비대를 앞 영웅이 다 꺼내면 뒤 영웅은 병력 0이 되므로, 실제로 병력을 든 영웅만 센다
    const trial = { ...left };
    let troops = 0;
    const group = idle().filter((h) => {
      if (!neighbors(view.map, h.location).includes(target.node) || !inRange(ctx, h, target.node)) return false;
      const draw = drawFor(ctx, h, trial);
      trial[h.location] = (trial[h.location] ?? view.nodes[h.location].garrison) - draw;
      troops += h.troops + draw;
      return h.troops + draw > 0;
    });
    if (group.length < 2) continue;
    if (troops * Math.max(...group.map((h) => attackModifier(h))) <= target.def * marginOf(ctx, group)) continue;
    claimed.add(target.node);
    for (const h of group) planned.set(h.id, attack(h, target.node));
  }

  // 3) 나머지: 약하면 병력 있는 거점까지 돌아간다(전선이든 내부든). 전선이면 지키고,
  //    내부에서 채울 병력도 없이 약하면 거점을 운영하며, 아니면 전선으로 나간다(갈 전선이 없으면 운영)
  for (const hero of idle()) {
    const draw = drawFor(ctx, hero, left);
    const back = regroupStep(ctx, hero, draw);
    if (back !== null && inRange(ctx, hero, back)) {
      planned.set(hero.id, { kind: "move", hero: hero.id, to: back, draw: 0 });
      continue;
    }
    const here = hero.location;
    if (isFrontier(ctx, here)) {
      planned.set(hero.id, { kind: "defend", hero: hero.id });
      continue;
    }
    const weak = hero.troops + draw < troopCap(hero) * ctx.weakRatio;
    const step = weak ? null : stepToward(ctx, here, (n) => isFrontier(ctx, n));
    if (step === null || !inRange(ctx, hero, step)) planned.set(hero.id, { kind: "govern", hero: hero.id });
    else planned.set(hero.id, { kind: "move", hero: hero.id, to: step, draw: takeDraw(hero) });
  }
  return heroes.map((h) => planned.get(h.id)!);
}

/**
 * 턴당 최대 (내정↔군사) 건: 현재 수도 생산 → 아군 농장·광산 생산(id 순) → 현재 수도 성벽 → 현재 수도 병영 중
 * 최고 레벨이 아니고 자재가 되며 짓고 나서 금이 (남길 금) 이상 남는 후보를 앞에서부터. 한 거점에는 하나만.
 */
function planBuilds(ctx: Ctx): Build[] {
  const { view } = ctx;
  const capital = view.capital;
  if (capital === null) return [];
  const focus = view.settings.tendency.focus;
  const maxBuilds = MAX_BUILDS_BY_FOCUS[focus - 1];
  const reserve = BUILD_GOLD_RESERVE_BY_FOCUS[focus - 1];
  let { gold, material } = view.treasury;
  const resourceNodes = ownedNodes(view, ctx.seat).filter((n) => ["farm", "mine"].includes(nodeType(view.map, n)));
  const candidates: Build[] = [
    { node: capital, building: "production" },
    ...resourceNodes.map((node): Build => ({ node, building: "production" })),
    { node: capital, building: "walls" },
    { node: capital, building: "barracks" },
  ];
  const builds: Build[] = [];
  for (const c of candidates) {
    if (builds.length >= maxBuilds) break;
    if (builds.some((b) => b.node === c.node)) continue;
    const level = view.nodes[c.node].buildings[c.building] + 1;
    if (level > BALANCE.buildings.maxLevel) continue;
    const cost = buildCost(level);
    if (material < cost.material || gold - cost.gold < reserve) continue;
    builds.push(c);
    gold -= cost.gold;
    material -= cost.material;
  }
  return builds;
}

/** buildGold는 같은 계획의 건설에 먼저 쓴 금 */
function planRecruits(ctx: Ctx, buildGold: number): Recruit[] {
  const { view } = ctx;
  const { gold, food } = view.treasury;
  const { unit, costPerUnit } = BALANCE.recruit;
  const reserveTurns = view.settings.guidelines.foodCaution ? FOOD_RESERVE_TURNS.on : FOOD_RESERVE_TURNS.off;
  let spentGold = buildGold;
  let spentFood = 0;
  let troops = totalTroops(ctx.board, ctx.seat);
  const recruits: Recruit[] = [];
  for (const node of ownedNodes(view, ctx.seat)) {
    const cap = recruitCapAt(view, view.capital, node);
    let amount = 0;
    while (amount + unit <= cap) {
      const nextGold = spentGold + costPerUnit.gold;
      const nextFood = spentFood + costPerUnit.food;
      const upkeep = Math.ceil((troops + unit) / BALANCE.upkeep.soldiersPerFood);
      if (gold < nextGold || food - nextFood < upkeep * reserveTurns) break;
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

- [ ] **Step 5: 실행기가 시야로 참모를 부르게 한다**

`packages/sim/src/runner.ts`:
- `@proxywar/core` import 목록에 `viewOf`를 더한다.
- `runMatch` 안의 참모 호출을 바꾼다:
```ts
        s.eliminatedAt === null ? staffs[s.id].plan({ view: viewOf(current, s.id) }) : Promise.resolve(EMPTY_PLAN),
```

- [ ] **Step 6: 통과를 확인한다**

Run: `npm test -- packages/core/test/rule-staff.test.ts`
Expected: `Tests  23 passed`.

Run: `npm test`
Expected: `Test Files  20 passed`, `Tests  217 passed`. **회귀 테스트 8개가 통과해야 한다.** 깨지면 balanced의 판단이 1b-1과 달라진 것이다. 시드 하나의 계획을 1b-1 코드(`git stash`로 되돌리지 말고 `git show d86127b:packages/core/src/staff/rule-staff.ts`)와 턴별로 비교해 첫 차이를 찾는다.

Run: `npm run typecheck`
Expected: 오류 없음.

- [ ] **Step 7: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add packages/core packages/sim
git -C D:/game/proxywar commit -m "feat(core): 규칙 참모가 시야와 세팅으로 계획하고 제약을 미리 지킨다"
```

---

### Task 10: 확정을 실행기에 넣고, 기록 version 3·보고서·프리셋 실행 설정

**Files:**
- Modify: `packages/sim/src/runner.ts`, `packages/sim/src/report.ts`
- Create: `packages/sim/configs/rule6-presets.json`
- Test: `packages/sim/test/runner.test.ts`, `packages/sim/test/report.test.ts`

- [ ] **Step 1: 실행 설정을 만든다**

`packages/sim/configs/rule6-presets.json`:
```json
{
  "name": "rule6-presets",
  "map": "ring6",
  "turns": 120,
  "seed": 1,
  "seats": [
    { "name": "Aster", "staff": { "kind": "rule" }, "settings": "balanced", "heroes": [
      { "name": "Aster-1", "grade": 3 }, { "name": "Aster-2", "grade": 3 }, { "name": "Aster-3", "grade": 3 },
      { "name": "Aster-4", "grade": 3 }, { "name": "Aster-5", "grade": 3 } ] },
    { "name": "Briar", "staff": { "kind": "rule" }, "settings": "aggressive", "heroes": [
      { "name": "Briar-1", "grade": 3, "standing": { "retreatAt": 4 } }, { "name": "Briar-2", "grade": 3 },
      { "name": "Briar-3", "grade": 3 }, { "name": "Briar-4", "grade": 3 }, { "name": "Briar-5", "grade": 3 } ] },
    { "name": "Cobalt", "staff": { "kind": "rule" }, "settings": "economic", "heroes": [
      { "name": "Cobalt-1", "grade": 3 }, { "name": "Cobalt-2", "grade": 3, "standing": { "expedition": false } },
      { "name": "Cobalt-3", "grade": 3 }, { "name": "Cobalt-4", "grade": 3 }, { "name": "Cobalt-5", "grade": 3 } ] },
    { "name": "Dune", "staff": { "kind": "rule" }, "settings": "defensive", "heroes": [
      { "name": "Dune-1", "grade": 3, "standing": { "guardCapital": true } }, { "name": "Dune-2", "grade": 3 },
      { "name": "Dune-3", "grade": 3 }, { "name": "Dune-4", "grade": 3 }, { "name": "Dune-5", "grade": 3 } ] },
    { "name": "Ember", "staff": { "kind": "rule" }, "settings": "diplomatic", "heroes": [
      { "name": "Ember-1", "grade": 3 }, { "name": "Ember-2", "grade": 3 }, { "name": "Ember-3", "grade": 3 },
      { "name": "Ember-4", "grade": 3 }, { "name": "Ember-5", "grade": 3 } ] },
    { "name": "Frost", "staff": { "kind": "rule" }, "settings": { "preset": "aggressive", "tendency": { "risk": 2 } }, "heroes": [
      { "name": "Frost-1", "grade": 3, "standing": { "guardCapital": true } }, { "name": "Frost-2", "grade": 3 },
      { "name": "Frost-3", "grade": 3 }, { "name": "Frost-4", "grade": 3 }, { "name": "Frost-5", "grade": 3 } ] }
  ]
}
```

- [ ] **Step 2: 실행기·보고서 테스트를 바꾼다**

`packages/sim/test/runner.test.ts`:
- 파일 위의 `traitsRaw` 줄 뒤에 넣는다:
```ts
const presetsRaw = JSON.parse(readFileSync(new URL("../configs/rule6-presets.json", import.meta.url), "utf8"));
```
- 첫 테스트 끝에 `expect(record.turns[0].corrections).toHaveLength(6);`를 더한다.
- "모르는 키(오타)와…" 테스트 끝에 더한다:
```ts
    const settingsTypo = JSON.parse(JSON.stringify(raw));
    settingsTypo.seats[0].settings = { tendency: { agression: 3 } };
    expect(() => parseRunConfig(settingsTypo)).toThrow();
```
- "등급·특성이 섞인 매치도…" 테스트의 `expect(record.version).toBe(2);`를 `expect(record.version).toBe(3);`으로 바꾼다.
- 파일 끝 `});` 바로 앞에 더한다:
```ts
  it("프리셋·상시 명령이 섞인 매치도 끝까지 돌고, 규칙 참모 계획은 검증·확정에서 고쳐지지 않으며 조건을 붙인다", async () => {
    const record = await run(parseRunConfig(presetsRaw));
    expect(record.version).toBe(3);
    expect(record.initialState.seats.map((s) => s.settings.preset)).toEqual([
      "balanced",
      "aggressive",
      "economic",
      "defensive",
      "diplomatic",
      "aggressive",
    ]);
    expect(record.initialState.seats[5].settings.tendency.risk).toBe(2);
    expect(record.turns.every((t) => t.issues.every((list) => list.length === 0))).toBe(true);
    expect(record.turns.every((t) => t.corrections.every((list) => list.length === 0))).toBe(true);
    expect(record.turns.some((t) => t.plans[5].missions.some((m) => m.when !== undefined))).toBe(true);
  });
```

`packages/sim/test/report.test.ts`의 `expect(md).toContain("## 영웅·건설 통계");` 줄을 다음으로 바꾼다:
```ts
      expect(md).toContain("## 세팅");
      expect(md).toContain("| Aster | balanced | 3·3·3·3·3·3 | 식량 자제 | 3 | 없음 |");
      expect(md).toContain("## 영웅·건설·명령 통계");
      expect(md).toContain(
        "| 자리 | 레벨업 | 부상 | 포로로 잡힘 | 명령 불복 | 신중 후퇴 | 후퇴 기준 | 조건 발동 | 건설 | 확정 수정 |",
      );
```

- [ ] **Step 3: 실패를 확인한다**

Run: `npm test -- packages/sim/test/runner.test.ts packages/sim/test/report.test.ts`
Expected: FAIL. `corrections`가 없고(`toHaveLength` 실패), `version`이 2이며, 보고서에 "## 세팅"이 없다.

- [ ] **Step 4: 실행기에 확정을 넣는다**

`packages/sim/src/runner.ts` 전체:
```ts
import {
  buildingLevels,
  confirmPlan,
  heroLevels,
  initState,
  ownedNodes,
  processTurn,
  ruleStaff,
  scoreOf,
  totalTroops,
  validatePlan,
  viewOf,
  type Correction,
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
  /** 건물 레벨 합 */
  buildings: number;
  /** out이 아닌 영웅의 (레벨 − 1) 합 */
  heroLevels: number;
  treasury: Resources;
  eliminated: boolean;
}

export interface TurnRecord {
  turn: number;
  /** 참모가 낸 원래 계획(자리 순) */
  plans: Plan[];
  /** 검증에서 빠진 항목(자리 순) */
  issues: PlanIssue[][];
  /** 확정 때 제약(상시 명령 + 안전장치)이 고친 임무(자리 순) */
  corrections: Correction[][];
  events: GameEvent[];
  metrics: SeatMetrics[];
}

export interface MatchRecord {
  version: 3;
  config: RunConfig;
  initialState: GameState;
  turns: TurnRecord[];
  result: MatchResult;
}

const EMPTY_PLAN: Plan = { missions: [], recruits: [], builds: [] };

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
    buildings: buildingLevels(state, s.id),
    heroLevels: heroLevels(state, s.id),
    treasury: { ...s.treasury },
    eliminated: s.eliminatedAt !== null,
  }));
}

/** 참모 호출(자리별 시야) → 검증 → 확정 → 처리를 매치가 끝날 때까지 반복한다. 첫 호출은 초기 상태로 한다. */
export async function runMatch(config: RunConfig, staffs: readonly Staff[]): Promise<MatchRecord> {
  const initialState = initState(config);
  let state = initialState;
  const turns: TurnRecord[] = [];
  while (state.ended === null) {
    const current = state;
    const plans = await Promise.all(
      current.seats.map((s) =>
        s.eliminatedAt === null ? staffs[s.id].plan({ view: viewOf(current, s.id) }) : Promise.resolve(EMPTY_PLAN),
      ),
    );
    const confirmed = plans.map((plan, seat) => {
      const checked = validatePlan(current, seat, plan);
      return { issues: checked.issues, ...confirmPlan(current, seat, checked.plan) };
    });
    const { state: next, events } = processTurn(
      current,
      confirmed.map((c) => c.plan),
    );
    turns.push({
      turn: next.turn,
      plans,
      issues: confirmed.map((c) => c.issues),
      corrections: confirmed.map((c) => c.corrections),
      events,
      metrics: seatMetrics(next),
    });
    state = next;
  }
  return { version: 3, config, initialState, turns, result: state.ended! };
}
```

- [ ] **Step 5: 보고서에 세팅 표와 명령 통계를 넣는다**

`packages/sim/src/report.ts` 전체:
```ts
import { BALANCE, type GameEvent, type GuidelineKind, type MatchResult, type StandingOrders } from "@proxywar/core";
import type { MatchRecord } from "./runner";

const REASON: Record<MatchResult["reason"], string> = {
  earlyVictory: `조기 승리(과반 ${BALANCE.victory.majorityStreak}턴 유지)`,
  lastStanding: "마지막 생존",
  turnLimit: "턴 제한",
};

/** 자리별로 세는 사건(물러남은 이유별)과 확정 수정 */
const STAT_COLUMNS = [
  "levelUp",
  "heroInjured",
  "heroCaptured",
  "disobeyed",
  "caution",
  "standing",
  "conditionMet",
  "built",
  "corrected",
] as const;
type StatColumn = (typeof STAT_COLUMNS)[number];
const STAT_LABELS: Record<StatColumn, string> = {
  levelUp: "레벨업",
  heroInjured: "부상",
  heroCaptured: "포로로 잡힘",
  disobeyed: "명령 불복",
  caution: "신중 후퇴",
  standing: "후퇴 기준",
  conditionMet: "조건 발동",
  built: "건설",
  corrected: "확정 수정",
};

const GUIDELINE_LABELS: Record<GuidelineKind, string> = {
  foodCaution: "식량 자제",
  rareFirst: "희귀 우선",
  weakFirst: "약한 상대 우선",
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
    "## 세팅",
    "",
    "| 자리 | 프리셋 | 성향(공격·확장·위험·신의·내정군사·보복) | 지침 | 수도 최소 수비 | 상시 명령 |",
    "|---|---|---|---|---|---|",
  );
  for (const seat of record.initialState.seats) {
    const { preset, tendency: t, guidelines, safeguards } = seat.settings;
    const onGuidelines = (Object.keys(GUIDELINE_LABELS) as GuidelineKind[])
      .filter((k) => guidelines[k])
      .map((k) => GUIDELINE_LABELS[k]);
    const standing = record.initialState.heroes
      .filter((h) => h.seat === seat.id)
      .flatMap((h) => standingText(h.standing).map((text) => `${h.name} ${text}`));
    const tendency = [t.aggression, t.expansion, t.risk, t.fidelity, t.focus, t.retaliation].join("·");
    lines.push(
      `| ${seat.name} | ${preset} | ${tendency} | ${onGuidelines.join(", ") || "없음"} | ${safeguards.capitalMin ?? "끔"} | ${standing.join(", ") || "없음"} |`,
    );
  }
  lines.push("");

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

  const counts = names.map(() => Object.fromEntries(STAT_COLUMNS.map((k) => [k, 0])) as Record<StatColumn, number>);
  for (const t of record.turns) {
    for (const e of t.events) {
      const stat = statOf(e);
      if (stat) counts[stat[0]][stat[1]] += 1;
    }
    t.corrections.forEach((list, seat) => {
      counts[seat].corrected += list.length;
    });
  }
  lines.push(
    "",
    "## 영웅·건설·명령 통계",
    "",
    `| 자리 | ${STAT_COLUMNS.map((k) => STAT_LABELS[k]).join(" | ")} |`,
    `|---|${STAT_COLUMNS.map(() => "---").join("|")}|`,
  );
  names.forEach((n, seat) => lines.push(`| ${n} | ${STAT_COLUMNS.map((k) => counts[seat][k]).join(" | ")} |`));

  const issues = record.turns.flatMap((t) =>
    t.issues.flatMap((list, seat) => list.map((i) => `- T${t.turn} ${name(seat)}: ${i.item}[${i.index}] ${i.reason}`)),
  );
  lines.push("", "## 무효 명령", "", ...(issues.length > 0 ? issues : ["없음"]), "");
  return lines.join("\n");
}

function standingText(orders: StandingOrders): string[] {
  const out: string[] = [];
  if (orders.guardCapital) out.push("수도 방어");
  if (orders.retreatAt !== null) out.push(`후퇴 ${orders.retreatAt}`);
  if (!orders.expedition) out.push("원정 불허");
  return out;
}

/** 통계 표에서 세는 사건이면 [자리, 열] */
function statOf(e: GameEvent): [number, StatColumn] | null {
  switch (e.kind) {
    case "levelUp":
    case "heroInjured":
    case "heroCaptured":
    case "disobeyed":
    case "conditionMet":
    case "built":
      return [e.seat, e.kind];
    case "hesitated":
      return [e.seat, e.reason];
    default:
      return null;
  }
}

function describe(e: GameEvent, name: (seat: number | null) => string, heroName: (id: string) => string): string | null {
  switch (e.kind) {
    case "captured":
      return `점령: ${e.node} (${name(e.from)} → ${name(e.to)})`;
    case "capitalMoved":
      return `수도 함락: ${name(e.seat)} ${e.from} → ${e.to ?? "없음"}`;
    case "capitalRestored":
      return `수도 재지정: ${name(e.seat)} → ${e.to}`;
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

- [ ] **Step 6: 통과를 확인한다**

Run: `npm test -- packages/sim`
Expected: `Tests  16 passed`(regression 8, runner 7, report 1).

Run: `npm test`
Expected: `Test Files  20 passed`, `Tests  218 passed`(core 202, sim 16). 회귀 테스트 8개 통과(확정은 balanced 규칙 참모 계획을 고치지 않는다).

Run: `npm run typecheck`
Expected: 오류 없음.

- [ ] **Step 7: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add packages/sim
git -C D:/game/proxywar commit -m "feat(sim): 확정 단계, 기록 version 3, 세팅·명령 통계 보고서, 프리셋 실행 설정"
```

---

### Task 11: 전체 검증·실측·문서 갱신

**Files:**
- Modify: `AGENTS.md`, `docs/superpowers/plans/2026-10-28-sim-core-1b-2-view-settings-conditions.md`(머리말), 필요하면 `docs/design/brainstorm-log.md`

- [ ] **Step 1: 전체 테스트와 타입 검사를 돌린다**

Run: `npm test`
Expected: `Test Files  20 passed`, `Tests  218 passed`(core 202, sim 16).

Run: `npm run typecheck`
Expected: 오류 없음, 종료 코드 0.

- [ ] **Step 2: 세 실행 설정을 돌리고 보고서를 읽는다**

```bash
npm run sim -- run packages/sim/configs/rule6.json
npm run sim -- run packages/sim/configs/rule6-traits.json
npm run sim -- run packages/sim/configs/rule6-presets.json
```
Expected: 세 줄 모두 `<종료 이유> · 승자 <이름> · <턴>턴 → runs/…`. `rule6`은 회귀 기준대로 `turnLimit · 승자 Frost · 120턴`이다.

각 `report.md`에서 읽고 적어 둘 것: 종료 이유·승자·턴 수, "## 세팅" 표, "## 영웅·건설·명령 통계"의 조건 발동·후퇴 기준·확정 수정 열(확정 수정은 0이어야 한다), "## 무효 명령"이 "없음"인지.

- [ ] **Step 3: 프리셋 매치를 시드 1~8로 돌린다**

`runs/seeds-1b-2.mts`(git 제외 폴더):
```ts
import { readFileSync } from "node:fs";
import { parseRunConfig } from "../packages/sim/src/config.ts";
import { runMatch, staffFor } from "../packages/sim/src/runner.ts";

const raw = JSON.parse(readFileSync("packages/sim/configs/rule6-presets.json", "utf8"));
for (let seed = 1; seed <= 8; seed++) {
  const config = parseRunConfig({ ...raw, seed });
  const record = await runMatch(
    config,
    config.seats.map((s) => staffFor(s.staff)),
  );
  const events = record.turns.flatMap((t) => t.events);
  const count = (kind: string) => events.filter((e) => e.kind === kind).length;
  const standing = events.filter((e) => e.kind === "hesitated" && e.reason === "standing").length;
  const corrections = record.turns.reduce((sum, t) => sum + t.corrections.flat().length, 0);
  const issues = record.turns.reduce((sum, t) => sum + t.issues.flat().length, 0);
  const preset = (seat: number) => record.initialState.seats[seat].settings.preset;
  console.log(
    JSON.stringify({
      seed,
      reason: record.result.reason,
      turns: record.turns.length,
      ranking: record.result.ranking.map((s) => `${record.config.seats[s].name}(${preset(s)})`),
      conditionMet: count("conditionMet"),
      standingHesitated: standing,
      corrections,
      issues,
    }),
  );
}
```
Run: `npx tsx runs/seeds-1b-2.mts`
Expected: 8줄. 모든 줄의 `corrections`·`issues`가 0이다. 순위·조건 발동 수는 측정값이므로 기대값이 없다. 그대로 Step 4의 머리말 기록에 옮긴다. 0이 아닌 `corrections`·`issues`가 나오면 규칙 참모가 제약이나 검증을 미리 지키지 못한 것이다. 그 턴의 계획과 수정 내역을 찾아 원인을 보고한다.

- [ ] **Step 4: 범위를 대조하고 머리말에 실행 결과를 적는다**

머리말 "1b-2 범위"의 항목마다 그 항목을 구현한 Task와 테스트를 짚는다. 빠진 것이 있으면 보고에 적는다. 실행 중 계획과 다르게 한 것과 Step 2·3의 실측은 머리말 "설계서 대비 변경" 끝에 "(실행 중 반영)" 번호로 이유와 함께 더한다(1b-1 계획 방식). 리뷰에서 규칙 문구의 빈칸이 나와 사용자가 정한 것은 `docs/design/brainstorm-log.md`의 "1b-2 세부 규칙 확정" 줄 아래에 "1b-2 실행 중 결정"으로 더한다.

- [ ] **Step 5: AGENTS.md를 갱신한다**

"지금 어디에 있나" 절의 `1b-2 계획 작성(…).` 문장을 다음으로 바꾼다(브랜치를 만들지 않았으면 브랜치 부분을 뺀다):
```
1b-2 구현 완료(계획 `docs/superpowers/plans/2026-10-28-sim-core-1b-2-view-settings-conditions.md`, 브랜치 `sim-core-1b-2`). 다음은 1b-3 계획.
```

- [ ] **Step 6: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add AGENTS.md docs/superpowers/plans/2026-10-28-sim-core-1b-2-view-settings-conditions.md docs/design/brainstorm-log.md
git -C D:/game/proxywar commit -m "docs: 1b-2 시야·세팅·제약·조건부 명령 구현 완료 기록"
```
