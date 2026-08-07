/**
 * 전역 난이도 배율 스윕 (튜닝 보조)
 *
 * ★ 상수 하나를 바꾸고 하네스를 돌리는 일을 손으로 반복하면 하루가 간다.
 *   후보 격자를 자동으로 돌려 "어느 조합이 목표 승률대에 드는지"를 표로 낸다.
 *
 * ★ balance.json 을 임시로 덮어쓰고 반드시 원복한다.
 *   중간에 죽어도 원복되도록 finally 를 쓴다 — 안 그러면 스윕 마지막 값이
 *   조용히 게임 밸런스로 남는다.
 *
 * 사용: node tools/sweep-difficulty.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const PATH = "src/game/data/balance.json";
const original = readFileSync(PATH, "utf8");

const STAGES = ["1-5", "1-9", "1-15", "2-9", "2-15", "3-9", "3-19"];
const HP = [1.0, 1.5, 2.1, 2.9];
const ATK = [1.2, 1.8];

function run(hpMult, atkMult) {
    const b = JSON.parse(original);
    b.scaling.enemyHpMult = hpMult;
    b.scaling.enemyAtkMult = atkMult;
    writeFileSync(PATH, JSON.stringify(b, null, 4) + "\n");

    const out = execFileSync(process.execPath, ["tools/balance.mjs"], {
        env: {
            ...process.env,
            SEEDS: "6",
            LOADOUTS: "recommended",
            STAGES: `^(${STAGES.join("|")})$`,
        },
        encoding: "utf8",
    });

    const rates = {};
    for (const line of out.split("\n")) {
        const m = line.match(/^[\s⚠](\S+)\s+recommended\s+(\S+)%/);
        if (m) rates[m[1]] = m[2];
    }
    return rates;
}

try {
    console.log("── 난이도 스윕 ────────────────────────────────────────────");
    console.log("목표: 일반 70–90% · 관문(x-9) 40–60% · 최종관문(x-19) 30–50%\n");
    console.log("  HP  ATK │ " + STAGES.map((s) => s.padStart(6)).join(" "));
    console.log("──────────┼" + "─".repeat(STAGES.length * 7));

    for (const hp of HP) {
        for (const atk of ATK) {
            const r = run(hp, atk);
            console.log(
                `${hp.toFixed(1).padStart(4)} ${atk.toFixed(1).padStart(4)} │ ` +
                    STAGES.map((s) => (r[s] ?? "-").padStart(6)).join(" ")
            );
        }
    }
} finally {
    writeFileSync(PATH, original);
    console.log("\n(balance.json 원복 완료)");
}
