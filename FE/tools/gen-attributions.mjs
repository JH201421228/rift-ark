/**
 * 크레딧 문서 생성기 (P7-15)
 *
 * ★ 단일 출처는 `src/game/data/attributions.json` 이다.
 *   게임 내 "설정 > 라이선스" 화면과 `docs/legal/ATTRIBUTIONS.md` 가 **같은 파일**을
 *   읽어야 한다. 문서를 손으로 관리하면 출시 직전에 화면과 문서가 갈라지고,
 *   그때 무엇이 맞는지 아무도 모른다.
 *
 * 사용:
 *   npm run docs:attributions           문서를 다시 쓴다
 *   npm run docs:attributions -- --check  다시 쓰지 않고 최신인지만 확인 (CI 용)
 *
 * @see docs/04-plan/32-definition-of-done.md §1.6
 */
import { readFile, writeFile } from "node:fs/promises";

const SRC = "src/game/data/attributions.json";
const OUT = "../docs/legal/ATTRIBUTIONS.md";

const data = JSON.parse(await readFile(SRC, "utf8"));

/** 표 셀 안에서 `|` 는 열 구분자다 — 반드시 이스케이프한다 */
const cell = (v) => String(v ?? "").replaceAll("|", "\\|");

const authorCell = (e) => (e.url ? `[${cell(e.author ?? e.url)}](${e.url})` : cell(e.author ?? ""));

export function renderMarkdown(d) {
    const L = [];
    L.push("# 사용된 에셋 크레딧");
    L.push("");
    L.push("> ⚠ **이 파일은 생성물이다. 직접 고치지 마라.**");
    L.push(`> 단일 출처는 \`FE/${SRC}\` 이고, \`npm run docs:attributions\` 로 다시 만든다.`);
    L.push("> 게임 내 **설정 > 라이선스** 화면도 같은 JSON 을 읽는다 (P7-15).");
    L.push(`> 최종 갱신: ${d.updated}`);
    L.push("");
    for (const line of d.intro ?? []) L.push(`> ${line}`);
    L.push("");
    L.push("---");

    for (const s of d.sections) {
        L.push("");
        L.push(`## ${s.title}`);
        L.push("");
        if (s.note) {
            L.push(`> ${s.note}`);
            L.push("");
        }
        if (!s.entries.length) {
            L.push("_(아직 없음)_");
            continue;
        }
        L.push("| 에셋 | 원작자 / 출처 | 비고 |");
        L.push("|---|---|---|");
        for (const e of s.entries) {
            L.push(`| ${cell(e.name)} | ${authorCell(e)} | ${cell(e.note)} |`);
        }
    }

    L.push("");
    L.push("---");
    L.push("");
    L.push("## 갱신 규칙");
    L.push("");
    L.push(`**${d._rule}**`);
    L.push("");
    return L.join("\n");
}

const md = renderMarkdown(data);

if (process.argv.includes("--check")) {
    let current = "";
    try {
        current = await readFile(OUT, "utf8");
    } catch {
        /* 문서가 아직 없다 */
    }
    if (current.trim() !== md.trim()) {
        console.error(`✗ ${OUT} 이 attributions.json 과 다릅니다 — npm run docs:attributions 를 돌리세요`);
        process.exit(1);
    }
    console.log("✅ 크레딧 문서가 최신입니다");
} else {
    await writeFile(OUT, md, "utf8");
    const n = data.sections.reduce((a, s) => a + s.entries.length, 0);
    console.log(`✅ ${OUT} 생성 — ${data.sections.length}개 절 · ${n}개 항목`);
}
