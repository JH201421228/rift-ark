/**
 * 출격 화면 — **포커스가 하나여야 한다** (2026-08-05, 사용자 제보)
 *
 * ★★ 제보: *"초기에 1-1 맵과 현재 가장 난이도 높은 맵이 같이 포커싱되어 있는 것처럼
 *   보인다."* 원인은 **두 상태가 서로 다른 출처에서 초기값을 가져간 것**이었다:
 *
 *     selected → stagesData.stages[0]        (언제나 1-1)
 *     world    → worldOfStage(nextStageId()) (지금 도전할 곳)
 *
 *   월드 1 에서는 1-1 이 선택 테두리를, 다음 스테이지가 "다음" 배지를 **동시에**
 *   달았고, 월드 2 이후에는 화면에 없는 1-1 의 프리뷰가 오른쪽에 떠 있었다.
 *
 * ★ 이 저장소에는 testing-library 가 없다 (`appShell.test.js` 와 같은 규약).
 *   그래서 렌더가 아니라 **소스를 읽어** "두 초기값이 같은 출처인가"를 본다.
 *   명제가 배선이므로 소스로 충분하고, 실제 화면 확인은 따로 했다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { nextStageId } from "@/game/logic/stageUnlock";
import stagesData from "@/game/data/stages.json";

const SRC = readFileSync(fileURLToPath(new URL("./StagesScreen.jsx", import.meta.url)), "utf8");
const code = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

describe("출격 화면의 초기 포커스", () => {
    it("★★ 선택 스테이지의 초기값이 `stages[0]`(=1-1 고정)이 아니다", () => {
        const init = code.match(/useState\([^)]*stagesData\.stages\[0\]/);
        expect(
            init,
            "초기 선택이 1-1 로 고정돼 있다 — 보고 있는 월드와 어긋나 두 곳이 골라진 것처럼 보인다"
        ).toBeNull();
    });

    it("★★ 선택과 월드가 **같은 출처**(nextStageId)에서 나온다", () => {
        const sel = code.match(/const \[selected, setSelected\] = useState\(([\s\S]{0,80}?)\);/);
        expect(sel, "selected 초기화를 못 찾았다 — 이 검사가 헛돈다").toBeTruthy();
        expect(
            sel[1].includes("nextStageId"),
            "selected 가 nextStageId 에서 오지 않는다"
        ).toBe(true);

        const w = code.match(/const \[world, setWorld\] = useState\(([\s\S]{0,120}?)\);/);
        expect(w, "world 초기화를 못 찾았다").toBeTruthy();
        expect(w[1].includes("nextStageId"), "world 가 nextStageId 에서 오지 않는다").toBe(true);
    });

    /**
     * ★ 배선만 보면 "그 값이 실제로 쓸 만한가"는 못 본다 — 규칙 모듈 쪽도 함께 본다.
     *   `nextStageId` 가 캠페인 밖의 id 를 돌려주면 프리뷰가 빈 채로 뜬다.
     */
    it("nextStageId 는 진행도가 무엇이든 실재하는 스테이지를 돌려준다", () => {
        const ids = new Set(stagesData.stages.map((s) => s.id));
        for (const hs of [0, 1, 5, 42, 99, 100, 999]) {
            const id = nextStageId(hs);
            expect(ids.has(id), `진행도 ${hs} 에서 '${id}' 는 없는 스테이지다`).toBe(true);
        }
    });

    it("신규 계정(진행도 0)의 초기 선택은 1-1 이다 — 그때는 그것이 다음 도전이다", () => {
        expect(nextStageId(0)).toBe(stagesData.stages[0].id);
    });
});
