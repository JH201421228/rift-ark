/**
 * 스테이지 생성기 (P6-01)
 *
 * ★ 200 스테이지를 손으로 쓰면 밀도 곡선이 반드시 어긋난다.
 *   사람은 "이번엔 좀 더 세게"를 일관되게 반복하지 못한다.
 *   worlds.json 의 계획(무엇을 가르치는가 · 어떤 적이 나오는가)만 사람이 쓰고,
 *   웨이브 수·물량·레인 배분은 곡선에서 기계적으로 뽑는다.
 *
 * ★ 결정론이다. 같은 worlds.json 이면 항상 같은 stages.json 이 나온다.
 *   생성 규칙 자체는 `tools/lib/stages-core.mjs` 에 순수 함수로 있다.
 *
 * ★★ 이 스크립트는 **묻지 않고 덮어쓰지 않는다** (2026-08-03).
 *   예전에는 무조건 덮어썼고, 그래서 실측으로 얻은 조정이 조용히 사라졌다.
 *   조용한 파괴가 가장 나쁘다. 이제 차이가 있으면 **보여주고 멈춘다.**
 *
 * 사용:
 *   npm run gen:stages              차이를 보고만 한다 (변경 없으면 exit 0)
 *   npm run gen:stages -- --force   기존 스테이지까지 전부 덮어쓴다
 *   npm run gen:stages -- --new     기존 스테이지는 그대로 두고 새 id 만 추가 (월드 4–5)
 *   npm run gen:stages -- --diff    차이를 웨이브 단위까지 펼쳐 본다
 *
 * 스윕(정식 값을 찾는 실험):
 *   FLYING_CAP=0.4 ENDURE_SCALE=0.75 node tools/gen-stages.mjs --diff
 *   → 마음에 드는 값을 worlds.json:postProcess 에 적어 넣고 --force 로 확정한다.
 *
 * @see docs/04-plan/33-execution-plan.md P6-01
 */
import { readFile, writeFile } from "node:fs/promises";
import { generateStages } from "./lib/stages-core.mjs";
import worldsData from "../src/game/data/worlds.json" with { type: "json" };
import enemiesData from "../src/game/data/enemies.json" with { type: "json" };

const OUT = "src/game/data/stages.json";

const COMMENT =
    "★ 이 파일은 tools/gen-stages.mjs 가 생성한다. 직접 고치지 말 것 — " +
    "다음 생성에서 덮어쓰인다. 스테이지를 바꾸려면 worlds.json 을 고친다. " +
    "(FLYING 상한 · 버티기 물량 같은 후처리 손잡이는 worlds.json:postProcess 에 있다)";

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const FORCE = has("--force");
const ONLY_NEW = has("--new") || has("--only-new");
const SHOW_DIFF = has("--diff");

/* ── 스윕용 임시 덮어쓰기. 파일에는 기록되지 않는다 ─────────────── */
const overrides = {};
if (process.env.FLYING_CAP) overrides.flyingCap = Number(process.env.FLYING_CAP);

/* ── 비교 ──────────────────────────────────────────────────────── */

const CMP_KEYS = [
    "world",
    "index",
    "mode",
    "faction",
    "arkHp",
    "waves",
    "targetTimeSec",
    "teaches",
    "designedDefeat",
    "difficultyMult",
    "waveTable",
];

const bodies = (s) =>
    s.waveTable.reduce((n, w) => n + w.spawns.reduce((m, sp) => m + sp.count * (sp.lanes?.length ?? 3), 0), 0);

const fmtWave = (w) =>
    w ? w.spawns.map((sp) => `${sp.id}x${sp.count}@${(sp.lanes ?? []).join("")}`).join(" ") : "—";

/** 두 스테이지 배열의 차이. 반환: { changed:[], added:[], removed:[] } */
function compare(oldStages, newStages) {
    const O = new Map(oldStages.map((s) => [s.id, s]));
    const N = new Map(newStages.map((s) => [s.id, s]));
    const changed = [];
    const added = [];
    const removed = [];

    for (const [id, next] of N) {
        const prev = O.get(id);
        if (!prev) {
            added.push(id);
            continue;
        }
        const fields = CMP_KEYS.filter((k) => JSON.stringify(prev[k]) !== JSON.stringify(next[k]));
        if (fields.length) changed.push({ id, prev, next, fields });
    }
    for (const id of O.keys()) if (!N.has(id)) removed.push(id);
    return { changed, added, removed };
}

function printDiff({ changed, added, removed }) {
    if (added.length) console.log(`\n  ＋ 신규 ${added.length}개: ${added.join(" ")}`);
    if (removed.length) console.log(`\n  － 사라짐 ${removed.length}개: ${removed.join(" ")}`);
    if (!changed.length) return;

    console.log(`\n  ≠ 변경 ${changed.length}개`);
    for (const { id, prev, next, fields } of changed) {
        const scalar = fields.filter((f) => f !== "waveTable");
        const parts = scalar.map((f) => `${f} ${JSON.stringify(prev[f])}→${JSON.stringify(next[f])}`);
        if (fields.includes("waveTable")) parts.push(`적 ${bodies(prev)}→${bodies(next)}마리`);
        console.log(`     ${id.padEnd(6)} ${parts.join(" · ")}`);

        if (SHOW_DIFF && fields.includes("waveTable")) {
            const n = Math.max(prev.waveTable.length, next.waveTable.length);
            for (let i = 0; i < n; i++) {
                const a = fmtWave(prev.waveTable[i]);
                const b = fmtWave(next.waveTable[i]);
                if (a !== b) console.log(`          w${String(i + 1).padStart(2)}  ${a}\n               → ${b}`);
            }
        }
    }
}

/* ── 메인 ──────────────────────────────────────────────────────── */

export async function main() {
    const { stages, missing, flyingLog } = generateStages(
        worldsData,
        enemiesData,
        overrides
    );

    if (missing.length) {
        console.error("존재하지 않는 적 참조:");
        for (const m of missing) console.error("  " + m);
        process.exit(1);
    }

    // 요약 — 밀도 곡선이 눈으로 확인되어야 한다
    console.log(`── 스테이지 생성 ──────────────────────────────`);
    for (const w of worldsData.worlds) {
        const rows = stages.filter((s) => s.world === w.world);
        const line = rows
            .map((s) => {
                const n = s.waveTable.reduce((a, x) => a + x.spawns.reduce((b, y) => b + y.count, 0), 0);
                return `${s.index}:${n}`;
            })
            .join(" ");
        // ★ `name` 은 `{ko, en}` 이다 (i18n 정본). 콘솔 요약은 한국어로 찍는다.
        const wName = typeof w.name === "string" ? w.name : (w.name?.ko ?? "");
        console.log(`W${w.world} ${wName.padEnd(12)} ${line}`);
    }

    if (flyingLog.length) {
        console.log(
            `\n비행 상한(${((overrides.flyingCap ?? worldsData.postProcess.flyingCap) * 100).toFixed(0)}%) 적용 ${flyingLog.length}개: ` +
                flyingLog
                    .map((l) => `${l.id} ${(l.before * 100).toFixed(0)}→${(l.after * 100).toFixed(0)}%`)
                    .join(", ")
        );
    }

    /* ── 기존 파일과 대조 ── */
    let existing = null;
    try {
        existing = JSON.parse(await readFile(OUT, "utf8"));
    } catch {
        /* 최초 생성 */
    }

    if (!existing) {
        await write(stages);
        console.log(`\n최초 생성 — ${stages.length} 스테이지 → ${OUT}`);
        return;
    }

    const delta = compare(existing.stages, stages);
    const dirty = delta.changed.length + delta.added.length + delta.removed.length;

    if (!dirty) {
        // ★ 스테이지가 같아도 헤더 주석은 갱신될 수 있다. --force 일 때만 손댄다.
        if (FORCE && existing.$comment !== COMMENT) {
            await write(stages);
            console.log(`\n✓ 스테이지 동일 · $comment 갱신 → ${OUT}`);
            return;
        }
        console.log(`\n✓ ${OUT} 은 생성 결과와 동일하다 — 쓰지 않음 (${stages.length} 스테이지)`);
        return;
    }

    printDiff(delta);

    if (ONLY_NEW) {
        // ★ 기존 스테이지는 **손대지 않는다.** 월드 4–5 를 붙일 때 쓰는 모드.
        const kept = new Set(existing.stages.map((s) => s.id));
        const appended = stages.filter((s) => !kept.has(s.id));
        const merged = [...existing.stages, ...appended];
        merged.sort((a, b) => a.world - b.world || a.index - b.index);
        await write(merged);
        console.log(
            `\n--new: 기존 ${existing.stages.length}개 보존 · 신규 ${appended.length}개 추가 → ${OUT}`
        );
        if (delta.changed.length)
            console.log(`  ⚠ 위 ≠ ${delta.changed.length}개는 **반영하지 않았다.** 원하면 --force.`);
        return;
    }

    if (FORCE) {
        await write(stages);
        console.log(`\n--force: ${dirty}개 반영 → ${OUT}`);
        console.log(`다음: npm run data:validate && npm run balance:check`);
        return;
    }

    console.log(
        `\n✗ 쓰지 않았다. 위 ${dirty}개가 덮어쓰기 대상이다.\n` +
            `  이 차이가 의도한 것이면  npm run gen:stages -- --force\n` +
            `  새 스테이지만 붙이려면  npm run gen:stages -- --new\n` +
            `  웨이브 단위로 보려면    npm run gen:stages -- --diff\n` +
            `  ※ 실측으로 얻은 조정(1-9 difficultyMult · 비행 상한 · 버티기 물량)은\n` +
            `     worlds.json 에 있어야 재생성에서 살아남는다.`
    );
    process.exitCode = 1;
}

async function write(stages) {
    await writeFile(OUT, JSON.stringify({ $comment: COMMENT, stages }, null, 4) + "\n");
}

const invoked = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("gen-stages.mjs");
if (invoked) {
    main().catch((e) => {
        console.error(e);
        process.exit(1);
    });
}
