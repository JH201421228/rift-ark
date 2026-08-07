/**
 * 나이트메어 게이트 단독 실행 (P11-09)
 *
 * ★ `npm run balance:check` 는 100 스테이지 하네스를 먼저 돌리므로 수십 분이 걸린다.
 *   규칙을 만지는 동안에는 **BN1–BN8 만** 몇 십 초에 확인할 수 있어야 한다.
 *   판정은 `tools/lib/nightmare-gates.mjs` 하나이고 여기에는 사본이 없다 —
 *   두 곳에서 판정하면 `balance:check` 와 이 명령이 다른 답을 낸다.
 *
 * 사용:
 *   npm run balance:nightmare
 *   BN_SEEDS=24 npm run balance:nightmare    # 표본을 늘려 재확인
 *
 * @see docs/02-design/22-nightmare.md §8.1
 */
import { runNightmareGates } from "./lib/nightmare-gates.mjs";

const HARD = "하드";
const SOFT = "소프트";

console.log("── 나이트메어 게이트 BN1–BN8 ──────────────────");
console.log(`시드 ${process.env.BN_SEEDS ?? 12} · 규칙 3종 · 월드 1–5\n`);

const t0 = Date.now();
const results = runNightmareGates({ HARD, SOFT });

let hardFail = 0;
let softFail = 0;
for (const r of results) {
    const mark = r.pass ? "✔" : "✗";
    if (!r.pass) r.gate === HARD ? hardFail++ : softFail++;
    console.log(`${mark} ${r.id.padEnd(5)} [${r.gate}] ${r.name}`);
    if (r.detail) console.log(`         ${r.detail}`);
}

console.log("\n───────────────────────────────────────────────");
console.log(
    `통과 ${results.filter((r) => r.pass).length}/${results.length} · ` +
        `하드 실패 ${hardFail} · 소프트 실패 ${softFail} · ${((Date.now() - t0) / 1000).toFixed(1)}초`
);

if (hardFail > 0) {
    console.error("\n✗ 하드 게이트 실패 — 빌드를 차단합니다");
    process.exit(1);
}
if (softFail > 0) console.warn("\n⚠ 소프트 게이트 실패 — 통과시키되 튜닝이 필요합니다");
