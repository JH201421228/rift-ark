# 58. 무료 + 보상형 광고 — AdMob 부터 출시까지 (실행 순서서)

> **이 문서가 실제로 실행할 순서다.** 다른 문서는 각 단계의 상세를 갖는다.
>
> | 이 문서 | 나머지 |
> |---|---|
> | **무엇을 어떤 순서로 하는가** | 50(Play 상세) · 51(App Store 상세) · 53(영어권) · 56(AdMob 기술) |
>
> 막히면 여기로 돌아와 **어느 단계에서 막혔는지**부터 확인할 것.
> 단계를 건너뛰면 되돌릴 수 없는 것이 두 개 있다 (§0.2).

| | |
|---|---|
| 결정일 | 2026-08-07 (사용자) |
| 모델 | **무료 앱 + 보상형 광고(AdMob) — 클리어 보상 골드 ×1.5 · 하루 무제한 · 1-1 부터** |
| 판정 경위 | [`55-monetization-decision.md`](55-monetization-decision.md) |
| 기술 상세 | [`56-admob-rewarded-integration.md`](56-admob-rewarded-integration.md) |
| 코드 상태 | **구현 완료 · `ads.json:enabled = true`** (실제 ID 투입 2026-08-08) |

---

## 0. 시작하기 전에

### 0.1 지금 어디까지 되어 있는가

**2026-08-08 갱신.** 아래 ✅ 는 실측으로 확인된 것만이다.

```
✅ 코드          logic/adReward.js · native/ads.js · BattleResult 버튼 · meta.ads
✅ 데이터        game/data/ads.json  enabled: true · 배수 1.5 · **하루 무제한** · **1-1 부터**
✅ 플러그인      @capacitor-community/admob@7.2.0  (Capacitor 7 계열)
✅ AdMob 계정·ID  앱 ca-app-pub-6178685918745796~5932212438
                 단위 ca-app-pub-6178685918745796/2344321218  (Android 보상형)
✅ 네이티브      AndroidManifest APPLICATION_ID = 실제 앱 ID (테스트 ID 아님 · 병합 매니페스트 확인)
⚠ 경제 결정     §2 — 사용자가 **무제한**을 선택. npm run economy ✗ (11개 구간 초과)
                 결정이지 회귀가 아니다. CI 게이트에는 없으므로 릴리스는 막히지 않는다
✅ 검사기        check:prod 에 A1–A4 (광고 배선) · check-store-shots 에 신선도 규칙
✅ 스토어 이미지  한/영 각 16장 재촬영 (S-02 · S-03 완료 · 57번 대장)
✅ git 원격      github.com/JH201421228/rift-ark (private)
✅ 릴리스 서명   C:\keys\riftark-release.jks · PKCS12 · 4096-bit · CN=Rift Ark
✅ AAB           jar verified · CN=Rift Ark · versionCode 는 BUILD_NUMBER 로 준다
⏸ CI            codemagic.yaml 은 커밋됨 · **연결은 iOS 단계로 미룸** (2026-08-08 결정)
                 1.0 은 로컬에서 AAB 를 만들어 손으로 올린다 (50 §9.0)

❌ UMP 동의 메시지 (GDPR · US 주) — AdMob 콘솔에서 **게시**까지 해야 한다
❌ AdMob 차단 관리 → 광고 콘텐츠 등급 G/PG
❌ AdMob 지급 프로필 · W-8BEN 확인
✅ 개인정보 처리방침  https://jh201421228.github.io/riftark-privacy/ (한/영 한 페이지)
✅ Play Console 앱 생성 · 앱 콘텐츠 8항목 · 비공개 테스트 업로드 (2026-08-08)
❌ 테스터 12명 옵트인 — **여기서 14일이 시작된다**
❌ 실기기 광고 확인 (§3.3)
✅ S-01 (장면을 2-8 로 옮겨 재촬영 · 57번 §1)
```

> ★ **`❌ git 원격 · 릴리스 서명 키 · CI ← 여전히 임계 경로` 라고 적혀 있던 줄은
> 2026-08-08 에 전부 해소됐다.** 절차는 `50 §1` · `§9.4`.

### 0.2 ★★★ 되돌릴 수 없는 것 둘

| 무엇 | 왜 |
|---|---|
| **무료로 출시하면 유료로 못 바꾼다** | Google Play 는 유료→무료만 허용한다. **앱을 만드는 그 화면에서 결정된다** (Play Console → 앱 만들기 → 무료/유료). 잘못 고르면 앱을 새로 만들어야 하고, 그러면 클로즈드 테스트 14일도 처음부터다 |
| **패키지명(`com.superdimension.app`)** | 한 번 업로드하면 영원히 고정이다. 지금 이름이 게임 이름(`Rift Ark`)과 무관한데, **바꾸려면 지금이 마지막 기회**다 |

> Apple 은 무료↔유료 전환이 **가능**하다. 이 비대칭 때문에 두 스토어의 순서가 다르다.

### 0.3 예상 일정

```
1주차  AdMob 계정 · 광고 단위 · 경제 결정 · git/서명/CI      ← 병렬 가능
2주차  내부 테스트 업로드 → 실기에서 광고 확인
3주차  클로즈드 테스트 시작 ★ 14일 카운트다운 시작
5주차  프로덕션 출시
```
**클로즈드 테스트 14일이 줄일 수 없는 달력 시간이다.** 그래서 §4 를 최대한 앞으로 당긴다.

---

## 1. AdMob 계정과 광고 단위 (30분)

> 상세: [`56 §1`](56-admob-rewarded-integration.md)

### 1.1 순서

1. https://admob.google.com → Google 계정으로 가입
2. **결제 정보 등록** — 광고 수익은 AdSense 를 통해 지급된다. 앱 판매와 **다른 계정 체계**다
3. **앱 추가** → 플랫폼(Android) → "앱이 스토어에 등록되어 있나요?" → **아니요** (아직 안 올렸으므로)
4. 앱 ID 를 받는다: `ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY`
5. **광고 단위 만들기** → **보상형(Rewarded)** → 이름 `stage_clear_bonus`
6. 광고 단위 ID 를 받는다: `ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ`
7. iOS 도 필요하면 3–6 반복 (앱 ID·광고 단위 ID 가 **플랫폼마다 다르다**)

### 1.2 ★ 앱 ID 와 광고 단위 ID 를 헷갈리지 마라

| | 구분자 | 어디에 넣는가 |
|---|---|---|
| **앱 ID** | 물결 `~` | `AndroidManifest.xml` 의 `APPLICATION_ID` · `Info.plist` 의 `GADApplicationIdentifier` |
| **광고 단위 ID** | 슬래시 `/` | `FE/src/game/data/ads.json` 의 `units.android` / `units.ios` |

바꿔 넣으면 초기화가 실패하고, **에러 메시지가 그 사실을 말해 주지 않는다.**

### 1.3 ★★★ 자기 광고를 절대 클릭하지 마라

실제 광고 단위 ID 로 자기 광고를 한 번이라도 클릭하면 **계정이 정지될 수 있고 되돌리기 매우 어렵다.**
그 사고는 언제나 "개발 중에 눌러 봤다"에서 나온다.

이 저장소는 그것을 **코드로** 막아 두었다 — `FE/src/native/ads.js` 가 `import.meta.env.DEV` 일 때
**무조건 테스트 광고 ID** 를 쓴다. 배포 빌드에서만 실제 ID 가 나간다.
실기에서 배포 빌드로 확인해야 할 때는 **AdMob 콘솔에 테스트 기기를 등록**하라.

---

## 2. ★★ 경제 결정 — 여기서 멈춰서 판단해야 한다

**이 단계를 건너뛰면 게임이 망가진다.** 그리고 무료로 출시한 뒤에는 되돌릴 수 없다.

### 2.1 무엇이 문제인가

이 게임의 골드원은 **캠페인 클리어 하나뿐**이다. 그래서 광고 보상은 총수입을 그대로 늘린다.
그런데 게임을 쉽게 만드는 것은 골드가 아니라 **그 골드로 산 파워**이고, 그 파워가 적 HP 대비
얼마인가(파워 비)가 이 게임의 난이도 설계 그 자체다.

`npm run economy` 실측 — **광고 없이**:

| 스테이지 | 파워 비 | 뜻 |
|---:|---:|---|
| 20 | 0.97 | |
| **40** | **0.83** | ← 의도적으로 낮다 |
| **50** | **0.79** | ← 이 구간이 이 게임의 벽이다 |
| **60** | **0.80** | |
| 80 | 1.01 | |

40–60 이 낮은 것은 실수가 아니라 **설계**다. 그 구간의 벽은 **편성 퍼즐**이어야 하고,
그것이 `CLAUDE.md` 설계 결정 5 ("벽은 항상 편성 퍼즐이고 절대 경제 벽이 아니다")다.

> ### ★★★ 아래 표는 **틀렸다** — 2026-08-08 재실측으로 정정
>
> 여기에는 "×2.0·하루1회를 켜면 40:1.40 · 50:1.41 · 60:1.22 (+70~79%) 가 되어
> **40–60 의 벽이 사라진다**" 고 적혀 있었다. **그 값이 어디서 왔는지는 알 수 없고,
> 실측과 맞지 않는다.**
>
> | 스테이지 | 광고 없이 | ×2.0 · 하루 1회 (실측) | 이 문서가 적어 둔 값 |
> |---:|---:|---:|---:|
> | 40 | 0.83 | **0.98** (+19%) | ~~1.40 (+70%)~~ |
> | 50 | 0.79 | **0.93** (+19%) | ~~1.41 (+79%)~~ |
> | 60 | 0.80 | **0.94** (+18%) | ~~1.22 (+53%)~~ |
> | 80 | 1.01 | **1.26** (+24%) ✗ | — |
> | 90 | 1.12 | **1.42** (+28%) ✗ | — |
>
> **40–60 의 벽은 사라지지 않았다.** 셋 다 1.0 미만이라 편성 퍼즐은 살아 있었다.
> 상한(+20%)을 넘는 것은 **80·90** 이고, 그 구간은 광고 없이도 이미 1.0 을 넘는다.
>
> ⚠ 이 오차는 §2.2 의 선택지 판단을 통째로 바꾼다 — 실제 문제는
> "설계의 핵심 구간이 무너진다"가 아니라 "후반 두 구간이 더 쉬워진다" 였다.
> **결정 전에 `npm run economy` 를 직접 돌린다. 이 표가 아니라 그 출력이 권위다.**

### 2.2 선택지 — 하나를 골라야 한다

| | 무엇 | 광고 수익 | 대가 |
|---|---|---|---|
| **A** | 수치를 낮춘다 (×1.5 · 하루 2회 → 게이트 통과) | ★ **오히려 높다** — 아래 |
| **B** | **2배를 유지하고 80·90 을 재보정한다** | 같다 | `difficultyMult` 조정 + `balance:check` 300시드(약 2시간). 미결인 B3·BN3 와 얽힌다 |
| **C** | 골드가 아닌 보상으로 바꾼다 (예: 그 판의 각인 리롤 +1) | 가장 높다 — 하루 상한이 필요 없어 매 전투마다 제안할 수 있다 | 리롤은 기록보관소 시설과 축이 겹친다. 별도 설계 판단 필요 |

> ### ⚠ **2026-08-08 오후 — 사용자가 무제한을 선택했다. 아래 A 결론은 갱신됐다**
>
> `dailyViews: 0`(무제한) · `minStage: 1`. **`npm run economy` 는 실패 상태이고
> 그것이 정직한 상태다** — 실측(하루 2회 +19% ✅ / 3회 +28% ✗ / 10회 +69% ✗ /
> 무제한 = 11개 구간 초과)을 읽은 뒤의 **결정**이지 회귀가 아니다.
> 되돌리는 방법은 `dailyViews` 2 · `minStage` 6 으로 되돌리는 것 하나뿐이다.
> 근거와 무엇이 걸려 있는지는 `CLAUDE.md` 의 광고 절.
>
> ### (이전) 결론: A (×1.5 · 하루 2회) — 2026-08-08 오전 확정
>
> 2026-08-07 에는 B(2배 유지 + 재보정)를 골랐고 재보정은 하지 않은 채였다.
> 08-08 에 `enabled` 를 켜자 **`npm run economy` 가 경고가 아니라 실패로** 바뀌었고
> (꺼져 있는 동안에는 경고였다 — 그래서 통과처럼 보였다), 조합을 재실측했다:
>
> | 조합 | 결과 |
> |---|---|
> | ×2.0 · 하루 1회 | ✗ 2개 구간 초과 |
> | ×2.0 · 하루 2회 | ✗ 6개 구간 초과 |
> | **×1.5 · 하루 2회** | ✅ **통과** ← 확정 |
> | ×1.4 · 하루 2회 · ×1.3 · 하루 3회 | ✅ 통과 |
>
> ★★ **A 를 "수치를 낮춰 수익을 포기하는 선택지"로 적어 둔 것이 틀렸다.**
> 하루 노출이 **1회 → 2회**로 늘어난다. 하루 총 보너스는 비슷한데
> (1×+100% vs 2×+50%) **노출이 두 배**라 광고 수익 기대치는 **오른다.**
> 게이트를 만족시키는 쪽이 더 벌었다.
>
> ★ 부수 효과로 `cooldownMs`(30초)가 **살아났다.** 하루 1회에서는 한 번 보면 남은
> 횟수가 0 이라 `canWatchAd` 가 언제나 `daily` 로 먼저 막아, 쿨다운이 단 한 번도
> 발동할 수 없는 죽은 설정이었다.

### 2.3 B 를 고른 경우 해야 할 일

```bash
cd FE
# ① 지금 상태 확인 — 광고를 켜면 몇 구간이 초과하는지 미리 말해 준다
npm run economy
#   ⚠ 광고를 켜면 2개 구간에서 파워가 +20% 를 넘는다 (×2 · 하루 1회 · 6스테이지부터)

# ② 초과 구간의 difficultyMult 를 올린다 (stages.json)
#    또는 goldPerStageBase 를 낮춘다 (balance.json:economy)
# ③ 다시 잰다
npm run economy
# ④ 실제 전투로 검증 — 여기가 진짜다 (약 2시간)
npm run balance:check
```

**④ 를 건너뛰지 마라.** `economy` 는 "도달할 수 있는가"를 보고 `balance:check` 는
"그 파워로 실제로 이기는가"를 본다. 둘은 다른 질문이다.

> ⚠ **`goldPerStageBase` 를 낮추는 방향은 위험하다.** 광고를 안 보는 플레이어가
> 경제 벽에 부딪히게 되고, 그것은 설계 결정 5 를 다른 방향으로 어기는 것이다.
> `difficultyMult` 쪽을 먼저 시도하라.

---

## 3. 코드 켜기 (10분)

### 3.1 실제 ID 를 넣는다

`FE/src/game/data/ads.json`
```json
"units": {
    "android": "ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ",
    "ios": "ca-app-pub-XXXXXXXXXXXXXXXX/WWWWWWWWWW"
},
"enabled": true
```

`FE/android/app/src/main/res/../AndroidManifest.xml` — `APPLICATION_ID` 를 실제 앱 ID 로
`FE/ios/App/App/Info.plist` — `GADApplicationIdentifier` 를 실제 앱 ID 로

### 3.2 검증

```bash
cd FE
npm run economy      # ★ 여기서 실패하면 §2 로 돌아가라. 넘기지 마라
npm run verify       # lint · test · data:validate · check · icons · economy · balance · playthrough · prod
```

### 3.3 실기 확인

```bash
JAVA_HOME="C:/Program Files/Java/jdk-21.0.10" npm run build:android
cd android && JAVA_HOME="C:/Program Files/Java/jdk-21.0.10" ./gradlew assembleDebug
```

디버그 빌드는 **테스트 광고**가 뜬다. 확인할 것:

- [ ] 6스테이지 이상을 깨면 결과 화면에 **[광고 보고 골드 2배]** 가 뜬다
- [ ] 누르면 광고가 뜨고, **끝까지 보면** 골드가 들어오고 `+N 골드` 가 표시된다
- [ ] **중간에 닫으면** 보상이 없고 **버튼이 굳지 않는다** (이 경로가 가장 잘 깨진다 — `56 §5.3`)
- [ ] 같은 판에서 두 번째는 "오늘 0회 남음"으로 막힌다
- [ ] **비행기 모드**에서도 게임이 정상이고 버튼만 비활성이다
- [ ] 광고가 끝난 뒤 **시스템 바가 다시 숨겨진다** (안 그러면 가로에서 좌우 터치가 먹히지 않는다)

---

## 4. 스토어 — Google Play (임계 경로)

> 상세: [`50-google-play-paid-codemagic.md`](50-google-play-paid-codemagic.md)

### 4.1 앞선 전제 (아직 하나도 안 되어 있다)

`docs/04-plan/35-remaining-work-roadmap.md` 의 R-01 ~ R-05 가 먼저다.

```
R-01  git 저장소 + 원격 푸시     ← Codemagic 은 Git 원격에서만 빌드한다
R-02  릴리스 서명 키스토어        ← 잃어버리면 그 앱을 영원히 업데이트 못 한다
R-03  버전 자동화
R-04  targetSdk 정책 확인
R-05  AAB 빌드
```

### 4.2 앱 만들기 — ★ 무료로

Play Console → 앱 만들기

| 항목 | 값 |
|---|---|
| 앱 이름 | `균열의 방주` (기본 언어 한국어) |
| **무료 또는 유료** | **무료** ← ★★★ **되돌릴 수 없다** |
| 앱 또는 게임 | 게임 |

### 4.3 광고 때문에 답이 바뀌는 것들

| 항목 | 광고 없을 때 | **광고 있을 때** |
|---|---|---|
| 앱에 광고 포함 | 아니요 | **예** ← 리스팅에 "광고 포함"이 표시된다 |
| Data safety — 수집 | 없음 | **기기/광고 ID 수집** (목적: 광고) |
| 개인정보 처리방침 | "아무것도 수집하지 않습니다" | **전면 재작성** ([`56 §4`](56-admob-rewarded-integration.md)) |
| 타깃 연령층 | — | **13세 이상**으로 답한다. 아동 대상이 되면 광고가 제한된다 |
| 스토어 설명의 "광고 없음" | 참 | **거짓 — 반드시 삭제** ([`52`](52-store-image-codex-prompts.md) · [`54`](54-english-store-art-codex-prompts.md)) |

### 4.4 테스트 트랙 → 클로즈드 테스트 14일

1. **내부 테스트**에 먼저 올린다 (즉시 반영 · 인원 제한 없음). 여기서 **실제 광고**를 처음 본다
2. 문제가 없으면 **클로즈드 테스트** 시작 — 개인 계정은 **12명 이상 · 14일 연속** 참여가 필요하다
3. 14일 동안 §5 의 영어권 준비를 병행한다

> ⚠ **테스터가 실제로 플레이해야 한다.** 2026-04 이후 구글이 참여도를 본다.
> 설치만 하고 안 켜는 12명으로는 통과하지 못한다.

---

## 5. 스토어 — App Store (선택 · 나중)

> 상세: [`51-app-store-paid-codemagic.md`](51-app-store-paid-codemagic.md)

Apple 은 무료↔유료 전환이 자유롭고 유료 앱 계약도 필요 없으므로 **Play 보다 마찰이 적다.**
다만 **ATT · Privacy Manifest · 아이콘 세트**가 추가로 필요하고, iOS 아이콘은 **아직 없다**
(`FE/resources/icon-1024.png` 가 원본).

Play 를 먼저 끝내고 오는 것을 권한다 — 두 스토어를 동시에 처음 하는 것은 실수를 두 배로 만든다.

---

## 6. 영어권 확대

> 상세: [`53-english-market-paid-release.md`](53-english-market-paid-release.md)

앱은 이미 **한국어·영어**를 지원한다 (`docs/03-tech/29-i18n.md`).
남은 것은 스토어 쪽이다:

- 영어 리스팅 (이름 `Rift Ark` · 짧은 설명 · 긴 설명 · 스크린샷 카피) — [`54`](54-english-store-art-codex-prompts.md)
- **GDPR/UMP 동의 메시지** (EU/영국) — 이것이 없으면 EU 배포를 켜면 안 된다
- **EU DSA 거래자 지위** — 개인 계정이면 주소·전화가 공개된다. 켜기 전에 확인
- 영문 개인정보 처리방침

> **클로즈드 테스트 14일은 앱 단위로 한 번**이다. 국가를 넓힐 때 다시 하지 않는다.

---

## 7. 전체 체크리스트

### 준비
- [ ] AdMob 계정 · 결제 정보
- [ ] Android 앱 등록 → 앱 ID · 보상형 광고 단위 ID
- [ ] (iOS 도 낼 거면) iOS 앱 등록 → 앱 ID · 광고 단위 ID
- [ ] **§2 경제 결정** — A / B / C 중 하나. B 면 재보정까지
- [ ] `ads.json` 에 실제 광고 단위 ID · `enabled: true`
- [ ] `AndroidManifest.xml` · `Info.plist` 에 실제 앱 ID
- [ ] `npm run economy` 통과
- [ ] `npm run verify` 통과
- [ ] 실기 확인 6항목 (§3.3)

### 저장소·빌드 (R-01~R-05)
- [ ] git 저장소 + 원격 (private)
- [ ] 릴리스 서명 키스토어 — **백업 2벌 이상**
- [ ] 버전 자동화 · targetSdk 확인
- [ ] AAB 빌드 성공

### 법무
- [ ] 개인정보 처리방침 한국어 — 광고 버전으로 재작성 · 공개 URL
- [ ] 개인정보 처리방침 영어 (영어권 낼 때)
- [ ] UMP 동의 메시지 구성 (EU/영국)
- [ ] Data safety 폼 — 광고 ID 수집으로 답변
- [ ] (iOS) App Privacy · Privacy Manifest · ATT 판단

### 스토어
- [ ] Play Console 앱 만들기 — **무료** ★ 되돌릴 수 없음
- [ ] "앱에 광고 포함" **예**
- [ ] 타깃 연령층 13세 이상
- [ ] 아이콘 512 · 피처 그래픽 · 스크린샷 (**"광고 없음" 카피 전부 제거 확인**)
- [ ] 등급분류(IARC) — 광고 포함으로 답변
- [ ] 내부 테스트 업로드 → 실제 광고 확인
- [ ] 클로즈드 테스트 12명 · 14일 ★
- [ ] 프로덕션 출시

---

## 8. 자주 막히는 곳

| 증상 | 원인 | 어디를 보나 |
|---|---|---|
| 앱이 시작하자마자 죽는다 | `AndroidManifest` 의 `APPLICATION_ID` meta-data 가 없거나 잘못됐다. SDK 가 **프로세스 시작 시** 읽는다 — 광고를 꺼도 죽는다 | [`56 §2`](56-admob-rewarded-integration.md) |
| 광고 버튼을 눌렀는데 굳는다 | 보상 없이 닫히면 플러그인이 resolve 하지 않는다. `native/ads.js` 가 이벤트와 경주시켜 해결 | [`56 §5.3`](56-admob-rewarded-integration.md) |
| 광고 뒤 좌우 터치가 안 먹는다 | 시스템 바가 돌아왔다. `prepareRewardVideoAd` 의 `immersiveMode: true` | `CLAUDE.md` 몰입 모드 |
| 광고가 안 뜬다 (실기) | 신규 광고 단위는 **채워지기까지 몇 시간** 걸린다. 테스트 ID 로 먼저 확인 | [`56 §7`](56-admob-rewarded-integration.md) |
| `npm run economy` 실패 | 광고 보상이 파워 곡선을 +20% 넘게 밀었다 | **§2** |
| 스토어 반려 — 오도성 표시 | 설명에 "광고 없음"이 남아 있다 | [`52`](52-store-image-codex-prompts.md) · [`54`](54-english-store-art-codex-prompts.md) |

---

## 관련 문서

| 무엇 | 어디 |
|---|---|
| 왜 이 모델을 골랐나 (계산과 뒤집힘) | [`55-monetization-decision.md`](55-monetization-decision.md) |
| AdMob 기술 상세 · 동의 · 방침 전문 | [`56-admob-rewarded-integration.md`](56-admob-rewarded-integration.md) |
| Google Play 절차 | [`50-google-play-paid-codemagic.md`](50-google-play-paid-codemagic.md) |
| App Store 절차 | [`51-app-store-paid-codemagic.md`](51-app-store-paid-codemagic.md) |
| 영어권 | [`53-english-market-paid-release.md`](53-english-market-paid-release.md) |
| 스토어 이미지·카피 (한/영) | [`52`](52-store-image-codex-prompts.md) · [`54`](54-english-store-art-codex-prompts.md) |
| 저장소·서명·CI (R-01~R-05) | `../04-plan/35-remaining-work-roadmap.md` |
