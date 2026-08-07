/**
 * 추천 편성 규칙 실험
 *
 * ★ `recommendedLoadout` 은 게이트 B4("무과금 추천 ≥55%")의 **기준**이다.
 *   추천이 최적이 아니면 B4 가 보증하는 것이 없어진다 — 실제로 3-20 에서
 *   `recommended`(66.7%) 가 `physical_only`(93.3%) 보다 약했다.
 *
 * ★ 어떤 채우기 규칙이 나은지는 **의견이 아니라 측정**으로 정한다.
 *   후보 규칙을 전 스테이지에 돌려 평균 승률과 최저 승률을 비교한다.
 *   평균만 보면 안 된다 — 벽 스테이지 하나가 B4 를 깨기 때문에 **최저**가 더 중요하다.
 *
 * ★★ **이 파일은 선택 로직의 사본을 갖지 않는다.** 예전에는 `counters()` 를 통째로
 *   복사해 갖고 있었고, 본체에 '닿는 답' 규칙(2026-08-03)이 들어온 뒤에도 사본은
 *   옛 규칙 그대로였다 — 실험이 **현재 존재하지 않는 규칙**을 재고 있었던 셈이다.
 *   지금은 본체(`recommendedLoadout`)에 `{blockerCount, fillOrder}` 손잡이를 주고
 *   본체를 그대로 돌린다. 실험 대상은 손잡이뿐이다.
 *
 * 사용:
 *   SEEDS=20 node tools/exp-recommend.mjs
 *   SEEDS=30 STAGES='^[123]-(10|20)$' node tools/exp-recommend.mjs
 */
import { createSim, runToCompletion } from "../src/game/logic/sim.js";
import { buildStageConfig, globalStageIndex } from "../src/game/logic/stageConfig.js";
import { autoPlayTick } from "../src/game/logic/autoPlay.js";
import { stageEnemyCounts, recommendedLoadout } from "../src/game/logic/stagePreview.js";
import stagesData from "../src/game/data/stages.json" with { type: "json" };
import { withF2PProgression } from "./lib/f2p-power.mjs";

const SEEDS = Number(process.env.SEEDS ?? 20);
const STAGE_FILTER = process.env.STAGES ? new RegExp(process.env.STAGES) : null;

const RANGED_FIRST = ["RANGED", "MELEE", "CASTER", "SUPPORT", "SIEGE", "FLYER", "BLOCKER"];
const SIEGE_FIRST = ["SIEGE", "RANGED", "MELEE", "CASTER", "SUPPORT", "FLYER", "BLOCKER"];

const RULES = [
    { id: "current", label: "현행 (방벽2 · 원거리 우선)", opts: {} },
    { id: "blocker1", label: "방벽1", opts: { blockerCount: 1, fillOrder: RANGED_FIRST } },
    { id: "blocker2_siege", label: "방벽2 + 공성 우선", opts: { blockerCount: 2, fillOrder: SIEGE_FIRST } },
    { id: "blocker3", label: "방벽3", opts: { blockerCount: 3, fillOrder: RANGED_FIRST } },
];

function winRate(stageId, unitIds) {
    const loadout = withF2PProgression(unitIds, globalStageIndex(stageId));
    const cfg = buildStageConfig(stageId, loadout);
    let wins = 0;
    for (let seed = 0; seed < SEEDS; seed++) {
        const s = createSim(cfg, seed);
        let pickN = 0;
        runToCompletion(
            s,
            (st) => autoPlayTick(st),
            400,
            (st) => (seed + pickN++) % st.pendingDraft.options.length
        );
        if (s.phase === "victory") wins++;
    }
    return (wins / SEEDS) * 100;
}

const stages = stagesData.stages.filter((s) => (STAGE_FILTER ? STAGE_FILTER.test(s.id) : true));

console.log(`── 추천 편성 규칙 실험 ────────────────────────`);
console.log(`스테이지 ${stages.length} × 규칙 ${RULES.length} × 시드 ${SEEDS}`);
console.log(`───────────────────────────────────────────────`);

const out = [];
for (const rule of RULES) {
    const worst = [];
    for (const stage of stages) {
        // ★ 태그가 아니라 집계를 넘긴다 — 마릿수를 알아야 '닿는 답'이 나온다
        const units = recommendedLoadout(stageEnemyCounts(stage.id), null, rule.opts);
        worst.push({ id: stage.id, r: winRate(stage.id, units) });
    }
    worst.sort((a, b) => a.r - b.r);
    const avg = worst.reduce((a, b) => a + b.r, 0) / worst.length;
    // B4 는 55% 미만이 **하나라도** 있으면 실패한다 — 최저와 미달 개수가 핵심이다
    const below = worst.filter((w) => w.r < 55);
    out.push({ rule, avg, below: below.length });
    console.log(
        `${rule.id.padEnd(16)} 평균 ${avg.toFixed(1).padStart(5)}%  ` +
            `55%미만 ${String(below.length).padStart(2)}개  ` +
            `벽(<25%) ${String(worst.filter((w) => w.r < 25).length).padStart(2)}개  ` +
            `최저: ${worst.slice(0, 3).map((w) => `${w.id}(${w.r.toFixed(0)}%)`).join(" ")}`
    );
}

console.log(`───────────────────────────────────────────────`);
const best = out.slice().sort((a, b) => a.below - b.below || b.avg - a.avg)[0];
console.log(`→ B4 기준 최적: ${best.rule.id} (${best.rule.label})`);
