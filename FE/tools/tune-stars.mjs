/**
 * 별 조건 튜닝 — B10(★2) · B11(★3)
 *
 * ★★ **전투는 한 번만 돌린다.** 별 판정은 전투가 끝난 상태의 함수이므로
 *   (`lifecycle.computeStars` — 방주 HP 와 경과 시간만 본다), 후보 임계값마다
 *   전투를 다시 돌릴 이유가 없다. 한 번 돌려 `(arkHp, arkHpMax, t, targetTimeSec)` 를
 *   기록해 두면 임계값 격자 전체를 **즉시** 평가할 수 있다.
 *
 *   전수 밸런스 런은 100 스테이지 × 11 편성 × 50 시드 = 17분이다. 임계값 하나당
 *   17분이면 격자 탐색은 불가능하고, 불가능하면 손으로 찍게 되고, 손으로 찍은 값은
 *   왜 그 값인지 아무도 설명하지 못한다.
 *
 * ★ 판정식은 `computeStars` 를 **그대로 부른다.** 여기에 `arkHp >= max*r` 를 다시
 *   적으면 사본이 되고, 사본은 갈라진다 (이 저장소가 반복해서 겪은 실패 형태다).
 *   `cfg.stars` 를 바꿔 끼우고 같은 함수에 묻는다.
 *
 * ★ 분모는 **전체 시드**다 (`balance.mjs` 와 동일). 승리한 판만 세면 어려운 스테이지의
 *   별 달성률이 실제보다 높게 보인다 — 진 판도 별을 못 받은 판이다.
 *
 * 사용:
 *   SEEDS=50 node tools/tune-stars.mjs
 *   SEEDS=50 ARK=1 TIME=0.5,0.55,0.6 node tools/tune-stars.mjs
 */
import { createSim, runToCompletion, computeStars } from "../src/game/logic/sim.js";
import { buildStageConfig, globalStageIndex } from "../src/game/logic/stageConfig.js";
import { autoPlayTick } from "../src/game/logic/autoPlay.js";
import { recommendedLoadoutForStage } from "./lib/loadouts.mjs";
import { withF2PProgression } from "./lib/f2p-power.mjs";
import stagesData from "../src/game/data/stages.json" with { type: "json" };
import balance from "../src/game/data/balance.json" with { type: "json" };

const SEEDS = Number(process.env.SEEDS ?? 50);
const STAGE_FILTER = process.env.STAGES ? new RegExp(process.env.STAGES) : null;

/** B10/B11 은 도입부(1~2번)를 제외한다 — 첫 승리는 무조건 ★3 이어야 한다 */
const isIntro = (id) => Number(id.split("-")[1]) <= 2;

const ARK_GRID = (process.env.ARK ?? "1").split(",").map(Number);
const TIME_GRID = (process.env.TIME ?? "0.45,0.5,0.55,0.6,0.65,0.7,0.78").split(",").map(Number);

const B10 = { min: 45, max: 60 };
const B11 = { min: 20, max: 35 };

/* ── 1) 전투를 한 번씩 돌려 결과만 기록한다 ────────────────────── */

const stages = stagesData.stages.filter((s) => (STAGE_FILTER ? STAGE_FILTER.test(s.id) : true));

console.log(`── 별 조건 튜닝 ───────────────────────────────`);
console.log(`스테이지 ${stages.length} × 시드 ${SEEDS} (추천 편성 · 무과금 파워)`);
console.log(`현행: arkRatio ${balance.stars.arkRatio} · timeRatio ${balance.stars.timeRatio}`);
console.log(`───────────────────────────────────────────────`);

const t0 = Date.now();
/** @type {Map<string, Array<{win:boolean, arkHp:number, arkHpMax:number, t:number, target:number}>>} */
const runs = new Map();

for (const stage of stages) {
    const units = recommendedLoadoutForStage(stage.id);
    const loadout = withF2PProgression(units, globalStageIndex(stage.id));
    const cfg = buildStageConfig(stage.id, loadout);
    const rows = [];
    for (let seed = 0; seed < SEEDS; seed++) {
        const s = createSim(cfg, seed);
        let pickN = 0;
        runToCompletion(
            s,
            (st) => autoPlayTick(st),
            400,
            (st) => (seed + pickN++) % st.pendingDraft.options.length
        );
        rows.push({
            win: s.phase === "victory",
            arkHp: s.arkHp,
            arkHpMax: s.arkHpMax,
            t: s.t,
            target: s.cfg.targetTimeSec,
        });
    }
    runs.set(stage.id, rows);
}
console.log(`전투 ${stages.length * SEEDS} 판 · ${((Date.now() - t0) / 1000).toFixed(1)}초\n`);

/* ── 2) 임계값 격자를 평가한다 (전투 재실행 없음) ────────────────── */

/**
 * 기록된 결과에 임계값을 적용한다.
 * ★ `computeStars` 를 그대로 부른다 — 최소한의 가짜 상태만 만들어 넘긴다.
 */
function rateFor(stars) {
    const per = [];
    for (const [id, rows] of runs) {
        if (isIntro(id)) continue;
        let s2 = 0;
        let s3 = 0;
        for (const r of rows) {
            const n = computeStars({
                phase: r.win ? "victory" : "defeat",
                arkHp: r.arkHp,
                arkHpMax: r.arkHpMax,
                t: r.t,
                cfg: { stars, targetTimeSec: r.target },
            });
            if (n >= 2) s2++;
            if (n >= 3) s3++;
        }
        per.push({ id, s2: (s2 / rows.length) * 100, s3: (s3 / rows.length) * 100 });
    }
    const avg = (k) => per.reduce((a, r) => a + r[k], 0) / per.length;
    return { avg2: avg("s2"), avg3: avg("s3"), per };
}

const inBand = (v, b) => v >= b.min && v <= b.max;
const results = [];

console.log(`arkRatio  timeRatio    ★2      ★3     판정`);
console.log(`───────────────────────────────────────────────`);
for (const arkRatio of ARK_GRID) {
    for (const timeRatio of TIME_GRID) {
        const { avg2, avg3, per } = rateFor({ arkRatio, timeRatio });
        const ok2 = inBand(avg2, B10);
        const ok3 = inBand(avg3, B11);
        results.push({ arkRatio, timeRatio, avg2, avg3, ok2, ok3, per });
        console.log(
            `${String(arkRatio).padStart(7)}  ${String(timeRatio).padStart(8)}  ` +
                `${avg2.toFixed(1).padStart(5)}%${ok2 ? " ✔" : " ✗"}  ` +
                `${avg3.toFixed(1).padStart(5)}%${ok3 ? " ✔" : " ✗"}  ` +
                `${ok2 && ok3 ? "★ 둘 다 통과" : ok2 || ok3 ? "하나만" : ""}`
        );
    }
}

console.log(`───────────────────────────────────────────────`);
const both = results.filter((r) => r.ok2 && r.ok3);
if (both.length === 0) {
    // ★ "없다"를 조용히 넘기지 않는다 — 현재 손잡이로 안 되는 것이 결론일 수 있다
    console.log(`✗ 두 밴드를 동시에 만족하는 조합이 격자 안에 없다.`);
    const near = results
        .slice()
        .sort((a, b) => Math.abs(a.avg3 - 27.5) - Math.abs(b.avg3 - 27.5))[0];
    console.log(
        `  ★3 이 가장 가까운 것: ark ${near.arkRatio} · time ${near.timeRatio} ` +
            `→ ★2 ${near.avg2.toFixed(1)}% · ★3 ${near.avg3.toFixed(1)}%`
    );
} else {
    // 밴드 중앙에 가장 가까운 조합 — 시드 노이즈에 대한 여유가 양방향으로 있어야 한다
    const mid2 = (B10.min + B10.max) / 2;
    const mid3 = (B11.min + B11.max) / 2;
    const best = both
        .slice()
        .sort(
            (a, b) =>
                Math.abs(a.avg2 - mid2) +
                Math.abs(a.avg3 - mid3) -
                (Math.abs(b.avg2 - mid2) + Math.abs(b.avg3 - mid3))
        )[0];
    console.log(
        `→ 권장: arkRatio ${best.arkRatio} · timeRatio ${best.timeRatio} ` +
            `(★2 ${best.avg2.toFixed(1)}% · ★3 ${best.avg3.toFixed(1)}%)`
    );
    const worst = best.per.slice().sort((a, b) => a.s3 - b.s3);
    console.log(`   ★3 최저: ${worst.slice(0, 6).map((w) => `${w.id}(${w.s3.toFixed(0)}%)`).join(" ")}`);
    console.log(`   ★3 최고: ${worst.slice(-4).map((w) => `${w.id}(${w.s3.toFixed(0)}%)`).join(" ")}`);
}
