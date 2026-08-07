/**
 * 웨이브 사이 방주 회복 (P7-03)
 *
 * ★ 이 규칙은 **기본값이 0 이다** — 명시적으로 켠 스테이지에만 적용된다.
 *   현재 100 스테이지 전부 0 이므로 밸런스에 영향이 없다.
 *   그럼에도 규칙을 남긴 이유와 이 파일이 지키는 것:
 *     ㄱ) 켰을 때 **정확히 켠 만큼만** 동작한다 (상한·하한·첫 웨이브 예외)
 *     ㄴ) 껐을 때 **아무 일도 하지 않는다** — 0 이 아닌 값이 새어 들어오면 즉시 깨진다
 *     ㄷ) **결정론을 깨지 않는다** (게이트 B1)
 *
 * @see docs/04-plan/33-execution-plan.md P7-03
 */
import { describe, it, expect } from "vitest";
import { createSim, runToCompletion } from "./sim.js";
import { buildStageConfig, globalStageIndex } from "./stageConfig.js";
import { autoPlayTick } from "./autoPlay.js";
import { recommendedLoadout, stageEnemyCounts } from "./stagePreview.js";
import stagesData from "../data/stages.json" with { type: "json" };

const STAGE = "1-9";
const units = recommendedLoadout(stageEnemyCounts(STAGE));

/**
 * 파워 보정 없이 **id 문자열 그대로** 넘긴다 — 이 파일은 밸런스가 아니라 **규칙**을 잰다.
 * ★ `buildStageConfig` 는 문자열 또는 `{id}` 를 받는다 (`stageConfig.js:305`).
 *   `{unitId}` 로 넘겼다가 "알 수 없는 동료: undefined" 로 전부 실패했다.
 */
const slots = units;

function run(cfgPatch, seed = 0) {
    const cfg = { ...buildStageConfig(STAGE, slots), ...cfgPatch };
    const s = createSim(cfg, seed);
    let n = 0;
    runToCompletion(s, (st) => autoPlayTick(st), 400, (st) => (seed + n++) % st.pendingDraft.options.length);
    return s;
}

describe("데이터 기본값", () => {
    /**
     * ★★ **켠 스테이지는 1-9 하나뿐이다** (2026-08-05).
     *
     *   2026-08-04 까지는 100 스테이지 전부 0 이었다 — 규칙은 있는데 **데이터에 적을
     *   방법이 없었기** 때문이다 (`tools/lib/stages-core.mjs` 가 비트의 값을 스테이지로
     *   실어 주지 않았다). 그 배선을 잇고 '설계된 첫 패배'(1-9)에서 처음 켰다.
     *
     * ★ 이 검사는 **느슨해진 것이 아니라 좁아졌다.** "어디에도 없다" 대신
     *   "정확히 여기에만 있다"를 고정한다 — 다른 스테이지에 회복이 새어 들어오면
     *   여전히 즉시 깨진다.
     */
    const REGEN_STAGES = { "1-9": 4 };

    it("★ 회복을 켠 스테이지는 정확히 정해진 곳뿐이다", () => {
        const on = {};
        for (const s of stagesData.stages) {
            if ((s.arkRegenPerWave ?? 0) !== 0) on[s.id] = s.arkRegenPerWave;
        }
        expect(on).toEqual(REGEN_STAGES);
    });

    it("stageConfig 가 데이터 값을 그대로 통과시킨다", () => {
        const cfg = buildStageConfig(STAGE, slots);
        expect(cfg.arkRegenPerWave).toBe(REGEN_STAGES[STAGE]);
    });

    it("globalStageIndex 로 만든 설정에도 필드가 존재한다 (undefined 아님)", () => {
        expect(globalStageIndex(STAGE)).toBeGreaterThan(0);
        expect(buildStageConfig(STAGE, slots).arkRegenPerWave).toBeDefined();
    });
});

describe("규칙", () => {
    it("회복을 켜면 방주가 더 오래 버틴다", () => {
        // ★ 같은 시드 · 같은 편성 · 회복만 다르다. 한 변수만 움직여야 인과가 성립한다.
        const off = run({ arkRegenPerWave: 0 }, 3);
        const on = run({ arkRegenPerWave: 40 }, 3);
        expect(on.wave).toBeGreaterThanOrEqual(off.wave);
    });

    it("방주 최대치를 넘지 않는다", () => {
        const s = run({ arkRegenPerWave: 9999 }, 1);
        expect(s.arkHp).toBeLessThanOrEqual(s.arkHpMax);
    });

    it("이미 죽은 방주를 되살리지 않는다", () => {
        // 회복이 아무리 커도 패배는 패배로 남는다 — 되살아나면 전투가 끝나지 않는다
        const s = run({ arkRegenPerWave: 9999 }, 1);
        if (s.phase === "defeat") expect(s.arkHp).toBeLessThanOrEqual(0);
    });

    it("음수·NaN 은 아무 일도 하지 않는다", () => {
        const base = run({ arkRegenPerWave: 0 }, 5);
        for (const bad of [-50, NaN, undefined, null]) {
            const s = run({ arkRegenPerWave: bad }, 5);
            expect(s.wave, String(bad)).toBe(base.wave);
            expect(s.phase, String(bad)).toBe(base.phase);
        }
    });
});

describe("결정론 (게이트 B1)", () => {
    it("같은 시드 · 같은 회복값이면 완전히 같은 결과다", () => {
        const a = run({ arkRegenPerWave: 12 }, 7);
        const b = run({ arkRegenPerWave: 12 }, 7);
        expect({ phase: a.phase, wave: a.wave, t: a.t, ark: a.arkHp }).toEqual({
            phase: b.phase,
            wave: b.wave,
            t: b.t,
            ark: b.arkHp,
        });
    });

    it("회복이 0 이면 규칙이 없던 때와 결과가 같다", () => {
        /**
         * ★ 이 검사가 "기본값 0 이 정말 무해한가"를 보증한다 — 0 을 넘긴 것과
         *   필드 자체가 없는 것이 같아야 한다.
         *
         * ★★ **회복을 켠 스테이지에서 재면 안 된다** (2026-08-05). 1-9 는 이제
         *   데이터에 4 가 있어서 `run({})` 이 그 값을 쓴다 — 그러면 이 검사는
         *   "0 과 4 가 같은가"를 묻게 되고 당연히 실패한다.
         *   회복이 **꺼져 있는** 스테이지에서 재는 것이 이 명제의 원래 뜻이다.
         */
        const off = stagesData.stages.find((s) => (s.arkRegenPerWave ?? 0) === 0);
        expect(off, "회복이 꺼진 스테이지가 하나도 없다").toBeTruthy();
        const offUnits = recommendedLoadout(stageEnemyCounts(off.id));
        const runOff = (patch, seed) => {
            const cfg = { ...buildStageConfig(off.id, offUnits), ...patch };
            const s = createSim(cfg, seed);
            let n = 0;
            runToCompletion(
                s,
                (st) => autoPlayTick(st),
                400,
                (st) => (seed + n++) % st.pendingDraft.options.length
            );
            return s;
        };

        const withField = runOff({ arkRegenPerWave: 0 }, 11);
        const withoutField = runOff({}, 11);
        expect({ phase: withField.phase, wave: withField.wave, t: withField.t }).toEqual({
            phase: withoutField.phase,
            wave: withoutField.wave,
            t: withoutField.t,
        });
    });
});
