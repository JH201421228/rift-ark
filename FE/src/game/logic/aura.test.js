/**
 * 역할별 오라 효과 — **선언한 것이 실제로 도는가** (2026-08-05)
 *
 * ★★★ 이 파일이 존재하는 이유는 하나다.
 *
 *   `docs/02-design/11-core-loop.md` §4.2 의 역할별 오라 표는 7개 역할 전부에
 *   효과를 적어 두었는데, `balance.json` 에서 MELEE · RANGED · SIEGE 는
 *   `special: true` 였고 **그 값을 읽는 코드가 없었다.** FLYER 의 `canHitGround`
 *   도 2026-08-05 까지 같은 상태였다 (`engage.js:strikeGround` 가 그날 이었다).
 *   문법은 완전하고 항목만 하나 없는 결함이라 어떤 테스트도 잡지 못했다.
 *
 *   그래서 여기서는 "함수가 값을 돌려주는가"가 아니라
 *   **"데이터를 바꾸면 전투 결과가 바뀌는가"** 를 묻는다. 데이터를 껐을 때
 *   효과가 사라지지 않으면 그 규칙은 코드에 박혀 있는 것이고, 그것도 사고다.
 */
import { describe, it, expect } from "vitest";
import {
    auraActiveFor,
    auraExecuteThreshold,
    auraPushPower,
    auraPierceBonus,
    applyAuraOnHit,
} from "./aura.js";
import { ROLE_ORDER } from "./roles.js";
import { createSim, runToCompletion } from "./sim.js";
import { buildStageConfig } from "./stageConfig.js";
import { autoPlayTick } from "./autoPlay.js";
import balance from "../data/balance.json" with { type: "json" };

/** 최소 cfg — 오라 효과 표와 균열 좌표만 있으면 된다 */
const cfg = () => ({
    auraEffects: JSON.parse(JSON.stringify(balance.commander.auraEffects)),
    riftX: balance.battlefield.riftX,
});

const ally = (role, over = {}) => ({
    role,
    isAlly: true,
    inAura: true,
    ...over,
});
const foe = (over = {}) => ({
    isAlly: false,
    hp: 100,
    hpMax: 100,
    pushX: 0,
    blockedBy: -1,
    ...over,
});

/* ══════════════════════════════════════════════════════════════
 * 데이터 계약
 * ══════════════════════════════════════════════════════════════ */
describe("오라 효과 데이터", () => {
    it("★ 키는 전부 실재하는 역할이다 — SPECIALIST 같은 유령이 없다", () => {
        const roles = Object.keys(balance.commander.auraEffects).filter((k) => !k.startsWith("$"));
        expect(roles.sort()).toEqual([...ROLE_ORDER].sort());
    });

    it("★★ `special: true` 가 없다 — 무엇인지 말하지 않는 값은 읽을 수 없다", () => {
        for (const [role, eff] of Object.entries(balance.commander.auraEffects)) {
            if (role.startsWith("$")) continue;
            expect(Object.keys(eff), role).not.toContain("special");
        }
    });
});

/* ══════════════════════════════════════════════════════════════
 * SUPPORT — 반전은 데이터가 정한다
 * ══════════════════════════════════════════════════════════════ */
describe("SUPPORT 반전 (auraEffects.SUPPORT.inverted)", () => {
    it("오라 *밖*에서 활성화된다", () => {
        const c = cfg();
        expect(auraActiveFor(ally("SUPPORT", { inAura: true }), c)).toBe(false);
        expect(auraActiveFor(ally("SUPPORT", { inAura: false }), c)).toBe(true);
    });

    it("★ 데이터에서 inverted 를 끄면 반전도 사라진다 — 규칙이 코드에 박혀 있지 않다", () => {
        const c = cfg();
        c.auraEffects.SUPPORT.inverted = false;
        expect(auraActiveFor(ally("SUPPORT", { inAura: true }), c)).toBe(true);
    });

    it("반전 역할이 아니면 오라 안에서 활성화된다", () => {
        const c = cfg();
        expect(auraActiveFor(ally("MELEE", { inAura: true }), c)).toBe(true);
        expect(auraActiveFor(ally("MELEE", { inAura: false }), c)).toBe(false);
    });
});

/* ══════════════════════════════════════════════════════════════
 * MELEE — 처형
 * ══════════════════════════════════════════════════════════════ */
describe("MELEE 오라 처형 (execThreshold)", () => {
    it("임계 이하의 적을 즉시 처치한다", () => {
        const c = cfg();
        const thr = c.auraEffects.MELEE.execThreshold;
        const t = foe({ hp: 100 * thr - 1 });
        applyAuraOnHit(ally("MELEE"), t, c);
        expect(t.hp).toBe(0);
    });

    it("임계보다 많이 남았으면 처형하지 않는다", () => {
        const c = cfg();
        const t = foe({ hp: 100 * c.auraEffects.MELEE.execThreshold + 1 });
        const before = t.hp;
        applyAuraOnHit(ally("MELEE"), t, c);
        expect(t.hp).toBe(before);
    });

    it("★ 오라 밖에서는 처형하지 않는다 — 설계 표의 '오라 밖: 평타만'", () => {
        const c = cfg();
        const t = foe({ hp: 1 });
        applyAuraOnHit(ally("MELEE", { inAura: false }), t, c);
        expect(t.hp).toBe(1);
    });

    it("★ 근접이 아닌 역할은 처형하지 않는다", () => {
        const c = cfg();
        for (const role of ROLE_ORDER.filter((r) => r !== "MELEE")) {
            expect(auraExecuteThreshold(ally(role), c), role).toBe(0);
        }
    });

    it("★★ 데이터에서 임계를 지우면 처형이 사라진다", () => {
        const c = cfg();
        delete c.auraEffects.MELEE.execThreshold;
        const t = foe({ hp: 1 });
        applyAuraOnHit(ally("MELEE"), t, c);
        expect(t.hp).toBe(1);
    });

    it("★ 각인 '처형'(0.18)보다 임계가 낮다 — 각인이 고를 값을 잃으면 안 된다", () => {
        expect(balance.commander.auraEffects.MELEE.execThreshold).toBeLessThan(0.18);
    });
});

/* ══════════════════════════════════════════════════════════════
 * SIEGE — 밀어내기
 * ══════════════════════════════════════════════════════════════ */
describe("SIEGE 오라 밀어내기 (pushPower)", () => {
    it("적을 균열 쪽(+x)으로 민다 — 방주에서 멀어지는 방향이다", () => {
        const c = cfg();
        const t = foe();
        applyAuraOnHit(ally("SIEGE"), t, c);
        expect(t.pushX).toBe(c.auraEffects.SIEGE.pushPower);
    });

    it("★★★ **방벽이 붙든 적은 밀지 않는다** — 스티키 블록이 그 자리에서 풀린다", () => {
        const c = cfg();
        const t = foe({ blockedBy: 42 });
        applyAuraOnHit(ally("SIEGE"), t, c);
        expect(t.pushX).toBe(0);
    });

    it("★ 오라 밖에서는 밀지 않는다", () => {
        const c = cfg();
        const t = foe();
        applyAuraOnHit(ally("SIEGE", { inAura: false }), t, c);
        expect(t.pushX).toBe(0);
    });

    it("★ 공성이 아닌 역할은 밀지 않는다", () => {
        const c = cfg();
        for (const role of ROLE_ORDER.filter((r) => r !== "SIEGE")) {
            expect(auraPushPower(ally(role), c), role).toBe(0);
        }
    });

    it("★★ 데이터에서 세기를 지우면 밀어내기가 사라진다", () => {
        const c = cfg();
        delete c.auraEffects.SIEGE.pushPower;
        const t = foe();
        applyAuraOnHit(ally("SIEGE"), t, c);
        expect(t.pushX).toBe(0);
    });

    it("★ 이미 죽은 적은 밀지 않는다 — 시체를 미는 그림이 나온다", () => {
        const c = cfg();
        const t = foe({ hp: 0 });
        applyAuraOnHit(ally("SIEGE"), t, c);
        expect(t.pushX).toBe(0);
    });
});

/* ══════════════════════════════════════════════════════════════
 * RANGED — 관통 (코드에 박혀 있던 1 을 데이터로 옮겼다)
 * ══════════════════════════════════════════════════════════════ */
describe("RANGED 오라 관통 (pierceBonus)", () => {
    it("오라 안에서만 관통이 붙는다", () => {
        const c = cfg();
        expect(auraPierceBonus(ally("RANGED"), c)).toBe(c.auraEffects.RANGED.pierceBonus);
        expect(auraPierceBonus(ally("RANGED", { inAura: false }), c)).toBe(0);
    });

    it("★★ 데이터에서 지우면 관통이 사라진다 — 코드에 박혀 있지 않다", () => {
        const c = cfg();
        delete c.auraEffects.RANGED.pierceBonus;
        expect(auraPierceBonus(ally("RANGED"), c)).toBe(0);
    });
});

/* ══════════════════════════════════════════════════════════════
 * ★★★ 실제 전투에서 도는가 (sigils:audit 과 같은 수법)
 *
 *   단위 테스트는 "함수가 값을 돌려준다"까지만 증명한다. 이 프로젝트가 반복해서
 *   당한 사고는 그 다음 칸이다 — **함수는 맞는데 아무도 부르지 않는다.**
 *   그래서 같은 시드로 두 번 돌려 결과가 달라지는지를 본다.
 * ══════════════════════════════════════════════════════════════ */
describe("전투에 실제로 반영된다", () => {
    const L = (id, level) => ({ id, level });
    /** 근접 · 공성이 둘 다 들어간 편성 (그 둘의 오라 효과를 재는 것이 목적이다) */
    const SIX = [
        L("slow_turtle", 18),
        L("bold_man_at_arms", 18),
        L("determined_soldier", 18),
        L("elf_sharpshooter", 18),
        L("spikey_porcupine", 18),
        L("jovial_friar", 18),
    ];

    /**
     * ★ `cfg.auraEffects` 는 `balance.json` 의 **객체 그 자체**다
     *   (`stageConfig.js` 가 참조를 그대로 넘긴다). 복제하지 않고 고치면
     *   같은 프로세스의 뒷 테스트가 전부 오염된다.
     */
    const run = (mutate) => {
        const cfg = buildStageConfig("1-9", SIX);
        cfg.auraEffects = JSON.parse(JSON.stringify(cfg.auraEffects));
        mutate(cfg);
        const s = createSim(cfg, 7);
        runToCompletion(s, (st) => autoPlayTick(st), 400);
        return { phase: s.phase, tick: s.tick, kills: s.stats.kills };
    };

    const base = () => run(() => {});

    it("★ 근접 처형을 끄면 같은 시드의 전투가 달라진다", () => {
        const off = run((c) => {
            c.auraEffects.MELEE.execThreshold = 0;
        });
        expect(off).not.toEqual(base());
    });

    it("★ 공성 밀어내기를 끄면 같은 시드의 전투가 달라진다", () => {
        const off = run((c) => {
            c.auraEffects.SIEGE.pushPower = 0;
        });
        expect(off).not.toEqual(base());
    });

    it("건드리지 않으면 완전히 같다 (결정론 — 게이트 B1)", () => {
        expect(base()).toEqual(base());
    });
});
