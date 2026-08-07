/**
 * 진단 기록기 — **정말로 기록하는가.**
 *
 * ★★ 이 저장소가 계속 잡아 온 결함의 모양 그대로다: "만들었는데 아무도 못 쓰는 것."
 *   감시 장치는 특히 위험하다 — 아무 일도 일어나지 않는 동안에는 배선이 끊겨
 *   있어도 **정상과 구별되지 않는다.** 그래서 여기서는 실제로 사건을 일으켜
 *   기록이 남는지 본다.
 *
 * ★ `environment: "node"` 라 DOM 이 없다. 필요한 것(`localStorage` ·
 *   `requestAnimationFrame` · `document`)만 최소로 세워 준다 — 여기서 재는 것은
 *   브라우저가 아니라 **기록기의 규약**이다.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

/* ── 최소 브라우저 표면 ────────────────────────────────────── */
const store = new Map();
globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
};
globalThis.document = { visibilityState: "visible", addEventListener() {}, removeEventListener() {} };

const {
    FAULT,
    clearFaults,
    describeFaultContext,
    listFaults,
    recordFault,
    faultVersion,
    activeFault,
    dismissFault,
    subscribeFaults,
    setContextProvider,
    checkLastRun,
} = await import("./diagnostics.js");

const BEAT_KEY = "riftark-diagnostics-beat";

beforeEach(() => {
    clearFaults();
    setContextProvider(null);
    store.clear();
});

describe("링버퍼", () => {
    it("기록이 최신 먼저 쌓인다", () => {
        recordFault(FAULT.EXCEPTION, "첫째");
        recordFault(FAULT.EXCEPTION, "둘째");
        const list = listFaults();
        expect(list[0].msg).toBe("둘째");
        expect(list[1].msg).toBe("첫째");
    });

    it("★ 상한을 넘으면 오래된 것부터 밀려난다 — 무한히 자라지 않는다", () => {
        for (let i = 0; i < 200; i++) recordFault(FAULT.EXCEPTION, `오류 ${i}`);
        const list = listFaults();
        expect(list.length).toBeLessThanOrEqual(64);
        expect(list[0].msg).toBe("오류 199");
    });

    it("★★ 같은 사건이 반복되면 줄을 늘리지 않고 센다", () => {
        // 매 프레임 같은 예외가 터지는 것이 정상적인 실패 모양이다.
        // 세지 않으면 링버퍼가 한 사건으로 가득 차 원인이 밀려 나간다.
        for (let i = 0; i < 50; i++) recordFault(FAULT.SCENE, "Battle.update: x is undefined");
        const list = listFaults();
        expect(list.length).toBe(1);
        expect(list[0].count).toBe(50);
    });

    it("맥락 제공자가 준 숫자가 기록에 실린다", () => {
        setContextProvider((rec) => {
            rec.scene = "전투 1-14";
            rec.wave = 13;
            rec.actives = 85;
            rec.projectiles = 49;
        });
        recordFault(FAULT.STALL, "프레임 620ms", null, 620);
        const f = listFaults()[0];
        expect(f.wave).toBe(13);
        expect(f.actives).toBe(85);
        expect(f.ms).toBe(620);
        expect(describeFaultContext(f)).toContain("웨이브 13");
        expect(describeFaultContext(f)).toContain("발사체 49");
    });

    it("맥락 제공자가 던져도 기록은 남는다", () => {
        setContextProvider(() => {
            throw new Error("씬이 이미 죽었다");
        });
        expect(() => recordFault(FAULT.FRAME, "프레임 예외")).not.toThrow();
        expect(listFaults().length).toBe(1);
    });
});

describe("배너 대상", () => {
    it("★ 지연(stall)은 배너를 띄우지 않는다 — 자주 일어나는 것으로 화면을 가리지 않는다", () => {
        recordFault(FAULT.STALL, "프레임 500ms", null, 500);
        expect(activeFault()).toBeNull();
    });

    it("예외는 배너를 띄우고, 닫으면 그 시점 이후 것만 다시 뜬다", () => {
        recordFault(FAULT.EXCEPTION, "터졌다");
        expect(activeFault()?.msg).toBe("터졌다");
        dismissFault();
        expect(activeFault()).toBeNull();
        recordFault(FAULT.CONTEXT_LOST, "컨텍스트 손실");
        expect(activeFault()?.msg).toBe("컨텍스트 손실");
    });
});

describe("구독", () => {
    it("기록마다 스냅샷이 바뀌고 구독자가 불린다", () => {
        const cb = vi.fn();
        const off = subscribeFaults(cb);
        const before = faultVersion();
        recordFault(FAULT.PROMISE, "청크 로드 실패");
        expect(faultVersion()).toBeGreaterThan(before);
        expect(cb).toHaveBeenCalled();
        off();
    });
});

describe("★★★ 블랙박스 — 무한 루프는 이 경로로만 드러난다", () => {
    it("표식 없는 심장박동을 발견하면 '무응답 종료'를 기록한다", () => {
        // 멈추기 직전에 감시자가 적어 둔 것 (clean: false = 정상 종료 표식 없음)
        store.set(
            BEAT_KEY,
            JSON.stringify({
                at: Date.now(),
                clean: false,
                scene: "전투 1-14",
                wave: 13,
                actives: 85,
                projectiles: 90,
                undrawn: 10,
                heapMB: 210,
            })
        );
        expect(checkLastRun()).toBe(true);

        const f = listFaults()[0];
        expect(f.kind).toBe(FAULT.HANG);
        expect(f.wave).toBe(13);
        expect(f.projectiles).toBe(90);

        /**
         * ★★★ **배너로는 뜨지 않는다** (2026-08-07, 사용자 요청).
         *
         *   예전에는 여기서 `activeFault()?.kind === FAULT.HANG` 을 요구했다.
         *   무응답 종료는 이제 `QUIET` 에 들어가 **기록만 남고 배너는 뜨지 않는다** —
         *   OS 가 메모리 압박으로 프로세스를 정리했거나 사용자가 앱 전환기에서
         *   밀어 껐을 때도 `clean` 표식이 없어 정상 종료가 '응답 없이 끝났다'로
         *   보고되기 때문이다. 켤 때마다 빨간 경고를 보는 쪽의 대가가 더 크다.
         *
         *   **검사가 약해지지 않게** 두 가지를 대신 못박는다:
         *     ① 기록은 반드시 남는다 (위 `listFaults()[0]` — 블랙박스가 죽으면 안 된다)
         *     ② 배너는 반드시 안 뜬다 (아래 — 되살리면 여기서 걸린다)
         */
        expect(
            activeFault(),
            "무응답 종료는 기록만 남기고 배너를 띄우지 않는다 (diagnostics.js:QUIET)"
        ).toBe(null);
    });

    it("정상 종료 표식이 있으면 아무것도 기록하지 않는다", () => {
        store.set(BEAT_KEY, JSON.stringify({ at: Date.now(), clean: true, scene: "방주" }));
        expect(checkLastRun()).toBe(false);
        expect(listFaults().length).toBe(0);
    });

    it("심장박동은 한 번만 신고된다 — 켤 때마다 같은 배너가 뜨면 아무도 안 읽는다", () => {
        store.set(BEAT_KEY, JSON.stringify({ at: Date.now(), clean: false, scene: "전투 1-14" }));
        expect(checkLastRun()).toBe(true);
        expect(checkLastRun()).toBe(false);
    });

    it("저장소가 깨져 있어도 던지지 않는다", () => {
        store.set(BEAT_KEY, "{깨진 JSON");
        expect(() => checkLastRun()).not.toThrow();
    });
});
