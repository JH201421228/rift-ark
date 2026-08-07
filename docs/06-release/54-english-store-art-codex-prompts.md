# 54. 영어권 스토어 아트 — Codex 프롬프트 모음

> 대상: **RIFT ARK** · Google Play(en-US) + App Store(en-US) 등록용 이미지 · 카피 · 설명문
> 작성일 **2026-08-07** · 기준 상태: 스테이지 **100** · 월드 **5** · 적 **62종** · 보스 **10체** ·
> 동료 **50종** · 각인 **18종** · 지휘관 주문 **12종** · 난이도 **3** · 재화 **골드 하나** ·
> 확률형 **0** · 광고 **0** · 인앱결제 **0** · 네트워크 **0**
>
> **이 문서는 `52-store-image-codex-prompts.md` 의 영어권 대응판이다.**
> 52 가 정본이고 이 문서는 그 위에 **영어권 사정만** 얹는다 —
> 픽셀 규칙 · 캡처 파이프라인 · 뷰포트 · 배율은 **52 에만 있다. 여기에 다시 적지 않는다.**
> (같은 사실을 두 곳에 적으면 갈라진다 — 이 저장소의 단일 실패 유형)

---

## 0. 이 문서를 쓰는 법

### 0.1 Codex 에 넘기는 순서

**한 번에 프롬프트 하나씩** 넘긴다. 여러 개를 붙여 주면 Codex 가 마지막 것만 제대로 한다.

| 순서 | 프롬프트 | 산출물 | 선행 조건 |
|---|---|---|---|
| ① | **§0-A 결정** | (사람이 결정) | ★ 이것부터. 안 정하면 아래가 전부 헛돈다 |
| ② | P1 · P2 · P3 | 아이콘 3안 | 없음 |
| ③ | P4 · P5 | 적응형 전경/배경 | ② 에서 안이 골라진 뒤 |
| ④ | P6 또는 P7 | 피처 그래픽 | 없음 |
| ⑤ | **P8** | 영어 스크린샷 파이프라인 확장 | `store:capture` 가 도는 상태 |
| ⑥ | P9 | 오버레이 카피 검수 | P8 |
| ⑦ | P10 · P11 · P12 | 이름 · 설명문 · 키워드 | 없음 (병렬 가능) |

### 0.2 파일명 규칙 — **한국어 세트를 덮지 않는다**

기존 파이프라인의 산출 경로(`store/play/` · `store/ios/`)는 **한국어 전용**이다.
영어 세트는 **형제 폴더**로 간다. 같은 파일명을 다른 언어로 두 번 쓰면 어느 쪽이
올라갔는지 아무도 모른다.

```
FE/asset/generated/store/
├─ play/                      ← 한국어 (건드리지 않는다)
├─ ios/                       ← 한국어 (건드리지 않는다)
├─ play-feature-graphic.png   ← 한국어 로고 락업
├─ icon.png · icon-foreground.png · icon-background.png   ← 언어 무관. 공용
└─ en/                        ★ 이 문서가 만드는 것 전부
   ├─ play/  play-screenshot-1..8.png     1920×1080
   ├─ ios/   ios-69-1..8.png              2868×1320
   ├─ play-feature-graphic-en.png         1024×500
   ├─ icon-a.png · icon-b.png · icon-c.png     1024×1024  (후보 3안)
   └─ _preview/  icon-a-48.png · icon-b-48.png · icon-c-48.png
```

> **아이콘은 언어별로 만들지 않는다.** 텍스트가 없기 때문이다(§2). 후보 3안 중
> 하나가 채택되면 `store/icon.png` 를 **교체**하고 `en/icon-*.png` 는 지운다.

### 0.3 ★ 파이프라인과 충돌하지 않기 위한 절대 조건

`FE/tools/` 에 스크린샷 파이프라인이 **이미 있고 돌아간다**
(`capture-store-shots.mjs` · `compose-store-shots.mjs` · `check-store-shots.mjs` ·
`store-copy.json`, `package.json` 의 `store:capture|compose|check`).

| 규칙 | 왜 |
|---|---|
| **새 캡처 스크립트를 만들지 않는다.** 기존 3종에 `--lang en` 플래그를 더한다 | 두 개를 만들면 뷰포트·배율·장면 정의가 갈라진다. 이미 한 번 당했다(52 §0-A) |
| **카피의 단일 출처는 `tools/store-copy.json` 이다.** 그 파일에 `en` 열이 **이미 있다** — 새 파일을 만들지 않고 그 열을 고친다 | 카피가 두 곳에 있어서 삭제된 기능을 광고한 적이 있다 (52 §0-A) |
| `store-copy.json` 은 **정확히 8행**이고 각 행에 `id` · `ko` · `en` 이 있어야 한다 | `check-store-shots.mjs` 가 강제한다 |
| 장면 정의(`SCENES` 8개)를 바꾸지 않는다 | 8장의 의미가 언어마다 달라지면 대조가 불가능하다 |
| dev 서버 포트 **5199** · CDP **9333** 그대로 | 5173 은 사용자 것이다 |
| 끝나면 Chrome · Vite 프로세스를 정리한다 | |

### 0.4 이 문서가 **다루지 않는 것**

- 픽셀 규칙 · 팔레트 · 금지 목록 → **52 §1 의 STYLE 블록**. 아래 §1-S 에 영어판만 둔다
- 캡처 뷰포트 · `deviceScaleFactor` · 리사이즈 커널 → **52 §3.0**
- Play/App Store 등록 절차 · 서명 · 심사 → `50-google-play-paid-codemagic.md` · `51-app-store-paid-codemagic.md`

---

## 0-A. ★★★ 먼저 결정해야 할 것 — **게임 UI 가 한국어뿐이다**

**이것을 정하기 전에 아래 프롬프트를 돌리면 안 된다.**

2026-08-07 실측:

| 확인한 것 | 값 |
|---|---|
| i18n 프레임워크 | **없다** (`react-i18next` 등 의존성 0) |
| `FE/index.html` | `<html lang="ko">` |
| 화면 12종의 한글 문자열 | 전부 **하드코딩** (`CompanionsScreen.jsx` 만 209줄) |
| 데이터의 영문 이름 | **있다** — `units.json` · `enemies.json` · `sigils.json` 의 `name.en` (동료 50 / 적 62 / 각인 18 전량) |
| UI 라벨의 영문 | **없다** (`ROLE_LABEL` · `DMG_LABEL` 등이 화면 파일 안에 한글로 박혀 있다) |

즉 지금 영어 스토어에 낼 스크린샷은 **한국어 UI 화면에 영어 자막을 얹은 것**이 된다.

### 선택지

| # | 안 | 얻는 것 | 잃는 것 |
|---|---|---|---|
| **A** | **영어 스토어를 미룬다.** 한국 선행 출시(원래 계획)만 하고, i18n 이후에 연다 | 정직하다. 추가 작업 0 | 영어권 출시가 늦어진다 |
| **B** | **지금 낸다.** 영어 카피 오버레이 + 긴 설명 첫 문단에 "게임 내 텍스트는 현재 한국어"를 명시 | 지금 낼 수 있다. 정책 위반은 아니다(스크린샷이 실제 게임이므로 App Store 2.3.x 는 통과) | 설명을 안 읽고 산 사람이 환불한다. **유료 앱에서 그것이 첫 별점 1개다** |
| **C** | **i18n 을 먼저 한다.** UI 라벨 영문화 → 영어 캡처 → 영어 스토어 | 가장 강하다. `name.en` 이 이미 있어 절반은 끝나 있다 | 화면 12종의 문자열 추출 + 라벨 사전 + 폰트 확인. 며칠 규모 |

> ★ **이 문서는 어느 안도 고르지 않는다.** B 를 고를 경우에만 §5 의 P11 프롬프트에
> `LANGUAGE NOTICE` 문단이 **반드시** 들어간다 — 프롬프트 안에 그 지시가 이미 있다.
> C 를 고르면 P8(캡처) 은 그대로 쓰고 P11 의 `LANGUAGE NOTICE` 만 지운다.
>
> ⚠ **B 를 고르면서 설명문에 언어 고지를 빼는 것 — 이것만은 하지 않는다.**
> 그것이 이 프로젝트가 스크린샷 32장을 폐기하며 배운 것과 같은 실수다.

---

## 1. 영어권 스토어 요구 자산 — 사양표

### 표기 규약

| 표시 | 뜻 |
|---|---|
| **[공식]** | 2026-08-07 에 **공식 문서에서 직접 확인**했다 |
| **[2차]** | 서드파티 문서에서만 확인했다. 공식 확인 필요 |
| **[추정]** | 이 저장소의 판단. 근거는 옆에 적었다 |

공식 출처
- Google Play: <https://support.google.com/googleplay/android-developer/answer/9866151>
- App Store: <https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/>
- App Store 프리뷰 영상: <https://developer.apple.com/help/app-store-connect/reference/app-information/app-preview-specifications>

### 1.1 Google Play (en-US)

| 자산 | 크기 | 포맷 | 개수 | 근거 |
|---|---|---|---|---|
| 앱 아이콘 | **512 × 512** | **32비트 PNG · 알파 있음** · ≤ **1,024 KB** | 1 | **[공식]** |
| 피처 그래픽 | **1024 × 500** | JPEG 또는 **24비트 PNG · 알파 없음** | 1 · **필수** | **[공식]** |
| 폰 스크린샷 (가로) | 각 변 **320–3,840 px** · **16:9** | JPEG / 24비트 PNG · 알파 없음 | **최소 2 · 최대 8** | **[공식]** |
| 폰 스크린샷 권장치 | **1920 × 1080** | | **4장 이상 · 짧은 변 1,080 px 이상** 이어야 노출 자격 | **[공식]** 권장 · 해상도 값은 **[추정]**(16:9 · 1080 하한을 만족하는 최소 정수배) |
| 7인치 태블릿 (가로) | **1920 × 1200** | 동일 | **최소 4 권장** · 최대 8 | 크기 **[2차]** · 개수 **[공식]** |
| 10인치 태블릿 (가로) | **2560 × 1600** | 동일 | **최소 4 권장** · 최대 8 | 크기 **[2차]** · 개수 **[공식]** |
| 태블릿 해상도 범위 | 1,080 – 7,680 px | | | **[공식]** |
| 파일 용량 상한 | **8 MB / 장** | | | **[2차]** — `check-store-shots.mjs` 가 이미 8 MiB 로 강제한다 |
| 프로모션 비디오 | **YouTube URL** (공개 또는 미등록) | 선택 · **강력 권장** | 리스팅당 1개 | **[공식]** ★ **해당 영상의 광고를 꺼야** Play 에 노출된다 |

> ⚠ **아이콘의 알파.** Play 공식 문서는 **"32-bit PNG (with alpha)"** 라고 적는다.
> `52 §5.1` 은 `icon-512.png` 를 "알파 없음"이라고 적었는데 **그것은 iOS 쪽 규칙이다.**
> iOS 아이콘은 알파를 거부하고, Play 아이콘은 알파 채널이 있는 32비트를 요구한다.
> → **두 파일을 따로 낸다:** `icon.png`(1024, 알파 없음, iOS/마스터) ·
> `icon-512.png`(512, 32비트 알파 채널 포함 — 단 **전 픽셀 불투명**하게 채운다).
> ★ 이 항목은 52 를 고칠 때 함께 정리한다. **이 문서에서는 고치지 않는다.**

> ⚠ **태블릿 스크린샷을 만들기 전에 결정한다.** 이 게임은 태블릿 지원을 **검증한 적이
> 없다**(P9-01~03 실기기 검증 미완). 태블릿 스크린샷을 올리면 **지원을 선언하는 것**이
> 된다. `51 §5.4` 가 iPad 에 대해 같은 말을 한다. → **첫 출시는 폰 전용을 권한다.**

### 1.2 App Store (en-US)

| 자산 | 가로 크기 | 필수 여부 | 근거 |
|---|---|---|---|
| iPhone **6.9"** | **2736 × 1260** | ✅ iPhone 앱이면 필수 | **[공식]** |
| iPhone 6.9" 대체 허용치 | **2868 × 1320** · 2796 × 1290 | 업로드 시 함께 받는다 | **[2차]** ★ 아래 경고 |
| iPhone **6.5"** | **2778 × 1284** | 6.9" 를 안 낼 때만 필수 | **[공식]** |
| iPhone **5.5"** | **2208 × 1242** | 선택 | **[공식]** |
| iPad **13"** | **2752 × 2064** | **iPad 앱이면 필수** | **[공식]** |
| iPad 12.9" | 2732 × 2048 | | **[공식]** |
| 장수 | **1–10 장** | | **[공식]** |
| 포맷 | `.png` / `.jpg` / `.jpeg` · **알파·투명 금지** | | **[공식]** |
| 앱 아이콘 | **1024 × 1024** · 알파 없음 · 둥근 모서리 직접 그리지 않음 | 필수 | **[2차]** (Xcode 에셋 카탈로그 경유) |
| 앱 프리뷰 영상 | 선택 · 최대 3개 · 15–30초 | | **[추정]** — 위 공식 URL 로 확인할 것 |

> ★★ **여기서 하나가 어긋난다.** 현재 파이프라인은 iOS 세트를 **2868 × 1320** 으로 낸다
> (`compose-store-shots.mjs` · `check-store-shots.mjs` 에 박혀 있다). Apple 공식
> 스크린샷 표는 오늘 기준 6.9" 를 **2736 × 1260** 으로 제시한다. 2차 출처들은 2868 × 1320
> 도 6.9" 로 받는다고 하고, 실제로 App Store Connect 는 세 해상도를 모두 받아 왔다.
>
> **판정: 지금 값을 바꾸지 않는다.** 근거는 52 §5.2 의 규칙과 같다 —
> **App Store Connect 업로드 화면이 요구하는 정확한 픽셀 크기가 최종 권위다.**
> 업로드에서 거부당하면 그때 `compose`/`check` 의 상수 한 줄을 2736 × 1260 으로 바꾼다.
> ★ 바꾸면 **두 파일을 같이** 바꾼다. 한쪽만 바꾸면 검사기가 자기 자신을 통과시킨다.

### 1.3 메타데이터 글자수

| 필드 | Google Play | App Store | 근거 |
|---|---|---|---|
| 앱 이름 | **30자** | **30자** | **[2차]** |
| 부제 (Subtitle) | — | **30자** | **[2차]** |
| 짧은 설명 | **80자** | — | **[2차]** |
| 프로모션 텍스트 | — | **170자** | **[2차]** |
| 긴 설명 | **4,000자** | **4,000자** | **[2차]** |
| 키워드 | — | **100자** (쉼표 구분) | **[2차]** |

> **[2차] 인 이유:** 두 콘솔 모두 입력란이 남은 글자수를 실시간으로 보여 준다.
> **그 카운터가 최종 권위다.** 아래 프롬프트는 전부 상한보다 **여유를 두고** 쓰게 한다.

---

## 1-S. 공통 STYLE 블록 (영문) — **모든 이미지 프롬프트 앞에 붙인다**

> 52 §1 의 영어판이다. **번역이 아니라 이미지 모델에 넣기 위한 원문**이다.
> 빼먹으면 스타일이 흔들린다.

```
[STYLE — RIFT ARK]

Game: landscape mobile lane defense. In the lineage of Paladog and Cartoon Wars.
Art: HD pixel art. Not retro nostalgia — a deliberate modern choice.
Tone: grim world, absurd troops. Backgrounds and UI are serious; only the units are funny.

Palette:
  Base background  #0f0f1e   (near-black indigo)
  Gold accent      #F2B33D   (currency, logo, emphasis)
  Purple accent    #B45AD6   (the rift, magic, threat)
  Sky blue         friendly-side marker
  Red              enemy-side marker

Pixel rules:
  - No anti-aliasing. Every pixel is a solid color. Alpha is 0 or 255, never in between.
  - Express gradients with dithering. No soft blurred gradients.
  - Limited palette: 16 colors per layer preferred, 32 maximum.
  - Outlines are 1px solid. Units get outlines; background objects do not.
  - Backgrounds are always darker and less saturated than units
    (background luminance 15-50%, units 50-90%).

Never include:
  - Photoreal textures, 3D renders, flat vector illustration
  - Soft airbrush gradients
  - Watermarks, signatures, random glyph strings
  - Apple or Google device frames (stores reject these)
  - Anything resembling a character or logo from an existing game
  - Emoji or Unicode symbol glyphs

Output: PNG-32 (RGBA), sRGB, lossless, metadata stripped.
```

---

## 2. 앱 아이콘 프롬프트 — 3안

### 2.0 공통 산출물 사양

| 항목 | 값 |
|---|---|
| 크기 | 정확히 **1024 × 1024** |
| 알파 | **없음** — 모서리까지 배경색으로 꽉 채운다 (iOS 는 투명 아이콘을 거부한다) |
| 둥근 모서리 | **직접 그리지 않는다.** OS 가 마스킹한다 |
| 텍스트 | **금지** (30자 앱 이름이 아이콘 아래에 이미 뜬다) |
| 파일명 | `en/icon-a.png` · `en/icon-b.png` · `en/icon-c.png` |
| 미리보기 | 각 안을 **48 × 48** 로 축소해 `en/_preview/icon-{a,b,c}-48.png` 로 함께 낸다 |
| **유일한 합격 기준** | **48 × 48 로 줄여도 무엇인지 읽히는가** |

> **각 안을 5장 이상 뽑아 48px 시험으로 고른다** (52 §7 ⑦). 한 장만 뽑아서 고르지 않는다.

---

### P1 — 안 A "균열 앞의 지휘관" (52 §2.1 계승)

**의도.** 이미 만들어 쓰고 있는 방향이다. 어두운 배경 · 보라 균열 · 금색 림라이트라는
게임의 3색을 아이콘 하나에 다 넣는다. **가장 안전하지만 장르는 안 읽힌다** —
"판타지 게임"까지만 전달된다.

```
[paste the STYLE block here]

[TASK] Mobile game app icon master, 1024x1024 square.

Composition:
  - Dark indigo background filling the entire canvas (#0f0f1e to #1a1030)
  - Behind center: a single vertical torn rift. Purple light (#B45AD6) leaks from
    its edges; the interior is a brighter purple. Render the glow as 3-4 dithered
    steps only — no blur.
  - In front of the rift: exactly one silhouette — the upper body of a
    cloaked commander. Near-black silhouette with a 1px gold (#F2B33D) rim light.
  - The silhouette occupies about 55% of the canvas height, centered slightly low.

Hard constraints:
  - Exactly two elements: the rift (background) and the silhouette (foreground).
    Nothing else.
  - No multiple units, no weapons, no particles, no text, no border ornament.
  - At 48x48 it must still read as "a black silhouette in front of a purple rift".
  - No alpha channel. Fill to the corners with background color.
  - Do not draw rounded corners.
```

---

### P2 — 안 B "세 레인" (장르가 읽히는 안)

**의도.** 영어권 스토어에서 아이콘의 일은 "이게 무슨 장르인가"를 0.3초에 말하는 것이다.
**세 개의 가로 띠 + 좌측 요새 + 우측 균열**이라는 도식은 레인 디펜스를 그림 한 장으로
설명한다. **48px 에서 가장 강한 안**이다 — 굵은 가로줄 셋은 어떤 크기에서도 살아남는다.

```
[paste the STYLE block here]

[TASK] Mobile game app icon master, 1024x1024 square.

Composition — read left to right:
  - Dark indigo background (#0f0f1e) filling the entire canvas.
  - Three horizontal bands stacked vertically, each about 22% of canvas height,
    separated by thin darker gaps. These are the three lanes. Give each band a
    slightly different dark ground tone so they read as separate lanes.
  - Left edge: a chunky gold-lit fortress wall silhouette (#F2B33D lamps),
    occupying the left ~22% of the canvas, spanning all three bands.
  - Right edge: a vertical purple rift (#B45AD6) occupying the right ~22%,
    spanning all three bands, dithered glow only.
  - On the middle band, one small dark unit silhouette with a 1px gold rim light,
    facing right. Exactly one. Do not populate the other bands.

Hard constraints:
  - The composition must read as: fortress | three lanes | rift.
  - No text, no numbers, no HUD elements, no health bars.
  - At 48x48 the three bands and the left/right anchors must still separate.
    If the fortress and the rift blur into the background, increase their
    contrast rather than adding detail.
  - No alpha channel. Fill to the corners.
  - Do not draw rounded corners.
```

---

### P3 — 안 C "균열 문장" (가장 추상적 · 48px 최강)

**의도.** 아이콘을 **문장(紋章)** 으로 만든다. 형태가 단순해서 어떤 크기에서도 죽지 않고,
스토어 검색 결과 격자에서 "픽셀 게임 여럿" 사이에 있을 때 가장 눈에 띈다.
**단점은 장르가 전혀 안 읽힌다는 것** — 피처 그래픽과 첫 스크린샷이 그 일을 대신해야 한다.

```
[paste the STYLE block here]

[TASK] Mobile game app icon master, 1024x1024 square.

Composition:
  - Dark indigo background (#0f0f1e) filling the entire canvas, with a very
    subtle dithered radial lift toward the center (#1a1030). Three steps maximum.
  - Centered: a heavy gold (#F2B33D) heater-shield shape, pixel-drawn with a
    1px darker gold outline. It occupies about 62% of the canvas height.
  - Splitting the shield vertically down its middle: a jagged purple rift
    (#B45AD6) crack, as if the shield has been torn open. The crack is narrow at
    the top and bottom, widest at the center, and glows with 3 dithered steps.
  - Nothing else.

Hard constraints:
  - Exactly two elements: the gold shield and the purple crack through it.
  - No text, no unit, no ornament, no gem, no wings.
  - The silhouette of the whole icon must be a clean shield shape — test this by
    filling everything with black and checking the outline is still recognizable.
  - At 48x48 the purple crack must still be visible against the gold.
  - No alpha channel. Fill to the corners.
  - Do not draw rounded corners.
```

---

### P4 — 안드로이드 적응형 아이콘 · 전경

**채택된 안이 정해진 뒤에** 돌린다. 산출: `en/icon-foreground.png` · 1024 × 1024 · **알파 있음**.

```
[paste the STYLE block here]

[TASK] Android adaptive icon FOREGROUND layer, 1024x1024, transparent background.

  - Draw ONLY the foreground element of the chosen icon design
    (A: the commander silhouette · B: the single unit silhouette and the fortress
     wall · C: the gold shield with its purple crack).
    Do not draw the background, the rift backdrop, or the lane bands.
  - CRITICAL: every opaque pixel must fall inside the centered 66% of the canvas
    (approximately 676x676). The outer 17% is masked away on some devices.
  - Keep the 1px gold (#F2B33D) rim light on the silhouette edge.
  - Background must be fully transparent (alpha 0). No semi-transparent pixels:
    alpha is 0 or 255.
```

### P5 — 안드로이드 적응형 아이콘 · 배경

산출: `en/icon-background.png` · 1024 × 1024 · **알파 없음**.

```
[paste the STYLE block here]

[TASK] Android adaptive icon BACKGROUND layer, 1024x1024, fully opaque.

  - A very simple field based on dark indigo (#0f0f1e).
  - A faint purple lift (#2a1245) brightening from the center outward,
    expressed as exactly 3 dithered steps.
  - At most a very faint hint of a vertical rift, on the assumption that the
    foreground layer will cover the center.
  - CRITICAL: add no detail. Devices may scale and parallax-shift this layer.
  - No alpha channel.
```

---

## 3. 피처 그래픽 프롬프트 — 2안

### 3.0 공통 산출물 사양

| 항목 | 값 |
|---|---|
| 크기 | 정확히 **1024 × 500** (오차 1px 도 거부된다) |
| 알파 | **없음** (24비트 PNG 또는 JPEG) |
| 파일명 | `en/play-feature-graphic-en.png` |
| **텍스트** | **배너에 굽지 않는다.** 로고는 §3.3 처럼 나중에 합성한다 |
| **안전 영역** | 중앙 **924 × 400** 안에 핵심 내용을 둔다 **[2차]** — 좌우 각 ~50px 은 잘릴 수 있다 |
| **금지 영역** | **중앙 상단 20%** 는 비워 둔다. Play 가 그 위에 재생 버튼 · UI 를 겹친다 |

> **영어권 플레이어에게 3초 안에 장르가 읽혀야 한다.** 그 3초를 이기는 것은
> 예쁜 배경이 아니라 **도식**이다 — 왼쪽에 지킬 것, 오른쪽에 오는 것, 사이에 레인.

---

### P6 — 안 A "방주 대 균열" (52 §2.5 계승 · 영문 로고 자리 확보)

```
[paste the STYLE block here]

[TASK] Google Play feature graphic, exactly 1024x500, landscape banner.

Composition — reads left to right:
  - Background: a horizontally scrolling ruined landscape in silhouette.
    The bottom third is ground. The left side is dark (#0f0f1e); purple
    (#2a1245) bleeds in progressively toward the right.
  - Right third: an enormous vertical torn purple rift. Silhouetted shapes
    pour out of it toward the left.
  - Left third: part of the ark — a fortress silhouette with a few gold
    (#F2B33D) lamps.
  - Center: one commander silhouette facing the rift, standing on the ground
    line, with a gold aura circle drawn flat on the ground at their feet.
  - Three faint horizontal ground lines run across the whole banner, so the
    three-lane structure is legible without any labels.

Hard constraints:
  - Do NOT render any text, letters, numbers, or logo. Text is composited later
    and would be cropped at some placements.
  - Leave the upper-center 20% of the banner comparatively empty — the store
    overlays UI there.
  - Leave the left 30% visually calm: a logo lockup will be composited there.
  - All figures are silhouettes with a 1px rim light. No facial detail.
  - Exactly 1024x500. No border, no frame, no rounded corners.
```

**의도.** 이미 있는 한국어 배너와 같은 구도라 **게임과 스토어의 그림이 어긋나지 않는다.**
좌측 30%를 비워 두는 것은 영문 로고 `RIFT ARK` 가 한글 락업보다 가로로 길기 때문이다.

---

### P7 — 안 B "레인 단면" (장르를 도식으로 말하는 안)

```
[paste the STYLE block here]

[TASK] Google Play feature graphic, exactly 1024x500, landscape banner.

Composition — a clean side-on cross-section of one battle:
  - Background: dark indigo (#0f0f1e) sky with a dithered purple haze on the right.
  - Three clearly separated horizontal lanes fill the middle 70% of the height.
    Each lane has its own ground strip and a slightly different dark tone.
  - Above the lanes, an open air band: two winged enemy silhouettes flying left.
  - Left 25%: the ark fortress silhouette, gold-lamplit, spanning all three lanes.
  - Right 20%: a vertical purple rift spanning all three lanes.
  - In each lane, 2-3 small unit silhouettes advance from the right and 2-3
    defender silhouettes hold from the left, meeting near the middle.
  - Under every left-side (friendly) silhouette, draw a filled sky-blue ellipse
    on the ground. Under every right-side (enemy) silhouette, draw a hollow red
    ring. These ground markers are the game's real side-identification device
    and must be visible.
  - One larger commander silhouette stands in the middle lane with a flat gold
    aura circle on the ground around them.

Hard constraints:
  - Do NOT render any text, letters, numbers, HUD, health bars, or logo.
  - Leave the upper-center 20% comparatively empty.
  - Leave the left 25% calm enough for a logo lockup to be composited later.
  - Silhouettes only, 1px rim lights, no facial detail.
  - Exactly 1024x500.
```

**의도.** 아이콘 안 C(추상 문장)를 골랐다면 **이쪽을 쓴다** — 장르 설명의 부담이
전부 배너로 넘어오기 때문이다. 발밑 피아 표식을 배너에까지 넣는 이유는
스토어에서 본 규칙이 게임 안에서 그대로 통해야 하기 때문이다
(`19-art-audio-direction.md` §2.4-A).

### 3.3 로고 합성

배너 위에 `logo-en.png`(1024 × 512, 알파) 를 얹는다. **축소이므로 `nearest` 를 쓰지 않는다**
(52 §3.0 ⑤ — 축소에 nearest 를 쓰면 1px 선이 사라진다).

```
- Background : en/play-feature-graphic-en.png  (1024x500)
- Logo       : logo-en.png resized to width 340px, Lanczos (NOT nearest)
- Position   : x = 56, y = 52   (left third, upper area)
- Output     : en/play-feature-graphic-en.png (overwrite in place, keep 1024x500)
- Assert     : output is exactly 1024x500, 24-bit, no alpha channel
```

---

## 4. 스크린샷 오버레이 카피 (영문)

### 4.1 8장이 각각 무엇을 증명하는가

장면 8개는 **파이프라인의 `SCENES` 상수와 1:1로 고정**되어 있다 (§0.3). 바꾸지 않는다.

| # | 장면 | 라우트 | 증명하는 것 | 영어 카피 | 한국어 뜻 | 자수 |
|---|---|---|---|---|---|---|
| 1 | 전투 한복판 | `#/battle/2-4` | **레인 디펜스가 무엇인가** | `Three lanes and the sky. Hold them all.` | 세 레인과 하늘. 전부 지켜라 | 39 |
| 2 | 지휘관 오라 | `#/battle/3-2` | **시그니처 메커니즘** | `Special abilities only work inside your aura.` | 특수능력은 오라 안에서만 켜진다 | 45 |
| 3 | 각인 드래프트 | `#/battle/2-7` | 매판 다른 빌드 | `One of three sigils, every wave.` | 웨이브마다 각인 셋 중 하나 | 32 |
| 4 | 보스 | `#/battle/2-10` | 스케일과 페이즈 | `Every boss phase changes its weakness.` | 보스는 페이즈마다 약점이 바뀐다 | 38 |
| 5 | 편성 | `#/loadout` | **50 중 6 — 배제가 결정** | `50 companions. You take six.` | 동료 50종 중 6종만 데려간다 | 28 |
| 6 | 동료 상세 | `#/companions` | 성장 축 | `One currency. Three ways to grow.` | 재화 하나, 성장 세 갈래 | 33 |
| 7 | 방주 | `#/ark` | 전투 밖 루프 | `Rebuild the ark between runs.` | 출격 사이에 방주를 재건한다 | 29 |
| 8 | 출격/난이도 | `#/stages` | **분량 + 최대 차별점** | `100 stages. No ads. No IAP. No gacha.` | 100 스테이지. 광고·결제·확률형 없음 | 38 |

> ★★ **8번을 두 겹으로 쓴다.** 원래 한국어판은 7 = 분량, 8 = 부재 보장이었다.
> 영어권에서는 **"No ads. No IAP. No gacha." 가 이 게임의 최대 무기**이고,
> 스토어 캐러셀에서 8번째 장까지 넘겨 보는 사람이 적으므로 **분량과 함께 묶어
> 앞당긴다.** 7번은 방주(전투 밖 루프)로 내렸다.
>
> ★ **이 네 문장은 전부 코드로 강제된 사실이다** — 확률형 금지는 `CLAUDE.md`
> 절대규칙 6, 광고·결제 SDK 는 저장소에 존재하지 않고, 네트워크 통신이 0 이다.
> **검증 불가 주장이 아니라 검증된 부재다.** 그래서 §6 의 금지에 걸리지 않는다.

### 4.2 카피 작성 규칙 (영어권)

| | |
|---|---|
| 길이 | **48자 이내 · 한 줄.** 넘으면 문장을 자른다. 두 줄로 접지 않는다 |
| 문장 형태 | **마침표로 끊는 짧은 평서문.** 쉼표로 이어 붙이지 않는다 |
| 폭 | 영어는 한글의 약 절반 폭이다 → **폰트 크기를 한국어판(5.5vh)보다 키운다 (6.2vh)** |
| 대문자 | 문장 첫 글자만. **ALL CAPS 금지** (픽셀 폰트에서 자간이 무너진다) |
| 숫자 | 아라비아 숫자로 쓴다 (`50`, `100`) — 3초 안에 읽힌다 |
| 위치 | 상단 6% · 하단 8% 는 비워 둔다 (한국어판과 동일) |
| 금지 | `best` · `#1` · `top` · `free` · `ultimate` · `addictive` · 다른 게임 이름 |

---

### P8 — Codex 지시서: 영어 스크린샷 세트 (**코딩 작업**)

> **이것은 이미지 프롬프트가 아니라 코딩 지시다.** 기존 파이프라인에 언어 축을 더한다.

````
[TASK — RIFT ARK: add an English language axis to the store screenshot pipeline]

Repo: <repo>   App code: FE/

The Korean pipeline already exists and works. DO NOT rewrite it and DO NOT add a
second capture script. Add a `--lang` flag to the three existing scripts.

Read first (do not restate their values, follow them):
  docs/06-release/52-store-image-codex-prompts.md  §3.0  (viewport, scale factor,
      injection handles, resize kernels — all measured values, do not re-derive)
  docs/06-release/54-english-store-art-codex-prompts.md  §0.2, §0.3, §4

────────────────────────────────────────────
[1] tools/store-copy.json

  - The file already has 8 rows with `id`, `ko`, `en`. Keep exactly that shape.
  - Replace the `en` values with the 8 English lines from 54 §4.1.
  - Do not add rows, do not rename keys, do not create a second copy file.
    This file is the single source of truth for screenshot copy.

────────────────────────────────────────────
[2] tools/capture-store-shots.mjs

  - Add `--lang <ko|en>`, default `ko`. Korean behaviour must be byte-identical
    to today when the flag is absent.
  - Language config lives in ONE constant object near the top:
        ko: { copyKey: 'ko', fontSize: '5.5vh', outDir: 'raw',    htmlLang: 'ko' }
        en: { copyKey: 'en', fontSize: '6.2vh', outDir: 'en/raw', htmlLang: 'en' }
    English is roughly half the width of Korean at the same font size, so the
    English overlay uses a larger size. Do not hardcode the size in the overlay
    builder — read it from this object.
  - Set the overlay element's `lang` attribute from `htmlLang`.
  - Everything else is unchanged: same SCENES array, same viewports, same
    deviceScaleFactor, same port 5199, same CDP port 9333, same freeze-before-
    capture behaviour, same Chrome/Vite cleanup in the `finally` block.

────────────────────────────────────────────
[3] tools/compose-store-shots.mjs

  - Add the same `--lang` flag.
  - en outputs:  FE/asset/generated/store/en/play/play-screenshot-1..8.png
                 FE/asset/generated/store/en/ios/ios-69-1..8.png
  - ko outputs are unchanged.
  - Resize rules are unchanged: integer-only nearest for enlargement, Lanczos
    (sharp default) for reduction.

────────────────────────────────────────────
[4] tools/check-store-shots.mjs

  - Add the same `--lang` flag and check the matching directories.
  - Extend the forbidden-copy check so it runs against the correct column:
      ko column: keep the existing Korean word list unchanged.
      en column: fail if any of these appear (case-insensitive, word boundary):
        "gacha", "loot box", "lootbox", "battle pass", "season pass",
        "idle", "afk", "offline rewards", "shop", "store currency",
        "gems", "energy", "stamina", "watch an ad", "rewarded",
        "best", "#1", "number one", "top-rated", "ultimate", "free"
    EXCEPTION: the exact phrases "No ads.", "No IAP.", "No gacha." are the
    product's guaranteed-absence claims. Strip those three exact phrases from
    the string BEFORE running the word check — mirror how the Korean check
    already strips "광고 없음".
  - Nothing else about the checker changes.

────────────────────────────────────────────
[5] package.json — add exactly three scripts, do not modify the existing three:
      "store:capture:en", "store:compose:en", "store:check:en"

────────────────────────────────────────────
[Constraints]
  - Files you own: tools/capture-store-shots.mjs, tools/compose-store-shots.mjs,
                   tools/check-store-shots.mjs, tools/store-copy.json,
                   package.json (3 added script lines only)
  - Do not touch: src/ (all of it), docs/ (all of it), any other tools/*.mjs,
                  FE/asset/generated/store/play/, FE/asset/generated/store/ios/
  - Dev server port 5199. Port 5173 belongs to the user. CDP port 9333.
  - Kill Chrome and the Vite dev server when finished.
  - BREAK THE CHECKER ON PURPOSE before you commit: put the word "gacha" into an
    en copy line, run store:check:en, confirm it exits non-zero, then revert.
    A checker that has only ever passed has never guarded anything.
  - Report anything you could not do. Do not silently skip it.
````

---

### P9 — 영어 카피 감수 프롬프트 (원어민 톤 점검)

**의도.** §4.1 의 8줄은 한국어 원문의 뜻을 지키며 쓴 것이다. 영어권 스토어에서
**어색하지 않은지**만 따로 본다. ★ 이 프롬프트는 **문장을 바꾸라고 시키지 않는다** —
바꿀 이유가 있는 줄만 지적하게 한다. 바꾸면 §0.3 의 단일 출처를 흔든다.

```
[TASK] Review 8 store screenshot caption lines for a paid mobile game.

Context:
  - Genre: landscape lane defense (Paladog / Cartoon Wars lineage), pixel art.
  - Audience: English-speaking mobile players browsing a paid game listing.
  - Each line sits on top of a real gameplay screenshot, one line, no wrapping.
  - Hard limit: 48 characters including spaces.
  - The game's differentiator is the complete absence of ads, IAP, and gacha.

Lines:
  1. Three lanes and the sky. Hold them all.
  2. Special abilities only work inside your aura.
  3. One of three sigils, every wave.
  4. Every boss phase changes its weakness.
  5. 50 companions. You take six.
  6. One currency. Three ways to grow.
  7. Rebuild the ark between runs.
  8. 100 stages. No ads. No IAP. No gacha.

For EACH line, answer in this exact format:
  <n>. KEEP  — or —  <n>. CHANGE: "<replacement>" (<= 48 chars) because <reason>

Rules for any replacement you propose:
  - Never exceed 48 characters.
  - Never introduce a feature that is not in the list above.
  - Never use: best, #1, top, ultimate, addictive, free, must-play.
  - Prefer short declarative sentences ending in a period.
  - Keep the meaning identical. This is a tone review, not a rewrite.

Then state, in one sentence: which single line would make an English-speaking
player stop scrolling, and why.
```

---

## 5. 스토어 설명문 프롬프트

> ★★ **아래 프롬프트에는 게임의 사실이 데이터로 박혀 있다.** 그래야 AI 가 없는 기능을
> 지어내지 않는다. **숫자를 고칠 일이 생기면 프롬프트 안의 FACTS 블록을 고친다** —
> 이 저장소가 가챠·방치·상점을 광고하는 카피를 만든 적이 있고, 원인은 정확히
> "모델이 장르 상식으로 채운 것"이었다.

### 5.0 FACTS 블록 (세 프롬프트가 공유한다)

```
[FACTS — RIFT ARK. Everything below is verified in the shipping build.
 Do not add, infer, or embellish any feature that is not on this list.]

Genre        : landscape (horizontal) mobile lane defense, single player
Art          : HD pixel art, 16x16 and 32x32 sprites, limited palette
Business     : PAID app. One up-front purchase.
Content      : 100 stages across 5 worlds
               62 enemy types, 10 bosses (each with 3 phases)
               50 companions, of which 10 are guaranteed stage rewards and
                 40 are bought outright with gold at a fixed price
               18 sigils (in-run upgrades)
               12 commander spells, 4 equipped at a time
               3 difficulties: Normal, Hard, Nightmare
Battlefield  : 3 ground lanes plus an air lane. All four must be defended.
Loadout      : you own up to 50 companions but take exactly 6 into a stage
Signature    : the commander walks onto the field. Support-role abilities work
               only inside the commander's aura, and the commander's own melee
               range is SHORTER than that aura — so attacking means giving up
               ground that the aura was covering. The commander can be killed.
Roguelite    : after each wave you choose 1 of 3 sigils. Different every run.
Growth       : one currency only (gold). Three growth tracks: companion levels,
               4 ark facilities, and commander level (max 30) with 3 gear slots.
Meta         : a star tree funded by replaying earlier stages on higher difficulty
Nightmare    : each world adds exactly one deterministic rule (plague zones,
               binding ruptures, resource depletion). No random modifiers.
Saves        : 3 local save slots
ABSENT ON PURPOSE (never mention these as if they exist, and never imply them):
               no gacha, no loot boxes, no randomized rewards of any kind,
               no ads of any kind, no in-app purchases, no battle pass,
               no shop, no premium currency, no energy or stamina system,
               no daily quests, no login rewards, no idle or offline earnings,
               no PvP, no co-op, no guilds, no network connection at all
Privacy      : the game makes zero network requests. It works fully offline.
               It collects no data and requires no account.
```

---

### P10 — 앱 이름 (30자) · 부제 (30자) · 짧은 설명 (80자)

```
[paste the FACTS block here]

[TASK] Write App Store / Google Play short-form metadata in English (en-US)
for the game described in FACTS.

Produce exactly these, as a plain list — no commentary, no markdown:

A. APP NAME — 5 candidates, each <= 30 characters INCLUDING spaces.
   - Must begin with "RIFT ARK".
   - The remainder, if any, is a separator plus 1-3 words that say the genre.
   - Print the character count in parentheses after each candidate.

B. SUBTITLE (App Store, <= 30 chars) — 5 candidates.
   - Says what you DO, not what the game IS. Verb-first is preferred.
   - Print the character count after each.

C. SHORT DESCRIPTION (Google Play, <= 80 chars) — 5 candidates.
   - One sentence. It appears directly under the title in search results.
   - At least two of the five must lead with the absence of ads/IAP/gacha.
   - Print the character count after each.

D. KEYWORDS (App Store, <= 100 chars total, comma-separated, no spaces after
   commas) — 1 set.
   - Do not repeat words already in the app name or subtitle; Apple indexes
     those separately and repeats are wasted characters.
   - Do not use competitor game names or trademarked titles.
   - Print the total character count.

Hard rules for all of the above:
  - Never claim "best", "#1", "top", "ultimate", "award-winning", "addictive",
    or any ranking or superlative.
  - Never use the word "free" — this is a paid app.
  - Never name another game.
  - No emoji. No Unicode symbol glyphs. ASCII punctuation only.
  - Never mention a feature that is not in FACTS.
```

---

### P11 — 긴 설명 (4,000자)

```
[paste the FACTS block here]

[TASK] Write the English (en-US) long store description for the game in FACTS.
Target 1,800-2,600 characters. Hard ceiling 4,000 including spaces.
Print the final character count on the last line.

Structure, in this order:

1. HOOK — 2 sentences, max 220 characters total.
   Say what the player does. Do not open with "Welcome to" or "Embark on".

2. LANGUAGE NOTICE — one short paragraph, plain and unhedged:
      "The game's on-screen text is currently Korean. An English localization is
       in progress. All gameplay is language-independent."
   ★ INCLUDE THIS PARAGRAPH ONLY IF THE TASK GIVER SAYS OPTION B.
     If they say option C, delete this section entirely and renumber.

3. WHAT MAKES IT DIFFERENT — 4 to 6 short bullet lines, each one sentence:
   - the commander aura, and the fact that attacking with the commander costs
     you the aura coverage that was keeping your support units working
   - taking 6 of 50 companions, so exclusion is the actual decision
   - the sigil draft making every run's build different
   - three lanes plus an air lane
   - Nightmare being deterministic rules rather than bigger numbers

4. WHAT IS NOT IN THIS GAME — a short, blunt block. This is the strongest
   section for this audience, so do not soften it:
      No ads. No in-app purchases. No gacha. No loot boxes.
      No battle pass. No energy system. No daily login rewards.
      No account. No network connection. It works on a plane.
   Follow it with ONE sentence explaining that you pay once and own the game.

5. CONTENT AT A GLANCE — the numbers from FACTS as a compact list.

6. CLOSING — 2 sentences. No call to action beyond a plain statement.

Hard rules:
  - Every factual claim must be traceable to FACTS. Invent nothing.
  - No superlatives, no rankings, no "best", "#1", "top", "ultimate".
  - Never use the word "free".
  - Never name or evoke another game, character, or franchise.
  - No emoji, no Unicode symbol glyphs, no ASCII-art dividers. Plain text and
    hyphen bullets only — Google Play strips most formatting and Apple shows
    plain text.
  - Do not write a "coming soon" or "roadmap" section. Only ship what exists.
  - Do not write review-bait ("please rate us five stars"). Apple rejects it.
```

---

### P12 — 프로모션 텍스트 (170자) · 릴리스 노트

```
[paste the FACTS block here]

[TASK] Write two short English (en-US) store fields for the game in FACTS.

A. PROMOTIONAL TEXT (App Store, <= 170 characters) — 3 candidates.
   - This field can be updated WITHOUT submitting a new build, so it must not
     describe anything version-specific.
   - It appears above the description. Treat it as the second hook.
   - Print the character count after each candidate.

B. RELEASE NOTES for version 1.0 — 3 candidates, each <= 400 characters.
   - This is a first release, so do not write a changelog.
   - State what the game is in 2-3 lines, plainly.
   - Do not thank the player for updating. There is nothing to update from.

Hard rules:
  - No superlatives, no rankings, no "free", no other game names.
  - No emoji, no Unicode symbol glyphs.
  - Nothing outside FACTS.
```

---

## 6. 하지 말 것

| # | 금지 | 왜 |
|---|---|---|
| ① | **실제 게임에 없는 화면·기능을 그리는 것** | App Store 가이드라인 2.3.x(정확한 메타데이터) · Play 의 같은 취지 정책. **이 저장소는 이미 이 사유로 스크린샷 32장을 폐기했다** (52 §0-A) |
| ② | **스크린샷을 생성하는 것** | 스크린샷의 본체는 **반드시 실제 실행 화면 캡처**다. 위에 카피를 얹는 것까지만 허용된다 (52 §0) |
| ③ | **절삭된 기능을 광고하는 것** | 가챠 · 상점 · 배틀패스 · 광고 · 출석 · 일일퀘스트 · 방치 · 파견 · 던전 · 탑 · 도감 — 전부 2026-08-04 에 삭제됐다 (`04-plan/34-scope-cut.md`). 검사기가 카피에서 이 단어들을 잡는다 |
| ④ | **다른 게임의 IP · 캐릭터 · 로고를 연상시키는 것** | 프롬프트마다 명시했다. 이미지 모델은 시키지 않으면 학습한 유명 캐릭터를 섞는다 |
| ⑤ | **`free` · `best` · `#1` · `top` · `ultimate` · `addictive`** | 검증 불가 주장. 그리고 `free` 는 **유료 앱에서 사실이 아니다** |
| ⑥ | **이모지 · 유니코드 글리프** | `CLAUDE.md` 절대규칙 5 와 같은 이유 — 기기마다 글리프가 다르고 일부는 두부(□)가 된다. 스토어 설명문도 예외가 아니다 |
| ⑦ | **기기 프레임(아이폰 목업) 합성** | 스토어가 거부한다 |
| ⑧ | **한국어 세트 위에 덮어쓰는 것** | §0.2. 어느 쪽이 올라갔는지 알 수 없게 된다 |
| ⑨ | **새 캡처 스크립트를 만드는 것** | §0.3. 뷰포트·배율·장면이 갈라진다 |
| ⑩ | **태블릿 · iPad 스크린샷을 지금 만드는 것** | 지원을 검증한 적이 없다. 올리면 **선언**이 된다 (§1.1 · `51 §5.4`) |
| ⑪ | **`No ads. No IAP. No gacha.` 를 빼는 것** | 이 게임의 최대 차별점이고, **코드로 강제된 사실**이다. 안 쓰면 손해다 |

---

## 7. 제출 전 체크리스트

### 7.1 결정

- [ ] **§0-A 를 A · B · C 중 하나로 정했다**
- [ ] B 를 골랐다면 긴 설명에 **LANGUAGE NOTICE 문단이 실제로 들어 있다**
- [ ] 태블릿 · iPad 세트를 **낼지 안 낼지** 정했다 (권장: 첫 출시는 폰 전용)

### 7.2 아이콘

- [ ] 3안을 각각 **5장 이상** 뽑아 **48 × 48 시험**으로 골랐다
- [ ] `icon.png` 1024 × 1024 · **알파 없음** · 둥근 모서리 없음 · **텍스트 없음**
- [ ] `icon-512.png` 512 × 512 · **32비트 · ≤ 1,024 KB** · 전 픽셀 불투명 (§1.1 경고)
- [ ] 적응형 전경의 불투명 픽셀이 **전부 중앙 66%(676 × 676) 안**에 있다
- [ ] 확대해서 봤을 때 **안티앨리어싱된 픽셀이 없다**

### 7.3 피처 그래픽

- [ ] 정확히 **1024 × 500** · 24비트 · **알파 없음**
- [ ] **배너에 텍스트가 구워져 있지 않다** (로고는 좌측에 합성)
- [ ] 중앙 상단 20% 가 비어 있다
- [ ] 핵심 내용이 중앙 **924 × 400** 안에 있다

### 7.4 스크린샷 (영어 세트)

- [ ] **전부 실제 게임 실행 화면 캡처다** ← 반려 사유 1순위
- [ ] `en/play/` 8장 = **1920 × 1080** · `en/ios/` 8장 = **2868 × 1320**
- [ ] **한국어 세트(`play/` · `ios/`)를 덮지 않았다**
- [ ] `npm run store:check:en` 이 통과한다
- [ ] ★ **그 검사기를 일부러 깨뜨려(en 카피에 `gacha` 를 넣어) 실패를 봤다**
- [ ] 카피가 **48자 이내 · 한 줄**이고 접히지 않았다
- [ ] 카피가 상단 6% · 하단 8% 를 침범하지 않는다
- [ ] FPS · 디버그 오버레이가 **한 장도 없다**
- [ ] 빈 화면 · 로딩 중 · 슬롯 미선택 화면이 **없다**
- [ ] 1번 장면에서 **아군 하늘색 타원과 적 붉은 링이 갈린다** (기계가 판정 못 한다 — 눈으로 본다)
- [ ] 투명 픽셀이 0개다

### 7.5 텍스트

- [ ] 앱 이름 ≤ 30 · 부제 ≤ 30 · 짧은 설명 ≤ 80 · 긴 설명 ≤ 4,000 · 키워드 ≤ 100 · 프로모션 ≤ 170
- [ ] **콘솔 입력란의 카운터로 다시 셌다** (§1.3 — 그것이 최종 권위)
- [ ] `free` · `best` · `#1` · `top` · `ultimate` 가 **한 번도 안 나온다**
- [ ] 이모지 · 유니코드 글리프가 **하나도 없다**
- [ ] 설명문의 **모든 사실이 FACTS 블록에서 나온 것**이다
- [ ] 절삭된 기능(가챠 · 상점 · 배틀패스 · 광고 · 방치)이 **한 번도 언급되지 않는다**
- [ ] `No ads. No IAP. No gacha.` 가 **짧은 설명과 긴 설명 양쪽에** 있다
- [ ] 한국어판과 영어판이 **같은 게임을 설명한다** (기능 목록이 갈라지지 않았다)

---

## 관련 문서

| 무엇 | 어디 |
|---|---|
| **스토어 이미지 정본 · 픽셀 규칙 · 캡처 파이프라인** | `06-release/52-store-image-codex-prompts.md` |
| Google Play 등록 절차 | `06-release/50-google-play-paid-codemagic.md` |
| App Store 등록 절차 (iPad 판정 §5.4) | `06-release/51-app-store-paid-codemagic.md` |
| **현재 재촬영 대상·광고 활성화 시 교체 카피** | `06-release/57-store-image-recapture-register.md` |
| 아트·오디오 방향 (피아 표식 · 팔레트) | `02-design/19-art-audio-direction.md` |
| 무엇이 왜 없는지 | `04-plan/34-scope-cut.md` |
| 남은 작업 로드맵 | `04-plan/35-remaining-work-roadmap.md` |
