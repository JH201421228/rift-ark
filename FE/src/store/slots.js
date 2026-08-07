/**
 * 세이브 슬롯 (2026-08-04)
 *
 * ★★ **왜 필요한가.** 이 게임은 세이브가 하나뿐이었다 — 새로 시작하려면 기존
 *   진행을 지우는 수밖에 없었고, 그것은 "다시 해 보고 싶다"를 "잃어도 되는가"로
 *   바꾸는 질문이다. 슬롯 셋이면 그 질문이 사라진다.
 *
 * ★★ **슬롯 요약은 저장하지 않는다.** 목록에 보여 줄 진행도·별·마지막 플레이는
 *   전부 **그 슬롯의 세이브 원문에서 읽어** 만든다. 요약을 따로 저장하면 그것이
 *   두 번째 출처가 되고, 언젠가 "목록에는 45스테이지인데 들어가면 12" 가 된다.
 *
 * ★ 순수하지 않다 (저장소를 만진다). `logic/` 이 아니라 `store/` 에 있는 이유다.
 *
 * @see docs/03-tech/21-state-management.md §6
 */
import { createJSONStorage } from "zustand/middleware";
import { capacitorStorage } from "@/native/storage";
import { SAVE_KEY, resetToPristine } from "./index";

/**
 * 아무것도 기록하지 않는 저장소.
 *
 * ★ 슬롯을 갈아타는 **찰나에만** 걸린다 (`openSlot` 주석 참조). 이것이 없으면
 *   바닥을 지우는 `setState` 가 고른 슬롯의 세이브를 덮어쓴다.
 */
const VOID_STORAGE = {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
};

/** 슬롯 수. ★ 화면이 3 을 적지 않는다 — 여기가 단일 출처다. */
export const SLOT_COUNT = 3;
export const SLOTS = Object.freeze([...Array(SLOT_COUNT)].map((_, i) => i + 1));

/**
 * 슬롯 번호 → 저장 키.
 *
 * ★★ **슬롯 1 이 옛 키(`riftark-save`)를 그대로 쓴다.** 슬롯을 도입하기 전의
 *   세이브가 정확히 그 키에 있고, 키를 바꾸면 **기존 진행이 통째로 사라진 것처럼
 *   보인다.** 마이그레이션 코드를 쓰는 대신 번호 하나를 양보하는 편이 안전하다.
 */
export const slotKey = (slot) => (slot === 1 ? SAVE_KEY : `${SAVE_KEY}-${slot}`);

/** 마지막으로 고른 슬롯을 기억하는 키 — 세이브가 아니라 기기 설정에 가깝다 */
const LAST_SLOT_KEY = `${SAVE_KEY}-last-slot`;

const isSlot = (slot) => SLOTS.includes(Number(slot));

/**
 * 슬롯 하나의 요약. 비어 있거나 못 읽으면 `{ slot, empty: true }`.
 *
 * ★ **어떤 입력에도 던지지 않는다.** 슬롯 하나가 손상됐다고 타이틀 화면이 죽으면
 *   플레이어는 나머지 두 슬롯에도 접근할 수 없다 — 세이브 하나를 잃는 것보다 나쁘다.
 *
 * @returns {Promise<{slot:number, empty:boolean, highestStage?:number,
 *   stars?:number, units?:number, gold?:number, savedAt?:number, broken?:boolean}>}
 */
export async function readSlot(slot) {
    if (!isSlot(slot)) return { slot, empty: true };
    let raw = null;
    try {
        raw = await capacitorStorage.getItem(slotKey(slot));
    } catch {
        return { slot, empty: true, broken: true };
    }
    if (!raw) return { slot, empty: true };

    try {
        const st = JSON.parse(raw)?.state ?? {};
        const meta = st.meta ?? {};
        const normal = Object.values(meta.stageStars ?? {});
        const byDiff = Object.values(meta.difficultyStars ?? {}).flatMap((m) =>
            Object.values(m ?? {})
        );
        const sum = (arr) => arr.reduce((a, v) => a + (Number(v) || 0), 0);
        return {
            slot,
            empty: false,
            highestStage: Number(meta.highestStage) || 0,
            stars: sum(normal) + sum(byDiff),
            units: Object.keys(st.roster?.owned ?? {}).length,
            gold: Number(meta.currencies?.gold) || 0,
            savedAt: Number(meta.savedAt) || 0,
        };
    } catch {
        // ★ 읽히지 않는 슬롯도 **비었다고 하지 않는다.** 덮어쓰기 전에
        //   "손상됨" 이라고 말해 줘야 플레이어가 지울지 말지 고를 수 있다.
        return { slot, empty: false, broken: true };
    }
}

/** 슬롯 전체 요약 (타이틀 화면이 부른다) */
export async function readAllSlots() {
    return Promise.all(SLOTS.map(readSlot));
}

/**
 * 이 슬롯으로 갈아탄다.
 *
 * ★ 이름을 `useSlot` 으로 짓지 않는다 — 훅이 아닌데 훅처럼 보이면
 *   `react-hooks/rules-of-hooks` 가 콜백 안 호출을 오류로 잡는다 (실제로 잡혔다).
 *
 * ★★ zustand persist 의 `name` 은 생성 시점에 고정된다. `setOptions` 로 바꾼 뒤
 *   **반드시 `rehydrate()`** 를 불러야 새 키의 내용이 메모리로 온다 — 안 부르면
 *   화면은 이전 슬롯의 상태를 보여 주면서 저장만 새 키로 간다. 가장 나쁜 조합이다.
 *
 * ★★ 그리고 **rehydrate 만으로는 부족하다.** 그것은 저장본을 *현재 상태 위에 얹을*
 *   뿐이라, **빈 슬롯으로 갈아타면 이전 슬롯의 값이 그대로 남는다.**
 *   실제로 그렇게 동작했다 — 빈 슬롯 2를 골랐는데 슬롯 1의 골드와 진행도가 보였다.
 *   그래서 얹기 전에 `resetToPristine()` 으로 바닥을 지운다.
 *
 * ★★★ **그런데 그 지우기가 고른 슬롯의 세이브를 파괴했다** (2026-08-04 실측).
 *
 *   zustand persist 는 `setState` 를 감싸서 **하이드레이션 여부와 무관하게 즉시
 *   `storage.setItem` 을 부른다** (`store/index.js:flushSave` 주석의 그 성질이다).
 *   그래서 `setOptions({name})` 로 키를 바꾼 **직후**의 `resetToPristine()` 은
 *   순정 상태를 **새 슬롯에 그대로 기록한다.** 그 다음 `rehydrate()` 가 읽는 것은
 *   방금 자기가 덮어쓴 빈 세이브다.
 *
 *   실측: `{version:15, highestStage:42, gold:12345}` 를 심어 둔 슬롯을 열면
 *   진행도 0 · 골드 500 이 되고 디스크의 42도 사라진다. **되돌릴 수 없다.**
 *
 *   그래서 지우는 동안에는 **저장소를 잠시 끊는다.** 순서가 규칙이다:
 *     ① 저장소를 무효 저장소로 → ② 바닥 지우기(쓰기는 허공으로) →
 *     ③ 키와 저장소를 함께 복구 → ④ rehydrate(진짜 세이브를 읽는다)
 *
 * @returns {Promise<boolean>}
 */
export async function openSlot(store, slot) {
    if (!isSlot(slot)) return false;
    // ① 쓰기를 끊는다 — 이 사이의 setState 는 어디에도 기록되지 않는다
    store.persist.setOptions({ storage: createJSONStorage(() => VOID_STORAGE) });
    // ② 바닥을 지운다
    resetToPristine();
    // ③ 새 키 + 진짜 저장소
    store.persist.setOptions({
        name: slotKey(slot),
        storage: createJSONStorage(() => capacitorStorage),
    });
    // ④ 이제 읽는다
    await store.persist.rehydrate();
    try {
        await capacitorStorage.setItem(LAST_SLOT_KEY, String(slot));
    } catch {
        /* 마지막 슬롯 기억에 실패해도 플레이는 계속된다 */
    }
    return true;
}

/** 마지막으로 고른 슬롯 (없으면 null) */
export async function lastSlot() {
    try {
        const v = Number(await capacitorStorage.getItem(LAST_SLOT_KEY));
        return isSlot(v) ? v : null;
    } catch {
        return null;
    }
}

/**
 * 슬롯을 지운다. **되돌릴 수 없다** — 호출부가 확인을 책임진다
 * (`store/index.js:resetSave` 와 같은 규약).
 */
export async function deleteSlot(slot) {
    if (!isSlot(slot)) return false;
    try {
        await capacitorStorage.removeItem(slotKey(slot));
        return true;
    } catch {
        return false;
    }
}
