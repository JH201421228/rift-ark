/**
 * 해금 전수 검사 (P8-03)
 *
 * ★★ 진행도 0 → 100 을 1씩 올리며 **각 시점에 무엇이 열려 있는가**를 표로 만들고,
 *   네 가지 성질을 기계가 확인한다:
 *     ① 단조성  — 진행할수록 열린 것이 줄어들지 않는다 (거꾸로 잠금 = 최악의 회귀)
 *     ② 도달성  — 데이터가 선언한 모든 해금은 언젠가 열린다 (죽은 콘텐츠 0)
 *     ③ 선행정합 — 열린 콘텐츠가 요구하는 것을 그 시점에 확보할 수 있다
 *     ④ 라우터 — 이 검사기가 기대는 라우트 파서가 실제로 라우트를 읽는다
 *
 * ★★ **판정은 전부 `src/game/logic/unlockAudit.js` 가 한다.** 이 파일에는 해금
 *   조건이 하나도 없다 — 여기에 숫자를 적으면 검사기가 두 번째 출처가 되고,
 *   그때부터 이 검사는 자기 자신에게 질문하는 동어반복이 된다
 *   (`tools/validate-data.mjs` 가 지키는 규약과 같다).
 *
 * ★ 이 파일이 **직접** 하는 일은 두 가지뿐이고, 둘 다 logic/ 이 할 수 없는 것이다:
 *   - `screen.*` 해금 키를 **라우터 소스**와 대조한다 (라우터는 JSX 라 logic/ 이
 *     import 할 수 없다 — 절대 규칙 1).
 *   - 그 해금 키를 **실제로 읽는 코드가 있는가**를 소스 트리에서 센다.
 *
 * 사용: node tools/check-unlocks.mjs   (또는 npm run check:unlocks)
 *
 * @see docs/04-plan/33-execution-plan.md P8-03
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { MAX_STAGE, PROFILES, runUnlockAudit } from "../src/game/logic/unlockAudit.js";
/**
 * ★★ **라우터를 읽는 코드를 여기 두지 않는다.** 예전에는 이 파일이 자기 정규식으로
 *   `src/router/index.jsx` 를 훑었다. 그런데 라우터 표기가 바뀌는 날(실제로 바뀌었다 —
 *   P9-05 지연 로딩) **한쪽만 못 읽고, 못 읽은 쪽은 "라우트 0개"로 조용히 통과한다.**
 *   화면 도달 경로의 단일 출처는 `check-reachability.mjs` 다 (P8-01).
 */
import { loadRoutes } from "./check-reachability.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

/* ─────────────────────────── 실행 ─────────────────────────── */

const { findings, rows, byProfile, firstOpen, declared } = runUnlockAudit();

/* ④ 라우터 파서 건전성 — 이 검사기의 전제가 성립하는가 */
{
    const { routes, declared } = await loadRoutes();
    /**
     * ★ 파서가 빗나가면 도달성·해금 대조가 **전부 조용해진다.**
     *   검사가 거짓말을 하므로 먼저 오류로 세운다.
     */
    if (routes.length !== declared) {
        findings.push({
            code: "router-parse-failed",
            severity: "error",
            at: "src/router/index.jsx",
            message:
                `라우트 파싱 실패 — path 선언 ${declared}개 중 ${routes.length}개만 읽혔다. ` +
                `tools/check-reachability.mjs 의 ROUTE_RE 를 라우터 표기에 맞춰야 한다`,
        });
    }
}

/* ─────────────────────────── 출력 ─────────────────────────── */

const errors = findings.filter((f) => f.severity === "error");
const warns = findings.filter((f) => f.severity === "warn");
const infos = findings.filter((f) => f.severity === "info");

console.log("── 해금 전수 검사 ─────────────────────────────");
console.log(
    `진행도 0–${MAX_STAGE} · 프로필 ${PROFILES.join("/")} · ` +
        `선언된 해금 ${declared.size}개 · 최종 열림 ${rows[rows.length - 1].keys.size}개`
);

/* 변화가 있는 지점만 찍는다 — 101줄 전부는 아무도 읽지 않는다 */
console.log("\n[해금 타임라인] (열린 것이 늘어난 진행도만)");
let prev = new Set();
for (const row of rows) {
    const added = [...row.keys].filter((k) => !prev.has(k)).sort();
    if (added.length) {
        const head = `  ${String(row.stage).padStart(3)} `;
        console.log(head + added.join(" "));
    }
    prev = row.keys;
}

/* 프로필별 차이 — "하드를 안 켠 계정에게 영원히 안 열리는 것" */
if (byProfile.normal && byProfile.complete) {
    const nk = byProfile.normal[byProfile.normal.length - 1].keys;
    const ck = byProfile.complete[byProfile.complete.length - 1].keys;
    const onlyComplete = [...ck].filter((k) => !nk.has(k)).sort();
    console.log(
        `\n[프로필 차이] 노멀만 밀어 올린 계정에게 닫혀 있는 것 ${onlyComplete.length}개` +
            (onlyComplete.length ? `\n  ${onlyComplete.join(" ")}` : "")
    );
}

console.log("\n[처음 열리는 진행도]");
/**
 * ★ 목록을 손으로 적지 않는다. 접두사별 최초 해금 진행도를 파생한다 —
 *   2026-08-04 경량화 전에는 여기 `content.dungeon` · `content.tower` 가 손으로
 *   적혀 있었고, 그것들이 사라진 뒤로도 "—" 와 `Infinity` 를 출력하며 남아 있었다.
 */
const PREFIXES = ["unit.", "ark.", "star.", "difficulty.hard."];
for (const prefix of PREFIXES) {
    const at = [...firstOpen].filter(([k]) => k.startsWith(prefix)).map(([, v]) => v);
    if (!at.length) continue;
    console.log(`  ${`${prefix}* (최초)`.padEnd(24)} ${Math.min(...at)}`);
}

console.log("");
for (const f of infos) console.log(`· ${f.at}: ${f.message}`);
for (const f of warns) console.warn(`⚠ [${f.code}] ${f.at}: ${f.message}`);
for (const f of errors) console.error(`✗ [${f.code}] ${f.at}: ${f.message}`);

console.log("───────────────────────────────────────────────");
if (errors.length) {
    console.error(`✗ 오류 ${errors.length}건 · 경고 ${warns.length}건`);
    process.exit(1);
}
console.log(`✅ 통과 (경고 ${warns.length}건 · 참고 ${infos.length}건)`);
