/**
 * 블로킹 시각화 — "누가 막고 있는가"를 보이게 만든다
 *
 * ★★ **이 게임에서 적을 멈추는 것은 `BLOCKER` 뿐이다.**
 *   근접 유닛도 적을 때리지만 통과는 막지 못한다. 이것이 "방벽 없이 딜러만
 *   편성하면 적이 그냥 걸어서 방주까지 온다"는 구조적 심장이다 (movement.js).
 *
 *   그런데 화면은 이 규칙을 **한 번도 설명하지 않았다.**
 *   그래서 플레이어에게는 "적이 내 근접 유닛을 그냥 통과한다"는 버그로 보인다
 *   (실제 제보). 규칙이 옳아도 읽히지 않으면 버그다.
 *
 *   여기서 두 가지를 그린다:
 *     ① 방벽 ↔ 막힌 적을 잇는 **고정선** — 지금 붙들려 있다는 사실
 *     ② 방벽 발밑 **용량 칸** (●●) — 왜 세 번째 적은 지나갔는지
 *
 *   근접 유닛에는 아무것도 안 그린다. **그 대비가 곧 설명이다.**
 *
 * ★ 시뮬을 읽기만 한다. 규칙을 갖지 않는다.
 *
 * @see docs/02-design/11-core-loop.md §3.3
 */
import { LANES } from "../config.js";
import { LANE_COUNT } from "../logic/state.js";
import { effectiveBlockCount } from "../logic/aura.js";

const GOLD = 0xf2b33d;

export class BlockPresenter {
    /** @param {Phaser.Scene} scene */
    constructor(scene) {
        this.scene = scene;
        this.g = scene.add.graphics().setDepth(45);
    }

    /**
     * @param {object} sim
     * @param {number} timeMs
     */
    sync(sim, timeMs) {
        const g = this.g;
        g.clear();
        if (sim.phase !== "battle") return;

        const cfg = sim.cfg;
        const pulse = 0.55 + 0.25 * Math.sin(timeMs / 220);

        for (let li = 0; li < LANE_COUNT; li++) {
            const { allies, enemies } = sim.lanes[li];
            const y = LANES.ground[li].y;

            for (let ai = 0; ai < allies.length; ai++) {
                const b = allies[ai];
                if (b.role !== "BLOCKER") continue;

                const cap = effectiveBlockCount(b, cfg);
                if (cap <= 0) continue;

                // ── ① 고정선: 이 방벽이 붙들고 있는 적까지 ──
                for (let ei = 0; ei < enemies.length; ei++) {
                    const e = enemies[ei];
                    if (e.blockedBy !== b.id) continue;
                    g.lineStyle(2, GOLD, pulse * 0.8);
                    g.lineBetween(b.x, y - 10, e.x, y - 10);
                    // 적 쪽 끝에 짧은 마감 — 선이 어디서 끝나는지 읽히게
                    g.lineStyle(3, GOLD, pulse);
                    g.lineBetween(e.x, y - 16, e.x, y - 4);
                }

                // ── ② 용량 칸: 가득 차면 다음 적은 지나간다 ──
                const pipW = 5;
                const gap = 3;
                const total = cap * pipW + (cap - 1) * gap;
                let px = b.x - total / 2;
                for (let k = 0; k < cap; k++) {
                    const used = k < b.blocking;
                    g.fillStyle(0x000000, 0.6).fillRect(px - 1, y + 3, pipW + 2, 5);
                    g.fillStyle(used ? GOLD : 0x4a4a2a, 1).fillRect(px, y + 4, pipW, 3);
                    px += pipW + gap;
                }
            }
        }
    }

    destroy() {
        this.g?.destroy();
        this.g = null;
    }
}
