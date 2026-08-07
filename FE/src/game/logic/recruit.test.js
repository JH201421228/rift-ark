/**
 * 동료 영입 검증 (2026-08-04)
 *
 * ★★ 이 파일이 막는 사고는 하나다: **얻을 수 없는 동료가 다시 생기는 것.**
 *   가챠를 걷어냈을 때 30종 중 20종이 조용히 획득 불가가 됐고, 어떤 테스트도
 *   그것을 말하지 않았다. `데이터에 있다 ≠ 손에 넣을 수 있다`.
 */
import { describe, it, expect } from "vitest";
import {
    RECRUITABLE,
    BY_RARITY,
    isRecruitable,
    recruitCost,
    recruitUnlockStage,
    recruitableAt,
    canRecruit,
} from "./recruit.js";
import { STAGE_GRANTS, STARTING_UNITS } from "./unlocks.js";
import unitsData from "../data/units.json" with { type: "json" };

const ALL = unitsData.units.map((u) => u.id);
const GUARANTEED = new Set([...STARTING_UNITS, ...STAGE_GRANTS.flatMap((g) => g.units)]);

describe("영입 대상", () => {
    /** ★★ 이 게임에서 가장 중요한 단언이다 — 로스터에 죽은 칸이 없다 */
    it("모든 동료는 확정 지급이거나 영입 대상이다 — 둘 다 아닌 동료가 없다", () => {
        for (const id of ALL) {
            expect(GUARANTEED.has(id) || isRecruitable(id), `${id} 는 얻을 방법이 없다`).toBe(
                true
            );
        }
    });

    it("확정 지급 동료는 영입 목록에 없다 — 무료로 오는 것을 팔지 않는다", () => {
        for (const id of GUARANTEED) expect(isRecruitable(id), id).toBe(false);
    });

    it("영입 + 확정 = 로스터 전량 (겹치지 않는다)", () => {
        expect(RECRUITABLE.length + GUARANTEED.size).toBe(ALL.length);
    });

    it("모든 등급에 가격과 해금이 있다 — 등급이 늘면 여기서 막힌다", () => {
        for (const id of RECRUITABLE) {
            expect(recruitCost(id), id).toBeGreaterThan(0);
            expect(recruitUnlockStage(id), id).toBeGreaterThanOrEqual(0);
        }
    });

    it("상위 등급이 더 비싸고 더 늦게 열린다", () => {
        const order = ["C", "R", "E", "L"].filter((r) => BY_RARITY[r]);
        for (let i = 1; i < order.length; i++) {
            expect(BY_RARITY[order[i]].gold).toBeGreaterThan(BY_RARITY[order[i - 1]].gold);
            expect(BY_RARITY[order[i]].unlockStage).toBeGreaterThanOrEqual(
                BY_RARITY[order[i - 1]].unlockStage
            );
        }
    });
});

describe("해금", () => {
    it("진행할수록 목록이 늘어나기만 한다 — 거꾸로 잠기지 않는다", () => {
        let prev = 0;
        for (let n = 0; n <= 100; n++) {
            const size = recruitableAt(n).length;
            expect(size, `진행도 ${n}`).toBeGreaterThanOrEqual(prev);
            prev = size;
        }
    });

    it("캠페인 끝에는 전부 열린다 — 영원히 못 사는 동료가 없다", () => {
        expect(recruitableAt(100).length).toBe(RECRUITABLE.length);
    });

    it("손상된 진행도에도 던지지 않는다 (fail-closed)", () => {
        for (const bad of [NaN, -5, undefined, null, "많이", {}]) {
            expect(() => recruitableAt(bad)).not.toThrow();
            expect(recruitableAt(bad).every((id) => recruitUnlockStage(id) === 0)).toBe(true);
        }
    });
});

describe("canRecruit — 판정은 여기 하나뿐이다", () => {
    const anyC = RECRUITABLE.find((id) => recruitUnlockStage(id) === BY_RARITY.C.unlockStage);
    const cost = recruitCost(anyC);
    const at = recruitUnlockStage(anyC);

    it("골드와 진행도가 충분하면 통과한다", () => {
        expect(canRecruit({ unitId: anyC, gold: cost, highestStage: at }).ok).toBe(true);
    });

    it("1골드가 모자라면 실패한다", () => {
        const r = canRecruit({ unitId: anyC, gold: cost - 1, highestStage: at });
        expect(r.ok).toBe(false);
        expect(r.reason).toBe("gold");
    });

    it("해금 전이면 골드가 아무리 많아도 실패한다", () => {
        const r = canRecruit({ unitId: anyC, gold: 1e9, highestStage: at - 1 });
        expect(r.ok).toBe(false);
        expect(r.reason).toBe("locked");
    });

    it("이미 보유하면 실패한다 — 두 번 사지 않는다", () => {
        const r = canRecruit({
            unitId: anyC,
            owned: { [anyC]: { level: 1 } },
            gold: 1e9,
            highestStage: 100,
        });
        expect(r.ok).toBe(false);
        expect(r.reason).toBe("owned");
    });

    it("확정 지급 동료는 살 수 없다", () => {
        const g = [...GUARANTEED][0];
        expect(canRecruit({ unitId: g, gold: 1e9, highestStage: 100 }).reason).toBe("granted");
    });

    it("모르는 id 에 던지지 않는다", () => {
        expect(canRecruit({ unitId: "ghost", gold: 1e9, highestStage: 100 }).reason).toBe(
            "unknown"
        );
        expect(() => canRecruit({})).not.toThrow();
    });

    it("★ 확률이 없다 — 같은 입력은 언제나 같은 답", () => {
        const a = canRecruit({ unitId: anyC, gold: cost, highestStage: at });
        for (let i = 0; i < 50; i++) {
            expect(canRecruit({ unitId: anyC, gold: cost, highestStage: at })).toEqual(a);
        }
    });
});
