/**
 * 지휘관 주문 **메커니즘** 검증 — "선언한 그 현상이 실제로 일어나는가" (2026-08-05)
 *
 * ★★★ `spells.test.js` 는 **자원 · 쿨다운 · 결정론**을 본다. 그 명제들은
 *   주문이 넷일 때는 충분했다. 12종이 되면서 부족해졌다 —
 *   "균열력이 줄었고 쿨다운이 돌았다"는 **아무 일도 일어나지 않은 주문**도 통과한다.
 *   각인이 정확히 그렇게 당했다 (`sigils.effect.test.js` 상단: 육중한 사격은
 *   실측 83 → 83 이었는데 감사는 초록불이었다).
 *
 * ★ 그래서 여기서는 주문마다 **그 주문만이 만들 수 있는 관측량**을 하나 고르고,
 *   같은 시드 · 같은 무대에서 쓰지 않고 한 번, 쓰고 한 번 재서 비교한다.
 *   "달라졌다"가 아니라 "선언한 만큼 달라졌다"를 본다.
 *
 *     파쇄 일제사격 → 적의 **DEF 를 올리면 피해가 그만큼 줄어드는가** (물리인가)
 *     균열 낙뢰     → DEF 를 올려도 피해가 **그대로인가** (술식인가)
 *     정화의 빛     → CORRUPT ×1.6 · LIVING ×0.7 이 실제로 곱해지는가
 *     반발 파동     → **붙들린 적은 밀리지 않는가** (스티키 블록이 풀리지 않는가)
 *     처형 선고     → 임계 이하가 죽고 임계 위가 사는가 · 처치로 집계되는가
 *     수호의 결계   → 실제로 **두 대**를 통째로 지우는가
 *     사수 명령     → 방벽이 정말 한 체 더 붙드는가 · 다른 역할에는 안 붙는가
 *     ...
 *
 * ★★ 그리고 이 파일이 지키는, 12종화가 만든 **새 명제 셋**:
 *     ① 장착하지 않은 주문은 발동하지 않는다 (4칸 규칙의 집행 지점)
 *     ② 오라 버프 셋을 겹쳐 걸었다 만료시켜도 스탯이 **정확히** 원복된다
 *        (예전 구현은 `a.buff` 객체 하나였다 — 둘째를 걸면 첫째가 영구 스탯이 됐다)
 *     ③ 자동 플레이가 **12종 전부**를 실제로 고른다
 *        (못 고르면 그 주문을 장착한 판을 하네스가 '주문 없는 게임'으로 잰다)
 *
 * ★ 난수를 쓰지 않는다. 시드 PRNG 와 고정 30Hz 틱만으로 같은 답이 나온다.
 *
 * @see docs/02-design/11-core-loop.md §4.4
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createSim, step } from "./sim.js";
import { buildStageConfig, UNIT_DEFS } from "./stageConfig.js";
import { trySummon, spawnEnemy } from "./spawn.js";
import { EV, forEachEvent } from "./events.js";
import { effectiveBlockCount } from "./aura.js";
import { TAG } from "./tags.js";
import {
    SPELLS,
    SPELL_IDS,
    LOADOUT_SIZE,
    DEFAULT_LOADOUT,
    canCast,
    castSpell,
    canEquipSpell,
    isEquipped,
    normalizeSpellLoadout,
    pickAutoSpell,
    spellDef,
    spellsForStage,
    unlockedSpellIds,
} from "./spells.js";

/* ══════════════════════════════════════════════════════════════
 * 무대 — 주문 하나만 변수로 남긴다
 * ══════════════════════════════════════════════════════════════ */

const STAGE = "1-12";
const SEED = 7;
const LANE = 1;

/**
 * 웨이브를 끈 빈 전장.
 * ★ 스폰·템포가 전부 상수여야 관측량이 주문 하나의 함수가 된다.
 * ★ 지휘관은 **전장 위에** 둔다 — 오라형 주문이 절반이라, 각인 검사(`sigils.effect.
 *   test.js`)처럼 치워 버리면 그 절반을 아예 잴 수 없다. 대신 위치를 고정한다.
 */
function arena({ spells, commanderX = 400 } = {}) {
    const cfg = buildStageConfig(STAGE, [{ id: "elf_sharpshooter", level: 1 }], { spells });
    const s = createSim(cfg, SEED);

    s.cfg.waveTable = []; // 웨이브가 열려도 아무도 나오지 않는다
    s.waveTotal = 5; // 0 으로 두면 "적이 없으니 승리"로 전투가 끝난다
    s.nextWaveAt = Infinity; // 웨이브는 테스트가 직접 연다

    s.commander.x = commanderX;
    s.commander.targetX = commanderX; // 지휘관이 스스로 걸어오지 않게 고정
    s.commander.lane = LANE;
    s.riftEnergy = s.riftMax;
    return s;
}

/** 동료 하나를 원하는 자리에 세운다 (기본은 제자리 고정) */
function summon(s, unitId, x = 430, lane = LANE) {
    s.mana = s.manaMax;
    expect(trySummon(s, UNIT_DEFS[unitId], lane), `${unitId} 소환 실패`).toBe(true);
    const u = s.actives[s.actives.length - 1];
    u.x = x;
    u.speed = 0;
    return u;
}

/**
 * 표적 더미. DEF·RES·태그 0, 반격 0 —
 * 관측량이 상성이나 반격으로 오염되지 않게 한다.
 */
function dummy(s, x, opts = {}) {
    const baseId = Object.keys(s.cfg.enemyDefs)[0];
    const tagMask = opts.tagMask ?? 0;
    const e = spawnEnemy(s, { ...s.cfg.enemyDefs[baseId], tagMask }, opts.lane ?? LANE);
    e.x = x;
    e.speed = opts.speed ?? 0;
    e.atk = opts.atk ?? 0;
    e.def = opts.def ?? 0;
    e.res = opts.res ?? 0;
    e.tags = tagMask;
    e.regenPerSec = 0;
    e.shield = 0;
    e.hpMax = opts.hpMax ?? 1e9;
    e.hp = opts.hp ?? e.hpMax;
    return e;
}

function stepN(s, n, onEvent) {
    for (let i = 0; i < n; i++) {
        step(s);
        if (onEvent) forEachEvent(s.events, onEvent);
    }
}

/** 오라 플래그를 실제 규칙으로 갱신한다 (직접 `inAura` 를 켜면 규칙을 흉내내는 것이다) */
function settle(s) {
    stepN(s, 1);
    return s;
}

/** 그 주문 하나만 들고 나간 무대 */
function withSpell(id, opts = {}) {
    return arena({ spells: [id], ...opts });
}

function fx(id) {
    return spellDef(id).effect;
}

/* ══════════════════════════════════════════════════════════════
 * ① 공격 주문 세 축 — 상성이 실제로 다른가
 * ══════════════════════════════════════════════════════════════ */

/** 주문 한 방이 표적 하나에게 실제로 입힌 피해 */
function damageOf(id, dummyOpts = {}) {
    const s = withSpell(id);
    const e = dummy(s, 700, dummyOpts);
    const before = e.hp;
    expect(castSpell(s, id, { lane: LANE }), `${id} 발동 실패`).toBe(true);
    return before - e.hp;
}

describe("파쇄 일제사격 (shatter_volley) — 물리 축", () => {
    /**
     * ★★ 물리는 **DEF 로 절대 감산**된다. 이것이 이 주문의 존재 이유이자 약점이고,
     *   그 부등식이 실제로 성립하지 않으면 "싼 대신 장갑에 약하다"는 설명이 거짓이 된다.
     */
    it("적 DEF 만큼 피해가 줄어든다", () => {
        const raw = fx("shatter_volley").amount;
        expect(damageOf("shatter_volley", { def: 0 })).toBeCloseTo(raw, 6);
        expect(damageOf("shatter_volley", { def: 20 })).toBeCloseTo(raw - 20, 6);
    });

    it("DEF 가 충분히 높으면 최소 피해 비율까지 떨어진다", () => {
        const raw = fx("shatter_volley").amount;
        const s = withSpell("shatter_volley");
        const floor = raw * s.cfg.combat.minDamageRatio;
        expect(damageOf("shatter_volley", { def: 999 })).toBeCloseTo(floor, 6);
    });

    it("레인의 적 **전원**을 때린다 (한 체가 아니다)", () => {
        const s = withSpell("shatter_volley");
        const list = [dummy(s, 600), dummy(s, 700), dummy(s, 800)];
        const before = list.map((e) => e.hp);
        castSpell(s, "shatter_volley", { lane: LANE });
        list.forEach((e, i) => expect(e.hp, "레인 전체가 맞아야 한다").toBeLessThan(before[i]));
    });

    it("다른 레인의 적은 맞지 않는다", () => {
        const s = withSpell("shatter_volley");
        const other = dummy(s, 700, { lane: 0 });
        const hp = other.hp;
        castSpell(s, "shatter_volley", { lane: LANE });
        expect(other.hp).toBe(hp);
    });
});

describe("균열 낙뢰 (rift_bolt) — 술식 축", () => {
    /** ★ 술식은 DEF 를 **완전히 무시**한다 — 물리와 갈라지는 지점이 여기다 */
    it("적 DEF 를 올려도 피해가 그대로다", () => {
        const raw = fx("rift_bolt").amount;
        expect(damageOf("rift_bolt", { def: 0 })).toBeCloseTo(raw, 6);
        expect(damageOf("rift_bolt", { def: 999 })).toBeCloseTo(raw, 6);
    });

    it("RES 는 비율로 깎는다", () => {
        const raw = fx("rift_bolt").amount;
        expect(damageOf("rift_bolt", { res: 50 })).toBeCloseTo(raw * 0.5, 6);
    });
});

describe("정화의 빛 (purging_light) — 신성 축", () => {
    /** ★ 태그를 읽어야 값어치가 결정되는 유일한 공격 주문. 그 배율을 직접 잰다. */
    it("CORRUPT 에 특효 · LIVING 에 반감이 실제로 곱해진다", () => {
        const raw = fx("purging_light").amount;
        const c = withSpell("purging_light").cfg.combat;
        expect(damageOf("purging_light")).toBeCloseTo(raw, 6);
        expect(damageOf("purging_light", { tagMask: TAG.CORRUPT })).toBeCloseTo(
            raw * c.holyMultCorrupt,
            6
        );
        expect(damageOf("purging_light", { tagMask: TAG.LIVING })).toBeCloseTo(
            raw * c.holyMultLiving,
            6
        );
    });

    /** ★ 같은 표적에서 신성이 술식보다 세거나 약해진다 — 그 역전이 선택을 만든다 */
    it("타락 웨이브에서는 낙뢰를 이기고, 생명체 웨이브에서는 진다", () => {
        expect(damageOf("purging_light", { tagMask: TAG.CORRUPT })).toBeGreaterThan(
            damageOf("rift_bolt", { tagMask: TAG.CORRUPT })
        );
        expect(damageOf("purging_light", { tagMask: TAG.LIVING })).toBeLessThan(
            damageOf("rift_bolt", { tagMask: TAG.LIVING })
        );
    });
});

/* ══════════════════════════════════════════════════════════════
 * ② 레인 주문 — 피해가 아닌 것들
 * ══════════════════════════════════════════════════════════════ */

describe("반발 파동 (repulsion_wave)", () => {
    it("붙들리지 않은 적을 균열 쪽으로 데이터만큼 민다", () => {
        const s = withSpell("repulsion_wave");
        const e = dummy(s, 700);
        const x0 = e.x;
        castSpell(s, "repulsion_wave", { lane: LANE });
        // ★ 위치는 이동 스텝이 옮긴다 — 명중 시점에 x 를 밀면 레인 정렬이 깨진다
        expect(e.pushX).toBeCloseTo(fx("repulsion_wave").pushPx, 6);
        stepN(s, 1);
        expect(e.x).toBeCloseTo(x0 + fx("repulsion_wave").pushPx, 6);
    });

    /**
     * ★★★ **붙들린 적은 밀지 않는다.** 밀면 `stepBlocking` 의 `gap > b.range` 가
     *   바로 넘어가 **용량 안의 적이 풀려난다** — 2026-08-04 에 고친
     *   "방벽을 간헐적으로 넘어간다"가 그대로 재발한다.
     */
    it("붙들린 적에게는 쌓지도 않는다 — 스티키 블록이 풀리지 않는다", () => {
        const s = withSpell("repulsion_wave");
        const b = summon(s, "slow_turtle", 700);
        const near = dummy(s, 722, { speed: 0 });
        settle(s);
        expect(effectiveBlockCount(b, s.cfg), "이 검사는 붙들린 적이 있어야 성립한다").toBeGreaterThan(0);
        expect(near.blockedBy, "적이 붙들려 있어야 한다").not.toBe(-1);

        const x0 = near.x;
        castSpell(s, "repulsion_wave", { lane: LANE });
        expect(near.pushX, "붙들린 적에게 밀어냄이 쌓였다").toBe(0);
        stepN(s, 1);
        expect(near.x, "붙들린 적이 밀려났다 — 블록이 풀린다").toBeCloseTo(x0, 6);
    });

    it("피해는 0 이다 — 시간을 사는 주문이지 죽이는 주문이 아니다", () => {
        const s = withSpell("repulsion_wave");
        const e = dummy(s, 700);
        const hp = e.hp;
        castSpell(s, "repulsion_wave", { lane: LANE });
        expect(e.hp).toBe(hp);
    });
});

describe("처형 선고 (execution_decree)", () => {
    const pct = () => fx("execution_decree").pct;

    it("임계 이하는 즉사하고 임계 위는 산다", () => {
        const s = withSpell("execution_decree");
        const low = dummy(s, 700, { hpMax: 1000, hp: 1000 * (pct() - 0.05) });
        const high = dummy(s, 760, { hpMax: 1000, hp: 1000 * (pct() + 0.05) });
        castSpell(s, "execution_decree", { lane: LANE });
        expect(low.hp).toBe(0);
        expect(high.hp).toBeGreaterThan(0);
    });

    /**
     * ★ 처형으로 죽은 적도 **정상 처치**다 — 처치 수 · 환급 · 균열력이 붙어야 한다.
     *   집계는 `lifecycle.js:stepDeaths` 가 한다. 여기서 kills 를 직접 올리면
     *   같은 사실이 두 곳에 적히고, 그 둘은 반드시 갈라진다.
     */
    it("처형된 적이 처치로 집계된다", () => {
        const s = withSpell("execution_decree");
        dummy(s, 700, { hpMax: 1000, hp: 1000 * (pct() - 0.05) });
        castSpell(s, "execution_decree", { lane: LANE });
        stepN(s, 1);
        expect(s.stats.kills, "처형이 처치로 세어지지 않는다").toBe(1);
    });

    /** ★ 난수가 없다 — 같은 상태에서 두 번 재면 완전히 같다 (절대 규칙 6) */
    it("확률이 없다 — 같은 HP 의 적 20체가 전부 같은 운명이다", () => {
        const s = withSpell("execution_decree");
        const list = [];
        for (let i = 0; i < 20; i++) {
            list.push(dummy(s, 600 + i * 20, { hpMax: 1000, hp: 1000 * (pct() - 0.05) }));
        }
        castSpell(s, "execution_decree", { lane: LANE });
        expect(list.every((e) => e.hp === 0), "일부만 죽었다면 그것은 확률이다").toBe(true);
    });
});

/* ══════════════════════════════════════════════════════════════
 * ③ 오라 주문 — 회복 · 결계 · 버프
 * ══════════════════════════════════════════════════════════════ */

/** 오라 안에 아군 하나를 세운 무대 — 지휘관을 그 아군 곁에 세운다 */
function auraStage(id, unitId = "determined_soldier", x = 430) {
    const s = withSpell(id, { commanderX: x - 30 });
    const u = summon(s, unitId, x);
    settle(s);
    expect(u.inAura, "이 검사는 아군이 오라 안에 있어야 성립한다").toBe(true);
    return { s, u };
}

describe("치유의 파동 (healing_wave)", () => {
    it("최대 HP 의 데이터 비율만큼 회복한다", () => {
        const { s, u } = auraStage("healing_wave");
        u.hp = 1;
        castSpell(s, "healing_wave");
        expect(u.hp).toBeCloseTo(1 + u.hpMax * fx("healing_wave").pctOfMax, 4);
    });

    it("오라 **밖** 아군은 회복하지 않는다", () => {
        const s = withSpell("healing_wave");
        const inside = summon(s, "determined_soldier", 430);
        const outside = summon(s, "determined_soldier", 430 + s.commander.auraRadius + 60);
        settle(s);
        expect(inside.inAura).toBe(true);
        expect(outside.inAura, "이 검사는 오라 밖 아군이 있어야 성립한다").toBe(false);
        inside.hp = 1;
        outside.hp = 1;
        castSpell(s, "healing_wave");
        expect(inside.hp).toBeGreaterThan(1);
        expect(outside.hp, "오라 밖이 회복됐다 — 위치가 위력이라는 설계가 사라진다").toBe(1);
    });

    it("최대 HP 를 넘지 않는다", () => {
        const { s, u } = auraStage("healing_wave");
        castSpell(s, "healing_wave");
        expect(u.hp).toBeLessThanOrEqual(u.hpMax);
    });
});

describe("수호의 결계 (warding_seal)", () => {
    it("데이터에 적힌 횟수만큼 무효화가 쌓인다", () => {
        const { s, u } = auraStage("warding_seal");
        expect(u.shield).toBe(0);
        castSpell(s, "warding_seal");
        expect(u.shield).toBe(fx("warding_seal").hits);
    });

    /**
     * ★★ 관측량은 필드 숫자가 아니라 **실제로 몇 대를 지웠는가**다.
     *   `combat.js:computeDamage` 가 이미 `shield` 를 소비하므로 새 개념을 만들지
     *   않았고, 그 사실이 참인지를 여기서 확인한다.
     */
    it("실제로 두 대를 통째로 지운다 — 타입을 가리지 않는다", () => {
        const hits = fx("warding_seal").hits;
        const damageTaken = (useSeal) => {
            const s = withSpell("warding_seal", { commanderX: 680 });
            const u = summon(s, "slow_turtle", 700);
            u.atk = 0; // 반격이 표적을 죽여 관측이 끊기지 않게 한다
            // ★ 술식 공격자 — DEF 로는 못 막는 피해다. 결계가 '타입 무관'인지를 본다
            const e = dummy(s, 706, { atk: 400, speed: 0 });
            e.dmgType = "arcane";
            e.atkInterval = 300;
            settle(s);
            expect(u.inAura, "이 검사는 아군이 오라 안이어야 성립한다").toBe(true);
            // ★ 표적이 **죽지 않아야** 관측이 끊기지 않는다. 죽으면 두 경우 모두
            //   같은 값에서 멈춰 "결계가 아무 일도 안 했다"로 보인다 (실제로 그랬다).
            u.hpMax = 1e9;
            u.hp = u.hpMax;
            if (useSeal) expect(castSpell(s, "warding_seal")).toBe(true);
            const hp0 = u.hp;
            let absorbed = 0;
            stepN(s, 60, (ev) => {
                if (ev.type === EV.DAMAGE && ev.a === u.id && ev.b === 0) absorbed++;
            });
            return { lost: hp0 - u.hp, absorbed };
        };
        const bare = damageTaken(false);
        const sealed = damageTaken(true);
        expect(bare.lost, "이 검사는 아군이 실제로 맞아야 성립한다").toBeGreaterThan(0);
        expect(sealed.lost, "결계가 피해를 줄이지 못했다").toBeLessThan(bare.lost);
        expect(sealed.absorbed, `${hits}대를 지워야 한다`).toBe(hits);
    });
});

describe("강철 명령 (steel_command)", () => {
    it("DEF 가 데이터만큼 오르고 만료 후 정확히 원복된다", () => {
        const { s, u } = auraStage("steel_command");
        const before = u.def;
        castSpell(s, "steel_command");
        expect(u.def).toBe(before + fx("steel_command").amount);
        s.t += fx("steel_command").durationMs;
        stepN(s, 1);
        expect(u.def, "만료 후 원복").toBe(before);
    });
});

describe("진격 나팔 (war_horn)", () => {
    it("공격 간격이 데이터 비율만큼 줄고 만료 후 원복된다", () => {
        const { s, u } = auraStage("war_horn", "halfling_slinger");
        const before = u.atkInterval;
        castSpell(s, "war_horn");
        expect(u.atkInterval).toBe(before + Math.round(before * fx("war_horn").pct));
        s.t += fx("war_horn").durationMs;
        stepN(s, 1);
        expect(u.atkInterval).toBe(before);
    });

    /** ★ 숫자가 아니라 **같은 시간 안에 실제로 더 쏘는가**를 본다 */
    it("같은 시간 안에 실제로 더 많이 쏜다", () => {
        const shots = (cast) => {
            const s = withSpell("war_horn");
            summon(s, "halfling_slinger", 430);
            dummy(s, 520);
            settle(s);
            if (cast) expect(castSpell(s, "war_horn")).toBe(true);
            let n = 0;
            stepN(s, 150, (ev) => {
                if (ev.type === EV.PROJECTILE_SPAWN) n++;
            });
            return n;
        };
        expect(shots(true)).toBeGreaterThan(shots(false));
    });
});

describe("사수 명령 (hold_the_line)", () => {
    it("방벽의 블록 수가 데이터만큼 오르고 만료 후 원복된다", () => {
        const { s, u } = auraStage("hold_the_line", "slow_turtle", 700);
        const before = u.blockCount;
        castSpell(s, "hold_the_line");
        expect(u.blockCount).toBe(before + fx("hold_the_line").amount);
        s.t += fx("hold_the_line").durationMs;
        stepN(s, 1);
        expect(u.blockCount).toBe(before);
    });

    /** ★★ 역할을 적은 버프는 **그 역할에만** 붙는다 — 설명이 거짓이 되지 않게 */
    it("방벽이 아닌 역할에는 붙지 않는다", () => {
        const s = withSpell("hold_the_line");
        const blocker = summon(s, "slow_turtle", 450);
        const melee = summon(s, "determined_soldier", 430);
        settle(s);
        expect(blocker.inAura).toBe(true);
        expect(melee.inAura, "이 검사는 근접도 오라 안이어야 성립한다").toBe(true);
        const meleeBlock = melee.blockCount;
        castSpell(s, "hold_the_line");
        expect(blocker.blockCount).toBeGreaterThan(0);
        expect(melee.blockCount, "방벽이 아닌 역할에 붙었다").toBe(meleeBlock);
        expect(melee.buff, "방벽이 아닌 역할에 버프 사슬이 걸렸다").toBeNull();
    });

    /** ★ 숫자가 아니라 **실제로 한 체 더 붙드는가**를 본다 */
    it("실제로 적을 한 체 더 붙든다", () => {
        const blocked = (cast) => {
            const s = withSpell("hold_the_line", { commanderX: 680 });
            const b = summon(s, "slow_turtle", 700);
            // 방벽 사거리 안, 최소 간격(20) 밖에 넷을 세운다
            for (const dx of [22, 28, 34, 39]) dummy(s, 700 + dx);
            settle(s);
            expect(b.inAura, "이 검사는 방벽이 오라 안이어야 성립한다").toBe(true);
            if (cast) expect(castSpell(s, "hold_the_line")).toBe(true);
            stepN(s, 2);
            expect(effectiveBlockCount(b, s.cfg)).toBeGreaterThan(0);
            return s.lanes[LANE].enemies.filter((e) => e.blockedBy !== -1).length;
        };
        expect(blocked(true)).toBe(blocked(false) + fx("hold_the_line").amount);
    });
});

/* ══════════════════════════════════════════════════════════════
 * ④ 전역 자원 주문 (target: self)
 * ══════════════════════════════════════════════════════════════ */

describe("징집 나팔 (conscript_call)", () => {
    it("마나를 데이터만큼 준다", () => {
        const s = withSpell("conscript_call");
        s.mana = 0;
        castSpell(s, "conscript_call");
        expect(s.mana).toBe(fx("conscript_call").amount);
    });

    it("최대 마나를 넘지 않는다", () => {
        const s = withSpell("conscript_call");
        s.mana = s.manaMax;
        castSpell(s, "conscript_call");
        expect(s.mana).toBe(s.manaMax);
    });

    /** ★ 대상이 self 다 — 오라 안에 아무도 없어도 나가야 한다 */
    it("오라 안에 아군이 하나도 없어도 나간다", () => {
        const s = withSpell("conscript_call");
        s.mana = 0;
        expect(s.lanes.every((l) => l.allies.length === 0)).toBe(true);
        expect(castSpell(s, "conscript_call")).toBe(true);
    });
});

describe("방주 수리 (ark_mending)", () => {
    it("방주 최대 HP 의 데이터 비율만큼 회복한다", () => {
        const s = withSpell("ark_mending");
        s.arkHp = 10;
        castSpell(s, "ark_mending");
        expect(s.arkHp).toBeCloseTo(10 + s.arkHpMax * fx("ark_mending").pctOfMax, 4);
    });

    it("최대치를 넘지 않는다", () => {
        const s = withSpell("ark_mending");
        castSpell(s, "ark_mending");
        expect(s.arkHp).toBe(s.arkHpMax);
    });
});

/* ══════════════════════════════════════════════════════════════
 * ⑤ 장착 4칸 — 12종화가 만든 새 규칙
 * ══════════════════════════════════════════════════════════════ */

describe("장착 4칸", () => {
    /**
     * ★★★ **화면이 잠그는 것이 아니라 규칙이 잠근다.** 화면에만 자물쇠를 그리면
     *   딥링크·다음 호출부가 그대로 통과한다 (CLAUDE.md 진행 게이트 규약).
     *   그 집행 지점이 `canCast` 이고, 이 검사가 그것을 지킨다.
     */
    it("들고 오지 않은 주문은 발동하지 않고 균열력도 줄지 않는다", () => {
        const s = withSpell("rift_bolt");
        dummy(s, 700);
        const rift = s.riftEnergy;
        for (const id of SPELL_IDS) {
            if (id === "rift_bolt") continue;
            expect(canCast(s, id).reason, `${id}`).toBe("unequipped");
            expect(castSpell(s, id, { lane: LANE }), `${id} 가 발동했다`).toBe(false);
        }
        expect(s.riftEnergy, "장착하지 않은 주문이 균열력을 태웠다").toBe(rift);
    });

    it("장착한 주문은 그대로 나간다", () => {
        for (const id of SPELL_IDS) {
            const s = withSpell(id);
            dummy(s, 700);
            expect(isEquipped(s, id)).toBe(true);
            expect(canCast(s, id).ok, `${id}`).toBe(true);
            expect(castSpell(s, id, { lane: LANE }), `${id}`).toBe(true);
        }
    });

    it("정규화가 4칸을 넘지 않고 중복·오타를 버린다", () => {
        const many = [...SPELL_IDS];
        expect(normalizeSpellLoadout(many).length).toBe(LOADOUT_SIZE);
        expect(normalizeSpellLoadout(["rift_bolt", "rift_bolt"])).toEqual(["rift_bolt"]);
        expect(normalizeSpellLoadout(["no_such_spell"])).toEqual([...DEFAULT_LOADOUT]);
    });

    /** ★ 빈 손으로 전투에 들어가면 균열력이 다시 '쌓이기만 하는 자원'이 된다 */
    it("빈 목록은 기본 장착으로 떨어진다 — 신규 계정이 빈 손이 되지 않는다", () => {
        expect(normalizeSpellLoadout([])).toEqual([...DEFAULT_LOADOUT]);
        expect(normalizeSpellLoadout(undefined)).toEqual([...DEFAULT_LOADOUT]);
        const s = arena();
        expect(s.spells.equipped).toEqual([...DEFAULT_LOADOUT]);
    });

    /** ★ 셋만 들고 가겠다는 결정을 조용히 덮어쓰지 않는다 */
    it("일부만 고르면 그 일부 그대로다", () => {
        expect(normalizeSpellLoadout(["rift_bolt", "ark_mending"])).toEqual([
            "rift_bolt",
            "ark_mending",
        ]);
    });

    it("아직 해금되지 않은 주문은 장착되지 않는다", () => {
        // 균열 낙뢰는 기본 해금, 방주 수리는 5-4 해금이다
        expect(normalizeSpellLoadout(["rift_bolt", "ark_mending"], 0)).toEqual(["rift_bolt"]);
        expect(canEquipSpell([], "ark_mending", 0).reason).toBe("locked");
        expect(canEquipSpell([], "ark_mending", 999).ok).toBe(true);
    });

    it("4칸이 차면 더 넣을 수 없다", () => {
        expect(canEquipSpell([...DEFAULT_LOADOUT], "shatter_volley", 999).reason).toBe("full");
        expect(canEquipSpell(["rift_bolt"], "rift_bolt", 999).reason).toBe("already");
        expect(canEquipSpell([], "no_such_spell", 999).reason).toBe("unknown");
    });
});

describe("해금 — 확정 지급이다 (절대 규칙 6)", () => {
    it("기본 장착 4종은 처음부터 열려 있다", () => {
        expect(unlockedSpellIds(0).sort()).toEqual([...DEFAULT_LOADOUT].sort());
    });

    it("해금 스테이지를 지나면 열리고, 그 전에는 닫혀 있다", () => {
        for (const sp of SPELLS) {
            if (!sp.unlockStage) continue;
            const at = spellsForStage(sp.unlockStage);
            expect(at, `${sp.id} 가 ${sp.unlockStage} 의 지급 목록에 없다`).toContain(sp.id);
        }
    });

    /** ★ 열리는 순서는 데이터가 정한다 — 12종이 한꺼번에 열리면 고르는 재미가 없다 */
    it("12종이 한꺼번에 열리지 않는다", () => {
        const stages = new Set(SPELLS.map((sp) => sp.unlockStage ?? "start"));
        expect(stages.size).toBeGreaterThan(4);
    });
});

/* ══════════════════════════════════════════════════════════════
 * ⑥ 버프 사슬 — 12종화가 만든 새 결함의 자리
 * ══════════════════════════════════════════════════════════════ */

describe("오라 버프를 겹쳐 걸어도 정확히 원복된다", () => {
    /**
     * ★★★ **회귀 방지.** 예전 구현은 `a.buff` 가 **객체 하나**였다. 주문이 넷일 때는
     *   오라 버프가 강철 명령 하나뿐이라 그것으로 충분했다. 12종에는 셋이 있고,
     *   둘째를 걸면 첫째 객체를 덮어써서 **되돌릴 값이 그 자리에서 사라진다** —
     *   즉 첫 버프가 영구 스탯이 된다. 그래서 사슬이다.
     */
    it("강철 명령 · 진격 나팔 · 사수 명령을 동시에 걸었다 만료시켜도 스탯이 원래 값이다", () => {
        const s = arena({ spells: ["steel_command", "war_horn", "hold_the_line"] });
        const u = summon(s, "slow_turtle", 430); // 방벽 — 세 버프를 전부 받는다
        settle(s);
        expect(u.inAura).toBe(true);

        const snapshot = { def: u.def, atkInterval: u.atkInterval, blockCount: u.blockCount };
        expect(castSpell(s, "steel_command")).toBe(true);
        expect(castSpell(s, "war_horn")).toBe(true);
        expect(castSpell(s, "hold_the_line")).toBe(true);

        expect(u.def).toBeGreaterThan(snapshot.def);
        expect(u.atkInterval).toBeLessThan(snapshot.atkInterval);
        expect(u.blockCount).toBeGreaterThan(snapshot.blockCount);

        const longest = Math.max(
            ...["steel_command", "war_horn", "hold_the_line"].map((id) => fx(id).durationMs)
        );
        s.t += longest;
        stepN(s, 1);

        expect(u.def, "겹친 버프가 영구 스탯으로 남았다").toBe(snapshot.def);
        expect(u.atkInterval, "겹친 버프가 영구 스탯으로 남았다").toBe(snapshot.atkInterval);
        expect(u.blockCount, "겹친 버프가 영구 스탯으로 남았다").toBe(snapshot.blockCount);
        expect(u.buff, "사슬이 비었으면 null 이어야 한다").toBeNull();
    });

    /** ★ 짧은 버프가 먼저 풀려도 긴 버프는 남아 있어야 한다 (사슬 중간 끊기) */
    it("만료 시각이 다르면 짧은 것만 먼저 풀린다", () => {
        const s = arena({ spells: ["steel_command", "war_horn"] });
        const u = summon(s, "determined_soldier", 430);
        settle(s);
        const def0 = u.def;
        const int0 = u.atkInterval;
        castSpell(s, "steel_command"); // 8초
        castSpell(s, "war_horn"); // 6초

        s.t += fx("war_horn").durationMs;
        stepN(s, 1);
        expect(u.atkInterval, "짧은 쪽이 풀려야 한다").toBe(int0);
        expect(u.def, "긴 쪽까지 풀렸다").toBeGreaterThan(def0);

        s.t += fx("steel_command").durationMs;
        stepN(s, 1);
        expect(u.def).toBe(def0);
    });
});

/* ══════════════════════════════════════════════════════════════
 * ⑦ 자동 플레이 — 12종 전부를 실제로 고르는가
 * ══════════════════════════════════════════════════════════════ */

/**
 * **모든 계층의 조건이 동시에 참인 무대.**
 *
 * ★★ 그래서 주문 하나만 장착하면 `pickAutoSpell` 은 **반드시 그것을 고른다.**
 *   못 고르면 그 주문을 장착한 판을 하네스가 '주문 없는 게임'으로 재고,
 *   그것이 `pickAutoSpell` 상단 주석이 경고하는 바로 그 실패다.
 */
function everyTierArena(spellIds) {
    const s = arena({ spells: spellIds });

    // 오라 안 아군 다섯 (방벽 포함) — 버프·결계·회복 계층의 조건
    const allies = [
        summon(s, "slow_turtle", 430),
        summon(s, "determined_soldier", 450),
        summon(s, "determined_soldier", 470),
        summon(s, "halfling_slinger", 490),
        summon(s, "halfling_slinger", 510),
    ];
    // 붐비는 레인 다섯 — 그중 셋은 처형 임계 아래. 선두는 방주 코앞
    dummy(s, s.cfg.arkX + 120, { hpMax: 1000, hp: 100 });
    dummy(s, 620, { hpMax: 1000, hp: 100 });
    dummy(s, 660, { hpMax: 1000, hp: 100 });
    dummy(s, 700, { hpMax: 1000, hp: 900 });
    dummy(s, 740, { hpMax: 1000, hp: 900 });

    settle(s);
    for (const a of allies) {
        expect(a.inAura, "이 무대는 아군이 전부 오라 안이어야 한다").toBe(true);
        a.hp = Math.max(1, Math.round(a.hpMax * 0.4)); // 회복 계층
    }
    s.arkHp = Math.round(s.arkHpMax * 0.3); // 방주 수리 계층
    s.mana = 0; // 징집 계층
    s.riftEnergy = s.riftMax;
    return s;
}

describe("자동 플레이가 12종 전부를 쓴다", () => {
    /**
     * ★★★ 자동 플레이가 주문을 안 쓰면 밸런스 하네스는 '주문 없는 게임'을 재고
     *   플레이어는 주문 있는 게임을 한다. 이 저장소가 추천 편성에서 이미 겪은
     *   형태의 괴리이고, 12종으로 늘리면서 가장 쉽게 되풀이될 실패다 —
     *   예전 정책은 주문 id 넷을 코드에 박고 있었다.
     */
    for (const sp of SPELLS) {
        it(`${sp.name?.ko ?? sp.id} (${sp.id}) 를 고른다`, () => {
            const s = everyTierArena([sp.id]);
            const pick = pickAutoSpell(s);
            expect(pick, `${sp.id} 를 한 번도 고르지 않는다`).not.toBeNull();
            expect(pick.id).toBe(sp.id);
            expect(castSpell(s, pick.id, pick), "고른 주문이 실제로 나가지 않는다").toBe(true);
        });
    }

    /** ★ 지휘관이 기절하면 오라가 없다 — 주문도 같이 멈춘다 */
    it("지휘관이 기절해 있으면 아무것도 고르지 않는다", () => {
        for (const sp of SPELLS) {
            const s = everyTierArena([sp.id]);
            s.commander.downUntil = s.t + 5000;
            expect(pickAutoSpell(s), sp.id).toBeNull();
        }
    });

    /**
     * ★★ **기본 4종에서는 예전과 완전히 같은 순서로 고른다.** 하네스가 재는 게임이
     *   12종화로 바뀌지 않았다는 것의 근거다 — 이 순서가 바뀌면 게이트 수치가
     *   움직이고, 그 움직임은 게임이 아니라 정책이 만든 것이 된다.
     */
    it("기본 장착에서는 회복 → 신성 → 술식 → 버프 순서 그대로다", () => {
        const s = everyTierArena(undefined); // 아무것도 고르지 않은 계정 = 기본 4종
        expect(s.spells.equipped).toEqual([...DEFAULT_LOADOUT]);

        /** 균열력은 늘 가득 채운다 — 여기서 재는 것은 예산이 아니라 **순서**다 */
        const next = () => {
            s.riftEnergy = s.riftMax;
            const pick = pickAutoSpell(s);
            if (pick) castSpell(s, pick.id, pick);
            return pick?.id ?? null;
        };
        expect(next()).toBe("healing_wave"); // ① 다친 아군이 있다
        expect(next()).toBe("purging_light"); // ② 신성이 먼저
        expect(next()).toBe("rift_bolt"); // ③ 그다음 술식
        expect(next()).toBe("steel_command"); // ④ 버프는 맨 마지막
    });
});

/* ══════════════════════════════════════════════════════════════
 * ⑧ 주문 위력 — 유물이 무엇을 밀고 무엇을 안 미는가
 * ══════════════════════════════════════════════════════════════ */

describe("주문 위력 배율 (지휘관 유물)", () => {
    it("피해 · 회복 · 마나 · 방주 회복 · 밀어냄에는 걸린다", () => {
        const withPower = (id, measure) => {
            const out = [];
            for (const mult of [1, 2]) {
                const s = withSpell(id);
                s.cfg.spellPowerMult = mult;
                out.push(measure(s));
            }
            return out;
        };

        const [d1, d2] = withPower("rift_bolt", (s) => {
            const e = dummy(s, 700);
            const hp = e.hp;
            castSpell(s, "rift_bolt", { lane: LANE });
            return hp - e.hp;
        });
        expect(d2).toBeCloseTo(d1 * 2, 6);

        const [m1, m2] = withPower("conscript_call", (s) => {
            s.mana = 0;
            castSpell(s, "conscript_call");
            return s.mana;
        });
        expect(m2).toBeCloseTo(m1 * 2, 6);

        const [p1, p2] = withPower("repulsion_wave", (s) => {
            const e = dummy(s, 700);
            castSpell(s, "repulsion_wave", { lane: LANE });
            return e.pushX;
        });
        expect(p2).toBeCloseTo(p1 * 2, 6);
    });

    /**
     * ★★ **이산량에는 걸리지 않는다** (`spells.json:$power`). 무효화 '횟수'에
     *   1.25 를 곱하면 반올림 한 번에 50% 가 뛰고, 처형 임계에 곱하면 유물 하나로
     *   '거의 전부 즉사'가 만들어진다. 그 대신 두 주문은 유물의 수혜를 못 받는다.
     */
    it("결계 횟수와 처형 임계에는 걸리지 않는다", () => {
        const s = arena({ spells: ["warding_seal", "execution_decree"] });
        s.cfg.spellPowerMult = 3;
        const u = summon(s, "determined_soldier", 430);
        const pct = fx("execution_decree").pct;
        const survivor = dummy(s, 700, { hpMax: 1000, hp: 1000 * (pct + 0.05) });
        settle(s);

        castSpell(s, "warding_seal");
        expect(u.shield, "위력 배율이 무효화 횟수를 밀었다").toBe(fx("warding_seal").hits);

        castSpell(s, "execution_decree", { lane: LANE });
        expect(survivor.hp, "위력 배율이 처형 임계를 밀었다").toBeGreaterThan(0);
    });
});

/* ══════════════════════════════════════════════════════════════
 * ⑨ 전수 규약 — 새 주문이 들어와도 기계가 잡는다
 * ══════════════════════════════════════════════════════════════ */

describe("전수 규약", () => {
    /**
     * ★ 12종 전부가 이 파일 어딘가에서 실제로 이름 불려야 한다. 새 주문을 넣고
     *   검사를 빼먹는 것이 이 파일이 막으려는 가장 흔한 사고다.
     */
    it("모든 주문이 이 파일에서 최소 한 번 이름으로 검증된다", () => {
        const src = readFileSync(fileURLToPath(import.meta.url), "utf8");
        for (const sp of SPELLS) {
            // 전수 루프가 아니라 **이름을 적은 검사**가 있어야 한다
            const literal = new RegExp(`["']${sp.id}["']`).test(src);
            expect(literal, `${sp.id}: 이름을 적은 검사가 하나도 없다`).toBe(true);
        }
        // ★ 전수 루프(⑦)도 살아 있어야 한다 — 개별 검사는 새 주문을 놓친다
        expect(/for \(const sp of SPELLS\)/.test(src), "전수 루프가 사라졌다").toBe(true);
        expect(SPELLS.length).toBe(12);
    });

    /**
     * ★★ 결정론 (게이트 B1) — 기본 4종이 아닌 장착으로도 같은 시드는 같은 결과다.
     *   새 kind 가 난수를 끌어들이면 여기서 먼저 깨진다.
     */
    it("기본이 아닌 장착으로도 같은 시드면 완전히 같다", () => {
        const run = () => {
            const s = arena({
                spells: ["shatter_volley", "execution_decree", "repulsion_wave", "ark_mending"],
            });
            summon(s, "slow_turtle", 430);
            for (let i = 0; i < 6; i++) dummy(s, 600 + i * 30, { hpMax: 1000, hp: 200, speed: 20 });
            for (let i = 0; i < 200; i++) {
                step(s, (st) => {
                    const pick = pickAutoSpell(st);
                    if (pick) castSpell(st, pick.id, pick);
                });
            }
            return {
                casts: s.spells.casts,
                ark: s.arkHp,
                rift: s.riftEnergy,
                hp: s.lanes[LANE].enemies.map((e) => e.hp).join(","),
            };
        };
        expect(run()).toEqual(run());
    });

    /** ★ 데이터가 선언한 kind 는 전부 실제로 무언가를 바꾼다 (관측량으로 확인) */
    it("모든 주문이 발동 후 상태를 실제로 바꾼다", () => {
        for (const sp of SPELLS) {
            const s = everyTierArena([sp.id]);
            const before = snapshotWorld(s);
            expect(castSpell(s, sp.id, { lane: LANE }), sp.id).toBe(true);
            stepN(s, 1);
            expect(snapshotWorld(s), `${sp.id}: 발동했는데 아무것도 달라지지 않았다`).not.toBe(
                before
            );
        }
    });
});

/** 관측 가능한 세계 전체를 한 문자열로 — "아무 일도 안 한 주문"을 잡는 그물 */
function snapshotWorld(s) {
    const parts = [s.arkHp, s.mana];
    for (const lane of s.lanes) {
        for (const a of lane.allies) parts.push(a.hp, a.def, a.atkInterval, a.blockCount, a.shield);
        for (const e of lane.enemies) parts.push(e.hp, Math.round(e.x), e.pushX);
    }
    return parts.join("|");
}
