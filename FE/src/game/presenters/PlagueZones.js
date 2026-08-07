/**
 * 역병 장판 시각화 — 나이트메어 ① (P11-06)
 *
 * ★★ **장판 피해는 숫자로 보이지 않는다** (22-nightmare.md §6.3). 0.5초마다 최대
 *   40 아군에게 동시에 나가므로 DAMAGE 이벤트를 내면 틱당 이벤트 예산(p99 ≤ 24)을
 *   그 자리에서 넘긴다. 그래서 시뮬은 **슬롯의 상태 변화만** 알리고, 플레이어가
 *   "왜 내 유닛이 녹는가"를 읽는 통로는 **HP 바와 이 장판**뿐이다.
 *   → 이 파일이 읽히지 않으면 그 규칙은 화면에서 **원인 없는 피해**가 된다.
 *
 * ★★★ **`Graphics` 는 하나다.** 26 §10-A.4 의 교훈 — 엔티티마다 Graphics 를 만들면
 *   그 수만큼 배치가 끊긴다. 12구간을 한 객체에 그린다.
 *
 * ★★ **이펙트 풀을 쓰지 않는다.** 저사양 티어의 동시 이펙트 예산은 12 이고,
 *   장판이 그것을 통째로 먹으면 전투 이펙트(피격·처치·주문)가 통째로 사라진다.
 *   "새 연출을 넣었더니 기존 연출이 없어졌다"가 정확히 이 저장소가 피하려는 모양이다.
 *
 * ★ 시뮬을 읽기만 한다. 규칙을 갖지 않는다 — 슬롯의 활성 여부·중심·만료 시각은
 *   전부 `logic/nightmare.js` 가 정한다.
 *
 * @see docs/02-design/22-nightmare.md §2 · §6
 */
import { LANES } from "../config.js";

/** 역병 색 — 세계관의 부패/독 계열 (fx.json 의 worldTint 와 같은 계열) */
const PLAGUE = 0x7fc24a;
const PLAGUE_DARK = 0x2f5a1e;

export class PlagueZones {
    /** @param {Phaser.Scene} scene */
    constructor(scene) {
        this.scene = scene;
        // ★ 방벽 시각화(depth 45)보다 아래, 배경보다 위 — 유닛을 가리지 않는다
        this.g = scene.add.graphics().setDepth(38);
    }

    /**
     * @param {object} sim
     * @param {number} timeMs 씬 시간 (맥동에만 쓴다 — 규칙과 무관하다)
     */
    sync(sim, timeMs) {
        const g = this.g;
        g.clear();

        const z = sim.nightmare;
        // ★ 구조체는 난이도와 무관하게 항상 있다. 규칙이 안 걸렸으면 슬롯이 전부 꺼져 있다.
        if (!z || sim.phase !== "battle") return;

        const pulse = 0.5 + 0.18 * Math.sin(timeMs / 260);
        const radius = sim.cfg.nightmare?.radius ?? 0;
        if (radius <= 0) return;

        const slots = z.slots;
        for (let i = 0; i < slots.length; i++) {
            const sl = slots[i];
            if (!sl.active) continue;
            const y = LANES.ground[sl.lane]?.y;
            if (y === undefined) continue;

            /**
             * 남은 수명으로 옅어진다 — **언제 사라지는지가 읽혀야** 플레이어가
             * "여기를 피해 다시 세운다"를 계획할 수 있다. 값은 시뮬이 갖고 있으므로
             * 여기서 시간을 세지 않는다.
             */
            const left = Math.max(0, Math.min(1, (sl.until - sim.t) / 1200));
            const a = pulse * (0.35 + 0.65 * left);

            // 바닥 구간 — 레인은 1차원이므로 장판도 1차원 구간이다
            g.fillStyle(PLAGUE_DARK, a * 0.55);
            g.fillRect(sl.x - radius, y + 6, radius * 2, 16);
            g.fillStyle(PLAGUE, a * 0.35);
            g.fillRect(sl.x - radius, y + 10, radius * 2, 8);
            // 양 끝 경계선 — "어디부터 밟는 것인가"가 정확히 보여야 한다
            g.lineStyle(2, PLAGUE, a);
            g.lineBetween(sl.x - radius, y - 6, sl.x - radius, y + 22);
            g.lineBetween(sl.x + radius, y - 6, sl.x + radius, y + 22);
        }
    }

    destroy() {
        this.g?.destroy();
        this.g = null;
    }
}
