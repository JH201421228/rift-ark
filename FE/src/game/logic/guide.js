/**
 * 게임 가이드 — 다시 볼 수 있는 설명 (2026-08-04)
 *
 * ★★ **이것이 이 게임의 유일한 설명이다** (2026-08-04). 단계별 튜토리얼(FTUE)이
 *   있었지만 걷어냈다 — 손을 잡고 한 번 지나가는 길은 만들기도 지키기도 어려웠고,
 *   지나가면 아무것도 남지 않았다. 가이드는 언제든 각 화면의 [?] 로 다시 열린다.
 *
 * ★★ **수치는 문장에 없다** (절대 규칙 4). 마나 회복량 · 시설 효과 · 영입가처럼
 *   데이터가 정하는 값은 여기서 **그때그때 읽어** 표로 만든다. 문장에 숫자를 박으면
 *   밸런스를 고친 다음 날부터 가이드가 거짓말을 시작한다.
 *
 * ★ 순수 함수다. Phaser · DOM · Math.random · Date.now 가 없다 (절대 규칙 1).
 *
 * @see src/game/data/guide.json
 */
import GUIDE from "../data/guide.json" with { type: "json" };
import balance from "../data/balance.json" with { type: "json" };
import spellsData from "../data/spells.json" with { type: "json" };
import sigilsData from "../data/sigils.json" with { type: "json" };
import stagesData from "../data/stages.json" with { type: "json" };
import { FACILITIES } from "./progression.js";
import { BY_RARITY as RECRUIT_BY_RARITY, RECRUITABLE } from "./recruit.js";
import { tagLabel, rarityLabel, RARITY_ORDER } from "./labels.js";
// ★ 역할 이름은 `roles.js` 가 단일 출처다 — 가이드가 사전을 복제하지 않는다
import { roleLabel, ROLE_ORDER } from "./roles.js";
import { TOTAL_LANES, AIR_LANE } from "./state.js";
// ★★ 문장은 카탈로그가, 숫자는 데이터가 갖는다. 코드는 **값만 채운다.**
import { t, pick, getLang } from "../../i18n/index.js";

/**
 * 오라 역할 효과 → 자리표에 꽂을 **숫자**. 문장은 `guide.json:aura.*` 에 있다.
 *
 * ★★ **표를 손으로 적지 않는다.** `balance.json:commander.auraEffects` 를 읽어
 *   문장으로 만든다. 수치를 바꾸면 화면이 따라오고, 역할이 늘면 행도 늘어난다.
 *
 * ★ 키마다 서술을 하나씩 붙인다 — 새 키가 생기면 여기 없으므로 **그 키의 이름이
 *   그대로 보인다.** 조용히 빠뜨리는 것보다 낫다: 화면에 낯선 단어가 뜨면
 *   누군가 고치지만, 아무 말도 안 하면 그 효과는 없는 것과 같다
 *   (`special: true` 가 4개월간 그랬다).
 *
 * ★ 여기 있는 것은 "그 손잡이의 어느 부분이 사람이 읽는 수인가"라는 변환뿐이다 —
 *   `damageTakenMult: 0.8` 은 화면에서 "20% 감소"이지 "0.8" 이 아니다.
 */
const AURA_N = {
    blockBonus: (v) => v,
    damageTakenMult: (v) => Math.round((1 - v) * 100),
    execThreshold: (v) => Math.round(v * 100),
    rangeMult: (v) => Math.round((v - 1) * 100),
    pierceBonus: (v) => v,
    cooldownMult: (v) => Math.round((1 - v) * 100),
    pushPower: (v) => v,
    canHitGround: () => 0,
    inverted: () => 0,
};

function auraRoleFacts(effects = {}) {
    const rows = [];
    for (const role of ROLE_ORDER) {
        const e = effects[role];
        if (!e) continue;
        const parts = [];
        for (const [k, v] of Object.entries(e)) {
            // ★ 모르는 효과는 **이름 그대로** 내놓는다. 조용히 빠뜨리면 그 효과는
            //   없는 것과 같다 (`special: true` 가 4개월간 그랬다).
            parts.push(AURA_N[k] ? t(`guide.aura.${k}`, { n: AURA_N[k](v) }) : `${k} ${v}`);
        }
        if (parts.length) {
            rows.push({ label: roleLabel(role), value: parts.join(" · ") });
        }
    }
    return rows;
}

/** 나이트메어 규칙 표 — 수치는 전부 여기서 읽는다 (문장에 박지 않는다) */
const NM = balance.difficulty?.levels?.nightmare?.mechanics ?? {};

/**
 * 가이드가 **답을 적어 둔** 태그.
 *
 * ★ `labels.js:TAG_IDS` 전부가 아니다 — `LIVING` 은 "신성이 덜 들어간다"는
 *   `CORRUPT` 의 뒷면이라, 한 줄을 더 쓰면 표가 같은 말을 두 번 한다.
 * ★ 목록에 있는데 `guide.json:tag.<id>` 가 없으면 그 키가 화면에 그대로 보인다.
 *   조용히 빈 줄이 되는 것보다 낫다.
 */
const GUIDE_TAG_IDS = [
    "ARMORED",
    "WARDED",
    "FLYING",
    "SWARM",
    "CORRUPT",
    "REGEN",
    "SHIELDED",
    "ANTI_AIR",
];

/**
 * 천 단위 구분.
 * ★ `toLocaleString("ko-KR")` 이 코드에 박혀 있었다. 두 언어의 구분 규칙이 마침
 *   같아서 아무도 실패하지 않았지만, 로케일을 **언어와 무관하게 고정**하는 것은
 *   세 번째 언어가 오는 날 조용히 틀리는 종류의 코드다.
 * ★ `Intl` 은 순수한 ECMA API 다 — DOM 도 시계도 난수도 아니므로 절대규칙 1 과 무관하다.
 */
function groupDigits(n) {
    return Number(n).toLocaleString(getLang() === "ko" ? "ko-KR" : "en-US");
}

/**
 * "어느 월드에 걸리는가" 한 줄.
 * ★ 배정을 손으로 적지 않는다 — 규칙을 다른 월드로 옮기면 가이드가 따라와야 한다.
 */
function nightmareWorldFact(m) {
    if (!m?.worlds?.length) return [];
    return [
        {
            label: t("guide.nm.worlds"),
            value: m.worlds.map((w) => t("guide.nm.worldN", { n: w })).join(" · "),
        },
    ];
}

/**
 * ★★★ **방주 체력은 스테이지마다 다르다** (2026-08-07 정정).
 *
 *   이 표에 `balance.commander.hp`(600)가 "방주 체력"으로 적혀 있었다. 그 값은
 *   **지휘관 체력**이고, 같은 파일의 `commanderRisk` 표가 정확히 그 이름으로 쓴다.
 *   실제 방주 HP 는 `stages.json` 이 스테이지마다 갖는다 (월드 상수 + 비트별 override —
 *   1-1 은 30, 후반은 140). 가이드가 플레이어에게 **거짓을 말하고 있었고**,
 *   "방주 체력 600" 을 믿고 1-1 에 들어간 사람은 왜 세 마리에 죽는지 알 수 없다.
 *
 * ★ 그래서 한 숫자가 아니라 **범위**로 말한다. 하나로 접으면 어느 값을 골라도 거짓이다.
 */
const ARK_HP_RANGE = (() => {
    let min = Infinity;
    let max = 0;
    for (const s of stagesData.stages) {
        const hp = s.arkHp;
        if (!(hp > 0)) continue;
        if (hp < min) min = hp;
        if (hp > max) max = hp;
    }
    return min <= max ? { min, max } : null;
})();

export const GROUPS = GUIDE.groups;
export const TOPICS = GUIDE.topics;

/** 화면 키 → 그 화면에서 [?] 를 눌렀을 때 먼저 열릴 주제 목록 */
export function topicsForScreen(screen) {
    return TOPICS.filter((topic) => topic.screen === screen);
}

export function topicById(id) {
    return TOPICS.find((topic) => topic.id === id) ?? null;
}

/* ──────────────────── 두 언어 데이터 꺼내기 ────────────────────
 *
 * ★★ `guide.json` 의 `title` 과 `body` 는 **두 언어를 나란히** 갖는다
 *   (`{ko, en}` — 게임 데이터의 정본 형태). 화면이 `topic.body.map(...)` 를 그대로
 *   부르면 객체를 배열로 다루게 되어 그 자리에서 터진다.
 * ★ 그래서 꺼내는 곳을 **함수 하나**로 둔다. 화면이 `topic.body[lang]` 을 직접
 *   적기 시작하면 언어 선택 규칙이 화면 수만큼 생기고, 그중 하나는 반드시
 *   폴백을 빠뜨린다 (`pick` 은 한쪽이 비면 한국어로 떨어진다).
 */

/** 묶음 제목 */
export function groupTitle(group, lang) {
    return pick(group, "title", lang);
}

/** 주제 제목 */
export function topicTitle(topic, lang) {
    return pick(topic, "title", lang);
}

/**
 * 주제 본문 — **문단 배열**.
 * ★ 없는 언어는 빈 배열이 아니라 한국어로 떨어진다. 번역이 늦은 주제가 화면을
 *   비우는 것보다는 낫고, 그 상태는 `check:i18n` 이 어차피 오류로 잡는다.
 */
export function topicBody(topic, lang) {
    const b = topic?.body;
    if (Array.isArray(b)) return b;
    if (!b || typeof b !== "object") return [];
    const L = lang ?? getLang();
    const out = b[L] ?? b.ko;
    return Array.isArray(out) ? out : [];
}

/**
 * 주제가 선언한 `facts` 블록 → `[{label, value}]`.
 *
 * ★★ **여기가 이 모듈의 존재 이유다.** 각 값은 실제 게임 데이터에서 온다 —
 *   가이드가 말하는 숫자와 전투가 쓰는 숫자가 정의상 같아진다.
 *
 * ★ 모르는 이름은 빈 배열이다. 던지지 않는다 — 가이드 한 줄 때문에 화면이
 *   통째로 죽는 것은 어떤 설명보다도 나쁘다.
 */
export function guideFacts(name) {
    const R = balance.resources;
    const C = balance.commander;

    switch (name) {
        case "lanes":
            return [
                { label: t("guide.lanes.ground"), value: t("guide.lanes.groundValue", { n: TOTAL_LANES - 1 }) },
                { label: t("guide.lanes.air"), value: t("guide.lanes.airValue", { n: AIR_LANE + 1 }) },
                // ★ 지휘관 체력이 아니라 **스테이지의 방주 HP 범위**다 (위 주석 참조)
                ...(ARK_HP_RANGE
                    ? [{ label: t("guide.lanes.arkHp"), value: t("guide.lanes.arkHpValue", ARK_HP_RANGE) }]
                    : []),
            ];

        case "mana":
            return [
                { label: t("guide.mana.start"), value: `${R.manaStart}` },
                { label: t("guide.mana.max"), value: `${R.manaMax}` },
                { label: t("guide.mana.regen"), value: t("guide.mana.regenValue", { n: R.manaRegenBase }) },
                {
                    label: t("guide.mana.costGrowth"),
                    value: t("guide.mana.costGrowthValue", { n: R.summonCostGrowth }),
                },
                {
                    label: t("guide.mana.decay"),
                    value: t("guide.mana.decayValue", { n: Math.round(R.summonDecayMs / 1000) }),
                },
                {
                    label: t("guide.mana.refund"),
                    value: t("guide.mana.refundValue", { n: Math.round(R.killRefundRatio * 100) }),
                },
            ];

        case "aura":
            return [
                { label: t("guide.aura.radius"), value: `${C.auraRadius}` },
                {
                    label: t("guide.aura.radiusMax"),
                    value: t("guide.aura.radiusMaxValue", { n: C.auraRadiusMax }),
                },
                {
                    label: t("guide.aura.respawn"),
                    value: t("common.seconds", { n: Math.round(C.respawnMs / 1000) }),
                },
                { label: t("guide.aura.moveSpeed"), value: `${C.moveSpeed}` },
                /**
                 * ★★ **역할마다 오라가 다르게 작동한다** — 그것이 이 게임의 실력 천장인데
                 *   (CLAUDE.md 설계 결정 3) 가이드는 그 사실을 한 줄도 말하지 않고 있었다.
                 *   방벽·원거리·술사만 본문에 있었고, 근접 처형·공성 밀어내기·비행 지상 타격은
                 *   화면 어디에도 없었다 (2026-08-05, 오라 배선 조사가 지적).
                 *
                 * ★ 표를 손으로 적지 않는다. `balance.json:commander.auraEffects` 를
                 *   그대로 읽어 문장으로 만든다 — 수치를 바꾸면 가이드가 따라온다.
                 *   이것이 이 파일의 존재 이유다 (`data:validate` 가 본문 수치를 금지한다).
                 */
                ...auraRoleFacts(C.auraEffects),
            ];

        /**
         * ★★★ **지휘관은 미끼다 — 그리고 이제 실제로 맞는다** (2026-08-05).
         *
         *   설계 문서(`20-commander-combat.md` §2.1)는 평타를 "딜 수단이 아니라
         *   미끼"로 규정했다. 그 근거가 **평타 사거리 < 오라 반경**이라는 부등식
         *   하나다 — 때리러 나가려면 오라 앞쪽을 내줘야 하고, 그러면 SUPPORT 가
         *   끊기고 지휘관이 맞는다. 4개월간 그 마지막 절이 거짓말이었고
         *   (지휘관을 때리는 코드가 보스 슬램뿐이었다) 지금은 참이다.
         *
         * ★ **그러니 이제는 설명이 있어야 한다.** 자동 조작 실측으로 2-5 에서
         *   평균 600 중 546 이 사라진다. 대가가 실재하는데 아무 데도 안 적혀 있으면
         *   플레이어는 그것을 버그로 읽는다.
         *
         * ★ 부등식을 문장이 아니라 **표로** 보여 준다. 두 수를 나란히 놓는 것이
         *   "왜 나가면 위험한가"의 유일한 설명이고, 튜닝으로 둘이 뒤집히면
         *   (`data:validate` 가 금지한다) 이 표가 먼저 이상해 보인다.
         */
        case "commanderRisk": {
            const A = C.attack ?? {};
            const ratio = balance.combat?.enemyHitCommanderHpRatio ?? 0;
            const rows = [
                { label: t("guide.risk.hp"), value: `${C.hp}` },
                { label: t("guide.risk.range"), value: `${A.range}` },
                {
                    label: t("guide.aura.radius"),
                    value: t("guide.risk.auraValue", { n: C.auraRadius }),
                },
                {
                    label: t("guide.risk.respawn"),
                    value: t("common.seconds", { n: Math.round(C.respawnMs / 1000) }),
                },
            ];
            if (ratio > 0) {
                /**
                 * ★★★ **한 대 어긋나 있었다** (2026-08-07). 문구가 "최소 `ceil(1/r)`방은
                 *   버틴다" 였는데, r = 0.08 이면 한 방이 최대 48 이고 지휘관 HP 는 600 이라
                 *   **12대까지 버티고 13번째에 쓰러진다.** `ceil(12.5) = 13` 이 나오므로
                 *   가이드는 "최소 13방은 버틴다"고 말했다 — 참이 아니다.
                 *
                 * ★ 고친 방향은 `floor` 가 아니라 **문장**이다. 버티는 횟수로 말하면
                 *   r 이 1/정수 일 때(예: 0.1 → 정확히 10방에 죽는다) `floor` 가 다시
                 *   한 대 어긋난다. 쓰러지는 타격은 `k·r ≥ 1` 인 최소 k = `ceil(1/r)` 이고,
                 *   이 식은 두 경우 모두에서 참이다.
                 * ★ 상한이므로 실제 타격은 더 작을 수 있다 — 그래서 "최악의 경우"다.
                 */
                rows.push({
                    label: t("guide.risk.cap"),
                    value: t("guide.risk.capValue", {
                        pct: Math.round(ratio * 100),
                        n: Math.ceil(1 / ratio),
                    }),
                });
            }
            return rows;
        }

        /**
         * ★ 태그 **이름**은 `labels.js` 가 단일 출처이고(화면마다 사전을 복제하지 않는다),
         *   그 태그가 무엇을 요구하는가 하는 **답**은 `guide.json:tag.*` 에 있다.
         * ★ 목록을 손으로 적지 않는다 — 태그가 하나 늘면 여기 없다는 이유로 조용히
         *   빠지는 대신 `guide.tag.<id>` 키가 그대로 보인다.
         */
        case "tags":
            return GUIDE_TAG_IDS.map((id) => ({
                label: tagLabel(id),
                value: t(`guide.tag.${id}`),
            }));

        case "sigils":
            return [
                {
                    label: t("guide.sigils.kinds"),
                    value: t("common.countKinds", { n: sigilsData.sigils.length }),
                },
                { label: t("guide.sigils.draft"), value: t("guide.sigils.draftValue") },
                { label: t("guide.sigils.duration"), value: t("guide.sigils.durationValue") },
                { label: t("guide.sigils.choices"), value: t("guide.sigils.choicesValue") },
            ];

        /**
         * ★ 주문은 12종이고 전투에는 4종만 들고 나간다 (2026-08-05).
         *   **그 두 숫자를 여기서 읽는다** — 본문에 적으면 데이터를 고친 다음 날부터
         *   가이드가 거짓말을 한다 (절대 규칙 4).
         * ★ 해금 스테이지를 함께 보여 주는 것은 영입·시설 표와 같은 규약이다.
         *   "언제 오는가"를 모르면 확정 지급은 확정이 아니라 그냥 안 오는 것이다.
         */
        case "spells":
            return [
                { label: t("guide.spells.riftMax"), value: `${R.riftMax}` },
                {
                    label: t("guide.mana.regen"),
                    value: t("guide.mana.regenValue", { n: R.riftRegenBase }),
                },
                { label: t("guide.spells.perKill"), value: `+${R.riftPerKill}` },
                {
                    label: t("guide.spells.kinds"),
                    value: t("common.countKinds", { n: (spellsData.spells ?? []).length }),
                },
                {
                    label: t("guide.spells.loadout"),
                    value: t("guide.spells.loadoutValue", { n: spellsData.loadoutSize }),
                },
                /**
                 * ★★ 주문 이름·설명은 `spells.json` 이 **두 언어를 나란히** 갖는다
                 *   (`i18n/index.js` 머리말 — 게임 데이터는 카탈로그로 옮기지 않는다).
                 *   여기서 `s.nameKo` 를 읽던 코드는 데이터가 `{ko,en}` 로 옮겨간 순간
                 *   **이름을 id 로, 설명을 빈칸으로** 그리기 시작했다 — `?? s.id` 폴백이
                 *   있어서 아무도 실패하지 않았다. `pick()` 은 두 형태를 모두 읽는다.
                 * ★ 해금 조건이 있고 없고는 **문장이 다르다.** 뒤에 조각을 이어 붙이면
                 *   어순이 다른 언어에서 그 자리가 무너진다.
                 */
                ...(spellsData.spells ?? []).map((s) => ({
                    label: pick(s, "name") || s.id,
                    value: s.unlockStage
                        ? t("guide.spells.rowUnlock", {
                              cost: s.cost,
                              desc: pick(s, "desc"),
                              stage: s.unlockStage,
                          })
                        : t("guide.spells.row", { cost: s.cost, desc: pick(s, "desc") }),
                })),
            ];

        case "facilities":
            return FACILITIES.map((f) => ({
                label: pick(f, "name") || f.id,
                value: t("guide.facilities.row", {
                    desc: pick(f, "desc"),
                    stage: f.unlockStage,
                }),
            }));

        case "recruit":
            return [
                {
                    label: t("guide.recruit.available"),
                    value: t("common.countKinds", { n: RECRUITABLE.length }),
                },
                ...RARITY_ORDER.filter((r) => RECRUIT_BY_RARITY[r]).map((r) => ({
                    label: rarityLabel(r),
                    value: t("guide.recruit.row", {
                        gold: groupDigits(RECRUIT_BY_RARITY[r].gold),
                        stage: RECRUIT_BY_RARITY[r].unlockStage,
                    }),
                })),
            ];

        /**
         * ★★ 나이트메어 규칙 3종 (P11-07). **본문에 수치를 적지 않는다** —
         *   장판 반경도 결박 시간도 밸런스 손잡이라, 문장에 박으면 튜닝한 다음 날부터
         *   가이드가 거짓말을 시작한다. `data:validate` 가 그 규약을 강제한다.
         *
         * ★ 배정 월드도 데이터에서 읽는다. 규칙을 다른 월드로 옮기는 것이
         *   `balance.json` 한 줄이어야 하고, 그때 가이드가 따라와야 한다.
         */
        case "nightmarePlague": {
            const m = NM.plague_bloom;
            if (!m) return [];
            return [
                ...nightmareWorldFact(m),
                { label: t("guide.nm.radius"), value: `${m.radius}` },
                {
                    label: t("guide.nm.duration"),
                    value: t("common.seconds", { n: (m.durationMs / 1000).toFixed(1) }),
                },
                {
                    label: t("guide.nm.tick"),
                    value: t("guide.nm.tickValue", { n: (m.tickMs / 1000).toFixed(1) }),
                },
                {
                    label: t("guide.nm.dps"),
                    value: t("guide.nm.dpsValue", { n: (m.dpsPctOfMaxHp * 100).toFixed(0) }),
                },
                {
                    label: t("guide.nm.maxPerLane"),
                    value: t("common.countItems", { n: m.maxPerLane }),
                },
                { label: t("guide.nm.merge"), value: t("guide.nm.mergeValue", { n: m.mergeGap }) },
            ];
        }

        case "nightmareBond": {
            const m = NM.bond_break;
            if (!m) return [];
            return [
                ...nightmareWorldFact(m),
                {
                    label: t("guide.nm.holdLimit"),
                    value: t("guide.nm.holdValue", { n: (m.holdMs / 1000).toFixed(0) }),
                },
                {
                    label: t("guide.nm.telegraph"),
                    value: t("guide.nm.telegraphValue", { n: (m.telegraphMs / 1000).toFixed(1) }),
                },
                {
                    label: t("guide.nm.afterBreak"),
                    value: t("guide.nm.afterBreakValue", { n: m.postBreakSpeedMult }),
                },
            ];
        }

        case "nightmareAttrition": {
            const m = NM.attrition;
            if (!m) return [];
            const pct = (v) => Math.round(v * 100);
            return [
                ...nightmareWorldFact(m),
                {
                    label: t("guide.mana.refund"),
                    value: t("guide.nm.refundValue", {
                        mult: pct(m.killRefundMult),
                        base: pct(R.killRefundRatio),
                    }),
                },
                {
                    // ★ 0 은 "0%" 가 아니라 **다른 사실**이다 — 삼항으로 조각을 고르지 않고
                    //   문장 전체를 고른다.
                    label: t("guide.mana.decay"),
                    value:
                        m.summonDecayMult === 0
                            ? t("guide.nm.decayNone")
                            : t("guide.nm.decayValue", { n: pct(m.summonDecayMult) }),
                },
                { label: t("guide.nm.manaRegen"), value: t("guide.nm.unchanged") },
            ];
        }

        default:
            return [];
    }
}

/** `facts` 이름이 실제로 구현돼 있는가 — `tools/validate-data.mjs` 가 부른다 */
export const FACT_KINDS = Object.freeze([
    "lanes",
    "mana",
    "aura",
    "commanderRisk",
    "tags",
    "sigils",
    "spells",
    "facilities",
    "recruit",
    "nightmarePlague",
    "nightmareBond",
    "nightmareAttrition",
]);
