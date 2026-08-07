/**
 * 기기 성능 판정 — 렌더러 선택과 품질 티어가 **같은 답**을 쓰게 하는 한 곳
 *
 * ★★ 이 판정이 두 곳에 있으면 반드시 갈라진다. 그러면 "Canvas 로 부팅할 만큼
 *   낮은 기기인데 그래픽 품질은 최고"라는, 아무에게도 설명할 수 없는 상태가 생긴다.
 *   `config.js`(렌더러)와 `fx/quality.js`(품질 티어)가 여기 하나를 본다.
 *
 * ★★ **`config.js` 에서 떼어낸 이유는 Phaser 다** (2026-08-05).
 *   `config.js` 는 최상단에서 `phaser` 를 import 하고, Phaser 는 로드되는 순간
 *   `window` 를 만진다. 그래서 이 판정 하나를 쓰려는 순수 모듈(`fx/quality.js`)이
 *   테스트에서 브라우저 환경을 요구하게 됐다 — 값 하나 때문에 렌더러 전체를
 *   끌고 오는 셈이다. 판정 자체는 `navigator` 두 필드를 읽는 것이 전부다.
 *
 * ★ 구형 안드로이드 WebView 에서는 Canvas 가 WebGL 보다 빠른 사례가 보고되어 있다.
 *   그것이 이 판정이 렌더러까지 정하는 이유다.
 *
 * @see docs/03-tech/26-performance-budget.md §4
 */

/**
 * 저사양인가.
 *
 * ★ `navigator` 를 인자로 받는다 — 테스트가 기기를 흉내 낼 수 있어야 하고,
 *   그러지 못하면 이 판정은 실행해 보지 않은 채로 남는다.
 *
 * @param {{hardwareConcurrency?: number, deviceMemory?: number}} [nav]
 */
export function detectLowEnd(nav = globalThis.navigator) {
    if (!nav) return false;
    const cores = nav.hardwareConcurrency ?? 8;
    const mem = nav.deviceMemory ?? 8;
    return cores <= 4 || mem <= 2;
}

/** 부팅 시점에 한 번만 잰다 — 기기 사양은 실행 중에 바뀌지 않는다 */
export const IS_LOW_END = detectLowEnd();
