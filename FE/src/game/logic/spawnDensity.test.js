/**
 * 스폰 밀도와 **유일 개체**.
 *
 * ★ 이 파일이 있는 이유는 실제로 난 사고 때문이다.
 *   템포 시프트 물량 배율(1.6)이 `count: 1` 인 보스 스펙에도 곱해져
 *   `Math.round(1 × 1.6) = 2` → **전 보스 스테이지에서 보스가 2체 스폰**됐다.
 *
 *   두 번째 보스는 단순히 한 마리 더가 아니라 **규칙 밖의 개체**였다:
 *   - `attachBoss()` 는 이미 등록된 보스가 있으면 조기 반환한다
 *     → 페이즈 전환도 슬램도 없이 base 태그로 고정
 *   - `noteBossBreach()` 는 등록된 id 만 본다
 *     → **"보스가 방주에 닿으면 패배" 규칙을 통째로 우회**한다
 *
 *   기존 보스 테스트가 못 잡은 이유는 **등록된 보스만** 검사했기 때문이다.
 *   복제본은 애초에 등록되지 않으므로 시야 밖이었다.
 *
 * ★ 전투를 끝까지 돌려서 검증하지 않는다. 지는 판에서는 보스가 **아예 나오지 않아**
 *   "2체인가"를 물을 수조차 없다 — 실제로 그렇게 짜 보고 전 스테이지가 0마리로
 *   집계되는 것을 겪었다. 규칙(`spawnCountFor`)만 따로 재는 것이 옳다.
 */
import { describe, it, expect } from "vitest";
import { spawnCountFor } from "./spawn.js";
import { buildStageConfig } from "./stageConfig.js";
import stagesData from "../data/stages.json" with { type: "json" };
import enemiesData from "../data/enemies.json" with { type: "json" };
import balance from "../data/balance.json" with { type: "json" };

const TEMPO = balance.battlefield.tempoDensityMult;
const HARD = balance.difficulty?.levels?.hard?.spawnCountMult ?? 1;

const BOSS_IDS = new Set(
    enemiesData.enemies.filter((e) => e.boss?.phases?.length).map((e) => e.id)
);
const GIANT_IDS = new Set(enemiesData.enemies.filter((e) => e.giant).map((e) => e.id));

/**
 * ★ 원본 정의로 잰다. `spawnCountFor` 의 판정 근거는 `boss.phases` 와 `giant` 뿐이고
 *   둘 다 스케일링을 거쳐도 그대로 남는다. 60 스테이지마다 `buildStageConfig` 를
 *   부르면 실제로 힙이 터진다 (겪었다).
 * ★ 다만 **프로덕션이 넘기는 형태**(cfg.enemyDefs)도 같은 판정을 받는지
 *   맨 아래에서 한 건 따로 확인한다 — 원본으로만 재면 형태가 갈라져도 모른다.
 */
const RAW = Object.fromEntries(enemiesData.enemies.map((e) => [e.id, e]));

describe("전제", () => {
    it("템포 배율이 1 보다 크다 — 아니면 이 검사 전체가 무의미하다", () => {
        // 배율이 1 이면 버그가 재발해도 테스트가 통과해 버린다
        expect(TEMPO).toBeGreaterThan(1);
    });

    it("count 1 에 템포 배율을 곱하면 반올림으로 2 가 된다 — 사고의 산술적 원인", () => {
        expect(Math.round(1 * TEMPO)).toBe(2);
    });

    it("보스와 거대화 엘리트가 실재한다", () => {
        expect(BOSS_IDS.size).toBeGreaterThan(0);
        expect(GIANT_IDS.size).toBeGreaterThan(0);
    });
});

describe("유일 개체는 밀도로 복제되지 않는다", () => {
    const cases = [];
    for (const stage of stagesData.stages) {
        for (const w of stage.waveTable) {
            for (const sp of w.spawns) {
                if (!BOSS_IDS.has(sp.id) && !GIANT_IDS.has(sp.id)) continue;
                cases.push({ stageId: stage.id, wave: w.wave, spec: sp, def: RAW[sp.id] });
            }
        }
    }

    it("검사 대상이 존재한다", () => {
        expect(cases.length).toBeGreaterThan(0);
    });

    it(`유일 개체 ${cases.length} 건 전부 — 템포 시프트에도 설계 수 그대로`, () => {
        for (const c of cases) {
            expect(
                spawnCountFor(c.def, c.spec.count, TEMPO),
                `${c.stageId} w${c.wave} ${c.spec.id}`
            ).toBe(c.spec.count);
        }
    });

    it("하드 난이도(템포 × 스폰 배율)에서도 늘어나지 않는다", () => {
        for (const c of cases) {
            expect(
                spawnCountFor(c.def, c.spec.count, TEMPO * HARD),
                `${c.stageId} w${c.wave} ${c.spec.id} (하드)`
            ).toBe(c.spec.count);
        }
    });
});

describe("잡몹은 밀도 배율을 그대로 받는다", () => {
    // 유일 개체만 예외라는 것을 확인한다 — 배율 자체를 죽이면 난이도 손잡이가 사라진다
    const trash = enemiesData.enemies.find((e) => !e.boss?.phases?.length && !e.giant);

    it("잡몹 정의가 존재한다", () => {
        expect(trash).toBeTruthy();
    });

    it("count 1 잡몹은 템포 시프트에서 2 로 늘어난다", () => {
        const def = RAW[trash.id];
        expect(spawnCountFor(def, 1, TEMPO)).toBe(2);
    });

    it("count 5 잡몹은 배율만큼 늘어난다", () => {
        const def = RAW[trash.id];
        expect(spawnCountFor(def, 5, TEMPO)).toBe(Math.round(5 * TEMPO));
    });

    it("배율이 1 이면 그대로다", () => {
        const def = RAW[trash.id];
        expect(spawnCountFor(def, 7, 1)).toBe(7);
    });

    it("최소 1마리는 보장된다 — 배율이 작아도 사라지지 않는다", () => {
        const def = RAW[trash.id];
        expect(spawnCountFor(def, 1, 0.1)).toBe(1);
    });
});

describe("프로덕션이 넘기는 정의 형태에서도 같은 판정이 나온다", () => {
    /**
     * ★ 위 검사는 전부 `enemies.json` **원본**으로 했다. 실제로 `queueWave` 가
     *   넘기는 것은 `buildStageConfig` 가 만든 스케일된 정의다. 두 형태가 갈라지면
     *   (예: `boss` 가 다른 이름으로 정규화되면) 원본 검사는 전부 통과하는데
     *   게임에서는 보스가 다시 2체가 된다. 그래서 **한 스테이지만** 실제 형태로 확인한다.
     *   (60 스테이지 전부 빌드하면 힙이 터진다 — 겪었다.)
     */
    const bossStage = stagesData.stages.find((s) =>
        s.waveTable.some((w) => w.spawns.some((sp) => BOSS_IDS.has(sp.id)))
    );

    it("보스 스테이지가 존재한다", () => {
        expect(bossStage).toBeTruthy();
    });

    it("cfg.enemyDefs 의 보스도 밀도로 복제되지 않는다", () => {
        const defs = buildStageConfig(bossStage.id, []).enemyDefs;
        const spec = bossStage.waveTable
            .flatMap((w) => w.spawns)
            .find((sp) => BOSS_IDS.has(sp.id));
        expect(spawnCountFor(defs[spec.id], spec.count, TEMPO)).toBe(spec.count);
    });
});
