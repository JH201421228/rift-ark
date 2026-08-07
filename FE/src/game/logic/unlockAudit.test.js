/**
 * 해금 전수 검사 (P8-03)
 *
 * ★★ 이 파일이 지키는 명제는 넷이다.
 *   ① 진행하면 열린 것이 **절대 줄지 않는다** (거꾸로 잠금 = 세이브에 남는 최악의 회귀)
 *   ② 선언된 해금은 **언젠가 열린다** (죽은 콘텐츠 0)
 *   ③ 열린 콘텐츠는 그 시점에 **실제로 들어갈 수 있다**
 *   ④ 진행도가 **NaN 으로 오염되지 않는다** — 그 한 번이 전 해금을 무너뜨린다
 *
 * ★★ 검사기 자체가 죽었는지 확인한다. 각 검사에 **일부러 위반한 입력**을 넣어
 *   발동을 확인하는 짝 테스트가 붙어 있다 — 실제 데이터만 보는 검사는
 *   조용히 통과하는 것과 조용히 죽은 것을 구분할 수 없다.
 */
import { describe, it, expect } from "vitest";
import {
    MAX_STAGE,
    PROFILES,
    auditPrerequisites,
    declaredUnlockKeys,
    findLockBacks,
    findUnreachable,
    firstOpenAt,
    isCampaignStageIndex,
    minStarsForNode,
    runUnlockAudit,
    starsEarnedAt,
    sweep,
    unlocksAt,
} from "./unlockAudit.js";
import { globalStageIndex } from "./difficulty.js";
import { FACILITIES } from "./progression.js";
import { guaranteedUnitsUpTo } from "./unlocks.js";
import { createMetaSlice } from "@/store/slices/metaSlice.js";
import { startingOwned } from "@/store/slices/rosterSlice.js";

const errorsOf = (findings) => findings.filter((f) => f.severity === "error");
const fmt = (findings) => findings.map((f) => `[${f.code}] ${f.at}: ${f.message}`).join("\n");

/* ═══════════════════════ 전제 ═══════════════════════ */

describe("전제", () => {
    it("캠페인 전 구간을 스윕한다 — 범위가 비면 아래 검사가 전부 공회전이다", () => {
        expect(MAX_STAGE).toBeGreaterThanOrEqual(100);
        expect(sweep().length).toBe(MAX_STAGE + 1);
    });

    it("진행도 0 에서도 무언가는 열려 있다 (시작 로스터 · 상시 상품)", () => {
        expect(unlocksAt(0).size).toBeGreaterThan(0);
    });

    it("선언된 해금이 실재한다", () => {
        expect(declaredUnlockKeys().size).toBeGreaterThan(20);
    });
});

/* ═══════════════════════ ① 단조성 ═══════════════════════ */

describe("① 단조성 — 진행이 해금을 되돌리지 않는다", () => {
    for (const profile of PROFILES) {
        it(`${profile} 프로필: 0 → ${MAX_STAGE} 구간에 거꾸로 잠김이 없다`, () => {
            const found = findLockBacks(sweep({ profile }));
            expect(fmt(found)).toBe("");
        });
    }

    it("★ 검사가 실제로 발동한다 — 사라진 키를 넣으면 잡는다", () => {
        const rows = [
            { stage: 0, keys: new Set(["ark.armory", "ark.sanctum"]) },
            { stage: 1, keys: new Set(["ark.sanctum"]) },
        ];
        const found = findLockBacks(rows);
        expect(found).toHaveLength(1);
        expect(found[0].code).toBe("lock-back");
        expect(found[0].message).toContain("ark.armory");
    });

    it("해금은 진행도의 함수다 — 같은 진행도는 언제나 같은 결과를 준다", () => {
        expect([...unlocksAt(42)].sort()).toEqual([...unlocksAt(42)].sort());
    });

    it("확정 지급 동료도 되돌아가지 않는다", () => {
        let prev = 0;
        for (let n = 0; n <= MAX_STAGE; n++) {
            const size = guaranteedUnitsUpTo(n).size;
            expect(size, `진행도 ${n}`).toBeGreaterThanOrEqual(prev);
            prev = size;
        }
    });
});

/* ═══════════════════════ ② 도달성 ═══════════════════════ */

describe("② 도달성 — 영원히 안 열리는 해금이 없다", () => {
    it("선언된 해금이 전부 완주 시점에 열려 있다", () => {
        const rows = sweep();
        const found = findUnreachable(rows[rows.length - 1].keys);
        expect(fmt(found)).toBe("");
    });

    it("★ 검사가 실제로 발동한다 — 아무도 열지 않는 키를 선언하면 잡는다", () => {
        const found = findUnreachable(new Set(["ark.armory"]), new Set(["ark.armory", "ghost.town"]));
        expect(found).toHaveLength(1);
        expect(found[0].at).toBe("ghost.town");
    });

    it("방주 시설은 데이터가 적은 시점에 열린다 — 검사기가 두 번째 출처가 아니다", () => {
        const open = firstOpenAt(sweep());
        for (const f of FACILITIES) {
            expect(open.get(`ark.${f.id}`), f.id).toBe(f.unlockStage);
        }
    });

    it("하드 난이도는 월드 1을 다 깬 시점에 열린다", () => {
        const open = firstOpenAt(sweep());
        const firstHard = Math.min(
            ...[...open].filter(([k]) => k.startsWith("difficulty.hard.")).map(([, v]) => v)
        );
        expect(firstHard).toBe(20);
    });
});

/* ═══════════════════════ ③ 선행 정합 ═══════════════════════ */

describe("③ 선행 정합 — 열렸으면 들어갈 수 있다", () => {
    it("선행 검사에 오류가 없다", () => {
        expect(fmt(errorsOf(auditPrerequisites()))).toBe("");
    });

    it("별 트리 노드는 전부 도달 가능한 별 예산 안에 있다", () => {
        const budget = starsEarnedAt(MAX_STAGE, "complete");
        for (const key of declaredUnlockKeys()) {
            if (!key.startsWith("star.")) continue;
            expect(minStarsForNode(key.slice(5)), key).toBeLessThanOrEqual(budget);
        }
    });

    it("별 트리 선행 비용 계산이 사슬을 따라간다 (사이클에도 멈춘다)", () => {
        // atk_2 는 atk_1 을 요구하므로 자기 비용보다 반드시 크다
        expect(minStarsForNode("atk_2")).toBeGreaterThan(minStarsForNode("atk_1"));
        expect(minStarsForNode("없는노드")).toBe(0);
    });
});

/* ═══════════════════════ ④ 신규 계정 ═══════════════════════ */

describe("신규 계정 — 확정 지급이 실제로 손에 들어온다", () => {
    /**
     * ★★ 예전에는 `roster.owned` 초기값이 `{}` 였다. 즉 신규 계정은 동료를 한 종도
     *   갖지 않았는데, `logic/unlocks.js` · `tools/validate-data.mjs` ·
     *   `tools/playthrough.mjs` 는 전부 "1-1 전에 시작 2종을 보유한다"를 **전제**하고
     *   그 위에서 통과하고 있었다. 검증 도구가 플레이어와 다른 것을 재고 있었다.
     */
    it("시작 보유가 진행도 0 의 확정 지급과 정확히 같다", () => {
        expect(Object.keys(startingOwned()).sort()).toEqual([...guaranteedUnitsUpTo(0)].sort());
    });

    it("시작 보유가 비어 있지 않다 — 비면 1-1 을 편성할 수 없다", () => {
        expect(Object.keys(startingOwned()).length).toBeGreaterThan(0);
    });

    it("시작 보유 동료가 전부 온전한 형태다 (레벨 결손이 없다)", () => {
        for (const [id, u] of Object.entries(startingOwned())) {
            expect(u.level, id).toBe(1);
            // ★ 필드는 level 하나뿐이다 (2026-08-04 경량화 — rosterSlice.blankUnit)
            expect(Object.keys(u), id).toEqual(["level"]);
        }
    });
});

/* ═══════════════════════ 진행도 오염 (NaN) ═══════════════════════ */

/** metaSlice 하나만 세운 최소 스토어 (store/slices/metaSlice.test.js 와 같은 방식) */
function makeMeta() {
    let state = {};
    const get = () => state;
    const set = (patch) => {
        const next = typeof patch === "function" ? patch(state) : patch;
        state = { ...state, ...next };
    };
    state = createMetaSlice(set, get);
    return get;
}

describe("★ 진행도가 NaN 으로 오염되지 않는다 — 그 한 번이 전 해금을 무너뜨린다", () => {
    it("캠페인 id 만 캠페인 순번으로 읽힌다", () => {
        expect(isCampaignStageIndex("1-1")).toBe(true);
        expect(isCampaignStageIndex("5-20")).toBe(true);
        expect(isCampaignStageIndex("tower-12")).toBe(false);
        expect(isCampaignStageIndex("vault")).toBe(false);
        expect(isCampaignStageIndex(undefined)).toBe(false);
    });

    it("비캠페인 id 는 globalStageIndex 가 숫자를 만들지 못한다 (전제)", () => {
        expect(Number.isFinite(globalStageIndex("tower-12"))).toBe(false);
    });

    /**
     * ★★ 던전 · 탑은 2026-08-04 경량화로 사라졌지만 **이 검사는 남긴다.**
     *   `recordStageClear` 의 fail-closed 는 "캠페인 순번으로 읽히지 않는 id 는
     *   아무것도 기록하지 않는다"는 일반 규칙이고, 이벤트 · 딥링크 · 다음에 생길
     *   무엇이든 같은 경로를 탄다. 지우면 그 가드가 왜 있는지 아무도 모르게 된다.
     */
    it("캠페인이 아닌 id 를 기록해도 highestStage 가 살아남는다", () => {
        const get = makeMeta();
        get().recordStageClear("2-10", 3);
        expect(get().meta.highestStage).toBe(30);

        get().recordStageClear("tower-12", 3);
        expect(get().meta.highestStage).toBe(30);
        expect(Number.isFinite(get().meta.highestStage)).toBe(true);
        expect(get().meta.stageStars["tower-12"]).toBeUndefined();
    });

    it("캠페인이 아닌 id 에 보상을 청구해도 재화가 NaN 이 되지 않는다", () => {
        // ★ 진행도와 재화는 다른 함수에서 온다 — recordStageClear 만 막으면
        //   stageReward 가 만든 NaN 골드가 addCurrency 를 통과한다.
        const get = makeMeta();
        const before = get().meta.currencies.gold;
        const r = get().claimStageReward("tower-7", 3);
        expect(r.gold).toBe(0);
        expect(get().meta.currencies.gold).toBe(before);
    });

    it("NaN 이 highestStage 에 들어가면 해금이 전부 닫힌다 (그래서 막아야 한다)", () => {
        const broken = unlocksAt(Number.NaN);
        expect(broken.has("ark.armory")).toBe(false);
        expect(broken.has("ark.sanctum")).toBe(false);
    });

    it("정상 캠페인 클리어는 그대로 기록된다 (막느라 막지 말아야 할 것을 막지 않았다)", () => {
        const get = makeMeta();
        get().recordStageClear("1-1", 2);
        expect(get().meta.highestStage).toBe(1);
        expect(get().meta.stageStars["1-1"]).toBe(2);
        get().recordStageClear("1-1", 1); // 별은 내려가지 않는다
        expect(get().meta.stageStars["1-1"]).toBe(2);
    });
});

/* ═══════════════════════ 전체 ═══════════════════════ */

describe("전체 검사", () => {
    it("runUnlockAudit 에 오류 등급 결함이 없다", () => {
        expect(fmt(errorsOf(runUnlockAudit().findings))).toBe("");
    });

    it("두 프로필을 모두 돌린다 — 하드를 안 켠 계정도 같이 검사한다", () => {
        const { byProfile } = runUnlockAudit();
        for (const p of PROFILES) expect(byProfile[p], p).toBeTruthy();
    });
});
