/**
 * 청크로 나눠 돌린 밸런스 CSV 를 합친다.
 *
 * ★ 전수 실행(162,000 전투 · 80분)이 장기 백그라운드에서 반복 중단돼,
 *   월드 절반씩 나눠 돌린 뒤 여기서 합쳐 게이트 검사에 넘긴다.
 */
import { readFile, writeFile, readdir } from "node:fs/promises";

const parts = (await readdir(".")).filter((f) => /^balance-part-.*\.csv$/.test(f)).sort();
if (!parts.length) throw new Error("balance-part-*.csv 가 없습니다");

let header = null;
const rows = [];
for (const f of parts) {
    const lines = (await readFile(f, "utf8")).trim().split(/\r?\n/);
    header ??= lines[0];
    rows.push(...lines.slice(1));
}
await writeFile("balance-report.csv", [header, ...rows].join("\n") + "\n");
console.log(`${parts.length} 조각 · ${rows.length} 행 → balance-report.csv`);
