/**
 * 렌더 이벤트 큐 — 소비 계약 테스트
 *
 * ★ 이 파일이 고정하는 것은 **"방출된 이벤트는 정확히 한 번 소비된다"** 하나다.
 *
 *   기존 테스트가 이 결함을 못 잡은 이유:
 *   `runToCompletion()` 은 드래프트를 스스로 해소하고 이벤트 큐를 **아예 소비하지
 *   않는다**. 즉 밸런스 하네스가 도는 경로에는 소비자가 없다. 소비자가 있는 경로는
 *   BattleScene 뿐이고, 그것은 Phaser 씬이라 유닛 테스트가 인스턴스화하지 못한다.
 *   그래서 소비 로직을 순수 함수(`drainEvents`)로 끌어내고,
 *   **BattleScene 의 호출 순서를 그대로 재현**하는 드라이버를 여기 둔다.
 *
 * @see docs/03-tech/22-simulation-spec.md §5.6
 */
import { describe, it, expect } from "vitest";
import {
    EV,
    createEventQueue,
    createEventReader,
    drainEvents,
    emit,
    resetQueue,
} from "./events.js";
import { createSim, step, chooseSigil } from "./sim.js";
import { buildStageConfig } from "./stageConfig.js";
import { autoPlayTick } from "./autoPlay.js";

const BASIC = ["slow_turtle", "determined_soldier", "elf_sharpshooter", "novice_pyromancer"];

/* ══════════════════════════════════════════════════════════════
 * 커서 단위 계약
 * ══════════════════════════════════════════════════════════════ */
describe("drainEvents 커서", () => {
    it("같은 세대에 나중에 append 된 이벤트만 추가로 넘긴다", () => {
        const q = createEventQueue(16);
        const r = createEventReader();
        const seen = [];
        const sink = (e) => seen.push(e.type);

        emit(q, EV.SPAWN);
        emit(q, EV.DAMAGE);
        drainEvents(q, r, sink);
        expect(seen).toEqual([EV.SPAWN, EV.DAMAGE]);

        // ★ 큐를 비우지 않고 append — chooseSigil() 이 하는 일과 같다
        emit(q, EV.SIGIL_TAKEN);
        drainEvents(q, r, sink);
        expect(seen).toEqual([EV.SPAWN, EV.DAMAGE, EV.SIGIL_TAKEN]);
    });

    it("리셋 후 이벤트 수가 줄어도 앞부분을 건너뛰지 않는다", () => {
        // ★ 커서만 두고 세대(epoch)를 세지 않으면 여기서 무너진다.
        //   length 는 매 틱 0 으로 돌아가므로 커서 단독으로는
        //   '리셋됐다' 와 '이번엔 이벤트가 적다' 를 구분할 수 없다.
        const q = createEventQueue(16);
        const r = createEventReader();
        const seen = [];
        const sink = (e) => seen.push(e.type);

        for (let i = 0; i < 5; i++) emit(q, EV.DAMAGE);
        drainEvents(q, r, sink);
        expect(seen).toHaveLength(5);

        resetQueue(q);
        emit(q, EV.SPAWN);
        emit(q, EV.DEATH);
        drainEvents(q, r, sink);
        expect(seen.slice(5)).toEqual([EV.SPAWN, EV.DEATH]);
    });

    it("소비할 것이 없으면 아무것도 넘기지 않는다 (중복 호출 안전)", () => {
        const q = createEventQueue(16);
        const r = createEventReader();
        let n = 0;
        const sink = () => n++;

        emit(q, EV.SPAWN);
        drainEvents(q, r, sink);
        drainEvents(q, r, sink);
        drainEvents(q, r, sink);
        expect(n).toBe(1);
    });
});

/* ══════════════════════════════════════════════════════════════
 * 회귀 — 각인 선택 시 직전 틱 재소비
 * ══════════════════════════════════════════════════════════════ */
describe("각인 드래프트 재개", () => {
    /**
     * BattleScene.runSimulation / _onSigilChoose 의 호출 순서를 그대로 재현한다.
     *   battle: step() → consumeEvents()
     *   draft : chooseSigil() → consumeEvents()
     */
    function driveLikeBattleScene(s, maxTicks = 12000) {
        const reader = createEventReader();
        const seen = [];
        const sink = (e) => seen.push({ type: e.type, a: e.a, b: e.b, c: e.c, s: e.s });

        let drafts = 0;
        let draftsWithStaleEvents = 0;
        const afterChoice = [];

        while ((s.phase === "battle" || s.phase === "draft") && s.tick < maxTicks) {
            if (s.phase === "draft") {
                // 드래프트가 열린 틱의 이벤트는 이미 소비됐지만 큐에는 남아 있다.
                // 남아 있어야만 (커서 없는) 예전 코드가 그것을 재실행했을 것이다.
                if (s.events.length > 0) draftsWithStaleEvents++;

                const before = seen.length;
                chooseSigil(s, 0);
                drainEvents(s.events, reader, sink);
                afterChoice.push(seen.slice(before));
                drafts++;
                continue;
            }
            step(s, autoPlayTick);
            drainEvents(s.events, reader, sink);
        }
        return { seen, drafts, draftsWithStaleEvents, afterChoice };
    }

    it("각인 선택 직후에는 SIGIL_TAKEN·EVOLUTION 만 소비된다", () => {
        const s = createSim(buildStageConfig("1-9", BASIC), 12345);
        const { drafts, draftsWithStaleEvents, afterChoice } = driveLikeBattleScene(s);

        // 테스트가 헛돌지 않는다는 증명 — 드래프트가 실제로 열렸고,
        // 그 순간 큐에 직전 틱 이벤트가 남아 있었다.
        expect(drafts).toBeGreaterThan(0);
        expect(draftsWithStaleEvents).toBeGreaterThan(0);

        const allowed = new Set([EV.SIGIL_TAKEN, EV.EVOLUTION]);
        for (const batch of afterChoice) {
            expect(batch.length).toBeGreaterThan(0); // 최소 SIGIL_TAKEN 1건
            for (const e of batch) expect(allowed.has(e.type)).toBe(true);
        }
    });

    it("SPAWN·DEATH 가 같은 엔티티에 두 번 전달되지 않는다", () => {
        // 유령 유닛(스프라이트 맵 덮어쓰기)과 도감 처치 2배 집계의 직접 원인.
        //
        // ★ 아래 stage/seed 는 **수정 전 소비자에서 실제로 중복이 관측된** 조합이다
        //   (30스테이지 × 12시드 스윕에서 추출). 스테이지 데이터가 재생성되면
        //   조합이 무뎌질 수 있지만, 위의 '선택 직후 배치' 단언은 스테이지와
        //   무관하게 모든 드래프트에서 걸리므로 방어선은 유지된다.
        const cases = [
            ["1-11", 8], // SPAWN 중복
            ["1-12", 4], // SPAWN + DEATH 중복
            ["2-2", 7], // SPAWN 중복
            ["1-9", 1], // DEATH 중복
            ["1-16", 1], // DEATH 중복
            ["1-5", 10], // DEATH 중복
        ];
        const dups = [];
        for (const [stageId, seed] of cases) {
            const s = createSim(buildStageConfig(stageId, BASIC), seed);
            const { seen, drafts } = driveLikeBattleScene(s);
            expect(drafts).toBeGreaterThan(0);

            const spawned = new Set();
            const died = new Set();
            for (const e of seen) {
                if (e.type === EV.SPAWN) {
                    if (spawned.has(e.a)) dups.push(`${stageId}/${seed} SPAWN#${e.a}`);
                    spawned.add(e.a);
                } else if (e.type === EV.DEATH) {
                    if (died.has(e.a)) dups.push(`${stageId}/${seed} DEATH#${e.a}`);
                    died.add(e.a);
                }
            }
        }
        expect(dups).toEqual([]);
    });

    it("TEMPO_SHIFT 는 전투당 최대 1회만 소비된다", () => {
        // 재소비되면 각인 선택 순간 히트스톱 200ms + 셰이크가 뜬금없이 재발동한다.
        // ★ 1-2 ~ 1-4 는 템포 시프트 웨이브와 드래프트 웨이브가 겹치는 구간이라
        //   수정 전에는 **모든 시드에서** TEMPO_SHIFT 가 2회 소비됐다.
        const over = [];
        for (const stageId of ["1-2", "1-3", "1-4"]) {
            for (const seed of [1, 5, 12]) {
                const s = createSim(buildStageConfig(stageId, BASIC), seed);
                const { seen } = driveLikeBattleScene(s);
                const n = seen.filter((e) => e.type === EV.TEMPO_SHIFT).length;
                if (n > 1) over.push(`${stageId}/${seed}=${n}`);
            }
        }
        expect(over).toEqual([]);
    });
});
