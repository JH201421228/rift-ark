/**
 * 나이트메어 규칙 (P11)
 *
 * ★★ **판정은 여기 하나뿐이다.** 화면 · 프리뷰 · 시뮬 · 검사기가 전부
 *   `nightmareFor(world)` 를 부른다. 화면이 `world === 5` 로 직접 분기하는 순간
 *   규칙의 출처가 둘이 되고, 그때부터 프리뷰가 말하는 규칙과 전투가 거는 규칙이
 *   갈라진다 (`canEnterStage` · `canHitFlying` 과 같은 규약).
 *
 * ★★ **확률이 하나도 없다** (절대규칙 6). 세 규칙 전부 결정론적 술어다:
 *   ① 장판의 (레인 · x · 생성 시각) 은 **사망 이벤트의 함수**이고
 *   ② 파열은 `blockedMs >= holdMs` 라는 **시간의 단조 함수**이며
 *   ③ 고갈은 설정 단계에서 두 배율을 곱하는 것이 전부다.
 *   난수를 하나라도 쓰면 결정론(B1)이 깨지고, 그 순간 나이트메어는
 *   **측정할 수 없는 난이도**가 된다.
 *
 * ★ 수치는 하나도 여기 없다. 전부 `balance.json:difficulty.levels.nightmare.mechanics`
 *   에서 온다 (절대규칙 4).
 *
 * ★ 순수 함수다. Phaser · DOM · Math.random · Date.now 가 없다 (절대규칙 1).
 *
 * ★★ **`state.js` 를 import 하지 않는다.** `createSim` 이 이 파일의
 *   `createPlagueState()` 를 부르므로, 여기서 `LANE_COUNT` 를 가져오면 순환이
 *   생기고 모듈 평가 순서에 따라 TDZ 로 터진다. 필요한 레인 수는 **인자로 받는다.**
 *
 * @see docs/02-design/22-nightmare.md
 */
import balance from "../data/balance.json" with { type: "json" };
import { emit, EV } from "./events.js";
import { commanderUp } from "./commanderHit.js";
// ★ 규칙 이름·요약만 두 언어다. 규칙 **수치**는 언어를 읽지 않는다 (결정론 — 절대규칙 1).
import { pick } from "../../i18n/index.js";

const D = balance.difficulty;
const MECH = D.levels.nightmare.mechanics ?? {};

/**
 * 규칙이 걸리는 난이도 id 목록.
 *
 * ★ 이름을 박지 않고 **데이터에서 파생한다** — "mechanics 를 가진 난이도". 그래야
 *   난이도가 하나 더 늘어도 화면·프리뷰가 `difficulty === "nightmare"` 를 다시
 *   적지 않는다 (`stageConfig.js` 도 같은 판정을 `diff.mechanics` 로 한다).
 */
export const RULE_DIFFICULTIES = Object.freeze(
    D.order.filter((id) => D.levels[id]?.mechanics)
);

/** 이 난이도에 월드별 규칙이 걸리는가 */
export function isNightmareRuleActive(difficulty) {
    return RULE_DIFFICULTIES.includes(difficulty);
}

/**
 * 이 모듈이 **아는** 규칙 id 전부.
 *
 * ★ `tools/validate-data.mjs` 의 N2 가 이 목록과 데이터를 대조한다 —
 *   데이터에만 있는 유령 규칙(적혀 있는데 아무 일도 하지 않는 규칙)을 막는다.
 */
export const NIGHTMARE_IDS = Object.freeze(["plague_bloom", "bond_break", "attrition"]);

/**
 * 레인당 역병 장판 슬롯 상한.
 *
 * ★ `createSim` 이 **난이도와 무관하게 항상** 이만큼의 슬롯을 만든다.
 *   난이도에 따라 구조를 다르게 만들면 시뮬 상태의 히든 클래스가 갈라져
 *   노멀과 나이트메어의 틱 비용을 비교하는 것 자체가 무의미해진다.
 *   슬롯 12개(3레인 × 4)는 엔티티가 아니라 고정 구조체이므로 비용이 0 에 가깝다.
 */
export const PLAGUE_SLOTS_PER_LANE = MECH.plague_bloom?.maxPerLane ?? 0;

/**
 * 이 월드에 걸리는 규칙.
 *
 * @param {number|string} world 월드 번호 (1–5)
 * @returns {{id: string} & Record<string, any> | null}
 */
export function nightmareFor(world) {
    const w = Number(world);
    for (let i = 0; i < NIGHTMARE_IDS.length; i++) {
        const id = NIGHTMARE_IDS[i];
        const m = MECH[id];
        if (!m || !Array.isArray(m.worlds) || !m.worlds.includes(w)) continue;
        // ★ `$` 로 시작하는 키는 이 저장소의 주석 규약이다 — 설정에 싣지 않는다.
        //   전투당 한 번만 부르는 함수라 이 복제는 틱 예산과 무관하다.
        const out = { id };
        for (const k in m) if (k.charCodeAt(0) !== 36) out[k] = m[k];
        return out;
    }
    return null;
}

/**
 * 규칙이 적용될 때의 요약 — 프리뷰·출격 화면이 그대로 출력한다.
 *
 * ★ 문장을 여기서 만들지 않는다. `balance.json` 이 두 언어를 나란히 갖고
 *   (`name: {ko,en}` · `summary: {ko,en}`), 이 함수는 **현재 언어를 고르기만** 한다.
 *
 * ★★ **반환 키에 `Ko` 를 붙이지 않는다** (2026-08-07). 예전 이름은 `nameKo` ·
 *   `summaryKo` 였는데, 값이 더 이상 한국어라는 보장이 없으므로 그 이름은
 *   **거짓말**이다. 별칭을 남기지 않는 이유는 이 저장소의 규약 그대로다 —
 *   남기면 다음 호출부가 옛 이름을 그대로 쓴다.
 *
 * @returns {{id: string, name: string, summary: string} | null}
 */
export function nightmareBrief(world) {
    const m = nightmareFor(world);
    if (!m) return null;
    // ★ 읽는 필드는 `m.name` 과 `m.summary` 이고 둘 다 `{ko, en}` 이다 —
    //   `pick` 은 현재 언어를 고르고, 한쪽이 비면 한국어로 떨어진다.
    return { id: m.id, name: pick(m, "name"), summary: pick(m, "summary") };
}

/* ══════════════════════════════════════════════════════════════
 * ① 역병 장판 — 존 링버퍼
 * ══════════════════════════════════════════════════════════════ */

/**
 * 장판 슬롯 구조체. **엔티티가 아니다.**
 *
 * ★ 레인당 `PLAGUE_SLOTS_PER_LANE` 개를 연속 구간으로 잡는다
 *   (슬롯 인덱스 = `lane * perLane + k`). 그래야 레인별 순회가 탐색 없이 끝나고,
 *   "가장 먼저 만료될 슬롯" 판정의 동점 처리(= 인덱스가 작은 쪽)가 자명해진다.
 *
 * @param {number} laneCount 지상 레인 수 (공중은 장판을 남기지 않는다)
 */
export function createPlagueState(laneCount) {
    const perLane = PLAGUE_SLOTS_PER_LANE;
    const slots = new Array(laneCount * perLane);
    for (let i = 0; i < slots.length; i++) {
        slots[i] = { active: false, lane: 0, x: 0, until: 0 };
    }
    return { laneCount, perLane, slots, nextDamageAt: 0 };
}

/** 이 전투에 역병 장판이 걸려 있는가 */
function plagueOf(s) {
    const m = s.cfg.nightmare;
    return m && m.id === "plague_bloom" ? m : null;
}

/**
 * 적이 죽었다 — 그 자리에 장판을 남긴다.
 *
 * ★ `lifecycle.js:reap` 이 유일한 호출부다. **처치로 죽은 적만** 온다 —
 *   보스 처치 후 잔챙이 정리(`despawnAdds`)는 처치가 아니므로 장판을 남기지 않는다.
 *
 * ★★ **병합할 때 중심을 옮기지 않는다.** 새 시체 쪽으로 평균 내면 장판이 전선을
 *   따라 **아군 쪽으로 기어온다.** 전선은 언제나 방주 쪽으로 밀리므로 그 이동은
 *   한 방향이고, 몇 번의 병합만으로 장판이 방벽 뒤까지 온다.
 *   장판은 **죽은 자리**에 있어야 읽힌다.
 *
 * @param {object} s
 * @param {object} e 죽은 적
 * @param {number} lane 레인 인덱스 (공중 레인이면 아무 일도 하지 않는다)
 */
export function noteNightmareDeath(s, e, lane) {
    const m = plagueOf(s);
    if (!m) return;
    if (e.isAlly) return;
    const z = s.nightmare;
    // 공중 레인은 `laneCount` 밖이다 — 땅에 닿지 않으므로 장판을 남기지 않는다
    if (lane < 0 || lane >= z.laneCount) return;

    const base = lane * z.perLane;
    const until = s.t + m.durationMs;

    // ── ① 병합 · 빈 슬롯 · 최단 만료를 한 번의 순회로 찾는다 (할당 0)
    let free = -1;
    let oldest = base;
    let oldestUntil = z.slots[base].until;
    for (let k = 0; k < z.perLane; k++) {
        const sl = z.slots[base + k];
        if (!sl.active) {
            if (free < 0) free = base + k;
            continue;
        }
        const d = sl.x - e.x;
        if ((d < 0 ? -d : d) <= m.mergeGap) {
            // 기존 슬롯의 **만료 시각만** 연장한다. 중심은 그대로다.
            if (until > sl.until) sl.until = until;
            return; // 갱신은 이벤트 0 (§6.3)
        }
        if (sl.until < oldestUntil) {
            oldestUntil = sl.until;
            oldest = base + k;
        }
    }

    // ── ② 빈 슬롯이 있으면 그것을, 없으면 가장 먼저 만료될 슬롯을 대체한다
    //    (동점이면 인덱스가 작은 쪽 — 위 순회가 `<` 비교라 자동으로 그렇다)
    const idx = free >= 0 ? free : oldest;
    const sl = z.slots[idx];
    sl.active = true;
    sl.lane = lane;
    sl.x = e.x;
    sl.until = until;
    emit(s.events, EV.NIGHTMARE_ZONE, idx, lane, Math.round(e.x), 1);
}

/**
 * 장판 만료 + `tickMs` 마다의 피해.
 *
 * ★★ **피해가 DEF · RES · 실드 · 크리티컬을 전부 무시한다.**
 *   DEF 를 태우면 방벽이 장판에 강해져 **"방벽 세워두기"가 다시 답**이 되는데,
 *   그것이 이 규칙이 죽이려는 바로 그 전략이다.
 *   그리고 `수호의 결계`(다음 2회 피해 무효)의 **횟수를 소모하지 않는다** —
 *   소모하면 0.5초에 두 번 만에 주문이 사라져 12종 중 하나가 이 월드에서 무효가 된다.
 *   그래서 `applyDamage` 를 부르지 않고 여기서 HP 만 깎는다.
 *
 * ★★ **DAMAGE 이벤트를 내지 않는다** (§6.3). 0.5초마다 최대 40 아군에게 동시에
 *   나가므로 틱당 이벤트 p99 ≤ 24 게이트를 그 자리에서 넘긴다.
 *   장판 피해가 눈에 보이는 방법은 **HP 바와 장판 링**이지 숫자가 아니다.
 *
 * ★ 적은 영향을 받지 않는다. 적에게도 주면 **가만히 두는 것이 답**이 되어
 *   게임이 그 자리에서 멈춘다.
 */
export function stepNightmare(s) {
    const m = plagueOf(s);
    if (!m) return;
    const z = s.nightmare;

    // ── 만료 (상태 변화이므로 이벤트를 낸다)
    for (let i = 0; i < z.slots.length; i++) {
        const sl = z.slots[i];
        if (!sl.active || s.t < sl.until) continue;
        sl.active = false;
        emit(s.events, EV.NIGHTMARE_ZONE, i, sl.lane, Math.round(sl.x), 0);
    }

    // ── 피해는 `tickMs` 경계에서만 (15틱에 한 번)
    if (s.t < z.nextDamageAt) return;
    z.nextDamageAt = s.t + m.tickMs;

    const pct = m.dpsPctOfMaxHp * (m.tickMs / 1000);
    const r = m.radius;
    const c = s.commander;
    const cmdUp = commanderUp(s);

    for (let li = 0; li < z.laneCount; li++) {
        const base = li * z.perLane;
        const allies = s.lanes[li].allies;
        for (let k = 0; k < z.perLane; k++) {
            const sl = z.slots[base + k];
            if (!sl.active) continue;
            const lo = sl.x - r;
            const hi = sl.x + r;

            // 구간 시작을 이진 탐색으로 찾는다 (레인 배열은 x 오름차순)
            let a = 0;
            let b = allies.length;
            while (a < b) {
                const mid = (a + b) >> 1;
                if (allies[mid].x < lo) a = mid + 1;
                else b = mid;
            }
            for (let i = a; i < allies.length && allies[i].x <= hi; i++) {
                const u = allies[i];
                u.hp -= u.hpMax * pct;
            }

            // 지휘관 — 오라와 무관하게 **서 있는 것만으로** 깎인다
            if (cmdUp && c.lane === li) {
                const dx = c.x - sl.x;
                if (dx >= -r && dx <= r) c.hp -= c.hpMax * pct;
            }
        }
    }
}

/** 활성 장판 수 — 테스트·프레젠터가 상한을 확인하는 용도 */
export function activePlagueCount(s) {
    const z = s.nightmare;
    if (!z) return 0;
    let n = 0;
    for (let i = 0; i < z.slots.length; i++) if (z.slots[i].active) n++;
    return n;
}
