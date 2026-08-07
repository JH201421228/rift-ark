/**
 * 시뮬레이션 틱 성능 벤치 (P2-14)
 *
 * ★ 예산: 엔티티 120체 기준 1틱 1.2ms 이하.
 *   프레임 예산 16.67ms 중 시뮬은 2.4ms(프레임당 최대 2틱)를 넘지 않아야 한다.
 *   배속 ×3 에서는 프레임당 최대 8틱이므로 여유가 더 필요하다.
 *
 * 매 틱의 소요 시간을 그 시점의 엔티티 수와 함께 기록한 뒤,
 * **부하 구간(상위 엔티티 수)** 의 백분위로 판정한다.
 * 전체 평균은 한산한 초반 틱에 희석되어 의미가 없다.
 *
 * 사용: npm run bench:sim
 *       DIFFICULTY=nightmare npm run bench:sim    # 최대 밀도 (P11-03)
 *
 * @see docs/03-tech/26-performance-budget.md §1 · §10-A
 */
import { performance } from "node:perf_hooks";
import { createSim, step, chooseSigil, isTerminalPhase } from "../src/game/logic/sim.js";
import { buildStageConfig } from "../src/game/logic/stageConfig.js";
import { autoPlayTick } from "../src/game/logic/autoPlay.js";
import { EV } from "../src/game/logic/events.js";
import {
    DEFAULT_DIFFICULTY,
    difficultyDef,
    globalStageIndex,
} from "../src/game/logic/difficulty.js";
import { withF2PProgression } from "./lib/f2p-power.mjs";

const BUDGET_MS = 1.2;
const DIFFICULTY = process.env.DIFFICULTY ?? DEFAULT_DIFFICULTY;

/**
 * ★★★ **연출 부하 상한** (2026-08-05 추가).
 *
 *   시뮬 틱은 예산의 수십 배 여유였는데 전투는 렉이 걸렸다. 이유는 단순하다 —
 *   한 틱이 얼마나 걸리는지는 재고 있었지만, **그 틱이 렌더에 얼마나 많은 일을
 *   시키는지**는 아무도 재지 않았다. 틱당 이벤트 하나가 곧 트윈·틴트·데미지
 *   숫자·효과음 한 벌이고, 60fps 에서 프레임당 최대 8틱이 몰릴 수 있다.
 *
 *   실측 근거(6× CPU 스로틀 = 중급 스마트폰 대역, 1-9, 180초):
 *   DAMAGE 이벤트 하나의 연출 비용이 개선 전 2.06ms 였다. 틱당 16개가 나오면
 *   그 틱 하나로 33ms — 프레임 예산 두 개다.
 *
 *   그래서 **이벤트 밀도에도 상한을 둔다.** 넘으면 스폰 표를 고치거나
 *   연출 쪽을 다시 재라는 신호다.
 */
const EVENT_P99_BUDGET = 24;
const LOADOUT = [
    "slow_turtle",
    "bold_man_at_arms",
    "determined_soldier",
    "elf_sharpshooter",
    "novice_pyromancer",
    "jovial_friar",
];

/**
 * 스테이지를 끝까지 돌리며 (엔티티 수, 틱 시간, 이벤트 수) 표본을 모은다.
 *
 * ★★★ **각인 드래프트를 넘겨야 한다** (2026-08-05).
 *
 *   예전 조건은 `while (s.phase === "battle")` 였다. 그런데 각인 드래프트는
 *   전투를 **`phase="draft"` 로 멈춘다** — 끝내는 것이 아니라 멈추는 상태다
 *   (BattleScene.runSimulation 의 같은 함정에 대한 주석 참조).
 *   그래서 이 벤치는 **첫 드래프트에서 조용히 종료**하고 있었다: 어떤
 *   스테이지를 넣어도 정확히 1,732틱(약 57초)만 돌고, 동시 엔티티는 23체를
 *   넘지 못했다. 판정 기준이 "40체 이상 구간"이니 표본이 0 이고,
 *   `npm run bench:sim` 은 **항상 실패**하고 있었다.
 *
 *   드래프트를 넘기면 같은 1-9 가 165체까지 간다. 재던 것이 전투의 앞
 *   4분의 1 뿐이었다는 뜻이다.
 *
 * ★ 선택지는 언제나 0번을 고른다 — 무엇을 고르는가는 밸런스의 질문이고
 *   (`sigils:audit` 가 답한다), 여기서 필요한 것은 결정론적 진행뿐이다.
 */
/** 태어나지 못한 개체·탄 누계 (아래 판정이 읽는다) */
const dropped = { spawn: 0, projectile: 0 };

function sampleStage(stageId, seed, summonCd) {
    /**
     * ★★ **노멀은 성장 없이 잰다** — 26 §10-A 의 실측치가 그 조건이고, 조건을 바꾸면
     *   문서의 숫자와 비교가 성립하지 않는다.
     *
     * ★★ **다른 난이도는 무과금 성장을 얹는다.** 레벨 1 편성은 나이트메어에서
     *   3웨이브 만에 무너져 **아무것도 재지 못한다** — 실제로 그렇게 재 봤더니
     *   최대 동시 엔티티가 노멀 164체에서 나이트메어 95체로 **줄었다.**
     *   더 무거운 난이도가 더 가볍게 측정되는 벤치는 벤치가 아니다.
     */
    const loadout =
        DIFFICULTY === DEFAULT_DIFFICULTY
            ? LOADOUT
            : withF2PProgression(LOADOUT, globalStageIndex(stageId));
    const cfg = buildStageConfig(stageId, loadout, { difficulty: DIFFICULTY });
    const s = createSim(cfg, seed);
    const samples = [];

    let guard = 0;
    while (!isTerminalPhase(s.phase) && guard < 30 * 400) {
        guard++;
        if (s.phase === "draft") {
            chooseSigil(s, 0);
            continue;
        }
        autoPlayTick(s, { summonCooldownMs: summonCd });
        const n = s.actives.length;
        const t0 = performance.now();
        step(s);
        const ms = performance.now() - t0;

        // 렌더가 이 틱에 처리해야 하는 연출의 양. DAMAGE 는 데미지 숫자 1개 +
        // 틴트 + 효과음이라 가장 비싸므로 따로 센다.
        const q = s.events;
        let dmg = 0;
        for (let i = 0; i < q.length; i++) if (q.pool[i].type === EV.DAMAGE) dmg++;

        samples.push([n, ms, q.length, dmg]);
    }
    /**
     * ★★★ **풀 고갈은 판정 대상이다** (2026-08-05, P11-03).
     *
     *   `acquireEntity`/`acquireProjectile` 은 풀이 비면 `null` 을 돌려주고 스폰이
     *   **조용히** 실패한다. 그러면 이 벤치는 "가장 무거운 판이 가벼워졌다"를
     *   **좋은 소식으로 읽는다** — 틱도 빨라지고 이벤트도 줄기 때문이다.
     *   즉 고갈을 판정하지 않으면 이 파일은 고갈을 **보상한다.**
     */
    dropped.spawn += s.stats.spawnDropped;
    dropped.projectile += s.stats.projectileDropped;
    return samples;
}

function stats(times) {
    if (!times.length) return null;
    const a = times.slice().sort((x, y) => x - y);
    const at = (p) => a[Math.min(a.length - 1, Math.floor(a.length * p))];
    return {
        n: a.length,
        avg: a.reduce((x, y) => x + y, 0) / a.length,
        p50: at(0.5),
        p95: at(0.95),
        p99: at(0.99),
        max: a[a.length - 1],
    };
}

const fmt = (n) => (n === undefined ? "  —  " : `${n.toFixed(3)}ms`);

const diffDef = difficultyDef(DIFFICULTY);
console.log("── 시뮬 틱 · 연출 부하 벤치 ────────────────────");
console.log(
    `난이도 ${diffDef?.name?.ko ?? DIFFICULTY} ` +
        `(HP ×${diffDef?.enemyHpMult ?? 1} · 스폰 ×${diffDef?.spawnCountMult ?? 1})`
);
console.log(`예산: 부하 구간 틱 p95 ≤ ${BUDGET_MS}ms · 틱당 이벤트 p99 ≤ ${EVENT_P99_BUDGET}\n`);

const all = [];
/**
 * ★ 2-5 는 **원거리 적이 실제로 쏘는 판**이다 (2026-08-05).
 *   월드 1 에는 사거리 100 을 넘는 적이 한 종도 없어서, 적 11종에 발사체 역할이
 *   생긴 뒤에도 이 벤치는 **바뀐 것을 한 번도 재지 않았다.** 발사체가 하나 늘면
 *   틱 비용(이동·명중 판정)과 연출 비용(PROJECTILE_SPAWN/HIT)이 함께 는다.
 */
/**
 * ★ 3-19 · 5-19 는 **나이트메어 규칙 3종을 전부 재기 위해** 있다 (2026-08-05, P11-03).
 *   1-9/1-10 은 ① 역병 장판, 2-5 는 ② 결박 파열, 5-19 는 ③ 고갈이다.
 *   `DIFFICULTY=normal` 에서는 셋 다 걸리지 않으므로 그냥 무거운 후반 판이다.
 */
for (const [stageId, cd] of [
    ["1-2", 400],
    ["1-9", 120],
    ["1-10", 60],
    ["2-5", 120],
    ["3-19", 120],
    ["5-19", 120],
]) {
    for (const seed of [1, 2, 3]) {
        all.push(...sampleStage(stageId, seed, cd));
    }
}

const peak = all.reduce((m, [n]) => Math.max(m, n), 0);

// 엔티티 수 구간별 통계
const buckets = [
    [0, 20],
    [20, 40],
    [40, 60],
    [60, 90],
    [90, 999],
];

console.log("엔티티 구간   표본     avg      p50      p95      p99      max");
let failed = false;
let checked = false;

for (const [lo, hi] of buckets) {
    const times = all.filter(([n]) => n >= lo && n < hi).map(([, t]) => t);
    const st = stats(times);
    if (!st) continue;

    // 부하 구간(40체 이상)만 예산으로 판정한다
    const isLoad = lo >= 40;
    const ok = !isLoad || st.p95 <= BUDGET_MS;
    if (isLoad) checked = true;
    if (!ok) failed = true;

    const label = hi === 999 ? `${lo}+` : `${lo}–${hi}`;
    console.log(
        `${isLoad ? (ok ? "✔" : "✗") : " "} ${label.padEnd(10)} ${String(st.n).padStart(6)}  ` +
            `${fmt(st.avg)} ${fmt(st.p50)} ${fmt(st.p95)} ${fmt(st.p99)} ${fmt(st.max)}`
    );
}

/**
 * ── 연출 부하 ──
 *
 * ★ 렌더가 한 틱에 소화해야 하는 이벤트의 양. 시뮬 틱이 아무리 싸도 이 숫자가
 *   크면 전투는 렉이 걸린다 — 렌더는 이벤트 하나마다 트윈·틴트·데미지 숫자·
 *   효과음을 만든다. `EVENT_P99_BUDGET` 주석에 실측 근거가 있다.
 */
const evStats = stats(all.map(([, , n]) => n));
const dmgStats = stats(all.map(([, , , d]) => d));
const peakEv = all.reduce((m, [, , n]) => Math.max(m, n), 0);

console.log("\n연출 부하        표본     avg      p50      p95      p99      max");
const num = (n) => (n === undefined ? "  —  " : n.toFixed(1).padStart(5));
const evOk = evStats.p99 <= EVENT_P99_BUDGET;
if (!evOk) failed = true;
console.log(
    `${evOk ? "✔" : "✗"} 이벤트/틱   ${String(evStats.n).padStart(6)}  ` +
        `${num(evStats.avg)} ${num(evStats.p50)} ${num(evStats.p95)} ${num(evStats.p99)} ${num(evStats.max)}`
);
console.log(
    `  DAMAGE/틱  ${String(dmgStats.n).padStart(6)}  ` +
        `${num(dmgStats.avg)} ${num(dmgStats.p50)} ${num(dmgStats.p95)} ${num(dmgStats.p99)} ${num(dmgStats.max)}`
);

/**
 * ── 풀 고갈 ──
 * ★ 0 이 아니면 위의 모든 숫자가 **덜 무거운 판**을 잰 것이다. 그래서 마지막이 아니라
 *   판정에 포함한다 (아래 exit 조건).
 */
const poolOk = dropped.spawn === 0 && dropped.projectile === 0;
if (!poolOk) failed = true;
console.log(
    `\n${poolOk ? "✔" : "✗"} 풀 고갈      개체 ${dropped.spawn}체 · 탄 ${dropped.projectile}발이 태어나지 못했다`
);

console.log("───────────────────────────────────────────────");
console.log(`총 ${all.length} 틱 측정 · 최대 동시 엔티티 ${peak}체 · 최대 이벤트/틱 ${peakEv}`);

if (!poolOk) {
    console.error(
        `✗ 시뮬 풀이 고갈됐다 — 태어나지 못한 개체·탄만큼 이 판은 조용히 쉬워지고, ` +
            `위의 틱·이벤트 수치는 그 쉬워진 판을 잰 것이다. ` +
            `src/game/logic/state.js 의 ENTITY_POOL / PROJECTILE_POOL 을 다시 재라`
    );
    process.exit(1);
}
if (!checked) {
    console.error("✗ 부하 구간(40체 이상) 표본이 없습니다 — 벤치 시나리오를 재검토하세요");
    console.error("  (드래프트에서 조기 종료하고 있지 않은지 sampleStage 주석을 볼 것)");
    process.exit(1);
}
if (!evOk) {
    console.error(
        `✗ 틱당 이벤트 p99 ${evStats.p99} > ${EVENT_P99_BUDGET} — ` +
            `연출 비용이 그만큼 곱해집니다. 스폰 표 또는 연출 경로를 다시 재세요`
    );
}
if (failed) {
    if (!evOk) process.exit(1);
    console.error(`✗ 틱 예산 ${BUDGET_MS}ms 초과 — 레인 정렬 배열 구조를 재검토하세요`);
    process.exit(1);
}
console.log("✅ 부하 구간 전부 예산 이내");
