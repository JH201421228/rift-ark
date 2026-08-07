/**
 * 헤드리스 밸런스 하네스 (P4-08)
 *
 * ★ 시뮬이 순수 함수 · 시드 PRNG · 고정 30Hz 이므로 Node 에서 그대로 돌아간다.
 *   90초 전투를 실시간의 수백 배로 실행해 수천 판을 몇 초에 끝낸다.
 *   200 스테이지 × 44 유닛 × 75 각인을 손으로 밸런싱하는 것은 불가능하다.
 *
 * 사용:
 *   npm run balance                      # 300 시드
 *   SEEDS=50 npm run balance             # 빠른 확인
 *   DIFFICULTY=hard npm run balance      # 하드 난이도 측정 (P6-10)
 *
 * ★ 난이도를 인자로 받는 것이 하드의 **유일한 검증 수단**이다.
 *   "하드가 더 어렵다"는 데이터 파일을 읽어서 주장할 수 있는 명제가 아니다 —
 *   스폰 수 배율은 승률에 비선형으로 작용하고, 광역 편성과 단일 대상 편성이
 *   전혀 다르게 반응한다. 같은 시드·같은 편성으로 두 번 돌려 비교해야 한다.
 *
 * @see docs/03-tech/27-testing-balance-harness.md
 */
import { writeFile } from "node:fs/promises";
import { createSim, runToCompletion, computeStars } from "../src/game/logic/sim.js";
import { buildStageConfig, globalStageIndex } from "../src/game/logic/stageConfig.js";
import { autoPlayTick } from "../src/game/logic/autoPlay.js";
import stagesData from "../src/game/data/stages.json" with { type: "json" };
import enemiesData from "../src/game/data/enemies.json" with { type: "json" };
import { DEFAULT_DIFFICULTY, difficultyDef } from "../src/game/logic/difficulty.js";
import { ARCHETYPES, recommendedLoadoutForStage } from "./lib/loadouts.mjs";
import { stageEnemyCounts, stageCounterTags } from "../src/game/logic/stagePreview.js";
import { withF2PProgression } from "./lib/f2p-power.mjs";

const SEEDS = Number(process.env.SEEDS ?? 300);
const DIFFICULTY = process.env.DIFFICULTY ?? DEFAULT_DIFFICULTY;
// ★ 난이도별 결과가 같은 파일을 덮어쓰면 비교 자체가 불가능해진다.
const OUT =
    process.env.OUT ??
    (DIFFICULTY === DEFAULT_DIFFICULTY ? "balance-report.csv" : `balance-report-${DIFFICULTY}.csv`);

/**
 * ★ 튜닝 반복용 필터. 전체는 9편성 × 60스테이지 = 3분이 걸려
 *   "수치 바꾸고 확인"을 몇 번 못 돈다.
 *     LOADOUTS=recommended SEEDS=8 npm run balance   → 20초
 *   최종 확인은 반드시 필터 없이 돌린다.
 */
const ONLY = process.env.LOADOUTS ? new Set(process.env.LOADOUTS.split(",")) : null;
const STAGE_FILTER = process.env.STAGES ? new RegExp(process.env.STAGES) : null;

const ENEMY = new Map(enemiesData.enemies.map((e) => [e.id, e]));

/**
 * 한 조합을 SEEDS 번 돌려 통계를 낸다.
 * @param {object} stage
 * @param {Array} loadout 성장 적용된 슬롯 배열
 */
function evaluate(stage, loadout) {
    const cfg = buildStageConfig(stage.id, loadout, { difficulty: DIFFICULTY });
    let wins = 0;
    let secSum = 0;
    let hpSum = 0;
    let s2 = 0;
    let s3 = 0;
    let killSum = 0;
    let draftSum = 0;
    const sigilCount = Object.create(null);

    for (let seed = 0; seed < SEEDS; seed++) {
        const s = createSim(cfg, seed);
        // ★ 드래프트 선택을 시드별로 돌린다.
        //   항상 첫 선택지만 고르면 픽률이 "첫 롤 확률"이 되어 B13 측정이 왜곡된다.
        //   시드마다 다른 칸을 고르면 실제 플레이어 선택 분포에 가까워진다.
        let pickN = 0;
        const policy = (st) => (seed + pickN++) % st.pendingDraft.options.length;
        runToCompletion(s, (st) => autoPlayTick(st), 400, policy);

        const sec = s.t / 1000;
        killSum += s.stats.kills;
        draftSum += s.draftsTaken;
        for (const id of s.sigils) sigilCount[id] = (sigilCount[id] ?? 0) + 1;

        if (s.phase === "victory") {
            wins++;
            secSum += sec;
            hpSum += s.arkHp;
            const stars = computeStars(s);
            if (stars >= 2) s2++;
            if (stars >= 3) s3++;
        }
    }

    return {
        winRate: (wins / SEEDS) * 100,
        avgSec: wins ? secSum / wins : 0,
        avgArkHp: wins ? hpSum / wins : 0,
        star2Rate: (s2 / SEEDS) * 100,
        star3Rate: (s3 / SEEDS) * 100,
        avgKills: killSum / SEEDS,
        avgDrafts: draftSum / SEEDS,
        sigilCount,
    };
}

async function main() {
    const rows = [
        [
            "stageId",
            "loadout",
            "winRate",
            "avgSec",
            "avgArkHp",
            "star2Rate",
            "star3Rate",
            "avgKills",
            "avgDrafts",
        ],
    ];
    const sigilTotals = Object.create(null);
    let sigilRuns = 0;

    const diffDef = difficultyDef(DIFFICULTY);
    console.log(`── 밸런스 하네스 ─────────────────────────────`);
    console.log(`스테이지 ${stagesData.stages.length} × 편성 ${ARCHETYPES.length + 1} × 시드 ${SEEDS}`);
    console.log(
        `난이도 ${diffDef?.name?.ko ?? DIFFICULTY} ` +
            `(HP ×${diffDef?.enemyHpMult ?? 1} · ATK ×${diffDef?.enemyAtkMult ?? 1} · ` +
            `스폰 ×${diffDef?.spawnCountMult ?? 1})\n`
    );
    console.log("스테이지  편성            승률   평균초  방주   ★2     ★3");

    const t0 = Date.now();

    for (const stage of stagesData.stages) {
        if (STAGE_FILTER && !STAGE_FILTER.test(stage.id)) continue;
        const gIdx = globalStageIndex(stage.id);

        // ★ 추천 편성은 무과금 파워로 평가한다 — B4 게이트의 근거
        const combos = [
            // ★ 태그가 아니라 **스테이지 id** 를 넘긴다 — 마릿수를 알아야 '닿는 답'이 나온다
            { id: "recommended", label: "추천", units: recommendedLoadoutForStage(stage.id) },
            ...ARCHETYPES,
        ];

        for (const combo of combos) {
            if (!combo.units.length) continue;
            if (ONLY && !ONLY.has(combo.id)) continue;
            const loadout = withF2PProgression(combo.units, gIdx);
            const r = evaluate(stage, loadout);

            rows.push([
                stage.id,
                combo.id,
                r.winRate.toFixed(1),
                r.avgSec.toFixed(1),
                r.avgArkHp.toFixed(1),
                r.star2Rate.toFixed(1),
                r.star3Rate.toFixed(1),
                r.avgKills.toFixed(1),
                r.avgDrafts.toFixed(2),
            ]);

            for (const [id, n] of Object.entries(r.sigilCount)) {
                sigilTotals[id] = (sigilTotals[id] ?? 0) + n;
            }
            sigilRuns += SEEDS;

            const flag = r.winRate < 25 ? "⚠" : " ";
            console.log(
                `${flag}${stage.id.padEnd(8)} ${combo.id.padEnd(15)} ` +
                    `${r.winRate.toFixed(1).padStart(5)}%  ` +
                    `${r.avgSec.toFixed(0).padStart(5)}  ` +
                    `${r.avgArkHp.toFixed(0).padStart(4)}  ` +
                    `${r.star2Rate.toFixed(0).padStart(4)}%  ${r.star3Rate.toFixed(0).padStart(4)}%`
            );
        }
    }

    await writeFile(OUT, rows.map((r) => r.join(",")).join("\n"));

    // 각인 픽률 (B13)
    const totalPicks = Object.values(sigilTotals).reduce((a, b) => a + b, 0);
    const sigilRows = [["sigilId", "picks", "pickRatePct"]];
    for (const id of Object.keys(sigilTotals).sort()) {
        sigilRows.push([id, sigilTotals[id], ((sigilTotals[id] / totalPicks) * 100).toFixed(2)]);
    }
    const sigilOut =
        DIFFICULTY === DEFAULT_DIFFICULTY
            ? "balance-sigils.csv"
            : `balance-sigils-${DIFFICULTY}.csv`;
    await writeFile(sigilOut, sigilRows.map((r) => r.join(",")).join("\n"));

    console.log(`\n───────────────────────────────────────────────`);
    console.log(
        `${rows.length - 1} 조합 · ${sigilRuns} 전투 · ${((Date.now() - t0) / 1000).toFixed(1)}초`
    );
    console.log(`→ ${OUT}, ${sigilOut}`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
