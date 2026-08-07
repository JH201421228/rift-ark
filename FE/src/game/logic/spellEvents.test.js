/**
 * 지휘관 주문·평타의 **이벤트 페이로드** 검증 (2026-08-07).
 *
 * ★★★ 왜 이 파일이 생겼는가.
 *
 *   `EV.DAMAGE` 의 규약은 `(a=대상id, b=피해, c=레인, d=상성종류, s=공격자 dmgType)` 인데,
 *   `spells.js` 는 4개월 동안 `(…, e.x, e.y, id)` 를 보내고 있었다. 엔티티에는 `y`
 *   필드가 **아예 없으므로** `d` 는 언제나 0(일반)이었고, `c` 에는 레인 대신 x 좌표가
 *   들어갔다. 결과는 예외도 로그도 아닌 **침묵**이었다 — 주문의 "약점!/저항!" 표기가
 *   한 번도 뜨지 않았고, 정화의 빛(신성 → CORRUPT 특효)의 존재 이유가 화면에서
 *   완전히 사라졌다.
 *
 *   `spells.effect.test.js` 는 **효과**(HP 가 줄었는가)를 검사했고 통과했다.
 *   이벤트는 아무도 보지 않았다. 그래서 여기서 본다.
 *
 * ★ 같은 이유로 `EV.SPELL_CAST` 의 페이로드도 검사한다 — 연출이 그 값으로 그린다.
 *   빠진 값은 화면에 존재하지 않는다.
 */
import { describe, it, expect } from "vitest";
import { createSim, step } from "./sim.js";
import { buildStageConfig } from "./stageConfig.js";
import { castSpell } from "./spells.js";
import { EV } from "./events.js";
import { TOTAL_LANES } from "./state.js";
// ★ CORRUPT 비트의 출처는 tags.js 하나다 — 테스트에 숫자를 박으면 비트 정의가 바뀔 때 조용히 통과한다
import { TAG } from "./tags.js";
// ★ 연출 프로파일은 데이터다 — 이펙트 이름을 코드에 박지 않는다 (절대규칙 5)
import presenters from "../data/presenters.json" with { type: "json" };
import fxData from "../data/fx.json" with { type: "json" };
import spellsData from "../data/spells.json" with { type: "json" };

const SIX = [
    { id: "slow_turtle", level: 20 },
    { id: "bold_man_at_arms", level: 20 },
    { id: "determined_soldier", level: 20 },
    { id: "elf_sharpshooter", level: 20 },
    { id: "novice_pyromancer", level: 20 },
    { id: "jovial_friar", level: 20 },
];

function sim(stageId = "3-1", seed = 11) {
    const s = createSim(buildStageConfig(stageId, SIX, { meta: {} }), seed);
    s.riftEnergy = s.riftMax;
    return s;
}

/** 지정 레인에 시험용 적 하나 (실제 스폰 경로를 타지 않는 최소 더미) */
function putEnemy(s, lane, x, extra = {}) {
    const e = {
        id: 90000 + s.actives.length,
        isAlly: false,
        lane,
        x,
        hp: 500,
        hpMax: 500,
        atk: 0,
        def: 0,
        res: 0,
        shield: 0,
        tags: 0,
        blockedBy: -1,
        pushX: 0,
        dmgType: "physical",
        ...extra,
    };
    s.lanes[lane].enemies.push(e);
    s.actives.push(e);
    return e;
}

/** 이번 틱에 나온 이벤트만 (풀 기반이라 0..length-1 만 유효하다) */
function events(s, type) {
    const out = [];
    for (let i = 0; i < s.events.length; i++) {
        if (s.events.pool[i].type === type) out.push({ ...s.events.pool[i] });
    }
    return out;
}

/** 틱 안에서 주문을 쓴다 — 틱 밖에서 부르면 다음 step 의 resetQueue 가 이벤트를 지운다 */
function castInTick(s, id, target) {
    let ok = false;
    step(s, (sim2) => {
        ok = castSpell(sim2, id, target);
    });
    return ok;
}

describe("주문 이벤트 페이로드", () => {
    it("★★★ EV.DAMAGE 의 c 는 **레인**이다 (x 좌표가 아니다)", () => {
        const s = sim();
        s.commander.lane = 2;
        putEnemy(s, 2, 700);
        putEnemy(s, 2, 760);

        expect(castInTick(s, "rift_bolt")).toBe(true);
        const dmg = events(s, EV.DAMAGE);
        expect(dmg.length).toBeGreaterThan(0);
        for (const e of dmg) {
            expect(
                Number.isInteger(e.c) && e.c >= 0 && e.c < TOTAL_LANES,
                `c=${e.c} 는 레인이 아니다 — 렌더가 그 값을 LANES.ground[c].y 로 쓴다`
            ).toBe(true);
            expect(e.c).toBe(2);
        }
    });

    it("★★★ 신성 주문이 CORRUPT 를 때리면 d=2(약점) 가 실린다", () => {
        const s = sim();
        s.commander.lane = 1;
        // CORRUPT 비트는 tags.js 가 정한다 — 여기서 숫자를 박지 않는다
        putEnemy(s, 1, 700, { tags: TAG.CORRUPT });

        expect(castInTick(s, "purging_light")).toBe(true);
        const dmg = events(s, EV.DAMAGE).filter((e) => e.a >= 90000);
        expect(dmg.length).toBe(1);
        expect(dmg[0].d, "약점(2) 이어야 한다 — 이 값이 0 이면 화면이 아무 말도 하지 않는다").toBe(2);
        expect(dmg[0].s, "공격자의 데미지 타입이 실려야 한다").toBe("holy");
    });

    it("★★ EV.SPELL_CAST 가 연출에 필요한 것을 전부 싣는다", () => {
        const s = sim();
        s.commander.lane = 0;
        putEnemy(s, 0, 700);

        expect(castInTick(s, "rift_bolt")).toBe(true);
        const [cast] = events(s, EV.SPELL_CAST);
        expect(cast, "SPELL_CAST 가 나오지 않았다").toBeTruthy();
        expect(cast.s).toBe("rift_bolt");
        expect(cast.a, "대상 레인").toBe(0);
        expect(cast.b, "지휘관 x").toBeGreaterThan(0);
        expect(cast.c, "영향받은 대상 수").toBe(1);
    });

    it("★ 대상이 없어도 SPELL_CAST 는 나온다 (c=0) — 성공을 실패로 보이게 하지 않는다", () => {
        const s = sim();
        s.commander.lane = 0;
        expect(castInTick(s, "rift_bolt")).toBe(true);
        const [cast] = events(s, EV.SPELL_CAST);
        expect(cast).toBeTruthy();
        expect(cast.c).toBe(0);
    });

    it("★ 회복 주문의 c 도 레인이다", () => {
        const s = sim();
        // 오라 안 아군이 필요하다 — 실제 스폰 경로를 타는 대신 한 마리를 직접 세운다
        const a = {
            id: 5001,
            isAlly: true,
            lane: 1,
            x: s.commander.x,
            hp: 100,
            hpMax: 400,
            inAura: true,
            role: "MELEE",
            buff: null,
            shield: 0,
        };
        s.lanes[1].allies.push(a);
        s.actives.push(a);
        s.commander.lane = 1;

        expect(castInTick(s, "healing_wave")).toBe(true);
        const [heal] = events(s, EV.HEAL);
        expect(heal, "HEAL 이 나오지 않았다").toBeTruthy();
        expect(heal.c, "c 는 레인이다 (engage.js:trySupport 와 같은 규약)").toBe(1);
    });
});

describe("지휘관 평타 이벤트", () => {
    it("★ EV.DAMAGE 에 공격자의 데미지 타입(물리)이 실린다", () => {
        const s = sim("1-1", 3);
        const c = s.commander;
        putEnemy(s, c.lane, c.x + 20);
        // 평타는 stepCommanderAttack 이 낸다 — 한 틱 돌린다
        step(s);
        const dmg = events(s, EV.DAMAGE).filter((e) => e.a >= 90000);
        expect(dmg.length).toBeGreaterThan(0);
        expect(
            dmg[0].s,
            "때린 쪽의 타입이어야 한다 — 이 값이 없으면 렌더가 **맞은 쪽**의 타입으로 색을 고른다"
        ).toBe("physical");
    });
});

/**
 * 주문 연출 프로파일이 **실재하는 이펙트**를 가리키는가.
 *
 * ★★ `EffectSystem.play` 는 모르는 이름을 받으면 **아무것도 그리지 않고 조용히
 *   돌아간다.** 주문을 하나 더하고 프로파일을 빠뜨리면 그 주문만 무연출이 되는데,
 *   그것이 정확히 2026-08-07 이전의 상태였다 — 12종 전부가 그랬다.
 */
describe("주문 연출 프로파일", () => {
    const P = presenters.commander.spells;
    const EFFECTS = new Set(Object.keys(fxData.effects));
    const SHAPES = new Set(["lane", "aura", "self", "target"]);

    it.each(spellsData.spells.map((s) => s.id))("%s — 프로파일이 있다", (id) => {
        expect(P[id], `presenters.json:commander.spells.${id} 가 없다 — 그 주문만 무연출이 된다`)
            .toBeTruthy();
    });

    it.each(Object.keys(P).filter((k) => !k.startsWith("$")))(
        "%s — effect 가 fx.json 에 있고 shape 가 유효하다",
        (key) => {
            const prof = P[key];
            expect(EFFECTS.has(prof.effect), `fx.json 에 '${prof.effect}' 가 없다`).toBe(true);
            expect(SHAPES.has(prof.shape), `알 수 없는 shape '${prof.shape}'`).toBe(true);
            // ★ 저사양 티어의 동시 이펙트 예산(12)을 한 번에 먹지 않는다
            expect(prof.count ?? 1).toBeLessThanOrEqual(3);
        }
    );

    /**
     * ★★★ **공격 이펙트를 지원 주문에 쓰지 않는다** (2026-08-07, 사용자 제보 —
     *   "치유를 쓰는데 공격 모션이 나오고 버프에도 공격적인 이펙트가 들어간다").
     *
     *   처음 붙인 프로파일은 결계에 `holy_hit`(신성 타격), 사수 명령에
     *   `impact_blunt`(둔기 타격)를 쓰고 있었다. 게다가 `fx.json` 의 `heal` 자체가
     *   **베기 궤적**을 가리키고 있어서(접두 945), 회복까지 칼질이었다.
     *
     *   두 실수 모두 **"이름이 그럴듯하면 열어 보지 않는다"** 에서 나왔다.
     *   `validate-data` 는 '선언한 이펙트가 소비되는가'만 보지 **뜻이 맞는가**는 못 본다.
     *   그래서 여기서 **효과 종류와 이펙트 계열의 대응**을 명제로 못박는다.
     */
    const ATTACK_EFFECTS = new Set([
        "slash_a",
        "slash_b",
        "impact_small",
        "impact_blunt",
        "pierce",
        "arcane_hit",
        "holy_hit",
        "arcane_burst",
        "holy_burst",
        "explosion_large",
        "death_puff",
        "death_burst",
        "breach",
    ]);
    /** 공격적으로 보이면 안 되는 효과 종류 */
    const SUPPORT_KINDS = new Set(["heal", "arkHeal", "buff", "shield", "mana"]);

    it.each(spellsData.spells.filter((sp) => SUPPORT_KINDS.has(sp.effect.kind)).map((sp) => sp.id))(
        "%s — 지원 주문에 공격 이펙트가 붙어 있지 않다",
        (id) => {
            const sp = spellsData.spells.find((x) => x.id === id);
            expect(
                ATTACK_EFFECTS.has(P[id].effect),
                `${id}(${sp.effect.kind}) 에 공격 이펙트 '${P[id].effect}' 가 붙어 있다 — ` +
                    `회복·버프·보호막·자원은 타격 이펙트를 쓰지 않는다`
            ).toBe(false);
        }
    );

    it("★ 반대로 공격 주문에는 공격 이펙트가 붙어 있다 — 검사가 한쪽만 보지 않게", () => {
        for (const sp of spellsData.spells) {
            if (sp.effect.kind !== "damage" && sp.effect.kind !== "execute") continue;
            expect(
                ATTACK_EFFECTS.has(P[sp.id].effect),
                `${sp.id}(${sp.effect.kind}) 의 이펙트 '${P[sp.id].effect}' 가 공격처럼 보이지 않는다`
            ).toBe(true);
        }
    });

    it("지휘관 기절·복귀 연출도 실재하는 이펙트다", () => {
        for (const k of ["down", "up", "attack", "hurt"]) {
            const e = presenters.commander[k]?.effect;
            if (e) expect(EFFECTS.has(e), `fx.json 에 '${e}' 가 없다 (commander.${k})`).toBe(true);
        }
    });
});
