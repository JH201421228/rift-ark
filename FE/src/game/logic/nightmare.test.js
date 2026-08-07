/**
 * 나이트메어 규칙 (P11) — **규칙이 실제로 규칙인가**
 *
 * ★★ 여기서 재는 것은 "어려운가"가 아니라 세 가지다:
 *   ① 결정론 — 난수가 하나도 없다 (절대규칙 6 · 게이트 BN1)
 *   ② 상한   — 장판이 슬롯 상한을 넘지 않고, 틱마다 힙을 만들지 않는다
 *   ③ 대상   — 아군과 지휘관만 밟는다. 적에게도 주면 "가만히 두는 것"이 답이 된다
 *
 * @see docs/02-design/22-nightmare.md
 */
import { describe, it, expect } from "vitest";
import { createSim, runToCompletion, step } from "./sim.js";
import { buildStageConfig } from "./stageConfig.js";
import { autoPlayTick } from "./autoPlay.js";
import { AIR_LANE, LANE_COUNT } from "./state.js";
import {
    NIGHTMARE_IDS,
    PLAGUE_SLOTS_PER_LANE,
    activePlagueCount,
    nightmareBrief,
    nightmareFor,
    noteNightmareDeath,
    stepNightmare,
} from "./nightmare.js";
import { EV } from "./events.js";
import balance from "../data/balance.json" with { type: "json" };
import { LANGS, setLang, DEFAULT_LANG } from "../../i18n/index.js";

const P = balance.difficulty.levels.nightmare.mechanics.plague_bloom;

const SIX = [
    "slow_turtle",
    "bold_man_at_arms",
    "determined_soldier",
    "elf_sharpshooter",
    "novice_pyromancer",
    "jovial_friar",
].map((id) => ({ id, level: 20 }));

const sim = (stageId, difficulty = "nightmare", seed = 1) =>
    createSim(buildStageConfig(stageId, SIX, { difficulty }), seed);

/** 장판 판정에 필요한 최소 필드만 가진 아군 */
function putAlly(s, lane, x, hp = 1000) {
    const a = { id: 9000 + s.lanes[lane].allies.length, isAlly: true, lane, x, hp, hpMax: hp };
    s.lanes[lane].allies.push(a);
    return a;
}
function putEnemy(s, lane, x, hp = 1000) {
    const e = { id: 8000 + s.lanes[lane].enemies.length, isAlly: false, lane, x, hp, hpMax: hp };
    s.lanes[lane].enemies.push(e);
    return e;
}

/* ══════════════════════════════════════════════════════════════
 * 조회 — 배정은 규칙 모듈 하나가 안다
 * ══════════════════════════════════════════════════════════════ */
describe("nightmareFor — 월드 배정", () => {
    it.each([
        [1, "plague_bloom"],
        [2, "bond_break"],
        [3, "plague_bloom"],
        [4, "bond_break"],
        [5, "attrition"],
    ])("월드 %i → %s", (world, id) => {
        expect(nightmareFor(world).id).toBe(id);
    });

    it("규칙이 없는 월드는 null 이다 (없는 규칙을 지어내지 않는다)", () => {
        expect(nightmareFor(6)).toBeNull();
        expect(nightmareFor(0)).toBeNull();
    });

    it("★ 월드 하나에 규칙 하나뿐이다 — 누적하지 않는다", () => {
        for (let w = 1; w <= 5; w++) {
            const hits = NIGHTMARE_IDS.filter((id) =>
                balance.difficulty.levels.nightmare.mechanics[id].worlds.includes(w)
            );
            expect(hits, `월드 ${w}`).toHaveLength(1);
        }
    });

    it("★ `$` 주석 키를 설정에 싣지 않는다", () => {
        for (const k of Object.keys(nightmareFor(1))) expect(k.startsWith("$")).toBe(false);
    });

    /**
     * ★★ 요약은 **두 언어 모두** 데이터에서 와야 한다. 한쪽만 검사하면 영어가 비어도
     *   통과하고, 그러면 나이트메어에 들어가는 영어권 플레이어는 규칙을 **진입 전에
     *   읽을 수 없다** — 그 순간 나이트메어는 전략이 아니라 좌절이다.
     * ★ 반환 키에 `Ko` 접미사가 없다 (2026-08-07). 값이 한국어라는 보장이 없으므로
     *   그 이름은 거짓말이었다.
     */
    it.each(LANGS)("[%s] 프리뷰가 쓸 요약은 데이터에서 온다 (문장을 코드가 만들지 않는다)", (lang) => {
        setLang(lang);
        try {
            const src = balance.difficulty.levels.nightmare.mechanics.bond_break;
            const b = nightmareBrief(2);
            expect(b.name).toBe(src.name[lang]);
            expect(b.summary).toBe(src.summary[lang]);
            expect(b.name).toBeTruthy();
            expect(b.summary).toBeTruthy();
            expect(nightmareBrief(6)).toBeNull();
        } finally {
            setLang(DEFAULT_LANG);
        }
    });
});

/* ══════════════════════════════════════════════════════════════
 * 설정 — 전투 코드에 난이도 분기가 없다
 * ══════════════════════════════════════════════════════════════ */
describe("stageConfig — 규칙은 설정에서 한 번만 정해진다", () => {
    it("노멀·하드에는 규칙이 걸리지 않는다", () => {
        for (const d of ["normal", "hard"]) {
            for (const st of ["1-9", "2-9", "5-9"]) {
                expect(buildStageConfig(st, SIX, { difficulty: d }).nightmare, `${d} ${st}`).toBeNull();
            }
        }
    });

    it("나이트메어는 월드마다 다른 규칙을 받는다", () => {
        expect(buildStageConfig("1-9", SIX, { difficulty: "nightmare" }).nightmare.id).toBe(
            "plague_bloom"
        );
        expect(buildStageConfig("4-9", SIX, { difficulty: "nightmare" }).nightmare.id).toBe(
            "bond_break"
        );
        expect(buildStageConfig("5-9", SIX, { difficulty: "nightmare" }).nightmare.id).toBe(
            "attrition"
        );
    });
});

/* ══════════════════════════════════════════════════════════════
 * ③ 고갈 — 이미 있는 두 손잡이를 0 으로 돌린다
 * ══════════════════════════════════════════════════════════════ */
const A = balance.difficulty.levels.nightmare.mechanics.attrition;

describe("③ 고갈 — 환급 0 · 감쇠 둔화", () => {
    it("월드 5 나이트메어는 두 손잡이가 배율만큼 돌아간다", () => {
        const cfg = buildStageConfig("5-9", SIX, { difficulty: "nightmare" });
        expect(cfg.killRefundRatio).toBe(balance.resources.killRefundRatio * A.killRefundMult);
        /**
         * ★★ **배율은 감쇠 *속도*다.** 0.5 면 원복이 두 배 느려진다.
         *   불리언처럼 다루면 데이터에 0.5 를 적어도 아무 일이 일어나지 않는다 —
         *   이 저장소가 반복해서 겪은 "적혀 있는데 안 읽히는 값"이 그 자리에서 다시 생긴다.
         */
        if (A.summonDecayMult === 0) {
            expect(cfg.summonDecayEnabled).toBe(false);
            expect(cfg.summonDecayMs).toBe(balance.resources.summonDecayMs);
        } else {
            expect(cfg.summonDecayEnabled).toBe(true);
            expect(cfg.summonDecayMs).toBe(
                Math.round(balance.resources.summonDecayMs / A.summonDecayMult)
            );
        }
    });

    it("★ 노멀·하드의 값이 한 자리도 바뀌지 않는다", () => {
        const r = balance.resources;
        for (const d of ["normal", "hard"]) {
            for (const st of ["1-9", "5-9"]) {
                const cfg = buildStageConfig(st, SIX, { difficulty: d });
                expect(cfg.killRefundRatio, `${d} ${st}`).toBe(r.killRefundRatio);
                expect(cfg.summonDecayEnabled, `${d} ${st}`).toBe(true);
                expect(cfg.summonDecayMs, `${d} ${st}`).toBe(r.summonDecayMs);
            }
        }
    });

    /** 30초 동안 카운트가 얼마나 내려오는가 */
    function decayed(difficulty) {
        const s = sim("5-9", difficulty);
        s.summonCounts.slow_turtle = 4;
        s.summonDecayAt.slow_turtle = 0; // 이미 만료 시각을 지난 상태
        for (let i = 0; i < 30 * 30; i++) step(s); // 30초
        return 4 - s.summonCounts.slow_turtle;
    }

    it("★★ 고갈이 걸리면 코스트 원복이 **느려진다**", () => {
        expect(decayed("nightmare")).toBeLessThan(decayed("normal"));
    });

    it("노멀에서는 그대로 내려온다 (검사가 실제로 발동한다)", () => {
        expect(decayed("normal")).toBeGreaterThan(0);
    });

    it("감쇠 배율이 0 이면 아예 멈춘다 (설정 플래그로 표현한다)", () => {
        const cfg = buildStageConfig("5-9", SIX, { difficulty: "nightmare" });
        const s = createSim({ ...cfg, summonDecayEnabled: false }, 1);
        s.summonCounts.slow_turtle = 3;
        s.summonDecayAt.slow_turtle = 0;
        for (let i = 0; i < 30 * 30; i++) step(s);
        expect(s.summonCounts.slow_turtle).toBe(3);
    });

    it("`summonDecayMs` 를 Infinity 로 표현하지 않는다 (화면이 초로 환산한다)", () => {
        const cfg = buildStageConfig("5-9", SIX, { difficulty: "nightmare" });
        expect(Number.isFinite(cfg.summonDecayMs)).toBe(true);
    });
});

/* ══════════════════════════════════════════════════════════════
 * ① 역병 장판
 * ══════════════════════════════════════════════════════════════ */
describe("① 역병 장판 — 슬롯", () => {
    it("존 구조체는 난이도와 무관하게 **항상** 있다 (히든 클래스)", () => {
        for (const d of ["normal", "hard", "nightmare"]) {
            const s = sim("1-9", d);
            expect(s.nightmare.slots).toHaveLength(LANE_COUNT * PLAGUE_SLOTS_PER_LANE);
        }
    });

    it("노멀에서는 적이 죽어도 장판이 생기지 않는다", () => {
        const s = sim("1-9", "normal");
        noteNightmareDeath(s, { isAlly: false, x: 400 }, 0);
        expect(activePlagueCount(s)).toBe(0);
    });

    it("공중에서 죽은 적은 장판을 남기지 않는다 (땅에 닿지 않는다)", () => {
        const s = sim("1-9");
        noteNightmareDeath(s, { isAlly: false, x: 400 }, AIR_LANE);
        expect(activePlagueCount(s)).toBe(0);
    });

    it("아군이 죽어도 장판을 남기지 않는다", () => {
        const s = sim("1-9");
        noteNightmareDeath(s, { isAlly: true, x: 400 }, 0);
        expect(activePlagueCount(s)).toBe(0);
    });

    it("★ 레인당 슬롯 상한을 넘지 않는다 — 넘치면 가장 먼저 만료될 슬롯을 대체한다", () => {
        const s = sim("1-9");
        // mergeGap 보다 충분히 떨어뜨려 병합되지 않게 한다
        for (let i = 0; i < PLAGUE_SLOTS_PER_LANE * 4; i++) {
            s.t += 100;
            noteNightmareDeath(s, { isAlly: false, x: 200 + i * (P.mergeGap * 3) }, 1);
        }
        const inLane = s.nightmare.slots
            .slice(1 * PLAGUE_SLOTS_PER_LANE, 2 * PLAGUE_SLOTS_PER_LANE)
            .filter((z) => z.active);
        expect(inLane).toHaveLength(PLAGUE_SLOTS_PER_LANE);
        expect(activePlagueCount(s)).toBe(PLAGUE_SLOTS_PER_LANE);
    });

    it("★★ 병합해도 **중심을 옮기지 않는다** (장판이 아군 쪽으로 기어오면 안 된다)", () => {
        const s = sim("1-9");
        noteNightmareDeath(s, { isAlly: false, x: 600 }, 0);
        const z = s.nightmare.slots.find((v) => v.active);
        const until0 = z.until;

        // 전선은 언제나 방주(왼쪽) 쪽으로 밀린다 — 병합을 여러 번 반복해도
        s.t += 500;
        noteNightmareDeath(s, { isAlly: false, x: 600 - P.mergeGap + 1 }, 0);
        s.t += 500;
        noteNightmareDeath(s, { isAlly: false, x: 600 - P.mergeGap + 2 }, 0);

        expect(activePlagueCount(s), "병합이 아니라 새 슬롯이 생겼다").toBe(1);
        expect(z.x, "중심이 아군 쪽으로 기어왔다").toBe(600);
        expect(z.until, "만료 시각은 연장돼야 한다").toBeGreaterThan(until0);
    });

    it("mergeGap 밖의 죽음은 새 슬롯을 만든다", () => {
        const s = sim("1-9");
        noteNightmareDeath(s, { isAlly: false, x: 600 }, 0);
        noteNightmareDeath(s, { isAlly: false, x: 600 - P.mergeGap - 1 }, 0);
        expect(activePlagueCount(s)).toBe(2);
    });

    it("만료되면 슬롯이 꺼진다", () => {
        const s = sim("1-9");
        noteNightmareDeath(s, { isAlly: false, x: 600 }, 0);
        expect(activePlagueCount(s)).toBe(1);
        s.t += P.durationMs;
        stepNightmare(s);
        expect(activePlagueCount(s)).toBe(0);
    });
});

describe("① 역병 장판 — 피해", () => {
    /** 장판 하나를 깔고 정확히 한 번의 피해 틱을 돌린다 */
    function oneDamageTick(s) {
        s.nightmare.nextDamageAt = s.t;
        stepNightmare(s);
    }

    it("★★ 장판 위의 아군만 깎인다 — 적은 영향을 받지 않는다", () => {
        const s = sim("1-9");
        const inside = putAlly(s, 0, 600);
        const outside = putAlly(s, 0, 600 + P.radius + 10);
        const enemy = putEnemy(s, 0, 600);
        noteNightmareDeath(s, { isAlly: false, x: 600 }, 0);
        oneDamageTick(s);

        expect(inside.hp).toBeLessThan(inside.hpMax);
        expect(outside.hp).toBe(outside.hpMax);
        expect(enemy.hp, "적이 장판에 깎였다 — 그러면 가만히 두는 것이 답이 된다").toBe(
            enemy.hpMax
        );
    });

    it("피해량은 대상 최대 HP 비율이다 (DEF·RES 와 무관)", () => {
        const s = sim("1-9");
        const a = putAlly(s, 0, 600, 1000);
        // 방어·결계·보호막이 아무리 높아도 같은 값이 깎인다
        a.def = 9999;
        a.res = 99;
        a.shield = 5;
        noteNightmareDeath(s, { isAlly: false, x: 600 }, 0);
        oneDamageTick(s);
        const expected = 1000 * P.dpsPctOfMaxHp * (P.tickMs / 1000);
        expect(a.hpMax - a.hp).toBeCloseTo(expected, 6);
        expect(a.shield, "결계·보호막 횟수를 소모하지 않는다").toBe(5);
    });

    it("★ 지휘관도 서 있는 것만으로 깎인다 (같은 레인 · 반경 안)", () => {
        const s = sim("1-9");
        const c = s.commander;
        c.lane = 2;
        c.x = 600;
        noteNightmareDeath(s, { isAlly: false, x: 600 }, 2);
        oneDamageTick(s);
        expect(c.hp).toBeLessThan(c.hpMax);
    });

    it("다른 레인의 장판은 지휘관을 깎지 않는다", () => {
        const s = sim("1-9");
        const c = s.commander;
        c.lane = 2;
        c.x = 600;
        noteNightmareDeath(s, { isAlly: false, x: 600 }, 0);
        oneDamageTick(s);
        expect(c.hp).toBe(c.hpMax);
    });

    it("★★ 피해에 DAMAGE 이벤트를 내지 않는다 (틱당 이벤트 예산 §6.3)", () => {
        const s = sim("1-9");
        for (let i = 0; i < 6; i++) putAlly(s, 0, 580 + i * 5);
        noteNightmareDeath(s, { isAlly: false, x: 600 }, 0);
        s.events.length = 0;
        oneDamageTick(s);
        for (let i = 0; i < s.events.length; i++) {
            expect(s.events.pool[i].type).not.toBe(EV.DAMAGE);
        }
    });

    it("슬롯 상태 변화만 이벤트를 낸다 (생성 1 · 갱신 0 · 만료 1)", () => {
        const s = sim("1-9");
        const types = () => {
            const out = [];
            for (let i = 0; i < s.events.length; i++) out.push(s.events.pool[i].type);
            return out;
        };
        s.events.length = 0;
        noteNightmareDeath(s, { isAlly: false, x: 600 }, 0);
        expect(types()).toEqual([EV.NIGHTMARE_ZONE]);

        s.events.length = 0;
        s.t += 100;
        noteNightmareDeath(s, { isAlly: false, x: 601 }, 0); // 병합 = 갱신
        expect(types()).toEqual([]);

        s.events.length = 0;
        s.t += P.durationMs;
        stepNightmare(s);
        expect(types()).toEqual([EV.NIGHTMARE_ZONE]);
    });
});

/* ══════════════════════════════════════════════════════════════
 * 결정론 · 할당
 * ══════════════════════════════════════════════════════════════ */
describe("결정론 · 힙 할당", () => {
    const run = (stageId, seed) => {
        const s = createSim(buildStageConfig(stageId, SIX, { difficulty: "nightmare" }), seed);
        let p = 0;
        runToCompletion(
            s,
            (x) => autoPlayTick(x),
            400,
            (x) => (seed + p++) % x.pendingDraft.options.length
        );
        return {
            phase: s.phase,
            t: s.t,
            arkHp: s.arkHp,
            kills: s.stats.kills,
            breaches: s.stats.breaches,
            damage: Math.round(s.stats.damageDealt),
        };
    };

    it.each(["1-9", "2-9", "3-9", "4-9", "5-9"])(
        "★★ %s — 같은 시드 두 번이 완전히 같다 (BN1)",
        (stageId) => {
            for (const seed of [1, 7]) {
                expect(run(stageId, seed)).toEqual(run(stageId, seed));
            }
        }
    );

    it("★ 슬롯 객체는 재사용된다 — 틱마다 새로 만들지 않는다", () => {
        const s = sim("1-9");
        const slots = s.nightmare.slots;
        const ids = slots.slice();
        let p = 0;
        runToCompletion(
            s,
            (x) => autoPlayTick(x),
            400,
            (x) => p++ % x.pendingDraft.options.length
        );
        expect(s.nightmare.slots).toBe(slots);
        for (let i = 0; i < slots.length; i++) expect(slots[i]).toBe(ids[i]);
    });

    it("★ 전투를 끝까지 돌려도 활성 장판이 상한을 넘지 않는다", () => {
        for (const stageId of ["1-9", "1-20", "3-19"]) {
            const s = sim(stageId);
            let max = 0;
            let p = 0;
            runToCompletion(
                s,
                (x) => {
                    autoPlayTick(x);
                    const n = activePlagueCount(x);
                    if (n > max) max = n;
                },
                400,
                (x) => p++ % x.pendingDraft.options.length
            );
            expect(max, stageId).toBeLessThanOrEqual(LANE_COUNT * PLAGUE_SLOTS_PER_LANE);
        }
    });
});
