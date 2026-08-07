/**
 * 데미지 공식 단위 테스트
 * @see docs/02-design/11-core-loop.md §3.1
 */
import { describe, it, expect } from "vitest";
import { computeDamage, canTarget } from "./combat.js";
import { TAG, tagsToMask, maskToTags } from "./tags.js";
import balance from "../data/balance.json" with { type: "json" };

const CFG = balance.combat;

const atk = (dmgType, power = 100) => ({ atk: power, dmgType, tags: 0 });
const tgt = (o = {}) => ({ def: 0, res: 0, tags: 0, shield: 0, ...o });

describe("데미지 타입", () => {
    it("물리는 DEF 로 절대 감산된다", () => {
        expect(computeDamage(atk("physical"), tgt({ def: 30 }), CFG).amount).toBe(70);
    });

    it("술식은 DEF 를 완전히 무시한다 — 장갑을 뚫는 유일한 답", () => {
        expect(computeDamage(atk("arcane"), tgt({ def: 0 }), CFG).amount).toBe(100);
        expect(computeDamage(atk("arcane"), tgt({ def: 999 }), CFG).amount).toBe(100);
    });

    it("술식은 RES 로 비율 감산된다", () => {
        expect(computeDamage(atk("arcane"), tgt({ res: 40 }), CFG).amount).toBeCloseTo(60);
    });

    it("신성은 CORRUPT 에 1.6배, LIVING 에 0.7배", () => {
        expect(computeDamage(atk("holy"), tgt({ tags: TAG.CORRUPT }), CFG).amount).toBeCloseTo(160);
        expect(computeDamage(atk("holy"), tgt({ tags: TAG.LIVING }), CFG).amount).toBeCloseTo(70);
        expect(computeDamage(atk("holy"), tgt(), CFG).amount).toBeCloseTo(100);
    });
});

describe("최소 피해 보장", () => {
    it("완전 상성 불일치여도 10% 는 들어간다", () => {
        const r = computeDamage(atk("physical"), tgt({ def: 9999 }), CFG);
        expect(r.amount).toBe(10);
        expect(r.resisted).toBe(true);
    });

    it("10% 는 사실상 무력하므로 상성은 여전히 결정적이다", () => {
        const wrong = computeDamage(atk("physical"), tgt({ def: 9999 }), CFG).amount;
        const right = computeDamage(atk("arcane"), tgt({ def: 9999 }), CFG).amount;
        expect(right / wrong).toBe(10);
    });
});

describe("SHIELDED", () => {
    it("첫 N회 피해를 통째로 무효화한다 — 다단히트가 답", () => {
        const t = tgt({ shield: 2 });
        expect(computeDamage(atk("physical"), t, CFG).absorbed).toBe(true);
        expect(computeDamage(atk("physical"), t, CFG).absorbed).toBe(true);
        const third = computeDamage(atk("physical"), t, CFG);
        expect(third.absorbed).toBe(false);
        expect(third.amount).toBe(100);
    });
});

describe("상성 피드백 플래그", () => {
    it("술식이 ARMORED 를 뚫으면 '약점' 으로 표시된다", () => {
        expect(computeDamage(atk("arcane"), tgt({ tags: TAG.ARMORED, def: 50 }), CFG).effective).toBe(true);
    });
    it("물리가 WARDED 를 때리면 '약점' 으로 표시된다", () => {
        expect(computeDamage(atk("physical"), tgt({ tags: TAG.WARDED, res: 80 }), CFG).effective).toBe(true);
    });
});

describe("FLYING 타겟팅", () => {
    it("물리 근접은 비행을 때릴 수 없다", () => {
        expect(canTarget({ tags: 0, dmgType: "physical" }, { tags: TAG.FLYING })).toBe(false);
    });
    it("ANTI_AIR 는 비행을 때릴 수 있다", () => {
        expect(canTarget({ tags: TAG.ANTI_AIR, dmgType: "physical" }, { tags: TAG.FLYING })).toBe(true);
    });
    it("술식은 비행을 때릴 수 있다", () => {
        expect(canTarget({ tags: 0, dmgType: "arcane" }, { tags: TAG.FLYING })).toBe(true);
    });
});

describe("태그 비트마스크", () => {
    it("왕복 변환이 손실 없이 된다", () => {
        const names = ["ARMORED", "FLYING", "LIVING"];
        expect(maskToTags(tagsToMask(names))).toEqual([...names].sort());
    });
    it("알 수 없는 태그는 즉시 실패한다 — 데이터 오타를 조용히 넘기지 않는다", () => {
        expect(() => tagsToMask(["NOPE"])).toThrow();
    });
});
