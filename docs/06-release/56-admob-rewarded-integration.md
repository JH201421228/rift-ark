# 56. AdMob 보상형 광고 — 무료 전환의 절차와 그 대가

> 대상: **RIFT ARK / 균열의 방주** · `com.superdimension.app` · Capacitor 7 (React 19 · Phaser 3.90)
> 작성일 **2026-08-07** · 작업 환경 Windows 11 · 개발자 1인
>
> **이 문서는 `55-monetization-decision.md` 의 결론이 뒤집힌 뒤에 필요한 것 전부다.**
> AdMob 계정부터 스토어 제출물 · 앱 안의 규약 · 경제 재보정 · 테스트 · 출시 순서까지.

---

## ⚠ 이 문서를 읽는 법 — 확인한 것과 추정한 것

| 표기 | 뜻 |
|---|---|
| **[확인 2026-08-07]** | 이 날짜에 공식 문서 · npm 레지스트리 · 플러그인 소스에서 직접 확인했다. 링크는 §9 |
| **[소스 확인]** | `@capacitor-community/admob` v7.2.0 의 **실제 코드**를 읽고 확인했다 |
| **[실측]** | 이 저장소의 파일 · 도구 출력에서 직접 잰 값이다 |
| **[추정]** | 관행 · 유사 사례에서 유추했다. **그대로 믿지 말고 화면에서 확인한다** |
| **[화면이 권위]** | 문서와 콘솔 화면이 다르면 **화면이 맞다** |

**스토어 정책과 SDK 는 이 문서보다 빨리 바뀐다.** 특히 §3(동의)과 §4(제출물)은
분기마다 문항이 늘어난다. 화면에 없는 항목을 찾느라 시간을 쓰지 말고, 화면에 있는데
여기 없는 항목이 나오면 **그 항목이 새로 생긴 것**이다.

---

## 0. 이 문서는 무엇을 뒤집는가

`55-monetization-decision.md` 는 2026-08-07 에 **유료 유지**로 판정했다. 계산은 이랬다 —
유료 $3.99 의 설치당 순수익 **$3.39**, 무료+보상형의 설치당 기대수익 **$0.14 ~ $0.26**,
따라서 광고가 이기려면 설치가 **13~24배** 더 나와야 하는데 업계 관측치는 **9~10배**다.
그리고 골드원이 캠페인 클리어 하나뿐이라 "클리어 골드 2배"는 총수입을 **정확히 2배**로
밀어 40–60 구간의 벽을 지운다.

사용자는 그 계산을 받아들인 뒤에 결론을 뒤집었다. 이유는 계산의 오류가 아니라
**계산이 딛고 선 전제**다 — *유료라는 진입장벽 때문에 설치 자체가 급감할 것 같다.*
설치당 기대수익은 설치가 있어야 의미가 있는 값이고, 55 의 "9~10배"는 이미 발견된
앱들의 평균이지 무명 1인 개발자의 첫 앱이 받는 값이 아니다. **그 판단은 사용자의
것이고, 이 문서는 그 결정의 구현이다.**

### 0.1 그러므로 이 문서는 55 를 부정하지 않는다

55 의 표는 **전부 여전히 참**이다. 바뀐 것은 어느 위험을 감수할지의 선택뿐이다.

| 55 가 말한 것 | 지금도 참인가 | 그래서 무엇을 감수하는가 |
|---|---|---|
| 설치당 기대수익이 13~24배 차이난다 | **참** | 설치 수가 그만큼 나오지 않으면 **총수익이 유료보다 적다.** 알고 간다 |
| 골드 2배는 경제를 그 자리에서 2배로 민다 | **참 — 하네스 실측으로 확인됐다** | ×2.0 · 하루 1회로도 **파워가 최대 +28%** 올라 2개 구간이 상한을 넘는다 (§6.4). 사용자는 2배를 유지하기로 했으므로 **경제를 재보정한다** (§6.6–6.7) |
| 보상을 줄이면 시청률이 떨어져 수익도 떨어진다 | **참** | 출구가 없다. **§6 의 손잡이 표가 그 트레이드오프의 좌표계**다 |
| "No ads. No IAP. No gacha." 가 최강 카피였다 | **참** | 한 줄을 잃는다. 남는 두 줄(**No IAP · No gacha**)은 그대로 강하다 |
| 무료 → 유료 전환은 불가능하다 | **참** | ★ **이것 하나만 되돌릴 수 없다.** §0.2 |

### 0.2 ★★★ 되돌릴 수 없는 것은 정확히 하나다

| 결정 | 되돌릴 수 있는가 |
|---|---|
| **앱을 무료로 만든다** | ✗ **불가능.** Google Play 는 유료→무료만 허용한다 (`50 §8.1`). 무료로 만든 앱을 유료로 바꿀 수 없다 |
| 광고를 켠다 | ○ `ads.json:enabled` 를 false 로 되돌리면 광고가 사라진다 |
| 보상 배수를 바꾼다 | ○ 데이터 한 줄 |
| 광고 SDK 를 뺀다 | ○ 플러그인 제거 + 제출물 원복. 다만 **개인정보처리방침 이력은 남는다** |
| Data safety 답변을 "수집 없음"으로 되돌린다 | ○ SDK 를 빼면 정직하게 되돌아간다 |

> ★ 그래서 **순서를 나눈다.** 무료로 만드는 결정(되돌릴 수 없음)과 광고를 켜는
> 결정(되돌릴 수 있음)은 같은 날 할 필요가 없다. §8 의 체크리스트가 그렇게 짜여 있다.

### 0.3 함께 사라지는 명제들

광고 SDK 하나가 들어오면 이 프로젝트가 4개월간 유지한 명제 셋이 동시에 깨진다.
**깨지는 것 자체가 문제는 아니고, 깨진 줄 모르는 것이 문제다** — 아래는 각각
어느 문서의 어느 절을 고쳐야 하는지의 목록이다.

| 명제 | 어디에 적혀 있었나 | 무엇으로 바뀌나 |
|---|---|---|
| **수집 0** | `50 §7` · `53 §5.1–5.3` | 광고 ID · IP · 상호작용 · 진단정보 (§4) |
| **SDK 0 · 서버 0** | `50 §7.2` · `53 §5.1` | Google Mobile Ads SDK + UMP (§2) |
| **완전 오프라인** | `50 §4.3` 스토어 설명 · `53 §5.1` | 게임은 오프라인, **광고만** 네트워크 (§5.4) |
| **적용 대상 없음(COPPA·GDPR·CCPA)** | `53 §5.5.2` | **전부 적용 대상이 된다** (§3) |
| 스토어 설명의 "광고가 없습니다" | `50 §4.3` · `53 §6.6` · `52 §4` · `54 §4` | **삭제 필수.** 남기면 허위 표시 반려 |

---

## 1. AdMob 계정 · 앱 등록

### 1.1 순서

| # | 무엇 | 어디 |
|---|---|---|
| 1 | AdMob 가입 (Google 계정) | `admob.google.com` |
| 2 | 지급 프로필 · 세금 정보 | AdMob → 지급 |
| 3 | 앱 등록 — **Android 와 iOS 를 각각 등록한다** | AdMob → 앱 → 앱 추가 |
| 4 | 보상형 광고 단위 생성 (앱마다 1개) | AdMob → 앱 → 광고 단위 |
| 5 | Play Console / App Store Connect 연결 | AdMob → 앱 → 앱 설정 |
| 6 | 광고 콘텐츠 등급 제한 | AdMob → 차단 관리 → 광고 콘텐츠 등급 |
| 7 | GDPR / US States 메시지 생성 | AdMob → 개인정보 보호 및 메시지 |

> ★ **아직 스토어에 없는 앱도 등록된다.** AdMob 은 "앱이 앱스토어에 등록되어
> 있습니까?" 에 **아니오**를 허용한다. 나중에 실제 앱과 연결하면 된다.
> **그래서 스토어 심사보다 먼저 광고 단위 ID 를 손에 넣을 수 있다** — 이 순서가
> 중요한 이유는 §2 의 `AndroidManifest.xml` 이 **앱 ID 없이는 앱을 부팅조차 못
> 시키기** 때문이다.

### 1.2 ★ 앱 ID 와 광고 단위 ID 는 다른 것이다 — 여기서 절반이 막힌다

| | 앱 ID (Application ID) | 광고 단위 ID (Ad Unit ID) |
|---|---|---|
| 모양 | `ca-app-pub-0000000000000000` **`~`** `0000000000` | `ca-app-pub-0000000000000000` **`/`** `0000000000` |
| 구분자 | **물결표 `~`** | **슬래시 `/`** |
| 개수 | 앱(플랫폼)마다 **1개** | 광고 자리마다 1개 |
| 어디에 넣나 | `AndroidManifest.xml` · `Info.plist` — **네이티브 설정** | 코드 (`ads.json:units`) |
| 틀리면 | **앱이 시작하자마자 죽는다** (§2.3) | 광고가 안 뜬다 (앱은 산다) |

> ⚠ **둘 다 `ca-app-pub-` 로 시작하고 앞 16자리가 같다.** 눈으로는 구분되지 않는다.
> **`~` 인지 `/` 인지만 본다.** 광고 단위 ID 를 매니페스트에 넣으면 초기화가
> 실패하고, 앱 ID 를 `adId` 에 넣으면 광고가 영원히 로드되지 않는다.

### 1.3 ★★★ 테스트 광고 — 자기 광고를 클릭하면 계정이 정지된다

**개발 중에 실제 광고 단위 ID 로 광고를 띄우고 그것을 한 번이라도 누르면
AdMob 계정이 정지될 수 있다.** 무효 트래픽(invalid traffic) 정책이고, 정지는
**되돌리기 매우 어렵다.** 그리고 그 사고는 악의가 아니라 *"잘 나오나 눌러 봤다"*
에서 나온다.

**구글이 공식으로 제공하는 테스트 단위**를 쓴다 [확인 2026-08-07].

| 플랫폼 | 보상형 테스트 광고 단위 ID |
|---|---|
| Android | `ca-app-pub-3940256099942544/5224354917` |
| iOS | `ca-app-pub-3940256099942544/1712485313` |

이 값들은 이미 `FE/src/game/data/ads.json:units` 에 들어 있다 [실측 2026-08-07].
그리고 어댑터(`native/ads.js`)가 **개발 빌드에서는 무조건 테스트 ID 로 떨어지도록**
`import.meta.env.DEV` 로 분기한다 — 이 분기는 빌드 시 리터럴이라 배포 번들에
남지 않는다.

> ★ **실제 ID 가 비어 있어도 테스트 ID 로 떨어진다.** 실수로 빈 값이 배포되면
> "광고가 안 뜬다"로 끝나고, 잘못된 ID 로 매출이 남의 계정에 가지 않는다.
> **안전한 실패 방향을 고른 것**이지 게으름이 아니다.

**실기기에서 실제 광고를 확인해야 할 때는** 테스트 ID 가 아니라
**테스트 기기 등록**을 쓴다 (§7.3). 실제 단위 ID + 등록된 기기 = 실제 광고가
뜨지만 노출·클릭이 집계되지 않는다.

### 1.4 광고 콘텐츠 등급 — Play 정책이 요구한다

Play 는 **앱에 표시되는 광고도 앱의 콘텐츠 등급을 넘지 않을 것**을 요구한다
[확인 2026-08-07]. 이 게임의 예상 등급은 ESRB **E10+** · PEGI **7** · 국내
**전체~12세** 다 (`53 §4.1`).

| 어디 | 설정 |
|---|---|
| AdMob → 차단 관리 → 광고 콘텐츠 등급 | **G (전체 이용가)** 또는 PG |
| 코드 (`AdMob.initialize`) | `maxAdContentRating: MaxAdContentRating.General` [소스 확인 — v7.2.0 `AdMobInitializationOptions`] |

> **두 곳에 같은 말을 적는다.** 계정 설정은 계정 전체에, 초기화 옵션은 이 앱의
> 요청에만 적용된다. 둘이 다르면 더 엄격한 쪽이 이긴다 [추정].
> **더 낮은 등급으로 제한할수록 eCPM 이 떨어진다** — 55 §1.2 의 $8~15 는
> 그 제한을 감안하지 않은 값이다.

---

## 2. 플러그인 설치와 네이티브 설정

### 2.1 버전 — Capacitor 7 은 8.0.0 을 쓰지 않는다

npm 레지스트리 실측 [확인 2026-08-07]:

| 플러그인 버전 | 게시일 | 대상 Capacitor |
|---|---|---|
| `7.0.0` | 2025-02-09 | 7 |
| `7.0.3` | 2025-04-30 | 7 |
| **`7.2.0`** | **2025-10-25** | **7** ← **이 프로젝트가 쓸 것** |
| `7.2.1-0` | 2025-12-19 | 7 (프리릴리스 — 쓰지 않는다) |
| `8.0.0` | 2025-12-27 | **8** |

`7.2.0` 의 `dependencies` 는 `@capacitor/core: ^7.0.0` 이다 [확인 — npm 레지스트리].
`8.0.0` 은 `^8.0.0` 을 본다. **이 저장소는 Capacitor 7.x 이므로 8.0.0 을 설치하면
peer 충돌이 나거나, 더 나쁘게는 설치는 되고 네이티브에서 깨진다.**

```bash
cd FE
npm i @capacitor-community/admob@7.2.0
npm run build            # dist 갱신 — cap sync 는 dist 를 복사한다
npx cap sync android
npx cap sync ios         # macOS 에서만
```

> ★ **`cap sync` 는 `npm run build` 뒤에 돈다.** 순서를 바꾸면 옛 `dist` 가
> 네이티브로 들어간다 — 이 저장소는 이미 `build:android` 스크립트가 그 순서다.

### 2.2 SDK 요구치 — 이 프로젝트는 이미 만족한다

`@capacitor-community/admob` v7.2.0 의 `android/build.gradle` [확인 2026-08-07]:

| 항목 | 플러그인 요구 | 이 프로젝트 [실측 `FE/android/variables.gradle`] | 판정 |
|---|---|---|---|
| `minSdkVersion` | 23 | **23** | ○ 그대로 |
| `compileSdkVersion` | 35 | **35** | ○ 그대로 |
| `play-services-ads` | `24.7.+` | — | 자동 |
| `user-messaging-platform` | `3.1.0` | — | 자동 |
| `INTERNET` 권한 | 필요 | **이미 있다** | ○ |

**minSdk 를 올릴 필요가 없다.** 이것은 운이 아니라 이 저장소가 Capacitor 7 기본값을
그대로 쓴 결과다.

> ⚠ **`play-services-ads` 가 `24.7.+` 라는 플로팅 버전인 것에 주의한다.**
> 빌드 시각에 따라 다른 버전이 잡혀 **어제 되던 빌드가 오늘 깨질 수 있다.**
> CI(Codemagic)에서 재현 불가능한 실패가 나면 여기를 먼저 의심한다.
> 고정하려면 `variables.gradle` 에 `playServicesAdsVersion = '24.7.0'` 을 넣는다
> [추정 — 플러그인이 `rootProject.ext` 를 먼저 읽는 관례를 따른다. 화면이 권위].

### 2.3 ★★★ `AndroidManifest.xml` — 이것이 없으면 앱이 시작하자마자 죽는다

**Google Mobile Ads SDK 는 앱 ID 가 매니페스트에 없으면 `IllegalStateException` 을
던지며 프로세스를 종료시킨다.** 광고를 띄우려 할 때가 아니라 **앱이 뜰 때** 죽는다.
그리고 이 크래시는 개발 중에는 잘 안 보인다 — `cap sync` 직후 실기기에서 처음
확인하다가 "설치는 됐는데 아이콘을 누르면 튕긴다"로 만난다.

**현재 상태 [실측 2026-08-07] — 이미 들어가 있다.**
`FE/android/app/src/main/AndroidManifest.xml` 의 `<application>` 안:

```xml
<meta-data
    android:name="com.google.android.gms.ads.APPLICATION_ID"
    android:value="ca-app-pub-3940256099942544~3347511713" />
```

iOS 는 `FE/ios/App/App/Info.plist` 의 `GADApplicationIdentifier` =
`ca-app-pub-3940256099942544~1458002511` [실측].

**둘 다 구글 공식 테스트 앱 ID 다.** AdMob 계정을 만들고 실제 앱을 등록하면
`ca-app-pub-<계정>~<앱>` 으로 바꾼다.

> ★★★ **트리거는 코드가 아니라 매니페스트다.** `ads.json:enabled` 가 `false` 여서
> 우리가 SDK 를 한 번도 부르지 않아도 **SDK 는 앱 시작 시 이 meta-data 를 읽는다.**
> 즉 **"광고를 끄면 괜찮다"가 성립하지 않는다** — 플러그인을 의존성에 넣는
> 순간부터 이 줄이 필요하다. §8 의 1단계(광고 없이 1.0 출시)를 고른다면
> **플러그인 자체를 넣지 않아야** 한다.

| 값을 `strings.xml` 로 뺄 것인가 | |
|---|---|
| 지금(인라인) | 값이 **빌드 타입과 무관하게 하나**다. 디버그/릴리스를 나눌 수 없다 |
| `@string/admob_app_id` 로 빼면 | `src/debug/res/values/strings.xml` 로 **디버그 전용 앱 ID** 를 덮어쓸 수 있다 |
| 권장 | 실제 앱 ID 를 넣는 시점(§8 2단계)에 함께 뺀다. 그전까지는 양쪽 다 테스트 ID 라 나눌 이유가 없다 |

> ★★ **이 매니페스트는 `cap sync` 가 덮어쓰지 않는다.** Capacitor 는 네이티브
> 프로젝트를 사용자 소유로 다루고 플러그인의 매니페스트는 **머지**한다. 이 저장소의
> 매니페스트에는 이미 손으로 넣은 것이 있다 — `screenOrientation="sensorLandscape"`
> 와 `configChanges` (`25-capacitor-mobile.md` §3.1). **그것들을 지우지 않도록
> 새 `<meta-data>` 만 추가한다.**

### 2.4 ★ `AD_ID` 권한이 조용히 들어온다 — Play Console 선언이 따라온다

`play-services-ads` 20.4.0 이상은 **`com.google.android.gms.permission.AD_ID` 를
매니페스트 머지로 자동 추가한다** [확인 2026-08-07]. 우리가 쓰는 24.7.x 는 당연히
해당된다.

| 결과 | 대응 |
|---|---|
| APK 의 권한 목록에 `AD_ID` 가 생긴다 | 정상. 지우지 않는다 |
| Play Console 이 **광고 ID 선언**을 요구한다 | §4.1 에서 "예"로 답한다 |
| 선언하지 않으면 | **릴리스가 차단되거나 경고 메일이 온다** — "Your advertising ID declaration says your app does not use advertising ID, but…" |

> ★ 광고 ID 수집을 **끄는 것도 가능하다** (매니페스트에서 권한을 `remove` 한다).
> 그러면 Data safety 의 "기기 또는 기타 ID" 행이 사라지지만 **개인화 광고가
> 불가능해져 eCPM 이 떨어진다** [추정]. 이 게임은 광고 수익이 목적이므로 켠다.

### 2.5 iOS — `Info.plist`

`FE/ios/App/App/Info.plist` 에 넣는다.

| 키 | 값 | 비고 |
|---|---|---|
| `GADApplicationIdentifier` | `ca-app-pub-…~…` (iOS 앱 ID) | **필수.** 없으면 Android 와 똑같이 부팅 시 죽는다 |
| `SKAdNetworkItems` | `SKAdNetworkIdentifier` 딕셔너리의 배열 | **구글 문서에서 복사한다.** 손으로 쓰지 않는다 |
| `NSUserTrackingUsageDescription` | §3.3 의 문구 | ATT 프롬프트 본문 |
| `GADIsAdManagerApp` | — | **넣지 않는다.** Google Ad Manager 용이고 AdMob 에는 불필요 |

> ★ **`SKAdNetworkItems` 목록은 구글이 갱신한다.** 구글 자신의 값은
> `cstr6suwn9.skadnetwork` 이고 나머지는 제휴 구매자들이다 [확인 2026-08-07].
> **§9 의 "Privacy strategies (iOS)" 문서에서 현재 목록을 통째로 복사해 붙인다** —
> 손으로 옮겨 적으면 한 줄이 빠지고, 빠진 줄은 **아무 오류도 내지 않은 채
> 그 네트워크의 어트리뷰션만 조용히 사라진다.**

### 2.6 충돌이 났을 때

| 증상 | 원인 | 대처 |
|---|---|---|
| `Manifest merger failed … minSdkVersion` | 다른 플러그인이 더 낮은 minSdk | `variables.gradle` 의 `minSdkVersion` 을 23 이상으로 (이미 23) |
| `Duplicate class com.google.android.gms.*` | Play Services 버전이 둘 | `./gradlew :app:dependencies` 로 어느 플러그인이 끌고 오는지 본다 |
| `Could not find play-services-ads:24.7.+` | 네트워크 · 저장소 순서 | `google()` 저장소가 `build.gradle` 최상단에 있는지 |
| 앱이 실행 즉시 종료 | §2.3 의 `meta-data` 누락 또는 `~`/`/` 혼동 | logcat 에 `AdMob` 로 필터 |
| iOS 빌드에서 `GADApplicationIdentifier` 경고 | `Info.plist` 누락 | §2.5 |

### 2.7 APK 크기

**실측 2026-08-07 — 플러그인 7.2.0 을 넣고 APK 를 다시 만들었다:**

| | |
|---|---|
| 광고 전 | **33.4 MB** |
| 광고 후 | **38.4 MB** |
| 증가 | **+5.0 MB** (약 +15%) |

dex 에서 SDK 포함을 확인했다. 사전 추정 범위(+2~5MB)의 **상단**에 붙었다.

> ⚠ **이 저장소의 릴리스 빌드는 `minifyEnabled false` 다** [실측
> `FE/android/app/build.gradle`]. R8 이 꺼져 있어 광고 SDK 의 미사용 클래스가
> 그대로 남는다 — +5MB 가 상단인 이유다. **광고를 붙이는 김에 R8 을 켜는 것을
> 검토한다** (2~3MB 는 돌아올 것 [추정]) — 다만 R8 은 리플렉션을 쓰는 SDK 에서
> 런타임 크래시를 만들 수 있으므로, **켠 빌드로 실기기에서 광고를 한 번 띄워
> 보기 전까지는 켰다고 말하지 않는다.**

---

## 3. 동의 · 프라이버시 — 여기가 가장 실수가 많다

### 3.1 UMP(User Messaging Platform) — 순서가 곧 정책이다

EEA · 영국 · 스위스 사용자에게는 **광고를 요청하기 전에 동의를 받아야 한다**
(Google EU 사용자 동의 정책 · GDPR · ePrivacy) [확인 2026-08-07].

**정확한 순서** [확인 2026-08-07 — 구글 UMP 문서]:

| # | 무엇 | 왜 이 자리인가 |
|---|---|---|
| 1 | `AdMob.initialize(...)` | ★ **초기화 자체는 개인정보를 처리하지 않는다.** 동의 전에 불러도 정책 위반이 아니다 [확인] |
| 2 | `AdMob.requestConsentInfo({...})` | 이 사용자에게 동의가 필요한지 조회 |
| 3 | `status === REQUIRED && isConsentFormAvailable` → `AdMob.showConsentForm()` | 폼을 띄운다 |
| 4 | **`canRequestAds === true` 일 때에만** `prepareRewardVideoAd` | ★★ 여기가 진짜 관문 |
| 5 | `privacyOptionsRequirementStatus === "REQUIRED"` → 설정 화면에 상시 진입점 | §3.2 |

> ★★★ **`status` 로 판정하지 않는다. `canRequestAds` 로 판정한다.**
> `AdmobConsentInfo` 는 v7.0.3 부터 **`canRequestAds: boolean`** 를 준다
> [소스 확인 — `consent-info.interface.d.ts`]. `status` 는 네 값
> (`NOT_REQUIRED` · `OBTAINED` · `REQUIRED` · `UNKNOWN`)이고, "동의가 필요했는데
> 폼을 띄웠다"와 "그래서 광고를 요청해도 되는가"는 **다른 질문**이다.
> 폼을 사용자가 거부하고 닫았을 때 `status` 만 보는 코드는 그대로 광고를 요청한다.
>
> 이것은 이 저장소가 이미 두 번 당한 실패 유형이다 — **참/거짓으로 물으면 셋인
> 것이 거짓말을 한다** (`CLAUDE.md` 의 각인 `sigilTiming` 사례).

> ⚠ **AdMob 콘솔에서 GDPR 메시지를 먼저 만들지 않으면 폼이 존재하지 않는다.**
> `isConsentFormAvailable` 이 `false` 로 오고, 코드는 아무 오류 없이 통과하며,
> **동의를 받지 않은 채 광고를 요청한다.** 정책 위반인데 아무도 실패하지 않는다.
> AdMob → 개인정보 보호 및 메시지 → **GDPR** 에서 메시지를 만들고 **게시**까지 해야 한다.

### 3.2 ★ 설정 화면에 "개인정보 옵션" 항목이 필요할 수 있다

UMP 는 일부 지역에서 **사용자가 언제든 동의를 바꿀 수 있는 상시 진입점**을 요구한다
[확인 2026-08-07 — 구글 UMP 문서]. 판정은 `privacyOptionsRequirementStatus` 다.

| 값 | 앱이 해야 하는 것 |
|---|---|
| `REQUIRED` | **보이고 누를 수 있는 UI 요소**를 두고 `AdMob.showPrivacyOptionsForm()` 에 연결 |
| `NOT_REQUIRED` | 그 요소를 **보이지 않게** 한다 |
| `UNKNOWN` | `requestConsentInfo` 를 다시 부른다 |

→ **`SettingsScreen.jsx` 에 조건부 항목 하나**가 늘어난다.
`hidden` 속성으로 숨기지 않는다 — 이 저장소는 그것으로 지휘관 탭이 통째로 겹쳐
그려진 적이 있다 (`CLAUDE.md`). **조건부 렌더**를 쓴다.

### 3.3 iOS ATT(App Tracking Transparency)

| | 내용 |
|---|---|
| 무엇 | iOS 14+ 에서 **IDFA 를 읽으려면 시스템 프롬프트로 허락을 받아야 한다** |
| 플러그인 API | `AdMob.requestTrackingAuthorization()` · `AdMob.trackingAuthorizationStatus()` [소스 확인 — v7.2.0 에서는 **별도 메서드**다. 옛 문서·예제에 나오는 `initialize({ requestTrackingAuthorization: true })` 옵션은 v7.2.0 의 `AdMobInitializationOptions` 에 **없다**] |
| 순서 | **UMP 동의 → ATT** [추정 — 구글 권장 순서. EEA 에서는 두 프롬프트가 연달아 뜬다] |
| 거부하면 | 광고는 계속 나온다. **비개인화 광고**가 되어 eCPM 이 떨어진다 |

**`NSUserTrackingUsageDescription` 문구**

```
(ko) 관련성 높은 광고를 보여 주기 위해 기기의 광고 식별자를 사용합니다.
     허용하지 않아도 게임의 모든 기능을 그대로 이용할 수 있습니다.

(en) RIFT ARK uses your device's advertising identifier to show more relevant
     ads. Declining does not restrict any part of the game.
```

> ⚠ **문구에 보상을 걸지 않는다.** "허용하면 골드를 드립니다" 류는 App Store
> 심사 지침 위반이다 [확인 — Apple 지침 5.1.2]. 위 문구가 굳이 "허용하지 않아도
> 전부 이용할 수 있다"를 말하는 이유는 정직해서이기도 하지만, **그것이 이 게임의
> 사실**이기 때문이다 — 광고는 결과 화면의 선택지 하나다.

### 3.4 미국 주 프라이버시 (CCPA/CPRA 등)

| 사실 | 내용 |
|---|---|
| 예전 | AdMob 앱 설정의 "US States 규정" 스위치 |
| **2025-06-16** | 그 설정이 **제거**되고 **메시지 타입**으로 이관됐다 [확인 2026-08-07] |
| 지금 | AdMob → 개인정보 보호 및 메시지 → **US 주 규정** 메시지를 만들면 해당 주 사용자에게 옵트아웃이 제공되고, 옵트아웃 시 **제한된 데이터 처리(RDP)** 로 비개인화 광고만 나간다 |
| 코드에서 할 일 | **없다.** UMP 가 같은 흐름으로 처리한다 |

> ★ **개인정보처리방침에 "Do Not Sell or Share My Personal Information" 안내가
> 필요해진다** — §4.5 의 영문 방침에 그 문단이 들어 있다. 지금 `53 §5.1` 의
> 방침은 "우리는 아무것도 갖고 있지 않다"로 끝나므로 **그대로 두면 거짓이 된다.**

### 3.5 아동 대상 처리 — 이 게임은 아동 대상이 아니다

**목표는 `53 §5.5` 와 같다: 아동 대상 앱으로 분류되지 않는 것.** 분류되면 Families
정책이 걸리고, **Families 정책 하에서는 광고 ID 를 쓸 수 없어 보상형 광고의 수익이
무너진다.** 지금은 얻을 게 없는 절차였지만, 광고를 붙이는 순간 **수익 자체가 걸린
문제**로 성격이 바뀐다.

| 어디 | 답 | 왜 |
|---|---|---|
| Play Console → 앱 콘텐츠 → **타겟층 및 콘텐츠** | 연령대에서 **13세 미만을 하나도 선택하지 않는다** | `53 §5.5` 와 동일 |
| 같은 화면 **"아동에게도 어필하나요?"** | **아니오** | 판단 기준은 아트가 아니라 콘텐츠·난이도·마케팅. 100 스테이지 편성 퍼즐은 미드코어다 |
| 코드 `AdMob.initialize` | `tagForChildDirectedTreatment: false` | COPPA 태그 [소스 확인] |
| 코드 `AdMob.initialize` | `tagForUnderAgeOfConsent: false` | 유럽 TFUA 태그 [소스 확인] |
| 코드 `AdMob.initialize` | `maxAdContentRating: "General"` | §1.4 |
| App Store Connect → 카테고리 | **게임 → 전략/액션. Kids 카테고리 금지** | `53 §5.5` |

> ⚠ **"예"로 답하면 되돌리기 어렵다** — 그리고 이제는 되돌리기 어려운 정도가 아니라
> **광고 수익 모델 자체가 성립하지 않는다.** 세 태그 중 하나라도 `true` 면
> 광고 요청에 개인화가 꺼지고 eCPM 이 크게 떨어진다 [추정].

### 3.6 한국 — 무엇이 새로 생기는가

| 법 | 광고 전 | 광고 후 |
|---|---|---|
| 게임산업법 확률형 아이템 공개 | 적용 대상 없음 | **여전히 없음** — 광고 보상은 확률이 아니다 (`ads.json:rewardMult` 고정) |
| 개인정보보호법 | 처리 0 → 적용 대상 없음 | **적용된다.** 처리 항목·목적·보유기간·**국외이전** 고지가 필요하다 (§4.5) |
| 정보통신망법 (앱 접근권한) | 해당 없음 | 광고 ID 는 접근권한 고지 대상이 아니다 [추정 — 필수/선택 권한 고지는 단말기 접근권한 기준] |

> ★★ **확률형이 아니라는 것을 유지하는 것이 이 절의 핵심이다.**
> "광고를 보면 확률로 더 준다" 형태를 만드는 순간, 이 프로젝트가
> **구조적으로 소멸시킨** 확률 공개 의무가 되살아난다 (`CLAUDE.md` 절대 규칙 6).
> `logic/adReward.js` 는 `Math.random()` 이 없으므로 그것이 **코드로 강제**된다.

---

## 4. 스토어 제출물이 어떻게 바뀌는가

### 4.1 한 줄씩 대조

| 제출물 | 지금 (수집 0 전제) | 광고를 붙이면 | 문서 |
|---|---|---|---|
| Play → 앱 콘텐츠 → **광고** | 광고 없음 | **예, 광고가 포함됨** → 스토어에 "광고 포함" 배지 | `50 §4.5` |
| Play → 앱 콘텐츠 → **광고 ID** | (선언 없음) | **예, 사용함.** 목적: 광고/마케팅 · 분석 · 사기 방지 | 신규 |
| Play → **데이터 보안** | 수집/공유 **아니오** | **예** — 4개 데이터 유형 (§4.2) | `50 §7.1` · `53 §5.2` |
| Play → **타겟층 및 콘텐츠** | 13세 미만 없음 · 아동 어필 아니오 | **그대로** (§3.5) | `53 §5.5` |
| Play → **콘텐츠 등급(IARC)** | E10+ / PEGI 7 예상 | ★ **등급은 안 바뀐다** — IARC 는 광고를 등급에 반영하지 않는다 [확인 2026-08-07]. 대신 **광고 콘텐츠가 앱 등급을 넘지 않을 것**을 Play 가 별도로 요구한다 (§1.4) | `53 §4.1` |
| Apple → **App Privacy** | Data Not Collected | Identifiers · Usage Data · Diagnostics + **Tracking = 예** (§4.3) | `53 §5.3` |
| Apple → `PrivacyInfo.xcprivacy` | `NSPrivacyTracking=false` · 배열 전부 비어 있음 | **`true` · 도메인 · 수집 타입** (§4.4) | `53 §5.3` |
| Apple → **연령 등급** | 신규 설문 "광고 노출" = 없음 | **광고 노출 = 있음** [확인 — 2025 개편 신규 문항]. 예상 등급 9+ 는 유지될 것 [추정] | `53 §4.3` |
| **개인정보처리방침** (한/영) | "아무것도 수집하지 않습니다" | **전면 교체** (§4.5) | `50 §7.2` · `53 §5.1` |
| 스토어 긴 설명 "없는 것" 문단 | "광고가 없습니다" | ★ **그 줄을 지운다.** 남기면 허위 표시 반려 | `50 §4.3` · `53 §6.6` |
| 스크린샷 카피 | `No ads. No IAP. No gacha.` | `No IAP. No gacha.` 로 **이미지 재생성** | `52 §4` · `54 §4` |
| **EU DSA 거래자 지위** | 유료라 거래자 | ★ **무료+광고여도 거래자다** [추정 — 광고 수익은 상업 활동이다. 화면이 권위]. 주소·전화 공개는 그대로 | `53 §5.4` |

> ★★★ **여기가 이 저장소의 단일 실패 유형이 걸리는 자리다** — 같은 사실이
> **여덟 곳**에 적혀 있고, 그중 하나만 안 고치면 **불일치 반려**가 난다.
> 개인정보처리방침 · Play Data safety · Play 광고 ID 선언 · Play 광고 여부 ·
> Apple App Privacy · `PrivacyInfo.xcprivacy` · 연령 등급 설문 · 스토어 설명.
> **§8 의 체크리스트가 이 여덟을 한 묶음으로 다룬다.**

### 4.2 Google Play — Data safety 상세

구글이 공식으로 공개한 "Google Mobile Ads SDK 가 자동으로 수집·공유하는 것"
[확인 2026-08-07 — `developers.google.com/admob/android/privacy/play-data-disclosure`]:

| 구글이 말하는 것 | Play 데이터 유형 [추정 — 매핑은 개발자 책임] | 수집 | 공유 | 목적 | 필수 |
|---|---|---|---|---|---|
| IP 주소 (대략적 위치 추정에 쓰일 수 있음) | 위치 → **대략적인 위치** | 예 | 예 | 광고/마케팅 · 분석 · 사기 방지 | 예 |
| 앱 실행 · 탭 · 동영상 시청 등 상호작용 | 앱 활동 → **앱 상호작용** | 예 | 예 | 광고/마케팅 · 분석 | 예 |
| 실행 시간 · 응답 없음 비율 · 전력 사용 | 앱 정보 및 성능 → **진단** | 예 | 예 | 분석 | 예 |
| 광고 ID · App set ID 등 | **기기 또는 기타 ID** | 예 | 예 | 광고/마케팅 · 사기 방지 | 예 (§2.4 에서 끄면 아니오) |

| 나머지 문항 | 답 |
|---|---|
| 전송 중 암호화되는가 | **예** — 구글이 전부 TLS 라고 명시한다 [확인] |
| 사용자가 삭제를 요청할 수 있는가 | **예** — 기기 설정에서 광고 ID 재설정/삭제. 방침에 방법을 적는다 |
| 독립 보안 표준 검증을 받았는가 | 아니오 |

> ⚠ **매핑은 구글이 대신 해 주지 않는다.** 구글 문서는 자신이 무엇을 수집하는지만
> 말하고, *"Play 의 데이터 보안 양식에 어떻게 답할지는 전적으로 개발자의 책임"*
> 이라고 명시한다 [확인]. 위 표의 두 번째 열은 **이 문서의 추정**이며,
> **콘솔 문항 문구를 읽고 다시 확인한다.**

> ★ **게임 자신의 세이브는 여전히 "수집"이 아니다.** `@capacitor/preferences` 는
> 기기 밖으로 나가지 않는다 — 구글의 "수집" 정의는 **기기 밖 전송**이다
> (`50 §7.1`). 그 문단은 광고가 붙어도 그대로 참이고, **방침에 그 구분을 명시해야
> 심사자가 두 종류의 데이터를 섞어 읽지 않는다.**

### 4.3 Apple — App Privacy

| 질문 | 답 |
|---|---|
| Do you or your third-party partners collect data from this app? | **Yes** |
| 수집 항목 | **Identifiers** → Device ID / User ID(광고 식별자) · **Usage Data** → Product Interaction, Advertising Data · **Diagnostics** → Crash Data, Performance Data · **Location** → Coarse Location (IP 기반) [확인 2026-08-07 — 구글 iOS 데이터 공개 문서의 열거를 Apple 카테고리로 매핑. 매핑은 **추정**] |
| 용도 | Third-Party Advertising · Analytics · App Functionality |
| **Used to Track You** | **예** — 개인화 광고를 위해 IDFA 를 쓰면 Apple 정의상 추적이다 |
| Linked to the user | 광고 식별자는 **Not Linked** 로 두는 것이 일반적이다 [추정 — 계정이 없으므로] |

> ⚠ **"or your third-party partners" 가 함정이다** (`53 §5.3`). 4개월간 이 문항의
> 답이 "No" 였던 이유는 **플러그인 8종이 전부 네트워크를 타지 않아서**였다.
> 이제 아홉 번째가 네트워크를 탄다. **플러그인 목록을 다시 세고, 그 결과를
> 방침 · Data safety · Privacy Manifest 넷과 맞춘다.**

### 4.4 `PrivacyInfo.xcprivacy` — 무엇이 우리 몫이고 무엇이 SDK 몫인가

| 누가 | 무엇 |
|---|---|
| **Google Mobile Ads SDK** | 자기 몫의 `PrivacyInfo.xcprivacy` 를 **SDK 안에 포함**한다 (v11.2.0 이상) [확인 2026-08-07]. 우리가 광고 SDK 의 API 사용 사유를 대신 적을 필요는 없다 |
| **우리 앱** | `@capacitor/preferences` 의 `UserDefaults`(CA92.1) — `53 §5.3` 과 동일. **여기에 추적 관련 두 키가 추가된다** |

`FE/ios/App/App/PrivacyInfo.xcprivacy` **(광고 버전)**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSPrivacyTracking</key>
  <true/>
  <key>NSPrivacyTrackingDomains</key>
  <array>
    <string>googleads.g.doubleclick.net</string>
    <string>googlesyndication.com</string>
    <string>google.com</string>
  </array>
  <key>NSPrivacyCollectedDataTypes</key>
  <array>
    <dict>
      <key>NSPrivacyCollectedDataType</key>
      <string>NSPrivacyCollectedDataTypeDeviceID</string>
      <key>NSPrivacyCollectedDataTypeLinked</key>
      <false/>
      <key>NSPrivacyCollectedDataTypeTracking</key>
      <true/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array>
        <string>NSPrivacyCollectedDataTypePurposeThirdPartyAdvertising</string>
      </array>
    </dict>
  </array>
  <key>NSPrivacyAccessedAPITypes</key>
  <array>
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
      <key>NSPrivacyAccessedAPIReasons</key>
      <array>
        <string>CA92.1</string>
      </array>
    </dict>
  </array>
</dict>
</plist>
```

| 키 | 왜 이 값인가 |
|---|---|
| `NSPrivacyTracking` = `true` | ATT 프롬프트를 띄우고 IDFA 를 쓴다면 **거짓말을 할 수 없다** |
| `NSPrivacyTrackingDomains` | ★ **이 목록이 비어 있으면 ATT 거부 후에도 그 도메인이 차단되지 않는다** — Apple 이 이 배열을 읽어 차단한다. 위 세 개는 **[추정]** 이고, **구글 문서의 현재 목록으로 대체**한다 |
| `NSPrivacyCollectedDataTypes` | App Privacy 라벨(§4.3)과 **같은 말**이어야 한다 |
| `CA92.1` | `@capacitor/preferences` 의 UserDefaults 사유 — `53 §5.3` 에서 그대로 |

> ⚠ **`NSPrivacyTrackingDomains` 에 도메인을 적으면, ATT 를 거부한 사용자에게
> 그 도메인 요청이 실패한다.** 그것이 정상 동작이고 광고가 안 뜨는 것도 정상이다.
> **광고가 안 뜨는 것을 버그로 오해해 이 배열을 비우지 않는다** — 비우는 것은
> 정책 위반이다.

### 4.5 개인정보 처리방침 — `50 §7.2` · `53 §5.1` 을 **대체하는** 전문

> ★ 지금 방침의 핵심 문장은 *"네트워크 코드가 없고 서버가 없으므로 구조적으로
> 수집이 불가능하다"* 였다. **그 문장이 거짓이 되므로 문서를 통째로 바꾼다.**
> 한 줄만 고치지 않는다 — 부정문 위에 세워진 문서라 한 줄만 고치면 나머지가
> 서로 모순된다.

#### 한국어판 — ★ 정본은 **`docs/legal/privacy-policy-ko.md`** 다

> ### ★★ 전문을 여기에 두지 않는다 (2026-08-08)
>
> 개인정보 처리방침은 **틀리면 반려되고 거짓이면 위법인** 문서다. 그런 문서를
> 절차서 안에 본문으로 두면 코드가 바뀔 때 갈라진다 — 이 저장소의 단일 실패
> 유형이다. 게시할 파일 하나를 정본으로 두고 여기서는 **가리키기만** 한다.
>
> 게시 절차: 그 파일을 GitHub `riftark-privacy` 저장소의 `index.md` 로 복사 →
> Pages 활성화 → **브라우저로 직접 열어 404 가 아닌지 확인** (`50 §7.2`).
> **`<법적 성명>` 한 곳만 채우면 된다.**

##### ★★★ 초안을 그대로 쓰지 않았다 — 코드와 대조해서 셋을 고쳤다

이 문서에 있던 초안은 **앱이 실제로 하지 않는 것을 세 군데에서 약속하고 있었다.**

| 초안의 문장 | 실제 | 어떻게 했나 |
|---|---|---|
| "동의 내용은 앱의 **설정 > 개인정보 옵션**에서 언제든지 변경할 수 있습니다" | ★ **그런 화면이 없다.** `native/ads.js` 는 초기화 때 `showConsentForm()` 을 한 번 부를 뿐이고, `SettingsScreen` 에는 동의 관련 항목이 하나도 없다 (2026-08-08 실측) | **문장을 뺐다.** 아래 §4.5-A 참조 |
| "동의하지 않으면 **개인화되지 않은 광고만** 게재됩니다" | ★ **광고가 아예 안 나간다.** 어댑터는 `allowed = info.canRequestAds` 로 두고, false 면 `preloadRewarded` 가 즉시 실패한다 — 비개인화 광고로 떨어지는 경로가 **없다** | "광고가 게재되지 않습니다" 로 정정 |
| iOS IDFA · ATT 프롬프트 · iOS 설정 경로 | 1.0 은 **Android 전용**이다. `ads.json:units.ios` 는 빈 값이고 ATT 구현이 없다 | iOS 절을 **뺐다.** iOS 를 낼 때 `4.3`·`4.4` 와 함께 되살린다 |

> ⚠ **방침이 앱보다 관대하게 적히는 쪽이 위험하다.** "설정에서 바꿀 수 있다"는
> 문장은 심사자가 확인하러 갔다가 못 찾으면 그대로 반려 사유이고, 사용자가
> 그것을 믿고 찾다가 못 찾으면 신뢰의 문제가 된다.

##### §4.5-A ✅ 동의 철회 수단 — **닫았다 (2026-08-08)**

GDPR 은 동의를 **준 것만큼 쉽게 철회**할 수 있어야 한다고 요구한다. 그 수단이
**하나도 없었다** — UMP 폼은 최초 실행 때 한 번 뜨고 끝이었다.

| 무엇 | 어디 |
|---|---|
| `privacyOptionsRequired()` · `openPrivacyOptions()` | `src/native/ads.js` |
| 설정 > 데이터 > **광고 개인정보 설정** (조건부 렌더) | `SettingsScreen.jsx:PrivacyOptionsGroup` |
| `settings.groupAdPrivacy` · `noteAdPrivacy` · `btnAdPrivacy` | `i18n/messages/settings.json` (`{ko,en}`) |
| 검사 11개 | `src/native/ads.test.js` — **이 어댑터를 직접 검사하는 첫 파일이다** |

> ★ **화면이 지역으로 판정하지 않는다.** "EEA 면 보여 준다" 를 화면에 적으면 그
> 목록이 두 번째 출처가 되고 AdMob 콘솔의 메시지 설정이 바뀌어도 따라가지 못한다.
> 답은 UMP 하나다 (`privacyOptionsRequirementStatus`). **한국에서는 이 절이
> 아예 그려지지 않는다** (`NOT_REQUIRED`).

> ### ★★★ 그리고 그 테스트가 진짜 버그를 하나 잡았다
>
> `preloadRewarded()` 가 `initAds()` 의 **반환값**을 보고 있었다. `initAds` 는
> `initPromise` 를 캐시하므로 두 번째 호출부터 **처음 결정된 값을 영원히**
> 돌려준다. 그래서 이 순서에서 조용히 죽었다:
>
> 1. EEA 사용자가 최초 동의 폼에서 **거부** → `initAds` 가 false 로 굳는다
> 2. 나중에 설정에서 **동의로 바꾼다** → `allowed = true` 로 갱신된다
> 3. 그런데도 `preloadRewarded` 는 캐시된 false 를 보고 **즉시 되돌아간다**
>
> **동의했는데 그 세션 내내 광고가 한 번도 안 뜬다.** 예외도 로그도 없다.
> 지금은 `initAds()` 를 **초기화 보장용**으로만 부르고 허가 판정은 살아 있는
> `allowed` 가 한다. 철회하면 받아 둔 광고(`loaded`)까지 버린다 — 다음 한 번이
> 나가면 그것이 위반이다.

#### 영문판 (`https://<계정>.github.io/riftark-privacy/en/`)

> ### ⚠ 이 영문 초안은 **아직 정정되지 않았다** (2026-08-08)
>
> 위 한국어판에서 고친 **세 가지가 여기에도 그대로 있다** — 존재하지 않는
> "Privacy options" 설정 화면, 동의 거부 시 "비개인화 광고" 라는 잘못된 서술,
> 그리고 구현되지 않은 iOS ATT.
>
> **영어권을 낼 때 한국어 정본(`docs/legal/privacy-policy-ko.md`)에서 번역해
> `docs/legal/privacy-policy-en.md` 를 만든다.** 아래 블록을 그대로 게시하지 않는다.
> 그리고 그때는 **§4.5-A(동의 철회 수단)가 차단 요소**다.

```markdown
# RIFT ARK — Privacy Policy

Last updated: 2026-00-00
Application: RIFT ARK (package `com.superdimension.app`)
Developer: <legal name>
Contact: 741u741@gmail.com

## 1. Summary

RIFT ARK has no accounts, no login, and no server that stores your game data.
Your progress never leaves your device.

The game does offer **optional rewarded video ads**. To serve them we use Google
AdMob (the Google Mobile Ads SDK). Google collects and processes data in
connection with those ads. Section 2 describes exactly what.

## 2. Data collected for advertising

When the advertising component is active, the Google Mobile Ads SDK collects the
following and transmits it to Google:

| Item | Detail | Purpose |
|---|---|---|
| IP address | May be used to estimate the approximate location of the device | Ad serving, analytics, fraud prevention |
| Advertising identifiers | Android advertising ID, App set ID, iOS IDFA | Ad serving, frequency capping, fraud prevention |
| App interactions | App launches, taps, video views | Ad serving, analytics |
| Diagnostics | Launch time, hang rate, energy usage | Analytics |

- All of this data is encrypted in transit using TLS.
- The developer never sees or stores this data. The only thing the developer can
  see is the aggregated reporting AdMob provides (impressions, revenue).
- This data may be collected when the advertising component initialises, even if
  you never choose to watch an ad.

## 3. Data stored only on your device

Your game progress (three save slots), your settings, and your ad-view counters
are stored in your device's local application storage. This data never leaves
your device and is removed when you uninstall the application.

## 4. Third parties and international transfers

| Recipient | Purpose | Data | Retention | Transferred to |
|---|---|---|---|---|
| Google LLC and Google advertising partners | Ad serving, measurement, fraud prevention | Items in section 2 | Per Google's policies | United States and other countries where Google operates data centres |

- Google Privacy Policy: https://policies.google.com/privacy
- How Google uses data from partner sites and apps:
  https://policies.google.com/technologies/partner-sites

## 5. Your choices

- **EEA, UK, Switzerland** — On first launch we request consent through Google's
  User Messaging Platform. If you decline, you will only be shown
  non-personalised ads. You can change your choice at any time from
  **Settings > Privacy options** inside the game.
- **iOS** — The system App Tracking Transparency prompt lets you allow or refuse
  tracking. You can change it later in Settings > Privacy & Security > Tracking.
- **United States** — In states with applicable privacy laws you are offered an
  opt-out. When you opt out, restricted data processing applies and only
  non-personalised ads are served. This is our "Do Not Sell or Share My Personal
  Information" mechanism.
- **Resetting your advertising ID** — Android: Settings > Google > Ads.
  iOS: Settings > Privacy & Security > Tracking.
- **Not watching ads at all** — Rewarded ads are entirely optional. The full
  campaign can be completed without ever watching one.

## 6. Children

RIFT ARK is not directed to children under 13, is not marketed to children, and
is not part of any children's programme on the App Store or Google Play. We do
not knowingly collect personal information from children under 13.

## 7. Your rights

Under the GDPR, the UK GDPR, the CCPA/CPRA, the Korean Personal Information
Protection Act and comparable laws, you have rights of access, correction,
deletion, portability and objection. The developer holds no data that identifies
you. For advertising data, exercise your rights with Google or use the controls
in section 5. Game data on your device is deleted when you uninstall the app.

## 8. Changes

If a future version changes what is collected, this policy will be updated before
that version is released, and the change will be described in the release notes.

## 9. Contact

741u741@gmail.com
```

> ⚠ **문서에 앱 이름이 반드시 있어야 한다** (`53 §5.1`). 그리고 **한/영 두 문서가
> 같은 말을 해야 한다** — 심사자는 스토어 로케일에 맞는 URL 을 연다.

---

## 5. 앱 안의 규약

### 5.1 파일 여덟 개, 각각 하나만 안다

**2026-08-07 실측 — 전부 구현되어 있고 플러그인 7.2.0 도 설치됐다.**
남은 것은 **AdMob 계정과 실제 광고 단위 ID** 뿐이라 `enabled` 가 `false` 다.

```
package.json                     @capacitor-community/admob ^7.2.0  (설치 완료)
android/…/AndroidManifest.xml    APPLICATION_ID meta-data (구글 테스트 앱 ID)
ios/App/App/Info.plist           GADApplicationIdentifier (구글 테스트 앱 ID)
src/game/data/ads.json           수치 전부 · enabled:false (계정 준비 전)
src/game/logic/adReward.js       순수 규칙 — canWatchAd / adBonusGold / recordView / viewsLeft
src/game/logic/adReward.test.js  상한 · 하루 경계 · 손상 세이브
src/store/slices/metaSlice.js    meta.ads = {day, views, lastAtMs} · claimAdBonus()
src/native/ads.js                어댑터. 플러그인 없으면 동적 import 실패 → 스텁
src/screens/BattleResult.jsx     AdBonus 컴포넌트 — 결과 화면 한 곳뿐
tools/lib/f2p-power.mjs          adGold() · stageAffordableWith() · powerFromGold()
tools/calibrate-economy.mjs      광고 켠 곡선 + 파워 증가분 게이트
```

| 왜 이렇게 나눴는가 | |
|---|---|
| **수치를 데이터로 뺀 이유** | `CLAUDE.md` 절대 규칙 4. 그리고 **밸런스 하네스가 같은 파일을 읽어야** §6 의 재보정이 성립한다 — `f2p-power.mjs` 가 `ads.json` 을 직접 import 한다 |
| **규칙을 순수 함수로 뺀 이유** | 절대 규칙 1. `npm run economy` 가 광고를 켠 곡선을 계산하려면 규칙이 Phaser·네이티브 없이 돌아야 한다. **경제 검증이 광고를 모르면, 광고가 경제를 망가뜨려도 아무도 실패하지 않는다** |
| **어댑터를 뺀 이유** | 이 파일이 앱에서 AdMob 을 아는 **유일한 곳**이다. 화면은 `showRewarded()` 가 `true` 를 주는지만 안다 |
| **`Date.now()` 를 규칙에 넣지 않은 이유** | 호출자가 시각을 넘긴다. 그래야 테스트가 "자정을 넘겼다"를 인자 하나로 만든다 |
| ★ **`adSlice.js` 가 아니라 `metaSlice.js` 인 이유** | 시청 기록을 **`meta` 안에** 넣으면 `SAVE_VERSION` 을 올리지 않아도 된다 — 정규화 한 줄(`nonNegInt(m.ads?.day, 0)`)이 옛 세이브를 채운다. 새 슬라이스를 만들면 세이브 루트가 바뀌어 `migrate` 가 필요해진다 |

> ★ **`ads.json:_doc` 이 한때 `store/slices/adSlice.js` 를 가리켰다** — 실제 구현은
> `metaSlice.js(meta.ads)` 다. **2026-08-07 정정 완료.** 남겨 두는 이유는
> **같은 사실을 두 곳에 적으면 반드시 갈라진다**가 이 저장소의 단일 실패 유형이고,
> 광고처럼 파일 여덟 개에 걸친 기능에서는 그 한 줄이 하루 만에 생겼기 때문이다.

### 5.2 화면이 부르는 것 — 계약

| 언제 | 무엇 | 왜 |
|---|---|---|
| 결과 화면 진입 (`useEffect`) | `preloadRewarded()` → `setReady(ok)` | 버튼을 누른 뒤에 받으면 그 사이가 빈 화면이 된다 |
| 버튼 활성 판정 | `canWatchAd({ stageId, nowMs, tzOffsetMin, state: meta.ads, ready })` | **이유까지 돌려준다** (`disabled` · `stage` · `daily` · `cooldown` · `notReady`) |
| 버튼 클릭 | `await showRewarded()` → `true` 면 **`claimAdBonus(stageId, baseGold)`** | |
| 스토어 안 | `claimAdBonus` 가 **`canWatchAd` 를 다시 부른다** → `adBonusGold` → `recordView` | |
| 표시 | `viewsLeft(meta.ads, nowMs, tz)` → "오늘 남은 횟수" | 상한이 있으면 **남은 수를 보여 준다.** 안 보이는 상한은 버그로 읽힌다 |
| 지급 후 | `result.adGain` — **광고로 더 받은 액수를 따로 보여 준다** | 대가를 눈으로 확인하지 못한 광고는 사기처럼 느껴진다 |

> ★★ **판정을 화면이 만들지 않고, 스토어가 같은 함수를 다시 부른다.**
> 이 저장소는 영입 카드에서 이미 겪었다 — 버튼의 비활성 사유와 실제 지급 판정이
> 갈라지면 **"눌리는데 아무 일도 일어나지 않는 버튼"** 이 생긴다 (`CLAUDE.md`).
> 그리고 `disabled` 속성은 `pointerdown`/`pointerup` 을 막지 못한다.
> **콜백 첫 줄이 아니라 스토어 안에서 규칙 모듈로 다시 거르는 것**이 그 사고의 정답이다.

> ★ **`adBonusGold` 는 배수가 아니라 증분을 돌려준다.** 화면과 스토어가 각자
> `gold * mult` 를 계산하면 반올림이 갈라지고, 무엇보다 결과 화면이 "이미 준 보상"과
> "광고로 더 받은 것"을 구분해서 보여 줄 수 없다. **대가를 눈으로 확인하지 못한
> 광고는 사기처럼 느껴진다.**

### 5.3 ★★★ 플러그인이 조용히 멈추는 자리 — 반드시 처리한다

> 아래 셋은 **플러그인 v7.2.0 의 실제 소스를 읽어 확인한 것**이고, 셋 다
> 컴파일도 통과하고 lint 도 통과하며 **실기기에서 눌러 보기 전까지 드러나지 않는다.**
> **셋 다 2026-08-07 에 `native/ads.js` 에 반영됐다** — 아래는 그 이유의 기록이고,
> **어댑터를 고칠 때 되돌리면 안 되는 것들**의 목록이다.

#### ① `showRewardVideoAd()` 는 보상 없이 닫히면 **영원히 resolve 하지 않는다**

[소스 확인 — Android `RewardedAdCallbackAndListeners.kt` · iOS `AdRewardExecutor.swift`]

`call.resolve(...)` 는 **`OnUserEarnedRewardListener` 안에서만** 호출된다.
사용자가 광고를 중간에 닫으면 `onAdDismissedFullScreenContent` 가 **이벤트만**
쏘고(`RewardAdPluginEvents.Dismissed`), 그 `PluginCall` 은 **resolve 도 reject 도
되지 않는다.**

```
await AdMob.showRewardVideoAd()   ← 중도 이탈 시 여기서 영원히 멈춘다
```

→ **결과 화면의 버튼이 "로딩 중" 상태로 굳는다.** 예외도 안 나고 로그도 없다.

**해결 [2026-08-07 반영]:** `showRewardVideoAd()` 의 프라미스를
`Rewarded` · `Dismissed` · `FailedToShow` 리스너와 **경주시킨다.**
먼저 도착한 쪽이 답이고, 리스너는 **`finally` 에서 해제한다** — 해제를 성공
경로에만 두면 실패할 때마다 리스너가 쌓여, 다음 광고에서 **이전 판의 이벤트가
먼저 도착**한다.

| 무엇이 먼저 오는가 | 결과 |
|---|---|
| `showRewardVideoAd()` resolve 또는 `Rewarded` | **보상 지급** |
| `Dismissed` | 보상 없음 |
| `FailedToShow` | 보상 없음 |
| (안전망) 타임아웃 | 보상 없음 · 버튼 복구 |

> ⚠ **`return !!r` 로 판정하지 않는다.** `AdMobRewardItem` 은 `{type, amount}` 인
> 객체라 항상 truthy 이고, 애초에 **중도 이탈 경로에서는 그 줄에 도달하지 못한다.**
> 실패는 `false` 가 아니라 **정지**로 나타난다.

#### ② 동의는 `canRequestAds` 로 판정한다 (§3.1)

`status === "REQUIRED"` 로 판정하면 **폼을 거부하고 닫은 사용자에게 광고를 요청한다.**

**해결 [2026-08-07 반영]:** `canRequestAds` 를 본다. 그 필드가 없는 구버전
플러그인을 위해 **폴백은 `status ∈ {NOT_REQUIRED, OBTAINED}`** 다 — `REQUIRED` 는
폴백에서도 통과하지 못한다.

#### ③ `immersiveMode` 는 **`prepareRewardVideoAd` 옵션**에서 읽힌다

[소스 확인 — `getRewardedAdLoadCallback` 의 `onAdLoaded` 에서
`call.getBoolean("immersiveMode")` 를 읽어 `ad.setImmersiveMode()` 를 부른다]

`showRewardVideoAd()` 는 옵션을 받지 않는다. **로드할 때 넣어야 한다.**
**해결 [2026-08-07 반영]:** `prepareRewardVideoAd({ adId, isTesting, immersiveMode: true })`.

> ★★ **이 게임에는 이것이 선택이 아니다.** RIFT ARK 는 가로 모드에서 시스템 바를
> 숨긴다 — 3버튼 네비게이션 바가 화면 **좌우**를 먹어서 뒤로가기·탭 바·일시정지
> 버튼이 보이는데 눌리지 않았기 때문이다 (`CLAUDE.md` · `25-capacitor-mobile.md` §3.3).
> **광고가 전체화면으로 뜨면서 바를 되돌리면, 광고를 닫고 돌아온 뒤 그 사고가
> 그대로 재현된다.** `immersiveMode: true` 로 넣고, 그것과 별개로
> `native/bootstrap.js:hideSystemBars()` 를 광고 종료 후 다시 부른다 —
> `MainActivity.java` 가 포커스 복귀마다 재적용하지만 **광고 종료가 포커스 이벤트를
> 내지 않는 기기가 있다** [추정 — 실기기 확인 필요].

### 5.4 배치 규칙 — 무엇을 하지 않기로 했는가

| 규칙 | 왜 |
|---|---|
| **보상형만.** 전면·배너를 만들지 않는다 | `CLAUDE.md` 하지 말 것. 어댑터의 공개 API 가 `initAds` · `adReady` · `showRewarded` **셋뿐**인 것이 그 강제다 |
| **결과 화면 한 곳뿐** | 전투 중·화면 전환 중에는 절대 아니다. 전투는 30Hz 고정 틱이고 그 위에 전체화면 액티비티가 끼어들면 백그라운드 복귀 경로를 다시 검증해야 한다 |
| **실패해도 게임이 멈추지 않는다** | 광고 미로드·오프라인·플러그인 없음 — 전부 **버튼이 비활성될 뿐**이다. 어댑터가 예외를 던지지 않는다 |
| **오프라인에서 게임이 100% 돌아간다** | 캠페인 전체가 오프라인이다. 광고만 안 뜬다. 이것이 스토어 설명에 남길 수 있는 문장이다 |
| **부팅에 초기화를 끼우지 않는다** | 콜드 스타트 3초 예산(`26-performance-budget.md` §8)에 네트워크 왕복을 넣지 않는다. `initAds()` 는 **처음 필요할 때** 부른다 |
| **`ads.json:enabled` 가 false 면 버튼 자체가 안 그려진다** | SDK 도 부르지 않는다. 코드를 먼저 완성하고 스위치를 나중에 켜는 것이, 출시 직전에 배선을 처음 해 보는 것보다 안전하다 |

### 5.5 검사기 — 만들었는데 아무도 못 쓰는 것을 막는다

이 저장소는 **선언했는데 아무도 읽지 않는 것**과 **같은 사실이 두 곳에 적혀 갈라지는 것**
으로 반복해서 당했다. 광고는 그 두 함정에 **동시에** 걸리기 쉽다.

| 검사 | 상태 | 무엇을 지키는가 |
|---|---|---|
| `logic/adReward.test.js` | **있다** | 자정 경계 · 상한 · 쿨다운 · 시계 역행 · **손상된 세이브** · `adBonusGold` 반올림. ★ 이 검사가 실제 구멍 하나를 잡았다 |
| `tools/calibrate-economy.mjs` 의 파워 증가분 게이트 | **있다** | 광고가 **파워**를 +20% 넘게 밀면 실패 — `enabled` 가 꺼져 있어도 **경고로 항상 보인다** (§6.2 · §6.3) |
| `tools/validate-data.mjs` 의 `FIELD_CONSUMERS` | 등록 필요 | `ads.json` 의 **모든 필드에 읽는 코드가 있는가.** 등록 없는 필드는 오류다 |
| `native/ads.test.js` | 없음 | 플러그인 없음 → **스텁으로 떨어지고 예외를 던지지 않는가** |
| `check:i18n` | 있다 | 광고 문자열(`result.adWatch` · `adGain` · `adLeft` · `adDaily` · `adCooldown` · `adFailed` · `adUnavailable`)이 ko/en 모두 있는가 |
| `check:prod` | 규칙 추가 필요 | 배포 번들에 **테스트 광고 단위 ID 가 남아 있지 않은가** |

> ★★ **`check:prod` 에 규칙 하나를 더한다.** `ads.json:enabled === true` 인데
> `units.android` 또는 `units.ios` 가 비어 있으면 **빌드를 실패시킨다.**
> 지금은 안전한 방향(테스트 ID)으로 떨어지지만, 그 안전장치는 *"광고가 안 뜬다"* 로
> 조용히 나타난다 — **조용한 것이 이 저장소가 가장 자주 당한 것**이다.

---

## 6. 경제 재보정 — 이것을 건너뛰면 게임이 망가진다

### 6.0 ★★★ 축을 바꿨다 — 골드가 아니라 **파워**로 잰다

이 절은 2026-08-07 하루에 두 번 고쳐졌다. 그 과정 자체가 결론의 일부이므로 남긴다.

**① 55 §2 는 `npm run economy` 의 열을 잘못 읽었다.** 0.79~0.87 은 **파워 비**이고
골드 비는 1.06~2.12 다. 재실행 [실측 2026-08-07]:

| 스테이지 | 필요골드 | 가용골드 | 골드 비 | **파워 비** |
|---:|---:|---:|---:|---:|
| 1 | 1,461 | 1,706 | 1.17 | 1.26 |
| 20 | 65,697 | 84,455 | 1.29 | 0.97 |
| 40 | 661,419 | 852,012 | 1.29 | **0.83** |
| 50 | 2,055,100 | 2,596,041 | 1.26 | **0.79** |
| 60 | 6,399,520 | 7,869,377 | 1.23 | **0.80** |
| 80 | 62,580,503 | 72,025,414 | 1.15 | 1.01 |
| 90 | 196,281,836 | 217,799,604 | 1.11 | 1.12 |
| 100 | 310,545,402 | 658,569,948 | 2.12 | 0.87 |

**② 그래서 게이트를 골드로 걸면 안 된다.** 골드 여유는 지금도 **언제나 1 을 넘고,
넘는 것이 정상**이다 — 스테이지 100 의 2.12 는 캠페인을 다 깨서 골드를 쓸 곳이 없는
것이지 결함이 아니다. **게임을 쉽게 만드는 것은 골드가 아니라 그 골드로 산 파워**이고,
동료 레벨 비용이 `1.12^n` · 시설 비용이 지수라 **골드 +63% 가 파워 +63% 를 뜻하지
않는다.** 골드로 게이트를 걸면 실제보다 훨씬 가혹하게 판정한다.

> ★★ **지켜야 하는 명제는 하나다 — 40–60 구간의 "의도적으로 모자람"이 살아 있는가.**
> 파워 비 0.83 / 0.79 / 0.80 이 이 게임의 벽이고, 그 벽은 **편성 퍼즐이어야 한다**
> (`CLAUDE.md` 설계 결정 5 · 밸런스 게이트 B4). 그 비가 1.0 에 닿는 순간
> 그 구간은 **골드로 풀리고** 벽이 "광고를 봤는가"가 된다.

### 6.1 하네스가 광고를 안다 — 그래야 게이트가 거짓말을 하지 않는다

처음에 `npm run economy` 는 **광고를 켜도 똑같은 출력을 냈다.**
`availableGold(s)` 가 `goldPerStage(i) × repeatFactor` 만 더했기 때문이다.
즉 광고를 넣고 게이트를 돌리면 **아무것도 검증하지 않은 채 그대로 통과**했다 —
이 저장소가 이름을 붙여 놓은 실패 유형, **선언했는데 아무도 읽지 않는 것**의 경제판이다.

지금은 하네스가 `ads.json` 을 직접 읽는다 [실측 2026-08-07]:

| 어디 | 무엇 |
|---|---|
| `tools/lib/f2p-power.mjs:adGold(s)` | 그 시점까지 볼 수 있었던 총 시청 횟수(`daysToStage(s) × dailyViews`)를 **골드가 큰 순서(= 최신 스테이지부터)** 로 소진하며 추가 골드를 쌓는다 |
| `tools/lib/f2p-power.mjs:availableGold(s, {ads, force})` | 광고 켠 곡선 |
| ★ `tools/lib/f2p-power.mjs:stageAffordableWith(gold)` | **`requiredGold(s)` 를 이분 탐색으로 뒤집는다** — 그 골드로 어느 스테이지의 목표 성장까지 살 수 있는가 |
| ★ `tools/lib/f2p-power.mjs:powerFromGold(gold)` | 위의 스테이지에 해당하는 실제 파워 |
| `tools/calibrate-economy.mjs` | 광고 곡선을 **행마다 나란히 출력**하고 파워 증가분 게이트를 건다 |

> ★★★ **`powerFromGold` 가 `requiredGold` 를 *뒤집어서* 만들어진 것이 핵심이다.**
> 골드 → 파워 변환식을 새로 쓰면 그 순간 **모델이 둘로 갈라진다** — 이 저장소가
> 반복해서 당한 "같은 사실을 두 곳에 적으면 반드시 갈라진다"의 정확한 재현이 된다.
> 같은 함수를 이분 탐색으로 뒤집으면 **갈라질 수가 없다.**

> ★★ **모델은 최악의 경우로 잡았다.** 플레이어가 광고를 *가장 최근(= 가장 비싼)
> 스테이지*에 몰아 쓴다고 본다. 초반 스테이지에 붙는다고 모델링하면 위험을
> 과소평가하고, **검증은 언제나 나쁜 쪽을 봐야 한다.**

### 6.2 ★★ 게이트는 `enabled` 와 무관하게 항상 돈다

`ads.json:enabled` 가 `false` 인 지금도 계산한다. 결과만 다르다:

| `enabled` | 게이트 결과 |
|---|---|
| `false` (지금) | **경고** — `⚠ 광고를 켜면 N개 구간에서 파워가 +20% 를 넘는다` |
| `true` | **실패** — 종료 코드 1 |

> ★★★ **꺼져 있을 때 계산하지 않으면, 켜는 순간 처음으로 문제를 만난다.**
> 그때는 이미 **무료로 스토어에 올라간 뒤**이고, 무료→유료는 되돌릴 수 없다(§0.2).
> 되돌릴 수 없는 결정 뒤에 알게 되는 정보는 정보가 아니다. **정보는 언제나 보인다.**

### 6.3 상한 +20% 의 근거 — 고른 값이 아니라 계산된 값

파워 비가 1.0 에 닿지 않으려면 허용 증가분은 `1/비 − 1` 이다:

| 스테이지 | 파워 비 | 허용 증가분 |
|---:|---:|---:|
| 40 | 0.83 | **+20.5%** ← 가장 좁다 |
| 50 | 0.79 | +26.6% |
| 60 | 0.80 | +25.0% |

**가장 빡빡한 곳이 상한을 정한다 → `AD_GAIN_MAX = 0.2`.**
(50 이 가장 낮은 비이지만 *허용치*는 40 이 가장 좁다 — 비가 클수록 1.0 까지의
여유가 적기 때문이다. `calibrate-economy.mjs` 의 주석이 40 을 근거로 든 이유다.)

> ⚠ **곡선이 바뀌면 이 숫자도 다시 계산해야 한다.** `AD_GAIN_MAX` 는 상수처럼
> 생겼지만 **파생값**이다. `stages.json` 의 `difficultyMult` 나
> `balance.json:economy` 를 만지면 여기도 같이 움직인다.

### 6.4 ★★★ 현재 설정을 켜면 무슨 일이 일어나는가 (실측)

`ads.json`: `rewardMult` **2.0** · `dailyViews` **1** · `minStage` **6** ·
`enabled` **false** [실측 2026-08-07].

`npm run economy` 의 광고 열 [실측 2026-08-07 — 직접 실행]:

| 스테이지 | 광고 골드 증가 | 광고 켠 파워 비 | **파워 증가** | |
|---:|---:|---:|---:|---|
| 25 | +6% | 1.08 | +12% | |
| 40 | +12% | 0.98 | **+19%** | 아슬하게 통과 |
| 50 | +17% | 0.93 | **+19%** | 아슬하게 통과 |
| 60 | +22% | 0.94 | +18% | |
| 70 | +27% | 1.07 | +17% | |
| **80** | +40% | 1.26 | **+24%** | ✗ **초과** |
| **90** | +51% | 1.42 | **+28%** | ✗ **초과** |
| 100 | +63% | 0.87 | +0% | 레벨·시설 상한에 닿아 더 살 것이 없다 |

```
⚠ 광고를 켜면 2개 구간에서 파워가 +20% 를 넘는다
  (현재 설정: ×2 · 하루 1회 · 6스테이지부터)
```

> ★★ **초과가 나는 곳은 40–60 이 아니라 80–90 이다.** 이것은 읽는 방법이 있다 —
> 40–60 의 벽은 **+18~19% 로 아슬하게 살아남았고**, 무너진 것은 이미 파워 비가
> 1.0 을 넘긴 후반부다. 그 구간은 원래 "골드가 남는" 구간이라 광고 골드가
> **곧바로 파워로 바뀐다.**
>
> **그래서 판단이 갈릴 수 있다.** 게이트의 명분(40–60 의 의도적 모자람을 지킨다)만
> 보면 80–90 의 초과는 다른 문제이고, "광고가 다른 게임을 만들면 안 된다"로 보면
> 같은 문제다. **게이트는 후자를 택했다** — 균일한 +20% 상한이다.
> 이 판단을 바꾸려면 상한을 구간별로 나눠야 하고, **구간별 상한은 튜닝 손잡이가
> 하나 더 생기는 것**이라 권하지 않는다.

### 6.5 스윕 — 무엇을 넣으면 통과하는가

`rewardMult` × `dailyViews` 를 훑은 결과 [실측 2026-08-07]. **"파워 증가"는 14개
체크포인트 중 최댓값**이다:

| 배수 · 하루 | 최대 파워 증가 | 판정 |
|---|---:|---|
| ×2.0 · 3회 | +35% 이상 | ✗ 6구간 초과 |
| **×2.0 · 1회** | **+28%** | **✗ 2구간 초과 ← 현재 설정** |
| ×1.6 · 3회 | +28% | ✗ |
| ×1.5 · 2회 | +19% | ✅ 통과 |
| ×1.4 · 2회 | +19% | ✅ 통과 |
| ×1.3 · 3회 | +19% | ✅ 통과 |

> ★ **`minStage` 는 결과를 거의 바꾸지 못한다** (6 / 40 / 60 / 80 을 전부 시도).
> 플레이어가 광고를 **골드가 가장 큰 최신 스테이지**에 몰아 쓰기 때문이고,
> 하네스도 그 최악의 경우로 계산한다.
> → **초반 스테이지를 제외하는 것은 경제 이유가 아니라 UX 이유다.**
> 신규 플레이어가 게임을 배우기도 전에 광고부터 만나지 않게 하는 것.
> `ads.json:_stageRangeDoc` 을 그 뜻으로 읽는다.

### 6.6 ★ 사용자 결정: **2배를 유지한다** = 선택지 B

| | 무엇 | 게이트 | 광고 수익 | 대가 |
|---|---|---|---|---|
| **A** | 수치를 낮춘다 (×1.5·2회 등) | ✅ 즉시 통과 | 낮음 | 없음 |
| ★ **B** | **×2.0 을 유지하고 경제를 재보정한다** | 재작성 | **높음** | **밸런싱 한 사이클** |
| **C** | 골드가 아닌 보상으로 바꾼다 | 해당 없음 | 가장 높음 | 성장 축 재검토 |

**사용자는 B 를 골랐다** (2026-08-07). "광고를 보면 골드 2배"는 플레이어가 즉시
이해하는 유일한 보상이고, ×1.3 짜리 보상은 **보러 갈 이유가 없어 결국 노출이 0 이
된다** — 55 §1.2 의 시청률 40% 가정이 무너지는 지점이 정확히 거기다.
**A 는 경제를 지키지만 광고를 무의미하게 만든다.**

### 6.7 B 를 실행하는 절차

#### ① 어느 쪽으로 미는가 — ★ 방향을 틀리면 정반대 문제가 된다

| 방법 | 무슨 일이 생기나 | 판정 |
|---|---|---|
| **`stages.json:difficultyMult` 를 초과 구간에서 올린다** | 적이 세지고, 광고를 켠 파워 비가 내려온다. **광고를 안 보는 플레이어는 원래 곡선 그대로다** | ★ **이쪽** |
| `balance.json:economy.goldPerStageBase` 를 낮춘다 | 수입 자체가 줄어 **광고를 안 보는 플레이어가 경제 벽에 부딪힌다** | ✗ **위험** |

> ★★★ **골드를 줄이는 방향은 설계 결정 5 를 정반대로 어긴다.**
> "벽은 항상 편성 퍼즐이고 절대 경제 벽이 아니다" 인데, 수입을 깎으면
> **광고를 거절한 사람에게 경제 벽이 생긴다.** 그것은 보상형이 아니라 **사실상 강제**이고
> (`CLAUDE.md` 하지 말 것: 강제 광고), 55 §2 가 지적한 바로 그 형태다.
> **난이도를 올리는 쪽은 두 부류 모두에게 같은 게임을 유지한다.**

#### ② 순서

| # | 무엇 | 왜 |
|---|---|---|
| 1 | `npm run economy` 로 **초과 구간을 특정**한다 (현재 80 · 90) | 전부 손대지 않는다. **초과한 곳만** |
| 2 | 그 구간의 `stages.json:difficultyMult` 를 올린다 | 광고 켠 파워 비가 `기존 비 × 1.2` 이하로 내려올 때까지 |
| 3 | `npm run economy` 재실행 — **경고가 사라질 때까지** | 광고 끈 곡선도 여전히 통과해야 한다 |
| 4 | ★ `npm run balance:check` (300시드 · **약 2시간**) | **여기가 진짜 관문이다** |
| 5 | `npm run playthrough` | 광고 0회로 100 스테이지 완주 |
| 6 | `ads.json:enabled = true` | 위 넷이 전부 통과한 뒤에만 |

> ★★★ **3번과 4번은 다른 질문이다.**
> `economy` 는 **"그 파워에 도달할 수 있는가"** 를 묻는 산술이고,
> `balance:check` 는 **"그 파워로 실제로 이기는가"** 를 묻는 300시드 시뮬레이션이다.
> `difficultyMult` 를 올리면 `economy` 는 금방 통과하는데 **그 스테이지가 아무도 못 깨는
> 스테이지가 되어 있을 수 있다.** 산술만 보고 넘어가면 그것을 출시하게 된다.

> ⚠ **미결 게이트 위에 재보정을 얹지 않는다.**
> 지금 하드 게이트 2항(**B3** 1-9 84.3% · **BN3** 5-20 나이트메어 0%)이 **사용자 결정
> 대기** 상태다 (`CLAUDE.md` · `22-nightmare.md` §0-A.1). 그 상태에서
> `difficultyMult` 를 만지면 **새로 깨진 것과 원래 깨져 있던 것을 구분할 수 없다.**
> 재보정 전에 `balance:check` 를 한 번 돌려 **기준선을 기록**한다.

#### ③ 실패 시 되돌아갈 곳

`difficultyMult` 를 올려도 4번(`balance:check`)이 통과하지 않으면, 그것은
**80–90 구간이 광고 없이도 이미 아슬한 상태**라는 뜻이다. 그때는 B 를 포기하고
**C(골드가 아닌 보상)** 로 간다 — §6.8.

### 6.8 A · C 는 대안으로 남는다

| | 언제 돌아오는가 |
|---|---|
| **A** (×1.5·2회 등) | B 의 `balance:check` 가 통과하지 않고, 광고 수익보다 일정이 급할 때. **데이터 세 줄이면 끝난다** |
| **C** (골드가 아닌 보상) | B 가 실패하고 A 의 노출 수가 무의미할 때. ★ **수익 상한이 가장 높다** — 하루 1~2회가 아니라 **전투마다** 제안할 수 있고, `adGold()` 가 0 이라 경제 게이트를 통과할 필요조차 없다 |

> ⚠ **C 를 고를 때의 함정:** 각인 리롤은 **기록보관소 시설과 축이 겹친다.**
> 메타 성장이 이미 "각인 선택지 수"를 손잡이로 쓰고 있어서
> (`CLAUDE.md` 설계 결정 4), 광고가 같은 축을 밀면 **시설 투자의 의미가 희석된다.**
> "광고를 보면 시설 없이도 같은 것을 얻는다"가 되면 골드 벽이 아니라
> **성장 벽을 광고로 넘는 것**이고 이름만 다른 같은 문제다.
> 리롤 외의 후보(그 판 한정 마나 시작치 · 부활 1회 · 순수 장식)도 같은 검토가 필요하다.

### 6.9 통과 기준 (어느 선택지든 공통)

| 게이트 | 조건 |
|---|---|
| `npm run economy` | 광고 켠 **파워** 증가분 **≤ +20%** (전 체크포인트) — 경고가 하나도 없어야 한다 |
| `npm run economy` | 광고 **끈** 상태에서 여전히 전 구간 통과 — 광고 없이도 도달 가능해야 한다 |
| `npm run balance:check` | 300시드. `difficultyMult` 를 만졌다면 **필수** |
| `npm run playthrough` | **광고 0회로** 100 스테이지 완주 — ★ 이것이 깨지면 광고가 사실상 강제가 된 것이다 |

> **이 넷을 통과하지 못하는 보상 수치는 넣지 않는다.** 55 §6 이 이미 그렇게 썼고,
> 결론이 뒤집힌 뒤에도 그 문장은 그대로다 — 뒤집힌 것은 "광고를 붙일 것인가"이지
> **"경제를 깨도 되는가"가 아니다.**

> ### ★ 실행 순서는 여기가 아니다
>
> 이 문서(56)는 **기술 상세**를 맡는다 — 무엇이 어떻게 동작하고, 어디서 깨지고,
> 왜 그 수치인가. **AdMob 계정 개설부터 출시까지 실제로 누르는 순서**는
> **[`58-free-ads-release-playbook.md`](58-free-ads-release-playbook.md)** 에 있다.
> §8 의 체크리스트는 그 순서서의 요약이며, 둘이 다르면 **57 이 맞다.**

---

## 7. 테스트 방법

### 7.1 무엇을 어디서 확인하는가

| 환경 | 광고가 뜨는가 | 무엇을 확인하는가 |
|---|---|---|
| `npm run dev` (웹) | ✗ | `Capacitor.isNativePlatform()` 이 false → **버튼이 비활성이고 예외가 없다** |
| `vitest` | ✗ | `logic/adReward.js` 의 경계값. 어댑터는 스텁 |
| Android 에뮬레이터 | ○ (테스트 광고) | 로드 → 표시 → 보상 → 상한 감소 |
| Android 실기기 (디버그) | ○ (테스트 광고) | ★ **몰입 모드 복귀** (§5.3 ③) · 세로 회전 없음 · BGM 복귀 |
| Android 실기기 (릴리스 · 테스트 기기 등록) | ○ (실제 광고, 미집계) | 실제 광고의 로드 시간 · 크기 |
| 비행기 모드 | ✗ | **게임 전체가 정상 동작하고 버튼만 비활성** |

### 7.2 테스트 광고

| 방법 | 언제 | 어떻게 |
|---|---|---|
| **테스트 광고 단위 ID** | 개발 전 기간 | §1.3. 어댑터가 `import.meta.env.DEV` 에서 자동 |
| **`isTesting: true`** | 실제 단위 ID 로 확인할 때 | `prepareRewardVideoAd({ adId, isTesting: true })` |
| **테스트 기기 등록** | 릴리스 빌드 검증 | `initialize({ initializeForTesting: true, testingDevices: ["<HASH>"] })` [소스 확인] |

기기 해시는 **logcat 에 찍힌다** — 광고를 한 번 요청하면
`Use RequestConfiguration.Builder().setTestDeviceIds(Arrays.asList("XXXX"))` 형태로
나온다. iOS 는 Xcode 콘솔에 같은 안내가 뜬다 [확인 — 구글 테스트 광고 문서].

### 7.3 ★★★ 하지 말 것

| | 왜 |
|---|---|
| **실제 광고 단위 ID 로 뜬 광고를 클릭한다** | **계정 정지.** 무효 트래픽. 되돌리기 매우 어렵다 |
| 지인에게 "광고 좀 눌러 줘" | 같은 이유. 유도된 클릭도 무효 트래픽이다 |
| 심사 제출 빌드에 `ads.json:testMode = true` | 심사자가 테스트 광고를 본다. 정책 위반이고, 그 상태로 승인되면 **실제 광고가 영원히 안 뜬다** |
| 광고를 자동 재생 · 강제 시청 | 보상형의 정의를 깬다. `CLAUDE.md` 하지 말 것 |

### 7.4 UMP 동의 폼을 한국에서 테스트하는 법

한국은 EEA 가 아니라서 **평소에는 동의 폼이 뜨지 않는다.** 그래서 이 코드 경로는
**출시 후 유럽 사용자에게서 처음 돌아간다** — 최악의 검증 순서다.

```
AdMob.requestConsentInfo({
  debugGeography: AdmobConsentDebugGeography.EEA,   // 1 = EEA [소스 확인]
  testDeviceIdentifiers: ["<기기 해시>"],
})
```

| 값 | 뜻 |
|---|---|
| `DISABLED` (0) | 기본 |
| `EEA` (1) | **EEA 인 것처럼** — GDPR 폼 확인 |
| `US` (3) | 규제 대상 미국 주인 것처럼 — 옵트아웃 확인 |
| `OTHER` (4) | 그 외 |

`AdMob.resetConsentInfo()` 로 상태를 지우고 다시 확인한다.

> ★ **확인해야 하는 것은 폼이 뜨는가가 아니라 셋이다.**
> ① 폼을 **동의**하면 광고가 뜬다 ② 폼을 **거부**하면 `canRequestAds` 가 false 이고
> **광고를 요청하지 않는다** ③ `privacyOptionsRequirementStatus === REQUIRED` 일 때
> 설정 화면에 항목이 **나타난다.**

### 7.5 실기기에서만 드러나는 것

이 저장소는 **화면을 진짜 입력으로 눌러 보기 전까지 lint · 테스트 · 검사기가 전부
통과한 결함**을 이미 셋 겪었다 (`CLAUDE.md`). 광고는 그 목록에 넷째가 되기 쉽다.

| 확인 | 왜 |
|---|---|
| 광고를 **중간에 닫는다** | §5.3 ① — 버튼이 굳는지 |
| 광고를 끝까지 본다 | 골드가 늘고 "오늘 n/6" 이 줄어드는지 |
| 광고 중 **홈 버튼 → 복귀** | 백그라운드 복귀 경로. 전투가 아니라 결과 화면이라 안전해야 하지만 확인한다 |
| 광고 후 **좌우 가장자리 터치** | §5.3 ③ — 시스템 바가 돌아왔는지 |
| 광고 중 · 후 **BGM** | 겹치는지 · 안 돌아오는지 (2026-08-02 BGM 겹침 버그와 같은 계열) |
| 비행기 모드에서 버튼 | 비활성이고 게임은 정상 |
| **자정을 넘겨서** | 상한이 초기화되는지 (기기 시간을 옮겨 확인) |

---

## 8. 출시 순서 체크리스트

> ### ★ 이 절은 요약이다 — 정본은 58 이다
>
> **AdMob 계정 개설부터 출시까지 실제로 누르는 순서**는
> **[`58-free-ads-release-playbook.md`](58-free-ads-release-playbook.md)** 가 맡는다.
> 이 문서(56)는 **기술 상세**를 맡는다 — 무엇이 어떻게 동작하고, 어디서 깨지고,
> 왜 그 수치인가. **둘이 다르면 57 이 맞다.**

### 0단계 — ★★★ 되돌릴 수 없는 결정

- [ ] **앱을 무료로 만들면 유료로 되돌릴 수 없다는 것을 이해했다** (`50 §8.1`)
- [ ] 그럼에도 무료로 간다 (§0 의 판단)
- [ ] Play Console → 앱 만들기 → **무료** 를 선택한다
- [ ] App Store Connect → 가격 → **무료**

> ★ **이 단계에서 광고는 아직 없다.** 무료로 만드는 것과 광고를 켜는 것은
> 같은 날 할 필요가 없다 (§0.2). 아래 1단계가 그 순서다.

### 1단계 — 1.0 은 광고 없이 낸다 (권장)

- [ ] `ads.json:enabled = false` **그리고 플러그인을 의존성에서 뺀다**
- [ ] `50` 의 절차 그대로 — 키스토어 · AAB · 클로즈드 테스트 14일 · 프로덕션
- [ ] 개인정보처리방침은 **현행(수집 0)** 그대로 유효하다
- [ ] 스토어 설명의 "광고가 없습니다" 도 **이 시점에는 사실이다**

> ⚠ **`enabled = false` 만으로는 부족하다** (§2.3). 플러그인이 의존성에 있으면
> SDK 가 **앱 시작 시 매니페스트의 `APPLICATION_ID` 를 읽는다** — 우리가 한 번도
> 부르지 않아도 그렇다. **1단계를 고른다면 플러그인 자체를 빼야** "수집 0" 이
> 정직한 답으로 남는다. 지금은 이미 설치돼 있으므로, 1단계로 가려면 되돌려야 한다.

> ★★ **왜 나누는가.** 첫 심사에 ① 신규 앱 ② 광고 SDK ③ 개인정보 3중 변경을
> 한꺼번에 얹으면 **반려 사유를 분리할 수 없다.** 그리고 개인 계정의 클로즈드
> 테스트 14일은 어차피 일정의 바닥이다 (`50 §6.2`) — 그 14일 동안 광고 배선을
> 완성하는 것이 가장 빠른 경로다.
>
> ⚠ **단, 스토어 설명에 "광고가 없습니다" 를 넣으면 1.1 에서 그것을 지워야 한다.**
> 지운 것을 사용자가 알아채고 리뷰에 쓴다. **처음부터 넣지 않는 편이 낫다** —
> "인앱 결제가 없습니다 · 확률형 요소가 없습니다" 두 줄만 남긴다.

### 2단계 — 광고 배선 (1.0 심사·테스트 기간에 병행)

- [ ] AdMob 가입 · 지급 프로필 · 세금 정보 (§1.1)
- [ ] Android 앱 · iOS 앱 각각 등록, **보상형 광고 단위** 2개 생성
- [ ] AdMob → 개인정보 보호 및 메시지 → **GDPR 메시지 생성 및 게시**
- [ ] AdMob → 개인정보 보호 및 메시지 → **US 주 규정 메시지 생성 및 게시**
- [ ] AdMob → 차단 관리 → **광고 콘텐츠 등급 G/PG**
- [x] `npm i @capacitor-community/admob@7.2.0` (§2.1 — **8.0.0 아님**) **[완료 2026-08-07]**
- [x] `AndroidManifest.xml` 에 `APPLICATION_ID` meta-data (§2.3) — **구글 테스트 앱 ID** **[완료]**
- [x] iOS `Info.plist` — `GADApplicationIdentifier` (테스트 앱 ID) **[완료]**
- [x] §5.3 의 셋 처리 (프라미스 경주 · `canRequestAds` · `immersiveMode`) **[완료]**
- [ ] iOS `Info.plist` — `SKAdNetworkItems` · `NSUserTrackingUsageDescription` (§2.5)
- [ ] 앱 ID 를 **실제 값**으로 교체 + `@string/admob_app_id` 로 분리 (§2.3)
- [ ] `ads.json:units.android` / `units.ios` 에 **실제 단위 ID** 기입
- [ ] 설정 화면에 **개인정보 옵션** 조건부 항목 (§3.2)

### 3단계 — 경제 게이트 (여기를 통과하지 못하면 켜지 않는다)

- [x] `f2p-power.mjs:adGold()` · `powerFromGold()` — 하네스가 광고를 안다 (§6.1) **[완료 2026-08-07]**
- [x] 게이트 축을 **골드 → 파워**로 정정 · `enabled` 와 무관하게 항상 계산 (§6.0 · §6.2) **[완료]**
- [x] 배수 × 일일횟수 스윕 (§6.5) **[완료]**
- [x] ★ **선택지 결정 — 사용자가 `B`(2배 유지 + 경제 재보정)를 골랐다** (§6.6) **[완료]**
- [ ] ★ **초과 구간(80 · 90)의 `stages.json:difficultyMult` 를 올린다** (§6.7 ①) ← **여기가 미결이다**
- [ ] `npm run balance:check` **기준선 기록** (재보정 전에 한 번)
- [ ] `npm run economy` — 광고 경고가 하나도 없을 것
- [ ] `npm run economy` — 광고 **끈** 상태도 전 구간 통과
- [ ] `npm run balance:check` (300시드 · 약 2시간) — `difficultyMult` 를 만졌으므로 **필수**
- [ ] `npm run playthrough` — 광고 0회로 100 스테이지 완주

> ★ `SAVE_VERSION` 은 **올리지 않았다** — 시청 기록이 `meta.ads` 안에 있어
> 정규화 한 줄이 옛 세이브를 채운다 (§5.1).

### 4단계 — 스토어 제출물 8종 동시 갱신 (§4.1)

- [ ] 개인정보처리방침 한국어판 교체 → GitHub Pages 반영
- [ ] 개인정보처리방침 영문판 교체 → `/en/` 반영
- [ ] Play → 앱 콘텐츠 → **광고 = 예**
- [ ] Play → 앱 콘텐츠 → **광고 ID = 예** (목적 3종)
- [ ] Play → **데이터 보안** 4개 유형 (§4.2)
- [ ] Apple → **App Privacy** (§4.3)
- [ ] `PrivacyInfo.xcprivacy` 교체 (§4.4) · Xcode 타깃 포함 확인
- [ ] Apple 연령 등급 설문 → **광고 노출 = 있음**
- [ ] 스토어 설명 · 스크린샷 카피에서 **"광고 없음" 전량 제거** (`50 §4.3` · `52 §4` · `53 §6.6` · `54 §4`)
- [ ] EU DSA 거래자 지위 재확인 (`53 §5.4`)

### 5단계 — 실기기 검증 (§7.5)

- [ ] 광고 중도 이탈 · 완주 · 상한 · 쿨다운 · 자정 경계
- [ ] 몰입 모드 복귀 · BGM 복귀 · 백그라운드 복귀
- [ ] 비행기 모드에서 게임 100% 동작
- [ ] UMP 폼 (debugGeography EEA) 동의/거부 양쪽
- [ ] iOS ATT 허용/거부 양쪽

### 6단계 — 켠다

- [ ] `ads.json:testMode = false` 확인
- [ ] `ads.json:enabled = true`
- [ ] `npm run verify` 전항 통과
- [ ] 내부 테스트 트랙 → 클로즈드 → 프로덕션
- [ ] 출시 후 **48시간 안에 AdMob 대시보드에서 노출이 잡히는지 확인** — 0 이면 §2.3 · §1.2 를 다시 본다

---

## 9. 확인처 URL

### 이 문서가 근거로 삼은 것 (2026-08-07 확인)

**플러그인**
- [`@capacitor-community/admob` — GitHub](https://github.com/capacitor-community/admob)
- [릴리스 목록](https://github.com/capacitor-community/admob/releases)
- npm 레지스트리 실측 (`registry.npmjs.org/@capacitor-community/admob`) — v7.2.0 = 2025-10-25 · v8.0.0 = 2025-12-27
- 소스 확인: `android/build.gradle` (minSdk 23 · compileSdk 35 · play-services-ads 24.7.+ · user-messaging-platform 3.1.0) · `rewarded/RewardedAdCallbackAndListeners.kt` · `ios/Sources/AdMobPlugin/Rewarded/AdRewardExecutor.swift` · `dist/esm/definitions.d.ts` · `dist/esm/consent/*.d.ts`

**Google — SDK 와 정책**
- [Set up Google Mobile Ads SDK (Android)](https://developers.google.com/admob/android/quick-start)
- [Rewarded ads (iOS)](https://developers.google.com/admob/ios/rewarded)
- [Enable test ads](https://developers.google.com/admob/android/test-ads)
- [Set up UMP SDK (Android)](https://developers.google.com/admob/android/privacy)
- [Set up UMP SDK (iOS)](https://developers.google.com/admob/ios/privacy)
- [Disclose to EEA users (Android)](https://developers.google.com/admob/android/next-gen/privacy/gdpr)
- [Google Play data disclosure (AdMob)](https://developers.google.com/admob/android/privacy/play-data-disclosure)
- [App Store data disclosure (AdMob)](https://developers.google.com/admob/ios/privacy/data-disclosure)
- [Privacy strategies (iOS) — SKAdNetworkItems 목록](https://developers.google.com/admob/ios/privacy/strategies)
- [Privacy strategies (Android) — 광고 ID · AD_ID 권한](https://support.google.com/admob/answer/11402075)
- [Helping publishers comply with US states privacy laws](https://support.google.com/admob/answer/9561022)
- [Restricted data processing settings](https://support.google.com/admob/answer/14125907)
- [ConsentInformation.PrivacyOptionsRequirementStatus](https://developers.google.com/admob/android/reference/privacy/com/google/android/ump/ConsentInformation.PrivacyOptionsRequirementStatus)

**Google Play Console**
- [Advertising ID](https://support.google.com/googleplay/android-developer/answer/6048248)
- [Data safety 섹션 작성](https://support.google.com/googleplay/android-developer/answer/10787469)
- [앱 · 게임 · 광고의 콘텐츠 등급 요건](https://support.google.com/googleplay/android-developer/answer/9859655)
- [콘텐츠 등급](https://support.google.com/googleplay/android-developer/answer/9898843)

**IARC**
- [IARC FAQ — 광고는 등급에 반영되지 않는다](https://globalratings.com/faq/)
- [IARC 광고·마케팅 가이드라인 (PDF)](https://web.iarcservices.com/Content/Guidelines/IARC_Advertising_and_Marketing_Guidelines.pdf)

### 이 문서가 답하지 못한 것

| 미결 | 왜 |
|---|---|
| ★★★ **스테이지 80 · 90 의 `difficultyMult` 를 얼마나 올릴 것인가** | 선택지 **B** 가 결정됐으므로(§6.6) 남은 것은 수치다. `economy` 는 금방 통과하지만 **`balance:check` 300시드(약 2시간)가 진짜 관문**이다 (§6.7 ②) |
| 그 재보정이 `balance:check` 를 통과하는가 | 통과하지 못하면 B 를 포기하고 **C(골드가 아닌 보상)** 로 간다 (§6.7 ③ · §6.8) |
| C 로 가게 될 경우 무엇을 줄 것인가 | 각인 리롤은 **기록보관소 시설과 축이 겹친다** (§6.8). 리롤 · 마나 시작치 · 부활 1회 · 장식 중 어느 것이 성장 벽을 광고로 넘게 만들지 않는가 |
| ⚠ **초과 구간이 40–60 이 아니라 80–90 이다** | 게이트의 명분(40–60 의 의도적 모자람 보호)만 보면 다른 문제이고, "광고가 다른 게임을 만들면 안 된다"로 보면 같은 문제다. 게이트는 균일 +20% 로 후자를 택했다 (§6.4). **이 판단을 바꿀 것인지** |
| 실제 eCPM | 켜 보기 전까지 모른다. 55 §1.2 의 $8~15 는 **광고 콘텐츠 등급 G 제한을 감안하지 않은** 값이라 실제로는 더 낮을 수 있다 [추정] |
| APK 증가 실측치 | `minifyEnabled false` 인 현재 구성에서 재 보고 판단한다 (§2.7) |
| `NSPrivacyTrackingDomains` 정확한 목록 | 구글 문서에서 복사한다. §4.4 의 세 줄은 **추정**이다 |
| `SKAdNetworkItems` 현재 목록 | 구글이 갱신한다. 링크에서 통째로 복사 |
| 무료 앱도 EU DSA 거래자인가 | 광고 수익은 상업 활동이므로 그럴 것 [추정]. **콘솔 문항에서 확인** |
| `playServicesAdsVersion` 고정이 먹히는가 | 플러그인이 `rootProject.ext` 를 읽는지 [추정] — 빌드해서 확인 |
| 광고 종료 후 시스템 바 복귀 여부 | 기기마다 다를 수 있다. §7.5 에서 실측 |

---

## 관련 문서

| 무엇 | 어디 |
|---|---|
| ★ **실제로 누르는 순서 (계정 → 출시)** | **[`58-free-ads-release-playbook.md`](58-free-ads-release-playbook.md)** — 56 은 기술 상세, 58 은 실행 순서. **둘이 다르면 58 이 맞다** |
| **왜 원래는 유료였는가 (계산 전문)** | [`55-monetization-decision.md`](55-monetization-decision.md) |
| Google Play 등록 절차 (한국 기준) | [`50-google-play-paid-codemagic.md`](50-google-play-paid-codemagic.md) |
| App Store 등록 절차 (한국 기준) | [`51-app-store-paid-codemagic.md`](51-app-store-paid-codemagic.md) |
| 영어권 확장 — 세금 · 등급 · 법무 · ASO | [`53-english-market-paid-release.md`](53-english-market-paid-release.md) |
| 스토어 이미지 · 카피 | [`52-store-image-codex-prompts.md`](52-store-image-codex-prompts.md) · [`54-english-store-art-codex-prompts.md`](54-english-store-art-codex-prompts.md) |
| **광고 활성화 시 재촬영할 스크린샷·교체 카피** | [`57-store-image-recapture-register.md`](57-store-image-recapture-register.md) §3 |
| 경제 곡선의 정본 | [`../02-design/14-economy-balance.md`](../02-design/14-economy-balance.md) · `npm run economy` |
| 무엇이 왜 사라졌는가 (광고 어댑터 포함) | [`../04-plan/34-scope-cut.md`](../04-plan/34-scope-cut.md) §2.1 |
| 시스템 바 · 가로 고정 | [`../03-tech/25-capacitor-mobile.md`](../03-tech/25-capacitor-mobile.md) §3.1 · §3.3 |
| 콜드 스타트 예산 | [`../03-tech/26-performance-budget.md`](../03-tech/26-performance-budget.md) §8 |
