/**
 * 편성 화면 — **지휘관은 지휘관 탭에만 있다** (2026-08-05)
 *
 * ★★ 사용자가 **두 번** 제보했다. 처음에는 지휘관 설정을 따로 빼 달라고 했고,
 *   탭을 만든 뒤에도 편성 탭 아래쪽에 `<CommanderPanel />` 이 한 벌 더 남아 있었다.
 *   화면을 열어 스크롤하기 전에는 보이지 않는 자리라 눈으로도 놓쳤다.
 *
 * ★ 그래서 사람이 아니라 소스를 본다. 명제는 **"편성 탭 안에서 CommanderPanel 을
 *   그리지 않는다"** 이다 — 지휘관 탭에서는 그려야 하므로 "import 금지"로는 못 쓴다.
 *
 * ★★ **블록의 끝은 "다음 `pane ===` 까지"로 자르면 안 된다.** 처음에 그렇게 썼다가
 *   검사가 **조용히 통과**했다 — 편성 탭이 파일에서 지휘관 탭보다 **뒤에** 있어서
 *   "다음"이 없었고, 범위가 파일 끝까지 늘어나 아무것도 걸러내지 못했다.
 *   일부러 되돌려 넣어 보고서야 알았다. 그래서 **괄호 깊이로 정확히 자른다.**
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SRC = readFileSync(fileURLToPath(new URL("./LoadoutScreen.jsx", import.meta.url)), "utf8");

/** 주석을 걷어낸다 — 주석 안의 `<CommanderPanel />` 는 그리는 것이 아니다 */
const code = SRC.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * `pane === "<name>" && (` **전부**를 찾아, 각각 짝이 맞는 닫는 괄호까지 잘라 온다.
 *
 * ★★ **한 탭의 조건부 블록은 하나가 아니다.** 편성 탭은 두 군데다 — 위쪽의
 *   프리셋 탭 줄과 아래쪽의 본문. 처음에 `indexOf` 로 **첫 번째만** 보고
 *   검사가 조용히 통과했다(첫 블록은 1,361자짜리 머리 부분이었다).
 *   일부러 되돌려 넣어 보지 않았으면 그대로 나갔다.
 *
 * ★ 문자열·주석은 위에서 지웠고 JSX 안의 괄호는 짝이 맞으므로 깊이 세기로 충분하다.
 */
function paneBlocks(name) {
    const head = `pane === "${name}" && (`;
    const out = [];
    let from = 0;
    for (;;) {
        const at = code.indexOf(head, from);
        if (at < 0) return out;
        let depth = 0;
        let end = code.length;
        for (let i = at + head.length - 1; i < code.length; i++) {
            const c = code[i];
            if (c === "(") depth++;
            else if (c === ")" && --depth === 0) {
                end = i + 1;
                break;
            }
        }
        out.push(code.slice(at, end));
        from = end;
    }
}

describe("편성 화면의 두 탭", () => {
    it("★★ 편성(units) 탭 **어느 블록에도** CommanderPanel 이 없다", () => {
        const blocks = paneBlocks("units");
        expect(blocks.length, "편성 탭 블록을 못 찾았다 — 이 검사가 헛돈다").toBeGreaterThan(0);
        // 잘못 잘려 파일 전체가 되면 아무것도 못 잡는다
        for (const b of blocks) {
            expect(b.length, "블록이 파일 전체다 — 자르기가 깨졌다").toBeLessThan(code.length * 0.9);
        }

        const bad = blocks.filter((b) => b.includes("<CommanderPanel")).length;
        expect(
            bad,
            "지휘관 패널이 편성 탭 안에 다시 들어왔다 — 지휘관은 [지휘관] 탭에만 있다"
        ).toBe(0);
    });

    it("지휘관 탭에서는 그린다 (탭을 만들어 놓고 비워 두지 않는다)", () => {
        const blocks = paneBlocks("commander");
        expect(blocks.length, "지휘관 탭 블록이 없다").toBeGreaterThan(0);
        expect(blocks.some((b) => b.includes("<CommanderPanel"))).toBe(true);
    });

    it("두 탭은 조건부 렌더다 — `hidden` 속성으로 숨기지 않는다", () => {
        /**
         * ★ UA 기본 규칙 `[hidden]{display:none}` 은 **작성자 스타일시트보다 약하다.**
         *   `.body { display: flex }` 가 그대로 이겨서 지휘관 탭에서도 편성 화면이
         *   통째로 그려졌다 (2026-08-05, 화면으로 잡음).
         */
        expect(/hidden=\{/.test(code), "hidden 속성은 display:flex 를 못 이긴다").toBe(false);
    });
});
