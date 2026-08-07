/**
 * 교전 성립 — **"아군이 아무것도 하지 않는다"의 전수 검사** (2026-08-05 사용자 제보)
 *
 * ★★★ 제보 세 건이 전부 여기로 모인다.
 *
 *   ① "아군이 많아지면 일부 아군은 어떤 공격도 하지 않는다"
 *   ⑤ "일부 적 근거리 몬스터가 방벽 아군을 뚫고 지나간다"
 *   ⑥ "균열까지 간 아군이 뒤(방주 쪽)의 적을 공격하지 않는다"
 *
 *   ①과 ⑥은 **같은 뿌리**였다. 타겟 선정(`engage.js:nearestTarget`)은 앞뒤를
 *   모두 보는데 **이동(`movement.js:stepMovement`)이 +x 단방향**이었다.
 *   그래서 균열 끝(x=1184)까지 걸어간 아군은 자기를 지나쳐 간 적이 사거리를
 *   벗어나는 순간 **영원히 아무것도 하지 않는 상태**가 됐고, 그 적은 저항 없이
 *   방주까지 갔다. 아군이 많을수록 앞으로 밀려 나가는 아군이 늘어 더 자주 보였다.
 *
 *   ①에는 두 번째 원인이 하나 더 있었다 — **비행 아군**. `auraEffects.FLYER.
 *   canHitGround` 가 데이터와 설계 문서에 있는데 **읽는 코드가 없어서**
 *   비행 동료는 공중 적이 없는 판에서 한 대도 때리지 않았다.
 *
 *   ⑤는 **버그가 아니었다** — 아래 "방벽 용량" describe 의 주석 참조.
 *
 * ★ 무대를 직접 세운다. 웨이브를 끄고 좌표를 고정하면 관측량이 규칙 하나의 함수가 된다.
 */
import { describe, it, expect } from "vitest";

import { createSim, step } from "./sim.js";
import { buildStageConfig, UNIT_DEFS } from "./stageConfig.js";
import { trySummon, spawnEnemy } from "./spawn.js";
import { EV, forEachEvent } from "./events.js";
import { effectiveBlockCount } from "./aura.js";
import { TAG } from "./tags.js";
import { AIR_LANE } from "./state.js";
import balance from "../data/balance.json" with { type: "json" };
import enemiesData from "../data/enemies.json" with { type: "json" };

const STAGE = "1-12";
const SEED = 7;
const LANE = 1;
const OFF_FIELD = -100000;

function arena(opts = {}) {
    const cfg = buildStageConfig(STAGE, [{ id: "elf_sharpshooter", level: 1 }]);
    const s = createSim(cfg, SEED);
    s.cfg.waveTable = [];
    s.waveTotal = 5;
    s.nextWaveAt = Infinity;
    s.commander.x = opts.commanderX ?? OFF_FIELD;
    s.commander.targetX = s.commander.x;
    s.commander.lane = opts.commanderLane ?? LANE;
    return s;
}

function summon(s, unitId, x, lane = LANE) {
    s.mana = s.manaMax;
    expect(trySummon(s, UNIT_DEFS[unitId], lane), `${unitId} 소환 실패`).toBe(true);
    const u = s.actives[s.actives.length - 1];
    u.x = x;
    return u;
}

function dummy(s, x, opts = {}) {
    const baseId = Object.keys(s.cfg.enemyDefs)[0];
    const tagMask = opts.tagMask ?? 0;
    const e = spawnEnemy(s, { ...s.cfg.enemyDefs[baseId], tagMask }, opts.lane ?? LANE);
    e.x = x;
    e.speed = opts.speed ?? 0;
    e.atk = 0;
    e.def = 0;
    e.res = 0;
    e.tags = tagMask;
    e.regenPerSec = 0;
    e.hpMax = 1e9;
    e.hp = 1e9;
    return e;
}

/** 각 아군이 N틱 동안 몇 번 공격했는가 */
function attackCounts(s, units, ticks) {
    const counts = new Map(units.map((u) => [u.id, 0]));
    for (let i = 0; i < ticks; i++) {
        step(s);
        forEachEvent(s.events, (e) => {
            if (e.type === EV.ATTACK && counts.has(e.a)) counts.set(e.a, counts.get(e.a) + 1);
        });
    }
    return counts;
}

/* ══════════════════════════════════════════════════════════════
 * ⑥ 뒤로 돌아선다
 * ══════════════════════════════════════════════════════════════ */

describe("뒤의 적 추격 (제보 ⑥)", () => {
    /** ★★ 재현 — 균열 끝의 아군 · 사거리 밖 뒤쪽의 적 */
    it("균열까지 간 아군이 뒤로 지나간 적을 향해 돌아서서 공격한다", () => {
        const s = arena();
        const u = summon(s, "determined_soldier", s.cfg.riftX); // 근접 · 사거리 40
        const e = dummy(s, 900); // 284px 뒤 — 사거리(40) 밖

        const counts = attackCounts(s, [u], 400);
        expect(u.x, "아군이 적 쪽으로 이동해야 한다").toBeLessThan(s.cfg.riftX);
        expect(counts.get(u.id), "뒤의 적을 한 번도 때리지 않았다").toBeGreaterThan(0);
        expect(e.hp).toBeLessThan(e.hpMax);
    });

    it("원거리 아군도 사거리 밖 뒤쪽 적에게 다가간다", () => {
        const s = arena();
        const u = summon(s, "halfling_slinger", s.cfg.riftX); // 사거리 150
        dummy(s, 700);
        const counts = attackCounts(s, [u], 400);
        expect(counts.get(u.id)).toBeGreaterThan(0);
    });

    /**
     * ★★★ **앞에 적이 하나라도 있으면 절대 뒤로 돌지 않는다 — 전열을 비우지 않는다.**
     *
     *   "가까운 쪽으로 간다"로 만들었더니 게이트 B16(`sim.test.js` "방벽 필수성")이
     *   깨졌다. 전열의 아군이 뒤로 샌 적 하나를 쫓아 전선을 비우는 바람에
     *   **방벽 없는 편성의 잔여 HP 가 기준선의 72.5%** 가 됐고(상한 70%),
     *   "적은 BLOCKER 에게만 멈춘다"는 구조적 심장이 물러졌다.
     *   그래서 뒤로 도는 조건은 "앞에 아무도 없을 때" 하나로 좁혔다.
     */
    it("앞에 적이 남아 있으면 뒤로 돌지 않는다 — 전열을 비우지 않는다", () => {
        const s = arena();
        const u = summon(s, "determined_soldier", 700);
        dummy(s, 1100); // 앞 400
        dummy(s, 690); // 뒤 10 — 훨씬 가깝다
        attackCounts(s, [u], 60);
        expect(u.x, "더 가깝다는 이유로 뒤로 돌면 전선이 비어 버린다").toBeGreaterThanOrEqual(700);
    });

    /** ★ 진동 금지 — 같은 상황을 두 번 돌리면 좌표 궤적이 완전히 같아야 한다 */
    it("추격이 결정론적이고 제자리에서 떨지 않는다", () => {
        const trace = () => {
            const s = arena();
            const u = summon(s, "determined_soldier", 900);
            dummy(s, 400);
            dummy(s, 1100);
            const xs = [];
            for (let i = 0; i < 120; i++) {
                step(s);
                xs.push(Math.round(u.x * 100) / 100);
            }
            return xs;
        };
        const a = trace();
        expect(trace()).toEqual(a);

        // 방향이 한 번 정해지면 뒤집히지 않는다 (앞뒤로 흔들리면 부호가 여러 번 바뀐다)
        let flips = 0;
        for (let i = 2; i < a.length; i++) {
            const d1 = Math.sign(a[i - 1] - a[i - 2]);
            const d2 = Math.sign(a[i] - a[i - 1]);
            if (d1 !== 0 && d2 !== 0 && d1 !== d2) flips++;
        }
        expect(flips, `방향이 ${flips}번 뒤집혔다 — 진동이다`).toBeLessThanOrEqual(1);
    });

    /**
     * ★★★ **붙들고 있는 방벽은 절대 자리를 뜨지 않는다.**
     *   뒤의 적을 쫓아 움직이면 스티키 블록(2026-08-04)이 통째로 풀려
     *   막고 있던 무리가 전부 전진한다 — 고치려던 버그를 되살리는 길이다.
     */
    it("적을 붙들고 있는 방벽은 뒤의 적을 쫓아가지 않는다", () => {
        const s = arena();
        const b = summon(s, "slow_turtle", 700);
        const held = dummy(s, 730); // 방벽 사거리(40) 안 · minGap(20) 밖
        dummy(s, 300); // 뒤쪽 미끼

        step(s);
        expect(held.blockedBy, "먼저 붙들어야 이 검사가 성립한다").toBe(b.id);

        const x0 = b.x;
        for (let i = 0; i < 120; i++) step(s);
        expect(b.x, "붙들고 있는데 자리를 떴다").toBe(x0);
        expect(held.blockedBy).toBe(b.id);
    });

    /** ★ 지원은 적을 쫓지 않는다 — 힐러가 적진으로 걸어 들어가면 안 된다 */
    it("지원 동료는 뒤의 적을 쫓아가지 않는다", () => {
        const s = arena();
        const u = summon(s, "jovial_friar", 900);
        dummy(s, 300);
        const x0 = u.x;
        for (let i = 0; i < 120; i++) step(s);
        expect(u.x).toBeGreaterThanOrEqual(x0);
    });
});

/* ══════════════════════════════════════════════════════════════
 * ① 아무 공격도 하지 않는 아군
 * ══════════════════════════════════════════════════════════════ */

describe("침묵하는 아군 (제보 ①)", () => {
    /**
     * ★★ 재현 — 아군이 많아 앞으로 밀려 나간 뒤 적이 뒤로 지나간 상황.
     *   예전에는 여기서 **전원이 침묵**했다 (이동이 단방향이라 되돌아갈 수 없었다).
     */
    it("아군을 늘려도 한 번도 공격하지 않는 아군이 생기지 않는다", () => {
        for (const n of [2, 4, 6, 8, 10]) {
            const s = arena();
            const units = [];
            for (let i = 0; i < n; i++) {
                units.push(summon(s, "elf_sharpshooter", s.cfg.riftX - i * 4));
            }
            dummy(s, 700); // 전원보다 훨씬 뒤 · 사거리(220) 밖

            const counts = attackCounts(s, units, 400);
            const silent = units.filter((u) => counts.get(u.id) === 0);
            expect(silent.length, `아군 ${n}체 중 ${silent.length}체가 침묵했다`).toBe(0);
        }
    });

    /**
     * ★★★ **비행 아군은 오라 안에서 지상을 때린다.**
     *   `balance.json:commander.auraEffects.FLYER.canHitGround` 와
     *   `docs/02-design/11-core-loop.md` §4.2 가 선언한 규칙인데
     *   **읽는 코드가 없었다** — 비행 동료 4종은 공중 적이 없으면 아무것도 안 했다.
     */
    it("오라 안 비행 아군이 지상 적을 때린다", () => {
        expect(balance.commander.auraEffects.FLYER.canHitGround, "데이터가 사라졌다").toBe(true);

        const attacks = (inAura) => {
            const s = arena({ commanderX: inAura ? 400 : OFF_FIELD, commanderLane: 0 });
            const u = summon(s, "magical_fairy", 400, LANE); // FLYER → 자동으로 공중 레인
            expect(u.lane).toBe(AIR_LANE);
            dummy(s, 420);
            const counts = attackCounts(s, [u], 200);
            return { n: counts.get(u.id), inAuraFlag: u.inAura };
        };

        const outside = attacks(false);
        expect(outside.inAuraFlag).toBe(false);
        expect(outside.n, "오라 밖에서는 공중만 — 설계 표 그대로").toBe(0);

        const inside = attacks(true);
        expect(inside.inAuraFlag, "오라가 공중 레인에 닿지 않는다").toBe(true);
        expect(inside.n, "오라 안인데도 지상을 때리지 않았다").toBeGreaterThan(0);
    });

    it("비행 아군은 공중 적을 여전히 때린다", () => {
        const s = arena();
        const u = summon(s, "magical_fairy", 400, LANE);
        dummy(s, 420, { tagMask: TAG.FLYING });
        const counts = attackCounts(s, [u], 200);
        expect(counts.get(u.id)).toBeGreaterThan(0);
    });
});

/* ══════════════════════════════════════════════════════════════
 * ⑤ 방벽 통과 — 의도인가 버그인가
 * ══════════════════════════════════════════════════════════════ */

describe("방벽 용량 (제보 ⑤)", () => {
    /**
     * ★★★ **답: 용량 초과는 의도다. 용량이 남는데 통과하면 버그다.**
     *   실측(자동 플레이 1-12·2-10·3-8·4-9 × 시드 3):
     *   `stepBlocking` 직후 "용량이 남는데 포획 창 안에 있으면서 안 잡힌 적" = **0건**.
     *   즉 지금 통과하는 적은 전부 ⑴ 용량 초과분이거나 ⑵ FLYING 이다.
     */
    it("용량만큼만 붙들고, 넘치는 만큼만 지나간다", () => {
        const s = arena();
        const b = summon(s, "slow_turtle", 300);
        const cap = effectiveBlockCount(b, s.cfg);
        expect(cap).toBeGreaterThan(0);

        const enemies = [];
        for (const dx of [22, 26, 30, 34, 38]) enemies.push(dummy(s, 300 + dx));
        step(s);

        expect(enemies.filter((e) => e.blockedBy === b.id).length).toBe(cap);
    });

    it("FLYING 은 붙들리지 않는다 — 설계다", () => {
        const s = arena();
        const b = summon(s, "slow_turtle", 300);
        const air = dummy(s, 330, { tagMask: TAG.FLYING });
        step(s);
        expect(air.blockedBy).toBe(-1);
        expect(b.blocking).toBe(0);
    });

    /**
     * ★ 용량이 남으면 **반드시** 잡는다 — 스티키 규칙이 재배정을 막지 않는다.
     *   (2026-08-04 스티키 수정의 가장 있음직한 부작용이 이것이었다.)
     */
    it("붙들던 적이 죽으면 남은 적이 곧바로 그 슬롯에 들어간다", () => {
        const s = arena();
        const b = summon(s, "slow_turtle", 300);
        const cap = effectiveBlockCount(b, s.cfg);
        const enemies = [];
        for (const dx of [22, 26, 30, 34]) enemies.push(dummy(s, 300 + dx));
        step(s);

        const held = enemies.filter((e) => e.blockedBy === b.id);
        expect(held.length).toBe(cap);
        held[0].hp = 0;
        step(s); // 사망 처리 + 재배정
        step(s);

        const nowHeld = s.lanes[LANE].enemies.filter((e) => e.blockedBy === b.id);
        expect(nowHeld.length, "슬롯이 비었는데 아무도 들어가지 않았다").toBe(cap);
    });

    /**
     * ★★ **터널링은 산술적으로 불가능하다.**
     *   포획 창 = (방벽 사거리 − blockMinGap). 가장 좁은 방벽이 40 − 20 = 20px.
     *   가장 빠른 적조차 30Hz 에서 틱당 3px 미만이다 —
     *   "한 틱에 창을 통째로 건너뛰는" 적은 데이터에 없다.
     *   이 검사는 **누가 적 속도를 올렸을 때** 깨져서 알려주는 것이 목적이다.
     */
    it("한 틱에 방벽 포획 창을 건너뛰는 적이 없다", () => {
        const minGap = balance.combat.blockMinGap;
        const window = Math.min(
            ...Object.values(UNIT_DEFS)
                .filter((u) => u.role === "BLOCKER")
                .map((b) => b.range - minGap)
        );
        expect(window).toBeGreaterThan(0);

        const fastest = Math.max(...enemiesData.enemies.map((e) => e.base.speed));
        // 30Hz 고정 틱. 적은 방벽의 전진 속도만큼 더 빨리 접근할 수도 있다.
        const fastestBlockerApproach = Math.max(
            ...Object.values(UNIT_DEFS)
                .filter((u) => u.role === "BLOCKER")
                .map((b) => b.speed)
        );
        const perTick = (fastest + fastestBlockerApproach) / 30;
        expect(perTick, `틱당 ${perTick.toFixed(2)}px — 포획 창 ${window}px 를 건너뛴다`).toBeLessThan(
            window
        );
    });
});
