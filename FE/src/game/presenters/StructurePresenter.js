/**
 * 방주(아군 기지) · 균열(적 스폰) 표현
 *
 * ★ 이 둘은 **전장의 양 끝을 정의하는 물체**다. 도형으로 두면 화면이
 *   "왼쪽 갈색 막대 ↔ 오른쪽 보라 선" 사이의 추상 공간처럼 보인다.
 *   여기에 실루엣이 들어가야 전장이 장소가 된다.
 *
 * ★★ **방주는 HP 를 스스로 말한다.**
 *   상단 HP 바는 숫자고, 이쪽은 상태다. 방주가 불타기 시작하면
 *   바를 안 봐도 위급하다는 것이 읽힌다 — 시선이 전장에 머문 채로.
 *   상태 전환은 100 → 66 → 33 세 단계뿐이다 (아트 브리프 §3).
 *
 * ★ 균열은 8프레임 스트립이며 템포 시프트에서 `expanded` 로 바뀐다.
 *   "적이 더 세게 온다"를 문자 배지가 아니라 스폰 지점 자체가 알린다.
 *
 * ★ 텍스처가 없으면(패킹 전) 조용히 도형으로 떨어진다.
 *
 * @see docs/05-art-briefs/40-image-production-brief.md §3, §4
 */
import { DESIGN, LANES } from "../config.js";
import { assetUrl } from "../assetUrl.js";

const ARK_STATES = [100, 66, 33];
const RIFT_STATES = ["idle", "expanded"];

/** 균열 스트립 규격 — 가로 8프레임 */
const RIFT_FRAMES = 8;
const RIFT_FPS = 10;

export const arkKey = (state) => `ark-${state}`;
export const riftKey = (state) => `rift-${state}`;

/** 씬 preload 에서 호출 */
export function preloadStructures(scene) {
    for (const s of ARK_STATES) {
        if (!scene.textures.exists(arkKey(s))) {
            scene.load.image(arkKey(s), assetUrl(`structures/ark-${s}.png`));
        }
    }
    // 균열은 스트립 → spritesheet. 프레임 크기는 로드 후에야 알 수 있으므로
    // 파일 규격(가로 8프레임)에서 역산한다.
    for (const s of RIFT_STATES) {
        const k = riftKey(s);
        if (scene.textures.exists(k)) continue;
        scene.load.spritesheet(k, assetUrl(`structures/rift-${s}.png`), {
            frameWidth: s === "idle" ? 192 : 256,
            frameHeight: s === "idle" ? 480 : 560,
        });
    }
}

export class StructurePresenter {
    /** @param {Phaser.Scene} scene */
    constructor(scene) {
        this.scene = scene;
        this.ark = null;
        this.rift = null;
        this.arkState = 100;
        this.riftState = "idle";
        this.fallback = null;

        this.useArt =
            ARK_STATES.every((s) => scene.textures.exists(arkKey(s))) &&
            RIFT_STATES.every((s) => scene.textures.exists(riftKey(s)));

        if (this.useArt) this.buildArt();
        else this.buildFallback();
    }

    buildArt() {
        const top = LANES.hud.topH;
        const bottom = DESIGN.height - LANES.hud.bottomH;
        const midY = (top + bottom) / 2;

        // ★ 방주: 160×480 이고 전장 세로가 정확히 480(80~560) 이다.
        //   **오른쪽 면이 정면**이므로 우측 끝을 arkX 에 맞춘다 (브리프 §3).
        //   왼쪽 64px 은 화면 밖으로 나가지만, 그래야 '벽 안쪽이 내 진영'이 된다.
        this.ark = this.scene.add
            .image(LANES.arkX, bottom, arkKey(100))
            .setOrigin(1, 1)
            .setDepth(40);

        // ★ 균열: 192 폭을 riftX(1184) 중심에 두면 1088~1280 으로 화면 오른쪽
        //   끝에 정확히 맞는다. 세로는 전장 중앙 정렬 — expanded(560)가
        //   위아래로 넘치며 커지는 것이 '격렬해졌다'로 읽힌다.
        this.rift = this.scene.add
            .sprite(LANES.riftX, midY, riftKey("idle"))
            .setOrigin(0.5, 0.5)
            .setDepth(40);

        for (const s of RIFT_STATES) {
            const animKey = `rift-anim-${s}`;
            if (this.scene.anims.exists(animKey)) continue;
            this.scene.anims.create({
                key: animKey,
                frames: this.scene.anims.generateFrameNumbers(riftKey(s), {
                    start: 0,
                    end: RIFT_FRAMES - 1,
                }),
                frameRate: RIFT_FPS,
                repeat: -1,
            });
        }
        this.rift.play("rift-anim-idle");
    }

    buildFallback() {
        const top = LANES.hud.topH;
        const bottom = DESIGN.height - LANES.hud.bottomH;

        const g = this.scene.add.graphics().setDepth(40);
        g.fillStyle(0x3a3020, 1).fillRect(LANES.arkX - 48, top, 48, bottom - top);
        g.lineStyle(3, 0xf2b33d, 0.9).lineBetween(LANES.arkX, top, LANES.arkX, bottom);
        g.lineStyle(4, 0xb45ad6, 0.9).lineBetween(LANES.riftX, top, LANES.riftX, bottom);
        g.fillStyle(0xb45ad6, 0.08).fillRect(
            LANES.riftX,
            top,
            DESIGN.width - LANES.riftX,
            bottom - top
        );
        this.fallback = g;
    }

    /**
     * @param {object} sim
     * ★ 매 프레임 불려도 **상태가 바뀔 때만** 텍스처를 교체한다.
     *   setTexture 를 매 프레임 부르면 배치가 깨진다.
     */
    sync(sim) {
        if (!this.useArt) return;

        const ratio = sim.arkHpMax > 0 ? sim.arkHp / sim.arkHpMax : 0;
        const state = ratio > 0.66 ? 100 : ratio > 0.33 ? 66 : 33;
        if (state !== this.arkState) {
            this.arkState = state;
            this.ark.setTexture(arkKey(state));
        }

        const rs = sim.tempoShifted ? "expanded" : "idle";
        if (rs !== this.riftState) {
            this.riftState = rs;
            this.rift.play(`rift-anim-${rs}`);
        }
    }

    destroy() {
        this.ark?.destroy();
        this.rift?.destroy();
        this.fallback?.destroy();
        this.ark = null;
        this.rift = null;
        this.fallback = null;
    }
}
