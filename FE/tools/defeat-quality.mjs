/**
 * 패배의 質 측정 (P7-03)
 *
 * ★ 승률만 맞추면 "설계된 첫 패배"가 완성되지 않는다.
 *
 *   1-9 는 설계된 첫 패배다. 가르치려는 명제는 **"편성을 바꾸면 넘는다"**
 *   이고, 그건 플레이어가 **아깝게 졌다고 느낄 때만** 전달된다.
 *   웨이브 절반에서 방주가 터지면 "내 편성이 문제였구나"가 아니라
 *   "이건 벽이구나"가 되고, 그 순간 이탈한다.
 *
 *   그래서 목표는 두 개다:
 *     1) 승률 30–45%          → 게이트 B3 (`balance-check.mjs`)
 *     2) 패배 시 적 잔여 5–15% → **이 스크립트** (P7-03)
 *
 * ★ "잔여"는 남은 **개체 수**가 아니라 남은 **HP 총량**이다.
 *   저HP 다수(SWARM)와 고HP 소수가 섞이면 마릿수는 진행도를 대변하지 못한다 —
 *   구더기 20마리와 코뿔소 1마리가 같은 '20% 남음'이 되어 버린다.
 *
 * 사용:
 *   node tools/defeat-quality.mjs
 *   SEEDS=200 STAGES='^1-9$' node tools/defeat-quality.mjs
 *
 * @see docs/04-plan/33-execution-plan.md P7-03
 */
import { createSim, runToCompletion } from "../src/game/logic/sim.js";
import { buildStageConfig, globalStageIndex } from "../src/game/logic/stageConfig.js";
import { autoPlayTick } from "../src/game/logic/autoPlay.js";
import stagesData from "../src/game/data/stages.json" with { type: "json" };
import { DEFAULT_DIFFICULTY } from "../src/game/logic/difficulty.js";
import { ARCHETYPES, recommendedLoadoutForStage } from "./lib/loadouts.mjs";
import { withF2PProgression } from "./lib/f2p-power.mjs";
import enemiesData from "../src/game/data/enemies.json" with { type: "json" };
import { totalEnemyHp, remainingEnemyHp, outcomeOf } from "./lib/defeat.mjs";

const SEEDS = Number(process.env.SEEDS ?? 200);
const DIFFICULTY = process.env.DIFFICULTY ?? DEFAULT_DIFFICULTY;
const STAGE_FILTER = process.env.STAGES ? new RegExp(process.env.STAGES) : null;
/**
 * ★★ 어떤 편성으로 재는가가 이 측정의 전부다.
 *
 *   기본값이 `recommended` 였는데, 그건 **태그 최적 편성**이다.
 *   "올바른 편성으로 왔는데 아깝게 졌는가"는 P7-03 이 묻는 질문이 아니다.
 *   1-9 에서 지는 사람은 **아직 답을 모르는 사람**이고, 그가 들고 온 편성으로
 *   재야 "조금만 고치면 넘겠다"가 전달되는지 알 수 있다.
 *
 *   LOADOUTS=c_only,balanced node tools/defeat-quality.mjs
 */
const LOADOUTS = (process.env.LOADOUTS ?? "recommended").split(",");

/** P7-03 목표 밴드 */
const TARGET_MIN = 5;
const TARGET_MAX = 15;

const ENEMY = new Map(enemiesData.enemies.map((e) => [e.id, e]));

function unitsFor(id, stage) {
    // ★ 사본 금지. 이 파일에도 자체 `stageTags()` 가 있었는데 보스 페이즈 태그가
    //   빠져 있었고 마릿수도 몰랐다 — 게이트가 재는 편성과 다른 편성을 재고 있었다.
    if (id === "recommended") return recommendedLoadoutForStage(stage.id);
    const a = ARCHETYPES.find((x) => x.id === id);
    if (!a) throw new Error(`알 수 없는 편성: ${id}`);
    return a.units;
}

function measure(stage, comboId) {
    const loadout = withF2PProgression(unitsFor(comboId, stage), globalStageIndex(stage.id));
    const cfg = buildStageConfig(stage.id, loadout, { difficulty: DIFFICULTY });
    const total = totalEnemyHp(cfg);

    const remains = [];
    let wins = 0;
    let timeouts = 0;
    for (let seed = 0; seed < SEEDS; seed++) {
        const s = createSim(cfg, seed);
        let pickN = 0;
        const policy = (st) => (seed + pickN++) % st.pendingDraft.options.length;
        runToCompletion(s, (st) => autoPlayTick(st), 400, policy);

        const outcome = outcomeOf(s);
        if (outcome === "victory") {
            wins++;
            continue;
        }
        // ★ 시간 초과는 "아깝게 진 것"이 아니라 **끝나지 않은 판**이다 (lib/defeat.mjs 참조).
        //   잔여 지표에 섞으면 완벽한 접전처럼 보인다.
        if (outcome === "timeout") {
            timeouts++;
            continue;
        }
        remains.push((remainingEnemyHp(s) / total) * 100);
    }

    remains.sort((a, b) => a - b);
    const n = remains.length;
    const pct = (q) => (n ? remains[Math.min(n - 1, Math.floor(q * n))] : NaN);
    return {
        winRate: (wins / SEEDS) * 100,
        timeoutRate: (timeouts / SEEDS) * 100,
        defeats: n,
        median: pct(0.5),
        p25: pct(0.25),
        p75: pct(0.75),
        // 밴드 안에서 진 비율 — "아깝게 진 판이 얼마나 되는가"
        inBand: n
            ? (remains.filter((r) => r >= TARGET_MIN && r <= TARGET_MAX).length / n) * 100
            : 0,
    };
}

const targets = stagesData.stages.filter((s) =>
    STAGE_FILTER ? STAGE_FILTER.test(s.id) : s.designedDefeat
);

console.log(`── 패배의 質 (P7-03) ─────────────────────────`);
console.log(`시드 ${SEEDS} · 난이도 ${DIFFICULTY} · 추천 편성`);
console.log(`목표: 패배 시 적 잔여 HP ${TARGET_MIN}–${TARGET_MAX}%`);
console.log(`───────────────────────────────────────────────`);
console.log(`스테이지 편성           승률   패배수  잔여HP 중앙값 (25~75%)   밴드내  타임아웃`);

let fail = 0;
for (const stage of targets) {
  for (const comboId of LOADOUTS) {
    const r = measure(stage, comboId);
    const ok = r.median >= TARGET_MIN && r.median <= TARGET_MAX;
    if (!ok) fail++;
    console.log(
        `${ok ? " " : "⚠"}${stage.id.padEnd(6)} ${comboId.padEnd(14)} ` +
            `${r.winRate.toFixed(1).padStart(5)}%  ` +
            `${String(r.defeats).padStart(5)}  ` +
            `${r.median.toFixed(1).padStart(8)}%  ` +
            `(${r.p25.toFixed(1)}~${r.p75.toFixed(1)}%)`.padStart(16) +
            `  ${r.inBand.toFixed(0).padStart(4)}%  ${r.timeoutRate.toFixed(0).padStart(6)}%`
    );
  }
}

console.log(`───────────────────────────────────────────────`);
if (!targets.length) {
    console.log("측정 대상 없음 (designedDefeat 스테이지가 없다)");
} else if (fail) {
    console.log(`✗ ${fail} 조합이 목표 밴드 밖이다`);
    process.exitCode = 1;
} else {
    console.log(`✅ 전 조합 통과`);
}
