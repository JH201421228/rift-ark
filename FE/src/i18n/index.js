/**
 * i18n — 한국어 · 영어 (2026-08-07)
 *
 * ★★★ **왜 이 모듈이 존재하는가.**
 *
 *   이 게임은 처음부터 한국어 기준으로 만들어졌다 (CLAUDE.md 절대규칙 9).
 *   그 결정은 옳았지만 — 한글이 라틴의 약 2배 폭이라 한국어에 맞추면 영어는
 *   반드시 들어간다, 반대는 반드시 깨진다 — **문자열이 JSX 안에 그대로 박혀
 *   있다**는 뜻이기도 했다. 영어권에 팔려면 그 문자열들이 한 곳에 모여야 한다.
 *
 * ★★★ **한국어와 영어를 같은 자리에 적는다.**
 *
 *   `ko.json` 과 `en.json` 을 따로 두는 흔한 구조를 쓰지 않는다. 이 저장소가
 *   반복해서 당한 단일 실패 유형이 **"같은 사실을 두 곳에 적으면 갈라진다"**이고,
 *   두 파일 구조는 그 사고를 **설계로 보장**한다 — 한쪽에 키를 더하고 다른 쪽을
 *   잊으면 그 화면은 영어에서 `undefined` 를 그린다. 그래서 한 항목이 두 언어를
 *   함께 갖는다:
 *
 *     "title": { "ko": "방주", "en": "The Ark" }
 *
 *   키를 더하는 사람은 두 언어를 **동시에** 보고, 빠뜨리면 `check:i18n` 이 잡는다.
 *
 * ★★ **네임스페이스마다 파일이 하나다** (`messages/*.json`).
 *   카탈로그 하나에 전부 넣으면 병렬 작업에서 그 파일이 유일한 충돌 지점이 된다
 *   (이 저장소의 병렬 작업 규약: 파일 소유권). 파일 이름이 곧 네임스페이스이고,
 *   키는 `<파일명>.<키>` 다 — `messages/ark.json` 의 `title` → `ark.title`.
 *
 * ★★ **`import.meta.glob` 을 쓰지 않는다.** 편하지만 Vite 전용이라, 순수 Node 로
 *   이 모듈 계통을 로드하는 하네스·검사기(`tools/*.mjs`)에서 그 자리가 터진다.
 *   대신 아래에 **명시적으로 import** 하고, 빠뜨리는 실수는 `check:i18n` 이
 *   `messages/` 디렉터리와 이 목록을 대조해서 잡는다.
 *
 * ★ 언어는 **모듈 스코프의 값 하나**다 (`current`). React 밖(Phaser 씬 ·
 *   `logic/` 의 라벨 함수)에서도 같은 답이 나와야 하기 때문이다. 시뮬레이션 수학은
 *   이 값을 읽지 않으므로 결정론(절대규칙 1)은 영향을 받지 않는다 — 바뀌는 것은
 *   **표시되는 글자**뿐이다.
 *
 * @see docs/03-tech/29-i18n.md
 */
import ark from "./messages/ark.json" with { type: "json" };
import battle from "./messages/battle.json" with { type: "json" };
import common from "./messages/common.json" with { type: "json" };
import companions from "./messages/companions.json" with { type: "json" };
import guide from "./messages/guide.json" with { type: "json" };
import loadout from "./messages/loadout.json" with { type: "json" };
import result from "./messages/result.json" with { type: "json" };
import rules from "./messages/rules.json" with { type: "json" };
import settings from "./messages/settings.json" with { type: "json" };
import stages from "./messages/stages.json" with { type: "json" };
import system from "./messages/system.json" with { type: "json" };
import terms from "./messages/terms.json" with { type: "json" };
import title from "./messages/title.json" with { type: "json" };

/**
 * ★ 순서는 상관없지만 **키는 파일 이름에서 온다.** 여기서 이름을 바꾸면
 *   그 네임스페이스의 모든 키가 바뀐다 — `check:i18n` 이 파일명과 대조한다.
 */
const NAMESPACES = {
    ark,
    battle,
    common,
    companions,
    guide,
    loadout,
    result,
    rules,
    settings,
    stages,
    system,
    terms,
    title,
};

/** 지원 언어. 순서가 곧 설정 화면의 버튼 순서다. */
export const LANGS = ["ko", "en"];
export const DEFAULT_LANG = "ko";

/**
 * 평평한 조회표 `{"ark.title": {ko, en}}`.
 * ★ 부팅 때 한 번 만든다. 매 조회마다 두 단계 객체를 타면 HUD 가 10Hz 로 그 비용을 낸다.
 * ★ `$` 로 시작하는 키는 **문서용 주석**이다 (이 저장소의 JSON 관례) — 건너뛴다.
 */
const TABLE = Object.create(null);
for (const [ns, table] of Object.entries(NAMESPACES)) {
    for (const [key, val] of Object.entries(table)) {
        if (key.startsWith("$")) continue;
        TABLE[`${ns}.${key}`] = val;
    }
}

/**
 * 현재 언어. **모듈 스코프에 하나뿐이다.**
 * ★ 바꾸는 곳은 `setLang` 하나이고, 부르는 곳은 `App.jsx` 하나다.
 *   화면마다 각자 바꾸면 "설정에서는 영어인데 전투 HUD 는 한국어"가 생긴다.
 */
let current = DEFAULT_LANG;

/** 언어가 바뀌었을 때 다시 그려야 하는 비-React 소비자 (Phaser 씬 등) */
const listeners = new Set();

export function getLang() {
    return current;
}

/**
 * 언어를 바꾼다.
 * @returns {boolean} 실제로 바뀌었는가 (같은 값이면 false — 구독자를 깨우지 않는다)
 */
export function setLang(lang) {
    const next = LANGS.includes(lang) ? lang : DEFAULT_LANG;
    if (next === current) return false;
    current = next;
    for (const fn of listeners) fn(next);
    return true;
}

/** 비-React 소비자용 구독. 반환값을 부르면 해제된다 (절대규칙 3 — 씬 shutdown 에서 부른다). */
export function onLangChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

/**
 * 브라우저·기기 로케일에서 초기 언어를 고른다.
 *
 * ★ **한국어가 아니면 영어**다. 세 번째 언어가 없으므로 "지원하지 않는 로케일은
 *   한국어" 로 두면 영어권 사용자가 읽을 수 없는 화면을 처음 본다 — 그 첫인상이
 *   유료앱에서는 곧 환불이다.
 * ★ 저장된 설정이 있으면 **그것이 이긴다.** 이 함수는 신규 계정에만 쓰인다.
 */
export function detectLang(navigatorLanguages) {
    const list =
        navigatorLanguages ??
        (typeof navigator !== "undefined"
            ? (navigator.languages ?? [navigator.language])
            : null);
    /**
     * ★★ **로케일을 물어볼 곳이 없으면 기본값(한국어)이다.** 헤드리스 Node —
     *   밸런스 하네스 · 검사기 · vitest — 에는 `navigator` 가 없다. 여기서 "en" 으로
     *   떨어뜨리면 그 환경들의 라벨이 전부 영어가 되고, 한국어 기준으로 쓰인
     *   스냅샷·검사기 문구가 통째로 어긋난다.
     */
    if (!list || list.length === 0) return DEFAULT_LANG;
    for (const l of list) {
        if (typeof l === "string" && l.toLowerCase().startsWith("ko")) return "ko";
    }
    return "en";
}

/**
 * 문자열 조회.
 *
 * @param {string} key `<네임스페이스>.<키>`
 * @param {Record<string, string|number>} [params] `{n}` 자리에 끼워 넣을 값
 * @param {string} [lang] 언어를 강제한다 (테스트·검사기용). 기본은 현재 언어.
 * @returns {string}
 *
 * ★★ **없는 키는 키 자체를 돌려준다.** 빈 문자열이면 화면에서 조용히 사라지고,
 *   `undefined` 면 React 가 아무것도 그리지 않는다. 둘 다 **침묵**이고, 이 저장소가
 *   가장 자주 당한 사고의 모양이다. 키가 그대로 보이면 못 보고 지나칠 수 없다.
 *   (그리고 `check:i18n` 이 애초에 배포 전에 잡는다.)
 *
 * ★ 한쪽 언어만 비어 있으면 **한국어로 떨어진다.** 번역이 늦은 항목이 화면을
 *   비우는 것보다는 낫다 — 다만 그 상태는 `check:i18n` 이 오류로 잡으므로
 *   저장소에 남을 수 없다.
 */
export function t(key, params, lang) {
    const entry = TABLE[key];
    if (!entry) return key;
    const L = lang ?? current;
    const raw = entry[L] ?? entry.ko ?? key;
    return params ? interpolate(raw, params) : raw;
}

/**
 * `{name}` 치환.
 * ★ 정규식을 매번 만들지 않는다. 그리고 **없는 자리는 그대로 둔다** — 지워 버리면
 *   "이름이 빠진 문장"이 자연스러워 보여서 아무도 눈치채지 못한다.
 */
const PLACEHOLDER = /\{(\w+)\}/g;
function interpolate(raw, params) {
    return raw.replace(PLACEHOLDER, (m, name) => (name in params ? String(params[name]) : m));
}

/**
 * 데이터 객체에서 현재 언어의 필드를 고른다.
 *
 * ★★ 게임 데이터(`game/data/*.json`)의 이름·설명은 카탈로그로 옮기지 **않는다.**
 *   유닛 50종 · 적 62종 · 각인 18 · 주문 12 의 이름을 별도 파일로 빼면, 밸런스를
 *   만지는 사람이 두 파일을 오가야 하고 그 순간 둘이 갈라진다. 대신 **같은 항목
 *   안에** 두 언어를 나란히 둔다 — 카탈로그와 정확히 같은 원칙이다.
 *
 * ★★★ **정본 형태는 `{ "name": { "ko": …, "en": … } }` 다.**
 *   `units.json` · `enemies.json` · `sigils.json` 이 이미 그 형태였다 (동료 50 ·
 *   적 62 · 각인 18 — 저장소에서 가장 큰 세 집합). 나머지 파일들은 `nameKo` 이거나
 *   그냥 한국어 문자열이었고, **세 가지 형태가 공존**하고 있었다.
 *   `data:validate` 가 지금은 `{ko, en}` 하나만 인정한다. 아래 두 갈래는
 *   **읽기 호환**을 위한 것이고, 새 데이터를 그렇게 적으면 검사기가 막는다.
 *
 * @param {object} obj  `{ name: {ko, en}, ... }`
 * @param {string} base `"name"` · `"desc"` · `"flavor"`
 * @param {string} [lang]
 */
export function pick(obj, base, lang) {
    if (!obj) return "";
    const L = lang ?? current;
    const v = obj[base];
    // ① 정본 — { ko, en }
    if (v && typeof v === "object") return v[L] ?? v.ko ?? "";
    // ② 구형 — nameKo / nameEn
    const flat = obj[base + (L === "ko" ? "Ko" : "En")] ?? obj[base + "Ko"];
    if (typeof flat === "string") return flat;
    // ③ 번역되지 않은 순수 문자열
    return typeof v === "string" ? v : "";
}

/** 검사기·테스트가 쓰는 전체 표 (읽기 전용으로 다룰 것) */
export function allEntries() {
    return TABLE;
}
