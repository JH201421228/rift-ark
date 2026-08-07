/**
 * 캠페인 진행 게이트.
 *
 * ★★ 이 파일이 지키는 명제는 하나다: **캠페인은 순서대로만 열린다.**
 *   되돌리면(게이트를 지우면) 후반 스테이지를 딥링크로 한 번 이기는 것만으로
 *   던전·탑·하드·방주 시설이 한꺼번에 열린다 —
 *   `metaSlice.recordStageClear` 가 `max(prev, globalIndex)` 이기 때문이다.
 */
import { describe, it, expect } from "vitest";
import {
    CAMPAIGN_STAGE_IDS,
    LAST_STAGE_INDEX,
    canEnterStage,
    nextStageId,
    nextStageIndex,
    stageMark,
} from "./stageUnlock.js";
import { globalStageIndex } from "./difficulty.js";

describe("캠페인 진행 게이트", () => {
    it("데이터에서 스테이지를 읽는다 — 목록이 비면 검사 전체가 무의미하다", () => {
        expect(CAMPAIGN_STAGE_IDS.length).toBeGreaterThan(50);
        expect(LAST_STAGE_INDEX).toBe(CAMPAIGN_STAGE_IDS.length);
    });

    it("신규 계정(0)에게 1-1 은 열려 있고 1-2 는 잠겨 있다", () => {
        expect(canEnterStage("1-1", 0)).toBe(true);
        expect(canEnterStage("1-2", 0)).toBe(false);
    });

    it("★ 한 칸씩만 열린다 — 진행도 n 에서 열린 스테이지는 정확히 n+1 개다", () => {
        for (const n of [0, 1, 5, 19, 20, 47, LAST_STAGE_INDEX]) {
            const open = CAMPAIGN_STAGE_IDS.filter((id) => canEnterStage(id, n));
            expect(open.length, `진행도 ${n}`).toBe(Math.min(n + 1, LAST_STAGE_INDEX));
        }
    });

    it("★ 딥링크로 후반 스테이지를 열 수 없다 — 이 명제가 해금 사다리 전체를 떠받친다", () => {
        expect(canEnterStage("5-20", 0)).toBe(false);
        expect(canEnterStage("3-1", 10)).toBe(false);
        // 25(던전) · 40(탑) 해금선을 건너뛰는 진입이 막힌다
        expect(canEnterStage("2-6", 0)).toBe(false);
        expect(canEnterStage("2-20", 24)).toBe(false);
    });

    it("이미 깬 스테이지는 계속 열려 있다 — 반복 플레이가 별 트리의 재화원이다", () => {
        for (const id of CAMPAIGN_STAGE_IDS.slice(0, 30)) {
            expect(canEnterStage(id, 30)).toBe(true);
        }
    });

    it("단조성 — 진행할수록 열린 스테이지가 줄어들지 않는다", () => {
        let prev = 0;
        for (let n = 0; n <= LAST_STAGE_INDEX; n++) {
            const open = CAMPAIGN_STAGE_IDS.filter((id) => canEnterStage(id, n)).length;
            expect(open).toBeGreaterThanOrEqual(prev);
            prev = open;
        }
    });

    it("캠페인 순번으로 읽히지 않는 id 는 이 규칙의 대상이 아니다 (탑은 자기 규칙이 막는다)", () => {
        expect(canEnterStage("tower-12", 0)).toBe(true);
        expect(canEnterStage("dungeon-gold", 0)).toBe(true);
    });

    it("손상된 진행도(문자열 · 음수 · NaN)에도 1-1 은 열리고 나머지는 잠긴다", () => {
        for (const bad of ["45", -5, NaN, null, undefined, Infinity]) {
            expect(canEnterStage("1-1", bad), String(bad)).toBe(true);
        }
        expect(canEnterStage("5-20", NaN)).toBe(false);
        // "45" 는 살린다 — 진행도를 0 으로 만드는 쪽이 훨씬 나쁘다 (normalizeMeta 와 같은 태도)
        expect(canEnterStage("3-6", "45")).toBe(true);
    });

    it("다음 스테이지는 진행도 + 1 이고, 끝까지 깨면 마지막에 머문다", () => {
        expect(nextStageId(0)).toBe("1-1");
        expect(globalStageIndex(nextStageId(20))).toBe(21);
        expect(nextStageIndex(LAST_STAGE_INDEX)).toBe(LAST_STAGE_INDEX);
        expect(canEnterStage(nextStageId(37), 37)).toBe(true);
    });

    it("표기는 네 가지뿐이고 화면이 비교 연산자를 다시 쓰지 않아도 된다", () => {
        expect(stageMark("1-1", 0, 0)).toBe("next");
        expect(stageMark("1-1", 3, 3)).toBe("cleared");
        expect(stageMark("1-2", 0, 0)).toBe("locked");
        // 깨지 않았지만 잠기지도 않은 칸 (별 기록이 없는 과거 스테이지)
        expect(stageMark("1-2", 5, 0)).toBe("open");
        expect(stageMark("1-6", 5, 0)).toBe("next");
    });
});
