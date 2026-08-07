/**
 * P7-03 — 설계된 첫 패배(1-9) 튜닝
 *
 * ★★ 이 티켓이 어려운 이유는 **두 목표가 같은 손잡이를 공유**하기 때문이다.
 *     B3      승률 30–45%
 *     P7-03   패배 시 적 잔여 HP 5–15%   ("아깝게 졌다")
 *   총압력을 올리면 승률은 내려가지만 자동 플레이가 **초반에** 무너져 잔여가 80%대가 되고,
 *   총압력을 내리면 잔여는 좋아지지만 승률이 80% 위로 뜬다.
 *   배율 · 웨이브 수 · 방주 HP · 후반 급증으로 7회 스윕해도 동시 만족점이 없었다.
 *
 * ★ 그래서 **축을 하나 더 넣었다** — `arkRegenPerWave`(웨이브 사이 방주 회복).
 *   회복은 초반 누적을 상쇄하고(= 오래 버틴다), 후반 급증은 회복을 넘어선다(= 결국 진다).
 *   **초반 생존과 후반 치사성을 분리하는** 유일한 직접 수단이다.
 *
 * ★ 이 도구는 스테이지 데이터를 **건드리지 않는다.** `buildStageConfig` 결과를
 *   메모리에서 덮어써 후보값을 시험할 뿐이다. 확정된 값만 사람이 데이터에 적는다.
 *   (도구가 데이터를 쓰면 "누가 언제 무엇을 왜 바꿨는지"가 사라진다.)
 *
 * 사용:
 *   node tools/tune-first-defeat.mjs
 *   SEEDS=200 REGEN=0,2,4,6 node tools/tune-first-defeat.mjs
 */
import { createSim, runToCompletion } from "../src/game/logic/sim.js";
import { buildStageConfig, globalStageIndex } from "../src/game/logic/stageConfig.js";
import { autoPlayTick } from "../src/game/logic/autoPlay.js";
import { recommendedLoadoutForStage } from "./lib/loadouts.mjs";
import { withF2PProgression } from "./lib/f2p-power.mjs";
import stagesData from "../src/game/data/stages.json" with { type: "json" };
import enemiesData from "../src/game/data/enemies.json" with { type: "json" };
// ★ 잔여 HP 집계는 defeat-quality.mjs 와 **같은 함수**를 쓴다 (사본 금지)
import { totalEnemyHp, remainingEnemyHp, outcomeOf } from "./lib/defeat.mjs";

const STAGE = process.env.TUNE_STAGE ?? "1-9";
const SEEDS = Number(process.env.SEEDS ?? 150);

const REGEN = (process.env.REGEN ?? "0,2,4,6,8,10,12").split(",").map(Number);
const MULT = (process.env.MULT ?? "3.75").split(",").map(Number);
/** 후반 N 웨이브 물량 배율 — `beat.surge` 를 메모리에서 흉내낸다 */
const SURGE = (process.env.SURGE ?? "1,1.5,2,2.5,3").split(",").map(Number);
const SURGE_WAVES = Number(process.env.SURGE_WAVES ?? 4);

const B3 = { min: 30, max: 45 };
const P703 = { min: 5, max: 15 };

const ENEMY = new Map(enemiesData.enemies.map((e) => [e.id, e]));
const stage = stagesData.stages.find((s) => s.id === STAGE);
if (!stage) throw new Error(`알 수 없는 스테이지: ${STAGE}`);

const baseUnits = recommendedLoadoutForStage(STAGE);
const baseLoadout = withF2PProgression(baseUnits, globalStageIndex(STAGE));

/** 후반 SURGE_WAVES 개 웨이브의 물량을 배율만큼 늘린 웨이브 테이블 */
function surged(waveTable, mult) {
    if (mult === 1) return waveTable;
    const last = Math.max(...waveTable.map((w) => w.wave));
    return waveTable.map((w) =>
        w.wave <= last - SURGE_WAVES
            ? w
            : {
                  ...w,
                  spawns: w.spawns.map((sp) => {
                      const def = ENEMY.get(sp.id);
                      // 유일 개체는 복제하지 않는다 (spawn.js:spawnCountFor 와 같은 명제)
                      const unique = !!def?.boss?.phases?.length || !!def?.giant;
                      return unique ? sp : { ...sp, count: Math.max(1, Math.round(sp.count * mult)) };
                  }),
              }
    );
}

function measure({ regen, mult, surge }) {
    const cfg = buildStageConfig(STAGE, baseLoadout);
    cfg.arkRegenPerWave = regen;
    cfg.waveTable = surged(cfg.waveTable, surge);
    if (mult !== stage.difficultyMult) {
        const k = mult / (stage.difficultyMult ?? 1);
        cfg.enemyDefs = Object.fromEntries(
            Object.entries(cfg.enemyDefs).map(([id, d]) => [
                id,
                { ...d, hp: Math.round(d.hp * k), atk: Math.round(d.atk * k) },
            ])
        );
    }
    const total = totalEnemyHp(cfg);

    let wins = 0;
    let timeouts = 0;
    const residuals = [];
    const waveProgress = [];
    for (let seed = 0; seed < SEEDS; seed++) {
        const s = createSim(cfg, seed);
        let n = 0;
        runToCompletion(
            s,
            (st) => autoPlayTick(st),
            400,
            (st) => (seed + n++) % st.pendingDraft.options.length
        );
        const outcome = outcomeOf(s);
        if (outcome === "victory") {
            wins++;
            continue;
        }
        // ★ 타임아웃은 "아깝게 진 것"이 아니다 — lib/defeat.mjs 주석 참조
        if (outcome === "timeout") {
            timeouts++;
            continue;
        }
        residuals.push((remainingEnemyHp(s) / total) * 100);
        // ★ 플레이어가 체감하는 "어디까지 갔나" — 잔여 HP 는 물량 분포에 지배당한다
        waveProgress.push((s.wave / s.waveTotal) * 100);
    }
    residuals.sort((a, b) => a - b);
    waveProgress.sort((a, b) => a - b);
    const median = residuals.length ? residuals[Math.floor(residuals.length / 2)] : NaN;
    const inBand = residuals.length
        ? (residuals.filter((r) => r >= P703.min && r <= P703.max).length / residuals.length) * 100
        : 0;
    return {
        winRate: (wins / SEEDS) * 100,
        median,
        inBand,
        losses: residuals.length,
        timeoutRate: (timeouts / SEEDS) * 100,
        waveMedian: waveProgress.length ? waveProgress[Math.floor(waveProgress.length / 2)] : NaN,
    };
}

console.log(`── 설계된 첫 패배 튜닝 (P7-03) ────────────────`);
console.log(`${STAGE} · 시드 ${SEEDS} · 추천 편성 · 후반 ${SURGE_WAVES}웨이브 급증`);
console.log(`목표: B3 승률 ${B3.min}–${B3.max}% · P7-03 잔여 ${P703.min}–${P703.max}%`);
console.log(`───────────────────────────────────────────────`);
console.log(`회복  배율   급증    승률      잔여중앙  웨이브진행  타임아웃  판정`);

const rows = [];
for (const mult of MULT) {
    for (const surge of SURGE) {
        for (const regen of REGEN) {
            const r = measure({ regen, mult, surge });
            const okWin = r.winRate >= B3.min && r.winRate <= B3.max;
            // ★ 타임아웃이 흔하면 그 점은 후보가 아니다 — 끝나지 않는 전투는 패배의 質이 아니다
            const okRes = r.median >= P703.min && r.median <= P703.max && r.timeoutRate <= 5;
            rows.push({ regen, mult, surge, ...r, okWin, okRes });
            if (true) {
                console.log(
                    `${String(regen).padStart(4)} ${String(mult).padStart(6)} ${String(surge).padStart(6)}  ` +
                        `${r.winRate.toFixed(1).padStart(6)}%${okWin ? "✔" : "✗"}  ` +
                        `${r.median.toFixed(1).padStart(7)}%${okRes ? "✔" : "✗"}  ` +
                        `${r.waveMedian.toFixed(0).padStart(8)}%  ${r.timeoutRate.toFixed(0).padStart(6)}%  ${okWin && okRes ? "★ 둘 다" : ""}`
                );
            }
        }
    }
}

console.log(`───────────────────────────────────────────────`);
const both = rows.filter((r) => r.okWin && r.okRes);
if (!both.length) {
    console.log(`✗ 동시 만족점이 격자 안에 없다 (${rows.length}점 탐색).`);
    const near = rows
        .slice()
        .sort((a, b) => Math.abs(a.median - 10) - Math.abs(b.median - 10))[0];
    console.log(
        `  잔여가 가장 가까운 점: 회복 ${near.regen} · 배율 ${near.mult} · 급증 ${near.surge} ` +
            `→ 승률 ${near.winRate.toFixed(1)}% · 잔여 ${near.median.toFixed(1)}%`
    );
    process.exit(1);
}
// 두 밴드의 중앙에 가장 가까운 점 — 시드 노이즈에 양방향 여유가 있어야 한다
const best = both
    .slice()
    .sort(
        (a, b) =>
            Math.abs(a.winRate - 37.5) + Math.abs(a.median - 10) -
            (Math.abs(b.winRate - 37.5) + Math.abs(b.median - 10))
    )[0];
console.log(
    `★ 권장: arkRegenPerWave ${best.regen} · difficultyMult ${best.mult} · 급증 ${best.surge}\n` +
        `   승률 ${best.winRate.toFixed(1)}% · 잔여 중앙값 ${best.median.toFixed(1)}% · 밴드내 ${best.inBand.toFixed(0)}%`
);
console.log(`   동시 만족점 ${both.length}개 — 주변이 넓을수록 안전하다`);
