/**
 * P9-04 — 접근성 검사
 *
 * ★★ **묻는 질문은 하나다: "색이나 움직임 말고 다른 채널이 있는가, 그리고 그 채널을
 *   끄는 스위치가 정말로 전부에 닿는가."**
 *
 *   이 저장소가 반복해서 겪은 결함의 모양 그대로다 — 문법은 완전한데 **목록에서
 *   한 곳이 빠진다.** 접근성에서 그 결함은 조용하다: 화면 흔들림을 껐는데 보스가
 *   등장하면 화면이 확대되고, 색약 모드를 켰는데 등급은 여전히 색으로만 구분되고,
 *   프리뷰가 "결계"라고 가르친 태그를 패배 화면이 "마법저항"이라고 부른다.
 *   lint 도 타입도 테스트도 아무 말을 하지 않는다. 발견하는 것은 사용자다.
 *
 * ★★ **값을 여기에 다시 적지 않는다.** 설정 키는 `settings.json` 에서, 알림 스위치는
 *   태그 이름은 `logic/labels.js`·`logic/tags.js` 에서
 *   **실제로 import 해서** 대조한다. 검사기가 값을 베끼면 그 순간 두 번째 출처가 되고,
 *   두 출처는 반드시 갈라진다.
 *
 * ★★ **검사할 수 없는 것을 검사한 척하지 않는다.**
 *   대비(contrast)를 자동 판정하려면 각 글자가 실제로 어떤 배경 위에 놓이는지
 *   알아야 하는데, CSS 만 읽어서는 알 수 없다. 시도해 보니 `color: #0f0f1e`
 *   (금색 버튼 위의 어두운 글자)가 "대비 1.00:1" 로 잡혀 22건 중 절반 이상이
 *   거짓 양성이었다. 그래서 대비는 **검사하지 않고 사람이 잰다** (구현 노트에 실측표).
 *   대신 기계가 확실히 답할 수 있는 것만 남겼다 — 아래 6가지.
 *
 * 검사 목록
 *   M1  카메라 연출이 CameraFx 를 우회한다 (셰이크 설정이 닿지 않는 경로)
 *   A1  settings.json 의 키와 settingsSlice 의 배선표가 어긋난다
 *   A2  색약 스위치가 DOM 에서 죽어 있다 (세우기만 하고 아무도 안 읽음)
 *   A3  등급을 색으로만 표시한다 (`--rarity-*` 를 공용 컴포넌트 밖에서 씀)
 *   A4  글자가 최소 크기보다 작다
 *   A5  태그·데미지 타입 이름의 사본이 생겼다
 *
 * 사용:
 *   node tools/check-a11y.mjs
 *
 * @see docs/02-design/18-ux-ui.md §6
 * @see docs/04-plan/33-execution-plan.md P9-04
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const P = path.posix;

/* ── 구조 상수 (밸런스 수치가 아니다 — 프로젝트 레이아웃과 규율이다) ────── */

/** 카메라를 움직이는 유일한 문. 접근성 설정을 아는 곳도 여기 하나뿐이다. */
export const CAMERA_GATE = "src/game/fx/CameraFx.js";
/**
 * 카메라 **연출** 메서드. `setZoom`·`setScroll` 은 뷰포트 배치(viewport.js)이고
 * 애니메이션이 아니므로 제외한다 — 그것까지 막으면 레터박스 계산이 불가능해진다.
 */
const CAMERA_FX_METHODS = [
    "shake",
    "flash",
    "fade",
    "fadeIn",
    "fadeOut",
    "zoomTo",
    "pan",
    "rotateTo",
];

export const SETTINGS_JSON = "src/game/data/settings.json";
export const SETTINGS_SLICE = "src/store/slices/settingsSlice.js";
export const SETTINGS_SCREEN = "src/screens/SettingsScreen.jsx";
/** 배선표 두 개를 가르는 표식. 이 문장이 사라지면 검사기가 먼저 실패한다. */
const DEFERRED_TABLE_MARK = "아직 아무도 읽지 않는 키";

export const APP_FILE = "src/App.jsx";
/** 색약 모드를 DOM 에 세우는 속성. 세우기만 하고 CSS 가 안 읽으면 죽은 스위치다. */
const COLORBLIND_ATTR = "colorblind";

/** 등급 색을 쓰는 유일한 컴포넌트. */
export const RARITY_CSS = "src/components/RarityName.module.css";
/**
 * 예외 — **이유를 적지 않으면 예외가 아니다.**
 * `Shop.module.css` 의 등급 색은 확률 공개표에서 쓰인다. 거기서는 셀의 **본문 자체가**
 * 등급 이름("레전더리") 또는 등급 코드("L") 이므로 색이 정보를 혼자 지고 있지 않다.
 */
export const RARITY_CSS_ALLOW = new Set([RARITY_CSS, "src/screens/Shop.module.css"]);

/**
 * 최소 글자 크기(px).
 * ★ 9px 한글은 1280×720 을 그대로 업스케일하는 기기에서 획이 뭉개진다. 사용자가
 *   키울 수는 있지만(텍스트 크기 3단계), **기본값이 읽히지 않는 것**은 설정으로
 *   해결할 문제가 아니다. 한글은 라틴의 2배 폭이고 획이 두 배로 촘촘하다 (절대규칙 9).
 */
export const MIN_FONT_PX = 10;

/** 태그 이름 사본으로 판정할 최소 개수. 2개는 우연일 수 있고 3개는 표다. */
const COPY_THRESHOLD = 3;
/** 이름의 단일 출처. 여기만 표를 가진다. */
export const LABELS_FILE = "src/game/logic/labels.js";

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
 * `src/` 의 JS·JSX·CSS·JSON 을 전부 읽는다.
 * ★ 테스트 파일은 제외한다 — 검사 대상은 앱이지 검사기가 아니다.
 */
export async function loadSources(root = ROOT) {
    const files = await walk("src", []);
    const map = new Map();
    for (const f of files) {
        if (!/\.(js|jsx|css|json)$/.test(f) || /\.test\.jsx?$/.test(f)) continue;
        map.set(f, await readFile(path.join(root, f), "utf8"));
    }
    return map;
}

/**
 * 주석을 공백으로 **덮은** 소스. **모든 스캔은 이 위에서 한다.**
 *
 * ★ 주석에 적힌 예시가 위반으로 잡히면 검사기가 거짓말을 한다. 실제로 이 저장소의
 *   주석에는 갈라졌던 이름 표(`ARMORED: "장갑" …`)와 되돌린 코드 예시가 그대로 적혀
 *   있다 — 결함을 설명한 문장이 결함으로 잡히면 아무도 설명을 쓰지 않게 된다.
 * ★ **줄 수를 보존한다.** 지워 버리면 보고하는 줄 번호가 어긋나고, 줄 번호가 틀린
 *   검사기는 곧 무시된다. CSS 의 `/* *\/` 도 같은 함수로 처리한다.
 */
export function stripComments(src) {
    return src
        .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
        .split("\n")
        .map((l) => (/^\s*\/\//.test(l) ? "" : l))
        .join("\n");
}

const lineOf = (src, index) => src.slice(0, index).split("\n").length;

/**
 * 메서드 본문을 중괄호 짝으로 잘라낸다. 없으면 null.
 * ★ 파서를 붙이지 않는 이유: 이 검사기가 보는 것은 "이 본문 안에 shakeScale 이
 *   있는가" 하나뿐이고, 그 질문에 AST 는 과잉이다. 다만 **창을 글자 수로 자르지는
 *   않는다** — 다음 메서드가 새어 들어오면 검사가 조용히 통과한다.
 */
export function methodBody(src, name) {
    const at = src.indexOf(`${name}(`);
    if (at < 0) return null;
    const open = src.indexOf("{", at);
    if (open < 0) return null;
    let depth = 0;
    for (let i = open; i < src.length; i++) {
        if (src[i] === "{") depth++;
        else if (src[i] === "}" && --depth === 0) return src.slice(open, i + 1);
    }
    return null;
}

/* ── 배선표 파싱 ───────────────────────────────────────────── */

/**
 * `settingsSlice.js` 상단 JSDoc 의 마크다운 표 두 개를 읽는다.
 *
 * ★ 이 표는 **사람이 쓴 주장**이다("이 키는 여기에 반영된다"). 검사기가 하는 일은
 *   그 주장이 데이터와 어긋나지 않게 붙잡아 두는 것이다. 표를 소스 밖에 따로 두면
 *   그것 자체가 세 번째 출처가 된다.
 *
 * @returns {{wired: string[], deferred: string[], ok: boolean}}
 */
export function parseWiringTables(sliceSrc) {
    const mark = sliceSrc.indexOf(DEFERRED_TABLE_MARK);
    if (mark < 0) return { wired: [], deferred: [], ok: false };
    const head = sliceSrc.slice(0, mark);
    const tail = sliceSrc.slice(mark);
    const rows = (text) => {
        const out = [];
        for (const m of text.matchAll(/^\s*\*\s*\|\s*([A-Za-z][\w· ]*?)\s*\|/gm)) {
            for (const key of m[1].split("·").map((k) => k.trim())) {
                // 표 머리글(`키`)·구분선은 걸러진다 — 영문 식별자만 받는다
                if (/^[a-z]\w*$/.test(key)) out.push(key);
            }
        }
        return out;
    };
    return { wired: rows(head), deferred: rows(tail), ok: true };
}

/* ── 본체 ──────────────────────────────────────────────────── */

/**
 * 위반 목록을 돌려준다.
 *
 * ★ 순수 함수다 — 인자로 받은 소스 맵만 본다. 테스트가 **일부러 깨뜨린 소스**를 넣어
 *   검사기가 실제로 발동하는지 확인할 수 있어야 하기 때문이다
 *   ("고쳤다"가 아니라 "되돌리면 깨진다"를 만든다).
 *
 * @param {Map<string,string>} sources 저장소 상대경로 → 소스
 * @param {{notifyKeys?: string[], tagNames?: string[], damageTypes?: string[]}} [rules]
 *        규칙 모듈에서 **실제로 읽어** 넘긴 값. 여기에 다시 적지 않는다.
 */
export function analyze(sources, rules = {}) {
    const { notifyKeys = [], tagNames = [], damageTypes = [] } = rules;
    const errors = [];
    const warnings = [];
    const code = new Map();
    for (const [f, s] of sources) {
        // JSON 에는 주석이 없다. 그 밖(js · jsx · css)은 전부 주석을 덮고 본다.
        code.set(f, f.endsWith(".json") ? s : stripComments(s));
    }

    /* ── M1 · 카메라 연출이 CameraFx 를 우회하는가 ────────────── */
    const camRe = new RegExp(
        `cameras\\s*\\.\\s*main\\s*\\.\\s*(${CAMERA_FX_METHODS.join("|")})\\s*\\(`,
        "g"
    );
    for (const [file, src] of code) {
        if (file === CAMERA_GATE || !/\.(js|jsx)$/.test(file)) continue;
        for (const m of src.matchAll(camRe)) {
            errors.push(
                `M1 ${file}:${lineOf(src, m.index)} 가 \`cameras.main.${m[1]}()\` 를 직접 부른다 — ` +
                    `접근성 설정(settings.screenShake)을 아는 곳은 ${CAMERA_GATE} 하나뿐이므로, ` +
                    `이 한 줄만 설정을 무시한다. 사용자에게는 "껐는데 흔들린다"로 보인다`
            );
        }
    }
    if (!code.has(CAMERA_GATE)) {
        errors.push(`M1 ${CAMERA_GATE} 가 없다 — 카메라 연출의 접근성 관문이 사라졌다`);
    } else {
        /**
         * 관문이 정작 설정을 안 보면 관문이 아니다.
         * ★ 메서드 **본문**을 중괄호 짝으로 잘라서 본다. "이름 뒤 400자" 같은 창으로
         *   보면 다음 메서드의 `shakeScale` 이 새어 들어와 검사가 통과해 버린다 —
         *   1차 구현이 실제로 그랬고, 되돌린 소스를 넣었는데 아무 말도 하지 않았다.
         */
        const gate = code.get(CAMERA_GATE);
        for (const fn of ["zoomPulse", "damageFlash"]) {
            const body = methodBody(gate, fn);
            if (body === null) {
                errors.push(`M1 ${CAMERA_GATE} 에서 ${fn}() 본문을 찾지 못했다`);
            } else if (!/shakeScale/.test(body)) {
                errors.push(
                    `M1 ${CAMERA_GATE}:${fn}() 가 shakeScale 을 보지 않는다 — ` +
                        `화면 전체가 움직이는 연출인데 "화면 흔들림 끄기"가 닿지 않는다`
                );
            }
        }
    }

    /* ── A1 · 설정 키 ↔ 배선표 ───────────────────────────────── */
    const settingsRaw = sources.get(SETTINGS_JSON);
    const sliceSrc = sources.get(SETTINGS_SLICE);
    const screenSrc = code.get(SETTINGS_SCREEN);
    if (!settingsRaw || !sliceSrc || !screenSrc) {
        errors.push("A1 설정 파일 3개(json · slice · screen) 중 일부를 읽지 못했다");
    } else {
        const defaults = Object.keys(JSON.parse(settingsRaw).defaults ?? {});
        const { wired, deferred, ok } = parseWiringTables(sliceSrc);
        if (!ok) {
            errors.push(
                `A1 ${SETTINGS_SLICE} 에서 "${DEFERRED_TABLE_MARK}" 표식을 찾지 못했다 — ` +
                    `배선표 모양이 바뀌었다면 이 검사기도 같이 고쳐야 한다`
            );
        }
        const documented = new Set([...wired, ...deferred]);
        for (const key of defaults) {
            if (!documented.has(key)) {
                errors.push(
                    `A1 settings.json 의 \`${key}\` 가 ${SETTINGS_SLICE} 배선표에 없다 — ` +
                        `어디에 반영되는지 아무도 적지 않은 설정은 배선되지 않은 설정과 구별되지 않는다`
                );
            }
        }
        for (const key of documented) {
            if (!defaults.includes(key)) {
                errors.push(
                    `A1 배선표에 있는 \`${key}\` 가 settings.json:defaults 에 없다 — ` +
                        `지워진 설정이 표에만 남았거나, 오타다`
                );
            }
        }
        // 화면 노출: 리터럴로 나오거나, 알림처럼 규칙 모듈의 목록으로 렌더된다
        const loopExposed = new Set(notifyKeys);
        for (const key of wired) {
            const exposed = new RegExp(`\\b${key}\\b`).test(screenSrc) || loopExposed.has(key);
            if (!exposed) {
                errors.push(
                    `A1 \`${key}\` 는 배선되어 있다고 적혀 있는데 ${SETTINGS_SCREEN} 에 없다 — ` +
                        `되돌릴 수 없는 설정은 설정이 아니다`
                );
            }
        }
        for (const key of deferred) {
            if (new RegExp(`\\b${key}\\b`).test(screenSrc)) {
                errors.push(
                    `A1 \`${key}\` 는 "${DEFERRED_TABLE_MARK}" 표에 있는데 ${SETTINGS_SCREEN} 이 노출한다 — ` +
                        `아무것도 하지 않는 스위치를 누른 사용자는 "설정이 먹통"이라고 결론짓는다`
                );
            }
        }
    }

    /* ── A2 · 색약 스위치가 DOM 에서 살아 있는가 ─────────────── */
    const appSrc = code.get(APP_FILE) ?? "";
    const setsAttr = new RegExp(`dataset\\.${COLORBLIND_ATTR}\\s*=`).test(appSrc);
    let readsAttr = false;
    for (const [file, src] of code) {
        if (!file.endsWith(".css")) continue;
        if (new RegExp(`\\[data-${COLORBLIND_ATTR}\\s*=`).test(src)) readsAttr = true;
    }
    if (!setsAttr) {
        errors.push(
            `A2 ${APP_FILE} 이 \`data-${COLORBLIND_ATTR}\` 를 세우지 않는다 — ` +
                `색약 모드가 DOM 에 도달할 경로가 없다`
        );
    } else if (!readsAttr) {
        errors.push(
            `A2 \`data-${COLORBLIND_ATTR}\` 를 세우기만 하고 읽는 CSS 가 하나도 없다 — ` +
                `스위치가 죽어 있다. 사용자는 켰다고 믿고, 화면은 아무것도 바뀌지 않는다`
        );
    }

    /* ── A3 · 등급을 색으로만 표시하는가 ─────────────────────── */
    for (const [file, src] of code) {
        if (/\.(js|jsx)$/.test(file)) {
            for (const m of src.matchAll(/var\(\s*--rarity-/g)) {
                errors.push(
                    `A3 ${file}:${lineOf(src, m.index)} 이 등급 색을 인라인 스타일로 쓴다 — ` +
                        `등급을 색으로만 표시하면 적록색약 사용자에게 그 정보는 존재하지 않는다. ` +
                        `<RarityName> 을 쓰면 색약 모드에서 등급 표기가 함께 붙는다`
                );
            }
        }
        // ★ `var(--rarity-…)` 를 **쓰는** 곳만 본다. `index.css` 의 변수 **선언**은
        //   팔레트이고, 팔레트가 있다는 사실 자체는 결함이 아니다.
        if (file.endsWith(".css") && /var\(\s*--rarity-/.test(src) && !RARITY_CSS_ALLOW.has(file)) {
            errors.push(
                `A3 ${file} 이 등급 색을 직접 쓴다 — 등급 색을 칠하는 자리는 ${RARITY_CSS} 하나여야 ` +
                    `색약 모드가 전부에 닿는다. 예외가 필요하면 이 검사기의 RARITY_CSS_ALLOW 에 ` +
                    `**이유와 함께** 등록한다`
            );
        }
    }

    /* ── A4 · 최소 글자 크기 ─────────────────────────────────── */
    for (const [file, src] of code) {
        if (!file.endsWith(".css")) continue;
        for (const m of src.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) {
            if (Number(m[1]) >= MIN_FONT_PX) continue;
            errors.push(
                `A4 ${file}:${lineOf(src, m.index)} font-size ${m[1]}px 는 최소 ${MIN_FONT_PX}px 보다 작다 — ` +
                    `한글은 라틴의 2배 폭이고 획이 그만큼 촘촘하다 (절대규칙 9)`
            );
        }
    }

    /* ── A5 · 이름 사본 ──────────────────────────────────────── */
    const korean = /[가-힣]/;
    const copyScan = (names, what) => {
        for (const [file, src] of code) {
            if (file === LABELS_FILE || !/\.(js|jsx)$/.test(file)) continue;
            const hit = new Set();
            for (const name of names) {
                const re = new RegExp(`(?:^|[\\s{,])${name}\\s*:\\s*["'\`]([^"'\`]*)["'\`]`, "m");
                const m = src.match(re);
                if (m && korean.test(m[1])) hit.add(name);
            }
            if (hit.size >= COPY_THRESHOLD) {
                errors.push(
                    `A5 ${file} 이 ${what} 이름 표를 직접 들고 있다 (${[...hit].sort().join(" · ")} …) — ` +
                        `${LABELS_FILE} 가 단일 출처다. 사본은 반드시 갈라지고, 색약 사용자에게 ` +
                        `**글자는 색 대신 남는 유일한 채널**이므로 화면마다 다른 단어는 곧 학습의 단절이다`
                );
            }
        }
    };
    if (tagNames.length) copyScan(tagNames, "태그");
    if (damageTypes.length) copyScan(damageTypes, "데미지 타입");
    if (!tagNames.length || !damageTypes.length) {
        warnings.push("A5 규칙 모듈에서 태그·데미지 타입 목록을 읽지 못해 사본 검사를 건너뛰었다");
    }

    return {
        errors,
        warnings,
        stats: {
            files: code.size,
            cssFiles: [...code.keys()].filter((f) => f.endsWith(".css")).length,
        },
    };
}

/* ── 규칙 모듈 실측 ────────────────────────────────────────── */

/**
 * 검사에 필요한 목록을 **규칙 모듈에서 직접 불러온다.**
 * ★ 여기서 값을 다시 적으면 검사기가 두 번째 출처가 된다
 *   (`check-reachability.mjs:readUnlockValues` 와 같은 규약).
 */
export async function loadRules(root = ROOT) {
    const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);
    const [tags, labels] = await Promise.all([imp("src/game/logic/tags.js"), imp(LABELS_FILE)]);
    return {
        // ★ 알림 스위치는 2026-08-04 경량화로 사라졌다. `loopExposed` 배선은 남긴다 —
        //   "규칙 모듈의 목록으로 렌더되는 설정"이 다시 생기는 날 여기만 채우면 된다.
        notifyKeys: [],
        tagNames: Object.keys(tags.TAG ?? {}),
        damageTypes: labels.DAMAGE_TYPES ?? [],
    };
}

/** CLI 와 테스트가 **같은 입력**을 쓰게 하기 위한 한 번의 로딩. */
export async function loadProject(root = ROOT) {
    const [sources, rules] = await Promise.all([loadSources(root), loadRules(root)]);
    return { sources, rules };
}

/* ── CLI ───────────────────────────────────────────────────── */

async function main() {
    const { sources, rules } = await loadProject();
    const r = analyze(sources, rules);

    console.log("── 접근성 검사 (P9-04) ────────────────────────");
    console.log(
        `소스 ${r.stats.files}파일 (CSS ${r.stats.cssFiles}) · ` +
            `태그 ${rules.tagNames.length} · 데미지 타입 ${rules.damageTypes.length} 를 규칙 모듈에서 읽었다`
    );
    for (const w of r.warnings) console.warn(`⚠ ${w}`);
    for (const e of r.errors) console.error(`✗ ${e}`);
    console.log("───────────────────────────────────────────────");

    if (r.errors.length) {
        console.error(`✗ 접근성 결함 ${r.errors.length}건 · 경고 ${r.warnings.length}건`);
        process.exitCode = 1;
        return;
    }
    console.log(`✅ 통과 — M1 · A1 · A2 · A3 · A4 · A5 (경고 ${r.warnings.length}건)`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
    await main();
}
