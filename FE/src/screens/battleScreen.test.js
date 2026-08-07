/**
 * 전투 화면의 **마운트 계약** — 소스 대조 검사.
 *
 * ★★ 이 저장소의 테스트 환경은 `environment: "node"` 다 (vite.config.js). jsdom 도
 *   RTL 도 없으므로 컴포넌트를 렌더해서 확인할 수 없다. 그래서 `check-*.mjs` 와
 *   `saveVersion.test.js` 가 쓰는 방식을 그대로 쓴다 — **소스를 읽어 대조한다.**
 *   대신 "왜 그 모양이어야 하는가"(위험이 실재한다)는 순수 로직으로 실측한다.
 *
 * ★ 지키는 명제 두 가지:
 *   ① 전투 중 `roster.owned` 가 바뀌어도 전투가 재시작되지 않는다.
 *   ② 캠페인은 순서대로만 들어갈 수 있다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { recommendLoadout } from "@/game/logic/loadoutAnalysis";
import { guaranteedUnitsUpTo, unitGrantsFor } from "@/game/logic/unlocks";
import { LOADOUT_SIZE } from "@/store/slices/rosterSlice.js";

const SRC = readFileSync(new URL("./BattleScreen.jsx", import.meta.url), "utf8");

/** 주석을 지운 소스 — 주석에 적힌 예전 코드가 검사에 걸리면 안 된다 */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => (/^\s*(\/\/|\*)/.test(l) ? "" : l))
    .join("\n");

describe("확정 지급이 전투를 재시작시키지 않는다", () => {
    /**
     * ★★ 먼저 **위험이 실재하는지** 확인한다. 이것이 거짓이면 아래 소스 검사는
     *   아무것도 지키지 않는 장식이다 (전제가 항상 거짓인 검사는 공회전이다).
     */
    it("빈 프리셋의 추천 편성은 roster.owned 의 함수다 — 확정 지급 한 번에 값이 바뀐다", () => {
        const start = [...guaranteedUnitsUpTo(0)];
        const granted = unitGrantsFor("1-1");
        expect(granted.length, "1-1 확정 지급이 사라졌다면 이 검사의 전제가 바뀐 것이다").toBeGreaterThan(0);

        const before = recommendLoadout(start, "1-1", LOADOUT_SIZE).join(",");
        const after = recommendLoadout([...start, ...granted], "1-1", LOADOUT_SIZE).join(",");
        expect(after).not.toBe(before);
    });

    /**
     * ★★★ 되돌리면 여기가 빨개진다.
     *   `useGameStore((s) => s.getBattleLoadout(...))` 로 되돌리는 순간 그 값은
     *   `roster.owned` 를 구독하게 되고, `claimStageReward` 의 확정 지급이
     *   마운트 effect 의 의존성을 바꿔 **결과 화면 대신 같은 전투가 재시작된다.**
     */
    it("★ 편성을 스토어 구독으로 읽지 않는다 — 의존성이 owned 의 함수가 되면 안 된다", () => {
        const subscriptions = [...CODE.matchAll(/useGameStore\(\s*\(([^)]*)\)\s*=>([^\n]*)/g)].map(
            (m) => m[2]
        );
        for (const body of subscriptions) {
            expect(
                body,
                `전투 화면이 getBattleLoadout 을 구독한다: "${body.trim()}" — ` +
                    `그 값은 roster.owned 의 함수이고, 확정 지급이 전투 중에 그것을 바꾼다`
            ).not.toContain("getBattleLoadout");
        }
        // 스냅샷으로 읽는 경로는 그대로 있어야 한다 (검사가 표기만 바꿔 통과하지 않게)
        expect(CODE).toMatch(/useGameStore\.getState\(\)\.getBattleLoadout\(/);
    });

    it("마운트 effect 의 의존성은 스테이지 · 재도전 · 에셋 준비뿐이다", () => {
        const deps = /\}, \[([^\]]*)\]\);/.exec(CODE.slice(CODE.indexOf("switchScene(\"Battle\"")));
        expect(deps, "마운트 effect 의 의존성 배열을 찾지 못했다 — 검사가 무의미하다").toBeTruthy();
        const names = deps[1].split(",").map((s) => s.trim()).filter(Boolean);
        expect(names.sort()).toEqual(["assetsReady", "runKey", "runLoadoutKey", "stageId"]);
    });
});

describe("캠페인 진입 게이트가 전투 화면에도 걸려 있다", () => {
    it("★ 탑만이 아니라 캠페인도 규칙 모듈의 술어로 막는다", () => {
        expect(CODE).toContain('from "@/game/logic/stageUnlock"');
        expect(
            CODE,
            "canEnterStage 호출이 없다 — /battle/5-20 딥링크가 그대로 열리고, " +
                "한 번 이기면 highestStage 가 튀어 던전·탑·하드가 한꺼번에 해금된다"
        ).toMatch(/canEnterStage\(\s*stageId/);
    });

    it("화면이 진행도를 숫자와 직접 비교하지 않는다 (규칙의 두 번째 출처 금지)", () => {
        expect(CODE).not.toMatch(/highestStage\s*(>=|>|<=|<)\s*\d/);
    });
});
