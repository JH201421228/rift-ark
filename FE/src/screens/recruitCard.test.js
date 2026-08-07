/**
 * 영입 — **골드가 나가는 문은 하나여야 하고, 그 문은 규칙 모듈이 지킨다**
 *
 * ★★ 이 파일이 생긴 이유 (2026-08-05 오전). 브라우저는 **disabled 버튼에도
 *   `pointerdown`·`pointerup` 을 보낸다** (`click`·`mousedown` 만 막는다). 그때 영입
 *   카드는 홀드 툴팁 때문에 탭을 `onClick` 이 아니라 포인터 이벤트로 판정했고,
 *   그래서 `disabled` 를 걸어 둔 것만으로는 **이미 보유한 동료를 눌러도 확인 모달이
 *   떴다** — "치르는 값 2,500 · 남는 골드 895,000" 까지 적힌 채로. 확인을 눌러도
 *   `recruitUnit` 이 거절하므로 아무 일도 일어나지 않고, 화면은 그 사실을 말하지 않는다.
 *
 * ★★ **2단 재배치 후에도 명제는 같다** (2026-08-05 오후). 달라진 것은 **문의 위치**다:
 *   카드 탭은 이제 지출이 아니라 **고르기**이고(잠긴 것·보유한 것도 눌러서 봐야 한다),
 *   지출은 오른쪽 상세 발의 [영입한다] 하나로 모였다. 그래서 이 파일이 지키는 것은
 *
 *     ① 지출 경로(`buy`)가 **첫 줄에서** `canRecruit` 의 답을 다시 본다
 *     ② 카드 탭은 **고르기만** 한다 — 거기서 모달이 열리지 않는다
 *     ③ 지출이 **포인터 이벤트로 판정되지 않는다** (그것이 위 사고의 원인이었다)
 *
 * ★★ **lint 도 렌더 테스트도 이것을 못 잡는다.** 문법은 완전하고, 카드는 정상적으로
 *   흐려져 있으며, 아무도 예외를 던지지 않는다. 드러나는 것은 **누른 사람 앞에서만**이다.
 *   그래서 소스를 본다.
 *
 * ★ 보유 표기 자체도 함께 붙잡는다. 배지가 사라지고 회색 한 줄로 되돌아가면
 *   "보유 중"은 옆 칸의 "골드 2,500" 과 구별되지 않는다 (사용자가 제보한 그 상태).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SRC = readFileSync(fileURLToPath(new URL("./CompanionsScreen.jsx", import.meta.url)), "utf8");
/** 주석 안의 예시 코드는 배선이 아니다 */
const code = SRC.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * `head` 로 시작하는 블록의 본문을 **중괄호 깊이로** 잘라 온다.
 * ★ 글자 수로 창을 자르지 않는다 — 다음 코드가 새어 들어오면 검사가 조용히 통과한다
 *   (`loadoutPanes.test.js` 가 실제로 그렇게 한 번 통과했다).
 */
function blockAfter(src, head) {
    const at = src.indexOf(head);
    if (at < 0) return null;
    const open = src.indexOf("{", at + head.length - 1);
    if (open < 0) return null;
    let depth = 0;
    for (let i = open; i < src.length; i++) {
        if (src[i] === "{") depth++;
        else if (src[i] === "}" && --depth === 0) return src.slice(open + 1, i);
    }
    return null;
}

describe("영입", () => {
    it("검사기가 실제로 자른다 (자기 검증)", () => {
        expect(blockAfter("const buy = () => { guard(); tap(id); };", "const buy = () =>")).toContain(
            "guard()"
        );
        expect(blockAfter("없다", "const buy = () =>")).toBe(null);
    });

    it("★★ 지출 경로가 `canRecruit` 의 답을 먼저 본다 — disabled 만 믿지 않는다", () => {
        const body = blockAfter(code, "const buy = () =>");
        expect(body, "영입 화면에서 `const buy = () => {` 를 찾지 못했다").not.toBe(null);
        expect(
            /selCheck\.ok/.test(body),
            "지출 콜백에 `if (!selCheck || !selCheck.ok) return;` 가 없다 — 규칙 모듈이 " +
                "이미 거절한 영입에도 확인 모달이 열리고, 확인해도 아무 일이 일어나지 않는다"
        ).toBe(true);
        expect(body).toContain("setPendingBuy");
        // 답은 화면이 짓지 않는다 — 같은 순수 함수에서 온다
        expect(code).toContain("canRecruit({ unitId: selId");
    });

    it("★★ 카드 탭은 고르기다 — 거기서 모달이 열리지 않는다", () => {
        const from = code.indexOf("rows.map");
        const cards = code.slice(from, code.indexOf("</section>", from));
        expect(cards).toContain("onClick={() => setSel(id)}");
        expect(
            cards,
            "카드 탭이 영입 확인 모달을 연다 — 40칸 격자에서 오탭 하나가 지출의 시작이 된다"
        ).not.toContain("setPendingBuy");
    });

    it("★★ 지출은 포인터 이벤트로 판정하지 않는다 (그것이 disabled 우회의 원인이었다)", () => {
        const foot = blockAfter(code, "const buy = () =>");
        expect(foot).not.toMatch(/onPointer/);
        // 영입 버튼은 평범한 `onClick` 이다 — 브라우저의 disabled 가 실제로 막는다
        expect(code).toContain("onClick={buy}");
        expect(code, "영입 탭이 홀드 툴팁으로 되돌아갔다 — 그러면 탭 판정이 다시 " +
            "포인터 이벤트가 되고 disabled 가 무의미해진다").not.toContain("bindUnit");
    });

    it("영입은 **확인 모달**을 지난다 (되돌릴 수 없는 지출)", () => {
        expect(code).toContain("<ConfirmModal");
        /**
         * ★ 2026-08-07 i18n — 버튼 글자가 카탈로그로 옮겨 갔다 (`companions.recruitDo`).
         *   지키는 명제는 그대로다: **모달의 확인 버튼이 '영입한다' 라고 말한다.**
         *   리터럴을 대조하면 번역과 함께 조용히 죽으므로 **키**를 대조한다 —
         *   키가 카탈로그에 있는지, 두 언어를 갖는지는 `check:i18n` 이 따로 본다.
         */
        expect(code).toContain('confirmLabel={t("companions.recruitDo")}');
    });

    it("보유 카드는 **글자로** 보유를 말한다 (색·흐림만으로 구분하지 않는다)", () => {
        expect(code).toContain("<OwnedMark");
        expect(SRC).toContain('from "@/components/OwnedMark"');
    });

    it("보유 판정은 규칙 모듈이 답한다 — 화면이 `owned[id]` 를 다시 보지 않는다", () => {
        expect(code).toContain('check.reason === "owned"');
        expect(code, "영입 카드가 보유 판정을 직접 한다").not.toMatch(/const have = !!owned\[/);
    });

    it("★ 못 사는 이유를 **문장으로** 말한다 (흐린 버튼만 두지 않는다)", () => {
        const from = code.indexOf("const denial");
        const body = code.slice(from, code.indexOf("return (", from));
        for (const reason of ["owned", "locked", "gold"]) {
            expect(body, `사유 '${reason}' 에 대한 문장이 없다`).toContain(`"${reason}"`);
        }
    });

    it("★ 선택이 없으면 첫 번째를 고른다 (빈 상세 패널은 고장으로 읽힌다)", () => {
        expect(code).toMatch(/rows\[0\]\?\.id/);
    });

    it("★ 좌우 2단은 **성장·편성 탭과 같은 클래스**를 쓴다 (새 규칙을 만들지 않는다)", () => {
        const recruit = code.slice(code.indexOf("function Recruit()"), code.indexOf("function StarTree()"));
        for (const cls of ["s.split", "s.splitPane", "s.detailPane", "s.detailScroll", "s.detailFoot"]) {
            expect(recruit, `영입 탭이 ${cls} 를 쓰지 않는다`).toContain(cls);
        }
    });
});
