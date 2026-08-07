/**
 * 전투 모드 검증 (P6-08 · GDD §4.8)
 *
 * ★ 모드는 **승리 조건**을 바꾸는 장치다. 난이도가 아니다.
 *
 * ★★ 2026-08-04 경량화로 모드는 둘이다 — assault · nemesis.
 *   버티기 · 돌파 · 호위와 그 테스트는 같이 지웠다 (modes.js 상단 참조).
 *
 * ★ B1 결정론은 모드에서도 하드 게이트다.
 */
import { describe, it, expect } from "vitest";
import { createSim, runToCompletion, step } from "./sim.js";
import { buildStageConfig } from "./stageConfig.js";
import { autoPlayTick } from "./autoPlay.js";
import { MODE } from "./modes.js";
import { TOTAL_LANES } from "./state.js";
import stagesData from "../data/stages.json" with { type: "json" };

const L = (id, level) => ({ id, level });
const SIX = [
    L("slow_turtle", 18),
    L("bold_man_at_arms", 18),
    L("determined_soldier", 18),
    L("elf_sharpshooter", 18),
    L("novice_pyromancer", 18),
    L("jovial_friar", 18),
];

/** 이 모드의 스테이지 id 하나 */
const firstOf = (mode) => stagesData.stages.find((s) => s.mode === mode).id;

function run(stageId, seed, loadout = SIX, maxSec = 400) {
    const s = createSim(buildStageConfig(stageId, loadout), seed);
    runToCompletion(s, (st) => autoPlayTick(st), maxSec);
    return s;
}

/* ══════════════════════════════════════════════════════════════
 * 데이터 무결성
 * ══════════════════════════════════════════════════════════════ */
describe("모드 데이터", () => {
    it("모든 스테이지의 모드가 구현된 모드다", () => {
        const known = new Set(Object.values(MODE));
        for (const s of stagesData.stages) {
            expect(known.has(s.mode), `${s.id} → ${s.mode}`).toBe(true);
        }
    });

    it("월드마다 보스전이 두 번 있다 — 10 과 20 이 월드의 마침표다", () => {
        const worlds = [...new Set(stagesData.stages.map((s) => s.world))];
        for (const w of worlds) {
            const boss = stagesData.stages.filter(
                (s) => s.world === w && s.mode === MODE.NEMESIS
            );
            expect(boss.map((s) => s.index).sort((a, b) => a - b), `월드 ${w}`).toEqual([10, 20]);
        }
    });

    it("★ 변주 모드가 되살아나지 않았다 — 모드는 둘뿐이다", () => {
        expect(Object.keys(MODE).sort()).toEqual(["ASSAULT", "NEMESIS"]);
        const used = new Set(stagesData.stages.map((s) => s.mode));
        expect([...used].sort()).toEqual(["assault", "nemesis"]);
    });
});

/* ══════════════════════════════════════════════════════════════
 * B1 결정론 — 모드에서도 하드 게이트
 * ══════════════════════════════════════════════════════════════ */
describe("모드 결정론", () => {
    const summarize = (s) => ({
        phase: s.phase,
        tick: s.tick,
        arkHp: Math.round(s.arkHp * 1000),
        kills: s.stats.kills,
        bossDead: s.modeState.bossDead,
    });

    for (const mode of Object.values(MODE)) {
        it(`${mode}: 동일 시드는 완전히 동일한 결과를 낸다`, () => {
            const id = firstOf(mode);
            expect(summarize(run(id, 4242))).toEqual(summarize(run(id, 4242)));
        });
    }
});

/* ══════════════════════════════════════════════════════════════
 * 보스
 * ══════════════════════════════════════════════════════════════ */
describe("보스 (nemesis)", () => {
    const id = firstOf(MODE.NEMESIS);

    it("스테이지에 거대화 엘리트가 들어 있다", () => {
        const cfg = buildStageConfig(id, SIX);
        const hasGiant = Object.values(cfg.enemyDefs).some((d) => d.giant);
        expect(hasGiant).toBe(true);
    });

    it("보스가 등장하면 보스로 등록된다", () => {
        const s = run(id, 2);
        expect(s.modeState.bossId).not.toBe(-1);
    });

    it("보스를 잡으면 승리한다 — 잔챙이 청소를 기다리지 않는다", () => {
        const s = run(id, 2);
        if (s.phase === "victory") expect(s.modeState.bossDead).toBe(true);
    });
});

/* ══════════════════════════════════════════════════════════════
 * ★★★ 보스 처치 후 잔챙이 정리 (`despawnAdds`)
 *
 *   `modes.js:despawnAdds` 는 2026-08-05 까지 **호출부가 없었다.**
 *   `balance.json:modes.nemesis.addsDespawnOnBossDeath` 는 true 였고
 *   `stageConfig.js` 가 그 값을 modeParams 로 옮겨 놓기까지 했는데,
 *   부르는 곳이 없어서 보스를 잡은 화면에 졸개가 그대로 서 있었다.
 *
 *   ★ "보스전을 끝까지 돌린다"로는 이것을 못 잡는다 — 실측상 월드 1·2 보스는
 *     졸개가 이미 정리된 뒤에 죽어서, 정리 코드가 있든 없든 남은 적이 0 이다.
 *     그래서 **졸개가 살아 있는 순간에 보스를 죽인다.**
 * ══════════════════════════════════════════════════════════════ */
describe("보스 처치 후 잔챙이 정리 (addsDespawnOnBossDeath)", () => {
    const id = firstOf(MODE.NEMESIS);

    const countEnemies = (s) => {
        let n = 0;
        for (let li = 0; li < TOTAL_LANES; li++) n += s.lanes[li].enemies.length;
        return n;
    };

    /**
     * 적이 여럿 나온 시점에서 그중 하나를 보스로 지목하고 죽인다.
     * @param {boolean} despawn modeParams 의 스위치
     */
    function killBossMidFight(despawn) {
        const cfg = buildStageConfig(id, SIX);
        cfg.modeParams.addsDespawnOnBossDeath = despawn;
        const s = createSim(cfg, 3);

        // 졸개가 셋 이상 살아 있는 틱까지 돌린다
        while (s.phase === "battle" && countEnemies(s) < 3 && s.tick < 6000) {
            step(s, (st) => autoPlayTick(st));
        }
        expect(countEnemies(s), "졸개가 살아 있는 상황을 만들지 못했다").toBeGreaterThanOrEqual(3);

        const victim = s.lanes.find((l) => l.enemies.length)?.enemies[0];
        s.modeState.bossId = victim.id;
        victim.hp = 0;

        step(s); // stepDeaths → noteBossDeath → despawnAdds
        return s;
    }

    it("보스가 죽으면 남은 졸개가 필드에서 사라진다", () => {
        const s = killBossMidFight(true);
        expect(s.modeState.bossDead).toBe(true);
        expect(countEnemies(s)).toBe(0);
        expect(s.actives.some((e) => !e.isAlly)).toBe(false);
    });

    it("★ 데이터에서 끄면 졸개가 남는다 — 스위치를 실제로 읽는다", () => {
        const s = killBossMidFight(false);
        expect(s.modeState.bossDead).toBe(true);
        expect(countEnemies(s)).toBeGreaterThan(0);
    });

    it("★ 소멸은 처치가 아니다 — kills 를 올리지 않는다", () => {
        const cfg = buildStageConfig(id, SIX);
        const s = createSim(cfg, 3);
        while (s.phase === "battle" && countEnemies(s) < 3 && s.tick < 6000) {
            step(s, (st) => autoPlayTick(st));
        }
        const victim = s.lanes.find((l) => l.enemies.length)?.enemies[0];
        s.modeState.bossId = victim.id;
        victim.hp = 0;
        const before = s.stats.kills;
        step(s);
        // 보스 본체 1 만 처치로 센다 — 나머지는 소멸이다
        expect(s.stats.kills).toBe(before + 1);
    });
});

/* ══════════════════════════════════════════════════════════════
 * 격퇴 (회귀 방지)
 * ══════════════════════════════════════════════════════════════ */
describe("격퇴 (assault)", () => {
    it("모드 도입 후에도 전 웨이브 격퇴로 승리한다", () => {
        const s = run("1-1", 1);
        expect(s.phase).toBe("victory");
        expect(s.mode).toBe(MODE.ASSAULT);
    });
});
