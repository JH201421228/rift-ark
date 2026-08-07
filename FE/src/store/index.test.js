/**
 * flushSave() — 하이드레이션 가드
 *
 * ★ 이 파일이 고정하는 것: **복원이 끝나기 전에는 디스크에 한 글자도 쓰지 않는다.**
 *
 *   왜 테스트가 필요한가:
 *   예전 코드는 `await useGameStore.persist.rehydrate` 였다. 괄호가 없어 함수
 *   '참조' 를 await 했고, 그것은 언제나 즉시 통과한다. 그 뒤 `setState({})` 는
 *   zustand persist 가 감싸고 있어 **하이드레이션 여부와 무관하게** 즉시
 *   storage.setItem 을 호출한다. 결과는 콜드 스타트 중 홈 버튼 한 번으로
 *   roster·meta·shop·gacha·daily 가 전부 기본값으로 덮이는 것이다.
 *
 *   가드가 "생겼다"가 아니라 "동작한다"를 확인하려면 **하이드레이션이 끝나지
 *   않은 순간**을 붙잡아야 한다. 그래서 storage.getItem 을 테스트가 붙잡고
 *   있다가 원할 때 풀어 준다 — 실제 Preferences.get 지연과 같은 모양이다.
 *
 * @see docs/03-tech/21-state-management.md §6.2
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/** vi.mock 팩토리보다 먼저 만들어져야 한다 */
const io = vi.hoisted(() => ({
    /** @type {((v: string|null) => void)|null} getItem 을 풀어 주는 손잡이 */
    releaseGet: null,
    /** @type {string[]} 디스크에 기록된 원문 */
    writes: [],
    /** @type {(() => void)|null} setItem 을 붙잡아 두는 게이트 */
    holdWrite: null,
}));

// ★ @capacitor/* 를 끌어오지 않기 위해 어댑터째 갈아 끼운다.
//   (테스트 환경은 node 다 — vite.config.js test.environment)
vi.mock("@/native/storage", () => ({
    capacitorStorage: {
        getItem: () =>
            new Promise((resolve) => {
                io.releaseGet = resolve;
            }),
        setItem: async (_key, value) => {
            io.writes.push(value);
            if (io.holdWrite) await io.holdWrite;
        },
        removeItem: async () => {},
    },
}));

beforeEach(() => {
    vi.resetModules();
    io.releaseGet = null;
    io.writes = [];
    io.holdWrite = null;
});

/** 실제 세이브처럼 생긴 페이로드를 기본 상태로부터 만든다 */
function savePayload(store, version) {
    const b = store.getState();
    return JSON.stringify({
        version,
        state: {
            roster: b.roster,
            meta: {
                ...b.meta,
                highestStage: 42,
                currencies: { ...b.meta.currencies, gold: 777777 },
            },
            settings: b.settings,
            shop: b.shop,
            gacha: b.gacha,
            daily: b.daily,
            ftue: b.ftue,
        },
    });
}

describe("flushSave 하이드레이션 가드", () => {
    it("복원 전에는 디스크에 아무것도 쓰지 않는다", async () => {
        const { useGameStore, flushSave } = await import("@/store");
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

        // 콜드 스타트 구간 — Preferences.get 응답이 아직 오지 않았다.
        expect(useGameStore.persist.hasHydrated()).toBe(false);

        // App.jsx 의 onPause 가 하는 일 그대로.
        const wrote = await flushSave();

        expect(wrote).toBe(false);
        // ★ 핵심 단언 — 예전 코드는 여기서 '기본 상태' 한 건을 기록했다.
        expect(io.writes).toEqual([]);
        warn.mockRestore();
    });

    it("복원이 끝난 뒤에는 복원된 값을 기록한다", async () => {
        const { useGameStore, flushSave, SAVE_VERSION } = await import("@/store");

        const hydrated = new Promise((r) => useGameStore.persist.onFinishHydration(r));
        const payload = savePayload(useGameStore, SAVE_VERSION);

        // 복원 전 flush 는 무시된다
        await flushSave();
        expect(io.writes).toEqual([]);

        io.releaseGet(payload);
        await hydrated;
        expect(useGameStore.persist.hasHydrated()).toBe(true);

        io.writes = []; // 복원 중 normalize* 가 낸 기록은 관심 밖
        const wrote = await flushSave();

        expect(wrote).toBe(true);
        expect(io.writes).toHaveLength(1);
        const disk = JSON.parse(io.writes[0]).state;
        // 기본값(gold 0 / highestStage 0)이 아니라 복원된 값이 기록됐다
        expect(disk.meta.currencies.gold).toBe(777777);
        expect(disk.meta.highestStage).toBe(42);
    });

    it("기록이 끝나기 전에 반환하지 않는다", async () => {
        // 앱이 곧 죽을 수 있는 시점이다 — setItem 프로미스를 흘려보내면
        // "저장했다"고 말한 뒤 저장되지 않은 채 종료될 수 있다.
        const { useGameStore, flushSave, SAVE_VERSION } = await import("@/store");
        const hydrated = new Promise((r) => useGameStore.persist.onFinishHydration(r));
        io.releaseGet(savePayload(useGameStore, SAVE_VERSION));
        await hydrated;

        let openGate;
        io.holdWrite = new Promise((r) => {
            openGate = r;
        });

        let settled = false;
        const p = flushSave().then((v) => {
            settled = true;
            return v;
        });
        await Promise.resolve();
        await Promise.resolve();
        expect(settled).toBe(false); // 아직 디스크가 응답하지 않았다

        openGate();
        expect(await p).toBe(true);
    });
});
