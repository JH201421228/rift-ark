/**
 * 나이트메어 밸런스 게이트 BN1–BN8 (P11-09)
 *
 * ★★ **노멀 13항과 재는 방식이 다르다.** 노멀 게이트는 `balance-report.csv` 하나를
 *   읽어 판정한다. 나이트메어는 그럴 수 없다 — 물어야 하는 질문이
 *   **"규칙을 껐을 때와 켰을 때가 다른가"** · **"대응 편성이 무대응 편성보다 나은가"**
 *   라서, 같은 시드로 **두 조건을 나란히 돌려야** 답이 나온다. CSV 한 장에는
 *   그 짝이 없다. 그래서 여기서 직접 시뮬을 돌린다 (`sigils:audit` 과 같은 수법).
 *
 * ★★★ **BN4 가 이 설계의 진짜 검증이다.** 나머지는 "깨지지 않았다"를 보지만
 *   BN4 만이 **"편성 퍼즐인가 경제 벽인가"** 를 본다. 이 항이 실패하면 규칙이
 *   스탯 벽이라는 뜻이고, 그때는 배율이 아니라 **규칙을 고쳐야 한다.**
 *
 * ★ 노멀 게이트를 **한 항도 건드리지 않는다.** 난이도 분기이므로 노멀 경로가
 *   바뀌면 그것이 곧 버그다.
 *
 * @see docs/02-design/22-nightmare.md §8.1
 */
import { createSim, runToCompletion, computeStars } from "../../src/game/logic/sim.js";
import { buildStageConfig, UNIT_DEFS } from "../../src/game/logic/stageConfig.js";
import { autoPlayTick } from "../../src/game/logic/autoPlay.js";
import { recommendedLoadoutForStage } from "../../src/game/logic/stagePreview.js";
import { nightmareFor } from "../../src/game/logic/nightmare.js";
import { withF2PProgression } from "./f2p-power.mjs";
import balance from "../../src/game/data/balance.json" with { type: "json" };

const SEEDS = Number(process.env.BN_SEEDS ?? 12);

/**
 * 규칙마다 대표 스테이지 — 월드 5개를 전부 지나간다.
 *
 * ★ 월드 5 만 `5-5` 다. `5-12` 이후는 **규칙을 전부 끄고 배율만 얹어도** 무과금
 *   만렙 파워로 승률 0% 라(2026-08-05 실측), 거기서 편성을 비교하면 "대응도 0,
 *   무대응도 0" 이 되어 아무것도 재지 못한다. 그 사실 자체는 BN3 가 따로 신고한다.
 */
const RULE_STAGES = ["1-19", "2-19", "3-19", "4-19", "5-5"];
/** 월드 마지막 스테이지 (BN3 — "그 월드를 끝낼 수 있는가") */
const WORLD_LAST = ["1-20", "2-20", "3-20", "4-20", "5-20"];
/** BN8 표본 — 월드마다 초·중·말 */
const HARD_SAMPLE = ["1-5", "1-19", "2-12", "3-5", "3-19", "4-12", "5-5", "5-19"];

/**
 * 파워 상한 — 캠페인 완주 시점의 무과금 파워.
 *
 * ★★ **나이트메어는 "다 가진 뒤에 가는 곳"이다** (22-nightmare.md §5.2). 그래서
 *   기본 측정 파워는 스테이지 자기 순번이 아니라 **캠페인 완주 시점**이다.
 *   자기 순번으로 재면 월드 2·4 가 전부 0% 로 나오는데, 그것은 "규칙이 어렵다"가
 *   아니라 "그 시점 계정이 나이트메어를 켤 이유가 없다"는 뜻이다.
 */
const MAX_POWER_INDEX = 100;

/* ══════════════════════════════════════════════════════════════
 * 편성
 * ══════════════════════════════════════════════════════════════ */

const ALL = Object.values(UNIT_DEFS);

/**
 * 그 역할에서 한 종을 고른다.
 *
 * ★★ **싼 것만 고르면 안 된다.** 처음에 최저가로 골랐더니 대응 편성이 무대응
 *   편성보다 **약해져서** BN4 가 0/4 로 실패했다 — 규칙이 스탯 벽이라는 뜻이 아니라
 *   비교군을 잘못 만든 것이었다. 이 게임에서 `cost` 는 설계자가 매긴 힘의 대용치이고,
 *   답안 편성은 **아는 플레이어의 선택**이므로 비싼 쪽을 집는다.
 *
 * ★ 다만 ③ 고갈만 반대다 — 그 규칙의 답이 정확히 "코스트 구성"이라 비싼 것을
 *   집으면 규칙이 요구하는 바를 스스로 어긴다.
 */
const pickOfRole = (role, exclude, prefer) => {
    const pool = ALL.filter((u) => u.role === role && !exclude.includes(u.id));
    if (!pool.length) return null;
    pool.sort((a, b) =>
        prefer === "cheap" ? a.cost - b.cost || (a.id < b.id ? -1 : 1) : b.cost - a.cost || (a.id < b.id ? -1 : 1)
    );
    return pool[0].id;
};

/**
 * 규칙별 **답안 편성**의 역할 정원 (22-nightmare.md §2.2 · §3.2 · §4.2).
 *
 * ★ 여기 적은 것은 "이기는 편성"이 아니라 **문서가 답이라고 주장한 것**이다.
 *   주장이 틀렸으면 BN4 가 실패해야 하고, 그때 고칠 것은 이 표가 아니라 규칙이다.
 */
const RULE_ANSWER = {
    /**
     * ① 역병 장판 — 문서가 든 답은 셋이다: 지속 회복 · 사거리 · 방벽 둘 이상.
     * ★ **하나로 합치지 않는다.** 셋을 한 편성에 다 넣으면 6칸이 답으로만 차서
     *   상성 답이 밀려나고, 그러면 "규칙 때문에 이겼는지"를 알 수 없다.
     *   후보를 따로 두고 **하나라도 통하면** 그 규칙은 편성 퍼즐이다.
     */
    plague_bloom: [
        { label: "지속회복", need: { SUPPORT: 1 }, prefer: "strong" },
        { label: "사거리", need: { RANGED: 3 }, prefer: "strong" },
        { label: "회복+사거리", need: { SUPPORT: 1, RANGED: 3 }, prefer: "strong" },
    ],
    /** ② 결박 파열 — 시간 안의 화력(CASTER) + 지연(SIEGE) */
    bond_break: [
        { label: "지연", need: { SIEGE: 2 }, prefer: "strong" },
        { label: "화력", need: { CASTER: 2 }, prefer: "strong" },
        { label: "화력+지연", need: { SIEGE: 1, CASTER: 2 }, prefer: "strong" },
    ],
    /** ③ 고갈 — 여섯 칸의 코스트 구성. 역할이 겹치지 않아야 돌려 쓸 수 있다 */
    attrition: [
        {
            label: "코스트분산",
            need: { BLOCKER: 1, MELEE: 1, RANGED: 1, CASTER: 1, SUPPORT: 1, SIEGE: 1 },
            prefer: "cheap",
        },
        { label: "떼유닛", need: { MELEE: 2, RANGED: 2 }, prefer: "cheap" },
    ],
};

const roleCount = (ids, role) => ids.filter((id) => UNIT_DEFS[id]?.role === role).length;

/**
 * **무대응 편성** — 태그는 맞췄지만 규칙은 모르는 편성.
 *
 * ★ 이것이 곧 "하드 편성 그대로"다. `recommendedLoadoutForStage` 는 상성·비행만
 *   보고 나이트메어 규칙을 전혀 모른다 — 그래서 BN5 의 대조군으로 정확하다.
 */
export const blindLoadout = (stageId) => recommendedLoadoutForStage(stageId);

/**
 * **대응 편성** — 태그 답 위에 규칙 답을 얹는다.
 *
 * ★ 처음부터 새로 짜지 않는다. 상성을 버리고 규칙만 맞춘 편성은 "규칙 때문에
 *   이겼는지 상성 때문에 졌는지"를 구분할 수 없게 만든다. 부족한 역할만 채우고,
 *   **가장 흔한 역할**을 내준다 (실제 플레이어가 칸을 바꾸는 방식).
 */
export function answerLoadout(stageId, spec) {
    const out = blindLoadout(stageId).slice();
    if (!spec) return out;
    const want = spec.need;

    for (const [role, need] of Object.entries(want)) {
        for (let k = roleCount(out, role); k < need; k++) {
            const pick = pickOfRole(role, out, spec.prefer);
            if (!pick) break;
            // 정원이 남는 역할 중 **가장 많은** 것을 하나 내준다 (그 안에서는 가장 약한 칸)
            let victim = -1;
            let victimN = 1;
            for (let i = 0; i < out.length; i++) {
                const r = UNIT_DEFS[out[i]].role;
                const n = roleCount(out, r);
                if (n > victimN && n > (want[r] ?? 0)) {
                    victimN = n;
                    victim = i;
                } else if (n === victimN && victim >= 0 && n > (want[r] ?? 0)) {
                    if (UNIT_DEFS[out[i]].cost < UNIT_DEFS[out[victim]].cost) victim = i;
                }
            }
            if (victim < 0) break;
            out[victim] = pick;
        }
    }
    return out;
}

/** 규칙별 답안 후보 전부 */
export const answerCandidates = (stageId, ruleId) =>
    (RULE_ANSWER[ruleId] ?? []).map((spec) => ({
        label: spec.label,
        units: answerLoadout(stageId, spec),
    }));

/**
 * ★★★ **문서가 "깨진다"고 지목한 편성** (22-nightmare.md §2.2 · §3.2 · §4.2).
 *
 *   BN4 의 대조군은 여기다. 처음에는 태그 추천 편성을 대조군으로 썼는데,
 *   ③ 고갈에서 그 편성이 **이미 여섯 종을 서로 다른 동료로 채우고 있어서**
 *   "코스트 분산"이라는 답안과 사실상 같은 편성이 됐다 — 같은 것끼리 비교하니
 *   차이가 0 이고, 게이트는 "규칙이 아무 일도 안 한다"고 보고했다.
 *   **각 규칙이 죽이려는 그 지배 전략**을 대조군으로 세워야 질문이 성립한다.
 */
const strongestOf = (pred) =>
    ALL.filter(pred).sort((a, b) => b.cost - a.cost || (a.id < b.id ? -1 : 1))[0]?.id;
const nOf = (role, n, prefer) =>
    ALL.filter((u) => u.role === role)
        .sort((a, b) =>
            prefer === "cheap" ? a.cost - b.cost || (a.id < b.id ? -1 : 1) : b.cost - a.cost || (a.id < b.id ? -1 : 1)
        )
        .slice(0, n)
        .map((u) => u.id);

export function brokenLoadout(ruleId) {
    switch (ruleId) {
        // ① "방벽 1 + 근접 5" — 전선을 한 점에 고정하는 형태. 그 한 자리가 곧 장판이 된다
        case "plague_bloom":
            return [...nOf("BLOCKER", 1, "strong"), ...nOf("MELEE", 5, "strong")];
        // ② "방벽 2~3 + 저DPS 지속딜" — 붙들어 두고 천천히 녹이는 형태
        case "bond_break":
            return [...nOf("BLOCKER", 3, "strong"), ...nOf("MELEE", 3, "cheap")];
        // ③ "강한 동료 하나를 반복 소환" — 편성 칸 자체가 좁다
        case "attrition":
            return [
                strongestOf((u) => u.role === "BLOCKER"),
                strongestOf((u) => u.role !== "BLOCKER" && u.atk > 0),
            ].filter(Boolean);
        default:
            return [];
    }
}

/* ══════════════════════════════════════════════════════════════
 * 실행
 * ══════════════════════════════════════════════════════════════ */

/**
 * 규칙을 **끈** 나이트메어 설정. 배율은 그대로 두고 규칙만 없앤다.
 *
 * ★ BN2 의 대조군이다. 배율까지 되돌리면 "규칙이 일을 하는가"가 아니라
 *   "나이트메어가 하드보다 어려운가"를 재게 된다 — 그건 이미 아는 사실이다.
 */
function rulesOff(cfg) {
    const R = balance.resources;
    return {
        ...cfg,
        nightmare: null,
        killRefundRatio: R.killRefundRatio,
        summonDecayEnabled: true,
    };
}

/** 성능 관측치 — BN6 · BN7 이 읽는다 */
const perf = { peakEntities: 0, spawnDropped: 0, projectileDropped: 0, eventCounts: [] };

/**
 * 결과 서명 — **승패보다 촘촘한 비교자**.
 *
 * ★ BN2 가 승률만 보면 "양쪽 다 0%" 인 판에서 **규칙이 아무 일도 안 한 것과
 *   구별되지 않는다.** 실제로 첫 실행이 그렇게 실패했다. 같은 시드의 전투가
 *   실제로 다르게 흘렀는지는 방주 HP · 처치 수 · 소요 시간이 말한다
 *   (`sigils:audit` 이 각인에 대해 쓰는 것과 같은 수법).
 */
const signature = (r) => `${r.win ? 1 : 0}/${r.t}/${r.arkHp}/${r.kills}/${r.breaches}/${r.damage}`;

function runOne(cfg, seed, { sample = false } = {}) {
    const s = createSim(cfg, seed);
    let p = 0;
    runToCompletion(
        s,
        (x) => {
            autoPlayTick(x);
            if (!sample) return;
            if (x.actives.length > perf.peakEntities) perf.peakEntities = x.actives.length;
            perf.eventCounts.push(x.events.length);
        },
        400,
        (x) => (seed + p++) % x.pendingDraft.options.length
    );
    if (sample) {
        perf.spawnDropped += s.stats.spawnDropped;
        perf.projectileDropped += s.stats.projectileDropped;
    }
    return {
        win: s.phase === "victory",
        t: s.t,
        arkHp: s.arkHp,
        kills: s.stats.kills,
        breaches: s.stats.breaches,
        damage: Math.round(s.stats.damageDealt),
        stars: computeStars(s),
    };
}

function configFor(stageId, units, { difficulty = "nightmare", off = false, power } = {}) {
    const loadout = withF2PProgression(units, power ?? MAX_POWER_INDEX);
    const cfg = buildStageConfig(stageId, loadout, { difficulty });
    return off ? rulesOff(cfg) : cfg;
}

/**
 * 한 조합의 승률 · ★2 달성률.
 * @param {string[]} units 편성 id 배열
 */
function evaluate(stageId, units, opts = {}) {
    const cfg = configFor(stageId, units, opts);
    const seeds = opts.seeds ?? SEEDS;
    let wins = 0;
    let star2 = 0;
    for (let seed = 0; seed < seeds; seed++) {
        const r = runOne(cfg, seed, { sample: opts.sample });
        if (r.win) wins++;
        if (r.stars >= 2) star2++;
    }
    return { winRate: (wins / seeds) * 100, star2Rate: (star2 / seeds) * 100 };
}

/**
 * ★★★ **편성 비교는 '파워를 맞춘 자리'에서만 성립한다.**
 *
 *   이 게임의 무과금 파워 곡선은 가파르다 (진행도 20 에서 ×6.9, 40 에서 ×41,
 *   60 에서 ×286). 그래서 고정 파워로 재면 어느 스테이지든 **0% 아니면 100%** 로
 *   튀고, "대응 편성이 더 낫다"를 잴 자리가 사라진다. 실측이 정확히 그랬다:
 *   자기 순번 파워에서는 전부 0%, 만렙 파워에서는 월드 1–4 가 전부 100%.
 *
 *   그래서 **대응 편성이 겨우 이기기 시작하는 파워**를 이분 탐색으로 찾고,
 *   그 자리에서 무대응 편성과 비교한다. 그 지점이 "이 스테이지가 편성 퍼즐인가"를
 *   물을 수 있는 유일한 자리다.
 *
 * ★★ 기준은 **무대응 편성**이다. 대응 편성으로 맞추면 "대응이 겨우 이기는 자리"가
 *   되고, 그 자리는 무대응 편성에게 이미 여유로운 파워라 비교가 거꾸로 나온다
 *   (첫 실행에서 무대응 100% · 대응 62.5% 로 그렇게 나왔다).
 *   묻는 것은 **"무대응이 막히는 자리에서 대응이 뚫는가"** 다.
 *
 * @returns {number|null} 무대응 편성이 막히는 파워. 만렙에서도 막히면 null
 */
function calibratePower(stageId, units) {
    const PROBE = 6;
    const at = (idx) => evaluate(stageId, units, { power: idx, seeds: PROBE }).winRate;
    if (at(MAX_POWER_INDEX) < 50) return null; // 만렙으로도 못 이긴다 — 잴 자리가 없다
    let lo = 1;
    let hi = MAX_POWER_INDEX;
    // ★ 상한이 있는 for 로 돈다 — 조건 루프는 판정이 흔들리는 날 멈추지 않는다
    for (let i = 0; i < 8 && lo < hi; i++) {
        const mid = (lo + hi) >> 1;
        if (at(mid) >= 50) hi = mid;
        else lo = mid + 1;
    }
    /**
     * ★★ 문턱에서 **한 칸씩 내려오며 처음으로 40% 이하가 되는 자리**를 쓴다.
     *   고정 폭으로 내리면(처음에는 −4 였다) 어떤 스테이지는 아직 여유롭고
     *   어떤 스테이지는 0% 바닥이라 **둘 다 아무것도 재지 못한다** — 실제로
     *   1-19 가 파워 11 에서 모든 편성 8% 였다. 위쪽이 아니라 **경계**가 필요하다.
     */
    for (let d = 1; d <= 8; d++) {
        const p = Math.max(1, hi - d);
        if (at(p) <= 40) return p;
        if (p === 1) break;
    }
    return Math.max(1, hi - 1);
}

const pct = (n) => `${n.toFixed(1)}%`;

/* ══════════════════════════════════════════════════════════════
 * 게이트
 * ══════════════════════════════════════════════════════════════ */

/**
 * BN1–BN8 을 판정한다.
 * @returns {Array<{id,gate,name,pass,detail}>} `balance-check.mjs` 의 결과 배열과 같은 모양
 */
export function runNightmareGates({ HARD = "하드", SOFT = "소프트" } = {}) {
    const out = [];
    const add = (id, gate, name, pass, detail) => out.push({ id, gate, name, pass, detail });

    /**
     * 규칙 스테이지마다 **비교가 성립하는 파워**를 한 번만 재고 BN2·BN4·BN5 가 나눠 쓴다.
     * ★ 세 게이트가 각자 재면 같은 스테이지를 다른 파워에서 보게 되고, 그러면
     *   "BN2 는 규칙이 산다는데 BN4 는 아무 차이가 없다" 같은 모순된 보고가 나온다.
     */
    const CAL = new Map();
    for (const stageId of RULE_STAGES) {
        const blind = blindLoadout(stageId);
        const rule = nightmareFor(Number(stageId.split("-")[0]));
        CAL.set(stageId, {
            rule,
            blind,
            answers: answerCandidates(stageId, rule.id),
            power: calibratePower(stageId, blind),
        });
    }
    /** 잴 자리를 못 찾은 스테이지는 만렙에서 본다 (그 사실은 BN4 가 따로 신고한다) */
    const powerOf = (stageId) => CAL.get(stageId).power ?? MAX_POWER_INDEX;

    /* ── BN1 결정론 ─────────────────────────────────────────── */
    {
        const bad = [];
        for (const stageId of RULE_STAGES) {
            const cfg = configFor(stageId, blindLoadout(stageId));
            for (const seed of [1, 7]) {
                if (signature(runOne(cfg, seed)) !== signature(runOne(cfg, seed))) {
                    bad.push(`${stageId}#${seed}`);
                }
            }
        }
        add(
            "BN1",
            HARD,
            "결정론 — 규칙을 켠 상태에서 같은 시드 2회가 완전히 일치",
            bad.length === 0,
            bad.length
                ? `불일치: ${bad.join(", ")} — 규칙 어딘가에 난수가 들어갔다 (절대규칙 6)`
                : `${RULE_STAGES.length}스테이지 × 2시드 전부 일치`
        );
    }

    /* ── BN2 규칙 유효성 (켠 것과 끈 것이 다른가) ────────────── */
    {
        const detail = [];
        let effective = 0;
        for (const stageId of RULE_STAGES) {
            const { rule, blind: units } = CAL.get(stageId);
            const power = powerOf(stageId);
            const on = configFor(stageId, units, { power });
            const off = configFor(stageId, units, { off: true, power });
            let differ = 0;
            for (let seed = 0; seed < SEEDS; seed++) {
                if (signature(runOne(on, seed, { sample: true })) !== signature(runOne(off, seed))) {
                    differ++;
                }
            }
            if (differ > 0) effective++;
            detail.push(`${stageId}(${rule.id}) 파워${power}: ${differ}/${SEEDS} 시드에서 결과가 달라진다`);
        }
        add(
            "BN2",
            HARD,
            "규칙 유효성 — 규칙을 끈 나이트메어와 같은 시드 결과가 다르다",
            effective === RULE_STAGES.length,
            detail.join(" | ") +
                (effective === RULE_STAGES.length
                    ? ""
                    : " — 결과가 같은 규칙은 **적혀만 있고 아무 일도 하지 않는다**")
        );
    }

    /* ── BN3 통과 가능성 ────────────────────────────────────── */
    {
        /**
         * ★★ 실패했을 때 **원인을 함께 신고한다.** "규칙이 어려운가"와
         *   "배율만으로도 못 지나가는가"는 완전히 다른 처방이다 — 앞이면 규칙을,
         *   뒤면 배율(또는 그 스테이지 자체)을 고쳐야 한다. 둘을 구분하지 않는
         *   실패 보고는 다음 사람에게 아무것도 알려 주지 않는다.
         */
        const rows = [];
        for (const stageId of WORLD_LAST) {
            const rule = nightmareFor(Number(stageId.split("-")[0]));
            // ★ 답안 후보 중 **가장 잘 되는 것**으로 본다. "이 스테이지를 통과할
            //   방법이 있는가"를 묻는 자리이지 특정 편성을 심판하는 자리가 아니다.
            let best = evaluate(stageId, blindLoadout(stageId), { sample: true }).winRate;
            let bestUnits = blindLoadout(stageId);
            for (const c of answerCandidates(stageId, rule.id)) {
                const w = evaluate(stageId, c.units, { sample: true }).winRate;
                if (w > best) {
                    best = w;
                    bestUnits = c.units;
                }
            }
            const row = { stageId, rule: rule.id, win: best, off: null };
            if (best < 40) row.off = evaluate(stageId, bestUnits, { off: true }).winRate;
            rows.push(row);
        }
        const fails = rows.filter((r) => r.win < 40);
        const blame = fails
            .filter((r) => r.off !== null && r.off < 40)
            .map((r) => r.stageId);
        add(
            "BN3",
            HARD,
            "통과 가능성 — 월드 마지막 스테이지를 대응 편성 · 무과금 만렙 파워로 승률 ≥40%",
            fails.length === 0,
            rows
                .map((r) => `${r.stageId} ${pct(r.win)}${r.off === null ? "" : `(규칙끔 ${pct(r.off)})`}`)
                .join(" · ") +
                (blame.length
                    ? ` — ${blame.join(", ")} 은 **규칙을 전부 꺼도** 못 지나간다. ` +
                      `원인은 나이트메어 규칙이 아니라 배율(×${balance.difficulty.levels.nightmare.enemyHpMult}) ` +
                      `또는 그 스테이지 자체다`
                    : "")
        );
    }

    /* ── BN4 · BN5 편성이 답인가 / 스탯 벽인가 ──────────────── */
    {
        const rows = [];
        for (const stageId of RULE_STAGES) {
            const { rule, blind, answers } = CAL.get(stageId);
            const power = powerOf(stageId);
            const b = evaluate(stageId, blind, { power, sample: true }).winRate;
            const broken = evaluate(stageId, brokenLoadout(rule.id), { power }).winRate;
            let best = { label: "—", win: -1 };
            for (const c of answers) {
                const w = evaluate(stageId, c.units, { power }).winRate;
                if (w > best.win) best = { label: c.label, win: w };
            }
            rows.push({ stageId, rule: rule.id, power, blind: b, broken, ...best });
        }

        const gap = rows.filter((r) => r.win - r.broken >= 20);
        add(
            "BN4",
            HARD,
            "★ 편성이 답이다 — 답안 편성이 **그 규칙이 죽이려는 편성**보다 승률 +20%p 이상",
            gap.length >= Math.ceil(rows.length / 2),
            rows
                .map(
                    (r) =>
                        `${r.stageId}(${r.rule}) 파워${r.power}: 지배전략 ${pct(r.broken)} → ${r.label} ${pct(r.win)}`
                )
                .join(" | ") +
                ` — ${gap.length}/${rows.length} 통과. 실패하면 규칙이 편성으로 풀리지 않는다는 뜻이고, ` +
                `그때 고칠 것은 배율이 아니라 규칙이다`
        );

        /**
         * ★★ **파워로 밀어붙여도 안 되는가.** 위 BN4 는 파워를 맞춰 놓고 비교하므로
         *   "그 파워에서 못 이긴다"는 결론이 교정 방식에 딸려 온다 — 순환이다.
         *   여기서는 교정을 걷어내고 **무과금 만렙 파워**에서 지배전략 편성을 돌린다.
         *   거기서도 못 이긴다면 그 규칙은 파워로 사는 것이 아니라 **편성을 요구한다.**
         */
        const maxed = rows.map((r) => ({
            stageId: r.stageId,
            win: evaluate(r.stageId, brokenLoadout(r.rule), { power: MAX_POWER_INDEX }).winRate,
        }));
        const wall = maxed.filter((r) => r.win < 25);
        add(
            "BN5",
            SOFT,
            "스탯 벽 아님 — 지배전략 편성은 **무과금 만렙 파워로도** 승률 <25%",
            wall.length >= Math.ceil(maxed.length / 2),
            maxed.map((r) => `${r.stageId} ${pct(r.win)}`).join(" · ") +
                ` — ${wall.length}/${maxed.length}. 파워만으로 통과되면 그 규칙은 아무것도 요구하지 않는다`
        );
    }

    /* ── BN6 · BN7 성능 ─────────────────────────────────────── */
    {
        const POOL = 288; // logic/state.js:ENTITY_POOL — 넘으면 스폰이 조용히 실패한다
        const ok = perf.spawnDropped === 0 && perf.projectileDropped === 0;
        add(
            "BN6",
            HARD,
            "동시 엔티티 — 풀 고갈 0",
            ok,
            `최대 동시 ${perf.peakEntities}체 (풀 ${POOL}) · 태어나지 못한 개체 ${perf.spawnDropped} · 탄 ${perf.projectileDropped}` +
                (ok ? "" : " — 고갈된 만큼 그 판은 조용히 쉬워지고, 위의 승률은 쉬워진 판을 잰 것이다")
        );

        const counts = perf.eventCounts.slice().sort((a, b) => a - b);
        const p99 = counts.length ? counts[Math.min(counts.length - 1, Math.floor(counts.length * 0.99))] : 0;
        add(
            "BN7",
            HARD,
            "틱당 이벤트 p99 ≤ 24 (나이트메어 최대 밀도)",
            p99 <= 24,
            `p99 ${p99} · 표본 ${counts.length}틱 · 최대 ${counts[counts.length - 1] ?? 0}`
        );
    }

    /* ── BN8 해금 도달성 ────────────────────────────────────── */
    {
        /**
         * ★★ 묻는 것은 "평균이 높은가"가 아니라 **"0 인 스테이지가 있는가"** 다.
         *   해금 조건은 그 월드 **전 스테이지** 하드 ★2 이고, 별은 재도전으로
         *   누적되므로 확률이 낮아도 언젠가는 된다. 그러나 **한 곳이라도 0 이면
         *   그 월드의 나이트메어는 영원히 열리지 않는다** — 도달성 검사기는
         *   그것을 볼 수 없다(별을 가정하니까). 여기가 유일한 관측 지점이다.
         */
        const rows = HARD_SAMPLE.map((stageId) => ({
            stageId,
            ...evaluate(stageId, blindLoadout(stageId), {
                difficulty: "hard",
                power: MAX_POWER_INDEX,
            }),
        }));
        const zero = rows.filter((r) => r.star2Rate <= 0);
        const avg = rows.reduce((a, r) => a + r.star2Rate, 0) / rows.length;
        /**
         * ★ 게이트 등급이 **소프트**인 이유: 이 저장소의 별 게이트(B10 · B11)가 전부
         *   소프트다. 별은 자동 플레이가 가장 못하는 축이고(효율 65–75%, B12),
         *   "자동으로 0%"가 "사람도 못 한다"는 뜻은 아니다. 그러나 조용히 넘기지도
         *   않는다 — 0% 인 스테이지는 이름을 찍는다.
         */
        add(
            "BN8",
            SOFT,
            "해금 도달성 — 하드 ★2 가 전 표본에서 달성 가능하다",
            zero.length === 0,
            rows.map((r) => `${r.stageId} ★2 ${pct(r.star2Rate)}`).join(" · ") +
                ` · 평균 ${pct(avg)}` +
                (zero.length
                    ? ` — ★2 가 한 번도 안 나오는 스테이지: ${zero.map((r) => r.stageId).join(", ")}. ` +
                      `그 월드의 나이트메어는 열리지 않는다`
                    : "")
        );
    }

    return out;
}
