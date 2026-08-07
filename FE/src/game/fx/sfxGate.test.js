/**
 * 효과음 게이트 · 정의 스키마 테스트 (P3-14)
 *
 * ★ 오디오 **출력**은 테스트할 수 없다 (스피커를 검사할 방법이 없다).
 *   그래서 테스트할 수 있는 것을 전부 테스트한다:
 *     · 소리 정의 스키마 유효성
 *     · 논리 키와 정의의 양방향 일치
 *     · 쿨다운 / 동시 재생 상한 (순수 함수)
 *     · 볼륨 0 일 때 재생하지 않음
 *     · 피치 흔들림이 시뮬 PRNG 를 쓰지 않고 결정론적임
 */
import { describe, it, expect } from "vitest";
import SFX_DATA from "../data/sfx.json" with { type: "json" };
import { SFX, ALL_SFX_KEYS, HIT_BY_DAMAGE_TYPE } from "./sfxKeys.js";
import {
    createSfxGate,
    tryAcquireVoice,
    sweepSfxGate,
    resetSfxGate,
    scaleVoiceCap,
    jitterPitch,
    soundDurationSec,
} from "./sfxGate.js";
import { SfxEngine } from "./SfxEngine.js";

const LIMITS = { cooldownMs: 60, maxVoices: 3, globalMaxVoices: 12 };

/* ══════════════════════════════════════════════════════════
 * 소리 정의 (데이터)
 * ══════════════════════════════════════════════════════════ */

describe("sfx.json 스키마", () => {
    const sounds = SFX_DATA.sounds;
    const names = Object.keys(sounds);

    it("논리 키와 정의가 양방향으로 일치한다", () => {
        // 정의 없는 키 = 영원히 무음인 배선 (에러도 안 난다)
        const missing = ALL_SFX_KEYS.filter((k) => !sounds[k]);
        expect(missing).toEqual([]);
        // 아무도 안 쓰는 정의 = 죽은 데이터
        const orphans = names.filter((k) => !ALL_SFX_KEYS.includes(k));
        expect(orphans).toEqual([]);
    });

    it("데미지 타입 3종이 모두 서로 다른 타격음을 갖는다", () => {
        const keys = Object.values(HIT_BY_DAMAGE_TYPE);
        expect(keys).toHaveLength(3);
        expect(new Set(keys).size).toBe(3);
        for (const k of keys) expect(sounds[k]).toBeDefined();
    });

    it.each(names)("%s — 레이어와 엔벨로프가 유효하다", (name) => {
        const def = sounds[name];
        expect(Array.isArray(def.layers)).toBe(true);
        expect(def.layers.length).toBeGreaterThan(0);

        expect(def.gain).toBeGreaterThan(0);
        expect(def.gain).toBeLessThanOrEqual(1);
        expect(def.cooldownMs).toBeGreaterThanOrEqual(0);
        expect(def.maxVoices).toBeGreaterThanOrEqual(1);
        expect(def.pitchVar).toBeGreaterThanOrEqual(0);
        expect(def.pitchVar).toBeLessThanOrEqual(0.5);

        for (const L of def.layers) {
            expect(["tone", "noise"]).toContain(L.src);
            expect(L.gain).toBeGreaterThan(0);
            expect(L.decay).toBeGreaterThan(0);
            if (L.src === "tone") {
                expect(["sine", "square", "sawtooth", "triangle"]).toContain(L.wave);
                // ★ 지수 램프는 0 을 목표로 삼을 수 없다 — 주파수는 반드시 양수다
                expect(L.freq).toBeGreaterThan(0);
                if (L.freqEnd !== undefined) expect(L.freqEnd).toBeGreaterThan(0);
            }
            if (L.filter) {
                expect(["lowpass", "highpass", "bandpass"]).toContain(L.filter.type);
                expect(L.filter.freq).toBeGreaterThan(0);
            }
        }
    });

    it("모든 소리가 길이 상한 안에 있다", () => {
        for (const name of names) {
            const d = soundDurationSec(sounds[name]);
            expect(d).toBeGreaterThan(0);
            expect(d).toBeLessThanOrEqual(SFX_DATA.limiter.maxDurationSec);
        }
    });

    it("자주 울리는 전투음일수록 짧다 — 적 사망은 0.3초 이내", () => {
        expect(soundDurationSec(sounds[SFX.DEATH_ENEMY])).toBeLessThan(0.3);
        expect(soundDurationSec(sounds[SFX.UI_TAP])).toBeLessThan(0.1);
    });
});

/* ══════════════════════════════════════════════════════════
 * 게이트 (순수 로직)
 * ══════════════════════════════════════════════════════════ */

describe("쿨다운", () => {
    it("같은 키가 쿨다운 안에 다시 오면 버린다", () => {
        const g = createSfxGate();
        expect(tryAcquireVoice(g, "a", 0, 50, LIMITS)).toBe(true);
        expect(tryAcquireVoice(g, "a", 30, 50, LIMITS)).toBe(false);
        expect(tryAcquireVoice(g, "a", 60, 50, LIMITS)).toBe(true);
    });

    it("다른 키는 서로의 쿨다운에 걸리지 않는다", () => {
        const g = createSfxGate();
        expect(tryAcquireVoice(g, "a", 0, 50, LIMITS)).toBe(true);
        expect(tryAcquireVoice(g, "b", 0, 50, LIMITS)).toBe(true);
    });
});

describe("동시 재생 상한", () => {
    it("키별 상한을 넘으면 버린다 — 광역 공격에 20마리가 죽어도 3개만 울린다", () => {
        const g = createSfxGate();
        const limits = { ...LIMITS, cooldownMs: 0, maxVoices: 3 };
        let played = 0;
        for (let i = 0; i < 20; i++) {
            if (tryAcquireVoice(g, "death", i, 500, limits)) played++;
        }
        expect(played).toBe(3);
    });

    it("전역 상한은 서로 다른 키를 합쳐서 센다", () => {
        const g = createSfxGate();
        const limits = { cooldownMs: 0, maxVoices: 99, globalMaxVoices: 4 };
        let played = 0;
        for (let i = 0; i < 20; i++) {
            if (tryAcquireVoice(g, `k${i}`, 0, 500, limits)) played++;
        }
        expect(played).toBe(4);
        expect(g.active).toBe(4);
    });

    it("소리가 끝나면 자리를 돌려준다 (타이머 없이 시각으로 회수)", () => {
        const g = createSfxGate();
        const limits = { ...LIMITS, cooldownMs: 0, maxVoices: 2 };
        expect(tryAcquireVoice(g, "a", 0, 100, limits)).toBe(true);
        expect(tryAcquireVoice(g, "a", 1, 100, limits)).toBe(true);
        expect(tryAcquireVoice(g, "a", 2, 100, limits)).toBe(false);

        // 101ms 시점 — 첫 두 소리는 끝났다
        expect(tryAcquireVoice(g, "a", 102, 100, limits)).toBe(true);
        expect(g.active).toBe(1);
    });

    it("sweep 은 활성 수를 음수로 만들지 않는다", () => {
        const g = createSfxGate();
        tryAcquireVoice(g, "a", 0, 10, LIMITS);
        sweepSfxGate(g, 1000);
        sweepSfxGate(g, 2000);
        expect(g.active).toBe(0);
    });

    it("reset 은 다음 전투가 이전 전투의 쿨다운을 물려받지 않게 한다", () => {
        const g = createSfxGate();
        tryAcquireVoice(g, "a", 1000, 50, LIMITS);
        resetSfxGate(g);
        expect(g.active).toBe(0);
        expect(tryAcquireVoice(g, "a", 1000, 50, LIMITS)).toBe(true);
    });
});

describe("이펙트 강도 → 보이스 예산", () => {
    it("강도가 낮으면 상한이 줄어든다", () => {
        expect(scaleVoiceCap(12, 1)).toBe(12);
        expect(scaleVoiceCap(12, 0.6)).toBe(7);
        expect(scaleVoiceCap(12, 0.35)).toBe(4);
    });

    it("아무리 낮아도 1은 남는다 — 0이면 타격 피드백이 통째로 사라진다", () => {
        expect(scaleVoiceCap(3, 0)).toBe(1);
        expect(scaleVoiceCap(1, 0.35)).toBe(1);
    });

    it("이상한 값이 와도 무너지지 않는다", () => {
        expect(scaleVoiceCap(12, undefined)).toBe(12);
        expect(scaleVoiceCap(12, NaN)).toBe(12);
    });
});

describe("피치 흔들림", () => {
    it("같은 씨앗은 항상 같은 값 (결정론)", () => {
        expect(jitterPitch(42, 0.1)).toBe(jitterPitch(42, 0.1));
    });

    it("variance 0 이면 정확히 1 — 팡파르는 흔들리면 안 된다", () => {
        expect(jitterPitch(12345, 0)).toBe(1);
        expect(jitterPitch(12345, undefined)).toBe(1);
    });

    it("항상 ±variance 안에 있다", () => {
        for (let i = -50; i < 500; i++) {
            const r = jitterPitch(i, 0.12);
            expect(r).toBeGreaterThanOrEqual(1 - 0.12);
            expect(r).toBeLessThanOrEqual(1 + 0.12);
        }
    });

    it("인접한 엔티티 id 가 인접한 피치가 되지 않는다", () => {
        const vals = [];
        for (let i = 0; i < 64; i++) vals.push(jitterPitch(i, 0.1));
        // 64개가 거의 전부 다른 값이어야 한다 (해시가 실제로 흩는가)
        expect(new Set(vals).size).toBeGreaterThan(60);
    });
});

/* ══════════════════════════════════════════════════════════
 * 엔진 (오디오 컨텍스트 없는 환경에서의 계약)
 * ══════════════════════════════════════════════════════════ */

describe("SfxEngine — 무음 환경에서의 안전성", () => {
    it("AudioContext 가 없으면 조용히 false 를 돌려준다 (throw 하지 않는다)", () => {
        const e = new SfxEngine();
        e.setLevel(1);
        expect(e.play(SFX.UI_TAP)).toBe(false);
    });

    it("볼륨 0 이면 컨텍스트를 만들지도 않는다 — 음소거는 '재생하지 않는 것'", () => {
        const e = new SfxEngine();
        let asked = 0;
        e.setContextProvider(() => {
            asked++;
            return null;
        });
        e.setLevel(0);
        expect(e.play(SFX.HIT_PHYSICAL, 1)).toBe(false);
        expect(asked).toBe(0);
    });

    it("정의 없는 키는 조용히 무시한다", () => {
        const e = new SfxEngine();
        e.setLevel(1);
        expect(e.play("없는.키")).toBe(false);
    });

    it("모든 논리 키의 길이를 미리 계산해 둔다 (재생 때 다시 세지 않는다)", () => {
        const e = new SfxEngine();
        for (const k of ALL_SFX_KEYS) expect(e._dur.get(k)).toBeGreaterThan(0);
    });

    it("setLevel 은 0~1 로 물린다", () => {
        const e = new SfxEngine();
        e.setLevel(5);
        expect(e.level).toBe(1);
        e.setLevel(-2);
        expect(e.level).toBe(0);
        e.setLevel(NaN);
        expect(e.level).toBe(0);
    });

    it("stopAll / destroy 는 컨텍스트가 없어도 터지지 않는다 (shutdown 은 절대 throw 하지 않는다)", () => {
        const e = new SfxEngine();
        expect(() => e.stopAll()).not.toThrow();
        expect(() => e.destroy()).not.toThrow();
    });
});
