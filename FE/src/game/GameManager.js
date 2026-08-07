/**
 * GameManager — Phaser 인스턴스 수명주기 싱글톤
 *
 * React 의 StrictMode 는 개발 모드에서 mount → unmount → remount 하므로
 * 이펙트 본문이 2번 실행된다. Phaser 에서는 캔버스 2개, 입력 핸들러 중복,
 * 오디오 중복, 유령 RAF 루프로 나타난다.
 *
 * 대응은 세 겹이다:
 *   1. init() 재진입 시 기존 인스턴스를 파괴하고 재생성
 *   2. 언마운트 클린업에서 destroy(true) — 캔버스까지 제거
 *   3. Vite HMR 은 언마운트 없이 모듈을 재실행하므로 dispose 훅으로 따로 막는다
 *
 * ★ StrictMode 는 개발에서 켜 둔다. Phaser 인스턴스/트윈/리스너 누수를
 *   잡는 가장 싼 탐지기이며, 여기서 깨지는 것은 결국 Capacitor resume 에서도 깨진다.
 *
 * @see docs/03-tech/20-architecture.md §4.2
 */
import Phaser from "phaser";
import { GAME_CONFIG } from "./config.js";
import { SCENES, OVERLAY_SCENES } from "./scenes/index.js";
import { FAULT, recordFault, setLivenessProbe, setLoopReviver } from "@/utils/diagnostics";
/**
 * ★ 여기서 만드는 문구는 **진단 배너와 진단 기록에 그대로 뜬다** — 사용자가 읽는
 *   글자다. 콘솔 문구(`console.warn("[GameManager] …")`)는 그 반대라 영어로 둔다.
 */
import { t } from "@/i18n";

/**
 * 부팅 절차 씬 — **경합 정리의 대상이 아니다.**
 * ★ 이름을 여기 적는 대신 등록부에서 파생하고 싶지만, 등록부는 "무엇이 있는가"만
 *   알고 "무엇이 절차인가"는 모른다. 둘뿐이므로 여기서 명시한다.
 */
const BOOTSTRAP_SCENES = new Set(["Boot", "Preload"]);

/**
 * 겹쳐 떠 있어도 되는 오버레이 씬 (개발 빌드의 `Debug` 하나).
 * ★ 목록은 등록부가 갖는다 — 여기 다시 적으면 두 번째 출처가 된다.
 *   배포 빌드에서는 빈 배열이라 이 Set 도 비어 있다.
 */
const OVERLAY = new Set(OVERLAY_SCENES);

export class GameManager {
    constructor() {
        /** @type {Phaser.Game|null} */
        this.game = null;
        /** 활성이어야 하는 씬 키. 매 프레임 재확인해 경합을 정리한다 */
        this.desiredScene = null;
        this._enforce = null;
        /** 같은 태스크 안에서 들어온 씬 시작 요청 (마지막 것만 실행한다) */
        this._pendingStart = null;
        this._startScheduled = false;
        /**
         * 루프가 마지막으로 돈 시각(performance.now).
         * ★ 진단 감시자가 "rAF 는 도는데 게임만 멈췄다"를 가릴 때 쓰는 유일한 신호다.
         */
        this._steppedAt = 0;
        this._loopGuarded = false;
        this._onPreStep = null;
        this._onContextLost = null;
        this._onContextRestored = null;
    }

    get isInitialized() {
        return this.game !== null;
    }

    /**
     * 게임 초기화 (멱등)
     * @param {HTMLElement} container Phaser 캔버스를 마운트할 컨테이너
     */
    init(container) {
        if (this.isInitialized) {
            // StrictMode 이중 마운트 또는 HMR. 조용히 재생성한다.
            this.destroy();
        }

        if (!container) {
            console.error("[GameManager] a container element is required");
            return;
        }

        try {
            this.game = new Phaser.Game({
                ...GAME_CONFIG,
                parent: container,
                scene: SCENES,
            });

            // 매 프레임 씬 경합을 정리한다 (비용: 씬 수만큼의 비교)
            this._enforce = () => this.enforceDesiredScene();
            this.game.events.on(Phaser.Core.Events.POST_STEP, this._enforce);

            /**
             * ★★★ **생존 신호와 루프 보호는 PRE_STEP 에 건다** (2026-08-05 실측).
             *
             *   처음에는 READY 에서 걸었는데 **한 번도 발동하지 않았다.** Phaser 는
             *   `Game.texturesReady()` 에서 READY 를 emit 한 **뒤에**
             *   `Game.start()` 가 `loop.start(this.step.bind(this))` 를 부른다
             *   (`core/Game.js:416` → `:438`). 즉 READY 시점의 `raf.callback` 은
             *   아직 NOOP 이고, 우리가 감싼 것을 `start()` 가 통째로 덮어썼다.
             *   브라우저에서 일부러 예외를 던져 보고서야 드러났다 —
             *   **감시 장치는 깨뜨려 보지 않으면 배선이 끊긴 것을 알 수 없다.**
             *
             *   PRE_STEP 은 매 프레임 `Game.step()` 의 첫 줄에서 나온다. 그래서
             *   ⓐ 루프가 확실히 시작된 뒤이고 ⓑ 그 프레임에서 나중에 무엇이
             *   터지든 **시각은 이미 찍혀 있다** (POST_STEP 이면 예외가 난 프레임의
             *   신호가 통째로 빠져 "루프가 죽었다"로 오인된다).
             */
            this._onPreStep = () => {
                this._steppedAt = performance.now();
                if (!this._loopGuarded) this.installLoopGuard();
            };
            this.game.events.on(Phaser.Core.Events.PRE_STEP, this._onPreStep);

            // 씬의 shutdown() 을 SHUTDOWN 이벤트에 연결한다 (아래 주석 참조)
            this.game.events.once(Phaser.Core.Events.READY, () => {
                this.wireShutdownHooks();
                // 그래픽 컨텍스트 손실은 조용히 화면을 얼린다 — 반드시 말한다.
                // ★ 캔버스는 READY 시점에야 확실히 존재한다.
                this.installContextWatch();
                this.attachDebugOverlay();
            });

            // 개발 콘솔에서 씬·로더 상태를 들여다보기 위한 핸들
            if (import.meta.env.DEV) {
                globalThis.__game = this.game;
                globalThis.__gm = this;
            }
        } catch (error) {
            console.error("[GameManager] init failed:", error);
            this.game = null;
        }
    }

    /**
     * 게임 인스턴스 파괴 (캔버스 DOM 노드까지 제거)
     *
     * ★ Phaser 의 destroy() 는 실제 해제를 다음 게임 루프 스텝으로 미룬다.
     *   StrictMode 이중 마운트나 HMR 처럼 **첫 스텝이 돌기 전에** 파괴가
     *   요청되면 그 pendingDestroy 가 영영 처리되지 않아 캔버스가 DOM 에 남는다.
     *   → runDestroy() 로 즉시 강제하고, 그래도 남으면 노드를 직접 제거한다.
     */
    destroy() {
        const game = this.game;
        if (!game) return;
        this.game = null;

        if (this._enforce) {
            game.events.off(Phaser.Core.Events.POST_STEP, this._enforce);
            this._enforce = null;
        }
        if (this._onPreStep) {
            game.events.off(Phaser.Core.Events.PRE_STEP, this._onPreStep);
            this._onPreStep = null;
        }
        this._loopGuarded = false;
        this.desiredScene = null;
        this._pendingStart = null;
        this._startScheduled = false;

        const canvas = game.canvas;
        // 진단 배선 해제 — 파괴된 게임의 루프 시각을 계속 보면 감시자가
        // "루프가 죽었다"를 영원히 신고한다
        setLivenessProbe(null);
        setLoopReviver(null);
        if (canvas && this._onContextLost) {
            canvas.removeEventListener("webglcontextlost", this._onContextLost);
            canvas.removeEventListener("webglcontextrestored", this._onContextRestored);
        }
        this._onContextLost = null;
        this._onContextRestored = null;

        game.destroy(true);

        if (game.pendingDestroy) {
            try {
                game.runDestroy();
            } catch {
                /* 이미 처리됨 */
            }
        }
        if (canvas?.isConnected) canvas.remove();
    }

    /**
     * 씬 전환.
     *
     * ★ SceneManager.start() 는 다른 씬을 멈추지 않는다.
     *   명시적으로 정지시키지 않으면 이전 씬이 계속 렌더·업데이트되어
     *   화면이 겹치고 프레임 예산을 두 배로 쓴다.
     *
     * ★★ 한 태스크 안에 들어온 중복 요청은 **마지막 하나로 합친다.**
     *
     *   React StrictMode 는 이펙트를 mount → cleanup → mount 로 동기 실행하므로
     *   switchScene 이 같은 태스크에 두 번 들어온다. Phaser 의 start() 는
     *   아직 부팅되지 않은 씬에 대해 부팅 요청을 **큐에 두 번 쌓고**, 그러면
     *   `create()` 가 shutdown 없이 두 번 실행된다.
     *
     *   그 결과가 **오디오 중복 재생**이다 (BGM 이 겹쳐 들린다는 실제 제보).
     *   첫 create 가 만든 AudioManager·프레젠터·풀이 전부 참조를 잃은 채
     *   살아남고, 루프 BGM 은 아무도 끌 수 없게 된다. 씬에 들어갈 때마다
     *   레이어가 하나씩 늘어난다 (실측: 1회 진입에 base 트랙 2개).
     *
     *   마이크로태스크로 미루면 StrictMode 의 두 호출이 하나로 합쳐지고,
     *   나중에 일어나는 진짜 재시작(재도전·다음 스테이지)은 다른 태스크이므로
     *   그대로 동작한다.
     *
     * @param {string} sceneKey
     * @param {object} [data] 씬 init(data) 로 전달될 파라미터
     */
    switchScene(sceneKey, data) {
        if (!this.game?.scene) return;

        // ★ Phaser 는 stop/start 를 큐에 쌓아 다음 프레임에 처리한다.
        //   "아직 시작되지 않은" 씬이 정지 대상에서 빠져 두 씬이 동시에
        //   살아남는 경우가 있으므로, 원하는 씬을 기록해 매 프레임 재확인한다.
        this.desiredScene = sceneKey;
        this._pendingStart = { sceneKey, data };

        if (this._startScheduled) return;
        this._startScheduled = true;

        queueMicrotask(() => {
            this._startScheduled = false;
            const req = this._pendingStart;
            this._pendingStart = null;

            const mgr = this.game?.scene;
            if (!mgr || !req) return;

            // READY 시점에 아직 인스턴스가 없던 씬을 위한 보강 (이미 걸린 씬은 건너뛴다)
            this.wireShutdownHooks();

            for (const s of mgr.scenes) {
                if (s.scene.key !== req.sceneKey) mgr.stop(s.scene.key);
            }
            mgr.start(req.sceneKey, req.data);
        });
    }

    /**
     * ★★★ **프레임 하나가 게임 전체를 죽이지 못하게 한다** (2026-08-05).
     *
     *   Phaser 의 rAF 루프는 이렇게 생겼다 (`dom/RequestAnimationFrame.js`):
     *
     *       this.step = function step (time) {
     *           _this.callback(time);
     *           if (_this.isRunning) _this.timeOutID = requestAnimationFrame(step);
     *       };
     *
     *   **`callback` 이 던지면 다음 프레임을 예약하는 줄에 도달하지 못한다.**
     *   `isRunning` 은 true 인 채로 남고 재예약은 영영 오지 않는다 — 화면은
     *   그 프레임에서 얼어붙는데 **DOM 은 멀쩡하다.** HUD 버튼이 눌리고
     *   React 는 계속 그린다. 씬 하나의 `update()` 에서 난 오타 하나,
     *   트윈의 `onComplete` 하나, 이벤트 소비 중의 `undefined.x` 하나가
     *   그대로 "게임이 멈춘다"가 된다. 저장소에 방어가 **0곳**이었다.
     *
     * ★ 그래서 **콜백 하나를 감싼다.** 씬 update 뿐 아니라 렌더 · 트윈 콜백 ·
     *   타이머 · Phaser 이벤트까지 프레임 안의 모든 것이 이 안에서 돈다.
     *   씬마다 거는 것보다 확실하고, 무엇보다 **빠뜨릴 자리가 없다.**
     *
     * ★★ **삼키지 않는다.** 잡은 것은 기록되고(`utils/diagnostics.js`) 화면에
     *   배너로 뜬다. 조용한 복구는 이 저장소가 가장 싫어하는 것이다 —
     *   같은 예외가 매 프레임 반복돼도 기록은 한 줄에 횟수로 쌓인다.
     *
     * ★ 설치 시점이 **PRE_STEP 이어야 하는 이유**는 `init()` 의 주석에 있다
     *   (READY 는 `loop.start()` 보다 **먼저** 온다 — 감싼 것이 덮어써진다).
     */
    installLoopGuard() {
        const raf = this.game?.loop?.raf;
        // ★ `start()` 가 실제 콜백을 넣기 전에는 걸지 않는다 (NOOP 을 감싸 봐야
        //   그 자리는 곧 덮어써진다 — READY 에서 걸었다가 겪은 결함이다)
        if (!raf || typeof raf.callback !== "function" || !raf.isRunning) return;
        this._loopGuarded = true;

        const inner = raf.callback;
        const self = this;
        raf.callback = function guardedFrame(time) {
            self._steppedAt = performance.now();
            try {
                inner.call(this, time);
            } catch (e) {
                recordFault(FAULT.FRAME, t("system.msgFrameError", { m: e?.message ?? e }), e);
            }
        };

        setLivenessProbe(() => this._steppedAt);
        /**
         * ★★ **조용한 복구가 아니다.** 감시자는 먼저 기록하고 배너를 띄운 다음
         *   이 함수를 부른다. 깨우지 않으면 사용자는 앱을 강제 종료하는 것 말고
         *   할 수 있는 일이 없고, 그러면 우리는 이 사건을 두 번 다시 못 본다.
         */
        setLoopReviver((now) => {
            this._steppedAt = now;
            try {
                this.game?.loop?.wake();
            } catch (e) {
                console.warn("[GameManager] loop wake failed", e);
            }
        });
    }

    /**
     * WebGL 컨텍스트 손실 · 복원.
     *
     * ★★ 안드로이드에서 이것은 이론이 아니다 — 메모리 압박 · 백그라운드 복귀 ·
     *   GPU 드라이버 재시작이면 컨텍스트가 날아간다. 그때 **캔버스는 영원히
     *   마지막 프레임을 붙들고 있고 아무 로그도 남지 않는다.**
     *
     * ★ `preventDefault()` 는 브라우저에게 "복원해 달라"고 말하는 유일한 방법이다.
     *   Phaser 도 자체 핸들러에서 같은 일을 하지만(WebGL 렌더러일 때만),
     *   여기서는 **CANVAS 로 부팅한 저사양 기기까지** 같은 코드로 덮는다.
     */
    installContextWatch() {
        const canvas = this.game?.canvas;
        if (!canvas || this._onContextLost) return;

        this._onContextLost = (e) => {
            e.preventDefault?.();
            recordFault(FAULT.CONTEXT_LOST, t("system.msgContextLost"));
        };
        this._onContextRestored = () => {
            recordFault(FAULT.CONTEXT_RESTORED, t("system.msgContextRestored"));
        };
        canvas.addEventListener("webglcontextlost", this._onContextLost);
        canvas.addEventListener("webglcontextrestored", this._onContextRestored);
    }

    /**
     * ★★★ 디버그 오버레이를 **개발 빌드에서만** 붙인다 (2026-08-05).
     *
     *   `import.meta.env.DEV` 는 빌드 시 리터럴이라 배포에서는 이 블록이 통째로
     *   접히고, 그러면 `DebugScene.js` 를 부르는 곳이 0곳이 되어 **청크가 아예
     *   만들어지지 않는다.**
     *
     *   ★★ **정적 import 로 하면 안 된다.** 처음에 `scenes/index.js` 에서
     *   `import { DebugScene }` + DEV 삼항으로 갈랐더니 삼항은 접혔는데
     *   **클래스는 번들에 그대로 남았다** (실측). `class X extends Phaser.Scene` 의
     *   상위 클래스가 멤버 접근식이라 롤업이 부수효과로 보고 모듈을 못 지운다.
     *   동적 import 여야 참조가 표현식째로 사라진다 (`scenes/index.js` 주석 참조).
     *
     *   `scene.add(key, cls, true)` 로 즉시 시작한다. 이후 씬 전환에도 살아남는다 —
     *   `enforceDesiredScene` 이 `OVERLAY` 를 예외로 두기 때문이다.
     */
    attachDebugOverlay() {
        if (!import.meta.env.DEV) return;
        import("./scenes/DebugScene.js")
            .then(({ DebugScene }) => {
                const mgr = this.game?.scene;
                if (!mgr || mgr.getScene("Debug")) return;
                mgr.add("Debug", DebugScene, true);
                // 새로 붙인 씬의 shutdown() 도 연결해야 한다 (절대규칙 3)
                this.wireShutdownHooks();
            })
            .catch((e) => console.warn("[GameManager] debug overlay failed to load", e));
    }

    /**
     * ★★ 씬의 `shutdown()` 메서드를 SHUTDOWN 이벤트에 연결한다.
     *
     *   **Phaser 는 씬의 shutdown() 을 자동으로 부르지 않는다.**
     *   자동 연결되는 생명주기 훅은 init · preload · create · update 뿐이고,
     *   shutdown 은 `Systems.shutdown()` 이 SHUTDOWN 이벤트를 emit 할 뿐
     *   같은 이름의 메서드를 호출해 주지 않는다.
     *
     *   그래서 씬마다 정성껏 써 둔 shutdown() 이 **전부 죽은 코드였다.**
     *   구독 해제·트윈 킬·풀 해제·오디오 정지가 한 번도 실행되지 않았고,
     *   증상은 "전투를 나가도 BGM 이 계속 울리고 다시 들어가면 겹친다"로 나타났다
     *   (실제 제보). CLAUDE.md 절대규칙 3 이 요구하는 것을 코드가 지키고 있다고
     *   **믿고만 있었던** 셈이다.
     *
     *   각 씬의 create() 에서 개별 등록하게 두지 않고 여기서 한 번에 거는 이유:
     *   등록을 빠뜨린 씬은 아무 에러 없이 조용히 누수되며, 그 누수는
     *   이 스택에서 가장 찾기 어려운 버그다. 잊을 수 없는 위치에 둔다.
     *
     *   `on` 이다 (`once` 가 아니다). 씬 인스턴스는 stop/start 로 재사용되므로
     *   한 번만 걸면 두 번째 전환부터 다시 죽은 코드가 된다.
     */
    wireShutdownHooks() {
        const mgr = this.game?.scene;
        if (!mgr) return;

        for (const scene of mgr.scenes) {
            if (typeof scene.shutdown !== "function") continue;
            if (scene.__shutdownWired) continue;
            scene.__shutdownWired = true;
            scene.sys.events.on(Phaser.Scenes.Events.SHUTDOWN, scene.shutdown, scene);
        }
        // ★ 같은 순회에서 같이 건다 — 호출부를 늘리면 그중 하나를 빠뜨리는 날이 온다
        this.wireUpdateGuards();
    }

    /**
     * 씬 `update()` 보호.
     *
     * ★ `installLoopGuard` 가 이미 프레임 전체를 감싸지만, 그것은 **어디서**
     *   터졌는지 모른다. 여기서 한 겹 더 두면 기록에 씬 이름이 남고, 무엇보다
     *   그 프레임의 **렌더는 그대로 진행된다** — 화면이 검게 죽지 않는다.
     *
     * ★★ 삼키지 않는다. 잡은 것은 전부 기록되고 배너로 뜬다.
     */
    wireUpdateGuards() {
        const mgr = this.game?.scene;
        if (!mgr) return;

        for (const scene of mgr.scenes) {
            if (typeof scene.update !== "function" || scene.__updateGuarded) continue;
            scene.__updateGuarded = true;
            const key = scene.scene?.key ?? "?";
            const inner = scene.update;
            scene.update = function guardedUpdate(time, delta) {
                try {
                    return inner.call(this, time, delta);
                } catch (e) {
                    recordFault(FAULT.SCENE, `${key}.update: ${e?.message ?? e}`, e);
                    return undefined;
                }
            };
        }
    }

    /**
     * 씬 경합 정리 — 원하는 씬 외에 실행 중인 씬을 정지시킨다.
     *
     * ★★★ **부팅 체인은 건드리지 않는다** (2026-08-04).
     *
     *   `Boot` · `Preload` 는 "보여 주는 씬"이 아니라 **앱이 시작되는 절차**다.
     *   그런데 이 함수는 `desiredScene` 이 아닌 활성 씬을 전부 멈췄고, React 화면이
     *   마운트되는 순간(`usePhaserScene("Ark")`) `desiredScene` 이 정해지므로
     *   **`/ark` 로 바로 들어오면 매 프레임 Preload 가 죽었다.**
     *
     *   증상: 부팅이 Boot 에서 멈추고 `ui.assetsReady` 가 영영 false 라
     *   **모든 전투가 빈 화면**이 된다 (배경도 유닛도 없고 웨이브 0/0).
     *   타이틀(`/`)로 들어오면 그 화면이 씬을 요구하지 않아 우연히 살아 있었다 —
     *   그래서 오래 숨어 있었고, 재현 조건이 "새로고침한 위치"였다.
     */
    enforceDesiredScene() {
        const mgr = this.game?.scene;
        if (!mgr || !this.desiredScene) return;
        for (const s of mgr.getScenes(true)) {
            const key = s.scene.key;
            if (key === this.desiredScene || BOOTSTRAP_SCENES.has(key) || OVERLAY.has(key)) {
                continue;
            }
            mgr.stop(key);
        }
    }

    /**
     * 키로 씬 조회
     * @param {string} sceneKey
     * @returns {Phaser.Scene|undefined}
     */
    getScene(sceneKey) {
        return this.game?.scene.getScene(sceneKey);
    }

    /** 현재 활성 씬 중 첫 번째 */
    getActiveScene() {
        return this.game?.scene.getScenes(true)[0] ?? null;
    }
}

/** 싱글톤 인스턴스 */
export const gameManager = new GameManager();

// Vite HMR: 모듈이 교체될 때 이전 Phaser 인스턴스를 반드시 파괴한다.
// 이게 없으면 저장할 때마다 캔버스가 하나씩 쌓인다.
if (import.meta.hot) {
    import.meta.hot.dispose(() => gameManager.destroy());
}
