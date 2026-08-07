/**
 * 드래프트 3장 조합이 **연속으로 같은 id 집합**으로 뜨는가?
 * SigilDraft 의 React key 가 `options.map(id).join("|")` 이므로, 같으면 리마운트가
 * 일어나지 않고 `chosen.current` 가 true 인 채로 남아 **선택이 영원히 무시된다.**
 */
import { createSim, step, chooseSigil } from "./src/game/logic/sim.js";
import { buildStageConfig, globalStageIndex } from "./src/game/logic/stageConfig.js";
import { autoPlayTick } from "./src/game/logic/autoPlay.js";
import { recommendedLoadoutForStage } from "./tools/lib/loadouts.mjs";
import { withF2PProgression } from "./tools/lib/f2p-power.mjs";

const STAGE = process.env.STAGE ?? "1-14";
const SEEDS = Number(process.env.SEEDS ?? 60);
const loadout = withF2PProgression(recommendedLoadoutForStage(STAGE), globalStageIndex(STAGE));

let collisions = 0, drafts = 0;
const hits = [];
for (let seed = 0; seed < SEEDS; seed++) {
    const s = createSim(buildStageConfig(STAGE, loadout), seed);
    let prevKey = null, picks = 0, ticks = 0;
    while (s.phase !== "victory" && s.phase !== "defeat" && ticks < 30 * 600) {
        if (s.phase === "draft") {
            const key = s.pendingDraft.options.map((o) => o.id).join("|");
            drafts++;
            if (key === prevKey) {
                collisions++;
                hits.push(`시드 ${seed} · 웨이브 ${s.wave} · [${key}]`);
            }
            prevKey = key;
            chooseSigil(s, (seed + picks++) % s.pendingDraft.options.length);
            continue;
        }
        autoPlayTick(s); step(s); ticks++;
    }
}
console.log(`${STAGE} · 시드 ${SEEDS} · 드래프트 ${drafts}회 · **연속 동일 조합 ${collisions}회** (${(collisions/drafts*100).toFixed(1)}%)`);
console.log(hits.slice(0, 10).join("\n") || "(없음)");
