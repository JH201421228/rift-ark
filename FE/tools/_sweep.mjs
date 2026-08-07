/** 전역 배율 스윕 — 어느 조합이 목표 승률대에 드는지 본다 */
import { readFileSync, writeFileSync } from "node:fs";
const P = "src/game/data/balance.json";
const orig = readFileSync(P, "utf8");
const STAGES = ["1-5", "1-9", "1-15", "2-9", "2-15", "3-9", "3-19"];

const combos = [];
for (const hp of [1.6, 2.2, 3.0]) for (const atk of [1.6, 2.2, 3.0]) combos.push([hp, atk]);

console.log("hpM atkM │ " + STAGES.map((s) => s.padStart(6)).join(" "));
for (const [hp, atk] of combos) {
    const b = JSON.parse(orig);
    b.scaling.enemyHpMult = hp;
    b.scaling.enemyAtkMult = atk;
    writeFileSync(P, JSON.stringify(b, null, 4) + "\n");

    const { execSync } = await import("node:child_process");
    const out = execSync(`node tools/balance.mjs`, {
        env: { ...process.env, SEEDS: "6", LOADOUTS: "recommended", STAGES: `^(${STAGES.join("|")})$` },
        encoding: "utf8",
    });
    const rates = {};
    for (const line of out.split("\n")) {
        const m = line.match(/^[ ⚠](\S+)\s+recommended\s+(\S+)%/);
        if (m) rates[m[1]] = m[2];
    }
    console.log(
        `${hp.toFixed(1)} ${atk.toFixed(1)} │ ` + STAGES.map((s) => (rates[s] ?? "-").padStart(6)).join(" ")
    );
}
writeFileSync(P, orig);
