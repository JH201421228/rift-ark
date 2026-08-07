/**
 * rosterSlice — 보유 동료 · 성장 · 편성 (영속)
 *
 * ★ 이 슬라이스는 '규칙'을 갖지 않는다. game/logic/progression.js 의
 *   순수 함수를 호출하고 결과를 저장할 뿐이다.
 *   규칙이 두 곳에 있으면 밸런스 하네스가 검증하는 것과 플레이어가 겪는 것이 갈라진다.
 *
 * @see docs/02-design/13-progression-meta.md §3
 * @see docs/03-tech/24-data-schema.md §7
 */

import {
    unitLevelCost,
    unitLevelCap,
    buildLoadoutSlots,
    starTreeEffects,
} from "@/game/logic/progression";
import { UNIT_DEFS } from "@/game/logic/stageConfig";
// ★ 지휘관 보정은 규칙 모듈이 합산한다 — 슬라이스는 상태를 넘기기만 한다
import { commanderEffects } from "@/game/logic/commander";
// ★ 편성 화면의 [추천] 과 **같은 함수**다. 빈 편성을 메우는 규칙을 따로 만들면
//   그것이 시작 로스터의 두 번째 출처가 된다 (실제로 그랬다 — BattleScreen.DEFAULT_LOADOUT).
import { recommendLoadout } from "@/game/logic/loadoutAnalysis";
// ★ 신규 계정의 시작 보유는 **확정 지급 규칙이 정한다** (P8-02). 여기 목록을 적지 않는다.
import { guaranteedUnitsUpTo } from "@/game/logic/unlocks";
// ★ 영입 판정도 규칙 모듈이 단일 출처다 (logic/recruit.js).
import { canRecruit } from "@/game/logic/recruit";
import { LANGS, t } from "@/i18n";

/** 편성 슬롯은 6개 고정. ★ 절대 판매하지 않는다. */
export const LOADOUT_SIZE = 6;

/* ═══════════════════ 프리셋 이름 (2026-08-07) ═══════════════════
 *
 * ★★★ **기본 이름을 세이브에 문자열로 적지 않는다.**
 *
 *   예전에는 `emptyPreset("기본")` 이 그대로 디스크에 갔다. 그 순간 그 계정의
 *   프리셋 이름은 **만들어진 날의 언어로 굳는다** — 설정에서 영어로 바꿔도
 *   편성 탭 세 칸만 한국어로 남고, 되돌릴 방법이 이름을 손으로 고치는 것뿐이다.
 *   (같은 사고를 `document.title` 과 `<html lang>` 에서도 겪었다.)
 *
 *   그래서 세이브가 드는 것은 **"이름을 지었는가"라는 사실 하나**(`nameDefault`)
 *   이고, 보이는 글자는 읽을 때마다 카탈로그에서 온다.
 *
 * ★★ `name` 을 `null` 로 비우지 않는다. 프리셋 이름을 그리는 화면이 여럿이고
 *   (`LoadoutScreen` · `StagePreview`) 그들이 `p.name` 을 그대로 출력하므로,
 *   비우면 그 자리가 **빈 탭**이 된다. 대신 `name` 은 언제나 채워 두고,
 *   `nameDefault` 가 참인 것만 언어가 바뀔 때 다시 채운다
 *   (`relocalizePresets` — `store/index.js` 가 `onLangChange` 에 연결한다).
 *
 * ★★ **`SAVE_VERSION` 을 올리지 않았다.** 구세이브의 한국어 기본 이름은
 *   `sanitizePresets` 가 알아본다 — 그 함수는 부팅마다 도는 멱등 위생 단계라
 *   (`HYDRATION_STEPS`) 마이그레이션과 같은 일을 하면서 `migrate.js` 를 만지지
 *   않는다. 지금 이 저장소는 여러 갈래가 동시에 고쳐지는 중이고, 세이브 버전은
 *   한 번에 한 사람만 올릴 수 있다.
 */

/** 기본 프리셋 개수. 세 칸의 **뜻**은 아래 `defaultPresetName` 이 정한다. */
const PRESET_COUNT = 3;

/**
 * i 번째 프리셋의 기본 이름.
 *
 * ★ 세 칸을 넘어가면 번호를 쓴다 — 구버전이 프리셋을 더 만들어 둔 계정을
 *   이름 없는 칸으로 만들지 않는다 (`sanitizePresets` 의 개수 규칙과 짝이다).
 * ★★ 키를 배열에서 꺼내지 않고 **리터럴로 적는다.** `check:i18n` 의 선언 ↔ 소비
 *   대조(I6)는 리터럴 `t("…")` 만 셀 수 있어서, 표에서 꺼내 부르면 이 네 키가
 *   "아무도 부르지 않는 키"로 보고되고 진짜 죽은 키와 구별되지 않는다.
 *
 * @param {number} i
 * @param {string} [lang] 언어를 강제한다 (구세이브 판별이 두 언어를 다 훑는다)
 */
function defaultPresetName(i, lang) {
    switch (i) {
        case 0:
            return t("system.presetBasic", undefined, lang);
        case 1:
            return t("system.presetAntiArmor", undefined, lang);
        case 2:
            return t("system.presetAntiAir", undefined, lang);
        default:
            return t("system.presetN", { n: i + 1 }, lang);
    }
}

/**
 * 구세이브에 적혀 있을 수 있는 기본 이름 전부.
 *
 * ★★ **손으로 적지 않는다** — 카탈로그에서 두 언어를 그대로 뽑는다. 목록을 여기
 *   따로 적으면 문구를 고치는 날 이 그물만 옛 낱말을 들고 남고, 그때부터 구세이브
 *   판별이 조용히 실패한다 (그리고 아무도 실패하지 않는다).
 * ★ 이 목록에 걸리면 "사용자가 지은 이름이 아니다"로 본다. 사용자가 우연히
 *   프리셋을 "Basic" 이라고 지었다면 그 칸이 언어를 따라 움직이게 되지만,
 *   잃는 것은 없다 — 지은 이름과 뜻이 같기 때문이다.
 * ★ 신세이브에는 `nameDefault` 가 있어 이 그물을 아예 지나지 않는다.
 */
const LEGACY_DEFAULT_NAMES = new Set(
    LANGS.flatMap((lang) =>
        Array.from({ length: PRESET_COUNT }, (_, i) => defaultPresetName(i, lang))
    )
);

const emptyPreset = (i) => ({
    name: defaultPresetName(i),
    /** 사용자가 이름을 지었는가 — **이것만 세이브의 진실이다** */
    nameDefault: true,
    units: Array(LOADOUT_SIZE).fill(null),
});

/** 기본 프리셋 3개 — 초기 상태와 정규화가 **같은 목록**을 본다 */
const emptyPresets = () => Array.from({ length: PRESET_COUNT }, (_, i) => emptyPreset(i));

/**
 * 새로 획득한 동료의 초기 상태.
 *
 * ★ export 하는 이유: 세이브 마이그레이션(확정 지급 소급)도 같은 모양을 만들어야
 *   한다. 두 벌을 두면 필드가 하나 늘어난 날 한쪽만 갱신된다.
 *
 * ★★ 필드가 `level` **하나뿐**인 것이 2026-08-04 경량화의 결과다.
 *   `rank` · `shards` · `ownedStep` · `gear` · `gearPlus` 는 승급 · 장비 ·
 *   소유 효과와 함께 사라졌다 (progression.js 상단 참조).
 */
export const blankUnit = () => ({ level: 1 });

/**
 * 신규 계정의 시작 보유 (P8-03).
 *
 * ★★ **예전에는 `{}` 였다 — 신규 계정은 동료를 한 종도 갖지 않았다.**
 *   `logic/unlocks.js` 는 "1-1 을 플레이하는 시점에 시작 2종을 보유한다"를
 *   전제하고(`guaranteedUnitsBefore("1-1")`), `tools/validate-data.mjs` 의
 *   핵심 검사("그 스테이지의 답을 미리 갖고 있는가")도 `tools/playthrough.mjs` 의
 *   완주 판정도 전부 그 전제 위에 서 있다. 그런데 그 전제를 **실제로 참으로
 *   만드는 코드가 어디에도 없었다** — 소급 지급(migrate)은 구세이브에만 돌았다.
 *   결과: 편성 화면 "보유 동료 0종" · 동료 화면 빈 목록 · 전투는
 *   `BattleScreen.DEFAULT_LOADOUT`(하드코딩 6종)으로만 굴러갔고,
 *   편성 화면에 넣을 동료가 하나도 없었다.
 *
 * ★ 목록을 여기 적지 않는다. `guaranteedUnitsUpTo(0)` 은 정의상
 *   "최고 스테이지 0 인 계정이 받았어야 하는 동료" 이고, 그것이 곧 신규 계정이다.
 *   마이그레이션(`store/migrate.js` v13)과 **같은 함수**를 쓰므로
 *   신규 계정과 소급 계정의 시작점이 갈라질 수 없다.
 */
export const startingOwned = () =>
    Object.fromEntries([...guaranteedUnitsUpTo(0)].map((id) => [id, blankUnit()]));

/* ───────────────── 세이브 위생 (P8-05) ─────────────────
 *
 * ★ 여기가 디스크의 바이트와 게임 규칙 사이의 경계다. `logic/progression.js` 가
 *   "레벨은 숫자다"를 가정해도 되도록 만드는 그물이고, 새면 증상이 침묵으로 나온다:
 *   레벨이 NaN 이면 `applyProgression` 의 HP·ATK 가 통째로 NaN 이다.
 */

const isPlainObject = (v) => !!v && typeof v === "object" && !Array.isArray(v);

const intIn = (v, min, max, fallback) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/**
 * 동료 한 칸.
 * ★ 모르는 필드는 **버린다.** 옛 세이브의 `rank`·`gear` 가 남아 있으면
 *   그것은 아무도 읽지 않는 바이트이고, 언젠가 누군가 그것을 읽는 코드를 쓴다.
 */
const sanitizeUnit = (u) => {
    const b = blankUnit();
    if (!isPlainObject(u)) return b;
    return { level: intIn(u.level, 1, Number.MAX_SAFE_INTEGER, b.level) };
};

/**
 * 프리셋 목록.
 *
 * ★ **칸 위치를 보존한다.** 왼쪽으로 몰아 압축하면 플레이어가 배치해 둔 소환 버튼
 *   순서가 업데이트 한 번에 뒤바뀐다 — 손해가 없어 보이지만 근육 기억을 지운다.
 *
 * ★ 프리셋 개수는 **기본 3개 이상으로 유지하되 더 많으면 그대로 둔다.**
 *   신버전이 프리셋을 늘렸다가 구버전으로 내려온 계정의 4번째 편성을 지우지 않는다.
 */
const sanitizePresets = (raw) => {
    const src = Array.isArray(raw) ? raw : [];
    const base = emptyPresets();
    const count = Math.max(base.length, src.length);
    const out = [];
    for (let i = 0; i < count; i++) {
        const p = src[i];
        /**
         * "기본 이름인가"를 정하는 자리.
         *
         * ★ `nameDefault` 가 명시돼 있으면 그것을 믿는다 (신세이브).
         * ★ 없으면 **구세이브**다 — 적혀 있는 이름이 우리가 준 기본 이름 중
         *   하나거나(두 언어) 비어 있으면 기본으로 본다. 그때부터 그 칸은
         *   언어를 따라 움직인다.
         */
        const raw = typeof p?.name === "string" ? p.name.trim() : "";
        const isDefault =
            typeof p?.nameDefault === "boolean"
                ? p.nameDefault
                : !raw || LEGACY_DEFAULT_NAMES.has(raw);
        const name = isDefault ? defaultPresetName(i) : raw;
        const units = Array.isArray(p?.units) ? p.units : [];
        const slots = Array(LOADOUT_SIZE).fill(null);
        const seen = new Set();
        for (let k = 0; k < LOADOUT_SIZE; k++) {
            const id = units[k];
            // ★ 유령 id 를 남기면 `buildStageConfig` 가 던져 출격이 통째로 막힌다.
            if (typeof id !== "string" || !UNIT_DEFS[id] || seen.has(id)) continue;
            seen.add(id);
            slots[k] = id;
        }
        out.push({ ...(isPlainObject(p) ? p : {}), name, nameDefault: isDefault, units: slots });
    }
    return out;
};

export const createRosterSlice = (set, get) => ({
    roster: {
        /** @type {Record<string, {level:number, rank:number, shards:number, ownedStep:number, gear:object, gearPlus:object}>} */
        owned: startingOwned(),
        presets: emptyPresets(),
        activePreset: 0,
    },

    /** 현재 편성 (null 포함 6칸) */
    getLoadout: () => {
        const r = get().roster;
        return r.presets[r.activePreset]?.units ?? Array(LOADOUT_SIZE).fill(null);
    },

    /**
     * 전투에 실제로 나갈 동료 id — 활성 프리셋이 비어 있으면 **보유분에서** 채운다.
     *
     * ★★ 예전에는 `BattleScreen` 이 `DEFAULT_LOADOUT` 이라는 **하드코딩 6종**으로
     *   이 빈칸을 메웠다. 그 목록에는 어떤 경로로도 얻을 수 없는 동료
     *   (`determined_soldier`)가 들어 있었고, 슬롯을 `{id}` 로만 만들어
     *   **레벨·랭크·장비·별 트리가 전부 무시됐다** — 화면에는 "Lv.30 ★4"인데
     *   전투에서는 1레벨로 싸운다. 시작 로스터의 두 번째 출처이기도 했다.
     *
     * ★ 대신 자동 추천(`recommendLoadout`)에 물어본다. 결정론이고, 보유하지 않은
     *   동료를 절대 고르지 않으며, 편성 화면의 [추천] 버튼과 **같은 답**을 낸다.
     *
     * @param {string|null} stageId 위협에 맞춰 고르기 위한 힌트 (없으면 범용)
     */
    getBattleLoadout: (stageId = null) => {
        const s = get();
        const ids = s.getLoadout().filter(Boolean);
        if (ids.length) return ids;
        return recommendLoadout(Object.keys(s.roster.owned), stageId, LOADOUT_SIZE);
    },

    /**
     * 전투에 넘길 슬롯 — 레벨·랭크·장비·소유효과·별 트리가 전부 합성된 형태.
     * ★ 전투를 시작하는 코드가 이 함수 하나만 부르면 되게 한다.
     *   합성을 호출부마다 되풀이하면 "화면에 뜬 파워"와 "실제 전투 파워"가 갈라진다.
     */
    getBattleSlots: (stageId = null) => {
        const s = get();
        return buildLoadoutSlots(s.getBattleLoadout(stageId), {
            owned: s.roster.owned,
            defs: UNIT_DEFS,
            starTree: s.meta.starTree,
            ark: s.meta.ark,
        });
    },

    /**
     * 별 트리 + **지휘관 성장** → 전투 설정 보정값 (2026-08-05).
     *
     * ★★ 두 출처를 **한 봉투에 담아** `buildStageConfig` 로 넘긴다. 지휘관 보정을
     *   별도 인자로 넘기면 호출부(전투 화면 · 하네스 · 테스트)마다 그것을 기억해야
     *   하고, 하나가 잊는 순간 "화면에는 Lv.20 인데 전투에서는 1레벨"이 된다 —
     *   동료 슬롯에서 이미 겪은 사고다.
     * ★ 키가 겹치지 않는다: 별 트리는 `manaRegenPct`·`arkHpPct` 계열,
     *   지휘관은 `commander*`·`auraRadiusFlat`·`spellPowerPct` 계열이다.
     *   `riftRegenPct` 만 지휘관 쪽에 있고 별 트리에는 없다.
     */
    getMetaEffects: () => {
        const s = get();
        return {
            ...starTreeEffects(s.meta.starTree),
            ...commanderEffects({
                level: s.meta.commander?.level ?? 1,
                equipped: s.meta.commander?.equipped ?? {},
                sanctum: s.meta.ark?.sanctum ?? 0,
            }),
        };
    },

    /**
     * 동료 획득.
     *
     * ★ 중복은 **아무 일도 일어나지 않는다.** 예전에는 파편 → 소유 효과 → 강화석
     *   순으로 흡수됐지만 셋 다 사라졌다 (2026-08-04). 확정 지급은 스테이지당
     *   한 번이고 이미 보유한 동료를 다시 주는 경로가 없으므로, 중복은 사고일 뿐이다.
     * @returns {"new"|"duplicate"}
     */
    grantUnit: (unitId) => {
        if (get().roster.owned[unitId]) return "duplicate";
        set((s) => ({
            roster: { ...s.roster, owned: { ...s.roster.owned, [unitId]: blankUnit() } },
        }));
        return "new";
    },

    /**
     * 동료 영입 — 골드로 데려온다 (2026-08-04).
     *
     * ★★ **판정을 여기서 다시 쓰지 않는다.** `logic/recruit.js:canRecruit` 하나가
     *   답하고, 화면도 같은 함수를 부른다. 화면에만 자물쇠를 그리면 다음 호출부가
     *   그대로 통과한다 — 이 저장소가 장비 티어에서 실제로 겪은 사고다.
     *
     * ★ 차감과 지급이 한 액션이다. 나누면 "골드는 빠졌는데 동료가 없다"가 생긴다.
     *
     * @returns {{ok:boolean, reason?:string, cost?:number, at?:number}}
     */
    recruitUnit: (unitId) => {
        const s = get();
        const check = canRecruit({
            unitId,
            owned: s.roster.owned,
            gold: s.meta.currencies.gold,
            highestStage: s.meta.highestStage,
        });
        if (!check.ok) return check;
        if (!s.spendCurrency("gold", check.cost)) return { ok: false, reason: "gold" };
        get().grantUnit(unitId);
        return check;
    },

    setPresetSlot: (presetIndex, slotIndex, unitId) => {
        return set((s) => {
            const presets = s.roster.presets.map((p, i) => {
                if (i !== presetIndex) return p;
                const units = [...p.units];
                // 같은 동료가 두 칸에 들어가지 않게 한다
                const dup = units.indexOf(unitId);
                if (unitId && dup >= 0 && dup !== slotIndex) units[dup] = null;
                units[slotIndex] = unitId;
                return { ...p, units };
            });
            return { roster: { ...s.roster, presets } };
        });
    },

    /**
     * 두 칸을 맞바꾼다 — **드래그 앤 드롭 재배치** (2026-08-05, 사용자 요청).
     *
     * ★ 화면이 `setPresetSlot` 을 두 번 부르지 않게 한다. 두 번 부르면 그 사이에
     *   "같은 동료가 두 칸에 있는" 중간 상태가 실제로 생기고, `setPresetSlot` 의
     *   중복 제거 규칙이 그것을 보고 **한 칸을 비워 버린다** (동료가 사라진다).
     * ★ 빈 칸과의 교환도 허용한다 — 그것이 곧 '이동'이다.
     */
    swapPresetSlots: (presetIndex, a, b) =>
        set((s) => {
            if (a === b) return {};
            const presets = s.roster.presets.map((p, i) => {
                if (i !== presetIndex) return p;
                if (a < 0 || b < 0 || a >= p.units.length || b >= p.units.length) return p;
                const units = [...p.units];
                [units[a], units[b]] = [units[b], units[a]];
                return { ...p, units };
            });
            return { roster: { ...s.roster, presets } };
        }),

    /** 공유 코드·자동 추천이 6칸을 통째로 밀어 넣는다 */
    setPresetUnits: (presetIndex, units) =>
        set((s) => ({
            roster: {
                ...s.roster,
                presets: s.roster.presets.map((p, i) =>
                    i === presetIndex
                        ? { ...p, units: [...units, ...Array(LOADOUT_SIZE).fill(null)].slice(0, LOADOUT_SIZE) }
                        : p
                ),
            },
        })),

    setActivePreset: (i) => set((s) => ({ roster: { ...s.roster, activePreset: i } })),

    /**
     * 프리셋 이름 바꾸기.
     *
     * ★★ 이름을 지우면(빈 문자열) **기본 이름으로 되돌아간다.** 빈 탭을 만들 수
     *   있게 두면 그것이 곧 "탭이 사라진 것처럼 보이는" 결함이고, 되돌릴 방법도
     *   없다. 그리고 되돌아간 칸은 다시 언어를 따라 움직인다.
     */
    renamePreset: (i, name) =>
        set((s) => ({
            roster: {
                ...s.roster,
                presets: s.roster.presets.map((p, k) => {
                    if (k !== i) return p;
                    const trimmed = typeof name === "string" ? name.trim() : "";
                    return trimmed
                        ? { ...p, name: trimmed, nameDefault: false }
                        : { ...p, name: defaultPresetName(k), nameDefault: true };
                }),
            },
        })),

    /**
     * 표시 언어가 바뀌었을 때 **기본 이름만** 다시 채운다.
     *
     * ★★ `store/index.js` 가 `onLangChange` 에 연결한다 — 화면이 부르지 않는다.
     *   화면마다 부르게 하면 "그 화면을 안 거치면 안 바뀐다"가 되고, 편성 탭은
     *   편성 화면 밖(출격 프리뷰)에서도 그려진다.
     * ★ 사용자가 지은 이름은 **절대 건드리지 않는다.**
     * ★ 바뀐 것이 없으면 `set` 을 부르지 않는다 — persist 가 그때마다 디스크를
     *   때리고, 이 함수는 설정 화면에서 언어 버튼을 누를 때마다 돈다.
     */
    relocalizePresets: () =>
        set((s) => {
            const presets = s.roster?.presets;
            if (!Array.isArray(presets)) return {};
            let changed = false;
            const next = presets.map((p, i) => {
                if (!p?.nameDefault) return p;
                const name = defaultPresetName(i);
                if (name === p.name) return p;
                changed = true;
                return { ...p, name };
            });
            return changed ? { roster: { ...s.roster, presets: next } } : {};
        }),

    /* ───────────────────────── 성장 ───────────────────────── */

    /** 레벨업 비용과 가능 여부 (버튼 비활성 판정용) */
    canLevelUp: (unitId) => {
        const s = get();
        const u = s.roster.owned[unitId];
        if (!u) return { ok: false, reason: "unowned" };
        const cap = unitLevelCap(s.meta.ark.trainingYard ?? 0);
        if (u.level >= cap) return { ok: false, reason: "cap", cap };
        const cost = unitLevelCost(u.level);
        if (s.meta.currencies.gold < cost) return { ok: false, reason: "gold", cost };
        return { ok: true, cost, cap };
    },

    levelUp: (unitId, times = 1) => {
        let done = 0;
        for (let i = 0; i < times; i++) {
            const check = get().canLevelUp(unitId);
            if (!check.ok) break;
            if (!get().spendCurrency("gold", check.cost)) break;
            set((s) => {
                const u = s.roster.owned[unitId];
                return {
                    roster: {
                        ...s.roster,
                        owned: { ...s.roster.owned, [unitId]: { ...u, level: u.level + 1 } },
                    },
                };
            });
            done++;
        }
        return done;
    },

    /**
     * 세이브 호환: 구버전 항목에 신규 필드를 채우고 **오염된 값을 복구한다** (멱등).
     *
     * ★★ 예전에는 `Object.entries(s.roster.owned)` 한 줄이었다. `roster` 가 `{}` 인
     *   세이브(부분 결손 · 외부 수정 · 다운그레이드)에서는 `owned` 가 undefined 라
     *   그 줄이 **던졌고**, 그 throw 는 `onRehydrateStorage` 안에서 나므로
     *   하이드레이션 체인 전체가 거기서 죽는다 — `hasHydrated` 가 영원히 false 가 되고
     *   `App.jsx` 의 `if (!hydrated) return null` 때문에 화면이 비어 있다.
     *   **이 함수는 어떤 입력에도 절대 던지지 않는다.**
     *
     * ★★ 그리고 이것이 이 티켓에서 가장 비싼 결함이었다:
     *   **편성에 존재하지 않는 동료 id 가 남아 있으면 `buildStageConfig` 가
     *   "알 수 없는 동료" 로 던져 출격 자체가 막힌다.** 캠페인·던전·탑이 전부
     *   `getLoadout()` 을 지나므로 그 계정은 **아무 전투도 시작할 수 없고**,
     *   화면에는 원인이 한 글자도 뜨지 않는다.
     */
    normalizeRoster: () =>
        set((s) => {
            const r = isPlainObject(s.roster) ? s.roster : {};
            const owned = {};
            // ★ **모르는 id 를 owned 에서 지우지 않는다.** 데이터가 잠깐 빠진 빌드로
            //   계정을 한 번 켠 것만으로 뽑은 동료를 영구히 잃게 만들 수는 없다.
            //   소비하는 쪽(동료 화면 · buildLoadoutSlots)은 이미 정의를 조회해
            //   없으면 건너뛴다 — 남겨도 비용이 없다.
            for (const [id, u] of Object.entries(isPlainObject(r.owned) ? r.owned : {})) {
                owned[id] = sanitizeUnit(u);
            }
            const presets = sanitizePresets(r.presets);
            return {
                roster: {
                    ...r,
                    owned,
                    presets,
                    // 범위를 벗어난 탭 인덱스는 편성 화면을 빈 칸으로 만든다
                    activePreset: Math.min(
                        Math.max(0, Math.floor(Number(r.activePreset)) || 0),
                        presets.length - 1
                    ),
                },
            };
        }),
});
