/**
 * 세이브 슬롯 (2026-08-04)
 *
 * ★★ **이 파일이 지키는 사고는 실제로 났다.** 빈 슬롯 2 를 골랐는데 슬롯 1 의
 *   골드와 진행도가 그대로 보였다 — `persist.rehydrate()` 는 저장본을 *현재 상태
 *   위에 얹을* 뿐이라 빈 슬롯에는 얹을 것이 없었기 때문이다. 화면은 이전 계정을
 *   보여 주면서 저장만 새 키로 갔다. 가장 나쁜 조합이다.
 *
 * ★ 그래서 여기서 재는 것은 함수의 반환값이 아니라 **순서**다:
 *   저장소 차단 → resetToPristine → 키 교체 → rehydrate.
 *
 * ★ 그리고 **슬롯 1 은 옛 키를 그대로 쓴다.** 이것을 어기면 슬롯을 도입한 그날
 *   기존 플레이어 전원의 진행이 사라진 것처럼 보인다.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/** vi.mock 팩토리보다 먼저 만들어져야 한다 (index.test.js 와 같은 규약) */
const mem = new Map();
vi.mock("@/native/storage", () => ({
    capacitorStorage: {
        getItem: async (k) => mem.get(k) ?? null,
        setItem: async (k, v) => void mem.set(k, v),
        removeItem: async (k) => void mem.delete(k),
    },
}));

const resetSpy = vi.fn();
vi.mock("./index", async () => {
    const actual = await vi.importActual("./index");
    return { ...actual, resetToPristine: () => resetSpy() };
});

const { SAVE_KEY } = await import("./index");
const { SLOTS, SLOT_COUNT, slotKey, readSlot, readAllSlots, openSlot, lastSlot, deleteSlot } =
    await import("./slots");

/** 세이브 원문 봉투 — persist 가 쓰는 모양 그대로 */
const save = (state) => JSON.stringify({ state, version: 15 });

const someSave = save({
    meta: {
        highestStage: 27,
        stageStars: { "1-1": 3, "1-2": 2 },
        difficultyStars: { hard: { "1-1": 1 } },
        currencies: { gold: 4200 },
        savedAt: 1234,
    },
    roster: { owned: { a: {}, b: {}, c: {} } },
});

beforeEach(() => {
    mem.clear();
    resetSpy.mockClear();
});

describe("슬롯 키", () => {
    it("★★ 슬롯 1 은 옛 저장 키를 그대로 쓴다 — 기존 진행이 사라지지 않는다", () => {
        expect(slotKey(1)).toBe(SAVE_KEY);
    });

    it("나머지 슬롯은 서로 다른 키를 쓴다", () => {
        const keys = SLOTS.map(slotKey);
        expect(new Set(keys).size).toBe(SLOT_COUNT);
    });
});

describe("readSlot — 요약은 세이브 원문에서만 만든다", () => {
    it("빈 슬롯", async () => {
        expect(await readSlot(1)).toEqual({ slot: 1, empty: true });
    });

    it("★ 별은 노멀 + 하드를 함께 센다", async () => {
        mem.set(slotKey(2), someSave);
        const d = await readSlot(2);
        expect(d).toMatchObject({
            slot: 2,
            empty: false,
            highestStage: 27,
            stars: 6, // 3 + 2 + 1(하드)
            units: 3,
            gold: 4200,
            savedAt: 1234,
        });
    });

    it("★★ 읽히지 않는 슬롯은 '비었다'가 아니라 '손상됨'이다 — 덮어쓰기 전에 말해 준다", async () => {
        mem.set(slotKey(3), "{{{ 잘린 JSON");
        expect(await readSlot(3)).toEqual({ slot: 3, empty: false, broken: true });
    });

    it("어떤 입력에도 던지지 않는다 — 슬롯 하나 때문에 타이틀이 죽으면 안 된다", async () => {
        mem.set(slotKey(1), save(null));
        mem.set(slotKey(2), save({ meta: null, roster: null }));
        mem.set(slotKey(3), save({ meta: { currencies: "?", stageStars: 7 } }));
        for (const d of await readAllSlots()) expect(d.slot).toBeGreaterThan(0);
        expect(await readSlot(99)).toEqual({ slot: 99, empty: true });
        expect(await readSlot(undefined)).toMatchObject({ empty: true });
    });

    it("readAllSlots 는 언제나 슬롯 수만큼 돌려준다", async () => {
        const all = await readAllSlots();
        expect(all).toHaveLength(SLOT_COUNT);
        expect(all.map((d) => d.slot)).toEqual(SLOTS);
    });
});

describe("openSlot — 순서가 규칙이다", () => {
    /** persist 를 흉내 낸 최소 store */
    const fakeStore = () => {
        const calls = [];
        return {
            calls,
            persist: {
                setOptions: (o) =>
                    calls.push(
                        o.name ? `setOptions:${o.name}` : `storage:${o.storage ? "on" : "off"}`
                    ),
                rehydrate: async () => void calls.push("rehydrate"),
            },
        };
    };

    it("★★ 저장소 차단 → 바닥 지우기 → 키 교체 → rehydrate 순으로 부른다", async () => {
        const store = fakeStore();
        resetSpy.mockImplementation(() => store.calls.push("reset"));

        expect(await openSlot(store, 2)).toBe(true);
        expect(store.calls).toEqual(["storage:on", "reset", `setOptions:${slotKey(2)}`, "rehydrate"]);
    });

    /**
     * ★★★ **고른 슬롯의 세이브를 열면서 지우지 않는다** (2026-08-04 회귀).
     *
     *   zustand persist 는 `setState` 를 감싸 **즉시** 기록한다. 키를 먼저 바꾸고
     *   바닥을 지우면 그 지우기가 **새 슬롯에 순정 상태로 기록되고**, 이어지는
     *   `rehydrate()` 는 방금 자기가 덮어쓴 빈 세이브를 읽는다.
     *   실측: `highestStage:42 · gold:12345` 슬롯을 열면 0 · 500 이 됐고
     *   디스크의 42도 사라졌다. **되돌릴 수 없는 종류의 사고다.**
     */
    it("★★★ 바닥을 지우는 동안 저장소가 끊겨 있다 — 안 그러면 고른 슬롯이 지워진다", async () => {
        const store = fakeStore();
        const order = [];
        resetSpy.mockImplementation(() => order.push("reset"));
        store.persist.setOptions = (o) => {
            if (o.storage && !o.name) order.push("storage-off");
            if (o.name) order.push("storage-on+name");
        };
        store.persist.rehydrate = async () => void order.push("rehydrate");

        await openSlot(store, 2);
        expect(order).toEqual(["storage-off", "reset", "storage-on+name", "rehydrate"]);
        expect(
            order.indexOf("reset"),
            "바닥 지우기가 키 교체 뒤에 있으면 그 쓰기가 고른 슬롯을 덮어쓴다"
        ).toBeLessThan(order.indexOf("storage-on+name"));
    });

    it("★ 바닥을 지우지 않으면 빈 슬롯에 이전 계정이 남는다 — reset 이 rehydrate 앞에 있어야 한다", async () => {
        const store = fakeStore();
        resetSpy.mockImplementation(() => store.calls.push("reset"));
        await openSlot(store, 3);
        expect(store.calls.indexOf("reset")).toBeLessThan(store.calls.indexOf("rehydrate"));
    });

    it("잘못된 슬롯 번호는 아무것도 하지 않는다", async () => {
        const store = fakeStore();
        expect(await openSlot(store, 0)).toBe(false);
        expect(await openSlot(store, SLOT_COUNT + 1)).toBe(false);
        expect(store.calls).toEqual([]);
        expect(resetSpy).not.toHaveBeenCalled();
    });

    it("마지막 슬롯을 기억한다", async () => {
        expect(await lastSlot()).toBeNull();
        await openSlot(fakeStore(), 2);
        expect(await lastSlot()).toBe(2);
    });
});

describe("deleteSlot", () => {
    it("★ 그 슬롯만 지운다 — 나머지는 그대로다", async () => {
        for (const n of SLOTS) mem.set(slotKey(n), someSave);
        expect(await deleteSlot(2)).toBe(true);
        expect((await readSlot(2)).empty).toBe(true);
        expect((await readSlot(1)).empty).toBe(false);
        expect((await readSlot(3)).empty).toBe(false);
    });

    it("잘못된 번호는 거절한다", async () => {
        mem.set(slotKey(1), someSave);
        expect(await deleteSlot(7)).toBe(false);
        expect((await readSlot(1)).empty).toBe(false);
    });
});
