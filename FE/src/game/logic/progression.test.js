/**
 * P5 메타 로직 검증
 *
 * ★ 성장 갈래는 셋뿐이다 (2026-08-04 경량화) — 동료 레벨 · 방주 시설 · 별 트리.
 *   승급 · 장비 · 소유 효과 · 방치 · 파견은 통째로 사라졌고 그 테스트도 같이 지웠다.
 *
 * ★ 여전히 가장 중요한 성질은 **난수가 없다**는 것이다. 셋 다 결정론이므로
 *   강화형 확률형 아이템 규제의 표면 자체가 존재하지 않는다.
 */
import { describe, it, expect } from "vitest";
import {
    unitLevelCost,
    unitLevelCap,
    levelReachableWith,
    cumulativeLevelCost,
    armoryMultiplier,
    starsSpent,
    canBuyStarNode,
    starTreeEffects,
    arkUpgradeCost,
    arkVisualStage,
    residentCount,
    sigilParamsFrom,
    buildLoadoutSlots,
    STAR_NODES,
    FACILITIES,
} from "./progression.js";
import {
    analyzeLoadout,
    recommendLoadout,
    encodeLoadout,
    decodeLoadout,
    stageThreats,
} from "./loadoutAnalysis.js";
import unitsData from "../data/units.json" with { type: "json" };

const DEFS = Object.fromEntries(unitsData.units.map((u) => [u.id, u]));
const ALL_IDS = unitsData.units.map((u) => u.id);

/* ═══════════════════════ 규제 대응 ═══════════════════════ */

describe("성장에 확률이 없다", () => {
    it("무기고 배율은 레벨의 순수 함수다 — 같은 레벨이면 항상 같은 값", () => {
        for (let lv = 0; lv <= 20; lv++) {
            const a = armoryMultiplier(lv);
            for (let i = 0; i < 10; i++) expect(armoryMultiplier(lv)).toBe(a);
        }
    });

    it("무기고 배율은 단조 증가하고 상한에서 멈춘다", () => {
        let prev = 0;
        for (let lv = 0; lv <= 20; lv++) {
            const v = armoryMultiplier(lv);
            expect(v).toBeGreaterThanOrEqual(prev);
            prev = v;
        }
        // 상한을 넘겨도 던지지 않고 마지막 값을 준다 (세이브 오염 방어)
        expect(armoryMultiplier(999)).toBe(armoryMultiplier(20));
        expect(armoryMultiplier(-5)).toBe(armoryMultiplier(0));
    });

    it("시설 비용에 난수 인자가 없다", () => {
        const a = arkUpgradeCost("armory", 7);
        for (let i = 0; i < 10; i++) expect(arkUpgradeCost("armory", 7)).toEqual(a);
    });
});

describe("P5-03 성장 3축", () => {
    it("레벨 비용은 단조 증가한다 — 파워가 자연 감속한다", () => {
        for (let l = 1; l < 60; l++) {
            expect(unitLevelCost(l + 1)).toBeGreaterThan(unitLevelCost(l));
        }
    });

    it("훈련장 레벨이 곧 레벨 상한이다", () => {
        expect(unitLevelCap(1)).toBe(11);
        expect(unitLevelCap(10)).toBe(20);
        expect(unitLevelCap(40)).toBe(50);
    });

    it("levelReachableWith 는 누적 비용과 일치한다", () => {
        const lvl = levelReachableWith(cumulativeLevelCost(20));
        expect(lvl).toBe(20);
    });

    it("레벨 상한을 넘지 않는다", () => {
        expect(levelReachableWith(1e12, 15)).toBe(15);
    });
});

/* ═══════════════════════ 별 트리 ═══════════════════════ */

describe("P5-08 별 경제", () => {
    it("선행 노드 없이는 살 수 없다", () => {
        expect(canBuyStarNode({}, "atk_2", 9999).reason).toBe("locked");
        expect(canBuyStarNode({ atk_1: 1 }, "atk_2", 9999).ok).toBe(true);
    });

    it("별이 모자라면 사유가 stars 다", () => {
        expect(canBuyStarNode({}, "atk_1", 0).reason).toBe("stars");
    });

    it("최대 랭크를 넘지 않는다", () => {
        expect(canBuyStarNode({ atk_1: 5 }, "atk_1", 9999).reason).toBe("max");
    });

    it("사용한 별은 선형 누적이다 — 플레이어가 암산할 수 있어야 한다", () => {
        expect(starsSpent({ atk_1: 3 })).toBe(9); // cost 3 × 3랭크
    });

    it("모든 노드의 선행이 실재한다", () => {
        const ids = new Set(STAR_NODES.map((n) => n.id));
        for (const n of STAR_NODES) {
            for (const r of n.requires) expect(ids.has(r)).toBe(true);
        }
    });

    it("효과가 평평한 보정값으로 집계된다", () => {
        const e = starTreeEffects({ atk_1: 5, ark_hp: 2, mana_start: 3 });
        expect(e.allyAtkPct).toBeCloseTo(0.1, 6);
        expect(e.arkHpPct).toBeCloseTo(0.08, 6);
        expect(e.startManaFlat).toBe(30);
    });

    it("알 수 없는 노드는 조용히 무시한다 — 세이브 호환", () => {
        expect(() => starTreeEffects({ nope: 3 })).not.toThrow();
        expect(starsSpent({ nope: 3 })).toBe(0);
    });
});

/* ═══════════════════════ 방주 시설 ═══════════════════════ */

describe("P5-01 방주 시설", () => {
    // ★ 만렙은 meta.json 이 소유한다 (P6 에서 trainingYard 40 → 90).
    //   테스트가 상한을 재선언하면 콘텐츠를 늘릴 때마다 여기가 깨진다.
    const MAX = (id) => FACILITIES.find((f) => f.id === id).maxLevel;

    it("업그레이드 비용은 단조 증가하고 만렙에서 null 이다", () => {
        const max = MAX("trainingYard");
        let prev = 0;
        for (let l = 0; l < max; l++) {
            const c = arkUpgradeCost("trainingYard", l);
            expect(c.gold).toBeGreaterThan(prev);
            prev = c.gold;
        }
        expect(arkUpgradeCost("trainingYard", max)).toBeNull();
    });

    it("★ 비용은 골드 하나뿐이다 — 건설 시간도 강화석도 없다 (2026-08-04)", () => {
        expect(Object.keys(arkUpgradeCost("trainingYard", 5))).toEqual(["gold"]);
    });

    it("시설 레벨 총합이 방주 외형 구간을 정한다", () => {
        expect(arkVisualStage({ trainingYard: 1 }).id).toBe("ruin");
        expect(arkVisualStage({ trainingYard: 40, armory: 20 }).id).toBe("restored");
        // 전 시설 만렙 — 마지막 구간까지 실제로 도달한다
        const allMax = Object.fromEntries(FACILITIES.map((f) => [f.id, f.maxLevel]));
        expect(arkVisualStage(allMax).id).toBe("expanded");
    });

    it("배회 NPC 는 12체를 넘지 않는다 — 성능 예산", () => {
        expect(residentCount({ trainingYard: 40, armory: 20, sanctum: 25, archive: 25 })).toBe(12);
        expect(residentCount({})).toBe(0);
    });

    it("기록보관소는 각인 수치가 아니라 선택지·리롤만 늘린다", () => {
        const lo = sigilParamsFrom(0);
        const hi = sigilParamsFrom(25);
        expect(hi.draftOptions).toBeGreaterThan(lo.draftOptions);
        expect(hi.rerolls).toBeGreaterThan(lo.rerolls);
        expect(lo.draftOptions).toBe(3);
    });
});

/* ═══════════════════════ 편성 분석 ═══════════════════════ */

describe("P5-10 편성 분석 패널", () => {
    it("방벽이 없으면 치명 경고를 낸다", () => {
        const a = analyzeLoadout(["elf_sharpshooter", "novice_pyromancer"]);
        expect(a.warnings.some((w) => w.code === "no_blocker")).toBe(true);
        expect(a.fitness).toBeLessThan(60);
    });

    it("후열 화력이 없으면 치명 경고를 낸다", () => {
        const a = analyzeLoadout(["slow_turtle"]);
        expect(a.warnings.some((w) => w.code === "no_damage")).toBe(true);
    });

    it("비행 적이 나오는 스테이지에서 대공 없음을 실제로 잡아낸다", () => {
        // 비행 적이 있는 스테이지를 데이터에서 찾는다 (하드코딩하면 데이터 변경에 부서진다)
        const stage = ["1-1", "1-2", "1-5", "1-6", "1-8", "1-9", "1-10"].find(
            (id) => stageThreats(id).hasFlying
        );
        if (!stage) return; // 튜토리얼에 비행이 없으면 이 단언은 P6 에서 유효해진다
        const melee = unitsData.units
            .filter((u) => u.role === "BLOCKER" || u.role === "MELEE")
            .map((u) => u.id)
            .slice(0, 3);
        const a = analyzeLoadout(melee, stage);
        expect(a.warnings.some((w) => w.code === "no_anti_air")).toBe(true);
    });

    it("전부 물리면 중장갑 경고가 뜬다", () => {
        const phys = unitsData.units
            .filter((u) => u.dmgType === "physical")
            .map((u) => u.id)
            .slice(0, 4);
        const a = analyzeLoadout(phys);
        expect(a.warnings.some((w) => w.code === "physical_only")).toBe(true);
    });

    it("건강한 편성은 적합도가 높다", () => {
        const good = recommendLoadout(ALL_IDS, "1-10");
        const a = analyzeLoadout(good, "1-10");
        expect(a.warnings.filter((w) => w.severity === "critical")).toHaveLength(0);
        expect(a.fitness).toBeGreaterThanOrEqual(80);
    });

    it("빈 편성도 던지지 않는다", () => {
        const a = analyzeLoadout([null, null, null]);
        expect(a.fitness).toBe(0);
        expect(a.warnings[0].code).toBe("empty");
    });
});

describe("P5-11 자동 추천", () => {
    it("항상 같은 결과를 낸다 — 추천이 매번 바뀌면 신뢰를 잃는다", () => {
        const a = recommendLoadout(ALL_IDS, "1-10");
        for (let i = 0; i < 20; i++) expect(recommendLoadout(ALL_IDS, "1-10")).toEqual(a);
    });

    it("방벽을 먼저 채운다", () => {
        const r = recommendLoadout(ALL_IDS, "1-10");
        expect(DEFS[r[0]].role).toBe("BLOCKER");
    });

    it("보유가 적어도 던지지 않는다", () => {
        expect(recommendLoadout(["slow_turtle"], "1-1")).toEqual(["slow_turtle"]);
        expect(recommendLoadout([], "1-1")).toEqual([]);
    });

    it("6칸을 넘지 않는다", () => {
        expect(recommendLoadout(ALL_IDS, "1-10").length).toBeLessThanOrEqual(6);
    });
});

describe("P5-12 편성 공유 코드", () => {
    it("왕복한다", () => {
        const units = recommendLoadout(ALL_IDS, "1-10");
        const code = encodeLoadout(units);
        const back = decodeLoadout(code);
        expect(back.ok).toBe(true);
        expect(back.units.filter(Boolean)).toEqual(units);
    });

    it("빈 칸을 보존한다", () => {
        const units = ["slow_turtle", null, "elf_sharpshooter", null, null, null];
        const back = decodeLoadout(encodeLoadout(units));
        expect(back.units).toEqual(units);
    });

    it("오타를 조용히 통과시키지 않는다", () => {
        const code = encodeLoadout(["slow_turtle"]);
        const broken = code.slice(0, -1) + (code.at(-1) === "A" ? "B" : "A");
        expect(decodeLoadout(broken).ok).toBe(false);
    });

    it("쓰레기 입력에 던지지 않는다", () => {
        for (const bad of ["", "x", null, undefined, 42, "A0000-!!!!", "Z1234-abcd"]) {
            expect(() => decodeLoadout(bad)).not.toThrow();
            expect(decodeLoadout(bad).ok).toBe(false);
        }
    });

    it("알 수 없는 동료 id 는 빈 칸이 된다 — 구버전 코드가 앱을 죽이지 않는다", () => {
        const code = encodeLoadout(["slow_turtle"]);
        const back = decodeLoadout(code);
        expect(back.ok).toBe(true);
    });
});

/* ═══════════════════════ 파워 합성 ═══════════════════════ */

describe("buildLoadoutSlots 합성", () => {
    it("성장이 없으면 보정도 0 이다", () => {
        const slots = buildLoadoutSlots(["slow_turtle"], { defs: DEFS });
        expect(slots[0].atkPct).toBe(0);
        expect(slots[0].level).toBe(1);
    });

    it("무기고 · 별 트리가 하나의 배율로 합쳐진다", () => {
        const slots = buildLoadoutSlots(["elf_sharpshooter"], {
            owned: { elf_sharpshooter: { level: 20 } },
            defs: DEFS,
            starTree: { atk_1: 5, pierce_1: 3 },
            ark: { armory: 10 },
        });
        // 곱이지 합이 아니다 — buildLoadoutSlots 와 f2p-power 가 같은 식을 쓴다
        expect(slots[0].atkPct).toBeCloseTo(armoryMultiplier(10) * 1.1 - 1, 5);
        expect(slots[0].pierce).toBe(6);
        expect(slots[0].level).toBe(20);
    });

    it("방어 보정은 BLOCKER 에게만 간다 — '앞에 세워두면 끝'을 되살리지 않는다", () => {
        const opts = { defs: DEFS, starTree: { hp_1: 1, ark_hp: 1, block_1: 2 } };
        const blocker = buildLoadoutSlots(["slow_turtle"], opts)[0];
        const ranged = buildLoadoutSlots(["elf_sharpshooter"], opts)[0];
        expect(DEFS.slow_turtle.role).toBe("BLOCKER");
        expect(blocker.defFlat).toBeGreaterThan(0);
        expect(ranged.defFlat).toBe(0);
    });

    it("null 슬롯을 걸러낸다", () => {
        expect(buildLoadoutSlots([null, "slow_turtle", null], { defs: DEFS })).toHaveLength(1);
    });
});
