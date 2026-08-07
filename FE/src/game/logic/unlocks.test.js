/**
 * 캠페인 확정 지급 (P8-02)
 *
 * ★ 이 파일이 지키는 명제: **진행에 필요한 최소 로스터는 뽑기 운이 아니다.**
 *
 *   이 규칙은 15-content-plan.md §1.1 이 요구했지만 **구현되어 있지 않았다.**
 *   캠페인 클리어 보상은 골드·강화석뿐이었고(노멀 첫 클리어 젬 0), 동료 획득은
 *   시작 2종 + 가챠 RNG + 배틀패스뿐이었다. `tools/playthrough.mjs` 실측:
 *   30일을 기다려 17종을 모아도 1-9 승률 0% (전체 로스터로는 33%) 인 계정이 나왔다.
 *
 * ★ '요구되기 전에 준다'는 성질은 `tools/validate-data.mjs` 가 전 스테이지에 대해
 *   검사한다. 여기서는 **규칙 자체의 불변식**을 고정한다.
 */
import { describe, it, expect } from "vitest";
import {
    STAGE_GRANTS,
    STARTING_UNITS,
    unitGrantsFor,
    guaranteedUnitsBefore,
    guaranteedUnitsUpTo,
} from "./unlocks.js";
import { globalStageIndex, UNIT_DEFS } from "./stageConfig.js";
import stagesData from "../data/stages.json" with { type: "json" };

describe("전제", () => {
    it("확정 지급이 실재한다 — 없으면 아래 검사가 전부 공회전이다", () => {
        expect(STAGE_GRANTS.length).toBeGreaterThan(0);
        expect(STARTING_UNITS.length).toBeGreaterThan(0);
    });

    it("지급 대상이 전부 실재하는 동료다", () => {
        for (const g of STAGE_GRANTS) {
            for (const u of g.units) expect(UNIT_DEFS[u], `${g.stage}: ${u}`).toBeTruthy();
        }
        for (const u of STARTING_UNITS) expect(UNIT_DEFS[u], u).toBeTruthy();
    });

    it("지급 스테이지가 전부 실재한다", () => {
        const ids = new Set(stagesData.stages.map((s) => s.id));
        for (const g of STAGE_GRANTS) expect(ids.has(g.stage), g.stage).toBe(true);
    });
});

describe("결정론 — 확률이 아니다 (절대 규칙 6)", () => {
    it("같은 스테이지는 언제나 같은 동료를 준다", () => {
        for (const g of STAGE_GRANTS) {
            expect(unitGrantsFor(g.stage)).toEqual(unitGrantsFor(g.stage));
            expect(unitGrantsFor(g.stage)).toEqual(g.units);
        }
    });

    it("지급이 없는 스테이지는 빈 배열이다 (undefined 가 아니다)", () => {
        const granted = new Set(STAGE_GRANTS.map((g) => g.stage));
        const none = stagesData.stages.find((s) => !granted.has(s.id));
        expect(unitGrantsFor(none.id)).toEqual([]);
    });

    it("반환 배열을 고쳐도 원본이 오염되지 않는다", () => {
        const g = STAGE_GRANTS[0];
        unitGrantsFor(g.stage).push("oops");
        expect(unitGrantsFor(g.stage)).toEqual(g.units);
    });
});

describe("중복 지급이 없다", () => {
    it("한 동료는 한 번만 확정 지급된다", () => {
        const seen = new Set();
        for (const g of STAGE_GRANTS) {
            for (const u of g.units) {
                expect(seen.has(u), `${u} 가 두 번 지급된다`).toBe(false);
                seen.add(u);
            }
        }
    });

    it("시작 보유분과 겹치지 않는다", () => {
        const campaign = new Set(STAGE_GRANTS.flatMap((g) => g.units));
        for (const u of STARTING_UNITS) expect(campaign.has(u), `${u} 중복`).toBe(false);
    });
});

describe("경계 — 그 스테이지의 보상은 그 스테이지를 깬 뒤에 들어온다", () => {
    /**
     * ★★ 이 검사가 이 파일에서 가장 중요하다.
     *   `guaranteedUnitsBefore` 가 `<=` 를 쓰면 "그 스테이지가 요구하는 답을
     *   그 스테이지를 깨야 얻는" 순환이 생기고, validate-data 의 핵심 검사가
     *   **그 순환을 통과시켜 버린다.** 부등호 하나가 검사 전체를 무의미하게 만든다.
     */
    it("자기 자신의 지급분은 포함하지 않는다", () => {
        for (const g of STAGE_GRANTS) {
            const have = guaranteedUnitsBefore(g.stage);
            for (const u of g.units) {
                expect(have.has(u), `${g.stage} 가 자기 보상 ${u} 를 미리 갖고 있다`).toBe(false);
            }
        }
    });

    it("바로 다음 스테이지부터는 포함한다", () => {
        const byIdx = stagesData.stages
            .slice()
            .sort((a, b) => globalStageIndex(a.id) - globalStageIndex(b.id));
        for (const g of STAGE_GRANTS) {
            const i = byIdx.findIndex((s) => s.id === g.stage);
            const next = byIdx[i + 1];
            if (!next) continue;
            const have = guaranteedUnitsBefore(next.id);
            for (const u of g.units) expect(have.has(u), `${next.id} 에 ${u} 가 없다`).toBe(true);
        }
    });

    it("시작 보유분은 첫 스테이지부터 갖고 있다", () => {
        const have = guaranteedUnitsBefore("1-1");
        for (const u of STARTING_UNITS) expect(have.has(u), u).toBe(true);
    });

    it("확정 보유는 진행에 따라 단조 증가한다", () => {
        let prev = 0;
        for (const s of stagesData.stages) {
            const n = guaranteedUnitsBefore(s.id).size;
            expect(n, s.id).toBeGreaterThanOrEqual(prev);
            prev = n;
        }
    });
});

describe("소급 지급 (세이브 마이그레이션)", () => {
    it("최고 스테이지까지의 지급분을 전부 돌려준다 — 경계는 포함(<=)이다", () => {
        // ★ before 와 달리 upTo 는 '이미 깬 것'을 세므로 자기 지급분을 포함한다.
        //   이 둘을 같은 함수로 만들면 소급이 항상 한 칸씩 모자란다.
        const g = STAGE_GRANTS[0];
        const idx = globalStageIndex(g.stage);
        const have = guaranteedUnitsUpTo(idx);
        for (const u of g.units) expect(have.has(u), u).toBe(true);
    });

    it("진행도 0 이면 시작 보유분만 갖는다", () => {
        expect([...guaranteedUnitsUpTo(0)].sort()).toEqual([...STARTING_UNITS].sort());
    });

    it("끝까지 진행한 계정은 전 지급분을 갖는다", () => {
        const all = guaranteedUnitsUpTo(9999);
        for (const g of STAGE_GRANTS) for (const u of g.units) expect(all.has(u), u).toBe(true);
    });
});

describe("편성이 성립한다", () => {
    it("방벽은 첫 스테이지부터 보유한다 — 막는 것은 BLOCKER 뿐이다", () => {
        const have = [...guaranteedUnitsBefore("1-1")].map((id) => UNIT_DEFS[id]);
        expect(have.some((u) => u.role === "BLOCKER")).toBe(true);
    });

    it("확정 지급만으로 6칸이 채워지는 시점이 존재한다", () => {
        const full = stagesData.stages.find((s) => guaranteedUnitsBefore(s.id).size >= 6);
        expect(full, "확정 지급만으로는 6칸을 끝내 못 채운다").toBeTruthy();
        // 월드 1 안에서 끝나야 한다 — 월드 2 까지 6칸이 아니면 편성 퍼즐이 시작되지 않는다
        expect(globalStageIndex(full.id)).toBeLessThanOrEqual(20);
    });
});
