# 51. App Store — 개인 계정으로 유료 앱 등록하기 (Codemagic)

> 대상: **RIFT ARK / 균열의 방주** · `com.superdimension.app` · Capacitor 7 iOS
> 작성일 **2026-08-06** · 작업 환경 **Windows 11 (Mac 없음)** · 개발자 1인
>
> ★ **이 문서의 존재 이유 한 줄: 사용자에게 Mac 이 없다.**
> iOS 앱은 macOS 에서만 빌드·서명·업로드할 수 있다. Codemagic 의 macOS 인스턴스가
> 그 Mac 을 대신한다. **Mac 을 사지 않아도 App Store 에 낼 수 있다.**

---

> ### ★ 이 문서는 **한국 출시 기준**이다 (2026-08-07 추가)
>
> 영어권(미국 · 영국 · 캐나다 · 호주 · EU)으로 확대할 때 달라지는 것은
> **[`53-english-market-paid-release.md`](53-english-market-paid-release.md)** 에 있다.
>
> | 여기(51)에 있는 것 | 영어권에서 달라지는 것 (53) |
> |---|---|
> | 연령 등급 설문 (§4) | ⛔ **구 체계(12+ · 17+) 기준이다.** Apple 은 2025-07 에 **13+ · 16+ · 18+** 로 개편했고 소셜 문항이 추가됐다 — **53 §4.3 이 최신** |
> | 앱 이름 · 부제 · 키워드 (§5.2) | 로마자 표기 결정 · 상표 검색 · 영문 키워드 100자 — **53 §6.4–6.5** |
> | 설명 (§5.2 → 50 §4.3) | 영문 초안. **App Store 는 설명이 검색 색인 대상이 아니다** — **53 §6.3 · §6.6** |
> | 앱 개인정보 라벨 (§5.3) | ★ **Privacy Manifest (`PrivacyInfo.xcprivacy`)가 더 필요하다** — **53 §5.3** |
> | 심사 메모 (§5.5) | **영문으로 쓴다** — 심사자가 한국어를 읽지 않는다 |
> | 가격 · 수수료 · 세금 (§8) | 기준 지역 결정 · 세금 포함/별도 · **Small Business Program 은 신청해야 적용된다** — **53 §1 · §2** |
> | 판매 국가 (§7.1 체크리스트) | 어디를 켜고 어디를 끄는가 · **EU DSA 거래자 지위** — **53 §3 · §5.4** |
> | — | 환불 정책의 스토어 간 차이 — **53 §7** |
>
> ★ **App Store 에는 Play 의 "클로즈드 테스트 14일" 같은 관문이 없다.** 국가 추가는
> 체크박스다. 다만 **영어권용 앱을 새로 만들지 않는다** — 리뷰·평점이 0에서 시작한다
> (53 §8.1).

---

## ⚠ 먼저 읽을 것

**Apple 의 정책·화면·요구 스크린샷 규격은 이 문서보다 빨리 바뀐다.**
아래는 반드시 화면에서 직접 확인한다. 화면이 이 문서와 다르면 **화면이 맞다.**

| 확인할 것 | 어디서 |
|---|---|
| 필수 스크린샷 규격(현재 요구되는 기기 크기) | App Store Connect → 앱 → 미리보기 및 스크린샷 |
| 최소 Xcode / SDK 요구 버전 | 업로드 시 거부 메시지 |
| 심사 가이드라인 | https://developer.apple.com/app-store/review/guidelines/ |
| 유료 앱 계약에 필요한 서류 | App Store Connect → 계약/세금/금융거래 |

**나는 세무사도 변호사도 아니다.** §8 은 "무엇을 알아봐야 하는지"의 목록이다.

---

## 0. 전체 그림

```
 [계정]  Apple Developer Program 개인 가입 ($99/년) ──→ 승인
            │
            ├─→ Bundle ID 등록 (com.superdimension.app)
            ├─→ App Store Connect API 키(.p8) 발급  ← Codemagic 이 이걸로 서명·업로드
            └─→ ★ 유료 앱 계약 (Paid Apps Agreement) + 은행/세금 정보
            │
 [앱]    App Store Connect 앱 생성 ──→ 앱 정보 · 개인정보 라벨 · 연령 등급 · 스크린샷
            │
 [CI]    Codemagic ──→ macOS 인스턴스 ──→ 자동 서명 ──→ TestFlight 업로드
            │
 [심사]  TestFlight 확인 ──→ 심사 제출 ──→ 승인 ──→ 출시
```

> **Android 를 먼저 띄우는 것을 권장한다.** iOS 는 비용($99/년)과 심사 변수가 크고,
> Android 쪽에서 스토어 문구·이미지·개인정보 문서를 이미 만들어 두면 iOS 는
> **그 재사용에 가깝다.**

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

> ⚠ **아이폰(또는 아이패드) 실기가 하나도 없으면 iOS 출시는 눈 감고 하는 것이다.**
> TestFlight 로 본인이 설치해 보는 것이 사실상 유일한 확인 수단이다.
> **아이폰이 없다면 iOS 출시를 뒤로 미루는 것이 합리적이다.**

### 1.1 현재 iOS 프로젝트 상태 (이미 정상이다)

| 항목 | 값 | 비고 |
|---|---|---|
| `PRODUCT_BUNDLE_IDENTIFIER` | `com.superdimension.app` | Android 와 동일 |
| `IPHONEOS_DEPLOYMENT_TARGET` | `14.0` | 충분히 넓다 |
| `TARGETED_DEVICE_FAMILY` | `"1,2"` (iPhone + iPad) | ★ §5.4 를 읽을 것 |
| `MARKETING_VERSION` | `1.0` | = 사용자에게 보이는 버전 |
| `CURRENT_PROJECT_VERSION` | `1` | = 빌드 번호. CI 가 올린다 |
| 가로 고정 | `UISupportedInterfaceOrientations` 에 Landscape 만 | ✅ |
| iPad 가로 고정 | `UIRequiresFullScreen = YES` | ✅ 이게 없으면 멀티태스킹 때문에 무시된다 |
| Podfile | Capacitor 7 플러그인 8종 등록됨 | ✅ |

**손댈 것이 거의 없다.** 필요한 것은 §2.5 의 `Info.plist` 한 줄과 §5.4 의 결정뿐이다.

---

## 2. Apple Developer Program 가입

### 2.1 개인(Individual) 가입

1. https://developer.apple.com/programs/ → **Enroll**
2. Apple ID 로 로그인 (2단계 인증 필수)
3. **Entity Type: Individual / Sole Proprietor** 선택
4. 연회비 **US$99 / 년** 결제
5. 승인 — 보통 하루~며칠. 추가 신원 확인을 요구받을 수 있다

> **Apple Developer 앱(iPhone)** 으로 가입하면 신원 확인이 빠른 경우가 많다.

### 2.2 ★ 개인 vs 법인 — 판매자 이름이 공개된다

| | 개인 (Individual) | 법인 (Organization) |
|---|---|---|
| 준비물 | Apple ID + 신용카드 | **D-U-N-S 번호** + 법인 서류 |
| **App Store 에 표시되는 판매자명** | **본인 실명** (영문) | 법인명 |
| 준비 기간 | 며칠 | 몇 주 |
| 연회비 | $99 | $99 |

> ★★ **개인으로 가입하면 App Store 페이지에 본인 실명이 뜬다.** 그리고
> **유료 앱은 판매자 정보가 더 노출된다.** 이것이 곤란하면 법인/개인사업자를
> 먼저 알아본다 — **개인 → 법인 전환은 절차가 번거롭다.**
>
> 다만 인디 게임에서 개인 명의는 흔한 선택이고, 실명 노출이 실질적 문제를 일으키는
> 경우는 드물다. **결정만 미루지 않으면 된다.**

### 2.3 Bundle ID 등록

developer.apple.com → **Certificates, IDs & Profiles → Identifiers → +**

| 항목 | 값 |
|---|---|
| Type | App IDs → App |
| Description | RIFT ARK |
| Bundle ID | **Explicit** — `com.superdimension.app` |
| Capabilities | **아무것도 켜지 않는다** (푸시·게임센터·인앱결제 전부 없음) |

> **필요 없는 Capability 를 켜면 서명 프로파일이 복잡해지고 심사에서 질문을 받는다.**
> 이 게임은 순수 오프라인이므로 전부 끈 채로 둔다.

### 2.4 ★ 유료 앱 계약 (Paid Applications Agreement)

**이것이 없으면 앱 가격을 0 이 아닌 값으로 설정할 수 없다.**

App Store Connect → **비즈니스(Business) / 계약·세금·금융거래**

| 단계 | 내용 |
|---|---|
| ① 유료 앱 계약 동의 | "Paid Applications" 계약서 Request → 약관 동의 |
| ② **연락처 정보** | 담당자(본인) · 법무 · 재무 연락처 |
| ③ **금융 정보(은행)** | 정산받을 계좌. **본인 명의 한국 계좌 가능** (통화·은행 코드 필요) |
| ④ **세금 정보** | 미국(W-8BEN 계열) · 한국 · 필요 시 기타 지역 |

> ⚠ **계약 상태가 "활성(Active)"이 될 때까지 유료 가격을 못 넣는다.**
> 은행/세금 정보 검증에 며칠 걸릴 수 있으므로 **가입 직후 바로 시작한다.**
>
> **W-8BEN 을 제출하지 않으면 미국 판매분에 높은 원천징수가 적용된다.**
> 한미 조세조약 혜택을 받으려면 양식에 조약 조항을 정확히 기입해야 한다 — §8.

### 2.5 `Info.plist` 에 암호화 면제 선언 한 줄

제출할 때마다 "수출 규정 준수(Export Compliance)"를 묻는데, 미리 선언해 두면 안 묻는다.

`FE/ios/App/App/Info.plist` 에 추가:

```xml
<key>ITSAppUsesNonExemptEncryption</key>
<false/>
```

> 이 게임은 **네트워크 통신 자체가 없고 자체 암호화를 구현하지 않는다.**
> 따라서 `false` 가 사실이다. (HTTPS 등 OS 제공 암호화만 쓰는 경우도 면제 대상이지만,
> 이 앱은 그조차 없다.)

---

## 3. App Store Connect API 키 — Codemagic 의 열쇠

Codemagic 이 **서명하고 업로드**하려면 이 키가 필요하다. 인증서(.p12)나 프로비저닝
프로파일을 손으로 만들 필요가 **없다** — 자동 서명이 API 키로 다 한다.

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

## 4. 한국 유료 앱 · 등급 관련 **(한국 기준 — 영어권은 53번 §4 참조)**

> ⛔ **아래 설문 표는 2025년 개편 이전 체계다** (2026-08-07 확인).
> Apple 은 **12+ · 17+ 를 폐지하고 13+ · 16+ · 18+ 를 도입**했으며,
> **인앱 컨트롤 · 기능(Capabilities) · 의료/웰니스 · 폭력적 테마**와
> **사용자 생성 콘텐츠 · 메시징 · 친구/팔로워 · 라이브스트리밍 · 콘텐츠 제작 도구 ·
> 광고 노출** 문항이 추가됐다. 기존 앱은 2026-01-31 까지 재응답이 요구됐고,
> **신규 앱은 처음부터 신규 설문을 받는다.**
> → **신규 설문 기준의 전체 답변표는 `53-english-market-paid-release.md` §4.3.**
> 아래 표는 항목 대응 참고용으로만 남긴다.
>
> ★ 이 게임은 **신규 소셜 문항 전체가 "없음"으로 끝난다** (계정 · 서버 · 채팅 ·
> UGC · 광고가 하나도 없다). 그래서 등급이 **판타지 폭력 하나로만** 결정된다.

| 항목 | 내용 |
|---|---|
| 연령 등급 | App Store Connect 의 자체 설문으로 결정 |
| 한국 게임 등급 | Apple 은 게임물관리위원회가 지정한 **자체등급분류사업자**다. 설문 결과가 국내 등급이 된다 |
| **확률형 아이템** | **없음** — 확률 공개 의무·강화형 규제가 적용 대상 없음 |
| 인앱 결제 | **없음** (앱 자체만 유료) |

**연령 등급 설문의 답:**

| 질문 | 답 |
|---|---|
| 만화/판타지 폭력 | **약함/드묾** (픽셀 유닛 전투 · 피 표현 없음) |
| 사실적 폭력 | 없음 |
| 성적/노출 | 없음 |
| 욕설 | 없음 |
| 음주/흡연/약물 | 없음 |
| **도박 · 시뮬레이션 도박** | **없음** |
| 공포/무서움 | 없음~약함 |
| 무제한 웹 접근 | 없음 |
| 사용자 생성 콘텐츠 | 없음 |

> **청소년이용불가 등급이 나오면** 게임위 직접 등급분류가 필요하다. 이 게임은
> 해당하지 않을 것으로 보이나 **설문 결과 화면에서 확인한다.**

---

## 5. App Store Connect 앱 등록

### 5.1 앱 생성

App Store Connect → **앱 → +** → 신규 앱

| 항목 | 값 |
|---|---|
| 플랫폼 | iOS |
| 이름 | **균열의 방주** (30자) **(한국 기준 — 로마자 표기 결정은 53번 §6.4)** |
| 기본 언어 | 한국어 **(한국 기준 — 영어권 확대 시 기본 언어를 영어로 바꿀지는 53번 §6.1)** |
| 번들 ID | `com.superdimension.app` (§2.3 에서 등록한 것) |
| SKU | `RIFTARK001` (내부 식별자 · 아무 문자열) |
| 사용자 액세스 | 전체 액세스 |

### 5.2 앱 정보

| 항목 | 규격 | 내용 |
|---|---|---|
| 부제 | 30자 | `레인 3개를 지키는 디펜스` |
| 카테고리 | | 기본: 게임 → **전략** · 보조: 게임 → **액션** |
| **프로모션 텍스트** | 170자 | 심사 없이 언제든 바꿀 수 있다. 업데이트 안내에 쓴다 |
| **설명** | 4000자 | `50-google-play-paid-codemagic.md` §4.3 과 **같은 문구를 쓴다** |
| 키워드 | 100자, 쉼표 구분 | `디펜스,레인디펜스,전략,로그라이트,싱글플레이,오프라인,픽셀,인디,팔라독,광고없음` |
| 지원 URL | ★필수 | GitHub Pages 페이지로 충분 |
| 마케팅 URL | 선택 | |
| **개인정보 처리방침 URL** | ★필수 | Play 와 **같은 URL** |

> **키워드는 앱 이름/부제에 이미 있는 단어를 반복하지 않는다.** 낭비다.
> 그리고 **경쟁작 상표를 키워드에 넣으면 반려될 수 있다** — 위 목록의 `팔라독` 은
> 안전을 원하면 빼는 것이 좋다.
>
> ★★ **(한국 기준 — 영어권은 53번 §6.3 · §6.5)** App Store 는 **설명이 검색 색인
> 대상이 아니다.** ASO 가 **이름 30 + 부제 30 + 키워드 100 = 160자** 안에서 전부
> 끝난다 — Google Play 는 반대로 **긴 설명 본문이 색인된다.** 그래서 50 §4.3 의
> 설명을 그대로 옮기면 **Apple 쪽 ASO 가 통째로 빈다.** 영문 키워드 초안은 53 §6.5.

### 5.3 앱 개인정보 (Nutrition Label)

**"데이터를 수집하지 않습니다(Data Not Collected)"** 를 선택한다.

이 게임의 사실:
- 서버 없음 · 네트워크 통신 없음
- 광고 SDK · 분석 SDK · 크래시 리포터 없음
- 계정 · 로그인 없음
- 세이브는 `@capacitor/preferences` 로 **기기 내부에만**

> **Play 의 데이터 보안 양식 · 개인정보 처리방침 · 이 라벨 셋이 일치해야 한다.**
> 불일치는 반려 사유다.
>
> ★★★ **셋이 아니라 넷이다 — `PrivacyInfo.xcprivacy` 가 빠져 있다** (2026-08-07 추가).
> 2024-05-01 이후 업로드되는 iOS 앱은 **Required Reason API** 사용을 Privacy Manifest
> 에 선언해야 하고, `@capacitor/preferences` 는 iOS 에서 **`UserDefaults`** 를 쓴다.
> 누락하면 업로드는 되지만 **ITMS-91053 (Missing API declaration)** 경고 메일이 오고
> 이후 심사에서 막힌다.
> **실측 결과 `FE/ios/App/App/` 에 이 파일이 없다.** 파일 전문과 각 키의 이유:
> **`53-english-market-paid-release.md` §5.3.**

### 5.4 ★ 스크린샷 — iPad 를 지원할 것인가부터 정한다

현재 `TARGETED_DEVICE_FAMILY = "1,2"` 라 **iPhone + iPad 앱**이다.
→ **iPad 스크린샷도 필수가 된다.**

| 안 | 방법 | 대가 |
|---|---|---|
| **A. iPhone 전용으로 낮춘다** | Xcode 빌드 설정 `TARGETED_DEVICE_FAMILY = "1"` | iPad 사용자가 못 산다. **스크린샷 세트가 하나로 준다** |
| **B. iPad 도 지원한다** | 현행 유지 | iPad 스크린샷 세트를 더 만들고, **iPad 에서 UI 가 깨지지 않는지 확인해야 한다** (실기 없으면 확인 불가) |

> **권장: 첫 출시는 A(iPhone 전용).** iPad 는 UI 검증을 할 수 없는 상태에서
> 지원한다고 선언하는 것이 위험하다. 게임은 `Phaser.Scale.RESIZE` + `viewport.js` 로
> 4:3 에서도 성립하도록 설계돼 있지만(`02-design/18` §1.1), **성립한다고 검증한 적은 없다.**
> 나중에 iPad 를 켜는 것은 언제든 가능하다.

**iPhone 스크린샷 (가로 · 최소 1장, 권장 8장)**

| 기기 클래스 | 해상도 (가로) |
|---|---|
| 6.9" (최신 Pro Max) | **2868 × 1320** |
| 6.5" | 2778 × 1284 |

> ⚠ **Apple 은 요구하는 기기 클래스를 자주 바꾼다.** App Store Connect 의 업로드
> 화면이 **현재 요구되는 정확한 픽셀 크기를 표시한다.** 그것을 믿는다.
> 보통 **가장 큰 크기 하나만 올리면 나머지는 자동 축소**되지만, 화면 안내를 확인한다.

**내용 구성은 ⑤ 문서**(`52-store-image-codex-prompts.md`)를 따른다.

> ⚠ **`asset/generated/store/` 의 기존 `ios-*.png` 24장을 올리지 마라.** 실제 게임
> 화면이 아니라 생성 일러스트다 — **2.3.x 반려 사유 그 자체**다 (§7.2). 폐기·교체는
> ⑤ 문서 §0-A · §3.5. 첫 제출에는 `ios-6.9-1..8` 8장만 새로 만든다.

### 5.5 심사 정보

| 항목 | 내용 |
|---|---|
| 로그인 필요 | **아니오** ← 계정이 없으므로 데모 계정도 필요 없다 |
| 연락처 | 이름 · 전화 · 이메일 |
| **메모(Notes)** | 아래 참고 |

```
싱글플레이 오프라인 게임입니다.
- 로그인, 계정, 서버 통신이 없습니다.
- 인앱 결제와 광고가 없습니다.
- 개인정보를 수집하지 않습니다.
- 가로 모드 전용입니다. 기기를 가로로 돌려 주세요.
- 첫 실행 시 타이틀 화면에서 세이브 슬롯을 선택하면 게임이 시작됩니다.
```

> ★ **"가로 전용"과 "슬롯을 골라야 시작된다"를 반드시 적는다.** 심사자가 세로로
> 들고 빈 화면을 보거나, 타이틀에서 뭘 눌러야 할지 몰라 **"2.1 앱 완성도"로 반려**하는
> 사고가 실제로 흔하다.
>
> ★ **(한국 기준 — 영어권은 이 메모를 영문으로 쓴다.)** 심사자는 한국어를 읽지
> 않는다. 위 메모의 영역판을 함께 넣는다:
>
> ```
> Single-player offline game.
> - No sign-in, no account, no server communication.
> - No in-app purchases and no advertising.
> - No personal data is collected.
> - LANDSCAPE ONLY. Please rotate the device to landscape.
> - On first launch, pick a save slot on the title screen to start the game.
> ```

---

## 6. Codemagic — Mac 없이 빌드하고 올린다

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

**이것 하나로 서명 · TestFlight 업로드가 전부 해결된다.** 인증서·프로파일을 손으로
만들 필요가 없다.

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

---

## 7. 심사 제출

### 7.1 제출 전 확인

- [ ] TestFlight 빌드가 실기에서 정상 (또는 최소한 시뮬레이터 스크린샷 확인)
- [ ] 스크린샷 · 설명 · 키워드 · 지원 URL · 개인정보 URL
- [ ] 앱 개인정보 라벨 = "수집 안 함"
- [ ] 연령 등급 설문
- [ ] **가격: 유료 티어 선택** (유료 앱 계약이 활성이어야 선택 가능 — §2.4)
- [ ] 판매 국가 선택
- [ ] 심사 메모에 **"가로 전용 · 슬롯 선택 후 시작"** 명시 (§5.5)
- [ ] 수출 규정: `ITSAppUsesNonExemptEncryption = false` (§2.5)

### 7.2 자주 반려되는 항목 — 이 게임에 해당하는 것

| 가이드라인 | 내용 | 이 게임의 대비 |
|---|---|---|
| **2.1 App Completeness** | 심사자가 진행하지 못함 · 크래시 | 심사 메모에 조작법. TestFlight 로 미리 확인 |
| **2.3.x 정확한 메타데이터** | 스크린샷이 실제 게임과 다름 | **실제 게임 화면을 캡처해 쓴다.** 합성 일러스트를 스크린샷으로 내지 않는다 |
| **4.2 최소 기능** | 너무 단순한 앱 | 해당 없음 (100 스테이지) |
| **5.1.1 개인정보** | 방침 URL 누락/불일치 | Play 와 같은 URL |
| **3.1.1 인앱 구매** | 외부 결제 유도 | 해당 없음 (결제 자체가 없다) |
| **1.3 연령 등급** | 설문과 실제 콘텐츠 불일치 | 판타지 폭력 정직하게 표기 |

> ★ **2.3.x 가 이 프로젝트에서 가장 현실적인 위험이다.** ⑤ 문서의 프롬프트는
> **UI 오버레이·배경용 이미지**를 만들기 위한 것이고, **스크린샷의 본체는 반드시
> 실제 게임 화면 캡처여야 한다.** 그 위에 카피를 얹는 것까지는 허용된다.

### 7.3 심사 기간

보통 **하루~며칠**. 첫 제출은 더 걸릴 수 있다. 반려되면 사유가 명확히 오고,
**Resolution Center 에서 답변하면 재심사는 대체로 빠르다.**

---

## 8. 가격 · 세금 — 확인이 필요한 것들

> ★★★ **수익화 모델이 2026-08-07 에 무료 + 보상형 광고로 결정됐다** (사용자 판단 —
> 유료의 진입장벽이 설치를 줄인다). 아래 유료 절차는 **그대로 유효한 참고**이지만,
> 실제 출시는 **무료 앱**이다. 무료→유료 전환은 불가능하므로 순서를 주의할 것.
> · 판정 경위와 감수한 대가: [`55-monetization-decision.md`](55-monetization-decision.md)
> · 광고 붙이는 법 · 동의 · 스토어 제출물 변경: **[`56-admob-rewarded-integration.md`](56-admob-rewarded-integration.md)**


> **(이 절은 한국 기준이다 — 영어권은 53번 §1 · §2 를 읽는다.)**
> 특히 **기준 지역(base region)을 KRW 로 두면 환율에 따라 미국 가격이 조용히
> 바뀐다**는 것(53 §1.1), 세금 포함 국가와 별도 국가의 실수령 차이(53 §1.2),
> 외국 TIN 없이는 조세조약 혜택을 못 받는다는 것(53 §2.3)이 여기에 없다.

### 8.1 가격

App Store Connect → **가격 및 사용 가능 여부**

| 고려 | 내용 |
|---|---|
| **Play 와 같은 가격대로 맞춘다** | 다르면 리뷰에 그 얘기가 올라온다 |
| Apple 은 가격 티어 기반 | 한국 원화 티어에서 고른다 |
| 인하 자유 · 인상 신중 | 이미 산 사람은 영향 없다 |
| 무료 전환 | 가능. **역방향(무료→유료)은 사실상 불가** |

### 8.2 수수료

Apple 은 표준 수수료 외에 **Small Business Program**(연 매출 기준 저율 적용)을 운영한다.
**개인 인디 개발자는 대체로 여기에 해당한다** — App Store Connect 에서 **직접 신청**해야
적용되므로 **자동으로 되지 않는다.** 신청 화면에서 조건과 요율을 확인한다.

> ★ **연 수익 100만 달러 미만이면 15%** (2026-08-07 확인). 신청하지 않으면 30% 다 —
> **무료로 15%p 를 아끼는 버튼**이고, **매년 자격이 재평가된다.**
> Google Play 와의 차이(초과 후 처리 방식)는 **53번 §2.5.**

### 8.3 세금 ★ 전문가 확인 필요

> **아래는 답이 아니라 확인 목록이다.**

- **W-8BEN (미국 원천징수)** — 미제출 시 미국 판매분에 높은 세율. 한미 조세조약 적용을 위해 정확히 기입
- **한국 소득 신고** — 해외 결제 대행을 통한 소득. 규모에 따라 사업자등록 필요 여부가 갈린다
- **부가가치세** — Apple 이 판매자 지위인 지역과 아닌 지역이 다르다
- **외화 입금** — 은행에 따라 해외송금 수취 신고가 필요할 수 있다

---

## 9. 체크리스트

### 출시 전 1회

- [ ] git 저장소 + Codemagic 연결 (② §1.1, §9.1)
- [ ] Apple Developer Program 개인 가입 ($99/년) (§2.1)
- [ ] **개인 vs 법인 결정** (§2.2)
- [ ] Bundle ID 등록 (§2.3)
- [ ] **유료 앱 계약 + 은행 + 세금 정보 → 상태 "활성"** (§2.4)
- [ ] `Info.plist` 에 `ITSAppUsesNonExemptEncryption = false` (§2.5)
- [ ] App Store Connect API 키 발급 · `.p8` 안전 보관 (§3)
- [ ] **iPad 지원 여부 결정** (§5.4) — 권장: 첫 출시는 iPhone 전용
- [ ] 앱 생성 · 앱 정보 · 설명 · 키워드 (§5.1–5.2)
- [ ] 앱 개인정보 라벨 = 수집 안 함 (§5.3)
- [ ] 스크린샷 (§5.4 · ⑤ 문서)
- [ ] 연령 등급 설문 (§4)
- [ ] 심사 메모 작성 (§5.5)
- [ ] Codemagic App Store Connect 통합 등록 (§6.2)
- [ ] `codemagic.yaml` ios 워크플로 커밋 → `ios-v1.0.0` 태그
- [ ] **TestFlight 빌드 확인 (가능하면 실기)** (§6.5)
- [ ] 가격 티어 · 판매 국가
- [ ] 심사 제출

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
| "Missing Compliance" | `ITSAppUsesNonExemptEncryption` 누락 (§2.5) |
| 가격을 유료로 못 바꿈 | **유료 앱 계약이 아직 활성이 아니다** (§2.4) |
| 스크린샷 규격 거부 | 요구 픽셀 크기가 바뀌었다. 업로드 화면의 안내를 그대로 따른다 |
| iPad 스크린샷을 요구함 | `TARGETED_DEVICE_FAMILY = "1,2"` 때문. §5.4 |
| **2.1 반려 (심사자가 진행 못함)** | 가로 전용 · 슬롯 선택을 심사 메모에 안 적었다 (§5.5) |
| **2.3 반려 (메타데이터)** | 스크린샷이 실제 게임 화면이 아니다 (§7.2) |
| **ITMS-91053 (Missing API declaration) 메일** | ★ **Privacy Manifest 누락.** `PrivacyInfo.xcprivacy` 를 만든다 → **53번 §5.3** |
| **EU 에서만 앱이 내려갔다** | **DSA 거래자 지위 미설정** → **53번 §5.4** |
| 연령 등급 설문이 §4 와 다르게 생겼다 | 2025년에 체계가 개편됐다 (13+ · 16+ · 18+) → **53번 §4.3** |
| 심사자가 진행을 못 했는데 메모는 썼다 | **메모가 한국어였다** → §5.5 의 영문판 |
| macOS 빌드 크레딧 소진 | `triggering` 을 태그로 제한 (§6.4). Android 는 Linux 로 분리 |
| 아카이브에 `dSYM` 없음 | 크래시 심볼용. artifacts 에 포함돼 있다 (§6.4) |

---

## 관련 문서

| 무엇 | 어디 |
|---|---|
| 남은 작업 전체 로드맵 | `04-plan/35-remaining-work-roadmap.md` |
| Google Play 유료 등록 | `06-release/50-google-play-paid-codemagic.md` |
| 스토어 이미지 생성 프롬프트 | `06-release/52-store-image-codex-prompts.md` |
| **★ 영어권 유료앱 출시 (신규 연령등급 · Privacy Manifest · DSA · 가격 · 세금 · ASO)** | **`06-release/53-english-market-paid-release.md`** |
| iOS 네이티브 설정 | `03-tech/25-capacitor-mobile.md` §3 |
