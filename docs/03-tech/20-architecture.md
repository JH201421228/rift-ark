# 20. 기술 아키텍처

> 스택: React 19 · Vite 7 · Zustand 5 · Phaser 3.90 · Capacitor 7 · Tiled
> 프로젝트: `C:\Users\741u7\Desktop\clear\PJT20260801\FE` (appId `com.superdimension.app`)

---

## 1. 현재 상태 감사 (2026-08-01)

| 파일 | 상태 | 조치 |
|---|---|---|
| `package.json` | Phaser 3.90 · React 19.2 · Zustand 5.0.11 · Vite 7.3.1 · Capacitor 7 · React Query · react-router-dom 7 · axios · firebase 설치됨 | 기반 OK. **Capacitor 플러그인이 하나도 없다.** 테스트 러너 없음 |
| `src/game/config.js` | ~~`width:375, height:667` **세로**, `scale.mode: RESIZE`~~ → ✅ **가로 1280×720 + `FIT` 으로 교체 완료 (P0-03)** | `AUDIENCE_LAYOUT` 폐기, `LANES`/`SPRITE_SCALE` 추가 |
| `src/game/GameManager.js` | 싱글톤 구조는 양호하나 **존재하지 않는 `./scenes/AudienceRoomScene.js` 를 import** | **현재 빌드 불가.** 씬 구조 재작성 |
| `src/App.jsx` | Vite 기본 템플릿 (로고 + 카운터) | **Phaser가 어디에도 마운트되지 않음.** `PhaserGame` 컴포넌트 신규 |
| `src/main.jsx` | `createRoot` → QueryClientProvider → RouterProvider(`createHashRouter`) | `createHashRouter` 는 Capacitor에 올바른 선택. `<StrictMode>` 추가 권장 |
| `capacitor.config.json` | `bundledWebRuntime` (Capacitor 3 잔재) | 제거 + `android`/`ios`/`plugins` 블록 추가 |
| `vite.config.js` | `base:"./"`, `@`→`src` | 올바름. `base:"./"` 는 Capacitor 필수 |
| `index.html` | 기본 viewport | `viewport-fit=cover`, `user-scalable=no` 등 추가 |
| `AndroidManifest.xml` | `configChanges` 에 orientation 포함, `launchMode singleTask` | **`android:screenOrientation` 없음** → 추가 |
| `asset/` (7,845) | `public/`·`src/` 밖 → **Vite가 서빙 불가** | **최대 병목.** 아틀라스 파이프라인 구축 (`23`) |

**즉시 블로커 4개:** 씬 부재 · 세로 설정 · 에셋 미서빙 · Capacitor 플러그인 0개.

---

## 2. 아키텍처 개요

```
┌──────────────────────────────────────────────────────────────┐
│                          React 19                            │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────────────┐  │
│  │  Router    │  │  UI Overlay  │  │   Screens (DOM)     │  │
│  │ (Hash)     │  │  (HUD)       │  │  방주·편성·상점·설정 │  │
│  └────────────┘  └──────┬───────┘  └──────────┬──────────┘  │
└─────────────────────────┼──────────────────────┼─────────────┘
                          │  useGameStore(selector)
                          ▼                      ▼
┌──────────────────────────────────────────────────────────────┐
│                    Zustand 단일 스토어                        │
│   runSlice · rosterSlice · metaSlice · uiSlice · settingsSlice│
│   + subscribeWithSelector + persist(@capacitor/preferences)  │
└─────────────────────────┬────────────────────────────────────┘
              gameStore.get() / .set() / .subscribe()
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                        Phaser 3.90                           │
│  Boot → Preload → Ark ──┬─→ Battle ─── Debug(병렬)           │
│                         └─→ (돌아옴)                          │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  BattleScene = 렌더러                                  │  │
│  │   · UnitPresenter (트윈/이펙트/틴트)                    │  │
│  │   · ProjectilePool · EffectPool · DamageTextPool        │  │
│  │   · ParallaxLayers · CameraFx                           │  │
│  └───────────────────────┬────────────────────────────────┘  │
└──────────────────────────┼───────────────────────────────────┘
                           │ 읽기 전용
                           ▼
┌──────────────────────────────────────────────────────────────┐
│           src/game/logic/  —  순수 시뮬레이션                 │
│   Phaser import 0 · DOM 0 · Math.random() 0                  │
│   고정 30Hz 틱 · 시드 PRNG(mulberry32) · 결정론적            │
│   → Vitest 단위 테스트 · 헤드리스 밸런스 하네스 · 리플레이     │
└──────────────────────────────────────────────────────────────┘
```

### 2.1 이 아키텍처의 핵심 결정 3가지

1. **시뮬레이션이 Phaser를 모른다.** 전투 수학 전체가 `src/game/logic/` 의 순수 함수다.
   → 결정론 · 밸런스 자동검증 · 리플레이 · 백그라운드 복귀 안전성이 **전부 이 하나에서 나온다.**
2. **Phaser는 렌더러일 뿐이다.** 시뮬 상태를 읽어 스프라이트를 움직인다. 게임 규칙을 갖지 않는다.
3. **Zustand는 경계 상태만 담는다.** 초당 10회 넘게 변하는 값은 절대 넣지 않는다 (`21`).

---

## 3. 폴더 구조

```
FE/
├─ asset/                      # 원본 (빌드 산출물 아님, 패킹 입력)
├─ public/
│  ├─ assets/
│  │  ├─ atlas/                # 패킹 산출물 (gitignore)
│  │  ├─ tilemaps/             # Tiled JSON
│  │  ├─ audio/                # 인코딩된 ogg/m4a
│  │  └─ data/                 # 런타임 로드 JSON (원격설정 대상)
│  └─ vite.svg
├─ tools/
│  ├─ pack-atlases.mjs         # 아틀라스 패킹
│  ├─ encode-audio.mjs         # mp3 → ogg/m4a
│  └─ balance.mjs              # 헤드리스 밸런스 하네스
├─ src/
│  ├─ main.jsx
│  ├─ App.jsx                  # 레이아웃 셸 (캔버스 + 오버레이)
│  ├─ router/
│  ├─ components/
│  │  ├─ PhaserGame.jsx        # 캔버스 마운트
│  │  └─ ui/                   # 공용 UI 컴포넌트
│  ├─ screens/                 # 화면 단위 (방주/편성/상점/설정/결과)
│  ├─ hud/                     # 전투 HUD (React 오버레이)
│  ├─ store/
│  │  ├─ index.js              # useGameStore + gameStore
│  │  └─ slices/
│  │     ├─ runSlice.js
│  │     ├─ rosterSlice.js
│  │     ├─ metaSlice.js
│  │     ├─ uiSlice.js
│  │     └─ settingsSlice.js
│  ├─ game/
│  │  ├─ config.js             # Phaser 설정
│  │  ├─ device.js             # 저사양 판정 (렌더러 + 품질 티어의 단일 출처)
│  │  ├─ GameManager.js        # 싱글톤 수명주기
│  │  ├─ EventBus.js
│  │  ├─ scenes/
│  │  │  ├─ BootScene.js
│  │  │  ├─ PreloadScene.js
│  │  │  ├─ BattleScene.js
│  │  │  ├─ ArkScene.js
│  │  │  └─ DebugScene.js      # 개발만 · 동적 import (§6 참조)
│  │  ├─ presenters/
│  │  │  ├─ UnitPresenter.js   # 4프레임 제약 상쇄 연출
│  │  │  ├─ BossPresenter.js
│  │  │  └─ ParallaxLayers.js
│  │  ├─ pools/
│  │  │  ├─ ProjectilePool.js
│  │  │  ├─ EffectPool.js
│  │  │  └─ DamageTextPool.js
│  │  ├─ fx/
│  │  │  ├─ CameraFx.js        # 셰이크·줌·히트스톱
│  │  │  └─ ColorGrade.js      # 월드별 색보정
│  │  ├─ logic/                # ★ Phaser 의존 0
│  │  │  ├─ sim.js             # 고정 틱 스텝
│  │  │  ├─ combat.js          # 데미지 공식
│  │  │  ├─ spawn.js           # 웨이브 생성
│  │  │  ├─ aura.js            # 오라 판정
│  │  │  ├─ sigils.js          # 각인 효과 적용
│  │  │  ├─ rng.js             # mulberry32
│  │  │  └─ *.test.js
│  │  └─ data/                 # 밸런스 JSON (SSOT)
│  │     ├─ units.json
│  │     ├─ enemies.json
│  │     ├─ stages.json
│  │     ├─ sigils.json
│  │     ├─ bosses.json
│  │     └─ balance.json
│  ├─ native/
│  │  ├─ bootstrap.js          # 가로 고정, 상태바
│  │  ├─ lifecycle.js          # pause/resume/backButton
│  │  └─ storage.js            # Capacitor Preferences 어댑터
│  ├─ i18n/
│  └─ utils/
├─ capacitor.config.json
├─ vite.config.js
└─ index.html
```

---

## 4. React ↔ Phaser 통합

### 4.1 마운트 컴포넌트

```jsx
// src/components/PhaserGame.jsx
import { useLayoutEffect, useRef } from 'react';
import { gameManager } from '@/game/GameManager';

export function PhaserGame() {
  const containerRef = useRef(null);

  // useEffect가 아니라 useLayoutEffect:
  // Phaser가 크기를 조회하기 전에 div가 DOM에 있어야 한다. 아니면 Scale Manager가 0x0을 읽는다.
  useLayoutEffect(() => {
    gameManager.init(containerRef.current);
    return () => gameManager.destroy();
  }, []);

  return (
    <div
      ref={containerRef}
      id="game-container"
      style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}
    />
  );
}
```

### 4.2 StrictMode 대응

React 19 StrictMode는 개발 모드에서 mount → unmount → remount 하므로 이펙트 본문이 2번 실행된다. Phaser에서는 **캔버스 2개, 입력 핸들러 중복, 오디오 중복, 유령 RAF 루프**로 나타난다.

**대응:**
- `gameManager.init()` 이 재진입 시 기존 인스턴스를 파괴하고 재생성 (이미 그렇게 되어 있음)
- 클린업에서 `game.destroy(true)` — 캔버스까지 제거
- **Vite HMR 가드 추가** (HMR은 언마운트 없이 모듈을 재실행한다):

```js
// src/game/GameManager.js 하단
if (import.meta.hot) {
  import.meta.hot.dispose(() => gameManager.destroy());
}
```

> **StrictMode는 개발에서 켜 둔다.** Phaser 인스턴스 누수·트윈 누수·리스너 누수를 잡는 가장 싼 탐지기다. StrictMode에서 깨지는 것은 결국 Capacitor `resume` 에서도 깨진다.

### 4.3 EventBus

Zustand로 표현하기 부적절한 **일회성 이벤트**(연출 트리거, 씬 준비 완료)에만 사용한다.

```js
// src/game/EventBus.js
import Phaser from 'phaser';
export const EventBus = new Phaser.Events.EventEmitter();
```

| 이벤트 | 방향 | 용도 |
|---|---|---|
| `scene-ready` | Phaser → React | 씬 준비 완료 |
| `battle-ended` | Phaser → React | 결과 화면 전환 |
| `sigil-draft-open` | Phaser → React | 각인 선택 모달 |
| `request-summon` | React → Phaser | HUD 슬롯 탭 |
| `cast-spell` | React → Phaser | 주문 발동 |

**규칙: 지속 상태는 Zustand, 순간 이벤트는 EventBus.** 둘을 섞지 않는다.

> **지휘관 이동은 이 채널을 타지 않는다** (2026-08-05). 전장 탭·드래그는 캔버스가 직접 받는다
> (`scenes/BattleScene.js:setupInput` → `moveCommanderTo`) — 대상 좌표가 씬의 월드 좌표라
> DOM 이 다시 계산하면 줌·뷰포트마다 어긋난다. `request-commander-move` 는 emit 0 · on 0 인 채로
> 남아 있었고 지웠다. **EVT 에 적힌 이름은 emit 하는 곳과 on 하는 곳이 둘 다 있어야 한다** —
> `tools/validate-data.mjs` 의 '선언 ↔ 소비 대조' 절이 전수 검사한다.

### 4.4 React vs Phaser 담당 구분

| 담당 | 대상 | 이유 |
|---|---|---|
| **React DOM** | 타이틀·방주·출격·편성·동료·설정·결과·전투 HUD | 텍스트 렌더링·스크롤·i18n·접근성이 압도적으로 저렴 |
| **Phaser** | 데미지 숫자·유닛 HP 바·히트 플래시·오라 링·조준 표시·모든 월드 앵커 요소 | 60Hz로 갱신되고 카메라 변환을 따라야 한다. DOM으로 하면 프레임마다 레이아웃 스래싱 |

**레이아웃**
```css
#game-container { position: absolute; inset: 0; }
#ui-overlay     { position: absolute; inset: 0; pointer-events: none; z-index: 10; }
#ui-overlay .interactive { pointer-events: auto; }
```
`pointer-events: none` 이 없으면 오버레이가 Phaser로 가야 할 모든 터치를 먹는다.

---

## 5. Phaser 설정 (✅ P0-03 적용 완료)

실제 구현은 `src/game/config.js`. 아래는 요약이다.

```js
export const DESIGN = { width: 1280, height: 720 };
export const SAFE   = { width: 1136, height: 720 };   // UI 안전 영역

export const LANES = {
  air:    { y: 224 },
  ground: [{ y: 320 }, { y: 416 }, { y: 512 }],
  arkX:   96,
  riftX:  1184,
  hud:    { topH: 80, bottomH: 160 },
};

// 소형·대형 유닛이 모두 ×4 → 픽셀 밀도 완전 동일 (1 소스px = 4 디자인px)
export const SPRITE_SCALE = {
  unitSmall: 4, unitLarge: 4, commander: 2,
  effect: 2, projectile: 4, bossDefault: 4,
};

export const GAME_CONFIG = {
  type: Phaser.AUTO,
  backgroundColor: '#0f0f1e',
  pixelArt: true,          // roundPixels true + antialias false
  roundPixels: true,
  antialias: false,
  autoRound: true,
  powerPreference: 'high-performance',
  autoMobilePipeline: true,       // Phaser 3.60+ 모바일 파이프라인
  scale: {
    mode: Phaser.Scale.RESIZE,     // 좌표계 고정은 game/viewport.js 가 맡는다
    width:  DESIGN.width,
    height: DESIGN.height,
  },
  physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
  fps: { target: 60, forceSetTimeOut: false },
  input: { activePointers: 3 },   // 지휘관 드래그 + 슬롯 탭 동시
  render: { transparent: false },
  audio: { disableWebAudio: false },
};
```

**`FIT` 을 버린 이유 (2026-08-02):** 20:9 기기에서 좌우 240px 씩, **화면의 20% 가 검은 띠**였다.

**`RESIZE` + `game/viewport.js`:** 캔버스는 화면을 채우되 **세로 720 만 고정**한다.

```
zoom       = 화면높이 / 720
보이는 가로 = 화면너비 / zoom      // 16:9 보다 넓으면 1280 초과
```

이러면 **기존 좌표가 전부 그대로 유효하다** — 레인 y(320/416/512) · 방주 x(96) ·
균열 x(1184) · HUD 높이 중 하나도 안 바뀐다. x<0 과 x>1280 구역이 추가로 보일 뿐이고,
그 구역은 **배경만** 채운다. 게임플레이는 여전히 0~1280 안에서만 일어난다.

- **세로를 고정하는 이유:** 레인이 가로로 놓인 게임이라 세로가 곧 레이아웃이다. 가로는 "더 보여도 되는" 축이고, 세로는 한 픽셀도 양보할 수 없다.
- **`ENVELOP` 이 아닌 이유:** 짧은 축을 채우느라 **긴 축을 잘라낸다.** 세로가 잘리면 HUD 와 레인이 화면 밖으로 나간다.
- **Boot·Preload 에는 걸지 않는다** — 로딩 화면은 좌표계가 필요 없다.

> **함정 2개.** 둘 다 "숫자는 맞는데 화면이 비는" 형태라 계측 없이는 못 찾는다.
>
> 1. **`cam.centerOn()` 은 줌을 무시한다.** Phaser 는 `scrollX = x - cam.width * 0.5` 로 잡는데 `cam.width` 는 화면 픽셀이다. 스크롤은 `화면크기 / 줌` 으로 직접 계산해야 한다.
> 2. **`TileSprite.setSize()` 로 늘린 영역은 그려지지 않는다.** 배경 타일은 넉넉한 고정 폭(디자인 폭 ×3)으로 한 번만 만들고 크기를 바꾸지 않는다.
>
> 진단법: 캔버스 픽셀을 직접 읽어 `#0F0F1E`(클리어 색)인지 확인한다. 클리어 색이면 그 영역은 **아무도 그리지 않은 것**이고, 아트가 어두운 것과 구분된다.

**1280×720 인 이유** (640×360 이 아니라):
1. 보스 원본이 80–250px 이라 640×360 에서는 `EVil Wizard 2`(250×250)가 ×1 에서도 화면 높이의 69% 를 먹고 축소 선택지가 없었다. 1280×720 에서 ×1 = 35% → 배율 선택지 확보
2. 인게임 텍스트·Graphics 선명도 2배. 실측에서 물마루 픽셀 폰트가 그리드에 정확히 안착하는 것을 확인
3. **필레이트 기준선.** 1280×720 = 921,600px × 60fps = 55Mpx/s
   > ⚠ `RESIZE` 로 바꾸면서 **백버퍼가 더 이상 고정이 아니다.** 화면이 크면 그만큼 커진다
   > (예: 2400×1080 = 2.6Mpx, 기준선의 2.8배). 26-performance-budget.md 의 필레이트 항목은
   > 실기기 측정 후 재검토가 필요하다 — 저사양 티어에서 배경 레이어를 3장으로 줄이는
   > `layerCount` 손잡이가 이미 있다.

**저사양 렌더러 폴백**
```js
const lowEnd = (navigator.hardwareConcurrency ?? 8) <= 4
            || (navigator.deviceMemory ?? 8) <= 2;
type: lowEnd ? Phaser.CANVAS : Phaser.AUTO,
```
구형 안드로이드 WebView에서 **Canvas가 WebGL보다 ~30% 빠른 사례가 보고**되어 있다. QA용 수동 토글을 설정에 숨겨 둔다.

---

## 6. 씬 구조

| 씬 | 역할 | 로드 |
|---|---|---|
| **BootScene** | 프로그레스 바 스프라이트만 (< 200KB) | Scene `pack` |
| **PreloadScene** | 전역 아틀라스(UI·유닛·이펙트) + 메뉴 BGM. 진행 바 표시 | 필수 |
| **ArkScene** | **빈 씬.** 전투 밖의 쉬는 자리 — 아무것도 그리지 않는다 (2026-08-04) | 0 |
| **BattleScene** | 전투 렌더러. 스테이지별 에셋 지연 로드 | 무거움 |
| **DebugScene** | FPS·틱·엔티티 수·힙 오버레이 (5Hz). 병렬 실행 | **개발만** — `GameManager.attachDebugOverlay()` 의 **동적** import |

> **`DebugScene` 은 `SCENES` 배열에 없다.** 정적 import 로 등록하면 DEV 삼항으로
> 감싸도 **배포 번들에서 지워지지 않는다** (2026-08-05 실측 — `class X extends
> Phaser.Scene` 의 상위 클래스 때문에 롤업이 모듈을 부수효과로 본다).
> 근거와 되돌리면 안 되는 이유: `26-performance-budget.md` §10.
> 씬 경합 정리(`enforceDesiredScene`)의 예외 목록은 `scenes/index.js:OVERLAY_SCENES`.

> ### ⚠ `MenuScene` 은 삭제됐다 (2026-08-04)
>
> P1 파이프라인 검증용 쇼케이스였다 — 유닛 11체를 늘어놓고 "P1 파이프라인 검증 ·
> 아틀라스 5종 로드됨"이라고 적어 두는 화면. 그런데 그것이 **부팅 뒤의 기본 씬**이었고,
> 씬을 바꾸는 화면은 방주와 전투뿐이라 **출격 · 편성 · 동료 · 설정에서는 그 검증 화면이
> UI 뒤에 계속 떠 있었다.** 사용자가 "뒷 화면에 이상한 게 보인다"고 지적한 것이 이것이다.
>
> `check:prod` 가 못 잡은 이유: 그것은 **정해진 마커 목록**을 찾는다. 이 씬은 마커가
> 아니라 화면 전체였다. 개발용 산출물은 문자열이 아니라 **씬 단위**로도 샐 수 있다.
>
> 전투 밖의 쉬는 자리는 이제 `ArkScene` 하나다. 같은 일을 하는 빈 씬을 둘 두면
> 다음 사람이 어느 쪽을 고쳐야 할지 모른다.

> ### ⚠ **모든 씬은 `installViewport` 를 부른다** (2026-08-04)
>
> 이 저장소의 모든 좌표는 디자인 좌표(1280×720)다. 뷰포트를 붙이지 않은 씬은
> 카메라가 **줌 1 · 스크롤 0** 이라 화면 픽셀 좌표를 그대로 보고, 그러면
> `DESIGN.width / 2`(=640)가 화면 한가운데가 **아니게 된다.**
>
> `BootScene` · `PreloadScene` 이 그 상태였다 — 1536px 창에서 로딩 화면의 제목과
> 진행 바가 42% 지점에 찍혀 **왼쪽으로 치우쳐** 보였다. 화면이 넓을수록 더 치우친다.
> 사용자가 "맨 처음 로딩화면이 왼쪽으로 치우쳐 있다"고 지적한 것이 이것이다.
>
> `src/game/scenes/scenes.test.js` 가 이제 씬 파일을 전수 검사한다 —
> `installViewport` 호출과 `shutdown()` 구현 둘 다.

**씬 전환 규칙:** `scene.start()` 전에 반드시 이전 씬의 `shutdown()` 에서 **모든 Zustand 구독 해제 + 풀 반환 + 트윈 킬**을 수행한다. 씬 재시작이 리스너 중복의 1순위 원인이다.

---

## 7. 백엔드 (결정 필요)

현재 `firebase` 가 설치되어 있다. 선택지:

| 옵션 | 장점 | 단점 |
|---|---|---|
> ⚠ 아래 백엔드 비교표는 **2026-08-04 이전의 판단 기록**이다. 지금 이 게임에는
> 서버가 없고, 서버가 필요했던 이유(가챠 로깅 · 원격설정 · 분석)가 전부 사라졌다.

| **Firebase** (Firestore + Functions + Remote Config + Analytics) | 원격설정·분석·인증이 즉시. 초기 개발 속도 최고 | 가챠 롤 로깅 비용, 복잡한 쿼리 제약, 벤더 락인 |
| **자체 서버** (Node + PostgreSQL) | 롤 로깅·리플레이 검증·PvP 고스트 저장에 유리. 비용 통제 | 초기 구축 비용, 운영 부담 |
| **하이브리드** | Firebase Remote Config + Analytics + Auth, **가챠/세이브만 자체 서버** | 두 시스템 운영 |

**권고: 하이브리드.**
- ~~가챠 RNG 서버 실행~~ — **가챠가 사라졌다** (2026-08-04). 서버가 필요한 이유 하나가 통째로 없어졌다
- 원격 설정·분석·A/B는 Firebase가 압도적으로 저렴하다

**서버는 없다.** Firebase 의존도 걷어냈다 (2026-08-04) — 이 게임은 완전히 오프라인이다.

---

## 8. 라우팅

`createHashRouter` 유지 — Capacitor는 `file://` 유사 오리진에서 실행되므로 BrowserRouter는 새로고침 시 깨진다.

| 경로 | 화면 | 진입점 |
|---|---|---|
| `#/` | 방주 (홈) | 탭바 |
| `#/stages` | 스테이지 선택 | 탭바 |
| `#/loadout` | 편성 | 탭바 · 프리뷰 · 전투 결과 |
| `#/companions` | 동료 목록/성장 + 별 트리 | 탭바 |
| `#/settings` | 설정 | 탭바 |
| `#/battle/:stageId` | 전투 (Phaser 활성) | 스테이지 프리뷰 |

> **화면은 여섯이다** (2026-08-04 경량화). `#/shop` · `#/daily` · `#/pass` ·
> `#/codex` · `#/dungeon` · `#/tower` · `#/trials` · `#/dev/analytics` 는
> **라우트와 화면 파일을 같은 PR 에서 함께 지웠다.**
> 라우트만 남기면 `check:screens` 가 도달 불가로 잡고, 화면만 남기면 죽은 코드가
> 번들에 실린다. 상세: `../04-plan/34-scope-cut.md`
>
> **`#/guild` 도 같은 이유로 제거했다** (P8-01, 2026-08-03) — 라우트만 있고
> 그리로 가는 링크가 저장소 어디에도 없었다. 내용 없는 화면으로 가는 버튼을 만드는 것은
> 도달 불가를 고치는 것이 아니라 없는 기능을 광고하는 것이다.

**`npm run check:screens` 가 이 표를 강제한다.** 라우터를 읽어 도달 그래프를 만들고
`"/"` 에서 BFS 로 닿지 않는 라우트를 오류로 낸다 — 라우트만 만들고 진입점을 빠뜨리면
빌드가 막힌다. 조건부 진입점의 해금 조건은 **규칙 모듈에서 import 한 상수·술어**여야
하고(화면에 숫자를 적으면 R5a), 검사기가 그 술어를 진행도 0..100 에 실제로 돌려
"언젠가 참이 되는가"를 확인한다.

**Phaser 캔버스는 라우트와 무관하게 항상 마운트되어 있고**, 씬만 전환한다. 라우트 변경마다 Phaser를 파괴/재생성하면 로딩이 반복되고 메모리가 파편화된다.

### 8.1 코드 분할 (P9-05)

라우트 화면은 전부 `React.lazy` 다. `<Suspense>` 경계는 **App 셸의 `<Outlet />` 한 곳뿐**이다
(라우트마다 감싸면 14벌이 되고, 그중 하나를 빠뜨리는 날 그 화면만 흰 화면으로 떨어진다).

- **화면 배럴(`src/screens/index.jsx`)은 삭제했다.** 배럴을 동적 import 하면 한 화면만
  열어도 재수출된 화면 전부가 딸려 와 코드 분할이 이름만 남는다. 라우터가 개별 모듈을
  직접 가리키는 것이 유일한 표기이고, 배럴로 되돌아가면 `check:screens` 가 막는다.
- `vite.config.js` 의 `manualChunks` 가 `phaser` · `react` 를 따로 뗀다.
- 실측: `"/"` 진입 시 전송량 **620 → 567 kB gzip (−8.4%)**. 대신 전 화면을 다 방문했을
  때의 총량은 620 → 647 kB 로 는다 (청크 경계마다 압축 사전이 끊긴다). 첫 진입을 사는 거래다.
- **App 셸(PhaserGame · TabBar · FtueOverlay)은 정적 import 그대로 둔다.**

---

## 9. 우선 조치 목록

1. **빌드 복구** — `GameManager.js` 의 `AudienceRoomScene` import 제거, 새 씬 골격 생성
2. **가로 전환** — `config.js` 를 §5로 교체, `AUDIENCE_LAYOUT` 삭제
3. **Phaser 마운트** — `EventBus.js` + `PhaserGame.jsx` 추가, `App.jsx` 재작성, `<StrictMode>` + HMR 가드
4. **에셋 파이프라인** — `tools/pack-atlases.mjs`, `npm run assets:pack` 을 `prebuild` 에 연결 (`23`)
5. **Zustand 스토어** — 슬라이스 + `subscribeWithSelector` + `persist` (`21`)
6. **Capacitor 플러그인** — `screen-orientation`, `status-bar`, `app`, `preferences`, `haptics`, `splash-screen`, `@capacitor-community/safe-area` (`25`)
7. **순수 시뮬** — `src/game/logic/` + 시드 PRNG + 고정 30Hz (`22`)
8. **Vitest + 밸런스 하네스** — 콘텐츠가 커지기 **전에** (`27`)
