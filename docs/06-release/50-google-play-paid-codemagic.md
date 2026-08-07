# 50. Google Play — 개인 계정으로 유료 앱 등록하기 (Codemagic)

> 대상: **RIFT ARK / 균열의 방주** · `com.superdimension.app` · Capacitor 7 Android
> 작성일 **2026-08-06** · 작업 환경 Windows 11 · 개발자 1인
>
> **이 문서 하나만 보고 끝까지 갈 수 있게 썼다.** 순서대로 하면 된다.

---

> ### ★ 이 문서는 **한국 출시 기준**이다 (2026-08-07 추가)
>
> 앱 이름 · 기본 언어 · 등급 · 가격 · 세금 · 개인정보 문서가 전부 **한국 기준**으로
> 쓰여 있다. **영어권(미국 · 영국 · 캐나다 · 호주 · EU)으로 확대할 때 달라지는 것**은
> **[`53-english-market-paid-release.md`](53-english-market-paid-release.md)** 에 있다.
>
> | 여기(50)에 있는 것 | 영어권에서 달라지는 것 (53) |
> |---|---|
> | 앱 생성 · 기본 언어 한국어 (§4.1) | 기본 언어를 영어로 바꿀 것인가 · 로케일 추가 — **53 §6.1–6.2** |
> | 자세한 설명 한국어 초안 (§4.3) | 영문 초안 · Play 는 본문이 검색 색인 대상 — **53 §6.3 · §6.6** |
> | IARC 설문 (§5) | ESRB · PEGI · USK · ACB 예상 등급과 **붙지 않는 라벨** — **53 §4.1–4.2** |
> | 클로즈드 테스트 14일 (§6.2) | ★ **국가 확대에는 다시 필요 없다** — **53 §8.3** |
> | 개인정보 처리방침 한국어 (§7.2) | 영문판 · `/en/` 호스팅 — **53 §5.1** |
> | 데이터 보안 양식 (§7.1) | 영문 콘솔 문항과 답 · "수집"의 정의 — **53 §5.2** |
> | 가격 · 수수료 · 세금 (§8) | 국가별 자동 환산 · **세금 포함/별도** · W-8BEN · 15% 프로그램 — **53 §1 · §2** |
> | — | ★ **EU DSA 거래자 지위** (주소·전화가 공개된다) — **53 §5.4** |
> | — | 판매 국가 선택 · 켜면 안 되는 나라 — **53 §3** |
>
> ★ **영어권용 앱을 새로 만들지 않는다.** 같은 앱에 로케일과 국가를 더한다 —
> 새 앱은 **클로즈드 테스트 14일을 처음부터 다시** 해야 한다 (53 §8.1).

---

## ⚠ 먼저 읽을 것 — 이 문서의 유효기간

**스토어 정책은 이 문서보다 빨리 바뀐다.** 아래 항목은 **반드시 콘솔 화면에서 직접
확인**한다. 화면이 이 문서와 다르면 **화면이 맞다.**

| 확인할 것 | 어디서 |
|---|---|
| target API 레벨 요구치 (매년 8월 말 상향) | Play Console → 앱 번들 업로드 시 경고 |
| 개인 계정의 클로즈드 테스트 요구 (인원 · 일수) | Play Console → 대시보드 → 프로덕션 액세스 |
| 수수료율 · 정산 조건 | Play Console → 재무 |
| 신원 확인에 필요한 서류 | 계정 생성 마지막 단계 |

**나는 세무사도 변호사도 아니다.** §8(세금)은 "무엇을 알아봐야 하는지"의 목록이지
답이 아니다.

---

## 0. 전체 그림

```
 [준비]   git 저장소 ──→ 키스토어 ──→ AAB 가 로컬에서 나온다
                                          │
 [계정]   Play Console 개인 계정($25) ──→ 신원 확인 ──→ 결제 프로필(유료 앱용)
                                          │
 [앱]     앱 생성 ──→ 스토어 등록정보 ──→ 콘텐츠 등급 · 데이터 보안 · 개인정보 URL
                                          │
 [첫 업로드] ★ 손으로 AAB 1회 업로드 (API 로는 안 된다)
                                          │
 [CI]     GCP 서비스 계정 ──→ Codemagic 연동 ──→ codemagic.yaml ──→ 자동 업로드
                                          │
 [트랙]   내부 테스트 ──→ 클로즈드 테스트 **12명 × 14일** ──→ 프로덕션
                                          │
 [유료]   가격 책정 ──→ 국가 선택 ──→ 출시
```

**달력상 최단 경로는 "클로즈드 테스트 14일"에 갇혀 있다.** 그것부터 시작한다.

---

## 1. 준비 — 이것이 없으면 아무것도 시작되지 않는다

### 1.1 Git 저장소 ★ 현재 없다

**Codemagic 은 Git 원격에서만 빌드한다.** 이 프로젝트는 아직 git 저장소가 아니다.

```bash
cd C:/Users/741u7/Desktop/clear/PJT20260801
git init -b main
# .gitignore 를 먼저 만든다 (04-plan/35-remaining-work-roadmap.md §4.1 R-01 에 전문)
git add .
git commit -m "chore: 초기 커밋 — RIFT ARK"
gh repo create riftark --private --source=. --push
```

> **private 로 만든다.** 에셋 라이선스는 자유 사용이지만, 유료로 팔 게임의 소스를
> 공개할 이유가 없다. Codemagic 은 private 저장소를 정상 지원한다.

**검증:** 다른 폴더에 `git clone` → `cd FE && npm ci && npm run build` 가 성공해야 한다.
실패하면 `.gitignore` 가 필요한 파일을 지웠거나 커밋에서 빠진 것이 있다.

### 1.2 릴리스 키스토어 ★ 현재 없다

```bash
keytool -genkeypair -v \
  -keystore riftark-release.jks \
  -alias riftark \
  -keyalg RSA -keysize 4096 -validity 10000 \
  -storetype JKS
```

물어보는 것: 키스토어 비밀번호 · 이름/조직/도시/국가(KR) · 키 비밀번호.
**아무 값이나 넣어도 되지만 비밀번호는 반드시 기록한다.**

> ★★★ **이 파일과 비밀번호를 잃으면 이 앱을 영원히 업데이트할 수 없다.**
> Play App Signing(§4.4)에 등록해 두면 *업로드 키*를 잃어도 Google 에 재설정을
> 요청할 수 있다 — 그래도 **키스토어 + 비밀번호를 오프라인 2벌**(USB · 종이)로 남긴다.
> `.gitignore` 에 `*.jks` 가 있는지 확인한다. **저장소에 절대 넣지 않는다.**

### 1.3 `build.gradle` 서명 설정

`FE/android/app/build.gradle` — **로컬(`key.properties`)과 CI(환경변수) 양쪽**을 지원한다.

```gradle
def keystorePropertiesFile = rootProject.file("key.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    ...
    defaultConfig {
        ...
        // Codemagic 이 BUILD_NUMBER 를 자동 증가시킨다. 로컬에서는 1.
        versionCode System.getenv("BUILD_NUMBER") ? System.getenv("BUILD_NUMBER").toInteger() : 1
        versionName "1.0.0"
    }

    signingConfigs {
        release {
            if (System.getenv("CM_KEYSTORE_PATH")) {
                // ── CI (Codemagic 이 주입) ──
                storeFile     file(System.getenv("CM_KEYSTORE_PATH"))
                storePassword System.getenv("CM_KEYSTORE_PASSWORD")
                keyAlias      System.getenv("CM_KEY_ALIAS")
                keyPassword   System.getenv("CM_KEY_PASSWORD")
            } else if (keystorePropertiesFile.exists()) {
                // ── 로컬 ──
                storeFile     file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias      keystoreProperties['keyAlias']
                keyPassword   keystoreProperties['keyPassword']
            }
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

`FE/android/key.properties` (**`.gitignore` 대상**):

```properties
storeFile=C:/keys/riftark-release.jks
storePassword=...
keyAlias=riftark
keyPassword=...
```

### 1.4 로컬에서 AAB 가 나오는지 먼저 확인한다

```bash
cd FE && JAVA_HOME="C:/Program Files/Java/jdk-21.0.10" npm run build:android
cd android && JAVA_HOME="C:/Program Files/Java/jdk-21.0.10" ./gradlew bundleRelease
# → FE/android/app/build/outputs/bundle/release/app-release.aab
```

> **CI 를 붙이기 전에 로컬에서 반드시 성공시킨다.** CI 에서 처음 실패하면
> "내 코드 문제인가 CI 설정 문제인가"를 구분할 수 없다.

---

## 2. Play Console 개인 계정 만들기

### 2.1 가입

1. https://play.google.com/console → **개발자 계정 만들기**
2. **계정 유형: 개인(Individual)** ← ★ 여기서 갈린다. §2.2 를 먼저 읽는다
3. 등록비 **US$25 (1회, 평생)** 카드 결제
4. **신원 확인** — 신분증(주민등록증/여권/운전면허) 사진 + 주소 확인
5. 승인까지 보통 **며칠**

### 2.2 ★ 개인 vs 사업자 — 시작 전에 결정한다

| | 개인 (Individual) | 사업자 (Organization) |
|---|---|---|
| 준비물 | 신분증 | 사업자등록증 + **D-U-N-S 번호** |
| 스토어에 표시되는 이름 | **본인 실명** | 상호 |
| 유료 앱 판매자 주소 | **공개될 수 있다** | 사업장 주소 |
| 프로덕션 출시 전 조건 | **클로즈드 테스트 12명 × 14일** (§6) | 해당 없거나 완화 |
| 준비 시간 | 며칠 | 몇 주 (D-U-N-S 발급 포함) |

> ★★ **계정 유형은 나중에 바꾸기 매우 번거롭다.** 그리고 **유료 앱은 특히
> 판매자 정보 노출 요구가 강하다.** 실명·주소 공개가 곤란하면 **지금** 개인사업자
> 등록을 알아본다. 나중에 바꾸려면 계정을 새로 만들고 앱을 이전해야 할 수 있다.
>
> 반대로 "일단 만들어 보고 판단하겠다"면 **개인으로 시작해도 된다.** 이 게임은
> 서버도 결제도 없어서 사업자여야만 할 이유가 기술적으로는 없다.

### 2.3 유료 앱을 위한 결제 프로필 (merchant)

**앱을 유료로 팔려면 결제 프로필이 필수다.** 무료 앱은 없어도 된다.

Play Console → **결제 및 구독 → 결제 프로필 → 결제 프로필 설정**

준비물:
- 이름 · 주소 (신원 확인과 일치해야 한다)
- **정산 받을 은행 계좌** (본인 명의 · 한국 계좌 가능)
- 세금 정보 (§8)

> ⚠ **결제 프로필은 계정에 한 번 연결되면 해제가 어렵다.** 그리고 **유료 앱은
> 무료로 바꿀 수 있어도 무료 앱을 유료로 바꿀 수는 없다** — 이 게임은 처음부터
> 유료로 낼 것이므로 **앱 생성 시점에 "유료"로 만든다** (§4.5).

---

## 3. GCP 서비스 계정 — Codemagic 이 대신 업로드하게 만든다

Codemagic 이 Play 에 AAB 를 자동 업로드하려면 **서비스 계정 JSON 키**가 필요하다.

### 3.1 Play Console 에서 API 접근 활성화

Play Console → **설정 → API 액세스** → Google Cloud 프로젝트 생성 또는 연결

### 3.2 GCP 에서 서비스 계정 만들기

1. https://console.cloud.google.com → 위에서 연결한 프로젝트 선택
2. **IAM 및 관리자 → 서비스 계정 → 서비스 계정 만들기**
   - 이름: `codemagic-publisher`
3. 만들어진 계정 → **키 → 키 추가 → 새 키 만들기 → JSON** → 파일이 다운로드된다
4. ★ **이 JSON 이 곧 업로드 권한이다.** 저장소에 넣지 않는다

### 3.3 Play Console 에서 권한 부여

Play Console → **사용자 및 권한 → 새 사용자 초대**
→ 이메일에 서비스 계정 주소(`codemagic-publisher@...iam.gserviceaccount.com`) 입력

**앱 권한 (이 앱에만 주는 것을 권장):**

| 권한 | 필요 |
|---|---|
| 앱 정보 보기 (읽기 전용) | ✅ |
| 프로덕션 · 배타적 · 테스트 트랙에 릴리스 | ✅ |
| 스토어 등록정보 · 가격 · 배포 관리 | 선택 (Codemagic 이 등록정보까지 올릴 때만) |

> **재무 데이터 권한은 주지 않는다.** CI 가 매출을 볼 이유가 없다.

---

## 4. 앱 만들기 · 스토어 등록정보

### 4.1 앱 생성

Play Console → **앱 만들기**

| 항목 | 값 |
|---|---|
| 앱 이름 | **균열의 방주** (30자 이내) **(한국 기준 — 영어권 로마자 표기는 53번 §6.4 참조)** |
| 기본 언어 | 한국어 – 대한민국 **(한국 기준 — 영어권 확대 시 기본 언어 결정은 53번 §6.1)** |
| 앱 또는 게임 | **게임** |
| **무료 또는 유료** | **유료** ← ★ 나중에 무료→유료 전환 불가 |

> ⚠ **앱 이름의 로마자 표기를 확정하기 전에 상표 검색을 돌린다** (53 §6.4).
> `Rift` 는 게임 업계에 선례가 많다. 출시 후에 바꾸면 URL · 리뷰 · 이미지가 전부 딸려 온다.

### 4.2 스토어 등록정보

| 항목 | 규격 | 내용 |
|---|---|---|
| 앱 이름 | 30자 | 균열의 방주 |
| 간단한 설명 | 80자 | 예: `레인 3개를 지켜라. 웨이브마다 각인을 골라 매판 다른 빌드를 만든다.` |
| 자세한 설명 | 4000자 | §4.3 |
| 앱 아이콘 | **512 × 512** PNG (32비트, 알파 없음) | R-06 산출물 |
| 피처 그래픽 | **1024 × 500** | ⑤ 문서 |
| 스크린샷 | **최소 2장** · 권장 8장 · 가로 16:9 (1920×1080 이상) | ⑤ 문서 §3.5 |

> ⚠ **`asset/generated/store/` 에 있는 기존 스크린샷을 그대로 올리지 마라.**
> 실제 게임 화면이 아니라 생성 일러스트이고, 카피가 삭제된 기능을 광고한다.
> 폐기·교체 절차는 `52-store-image-codex-prompts.md` §0-A · §3.5.

### 4.3 자세한 설명 초안 **(한국 기준 — 영어권은 53번 §6.6 참조)**

> 이 게임의 실제 사양에서만 뽑았다. **없는 기능을 쓰지 않는다** — 스토어 설명과
> 실제가 다르면 그것이 첫 별점 1개가 된다.
>
> ★ **영문판은 그대로 번역하면 안 된다.** Google Play 는 **긴 설명 본문이 검색
> 색인 대상**이라 검색어를 산문에 녹여야 하고, App Store 는 설명이 색인되지 않아
> ASO 가 **이름 30 + 부제 30 + 키워드 100자** 안에서 끝난다 (53 §6.3).

```
세 개의 레인과 하늘. 균열에서 쏟아지는 것들을 방주까지 보내지 않는 것이 전부다.

■ 편성이 곧 결정이다
동료 50종 중 단 6종만 데려간다. 무엇을 두고 가는지가 그 판을 결정한다.

■ 지휘관은 직접 걸어 나가 싸운다
지휘관이 서 있는 자리에 오라가 깔리고, 오라 안에서만 특수능력이 켜진다.
평타 사거리는 오라 반경보다 짧다 — 때리려면 앞으로 나가야 하고, 나가면 맞는다.

■ 웨이브마다 각인 3지선다
18종의 각인 중 셋이 제시되고 하나를 고른다. 같은 스테이지도 매판 다른 빌드가 된다.

■ 상성은 조합된다
물리는 방어력에 막히고, 술식은 방어를 무시하되 저항에 막히고, 신성은 부패에 특효다.
적의 태그가 겹치므로 단 하나의 정답 유닛은 존재하지 않는다.

■ 100 스테이지 · 5개 월드 · 보스 10체
노멀 · 하드 · 나이트메어. 나이트메어에는 월드마다 규칙이 하나씩 붙는다.

────────────────────────
■ 이 게임에 없는 것
· 확률형 요소가 하나도 없습니다 (뽑기 · 강화 · 랜덤 옵션 전부 없음)
· 인앱 결제가 없습니다
· 광고가 없습니다
· 스태미나가 없습니다
· 인터넷 연결이 필요 없습니다 — 전부 오프라인으로 동작합니다
· 개인정보를 수집하지 않습니다

한 번 사면 끝입니다.
```

> ★ **"없는 것" 문단이 이 게임의 가장 강한 판매 포인트다.** 유료 앱을 사는 사람이
> 정확히 그것을 사기 때문이다. 위에 쓴 6줄은 전부 **코드로 강제되어 있는 사실**이다
> (`CLAUDE.md` 절대 규칙 6 · 서버 없음 · 광고 SDK 없음).

### 4.4 앱 서명

**Play App Signing 을 사용한다** (신규 앱은 사실상 필수). 업로드 키(§1.2)로 서명해
올리면 Google 이 최종 배포 서명을 대신한다. → **업로드 키를 잃어도 복구 가능하다.**

### 4.5 앱 콘텐츠 (전부 채워야 심사가 시작된다)

| 항목 | 이 게임의 답 |
|---|---|
| **개인정보처리방침 URL** | ★필수. GitHub Pages 로 호스팅 (§7) |
| 앱 액세스 권한 | 제한 없음 (로그인 없음) |
| 광고 | **광고 없음** |
| 콘텐츠 등급 (IARC 설문) | §5 |
| 타겟층 | 만 12세 이상 등 — 설문 결과에 따름 |
| 뉴스 앱 | 아니오 |
| 데이터 보안 | **수집 없음 · 공유 없음 · 기기 내 저장만** (§7) |
| 정부 앱 | 아니오 |
| 금융 기능 | 없음 |

---

## 5. 콘텐츠 등급 (IARC) — 한국 등급도 여기서 나온다

Play Console → **정책 → 앱 콘텐츠 → 콘텐츠 등급** → 설문

이 게임의 답:

| 질문 | 답 |
|---|---|
| 폭력 | **판타지/비사실적 폭력 있음** (픽셀 유닛끼리 전투, 피 표현 없음) |
| 성적 콘텐츠 | 없음 |
| 언어 | 없음 |
| 통제 물질 | 없음 |
| **도박/시뮬레이션 도박** | **없음** |
| **확률형 아이템(루트박스)** | **없음** ← ★ |
| 사용자 간 상호작용 | 없음 |
| 위치 공유 | 없음 |
| 개인정보 공유 | 없음 |
| 디지털 구매 | **없음** (앱 자체가 유료일 뿐 인앱 결제 없음) |

> ★★ **"확률형 없음"이 여기서 실제 이득이 된다.** 한국 게임산업법의 확률 공개
> 의무와 강화형 규제가 **적용 대상 없음**이 되고, IARC 설문에서도 등급을 올리는
> 항목이 통째로 빠진다.
>
> **한국 등급:** Google 은 게임물관리위원회가 지정한 **자체등급분류사업자**라,
> IARC 결과가 그대로 국내 등급이 된다. 별도 신청이 필요 없다.
> 다만 **청소년이용불가 등급이 나오면** 게임위 직접 등급분류가 필요하다 —
> 이 게임은 해당하지 않을 것으로 보이나 **설문 결과 화면에서 확인한다.**
>
> ★ **이 설문 하나가 이미 전 세계 등급을 산출한다.** 영어권 확대를 위해 다시 할
> 것이 없다 — ESRB(미국) · PEGI(EU·영국) · USK(독일) · ACB(호주)의 예상 등급과,
> **확률형·결제가 없어서 붙지 않는 라벨**(PEGI "In-Game Purchases (Includes Random
> Items)" 등)은 **53번 §4.1–4.2** 에 있다.
> **App Store 의 연령 등급은 2025년에 체계가 바뀌었다** (12+ · 17+ 폐지 →
> 13+ · 16+ · 18+) — 51번 §4 가 아니라 **53번 §4.3** 이 최신이다.

---

## 6. 트랙 전략 — ★여기가 일정의 바닥이다

### 6.1 순서

| 트랙 | 무엇 | 기간 |
|---|---|---|
| **내부 테스트** | 최대 100명. 본인 계정만 넣어도 된다. **심사 거의 없이 즉시** | 즉시 |
| **클로즈드 테스트** | ★ 개인 계정 필수 관문 | **최소 14일** |
| 오픈 테스트 | 선택 | — |
| **프로덕션** | 실제 출시 | 심사 며칠 |

### 6.2 ★ 개인 계정의 클로즈드 테스트 요구

**2023년 11월 이후 만든 개인(Individual) 계정**은 프로덕션 출시 전에:

- **테스터 12명 이상**이
- **연속 14일 동안** 옵트인 상태를 유지해야 하고
- 그 뒤에 **프로덕션 액세스를 신청**해 승인받아야 한다

> ⚠ **정확한 인원·일수·조건은 Play Console 대시보드에 그대로 표시된다.**
> 진행률(예: "12명 중 8명 · 6일 남음")까지 보여주므로 **화면을 신뢰한다.**

**실무 요령:**

| | |
|---|---|
| **여유 있게 초대한다** | 12명이 요구면 **15~20명**을 초대한다. 중간에 나가는 사람이 반드시 있다 |
| **Google 계정(Gmail) 주소**가 필요하다 | 테스터가 옵트인 링크를 열어 "테스터 되기"를 눌러야 카운트된다 |
| 매일 플레이할 필요는 없다 | **옵트인 상태 유지**가 조건이다. 다만 실제로 플레이해 달라고 부탁한다 — 이게 첫 실사용 데이터다 |
| 오늘 시작한다 | 14일은 줄일 수 없다. **다른 모든 작업과 병렬로 굴린다** |
| 유료 앱이어도 테스터는 무료 | 테스트 트랙 참여자는 결제하지 않는다 |

**Google 그룹으로 관리하는 것을 권장한다** — 개별 이메일 목록보다 추가/제거가 쉽다.

> ★★ **이 14일은 국가 확대에 다시 필요하지 않다** (2026-08-07 확인).
> 프로덕션 액세스는 **앱 단위 1회성 관문**이고 국가 설정과 무관하다 — 한국
> 테스터만으로 통과한 뒤 미국·EU 를 켜도 다시 돌지 않는다. **53번 §8.3.**
> 반대로 **새 앱(새 패키지명)을 만들면 처음부터 다시다** — 그래서 "영어권판"을
> 따로 만들지 않는다 (53 §8.1).
>
> ⚠ **2026-04 이후 Google 은 "테스터가 실제로 앱을 썼는가"를 본다.** 옵트인만 하고
> 아무도 안 켠 상태로 신청하면 참여도 부족으로 반려된다. 위의 "매일 플레이할 필요는
> 없다"는 **옵트인 유지 조건**에 대한 말이고, 신청서에는 **어떤 기능을 썼는지**를
> 적어야 한다 → 테스터에게 **이틀에 한 번은 열어 달라**고 부탁한다.

### 6.3 ★ 첫 AAB 는 손으로 올린다

**Google Play Publishing API 는 "아직 릴리스가 하나도 없는 앱"에 업로드할 수 없다.**
Codemagic 자동 업로드가 첫 시도에서 실패하는 가장 흔한 이유가 이것이다.

→ **§1.4 에서 만든 `app-release.aab` 를 내부 테스트 트랙에 손으로 한 번 업로드한다.**
그 다음부터 CI 가 동작한다.

---

## 7. 개인정보 처리방침 · 데이터 보안

**이 게임은 개인정보를 수집하지 않는다.** 서버 없음 · 광고 SDK 없음 · 분석 SDK 없음 ·
계정 없음. 세이브는 `@capacitor/preferences` 로 **기기 안에만** 저장된다.

### 7.1 데이터 보안 양식

| 질문 | 답 |
|---|---|
| 데이터를 수집하거나 공유하는가 | **아니오** |
| 데이터가 전송 중 암호화되는가 | 해당 없음 (전송 없음) |
| 사용자가 데이터 삭제를 요청할 수 있는가 | **앱 삭제로 전부 삭제됨** |

> **세 곳(개인정보처리방침 · 데이터 보안 양식 · App Store 개인정보 라벨)이 서로
> 달라선 안 된다.** 불일치는 심사 반려 사유다.
>
> ★ **iOS 로 나가면 넷이 된다** — `PrivacyInfo.xcprivacy`(Privacy Manifest)가 더
> 붙는다. **이 저장소에는 아직 그 파일이 없다** (2026-08-07 실측). 53번 §5.3.
>
> ★ **"수집(collect)"의 정의:** Google 기준으로 수집은 **데이터를 기기 밖으로
> 전송하는 것**이다. `@capacitor/preferences` 로 기기 내부에만 저장하는 것은
> 수집이 아니므로 **"아니오"가 정직한 답이다.** 여기서 겁을 먹고 "예"로 답하면
> 20여 문항이 열리고 App Store 라벨과 어긋나 불일치 반려가 난다 (53 §5.2).

### 7.2 개인정보 처리방침 원문 (그대로 써도 된다) **(한국어판 — 영문판은 53번 §5.1)**

```markdown
# 균열의 방주 (RIFT ARK) 개인정보 처리방침

최종 수정일: 2026-00-00

## 1. 수집하는 개인정보
본 앱은 어떠한 개인정보도 수집하지 않습니다.
이름, 이메일, 전화번호, 위치, 광고 식별자, 기기 식별자를 수집하지 않습니다.

## 2. 기기에 저장되는 정보
게임 진행도(세이브 슬롯 3개)와 설정값이 기기 내부 저장소에만 저장됩니다.
이 정보는 외부로 전송되지 않으며, 앱을 삭제하면 함께 삭제됩니다.

## 3. 네트워크 통신
본 앱은 네트워크에 연결하지 않습니다. 전체 기능이 오프라인으로 동작합니다.

## 4. 제3자 제공 및 위탁
없습니다. 광고 네트워크, 분석 도구, 크래시 리포터를 포함한 어떠한 제3자
SDK 도 사용하지 않습니다.

## 5. 아동의 개인정보
본 앱은 개인정보를 수집하지 않으므로 아동으로부터 수집하는 정보도 없습니다.

## 6. 권리 행사
저장되는 정보가 기기 내부에만 있으므로, 앱을 삭제하시면 모든 정보가 삭제됩니다.

## 7. 문의
이메일: 741u741@gmail.com
```

**호스팅:** GitHub 에 `riftark-privacy` 저장소를 만들고 `index.md` 로 두면
`https://<계정>.github.io/riftark-privacy/` 가 공개 URL이 된다. **무료이고 영구적이다.**

---

## 8. 가격 · 세금 — 확인이 필요한 것들

> **(이 절은 한국 기준이다 — 영어권은 53번 §1 · §2 를 읽는다.)**
> 거기에는 국가별 자동 환산의 함정, **세금 포함 국가와 별도 국가의 실수령 차이**,
> W-8BEN 제출 절차와 외국 TIN, 한·미 조세조약, **Apple Small Business Program 은
> 신청해야 적용된다**는 사실이 있다.

### 8.1 가격 책정

> ★★★ **수익화 모델이 2026-08-07 에 무료 + 보상형 광고로 결정됐다** (사용자 판단 —
> 유료의 진입장벽이 설치를 줄인다). 아래 유료 절차는 **그대로 유효한 참고**이지만,
> 실제 출시는 **무료 앱**이다. 무료→유료 전환은 불가능하므로 순서를 주의할 것.
> · 판정 경위와 감수한 대가: [`55-monetization-decision.md`](55-monetization-decision.md)
> · 광고 붙이는 법 · 동의 · 스토어 제출물 변경: **[`56-admob-rewarded-integration.md`](56-admob-rewarded-integration.md)**

Play Console → **수익 창출 → 앱 가격**

| 고려 | 내용 |
|---|---|
| 한국 가격 | 인디 프리미엄 게임 관례상 **₩3,900 ~ ₩9,900** 대 |
| 글로벌 | 기준 가격(USD)을 정하면 국가별 환산가를 자동 제안 |
| **인하는 가능, 인상은 신중** | 이미 산 사람은 영향 없지만 인상은 심리적 저항이 크다 |
| 무료 전환 | **유료 → 무료는 가능. 무료 → 유료는 불가** |

### 8.2 수수료

Google Play 수수료는 개발자 수익 규모와 프로그램 가입 여부에 따라 다르다.
**Play Console → 재무 화면에서 본인에게 적용되는 실제 요율을 확인한다.**

### 8.3 세금 ★ 전문가 확인 필요

> **아래는 답이 아니라 "알아봐야 할 목록"이다. 세무사에게 확인한다.**

- **국내 소득 신고** — 앱 판매 수익은 소득이다. 규모에 따라 사업자등록 필요 여부가 갈린다
- **미국 원천징수** — Play Console 세금 정보에서 **W-8BEN** 계열 양식을 제출한다.
  한미 조세조약으로 세율이 낮아질 수 있으므로 **미제출 상태로 두지 않는다**
- **부가가치세** — 앱스토어를 통한 판매에서 판매자 지위가 누구인지에 따라 다르다
- **통신판매업 신고** — 스토어를 통한 판매의 신고 의무 주체 확인

---

## 9. Codemagic 설정

### 9.1 프로젝트 연결

1. https://codemagic.io → GitHub 로 가입
2. **Add application** → 저장소 선택 → 프로젝트 유형 **Other / Native**
   (Capacitor 는 Flutter 도 React Native 도 아니다)
3. 워크플로 편집기 대신 **`codemagic.yaml` 사용**을 선택

> **무료 한도가 있다.** macOS 인스턴스(iOS용)를 많이 쓰면 금방 소진된다.
> Android 는 Linux 인스턴스라 훨씬 싸다 — **Android 를 먼저 자동화한다.**

### 9.2 키스토어 등록

Codemagic → 앱 설정 → **Distribution → Code signing identities → Android keystores**

| 필드 | 값 |
|---|---|
| Keystore file | `riftark-release.jks` 업로드 |
| Keystore password | §1.2 에서 정한 값 |
| Key alias | `riftark` |
| Key password | §1.2 에서 정한 값 |
| **Reference name** | `riftark_keystore` ← yaml 에서 이 이름으로 부른다 |

### 9.3 서비스 계정 JSON 등록

Codemagic → 앱 설정 → **Environment variables**

| 필드 | 값 |
|---|---|
| Variable name | `GCLOUD_SERVICE_ACCOUNT_CREDENTIALS` |
| Value | §3.2 JSON 파일 **전체 내용을 그대로 붙여넣기** |
| Group | `google_play` |
| **Secure** | ✅ **반드시 체크** |

### 9.4 `codemagic.yaml` — 저장소 루트에 둔다

```yaml
workflows:
  android-release:
    name: RIFT ARK — Android Release
    instance_type: linux_x2
    max_build_duration: 60

    environment:
      android_signing:
        - riftark_keystore          # §9.2 의 reference name
      groups:
        - google_play               # §9.3 의 변수 그룹
      node: 22
      java: 21                      # ★ 21 미만이면 "invalid source release: 21"
      vars:
        PACKAGE_NAME: "com.superdimension.app"

    triggering:
      events:
        - tag                       # v1.0.0 같은 태그를 밀 때만 릴리스한다
      tag_patterns:
        - pattern: 'v*'
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

      - name: 검증 게이트 (lint · test · data · check)
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
          npx cap sync android

      - name: 프로덕션 잔재 점검
        script: |
          cd FE
          node tools/check-production.mjs

      - name: AAB 빌드
        script: |
          cd FE/android
          chmod +x gradlew
          ./gradlew bundleRelease

    artifacts:
      - FE/android/app/build/outputs/bundle/**/*.aab
      - FE/android/app/build/outputs/**/mapping.txt

    publishing:
      email:
        recipients:
          - 741u741@gmail.com
        notify:
          success: true
          failure: true

      google_play:
        credentials: $GCLOUD_SERVICE_ACCOUNT_CREDENTIALS
        track: internal             # internal → alpha(클로즈드) → production
        submit_as_draft: false
```

> **`versionCode` 는 `$BUILD_NUMBER` 에서 온다** (§1.3). Codemagic 이 빌드마다
> 자동 증가시키므로 손댈 것이 없다.
>
> **`triggering` 을 태그로 제한한 이유:** 커밋마다 Play 에 올리면 `versionCode` 를
> 낭비하고 트랙이 지저분해진다. 릴리스는 의도적인 행위여야 한다.
>
> ```bash
> git tag v1.0.0 && git push origin v1.0.0
> ```

### 9.5 트랙을 올리는 법

`track:` 값을 바꾸고 태그를 다시 민다.

| 단계 | `track` |
|---|---|
| 내부 테스트 | `internal` |
| 클로즈드 테스트 (14일 관문) | `alpha` |
| 오픈 테스트 | `beta` |
| 프로덕션 | `production` |

> 또는 Play Console 에서 **"릴리스 승격"** 으로 이미 올라간 빌드를 다음 트랙으로
> 옮길 수 있다. 같은 AAB 를 다시 빌드할 필요가 없으므로 이쪽이 낫다.

### 9.6 밸런스 게이트는 CI 에 넣지 않는다

`npm run balance:check` 는 **300시드 · 약 2시간**이다. CI 빌드 시간을 통째로 먹는다.
→ **로컬에서 배경으로 돌리고, CI 에는 `lint · test · data:validate · check` 만 넣는다.**
(위 yaml 이 그렇게 되어 있다.)

---

## 10. 체크리스트

### 출시 전 1회

- [ ] git 저장소 + private 원격 (§1.1)
- [ ] 키스토어 생성 + **오프라인 백업 2벌** (§1.2)
- [ ] `build.gradle` 서명/버전 설정 (§1.3)
- [ ] 로컬에서 AAB 성공 (§1.4)
- [ ] Play Console 개인 계정 + 신원 확인 (§2.1)
- [ ] **개인 vs 사업자 결정** (§2.2)
- [ ] 결제 프로필 (§2.3)
- [ ] GCP 서비스 계정 + Play 권한 (§3)
- [ ] 앱 생성 — **유료로 생성** (§4.1)
- [ ] 스토어 등록정보 · 아이콘 512 · 피처 1024×500 · 스크린샷 (§4.2)
- [ ] 개인정보 처리방침 URL 공개 (§7.2)
- [ ] 데이터 보안 양식 (§7.1)
- [ ] IARC 콘텐츠 등급 (§5)
- [ ] **첫 AAB 손으로 업로드** (§6.3)
- [ ] Codemagic 연결 + 키스토어/JSON 등록 (§9.1–9.3)
- [ ] `codemagic.yaml` 커밋 → 태그 푸시 → 자동 업로드 확인
- [ ] **클로즈드 테스트 15명+ 초대 · 14일 시작** (§6.2)
- [ ] 세금 정보 제출 (§8.3)
- [ ] 가격 책정 · 국가 선택 (§8.1)
- [ ] 프로덕션 액세스 신청 → 승인

### 업데이트마다

- [ ] `versionName` 올림 (`versionCode` 는 자동)
- [ ] `npm run verify` 로컬 통과
- [ ] **이전 버전 세이브로 실행 테스트** (`SAVE_VERSION` 마이그레이션)
- [ ] 실기기 스모크
- [ ] 태그 푸시 → CI → 내부 테스트 → 승격

---

## 11. 자주 막히는 곳

| 증상 | 원인 · 해결 |
|---|---|
| `invalid source release: 21` | CI 의 Java 가 21 미만. yaml 의 `java: 21` 확인. 로컬은 `JAVA_HOME` 을 명령마다 지정 |
| Codemagic 이 첫 업로드에서 실패 | **§6.3** — 첫 AAB 는 손으로 올려야 한다 |
| `Package not found: com.superdimension.app` | 서비스 계정이 아직 그 앱 권한을 못 받았거나, 앱이 생성만 되고 릴리스가 0개 |
| `versionCode` 중복 거부 | `$BUILD_NUMBER` 배선 확인 (§1.3) |
| `gradlew: Permission denied` | yaml 에 `chmod +x gradlew` (§9.4 에 포함됨) |
| 서명 불일치 | 업로드 키가 바뀌었다. Play App Signing 의 업로드 키 재설정 요청 |
| `assets:pack` 이 CI 에서 실패 | `ffmpeg-static` 다운로드 실패 가능. 아틀라스를 커밋해 두고 `assets:audio` 만 건너뛰는 것도 방법 |
| 심사 반려: 개인정보처리방침 | URL 이 404 거나, 앱 이름이 문서에 없거나, 데이터 보안 양식과 불일치 |
| 프로덕션 신청 거부 | 클로즈드 테스트 조건 미달. 대시보드가 진행률을 보여준다. **2026-04 이후는 참여도(실제 사용)도 본다** (§6.2) |
| 스크린샷 거부 | 실제 게임 화면이 아니거나(과도한 편집), 규격 미달, 다른 기기 프레임 합성 |
| **EU 에서만 앱이 사라졌다** | ★ **DSA 거래자 지위 미설정.** 한국만 팔 때는 드러나지 않는다 → **53번 §5.4** |
| 영문 리스팅인데 개인정보 URL 이 한국어 문서 | 로케일별로 다른 URL 을 넣을 수 있다 → **53번 §5.1** |

---

## 관련 문서

| 무엇 | 어디 |
|---|---|
| 남은 작업 전체 로드맵 | `04-plan/35-remaining-work-roadmap.md` |
| App Store 유료 등록 | `06-release/51-app-store-paid-codemagic.md` |
| 스토어 이미지 생성 프롬프트 | `06-release/52-store-image-codex-prompts.md` |
| **★ 영어권 유료앱 출시 (가격 · 세금 · 국가 · 등급 · 법무 · ASO)** | **`06-release/53-english-market-paid-release.md`** |
| **★ 수익화 모델 판정 (유료 vs 무료+광고)** | **`06-release/55-monetization-decision.md`** |
| 모바일 네이티브 설정 | `03-tech/25-capacitor-mobile.md` |
| 릴리스 체크리스트 원본 | `04-plan/32-definition-of-done.md` §4 |
