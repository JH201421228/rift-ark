/**
 * 시드 PRNG
 *
 * ★ 시뮬레이션에서 Math.random() 은 금지다 (ESLint 가 차단한다).
 *   결정론이 깨지면 밸런스 하네스 · 리플레이 · 비동기 PvP 고스트가 전부 무의미해진다.
 *
 * ★ 스트림을 분리하는 이유:
 *   하나의 스트림을 공유하면 한 시스템의 호출 횟수 변경이 다른 시스템의 결과를 바꾼다.
 *   각인을 하나 추가했을 뿐인데 전 스테이지 밸런스가 흔들리는 사태를 막는다.
 *
 * @see docs/03-tech/22-simulation-spec.md §2
 */

/**
 * mulberry32 — 32bit 시드, 주기 2^32, 통계 품질 충분, 매우 빠름.
 * @param {number} seed
 * @returns {() => number} [0, 1)
 */
export function mulberry32(seed) {
    let a = seed >>> 0;
    return function next() {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * 시드 하나에서 독립 스트림 4개를 만든다.
 *
 * fx 는 연출 전용이며 시뮬 결과에 영향을 주지 않는다.
 * 반드시 분리해야 렌더 변형이 전투 결과를 바꾸지 않는다.
 *
 * @param {number} seed
 */
export function makeStreams(seed) {
    return {
        /** 웨이브 생성 */
        spawn: mulberry32(seed ^ 0x1111_1111),
        /** 크리티컬 · 처형 등 전투 판정 */
        combat: mulberry32(seed ^ 0x2222_2222),
        /** 각인 드래프트 */
        sigil: mulberry32(seed ^ 0x3333_3333),
        /** 연출 변형 (시뮬 무관) */
        fx: mulberry32(seed ^ 0x4444_4444),
    };
}

/** @param {() => number} rng */
export function randInt(rng, min, max) {
    return min + Math.floor(rng() * (max - min + 1));
}

/** @param {() => number} rng */
export function randFloat(rng, min, max) {
    return min + rng() * (max - min);
}

/** @param {() => number} rng */
export function pick(rng, arr) {
    return arr[Math.floor(rng() * arr.length)];
}

/** @param {() => number} rng @returns {boolean} */
export function chance(rng, p) {
    return rng() < p;
}

/**
 * Fisher–Yates. 원본을 변경하지 않는다.
 * @param {() => number} rng
 */
export function shuffle(rng, arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const tmp = a[i];
        a[i] = a[j];
        a[j] = tmp;
    }
    return a;
}
