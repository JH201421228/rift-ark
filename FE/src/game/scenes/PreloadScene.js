/**
 * PreloadScene — 부팅 2단계
 *
 * 전역 아틀라스와 메뉴 BGM 을 로드한다.
 * 스테이지별 에셋(세력 아틀라스·보스·배경)은 여기서 받지 않고
 * BattleScene 이 진입 시 지연 로드한다.
 *
 * ★ 프리로드 예산 3MB. 이 숫자가 "콜드 스타트 3초"의 직접 근거다.
 *
 * @see docs/03-tech/23-asset-pipeline.md §6, §7
 */
import Phaser from "phaser";
import { DESIGN, PIXEL_FONT } from "../config.js";
import { assetUrl, atlasUrls, audioUrls } from "../assetUrl.js";
import { installViewport } from "../viewport.js";
import { EventBus, EVT } from "../EventBus.js";
import { gameStore } from "@/store";
// ★ 구독하지 않는 이유는 `BootScene` 머리말과 같다 — 언어는 이 씬보다 먼저 정해진다.
import { t } from "@/i18n";

/** 전역 상주 아틀라스 */
// ★ ui 는 19KB 뿐이고 태그 배지·별이 전 화면에서 쓰이므로 전역 프리로드한다
// ★ bosses 는 44KB(아이들 12프레임)뿐이다. 지연 로드하면 보스 등장 순간에
//   로더가 돌아 프레임이 튀는데, 하필 그 순간이 페이즈 예고를 읽어야 하는
//   구간이다 — 44KB 를 선불로 내는 편이 싸다. (P6-06)
const ATLASES = ["units", "npcs", "fx", "projectiles", "ui", "bosses"];

/** 균일 그리드 시트 (패킹하지 않고 spritesheet 으로 로드) */
const SHEETS = [
    { key: "icons", file: "sheets/icons-32.png", frameWidth: 32, frameHeight: 32 },
    { key: "tiles-main", file: "sheets/tiles-main.png", frameWidth: 16, frameHeight: 16 },
    { key: "tiles-deco", file: "sheets/tiles-deco.png", frameWidth: 16, frameHeight: 16 },
];

export class PreloadScene extends Phaser.Scene {
    constructor() {
        super({ key: "Preload" });
    }

    preload() {
        // ★ 진행 UI 를 그리기 **전에** 뷰포트를 붙인다 — 좌표가 DESIGN 기준이라
        //   이것이 없으면 화면이 넓을수록 왼쪽으로 치우친다 (BootScene 주석 참조).
        installViewport(this);
        this.drawProgressUi();

        for (const name of ATLASES) {
            this.load.atlas(name, ...atlasUrls(name));
        }
        for (const s of SHEETS) {
            this.load.spritesheet(s.key, assetUrl(s.file), {
                frameWidth: s.frameWidth,
                frameHeight: s.frameHeight,
            });
        }

        // 메뉴 BGM 1곡만. 나머지는 씬별 지연 로드.
        this.load.audio("bgm-menu", audioUrls("ncprime-noncopyright-music-pianos-295174"));

        this.load.on("progress", (v) => this.setProgress(v));
        this.load.on("loaderror", (file) => {
            console.error(`[preload] load failed: ${file.key} — ${file.src}`);
        });
    }

    create() {
        // ★ 퍼널 2단계 (P7-04). 16 §4 의 `ms_since_open` 은 여기서만 알 수 있다 —
        //   perf.js 가 index.html 의 window.__t0 부터 재고 있고, 그 값을 그대로 넘긴다.
        //   화면 쪽에서 다시 재면 두 번째 출처가 되고 숫자가 서로 다르게 나온다.
        // ★ 이 플래그를 세운 뒤에야 전투 씬을 시작할 수 있다.
        gameStore.get().setAssetsReady(true);
        EventBus.emit(EVT.SCENE_READY, this);
        // ★ 부팅 뒤의 쉬는 자리는 **빈 씬**이다 (2026-08-04). 예전에는 `Menu`
        //   (P1 파이프라인 검증 쇼케이스)로 갔고, 씬을 바꾸는 화면이 방주·전투뿐이라
        //   출격·편성·동료·설정에서는 그 검증 화면이 UI 뒤에 계속 보였다.
        this.scene.start("Ark");
    }

    /* ── 진행 UI (Graphics 로 직접 그린다 — 에셋 0바이트) ────────── */

    drawProgressUi() {
        const cx = DESIGN.width / 2;
        const cy = DESIGN.height / 2;

        this.add
            .text(cx, cy - 60, t("common.appName"), {
                fontFamily: PIXEL_FONT,
                fontSize: "48px",
                color: "#f2b33d",
            })
            .setOrigin(0.5);

        const barW = 480;
        const barH = 12;
        this.barX = cx - barW / 2;
        this.barY = cy + 30;
        this.barW = barW;
        this.barH = barH;

        this.barBg = this.add.graphics();
        this.barBg.fillStyle(0x1a1a2e, 1).fillRect(this.barX, this.barY, barW, barH);
        this.barBg.lineStyle(2, 0x3a3a5e, 1).strokeRect(this.barX, this.barY, barW, barH);

        this.barFill = this.add.graphics();

        this.pctText = this.add
            .text(cx, this.barY + 40, "0%", {
                fontFamily: PIXEL_FONT,
                fontSize: "20px",
                color: "#8899aa",
            })
            .setOrigin(0.5);
    }

    setProgress(v) {
        // ★ 로더 이벤트는 씬이 정지된 뒤에도 한 번 더 도착할 수 있다.
        if (!this.barFill?.scene) return;
        this.barFill.clear();
        this.barFill
            .fillStyle(0xb45ad6, 1)
            .fillRect(this.barX + 2, this.barY + 2, (this.barW - 4) * v, this.barH - 4);
        this.pctText?.setText(`${Math.round(v * 100)}%`);
    }

    /**
     * ★ 절대 규칙 3. 로더 리스너를 명시적으로 뗀다 — 이 씬은 한 번만 도는 것이
     *   보통이지만, 그 '보통'에 기대는 것이 리스너 중복의 시작이다.
     *   ★ create 전에도 불릴 수 있으므로 절대 던지지 않는다 (`?.`).
     */
    shutdown() {
        this.load?.off("progress");
        this.load?.off("loaderror");
        this.tweens?.killAll();
    }
}
