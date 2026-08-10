# 51. App Store — 개인 계정으로 **무료 앱 + 보상형 광고** 등록하기 (Codemagic)

> 대상: **RIFT ARK** · `com.superdimension.app` · Capacitor 7 iOS
> 최초 작성 **2026-08-06** · **무료+광고 기준으로 본문 전면 개정 2026-08-07**
> **제출 직전 실측 정정 2026-08-10** (§0-A)
> 작업 환경 **Windows 11 (Mac 없음)** · 개발자 1인
>
> ★ **이 문서의 존재 이유 한 줄: 사용자에게 Mac 이 없다.**
> iOS 앱은 macOS 에서만 빌드·서명·업로드할 수 있다. Codemagic 의 macOS 인스턴스가
> 그 Mac 을 대신한다. **Mac 을 사지 않아도 App Store 에 낼 수 있다.**
> 그 절차(§6)는 유료든 무료든 **한 글자도 다르지 않다.**

> ### ⛔ 파일 이름의 `paid` 는 역사적 잔재다 — 이름을 바꾸지 않는다
>
> 이 문서는 **"개인 계정으로 유료 앱 등록하기"** 로 쓰였고, 2026-08-07 에
> 수익화 모델이 **무료 앱 + 보상형 광고(AdMob)** 로 확정되면서 본문이 교체됐다
> (`55-monetization-decision.md` 의 판정이 같은 날 뒤집혔다 — `56` §0).
>
> **파일 이름은 그대로 둔다.** 저장소의 다른 문서 여덟 곳이 이 경로로 이 문서를
> 가리키고 있고, 경로를 바꾸면 그 링크가 전부 죽는다. **이름이 낡은 것은 링크가
> 깨지는 것보다 훨씬 싼 비용이다.** 파일명을 근거로 "이 앱은 유료다"라고 읽지 않는다.

---

## ⚠ 이 문서를 읽는 법 — 확인한 것과 추정한 것

`56` 과 같은 표기를 쓴다.

| 표기 | 뜻 |
|---|---|
| **[확인 2026-08-07]** | 이 날짜에 Apple/Google 공식 문서에서 직접 확인했다. 링크는 §11 |
| **[실측]** | 이 저장소의 파일에서 직접 잰 값이다 |
| **[추정]** | 관행·유사 사례에서 유추했다. **그대로 믿지 말고 화면에서 확인한다** |
| **[화면이 권위]** | 문서와 App Store Connect 화면이 다르면 **화면이 맞다** |

**Apple 의 정책·화면·요구 스크린샷 규격은 이 문서보다 빨리 바뀐다.**

| 확인할 것 | 어디서 |
|---|---|
| 필수 스크린샷 규격(현재 요구되는 기기 크기) | App Store Connect → 앱 → 미리보기 및 스크린샷 |
| 최소 Xcode / SDK 요구 버전 | 업로드 시 거부 메시지 |
| 심사 가이드라인 (광고 조항은 **2.5.18**) | https://developer.apple.com/app-store/review/guidelines/ |
| AdMob 지급·세금에 필요한 서류 | AdMob → 지급 → 결제 정보 |

**나는 세무사도 변호사도 아니다.** §8 은 "무엇을 알아봐야 하는지"의 목록이다.

---

> ### ★ 이 문서는 **한국 출시 기준**이다
>
> 영어권(미국 · 영국 · 캐나다 · 호주 · EU)으로 확대할 때 달라지는 것은
> **[`53-english-market-paid-release.md`](53-english-market-paid-release.md)** 에 있다.
>
> | 여기(51)에 있는 것 | 영어권에서 달라지는 것 (53) |
> |---|---|
> | 연령 등급 (§4) | 53 §4.3 이 **신규 설문(13+ · 16+ · 18+) 기준의 정본**이다. 단 **광고 노출 문항의 답은 이제 "있음"** 이다 (§4.2) |
> | 앱 이름 · 부제 · 키워드 (§5.2) | 로마자 표기 결정 · 상표 검색 · 영문 키워드 100자 — 53 §6.4–6.5 |
> | 설명 (§5.2) | **App Store 는 설명이 검색 색인 대상이 아니다** — 53 §6.3 · §6.6 |
> | 앱 개인정보 라벨 (§5.3) | 53 §5.3 은 **"수집 안 함" 전제로 쓰여 있어 이제 틀렸다.** 정본은 **`56` §4.3 · §4.4** |
> | 심사 메모 (§5.5) | **영문으로 쓴다** — 심사자가 한국어를 읽지 않는다 |
> | 가격 · 수수료 · 세금 (§8) | 53 §1 · §2 는 **앱 판매 소득** 기준이다. 무료+광고에는 §8 이 정본 |
> | 판매 국가 (§7.1) | 어디를 켜고 어디를 끄는가 · **EU DSA 거래자 지위** — 53 §3 · §5.4 |
>
> ★ **App Store 에는 Play 의 "클로즈드 테스트 14일" 같은 관문이 없다.** 국가 추가는
> 체크박스다. 다만 **영어권용 앱을 새로 만들지 않는다** — 리뷰·평점이 0에서 시작한다
> (53 §8.1).

---

## 0-A. ★★★ 2026-08-10 정정 — 이 문서가 틀렸던 다섯 곳

**TestFlight 에 빌드가 올라간 뒤 제출 직전에 저장소를 실측했다.** 아래는 본문이
쓰인 뒤 코드가 바뀌었거나, 본문이 처음부터 틀렸던 항목이다. **충돌하면 이 절이 맞다.**

| # | 본문이 말하던 것 | 실제 |
|---|---|---|
| ① | §2.6 · §5.3 — **"ATT 를 요청하지 않는다"** | ⛔ **거짓이 됐다.** 2026-08-08 에 `native/ads.js` 가 `requestTrackingAuthorization()` 을 **실제로 부른다.** → **App Privacy 의 "Used to Track You" = 예**, `PrivacyInfo.xcprivacy` 는 `NSPrivacyTracking = true` |
| ② | §5.1 — 앱 이름 **`균열의 방주`** | **App Store 등록명은 `RIFT ARK`** (전부 대문자 · 로케일 하나). Play 만 `균열의 방주` 다. **두 스토어가 달라도 된다** — 심사가 대조하는 것은 *그 스토어 등록명 ↔ 그 기기 홈 화면 이름*이다 |
| ③ | §5.4 — iPad 지원 여부 **미결** | ✅ **iPhone 전용으로 확정** (2026-08-10 사용자 결정). `TARGETED_DEVICE_FAMILY = 1` → **iPad 스크린샷이 필요 없다** |
| ④ | §5.6 — 아이콘·스플래시가 Capacitor 기본값 | ✅ **교체 완료.** 그리고 **`icons:check` 가 이제 iOS 도 본다** — 크기가 아니라 `resources/` 원본과의 **내용 해시**를 대조한다 (기본 아이콘도 1024×1024 라 크기 검사는 통과시켰다) |
| ⑤ | §5.3.2 — `PrivacyInfo.xcprivacy` 만 만들면 된다 | ⛔ **부족했다.** 파일은 2026-08-08 에 만들어졌지만 **`project.pbxproj` 에 참조가 없어 IPA 에 안 들어갔다.** 그 상태로 TestFlight 빌드가 여러 번 올라갔다. 2026-08-10 에 타깃 등록 완료 |

### 0-A.1 그리고 검사기 넷이 새로 생겼다

⑤ 는 **빌드가 성공한 채로** 실패한다 — CI 는 침묵하고 유일한 신호는 며칠 뒤 오는
`ITMS-91053` 메일이다. ④ 는 4개월 동안 `verify` 전항 통과 아래 숨어 있었다.
**둘 다 사람이 제출 직전에 눈으로 확인하는 것이 유일한 방어였다.** 이제 기계가 잡는다:

| 검사 | 무엇 | 어디 |
|---|---|---|
| **A5** | iOS `Info.plist` 의 `GADApplicationIdentifier` — A4 의 iOS 짝 | `tools/check-production.mjs` |
| **A6** | `ITSAppUsesNonExemptEncryption` 누락 → Missing Compliance | ″ |
| **A7** | ATT **문구와 호출이 한쪽만** 있다 (양방향) | ″ |
| **A8** | `PrivacyInfo.xcprivacy` 가 `project.pbxproj` 에 없다 | ″ |
| iOS 아이콘 | 자산 카탈로그 ↔ `resources/` 내용 해시 | `tools/gen-app-icons.mjs --check` |

**A1–A4 가 안드로이드만 보고 있었던 것이 문제의 뿌리다.** 한쪽 플랫폼만 보는
검사기의 "통과"는 아무것도 보증하지 않는다 — 이 저장소가 이름을 붙여 둔 실패 유형이다.

---

## 0. 전체 그림

```
 [계정]  Apple Developer Program 개인 가입 ($99/년) ──→ 승인
            │
            ├─→ Bundle ID 등록 (com.superdimension.app)
            └─→ App Store Connect API 키(.p8) 발급  ← Codemagic 이 이걸로 서명·업로드
            │
            ⛔ 유료 앱 계약 · 은행 · 세금 정보 — **필요 없다** (§2.4)
            │
 [수익]  AdMob 가입 ──→ iOS 앱 등록 ──→ 보상형 광고 단위 ──→ 지급 프로필 · 세금 정보
            │           ↑ 이쪽이 은행·세금을 받는다. Apple 이 아니다
            │
 [앱]    App Store Connect 앱 생성 ──→ 앱 정보 · **App Privacy(수집함)** ·
            │                          연령 등급(**광고 있음**) · 스크린샷 · **가격 무료**
            │
 [CI]    Codemagic ──→ macOS 인스턴스 ──→ 자동 서명 ──→ TestFlight 업로드
            │
 [심사]  TestFlight 확인 ──→ 심사 제출 ──→ 승인 ──→ 출시
```

> **Android 를 먼저 띄우는 것을 권장한다.** iOS 는 비용($99/년)과 심사 변수가 크고,
> Android 쪽에서 스토어 문구·이미지·개인정보 문서를 이미 만들어 두면 iOS 는
> **그 재사용에 가깝다.**
>
> ★★ **그리고 광고는 1.0 에 넣지 않는 것을 권장한다** (`56` §8 1단계).
> 첫 심사에 ① 신규 앱 ② 광고 SDK ③ 개인정보 3중 변경을 한꺼번에 얹으면
> **반려 사유를 분리할 수 없다.** 이 문서의 §5.3 · §4.2 · §7.2 는 **광고를 켜는
> 릴리스**에서 적용되는 답이고, 광고 없는 1.0 에서는 옛 답(수집 안 함 · 광고 없음)이
> 그대로 참이다. **어느 릴리스인지를 먼저 정하고 절을 읽는다.**

### 0.1 유료 전제였을 때와 무엇이 다른가 — 한 눈 대조

| 절 | 유료 앱이었다면 | 무료 + 보상형 광고 |
|---|---|---|
| §2.4 계약 | **유료 앱 계약(Paid Applications) + 은행 + 세금** 필요. "활성"이 될 때까지 가격을 못 넣는다 | ⛔ **전부 불필요.** 무료 앱은 개발자 프로그램 라이선스 계약만으로 배포된다 [확인]. 대신 **AdMob 쪽에 지급·세금 설정**이 생긴다 |
| §5.3 App Privacy | Data **Not** Collected | **수집함** — Identifiers · Usage Data · Diagnostics · Coarse Location |
| §5.3 Privacy Manifest | `NSPrivacyTracking=false` · 배열 전부 빔 | **`NSPrivacyCollectedDataTypes` 가 비지 않는다.** ATT 를 켜면 `NSPrivacyTracking=true` + `NSPrivacyTrackingDomains` |
| §4 연령 등급 | 광고 노출 = 없음 | **광고 노출 = 있음** [확인 — 2025 개편 신규 문항] |
| §5.2 키워드 | `광고없음` 이 판매 포인트 | ★ **그 단어를 뺀다.** 남기면 허위 표시(2.3.1) |
| §7 심사 | 2.1 · 2.3 이 주 위험 | + **2.5.18(광고)** · **5.1.2(i)(추적을 조건으로 보상 금지)** · 3.2.2(iii) |
| §8 가격 | 티어 선택 · 인상 신중 | **무료(Tier 0).** Apple 은 **나중에 유료로 바꿀 수 있다** — Play 와 다르다 (§8.1) |
| §8 수수료 | Small Business Program 신청 = 15% | ⛔ **해당 없음.** Apple 에 낼 수수료 자체가 0 이다 (§8.2) |
| §8 세금 | W-8BEN 을 **Apple** 에 | 같은 성격의 서류를 **Google** 에 (§8.3) |
| §2.5 `Info.plist` | 암호화 면제 한 줄 | + `GADApplicationIdentifier` · `SKAdNetworkItems` · (ATT 를 켜면) 추적 문구 |
| §1.1 프로젝트 | 플러그인 8종 · 네트워크 0 | **9종째가 네트워크를 탄다** |

**광고 붙이는 절차·코드·경제 재보정은 여기 없다.** 전부
**[`56-admob-rewarded-integration.md`](56-admob-rewarded-integration.md)** 에 있다.
이 문서는 **App Store 쪽에서 무엇이 달라지는가**만 다룬다.

---

## 1. Mac 이 없다는 사실이 실제로 무엇을 막는가

| 작업 | Windows 에서 | 해결 |
|---|---|---|
| 웹 빌드 (`npm run build`) | ✅ 가능 | — |
| `npx cap sync ios` | ✅ 가능 (파일 복사일 뿐) | — |
| `pod install` | ❌ CocoaPods 은 macOS | Codemagic |
| Xcode 빌드 · 아카이브 | ❌ | Codemagic |
| 코드 서명 | ❌ | Codemagic 자동 서명 |
| App Store 업로드 | ❌ | Codemagic |
| **시뮬레이터/실기기 테스트** | ❌ | **TestFlight** — 아이폰이 있으면 실기 확인 가능 |
| **`Assets.xcassets` 편집 (아이콘·스플래시)** | ✅ **PNG 를 바꿔 넣는 것뿐이라 가능하다** | §5.6 |

> ⚠ **아이폰(또는 아이패드) 실기가 하나도 없으면 iOS 출시는 눈 감고 하는 것이다.**
> TestFlight 로 본인이 설치해 보는 것이 사실상 유일한 확인 수단이다.
> **아이폰이 없다면 iOS 출시를 뒤로 미루는 것이 합리적이다.**
>
> ★★ **광고가 그 위험을 한 단 올린다.** `56` §7.5 가 열거한 실기 전용 확인
> (광고 중도 이탈 시 버튼이 굳는가 · 광고 후 시스템 바가 돌아오는가 · BGM 복귀)은
> **시뮬레이터로도 잡히지 않는다.** iOS 에서 광고를 켜는 릴리스는 **아이폰 실기가
> 사실상 전제**다.

### 1.1 현재 iOS 프로젝트 상태 [실측 **2026-08-10**]

| 항목 | 값 | 비고 |
|---|---|---|
| `PRODUCT_BUNDLE_IDENTIFIER` | `com.superdimension.app` | Android 와 동일 |
| `IPHONEOS_DEPLOYMENT_TARGET` | `14.0` | 충분히 넓다 |
| `TARGETED_DEVICE_FAMILY` | ✅ **`1` (iPhone 전용)** | 2026-08-10 에 `"1,2"` 에서 낮췄다 — **iPad 스크린샷 불필요** (§5.4) |
| `MARKETING_VERSION` | `1.0` | = 사용자에게 보이는 버전 |
| `CURRENT_PROJECT_VERSION` | `1` | = 빌드 번호. CI 가 올린다 |
| 가로 고정 | `UISupportedInterfaceOrientations` 에 Landscape 만 | ✅ |
| iPad 관련 키 | `UISupportedInterfaceOrientations~ipad` · `UIRequiresFullScreen` | ⚠ **남아 있다.** iPhone 전용이라 지금은 무해하고, iPad 를 다시 켜는 날 그대로 필요하다 |
| Podfile | Capacitor 7 플러그인 **9종** | ✅ `@capacitor-community/admob` 포함 (2026-08-08) |
| `CFBundleDisplayName` | ✅ **`RIFT ARK`** | **전부 대문자** — App Store 등록명과 같다 (§5.1) |
| `ko.lproj/InfoPlist.strings` | ✅ **있다 — ATT 문구만** | `CFBundleDisplayName` 은 **일부러 없다** (§5.1) |
| `GADApplicationIdentifier` | ✅ **`ca-app-pub-6178685918745796~4018997989`** | 실제 앱 ID (2026-08-08). **A5 가 지킨다** |
| `ITSAppUsesNonExemptEncryption` | ✅ **`false`** | 2026-08-10 추가. **A6 이 지킨다** |
| `NSUserTrackingUsageDescription` | ✅ **있다 (한/영)** | ★ 코드가 ATT 를 **실제로 부른다** (§2.6). **A7 이 짝을 지킨다** |
| `PrivacyInfo.xcprivacy` | ✅ **있고 Xcode 타깃에 등록됨** | 파일만 있고 미등록이던 것을 2026-08-10 에 고쳤다. **A8 이 지킨다** |
| `Assets.xcassets/AppIcon` | ✅ **보라 균열** (`resources/icon-1024.png`) | 2026-08-10 교체. `icons:check` 가 해시로 지킨다 |
| `Assets.xcassets/Splash` | ✅ **교체됨** (3장 동일) | ″ |

**제출 전 필수 항목은 전부 닫혔다.** 남은 것은 App Store Connect 화면 입력뿐이다 (§5).

---

## 2. Apple Developer Program 가입

### 2.1 개인(Individual) 가입

1. https://developer.apple.com/programs/ → **Enroll**
2. Apple ID 로 로그인 (2단계 인증 필수)
3. **Entity Type: Individual / Sole Proprietor** 선택
4. 연회비 **US$99 / 년** 결제
5. 승인 — 보통 하루~며칠. 추가 신원 확인을 요구받을 수 있다

> **Apple Developer 앱(iPhone)** 으로 가입하면 신원 확인이 빠른 경우가 많다.
>
> ★ **무료 앱이라도 $99 는 낸다.** 개발자 프로그램 연회비는 앱 가격과 무관하다.
> 광고 수익이 연 $99 를 넘기 전까지 iOS 는 **적자**라는 뜻이고, 그것이
> "Android 를 먼저 띄운다"의 또 다른 이유다.

### 2.2 ★ 개인 vs 법인 — 판매자 이름이 공개된다

| | 개인 (Individual) | 법인 (Organization) |
|---|---|---|
| 준비물 | Apple ID + 신용카드 | **D-U-N-S 번호** + 법인 서류 |
| **App Store 에 표시되는 판매자명** | **본인 실명** (영문) | 법인명 |
| 준비 기간 | 며칠 | 몇 주 |
| 연회비 | $99 | $99 |

> ★★ **개인으로 가입하면 App Store 페이지에 본인 실명이 뜬다.** 무료 앱이어도
> 그렇다 — 예전 판이 "유료 앱은 판매자 정보가 더 노출된다"고 쓴 것은 **유료 앱
> 계약이 판매자 주소를 요구하기 때문**이었는데, 그 계약이 사라져도 노출 자체는 남는다.
>
> ★ **그리고 EU 를 켜면 DSA 거래자 지위가 주소·전화 공개를 요구한다.**
> **무료+광고 앱도 거래자로 볼 가능성이 높다** — 광고 수익은 상업 활동이다
> [추정 · 화면이 권위]. 판정과 절차는 53 §5.4.
>
> 인디 게임에서 개인 명의는 흔한 선택이고, 실명 노출이 실질적 문제를 일으키는
> 경우는 드물다. **결정만 미루지 않으면 된다.**

### 2.3 Bundle ID 등록

developer.apple.com → **Certificates, IDs & Profiles → Identifiers → +**

| 항목 | 값 |
|---|---|
| Type | App IDs → App |
| Description | RIFT ARK |
| Bundle ID | **Explicit** — `com.superdimension.app` |
| Capabilities | **아무것도 켜지 않는다** |

> **필요 없는 Capability 를 켜면 서명 프로파일이 복잡해지고 심사에서 질문을 받는다.**
>
> ★ **AdMob 은 Capability 를 하나도 요구하지 않는다** [확인 2026-08-07 — 구글 iOS
> 퀵스타트에 Capability 항목이 없다]. 광고를 붙였다고 여기서 켤 것이 생기지 않는다.
> ATT 도 Capability 가 아니라 **`Info.plist` 문구 + 런타임 호출**이다 (§2.6).
> 푸시·게임센터·인앱결제는 여전히 전부 끈 채로 둔다.

### 2.4 ★★★ 유료 앱 계약 — **무료 앱에는 필요 없다**

**예전 판의 §2.4 는 통째로 사라졌다.** 여기에 그 자리를 대신하는 표를 둔다.

| 무엇 | 유료 앱 | **무료 + 광고 (지금)** |
|---|---|---|
| Paid Applications Agreement | **필수.** 활성이 아니면 0원 아닌 가격을 넣을 수 없다 | ⛔ **불필요.** 무료 앱은 **Apple Developer Program License Agreement** 만으로 배포된다 [확인 2026-08-07] |
| 은행 계좌 (Apple) | 필수 | ⛔ 불필요 — **Apple 이 우리에게 보낼 돈이 없다** |
| 세금 정보 (Apple · W-8BEN 계열) | 필수 | ⛔ 불필요 |
| 담당자/법무/재무 연락처 | 필수 | ⛔ 불필요 |
| **광고 수익을 받기 위한 설정** | 해당 없음 | ★ **AdMob(AdSense) 쪽에 생긴다** — 아래 |

**AdMob 쪽에 생기는 것** [확인 2026-08-07 — AdMob 지급 도움말]

| 단계 | 내용 |
|---|---|
| ① 지급 프로필 | AdMob → 지급. 이름·주소가 **세금 서류와 일치**해야 한다 |
| ② 세금 정보 | 지역에 따라 요구된다. 한국 거주자는 **미국 원천징수용 서류(W-8BEN 상당)** 를 Google 에 제출한다 — Apple 에 내던 것이 Google 로 옮겨간 것뿐이다 (§8.3) |
| ③ 결제 수단 | 계좌 이체(EFT)·전신 송금 등. **본인 명의 한국 계좌 가능** |
| ④ 주소 확인(PIN) | 일정 수익에 도달하면 우편으로 PIN 이 온다 [확인] |
| ⑤ **지급 임계 $100** | 월 잔액이 $100(현지 통화 상당)에 도달해야 지급된다. 매월 20일 기준, 그 달을 못 넘기면 **이월된다** [확인] |

> ★★ **"수익이 났는데 돈이 안 들어온다"의 대부분은 ②나 ⑤다.** 세금 정보 미제출은
> 지급 보류로 나타나고, $100 미만은 조용히 이월된다. **둘 다 오류 메시지가 아니라
> 침묵으로 나타난다** — 이 저장소가 가장 자주 당한 모양 그대로다.

> ⛔ **Paid Applications Agreement 를 호기심으로 Request 하지 않는다.**
> 한번 요청·수락되면 계약이 계정에 남고, 필요한 정보가 미완이면 상태가
> **"Pending User Info"** 로 뜬다. 그 상태에서 **무료 앱의 제출·업데이트까지
> 막혔다는 보고**가 개발자 포럼에 있다 [추정 — 포럼 보고. 화면이 권위].
> **나중에 유료로 전환하기로 결정하는 그날 맺으면 된다** (§8.1 — Apple 은 그것이 된다).

### 2.5 `Info.plist` — 무엇을 넣고 무엇을 넣지 않는가

`FE/ios/App/App/Info.plist`

| 키 | 값 | 현재 [실측 2026-08-07] |
|---|---|---|
| `ITSAppUsesNonExemptEncryption` | `<false/>` | ★ **없다. 넣는다** |
| `GADApplicationIdentifier` | `ca-app-pub-…~…` (iOS **앱** ID) | ★ **있다 — 구글 테스트 앱 ID.** 실제 ID 로 교체 필요 |
| `SKAdNetworkItems` | 구글 문서에서 **통째로 복사** | 없다. `56` §2.5 |
| `NSUserTrackingUsageDescription` | §2.6 의 결정에 따름 | **의도적으로 없다** |
| `GADIsAdManagerApp` | — | **넣지 않는다.** Ad Manager 용이고 AdMob 에는 불필요 |
| `CFBundleDisplayName` | `Rift Ark` | 있다. 한국어 기기에 `균열의 방주` 를 띄우려면 `ko.lproj/InfoPlist.strings` 가 필요하다 (53) |

**암호화 면제 선언**

```xml
<key>ITSAppUsesNonExemptEncryption</key>
<false/>
```

> ★★★ **결론은 그대로인데 이유가 바뀌었다 — 그래서 문장을 바꾼다.**
>
> 예전 판은 *"이 게임은 네트워크 통신 자체가 없다"* 를 근거로 삼았다.
> **그 문장은 광고가 붙는 순간 거짓이 된다.** 지금의 근거는 다르다:
> **OS 가 제공하는 표준 암호화(URLSession 의 HTTPS/TLS)만 쓰고, 우리가 암호화를
> 구현하지 않는다** — 그것이 면제 사유다 [확인 2026-08-07 — Apple 수출 규정 문서].
>
> ⚠ **다만 한 가지를 확인해야 한다.** 면제 판정은 **번들에 들어가는 서드파티
> SDK 까지 포함**한다. 자체 암호 엔진을 싣는 SDK 가 있으면 `false` 가 거짓이 된다.
> Google Mobile Ads 는 표준 HTTPS 만 쓴다 [추정 — 구글이 자체 암호 구현을
> 광고하지 않는다]. **AdMob 외의 SDK 를 더 붙이는 날 이 줄을 다시 본다.**
>
> 이 선언이 없으면 제출할 때마다 "수출 규정 준수"를 묻고, 답을 빠뜨리면
> **빌드가 "Missing Compliance" 로 심사에 못 들어간다** (§10).

### 2.6 ★★ ATT(App Tracking Transparency) — 언제 필요하고, 우리는 왜 안 하는가

**ATT 는 "광고를 붙이면 필요한 것"이 아니다. "추적을 하면 필요한 것"이다.**

| 우리가 하는 것 | ATT 프롬프트 | 근거 |
|---|---|---|
| IDFA 를 읽어 **개인 맞춤 광고**를 요청한다 | **필수** | 심사 지침 **5.1.2(i)**: *"You must receive explicit permission from users via the App Tracking Transparency APIs to track their activity."* [확인 2026-08-07] |
| IDFA 를 읽지 않고 **비개인화(제한) 광고**만 받는다 | **불필요** | 구글 문서가 *"If you decide to include App Tracking Transparency…"* 로 **선택지로** 쓴다. 동의가 없으면 제한 광고가 나간다 [확인 2026-08-07] |

### ⛔ 아래 "요청하지 않는다"는 **2026-08-08 에 뒤집혔다** — 정정

**이 프로젝트의 현재 선택: ATT 를 요청한다.** [실측 **2026-08-10**]

`FE/src/native/ads.js:initAds()` 가 **UMP 동의 다음 순서로** iOS 에서
`AdMob.requestTrackingAuthorization()` 을 부른다. 그래서:

| 무엇 | 답 |
|---|---|
| `Info.plist` · `ko.lproj` 의 `NSUserTrackingUsageDescription` | ✅ **있어야 한다** (한/영 둘 다) |
| `PrivacyInfo.xcprivacy` 의 `NSPrivacyTracking` | ✅ **`true`** |
| App Privacy 의 **"Used to Track You"** | ✅ **예** (§5.3.1) |
| 개인정보 처리방침 | ✅ 추적을 말해야 한다 |

> ★★ **A7 이 문구와 호출의 짝을 양방향으로 지킨다.** 문구만 있으면 심사자가
> "추적을 하는가"를 되묻고, 호출만 있으면 **프롬프트가 뜨지 않고 즉시 거부로
> 떨어진다.** 둘은 **언제나 함께 들어오고 함께 빠진다.**

**아래 문단은 ATT 를 끄기로 되돌리는 날을 위해 남긴다** — 그때 §5.3 의 넷을
같은 커밋에서 함께 되돌린다.

<details><summary>ATT 를 요청하지 않던 시절의 판정 (2026-08-07)</summary>

`FE/src/native/ads.js` 는 UMP 동의(`requestConsentInfo` · `canRequestAds`)만 다루고
**`requestTrackingAuthorization()` 을 부르는 코드가 한 줄도 없었다.**
그래서 `Info.plist` 에 `NSUserTrackingUsageDescription` 이 **없는 것이 맞았다.**

| | 대가 |
|---|---|
| 얻는 것 | 첫 실행 프롬프트가 하나 줄어든다 · App Privacy 의 **"Used to Track You" 를 "아니오"로 답할 수 있다** · `PrivacyInfo.xcprivacy` 가 단순해진다 (§5.3) |
| 잃는 것 | **비개인화 광고만 나가서 eCPM 이 떨어진다** [추정]. `55` §1.2 의 $8~15 는 이 제한을 감안하지 않은 값이고, `56` §1.4 의 광고 콘텐츠 등급 G 제한과 **겹쳐서** 더 내려간다 |

</details>

> ★★★ **쓰지 않는 권한 문구를 넣지 않는다.**
> `NSUserTrackingUsageDescription` 만 넣고 ATT 를 호출하지 않으면, 심사자가
> **"추적을 하는가"를 되묻는다** — 문구는 있는데 프롬프트가 뜨지 않고,
> App Privacy 의 추적 답과도 대조된다 [추정]. 반대로 문구 없이
> `requestTrackingAuthorization()` 을 부르면 **프롬프트가 뜨지 않고 즉시 거부로
> 떨어진다** [추정]. **문구와 호출은 언제나 함께 들어오고 함께 빠진다.**
> 이 저장소의 이름이 붙은 실패 유형 그대로다 — *선언했는데 아무도 읽지 않는 것.*

**ATT 를 넣기로 한다면** (수익을 위해 개인 맞춤 광고를 켜기로 결정한 경우)

1. `native/ads.js` 에 `AdMob.requestTrackingAuthorization()` 을 넣는다 — **순서는
   UMP 동의 → ATT** (`56` §3.3)
2. `Info.plist` 에 문구를 넣는다. **정본은 `56` §3.3 이다** — 같은 문장을 두 문서에
   각자 적으면 반드시 갈라진다

```
(ko) 관련성 높은 광고를 보여 주기 위해 기기의 광고 식별자를 사용합니다.
     허용하지 않아도 게임의 모든 기능을 그대로 이용할 수 있습니다.

(en) RIFT ARK uses your device's advertising identifier to show more relevant
     ads. Declining does not restrict any part of the game.
```

3. `PrivacyInfo.xcprivacy` 를 추적 버전으로 바꾼다 (§5.3 · `56` §4.4)
4. App Privacy 의 **Used to Track You = 예** (§5.3)

> ⛔⛔ **ATT 허용을 조건으로 보상을 주지 않는다.** 지침 5.1.2(i) 의 뒷문장이 그것을
> 직접 금지한다 [확인 — 원문 인용]:
> *"Your app may not require users to enable system functionalities (e.g. push
> notifications, location services, **tracking**) in order to access functionality,
> content, use the app, or **receive monetary or other compensation**."*
>
> 즉 **"추적을 허용하면 골드 2배"** 는 그 자리에서 반려다. 위 문구가 굳이
> *"허용하지 않아도 전부 이용할 수 있다"* 를 말하는 이유는 정직해서이기도 하지만
> **그것이 이 게임의 사실**이기 때문이다 — 광고는 결과 화면의 선택지 하나이고,
> 광고를 한 번도 보지 않아도 100 스테이지를 완주한다 (`56` §6.6 의 `playthrough` 게이트).

---

## 3. App Store Connect API 키 — Codemagic 의 열쇠

Codemagic 이 **서명하고 업로드**하려면 이 키가 필요하다. 인증서(.p12)나 프로비저닝
프로파일을 손으로 만들 필요가 **없다** — 자동 서명이 API 키로 다 한다.
**이 절은 유료/무료와 무관하다.**

App Store Connect → **사용자 및 액세스 → 통합 → App Store Connect API → 키 생성**

| 항목 | 값 |
|---|---|
| 이름 | `codemagic` |
| 액세스 권한 | **App Manager** (Admin 까지 줄 필요 없다) |

발급 후 기록할 세 가지:

| | |
|---|---|
| **Issuer ID** | 키 목록 상단에 표시 (UUID) |
| **Key ID** | 각 키 행에 표시 |
| **`AuthKey_XXXX.p8`** | ★ **딱 한 번만 다운로드된다. 잃으면 재발급뿐이다** |

> ★★ **`.p8` 을 저장소에 넣지 않는다.** Codemagic 의 금고에만 넣는다 (§6.2).

---

## 4. 연령 등급 · 광고 등급 **(한국 기준 — 설문 정본은 53 §4.3)**

### 4.1 무엇이 등급을 정하는가

| 항목 | 내용 |
|---|---|
| 연령 등급 | App Store Connect 의 자체 설문으로 결정 |
| 한국 게임 등급 | Apple 은 게임물관리위원회가 지정한 **자체등급분류사업자**다. 설문 결과가 국내 등급이 된다 |
| **확률형 아이템** | **없음 — 광고가 붙어도 그대로 없다.** 광고 보상은 `ads.json:rewardMult` **고정값**이고 `logic/adReward.js` 에 `Math.random()` 이 없다 (`CLAUDE.md` 절대 규칙 6 · `56` §3.6) |
| 인앱 결제 | **없음** |
| 앱 가격 | **무료** |
| **광고** | ★ **있음 (보상형 1종 · 결과 화면)** |

> ⛔ **예전 판의 설문 답변표(12+ · 17+ 기준)는 삭제됐다.** Apple 은 2025-07 에
> **13+ · 16+ · 18+** 로 개편했고, **신규 앱은 처음부터 신규 설문을 받는다.**
> **전체 답변표의 정본은 `53-english-market-paid-release.md` §4.3** 이다.

### 4.2 ★ 광고가 설문에서 바꾸는 것 — 딱 한 줄이다

| 문항 | 광고 전 (53 §4.3 의 표) | **광고를 켜는 릴리스** |
|---|---|---|
| **광고 노출 (2025 신규 문항)** | 없음 | ★ **있음** [확인 2026-08-07 — 신규 설문에 광고 문항이 포함됐다] |
| 나머지 소셜 문항 (UGC · 메시징 · 친구/팔로워 · 라이브스트리밍 · 제작 도구) | 전부 없음 | **그대로 전부 없음** |
| 만화/판타지 폭력 | 가끔/약함 | 그대로 |
| 도박 · 확률형 | 없음 | **그대로 없음** |

**예상 등급: 9+ 유지** [추정 · 화면이 권위]. 광고 문항 하나가 등급을 올릴지는
설문 결과 화면에서 확인한다 — **올라간다면 그것은 정직한 결과이지 버그가 아니다.**

> ★★ **두 스토어가 여기서 갈린다.** Google Play 의 IARC 는 **광고를 등급에 반영하지
> 않는다** [확인 — `56` §4.1]. Apple 은 **반영할 수 있는 문항을 새로 넣었다.**
> 그래서 **Play 등급과 App Store 등급이 달라져도 정상**이다. 맞추려고 어느 한쪽에
> 거짓으로 답하지 않는다.
>
> ⚠ **등급은 수동으로 올릴 수는 있어도 내릴 수는 없다.** 4+ 를 노리려고 폭력이나
> 광고를 "없음"으로 답하는 것은 **1.3(연령 등급) · 2.3(정확한 메타데이터) 반려**
> 사유다. 전투 게임이 폭력 없음으로, 광고 있는 앱이 광고 없음으로 신고되면
> **심사자가 스크린샷과 빌드만 봐도 안다.**

### 4.3 ★ 광고 자체의 등급 — 지침 2.5.18 이 요구한다

심사 지침 **2.5.18** 원문 [확인 2026-08-07]:

> *"Ads displayed in an app must be appropriate for the app's age rating … Apps that
> contain ads must also include the ability for users to report any inappropriate or
> age-inappropriate ads."*

| 요구 | 우리가 하는 것 |
|---|---|
| 광고가 **앱 등급을 넘지 않을 것** | AdMob → 차단 관리 → **광고 콘텐츠 등급 G(또는 PG)** + 코드의 `maxAdContentRating: "General"` — **두 곳에 같은 말** (`56` §1.4) |
| **부적절한 광고를 신고할 수 있을 것** | ★ AdMob 광고에는 구글이 제공하는 정보/신고 경로(AdChoices)가 붙는다 [추정]. **별도 UI 가 필요한지는 화면에서 확인한다** — 필요하면 설정 화면의 문의 이메일이 최소 대안이다 |
| 전면 광고의 닫기 버튼 · 광고임을 명시 | **해당 없음** — 전면·배너를 만들지 않는다 (`CLAUDE.md` 하지 말 것) |
| 확장·위젯·알림에 광고 금지 | **해당 없음** — 확장이 하나도 없다 |

> ★ **광고 콘텐츠 등급을 낮출수록 eCPM 이 떨어진다.** 이것은 트레이드오프가 아니라
> **정책이 정한 값**이다 — 9+ 앱에 성인 광고가 뜨면 지침 위반이고, 그 위험을
> 감수해서 얻을 것이 없다.

---

## 5. App Store Connect 앱 등록

### 5.1 앱 생성

App Store Connect → **앱 → +** → 신규 앱

| 항목 | 값 |
|---|---|
| 플랫폼 | iOS |
| 이름 | ★ **`RIFT ARK`** — 전부 대문자 (2026-08-10 실제 등록값) |
| 기본 언어 | 한국어 **(영어권 확대 시 기본 언어를 바꿀지는 53 §6.1)** |
| 번들 ID | `com.superdimension.app` (§2.3 에서 등록한 것) |
| SKU | `RIFTARK001` (내부 식별자 · 아무 문자열) |
| 사용자 액세스 | 전체 액세스 |

> ★★★ **두 스토어의 이름이 다르고, 그것이 맞다** (2026-08-10).
>
> | | 스토어 등록명 | 기기 홈 화면 |
> |---|---|---|
> | **App Store** | `RIFT ARK` (로케일 하나) | `RIFT ARK` — `Info.plist:CFBundleDisplayName` |
> | **Google Play** | `균열의 방주` | ko `균열의 방주` · en `Rift Ark` |
>
> 심사가 대조하는 것은 **그 스토어의 등록명 ↔ 그 기기의 홈 화면 이름**이지
> **두 스토어 사이가 아니다.** Apple 은 Play 와 맞추라고 요구하지 않는다.
>
> ⚠ **그래서 `ko.lproj/InfoPlist.strings` 에 `CFBundleDisplayName` 을 넣지 않았다.**
> App Store 등록명이 `RIFT ARK` 하나뿐인데 한국어 기기에만 `균열의 방주` 를 띄우면
> **그 로케일에서 둘이 어긋난다.** → **등록명에 한국어 현지화를 추가하는 날
> 그 파일에 `CFBundleDisplayName` 을 함께 넣는다. 둘은 한 쌍이다.**
>
> ★ **대소문자까지 맞춘다.** 등록명이 전부 대문자라 `CFBundleDisplayName` 도
> `RIFT ARK` 다. 등록명을 바꾸는 날 그 한 줄도 같이 바꾼다.

> ★ **앱 생성 화면에서는 가격을 묻지 않는다.** Play 와 다른 점이다 —
> Play 는 **앱 만들기 시점에 무료/유료를 고르고 무료→유료가 영구히 막힌다**
> (`50` §8.1). App Store 는 **나중에 가격 화면에서 정하고, 나중에 바꿀 수도 있다**
> (§8.1). **그래서 iOS 쪽에는 "되돌릴 수 없는 순간"이 없다.**

### 5.2 앱 정보

| 항목 | 규격 | 내용 |
|---|---|---|
| 부제 | 30자 | `레인 3개를 지키는 디펜스` |
| 카테고리 | | 기본: 게임 → **전략** · 보조: 게임 → **액션** |
| **프로모션 텍스트** | 170자 | 심사 없이 언제든 바꿀 수 있다. 업데이트 안내에 쓴다 |
| **설명** | 4000자 | `50-google-play-paid-codemagic.md` §4.3 과 **같은 문구를 쓴다** |
| 키워드 | 100자, 쉼표 구분 | 아래 ★ |
| 지원 URL | ★필수 | `https://github.com/JH201421228/rift-ark` (public · Issues 있음) |
| 마케팅 URL | 선택 | |
| ★★ **저작권** | ★**필수** | **`2026 JuHeon Park`** — 아래 §5.2.1 |
| **개인정보 처리방침 URL** | ★필수 | ★★ **입력하는 곳이 "앱 정보"가 아니다** — 아래 §5.2.1 |

#### 5.2.1 ★★★ 심사 제출을 실제로 막은 두 필드 (2026-08-10)

제출 버튼이 **"심사에 추가할 수 없음"** 으로 막혔다. 둘 다 이 문서에 없던 항목이다.

| 막은 것 | 어디에 있나 | 값 |
|---|---|---|
| **개인정보 처리방침 URL** | ⛔ **앱 정보 페이지가 아니다.** 사이드바 **앱 개인정보(App Privacy)** → 페이지 맨 위 "개인정보 처리방침" → 편집 | `https://jh201421228.github.io/riftark-privacy/` |
| **저작권 (Copyright)** | **버전 페이지**(`1.0 제출 준비 중`) → 아래로 스크롤 → **일반 앱 정보** 섹션 | `2026 JuHeon Park` |

**저작권 필드의 규칙** — *"권리를 취득한 연도 + 권리 보유자 이름"* 이다.

| | |
|---|---|
| ⛔ `©` 기호 | 넣지 않는다. Apple 이 표시할 때 붙인다 |
| ⛔ URL | 넣지 않는다 |
| ⛔ **앱 이름(`RIFT ARK`)** | **넣지 않는다.** 여기는 *권리자 이름* 칸이다 — 가장 흔한 오입력이다 |
| 이름 표기 | **Apple Developer 계정의 법적 이름과 같게.** 이 프로젝트는 `JuHeon Park` 이다 — 배포 인증서 이름(`JuHeon Park Distribution`)이 그 이름에서 나온다 |

> ★ **개인 계정이라 이 이름은 어차피 판매자명으로 App Store 에 공개된다** (§2.2).
> 저작권 칸에 한글(`2026 박주헌`)을 넣어도 거부되지는 않지만, 판매자명이 로마자로
> 표시되므로 **둘을 같은 표기로 맞추는 편이 낫다.**

> ⚠ **개인정보 처리방침 URL 은 언어별 필드다.** 지금은 한국어 하나뿐이라 한 번만
> 넣으면 되지만, 영어 현지화를 추가하는 날 **그 언어에도 같은 URL 을 넣어야 한다** —
> 안 넣으면 그 언어에서만 제출이 막힌다.

★ **키워드에서 `광고없음` 을 뺀다.**

```
디펜스,레인디펜스,전략,로그라이트,싱글플레이,오프라인,픽셀,인디
```

> ★★★ **"광고 없음"은 이 게임의 가장 강한 카피였고, 이제 쓸 수 없다.**
> 키워드 · 부제 · 설명 · 스크린샷 카피 **어디에도** 남기지 않는다 — 광고가 있는
> 앱이 광고 없음을 광고하면 **2.3.1(정확한 메타데이터) 반려**다.
> 남는 두 줄(**인앱 결제 없음 · 확률형 없음**)은 그대로 강하다 (`56` §0.1).
>
> ⚠ **광고 없는 1.0 을 먼저 내는 경우에도 넣지 않는 편이 낫다** (`56` §8 1단계).
> 그때는 사실이지만, 1.1 에서 지워야 하고 **지운 것을 사용자가 알아채고 리뷰에 쓴다.**
>
> **경쟁작 상표를 키워드에 넣으면 반려될 수 있다** — 예전 목록의 `팔라독` 도 뺐다.
>
> ★★ **(한국 기준 — 영어권은 53 §6.3 · §6.5)** App Store 는 **설명이 검색 색인
> 대상이 아니다.** ASO 가 **이름 30 + 부제 30 + 키워드 100 = 160자** 안에서 전부
> 끝난다 — Google Play 는 반대로 **긴 설명 본문이 색인된다.**

### 5.3 ★★★ 앱 개인정보 — 여기가 가장 크게 바뀐다

**예전 판: "데이터를 수집하지 않습니다(Data Not Collected)".**
**광고를 켜는 릴리스: 그 답이 거짓이 된다.**

#### 5.3.1 App Privacy (영양성분표)

App Store Connect → 앱 → **앱 개인정보 보호 → 시작하기**

| 질문 | 광고 없는 1.0 | **광고 릴리스** |
|---|---|---|
| Do you or your third-party partners collect data from this app? | No | ★ **Yes** |

**"Yes" 를 고른 뒤의 답** (구글 iOS 데이터 공개 문서의 열거를 Apple 카테고리로 매핑.
매핑 자체는 **[추정]** 이고 정본 표는 `56` §4.3)

| Apple 카테고리 | 세부 항목 | 용도 | Linked to You | Used to Track You |
|---|---|---|---|---|
| **Identifiers** | Device ID (광고 식별자 · App set ID) | Third-Party Advertising · Analytics | **Not Linked** [추정 — 계정이 없다] | ★ **예** |
| **Usage Data** | Product Interaction · **Advertising Data** (본 광고) | Third-Party Advertising · Analytics | Not Linked | ★ **예** |
| **Diagnostics** | Crash Data · Performance Data | Analytics · App Functionality | Not Linked | 아니오 |
| **Location** | **Coarse Location** (IP 기반 추정) | Third-Party Advertising · Analytics | Not Linked | ★ **예** |

> ★★★ **"Used to Track You" 가 예인 이유는 ATT 를 켰기 때문이다** (2026-08-10 정정).
> 이 표는 원래 §5.3.3 을 가리키며 답을 미루고 있었고, 그 §5.3.3 은 "ATT 를 쓰지
> 않으므로 네 곳 모두 아니오"라고 답했다. **그 전제가 2026-08-08 에 뒤집혔다** (§2.6).

> ⚠ **"or your third-party partners" 가 함정이다.** 4개월간 이 문항의 답이 "No"
> 였던 이유는 **플러그인 8종이 전부 네트워크를 타지 않아서**였다 (§1.1).
> 이제 **아홉 번째가 네트워크를 탄다.** 답이 바뀌는 것은 우리가 코드를 더 써서가
> 아니라 **SDK 하나가 들어와서**다.
>
> ★ **게임 자신의 세이브는 여전히 "수집"이 아니다.** `@capacitor/preferences` 는
> 기기 밖으로 나가지 않는다. **방침에 그 구분을 명시해야 심사자가 두 종류의
> 데이터를 섞어 읽지 않는다** (`56` §4.5 의 3항).

#### 5.3.2 `PrivacyInfo.xcprivacy` — ✅ 있고, **Xcode 타깃에도 등록됐다** [실측 2026-08-10]

> ★★★ **파일을 만드는 것으로 끝나지 않았다.** 2026-08-08 에 파일이 생겼지만
> `App.xcodeproj/project.pbxproj` 에 참조가 없어 **IPA 에 들어가지 않았고**,
> 그 상태로 TestFlight 빌드가 여러 번 올라갔다. 2026-08-10 에 타깃 등록을 마쳤다.
>
> **아래 본문의 "아직 없다"는 낡았다.** 정본은 저장소의 실제 파일이고,
> 아래 예시 XML 을 **그대로 복사하지 않는다.**
>
> ★ **`A8` 이 이제 이것을 지킨다** (`check:prod`) — pbxproj 에 참조가 없으면 빌드를 멈춘다.

##### ★★★ 그리고 번들에 들어간 순간 **ITMS-91056 으로 반려됐다** (2026-08-10, 빌드 12)

파일은 08-08 에 만들어졌지만 타깃 미등록으로 **4일 동안 IPA 밖에 있었다.**
08-10 에 넣자마자 **처음으로 검증을 받고 그 자리에서 떨어졌다.**

> **번들에 없던 파일은 옳은지 그른지조차 알 수 없다.** "만들어 뒀다"는 검증이 아니다.

| | |
|---|---|
| 규칙 | **`NSPrivacyTracking` 이 `true` 면 `NSPrivacyTrackingDomains` 가 비어 있으면 안 된다** |
| 우리 상태 | `true` + `<array/>` → 위반 |

**고치는 방향이 둘인데 한쪽은 위험하다.**

| 안 | 결과 |
|---|---|
| ① 도메인에 구글 광고 도메인을 적는다 | ⛔ **광고가 깨진다** |
| ② **`NSPrivacyTracking = false` · 도메인 키 제거** | ✅ **택함** |

> ⛔ **①이 위험한 이유: 이 키는 선언이 아니라 동작이다.** 여기 적힌 도메인은
> **ATT 를 허용하지 않은 사용자에게 네트워크 요청이 실패한다.** 구글 광고
> 도메인을 적으면 ATT 거부 사용자에게 **비개인화 광고까지 막히고**, 개인정보
> 처리방침의 *"거부해도 광고는 계속 표시됩니다"* 가 그 자리에서 거짓이 된다.
>
> ★★ **②가 옳은 이유: 이 파일은 "우리 앱 자신의 코드"를 기술한다.** 이 게임의
> 1차 코드는 네트워크를 하나도 타지 않는다. 추적하는 것은 **Google Mobile Ads
> SDK** 이고, 그 SDK 는 자기 매니페스트를 프레임워크 안에 내장한다 —
> **Xcode 가 빌드 시 병합**한다. SDK 의 추적과 도메인을 우리가 대신 적을 필요가
> 없고, 적으면 안 된다.
>
> ★ **App Privacy 의 "Used to Track You = 예" 와 모순되지 않는다.** 둘은 다른 것을
> 묻는다 — 설문은 **앱 전체(SDK 포함)**, 매니페스트는 **우리 코드**다.
> 한쪽에 맞추려고 다른 쪽을 거짓으로 적지 않는다.

`NSPrivacyCollectedDataTypes` 도 같은 이유로 비웠다. 광고 식별자를 수집하는 것은
SDK 이고 우리 코드가 아니며, `NSPrivacyTracking` 이 false 인데 수집 항목에
`Tracking = true` 를 남기면 그 자체로 모순이다. 남은 것은 **우리가 실제로 쓰는 API
사유 하나**(`UserDefaults` / `CA92.1` — `@capacitor/preferences`)뿐이다.

> ★ **`A9` 가 이 규칙을 지킨다** — 양방향이다 (true+빈 도메인 · false+도메인 있음).
> 되돌리면 **20분 빌드 뒤 업로드에서 죽는 대신 빌드 전에 멈춘다.**

##### ★★★ 그런데 그것으로도 안 됐다 — **주석이 남아 있었다** (빌드 13)

`NSPrivacyTracking = false` 로 고친 빌드 13 이 **똑같은 ITMS-91056** 으로 떨어졌다.
구조는 정본과 완전히 같았고, 레퍼런스 예시들과 다른 점이 하나 남아 있었다 —
**803자짜리 한국어 XML 주석**이다. 걷어내니 **4,366 바이트 → 594 바이트**가 됐다.

> 표준 XML 파서라면 주석은 무해하다. 그러나 **그것이 참이라는 근거가 우리에게 없고**,
> 이 파일에서 주석으로 얻는 것보다 **업로드가 막히는 비용이 압도적으로 크다.**
>
> ★★ **이 저장소의 규약은 "지식은 대상 옆에 둔다" 인데, 대상이 주석을 못 받는
> 파일이면 옆 파일이 그 자리다.** 설명 전문은
> **`FE/ios/App/App/PrivacyInfo.README.md`** 로 옮겼다 (Xcode 타깃에 없으므로
> 번들에 들어가지 않는다).

**지금 파일의 형태 — Xcode 가 만드는 정본 그대로다:**

| | |
|---|---|
| 주석 | **0개** |
| 비ASCII | **0자** |
| 줄끝 | LF · BOM 없음 |
| 최상위 키 | `NSPrivacyAccessedAPITypes` · `NSPrivacyCollectedDataTypes` · `NSPrivacyTracking` · `NSPrivacyTrackingDomains` (알파벳 순) |

> ★ **`A10` 이 주석과 낯선 최상위 키를 막는다.** Apple 이 반려 사유로 쓰는 말이
> *"unexpected keys or values"* 라, 모르는 키도 함께 잡는다.

2024-05-01 이후 업로드되는 iOS 앱은 **Required Reason API** 사용을 Privacy Manifest
에 선언해야 한다 [확인]. 누락하면 업로드는 되지만 **ITMS-91053 (Missing API
declaration)** 경고 메일이 오고 이후 심사에서 막힌다.

**이 프로젝트에 해당하는 것:** `@capacitor/preferences` 가 iOS 에서 **`UserDefaults`**
를 쓴다 → 사유 코드 **`CA92.1`**.

**Google Mobile Ads SDK 자신의 매니페스트는 SDK 안에 포함돼 있다** (v11.2.0+)
[확인 2026-08-07] — **광고 SDK 의 API 사용 사유를 우리가 대신 적을 필요는 없다.**
우리가 적는 것은 **우리 앱의 몫과 추적 선언**뿐이다.

| | ATT 를 **쓰지 않는 지금** | ATT 를 켠다면 |
|---|---|---|
| `NSPrivacyTracking` | **`false`** | `true` |
| `NSPrivacyTrackingDomains` | **빈 배열** | 구글 도메인 목록 (**구글 문서에서 복사**) |
| `NSPrivacyCollectedDataTypes` | ★ **비어 있지 않다** — DeviceID 등을 `Tracking=false` 로 선언 | DeviceID 등을 `Tracking=true` 로 |
| `NSPrivacyAccessedAPITypes` | `UserDefaults` / `CA92.1` | 동일 |
| 전문 | 아래 | **`56` §4.4** |

`FE/ios/App/App/PrivacyInfo.xcprivacy` **(ATT 없는 현재 구성)** [추정 — 매핑은
개발자 책임이다. `56` §4.4 의 추적 버전과 **한 쌍**으로 관리한다]

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSPrivacyTracking</key>
  <false/>
  <key>NSPrivacyTrackingDomains</key>
  <array/>
  <key>NSPrivacyCollectedDataTypes</key>
  <array>
    <dict>
      <key>NSPrivacyCollectedDataType</key>
      <string>NSPrivacyCollectedDataTypeDeviceID</string>
      <key>NSPrivacyCollectedDataTypeLinked</key>
      <false/>
      <key>NSPrivacyCollectedDataTypeTracking</key>
      <false/>
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

> ⚠ **`NSPrivacyTrackingDomains` 를 채우면, ATT 를 거부한 사용자에게 그 도메인
> 요청이 실패한다.** 그것이 정상 동작이고 광고가 안 뜨는 것도 정상이다.
> **광고가 안 뜨는 것을 버그로 오해해 그 배열을 비우지 않는다** — 비우는 것은
> 정책 위반이다. ATT 를 쓰지 않는 지금 배열이 빈 것은 **추적을 하지 않기 때문**이지
> 회피가 아니다.
>
> ⚠ **`npx cap sync ios` 가 이 파일을 덮어쓰지 않는지 확인한다.** Capacitor 는
> `App/App/` 아래 사용자 파일을 보존하지만, **CI 에서 처음 돌 때 Xcode 프로젝트
> 참조가 빠져 있으면 번들에 들어가지 않는다** — 파일은 있는데 경고는 계속 온다.
> **업로드 후 경고 메일이 오는지로 검증**한다 (§6.5 의 TestFlight 단계).

#### 5.3.3 ★★ 넷이 같은 말을 해야 한다

| # | 어디 | 광고 릴리스의 답 |
|---|---|---|
| ① | **개인정보 처리방침** (한/영) | `56` §4.5 의 전문으로 **교체**. "구조적으로 수집이 불가능하다"는 문장이 거짓이 된다 |
| ② | **Apple App Privacy** | §5.3.1 |
| ③ | **`PrivacyInfo.xcprivacy`** | §5.3.2 |
| ④ | Play 데이터 보안 (다른 스토어지만 **같은 사실**) | `56` §4.2 |

**"Used to Track You" 의 답은 ①②③④ 가 전부 같아야 한다.**
★ **ATT 를 켠 지금은 네 곳 모두 "추적함"** 이다 (2026-08-08 · §2.6).
ATT 를 끄기로 되돌리는 날 **네 곳을 같은 커밋에서 되돌린다.**

> ⚠ **①(개인정보 처리방침)이 제일 뒤처지기 쉽다.** ②③ 은 파일과 화면이라
> 눈에 띄는데 방침은 **별도 저장소**(`riftark-privacy`)에 있어 같은 커밋에
> 들어오지 않는다. **제출 전에 그 페이지를 열어 추적을 말하고 있는지 확인한다** —
> 넷 중 하나만 다르면 그것이 5.1.1 반려다.

> ★★★ **같은 사실을 여덟 곳에 적어 두고 하나만 안 고치는 것** — 이 저장소가
> 이름을 붙여 놓은 단일 실패 유형이고, 여기가 그 함정이 가장 크게 벌어진 자리다
> (`56` §4.1). **§9 의 체크리스트가 이것들을 한 묶음으로 다룬다.**

### 5.4 ✅ 스크린샷 — **iPhone 전용으로 확정** (2026-08-10)

`TARGETED_DEVICE_FAMILY = 1` 로 낮췄다 (사용자 결정). → **iPad 스크린샷이 필요 없다.**

| 안 | 방법 | 대가 |
|---|---|---|
| ✅ **A. iPhone 전용** ← **택함** | `TARGETED_DEVICE_FAMILY = 1` | iPad 사용자가 못 받는다. **스크린샷 세트가 하나로 준다** |
| B. iPad 도 지원한다 | `"1,2"` 유지 | iPad 스크린샷 세트를 더 만들고, **iPad 에서 UI 가 깨지지 않는지 확인해야 한다** (실기 없으면 확인 불가) |

> **A 를 택한 이유:** iPad 는 UI 검증을 할 수 없는 상태에서 지원한다고 선언하는 것이
> 위험하다. 게임은 `Phaser.Scale.RESIZE` + `viewport.js` 로 4:3 에서도 성립하도록
> 설계돼 있지만(`02-design/18` §1.1), **성립한다고 검증한 적은 없다.**
> **나중에 iPad 를 켜는 것은 언제든 가능하다** — 빌드 설정 한 줄 + 새 빌드다.
>
> ⚠ `Info.plist` 의 `UISupportedInterfaceOrientations~ipad` 와 `UIRequiresFullScreen`
> 은 **남겨 두었다.** iPhone 전용에서는 무해하고, iPad 를 다시 켜는 날 그대로 필요하다.

**iPhone 스크린샷 (가로 · 최소 1장, 권장 8장)**

| 기기 클래스 | 해상도 (가로) |
|---|---|
| 6.9" (최신 Pro Max) | **2868 × 1320** |
| 6.5" | 2778 × 1284 |

> ⚠ **Apple 은 요구하는 기기 클래스를 자주 바꾼다.** App Store Connect 의 업로드
> 화면이 **현재 요구되는 정확한 픽셀 크기를 표시한다.** 그것을 믿는다.
> 보통 **가장 큰 크기 하나만 올리면 나머지는 자동 축소**되지만, 화면 안내를 확인한다.

**내용 구성은 ⑤ 문서**(`52-store-image-codex-prompts.md`)를 따른다.
**광고 활성화 시 재촬영·교체가 필요한 컷의 대장은
[`57-store-image-recapture-register.md`](57-store-image-recapture-register.md) §3.**

> ⚠ **`asset/generated/store/` 의 기존 `ios-*.png` 24장을 올리지 마라.** 실제 게임
> 화면이 아니라 생성 일러스트다 — **2.3.x 반려 사유 그 자체**다 (§7.2). 폐기·교체는
> ⑤ 문서 §0-A · §3.5. 첫 제출에는 `ios-6.9-1..8` 8장만 새로 만든다.
>
> ★ **카피에서 "No ads / 광고 없음" 을 지운다** (§5.2 · `57` §3).

### 5.5 심사 정보

| 항목 | 내용 |
|---|---|
| 로그인 필요 | **아니오** ← 계정이 없으므로 데모 계정도 필요 없다 |
| 연락처 | 이름 · 전화 · 이메일 |
| **메모(Notes)** | 아래 |

**광고를 켜는 릴리스의 메모 (한국어)**

```
싱글플레이 오프라인 게임입니다.
- 로그인, 계정, 서버 통신이 없습니다.
- 인앱 결제가 없습니다. 앱은 무료입니다.
- 광고는 보상형 동영상 1종뿐이며, 전투 결과 화면에서만 선택적으로 시청합니다.
  광고를 한 번도 보지 않아도 모든 콘텐츠를 끝까지 진행할 수 있습니다.
- 확률형 요소(가챠, 뽑기)가 없습니다. 광고 보상은 고정 수치입니다.
- 게임 진행 데이터는 기기에만 저장되며 서버로 전송되지 않습니다.
- 가로 모드 전용입니다. 기기를 가로로 돌려 주세요.
- 첫 실행 시 타이틀 화면에서 세이브 슬롯을 선택하면 게임이 시작됩니다.
```

**영문판 — 심사자는 한국어를 읽지 않는다. 반드시 함께 넣는다.**

```
Single-player offline game.
- No sign-in, no account, no server communication.
- No in-app purchases. The app is free.
- Advertising is a single optional rewarded video, offered only on the battle
  result screen. The entire campaign can be completed without watching any ad.
- No loot boxes or randomised rewards. The ad reward is a fixed amount.
- Game progress is stored on the device only and is never uploaded.
- LANDSCAPE ONLY. Please rotate the device to landscape.
- On first launch, pick a save slot on the title screen to start the game.
```

> ★ **"가로 전용"과 "슬롯을 골라야 시작된다"를 반드시 적는다.** 심사자가 세로로
> 들고 빈 화면을 보거나, 타이틀에서 뭘 눌러야 할지 몰라 **"2.1 앱 완성도"로 반려**하는
> 사고가 실제로 흔하다.
>
> ★★ **광고 위치를 적는 이유는 심사자가 광고를 못 찾기 때문이다.** 보상형은
> 결과 화면 한 곳뿐이고 **첫 전투를 이겨야 도달한다** — 게다가
> `ads.json:minStage` 가 6 이라 **초반 스테이지에서는 버튼이 아예 안 뜬다**
> (`56` §6.3). 광고가 있다고 선언했는데 심사자가 못 보면 "선언과 다르다"가 된다.
> **몇 스테이지에서 나타나는지까지 적는다.**
>
> ⛔ **심사 제출 빌드에 테스트 광고를 남기지 않는다** (`ads.json:testMode = false`).
> 심사자가 테스트 광고를 보면 정책 위반이고, **그 상태로 승인되면 실제 광고가
> 영원히 안 뜬다** (`56` §7.3).

### 5.6 ✅ 아이콘과 스플래시 — **교체 완료** (2026-08-10)

> **아래는 무엇이 문제였고 어떻게 고쳤는지의 기록이다.** 조치는 끝났고,
> **이제 `npm run icons` 가 iOS 까지 쓰고 `npm run icons:check` 가 iOS 까지 본다.**
>
> ★★★ **크기가 아니라 내용 해시를 대조한다.** Capacitor 기본 아이콘도 1024×1024
> 라서 크기 검사는 그것을 **통과시킨다** — 실제로 4개월 통과시켰다. `resources/`
> 원본과 바이트가 같은지 물어야 "교체했는가"에 답이 된다. 이 검사는 둘을 함께
> 잡는다: ① 한 번도 교체하지 않음 ② `npm run icons` 로 원본만 새로 만들고
> iOS 복사를 잊음.

**[2026-08-07 시점의 문제 기록]**

| 파일 | 현재 내용 | 있어야 할 것 |
|---|---|---|
| `FE/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` | **Capacitor 기본 아이콘** (흰 배경 · 하늘색 X) · 파일 날짜가 프로젝트 스캐폴딩 시점이다 | `FE/resources/icon-1024.png` (보라 균열) |
| `FE/ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732{,-1,-2}.png` | **Capacitor 기본 스플래시** 3장(내용 동일) | `FE/resources/splash-2732.png` |

**조치 — Mac 없이 가능하다. PNG 를 덮어쓰는 것뿐이다.**

```bash
cd FE
npm run icons                                     # resources/ 원본 재생성 (필요할 때만)
cp resources/icon-1024.png  ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png
cp resources/splash-2732.png ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png
cp resources/splash-2732.png ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.png
cp resources/splash-2732.png ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.png
```

| 왜 이대로 되는가 | |
|---|---|
| `AppIcon.appiconset/Contents.json` | 이미 **`universal · ios · 1024x1024` 한 장짜리** 구성이다 [실측] — 요즘 Xcode 형식이라 밀도별 세트를 만들 필요가 없다. **파일 이름을 바꾸지 않는다** (`Contents.json` 이 그 이름을 가리킨다) |
| 알파 채널 | `tools/gen-app-icons.mjs` 가 `flatten()` 으로 알파를 지워 저장한다 [실측] — **1024 아이콘에 알파가 있으면 업로드 단계에서 반려된다** |
| 스플래시 3장 | `Contents.json` 이 1x/2x/3x 세 칸을 요구하고 기본값도 **세 장이 동일 파일**이다 [실측]. 같은 그림을 세 번 넣으면 된다 |

> ★★★ **왜 4개월 동안 아무도 몰랐나 — 검사기가 안드로이드만 봤다.**
> `npm run icons:check`(= `verify` 의 한 단계)는 `android/app/src/main/res/mipmap-*`
> 만 검사했고, `tools/gen-app-icons.mjs` 는 **iOS 자산 카탈로그에 아무것도 쓰지
> 않았다**. 그래서 **아이콘이 Capacitor 기본값인 채로 `verify` 가 전항 통과했다.**
> 안드로이드 아이콘은 2026-08-07 에 고쳐졌고 iOS 는 **같은 날 잊혔다.**
> 이 저장소의 이름 붙은 실패 유형 그대로다 — *만들었는데 아무도 못 쓰는 것.*
>
> ✅ **2026-08-10 에 진짜 해결을 했다.** `gen-app-icons.mjs` 에 `IOS_COPIES` 가
> 생겨 생성 경로가 iOS 4장을 쓰고, `--check` 가 그 4장을 `resources/` 원본과
> **해시로** 대조한다. 검사기는 **실제로 깨뜨려 확인했다** — 기본 아이콘을
> 되돌리면 종료 코드 1 로 멈춘다.

---

## 6. Codemagic — Mac 없이 빌드하고 올린다

**이 절은 유료/무료와 무관하다.** 광고 때문에 달라지는 것은 §6.4 아래의 주의 두 개뿐이다.

### 6.1 앱 연결

1. Codemagic → **Add application** → 같은 저장소 (②에서 이미 연결했다면 워크플로만 추가)
2. 프로젝트 유형 **Other / Native**
3. `codemagic.yaml` 사용

> **macOS 인스턴스는 Linux 보다 비싸다.** 무료 한도를 iOS 빌드가 빠르게 먹으므로
> **태그 푸시에서만 돌게 한다** (§6.4 의 `triggering`).

### 6.2 App Store Connect 통합 등록

Codemagic → **Teams / 앱 설정 → Integrations → App Store Connect → Connect**

| 필드 | 값 (§3 에서 받은 것) |
|---|---|
| Integration name | `riftark_appstore` |
| Issuer ID | UUID |
| Key ID | 키 ID |
| Private key | `AuthKey_XXXX.p8` 파일 업로드 |

**이것 하나로 서명 · TestFlight 업로드가 전부 해결된다.**

### 6.3 자동 서명

Codemagic 은 이 API 키로 **배포 인증서와 프로비저닝 프로파일을 자동 생성·갱신**한다.
`codemagic.yaml` 의 `ios_signing:` 블록이 그것을 지시한다 (§6.4).

### 6.4 `codemagic.yaml` — iOS 워크플로

②의 `android-release` 와 **같은 파일**에 워크플로를 하나 더 둔다.

```yaml
workflows:

  # ── Android 는 50-google-play-paid-codemagic.md §9.4 참고 ──

  ios-release:
    name: RIFT ARK — iOS Release
    instance_type: mac_mini_m2
    max_build_duration: 90

    integrations:
      app_store_connect: riftark_appstore     # §6.2 의 integration name

    environment:
      ios_signing:
        distribution_type: app_store
        bundle_identifier: com.superdimension.app
      node: 22
      xcode: latest
      cocoapods: default
      vars:
        BUNDLE_ID: "com.superdimension.app"
        XCODE_WORKSPACE: "FE/ios/App/App.xcworkspace"
        XCODE_SCHEME: "App"

    triggering:
      events:
        - tag
      tag_patterns:
        - pattern: 'ios-v*'                    # iOS 는 별도 태그로 분리한다
          include: true

    scripts:
      - name: 의존성 설치
        script: |
          cd FE
          npm ci

      - name: 에셋 파이프라인
        script: |
          cd FE
          npm run assets:all

      - name: 검증 게이트
        script: |
          cd FE
          npm run lint
          npm run test
          npm run data:validate
          npm run check

      - name: 웹 빌드 + Capacitor 동기화
        script: |
          cd FE
          npm run build
          npx cap sync ios

      - name: CocoaPods
        script: |
          cd FE/ios/App
          pod install

      - name: 빌드 번호 설정
        script: |
          cd FE/ios/App
          # TestFlight 는 같은 빌드 번호를 거부한다. 최신 것보다 1 크게.
          BUILD=$(app-store-connect get-latest-app-store-build-number "$APP_APPLE_ID" 2>/dev/null || echo 0)
          agvtool new-version -all $(($BUILD + 1))

      - name: 서명 설정 적용
        script: |
          xcode-project use-profiles

      - name: IPA 빌드
        script: |
          xcode-project build-ipa \
            --workspace "$CM_BUILD_DIR/FE/ios/App/App.xcworkspace" \
            --scheme "$XCODE_SCHEME"

    artifacts:
      - build/ios/ipa/*.ipa
      - /tmp/xcodebuild_logs/*.log
      - build/ios/xcarchive/*.dSYM

    publishing:
      email:
        recipients:
          - 741u741@gmail.com
        notify:
          success: true
          failure: true

      app_store_connect:
        auth: integration
        submit_to_testflight: true
        # 처음에는 여기까지만. TestFlight 로 확인한 뒤에 아래를 켠다.
        # submit_to_app_store: false
```

> **`APP_APPLE_ID`** 는 App Store Connect 의 앱 고유 숫자 ID 다
> (앱 정보 화면 또는 URL 의 `/app/` 뒤 숫자). Codemagic 환경변수로 넣는다.
>
> **`submit_to_app_store` 는 처음엔 켜지 않는다.** TestFlight 에 올라가는 것을
> 먼저 확인하고, 실기로 한 번 돌려 본 뒤에 심사 제출을 자동화한다.

```bash
git tag ios-v1.0.0 && git push origin ios-v1.0.0
```

**★ 광고를 붙인 뒤 이 워크플로에서 새로 생기는 것 두 가지**

| | 무엇 |
|---|---|
| ① **`pod install` 이 Google Mobile Ads 를 받는다** | 빌드 시간이 늘고, **CocoaPods 저장소 상태에 따라 실패할 수 있다.** 어제 되던 빌드가 오늘 깨지면 여기를 먼저 의심한다 (안드로이드 쪽 `play-services-ads:24.7.+` 플로팅 버전과 같은 계열 문제 — `56` §2.2) |
| ② **`PrivacyInfo.xcprivacy` 가 번들에 들어갔는가** | 파일을 만들어도 **Xcode 프로젝트 참조가 없으면 IPA 에 안 들어간다.** CI 는 아무 경고도 내지 않는다. **검증 수단은 업로드 후 ITMS-91053 메일이 오는지뿐**이다 (§5.3.2) |

### 6.5 TestFlight

업로드 후 몇 분~한 시간 내에 App Store Connect → **TestFlight** 에 빌드가 나타난다.

| 단계 | 내용 |
|---|---|
| **내부 테스팅** | 팀 구성원(본인). 심사 없이 즉시 설치 가능 |
| 외부 테스팅 | 최대 10,000명. **간단한 베타 앱 심사**를 거친다 |
| 만료 | 각 빌드는 90일 후 만료 |

> **iPhone 이 있다면 반드시 여기서 실기 확인한다.** 가로 고정 · 노치 인셋 ·
> 홈 인디케이터가 버튼을 가리지 않는지 · 세이브가 유지되는지.
> **이것이 iOS 에서 할 수 있는 유일한 실기 검증이다.**
>
> ★★ **광고 릴리스에서는 여기서 확인할 것이 늘어난다** (`56` §7.5):
> 광고를 **중간에 닫았을 때 버튼이 굳지 않는가** · 광고 후 시스템 바가 돌아오지
> 않는가 · BGM 이 겹치거나 안 돌아오지 않는가 · 비행기 모드에서 게임이 100%
> 돌아가고 버튼만 비활성인가 · 자정을 넘겨 상한이 초기화되는가.
> **전부 실기에서만 드러난다.**
>
> ⛔ **TestFlight 빌드에서 실제 광고를 클릭하지 않는다.** 무효 트래픽이고
> **AdMob 계정 정지 사유**다 (`56` §1.3 · §7.3). 확인은 **테스트 광고 단위 ID**
> 또는 **테스트 기기 등록**으로 한다.

---

## 7. 심사 제출

### 7.1 제출 전 확인

**★ 코드 쪽은 이제 기계가 답한다.** `npm run check:prod` 와 `npm run icons:check`
두 명령이 아래 표의 항목을 전부 검사한다 — **손으로 확인하던 다섯 줄이 사라졌다.**

| 검사 | 무엇을 대신 봐 주는가 | 상태 [2026-08-10] |
|---|---|---|
| A5 | `GADApplicationIdentifier` 가 실제 앱 ID 인가 | ✅ |
| A6 | `ITSAppUsesNonExemptEncryption` 이 있는가 | ✅ |
| A7 | ATT 문구와 호출이 짝인가 | ✅ |
| A8 | `PrivacyInfo.xcprivacy` 가 Xcode 타깃에 있는가 | ✅ |
| A3 | `ads.json:testMode = false` 인가 | ✅ |
| `icons:check` | 아이콘·스플래시가 Capacitor 기본값이 아닌가 | ✅ |

**기계가 볼 수 없는 것 — App Store Connect 화면과 별도 저장소에 있다:**

- [ ] TestFlight 빌드가 실기에서 정상 (**아이콘이 하늘색 X 가 아닌지 눈으로**)
- [ ] 스크린샷 8장 (2868×1320) · 설명 · 키워드 · 지원 URL · 개인정보 URL
- [ ] ★ 스토어 문구·이미지 어디에도 **"광고 없음"이 남아 있지 않다** (§5.2 · `57` §3)
- [ ] ★ 앱 개인정보 = **수집함** · **Used to Track You = 예** (§5.3.1)
- [ ] ★ **개인정보 처리방침이 추적을 말하는가** — 별도 저장소라 같은 커밋에 안 온다 (§5.3.3)
- [ ] ★ 연령 등급 설문 — **광고 노출 = 있음** (§4.2)
- [ ] ★ **가격: 무료(Tier 0)** — 유료 앱 계약은 필요 없다 (§2.4 · §8.1)
- [ ] 판매 국가 선택 (**EU 를 켜면 DSA 거래자 지위** — 53 §5.4)
- [ ] 심사 메모에 **가로 전용 · 슬롯 선택 · 광고 위치** 명시 (§5.5) — **한/영 둘 다**
- [ ] 등록명 `RIFT ARK` 가 `CFBundleDisplayName` 과 **대소문자까지 같은가** (§5.1)
- [ ] ★★ **저작권 = `2026 JuHeon Park`** (버전 페이지 → 일반 앱 정보 · §5.2.1)
- [ ] ★★ 개인정보 처리방침 URL 을 **앱 개인정보 페이지에** 넣었는가 (§5.2.1)
- [ ] 지원 URL (§5.2)

### 7.2 자주 반려되는 항목 — 이 게임에 해당하는 것

| 가이드라인 | 내용 | 이 게임의 대비 |
|---|---|---|
| **2.1 App Completeness** | 심사자가 진행하지 못함 · 크래시 | 심사 메모에 조작법. TestFlight 로 미리 확인. ★ **`GADApplicationIdentifier` 가 없거나 잘못되면 앱이 부팅 즉시 죽는다** — 그러면 100% 2.1 이다 (`56` §2.5) |
| **2.3.1 정확한 메타데이터** | 스토어 문구가 실제와 다름 | ★ **"광고 없음"이 남아 있으면 여기서 걸린다.** 그리고 스크린샷은 **실제 게임 화면 캡처**여야 한다 |
| **2.5.18 광고** | 광고가 앱 등급에 부적절 · 신고 수단 없음 | AdMob 콘텐츠 등급 **G/PG** + 초기화 옵션 `General` (§4.3) |
| **3.1.1 인앱 구매** | 외부 결제 유도 | **해당 없음** — 결제 자체가 없다. ★ **보상형 광고는 IAP 가 아니다** — 지침이 *"apps may otherwise incentivize users to take specific actions within apps (e.g. … watching an ad)"* 로 명시한다 [확인] |
| **3.2.2(iii) 부당한 사업 관행** | 노출·클릭을 인위적으로 늘림 · **광고 표시가 주목적인 앱** | 보상형 1종 · 결과 화면 1곳 · **하루 상한**. 자동 재생 없음 |
| **5.1.2(i) 데이터 사용** | ★ **추적 허용을 조건으로 보상 지급** | ⛔ 절대 하지 않는다 (§2.6). ATT 를 쓰지 않는 지금은 애초에 해당이 없다 |
| **5.1.1 개인정보** | 방침 URL 누락 · **방침과 실제 수집이 불일치** | ★ 넷을 함께 고친다 (§5.3.3) |
| **1.3 키즈 카테고리** | 아동 대상 앱의 광고 제한 | ⛔ **Kids 카테고리를 고르지 않는다.** 고르면 서드파티 광고가 사실상 금지되고 **수익 모델 자체가 성립하지 않는다** (`56` §3.5) |
| **1.3 연령 등급** | 설문과 실제 콘텐츠 불일치 | 판타지 폭력 · **광고 노출** 정직하게 표기 |
| **4.2 최소 기능** | 너무 단순한 앱 | 해당 없음 (100 스테이지) |

> ★ **2.3.x 가 이 프로젝트에서 가장 현실적인 위험이었고, 지금은 그 옆에 2.5.18 과
> 5.1.1 이 섰다.** ⑤ 문서의 프롬프트는 **UI 오버레이·배경용 이미지**를 만들기 위한
> 것이고, **스크린샷의 본체는 반드시 실제 게임 화면 캡처여야 한다.**

### 7.3 심사 기간

보통 **하루~며칠**. 첫 제출은 더 걸릴 수 있다. 반려되면 사유가 명확히 오고,
**Resolution Center 에서 답변하면 재심사는 대체로 빠르다.**

---

## 8. 가격 · 수익 · 세금 — 무료 앱에서 무엇이 남는가

> **(이 절은 한국 기준이다.)** 53 §1 · §2 는 **앱 판매 소득** 전제로 쓰여 있어
> 무료+광고에는 대부분 해당이 없다. **여기가 정본이다.**
>
> ★ 수익화 판정의 경위와 감수한 대가: [`55-monetization-decision.md`](55-monetization-decision.md)
> · 광고 붙이는 법 · 동의 · 경제 재보정: [`56-admob-rewarded-integration.md`](56-admob-rewarded-integration.md)

### 8.1 ★★ 가격 = 무료. 그리고 Apple 은 되돌릴 수 있다

App Store Connect → **가격 및 사용 가능 여부** → **무료(Tier 0)**

| 방향 | Apple | Google Play |
|---|---|---|
| 유료 → 무료 | 가능 | 가능 |
| **무료 → 유료** | ★ **가능** [확인 2026-08-07] — 가격 화면에서 티어를 고르면 되고, 그때 **Paid Applications Agreement 를 맺으면 된다** | ⛔ **불가능** (`50` §8.1) |

> ★★★ **이 비대칭이 `56` §0.2 의 "되돌릴 수 없는 것은 정확히 하나"를 정밀하게 만든다.**
> 그 문장은 **Play 기준**이다. **App Store 만 보면 무료 결정은 되돌릴 수 있다.**
>
> 그렇다고 가볍게 볼 것은 아니다:
> ① 가격을 바꾸면 **차트·랭킹 위치가 초기화된다는 보고**가 있다 [추정 — 포럼].
> ② **두 스토어의 가격이 갈리면 리뷰에 그 얘기가 올라온다** — Play 는 영구히 무료인데
>    App Store 만 유료로 올리는 것은 실질적으로 어렵다.
> ③ 이미 무료로 받은 사용자에게 소급 과금은 없다.
>
> **결론: 절차상 열려 있지만 사업상으로는 Play 에 묶여 있다.** "iOS 는 언제든
> 유료로 바꿀 수 있으니까"를 근거로 무료 결정을 가볍게 내리지 않는다.

### 8.2 수수료 — Small Business Program 은 **해당 없음**

| | |
|---|---|
| Apple 에 내는 수수료 | ★ **0 원.** 앱이 무료고 인앱 결제가 없으므로 **Apple 을 거치는 돈 자체가 없다** |
| **Small Business Program** | ⛔ **해당 없음.** 이 프로그램은 **앱 판매·인앱 결제 수수료를 30% → 15% 로 낮추는 것**이다. 낮출 수수료가 없으면 신청할 이유도 없다 |
| 광고 수익 | **Apple 을 거치지 않는다.** Google 이 AdMob 수익에서 자기 몫을 가져가고 나머지를 개발자에게 지급한다 |
| Apple 에 실제로 내는 돈 | **연회비 $99 뿐** (§2.1) |

> ⚠ **53 §2.5 와 `55` §1.1 의 "Apple SBP 15%" 는 유료 앱 전제의 문장이다.**
> 유료로 되돌아가는 날 다시 유효해진다 — **그날까지는 신청하지 않는다.**
> (예전 판의 §8.2 는 *"무료로 15%p 를 아끼는 버튼"* 이라고 썼는데, **누를 버튼이 없다.**)

### 8.3 세금 ★ 전문가 확인 필요

> **아래는 답이 아니라 확인 목록이다.** 그리고 **상대가 Apple 에서 Google 로 바뀌었다.**

| 항목 | 유료 앱이었다면 | 무료 + 광고 |
|---|---|---|
| 미국 원천징수 서류 | **Apple** 에 W-8BEN | ★ **Google(AdMob/AdSense)** 에 같은 성격의 세금 정보. 미제출 시 높은 세율 |
| 한 · 미 조세조약 | 앱 판매 소득 | ★ **광고 소득**은 소득 구분이 다를 수 있다 — **세무 전문가에게 물을 때 "광고 수익"이라고 말한다** |
| 한국 소득 신고 | 해외 결제 대행 소득 | **해외 광고 플랫폼 소득.** 규모에 따라 사업자등록 필요 여부가 갈린다 |
| 부가가치세 | Apple 이 판매자 지위인 지역 | ★ **해당 구조가 없다** — 우리는 광고 지면을 제공하고 대가를 받는다 |
| 외화 입금 | Apple 송금 | **Google 송금.** 은행에 따라 해외송금 수취 신고가 필요할 수 있다 |
| 지급 임계 | 없음 | ★ **$100** — 넘지 못하면 이월된다 (§2.4) |

> ★ **인디 1인 개발에서 광고 수익이 세무 신고 임계에 닿는 데는 시간이 걸린다.**
> 그렇다고 **세금 정보 제출을 미루지 않는다** — 미제출은 세율 문제가 아니라
> **지급 보류**로 나타나고, 그것은 조용하다.

---

## 9. 체크리스트

### 출시 전 1회 — Apple 쪽

- [ ] git 저장소 + Codemagic 연결 (② §1.1, §9.1)
- [ ] Apple Developer Program 개인 가입 ($99/년) (§2.1)
- [ ] **개인 vs 법인 결정** (§2.2) — EU 를 켤 거면 DSA 거래자 공개도 함께 판단 (53 §5.4)
- [ ] Bundle ID 등록 · **Capability 전부 끔** (§2.3)
- [ ] ⛔ **유료 앱 계약을 맺지 않는다** (§2.4)
- [x] `Info.plist` — `ITSAppUsesNonExemptEncryption = false` (§2.5) ✅ 2026-08-10 · **A6**
- [x] **ATT 결정** (§2.6) — ★ **"요청한다"** (2026-08-08). §5.3 의 넷이 전부 "추적함"
- [ ] App Store Connect API 키 발급 · `.p8` 안전 보관 (§3)
- [x] **iPad 지원 여부 결정** (§5.4) — ✅ **iPhone 전용** (2026-08-10)
- [ ] 앱 생성 · 앱 정보 · 설명 · **키워드에서 "광고없음" 제외** (§5.1–5.2)
- [ ] 스크린샷 (§5.4 · ⑤ 문서 · `57`) — `asset/generated/store/ios/` 8장 준비됨
- [x] ★ **아이콘 · 스플래시 교체** (§5.6) ✅ 2026-08-10 · **`icons:check` 가 이제 잡는다**
- [ ] 연령 등급 설문 (§4)
- [ ] 심사 메모 한/영 (§5.5)
- [ ] Codemagic App Store Connect 통합 등록 (§6.2)
- [ ] `codemagic.yaml` ios 워크플로 커밋 → `ios-v1.0.0` 태그
- [ ] **TestFlight 빌드 확인 (가능하면 실기)** (§6.5)
- [ ] **가격 = 무료** · 판매 국가
- [ ] 심사 제출

### 광고를 켜는 릴리스에서만 — ★ 넷을 한 커밋에서 (§5.3.3)

- [x] AdMob iOS 앱 등록 · 보상형 광고 단위 생성 ✅ 2026-08-08 — **지급/세금 설정은 아직** (§2.4)
- [x] `Info.plist` — `GADApplicationIdentifier` 를 **실제 앱 ID** 로 ✅ · **A5** — ⚠ `SKAdNetworkItems` 는 **아직 없다** (`56` §2.5)
- [x] `PrivacyInfo.xcprivacy` 작성 ✅ 08-08 + **Xcode 타깃 포함** ✅ 08-10 · **A8**
- [ ] App Privacy = **수집함** · **Used to Track You = 예** (§5.3.1)
- [ ] 개인정보 처리방침 한/영 교체 (`56` §4.5)
- [ ] 연령 등급 설문 — **광고 노출 = 있음** (§4.2)
- [ ] 스토어 문구·스크린샷에서 **"광고 없음" 전량 제거** (§5.2 · `57` §3)
- [ ] AdMob 광고 콘텐츠 등급 **G/PG** (§4.3)
- [ ] `ads.json:testMode = false` · `enabled = true` (`56` §8 6단계)
- [ ] `56` §6.6 의 경제 게이트 4항 통과 — **광고 0회로 100 스테이지 완주 포함**

### 업데이트마다

- [ ] `MARKETING_VERSION` 올림 (빌드 번호는 CI 자동)
- [ ] `npm run verify` 로컬 통과
- [ ] **이전 버전 세이브로 실행** (`SAVE_VERSION` 마이그레이션)
- [ ] TestFlight 확인 후 심사 제출
- [ ] "이 버전의 새로운 기능" 작성

---

## 10. 자주 막히는 곳

| 증상 | 원인 · 해결 |
|---|---|
| `pod install` 실패 | `npx cap sync ios` 를 **먼저** 돌려야 한다. yaml 순서 확인 (§6.4) |
| 서명 실패 | Bundle ID 가 §2.3 에서 등록되지 않았거나, API 키 권한이 App Manager 미만 |
| TestFlight 가 빌드를 거부 | **빌드 번호 중복.** `agvtool` 단계 확인 (§6.4) |
| ★★★ **"Failed to publish App.ipa to App Store Connect"** | **빌드 번호 중복이고, 원인은 `get-latest-app-store-build-number` 의 폴백이다** (2026-08-10, v1.0.4). 그 폴백은 **0 → 빌드 번호 1** 을 만드는데 1 은 2026-08-09 빌드가 소진했다. 게다가 `2>/dev/null` 이 진짜 실패 이유를 지워서 **20분 빌드가 맨 마지막 업로드에서 알아볼 수 없는 문구 하나로 죽는다.** → 폴백을 **단조 증가하는 `$BUILD_NUMBER`** 로 바꾸고 stderr 를 살렸다. **폴백은 자기 역할이 끝났다는 것을 모른다** — 첫 빌드에만 옳은 값을 영구 기본값으로 두지 않는다 |
| "Missing Compliance" | `ITSAppUsesNonExemptEncryption` 누락 (§2.5) |
| **앱이 실행 즉시 죽는다** | ★ **`GADApplicationIdentifier` 누락 또는 `~`/`/` 혼동.** 앱 ID 는 물결(`~`), 광고 단위 ID 는 슬래시(`/`) 다 (`56` §1.2 · §2.5) |
| **광고가 영원히 안 뜬다** | 앱 ID 를 `ads.json:units` 에 넣었다 · 동의 폼 미게시로 `canRequestAds` 가 false (`56` §3.1) · `enabled=false` |
| **광고 버튼이 "로딩 중"으로 굳는다** | ★ 중도 이탈 시 `showRewardVideoAd()` 가 resolve 되지 않는다. `native/ads.js` 의 이벤트 경주가 그것을 막는다 (`56` §5.3 ①) |
| **ITMS-91053 (Missing API declaration) 메일** | ★ **Privacy Manifest 누락 또는 번들 미포함** (§5.3.2 · §6.4 ②). **2026-08-10 이전 빌드가 전부 이 상태였다** — 메일함을 확인할 것. 지금은 `A8` 이 막는다 |
| ★★★ **ITMS-91056 (Invalid privacy manifest) · "잘못된 바이너리"** | **두 번 당했다** (§5.3.2). ① 빌드 12 — `NSPrivacyTracking` 이 true 인데 도메인이 비었다. ⛔ **도메인을 채워서 통과시키지 마라**: 그 도메인은 ATT 거부 사용자에게 실제로 차단되어 비개인화 광고까지 막는다 → 정답은 `false`. ② 빌드 13 — 고쳤는데도 같은 에러. 원인은 **파일 안의 XML 주석**이었다 → 주석을 0개로. 지금은 `A9`·`A10` 이 막는다 |
| **빌드 상태가 "잘못된 바이너리"** | 업로드는 됐고 **자동 검증에서 떨어졌다.** 사유는 상태값이 아니라 **메일**(`ITMS-9xxxx`)·TestFlight 빌드 상세·ASC 알림에 있다 |
| **무료 앱인데 계약을 요구한다** | Paid Applications Agreement 를 실수로 Request 했다 → "Pending User Info" (§2.4) |
| **"심사에 추가할 수 없음"** | ★★ 필수 필드가 비었다. 2026-08-10 에 실제로 막은 둘: **저작권** · **앱 개인정보 페이지의 방침 URL** → §5.2.1 |
| 스크린샷 규격 거부 | 요구 픽셀 크기가 바뀌었다. 업로드 화면의 안내를 그대로 따른다. ★ **6.5인치 슬롯은 6.9인치(2868×1320) 를 받지 않는다** — `2778×1284` 세트가 `store/ios/ios-65-*.png` 에 함께 있다 (2026-08-10) |
| 1024 아이콘 업로드 거부 | **알파 채널이 있다.** `resources/icon-1024.png` 는 이미 flatten 돼 있다 (§5.6) |
| **홈 화면 아이콘이 하늘색 X 다** | ★ iOS 자산 카탈로그가 Capacitor 기본값이다 (§5.6). ✅ **2026-08-10 부터 `icons:check` 가 iOS 도 해시로 본다** |
| **홈 화면 이름이 스토어 등록명과 다르다** | ★ `CFBundleDisplayName` 은 **로케일별**이다. `ko.lproj/InfoPlist.strings` 에 이름을 넣었는데 등록명에 한국어 현지화가 없으면 **한국어 기기에서만** 어긋난다 (§5.1) |
| iPad 스크린샷을 요구함 | `TARGETED_DEVICE_FAMILY` 가 `"1,2"` 다. ✅ 지금은 `1` — §5.4 |
| **2.1 반려 (심사자가 진행 못함)** | 가로 전용 · 슬롯 선택을 심사 메모에 안 적었다 (§5.5) — 또는 광고 SDK 때문에 부팅 크래시 |
| **2.3 반려 (메타데이터)** | 스크린샷이 실제 게임 화면이 아니다 · **"광고 없음"이 남아 있다** (§5.2 · §7.2) |
| **5.1.1 반려 (개인정보)** | 방침 · App Privacy · Privacy Manifest 가 서로 다른 말을 한다 (§5.3.3) |
| **EU 에서만 앱이 내려갔다** | **DSA 거래자 지위 미설정** → 53 §5.4 |
| 연령 등급 설문이 문서와 다르게 생겼다 | 2025년에 체계가 개편됐다 (13+ · 16+ · 18+) → 53 §4.3 |
| 심사자가 진행을 못 했는데 메모는 썼다 | **메모가 한국어였다** → §5.5 의 영문판 |
| macOS 빌드 크레딧 소진 | `triggering` 을 태그로 제한 (§6.4). Android 는 Linux 로 분리 |
| 아카이브에 `dSYM` 없음 | 크래시 심볼용. artifacts 에 포함돼 있다 (§6.4) |
| **AdMob 수익이 안 들어온다** | 세금 정보 미제출 · **$100 임계 미달로 이월** (§2.4 ⑤) |

---

## 11. 출처 (2026-08-07 확인)

- [App Review Guidelines — Apple](https://developer.apple.com/app-store/review/guidelines/) — **2.5.18**(광고) · **3.1.1**(보상형은 IAP 가 아니다) · **3.2.2(iii)** · **5.1.2(i)**(ATT · 추적을 조건으로 한 보상 금지) · **1.3**(Kids)
- [Sign and update agreements — App Store Connect Help](https://developer.apple.com/help/app-store-connect/manage-agreements/sign-and-update-agreements) — 무료 앱은 개발자 프로그램 라이선스 계약으로 배포된다
- [Set a price — App Store Connect Help](https://developer.apple.com/help/app-store-connect/manage-app-pricing/set-a-price/) — 가격 변경(무료 ↔ 유료)
- [Updated age ratings in App Store Connect — Apple Developer News](https://developer.apple.com/news/?id=ks775ehf) · [Age rating questionnaire now includes social media questions](https://developer.apple.com/news/?id=tlur8uvi) — 13+ · 16+ · 18+ 개편과 신규 문항(광고 노출 포함)
- [Privacy strategies for iOS — AdMob Help](https://support.google.com/admob/answer/9997589) — ATT 는 선택이며, 미요청 시 제한(비개인화) 광고
- [App Store data disclosure (AdMob)](https://developers.google.com/admob/ios/privacy/data-disclosure) — Google Mobile Ads SDK 가 iOS 에서 수집하는 항목
- [Steps to getting paid — AdMob Help](https://support.google.com/admob/checklist/2998383) · [Payment thresholds](https://support.google.com/admob/answer/2772208) — 지급 프로필 · 세금 정보 · **$100 임계**

### 이 문서가 답하지 못한 것

| 미결 | 왜 |
|---|---|
| **ATT 를 켤 것인가** | 수익(개인 맞춤 광고)과 UX(프롬프트 하나) · 제출물 복잡도의 교환이다. **사용자 결정.** 지금 코드는 "안 켬" (§2.6) |
| 광고 문항이 등급을 9+ 위로 올리는가 | 설문 결과 화면에서 확인 (§4.2) [추정] |
| **부적절한 광고 신고 수단**을 우리가 따로 만들어야 하는가 | 2.5.18 이 요구하지만 AdMob 광고의 기본 신고 경로로 충분한지가 불명확하다 (§4.3) [추정 · 화면이 권위] |
| `NSPrivacyCollectedDataTypes` 매핑의 정확성 | 구글은 자기가 수집하는 것만 말하고 **Apple 카테고리 매핑은 개발자 책임**이라고 명시한다 (§5.3.1) |
| 무료+광고 앱도 EU DSA 거래자인가 | 광고 수익은 상업 활동이므로 그럴 것 [추정] — 콘솔 문항에서 확인 (53 §5.4) |
| `icons:check` 의 iOS 미검사 | §5.6 — **검사기를 고치는 것이 진짜 해결**이고 지금은 손 확인뿐이다 |

---

## 관련 문서

| 무엇 | 어디 |
|---|---|
| **왜 무료 + 광고인가 (계산과 뒤집힘)** | [`55-monetization-decision.md`](55-monetization-decision.md) |
| **★ 광고 붙이는 법 · 동의 · 경제 재보정 · 제출물 8종** | **[`56-admob-rewarded-integration.md`](56-admob-rewarded-integration.md)** |
| Google Play 등록 (한국 기준) | [`50-google-play-paid-codemagic.md`](50-google-play-paid-codemagic.md) |
| 스토어 이미지 생성 프롬프트 | [`52-store-image-codex-prompts.md`](52-store-image-codex-prompts.md) |
| **영어권 확대 (연령등급 정본 · DSA · 가격 · 세금 · ASO)** | [`53-english-market-paid-release.md`](53-english-market-paid-release.md) |
| 스토어 이미지·카피 (영어권) | [`54-english-store-art-codex-prompts.md`](54-english-store-art-codex-prompts.md) |
| **광고 활성화 시 재촬영할 스크린샷·교체 카피** | [`57-store-image-recapture-register.md`](57-store-image-recapture-register.md) §3 |
| 남은 작업 전체 로드맵 | [`../04-plan/35-remaining-work-roadmap.md`](../04-plan/35-remaining-work-roadmap.md) |
| iOS 네이티브 설정 | [`../03-tech/25-capacitor-mobile.md`](../03-tech/25-capacitor-mobile.md) §3 |
