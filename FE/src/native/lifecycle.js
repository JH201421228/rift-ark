/**
 * 앱 생명주기 · 안드로이드 뒤로가기
 *
 * ★ backButton 리스너를 등록하면 기본 동작이 비활성화된다.
 *   모든 분기를 직접 처리하지 않으면 앱을 닫을 수 없게 된다.
 *
 * ★ iOS 는 백그라운드 진입 시 AudioContext 를 suspend 하고
 *   포그라운드 복귀 시 자동 재개하지 않는다. resume 처리는 선택이 아니다.
 *
 * 고정 틱 시뮬레이션(22-simulation-spec.md) 덕분에 "복귀 시 전투 붕괴"가
 * 구조적으로 막힌다 — loop.sleep() 이 시뮬을 얼리고, 250ms 클램프가
 * 밀린 delta 를 한 프레임에 몰아 계산하는 사고를 막는다.
 *
 * @see docs/03-tech/25-capacitor-mobile.md §5
 */
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { gameManager } from "@/game/GameManager";

/** @type {Array<{remove: () => void}>} */
let handles = [];

/**
 * @param {object} hooks
 * @param {() => void} [hooks.onPause]   세이브 flush 등
 * @param {() => void} [hooks.onResume]
 * @param {() => boolean} [hooks.onBack] true 를 반환하면 처리 완료(앱 종료 안 함)
 */
export async function installLifecycle(hooks = {}) {
    if (!Capacitor.isNativePlatform()) return;
    await uninstallLifecycle();

    handles.push(
        await App.addListener("appStateChange", async ({ isActive }) => {
            const game = gameManager.game;

            if (!isActive) {
                game?.loop.sleep(); // RAF 루프 완전 정지
                game?.sound.pauseAll();
                hooks.onPause?.(); // ★ 앱 종료 대비 즉시 저장
                return;
            }

            game?.loop.wake();
            const ctx = game?.sound?.context;
            if (ctx?.state === "suspended") {
                try {
                    await ctx.resume();
                } catch (e) {
                    console.warn("[native] AudioContext resume failed", e);
                }
            }
            game?.sound.unlock();
            game?.sound.resumeAll();
            hooks.onResume?.();
            // 자동 재개하지 않는다 — React 가 "탭하여 계속" 모달을 띄운다
        })
    );

    handles.push(
        await App.addListener("backButton", () => {
            /**
             * ★★ **히스토리를 되감지 않는다** (2026-08-04).
             *
             *   예전에는 `canGoBack` 이면 `window.history.back()` 을 불렀다. 이 게임은
             *   해시 라우터라 히스토리에 **지나온 전투가 전부 쌓인다** — 뒤로가기가
             *   방금 깬 스테이지로 되돌아가고, 한 번 더 누르면 그 전 스테이지로 갔다.
             *   사용자가 "뒤로가기로 이전 스테이지로 돌아가진다"고 지적한 것이 이것이다.
             *
             *   뒤로가기는 이제 **앞으로 가는 이동**이다: 화면에는 부모가 하나씩 있고
             *   (`App.jsx:onBack`), 뒤로가기는 그 부모로 간다. 히스토리는 보지 않는다.
             */
            if (hooks.onBack?.()) return;
            // 처리할 부모가 없는 화면(타이틀)에서만 앱을 닫는다
            App.exitApp();
        })
    );
}

export async function uninstallLifecycle() {
    for (const h of handles) {
        try {
            await h.remove();
        } catch {
            /* 이미 제거됨 */
        }
    }
    handles = [];
}
