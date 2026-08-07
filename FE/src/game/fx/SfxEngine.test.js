/**
 * SfxEngine 합성 경로 테스트 (P3-14)
 *
 * ★ 스피커는 검사할 수 없지만 **노드 그래프는 검사할 수 있다.**
 *   가짜 AudioContext 를 물려 실제 `play()` 를 돌린다. 이것으로 잡히는 것:
 *     · 오타난 AudioParam 메서드 (실기에서만 터지는 종류)
 *     · 지수 램프에 0 을 넣는 실수 (브라우저가 throw 한다)
 *     · 동시 재생 상한이 **실제로** 노드 수를 묶는가
 *     · 풀링이 실제로 재사용하는가 (절대규칙 8)
 *     · stopAll 이 정말 전부 끊는가 (절대규칙 3 — BGM 겹침 사고의 교훈)
 */
import { describe, it, expect, beforeEach } from "vitest";
import { SfxEngine } from "./SfxEngine.js";
import { SFX } from "./sfxKeys.js";

/* ── 가짜 Web Audio ─────────────────────────────────────── */

function param(name, log) {
    const p = { value: 0, _name: name };
    for (const m of [
        "setValueAtTime",
        "linearRampToValueAtTime",
        "exponentialRampToValueAtTime",
        "cancelScheduledValues",
    ]) {
        p[m] = (v, t) => {
            // ★ 브라우저가 실제로 던지는 조건을 그대로 흉내낸다
            if (m === "exponentialRampToValueAtTime" && !(v > 0)) {
                throw new RangeError(`${name}: 지수 램프의 목표는 0 이 될 수 없다`);
            }
            if (t !== undefined && !Number.isFinite(t)) {
                throw new RangeError(`${name}: 시각이 유한하지 않다`);
            }
            log.push({ node: name, op: m, v, t });
        };
    }
    return p;
}

function fakeContext() {
    const log = [];
    const created = { osc: 0, buf: 0, gain: 0, filter: 0, buffers: 0 };
    const live = [];
    const ctx = {
        state: "running",
        sampleRate: 48000,
        currentTime: 0,
        destination: { _dest: true },
        log,
        created,
        live,
        createGain() {
            created.gain++;
            return { gain: param("gain", log), connect: () => {}, disconnect: () => {} };
        },
        createBiquadFilter() {
            created.filter++;
            return {
                type: "lowpass",
                Q: param("Q", log),
                frequency: param("filter.frequency", log),
                connect: () => {},
                disconnect: () => {},
            };
        },
        createOscillator() {
            created.osc++;
            const n = {
                type: "square",
                frequency: param("osc.frequency", log),
                connect: () => {},
                disconnect: () => {},
                started: null,
                stopped: null,
                onended: null,
                start(t) {
                    this.started = t;
                },
                stop(t) {
                    this.stopped = t ?? 0;
                },
            };
            live.push(n);
            return n;
        },
        createBufferSource() {
            created.buf++;
            const n = {
                buffer: null,
                playbackRate: { value: 1 },
                connect: () => {},
                disconnect: () => {},
                started: null,
                stopped: null,
                onended: null,
                start(t) {
                    this.started = t;
                },
                stop(t) {
                    this.stopped = t ?? 0;
                },
            };
            live.push(n);
            return n;
        },
        createBuffer(chs, len) {
            created.buffers++;
            return { length: len, getChannelData: () => new Float32Array(len) };
        },
    };
    return ctx;
}

/** 재생이 끝난 척한다 — 브라우저의 onended 를 대신 부른다 */
function finishAll(ctx) {
    for (const n of ctx.live.slice()) {
        if (n.onended) n.onended({ target: n });
    }
}

describe("SfxEngine 합성", () => {
    let ctx;
    let e;

    beforeEach(() => {
        ctx = fakeContext();
        e = new SfxEngine();
        e.setContextProvider(() => ctx);
        e.setLevel(0.8);
    });

    it("한 번의 재생이 정의된 레이어 수만큼 소스를 만든다", () => {
        expect(e.play(SFX.HIT_PHYSICAL, 1)).toBe(true);
        // hit.physical = noise 1 + tone 1
        expect(ctx.created.osc).toBe(1);
        expect(ctx.created.buf).toBe(1);
        expect(ctx.created.gain).toBe(3); // master 1 + 레이어 2
        expect(ctx.created.filter).toBe(1);
    });

    it("모든 논리 키가 실제로 합성된다 — 램프 예외 없이", () => {
        for (const key of Object.values(SFX)) {
            ctx.currentTime += 5; // 쿨다운·보이스 상한을 넘긴다
            expect(() => e.play(key, 7)).not.toThrow();
            finishAll(ctx);
        }
    });

    it("노이즈 버퍼는 전 게임에 1개다 (매 재생마다 48,000 샘플을 채우지 않는다)", () => {
        for (let i = 0; i < 10; i++) {
            ctx.currentTime += 1;
            e.play(SFX.HIT_PHYSICAL, i);
            finishAll(ctx);
        }
        expect(ctx.created.buffers).toBe(1);
    });

    it("GainNode·BiquadFilterNode 는 풀에서 재사용된다 (절대규칙 8)", () => {
        ctx.currentTime = 1;
        e.play(SFX.HIT_PHYSICAL, 1);
        finishAll(ctx);
        const afterFirst = { gain: ctx.created.gain, filter: ctx.created.filter };

        ctx.currentTime = 2;
        e.play(SFX.HIT_PHYSICAL, 2);
        // 두 번째 재생은 새 gain/filter 를 만들지 않는다
        expect(ctx.created.gain).toBe(afterFirst.gain);
        expect(ctx.created.filter).toBe(afterFirst.filter);
        // 오실레이터·버퍼소스는 명세상 1회용이라 재사용할 수 없다
        expect(ctx.created.osc).toBe(2);
    });

    /**
     * ★ 같은 틱에 몰린 요청은 **쿨다운**이 자른다.
     *   `ctx.currentTime` 은 오디오 클럭이라 한 프레임의 JS 실행 동안 움직이지
     *   않는다 — 광역 공격으로 20마리가 동시에 죽어도 시각이 전부 같으므로
     *   두 번째부터는 전부 걸린다. maxVoices 는 **프레임을 가로질러** 쌓이는
     *   경우(길이 > 쿨다운)를 막는 두 번째 방벽이다.
     */
    it("같은 순간에 20마리가 죽어도 한 번만 울린다 (동일 SFX 쿨다운)", () => {
        let ok = 0;
        for (let i = 0; i < 20; i++) if (e.play(SFX.DEATH_ENEMY, i)) ok++;
        expect(ok).toBe(1);
        expect(ctx.created.osc).toBe(1);
    });

    it("서로 다른 소리가 한꺼번에 몰리면 전역 상한이 자른다", () => {
        let ok = 0;
        for (const key of Object.values(SFX)) if (e.play(key, 1)) ok++;
        expect(ok).toBe(12); // sfx.json limiter.globalMaxVoices
    });

    it("이펙트 강도가 낮으면 전역 상한이 함께 줄어든다", () => {
        e.setIntensityRatio(0.35); // 12 → 4
        let ok = 0;
        for (const key of Object.values(SFX)) if (e.play(key, 1)) ok++;
        expect(ok).toBe(4);
    });

    it("소리가 끝나면 자리가 돌아온다 — 상한이 영구 봉인이 되지 않는다", () => {
        for (const key of Object.values(SFX)) e.play(key, 1);
        expect(e.gate.active).toBe(12);
        ctx.currentTime = 5; // 전부 종료된 시각
        expect(e.play(SFX.UI_TAP, 2)).toBe(true);
    });

    it("피치가 흔들린다 — 같은 소리가 정확히 같은 높이로 반복되지 않는다", () => {
        const freqOf = () =>
            ctx.log.filter((l) => l.node === "osc.frequency" && l.op === "setValueAtTime").pop().v;
        e.play(SFX.DEATH_ENEMY, 1);
        const a = freqOf();
        ctx.currentTime = 1;
        e.play(SFX.DEATH_ENEMY, 2);
        const b = freqOf();
        expect(a).not.toBe(b);
    });

    it("pitchVar 0 인 소리는 정확한 음정을 유지한다 (팡파르)", () => {
        e.play(SFX.VICTORY, 1);
        const freqs = ctx.log
            .filter((l) => l.node === "osc.frequency" && l.op === "setValueAtTime")
            .map((l) => l.v);
        expect(freqs).toContain(523);
        expect(freqs).toContain(1046);
    });

    it("볼륨 0 이면 노드를 하나도 만들지 않는다", () => {
        e.setLevel(0);
        expect(e.play(SFX.HIT_PHYSICAL, 1)).toBe(false);
        expect(ctx.created.osc + ctx.created.buf).toBe(0);
    });

    it("제스처 전(suspended)에는 조용히 버린다 — throw 하지 않는다", () => {
        ctx.state = "suspended";
        expect(e.play(SFX.UI_TAP)).toBe(false);
        expect(ctx.created.osc).toBe(0);
    });

    it("stopAll 은 울리던 소리를 전부 끊는다 (씬 재시작 시 겹침 방지)", () => {
        e.play(SFX.BOSS_SLAM, 1);
        expect(e._live.size).toBe(3);
        e.stopAll();
        expect(e._live.size).toBe(0);
        expect(e.gate.active).toBe(0);
        for (const n of ctx.live) expect(n.stopped).not.toBeNull();
    });

    it("stopAll 뒤에는 쿨다운도 초기화된다 — 다음 판 첫 타격이 무음이면 안 된다", () => {
        expect(e.play(SFX.BOSS_SLAM, 1)).toBe(true);
        expect(e.play(SFX.BOSS_SLAM, 1)).toBe(false); // 쿨다운
        e.stopAll();
        expect(e.play(SFX.BOSS_SLAM, 1)).toBe(true);
    });

    it("재생이 끝나면 라이브 목록에서 사라진다 (누수 없음)", () => {
        e.play(SFX.HIT_HOLY, 1);
        expect(e._live.size).toBe(3);
        finishAll(ctx);
        expect(e._live.size).toBe(0);
    });

    it("노드 풀이 무한히 자라지 않는다", () => {
        for (let i = 0; i < 200; i++) {
            ctx.currentTime += 1;
            e.play(SFX.HIT_HOLY, i);
            finishAll(ctx);
        }
        expect(e._gainPool.length).toBeLessThanOrEqual(24);
        expect(e._filterPool.length).toBeLessThanOrEqual(24);
    });

    it("setLevel 은 마스터 게인에 즉시 반영된다 (설정 슬라이더)", () => {
        e.play(SFX.UI_TAP);
        e.setLevel(0.5);
        expect(e._master.gain.value).toBeCloseTo(0.5 * 0.7, 5);
    });
});
