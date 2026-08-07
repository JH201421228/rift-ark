/**
 * 효과음 게이트 — 쿨다운 · 동시 재생 상한 · 피치 흔들림 (P3-14)
 *
 * ★★ **이 파일에는 Web Audio 도, DOM 도, 시간도 없다.**
 *
 *   "언제 소리를 낼 수 있는가"는 순수 함수로 분리한다. 오디오 출력 자체는
 *   테스트할 수 없지만 이 판단은 전부 테스트할 수 있고, 실제로 사고가 나는
 *   곳도 여기다 — 광역 공격 한 번에 20마리가 죽으면 소리 20개가 겹쳐 찢어진다.
 *
 *   시각(now)은 전부 인자로 받는다. `Date.now()`/`performance.now()` 를 부르는
 *   순간 이 로직은 테스트할 수 없는 것이 된다.
 *
 * ★ 절대규칙 1(logic/ 오염 금지)과 헷갈리지 말 것: 소리는 표현이므로
 *   `src/game/logic/` 에 두지 않는다. 여기는 fx 계층의 순수 부분이다.
 *
 * @see docs/02-design/19-art-audio-direction.md §6.4
 */

/**
 * 게이트 상태.
 *
 * `ends` 는 각 보이스의 **종료 예정 시각(ms)** 이다. 타이머를 걸지 않고
 * 다음 재생 요청 때 쓸어담는다 — 타이머를 쓰면 씬 shutdown 에서 반드시
 * 하나를 빠뜨리고, 그것이 이 스택의 버그 1순위다(절대규칙 3).
 * 타이머가 없으면 정리할 것도 없다.
 */
export function createSfxGate() {
    return { keys: new Map(), active: 0 };
}

function entryFor(gate, key) {
    let e = gate.keys.get(key);
    if (!e) {
        e = { last: -Infinity, ends: [] };
        gate.keys.set(key, e);
    }
    return e;
}

/** 종료된 보이스를 회수한다. 배열은 length 조정으로 재사용한다 (할당 0) */
export function sweepSfxGate(gate, nowMs) {
    for (const e of gate.keys.values()) {
        const ends = e.ends;
        let w = 0;
        for (let i = 0; i < ends.length; i++) {
            if (ends[i] > nowMs) ends[w++] = ends[i];
        }
        gate.active -= ends.length - w;
        ends.length = w;
    }
    if (gate.active < 0) gate.active = 0;
}

/**
 * 보이스 1개를 확보한다. 실패하면 그 요청은 **조용히 버린다**.
 *
 * ★ 이미 울리고 있는 소리를 끊지 않는다. 예산을 넘긴 새 요청만 버린다 —
 *   EffectSystem 이 이펙트 강도를 다루는 방식과 같은 판단이다.
 *
 * @param {ReturnType<createSfxGate>} gate
 * @param {string} key
 * @param {number} nowMs
 * @param {number} durationMs 이 소리의 길이
 * @param {{cooldownMs:number, maxVoices:number, globalMaxVoices:number}} limits
 * @returns {boolean} 재생해도 되는가
 */
export function tryAcquireVoice(gate, key, nowMs, durationMs, limits) {
    sweepSfxGate(gate, nowMs);

    const e = entryFor(gate, key);
    if (nowMs - e.last < limits.cooldownMs) return false;
    if (e.ends.length >= limits.maxVoices) return false;
    if (gate.active >= limits.globalMaxVoices) return false;

    e.last = nowMs;
    e.ends.push(nowMs + durationMs);
    gate.active++;
    return true;
}

/** 전투가 끝났다 — 다음 판이 이전 판의 쿨다운을 물려받지 않게 한다 */
export function resetSfxGate(gate) {
    gate.keys.clear();
    gate.active = 0;
}

/**
 * 이펙트 강도 → 동시 보이스 상한.
 *
 * ★ 이펙트와 **같은 손잡이**를 쓴다 (settings.effectIntensity).
 *   저사양 기기에서 필레이트가 문제라면 오디오 노드 그래프도 같이 문제이고,
 *   사용자에게 손잡이를 두 개 주면 둘 다 안 만진다.
 *
 * ★ 최소 1은 남긴다. 0이 되면 타격 피드백이 통째로 사라져
 *   "게임이 멈춘 것"처럼 보인다 (EffectSystem.setIntensity 와 같은 이유).
 */
export function scaleVoiceCap(cap, ratio) {
    const r = Number.isFinite(ratio) ? ratio : 1;
    return Math.max(1, Math.round(cap * r));
}

/**
 * 피치 흔들림 배수.
 *
 * ★★ **시뮬의 시드 PRNG 를 절대 쓰지 않는다.**
 *   전투 수학의 난수 스트림을 소리가 한 번이라도 당기면 결정론이 깨지고
 *   리플레이·밸런스 자동검증·비동기 PvP 고스트가 전부 무너진다.
 *   대신 엔티티 id(또는 렌더 측 카운터)를 정수 해시로 흩는다 —
 *   같은 씨앗은 항상 같은 값이지만 시뮬은 이 값을 볼 수 없다.
 *
 * ★ 같은 소리가 초당 여러 번 정확히 같은 높이로 울리면 기계음이 된다.
 *
 * @param {number} seed 엔티티 id 등 정수
 * @param {number} variance 0.08 이면 ±8%
 * @returns {number} 주파수에 곱할 배수
 */
export function jitterPitch(seed, variance) {
    if (!variance) return 1;
    // murmur3 finalizer — 인접한 id 가 인접한 피치가 되지 않게 충분히 흩어진다
    let h = (seed | 0) ^ 0x9e3779b9;
    h = Math.imul(h ^ (h >>> 16), 0x21f0aaad);
    h = Math.imul(h ^ (h >>> 15), 0x735a2d97);
    h ^= h >>> 15;
    const u = (h >>> 0) / 4294967296; // [0, 1)
    return 1 + variance * (u * 2 - 1);
}

/**
 * 소리 하나의 길이(초). 가장 늦게 끝나는 레이어가 곧 전체 길이다.
 * ★ 재생 때마다 다시 세지 않는다 — 엔진이 최초 1회 계산해 캐시한다.
 */
export function soundDurationSec(def) {
    let end = 0;
    const layers = def?.layers ?? [];
    for (let i = 0; i < layers.length; i++) {
        const L = layers[i];
        const t = (L.delay ?? 0) + (L.attack ?? 0) + (L.hold ?? 0) + (L.decay ?? 0);
        if (t > end) end = t;
    }
    return end;
}
