/**
 * 보스 월드 표현 — 페이즈 배너 · 태그 변경 알림 · 슬램 위험 영역 (P6-05)
 *
 * ★ 이 프레젠터의 존재 이유는 **정보 전달**이지 화려함이 아니다.
 *
 *   페이즈가 바뀌면 "지금까지 통하던 딜이 안 통한다"가 시작된다.
 *   그걸 화면이 말해주지 않으면 플레이어는 자기 편성이 갑자기 약해졌다고
 *   느낄 뿐, **무엇을 바꿔야 하는지 영영 모른다.** 그러면 상성 시스템은
 *   전략이 아니라 그냥 벽이 된다 (18-ux-ui.md §2.6 과 같은 이유다).
 *
 *   그래서 페이즈 전환에서 반드시 보여주는 것은 셋:
 *     ① 페이즈가 바뀐다 (배너)
 *     ② **새 태그가 무엇인가** (태그 칩)
 *     ③ 언제 끝나는가 (0.8초 게이지)
 *
 * ★ 슬램 위험 영역은 **월드 좌표에 앵커된 물체**다. HUD(React)가 아니라
 *   여기(Phaser)가 그린다. 지휘관을 어디로 뺄지를 판단하는 정보이므로
 *   전장 좌표계 위에 있어야 한다.
 *
 * ★ 시뮬을 읽기만 한다. 규칙을 갖지 않는다.
 * ★ 만든 게임오브젝트·트윈은 전부 destroy() 에서 해제한다.
 *
 * @see docs/02-design/19-art-audio-direction.md §4
 */
import { PIXEL_FONT, DESIGN, LANES } from "../config.js";
import { maskToTags } from "../logic/tags.js";

/**
 * 태그 이름 — **`i18n/messages/terms.json` 이 단일 출처다** (P9-04 · 2026-08-07).
 *
 * ★ 여기 있던 표(`{ko, color}`)는 사본이었고 이미 갈라져 있었다: 도감·프리뷰가
 *   "결계"라고 가르친 태그를 보스 HUD 만 "마법저항"이라고 불렀다
 *   (ARMORED·CORRUPT·LIVING 도 같다). 보스 페이즈 전환은 **태그가 바뀌는 것이
 *   곧 규칙**인 자리다 — 거기서 다른 단어를 쓰면 "무엇이 바뀌었는가"를
 *   플레이어가 앞서 배운 것과 연결하지 못한다.
 *
 * ★ 표에 있던 `color` 는 지웠다. **한 번도 그려진 적이 없다** — 배너는
 *   태그 색이 아니라 흰색/주황 두 가지만 쓴다. 색약 관점에서는 잘된 일이고
 *   (이름이 정보를 혼자 진다), 쓰이지 않는 사본은 갈라질 자리일 뿐이다.
 *
 * ★★ React 가 아니므로 `t` 를 직접 부른다. **구독하지 않는다** — 배너 문구는
 *   페이즈 이벤트가 올 때마다 새로 만들어지고, 언어는 전투 밖에서만 바뀐다.
 *   (`t` 는 없는 키에 키 문자열을 돌려주므로, 태그가 하나 늘고 `terms.json` 을
 *   잊으면 배너에 `terms.tag.XXX` 가 그대로 떠서 눈에 띈다 — 침묵이 아니다.)
 */
import { tagLabel } from "../logic/labels.js";
import { t } from "../../i18n/index.js";

const BAR_W = 300;
const BAR_H = 14;

export class BossPresenter {
    /** @param {Phaser.Scene} scene */
    constructor(scene, cameraFx) {
        this.scene = scene;
        this.cameraFx = cameraFx;

        /** 위험 영역·HP 바 등 매 프레임 다시 그리는 것 */
        this.g = scene.add.graphics().setDepth(58);
        /** 배너·라벨 컨테이너 */
        this.banner = scene.add.container(DESIGN.width / 2, 200).setDepth(900).setVisible(false);
        this.tweens = [];

        // 배너 판. 전장 위에 글자만 올리면 픽셀 배경에 묻혀 읽히지 않는다.
        this.bannerBg = scene.add.graphics();
        this.bannerBg
            .fillStyle(0x14101c, 0.92)
            .fillRect(-170, -36, 340, 72)
            .lineStyle(2, 0xd04050, 0.9)
            .strokeRect(-170, -36, 340, 72);
        this.banner.add(this.bannerBg);

        this.bannerTitle = scene.add
            .text(0, -18, "", { fontFamily: PIXEL_FONT, fontSize: "22px", color: "#ffe0a0" })
            .setOrigin(0.5);
        this.banner.add(this.bannerTitle);

        this.bannerTags = scene.add
            .text(0, 12, "", { fontFamily: PIXEL_FONT, fontSize: "14px", color: "#ffffff" })
            .setOrigin(0.5);
        this.banner.add(this.bannerTags);

        /** 예고 중 남은 시간 표시용 */
        this._telegraphUntil = 0;
        this._telegraphFrom = 0;
    }

    /* ── 이벤트 ─────────────────────────────────────────────── */

    /**
     * 페이즈 전환 예고 시작 (EV.MODE_BOSS_PHASE_TELEGRAPH)
     * @param {number} nextPhase 1-based
     */
    onPhaseTelegraph(nextPhase, total, durationMs, nowMs) {
        this._telegraphFrom = nowMs;
        this._telegraphUntil = nowMs + durationMs;

        this.bannerTitle.setText(t("system.bossPhase", { n: nextPhase, total }));
        this.bannerTags.setText(t("system.bossShifting"));
        this.bannerTags.setColor("#ffd0d0");
        this.showBanner();

        // 줌은 "무언가 큰 일이 일어난다"의 가장 싼 신호다
        this.cameraFx?.zoomPulse?.(1.08, 180, durationMs - 360);
    }

    /**
     * 페이즈 확정 (EV.MODE_BOSS_PHASE)
     * ★ 여기서 **새 태그를 반드시 글자로** 보여준다. 색만 바꾸면 읽히지 않는다.
     */
    onPhase(phase, total, tagMask) {
        this._telegraphUntil = 0;

        const names = maskToTags(tagMask);
        const label = names.map((n) => tagLabel(n)).join(" · ");

        this.bannerTitle.setText(t("system.bossPhase", { n: phase, total }));
        this.bannerTags.setText(label || t("system.bossDefenseless"));
        this.bannerTags.setColor(names.length ? "#ffffff" : "#ff9a6a");
        this.showBanner();

        this.cameraFx?.shake?.(5, 220);
        this.cameraFx?.hitStop?.(120);
    }

    /** 슬램 예고 (EV.MODE_BOSS_TELEGRAPH) — sync() 가 sim 에서 직접 읽는다 */

    /** 슬램 착탄 (EV.MODE_BOSS_SLAM) */
    onSlam() {
        this.cameraFx?.shake?.(11, 320);
        this.cameraFx?.hitStop?.(90);
    }

    showBanner() {
        this.banner.setVisible(true).setAlpha(0).setScale(0.85);
        this.killTweens();
        this.tweens.push(
            this.scene.tweens.add({
                targets: this.banner,
                alpha: 1,
                scale: 1,
                duration: 160,
                ease: "Back.easeOut",
                onComplete: () => {
                    this.tweens.push(
                        this.scene.tweens.add({
                            targets: this.banner,
                            alpha: 0,
                            delay: 900,
                            duration: 240,
                            onComplete: () => this.banner.setVisible(false),
                        })
                    );
                },
            })
        );
    }

    /* ── 매 프레임 ──────────────────────────────────────────── */

    /**
     * @param {object} sim
     * @param {number} timeMs 씬 시간 (연출 위상용)
     */
    sync(sim, timeMs) {
        const g = this.g;
        g.clear();

        const bs = sim.modeState?.boss;
        if (!bs || bs.id === -1) return;
        const e = bs.e;
        if (!e || !e.active || e.id !== bs.id || e.hp <= 0) return;

        this.drawHpBar(bs, e, timeMs);
        if (bs.slamPending) this.drawDangerZone(bs, sim, timeMs);
        if (bs.transitionTo >= 0) this.drawTransition(bs, sim);
    }

    /**
     * 보스 HP 바 — **페이즈 경계를 눈금으로 새긴다.**
     * ★ "다음 변신까지 얼마 남았는가"가 보여야 플레이어가 자원을 아낄지
     *   쏟을지 판단할 수 있다. 눈금 없는 긴 HP 바는 정보가 0이다.
     */
    drawHpBar(bs, e, timeMs) {
        const g = this.g;
        const ratio = Math.max(0, e.hp / e.hpMax);
        const x = DESIGN.width / 2 - BAR_W / 2;
        const y = LANES.hud.topH + 16;

        g.fillStyle(0x000000, 0.65).fillRect(x - 2, y - 2, BAR_W + 4, BAR_H + 4);
        g.fillStyle(0x3a1418, 1).fillRect(x, y, BAR_W, BAR_H);
        g.fillStyle(0xd04050, 1).fillRect(x, y, BAR_W * ratio, BAR_H);

        // 페이즈 경계 눈금
        if (bs.phases) {
            for (let i = 1; i < bs.phases.length; i++) {
                const gx = x + BAR_W * bs.phases[i].atRatio;
                g.lineStyle(2, 0xffe0a0, 0.9).lineBetween(gx, y - 3, gx, y + BAR_H + 3);
            }
        }

        g.lineStyle(1, 0xf2d99a, 0.5).strokeRect(x, y, BAR_W, BAR_H);

        // 전환 예고 중에는 바 전체가 점멸한다
        if (bs.transitionTo >= 0) {
            const pulse = 0.25 + 0.4 * Math.abs(Math.sin(timeMs / 90));
            g.fillStyle(0xffffff, pulse).fillRect(x, y, BAR_W, BAR_H);
        }
    }

    /**
     * ★★ 슬램 위험 영역 — 이 게임에서 **회피가 실력이 되는 유일한 지점**이다.
     *
     *   바닥에 그리는 이유: 지휘관을 어디로 뺄지는 좌표 판단이다.
     *   HUD 아이콘으로 "위험!"만 띄우면 어디가 위험한지 알 수 없다.
     *
     *   차오르는 링으로 **남은 시간**까지 같이 보여준다.
     *   "위험하다"만 알려주고 "언제"를 안 알려주면 결국 못 피한다.
     */
    drawDangerZone(bs, sim, timeMs) {
        const g = this.g;
        const y = LANES.ground[bs.slamLane]?.y ?? LANES.air.y;
        const r = this.currentRadius(bs);
        if (r <= 0) return;

        const left = Math.max(0, bs.slamAt - sim.t);
        const total = sim.cfg.modeParams?.slamTelegraphMs ?? 800;
        const p = 1 - Math.min(1, left / total); // 0 → 1 로 차오른다

        // 바깥 테두리 (전체 범위)
        g.lineStyle(3, 0xff5050, 0.9).strokeEllipse(bs.slamX, y, r * 2, r * 0.7 * 2);
        g.fillStyle(0xff3030, 0.14).fillEllipse(bs.slamX, y, r * 2, r * 0.7 * 2);

        // 차오르는 안쪽 (남은 시간)
        g.fillStyle(0xff5050, 0.34).fillEllipse(bs.slamX, y, r * 2 * p, r * 0.7 * 2 * p);

        // 임박하면 점멸
        if (p > 0.75) {
            const pulse = 0.2 + 0.45 * Math.abs(Math.sin(timeMs / 60));
            g.fillStyle(0xffffff, pulse).fillEllipse(bs.slamX, y, r * 2, r * 0.7 * 2);
        }
    }

    currentRadius(bs) {
        const p = bs.phases?.[bs.phaseIndex];
        return p ? p.slamRadius : 0;
    }

    /** 전환 예고 게이지 — 보스 발밑에 남은 시간을 그린다 */
    drawTransition(bs, sim) {
        const g = this.g;
        const e = bs.e;
        const y = LANES.ground[e.lane]?.y ?? LANES.air.y;
        const total = sim.cfg.modeParams?.phaseTelegraphMs ?? 800;
        const left = Math.max(0, bs.transitionAt - sim.t);
        const p = 1 - Math.min(1, left / total);

        const w = 76;
        const x = e.x - w / 2;
        g.fillStyle(0x000000, 0.7).fillRect(x - 1, y + 9, w + 2, 8);
        g.fillStyle(0x40203a, 1).fillRect(x, y + 10, w, 6);
        g.fillStyle(0xffe0a0, 1).fillRect(x, y + 10, w * p, 6);
    }

    /* ── 정리 ───────────────────────────────────────────────── */

    killTweens() {
        for (const t of this.tweens) t?.remove?.();
        this.tweens.length = 0;
    }

    destroy() {
        this.killTweens();
        this.scene.tweens.killTweensOf(this.banner);
        this.g?.destroy();
        this.banner?.destroy(); // 컨테이너가 자식(도형·텍스트)까지 정리한다
        this.g = null;
        this.banner = null;
        this.bannerBg = null;
        this.bannerTitle = null;
        this.bannerTags = null;
    }
}
