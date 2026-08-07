/**
 * 지휘관 성장 — 레벨 · 장구 · 성소 (2026-08-05)
 *
 * ★★ **이 게임에서 유일하게 직접 조종하는 존재의 성장이다.** 동료는 소환해 놓으면
 *   알아서 싸우지만 지휘관은 플레이어가 걸어 다니게 한다. 그런데 그 지휘관만
 *   전투 내내 **1레벨 고정**이었다 — 평타 위력도, HP 도, 오라도, 100 스테이지 동안
 *   한 번도 오르지 않았다.
 *
 * ★★ **성소(sanctum) 시설은 그보다 나빴다.** `meta.json` 이 `hpPerLevel 0.04 ·
 *   auraPerLevel 2` 를 정의하고, 화면은 25레벨까지 골드를 받고, 가이드는
 *   "최대 반경 336" 이라고 약속하는데, **그 값을 읽는 코드가 저장소에 없었다.**
 *   골드를 넣으면 숫자만 올라가는 시설이었다. 여기서 그 배선을 함께 잇는다.
 *
 * ★ 순수 함수다 — `Math.random()` · `Date.now()` · DOM 이 없다 (절대 규칙 1).
 * ★ 수치는 하나도 여기 없다 — `data/commander.json` · `data/meta.json` ·
 *   `data/balance.json` 이 정본이다 (절대 규칙 4).
 *
 * @see docs/02-design/21-commander-growth.md
 * @see docs/02-design/20-commander-combat.md §2.1 (사거리 < 오라 반경 부등식)
 */
import DATA from "../data/commander.json" with { type: "json" };
import meta from "../data/meta.json" with { type: "json" };
import balance from "../data/balance.json" with { type: "json" };

const L = DATA.level;

export const COMMANDER_SLOTS = DATA.slots;
export const COMMANDER_ITEMS = DATA.items;
export const COMMANDER_ITEM_BY_ID = Object.fromEntries(DATA.items.map((i) => [i.id, i]));
export const COMMANDER_MAX_LEVEL = L.max;

/** 성소 시설 정의 — 없으면 배선이 끊긴 것이므로 0 효과로 떨어진다 */
const SANCTUM = meta.ark.facilities.find((f) => f.id === "sanctum") ?? null;

/* ────────────────────────────── 레벨 ────────────────────────────── */

/**
 * 레벨 lv → lv+1 비용 (골드).
 * ★ 동료 레벨과 **같은 지수 형태**다. 두 성장이 같은 골드를 놓고 경쟁해야
 *   "누구를 먼저 키울까"가 결정이 된다.
 */
export function commanderLevelCost(level) {
    return Math.round(L.costBase * Math.pow(L.costGrowth, Math.max(0, level - 1)));
}

/** 1레벨부터 target 레벨까지의 누적 비용 (문서·검사기가 쓴다) */
export function commanderCumulativeCost(target) {
    let sum = 0;
    for (let l = 1; l < target; l++) sum += commanderLevelCost(l);
    return sum;
}

/**
 * "이 버튼을 누르면 실제로 무슨 일이 일어나는가" — 동료 레벨업의 `levelUpPlan` 과
 * 같은 규약이다 (화면이 계산을 따로 하면 스토어의 실제 처리와 갈라진다).
 *
 * @returns {{steps:number, cost:number, from:number, to:number, after:number}}
 */
export function commanderLevelPlan(level, gold, times) {
    let lv = Math.floor(level);
    let left = Math.floor(gold);
    let cost = 0;
    let steps = 0;
    for (let i = 0; i < times; i++) {
        if (lv >= L.max) break;
        const c = commanderLevelCost(lv);
        if (left < c) break;
        left -= c;
        cost += c;
        lv++;
        steps++;
    }
    return { steps, cost, from: Math.floor(level), to: lv, after: left };
}

/* ────────────────────────────── 장구 ────────────────────────────── */

/**
 * 이 스테이지를 처음 깰 때 확정 지급되는 장구 id 목록.
 *
 * ★ **확률이 없다.** 어떤 스테이지가 무엇을 주는지는 `commander.json` 에 적혀 있고,
 *   화면이 그것을 미리 보여 줄 수도 있다 (절대 규칙 6 — 확률형 요소 0개).
 *
 * @param {string} stageId
 * @returns {string[]}
 */
export function commanderItemsForStage(stageId) {
    const out = [];
    for (const it of DATA.items) if (it.stage === stageId) out.push(it.id);
    return out;
}

/** 슬롯별 장구 목록 (화면이 쓴다) */
export function itemsOfSlot(slotId) {
    return DATA.items.filter((i) => i.slot === slotId);
}

/* ──────────────────────────── 효과 합산 ──────────────────────────── */

/**
 * 지휘관 보정값 — **레벨 + 장착 장구 + 성소** 를 하나로 합친다.
 *
 * ★ 반환 키는 전부 `stageConfig.js` 가 읽는다. 읽는 곳 없는 키를 만들면
 *   `tools/validate-data.mjs` 가 오류로 잡는다 — 이 저장소가 반복해서 겪은
 *   "선언했는데 아무도 안 쓰는 것"을 여기서는 처음부터 막는다.
 *
 * @param {object} [c] { level, equipped: {slotId: itemId}, sanctum }
 * @returns {{commanderAtkPct:number, commanderAtkSpeedPct:number, commanderHpPct:number,
 *            commanderRespawnPct:number, riftRegenPct:number, spellPowerPct:number,
 *            auraRadiusFlat:number}}
 */
export function commanderEffects(c = {}) {
    const level = Math.max(1, Math.floor(Number(c.level) || 1));
    const sanctum = Math.max(0, Math.floor(Number(c.sanctum) || 0));
    const steps = level - 1;

    const out = {
        /**
         * ★★★ **공격력만 곱셈이다** (2026-08-05). 덧셈이면 만렙에서도 ×2.6 이 천장인데
         *   같은 캠페인에서 동료는 레벨로 ×24 자란다 — 지휘관이 약하게 *설계*된 것이
         *   아니라 **함께 자라지 않았다.** 근거와 계산은 `commander.json:level.$comment`.
         *
         * ★ 여전히 `commanderAtkPct`(비율) 로 내보낸다. 장구·성소가 이 표에 더해지고
         *   `stageConfig` 가 `1 + pct` 로 읽는 규약을 바꾸지 않는다 — 표현만 바뀌고
         *   소비처는 한 줄도 달라지지 않는다.
         * ★ 레벨 1 이면 `steps === 0` 이라 값이 **정확히 0** 이다. 밸런스 하네스는
         *   레벨 1 로 재므로 게이트 수치가 흔들리지 않는다.
         */
        commanderAtkPct: Math.pow(L.atkGrowth, steps) - 1,
        commanderAtkSpeedPct: 0,
        commanderHpPct: steps * L.hpPctPerLevel,
        commanderRespawnPct: 0,
        riftRegenPct: steps * L.riftRegenPctPerLevel,
        spellPowerPct: 0,
        auraRadiusFlat: 0,
    };

    // ── 장착 장구
    const eq = c.equipped ?? {};
    for (const slot of DATA.slots) {
        const item = COMMANDER_ITEM_BY_ID[eq[slot.id]];
        // ★ 슬롯이 맞지 않는 장구는 무시한다 — 손상된 세이브가 무기 칸에 유물을
        //   넣어 두었다고 해서 전투가 다른 규칙으로 돌아가면 안 된다.
        if (!item || item.slot !== slot.id) continue;
        for (const [k, v] of Object.entries(item.effect)) {
            if (k in out) out[k] += v;
        }
    }

    // ── 성소 (방주 시설). 레벨 0 = 미건설 = 보정 0
    if (SANCTUM && sanctum > 0) {
        const e = SANCTUM.effect;
        out.commanderHpPct += sanctum * (e.hpPerLevel ?? 0);
        out.auraRadiusFlat += sanctum * (e.auraPerLevel ?? 0);
    }

    /**
     * ★★ 성소가 미는 반경의 **안전망**이다 (2026-08-05 의미 정정).
     *
     *   `auraRadiusMax` 는 이제 "설계 상한"이 아니라 **실제 도달 가능한 최대치**다
     *   (성소 만렙 → 광역 지휘 3스택). 사용자 결정: 상한을 걸어 각인을 너프하는
     *   대신 **숫자를 사실로 만들었다** — 가이드가 그 값을 그대로 읽어
     *   "최대 반경"이라고 말하기 때문이다.
     *
     *   그러므로 아래 clamp 는 지금 데이터에서는 걸리지 않는다. 남겨 두는 이유는
     *   성소의 `auraPerLevel`·`maxLevel` 이 커졌을 때 **조용히 넘어서지 않게** 하기
     *   위해서이고, 넘어서면 `data:validate` 가 파생값 불일치로 먼저 실패한다.
     */
    const cmd = balance.commander;
    const maxFlat = Math.max(0, (cmd.auraRadiusMax ?? cmd.auraRadius) - cmd.auraRadius);
    if (out.auraRadiusFlat > maxFlat) out.auraRadiusFlat = maxFlat;

    /**
     * ★ 부활 대기 단축은 100% 를 넘을 수 없다. 데이터가 아무리 쌓여도 즉시 부활은
     *   만들지 않는다 — 그러면 지휘관을 죽게 두는 것이 비용 0 이 된다.
     */
    if (out.commanderRespawnPct > 0.6) out.commanderRespawnPct = 0.6;

    return out;
}
