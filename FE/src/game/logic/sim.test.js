/**
 * 시뮬레이션 통합 테스트
 *
 * ★ B1 결정론은 하드 게이트다. 여기가 깨지면 밸런스 하네스 · 리플레이 ·
 *   비동기 PvP 고스트가 전부 무의미해진다.
 *
 * @see docs/02-design/14-economy-balance.md §7
 */
import { describe, it, expect, beforeAll } from "vitest";
import {
    createSim,
    step,
    runToCompletion,
    computeStars,
    diagnoseDefeat,
    chooseSigil,
} from "./sim.js";
import { buildStageConfig, growthMultiplier } from "./stageConfig.js";
import { autoPlayTick } from "./autoPlay.js";
import { trySummon } from "./spawn.js";
import { summonCost } from "./resources.js";
import { mulberry32, makeStreams } from "./rng.js";
import { TICK_MS } from "./tick.js";
import balance from "../data/balance.json" with { type: "json" };

const BASIC = ["slow_turtle", "determined_soldier", "elf_sharpshooter", "novice_pyromancer"];

function run(stageId, seed, loadout = BASIC, maxSec = 400) {
    const cfg = buildStageConfig(stageId, loadout);
    const s = createSim(cfg, seed);
    runToCompletion(s, (st) => autoPlayTick(st), maxSec);
    return s;
}

const summary = (s) => ({
    phase: s.phase,
    arkHp: Math.round(s.arkHp * 1000),
    kills: s.stats.kills,
    summons: s.stats.summons,
    tick: s.tick,
    mana: Math.round(s.mana * 1000),
});

/* ══════════════════════════════════════════════════════════════
 * B1 — 결정론 (하드 게이트)
 * ══════════════════════════════════════════════════════════════ */
describe("B1 결정론", () => {
    it("동일 시드는 완전히 동일한 결과를 낸다", () => {
        expect(summary(run("1-5", 12345))).toEqual(summary(run("1-5", 12345)));
        expect(summary(run("1-9", 999))).toEqual(summary(run("1-9", 999)));
    });

    it("다른 시드는 다른 결과를 낸다", () => {
        const a = run("1-8", 1);
        const b = run("1-8", 2);
        expect(a.tick === b.tick && a.stats.kills === b.stats.kills).toBe(false);
    });

    it("연출(fx) 스트림은 시뮬 결과에 절대 영향을 주지 않는다", () => {
        // ★ fx 는 연출 전용이다. 파티클 개수 하나 바꿨다고 전투 결과가 달라지면
        //   밸런스 하네스가 무의미해진다.
        const cfg = buildStageConfig("1-5", BASIC);

        const plain = createSim(cfg, 777);
        runToCompletion(plain, (st) => autoPlayTick(st));

        const polluted = createSim(cfg, 777);
        for (let i = 0; i < 500; i++) polluted.rng.fx();
        runToCompletion(polluted, (st) => autoPlayTick(st));

        expect(summary(polluted)).toEqual(summary(plain));
    });

    it("각인 스트림은 전투 스트림과 분리되어 있다", () => {
        // 각인 스트림을 소비하면 뽑히는 각인이 달라지므로 결과도 달라진다(정상).
        // 중요한 것은 **전투 스트림이 오염되지 않는 것** — 같은 각인을 뽑으면
        // 전투 전개가 동일해야 한다.
        const cfg = buildStageConfig("1-5", BASIC);

        const a = createSim(cfg, 4242);
        runToCompletion(a, (st) => autoPlayTick(st), 400, () => 0);
        const b = createSim(cfg, 4242);
        runToCompletion(b, (st) => autoPlayTick(st), 400, () => 0);

        expect(summary(a)).toEqual(summary(b));
        expect(a.sigils).toEqual(b.sigils);
    });

    it("mulberry32 는 시드별로 안정적이다", () => {
        const a = mulberry32(42);
        const b = mulberry32(42);
        for (let i = 0; i < 100; i++) expect(a()).toBe(b());
        expect(mulberry32(42)()).not.toBe(mulberry32(43)());
    });

    it("스트림 4개가 서로 다른 수열을 낸다", () => {
        const s = makeStreams(1);
        const first = [s.spawn(), s.combat(), s.sigil(), s.fx()];
        expect(new Set(first).size).toBe(4);
    });
});

/* ══════════════════════════════════════════════════════════════
 * 전투 종료 보장
 * ══════════════════════════════════════════════════════════════ */
describe("전투는 반드시 끝난다", () => {
    // ★ 7스테이지 × 3시드 = 21판. 아군이 전선을 유지하게 된 뒤(movement.js)
    //   전투가 실제로 붙어서 끝나므로 판당 시간이 길어졌다. 예산을 명시한다.
    it("모든 스테이지가 victory 또는 defeat 로 종료된다", () => {
        for (const id of ["1-1", "1-2", "1-5", "1-6", "1-8", "1-9", "1-10"]) {
            for (const seed of [1, 7, 13]) {
                const s = run(id, seed);
                expect(["victory", "defeat"]).toContain(s.phase);
            }
        }
    }, 120_000);

    it("시간 초과는 패배로 처리된다 (무한 루프 없음)", () => {
        const cfg = buildStageConfig("1-10", ["slow_turtle"]); // 딜이 0인 편성
        const s = createSim(cfg, 1);
        runToCompletion(s, null, 30);
        expect(s.phase).toBe("defeat");
    });
});

/* ══════════════════════════════════════════════════════════════
 * B16 — 방벽 필수성 (구조적 심장)
 * ══════════════════════════════════════════════════════════════ */
describe("B16 방벽 필수성", () => {
    const WITH = ["slow_turtle", "elf_sharpshooter", "novice_pyromancer"];
    const WITHOUT = ["elf_sharpshooter", "novice_pyromancer", "determined_soldier"];

    /**
     * ★ 단일 시드로 판정하지 않는다.
     *   드래프트가 들어온 뒤로는 판마다 편차가 크므로, 한 시드가 우연히 뒤집히면
     *   테스트가 밸런싱을 방해한다. 하네스와 같이 여러 시드의 평균으로 본다.
     */
    const avg = (stage, loadout, seeds = 12) => {
        let hp = 0;
        let wins = 0;
        for (let s = 0; s < seeds; s++) {
            const r = run(stage, s, loadout);
            hp += r.arkHp;
            if (r.phase === "victory") wins++;
        }
        return { hp: hp / seeds, winRate: wins / seeds };
    };

    /**
     * ★ 판정 스테이지는 1-11(assault) 이다.
     *   이전에는 1-10 을 썼지만 P6 재생성으로 1-10 이 nemesis(거대화 엘리트) 가
     *   되면서 두 편성 모두 승률 0 → 비교가 무의미해졌다.
     *   1-11 은 방벽 유무가 승패를 그대로 가른다 (방벽 92% / 무방벽 0%).
     *
     * ★ 승률과 잔여 HP 를 함께 본다.
     *   승률만 보면 절벽 함수라 난이도를 조금만 돌려도 1.0/1.0 이나 0/0 으로
     *   붙어버려 주장을 측정하지 못한다. 누수량(잔여 HP)은 연속값이라
     *   커브가 움직여도 "방벽이 있으면 덜 샌다"를 계속 검증한다.
     */
    let gate;
    beforeAll(() => {
        gate = { with: avg("1-11", WITH), without: avg("1-11", WITHOUT) };
    }, 60_000);

    it("방벽이 없으면 승률이 떨어진다 — 적은 BLOCKER 에게만 멈춘다", () => {
        expect(gate.without.winRate).toBeLessThan(gate.with.winRate);
    });

    it("방벽 없는 편성은 누수가 크게 밀린다", () => {
        expect(gate.without.hp).toBeLessThanOrEqual(gate.with.hp * 0.7);
    });

    it("원거리 단일 편성은 붕괴한다", () => {
        expect(avg("1-9", ["elf_sharpshooter"], 8).winRate).toBeLessThan(0.2);
    }, 30_000);
});

/* ══════════════════════════════════════════════════════════════
 * B5 — 상성 유효성
 * ══════════════════════════════════════════════════════════════ */
describe("B5 상성 유효성", () => {
    /**
     * ★★★ **잔여 HP 가 아니라 클리어 시간으로 잰다** (2026-08-04 변경).
     *
     *   예전에는 두 편성의 `arkHp` 를 비교했다. 그런데 그 지표는 **누수(방주 피격)가
     *   있어야만** 움직인다. 방벽 스티키 수정(`movement.js:stepBlocking`) 으로 방벽이
     *   붙든 적을 더 이상 놓지 않게 되자, 1-5 에서 **두 편성 모두 누수 0** 이 되어
     *   `arkHp` 가 100/100 으로 붙어버렸다 — 12시드 전부 무승부라 주장을 아예 측정하지
     *   못했다 (`arcaneWins 0 / physicalWins 0`).
     *
     *   지표가 죽은 것이지 주장이 죽은 것이 아니다. 오히려 더 또렷해졌다:
     *     시드 0: 술식 83.5초 vs 물리 101.1초
     *     시드 1: 술식 73.0초 vs 물리 100.3초
     *     시드 2: 술식 86.5초 vs 물리 108.6초
     *   ARMORED 는 DEF 가 높고 술식은 **DEF 를 무시한다**(combat.js). 그래서 상성이
     *   맞으면 **더 빨리 녹인다.** 시간은 연속값이라 포화되지 않는다.
     *
     * ★ 누수가 생기는 커브로 돌아가더라도 시간 지표는 계속 유효하다.
     */
    it("ARMORED 다수 스테이지에서 술식 편성이 물리 편성보다 낫다 (더 빨리 정리한다)", () => {
        // ★ 1-5 가 ARMORED 를 가르치는 스테이지다 ("중장갑 — 물리가 안 통한다").
        //   비행이 섞이지 않아 상성 하나만 분리해서 본다.
        //   (1-8 은 P6 재생성으로 escort 가 되면서 두 편성이 모두 완주 → 무승부였다)
        let arcaneWins = 0;
        let physicalWins = 0;
        for (let seed = 0; seed < 12; seed++) {
            const arcane = run("1-5", seed, ["slow_turtle", "novice_pyromancer", "novice_pyromancer"]);
            const physical = run("1-5", seed, ["slow_turtle", "determined_soldier", "determined_soldier"]);
            // 둘 다 이긴다면 **먼저 끝낸 쪽**이 상성이 맞은 쪽이다.
            // 승패가 갈리면 이긴 쪽이 우선 (진 쪽은 시간이 짧아도 의미가 없다).
            const aWon = arcane.phase === "victory";
            const pWon = physical.phase === "victory";
            if (aWon !== pWon) {
                if (aWon) arcaneWins++;
                else physicalWins++;
            } else if (arcane.t < physical.t) arcaneWins++;
            else if (physical.t < arcane.t) physicalWins++;
        }
        expect(arcaneWins).toBeGreaterThan(physicalWins);
        // ★ 12시드 × 2편성 = 24판. 웨이브 수를 늘린 뒤(각인 4–6픽 확보) 기본
        //   5초 예산을 넘겨 부하가 걸린 기계에서 산발적으로 실패했다.
        //   느려진 것이지 깨진 것이 아니므로 예산을 명시한다 (B16 과 동일한 처리).
    }, 60_000);

    it("대공 수단이 없으면 비행 웨이브를 막지 못한다", () => {
        const withAA = run("1-6", 3, ["slow_turtle", "elf_sharpshooter", "elf_sharpshooter"]);
        const noAA = run("1-6", 3, ["slow_turtle", "determined_soldier", "determined_soldier"]);
        expect(noAA.arkHp).toBeLessThan(withAA.arkHp);
    });
});

/* ══════════════════════════════════════════════════════════════
 * B6 — 스팸 억제
 * ══════════════════════════════════════════════════════════════ */
describe("B6 스팸 억제", () => {
    it("소환 코스트가 타입별로 1.18배씩 상승한다", () => {
        const cfg = buildStageConfig("1-1", BASIC);
        const s = createSim(cfg, 1);
        const def = cfg.loadout.find((u) => u.id === "determined_soldier");

        const costs = [];
        for (let i = 0; i < 4; i++) {
            costs.push(Math.ceil(def.cost * Math.pow(cfg.summonCostGrowth, i)));
        }
        expect(costs).toEqual([12, 15, 17, 20]);
        expect(s.summonCounts.determined_soldier).toBeUndefined();
    });

    it("다른 타입의 코스트는 영향을 받지 않는다 — 다양화가 반격이다", () => {
        const cfg = buildStageConfig("1-1", BASIC);
        const s = createSim(cfg, 1);
        const soldier = cfg.loadout.find((u) => u.id === "determined_soldier");
        const archer = cfg.loadout.find((u) => u.id === "elf_sharpshooter");

        s.summonCounts.determined_soldier = 5;

        expect(summonCost(s, soldier.id, soldier.cost)).toBeGreaterThan(soldier.cost);
        expect(summonCost(s, archer.id, archer.cost)).toBe(archer.cost);
    });

    it("12초 뒤 코스트가 감쇠한다 — 완전 봉쇄가 아니라 리듬 강제다", () => {
        const cfg = buildStageConfig("1-1", BASIC);
        const s = createSim(cfg, 1);
        const soldier = cfg.loadout.find((u) => u.id === "determined_soldier");

        s.summonCounts.determined_soldier = 3;
        s.summonDecayAt.determined_soldier = 0;
        const before = summonCost(s, soldier.id, soldier.cost);

        for (let i = 0; i < 30 * 13; i++) step(s);
        expect(summonCost(s, soldier.id, soldier.cost)).toBeLessThan(before);
    });
});

/* ══════════════════════════════════════════════════════════════
 * 스케일링 커브
 * ══════════════════════════════════════════════════════════════ */
describe("적 HP 감쇠 커브", () => {
    it("구간별로 성장률이 감쇠한다 — 30–50 벽의 구조적 처방", () => {
        // ★ 커브 수치는 balance.json 이 소유한다 (sweep-difficulty 로 재탐색됨).
        //   테스트가 검증하는 것은 "구간 누적이 맞고, 뒤 구간일수록 완만하다"는 구조다.
        const c = balance.scaling.enemyHpGrowth;

        // 구간 경계마다 누적 배율이 앞 구간 누적 × 자기 구간 rate^길이 와 일치한다
        let expected = 1;
        let from = 0;
        for (const seg of c) {
            const to = Math.min(seg.maxStage, 300);
            expected *= Math.pow(seg.rate, to - from);
            expect(growthMultiplier(to, c)).toBeCloseTo(expected, 3);
            from = to;
        }

        // 뒤 구간일수록 성장률이 낮다 = 감쇠한다
        for (let i = 1; i < c.length; i++) {
            expect(c[i].rate).toBeLessThan(c[i - 1].rate);
        }

        // 감쇠하지 않고 첫 구간 기울기를 유지했다면 훨씬 커졌을 것이다
        expect(growthMultiplier(200, c)).toBeLessThan(Math.pow(c[0].rate, 200));
    });

    it("스테이지가 오를수록 HP 가 단조 증가한다", () => {
        const c = balance.scaling.enemyHpGrowth;
        let prev = 0;
        for (let s = 1; s <= 200; s += 7) {
            const m = growthMultiplier(s, c);
            expect(m).toBeGreaterThan(prev);
            prev = m;
        }
    });
});

/* ══════════════════════════════════════════════════════════════
 * 별 등급 · 패배 진단
 * ══════════════════════════════════════════════════════════════ */
describe("별 등급", () => {
    it("패배는 0성이다", () => {
        const cfg = buildStageConfig("1-10", ["slow_turtle"]);
        const s = createSim(cfg, 1);
        runToCompletion(s, null, 30);
        expect(computeStars(s)).toBe(0);
    });

    it("승리는 최소 1성이다", () => {
        const s = run("1-1", 1);
        if (s.phase === "victory") expect(computeStars(s)).toBeGreaterThanOrEqual(1);
    });
});

describe("패배 원인 진단", () => {
    it("막지 못한 적의 태그를 집계한다 — 결과 화면 진단의 근거", () => {
        const s = run("1-9", 11, ["elf_sharpshooter"]); // 방벽 없음
        if (s.phase === "defeat") {
            const d = diagnoseDefeat(s);
            expect(d.count).toBeGreaterThan(0);
            expect(typeof d.tag).toBe("string");
        }
    });

    it("진단 결과가 결정론적이다", () => {
        const a = diagnoseDefeat(run("1-9", 11, ["elf_sharpshooter"]));
        const b = diagnoseDefeat(run("1-9", 11, ["elf_sharpshooter"]));
        expect(a).toEqual(b);
    });
});

/* ══════════════════════════════════════════════════════════════
 * 시간 · 자원
 * ══════════════════════════════════════════════════════════════ */
describe("고정 틱", () => {
    it("1000틱은 정확히 33333.33ms 다", () => {
        const cfg = buildStageConfig("1-1", BASIC);
        const s = createSim(cfg, 1);
        // 드래프트가 열리면 시뮬이 멈추므로 즉시 해소하며 진행한다
        for (let i = 0; i < 1000; i++) {
            if (s.phase === "draft") chooseSigil(s, 0);
            step(s);
        }
        expect(s.t).toBeCloseTo(1000 * TICK_MS, 6);
    });

    it("마나는 상한을 넘지 않는다", () => {
        const cfg = buildStageConfig("1-10", BASIC);
        const s = createSim(cfg, 1);
        for (let i = 0; i < 3000; i++) step(s);
        expect(s.mana).toBeLessThanOrEqual(cfg.manaMax);
    });
});

/* ══════════════════════════════════════════════════════════════
 * 자원 누수 — 풀이 새면 장시간 플레이가 무너진다
 * ══════════════════════════════════════════════════════════════ */
describe("엔티티 풀", () => {
    it("전투 종료 후 활성 엔티티와 풀 잔량이 정합한다", () => {
        const s = run("1-5", 3);
        expect(s.actives.length).toBe(s.entityPool.length - s.entityFree);
        expect(s.projectiles.length).toBe(s.projPool.length - s.projFree);
    });

    it("연속 10전투에서 풀이 누수되지 않는다", () => {
        const cfg = buildStageConfig("1-2", BASIC);
        for (let i = 0; i < 10; i++) {
            const s = createSim(cfg, i);
            runToCompletion(s, (st) => autoPlayTick(st));
            expect(s.entityFree).toBeGreaterThanOrEqual(0);
            expect(s.entityFree).toBeLessThanOrEqual(s.entityPool.length);
        }
    });
});

/**
 * 떼 소환(`units.json:squad`) — **탭 한 번 = 소환 한 번** (2026-08-05, 사용자 제보)
 *
 * ★★ 제보: "꼬꼬댁 닭이 처음에 3마리, 두 번째에 2마리, 그 다음부터 1마리씩 나온다."
 *   원인은 호출부가 `squad` 만큼 `trySummon` 을 **반복**한 것이었다. 마나가
 *   마릿수만큼 나가면서 코스트 상승(1.18배)도 마릿수만큼 일어나, 두 번째 탭에는
 *   두 마리분 마나만 남았다. 설계가 아니라 부작용이었다.
 *
 * ★ 이 블록이 지키는 규약:
 *     ① 한 번 부르면 `squad` 마릿수가 **전부** 나온다 (부분 소환 없음)
 *     ② 마나는 `지금 코스트 × 마릿수` 만큼 **한 번** 나간다
 *     ③ 코스트 상승은 **한 단**만 오른다
 */
describe("떼 소환 (squad)", () => {
    const CHICKEN = "clucking_chicken";

    /** 마나를 넉넉히 채운 시뮬 */
    const richSim = () => {
        const cfg = buildStageConfig("1-5", [{ id: CHICKEN, level: 1 }]);
        const s = createSim(cfg, 3);
        s.mana = 9999;
        return s;
    };

    const chickenDef = (s) => s.cfg.loadout.find((d) => d.id === CHICKEN);
    const allyCount = (s) => s.lanes.reduce((n, l) => n + l.allies.filter((a) => a.hp > 0).length, 0);

    it("데이터가 떼 유닛을 실제로 갖고 있다 (없으면 이 블록은 아무것도 검사하지 않는다)", () => {
        const s = richSim();
        expect(chickenDef(s)?.squad).toBeGreaterThan(1);
    });

    it("★ 한 번 소환하면 마릿수가 전부 나온다", () => {
        const s = richSim();
        const def = chickenDef(s);
        expect(trySummon(s, def, 0)).toBe(true);
        expect(allyCount(s)).toBe(def.squad);
    });

    it("★ 마나는 (코스트 × 마릿수) 만큼 **한 번에** 나간다", () => {
        const s = richSim();
        const def = chickenDef(s);
        const before = s.mana;
        const unit = summonCost(s, def.id, def.cost);

        trySummon(s, def, 0);
        expect(before - s.mana, "치른 마나").toBe(unit * def.squad);
    });

    /**
     * ★★ 코스트 상승은 **마릿수만큼** 오른다 (2026-08-05 재조정).
     *
     *   처음에는 "탭 한 번 = 한 단"으로 만들었는데, 하드 게이트 B6
     *   (단일 유닛 스팸 ≤ 다양화 편성)가 3-5 에서 무너졌다 —
     *   하네스의 `spam_cheapest` 가 쓰는 최저가 딜러가 바로 이 떼 유닛이라,
     *   마릿수당 억제가 1/3 로 옅어진 것이 그대로 게이트에 나타났다.
     *
     *   사용자가 본 사고(3 → 2 → 1 마리)는 **탭 안에서** 코스트가 오르며 마나가
     *   말라붙어 생긴 것이고, 그것은 총액을 한 번에 받는 것으로 이미 사라졌다.
     *   여기서 오르는 것은 **다음 탭의** 가격이다.
     */
    it("★ 코스트 상승은 마릿수만큼 오른다 (스팸 억제가 옅어지지 않는다)", () => {
        const s = richSim();
        const def = chickenDef(s);
        const unit = summonCost(s, def.id, def.cost);
        const growth = s.cfg.summonCostGrowth;

        trySummon(s, def, 0);

        expect(s.summonCounts[def.id], "카운트").toBe(def.squad);
        expect(summonCost(s, def.id, def.cost)).toBe(
            Math.max(1, Math.ceil(def.cost * Math.pow(growth, def.squad)))
        );
        // 단일 유닛과 비교 — 같은 몸 수를 세울 때 가격이 같은 계단을 밟는다
        expect(summonCost(s, def.id, def.cost)).toBeGreaterThan(Math.ceil(unit * growth));
    });

    it("★★ 두 번째 · 세 번째 소환도 같은 마릿수가 나온다 (3 → 2 → 1 이 아니다)", () => {
        const s = richSim();
        const def = chickenDef(s);
        for (let i = 0; i < 3; i++) {
            const before = allyCount(s);
            expect(trySummon(s, def, 0), `${i + 1}번째 소환`).toBe(true);
            expect(allyCount(s) - before, `${i + 1}번째 소환의 마릿수`).toBe(def.squad);
        }
    });

    it("★ 마릿수분 마나가 없으면 한 마리도 나오지 않는다 (부분 소환 없음)", () => {
        const s = richSim();
        const def = chickenDef(s);
        // 두 마리분만 있는 상태
        s.mana = summonCost(s, def.id, def.cost) * (def.squad - 1);
        expect(trySummon(s, def, 0)).toBe(false);
        expect(allyCount(s)).toBe(0);
    });
});

/**
 * 엔티티 풀 고갈 — **적이 소리 없이 사라지지 않는가** (2026-08-05)
 *
 * ★★ `acquireEntity` 는 풀이 비면 `null` 을 돌려주고 스폰이 실패한다. 그 실패는
 *   크래시가 아니라 **침묵**이다: 가장 무거운 판에서 적이 덜 나오고, 그 판이
 *   쉬워지고, 아무 검사도 실패하지 않는다. 밸런스 하네스는 그 쉬워진 판을 재서
 *   "통과"라고 보고한다.
 *
 * ★ 나이트메어 설계(`docs/02-design/22-nightmare.md` P11-03)가 이 위험을 계산으로
 *   먼저 발견했다 — 1-9 는 노멀에서 이미 동시 152~165체이고 풀은 256 이다.
 *   난이도 배율(`spawnCountMult` · `enemyHpMult` 로 늘어나는 체류 시간)이 얹히면
 *   상한에 닿는다. **켜기 전에 재는 것**이 이 테스트의 목적이다.
 */
describe("엔티티 풀 — 스폰이 조용히 사라지지 않는다", () => {
    /** 부하가 가장 큰 스테이지들 — 전수는 느리므로 대표를 고른다 */
    const HEAVY = ["1-9", "1-12", "1-16", "2-9", "3-9", "4-9", "5-19", "5-20"];

    /**
     * ★★★ **나이트메어에서도 0 이어야 한다** (2026-08-05, P11-03).
     *
     *   설계 문서는 선형 추정 215체 · 보수 추정 240–260체로 풀(당시 256)에 닿는다고
     *   봤다. 실측(100 스테이지 × 2 시드 · 죽이지 못하는 편성으로 스폰 압력 상한)은
     *   **노멀 163 · 하드 180 · 나이트메어 197** 이었고, 그 위에 여유를 두어 풀을
     *   288 로 올렸다. 그 판단이 계속 유효한지를 여기서 지킨다.
     *
     * ★ **켜기 전에 재는 것**이 이 블록의 목적이다. 고갈은 크래시가 아니라 침묵이라,
     *   나중에 재면 "왜 이 판만 쉽지?" 를 아무도 규명하지 못한다.
     */
    /**
     * 나이트메어는 규칙 3종을 전부 지나가도록 월드를 섞는다.
     * ★ 전수는 느리다 — 대표를 고른다 (위 `HEAVY` 와 같은 규약). 전수 실측은
     *   `bench:sim` 과 `balance:nightmare` 가 한다.
     */
    const HEAVY_NIGHTMARE = ["1-9", "2-9", "3-19", "4-19", "5-20"];

    it.each(HEAVY_NIGHTMARE)("%s 나이트메어 — 태어나지 못한 개체가 0 이다", (stageId) => {
        const loadout = [
            { id: "slow_turtle", level: 20 },
            { id: "bold_man_at_arms", level: 20 },
            { id: "determined_soldier", level: 20 },
            { id: "elf_sharpshooter", level: 20 },
            { id: "novice_pyromancer", level: 20 },
            { id: "jovial_friar", level: 20 },
        ];
        const cfg = buildStageConfig(stageId, loadout, { difficulty: "nightmare" });
        for (let seed = 0; seed < 3; seed++) {
            const s = createSim(cfg, seed);
            let p = 0;
            runToCompletion(
                s,
                (st) => autoPlayTick(st),
                400,
                (st) => (seed + p++) % st.pendingDraft.options.length
            );
            expect(
                s.stats.spawnDropped,
                `나이트메어 ${stageId} 시드 ${seed}: 엔티티 풀이 고갈되어 ` +
                    `${s.stats.spawnDropped}체가 태어나지 못했다 — 그만큼 이 판은 조용히 쉬워진다`
            ).toBe(0);
            expect(
                s.stats.projectileDropped,
                `나이트메어 ${stageId} 시드 ${seed}: 발사체 ${s.stats.projectileDropped}발이 사라졌다`
            ).toBe(0);
        }
    });

    it.each(HEAVY)("%s 노멀 — 태어나지 못한 개체가 0 이다", (stageId) => {
        const loadout = [
            { id: "slow_turtle", level: 20 },
            { id: "bold_man_at_arms", level: 20 },
            { id: "determined_soldier", level: 20 },
            { id: "elf_sharpshooter", level: 20 },
            { id: "novice_pyromancer", level: 20 },
            { id: "jovial_friar", level: 20 },
        ];
        const cfg = buildStageConfig(stageId, loadout);
        for (let seed = 0; seed < 3; seed++) {
            const s = createSim(cfg, seed);
            let p = 0;
            runToCompletion(
                s,
                (st) => autoPlayTick(st),
                400,
                (st) => (seed + p++) % st.pendingDraft.options.length
            );
            expect(
                s.stats.spawnDropped,
                `${stageId} 시드 ${seed}: 엔티티 풀이 고갈되어 ${s.stats.spawnDropped}체가 태어나지 못했다 — ` +
                    `그만큼 이 판은 조용히 쉬워진다`
            ).toBe(0);
        }
    });

    it("★ 검사가 실제로 발동한다 — 풀을 좁히면 잡힌다", () => {
        const cfg = buildStageConfig("1-9", [{ id: "slow_turtle", level: 1 }]);
        const s = createSim(cfg, 0);
        // 풀을 인위적으로 비운다 (실제 고갈과 같은 상태)
        s.entityFree = 0;
        let p = 0;
        runToCompletion(
            s,
            (st) => autoPlayTick(st),
            400,
            (st) => p++ % st.pendingDraft.options.length
        );
        expect(s.stats.spawnDropped).toBeGreaterThan(0);
    });

    /**
     * ★★★ **발사체 풀에도 같은 침묵이 있다** (2026-08-05).
     *
     *   `acquireProjectile` 도 풀이 비면 `null` 을 돌려주고 `spawnProjectile` 이
     *   그냥 돌아간다. 다만 이쪽이 더 나쁘다 — 발사체는 **자기 스탯으로** 때리므로
     *   (`projectiles.js`) 태어나지 못한 탄은 연출이 아니라 **그 한 방**이 사라진다.
     *
     *   적 11종에 발사체 역할이 생기면서(2026-08-05) 이 풀을 쓰는 쪽이 아군에서
     *   양 진영으로 늘었다. 그래서 그 전에는 없던 위험이 생겼고, 여기서 잰다.
     *   ★ 원거리 적이 실제로 나오는 스테이지를 함께 넣는다 — 월드 1 만 재면
     *     적은 한 발도 쏘지 않아 이 검사가 **항상 통과한다.**
     */
    const RANGED_HEAVY = [...HEAVY, "2-2", "2-7", "4-3", "4-5", "5-5", "5-14"];

    it.each(RANGED_HEAVY)("%s — 태어나지 못한 발사체가 0 이다", (stageId) => {
        const loadout = [
            { id: "slow_turtle", level: 20 },
            { id: "bold_man_at_arms", level: 20 },
            { id: "determined_soldier", level: 20 },
            { id: "elf_sharpshooter", level: 20 },
            { id: "novice_pyromancer", level: 20 },
            { id: "jovial_friar", level: 20 },
        ];
        const cfg = buildStageConfig(stageId, loadout);
        for (let seed = 0; seed < 3; seed++) {
            const s = createSim(cfg, seed);
            let p = 0;
            runToCompletion(
                s,
                (st) => autoPlayTick(st),
                400,
                (st) => (seed + p++) % st.pendingDraft.options.length
            );
            expect(
                s.stats.projectileDropped,
                `${stageId} 시드 ${seed}: 발사체 풀이 고갈되어 ${s.stats.projectileDropped}발이 ` +
                    `발사되지 못했다 — 그만큼의 피해가 조용히 사라진다`
            ).toBe(0);
        }
    });

    it("★ 발사체 검사도 실제로 발동한다 — 풀을 비우면 잡힌다", () => {
        const cfg = buildStageConfig("2-2", [{ id: "elf_sharpshooter", level: 20 }]);
        const s = createSim(cfg, 0);
        s.projFree = 0;
        let p = 0;
        runToCompletion(
            s,
            (st) => autoPlayTick(st),
            400,
            (st) => p++ % st.pendingDraft.options.length
        );
        expect(s.stats.projectileDropped).toBeGreaterThan(0);
    });
});
