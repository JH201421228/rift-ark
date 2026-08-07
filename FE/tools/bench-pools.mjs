/**
 * 풀 크기 실측 — "풀이 몇이어야 하는가"를 100 스테이지 전수로 답한다.
 *
 * ★★★ **풀은 전투 중에 커지면 안 된다.**
 *
 *   `SpritePool.acquire()` 는 여유가 없으면 **가장 오래된 활성분을 회수**한다
 *   (`grow()` 하지 않는다). 그래서 풀이 모자란 증상은 "느려진다"가 아니라
 *   **"날아가던 발사체가 도중에 사라진다"** 이고, 그것은 화면에서 버그로 읽힌다.
 *   `DamageTextPool` 도 같다. `EffectSystem` 은 예산으로 먼저 막으므로 안전하다.
 *
 *   그리고 `EffectSystem.setCapacity()` 는 **실제로 `grow()` 한다** — 품질 티어를
 *   전투 도중에 올리면 그 프레임에 스프라이트가 새로 만들어지고 텍스처 업로드와
 *   표시 목록 재정렬이 한꺼번에 몰린다. 그 경로가 실재하므로, 필요한 만큼은
 *   **처음에** 만들어 두는 것이 원칙이다.
 *
 * 무엇을 재는가:
 *   · 동시 엔티티      → 스프라이트 수 (UnitPresenter)
 *   · 동시 발사체      → `BattleScene.projPool`
 *   · 동시 데미지 숫자 → `DamageTextPool` — 이벤트 수가 아니라 **수명 창** 안의 합
 *
 * ★ 데미지 숫자는 620ms 살아 있다 (`DamageTextPool.show`). 시뮬은 30Hz 이고
 *   전투 배속이 ×3 까지 올라가므로, 실시간 620ms 안에 들어오는 틱은 최대 56개다.
 *   "틱당 최대 몇 개"가 아니라 **"창 안에 몇 개가 겹치는가"** 가 풀 크기다.
 *
 * 사용: node tools/bench-pools.mjs [시드수]
 *
 * @see docs/03-tech/26-performance-budget.md §2 · §10-B
 */
import stagesData from "../src/game/data/stages.json" with { type: "json" };
import qualityData from "../src/game/data/quality.json" with { type: "json" };
import { measurePeaks, DT_WINDOW_TICKS, MAX_BATTLE_SPEED } from "./lib/pool-peaks.mjs";

const seeds = Number(process.env.SEEDS ?? process.argv[2] ?? 3);
const stages = stagesData.stages;

const rows = [];
for (const st of stages) {
    const agg = { id: st.id, act: 0, proj: 0, dmg: 0, ev: 0 };
    for (let sd = 1; sd <= seeds; sd++) {
        const r = measurePeaks(st.id, sd);
        agg.act = Math.max(agg.act, r.maxActives);
        agg.proj = Math.max(agg.proj, r.maxProjectiles);
        agg.dmg = Math.max(agg.dmg, r.maxDamageTexts);
        agg.ev = Math.max(agg.ev, r.maxEventsPerTick);
    }
    rows.push(agg);
    process.stderr.write(`\r${st.id}   `);
}
process.stderr.write("\r          \r");

const max = (k) => rows.reduce((m, r) => Math.max(m, r[k]), 0);
const top = (k, n = 10) => [...rows].sort((a, b) => b[k] - a[k]).slice(0, n);

console.log(`── 풀 크기 실측 (${stages.length} 스테이지 × ${seeds} 시드) ──────────`);
console.log(`데미지 숫자 수명 창 = ${DT_WINDOW_TICKS}틱 (620ms × 배속 ×${MAX_BATTLE_SPEED})\n`);

const table = (k, label) => {
    console.log(`${label} 최댓값 ${max(k)}`);
    console.log(
        "   " +
            top(k)
                .map((r) => `${r.id}:${r[k]}`)
                .join("  ")
    );
};
table("act", "동시 엔티티   ");
table("proj", "동시 발사체   ");
table("dmg", "동시 데미지숫자");
table("ev", "틱당 이벤트   ");

const high = qualityData.tiers.high;
const projOk = max("proj") <= qualityData.projectilePool;
console.log("\n풀 크기 vs 실측");
console.log(
    `${projOk ? "✔" : "✗"} 발사체     풀 ${qualityData.projectilePool}  ← 실측 ${max("proj")}`
);
console.log(`  데미지숫자 풀 ${high.dmgText}  ← 실측 ${max("dmg")} (예산상 일부러 작다 — §2)`);
console.log("\n★ 풀이 실측보다 작으면 acquire() 가 가장 오래된 활성분을 회수한다 —");
console.log("  날아가던 발사체가 사라지고 숫자가 꺼진다. 크래시가 아니라 침묵이다.");
if (!projOk) process.exitCode = 1;
