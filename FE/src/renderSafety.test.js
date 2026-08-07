/**
 * 렌더 안전성 — **JSX 에서 쓰는 컴포넌트가 실제로 그 파일에 있는가** (2026-08-04)
 *
 * ★★ **왜 이 파일이 생겼나.** `SettingsScreen` 이 `<GuideButton />` 을 쓰면서
 *   import 를 하지 않았고, 설정 화면이 통째로 오류 경계로 떨어졌다 —
 *   "설정 탭에서 이상한 게 보인다"의 정체가 그것이었다.
 *
 * ★★ **lint 는 이것을 못 잡는다.** ESLint 의 `no-undef` 는 JSX 요소 이름을
 *   식별자 참조로 보지 않는다. 그것을 보는 것은 `eslint-plugin-react` 의
 *   `react/jsx-no-undef` 인데 이 저장소에는 그 플러그인이 없다.
 *   의존성을 하나 늘리는 대신, 이 저장소가 이미 쓰는 방식(소스를 읽어 대조)을 쓴다.
 *
 * ★ 검사 대상은 **대문자로 시작하는 JSX 이름**뿐이다. 소문자는 DOM 태그다.
 *   `<Foo.Bar>` 는 뿌리 이름 `Foo` 만 본다.
 *
 * ★ 주석 안의 JSX 예시는 세지 않는다 (`GuideOverlay.jsx` 문서 주석에 있다).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname, relative } from "node:path";

const SRC = dirname(fileURLToPath(import.meta.url));

function jsxFiles(dir, out = []) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) jsxFiles(p, out);
        else if (e.name.endsWith(".jsx")) out.push(p);
    }
    return out;
}

/** 주석을 지운다 — 주석 속 JSX 예시가 '사용'으로 잡히면 안 된다 */
function stripComments(src) {
    return src
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        // `://` (URL) 은 주석이 아니다
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/** 이 파일 안에서 이름으로 쓸 수 있는 것 — import · 선언 */
function definedNames(src) {
    const names = new Set();
    // import Default, { A as B, C } from "..."  /  import * as NS from "..."
    for (const m of src.matchAll(/import\s+([^;]+?)\s+from\s+["']/g)) {
        for (const part of m[1].split(/[{},]/)) {
            const t = part.trim();
            if (!t) continue;
            const asMatch = /^(?:\*\s+as\s+)?([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/.exec(t);
            if (asMatch) names.add(asMatch[2] ?? asMatch[1]);
        }
    }
    for (const m of src.matchAll(/(?:^|\s)(?:function|class)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
    for (const m of src.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g)) names.add(m[1]);
    // 구조 분해로 받은 것 (const { A, B } = ..., 함수 인자는 아래에서 따로)
    for (const m of src.matchAll(/(?:const|let|var)\s*\{([^}]*)\}\s*=/g)) {
        for (const part of m[1].split(",")) {
            const t = part.trim().split(":").pop().trim().replace(/\s*=.*$/, "");
            if (/^[A-Za-z_$][\w$]*$/.test(t)) names.add(t);
        }
    }
    return names;
}

/** 이 파일이 렌더하는 컴포넌트 이름 (대문자로 시작하는 것만) */
function usedComponents(src) {
    const used = new Map(); // name → 첫 등장 줄
    const lines = src.split("\n");
    lines.forEach((line, i) => {
        for (const m of line.matchAll(/<([A-Z][\w$]*)(?:\.[\w$]+)*[\s/>]/g)) {
            if (!used.has(m[1])) used.set(m[1], i + 1);
        }
    });
    return used;
}

describe("JSX 에서 쓰는 컴포넌트는 그 파일에 있어야 한다", () => {
    const files = jsxFiles(SRC);

    it("검사할 .jsx 파일이 실제로 있다 (경로가 어긋나면 이 테스트는 아무것도 안 한다)", () => {
        expect(files.length).toBeGreaterThan(5);
    });

    it("★★ import 없이 렌더되는 컴포넌트가 하나도 없다", () => {
        const missing = [];
        for (const file of files) {
            const raw = readFileSync(file, "utf8");
            const src = stripComments(raw);
            const defined = definedNames(src);
            for (const [name, line] of usedComponents(src)) {
                // React.Fragment 축약(<>)은 이름이 없고, 대문자 DOM 태그는 없다
                if (defined.has(name)) continue;
                missing.push(`${relative(SRC, file).replace(/\\/g, "/")}:${line} <${name}>`);
            }
        }
        expect(
            missing,
            `import 이 없는 컴포넌트를 렌더한다 — 그 화면은 열리는 순간 오류 경계로 떨어진다:\n  ${missing.join("\n  ")}`
        ).toEqual([]);
    });
});
