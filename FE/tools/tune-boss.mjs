/**
 * 보스 난이도 튜너 (P6-06 후속)
 *
 * ★ 왜 필요한가: `recommendedLoadout` 이 바뀌면 보스 승률이 통째로 움직인다.
 *   실제로 방벽을 1기 → 2기로 고치자 5체가 53~67% 에서 70~100% 로 올라갔다.
 *   추천 편성은 게이트 B4 의 기준이라 앞으로도 바뀔 수 있고, 그때마다 손으로
 *   보스를 다시 맞추는 것은 재현 불가능한 작업이 된다. **탐색을 코드로 남긴다.**
 *
 * ★ 손잡이는 `giant.hpMult` 하나만 쓴다.
 *   ATK 를 건드리면 슬램 피해가 같이 움직여 지휘관 생존 설계가 흔들리고,
 *   페이즈 def/res 를 건드리면 "페이즈마다 답이 바뀐다"는 보스 설계가 무너진다.
 *   HP 는 **얼마나 오래 버티는가**만 바꾸므로 설계를 건드리지 않는 유일한 축이다.
 *
 * ★ 목표는 45~75% 가 아니라 그 **안쪽**(기본 62~70%)이다.
 *   게이트 B4 가 "무과금 추천 ≥55%" 를 요구하므로 하한에 붙이면 시드 노이즈로
 *   빌드가 깨진다. 상한에 붙이면 보스가 관문 노릇을 못 한다.
 *
 * 사용:
 *   node tools/tune-boss.mjs                 # 측정만 (파일을 쓰지 않는다)
 *   APPLY=1 node tools/tune-boss.mjs         # 확정해서 enemies.json 에 쓴다
 *   SEEDS=40 LOW=60 HIGH=72 APPLY=1 node tools/tune-boss.mjs
 *   STAGES='^3-' node tools/tune-boss.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const SEEDS = Number(process.env.SEEDS ?? 30);
const LOW = Number(process.env.LOW ?? 62);
const HIGH = Number(process.env.HIGH ?? 70);
const APPLY = process.env.APPLY === "1";
const STAGE_FILTER = process.env.STAGES ? new RegExp(process.env.STAGES) : null;
const MAX_STEPS = Number(process.env.STEPS ?? 7);

const ENEMIES_PATH = "src/game/data/enemies.json";
const STAGES_PATH = "src/game/data/stages.json";

/** 보스 스테이지 → 보스 id. 마지막 웨이브 단독 1체가 보스다. */
function bossStages() {
    const stages = JSON.parse(readFileSync(STAGES_PATH, "utf8")).stages;
    const enemies = JSON.parse(readFileSync(ENEMIES_PATH, "utf8")).enemies;
    const isBoss = new Set(enemies.filter((e) => e.boss).map((e) => e.id));
    const out = [];
    for (const s of stages) {
        if (STAGE_FILTER && !STAGE_FILTER.test(s.id)) continue;
        const last = s.waveTable[s.waveTable.length - 1];
        const ids = new Set(last?.spawns.map((sp) => sp.id) ?? []);
        for (const id of ids) if (isBoss.has(id)) out.push({ stageId: s.id, bossId: id });
    }
    return out;
}

/**
 * ★ 데이터를 쓰고 나면 **모듈 캐시를 비워야** 다음 측정이 새 값을 본다.
 *   `stageConfig.js` 가 `enemies.json` 을 import 로 물고 있어서, 파일만 바꾸고
 *   다시 재면 이전 값으로 계속 측정된다 — 조용히 틀린 튜닝이 나온다.
 *   그래서 측정마다 **자식 프로세스**를 새로 띄운다.
 */
function measureInChild(stageId) {
    const out = execFileSync(
        process.execPath,
        ["--input-type=module", "-e", CHILD_SRC, stageId],
        { env: { ...process.env, TUNE_STAGE: stageId, SEEDS: String(SEEDS) }, encoding: "utf8" }
    );
    return Number(out.trim().split("\n").pop());
}

const CHILD_SRC = `
import { createSim, runToCompletion } from "./src/game/logic/sim.js";
import { buildStageConfig, globalStageIndex } from "./src/game/logic/stageConfig.js";
import { autoPlayTick } from "./src/game/logic/autoPlay.js";
import { recommendedLoadoutForStage } from "./src/game/logic/stagePreview.js";
import { withF2PProgression } from "./tools/lib/f2p-power.mjs";
const id = process.env.TUNE_STAGE;
const SEEDS = Number(process.env.SEEDS);
const loadout = withF2PProgression(recommendedLoadoutForStage(id), globalStageIndex(id));
const cfg = buildStageConfig(id, loadout);
let wins = 0;
for (let seed = 0; seed < SEEDS; seed++) {
  const s = createSim(cfg, seed);
  let p = 0;
  runToCompletion(s, (st) => autoPlayTick(st), 400, (st) => (seed + p++) % st.pendingDraft.options.length);
  if (s.phase === "victory") wins++;
}
console.log((wins / SEEDS) * 100);
`;

function setHpMult(bossId, value) {
    const j = JSON.parse(readFileSync(ENEMIES_PATH, "utf8"));
    const e = j.enemies.find((x) => x.id === bossId);
    e.giant = { ...e.giant, hpMult: Math.round(value * 10) / 10 };
    writeFileSync(ENEMIES_PATH, JSON.stringify(j, null, 4) + "\n");
}

function getHpMult(bossId) {
    const j = JSON.parse(readFileSync(ENEMIES_PATH, "utf8"));
    return j.enemies.find((x) => x.id === bossId).giant.hpMult;
}

const targets = bossStages();
const mid = (LOW + HIGH) / 2;

console.log(`── 보스 난이도 튜너 ───────────────────────────`);
console.log(`목표 승률 ${LOW}~${HIGH}% (중앙 ${mid}%) · 시드 ${SEEDS} · ${APPLY ? "적용" : "측정만"}`);
console.log(`───────────────────────────────────────────────`);

const original = new Map(targets.map((t) => [t.bossId, getHpMult(t.bossId)]));
const report = [];

for (const { stageId, bossId } of targets) {
    const base = original.get(bossId);
    let lo = base;
    let hi = base;
    let rate = measureInChild(stageId);

    if (rate > HIGH) {
        // 너무 쉽다 → HP 를 올린다. 상계를 찾을 때까지 배로 민다
        hi = base;
        while (rate > HIGH && hi < base * 32) {
            hi *= 1.6;
            setHpMult(bossId, hi);
            rate = measureInChild(stageId);
        }
        lo = hi / 1.6;
    } else if (rate < LOW) {
        while (rate < LOW && lo > base / 32) {
            lo /= 1.6;
            setHpMult(bossId, lo);
            rate = measureInChild(stageId);
        }
        hi = lo * 1.6;
    } else {
        setHpMult(bossId, base);
        report.push({ stageId, bossId, from: base, to: base, rate });
        console.log(`${stageId.padEnd(6)} ${bossId.padEnd(24)} ${rate.toFixed(1).padStart(5)}%  이미 밴드 안 (hpMult ${base})`);
        continue;
    }

    // 이분 탐색
    let best = { mult: getHpMult(bossId), rate, gap: Math.abs(rate - mid) };
    for (let i = 0; i < MAX_STEPS; i++) {
        const m = (lo + hi) / 2;
        setHpMult(bossId, m);
        const r = measureInChild(stageId);
        const gap = Math.abs(r - mid);
        if (gap < best.gap) best = { mult: Math.round(m * 10) / 10, rate: r, gap };
        if (r > mid) lo = m;
        else hi = m;
        if (gap < 3) break;
    }

    setHpMult(bossId, APPLY ? best.mult : base);
    report.push({ stageId, bossId, from: base, to: best.mult, rate: best.rate });
    console.log(
        `${stageId.padEnd(6)} ${bossId.padEnd(24)} ${best.rate.toFixed(1).padStart(5)}%  ` +
            `hpMult ${base} → ${best.mult}${APPLY ? "" : " (미적용)"}`
    );
}

console.log(`───────────────────────────────────────────────`);
if (!APPLY) {
    console.log("측정만 했다. 확정하려면 APPLY=1 로 다시 돌려라.");
} else {
    console.log(`${report.filter((r) => r.from !== r.to).length}체 조정 · ${ENEMIES_PATH} 갱신`);
    console.log("다음: npm run data:validate && npm run test");
}
