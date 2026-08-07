/**
 * 지휘관 주문 (11-core-loop.md §4.4)
 *
 * ★ 이 파일이 지키는 것:
 *   ① 균열력이 **실제로 소비**된다 (예전에는 오르기만 하는 자원이었다)
 *   ② 쿨다운·기절이 발동을 실제로 막는다
 *   ③ 버프가 **정확히 되돌아간다** — 되돌리지 못하면 영구 스탯이 된다
 *   ④ 결정론 (게이트 B1)
 */
import { describe, it, expect } from "vitest";
import { createSim, runToCompletion, step } from "./sim.js";
import { buildStageConfig } from "./stageConfig.js";
import { autoPlayTick } from "./autoPlay.js";
import { recommendedLoadout, stageEnemyCounts } from "./stagePreview.js";
import {
    SPELLS,
    SPELL_IDS,
    LOADOUT_SIZE,
    DEFAULT_LOADOUT,
    canCast,
    castSpell,
    cooldownPct,
    pickAutoSpell,
    spellDef,
} from "./spells.js";
import iconsData from "../data/icons.json" with { type: "json" };

const STAGE = "1-9";
const units = recommendedLoadout(stageEnemyCounts(STAGE));
const cfg = () => buildStageConfig(STAGE, units);

/**
 * 주문을 쓸 수 있을 만큼 진행시킨다 (아군이 소환되고 오라가 켜진 뒤).
 *
 * ★ 고정 틱 수로 멈추지 않는다. 지휘관은 위협을 따라 움직이므로 "300틱이면
 *   오라 안에 아군이 있다"는 **시드에 따라 참이 아니다** — 실제로 그렇게 짰다가
 *   전제 단언에서 실패했다. 조건이 성립할 때까지 돌리고, 안 되면 그 사실을 알린다.
 */
function warmed(seed = 0, { needAura = false, maxTicks = 1200 } = {}) {
    const s = createSim(cfg(), seed);
    for (let i = 0; i < maxTicks; i++) {
        step(s, (st) => autoPlayTick(st, { autoSpells: false }));
        if (s.phase !== "battle") break;
        if (i < 300) continue;
        if (!needAura) break;
        if (s.lanes.some((l) => l.allies.some((a) => a.hp > 0 && a.inAura))) break;
    }
    return s;
}

describe("데이터", () => {
    /**
     * ★★ 12종을 만들고 **4종만 들고 나간다** (2026-08-05). 도크가 네 칸이라서가
     *   아니라, 배제가 곧 결정이기 때문이다 (CLAUDE.md 설계 결정 1).
     *   숫자 자체는 `data:validate` 가 여러 각도로 지키므로 여기서는 두 값이
     *   **다르다**는 것만 본다 — 같아지는 순간 고르는 행위가 사라진다.
     */
    it("주문은 12종이고 장착은 4칸이다", () => {
        expect(SPELLS.length).toBe(12);
        expect(LOADOUT_SIZE).toBe(4);
        expect(SPELLS.length).toBeGreaterThan(LOADOUT_SIZE);
        expect(DEFAULT_LOADOUT.length).toBe(LOADOUT_SIZE);
    });

    it("id 가 유일하다", () => {
        expect(new Set(SPELL_IDS).size).toBe(SPELL_IDS.length);
    });

    it("아이콘이 실재하는 키를 가리킨다 — 없는 키는 화면에서 빈칸이 된다", () => {
        for (const sp of SPELLS) {
            expect(iconsData.icons[sp.icon], `${sp.id}: ${sp.icon}`).toBeTruthy();
        }
    });

    it("코스트·쿨다운이 양수이고 한글 이름·설명이 있다", () => {
        for (const sp of SPELLS) {
            expect(sp.cost, sp.id).toBeGreaterThan(0);
            expect(sp.cooldownMs, sp.id).toBeGreaterThan(0);
            // ★ 정본은 `{ ko, en }` 이다 (2026-08-07). `nameKo` 는 구형이고,
            //   두 언어가 갖춰졌는지는 `check:i18n` 의 I5 가 본다.
            expect(sp.name?.ko, sp.id).toBeTruthy();
            expect(sp.desc?.ko, sp.id).toBeTruthy();
        }
    });

    it("장착 4종을 동시에 다 쓸 균열력이 최대치 하나로는 모자란다 — 선택이 강제된다", () => {
        // ★ 다 쓸 수 있으면 '장착 4칸'이 선택이 아니라 순서 문제가 된다.
        //   가장 싼 4종으로도 넘어야 하며, 그 부등식은 data:validate 가 강제한다.
        const cheapest = SPELLS.map((sp) => sp.cost)
            .sort((a, b) => a - b)
            .slice(0, LOADOUT_SIZE)
            .reduce((a, b) => a + b, 0);
        expect(cheapest).toBeGreaterThan(100);
    });
});

describe("소비 — 균열력이 실제로 줄어든다", () => {
    it("발동하면 코스트만큼 차감된다", () => {
        const s = warmed();
        s.riftEnergy = 100;
        const before = s.riftEnergy;
        expect(castSpell(s, "rift_bolt", { lane: 0 })).toBe(true);
        expect(s.riftEnergy).toBe(before - spellDef("rift_bolt").cost);
    });

    it("균열력이 모자라면 발동하지 않고 차감도 없다", () => {
        const s = warmed();
        s.riftEnergy = 1;
        expect(castSpell(s, "rift_bolt", { lane: 0 })).toBe(false);
        expect(s.riftEnergy).toBe(1);
    });

    it("알 수 없는 주문은 조용히 실패한다 (throw 하지 않는다)", () => {
        const s = warmed();
        s.riftEnergy = 100;
        expect(castSpell(s, "no_such_spell")).toBe(false);
        expect(s.riftEnergy).toBe(100);
    });
});

describe("쿨다운", () => {
    it("연속 발동을 막는다", () => {
        const s = warmed();
        s.riftEnergy = 100;
        expect(castSpell(s, "rift_bolt", { lane: 0 })).toBe(true);
        s.riftEnergy = 100; // 자원은 충분하게 만들어 **쿨다운만** 시험한다
        expect(castSpell(s, "rift_bolt", { lane: 0 })).toBe(false);
        expect(canCast(s, "rift_bolt").reason).toBe("cooldown");
    });

    it("쿨다운이 지나면 다시 쓸 수 있다", () => {
        const s = warmed();
        s.riftEnergy = 100;
        castSpell(s, "rift_bolt", { lane: 0 });
        s.t += spellDef("rift_bolt").cooldownMs;
        s.riftEnergy = 100;
        expect(castSpell(s, "rift_bolt", { lane: 0 })).toBe(true);
    });

    it("cooldownPct 가 1 에서 0 으로 내려간다 (HUD 게이지)", () => {
        const s = warmed();
        s.riftEnergy = 100;
        castSpell(s, "rift_bolt", { lane: 0 });
        expect(cooldownPct(s, "rift_bolt")).toBeGreaterThan(0.9);
        s.t += spellDef("rift_bolt").cooldownMs;
        expect(cooldownPct(s, "rift_bolt")).toBe(0);
    });
});

describe("지휘관이 기절하면 주문도 잠긴다", () => {
    it("오라가 없는 동안은 발동할 수 없다", () => {
        // ★ 오라 밖에서 회복·버프가 걸리면 기절 페널티가 사라진다.
        //   판정은 `aura.js` 와 같은 명제(`s.t >= downUntil`)를 쓴다.
        const s = warmed();
        s.riftEnergy = 100;
        s.commander.downUntil = s.t + 5000;
        expect(castSpell(s, "healing_wave")).toBe(false);
        expect(canCast(s, "healing_wave").reason).toBe("commander_down");
        expect(pickAutoSpell(s)).toBeNull();
    });
});

describe("효과", () => {
    it("공격 주문이 그 레인의 적 HP 를 깎는다", () => {
        const s = warmed();
        s.riftEnergy = 100;
        const lane = s.lanes.findIndex((l) => l.enemies.some((e) => e.hp > 0));
        expect(lane, "적이 있는 레인이 필요하다").toBeGreaterThanOrEqual(0);
        const before = s.lanes[lane].enemies.reduce((a, e) => a + Math.max(0, e.hp), 0);
        castSpell(s, "rift_bolt", { lane });
        const after = s.lanes[lane].enemies.reduce((a, e) => a + Math.max(0, e.hp), 0);
        expect(after).toBeLessThan(before);
    });

    it("회복 주문은 오라 **안** 아군만 올린다", () => {
        const s = warmed();
        s.riftEnergy = 100;
        const allies = s.lanes.flatMap((l) => l.allies).filter((a) => a.hp > 0);
        expect(allies.length, "아군이 필요하다").toBeGreaterThan(0);
        for (const a of allies) a.hp = Math.max(1, Math.floor(a.hpMax * 0.4));
        const outside = allies.filter((a) => !a.inAura).map((a) => [a, a.hp]);
        castSpell(s, "healing_wave");
        for (const [a, hp] of outside) expect(a.hp, "오라 밖은 회복되면 안 된다").toBe(hp);
    });

    it("회복은 최대 HP 를 넘지 않는다", () => {
        const s = warmed();
        s.riftEnergy = 100;
        castSpell(s, "healing_wave");
        for (const l of s.lanes) for (const a of l.allies) expect(a.hp).toBeLessThanOrEqual(a.hpMax);
    });
});

describe("버프는 정확히 되돌아간다", () => {
    /**
     * ★★ 되돌리지 못하면 **영구 스탯**이 된다. 증분을 기록하지 않고 상수를 빼는
     *   구현은 같은 버프가 두 번 걸렸다 한 번만 만료되는 순간 조용히 틀린다.
     */
    it("만료 후 DEF 가 원래 값으로 돌아온다", () => {
        const s = warmed(0, { needAura: true });
        s.riftEnergy = 100;
        const inAura = s.lanes.flatMap((l) => l.allies).filter((a) => a.hp > 0 && a.inAura);
        expect(inAura.length, "오라 안 아군이 필요하다").toBeGreaterThan(0);
        const before = inAura.map((a) => a.def);

        expect(castSpell(s, "steel_command")).toBe(true);
        inAura.forEach((a, i) => expect(a.def).toBeGreaterThan(before[i]));

        // 만료 시각을 넘겨 틱을 돌린다
        s.t += spellDef("steel_command").effect.durationMs + 100;
        step(s, null);
        inAura.forEach((a, i) => expect(a.def, "만료 후 원복").toBe(before[i]));
    });

    it("풀에서 재사용된 엔티티가 이전 버프를 물려받지 않는다", () => {
        // ★ `acquireEntity` 가 `buff` 를 초기화하지 않으면 죽은 유닛의 버프가
        //   다음에 그 슬롯을 쓰는 유닛에게 영구 스탯으로 남는다.
        const s = createSim(cfg(), 5);
        runToCompletion(s, (st) => autoPlayTick(st), 400, (st) => st.pendingDraft.options.length - 1);
        for (const e of s.entityPool) {
            if (!e.active) expect(e.buff ?? null, "풀에 버프가 남았다").toBeNull();
        }
    });
});

describe("결정론 (게이트 B1)", () => {
    it("같은 시드면 주문 발동까지 완전히 같다", () => {
        const run = (seed) => {
            const s = createSim(cfg(), seed);
            let n = 0;
            runToCompletion(s, (st) => autoPlayTick(st), 400, (st) => (seed + n++) % st.pendingDraft.options.length);
            return { phase: s.phase, t: s.t, casts: s.spells.casts, ark: s.arkHp };
        };
        expect(run(3)).toEqual(run(3));
    });

    it("자동 플레이가 주문을 실제로 쓴다 — 안 쓰면 하네스가 다른 게임을 잰다", () => {
        const s = createSim(cfg(), 1);
        runToCompletion(s, (st) => autoPlayTick(st), 400, () => 0);
        expect(s.spells.casts).toBeGreaterThan(0);
    });

    it("autoSpells:false 면 한 번도 쓰지 않는다 (비교 측정용 스위치)", () => {
        const s = createSim(cfg(), 1);
        runToCompletion(s, (st) => autoPlayTick(st, { autoSpells: false }), 400, () => 0);
        expect(s.spells.casts).toBe(0);
    });
});
