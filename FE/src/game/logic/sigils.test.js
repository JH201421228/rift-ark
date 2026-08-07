/**
 * 각인 시스템 테스트
 * @see docs/02-design/11-core-loop.md §5.3
 */
import { describe, it, expect } from "vitest";
import { createSim, step, runToCompletion, rerollDraft, chooseSigil, isTerminalPhase } from "./sim.js";
import { buildStageConfig } from "./stageConfig.js";
import { autoPlayTick } from "./autoPlay.js";
import { SIGILS, EVOLUTIONS, applySigil, rollDraft, OPS } from "./sigils.js";
import sigilData from "../data/sigils.json" with { type: "json" };

const BASIC = ["slow_turtle", "determined_soldier", "elf_sharpshooter", "novice_pyromancer"];
const mkSim = (stage = "1-9", seed = 1) => createSim(buildStageConfig(stage, BASIC), seed);

describe("데이터 무결성", () => {
    it("모든 각인의 op 가 구현되어 있다", () => {
        for (const s of sigilData.sigils) {
            for (const h of s.hooks ?? []) {
                expect(OPS[h.op], `${s.id} → ${h.op}`).toBeTypeOf("function");
            }
        }
    });

    it("모든 진화의 op 가 구현되어 있다", () => {
        for (const e of EVOLUTIONS) {
            for (const h of e.hooks ?? []) {
                expect(OPS[h.op], `${e.id} → ${h.op}`).toBeTypeOf("function");
            }
        }
    });

    it("진화 재료가 전부 실존하는 각인이다", () => {
        for (const e of EVOLUTIONS) {
            for (const r of e.requires) {
                expect(SIGILS[r], `${e.id} requires ${r}`).toBeDefined();
            }
        }
    });

    it("각인 id 가 중복되지 않는다", () => {
        const ids = sigilData.sigils.map((s) => s.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    /**
     * ★ 대가형(`category: "cost"`)은 2026-08-04 경량화로 전부 사라졌다.
     *   **규칙은 남긴다** — 다시 넣는 날 페널티 없는 "대가형"이 들어오는 것을 막는다.
     */
    it("대가형 각인이 있다면 반드시 페널티를 가진다 — 다크 패턴 방지", () => {
        const costs = sigilData.sigils.filter((s) => s.category === "cost");
        for (const s of costs) {
            // 감소 방향의 훅이 최소 1개 있어야 한다
            const hasPenalty = s.hooks.some(
                (h) =>
                    (typeof h.value === "number" && h.value < 0) ||
                    (h.op.startsWith("mul") && h.value < 1) ||
                    (h.op === "addRoleBlock" && h.value < 0)
            );
            expect(hasPenalty, `${s.id} 에 페널티가 없다`).toBe(true);
        }
    });

    it("모든 각인에 한국어 이름과 설명이 있다", () => {
        for (const s of sigilData.sigils) {
            expect(s.name?.ko, s.id).toBeTruthy();
            expect(s.desc?.ko, s.id).toBeTruthy();
        }
    });
});

describe("적용", () => {
    it("훅이 등록되고 apply 훅은 즉시 실행된다", () => {
        const s = mkSim();
        const before = s.arkHpMax;
        applySigil(s, "reinforced_ark"); // apply: 방주 최대 HP +25%
        expect(s.arkHpMax).toBe(Math.round(before * 1.25));
        expect(s.sigils).toContain("reinforced_ark");
    });

    it("스탯 각인은 이후 소환되는 유닛에만 적용된다", () => {
        const s = mkSim();
        applySigil(s, "iron_hide"); // 방벽 HP +40%
        expect(s.hooks.modifyStat.length).toBe(1);
    });

    it("방주 배율형은 즉시 반영된다 (apply 훅)", () => {
        const s = mkSim();
        const hpBefore = s.arkHpMax;
        applySigil(s, "reinforced_ark");
        expect(s.arkHpMax).toBeGreaterThan(hpBefore);
    });
});

/**
 * ★★ 진화 조합은 2026-08-04 경량화로 데이터에서 비웠다 (`sigils.json:evolutions = []`).
 *   **규칙 엔진은 그대로 남아 있으므로** 그 계약이 여전히 성립하는지 여기서 확인한다 —
 *   지우면, 다시 넣는 날 아무 그물 없이 넣게 된다.
 */
describe("진화", () => {
    it("데이터가 비어 있으면 아무것도 융합되지 않는다", () => {
        const s = mkSim();
        expect(applySigil(s, "piercing_arrow")).toBeNull();
        expect(applySigil(s, "aura_frost")).toBeNull();
        expect(s.evolved).toEqual([]);
    });

    it("드래프트가 조합 힌트를 켜지 않는다", () => {
        const s = mkSim();
        s.wave = 5;
        applySigil(s, "aura_frost");
        for (let i = 0; i < 50; i++) {
            for (const o of rollDraft(s, 3)) expect(o.reactive).toBe(false);
        }
    });
});

describe("드래프트", () => {
    it("3지선다를 뽑는다", () => {
        const s = mkSim();
        s.wave = 3;
        const opts = rollDraft(s, 3);
        expect(opts).toHaveLength(3);
        expect(new Set(opts.map((o) => o.id)).size).toBe(3); // 중복 없음
    });

    it("옵션 객체에 내부 정보가 새어나가지 않는다", () => {
        const s = mkSim();
        s.wave = 5;
        for (const o of rollDraft(s, 3)) {
            expect(Object.keys(o).sort()).toEqual(["id", "reactive"]);
        }
    });

    it("maxStacks 를 넘으면 후보에서 빠진다", () => {
        const s = mkSim();
        s.wave = 5;
        for (let i = 0; i < 3; i++) applySigil(s, "piercing_arrow"); // maxStacks 3
        for (let i = 0; i < 60; i++) {
            expect(rollDraft(s, 3).some((o) => o.id === "piercing_arrow")).toBe(false);
        }
    });

    it("minWave 이전에는 등장하지 않는다", () => {
        const s = mkSim();
        s.wave = 1;
        for (let i = 0; i < 60; i++) {
            const ids = rollDraft(s, 3).map((o) => o.id);
            for (const id of ids) expect(SIGILS[id].minWave ?? 0).toBeLessThanOrEqual(1);
        }
    });

    it("리롤은 남은 횟수만큼만 된다", () => {
        const s = mkSim();
        s.wave = 3;
        s.pendingDraft = { options: rollDraft(s, 3), wave: 3 };
        s.rerollsLeft = 1;
        expect(rerollDraft(s)).toBe(true);
        expect(rerollDraft(s)).toBe(false);
    });
});

describe("전투 통합", () => {
    it("3웨이브마다 드래프트가 열리고 시뮬이 멈춘다", () => {
        const s = mkSim("1-9", 5);
        let guard = 0;
        while (s.phase === "battle" && guard < 30 * 200) {
            step(s, (st) => autoPlayTick(st));
            guard++;
        }
        expect(s.phase).toBe("draft");
        expect(s.pendingDraft.options.length).toBe(3);
        expect(s.wave % 3).toBe(0);
    });

    it("선택하면 전투가 재개된다", () => {
        const s = mkSim("1-9", 5);
        runToCompletion(s, (st) => autoPlayTick(st));
        expect(["victory", "defeat"]).toContain(s.phase);
        expect(s.draftsTaken).toBeGreaterThan(0);
    });

    it("일반 스테이지에서 4~6픽이 나온다", () => {
        // ★ GDD §4.6 — 3웨이브마다 드래프트, 스테이지당 4–6픽.
        //   판정은 완주 가능한 일반 스테이지에서 한다. 1-9 는 "설계된 첫 패배"라
        //   중간에 끝나므로 픽 수 판정에 쓸 수 없다 (승률 0% 가 정상인 스테이지다).
        const s = mkSim("1-11", 7);
        runToCompletion(s, (st) => autoPlayTick(st));
        expect(s.phase).toBe("victory");
        expect(s.draftsTaken).toBeGreaterThanOrEqual(4);
        expect(s.draftsTaken).toBeLessThanOrEqual(6);
    });

    /**
     * ★ 회귀 방지 — 실제 플레이에서만 드러났던 버그.
     *   BattleScene 이 "phase !== 'battle' 이면 전투 종료"로 판정하는 바람에
     *   각인 드래프트가 열리는 순간 전투가 패배로 끝났다.
     *   드래프트는 전투를 *멈추는* 상태이지 *끝내는* 상태가 아니다.
     *   runToCompletion 은 draft 를 스스로 처리해서 이 경로를 타지 않으므로,
     *   판정 자체를 직접 검증한다.
     */
    it("드래프트는 종료 상태가 아니다 — 선택 후 전투가 이어진다", () => {
        expect(isTerminalPhase("draft")).toBe(false);
        expect(isTerminalPhase("battle")).toBe(false);
        expect(isTerminalPhase("victory")).toBe(true);
        expect(isTerminalPhase("defeat")).toBe(true);

        // 드래프트가 열릴 때까지 돌린다
        const s = mkSim("1-11", 3);
        let guard = 0;
        while (s.phase === "battle" && guard++ < 30_000) step(s, (st) => autoPlayTick(st));

        expect(s.phase).toBe("draft");
        expect(isTerminalPhase(s.phase)).toBe(false);

        // 선택하면 전투로 돌아가고 계속 진행된다
        chooseSigil(s, 0);
        expect(s.phase).toBe("battle");

        const tickBefore = s.tick;
        step(s, (st) => autoPlayTick(st));
        expect(s.tick).toBeGreaterThan(tickBefore);
    });

    it("각인이 실제로 전투 결과를 바꾼다", () => {
        // 항상 첫 선택지 vs 항상 마지막 선택지
        const runWith = (policy) => {
            const s = mkSim("1-9", 31);
            runToCompletion(s, (st) => autoPlayTick(st), 400, policy);
            return s;
        };
        const a = runWith(() => 0);
        const b = runWith((s) => s.pendingDraft.options.length - 1);
        expect(a.sigils).not.toEqual(b.sigils);
    });

    it("드래프트 정책이 결정론적이면 결과도 결정론적이다", () => {
        const run = () => {
            const s = mkSim("1-9", 99);
            runToCompletion(s, (st) => autoPlayTick(st), 400, () => 0);
            return { phase: s.phase, arkHp: s.arkHp, kills: s.stats.kills, sigils: s.sigils };
        };
        expect(run()).toEqual(run());
    });
});
