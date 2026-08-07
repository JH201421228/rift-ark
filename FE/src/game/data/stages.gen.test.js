/**
 * 스테이지 생성기 드리프트 방지 (2026-08-03)
 *
 * ★★ 이 테스트가 지키는 것은 **하나**다.
 *   `stages.json` 이 `worlds.json` + 생성 규칙으로부터 **재현 가능한가.**
 *
 *   재현 불가능해지는 순간, 누구든 `npm run gen:stages` 를 돌리면 실측으로 얻은
 *   밸런스 값이 조용히 사라진다. 실제로 2026-08-03 이전에 그 상태였다 —
 *   생성기 출력과 파일이 **18 스테이지**에서 달랐고, 차이는 전부 파이프라인 밖에서
 *   따로 돌린 후처리 스크립트가 만든 것이었다 (지금은 생성기 안에 있다).
 *   생성기를 한 번만 돌렸으면 비행 상한 15개와 버티기 물량 3개가 날아갔다.
 *
 *   그래서 "돌려도 안 바뀐다"를 **주장이 아니라 테스트**로 만든다.
 *   손으로 stages.json 을 고치면 여기서 빨간불이 켜지고, 고치는 법은 하나다 —
 *   worlds.json 에 넣고 `npm run gen:stages -- --force`.
 *
 * @see docs/04-plan/33-execution-plan.md P6-01
 */
import { describe, it, expect } from "vitest";
import { generateStages, capFlyingRatio } from "../../../tools/lib/stages-core.mjs";
import worldsData from "./worlds.json";
import enemiesData from "./enemies.json";
import stagesData from "./stages.json";

const E = new Map(enemiesData.enemies.map((e) => [e.id, e]));
const isAir = (id) => (E.get(id)?.tags ?? []).includes("FLYING");
const bodies = (sp) => sp.count * (sp.lanes?.length ?? 3);
const stageBodies = (s) => s.waveTable.reduce((n, w) => n + w.spawns.reduce((m, sp) => m + bodies(sp), 0), 0);
const airBodies = (s) =>
    s.waveTable.reduce(
        (n, w) => n + w.spawns.reduce((m, sp) => m + (isAir(sp.id) ? bodies(sp) : 0), 0),
        0
    );

describe("stages.json 재현성", () => {
    const { stages, missing } = generateStages(worldsData, enemiesData);

    it("worlds.json 이 참조하는 적이 전부 존재한다", () => {
        expect(missing).toEqual([]);
    });

    it("생성기 출력이 stages.json 과 정확히 같다", () => {
        // ★ 실패하면 stages.json 을 손으로 고쳤거나, 생성 규칙이 바뀐 것이다.
        //   전자면 worlds.json 으로 옮기고, 후자면 --force 로 확정한다.
        expect(stages.map((s) => s.id)).toEqual(stagesData.stages.map((s) => s.id));
        for (let i = 0; i < stages.length; i++) {
            expect(stages[i], `스테이지 ${stages[i].id} 가 생성 결과와 다르다`).toEqual(
                stagesData.stages[i]
            );
        }
    });

    it("두 번 생성해도 같다 (결정론)", () => {
        const again = generateStages(worldsData, enemiesData).stages;
        expect(again).toEqual(stages);
    });
});

describe("실측으로 얻은 밸런스 값이 worlds.json 에 살아 있다", () => {
    // ★ 이 세 개는 하드 게이트를 통과시키려고 실측으로 얻은 값이다.
    //   worlds.json 에서 사라지면 재생성 때 되돌아간다 — 여기서 잡는다.

    it("1-9 의 설계된 첫 패배 손잡이가 worlds.json 에 살아 있다 (게이트 B3)", () => {
        /**
         * ★★ 이 값은 **플레이어가 쓸 수 있는 수단의 총합**에 종속된다.
         *   그 총합이 바뀔 때마다 다시 재야 하고, 실제로 세 번 그랬다:
         *     3.6  → 3.75  방벽 1→2기 (추천 편성이 세짐, 50.7% 로 떠오름)
         *     3.75 → 3.85  **지휘관 주문 도입** (자동 플레이가 주문을 쓰면서 48% 로 떠오름)
         *     3.55 → 4.3   **각인 6종이 실제로 작동하기 시작**(2026-08-05) — 같은 배율에서
         *                  승률이 **100%** 가 됐다. 안 되던 것이 되기 시작한 만큼 다시 올렸다.
         *
         *   즉 추천 편성 규칙 · 로스터 · 주문 · **각인**을 만지는 사람은 이 값도 다시 재야 한다.
         *
         * ★★ 2026-08-05 에 **손잡이가 셋으로 늘었다.** 배율만으로는 창(30–45%)에 못
         *   들어간다는 것이 실측으로 드러났기 때문이다 — 4.3=90% · 5.0=72% · 5.6=62% ·
         *   6.8=62% 로 **평평해진다** (아군이 전선을 유지해 방주가 거의 맞지 않는다).
         *   그래서 `surge`(후반 4웨이브로 물량을 몰아 모양을 바꾼다)와
         *   `arkRegenPerWave`(초반 생존과 후반 치사성을 분리한다)를 함께 켰다.
         *   패배의 질이 크게 좋아졌다 — 패배 시 적 잔여 HP 중앙값 82% → **17%**.
         *
         * ★ 창에 넣으려면 **물량**을 1.5~1.6배로 올려야 한다는 것까지 실측했으나
         *   (1.5=41.7% · 1.6=33.3%), 그 값은 머릿수 상한(`maxBodies: 110`)을 크게
         *   넘고 1-9 는 이미 전 스테이지 중 **동시 엔티티 최다**(152~165체)다.
         *   성능 판단이 먼저라 보류했다 — `26-performance-budget.md` §10-A.
         */
        const beat = worldsData.worlds
            .find((w) => w.world === 1)
            .beats.find((b) => b.index === 9);
        const stage = stagesData.stages.find((s) => s.id === "1-9");

        expect(beat.difficultyMult).toBe(4.3);
        expect(stage.difficultyMult).toBe(4.3);
        expect(stage.designedDefeat).toBe(true);
        // 모양 손잡이 둘 — 하나라도 사라지면 패배의 질이 옛날(잔여 82%)로 돌아간다
        expect(beat.surge, "후반 급증").toEqual({ waves: 4, mult: 3 });
        expect(stage.arkRegenPerWave, "웨이브 사이 방주 회복").toBe(4);
    });

    it("보스 6체가 worlds.json 에 배치되어 있고 stages.json 마지막 웨이브에 단독으로 선다", () => {
        for (const world of worldsData.worlds) {
            for (const beat of world.beats.filter((b) => b.boss)) {
                const st = stagesData.stages.find((s) => s.id === `${world.world}-${beat.index}`);
                const last = st.waveTable[st.waveTable.length - 1];
                expect(last.spawns, `${st.id} 보스 웨이브`).toEqual([
                    { id: beat.boss, count: 1, lanes: [1] },
                ]);
            }
        }
    });

    it("postProcess 손잡이가 데이터에 있다 (코드 하드코딩 금지 — 절대 규칙 4)", () => {
        expect(worldsData.postProcess.flyingCap).toBe(0.35);
    });
});

describe("후처리 효과가 실제 stages.json 에 반영되어 있다", () => {
    it("모든 스테이지의 FLYING 비율이 상한 이하다 (게이트 B16 방벽 필수성)", () => {
        const over = stagesData.stages
            .map((s) => ({ id: s.id, r: stageBodies(s) ? airBodies(s) / stageBodies(s) : 0 }))
            .filter((x) => x.r > worldsData.postProcess.flyingCap + 1e-9);
        expect(over).toEqual([]);
    });

    it("capFlyingRatio 는 멱등이다 (두 번 걸어도 안 변한다)", () => {
        const copy = JSON.parse(JSON.stringify(stagesData.stages));
        const log = capFlyingRatio(copy, enemiesData.enemies, worldsData.postProcess.flyingCap);
        expect(log).toEqual([]);
        expect(copy).toEqual(stagesData.stages);
    });


    it("버티기 스테이지는 같은 인덱스의 격퇴 스테이지보다 물량이 적다", () => {
        for (const st of stagesData.stages.filter((s) => s.mode === "endure")) {
            const peers = stagesData.stages.filter(
                (s) => s.world === st.world && s.mode === "assault"
            );
            const median = peers.map(stageBodies).sort((a, b) => a - b)[Math.floor(peers.length / 2)];
            expect(stageBodies(st), `${st.id}`).toBeLessThan(median);
        }
    });
});
