/**
 * 스테이지 프리뷰 — 적 태그 집계 · 경고 · 추천 편성 (P6-09)
 *
 * ★ 이 게임의 벽은 "숫자가 모자란 벽"이 아니라 **편성 퍼즐**이어야 한다 (CLAUDE.md §5).
 *   퍼즐이 성립하려면 **전투에 들어가기 전에** 무엇이 오는지 보여야 한다.
 *   비행이 절반인 스테이지에 지상 편성으로 들어가 3번 지고 나서야 깨닫는 것은
 *   난이도가 아니라 정보 은닉이다.
 *
 * ★ 추천 편성은 **밸런스 하네스가 검증하는 그 편성과 같은 함수**여야 한다.
 *   `tools/lib/loadouts.mjs` 가 이 파일을 재수출한다. 두 곳에 같은 로직을 두면
 *   "게이트 B4 는 통과했는데 게임 안 추천은 다른 편성" 이라는 조용한 괴리가 생기고,
 *   그 순간 하네스 수치가 플레이어 경험을 대변하지 못한다.
 *
 * ★ 여기에는 난수가 없다. 같은 스테이지는 항상 같은 집계 · 같은 경고 · 같은 추천을 낸다.
 *
 * @see docs/04-plan/33-execution-plan.md P6-09
 * @see docs/02-design/11-core-loop.md §3 (태그 상성)
 */
import enemiesData from "../data/enemies.json" with { type: "json" };
import stagesData from "../data/stages.json" with { type: "json" };
import { UNIT_DEFS } from "./stageConfig.js";
import { SEVERITY } from "./loadoutAnalysis.js";
import { TAG } from "./tags.js";
import { ROLE_ORDER, usesProjectile } from "./roles.js";
// ★ '공중에 닿는가'는 전투 규칙이다. 사본을 만들면 시뮬과 추천이 갈라진다.
import { canHitFlying } from "./combat.js";
// ★ 나이트메어 규칙 배지도 같은 규약이다 — 화면이 월드 번호로 분기하지 않는다.
import { isNightmareRuleActive, nightmareBrief } from "./nightmare.js";
import { DEFAULT_DIFFICULTY, worldOfStage } from "./difficulty.js";
// ★★ 경고 문구는 두 언어를 `i18n/messages/rules.json` 이 갖는다 — 코드는 값만 채운다.
import { t, pick } from "../../i18n/index.js";

const ENEMY = Object.fromEntries(enemiesData.enemies.map((e) => [e.id, e]));

/** 편성 슬롯 수. ★ store 를 import 할 수 없으므로(순수 시뮬 격리) 여기서 상수로 둔다. */
export const RECOMMEND_SIZE = 6;

/**
 * 상성 답을 넣고 **남은 칸**을 채우는 순서.
 *
 * ★ 화력(원거리·근접) 먼저, 방벽은 맨 뒤다 — 방벽 2기는 이미 앞에서 확보하므로
 *   여기서 또 뽑히면 벽만 늘어난다.
 * ★ 역할 목록 자체는 `roles.js` 에서 온다. 손으로 적으면 사본이 갈라진다 —
 *   실제로 `loadoutAnalysis.js` 사본에 FLYER 가 빠져 편성 화면에서
 *   비행 동료 2종이 통째로 사라진 적이 있다.
 */
const FILL_FIRST = ["RANGED", "MELEE", "CASTER", "SUPPORT", "SIEGE", "FLYER"];
export const RECOMMEND_FILL_ORDER = [
    ...FILL_FIRST.filter((r) => ROLE_ORDER.includes(r)),
    // roles.js 에 새 역할이 생기면 여기 적지 않아도 자동으로 뒤에 붙는다
    ...ROLE_ORDER.filter((r) => !FILL_FIRST.includes(r)),
];

/**
 * 태그 표시 순서 — **상성에 직결되는 것부터**.
 * ARMORED/WARDED/FLYING 은 "무엇을 넣어야 하는가"를 바꾸고,
 * CORRUPT/LIVING 은 배율만 움직이며, SWARM/SHIELDED/REGEN 은 화력 형태를 바꾼다.
 */
export const PREVIEW_TAG_ORDER = [
    "ARMORED",
    "WARDED",
    "FLYING",
    "CORRUPT",
    "LIVING",
    "SWARM",
    "SHIELDED",
    "REGEN",
];

/* ══════════════════════════ 경고 규칙 테이블 ══════════════════════════
 *
 * ★ 경고 문구를 조건문 사이에 흩뿌리지 않는다. 한 곳에 모아야
 *   (1) 문구를 고치는 사람이 로직을 읽지 않아도 되고
 *   (2) "이 태그에 대한 안내가 있는가"를 테스트가 한 번에 검사할 수 있다.
 *
 * 한 태그에 여러 규칙이 걸리면 **먼저 오는 것 하나만** 낸다.
 * 같은 태그로 치명·경고를 동시에 띄우면 둘 다 읽히지 않는다.
 *
 * minShare — 전체 스폰 수 대비 비율(0~1). minCount — 절대 마릿수.
 *
 * ★★ **문구는 여기 없다** (2026-08-07). 규칙이 갖는 것은 `key` 하나이고, 두 언어의
 *   문장은 `i18n/messages/rules.json` 이 갖는다 — `{count}` `{share}` 는 그 문장의
 *   자리표이고 집계값으로 치환된다. 문구를 코드에 두면 언어가 둘이 되는 순간
 *   같은 문장이 두 곳에 적히고, 그것이 이 저장소의 단일 실패 유형이다.
 *
 * ★ `oneKey` 는 **마릿수가 1일 때만** 쓰는 문장이다. 한국어는 조사가 같아 한 문장으로
 *   충분하지만 영어는 단수·복수가 갈린다. 1 이 실제로 나오는 규칙에만 둔다 —
 *   2026-08-07 에 100 스테이지를 전수로 돌려 확인한 것은 armored · warded · shielded ·
 *   giant 넷이고, 나머지는 최소 마릿수가 3 이상이다.
 */
export const TAG_WARNING_RULES = [
    {
        code: "flying_heavy",
        tag: "FLYING",
        minShare: 0.25,
        severity: SEVERITY.CRITICAL,
        key: "rules.stage.flying_heavy",
    },
    {
        code: "flying",
        tag: "FLYING",
        minCount: 1,
        severity: SEVERITY.WARN,
        key: "rules.stage.flying",
    },
    {
        code: "armored_heavy",
        tag: "ARMORED",
        minShare: 0.35,
        severity: SEVERITY.CRITICAL,
        key: "rules.stage.armored_heavy",
    },
    {
        code: "armored",
        tag: "ARMORED",
        minCount: 1,
        severity: SEVERITY.WARN,
        key: "rules.stage.armored",
        oneKey: "rules.stage.armoredOne",
    },
    {
        code: "warded_heavy",
        tag: "WARDED",
        minShare: 0.35,
        severity: SEVERITY.CRITICAL,
        key: "rules.stage.warded_heavy",
    },
    {
        code: "warded",
        tag: "WARDED",
        minCount: 1,
        severity: SEVERITY.WARN,
        key: "rules.stage.warded",
        oneKey: "rules.stage.wardedOne",
    },
    {
        code: "regen",
        tag: "REGEN",
        minCount: 1,
        severity: SEVERITY.WARN,
        key: "rules.stage.regen",
    },
    {
        code: "swarm_heavy",
        tag: "SWARM",
        minShare: 0.5,
        severity: SEVERITY.WARN,
        key: "rules.stage.swarm_heavy",
    },
    {
        code: "swarm",
        tag: "SWARM",
        minCount: 1,
        severity: SEVERITY.INFO,
        key: "rules.stage.swarm",
    },
    {
        code: "shielded",
        tag: "SHIELDED",
        minCount: 1,
        severity: SEVERITY.INFO,
        key: "rules.stage.shielded",
        oneKey: "rules.stage.shieldedOne",
    },
    {
        code: "corrupt",
        tag: "CORRUPT",
        minCount: 1,
        severity: SEVERITY.INFO,
        key: "rules.stage.corrupt",
    },
    {
        code: "living_heavy",
        tag: "LIVING",
        minShare: 0.6,
        severity: SEVERITY.INFO,
        key: "rules.stage.living_heavy",
    },
];

/**
 * 태그와 무관한 스테이지 경고.
 * ★ 문구를 여기 모아두는 이유는 위와 같다 — 로직과 문구를 분리한다.
 */
export const STAGE_WARNING_TEXT = {
    boss_phases: {
        severity: SEVERITY.WARN,
        key: "rules.stage.boss_phases",
    },
    giant: {
        severity: SEVERITY.WARN,
        key: "rules.stage.giant",
        oneKey: "rules.stage.giantOne",
    },
    no_threat: {
        severity: SEVERITY.INFO,
        key: "rules.stage.no_threat",
    },
};

/**
 * 규칙 하나 → 현재 언어의 문장.
 * ★ 마릿수가 1이면 `oneKey`(있을 때)를 쓴다 — 영어의 단수형이다.
 * ★ 문자열 결합은 UI 경로에서만 일어난다 (틱 루프 아님).
 */
function say(rule, vars) {
    const key = vars.count === 1 && rule.oneKey ? rule.oneKey : rule.key;
    return t(key, vars);
}

/* ══════════════════════════ 집계 ══════════════════════════ */

/**
 * 스테이지 스폰 전체를 집계한다.
 *
 * ★ 마릿수는 `spec.count` 를 그대로 더한다. `lanes` 는 **분배 규칙**이지
 *   배수가 아니다 (`spawn.js:queueWave` 가 `lanes[i % lanes.length]` 로 나눈다).
 *   레인 수를 곱하면 프리뷰가 실제의 3배를 표시하게 된다.
 *
 * ★ 템포 시프트(후반 밀도 ×1.6)는 반영하지 않는다. 프리뷰는 "무엇이 오는가"이지
 *   "몇 마리가 정확히 오는가"가 아니며, 반올림이 웨이브마다 달라 표기가 흔들린다.
 *
 * @param {string} stageId
 * @returns {null | {
 *   stageId: string, world: number, mode: string, waves: number, arkHp: number,
 *   teaches: string, total: number,
 *   tags: Array<{tag: string, count: number, share: number}>,
 *   tagSet: Set<string>,
 *   enemies: Array<{id: string, name: string, count: number, tags: string[],
 *                   dmgType: string, giant: boolean, boss: boolean, art: object}>,
 *   bossPhases: Array<{name: string, tags: string[]}>,
 *   giantCount: number
 * }}
 */
export function stageEnemyCounts(stageId) {
    const stage = stagesData.stages.find((s) => s.id === stageId);
    if (!stage) return null;

    /** @type {Map<string, number>} */
    const perEnemy = new Map();
    let total = 0;
    for (const w of stage.waveTable) {
        for (const sp of w.spawns) {
            const n = sp.count ?? 0;
            total += n;
            perEnemy.set(sp.id, (perEnemy.get(sp.id) ?? 0) + n);
        }
    }

    const tagCount = Object.create(null);
    const enemies = [];
    let giantCount = 0;
    let bossPhases = [];

    // ★ Map 순회는 삽입 순서라 결정론적이지만, 표시 순서는 아래에서 다시 정렬한다.
    for (const [id, count] of perEnemy) {
        const def = ENEMY[id];
        if (!def) continue;
        for (const tg of def.tags ?? []) tagCount[tg] = (tagCount[tg] ?? 0) + count;
        if (def.giant) giantCount += count;
        if (def.boss?.phases?.length && bossPhases.length === 0) {
            bossPhases = def.boss.phases.map((p) => ({
                name: pick(p, "name"),
                tags: [...(p.tags ?? [])],
            }));
        }
        enemies.push({
            id,
            name: pick(def, "name") || id,
            count,
            tags: [...(def.tags ?? [])],
            dmgType: def.dmgType ?? "physical",
            giant: !!def.giant,
            boss: !!def.boss?.phases?.length,
            /**
             * ★★ **이 적이 멀리서 쏘는가** (2026-08-05).
             *
             *   프리뷰는 위협을 `tags` 로만 말해 왔다. 그런데 태그는 "무엇으로
             *   뚫는가"(상성)를 말할 뿐 **"어디서 때리는가"** 는 말하지 않는다.
             *   원거리 적은 방벽 뒤에서 후열을 계속 때리므로 **아군 사거리로 먼저
             *   끊어야 하는** 전혀 다른 요구인데, 화면에 그 사실이 없었다.
             *
             * ★ 판정은 역할 모듈이 한다 (`roles.js:usesProjectile`). 화면이
             *   "사거리가 100 넘으면 원거리겠지" 같은 사본 규칙을 갖는 순간
             *   전투와 갈라진다 — 이 결함이 4개월 산 이유가 정확히 그 사본이었다.
             */
            ranged: usesProjectile(def.role),
            art: def.art,
        });
    }

    // 많은 순 → 동수면 id. ★ 정렬에는 항상 타이브레이크를 넣는다 (컨벤션 §7.5).
    enemies.sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));

    const tags = [];
    const seen = new Set();
    for (const tg of PREVIEW_TAG_ORDER) {
        const c = tagCount[tg] ?? 0;
        seen.add(tg);
        if (c > 0) tags.push({ tag: tg, count: c, share: total > 0 ? c / total : 0 });
    }
    // 표시 순서에 없는 태그가 새로 생겨도 조용히 사라지지 않게 한다
    for (const tg of Object.keys(tagCount).sort()) {
        if (seen.has(tg)) continue;
        tags.push({ tag: tg, count: tagCount[tg], share: total > 0 ? tagCount[tg] / total : 0 });
    }

    return {
        stageId: stage.id,
        world: stage.world,
        mode: stage.mode,
        waves: stage.waves,
        arkHp: stage.arkHp,
        teaches: pick(stage, "teaches"),
        targetTimeSec: stage.targetTimeSec,
        total,
        tags,
        /**
         * ★ **스폰 테이블에서 센 태그만** 들어간다 — 마릿수와 짝이 맞아야 하기 때문이다.
         *   보스 페이즈 태그는 마릿수가 없으므로 여기 섞으면 "ARMORED 0마리"가 된다.
         *   상성 판단에는 `stageCounterTags()` 를 써라.
         */
        tagSet: new Set(Object.keys(tagCount)),
        enemies,
        bossPhases,
        giantCount,
    };
}

/* ══════════════════════════ 경고 ══════════════════════════ */

/**
 * 집계 결과 → 경고 목록.
 *
 * @param {ReturnType<typeof stageEnemyCounts>} counts
 * @returns {Array<{code: string, severity: string, tag: string|null, text: string}>}
 */
export function stageWarnings(counts) {
    if (!counts) return [];

    const byTag = Object.create(null);
    for (const agg of counts.tags) byTag[agg.tag] = agg;

    const out = [];
    const used = new Set();

    for (const rule of TAG_WARNING_RULES) {
        if (used.has(rule.tag)) continue;
        const hit = byTag[rule.tag];
        if (!hit) continue;
        if (rule.minShare !== undefined && hit.share < rule.minShare) continue;
        if (rule.minCount !== undefined && hit.count < rule.minCount) continue;

        used.add(rule.tag);
        out.push({
            code: rule.code,
            severity: rule.severity,
            tag: rule.tag,
            text: say(rule, { count: hit.count, share: Math.round(hit.share * 100) }),
        });
    }

    if (counts.giantCount > 0) {
        const w = STAGE_WARNING_TEXT.giant;
        out.push({
            code: "giant",
            severity: w.severity,
            tag: null,
            text: say(w, { count: counts.giantCount, share: 0 }),
        });
    }

    // 심각도 순으로 올린다 — 치명이 목록 아래에 묻히면 없는 것과 같다.
    // ★ 같은 심각도끼리는 규칙 테이블 순서를 유지해야 표기가 흔들리지 않으므로
    //   안정 정렬(Array.sort 는 ES2019 부터 안정)에 기댄다.
    const rank = { [SEVERITY.CRITICAL]: 0, [SEVERITY.WARN]: 1, [SEVERITY.INFO]: 2 };
    out.sort((a, b) => rank[a.severity] - rank[b.severity]);

    // 보스 페이즈는 항상 최상단이다 — "한 편성에 답을 둘 넣어라"가
    // 다른 어떤 경고보다 편성을 크게 바꾸는 지시다.
    if (counts.bossPhases.length > 0) {
        const w = STAGE_WARNING_TEXT.boss_phases;
        out.unshift({
            code: "boss_phases",
            severity: w.severity,
            tag: null,
            text: t(w.key),
        });
    }

    if (out.length === 0) {
        const w = STAGE_WARNING_TEXT.no_threat;
        out.push({ code: "no_threat", severity: w.severity, tag: null, text: t(w.key) });
    }
    return out;
}

/* ══════════════════════════ 추천 편성 ══════════════════════════ */

/**
 * 스테이지 적 태그에 맞춰 자동 구성한 추천 편성.
 *
 * ★ **밸런스 하네스의 `recommended` 편성과 같은 함수다.**
 *   `tools/lib/loadouts.mjs` 가 이것을 재수출하므로, 게이트 B4("현재 파워 +
 *   올바른 편성 = 클리어 가능")가 검증하는 편성과 플레이어가 [추천 적용] 로
 *   받는 편성이 정확히 같다.
 *
 * ★ 결정론적 그리디다. 같은 태그 집합이면 항상 같은 결과가 나온다 —
 *   "추천을 누를 때마다 다른 게 나온다"는 신뢰를 깎는다.
 *
 * @param {Set<string>|string[]|null} enemyTags 스테이지 적 태그 집합
 * @param {string[]|null} [unitIds] 후보를 제한한다 (보유 동료). null 이면 전 로스터.
 *   ★ 하네스는 항상 null 로 부른다 — 무과금 파워 기준을 로스터 전체로 잡아야
 *     "이 스테이지의 정답 편성이 존재하는가"를 물을 수 있다.
 * @returns {string[]} 최대 6개의 유닛 id
 */
/**
 * ★★ **상성 판단에 쓰는 태그 집합** — 스폰 태그 ∪ 보스 **전 페이즈** 태그.
 *
 *   보스 페이즈 태그가 추천 편성 입력에서 빠져 있었다. 그래서 3-20 에서
 *   `recommended`(66.7%) 가 `physical_only`(93.3%) 보다 **약했다** —
 *   추천 편성이 최적이 아니면 게이트 B4("무과금 추천 ≥55%")가 보증하는 것이 없어진다.
 *
 *   3-20 보스의 페이즈는 `CORRUPT+WARDED` → `CORRUPT+ARMORED` → `CORRUPT` 다.
 *   스폰 태그만 보면 `CORRUPT` 하나라 신성을 넣는데, **1페이즈가 WARDED 라
 *   그 신성이 저항당한다.** 물리와 술식이 같이 있어야 세 페이즈를 통과한다.
 *
 * ★ 페이즈마다 답이 바뀌는 것이 P6-05 보스 설계의 전부다. 그렇다면 추천 편성은
 *   **한 페이즈가 아니라 전 페이즈**에 답을 갖고 있어야 한다.
 *
 * ★ 하네스(`tools/balance.mjs`)도 이 함수를 쓴다. 두 곳에서 따로 계산하면
 *   게이트가 검증하는 편성과 플레이어가 받는 편성이 갈라진다 — 이미 겪은 사고다.
 *
 * @param {ReturnType<typeof stageEnemyCounts>} counts
 * @returns {Set<string>}
 */
export function stageCounterTags(counts) {
    const tags = new Set(counts?.tagSet ?? []);
    for (const phase of counts?.bossPhases ?? []) {
        for (const tg of phase.tags ?? []) tags.add(tg);
    }
    return tags;
}

/**
 * 그 태그를 지닌 적 중 **비행**이 차지하는 비율.
 *
 * ★ 태그의 유무만으로는 답을 고를 수 없다. 같은 `WARDED` 라도 지상에 붙어 있으면
 *   근접 물리가 답이지만, 공중에 붙어 있으면 근접은 **영원히 닿지 못한다.**
 *   태그는 적별로 **조합**되므로, 답도 조합을 보고 골라야 한다.
 *
 * ★ 마릿수를 모르는 입력(태그 집합만)일 때는 0 을 돌려준다 — 지상으로 가정하며,
 *   이는 이 함수가 없던 시절과 같은 동작이다. 보스 페이즈 태그도 마릿수가 없어
 *   여기 잡히지 않는다.
 *
 * @param {ReturnType<typeof stageEnemyCounts>|null} counts
 * @param {string} tag
 * @returns {number} 0–1
 */
function flyingShareOf(counts, tag) {
    let carriers = 0;
    let flying = 0;
    for (const e of counts?.enemies ?? []) {
        if (!e.tags.includes(tag)) continue;
        carriers += e.count;
        if (e.tags.includes("FLYING")) flying += e.count;
    }
    return carriers > 0 ? flying / carriers : 0;
}

/**
 * 그 태그의 답이 **공중에 닿아야 하는가**. 과반이면 그렇다.
 * ★ 과반인 이유: 절반 미만이면 지상 쪽 답도 여전히 일할 곳이 있고,
 *   대공은 `FLYING` 분기가 따로 확보한다.
 */
const AIR_MAJORITY = 0.5;

/**
 * 스테이지 하나의 추천 편성 — 화면과 하네스가 **같은 한 경로**로 쓴다.
 *
 * ★ 이 함수를 따로 두는 이유: 예전에는 호출부마다 `stageCounterTags(stageEnemyCounts(id))`
 *   를 손으로 조합했고, 그래서 마릿수(=닿을 수 있는가)를 **아무도 넘기지 않았다.**
 *   입구를 하나로 만들면 그 종류의 누락이 구조적으로 불가능해진다.
 */
export function recommendedLoadoutForStage(stageId, unitIds = null) {
    return recommendedLoadout(stageEnemyCounts(stageId), unitIds);
}

/** 기본 방벽 수. ★ 왜 2기인가는 아래 주석 참조 — 실측으로 정한 값이다. */
export const RECOMMEND_BLOCKERS = 2;

/**
 * @param {ReturnType<typeof stageEnemyCounts>|Set<string>|string[]|null} input
 *   `stageEnemyCounts()` 결과(권장 — 마릿수를 알므로 '닿는 답'을 고를 수 있다)
 *   또는 태그 집합(마릿수 없음).
 * @param {string[]|null} unitIds 보유 동료 제한
 * @param {{blockerCount?: number, fillOrder?: string[]}} [opts]
 *   ★ **규칙 실험용 손잡이다** (`tools/exp-recommend.mjs`). 게임과 하네스는 기본값만 쓴다.
 *   이 손잡이가 없던 시절 실험 스크립트가 선택 로직을 **통째로 복사**해 갖고 있었고,
 *   그 사본은 본체가 바뀌어도 따라오지 않았다. 후보 규칙을 재려면 본체를 재야 한다.
 */
export function recommendedLoadout(input, unitIds = null, opts = {}) {
    const blockerCount = opts.blockerCount ?? RECOMMEND_BLOCKERS;
    const fillOrder = opts.fillOrder ?? RECOMMEND_FILL_ORDER;
    const counts = input && !(input instanceof Set) && Array.isArray(input.enemies) ? input : null;
    const tags = counts
        ? stageCounterTags(counts)
        : input instanceof Set
          ? input
          : new Set(input ?? []);

    // 후보 순서는 units.json 순서를 유지한다 — 인덱스가 곧 결정론의 근거다
    const all = unitIds
        ? Object.values(UNIT_DEFS).filter((u) => unitIds.includes(u.id))
        : Object.values(UNIT_DEFS);
    if (all.length === 0) return [];

    const byRole = (r) => all.filter((u) => u.role === r).map((u) => u.id);

    const picks = [];
    const push = (id) => {
        if (id && !picks.includes(id) && picks.length < RECOMMEND_SIZE) picks.push(id);
    };

    /**
     * ★★ 방벽은 **2기**다.
     *
     *   1기만 세우던 규칙이 게이트 B4 를 깨고 있었다 — 3-10(20%) · 2-20(35%) ·
     *   2-10(45%) 이 55% 미만이었고, 3-20 에서는 추천(66.7%)이 물리 일변도(93.3%)
     *   보다 **약했다.** 추천이 최적이 아니면 B4 가 보증하는 것이 없어진다.
     *
     *   레인이 3개인데 방벽이 1기면 나머지 두 레인은 아무도 붙잡지 못한다.
     *   막는 것은 오직 BLOCKER 뿐이라는 것이 이 게임의 구조적 심장이므로,
     *   방벽 부족은 다른 어떤 상성 답으로도 보상되지 않는다.
     *
     *   4개 후보 규칙을 60 스테이지에 돌려 정한 값이다 (`tools/exp-recommend.mjs`):
     *
     *   | 규칙 | 평균 승률 | 55% 미만 |
     *   |---|---|---|
     *   | 방벽1 (기존) | 94.3% | **3개** |
     *   | **방벽2** | **97.4%** | **0개** |
     *   | 방벽2 + 공성 우선 | 96.3% | 2개 |
     *   | 방벽1 + 공성 우선 | 92.3% | 6개 |
     *
     * ★ 3기는 넣지 않는다. 6칸 중 절반이 벽이면 상성 답을 넣을 자리가 없어지고,
     *   그건 아키타입 `turtle`(방벽 과다)이 이미 열세로 검증된 편성이다.
     */
    for (let i = 0; i < blockerCount; i++) push(byRole("BLOCKER")[i]);

    /**
     * ★★ 상성 답 4종. 두 가지 규율이 여기에 있다.
     *
     *   ① **닿지 못하는 답은 답이 아니다.** 그 태그를 지닌 적이 과반 비행이면
     *      답도 공중에 닿아야 한다 (`canHitFlying` — 시뮬과 **같은 명제**를 쓴다).
     *   ② **한 유닛이 두 답을 겸할 수 없다.** 이미 뽑힌 유닛은 건너뛰고 다음
     *      후보를 고른다. 예전에는 `push` 가 중복을 조용히 무시해서, 두 태그의
     *      답이 같은 유닛이면 **뒤 태그가 답 없이 지나가고** 그 칸이 일반 채우기로
     *      넘어갔다 — 답이 하나 사라진 것을 아무도 볼 수 없었다.
     *
     *   ①②가 없을 때 실제로 일어난 일 (5-15 · 5-19, 2026-08-03):
     *   `WARDED` 의 답으로 근접 물리(`clucking_chicken`)가 뽑혔는데 그 스테이지의
     *   WARDED 적은 **전부 비행**(`ghastly_eye` 25마리)이었다. 답이 표적에
     *   영원히 닿지 못했고, 두 스테이지가 벽(15% · 25%)이 됐다.
     *   ①만 넣으면 `WARDED` 와 `FLYING` 의 답이 같은 유닛으로 겹쳐 대공이 1기로
     *   남는다(35%). ②까지 넣어야 대공 2기가 서고 **95% · 70%** 가 된다.
     *
     *   100 스테이지 × 20시드 실측: 평균 96.8% → 98.0%, 55% 미만 3 → 1
     *   (남은 1개는 1-9 — **설계된 첫 패배**다), 벽(<25%) 2 → 0.
     *   10%p 이상 움직인 스테이지는 5-15 · 5-19 **둘뿐이고 둘 다 상승**이다.
     */
    const freePick = (pred) => all.find((u) => !picks.includes(u.id) && pred(u))?.id;
    const needsAir = (t) => flyingShareOf(counts, t) >= AIR_MAJORITY;

    if (tags.has("ARMORED")) push(freePick((u) => u.dmgType === "arcane"));
    if (tags.has("WARDED")) {
        push(
            freePick(
                (u) =>
                    u.dmgType === "physical" &&
                    u.role !== "BLOCKER" &&
                    (!needsAir("WARDED") || canHitFlying(u.tagMask, u.dmgType))
            )
        );
    }
    if (tags.has("CORRUPT")) push(freePick((u) => u.dmgType === "holy"));
    if (tags.has("FLYING")) {
        push(
            freePick((u) => (u.tagMask & TAG.ANTI_AIR) !== 0) ?? freePick((u) => u.role === "RANGED")
        );
    }

    // 남은 칸은 균형 있게 채운다.
    // ★ 역할 목록을 여기 손으로 적지 않는다 — 사본이 갈라져 FLYER 가 통째로
    //   빠진 적이 있다 (편성 화면에서 비행 동료 2종이 사라졌다). roles.js 가 단일 출처다.
    for (const r of fillOrder) {
        for (const id of byRole(r)) push(id);
    }
    return picks;
}

/**
 * 보유분으로 만든 추천이 **하네스가 검증한 답안과 같은가**, 다르다면 무엇이 빠졌는가.
 *
 * ★★ 이 함수가 존재하는 이유는 프리뷰 화면이 하던 거짓말이다.
 *   P8-03 이 신규 계정에 시작 로스터 2종을 넣기 전까지 신규 계정의 `owned` 는
 *   `{}` 였고, 그래서 추천이 **전 로스터**로 계산되어 우연히 하네스의 답안과 같았다.
 *   지금은 보유 2종으로 좁혀지는데 화면의 문구는 여전히
 *   "밸런스 검증이 이 편성으로 클리어 가능을 확인한 구성입니다" 라고 단언했다.
 *   2-7 프리뷰를 열면 6칸 답안 대신 2칸이 뜨고, 바로 아래에서 그것으로 깰 수 있다고
 *   말한다 — 실제로는 깰 수 없다. 막힌 플레이어에게 **아무 안내가 없는** 상태다.
 *
 * ★ 추천이 보유분에서 나오는 것 자체는 옳다. 거짓이 되는 것은 **문구**이고,
 *   그 판정은 화면이 아니라 여기서 한다.
 *
 * @param {string[]} owned 보유분으로 만든 추천
 * @param {string[]} ideal 전 로스터로 만든 추천 (= 하네스의 `recommended`)
 * @returns {{verified:boolean, missingUnits:string[], missingRoles:string[]}}
 */
export function loadoutGap(owned, ideal) {
    const have = new Set(owned);
    const missingUnits = ideal.filter((id) => !have.has(id));
    const roles = [];
    for (const id of missingUnits) {
        const role = UNIT_DEFS[id]?.role;
        if (role && !roles.includes(role)) roles.push(role);
    }
    return { verified: missingUnits.length === 0, missingUnits, missingRoles: roles };
}

/**
 * 이 스테이지·난이도에 걸리는 나이트메어 규칙 (없으면 `null`).
 *
 * ★★ **화면이 `world === 5` 로 직접 분기하지 않는다.** 판정은 `logic/nightmare.js`
 *   하나이고, 프리뷰·출격·시뮬·검사기가 전부 그 함수를 부른다.
 *
 * ★★ **진입 전에 규칙을 읽을 수 있어야 한다.** 그러지 않으면 나이트메어는 전략이
 *   아니라 좌절이다 — 프리뷰가 태그 집계를 보여 주는 것과 정확히 같은 논리다
 *   (`15-content-plan.md` §1.3).
 *
 * @param {string} stageId
 * @param {string} [difficulty]
 * @returns {{id:string, name:string, summary:string}|null}
 */
export function stageNightmareRule(stageId, difficulty = DEFAULT_DIFFICULTY) {
    if (!isNightmareRuleActive(difficulty)) return null;
    return nightmareBrief(worldOfStage(stageId));
}

/**
 * 화면이 쓰는 한 방 호출 — 집계 · 경고 · 추천을 함께 낸다.
 *
 * ★ `ideal` 은 **전 로스터** 기준 추천이다. 게이트 B4 가 "이 편성으로 클리어 가능"이라고
 *   검증한 그 편성이고, `recommended`(보유분 기준)와 다르면 화면의 문구가 달라져야 한다.
 *
 * @param {string} stageId
 * @param {{unitIds?: string[]|null, difficulty?: string}} [opts]
 */
export function stagePreview(stageId, opts = {}) {
    const counts = stageEnemyCounts(stageId);
    if (!counts) return null;
    const unitIds = opts.unitIds ?? null;
    // ★ 태그 집합이 아니라 **집계 전체**를 넘긴다 — 마릿수를 알아야 '닿는 답'을 고른다
    const recommended = recommendedLoadout(counts, unitIds);
    const ideal = unitIds ? recommendedLoadout(counts, null) : recommended;
    return {
        ...counts,
        warnings: stageWarnings(counts),
        recommended,
        ideal,
        gap: loadoutGap(recommended, ideal),
        /**
         * 나이트메어 규칙 배지. 노멀·하드에서는 `null` 이므로 화면이 그대로
         * "있으면 그린다"로 쓰면 된다 (난이도를 화면이 판정하지 않는다).
         */
        nightmare: stageNightmareRule(stageId, opts.difficulty),
    };
}
