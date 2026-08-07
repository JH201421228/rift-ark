/**
 * 배선 검사 — **"선언해 놓고 아무도 안 읽는 것"을 기계가 찾는다** (2026-08-05)
 *
 * ★★ 이 저장소가 반복해서 겪는 결함은 문법 오류가 아니라 **끊긴 배선**이다.
 *   데이터도 있고 문서도 있고 설정 화면에 값도 저장되는데, 그것을 **읽는 코드가
 *   0줄**이다. lint 는 아무 말도 하지 않는다 — 데이터는 유효한 JSON 이고,
 *   설정은 정상적으로 저장되며, 아무도 부르지 않는 export 도 문법적으로 완전하다.
 *   발견하는 것은 사용자이고, 사용자가 내리는 결론은 "이 게임은 대충 만들었다"다.
 *
 *   전수 조사(2026-08-05)가 찾아낸 네 건이 전부 이 모양이었다:
 *     · `enemies.json` 의 `art.outline` 10종 — 참조 0건
 *     · `settings.qualityTier` — 저장만 되고 읽는 코드 0줄
 *     · `native/haptics.js:hapticHit` — 정의 1회 · 호출 0회
 *     · `DebugScene` — 문서 3곳이 규정하는데 파일 없음
 *
 * ★★ **규칙을 개별 이름이 아니라 '모양'으로 쓴다.** "outline 을 읽는가"가 아니라
 *   "`enemies.json` 의 `art.*` **키 전부**를 읽는가"로 물어야, 다음에 누가 새 필드를
 *   더하고 읽는 코드를 빠뜨렸을 때도 잡힌다. 이름을 하나씩 적는 검사기는
 *   자기가 아는 것만 지킨다.
 *
 * ★ 검사기가 두 번째 출처가 되지 않게, 목록은 전부 **실제 파일에서 뽑는다** —
 *   적 art 키는 `enemies.json` 에서, 티어 필드는 `quality.json` 에서,
 *   햅틱 함수 이름은 `haptics.js` 의 export 에서.
 *
 * ★ 주석은 지우고 본다. 주석에 적힌 예시가 "읽고 있다"로 세어지면 검사기가 거짓말을 한다.
 *
 * @see tools/check-a11y.mjs — 같은 규약("고쳤다"가 아니라 "되돌리면 깨진다")
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname, resolve, relative, sep } from "node:path";
import { stripComments } from "../../tools/check-a11y.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/* ── 검사 대상 파일 (경로는 저장소 상대) ─────────────────────── */

export const ENEMIES_JSON = "src/game/data/enemies.json";
export const QUALITY_JSON = "src/game/data/quality.json";
export const HAPTICS = "src/native/haptics.js";
export const SCENE_INDEX = "src/game/scenes/index.js";
export const DEBUG_SCENE = "src/game/scenes/DebugScene.js";
export const GAME_MANAGER = "src/game/GameManager.js";
export const PRESENTER_DIR = "src/game/presenters";
export const SCENE_DIR = "src/game/scenes";
export const LOGIC_DIR = "src/game/logic";
/**
 * ★★ W1 은 `enemies.json` 의 `art.*` 소비처가 **전부 프레젠터**라고 가정했다.
 *   2026-08-05 에 적 11종이 `art.projectile` 을 갖게 되면서 그 가정이 깨졌다 —
 *   발사체 그림은 프레젠터가 아니라 `stageConfig.js:normalizeDef` 가 집어
 *   `BattleScene` 의 `_projEnemy` 까지 나른다 (아군이 예전부터 그 경로다).
 *
 * ★ 예외를 **이름으로** 적는다. "어디서 읽어도 된다"로 넓히면 W1 이 통과만 하는
 *   검사가 되고, 통과만 하는 검사는 없는 것보다 나쁘다.
 * ★ 정규화를 지난 값이 화면까지 닿는지는 `tools/validate-data.mjs` 의 발사체 절이
 *   본다 (`ENEMY_DEFS[e.id].projectile.shape`). 여기서는 **읽히는가**만 본다.
 */
export const ART_CONSUMER_DIR = { projectile: LOGIC_DIR };
/** EventBus 이벤트를 **소비**하는 쪽 — 여기서 구독하면 어딘가는 쏘아야 한다 */
const CONSUMER_DIRS = ["src/hud", "src/screens", "src"];

function walk(rel, out) {
    for (const name of readdirSync(join(ROOT, rel))) {
        const child = `${rel}/${name}`;
        if (statSync(join(ROOT, child)).isDirectory()) walk(child, out);
        else out.push(child);
    }
    return out;
}

/** `src/` 전체의 js·jsx·json. 테스트 파일은 뺀다 — 검사 대상은 앱이지 검사기가 아니다 */
export function loadSources() {
    const map = new Map();
    for (const f of walk("src", [])) {
        if (!/\.(js|jsx|json)$/.test(f) || /\.test\.jsx?$/.test(f)) continue;
        map.set(f, readFileSync(join(ROOT, f), "utf8"));
    }
    return map;
}

const under = (file, dir) => file === dir || file.startsWith(`${dir}/`);

/* ── 본체 ──────────────────────────────────────────────────── */

/**
 * 끊긴 배선 목록을 돌려준다.
 *
 * ★ 순수 함수다 — 인자로 받은 소스 맵만 본다. 테스트가 **일부러 끊은 소스**를 넣어
 *   검사기가 실제로 발동하는지 확인할 수 있어야 하기 때문이다.
 *
 * @param {Map<string,string>} sources 저장소 상대경로 → 소스
 */
export function analyze(sources) {
    const errors = [];
    const code = new Map();
    for (const [f, s] of sources) code.set(f, f.endsWith(".json") ? s : stripComments(s));

    /**
     * 주어진 디렉터리 아래 코드에 정규식이 걸리는가.
     * @param {string[]} [skip] 제외할 파일 — "읽기는 하지만 **적용하지는** 않는" 곳
     */
    const seenIn = (dir, re, skip = []) => {
        for (const [f, s] of code) {
            if (!/\.(js|jsx)$/.test(f) || !under(f, dir) || skip.includes(f)) continue;
            if (re.test(s)) return f;
        }
        return null;
    };

    /* ── W1 · 적 아트 필드를 전부 읽는가 ──────────────────────
     *
     * ★ `art.outline` 이 10종에 적혀 있는데 참조가 0건이었다. 데이터를 넣은 사람은
     *   "엘리트가 눈에 띄게 됐다"고 믿었고, 화면에서는 아무 일도 없었다.
     */
    const enemiesRaw = sources.get(ENEMIES_JSON);
    if (!enemiesRaw) {
        errors.push(`W1 ${ENEMIES_JSON} 을 읽지 못했다`);
    } else {
        const keys = new Set();
        for (const e of JSON.parse(enemiesRaw).enemies ?? []) {
            for (const k of Object.keys(e.art ?? {})) keys.add(k);
        }
        if (!keys.size) errors.push(`W1 ${ENEMIES_JSON} 에서 art 필드를 하나도 뽑지 못했다`);
        for (const k of keys) {
            // `art.outline` · `art?.outline` — 소비처가 실제로 손에 쥐는 모양
            const re = new RegExp(`\\bart\\??\\.${k}\\b`);
            const dir = ART_CONSUMER_DIR[k] ?? PRESENTER_DIR;
            if (!seenIn(dir, re)) {
                errors.push(
                    `W1 enemies.json 의 \`art.${k}\` 를 ${dir}/ 에서 읽는 코드가 없다 — ` +
                        `데이터를 적은 사람은 화면이 바뀐다고 믿지만 아무 일도 일어나지 않는다`
                );
            }
        }
    }

    /* ── W2 · 품질 티어 표를 전부 소비하는가 ──────────────────
     *
     * ★ 표에 값만 늘고 읽는 곳이 없으면, 그 필드는 "저사양에서 줄어든다"는
     *   **주장**일 뿐이다. 26-performance-budget.md 의 원래 표가 정확히 그랬다.
     */
    const qualityRaw = sources.get(QUALITY_JSON);
    if (!qualityRaw) {
        errors.push(`W2 ${QUALITY_JSON} 을 읽지 못했다`);
    } else {
        const fields = new Set();
        for (const t of Object.values(JSON.parse(qualityRaw).tiers ?? {})) {
            for (const k of Object.keys(t)) fields.add(k);
        }
        if (!fields.size) errors.push(`W2 ${QUALITY_JSON} 에 티어가 하나도 없다`);
        /**
         * ★★ 디버그 오버레이는 **읽는 곳으로 세지 않는다.** 그것은 값을 화면에
         *   찍을 뿐 아무것도 줄이지 않는다. 세어 주면 "개발 화면에는 뜨는데
         *   실제로는 아무 일도 없는" 상태가 이 검사를 그대로 통과한다 —
         *   일부러 끊어 보고서야 드러난 구멍이다.
         */
        const REPORT_ONLY = [`${SCENE_DIR}/DebugScene.js`];
        for (const k of fields) {
            const re = new RegExp(`\\bquality\\??\\.${k}\\b`);
            if (!seenIn(SCENE_DIR, re, REPORT_ONLY)) {
                errors.push(
                    `W2 quality.json 의 \`${k}\` 를 ${SCENE_DIR}/ 에서 읽는 코드가 없다 — ` +
                        `성능 예산 표에 값만 늘고 아무것도 줄지 않는다`
                );
            }
        }
        if (!seenIn(SCENE_DIR, /settings\.qualityTier\b/, REPORT_ONLY)) {
            errors.push(
                "W2 `settings.qualityTier` 를 씬이 읽지 않는다 — " +
                    "설정 화면이 저장하는 값이 전투에 도달하지 못한다"
            );
        }
    }

    /* ── W3 · 내보낸 햅틱이 실제로 불리는가 ───────────────────
     *
     * ★ `hapticHit` 은 정의 1회 · 호출 0회였다. 크리티컬도 방주 피격도
     *   진동하지 않았고, 설정의 "진동" 스위치는 UI 탭에만 걸려 있었다.
     */
    const hapticsSrc = code.get(HAPTICS);
    if (!hapticsSrc) {
        errors.push(`W3 ${HAPTICS} 을 읽지 못했다`);
    } else {
        const names = [...hapticsSrc.matchAll(/export\s+const\s+(haptic\w+)/g)].map((m) => m[1]);
        if (!names.length) errors.push(`W3 ${HAPTICS} 에서 haptic* export 를 뽑지 못했다`);
        for (const name of names) {
            const re = new RegExp(`\\b${name}\\s*\\(`);
            let called = false;
            for (const [f, s] of code) {
                if (f === HAPTICS || !/\.(js|jsx)$/.test(f)) continue;
                if (re.test(s)) {
                    called = true;
                    break;
                }
            }
            if (!called) {
                errors.push(
                    `W3 \`${name}\` 은 정의만 있고 부르는 곳이 없다 — ` +
                        `19-art-audio-direction.md §6.5 가 규정한 진동 채널 하나가 죽어 있다`
                );
            }
        }
    }

    /* ── W4 · DebugScene 이 등록되어 있고, 지워질 수 있는 모양인가 ─
     *
     * ★ 문서 3곳이 "DebugScene 이 보여 준다"고 규정하는데 파일이 없었다.
     *
     * ★★ **정적 import 는 DEV 삼항으로 감싸도 번들에서 사라지지 않는다** (실측,
     *   2026-08-05). `class X extends Phaser.Scene` 의 상위 클래스가 멤버 접근식
     *   이라 롤업이 부수효과로 보고 모듈을 남긴다 — 삼항만 접히고 클래스는
     *   `dist` 에 그대로 실렸다. 그래서 여기서 요구하는 것은 "가드가 있는가"가
     *   아니라 **"동적 import 인가, 그리고 정적 import 가 없는가"** 다.
     *   check:prod 는 이 결함을 못 잡는다 (오버레이 문구가 한글 UI 문구가 아니라
     *   ASCII 라벨이라 마커로 뽑히지 않는다) — 그래서 이 규칙이 필요하다.
     */
    if (!code.has(DEBUG_SCENE)) {
        errors.push(`W4 ${DEBUG_SCENE} 이 없다 — 문서 3곳이 이 씬이 있다고 규정한다`);
    }
    const managerSrc = code.get(GAME_MANAGER);
    if (!managerSrc) {
        errors.push(`W4 ${GAME_MANAGER} 을 읽지 못했다`);
    } else if (!/import\s*\(\s*["'][^"']*DebugScene\.js["']\s*\)/.test(managerSrc)) {
        errors.push(
            `W4 ${GAME_MANAGER} 이 DebugScene 을 **동적** import 로 붙이지 않는다 — ` +
                `등록이 없으면 죽은 파일이고, 정적 import 면 DEV 가드가 있어도 배포 번들에 남는다`
        );
    } else if (!/import\.meta\.env\.DEV/.test(managerSrc)) {
        errors.push(`W4 ${GAME_MANAGER} 의 디버그 오버레이 등록에 DEV 가드가 없다`);
    }
    for (const [f, s] of code) {
        if (f === DEBUG_SCENE || !/\.(js|jsx)$/.test(f)) continue;
        if (/^\s*import\s[^\n]*DebugScene/m.test(s)) {
            errors.push(
                `W4 ${f} 이 DebugScene 을 **정적** import 한다 — 그러면 DEV 로 갈라도 ` +
                    `배포 번들에서 지워지지 않는다 (2026-08-05 실측)`
            );
        }
    }

    /* ── W5 · 구독하는 이벤트를 아무도 쏘지 않는다 ────────────
     *
     * ★ `EVT.SPELL_RESULT` 가 그랬다: 상수도 있고 HUD 의 구독도 있었는데
     *   **씬에서 쏘는 한 줄**이 없어서, 주문을 눌러도 아무 문장이 뜨지 않았다.
     *   구독만 있는 이벤트는 화면에서 "기능이 없는 것"과 완전히 같다.
     */
    const emitted = new Set();
    for (const [f, s] of code) {
        if (!/\.(js|jsx)$/.test(f)) continue;
        for (const m of s.matchAll(/EventBus\s*\.\s*emit\s*\(\s*EVT\.(\w+)/g)) emitted.add(m[1]);
    }
    for (const [f, s] of code) {
        if (!/\.(js|jsx)$/.test(f)) continue;
        if (!CONSUMER_DIRS.some((d) => under(f, d))) continue;
        for (const m of s.matchAll(/EventBus\s*\.\s*on\s*\(\s*EVT\.(\w+)/g)) {
            if (emitted.has(m[1])) continue;
            errors.push(
                `W5 ${f} 이 \`EVT.${m[1]}\` 를 구독하는데 그것을 emit 하는 코드가 없다 — ` +
                    `화면에서는 '기능이 아예 없는 것'과 구별되지 않는다`
            );
        }
    }

    /* ── W6 · 나이트메어 규칙이 화면에 닿는가 (P11-06) ────────
     *
     * ★★ 이 저장소가 반복해서 겪는 모양이 여기서도 성립한다: 규칙은 시뮬에 있고
     *   데이터도 있는데 **그리는 코드가 0줄**이면, 플레이어에게는 원인 없는 피해다.
     *   장판은 특히 위험하다 — 이벤트 예산 때문에 **DAMAGE 이벤트를 일부러 내지
     *   않으므로**(22-nightmare.md §6.3) 데미지 숫자도 뜨지 않는다. 화면에 남는
     *   단서가 이 프레젠터 하나뿐이다.
     *
     * ★ 검사하는 것은 세 가지다:
     *   ① 존 프레젠터가 존재하고 씬이 만들고·동기화하고·정리하는가
     *   ② `Graphics` 는 **언제나 1개**인가 (엔티티마다 만들면 배치가 끊긴다 — 26 §10-A.4)
     *   ③ 이펙트 풀을 쓰지 않는가 (저사양 이펙트 예산 12를 통째로 먹는다)
     *   ④ 파열 이벤트 2종을 씬이 실제로 받는가
     */
    const ZONES = `${PRESENTER_DIR}/PlagueZones.js`;
    const zonesSrc = code.get(ZONES);
    const battleSrc = code.get(`${SCENE_DIR}/BattleScene.js`);
    if (!zonesSrc) {
        errors.push(
            `W6 ${ZONES} 이 없다 — 역병 장판은 데미지 숫자를 띄우지 않으므로 ` +
                `그리는 코드가 없으면 화면에서 '원인 없는 피해'가 된다`
        );
    } else {
        const graphics = (zonesSrc.match(/add\.graphics\(/g) ?? []).length;
        if (graphics !== 1) {
            errors.push(
                `W6 ${ZONES} 의 Graphics 가 ${graphics}개다 — 12구간을 **하나에** 그린다 ` +
                    `(엔티티마다 Graphics 를 만들면 그 수만큼 배치가 끊긴다: 26 §10-A.4)`
            );
        }
        if (/\bfx\.play\(|EffectSystem|acquire\(/.test(zonesSrc)) {
            errors.push(
                `W6 ${ZONES} 이 이펙트 풀을 쓴다 — 저사양 티어의 동시 이펙트 예산은 12 이고 ` +
                    `장판이 그것을 통째로 먹으면 전투 이펙트가 사라진다`
            );
        }
    }
    if (!battleSrc) {
        errors.push(`W6 ${SCENE_DIR}/BattleScene.js 를 읽지 못했다`);
    } else {
        for (const [needle, why] of [
            ["new PlagueZones(", "씬이 존 프레젠터를 만들지 않는다"],
            ["plagueFx.sync(", "만들어 두고 동기화하지 않는다 — 영원히 빈 Graphics 다"],
            ["plagueFx?.destroy()", "shutdown() 에서 정리하지 않는다 (절대규칙 3)"],
            ["EV.NIGHTMARE_BOND_TELEGRAPH", "결박 파열 **예고**를 받지 않는다"],
            ["EV.NIGHTMARE_BOND_BREAK", "결박 파열을 받지 않는다"],
        ]) {
            if (!battleSrc.includes(needle)) errors.push(`W6 BattleScene: ${why} (${needle})`);
        }
    }

    return errors;
}

/* ══════════════════════════ 테스트 ══════════════════════════ */

let sources;
beforeAll(() => {
    sources = loadSources();
});

/** 원본을 복제한 뒤 파일 하나만 바꿔서 검사기를 돌린다 */
function withEdit(file, edit) {
    const next = new Map(sources);
    const before = next.get(file);
    expect(before, `${file} 이 없다`).toBeTruthy();
    const after = edit(before);
    expect(after, `${file} 을 실제로 바꾸지 못했다 — 검사가 아무것도 증명하지 않는다`).not.toBe(
        before
    );
    next.set(file, after);
    return analyze(next).join("\n");
}

describe("배선 — 현재 저장소", () => {
    it("끊긴 배선이 없다", () => {
        expect(analyze(sources)).toEqual([]);
    });

    it("소스를 실제로 읽었다 (빈 입력의 통과는 통과가 아니다)", () => {
        expect(sources.size).toBeGreaterThan(50);
        expect(sources.has(ENEMIES_JSON)).toBe(true);
        // 경로 구분자가 갈라지면 위의 `under()` 판정이 통째로 무너진다
        expect(relative(ROOT, join(ROOT, ENEMIES_JSON)).split(sep).join("/")).toBe(ENEMIES_JSON);
    });
});

describe("W1 — 적 아트 필드", () => {
    it("outline 을 읽지 않으면 잡는다 (2026-08-05 이전 상태)", () => {
        const out = withEdit("src/game/presenters/UnitPresenter.js", (s) =>
            s.replaceAll("art.outline", "art.__없앰")
        );
        expect(out).toMatch(/W1 .*art\.outline.*읽는 코드가 없다/);
    });

    it("새 art 필드를 데이터에만 더해도 잡는다", () => {
        const out = withEdit(ENEMIES_JSON, (s) =>
            s.replace('"outline": "0xff3344"', '"outline": "0xff3344", "groundCrack": true')
        );
        expect(out).toMatch(/W1 .*art\.groundCrack/);
    });

    /**
     * ★ 적의 발사체 그림은 프레젠터가 아니라 정규화를 지나 씬으로 간다.
     *   그 한 줄(`projectile: raw.art?.projectile`)이 사라지면 데이터에 적힌 탄이
     *   조용히 기본 탄으로 떨어진다 — 아군이 2026-08-05 에 겪은 그 사고다.
     */
    it("정규화가 art.projectile 을 놓치면 잡는다", () => {
        const out = withEdit("src/game/logic/stageConfig.js", (s) =>
            s.replaceAll("raw.art?.projectile", "undefined")
        );
        expect(out).toMatch(/W1 .*art\.projectile.*읽는 코드가 없다/);
    });
});

describe("W2 — 품질 티어", () => {
    it("배경 레이어 수를 다시 하드코딩하면 잡는다", () => {
        const out = withEdit("src/game/scenes/BattleScene.js", (s) =>
            s.replaceAll("this.quality.bgLayers", "4")
        );
        expect(out).toMatch(/W2 .*bgLayers.*읽는 코드가 없다/);
    });

    it("설정 키를 씬이 읽지 않으면 잡는다 (배선 이전 상태)", () => {
        const out = withEdit("src/game/scenes/BattleScene.js", (s) =>
            s.replaceAll("settings.qualityTier", "settings.__없앰")
        );
        expect(out).toMatch(/W2 `settings\.qualityTier`/);
    });

    it("표에 필드만 늘리면 잡는다", () => {
        const out = withEdit(QUALITY_JSON, (s) =>
            s.replace('"high": { "effects": 24', '"high": { "particles": 1, "effects": 24')
        );
        expect(out).toMatch(/W2 .*particles/);
    });
});

describe("W3 — 햅틱", () => {
    it("hapticHit 호출을 지우면 잡는다 (2026-08-05 이전 상태)", () => {
        const out = withEdit("src/game/scenes/BattleScene.js", (s) => s.replaceAll("hapticHit", "x"));
        expect(out).toMatch(/W3 `hapticHit`/);
    });
});

describe("W4 — DebugScene", () => {
    it("등록을 지우면 잡는다 (2026-08-05 이전 상태 — 파일 자체가 없었다)", () => {
        const out = withEdit(GAME_MANAGER, (s) =>
            s.replace('import("./scenes/DebugScene.js")', "Promise.resolve({})")
        );
        expect(out).toMatch(/W4 .*동적\*\* import/);
    });

    it("정적 import 로 되돌리면 잡는다 — DEV 삼항으로 감싸도 번들에 남는다 (실측)", () => {
        const out = withEdit(SCENE_INDEX, (s) =>
            s.replace(
                'import { BattleScene } from "./BattleScene.js";',
                'import { BattleScene } from "./BattleScene.js";\nimport { DebugScene } from "./DebugScene.js";'
            )
        );
        expect(out).toMatch(/W4 .*정적\*\* import/);
    });

    it("씬 파일이 사라지면 잡는다", () => {
        const next = new Map(sources);
        next.delete(DEBUG_SCENE);
        expect(analyze(next).join("\n")).toMatch(/W4 .*DebugScene\.js 이 없다/);
    });
});

describe("W6 — 나이트메어 규칙이 화면에 닿는가", () => {
    it("존 프레젠터를 지우면 잡는다", () => {
        const next = new Map(sources);
        next.delete("src/game/presenters/PlagueZones.js");
        expect(analyze(next).join("\n")).toMatch(/W6 .*PlagueZones\.js 이 없다/);
    });

    it("★ Graphics 를 하나 더 만들면 잡는다 (구간마다 만드는 실수)", () => {
        const out = withEdit("src/game/presenters/PlagueZones.js", (s) =>
            s.replace("this.g = scene.add.graphics()", "this.g2 = scene.add.graphics();\n        this.g = scene.add.graphics()")
        );
        expect(out).toMatch(/W6 .*Graphics 가 2개다/);
    });

    it("★ 이펙트 풀로 그리면 잡는다 (저사양 이펙트 예산을 통째로 먹는다)", () => {
        const out = withEdit("src/game/presenters/PlagueZones.js", (s) =>
            s.replace("g.clear();", "g.clear();\n        this.scene.fx.play('breach', 0, 0);")
        );
        expect(out).toMatch(/이펙트 풀을 쓴다/);
    });

    it("씬이 동기화를 빼먹으면 잡는다 (영원히 빈 Graphics)", () => {
        const out = withEdit("src/game/scenes/BattleScene.js", (s) =>
            s.replace("this.plagueFx.sync(", "noop(")
        );
        expect(out).toMatch(/동기화하지 않는다/);
    });

    it("파열 이벤트를 씬이 안 받으면 잡는다", () => {
        const out = withEdit("src/game/scenes/BattleScene.js", (s) =>
            s.replaceAll("EV.NIGHTMARE_BOND_BREAK", "EV.XXX")
        );
        expect(out).toMatch(/결박 파열을 받지 않는다/);
    });
});

describe("W5 — 구독만 있고 아무도 쏘지 않는 이벤트", () => {
    it("주문 결과를 씬이 쏘지 않으면 잡는다 (2026-08-05 이전 상태)", () => {
        const out = withEdit("src/game/scenes/BattleScene.js", (s) =>
            s.replace("EventBus.emit(EVT.SPELL_RESULT, {", "noop({")
        );
        expect(out).toMatch(/W5 .*EVT\.SPELL_RESULT/);
    });
});
