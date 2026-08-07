/**
 * metaSlice 배선 테스트
 *
 * 규칙 자체는 game/logic/progression 에서 검증했다.
 * 여기서는 슬라이스가 그 규칙을 **실제로 상태에 반영하는지**만 본다 —
 * 차감 없이 지급, 이중 수령, 시간 게이트 미반영 같은 배선 사고를 잡는 자리다.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { createMetaSlice } from "./metaSlice.js";
import balance from "@/game/data/balance.json";

/** 신규 계정 시작 골드 — 수치를 여기 적지 않는다 (절대 규칙 4) */
const START_GOLD = balance.economy.startingGold;
/** @param {object} [extra] 다른 슬라이스의 스텁 */
function makeSlice(extra = null) {
    let state = {};
    const get = () => state;
    const set = (patch) => {
        const next = typeof patch === "function" ? patch(state) : patch;
        state = { ...state, ...next };
    };
    state = { ...createMetaSlice(set, get), ...extra };
    return { get, set };
}



describe("metaSlice — 재화", () => {
    let s;
    beforeEach(() => {
        s = makeSlice();
    });

    it("잔액이 음수로 내려가지 않는다", () => {
        s.get().addCurrency("gold", -500);
        expect(s.get().meta.currencies.gold).toBe(0);
    });

    it("잔액이 모자라면 차감 없이 실패한다", () => {
        const before = s.get().meta.currencies.gold;
        expect(s.get().spendCurrency("gold", before + 100)).toBe(false);
        expect(s.get().meta.currencies.gold).toBe(before);
    });

    it("★ 신규 계정은 시작 골드를 갖는다 — FTUE 1-3 강화가 그것을 요구한다", () => {
        expect(s.get().meta.currencies.gold).toBe(START_GOLD);
    });

    it("★ 재화는 골드 하나다 (2026-08-04 경량화)", () => {
        expect(Object.keys(s.get().meta.currencies)).toEqual(["gold"]);
    });
});

describe("metaSlice — 방주 시설", () => {
    let s;
    beforeEach(() => {
        s = makeSlice();
        s.get().addCurrency("gold", 10_000_000);
        s.get().recordStageClear("2-10", 3); // highestStage 30 — 시설 해금
    });

    it("해금 전에는 올릴 수 없다", () => {
        const fresh = makeSlice();
        fresh.get().addCurrency("gold", 10_000_000);
        expect(fresh.get().canUpgradeArk("archive").reason).toBe("locked");
    });

    it("★ 즉시 완료된다 — 건설 시간 게이트가 사라졌다 (2026-08-04)", () => {
        const before = s.get().meta.ark.trainingYard;
        expect(s.get().upgradeArk("trainingYard").ok).toBe(true);
        expect(s.get().meta.ark.trainingYard).toBe(before + 1);
    });

    it("골드를 실제로 차감한다", () => {
        const gold = s.get().meta.currencies.gold;
        s.get().upgradeArk("trainingYard");
        expect(s.get().meta.currencies.gold).toBeLessThan(gold);
    });

    it("골드가 모자라면 올라가지 않는다", () => {
        const poor = makeSlice();
        poor.get().recordStageClear("2-10", 3);
        poor.get().spendCurrency("gold", poor.get().meta.currencies.gold);
        const r = poor.get().canUpgradeArk("trainingYard");
        expect(r.ok).toBe(false);
        expect(r.reason).toBe("gold");
    });

    it("만렙에서 멈춘다", () => {
        s.set((st) => ({ meta: { ...st.meta, ark: { ...st.meta.ark, sanctum: 25 } } }));
        expect(s.get().canUpgradeArk("sanctum").reason).toBe("max");
    });
});

describe("metaSlice — 별 트리", () => {
    let s;
    beforeEach(() => {
        s = makeSlice();
    });

    it("획득한 별만큼만 쓸 수 있다", () => {
        s.get().recordStageClear("1-1", 3);
        s.get().recordStageClear("1-2", 3);
        expect(s.get().getStars().available).toBe(6);
        expect(s.get().buyStarNode("atk_1")).toBe(true);
        expect(s.get().getStars().available).toBe(3);
        expect(s.get().buyStarNode("atk_1")).toBe(true);
        expect(s.get().getStars().available).toBe(0);
        expect(s.get().buyStarNode("atk_1")).toBe(false);
    });

    it("별 재획득은 최고 기록만 반영한다 — 반복 클리어로 별을 무한 벌 수 없다", () => {
        s.get().recordStageClear("1-1", 3);
        s.get().recordStageClear("1-1", 1);
        expect(s.get().getStars().earned).toBe(3);
    });

    it("선행 노드 없이는 잠겨 있다", () => {
        for (let i = 1; i <= 10; i++) s.get().recordStageClear(`1-${i}`, 3);
        expect(s.get().buyStarNode("pierce_1")).toBe(false);
    });
});

describe("metaSlice — 난이도 (P6-10)", () => {
    let s;
    /** 월드 1 을 노멀로 전부 클리어한 세이브 */
    const clearWorld1Normal = (slice, stars = 3) => {
        for (let i = 1; i <= 20; i++) slice.get().recordStageClear(`1-${i}`, stars);
    };

    beforeEach(() => {
        s = makeSlice();
    });

    it("월드를 노멀로 다 깨야 하드가 열린다", () => {
        expect(s.get().getDifficultyProgress("hard", 1).unlocked).toBe(false);
        clearWorld1Normal(s);
        expect(s.get().getDifficultyProgress("hard", 1).unlocked).toBe(true);
        // 월드 2 는 그대로 잠겨 있다
        expect(s.get().getDifficultyProgress("hard", 2).unlocked).toBe(false);
    });

    it("잠긴 난이도를 골라도 전투는 노멀로 시작한다", () => {
        s.get().setDifficulty("hard");
        expect(s.get().resolveDifficulty("1-5")).toBe("normal");
        clearWorld1Normal(s);
        expect(s.get().resolveDifficulty("1-5")).toBe("hard");
        // 해금되지 않은 월드의 스테이지는 여전히 노멀
        expect(s.get().resolveDifficulty("2-5")).toBe("normal");
    });

    it("미구현 난이도는 세이브를 손대도 전투로 내려가지 않는다", () => {
        s.set((st) => ({ meta: { ...st.meta, selectedDifficulty: "nightmare" } }));
        expect(s.get().resolveDifficulty("1-5")).toBe("normal");
    });

    /**
     * ★★ 돌파 시험은 **전역 선택 난이도를 건드리지 않는다.**
     *   예전에는 TrialScreen 이 `setDifficulty("hard")` 로 전역값을 바꾸고 되돌리지
     *   않아, 시험을 한 번 시도한 뒤로는 하드가 열린 모든 월드의 캠페인 출격이
     *   조용히 하드로 시작됐다. 되돌리면(요청 난이도 인자를 지우면) 이 테스트가 깨진다.
     */
    it("★★ 요청 난이도는 이번 출격에만 쓰이고 선택값을 바꾸지 않는다", () => {
        clearWorld1Normal(s);
        expect(s.get().meta.selectedDifficulty).toBe("normal");
        expect(s.get().resolveDifficulty("1-5", "hard")).toBe("hard");
        // 전역 선택값은 그대로다
        expect(s.get().meta.selectedDifficulty).toBe("normal");
        expect(s.get().resolveDifficulty("1-5")).toBe("normal");
    });

    it("★ 요청 난이도도 해금·구현 검증을 **같은 경로로** 지난다", () => {
        // 월드 1 만 클리어한 상태에서 월드 2 를 하드로 요청 → 노멀로 떨어진다
        clearWorld1Normal(s);
        expect(s.get().resolveDifficulty("2-5", "hard")).toBe("normal");
        expect(s.get().resolveDifficulty("1-5", "nightmare")).toBe("normal");
    });

    it("하드 별은 노멀 별과 **더해진다** — 재도전이 별을 준다", () => {
        s.get().recordStageClear("1-1", 3);
        s.get().recordStageClear("1-1", 3, "hard");
        expect(s.get().getStars().earned).toBe(6);
        expect(s.get().getStageStars("1-1")).toBe(3);
        expect(s.get().getStageStars("1-1", "hard")).toBe(3);
    });

    it("하드 반복 클리어로 별을 무한히 벌 수 없다", () => {
        s.get().recordStageClear("1-1", 3, "hard");
        s.get().recordStageClear("1-1", 1, "hard");
        expect(s.get().getStars().earned).toBe(3);
    });

    it("하드 보상이 노멀보다 크다", () => {
        const n = makeSlice();
        const h = makeSlice();
        const rn = n.get().claimStageReward("1-10", 3, "normal");
        const rh = h.get().claimStageReward("1-10", 3, "hard");

        expect(rh.gold).toBeGreaterThan(rn.gold);
        expect(n.get().meta.currencies.gold).toBe(START_GOLD + rn.gold);
    });

    it("첫 클리어 보너스는 한 번만 나온다 (반복 수령 구멍 차단)", () => {
        const first = s.get().claimStageReward("1-10", 3, "hard");
        const again = s.get().claimStageReward("1-10", 3, "hard");
        expect(first.firstClear).toBe(true);
        expect(again.firstClear).toBe(false);
        expect(again.gold).toBeLessThan(first.gold);
    });
});

describe("metaSlice — 세이브 호환", () => {
    it("구버전 세이브에 없던 필드를 채운다", () => {
        const s = makeSlice();
        s.set((st) => ({
            meta: {
                ...st.meta,
                ark: { trainingYard: 3 }, // 신규 시설 키 없음
                starTree: undefined,
                // v2 이하 세이브에는 난이도 필드가 아예 없다 (P6-10)
                difficultyStars: undefined,
                selectedDifficulty: undefined,
            },
        }));
        expect(() => s.get().normalizeMeta()).not.toThrow();
        expect(s.get().meta.ark.archive).toBe(0);
        expect(s.get().meta.ark.trainingYard).toBe(3);
        expect(s.get().meta.ark.armory).toBe(0);
        expect(s.get().meta.starTree).toEqual({});
        expect(s.get().meta.difficultyStars).toEqual({});
        expect(s.get().meta.selectedDifficulty).toBe("normal");
        // 난이도 필드가 비어 있어도 별 계산과 해금 판정이 터지지 않아야 한다
        expect(() => s.get().getStars()).not.toThrow();
        expect(s.get().resolveDifficulty("1-1")).toBe("normal");
    });
});
