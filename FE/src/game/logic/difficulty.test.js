/**
 * 난이도 모드 테스트 (P6-10)
 *
 * ★ 이 파일이 지키는 명제는 셋이다.
 *   1) 배율은 **데이터에서 온다** — 코드에 1.35 를 적으면 이 테스트가 통과하지 못한다.
 *   2) 하드는 **실제로** 더 무겁다 (숫자만 다른 게 아니라 스폰까지 늘어난다).
 *   3) 난이도가 붙어도 **결정론이 유지된다** — 여기가 깨지면 하네스로 하드를
 *      측정할 수 없고, 하드 밸런싱은 감으로 하게 된다.
 *
 * @see docs/02-design/15-content-plan.md §2
 */
import { describe, it, expect } from "vitest";
import {
    DIFFICULTIES,
    difficultyNote,
    DIFFICULTY_IDS,
    DEFAULT_DIFFICULTY,
    difficultyConfig,
    difficultyDef,
    difficultyName,
    difficultyProgress,
    difficultyUnlockText,
    isDifficultyImplemented,
    isDifficultyUnlocked,
    stageIdsOfWorld,
    stageReward,
    globalStageIndex,
    worldOfStage,
} from "./difficulty.js";
import { buildStageConfig } from "./stageConfig.js";
import { LANGS } from "../../i18n/index.js";
import { createSim, runToCompletion } from "./sim.js";
import { autoPlayTick } from "./autoPlay.js";
import balance from "../data/balance.json" with { type: "json" };

const BASIC = ["slow_turtle", "determined_soldier", "elf_sharpshooter", "novice_pyromancer"];

const HARD = balance.difficulty.levels.hard;

const summary = (s) => ({
    phase: s.phase,
    arkHp: Math.round(s.arkHp * 1000),
    kills: s.stats.kills,
    tick: s.tick,
});

function run(stageId, seed, difficulty) {
    const cfg = buildStageConfig(stageId, BASIC, { difficulty });
    const s = createSim(cfg, seed);
    runToCompletion(s, (st) => autoPlayTick(st), 400);
    return s;
}

/* ══════════════════════════════════════════════════════════════
 * 데이터 소유권 (절대 규칙 4)
 * ══════════════════════════════════════════════════════════════ */
describe("난이도 배율은 balance.json 이 소유한다", () => {
    it("cfg 의 배율이 데이터 값과 정확히 일치한다", () => {
        const normal = buildStageConfig("1-5", BASIC);
        const hard = buildStageConfig("1-5", BASIC, { difficulty: "hard" });

        expect(normal.spawnCountMult).toBe(1);
        expect(hard.spawnCountMult).toBe(HARD.spawnCountMult);

        // 적 HP/ATK 비율 = 데이터 배율. 코드에 상수가 박혀 있으면 여기서 어긋난다.
        for (const id of Object.keys(normal.enemyDefs)) {
            const n = normal.enemyDefs[id];
            const h = hard.enemyDefs[id];
            expect(h.hp / n.hp).toBeCloseTo(HARD.enemyHpMult, 1);
            expect(h.atk / n.atk).toBeCloseTo(HARD.enemyAtkMult, 1);
        }
    });

    it("order 의 모든 난이도가 levels 에 정의되어 있다", () => {
        expect(DIFFICULTY_IDS.length).toBeGreaterThan(1);
        for (const id of DIFFICULTY_IDS) expect(difficultyDef(id)).toBeTruthy();
        expect(DEFAULT_DIFFICULTY).toBe("normal");
    });

    it("난이도가 올라갈수록 배율이 단조 증가한다", () => {
        let prev = null;
        for (const id of DIFFICULTY_IDS) {
            const lv = difficultyDef(id);
            if (prev) {
                expect(lv.enemyHpMult).toBeGreaterThanOrEqual(prev.enemyHpMult);
                expect(lv.spawnCountMult).toBeGreaterThanOrEqual(prev.spawnCountMult);
            }
            prev = lv;
        }
    });
});

/* ══════════════════════════════════════════════════════════════
 * 하드가 실제로 더 어렵다
 * ══════════════════════════════════════════════════════════════ */
describe("하드 난이도", () => {
    it("같은 스테이지에서 적이 더 단단하고 더 세다", () => {
        const n = buildStageConfig("1-10", BASIC);
        const h = buildStageConfig("1-10", BASIC, { difficulty: "hard" });
        for (const id of Object.keys(n.enemyDefs)) {
            expect(h.enemyDefs[id].hp).toBeGreaterThan(n.enemyDefs[id].hp);
            expect(h.enemyDefs[id].atk).toBeGreaterThan(n.enemyDefs[id].atk);
        }
    });

    it("스폰 수가 늘어난다 — 배율만 올린 '더 오래 때리기'가 아니다", () => {
        // ★ 총 처치 수로 확인한다. cfg 의 waveTable 은 공유 객체이므로
        //   여기서 개수를 세면 '데이터가 안 바뀌었다'만 확인하게 된다.
        const n = run("1-5", 7, "normal");
        const h = run("1-5", 7, "hard");
        const spawnedN = n.stats.kills + n.stats.breaches;
        const spawnedH = h.stats.kills + h.stats.breaches;
        expect(spawnedH).toBeGreaterThan(spawnedN);
    });

    // ★ 전투를 32판 돌린다 — 기본 5초 타임아웃으로는 부족하다.
    //   판 수를 더 줄이면 "경향"이라고 부를 수 없어진다.
    it("방주가 더 많이 깎인다 (동일 시드·동일 편성)", { timeout: 30_000 }, () => {
        let harder = 0;
        let total = 0;
        for (const stageId of ["1-5", "1-10"]) {
            for (let seed = 0; seed < 8; seed++) {
                const n = run(stageId, seed, "normal");
                const h = run(stageId, seed, "hard");
                total++;
                // 패배했거나 방주 잔량이 더 적으면 '더 어렵다'
                if (h.phase !== "victory" || h.arkHp <= n.arkHp) harder++;
            }
        }
        // ★ 전건 통과를 요구하지 않는다 — 스폰이 늘면 각인 드래프트 횟수도 늘어
        //   드물게 하드가 더 잘 풀리는 시드가 나온다. 경향이 뒤집히지 않는지만 본다.
        expect(harder / total).toBeGreaterThan(0.8);
    });

    it("결정론이 유지된다 — 같은 시드는 같은 결과", () => {
        expect(summary(run("1-7", 4242, "hard"))).toEqual(summary(run("1-7", 4242, "hard")));
    });

    it("노멀과 하드는 서로 다른 판이다", () => {
        expect(summary(run("1-7", 4242, "hard"))).not.toEqual(summary(run("1-7", 4242, "normal")));
    });
});

/* ══════════════════════════════════════════════════════════════
 * 미구현 · 오타
 * ══════════════════════════════════════════════════════════════ */
describe("난이도 오류 메시지", () => {
    /**
     * ★★ **이 테스트는 2026-08-05 에 명제가 뒤집혔다** (P11-10).
     *
     *   예전에는 "나이트메어는 미구현이고, 그 사실을 사람 말로 알린다"였다.
     *   규칙 3종이 붙으면서(docs/02-design/22-nightmare.md) 그 명제가 거짓이 됐고,
     *   지금 지켜야 할 것은 **켜졌으면 실제로 규칙이 걸린다**는 쪽이다.
     *   `implemented: true` 인데 규칙이 하나도 안 걸리면 나이트메어는 하드의 연장이다.
     *
     * ★ 미구현 메시지 경로 자체는 데이터에 미구현 난이도가 하나도 남지 않아
     *   지금은 도달할 수 없다. 지우지 않는 이유는 `difficulty.js` 머리말에 있다 —
     *   다음 난이도를 데이터에 먼저 적는 것이 이 저장소의 방식이다.
     */
    it("나이트메어는 구현됐고, 월드마다 규칙이 실제로 걸린다", () => {
        expect(isDifficultyImplemented("nightmare")).toBe(true);
        expect(difficultyConfig("nightmare").implemented).toBe(true);
        expect(difficultyName("nightmare")).toBe("나이트메어");
        expect(difficultyName("nightmare", "en")).toBe("Nightmare");
        for (const [stageId, id] of [
            ["1-1", "plague_bloom"],
            ["2-1", "bond_break"],
            ["5-1", "attrition"],
        ]) {
            const cfg = buildStageConfig(stageId, BASIC, { difficulty: "nightmare" });
            expect(cfg.nightmare?.id, stageId).toBe(id);
        }
    });

    it("오타는 '알 수 없는 난이도'로 구분된다 (미구현과 다른 사고다)", () => {
        expect(() => buildStageConfig("1-1", BASIC, { difficulty: "hardcore" })).toThrow(
            /알 수 없는 난이도/
        );
    });

    it("난이도를 생략하면 노멀이다", () => {
        expect(buildStageConfig("1-1", BASIC).difficulty).toBe("normal");
    });
});

/* ══════════════════════════════════════════════════════════════
 * 해금
 * ══════════════════════════════════════════════════════════════ */
describe("해금 조건", () => {
    const world1 = stageIdsOfWorld(1);

    it("노멀은 항상 열려 있다", () => {
        expect(isDifficultyUnlocked("normal", 1, {})).toBe(true);
    });

    it("월드를 노멀로 다 깨야 하드가 열린다", () => {
        const partial = Object.fromEntries(world1.slice(0, -1).map((id) => [id, 3]));
        expect(isDifficultyUnlocked("hard", 1, { normal: partial })).toBe(false);

        const p = difficultyProgress("hard", 1, { normal: partial });
        expect(p.done).toBe(world1.length - 1);
        expect(p.total).toBe(world1.length);

        const full = Object.fromEntries(world1.map((id) => [id, 1]));
        expect(isDifficultyUnlocked("hard", 1, { normal: full })).toBe(true);
    });

    it("월드별로 따로 열린다 — 월드 1 클리어가 월드 2 하드를 열지 않는다", () => {
        const full1 = Object.fromEntries(world1.map((id) => [id, 3]));
        expect(isDifficultyUnlocked("hard", 2, { normal: full1 })).toBe(false);
    });

    it("잠금 사유가 한국어 문장으로 나온다", () => {
        expect(difficultyUnlockText("hard", 2)).toContain("월드 2");
        expect(difficultyUnlockText("normal", 1)).toBe("");
    });

    it("알 수 없는 난이도는 '잠김'으로 취급한다 (기본 개방 금지)", () => {
        expect(isDifficultyUnlocked("hardcore", 1, {})).toBe(false);
    });

    /**
     * ★★★ **`DIFFICULTIES` 는 이름을 담지 않는다** (2026-08-07).
     *   모듈 스코프 상수는 로드 시점 언어로 굳는다 — 담았을 때 실제로
     *   "영어로 바꿔도 난이도 줄만 한국어" 가 됐다. 이름·안내문은 **부를 때마다**
     *   함수로 얻는다. 그래서 이 검사는 그 두 함수가 두 언어를 답하는지 본다.
     */
    it("DIFFICULTIES 는 id 와 구현 여부만 담는다 — 이름을 굳히지 않는다", () => {
        for (const d of DIFFICULTIES) {
            expect(Object.keys(d).sort()).toEqual(["id", "implemented"]);
        }
    });

    it.each(["ko", "en"])("%s — difficultyName·difficultyNote 가 답한다", (lang) => {
        for (const d of DIFFICULTIES) {
            expect(difficultyName(d.id, lang), `${d.id} 의 이름이 비었다`).toBeTruthy();
            if (!d.implemented) {
                expect(difficultyNote(d.id, lang), `${d.id} 의 안내문이 비었다`).toBeTruthy();
            }
        }
    });

    /**
     * ★★ 난이도 이름은 **두 언어**가 있어야 한다. 없으면 `t()` 가 카탈로그 키를
     *   그대로 돌려주므로(`terms.difficulty.hard`) 출격 버튼에 점 찍힌 영어가 뜬다.
     */
    it.each(LANGS)("[%s] 모든 난이도에 이름이 있다", (lang) => {
        for (const id of DIFFICULTY_IDS) {
            const name = difficultyName(id, lang);
            expect(name, `${id}`).toBeTruthy();
            expect(name, `${id}: 카탈로그 키가 그대로 보인다`).not.toBe(`terms.difficulty.${id}`);
        }
    });
});

/* ══════════════════════════════════════════════════════════════
 * 보상
 * ══════════════════════════════════════════════════════════════ */
describe("보상 차등", () => {
    it("하드가 노멀보다 골드를 더 준다", () => {
        const n = stageReward({ stageId: "2-10", difficulty: "normal" });
        const h = stageReward({ stageId: "2-10", difficulty: "hard" });
        expect(h.gold).toBeGreaterThan(n.gold);
    });

    it("★ 보상은 골드 하나뿐이다 (2026-08-04 경량화)", () => {
        expect(Object.keys(stageReward({ stageId: "1-5", difficulty: "hard" }))).toEqual(["gold"]);
    });

    it("하드가 노멀보다 많이 준다", () => {
        expect(stageReward({ stageId: "1-5", difficulty: "hard" }).gold).toBeGreaterThan(
            stageReward({ stageId: "1-5", difficulty: "normal" }).gold
        );
    });

    it("첫 클리어 보너스는 첫 클리어에만 나온다", () => {
        const first = stageReward({ stageId: "1-5", difficulty: "hard", firstClear: true });
        const again = stageReward({ stageId: "1-5", difficulty: "hard", firstClear: false });
        expect(first.gold).toBeGreaterThan(again.gold);
    });

    it("하드 골드 배율이 경제 모델의 repeatFactor 를 넘지 않는다", () => {
        // ★ 넘는 순간 '하드 1회 > 노멀 반복' 이 되어 calibrate-economy 의
        //   총 골드 곡선이 실제와 갈라진다.
        expect(HARD.reward.goldMult).toBeLessThanOrEqual(balance.economy.repeatFactor);
    });

    it("보상은 결정론이다 — 같은 입력은 항상 같은 값", () => {
        const a = stageReward({ stageId: "3-1", difficulty: "hard", firstClear: true });
        const b = stageReward({ stageId: "3-1", difficulty: "hard", firstClear: true });
        expect(a).toEqual(b);
    });

    it("뒤 스테이지일수록 보상이 크다", () => {
        const a = stageReward({ stageId: "1-1", difficulty: "hard" });
        const b = stageReward({ stageId: "3-20", difficulty: "hard" });
        expect(b.gold).toBeGreaterThan(a.gold);
    });
});

describe("스테이지 id 유틸", () => {
    it("전역 순번과 월드를 뽑는다", () => {
        expect(globalStageIndex("1-1")).toBe(1);
        expect(globalStageIndex("3-20")).toBe(60);
        expect(worldOfStage("2-13")).toBe(2);
    });
});
