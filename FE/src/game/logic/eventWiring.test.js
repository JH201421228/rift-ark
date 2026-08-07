/**
 * 시뮬 이벤트 배선 검사 — **방출한 것을 아무도 듣지 않는 상태**를 기계가 잡는다.
 *
 * ★★★ 왜 이 파일이 생겼는가 (2026-08-07, 지휘관 전수조사).
 *
 *   `EV.SPELL_CAST` · `EV.COMMANDER_DOWN` · `EV.COMMANDER_UP` 세 개가
 *   **4개월 동안 emit 만 되고 소비처가 0개**였다. 결과는 예외도 로그도 아니고
 *   **침묵**이었다:
 *     · 주문을 눌러 **성공하면** 전장이 무음·무연출이고, **실패해야만** 화면이
 *       흔들렸다 — 반응이 실패에만 있는 UI 는 "이 버튼은 작동하지 않는다"로 읽힌다.
 *     · 지휘관이 쓰러지는 순간(8초간 오라가 통째로 사라지는, 전투에서 가장 큰
 *       단일 사건)에 화면도 소리도 아무 말을 하지 않았다.
 *
 *   `tools/validate-data.mjs` 의 "선언 ↔ 소비 대조" 절은 이것을 잡지 못한다 —
 *   그 절이 보는 것은 `src/game/EventBus.js` 의 `EVT`(React ↔ 씬) 문자열이고,
 *   여기 `logic/events.js` 의 `EV`(시뮬 → 렌더)는 **대상이 아니었다.**
 *   이 저장소가 반복해서 당한 단일 실패 유형("선언했는데 아무도 읽지 않는 것")이
 *   검사기의 사각지대에 그대로 살아 있었다.
 *
 * ★ 이 검사는 **소스 텍스트를 훑는다.** 정적 분석이라 우회할 수 있지만
 *   (`const t = EV.SPELL_CAST; switch(t)`), 우회는 의도가 있어야 가능하고
 *   여기서 막으려는 것은 **의도 없는 누락**이다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { EV } from "./events.js";

const GAME_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * 방출은 되지만 **소비처가 없어도 되는** 이벤트와 그 이유.
 *
 * ★★ 여기 이름을 더하는 것은 **부채를 지는 일**이다. 이유를 반드시 같은 줄에 적고,
 *   "아직 안 만들었다"는 이유로는 넣지 마라 — 그것이 정확히 위 세 개가 4개월을
 *   버틴 방식이다.
 */
const CONSUMER_EXEMPT = {
    /**
     * ★★ 아래 일곱은 **이벤트가 아니라 상태를 폴링해서** 그린다. 렌더러가 매 프레임
     *   시뮬을 읽으므로(`presenter.sync(sim)`) 같은 사실을 이벤트로 또 받을 이유가
     *   없다 — 오히려 둘이 갈라진다.
     *
     * ★ 그러므로 이것은 "아직 안 만들었다"가 아니라 **의도된 설계**다. 다만
     *   `emit` 이 남아 있는 만큼 틱 예산(이벤트 p99 ≤ 24)을 먹고 있으므로,
     *   언젠가 예산이 빡빡해지면 **여기부터 지운다.**
     */
    PROJECTILE_SPAWN: "BattleScene.syncProjectiles 가 sim.projectiles 를 매 프레임 폴링한다",
    PROJECTILE_HIT: "위와 같다 — 명중 연출은 EV.DAMAGE 가 이미 낸다",
    NIGHTMARE_ZONE: "PlagueZones.sync 가 sim.nightmare 의 고정 12슬롯을 폴링한다",
    MODE_BOSS_SPAWN: "BossPresenter.sync 가 sim.modeState 를 폴링한다",
    MODE_BOSS_DEAD: "위와 같다",
    SIGIL_DRAFT: "BattleScene.update 가 sim.phase === 'draft' 를 직접 본다 (드래프트는 전투를 멈춘다)",
    WAVE_START: "웨이브 번호는 throttledSync 가 10Hz 로 스토어에 싣는다",
};

/**
 * 정의는 있지만 **아직 방출되지 않아도 되는** 이벤트.
 * ★ 번호는 덧붙이기만 하므로(리플레이 호환) 쓰지 않게 된 이벤트가 남을 수 있다.
 */
const EMIT_EXEMPT = {
    // (지금은 없다.)
};

function walk(dir, out = []) {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) {
            walk(p, out);
            continue;
        }
        if (!/\.jsx?$/.test(name)) continue;
        if (/\.test\.jsx?$/.test(name)) continue;
        out.push(p);
    }
    return out;
}

/** 주석을 지운다 — 주석 안의 `EV.X` 를 배선으로 세면 이 검사는 언제나 통과한다 */
function stripComments(src) {
    return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const FILES = [...walk(GAME_DIR), join(GAME_DIR, "../hud"), join(GAME_DIR, "../screens")]
    .filter((p) => typeof p === "string" && /\.jsx?$/.test(p))
    .concat(walk(join(GAME_DIR, "../hud")))
    .concat(walk(join(GAME_DIR, "../screens")));

const emitted = new Set();
const consumed = new Set();

for (const p of FILES) {
    const src = stripComments(readFileSync(p, "utf8"));
    // emit(queue, EV.NAME, …)
    for (const m of src.matchAll(/\bemit\s*\(\s*[^,()]+,\s*EV\.(\w+)/g)) emitted.add(m[1]);
    // case EV.NAME:  |  e.type === EV.NAME
    for (const m of src.matchAll(/\bcase\s+EV\.(\w+)\s*:/g)) consumed.add(m[1]);
    for (const m of src.matchAll(/\.type\s*===\s*EV\.(\w+)/g)) consumed.add(m[1]);
}

describe("시뮬 이벤트 배선 (EV)", () => {
    const names = Object.keys(EV);

    it("★ 검사기 자체가 살아 있다 — 실제로 emit·소비를 찾아냈다", () => {
        // 깨뜨려 확인: 정규식이 아무것도 못 찾으면 아래 검사 전부가 무조건 통과한다
        expect(emitted.size).toBeGreaterThan(8);
        expect(consumed.size).toBeGreaterThan(8);
        expect(emitted.has("DAMAGE")).toBe(true);
        expect(consumed.has("DAMAGE")).toBe(true);
    });

    it.each(names)("%s — 방출된다", (name) => {
        if (name in EMIT_EXEMPT) return;
        expect(
            emitted.has(name),
            `EV.${name} 을 emit 하는 코드가 없다. 쓰지 않는 이벤트라면 EMIT_EXEMPT 에 이유와 함께 등록하라`
        ).toBe(true);
    });

    it.each(names)("%s — 소비된다 (방출만 하고 아무도 안 듣는 상태가 아니다)", (name) => {
        if (name in CONSUMER_EXEMPT || name in EMIT_EXEMPT) return;
        expect(
            consumed.has(name),
            `EV.${name} 을 듣는 코드가 없다 — 이벤트는 나가는데 화면·소리는 아무 반응이 없다. ` +
                `이것이 SPELL_CAST · COMMANDER_DOWN · COMMANDER_UP 이 4개월을 버틴 방식이다. ` +
                `연출을 붙이거나, 정말 필요 없다면 CONSUMER_EXEMPT 에 **이유와 함께** 등록하라`
        ).toBe(true);
    });
});
