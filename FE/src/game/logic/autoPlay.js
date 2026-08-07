/**
 * 결정론적 자동 플레이 정책
 *
 * 용도 두 가지:
 *   1. 헤드리스 밸런스 하네스 (P4) — 사람 없이 수천 판을 돌린다
 *   2. 게임 내 오토 배틀 (스테이지 20 해금)
 *
 * ★ Math.random() 을 쓰지 않는다. 시뮬 RNG 스트림도 건드리지 않는다
 *   (정책이 RNG 를 소비하면 정책 변경이 전투 결과를 바꾼다).
 *   전부 상태에서 유도되는 결정론적 판단이다.
 *
 * ★ '자동 위치' 모드의 목표 효율은 65–75% 다 (밸런스 게이트 B12).
 *   대충 플레이해도 클리어 가능해야 방치·캐주얼 유저를 잃지 않는다.
 *
 * @see docs/02-design/11-core-loop.md §4.1
 */
import { LANE_COUNT } from "./state.js";
import { pickAutoSpell, castSpell } from "./spells.js";
import { trySummon } from "./spawn.js";
import { summonCost } from "./resources.js";

/** 역할별 소환 우선순위 — 방벽이 없으면 아무것도 성립하지 않는다 */
const ROLE_PRIORITY = {
    BLOCKER: 0,
    SIEGE: 1,
    RANGED: 2,
    CASTER: 2,
    MELEE: 3,
    SUPPORT: 4,
    SPECIALIST: 5,
    FLYER: 5,
};

/** 각 레인의 위협도 = 적 HP 합 */
function laneThreat(s, lane) {
    const enemies = s.lanes[lane].enemies;
    let t = 0;
    for (let i = 0; i < enemies.length; i++) t += enemies[i].hp;
    return t;
}

/** 각 레인의 아군 방벽 수 */
function laneBlockers(s, lane) {
    const allies = s.lanes[lane].allies;
    let n = 0;
    for (let i = 0; i < allies.length; i++) {
        if (allies[i].role === "BLOCKER") n++;
    }
    return n;
}

/**
 * 한 틱 분량의 자동 조작.
 * @param {object} s
 * @param {object} [opts] { summonCooldownMs, autoCommander }
 */
export function autoPlayTick(s, opts = {}) {
    const cd = opts.summonCooldownMs ?? 400;
    if (s._autoNextSummonAt === undefined) s._autoNextSummonAt = 0;

    /**
     * ── 지휘관 주문 ──
     *
     * ★★ **하네스가 플레이어와 같은 게임을 재려면 자동 플레이도 주문을 써야 한다.**
     *   안 쓰면 밸런스 게이트는 '주문 없는 게임'의 수치이고 플레이어는 주문 있는
     *   게임을 한다. 이 저장소는 정확히 그 형태의 괴리를 이미 겪었다 —
     *   추천 편성에 로스터 전체를 주고 B4 를 쟀고, 신규 계정은 그 편성을 가질 수 없었다.
     *
     * ★ 발동 판단은 `logic/spells.js:pickAutoSpell` 이 한다. 여기서 임계값을
     *   다시 적으면 사본이 된다.
     * ★ `castSpell` 은 `step()` 안에서만 안전하다 — `autoPlayTick` 자체가
     *   `applyInputs` 로 호출되므로 이 자리가 곧 틱 안이다.
     */
    if (opts.autoSpells !== false) {
        const pick = pickAutoSpell(s);
        if (pick) castSpell(s, pick.id, pick);
    }

    // ── 지휘관: 가장 위협이 큰 레인으로 이동 ──
    if (opts.autoCommander !== false) {
        let worst = 0;
        let worstThreat = -1;
        for (let l = 0; l < LANE_COUNT; l++) {
            const t = laneThreat(s, l);
            if (t > worstThreat) {
                worstThreat = t;
                worst = l;
            }
        }
        s.commander.lane = worst;
        // 전선 약간 뒤에 선다 — 오라가 아군을 덮되 지휘관은 덜 위험한 위치
        const enemies = s.lanes[worst].enemies;
        const front = enemies.length ? enemies[0].x : s.cfg.riftX;
        s.commander.targetX = Math.max(s.cfg.arkX + 80, front - 140);
    }

    if (s.t < s._autoNextSummonAt) return;

    // ── 소환: 방벽 우선, 없으면 우선순위 순 ──
    const loadout = s.cfg.loadout;
    if (!loadout.length) return;

    // 방벽이 가장 부족한 레인
    let targetLane = 0;
    let bestScore = -Infinity;
    for (let l = 0; l < LANE_COUNT; l++) {
        const score = laneThreat(s, l) - laneBlockers(s, l) * 400;
        if (score > bestScore) {
            bestScore = score;
            targetLane = l;
        }
    }

    const needBlocker = laneBlockers(s, targetLane) === 0;

    // 우선순위 → 코스트 오름차순 → id 로 타이브레이크 (결정론)
    const sorted = loadout.slice().sort((a, b) => {
        const pa = needBlocker && a.role === "BLOCKER" ? -1 : (ROLE_PRIORITY[a.role] ?? 9);
        const pb = needBlocker && b.role === "BLOCKER" ? -1 : (ROLE_PRIORITY[b.role] ?? 9);
        if (pa !== pb) return pa - pb;
        const ca = summonCost(s, a.id, a.cost);
        const cb = summonCost(s, b.id, b.cost);
        if (ca !== cb) return ca - cb;
        return a.id < b.id ? -1 : 1;
    });

    for (const def of sorted) {
        /**
         * ★★ **떼 소환을 반복하지 않는다** (2026-08-05). `trySummon` 이 `def.squad`
         *   를 알고 **전부 아니면 0** 으로 처리한다 — 마나가 마릿수분 없으면
         *   아예 소환하지 않는다.
         *
         * ★ 그래서 여기서도 **총액**으로 판단해야 한다. 1마리분만 보고 넘어가면
         *   자동 플레이가 살 수 없는 것을 고르고 그 틱을 통째로 버린다.
         */
        const squad = Math.max(1, Math.floor(def.squad ?? 1));
        if (s.mana < summonCost(s, def.id, def.cost) * squad) continue;
        if (!trySummon(s, def, targetLane)) continue;
        s._autoNextSummonAt = s.t + cd;
        return;
    }
}
