/**
 * 카메라 연출 — 히트스톱 · 셰이크 · 줌 · 섬광
 *
 * ★ 히트스톱이 픽셀 게임의 타격감을 만드는 가장 저렴한 도구다.
 *   스프라이트 애니메이션이 없는 우리 유닛에게는 특히 결정적이다.
 *
 * ★ 히트스톱은 **렌더만 멈추고 시뮬은 멈추지 않는다.**
 *   시뮬을 멈추면 결정론이 깨지고 밸런스가 프레임률에 의존하게 된다.
 *   대신 시뮬 진행 속도를 일시적으로 늦춘다(timeScale).
 *
 * ★★ **화면을 흔드는 모든 수단은 이 클래스를 지나야 한다** (P9-04).
 *   접근성 설정(`settings.screenShake`)을 아는 곳이 여기 하나뿐이기 때문이다.
 *   씬이 `this.cameras.main.shake/flash/zoomTo/fade` 를 직접 부르면 그 한 줄만
 *   설정을 무시하고, 사용자에게는 **"껐는데 흔들린다"** 로 보인다.
 *   실제로 그런 경로가 셋 있었다 (2026-08-03): `zoomPulse`(보스 등장 · 페이즈 전환 ·
 *   진화 각인 · 승리) · `damageFlash`(방주 피격) · 패배 시 `cameras.main.fade`.
 *   셋 다 셰이크 설정과 무관하게 항상 실행됐다. `tools/check-a11y.mjs` 의 M1 이
 *   이 규율을 강제한다.
 *
 * ★ 줌·섬광을 셰이크 설정에 묶은 이유: 전정 장애·멀미의 원인은 "흔들림"이 아니라
 *   **화면 전체가 예고 없이 움직이거나 번쩍이는 것**이다. 스위치를 셋으로 쪼개면
 *   사용자는 셋을 다 찾아야 하고, 우리는 셋 다 배선했는지 매번 확인해야 한다.
 *   손잡이 하나가 이 계열 전부를 끈다 (`18-ux-ui.md` §6 "전정").
 *
 * @see docs/02-design/19-art-audio-direction.md §2.3
 * @see docs/02-design/18-ux-ui.md §6
 */
export class CameraFx {
    /**
     * @param {Phaser.Scene} scene
     * @param {object} [opts] { shakeScale, hitStopEnabled } 접근성 설정
     */
    constructor(scene, opts = {}) {
        this.scene = scene;
        this.cam = scene.cameras.main;
        this.shakeScale = opts.shakeScale ?? 1;
        /**
         * ★ 히트스톱은 전정 장애·멀미에 민감한 사용자에게 실제로 불편을 준다.
         *   끄더라도 시뮬 속도는 그대로여야 하므로(결정론), 여기서 하는 일은
         *   "타임스케일을 낮추지 않는 것"뿐이다 — 밸런스에 영향이 없다.
         */
        this.hitStopEnabled = opts.hitStopEnabled ?? true;

        /** 히트스톱 남은 시간(ms). > 0 이면 시뮬 timeScale 을 낮춘다 */
        this.hitStopMs = 0;
        /**
         * ★ 기준 줌은 1 이 아니다. 레터박스를 없애면서 카메라 줌이
         *   화면높이/720 로 정해지므로(viewport.js), 연출 줌은 **그 값에 상대적**
         *   이어야 한다. 1 로 고정하면 줌 펄스 한 번에 화면이 원래 크기로
         *   튀어버린다.
         */
        this._baseZoom = scene.cameras.main.zoom || 1;
    }

    /** 매 프레임 호출 */
    update(deltaMs) {
        if (this.hitStopMs > 0) this.hitStopMs = Math.max(0, this.hitStopMs - deltaMs);
    }

    /** 시뮬 진행 배율 — 히트스톱 중에는 느려진다 (0 이 아니라 0.08: 완전 정지는 뚝 끊긴다) */
    get timeScale() {
        return this.hitStopMs > 0 ? 0.08 : 1;
    }

    /**
     * 히트스톱. 여러 요청이 겹치면 가장 긴 것을 취한다.
     * @param {number} ms
     */
    hitStop(ms) {
        if (ms <= 0 || !this.hitStopEnabled) return;
        this.hitStopMs = Math.max(this.hitStopMs, ms);
    }

    /**
     * 화면 흔들림.
     * @param {number} intensityPx 디자인 해상도 기준 px
     * @param {number} durationMs
     */
    shake(intensityPx, durationMs = 120) {
        if (this.shakeScale <= 0) return;
        const amount = (intensityPx * this.shakeScale) / this.cam.width;
        this.cam.shake(durationMs, amount, true);
    }

    /**
     * 줌 펄스 (보스 등장·페이즈 전환·진화·승리).
     *
     * ★ 셰이크 강도가 진폭을 **비례로** 줄인다: `1 + (to-1) × shakeScale`.
     *   "약하게"(0.5)에서 1.12배 확대는 1.06배가 된다. 0 이면 아무 일도 하지 않는다 —
     *   화면 전체가 움직이는 연출이 멀미의 주범이므로 "흔들림 끄기"가 이것을 안 끄면
     *   그 스위치는 절반만 작동하는 것이다.
     *
     * @param {number} to 기준 줌 대비 **배율** (1.15 = 15% 확대)
     */
    zoomPulse(to = 1.15, durationMs = 200, holdMs = 0) {
        if (this.shakeScale <= 0) return;
        const scaled = 1 + (to - 1) * this.shakeScale;
        this.cam.zoomTo(this._baseZoom * scaled, durationMs, "Sine.easeOut");
        this.scene.time.delayedCall(durationMs + holdMs, () => {
            this.cam.zoomTo(this._baseZoom, durationMs * 1.5, "Sine.easeInOut");
        });
    }

    /**
     * 붉은 섬광 (방주 피격).
     *
     * ★ 끄더라도 **정보는 사라지지 않는다** — 방주 HP 바가 HUD 에 상시 떠 있고
     *   돌파 이펙트·효과음도 그대로다. 섬광은 그 사실의 강조일 뿐이다.
     * ★ 전체 화면 섬광은 멀미뿐 아니라 광과민성 문제이기도 하다. 그래서 진폭이
     *   아니라 **지속 시간**을 줄인다 — Phaser 의 flash 는 알파 램프라서 짧을수록 옅다.
     */
    damageFlash(color = 0xff2244, durationMs = 180) {
        if (this.shakeScale <= 0) return;
        const ms = Math.round(durationMs * this.shakeScale);
        this.cam.flash(ms, (color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff, true);
    }

    /**
     * 화면 암전 (패배).
     *
     * ★ 셰이크 설정에 걸지 **않는다.** 이것은 연출이 아니라 화면 전환이고,
     *   움직이지도 번쩍이지도 않는다(어두워지기만 한다). 여기를 끄면 패배 순간
     *   전장이 그대로 멈춰 서서 "멈췄나?"가 된다.
     * ★ 그래도 이 클래스를 지나게 하는 이유는 **카메라를 만지는 문이 하나여야**
     *   다음에 누가 무엇을 추가해도 접근성 설정을 지나치지 못하기 때문이다.
     */
    fadeOut(durationMs = 600, r = 40, g = 8, b = 16) {
        this.cam.fade(durationMs, r, g, b);
    }

    /**
     * 접근성 설정 (settings.screenShake). 셰이크 · 줌 펄스 · 섬광을 함께 지배한다.
     *
     * ★ 0 으로 내리면 **진행 중인 줌도 즉시 되돌린다.** 끄는 순간에 마침 줌이 걸려
     *   있으면 화면이 확대된 채로 굳는다 — 되돌리는 트윈은 이미 예약되어 있지만,
     *   "껐는데 화면이 이상하다"는 그 1초로 충분히 만들어진다.
     * ★ `resetFX()` 는 부르지 않는다. 진행 중인 패배 암전(fade)까지 취소해 버린다.
     */
    setShakeScale(v) {
        this.shakeScale = Number(v) || 0;
        if (this.shakeScale <= 0) this.cam.setZoom(this._baseZoom);
    }

    /** 접근성 설정 (settings.hitStop). 끄면 진행 중인 히트스톱도 즉시 푼다 */
    setHitStopEnabled(v) {
        this.hitStopEnabled = Boolean(v);
        if (!this.hitStopEnabled) this.hitStopMs = 0;
    }

    reset() {
        this.hitStopMs = 0;
        this.cam.setZoom(this._baseZoom);
        this.cam.resetFX();
    }
}
