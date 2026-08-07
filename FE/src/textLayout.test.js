/**
 * 문장 레이아웃 안전성 — **플렉스 컨테이너 안에서 문장이 토막나지 않는가** (2026-08-05)
 *
 * ★★ **왜 이 파일이 생겼나.** 동료 > 성장 탭의 안내문이
 *   "모든 동료의 공격력·체력은 방주 **무기고**가 함께 올립니다" 였는데, 화면에서는
 *   세 토막이 **옆으로 나란히** 누워 있었다 (2026-08-04 사용자 제보).
 *
 *   원인은 CSS 한 줄이다. `.warn` 은 `아이콘 + 한 줄` 을 위해 `display:flex` 인데,
 *   플렉스 컨테이너는 **자식 텍스트 런 하나하나를 익명 플렉스 아이템**으로 만든다.
 *   그래서 문장 중간에 `<b>` 가 하나 들어가면
 *
 *       [· 모든 동료의 … 방주] [무기고] [가 함께 올립니다. …]
 *
 *   세 아이템이 되어 한 줄에 나란히 선다. 문장이 아니라 **행**이 된 것이다.
 *   `display:block` 을 주는 `.prose` 를 함께 붙이는 것이 해법이고, 그 해법은
 *   **붙이는 것을 잊는 순간 조용히 사라진다.** 그래서 기계가 본다.
 *
 * ★★ **lint 도 렌더 테스트도 이것을 못 잡는다.** 문법은 완전히 올바르고, 컴포넌트도
 *   정상 렌더된다. 잘못된 것은 오직 **눈에 보이는 배치**뿐이라, 화면을 직접 보지 않으면
 *   드러나지 않는다. 여기서는 CSS 모듈에서 `display` 를 읽어 JSX 와 대조한다.
 *
 * ★ 검사 규칙: 어떤 요소의 className 이 `display:flex|grid` 인 클래스를 가리키고,
 *   그 요소의 **직계 자식**이 `텍스트 → 요소 → 텍스트` 순으로 놓이면 위반이다
 *   (= 요소가 문장 한가운데에 있다). `아이콘 + 텍스트`(요소 → 텍스트)는 플렉스의
 *   **의도된** 용법이므로 잡지 않는다.
 *
 * ★ 면제: 같은 className 에 `display:block|inline|inline-block` 을 주는 클래스가
 *   함께 있으면 통과한다 (`.prose` 가 그것이다). 클래스 이름을 박아두지 않는 이유는,
 *   해법이 하나뿐이라고 가정하면 다음 해법이 나왔을 때 검사기가 거짓말을 하기 때문이다.
 *
 * ★ 한계: `s[expr]` 처럼 **동적으로 고른 클래스**는 정적으로 알 수 없어 건너뛴다.
 *   그런 자리는 지금 전부 아이콘+텍스트 한 줄짜리다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname, relative, resolve } from "node:path";

const SRC = dirname(fileURLToPath(import.meta.url));

const SPLIT_DISPLAY = /^(inline-)?(flex|grid)$/;
const BLOCK_DISPLAY = /^(block|inline|inline-block|contents)$/;

function walk(dir, ext, out = []) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) walk(p, ext, out);
        else if (e.name.endsWith(ext)) out.push(p);
    }
    return out;
}

/**
 * CSS 모듈 한 개에서 클래스별 `display` 를 읽는다.
 *
 * ★ 가장 안쪽 `{...}` 만 매칭되므로 미디어 쿼리 안의 규칙도 그대로 잡힌다
 *   (`@media (...) {` 는 중괄호를 포함해 셀렉터로 매칭될 수 없다).
 *
 * @returns {{split: Set<string>, block: Set<string>}}
 */
function readDisplays(cssPath) {
    const css = readFileSync(cssPath, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ");
    const split = new Set();
    const block = new Set();
    for (const m of css.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
        const [, selector, body] = m;
        const disp = /(?:^|[;{\s])display\s*:\s*([a-z-]+)/i.exec(body)?.[1]?.toLowerCase();
        if (!disp) continue;
        const target = SPLIT_DISPLAY.test(disp) ? split : BLOCK_DISPLAY.test(disp) ? block : null;
        if (!target) continue;
        for (const c of selector.matchAll(/\.([A-Za-z_][\w-]*)/g)) target.add(c[1]);
    }
    return { split, block };
}

/** `<tag ... >` 의 속성 끝(`>`)을 찾는다. 속성 안의 `{ () => x }` 에도 `>` 가 있다 */
function endOfOpenTag(src, from) {
    let depth = 0;
    let quote = null;
    for (let i = from; i < src.length; i++) {
        const c = src[i];
        if (quote) {
            if (c === quote) quote = null;
            continue;
        }
        if (c === '"' || c === "'" || c === "`") {
            quote = c;
            continue;
        }
        if (c === "{") depth++;
        else if (c === "}") depth--;
        else if (c === ">" && depth === 0) return i;
    }
    return -1;
}

/** `<tag>` 의 짝이 되는 `</tag>` 위치 (같은 이름의 중첩을 센다) */
function endOfElement(src, tag, bodyStart) {
    const open = new RegExp(`<${tag}(?=[\\s/>])`, "g");
    const close = new RegExp(`</${tag}\\s*>`, "g");
    let depth = 1;
    let i = bodyStart;
    while (i < src.length) {
        open.lastIndex = i;
        close.lastIndex = i;
        const o = open.exec(src);
        const c = close.exec(src);
        if (!c) return -1;
        if (o && o.index < c.index) {
            depth++;
            i = o.index + o[0].length;
        } else {
            depth--;
            if (depth === 0) return c.index;
            i = c.index + c[0].length;
        }
    }
    return -1;
}

/**
 * 직계 자식을 `"text"` / `"elem"` 토큰 열로 만든다.
 * ★ `{...}` 안에 `<` 가 있으면 요소를 그리는 식이므로 `elem` 으로 센다.
 */
function childTokens(body) {
    const tokens = [];
    let text = "";
    let i = 0;
    const flushText = () => {
        if (text.trim()) tokens.push("text");
        text = "";
    };
    while (i < body.length) {
        const c = body[i];
        if (c === "<") {
            const m = /^<\/?([A-Za-z][\w.$-]*)/.exec(body.slice(i));
            if (!m) {
                text += c;
                i++;
                continue;
            }
            flushText();
            tokens.push("elem");
            const tag = m[1];
            const gt = endOfOpenTag(body, i + m[0].length);
            if (gt < 0) break;
            if (body[gt - 1] === "/" || body.startsWith("</", i)) {
                i = gt + 1;
            } else {
                const end = endOfElement(body, tag.replace(/[.$]/g, "\\$&"), gt + 1);
                i = end < 0 ? gt + 1 : end + tag.length + 3;
            }
            continue;
        }
        if (c === "{") {
            let depth = 0;
            let j = i;
            for (; j < body.length; j++) {
                if (body[j] === "{") depth++;
                else if (body[j] === "}" && --depth === 0) break;
            }
            // ★ JSX 주석(`{/* … */}`)은 **아무것도 렌더하지 않는다.** 이것을 텍스트로
            //   세면 주석으로 시작하는 컨테이너가 전부 위반이 된다 (실제로 3건 오탐).
            const expr = body.slice(i + 1, j).replace(/\/\*[\s\S]*?\*\//g, "");
            flushText();
            // `{" "}` 은 JSX 의 공백이다 — 문장을 나누지 않는다
            if (/^\s*(["'`])\s*\1\s*$/.test(expr)) {
                /* 공백 */
            } else if (expr.includes("<")) tokens.push("elem");
            else if (expr.trim()) tokens.push("text");
            i = j + 1;
            continue;
        }
        text += c;
        i++;
    }
    flushText();
    return tokens;
}

/** 이 파일이 import 한 CSS 모듈: 지역 이름 → {split, block} */
function styleImports(file, src) {
    const map = new Map();
    for (const m of src.matchAll(/import\s+([A-Za-z_$][\w$]*)\s+from\s+["']([^"']+\.module\.css)["']/g)) {
        const [, local, spec] = m;
        const path = spec.startsWith("@/") ? join(SRC, spec.slice(2)) : resolve(dirname(file), spec);
        if (existsSync(path)) map.set(local, readDisplays(path));
    }
    return map;
}

/**
 * 한 소스에서 위반을 찾는다.
 * @returns {Array<{line: number, tag: string, classes: string[]}>}
 */
function findSplitSentences(src, styles) {
    const hits = [];
    if (styles.size === 0) return hits;

    for (const m of src.matchAll(/<([a-z][\w-]*)\s/g)) {
        const tag = m[1];
        const gt = endOfOpenTag(src, m.index + m[0].length);
        if (gt < 0) continue;
        if (src[gt - 1] === "/") continue; // 자기 닫힘 — 자식이 없다

        const attrs = src.slice(m.index, gt);
        const cn = /className\s*=\s*(\{`[^`]*`\}|\{[^}]*\}|"[^"]*")/.exec(attrs)?.[1];
        if (!cn) continue;

        const classes = [];
        let splits = false;
        let blocks = false;
        for (const ref of cn.matchAll(/\b([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)/g)) {
            const disp = styles.get(ref[1]);
            if (!disp) continue;
            classes.push(ref[2]);
            if (disp.split.has(ref[2])) splits = true;
            if (disp.block.has(ref[2])) blocks = true;
        }
        if (!splits || blocks) continue;

        const end = endOfElement(src, tag, gt + 1);
        if (end < 0) continue;
        const tokens = childTokens(src.slice(gt + 1, end));
        const firstElem = tokens.indexOf("elem");
        if (firstElem < 0) continue;
        const textBefore = tokens.slice(0, firstElem).includes("text");
        const textAfter = tokens.slice(firstElem + 1).includes("text");
        if (textBefore && textAfter) {
            hits.push({ line: src.slice(0, m.index).split("\n").length, tag, classes });
        }
    }
    return hits;
}

describe("플렉스 컨테이너 안에서 문장이 토막나지 않는다", () => {
    const files = walk(SRC, ".jsx");

    it("검사할 .jsx 와 .module.css 가 실제로 있다 (경로가 어긋나면 이 테스트는 아무것도 안 한다)", () => {
        expect(files.length).toBeGreaterThan(5);
        expect(walk(SRC, ".module.css").length).toBeGreaterThan(5);
        // 플렉스 클래스를 한 개도 못 읽었다면 CSS 파싱이 죽은 것이다
        const flexCount = walk(SRC, ".module.css").reduce((a, p) => a + readDisplays(p).split.size, 0);
        expect(flexCount, "CSS 에서 display:flex 클래스를 하나도 못 읽었다").toBeGreaterThan(20);
    });

    /**
     * ★ 검사기가 **거짓 위에서 통과하지 않는지**를 먼저 증명한다.
     *   실제 사고 문장을 그대로 쓴다 — `.warn` 은 이 저장소에서 진짜 flex 다.
     */
    it("검사기가 실제 사고 패턴을 잡는다 (자기 검증)", () => {
        const styles = new Map([["s", { split: new Set(["warn"]), block: new Set(["prose"]) }]]);
        const broken = `<p className={\`\${s.warn} \${s.info}\`}>
            · 모든 동료의 공격력·체력은 방주 <b>무기고</b>가 함께 올립니다.
        </p>`;
        expect(findSplitSentences(broken, styles)).toHaveLength(1);

        // .prose 를 붙이면 통과한다
        expect(findSplitSentences(broken.replace("${s.info}", "${s.info} ${s.prose}"), styles)).toHaveLength(0);
        // 아이콘 + 텍스트(요소가 앞) 는 플렉스의 의도된 용법이다
        expect(
            findSplitSentences(`<p className={s.warn}><Icon /> {w.text}</p>`, styles),
            "아이콘 + 한 줄을 위반으로 잡으면 안 된다"
        ).toHaveLength(0);
        // JSX 주석은 렌더되지 않는다 — 텍스트로 세면 안 된다
        expect(
            findSplitSentences(`<p className={s.warn}>{/* 설명 */}<Icon /> {w.text}</p>`, styles),
            "JSX 주석을 텍스트로 세면 안 된다"
        ).toHaveLength(0);
    });

    it("★★ 문장 한가운데에 요소가 들어간 플렉스 컨테이너가 하나도 없다", () => {
        const bad = [];
        for (const file of files) {
            const src = readFileSync(file, "utf8");
            const styles = styleImports(file, src);
            for (const h of findSplitSentences(src, styles)) {
                bad.push(`${relative(SRC, file).replace(/\\/g, "/")}:${h.line} <${h.tag} .${h.classes.join(" .")}>`);
            }
        }
        expect(
            bad,
            "플렉스 컨테이너가 문장을 토막내 옆으로 눕힌다 — display:block 인 클래스(.prose)를 함께 주거나 컨테이너를 바꿀 것:\n  " +
                bad.join("\n  ")
        ).toEqual([]);
    });
});
