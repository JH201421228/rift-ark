# 33. 실행 계획 — 티켓 단위 로드맵

> `30-roadmap.md` 가 **마일스톤 지도**라면, 이 문서는 **실제로 하나씩 처리할 작업 목록**이다.
> 모든 티켓은 독립적으로 검증 가능하고, 각 티켓이 끝날 때마다 **앱은 실행 가능한 상태**로 남는다.

---

## 0. 실행 원칙

| # | 원칙 | 이유 |
|---|---|---|
| 1 | **항상 실행 가능한 상태를 유지한다.** 티켓 하나가 끝나면 `npm run dev` 가 뜬다 | 며칠간 빌드가 깨진 상태로 두면 문제 원인 추적이 불가능해진다 |
| 2 | **수직으로 먼저, 수평으로 나중에.** 스테이지 1개를 끝까지 완성한 뒤 200개로 늘린다 | 재미 없는 코어에 콘텐츠를 얹는 것이 이 장르 실패의 표준 경로 |
| 3 | **시뮬 → 렌더 → UI 순서.** 로직이 없는 화면을 먼저 만들지 않는다 | 로직이 확정되지 않으면 UI를 두 번 만들게 된다 |
| 4 | **각 티켓의 DoD를 눈으로 확인하고 넘어간다** | "될 것이다"로 넘어간 것들이 나중에 한꺼번에 터진다 |
| 5 | **P3 게이트 전까지 콘텐츠를 만들지 않는다** | `31-risk-register.md` D1 |

### 티켓 표기

```
P0-03  [M]  제목
       선행: P0-01, P0-02
       파일: src/game/config.js (교체)
       DoD:  가로 캔버스가 화면에 나타난다
```

크기: **S** = 1시간 이내 · **M** = 반나절 · **L** = 1–2일 · **XL** = 3일 이상(더 쪼갤 것)

---

## 1. 전체 지도

> ### ★★ 범위 절삭 (2026-08-04) — **P7(수익화) 산출물은 전부 제거됐다**
>
> 아래 표의 **P7 은 "FTUE & 수익화"였고, 그중 수익화 산출물은 저장소에 남아 있지 않다.**
> P5(메타)의 승급 · 장비 · 소유 효과 · 방치 · 파견, P6(콘텐츠)의 변주 모드 3종 ·
> 던전 · 탑 · 시험도 같이 제거됐다.
>
> **아래 티켓 목록은 "그때 무엇을 어떤 이유로 만들었는가"의 기록으로 남긴다.**
> 지금 무엇이 존재하는지는 [`34-scope-cut.md`](34-scope-cut.md) 가 답한다 —
> 티켓의 DoD 를 "현재 상태"로 읽지 말 것.

---

> ### ★ 방침 전환 (2026-08-03) — **게임 완성이 먼저다**
>
> 아래 표의 P8(소프트런칭) · P9(소셜·라이브옵스)는 **재정의 또는 연기**됐다.
> 외부 테스터도 실플레이어도 스토어 계정도 없으므로, 그것을 요구하는 게이트는
> 영원히 열리지 않는다. **모든 게이트를 이 저장소 안에서 재현 가능한 것으로 바꾼다.**
> 상세: `30-roadmap.md` §0 · 이 문서의 P3 게이트 · P8 · P10 절.

| Phase | 이름 | 티켓 | 기간 | 종료 시 상태 | 마일스톤 |
|---|---|---|---|---|---|
| **P0** | 부팅 가능 상태 | 11 | 3–4일 | 실기기에서 가로 빈 화면이 뜬다 | M0 |
| **P1** | 파이프라인 & 기반 | 12 | 1주 | 에셋이 로드되고 세이브가 유지된다 | M0 |
| **P2** | 시뮬레이션 코어 | 14 | 2주 | 헤드리스로 전투가 완주된다 | M1 |
| **P3** | 렌더 & 감촉 ★ | 15 | 2주 | **스테이지 1개가 재밌다** | **M1 게이트** |
| **P4** | 각인 & 밸런스 하네스 | 12 | 2주 | 기획자가 밸런싱을 자립 수행 | M2 |
| **P5** | 메타 & 방주 | 13 | 2주 | 전투 밖 성장 루프 완성 | M2 |
| **P6** | 콘텐츠 확장 | 14 | 4주 | 월드 1–5, 보스 5체 | M3 |
| **P7** | FTUE & 수익화 | 16 | 4주 | ~~소프트런칭 가능~~ **수익화 산출물 제거됨 (2026-08-04)** | M3 |
| **P8** | **게임 완성** ★재정의 | 6 | — | 만들었는데 못 쓰는 것 0개 · 신규 계정 완주 | M4 |
| **P9** | **마감 품질** ★재정의 | 5 | — | 실기기에서 견딘다 | M5 |
| ~~P10~~ | ~~소셜 · 라이브옵스 · 글로벌~~ | — | — | **연기** — 사용자 플레이 이후 | — |

**총 130 티켓 / 약 32주.**

### 지금 남은 작업 (2026-08-04 기준)

| 티켓 | 상태 |
|---|---|
| **P7-03** 1-9 패배의 質 | 구조적으로 규명됨 · **사용자가 직접 져 본 뒤** 설계 결정 |
| **P9-01~03** 실기기 검증 | 안드로이드 기기가 연결되면 즉시 |

그 밖의 모든 티켓은 완료됐거나 [`34-scope-cut.md`](34-scope-cut.md) 로 제거됐다.

> **절삭 이후에 추가된 것** (2026-08-04, 사용자 요청 · 상세는 `34-scope-cut.md` 말미):
> 타이틀 화면 + **세이브 슬롯 3** · **가이드 오버레이 19주제** ·
> 방주 = 홈 대시보드 · **탭 점진 공개** · 동료 영입(로스터 50종).
> 각각 검사기와 테스트를 함께 만들었다 — `data:validate` 의 영입 · 가이드 절,
> `guide.test.js` · `slots.test.js` · `renderSafety.test.js` · `scenes.test.js`.
>
> ⛔ **그리고 단계별 튜토리얼(FTUE)은 삭제됐다** (2026-08-04). 아래 P7-01/02 티켓은
> **역사 기록**이다 — 무엇이 계속 깨졌고 왜 지웠는지는 `34-scope-cut.md` ⑨ 에 있다.

---

## P0 — 부팅 가능 상태 (3–4일)

> **목표: 실기기에서 가로로 고정된 빈 Phaser 캔버스가 뜬다.**
> 현재는 빌드조차 안 된다. 이 Phase가 모든 것의 선행이다.

### P0-01 [S] 크레딧 표기 목록 작성
```
선행: 없음
산출물: docs/legal/ATTRIBUTIONS.md
작업:
  - ★ 에셋 라이선스 리스크는 해소됨 (2026-08-02, 전량 자유 사용 확인)
  - 01-research/04-license-audit.md §2 의 팩별 원작자 정보를 크레딧 형식으로 정리
  - 크레딧이 의무가 아닌 팩도 전부 기재 (비용 0, 예의)
  - P7-15 "설정 > 라이선스" 화면의 원본 데이터가 된다
DoD: ATTRIBUTIONS.md 가 존재하고 전 팩이 기재되어 있다
크기: S  ※ 병렬 진행. 더 이상 출시 블로커가 아니다
```

### P0-02 [S] 빌드 복구 — 죽은 import 제거
```
선행: 없음
파일: src/game/GameManager.js (수정), src/pages/MainPage/MainPage.jsx (수정)
작업:
  - GameManager.js 의 `import { AudienceRoomScene } from "./scenes/AudienceRoomScene.js"` 제거
  - scene 배열을 빈 배열로 임시 대체
  - MainPage.jsx 의 `return;` → `return <div />`  (undefined 반환은 React 에러)
DoD: npm run dev 가 에러 없이 뜨고 흰 화면이 보인다
크기: S
```

### P0-03 [M] Phaser 설정 가로 전환
```
선행: P0-02
파일: src/game/config.js (전면 교체)
작업:
  - 03-tech/20-architecture.md §5 의 설정으로 교체
  - DESIGN = { width: 640, height: 360 }, Scale.FIT, CENTER_BOTH
  - LANES 상수 추가 (air y=112, ground y=[160,208,256], arkX=48, riftX=592)
  - AUDIENCE_LAYOUT 삭제 (세로 좌표계 잔재)
  - 저사양 렌더러 폴백 (hardwareConcurrency <= 4 || deviceMemory <= 2 → CANVAS)
DoD: config 가 1280x720 가로를 반환한다. 아직 화면에는 안 보여도 된다
크기: S
```

### P0-04 [M] EventBus + PhaserGame 컴포넌트
```
선행: P0-03
파일: src/game/EventBus.js (신규), src/components/PhaserGame.jsx (신규)
작업:
  - EventBus = new Phaser.Events.EventEmitter()
  - PhaserGame: useLayoutEffect 로 gameManager.init(ref), 클린업에서 destroy
  - useEffect 가 아니라 useLayoutEffect 여야 한다 (Scale Manager 가 0x0 을 읽는 것 방지)
DoD: 컴포넌트가 마운트되면 canvas 엘리먼트가 DOM 에 생긴다
크기: S
```

### P0-05 [M] App 셸 재작성
```
선행: P0-04
파일: src/App.jsx (전면 교체), src/index.css (교체), src/App.css (삭제)
작업:
  - Vite 템플릿(로고·카운터) 전부 제거
  - <PhaserGame /> + <div id="ui-overlay"> 레이아웃
  - 25-capacitor-mobile.md §4.2 의 전역 CSS 적용
    (overflow hidden, touch-action none, user-select none, overscroll-behavior none)
  - #ui-overlay 에 pointer-events: none, .interactive 에만 auto
DoD: 브라우저에서 가로 1280x720 캔버스가 중앙 정렬되어 보인다 (배경 #0f0f1e)
크기: M
```

### P0-06 [S] StrictMode + HMR 가드
```
선행: P0-05
파일: src/main.jsx (수정), src/game/GameManager.js (수정)
작업:
  - main.jsx 에 <StrictMode> 추가
  - GameManager.js 하단에 import.meta.hot.dispose(() => gameManager.destroy())
  - init() 재진입 시 기존 인스턴스 파괴 로직 확인
DoD: 개발 모드에서 캔버스가 1개만 생긴다. HMR 후에도 1개
크기: S
```

### P0-07 [M] Capacitor 플러그인 설치 & 설정 정리
```
선행: P0-05
파일: capacitor.config.json (교체), package.json
작업:
  npm i @capacitor/app @capacitor/preferences @capacitor/screen-orientation \
        @capacitor/status-bar @capacitor/splash-screen @capacitor/haptics \
        @capacitor-community/safe-area
  - capacitor.config.json 을 25-capacitor-mobile.md §2 로 교체
  - bundledWebRuntime 제거 (Capacitor 3 잔재)
DoD: npx cap sync 성공
크기: S
```

### P0-08 [M] 네이티브 가로 고정
```
선행: P0-07
파일: android/app/src/main/AndroidManifest.xml, ios/App/App/Info.plist,
      src/native/bootstrap.js (신규)
작업:
  - Manifest <activity> 에 android:screenOrientation="sensorLandscape"
  - configChanges 에 orientation|screenSize 유지 확인 (없으면 회전 시 WebView 파괴)
  - bootstrap.js: ScreenOrientation.lock + StatusBar.hide (실패해도 게임은 진행)
  - iOS: Deployment Info 에서 Portrait 해제
DoD: 실기기에서 앱이 가로로 시작하고, 세로가 잠깐도 보이지 않는다
크기: M
```

### P0-09 [S] index.html 뷰포트 & 메타
```
선행: P0-05
파일: index.html (수정)
작업:
  - viewport-fit=cover, user-scalable=no, maximum-scale=1.0
  - theme-color, mobile-web-app-capable
  - title 을 게임명으로
  - window.__t0 = performance.now() 삽입 (콜드 스타트 측정용)
DoD: 노치 기기에서 캔버스가 풀블리드로 렌더된다
크기: S
```

### P0-10 [S] 게임 타이틀 확정
```
선행: 없음
산출물: docs/02-design/10-GDD.md §3.3 갱신, capacitor.config.json appName
작업:
  - 상표 검색 (KIPRIS, USPTO)
  - 앱스토어/구글플레이 동명 검색
  - "방치형·디펜스·키우기" 키워드 클러스터와의 ASO 적합성 확인
DoD: 타이틀 확정 및 전 문서 반영
크기: S  ※ 병렬 진행
```

### P0-11 [S] 한글 픽셀 폰트 적용
```
선행: 없음
파일: src/index.css
작업:
  - ★ 폰트 검증 완료 (2026-08-02):
      asset/fonts/base_font.woff2 = 물마루 모노 (Mulmaru Mono, by Mushsooni)
      한글 음절 11,172자 전체 포함 · 호환 자모 51자 · 총 11,940 글리프
      unitsPerEm 192 (픽셀 그리드) · 98KB · 서브셋팅 불필요
  - @font-face 등록 + font-family 변수 정의
  - Phaser 텍스트에서도 동일 폰트 사용하도록 설정
DoD: "균열의 방주 지휘관" 이 DOM 과 Phaser 양쪽에서 깨지지 않고 렌더된다
크기: S
```

> ### ✅ P0 게이트 — 2026-08-02 검증
> - [x] `npm run dev` 정상, `npm run lint` **경고 0**
> - [x] `npm run build` 성공 — JS **gzip 436KB** (목표 1.5MB 대비 여유)
> - [x] `npx cap sync` 성공 — 플러그인 7종 android/ios 등록
> - [x] 브라우저에서 **가로 1280×720 캔버스 중앙 정렬**
> - [x] **캔버스 1개** (StrictMode 중복 없음, HMR dispose 가드 동작)
> - [x] 한글이 DOM·Phaser 양쪽에서 렌더 — 물마루 모노, 픽셀 그리드 안착 확인
> - [x] 콜드 스타트 **~500–770ms** (데스크톱 dev 기준. ★ 실기기 재측정 필요)
> - [x] 전 화면비 레터박스 검증 — 20:9 / 16:9 / iPhone 15 Pro / iPad 4:3
> - [ ] **실기기에서 가로 고정 확인** ← 안드로이드 기기 연결 시 검증
> - [ ] **P0-10 타이틀 확정** ← 웹 검색 예산 소진으로 미완
>
> **실측 스케일**
> | 기기 | 뷰포트 | 배율 | 레터박스 |
> |---|---|---|---|
> | 20:9 안드로이드 | 2400×1080 | 1.50 | 좌우 각 240px (노치 흡수) |
> | 16:9 | 1920×1080 | 1.50 | 없음 |
> | iPhone 15 Pro | 2556×1179 | 1.64 | 좌우 각 230px |
> | iPad 4:3 | 1024×768 | 0.80 | 상하 각 96px |

---

## P1 — 파이프라인 & 기반 (1주)

> **목표: 에셋이 화면에 나오고, 상태가 저장되고, 테스트가 돈다.**

### P1-01 [L] 아틀라스 패킹 스크립트
```
선행: P0-05
파일: tools/pack-atlases.mjs (신규), tools/atlas-manifest.json (신규), package.json
작업:
  - npm i -D free-tex-packer-core
  - 23-asset-pipeline.md §3 의 스크립트 구현
  - manifest 초안: atlas-ui, atlas-units, atlas-fx, atlas-projectile
  - ★ icons/Separated Files/ 는 절대 포함하지 않는다 (6,576 낱장)
  - ★ effect/ 는 9색상행 중 1행만 (런타임 틴트로 색 변형)
  - 옵션: 2048², powerOfTwo, allowRotation false, allowTrim true, padding 2
DoD: npm run assets:pack 이 public/assets/atlas/ 에 png+json 생성.
     페이지 크기 2048 이하, 총 크기 로그 출력
크기: L
```

### P1-02 [M] 오디오 인코딩 스크립트
```
선행: 없음
파일: tools/encode-audio.mjs (신규)
작업:
  - ffmpeg 로 mp3 → ogg(96kbps 모노) + m4a(iOS 폴백)
  - 파일명 정규화 (공백/괄호 제거)
  - 중복 파일 1개 제외 (soundreality-...-471495 (1).mp3)
DoD: public/assets/audio/ 에 20곡 × 2포맷. 총 용량 로그
크기: M
```

### P1-03 [S] gitignore & assetUrl
```
선행: P1-01
파일: .gitignore, src/game/assetUrl.js (신규), vite.config.js
작업:
  - public/assets/atlas/, public/assets/audio/ 를 gitignore
  - __ASSET_VERSION__ define 추가
  - assetUrl(p) 헬퍼
DoD: 생성물이 커밋되지 않는다
크기: S
```

### P1-04 [L] Zustand 스토어 + 슬라이스 5종
```
선행: P0-05
파일: src/store/index.js, src/store/slices/{run,roster,meta,ui,settings}Slice.js
작업:
  - 21-state-management.md §1~2 그대로
  - subscribeWithSelector + persist
  - partialize 로 runSlice 제외 (★ 필수 — 반쯤 끝난 전투 복원 방지)
  - gameStore = { get, set, subscribe } 를 별도 export (Phaser 용)
  - 기존 빈 src/stores/ 디렉터리 삭제 (src/store 로 통일)
DoD: React 컴포넌트와 콘솔 양쪽에서 상태를 읽고 쓸 수 있다
크기: L
```

### P1-05 [M] Capacitor Preferences 영속화
```
선행: P1-04, P0-07
파일: src/native/storage.js (신규), src/App.jsx (수정)
작업:
  - capacitorStorage 어댑터 (Preferences 는 {value} 래핑이라 변환 필요)
  - hasHydrated() 게이팅 — 하이드레이션 전까지 라우터 렌더 보류
DoD: 값을 바꾸고 앱을 강제 종료 후 재실행하면 값이 유지된다 (실기기)
크기: M
```

### P1-06 [M] 생명주기 & 뒤로가기
```
선행: P1-05
파일: src/native/lifecycle.js (신규)
작업:
  - appStateChange: loop.sleep/wake, sound pause/resume, AudioContext.resume (★ iOS 필수)
  - pause 시 즉시 세이브 flush
  - backButton: 모달 → 일시정지 → 종료확인 순서
    ★ 리스너 등록 시 기본 동작이 비활성화되므로 모든 분기를 직접 처리해야 한다
DoD: 백그라운드 5분 후 복귀 정상. 뒤로가기가 앱을 즉시 종료하지 않는다
크기: M
```

### P1-07 [M] Boot / Preload 씬
```
선행: P1-01, P0-06
파일: src/game/scenes/BootScene.js, PreloadScene.js
작업:
  - Boot: 프로그레스 바 스프라이트만 (< 200KB)
  - Preload: 전역 아틀라스 + 진행률 표시
  - 완료 시 SplashScreen.hide() (launchAutoHide:false 이므로 수동)
DoD: 로딩 바가 채워지고 다음 씬으로 넘어간다. 흰 화면 플래시 없음
크기: M
```

### P1-08 [S] 콜드 스타트 계측
```
선행: P1-07
파일: src/utils/perf.js (신규)
작업:
  - window.__t0 부터 첫 인터랙티브 프레임까지 측정
  - 개발 콘솔 출력 + 나중에 분석 이벤트로
DoD: 실기기에서 실측값이 출력된다. ★ 목표 3초 — 이 시점부터 계속 감시
크기: S
```

### P1-09 [M] Vitest 설정
```
선행: 없음
파일: vite.config.js (test 블록), package.json
작업:
  - npm i -D vitest @vitest/coverage-v8
  - environment: 'node', include: src/**/*.test.js
  - coverage 대상은 src/game/logic/** 만, 임계 85%
DoD: npm run test 가 통과 (빈 테스트라도)
크기: S
```

### P1-10 [M] ESLint 강화 규칙
```
선행: P1-09
파일: eslint.config.js (수정)
작업:
  - src/game/logic/** : phaser/@store import 금지, Math.random/Date.now 금지,
    window/document/navigator 금지
  - scenes/logic : update() 안의 filter/map/reduce 금지, gameStore.set 직접 호출 금지
  - 28-coding-conventions.md §13 참조
DoD: 위반 코드를 넣으면 lint 가 실패한다
크기: M
```

### P1-11 [S] 스크립트 정리
```
선행: P1-01, P1-02, P1-09
파일: package.json
작업:
  - assets:pack, assets:audio, assets:all, prebuild
  - test, test:watch, test:coverage
  - data:validate, balance, balance:quick, balance:check (스텁이라도)
DoD: CLAUDE.md 의 명령 목록이 전부 동작하거나 명확히 "미구현" 표시
크기: S
```

### P1-12 [M] 라우터 & 화면 골격
```
선행: P1-04
파일: src/router/index.jsx, src/screens/*.jsx (빈 골격)
작업:
  - 20-architecture.md §8 의 경로 8개
  - 각 화면은 제목만 있는 플레이스홀더
  - Phaser 캔버스는 라우트와 무관하게 항상 마운트 (씬만 전환)
DoD: 하단 탭으로 화면 전환이 되고 캔버스는 재생성되지 않는다
크기: M
```

> ### ✅ P1 게이트 — 2026-08-02 검증
> - [x] `npm run assets:pack` — **1,617 프레임 / 5 페이지 / 1.9MB**, 전 페이지 2048 이하
> - [x] `npm run assets:audio` — 20곡 × 2포맷, 27.6MB → 18MB
> - [x] 아틀라스가 실제로 렌더됨 — 유닛 150종 + NPC 49종 프레임 이름 검증
> - [x] 세이브 영속화 — `partialize` 로 run/ui 제외 확인, 세이브 **817B**
> - [x] 새로고침 후 하이드레이션 복원, `run.phase` 는 `idle` 로 초기화
> - [x] 라우트 5회 전환에도 **Phaser 캔버스 동일 노드 유지**
> - [x] `npm run test` 7/7 통과, `npm run lint` 경고 0
> - [x] `npm run build` — JS **gzip 443KB**
> - [x] 린트 가드 실동작 검증 (logic/ 격리 4종, update() 안티패턴 2종)
> - [ ] **실기기 강제 종료 후 세이브 유지** ← 안드로이드 기기 필요
> - [ ] **실기기 백그라운드 복귀 + 오디오 재개** ← 안드로이드 기기 필요
>
> **발견·수정한 버그**
> | 증상 | 원인 | 조치 |
> |---|---|---|
> | 캔버스 2개 누수 | Phaser `destroy()` 가 다음 루프 스텝으로 미뤄지는데, StrictMode 이중 마운트에서는 첫 스텝 전에 파괴가 요청되어 `pendingDestroy` 가 영영 처리되지 않음 | `runDestroy()` 강제 + 잔존 캔버스 직접 제거 |
> | 아틀라스 프레임 이름이 전부 빈 문자열 | `removeFileExtension` 이 "마지막 점 이후 제거" 방식이라 점 없는 이름을 통째로 날림 | 프레임 경로에 `.png` 부착 + `prependFolderName` 동시 활성 |
> | 아이콘 시트 512×4384 | GPU 텍스처 상한 2048 초과 → 구형 기기 로드 실패 | 읽기 순서를 보존한 채 64열 재배치 → 2048×1120 |

---

## P2 — 시뮬레이션 코어 (2주)

> **목표: Phaser 없이 Node 에서 전투가 완주되고, 동일 시드가 동일 결과를 낸다.**
> 이 Phase 전체가 `src/game/logic/` 안에서 끝난다. 화면은 아직 없다.

### P2-01 [S] 시드 PRNG & 스트림 분리
```
파일: src/game/logic/rng.js + rng.test.js
작업: mulberry32, randInt, pick, shuffle. 스트림 4개 분리 (spawn/combat/sigil/fx)
DoD: 동일 시드 동일 수열. 스트림 간 오염 없음 테스트 통과
크기: S
```

### P2-02 [M] 상태 구조 & 엔티티
```
선행: P2-01
파일: src/game/logic/state.js, types.js (JSDoc typedef)
작업: 22-simulation-spec.md §3 의 createSim / 엔티티 스키마
      레인별 정렬 배열 구조 (lanes[i].allies / .enemies, air)
DoD: createSim 이 유효한 상태를 반환한다
크기: M
```

### P2-03 [M] 고정 틱 루프 골격
```
선행: P2-02
파일: src/game/logic/sim.js
작업: TICK_MS = 1000/30, step() 이 11개 서브스텝을 정해진 순서로 호출 (전부 스텁)
DoD: 1000틱 실행 시 s.t 가 정확히 33333.33ms
크기: S
```

### P2-04 [M] 자원 시스템
```
선행: P2-03
파일: src/game/logic/resources.js + test
작업: 마나/균열력 재생, 소환 코스트 상승(1.18^n) + 12초 감쇠, 처치 환급
DoD: 코스트 상승 테스트 통과 (1회 30 → 4회 49). 타입 간 독립성 확인
크기: M
```

### P2-05 [L] 데미지 & 전투
```
선행: P2-02
파일: src/game/logic/combat.js + test
작업:
  - 물리(DEF 감산) / 술식(DEF 무시, RES 비율) / 신성(RES + CORRUPT 1.6 / LIVING 0.7)
  - 최소 피해 10% 보장
  - SHIELDED 흡수
  - effective / absorbed 플래그 (렌더의 "약점!"/"저항!" 근거)
  - 타겟 선정: 같은 레인 정렬 배열 이웃 조회 O(1)
DoD: 22-simulation-spec.md §8 의 데미지 테스트 전항 통과
크기: L
```

### P2-06 [M] 블로킹
```
선행: P2-05
파일: src/game/logic/blocking.js + test
작업: BLOCKER 만 전진 저지. blockCount 1~3, 오라 안이면 +1. FLYING 은 블록 불가
DoD: 방벽 없는 편성이 스테이지 15 이후 사실상 진다 (수동 시뮬로 확인)
크기: M
```

### P2-07 [M] 이동 & 정렬 유지
```
선행: P2-06
파일: src/game/logic/movement.js + test
작업: x 이동, 인접 스왑 정렬로 배열 순서 유지, 타이브레이크(id) 포함
DoD: 1000틱 후에도 lanes[i].enemies 가 x 오름차순 정렬 유지
크기: M
```

### P2-08 [L] 오라 시스템
```
선행: P2-02
파일: src/game/logic/aura.js + test
작업:
  - 원형 판정, 레인을 가로지름 (인접 레인 일부 포함)
  - 역할별 효과 8종 분기
  - ★ SUPPORT 만 !inAura 에서 작동 (역발상 — 이 게임의 시그니처)
  - 지휘관 기절 중 오라 없음
DoD: SUPPORT 반전 테스트 통과. 지휘관 위치가 결과를 바꾼다
크기: L
```

### P2-09 [M] 웨이브 스폰 & 템포 시프트
```
선행: P2-04
파일: src/game/logic/spawn.js + test
작업: 웨이브 테이블 소비, 스폰 간격, 60% 지점 템포 시프트(마나 2배, 밀도 1.6배)
DoD: 웨이브 진행이 결정론적. 템포 시프트가 정확한 웨이브에서 발동
크기: M
```

### P2-10 [M] 발사체
```
선행: P2-05
파일: src/game/logic/projectiles.js + test
작업: 직선/포물선, 관통 카운트, 명중 판정 (제곱거리)
DoD: 관통 각인 없이 1체, 있으면 2체 명중
크기: M
```

### P2-11 [M] 사망 · 돌파 · 승패
```
선행: P2-05
파일: src/game/logic/lifecycle.js + test
작업: 사망 처리·환급·배열 정리, 방주 도달 breachDamage, 승패 판정
DoD: 전투가 victory 또는 defeat 로 반드시 종료된다 (무한 루프 없음)
크기: M
```

### P2-12 [M] 렌더 이벤트 큐
```
선행: P2-11
파일: src/game/logic/events.js
작업: attack/damage/death/spawn/breach/tempo_shift/aura_enter 등 이벤트를 큐에 push
      length=0 재사용으로 할당 0
DoD: 헤드리스 실행 시 큐를 무시해도 결과가 동일
크기: M
```

### P2-13 [L] 결정론 검증
```
선행: P2-12
파일: src/game/logic/sim.test.js
작업:
  - 동일 시드 2회 완전 일치 (B1)
  - 다른 시드 다른 결과
  - ★ RNG 스트림 오염 테스트: 각인 롤 횟수를 바꿔도 전투 결과 불변
DoD: B1 하드 게이트 통과
크기: M
```

### P2-14 [M] 틱 성능 벤치
```
선행: P2-13
파일: tools/bench-sim.mjs
작업: 엔티티 120체 기준 1틱 실행 시간 측정
DoD: ★ 1.2ms 이하. 초과 시 정렬 배열 구조 재검토
크기: M
```

> ### ✅ P2 게이트 — 2026-08-02 검증
> - [x] Node 에서 전투가 완주되고 victory/defeat 로 끝난다 (7스테이지 × 3시드)
> - [x] **B1 결정론 통과** — 동일 시드 완전 일치, RNG 스트림 오염 없음
> - [x] **틱 성능** — 부하 구간(60–90체) **p95 0.026ms**, 예산 1.2ms 대비 46배 여유
> - [x] `src/game/logic/` 에 phaser·DOM·`Math.random`·`Date.now` 0 (lint 강제)
> - [x] 테스트 **46개 통과**
> - [x] 엔티티 풀 누수 없음 (연속 10전투 검증)
>
> **밸런스 게이트 선행 검증** (정식 하네스는 P4-11)
> | 게이트 | 검증 내용 | 결과 |
> |---|---|---|
> | **B1** | 결정론 | ✅ |
> | **B5** | 상성 유효성 — ARMORED 에 술식 > 물리, 대공 없으면 비행 통과 | ✅ |
> | **B6** | 스팸 억제 — 코스트 타입별 1.18배 상승, 12초 감쇠, 타입 간 독립 | ✅ |
> | **B16** | 방벽 필수성 — 1-10 에서 방벽 없으면 **패배** | ✅ |
>
> **테스트가 잡은 설계 위반 1건**
> | 증상 | 원인 | 조치 |
> |---|---|---|
> | 방벽 없는 편성도 적을 완전히 막음 | 적이 `engaged`(사거리 내 교전) 상태에서 정지하도록 되어 있어, 원거리·술사도 사실상 블로커가 됨 → "방벽 없으면 적이 걸어서 방주까지 온다"는 **구조적 심장이 무너져 있었다** | 적은 `blockedBy` 에만 정지하도록 수정. 아처를 때리면서도 계속 걸어간다 |
>
> **실측 밸런스 스냅샷** (시드 5, 자동 플레이)
> | 스테이지 | 방벽 있음 | 방벽 없음 | 원거리만 |
> |---|---|---|---|
> | 1-8 | 승 (방주 100) | 승 (100) | 승 (9) |
> | 1-9 | 승 (100) | 승 (73, 돌파 4) | **패** |
> | 1-10 | 승 (100) | **패** (돌파 14) | **패** |
>
> → 방벽의 결정성이 **1-9 부터** 드러난다. 1-5 가 "방벽의 필요성"을 가르치는 스테이지이므로, P6 에서 1-5~1-8 밀도를 올려 학습과 체감을 앞당길 필요가 있다.

---

## P3 — 렌더 & 감촉 ★ (2주)

> **이 프로젝트에서 가장 중요한 Phase.**
> 목표: **스테이지 1개가 "한 판 더 하고 싶다"는 감각을 준다.**

### P3-01 [L] BattleScene 골격
```
선행: P2-14, P1-07
파일: src/game/scenes/BattleScene.js
작업:
  - 고정 틱 구동 (acc += min(delta*speed, 250), 프레임당 최대 8틱)
  - 스프라이트 ↔ 엔티티 id 매핑
  - 위치 보간 (alpha)
  - shutdown() 완비 (구독 해제·트윈 킬·풀 해제)
DoD: 유닛이 화면에서 움직이고 서로 교전한다 (연출 없이)
크기: L
```

### P3-02 [XL→분할] UnitPresenter ★★
```
선행: P3-01
파일: src/game/presenters/UnitPresenter.js, src/game/data/presenters.json
작업: 19-art-audio-direction.md §2 전체
  a) idle 바운스 (±1px 사인파)
  b) move 바운스+기울기+먼지
  c) attack: 돌진 → 리코일 → 스쿼시 → 이펙트 → 히트스톱
  d) hurt: 흰 틴트 → 넉백 → 스쿼시
  e) death: 붉은 틴트 → 회전 720° + 스케일 0 + 알파 0 → 이펙트
  f) spawn: 페이드 + 탄성 스케일 + 소환 링
  ★ 전부 presenters.json 의 프로파일 데이터로 구동
DoD: ★★ "4프레임 아이들뿐인데 애니메이션이 있는 것처럼 보인다"
크기: L ×2 (a~c / d~f 로 분할)
```

### P3-03 [M] 오브젝트 풀 3종
```
선행: P3-01
파일: src/game/pools/{ProjectilePool,EffectPool,DamageTextPool}.js
작업: 프리워밍, active 배열만 순회, release 시 트윈/이미터 정지, 상한 초과 시 최고령 회수
DoD: 전투 60초 동안 힙 증가 없음 (프로파일러 확인)
크기: M
```

### P3-04 [M] CameraFx — 히트스톱 · 셰이크 · 줌
```
선행: P3-02
파일: src/game/fx/CameraFx.js
작업: 19-art §2.3 표 그대로. 설정에서 셰이크 강도 조절 (100/50/0%)
DoD: 타격 시 화면이 반응한다. 크리티컬과 일반 타격이 구분된다
크기: M
```

### P3-05 [M] 시차 배경
```
선행: P3-01
파일: src/game/presenters/ParallaxLayers.js
작업: TileSprite 3~4레이어, scrollFactor 0/0.15/0.45/1.0
      월드 1 배경 텍스처 필요 (아트 의존)
DoD: 배경에 깊이감이 있다. 드로우콜 4개 이하
크기: M
```

### P3-06 [M] 이펙트 시스템 & 틴트 색상 변형
```
선행: P3-03
파일: src/game/fx/EffectSystem.js, ColorGrade.js
작업: effect/ 팩 1색상행만 패킹하고 setTintFill 로 월드별 색 적용
      월드별 ColorMatrix 색보정
DoD: 같은 이펙트가 월드마다 다른 색으로 보인다
크기: M
```

### P3-07 [L] 전투 HUD (React)
```
선행: P1-04, P3-01
파일: src/hud/*.jsx
작업:
  - 상단: 방주 HP, 웨이브, 타이머, 일시정지
  - 하단: 마나 바, 균열력 바, 동료 6슬롯, 주문 4슬롯
  - ★ 값 단위로 컴포넌트 분할 (ManaBar, ArkHpBar, WaveText 각각 자기 값만 구독)
  - 슬롯에 코스트 상승 ▲ 표시
DoD: HUD 가 10Hz 로 갱신되고 React 렌더 < 700회/60초
크기: L
```

### P3-08 [M] 10Hz 스로틀 동기화
```
선행: P3-07
파일: src/game/scenes/BattleScene.js (throttledSync)
작업: 100ms 누적 후 얕은 비교, 변경분만 gameStore.set
DoD: 개발 빌드에서 set() 호출이 초당 12회 이하
크기: S
```

### P3-09 [M] 소환 입력 2종
```
선행: P3-07
파일: src/hud/CompanionSlots.jsx, BattleScene 입력 핸들러
작업:
  - 원터치 모드(기본): 탭 → 가장 비어 있는 레인 자동 배치
  - 정밀 배치 모드: 드래그 → 레인 하이라이트 → 드롭
DoD: 두 모드 모두 동작하고 설정에서 전환된다
크기: M
```

### P3-10 [L] 지휘관 조작 & 오라 시각화
```
선행: P3-01, P2-08
파일: src/game/presenters/CommanderPresenter.js
작업:
  - 롱프레스 드래그 이동 / 레인 라벨 탭 / 더블탭 대시
  - 바닥 오라 링 + 오라 내 유닛 미세 발광
  - 기절 → 방주 귀환 → 8초 재출격
  - ★ 자동 위치 모드 (효율 70% 목표)
DoD: 지휘관 위치를 바꾸면 전투 결과가 눈에 띄게 달라진다
크기: L
```

### P3-11 [M] 적 태그 상시 표시
```
선행: P3-01
파일: src/game/presenters/EnemyBadges.js
작업: 적 위에 태그 아이콘 최대 3개 + HP 바
      ★ 내 편성이 그 태그에 취약하면 붉게 점멸
DoD: 상성이 눈으로 읽힌다
크기: M
```

### P3-12 [M] 데미지 표현
```
선행: P3-03
파일: DamageTextPool + 이벤트 소비
작업: 타입별 색상, 크리티컬 확대, "저항!"(회색) / "약점!"(확대)
      설정에서 밀도 조절 (전부/큰것만/끄기)
DoD: 상성 실패가 즉시 이해된다
크기: M
```

### P3-13 [M] 결과 화면 + 원인 진단 ★
```
선행: P3-01
파일: src/screens/ResultScreen.jsx, src/game/logic/diagnose.js
작업:
  - 승리: 별 순차 점등, 보상, [2배 광고] [다음]
  - 패배: ★ 원인 진단 — blockedDamage / unkilledByTag / breachSource 집계로
    "ARMORED 적 12체를 처치하지 못했습니다. 술식 동료를 편성해 보세요"
  - 보유 로스터에서 해당 타입 동료 추천
DoD: 패배 이유가 명확하고, 무엇을 바꿔야 할지 알 수 있다
크기: M
```

### P3-14 [M] 사운드 기초
```
선행: P1-02
파일: src/game/fx/AudioManager.js
작업: BGM 레이어드(1막 퍼커션 → 2막 시네마틱 드럼 크로스페이드)
      SFX 채널 상한 4, 동일 SFX 60ms 내 중복 무시
      ★ SFX 소싱 필요 (CC0) — 최소 12종(타격·소환·사망·UI)
DoD: 템포 시프트 때 BGM 강도가 끊김 없이 올라간다
크기: M
```

### P3-15 [M] 스테이지 1-1 완성 & 튜닝
```
선행: P3-01~P3-14
파일: src/game/data/stages.json (1-1), units.json (6종), enemies.json (4종)
작업: 90초 전투 1개를 끝까지 다듬는다. 웨이브 밀도·코스트·연출 타이밍 반복 조정
DoD: ★ 아래 게이트
크기: L
```

> ### P3 구현 검증 — 2026-08-02
>
> 전투가 실제로 돈다. 헤드리스 구동(백그라운드 탭에서 `game.loop.step()` 수동 호출)으로 실측:
>
> | 항목 | 결과 |
> |---|---|
> | 씬 체인 | Boot → Preload → Menu → Battle, **Battle 단독 실행** |
> | 시뮬 | 40초 진행, 웨이브 5/7, 소환 24 · 처치 11 · 피해 1,496 · 돌파 0 |
> | **스프라이트 정합** | **엔티티 32 = 스프라이트 32, 누락 0** |
> | 연출 | 이펙트·데미지 숫자·오라 링·템포 시프트 배지 동작 |
> | HUD | 코스트 상승 ▲ 표시, 10Hz 동기화 |
> | 빌드 | JS gzip **466KB**, lint 0, 테스트 46/46 |
>
> **구현 중 잡은 버그 5건**
> | 증상 | 원인 | 조치 |
> |---|---|---|
> | 소환한 아군의 스프라이트가 안 생김 (적은 정상) | **틱 밖에서 `trySummon()` 호출 → 다음 `step()` 의 `resetQueue` 가 SPAWN 이벤트를 지움** | `step(s, applyInputs)` 로 변경. 입력을 큐 리셋 직후 시뮬 내부에서 적용 → 리플레이·PvP 고스트 정합성도 함께 확보 |
> | Menu 와 Battle 이 동시 실행 | Phaser 는 stop/start 를 큐잉하므로 StrictMode 연속 호출 시 "아직 시작 안 된" 씬이 정지 대상에서 누락 | `desiredScene` 을 기록하고 `POST_STEP` 마다 재확인 |
> | 전투 씬이 빈 화면 | 전역 아틀라스 로드 전에 씬 시작 | `ui.assetsReady` 게이트 |
> | `create()` 중 크래시 | `setPhase` 가 자기 구독을 동기 호출해 미등록 ScenePlugin 접근 | 구독 등록을 상태 초기화 **뒤로** 이동 + 활성 가드 |
> | 트윈 정리가 전부 실패 | **`killTweensOn` 은 Phaser API 가 아니다** (`killTweensOf`) | 6곳 수정 |
>
> **검증 노트:** 백그라운드 탭에서는 `requestAnimationFrame` 이 완전히 정지해 `loop.frame` 이 0에 머문다. 자동 검증 시에는 `game.loop.step(t)` 를 수동 호출해 구동한다.
>
> ### P3 게이트 — **기계 검증으로 대체** (2026-08-03 방침 전환)
>
> 원안은 "팀 외부 5명에게 플레이시키고 '한 판 더 하고 싶은가'를 묻는다"였다.
> **테스터가 없으므로 이 게이트는 열리지 않고, 열리지 않는 게이트 뒤에서 개발이 멈춘다.**
> 실제로 이 게이트가 미실시인 채로 P4~P7 이 전부 진행됐다 — 즉 게이트로서 기능하지 않았다.
> 기계가 답할 수 있는 것만 남긴다.
>
> - [x] 자동 플레이로 전투가 완주된다 (100 스테이지 · 전 시드 · 헤드리스)
> - [x] 동일 시드 동일 결과 (B1)
> - [x] 연출이 `presenters.json` 데이터로 구동 (코드에 박히지 않음)
> - [x] 전 씬 `shutdown()` 구현 · 구독 해제
> - [x] React 렌더 < 700회/60초 (10Hz 스로틀)
> - [x] 스프라이트 ↔ 엔티티 정합 (누락 0)
> - [ ] 60fps (상급 기기) — **실기기 계측. M5 로 이동**
>
> ⚠ **"재밌는가 · 살아 있어 보이는가 · 타격감이 있는가 · 오라가 체감되는가"는
> 기계가 답할 수 없다.** 이 질문들은 **사용자가 직접 플레이하는 단계**로 미뤄졌다
> (`30-roadmap.md` §0 방침 전환). 이 게이트는 **"동작한다"만 보증하며 "재밌다"를
> 보증하지 않는다** — 이 구분을 지우면 검증하지 않은 것을 검증했다고 믿게 된다.

---

## P4 — 각인 & 밸런스 하네스 (2주)

> **목표: 기획자가 엔지니어 없이 밸런싱을 자립 수행한다.**

| ID | 크기 | 작업 | DoD |
|---|---|---|---|
| P4-01 | L | `logic/sigils.js` — 훅 시스템(onSummon/onAttack/onKill/onBlock/onDamageTaken/onWaveStart/modifyStat) | 각인이 시뮬 동작을 실제로 바꾼다 |
| P4-02 | M | 진화 판정 — **획득 시점 1회만** 검사 (매 틱 금지) | 조합 성립 시 상위 각인으로 융합 |
| P4-03 | L | 각인 30종 + 진화 6종 데이터 | `sigils.json` 스키마 통과 |
| P4-04 | M | 드래프트 UI — 3지선다·리롤·`✨반응` 배지·3초 자동선택 | 방치 플레이에서도 막히지 않는다 |
| P4-05 | M | 대가형 각인 `⚠` 표기 | 페널티가 숨겨지지 않는다 |
| P4-06 | M | JSON 스키마 + `ajv` 검증 | `npm run data:validate` 통과 |
| P4-07 | M | 참조 정합성 검사 (`tools/validate-data.mjs`) | 존재하지 않는 id 참조 시 실패 |
| P4-08 | XL→분할 | **`tools/balance.mjs`** — 헤드리스 실행기 | CSV 리포트 생성 |
| P4-09 | L | 편성 아키타입 8종 (recommended/balanced/physical_only/no_blocker/spam_cheapest 등) | 실패 케이스가 실제로 진다 |
| P4-10 | L | `estimateF2PPower()` — 무과금 파워 추정 | B4 검증의 근거 |
| P4-11 | L | **`tools/balance-check.mjs`** — 검증 코퍼스 B1~B17 | 하드 게이트 8개 동작 |
| P4-12 | M | 밸런스 리포트 HTML 시각화 | 벽 구간이 빨간 띠로 보인다 |

> ### ✅ P4 게이트 — 통과 (2026-08-02)
> - [x] `npm run balance:check` 가 하드 게이트를 실제로 차단한다
>       — 튜닝 과정에서 하드 2건(B3 설계된 패배·B16 방벽)이 실제로 차단됨
> - [x] 기획자가 `data 수정 → validate → balance:quick → 확인` 사이클을 혼자 완주
>       — `npm run verify` 한 줄로 lint→test→validate→balance 전체 통과
> - [x] B6(스팸 억제) 7/7 · B16(방벽 필수성) 1-9 에서 6% vs 22%
>
> **잔여 소프트 1건**: B10 ★2 획득률 68% (목표 45–60%).
> 튜토리얼 7스테이지만 존재해 표본이 쉬운 구간에 몰린 결과이므로,
> P6 에서 1–3장 전 구간이 들어온 뒤 재측정한다. 지금 별 기준을 조이면
> 정작 후반 스테이지에서 ★2 가 불가능해진다.

---

## P5 — 메타 & 방주 (2주)

| ID | 크기 | 작업 |
|---|---|---|
| P5-01 | L | ArkScene — 방주 배경, 시설 6종 시각화, 성장 단계 4구간 |
| P5-02 | M | 주민 NPC 배회 (위치 트윈만으로 "살아 있는 거점", 최대 12체) |
| P5-03 | L | 동료 성장 3축 — 레벨(골드) / 랭크(파편, **100% 결정론**) / 장비 |
| P5-04 | M | ★ 랭크업·강화에 랜덤 성공률 없음 확인 (규제 대응) |
| P5-05 | M | 방치 보상 — 8h 상한, 최고 스테이지 연동, 광고 2배 3회 |
| P5-06 | M | 방치 카운트다운 UI + 6.5h 푸시 예약 |
| P5-07 | M | 소유 효과 + 역할별 상한 25% + 오버플로 자동 환전 |
| P5-08 | M | 별 경제 + 메타 업그레이드 트리 |
| P5-09 | M | 생존자 파견 (3슬롯, 2/4/8h, 자동 재파견 토글) |
| P5-10 | L | 편성 화면 + **편성 분석 패널**(타입 분포·경고·적합도) |
| P5-11 | M | 프리셋 3개 + 자동 추천 편성 |
| P5-12 | M | 편성 공유 코드 (인코딩/디코딩) |
| P5-13 | M | 일일 루프 3분 측정 + "모두 받기" 버튼 |

> ### ✅ P5 게이트 — 통과 (2026-08-02)
> - [x] 일일 필수 루프 **3분 이내**
>       — 현재 구현 기준 **방주 진입 → "모두 받기" 1탭**으로 방치 + 완료된 파견이
>       한 번에 정산되고, 자동 재파견이 기본 ON 이라 파견에 추가 탭이 없다.
>       일일 퀘스트·무료 뽑기·시장(P7) 과 자원 던전(P6) 이 붙으면 12탭 / 2분 20초가
>       설계 목표이며, "모두 받기"가 그중 6탭을 흡수하도록 이미 만들어 두었다.
> - [x] 방치 보상 비중 — `idle.goldPerHourBase=90 × 1.055^stage`.
>       스테이지 30 기준 8시간 수거 ≈ 3,570골드, 같은 구간 전투 1판 ≈ 450골드 ×
>       하루 12판 ≈ 5,400골드 → 방치 비중 **약 40%** (목표 35–50%).
> - [x] 편성 분석 패널이 경고를 실제로 낸다
>       — `no_blocker` · `no_damage` · `no_anti_air` · `no_armor_break` · `physical_only`
>       · `thin` · `expensive` · `no_splash` 8종. 테스트로 고정 (`progression.test.js`).
>
> **P5 에서 추가로 잡은 것**
> - **세이브 마이그레이션 v1→v2.** 슬라이스에 필드를 추가하면 zustand persist 가
>   저장된 객체를 통째로 얹어 신규 키가 `undefined` 가 된다. 실제로 `idleAdClaims.day`
>   접근에서 방주 화면이 화이트스크린이 됐다. `migrate` + `onRehydrateStorage`
>   이중 안전망으로 고정.
> - **성장이 전투에 실제로 반영된다.** `getBattleSlots()` 가 레벨·랭크·장비·소유효과·
>   별 트리를 합성해 `buildStageConfig` 로 넘긴다. 브라우저에서 느림보 거북
>   HP 520 → 955 (레벨 11 + 별 트리 +2.5%) 확인.

---

## P6 — 콘텐츠 확장 (4주)

| ID | 크기 | 상태 | 작업 |
|---|---|---|---|
| P6-01 | L | ✅ | 스테이지 생성기 `tools/gen-stages.mjs` |
| P6-02 | XL | ✅ | 월드 1–3 (60 스테이지) · 적 32종 (vermin 10 · goblin 11 · undead 11) |
| P6-03 | XL | ✅ | 월드 4–5 (40 스테이지) · 적 30종 (lizard 15 · arcane 15) — **총 100 스테이지 / 적 62종** |
| P6-04 | L | 🟡 | 동료 확장 — **25/44종**. 새 메커니즘이 필요한 19종은 대기 |
| P6-05 | L | ✅ | 보스 시스템 — 3페이즈, **페이즈마다 태그 변경**, 예고 0.8초 |
| P6-06 | L | ✅ | 보스 5체 (Mecha Golem · Undead Executioner · Evil Wizard + 거대화 2) |
| P6-07 | M | ✅ | 거대화 엘리트 시스템 (`giant` 필드로 스케일·배율) |
| P6-08 | L | ✅ | 변주 모드 4종 — 돌파 · 호위 · 버티기 · 보스 |
| P6-09 | M | ✅ | 스테이지 프리뷰 UI (태그 카운트 · 경고 · 추천 편성) |
| P6-10 | M | ✅ | 하드 난이도 — 월드 단위 해금 · 보상 차등 · 하네스 측정 가능 |
| P6-11 | L | ✅ | 월드 1–10 배경 40장 + 방주 3상태 + 균열 2상태 + UI 키트 41장 연결 |
| P6-12 | M | ✅ | 자원 던전 3종 (금고 · 채석장 · 훈련소 · 5티어 · 즉시 정산) |
| P6-13 | L | ✅ | 기억의 탑 + 감산 규칙 4종 (주간 로테이션 · 각인 층간 이월) |
| P6-14 | M | ✅ | 돌파 시험 (구간 11개 · 하드 ★2 증명 → 정산) |

> ### P6-01 스테이지 생성기 드리프트 정리 — 구현 노트 (2026-08-03)
>
> **문제.** `node tools/gen-stages.mjs` 의 출력과 `src/game/data/stages.json` 이
> **18 스테이지**에서 어긋나 있었다. 누구든 생성기를 돌리는 순간 실측으로 얻은
> 밸런스 조정이 조용히 사라지는 상태였고, 그래서 월드 4–5(P6-03)를 생성기로
> 만들 수가 없었다.
>
> **진단 (추측이 아니라 diff).** 18개는 전부 **한 가지 원인**이었다 —
> 생성 파이프라인 **밖에서** 따로 돌린 후처리 스크립트 두 개.
>
> | 원인 | 스테이지 | 내용 |
> |---|---|---|
> | `cap-flying.mjs` (FLYING 상한 35%) | 1-6 · 1-15 · 1-20 · 2-8 · 2-19 · 2-20 · 3-7 · 3-8 · 3-9 · 3-10 · 3-12 · 3-17 · 3-18 · 3-19 · 3-20 **(15)** | 비행 적 id → 같은 세력 지상 적. **머릿수는 그대로**, 종류만 바뀜 |
> | `tune-endure.mjs` (버티기 ×0.7) + 상한 | 1-13 · 2-13 · 3-13 **(3)** | 버티기 3판. 머릿수 135→93 · 96→63 · 86→62 |
>
> **손 튜닝은 하나도 남아 있지 않았다.** 걱정했던 두 가지는 이미 흡수돼 있었다 —
> 보스 6체 배치(P6-06)와 1-9 `difficultyMult: 3.6`(B3)은 `worlds.json` 에
> 들어 있어서 diff 에 **나타나지 않았다.** 생성기 로직이 바뀌어 생긴 차이(c 유형)도
> 없었다. 즉 18개 전부가 (b) 유형이고, 100% 흡수 가능했다.
>
> **정리한 방식.**
>
> | 이전 | 이후 |
> |---|---|
> | `gen-stages.mjs` 안에 생성 규칙 + fs + CLI 가 뒤섞임 | 규칙은 `tools/lib/stages-core.mjs` 순수 함수. CLI 는 껍데기 |
> | `cap-flying.mjs` 를 사람이 기억해서 따로 실행 | `capFlyingRatio()` — 생성 마지막 단계 |
> | `tune-endure.mjs` 를 사람이 기억해서 따로 실행 | `scaleModeSpawns()` — 생성 마지막 단계 |
> | 상한 0.35 · 배율 0.7 이 스크립트 안 `process.env` 기본값 | `worlds.json:postProcess` (절대 규칙 4) |
> | 무조건 덮어쓰기 | **차이가 있으면 보여주고 멈춘다** |
>
> ★ **순서는 실측으로 확인했다.** `cap → scale` 과 `scale → cap` 모두 현재
> 데이터에서 **stages.json 과 0/60 차이**로 같은 결과를 냈다. 비행 상한이 '비율'
> 기준이라 보정 전 원본 비율에 거는 `cap → scale` 을 정식 순서로 택했다.
>
> ★ **`tune-endure` 는 멱등이 아니었다** — 두 번 돌리면 버티기 물량이 0.49 배가
> 된다. 파이프라인 밖의 비멱등 변환은 몇 번 적용됐는지 아무도 모른다.
> 이것이 후처리를 밖에 두면 안 되는 진짜 이유다. (`cap-flying` 은 멱등이었다)
>
> **안전장치 — 조용한 파괴가 가장 나쁘다.**
>
> ```
> npm run gen:stages              차이를 보여주고 쓰지 않는다 (차이 있으면 exit 1)
> npm run gen:stages -- --diff    웨이브 단위까지 펼쳐 본다
> npm run gen:stages -- --new     기존 스테이지 보존, 새 id 만 추가  ← P6-03 은 이걸로
> npm run gen:stages -- --force   전부 덮어쓴다
> FLYING_CAP=0.4 node tools/gen-stages.mjs --diff   값 탐색 (파일 안 건드림)
> ```
>
> `cap-flying.mjs` · `tune-endure.mjs` 는 **에러를 내고 죽는 안내문**으로 남겼다.
> 지우면 "파일 없음"만 뜨지만, 남겨 두면 어디로 갔는지 알려 준다.
>
> **드리프트 재발 방지는 테스트다** — `src/game/data/stages.gen.test.js` (10개).
> "돌려도 안 바뀐다"를 주장이 아니라 `npm run test` 가 지키는 성질로 만들었다.
> stages.json 을 손으로 고치면 즉시 빨간불이 켜진다.
>
> **검증 (실측).**
>
> | 항목 | 결과 |
> |---|---|
> | 생성 후 `stages` 배열 SHA-256 | 정리 전과 **완전히 동일** (`dee3d715921fc5f8`) |
> | `node tools/gen-stages.mjs` 재실행 | `✓ 생성 결과와 동일 — 쓰지 않음` (60 스테이지) |
> | 1-9 `SEEDS=150 LOADOUTS=recommended` | **39.3%** — 정리 직후. 이후 아래 B3 재튜닝 참조 |
> | `npm run test` | 전부 통과 (신규 10 포함) |
> | `npm run data:validate` | 통과 (경고 0) |
>
> 정리 자체는 **밸런스 중립**이다. 이것이 그 증명이다 — 후처리를 파이프라인 안으로
> 옮기고 재생성한 뒤에도 `stages` 배열의 SHA-256 이 정리 전과 한 비트도 다르지 않다.
> 시뮬레이터가 보는 입력이 문자 그대로 같으므로 밸런스가 움직일 여지가 없다.
>
> ### 이어서 — B3 재튜닝: 1-9 `difficultyMult` 3.6 → **3.75** (2026-08-03)
>
> **왜 다시 쟀나.** 위 정리와 **무관한** 이유다. `recommendedLoadout` 이 방벽 1기 →
> **2기**로 바뀌었다 (레인이 3개인데 방벽이 1기면 나머지 두 레인을 아무도 붙잡지
> 못하고, 막는 것은 BLOCKER 뿐이라 다른 상성 답으로 보상되지 않는다).
> 추천 편성이 세지자 1-9 가 **50.7%** 로 떠올라 B3 밴드(30–45%)를 벗어났다.
> `difficultyMult: 3.6` 은 *방벽 1기 기준으로* 튜닝된 값이었으므로 무효가 됐다.
>
> ★ 이 사건이 드리프트 정리의 가치를 그대로 보여준다 — stages.json 은 바이트 단위로
> 고정돼 있었는데도 승률이 움직였다. **스테이지 데이터가 고정돼 있어야 비로소
> "무엇이 승률을 움직였는가"를 물을 수 있다.** 실제로 같은 명령이 몇 분 사이
> 24.0% → 70.0% 로 튀는 것을 보고 원인을 하네스 입력 쪽으로 좁힐 수 있었다.
>
> **실측 (`SEEDS=150 STAGES='^1-9$' LOADOUTS=recommended`)**
>
> | 배율 | 3.60 | 3.65 | 3.70 | **3.75** | 3.80 | 3.85 | 3.90 | 3.95 | 4.00 | 4.40 | 4.80 |
> |---|---|---|---|---|---|---|---|---|---|---|---|
> | 승률 | 50.7% | 45.3% | 42.0% | **38.7%** | 32.7% | 31.3% | 26.7% | 22.0% | 21.3% | 10.7% | 6.7% |
>
> **확정: 3.75 — 300시드 37.7%.** 밴드 중앙이고, 양옆(3.70 = 42.0% · 3.80 = 32.7%)이
> 모두 밴드 안이라 시드 노이즈(±3~4%)에 대한 여유가 양방향으로 있다.
> 응답이 가파르다 — 0.05 당 약 5%p 다. 3.6→4.0 구간 밖은 볼 필요가 없다 (4.0 에서 이미 21%).
>
> `worlds.json` **과** `stages.json` 양쪽에 들어갔다. 사실 이제 후자는 전자의 함수라
> `npm run gen:stages -- --force` 한 줄이면 되고, `stages.gen.test.js` 가 둘이
> 갈라지지 않는지 지킨다. **이 티켓 이전이라면 조용히 3.6 으로 되돌아갔을 변경이다.**
>
> ★ **하네스가 또 바뀐 뒤 재확인했다.** `stageCounterTags()` 추가와
> `RECOMMEND_FILL_ORDER` 리팩터가 들어온 뒤 위 스윕을 통째로 다시 돌렸고
> **표의 11개 값이 한 자리도 다르지 않았다** (3.75 = 38.7% / 300시드 37.7%).
> 즉 그 두 변경은 1-9 의 추천 편성 결과를 바꾸지 않았다. 3.75 는 그대로 유효하다.
>
> ⚠ **보스 6체 밴드(45–75%)는 이 티켓에서 확정 측정하지 않는다.** 추천 편성이 세지면서
> 위로 밀려 있다 — 1-10 100% · 1-20 83.3% · 2-10 80% · 2-20 86.7% · 3-10 70% · 3-20 100%
> (30시드, 보스 HP 원복 이후 값). 밴드 안은 3-10 하나뿐이다.
> 스테이지 데이터 문제가 아니라 추천 편성 · 적 스탯 쪽 문제이므로 `enemies.json` 담당이 맡는다.
> **웨이브 테이블로 보스전을 조이려 하지 말 것** — 보스 스테이지의 물량은
> `densityCurve.bossMult` 가 이미 낮춰 둔 값이고, 여기를 건드리면
> "보스전이 아니라 물량전"이 된다 (`worlds.json:$bossMult` 참조).
>
> **P6-03 으로 넘길 때.** `worlds.json` 에 월드 4–5 를 쓰고
> `npm run gen:stages -- --new` 를 돌리면 월드 1–3 은 **한 글자도 바뀌지 않는다.**
> `--force` 는 월드 1–3 을 의도적으로 재조정할 때만 쓴다.

> ### P6-03 월드 4–5 — 구현 노트 (2026-08-03)
>
> **캠페인 100 스테이지 · 적 62종이 됐다.** (월드당 20, `worlds.json` 의 beat 20개에서 생성)
>
> | 월드 | 세력 | 방주 HP | 묻는 것 | 보스 (10 · 20) |
> |---|---|---|---|---|
> | 1 무너진 하수도 | vermin (10) | 100 | 기본 문법 — 소환 · 방벽 · 대공 · 중장갑 | giant_rhino_beetle · royal_scarab_matriarch |
> | 2 고블린 전초지 | goblin (11) | 110 | 원거리 적 · 속공 · `WARDED` · `REGEN` | crushing_cyclops · mecha_golem |
> | 3 망자의 행렬 | undead (11) | 120 | `CORRUPT` · **2조건 조합**(공중+결계) · 지속 회복 | undead_executioner · evil_wizard |
> | **4 부서진 성채** | **lizard (15)** | 130 | **방벽이 하던 일을 하나씩 빼앗는다** | moat_warden · scale_sovereign |
> | **5 마법사의 탑** | **arcane (15)** | 140 | **술식이 이번엔 우리를 향해 온다** | ocular_watcher · pit_balor |
>
> **월드 1–3 은 "무엇으로 때리는가"를 물었다 (물리 · 술식 · 신성).
> 월드 4–5 는 "무엇으로 막는가"를 묻는다.** 이것이 두 월드를 하나의 티켓으로 묶은 이유다 —
> 4가 방벽에서 하나씩 빼앗고, 5가 그 축을 완성한다.
>
> **월드 4 — 방벽 해체 4단계**
> ① `SHIELDED` 가 처음으로 **수치를 갖는다**(`base.shield`). 세기와 무관하게 첫 N타가
> 지워지므로 **"큰 한 방 먼저"가 손해**가 된다.
> ② 술식 근접(`tidal_ravager`)이 아군 DEF 를 무시한다 — **"더 단단한 방벽"이라는 답이
> 여기서 처음으로 통하지 않는다.**
> ③ `WARDED` + `SWARM`(`merfolk_aquamancer`) — 결계가 물량에 붙어 술식·신성 광역이
> 동시에 깎인다. 물리 원거리가 답이 된다.
> ④ `ARMORED` + `FLYING`(`mud_wyvern`) — 붙잡지도 못하고 물리도 안 통하는 2조건.
>
> ★ 사거리 축이 굵어진다 (창병 72 · 궁수 165 · 작살 150 · 수술사 150).
> 방벽 앞줄만 두껍게 해서는 전선이 성립하지 않는다.
>
> **월드 5 — 적의 절반 이상이 arcane 이다.**
> arcane 은 아군 DEF 를 무시하므로 **방벽의 방어력이 통째로 무의미해진다** —
> 방벽은 '붙잡는 역할'만 남고 버티는 역할은 지원·회복이 가져간다.
> ① `CORRUPT` + `WARDED` — 신성이 특효(×1.6)인데 그 신성이 RES 에 깎인다.
> **정답이 정답을 막는다.** 물리를 같이 넣지 않으면 화력이 사라진다.
> ② `FLYING` + `WARDED` + `CORRUPT`(`ghastly_eye`) — **첫 3조건.**
> ③ `SHIELDED` 가 물량이 아니라 거인에게 붙는다 (얼음 골렘 · 흑기사).
> ④ 사거리 185(`vile_witch`) — 전 적 중 최장. 전선 뒤까지 닿는다.
>
> **난이도 곡선은 경제 곡선에서 역산했다.** 전역 스테이지 81–94 구간은 무과금 목표
> 파워가 적 HP 성장을 앞서므로(파워/HP 1.00 → 1.15) 그대로 두면 **월드 5 가 월드 4 보다
> 쉬워진다.** 그래서 적 base 를 월드 4 대비 약 1.3배로 올려 잡았다. 반대로 레벨 상한(100)이
> 걸리는 스테이지 95 이후(5-15~5-20)는 비율이 0.87 까지 떨어진다 —
> **캠페인 2부의 마지막이 가장 어려운 것은 의도다.**
>
> ⚠ **`15-content-plan.md` §1.1 과 세력 배치가 다르다.** 계획표는 2 = Beasts+Raiders ·
> 3 = Monsters · 6 = Undead 였고, 실제 데이터는 2 = goblin · 3 = undead · 4 = lizard ·
> 5 = arcane 이다. **데이터가 정본이다** — 에셋 팩 실물과 태그 도입 순서에 맞춰 P6-02 에서
> 이미 바뀐 것이고, 가르치는 태그 순서(SWARM → WARDED/REGEN → CORRUPT → 방벽 해체)는
> 그대로다. 계획 문서 쪽 표는 `15-content-plan.md` 갱신 대상으로 남는다.

> ### P6-10 하드 난이도 — 구현 노트 (2026-08-03)
>
> **난이도는 규칙이 아니라 데이터다.** 코드에는 배율을 곱하는 자리만 있고
> 숫자는 전부 `balance.json:difficulty` 에 있다. 규칙은 `src/game/logic/difficulty.js`.
>
> | 손잡이 | 노멀 | 하드 | 나이트메어 |
> |---|---|---|---|
> | 적 HP | ×1 | **×1.35** | ×1.9 (미구현) |
> | 적 ATK | ×1 | **×1.35** | ×1.9 (미구현) |
> | 스폰 수 | ×1 | **×1.15** | ×1.3 (미구현) |
> | 골드 | ×1 | **×1.8** | — |
> | 강화석 | 0 | **3 + 0.25×스테이지** | — |
> | 첫 클리어 젬 | 0 | **10** | — |
> | 해금 | 항상 | **해당 월드 노멀 전 스테이지 ★1+** | 월드 하드 전 스테이지 ★3 |
>
> **왜 스폰 수까지 미는가.** HP·ATK 만 올리면 하드는 "더 오래 때리기"가 된다.
> 동시에 처리해야 하는 수가 늘어야 광역 화력과 방벽 용량이 실제로 시험되고,
> 그때 비로소 하드가 **다른 편성을 요구하는 판**이 된다.
>
> **왜 골드 배율이 1.8 인가 (`economy.repeatFactor` 와 같은 값).**
> 경제 모델은 "스테이지 하나를 평균 1.8회 반복 클리어한다"를 전제로 총 수입을
> 계산한다. 하드 1회가 그 반복 수입을 **넘어서면** `calibrate-economy` 의 골드
> 곡선이 통째로 틀어지고 인플레이션이 레벨업 비용에 복리로 얹힌다.
> 하드는 수입을 늘리는 장치가 아니라 **반복을 도전으로 바꾸는 장치**다.
> `validate-data.mjs` 가 `goldMult ≤ repeatFactor` 를 하드 게이트로 검사한다.
>
> **하드 별은 노멀 별에 더해진다.** 13-progression-meta.md §6 의 재도전 루프
> ("재도전이 새로운 도전이라서 노가다가 아니다")가 성립하려면 하드가 별을 줘야 한다.
> 세이브는 `meta.stageStars`(노멀) + `meta.difficultyStars.hard` 로 나눠 갖는다 —
> 한 구조로 통합하면 이미 배포된 세이브 전부를 변환해야 하고 별 트리·시설
> 해금이 그 변환 하나에 걸린다. **세이브 v2 → v3 마이그레이션 추가됨.**
>
> **나이트메어는 데이터에 남아 있고 `implemented: false` 다.**
> 15-content-plan.md §2 는 나이트메어에 배율이 아니라 *월드별 신규 메커니즘*
> (독 장판 · 부활 · 레인 교체)을 요구한다. 규칙이 없으므로 켜지 않는다.
> 호출하면 `'나이트메어' 난이도는 아직 구현되지 않았습니다 (월드별 신규 메커니즘
> 미구현 …). 지금은 노멀 · 하드 난이도로 플레이할 수 있습니다.` 를 던진다 —
> 오타(`알 수 없는 난이도`)와 **다른 메시지**다. 둘은 다른 사고이기 때문이다.
>
> **측정.** `DIFFICULTY=hard node tools/balance.mjs` (결과는
> `balance-report-hard.csv` 로 따로 나간다). 30시드 실측:
>
> | 스테이지 · 편성 | 노멀 승률 | 하드 승률 | 노멀 ★3 | 하드 ★3 |
> |---|---|---|---|---|
> | 1-10 recommended | 100% | 100% | 77% | 70% |
> | 1-10 balanced | 100% | 100% | 40% | 7% |
> | 1-10 holy_heavy | 100% | **16.7%** | 3% | 0% |
> | 1-10 turtle | 90% | **23.3%** | 0% | 0% |
> | 1-10 no_blocker | 100% | 86.7% | 30% | 0% |
>
> 추천 편성은 하드에서도 100% 다 — 벽은 편성 퍼즐이지 경제 벽이 아니다(게이트 B4).
> 무너지는 것은 **한 축에 몰빵한 편성**(holy 단일 · 방벽 과잉)이다. 의도한 결과다.
>
> **남은 것:** 하드 보상의 "에픽 파편"(15-content-plan.md §2)은 미구현.
> 파편 지급은 대상 동료를 골라야 하는데 무작위 선택은 절대 규칙 6 위반이므로,
> 결정론적 선택 규칙이 정해지는 P7(상점·가챠 배선)에서 함께 붙인다.

> ### P6-09 스테이지 프리뷰 — 구현 노트 (2026-08-03)
>
> **집계·경고·추천은 전부 `src/game/logic/stagePreview.js` 의 순수 함수다.**
> 화면(`src/screens/StagePreview.jsx`)은 표현만 한다.
>
> | 층 | 파일 | 책임 |
> |---|---|---|
> | 규칙 | `logic/stagePreview.js` | 스폰 집계 · 경고 판정 · 추천 편성 |
> | 문구 | 같은 파일의 `TAG_WARNING_RULES` · `STAGE_WARNING_TEXT` | 경고 문장 · 임계값 |
> | 표현 | `screens/StagePreview.jsx` + `StagesScreen.jsx` | 칩 · 아이콘 · 버튼 |
> | 아이콘 | `data/icons.json` 의 `tag.*` | UI 아틀라스 프레임 매핑 |
>
> **추천 편성 사본을 없앴다 — 이것이 이 티켓의 실질적 성과다.**
> `tools/lib/loadouts.mjs` 가 자체 `recommendedLoadout()` 을 갖고 있었고,
> 게임 안에는 그 버튼이 아예 없었다. 그대로 UI를 붙였다면 **하네스가 검증한
> `recommended` 편성과 플레이어가 받는 추천이 처음부터 다른 두 함수**가 된다 —
> 게이트 B4("현재 파워 + 올바른 편성 = 클리어 가능")가 아무것도 보장하지 못하게 된다.
> 구현을 `logic/` 으로 옮기고 툴은 **재수출만** 한다. 테스트가
> `tools.recommendedLoadout === logic.recommendedLoadout` 를 고정하므로
> 사본이 다시 생기면 그 자리에서 깨진다.
>
> **집계에서 잡은 실수 1건 — 레인은 배수가 아니다.**
> `stageConfig.js:enemyScale()` 이 `spec.count * lanes.length` 로 세고 있어
> 같은 방식으로 짤 뻔했다. 실제로는 `spawn.js:queueWave()` 가
> `lanes[i % lanes.length]` 로 **분배**하므로 `spec.count` 가 곧 총 마릿수다.
> 곱했으면 프리뷰가 실제의 3배를 표시했다. 테스트가 60 스테이지 전부를
> 원본 스폰 테이블과 대조한다. (`enemyScale` 은 모드 파라미터 기준값 계산용이라
> 이번 티켓에서 건드리지 않았다 — **별도 확인이 필요한 의심 지점이다.**)
>
> **경고는 한 태그당 하나만 낸다.** 같은 태그로 치명과 경고를 동시에 띄우면
> 둘 다 읽히지 않는다. 규칙 테이블 순서대로 첫 매치만 채택하고, 심각도로 정렬한 뒤
> 보스 페이즈 경고를 최상단에 올린다 — 그것이 편성을 가장 크게 바꾸는 지시다.
>
> **보스 페이즈 태그는 `tagSet` 에 섞지 않는다.** 섞으면 추천 편성 입력이
> `tools/balance.mjs:stageTags()` 와 달라져 하네스와 갈라진다.
> 페이즈 태그는 `bossPhases` 로 따로 내보내 화면에 페이즈별 배지로 표시한다.
>
> **스테이지 클릭이 더 이상 전투로 직행하지 않는다.** 프리뷰를 먼저 열고
> 출격은 그 안에서 한 번 더 누른다. 편성을 고칠 기회 없이 들어가는 클릭은
> 편성 퍼즐에서 선택을 빼앗는다. `screens/index.jsx` 의 `StagesScreen` 은
> `screens/StagesScreen.jsx` 로 분리했고 P6-10 의 `DifficultySelect` 는 그대로 얹혀 있다.
>
> **검증**: 프리뷰 테스트 35개 (전체 264개 통과) · lint 0 · `data:validate` 통과 · `build` 성공.
> 밸런스 수치는 바뀌지 않았다 (`recommendedLoadout` 은 동작 동일, 위치만 이동).

> ### P6-08 변주 모드 — 구현 노트 (2026-08-02)
>
> `src/game/logic/modes.js` 가 규칙을, `balance.json:modes` 가 수치를,
> `presenters/ModePresenter.js` 가 월드 표현을 갖는다.
>
> | 모드 | 승리 | 패배 | 핵심 |
> |---|---|---|---|
> | 격퇴 | 전 웨이브 격퇴 | 방주 0 | 기본형 |
> | 버티기 | 제한 시간 생존 | 방주 0 | 개막에 편성 전개 후 **소환 잠금** |
> | 돌파 | 균열 파괴 | 방주 0 | 아군이 전진해야 끝난다 |
> | 호위 | 수레가 균열 도달 | **수레 0** · 방주 0 | 두 번째 방어 대상 |
> | 보스 | 보스 처치 | 방주 0 | 잔챙이 청소를 기다리지 않는다 |
>
> ### P6-06 보스 5체 — 구현 노트 (2026-08-03)
>
> P6-05 가 보스 *시스템*을 만들었고, P6-06 은 그 시스템으로 **서로 다른 질문 5개**를 만든다.
> 보스가 늘어난다는 것은 HP 큰 적이 늘어난다는 뜻이 아니라 **답이 늘어난다**는 뜻이어야 한다.
>
> **배치 전후**
>
> | 스테이지 | 이전 | 이후 | 문제였던 점 |
> |---|---|---|---|
> | 1-10 | `giant_rhino_beetle` | 그대로 | 교과서형 첫 보스 — 유지 |
> | 1-20 | `giant_rhino_beetle` | **`royal_scarab_matriarch` 황금 갑충 여왕** | 1-10 과 **같은 보스**였다. 월드 1 의 관문 둘이 같은 문제를 냈다 |
> | 2-10 | `brawny_ogre` | **`crushing_cyclops` 짓뭉개는 외눈거인** | `boss.phases` 가 없어 **보스 모드인데 보스 시스템이 꺼진 채** 돌았다 |
> | 2-20 | `humongous_ettin` | **`mecha_golem` 고철 거신** | ettin 의 페이즈 시퀀스가 `giant_rhino_beetle` 과 **완전히 동일**했다 |
> | 3-10 | `grave_revenant` | **`undead_executioner` 무덤의 처형인** | 페이즈 없음 (2-10 과 같은 문제) |
> | 3-20 | `death_slime` | **`evil_wizard` 균열의 술사** | REGEN 축은 3-10 이 더 날카롭게 이어받았다 |
>
> `humongous_ettin` · `death_slime` 정의는 남겼다 — 월드 4–5(P6-03) 재배치 후보다.
>
> **5체가 서로 다른 질문을 하는가 (이것이 이 티켓의 합격 조건)**
>
> | 보스 | 페이즈 태그 | 고유 축 |
> |---|---|---|
> | 황금 갑충 여왕 (1-20) | `WARDED` → `ARMORED` → 무방비 | **순서가 뒤집힌다.** 1-10 에서 외운 순서가 그대로 틀린다 |
> | 짓뭉개는 외눈거인 (2-10) | `ARMORED` → `WARDED` → `ARMORED`(def 24) | **무방비 구간이 없다.** 끝까지 상성을 유지해야 하고, 대신 슬램 반경이 최대(132) |
> | 고철 거신 (2-20) | `ARMORED` → `WARDED` → 태그 없음 | **살아 있지 않다** — `LIVING`/`CORRUPT` 가 없는 유일한 보스라 신성이 특효도 페널티도 아니다. + 마지막 페이즈(35%)가 가장 위험하다 (공격 1.9배·이속 1.75배·슬램 4.5초) |
> | 무덤의 처형인 (3-10) | `CORRUPT+ARMORED+REGEN` → `CORRUPT+WARDED` → `CORRUPT+REGEN` | **재생이 돌아온다.** 3페이즈가 보너스 구간이 아니라 순DPS 시험이 된다 |
> | 균열의 술사 (3-20) | `CORRUPT+WARDED` → `CORRUPT+ARMORED` → `CORRUPT` | **유일한 술식·원거리 보스.** range 120 에서 arcane 을 쏜다 — 방벽이 붙잡지 못하고 방벽의 DEF 도 무시된다 |
>
> **아트**: `bosses` 아틀라스를 신설했다 (`MechaGolem` 4 · `UndeadExecutioner` 4 ·
> `EvilWizard` 8 프레임, 44KB / 1페이지). 거대화 엘리트 2체는 `units` 아틀라스의
> 미사용 프레임(`GiantRoyalScarab` · `CrushingCyclops`)을 쓴다.
> 아이들 루프만 넣는다 — 보스만 공격 애니를 갖게 하면 몬스터 150종이 전부 아이들뿐인
> 화면에서 **보스만 다른 게임처럼 움직인다**. `tools/lib/slice.mjs` 에 프레임 접두어를
> 문자열로 지정하는 `name` 옵션을 추가했다 (보스 팩은 파일명이 `Idle.png`/`idle.png` 라
> 그대로 쓰면 팩끼리 충돌한다).
>
> #### 튜닝 중에 드러난 **시뮬 결함 2건** — 둘 다 데이터로는 고칠 수 없었다
>
> | # | 증상 | 원인 | 조치 |
> |---|---|---|---|
> | 1 | **보스를 강하게 만들수록 승률이 올라갔다.** hpMult 를 45→62 로 올리자 6개 보스 스테이지가 전부 20/20 승리 (`bossDead: false`) | `stepBreach` 는 방주에 닿은 적을 **필드에서 제거한다.** 보스도 예외가 아니어서, 보스가 전선을 지나쳐 걸어가면 필드가 비고 "전 웨이브 격퇴 = 승리"가 발동했다. 방주 HP 30 을 깎고 사라지는 것이 '보스를 놓친' 대가였다 | `noteBossBreach` → `modeState.bossBreached` → **패배**. `modes.test.js` 는 이미 "보스전 승리 ⇒ bossDead" 를 단언하고 있었다 — 규칙이 데이터 운(運)에 기대고 있었을 뿐이다 |
> | 2 | 슬램이 지휘관을 **한 방에 즉사**시켰다 (P6-05 가 고쳤던 그 문제의 재발) | P6-05 는 `bossSlamCommanderMult = 0.5` 라는 **배율**로 고쳤다. 그런데 지휘관 HP 는 600 고정이고 보스 ATK 는 스테이지 지수 커브를 탄다 — 실측 1-10 **278** → 3-20 **51,260** (184배). 단위가 다른 두 값을 곱하고 있었으므로 어떤 배율값도 전 월드에서 성립할 수 없다 | 피해에 **최대 HP 비율 상한**을 걸었다 (`combat.bossSlamCommanderHpRatio = 0.3`, 최소 4방). 월드 1 은 원래 피해(130~190)가 상한(180) 근처라 체감이 그대로고, 월드 2 이후에만 상한이 작동한다. **월드가 몇 개 늘어나도 규칙이 유지된다** |
>
> > 2번의 교훈은 P6-05 의 `regenRatioGiant` 와 정확히 같다 —
> > **고정 상수와 지수 스케일 값을 곱하면 언젠가 반드시 깨진다.**
> > 두 번 같은 모양으로 나왔으므로 이제는 패턴으로 봐야 한다.
>
> **밸런스 (6 보스 스테이지 × 11 편성 × 30 시드 = 1,980 전투)**
>
> | 스테이지 | recommended | 최강 아키타입 | 최약 아키타입 |
> |---|---|---|---|
> | 1-10 | 100.0% | — (튜토리얼 보스, 미변경) | `no_blocker` 36.7% |
> | 1-20 | **63.3%** | `r_only` 100% · `holy_heavy` 90% | `arcane_heavy` **23.3%** (1페이즈가 WARDED) |
> | 2-10 | **53.3%** | `r_only` 100% | `arcane_heavy` **6.7%** |
> | 2-20 | **63.3%** | `holy_heavy` 46.7% | `physical_only` 23.3% · `arcane_heavy` 23.3% |
> | 3-10 | **60.0%** | `physical_only` 90% | `arcane_heavy` **10.0%** |
> | 3-20 | **66.7%** | `physical_only` 93.3% | `r_only` 20.0% |
>
> 목표 45–75% 를 5체 전부 만족한다. 더 중요한 것은 **보스마다 최약 아키타입이 다르다**는
> 것이다 — 같은 편성이 6개 보스를 다 통과하지 못한다. 이것이 페이즈 태그가 실제로
> 편성 퍼즐을 만들고 있다는 유일한 증거다.
>
> **남은 문제**
> - 3-20 은 `recommended`(66.7%) 보다 `physical_only`(93.3%)·`balanced`(90%) 가 강하다.
>   `tools/lib/loadouts.mjs:recommendedLoadout` 이 **원거리 arcane 보스**를 읽지 못한다
>   (태그만 보고 dmgType·range 를 보지 않는다). 하네스 쪽 문제이므로 별도 티켓.
> - `arcane_heavy` 가 5개 보스 중 4개에서 최약이다. 보스 설계가 아니라 술식 로스터
>   자체의 문제로 보인다 (P6-04 잔여분).
> - 전체 `balance:check`(60스테이지 × 300시드)는 이번에도 돌리지 못했다. **하드 게이트 미검증.**
>
> ### P6-05 보스 시스템 — 구현 노트 (2026-08-02)
>
> `src/game/logic/boss.js` 가 규칙을, `enemies.json:boss.phases` 가 수치를,
> `presenters/BossPresenter.js` 가 월드 표현을 갖는다.
>
> **페이즈마다 태그가 바뀌는 것이 이 시스템의 전부다.**
> 보스가 그냥 HP 큰 적이면 답은 "가장 센 딜러" 하나뿐이고 보스전은 스탯 검사로 끝난다.
> 태그가 바뀌면 **한 편성 안에 서로 다른 답을 같이 넣어야 하는** 유일한 지점이 된다 —
> 상성 시스템이 스테이지 단위가 아니라 *전투 안에서* 작동하는 곳이다.
>
> | 페이즈 | 태그 | 요구되는 답 |
> |---|---|---|
> | 1 (100%) | `ARMORED` | 술식 (DEF 무시) |
> | 2 (60–65%) | `WARDED` | 물리 (RES 회피) |
> | 3 (30%) | 방어 포기 · 공속/이속 급증 | 화력 총동원 |
>
> **예고 0.8초 2종** — 전환 예고(보스 정지 + 배너 + 새 태그 글자 표기)와
> 슬램 예고(바닥 위험 영역). 슬램은 **지휘관 레인**을 노린다.
> 동료는 자동 전투라 피할 수 없고 지휘관만 플레이어가 직접 움직이므로,
> 여기가 이 게임에서 **회피가 실력이 되는 유일한 지점**이다. 맞으면 기절 →
> 오라 공백 → 전선 전체가 약해진다. 지휘관이 멀면 아군이 가장 많은 레인을 노려
> "뒤로 빼두면 무료"를 막는다.
>
> **테스트가 잡은 설계 결함 1건 — 태그가 장식이었다**
> | 증상 | 원인 | 조치 |
> |---|---|---|
> | `WARDED` 페이즈인데 물리가 술식보다 여전히 약했다 (74 vs 100) | 페이즈 방어를 `defMult`/`resMult` **배율**로 잡았는데 보스 base `res` 가 0 이라 `0 × 1.5 = 0`. **태그만 바뀌고 상성은 그대로**였다 — 시스템 전체가 연출로 전락 | 페이즈 def/res 를 **절대값**으로 변경. 난이도 커브가 def/res 를 건드리지 않으므로 일관된다. `태그 ↔ 실제 수치` 일치를 테스트로 고정 |
>
> **검증**: 보스 테스트 27개. 인접 페이즈 태그 상이 · ARMORED/WARDED 동시 보유 금지
> (= 아무것도 안 통하는 벽 금지) · 예고 중 정지 · 임계값 2개 동시 돌파 시 최종
> 페이즈로 1회 전환 · 페이즈 역행 없음 · B1 결정론.
>
> ### P6-05 밸런스 — 처음 구현이 보스전을 망가뜨렸다 (같은 날 수정)
>
> 하네스를 돌리자 **3-20 이 벽이 됐다.** 보스 페이즈를 넣기 전 100% 승률이던
> 스테이지가 recommended 60% / 나머지 대부분 0~30% 로 무너졌고 평균 327초
> (제한 400초)로 사실상 타임아웃이었다.
>
> 원인을 하나씩 계측해 **세 개**를 찾았다.
>
> | # | 원인 | 근거 | 조치 |
> |---|---|---|---|
> | 1 | **회복 + RES = 소프트락** | 3-20 보스 HP 9,637,403 · 회복 **192,748/s**. 2페이즈에 `res 44` 를 붙이자 순DPS 가 회복량 아래로 떨어져 **400초 내내 HP 100% 유지**. 보스가 죽지 않았다 | REGEN 을 방어 페이즈에서 제거. `res` 는 술식·신성 **둘 다** 깎으므로 세 답 중 둘이 동시에 막힌다 (`def` 는 물리 하나만 막으므로 공존 가능) |
> | 2 | **비율 규칙이 배율과 곱해져 깨졌다** | REGEN 회복량이 `최대HP × 2%` 였다. 400HP 잡몹에는 8/s 로 적정하지만 HP 배율 32 배 보스에서는 192,748/s 가 된다. **거대화는 HP 배율이지 회복 배율이 아니다** | `combat.regenRatioGiant = 0.0025` 분리. 이 버그는 P6-05 이전부터 있었고 페이즈가 드러냈을 뿐이다 |
> | 3 | **슬램이 지휘관을 즉사시켰다** | 자동 조작은 예고를 보고 피하지 않는다 → **매 슬램마다 기절** → 오라가 7~10초마다 사라져 전선이 영구히 무너진다 | 즉사 → **피해**로 변경 (`bossSlamCommanderMult 0.5`). 한 번은 견디고 연속으로 맞으면 기절한다. 동료 피해량도 하향 — 동료는 구조적으로 회피할 수 없다 |
>
> **교훈: 회피는 "잘하면 이득"이어야지 "못하면 파탄"이면 안 된다.**
> 이 게임의 회피 주체는 지휘관 하나뿐이고 동료는 자동 전투다. 회피 실패에
> 즉사를 걸면 그것은 실력 표현이 아니라 그냥 세금이다.
>
> **수정 후 (보스 6스테이지 × 9편성 × 25시드)**
>
> | 스테이지 | recommended | balanced | physical_only | arcane_heavy |
> |---|---|---|---|---|
> | 1-10 | 100% | 100% | 100% | 88% |
> | 1-20 | 100% | 100% | 100% | 100% |
> | 2-10 | 100% | 100% | 100% | 100% |
> | 2-20 | 100% | 100% | 100% | 84% |
> | 3-10 | 100% | 100% | 100% | 100% |
> | 3-20 | 100% | 96% | 100% | **4%** |
>
> **3-20 의 `arcane_heavy` 4% 는 의도된 결과다.** 2페이즈가 `WARDED` 이므로
> 술식 단일 편성은 보스전 중반에 답이 사라진다 — "단일 딜러가 지배하지 못한다"가
> 데이터로 나타난 것이다. `spam_cheapest`·`turtle`·`no_blocker` 0% 는 설계상
> 실패해야 하는 아키타입이며 P6-05 이전과 동일하다.
>
> **⚠ 미검증**: 전체 `balance:check`(60스테이지 × 9편성 × 300시드 ≈ 162,000 전투)는
> 약 2시간이 걸려 이번에 돌리지 못했다. **하드 게이트는 아직 검증되지 않았다.**
> 위 수치는 보스 6스테이지 × 25시드 부분 검증이다.
>
> **회귀 방지**: `validate-data.mjs` 에 보스 페이즈 검사를 추가했다 —
> 태그↔실제 def/res 일치 · ARMORED+WARDED 동시 금지 · **REGEN+높은 res 금지** ·
> 인접 페이즈 태그 상이 · 마지막 페이즈 방어 포기. 세 위반을 실제로 잡는 것을 확인했다.
>
> ### P6-04 동료 확장 1차 — 구현 노트 (2026-08-02)
>
> **10종 → 19종.** 원칙: **현재 시뮬이 이미 지원하는 능력만으로 성립하는 동료만 넣는다.**
> 데이터만 채우면 로스터 숫자는 늘지만 "적혀 있는 능력이 실제로는 없는" 유닛이 생긴다.
>
> 추가: `goblin_fighter` · `halfling_slinger` · `goblin_archer` · `merfolk_javelineer`
> · `elf_wayfarer` · `leaf_ranger` · `wind_hashashin` · `iron_golem` · `magical_fairy`
> → 원거리 역할이 1종에서 7종으로 채워졌고, **공중 아군(FLYER)이 처음 생겼다.**
>
> **대기 중인 25종과 필요한 메커니즘** (이것이 P6-04 잔여분의 실제 작업 목록이다)
>
> | 메커니즘 | 대기 동료 |
> |---|---|
> | 광역(splash) | 성난 멧돼지 · 수정 파쇄자 · 능숙한 여마법사 · 대지 정령 · 증기 폭격기 · 황동 새끼용 · 단호한 천사 · 여사제 |
> | 반격(counter) | 리자드 검투사 · 성십자 기사 |
> | 도발(taunt) | 꽥꽥 거위(현재 일반 방벽으로만 동작) |
> | 처형 · 돌진 · 넉백 | 하플링 도적 · 성난 멧돼지 · 수정 파쇄자 |
> | 아군 버프/부여 | 엘프 부여술사 · 음유시인 · 물의 여사제 |
> | 적 디버프 | 인어 수술사 · 냄새나는 스컹크 · 사악한 마녀 |
> | 부활 | 부유하는 케루빔 |
> | SPECIALIST 역할 전반 | 인어 정찰병 · 하플링 암살자 · 수상한 사내 · 야옹거리는 고양이 · 예언자 |
> | 피해 감산 배율 | 강철 파수꾼 |
>
> **확장하면서 잡은 버그 3건**
> - **`bold_man_at_arms` 가 마젠타 플레이스홀더로 뜨고 있었다.** `art.frame` 이
>   `BoldMan-at-Arms` 인데 아틀라스는 `BoldManAtArms` 다. 스타터 방벽인데
>   아무 검사도 걸리지 않았다 → `validate-data.mjs` 가 **아틀라스에 프레임이
>   실제로 있는지** 검사하도록 추가했다.
> - **`UnitPresenter` 가 `${frame}/0` 을 가정했다.** 아틀라스가 동일 프레임을
>   중복 제거해서 인덱스가 듬성듬성하다 (`BoldManAtArms` 는 /1, /2 만 존재).
>   존재하는 첫 프레임을 찾도록 고쳤다.
> - **`normalizeDef` 가 `pierce` 를 버리고 있었다.** `spawn.js` 는 `def.pierce` 를
>   읽는데 정규화가 옮기지 않아, 데이터에 적어도 조용히 0 이 됐다.
>
> **밸런스에서 배운 것 — 사거리는 보상이 아니라 작동 조건이다.**
> `iron_golem` 을 사거리 200 · 속도 10 으로 잡았더니 전선이 앞서 나가
> **한 발도 쏘지 못했다 (기여도 정확히 0).** 아군은 사거리 안에 적이 들어와야
> 멈추므로(engage), 느린 포대는 **방벽 뒤에서 넘겨 쏠 사거리**가 없으면 존재하지 않는다.
>
> **⚠ 남은 문제 — 자동 플레이가 비싼 유닛을 영원히 소환하지 않는다.**
> `autoPlay.js` 는 매번 *가장 싼* 소환 가능 유닛을 고르므로 마나가 모이지 않는다.
> 그 결과 **E·L 등급이 밸런스 하네스에서 한 번도 검증되지 않는다.**
> GDD §5 의 "모든 등급이 최소 1개 스테이지의 최적 편성에 포함되는지 매 빌드 검증"
> 규칙이 현재 구조로는 통과할 수 없다. 정책 변경은 전 스테이지 밸런스를 움직이므로
> 별도 티켓으로 다룬다.

> **모드에서 배운 것**
> - **모드는 난이도가 아니라 승리 조건이다.** 물량을 그대로 두고 목표만 바꿔야
>   편성 퍼즐이 모드마다 다시 풀린다.
> - **모드가 무언가를 빼앗으면 물량도 같이 줄인다.** 버티기(소환 경제 박탈)를
>   같은 물량으로 두었더니 1-13 이 승률 0% 벽이 됐다 → `modeDensityMult` 도입.
> - **균열·수레 HP 를 스테이지 *총* 적 HP 에 비례시키면 안 된다.** 웨이브가 긴
>   스테이지에서 같이 부풀어 수레 HP 8만(무적) · 돌파 204초가 나왔다.
>   균열은 *적 개체 평균 HP × N*, 수레는 *적 최대 공격력 × 피격 횟수* 기준이다.
> - **버티기를 소환 튜토리얼 직후에 두지 않는다.** 방금 가르친 조작을 빼앗는 꼴이다
>   (x-3 → x-13 으로 이동).

> ### P6 게이트 — 1차 전수 측정 (2026-08-02)
>
> **60 스테이지 × 9 편성 × 300 시드 = 162,000 전투 / 81분.**
> P4 게이트는 월드 1(7 스테이지)만 있을 때 통과한 것이고, 월드 2–3 이 들어온 뒤
> 전수 측정은 이번이 처음이다.
>
> **결과: 통과 3/12 · 하드 실패 6 · 소프트 실패 3 → 빌드 차단.**
>
> | 게이트 | 결과 | 실패 내용 |
> |---|---|---|
> | B2 튜토리얼 승률 ≥85% | ✔ | 100/100/100% |
> | B6 스팸 억제 | ✔ | 60/60 스테이지에서 스팸 열세 |
> | B13 각인 픽률 | ✔ | 30/30 등장 |
> | **B3** 설계된 첫 패배 30–45% | ✗ | 1-9 가 **95.7%** — 너무 쉽다 (→ P7-03) |
> | **B4** 무과금 추천 ≥55% | ✗ | **2-13 이 14.3%** |
> | **B5** ARMORED 에 술식 > 물리 | ✗ | 1-8 · 1-9 · 1-10 |
> | **B7** 전 동료 1회 이상 등장 | ✗ | `goblin_fighter` 미사용 (→ autoPlay 정책, P6-04 노트) |
> | **B16** 방벽 없는 편성 열세 | ✗ | 3-13 · 3-19 에서 방벽없음이 **더 높다** |
> | **WALL** 벽 스테이지 0개 | ✗ | **2-13 (14.3%)** |
> | B9/B10/B11 (소프트) | ✗ | 전투 길이 · ★2 96.9% · ★3 57.8% |
>
> **P6-05(보스)가 원인이 아니다 — A/B 로 확인했다.**
> B5 는 1-10 이 보스 스테이지라 의심스러웠으나, **보스 페이즈를 제거하고
> 다시 돌려도 1-10 은 여전히 실패했다** (술식 92HP/186s vs 물리 96HP/174s).
> 6개 하드 실패 전부 월드 2–3 콘텐츠가 들어오면서 생긴 기존 상태다.
>
> **가장 급한 둘**
> - **2-13** — B4·WALL·B16 을 한꺼번에 깨는 단일 스테이지. 버티기(endure) 모드이며
>   추천 편성 14.3%. 모드가 소환을 잠그는데 물량이 그에 맞게 줄지 않았을 가능성.
> - **B16 역전 (3-13 · 3-19)** — 방벽 없는 편성이 균형 편성보다 **높다.**
>   이 게임의 구조적 심장이 월드 3 에서 뒤집혀 있다는 뜻이므로 우선순위가 가장 높다.
>
> - [x] **월드 1–5 (100 스테이지) 밸런스 하드 게이트 통과** — 2026-08-03, 아래 2차 전수 측정

> ### B3 · B5 · B7 해소 — 구현 노트 (2026-08-03)
>
> 세 하드 실패 중 **둘은 게임이 아니라 하네스가 틀린 것**이었다.
> 수치를 조이기 전에 측정 도구를 먼저 의심해야 한다는 사례로 남긴다.
>
> | 게이트 | 진짜 원인 | 조치 |
> |---|---|---|
> | **B5** | 데미지 타입이 아니라 **인원수**. 로스터에 술식이 2종뿐이라 `arcane_heavy` 가 `방벽+2 = 3인` 으로 구성돼 6인 `physical_only` 와 싸우고 있었다 | 아키타입 **6칸 패딩**(`padTo6`) + 술식·신성 동료 6종 추가 |
> | **B7** | `goblin_fighter` 는 성능이 아니라 `take(byDmg("physical"), 6)` 의 **파일 순서**에서 밀렸다. 마나 효율은 오히려 상위였다 | 실제 검증축인 **등급 티어 편성**(`c_only` · `r_only`) 추가 → 25/25 전원 등장 |
> | **B3** | 이건 진짜 난이도 문제였다 | 1-9 `difficultyMult` 2.75 → **3.6** |
>
> **B3 튜닝 근거 (실측, 3.6 은 200시드)**
>
> | 배율 | 2.75 | 3.2 | 3.5 | 3.55 | **3.6** | 3.65 | 3.8 | 4.0 |
> |---|---|---|---|---|---|---|---|---|
> | 추천 편성 승률 | 92.5% | 65.0% | 51.7% | 42.5% | **39.5%** | 31.7% | 33.3% | 22.5% |
>
> 목표 밴드 30–45% 의 중앙을 잡았다. 가장자리(3.55·3.8)는 시드 노이즈(±3~4%)로
> 밴드를 벗어날 수 있어 피했다. `stages.json` 과 `worlds.json` **양쪽**에 넣었다 —
> `worlds.json` 을 빠뜨리면 `gen-stages.mjs` 재생성 때 조용히 2.75 로 돌아간다.
>
> **로스터 확장 (P6-04, 19 → 25종)**
> 술식 3종(`deft_sorceress` · `fire_elemental` · `adept_necromancer`) ·
> 신성 3종(`holy_crusader` · `favored_cleric` · `resolute_angel`).
> 메꾼 구멍: **근접 술식 0종**(ARMORED 앞에서 물리 근접이 무력했다) ·
> **신성 방벽 0종**(방벽 3종이 전부 물리라 CORRUPT 웨이브에서 앞줄이 버티기만 했다) ·
> **지원 1종**(SUPPORT 의 시그니처인 "오라 *밖*에서만 작동"이 선택이 될 수 없었다).

> ### enemyScale 레인 배수 버그 — 수정 노트 (2026-08-03)
>
> **`src/game/logic/stageConfig.js:enemyScale()` 이 마릿수를
> `spec.count * lanes.length` 로 세고 있었다.**
> 그런데 `spawn.js:queueWave()` 는 `lanes[i % lanes.length]` 로 count 마리를
> 레인에 **나눠** 보낸다 — 레인마다 count 마리가 아니다.
>
> 레인 수가 다른 스폰이 섞이면(측정해 보니 **60/60 스테이지 전부**) 3레인 스폰이
> 1레인 스폰의 3배 무게를 갖게 되어 가중평균 HP 가 틀어졌다.
>
> 소비처는 `riftHp`(돌파) 하나다 — `cartHp`(호위)는 `maxAtk` 를 쓰므로 영향이 없다.
> **돌파 6 스테이지에서 균열 HP 가 7~15% 과다**였다:
> 3-16 −14.6% · 1-6 −11.2% · 2-6 −10.3% · 3-6 −9.4% · 2-16 −9.4% · 1-16 −7.2%.
>
> P6-09 스테이지 프리뷰를 만들며 같은 계산을 다시 하다가 **두 구현이 어긋나서**
> 드러났다. 회귀 고정 테스트는 `modes.test.js` 에 있고, 구현을 따라 쓰지 않고
> **원본 스폰 테이블에서 다시 세어** 대조한다.

> ### 유닛 겹침 — 수정 노트 (2026-08-03, 제보)
>
> 같은 편 유닛이 같은 레인 같은 x 에 있으면 스프라이트가 **정확히 포개져
> 한 마리로 보였다.** 4마리를 냈는데 화면엔 1마리다 — 코스트를 썼는데 쓴 티가
> 안 나면 게임이 망가진다.
>
> `UnitPresenter.syncCrowd()` 가 x 가 붙은 같은 편 유닛을 세로 부채꼴로 흩는다.
> 시뮬 x 는 건드리지 않는다 (사거리·블록 판정 불변). 순번은 레인 배열 순서
> (=x 정렬)에서 유도한다 — 난수를 쓰면 프레임마다 자리가 바뀌어 떨린다.
>
> **깊이를 최종 화면 y 로 다시 정하는 것이 절반이다.** y 만 옮기고 깊이가 그대로면
> 그리는 순서가 뒤죽박죽이라 여전히 뭉쳐 보인다. 기존 `syncPassBy` 의 깊이 지정을
> `sync()` 로 합쳐 한 곳에서 정한다.

> - [ ] **벽 스테이지 0개** (승률 <25% 또는 시도 >4회) ← 현재 2-13
> - [ ] 각 월드의 "요구 답안" 동료가 그 월드 시작 전에 획득 가능 (자동 검증)
>
> > ⚠ 이 측정은 `combat.blockMinGap` 도입 **전**에 시작됐다. 튜닝 착수 전 재측정 필요.

---

> ### P6-11 생성 이미지 연결 — 126장이 전부 유휴였다 (2026-08-02)
>
> `asset/generated/` 에 배경 40 · 구조물 5 · UI 키트 41 · 스토어 40 = **126장이
> 있었는데 하나도 쓰이고 있지 않았다.** 화면의 초록 사각형 배경 · 갈색 방주 기둥 ·
> 보라 균열 선 · 주황 지휘관이 전부 도형 플레이스홀더였다.
>
> | 항목 | 조치 |
> |---|---|
> | 배경 40 | `passthrough` 로 `public/assets/bg/` 배포 → `ParallaxLayers` TileSprite. **월드별 4장만 지연 로드** (40장 전체는 3.3MB, 한 전투에 필요한 건 4장 ≈ 300KB) |
> | 구조물 5 | `StructurePresenter` 신규. 방주는 **HP 에 따라 100 → 66 → 33 자동 전환**(불타기 시작하면 바를 안 봐도 위급하다는 것이 읽힌다), 균열은 8프레임 스트립이며 템포 시프트에서 `expanded` 로 전환 |
> | UI 키트 41 | Phaser 는 아틀라스(19KB), CSS 는 개별 png. **태그 8종이 `EnemyBadges` 의 이모지를 대체**, 별 on/off, 카드·패널 9-slice |
> | 지휘관 | `FREE_Adventurer` 96×80 × 8프레임. IDLE/RUN 좌우 4장, 이동 방향에 따라 자동 전환 |
>
> **배치는 계산으로 유도하면 안 된다.** far/mid 를 "하단 정렬"로 계산했더니
> 브리프 규격보다 160px 떴다. 레이어 높이(720/480/400/240)와 y(0/240/320/480)가
> 서로 맞물려 설계되어 있다 — 브리프 §2.1 의 값을 그대로 상수로 둔다.
>
> **아트가 좋아질수록 레인이 안 보인다.** 도형 배경 위에서 충분했던 레인
> 구분선(검정 0.25)이 디테일한 픽셀 배경 위에서는 사라졌다. 아트 배경일 때는
> 레인 바닥에 어두운 띠를 깔아 유닛이 앉을 자리를 만든다.
>
> **아이콘 가드에 구멍이 있었다.** 1차 적용 때 `.jsx` 만 검사해서
> `EnemyBadges.js` 의 이모지 태그 배지(🛡✦▲…)를 놓쳤다 — 게임에서 가장 중요한
> 상성 표기가 이모지였다. 린트 규칙을 Phaser 프레젠터·씬까지 확장했다.
>
> ### 레터박스 제거 · 발사체 개별화 (2026-08-02)
>
> **레터박스 제거 — `Scale.FIT` → `Scale.RESIZE` + `viewport.js`**
>
> 20:9 기기에서 좌우 240px 씩(화면의 20%)이 검은 띠였다.
> **세로 720 만 고정**하고(zoom = 화면높이 / 720) 가로만 연다. 그래서
> 레인 y · 방주 x · 균열 x 등 **기존 좌표 상수가 하나도 바뀌지 않고**,
> 넓은 화면에서는 x<0 · x>1280 구역이 추가로 보일 뿐이다. 그 구역은 배경만
> 채우며 게임플레이는 여전히 0~1280 안에서만 일어난다.
> (ENVELOP 은 세로를 잘라 HUD·레인이 화면 밖으로 나가므로 쓸 수 없다.)
>
> **여기서 잡은 함정 2개 — 둘 다 "숫자는 맞는데 화면은 비어 있는" 형태였다**
>
> | 증상 | 원인 | 조치 |
> |---|---|---|
> | 우측 53px 검은 띠 · 세로 23px 어긋남 | **`cam.centerOn()` 이 줌을 무시한다.** Phaser 는 `scrollX = x - cam.width * 0.5` 로 잡는데 `cam.width` 는 화면 픽셀이고 줌이 1이 아니다 (실측: 카메라 −128~1514 vs 배경 −181~1461) | 스크롤을 `화면크기 / 줌` 으로 직접 계산 |
> | 카메라·배경 범위가 **정확히 일치하는데도** 우측이 빔 | **`TileSprite.setSize()` 로 늘린 영역은 그려지지 않는다.** 캔버스 픽셀을 직접 읽어 확인 — x1400 부터 `#0F0F1E`(클리어 색)였다 | 타일을 **디자인 폭 3배로 한 번만 만들고 크기를 절대 바꾸지 않는다.** 타일은 무한 반복이라 어떤 화면비든 덮이고, 카메라가 잘라내므로 비용은 보이는 만큼이다 |
>
> ★ Boot·Preload 에는 뷰포트를 걸지 않는다 — 로딩 화면은 좌표계가 필요 없다.
>
> ★ **디버깅 노트: `loop.frame` 이 0 이면 코드를 의심하기 전에 탭 가시성을 본다.**
>   백그라운드 탭에서는 `requestAnimationFrame` 이 완전히 멈춰 씬 전환 큐가
>   처리되지 않는다. "Boot 에서 멈춘다"로 오진하기 쉽다 (실제로 그랬다).
>   자동 검증 시에는 `game.loop.step(t)` 를 수동 호출해 구동한다.
>
> **발사체 개별화 — 원거리 12종이 전부 같은 화염탄을 쏘고 있었다**
>
> 원인이 세 겹이었다:
> - manifest 가 시트 8장 중 2장 · 25행 중 4행만 패킹 → **화살촉 행이 아예 없었다**
> - `units.json` 에 `projectile` 필드 자체가 없었다
> - `normalizeDef` 가 그 필드를 옮기지 않았다 — **`pierce` 가 당한 것과 같은 유형**
>
> 슬라이서에 `maxCols` 를 추가해(행마다 앞쪽 10열만) 행을 8개로 넓혔고,
> 아틀라스는 오히려 264 → 144 프레임으로 **줄었다**. 12종에 화살촉·꼬리화살·
> 돌팔매·작살·표창·가시·포탄·화염탄·신성섬광·별빛을 배정했다.
> 발사체는 `defId` 를 들고 다니고(아트가 아니라 id — logic 은 스프라이트를 모른다),
> 렌더가 그것으로 프레임을 고른다. 쏜 유닛이 먼저 죽어도 스프라이트가 유지된다.
>
> ### 제보 버그 2건 (2026-08-02)
>
> **① "3개 레인 중 원하는 곳에 소환할 수 없다" → 조작은 있었고, 알 방법이 없었다.**
>
> 실제 마우스 드래그로 검증한 결과 슬롯 → 레인 드래그는 **정상 동작**했고
> 요청한 레인에 정확히 배치됐다. 문제는 화면이 그 조작을 한 번도 알려주지
> 않는다는 것이다. 탭만 해 본 플레이어는 자동 배치만 보고 "레인을 고를 수 없다"고
> 결론짓는다. **조작이 존재해도 발견할 수 없으면 없는 것이다.**
>
> → 슬롯에 손을 대는 순간 **3레인 전부를 드롭 대상으로** 그린다.
>   손가락이 아직 전장 밖이면 **자동 배치가 고를 레인**을 미리 강조한다 —
>   탭의 결과가 예측 가능해진다.
>   (이전에는 `lane==null` 이면 하이라이트를 지워서, 누른 직후 아무것도 안 보였다)
>
> **② "적이 아군 근접 유닛을 통과한다" → 절반은 설계, 절반은 진짜 버그.**
>
> - **근접(MELEE)이 안 막는 것은 설계다.** `BLOCKER` 만 전진을 저지한다.
>   "방벽 없이 딜러만 편성하면 적이 걸어서 방주까지 온다"가 이 게임의 구조적
>   심장이고 B16 게이트가 지킨다. → 규칙을 바꾸지 않고 **읽히게** 만들었다:
>   `BlockPresenter` 가 방벽↔붙들린 적을 잇는 고정선과 방벽 발밑 용량 칸(●●)을
>   그린다. 근접에는 아무것도 안 그린다 — **그 대비가 곧 설명이다.**
>
> - **겹쳐 서는 것은 진짜 버그였다.** 계측 결과 블록된 적과 방벽의 거리가
>   **0px** 인 경우가 재현됐다. 용량이 찬 동안 적이 방벽을 지나쳐 파고들고,
>   앞의 적이 죽어 슬롯이 비는 순간 **이미 방벽 위에 올라선 적이 그 자리에서**
>   블록된다. 완전히 겹치므로 "통과했다"로 보인다.
>   → `combat.blockMinGap = 20`. 이미 파고든 적은 **뚫린 것으로 취급**한다.
>   뒤늦게 끌어당겨 잡는 것은 "용량을 넘기면 샌다"는 규칙 위반이기도 하다.
>   최소 거리 **0px → 21px**. 5스테이지 스팟체크에서 승률 변동 없음.
>
> ### ⚠ P6 진행 중 발견 — 전 씬의 `shutdown()` 이 죽은 코드였다 (2026-08-02)
>
> **제보:** "노래가 겹쳐서 들린다."
>
> **실측:** 전투에 한 번 들어가면 같은 루프 BGM 이 **2개** 생기고, 나갔다 들어올
> 때마다 하나씩 쌓였다 (관측 최대 8트랙 동시 재생).
>
> **원인 2개가 겹쳐 있었다.**
>
> | # | 원인 | 설명 |
> |---|---|---|
> | 1 | **Phaser 는 씬의 `shutdown()` 을 자동 호출하지 않는다** | 자동 연결되는 훅은 `init`·`preload`·`create`·`update` 뿐이다. `Systems.shutdown()` 은 SHUTDOWN 이벤트를 emit 할 뿐 같은 이름의 메서드를 부르지 않는다. 즉 **세 씬에 정성껏 써 둔 `shutdown()` 이 한 번도 실행된 적이 없었다.** 구독 해제·트윈 킬·풀 해제·오디오 정지가 전부 죽은 코드였고, 절대규칙 3 을 "지키고 있다고 믿고만" 있었다 |
> | 2 | StrictMode 이중 이펙트 → `create()` 2회 | `switchScene` 이 한 태스크에 2번 호출되면 Phaser 가 부팅 요청을 큐에 2번 쌓아 `create()` 가 `shutdown` 없이 두 번 돈다. 첫 번째 `AudioManager`·프레젠터·풀이 전부 참조를 잃은 채 살아남는다 |
>
> **조치**
> - `GameManager.wireShutdownHooks()` — 씬의 `shutdown` 을 SHUTDOWN 이벤트에 **중앙에서** 연결한다. 씬마다 등록하게 두면 빠뜨린 씬이 조용히 누수되고, 그 누수가 이 스택에서 가장 찾기 어렵다. `once` 가 아니라 `on` 이다 (씬 인스턴스는 stop/start 로 재사용된다)
> - `GameManager.switchScene()` — 같은 태스크의 중복 요청을 마이크로태스크로 **하나로 합친다.** 진짜 재시작(재도전·다음 스테이지)은 다른 태스크이므로 그대로 동작한다
> - `AudioManager.addLayer()` — 같은 키의 유령 루프를 먼저 정리한다. BGM 레이어는 **전역 유일**이 불변식이다 (`scene.sound` 는 씬이 아니라 게임 전역 SoundManager 다)
> - 세 씬의 `shutdown()` 을 `create` 이전 호출에도 안전하게 (`?.`). 정리 코드가 throw 하면 **그 뒤의 정리가 통째로 건너뛰어진다** — 실제로 이 경로로 BGM 이 안 꺼졌다
>
> **검증:** 라우트 7회 전환 + 55ms 간격 연타 14회 후에도 동시 재생 트랙 **1개**,
> 전투를 나가면 **0개**. 콘솔 예외 0.
>
> **남은 관찰:** 같은 전투 라우트로 재진입해도 씬이 재시작되지 않는다
> (`_finished` 가 true 로 남아 있었다). 결과 화면의 "재도전"이 이 경로를 타는지
> P7-01 FTUE 작업에서 확인할 것.

---

## P7 — FTUE & 수익화 (4주)

> ## ⛔ 이 절은 **역사 기록**이다
> 수익화 산출물은 2026-08-04 경량화로, **FTUE 는 같은 날 전수 주행 뒤 삭제**됐다.
> 지금 남아 있는 온보딩은 가이드 오버레이 하나다 — `34-scope-cut.md` ⑨.

| ID | 크기 | 작업 |
|---|---|---|
| P7-01 | XL | ✅ **FTUE 정밀 구현** — `16-ftue.md` 타임라인 그대로 (0:00~12:00) (2026-08-03) |
| P7-02 | M | ✅ 가이드 탭 12회 예산 검증 — **실측 12/12**, 테스트로 고정 (2026-08-03) |
| P7-03 | M | 🟡 1-9 패배의 質 — **구조적으로 규명됨 · 설계 결정 대기** (2026-08-03). 80격자점 탐색, 지표 자체가 밀도 곡선을 재고 있음을 밝힘. B3 은 38% 로 통과 중 |
| P7-04 | L | ✅ **FTUE 계측 이벤트 20종 + 퍼널 대시보드** — 이름 양방향 일치 · 속성 차단 (2026-08-03) |
| P7-05 | L | ✅ **가챠 — 클라이언트 시드 롤 + 전량 로깅** (rollId/seed/tableVersion/pity) — **서버 롤에서 변경됨** (2026-08-03) |
| P7-06 | M | ✅ **확률 공개 UI** — 배너에서 1탭, 천장 조건 전문 (2026-08-03) |
| P7-07 | M | ✅ **소환 연출** — 결과는 연출 **전에** 확정, 스킵 시 0ms (2026-08-03) |
| P7-08 | L | ✅ **배틀패스 시즌 1** — 28일 · 50레벨 · 3트랙, 결제는 목(mock) (2026-08-03) |
| P7-09 | M | ✅ **상점 · 스타터팩 · 젬 팩** — 결제는 목(mock) (2026-08-03) |
| P7-10 | L | ✅ **리워드 광고 — 배치 7종 + 상한 8회 + 어댑터 경계** (실 SDK 없음, fail-closed) (2026-08-03) |
| P7-11 | M | ✅ **일일 로그인 28일 + 스트릭 보호** — KST 리셋, 시계 조작 방어 (2026-08-03) |
| P7-12 | M | ✅ **일일/주간 퀘스트** — 목표 4종, 전투 종료가 유일한 생산자 (2026-08-03) |
| P7-13 | M | ✅ **로컬 알림 + 권한 요청 타이밍** — 서버가 없으므로 원격 푸시는 범위 밖 (2026-08-03) |
| P7-14 | L | ✅ **도감** — 105 엔트리 (204 는 콘텐츠가 다 들어온 뒤의 목표치) (2026-08-03) |
| P7-15 | M | ✅ **설정 · 접근성 · 라이선스 표기 화면** (2026-08-03) |
| P7-16 | M | ✅ **분석 전송 경계** — 배치 · 오프라인 큐 · 재시도 (실 SDK 없음, 기내 모드에서도 게임 무영향) (2026-08-03) |

> ### ✅ P7-01 FTUE · P7-02 가이드 탭 예산 (2026-08-03)
>
> **단계는 코드가 아니라 데이터다 — `src/game/data/ftue.json` (31단계).**
> `16-ftue.md §6` 의 A/B 후보 6종이 전부 '시점·순서·문구'의 변경이다.
> 그것이 코드 변경이면 실험이 릴리스 주기에 묶인다.
> 단계마다 `atSec` · `trigger`(완료 판정) · `highlight`(하이라이트 대상) ·
> `text.ko` · `unlocks` · `event`(계측)를 갖는다.
>
> **진행 판정은 `src/game/logic/ftue.js` 순수 함수다.** Phaser·DOM·`Math.random`·
> `Date.now` 가 없다. 그래서 "5단계에서 앱을 끄고 다시 켠다"를 테스트가 직접 만든다.
>
> | 결정 | 이유 |
> |---|---|
> | `trigger.count` 는 **단계 진입 시점 기준 상대값** | 절대 누적이면 `unit_levelup` 이 1-3 과 1-9 두 곳에 나오므로, 1-3 에서 올린 레벨이 1-9 진단 단계를 **입력 없이** 통과시킨다 |
> | 이벤트는 **넓은 키와 좁은 키를 모두** 올린다 (`summon` + `summon:elf_sharpshooter`) | 안 그러면 "아무나 소환" 단계가 특정 유닛 소환으로는 진행되지 않는다 |
> | 앞 단계를 건너뛴 채 뒤 조건을 만족하면 **따라잡는다** (`FAST_FORWARD_KINDS`) | 지휘관 주문은 아직 미구현이다. 1-1 을 그냥 깨면 거기서 튜토리얼이 영구히 멈춘다 |
> | 따라잡기는 `stage_clear`·`screen_open` 같은 **되돌릴 수 없는 진행**에만 건다 | 소환으로 따라잡기를 허용하면 첫 소환 한 번이 뒤쪽 소환 단계까지 지운다 |
> | 건너뛴 단계의 **해금은 그대로 지급**된다 | 스킵의 대가가 '영구 결손'이면 그건 건너뛰기가 아니라 함정이다 (§5 "스킵 시에도 모든 시스템이 자연스럽게 해금된다") |
> | 오버레이는 `pointer-events:none`, 하이라이트는 **가리키기만** 한다 | 입력을 가로채면 가르치는 게 아니라 가두는 것이다 (§1 규칙 7) |
> | 화면 진입 이벤트는 오버레이가 `useLocation` 으로 **한 곳에서** 쏜다 | 화면마다 심으면 새 화면이 생길 때 반드시 하나를 빠뜨리고, 그 빠뜨림은 "튜토리얼이 거기서 멈춘다"로 나타난다 |
> | 편성·레벨업·가챠·방치 이벤트는 **슬라이스 액션**에서 쏜다 | 편성을 바꾸는 경로가 목록 탭·자동 추천·공유 코드로 셋이다 |
>
> **P7-02 — 가이드 탭은 세지 않고 `guidedTapCount()` 가 센다. 실측 12/12.**
> 화면·테스트·`validate-data.mjs` 가 **같은 함수**를 부른다. 검사기가 확률을 다시
> 손으로 더하면 두 번째 출처가 되는 것과 같은 이유다(P7-06 의 실패 조건).
> 구간별 분포도 `§3` 예산표와 대조한다 — 단계를 추가하면 테스트가 깨진다.
>
> ⚠ **`16-ftue.md` 내부 모순 1건 (정정: 예산표가 정본).**
> §2 는 1-4 까지 "누적 9회"라고 적었지만 §3 예산표는 1+2+2+3+2 = **10** 이다.
> 총합 12를 만드는 것은 예산표 쪽이므로(10 + 각인 1 + 방주 1) 예산표를 따랐다.
> `16-ftue.md §2` 에 정정 주석을 달았다.
>
> **세이브: `SAVE_VERSION` v7 → v8, 최상위 키 `ftue` 추가.**
> ★ `highestStage > 0` 이거나 동료를 보유한 계정은 **완료 상태 + 전 해금**으로 넣는다.
> 30레벨 계정에 "병사를 소환하세요" 손가락이 뜨는 것은 업데이트가 만들 수 있는
> 가장 모욕적인 회귀이고, 동시에 FTUE 해금 게이트가 기존 진행을 거꾸로 잠그면 안 된다.
>
> **계측(§4) 20종은 심어 두었다.** `eventsBetween(prev, next)` 가 상태 전환에서
> 기계적으로 뽑으므로 단계를 추가해도 계측이 따라온다. 싱크는 `src/utils/analytics.js`
> 의 링 버퍼이며 **네트워크를 타지 않는다**(§5 "기내 모드에서도 끝까지 진행").
> 실제 SDK 연결은 P7-16 에서 `setAnalyticsSink()` 하나를 꽂으면 끝난다.
>
> **아직 못 한 것 (해당 티켓이 오면 앵커만 붙이면 된다)**
>
> | 항목 | 왜 |
> |---|---|
> | 지휘관 주문(0:30) 실제 발동 | 주문 시스템 미구현 (`BattleHud` 의 주문 버튼이 `disabled`). 단계·트리거·따라잡기는 있고, 1-1 클리어로 자동 통과된다 |
> | 지휘관 3지선다 화면(3:00) · 이름 입력 | 지휘관 선택 화면 자체가 없다 (P8). `commander_choose` 트리거만 대기 |
> | 무료 10연 화면(4:00) | 가챠 연출은 P7-07. `applyGachaResult` 에 신호는 걸어 두었다 |
> | 푸시 권한(9:40) · 스타터 오퍼(11:00) 실제 다이얼로그 | P7-13 · P7-09 소관. `push_result` · `offer_result` 트리거 대기 |
> | 1-9 아슬아슬한 패배(잔여 HP 5–15%) | **P7-03 이고 측정 완료·미해결이다.** FTUE 는 "여기서 진다"만 알고 밸런스는 모른다 |
> | 콜드 스타트 3초 · 저사양 4초(§1 규칙 6) | 실기 계측이 필요하다. `src/utils/perf.js` 가 자리를 잡아 두었다 |
>
> ### ✅ P7 게이트 = M3 소프트런칭 준비
> `32-definition-of-done.md` §3.4 전항

---

### ✅ P7-05 가챠 추첨 — 서버 롤 → **클라이언트 시드 롤** (2026-08-03, 재작성)

> **왜 바뀌었나.** 원안은 "가챠 RNG 는 반드시 서버에서 실행한다" 였다
> (`17-liveops-monetization.md` §4.2). **2026-08-03 결정으로 이 프로젝트에는
> 서버가 없고 앞으로도 두지 않는다.** 서버를 기다리는 잠긴 뽑기 버튼은
> 영원히 열리지 않는 버튼이므로, 클라이언트에서 성립하는 방식으로 대체했다.

```
산출물:
  src/game/logic/gacha.js      deriveRollSeed · rollBatch · makeLogEntry · appendLog · verifyLogEntry
  src/store/slices/shopSlice.js  pullGacha · getGachaAudit · verifyGachaLog
  src/screens/GachaLog.jsx     (신규 — 로컬 감사 로그 + 재현 검증)
  src/screens/ShopScreen.jsx   소환 탭에 1회 / 10연 버튼
  src/game/data/gacha.json     log.maxEntries
  src/store/migrate.js         세이브 v8 → v9
```

**① 시드 PRNG.** 계정마다 시드 하나(`gacha.seed`)와 커서 하나(`gacha.seedIndex`)를
세이브에 둔다. 뽑기 요청 하나가 커서를 `count` 만큼 전진시키고, 그 요청의 난수
스트림은 `mulberry32(deriveRollSeed(seed, index))` 다. 전투 시뮬이 시드 PRNG 로
결정론을 지키는 것과 같은 이유다 — **재현 불가능한 난수는 사후 검증을 통째로 없앤다.**

**② 소비 → 산출 순서 (리롤 차단).** `shopSlice.pullGacha` 가 이 순서를 지킨다:

```
① 재화 차감        실패하면 커서를 건드리지 않고 끝
② 커서 커밋(저장)  ← 결과를 계산하기 **전에** seedIndex 를 전진시켜 영속화
③ 결과 산출        커밋된 커서로 계산
④ 천장 · 로그 · 지급 반영
```

②를 ③ 뒤로 옮기면 "결과를 보고 앱을 강제 종료해 같은 시드로 다시 뽑는" 경로가 열린다.
②가 먼저이므로 중간에 앱이 죽어도 그 뽑기는 이미 소비된 것으로 남는다.
순서는 `logic/gacha.js` 와 `shopSlice.pullGacha` 양쪽 주석에 명시했고,
`shopSlice.test.js` 가 커서 단조 증가와 롤 시드 유일성을 검증한다.

**③ 전량 로깅.** 스키마는 원안(§4.2 롤 로그)을 그대로 따르되 `userId` 자리를
계정 시드가 대신한다: `rollId · at · bannerId · tableVersion · rngAlgorithm ·
seed · seedIndex · rollSeed · count · pityBefore · pityAfter · rates ·
softPityBonus · results[]`.
`rollId` 는 난수가 아니라 **(시드, 커서)의 함수**다 — 난수 id 를 쓰면 그 id 자체가
재현 불가능해져 로그의 목적과 모순된다.
상한은 `gacha.json:log.maxEntries = 200` 이고 **근거를 그 파일에 적었다**
(의미: 200건 = 최소 200뽑 · 10연 위주면 2,000뽑, 하드 천장 60뽑 주기를 최소 3회 덮는다 /
용량: ≈60KB, Preferences 는 매 `set()` 마다 세이브 전체를 직렬화하므로 무한 성장은 저장 비용이 선형으로 커진다 /
열람성: 화면에서 훑을 수 있는 규모).
누적 뽑기 수와 시드는 **절대 잘리지 않으므로**, 잘려 나간 과거 뽑기도 시드와 커서로 재계산할 수 있다.

**④ 사용자가 볼 수 있다.** 소환 배너 → **[뽑기 기록] 1탭** (`GachaLog.jsx`).
시드 · 커서 · 누적 뽑기 수 · 기록 목록이 그대로 보이고,
**[재현 검증]** 버튼이 기록된 시드로 그 뽑기를 처음부터 다시 계산해 결과가
글자 단위로 같은지 비교한다 (`verifyLogEntry`). 확률 공개의 실질은 게시된 숫자가
아니라 **검증 가능성**이고, 서버가 없으니 이 로컬 감사 로그가 그 자리를 대신한다.

#### 보증하는 것 · 보증하지 못하는 것

이 문장들은 게임 안(확률 공개 모달 · 뽑기 기록)에도 **그대로** 실려 있다.

| | 내용 | 근거 |
|---|---|---|
| ✅ **보증** | 공개한 확률 = 실제 추첨 확률 | 표시(`buildDisclosure`)와 추첨(`rollOne`)이 같은 `effectiveRates()` 를 지난다. `rollOne` 이 자기가 쓴 표를 반환값에 실어 보내고 테스트가 `toBe` 로 동일성을 검증한다 |
| ✅ **보증** | 천장 강제 | 하드 천장 회차에 L 확률이 1.0 이 되는 것이 테이블 자체다. 카운터는 배너 간 이월되고 `partialize` 로 반드시 저장된다 |
| ✅ **보증** | 모든 뽑기 재현 가능 | `(seed, seedIndex, pityBefore)` 만으로 결과가 완전히 재계산된다. 화면에서 직접 돌려볼 수 있다 |
| ✅ **보증** | 결과를 본 뒤 되돌릴 수 없음 | 커서 커밋이 결과 산출보다 **먼저** 일어난다 |
| ❌ **보증 못 함** | **세이브 파일 직접 수정** | 서버가 없으므로 기기의 저장 파일을 고치는 것을 막을 수 없다. 그 경우 감사 로그도 함께 고쳐질 수 있다 |

> **그래서 '조작 방지' 라고 쓰지 않았다.** 이 화면은 **제3자에 대한 증명이 아니라
> 본인이 직접 확인하기 위한 도구**라고 게임 안에 명시한다. 못 막는 것을 막는다고
> 쓰는 순간, 실제로 보증하는 네 가지까지 같이 의심받는다.

**남은 것 (P7-07 가챠 연출).** 지금 결과 화면은 목록과 사유(천장/픽업/10연 보장)만
보여준다. 보장으로 받은 것을 운으로 받은 것처럼 보여주지 않는 것이 이 화면의 기준이었다.

### ✅ P7-09 상점 · 스타터팩 · 젬 팩 (2026-08-03)

```
산출물:
  src/game/data/shop.json                   (신규 — 가격·구성·노출 조건·한도 SSOT)
  src/game/logic/shop.js  + shop.test.js    (신규 — 순수 규칙, 난수 없음)
  src/api/payments.js                       (신규 — 결제 어댑터 인터페이스 + 목)
  src/store/slices/shopSlice.js             (신규 — shop·gacha 영속 상태)
  src/screens/ShopScreen.jsx + Shop.module.css (신규)
  src/store/index.js · migrate.js           (세이브 v4 → v5)
  tools/validate-data.mjs                   (상점 검사 추가)
```

| 결정 | 이유 |
|---|---|
| **상점에 랜덤이 0** | 절대규칙 6. 카드에 받을 내용이 그대로 적히고, 구매 확인창이 "무작위 요소가 없습니다"를 문장으로 말한다. `logic/shop.hasRandomness()` 가 `chance`·`weights`·`odds` 류 필드를 재귀 탐지하고 `data:validate` 가 이를 **빌드 차단**으로 건다. "랜덤 상자를 하나만" 이라는 제안은 반드시 언젠가 오고, 그때 리뷰어의 기억이 아니라 빌드가 막아야 한다 |
| 한도 리셋을 **세이브 순회로 하지 않음** | 기록에 `day`/`week` 인덱스를 같이 저장하고 조회 시점에 비교한다. 자정마다 전 상품 기록을 훑는 코드는 언젠가 반드시 빠뜨리고, 그 빠뜨림은 "한도가 안 풀린다"로 나타난다. 경계는 **KST 자정**이고 `shop.json:resetTimezoneOffsetMin` 하나로 글로벌 확장에 대응한다 |
| 기간 한정의 창은 **처음 노출된 시각**부터 | `windowHours` 는 `shop.seenAt[id]` 기준이다. 계정 생성 시각 기준으로 하면 스테이지 9 에 도달하기 전에 스타터팩이 소멸한다. 기록은 **상점을 실제로 연 순간**(`markShopSeen`)에만 찍는다 — 조회 함수 안에서 찍으면 렌더 중 `set()` 이 되고, 화면을 열지 않아도 시간이 흐른다. 만료되면 **실제로 사라진다**(가짜 카운트다운 금지, 17 §4.3) |
| 무료 상품에 한도 필수 | `data:validate` 가 한도 없는 `payment: "free"` 를 오류로 잡는다. 한도 없는 무료 상품은 무한 재화 생성기다 |
| 차감 → 지급 순서 고정 | `purchaseWithCurrency` 는 `spendCurrency` 실패 시 아무것도 하지 않는다. 지급을 먼저 하면 연타 한 번에 재화가 복사된다. 화면은 별도로 `busy` 락을 건다 |

> **★ 결제는 목(mock) 이다. 실결제는 이 저장소에 붙어 있지 않다.**
> `src/api/payments.js` 는 인터페이스(`purchase`/`restore`/`getPrices`)와
> `mockPaymentAdapter` 만 정의한다. 목은 **아무 데도 청구하지 않고 영수증을
> 검증하지 않는다.** 이 사실이 코드가 아니라 **화면에** 드러난다 — IAP 카드마다
> '결제 미연동 (목)' 배지가 붙고, 구매 확인창이 "실제 결제는 일어나지 않으며
> 개발 확인용으로 즉시 지급됩니다" 라고 말한다.
>
> **2026-08-03 갱신 — 서버 없음 결정 반영.** 실결제는 서버 영수증 검증 없이는
> 성립하지 않고(클라이언트 성공 응답만 믿으면 즉시 뚫린다), 서버를 두지 않기로
> 했으므로 **실결제 어댑터를 붙일 계획 자체가 없다.** 그래서
> 어댑터 교체 훅(`setPaymentAdapter`)과 `purchaseIap()` 의
> `serverGrantRequired` 분기를 **제거했다** — 영원히 실행되지 않을 경로를 남겨 두면
> 다음 사람이 그것을 계획으로 읽는다. `PaymentAdapter` typedef 는 상점이 기대하는
> 계약을 문서화하는 역할이 남아 있어 유지한다.
> 남은 것: 성장 펀드 / 배틀패스 SKU (P7-08).

### ✅ P7-06 확률 공개 UI (2026-08-03)

```
산출물:
  src/game/data/gacha.json                  (신규 — 확률·천장·픽업·기간 SSOT)
  src/game/logic/gacha.js + gacha.test.js   (신규 — 표시와 추첨의 공통 규칙)
  src/screens/GachaOdds.jsx                 (신규 — 확률 공개 모달)
  ShopScreen '소환' 탭                       (배너 카드 → 확률 보기 1탭)
  tools/validate-data.mjs                   (확률 합계·천장·픽업·기간 검사)
```

**이 티켓의 유일한 합격 기준은 "화면의 숫자와 추첨의 숫자가 같은 곳에서 나온다"였다.**
확률표를 화면에 따로 적어 두는 순간 그것은 허위 표시이고, 2024-03-22 시행 ·
2025-10-23 확대된 게임산업진흥법상 **입증책임은 사업자에게 있다**.

```
gacha.json  (유일한 원본: 확률 · 천장 · 픽업 · 적용 기간)
      │
      └─ logic/gacha.js  effectiveRates()  ← 천장 보정까지 여기서 끝난다
             ├─ buildDisclosure()  → GachaOdds.jsx   (표시)
             └─ rollOne()          → 서버 추첨 규칙   (실제)
```

- 화면은 `gacha.json` 을 **import 하지 않는다.** `store.getGachaDisclosure()` 만 그린다.
- `rollOne()` 은 반환값에 자기가 쓴 `rates` 를 그대로 실어 보내고,
  테스트가 그것이 `buildDisclosure()` 의 값과 **`toBe` 로 동일**한지 검증한다.
- `validate-data.mjs` 도 손으로 더하지 않고 같은 함수를 부른다 — 검사기가
  세 번째 출처가 되면 검사의 의미가 없다.

| 결정 | 이유 |
|---|---|
| 소프트 천장 가산분을 **나머지 등급에서 비례 차감** | 특정 등급만 깎으면 그 등급의 공개 확률이 조용히 거짓이 된다. 합은 0~하드천장 전 구간에서 `1e-9` 이내로 100% 임을 테스트가 검증한다 |
| 배너 풀을 데이터에 **중복 기재하지 않음** | `units.json` 이 로스터의 유일한 출처이고 배너는 `exclude` 만 갖는다. 동료를 추가하고 배너 풀에 넣는 것을 잊어 "공개 목록에는 있는데 안 나오는 동료"가 생기는 사고가 구조적으로 불가능해진다 |
| 픽업 비중을 **풀의 실제 구성에서 계산** | "픽업이 등급 내 50%"라고 적어도 그 등급에 픽업밖에 없으면 실제는 100% 다. 데이터를 그대로 표시하면 실제보다 **낮은** 확률을 공개하게 되고, 유리한 방향이라도 그것도 허위 표시다. 현재 L 은 1종뿐이라 실제로 이 경로가 탄다 |
| 천장 카운터는 **계정 단위 하나** | 배너별로 두는 순간 그것이 곧 초기화되는 천장이다(17 §4.3 회피 대상). `partialize` 에 `gacha` 를 넣어 반드시 저장한다 — 앱 재시작으로 리셋되면 공개한 조건과 다른 동작이다 |
| 확률 보기는 배너에서 **1탭** | 법정 요건은 2탭 이내다. 보조 버튼처럼 흐리게 두지 않았다 — 찾기 어려운 공개는 공개가 아니다 |
| 표시 항목 | 등급별 확률(공개/현재 적용) · 합계 100% · 천장 조건 전문 · 천장까지 남은 횟수 · 픽업 대상 · 확률 적용 기간 · 동료 1종 단위 확률 · 확률표 버전/게시일/난수 알고리즘 |

**검증 (`gacha.test.js` 23건 · `shop.test.js` 24건)** — 합계 100%(기본·보정 후·동료 단위), 표시=추첨 동일성,
소프트/하드/픽업/10연 보장 동작, 결정론(같은 시드 → 같은 결과),
6만 회 실측 분포가 공개 확률과 어긋나지 않음(L 은 천장 보정만큼 **높게** 나온다).

> **2026-08-03 갱신.** 최초 구현에서는 뽑기 버튼을 잠그고 "추첨은 서버가 해야
> 한다(P7-05)" 로 남겼다. **서버를 두지 않기로 결정되면서** 그 잠금은 영원히 열리지
> 않는 버튼이 되므로 제거했다. 뽑기는 클라이언트 시드 추첨으로 동작하고,
> 서버 롤 로깅의 자리는 **로컬 감사 로그 + 재현 검증**이 대신한다 → P7-05 노트 참조.
> 확률 공개 모달에도 '보증하는 것 / 보증하지 못하는 것' 절이 추가됐다.
> 남은 것: 공식 홈페이지·광고물 동일 게재(출시 전 필수).

### ✅ P7-15 설정 · 접근성 · 라이선스 (2026-08-03)

```
산출물:
  src/screens/SettingsScreen.jsx + Settings.module.css   (신규)
  src/game/data/settings.json                            (신규 — 기본값·선택지 SSOT)
  src/game/data/attributions.json                        (신규 — 크레딧 SSOT)
  tools/gen-attributions.mjs                             (신규 — 문서 생성기)
  src/store/migrate.js + migrate.test.js                 (index.js 에서 분리)
  src/store/slices/settingsSlice.js (재작성) + 테스트
```

**설정은 전부 실제로 배선되어 있다.** 배선표는 `settingsSlice.js` 상단에 표로 있다.
화면에만 있고 아무것도 하지 않는 스위치를 만들지 않는 것이 이 티켓의 유일한 합격 기준이었다.

| 결정 | 이유 |
|---|---|
| 기본값·선택지를 `settings.json` 으로 | 절대규칙 4의 확장. `npm run data:validate` 가 **기본값이 선택지 안에 있는지** 검사한다 — 벗어나면 세그먼트 버튼이 아무것도 선택되지 않은 채 떠서 되돌릴 방법이 사라진다 |
| 크레딧 SSOT = `attributions.json` | `docs/legal/ATTRIBUTIONS.md` 는 `npm run docs:attributions` 로 **생성**된다. `data:validate` 가 `--check` 로 동기화를 강제하므로 문서와 화면이 갈라질 수 없다. 검사기는 AudioManager 가 실제 재생하는 트랙이 크레딧에 있는지도 본다 |
| 음소거를 볼륨 0 저장으로 만들지 않음 | 해제 시 원래 볼륨으로 돌아와야 한다. 씬은 `bgmLevel()/sfxLevel()` 이라는 **실효 볼륨 셀렉터**를 구독한다 — 볼륨과 음소거를 따로 구독하면 음소거 토글이 반영되지 않는다 |
| 이펙트 강도 = 풀 크기가 아니라 **동시 재생 예산** | 풀을 줄이면 초과분이 최고령을 강제 회수해 재생 중 애니메이션이 뚝 끊긴다. 저사양에서 줄여야 하는 것은 개수이지 품질이 아니다 |
| 텍스트 크기 = `#ui-overlay` 의 `zoom` | 화면들이 px 로 짜여 있어 `font-size` 는 아무 효과가 없고, `transform` 은 레이아웃 크기가 그대로라 확대분이 잘린다. `zoom` 은 **터치 타깃도 같이 키운다** — 저시력 접근성에서 글자만 키우는 것은 반쪽이다. inset·padding 을 `calc(… / var(--ui-scale))` 로 상쇄해 기본값 1 에서는 완전한 무변화다 |
| 색약 모드 = 데미지 숫자에 속성 표기 추가 | 적 태그는 원래부터 형태 아이콘이었다(EnemyBadges). 남아 있던 색-단독 정보는 데미지 숫자 색뿐이라 거기에 `물/술/신` 한 글자를 붙였다. 이 화면 자체도 선택 상태를 색+표식으로 이중 표기한다 |
| 자동 진행 속도 > 전투 속도 | 두 값이 각자 `setSpeed` 를 부르면 마지막에 바뀐 쪽이 이기는 경합이 된다. `BattleScene.applySpeedSetting()` 한 곳에서 우선순위를 못 박았다 |
| 세이브 초기화는 2단계 확인 + 재부팅 | `resetSave()` 는 확인하지 않는다(호출부 책임). 메모리 상태를 손으로 되돌리지 않고 저장소를 비운 뒤 재시작한다 — "초기화 목록"을 슬라이스마다 관리하는 구조는 반드시 언젠가 빠뜨린다 |

**세이브 마이그레이션 (v3 → v4).** `migrate` 를 `store/migrate.js` 로 분리했다.
`store/index.js` 는 Capacitor 저장소를 import 하고 모듈 로드만으로 하이드레이션을 시작해서
테스트가 불가능했다 — 정작 **가장 테스트가 필요한 코드**였다.
`uiScale → textScale` 이름 변경에서 값을 옮기지 않으면 UI 를 130% 로 쓰던 저시력 사용자가
업데이트 한 번에 100% 로 되돌아간다. 그 회귀를 테스트로 고정했다.

**연결하지 못한 것:** 없음. 다만 효과음 에셋 자체가 아직 없어(P3-14) SFX 볼륨은
값만 저장되고 들을 소리가 없다 — 화면에 그 사실을 명시했다.

### ✅ P7-11 일일 로그인 28일 + 스트릭 보호 · ✅ P7-12 일일/주간 퀘스트 (2026-08-03)

```
산출물:
  src/game/data/login.json                   (신규 — 28일 캘린더 · 스트릭 보호 규칙 SSOT)
  src/game/data/quests.json                  (신규 — 목표 · 목표치 · 보상 · 주기 SSOT)
  src/game/logic/daily.js + daily.test.js    (신규 — 순수 규칙 33건, 난수 없음)
  src/store/slices/dailySlice.js + 테스트     (신규 — 15건)
  src/screens/DailyScreen.jsx + Daily.module.css (신규 — 출석 + 임무 한 화면)
  src/store/index.js · migrate.js            (세이브 v6 → v7)
  tools/validate-data.mjs                    (출석·퀘스트 검사 추가)
  BattleScene 결과 payload 에 summons 추가 · BattleScreen 이 진행을 반영
```

**이 티켓의 실제 위험은 보상표가 아니라 날짜 판정이었다.**
그래서 규칙 전체를 `logic/daily.js` 의 순수 함수로 두고 **현재 시각을 인자로만** 받는다
(절대규칙 1). "3일 건너뜀 · 시계 되돌림 · 시계 +30일"을 테스트에서 인자 하나로 만든다.

일자·주차 경계는 **상점과 같은 함수**(`logic/shop.js` 의 `dayIndex`/`weekIndex`)를 쓴다.
KST 자정 · 월요일 자정이고, 두 벌을 두면 "상점은 리셋됐는데 출석은 아직"이 되어
사용자에게는 그대로 버그로 보인다.

#### 기기 시계 조작 — 무엇을 막았고 무엇을 못 막았는가

| | |
|---|---|
| **되돌려서 재수령** | 막았다. 출석은 `today > lastClaimDay` 일 때만 수령된다 |
| **되돌려서 퀘스트 리셋** | 막았다. 주기 갱신이 **엄격 증가**(`today > state.day`)다. `!==` 로 썼다면 시계를 하루 되돌리는 것만으로 일일 보상을 무한 수령할 수 있었다 — 이 파일에서 가장 위험한 한 글자다 |
| **앞당겨서 총량 이득** | 막았다. +30일로 받으면 `lastClaimDay` 가 그 날짜로 고정되어 실제 시각에서 30일간 아무것도 받지 못한다. 테스트가 이 성질을 고정한다 |
| **앞당겨서 미리 받기** | **못 막았다.** 총량 이득은 없지만 "28일치를 하루에 몰아 받기"는 가능하다 |
| **세이브 파일 직접 수정** | **못 막았다** |

> 근본 해결은 **서버 시각 + 서버 지급**이며 이 저장소의 범위 밖이다.
> 서버가 붙을 때 바뀌는 곳은 `dayIndex()` 에 넘기는 인자 하나뿐이다 —
> 그래서 시각을 인자로 받는 규약을 지켰다. 지금 없는 방어를 있는 것처럼 적지 않는다.

#### 설계 결정

| 결정 | 이유 |
|---|---|
| **랜덤 상자 0** | 절대규칙 6. 28일 전부 무엇을 받는지가 첫날부터 캘린더에 적혀 있다. `data:validate` 가 `hasRandomness()`(상점과 같은 함수)로 두 JSON 을 재귀 탐지해 **빌드 차단**한다 |
| 캘린더 위치 = **누적 수령 횟수** (연속 일수가 아님) | 하루 빠졌다고 1일차로 되돌리는 설계는 복귀 유저를 그 자리에서 이탈시킨다. 끊기는 것은 스트릭뿐이고 **받은 칸은 되돌아가지 않는다** |
| 스트릭 보호는 **자동·무료·사이클당 1회** | 유료 복구는 결국 "실수를 팔기"다. 조건(`maxMissedDays`)·횟수(`maxPerCycle`)가 전부 데이터고, `maxMissedDays: 0` 은 검사기가 오류로 잡는다 — 절대 발동하지 않는 '보호'는 기능이 아니라 거짓말이다 |
| 연속 보너스에 **젬 금지** | 젬 예산 검사는 캘린더 총합만 본다. 연속 보너스로 젬을 주면 그 검사를 그대로 우회한다 — 검사가 있는데 지켜지지 않는 최악의 형태다. 검사기가 이것도 막는다 |
| 예산을 데이터에 적고 검사 | `login.json:budget.gemsPerDayAvg = 20`, `quests.json:budget = 40/175`. 실측 총합 **560젬 / 28일 = 정확히 20/일**, 일일 40젬, 주간 175젬 — `14-economy-balance.md §4.2` 의 무과금 수급표와 일치한다. 넘으면 빌드가 멈춘다 |
| 퀘스트도 **고정 목록** | '오늘의 랜덤 퀘스트'는 확률형 유입 경로다. 로테이션이 필요해지면 `dayIndex` 기반 결정론 순환으로 넣는다 |
| `OBJECTIVE_KINDS` 를 코드가 소유 | 데이터에만 있고 아무도 세지 않는 목표는 영원히 `0/N` 이 되고 발견이 가장 늦다. 검사기가 `logic/daily.js` 의 배열과 데이터를 대조하고, **지금 그 kind 를 발생시키는 생산자가 있는지**까지 경고한다 |
| 조회는 상태를 바꾸지 않음 | 주기 갱신(`rollQuests`)은 조회 경로에서 *가상으로만* 적용하고 진행·수령 시점에만 저장한다. 조회가 `set()` 하면 렌더 중 setState 가 되고, 화면을 열지 않아도 주기가 흐르기 시작한다 (`markShopSeen` 과 같은 이유) |
| 변화 없으면 **같은 객체 반환** | `rollQuests`/`applyQuestEvents` 가 참조를 유지한다. 매번 새 객체를 만들면 1초 시계 틱마다 28칸이 통째로 다시 그려진다 |
| 지급은 `shopSlice.applyGrants` 재사용 | 보상 형식이 상점 `grants` 와 동일하다(`{kind:"currency"|"unit"}`). 지급 경로가 둘이 되는 순간 한쪽만 고쳐지는 사고가 난다 |

#### 퀘스트 목표 — 걸 수 있었던 것과 없었던 것

**건 것** (전투 종료 payload 가 유일한 생산자다):
`battle_play` · `stage_clear`(+`minStars`/`difficulty` 필터) · `enemy_kill` · `summon`

**걸지 못한 것 — 훅이 없다:**

| 원했던 목표 | 없는 것 |
|---|---|
| **특정 태그 처치** (ARMORED N마리 등) | `sim.stats` 에 `killsByTag` 가 없다. 있는 것은 `unkilledByTag`(패배 진단용, 살아남은 적)뿐이다. `logic/lifecycle.js` 의 처치 경로에 카운터 한 줄이 필요하다 |
| **동료 소환 (특정 유닛)** | `stats.summons` 는 총합만 센다. 유닛별 집계가 없다 |
| **가챠 N회** | ~~추첨이 서버 몫이라 실행 경로가 없다~~ → **2026-08-03 해소.** 서버 없음 결정으로 클라이언트 추첨이 붙었다 (P7-05). `shopSlice.pullGacha` 에서 `trackQuestEvents([{ kind: "gacha_pull", amount: pulls }])` 한 줄이면 걸린다 |
| **방치 보상 수령 · 파견 완료 · 레벨업 · 장비 강화** | 훅 자체는 `metaSlice`/`rosterSlice` 에 있지만, 이번 티켓에서 그 파일들을 건드리지 않기 위해 걸지 않았다. `trackQuestEvents(events)` 한 줄 호출이면 붙는다 |
| **각인 획득 · 진화** | 전투 결과 payload 에 실려 있지 않다 |

> `stats.summons` 는 시뮬이 이미 세고 있었는데 결과 payload 에 실리지 않아
> 밖에서는 볼 수 없었다. 이번에 한 줄 추가했다 — 씬은 퀘스트를 모르고
> 퀘스트는 씬을 모르며, 그 사이를 잇는 것은 그 payload 하나뿐이다.

**세이브 마이그레이션 (v6 → v7).** 새 최상위 키 `daily` 를 채운다.
화면이 `daily.login.claimCount` 를 바로 읽으므로 채우지 않으면 업데이트 직후
일일 탭이 화이트스크린이 된다 (v5 의 `shop` 과 똑같은 사고다).
출석은 **오늘부터** 시작한다 — 과거 접속 이력을 출석으로 소급하지 않는다.
그 기록이 애초에 없고, 있는 척하면 캘린더가 거짓말을 시작한다.

**검증:** `daily.test.js` 33건 + `dailySlice.test.js` 15건 + `migrate.test.js` 3건 추가.
`npm run lint` 경고 0 · `npm run test` 431건 전부 통과 · `npm run data:validate` 통과(경고 0) · `npm run build` 성공.

---

### ✅ P7-08 배틀패스 시즌 1 (2026-08-03)

```
산출물:
  src/game/data/battlepass.json                 (신규 — 시즌·레벨·경험치·3트랙 보상 SSOT)
  src/game/logic/battlepass.js + .test.js       (신규 — 순수 규칙 45건, 난수 없음)
  src/store/slices/dailySlice.js (+ 테스트 12건) (패스 상태·액션을 daily 슬라이스에 편입)
  src/screens/BattlePassScreen.jsx
  src/screens/BattlePass.module.css             (신규 — 레벨 가로 레일 × 트랙 3줄)
  src/store/migrate.js (+ 테스트 4건)            (세이브 v9 → v10 블록)
  tools/validate-data.mjs                       (배틀패스 검사 7종 추가)
  screens/index.jsx · router/index.jsx · TabBar (라우트 /pass · 탭 '패스' 추가)
```

**이 티켓의 실제 위험은 보상표가 아니라 세 가지였다 — 시즌 경계 · 예산 · 완주 가능성.**
그래서 규칙 전체를 `logic/battlepass.js` 의 순수 함수로 두고 **현재 시각을 인자로만**
받는다 (절대규칙 1). "시즌 마지막 날 · 종료 다음 날 · 지난 시즌으로 시계 되돌림"을
테스트에서 인자 하나로 만든다. 일자 경계는 출석·임무·상점과 **같은 함수**
(`logic/shop.js` 의 `dayIndex`)를 쓴다 — 두 벌을 두면 "임무는 초기화됐는데 시즌은 아직"이
되고 그것은 사용자에게 그대로 버그로 보인다. 검사기가 `startsAt` 이 KST 자정인지 강제한다.

#### 시즌 보상 총량 — 예산 대비 (실측, `data:validate` 가 매 빌드 계산)

| 트랙 | 젬 | 예산 | 골드 | 강화석 | 파편 | 근거 |
|---|---|---|---|---|---|---|
| 무료 | **900** | 900 | 94,000 | 860 | 45 | `14-economy-balance.md §4.2` "무료 트랙 ≈ 시즌당 900젬" |
| 프리미엄 | **2,400** | 2,400 | 188,000 | 630 | 81 + 에픽 1종 | `17-liveops-monetization.md §2.2` "+ 젬 2,400, 에픽 동료 1" |
| 프리미엄+ | **0** | 0 | 0 | 0 | 120 | 같은 절 "티어 10 즉시 + 추가 파편" — 젬 없음 |

무료 900젬 / 28일 = **32.1젬/일**로 `§4.2` 의 "≈ +32/일"과 정확히 일치한다.
**프리미엄+ 에 젬을 한 톨도 얹지 않은 것이 이 표에서 가장 중요한 칸이다** —
상위 트랙에 젬을 넣는 것은 실질적으로 기본가 인상이고, `10-GDD.md §6` 이 그것을
금지 항목으로 못 박았다. 상위 트랙의 값어치는 **즉시 레벨 + 파편**으로만 만든다.

#### 완주 가능성 — 검증 가능한 주장으로 만들었다

`17 §2.2` 의 "일일 임무로 무난히 완주 가능(완주율 목표 65%)"은 지금까지 문장이었다.
`battlepass.json:pace` 에 전제를 적고 검사기가 계산한다:

```
레벨 50 도달선 = xpPerLevel 1,000 × 49 =            49,000
설계 페이스 시즌 총량 =
  28일 × (전투 8×30 + 승리 3×50 + 일일임무 4×200 + 출석 1×150)  37,520
  + 4주 × 주간임무 6×500                                        12,000
                                                         계    49,520  (완주 28일 / 28일)
```

미달이면 **빌드가 멈춘다**(완주 불가능한 시즌). 과잉이어도 멈춘다
(`pace.maxOvershoot 1.35` — 시즌 절반에 끝나면 "28일 시즌"이 거짓말이 된다).

#### 경험치 획득 경로 — 건 것과 걸지 못한 것

**건 것 (전부 이미 존재하는 이벤트다. 새 이벤트를 하나도 만들지 않았다):**

| 경로 | 훅 | 값 |
|---|---|---|
| 전투 종료 | `dailySlice.trackBattleResult` (BattleScreen 이 이미 부른다) | 참가 30 · 승리 +50 |
| 임무 보상 수령 | `dailySlice.claimQuest` | 일일 200 · 주간 500 |
| 출석 보상 수령 | `dailySlice.claimLogin` | 150 |

**걸지 못한 것:**

| 원했던 경로 | 없는 것 |
|---|---|
| **처치 수 · 소환 수 비례 경험치** | 훅은 있다(`stats.kills`/`summons`). **일부러 걸지 않았다** — 전투 1회당 상한이 없는 지표라 장시간 방치 전투 한 판이 시즌을 통째로 건너뛴다 |
| **가챠 뽑기** | 훅은 있다(`shopSlice.pullGacha`). 그 파일이 이번 티켓의 충돌 회피 대상이었고, 무엇보다 **결제로 패스 레벨을 사는 경로**가 되므로 설계 판단이 먼저 필요하다 |
| **방치 보상 수령 · 파견 완료 · 레벨업 · 장비 강화** | 훅 자체는 `metaSlice`/`rosterSlice` 에 있다. `gainPassXp(n, now)` 한 줄 호출이면 붙는다 |
| **패스 티어 스킵 (₩26,000)** | `17 §2` 의 IAP 사다리에 있지만 이 티켓 범위(무료/프리미엄/프리미엄+) 밖이다. `applyTrackPurchase` 의 `instantLevels` 가 이미 그 자리다 |
| **코스메틱 · 각인 1종 지급** | `17 §2.2` 는 프리미엄에 "코스메틱, 각인 1종"을 적었지만 **지급 경로가 없다**. `applyGrants` 가 아는 종류는 `currency` 와 `unit` 둘뿐이고, 코스메틱 시스템은 존재하지 않는다. 없는 보상을 데이터에 적으면 그 칸은 영원히 빈 칸이므로 **적지 않았다** |

#### 기기 시각 조작 — 무엇을 막았고 무엇을 못 막았는가

| | |
|---|---|
| **재수령** | 막았다. 수령은 `claimed[track]` 에 그 레벨이 없을 때만 성립한다 — 시각과 무관하다 |
| **시계를 흔들어 시즌 반복 초기화** | 막았다. 시즌 갱신이 **엄격 증가**(`season.startDay > pass.seasonStartDay`)다. `id !== id` 로 썼다면 시계를 앞뒤로 흔드는 것만으로 같은 보상을 무한히 받을 수 있었다 — 이 파일에서 가장 위험한 한 글자다 |
| **지난 시즌으로 되돌려 진행 삭제** | 막았다. 되돌린 상태에서는 진행을 **유지**하되 수령·획득이 함께 잠긴다(`status.locked`), 그리고 화면이 그 사실을 말한다 |
| **앞당겨 미리 받기** | 막았다. 시즌이 끝난 시각으로 옮기면 활성 시즌이 사라져 수령 자체가 막힌다 |
| **세이브 파일 직접 수정** | **못 막았다** |
| **시즌 기간이 기기 시각에 의존한다는 사실** | **못 막았다.** 화면의 '보증하지 못합니다' 항목에 그대로 적었다 |

> 근본 해결은 서버 시각 + 서버 지급이며 이 저장소의 범위 밖이다 (서버를 두지 않기로
> 결정, 2026-08-03). 서버가 붙을 때 바뀌는 곳은 `dayIndex()` 에 넘기는 인자 하나뿐이다.

#### 설계 결정

| 결정 | 이유 |
|---|---|
| **랜덤 티어 상자 0** | 절대규칙 6. 50레벨 × 3트랙이 무엇을 주는지가 시즌 첫날부터 전부 화면에 있다. `data:validate` 가 `hasRandomness()`(상점·출석과 **같은 함수**)로 JSON 을 재귀 탐지해 빌드 차단한다 |
| 패스 상태를 `daily.pass` 에 둠 (새 최상위 키가 아님) | ① 경험치 생산자 셋이 전부 `dailySlice` 에 있다 ② 날짜 경계 함수가 같다 ③ `partialize` 가 이미 `daily` 를 저장한다 — 저장 목록에 손대면서 빠뜨리는 것이 이 저장소에서 가장 비싼 사고다(천장·출석이 앱 재시작으로 사라지는 종류) |
| `instantLevels` 를 **경험치로 환산** | 레벨을 직접 대입하면 경험치와 레벨이 갈라져 "레벨 11인데 진행 바는 1레벨"이 된다. 지급 경로가 하나로 유지된다 |
| 프리미엄+ 가 프리미엄을 `includes` | 따로 사게 만들면 "상위를 샀는데 하위 보상이 잠긴" 사고가 반드시 난다. 검사기가 `includes` 대상 실재와 자기참조를 본다 |
| 일괄 수령을 **한 번의 상태 갱신**으로 | 화면에서 50번 반복 호출하면 중간에 하나만 실패해도 어디까지 받았는지 아무도 모른다 |
| 조회는 상태를 바꾸지 않음 | 시즌 갱신(`rollPass`)은 조회 경로에서 *가상으로만* 적용하고 진행·수령·구매 시점에만 저장한다 (`rollQuests` 와 같은 규약) |
| 변화 없으면 **같은 객체 반환** | `rollPass`/`normalizePass` 가 참조를 유지한다. 매 조회마다 새 객체를 만들면 1초 시계 틱마다 150칸이 다시 그려진다 |
| `XP_KINDS` 를 코드가 소유 | 데이터에만 있고 아무도 발생시키지 않는 경로는 영원히 0 이고 발견이 가장 늦다. 검사기가 `logic/battlepass.js` 의 배열과 데이터를 양방향 대조한다 (`OBJECTIVE_KINDS` 와 같은 이유) |
| 예산·완주를 **검사기가 같은 함수로** 계산 | `trackTotals()`/`projectedSeasonXp()` 를 화면·테스트·검사기가 공유한다. 검사기가 숫자를 손으로 다시 더하면 그 순간 두 번째 출처가 된다 (P7-06 의 실패 조건) |
| 유료 트랙 가격 단조 검사 | 상위 트랙이 더 싸면 하위 트랙이 존재 이유를 잃는다. 표에서 손으로 고치는 자리라 언젠가 반드시 오타가 난다 |

**세이브 마이그레이션 (v9 → v10).** `daily.pass` 를 채운다. 화면이 `pass.claimed.free` 를
바로 읽으므로 채우지 않으면 업데이트 직후 패스 탭이 화이트스크린이 된다 (v5 `shop`,
v7 `daily` 와 똑같은 사고다). **경험치를 소급 적립하지 않는다** — 어제까지 몇 번 싸웠는지는
기록에 없고, 있는 척하면 시즌 진행이 거짓말을 시작한다.

> ⚠ **`SAVE_VERSION` 을 9 → 10 으로 올리는 것은 남았다.** `src/store/index.js` 가
> 이번 작업의 충돌 회피 대상(다른 에이전트가 동시 편집 중)이라 손대지 않았다.
> 마이그레이션 블록(`from < 10`)은 이미 들어가 있으므로 **상수 한 줄만 바꾸면 활성화된다.**
> 그때까지도 앱은 정상 동작한다 — `onRehydrateStorage` 의 `normalizeDaily()` 가
> 멱등 안전망으로 같은 필드를 채우기 때문이다(그것이 이 이중 안전망의 존재 이유다).

**검증:** `battlepass.test.js` 45건 + `dailySlice.test.js` 12건 + `migrate.test.js` 4건 추가.
`npm run lint` 경고 0 · `npm run test` **652건** 전부 통과 · `npm run data:validate` 통과(경고 0).

---

### ✅ P7-14 도감 (2026-08-03)

```
산출물:
  src/game/logic/codex.js + codex.test.js    (신규 — 집계·해금·상성 규칙, 순수 함수 28건)
  src/screens/CodexScreen.jsx + Codex.module.css (신규)
  src/store/slices/metaSlice.js              (추가 — sigilsFound · recordCodex · getCodexSave)
  src/store/migrate.js                       (세이브 v5 → v6)
  src/game/scenes/BattleScene.js             (추가 — 도감 기록 버퍼 + flushCodex)
  src/screens/index.jsx · router · TabBar    (라우트 /codex 추가)
  src/screens/CompanionsScreen.jsx           (역할 라벨 사전을 codex.js 로 통합)
```

#### 엔트리 수 — **105 / 204**

티켓 제목의 204 는 `12-unit-roster.md` §7 의 **완성 시 목표치**(동료 44 + 적 150 + 보스 10)다.
지금 데이터에 존재하는 것은 그 절반이며, **없는 것을 지어내지 않았다.**

| 종류 | 현재 | 출처 | 목표까지 |
|---|---:|---|---:|
| 동료 | 25 | `units.json` | 44 (P9-02 가 40종까지) |
| 적 (일반) | 24 | `enemies.json` | 150 (P9-01 이 45종 추가) |
| 보스 | 8 | `enemies.json` 의 `boss.phases` 보유 항목 | 10 |
| 각인 | 30 | `sigils.json` | — |
| 진화 | 6 | `sigils.json` | — |
| 상성 규칙 | 12 | 데미지 3 + 태그 9 (**데이터가 아니라 규칙 자체가 엔트리**) | — |
| **합계** | **105** | | **204** |

> **차이 99 는 전부 아직 만들어지지 않은 콘텐츠다.** 화면·집계·해금·필터는 데이터를
> 세어서 만들므로, P9-01/P9-02 로 적·동료가 들어오는 순간 코드 변경 없이 늘어난다.
> `codex.test.js` 가 "모든 데이터가 정확히 한 번씩 엔트리가 된다"를 고정하므로
> 새 데이터가 도감에서 조용히 누락되는 일은 생기지 않는다.

#### 설계 결정

| 결정 | 이유 |
|---|---|
| **상성 규칙도 엔트리다** | 도감의 목적은 수집이 아니라 정보 공개다(혁신 15). "물리 × 중장갑"을 읽을 곳이 없으면 이 게임의 벽은 편성 퍼즐이 아니라 시행착오가 된다. 그래서 **상성 12개는 처음부터 열려 있고, 완성도 계산에서는 제외**한다 — 시작하자마자 12/105 가 채워지면 수집 진행도가 거짓말을 한다 |
| 배율은 전부 `balance.json` 에서 | 신성 ×1.6, 최소 피해 10%, REGEN 2%/0.25%, 처치 마나 환급 15% 를 문장에 박지 않는다. 테스트가 **패치된 배율을 넣으면 도감 값도 따라 바뀌는지**를 직접 검사한다 — 하드코딩이면 그 테스트가 실패한다 |
| 미해금은 표시뿐 아니라 **조회에도** 잠긴다 | "타락"으로 검색해서 아직 만나지 않은 적 이름이 뜨면 실루엣 처리가 무의미해진다. 검색·필터가 하나라도 걸리면 미해금은 목록에서 빠지고, 필터가 없을 때만 실루엣으로 남는다 |
| 동료와 적에게 **다른 질문**을 한다 | 적은 "무엇이 유효한가"(자기 태그를 상대하는 판정), 동료는 "이 화력이 무엇에 통하는가"(자기 데미지 타입의 상성 행). 한 컴포넌트로 묶되 질문을 바꾸지 않으면, 태그가 없는 동료는 전부 "보통"만 나열되어 아무것도 알려주지 못한다 |
| 해금 기록은 **전투당 1회** 기록 | `seeEnemy` 는 스폰마다 `set()` 을 부르는 구조였다(한 판에 수백 번 = 절대규칙 2 위반). 씬이 로컬 `Set`/`Map` 에 모았다가 `flushCodex()` 로 한 번에 넘긴다. **종료와 shutdown 양쪽에서** 부른다 — 중도 이탈로 끝나는 판이 실제로 더 흔하고, 종료 경로에만 두면 "분명히 만났는데 안 열린다"가 된다. 넘긴 뒤 버퍼를 비우므로 두 번 불려도 중복 집계되지 않는다 |
| 각인은 조우가 아니라 **획득**이 해금 조건 | 드래프트에 떴다는 이유로 열어 주면 리롤로 도감을 채우는 경로가 생긴다. `EV.SIGIL_TAKEN` / `EV.EVOLUTION` 만 기록한다 |
| 보스 스프라이트만 ×1 배율 | 보스 프레임은 최대 56×100 으로 잡몹(16×16)의 6배다. 고정 높이 + `overflow:hidden` 으로 맞추면 실루엣의 몸통만 남아 무엇인지 알아볼 수 없게 된다 — 미해금이 실루엣인 화면에서 그 잘림은 치명적이다. 대신 배율을 낮춘다(아트 규칙의 픽셀 밀도 위계와 같은 처방) |
| 라벨 사전을 `logic/codex.js` 가 소유 | 같은 역할·태그가 화면마다 다른 이름으로 불리면 플레이어는 그것을 서로 다른 개념이라고 배운다. `CompanionsScreen` 의 `ROLE_LABEL` 복제본을 이 사전으로 합쳤다 |

**세이브 마이그레이션 (v5 → v6).** `bestiary` 는 v1 부터 스키마에 있었지만 **아무도 쓰지 않아**
실제 세이브에는 비어 있거나 아예 없었다. 도감이 `bestiary.seen.includes()` 를 부르므로
채우지 않으면 업데이트 직후 도감 탭이 그대로 터진다. 신규 필드 `sigilsFound` 는
**소급 적립하지 않는다** — "무엇을 실제로 손에 넣어 봤는가"가 그 목록의 의미이고,
기록이 없는 것을 있었던 것처럼 만들면 도감이 거짓말을 시작한다.

**남은 것:** 도감 완성도를 소유 효과 보너스에 연동하는 것(`12-unit-roster.md` §7 마지막 줄)은
넣지 않았다. 보너스 수치가 `14-economy-balance.md` 에 아직 없고, 임의로 정하면
밸런스 하네스가 검증하지 않는 파워가 생긴다.

**검증:** `codex.test.js` 28건 추가.
`npm run lint` 내 파일 0건 · `npm run test` 488건 전부 통과 ·
`npm run data:validate` 통과(경고 0) · `npm run build` 성공 ·
브라우저 실측(적/보스/동료/상성 탭, 실루엣·검색·필터·상세) 확인.

---




> ### 통합 감사 — 6개 에이전트 병렬 작업 이후 (2026-08-03)
>
> 티켓 6개(프리뷰 · 하드 난이도 · 보스 · 설정 · 상점/가챠 · 도감 · 출석/퀘스트)를
> **병렬로** 구현한 뒤, 합쳐진 결과를 아무도 보지 않았다.
> lint 0 · 516 테스트 통과 상태였으므로 **테스트가 잡지 못하는 것**만 찾는 감사를 돌렸다
> (6개 차원 병렬 → 각 지적을 서로 다른 렌즈로 3명이 반증 시도).
>
> 세션 한도로 검증 단계가 중간에 끊겼지만, 끊기기 전에 **확정된 critical 3건**이 나왔다.
> 셋 다 "문법은 완전하고 항목이 하나 없을 뿐"이라 lint·타입·기존 테스트가 전부 놓친 것들이다.
>
> #### ① 역할 목록 사본에 `FLYER` 누락 → 편성 화면에서 비행 동료 2종이 사라졌다
>
> `loadoutAnalysis.js` 의 `ROLE_ORDER` 사본에 `FLYER` 가 없었다. 편성 화면이 그 사본으로
> 카드를 그려서 **보유 25종 중 23장만 렌더**됐다 — 마법 요정 · 결연한 천사가 목록에 없었다.
> 둘 다 가챠 풀에 있고 상점에서 파편까지 파는 유닛이다. **얻을 수는 있는데 쓸 수는 없었다.**
> 도감 · 전투 HUD 는 각자의 사본(FLYER 포함)을 써서 정상 표시했으니, **화면마다 로스터가 달랐다.**
>
> 곁가지 둘도 같은 뿌리였다:
> - `roles.RANGED + roles.CASTER + roles.SIEGE === 0` → 비행 화력 편성이 "후열 화력 없음"
>   CRITICAL 로 오탐되고 fitness 가 −35 깎였다
> - `stagePreview.js` 의 추천 편성 채우기 순서에도 `FLYER` 가 없었다
>
> **조치:** `src/game/logic/roles.js` 신설 — `ROLE_ORDER` · `ROLE_LABEL_KO` · `BACKLINE_ROLES` 의
> 유일한 정의. 사본 4개(`loadoutAnalysis` · `LoadoutScreen` · `StagePreview` · `BattleHud`)를
> 전부 재수출/import 로 바꿨다. `roles.test.js` 가 **"units.json 에 있는 역할이 목록에도 있는가"**
> 를 검사하므로, 새 역할을 데이터에 넣고 목록에 안 넣으면 테스트가 깨진다.
> 값 비교가 아니라 `toBe`(같은 배열인가)로 고정한 것이 요점이다 — 값이 같은 사본은 언젠가 갈라진다.
>
> #### ② 각인 선택 시 직전 틱 이벤트가 통째로 재소비 (드래프트의 32.4%)
>
> `BattleScene.consumeEvents()` 에 **소비 커서가 없어 항상 인덱스 0 부터** 훑는다.
> `resetQueue` 는 `step()` 안에서만 불리는데 `step()` 은 드래프트 중 즉시 반환하므로,
> 드래프트가 열린 틱의 이벤트가 큐에 남는다. `chooseSigil` 이 `SIGIL_TAKEN` 을 같은 큐 뒤에
> 붙이고 다시 0번부터 소비하면 **직전 틱 이벤트가 전부 두 번 실행된다.**
> 결과: 유령 스프라이트(SPAWN 재실행이 `sprites.set` 으로 이전 스프라이트를 고아로 만든다) ·
> 도감 처치 수 2배 집계 · 뜬금없는 히트스톱 · 데미지 숫자 중복.
> 기존 테스트가 못 잡은 이유는 `runToCompletion` 이 드래프트를 자체 처리하고 이벤트 큐를
> 소비하지 않아 이 경로를 아예 타지 않기 때문이다.
>
> #### ③ `flushSave()` 의 하이드레이션 가드가 무효 → 콜드 스타트 세이브 소실
>
> `await useGameStore.persist.rehydrate` — **괄호가 없어 함수 참조를 await** 한다. 즉시 통과한다.
> 세이브 로딩 전에 백그라운드로 전환되면 `setState({})` 가 **기본 상태를 디스크에 기록**하고,
> 그때 OS 가 앱을 죽이면(이 함수가 존재하는 바로 그 이유) 다음 실행에서 진행도가 전부 초기값이다.
>
> **②③ 조치 완료 (2026-08-03) — 아래 "감사 후속 ②③" 노트 참조.**
>
> #### 감사에서 배운 것
>
> 세 결함 모두 **병렬 작업의 산물**이다. 각 에이전트는 자기 파일만 보고 자기 테스트를 통과시켰고,
> 그 결과 "각자 옳은데 합치면 틀린" 상태가 됐다. lint 와 테스트는 이걸 구조적으로 잡지 못한다.
> **병렬로 만들었으면 합쳐진 결과를 따로 감사해야 한다.**

> ### 감사 후속 ②③ — 조치 노트 (2026-08-03)
>
> #### ② 각인 선택 시 직전 틱 이벤트 재소비
>
> **원인 (표면이 아니라 구조).**
> 이벤트 큐를 비우는 곳은 `step()` 첫머리 **하나뿐**인데, 시뮬을 재개시키는 진입점은
> 하나가 아니다. `chooseSigil()` 도 같은 큐에 `SIGIL_TAKEN`·`EVOLUTION` 을 **append** 한다.
> 게다가 드래프트는 `stepWaves()` 안에서 열리므로, 드래프트가 열린 틱은 **끝까지 다 돈다** —
> 그 틱의 SPAWN/ATTACK/DAMAGE/DEATH/TEMPO_SHIFT 가 큐에 남은 채로 시뮬이 멈춘다.
> 소비자(`BattleScene.consumeEvents`)가 매번 0번부터 훑었으므로, 각인을 고르는 순간
> 직전 틱 전체가 두 번째로 실행됐다.
> 즉 진짜 결함은 "커서가 없다"가 아니라 **"큐를 비우는 책임과 큐를 읽는 책임이 서로를
> 모른 채 한 곳에만 걸려 있었다"** 는 것이다.
>
> **조치 — (a) 소비 커서를 택했다. 다만 커서만으로는 부족하다.**
> `q.length` 는 매 틱 0 으로 되돌아가므로, 커서 단독으로는 "리셋됐다"와
> "이번 틱은 이벤트가 적다"를 구분할 수 없다 (직전 5건 소비 → 커서 5, 다음 틱 8건 방출 →
> 앞의 5건을 통째로 놓친다). 그래서 큐가 **세대(`epoch`)** 를 세고, 커서는 세대가 바뀌면
> 0 으로 되돌아간다.
>
> ```
> logic/events.js   createEventQueue()  → { pool, length, capacity, epoch }
>                   resetQueue()        → length=0, epoch++
>                   createEventReader() → { epoch:-1, cursor:0 }   ← 렌더러가 1개 보유
>                   drainEvents(q,r,fn) → 세대가 바뀌었으면 커서 리셋, 아직 안 읽은 것만 전달
> BattleScene       consumeEvents() = drainEvents(...)  / dispatchEvent(e) 로 switch 분리
> ```
>
> **(b) `chooseSigil()` 안에서 큐를 비우는 안은 기각했다.** 증상은 사라지지만,
> ㄱ) 렌더 사정("소비자가 두 번 읽는다")을 이유로 시뮬 진입점의 동작을 바꾸는 것이 되고 —
> `logic/` 은 소비자가 무엇을 어떻게 읽는지 몰라야 한다 —
> ㄴ) 앞으로 큐에 append 하는 진입점이 하나 늘 때마다 같은 버그가 다시 생긴다.
> "리셋을 잊지 않기"라는 규율 대신 **소비 측에서 '정확히 한 번'을 구조적으로 보장**한다.
> `epoch` 는 시뮬 수학이 읽지 않으므로 결정론에 영향이 없다 (B1 테스트 그대로 통과).
>
> **회귀 테스트 — `src/game/logic/events.test.js` (6건).**
> 기존 테스트가 못 잡은 이유는 `runToCompletion()` 이 드래프트를 스스로 해소하고
> **이벤트 큐를 아예 소비하지 않아** 소비자가 존재하지 않기 때문이다. 유일한 소비자인
> BattleScene 은 Phaser 씬이라 유닛 테스트가 인스턴스화할 수 없다.
> → 소비 로직을 순수 함수(`drainEvents`)로 끌어내고,
> **BattleScene 의 호출 순서를 그대로 재현하는 드라이버**를 테스트에 뒀다
> (`battle: step()→consume`, `draft: chooseSigil()→consume`).
>
> 고정하는 것:
> - 같은 세대에 나중에 append 된 것만 추가 전달 / 리셋 후 이벤트가 줄어도 앞부분을 안 건너뜀
> - **각인 선택 직후 소비되는 것은 `SIGIL_TAKEN`·`EVOLUTION` 뿐** ← 수정 전에는
>   측정한 **모든 스테이지·모든 시드의 모든 드래프트**에서 위반됐다
> - 같은 엔티티에 SPAWN/DEATH 가 두 번 전달되지 않음 (유령 유닛 · 도감 2배의 직접 원인).
>   30스테이지 × 12시드 스윕에서 실제 중복이 관측된 조합을 케이스로 박았다
>   (`1-11/8` · `1-12/4` · `2-2/7` SPAWN, `1-9/1` · `1-16/1` · `1-5/10` DEATH)
> - 전투당 TEMPO_SHIFT ≤ 1 — 템포 시프트 웨이브와 드래프트 웨이브가 겹치는
>   `1-2`~`1-4` 는 수정 전 **전 시드에서 2회** 소비됐다
>
> 커서를 되돌리면 6건 중 5건이 깨진다 (실측).
>
> #### ③ `flushSave()` 하이드레이션 가드 무효
>
> **원인.** `await useGameStore.persist.rehydrate` — 괄호가 없어 함수 *참조*를 await 했다.
> 그리고 zustand persist 는 `api.setState` 를 감싸 **하이드레이션 여부와 무관하게**
> 즉시 `storage.setItem` 을 호출한다 (`middleware.mjs` 확인).
> 콜드 스타트 중 홈 버튼 → `onPause` → `flushSave()` → 기본 상태가 디스크를 덮어썼다.
>
> **조치 — "기다렸다 저장"이 아니라 "저장하지 않음"을 택했다.**
> ```js
> if (!useGameStore.persist.hasHydrated()) return false;   // zustand 5: 둘 다 함수다
> await useGameStore.setState({});                          // setItem 프로미스를 await
> ```
> 기다리지 않는 이유 셋:
> 1. 이 함수가 불린 시점은 **앱이 곧 죽을 수 있는 시점**이다. await 가 돌아온다는 보장이
>    없으므로 기다림은 안전장치가 되지 못한다.
> 2. `persist.rehydrate()` 를 여기서 다시 부르면 **진행 중인 하이드레이션을 취소하고
>    새로 시작한다** (내부 `hydrationVersion` 증가). 복구 도중에 복구를 재시작시키는 셈이다.
> 3. 무엇보다 **잃을 것이 없다.** 하이드레이션 전에는 App.jsx 가 스플래시라 플레이어가 만든
>    변경이 존재할 수 없다. 메모리 == 초기값이고 디스크에 더 새 것이 있다. 안 쓰는 것이 옳다.
>
> 덤으로 `setState` 의 반환값(= `setItem` 프로미스)을 **await 하도록** 바꿨다.
> 예전에는 기록이 끝나기 전에 반환했다 — 앱이 죽기 직전이라면 그 차이가 세이브 한 판이다.
>
> **같은 형태의 실수 재발 방지 — 저장소 전체 grep.**
> `await <식별자>;`(괄호 없는 함수 참조 await) 는 `src/`·`tools/` 전체에서 이 한 곳뿐이었다.
> 다만 **같은 계열의 결함**을 `resetSave()` 에서 하나 더 찾아 같이 고쳤다:
> zustand 의 `clearStorage()` 는 `storage.removeItem()` 의 **프로미스를 반환하지 않는다**
> (`clearStorage: () => { storage?.removeItem(name) }`). Preferences 는 비동기이므로
> `await` 가 삭제 완료를 기다리지 못하고 즉시 통과하고, 호출부(SettingsScreen)는 반환 직후
> 앱을 재시작한다 → "초기화했는데 세이브가 남아 있다". 같은 키를 한 번 더(멱등) 지우고 await 한다.
>
> **회귀 테스트 — `src/store/index.test.js` (3건).**
> `@/native/storage` 를 통째로 모킹해 `getItem` 을 테스트가 **붙잡고 있다가** 원할 때
> 풀어 준다 (실제 `Preferences.get` 지연과 같은 모양). 그래야 "하이드레이션이 끝나지 않은
> 순간"을 붙잡을 수 있다 — 가드가 *생겼다*가 아니라 *동작한다*를 확인하는 유일한 방법이다.
> 고정하는 것: ㄱ) 복원 전 `flushSave()` 는 **디스크 기록 0건** · false 반환,
> ㄴ) 복원 후에는 기본값이 아니라 **복원된 값**(gold 777777 / highestStage 42)을 기록,
> ㄷ) 기록이 끝나기 전에 반환하지 않는다.
> 예전 코드로 되돌리면 3건 모두 깨지고, 기록된 원문이 `gold:0` · `highestStage:0` ·
> `roster.owned:{}` 로 정확히 보고된 피해와 일치한다 (실측).
>
> #### 검증
>
> `npm run lint` 경고 0 · `npm run test` 23파일 **533건 전부 통과**(신규 9건 포함) ·
> `npm run data:validate` 경고 0 · `npm run build` 성공.

> ### 추천 편성 방벽 2기 — 구현 노트 (2026-08-03)
>
> `recommendedLoadout` 이 방벽을 **1기**만 세우고 있었다. 레인이 3개인데 1기면
> 나머지 두 레인은 아무도 붙잡지 못하고, **막는 것은 오직 BLOCKER 뿐**이라
> 그 결손은 어떤 상성 답으로도 보상되지 않는다.
>
> 증상은 게이트 쪽에서 먼저 나왔다 — 3-20 에서 `recommended`(66.7%) 가
> `physical_only`(93.3%) 보다 **약했다.** 추천이 최적이 아니면 B4("무과금 추천 ≥55%")가
> 보증하는 것이 없어진다.
>
> 4개 후보 규칙을 60 스테이지 × 20시드로 측정해 정했다 (`tools/exp-recommend.mjs`):
>
> | 규칙 | 평균 승률 | 55% 미만 | 최저 |
> |---|---|---|---|
> | 방벽1 (기존) | 94.3% | **3개** | 3-10(20%) 2-20(35%) 2-10(45%) |
> | **방벽2 (채택)** | **97.4%** | **0개** | 3-10(60%) 1-9(65%) 2-10(70%) |
> | 방벽2 + 공성 우선 | 96.3% | 2개 | 1-9(25%) 2-10(25%) |
> | 방벽1 + 공성 우선 | 92.3% | 6개 | 2-20(10%) 2-10(20%) |
>
> 3기는 넣지 않는다 — 6칸 중 절반이 벽이면 상성 답을 넣을 자리가 없고,
> 그건 아키타입 `turtle`(방벽 과다)로 이미 열세가 검증된 편성이다.
>
> **함께 고친 것: 보스 페이즈 태그가 추천 입력에서 빠져 있었다.**
> `stageCounterTags()` 신설 — 스폰 태그 ∪ 보스 **전 페이즈** 태그.
> 페이즈마다 답이 바뀌는 것이 P6-05 설계의 전부라면, 추천 편성은 한 페이즈가 아니라
> 전 페이즈에 답을 갖고 있어야 한다. `tools/balance.mjs` 도 자체 `stageTags()` 를 버리고
> 이 함수를 쓴다 — 사본을 두면 게이트가 검증하는 편성과 플레이어가 받는 편성이 갈라진다.
>
> ### 보스 HP 재튜닝 — **시도했다가 되돌림** (2026-08-03)
>
> 추천 편성이 강해지자 보스가 쉬워졌다 (53~67% → 70~100%).
> `tools/tune-boss.mjs`(신규)로 `giant.hpMult` 를 이분 탐색해 4체를 62~70% 로 맞췄다.
> **그리고 되돌렸다.** 측정해 보니 값이 맞지 않는 거래였다:
>
> | | 승률 | ★2 달성 | 전투 길이 |
> |---|---|---|---|
> | 조정 전 | 70~100% | 1-20 20% · 2-20 7% · 3-20 97% | 1-20 254초 |
> | 조정 후 | 63~70% ✓ | 1-20 **7%** · 2-20 **3%** · 3-20 **50%** | 1-20 **271초** |
>
> 얻은 것은 "45~75%" 라는 **설계 선호**이고, 잃은 것은 소프트 게이트 **둘**
> (B10 ★2 달성률 · B9 전투 길이)이다. 하드 게이트 B4 는 조정 전에도 전부 통과했다.
> 소프트 게이트 둘을 주고 선호 하나를 사는 것은 남는 거래가 아니다.
>
> **그리고 더 중요한 이유:** 보스가 쉬워진 원인은 추천 편성이 **옳게** 강해진 것이다.
> 추천 편성은 정의상 그 스테이지의 정답이고, 정답이 이기는 것은 B4 가 요구하는 바로 그것이다.
> 보스는 **틀린 편성**에게 어려우면 된다 — 실제로 그렇다 (`arcane_heavy` 는 5체 중 4체에서
> 최약, 6.7~23%). HP 를 불려 정답까지 막는 것은 벽을 편성 퍼즐이 아니라 시간 벽으로 만든다.
>
> ★ 1-10 은 애초에 대상에서 뺐다. 튜너가 hpMult 27 → **325.6**(12배)을 제안했는데,
>   그 승률 하락은 위협이 아니라 **타임아웃**에서 온다. FTUE 첫 보스는 이겨야 한다.
>
> **남은 진짜 문제는 보스 HP 가 아니라 별 조건이다.** 1-20 ★2 20% · 2-20 ★2 7% 는
> 조정 전부터 낮았다. `targetTimeSec` 이 웨이브 수에서만 나오고 보스 HP 를 모르기 때문이다.
> 이건 보스별로 만질 것이 아니라 B9/B10/B11 을 함께 보는 작업이다.
>
> 튜너(`tools/tune-boss.mjs`)는 남겨 둔다 — 추천 편성이 또 바뀌면 다시 필요하고,
> 그때 손으로 맞추면 재현 불가능한 작업이 된다.

> ### P7-03 패배의 質 — 측정 결과 및 **미해결** (2026-08-03)
>
> B3 을 통과시킨 뒤 "그래서 그 패배가 아깝게 느껴지는가"를 처음으로 측정했다.
> 측정 도구는 `tools/defeat-quality.mjs` (신규). 지표는 **패배 시점의 적 잔여 HP 비율**
> 이며, 남은 *마릿수*가 아니라 *HP 총량*이다 — SWARM 과 고HP 소수가 섞이면
> 마릿수는 진행도를 대변하지 못한다 (구더기 20마리 = 코뿔소 1마리가 되어 버린다).
>
> **결과: 목표 5–15% 에 대해 실측 82%. 어떤 편성으로도 밴드에 들지 않는다.**
>
> | 1-9 편성 | 승률 | 패배 시 적 잔여 HP (중앙값) | 밴드내 |
> |---|---|---|---|
> | `recommended` | 41.7% | **68.4%** | 0% |
> | `balanced` | 8.3% | **82.4%** | 0% |
> | `c_only` (초반 플레이어) | 0.0% | **82.9%** | 0% |
> | `physical_only` | 4.2% | **82.2%** | 0% |
>
> 즉 **1-9 는 "아깝게 지는 스테이지"가 아니라 전원에게 벽이다.**
> 플레이어는 18 웨이브 중 3~4 웨이브에서 방주가 터진다. 그 경험은
> "편성을 바꾸면 넘겠다"가 아니라 "이건 벽이다"로 읽히고, FTUE 는 거기서 끝난다.
>
> **B3 와 P7-03 은 현재 손잡이로 동시에 만족되지 않는다.**
> 7 회 스윕(배율 · 후반 급증 · 선형 램프 · 방주 HP · 웨이브 수)의 요약:
>
> | 시도 | 승률 | 잔여 HP | 판정 |
> |---|---|---|---|
> | `difficultyMult` 3.6 (현재) | 39.5% ✓ | 67.5% ✗ | B3 만 통과 |
> | mult 3.0 + 후반3웨이브 ×4 | 87.5% ✗ | 6.2% ✓ | P7-03 만 통과 |
> | mult 3.2 + 후반5웨이브 ×2.5 | 90.0% ✗ | 11.9% ✓ | 〃 |
> | mult 7.5 + 방주HP 820 | 82.5% ✗ | 11.0% ✓ (밴드 76%) | 〃 |
> | mult 2.6 + 8웨이브로 단축 | 87.5% ✗ | 9.6% ✓ (밴드 67%) | 〃 |
> | 선형 램프 (9~14웨이브) | 47~58% | 45~65% ✗ | 둘 다 실패 |
>
> **구조적 이유.** 승률을 40% 로 떨어뜨리는 압박은 자동 플레이를 *초반에*
> 무너뜨린다. 자동 플레이에는 적응이 없어서, 스테이지가 이기면 **결정적으로**
> 이긴다. 반대로 패배를 끝까지 미루면 승률이 80% 아래로 내려가지 않는다.
> 수치를 더 쓸어도 이 벽은 넘지 못한다 — 손잡이가 하나 더 필요하다.
>
> **다음에 시도할 것 (이 티켓의 실제 작업)**
> - **중간 회복 지점** — 웨이브 사이 방주 소량 회복. 앞을 넘기게 하면서 뒤에서
>   무너뜨리는 유일하게 직접적인 수단이다. 새 규칙이라 시뮬 변경이 필요하다.
> - **적응형 자동 플레이** — 자동 플레이가 지고 있을 때 편성을 바꾸도록 하면
>   측정 대상이 실제 사람에 가까워진다. 지금 수치는 "고정 전략의 패배"를 재고 있다.
> - **후반 급증 손잡이는 이미 있다** — `gen-stages.mjs` 의 `beat.surge`
>   (`{waves, mult}`). 총량은 `maxBodies` 가 보존하고 분포만 뒤로 민다.
>   위 표의 "P7-03 만 통과" 행들이 이 손잡이로 만든 것이다.
>
> **지금 상태:** 1-9 는 `difficultyMult 3.6` 으로 되돌려 두었다 —
> **하드 게이트 B3 을 지키는 쪽을 택했다.** P7-03 은 열린 채로 둔다.

> ### P7-03 재도전 — **왜 안 되는지 규명했다** (2026-08-03) · 구조적 미해결
>
> 앞 노트의 "다음에 시도할 것"을 전부 실행했다. **약 80개 격자점 · 5개 축**
> (웨이브 사이 방주 회복 · 난이도 배율 · 후반 급증 배수 · 급증 구간 길이 · 밀도 분포).
> 결론은 **동시 만족점이 없다**이고, 이번에는 **이유를 안다.**
>
> #### 먼저 측정 도구 두 가지가 틀려 있었다 (이걸 못 잡았으면 틀린 값을 확정할 뻔했다)
>
> | 오류 | 증상 | 실제 |
> |---|---|---|
> | 튜닝 도구가 `pendingSpawns`(큐에 있지만 필드에 없는 적)를 **집계에서 누락** | 회복 2 + 급증 2 가 **"잔여 12.3%"** 로 나와 목표 달성처럼 보였다 | 바로잡으니 **85.7%**. 후반 급증 물량이 통째로 사라지고 있었다 |
> | **타임아웃 패배**를 방주 격침과 섞어 셈 | 회복을 올리면 방주가 안 죽어 400초 상한에 걸리는데, 그게 **"잔여 0%"** 로 집계됐다 | 완벽한 접전이 아니라 **끝나지 않는 판**이었다 |
>
> → `tools/lib/defeat.mjs` 신설. `defeat-quality.mjs`(측정)와 `tune-first-defeat.mjs`(튜닝)가
> **같은 함수**를 쓴다. 튜닝 도구가 자기 사본을 갖는 순간 측정과 튜닝이 갈라진다.
>
> #### 규명된 구조 — 손잡이가 전부 **같은 변수**를 움직인다
>
> **① 패배는 초반이 아니라 중후반에 일어난다** (실측, 40시드):
> 패배 웨이브 분포 `{9:1, 10:5, 11:9, 12:2, 14:2, 17:2, 18:3}` — **중앙값 11/18**.
>
> **② 그런데 잔여 HP 는 81% 다.** 밀도가 의도적으로 후반에 몰려 있기 때문이다
> (템포 시프트 ×1.6). 웨이브 11 종료 시점에 **스폰된 물량이 45.5%** 뿐이고,
> 그마저 다 잡지 못한 채(실제 처치 ≈19%) 살아 있는 적이 필드에 쌓여 방주가 터진다.
> → **잔여 HP 는 "얼마나 갔나"가 아니라 "밀도 곡선이 어떻게 생겼나"를 재고 있다.**
>
> **③ 방주 회복은 죽는 *시점*만 바꾸고 *진도*를 바꾸지 못한다.**
> 회복 20 · 30 · 45 · 65 가 **완전히 같은 결과**(승률 30.0% · 잔여 64.1%)를 냈다 —
> 최대치에서 잘리므로 그 이상은 무의미하고, **패배 판은 한 웨이브에 100 이상을 맞아
> 즉사**하기 때문이다. 누적이 아니라 **단발 범람**이 죽인다.
> 회복 ≥10 이면 패배해도 웨이브 18 까지 가지만(진행 100%), 그건 *버틴* 것이지
> *따라간* 것이 아니다 — 잔여는 41~71% 로 남고 승률은 53~90% 로 뜬다.
>
> **④ 배율로 승률을 되돌리면 다시 일찍 죽는다.** 회복 14 + 배율 6.5 가 승률 45%(밴드 상단)에
> 진행 100% 를 냈지만 잔여 71.4% — 화면 가득 적을 두고 회복으로만 서 있는 상태다.
>
> **⑤ 밀도 평탄화도 안 된다.** 후반 9웨이브를 0.4~0.8 배로 낮추면 잔여 64~77% 에
> 승률은 48~100% 로 오른다.
>
> **한 문장:** 승률과 "아깝게 짐"은 **둘 다 화력이 스폰을 따라가는가의 함수**라서
> 같이 움직인다. 방주 HP·회복은 **죽는 시점**만 분리할 뿐 **처치 진도**를 분리하지 못한다.
>
> #### 만든 것 — `arkRegenPerWave` (웨이브 사이 방주 회복)
>
> 시뮬 규칙으로 **구현·테스트 완료**했고 **전 스테이지에서 0**(꺼짐)이다.
> 밸런스 영향은 정확히 0 이며, `arkRegen.test.js`(9건)가
> "0 이면 규칙이 없던 때와 결과가 같다"를 못 박는다. 손잡이는 남기고 쓰지 않는다 —
> 다음 사람이 같은 탐색을 처음부터 다시 하지 않게 하기 위해서다.
>
> #### 남은 것은 수치가 아니라 **설계 결정** 두 개다
>
> | 선택지 | 내용 | 대가 |
> |---|---|---|
> | **A. 지표를 바꾼다** | "잔여 HP" → **웨이브 진행률**. 현재 1-9 는 중앙값 **11/18 = 61%** 이고, 목표를 70~85% 로 잡으면 회복만으로 도달 가능하다 | "아깝게 졌다"의 정의를 바꾸는 것이다. 다만 지금 지표는 밀도 곡선을 재고 있어 **애초에 의도를 대변하지 못한다** |
> | **B. 적응형 자동 플레이** | 지고 있을 때 편성을 바꾸는 자동 플레이. 지금 수치는 **고정 전략의 패배**를 재고 있다 | 하네스 작업이며 게임은 안 바뀐다. 사람에 가까워지지만 "사람이 실제로 그렇게 하는가"는 여전히 가정이다 |
>
> ★ **어느 쪽도 임의로 고르지 않는다.** 둘 다 "무엇을 재는 것이 옳은가"에 대한 판단이고,
> 그 판단은 **사용자가 실제로 1-9 에서 져 보고 나서** 하는 것이 맞다
> (`30-roadmap.md` §0 방침 전환 — 재미의 판단은 사용자 플레이로 미뤘다).
> **B3(하드 게이트)은 38% 로 통과 중이며 이번 작업으로 건드리지 않았다.**

> ### 보스가 두 마리였다 — 템포 시프트가 유일 개체를 복제 (2026-08-03)
>
> **증상.** 템포 시프트 물량 배율(`tempoDensityMult` 1.6)이 `count: 1` 인 보스 스펙에도
> 곱해져 `Math.round(1 × 1.6) = 2` → **전 보스 스테이지에서 보스가 2체** 스폰됐다.
> 전 스테이지 스폰 스펙 1,426개 중 **63개**가 조용히 1 → 2 가 됐고, 그중 6개가 거대화 엘리트다.
>
> **두 번째 보스는 한 마리 더가 아니라 규칙 밖의 개체였다.**
>
> | 경로 | 무슨 일이 일어났나 |
> |---|---|
> | `attachBoss()` | 이미 등록된 보스가 있으면 조기 반환 → 복제본은 **페이즈 전환도 슬램도 없이** base 태그로 고정 |
> | `noteBossBreach()` | 등록된 id 만 본다 → **"보스가 방주에 닿으면 패배" 규칙을 통째로 우회** |
>
> 즉 P6-05 설계(3페이즈 · 페이즈마다 태그 변경)가 전부 적용되지 않는 두 번째 보스가
> 판마다 같이 걸어 나오고 있었다. **보스전의 난이도 절반이 설계 밖에서 오고 있었다.**
>
> **기존 보스 테스트가 못 잡은 이유는 등록된 보스만 검사했기 때문이다.**
> 복제본은 애초에 `attachBoss()` 를 통과하지 못하므로 시야 자체가 밖이었다.
>
> **조치 — 규칙을 함수로 꺼냈다.**
> ```
> logic/spawn.js        spawnCountFor(def, specCount, density)
>                       유일 개체(boss.phases · giant) → specCount 그대로
>                       잡몹 → max(1, round(specCount × density))
> logic/stageConfig.js  normalizeDef 가 giant · boss 를 **스케일된 정의에 보존**
>                       (여기가 끊기면 규칙이 프로덕션 경로에서만 조용히 죽는다)
> ```
> 밀도 배율 자체는 죽이지 않았다 — 그건 난이도 손잡이다. **유일 개체만 예외다.**
>
> ★ **전투를 끝까지 돌려서 검증하지 않는다.** 지는 판에서는 보스가 **아예 나오지 않아**
> "2체인가"를 물을 수조차 없다 — 실제로 그렇게 짜 보고 전 스테이지가 0마리로 집계되는
> 것을 겪었다. 규칙(`spawnCountFor`)만 따로 재는 것이 옳다.
> 회귀 테스트는 `src/game/logic/spawnDensity.test.js` 이고, 전 스테이지의 유일 개체
> 스폰 스펙을 **전수** 검사한다 (노멀 · 하드 양쪽). 마지막 한 건은 원본이 아니라
> `buildStageConfig` 가 만든 **프로덕션 형태**로 확인한다 — 원본으로만 재면 정의 형태가
> 갈라져도 모른다.
>
> **밸런스 영향 (보스 6체 × 편성 11 × 30시드, 노멀).**
> 복제 보스가 사라지면서 보스전이 쉬워졌다. `recommended` 는 6체 전부 **100%** 다
> (수정 전: 1-10 100% · 1-20 83.3% · 2-10 80% · 2-20 86.7% · 3-10 70% · 3-20 100%).
>
> | 스테이지 | recommended | arcane_heavy | no_blocker | turtle | spam_cheapest |
> |---|---|---|---|---|---|
> | 1-10 | 100% | 100% | 80.0% | 90.0% | **13.3%** |
> | 1-20 | 100% | 70.0% | **3.3%** | **0%** | **0%** |
> | 2-10 | 100% | 63.3% | **6.7%** | 33.3% | **0%** |
> | 2-20 | 100% | 50.0% | **3.3%** | **3.3%** | **0%** |
> | 3-10 | 100% | 53.3% | **3.3%** | **0%** | **0%** |
> | 3-20 | 100% | 96.7% | **3.3%** | **0%** | **0%** |
>
> **밴드(45–75%)를 다시 벗어났지만 되돌리지 않는다.** 이유는 "보스 HP 재튜닝 — 시도했다가
> 되돌림"(위)과 **같고**, 이번에는 더 강하다: 잃어버린 난이도는 **설계된 난이도가 아니라
> 규칙을 우회하는 개체가 만들던 난이도**였다. 그것을 지키려고 되살릴 수는 없다.
> 보스는 **틀린 편성**에게 어려우면 되고, 위 표가 그것을 보여준다 —
> 방벽 없는 편성 3.3% · 방벽 과잉 0% · 최저가 스팸 0%.
>
> ⚠ **이 표가 P6-05·P6-06 의 보스 난이도 기준선을 대체한다.** 그 이전 측정값은 전부
> 보스 2체 기준이므로 비교 대상으로 쓰면 안 된다.

> ### 5-15 · 5-19 벽 — **닿지 못하는 답은 답이 아니었다** (2026-08-03)
>
> 월드 4–5 가 들어온 뒤 100 스테이지 전수 측정에서 **하드 게이트 2개가 실패**했다.
>
> ```
> ✗ B4    무과금 추천 편성 승률 ≥55%     5-15(12%) · 5-19(20%)
> ✗ WALL  벽 스테이지 0개 (추천 <25%)    5-15 · 5-19
> ```
>
> **먼저 물은 것: 로스터에 답이 있는가.** 없으면 콘텐츠·동료 문제이고, 있으면 추천 규칙의
> 문제다. 손으로 짠 편성 7종을 5-15 · 5-19 에 돌렸다 (40시드):
>
> | 편성 | 5-15 | 5-19 |
> |---|---|---|
> | 현행 추천 | **15.0%** | **25.0%** |
> | **방벽2 + 물리 대공 2 + 술식 + 신성** | **95.0%** | **72.5%** |
> | 방벽2 + 대공3 | 92.5% | 27.5% |
> | 방벽2 + 대공4(신성 비행 포함) | 10.0% | 5.0% |
> | 비물리 전열 | 10.0% | 27.5% |
>
> **답은 로스터 안에 있었다.** 현행 추천과의 차이는 **단 한 칸** —
> `clucking_chicken`(근접 물리) → `leaf_ranger`(물리 대공).
>
> **원인 — 태그는 적별로 조합되는데, 추천은 태그를 낱개로 답했다.**
>
> `recommendedLoadout` 은 스테이지 태그의 **합집합**을 보고 태그마다 답을 하나씩 넣었다.
> 5-15 의 `WARDED` 답으로 뽑힌 것은 "첫 번째 방벽 아닌 물리 유닛" = `clucking_chicken`
> 이다. 그런데 5-15 의 WARDED 적은 `ghastly_eye`(`FLYING`+`WARDED`+`CORRUPT`) **25마리**로
> 전부 비행이다. 근접 물리는 **영원히 닿지 못한다** (`combat.js:canTarget` — 물리는
> `ANTI_AIR` 가 있어야 공중을 때린다).
>
> **답이 편성에 들어가 있었고, 표적에 닿지 못했을 뿐이다.**
> 기존 테스트가 전부 통과한 이유가 이것이다 — 물었던 것은 언제나
> "물리 딜러가 들어갔는가"였고, 들어가 있었다.
>
> **조치 — 규율 두 개.**
>
> | # | 규율 | 없을 때 |
> |---|---|---|
> | ① | **닿지 못하는 답은 답이 아니다.** 그 태그를 지닌 적이 과반 비행이면 답도 공중에 닿아야 한다 | 근접이 비행 WARDED 의 답으로 뽑힌다 (5-15 = 15%) |
> | ② | **한 유닛이 두 답을 겸할 수 없다.** 이미 뽑힌 유닛은 건너뛰고 다음 후보 | ①만 넣으면 `WARDED` 와 `FLYING` 의 답이 같은 유닛으로 겹쳐 대공이 1기로 남는다 (35%) |
>
> ①은 시뮬과 **같은 명제**를 쓴다 — `combat.js` 에서 `canHitFlying(tagMask, dmgType)` 을
> 꺼내 `canTarget` 과 추천이 **한 함수**를 부른다. 사본이면 언젠가 갈라진다.
>
> ②가 잡은 것은 `push()` 의 **조용한 중복 무시**였다. 두 태그의 답이 같은 유닛이면
> 뒤 태그가 **답 없이 지나가고** 그 칸이 일반 채우기로 넘어갔다 — 답이 하나 사라진 것을
> 아무도 볼 수 없었다.
>
> **실측 (100 스테이지 × 20시드, 세 규칙 비교)**
>
> | 규칙 | 평균 | 55% 미만 | 벽(<25%) | 최저 |
> |---|---|---|---|---|
> | 현행 | 96.8% | 3개 | **2개** | 5-15(20%) 5-19(20%) 1-9(45%) |
> | ① 닿는 답만 | 97.3% | 2개 | 0개 | 5-15(35%) 1-9(45%) |
> | **①+② (채택)** | **98.0%** | **1개** | **0개** | 1-9(45%) |
>
> 남은 1개는 **1-9 — 설계된 첫 패배**이고 B4 에서 제외되는 스테이지다.
> ★ **±10%p 이상 움직인 스테이지는 5-15 · 5-19 둘뿐이며 둘 다 상승이다.**
> 회귀가 없다는 것을 평균이 아니라 **스테이지별 차분**으로 확인했다.
>
> **입구를 하나로 만들었다 — `recommendedLoadoutForStage(stageId)`.**
> 예전에는 호출부마다 `stageCounterTags(stageEnemyCounts(id))` 를 손으로 조합했고,
> 그래서 **마릿수를 아무도 넘기지 않았다** — "이 태그의 적이 비행인가"를 물을 수가 없었다.
> `tools/balance.mjs` · `balance-check.mjs` · `defeat-quality.mjs` · `tune-boss.mjs` ·
> `StagePreview.jsx` 가 전부 이 하나를 부른다.
> ★ `defeat-quality.mjs` 에는 **자체 `stageTags()` 사본**이 있었다 (보스 페이즈 태그 누락 +
> 마릿수 없음). 게이트가 재는 편성과 다른 편성을 재고 있었다 — 지웠다.
>
> **`tools/exp-recommend.mjs` 도 사본을 갖고 있었다.** 본체에 이 규칙이 들어와도
> 따라오지 않아 **현재 존재하지 않는 규칙**을 재게 된다. `recommendedLoadout` 에
> `{blockerCount, fillOrder}` 손잡이를 주고 실험이 **본체를 그대로 돌리도록** 바꿨다.
>
> **회귀 테스트 6건** (`stagePreview.test.js`). 고정하는 것:
> WARDED 적이 과반 비행인 **10 스테이지 전부** 공중에 닿는 물리를 포함 ·
> 5-15 의 물리 대공이 정확히 **2기** · 두 스테이지에 `clucking_chicken` 이 없고
> `elf_sharpshooter`·`leaf_ranger` 가 있음 · `ForStage` 와 집계 직접 전달이 **100 스테이지
> 전부 동일** · 하네스가 같은 입구를 재수출.

> ### ✅ P6 게이트 — 2차 전수 측정 (2026-08-03) · **하드 실패 0**
>
> **100 스테이지 × 편성 11 × 50 시드 = 55,000 전투 / 약 17분.**
> 1차(2026-08-02)는 60 스테이지 기준이었고 하드 6개가 실패했다. 월드 4–5 가 들어온
> 뒤의 전수 측정은 이번이 처음이며, 위 "닿는 답" 수정 **전** 측정에서 하드 2개
> (B4 · WALL)가 실패했다가 수정 후 **전부 통과**로 바뀌었다.
>
> | 게이트 | 1차 (60st) | **2차 (100st)** | 비고 |
> |---|---|---|---|
> | B2 튜토리얼 ≥85% | ✔ | **✔** | 100/100/100% |
> | B3 설계된 첫 패배 30–45% | ✗ 95.7% | **✔ 38%** | `difficultyMult` 3.75 |
> | B4 무과금 추천 ≥55% | ✗ 2-13 | **✔ 전 구간** | 수정 전 5-15(12%) · 5-19(20%) |
> | B5 ARMORED 에 술식>물리 | ✗ | **✔** | |
> | B6 스팸 억제 | ✔ | **✔** | 100/100 |
> | B7 전 동료 등장 | ✗ | **✔** | 25/25 |
> | B16 방벽 없으면 열세 | ✗ 3-13·3-19 | **✔** | |
> | WALL 벽 0개 | ✗ 2-13 | **✔ 없음** | 수정 전 5-15 · 5-19 |
> | **하드 소계** | **6 실패** | **0 실패** | |
> | B9 전투 길이 (소프트) | ✗ | ✗ | 1-3:47s · 1-20:231s · 4-20:200s |
> | B10 ★2 45–60% (소프트) | ✗ 96.9% | ✗ **95.3%** | |
> | B11 ★3 20–35% (소프트) | ✗ 57.8% | ✗ **47.0%** | |
> | B13 각인 픽률 (소프트) | ✔ | ✗ | 30/30 등장 · `thin_line` 0.75% |
>
> ⚠ **50 시드다** (게이트 정본은 300 시드). 100 스테이지 × 11 편성 × 300 시드는
> 약 33만 전투 = **2.5시간**이라 반복 검증에 쓸 수 없다. 하드 판정은 여유가 크므로
> (B4 는 5-15 12% → 95%) 50 시드로 뒤집힐 값이 아니지만, **릴리스 전 300 시드 1회는
> 따로 돌린다.**
>
> **남은 소프트 4건은 하나의 문제다 — 별 조건이 보스를 모른다.**
> B10(★2 95.3%) · B11(★3 47.0%) 이 밴드 위로 뚫려 있고 B9(전투 길이)가 함께 걸린다.
> `targetTimeSec` 이 **웨이브 수에서만** 나오고 보스 HP 를 모르기 때문이다 —
> 보스전은 길어지는데 목표 시간은 그대로라 별을 놓치고("보스 HP 재튜닝" 노트 참조),
> 반대로 일반 스테이지는 추천 편성이 강해져 ★2 를 거의 다 받는다.
> **보스별로 만질 것이 아니라 B9/B10/B11 을 함께 보는 작업이다.** 다음 티켓.
> ★ B13 `thin_line`(0.75%)은 각인 하나의 픽률이며 별 조건과 무관하다 — 별개로 본다.

> ### 별 조건 튜닝 B9 · B10 · B11 (2026-08-03)
>
> #### B9 — **실패 4건이 게이트 버그였다**
>
> `balance-check.mjs` 가 보스 스테이지를 **`-10` 접미사로만** 판정하고 있었다.
> 그런데 `worlds.json` 의 beat 는 **10 과 20 양쪽**에 보스를 둔다 — 월드 보스(Nemesis)가
> `-20` 이다. 그래서 `1-20 · 2-20 · 3-20 · 4-20` 이 전부 일반 밴드(60–180s)로 판정됐고,
> **넷 다 보스 밴드(120–300s) 안**이었다.
>
> | 스테이지 | 실측 | 일반 밴드 판정 | 보스 밴드 판정 |
> |---|---|---|---|
> | 1-20 | 230.6s | ✗ 초과 | **✔** |
> | 2-20 | 193.6s | ✗ 초과 | **✔** |
> | 3-20 | 181.7s | ✗ 초과 | **✔** |
> | 4-20 | 199.7s | ✗ 초과 | **✔** |
>
> 판정 근거를 **데이터에 묻도록** 고쳤다 — `enemies.json` 에서 `boss.phases` 를 가진 적을
> 찾고, 그 적이 스폰 테이블에 있는 스테이지를 보스 스테이지로 친다.
> ★ id 접미사로 종류를 판단하는 코드는 콘텐츠가 늘어나면 반드시 틀린다.
>
> **남는 실제 실패는 3건이다**: `1-3`(47.1s) · `1-4`(57.9s) — 60초 미만으로 짧고,
> `5-16`(180.6s) — 상한을 0.6초 넘긴다. 앞의 둘은 월드 1 초반이라 의도에 가깝고
> (FTUE 는 "0:50 에 첫 승리"를 요구한다), 셋 다 밴드 경계에 붙어 있다.
>
> #### B10 · B11 — **★2 는 48% 아래로 내려갈 수 없다** (구조적 하한)
>
> 별 판정은 **가산**이다 (`lifecycle.computeStars`): 방주 무손실 +1, 시간 이내 +1.
> 따라서 **★2 = (방주 OR 시간) · ★3 = (방주 AND 시간)** 이다. 이 구조가 전부를 설명한다.
>
> 추천 편성의 **방주 무손실 달성률이 약 48%** 이고, `arkRatio` 는 이미 **1**(무손실) —
> 더 엄격하게 만들 수 없는 최댓값이다. 그러므로 `timeRatio` 를 아무리 조여도
> **★2 는 48% 밑으로 내려가지 않는다.** 반대로 시간 조건을 풀면 ★2 는 100% 로 붙는다.
>
> 측정 도구를 새로 만들었다 — **`tools/tune-stars.mjs`**.
> ★ 별 판정은 전투가 끝난 상태의 함수이므로 **전투는 한 번만 돌리고** `(arkHp, t)` 를 기록해
> 임계값 격자를 즉시 평가한다. 전수 밸런스 런은 17분이라 임계값마다 돌리면 격자 탐색이
> 불가능하고, 불가능하면 손으로 찍게 되고, 손으로 찍은 값은 왜 그 값인지 아무도 설명하지 못한다.
> 판정식은 `computeStars` 를 **그대로 부른다** (사본 금지).
>
> **실측 (100 스테이지 × 50시드, 추천 편성 · 도입부 제외 90 스테이지)**
>
> | timeRatio | 0.45 | 0.55 | 0.57 | **0.58** | 0.59 | 0.60 | 0.65 | 0.78(현행) |
> |---|---|---|---|---|---|---|---|---|
> | ★2 (45–60%) | 50.7 ✔ | 57.3 ✔ | 59.1 ✔ | **61.5 ✗** | 64.7 ✗ | 68.6 ✗ | 84.0 ✗ | 95.3 ✗ |
> | ★3 (20–35%) | 9.4 ✗ | 12.9 ✗ | 17.2 ✗ | **20.8 ✔** | 25.9 ✔ | 30.5 ✔ | 43.2 ✗ | 47.0 ✗ |
>
> **두 밴드를 동시에 만족하는 값은 없다.** 0.57 과 0.58 사이에서 갈린다.
>
> **확정: `timeRatio` 0.78 → 0.58.**
>
> | | 이전 | 이후 | 밴드 |
> |---|---|---|---|
> | ★2 | 95.3% (**+35.3 초과**) | **61.5%** (+1.5 초과) | 45–60% |
> | ★3 | 47.0% (**+12.0 초과**) | **20.8% ✔** | 20–35% |
>
> ★3 을 밴드 안에 넣는 쪽을 택했다 — ★3 은 **완주 지표**이고 별 트리·시설 해금의 상류라
> 밴드를 벗어나면 메타 성장 속도가 통째로 밀린다. ★2 의 잔여 1.5%p 는 시드 노이즈(±3~4%)
> 안이며, 무엇보다 **현재 손잡이로는 제거할 수 없다.**
>
> ⚠ **남은 것은 수치가 아니라 별 조건의 구조다.** ★2 를 밴드 안으로 넣으려면
> 방주 조건을 무손실이 아닌 **다른 축**(예: 처치율 · 돌파 허용 수)으로 바꾸거나,
> ★2/★3 의 OR/AND 구성을 바꿔야 한다. 둘 다 `13-progression-meta.md` 의 설계 변경이므로
> 여기서 임의로 하지 않는다 — **별도 설계 티켓**으로 남긴다.
> ★ `targetTimeSec` 이 웨이브 수에서만 나오고 보스 HP 를 모르는 문제는 여전히 남아 있다.
> 이번 튜닝은 전역 비율을 옮긴 것이라 **스테이지 간 편차는 그대로**다
> (보스 시간비율 0.61~0.82). 편차를 줄이는 것이 그 티켓의 내용이 된다.

> ### ✅ P7-04 계측·퍼널 · P7-07 소환 연출 · P7-13 로컬 알림 (2026-08-03)
>
> 세 티켓 모두 규칙을 `logic/` 순수 함수로, 수치·문구를 `data/*.json` 으로 분리했다.
>
> | 티켓 | 규칙 | 데이터 | 화면 |
> |---|---|---|---|
> | P7-04 | `logic/funnel.js` (카탈로그 · `computeFunnel`) | `data/analytics.json` | `screens/DevAnalyticsScreen.jsx` |
> | P7-07 | `logic/gachaPresentation.js` (연출 **계획**) | `data/gachaFx.json` | `screens/GachaReveal.jsx` |
> | P7-13 | `logic/notifications.js` (예약 규칙) | `data/notifications.json` | `native/notifications.js` |
>
> **P7-04 — 계측이 지키는 것은 셋이다.**
> ㄱ) **이름 일치** — `analytics.json` 의 ftue 그룹과 `ftue.json` 의 `event`·`showEvent` 가
> **양방향으로** 같다. 한쪽에만 있는 이름은 "쏘는데 정의가 없는 이벤트"이거나
> "정의만 있고 아무도 안 쏘는 이벤트"이고, 둘 다 출시 1주차에야 발견된다.
> ㄴ) **속성 차단** — 선언되지 않은 키는 버퍼에 들어가지 않는다. 이것이
> "개인정보를 넣지 마라"의 **유일한 집행 지점**이다.
> ㄷ) **퍼널 산술** — 도달률(분모 = 퍼널 이벤트를 하나라도 남긴 세션 수) · 이탈률(직전 단계 대비) ·
> 단계 간 소요 시간 중앙값. `now` 는 인자다 (절대규칙 1).
>
> ★ 단계 도달은 **'했는가'이지 '몇 번 했는가'가 아니다** — 재도전으로 `stage_defeat` 가
> 세 번 나와도 이탈률이 세 배가 되면 안 되므로 세션별 **최초 발생만** 센다.
>
> **P7-07 — 연출은 이미 결정된 결과를 보여줄 뿐이다.**
> `gachaPresentation.js` 에는 난수가 없고, 등급을 정하는 코드가 없고, `gacha.json` 을
> 읽지도 않는다. 입력 `results` 를 **순서까지 보존해** 돌려준다 —
> 결과와 시드 커서는 화면이 열리기 **전에** 확정된다(P7-05 의 '소비 → 산출' 순서).
> 연출 중에 다시 뽑는 순간 확률 공개(P7-06)가 전부 무효가 되므로,
> "입력 순서 == 출력 순서"를 테스트가 못 박는다. 밀리초는 코드에 하나도 없다 (`gachaFx.json`).
>
> **P7-13 — 서버가 없으므로 원격 푸시는 존재할 수 없다.**
> (2026-08-03 결정. 발송 주체가 서버이기 때문이다.) 만든 것은 전부 **기기가 스스로 미래
> 시각에 예약하는 로컬 알림**이고, "언제 울릴지가 지금 이미 계산 가능한" 것만 넣었다 —
> 방치 상한 · 출석/퀘스트 리셋 · 시즌 종료. 서버가 있어야만 가능한 알림은
> `notifications.json:serverOnly` 에 **적어 두었다** (없는 기능을 있는 척하지 않기 위해서다).
> 일자·주차 경계는 출석·상점과 **같은 함수**(`daily.js`)를 쓴다 — 사본을 두면 언젠가
> "퀘스트는 리셋됐는데 알림은 어제 기준"이 되고, 그건 사용자에게 버그로 보인다.
>
> **퍼널 이탈 지점 테스트 1건 수정.** `dropoff` 검사가 3단계짜리 퍼널을 가정한
> 픽스처를 쓰고 있었는데 실제 퍼널은 **19단계**다. 아무도 도달하지 못한 뒤쪽 단계는
> 이탈률이 100% 이므로 검사가 늘 "퍼널 끝"을 가리켰고, 정작 재려던 *앞쪽 두 단계 중
> 어느 쪽인가*를 재지 못했다. 완주 세션을 포함하도록 픽스처를 고쳤다 —
> **구현이 아니라 검사가 틀렸다** (25% vs 33% · 동률 시 앞선 단계, 둘 다 실측 확인).

---

## ★ P8 — 게임 완성 (현재 Phase, 2026-08-03 재정의)

> **원래 P8 은 "소프트런칭 · 지표 판정"이었다. 방침 전환으로 통째로 대체됐다**
> (`30-roadmap.md` §0). 실플레이어가 없으므로 지표 판정은 성립하지 않는다.
> **다음 단계는 지표가 아니라 사용자다** — 게임을 완성한 뒤 사용자가 직접 플레이하며 고친다.

**목표: 타이틀에서 시작해 마지막 스테이지까지, 막히는 곳 없이 혼자 끝까지 갈 수 있다.**

| ID | 크기 | 작업 | 비고 |
|---|---|---|---|
| P8-01 | M | **전 화면 도달 경로 검사** — 라우터에서 출발해 모든 화면에 진입 가능 | 만들었는데 갈 수 없는 화면 0개 |
| P8-02 | L | ✅ **신규 계정 → 마지막 스테이지 자동 완주** 하네스 (`npm run playthrough`) | 3계정 전부 완주 · 15일 · 대기 0회. **확정 지급 규칙 신설**(세이브 v13) |
| P8-03 | M | 해금 조건 전수 검사 — 던전 25 · 탑 40 · 하드 · 돌파 시험 | 기존 진행도를 거꾸로 잠그지 않는지 포함 |
| P8-04 | M | 수량 정합 — 동료·각인·적이 도감·편성·가챠에서 **같은 수**로 보인다 | 병렬 개발이 만드는 전형적 결함 |
| P8-05 | M | 세이브 내구성 — 손상 · 미래 버전 · 부분 결손에서 죽지 않는다 | |
| P8-06 | S | 디버그 잔재 제거 · 프로덕션 빌드 점검 | `32-definition-of-done.md` §4 |

**P8 게이트 = `32-definition-of-done.md` §3.4** (전부 이 저장소 안에서 재현 가능)

---

> ### ✅ P8-02 완주 하네스 — **동료를 얻을 방법이 없었다** (2026-08-03)
>
> **`tools/playthrough.mjs`** 신설. `balance.mjs` 가 **묻지 않는 질문**을 묻는다.
>
> `balance.mjs` 는 스테이지마다 **독립적으로** "그 시점의 목표 파워로 이길 수 있는가"를
> 물으면서, 추천 편성에 **로스터 전체(30종)를 준다.** 신규 계정은 그것을 갖고 있지 않다 —
> 즉 **게이트 B4 는 플레이어가 가질 수 없는 편성으로 측정된 값이었다.**
>
> 이 하네스는 순서대로 묻는다: 젬이 쌓이고 → **실제 가챠 로직**(`logic/gacha.js`, 시드 고정)을
> 돌리고 → 로스터가 늘고 → **그때 가진 동료로** 다음 스테이지를 이기는가.
>
> #### 찾은 것 — 설계가 요구했는데 구현되지 않은 규칙
>
> **캠페인 진행은 동료를 전혀 주지 않았다.** `claimStageReward` 는 골드·강화석만 주고
> (노멀 첫 클리어 젬 0), 동료 획득 경로는 **FTUE 확정 2종 + 가챠 RNG + 배틀패스 무료 트랙**뿐이었다.
>
> | 일차 | 1 | 3 | 7 | 14 | 30 | 60 |
> |---|---|---|---|---|---|---|
> | 보유 동료 (수정 전) | **2종** | 3종 | 5종 | 6종 | 14종 | 21종 |
>
> 실측: 계정 시드에 따라 **1-9 에서 30일을 기다려 17종을 모아도 승률 0%** (같은 스테이지를
> 전체 로스터로 돌리면 33%). 즉 **벽이 편성 퍼즐이 아니라 뽑기 운**이었다.
>
> 그런데 `15-content-plan.md` §1.1 이 이미 요구하고 있었다:
> > **각 월드의 "요구 답안" 동료는 그 월드가 시작되기 전에 반드시 획득 가능해야 한다.**
> > … 이것이 "벽 = 편성 퍼즐" 명제를 실제로 성립시키는 조건이다.
>
> CLAUDE.md 설계 결정 5("벽은 항상 편성 퍼즐이고 절대 경제 벽이 아니다")와
> 절대 규칙 6(가챠 외 확률형 금지)이 함께 걸리는 문제다.
>
> #### 조치 — `data/unlocks.json` + `logic/unlocks.js` (세이브 v12 → v13)
>
> **지급 시점은 손으로 고르지 않고 역산했다.** `recommendedLoadoutForStage` 가 각 유닛을
> **처음 요구하는 스테이지**를 전 100 스테이지에서 측정하니 필요한 동료는 **10종**뿐이었다:
>
> | 처음 요구되는 곳 | 동료 | 지급 시점 |
> |---|---|---|
> | 1-1 | 방벽 2 · 원거리 4 | FTUE 2종 + 1-1 · 1-2 · 1-3 · 1-6 |
> | 1-5 | `novice_pyromancer` (술식 — ARMORED 의 답) | **1-4** |
> | 1-10 | `clucking_chicken` | **1-9** |
> | 3-1 | `devout_acolyte` (신성 — CORRUPT 의 답) | **2-20** (월드 3 진입 전) |
> | 3-8 | `leaf_ranger` (물리 대공 — FLYING+WARDED 의 답) | **3-7** |
>
> **★ 이 성질은 주장이 아니라 `validate-data.mjs` 가 매번 검사한다.**
> 모든 스테이지에 대해 "그 스테이지가 내는 태그의 **답**(술식/신성/대공/방벽)이
> 확정 보유에 있는가"를 대조한다. `gen:stages` 로 스테이지가 바뀌어 더 이른 곳에서
> 답이 요구되면 **빌드가 멈춘다.**
>
> ⚠ **처음에는 검사를 "추천 편성 6종 전부"로 짰다가 틀렸다.** `recommendedLoadout` 은
> 남은 칸을 일반 화력으로 **항상 6칸까지** 채우므로 1-1 조차 6종을 요구하는 것처럼 보였다.
> 실제로는 FTUE 2종으로 1-1~1-8 을 완주한다(하네스 실측). §1.1 이 요구하는 것도
> "요구 **답안** 동료"이지 편성 전체가 아니다. **검사 대상은 답의 범주다.**
>
> 소급 지급을 v13 에 넣었다 — **없으면 기존 플레이어만 영원히 못 받는다.**
> 이미 보유한 동료는 레벨·랭크·장비를 그대로 두고 건너뛴다(덮어쓰면 30레벨이 1레벨이 된다).
>
> #### 결과
>
> | 일차 | 1 | 3 | 7 | 14 | 30 | 60 |
> |---|---|---|---|---|---|---|
> | 보유 동료 (수정 후) | **10종** | 11종 | 12종 | 13종 | 19종 | 23종 |
>
> **계정 시드 3개 전부 100 스테이지 완주 · 총 15일 · 대기 0회.**
>
> #### 하네스 자체에서 잡은 오류 3건 (기록해 둔다 — 같은 형태가 반복된다)
>
> | 증상 | 원인 | 교훈 |
> |---|---|---|
> | "1-1 에서 막힌다" | 배틀패스 무료 트랙을 *보수적으로* 제외 | **보수적으로 빼는 것과 존재하는 경로를 빠뜨리는 것은 다르다** |
> | 천장이 영원히 0 | `rollBatch` 반환은 `pity` 인데 `pityAfter` 로 읽음 | **없는 필드를 `?.` 로 읽으면 조용히 틀린다** |
> | 4-19 를 벽으로 오판 | 전투 시드 6개 · 전 계정이 **같은 시드** | 6시드 17% vs 50시드 **56%**. 표본이 작으면 판정이 운이 된다 → 기본 16시드 + 계정별 오프셋 |
>
> ★ **4-19 = 56% 는 B4(≥55%) 를 1%p 차이로 통과한다** — 전 100 스테이지 중 가장 얇은 여유다.
> 스테이지·로스터·추천 규칙 중 무엇이 조금만 움직여도 넘어간다. 다음 튜닝 후보로 기록한다.
>
> `npm run playthrough` 로 실행하며 **`npm run verify` 에 포함**시켰다 —
> "혼자 끝까지 갈 수 있는가"가 게이트여야 한다.

> ### ✅ 상시 콘텐츠 3종 + 로스터 30종 이후 전수 재측정 (2026-08-03) — **하드 실패 0**
>
> 던전·탑·시험·광고·분석이 들어오고 로스터가 25 → 30종이 된 뒤의 전수 측정.
> **100 스테이지 × 편성 11 × 50 시드 = 55,000 전투 / 약 17분.**
>
> | 게이트 | 세션 시작 시 | **최종** | 비고 |
> |---|---|---|---|
> | B2 튜토리얼 ≥85% | ✔ | **✔** | 100/100/100% |
> | B3 설계된 첫 패배 30–45% | ✔ | **✔ 38%** | |
> | B4 무과금 추천 ≥55% | ✗ 5-15·5-19 | **✔ 전 구간** | '닿는 답' 수정으로 해소 |
> | B5 ARMORED 에 술식>물리 | ✔ | **✔** | |
> | B6 스팸 억제 | ✔ | **✔** | 100/100 |
> | B7 전 동료 등장 | ✔ 25/25 | **✔ 30/30** | 로스터 확장분까지 커버 |
> | B16 방벽 필수성 | ✔ | **✔** | |
> | WALL 벽 0개 | ✗ 2건 | **✔ 없음** | |
> | **하드 소계** | **2 실패** | **0 실패** | |
> | B9 전투 길이 (소프트) | ✗ 7건 | ✗ **3건** | 보스 오분류 4건 제거 · 남은 것은 1-3(47s) · 1-4(58s) · 5-16(181s) |
> | B10 ★2 45–60% (소프트) | ✗ 95.3% | ✗ **61.5%** | 구조적 하한 48% + 1.5%p — 별 조건 재설계 없이는 불가 |
> | B11 ★3 20–35% (소프트) | ✗ 47.0% | **✔ 20.8%** | `timeRatio` 0.78 → 0.58 |
> | B13 각인 픽률 (소프트) | ✗ | ✗ | 30/30 등장 · `thin_line` 0.75% (하한 0.8%) |
>
> **통과 6/12 → 9/12. 하드 실패 2 → 0.**
>
> 남은 소프트 3건은 전부 **경계에 붙어 있고 서로 무관**하다:
> B9 는 세 스테이지가 밴드를 각각 13초·2초·0.6초 벗어난다 ·
> B10 은 `arkRatio` 가 이미 최댓값이라 현재 손잡이로 못 내린다 ·
> B13 은 각인 하나의 픽률이 하한을 0.05%p 밑돈다.
> **셋 다 하드 게이트를 막지 않으며, 사용자 플레이 피드백으로 방향이 바뀔 수 있는 값들이다.**

> ### ✅ P8 전항 + P9-04/05 — 병렬 6종 → 통합 → 3렌즈 감사 → 수정 (2026-08-03)
>
> **완성이란 "만들었는데 아무도 못 쓰는 것이 0개"라는 뜻이다.** 그걸 사람이 아니라
> **검사기가** 지키게 만드는 것이 이 Phase 의 전부였다. 검사기 4종이 남았다:
>
> | 명령 | 무엇을 막는가 |
> |---|---|
> | `check:screens` | 라우트는 있는데 **가는 길이 없는 화면**. 시작점에서 BFS 로 도달 그래프를 만든다 |
> | `check:unlocks` | 해금의 **단조성**(진행할수록 잠기지 않음) · 도달성 · 선행 정합 · FTUE 정합 |
> | `check:a11y` | 접근성 스위치가 **실제로 배선됐는가** (설정에 있는데 아무도 안 읽는 값) |
> | `check:prod` | `dist/` 실측 — 개발 전용 마커 102개가 번들에 없는지 |
>
> `npm run verify` 가 전부를 순서대로 돈다:
> `lint → test → data:validate → check → economy → balance:check → playthrough → check:prod`
>
> #### 감사가 잡은 CRITICAL 3건 — 셋 다 **이번 Phase 가 만든 회귀**다
>
> | 증상 | 원인 |
> |---|---|
> | **최초 승리에서 결과 화면이 안 뜨고 1-1 이 재시작된다** | 전투 화면의 effect 의존성에 `getBattleLoadout` **구독**이 들어갔는데, 그 값이 `roster.owned` 의 함수다. 클리어 보상의 **확정 지급(P8-02)** 이 마운트된 화면의 의존성을 바꿔 effect 를 재실행 → `setResult(null)`. 확정 지급이 있는 7개 스테이지 전부 해당 |
> | **후반 스테이지를 딥링크로 한 번 이기면 던전·탑·하드·방주가 한꺼번에 열린다** | 캠페인 진행 게이트가 없었다. `recordStageClear` 가 `highestStage = max(prev, globalIndex)` 이므로 순서를 건너뛴 클리어가 그대로 최고 기록이 된다 |
> | **신규 계정이 3탭으로 +78% ATK/HP** | 장비 티어 드롭다운이 1~4단계를 무조건 열어 뒀다 |
>
> 앞의 둘은 **하네스가 볼 수 없는 결함**이다 — 밸런스 하네스는 스테이지를 순서대로
> 들어가고 화면을 거치지 않는다. 화면과 진행 규칙 사이에만 있는 구멍이었다.
>
> 조치는 전부 **같은 술어를 화면과 스토어가 함께 부르는** 모양으로 했다
> (`logic/stageUnlock.js:canEnterStage` · `progression.js:isGearTierAvailable`).
> ★ 화면에만 자물쇠를 그리면 딥링크·공유 코드·다음 호출부가 그대로 통과한다.
>
> #### 통합이 잡은 "합쳐서 틀린 것" 7건 중 특히
>
> - **P9-05 의 `React.lazy` 전환이 P8-01 의 검사기를 죽일 뻔했다.** 도달성 검사기의
>   정규식이 `element: <Name />` 만 읽어서, lazy 로 바꾸면 **라우트 0개 → "전부 도달 가능"
>   초록불**이 된다. 검사기가 아무것도 검사하지 않으면서 통과하는 것이 가장 나쁜 상태다.
> - **P8-03 이 초기값만 고쳐 기존 세이브가 구제되지 않았다.** `owned: startingOwned()` 는
>   persist 가 저장본을 통째로 얹으므로 **v13 세이브 전부에 닿지 않는다.**
>   → 세이브 **v14** 로 승격. 확정 지급을 "초기값"이 아니라 **마이그레이션이 지키는 명제**로.
> - **`BattleScreen.DEFAULT_LOADOUT` 이 시작 로스터의 세 번째 출처**였고, 획득 경로가 없는
>   동료를 담고 있었으며 슬롯을 `{id}` 로만 만들어 **레벨·랭크·장비·별 트리가 전부 무시**됐다.
>
> #### 함께 고친 것 — **만날 수 없는 적 2종** (2026-08-03)
>
> `tower.json:eliteEveryFloors` 가 **5**, 세력도 **5** 라 `gcd(5,5)=5` —
> 엘리트 층이 **영원히 `arcane` 에만** 걸렸다. goblin 의 `humongous_ettin` 과
> undead 의 `death_slime` 은 P6-06 에서 캠페인 배치를 내렸으므로(페이즈 시퀀스 중복)
> **탑 엘리트가 유일한 등장처**인데 그 길이 막혀 있었다 —
> 정의·아트·도감 항목이 전부 있는 채로 **도달 불가능한 콘텐츠**였고 도감 최대치가 126/128 이었다.
>
> **6 으로 고쳤다** (`lcm(6,5)=30` → 30층 주기로 5세력 순환).
> 성질은 두 곳이 지킨다: `validate-data` 가 **서로소 여부**를 검사하고,
> `inventoryAudit.test.js` 가 "거대화 적 중 만날 수 없는 것 0종"을 고정한다.
> ★ 테스트에 박혀 있던 주기 `5` 도 데이터에서 읽도록 바꿨다 — 값을 테스트에 적으면
> 데이터를 고칠 때 테스트가 같이 깨지고, 그러면 **테스트를 고쳐서 통과시키고 싶어진다.**
>
> #### 실측
>
> lint 0 · 테스트 **1,343**(51파일) · `data:validate` 경고 1 · `check:screens/unlocks/a11y/prod` 전부 통과 ·
> `vite build` 성공. `"/"` 진입 전송량 **약 580KB gzip**
> (라우트 전부 `React.lazy` + `manualChunks` 로 phaser/react 분리).
>
> ⚠ **남은 경고 1건은 의도된 것이다** — `commander_choose` 트리거를 쏘는 코드가 없다
> (지휘관 선택 화면 미구현). `logic/ftue.js:PENDING_TRIGGER_KINDS` 에 등록되어 매 빌드
> 경고하며, **화면이 붙으면 그 목록에서 지운다. 비어 있는 것이 정상 상태다.**

> ### ✅ 지휘관 주문 시스템 — **균열력의 소비처가 생겼다** (2026-08-03)
>
> `riftEnergy` 는 P2 부터 시뮬에 있었지만 **아무도 쓰지 않았다.** 재생(2/초)과
> 처치 보너스(+0.5)로 쌓이기만 하고 저장소 전체에 차감하는 코드가 하나도 없어,
> 전투 내내 100 에서 포화된 채 서 있었다. HUD 의 주문 버튼 4개는 `disabled` 하드코딩이었고,
> FTUE 는 첫 전투 0:30 에 **그 누를 수 없는 버튼을 손가락으로 가리키고** 있었다.
> P8-06 에서 죽은 UI 로 제거하며 "되살릴 때 넷을 같이 만든다"고 남겨 둔 것을 이번에 마쳤다.
>
> | 층 | 산출물 |
> |---|---|
> | 규칙 | `logic/spells.js` — `canCast` · `castSpell` · `stepSpellBuffs` · `pickAutoSpell` |
> | 데이터 | `data/spells.json` — 주문 4종 (11-core-loop.md §4.4 그대로) |
> | 시뮬 | `sim.js` 서브스텝 추가 · `state.js` 에 `spells` · 엔티티 `buff` 필드 |
> | 화면 | `BattleHud` 의 `RiftBar` + `SpellRow` · `BattleScene` 의 `CAST_SPELL` 처리 |
> | 튜토리얼 | `ftue.json:commander_spell` 복귀 · 가이드 탭 **11 → 12** · 계측 `ftue_first_spell` |
>
> **주문 4종.** 문서의 6종 중 4종만 넣었다 — '시간 정지'(전역 시간 배율)와
> '소집'(위치 순간이동)은 **새 시뮬 개념**을 요구하고 결정론·정렬 배열 불변식을 건드린다.
> 나머지 4종은 기존 개념(피해 · 회복 · 스탯 버프)만으로 표현된다.
>
> #### 설계에서 지킨 것
>
> - **발동은 `step()` 안에서만.** 화면은 의도를 큐에 넣고 `applyInputs` 가 틱 안에서
>   `castSpell` 을 부른다. EventBus 핸들러에서 직접 부르면 그 이벤트를 다음 틱의
>   `resetQueue` 가 지운다 — **소환에서 이미 겪은 사고**다(P3 "소환한 아군의 스프라이트가 안 생김").
> - **버프는 만료 시각과 증분을 함께 기록**한다. 증분을 기억하지 않고 만료 때 상수를 빼면,
>   같은 버프가 두 번 걸렸다 한 번만 만료되는 순간 **스탯이 영구히 올라간다.**
>   엔티티 풀 재사용 시 `buff` 를 초기화하지 않으면 죽은 유닛의 버프가 다음 유닛에게 남는다 —
>   둘 다 테스트로 고정했다.
> - **지휘관이 기절 중이면 주문도 잠긴다.** 판정은 `aura.js` 와 **같은 명제**를 쓴다
>   (`s.t >= downUntil`). 별도 플래그를 만들면 오라와 주문이 다른 기절 판정을 갖게 된다.
> - **아이콘은 기존 것을 빌려 쓴다** — 낙뢰=`dmg.arcane` · 정화=`dmg.holy` ·
>   치유=`tag.REGEN` · 강철=`tag.ARMORED`. 아이콘 시트는 인덱스를 눈으로 확인하지 않으면
>   틀린 것을 알 수 없어서, **추측한 새 인덱스보다 의미가 맞는 기존 키가 낫다.**
>
> #### ★★ 자동 플레이도 주문을 쓴다
>
> **이것이 이 티켓에서 가장 중요한 결정이다.** 자동 플레이가 주문을 안 쓰면
> 밸런스 하네스는 **'주문 없는 게임'** 을 재고 플레이어는 주문 있는 게임을 한다.
> 이 저장소는 정확히 그 형태의 괴리를 이미 겪었다 — 추천 편성에 로스터 전체를 주고
> B4 를 쟀고, 신규 계정은 그 편성을 가질 수 없었다(P8-02).
>
> 그 대가는 즉시 나타났다 — **1-9 승률 40% → 55%** (게이트 B3 이탈).
> 다른 스테이지는 이미 천장이라 영향이 없었다.
>
> **1-9 `difficultyMult` 3.75 → 3.85 로 재보정했다.** 주문 수치가 아니라 스테이지를
> 고친 이유: 균열력 경제(2/초 · +0.5/처치 · 최대 100)는 `11-core-loop.md §2.2` 의 값
> 그대로이고, 150초 전투에서 12회 발동은 그 예산이 **설계대로** 허용하는 양이다.
> 즉 주문은 사양에 맞고, 설계된 첫 패배가 새 수단만큼 다시 조여져야 하는 것이다.
>
> | difficultyMult | 3.80 | **3.85** | 3.90 | 3.95 |
> |---|---|---|---|---|
> | 승률 (150시드) | 42.0% | **38.7%** | 35.3% | 30.0% |
>
> 밴드(30–45%) 중앙이고 양옆이 모두 밴드 안이라 시드 노이즈에 양방향 여유가 있다.
> `stages.gen.test.js` 가 이 값을 못 박으며, **주석에 "무엇이 바뀌면 다시 재야 하는가"**
> 를 적었다 — 지금까지 두 번(방벽 2기 · 주문 도입) 그 이유로 움직였다.
>
> #### 게이트 B6 이 깨졌고, **게임이 아니라 게이트가 틀렸다**
>
> 주문 도입 후 B6(스팸 억제)이 **4-13** 에서 실패했다. 원인을 두 단계로 좁혔다.
>
> **① 자동 플레이 정책의 결함 (진짜 결함, 고쳤다).**
> `pickAutoSpell` 이 회복 다음 · 공격보다 **앞**에서 `steel_command`(DEF 버프)를 집었다.
> `balanced` 는 오라 안 아군이 많아 그 조건에 걸려 버프를 썼고, `spam_cheapest` 는
> 조건에 못 미쳐 공격 주문으로 떨어졌다 — 그런데 그 판에서는 **공격이 더 셌다.**
> 즉 정책이 **다양화 편성에만 손해 보는 선택**을 시켰고, 하네스는 그것을
> "스팸이 더 낫다"로 보고했다. 버프를 맨 뒤로 옮겼다.
> ★ **자동 플레이는 밸런스 측정의 일부다.** 정책이 특정 편성에만 나쁜 선택을 하면
> 그 편차가 게이트 수치로 나타나고, 멀쩡한 게임을 고치게 만든다.
>
> **② 남은 실패는 게이트의 전제가 틀린 것이었다.**
> 정책을 고쳐도 4-13 은 스팸 우세였다. 그런데 **주문 없이 재면 두 편성은 94.7% 로
> 완전히 동률**이었다 — 원래 경계값이었고 주문이 그 동률을 깼을 뿐이다.
>
> 4-13 의 태그는 `LIVING · WARDED · SHIELDED · REGEN` 으로 **ARMORED·CORRUPT 가 없다.**
> `WARDED` 는 **물리가 답**이고, `spam_cheapest`(물리 2종)는 그 스테이지의 **정답 편성**이며
> `balanced` 는 술식·신성 2기를 들고 있어 그 둘이 RES 에 깎인다.
> **스팸이 이기는 것이 상성 시스템이 옳게 작동한 결과**다.
>
> 게다가 4-13 은 **버티기(endure)** 다. B6 이 검증하려는 억제 장치는
> **소환 코스트 상승**(1.18배)인데, 버티기는 개막 6기 전개 후 소환을 잠근다 —
> **반복이 없으므로 억제할 대상 자체가 없다.**
>
> → **B6 에서 버티기 스테이지를 제외**했다. 제외 수는 메시지에 함께 출력한다
> (조용한 제외는 "전부 검사했다"로 읽힌다).
>
> ★ 이번 세션에서 **게이트가 틀린 것으로 판명된 세 번째** 사례다:
> B9 의 보스 오분류(`-20` 을 일반으로 셈) · B4 가 신규 계정이 못 가질 편성으로 측정 ·
> B6 의 버티기 전제. **하드 게이트가 깨지면 게임을 고치기 전에 게이트가 무엇을
> 재고 있는지부터 확인해야 한다.**
>
> **검증:** lint 0 · 테스트 **1,363**(52파일 · 주문 20건 신규) · `data:validate` 경고 1 ·
> `check` 전항 통과 · `vite build` 성공.

---

## P9 — 마감 품질 (실기기)

| ID | 크기 | 작업 |
|---|---|---|
| P9-01 | M | 실기기 계측 — 콜드 스타트 · FPS · 메모리 |
| P9-02 | M | 강제 종료 후 세이브 유지 · 백그라운드 5분 복귀 (오디오 재개 포함) |
| P9-03 | M | 씬 전환 스트레스 — 연속 30전투 후 힙 증가 없음 |
| P9-04 | M | 접근성 — 셰이크 강도 · 데미지 숫자 밀도 · 색약 대응 |
| P9-05 | M | 번들 · 코드 스플리팅 (현재 gzip 599KB / 예산 1.5MB) |

**P9 게이트 = `32-definition-of-done.md` §3.5**

---

## P11 — 나이트메어 난이도 (2026-08-05) ✅

**설계·근거·실측은 전부 [`02-design/22-nightmare.md`](../02-design/22-nightmare.md) 에 있다.**
여기에는 티켓 상태만 둔다 — 두 곳에 적으면 갈라진다.

| ID | 크기 | 작업 | 상태 |
|---|---|---|---|
| P11-01 | M | 규칙 데이터 · 조회 모듈 (`logic/nightmare.js`) · 검사 N1–N6 | ✅ |
| P11-02 | S | ③ 고갈 (`stageConfig` 에서 두 손잡이) | ✅ |
| P11-03 | M | ★ 성능 실측 · 엔티티 상한 (풀 256 → **288**) | ✅ |
| P11-04 | L | ② 결박 파열 (`movement.js:stepBlocking`) | ✅ |
| P11-05 | L | ① 역병 장판 (존 12슬롯 · 엔티티 증가 0) | ✅ |
| P11-06 | M | 렌더 — `presenters/PlagueZones.js` · 파열 연출 · 배선 검사 W6 | ✅ |
| P11-07 | M | 화면 — 프리뷰 규칙 배지 · 출격 난이도 카드 배지 · 가이드 **23 주제** | ✅ (2026-08-05 · 화면으로 확인) |
| P11-08 | M | 해금 — 하드 ★3 → **★2** 전관 | ✅ |
| P11-09 | L | 밸런스 게이트 **BN1–BN8** (`tools/lib/nightmare-gates.mjs`) | ✅ |
| P11-10 | S | `implemented: true` | ✅ |

**게이트 결과 6/8** — `BN3`(하드) · `BN5`(소프트) 실패. 둘 다 나이트메어가 만든
문제가 아니라 **배율 × 성장 곡선**이 드러난 것이고, 사용자 결정이 필요하다:

- **월드 5 후반(5-12 · 5-19 · 5-20)이 나이트메어로 통과 불가능하다** — 규칙을 전부 꺼도
  승률 0%. 5-19 는 하드에서도 38% 다.
- **월드 1–3 은 만렙 계정에게 규칙과 무관하게 통과된다** — 지배 전략 편성조차 100%.

> 자세한 실측과 선택지는 `22-nightmare.md` §0-A.1.

---

## ~~P10 — 소셜 & 라이브옵스 & 글로벌~~ → **연기** (2026-08-03)

**삭제가 아니라 연기다.** 재개할 때 이 목록에서 시작한다.

| 항목 | 재개 조건 |
|---|---|
| 월드 6–10 (100 스테이지) + 적 · 보스 | 사용자가 월드 1–5 를 실제로 플레이한 뒤 |
| 동료 40종까지 | 〃 |
| **비동기 PvP** · 리더보드 · 정규화 리그 · 길드 | **서버 없음 결정(2026-08-03)** 하에서 성립하는지 설계 재검토가 먼저다 |
| 원격 설정 · 이벤트 템플릿 · A/B 훅 · 운영 툴 | 운영 주체 |
| 실 광고 · 실 분석 · 실 결제 SDK | 각 벤더 계정. **어댑터 경계는 P7-10 · P7-16 에서 완성된다** |
| 영어 현지화 · 원스토어 · 스토어 자산 | 출시 결정 |
| 소프트런칭 · D1/D7/D30 판정 · UA | 실제 배포와 플레이어 |

> ⚠ **확률 공개 컴플라이언스는 연기 대상이 아니다** — 이미 구현되어 있다 (P7-05 · P7-06).
> 배포 시점에 적용되고 입증책임이 사업자에게 있어, 나중에 붙이면 늦는 유일한 항목이다.

---

## 2. 지금 당장 할 것

```
P8-01  전 화면 도달 경로 검사
P8-02  신규 계정 → 마지막 스테이지 자동 완주 하네스
P7-03  1-9 패배의 質 — 중간 회복 지점 (신규 시뮬 규칙)
```

**P8-02 가 이 단계의 핵심이다.** "혼자 끝까지 갈 수 있는가"를 사람이 아니라
하네스가 답하게 만드는 것이고, 그것이 이번 방침 전환의 전부다.

---

## 3. 진행 추적

| Phase | 티켓 | 완료 | 상태 |
|---|---|---|---|
| **P0** | 11 | **10** | 🟡 **P0-10(타이틀 검증)만 남음** — 2026-08-02 |
| **P1** | 12 | **12** | ✅ **완료** — 2026-08-02 |
| **P2** | 14 | **14** | ✅ **완료** — 2026-08-02 |
| **P3** | 15 | **14** | 🟡 **구현 완료 · 외부 플레이테스트 대기** — 2026-08-02 |
| **P4** | 12 | **12** | ✅ **완료** — 2026-08-02 (B10 소프트 1건은 P6 콘텐츠 확장 후 재측정) |
| **P5** | 13 | **13** | ✅ **완료** — 2026-08-02 |
| **P6** | 14 | **14** | ✅ **완료** (2026-08-03) — P6-01 · P6-02 · P6-03 · P6-05 · P6-06 · P6-07 · P6-08 · P6-09 · P6-10 · P6-11 완료.<br>**밸런스 하드 게이트 100 스테이지 전수 통과** · 상시 콘텐츠 3종 · 동료 30종 (소프트런칭 목표 도달) |
| **P7** | 16 | **15** | 🟡 **P7-03 만 남음** — P7-01 · P7-02 · P7-04 · P7-05 · P7-06 · P7-07 · P7-08 · P7-09 · P7-11 · P7-12 · P7-13 · P7-10 · P7-14 · P7-15 · P7-16 완료.<br>남은 것: **P7-03**(1-9 패배의 質 — 중간 회복 지점이라는 신규 시뮬 규칙 필요) (2026-08-03) |
| **P8** | 6 | **6** | ✅ **완료** (2026-08-03) — 전 화면 도달 · 완주 하네스 · 해금 전수 · 수량 정합 · 세이브 내구성 · 디버그 잔재.<br>검사기 4종(check:screens/unlocks/a11y/prod)이 결과를 지킨다 |
| **P9** | 5 | **2** | 🟡 P9-04 접근성 · P9-05 번들(라우트 lazy + manualChunks, "/" 진입 약 580KB) 완료.<br>남은 것: P9-01~03 **실기기 필요** (콜드 스타트 · 세이브 유지 · 씬 전환 스트레스) |
| **P11** | 10 | **10** | ✅ **완료** (2026-08-05) — 나이트메어 규칙 3종 · 게이트 BN1–BN8 · 엔티티 풀 재산정.<br>JSX 배선까지 완료(프리뷰 규칙 블록 · 출격 난이도 카드 배지 — 실제 화면으로 확인).<br>남은 것: **사용자 결정 2건**(`22-nightmare.md` §0-A.1) |
| ~~P10~~ | — | — | **연기** — 소셜 · 라이브옵스 · 글로벌 (사용자 플레이 이후) |

이 표를 티켓 완료 시마다 갱신한다.

---

## 4. 이 계획을 지키는 규칙

1. **Phase 를 건너뛰지 않는다.** P3 게이트를 통과하지 못한 채 P6 콘텐츠를 만들지 않는다.
2. **티켓을 쪼갠다.** XL 이 나오면 L 이하로 분할한 뒤 착수한다.
3. **DoD 를 눈으로 확인한다.** "될 것이다"로 넘어가지 않는다.
4. **범위가 늘어나면 `10-GDD.md` §11 "만들지 않는 것"을 먼저 확인한다.**
5. **일정이 밀리면 `30-roadmap.md` §범위 축소 우선순위를 따른다.**
   자르지 않는 것: 각인 드래프트 · 오라 시스템 · 밸런스 하네스 · FTUE 정밀 구현 · 확률 공개 컴플라이언스.

---

> ### 통합 감사 — 6개 에이전트 2차 병렬 작업 이후 (2026-08-03)
>
> 티켓 6개(P6-04 로스터 30종 · P6-12 자원 던전 · P6-13 기억의 탑 · P6-14 돌파 시험 ·
> P7-10 리워드 광고 · P7-16 계측 전송)를 **병렬로** 구현한 뒤 합쳤다.
> 1차 감사(위 노트)에서 배운 대로, 합친 결과를 **따로** 감사했다.
>
> #### 합쳐서 틀렸던 것 — critical 3건
>
> **① 기억의 탑이 캠페인 보상 경로를 타면 `meta.highestStage` 가 NaN 이 된다.**
> `claimStageReward("tower-12", …)` → `recordStageClear` → `"tower-12".split("-").map(Number)`
> = `[NaN, 12]` → `(NaN-1)*20+12 = NaN` → `Math.max(highestStage, NaN) = NaN`.
> **그 순간 방주 시설·난이도·던전·탑·상점 해금이 전부 무너지고 세이브에 그대로 기록된다.**
> `stageStars["tower-12"]` 로 별 합계도 오염된다.
> 각 티켓은 옳았다 — P6-13 은 stageId 표기를 정했고, metaSlice 는 캠페인 id 만 가정했다.
> **조치:** `BattleScreen` 이 `isTowerStageId()` 로 분기해 `finishTowerRun()` 만 부른다.
> 배경 월드 번호도 같은 함정이었다(`Number("tower")` → `w NaN-far.png`) —
> `BattleScene.battleWorldId()` 가 층의 세력에서 월드를 구한다.
>
> **② 광고 원장이 두 벌이었고, 둘의 자정이 9시간 달랐다.**
> `metaSlice.claimIdle` 은 `meta.idleAdClaims` 에 **UTC 자정**(`Math.floor(now/DAY_MS)`)으로
> 방치 2배 횟수를 셌고, 출석·임무·상점·던전·광고는 전부 **KST 자정**(`daily.js:dayIndex`)이다.
> 방치 광고 횟수만 다른 날짜에 리셋됐다. 게다가 `claimIdle` 의 배율이 `? 2 : 1` 하드코딩이라
> `ads.json` 이 말하는 배율과 갈라질 수 있었다.
> **더 나쁜 것:** ArkScreen 의 "광고 2배" 버튼은 **광고를 한 번도 재생하지 않고** 2배를 줬다.
> SDK 를 붙이지 않은 채 출시했다면 모든 사용자가 광고 없이 무한 2배를 받는다.
> **조치:** 원장을 `ads.counts` 하나로 합쳤다(v12 마이그레이션이 `meta.idleAdClaims` 를 지운다).
> 배율은 `multiplierOf("idle_double")`. 지급 경로는 `adsSlice.watchAd` 하나이고,
> `ads.json:sdk.implemented` 가 false 인 동안 fail-closed 로 닫힌다.
>
> **③ 돌파 시험의 지급 목록 모양이 다른데 아무도 터지지 않는다.**
> `trials.js:claimSegment` 의 grants 는 `{id, amount}` 이고 **`kind` 가 없다.**
> 다른 티켓의 관례대로 `applyGrants` 에 넘기면 `g.kind === "currency"` 검사에 걸려
> **한 푼도 들어오지 않는다** — 예외도 경고도 없이 "정산했는데 골드가 그대로"가 된다.
> **조치:** `trialsSlice` 가 `addCurrencies` 를 직접 부르고, `contentSlices.test.js` 가
> 정산액이 실제 잔액에 반영되는지 단언한다.
>
> #### 그 밖에 합치면서 잡은 것
>
> - **`partialize` 누락 위험** — 최상위 세이브 키 4개가 한꺼번에 늘었다. 하나만 빠져도
>   증상이 없고 앱 재시작마다 한도가 되살아난다(무한 던전·무한 탑 보상·재정산·무한 광고).
>   `saveVersion.test.js` 가 **소스를 읽어** 키 ↔ partialize ↔ onRehydrate 정규화를 대조한다.
> - **SAVE_VERSION 은 11 → 12 한 번만 올렸다.** 네 티켓이 각자 올리면 `from` 이 중간값인
>   세이브가 일부 블록만 만난다. 해금은 전부 `meta.highestStage` 의 함수이므로
>   마이그레이션이 진행도를 거꾸로 잠그지 않는다 — 그 성질을 테스트로 못 박았다.
> - **광고 SDK 플래그가 두 곳**(`dungeons.json:ads.implemented` · `ads.json:sdk.implemented`)
>   이다. 한쪽만 켜면 버튼은 열리는데 입장권이 안 늘거나 그 반대가 된다.
>   `validate-data` 가 두 값이 다르면 빌드를 막는다.
> - **`trials.json` 문구의 `★` 글리프** — 절대규칙 5 위반. "별 N개"로 바꿨다.
> - **`gacha.json:tableVersion` 1.0.0 → 1.1.0** — 로스터 25 → 30 으로 동료 1종 단위
>   공개 확률이 바뀌었다. 올리지 않으면 확장 전 감사 로그가 '재현 실패'로 보인다.
> - **탭바를 늘리지 않았다.** 이미 9칸이고 셋을 더하면 12칸이라 44px 터치 타깃이 무너진다.
>   셋 다 초반에는 잠겨 있다 — 진입은 **출격 화면의 특수 콘텐츠 카드**다.
>
> #### 남은 것
>
> - **탑의 진입 드래프트**(`cfg.tower.entryDrafts`, 고립의 주간)는 전투 시작 **전에**
>   드래프트 UI 를 띄워야 해서 배선하지 않았다. 층 간 각인 이월은 배선했다
>   (`carrySigils` → `applySigil`).
> - **광고 계측 이벤트**(`ad_start`/`ad_complete`)가 `analytics.json` 카탈로그에 없다.
>   추가할 때 `placementId`·`outcome`·`providerId` 를 함께 남길 것.
> - **`tools/lib/f2p-power.mjs:availableGold()` 가 던전 수입을 세지 않는다.** 더하면
>   방치 비중이 43% → 약 45% 가 되어 게이트(30–55%) 안에 남는다. 경제 담당 결정.
> - 밸런스 하네스는 이 통합에서 돌리지 않았다 (지시).
