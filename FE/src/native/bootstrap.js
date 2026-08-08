/**
 * 네이티브 부트스트랩 — 가로 고정 · 시스템 바 숨김 · 세이프에어리어
 *
 * 방향 고정은 2중 방어다:
 *   1. 네이티브 매니페스트 (권위 있음, JS 타이밍 구멍 없음)
 *      - AndroidManifest: android:screenOrientation="sensorLandscape"
 *      - Info.plist: UISupportedInterfaceOrientations 에서 Portrait 제거
 *   2. 여기 플러그인 호출 (런타임 제어)
 *
 * 시스템 바 숨김도 같은 모양이다:
 *   1. MainActivity.java 의 몰입 모드 (onCreate + 포커스 복귀마다 재적용)
 *   2. 여기 hideSystemBars() (런타임 · 웹뷰가 늦게 뜨는 기기 대비)
 *
 * ★ 이 함수의 실패가 게임 실행을 막아서는 안 된다. 전부 try/catch 로 감싼다.
 *
 * @see docs/03-tech/25-capacitor-mobile.md §3
 */
import { Capacitor } from "@capacitor/core";
import { ScreenOrientation } from "@capacitor/screen-orientation";
import { StatusBar } from "@capacitor/status-bar";
import { SafeArea } from "@capacitor-community/safe-area";

export function isNative() {
    return Capacitor.isNativePlatform();
}

export async function bootstrapNative() {
    if (!isNative()) return;

    // Android 15+ edge-to-edge 에서 env(safe-area-inset-*) 를 신뢰할 수 있게 만든다.
    // Chromium < 140 안드로이드에서 CSS 변수가 비어 있는 문제를 이 플러그인이 패치한다.
    try {
        await SafeArea.enable({
            config: {
                customColorsForSystemBars: true,
                statusBarColor: "#00000000",
                statusBarContent: "light",
                navigationBarColor: "#00000000",
                navigationBarContent: "light",
            },
        });
    } catch (e) {
        console.warn("[native] SafeArea.enable failed", e);
    }

    /**
     * ★★★ **안드로이드에서는 잠그지 않는다 — 매니페스트가 이미 더 정확하다**
     *   (2026-08-08, 사용자 제보: "폰을 거꾸로 들면 180도 회전이 안 된다").
     *
     *   플러그인의 `lock({ orientation: "landscape" })` 는
     *   `ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE` 로 간다 — **한쪽 가로에 고정**이다
     *   (`ScreenOrientation.java` 확인). 그런데 매니페스트는 `sensorLandscape` 로
     *   **좌우 두 방향을 모두 허용**하고 있었다. 런타임 호출이 그것을 덮어써서
     *   폰을 180° 돌려도 화면이 따라오지 않았다.
     *
     *   ★ 플러그인에는 `sensorLandscape` 에 해당하는 값이 없다 —
     *     `landscape-secondary` 는 반대쪽 **고정**이라 마찬가지다.
     *     그러니 여기서는 아무것도 하지 않는 것이 정답이다. 방향의 단일 출처는
     *     `AndroidManifest.xml` 의 `screenOrientation` 이다.
     *
     *   ⚠ iOS 에는 그 매니페스트가 없다. `Info.plist` 의
     *     `UISupportedInterfaceOrientations` 가 그 역할을 하지만, iOS 빌드를 낼 때
     *     확인해야 하므로 **iOS 에서는 기존 동작(잠금)을 유지**한다.
     */
    if (Capacitor.getPlatform() === "ios") {
        try {
            await ScreenOrientation.lock({ orientation: "landscape" });
        } catch (e) {
            console.warn("[native] landscape lock failed (may be a tablet)", e);
        }
    }

    try {
        await StatusBar.hide();
    } catch (e) {
        console.warn("[native] StatusBar.hide failed", e);
    }

    await hideSystemBars();
}

/**
 * 상태바 · 네비게이션 바를 숨긴다.
 *
 * 가로 모드의 3버튼 네비게이션 바는 화면 좌우를 먹고, 그 위에 그려진 버튼은
 * **보이는데 눌리지 않는다** (터치를 시스템이 먼저 가져간다).
 *
 * 실제 권위는 MainActivity 의 몰입 모드다 — 여기서는 sticky 동작(스와이프하면
 * 잠깐 떴다 사라짐)을 설정할 수 없기 때문에, 이 호출은 네이티브가 놓친 순간을
 * 메우는 보조일 뿐이다. 실패해도 게임은 진행되어야 한다.
 */
export async function hideSystemBars() {
    if (!isNative()) return;
    try {
        await SafeArea.hideSystemBars({});
    } catch (e) {
        console.warn("[native] hideSystemBars failed", e);
    }
}
