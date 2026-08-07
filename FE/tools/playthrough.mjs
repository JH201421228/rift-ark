/**
 * P8-02 — 신규 계정 완주 하네스
 *
 * ★★ **이 하네스가 묻는 질문은 `balance.mjs` 가 묻지 않는 질문이다.**
 *
 *   `balance.mjs` 는 스테이지마다 **독립적으로** "그 시점의 목표 파워로 이길 수 있는가"를
 *   묻는다. 그리고 그때 추천 편성에 **로스터 전체(현재 30종)를 준다.**
 *   신규 계정은 그 30종을 갖고 있지 않다. 즉 게이트 B4 는 **플레이어가 갖지 못한 편성**으로
 *   측정된 값이다.
 *
 *   이 하네스는 대신 **순서대로** 묻는다:
 *     1일차부터 젬이 쌓이고 → 뽑기를 돌리고 → 로스터가 늘고 →
 *     그때 **실제로 가진 동료로** 다음 스테이지를 이길 수 있는가?
 *   막히는 첫 지점이 곧 "혼자서는 여기까지"다.
 *
 * ★★ **2026-08-04 경량화로 획득 경로가 하나가 됐다** — 스테이지 클리어 확정 지급.
 *   가챠 · 배틀패스 무료 트랙 · 일일 젬 수입이 전부 사라졌으므로, "며칠 차에 젬이
 *   얼마 쌓여 몇 번 뽑았는가" 모델도 통째로 사라졌다. 지금 이 하네스가 세는 로스터는
 *   `logic/unlocks.js:guaranteedUnitsBefore(stageId)` **하나가 답한다.**
 *
 *   그 결과 이 하네스는 **결정론이 됐다** — 계정 시드가 로스터를 바꾸지 않는다.
 *   `SEEDS` 는 이제 전투 시드 오프셋으로만 쓰인다.
 *
 * ★ 슬롯이 6칸 미만이어도 **그것만으로 벽이라고 하지 않는다.** 튜토리얼 구간은
 *   적은 동료로 이기도록 설계돼 있다. 실제로 **지는지**를 보고 판단한다.
 *
 * ★ 실패를 **세 종류로 구분해서** 보고한다. 구분하지 않으면 고칠 곳을 모른다:
 *     ROSTER   6칸을 채울 동료가 없다        → 획득 경제(젬·가챠·상점)의 문제
 *     COUNTER  6칸은 찼는데 상성 답이 없다   → 로스터 구성의 문제
 *     POWER    편성은 맞는데 스탯이 모자란다 → 난이도·성장 곡선의 문제
 *
 * 사용:
 *   node tools/playthrough.mjs
 *   SEEDS=5 node tools/playthrough.mjs          # 계정 시드 5개(운 편차)
 *   BATTLE_SEEDS=8 node tools/playthrough.mjs   # 스테이지당 전투 시드
 *   STOP_ON_WALL=0 node tools/playthrough.mjs   # 막혀도 끝까지 진행
 *
 * @see docs/04-plan/33-execution-plan.md P8-02
 */
import { createSim, runToCompletion } from "../src/game/logic/sim.js";
import { buildStageConfig, globalStageIndex, UNIT_DEFS } from "../src/game/logic/stageConfig.js";
import { autoPlayTick } from "../src/game/logic/autoPlay.js";
import {
    stageEnemyCounts,
    stageCounterTags,
    recommendedLoadout,
    RECOMMEND_SIZE,
} from "../src/game/logic/stagePreview.js";
import { withF2PProgression, daysToStage } from "./lib/f2p-power.mjs";
import stagesData from "../src/game/data/stages.json" with { type: "json" };
import { guaranteedUnitsBefore } from "../src/game/logic/unlocks.js";

const ACCOUNT_SEEDS = Number(process.env.SEEDS ?? 3);
// ★ 12 미만이면 표본이 너무 작아 '벽' 판정이 시드 운에 좌우된다 (4-19 오판 사례)
const BATTLE_SEEDS = Number(process.env.BATTLE_SEEDS ?? 16);
const STOP_ON_WALL = process.env.STOP_ON_WALL !== "0";
/** 벽 판정 — 이 승률 미만이면 "혼자서는 못 넘는다"로 본다 */
const WALL_WIN_RATE = Number(process.env.WALL ?? 25);

/* ══════════════════════════ 로스터 모델 ══════════════════════════ */

/**
 * `stageId` 에 들어가는 시점의 보유 동료.
 *
 * ★★ **목록을 여기 적지 않는다.** `logic/unlocks.js` 가 유일한 출처이고,
 *   게임 · 검사기 · 이 하네스가 **같은 함수**를 부른다. 2026-08-04 경량화 전에는
 *   여기에 젬 수입 · 가챠 시뮬 · 배틀패스 레벨 모델이 함께 있었고, 그 셋이
 *   "며칠 차에 무엇을 갖고 있는가"를 서로 다른 근거로 추정했다.
 */
function ownedUnitsAt(stageId) {
    return guaranteedUnitsBefore(stageId);
}

/* ══════════════════════════ 실패 원인 분류 ══════════════════════════ */

/**
 * 편성이 그 스테이지의 상성 답을 갖고 있는가.
 * ★ `recommendedLoadout` 이 **보유 로스터로 제한**했을 때 무엇을 못 넣었는지 본다.
 *   전체 로스터 추천과 비교하면 "무엇이 없어서 못 이겼는가"가 나온다.
 */
function missingCounters(stageId, ownedIds) {
    const counts = stageEnemyCounts(stageId);
    const tags = stageCounterTags(counts);
    const full = recommendedLoadout(counts, null);
    const mine = recommendedLoadout(counts, ownedIds);
    const has = (pred) => mine.some((id) => pred(UNIT_DEFS[id]));
    const missing = [];
    if (tags.has("ARMORED") && !has((u) => u.dmgType === "arcane")) missing.push("술식(ARMORED)");
    if (tags.has("CORRUPT") && !has((u) => u.dmgType === "holy")) missing.push("신성(CORRUPT)");
    if (tags.has("FLYING") && !has((u) => (u.tagMask & 256) !== 0 || u.dmgType !== "physical"))
        missing.push("대공(FLYING)");
    if (!has((u) => u.role === "BLOCKER")) missing.push("방벽");
    return { missing, mine, full };
}

/* ══════════════════════════ 완주 ══════════════════════════ */

/**
 * @param {string} stageId
 * @param {string[]|null} ownedIds 보유 동료 제한. `null` 이면 **전체 로스터**
 *   (= `balance.mjs` 가 재는 것과 같은 조건 — 비교 기준으로 쓴다)
 */
function winRate(stageId, ownedIds, seedOffset = 0) {
    const unitIds = recommendedLoadout(stageEnemyCounts(stageId), ownedIds);
    if (unitIds.length === 0) return 0;
    const loadout = withF2PProgression(unitIds, globalStageIndex(stageId));
    const cfg = buildStageConfig(stageId, loadout);
    let wins = 0;
    for (let i = 0; i < BATTLE_SEEDS; i++) {
        // ★ 계정마다 **다른 전투 시드**를 쓴다. 같은 시드를 쓰면 계정 시드를 아무리
        //   늘려도 전투 표본은 하나뿐이고, 그 하나가 운 나쁘면 전 계정이 같은 곳에서
        //   막힌 것처럼 보인다 (실제로 4-19 를 그렇게 오판했다 — 6시드 17% vs 50시드 56%).
        const seed = i + seedOffset;
        const sim = createSim(cfg, seed);
        let n = 0;
        runToCompletion(
            sim,
            (st) => autoPlayTick(st),
            400,
            (st) => (seed + n++) % st.pendingDraft.options.length
        );
        if (sim.phase === "victory") wins++;
    }
    return (wins / BATTLE_SEEDS) * 100;
}

/**
 * ★★ **1-9 는 *설계된 첫 패배*다** (게이트 B3, 승률 30–45%). 거기서 플레이어는
 *   "막히면 투자한다"를 배운다. 한 번 지는 것을 벽이라고 부르면 **설계를 버그로 신고**하게 된다.
 *   그래서 벽의 정의는 `WALL_WIN_RATE` 미만이고, B3 밴드는 그 위에 있다.
 *
 * ★ 파워(레벨 · 무기고 · 별 트리)는 `withF2PProgression(units, 스테이지인덱스)` 의
 *   설계 목표값을 그대로 쓴다 — 그 값이 그 시점에 **도달 가능한지는
 *   `calibrate-economy.mjs` 가 이미 검증**한다. 변수를 하나만 두어야 실패 원인이
 *   로스터인지 아닌지 답할 수 있다.
 *
 * ★★ 예전에는 여기에 "젬이 쌓일 때까지 최대 30일 대기" 루프가 있었다.
 *   2026-08-04 경량화로 **시간이 로스터를 늘리지 않게** 되면서 통째로 사라졌다.
 */
function playthrough(seedOffset) {
    const stages = stagesData.stages;
    const events = [];
    let firstWall = null;
    let minSlots = RECOMMEND_SIZE;
    /** 계정의 현재 일차 — 설계 페이싱을 그대로 쓴다 (보고용) */
    let day = 0;

    for (const stage of stages) {
        day = Math.max(day, daysToStage(globalStageIndex(stage.id)));

        /**
         * ★★ **기다림이 사라졌다** (2026-08-04 경량화).
         *   예전에는 "젬이 쌓일 때까지 N일 대기"라는 루프가 있었다. 지금 로스터는
         *   시간이 아니라 **진행도의 함수**이므로, 기다려도 아무것도 변하지 않는다.
         *   막히면 그 자리에서 막힌 것이다 — 그리고 그것이 더 정직한 판정이다.
         */
        const owned = ownedUnitsAt(stage.id);
        const ownedIds = [...owned];
        const { missing, mine } = missingCounters(stage.id, ownedIds);
        minSlots = Math.min(minSlots, mine.length);

        const rate = mine.length === 0 ? 0 : winRate(stage.id, ownedIds, seedOffset * 100);
        if (rate >= WALL_WIN_RATE) continue;

        /**
         * ★ 원인은 **추측하지 않고 실험으로 가른다.**
         *   같은 스테이지를 **전체 로스터** 추천 편성으로 한 번 더 돌린다.
         *     전체는 이긴다 → 문제는 로스터다 (가진 동료가 답이 아니다)
         *     전체도 진다   → 문제는 난이도·성장 곡선이다
         *   태그만 보고 판정하면, 6칸을 채웠지만 **엉뚱한 6칸**인 경우를 POWER 로
         *   오분류한다 (실제로 1-9 에서 그렇게 틀렸다).
         */
        const fullRate = winRate(stage.id, null, seedOffset * 100);
        const kind = fullRate >= WALL_WIN_RATE ? (missing.length ? "COUNTER" : "ROSTER") : "POWER";
        const head = `승률 ${rate.toFixed(0)}%`;
        const detail =
            kind === "ROSTER"
                ? `${head} · 보유 ${owned.size}종 ${mine.length}/${RECOMMEND_SIZE}칸 — 전체 로스터로는 ${fullRate.toFixed(0)}% 로 이긴다`
                : kind === "COUNTER"
                  ? `${head} · 없는 답: ${missing.join(", ")} — 전체 로스터로는 ${fullRate.toFixed(0)}%`
                  : `${head} · 전체 로스터로도 ${fullRate.toFixed(0)}% — 난이도·성장 곡선의 문제다`;

        const ev = { stageId: stage.id, day, kind, rate, fullRate, owned: owned.size, slots: mine.length, missing, detail };
        events.push(ev);
        if (!firstWall) firstWall = ev;
        if (STOP_ON_WALL) break;
    }

    return { accountSeed: seedOffset, firstWall, events, minSlots, totalDays: day };
}

/* ══════════════════════════ 실행 ══════════════════════════ */

console.log(`── 신규 계정 완주 하네스 (P8-02) ─────────────`);
console.log(
    `계정 시드 ${ACCOUNT_SEEDS} × 스테이지 ${stagesData.stages.length} × 전투 시드 ${BATTLE_SEEDS}`
);
console.log(`벽 판정 승률 < ${WALL_WIN_RATE}% · 막히면 ${STOP_ON_WALL ? "중단" : "계속"}`);
console.log(`───────────────────────────────────────────────`);

const t0 = Date.now();
const runs = [];
for (let a = 0; a < ACCOUNT_SEEDS; a++) runs.push(playthrough(a + 1));

console.log(`\n보유 동료 성장 (확정 지급이 유일한 경로다)`);
console.log(`  스테이지  보유종수`);
for (const id of ["1-1", "1-5", "1-10", "2-1", "3-1", "4-1", "5-20"]) {
    console.log(`  ${id.padStart(8)}  ${String(ownedUnitsAt(id).size).padStart(6)}종`);
}

console.log(`
계정별 결과`);
for (const r of runs) {
    if (!r.firstWall) {
        console.log(
            `  시드 ${r.accountSeed}: ✔ 100 스테이지 완주 · 설계 페이싱 ${r.totalDays.toFixed(0)}일`
        );
    } else {
        const w = r.firstWall;
        console.log(
            `  시드 ${r.accountSeed}: ✗ ${w.stageId} [${w.kind}] (${w.day.toFixed(1)}일차) — ${w.detail}`
        );
    }
}

const walls = runs.filter((r) => r.firstWall);
console.log(`───────────────────────────────────────────────`);
console.log(`${runs.length} 계정 · ${((Date.now() - t0) / 1000).toFixed(1)}초`);

if (walls.length === 0) {
    console.log(`✅ 전 계정이 신규 상태에서 마지막 스테이지까지 도달한다.`);
    process.exit(0);
}

// ★ 원인별로 묶어서 보고한다 — 어디를 고쳐야 하는지가 곧 결론이다
const byKind = {};
for (const r of walls) (byKind[r.firstWall.kind] ??= []).push(r.firstWall);
console.log(`❌ ${walls.length}/${runs.length} 계정이 막힌다.`);
for (const [kind, list] of Object.entries(byKind)) {
    const where = [...new Set(list.map((w) => w.stageId))].join(", ");
    const fix =
        kind === "ROSTER"
            ? "획득 경제(젬 수입 · 가챠 비용 · 확정 지급)의 문제다"
            : kind === "COUNTER"
              ? "로스터 구성의 문제다 — 답이 되는 동료를 얻을 수 없다"
              : "난이도 · 성장 곡선의 문제다";
    console.log(`  [${kind}] ${list.length}건 · ${where} → ${fix}`);
}
process.exit(1);
