/**
 * 방벽(BLOCKER) 블로킹 — **붙든 적을 놓지 않는가** (2026-08-04)
 *
 * ★★★ 이 파일이 지키는 사고는 실제 제보에서 왔다: "방벽 캐릭터를 **간헐적으로**
 *   넘어가는 적군이 있어."
 *
 *   원인은 `stepBlocking` 이 매 틱 `blockedBy` 를 전부 지우고 **가까운 순으로 다시**
 *   배정한 것이었다. 용량 2 · 적 4 이면 붙잡히는 둘이 매 틱 교대하고, 풀려난 둘은
 *   그 틱에 전진한다. 결과적으로 **넷 전부가 절반 속도로 계속 다가와** 무리가
 *   `blockMinGap` 바로 위에 뭉치고, 그 뒤로는 붙잡혀 있던 적이 밀려나 통과한다.
 *
 * ★ 여기서 재는 것은 "방벽이 센가"가 아니라 **규칙이 지켜지는가**다:
 *   ① 용량 안의 적은 **정지한다** (11-core-loop.md §3.3)
 *   ② 용량을 넘긴 만큼만 지나간다 (의도된 설계)
 *   ③ 슬롯이 비어 있는데 통과하는 일은 없다
 *   ④ 비행은 여전히 막히지 않는다
 */
import { describe, it, expect } from "vitest";
import { createSim, step } from "./sim.js";
import { buildStageConfig } from "./stageConfig.js";
import { stepBlocking } from "./movement.js";
import { TAG } from "./tags.js";
import { AIR_LANE } from "./state.js";
import { TICK_MS } from "./tick.js";
import { EV } from "./events.js";
import balance from "../data/balance.json" with { type: "json" };

const L = (id, level) => ({ id, level, rank: 1 });
const SIX = [
    L("slow_turtle", 20),
    L("bold_man_at_arms", 20),
    L("determined_soldier", 20),
    L("elf_sharpshooter", 20),
    L("novice_pyromancer", 20),
    L("jovial_friar", 20),
];

function sim(stageId = "1-4", seed = 1, difficulty = "normal") {
    return createSim(buildStageConfig(stageId, SIX, { meta: {}, difficulty }), seed);
}

/** 레인에 블로커 하나를 세운다 */
function putBlocker(s, lane, x, cap = 2, range = 40) {
    const b = {
        id: 10000 + lane,
        isAlly: true,
        role: "BLOCKER",
        lane,
        x,
        hp: 99999,
        hpMax: 99999,
        atk: 0,
        def: 0,
        res: 0,
        range,
        blockCount: cap,
        blocking: 0,
        inAura: false,
        tags: 0,
        dmgType: "physical",
    };
    s.lanes[lane].allies.push(b);
    s.actives.push(b);
    return b;
}

/** 레인에 적 하나를 세운다 (x 오름차순으로 넣을 것) */
function putEnemy(s, lane, x, tags = 0) {
    const e = {
        id: 20000 + s.lanes[lane].enemies.length + lane * 100,
        isAlly: false,
        lane,
        x,
        hp: 99999,
        hpMax: 99999,
        atk: 0,
        def: 0,
        res: 0,
        speed: 38,
        range: 20,
        blockedBy: -1,
        // ★ 나이트메어 ② 가 읽는 두 필드. 실제 엔티티는 `acquireEntity` 가 초기화한다 —
        //   여기서 빠뜨리면 `blockedMs` 가 NaN 이 되어 파열이 영원히 안 온다.
        blockedMs: 0,
        unbindable: false,
        tags,
        dmgType: "physical",
    };
    s.lanes[lane].enemies.push(e);
    s.actives.push(e);
    return e;
}

describe("방벽 블로킹 — 붙든 적을 놓지 않는다", () => {
    it("★★★ 용량을 넘겨도 붙잡힌 적은 **교대하지 않는다** (이것이 통과의 원인이었다)", () => {
        const s = sim();
        const b = putBlocker(s, 0, 300, 2, 40);
        // 용량 2 에 적 4 — 예전에는 매 틱 붙잡히는 둘이 바뀌었다
        const es = [
            putEnemy(s, 0, 330),
            putEnemy(s, 0, 331),
            putEnemy(s, 0, 332),
            putEnemy(s, 0, 333),
        ];

        stepBlocking(s);
        const firstHeld = es.filter((e) => e.blockedBy === b.id).map((e) => e.id);
        expect(firstHeld).toHaveLength(2);

        // 여러 틱을 돌려도 **같은 둘**이 계속 붙잡혀 있어야 한다
        for (let i = 0; i < 30; i++) {
            stepBlocking(s);
            const held = es.filter((e) => e.blockedBy === b.id).map((e) => e.id);
            expect(held, `틱 ${i}: 붙잡힌 적이 바뀌었다 — 교대가 다시 생겼다`).toEqual(firstHeld);
        }
    });

    it("★★ 붙잡힌 적은 실제로 **정지한다** (전체 시뮬 기준)", () => {
        const s = sim();
        const blocker = putBlocker(s, 0, 300, 2, 40);
        const es = [
            putEnemy(s, 0, 330),
            putEnemy(s, 0, 331),
            putEnemy(s, 0, 332),
            putEnemy(s, 0, 333),
        ];
        stepBlocking(s);
        const held = es.filter((e) => e.blockedBy === blocker.id);
        const startX = held.map((e) => e.x);

        for (let i = 0; i < 60; i++) step(s);

        held.forEach((e, i) => {
            expect(e.x, `붙잡힌 적이 ${startX[i] - e.x}px 전진했다`).toBeCloseTo(startX[i], 3);
        });
    });

    it("★★ 슬롯이 비어 있으면 새 적을 잡는다 — 빈 슬롯을 두고 통과시키지 않는다", () => {
        const s = sim();
        const b = putBlocker(s, 0, 300, 2, 40);
        const a = putEnemy(s, 0, 330);
        stepBlocking(s);
        expect(a.blockedBy).toBe(b.id);
        expect(b.blocking).toBe(1);

        const c = putEnemy(s, 0, 335);
        stepBlocking(s);
        expect(c.blockedBy, "빈 슬롯이 있는데 새 적을 잡지 않았다").toBe(b.id);
        expect(b.blocking).toBe(2);
    });

    it("용량을 넘긴 적은 지나간다 (의도된 설계 — 11-core-loop.md §3.3)", () => {
        const s = sim();
        putBlocker(s, 0, 300, 2, 40);
        const es = [
            putEnemy(s, 0, 330),
            putEnemy(s, 0, 331),
            putEnemy(s, 0, 332),
            putEnemy(s, 0, 333),
        ];
        stepBlocking(s);
        expect(es.filter((e) => e.blockedBy === -1)).toHaveLength(2);
    });

    it("★ 블로커가 죽으면 관계가 풀린다", () => {
        const s = sim();
        const b = putBlocker(s, 0, 300, 2, 40);
        const e = putEnemy(s, 0, 330);
        stepBlocking(s);
        expect(e.blockedBy).toBe(b.id);

        // 블로커를 레인에서 치운다 (사망 처리와 같은 결과)
        s.lanes[0].allies.length = 0;
        stepBlocking(s);
        expect(e.blockedBy).toBe(-1);
    });

    it("★ 비행은 막히지 않는다 (설계)", () => {
        const s = sim();
        putBlocker(s, 0, 300, 2, 40);
        const flyer = putEnemy(s, 0, 330, TAG.FLYING);
        stepBlocking(s);
        expect(flyer.blockedBy).toBe(-1);
    });

    it("★ 공중 레인에는 블로킹이 없다", () => {
        const s = sim();
        const e = putEnemy(s, AIR_LANE, 330);
        stepBlocking(s);
        expect(e.blockedBy).toBe(-1);
    });

    it("★ 파고든 적(minGap 안)은 새로 잡지 않는다 (설계 — 겹쳐 서기 방지)", () => {
        const s = sim();
        putBlocker(s, 0, 300, 2, 40);
        const inside = putEnemy(s, 0, 305); // gap 5 < blockMinGap 20
        stepBlocking(s);
        expect(inside.blockedBy).toBe(-1);
    });

    it("★★ 실전 주행 — 방벽이 붙든 적이 방주로 새지 않는다", () => {
        // 여러 시드로 돌려 '간헐적' 재발을 잡는다
        for (const seed of [1, 2, 3, 5, 8]) {
            const s = sim("1-4", seed);
            let violation = null;
            for (let i = 0; i < 1200 && (s.phase === "battle" || s.phase === "draft"); i++) {
                if (s.phase === "draft") break;
                step(s);
                for (let li = 0; li < 3; li++) {
                    for (const e of s.lanes[li].enemies) {
                        if (e.blockedBy === -1) continue;
                        const b = s.lanes[li].allies.find((a) => a.id === e.blockedBy);
                        // 붙잡혀 있다면 반드시 블로커 **앞**에 있어야 한다
                        if (b && e.x - b.x <= 0) violation = { seed, tick: i, gap: e.x - b.x };
                    }
                }
                if (violation) break;
            }
            expect(violation, `붙잡힌 적이 블로커를 통과했다: ${JSON.stringify(violation)}`).toBeNull();
        }
    });
});

/* ══════════════════════════════════════════════════════════════
 * 나이트메어 ② 결박 파열 (P11-04)
 * ══════════════════════════════════════════════════════════════
 *
 * ★★★ **이 규칙의 안전장치는 "재붙잡기 금지" 하나다.**
 *   파열한 적을 다시 붙잡을 수 있게 두면 위의 2026-08-04 결함이 그대로 재발한다 —
 *   매 틱 관계가 붙었다 풀렸다 하면서 무리 전체가 절반 속도로 계속 전진한다.
 *   파열은 **개체당 한 번, 되돌릴 수 없는 상태 전이**여서 진동할 상태가 없다.
 *
 * ★ 그래서 여기서 재는 것은 "파열이 일어나는가"가 아니라
 *   **"파열한 뒤에도 위의 명제들이 그대로인가"** 다.
 */
const B = balance.difficulty.levels.nightmare.mechanics.bond_break;
/** 파열까지 필요한 틱 수 */
const HOLD_TICKS = Math.ceil(B.holdMs / TICK_MS);

/** 이벤트 큐에서 특정 종류를 센다 */
function countEv(s, type) {
    let n = 0;
    for (let i = 0; i < s.events.length; i++) if (s.events.pool[i].type === type) n++;
    return n;
}

describe("나이트메어 ② 결박 파열", () => {
    it("월드 2·4 나이트메어에만 걸린다", () => {
        expect(sim("2-4", 1, "nightmare").cfg.nightmare.id).toBe("bond_break");
        expect(sim("4-4", 1, "nightmare").cfg.nightmare.id).toBe("bond_break");
        expect(sim("2-4", 1, "normal").cfg.nightmare).toBeNull();
    });

    it("★ 노멀·하드에서 `blockedMs` 는 쌓이지만 **아무 일도 하지 않는다**", () => {
        for (const d of ["normal", "hard"]) {
            const s = sim("2-4", 1, d);
            const b = putBlocker(s, 0, 300, 2, 40);
            const e = putEnemy(s, 0, 330);
            for (let i = 0; i < HOLD_TICKS * 2; i++) stepBlocking(s);
            expect(e.blockedMs, d).toBeGreaterThan(B.holdMs);
            expect(e.blockedBy, `${d}: 파열이 일어났다`).toBe(b.id);
            expect(e.unbindable, d).toBe(false);
        }
    });

    it("★★ 누적 결박 시간이 holdMs 를 넘으면 결박이 끊긴다", () => {
        const s = sim("2-4", 1, "nightmare");
        const b = putBlocker(s, 0, 300, 2, 40);
        const e = putEnemy(s, 0, 330);
        const speed0 = e.speed;

        // ★ 상한이 있는 for 로 돈다. `while (!e.unbindable)` 은 규칙이 죽는 날
        //   테스트가 **영원히 멈추는** 함정이 된다 (2026-08-05 무한 루프와 같은 모양).
        let brokeAt = -1;
        for (let i = 0; i < HOLD_TICKS * 2; i++) {
            stepBlocking(s);
            if (e.unbindable) {
                brokeAt = i + 1;
                break;
            }
            expect(e.blockedBy, `틱 ${i}: 아직 파열하면 안 된다`).toBe(b.id);
        }

        expect(brokeAt, "파열이 오지 않았다").toBeGreaterThan(0);
        /**
         * ★ 파열은 **누적값**이 holdMs 를 넘는 첫 틱에 온다. `brokeAt * TICK_MS` 와
         *   비교하지 않는 이유: `TICK_MS` 는 1000/30 이라 곱셈과 270회 덧셈의 결과가
         *   부동소수 마지막 자리에서 갈린다. 규칙이 보는 값은 누적값이므로 그것을 잰다.
         */
        expect(e.blockedMs).toBeGreaterThanOrEqual(B.holdMs);
        expect(e.blockedMs - TICK_MS).toBeLessThan(B.holdMs);
        // ★ 첫 틱은 **관계가 성립하는 틱**이라 누적이 없다 (누적은 ①에서만 오른다).
        //   그래서 파열은 `holdMs` 어치의 틱 + 성립 틱 하나 뒤다.
        expect(brokeAt, "경계가 한 틱을 넘게 어긋났다").toBeLessThanOrEqual(HOLD_TICKS + 2);
        expect(e.blockedBy).toBe(-1);
        expect(e.speed).toBeCloseTo(speed0 * B.postBreakSpeedMult, 6);
    });

    it("★★★ 파열한 적은 **어떤 블로커에게도** 다시 붙잡히지 않는다 (진동 0)", () => {
        const s = sim("2-4", 1, "nightmare");
        putBlocker(s, 0, 300, 2, 40);
        const other = putBlocker(s, 0, 320, 2, 40);
        const e = putEnemy(s, 0, 330);

        for (let i = 0; i < HOLD_TICKS + 2; i++) stepBlocking(s);
        expect(e.unbindable).toBe(true);

        // 빈 슬롯이 넘쳐도, 다른 블로커가 있어도, 아무리 오래 돌려도
        for (let i = 0; i < 600; i++) {
            stepBlocking(s);
            expect(e.blockedBy, `틱 ${i}: 파열한 적이 다시 붙잡혔다`).toBe(-1);
        }
        expect(other.blocking).toBe(0);
    });

    it("★ 예고와 파열은 개체당 정확히 한 번씩이다 (이벤트 예산 §6.3)", () => {
        const s = sim("2-4", 1, "nightmare");
        putBlocker(s, 0, 300, 2, 40);
        putEnemy(s, 0, 330);
        // 큐는 step() 이 비우므로 여기서는 쌓인 총량을 센다
        for (let i = 0; i < HOLD_TICKS * 3; i++) stepBlocking(s);
        expect(countEv(s, EV.NIGHTMARE_BOND_TELEGRAPH)).toBe(1);
        expect(countEv(s, EV.NIGHTMARE_BOND_BREAK)).toBe(1);
    });

    it("예고는 파열보다 telegraphMs 만큼 먼저 온다", () => {
        const s = sim("2-4", 1, "nightmare");
        putBlocker(s, 0, 300, 2, 40);
        putEnemy(s, 0, 330);
        let telAt = -1;
        let brkAt = -1;
        for (let i = 0; i < HOLD_TICKS + 5; i++) {
            s.events.length = 0;
            stepBlocking(s);
            if (telAt < 0 && countEv(s, EV.NIGHTMARE_BOND_TELEGRAPH)) telAt = i;
            if (brkAt < 0 && countEv(s, EV.NIGHTMARE_BOND_BREAK)) brkAt = i;
        }
        expect(telAt).toBeGreaterThanOrEqual(0);
        expect(brkAt).toBeGreaterThan(telAt);
        expect((brkAt - telAt) * TICK_MS).toBeCloseTo(B.telegraphMs, -2);
    });

    it("★ 붙잡히지 않은 채 흘려보낸 시간은 세지 않는다 (누적은 '붙잡힌 틱'만)", () => {
        const s = sim("2-4", 1, "nightmare");
        const e = putEnemy(s, 0, 330); // 블로커가 없다
        for (let i = 0; i < HOLD_TICKS * 2; i++) stepBlocking(s);
        expect(e.blockedMs).toBe(0);
        expect(e.unbindable).toBe(false);
    });

    it("★ 풀 재사용으로 누적이 새지 않는다 — 실전 주행에서 스폰 즉시 파열이 없다", () => {
        const s = sim("2-9", 3, "nightmare");
        let earlyBreak = null;
        for (let i = 0; i < 3000 && s.phase === "battle"; i++) {
            step(s);
            for (let li = 0; li < 3; li++) {
                for (const e of s.lanes[li].enemies) {
                    // 파열한 적은 반드시 holdMs 이상 붙잡혀 있었다
                    if (e.unbindable && e.blockedMs < B.holdMs) {
                        earlyBreak = { id: e.id, blockedMs: e.blockedMs };
                    }
                }
            }
            if (earlyBreak) break;
        }
        expect(
            earlyBreak,
            `스폰 즉시 파열한 적이 있다 (풀 재사용 시 blockedMs 초기화 누락): ${JSON.stringify(earlyBreak)}`
        ).toBeNull();
    });
});
