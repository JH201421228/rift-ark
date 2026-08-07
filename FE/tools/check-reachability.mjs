/**
 * P8-01 — 전 화면 도달 경로 검사
 *
 * ★★ **묻는 질문은 하나다: "만들었는데 아무도 갈 수 없는 화면이 있는가."**
 *
 *   병렬 개발이 실제로 만드는 결함이다. 화면을 만든 사람은 라우트를 추가하고,
 *   그 화면으로 가는 버튼은 **다른 티켓의 파일**에 있다. 둘 중 하나가 빠지면
 *   lint 도 타입도 테스트도 아무 말을 하지 않는다 — 문법은 완전하고,
 *   빠진 것은 "목록의 항목 하나"뿐이기 때문이다.
 *   최근에도 새 화면 3개(/dungeon · /tower · /trials)가 탭바가 아니라
 *   출격 화면의 **조건부 카드**로 들어갔다. 조건이 영원히 거짓이면 그 셋은 없는 화면이다.
 *
 * ★ 그래서 이 검사기는 "라우트가 있는가"에서 멈추지 않는다. **도달 그래프**를 만든다.
 *     노드 = 라우트 · 간선 = 그 라우트가 그리는 파일들 안에서 발견된 이동 지시
 *     (`<Link to>` · `navigate()` · `to:` 객체 리터럴 · `href="#/..."` 딥링크 ·
 *      `data/*.json` 의 CTA)
 *   시작점 `"/"` 에서 **BFS** 로 닿지 않는 라우트는 도달 불가다.
 *
 * ★ 라우트 하나를 그리는 파일이 하나라고 가정하지 않는다. 라우트의 element 에서
 *   출발해 **렌더 간선**(import 한 컴포넌트를 실제로 `<X` 로 그리는가)을 따라
 *   닫힌 집합을 만든다. StagePreview 의 출격 버튼이 StagesScreen 의 진입점으로
 *   세어지는 것이 이 때문이다.
 *
 * ★ 셸(레이아웃 element)의 렌더 집합은 **모든 라우트에 공통 간선**으로 붙는다 —
 *   탭바는 라우트와 무관하게 항상 떠 있기 때문이다.
 *
 * ★★ **검사할 수 없는 것을 검사한 척하지 않는다.**
 *   "조건이 참이 되는 경우가 존재하는가"는 일반적으로는 판정 불가다. 그래서
 *   판정 가능한 형태만 강제한다 (아래 R5). 진입점의 해금 조건은 **규칙 모듈에서
 *   import 한 상수**여야 하고, 그 상수의 값은 이 검사기가 **모듈을 실제로 불러**
 *   달성 가능한 최대 진행도와 대조한다. 화면에 숫자를 적으면 그 순간 두 번째
 *   출처가 되고, 기계는 그 조건이 언젠가 참이 되는지 알 수 없다.
 *
 * 검사 목록
 *   R1  화면 파일이 어떤 라우트의 렌더 집합에도 없다 (만들었는데 아무도 안 그림)
 *   R2  라우트의 element 를 파일로 해석할 수 없다
 *   R3  이동 지시가 어떤 라우트에도 맞지 않는다 (오타 — `*` 캐치올이 조용히 삼킨다)
 *   R4  시작점에서 BFS 로 닿지 않는 라우트 (진입점 없음 / 진입점이 고립됨)
 *   R5a 진입점 파일이 `highestStage` 를 **숫자 리터럴**과 크기 비교한다
 *   R5b 영원히 거짓인 진입 조건 (`unlocked: false` · `{false &&`)
 *   R5c 진입점이 쓰는 해금 상수가 달성 불가능한 값이다 (> 마지막 스테이지)
 *
 * 사용:
 *   node tools/check-reachability.mjs
 *   npm run check:screens
 *
 * @see docs/04-plan/33-execution-plan.md P8-01
 * @see docs/04-plan/32-definition-of-done.md §3.4
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const P = path.posix;

/* ── 구조 상수 (밸런스 수치가 아니다 — 프로젝트 레이아웃이다) ────────── */

export const ROUTER_FILE = "src/router/index.jsx";
/**
 * 화면 배럴. **지금은 존재하지 않는다** — 라우터가 지연 로딩으로 개별 모듈을
 * 직접 부르기 때문이다 (P9-05). 배럴로 되돌아가는 날을 위해 해석 경로만 남겨 둔다.
 * 파일이 없으면 이 갈래는 조용히 비어 있고, 라우트는 `import()` 지정자로 해석된다.
 */
export const SCREEN_INDEX = "src/screens/index.jsx";
export const START_ROUTE = "/";
/** 화면·컴포넌트 파일이 사는 곳. 여기 있는 `.jsx` 는 전부 누군가 그려야 한다. */
export const UI_DIRS = ["src/screens", "src/components"];
/** 해금 상수로 취급할 import 바인딩 이름. */
const UNLOCK_BINDING = /UNLOCK/;
/**
 * 해금 **술어**로 취급할 이름 (`isDungeonUnlocked` · `isTowerUnlocked`).
 * ★ `shop.js:isUnlocked` 처럼 인자 모양이 다른 것은 일부러 제외한다 —
 *   진행도 하나를 받는 술어만 훑을 수 있다.
 */
const UNLOCK_PREDICATE = /^(?:is|can)[A-Z]\w*Unlocked$/;
/** 모든 해금이 이 값의 함수다 (2026-08-03 통합 감사 노트). */
const PROGRESS_FIELD = "highestStage";

/* ── 소스 로딩 ─────────────────────────────────────────────── */

async function walk(rel, out) {
    for (const e of await readdir(path.join(ROOT, rel), { withFileTypes: true })) {
        const child = P.join(rel, e.name);
        if (e.isDirectory()) await walk(child, out);
        else out.push(child);
    }
    return out;
}

/**
 * `src/` 의 모든 JS/JSX 를 읽어 경로 → 소스 맵으로 돌려준다.
 * 테스트 파일은 제외한다 — 검사 대상은 앱이지 검사기가 아니다.
 */
export async function loadSources(root = ROOT) {
    const files = await walk("src", []);
    const map = new Map();
    for (const f of files) {
        if (!/\.(js|jsx)$/.test(f) || /\.test\.jsx?$/.test(f)) continue;
        map.set(f, await readFile(path.join(root, f), "utf8"));
    }
    return map;
}

/**
 * 주석을 지운 소스. **모든 스캔은 이 위에서 한다.**
 * ★ 주석에 적힌 `#/dungeon` 같은 예시가 진입점으로 세어지면, 그 순간
 *   "문서에 적혀 있으니 도달 가능"이 되어 검사기가 거짓말을 한다.
 */
function stripComments(src) {
    return src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n")
        .map((l) => (/^\s*(\/\/|\*)/.test(l) ? "" : l))
        .join("\n");
}

/* ── import 해석 ───────────────────────────────────────────── */

const IMPORT_RE = /import\s+([^;]*?)\s+from\s+["']([^"']+)["']/g;

/**
 * `import a, { b as c } from "x"` → `[{ local, imported }]`.
 *
 * ★ **원래 이름을 같이 들고 다녀야 한다.** `import { UNLOCK_STAGE as DUNGEON_UNLOCK }`
 *   에서 지역 이름만 보면 모듈에서 그 값을 다시 읽을 수 없다 — 실제로 첫 판에
 *   "해금 상수의 값을 읽지 못했다" 경고 2건으로 나타났다.
 */
function bindingsOf(clause) {
    const names = [];
    const braced = clause.match(/\{([\s\S]*)\}/);
    if (braced) {
        for (const part of braced[1].split(",")) {
            const t = part.trim();
            if (!t) continue;
            const aliased = t.match(/^(\w+)\s+as\s+(\w+)$/);
            if (aliased) names.push({ local: aliased[2], imported: aliased[1] });
            else if (/^\w+$/.test(t)) names.push({ local: t, imported: t });
        }
    }
    const head = clause.replace(/\{[\s\S]*\}/, "").trim();
    for (const part of head.split(",")) {
        const t = part.trim();
        if (!t) continue;
        const ns = t.match(/^\*\s+as\s+(\w+)$/);
        if (ns) names.push({ local: ns[1], imported: "*" });
        else if (/^\w+$/.test(t)) names.push({ local: t, imported: "default" });
    }
    return names;
}

/** 모듈 지정자를 저장소 상대 경로로. 해석 불가(패키지)면 null. */
function resolveSpec(spec, fromFile, sources) {
    let base;
    if (spec.startsWith("@/")) base = "src/" + spec.slice(2);
    else if (spec.startsWith(".")) base = P.normalize(P.join(P.dirname(fromFile), spec));
    else return null;
    for (const c of [base, base + ".js", base + ".jsx", base + "/index.js", base + "/index.jsx"]) {
        if (sources.has(c)) return c;
    }
    return base.endsWith(".json") ? base : null;
}

/** 파일이 import 한 것들: [{ names, spec, file }] */
function importsOf(code, file, sources) {
    const out = [];
    for (const m of code.matchAll(IMPORT_RE)) {
        out.push({ names: bindingsOf(m[1]), spec: m[2], file: resolveSpec(m[2], file, sources) });
    }
    return out;
}

/* ── 이동 지시 수집 ────────────────────────────────────────── */

const NAV_PATTERNS = [
    /\bto=\{?"(\/[^"]*)"\}?/g, //  <Link to="/x">
    /\bto=\{`([^`]*)`\}/g, //      <Link to={`/battle/${id}`}>
    /\bto:\s*"(\/[^"]*)"/g, //     { to: "/x", label: … }  ← 탭바·카드 목록
    /\bnavigate\(\s*"(\/[^"]*)"/g, //  navigate("/x")
    /\bnavigate\(\s*`([^`]*)`/g, //    navigate(`/battle/${id}`)
    /\bhref="#(\/[^"]*)"/g, //     딥링크
];

/** `${…}` 를 파라미터로 눌러 라우트 패턴과 비교 가능한 모양으로. */
function normalizeTarget(raw) {
    return raw.replace(/\$\{[^}]*\}/g, ":param");
}

/** 소스에서 이동 지시를 뽑는다. [{ target, line }] */
export function collectNavTargets(code) {
    const found = [];
    for (const re of NAV_PATTERNS) {
        for (const m of code.matchAll(re)) {
            const target = normalizeTarget(m[1]);
            if (!target.startsWith("/")) continue;
            found.push({ target, line: code.slice(0, m.index).split("\n").length });
        }
    }
    return found;
}

/* ── 라우트 파싱 ───────────────────────────────────────────── */

const ROUTE_RE = /path:\s*"([^"]*)"\s*,[\s\S]{0,400}?element:\s*<([A-Za-z_$][\w$]*)/g;
const LAYOUT_RE = /element:\s*<([A-Za-z_$][\w$]*)\s*\/>\s*,\s*children:/;
/**
 * 지연 로딩 바인딩 — `const X = lazy(() => import("@/screens/X"))`.
 *
 * ★★ 라우트 화면은 전부 `React.lazy` 다 (P9-05). 즉 **element 이름을 파일로
 *   되돌리는 근거가 정적 import 가 아니라 이 선언**이고, 이것을 못 읽으면
 *   검사기는 모든 라우트를 R2 로 떨어뜨리거나(운이 좋은 경우) 렌더 집합을
 *   빈 채로 두고 "진입점 없음"을 잘못 보고한다.
 *
 * ★ `import.meta.env.DEV ? lazy(...) : null` 같은 조건부 선언도 읽는다 —
 *   개발 전용 화면(P8-06)이 정확히 그 모양이고(여러 줄에 걸쳐 있다), 소스에는
 *   그 라우트가 그대로 있으므로 도달 그래프에서 빠지면 안 된다.
 *
 * ★★ **틈(`=` 와 `lazy(` 사이)이 선언 경계를 넘지 않는다.**
 *   예전에는 `[\s\S]{0,120}?` 였다. 그 창은 줄바꿈도 세미콜론도 넘으므로,
 *   어떤 선언이 이 모양을 **벗어나면 다음 줄의 lazy 선언을 자기 것으로 삼켰다** —
 *   삼켜진 쪽은 바인딩을 잃는다. 실측(ArkScreen 만 `lazy(function(){…})` 로 바꾼 결과):
 *     ✗ R2 /stages 의 element <StagesScreen> 를 파일로 해석할 수 없다
 *     ✗ R1 src/screens/ArkScreen.jsx 은 어떤 라우트의 렌더 집합에도 없다
 *   **깨진 것은 `/`(ArkScreen)인데 오류는 무고한 `/stages` 를 가리켰고**,
 *   BFS 시작점 `/` 의 렌더 집합이 조용히 다른 화면 파일로 계산됐다.
 *   실패는 나므로 false-green 은 아니지만, **줄 번호가 틀린 검사기는 곧 무시된다**
 *   (이 파일 §"검사할 수 없는 것을 검사한 척하지 않는다" 와 같은 이유).
 *
 *   그래서 틈에서 `;`(문 끝)와 `const`(다음 선언)를 뺀다. 줄바꿈은 허용해야 한다 —
 *   개발 전용 화면의 삼항 선언이 3줄이기 때문이다.
 */
const LAZY_BINDING_RE =
    /const\s+([A-Za-z_$][\w$]*)\s*=(?:(?!\bconst\b)[^;]){0,120}?\blazy\(\s*\(\s*\)\s*=>\s*import\(\s*["']([^"']+)["']\s*\)\s*\)/g;

/**
 * 라우터가 선언한 라우트 — **이 저장소에서 라우터를 읽는 곳은 여기 하나뿐이다.**
 *
 * ★★ `tools/check-unlocks.mjs`(P8-03) 도 `screen.*` 해금 키를 라우터와 대조하려고
 *   자기 정규식으로 같은 파일을 읽고 있었다. 라우터를 읽는 코드가 두 벌이면
 *   **표기가 바뀐 날 한쪽만 못 읽고, 못 읽은 쪽은 조용히 "라우트 0개"로 통과한다** —
 *   아무것도 검사하지 않는 검사기가 초록불을 내는 정확한 모양이다.
 *   그래서 그쪽이 이 함수를 import 한다.
 *
 * @returns {{routes: Array<{path:string, element:string}>, declared: number}}
 *          `declared` 는 소스에 적힌 `path:` 의 개수다. `routes.length` 와 다르면
 *          정규식이 빗나간 것이고, 호출부는 그것을 **오류로** 다뤄야 한다.
 */
export function parseRoutes(routerSrc) {
    const src = stripComments(routerSrc);
    const declared = [...src.matchAll(/path:\s*"/g)].length;
    const routes = [];
    for (const m of src.matchAll(ROUTE_RE)) routes.push({ path: m[1], element: m[2] });
    return { routes, declared };
}

/** 저장소의 라우터 파일을 읽어 `parseRoutes` 한다. */
export async function loadRoutes(root = ROOT) {
    return parseRoutes(await readFile(path.join(root, ROUTER_FILE), "utf8"));
}

/** 라우트 패턴이 이동 지시를 받는가. `/battle/:stageId` 가 `/battle/:param` 을 먹는다. */
export function matchRoute(target, routePaths) {
    const ts = target.split(/[?#]/)[0].split("/").filter(Boolean);
    for (const r of routePaths) {
        if (r === "*") continue;
        const rs = r.split("/").filter(Boolean);
        if (rs.length !== ts.length) continue;
        if (rs.every((seg, i) => seg.startsWith(":") || seg === ts[i])) return r;
    }
    return null;
}

/* ── 본체 ──────────────────────────────────────────────────── */

/**
 * 도달 그래프를 만들고 위반을 돌려준다.
 *
 * ★ 순수 함수다 — 인자로 받은 소스 맵만 본다. 테스트가 **일부러 깨뜨린 소스**를
 *   넣어 검사기가 실제로 발동하는지 확인할 수 있어야 하기 때문이다
 *   ("고쳤다"가 아니라 "되돌리면 깨진다"를 만든다).
 *
 * @param {Map<string,string>} sources 저장소 상대경로 → 소스
 * @param {{maxStage?: number, unlockValues?: Record<string, number>}} [opts]
 *        `unlockValues` 는 `"<모듈경로>:<바인딩>"` → 값. 실제 모듈에서 읽어 넘긴다.
 */
export function analyze(sources, opts = {}) {
    const { maxStage = Infinity, unlockValues = {}, unlockPredicates = {} } = opts;
    const errors = [];
    const warnings = [];
    const code = new Map([...sources].map(([f, s]) => [f, stripComments(s)]));

    const routerSrc = code.get(ROUTER_FILE);
    if (!routerSrc) {
        errors.push(`라우터 파일이 없다: ${ROUTER_FILE}`);
        return { errors, warnings, routes: [], entries: new Map(), reachable: new Set() };
    }

    /* ① 화면 인덱스의 재수출 표 — element 이름을 파일로 되돌리는 유일한 근거 */
    const screenIndex = code.get(SCREEN_INDEX) ?? "";
    const exportToFile = new Map();
    for (const m of screenIndex.matchAll(
        /export\s*\{\s*default\s+as\s+(\w+)\s*\}\s*from\s*["']([^"']+)["']/g
    )) {
        exportToFile.set(m[1], resolveSpec(m[2], SCREEN_INDEX, sources) ?? m[2]);
    }
    // 인덱스 안에서 직접 정의된 화면(플레이스홀더 등)은 인덱스 자신이 뿌리다
    for (const m of screenIndex.matchAll(/export\s+const\s+(\w+)\s*=/g)) {
        if (!exportToFile.has(m[1])) exportToFile.set(m[1], SCREEN_INDEX);
    }

    /* ② 라우트 */
    const { routes, declared: declaredPaths } = parseRoutes(routerSrc);
    /** element 이름 → 지연 로딩 지정자 */
    const lazySpec = new Map();
    for (const m of routerSrc.matchAll(LAZY_BINDING_RE)) lazySpec.set(m[1], m[2]);
    if (routes.length !== declaredPaths) {
        errors.push(
            `라우터 파싱 실패 — path 선언 ${declaredPaths}개 중 ${routes.length}개만 element 와 짝지어졌다. ` +
                `라우트 정의 모양이 바뀌었다면 이 검사기(ROUTE_RE)도 같이 고쳐야 한다`
        );
    }
    const routePaths = routes.map((r) => r.path);

    /* ③ 렌더 간선 — import 한 것을 실제로 `<X` 로 그리는가 */
    const renders = new Map();
    for (const [file, src] of code) {
        const out = new Set();
        for (const imp of importsOf(src, file, sources)) {
            if (!imp.file || !code.has(imp.file)) continue;
            for (const n of imp.names) {
                if (new RegExp(`<${n.local}(?![A-Za-z0-9_$])`).test(src)) out.add(imp.file);
            }
        }
        renders.set(file, out);
    }

    const closureOf = (root) => {
        const seen = new Set();
        const stack = [root];
        while (stack.length) {
            const f = stack.pop();
            if (!f || seen.has(f) || !code.has(f)) continue;
            seen.add(f);
            for (const g of renders.get(f) ?? []) stack.push(g);
        }
        return seen;
    };

    /* ④ 셸(레이아웃) — 모든 라우트에 공통으로 붙는 진입점 */
    const layoutName = routerSrc.match(LAYOUT_RE)?.[1] ?? null;
    const layoutFile = layoutName
        ? (importsOf(routerSrc, ROUTER_FILE, sources).find((i) =>
              i.names.some((n) => n.local === layoutName)
          )?.file ?? null)
        : null;
    if (!layoutFile) warnings.push("레이아웃 element 를 파일로 해석하지 못했다 — 셸 진입점(탭바)이 안 세어진다");
    const shellFiles = layoutFile ? closureOf(layoutFile) : new Set();

    /* ⑤ 라우트별 렌더 집합
     *
     * ★ element 이름을 파일로 되돌리는 근거는 세 가지이고, 이 순서로 본다:
     *     ① 지연 로딩 선언 `const X = lazy(() => import("@/screens/X"))`  ← 현재 표기
     *     ② 화면 배럴(`screens/index.jsx`)의 재수출 표
     *     ③ 라우터가 직접 한 정적 import
     *   셋 다 실패하면 R2 다 — 라우트는 있는데 그리는 파일을 아무도 모르는 상태이고,
     *   그때 진입점 검사는 그 화면에 대해 아무 말도 하지 못한다.
     */
    const routeFiles = new Map();
    for (const r of routes) {
        if (r.path === "*") continue;
        const spec = lazySpec.get(r.element);
        const file =
            (spec ? resolveSpec(spec, ROUTER_FILE, sources) : null) ??
            exportToFile.get(r.element) ??
            importsOf(routerSrc, ROUTER_FILE, sources).find((i) =>
                i.names.some((n) => n.local === r.element)
            )?.file;
        if (!file || !code.has(file)) {
            errors.push(
                `R2 ${r.path} 의 element <${r.element}> 를 파일로 해석할 수 없다 — ` +
                    `라우터가 lazy() 로 선언하지도, ${SCREEN_INDEX} 가 재수출하지도, ` +
                    `직접 import 하지도 않는다`
            );
            routeFiles.set(r.path, new Set());
            continue;
        }
        routeFiles.set(r.path, closureOf(file));
    }
    /**
     * ★ **배럴을 지연 로딩하면 코드 분할이 이름만 남는다** — 한 화면만 열어도
     *   재수출된 화면 전부가 딸려 온다 (P9-05: 620 → 567 kB gzip 을 통째로 잃는다).
     *   검사기 입장에서도 모든 라우트의 렌더 집합이 같아져 진입점 그래프가 무의미해진다.
     */
    for (const [name, spec] of lazySpec) {
        const resolved = resolveSpec(spec, ROUTER_FILE, sources);
        if (resolved === SCREEN_INDEX) {
            errors.push(
                `R2 lazy(${name}) 가 화면 배럴 "${spec}" 을 가리킨다 — ` +
                    `배럴을 동적 import 하면 한 화면만 열어도 전 화면이 딸려 와 ` +
                    `코드 분할이 이름만 남는다. 개별 모듈을 가리켜야 한다`
            );
        }
    }

    /* ⑥ 데이터에 박힌 이동 지시 — 셸과 같은 자격으로 전역이다 */
    const dataTargets = [];
    for (const [file, src] of sources) {
        if (!file.endsWith(".json")) continue;
        for (const t of collectNavTargets(src)) dataTargets.push({ ...t, file });
    }

    /* ⑦ 진입점 표: 라우트 → [{from, line, scope}] */
    const entries = new Map(routePaths.filter((p) => p !== "*").map((p) => [p, []]));
    const deadTargets = [];
    const addTarget = (target, from, line, scope) => {
        const hit = matchRoute(target, routePaths);
        if (!hit || hit === "*") {
            deadTargets.push({ target, from, line });
            return;
        }
        entries.get(hit)?.push({ from, line, scope });
    };

    for (const file of shellFiles) {
        for (const t of collectNavTargets(code.get(file))) addTarget(t.target, file, t.line, "shell");
    }
    for (const t of dataTargets) addTarget(t.target, t.file, t.line, "shell");
    for (const [routePath, files] of routeFiles) {
        for (const file of files) {
            if (shellFiles.has(file)) continue;
            for (const t of collectNavTargets(code.get(file) ?? "")) {
                addTarget(t.target, file, t.line, routePath);
            }
        }
    }
    for (const d of deadTargets) {
        errors.push(
            `R3 ${d.from}:${d.line} 의 이동 지시 "${d.target}" 는 어떤 라우트와도 맞지 않는다 — ` +
                `캐치올 라우트가 조용히 "/" 로 되돌린다 (오타는 화면에 아무 흔적을 남기지 않는다)`
        );
    }

    /* ⑧ BFS — 시작점에서 실제로 닿는가 */
    const reachable = new Set();
    const queue = [START_ROUTE];
    if (!routePaths.includes(START_ROUTE)) {
        errors.push(`R4 시작 라우트 "${START_ROUTE}" 가 라우터에 없다`);
    }
    while (queue.length) {
        const cur = queue.shift();
        if (reachable.has(cur)) continue;
        reachable.add(cur);
        for (const [target, sites] of entries) {
            if (reachable.has(target)) continue;
            // 현재 라우트에서 볼 수 있는 진입점이 하나라도 있으면 간선이다
            if (sites.some((s) => s.scope === "shell" || s.scope === cur)) queue.push(target);
        }
    }
    for (const p of routePaths) {
        if (p === "*" || reachable.has(p)) continue;
        const n = entries.get(p)?.length ?? 0;
        errors.push(
            n === 0
                ? `R4 ${p} 로 가는 링크·버튼이 저장소 어디에도 없다 — 만들었는데 아무도 갈 수 없는 화면이다`
                : `R4 ${p} 의 진입점 ${n}개가 전부 도달 불가한 화면 안에 있다 (${entries
                      .get(p)
                      .map((s) => `${s.from}:${s.line}`)
                      .join(" · ")})`
        );
    }

    /* ⑨ R1 — 만들었는데 아무도 그리지 않는 화면·컴포넌트 */
    const drawn = new Set(shellFiles);
    for (const files of routeFiles.values()) for (const f of files) drawn.add(f);
    for (const file of code.keys()) {
        if (!UI_DIRS.some((d) => file.startsWith(d + "/"))) continue;
        if (!file.endsWith(".jsx") || file === SCREEN_INDEX) continue;
        if (drawn.has(file)) continue;
        errors.push(
            `R1 ${file} 은 어떤 라우트의 렌더 집합에도 없다 — ` +
                `라우트에 걸리지도, 다른 화면이 그리지도 않는다`
        );
    }

    /* ⑩ R5 — 조건부 진입점이 기계로 검증 가능한 모양인가 */
    const conditionalRoutes = [];
    for (const [routePath, sites] of entries) {
        if (!sites.length || sites.some((s) => s.scope === "shell")) continue;
        conditionalRoutes.push(routePath);
    }
    const entryFiles = new Set();
    for (const sites of entries.values()) for (const s of sites) entryFiles.add(s.from);

    for (const file of entryFiles) {
        const src = code.get(file);
        if (!src) continue;
        // R5a — 진입점 파일이 진행도를 숫자와 크기 비교한다
        const re = new RegExp(`\\b${PROGRESS_FIELD}\\s*(>=|>|<=|<)\\s*(\\d+)`, "g");
        for (const m of src.matchAll(re)) {
            errors.push(
                `R5a ${file}:${src.slice(0, m.index).split("\n").length} 진입점이 ` +
                    `\`${PROGRESS_FIELD} ${m[1]} ${m[2]}\` 로 해금을 직접 판정한다 — ` +
                    `해금 수치는 규칙 모듈(예: logic/dungeons.js:UNLOCK_STAGE)에서 import 해야 한다. ` +
                    `화면에 숫자를 적으면 두 번째 출처가 되고, 기계는 그 조건이 언젠가 참이 되는지 알 수 없다`
            );
        }
        // R5b — 영원히 거짓인 진입 조건
        for (const m of src.matchAll(/(unlocked|enabled|visible)\s*:\s*false\b|\{\s*false\s*&&/g)) {
            errors.push(
                `R5b ${file}:${src.slice(0, m.index).split("\n").length} 진입 조건이 상수 false 다 — ` +
                    `영원히 거짓인 조건은 도달 불가와 같다`
            );
        }
        // R5c/R5d — 진입점이 쓰는 해금 상수·술어가 "참이 되는 경우"를 갖는가
        for (const imp of importsOf(src, file, sources)) {
            if (!imp.file?.startsWith("src/game/logic/")) continue;
            for (const n of imp.names) {
                const key = `${imp.file}:${n.imported}`;
                if (UNLOCK_BINDING.test(n.imported)) {
                    const value = unlockValues[key];
                    if (typeof value !== "number") {
                        warnings.push(`R5c ${file} 이 쓰는 해금 상수 ${key} 의 값을 읽지 못했다`);
                    } else if (value > maxStage || value < 0) {
                        errors.push(
                            `R5c ${file} 의 진입 조건이 ${key} = ${value} 인데 달성 가능한 최대 진행도는 ${maxStage} 다 — ` +
                                `그 조건은 영원히 거짓이고, 그 화면은 도달 불가다`
                        );
                    }
                }
                if (UNLOCK_PREDICATE.test(n.imported)) {
                    const at = unlockPredicates[key];
                    if (at === undefined) {
                        warnings.push(`R5d ${file} 이 쓰는 해금 술어 ${key} 를 훑지 못했다`);
                    } else if (at === null) {
                        errors.push(
                            `R5d ${file} 의 진입 조건 ${key} 는 진행도 0..${maxStage} 어디에서도 참이 되지 않는다 — ` +
                                `영원히 거짓인 조건은 도달 불가와 같다`
                        );
                    }
                }
            }
        }
    }

    /* ⑪ 알림용 정보 — 실패는 아니지만 사람이 봐야 하는 것 */
    const placeholders = [];
    for (const [routePath, files] of routeFiles) {
        if ([...files].some((f) => /Placeholder/.test(f))) placeholders.push(routePath);
    }

    return {
        errors,
        warnings,
        routes,
        routeFiles,
        entries,
        reachable,
        shellFiles,
        conditionalRoutes,
        placeholders,
        screenCount: [...code.keys()].filter((f) => f.startsWith("src/screens/") && f.endsWith(".jsx"))
            .length,
    };
}

/* ── 해금 상수 실측 ────────────────────────────────────────── */

/**
 * 진입점 파일들이 import 한 해금 상수를 **규칙 모듈에서 직접 읽는다.**
 * ★ 여기서 값을 다시 적으면 검사기가 두 번째 출처가 된다 (validate-data 와 같은 규약).
 */
export async function readUnlockValues(sources, root = ROOT, maxStage = 0) {
    const values = {};
    /** 술어가 **처음 참이 되는 진행도**. 끝까지 거짓이면 null — 그것이 곧 도달 불가다. */
    const predicates = {};
    for (const [file, src] of sources) {
        if (!UI_DIRS.some((d) => file.startsWith(d + "/"))) continue;
        for (const imp of importsOf(stripComments(src), file, sources)) {
            if (!imp.file?.startsWith("src/game/logic/")) continue;
            for (const n of imp.names) {
                const isConst = UNLOCK_BINDING.test(n.imported);
                const isPred = UNLOCK_PREDICATE.test(n.imported);
                if (!isConst && !isPred) continue;
                const key = `${imp.file}:${n.imported}`;
                if (key in values || key in predicates) continue;
                const mod = await import(pathToFileURL(path.join(root, imp.file)).href);
                const member = mod[n.imported];
                if (isConst && typeof member === "number") values[key] = member;
                // ★ 첫 인자가 진행도인 술어만 훑는다. `codex.js:isEntryUnlocked(entry, idx)`
                //   처럼 인자 모양이 다른 것에 숫자를 먹이면 "언제나 거짓"이라는
                //   **틀린 결론**이 나온다 (실제로 1차 실행에서 그렇게 나왔다).
                const takesProgress =
                    typeof member === "function" &&
                    new RegExp(`^\\s*function\\s+\\w+\\s*\\(\\s*${PROGRESS_FIELD}\\b`).test(
                        member.toString()
                    );
                if (isPred && takesProgress) {
                    predicates[key] = null;
                    // ★ 실제 술어를 **달성 가능한 진행도 전 구간에 걸쳐 돌린다.**
                    //   "조건이 참이 되는 경우가 존재하는가"를 추측이 아니라 실행으로 답한다.
                    for (let n2 = 0; n2 <= maxStage; n2++) {
                        let ok = false;
                        try {
                            ok = Boolean(member(n2));
                        } catch {
                            ok = false;
                        }
                        if (ok) {
                            predicates[key] = n2;
                            break;
                        }
                    }
                }
            }
        }
    }
    return { values, predicates };
}

/** 달성 가능한 최대 진행도 = 마지막 캠페인 스테이지의 전역 순번. */
export async function maxAttainableStage(root = ROOT) {
    const [{ globalStageIndex }, stages] = await Promise.all([
        import(pathToFileURL(path.join(root, "src/game/logic/difficulty.js")).href),
        readFile(path.join(root, "src/game/data/stages.json"), "utf8").then(JSON.parse),
    ]);
    return Math.max(...stages.stages.map((s) => globalStageIndex(s.id)));
}

/**
 * 검사에 필요한 모든 입력을 한 번에 읽는다.
 * ★ CLI 와 테스트가 **같은 입력**을 쓰게 하기 위한 것이다. 테스트가 자기만의
 *   로딩 절차를 가지면 "검사기는 통과하는데 테스트는 다른 것을 본다"가 된다.
 */
export async function loadProject(root = ROOT) {
    const sources = await loadSources(root);
    // 데이터에 박힌 이동 지시도 소스와 같은 자격으로 넣는다
    for (const f of await walk("src/game/data", [])) {
        if (f.endsWith(".json")) sources.set(f, await readFile(path.join(root, f), "utf8"));
    }
    const maxStage = await maxAttainableStage(root);
    const { values, predicates } = await readUnlockValues(sources, root, maxStage);
    return { sources, maxStage, unlockValues: values, unlockPredicates: predicates };
}

/* ── CLI ───────────────────────────────────────────────────── */

async function main() {
    const { sources, maxStage, unlockValues, unlockPredicates } = await loadProject();
    const r = analyze(sources, { maxStage, unlockValues, unlockPredicates });

    const routeCount = r.routes.filter((x) => x.path !== "*").length;
    const entryCount = [...r.entries.values()].reduce((n, s) => n + s.length, 0);

    console.log("── 전 화면 도달 경로 검사 (P8-01) ─────────────");
    console.log(
        `라우트 ${routeCount} · 화면 파일 ${r.screenCount} · 진입 링크 ${entryCount} · ` +
            `셸 렌더 ${r.shellFiles.size}파일 · 최대 진행도 ${maxStage}`
    );
    for (const [routePath, sites] of r.entries) {
        const mark = r.reachable.has(routePath) ? "→" : "✗";
        const where = sites.length
            ? sites
                  .map((s) => (s.scope === "shell" ? `셸 ${P.basename(s.from)}:${s.line}` : `${s.from}:${s.line}`))
                  .join(" · ")
            : "진입점 없음";
        console.log(`  ${mark} ${routePath.padEnd(18)} ${where}`);
    }
    if (r.conditionalRoutes.length) {
        console.log(`조건부 진입 ${r.conditionalRoutes.length}: ${r.conditionalRoutes.join(" · ")}`);
    }
    for (const [key, v] of Object.entries(unlockValues)) {
        console.log(`해금 상수 ${key} = ${v} (≤ ${maxStage})`);
    }
    for (const [key, at] of Object.entries(unlockPredicates)) {
        console.log(
            at === null
                ? `해금 술어 ${key} — 진행도 0..${maxStage} 어디에서도 거짓`
                : `해금 술어 ${key} — 진행도 ${at} 부터 참`
        );
    }
    if (r.placeholders.length) {
        console.log(`ℹ 내용이 아직 없는 화면(PlaceholderScreen): ${r.placeholders.join(" · ")}`);
    }

    for (const w of r.warnings) console.warn(`⚠ ${w}`);
    for (const e of r.errors) console.error(`✗ ${e}`);

    console.log("───────────────────────────────────────────────");
    if (r.errors.length) {
        console.error(`✗ 도달 불가 · 결함 ${r.errors.length}건 · 경고 ${r.warnings.length}건`);
        process.exitCode = 1;
        return;
    }
    console.log(
        `✅ 통과 — 라우트 ${routeCount}개 전부 "${START_ROUTE}" 에서 도달 가능 (경고 ${r.warnings.length}건)`
    );
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
    await main();
}
