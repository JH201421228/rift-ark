# 35. 남은 작업과 출시 로드맵

> 작성일 **2026-08-06**. 기준 빌드 `riftark-20260806.apk`.
> 검증 상태: lint 0 · 테스트 **1,176**(64파일) · `data:validate` 경고 0 ·
> `check` 전항 통과 · `check:prod` 통과 · `balance:check` **16/21**(실패 5는 판정 대기).
>
> **이 문서는 `33-execution-plan.md` 를 대체하지 않는다.** 그 문서는 *게임을 만드는*
> 130 티켓의 기록이고 사실상 끝났다. 이 문서는 **거기서 남은 것 + 아직 한 줄도 없는
> 출시 인프라**를 합친 현재 시점의 실행 계획이다. 둘이 다르면 **이 문서가 맞다.**

---

## 0. 30초 요약

**게임은 다 만들었다. 남은 일의 8할은 게임이 아니라 출시다.**

| 갈래 | 무엇 | 진척 | 막고 있는 것 |
|---|---|---|---|
| **A. 설계 판정** | 밸런스 실패 5항 · 나이트메어 배율 | 규명 완료 · 결정 대기 | **사용자가 직접 플레이해야 한다** |
| **B. 실기기 검증** | 콜드 스타트 · 세이브 유지 · 씬 전환 스트레스 (P9-01~03) | 0% | 안드로이드 실기 + 30분 |
| **C. 출시 인프라** | 저장소 · 서명 · CI · 스토어 자산 · 계정 · 법무 | **0%** | 전부. **한 줄도 없다** |

**가장 정직한 문장:** 코드는 출시 준비가 됐는데 **프로젝트가 준비되지 않았다.**
`git` 저장소가 아니고, 릴리스 서명 키가 없고, AAB 를 만든 적이 없고, 스토어 계정이 없다.

> **2026-08-07 에 넷이 줄었다.**
> · **아이콘·스플래시** — Capacitor 기본값을 걷어냈다 (R-06 완료 · `npm run icons`).
> · **영어 지원** — 한국어/영어 이중 언어. 전 화면에 언어 토글, 문자열 628키 +
>   게임 데이터 전량이 `{ko,en}`. 강제는 `npm run check:i18n` (`docs/03-tech/29-i18n.md`).
>   **영어권 유료앱 출시가 이제 콘텐츠 측면에서는 막혀 있지 않다.**
> · **영어권 출시 문서** — `06-release/53`(절차) · `54`(스토어 이미지 프롬프트).
>
> · **수익화 모델 확정** — **무료 + 보상형 광고**(사용자 결정). 코드가 이미 들어가 있고
>   (`data/ads.json` · `logic/adReward.js` · `native/ads.js` · 결과 화면 버튼),
>   `@capacitor-community/admob@7.2.0` 설치·네이티브 앱 ID 설정까지 끝났다.
>   **`ads.json:enabled` 만 false 다** — AdMob 계정과 광고 단위 ID 가 없기 때문이다.
>   판정 경위 `06-release/55`, 절차·법무 `06-release/56`.
>
> 남은 벽은 여전히 **R-01(git) → R-12(CI) → R-14(클로즈드 테스트 14일)** 이고,
> 그 순서는 바뀌지 않았다. 여기에 **R-16(AdMob 계정·동의·개인정보 방침 재작성)** 이
> 추가됐다 — 무료 앱은 유료 앱보다 법무 표면이 넓다.

> ⚠ **C 의 첫 항목이 나머지 전부를 막는다.** 이 폴더는 **git 저장소가 아니다**
> (`git rev-parse` 실패, `.gitignore` 없음, `FE/node_modules` 가 그대로 있다).
> Codemagic 은 **Git 원격에서만 빌드한다.** ②③ 문서의 모든 절차가 R-01 에서 시작한다.

---

## 1. 전체 지도

```
        [A] 설계 판정 ────────────┐
        (사용자 플레이)            │
                                  ├──→ 콘텐츠 확정 ──→ 스토어 자산 제작(R-07)
        [B] 실기기 검증 ──────────┘                          │
        (P9-01~03)                                           │
                                                             ▼
  [C] 출시 인프라
   R-01 git 저장소  ──→ R-12 codemagic.yaml ──→ R-13 내부 테스트 트랙
        │                    ▲                        │
        ├─→ R-02 서명 키 ────┤                        ├─→ R-14 클로즈드 테스트 14일 ★
        ├─→ R-03 버전 자동화 ┤                        │      (개인 계정 필수 · 12명)
        ├─→ R-04 targetSdk ──┤                        └─→ R-15 프로덕션 출시
        └─→ R-05 AAB ────────┘
   R-06 아이콘/스플래시 ✅┐
   R-07 스토어 이미지 ───┼─→ 스토어 등록 페이지
   R-08 개인정보 처리방침┤
   R-09 등급분류(IARC) ──┤
   R-10 결제 프로필/세무 ┘
```

**임계 경로는 R-01 → R-12 → R-13 → R-14 다.** R-14(클로즈드 테스트 14일)는
줄일 수 없는 달력 시간이므로 **가장 먼저 시작해야 하는 것**이다.

---

## 2. [A] 설계 판정 — 사용자만 답할 수 있는 것

기계는 여기까지 왔다. 다음 한 걸음은 사람의 판단이다.

### A-1. 밸런스 하드 게이트 2항 (`balance:check` 16/21)

| 게이트 | 실측 | 목표 | 실체 |
|---|---|---|---|
| **B3** | 1-9 승률 **84.3%** | 30–45% | "설계된 첫 패배"가 너무 쉽다 |
| **BN3** | 5-20 나이트메어 **0%** | — | **규칙을 전부 꺼도 0%** — 배율 ×1.9 × 월드 5 자체 |

소프트 3항(B10 ★2 73.8% · BN5 월드 1–3 만렙 100% · BN8 5-19 하드 ★2 0%)은
**같은 두 문제의 다른 얼굴**이다.

> **이것은 회귀가 아니다.** 다섯이 그대로면 새 작업이 아무것도 깨지 않은 것이다.
> **여섯 번째가 생겼을 때만** 변경을 의심한다.
>
> 배율을 1.6 까지 낮춰도 5-19 는 0% 이고 월드 1–4 만 시시해진다 — **한쪽을 고치면
> 다른 쪽이 나빠진다.** 어느 쪽을 우선할지가 설계 판단이고 그것이 사용자 몫이다.
> 읽을 것: `02-design/22-nightmare.md` §0-A.1 · `33-execution-plan.md` P7-03.

**해야 할 일:** 1-9 를 **직접 져 본다.** 84.3% 는 "이기는 판"의 비율이지
"패배가 납득되는가"가 아니다. 지고 나서 *왜 졌는지 알겠는가*가 이 게이트의 진짜 질문이다.

**결정 후 작업 (반나절):** 어느 쪽이든 `stages.json` 웨이브 · `worlds.json` 배율 ·
`nightmare.js` 계수 중 하나를 만지고 `balance:check` 재주행(300시드 · 약 2시간, 배경).

### A-2. 나이트메어 월드 5 를 열 것인가

BN8 의 결과로 **월드 5 나이트메어는 현재 영영 열리지 않는다** (선행 조건인 5-19 하드
★2 달성률이 0%). 선택지는 셋이다.

| 안 | 내용 | 대가 |
|---|---|---|
| ① 그대로 둔다 | 월드 5 나이트메어는 "존재하지만 도달 불가" | 만들어 놓고 아무도 못 보는 콘텐츠 — **이 저장소가 가장 싫어하는 형태** |
| ② 해금 조건 완화 | 하드 ★2 → 하드 클리어 | 나이트메어가 쉬워지는 게 아니라 *들어갈 수는 있게* 된다 (0% 승률은 그대로) |
| ③ 월드 5 배율 하향 | ×1.9 → ×1.5 대 | 월드 1–4 나이트메어가 더 시시해진다 (BN5 악화) |

> **권장: ①을 고르더라도 화면에서 지운다.** 도달 불가 콘텐츠를 목록에 남기는 것이
> 가장 나쁘다. ②가 가장 싸고, ③은 A-1 과 함께 결정해야 한다.

---

## 3. [B] 실기기 검증 — 기기만 있으면 30분

`riftark-20260806.apk` 를 설치하고 아래를 순서대로 잰다. **전부 손으로 30분 안에 끝난다.**

| 티켓 | 무엇 | 합격선 | 재는 법 |
|---|---|---|---|
| **P9-01** | 콜드 스타트 | p50 ≤ 3초 / p95 ≤ 5초 | 앱 강제 종료 후 아이콘 탭 → 타이틀이 뜰 때까지. 10회 반복 |
| | 평균 FPS | 중급 ≥ 50 / 저사양 ≥ 30 | 개발자 옵션 > GPU 렌더링 프로파일, 또는 설정 화면의 FPS 표시 |
| **P9-02** | 강제 종료 후 세이브 유지 | 진행도 100% 보존 | 스테이지 클리어 → 최근 앱에서 밀어 종료 → 재실행 |
| | 백그라운드 5분 복귀 | 전투 정상 · **오디오 재개** | 전투 중 홈 → 5분 → 복귀. BGM 이 돌아오는지 |
| **P9-03** | 씬 전환 스트레스 | 힙 증가 없음 | 연속 30전투. Android Studio Profiler 또는 `adb shell dumpsys meminfo` |
| **(신규)** | **네비게이션 바가 숨는가** | 좌우 바 없음 · sticky | 3버튼 기기 가로. `03-tech/25-capacitor-mobile.md` §3.3 |

> **P9-03 은 `adb` 없이도 근사할 수 있다:** 30전투 후 앱이 느려지거나 튕기면 실패다.
> 정밀 측정은 나중이고, **거친 판정이 없는 것보다 낫다.**

---

## 4. [C] 출시 인프라 — 아직 한 줄도 없다

> **여기가 실제로 남은 작업의 전부다.** 아래 15 티켓 중 완료된 것은 **0개**다.

### 4.1 기반 — 다른 모든 것의 전제

#### R-01 [S · ★최우선] git 저장소 초기화 + 원격 푸시

**현재:** `git rev-parse` 실패. `.gitignore` 없음. `FE/node_modules`(수만 파일) ·
`riftark-*.apk`(30MB × 3) · `balance-*.csv` · `dist/` 가 전부 작업 폴더에 노출돼 있다.

```bash
cd C:/Users/741u7/Desktop/clear/PJT20260801
git init -b main
# .gitignore 를 먼저 쓴다 — node_modules 를 한 번 커밋하면 되돌리기 번거롭다
git add . && git commit -m "chore(native): 초기 커밋 — RIFT ARK"
gh repo create riftark --private --source=. --push
```

**`.gitignore` 필수 항목**

```gitignore
node_modules/
FE/dist/
FE/android/app/build/
FE/android/build/
FE/android/.gradle/
FE/ios/App/Pods/
FE/ios/App/public/
FE/public/assets/atlas/     # assets:pack 산출물 — 재생성 가능
*.apk
*.aab
*.keystore
*.jks
*.p12
*.mobileprovision
key.properties
balance-*.csv
balance-*.log
balance-*.txt
scratch-*.json
scratch-*.csv
sweep.csv
*.stackdump
hs_err_pid*.log
replay_pid*.log
```

> ⚠ **키스토어 · `key.properties` · `.p8` 을 절대 커밋하지 않는다.** Codemagic 은
> 이것들을 **저장소가 아니라 자기 금고에 넣어 두고** 빌드 시점에 주입한다 (②③ 문서).
>
> ⚠ `FE/public/assets/atlas/` 를 무시하면 CI 가 `npm run assets:pack` 을 **반드시**
> 돌려야 한다. `prebuild` 스크립트가 이미 그렇게 되어 있다 (`assets:all`) — 다만
> **`ffmpeg-static` 다운로드가 CI 에서 실패할 수 있으므로**, 처음에는 아틀라스를
> 커밋해 두고 나중에 옮기는 것도 합리적이다. 둘 중 하나를 고르고 문서에 적는다.

**완료 조건:** 새 폴더에 clone → `npm ci` → `npm run build` 가 성공한다.

#### R-02 [M] 릴리스 서명 키스토어

**현재:** 디버그 서명만 있다 (`assembleDebug`). `app/build.gradle` 에 `signingConfigs` 가 없다.

```bash
keytool -genkeypair -v \
  -keystore riftark-release.jks -alias riftark \
  -keyalg RSA -keysize 4096 -validity 10000 \
  -storetype JKS
```

> ★★ **이 파일을 잃으면 앱을 영원히 업데이트할 수 없다.** Play App Signing 에
> 등록하면 Google 이 최종 서명 키를 보관해 주므로 **업로드 키만 잃는 사고는 복구
> 가능**하지만(Play Console 에서 업로드 키 재설정), iOS 는 그런 안전망이 없다.
> → **키스토어 + 비밀번호를 오프라인 백업 2벌**(USB · 인쇄물)로 남긴다.

`app/build.gradle` 에 추가:

```gradle
def keystorePropertiesFile = rootProject.file("key.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    signingConfigs {
        release {
            if (keystorePropertiesFile.exists()) {
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false          // ← R-04 에서 재검토
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

> `key.properties` 는 **`.gitignore` 대상**이다. Codemagic 은 이 파일을 만들지 않고
> `android_signing:` 으로 키스토어를 직접 주입한다 (② §5.3).

#### R-03 [S] 버전 자동화

**현재:** `versionCode 1` · `versionName "1.0"` 하드코딩. 업로드할 때마다 손으로
올리면 반드시 잊는다 — 그리고 Play 는 같은 `versionCode` 를 거부한다.

```gradle
defaultConfig {
    versionCode System.getenv("BUILD_NUMBER") ? System.getenv("BUILD_NUMBER").toInteger() : 1
    versionName "1.0.0"
}
```

Codemagic 은 `$BUILD_NUMBER`(또는 `$PROJECT_BUILD_NUMBER`)를 자동 증가시킨다.
**`versionName` 만 손으로 관리한다** — 그것은 사람에게 보이는 값이라 자동이면 곤란하다.

#### R-04 [M] targetSdk 정책 확인 ★기한 있음

**현재:** `compileSdk 35` · `targetSdk 35` · `minSdk 23`.

| 항목 | 값 | 비고 |
|---|---|---|
| Google Play 신규 앱 target API 요구 | **매년 8월 말 상향** | 2025-08-31 부터 API 35. **2026 년 요구치를 반드시 직접 확인한다** |
| `minSdk 23` (Android 6.0) | 유지 권장 | 낮출 이유 없음. 다만 저사양 크래시는 P9-01 에서 잰다 |

> ⚠ **이 항목은 내 지식으로 단정하지 않는다.** Play Console 이 업로드 시점에
> "target API 요구 미달"을 명시적으로 알려 준다. **R-13(내부 테스트 트랙 업로드)를
> 일찍 하는 진짜 이유가 이것**이다 — 정책 위반은 업로드해 봐야 알 수 있다.

#### R-05 [S] AAB 빌드

Play 는 **AAB 만** 받는다 (APK 는 2021년부터 신규 앱 불가).

```bash
cd FE && JAVA_HOME="C:/Program Files/Java/jdk-21.0.10" npm run build:android
cd android && JAVA_HOME="C:/Program Files/Java/jdk-21.0.10" ./gradlew bundleRelease
# → app/build/outputs/bundle/release/app-release.aab
```

**완료 조건:** AAB 가 나오고, `bundletool` 로 뽑은 APK 가 실기기에서 실행된다.
`dist/` ≤ 70MB 게이트(`32-definition-of-done.md` §3.5)도 여기서 잰다.

### 4.2 스토어에 낼 것

#### R-06 [M] 앱 아이콘 · 스플래시 실제 에셋 — **✅ 완료 (2026-08-07)**

**Capacitor 기본값(흰 배경 · 청록 안드로이드 벡터 · 하늘색 X 스플래시)을 걷어냈다.**

```bash
npm run icons          # 전 밀도 + 적응형 + 스플래시 11종 + resources/ 스토어 원본
npm run icons:check    # 존재·크기 검사 (verify 에 포함된다)
```

> ★★ **그림을 저장소에 던져 넣지 않고 스크립트로 만든다** (`tools/gen-app-icons.mjs`).
> 아이콘은 게임이 이미 쓰는 두 스프라이트를 합성한 것이다 —
> `structures/rift-idle.png`(균열) + `structures/ark-100.png`(방주, 금색 실루엣) +
> 발밑 레인 세 줄. **아이콘에 그려진 것이 전부 게임 안에 실재**하므로,
> 스토어가 "아이콘·스크린샷이 실제 게임과 다르다"로 반려하는 경로가 원천 차단된다.
> 색은 앱 배경(`capacitor.config.json:#0f0f1e`)과 같은 계열이다.
>
> ★ `@capacitor/assets` 를 쓰지 않는다 — 마스터 그림 3장을 손으로 관리해야 하고,
> 그 그림의 출처를 저장소가 설명할 수 없다.
> ★ 적응형 아이콘 안전 영역(108dp 중 72dp)을 지킨다. 꽉 채우면 제조사 마스크에
> 픽셀 균열의 뾰족한 끝이 잘린다.
> ★ 런처 이름은 로케일이 정한다 — `res/values/strings.xml`(한국어) ·
> `res/values-en/strings.xml`(`Rift Ark`, 2026-08-07 추가). **웹뷰의 i18n 은 이것을
> 바꿀 수 없다.** iOS `InfoPlist.strings` 는 아직 없다.

남은 것: **iOS 아이콘 세트**(`ios/App/App/Assets.xcassets`)와 `InfoPlist.strings`.
`resources/icon-1024.png` 가 그 원본이다.

#### R-07 [M] 스토어 등록 이미지

| 스토어 | 필수 | 규격 |
|---|---|---|
| Google Play | 피처 그래픽 1 · 스크린샷 최소 2(권장 8) | 1024×500 / 최소 1920×1080 가로 |
| App Store | iPhone 6.9" 스크린샷 최소 1(권장 8) | 2868×1320 가로 |

**전량 ⑤ 문서로 만든다.** ★ 카피는 **절삭 이후 현실**로 다시 써야 한다 —
기존 브리프 §6.4 에 "방치 보상 화면"(삭제됨) · "44종/40종"(현재 50종)이 남아 있다.

> ★★★ **2026-08-06 전수 실측 — 자산은 이미 40장 있는데, 그중 32장이 못 쓴다.**
>
> | | |
> |---|---|
> | 아이콘 3 · 스플래시 · 로고 3 · 피처그래픽 | ✅ **쓸 수 있다** |
> | **스크린샷 32장** (play 8 · ios-6.9 8 · ios-6.5 8 · ipad 8) | ❌ **폐기** — 실제 게임 화면이 아니라 **AI 로 그린 일러스트**다 |
>
> 실제 캡처와 대조하면 HUD 바 4개(방주·지휘관·마나·균열력) · 발밑 피아 표식 ·
> 주문 4칸이 **하나도 없다.** App Store 2.3.x 반려 사유이고, 그 전에 **산 사람이
> 환불한다.** 게다가 카피 두 줄이 **삭제된 기능**("접속하지 않아도 쌓인다" = 방치)과
> **틀린 수치**("40종" → 실제 50종)를 광고한다.
>
> **사람이 먼저 해야 할 일은 없다.** 폐기·교체·카피 단일 출처화까지 전부
> `06-release/52-store-image-codex-prompts.md` **§3.5 지시서**로 Codex 가 한다
> (준비물·뷰포트·배율은 **§3.0** 에 실측값, 갈래 A 재생성은 **§2.0** 에 코드 렌더 지시서).
> 사람 몫은 **끝난 뒤 §6 을 눈으로 보는 것** 하나다.
>
> 이번에 만들 것은 **16장** — `play-screenshot-1..8`(1920×1080) ·
> `ios-6.9-1..8`(2868×1320). iPad·6.5 세트는 iPhone 전용 결정(§5.4) 뒤로 미룬다.

#### R-08 [M] 개인정보 처리방침 ★필수

**둘 다 공개 URL 을 요구한다.** 없으면 심사 자체가 시작되지 않는다.

이 게임에 유리한 사실: **수집하는 개인정보가 없다.**
서버 없음 · 광고 SDK 없음 · 분석 SDK 없음 · 계정 없음. 세이브는 `@capacitor/preferences`
로 **기기 안에만** 저장된다. 그러니 방침 문서가 짧아도 정직하다.

```
- 수집 항목: 없음
- 기기 내 저장: 게임 진행도(세이브 3슬롯) · 설정. 앱 삭제 시 함께 삭제됨
- 제3자 제공: 없음
- 네트워크 통신: 없음 (앱은 오프라인으로 완결된다)
- 아동 대상 여부 / 문의처 이메일
```

> 호스팅은 GitHub Pages 로 충분하다 (`https://<계정>.github.io/riftark-privacy/`).
> Play 의 **데이터 보안(Data safety)** 양식과 App Store 의 **앱 개인정보(Nutrition
> Label)** 도 같은 내용으로 채운다 — **셋이 서로 달라선 안 된다.**

#### R-09 [S] 등급분류

| 스토어 | 방식 |
|---|---|
| Google Play / App Store | **IARC 설문**을 스토어 안에서 작성 → 자동 등급 부여 |
| 한국 (게임물관리위원회) | Google · Apple 이 **자체등급분류사업자**라 IARC 결과가 그대로 국내 등급이 된다 |

이 게임의 답: 폭력(판타지 · 비사실적) · **확률형 요소 없음** · 결제 없음 · 소셜 없음 ·
사용자 생성 콘텐츠 없음. **확률형이 하나도 없다는 것이 여기서 실질적 이득이 된다**
(확률 공개 의무 · 강화형 규제가 적용 대상 없음).

> ⚠ **청소년이용불가 등급이 나오면** IARC 자체등급으로 끝나지 않고 게임위 직접
> 등급분류가 필요하다. 이 게임은 해당하지 않을 것으로 보이나 **설문 결과를 보고 판단한다.**

#### R-16 [M] ★ AdMob 계정 · 동의 · 개인정보 (무료+광고 전환에 따라 신규)

**코드는 끝났고 계정이 없다.** `ads.json:enabled` 를 켜기 전에 필요한 것:

| 무엇 | 왜 |
|---|---|
| AdMob 계정 · 앱 등록 · 보상형 광고 단위(Android/iOS) | `ads.json:units` 와 네이티브 앱 ID 를 실제 값으로 |
| UMP 동의 메시지 구성 | EU/영국. 동의 전 광고 요청은 정책 위반이다 |
| 개인정보 처리방침 **전면 재작성** | 지금 방침은 "아무것도 수집하지 않습니다" 다 — 광고 ID 를 수집하면 거짓이 된다 |
| Data safety · App Privacy 답변 갱신 | 전부 "없음" 이던 것이 바뀐다 |
| **보상 설계 최종 결정** | 현재 ×1.3·하루 1회(경제 게이트 통과). 2배를 원하면 100 스테이지 재보정이 필요하다 — `06-release/56` §6 의 A/B/C |

절차 전문: `docs/06-release/56-admob-rewarded-integration.md`

#### R-10 [M] 유료 앱 결제 프로필 · 세무

②③ 문서에서 상세히 다룬다. 여기서는 **일정에 영향을 주는 사실 두 개**만:

- **개인 계정은 실명·주소가 스토어에 공개될 수 있다.** 유료 앱은 특히 그렇다.
  이것이 곤란하면 **개인사업자 등록 후 사업자 계정**을 고려한다 — 계정 유형은
  **나중에 바꾸기 매우 번거롭다.** 시작 전에 결정한다.
- **Google Play 개인 계정(2023-11 이후 생성)은 프로덕션 출시 전에
  클로즈드 테스트 테스터 12명 × 연속 14일**이 필요하다. → R-14.

### 4.3 자동화

#### R-11 [S] iOS 빌드 경로 확정

**사용자 환경은 Windows 다. macOS 가 없으면 iOS 는 빌드할 수 없다.**
Xcode 프로젝트 자체는 이미 정상이다 (`FE/ios/App` · Podfile · Info.plist 가로 고정 ·
`UIRequiresFullScreen` 까지 들어가 있다).

→ **Codemagic 의 macOS 인스턴스가 이 문제의 해답이다.** ③ 문서 전체가 그 절차다.

#### R-12 [L] `codemagic.yaml`

②③ 문서에 완성본이 있다. 워크플로 2개(`android-release` · `ios-release`).

#### R-13~R-15 [출시 트랙]

| 티켓 | 무엇 | 달력 시간 |
|---|---|---|
| **R-13** | 내부 테스트 트랙 업로드 (본인만) | 즉시 · 심사 몇 시간 |
| **R-14** | **클로즈드 테스트 12명 × 14일 연속** ★개인 계정 필수 | **최소 14일 — 줄일 수 없다** |
| **R-15** | 프로덕션 신청 → 심사 | 며칠 |

> ★★ **R-14 가 전체 일정의 바닥이다.** 다른 모든 작업을 마쳐도 여기서 2주가 그냥
> 지나간다. **테스터 12명을 모으는 일을 오늘 시작한다** — 지인 12명의 Gmail 주소가
> 필요하고, 그들이 **14일 동안 옵트인 상태를 유지**해야 한다 (매일 플레이할 필요는 없다).

---

## 5. 로드맵 — 주 단위

> 전제: 하루 3–4시간. 혼자. **A 와 B 는 C 와 병렬로 굴러간다** (의존이 없다).

### 1주차 — 막고 있는 것을 치운다

| 일 | 작업 | 산출 |
|---|---|---|
| 1 | **R-01** git 초기화 + `.gitignore` + GitHub private 푸시 | clone → build 성공 |
| 1 | **테스터 12명 모집 시작** (Gmail 주소 수집) ★ | 명단 |
| 2 | **R-02** 키스토어 생성 + 백업 2벌 + `signingConfigs` | `bundleRelease` 성공 |
| 2 | **R-03** 버전 자동화 · **R-05** AAB 확인 | `app-release.aab` |
| 3 | **B**(P9-01~03) 실기기 30분 + 네비게이션 바 확인 | 측정표 |
| 3 | **R-10a** Play Console 개인 계정 생성 · 신원 확인 제출 | 계정 (승인에 며칠) |
| 4–5 | **R-08** 개인정보 처리방침 작성 + GitHub Pages | 공개 URL |
| 4–5 | **R-06** 아이콘/스플래시 — ⑤ 문서 프롬프트로 생성 → `capacitor-assets` | 실제 아이콘이 뜬다 |

### 2주차 — CI 와 첫 업로드

| 일 | 작업 |
|---|---|
| 1–2 | **R-12** `codemagic.yaml` android 워크플로 · Codemagic 에 키스토어 등록 |
| 3 | **R-13** 내부 테스트 트랙 업로드 → **R-04 정책 위반 여부가 여기서 드러난다** |
| 3 | **R-09** IARC 설문 · 데이터 보안 양식 |
| 4–5 | **R-07** 스토어 이미지 8장 + 피처 그래픽 (⑤ 문서) |
| 5 | **R-14 시작 — 클로즈드 테스트 트랙 공개 · 12명 초대** ★ **여기서 14일 시계가 돈다** |

### 3–4주차 — 14일을 기다리는 동안 (기다림이 곧 작업 시간이다)

| 작업 |
|---|
| **A-1** 1-9 를 직접 져 본다 → B3 결정 → 웨이브 조정 → `balance:check` 재주행 |
| **A-2** 나이트메어 월드 5 세 안 중 택일 |
| 테스터 피드백 반영 (이것이 **첫 실사용 데이터**다) |
| **R-10b** 결제 프로필(merchant) 생성 · 세무 정보 · 가격 책정 |
| **R-11/R-12** iOS: Apple Developer Program 가입($99/년) · Codemagic ios 워크플로 |

### 5주차 — 출시

| 작업 |
|---|
| **R-15** 프로덕션 출시 신청 → 심사 |
| iOS: TestFlight → App Store 심사 (첫 심사는 보통 며칠) |

**현실적 최단: 약 5주.** 그중 **2주는 순수 대기**다.

---

## 6. 지금 당장 할 세 가지

1. **`git init` 하고 GitHub 에 private 으로 올린다.** 나머지 전부의 전제다.
2. **테스터 12명 명단을 만들기 시작한다.** 14일 시계는 빨리 시작할수록 좋다.
3. **Play Console 개인 계정을 만들고 신원 확인을 제출한다.** 승인에 며칠 걸린다.

> 셋 다 **코드를 한 줄도 건드리지 않는다.** 그런데 셋 다 일정의 바닥이다.

---

## 7. 위험 목록

| 위험 | 영향 | 완화 |
|---|---|---|
| **키스토어 분실** | 앱 업데이트 영구 불가 | Play App Signing 등록 + 오프라인 백업 2벌. **오늘** |
| **개인 계정 실명/주소 공개** | 프라이버시 | 시작 전 개인 vs 사업자 결정. **나중에 바꾸기 어렵다** |
| **클로즈드 테스트 12명 미달** | 프로덕션 출시 불가 | 여유 있게 15명 이상 초대 |
| **target API 정책 미달** | 업로드 거부 | R-13 을 일찍 해서 미리 드러낸다 |
| **유료 앱 = 리뷰 압력** | 첫 리뷰 몇 개가 전부를 좌우 | 밸런스 판정(A)을 출시 전에 끝낸다 |
| **`assets:pack` 이 CI 에서 실패** | 빌드 불가 | 처음엔 아틀라스를 커밋. CI 안정화 후 이관 |
| **iOS 심사 반려** | 지연 | 첫 제출은 여유 있게. Android 를 먼저 띄운다 |
| **밸런스 5항이 출시 후 문제로 드러남** | 리뷰 | A 를 출시 전에 끝낸다 — 유료 앱은 환불 요청이 곧 신호다 |

---

## 8. 이 문서가 완료되는 조건

- [ ] A-1 · A-2 결정됨 → `balance:check` 가 판정 반영 후 재주행됨
- [ ] B (P9-01~03 + 네비게이션 바) 실측표가 이 문서에 기록됨
- [ ] C 의 R-01~R-15 전항 완료
- [ ] Google Play 프로덕션 · App Store 에 유료로 게시됨

> 그리고 그때 **`33-execution-plan.md` 는 역사 문서가 된다.**

---

## 관련 문서

| 무엇 | 어디 |
|---|---|
| 무엇이 왜 없는지 | `04-plan/34-scope-cut.md` |
| 출시 게이트 원본 | `04-plan/32-definition-of-done.md` |
| 나이트메어 배율 판단 | `02-design/22-nightmare.md` §0-A.1 |
| 모바일 네이티브 설정 | `03-tech/25-capacitor-mobile.md` |
| **Google Play 유료 등록** | **`06-release/50-google-play-paid-codemagic.md`** |
| **App Store 유료 등록** | **`06-release/51-app-store-paid-codemagic.md`** |
| **스토어 이미지 생성 프롬프트** | **`06-release/52-store-image-codex-prompts.md`** |
