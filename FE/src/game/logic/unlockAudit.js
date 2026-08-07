/**
 * 해금 전수 검사 (P8-03)
 *
 * ★★ 이 모듈이 답하는 질문은 하나다:
 *   **"진행도 N 인 계정에게 지금 무엇이 열려 있는가"를 한 함수가 말할 수 있는가.**
 *
 *   해금 판정은 세 모듈에 흩어져 있다 — 난이도(difficulty.js) ·
 *   방주/별(progression.js) · 확정 지급(unlocks.js). 2026-08-04 경량화 전에는
 *   여기에 던전 · 탑 · 시험 · 상점이 더 있었다.
 *   흩어져 있는 것 자체는 옳다(각자 자기 규칙을 갖는다). 문제는 **아무도 전체를
 *   한 번에 보지 않는다**는 것이고, 그래서 "해금 조건이 실제로는 안 열림" ·
 *   "진행했는데 거꾸로 잠김" 같은 결함을 잡을 자리가 없었다.
 *
 * ★★ **여기에 해금 조건을 다시 적지 않는다.** 이 모듈은 각 규칙 모듈을 import 해서
 *   **부를** 뿐이다. 숫자를 하나라도 다시 적는 순간 검사기가 두 번째 출처가 되고,
 *   그 순간 이 검사는 "무기고는 5에서 열린다"를 자기 자신에게 물어보는 동어반복이 된다
 *   (`tools/validate-data.mjs` 의 다른 절들과 같은 규약이다).
 *
 * ★ 순수 함수다. Phaser · DOM · Math.random · Date.now 가 없다 (절대 규칙 1).
 *   그래서 검사기(`tools/check-unlocks.mjs`)와 테스트가 **같은 함수**를 부른다.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ★ 검사하는 네 가지 성질
 *
 *   ① **단조성** — 진행할수록 열린 것이 줄어들면 안 된다.
 *      거꾸로 잠금은 이 저장소가 가장 두려워하는 회귀다: 업데이트 하나로 이미
 *      던전을 돌던 플레이어의 던전이 닫히는 종류의 사고이고, 세이브에 그대로 남는다.
 *   ② **도달성** — 데이터가 선언한 모든 해금은 **언젠가 열린다.**
 *      영원히 안 열리는 해금 = 만들었는데 아무도 못 가는 콘텐츠.
 *   ③ **선행 정합** — 열린 콘텐츠가 요구하는 것(동료 수 · 역할 · 별)이
 *      그 시점에 확보 가능한가. 열려도 들어갈 수 없으면 열린 것이 아니다.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * @see docs/04-plan/33-execution-plan.md P8-03
 * @see docs/04-plan/32-definition-of-done.md §3.4
 */
import stagesData from "../data/stages.json" with { type: "json" };
import worldsData from "../data/worlds.json" with { type: "json" };

import {
    DIFFICULTY_IDS,
    DEFAULT_DIFFICULTY,
    difficultyDef,
    difficultyName,
    difficultyProgress,
    globalStageIndex,
    isDifficultyImplemented,
    stageIdsOfWorld,
    worldOfStage,
} from "./difficulty.js";
// ★ 난이도 이름·비고는 두 언어다 — `pick` 이 현재 언어를 고른다
import { pick } from "../../i18n/index.js";
import {
    FACILITIES,
    STAR_NODES,
    STAR_NODE_BY_ID,
    facilityUnlocked,
} from "./progression.js";
import { guaranteedUnitsUpTo } from "./unlocks.js";
// ★ 영입은 **확정 지급이 아닌 동료의 유일한 경로**다. 여기 넣지 않으면
//   "만들었는데 아무도 못 얻는 동료 20종"이 도달성 검사를 통과해 버린다.
import { RECRUITABLE, recruitUnlockStage } from "./recruit.js";
import { UNIT_DEFS } from "./stageConfig.js";
// ★ 스테이지 하나가 줄 수 있는 최대 별 — 규칙 모듈이 단일 출처다 (`computeStars` 의 상한)
import { MAX_STARS } from "./lifecycle.js";

/* ═══════════════════════ 진행도 모델 ═══════════════════════ */

/** 캠페인의 마지막 전역 순번 — 데이터에서 센다 (100 을 적지 않는다) */
export const MAX_STAGE = stagesData.stages.reduce(
    (m, s) => Math.max(m, globalStageIndex(s.id)),
    0
);


/** 전역 순번 오름차순 스테이지 id */
const STAGE_IDS_BY_INDEX = stagesData.stages
    .map((s) => s.id)
    .sort((a, b) => globalStageIndex(a) - globalStageIndex(b));

/**
 * 진행 프로필 — **검사가 어떤 플레이어를 재는가.**
 *
 * ★★ 프로필이 필요한 이유는 이 저장소가 실제로 겪은 실패 때문이다:
 *   밸런스 하네스가 신규 계정이 가질 수 없는 로스터로 게이트를 통과시켰다
 *   (33-execution-plan.md P8-02). 검사가 **누구를 재고 있는지** 명시하지 않으면
 *   같은 종류의 거짓 통과가 반복된다.
 *
 *   - `normal`   : 노멀만 ★3 으로 밀고 올라온 계정. 하드를 한 번도 안 켰다.
 *   - `complete` : 노멀 ★3 + **열린 상위 난이도는 그것도 ★3**.
 *                  상위 난이도는 앞 난이도 조건을 채워야 열리므로(difficulty.js),
 *                  아래 루프가 난이도를 쉬운 순으로 훑으며 **그 시점에 실제로 열린
 *                  월드에만** 별을 붙인다 — 이 제약을 지키지 않으면 "가질 수 없는 별"로
 *                  콘텐츠가 열려 버린다.
 *
 * ★★ **이 프로필은 여전히 '가정'이다.** "열린 난이도는 만점"은 아무도 측정한 적이
 *   없는 낙관이고, 나이트메어 해금 조건이 **하드 ★3** 이었을 때는 그 가정 위에서
 *   도달성 검사가 통과했다 — 검사가 자기 가정을 확인하는 모양이다.
 *   그래서 조건을 **하드 ★2** 로 내렸고(2026-08-05 · 22-nightmare.md §5.1),
 *   실제 달성 가능성은 여기가 아니라 밸런스 게이트 **BN8** 이 시뮬로 잰다.
 *   해금 검사기는 "도달 경로가 존재하는가"만 답한다 — 그 이상은 답할 수 없다.
 */
export const PROFILES = ["normal", "complete"];

/**
 * 진행도 N 인 계정의 별 기록.
 *
 * @param {number} highestStage 0 ~ MAX_STAGE
 * @param {string} [profile]
 * @returns {{normal: Record<string, number>, [k: string]: Record<string, number>}}
 */
export function starsByDifficultyAt(highestStage, profile = "complete") {
    const n = Math.max(0, Math.floor(highestStage));
    const normal = {};
    for (const id of STAGE_IDS_BY_INDEX) {
        if (globalStageIndex(id) <= n) normal[id] = MAX_STARS;
    }
    const out = { [DEFAULT_DIFFICULTY]: normal };
    if (profile !== "complete") return out;

    // ★ 하드 별은 **그 월드를 노멀로 전부 깬 뒤**에만 존재할 수 있다.
    //   difficultyProgress 에 물어본다 — 조건("월드 전체 ★1 이상")을 여기 다시 적으면
    //   해금 조건이 바뀌는 날 검사기만 옛 조건으로 남는다.
    for (const d of DIFFICULTY_IDS) {
        if (d === DEFAULT_DIFFICULTY || !isDifficultyImplemented(d)) continue;
        const map = {};
        for (const w of worldsData.worlds) {
            if (!difficultyProgress(d, w.world, out).unlocked) continue;
            for (const id of stageIdsOfWorld(w.world)) {
                if (globalStageIndex(id) <= n) map[id] = MAX_STARS;
            }
        }
        if (Object.keys(map).length) out[d] = map;
    }
    return out;
}

/** 진행도 N 에서 **획득한** 별의 총합 (별 트리 예산) */
export function starsEarnedAt(highestStage, profile = "complete") {
    let sum = 0;
    for (const map of Object.values(starsByDifficultyAt(highestStage, profile))) {
        for (const v of Object.values(map)) sum += v;
    }
    return sum;
}

/* ═══════════════════════ 별 트리 ═══════════════════════ */

/**
 * 이 노드를 **처음 살 수 있게 되는** 최소 별 수.
 *
 * ★ `canBuyStarNode` 는 "선행 노드가 1랭크 이상인가"만 본다(progression.js).
 *   그러므로 최소 비용 = 선행 사슬을 1랭크씩 + 자기 자신 1랭크다.
 *   ★ 사이클이 있어도 멈춘다 — 데이터 오타 하나로 검사기가 얼어붙으면
 *     그것은 검사기가 아니라 함정이다.
 */
export function minStarsForNode(nodeId, seen = new Set()) {
    const node = STAR_NODE_BY_ID[nodeId];
    if (!node || seen.has(nodeId)) return 0;
    seen.add(nodeId);
    let sum = node.cost;
    for (const req of node.requires ?? []) sum += minStarsForNode(req, seen);
    return sum;
}

/* ═══════════════════════ 해금 스냅샷 ═══════════════════════ */

/**
 * 진행도 N 에 **열려 있어야 하는 것 전부.**
 *
 * ★ 키는 `종류.대상` 문자열이다. 문자열인 이유는 이 집합이 곧 단조성·도달성
 *   검사의 원소이기 때문이다 — 객체로 두면 비교가 깊은 비교가 되고, 그 순간
 *   "무엇이 사라졌는가"를 사람이 읽을 수 없다.
 *
 * @param {number} highestStage
 * @param {{profile?: string}} [opts]
 * @returns {Set<string>}
 */
export function unlocksAt(highestStage, { profile = "complete" } = {}) {
    const n = Math.max(0, Math.floor(highestStage));
    const stars = starsByDifficultyAt(n, profile);
    const earned = starsEarnedAt(n, profile);
    const keys = new Set();

    /* 확정 지급 동료 — 진행이 보장하는 로스터 (P8-02) */
    for (const id of guaranteedUnitsUpTo(n)) keys.add(`unit.${id}`);

    /* 영입 동료 — 골드로 데려온다 (2026-08-04).
       ★ '살 수 있게 되는 시점'을 해금으로 센다. 실제로 살 골드가 있는지는
         경제의 문제이고 `calibrate-economy` 가 답한다 — 여기서 섞으면
         "해금인가 잔액인가"를 구분할 수 없게 된다. */
    for (const id of RECRUITABLE) {
        if ((recruitUnlockStage(id) ?? Infinity) <= n) keys.add(`unit.${id}`);
    }

    /* 난이도 × 월드 */
    for (const d of DIFFICULTY_IDS) {
        if (!isDifficultyImplemented(d)) continue;
        for (const w of worldsData.worlds) {
            if (difficultyProgress(d, w.world, stars).unlocked) {
                keys.add(`difficulty.${d}.w${w.world}`);
            }
        }
    }

    /* 방주 시설 */
    for (const f of FACILITIES) {
        if (facilityUnlocked(f.id, n)) keys.add(`ark.${f.id}`);
    }

    /* 별 트리 노드 — 별 예산이 사슬 전체를 감당할 수 있는 시점 */
    for (const node of STAR_NODES) {
        if (earned >= minStarsForNode(node.id)) keys.add(`star.${node.id}`);
    }

    return keys;
}

/**
 * 데이터가 **선언한** 해금 전부 — "언젠가 열려야 하는 것"의 목록.
 *
 * ★ `unlocksAt(MAX_STAGE)` 와 대조하는 것이 도달성 검사다. 여기에 있는데
 *   끝까지 안 열리는 키가 곧 **죽은 콘텐츠**다.
 *
 * ★ 미구현 난이도(`implemented:false`)는 **일부러 뺀다.** 나이트메어는 데이터에
 *   남아 있지만 "아직 안 만든 것"이고, 그것을 도달성 실패로 세면 검사가
 *   매번 빨간불이 되어 아무도 보지 않게 된다 (difficulty.js 가 두 실패를
 *   다른 메시지로 구분하는 것과 같은 태도). 대신 info 로 보고한다.
 */
export function declaredUnlockKeys() {
    const keys = new Set();
    // ★★ **로스터 전량**이 선언 대상이다. 확정 지급이든 영입이든, 데이터에 있는
    //   동료는 언젠가 손에 들어와야 한다 — 그러지 못하는 동료는 죽은 콘텐츠다.
    for (const id of Object.keys(UNIT_DEFS)) keys.add(`unit.${id}`);
    for (const d of DIFFICULTY_IDS) {
        if (!isDifficultyImplemented(d)) continue;
        for (const w of worldsData.worlds) keys.add(`difficulty.${d}.w${w.world}`);
    }
    for (const f of FACILITIES) keys.add(`ark.${f.id}`);
    for (const node of STAR_NODES) keys.add(`star.${node.id}`);
    return keys;
}

/**
 * 진행도 0 → MAX_STAGE 전 구간 표.
 * @returns {Array<{stage:number, keys:Set<string>}>}
 */
export function sweep({ profile = "complete", max = MAX_STAGE } = {}) {
    const rows = [];
    for (let n = 0; n <= max; n++) rows.push({ stage: n, keys: unlocksAt(n, { profile }) });
    return rows;
}

/* ═══════════════════════ 검사 ═══════════════════════ */

/**
 * 결함 하나.
 * @typedef {{code:string, severity:"error"|"warn"|"info", at:string, message:string}} Finding
 */

const err = (code, at, message) => ({ code, severity: "error", at, message });
const info = (code, at, message) => ({ code, severity: "info", at, message });

/**
 * ① 단조성 — 진행하면서 **사라진** 해금.
 *
 * ★ 검사 대상을 인자로 받는다. 그래야 테스트가 **일부러 망가진 수열**을 넣어
 *   "이 검사가 실제로 발동하는가"를 확인할 수 있다. 실제 데이터만 검사하는
 *   검사기는 자기가 죽었는지 아무도 모른다.
 *
 * @param {Array<{stage:number, keys:Set<string>}>} rows
 * @returns {Finding[]}
 */
export function findLockBacks(rows) {
    const out = [];
    for (let i = 1; i < rows.length; i++) {
        const lost = [];
        for (const k of rows[i - 1].keys) if (!rows[i].keys.has(k)) lost.push(k);
        if (lost.length) {
            out.push(
                err(
                    "lock-back",
                    `stage ${rows[i - 1].stage}→${rows[i].stage}`,
                    `진행했는데 해금이 사라진다: ${lost.sort().join(", ")} — ` +
                        `기존 진행도를 거꾸로 잠그는 것은 세이브에 그대로 남는 회귀다`
                )
            );
        }
    }
    return out;
}

/**
 * ② 도달성 — 선언됐지만 끝까지 안 열리는 해금.
 * @returns {Finding[]}
 */
export function findUnreachable(finalKeys, declared = declaredUnlockKeys()) {
    const out = [];
    for (const k of [...declared].sort()) {
        if (!finalKeys.has(k)) {
            out.push(
                err(
                    "unreachable",
                    k,
                    `진행도 ${MAX_STAGE}(캠페인 완주 · 전 스테이지 ★3)에서도 열리지 않는다 — ` +
                        `만들었는데 아무도 갈 수 없는 콘텐츠다`
                )
            );
        }
    }
    return out;
}

/** 각 키가 처음 열리는 진행도 (없으면 null) */
export function firstOpenAt(rows) {
    const out = new Map();
    for (const row of rows) {
        for (const k of row.keys) if (!out.has(k)) out.set(k, row.stage);
    }
    return out;
}

/**
 * ③ 선행 정합 — 열린 콘텐츠가 요구하는 것을 그 시점에 확보할 수 있는가.
 *
 * ★ "열렸다"와 "들어갈 수 있다"는 다른 명제다. 티어가 기능보다 먼저 열린다고
 *   적혀 있거나, 편성 규칙이 요구하는 칸을 확정 로스터로 못 채우면
 *   그 해금은 화면에만 존재한다.
 *
 * @returns {Finding[]}
 */
export function auditPrerequisites() {
    const out = [];

    /* 방주 시설 — 캠페인 안에서 도달하는가 */
    for (const f of FACILITIES) {
        if (f.unlockStage > MAX_STAGE) {
            out.push(
                err(
                    "facility-out-of-range",
                    `ark.${f.id}`,
                    `해금 ${f.unlockStage} 가 캠페인 마지막 ${MAX_STAGE} 를 넘는다`
                )
            );
        }
    }
    /* 별 트리 — 사슬 전체를 감당할 별이 나오는가 */
    {
        const budgetNormal = starsEarnedAt(MAX_STAGE, "normal");
        const budgetAll = starsEarnedAt(MAX_STAGE, "complete");
        for (const node of STAR_NODES) {
            const need = minStarsForNode(node.id);
            if (need > budgetAll) {
                out.push(
                    err(
                        "star-node-unreachable",
                        `star.${node.id}`,
                        `선행 사슬까지 ${need} 별이 필요한데 전 구간 최대가 ${budgetAll} 별이다`
                    )
                );
            }
        }
        const totalMax = STAR_NODES.reduce((a, n) => a + n.cost * n.maxRank, 0);
        if (totalMax > budgetNormal) {
            out.push(
                info(
                    "star-tree-needs-hard",
                    "star",
                    `별 트리 전체 만렙에 ${totalMax} 별이 필요하다 — ` +
                        `노멀 ★3 전관왕이 ${budgetNormal} 별이므로 하드 별이 있어야 완성된다 (설계 의도)`
                )
            );
        }
    }

    return out;
}

/* ═══════════════════════ 전체 ═══════════════════════ */

/**
 * 전 구간 검사.
 * @param {{profiles?: string[]}} [opts]
 * @returns {{findings: Finding[], rows: Array, firstOpen: Map<string, number>,
 *            declared: Set<string>}}
 */
export function runUnlockAudit({ profiles = PROFILES } = {}) {
    const findings = [];
    const byProfile = {};

    for (const profile of profiles) {
        const rows = sweep({ profile });
        byProfile[profile] = rows;
        for (const f of findLockBacks(rows)) {
            findings.push({ ...f, at: `${profile} · ${f.at}` });
        }
    }

    const complete = byProfile.complete ?? sweep({ profile: "complete" });
    const declared = declaredUnlockKeys();
    findings.push(...findUnreachable(complete[complete.length - 1].keys, declared));
    findings.push(...auditPrerequisites());

    /* 미구현 난이도는 실패가 아니라 사실이다 — 그러나 조용히 두지도 않는다 */
    const noteOf = (def) => pick(def ?? {}, "note") || def?.note || "";
    for (const d of DIFFICULTY_IDS) {
        if (isDifficultyImplemented(d)) continue;
        const def = difficultyDef(d);
        findings.push(
            info(
                "difficulty-unimplemented",
                `difficulty.${d}`,
                `'${difficultyName(d)}' 는 implemented:false — 도달성 검사에서 제외했다` +
                    (noteOf(def) ? ` (${noteOf(def)})` : "")
            )
        );
    }

    return { findings, rows: complete, byProfile, firstOpen: firstOpenAt(complete), declared };
}

/** 캠페인 순번으로 읽히는 id 인가 */
export function isCampaignStageIndex(stageId) {
    const i = globalStageIndex(stageId);
    return Number.isFinite(i) && i >= 1 && Number.isFinite(worldOfStage(stageId));
}
