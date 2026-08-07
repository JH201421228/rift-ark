/**
 * 메타 성장 순수 로직 (P5-03/04/08 → 2026-08-04 경량화)
 *
 * ★ Phaser · DOM · Zustand 를 import 하지 않는다.
 *   밸런스 하네스가 이 파일을 그대로 Node 에서 로드해서
 *   "무과금 파워"를 실제 성장 규칙으로 계산하게 만들기 위해서다.
 *   추정치(tools/lib/f2p-power.mjs)와 실제 게임 규칙이 갈라지면
 *   B4 게이트가 거짓말을 하기 시작한다.
 *
 * ★★ **성장 갈래는 셋뿐이다** (2026-08-04 경량화 — docs/02-design/13-progression-meta.md).
 *     동료 레벨 (골드)  … 연속 성장
 *     방주 시설 (골드)  … 레벨 상한 · 전체 파워 · 지휘관 · 각인 선택지
 *     별 트리   (별)    … 스테이지 별점의 유일한 소모처
 *
 *   승급(파편) · 장비(티어/강화) · 소유 효과는 **삭제됐다.** 셋 다 가챠·상점·강화석에
 *   물려 있었고, 그 셋을 걷어내면 재화 없는 UI 만 남는다. 그것들이 담당하던
 *   "이산 계단"은 무기고(armory) 시설이 그대로 승계한다 — meta.json 의 mult 표가
 *   옛 rank×gear 곡선을 따라가므로 스테이지 난이도를 다시 잡을 필요가 없었다.
 *
 * ★ 이 파일에는 난수가 없다. 시설·별 트리 전부 결정론이다.
 *
 * @see docs/02-design/13-progression-meta.md
 */
import balance from "../data/balance.json" with { type: "json" };
import meta from "../data/meta.json" with { type: "json" };

const P = balance.progression;
const A = meta.ark;

export const FACILITIES = A.facilities;
export const FACILITY_BY_ID = Object.fromEntries(A.facilities.map((f) => [f.id, f]));
export const STAR_NODES = meta.starTree.nodes;
export const STAR_NODE_BY_ID = Object.fromEntries(STAR_NODES.map((n) => [n.id, n]));

/* ────────────────────────────── 동료 레벨 ────────────────────────────── */

/** 레벨 lv → lv+1 비용 (골드). 지수 상승이 플레이어 파워를 자연 감속시킨다. */
export function unitLevelCost(level) {
    return Math.round(P.unitLevelCostBase * Math.pow(P.unitLevelCostGrowth, level - 1));
}

/** 훈련장 레벨이 곧 레벨 상한이다 — 방주를 키우지 않으면 동료가 막힌다 */
export function unitLevelCap(trainingYardLevel) {
    const e = FACILITY_BY_ID.trainingYard.effect;
    return e.base + Math.max(0, trainingYardLevel - 1) * e.perLevel;
}

/** 1레벨부터 target 레벨까지의 누적 비용 */
export function cumulativeLevelCost(target) {
    let sum = 0;
    for (let l = 1; l < target; l++) sum += unitLevelCost(l);
    return sum;
}

/**
 * "이 버튼을 누르면 실제로 무슨 일이 일어나는가" (2026-08-05).
 *
 * ★★ 확인 모달이 **치를 값과 도달할 레벨을 숫자로** 말해야 하는데, `+10` 은
 *   상한과 잔액에 걸려 열 번이 다 들어가지 않을 수 있다. 그 계산을 화면이
 *   따로 하면 **스토어의 실제 처리와 갈라진다** — 모달은 "12,400 골드"라고
 *   말하고 실제로는 7,900 만 나가는 식이다.
 *
 * ★ 그래서 계획은 여기 **순수 함수 하나**로 두고, 화면은 이것만 본다.
 *   `rosterSlice.levelUp` 이 같은 규칙(상한 → 잔액 → 1레벨씩)을 따르는지는
 *   `progression.test.js` 가 두 결과를 맞대어 검사한다.
 *
 * @param {number} level 현재 레벨
 * @param {number} cap 레벨 상한 (훈련장)
 * @param {number} gold 보유 골드
 * @param {number} times 누르려는 횟수
 * @returns {{steps: number, cost: number, from: number, to: number, after: number}}
 */
export function levelUpPlan(level, cap, gold, times) {
    let lv = Math.floor(level);
    let left = Math.floor(gold);
    let cost = 0;
    let steps = 0;
    for (let i = 0; i < times; i++) {
        if (lv >= cap) break;
        const c = unitLevelCost(lv);
        if (left < c) break;
        left -= c;
        cost += c;
        lv++;
        steps++;
    }
    return { steps, cost, from: Math.floor(level), to: lv, after: left };
}

/** 예산으로 도달 가능한 최대 레벨 (상한 적용) */
export function levelReachableWith(gold, cap = Infinity) {
    let spent = 0;
    let lvl = 1;
    while (lvl < cap && lvl < 400) {
        const c = unitLevelCost(lvl);
        if (spent + c > gold) break;
        spent += c;
        lvl++;
    }
    return lvl;
}

/* ─────────────────────────── 무기고 (전체 파워) ─────────────────────────── */

/**
 * 무기고 레벨 → 전 동료 ATK/HP 배율.
 *
 * ★★ 표를 코드에 적지 않는다 — `meta.json:ark.facilities[armory].effect.mult` 하나가
 *   출처다. 하네스(`tools/lib/f2p-power.mjs`)도 **같은 표**를 읽는다. 사본을 두는
 *   순간 "화면이 말하는 파워"와 "게이트가 검증한 파워"가 갈라지고, 그 갈라짐은
 *   스테이지 60쯤에서 "무과금은 못 깬다"로만 보고된다.
 *
 * @param {number} level 0 = 미건설
 */
export function armoryMultiplier(level) {
    const table = FACILITY_BY_ID.armory.effect.mult;
    const i = Math.min(table.length - 1, Math.max(0, Math.floor(Number(level) || 0)));
    return table[i];
}

/* ─────────────────────────── 별 트리 (P5-08) ─────────────────────────── */

/** @param {Record<string, number>} tree 노드 id → 보유 랭크 */
export function starsSpent(tree = {}) {
    let sum = 0;
    for (const [id, rank] of Object.entries(tree)) {
        const node = STAR_NODE_BY_ID[id];
        if (!node) continue;
        // 랭크 n 까지의 누적 비용 = cost × (1 + 2 + ... + n) 이 아니라 cost × n.
        // 단순 선형이어야 "몇 별 남았는지"를 플레이어가 암산할 수 있다.
        sum += node.cost * Math.min(rank, node.maxRank);
    }
    return sum;
}

export function starNodeUnlocked(tree, nodeId) {
    const node = STAR_NODE_BY_ID[nodeId];
    if (!node) return false;
    return node.requires.every((r) => (tree?.[r] ?? 0) > 0);
}

/**
 * @returns {{ok: boolean, reason?: string, cost?: number}}
 */
export function canBuyStarNode(tree, nodeId, availableStars) {
    const node = STAR_NODE_BY_ID[nodeId];
    if (!node) return { ok: false, reason: "unknown" };
    const rank = tree?.[nodeId] ?? 0;
    if (rank >= node.maxRank) return { ok: false, reason: "max" };
    if (!starNodeUnlocked(tree, nodeId)) return { ok: false, reason: "locked" };
    if (availableStars < node.cost) return { ok: false, reason: "stars", cost: node.cost };
    return { ok: true, cost: node.cost };
}

/** 별 트리 → 시뮬이 이해하는 평평한 보정값 */
export function starTreeEffects(tree = {}) {
    const out = {
        allyAtkPct: 0,
        allyHpPct: 0,
        allyPierce: 0,
        arkHpPct: 0,
        blockerDefFlat: 0,
        manaRegenPct: 0,
        startManaFlat: 0,
        summonCostPct: 0,
        sigilRerolls: 0,
        sigilOptions: 0,
    };
    for (const [id, rank] of Object.entries(tree)) {
        const node = STAR_NODE_BY_ID[id];
        if (!node) continue;
        const r = Math.min(rank, node.maxRank);
        const e = node.effect;
        if (e.kind in out) out[e.kind] += e.perRank * r;
    }
    return out;
}

/* ─────────────────────────── 방주 시설 ─────────────────────────── */

/**
 * 시설 lv → lv+1 비용.
 *
 * ★ 골드 하나뿐이다. 강화석도 건설 시간도 없앴다 (2026-08-04 경량화) — 시간 게이트는
 *   "내일 다시 오세요"를 만드는 장치였고, 그것은 이 게임이 되지 않기로 한 종류다.
 *
 * @returns {{gold:number} | null} 만렙이면 null
 */
export function arkUpgradeCost(facilityId, level) {
    const f = FACILITY_BY_ID[facilityId];
    if (!f || level >= f.maxLevel) return null;
    const n = Math.max(0, level);
    return { gold: Math.round(f.goldBase * Math.pow(f.goldGrowth, n)) };
}

export function facilityUnlocked(facilityId, highestStage) {
    const f = FACILITY_BY_ID[facilityId];
    return !!f && highestStage >= f.unlockStage;
}

/** 시설 레벨 총합 → 방주 시각 성장 구간 (P5-01) */
export function arkVisualStage(arkLevels = {}) {
    const sum = Object.values(arkLevels).reduce((a, b) => a + (b ?? 0), 0);
    for (const st of A.stages) if (sum <= st.maxLevelSum) return { ...st, sum };
    return { ...A.stages[A.stages.length - 1], sum };
}

/** 방주 성장 구간 → 배회 NPC 수 (성능 예산 12체 상한) */
export function residentCount(arkLevels = {}) {
    const { sum } = arkVisualStage(arkLevels);
    return Math.min(12, Math.floor(sum / 6));
}

/**
 * 기록보관소 레벨 → 각인 드래프트 파라미터.
 * ★ 각인의 '수치'는 절대 올리지 않는다. 선택지 수와 리롤만 늘린다.
 */
export function sigilParamsFrom(archiveLevel, starEffects = {}) {
    const e = FACILITY_BY_ID.archive.effect;
    const options = 3 + e.optionsAt.filter((l) => archiveLevel >= l && l > 0).length;
    const rerolls = 1 + e.rerollsAt.filter((l) => archiveLevel >= l && l > 0).length;
    return {
        draftOptions: options + (starEffects.sigilOptions ?? 0),
        rerolls: rerolls + (starEffects.sigilRerolls ?? 0),
    };
}

/* ─────────────────────────── 최종 파워 합성 ─────────────────────────── */

/**
 * 보유 정보 + 메타 → 시뮬 loadout 슬롯.
 *
 * ★ buildStageConfig 가 먹는 형태({id, level, atkPct, hpPct})로 낸다.
 *   전투 로직은 이 합성 결과만 보고, 성장 규칙 자체는 전혀 알지 못한다.
 *
 * ★ 무기고는 **배율**이고 별 트리는 **가산 %** 다. 곱으로 합치면
 *   `(1 + atkPct)` 한 번의 곱으로 전달되도록 −1 해서 넘긴다.
 */
export function buildLoadoutSlots(unitIds, { owned = {}, defs = {}, starTree = {}, ark = {} } = {}) {
    const star = starTreeEffects(starTree);
    const armory = armoryMultiplier(ark.armory ?? 0);

    return unitIds.filter(Boolean).map((id) => {
        const u = owned[id] ?? { level: 1 };
        return {
            id,
            level: u.level ?? 1,
            atkPct: armory * (1 + star.allyAtkPct) - 1,
            hpPct: armory * (1 + star.allyHpPct) - 1,
            pierce: star.allyPierce,
            // ★ 방어 보정은 여전히 BLOCKER 전용이다. 전 역할에 주면 별 트리 한 노드가
            //   "앞에 세워두면 끝"을 되살린다 (설계 결정 3).
            defFlat: defs[id]?.role === "BLOCKER" ? star.blockerDefFlat : 0,
        };
    });
}
