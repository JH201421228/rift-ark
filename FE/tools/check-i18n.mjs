/**
 * i18n 검사기 — "번역했다"가 참인지 기계가 확인한다.
 *
 * ★★★ **이 저장소에서 번역이 실패하는 방식은 정해져 있다.**
 *
 *   ① 키를 한 언어에만 적는다 → 다른 언어에서 그 자리가 빈다
 *   ② 카탈로그에 키를 만들고 화면은 여전히 하드코딩 문자열을 그린다
 *      (= 선언했는데 아무도 읽지 않는 것 — 이 저장소의 단일 실패 유형)
 *   ③ `{n}` 자리표가 한쪽에만 있다 → 영어 문장에서 숫자가 통째로 사라진다
 *   ④ 데이터에 `nameKo` 만 있고 `nameEn` 이 없다 → 영어에서 한국어가 튀어나온다
 *   ⑤ `messages/` 에 파일을 추가하고 `index.js` 에 import 를 잊는다
 *      → 그 네임스페이스 전체가 조용히 키 문자열로 표시된다
 *
 *   다섯 가지 전부 **예외도 로그도 없이** 지나간다. lint 도 테스트도 잡지 못한다.
 *   그래서 검사기가 있다.
 *
 * ★★ **`PENDING` 은 부채 목록이다.** 아직 하드코딩 한국어가 남은 파일을 여기 적어
 *   두면 I4 가 봐준다. 목록이 비는 날이 번역이 끝나는 날이고, **줄어들기만 해야
 *   한다** — 새 파일을 여기 더하는 것은 회귀다.
 *
 * 사용:
 *   node tools/check-i18n.mjs
 *   node tools/check-i18n.mjs --list-korean <파일>   # 그 파일의 한국어 문자열만 뽑는다
 */
import { readdir, readFile } from "node:fs/promises";
import { join, dirname, basename, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const MSG_DIR = join(SRC, "i18n/messages");
const DATA_DIR = join(SRC, "game/data");

/** 한글 음절 + 자모 */
const HANGUL = /[가-힣ㄱ-ㆎ]/;

/**
 * 아직 하드코딩 한국어가 남아 있는 파일 (I4 면제).
 * ★ **줄어들기만 한다.** 여기에 이름을 더하려면 그 이유를 같은 줄에 적을 것.
 */
const PENDING = new Set([
    // (번역 진행 중 — 비워지면 I4 가 전 화면을 지킨다)
]);

/**
 * I4 를 아예 보지 않는 경로.
 * ★ 면제가 아니라 **대상이 아닌 것**이다 — 카탈로그 자신, 게임 데이터(두 언어를
 *   함께 갖는 것이 정본이라 I5 가 따로 본다), 테스트(한국어 설명이 곧 문서다),
 *   그리고 개발 전용 진단 UI.
 */
const NOT_APPLICABLE = [
    `i18n${sep}`,
    `game${sep}data${sep}`,
    ".test.js",
    ".test.jsx",
    `components${sep}FaultLog`,
    `components${sep}FaultOverlay`,
    /**
     * ★ 해금 감사기의 출력은 **`npm run check:unlocks` 의 콘솔**로만 간다.
     *   사용자 화면에 도달하는 경로가 없고, 그 문장들은 개발자에게 "무엇이 왜
     *   잘못됐는지"를 말하는 진단문이다 — 번역하면 읽는 사람이 줄고 얻는 것이 없다.
     */
    `logic${sep}unlockAudit.js`,
];

/* ────────────────────────── 유틸 ────────────────────────── */

async function walk(dir, out = []) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) {
            if (e.name === "node_modules" || e.name === "dist") continue;
            await walk(p, out);
        } else out.push(p);
    }
    return out;
}

/**
 * 주석과 import 경로를 지운다.
 *
 * ★★ **주석을 지우지 않으면 이 검사기는 쓸모가 없다.** 이 저장소의 주석은
 *   대부분 한국어이고 본문보다 길다 — 지우지 않으면 모든 파일이 실패한다.
 * ★ 문자열 리터럴 안의 `//` 를 주석으로 오인하지 않도록 따옴표 상태를 추적한다.
 *   (`"https://…"` 를 주석으로 읽으면 그 뒤 한 줄이 통째로 사라진다.)
 */
function stripComments(src) {
    let out = "";
    let i = 0;
    let quote = null;
    while (i < src.length) {
        const c = src[i];
        const n = src[i + 1];
        if (quote) {
            if (c === "\\") {
                out += "  ";
                i += 2;
                continue;
            }
            if (c === quote) quote = null;
            out += c;
            i++;
            continue;
        }
        if (c === '"' || c === "'" || c === "`") {
            quote = c;
            out += c;
            i++;
            continue;
        }
        if (c === "/" && n === "/") {
            while (i < src.length && src[i] !== "\n") {
                out += " ";
                i++;
            }
            continue;
        }
        if (c === "/" && n === "*") {
            i += 2;
            out += "  ";
            while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) {
                out += src[i] === "\n" ? "\n" : " ";
                i++;
            }
            i += 2;
            out += "  ";
            continue;
        }
        // JSX 주석 {/* … */} 은 위 블록 주석 규칙이 그대로 처리한다
        out += c;
        i++;
    }
    return out;
}

/**
 * **개발자에게만 가는 출력**을 지운다 — `console.*(…)` 와 `new Error(…)`.
 *
 * ★★ 이 둘은 번역 대상이 아니다. `console.warn` 은 프로덕션 빌드에서 사용자가 볼 수
 *   없고(`check:prod` 가 잔재를 따로 잡는다), `new Error` 의 message 는 이 저장소에서
 *   **개발 중 오타·미구현을 그 자리에서 드러내려고** 한국어로 쓴 것이다
 *   (`stageConfig.js:"알 수 없는 스테이지"`). 그 문장을 영어로 번역하면 읽는 사람이
 *   줄고 얻는 것이 없다.
 *
 * ★ 그러나 **화면에 그 message 를 그리는 경로가 있으면 이야기가 다르다.**
 *   그런 곳은 `catch` 에서 잡아 카탈로그 문구로 바꾸는 것이 규약이고,
 *   그 규약을 어긴 곳은 이 검사가 아니라 `ScreenErrorBoundary` 리뷰가 잡는다.
 *
 * ★ 괄호를 세어 여는 곳부터 닫는 곳까지 지운다 — 여러 줄 템플릿 리터럴이 흔하다.
 *   줄 번호가 어긋나지 않게 개행은 남긴다.
 */
function stripDevOutput(src) {
    const START = /console\.\w+\s*\(|new Error\s*\(/g;
    let out = src;
    let m;
    START.lastIndex = 0;
    const spans = [];
    while ((m = START.exec(src))) {
        let depth = 1;
        let i = m.index + m[0].length;
        while (i < src.length && depth > 0) {
            const c = src[i];
            if (c === "(") depth++;
            else if (c === ")") depth--;
            i++;
        }
        spans.push([m.index, i]);
        START.lastIndex = i;
    }
    for (const [a, b] of spans.reverse()) {
        out = out.slice(0, a) + out.slice(a, b).replace(/[^\n]/g, " ") + out.slice(b);
    }
    return out;
}

/**
 * 한국어가 남아 있는 줄 (줄번호, 발췌).
 *
 * ★★ **줄 단위 면제**: 그 줄에 `i18n-exempt:` 가 있으면 건너뛴다. 이유를 같은 줄에
 *   적어야 하므로 면제가 **눈에 보이고 검색된다.** 파일 통째로 봐주는 `PENDING` 과
 *   달리 이것은 영구적일 수 있다 — 세이브에 남은 옛 문자열처럼 **번역하면 안 되는**
 *   한국어가 실제로 있기 때문이다 (마이그레이션 대조용 상수 등).
 */
function koreanLines(src) {
    const raw = src.split("\n");
    const cleaned = stripDevOutput(stripComments(src)).split("\n");
    const hits = [];
    cleaned.forEach((line, idx) => {
        if (!HANGUL.test(line)) return;
        if ((raw[idx] ?? "").includes("i18n-exempt:")) return;
        hits.push({ line: idx + 1, text: line.trim().slice(0, 110) });
    });
    return hits;
}

/* ────────────────────────── 검사 ────────────────────────── */

const errors = [];
const warns = [];
const fail = (code, msg) => errors.push(`[${code}] ${msg}`);
const warn = (code, msg) => warns.push(`[${code}] ${msg}`);

/** I1 · I3 — 카탈로그 항목이 두 언어를 갖고, 자리표가 서로 맞는가 */
async function checkCatalog() {
    const files = (await readdir(MSG_DIR)).filter((f) => f.endsWith(".json"));
    const keys = new Set();

    for (const f of files) {
        const ns = basename(f, ".json");
        let table;
        try {
            table = JSON.parse(await readFile(join(MSG_DIR, f), "utf8"));
        } catch (e) {
            fail("I1", `messages/${f} 파싱 실패 — ${e.message}`);
            continue;
        }
        for (const [key, val] of Object.entries(table)) {
            if (key.startsWith("$")) continue;
            const full = `${ns}.${key}`;
            keys.add(full);

            if (typeof val !== "object" || val === null || Array.isArray(val)) {
                fail("I1", `${full} — 항목은 { "ko": …, "en": … } 객체여야 한다`);
                continue;
            }
            for (const L of ["ko", "en"]) {
                if (typeof val[L] !== "string" || val[L].trim() === "") {
                    fail("I1", `${full} — '${L}' 가 없거나 비어 있다`);
                }
            }
            if (typeof val.ko === "string" && typeof val.en === "string") {
                const ph = (s) => (s.match(/\{(\w+)\}/g) ?? []).sort().join(",");
                if (ph(val.ko) !== ph(val.en)) {
                    fail(
                        "I3",
                        `${full} — 자리표가 다르다. ko:[${ph(val.ko) || "없음"}] en:[${ph(val.en) || "없음"}]`
                    );
                }
                /**
                 * 영어 항목에 한글이 남아 있으면 번역이 안 된 것이다.
                 * ★ 두 값이 **글자까지 같으면** 번역하지 않기로 한 것이다 (endonym ·
                 *   고유명사). I5 와 같은 규칙이다 — 이름을 열거하지 않고 규칙 하나로 둔다.
                 */
                if (HANGUL.test(val.en) && val.en !== val.ko) {
                    fail("I1", `${full} — 영어 항목에 한글이 남아 있다: "${val.en}"`);
                }
            }
        }
    }
    return { files, keys };
}

/** I2 — messages/ 의 모든 파일이 index.js 에 import 되어 있는가 */
async function checkIndexImports(files) {
    const src = await readFile(join(SRC, "i18n/index.js"), "utf8");
    for (const f of files) {
        const ns = basename(f, ".json");
        if (!src.includes(`./messages/${f}`)) {
            fail("I2", `messages/${f} 를 i18n/index.js 가 import 하지 않는다 — 그 네임스페이스는 통째로 죽는다`);
        }
        if (!new RegExp(`^\\s{4}${ns},`, "m").test(src)) {
            fail("I2", `i18n/index.js 의 NAMESPACES 에 '${ns}' 가 없다`);
        }
    }
}

/** I4 — 화면 코드에 하드코딩 한국어가 남아 있는가 */
async function checkHardcoded() {
    const files = (await walk(SRC)).filter((p) => /\.(js|jsx)$/.test(p));
    let pendingSeen = new Set();

    for (const p of files) {
        const rel = relative(SRC, p);
        if (NOT_APPLICABLE.some((x) => rel.includes(x))) continue;
        const src = await readFile(p, "utf8");
        const hits = koreanLines(src);
        if (!hits.length) continue;

        if (PENDING.has(rel.split(sep).join("/"))) {
            pendingSeen.add(rel.split(sep).join("/"));
            continue;
        }
        for (const h of hits.slice(0, 6)) {
            fail("I4", `src/${rel}:${h.line} 하드코딩 한국어 — ${h.text}`);
        }
        if (hits.length > 6) {
            fail("I4", `src/${rel} — 그 밖에 ${hits.length - 6}줄 더`);
        }
    }

    for (const p of PENDING) {
        if (!pendingSeen.has(p)) {
            warn("I4", `PENDING 에 있지만 한국어가 없다: ${p} — 목록에서 지울 것`);
        }
    }
}

/**
 * I5 — 게임 데이터의 사용자 노출 필드가 두 언어를 갖는가.
 *
 * ★ 정본은 `{ "name": { "ko": …, "en": … } }` 다. `nameKo` 만 있는 것과
 *   그냥 한국어 문자열인 것을 둘 다 잡는다.
 */
const DATA_FIELDS = ["name", "desc", "flavor", "label", "title", "body", "hint", "lore"];

function scanDataNode(node, path, file) {
    if (Array.isArray(node)) {
        node.forEach((v, i) => scanDataNode(v, `${path}[${i}]`, file));
        return;
    }
    if (!node || typeof node !== "object") return;

    for (const [k, v] of Object.entries(node)) {
        if (k.startsWith("$") || k.startsWith("_")) continue;
        const here = path ? `${path}.${k}` : k;

        if (DATA_FIELDS.includes(k)) {
            if (typeof v === "string") {
                if (HANGUL.test(v)) {
                    fail("I5", `${file}: ${here} 가 한국어 문자열이다 — { "ko": …, "en": … } 로 바꿀 것`);
                }
                continue;
            }
            if (v && typeof v === "object" && !Array.isArray(v)) {
                const hasKo = typeof v.ko === "string" && v.ko.trim() !== "";
                const hasEn = typeof v.en === "string" && v.en.trim() !== "";
                if (hasKo && !hasEn) fail("I5", `${file}: ${here}.en 이 없다`);
                if (hasEn && !hasKo) fail("I5", `${file}: ${here}.ko 가 없다`);
                /**
                 * ★★ `ko` 와 `en` 이 **글자까지 같으면** 번역하지 않기로 한 것이다.
                 *   언어 이름(endonym) · 고유명사 · 기호가 그렇다 — 영어 화면에서도
                 *   `한국어` 라고 적어야 한국어만 읽는 사람이 되돌아올 수 있다.
                 *   '같다'를 조건으로 두면 **실수로 번역을 빠뜨린 것**(en 에 한국어
                 *   원문이 그대로 남은 것)과 구분된다 — 그쪽은 두 값이 다르다.
                 */
                if (hasEn && HANGUL.test(v.en) && v.en !== v.ko) {
                    fail("I5", `${file}: ${here}.en 에 한글이 남아 있다 — "${v.en}"`);
                }
                if (hasKo || hasEn) continue;
            }
        }
        // `nameKo` 꼴 — 구형이다
        for (const base of DATA_FIELDS) {
            if (k === `${base}Ko` || k === `${base}En`) {
                fail("I5", `${file}: '${k}' 는 구형이다 — '${base}': { "ko", "en" } 로 합칠 것`);
            }
        }
        scanDataNode(v, here, file);
    }
}

async function checkData() {
    const files = (await readdir(DATA_DIR)).filter((f) => f.endsWith(".json"));
    for (const f of files) {
        // attributions.json 은 생성물이고 원문(라이선스 문구)을 번역하지 않는다
        if (f === "attributions.json") continue;
        const json = JSON.parse(await readFile(join(DATA_DIR, f), "utf8"));
        scanDataNode(json, "", f);
    }
}

/**
 * **id 로 동적 조회되는 이름 공간.** I6 의 "아무도 안 부른다" 경고에서 면제된다.
 * ★ 개별 키가 아니라 **접두**만 등록한다 — 규칙이 있는 이름 공간만 봐준다는 뜻이다.
 */
const DYNAMIC_PREFIX = [
    "terms.", // t("terms.tag." + tagId) 꼴
    "guide.", // 가이드 주제 id 로 조회
    "companions.effect.", // 별 트리 효과 종류로 조회
    "rules.", // 안정 code(loadoutAnalysis) · 태그 id(stagePreview) · 난이도 id 로 조회한다
    "system.fault.", // 진단 코드로 조회
];

/** I6 — 코드가 부르는 키가 카탈로그에 있는가 / 카탈로그에만 있고 안 쓰는 키 */
async function checkKeyUsage(keys) {
    const files = (await walk(SRC)).filter((p) => /\.(js|jsx)$/.test(p));
    const used = new Set();
    // t("ns.key") · t('ns.key') · t(`ns.key`)
    const CALL = /\bt\(\s*["'`]([a-zA-Z0-9_.]+)["'`]/g;
    for (const p of files) {
        if (relative(SRC, p).startsWith("i18n")) continue;
        const src = stripComments(await readFile(p, "utf8"));
        for (const m of src.matchAll(CALL)) used.add(m[1]);
    }
    for (const k of used) {
        if (!keys.has(k)) fail("I6", `t("${k}") — 카탈로그에 없는 키다 (화면에 키가 그대로 뜬다)`);
    }
    for (const k of keys) {
        /**
         * 동적 조회(`"terms.tag." + id`)는 정적으로 셀 수 없다 — 접두 규칙이 있는 것은 봐준다.
         * ★ 여기 접두를 더하는 것은 "이 이름 아래는 **id 로 조회한다**"는 선언이다.
         *   개별 키를 봐주는 것이 아니라 **규칙이 있는 이름 공간**만 봐준다 —
         *   규칙이 없으면 오타 하나가 조용한 빈칸이 되고 아무도 못 본다.
         */
        if (DYNAMIC_PREFIX.some((p) => k.startsWith(p))) continue;
        if (!used.has(k)) warn("I6", `${k} — 카탈로그에 있지만 아무도 부르지 않는다`);
    }
}

/* ────────────────────────── 실행 ────────────────────────── */

async function main() {
    const listArg = process.argv.indexOf("--list-korean");
    if (listArg >= 0) {
        const target = process.argv[listArg + 1];
        const src = await readFile(join(ROOT, target), "utf8");
        for (const h of koreanLines(src)) console.log(`${h.line}\t${h.text}`);
        return;
    }

    const { files, keys } = await checkCatalog();
    await checkIndexImports(files);
    await checkData();
    await checkHardcoded();
    await checkKeyUsage(keys);

    for (const w of warns) console.warn(`  경고 ${w}`);
    if (errors.length) {
        console.error(`\ni18n 검사 실패 — ${errors.length}건\n`);
        for (const e of errors.slice(0, 60)) console.error(`  ${e}`);
        if (errors.length > 60) console.error(`  … 그 밖에 ${errors.length - 60}건`);
        process.exit(1);
    }
    console.log(
        `i18n 검사 통과 — 네임스페이스 ${files.length}개 · 키 ${keys.size}개 · 경고 ${warns.length}건`
    );
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
