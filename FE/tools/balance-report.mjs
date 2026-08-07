/**
 * 밸런스 리포트 HTML 시각화 (P4-12)
 *
 * ★ 벽 구간이 빨간 띠로 즉시 보여야 한다.
 *   CSV 를 눈으로 읽으면 30–50 벽 같은 패턴을 놓친다.
 *
 * 사용: npm run balance:report
 */
import { readFile, writeFile } from "node:fs/promises";

const OUT = "balance-report.html";

async function loadCsv(path) {
    const text = await readFile(path, "utf8");
    const [head, ...lines] = text.trim().split("\n");
    const keys = head.split(",");
    return lines.map((l) => {
        const v = l.split(",");
        const o = {};
        keys.forEach((k, i) => (o[k] = isNaN(Number(v[i])) ? v[i] : Number(v[i])));
        return o;
    });
}

const rows = await loadCsv("balance-report.csv");
const sigils = await loadCsv("balance-sigils.csv");

const stages = [...new Set(rows.map((r) => r.stageId))];
const loadouts = [...new Set(rows.map((r) => r.loadout))];

/** 승률 → 색. 25% 미만은 벽(빨강), 55% 미만은 경고(주황) */
function winColor(w) {
    if (w < 25) return "#c0392b";
    if (w < 55) return "#d68910";
    if (w < 80) return "#7d8c3a";
    return "#2e6b4f";
}

const cell = (r) =>
    r
        ? `<td style="background:${winColor(r.winRate)}" title="${r.stageId} / ${r.loadout}
승률 ${r.winRate}% · 평균 ${r.avgSec}s · 방주 ${r.avgArkHp}
★2 ${r.star2Rate}% · ★3 ${r.star3Rate}% · 각인 ${r.avgDrafts}픽">${r.winRate}</td>`
        : `<td class="na">—</td>`;

const table = `
<table>
  <thead><tr><th>편성 \\ 스테이지</th>${stages.map((s) => `<th>${s}</th>`).join("")}</tr></thead>
  <tbody>
    ${loadouts
        .map(
            (lo) => `<tr><th>${lo}</th>${stages
                .map((st) => cell(rows.find((r) => r.stageId === st && r.loadout === lo)))
                .join("")}</tr>`
        )
        .join("\n    ")}
  </tbody>
</table>`;

const recRows = rows.filter((r) => r.loadout === "recommended");
const timeChart = recRows
    .map((r) => {
        const w = Math.min(100, (r.avgSec / 300) * 100);
        return `<div class="bar"><span class="lbl">${r.stageId}</span>
      <div class="track"><div class="fill" style="width:${w}%"></div></div>
      <span class="val">${r.avgSec}s</span></div>`;
    })
    .join("\n");

const sigilChart = sigils
    .slice()
    .sort((a, b) => b.pickRatePct - a.pickRatePct)
    .map((s) => {
        const over = s.pickRatePct > 12;
        const under = s.pickRatePct < 0.8;
        const color = over ? "#c0392b" : under ? "#d68910" : "#4a6fa5";
        return `<div class="bar"><span class="lbl">${s.sigilId}</span>
      <div class="track"><div class="fill" style="width:${Math.min(100, s.pickRatePct * 8)}%;background:${color}"></div></div>
      <span class="val">${s.pickRatePct}%</span></div>`;
    })
    .join("\n");

const html = `<!doctype html>
<meta charset="utf-8">
<title>밸런스 리포트 — 균열의 방주</title>
<style>
  body { background:#0f0f1e; color:#e8e8f0; font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
         margin:0; padding:24px 32px; }
  h1 { font-size:20px; color:#f2b33d; margin:0 0 4px; }
  h2 { font-size:15px; color:#b45ad6; margin:28px 0 10px; }
  .sub { font-size:12px; color:#8899aa; margin:0 0 8px; }
  table { border-collapse:collapse; font-size:12px; }
  th, td { padding:6px 10px; text-align:center; border:1px solid #2a2a44; }
  thead th { background:#1a1a2e; color:#8899aa; font-weight:normal; }
  tbody th { background:#1a1a2e; color:#e8e8f0; text-align:left; font-weight:normal; }
  td { color:#fff; font-variant-numeric:tabular-nums; }
  td.na { background:#15152a; color:#444; }
  .legend { display:flex; gap:14px; font-size:11px; color:#8899aa; margin-top:8px; }
  .legend i { display:inline-block; width:12px; height:12px; margin-right:4px; vertical-align:-2px; }
  .bar { display:flex; align-items:center; gap:8px; margin:3px 0; font-size:11px; }
  .lbl { width:150px; color:#8899aa; }
  .track { flex:1; max-width:420px; height:12px; background:#1a1a2e; border-radius:2px; overflow:hidden; }
  .fill { height:100%; background:#4a6fa5; }
  .val { width:56px; color:#e8e8f0; font-variant-numeric:tabular-nums; }
  code { color:#7ad0ff; }
</style>

<h1>밸런스 리포트 — 균열의 방주</h1>
<p class="sub">${rows.length} 조합 · 스테이지 ${stages.length} · 편성 ${loadouts.length}</p>

<h2>승률 히트맵</h2>
<p class="sub">셀에 마우스를 올리면 상세. <b>빨강 = 벽(25% 미만)</b>, 주황 = 경고(55% 미만)</p>
${table}
<div class="legend">
  <span><i style="background:#c0392b"></i>&lt;25% 벽</span>
  <span><i style="background:#d68910"></i>&lt;55%</span>
  <span><i style="background:#7d8c3a"></i>&lt;80%</span>
  <span><i style="background:#2e6b4f"></i>≥80%</span>
</div>

<h2>전투 길이 (추천 편성)</h2>
<p class="sub">목표: 일반 60–180초 · 보스 120–300초</p>
${timeChart}

<h2>각인 픽률</h2>
<p class="sub">30종 균등이면 3.3%. <b>빨강 = 지배(12% 초과)</b>, 주황 = 사실상 미등장(0.8% 미만)</p>
${sigilChart}

<p class="sub" style="margin-top:28px">
  생성: <code>npm run balance:report</code> ·
  검증: <code>npm run balance:check</code>
</p>
`;

await writeFile(OUT, html);
console.log(`✔ ${OUT} 생성 (${rows.length} 조합)`);
