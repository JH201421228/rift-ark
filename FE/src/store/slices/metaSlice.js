/**
 * metaSlice — 진행도 · 재화 · 방주 · 방치 · 파견 · 별 트리 (영속)
 *
 * ★ 첫 세션에 노출되는 재화는 정확히 3개 (골드·젬·강화석).
 *   나머지는 점진 공개한다.
 *
 * ★ 시각(now)은 항상 인자로 받는다. 슬라이스 안에서 Date.now() 를 부르지 않는다 —
 *   테스트에서 "8시간 뒤"를 즉시 검증할 수 있어야 하고,
 *   나중에 서버 시각으로 갈아끼울 때 호출부만 바꾸면 되게 한다.
 *
 * @see docs/02-design/13-progression-meta.md
 * @see docs/02-design/14-economy-balance.md §1
 */
import {
    arkUpgradeCost,
    facilityUnlocked,
    canBuyStarNode,
    starsSpent,
    starTreeEffects,
    sigilParamsFrom,
    arkVisualStage,
    residentCount,
    FACILITIES,
} from "@/game/logic/progression";
// ★ 확정 지급 규칙은 logic 이 갖는다. 슬라이스는 '언제 부르는가'만 안다.
import { unitGrantsFor } from "@/game/logic/unlocks";
import {
    COMMANDER_ITEM_BY_ID,
    COMMANDER_MAX_LEVEL,
    commanderEffects,
    commanderItemsForStage,
    commanderLevelCost,
} from "@/game/logic/commander";
// ★ 주문 4칸 규칙은 `logic/spells.js` 가 갖는다 — 스토어는 상태만 들고 있는다.
//   화면·스토어·전투가 **같은 함수**를 부르지 않으면 자물쇠가 화면에만 그려진다.
import {
    DEFAULT_LOADOUT as DEFAULT_SPELLS,
    canEquipSpell,
    normalizeSpellLoadout,
    spellsForStage,
} from "@/game/logic/spells";
import {
    DEFAULT_DIFFICULTY,
    difficultyProgress,
    globalStageIndex,
    isDifficultyImplemented,
    isKnownDifficulty,
    stageReward,
    worldOfStage,
} from "@/game/logic/difficulty";
// ★ 캠페인의 마지막 스테이지가 어디인지는 **데이터가 정한다.** 여기 숫자를 적으면
//   월드가 늘어난 날 상한만 옛 값으로 남는다 (P8-05).
// ★ 광고 보상의 규칙은 순수 모듈이 갖는다 — 이 슬라이스는 `Date.now()` 만 담당한다
import { canWatchAd, adBonusGold, recordView, viewsLeft } from "@/game/logic/adReward";
import stagesData from "@/game/data/stages.json";
import balance from "@/game/data/balance.json";
const emptyArk = () =>
    Object.fromEntries(FACILITIES.map((f) => [f.id, f.id === "trainingYard" ? 1 : 0]));

/**
 * 초기 재화 — 초기 상태와 정규화가 **같은 목록**을 본다.
 *
 * ★★ **시작 골드는 데이터가 정한다** (`balance.json:economy.startingGold`).
 *   0 이면 첫 강화를 스테이지 보상만으로는 살 수 없다 —
 *   튜토리얼이 요구하는 행동은 튜토리얼 시점에 가능해야 한다.
 *   하네스(`tools/lib/f2p-power.mjs:availableGold`)도 **같은 값**을 읽는다.
 */
const emptyCurrencies = () => ({ gold: balance.economy.startingGold ?? 0 });

/** 데이터가 정하는 캠페인 마지막 스테이지의 전역 순번 */
const MAX_STAGE_INDEX = stagesData.stages.reduce(
    (m, s) => Math.max(m, globalStageIndex(s.id)),
    0
);

/* ───────────────── 세이브 위생 (P8-05) ─────────────────
 *
 * ★★ 여기가 **디스크의 바이트와 게임 규칙 사이의 경계**다. 아래 함수들은
 *   `logic/` 의 순수 함수가 "숫자는 숫자다"를 가정해도 되도록 만드는 그물이다.
 *   손상·외부수정·다운그레이드 세이브가 실제로 만들어 내는 값들이고, 하나라도
 *   새면 증상이 **크래시가 아니라 침묵**으로 나온다:
 *
 *     highestStage 가 NaN  → `NaN >= 25` 가 false → 던전·탑·시험이 전부 잠긴 것처럼 보인다
 *     stageStars 가 문자열 → `getStars().available` 이 NaN → 별 트리에서 아무것도 못 산다
 *     starTree 랭크가 NaN  → `starTreeEffects` 전 항목이 NaN → 전투 설정이 통째로 NaN
 *     gold 가 음수         → 모든 구매가 영구히 잠긴다 (잔액이 늘어날 방법이 없다)
 *
 *   전부 "앱은 멀쩡한데 진행이 사라진 것처럼 보이는" 모양이고, 그것이 크래시보다 나쁘다.
 */

const isPlainObject = (v) => !!v && typeof v === "object" && !Array.isArray(v);

/** 0 이상 정수. 손상값은 `fallback`. */
const nonNegInt = (v, fallback = 0) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n > 0 ? n : fallback;
};

/** 재화 지갑 — 알 수 없는 재화 키도 **버리지 않는다** (신규 재화가 추가될 수 있다) */
const sanitizeWallet = (raw) => {
    const out = emptyCurrencies();
    if (!isPlainObject(raw)) return out;
    for (const [k, v] of Object.entries(raw)) out[k] = nonNegInt(v, 0);
    return out;
};

/** { 스테이지id: 별 } — 0·음수·손상값은 통째로 뺀다 (없음 == 0 이다) */
const sanitizeStars = (raw) => {
    const out = {};
    if (!isPlainObject(raw)) return out;
    for (const [id, v] of Object.entries(raw)) {
        const n = nonNegInt(v, 0);
        if (n > 0) out[id] = n;
    }
    return out;
};

/**
 * { 난이도: { 스테이지id: 별 } }
 * ★ **모르는 난이도 키를 버리지 않는다.** 신버전에서 나이트메어를 깬 계정이
 *   구버전을 한 번 켠 것만으로 그 별을 영구히 잃으면 안 된다 — 별은 곧 별 트리다.
 */
const sanitizeDifficultyStars = (raw) => {
    const out = {};
    if (!isPlainObject(raw)) return out;
    for (const [d, map] of Object.entries(raw)) out[d] = sanitizeStars(map);
    return out;
};

/** { 노드id: 랭크 } — 모르는 노드는 남긴다 (progression 이 이미 무시한다) */
const sanitizeCounters = (raw) => {
    const out = {};
    if (!isPlainObject(raw)) return out;
    for (const [id, v] of Object.entries(raw)) {
        const n = nonNegInt(v, 0);
        if (n > 0) out[id] = n;
    }
    return out;
};

/** 문자열만 남긴 목록 (도감 · 각인 기록) */
const sanitizeIdList = (raw) =>
    Array.isArray(raw) ? raw.filter((x) => typeof x === "string") : [];

/**
 * 지휘관 성장 (2026-08-05).
 *
 * ★★ **모르는 장구 id 는 지운다.** 동료(`roster.owned`)와 규칙이 반대인 이유:
 *   동료는 정의가 잠깐 빠진 빌드로 한 번 켠 것만으로 영구히 잃을 수 있어 남기지만,
 *   장구는 **효과가 곧 정의**라 정의 없는 id 는 전투에서 아무것도 하지 않는다.
 *   남겨 두면 화면에 '알 수 없는 장구'가 장착된 채 보이고, 그것이 곧 버그 신고다.
 * ★ 장착은 **보유 목록과 슬롯이 모두 맞을 때만** 살린다.
 */
const sanitizeCommander = (raw) => {
    const c = isPlainObject(raw) ? raw : {};
    const level = Math.min(COMMANDER_MAX_LEVEL, Math.max(1, nonNegInt(c.level, 1) || 1));
    const items = sanitizeIdList(c.items).filter((id) => COMMANDER_ITEM_BY_ID[id]);
    const equipped = {};
    if (isPlainObject(c.equipped)) {
        for (const [slot, id] of Object.entries(c.equipped)) {
            const def = COMMANDER_ITEM_BY_ID[id];
            if (def && def.slot === slot && items.includes(id)) equipped[slot] = id;
        }
    }
    /**
     * ★ 주문 4칸도 규칙 모듈이 씻는다 — 모르는 id · 중복 · 초과분 · 잠긴 주문을
     *   버리고, 비면 기본 4종으로 채운다. 여기서 자체 규칙을 만들면 전투가
     *   보는 목록과 갈라진다.
     * ★ 해금 상한을 넘기지 않는 이유: 이 함수는 `highestStage` 를 모른다(정규화
     *   순서상 그 값도 씻기는 중이다). 잠금 판정은 `getBattleSpells` 와
     *   `equipSpell` 이 그때그때 한다 — 저장된 값은 **형태만** 보장한다.
     */
    const spells = normalizeSpellLoadout(sanitizeIdList(c.spells));
    return { level, items, equipped, spells };
};

/**
 * 난이도별 별 기록의 저장 위치.
 *
 * ★ 노멀은 기존 `stageStars` 를 그대로 쓴다. 하나의 `{난이도: {스테이지: 별}}`
 *   구조로 통합하는 편이 예뻐 보이지만, 그러면 **이미 배포된 세이브 전부**를
 *   변환해야 하고 별 트리·시설 해금이 그 변환 하나에 걸린다.
 *   추가 난이도만 새 맵에 넣는 쪽이 마이그레이션 표면적이 훨씬 작다.
 */
const starsMapOf = (meta, difficulty) =>
    (difficulty === DEFAULT_DIFFICULTY ? meta.stageStars : meta.difficultyStars?.[difficulty]) ?? {};

/** logic/difficulty 가 먹는 형태 — { normal: {...}, hard: {...} } */
const starsByDifficulty = (meta) => ({
    [DEFAULT_DIFFICULTY]: meta.stageStars ?? {},
    ...(meta.difficultyStars ?? {}),
});

export const createMetaSlice = (set, get) => ({
    meta: {
        currencies: emptyCurrencies(),

        highestStage: 0,
        /** @type {Record<string, number>} 노멀 난이도 스테이지별 획득 별 (0~3) */
        stageStars: {},
        /**
         * @type {Record<string, Record<string, number>>}
         * 노멀 외 난이도의 스테이지별 별. { hard: { "1-5": 3 } }
         *
         * ★ 하드 별도 별 트리에 들어간다 (13-progression-meta.md §6 —
         *   "재도전이 새로운 도전이어서 노가다가 아니다"). 하드가 별을 안 주면
         *   하드는 골드 파밍장이 되고, 그 순간 이 게임의 리텐션 루프가 사라진다.
         */
        difficultyStars: {},
        /** 스테이지 선택 화면에서 고른 난이도 (기기 설정이 아니라 진행 상태다) */
        selectedDifficulty: DEFAULT_DIFFICULTY,

        ark: emptyArk(),
        /** @type {Record<string, number>} 별 트리 노드 id → 랭크 */
        starTree: {},

        /**
         * 지휘관 성장 (2026-08-05).
         *
         * ★ `level` 은 골드로 오르고, `items` 는 스테이지 확정 지급으로 늘고,
         *   `equipped` 는 슬롯마다 하나를 고른다. 확률은 어디에도 없다.
         * ★ 오라 반경은 여기 없다 — 그것은 **방주 성소**(`ark.sanctum`)의 몫이다.
         *   두 곳이 같은 값을 올리면 플레이어가 무엇이 무엇을 올리는지 알 수 없다.
         */
        commander: {
            level: 1,
            /** @type {string[]} 보유 장구 id */
            items: [],
            /** @type {Record<string, string>} 슬롯 id → 장착한 장구 id */
            equipped: {},
            /**
             * 전투에 들고 나가는 주문 (2026-08-05).
             *
             * ★★ 주문은 **12종인데 4칸**이다. 편성이 50 중 6칸인 것과 같은 규약이다 —
             *   배제가 곧 결정이다 (CLAUDE.md 설계 결정 1).
             * ★ 해금은 스테이지 확정이다 (`spells.json:unlockStage`). 확률 없음.
             * ★ 빈 배열이면 `normalizeSpellLoadout` 이 기본 4종으로 채운다 —
             *   신규 계정이 빈 손으로 전투에 들어가면 균열력이 다시
             *   '쌓이기만 하는 자원'이 된다.
             * @type {string[]}
             */
            spells: [...DEFAULT_SPELLS],
        },

        /**
         * 마지막으로 플레이한 시각 (epoch ms).
         *
         * ★★ **타이틀 화면의 슬롯 목록이 이것만 읽는다** (`store/slots.js`).
         *   슬롯 요약을 따로 저장하지 않는 이유는 그 파일 상단에 있다 — 요약을
         *   두 번째 출처로 두면 "목록에는 45스테이지인데 들어가면 12" 가 된다.
         */
        savedAt: 0,

        /**
         * 출격 일련번호 — **전투 시드의 출처** (2026-08-06, 사용자 제보:
         * "게임을 할 때마다 늘 같은 조합의 각인이 나온다").
         *
         * ★★ 예전 시드는 `1000 + runKey * 7919` 였고 `runKey` 는 전투 화면의
         *   **지역 상태**였다. 화면을 나갔다 들어오면 0 이라 **모든 첫 출격이
         *   시드 1000** 이었다 — 각인 3지선다는 `rng.sigil` 스트림에서 나오므로
         *   매판 같은 순서로 뽑혔다.
         *
         * ★ `Math.random()`·`Date.now()` 를 쓰지 않는다. 시드는 **재현 가능**해야
         *   제보 한 판을 그대로 다시 돌릴 수 있고, 그것이 이 저장소의 결정론
         *   규약(절대 규칙 1)이 화면 밖에서도 유지되는 방식이다.
         * ★ 저장된다 — 세션 변수로 두면 앱을 껐다 켤 때마다 같은 판이 반복된다.
         */
        runSeq: 0,

        /**
         * 보상형 광고 시청 기록 (2026-08-07). `{ day, views, lastAtMs }`.
         *
         * ★★ **`meta` 안에 둔다.** `SAVED_KEYS` 최상위에 키를 하나 더하면
         *   `partialize` · 슬롯 초기화 · 마이그레이션 표면이 전부 늘어난다.
         *   이 값은 계정에 속한 진행 기록이므로 `meta` 가 제 자리이고,
         *   그래서 **`SAVE_VERSION` 을 올릴 필요가 없다** — `runSeq` 가 그랬듯이
         *   정규화 한 줄이 옛 세이브를 채운다 (순수 가산 필드).
         *
         * ★ 규칙은 여기 없다. `logic/adReward.js` 가 하루 경계·상한·쿨다운을 안다.
         */
        ads: { day: 0, views: 0, lastAtMs: 0 },
    },

    /**
     * 다음 출격의 기준 시드를 하나 뽑는다 (단조 증가 · 저장됨).
     *
     * ★ 곱하는 상수는 시드 공간을 흩는 용도다. `rng` 구현이 인접 시드를
     *   비슷하게 다루는 경우를 피한다.
     */
    nextRunSeed: () => {
        const next = (get().meta.runSeq ?? 0) + 1;
        set((s) => ({ meta: { ...s.meta, runSeq: next } }));
        return 1000 + next * 104729;
    },

    /* ───────────────────── 보상형 광고 ───────────────────── */

    /**
     * 광고를 **끝까지 본 뒤** 추가 골드를 지급한다 (2026-08-07).
     *
     * ★★★ **판정을 여기서 다시 한다.** 화면이 이미 `canWatchAd` 로 버튼을 그렸지만,
     *   그 사이에 하루가 넘어갔을 수도 있고 무엇보다 **화면만 막는 자물쇠는
     *   다음 호출부가 그대로 통과한다.** 이 저장소가 영입 카드에서 겪은 사고이고
     *   (`disabled` 는 `pointerdown` 을 막지 못한다), 그래서 규약은 언제나
     *   "화면과 스토어가 같은 함수를 부른다" 이다.
     *
     * ★ 시각은 **호출자가 넘긴다.** `logic/adReward.js` 는 순수해야 하고
     *   (`Date.now()` 금지 — 절대 규칙 1), 그래야 하네스가 하루를 앞뒤로 돌려
     *   상한을 검증할 수 있다. `Date.now()` 를 부르는 것은 이 자리 하나뿐이다.
     *
     * @param {string} stageId
     * @param {number} baseGold 이미 지급된 클리어 보상
     * @returns {{ok: boolean, gold: number, reason?: string, left?: number}}
     */
    claimAdBonus: (stageId, baseGold) => {
        const nowMs = Date.now();
        const tz = new Date().getTimezoneOffset();
        const check = canWatchAd({
            stageId,
            nowMs,
            tzOffsetMin: tz,
            state: get().meta.ads,
            // ★ 광고를 이미 봤으니 준비 여부는 묻지 않는다. 여기서 `ready` 를 다시
            //   물으면 어댑터 상태에 따라 **본 광고의 보상이 사라진다.**
            ready: true,
        });
        if (!check.ok) return { ok: false, gold: 0, reason: check.reason };

        const gold = adBonusGold(baseGold);
        set((st) => ({ meta: { ...st.meta, ads: recordView(st.meta.ads, nowMs, tz) } }));
        if (gold > 0) get().addCurrency("gold", gold);
        return { ok: true, gold, left: viewsLeft(get().meta.ads, nowMs, tz) };
    },

    /* ───────────────────────── 재화 ───────────────────────── */

    addCurrency: (kind, amount) =>
        set((s) => ({
            meta: {
                ...s.meta,
                currencies: {
                    ...s.meta.currencies,
                    [kind]: Math.max(0, (s.meta.currencies[kind] ?? 0) + amount),
                },
            },
        })),

    /** 여러 재화를 한 번에 — "모두 받기"가 set() 을 4번 부르지 않게 한다 */
    addCurrencies: (delta) =>
        set((s) => {
            const cur = { ...s.meta.currencies };
            for (const [k, v] of Object.entries(delta)) {
                if (!v) continue;
                cur[k] = Math.max(0, (cur[k] ?? 0) + v);
            }
            return { meta: { ...s.meta, currencies: cur } };
        }),

    /** @returns {boolean} 잔액 부족이면 false (차감 없음) */
    spendCurrency: (kind, amount) => {
        const cur = get().meta.currencies[kind] ?? 0;
        if (cur < amount) return false;
        get().addCurrency(kind, -amount);
        return true;
    },

    /* ───────────────────────── 진행 ───────────────────────── */

    /**
     * 스테이지 클리어 기록.
     *
     * ★★ **전역 순번은 `difficulty.js:globalStageIndex` 하나가 계산한다** (P8-03).
     *   여기에는 `stageId.split("-").map(Number)` 사본이 있었다. 값이 같아도 사본은
     *   사본이고, 이 사본은 **비캠페인 id 에 대해 NaN 을 만드는 그 경로**였다 —
     *   `recordStageClear("tower-12")` → `[NaN,12]` → `(NaN-1)*20+12 = NaN` →
     *   `Math.max(highestStage, NaN) = NaN` → 방주·난이도·던전·탑·상점 해금이
     *   **전부 무너진 채 세이브에 저장된다.**
     *
     * ★ 지금은 호출부(BattleScreen)가 `isTowerStageId()` 로 분기해서 막고 있지만,
     *   그 분기는 **호출부 하나에만** 있다. 던전·시험·이벤트가 나중에 스테이지
     *   보상 경로를 타는 날 같은 사고가 반복된다. 그래서 여기서도 막는다 —
     *   **캠페인 순번으로 읽히지 않는 id 는 아무것도 기록하지 않는다** (fail-closed).
     *   조용히 0 으로 기록하면 별 기록이 오염되고, throw 하면 결과 화면이 죽는다.
     */
    recordStageClear: (stageId, stars, difficulty = DEFAULT_DIFFICULTY) =>
        set((s) => {
            const globalIndex = globalStageIndex(stageId);
            if (!Number.isFinite(globalIndex) || globalIndex < 1) return s;
            const base = {
                highestStage: Math.max(s.meta.highestStage, globalIndex),
                // ★ 진행이 실제로 일어난 순간이 곧 "마지막 플레이"다
                savedAt: Date.now(),
            };

            if (difficulty === DEFAULT_DIFFICULTY) {
                const prev = s.meta.stageStars[stageId] ?? 0;
                return {
                    meta: {
                        ...s.meta,
                        ...base,
                        stageStars: { ...s.meta.stageStars, [stageId]: Math.max(prev, stars) },
                    },
                };
            }

            const map = s.meta.difficultyStars?.[difficulty] ?? {};
            const prev = map[stageId] ?? 0;
            return {
                meta: {
                    ...s.meta,
                    ...base,
                    difficultyStars: {
                        ...s.meta.difficultyStars,
                        [difficulty]: { ...map, [stageId]: Math.max(prev, stars) },
                    },
                },
            };
        }),

    /* ───────────────────────── 난이도 (P6-10) ───────────────────────── */

    getStageStars: (stageId, difficulty = DEFAULT_DIFFICULTY) =>
        starsMapOf(get().meta, difficulty)[stageId] ?? 0,

    /**
     * `{ normal: {...}, hard: {...} }` — 난이도별 별 기록 **단일 출처.**
     *
     * ★ 이 합성(노멀은 `stageStars`, 나머지는 `difficultyStars`)이 세 곳에 사본으로
     *   있었다: metaSlice 의 모듈 private · trialsSlice._trialCtx · TrialScreen.
     *   지금은 값이 같지만 `difficultyStars` 에 나이트메어가 붙는 날 셋 중 둘만
     *   고쳐지고, 그러면 출격 화면의 "정산 대기 N" 배지와 시험 화면의 카드가
     *   서로 다른 파생을 본다.
     */
    getStarsByDifficulty: () => starsByDifficulty(get().meta),

    /**
     * 해당 월드에서 이 난이도가 열렸는가 + 얼마나 남았는가.
     * @returns {{unlocked:boolean, done:number, total:number}}
     */
    getDifficultyProgress: (difficulty, world) =>
        difficultyProgress(difficulty, world, starsByDifficulty(get().meta)),

    setDifficulty: (difficulty) => set((s) => ({ meta: { ...s.meta, selectedDifficulty: difficulty } })),

    /**
     * 이 스테이지를 **실제로** 시작할 난이도.
     *
     * ★ 선택값을 그대로 믿지 않는다. 월드 2 하드를 골라둔 채 월드 3 스테이지에
     *   들어가면 잠긴 난이도로 전투가 시작되고, 세이브를 손댄 경우에는
     *   미구현 난이도가 그대로 buildStageConfig 까지 내려가 화면이 죽는다.
     *
     * ★★ `requested` 는 **이번 출격에만** 쓰는 난이도다 (돌파 시험). 예전에는
     *   시험 화면이 `setDifficulty("hard")` 로 전역 선택값을 바꾸고 되돌리지 않아,
     *   시험을 한 번 눌러 본 뒤로는 하드가 열린 모든 월드의 캠페인 출격이 조용히
     *   하드로 시작됐다. 검증(구현 여부·해금)은 선택값과 **완전히 같은 경로**를 탄다.
     *
     * @param {string} stageId
     * @param {string} [requested] 이번 출격에만 적용할 난이도 (없으면 선택값)
     */
    resolveDifficulty: (stageId, requested = null) => {
        const d = requested ?? get().meta.selectedDifficulty ?? DEFAULT_DIFFICULTY;
        if (d === DEFAULT_DIFFICULTY) return DEFAULT_DIFFICULTY;
        if (!isDifficultyImplemented(d)) return DEFAULT_DIFFICULTY;
        return get().getDifficultyProgress(d, worldOfStage(stageId)).unlocked
            ? d
            : DEFAULT_DIFFICULTY;
    },

    /**
     * 클리어 보상 지급 + 기록.
     *
     * ★ 지급과 기록을 한 액션에 묶는다. 나눠 두면 "보상은 받았는데 첫 클리어
     *   판정이 안 바뀌어" 첫 클리어 보너스를 무한히 받는 경로가 생긴다 — firstClear 판정은
     *   기록보다 **먼저** 읽혀야 하고, 그 순서를 호출부에 맡기면 언젠가 깨진다.
     *
     * @returns {{gold:number, firstClear:boolean, grantedUnits:string[]}}
     */
    claimStageReward: (stageId, stars, difficulty = DEFAULT_DIFFICULTY) => {
        /**
         * ★★ 비캠페인 id 는 **보상 경로 전체를 타지 않는다** (P8-03).
         *   `recordStageClear` 만 막으면 부족하다 — 그 앞의 `stageReward` 가
         *   `globalStageIndex("tower-12") = NaN` 으로 **NaN 골드**를 만들고,
         *   `addCurrencies` 는 `Math.max(0, 0 + NaN) = NaN` 이라 그것을 잔액에
         *   그대로 넣는다. 진행도 대신 **재화가 통째로 NaN 이 되어** 세이브에 남는다.
         *   막는 자리가 둘인 이유는 두 값(진행도·재화)이 서로 다른 함수에서 오기 때문이다.
         */
        if (!Number.isFinite(globalStageIndex(stageId))) {
            return { gold: 0, firstClear: false, grantedUnits: [] };
        }
        const firstClear = get().getStageStars(stageId, difficulty) === 0;
        const r = stageReward({ stageId, difficulty, firstClear });
        get().recordStageClear(stageId, stars, difficulty);
        get().addCurrency("gold", r.gold);

        /**
         * ★★ **확정 지급 동료** (P8-02). 난이도와 무관하게 **노멀 기준 첫 클리어**에만 준다.
         *
         *   `firstClear` 는 난이도별이므로, 하드로 먼저 깨고 노멀로 또 깨면 두 번 준다.
         *   중복 지급 자체는 `grantUnit` 이 파편으로 흡수해 무해하지만, 그러면
         *   '확정 1회'라는 명제가 깨지고 파편 경제가 난이도 순서에 의존하게 된다.
         *   그래서 **노멀 별 기록**을 기준으로 한 번만 준다.
         *
         *   지급 이유와 시점은 `data/unlocks.json` 이 갖는다 — 여기에는 규칙만 있다.
         */
        const granted = [];
        const grantedItems = [];
        const grantedSpells = [];
        if (get().getStageStars(stageId, DEFAULT_DIFFICULTY) > 0) {
            for (const unitId of unitGrantsFor(stageId)) {
                if (!get().roster.owned[unitId]) {
                    get().grantUnit(unitId);
                    granted.push(unitId);
                }
            }
            /**
             * ★ 지휘관 장구도 **같은 규칙**으로 준다 (2026-08-05) — 노멀 첫 클리어,
             *   확정, 확률 0. 어떤 스테이지가 무엇을 주는지는 `commander.json` 이
             *   갖는다. 동료 지급과 같은 자리에 둔 이유는, 두 지급이 서로 다른
             *   조건을 갖는 순간 "하드로 먼저 깨면 못 받는다" 같은 것이 생기기 때문이다.
             */
            for (const itemId of commanderItemsForStage(stageId)) {
                if (get().grantCommanderItem(itemId)) grantedItems.push(itemId);
            }
            /**
             * ★ 주문 해금도 **같은 자리에서** 알린다 (2026-08-05). 보유 판정 자체는
             *   `highestStage` 파생이라 따로 저장하지 않는다 — 저장하면 그것이
             *   진행도의 두 번째 출처가 되고, 되감기·슬롯 이동에서 갈라진다.
             *   여기서 하는 일은 **결과 화면에 보여줄 목록을 모으는 것**뿐이다.
             */
            for (const spellId of spellsForStage(stageId)) grantedSpells.push(spellId);
        }
        return { ...r, firstClear, grantedUnits: granted, grantedItems, grantedSpells };
    },

    /**
     * 전투 한 판에서 새로 얻은 각인을 **한 번에** 기록한다.
     *
     * ★ 획득마다 set() 을 부르지 않는 이유: 한 판에 여러 번 뜨고, 그때마다 set() 이
     *   돌면 그것이 곧 렌더 폭풍이다 (절대규칙 2). 씬이 로컬 Set 으로 모아 두었다가
     *   전투가 끝날 때 이 액션 하나로 밀어 넣는다.
     *
     * ★ 새로 열린 것이 없으면 set() 자체를 하지 않는다.
     *
     * @param {{sigils?: string[]}} rec
     * @returns {boolean} 무언가 새로 기록되었는가
     */
    recordSigilsFound: (rec = {}) => {
        const sigils = get().meta.sigilsFound ?? [];
        const found = (rec.sigils ?? []).filter((id) => !sigils.includes(id));
        if (!found.length) return false;
        set((s) => ({ meta: { ...s.meta, sigilsFound: [...sigils, ...found] } }));
        return true;
    },

    /* ───────────────────────── 방주 시설 ───────────────────────── */

    getArkVisual: () => arkVisualStage(get().meta.ark),
    getResidentCount: () => residentCount(get().meta.ark),

    /** 각인 드래프트 파라미터 — 기록보관소 + 별 트리 */
    getSigilParams: () => {
        const s = get();
        return sigilParamsFrom(s.meta.ark.archive ?? 0, starTreeEffects(s.meta.starTree));
    },

    /**
     * @returns {{ok:boolean, reason?:string, cost?:object}}
     */
    canUpgradeArk: (facilityId) => {
        const s = get();
        if (!facilityUnlocked(facilityId, s.meta.highestStage)) return { ok: false, reason: "locked" };
        const cost = arkUpgradeCost(facilityId, s.meta.ark[facilityId] ?? 0);
        if (!cost) return { ok: false, reason: "max" };
        if (s.meta.currencies.gold < cost.gold) return { ok: false, reason: "gold", cost };
        return { ok: true, cost };
    },

    /**
     * 업그레이드. **즉시 완료된다** — 건설 시간 게이트는 2026-08-04 경량화로 사라졌다.
     *
     * ★ 시간 게이트는 "내일 다시 오세요"를 만드는 장치였다. 그것은 이 게임이
     *   되지 않기로 한 종류다 (CLAUDE.md 하지 말 것). 골드가 있으면 그 자리에서 오른다.
     *
     * @returns {{ok:boolean, reason?:string}}
     */
    upgradeArk: (facilityId) => {
        const check = get().canUpgradeArk(facilityId);
        if (!check.ok) return check;
        get().addCurrency("gold", -check.cost.gold);
        set((s) => ({
            meta: {
                ...s.meta,
                ark: { ...s.meta.ark, [facilityId]: (s.meta.ark[facilityId] ?? 0) + 1 },
            },
        }));
        return { ok: true };
    },

    /* ───────────────────────── 지휘관 ───────────────────────── */

    /**
     * 레벨업 가능 여부와 비용. **버튼 비활성 사유까지 돌려준다.**
     * @returns {{ok:boolean, reason?:string, cost?:number, max?:number}}
     */
    canLevelUpCommander: () => {
        const s = get();
        const lv = s.meta.commander?.level ?? 1;
        if (lv >= COMMANDER_MAX_LEVEL) return { ok: false, reason: "max", max: COMMANDER_MAX_LEVEL };
        const cost = commanderLevelCost(lv);
        if (s.meta.currencies.gold < cost) return { ok: false, reason: "gold", cost };
        return { ok: true, cost, max: COMMANDER_MAX_LEVEL };
    },

    /**
     * 지휘관 레벨업. `times` 번 시도하되 **상한·잔액에 걸리면 거기서 멈춘다** —
     * 화면의 확인 모달이 보여 주는 `commanderLevelPlan` 과 같은 규칙이다.
     * @returns {number} 실제로 오른 레벨 수
     */
    levelUpCommander: (times = 1) => {
        let done = 0;
        for (let i = 0; i < times; i++) {
            const check = get().canLevelUpCommander();
            if (!check.ok) break;
            if (!get().spendCurrency("gold", check.cost)) break;
            set((s) => ({
                meta: {
                    ...s.meta,
                    commander: { ...s.meta.commander, level: (s.meta.commander?.level ?? 1) + 1 },
                },
            }));
            done++;
        }
        return done;
    },

    /**
     * 장구 확정 지급.
     * ★ 첫 획득이면 **그 슬롯이 비어 있을 때 자동 장착**한다 — 얻었는데 아무 일도
     *   일어나지 않으면 플레이어는 그것을 받은 줄 모른다 (확정 지급 동료가
     *   결과 화면에 안 뜨던 것과 같은 사고).
     * @returns {boolean} 새로 얻었는가
     */
    grantCommanderItem: (itemId) => {
        const def = COMMANDER_ITEM_BY_ID[itemId];
        if (!def) return false;
        if ((get().meta.commander?.items ?? []).includes(itemId)) return false;
        set((s) => {
            const c = s.meta.commander ?? { level: 1, items: [], equipped: {} };
            const equipped = { ...c.equipped };
            if (!equipped[def.slot]) equipped[def.slot] = itemId;
            return {
                meta: { ...s.meta, commander: { ...c, items: [...c.items, itemId], equipped } },
            };
        });
        return true;
    },

    /**
     * 주문 장착 — 한 칸을 바꾼다 (2026-08-05).
     *
     * ★ 판정은 `logic/spells.js:canEquipSpell` 이 한다 (해금 · 중복 · 칸 초과).
     *   화면이 자기 판정을 갖는 순간 "버튼은 잠겼는데 다른 경로로는 들어간다"가 된다.
     *
     * @param {string} id 넣을 주문
     * @param {string|null} [replaceId] 뺄 주문. 없으면 빈 칸에 넣는다
     * @returns {{ok:boolean, reason?:string}}
     */
    equipSpell: (id, replaceId = null) => {
        const s = get();
        const cur = s.meta.commander?.spells ?? [];
        const without = replaceId ? cur.filter((x) => x !== replaceId) : cur;
        const check = canEquipSpell(without, id, s.meta.highestStage);
        if (!check.ok) return check;
        set((st) => ({
            meta: {
                ...st.meta,
                commander: {
                    ...st.meta.commander,
                    spells: normalizeSpellLoadout([...without, id], st.meta.highestStage),
                },
            },
        }));
        return { ok: true };
    },

    /** 한 칸을 비운다 — 셋만 들고 나가는 것도 선택이다 */
    unequipSpell: (id) =>
        set((st) => ({
            meta: {
                ...st.meta,
                commander: {
                    ...st.meta.commander,
                    spells: (st.meta.commander?.spells ?? []).filter((x) => x !== id),
                },
            },
        })),

    /** 전투가 읽는 값 — 화면과 **같은 목록**이어야 한다 */
    getBattleSpells: () => {
        const s = get();
        return normalizeSpellLoadout(s.meta.commander?.spells ?? [], s.meta.highestStage);
    },

    /** 장착 — 보유하지 않은 장구는 무시한다. `itemId` 가 null 이면 해제 */
    equipCommanderItem: (slotId, itemId) => {
        const c = get().meta.commander ?? { items: [], equipped: {} };
        if (itemId && (!c.items.includes(itemId) || COMMANDER_ITEM_BY_ID[itemId]?.slot !== slotId)) {
            return false;
        }
        set((s) => {
            const cur = s.meta.commander;
            const equipped = { ...cur.equipped };
            if (itemId) equipped[slotId] = itemId;
            else delete equipped[slotId];
            return { meta: { ...s.meta, commander: { ...cur, equipped } } };
        });
        return true;
    },

    /** 지휘관 보정값 — 화면(요약 표시)과 전투가 **같은 함수**를 본다 */
    getCommanderEffects: () => {
        const s = get();
        return commanderEffects({
            level: s.meta.commander?.level ?? 1,
            equipped: s.meta.commander?.equipped ?? {},
            sanctum: s.meta.ark?.sanctum ?? 0,
        });
    },

    /* ───────────────────────── 별 트리 ───────────────────────── */

    getStars: () => {
        const s = get();
        // ★ 난이도별로 별을 따로 센다 — 하드 ★3 은 노멀 ★3 위에 **더해진다**.
        //   덮어쓰기로 두면 하드를 깰수록 별이 안 늘어 재도전 동기가 사라진다.
        let earned = Object.values(s.meta.stageStars).reduce((a, b) => a + b, 0);
        for (const map of Object.values(s.meta.difficultyStars ?? {})) {
            earned += Object.values(map).reduce((a, b) => a + b, 0);
        }
        const spent = starsSpent(s.meta.starTree);
        return { earned, spent, available: earned - spent };
    },

    canBuyStar: (nodeId) => canBuyStarNode(get().meta.starTree, nodeId, get().getStars().available),

    buyStarNode: (nodeId) => {
        const check = get().canBuyStar(nodeId);
        if (!check.ok) return false;
        set((s) => ({
            meta: {
                ...s.meta,
                starTree: { ...s.meta.starTree, [nodeId]: (s.meta.starTree[nodeId] ?? 0) + 1 },
            },
        }));
        return true;
    },

    /**
     * 세이브 호환: 구버전에 없던 필드를 채우고 **오염된 값을 복구한다** (멱등).
     *
     * ★★ 예전에는 `?? 기본값` 뿐이라 **키가 있기만 하면 무엇이든 통과했다.**
     *   `meta` 가 통째로 `null` 이면 첫 줄에서 던졌고, 그 throw 는
     *   `onRehydrateStorage` 안에서 나므로 **하이드레이션 체인 전체가 거기서 죽는다**
     *   (zustand 는 `hasHydrated` 를 true 로 만들지 못하고, `App.jsx` 는
     *   `if (!hydrated) return null` 이라 화면이 영원히 비어 있다).
     *   그래서 이 함수는 **어떤 입력에도 절대 던지지 않는다.**
     *
     * ★ meta 는 규칙 모듈이 없어(진행도는 데이터가 아니라 상태다) 여기가 그 자리다.
     */
    normalizeMeta: () =>
        set((s) => {
            const m = isPlainObject(s.meta) ? s.meta : {};
            const ark = {};
            for (const [id, lv] of Object.entries({ ...emptyArk(), ...(isPlainObject(m.ark) ? m.ark : {}) })) {
                ark[id] = nonNegInt(lv, 0);
            }
            // trainingYard 는 1레벨에서 시작한다 — 0 이면 레벨 상한이 0 이 된다
            ark.trainingYard = Math.max(1, ark.trainingYard);

            return {
                meta: {
                    ...m,
                    currencies: sanitizeWallet(m.currencies),
                    // ★ 진행도는 **살린다.** "45" 는 45 로 읽고, 존재하지 않는 스테이지
                    //   번호만 잘라 낸다. 못 읽는 값일 때만 0 이다.
                    highestStage: Math.min(nonNegInt(m.highestStage, 0), MAX_STAGE_INDEX),
                    stageStars: sanitizeStars(m.stageStars),
                    difficultyStars: sanitizeDifficultyStars(m.difficultyStars),
                    // ★ 모르는 난이도가 선택돼 있으면 되돌린다 — 세그먼트 버튼이
                    //   아무것도 안 눌린 상태가 되어 되돌릴 방법이 없어진다.
                    selectedDifficulty: isKnownDifficulty(m.selectedDifficulty)
                        ? m.selectedDifficulty
                        : DEFAULT_DIFFICULTY,
                    ark,
                    savedAt: nonNegInt(m.savedAt, 0),
                    /**
                     * ★ 옛 세이브에는 없는 필드다 — 없으면 0 에서 시작한다.
                     *   순수 가산 필드이므로 `migrate` 단계가 필요 없고, 여기 한 줄이
                     *   그 역할을 한다 (모양 보장은 정규화의 몫이다).
                     */
                    runSeq: nonNegInt(m.runSeq, 0),
                    /**
                     * ★ 광고 시청 기록도 옛 세이브에는 없다. `runSeq` 와 같은 규약 —
                     *   모양만 보장하고 `migrate` 를 늘리지 않는다.
                     * ★★ 값이 손상돼 있어도(문자열·null·음수) **광고를 더 볼 수 있는
                     *   쪽**이 아니라 **초기 상태**로 떨어진다. 상한은 안전 장치이므로
                     *   손상이 상한을 푸는 방향으로 작동하면 안 된다.
                     */
                    ads: {
                        day: nonNegInt(m.ads?.day, 0),
                        views: nonNegInt(m.ads?.views, 0),
                        lastAtMs: nonNegInt(m.ads?.lastAtMs, 0),
                    },
                    starTree: sanitizeCounters(m.starTree),
                    sigilsFound: sanitizeIdList(m.sigilsFound),
                    commander: sanitizeCommander(m.commander),
                },
            };
        }),
});
