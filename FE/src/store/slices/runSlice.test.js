/**
 * runSlice — **10Hz 동기화가 화면을 얼마나 흔드는가** (2026-08-05)
 *
 * ★★ 이 파일이 지키는 명제는 하나다: **값이 바뀌지 않은 구독자는 다시 그리지 않는다.**
 *
 *   `syncFromSim` 은 Phaser 의 `update()` 가 10Hz 로 부르는 유일한 문이다
 *   (절대규칙 2). "전부 같으면 아무것도 하지 않는다"는 원래 지켜지고 있었지만,
 *   **하나라도 다를 때** 씬이 만들어 준 새 `slotCosts` 배열이 그대로 들어갔다.
 *   마나는 사실상 매번 바뀌므로 그 참조는 **초당 열 번 새것**이 되었고,
 *   그것을 구독하는 슬롯 줄(스프라이트 6장)이 계속 다시 그려졌다.
 *
 * ★ 성능 회귀 검사는 **시간이 아니라 횟수·참조**로 쓴다. 기기마다 다른 ms 는
 *   회귀 검사가 되지 못한다 (`pools/DamageTextPool.test.js` 와 같은 규약).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRunSlice } from "./runSlice.js";

/** zustand 없이 set/get 만 흉내낸다 — 슬라이스는 순수 팩토리다 */
function makeSlice() {
    let state = {};
    const get = () => state;
    const set = (patch) => {
        const next = typeof patch === "function" ? patch(state) : patch;
        state = { ...state, ...next };
    };
    state = { ...createRunSlice(set, get) };
    return { get, set };
}

const base = {
    mana: 10,
    riftEnergy: 0,
    arkHp: 100,
    commanderHp: 600,
    wave: 1,
    tempoShifted: false,
    objectiveText: "",
    objectiveRatio: 0,
};

describe("syncFromSim — 10Hz 동기화", () => {
    let store;
    beforeEach(() => {
        store = makeSlice();
        store.get().syncFromSim({ ...base, slotCosts: [10, 20] });
    });

    it("전부 같으면 아무것도 하지 않는다", () => {
        const before = store.get();
        store.get().syncFromSim({ ...base, slotCosts: [10, 20] });
        expect(store.get().mana).toBe(before.mana);
        expect(store.get().slotCosts).toBe(before.slotCosts);
    });

    it("★★ 다른 값이 바뀌어도 코스트가 같으면 배열 참조가 유지된다", () => {
        const costsBefore = store.get().slotCosts;
        // 마나만 바뀐다 — 실제 전투에서 사실상 매 동기화마다 일어나는 일
        store.get().syncFromSim({ ...base, mana: 11, slotCosts: [10, 20] });
        expect(store.get().mana, "마나는 반영된다").toBe(11);
        expect(
            store.get().slotCosts,
            "값이 같은데 참조가 바뀌면 슬롯 줄이 10Hz 로 다시 그려진다"
        ).toBe(costsBefore);
    });

    it("코스트가 실제로 바뀌면 새 배열이 들어간다", () => {
        const costsBefore = store.get().slotCosts;
        store.get().syncFromSim({ ...base, slotCosts: [10, 24] });
        expect(store.get().slotCosts).not.toBe(costsBefore);
        expect(store.get().slotCosts).toEqual([10, 24]);
    });

    it("길이가 달라져도 새 배열이 들어간다 (편성이 바뀐 재도전)", () => {
        store.get().syncFromSim({ ...base, slotCosts: [10, 20, 30] });
        expect(store.get().slotCosts).toEqual([10, 20, 30]);
    });

    it("코스트를 아예 안 넘기면 기존 값을 건드리지 않는다", () => {
        const costsBefore = store.get().slotCosts;
        store.get().syncFromSim({ ...base, mana: 12 });
        expect(store.get().slotCosts).toBe(costsBefore);
    });

    it("★ 지휘관 HP 만 바뀌어도 반영된다 (얕은 비교에 빠지면 화면이 굳는다)", () => {
        store.get().syncFromSim({ ...base, commanderHp: 540, slotCosts: [10, 20] });
        expect(store.get().commanderHp).toBe(540);
    });
});

/**
 * ★★ **씬이 보내는 필드는 전부 얕은 비교에 있어야 한다** (2026-08-05).
 *
 *   `syncFromSim` 의 첫 관문은 "전부 같으면 아무것도 하지 않는다"이다. 그런데
 *   그 비교는 **손으로 적은 목록**이라, 새 필드를 payload 에만 넣고 비교에서
 *   빠뜨리면 **그 값만 바뀐 동기화가 통째로 버려진다** — 화면이 영영 그 자리에
 *   굳고, 아무 에러도 나지 않는다. 지휘관 HP 가 정확히 그럴 뻔했다.
 *
 *   그래서 사람이 아니라 기계가 대조한다: 씬의 `syncFromSim({...})` 리터럴에서
 *   키를 뽑아, 슬라이스의 비교식에 그 이름이 등장하는지 본다.
 *
 * ★ 목록(배열) 필드는 `sameList` 가 따로 본다 — 이름은 그 호출부에도 나오므로
 *   같은 규칙으로 걸린다.
 */
describe("syncFromSim — payload ↔ 얕은 비교 대조", () => {
    const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

    /**
     * ★★ **`startBattle` 이 cfg 에서 읽는 값은 씬이 전부 넘겨야 한다** (2026-08-05).
     *
     *   `startBattle` 은 **손으로 고른 부분집합**을 받는다 — 씬이 `this.cfg` 를 통째로
     *   넘기지 않는다. 그래서 슬라이스에 `commanderHp: cfg.commanderHp` 를 넣고도
     *   씬의 호출부에 그 줄을 안 적으면 값이 `undefined` 로 들어가고, HUD 의
     *   지휘관 게이지가 **에러 하나 없이 통째로 사라진다.** 실제로 그렇게 사라졌고
     *   화면을 직접 열어 보기 전까지 lint · 테스트 · 검사기 전부가 통과했다.
     */
    it("★★ startBattle 이 cfg 에서 읽는 키를 씬이 전부 넘긴다", () => {
        const slice = read("./runSlice.js");
        const init = slice.slice(slice.indexOf("startBattle: (stageId, cfg) =>"));
        const body = init.slice(0, init.indexOf("\n        }),"));
        const needed = [...new Set([...body.matchAll(/cfg\.(\w+)/g)].map((m) => m[1]))];
        expect(needed.length, "cfg 참조를 못 읽었다 — 이 검사가 헛돈다").toBeGreaterThan(3);

        const scene = read("../../game/scenes/BattleScene.js");
        const call = scene.slice(scene.indexOf("startBattle(this.stageId, {"));
        const passed = call.slice(0, call.indexOf("\n        });"));
        const missing = needed.filter((k) => !passed.includes(`this.cfg.${k}`));
        expect(missing, `씬이 안 넘기는 값: ${missing.join(", ")}`).toEqual([]);
    });

    it("씬이 보내는 모든 키가 비교식에 등장한다", () => {
        const scene = read("../../game/scenes/BattleScene.js");
        const call = scene.slice(scene.indexOf("syncFromSim({"));
        const body = call.slice(call.indexOf("{"), call.indexOf("\n        });"));
        // 주석을 걷어낸 뒤 `키:` 만 뽑는다 (주석 안의 콜론이 키로 잡히지 않게)
        const clean = body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
        const keys = [...clean.matchAll(/^\s{12}([a-zA-Z]\w*):/gm)].map((m) => m[1]);
        expect(keys.length, "payload 를 못 읽었다 — 이 검사가 헛돌고 있다").toBeGreaterThan(5);

        const slice = read("./runSlice.js");
        const cmp = slice.slice(slice.indexOf("const costsSame"), slice.indexOf("const patch"));
        const missing = keys.filter((k) => !cmp.includes(k));
        expect(missing, `비교식에 없는 필드: ${missing.join(", ")}`).toEqual([]);
    });
});
