# 1b-3 외교 구현 계획

> Task 순서대로 구현한다. 단계는 체크박스(`- [ ]`)로 진행을 표시한다.

**Goal:** 자리 사이에 관계(중립·전쟁·불가침·동맹)가 생기고, 참모가 정형 제안 6종(불가침·동맹·자원 교환·포로 교환·선전포고·파기)을 내고 받은 제안에 응답하며, 턴 처리의 외교 정산에서 관계·교환·약속 기록이 정해진다. 동맹은 시야를 나누고 서로의 거점을 지나갈 수 있으며, "동맹 공격 금지" 안전장치와 "동맹 신의"·"보복 성향" 성향이 작동한다. 규칙 참모 6명 매치가 이 규칙으로 끝까지 돈다.

**Architecture:** 1a~1b-2 구조(직렬화 가능한 상태 + `processTurn` 순수 함수 + 시야만 받는 규칙 참모)를 그대로 쓴다. 상태에 `diplomacy`(관계·대기 제안·약속 기록)를 더하고, 새 모듈 `rules/diplomacy.ts`가 외교 정산을 맡는다. `processTurn`의 순서는 메모 저장 → 충성 판정 → 이동 → 조건 판정·반응 → 전투 → 생산·건설·모집·유지비 → 레벨업 → 회복 → **외교 정산** → 탈락·종료다(게임 규칙 설계서 1.1의 "생산·성장 → 외교 정산"). 계획(`Plan`)에 제안·응답 칸을 더하고, 검증·확정·시야·규칙 참모가 관계를 읽는다.

**Tech Stack:** 1a와 같다(Node 24.11.1, TypeScript 7.0.2, zod 4.6.7, vitest 5.0.5, tsx 4.23.15). 새 의존성 없음.

**설계서:** `docs/superpowers/specs/2026-10-27-sim-core-design.md`(승인 2026-10-27) 하위 프로젝트 1의 1b를 세 조각으로 나눈 것 중 셋째다(결정 기록 `docs/design/brainstorm-log.md`의 "1b는 세 조각으로 나눈다"). 게임 규칙은 `docs/superpowers/specs/2026-10-27-game-rules-design.md` 4절(외교)과 3.2절(동맹 신의·보복 성향·동맹 공격 금지·외교 이력). 1a~1b-2 계획 머리말의 "실행 중 변경"도 현행 규칙이다.

**1b-3 범위:** 관계 상태와 약속 기록, 제안 6종의 형식·검증·정산, 동맹 시야 공유와 거점 통과, 동맹 종료 때 남의 거점에 있던 영웅의 귀환, "동맹 공격 금지" 안전장치(확정 때 강제), 규칙 참모의 외교(동맹 신의·보복 성향 사용), 시야에 관계·대기 제안·약속 기록, 기록 version 4와 보고서의 외교 절.

**1b-3에서 하지 않는 것:**
- 사람 조작(마스터가 직접 제안·응답). 설계서 1절대로 빠른 턴 모드는 봇만 돌린다.
- LLM 출력 스키마의 외교 칸, 정보 구성 "외교 이력"에 따른 항목 선택·길이 자르기·보고서 글(1c). 1b-3 시야에는 외교 데이터를 모두 넣는다.
- 지난 턴 외교 사건(거래 성사·거절 같은 사적 결과)을 시야에 넣는 일. 1b-2 변경 3과 같이 지난 턴 사건 정보는 1c다.
- 규칙 참모의 선전포고·파기. 공격하면 전쟁이 자동으로 되므로(아래 표) 규칙 참모에게는 필요가 없다. 두 제안은 검증·정산·단위 테스트로 다룬다.
- 동맹의 공동 방어. 동맹 영웅은 통과·대기만 한다(사용자 확정).

**설계서 대비 변경(이유 포함):**
1. **중립과 전쟁은 게임 효과가 같고, 공격은 관계와 상관없이 할 수 있다.** 설계서 4절이 "파기와 기습을 허용하고 벌칙은 없다", "동맹 공격 금지 안전장치가 켜져 있으면 파기를 먼저 해야 동맹을 공격할 수 있다"고 하므로, 게임이 막는 공격은 안전장치뿐이다. 그래서 중립·전쟁의 차이는 기록과 참모 판단(보복 성향)뿐이고, 두 자리 사이에 전투가 있으면 외교 정산에서 자동으로 전쟁이 된다. 선전포고는 공격 전에 미리 알리는 통보다.
2. **기본 세팅 회귀 유지(사용자 확정).** 규칙 참모는 동맹 신의 4·5일 때만 먼저 제안하고, 그 밖에는 응답만 한다. 기본 `balanced`(신의 3)만 있는 `rule6`에서는 아무도 제안하지 않아 1b-2와 같은 매치가 나온다.
3. **회귀 테스트의 해시는 외교 사건을 뺀 사건과 지표로 계산한다.** 전투가 있으면 전쟁 사건이 새로 생기므로, 사건 전체를 해시하면 같은 매치라도 값이 바뀐다. 종료 사유·턴·승자·순위 비교는 그대로다.
4. **매치 기록 `version`이 4가 된다.** 계획에 제안·응답이, 상태에 외교가 들어가기 때문이다.
5. **(실행 중 반영) 구현은 계획 코드 그대로 했다.**
   - 사용자 결정으로 `main`에서 커밋 없이 진행했다(Task 1 Step 1의 브랜치와 Task별 커밋 단계는 건너뜀).
   - Task마다 계획의 코드 지시를 스크립트로 뽑아 테스트 → 구현 순서로 붙였다. 계획 코드 수정은 0건이다. 구현 전 실패 수(모듈 없음, 23, 4, 11, 1, 2, 6, 4)와 통과 수(218 → 221 → 242 → 247 → 258 → 259 → 261 → 267 → 268)가 Expected와 같았고, 타입 오류는 Task마다 없었다.
   - 회귀 테스트 8개는 Task 1부터 끝까지 통과했다. 기본 세팅 `rule6`은 1b-2와 같은 매치다.
   - 고친 파일은 LF로 저장됐다(저장소는 `core.autocrlf=true`라 커밋 때 정규화된다). 별도 코드 리뷰는 하지 않았다.
6. **(실행 중 반영) 실측(2026-10-28).**
   - `rule6`: 턴 제한, 승자 Frost, 120턴. `rule6-traits`: T63 조기 승리, 승자 Ember(둘 다 1b-2와 같다). `rule6-presets` 시드 1: 턴 제한, 승자 Aster(1b-2는 T81 Ember 조기 승리).
   - `rule6-presets` 시드 1 보고서: 제안은 Dune(수비형) 47건·Ember(외교형) 82건뿐이고, 약속 기록은 불가침 성립 9건·동맹 성립 3건·불가침 만료 4건이며, 깬 약속은 0이다.
   - 프리셋 시드 1~8: 무효 명령·확정 수정 0. 조기 승리 2개(시드 4·8), 턴 제한 6개. 약속 깸은 시드 4 Frost 1건, 시드 7 Briar 1건(공격형의 의도된 기습)뿐이다. 성사된 교환은 매치당 자원 교환 0~46건, 포로 교환 1~7건이다.
   - 시드 1~8 평균 순위: Ember(diplomatic) 1.63, Aster(balanced) 2.13, Cobalt(economic) 2.88, Dune(defensive) 3.63, Briar(aggressive) 5.38, Frost(aggressive + 위험 감수 2) 5.38. 1b-2(Ember 3.75)보다 외교형이 크게 올랐다. 자리 위치가 고정이라 프리셋 효과와 섞여 있으므로, 가설 A 판정은 1d의 자리 순환 배치로 한다.

---

**세부 규칙·수치(사용자 확정 2026-10-28).** 결정 기록에 따라 이 계획에서 처음 제안했고, Task를 쓰기 전에 사용자가 제안표대로 확정했다(먼저 제안은 신의 4·5만, 동맹 공동 방어 없음). Task를 쓰며 복제본 실측으로 찾은 세 가지(조약 상대가 먼저 점령한 목표, 동맹 거점의 부상 병력, 적 접근의 동맹)도 사용자가 확정해 표에 넣었다. 수치는 1d 측정으로 조정한다. "현재 수도"는 모두 그 판단 시점의 수도다(L-003). 같은 단계에서 대상이 바뀔 수 있는 규칙은 판단 시점과, 순서와 무관하게 결과가 같은 이유를 적었다(L-004).

#### 관계
| 관계 | 시작 | 효과 |
|---|---|---|
| 중립 `neutral` | 모든 쌍 | 없음 |
| 전쟁 `war` | | 없음(기록, 규칙 참모의 보복 판단) |
| 불가침 `nonAggression` | | 약속일 뿐 게임은 공격을 막지 않는다. 만료 턴 `until`의 외교 정산에서 중립으로 돌아간다 |
| 동맹 `alliance` | | 시야 공유, 서로의 거점 통과·대기. 기간 없음. 공격은 "동맹 공격 금지"가 켜진 쪽만 막힌다 |

- 관계는 두 자리 쌍마다 하나다. 탈락한 자리와의 관계는 그대로 두고 쓰지 않는다.
- 관계가 바뀌는 때는 외교 정산 한 번뿐이다. 그래서 같은 턴의 이동·조건·전투·후퇴 판정은 모두 턴 시작(참모 호출 때)의 관계로 판정한다.
- **기습은 턴 시작에 상대 것이던 거점을 칠 때만 생긴다.** 공격을 정산할 때 목표가 같은 전투 단계에서 불가침·동맹 상대(턴 시작 관계)에게 먼저 넘어갔으면 그 공격은 일어나지 않고 영웅은 제자리에 남는다(목표가 이미 아군이 된 때와 같다). 계획 작성 중 실측에서, 외교형 Ember가 Frost의 거점을 쳤는데 동맹 Dune이 시드 순서상 먼저 점령해 Ember의 공격이 Dune 기습으로 기록된 일이 나왔다. `rule6-presets` 시드 1~8의 약속 깸 36건 중 34건이 이런 순서 운이었고, 이 규칙으로 2건(공격형의 의도된 기습)만 남는다. 동맹 공격 금지도 같은 단계 안에서 지켜진다(L-004, 사용자 확정).

#### 제안 6종
계획에 `proposals?: Proposal[]`, `responses?: { id, accept }[]`를 더한다. 검증은 계획 시점 상태로 하고, 잘못된 항목은 그 항목만 뺀다(1b-1과 같은 항목 단위, 사유 `item: "proposal" | "response"`).

| 제안 `kind` | 형식 | 검증 | 수락되면(외교 정산) |
|---|---|---|---|
| 불가침 `nonAggression` | `{ to, turns }`, turns는 12·24·48 | 관계가 중립·전쟁 | 불가침, `until = 정산 턴 + turns` |
| 동맹 `alliance` | `{ to }` | 관계가 동맹이 아님 | 동맹(불가침에서 올라가면 만료 턴은 없어진다) |
| 자원 교환 `trade` | `{ to, give, get }`, 자원별 0 이상 정수, 두 쪽 합이 모두 0이면 안 됨 | 내 금고 ≥ give | 그때 두 금고가 각자 낼 양 이상이면 맞바꾼다. 아니면 실패(`tradeFailed`) |
| 포로 교환 `prisoners` | `{ to, release, receive, pay, ask }`. release는 내가 잡은 to의 영웅, receive는 to가 잡은 내 영웅, pay·ask는 자원 | 영웅이 하나 이상, 각 영웅의 포로 상태가 맞음, 내 금고 ≥ pay | 그때 포로 상태와 두 금고를 다시 보고 모두 맞으면 한꺼번에 처리, 하나라도 어긋나면 통째로 실패. 풀린 영웅은 지금 석방 규칙(`releasePrisoners`)과 같이 자기 자리의 현재 수도로 가서 활동·병력 0(수도가 없으면 out) |
| 선전포고 `declareWar` | `{ to }`, 일방 통보 | 관계가 전쟁이 아님 | 응답 없이 그 턴 정산에서 전쟁. 불가침·동맹이었으면 파기로도 기록 |
| 파기 `breakTreaty` | `{ to }`, 일방 통보 | 관계가 불가침·동맹 | 응답 없이 그 턴 정산에서 중립 |

- 상대 하나에 턴당 1건(선전포고·파기 포함)이다. 넘는 것은 뒤의 것을 뺀다.
- 제안 id는 `<전달 턴>-<자리>-<계획 안 순번>`이다.
- 응답은 나에게 온 대기 제안 id에만, id당 하나. 응답하지 않은 제안은 다음 외교 정산에서 만료된다(설계서 4절 "다음 정각까지 응답이 없으면 만료").

#### 외교 정산 순서 (회복 뒤, 탈락·종료 앞)
| 단계 | 하는 일 |
|---|---|
| 1 적대 행위 모으기 | 이번 턴 전투(`battle` 사건의 공격 자리 → 방어 거점 주인, 중립 거점 제외)와, 이번 계획의 선전포고·파기 통보를 쌍별로 모은다 |
| 2 응답 정산 | 지난 정산에 전달된 대기 제안을 id 순으로. 거절이면 `rejected`, 무응답이면 `expired`. 수락이면: 그 쌍에 1의 적대 행위가 있으면 무효(`voided: hostile`), 지금 관계로는 성립할 수 없으면 무효(`voided: stale`, 예: 앞 id의 수락으로 이미 동맹), 자원·포로가 안 맞으면 실패, 아니면 성립 |
| 3 적대 행위 적용 | 쌍마다 전투나 선전포고가 있으면 전쟁, 그것 없이 파기만 있으면 중립. 불가침·동맹을 깬 쪽은 약속 기록에 남는다(공격이면 `attack`, 선전포고면 `war`, 파기면 `break`. 서로 쳤으면 둘 다) |
| 4 불가침 만료 | `until ≤ 지금 턴`이면 중립(`expired`) |
| 5 귀환 | 동맹이 아닌 자리의 거점에 서 있는 영웅(활동·부상)은 병력을 그대로 데리고 가장 가까운 아군 거점(맵 거리, 동률은 id)으로 돌아간다(`heroReturned`). 아군 거점이 없으면 그대로 두고 탈락 판정에 맡긴다 |
| 6 새 제안 전달 | 이번 계획의 제안(선전포고·파기 제외)을 대기 목록에 넣는다(`proposalDelivered`). 받을 자리가 이번 턴에 거점 0이면 넣지 않는다 |

- 거점이 0인 자리(곧 탈락)의 수락은 무효이고 그 자리의 제안은 전달하지 않는다.
- 순서와 결과: 수락은 같은 쌍의 적대 행위가 있으면 무효이므로 2와 3의 순서가 결과를 바꾸지 않는다. 3은 쌍마다 "전투·선전포고 → 전쟁, 아니면 파기 → 중립"으로 한 번에 정해진다. 2 안에서 순서가 결과를 바꾸는 곳(금고가 두 거래에 모자람, 같은 쌍의 두 수락)은 시드가 아닌 제안 id 순으로 고정한다.
- 성립한 조약의 효과(시야·통과·안전장치)는 다음 참모 호출부터 쓰인다.

#### 동맹 통과와 공동 방어
| 항목 | 제안 |
|---|---|
| 이동 | 이동 임무의 목적지는 아군 또는 동맹(계획 시점) 거점이다 |
| 동맹 거점에 선 영웅 | 병력을 꺼내지 않는다(남의 수비대에서 꺼내지 않음, 이동·공격의 `draw`는 0으로 처리). 운영은 검증에서 뺀다. 방어 임무는 그 자리에서 대기한다. 이웃으로 이동·공격은 된다 |
| 공동 방어 | 하지 않는다. 방어자는 지금처럼 거점 주인의 영웅뿐이다. 그 거점이 함락되면 지금 규칙대로 이웃 아군 거점으로 후퇴하거나 포로가 된다 |
| 전투 끝 판정 | 남의 거점에 서 있어도 그 주인과 동맹이면 후퇴하지 않는다. 관계는 턴 시작 기준이다(정산 전) |
| 동맹이 끝나면 | 외교 정산 5단계의 귀환. 파기한 쪽이 상대 영웅을 가두는 일이 없게 손실·포로 없이 돌려보낸다 |
| 부상 | 동맹 거점에서 공격에 져 부상하면 병력은 사라진다(남의 수비대에 넣지 않는다, 지금 부상 규칙 그대로, 사용자 확정) |
| 조건부 명령 | 조건·반응의 "아군 거점"은 지금처럼 자기 거점만이다. "적 접근"은 동맹(턴 시작 관계)의 영웅을 세지 않는다(불가침 상대는 센다, 사용자 확정) |

#### 안전장치·확정
- `confirmPlan`에 넷째 제약 `noAllyAttack`을 더한다. 순서는 수도 방어 전담 → 원정 불허 → **동맹 공격 금지** → 수도 최소 수비(꺼내기 계산은 임무 종류를 고친 뒤).
- 공격 목표의 주인이 확정 시점에 동맹이면 방어로 고친다. 진격 반응의 거점이 그러면 조건만 뺀다.
- 같은 계획의 파기는 그 턴 정산에서 효력이 생기므로, 이번 턴 공격은 막히고 다음 턴부터 칠 수 있다(설계서 4절).

#### 시야(`SeatView`)에 더하는 것
| 항목 | 내용 |
|---|---|
| `relations` | 다른 자리마다 나와의 관계와 불가침 만료 턴 |
| `incoming` | 나에게 온 대기 제안(응답할 것) |
| `outgoing` | 내가 낸 대기 제안 |
| `promises` | 약속 기록 전체(모두에게 공개). 조약 성립·만료·파기(누가, 어떻게)·선전포고 |
| 동맹 시야 | 보이는 거점 = 내 시야 ∪ 지금 동맹들의 시야(동맹의 동맹은 아님). 동맹의 영웅도 남의 영웅처럼 특성·경험치·성장 계수·상시 명령을 숨긴다 |

- 자원 교환·포로 교환·거절은 공개 약속 기록에 넣지 않는다(두 자리만의 일). 1b-3에서는 지난 턴 사건이 시야에 없으므로 결과는 금고·포로 상태로만 보인다.

#### 규칙 참모의 외교
| 상황 | 규칙 | `balanced`(신의 3·보복 3) |
|---|---|---|
| 공격 목표에서 빼는 상대 | 신의 3~5: 불가침·동맹 상대의 거점 / 2: 동맹 상대만 / 1: 빼지 않음(기습). 동맹 공격 금지가 켜져 있으면 동맹 상대는 늘 뺀다 | 불가침·동맹 |
| 보복 | 보복 4·5: 나와 전쟁 중인 자리의 거점을 목표 정렬 맨 앞에 둔다(희귀 우선보다 앞). 1~3: 정렬에 쓰지 않는다 | 안 씀 |
| 불가침 제안 | 신의 4·5이고 공격성 1~3: 국경을 맞댄(내 거점의 보이는 이웃 거점 주인) 중립·전쟁 상대 중 내 대기 제안이 없는 자리 하나(거점 수 많은 순, 동률 id)에게 24턴. 턴당 1건 | 안 함 |
| 동맹 제안 | 신의 5: 불가침 중인 상대 하나(거점 수 많은 순)에게. 턴당 1건 | 안 함 |
| 자원 교환 제안 | 신의 4·5이고 식량이 예상 유지비 × 식량 자제 턴 수보다 적고 금이 40 이상: 불가침·동맹 상대 중 id가 가장 작은 자리에게 금 20 → 식량 20. 턴당 1건 | 안 함 |
| 포로 교환 제안 | 신의 4·5: 내가 잡은 X의 포로와 X가 잡은 내 영웅이 있으면 같은 수만큼(id 순) 맞교환. 맞교환할 것이 없으면 내가 잡은 포로 하나(id 순)를 금 `10 × 레벨`에 돌려주겠다고 제안. 턴당 1건 | 안 함 |
| 받은 불가침 | 수락. 단 제안자와 전쟁 중이고 보복 4·5면 거절 | 수락 |
| 받은 동맹 | 신의 3~5면 수락. 단 제안자와 전쟁 중이고 보복 4·5면 거절 | 수락 |
| 받은 자원 교환 | 받는 양 합 ≥ 주는 양 합이고, 주고 나서 각 자원이 시작 금고(금 50·식량 50·자재 20·희귀 0) 이상 남으면 수락 | 같음 |
| 받은 포로 교환 | 돌려받는 내 영웅 수 ≥ 내주는 포로 수이고, 낼 자원이 위 금고 기준을 지키면 수락 | 같음 |
| 선전포고·파기 | 하지 않는다 | |

- 프리셋별로 보면 외교형(신의 5·보복 1)은 불가침→동맹을 제안하고, 수비형(신의 4·보복 3)은 불가침만 제안한다. 공격형(신의 2·보복 4)은 불가침을 받아 놓고 그 상대도 치므로(기습) 약속 기록에 파기가 쌓이고, 전쟁 상대를 먼저 노린다. 내정형·균형은 응답만 한다.
- 규칙 참모는 동맹 거점을 지나가지 않는다(이동 경로는 지금처럼 아군 거점만). 통과는 LLM 참모(1c)가 쓴다.

#### 기록·보고서
| 항목 | 제안 |
|---|---|
| 기록 | `version: 4`. 턴 기록의 계획에 제안·응답이 들어가고, 외교 사건은 이벤트 목록에 들어간다 |
| 보고서 | 외교 절: 자리별 제안·수락·거절·만료·무효 수, 교환 성사·실패 수, 약속 기록 표(턴·종류·자리·깬 쪽), 마지막 관계 표 |
| 실행 설정 | 새 설정 없음. `rule6-presets`(외교형·수비형·공격형이 섞임)에서 외교가 일어난다 |
| 회귀 | `rule6` 시드 1~8이 1b-2와 같은 매치다(종료·턴·승자·순위, 외교 사건을 뺀 사건·지표 해시) |

**실행 주체:** 모든 단계를 에이전트가 실행한다(공통 G-004). 명령은 모두 `D:/game/proxywar`에서 실행한다.

**브랜치·커밋:** 실행 시작 때 사용자에게 묻는다. 승인되면 `sim-core-1b-3` 브랜치를 만들고, 첫 커밋으로 설계 문서(결정 기록·AGENTS.md·이 계획)를 넣은 뒤 Task마다 끝에서 커밋한다. push·main 머지는 하지 않는다. 검증 출력은 실제로 읽고 Expected와 대조한 뒤에만 다음 단계로 간다(공통 G-006).

**기준선(2026-10-28 확인):** `npm test` → `Test Files  20 passed`, `Tests  218 passed`. `npm run typecheck` → 오류 없음.

---

## 파일 구조

```
packages/core/
  src/types.ts                   Modify: 관계·제안·응답·약속 기록·외교 상태, 계획의 제안·응답 칸, 외교 사건
  src/data/balance.json          Modify: 불가침 기간 선택지
  src/state.ts                   Modify: 외교 상태 초기값
  src/relations.ts               Create: relationOf, allied, setRelation
  src/resources.ts               Create: 자원 양 검증·합계·지불 가능·옮기기
  src/orders.ts                  Modify: 제안·응답 검증, 동맹 거점 이동, 운영은 아군 거점에서만, isPrisoner
  src/rules/movement.ts          Modify: 동맹 거점에서는 꺼내지 않음
  src/rules/combat.ts            Modify: 동맹 거점 영웅은 후퇴하지 않음, 조약 상대가 먼저 점령한 목표는 치지 않음
  src/rules/conditions.ts        Modify: 적 접근에서 동맹 제외
  src/rules/heroes.ts            Modify: freeHero(포로 하나 석방)
  src/rules/diplomacy.ts         Create: resolveDiplomacy(외교 정산)
  src/rules/turn.ts              Modify: 회복 뒤 외교 정산
  src/confirm.ts                 Modify: 동맹 공격 금지
  src/view.ts                    Modify: 관계·대기 제안·약속 기록, 동맹 시야
  src/staff/rule-staff.ts        Modify: 목표에서 조약 상대 빼기, 보복, 제안·응답
  src/index.ts                   Modify: 관계 도우미 공개
  test/relations.test.ts         Create
  test/diplomacy.test.ts         Create
  test/{orders,movement,combat,conditions,confirm,view,rule-staff}.test.ts   Modify
packages/sim/
  src/runner.ts                  Modify: 기록 version 4
  src/report.ts                  Modify: 외교 절
  test/regression.test.ts        Modify: 해시에서 외교 사건 제외
  test/runner.test.ts            Modify
  test/report.test.ts            Modify
```

테스트 수는 Task마다 Expected에 적었다. 기준선 218개에서 Task 9 끝에 268개(core 251, sim 17)가 된다. 계획의 코드는 작성 때 저장소 복제본에 Task 순서로 적용해 Task마다 테스트·타입 검사를 통과시킨 것이고, Expected 수치는 그 실행에서 읽은 값이다.

---

### Task 1: 회귀 해시에서 외교 사건 빼기와 브랜치

**Files:**
- Modify: `packages/sim/test/regression.test.ts`

- [ ] **Step 1: 브랜치·커밋 여부를 사용자에게 묻는다**

제안표는 계획을 쓰기 전에 확정됐고 결정 기록에도 들어갔다. 브랜치·커밋이 승인되면:
```bash
git -C D:/game/proxywar switch -c sim-core-1b-3
git -C D:/game/proxywar add AGENTS.md docs/design/brainstorm-log.md docs/superpowers/plans/2026-10-28-sim-core-1b-3-diplomacy.md
git -C D:/game/proxywar commit -m "docs: 1b-3 외교 계획과 세부 규칙 확정"
```
Expected: `Switched to a new branch 'sim-core-1b-3'`, 커밋 1개(파일 3개).

- [ ] **Step 2: 회귀 테스트의 해시에서 외교 사건을 뺀다**

전투가 있으면 Task 5부터 `relationChanged` 사건이 생긴다. 매치는 그대로이므로 해시에서 외교 사건 종류를 뺀다.

`packages/sim/test/regression.test.ts`에서 다음을 찾아

```ts
/**
 * 1b-1 코드(커밋 d86127b)로 뽑은 rule6 시드 1~8의 결과. hash는 턴별 [사건, 지표]의 sha256 앞 16자다.
 * 세팅을 주지 않은 매치(balanced, 수도 최소 수비 3, 상시 명령 없음)는 1b-2에서도 이 매치를 그대로 만든다.
 */
const EXPECTED = [
```

이렇게 바꾼다.

```ts
/**
 * 1b-1 코드(커밋 d86127b)로 뽑은 rule6 시드 1~8의 결과. hash는 턴별 [사건, 지표]의 sha256 앞 16자다.
 * 세팅을 주지 않은 매치(balanced, 수도 최소 수비 3, 상시 명령 없음)는 1b-2·1b-3에서도 이 매치를 그대로 만든다.
 * 1b-3의 외교 사건(전투가 부르는 전쟁 같은)은 매치를 바꾸지 않으므로 해시에서 뺀다.
 */
const DIPLOMACY_EVENTS = new Set(["proposalDelivered", "proposalSettled", "relationChanged", "promise", "heroReturned"]);

const EXPECTED = [
```

`packages/sim/test/regression.test.ts`에서 다음을 찾아

```ts
      .update(JSON.stringify(record.turns.map((t) => [t.events, t.metrics])))
```

이렇게 바꾼다.

```ts
      .update(
        JSON.stringify(record.turns.map((t) => [t.events.filter((e) => !DIPLOMACY_EVENTS.has(e.kind)), t.metrics])),
      )
```

- [ ] **Step 3: 지금 코드에서 통과하는지 본다**

Run: `npm test -- packages/sim/test/regression.test.ts`
Expected: `Tests  8 passed`. 지금은 외교 사건이 없어 해시가 그대로다.

Run: `npm test`
Expected: `Test Files  20 passed`, `Tests  218 passed`.

- [ ] **Step 4: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add packages/sim/test/regression.test.ts
git -C D:/game/proxywar commit -m "test(sim): 회귀 해시에서 외교 사건 제외"
```

이후 모든 Task에서 이 테스트가 깨지면 그 Task가 기본 세팅의 동작을 바꾼 것이다. 기대값을 고치지 말고 원인을 찾는다.

---

### Task 2: 관계 상태와 관계 도우미

**Files:**
- Modify: `packages/core/src/types.ts`, `packages/core/src/state.ts`, `packages/core/src/data/balance.json`, `packages/core/src/index.ts`
- Create: `packages/core/src/relations.ts`
- Test: `packages/core/test/relations.test.ts`(새 파일)

- [ ] **Step 1: 관계 테스트를 쓴다**

`packages/core/test/relations.test.ts`(새 파일):

```ts
import { describe, expect, it } from "vitest";
import { allied, relationOf, setRelation } from "../src/relations";
import { makeState } from "./helpers";

describe("relations", () => {
  it("시작 상태는 모든 쌍이 중립이고 대기 제안·약속 기록이 비어 있다", () => {
    const state = makeState();
    expect(state.diplomacy).toEqual({ relations: [], pending: [], promises: [] });
    expect(relationOf(state, 3, 1)).toEqual({ a: 1, b: 3, kind: "neutral", until: null });
  });

  it("관계는 쌍마다 하나이고 자리 순서와 상관없다", () => {
    const state = makeState();
    setRelation(state, 4, 2, "nonAggression", 30);
    expect(relationOf(state, 2, 4)).toEqual({ a: 2, b: 4, kind: "nonAggression", until: 30 });
    setRelation(state, 2, 4, "alliance");
    expect(state.diplomacy.relations).toEqual([{ a: 2, b: 4, kind: "alliance", until: null }]);
    expect(allied(state, 4, 2)).toBe(true);
    expect(allied(state, 4, 4)).toBe(false);
  });

  it("중립으로 바꾸면 목록에서 빠지고, 목록은 (a, b) 순이다", () => {
    const state = makeState();
    setRelation(state, 5, 0, "war");
    setRelation(state, 1, 0, "war");
    setRelation(state, 3, 2, "alliance");
    expect(state.diplomacy.relations.map((r) => [r.a, r.b])).toEqual([
      [0, 1],
      [0, 5],
      [2, 3],
    ]);
    setRelation(state, 0, 1, "neutral");
    expect(state.diplomacy.relations.map((r) => [r.a, r.b])).toEqual([
      [0, 5],
      [2, 3],
    ]);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm test -- packages/core/test/relations.test.ts`
Expected: FAIL. `Cannot find module '../src/relations'`.

- [ ] **Step 3: 타입·상태·도우미를 더한다**

관계는 중립이 아닌 쌍만 목록에 두고, 없으면 중립으로 본다. 계획의 제안·응답 칸은 선택이라 지금 테스트의 계획은 그대로 맞는다.

`packages/core/src/relations.ts`(새 파일):

```ts
import type { GameState, Relation, RelationKind, SeatId } from "./types";

type WithDiplomacy = Pick<GameState, "diplomacy">;

function pair(x: SeatId, y: SeatId): [SeatId, SeatId] {
  return x < y ? [x, y] : [y, x];
}

/** 두 자리의 관계. 기록이 없으면 중립이다 */
export function relationOf(state: WithDiplomacy, x: SeatId, y: SeatId): Relation {
  const [a, b] = pair(x, y);
  return state.diplomacy.relations.find((r) => r.a === a && r.b === b) ?? { a, b, kind: "neutral", until: null };
}

export function allied(state: WithDiplomacy, x: SeatId, y: SeatId): boolean {
  return x !== y && relationOf(state, x, y).kind === "alliance";
}

/** 관계를 바꾼다. 중립은 목록에서 빼고, 목록은 (a, b) 순을 지킨다 */
export function setRelation(
  state: WithDiplomacy,
  x: SeatId,
  y: SeatId,
  kind: RelationKind,
  until: number | null = null,
): void {
  const [a, b] = pair(x, y);
  const rest = state.diplomacy.relations.filter((r) => !(r.a === a && r.b === b));
  if (kind !== "neutral") rest.push({ a, b, kind, until });
  state.diplomacy.relations = rest.sort((p, q) => p.a - q.a || p.b - q.b);
}
```

`packages/core/src/types.ts`에서 다음을 찾아

```ts
export interface GameState {
  matchSeed: number;
```

이렇게 바꾼다.

```ts
/** 두 자리 사이의 관계. 시작은 중립이고, 공격은 관계와 상관없이 할 수 있다 */
export type RelationKind = "neutral" | "war" | "nonAggression" | "alliance";
export type TreatyKind = "nonAggression" | "alliance";

/** 중립이 아닌 쌍의 관계. a < b */
export interface Relation {
  a: SeatId;
  b: SeatId;
  kind: RelationKind;
  /** 불가침 만료 턴(그 턴의 외교 정산에서 중립이 된다). 그 밖에는 null */
  until: number | null;
}

/** 자원 일부(빠진 자원은 0) */
export type ResourceAmounts = Partial<Resources>;

/** 받은 쪽이 응답하는 제안 */
export type Offer =
  | { kind: "nonAggression"; to: SeatId; turns: number }
  | { kind: "alliance"; to: SeatId }
  | { kind: "trade"; to: SeatId; give: ResourceAmounts; get: ResourceAmounts }
  /** release는 내가 잡은 to의 영웅, receive는 to가 잡은 내 영웅. pay는 내가 내고 ask는 to가 낸다 */
  | { kind: "prisoners"; to: SeatId; release: string[]; receive: string[]; pay: ResourceAmounts; ask: ResourceAmounts };

/** 응답 없이 그 턴 외교 정산에서 효력이 생기는 일방 통보 */
export type Notice = { kind: "declareWar"; to: SeatId } | { kind: "breakTreaty"; to: SeatId };

export type Proposal = Offer | Notice;

/** 전달되어 다음 외교 정산까지 응답을 기다리는 제안. id는 `<전달 턴>-<자리>-<계획 안 순번>` */
export type PendingOffer = Offer & { id: string; from: SeatId };

export interface Response {
  id: string;
  accept: boolean;
}

/** 약속 기록 한 줄(모두에게 공개). seats는 [작은 id, 큰 id] */
export type PromiseEntry =
  | { turn: number; kind: "formed"; treaty: TreatyKind; seats: [SeatId, SeatId] }
  | { turn: number; kind: "expired"; treaty: "nonAggression"; seats: [SeatId, SeatId] }
  | {
      turn: number;
      kind: "broken";
      treaty: TreatyKind;
      seats: [SeatId, SeatId];
      by: SeatId;
      how: "attack" | "war" | "break";
    }
  | { turn: number; kind: "declared"; seats: [SeatId, SeatId]; by: SeatId };

export interface DiplomacyState {
  /** 중립이 아닌 쌍만, (a, b) 순 */
  relations: Relation[];
  pending: PendingOffer[];
  promises: PromiseEntry[];
}

export interface GameState {
  matchSeed: number;
```

`packages/core/src/types.ts`에서 다음을 찾아

```ts
  majority: { seat: SeatId | null; streak: number };
  ended: MatchResult | null;
}
```

이렇게 바꾼다.

```ts
  majority: { seat: SeatId | null; streak: number };
  diplomacy: DiplomacyState;
  ended: MatchResult | null;
}
```

`packages/core/src/types.ts`에서 다음을 찾아

```ts
  builds: Build[];
  /** 다음 호출의 자신에게 남기는 참모 메모 */
```

이렇게 바꾼다.

```ts
  builds: Build[];
  /** 외교 제안·통보(상대 하나에 턴당 1건) */
  proposals?: Proposal[];
  /** 나에게 온 대기 제안에 대한 응답 */
  responses?: Response[];
  /** 다음 호출의 자신에게 남기는 참모 메모 */
```

`packages/core/src/state.ts`에서 다음을 찾아

```ts
    majority: { seat: null, streak: 0 },
    ended: null,
```

이렇게 바꾼다.

```ts
    majority: { seat: null, streak: 0 },
    diplomacy: { relations: [], pending: [], promises: [] },
    ended: null,
```

`packages/core/src/data/balance.json`에서 다음을 찾아

```json
  "combat": {
```

이렇게 바꾼다.

```json
  "diplomacy": { "truceTurns": [12, 24, 48] },
  "combat": {
```

`packages/core/src/index.ts`에서 다음을 찾아

```ts
export { initState } from "./state";
```

이렇게 바꾼다.

```ts
export { allied, relationOf, setRelation } from "./relations";
export { initState } from "./state";
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npm test -- packages/core/test/relations.test.ts`
Expected: `Tests  3 passed`.

Run: `npm test`
Expected: `Test Files  21 passed`, `Tests  221 passed`.

Run: `npm run typecheck`
Expected: 오류 없음.

- [ ] **Step 5: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add packages/core
git -C D:/game/proxywar commit -m "feat(core): 외교 관계 상태와 관계 도우미"
```

---

### Task 3: 제안·응답 검증과 동맹 거점 이동

**Files:**
- Modify: `packages/core/src/orders.ts`
- Create: `packages/core/src/resources.ts`
- Test: `packages/core/test/orders.test.ts`

- [ ] **Step 1: 검증 테스트를 쓴다**

`validatePlan`은 이제 계획에 제안·응답 칸이 없어도 빈 목록으로 돌려준다. 그래서 계획을 그대로 비교하던 두 테스트의 기대값에 빈 목록을 더한다.

`packages/core/test/orders.test.ts`에서 다음을 찾아

```ts
import { validatePlan } from "../src/orders";
import type { Build, BuildingKind, GameState, HeroStatus, Mission, Plan, Recruit } from "../src/types";
```

이렇게 바꾼다.

```ts
import { validatePlan } from "../src/orders";
import { setRelation } from "../src/relations";
import type {
  Build,
  BuildingKind,
  GameState,
  HeroStatus,
  Mission,
  Plan,
  Proposal,
  Recruit,
  ResourceAmounts,
} from "../src/types";
```

`packages/core/test/orders.test.ts`에서 다음을 찾아

```ts
        { node: "f0", building: "walls" },
      ],
    };
    const checked = validatePlan(state, 0, plan);
    expect(checked.issues).toEqual([]);
    expect(checked.plan).toEqual(plan);
```

이렇게 바꾼다.

```ts
        { node: "f0", building: "walls" },
      ],
    };
    const checked = validatePlan(state, 0, plan);
    expect(checked.issues).toEqual([]);
    expect(checked.plan).toEqual({ ...plan, proposals: [], responses: [] });
```

`packages/core/test/orders.test.ts`에서 다음을 찾아

```ts
  it("같은 영웅의 두 번째 임무를 뺀다", () => {
```

이렇게 바꾼다.

```ts
  it("동맹 거점으로는 이동할 수 있고, 운영은 아군 거점에서만 한다", () => {
    const state = makeState();
    state.nodes.f0.owner = 1;
    const move: Mission = { kind: "move", hero: "s0h0", to: "f0" };
    expect(reasons(state, missionsOnly(move))).toEqual(["move target not own"]);
    setRelation(state, 0, 1, "alliance");
    expect(reasons(state, missionsOnly(move))).toEqual([]);
    heroOf(state, "s0h1").location = "f0";
    expect(
      reasons(state, missionsOnly({ kind: "govern", hero: "s0h1" }, { kind: "defend", hero: "s0h2" })),
    ).toEqual(["govern not own node"]);
  });

  it("같은 영웅의 두 번째 임무를 뺀다", () => {
```

`packages/core/test/orders.test.ts`에서 다음을 찾아

```ts
  it("참모 메모는 그대로 넘긴다", () => {
```

이렇게 바꾼다.

```ts
  it("올바른 제안·응답은 그대로 통과한다", () => {
    const state = makeState();
    setRelation(state, 0, 2, "nonAggression", 30);
    setRelation(state, 0, 3, "war");
    Object.assign(heroOf(state, "s1h0"), { status: "captured", captor: 0 });
    Object.assign(heroOf(state, "s0h4"), { status: "captured", captor: 1 });
    state.diplomacy.pending.push({ kind: "alliance", to: 0, id: "0-5-0", from: 5 });
    const plan: Plan = {
      missions: [],
      recruits: [],
      builds: [],
      proposals: [
        { kind: "prisoners", to: 1, release: ["s1h0"], receive: ["s0h4"], pay: {}, ask: { gold: 10 } },
        { kind: "alliance", to: 2 },
        { kind: "nonAggression", to: 3, turns: 24 },
        { kind: "trade", to: 4, give: { gold: 20 }, get: { food: 20 } },
      ],
      responses: [{ id: "0-5-0", accept: true }],
    };
    const checked = validatePlan(state, 0, plan);
    expect(checked.issues).toEqual([]);
    expect(checked.plan).toEqual(plan);
  });

  it.each<[string, Proposal, string]>([
    ["자기 자신", { kind: "alliance", to: 0 }, "unknown seat"],
    ["없는 자리", { kind: "alliance", to: 6 }, "unknown seat"],
    ["탈락한 자리", { kind: "alliance", to: 5 }, "seat eliminated"],
    ["불가침 턴 수", { kind: "nonAggression", to: 1, turns: 10 }, "bad turns"],
    ["불가침 중 불가침", { kind: "nonAggression", to: 2, turns: 12 }, "already at peace"],
    ["동맹 중 동맹", { kind: "alliance", to: 3 }, "already allied"],
    ["음수 자원", { kind: "trade", to: 1, give: { gold: -1 }, get: {} }, "bad amount"],
    ["모르는 자원", { kind: "trade", to: 1, give: { wood: 5 } as ResourceAmounts, get: {} }, "bad amount"],
    ["빈 교환", { kind: "trade", to: 1, give: {}, get: { food: 0 } }, "empty trade"],
    ["금고보다 많이", { kind: "trade", to: 1, give: { gold: 51 }, get: {} }, "cannot afford"],
    [
      "영웅 없는 포로 교환",
      { kind: "prisoners", to: 1, release: [], receive: [], pay: {}, ask: { gold: 5 } },
      "no prisoners",
    ],
    [
      "같은 영웅 두 번",
      { kind: "prisoners", to: 1, release: ["s1h0", "s1h0"], receive: [], pay: {}, ask: {} },
      "duplicate hero",
    ],
    [
      "내 포로가 아님",
      { kind: "prisoners", to: 1, release: ["s1h1"], receive: [], pay: {}, ask: {} },
      "not your prisoner",
    ],
    [
      "상대 포로가 아님",
      { kind: "prisoners", to: 1, release: [], receive: ["s0h0"], pay: {}, ask: {} },
      "not their prisoner",
    ],
    [
      "포로 교환 금고",
      { kind: "prisoners", to: 1, release: ["s1h0"], receive: [], pay: { food: 60 }, ask: {} },
      "cannot afford",
    ],
    ["전쟁 중 선전포고", { kind: "declareWar", to: 4 }, "already at war"],
    ["조약 없는 파기", { kind: "breakTreaty", to: 1 }, "no treaty"],
    ["모르는 제안", { kind: "tribute", to: 1 } as unknown as Proposal, "unknown proposal"],
  ])("잘못된 제안을 뺀다: %s", (_, proposal, reason) => {
    const state = makeState();
    state.seats[5].eliminatedAt = 3;
    setRelation(state, 0, 2, "nonAggression", 30);
    setRelation(state, 0, 3, "alliance");
    setRelation(state, 0, 4, "war");
    Object.assign(heroOf(state, "s1h0"), { status: "captured", captor: 0 });
    expect(reasons(state, { missions: [], recruits: [], builds: [], proposals: [proposal] })).toEqual([reason]);
  });

  it("상대 하나에 턴당 한 건만 받고, 응답은 나에게 온 대기 제안에 한 번만 한다", () => {
    const state = makeState();
    state.diplomacy.pending.push(
      { kind: "alliance", to: 0, id: "0-1-0", from: 1 },
      { kind: "alliance", to: 2, id: "0-1-1", from: 1 },
    );
    const checked = validatePlan(state, 0, {
      missions: [],
      recruits: [],
      builds: [],
      proposals: [
        { kind: "nonAggression", to: 1, turns: 12 },
        { kind: "declareWar", to: 1 },
      ],
      responses: [
        { id: "0-1-0", accept: false },
        { id: "0-1-0", accept: true },
        { id: "0-1-1", accept: true },
        { id: "9-9-9", accept: true },
      ],
    });
    expect(checked.plan.proposals).toEqual([{ kind: "nonAggression", to: 1, turns: 12 }]);
    expect(checked.plan.responses).toEqual([{ id: "0-1-0", accept: false }]);
    expect(checked.issues).toEqual([
      { item: "proposal", index: 1, reason: "one proposal per seat" },
      { item: "response", index: 1, reason: "duplicate response" },
      { item: "response", index: 2, reason: "unknown proposal" },
      { item: "response", index: 3, reason: "unknown proposal" },
    ]);
  });

  it("참모 메모는 그대로 넘긴다", () => {
```

`packages/core/test/orders.test.ts`에서 다음을 찾아

```ts
        when: { trigger: { kind: "allyAttacked", node: "f0" }, react: { kind: "reinforce", node: "f0" } },
      },
    );
    const checked = validatePlan(state, 0, plan);
    expect(checked.issues).toEqual([]);
    expect(checked.plan).toEqual(plan);
```

이렇게 바꾼다.

```ts
        when: { trigger: { kind: "allyAttacked", node: "f0" }, react: { kind: "reinforce", node: "f0" } },
      },
    );
    const checked = validatePlan(state, 0, plan);
    expect(checked.issues).toEqual([]);
    expect(checked.plan).toEqual({ ...plan, proposals: [], responses: [] });
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm test -- packages/core/test/orders.test.ts`
Expected: FAIL. 동맹 거점 이동은 `move target not own`으로 빠지고, 제안·응답은 검증되지 않아 결과에 없으며(잘못된 제안 사유가 `[]`), 계획 비교 두 테스트는 `proposals: []`가 없어 실패한다.

- [ ] **Step 3: 검증을 더한다**

`packages/core/src/resources.ts`(새 파일):

```ts
import type { ResourceAmounts, Resources } from "./types";

export const RESOURCE_KINDS: readonly (keyof Resources)[] = ["gold", "food", "material", "rare"];

/** 아는 자원만 있고 모두 0 이상 정수인가 */
export function validAmounts(amounts: ResourceAmounts): boolean {
  return Object.entries(amounts).every(
    ([kind, value]) => (RESOURCE_KINDS as readonly string[]).includes(kind) && Number.isInteger(value) && value! >= 0,
  );
}

export function totalOf(amounts: ResourceAmounts): number {
  return RESOURCE_KINDS.reduce((sum, kind) => sum + (amounts[kind] ?? 0), 0);
}

/** 금고가 amounts를 낼 수 있는가 */
export function covers(treasury: Resources, amounts: ResourceAmounts): boolean {
  return RESOURCE_KINDS.every((kind) => treasury[kind] >= (amounts[kind] ?? 0));
}

/** from 금고에서 to 금고로 amounts를 옮긴다(covers를 먼저 확인한다) */
export function transfer(from: Resources, to: Resources, amounts: ResourceAmounts): void {
  for (const kind of RESOURCE_KINDS) {
    const amount = amounts[kind] ?? 0;
    from[kind] -= amount;
    to[kind] += amount;
  }
}
```

`packages/core/src/orders.ts`에서 다음을 찾아

```ts
import { BALANCE, BUILDING_KINDS, recruitCap } from "./data/balance";
import { neighbors } from "./map";
import type { Build, GameState, Mission, NodeId, Plan, Recruit, SeatId } from "./types";

export interface PlanIssue {
  item: "mission" | "recruit" | "build";
```

이렇게 바꾼다.

```ts
import { BALANCE, BUILDING_KINDS, recruitCap } from "./data/balance";
import { neighbors } from "./map";
import { allied, relationOf } from "./relations";
import { covers, totalOf, validAmounts } from "./resources";
import type { Build, GameState, Mission, NodeId, Plan, Proposal, Recruit, Response, SeatId } from "./types";

export interface PlanIssue {
  item: "mission" | "recruit" | "build" | "proposal" | "response";
```

`packages/core/src/orders.ts`에서 다음을 찾아

```ts
  return { plan: { missions, recruits, builds, memo: plan.memo }, issues };
}
```

이렇게 바꾼다.

```ts
  const proposals: Proposal[] = [];
  const targeted = new Set<SeatId>();
  (plan.proposals ?? []).forEach((proposal, index) => {
    const reason = proposalIssue(state, seat, proposal, targeted);
    if (reason) {
      issues.push({ item: "proposal", index, reason });
    } else {
      targeted.add(proposal.to);
      proposals.push(proposal);
    }
  });
  const responses: Response[] = [];
  const answered = new Set<string>();
  (plan.responses ?? []).forEach((response, index) => {
    const reason = responseIssue(state, seat, response, answered);
    if (reason) {
      issues.push({ item: "response", index, reason });
    } else {
      answered.add(response.id);
      responses.push(response);
    }
  });
  return { plan: { missions, recruits, builds, proposals, responses, memo: plan.memo }, issues };
}
```

`packages/core/src/orders.ts`에서 다음을 찾아

```ts
  // 활동 중인 영웅은 늘 아군 거점에 서 있으므로 방어·운영에는 더 볼 것이 없다
  if (mission.kind === "defend" || mission.kind === "govern") return null;
```

이렇게 바꾼다.

```ts
  // 활동 중인 영웅은 아군이나 동맹 거점에 서 있으므로 방어에는 더 볼 것이 없다. 운영은 아군 거점에서만 한다
  if (mission.kind === "defend") return null;
  if (mission.kind === "govern") return state.nodes[location].owner === seat ? null : "govern not own node";
```

`packages/core/src/orders.ts`에서 다음을 찾아

```ts
  if (mission.kind === "move" && owner !== seat) return "move target not own";
```

이렇게 바꾼다.

```ts
  if (mission.kind === "move" && owner !== seat && (owner === null || !allied(state, seat, owner))) {
    return "move target not own";
  }
```

`packages/core/src/orders.ts` 끝에 더한다.

```ts
/** 상대 하나에 턴당 1건. 관계는 계획 시점 것으로 본다 */
function proposalIssue(state: GameState, seat: SeatId, p: Proposal, targeted: ReadonlySet<SeatId>): string | null {
  if (!Number.isInteger(p.to) || p.to === seat || state.seats[p.to] === undefined) return "unknown seat";
  if (state.seats[p.to].eliminatedAt !== null) return "seat eliminated";
  if (targeted.has(p.to)) return "one proposal per seat";
  const relation = relationOf(state, seat, p.to).kind;
  const treasury = state.seats[seat].treasury;
  switch (p.kind) {
    case "nonAggression":
      if (!BALANCE.diplomacy.truceTurns.includes(p.turns)) return "bad turns";
      return relation === "neutral" || relation === "war" ? null : "already at peace";
    case "alliance":
      return relation === "alliance" ? "already allied" : null;
    case "trade":
      if (!validAmounts(p.give) || !validAmounts(p.get)) return "bad amount";
      if (totalOf(p.give) + totalOf(p.get) === 0) return "empty trade";
      return covers(treasury, p.give) ? null : "cannot afford";
    case "prisoners":
      if (!validAmounts(p.pay) || !validAmounts(p.ask)) return "bad amount";
      if (p.release.length + p.receive.length === 0) return "no prisoners";
      if (new Set([...p.release, ...p.receive]).size !== p.release.length + p.receive.length) return "duplicate hero";
      if (!p.release.every((id) => isPrisoner(state, id, p.to, seat))) return "not your prisoner";
      if (!p.receive.every((id) => isPrisoner(state, id, seat, p.to))) return "not their prisoner";
      return covers(treasury, p.pay) ? null : "cannot afford";
    case "declareWar":
      return relation === "war" ? "already at war" : null;
    case "breakTreaty":
      return relation === "nonAggression" || relation === "alliance" ? null : "no treaty";
    default:
      return "unknown proposal";
  }
}

/** owner 자리의 영웅 id가 captor에게 잡혀 있는가 */
export function isPrisoner(state: GameState, id: string, owner: SeatId, captor: SeatId): boolean {
  const hero = state.heroes.find((h) => h.id === id);
  return hero !== undefined && hero.seat === owner && hero.status === "captured" && hero.captor === captor;
}

function responseIssue(state: GameState, seat: SeatId, r: Response, answered: ReadonlySet<string>): string | null {
  const offer = state.diplomacy.pending.find((p) => p.id === r.id);
  if (offer === undefined || offer.to !== seat) return "unknown proposal";
  if (answered.has(r.id)) return "duplicate response";
  return typeof r.accept === "boolean" ? null : "bad response";
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npm test -- packages/core/test/orders.test.ts`
Expected: `Tests  60 passed`.

Run: `npm test`
Expected: `Test Files  21 passed`, `Tests  242 passed`. 규칙 참모 계획에는 아직 제안이 없어 회귀 8개도 통과한다.

Run: `npm run typecheck`
Expected: 오류 없음.

- [ ] **Step 5: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add packages/core
git -C D:/game/proxywar commit -m "feat(core): 외교 제안·응답 검증과 동맹 거점 이동"
```

---

### Task 4: 동맹과 이동·전투·조건

**Files:**
- Modify: `packages/core/src/rules/movement.ts`, `packages/core/src/rules/combat.ts`, `packages/core/src/rules/conditions.ts`
- Test: `packages/core/test/movement.test.ts`, `packages/core/test/combat.test.ts`, `packages/core/test/conditions.test.ts`

동맹 거점에 선 영웅은 그 수비대에서 꺼내지 않고, 전투 단계 끝에 후퇴하지 않으며, 그 거점 방어에 끼지 않는다. 목표가 같은 전투 단계에서 불가침·동맹 상대에게 먼저 넘어가면 뒤의 공격은 일어나지 않는다(L-004: 기습 여부가 정산 순서로 갈리지 않게). "적 접근"은 동맹의 영웅을 세지 않는다. 관계는 외교 정산에서만 바뀌므로 이 단계들은 모두 턴 시작의 관계를 본다.

- [ ] **Step 1: 테스트를 쓴다**

`packages/core/test/movement.test.ts`에서 다음을 찾아

```ts
import { resolveMovement } from "../src/rules/movement";
```

이렇게 바꾼다.

```ts
import { setRelation } from "../src/relations";
import { resolveMovement } from "../src/rules/movement";
```

`packages/core/test/movement.test.ts`에서 다음을 찾아

```ts
  it("defend·govern과 임무 없는 영웅은 그대로다", () => {
```

이렇게 바꾼다.

```ts
  it("동맹 거점에 선 영웅은 그 수비대에서 병력을 꺼내지 않는다", () => {
    const state = makeState();
    setRelation(state, 0, 1, "alliance");
    Object.assign(state.nodes.f0, { owner: 1, garrison: 40 });
    Object.assign(heroOf(state, "s0h0"), { location: "f0", troops: 10 });
    const events: GameEvent[] = [];
    resolveMovement(state, new Map<string, Mission>([["s0h0", { kind: "attack", hero: "s0h0", target: "x5", draw: 30 }]]), events);
    expect(heroOf(state, "s0h0").troops).toBe(10);
    expect(state.nodes.f0.garrison).toBe(40);
    expect(events).toEqual([]);
  });

  it("defend·govern과 임무 없는 영웅은 그대로다", () => {
```

`packages/core/test/combat.test.ts`에서 다음을 찾아

```ts
import { createRng } from "../src/rng";
```

이렇게 바꾼다.

```ts
import { setRelation } from "../src/relations";
import { createRng } from "../src/rng";
```

`packages/core/test/combat.test.ts`에서 다음을 찾아

```ts
  it("점령된 거점의 건물은 종류마다 한 레벨씩 내려간다", () => {
```

이렇게 바꾼다.

```ts
  it("동맹 거점에 서 있는 영웅은 전투 단계 끝에 후퇴하지 않고, 동맹이 아니면 후퇴한다", () => {
    const allied = makeState();
    setRelation(allied, 0, 1, "alliance");
    allied.nodes.f0.owner = 1;
    Object.assign(heroOf(allied, "s0h0"), { location: "f0", troops: 20 });
    expect(run(allied)).toEqual([]);
    expect(heroOf(allied, "s0h0")).toMatchObject({ location: "f0", troops: 20 });

    const neutral = makeState();
    neutral.nodes.f0.owner = 1;
    Object.assign(heroOf(neutral, "s0h0"), { location: "f0", troops: 20 });
    run(neutral);
    expect(heroOf(neutral, "s0h0").location).toBe("c0");
  });

  it("동맹 영웅은 서 있는 동맹 거점 방어에 끼지 않고, 함락되면 이웃 아군 거점으로 후퇴한다", () => {
    const state = makeState();
    setRelation(state, 0, 1, "alliance");
    Object.assign(state.nodes.f0, { owner: 1, garrison: 10 });
    Object.assign(heroOf(state, "s0h0"), { location: "f0", troops: 50 });
    state.nodes.x5.owner = 5;
    Object.assign(heroOf(state, "s5h0"), { location: "x5", troops: 100 });
    const events = run(state, attack("s5h0", "f0"));
    expect(events[0]).toMatchObject({ kind: "battle", node: "f0", defender: 1, defendTroops: 10, winner: "attacker" });
    expect(events).toContainEqual({ kind: "heroRouted", seat: 0, hero: "s0h0", to: "c0", troops: 20 });
    expect(state.nodes.f0.owner).toBe(5);
  });

  it("점령된 거점의 건물은 종류마다 한 레벨씩 내려간다", () => {
```

`packages/core/test/combat.test.ts`에서 다음을 찾아

```ts
  it("점령된 거점의 건물은 종류마다 한 레벨씩 내려간다", () => {
```

이렇게 바꾼다.

```ts
  it("같은 목표를 동맹이 먼저 점령하면 뒤의 공격은 일어나지 않는다(어느 정산 순서에서도)", () => {
    for (let seed = 1; seed <= 8; seed++) {
      const state = makeState();
      setRelation(state, 0, 1, "alliance");
      state.nodes.m0.owner = 0;
      state.nodes.f1.owner = 1;
      Object.assign(state.nodes.x0, { owner: 5, garrison: 0 });
      Object.assign(heroOf(state, "s0h0"), { location: "m0", troops: 50 });
      Object.assign(heroOf(state, "s1h0"), { location: "f1", troops: 50 });
      const events: GameEvent[] = [];
      const missions = new Map([attack("s0h0", "x0"), attack("s1h0", "x0")]);
      resolveCombat(state, missions, createRng(seed, "test"), events);
      const battles = events.filter((e) => e.kind === "battle");
      expect(battles).toHaveLength(1);
      expect(battles[0]).toMatchObject({ node: "x0", defender: 5, winner: "attacker" });
      const loser = state.nodes.x0.owner === 0 ? "s1h0" : "s0h0";
      expect(heroOf(state, loser)).toMatchObject({ location: loser === "s0h0" ? "m0" : "f1", troops: 50 });
    }
  });

  it("점령된 거점의 건물은 종류마다 한 레벨씩 내려간다", () => {
```

`packages/core/test/conditions.test.ts`에서 다음을 찾아

```ts
import { resolveConditions } from "../src/rules/conditions";
```

이렇게 바꾼다.

```ts
import { setRelation } from "../src/relations";
import { resolveConditions } from "../src/rules/conditions";
```

`packages/core/test/conditions.test.ts`에서 다음을 찾아

```ts
  it("대상 거점이 빔 → 진격: 수비대도 지키는 영웅도 없으면 지금 병력으로 공격한다", () => {
```

이렇게 바꾼다.

```ts
  it("동맹 영웅은 적 접근으로 보지 않는다", () => {
    const state = makeState();
    setRelation(state, 0, 5, "alliance");
    state.nodes.f0.owner = 0;
    state.nodes.x5.owner = 5;
    Object.assign(heroOf(state, "s0h0"), { location: "f0", troops: 50 });
    Object.assign(heroOf(state, "s5h0"), { location: "x5", troops: 30 });
    const events: GameEvent[] = [];
    resolveConditions(
      state,
      new Map([defendWhen("s0h0", { trigger: { kind: "enemyNear" }, react: { kind: "retreat" } })]),
      events,
    );
    expect(events).toEqual([]);
    expect(heroOf(state, "s0h0").location).toBe("f0");
  });

  it("대상 거점이 빔 → 진격: 수비대도 지키는 영웅도 없으면 지금 병력으로 공격한다", () => {
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm test -- packages/core/test/movement.test.ts packages/core/test/combat.test.ts packages/core/test/conditions.test.ts`
Expected: FAIL 4개(동맹 거점 꺼내기, 동맹 거점 후퇴, 동맹이 먼저 점령한 목표, 동맹 적 접근). "동맹 영웅은 서 있는 동맹 거점 방어에 끼지 않고…"는 지금 동작 그대로라 처음부터 통과한다.

- [ ] **Step 3: 구현한다**

`packages/core/src/rules/movement.ts`에서 다음을 찾아

```ts
/** 영웅이 서 있는 거점 수비대에서 병력을 꺼낸다(수비대와 통솔 상한까지). */
export function drawTroops(state: GameState, hero: Hero, requested: number, events: GameEvent[]): void {
  const node = state.nodes[hero.location];
  const amount
```

이렇게 바꾼다.

```ts
/** 영웅이 서 있는 아군 거점 수비대에서 병력을 꺼낸다(수비대와 통솔 상한까지). 동맹 거점에서는 꺼내지 않는다. */
export function drawTroops(state: GameState, hero: Hero, requested: number, events: GameEvent[]): void {
  const node = state.nodes[hero.location];
  if (node.owner !== hero.seat) return;
  const amount
```

`packages/core/src/rules/combat.ts`에서 다음을 찾아

```ts
import { compareText, neighbors } from "../map";
import type { Rng } from "../rng";
```

이렇게 바꾼다.

```ts
import { compareText, neighbors } from "../map";
import { allied } from "../relations";
import type { Rng } from "../rng";
```

`packages/core/src/rules/combat.ts`에서 다음을 찾아

```ts
/**
 * 전투 단계 끝: 남의 거점에 서 있는 영웅(활동·부상)은 그 거점 주인에게서 후퇴하거나 포로가 되고
 * (활동이면 부상 판정 포함), 아군 거점에 남은 진 공격 영웅은 부상 판정을 받는다.
 */
function settleAfterCombat(state: GameState, lost: ReadonlySet<string>, rng: Rng, events: GameEvent[]): void {
  for (const hero of state.heroes) {
    if (hero.status !== "active" && hero.status !== "injured") continue;
    const owner = state.nodes[hero.location].owner;
    if (owner !== null && owner !== hero.seat) routHero(state, hero, owner, rng, events);
```

이렇게 바꾼다.

```ts
/**
 * 전투 단계 끝: 남의 거점(동맹 거점 제외)에 서 있는 영웅(활동·부상)은 그 거점 주인에게서 후퇴하거나 포로가 되고
 * (활동이면 부상 판정 포함), 아군·동맹 거점에 남은 진 공격 영웅은 부상 판정을 받는다.
 * 관계는 외교 정산에서만 바뀌므로 여기서는 턴 시작의 관계다.
 */
function settleAfterCombat(state: GameState, lost: ReadonlySet<string>, rng: Rng, events: GameEvent[]): void {
  for (const hero of state.heroes) {
    if (hero.status !== "active" && hero.status !== "injured") continue;
    const owner = state.nodes[hero.location].owner;
    if (owner !== null && owner !== hero.seat && !allied(state, owner, hero.seat)) {
      routHero(state, hero, owner, rng, events);
    }
```

`packages/core/src/rules/combat.ts`에서 다음을 찾아

```ts
import { allied } from "../relations";
```

이렇게 바꾼다.

```ts
import { allied, relationOf } from "../relations";
```

`packages/core/src/rules/combat.ts`에서 다음을 찾아

```ts
 * 후퇴 판정은 끝에 한 번 한다.
 * 그래서 결과가 정산 순서에 따라 갈리지 않는다.
 */
```

이렇게 바꾼다.

```ts
 * 후퇴 판정은 끝에 한 번 한다.
 * 목표가 이번 단계에서 불가침·동맹 상대에게 넘어갔으면 그 공격은 일어나지 않는다(기습은 턴 시작에 상대 것이던 거점을 칠 때만).
 * 그래서 결과가 정산 순서에 따라 갈리지 않는다.
 */
```

`packages/core/src/rules/combat.ts`에서 다음을 찾아

```ts
  const groups = new Map<string, Hero[]>();
```

이렇게 바꾼다.

```ts
  /** 턴 시작의 거점 주인(주인은 전투 단계에서만 바뀐다) */
  const startOwners = Object.fromEntries(Object.values(state.nodes).map((n) => [n.id, n.owner]));
  const groups = new Map<string, Hero[]>();
```

`packages/core/src/rules/combat.ts`에서 다음을 찾아

```ts
    resolveAttack(state, Number(seatText), target, groups.get(key)!, committed, unresolved, lost, rng, events);
```

이렇게 바꾼다.

```ts
    const seat = Number(seatText);
    const owner = state.nodes[target].owner;
    if (owner !== null && owner !== seat && owner !== startOwners[target] && atPeace(state, seat, owner)) {
      for (const hero of groups.get(key)!) unresolved.delete(hero.id);
      continue;
    }
    resolveAttack(state, seat, target, groups.get(key)!, committed, unresolved, lost, rng, events);
```

`packages/core/src/rules/conditions.ts`에서 다음을 찾아

```ts
import { bfs, compareText, neighbors } from "../map";
```

이렇게 바꾼다.

```ts
import { bfs, compareText, neighbors } from "../map";
import { allied } from "../relations";
```

`packages/core/src/rules/conditions.ts`에서 다음을 찾아

```ts
    case "enemyNear":
      return neighbors(state.map, hero.location).some((n) =>
        state.heroes.some((h) => h.seat !== hero.seat && h.status === "active" && h.troops > 0 && h.location === n),
      );
```

이렇게 바꾼다.

```ts
    case "enemyNear":
      // 동맹(턴 시작 관계)의 영웅은 적으로 세지 않는다
      return neighbors(state.map, hero.location).some((n) =>
        state.heroes.some(
          (h) =>
            h.seat !== hero.seat &&
            !allied(state, h.seat, hero.seat) &&
            h.status === "active" &&
            h.troops > 0 &&
            h.location === n,
        ),
      );
```

`packages/core/src/rules/combat.ts` 끝에 더한다.

```ts
function atPeace(state: GameState, x: SeatId, y: SeatId): boolean {
  const kind = relationOf(state, x, y).kind;
  return kind === "nonAggression" || kind === "alliance";
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npm test -- packages/core/test/movement.test.ts packages/core/test/combat.test.ts packages/core/test/conditions.test.ts`
Expected: `Tests  34 passed`(4 + 22 + 8).

Run: `npm test`
Expected: `Test Files  21 passed`, `Tests  247 passed`. 조약이 없는 매치에서는 동작이 그대로라 회귀 8개도 통과한다.

Run: `npm run typecheck`
Expected: 오류 없음.

- [ ] **Step 5: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add packages/core
git -C D:/game/proxywar commit -m "feat(core): 동맹 거점의 꺼내기·후퇴, 조약 상대가 먼저 점령한 목표, 적 접근의 동맹 제외"
```

---

### Task 5: 외교 정산

**Files:**
- Modify: `packages/core/src/types.ts`, `packages/core/src/rules/heroes.ts`, `packages/core/src/rules/turn.ts`
- Create: `packages/core/src/rules/diplomacy.ts`
- Test: `packages/core/test/diplomacy.test.ts`(새 파일)

- [ ] **Step 1: 외교 정산 테스트를 쓴다**

`packages/core/test/diplomacy.test.ts`(새 파일):

```ts
import { describe, expect, it } from "vitest";
import { relationOf, setRelation } from "../src/relations";
import { processTurn } from "../src/rules/turn";
import type { GameEvent, GameState, Mission, Plan } from "../src/types";
import { heroOf, makeState, noOrders } from "./helpers";

/** 자리별 계획 일부만 준 턴 처리 */
function turn(state: GameState, ...entries: [number, Partial<Plan>][]) {
  const orders = noOrders();
  for (const [seat, plan] of entries) orders[seat] = { missions: [], recruits: [], builds: [], ...plan };
  return processTurn(state, orders);
}

/** s0h0(x0, 병력 100)이 자리 1의 f1을 칠 수 있게 두고 그 공격 임무를 돌려준다 */
function frontline(state: GameState): Mission {
  state.nodes.x0.owner = 0;
  state.nodes.f1.owner = 1;
  Object.assign(heroOf(state, "s0h0"), { location: "x0", troops: 100 });
  return { kind: "attack", hero: "s0h0", target: "f1" };
}

function settled(events: GameEvent[]): [string, string, string | undefined][] {
  return events.flatMap((e) => (e.kind === "proposalSettled" ? [[e.id, e.result, e.reason]] : []));
}

describe("외교 정산", () => {
  it("제안은 외교 정산에서 전달되고, 다음 턴의 수락으로 성립한다", () => {
    const first = turn(makeState(), [0, { proposals: [{ kind: "nonAggression", to: 1, turns: 12 }] }]);
    expect(first.state.diplomacy.pending).toEqual([{ kind: "nonAggression", to: 1, turns: 12, id: "1-0-0", from: 0 }]);
    expect(first.events).toContainEqual({ kind: "proposalDelivered", id: "1-0-0", from: 0, to: 1, offer: "nonAggression" });

    const { state, events } = turn(first.state, [1, { responses: [{ id: "1-0-0", accept: true }] }]);
    expect(relationOf(state, 0, 1)).toEqual({ a: 0, b: 1, kind: "nonAggression", until: 14 });
    expect(state.diplomacy.promises).toEqual([{ turn: 2, kind: "formed", treaty: "nonAggression", seats: [0, 1] }]);
    expect(state.diplomacy.pending).toEqual([]);
    expect(settled(events)).toEqual([["1-0-0", "accepted", undefined]]);
    expect(events).toContainEqual({
      kind: "relationChanged",
      seats: [0, 1],
      from: "neutral",
      to: "nonAggression",
      cause: "accepted",
    });
  });

  it("거절과 무응답은 거절·만료로 끝나고 관계는 그대로다", () => {
    const state = makeState();
    state.diplomacy.pending.push(
      { kind: "alliance", to: 1, id: "0-0-0", from: 0 },
      { kind: "alliance", to: 3, id: "0-2-0", from: 2 },
    );
    const { state: next, events } = turn(state, [1, { responses: [{ id: "0-0-0", accept: false }] }]);
    expect(settled(events)).toEqual([
      ["0-0-0", "rejected", undefined],
      ["0-2-0", "expired", undefined],
    ]);
    expect(next.diplomacy).toEqual({ relations: [], pending: [], promises: [] });
  });

  it("같은 쌍에 전투·선전포고·파기가 있으면 그 턴의 수락은 무효다", () => {
    const state = makeState();
    const attack = frontline(state);
    setRelation(state, 4, 5, "nonAggression", 50);
    state.diplomacy.pending.push(
      { kind: "alliance", to: 1, id: "0-0-0", from: 0 },
      { kind: "alliance", to: 3, id: "0-2-0", from: 2 },
      { kind: "alliance", to: 5, id: "0-4-0", from: 4 },
    );
    const { state: next, events } = turn(
      state,
      [0, { missions: [attack] }],
      [1, { responses: [{ id: "0-0-0", accept: true }] }],
      [2, { proposals: [{ kind: "declareWar", to: 3 }] }],
      [3, { responses: [{ id: "0-2-0", accept: true }] }],
      [4, { proposals: [{ kind: "breakTreaty", to: 5 }] }],
      [5, { responses: [{ id: "0-4-0", accept: true }] }],
    );
    expect(settled(events)).toEqual([
      ["0-0-0", "voided", "hostile"],
      ["0-2-0", "voided", "hostile"],
      ["0-4-0", "voided", "hostile"],
    ]);
    expect(next.diplomacy.relations.map((r) => [r.a, r.b, r.kind])).toEqual([
      [0, 1, "war"],
      [2, 3, "war"],
    ]);
  });

  it("불가침·동맹 상대를 친 기습과 선전포고·파기는 깬 쪽을 약속 기록에 남긴다", () => {
    const state = makeState();
    const attack = frontline(state);
    setRelation(state, 0, 1, "nonAggression", 50);
    setRelation(state, 2, 3, "alliance");
    setRelation(state, 4, 5, "alliance");
    const { state: next, events } = turn(
      state,
      [0, { missions: [attack] }],
      [2, { proposals: [{ kind: "declareWar", to: 3 }] }],
      [4, { proposals: [{ kind: "breakTreaty", to: 5 }] }],
    );
    expect(next.diplomacy.promises).toEqual([
      { turn: 1, kind: "broken", treaty: "nonAggression", seats: [0, 1], by: 0, how: "attack" },
      { turn: 1, kind: "broken", treaty: "alliance", seats: [2, 3], by: 2, how: "war" },
      { turn: 1, kind: "declared", seats: [2, 3], by: 2 },
      { turn: 1, kind: "broken", treaty: "alliance", seats: [4, 5], by: 4, how: "break" },
    ]);
    expect(events.filter((e) => e.kind === "relationChanged")).toEqual([
      { kind: "relationChanged", seats: [0, 1], from: "nonAggression", to: "war", cause: "attack" },
      { kind: "relationChanged", seats: [2, 3], from: "alliance", to: "war", cause: "declareWar" },
      { kind: "relationChanged", seats: [4, 5], from: "alliance", to: "neutral", cause: "breakTreaty" },
    ]);
  });

  it("중립 상대를 치면 약속 기록 없이 전쟁이 되고, 이미 전쟁이면 바뀌지 않는다", () => {
    const neutral = makeState();
    const first = turn(neutral, [0, { missions: [frontline(neutral)] }]);
    expect(relationOf(first.state, 0, 1).kind).toBe("war");
    expect(first.state.diplomacy.promises).toEqual([]);
    expect(first.events).toContainEqual({ kind: "relationChanged", seats: [0, 1], from: "neutral", to: "war", cause: "attack" });

    const war = makeState();
    setRelation(war, 0, 1, "war");
    const second = turn(war, [0, { missions: [frontline(war)] }]);
    expect(second.events.some((e) => e.kind === "relationChanged")).toBe(false);
  });

  it("불가침은 만료 턴의 외교 정산에서 중립이 된다", () => {
    const state = makeState();
    setRelation(state, 0, 1, "nonAggression", 1);
    setRelation(state, 2, 3, "nonAggression", 2);
    const { state: next, events } = processTurn(state, noOrders());
    expect(next.diplomacy.relations).toEqual([{ a: 2, b: 3, kind: "nonAggression", until: 2 }]);
    expect(next.diplomacy.promises).toEqual([{ turn: 1, kind: "expired", treaty: "nonAggression", seats: [0, 1] }]);
    expect(events).toContainEqual({
      kind: "relationChanged",
      seats: [0, 1],
      from: "nonAggression",
      to: "neutral",
      cause: "expired",
    });
  });

  it("자원 교환은 두 금고가 될 때 맞바꾸고, 모자라면 실패한다", () => {
    const state = makeState();
    state.diplomacy.pending.push(
      { kind: "trade", to: 1, give: { gold: 20 }, get: { food: 30 }, id: "0-0-0", from: 0 },
      { kind: "trade", to: 3, give: { gold: 100 }, get: {}, id: "0-2-0", from: 2 },
    );
    const base = processTurn(state, noOrders()).state;
    const { state: next, events } = turn(
      state,
      [1, { responses: [{ id: "0-0-0", accept: true }] }],
      [3, { responses: [{ id: "0-2-0", accept: true }] }],
    );
    const diff = (seat: number) => ({
      gold: next.seats[seat].treasury.gold - base.seats[seat].treasury.gold,
      food: next.seats[seat].treasury.food - base.seats[seat].treasury.food,
    });
    expect([diff(0), diff(1), diff(2), diff(3)]).toEqual([
      { gold: -20, food: 30 },
      { gold: 20, food: -30 },
      { gold: 0, food: 0 },
      { gold: 0, food: 0 },
    ]);
    expect(settled(events)).toEqual([
      ["0-0-0", "accepted", undefined],
      ["0-2-0", "failed", "unaffordable"],
    ]);
  });

  it("포로 교환은 풀린 영웅을 각자의 현재 수도로 보내고 자원을 옮기며, 포로 상태가 바뀌었으면 실패한다", () => {
    const setup = (): GameState => {
      const state = makeState();
      Object.assign(heroOf(state, "s1h0"), { status: "captured", captor: 0 });
      Object.assign(heroOf(state, "s0h4"), { status: "captured", captor: 1 });
      state.diplomacy.pending.push({
        kind: "prisoners",
        to: 1,
        release: ["s1h0"],
        receive: ["s0h4"],
        pay: {},
        ask: { gold: 10 },
        id: "0-0-0",
        from: 0,
      });
      return state;
    };
    const accept: [number, Partial<Plan>] = [1, { responses: [{ id: "0-0-0", accept: true }] }];
    const state = setup();
    const base = processTurn(state, noOrders()).state;
    const { state: next, events } = turn(state, accept);
    expect(heroOf(next, "s1h0")).toMatchObject({ status: "active", location: "c1", captor: null, troops: 0 });
    expect(heroOf(next, "s0h4")).toMatchObject({ status: "active", location: "c0", captor: null, troops: 0 });
    expect(next.seats[0].treasury.gold - base.seats[0].treasury.gold).toBe(10);
    expect(next.seats[1].treasury.gold - base.seats[1].treasury.gold).toBe(-10);
    expect(events).toContainEqual({ kind: "heroReleased", seat: 1, hero: "s1h0", to: "c1" });
    expect(events).toContainEqual({ kind: "heroReleased", seat: 0, hero: "s0h4", to: "c0" });

    const moved = setup();
    Object.assign(heroOf(moved, "s0h4"), { status: "active", captor: null });
    const failed = turn(moved, accept);
    expect(settled(failed.events)).toEqual([["0-0-0", "failed", "prisoner"]]);
    expect(heroOf(failed.state, "s1h0").status).toBe("captured");
  });

  it("같은 쌍의 두 수락은 id 순으로 정산하고, 이미 성립한 관계의 수락은 무효다", () => {
    const state = makeState();
    state.diplomacy.pending.push(
      { kind: "nonAggression", to: 1, turns: 12, id: "0-0-0", from: 0 },
      { kind: "nonAggression", to: 0, turns: 48, id: "0-1-0", from: 1 },
    );
    const { state: next, events } = turn(
      state,
      [0, { responses: [{ id: "0-1-0", accept: true }] }],
      [1, { responses: [{ id: "0-0-0", accept: true }] }],
    );
    expect(settled(events)).toEqual([
      ["0-0-0", "accepted", undefined],
      ["0-1-0", "voided", "stale"],
    ]);
    expect(relationOf(next, 0, 1)).toMatchObject({ kind: "nonAggression", until: 13 });
  });

  it("동맹이 끝나면 상대 거점에 있던 영웅은 병력을 그대로 데리고 가장 가까운 아군 거점으로 돌아간다", () => {
    const state = makeState();
    setRelation(state, 0, 1, "alliance");
    state.nodes.x0.owner = 0;
    state.nodes.f1.owner = 1;
    Object.assign(heroOf(state, "s0h0"), { location: "f1", troops: 30 });
    const { state: next, events } = turn(state, [1, { proposals: [{ kind: "breakTreaty", to: 0 }] }]);
    expect(heroOf(next, "s0h0")).toMatchObject({ status: "active", location: "x0", troops: 30 });
    expect(events).toContainEqual({ kind: "heroReturned", seat: 0, hero: "s0h0", from: "f1", to: "x0" });
  });

  it("거점이 0인 자리의 수락은 무효이고, 그 자리와는 제안을 주고받지 않는다", () => {
    const state = makeState();
    state.nodes.c5.owner = 4;
    state.diplomacy.pending.push({ kind: "alliance", to: 5, id: "0-4-0", from: 4 });
    const { state: next, events } = turn(
      state,
      [0, { proposals: [{ kind: "alliance", to: 5 }] }],
      [5, { responses: [{ id: "0-4-0", accept: true }], proposals: [{ kind: "alliance", to: 0 }] }],
    );
    expect(settled(events)).toEqual([["0-4-0", "voided", "gone"]]);
    expect(next.diplomacy.pending).toEqual([]);
    expect(next.seats[5].eliminatedAt).toBe(1);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm test -- packages/core/test/diplomacy.test.ts`
Expected: FAIL 11개. 턴 처리에 외교 정산이 없어 제안이 전달되지 않고 관계도 바뀌지 않는다.

- [ ] **Step 3: 외교 사건 타입, 포로 하나 석방, 외교 정산을 더한다**

`packages/core/src/rules/diplomacy.ts`(새 파일):

```ts
import { bfs, compareText } from "../map";
import { isPrisoner } from "../orders";
import { allied, relationOf, setRelation } from "../relations";
import { covers, transfer } from "../resources";
import { ownedNodes } from "../summary";
import type {
  GameEvent,
  GameState,
  Orders,
  PendingOffer,
  PromiseEntry,
  RelationKind,
  SeatId,
  SettleReason,
} from "../types";
import { freeHero } from "./heroes";

type Pair = [SeatId, SeatId];
type Alive = (seat: SeatId) => boolean;

/** 쌍 하나의 이번 턴 적대 행위 */
interface Hostility {
  pair: Pair;
  /** 상대 거점을 친(전투가 일어난) 자리 */
  attackers: Set<SeatId>;
  /** 선전포고한 자리 */
  declarers: Set<SeatId>;
  /** 파기한 자리 */
  breakers: Set<SeatId>;
}

function pairOf(x: SeatId, y: SeatId): Pair {
  return x < y ? [x, y] : [y, x];
}

function keyOf([a, b]: Pair): string {
  return `${a}-${b}`;
}

/**
 * 외교 정산(회복 뒤, 탈락·종료 앞). 관계는 여기서만 바뀐다.
 * 적대 행위 모으기 → 응답 정산 → 적대 행위 적용 → 불가침 만료 → 귀환 → 새 제안 전달.
 * 적대 행위가 있는 쌍의 수락은 무효이므로 응답 정산과 적대 행위 적용의 순서가 결과를 바꾸지 않는다.
 * 응답 정산 안의 순서(같은 금고를 쓰는 두 거래, 같은 쌍의 두 수락)는 시드가 아닌 제안 id 순으로 고정한다.
 * 거점이 0인 자리(이번 턴 끝에 탈락)의 수락은 무효이고 그 자리와는 제안을 주고받지 않는다.
 */
export function resolveDiplomacy(state: GameState, orders: Orders, events: GameEvent[]): void {
  const alive: Alive = (seat) => state.seats[seat].eliminatedAt === null && ownedNodes(state, seat).length > 0;
  const hostile = collectHostility(state, orders, events);
  settleOffers(state, orders, hostile, alive, events);
  applyHostility(state, hostile, events);
  expireTruces(state, events);
  returnHeroes(state, events);
  deliverOffers(state, orders, alive, events);
}

/** 이번 턴 전투(중립 거점 제외)와 선전포고·파기 통보를 쌍별로 모은다 */
function collectHostility(state: GameState, orders: Orders, events: readonly GameEvent[]): Map<string, Hostility> {
  const hostile = new Map<string, Hostility>();
  const add = (by: SeatId, other: SeatId, act: "attackers" | "declarers" | "breakers"): void => {
    const pair = pairOf(by, other);
    const entry = hostile.get(keyOf(pair)) ?? { pair, attackers: new Set(), declarers: new Set(), breakers: new Set() };
    entry[act].add(by);
    hostile.set(keyOf(pair), entry);
  };
  for (const e of events) {
    if (e.kind === "battle" && e.defender !== null) add(e.attacker, e.defender, "attackers");
  }
  orders.forEach((plan, seat) => {
    if (state.seats[seat]?.eliminatedAt !== null) return;
    for (const p of plan.proposals ?? []) {
      if (p.kind === "declareWar") add(seat, p.to, "declarers");
      else if (p.kind === "breakTreaty") add(seat, p.to, "breakers");
    }
  });
  return hostile;
}

/** 지난 정산에 전달된 제안을 id 순으로 정산하고 대기 목록을 비운다 */
function settleOffers(
  state: GameState,
  orders: Orders,
  hostile: ReadonlyMap<string, Hostility>,
  alive: Alive,
  events: GameEvent[],
): void {
  const answers = new Map<string, boolean>();
  orders.forEach((plan, seat) => {
    if (state.seats[seat]?.eliminatedAt !== null) return;
    for (const r of plan.responses ?? []) answers.set(r.id, r.accept);
  });
  for (const offer of state.diplomacy.pending) {
    const settle = (result: "accepted" | "rejected" | "expired" | "voided" | "failed", reason?: SettleReason) =>
      events.push({
        kind: "proposalSettled",
        id: offer.id,
        from: offer.from,
        to: offer.to,
        offer: offer.kind,
        result,
        ...(reason === undefined ? {} : { reason }),
      });
    const answer = answers.get(offer.id);
    if (answer === undefined) {
      settle("expired");
    } else if (!answer) {
      settle("rejected");
    } else if (!alive(offer.from) || !alive(offer.to)) {
      settle("voided", "gone");
    } else if (hostile.has(keyOf(pairOf(offer.from, offer.to)))) {
      settle("voided", "hostile");
    } else {
      const blocked = blockOf(state, offer);
      if (blocked !== null) {
        settle(blocked.result, blocked.reason);
      } else {
        settle("accepted");
        applyOffer(state, offer, events);
      }
    }
  }
  state.diplomacy.pending = [];
}

/** 지금 상태에서 수락을 성립시킬 수 없는 이유 */
function blockOf(state: GameState, offer: PendingOffer): { result: "voided" | "failed"; reason: SettleReason } | null {
  const relation = relationOf(state, offer.from, offer.to).kind;
  const from = state.seats[offer.from].treasury;
  const to = state.seats[offer.to].treasury;
  switch (offer.kind) {
    case "nonAggression":
      return relation === "neutral" || relation === "war" ? null : { result: "voided", reason: "stale" };
    case "alliance":
      return relation === "alliance" ? { result: "voided", reason: "stale" } : null;
    case "trade":
      return covers(from, offer.give) && covers(to, offer.get) ? null : { result: "failed", reason: "unaffordable" };
    case "prisoners": {
      const held =
        offer.release.every((id) => isPrisoner(state, id, offer.to, offer.from)) &&
        offer.receive.every((id) => isPrisoner(state, id, offer.from, offer.to));
      if (!held) return { result: "failed", reason: "prisoner" };
      return covers(from, offer.pay) && covers(to, offer.ask) ? null : { result: "failed", reason: "unaffordable" };
    }
  }
}

function applyOffer(state: GameState, offer: PendingOffer, events: GameEvent[]): void {
  const from = state.seats[offer.from].treasury;
  const to = state.seats[offer.to].treasury;
  switch (offer.kind) {
    case "nonAggression":
    case "alliance": {
      const until = offer.kind === "nonAggression" ? state.turn + offer.turns : null;
      changeRelation(state, offer.from, offer.to, offer.kind, "accepted", events, until);
      record(state, { turn: state.turn, kind: "formed", treaty: offer.kind, seats: pairOf(offer.from, offer.to) }, events);
      return;
    }
    case "trade":
      transfer(from, to, offer.give);
      transfer(to, from, offer.get);
      return;
    case "prisoners":
      transfer(from, to, offer.pay);
      transfer(to, from, offer.ask);
      for (const id of [...offer.release, ...offer.receive]) {
        freeHero(state, state.heroes.find((h) => h.id === id)!, events);
      }
      return;
  }
}

/**
 * 쌍마다 전투나 선전포고가 있으면 전쟁, 그것 없이 파기만 있으면 중립. 불가침·동맹을 깬 쪽은 약속 기록에 남는다.
 * 쌍마다 한 번에 정해지므로 쌍 안의 행위 순서는 결과를 바꾸지 않는다.
 */
function applyHostility(state: GameState, hostile: ReadonlyMap<string, Hostility>, events: GameEvent[]): void {
  const turn = state.turn;
  const sorted = [...hostile.values()].sort((p, q) => p.pair[0] - q.pair[0] || p.pair[1] - q.pair[1]);
  const bySeat = (seats: ReadonlySet<SeatId>): SeatId[] => [...seats].sort((x, y) => x - y);
  for (const { pair, attackers, declarers, breakers } of sorted) {
    const before = relationOf(state, pair[0], pair[1]).kind;
    if (before === "nonAggression" || before === "alliance") {
      const acts = [
        ["attack", attackers],
        ["war", declarers],
        ["break", breakers],
      ] as const;
      for (const [how, seats] of acts) {
        for (const by of bySeat(seats)) {
          record(state, { turn, kind: "broken", treaty: before, seats: pair, by, how }, events);
        }
      }
    }
    for (const by of bySeat(declarers)) record(state, { turn, kind: "declared", seats: pair, by }, events);
    const war = attackers.size > 0 || declarers.size > 0;
    const next: RelationKind = war ? "war" : "neutral";
    if (next === before) continue;
    const cause = attackers.size > 0 ? "attack" : war ? "declareWar" : "breakTreaty";
    changeRelation(state, pair[0], pair[1], next, cause, events);
  }
}

/** 만료 턴이 된 불가침은 중립으로 */
function expireTruces(state: GameState, events: GameEvent[]): void {
  for (const r of [...state.diplomacy.relations]) {
    if (r.kind !== "nonAggression" || r.until === null || r.until > state.turn) continue;
    record(state, { turn: state.turn, kind: "expired", treaty: "nonAggression", seats: [r.a, r.b] }, events);
    changeRelation(state, r.a, r.b, "neutral", "expired", events);
  }
}

/**
 * 동맹이 아닌 자리의 거점에 서 있는 영웅(활동·부상, 동맹이 끝난 쪽)은 병력을 그대로 데리고
 * 가장 가까운 아군 거점(맵 거리, 동률은 id)으로 돌아간다. 아군 거점이 없으면 탈락 판정에 맡긴다.
 */
function returnHeroes(state: GameState, events: GameEvent[]): void {
  for (const hero of state.heroes) {
    if (hero.status !== "active" && hero.status !== "injured") continue;
    const owner = state.nodes[hero.location].owner;
    if (owner === null || owner === hero.seat || allied(state, owner, hero.seat)) continue;
    const { dist } = bfs(state.map, hero.location);
    const home = ownedNodes(state, hero.seat).sort((a, b) => dist[a] - dist[b] || compareText(a, b))[0];
    if (home === undefined) continue;
    events.push({ kind: "heroReturned", seat: hero.seat, hero: hero.id, from: hero.location, to: home });
    hero.location = home;
  }
}

/** 이번 계획의 제안(통보 제외)을 대기 목록에 넣는다. 다음 정산까지 응답이 없으면 만료된다 */
function deliverOffers(state: GameState, orders: Orders, alive: Alive, events: GameEvent[]): void {
  orders.forEach((plan, seat) => {
    if (state.seats[seat] === undefined || !alive(seat)) return;
    (plan.proposals ?? []).forEach((p, index) => {
      if (p.kind === "declareWar" || p.kind === "breakTreaty" || !alive(p.to)) return;
      const offer: PendingOffer = { ...p, id: `${state.turn}-${seat}-${index}`, from: seat };
      state.diplomacy.pending.push(offer);
      events.push({ kind: "proposalDelivered", id: offer.id, from: seat, to: p.to, offer: p.kind });
    });
  });
}

function changeRelation(
  state: GameState,
  x: SeatId,
  y: SeatId,
  kind: RelationKind,
  cause: "accepted" | "attack" | "declareWar" | "breakTreaty" | "expired",
  events: GameEvent[],
  until: number | null = null,
): void {
  const from = relationOf(state, x, y).kind;
  setRelation(state, x, y, kind, until);
  events.push({ kind: "relationChanged", seats: pairOf(x, y), from, to: kind, cause });
}

function record(state: GameState, entry: PromiseEntry, events: GameEvent[]): void {
  state.diplomacy.promises.push(entry);
  events.push({ kind: "promise", entry });
}
```

`packages/core/src/types.ts`에서 다음을 찾아

```ts
export interface DiplomacyState {
```

이렇게 바꾼다.

```ts
/** 수락했지만 성립하지 못한 이유 */
export type SettleReason = "hostile" | "stale" | "gone" | "unaffordable" | "prisoner";

export interface DiplomacyState {
```

`packages/core/src/types.ts`에서 다음을 찾아

```ts
  | { kind: "conditionMet"; seat: SeatId; hero: string; trigger: Trigger["kind"]; react: Reaction["kind"] };
```

이렇게 바꾼다.

```ts
  | { kind: "conditionMet"; seat: SeatId; hero: string; trigger: Trigger["kind"]; react: Reaction["kind"] }
  | { kind: "proposalDelivered"; id: string; from: SeatId; to: SeatId; offer: Offer["kind"] }
  | {
      kind: "proposalSettled";
      id: string;
      from: SeatId;
      to: SeatId;
      offer: Offer["kind"];
      result: "accepted" | "rejected" | "expired" | "voided" | "failed";
      reason?: SettleReason;
    }
  | {
      kind: "relationChanged";
      seats: [SeatId, SeatId];
      from: RelationKind;
      to: RelationKind;
      cause: "accepted" | "attack" | "declareWar" | "breakTreaty" | "expired";
    }
  | { kind: "promise"; entry: PromiseEntry }
  | { kind: "heroReturned"; seat: SeatId; hero: string; from: NodeId; to: NodeId };
```

`packages/core/src/rules/heroes.ts`에서 다음을 찾아

```ts
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

이렇게 바꾼다.

```ts
/** captor가 잡고 있던 포로를 모두 푼다. */
export function releasePrisoners(state: GameState, captor: SeatId, events: GameEvent[]): void {
  for (const hero of state.heroes) {
    if (hero.status === "captured" && hero.captor === captor) freeHero(state, hero, events);
  }
}

/** 포로를 풀어 자기 자리의 현재 수도로 보낸다(활동, 병력 0). 수도가 없으면 out. */
export function freeHero(state: GameState, hero: Hero, events: GameEvent[]): void {
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
```

`packages/core/src/rules/turn.ts`에서 다음을 찾아

```ts
import { resolveConditions } from "./conditions";
```

이렇게 바꾼다.

```ts
import { resolveConditions } from "./conditions";
import { resolveDiplomacy } from "./diplomacy";
```

`packages/core/src/rules/turn.ts`에서 다음을 찾아

```ts
 * 순서: 메모 저장 → 충성 판정 → 이동 → 조건 판정·반응 → 전투 → 생산·건설·모집·유지비 → 레벨업 → 회복 → 탈락·종료
```

이렇게 바꾼다.

```ts
 * 순서: 메모 저장 → 충성 판정 → 이동 → 조건 판정·반응 → 전투 → 생산·건설·모집·유지비 → 레벨업 → 회복 → 외교 정산
 * → 탈락·종료
```

`packages/core/src/rules/turn.ts`에서 다음을 찾아

```ts
  recoverHeroes(state, events);
  resolveVictory(state, events);
```

이렇게 바꾼다.

```ts
  recoverHeroes(state, events);
  resolveDiplomacy(state, orders, events);
  resolveVictory(state, events);
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npm test -- packages/core/test/diplomacy.test.ts`
Expected: `Tests  11 passed`.

Run: `npm test`
Expected: `Test Files  22 passed`, `Tests  258 passed`. `rule6`에서는 전투로 `relationChanged`가 생기지만 해시에서 빠지므로 회귀 8개도 통과한다.

Run: `npm run typecheck`
Expected: 오류 없음.

- [ ] **Step 5: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add packages/core
git -C D:/game/proxywar commit -m "feat(core): 외교 정산(응답·적대 행위·만료·귀환·전달)"
```

---

### Task 6: 동맹 공격 금지

**Files:**
- Modify: `packages/core/src/confirm.ts`
- Test: `packages/core/test/confirm.test.ts`

- [ ] **Step 1: 테스트를 쓴다**

`packages/core/test/confirm.test.ts`에서 다음을 찾아

```ts
import { confirmPlan } from "../src/confirm";
```

이렇게 바꾼다.

```ts
import { confirmPlan } from "../src/confirm";
import { setRelation } from "../src/relations";
```

`packages/core/test/confirm.test.ts`에서 다음을 찾아

```ts
describe("confirmPlan", () => {
  it("상시 명령이 없고 수도에서 최소 수비를 넘겨 꺼내지 않으면 계획(메모 포함)을 그대로 둔다", () => {
```

이렇게 바꾼다.

```ts
describe("confirmPlan", () => {
  it("동맹 공격 금지: 동맹 거점 공격은 방어로, 동맹 거점 진격 조건은 조건만 빼고, 끄면 그대로 둔다", () => {
    const state = makeState();
    setRelation(state, 0, 1, "alliance");
    state.nodes.x0.owner = 0;
    state.nodes.f1.owner = 1;
    for (const id of ["s0h0", "s0h1", "s0h2"]) heroOf(state, id).location = "x0";
    const hit: Mission = { kind: "attack", hero: "s0h0", target: "f1", draw: 0 };
    const advance: Mission = {
      kind: "defend",
      hero: "s0h1",
      when: { trigger: { kind: "enemyNear" }, react: { kind: "advance", node: "f1" } },
    };
    const neutral: Mission = { kind: "attack", hero: "s0h2", target: "i0", draw: 0 };
    expect(confirm(state, hit, advance, neutral).corrections).toEqual([]);
    state.seats[0].settings.safeguards.noAllyAttack = true;
    const { plan, corrections } = confirm(state, hit, advance, neutral);
    expect(plan.missions).toEqual([defend("s0h0"), defend("s0h1"), neutral]);
    expect(corrections).toEqual([
      { hero: "s0h0", rule: "noAllyAttack", before: hit, after: defend("s0h0") },
      { hero: "s0h1", rule: "noAllyAttack", before: advance, after: defend("s0h1") },
    ]);
  });

  it("상시 명령이 없고 수도에서 최소 수비를 넘겨 꺼내지 않으면 계획(메모 포함)을 그대로 둔다", () => {
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm test -- packages/core/test/confirm.test.ts`
Expected: FAIL 1개. 동맹 거점 공격이 고쳐지지 않는다.

- [ ] **Step 3: 제약을 더한다**

`packages/core/src/confirm.ts`에서 다음을 찾아

```ts
import { bfs, compareText } from "./map";
import { troopCap } from "./rules/power";
```

이렇게 바꾼다.

```ts
import { bfs, compareText } from "./map";
import { allied } from "./relations";
import { troopCap } from "./rules/power";
```

`packages/core/src/confirm.ts`에서 다음을 찾아

```ts
export type ConstraintRule = "guardCapital" | "expedition" | "capitalMin";
```

이렇게 바꾼다.

```ts
export type ConstraintRule = "guardCapital" | "expedition" | "noAllyAttack" | "capitalMin";
```

`packages/core/src/confirm.ts`에서 다음을 찾아

```ts
 * 수도 방어 전담 → 원정 불허가 임무 종류를, 그 뒤 수도 최소 수비가 수도에서 꺼내는 병력을 고친다.
 * "현재 수도"는 확정 시점의 수도다. 꺼내기는 전투 앞 이동 단계에서 일어나 그 사이에 수도가 바뀌지 않는다.
```

이렇게 바꾼다.

```ts
 * 수도 방어 전담 → 원정 불허 → 동맹 공격 금지가 임무 종류를, 그 뒤 수도 최소 수비가 수도에서 꺼내는 병력을 고친다.
 * "현재 수도"는 확정 시점의 수도다. 꺼내기는 전투 앞 이동 단계에서 일어나 그 사이에 수도가 바뀌지 않는다.
 * 동맹은 확정 시점의 관계다. 같은 계획의 파기는 그 턴 외교 정산에서 효력이 생기므로 이번 턴 공격은 막힌다.
```

`packages/core/src/confirm.ts`에서 다음을 찾아

```ts
  const far = (node: NodeId): boolean => (mapDist[node] ?? Infinity) > BALANCE.constraints.expeditionRange;
```

이렇게 바꾼다.

```ts
  const far = (node: NodeId): boolean => (mapDist[node] ?? Infinity) > BALANCE.constraints.expeditionRange;
  const noAllyAttack = state.seats[seat].settings.safeguards.noAllyAttack;
  const allyNode = (node: NodeId): boolean => {
    const owner = state.nodes[node].owner;
    return owner !== null && allied(state, seat, owner);
  };
```

`packages/core/src/confirm.ts`에서 다음을 찾아

```ts
        m = fix(m, "expedition", withoutCondition(m));
      }
    }
    return m;
```

이렇게 바꾼다.

```ts
        m = fix(m, "expedition", withoutCondition(m));
      }
    }
    if (noAllyAttack) {
      const react = m.when?.react;
      if (m.kind === "attack" && allyNode(m.target)) {
        m = fix(m, "noAllyAttack", { kind: "defend", hero: m.hero });
      } else if (react?.kind === "advance" && allyNode(react.node)) {
        m = fix(m, "noAllyAttack", withoutCondition(m));
      }
    }
    return m;
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npm test -- packages/core/test/confirm.test.ts`
Expected: `Tests  9 passed`.

Run: `npm test`
Expected: `Test Files  22 passed`, `Tests  259 passed`.

Run: `npm run typecheck`
Expected: 오류 없음.

- [ ] **Step 5: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add packages/core
git -C D:/game/proxywar commit -m "feat(core): 동맹 공격 금지 안전장치"
```

---

### Task 7: 시야의 외교 정보와 동맹 시야

**Files:**
- Modify: `packages/core/src/view.ts`
- Test: `packages/core/test/view.test.ts`

- [ ] **Step 1: 테스트를 쓴다**

`packages/core/test/view.test.ts`에서 다음을 찾아

```ts
  it("시야는 복사본이라 고쳐도 상태가 바뀌지 않는다", () => {
```

이렇게 바꾼다.

```ts
  it("동맹의 시야를 함께 보고(동맹의 동맹은 아님), 동맹 영웅은 남의 영웅처럼 숨긴다", () => {
    const state = makeState();
    setRelation(state, 0, 1, "alliance");
    setRelation(state, 1, 2, "alliance");
    const view = viewOf(state, 0);
    expect(Object.keys(view.nodes)).toEqual(["c0", "c1", "f0", "f1", "m0", "m1"]);
    expect(view.foreignHeroes.map((h) => h.id)).toEqual(["s1h0", "s1h1", "s1h2", "s1h3", "s1h4"]);
    expect(view.foreignHeroes[0]).not.toHaveProperty("traits");
  });

  it("관계·대기 제안·약속 기록이 시야에 들어간다", () => {
    const state = makeState();
    setRelation(state, 0, 2, "nonAggression", 30);
    setRelation(state, 0, 3, "war");
    const incoming: PendingOffer = { kind: "alliance", to: 0, id: "4-1-0", from: 1 };
    const outgoing: PendingOffer = { kind: "nonAggression", to: 4, turns: 12, id: "4-0-0", from: 0 };
    state.diplomacy.pending.push(incoming, outgoing, { kind: "alliance", to: 3, id: "4-2-0", from: 2 });
    state.diplomacy.promises.push({ turn: 3, kind: "formed", treaty: "nonAggression", seats: [0, 2] });
    const view = viewOf(state, 0);
    expect(view.relations).toEqual([
      { seat: 1, kind: "neutral", until: null },
      { seat: 2, kind: "nonAggression", until: 30 },
      { seat: 3, kind: "war", until: null },
      { seat: 4, kind: "neutral", until: null },
      { seat: 5, kind: "neutral", until: null },
    ]);
    expect(view.incoming).toEqual([incoming]);
    expect(view.outgoing).toEqual([outgoing]);
    expect(view.promises).toEqual(state.diplomacy.promises);
  });

  it("시야는 복사본이라 고쳐도 상태가 바뀌지 않는다", () => {
```

`packages/core/test/view.test.ts`에서 다음을 찾아

```ts
import { defensePower } from "../src/rules/power";
import type { HeroStatus } from "../src/types";
```

이렇게 바꾼다.

```ts
import { setRelation } from "../src/relations";
import { defensePower } from "../src/rules/power";
import type { HeroStatus, PendingOffer } from "../src/types";
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm test -- packages/core/test/view.test.ts`
Expected: FAIL 2개. 동맹 시야가 합쳐지지 않고, 시야에 `relations`·`incoming`·`outgoing`·`promises`가 없다.

- [ ] **Step 3: 시야를 넓힌다**

`packages/core/src/view.ts`에서 다음을 찾아

```ts
import { bfs, compareText } from "./map";
import { ownedNodes, scoreOf } from "./summary";
import type { Board, GameMap, GameState, Hero, NodeId, NodeState, Resources, SeatId, SeatSettings } from "./types";
```

이렇게 바꾼다.

```ts
import { bfs, compareText } from "./map";
import { allied, relationOf } from "./relations";
import { ownedNodes, scoreOf } from "./summary";
import type {
  Board,
  GameMap,
  GameState,
  Hero,
  NodeId,
  NodeState,
  PendingOffer,
  PromiseEntry,
  RelationKind,
  Resources,
  SeatId,
  SeatSettings,
} from "./types";
```

`packages/core/src/view.ts`에서 다음을 찾아

```ts
/** 참모가 받는 자리별 보고서 데이터. 지금 상태의 스냅숏이고, 지난 턴 사건은 1c에서 더한다 */
```

이렇게 바꾼다.

```ts
/** 다른 자리와 나의 관계 */
export interface SeatRelation {
  seat: SeatId;
  kind: RelationKind;
  /** 불가침 만료 턴 */
  until: number | null;
}

/** 참모가 받는 자리별 보고서 데이터. 지금 상태의 스냅숏이고, 지난 턴 사건은 1c에서 더한다 */
```

`packages/core/src/view.ts`에서 다음을 찾아

```ts
  memo: string;
  seats: PublicSeat[];
}
```

이렇게 바꾼다.

```ts
  memo: string;
  seats: PublicSeat[];
  /** 다른 자리마다 나와의 관계(자리 순) */
  relations: SeatRelation[];
  /** 나에게 온 대기 제안(이번 계획에서 응답한다) */
  incoming: PendingOffer[];
  /** 내가 낸 대기 제안 */
  outgoing: PendingOffer[];
  /** 약속 기록(모두에게 공개) */
  promises: PromiseEntry[];
}
```

`packages/core/src/view.ts`에서 다음을 찾아

```ts
/** 자리의 시야. 상태와 공유하지 않는 복사본이다. */
export function viewOf(state: GameState, seat: SeatId): SeatView {
  const seen = visibleNodes(state, seat);
```

이렇게 바꾼다.

```ts
/**
 * 자리의 시야. 보이는 거점은 내 시야와 지금 동맹들의 시야(동맹의 동맹은 아님)를 합친다.
 * 상태와 공유하지 않는 복사본이다.
 */
export function viewOf(state: GameState, seat: SeatId): SeatView {
  const seen = visibleNodes(state, seat);
  for (const other of state.seats) {
    if (other.eliminatedAt !== null || !allied(state, seat, other.id)) continue;
    for (const node of visibleNodes(state, other.id)) seen.add(node);
  }
```

`packages/core/src/view.ts`에서 다음을 찾아

```ts
      eliminated: s.eliminatedAt !== null,
    })),
  };
```

이렇게 바꾼다.

```ts
      eliminated: s.eliminatedAt !== null,
    })),
    relations: state.seats
      .filter((s) => s.id !== seat)
      .map((s) => {
        const { kind, until } = relationOf(state, seat, s.id);
        return { seat: s.id, kind, until };
      }),
    incoming: state.diplomacy.pending.filter((p) => p.to === seat),
    outgoing: state.diplomacy.pending.filter((p) => p.from === seat),
    promises: state.diplomacy.promises,
  };
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npm test -- packages/core/test/view.test.ts`
Expected: `Tests  13 passed`.

Run: `npm test`
Expected: `Test Files  22 passed`, `Tests  261 passed`.

Run: `npm run typecheck`
Expected: 오류 없음.

- [ ] **Step 5: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add packages/core
git -C D:/game/proxywar commit -m "feat(core): 시야에 관계·대기 제안·약속 기록과 동맹 시야"
```

---

### Task 8: 규칙 참모의 외교

**Files:**
- Modify: `packages/core/src/staff/rule-staff.ts`
- Test: `packages/core/test/rule-staff.test.ts`

- [ ] **Step 1: 테스트를 쓴다**

`packages/core/test/rule-staff.test.ts`에서 다음을 찾아

```ts
import { processTurn } from "../src/rules/turn";
import { PRESET_NAMES } from "../src/settings";
```

이렇게 바꾼다.

```ts
import { setRelation } from "../src/relations";
import { processTurn } from "../src/rules/turn";
import { PRESET_NAMES, resolveSettings } from "../src/settings";
```

`packages/core/test/rule-staff.test.ts`에서 다음을 찾아

```ts
import type { GameState, Plan } from "../src/types";
```

이렇게 바꾼다.

```ts
import type { GameState, PendingOffer, Plan } from "../src/types";
```

`packages/core/test/rule-staff.test.ts`에서 다음을 찾아

```ts
  it("세팅·상시 명령이 섞여도 30턴 동안 검증과 확정에서 고쳐지는 항목이 없다", () => {
```

이렇게 바꾼다.

```ts
  it("동맹 신의 3 이상은 불가침·동맹 상대 거점을 공격 목표에서 빼고, 2는 동맹만 빼며, 1은 빼지 않는다", () => {
    const state = makeState();
    Object.assign(state.nodes.f0, { owner: 1, garrison: 0 });
    const target = (fidelity: number, kind: "nonAggression" | "alliance", noAllyAttack = false) => {
      const s: GameState = JSON.parse(JSON.stringify(state));
      setRelation(s, 0, 1, kind, kind === "nonAggression" ? 50 : null);
      s.seats[0].settings.tendency.fidelity = fidelity;
      s.seats[0].settings.safeguards.noAllyAttack = noAllyAttack;
      const first = planOf(s).missions[0];
      return first.kind === "attack" ? first.target : first.kind;
    };
    expect(target(3, "nonAggression")).toBe("m0");
    expect(target(2, "nonAggression")).toBe("f0");
    expect(target(2, "alliance")).toBe("m0");
    expect(target(1, "alliance")).toBe("f0");
    expect(target(1, "alliance", true)).toBe("m0");
  });

  it("보복 4·5는 나와 전쟁 중인 자리의 거점을 먼저 노린다", () => {
    const state = makeState();
    Object.assign(state.nodes.f0, { owner: 1, garrison: 10 });
    state.nodes.m0.garrison = 0;
    setRelation(state, 0, 1, "war");
    const first = (retaliation: number) => {
      state.seats[0].settings.tendency.retaliation = retaliation;
      return planOf(state).missions[0];
    };
    expect(first(3)).toMatchObject({ kind: "attack", target: "m0" });
    expect(first(4)).toMatchObject({ kind: "attack", target: "f0" });
  });

  it("받은 제안에 모두 응답한다(불가침 수락, 원한이면 거절, 동맹은 신의 3 이상, 교환은 손해 없이 시작 금고를 지킬 때)", () => {
    const state = makeState();
    setRelation(state, 0, 2, "war");
    state.seats[0].settings.tendency.retaliation = 4;
    const offers: PendingOffer[] = [
      { kind: "nonAggression", to: 0, turns: 12, id: "a", from: 1 },
      { kind: "nonAggression", to: 0, turns: 12, id: "b", from: 2 },
      { kind: "alliance", to: 0, id: "c", from: 3 },
      { kind: "trade", to: 0, give: { gold: 20 }, get: { food: 20 }, id: "d", from: 4 },
      { kind: "trade", to: 0, give: { food: 20 }, get: {}, id: "e", from: 4 },
      { kind: "prisoners", to: 0, release: ["s0h4"], receive: [], pay: {}, ask: { gold: 10 }, id: "f", from: 1 },
      { kind: "prisoners", to: 0, release: ["s0h4"], receive: [], pay: {}, ask: {}, id: "g", from: 1 },
    ];
    state.diplomacy.pending.push(...offers);
    expect(planOf(state).responses).toEqual([
      { id: "a", accept: true },
      { id: "b", accept: false },
      { id: "c", accept: true },
      { id: "d", accept: false },
      { id: "e", accept: true },
      { id: "f", accept: false },
      { id: "g", accept: true },
    ]);
  });

  it("동맹 신의 3 이하는 먼저 제안하지 않는다", () => {
    const state = makeState();
    Object.assign(state.nodes.f0, { owner: 1, garrison: 0 });
    expect(planOf(state).proposals).toEqual([]);
  });

  it("동맹 신의 4·5는 국경을 맞댄 상대에게 불가침을, 신의 5는 불가침 상대에게 동맹을 제안한다", () => {
    const state = makeState();
    state.seats[0].settings = resolveSettings("diplomatic");
    state.nodes.f0.owner = 1;
    state.nodes.m0.owner = 2;
    setRelation(state, 0, 3, "nonAggression", 50);
    expect(planOf(state).proposals).toEqual([
      { kind: "nonAggression", to: 1, turns: 24 },
      { kind: "alliance", to: 3 },
    ]);
    // 대기 중인 불가침 제안이 있는 자리는 건너뛴다
    state.diplomacy.pending.push({ kind: "nonAggression", to: 1, turns: 24, id: "0-0-0", from: 0 });
    const plan = planOf(state);
    expect(plan.proposals?.[0]).toEqual({ kind: "nonAggression", to: 2, turns: 24 });
    expect(validatePlan(state, 0, plan).issues).toEqual([]);
  });

  it("동맹 신의 4·5는 식량이 모자라면 금↔식량 교환을, 포로가 있으면 맞교환을, 맞교환할 것이 없으면 몸값을 제안한다", () => {
    const state = makeState();
    Object.assign(state.seats[0].settings.tendency, { fidelity: 4, aggression: 4 });
    state.seats[0].treasury.food = 10;
    setRelation(state, 0, 2, "nonAggression", 50);
    Object.assign(heroOf(state, "s1h0"), { status: "captured", captor: 0 });
    Object.assign(heroOf(state, "s3h0"), { status: "captured", captor: 0 });
    Object.assign(heroOf(state, "s0h4"), { status: "captured", captor: 3 });
    const plan = planOf(state);
    expect(plan.proposals).toEqual([
      { kind: "trade", to: 2, give: { gold: 20 }, get: { food: 20 } },
      { kind: "prisoners", to: 3, release: ["s3h0"], receive: ["s0h4"], pay: {}, ask: {} },
    ]);
    expect(validatePlan(state, 0, plan).issues).toEqual([]);
    Object.assign(heroOf(state, "s0h4"), { status: "active", captor: null });
    expect(planOf(state).proposals?.[1]).toEqual({
      kind: "prisoners",
      to: 1,
      release: ["s1h0"],
      receive: [],
      pay: {},
      ask: { gold: 10 },
    });
  });

  it("세팅·상시 명령이 섞여도 30턴 동안 검증과 확정에서 고쳐지는 항목이 없다", () => {
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm test -- packages/core/test/rule-staff.test.ts`
Expected: FAIL 6개. 규칙 참모가 관계를 보지 않고 제안·응답을 내지 않는다.

- [ ] **Step 3: 규칙 참모에 외교를 더한다**

`packages/core/src/staff/rule-staff.ts`에서 다음을 찾아

```ts
import { attackModifier, defensePower, troopCap } from "../rules/power";
import { ownedNodes, totalTroops } from "../summary";
import type { Board, Build, Condition, Mission, NodeId, Plan, Recruit, SeatId } from "../types";
import { boardOf, type MyHero, type SeatView } from "../view";
```

이렇게 바꾼다.

```ts
import { RESOURCE_KINDS, totalOf } from "../resources";
import { attackModifier, defensePower, troopCap } from "../rules/power";
import { ownedNodes, totalTroops } from "../summary";
import type {
  Board,
  Build,
  Condition,
  Mission,
  NodeId,
  PendingOffer,
  Plan,
  Proposal,
  Recruit,
  RelationKind,
  ResourceAmounts,
  Response,
  SeatId,
} from "../types";
import { boardOf, type MyHero, type PublicSeat, type SeatView } from "../view";
```

`packages/core/src/staff/rule-staff.ts`에서 다음을 찾아

```ts
/** 식량 자제 지침: 모집 뒤 식량을 예상 유지비의 이 턴 수만큼 남긴다 */
const FOOD_RESERVE_TURNS = { on: 5, off: 1 };
```

이렇게 바꾼다.

```ts
/** 식량 자제 지침: 모집 뒤 식량을 예상 유지비의 이 턴 수만큼 남긴다 */
const FOOD_RESERVE_TURNS = { on: 5, off: 1 };
/** 동맹 신의: 이 관계인 상대의 거점은 공격 목표에서 뺀다 */
const SPARED_BY_FIDELITY: readonly (readonly RelationKind[])[] = [
  [],
  ["alliance"],
  ["nonAggression", "alliance"],
  ["nonAggression", "alliance"],
  ["nonAggression", "alliance"],
];
/** 동맹 신의가 이 값 이상이면 먼저 제안한다(그 밖에는 응답만 한다) */
const PROPOSE_MIN_FIDELITY = 4;
/** 동맹 신의가 이 값이면 불가침 상대에게 동맹을 제안한다 */
const ALLIANCE_FIDELITY = 5;
/** 받은 동맹은 동맹 신의가 이 값 이상일 때 수락한다 */
const ACCEPT_ALLIANCE_MIN_FIDELITY = 3;
/** 공격성이 이 값 이하일 때 국경을 맞댄 상대에게 이 턴 수의 불가침을 제안한다 */
const TRUCE_MAX_AGGRESSION = 3;
const TRUCE_TURNS = 24;
/** 보복 성향이 이 값 이상이면 전쟁 상대의 거점을 먼저 노리고, 전쟁 상대의 불가침·동맹을 거절한다 */
const RETALIATE_MIN = 4;
/** 식량이 모자라고 금이 minGold 이상이면 금 gold를 주고 식량 food를 받는 교환을 제안한다 */
const FOOD_TRADE = { minGold: 40, gold: 20, food: 20 };
/** 포로 몸값: 금 = 레벨 × 이 값 */
const RANSOM_GOLD_PER_LEVEL = 10;
```

`packages/core/src/staff/rule-staff.ts`에서 다음을 찾아

```ts
  /** 거점 수가 가장 적은 상대 자리들 */
  weakest: Set<SeatId>;
}
```

이렇게 바꾼다.

```ts
  /** 거점 수가 가장 적은 상대 자리들 */
  weakest: Set<SeatId>;
  /** 공격 목표에서 빼는 상대(동맹 신의, 동맹 공격 금지) */
  spared: Set<SeatId>;
  /** 나와 전쟁 중인 자리 */
  enemies: Set<SeatId>;
}
```

`packages/core/src/staff/rule-staff.ts`에서 다음을 찾아

```ts
  const fewest = Math.min(...rivals.map((s) => s.nodes));
  const ctx: Ctx = {
```

이렇게 바꾼다.

```ts
  const fewest = Math.min(...rivals.map((s) => s.nodes));
  const sparedKinds = new Set<RelationKind>(SPARED_BY_FIDELITY[tendency.fidelity - 1]);
  if (safeguards.noAllyAttack) sparedKinds.add("alliance");
  const ctx: Ctx = {
```

`packages/core/src/staff/rule-staff.ts`에서 다음을 찾아

```ts
    weakest: new Set(rivals.filter((s) => s.nodes === fewest).map((s) => s.id)),
  };
  const builds = planBuilds(ctx);
  const buildGold = builds.reduce((sum, b) => sum + buildCost(view.nodes[b.node].buildings[b.building] + 1).gold, 0);
  return { missions: planMissions(ctx), recruits: planRecruits(ctx, buildGold), builds };
}
```

이렇게 바꾼다.

```ts
    weakest: new Set(rivals.filter((s) => s.nodes === fewest).map((s) => s.id)),
    spared: new Set(view.relations.filter((r) => sparedKinds.has(r.kind)).map((r) => r.seat)),
    enemies: new Set(view.relations.filter((r) => r.kind === "war").map((r) => r.seat)),
  };
  const builds = planBuilds(ctx);
  const buildGold = builds.reduce((sum, b) => sum + buildCost(view.nodes[b.node].buildings[b.building] + 1).gold, 0);
  return { missions: planMissions(ctx), recruits: planRecruits(ctx, buildGold), builds, ...planDiplomacy(ctx) };
}

function relationTo(ctx: Ctx, seat: SeatId): RelationKind {
  return ctx.view.relations.find((r) => r.seat === seat)?.kind ?? "neutral";
}
```

`packages/core/src/staff/rule-staff.ts`에서 다음을 찾아

```ts
/** 공격 목표 정렬 키(작을수록 먼저): 희귀 우선 → 약한 상대 우선 → 확장 욕구 */
function targetRank(ctx: Ctx, node: NodeId): number[] {
  const { guidelines, tendency } = ctx.view.settings;
  const owner = ctx.view.nodes[node].owner;
  const neutral = owner === null ? 0 : 1;
  const expansion = tendency.expansion <= 2 ? 1 - neutral : tendency.expansion >= 4 ? neutral : 0;
  return [
```

이렇게 바꾼다.

```ts
/** 공격 목표 정렬 키(작을수록 먼저): 보복 → 희귀 우선 → 약한 상대 우선 → 확장 욕구 */
function targetRank(ctx: Ctx, node: NodeId): number[] {
  const { guidelines, tendency } = ctx.view.settings;
  const owner = ctx.view.nodes[node].owner;
  const neutral = owner === null ? 0 : 1;
  const expansion = tendency.expansion <= 2 ? 1 - neutral : tendency.expansion >= 4 ? neutral : 0;
  return [
    tendency.retaliation >= RETALIATE_MIN && owner !== null && ctx.enemies.has(owner) ? 0 : 1,
```

`packages/core/src/staff/rule-staff.ts`에서 다음을 찾아

```ts
/** froms에 인접한 아군이 아닌 거점(claimed 제외)을 정렬 키 → 추정 방어력 → id 순으로 */
```

이렇게 바꾼다.

```ts
/** froms에 인접한 아군이 아닌 거점(claimed와 빼는 상대의 거점 제외)을 정렬 키 → 추정 방어력 → id 순으로 */
```

`packages/core/src/staff/rule-staff.ts`에서 다음을 찾아

```ts
    .filter((n) => !mine(ctx, n) && !claimed.has(n))
```

이렇게 바꾼다.

```ts
    .filter((n) => {
      const owner = ctx.view.nodes[n].owner;
      return !mine(ctx, n) && !claimed.has(n) && (owner === null || !ctx.spared.has(owner));
    })
```

`packages/core/src/staff/rule-staff.ts` 끝에 더한다.

```ts
/** 외교: 받은 제안에 모두 응답하고, 동맹 신의 4·5면 불가침 → 동맹 → 자원 교환 → 포로 교환 순으로 먼저 제안한다 */
function planDiplomacy(ctx: Ctx): { proposals: Proposal[]; responses: Response[] } {
  const { view, seat } = ctx;
  const { tendency, guidelines } = view.settings;
  const responses = view.incoming.map((offer) => ({ id: offer.id, accept: accepts(ctx, offer) }));
  const proposals: Proposal[] = [];
  if (tendency.fidelity < PROPOSE_MIN_FIDELITY) return { proposals, responses };
  // 상대 하나에 턴당 1건
  const used = new Set<SeatId>();
  const add = (p: Proposal): void => {
    proposals.push(p);
    used.add(p.to);
  };
  const rivals = view.seats.filter((s) => s.id !== seat && !s.eliminated);
  const open = (pick: (s: PublicSeat) => boolean): PublicSeat[] => rivals.filter((s) => !used.has(s.id) && pick(s));
  const byNodes = (a: PublicSeat, b: PublicSeat): number => b.nodes - a.nodes || a.id - b.id;
  const at = (...kinds: RelationKind[]) => (s: PublicSeat): boolean => kinds.includes(relationTo(ctx, s.id));

  if (tendency.aggression <= TRUCE_MAX_AGGRESSION) {
    const border = new Set(
      ownedNodes(view, seat).flatMap((n) => neighbors(view.map, n).map((m) => view.nodes[m]?.owner ?? null)),
    );
    const waiting = new Set(view.outgoing.map((o) => o.to));
    const target = open((s) => border.has(s.id) && !waiting.has(s.id) && at("neutral", "war")(s)).sort(byNodes)[0];
    if (target) add({ kind: "nonAggression", to: target.id, turns: TRUCE_TURNS });
  }
  if (tendency.fidelity >= ALLIANCE_FIDELITY) {
    const target = open(at("nonAggression")).sort(byNodes)[0];
    if (target) add({ kind: "alliance", to: target.id });
  }
  const upkeep = Math.ceil(totalTroops(ctx.board, seat) / BALANCE.upkeep.soldiersPerFood);
  const reserveTurns = guidelines.foodCaution ? FOOD_RESERVE_TURNS.on : FOOD_RESERVE_TURNS.off;
  if (view.treasury.food < upkeep * reserveTurns && view.treasury.gold >= FOOD_TRADE.minGold) {
    const partner = open(at("nonAggression", "alliance"))[0];
    if (partner) add({ kind: "trade", to: partner.id, give: { gold: FOOD_TRADE.gold }, get: { food: FOOD_TRADE.food } });
  }
  const captives = (s: PublicSeat) =>
    view.foreignHeroes
      .filter((h) => h.status === "captured" && h.captor === seat && h.seat === s.id)
      .sort((a, b) => compareText(a.id, b.id));
  const held = (s: PublicSeat) =>
    view.myHeroes.filter((h) => h.status === "captured" && h.captor === s.id).sort((a, b) => compareText(a.id, b.id));
  const swap = open((s) => captives(s).length > 0 && held(s).length > 0)[0];
  const ransom = open((s) => captives(s).length > 0)[0];
  if (swap) {
    const n = Math.min(captives(swap).length, held(swap).length);
    const release = captives(swap).slice(0, n).map((h) => h.id);
    const receive = held(swap).slice(0, n).map((h) => h.id);
    add({ kind: "prisoners", to: swap.id, release, receive, pay: {}, ask: {} });
  } else if (ransom) {
    const hero = captives(ransom)[0];
    const ask = { gold: RANSOM_GOLD_PER_LEVEL * hero.level };
    add({ kind: "prisoners", to: ransom.id, release: [hero.id], receive: [], pay: {}, ask });
  }
  return { proposals, responses };
}

/** 받은 제안을 수락하나. 교환은 받는 양이 주는 양 이상이고 주는 자원이 시작 금고 아래로 내려가지 않을 때 */
function accepts(ctx: Ctx, offer: PendingOffer): boolean {
  const { tendency } = ctx.view.settings;
  const grudge = relationTo(ctx, offer.from) === "war" && tendency.retaliation >= RETALIATE_MIN;
  switch (offer.kind) {
    case "nonAggression":
      return !grudge;
    case "alliance":
      return !grudge && tendency.fidelity >= ACCEPT_ALLIANCE_MIN_FIDELITY;
    case "trade":
      return totalOf(offer.give) >= totalOf(offer.get) && keepsStart(ctx, offer.get);
    case "prisoners":
      return offer.release.length >= offer.receive.length && keepsStart(ctx, offer.ask);
  }
}

/** 주는 자원마다, 주고 나서도 시작 금고 이상 남는가 */
function keepsStart(ctx: Ctx, give: ResourceAmounts): boolean {
  return RESOURCE_KINDS.every((kind) => {
    const amount = give[kind] ?? 0;
    return amount === 0 || ctx.view.treasury[kind] - amount >= BALANCE.start.treasury[kind];
  });
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npm test -- packages/core/test/rule-staff.test.ts`
Expected: `Tests  29 passed`.

Run: `npm test`
Expected: `Test Files  22 passed`, `Tests  267 passed`. `balanced`(신의 3·보복 3)는 제안하지 않고 정렬도 그대로라 회귀 8개가 통과한다. `rule6-presets` 매치(runner 테스트)도 무효 명령·확정 수정 없이 끝난다.

Run: `npm run typecheck`
Expected: 오류 없음.

- [ ] **Step 5: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add packages/core
git -C D:/game/proxywar commit -m "feat(core): 규칙 참모의 외교(동맹 신의·보복 성향)"
```

---

### Task 9: 기록 version 4와 보고서 외교 절

**Files:**
- Modify: `packages/sim/src/runner.ts`, `packages/sim/src/report.ts`
- Test: `packages/sim/test/runner.test.ts`, `packages/sim/test/report.test.ts`

- [ ] **Step 1: 테스트를 쓴다**

`packages/sim/test/runner.test.ts`에서 다음을 찾아

```ts
    const record = await run(parseRunConfig(traitsRaw));
    expect(record.version).toBe(3);
```

이렇게 바꾼다.

```ts
    const record = await run(parseRunConfig(traitsRaw));
    expect(record.version).toBe(4);
```

`packages/sim/test/runner.test.ts`에서 다음을 찾아

```ts
  it("프리셋·상시 명령이 섞인 매치도 끝까지 돌고, 규칙 참모 계획은 검증·확정에서 고쳐지지 않으며 조건을 붙인다", async () => {
    const record = await run(parseRunConfig(presetsRaw));
    expect(record.version).toBe(3);
```

이렇게 바꾼다.

```ts
  it("프리셋·상시 명령이 섞인 매치도 끝까지 돌고, 규칙 참모 계획은 검증·확정에서 고쳐지지 않으며 조건을 붙이고 외교를 한다", async () => {
    const record = await run(parseRunConfig(presetsRaw));
    expect(record.version).toBe(4);
```

`packages/sim/test/runner.test.ts`에서 다음을 찾아

```ts
    expect(record.turns.some((t) => t.plans[5].missions.some((m) => m.when !== undefined))).toBe(true);
  });
```

이렇게 바꾼다.

```ts
    expect(record.turns.some((t) => t.plans[5].missions.some((m) => m.when !== undefined))).toBe(true);
    const kinds = [...new Set(record.turns.flatMap((t) => t.events.map((e) => e.kind)))];
    for (const kind of ["proposalDelivered", "proposalSettled", "relationChanged", "promise"]) expect(kinds).toContain(kind);
  });
```

`packages/sim/test/report.test.ts`에서 다음을 찾아

```ts
import { renderReport } from "../src/report";
import { runCommand } from "../src/run-command";

const configPath = fileURLToPath(new URL("../configs/rule6.json", import.meta.url));
```

이렇게 바꾼다.

```ts
import { parseRunConfig } from "../src/config";
import { renderReport } from "../src/report";
import { runCommand } from "../src/run-command";
import { runMatch, staffFor } from "../src/runner";

const configPath = fileURLToPath(new URL("../configs/rule6.json", import.meta.url));
const presetsPath = fileURLToPath(new URL("../configs/rule6-presets.json", import.meta.url));
```

`packages/sim/test/report.test.ts`에서 다음을 찾아

```ts
      expect(md).toContain("## 무효 명령\n\n없음");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
```

이렇게 바꾼다.

```ts
      expect(md).toContain("## 무효 명령\n\n없음");
      expect(md).toContain("### 약속 기록\n\n없음");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("외교 절에 자리별 제안 결과·약속 기록·마지막 관계가 들어간다", async () => {
    const config = parseRunConfig(JSON.parse(readFileSync(presetsPath, "utf8")));
    const md = renderReport(await runMatch(config, config.seats.map((s) => staffFor(s.staff))));
    expect(md).toContain("## 외교\n\n| 자리 | 제안 | 수락됨 | 거절됨 | 만료 | 무효 | 실패 | 깬 약속 |");
    expect(md).toContain("불가침 성립:");
    expect(md).toContain("### 마지막 관계\n\n| 쌍 | 관계 |");
  });
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm test -- packages/sim`
Expected: FAIL 4개(version 4 두 곳, 보고서 외교 절 두 곳).

- [ ] **Step 3: 기록과 보고서를 고친다**

`packages/sim/src/runner.ts`에서 다음을 찾아

```ts
export interface MatchRecord {
  version: 3;
```

이렇게 바꾼다.

```ts
export interface MatchRecord {
  version: 4;
```

`packages/sim/src/runner.ts`에서 다음을 찾아

```ts
  return { version: 3, config, initialState, turns, result: state.ended! };
```

이렇게 바꾼다.

```ts
  return { version: 4, config, initialState, turns, result: state.ended! };
```

`packages/sim/src/report.ts`에서 다음을 찾아

```ts
import { BALANCE, type GameEvent, type GuidelineKind, type MatchResult, type StandingOrders } from "@proxywar/core";
```

이렇게 바꾼다.

```ts
import {
  BALANCE,
  type GameEvent,
  type GuidelineKind,
  type MatchResult,
  type PromiseEntry,
  type RelationKind,
  type StandingOrders,
} from "@proxywar/core";
```

`packages/sim/src/report.ts`에서 다음을 찾아

```ts
const GUIDELINE_LABELS: Record<GuidelineKind, string> = {
```

이렇게 바꾼다.

```ts
const RELATION_LABELS: Record<RelationKind, string> = {
  neutral: "중립",
  war: "전쟁",
  nonAggression: "불가침",
  alliance: "동맹",
};

const BREAK_LABELS: Record<Extract<PromiseEntry, { kind: "broken" }>["how"], string> = {
  attack: "기습",
  war: "선전포고",
  break: "파기",
};

const GUIDELINE_LABELS: Record<GuidelineKind, string> = {
```

`packages/sim/src/report.ts`에서 다음을 찾아

```ts
  names.forEach((n, seat) => lines.push(`| ${n} | ${STAT_COLUMNS.map((k) => counts[seat][k]).join(" | ")} |`));
```

이렇게 바꾼다.

```ts
  names.forEach((n, seat) => lines.push(`| ${n} | ${STAT_COLUMNS.map((k) => counts[seat][k]).join(" | ")} |`));
  lines.push("", ...renderDiplomacy(record, name));
```

`packages/sim/src/report.ts`에서 다음을 찾아

```ts
function standingText(orders: StandingOrders): string[] {
```

이렇게 바꾼다.

```ts
/** 외교: 자리별 제안 결과(낸 쪽 기준)와 깬 약속, 약속 기록, 마지막 관계 */
function renderDiplomacy(record: MatchRecord, name: (seat: number | null) => string): string[] {
  const counts = record.config.seats.map(() => ({
    delivered: 0,
    accepted: 0,
    rejected: 0,
    expired: 0,
    voided: 0,
    failed: 0,
    broken: 0,
  }));
  const promises: string[] = [];
  const relations = new Map<string, { seats: [number, number]; kind: RelationKind }>();
  for (const t of record.turns) {
    for (const e of t.events) {
      if (e.kind === "proposalDelivered") counts[e.from].delivered += 1;
      else if (e.kind === "proposalSettled") counts[e.from][e.result] += 1;
      else if (e.kind === "relationChanged") relations.set(e.seats.join(","), { seats: e.seats, kind: e.to });
      else if (e.kind === "promise") {
        if (e.entry.kind === "broken") counts[e.entry.by].broken += 1;
        promises.push(`- T${t.turn} ${promiseText(e.entry, name)}`);
      }
    }
  }
  const pairs = [...relations.values()]
    .filter((r) => r.kind !== "neutral")
    .sort((p, q) => p.seats[0] - q.seats[0] || p.seats[1] - q.seats[1])
    .map((r) => `| ${name(r.seats[0])} · ${name(r.seats[1])} | ${RELATION_LABELS[r.kind]} |`);
  return [
    "## 외교",
    "",
    "| 자리 | 제안 | 수락됨 | 거절됨 | 만료 | 무효 | 실패 | 깬 약속 |",
    "|---|---|---|---|---|---|---|---|",
    ...counts.map(
      (c, seat) =>
        `| ${name(seat)} | ${c.delivered} | ${c.accepted} | ${c.rejected} | ${c.expired} | ${c.voided} | ${c.failed} | ${c.broken} |`,
    ),
    "",
    "### 약속 기록",
    "",
    ...(promises.length > 0 ? promises : ["없음"]),
    "",
    "### 마지막 관계",
    "",
    ...(pairs.length > 0 ? ["| 쌍 | 관계 |", "|---|---|", ...pairs] : ["모두 중립"]),
  ];
}

function promiseText(entry: PromiseEntry, name: (seat: number | null) => string): string {
  const [a, b] = entry.seats;
  const pair = `${name(a)} · ${name(b)}`;
  switch (entry.kind) {
    case "formed":
      return `${RELATION_LABELS[entry.treaty]} 성립: ${pair}`;
    case "expired":
      return `불가침 만료: ${pair}`;
    case "broken":
      return `${RELATION_LABELS[entry.treaty]} 깸(${BREAK_LABELS[entry.how]}): ${name(entry.by)} — ${pair}`;
    case "declared":
      return `선전포고: ${name(entry.by)} → ${name(entry.by === a ? b : a)}`;
  }
}

function standingText(orders: StandingOrders): string[] {
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npm test -- packages/sim`
Expected: `Tests  17 passed`.

Run: `npm test`
Expected: `Test Files  22 passed`, `Tests  268 passed`.

Run: `npm run typecheck`
Expected: 오류 없음.

- [ ] **Step 5: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add packages/sim
git -C D:/game/proxywar commit -m "feat(sim): 기록 version 4와 보고서 외교 절"
```

---

### Task 10: 실측과 기록

**Files:**
- Modify: `docs/superpowers/plans/2026-10-28-sim-core-1b-3-diplomacy.md`(머리말 "실행 중 변경"), `AGENTS.md`

- [ ] **Step 1: 세 설정을 돌린다**

Run: `npm run sim -- run packages/sim/configs/rule6.json`
Expected: `turnLimit · 승자 Frost · 120턴`(1b-2와 같다).

Run: `npm run sim -- run packages/sim/configs/rule6-traits.json`
Expected: `earlyVictory · 승자 Ember · 63턴`(1b-2와 같다).

Run: `npm run sim -- run packages/sim/configs/rule6-presets.json`
Expected: `turnLimit · 승자 Aster · 120턴`.

`rule6-presets`의 `report.md`에서 "## 외교" 절을 읽는다. Expected: Dune(수비형)·Ember(외교형)만 제안 수가 0보다 크고, "깬 약속" 열은 모두 0이며, 약속 기록에 불가침·동맹 성립과 불가침 만료가 있다.

- [ ] **Step 2: 프리셋 시드 1~8을 모은다**

`packages/sim/probe.mts`(1회용, 실행 뒤 지운다):
```ts
import { readFileSync } from "node:fs";
import { parseRunConfig } from "./src/config.ts";
import { runMatch, staffFor } from "./src/runner.ts";

const raw = JSON.parse(readFileSync("packages/sim/configs/rule6-presets.json", "utf8"));
const rank = [0, 0, 0, 0, 0, 0];
for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
  const config = parseRunConfig({ ...raw, seed });
  const r = await runMatch(config, config.seats.map((s) => staffFor(s.staff)));
  const c: Record<string, number> = {};
  const inc = (k: string) => (c[k] = (c[k] ?? 0) + 1);
  for (const t of r.turns) {
    for (const e of t.events) {
      if (e.kind === "promise") inc(e.entry.kind === "broken" ? `broken:${r.config.seats[e.entry.by].name}` : e.entry.kind);
      if (e.kind === "proposalSettled" && e.result === "accepted") inc(`ok:${e.offer}`);
    }
  }
  r.result.ranking.forEach((s, i) => (rank[s] += i + 1));
  const issues = r.turns.reduce((s, t) => s + t.issues.flat().length, 0);
  const corr = r.turns.reduce((s, t) => s + t.corrections.flat().length, 0);
  console.log(seed, r.result.reason, r.turns.length, r.config.seats[r.result.winner].name, issues, corr, JSON.stringify(c));
}
console.log(raw.seats.map((s: { name: string }, i: number) => `${s.name} ${(rank[i] / 8).toFixed(2)}`).join(", "));
```

Run: `npx tsx packages/sim/probe.mts`, 그다음 `packages/sim/probe.mts`를 지운다.
Expected(계획 작성 때 복제본 실측): 시드마다 무효 명령 0·확정 수정 0. 약속 깸은 시드 4 Frost 1건, 시드 7 Briar 1건뿐(둘 다 공격형의 의도된 기습). 평균 순위 Aster 2.13, Briar 5.38, Cobalt 2.88, Dune 3.63, Ember 1.63, Frost 5.38. 다르면 기록하고 원인을 찾는다.

- [ ] **Step 3: 실행 중 변경과 진행 상태를 적는다**

계획 머리말 "설계서 대비 변경"에 "(실행 중 반영)" 항목으로 계획과 달라진 점, Task별 테스트 수, Step 1·2 실측을 적는다. `AGENTS.md` "지금 어디에 있나"의 1b-3 문장을 "1b-3 구현 완료(계획 …, 실행 중 변경은 계획 머리말)"로 바꾸고 다음을 "1c 계획"으로 적는다.

- [ ] **Step 4: 커밋(승인된 경우)**

```bash
git -C D:/game/proxywar add AGENTS.md docs/superpowers/plans/2026-10-28-sim-core-1b-3-diplomacy.md
git -C D:/game/proxywar commit -m "docs: 1b-3 외교 구현 완료 기록"
```
