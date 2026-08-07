/**
 * SfxEngine — 절차적 효과음 합성 (P3-14)
 *
 * ══════════════════════════════════════════════════════════════════
 * 왜 오디오 **파일**이 아니라 합성인가
 * ══════════════════════════════════════════════════════════════════
 * `FE/asset/` 에는 BGM 21곡만 있고 SFX 는 0개다. 60종을 외부에서 소싱하면
 * 용량 · 라이선스 추적(19 §6.3) · 로딩 예산 · 3파일 포맷 인코딩이 전부 따라온다.
 * 반면 이 게임의 소리는 전부 0.03~0.9초짜리 단발음이고, 아트는 16×16 굵은
 * 픽셀이다 — 레트로 신스는 흉내가 아니라 같은 계보다.
 * 오실레이터 + 노이즈 + 엔벨로프로 만들면 **용량 0 · 라이선스 0 · 로딩 0** 이고,
 * 피치 변주가 공짜라 같은 소리가 기계적으로 반복되지 않는다.
 *
 * ══════════════════════════════════════════════════════════════════
 * 왜 Phaser 의 오디오 경로를 쓰지 않는가 (검토한 세 안)
 * ══════════════════════════════════════════════════════════════════
 * ① Phaser Sound Manager — **불가.** Phaser 는 디코드된 버퍼를 재생할 뿐
 *    합성 수단이 없다. 매 재생마다 AudioBuffer 를 만들어 캐시에 밀어 넣는
 *    우회는 가능하지만, 그러면 파형 하나 바꿀 때마다 렌더링 비용을 다시 내고
 *    무엇보다 **React 화면에서는 쓸 수 없다** (UI 탭·구매·결과음이 전부 Phaser 밖이다).
 *
 * ② 기존 `AudioManager` 확장 — **부적합.** AudioManager 는 **씬 소유**다
 *    (`this.scene.sound`). UI 효과음은 씬 밖에서, 씬이 없을 때도 울려야 한다.
 *    BGM 레이어 로직과 수명주기가 다른 것을 한 클래스에 넣으면 전투를 나갈 때
 *    UI 음이 같이 죽는다. AudioManager 의 `sfx()` 는 파일 기반 경로로 남겨 두고
 *    (나중에 실제 에셋이 들어오면 그대로 쓴다), 합성음은 이 엔진이 담당한다.
 *
 * ③ **AudioContext 직접 사용 — 채택.** 단, **컨텍스트는 Phaser 것을 빌린다.**
 *    iOS 는 AudioContext 개수에 한계가 있고, `native/lifecycle.js` 가 이미
 *    `game.sound.context` 를 resume 한다. 컨텍스트를 하나로 유지하면
 *    백그라운드 복귀 처리가 공짜로 따라온다. Phaser 가 아직/이미 없으면
 *    (부팅 전, 테스트) 자체 컨텍스트로 폴백한다.
 *
 * ══════════════════════════════════════════════════════════════════
 * 풀링 (절대규칙 8)
 * ══════════════════════════════════════════════════════════════════
 * ★ `OscillatorNode`·`AudioBufferSourceNode` 는 **명세상 1회용이다**
 *   (stop 후 재시작 불가). 풀링할 수 없다 — 이건 우리 선택이 아니다.
 *   대신 재사용 가능한 것을 전부 재사용한다:
 *     · GainNode · BiquadFilterNode → 프리리스트에서 대여/반납
 *     · 화이트 노이즈 AudioBuffer  → **전 게임에 1개**. 매번 만들면
 *       재생마다 44,100 샘플을 채우게 되고 그것이 진짜 GC 스터터다.
 *   그리고 동시 보이스 상한(기본 12)이 할당량 자체를 위에서 묶는다.
 *
 * ★ 타이머를 하나도 쓰지 않는다. 보이스 회수는 `sfxGate` 가 다음 요청 때
 *   시각으로 쓸어담고, 노드 회수는 `onended` 한 개(사전 바인딩)가 한다.
 *   씬 shutdown 에서 지워야 할 타이머가 없다 (절대규칙 3).
 *
 * ══════════════════════════════════════════════════════════════════
 * 자동재생 정책
 * ══════════════════════════════════════════════════════════════════
 * ★ 브라우저·웹뷰는 사용자 제스처 전에 AudioContext 를 막는다.
 *   `running` 이 아니면 **조용히 false 를 돌려준다** — 절대 throw 하지 않는다.
 *   첫 탭에서 resume 하고, 리스너는 떼지 않는다(iOS 는 백그라운드 복귀 후
 *   다시 suspended 가 되므로 `once` 로 걸면 그 뒤로 영영 무음이 된다).
 *
 * @see docs/02-design/19-art-audio-direction.md §6.3, §6.4
 */
import SFX_DATA from "../data/sfx.json" with { type: "json" };
import {
    createSfxGate,
    resetSfxGate,
    tryAcquireVoice,
    scaleVoiceCap,
    jitterPitch,
    soundDurationSec,
} from "./sfxGate.js";

/** 지수 램프는 0 을 목표로 삼을 수 없다 (명세) */
const SILENCE = 0.0001;
/** 프리리스트 상한 — 무한히 쌓이면 그것도 누수다 */
const NODE_POOL_MAX = 24;
/** 노이즈 버퍼 길이(초). 가장 긴 노이즈 레이어보다 넉넉하면 된다 */
const NOISE_SEC = 1;

const LIMITER = SFX_DATA.limiter;

export class SfxEngine {
    constructor(data = SFX_DATA) {
        this.data = data;
        this.sounds = data.sounds;
        this.gate = createSfxGate();

        /**
         * 실효 볼륨 (음소거 반영). **기본 0 이다.**
         * ★ 스토어가 알려주기 전에는 울리지 않는다 — 음소거로 저장해 둔
         *   사용자에게 부팅 직후 한 번 소리가 새는 것을 막는다.
         */
        this.level = 0;
        this.intensityRatio = 1;

        /** @type {AudioContext|null} */
        this._ctx = null;
        this._ownsCtx = false;
        this._master = null;
        this._noise = null;
        /** @type {(() => AudioContext|null|undefined)|null} */
        this._provider = null;

        this._gainPool = [];
        this._filterPool = [];
        /** 재생 중인 소스 노드 — stopAll() 이 즉시 끊을 수 있어야 한다 */
        this._live = new Set();
        /** ★ 매 재생마다 클로저를 만들지 않는다 (절대규칙 7의 정신) */
        this._onEnded = (ev) => this._recycle(ev.target);

        /** 길이 캐시 — 재생 때마다 레이어를 다시 훑지 않는다 */
        this._dur = new Map();
        for (const key in this.sounds) {
            this._dur.set(key, soundDurationSec(this.sounds[key]));
        }

        this._unlistenUnlock = null;
    }

    /* ── 컨텍스트 ──────────────────────────────────────────── */

    /**
     * 컨텍스트 공급자를 등록한다.
     * App 이 `() => gameManager.game?.sound?.context` 를 넘긴다 —
     * 엔진이 GameManager 를 import 하면 순환 참조가 된다.
     */
    setContextProvider(fn) {
        this._provider = typeof fn === "function" ? fn : null;
    }

    /** @returns {AudioContext|null} */
    context() {
        const borrowed = this._provider?.();
        if (borrowed && borrowed.state !== "closed") {
            if (borrowed !== this._ctx) this._bind(borrowed, false);
            return this._ctx;
        }
        if (this._ctx && this._ctx.state !== "closed") return this._ctx;

        const Ctor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
        if (!Ctor) return null; // Node 테스트 환경 — 조용히 무음
        try {
            this._bind(new Ctor(), true);
        } catch {
            return null; // 컨텍스트 개수 상한 등. 소리는 게임을 멈출 이유가 아니다
        }
        return this._ctx;
    }

    _bind(ctx, owns) {
        // 컨텍스트가 바뀌면 이전 컨텍스트의 노드는 전부 무효다
        this._dropNodes();
        if (this._ownsCtx && this._ctx && this._ctx !== ctx) {
            this._ctx.close().catch(() => {});
        }
        this._ctx = ctx;
        this._ownsCtx = owns;
        this._master = ctx.createGain();
        this._master.gain.value = this.level * this.data.master;
        this._master.connect(ctx.destination);
        this._noise = null;
    }

    _dropNodes() {
        this._live.clear();
        this._gainPool.length = 0;
        this._filterPool.length = 0;
        try {
            this._master?.disconnect();
        } catch {
            /* 이미 끊김 */
        }
        this._master = null;
    }

    /**
     * 첫 제스처에서 컨텍스트를 재개한다.
     * @returns {() => void} 해제 함수 (App 의 useEffect cleanup 이 부른다)
     */
    installUnlock(target = globalThis) {
        if (this._unlistenUnlock) return this._unlistenUnlock;
        if (!target?.addEventListener) return () => {};

        const resume = () => {
            const ctx = this.context();
            if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
        };
        const opts = { capture: true, passive: true };
        const events = ["pointerdown", "touchend", "keydown"];
        for (const name of events) target.addEventListener(name, resume, opts);

        this._unlistenUnlock = () => {
            for (const name of events) target.removeEventListener(name, resume, opts);
            this._unlistenUnlock = null;
        };
        return this._unlistenUnlock;
    }

    /* ── 설정 ──────────────────────────────────────────────── */

    /** 실효 볼륨 (0~1). 음소거는 여기서 0 으로 들어온다 (sfxLevel 셀렉터) */
    setLevel(v) {
        this.level = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
        if (this._master) this._master.gain.value = this.level * this.data.master;
    }

    /** 이펙트 강도 → 동시 보이스 예산 비율 (EffectSystem 과 같은 표) */
    setIntensityRatio(ratio) {
        this.intensityRatio = Number.isFinite(ratio) ? ratio : 1;
    }

    /* ── 재생 ──────────────────────────────────────────────── */

    /**
     * 효과음 1회 재생.
     *
     * ★ 실패는 전부 조용하다. 소리가 안 나는 것이 예외로 게임을 멈추는 것보다
     *   언제나 낫다 — 정의 없는 키, 제스처 전, 컨텍스트 없음, 예산 초과 모두.
     *
     * @param {string} key sfxKeys.js 의 논리 키
     * @param {number} [seed] 피치 흔들림 씨앗. 엔티티 id 를 넘긴다
     * @param {number} [gainScale] 상황별 감쇠 (기본 1)
     * @returns {boolean} 실제로 울렸는가
     */
    play(key, seed = 0, gainScale = 1) {
        const def = this.sounds[key];
        if (!def) return false;

        // ★ 음소거는 볼륨 0 재생이 아니라 **아예 재생하지 않는 것**이다.
        //   0으로 틀면 들리지도 않는 소리가 보이스 예산을 잡아먹는다.
        if (this.level <= 0) return false;

        const ctx = this.context();
        if (!ctx || ctx.state !== "running" || !this._master) return false;

        const durSec = this._dur.get(key) ?? 0;
        const nowMs = ctx.currentTime * 1000;

        const cooldownMs = def.cooldownMs ?? LIMITER.cooldownMs;
        const maxVoices = scaleVoiceCap(def.maxVoices ?? LIMITER.maxVoices, this.intensityRatio);
        const globalMaxVoices = scaleVoiceCap(LIMITER.globalMaxVoices, this.intensityRatio);

        if (!tryAcquireVoice(this.gate, key, nowMs, durSec * 1000, { cooldownMs, maxVoices, globalMaxVoices })) {
            return false;
        }

        const rate = jitterPitch(seed, def.pitchVar ?? 0);
        const amp = (def.gain ?? 1) * gainScale;
        const t0 = ctx.currentTime;

        const layers = def.layers;
        for (let i = 0; i < layers.length; i++) {
            this._voice(ctx, layers[i], t0, rate, amp);
        }
        return true;
    }

    /** 레이어 1개 → 노드 그래프 1줄 (source → [filter] → gain → master) */
    _voice(ctx, L, t0, rate, amp) {
        const start = t0 + (L.delay ?? 0);
        const attack = L.attack ?? 0.002;
        const hold = L.hold ?? 0;
        const decay = L.decay ?? 0.05;
        const end = start + attack + hold + decay;

        let src;
        if (L.src === "noise") {
            src = ctx.createBufferSource();
            src.buffer = this._noiseBuffer(ctx);
            src.playbackRate.value = rate;
        } else {
            src = ctx.createOscillator();
            src.type = L.wave ?? "square";
            const f = (L.freq ?? 440) * rate;
            src.frequency.setValueAtTime(f, start);
            if (L.freqEnd) {
                src.frequency.exponentialRampToValueAtTime(Math.max(1, L.freqEnd * rate), end);
            }
        }

        let node = src;
        let filter = null;
        if (L.filter) {
            filter = this._acquireFilter(ctx);
            filter.type = L.filter.type ?? "lowpass";
            filter.Q.value = L.filter.q ?? 1;
            filter.frequency.cancelScheduledValues(0);
            filter.frequency.setValueAtTime(Math.max(1, L.filter.freq ?? 1000), start);
            if (L.filter.freqEnd) {
                filter.frequency.exponentialRampToValueAtTime(Math.max(1, L.filter.freqEnd), end);
            }
            node.connect(filter);
            node = filter;
        }

        const gain = this._acquireGain(ctx);
        const peak = Math.max(SILENCE, (L.gain ?? 0.3) * amp);
        gain.gain.cancelScheduledValues(0);
        gain.gain.setValueAtTime(SILENCE, start);
        gain.gain.linearRampToValueAtTime(peak, start + attack);
        if (hold) gain.gain.setValueAtTime(peak, start + attack + hold);
        gain.gain.exponentialRampToValueAtTime(SILENCE, end);

        node.connect(gain);
        gain.connect(this._master);

        // 회수 정보를 노드에 달아 둔다 — 핸들러가 클로저를 만들지 않아도 되게
        src._sfxGain = gain;
        src._sfxFilter = filter;
        src.onended = this._onEnded;

        src.start(start);
        src.stop(end + 0.02);
        this._live.add(src);
    }

    /* ── 노드 풀 ───────────────────────────────────────────── */

    _noiseBuffer(ctx) {
        if (this._noise) return this._noise;
        const len = Math.floor(ctx.sampleRate * NOISE_SEC);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const ch = buf.getChannelData(0);
        // ★ 여기의 Math.random 은 전투 결정론과 무관하다. 부팅 1회, 표현 전용이다
        //   (절대규칙 1 은 src/game/logic/ 에만 적용된다).
        for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
        this._noise = buf;
        return buf;
    }

    _acquireGain(ctx) {
        return this._gainPool.pop() ?? ctx.createGain();
    }

    _acquireFilter(ctx) {
        return this._filterPool.pop() ?? ctx.createBiquadFilter();
    }

    _recycle(src) {
        if (!src) return;
        this._live.delete(src);
        src.onended = null;

        const gain = src._sfxGain;
        const filter = src._sfxFilter;
        src._sfxGain = null;
        src._sfxFilter = null;

        try {
            src.disconnect();
            gain?.disconnect();
            filter?.disconnect();
        } catch {
            /* 이미 끊김 */
        }

        if (gain && this._gainPool.length < NODE_POOL_MAX) this._gainPool.push(gain);
        if (filter && this._filterPool.length < NODE_POOL_MAX) this._filterPool.push(filter);
    }

    /* ── 정리 ──────────────────────────────────────────────── */

    /**
     * 울리고 있는 소리를 전부 끊는다.
     * ★ 전투를 나가는 순간 보스 슬램이 계속 울리면 안 된다.
     *   씬 shutdown 에서 부른다 (절대규칙 3).
     */
    stopAll() {
        // ★ Set 은 순회 중 delete 가 안전하다 (_recycle 이 지운다)
        for (const src of this._live) {
            src.onended = null; // 끊는 것은 우리이므로 콜백을 기다리지 않는다
            try {
                src.stop();
            } catch {
                /* 아직 시작 전이거나 이미 끝남 */
            }
            this._recycle(src);
        }
        this._live.clear();
        resetSfxGate(this.gate);
    }

    destroy() {
        this._unlistenUnlock?.();
        this.stopAll();
        const ctx = this._ctx;
        const owns = this._ownsCtx;
        this._dropNodes();
        this._ctx = null;
        this._ownsCtx = false;
        this._noise = null;
        if (owns && ctx && ctx.state !== "closed") ctx.close().catch(() => {});
    }
}

/**
 * 전역 인스턴스.
 *
 * ★ 싱글톤인 이유: 효과음은 화면(React)과 전장(Phaser) 양쪽에서 나고,
 *   동시 재생 상한은 **둘을 합쳐서** 지켜야 의미가 있다. 인스턴스가 둘이면
 *   상한이 두 배가 되고, 정확히 그때 오디오가 찢어진다.
 */
export const sfxEngine = new SfxEngine();

/** 화면에서 쓰는 짧은 형태 */
export const playSfx = (key, seed = 0, gainScale = 1) => sfxEngine.play(key, seed, gainScale);
