/**
 * 품질 티어 — 값이 아니라 **규약**을 고정한다
 *
 * ★ 숫자(24 · 18 · 12 …)는 여기서 검사하지 않는다. 그것은 데이터이고, 데이터는
 *   성능 측정에 따라 바뀌어야 한다. 바뀌면 안 되는 것은 아래 셋이다:
 *     ① `auto` 가 무엇으로 풀리는가 (렌더러 선택과 같은 판정이어야 한다)
 *     ② 알 수 없는 값이 화면을 못 열게 만들지 않는가
 *     ③ 모든 티어가 같은 필드를 갖는가 — 하나만 빠지면 그 티어에서 `undefined` 가
 *        풀 크기로 들어가고, 증상은 "저사양에서만 이펙트가 안 나온다"가 된다
 *
 * ★ 배선(누가 이 표를 읽는가)은 `src/game/wiring.test.js` 가 본다.
 */
import { describe, it, expect } from "vitest";
import { QUALITY_TIERS, TIER_NAMES, resolveTier, qualityOf } from "./quality.js";
import { detectLowEnd } from "../device.js";

describe("품질 티어 표", () => {
    it("high · medium · low 가 전부 있다", () => {
        expect(TIER_NAMES).toEqual(expect.arrayContaining(["high", "medium", "low"]));
    });

    it("모든 티어가 같은 필드를 갖는다 — 하나만 빠지면 그 티어에서 undefined 가 예산이 된다", () => {
        const shape = Object.keys(QUALITY_TIERS.high).sort();
        for (const name of TIER_NAMES) {
            expect(Object.keys(QUALITY_TIERS[name]).sort(), `${name} 티어`).toEqual(shape);
        }
    });

    it("낮은 티어가 실제로 더 적다 — 이름만 티어인 표를 막는다", () => {
        expect(QUALITY_TIERS.low.effects).toBeLessThan(QUALITY_TIERS.high.effects);
        expect(QUALITY_TIERS.low.dmgText).toBeLessThan(QUALITY_TIERS.high.dmgText);
        expect(QUALITY_TIERS.low.bgLayers).toBeLessThanOrEqual(QUALITY_TIERS.high.bgLayers);
        expect(QUALITY_TIERS.low.shake).toBeLessThanOrEqual(QUALITY_TIERS.high.shake);
    });

    it("셰이크 배율은 0 보다 크다 — 티어가 접근성 스위치를 대신 꺼서는 안 된다", () => {
        for (const name of TIER_NAMES) expect(QUALITY_TIERS[name].shake).toBeGreaterThan(0);
    });
});

describe("기기 판정 (device.js)", () => {
    it("코어 4 이하 또는 메모리 2GB 이하가 저사양이다", () => {
        expect(detectLowEnd({ hardwareConcurrency: 4, deviceMemory: 8 })).toBe(true);
        expect(detectLowEnd({ hardwareConcurrency: 8, deviceMemory: 2 })).toBe(true);
        expect(detectLowEnd({ hardwareConcurrency: 8, deviceMemory: 8 })).toBe(false);
    });

    it("알려주지 않는 브라우저는 고사양으로 본다 — 모르는 것을 벌하지 않는다", () => {
        // ★ `deviceMemory` 는 사파리에 없다. 없다고 저사양으로 깎으면 iPhone 전량이 low 가 된다.
        expect(detectLowEnd({})).toBe(false);
        // navigator 자체가 없는 환경(노드 도구·하네스)도 고사양으로 본다
        expect(detectLowEnd(null)).toBe(false);
    });
});

describe("resolveTier", () => {
    it("auto 는 기기 판정에 위임한다 (렌더러 선택과 같은 판정)", () => {
        expect(resolveTier("auto", true)).toBe("low");
        expect(resolveTier("auto", false)).toBe("high");
    });

    it("명시한 티어는 기기 판정을 이긴다 — 자동 감지가 틀린 기기가 반드시 있다", () => {
        expect(resolveTier("high", true)).toBe("high");
        expect(resolveTier("low", false)).toBe("low");
    });

    it("알 수 없는 값·없는 값에도 표를 돌려준다 (손상된 세이브가 전투를 막지 않는다)", () => {
        expect(TIER_NAMES).toContain(resolveTier("초고화질", false));
        expect(qualityOf(undefined, false)).toBe(QUALITY_TIERS.high);
        expect(qualityOf(null, true)).toBe(QUALITY_TIERS.low);
    });
});
