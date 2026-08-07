# 25. Capacitor / 모바일 대응

> 현재 상태: **Capacitor 플러그인이 하나도 설치되어 있지 않다.** `capacitor.config.json` 에는 Capacitor 3 잔재 키가 남아 있고, AndroidManifest에 `screenOrientation` 이 없다.

---

## 1. 설치

```bash
npm i @capacitor/app \
      @capacitor/preferences \
      @capacitor/screen-orientation \
      @capacitor/status-bar \
      @capacitor/splash-screen \
      @capacitor/haptics \
      @capacitor-community/safe-area
npx cap sync
```

| 플러그인 | 용도 |
|---|---|
| `app` | 생명주기(pause/resume), 안드로이드 뒤로가기, 앱 종료 |
| `preferences` | 세이브 파일 (네이티브 저장소) |
| `screen-orientation` | 가로 고정 |
| `status-bar` | 상태바 숨김 |
| `splash-screen` | 흰 화면 없는 전환 |
| `haptics` | 진동 피드백 |
| `@capacitor-community/safe-area` | 안드로이드 edge-to-edge 하에서 `env(safe-area-inset-*)` 보정 |

---

## 2. `capacitor.config.json` (교체본)

```json
{
  "appId": "com.superdimension.app",
  "appName": "RIFT ARK",
  "webDir": "dist",
  "android": {
    "allowMixedContent": false,
    "captureInput": true,
    "webContentsDebuggingEnabled": false,
    "backgroundColor": "#0f0f1e"
  },
  "ios": {
    "contentInset": "never",
    "scrollEnabled": false,
    "backgroundColor": "#0f0f1e"
  },
  "plugins": {
    "SplashScreen": {
      "launchShowDuration": 0,
      "launchAutoHide": false,
      "backgroundColor": "#0f0f1eff",
      "androidScaleType": "CENTER_CROP",
      "showSpinner": false
    },
    "StatusBar": { "overlaysWebView": true, "style": "DARK" }
  }
}
```

**변경점**
- **`bundledWebRuntime` 제거** — Capacitor 3 잔재, 현재 의미 없음
- `launchAutoHide: false` + 수동 `SplashScreen.hide()` → **흰 화면 플래시 없는 스플래시→게임 전환**
- `webContentsDebuggingEnabled` 는 릴리스에서 반드시 `false`
- `ios.scrollEnabled: false` 로 바운스 스크롤 차단

---

## 3. 가로 고정 — 2중 방어

### 3.1 네이티브 (권위 있음, JS 타이밍 구멍 없음)

**Android** — `android/app/src/main/AndroidManifest.xml` 의 `<activity>` 에 추가:
```xml
android:screenOrientation="sensorLandscape"
```
기존 `android:configChanges="orientation|screenSize|..."` 은 **반드시 유지**한다. 없으면 회전 시 Activity가 재생성되어 WebView가 날아가고 게임이 재시작된다.

**iOS** — Xcode → Deployment Info → Device Orientation에서 Portrait 해제, Landscape Left/Right만 체크.
**iPad는 `Info.plist` 에 `UIRequiresFullScreen = YES` 가 없으면 방향 고정이 무시된다** (멀티태스킹 때문).

### 3.2 런타임 플러그인

```js
// src/native/bootstrap.js
import { Capacitor } from '@capacitor/core';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { StatusBar } from '@capacitor/status-bar';

export async function bootstrapNative() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await ScreenOrientation.lock({ orientation: 'landscape' });
    await StatusBar.hide();
  } catch (e) {
    console.warn('[native] bootstrap 실패', e);   // 실패해도 게임은 진행되어야 한다
  }
}
```

> **주의:** targetSdk 36+ / Android 16+ 대형 화면에서는 방향 고정이 불가능하다. 임시 매니페스트 옵트아웃이 있지만 **Android 17에서는 동작하지 않는다.**
> → **태블릿은 회전 가능하다고 가정하고 `FIT` 레이아웃이 4:3에서도 성립하도록 설계한다** (`02-design/18` §1.1).

### 3.3 몰입 모드 — 네비게이션 바를 숨긴다 (2026-08-06)

**가로 모드에서 3버튼 네비게이션 바는 화면의 *좌우*를 먹는다.** 정확히 뒤로가기 ·
탭 바 · 일시정지를 두는 자리다. edge-to-edge(§4)라 WebView 는 그 아래까지 그려지므로
**버튼이 보이는데 눌리지 않는다** — 터치를 시스템이 먼저 가져간다.
사용자 제보: "우측 혹은 좌측의 네비게이션 바 때문에 일부 버튼을 누를 수가 없다."

방향 고정과 **같은 2중 방어**다.

**① 네이티브 (권위 있음)** — `MainActivity.java`

```java
public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle s) { super.onCreate(s); hideSystemBars(); }
    @Override public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();          // ★ onCreate 만으로는 부족하다
    }
    private void hideSystemBars() {
        WindowInsetsControllerCompat c =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.setSystemBarsBehavior(
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        c.hide(WindowInsetsCompat.Type.systemBars());
    }
}
```

**② 런타임** — `src/native/bootstrap.js:hideSystemBars()` → `SafeArea.hideSystemBars({})`.
`SafeArea.enable()` 이 `setDecorFitsSystemWindows(false)` 를 부른 **뒤**에 호출한다.

#### 왜 이렇게 두었나

| 결정 | 이유 |
|---|---|
| **`BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE`** (sticky) | 기본값 `BEHAVIOR_DEFAULT` 에서는 가장자리를 한 번 쓸면 바가 **영구히** 돌아온다. sticky 는 반투명으로 잠깐 떴다 스스로 사라져서, 전투 중 우발적 스와이프가 화면을 되돌리지 않는다 |
| **`onWindowFocusChanged` 재적용** | 포커스를 얻기 전의 호출은 무시될 수 있고, 백그라운드 복귀 · 알림 셰이드를 내렸다 올리면 바가 되살아난다 |
| **전투가 아니라 앱 전체** | 바가 먹는 것은 전투 HUD 만이 아니라 탭 바 · 뒤로가기 · 모달 버튼이다. 화면마다 켜고 끄면 그 전환 순간마다 레이아웃이 튄다 |
| **`lifecycle.js` 에 붙이지 않음** | `onWindowFocusChanged` 가 `appStateChange` 보다 넓다 (셰이드를 내렸다 올리는 것은 `appStateChange` 를 만들지 않는다). 같은 사실을 두 곳에 적지 않는다 |
| **플러그인 추가 없음** | `@capacitor-community/safe-area` 가 이미 `hideSystemBars` 를 노출한다. 다만 이 플러그인은 `systemBarsBehavior` 를 설정하지 않아서 **sticky 는 네이티브에서만 걸 수 있다** |

> **시스템 뒤로 · 홈 제스처는 바가 숨어도 그대로 동작한다.** 제스처 내비게이션 기기는
> 애초에 하단 얇은 바만 있어 영향이 작고, 이 변경의 실질 수혜자는 3버튼 기기다.
>
> **세이프 에어리어는 자동으로 따라온다** — 바가 숨으면 `env(safe-area-inset-*)` 가 0 이
> 되고 §4.2 의 패딩이 사라져 화면이 그만큼 넓어진다. CSS 를 고칠 것이 없다.
>
> ⚠ **iOS 홈 인디케이터는 아직 숨기지 않는다.** `prefersHomeIndicatorAutoHidden` 을
> 두려면 `CAPBridgeViewController` 서브클래스가 필요한데, 제보는 안드로이드 3버튼
> 바였고 iOS 인디케이터는 터치를 가로채지 않는다.

---

## 4. 세이프 에어리어 / Edge-to-Edge

Android 15(API 35)부터 targetSdk 35+ 앱은 **edge-to-edge가 강제**되어 WebView가 상태바·내비게이션 바 뒤로 렌더된다. **가로 모드에서는 노치가 *측면* 인셋을 먹고 제스처 바가 하단을 먹는다** — 정확히 일시정지 버튼이나 액션 바를 두고 싶은 자리다.

### 4.1 `index.html`

```html
<meta name="viewport"
      content="width=device-width, initial-scale=1.0, maximum-scale=1.0,
               user-scalable=no, viewport-fit=cover" />
<meta name="theme-color" content="#0f0f1e" />
<meta name="mobile-web-app-capable" content="yes" />
<title>RIFT ARK</title>
```

### 4.2 전역 CSS

```css
html, body, #root {
  height: 100%;
  margin: 0;
  overflow: hidden;
  overscroll-behavior: none;
  background: #0f0f1e;
  -webkit-user-select: none;  user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: none;                 /* 브라우저 제스처 차단 */
}

#game-container { position: absolute; inset: 0; overflow: hidden; }

#ui-overlay {
  position: absolute; inset: 0;
  pointer-events: none;
  z-index: 10;
  padding: env(safe-area-inset-top)  env(safe-area-inset-right)
           env(safe-area-inset-bottom) env(safe-area-inset-left);
}
#ui-overlay .interactive { pointer-events: auto; }
```

### 4.3 인셋은 오버레이에만

**캔버스는 풀블리드로 둔다.** `FIT` 의 레터박스 바가 노치를 흡수하므로 게임플레이 영역이 손상되지 않는다. React 오버레이에만 패딩을 준다.

`@capacitor-community/safe-area` 는 Chromium < 140 안드로이드에서 `env(safe-area-inset-*)` 가 신뢰할 수 없는 문제를 패치해 준다.

---

## 5. 생명주기

```js
// src/native/lifecycle.js
import { App } from '@capacitor/app';
import { gameManager } from '@/game/GameManager';
import { useGameStore } from '@/store';

export function installLifecycle() {
  App.addListener('appStateChange', async ({ isActive }) => {
    const game = gameManager.game;
    if (!game) return;

    if (!isActive) {
      game.loop.sleep();                     // RAF 루프 완전 정지
      game.sound.pauseAll();
      useGameStore.getState().pauseRun();
      await flushSave();                     // ★ 앱 종료 대비 즉시 저장
    } else {
      game.loop.wake();
      const ctx = game.sound.context;
      if (ctx?.state === 'suspended') await ctx.resume();   // ★ iOS 필수
      game.sound.unlock();
      game.sound.resumeAll();
      // 자동 재개하지 않는다 — React가 "탭하여 계속" 모달을 띄운다
    }
  });

  // 안드로이드 하드웨어 뒤로가기
  // ★ 리스너를 등록하면 기본 동작이 비활성화되므로 모든 분기를 직접 처리해야 한다
  App.addListener('backButton', ({ canGoBack }) => {
    const s = useGameStore.getState();
    if (s.ui.modalStack.length) { s.closeTopModal(); return; }
    if (s.phase === 'battle')   { s.pauseRun();      return; }
    if (canGoBack)              { window.history.back(); return; }
    s.openModal('confirmExit');   // 즉시 종료하지 않고 확인 모달
  });
}
```

### 5.1 왜 고정 틱 시뮬이 여기서 결정적인가

`game.loop.sleep()` 이 시뮬을 얼리고, 복귀 시 **250ms 클램프**가 "5분치 delta를 한 프레임에 계산"하는 사고를 막는다 (`22` §4.1).
순진한 delta 구동 루프였다면 백그라운드 복귀가 곧 전투 붕괴다.

### 5.2 오디오 재개

**iOS는 백그라운드 진입 시 AudioContext를 suspend하고, 포그라운드 복귀 시 자동으로 재개하지 않는다.** Capacitor iOS에서 특히 재현되는 알려진 문제이므로 위 `resume` 처리는 선택이 아니다.

---

## 6. 저장

```js
// src/native/storage.js
import { Preferences } from '@capacitor/preferences';

export const capacitorStorage = {
  getItem:    async (key) => (await Preferences.get({ key })).value ?? null,
  setItem:    async (key, value) => { await Preferences.set({ key, value }); },
  removeItem: async (key) => { await Preferences.remove({ key }); },
};
```

**왜 localStorage/IndexedDB가 아닌가:** WebView의 localStorage와 IndexedDB는 **OS가 언제든 삭제할 수 있다.** iOS는 persisted-storage API가 없어 특히 위험하다. `@capacitor/preferences` 는 네이티브 `UserDefaults` / `SharedPreferences` 에 기록한다.

**SQLite는 지금 필요 없다.** 세이브가 200KB 미만의 키-값이므로 Preferences로 충분하다. 나중에 조회 가능한 데이터(대용량 인벤토리, 전투 로그 이력)가 필요해지면 `@capacitor-community/sqlite` 를 검토한다.

**저장 시점:** 메타 변경 시(자동) + **`App.pause`** + 전투 종료 + 5분 주기.

---

## 7. 스플래시

```jsx
// src/App.jsx
useEffect(() => {
  if (hydrated && preloadDone) SplashScreen.hide();
}, [hydrated, preloadDone]);
```

`launchAutoHide: false` 이므로 **하이드레이션 + Phaser 프리로드가 모두 끝난 뒤** 수동으로 숨긴다. 흰 화면 플래시가 사라지고, 체감 로딩이 짧아진다.

---

## 8. 안드로이드 WebView 성능

- `android:hardwareAccelerated="true"` 를 `<application>` 에 **명시적으로** 설정 (API 14부터 기본값이지만 명시가 안전)
- **WebView는 독립 브라우저/PWA보다 측정 가능하게 느리다** (Chromium 이슈로 문서화됨). 실측 Capacitor 앱은 **약 58fps** 근처에 안착한다 → **60이 아니라 58을 기준으로 예산을 짠다**
- WebView가 스크롤 컨테이너 안에 있지 않도록 한다 (§4.2 CSS)
- **Android System WebView 버전이 낮은 기기**는 Canvas 렌더러로 폴백 (`20` §5)

```xml
<!-- AndroidManifest.xml -->
<application
    android:hardwareAccelerated="true"
    ...>
```

---

## 9. 햅틱

```js
// src/native/haptics.js
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { useGameStore } from '@/store';

let lastAt = 0;
const MIN_INTERVAL = 333;   // 초당 최대 3회

function impact(style) {
  if (!useGameStore.getState().settings.haptics) return;
  const now = performance.now();
  if (now - lastAt < MIN_INTERVAL) return;
  lastAt = now;
  Haptics.impact({ style }).catch(() => {});
}

export const hapticTap    = () => impact(ImpactStyle.Light);
export const hapticHit    = () => impact(ImpactStyle.Medium);
export const hapticHeavy  = () => impact(ImpactStyle.Heavy);
```

**빈도 상한 필수.** 스웜 유닛 20마리가 동시에 공격할 때 진동이 연속되면 배터리와 불쾌감 양쪽이 문제가 된다.

---

## 10. 앱 아이콘 · 스플래시 이미지

```bash
npm i -D @capacitor/assets
npx capacitor-assets generate --iconBackgroundColor '#0f0f1e' --splashBackgroundColor '#0f0f1e'
```

필요 원본:
- `assets/icon.png` — 1024×1024
- `assets/icon-foreground.png`, `assets/icon-background.png` — 안드로이드 적응형 아이콘
- `assets/splash.png` — 2732×2732 (중앙 안전 영역 1200×1200)

**가로 게임이지만 스플래시는 정사각 원본에서 생성**되므로 로고를 정중앙에 둔다.

---

## 11. 빌드 & 배포

```json
"scripts": {
  "build:android": "npm run build && npx cap sync android",
  "build:ios":     "npm run build && npx cap sync ios",
  "open:android":  "npx cap open android",
  "open:ios":      "npx cap open ios"
}
```

**릴리스 체크리스트**
- [ ] `webContentsDebuggingEnabled: false`
- [ ] `minifyEnabled` / ProGuard 설정 확인
- [ ] **AAB로 빌드** (APK 100MB 제한 회피)
- [ ] 서명 키 안전 보관 (분실 시 앱 업데이트 불가)
- [ ] `versionCode` / `versionName` 증가
- [ ] iOS: `UIRequiresFullScreen`(iPad), 방향 설정, 개인정보 사용 설명(`NSUserTrackingUsageDescription` 등)
- [ ] Android: `targetSdk` 정책 준수, 데이터 안전 섹션 작성
- [ ] **확률형 아이템 정보를 스토어 설명과 앱 내 양쪽에 게재** (`02-design/17` §4.2)

---

## 12. 원스토어 (한국)

한국 구글플레이 매출 71–75%, **원스토어 18.4%** — 경쟁이 적고 한국 전용 채널이라 자주 건너뛰지만 실질적 기회다.

Capacitor 앱은 동일 AAB/APK로 원스토어에 올릴 수 있으나 **인앱 결제 SDK가 다르다**. 결제 추상화 레이어를 두어 구글/애플/원스토어를 갈아 끼울 수 있게 설계한다.

```js
// src/payments/index.js — 추상화
export const payments = createPaymentAdapter(
  Capacitor.getPlatform(),          // 'android' | 'ios' | 'web'
  import.meta.env.VITE_STORE        // 'google' | 'onestore'
);
```

**결정:** 소프트런칭은 구글플레이 단독, **원스토어는 한국 정식 출시 시점에 동시 적용** (`04-plan/30-roadmap.md`).

---

## 13. 검증 체크리스트

| 항목 | 확인 |
|---|---|
| 가로 고정이 앱 시작부터 적용되는가 (세로로 잠깐 보이지 않는가) | |
| 노치 기기에서 HUD가 가려지지 않는가 | |
| 제스처 바가 하단 버튼을 가리지 않는가 | |
| **3버튼 기기 가로 모드에서 좌우 네비게이션 바가 숨는가** (§3.3) | |
| **가장자리를 쓸어 바를 띄운 뒤 몇 초 안에 스스로 사라지는가** (sticky) | |
| **백그라운드 복귀 · 알림 셰이드를 내렸다 올린 뒤에도 바가 다시 숨는가** | |
| 백그라운드 5분 후 복귀 시 전투가 정상인가 | |
| 백그라운드 복귀 시 오디오가 재개되는가 (특히 iOS) | |
| 뒤로가기가 모달 → 일시정지 → 종료확인 순으로 동작하는가 | |
| 앱 강제 종료 후 재실행 시 진행도가 보존되는가 | |
| 기내 모드에서 튜토리얼이 끝까지 진행되는가 | |
| 저사양 기기(RAM 2GB)에서 크래시 없이 전투가 완주되는가 | |
| 태블릿 4:3에서 UI가 깨지지 않는가 | |
| 전화 수신 중 앱이 정상 일시정지/복귀하는가 | |
