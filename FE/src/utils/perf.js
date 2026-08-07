/**
 * 콜드 스타트 계측
 *
 * index.html 의 window.__t0 부터 "첫 인터랙티브 프레임"까지의 시간을 잰다.
 *
 * ★ 목표 3초. Phaser + Capacitor WebView 조합에서 이 지표는
 *   엔지니어링 디테일이 아니라 리텐션 기능이다 — 튜토리얼이 시작되기도 전에
 *   플레이어를 잃는 최대 원인이 로딩 시간이다.
 *
 * @see docs/03-tech/26-performance-budget.md §8
 */

const T0 = typeof window !== "undefined" ? (window.__t0 ?? 0) : 0;

let firstFrameReported = false;

/** __t0 이후 경과 시간(ms) */
export function sinceBoot() {
    return performance.now() - T0;
}

/**
 * 첫 인터랙티브 프레임 도달 보고. 최초 1회만 유효하다.
 * @param {(ms: number) => void} [onReport] 분석 SDK 연결 지점 (P7-16)
 */
export function reportFirstFrame(onReport) {
    if (firstFrameReported) return;
    firstFrameReported = true;

    const ms = Math.round(sinceBoot());
    const verdict = ms <= 3000 ? "✅" : ms <= 4000 ? "⚠️" : "❌";

    if (import.meta.env.DEV) {
        console.log(`[perf] first interactive frame: ${ms}ms ${verdict} (budget 3000ms)`);
    }
    onReport?.(ms);
    return ms;
}

/**
 * 구간 측정용 간이 타이머.
 * @param {string} label
 */
export function mark(label) {
    const start = performance.now();
    return () => {
        const ms = Math.round(performance.now() - start);
        if (import.meta.env.DEV) console.log(`[perf] ${label}: ${ms}ms`);
        return ms;
    };
}
