/**
 * P8-06 — 디버그 잔재 · 프로덕션 빌드 점검
 *
 * ★★ **묻는 질문은 하나다: "개발용으로 만든 것이 배포 번들에 남았는가."**
 *
 *   선례가 있다. `CompanionsScreen` 에 **동료 25종 전체 지급 버튼**이 가드 없이 있었고
 *   `dist/assets/index-*.js` 안에서 그대로 발견됐다. 신규 설치 → 1탭이면 전 동료 획득 —
 *   가챠·상점·파편 보상의 존재 이유가 사라지고 무과금 난이도 설계(게이트 B4)도 무너진다.
 *
 * ★★ **숨기는 것과 지우는 것은 다르다.** 런타임 조건(스토어 플래그 · 탭 카운터 ·
 *   `if (isQa)`)으로 감춘 코드는 번들에 **그대로 남는다.** 문자열을 검색할 줄 아는
 *   사람이면 누구나 찾아내고, 웹뷰 콘솔이면 호출까지 한다. 지우는 유일한 방법은
 *   **빌드 시 리터럴로 치환되는 조건**(`import.meta.env.DEV`)뿐이다.
 *
 * ★★ **그래서 소스 grep 으로는 부족하다.** "가드가 있다"와 "트리셰이킹으로 사라졌다"는
 *   다른 명제다. 롤업이 그 가지를 실제로 접었는지는 소스를 아무리 봐도 알 수 없다 —
 *   부수효과가 있는 import 하나(CSS 모듈 등)면 모듈 전체가 살아남는다.
 *   **이 검사기는 `dist/` 를 실제로 연다.**
 *
 * ★★★ **이중 언어화 이후, 마커는 한국어 문구가 아니라 `t()` 키다** (2026-08-07).
 *
 *   이 검사기는 "한글이 섞인 텍스트 덩어리"(`HANGUL_RUN`)를 JSX 본문을 잡는 수단으로
 *   쓴다. 그 전제는 **UI 가 한국어일 때만** 성립한다. 문구가
 *   `src/i18n/messages/*.json` 으로 옮겨 가면서 두 가지가 동시에 일어났다:
 *
 *     ① DEV 영역 안에는 이제 `t("companions.grantAllDev")` 라는 **ASCII 키**만 남는다
 *     ② 그 한국어 문구는 카탈로그를 통해 **프로덕션 번들에 들어간다** (당연하다 —
 *        카탈로그는 앱의 일부다)
 *
 *   그래서 예전처럼 문구로 대조하면 **언제나 실패**하고, 반대로 UI 를 영어로만
 *   돌리면 마커가 전부 사라져 **언제나 통과**한다. 둘 다 검사가 재려던 것과 무관하다.
 *   지금 대조하는 것은 **키**다 — 키는 DEV 영역에만 있고 언어와 무관하다.
 *   `src/production.test.js` 가 "마커가 전부 한글이면 안 된다"를 못박아 이 성질을 지킨다.
 *
 * ★ 검사기가 두 번째 출처가 되지 않게 하는 방법:
 *   금지 문자열 목록을 **여기에 적지 않는다.** 소스에서 DEV 가드 영역을 찾아
 *   그 안의 문자열을 **자동으로 뽑고**, 가드 밖에도 있는 문자열은 빼서
 *   "개발 빌드에만 존재해야 하는 문구" 집합을 만든 뒤, 그것이 dist 에 있는지 본다.
 *   가드를 지우면 문구가 dist 에 나타나고 → 발동한다. 목록을 손보지 않아도 된다.
 *
 * 검사 목록
 *   D1  dist 가 없다 / 소스보다 오래됐다 (검사 대상이 낡으면 통과는 거짓말이다)
 *   S1  `console.log` 계열 직접 호출이 DEV 가드 밖에 있다        ← DoD §4
 *   S2  이름이 `Dev*` 인 화면·CSS 가 DEV 가드 없이 참조된다       (명명 규약)
 *   B1  DEV 가드 안에만 있어야 할 문구가 번들에 있다               ★ 핵심
 *   B2  DEV 가드 안에서 만드는 전역(`globalThis.__store` 등)이 번들에 있다
 *   B3  `Dev*.module.css` 의 클래스가 번들 CSS 에 있다
 *   B4  소스맵(`.map` · `sourceMappingURL`)이 번들에 있다
 *   B5  `debugger` 문이 번들에 있다
 *   B6  절대 로컬 경로(`C:\Users\…`) · 이메일 주소가 번들에 있다
 *   B7  `TODO` · `FIXME` · `XXX` · `HACK` 가 번들에 있다
 *   C1  `capacitor.config.json` 의 `webContentsDebuggingEnabled` 가 false 가 아니다  ← DoD §4
 *   A1  `ads.json:enabled` 가 true 인데 `units.android` 가 비었다 (수익 0)      ★ `56 §5.5`
 *   A2  `units.*` 가 광고 단위 id 형식(`/`)이 아니다 — 앱 id(`~`) 를 넣었다
 *   A3  `ads.json:testMode` 가 true 인 채로 배포된다 (심사자가 테스트 광고를 본다)
 *   A4  매니페스트의 AdMob `APPLICATION_ID` 가 없다 / 형식이 틀렸다 / 아직 테스트 앱 id 다
 *   A5  iOS `Info.plist` 의 `GADApplicationIdentifier` — A4 의 iOS 짝                ★ `51 §2.5`
 *   A6  iOS `Info.plist` 에 `ITSAppUsesNonExemptEncryption` 이 없다 (Missing Compliance)
 *   A7  ATT 문구와 `requestTrackingAuthorization()` 호출이 **한쪽만** 있다
 *   A8  `PrivacyInfo.xcprivacy` 가 `project.pbxproj` 에 없다 → IPA 미포함 (ITMS-91053)
 *   A9  `NSPrivacyTracking` 과 `NSPrivacyTrackingDomains` 가 어긋난다 (ITMS-91056)
 *
 * ★ 검사 범위는 **번들**이다 — `dist/index.html` · `dist/assets/*.js` · `*.css`.
 *   `public/` 에서 복사된 에셋(아틀라스 · 오디오 · PNG)은 빌드가 만든 코드가 아니고,
 *   바이너리에서 우연히 "TODO" 바이트열이 나오면 검사가 거짓말을 시작한다.
 *
 * 사용:
 *   npx vite build && node tools/check-production.mjs
 *   npm run check:prod
 *
 * @see docs/04-plan/33-execution-plan.md P8-06
 * @see docs/04-plan/32-definition-of-done.md §4
 */
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const P = path.posix;

/* ── 구조 상수 (밸런스 수치가 아니다 — 프로젝트 레이아웃이다) ────────── */

export const SRC_DIR = "src";
export const DIST_DIR = "dist";
export const CAPACITOR_CONFIG = "capacitor.config.json";
export const ADS_JSON = "src/game/data/ads.json";
export const ANDROID_MANIFEST = "android/app/src/main/AndroidManifest.xml";
/**
 * ★★★ iOS 쪽 배선 (2026-08-10 추가).
 *
 *   A1–A4 는 **안드로이드만 보고 있었다.** 그 비대칭은 이 저장소의 이름 붙은
 *   실패 유형이고, 같은 날 아이콘에서 실제로 값을 치렀다 — `icons:check` 가
 *   `mipmap-*` 만 보는 동안 iOS 아이콘이 4개월간 Capacitor 기본값이었다.
 *   **한쪽 플랫폼만 보는 검사기의 '통과' 는 아무것도 보증하지 않는다.**
 */
export const IOS_INFO_PLIST = "ios/App/App/Info.plist";
export const IOS_PBXPROJ = "ios/App/App.xcodeproj/project.pbxproj";
export const IOS_PRIVACY = "ios/App/App/PrivacyInfo.xcprivacy";
/** 구글 공식 테스트 값. 배포 빌드에 이것이 남으면 수익이 0 이다 (`56 §1.3`). */
export const GOOGLE_TEST_APP_ID = "ca-app-pub-3940256099942544~3347511713";
/** AdMob id 는 `~`(앱) 와 `/`(광고 단위)로만 갈린다 — 앞 16자리는 같다. */
const AD_APP_ID = /^ca-app-pub-\d{16}~\d+$/;
const AD_UNIT_ID = /^ca-app-pub-\d{16}\/\d+$/;
/** 빌드 시 리터럴로 치환되는 **유일한** 조건. 이것 말고는 코드를 지우지 못한다. */
export const DEV_FLAG = "import.meta.env.DEV";
/**
 * ★ `import.meta.env?.DEV` 도 같은 자격이다. Vite 가 `import.meta.env` 를 객체
 *   리터럴로 치환한 뒤 esbuild 가 접어 준다 — 실측으로 확인했다(P8-06).
 *   이 물음표를 regex 에서 빠뜨렸다가 `analytics.js` 의 정상 가드를 위반으로 잡았다.
 */
const DEV_TOKEN = /import\.meta\.env\??\.DEV\b/g;
/**
 * 개발 전용 파일 명명 규약. `DevAnalyticsScreen.jsx` · `DevAnalytics.module.css` ·
 * `src/dev/**`. **이 이름을 쓰면 프로덕션에 남지 않겠다고 선언한 것이다.**
 * ★ 규약을 파일 이름에 둔 이유: 별도 목록을 만들면 그 목록이 두 번째 출처가 되고,
 *   파일을 지우거나 옮길 때 반드시 갈라진다.
 */
export const DEV_ONLY_FILE = /(^|\/)dev\/|(^|\/)Dev[A-Z][\w.]*\.(jsx?|css)$/;
/** 프로덕션에 남으면 안 되는 콘솔 호출. `warn`·`error`·`assert` 는 실패 진단이라 남긴다. */
export const BANNED_CONSOLE = [
    "log",
    "debug",
    "info",
    "dir",
    "table",
    "trace",
    "count",
    "group",
    "groupEnd",
    "time",
    "timeEnd",
];
/** 이보다 짧은 문구는 마커로 쓰지 않는다 — 우연히 겹쳐 거짓 실패를 만든다. */
const MIN_MARKER_ASCII = 5;
/** 한글이 섞이면 3글자로도 충분히 고유하다 ("개발자"). */
const MIN_MARKER_HANGUL = 3;

/* ══════════════════════ 소스 로딩 ══════════════════════ */

async function walk(rel, out, root) {
    let entries;
    try {
        entries = await readdir(path.join(root, rel), { withFileTypes: true });
    } catch {
        return out;
    }
    for (const e of entries) {
        const child = P.join(rel, e.name);
        if (e.isDirectory()) await walk(child, out, root);
        else out.push(child);
    }
    return out;
}

/** `src/` 의 JS·JSX·CSS·JSON. 테스트 파일은 뺀다 — 번들에 들어가지 않는다. */
export async function loadSources(root = ROOT) {
    const map = new Map();
    for (const f of await walk(SRC_DIR, [], root)) {
        if (!/\.(js|jsx|css|json)$/.test(f) || /\.test\.jsx?$/.test(f)) continue;
        map.set(f, await readFile(path.join(root, f), "utf8"));
    }
    return map;
}

/**
 * 번들 산출물. **여기만 검사한다** (헤더 주석 참조).
 * @returns {Promise<Map<string,string>>}
 */
export async function loadBundle(root = ROOT) {
    const map = new Map();
    for (const f of await walk(DIST_DIR, [], root)) {
        if (!/\.(js|css|html|map)$/.test(f)) continue;
        map.set(f, await readFile(path.join(root, f), "utf8"));
    }
    return map;
}

/* ══════════════════════ 렉서 ══════════════════════ */

/**
 * 주석을 공백으로 지운 사본(`masked`)과 문자열 리터럴 목록을 만든다.
 *
 * ★ **길이를 보존한다.** 주석을 삭제해 버리면 오프셋이 밀려 "가드 영역"의 범위를
 *   더 이상 원본에 대응시킬 수 없다. 이 검사기는 범위로 판정하므로 치명적이다.
 * ★ 문자열 **내용**도 masked 에서는 공백이다 — 괄호 균형을 셀 때 문자열 안의
 *   `{` 가 끼어들면 영역이 엉뚱한 곳에서 끝난다.
 *
 * @param {string} src
 * @returns {{masked: string, literals: {start:number, end:number, value:string}[]}}
 */
export function lex(src) {
    const out = new Array(src.length);
    const literals = [];
    let i = 0;
    /** 직전 코드 문자 — `/` 가 정규식인지 나눗셈인지 가른다 */
    let prevCode = "";
    const blank = (from, to) => {
        for (let k = from; k < to; k++) out[k] = src[k] === "\n" ? "\n" : " ";
    };

    while (i < src.length) {
        const c = src[i];
        const c2 = src[i + 1];

        if (c === "/" && c2 === "/") {
            let j = i;
            while (j < src.length && src[j] !== "\n") j++;
            blank(i, j);
            i = j;
            continue;
        }
        if (c === "/" && c2 === "*") {
            const j = src.indexOf("*/", i + 2);
            const end = j === -1 ? src.length : j + 2;
            blank(i, end);
            i = end;
            continue;
        }
        if (c === '"' || c === "'") {
            const start = i;
            let j = i + 1;
            let value = "";
            while (j < src.length && src[j] !== c) {
                if (src[j] === "\\") {
                    value += src[j + 1] ?? "";
                    j += 2;
                    continue;
                }
                if (src[j] === "\n") break; // 닫히지 않은 문자열 — 포기
                value += src[j];
                j++;
            }
            const end = Math.min(j + 1, src.length);
            out[start] = c;
            blank(start + 1, end - 1);
            out[end - 1] = src[end - 1] === c ? c : out[end - 1];
            literals.push({ start, end, value });
            i = end;
            prevCode = c;
            continue;
        }
        if (c === "`") {
            // 템플릿: `${…}` 로 끊긴 **정적 조각들**을 각각 리터럴로 본다.
            // ★ 조각을 이어붙이면 안 된다 — 실제 번들에 그 모양으로 나타나지 않는다.
            const start = i;
            let j = i + 1;
            let chunkStart = j;
            let value = "";
            let depth = 0;
            while (j < src.length) {
                if (depth === 0 && src[j] === "\\") {
                    value += src[j + 1] ?? "";
                    j += 2;
                    continue;
                }
                if (depth === 0 && src[j] === "$" && src[j + 1] === "{") {
                    literals.push({ start: chunkStart, end: j, value });
                    value = "";
                    depth = 1;
                    j += 2;
                    continue;
                }
                if (depth > 0) {
                    if (src[j] === "{") depth++;
                    else if (src[j] === "}") {
                        depth--;
                        if (depth === 0) chunkStart = j + 1;
                    }
                    j++;
                    continue;
                }
                if (src[j] === "`") break;
                value += src[j];
                j++;
            }
            const end = Math.min(j + 1, src.length);
            literals.push({ start: chunkStart, end: Math.min(j, end), value });
            blank(start, end);
            i = end;
            prevCode = "`";
            continue;
        }
        if (c === "/" && /[(,=:[!&|?{};+\-*%~^<>\n]|^$/.test(prevCode)) {
            // 정규식 리터럴. 안에 따옴표가 있어도 렉서가 깨지지 않게 통째로 지운다.
            let j = i + 1;
            let inClass = false;
            while (j < src.length) {
                if (src[j] === "\\") {
                    j += 2;
                    continue;
                }
                if (src[j] === "[") inClass = true;
                else if (src[j] === "]") inClass = false;
                else if (src[j] === "/" && !inClass) break;
                else if (src[j] === "\n") break;
                j++;
            }
            if (src[j] === "/") {
                blank(i, j + 1);
                i = j + 1;
                prevCode = "/";
                continue;
            }
        }
        out[i] = c;
        if (!/\s/.test(c)) prevCode = c;
        i++;
    }
    for (let k = 0; k < src.length; k++) if (out[k] === undefined) out[k] = src[k];
    return { masked: out.join(""), literals };
}

/* ══════════════════════ DEV 가드 영역 ══════════════════════ */

const OPENERS = { "{": "}", "(": ")", "[": "]" };

/** `masked[from]` 의 여는 괄호에 대응하는 닫는 위치(포함) — 없으면 -1 */
function matchBracket(masked, from) {
    const close = OPENERS[masked[from]];
    if (!close) return -1;
    let depth = 0;
    for (let i = from; i < masked.length; i++) {
        const c = masked[i];
        if (OPENERS[c]) depth++;
        else if (c === "}" || c === ")" || c === "]") {
            depth--;
            if (depth === 0) return i;
        }
    }
    return -1;
}

const skipWs = (s, i) => {
    while (i < s.length && /\s/.test(s[i])) i++;
    return i;
};

/** 토큰 앞에서 **아직 닫히지 않은** 여는 괄호 위치 — `if (…)` 안인지 보려고 쓴다 */
function enclosingParen(masked, at) {
    let depth = 0;
    for (let i = at - 1; i >= 0; i--) {
        const c = masked[i];
        if (c === ")" || c === "}" || c === "]") depth++;
        else if (c === "(" || c === "{" || c === "[") {
            if (depth === 0) return i;
            depth--;
        }
    }
    return -1;
}

const lineEnd = (s, i) => {
    const j = s.indexOf("\n", i);
    return j === -1 ? s.length : j;
};

/**
 * 가드 토큰 하나가 **지배하는 범위**. 없으면 null.
 *
 *   `if (DEV) { … }` · `if (DEV && x) { … }` · `if (DEV) stmt;`
 *   `{DEV && ( … )}`  (JSX) · `DEV ? [ … ] : []`
 *
 * ★ `makeDefaultAdProvider(import.meta.env?.DEV === true)` 처럼 **값으로 쓰인** 경우는
 *   가드가 아니다 — null 을 돌려준다. 여기서 억지로 범위를 잡으면 가드가 아닌 코드의
 *   문자열이 "개발 전용"으로 분류되어 검사기가 거짓말을 한다.
 */
export function guardRange(masked, start, end) {
    const open = enclosingParen(masked, start);
    if (open >= 0 && masked[open] === "(" && /\bif\s*$/.test(masked.slice(0, open))) {
        const close = matchBracket(masked, open);
        if (close < 0) return null;
        const b = skipWs(masked, close + 1);
        if (masked[b] === "{") {
            const e = matchBracket(masked, b);
            return e < 0 ? null : [b, e + 1];
        }
        return [b, lineEnd(masked, b)];
    }
    let i = skipWs(masked, end);
    let ternary = false;
    if (masked.slice(i, i + 2) === "&&") i += 2;
    else if (masked[i] === "?") {
        i += 1;
        ternary = true;
    } else return null;
    i = skipWs(masked, i);
    if (OPENERS[masked[i]]) {
        const e = matchBracket(masked, i);
        return e < 0 ? null : [i, e + 1];
    }
    // ★ 삼항의 **참 가지만** 가드다. `DEV ? "개발" : "배포"` 에서 줄 끝까지 잡으면
    //   "배포"(프로덕션 문구)까지 개발 전용으로 분류된다.
    const stop = lineEnd(masked, i);
    if (!ternary) return [i, stop];
    let depth = 0;
    for (let k = i; k < stop; k++) {
        const c = masked[k];
        if (OPENERS[c]) depth++;
        else if (c === "}" || c === ")" || c === "]") depth--;
        else if (c === ":" && depth === 0) return [i, k];
    }
    return [i, stop];
}

/**
 * 모듈 스코프 선언 `NAME` 의 범위. 가드 영역이 참조하는 이름을 따라가려고 쓴다.
 * ★ `{devVisible && <DevSection />}` 만 보면 `DevSection` **본문**의 문구를 놓친다.
 *   그 본문이 개발 전용 문구를 들고 있는 자리다.
 */
export function declRange(masked, name) {
    const re = new RegExp(
        `(?:^|\\n)\\s*(?:export\\s+)?(?:async\\s+)?(function|class|const|let|var)\\s+${name}\\b`
    );
    const m = re.exec(masked);
    if (!m) return null;
    const declStart = m.index + m[0].length - name.length - m[1].length - 1;
    if (m[1] === "function" || m[1] === "class") {
        const brace = masked.indexOf("{", m.index + m[0].length);
        if (brace < 0) return null;
        const e = matchBracket(masked, brace);
        return e < 0 ? null : [declStart, e + 1];
    }
    const eq = masked.indexOf("=", m.index + m[0].length);
    if (eq < 0) return null;
    const b = skipWs(masked, eq + 1);
    if (OPENERS[masked[b]]) {
        const e = matchBracket(masked, b);
        return e < 0 ? null : [declStart, e + 1];
    }
    return [declStart, lineEnd(masked, b)];
}

/**
 * 파일의 DEV 가드 영역 전부. 참조하는 모듈 스코프 선언까지 **전이적으로** 포함한다.
 * @returns {[number, number][]}
 */
export function devRegions(file, masked) {
    if (DEV_ONLY_FILE.test(file)) return [[0, masked.length]];

    const ranges = [];
    /** `const devVisible = import.meta.env.DEV;` — 별명도 가드다 */
    const aliases = new Set();
    for (const m of masked.matchAll(
        /(?:const|let|var)\s+(\w+)\s*=\s*import\.meta\.env\??\.DEV\s*[;\n]/g
    )) {
        aliases.add(m[1]);
    }

    const tokens = [];
    for (const m of masked.matchAll(DEV_TOKEN)) tokens.push([m.index, m.index + m[0].length]);
    for (const name of aliases) {
        for (const m of masked.matchAll(new RegExp(`\\b${name}\\b`, "g"))) {
            tokens.push([m.index, m.index + m[0].length]);
        }
    }
    for (const [s, e] of tokens) {
        const r = guardRange(masked, s, e);
        if (r) ranges.push(r);
    }

    /*
     * 전이 — 가드 영역이 부르는 모듈 스코프 이름을 따라간다 (깊이 3).
     *
     * ★★ **가드 밖에서도 쓰이는 이름은 따라가지 않는다.** 처음엔 무조건 따라갔다가
     *   `devVisible ? [...SECTIONS, DEV_SECTION] : SECTIONS` 의 `SECTIONS` 를 삼켜
     *   "접근성 · 데이터"(멀쩡한 설정 탭 이름)를 개발 전용 문구로 신고했다.
     *   개발 전용인지 여부는 **모든 참조가 가드 안에 있는가**로 판정해야 한다.
     */
    const seen = new Set(aliases);
    for (let depth = 0; depth < 3; depth++) {
        const added = [];
        for (const [s, e] of ranges) {
            for (const m of masked.slice(s, e).matchAll(/\b[A-Z][A-Za-z0-9_]{2,}\b/g)) {
                const name = m[0];
                if (seen.has(name)) continue;
                seen.add(name);
                const r = declRange(masked, name);
                if (!r) continue;
                // 자기 자신을 다시 삼키는 선언(가드가 그 안에 있는 경우)은 무시한다
                if (r[0] <= s && r[1] >= e) continue;
                const outside = [...masked.matchAll(new RegExp(`\\b${name}\\b`, "g"))].some(
                    (u) => !inAny(ranges, u.index) && !(u.index >= r[0] && u.index < r[1])
                );
                if (outside) continue;
                added.push(r);
            }
        }
        if (!added.length) break;
        ranges.push(...added);
    }
    return ranges;
}

const inAny = (ranges, pos) => ranges.some(([s, e]) => pos >= s && pos < e);

/* ══════════════════════ 마커 뽑기 ══════════════════════ */

/** 한글이 섞인 텍스트 덩어리 — JSX 본문 텍스트를 잡는 유일한 방법이다 */
const HANGUL_RUN = /[가-힣][가-힣A-Za-z0-9 ·%()[\].,!?/+\-—:]*[가-힣0-9%)\]]/g;

/**
 * i18n 카탈로그 키 모양 (`네임스페이스.키`).
 * ★ 이중 언어화 이후 DEV 영역에 남는 것은 한국어 문구가 아니라 **이 키**다.
 *   `src/i18n/messages/*.json` 의 파일 이름이 곧 네임스페이스이므로,
 *   서드파티 번들과 겹칠 수 없는 우리만의 모양이다.
 */
const I18N_KEY = /^[a-z][a-zA-Z0-9]*\.[a-zA-Z0-9_.]+$/;

function usable(text) {
    const t = text.trim();
    if (!t) return null;
    const hangul = /[가-힣]/.test(t);
    if (t.length < (hangul ? MIN_MARKER_HANGUL : MIN_MARKER_ASCII)) return null;
    if (!hangul && !/[A-Za-z0-9]/.test(t)) return null;
    return t;
}

/**
 * 파일에서 텍스트 조각을 뽑아 `{dev, prod}` 두 자루에 나눠 담는다.
 *
 * ★★ `devOnlyFile` 이면 **한글이 든 문구만** 마커로 쓴다.
 *   파일 전체가 개발 전용일 때는 기술 문자열(`application/json` · MIME · 클립보드 타입)까지
 *   전부 딸려 오는데, 그런 것은 **서드파티 번들에도 반드시 있다** — 실제로
 *   `"application/json"` 이 vendor 코드와 겹쳐 오검출됐다. 우리 소스만 훑는 검사기는
 *   node_modules 를 알 수 없으므로, **우리만 쓰는 모양**(한글 UI 문구)으로 좁힌다.
 *   좁은 가드(`if (DEV) {…}`)는 범위가 정확하므로 이 제한을 걸지 않는다.
 *
 * @param {string} masked 주석이 지워진 사본 (JSX 텍스트는 여기 남아 있다)
 */
function harvest(masked, literals, ranges, dev, prod, devOnlyFile = false) {
    const put = (t, isDev) => {
        if (!isDev) {
            prod.add(t);
            return;
        }
        /**
         * ★★★ **"우리만 쓰는 모양"의 정의가 둘이다** (2026-08-07 확장).
         *
         *   원래는 한글뿐이었다. 그런데 이중 언어화로 UI 문구가 카탈로그로 옮겨 가면서
         *   DEV 영역에 남는 것은 `t("companions.grantAllDev")` 라는 **ASCII 키**다.
         *   한글만 통과시키면 `Dev*` 이름 파일의 마커가 **0개**가 되고, 그 파일은
         *   가드를 지워도 조용히 통과한다. 지금은 개발 전용 파일이 0개라 잠복
         *   상태이지만, `DevFoo.jsx` 가 하나 생기는 날 그대로 터진다.
         *
         *   그래서 **i18n 키 모양(`ns.key`)도 우리만 쓰는 모양**으로 인정한다.
         *   서드파티 번들에 `companions.grantAllDev` 같은 문자열이 있을 수 없다 —
         *   `application/json` 이 겹쳤던 것과 달리 이 모양은 우리 네임스페이스다.
         */
        if (devOnlyFile && !/[가-힣]/.test(t) && !I18N_KEY.test(t)) return;
        dev.add(t);
    };
    for (const lit of literals) {
        const t = usable(lit.value);
        if (t) put(t, inAny(ranges, lit.start));
    }
    for (const m of masked.matchAll(HANGUL_RUN)) {
        const t = usable(m[0]);
        if (t) put(t, inAny(ranges, m.index));
    }
}

/* ══════════════════════ 본체 ══════════════════════ */

/**
 * ★ 순수 함수다 — 인자로 받은 맵만 본다. 테스트가 **일부러 깨뜨린 소스·번들**을 넣어
 *   검사기가 실제로 발동하는지 확인할 수 있어야 하기 때문이다
 *   ("고쳤다"가 아니라 "되돌리면 깨진다"를 만든다).
 *
 * @param {{sources: Map<string,string>, bundle: Map<string,string>,
 *          capacitor?: object, ads?: object, manifest?: string|null,
 *          stale?: string[]}} input
 */
export function analyze({
    sources,
    bundle,
    capacitor = null,
    ads = null,
    manifest = null,
    iosPlist = null,
    iosPbxproj = null,
    iosPrivacy = null,
    stale = [],
}) {
    const errors = [];
    const warnings = [];
    const infos = [];

    /* ── D1 검사 대상이 실재하고 최신인가 ── */
    const bundleJs = [...bundle.keys()].filter((f) => f.endsWith(".js"));
    const bundleCss = [...bundle.keys()].filter((f) => f.endsWith(".css"));
    if (!bundleJs.length) {
        errors.push(
            `D1 ${DIST_DIR}/ 에 번들 JS 가 없다 — \`npx vite build\` 를 먼저 돌려라. ` +
                `빌드하지 않고 통과한 검사는 아무것도 보증하지 않는다`
        );
        return { errors, warnings, infos, stats: {} };
    }
    for (const f of stale) {
        errors.push(
            `D1 ${f} 가 번들보다 새롭다 — dist 가 낡았다. \`npx vite build\` 후 다시 검사하라`
        );
    }

    /* ── 소스에서 DEV 영역과 마커를 뽑는다 ── */
    const devText = new Set();
    const prodText = new Set();
    const devGlobals = new Set();
    const devCssClasses = new Set();
    const prodCssClasses = new Set();
    const regionsOf = new Map();
    let guardCount = 0;

    for (const [file, src] of sources) {
        if (file.endsWith(".json")) {
            // 데이터의 문구는 **언제나 프로덕션 문구다.** 여기서 뽑아 두지 않으면
            // 우연히 같은 문구를 쓴 DEV 블록 때문에 거짓 실패가 난다
            // (실제로 `[perf] 첫 인터랙티브 프레임` vs analytics.json 의 labelKo 가 겹쳤다).
            for (const m of src.matchAll(HANGUL_RUN)) {
                const t = usable(m[0]);
                if (t) prodText.add(t);
            }
            for (const m of src.matchAll(/"([^"\\]{4,})"/g)) {
                const t = usable(m[1]);
                if (t) prodText.add(t);
            }
            continue;
        }
        if (file.endsWith(".css")) {
            // ★ 셀렉터의 **모든** 클래스 이름을 뽑는다. 줄 앞만 보다가 `.a, .b {` 의
            //   뒤쪽과 `.x .y` 를 놓쳐, 다른 모듈에도 있는 `.stat` 을 개발 전용으로 신고했다.
            const target = DEV_ONLY_FILE.test(file) ? devCssClasses : prodCssClasses;
            for (const m of src.matchAll(/\.([A-Za-z_][\w-]*)/g)) target.add(m[1]);
            continue;
        }

        const { masked, literals } = lex(src);
        const ranges = devRegions(file, masked);
        regionsOf.set(file, ranges);
        const devOnly = DEV_ONLY_FILE.test(file);
        if (!devOnly) guardCount += ranges.length;
        harvest(masked, literals, ranges, devText, prodText, devOnly);

        for (const m of masked.matchAll(/\b(?:globalThis|window)\.(\w+)\s*=[^=]/g)) {
            if (inAny(ranges, m.index)) devGlobals.add(m[1]);
        }

        /* ── S1 console 직접 호출 ── */
        for (const m of masked.matchAll(
            new RegExp(`\\bconsole\\s*\\.\\s*(${BANNED_CONSOLE.join("|")})\\s*\\(`, "g")
        )) {
            if (inAny(ranges, m.index)) continue;
            errors.push(
                `S1 ${file}:${masked.slice(0, m.index).split("\n").length} ` +
                    `\`console.${m[1]}()\` 를 가드 없이 호출한다 — 릴리스 체크리스트(§4) 위반. ` +
                    `진단이 필요하면 \`console.warn\`/\`console.error\` 를 쓰고, ` +
                    `개발용이면 \`if (${DEV_FLAG})\` 로 감싸라 (그래야 번들에서 사라진다)`
            );
        }
    }

    /* ── S2 Dev* 파일을 가드 밖에서 참조한다 ── */
    const devOnlyFiles = [...sources.keys()].filter((f) => DEV_ONLY_FILE.test(f));
    const devOnlyNames = new Set(
        devOnlyFiles.map((f) => P.basename(f).replace(/\.(jsx?|module\.css|css)$/, ""))
    );
    for (const [file, src] of sources) {
        if (DEV_ONLY_FILE.test(file) || !/\.jsx?$/.test(file)) continue;
        const ranges = regionsOf.get(file) ?? [];
        const { masked } = lex(src);
        for (const name of devOnlyNames) {
            // import 문은 봐주지 않는다: 참조가 **가드 안에서만** 일어나야
            // 롤업이 모듈을 통째로 접는다. 다만 재수출(index.jsx)은 참조가 아니다.
            for (const m of masked.matchAll(new RegExp(`<${name}[\\s/>]`, "g"))) {
                if (inAny(ranges, m.index)) continue;
                errors.push(
                    `S2 ${file}:${masked.slice(0, m.index).split("\n").length} 개발 전용 화면 ` +
                        `<${name}> 를 가드 없이 그린다 — \`${DEV_FLAG}\` 안에서만 참조해야 ` +
                        `프로덕션 번들에서 사라진다`
                );
            }
        }
    }

    /*
     * ── 마커 확정: DEV 에만 있고 프로덕션 코드·데이터에는 없는 문구 ──
     *
     * ★★ **부분 문자열까지 뺀다.** 마커는 `includes` 로 대조하므로, 프로덕션 문구의
     *   일부와 겹치는 짧은 조각은 반드시 걸린다. 실제로 `"riftark-analytics-"`(대시보드의
     *   내보내기 파일명)가 `"riftark-analytics-queue"`(싱크의 저장 키)에 걸려 오검출됐고,
     *   `"이벤트"` 는 데이터의 긴 문구 안에 들어 있었다.
     *   **거짓 경보 한 번이면 아무도 이 검사를 믿지 않는다** — 애매하면 뺀다.
     */
    const prodBlob = [...prodText].join("\n");
    const markers = [...devText].filter((t) => !prodBlob.includes(t));
    const cssMarkers = [...devCssClasses].filter((c) => !prodCssClasses.has(c));

    const bundleText = [...bundle]
        .filter(([f]) => !f.endsWith(".map"))
        .map(([, s]) => s)
        .join("\n");
    const jsCssText = [...bundle]
        .filter(([f]) => f.endsWith(".js") || f.endsWith(".css"))
        .map(([, s]) => s)
        .join("\n");

    /* ── B1 DEV 전용 문구가 번들에 있다 ── */
    for (const t of markers) {
        if (!bundleText.includes(t)) continue;
        errors.push(
            `B1 개발 전용 문구 "${t}" 가 프로덕션 번들에 남아 있다 — ` +
                `가드가 없거나, 있어도 트리셰이킹되지 않았다. ` +
                `런타임 조건으로 감춘 코드는 번들에 그대로 남는다`
        );
    }

    /* ── B2 DEV 전역 핸들 ── */
    for (const g of devGlobals) {
        if (!new RegExp(`\\.${g}\\s*=`).test(jsCssText)) continue;
        errors.push(
            `B2 개발용 전역 핸들 \`${g}\` 가 프로덕션 번들에 남아 있다 — ` +
                `웹뷰 콘솔에서 게임 상태를 직접 조작할 수 있게 된다`
        );
    }

    /*
     * ── B3 Dev* CSS 모듈 ──
     *
     * ★ Vite 는 CSS 모듈 클래스를 `_이름_해시` 또는 `_이름_해시_줄번호` 로 바꾸고,
     *   **한 파일의 클래스는 해시를 공유한다.** 그래서 "같은 해시를 쓰는 개발 전용
     *   클래스가 2개 이상"일 때만 신고한다. 한 개만 맞는 것은 증거가 아니다 —
     *   실제로 아틀라스 프레임 이름 `_stat_icon` 이 `.stat` 과 겹쳐 오검출됐다.
     *   ★ 뒤의 `_줄번호` 를 빼먹었다가 일부러 깨뜨린 빌드에서 **B3 가 발동하지 않았다**
     *   (실측 `_stepBarFill_niade_236`). 검사기를 깨뜨려 보지 않았다면 몰랐을 결함이다.
     */
    const byHash = new Map();
    for (const c of cssMarkers) {
        for (const m of jsCssText.matchAll(
            new RegExp(`_${c}_([a-z0-9]{4,10})(?:_\\d+)?(?![\\w-])`, "g")
        )) {
            if (!byHash.has(m[1])) byHash.set(m[1], new Set());
            byHash.get(m[1]).add(c);
        }
    }
    for (const [hash, classes] of byHash) {
        if (classes.size < 2) continue;
        errors.push(
            `B3 개발 전용 CSS 모듈이 번들 CSS 에 남아 있다 (해시 _${hash}, ` +
                `클래스 ${[...classes].slice(0, 5).join(" ")}…) — ` +
                `화면(JS)은 사라졌는데 스타일만 남았다면 그 화면을 참조하는 곳이 아직 있다`
        );
    }

    /* ── B4 소스맵 ── */
    for (const f of bundle.keys()) {
        if (f.endsWith(".map")) errors.push(`B4 소스맵이 배포된다: ${f}`);
    }
    if (/\/\/[#@]\s*sourceMappingURL=/.test(jsCssText)) {
        errors.push("B4 번들에 sourceMappingURL 주석이 있다 — 원본 소스가 그대로 복원된다");
    }

    /* ── B5 debugger ── */
    for (const [f, s] of bundle) {
        if (!/\.(js|html)$/.test(f)) continue;
        if (/(^|[^\w$.])debugger\s*[;}\n]/.test(s)) {
            errors.push(`B5 ${f} 에 \`debugger\` 문이 있다 — 콘솔이 열려 있으면 앱이 멈춘다`);
        }
    }

    /* ── B6 절대 로컬 경로 · 이메일 ── */
    const LEAKS = [
        [/[A-Za-z]:[\\/]{1,2}Users[\\/]/, "빌드 기계의 절대 경로(사용자 계정 이름이 드러난다)"],
        [/\/home\/[a-z][\w.-]*\//, "빌드 기계의 절대 경로"],
        [/\/Users\/[A-Za-z][\w.-]*\//, "빌드 기계의 절대 경로"],
        [/[\w.+-]+@[\w-]+\.[A-Za-z]{2,}/, "이메일 주소"],
    ];
    for (const [f, s] of bundle) {
        if (f.endsWith(".map")) continue;
        for (const [re, what] of LEAKS) {
            const m = re.exec(s);
            if (m) errors.push(`B6 ${f} 에 ${what}가 있다: ${JSON.stringify(m[0].slice(0, 60))}`);
        }
    }

    /* ── B7 작업 표시가 사용자에게 간다 ── */
    for (const [f, s] of bundle) {
        if (f.endsWith(".map")) continue;
        const m = /\b(TODO|FIXME|XXX|HACK)\b/.exec(s);
        if (m) {
            const at = s.slice(Math.max(0, m.index - 40), m.index + 60).replace(/\s+/g, " ");
            errors.push(`B7 ${f} 에 \`${m[1]}\` 가 남아 있다 — …${at}…`);
        }
    }

    /* ── C1 웹뷰 디버깅 ── */
    if (capacitor) {
        const v = capacitor.android?.webContentsDebuggingEnabled;
        if (v !== false) {
            errors.push(
                `C1 ${CAPACITOR_CONFIG} 의 android.webContentsDebuggingEnabled 가 ` +
                    `${JSON.stringify(v)} 다 — 릴리스에서는 반드시 false 여야 한다 (DoD §4). ` +
                    `켜져 있으면 실기기 앱을 크롬 devtools 로 열어 스토어까지 들여다볼 수 있다`
            );
        }
    } else {
        warnings.push(`C1 ${CAPACITOR_CONFIG} 을 읽지 못해 웹뷰 디버깅 설정을 검사하지 못했다`);
    }

    /* ── A1–A4 광고 배선 ──────────────────────────────────────────────
     *
     * ★★★ **광고의 실패는 전부 조용하다.** 어댑터(`native/ads.js`)는 초기화 실패 ·
     *   동의 거부 · 오프라인 · 빈 id 를 **같은 결과**로 다룬다 — 버튼이 비활성될
     *   뿐 게임은 정상이다. 그 설계는 옳지만(광고가 게임을 망가뜨리면 안 된다),
     *   **잘못된 설정도 같은 얼굴을 하고 배포된다.** 예외도 로그도 없다.
     *   그래서 사람이 아니라 여기서 잡는다.
     *
     * ⚠ **`56 §5.5` 가 제안한 규칙 ①("번들에 테스트 단위 id 가 남았는가")은
     *   그대로는 구현할 수 없다** (2026-08-08 실측). `native/ads.js` 가
     *   `import ADS from "@/game/data/ads.json"` 으로 **JSON 전체**를 들여오므로
     *   `units.testAndroid` 문자열은 **설계상 언제나 번들에 있다** — 실제 id 가
     *   비었을 때 테스트 id 로 떨어지는 폴백이 런타임에 그 값을 쓰기 때문이다.
     *   그 규칙을 곧이곧대로 넣으면 **언제나 실패**한다.
     *   같은 사고를 잡는 실제 조건은 A1(빈 id) 과 A3(testMode) 이다.
     */
    if (ads) {
        const u = ads.units ?? {};
        if (ads.enabled === true) {
            /* A1 — 켜 놓고 id 를 안 넣었다. 테스트 id 로 조용히 떨어져 **수익이 0** 이다 */
            if (!u.android) {
                errors.push(
                    `A1 ${ADS_JSON} 의 enabled 가 true 인데 units.android 가 비어 있다 — ` +
                        `어댑터가 테스트 id 로 떨어져 광고는 뜨지만 **수익이 0** 이다. ` +
                        `그 폴백은 안전한 실패 방향이지 배포해도 되는 상태가 아니다`
                );
            }
            /* A3 — 심사자가 테스트 광고를 본다. 그대로 승인되면 실제 광고가 영원히 안 뜬다 */
            if (ads.testMode === true) {
                errors.push(
                    `A3 ${ADS_JSON} 의 testMode 가 true 다 — 배포 빌드가 테스트 광고를 요청한다. ` +
                        `심사자가 그것을 보고, 그대로 승인되면 실제 광고가 영원히 뜨지 않는다`
                );
            }
        }
        /* A2 — `~` 와 `/` 를 바꿔 넣었다. 눈으로는 구분되지 않고 에러도 그 말을 안 한다 */
        for (const [k, v] of [
            ["android", u.android],
            ["ios", u.ios],
        ]) {
            if (v && !AD_UNIT_ID.test(v)) {
                errors.push(
                    `A2 ${ADS_JSON} 의 units.${k} 가 광고 단위 id 형식이 아니다: ${JSON.stringify(v)} — ` +
                        `광고 단위 id 는 슬래시(\`/\`)다. 물결(\`~\`)이면 그것은 **앱 id** 이고 ` +
                        `매니페스트에 들어갈 값이다 (\`56 §1.2\`)`
                );
            }
        }
    } else {
        warnings.push(`A1 ${ADS_JSON} 을 읽지 못해 광고 배선을 검사하지 못했다`);
    }

    /* A4 — 매니페스트의 앱 id. 이것이 틀리면 앱이 **부팅 즉시** 죽는다 */
    if (manifest !== null) {
        const m = manifest.match(
            /com\.google\.android\.gms\.ads\.APPLICATION_ID"[\s\S]{0,120}?android:value="([^"]*)"/
        );
        const appId = m?.[1];
        if (!appId) {
            errors.push(
                `A4 ${ANDROID_MANIFEST} 에 AdMob APPLICATION_ID meta-data 가 없다 — ` +
                    `SDK 의 MobileAdsInitProvider 가 프로세스 시작 시 읽으므로 ` +
                    `**광고를 꺼도 앱이 시작하자마자 죽는다**`
            );
        } else if (!AD_APP_ID.test(appId)) {
            errors.push(
                `A4 ${ANDROID_MANIFEST} 의 APPLICATION_ID 가 앱 id 형식이 아니다: ${JSON.stringify(appId)} — ` +
                    `앱 id 는 물결(\`~\`)이다. 슬래시(\`/\`)면 그것은 **광고 단위 id** 이고 ` +
                    `ads.json 에 들어갈 값이다`
            );
        } else if (appId === GOOGLE_TEST_APP_ID && ads?.enabled === true) {
            errors.push(
                `A4 ${ANDROID_MANIFEST} 의 APPLICATION_ID 가 아직 **구글 공식 테스트 앱 id** 다 — ` +
                    `광고를 켠 채 배포하면 이 앱의 노출이 내 AdMob 계정에 집계되지 않는다`
            );
        }
    } else {
        warnings.push(`A4 ${ANDROID_MANIFEST} 를 읽지 못해 AdMob 앱 id 를 검사하지 못했다`);
    }

    /* ── A5–A7 iOS 제출 배선 ────────────────────────────────────────────
     *
     * ★★★ **전부 조용히 실패한다.** 빌드는 성공하고, TestFlight 에 올라가고,
     *   실기에서 게임이 정상으로 돈다 — 그런데 심사에 못 들어가거나 경고 메일이
     *   온다. 사람이 제출 직전에 눈으로 확인하는 것이 유일한 방어였고,
     *   2026-08-10 에 셋 중 둘이 실제로 빠져 있었다.
     */
    if (iosPlist !== null) {
        /* A5 — 앱 id. 안드로이드의 A4 와 같은 사고이고 결과도 같다: 부팅 즉시 사망 */
        const m = iosPlist.match(/<key>GADApplicationIdentifier<\/key>\s*<string>([^<]*)<\/string>/);
        const appId = m?.[1];
        if (!appId) {
            errors.push(
                `A5 ${IOS_INFO_PLIST} 에 GADApplicationIdentifier 가 없다 — ` +
                    `SDK 가 초기화 시점에 예외를 던져 **광고를 꺼도 앱이 시작하자마자 죽는다**`
            );
        } else if (!AD_APP_ID.test(appId)) {
            errors.push(
                `A5 ${IOS_INFO_PLIST} 의 GADApplicationIdentifier 가 앱 id 형식이 아니다: ` +
                    `${JSON.stringify(appId)} — 앱 id 는 물결(\`~\`)이다`
            );
        } else if (appId.startsWith("ca-app-pub-3940256099942544") && ads?.enabled === true) {
            errors.push(
                `A5 ${IOS_INFO_PLIST} 의 GADApplicationIdentifier 가 아직 **구글 공식 테스트 앱 id** 다 — ` +
                    `광고를 켠 채 배포하면 이 앱의 노출이 내 AdMob 계정에 집계되지 않는다`
            );
        }

        /* A6 — 수출 규정. 없으면 빌드가 "Missing Compliance" 로 심사에 못 들어간다 */
        if (!/<key>ITSAppUsesNonExemptEncryption<\/key>/.test(iosPlist)) {
            errors.push(
                `A6 ${IOS_INFO_PLIST} 에 ITSAppUsesNonExemptEncryption 이 없다 — ` +
                    `제출할 때마다 수출 규정을 되묻고, 답하지 않은 빌드는 ` +
                    `**"Missing Compliance" 로 심사에 들어가지 못한다**`
            );
        }

        /* A7 — ATT 문구와 호출은 **언제나 함께 들어오고 함께 빠진다** */
        const hasAttString = /<key>NSUserTrackingUsageDescription<\/key>/.test(iosPlist);
        const callsAtt = [...sources.values()].some((s) => s.includes("requestTrackingAuthorization"));
        if (callsAtt && !hasAttString) {
            errors.push(
                `A7 코드가 requestTrackingAuthorization() 을 부르는데 ${IOS_INFO_PLIST} 에 ` +
                    `NSUserTrackingUsageDescription 이 없다 — iOS 는 프롬프트를 띄우지 않고 ` +
                    `**즉시 거부로 떨어진다.** 개인 맞춤 광고가 영원히 안 나간다`
            );
        } else if (!callsAtt && hasAttString) {
            errors.push(
                `A7 ${IOS_INFO_PLIST} 에 NSUserTrackingUsageDescription 이 있는데 코드가 ` +
                    `requestTrackingAuthorization() 을 부르지 않는다 — **쓰지 않는 권한 문구**다. ` +
                    `심사자가 "추적을 하는가"를 되묻고 App Privacy 의 추적 답과 대조된다`
            );
        }
    } else {
        warnings.push(`A5 ${IOS_INFO_PLIST} 를 읽지 못해 iOS 배선을 검사하지 못했다`);
    }

    /* A8 — `PrivacyInfo.xcprivacy` 가 **Xcode 타깃에 들어 있는가.**
     *
     * ★★★ 파일을 아무리 잘 써도 `project.pbxproj` 에 참조가 없으면 **IPA 에 안
     *   들어간다.** CI 는 아무 경고도 내지 않고 빌드는 성공한다 — 유일한 신호는
     *   업로드 며칠 뒤 오는 `ITMS-91053` 메일이다. 실제로 그 상태로 TestFlight
     *   빌드가 여러 번 올라갔다 (2026-08-10 발견).
     */
    /* A9 — Privacy Manifest 의 **추적 선언 정합성.**
     *
     * ★★★ Apple 규칙: `NSPrivacyTracking` 이 true 면 `NSPrivacyTrackingDomains`
     *   가 비어 있으면 안 된다. 어기면 업로드가 **ITMS-91056 (Invalid privacy
     *   manifest)** 으로 떨어지고 빌드 상태가 "잘못된 바이너리"가 된다
     *   (2026-08-10, 빌드 12 에서 실제로 당했다).
     *
     * ⚠ **도메인을 채워서 통과시키지 마라.** 이 키는 선언이 아니라 **동작**이다 —
     *   여기 적힌 도메인은 ATT 를 허용하지 않은 사용자에게 네트워크 요청이
     *   실패한다. 구글 광고 도메인을 적으면 ATT 거부 사용자에게 **비개인화
     *   광고까지 막히고**, 개인정보 처리방침의 "거부해도 광고는 계속 표시됩니다"
     *   가 거짓이 된다. 우리 1차 코드는 네트워크를 타지 않으므로 정답은 false 다
     *   (SDK 는 자기 매니페스트에 자기 도메인을 선언하고 Xcode 가 병합한다).
     */
    if (iosPrivacy !== null) {
        const tracking = /<key>NSPrivacyTracking<\/key>\s*<true\s*\/>/.test(iosPrivacy);
        const domainsBlock = iosPrivacy.match(
            /<key>NSPrivacyTrackingDomains<\/key>\s*<array\s*(\/>|>([\s\S]*?)<\/array>)/
        );
        const domainCount = (domainsBlock?.[2]?.match(/<string>/g) ?? []).length;
        if (tracking && domainCount === 0) {
            errors.push(
                `A9 ${IOS_PRIVACY} 의 NSPrivacyTracking 이 true 인데 ` +
                    `NSPrivacyTrackingDomains 가 비어 있다 — 업로드가 ITMS-91056 으로 ` +
                    `거부되고 빌드가 "잘못된 바이너리"가 된다. ` +
                    `⚠ 도메인을 채워서 통과시키지 마라: 그 도메인은 ATT 거부 사용자에게 ` +
                    `**실제로 차단**되어 비개인화 광고까지 막는다. 우리 1차 코드는 ` +
                    `네트워크를 타지 않으므로 false 가 정답이다`
            );
        }
        if (!tracking && domainCount > 0) {
            errors.push(
                `A9 ${IOS_PRIVACY} 의 NSPrivacyTracking 이 false 인데 ` +
                    `NSPrivacyTrackingDomains 에 도메인이 ${domainCount}개 있다 — ` +
                    `Apple 은 도메인이 있으면 tracking 이 true 여야 한다고 본다`
            );
        }
    } else {
        warnings.push(`A9 ${IOS_PRIVACY} 를 읽지 못해 추적 선언을 검사하지 못했다`);
    }

    if (iosPbxproj !== null) {
        if (!iosPbxproj.includes("PrivacyInfo.xcprivacy")) {
            errors.push(
                `A8 ${IOS_PBXPROJ} 에 PrivacyInfo.xcprivacy 참조가 없다 — ` +
                    `파일이 디스크에 있어도 **IPA 에 들어가지 않는다.** 빌드는 성공하고 ` +
                    `며칠 뒤 ITMS-91053 (Missing API declaration) 메일이 온다`
            );
        }
    } else {
        warnings.push(`A8 ${IOS_PBXPROJ} 를 읽지 못해 Privacy Manifest 포함 여부를 검사하지 못했다`);
    }

    /* ── 참고 (실패는 아니지만 사람이 봐야 하는 것) ── */
    if (!markers.length) {
        warnings.push(
            "DEV 전용 문구를 하나도 뽑지 못했다 — 가드가 전부 사라졌거나 렉서가 깨졌다. " +
                "이 상태의 '통과'는 아무것도 보증하지 않는다"
        );
    }
    for (const f of devOnlyFiles) infos.push(`개발 전용 파일: ${f}`);

    const jsBytes = bundleJs.reduce((n, f) => n + Buffer.byteLength(bundle.get(f)), 0);
    const cssBytes = bundleCss.reduce((n, f) => n + Buffer.byteLength(bundle.get(f)), 0);

    return {
        errors,
        warnings,
        infos,
        markers,
        cssMarkers,
        devGlobals: [...devGlobals],
        stats: {
            sourceFiles: sources.size,
            guardCount,
            devOnlyFiles: devOnlyFiles.length,
            markerCount: markers.length,
            cssMarkerCount: cssMarkers.length,
            bundleFiles: bundleJs.length + bundleCss.length,
            jsBytes,
            cssBytes,
        },
    };
}

/* ══════════════════════ 입력 수집 ══════════════════════ */

/** 소스가 번들보다 새로우면 그 파일 목록. 검사 대상이 낡았다는 뜻이다. */
async function staleAgainstBundle(root, sources) {
    const bundleFiles = (await walk(DIST_DIR, [], root)).filter((f) =>
        /assets\/index-.*\.js$/.test(f)
    );
    if (!bundleFiles.length) return [];
    let built = Infinity;
    for (const f of bundleFiles) built = Math.min(built, (await stat(path.join(root, f))).mtimeMs);
    const out = [];
    for (const f of [...sources.keys(), "index.html", "vite.config.js"]) {
        try {
            if ((await stat(path.join(root, f))).mtimeMs > built + 1000) out.push(f);
        } catch {
            /* 없으면 볼 것도 없다 */
        }
    }
    return out;
}

/**
 * CLI 와 테스트가 **같은 입력**을 쓰게 하기 위한 것이다.
 * 테스트가 자기만의 로딩 절차를 가지면 "검사기는 통과하는데 테스트는 다른 것을 본다"가 된다.
 */
export async function loadProject(root = ROOT) {
    const [sources, bundle] = await Promise.all([loadSources(root), loadBundle(root)]);
    let capacitor = null;
    try {
        capacitor = JSON.parse(await readFile(path.join(root, CAPACITOR_CONFIG), "utf8"));
    } catch {
        /* analyze 가 경고한다 */
    }
    let ads = null;
    try {
        ads = JSON.parse(await readFile(path.join(root, ADS_JSON), "utf8"));
    } catch {
        /* analyze 가 경고한다 */
    }
    let manifest = null;
    try {
        manifest = await readFile(path.join(root, ANDROID_MANIFEST), "utf8");
    } catch {
        /* analyze 가 경고한다 */
    }
    let iosPlist = null;
    try {
        iosPlist = await readFile(path.join(root, IOS_INFO_PLIST), "utf8");
    } catch {
        /* analyze 가 경고한다 */
    }
    let iosPbxproj = null;
    try {
        iosPbxproj = await readFile(path.join(root, IOS_PBXPROJ), "utf8");
    } catch {
        /* analyze 가 경고한다 */
    }
    let iosPrivacy = null;
    try {
        iosPrivacy = await readFile(path.join(root, IOS_PRIVACY), "utf8");
    } catch {
        /* analyze 가 경고한다 */
    }
    const stale = await staleAgainstBundle(root, sources);
    return { sources, bundle, capacitor, ads, manifest, iosPlist, iosPbxproj, iosPrivacy, stale };
}

/* ══════════════════════ CLI ══════════════════════ */

const kb = (n) => `${(n / 1024).toFixed(1)}KB`;

async function main() {
    const input = await loadProject();
    const r = analyze(input);
    const st = r.stats;

    console.log("── 디버그 잔재 · 프로덕션 빌드 점검 (P8-06) ───");
    console.log(
        `소스 ${st.sourceFiles}파일 · DEV 가드 ${st.guardCount}곳 · 개발 전용 파일 ${st.devOnlyFiles}개`
    );
    if (st.bundleFiles) {
        console.log(
            `번들 ${st.bundleFiles}파일 (JS ${kb(st.jsBytes)} · CSS ${kb(st.cssBytes)}) 를 실제로 스캔`
        );
        console.log(
            `대조 마커 ${st.markerCount}개 (문구) + ${st.cssMarkerCount}개 (CSS 클래스) + ` +
                `${r.devGlobals.length}개 (전역 핸들: ${r.devGlobals.join(" ") || "없음"})`
        );
    }
    for (const i of r.infos) console.log(`· ${i}`);
    for (const w of r.warnings) console.warn(`⚠ ${w}`);
    for (const e of r.errors) console.error(`✗ ${e}`);

    console.log("───────────────────────────────────────────────");
    if (r.errors.length) {
        console.error(`✗ 디버그 잔재 ${r.errors.length}건 · 경고 ${r.warnings.length}건`);
        process.exitCode = 1;
        return;
    }
    console.log(
        `✅ 통과 — 개발 전용 마커 ${st.markerCount + st.cssMarkerCount + r.devGlobals.length}개 ` +
            `전부 번들에 없음 (경고 ${r.warnings.length}건)`
    );
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
    await main();
}
