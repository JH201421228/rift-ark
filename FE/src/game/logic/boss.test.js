/**
 * 보스 페이즈 검증 (P6-05)
 *
 * ★ 여기서 지키는 것은 "보스가 적당히 어려운가"가 아니라
 *   **페이즈가 실제로 편성 퍼즐을 만드는가**다.
 *
 *   구체적으로:
 *   1. 태그가 정말로 바뀌는가 (안 바뀌면 이 시스템은 없는 것이다)
 *   2. 바뀐 태그가 **다른 데미지 타입**을 요구하는가
 *      — 같은 답이 연속되면 페이즈는 연출일 뿐이다
 *   3. 예고가 실제로 시간을 벌어주는가 (예고 중에는 때리지 않는다)
 *   4. 결정론이 유지되는가 (B1 하드 게이트)
 *
 * ★ 난이도·승률은 밸런스 하네스(balance-check)가 본다. 여기서 보지 않는다.
 */
import { describe, it, expect } from "vitest";
import { createSim, runToCompletion, step } from "./sim.js";
import { buildStageConfig } from "./stageConfig.js";
import { autoPlayTick } from "./autoPlay.js";
import { bossSnapshot } from "./boss.js";
import { TAG, maskToTags } from "./tags.js";
import { MODE } from "./modes.js";
import { TICK_MS } from "./tick.js";
import { EV } from "./events.js";
import { computeDamage } from "./combat.js";
import stagesData from "../data/stages.json" with { type: "json" };
import enemiesData from "../data/enemies.json" with { type: "json" };
import balance from "../data/balance.json" with { type: "json" };

const L = (id, level) => ({ id, level, rank: 1 });
const SIX = [
    L("slow_turtle", 20),
    L("bold_man_at_arms", 20),
    L("determined_soldier", 20),
    L("elf_sharpshooter", 20),
    L("novice_pyromancer", 20),
    L("jovial_friar", 20),
];

const NEMESIS_STAGES = stagesData.stages.filter((s) => s.mode === MODE.NEMESIS).map((s) => s.id);
const BOSS_DEFS = enemiesData.enemies.filter((e) => e.boss);

/** 보스 스테이지 마지막 웨이브에 실제로 서는 보스들 (P6-06) */
const DEPLOYED_BOSS_IDS = NEMESIS_STAGES.map((id) => {
    const st = stagesData.stages.find((s) => s.id === id);
    return st.waveTable[st.waveTable.length - 1].spawns[0].id;
});
const DEPLOYED_BOSSES = DEPLOYED_BOSS_IDS.map((id) => BOSS_DEFS.find((b) => b.id === id));

/**
 * 1틱 진행. 각인 드래프트는 **아무것도 고르지 않고** 넘긴다.
 *
 * ★ 각인을 실제로 적용하면 광역·관통이 붙어 보스 페이즈 실험이 오염된다.
 *   여기서 보는 것은 보스 메커니즘이지 각인과의 상호작용이 아니다.
 *
 * @returns {boolean} 아직 전투 중인가
 */
function tick(s, onTick = null) {
    if (s.phase === "draft") {
        s.pendingDraft = null;
        s.phase = "battle";
    }
    if (s.phase !== "battle") return false;
    step(s, onTick);
    return true;
}

/** 보스가 등장할 때까지 돌린 뒤, 그 시점의 sim 을 준다 */
function runUntilBoss(stageId, seed, maxSec = 400) {
    const s = createSim(buildStageConfig(stageId, SIX), seed);
    const maxTicks = Math.ceil((maxSec * 1000) / TICK_MS);
    for (let i = 0; i < maxTicks; i++) {
        if (!tick(s, autoPlayTick)) break;
        if (s.modeState.boss.id !== -1) return s;
    }
    return s;
}

/* ══════════════════════════════════════════════════════════════
 * 데이터 — 페이즈 구성이 설계 의도를 지키는가
 * ══════════════════════════════════════════════════════════════ */
describe("보스 데이터", () => {
    it("보스가 정의되어 있다", () => {
        expect(BOSS_DEFS.length).toBeGreaterThan(0);
    });

    it("모든 보스가 3페이즈다 (GDD §4.8)", () => {
        for (const b of BOSS_DEFS) {
            expect(b.boss.phases.length, b.id).toBe(3);
        }
    });

    it("1페이즈의 임계값은 1.0 이고, 이후는 단조 감소한다", () => {
        for (const b of BOSS_DEFS) {
            const ats = b.boss.phases.map((p) => p.at ?? 1);
            expect(ats[0], b.id).toBe(1);
            for (let i = 1; i < ats.length; i++) {
                expect(ats[i], `${b.id} 페이즈 ${i + 1}`).toBeLessThan(ats[i - 1]);
                expect(ats[i], `${b.id} 페이즈 ${i + 1}`).toBeGreaterThan(0);
            }
        }
    });

    it("★★ 인접 페이즈의 태그가 반드시 달라진다 — 같으면 페이즈가 연출일 뿐이다", () => {
        for (const b of BOSS_DEFS) {
            const ps = b.boss.phases;
            for (let i = 1; i < ps.length; i++) {
                const a = [...(ps[i - 1].tags ?? [])].sort().join(",");
                const c = [...(ps[i].tags ?? [])].sort().join(",");
                expect(c, `${b.id} 페이즈 ${i} → ${i + 1}`).not.toBe(a);
            }
        }
    });

    it("★★ 방어 태그가 페이즈마다 다른 데미지 타입을 요구한다", () => {
        // ARMORED 는 물리를 막고(DEF), WARDED 는 술식·신성을 막는다(RES).
        // 한 보스 안에서 두 방어 태그가 **모두** 등장해야 단일 딜러가 지배하지 못한다.
        for (const b of BOSS_DEFS) {
            const all = new Set(b.boss.phases.flatMap((p) => p.tags ?? []));
            expect(all.has("ARMORED"), `${b.id} 에 ARMORED 페이즈 없음`).toBe(true);
            expect(all.has("WARDED"), `${b.id} 에 WARDED 페이즈 없음`).toBe(true);
        }
    });

    it("ARMORED 와 WARDED 를 동시에 갖는 페이즈는 없다 — '아무것도 안 통하는 벽' 금지", () => {
        // 둘을 겹치면 물리는 DEF 에, 술식·신성은 RES 에 막혀 화면이 정지한다.
        // 편성 퍼즐이 아니라 그냥 진행 불가다.
        for (const b of BOSS_DEFS) {
            for (const p of b.boss.phases) {
                const t = p.tags ?? [];
                expect(
                    t.includes("ARMORED") && t.includes("WARDED"),
                    `${b.id} · ${p.name}`
                ).toBe(false);
            }
        }
    });

    it("★★ 태그와 실제 방어 수치가 일치한다 — 태그만 바뀌는 '가짜 페이즈' 금지", () => {
        // 상성을 만드는 것은 태그가 아니라 def(물리 감산) · res(술식/신성 % 감산) 다.
        // 배율로 두었다가 res 0 인 보스에 WARDED 를 붙여도 아무것도 안 바뀌는
        // 버그가 실제로 있었다. 여기가 그 재발 방지선이다.
        for (const b of BOSS_DEFS) {
            for (const p of b.boss.phases) {
                const t = p.tags ?? [];
                if (t.includes("ARMORED")) {
                    expect(p.def ?? 0, `${b.id}·${p.name} ARMORED 인데 def 가 낮다`).toBeGreaterThanOrEqual(20);
                    expect(p.res ?? 0, `${b.id}·${p.name} ARMORED 인데 res 도 높다`).toBeLessThan(25);
                }
                if (t.includes("WARDED")) {
                    expect(p.res ?? 0, `${b.id}·${p.name} WARDED 인데 res 가 낮다`).toBeGreaterThanOrEqual(40);
                    expect(p.def ?? 0, `${b.id}·${p.name} WARDED 인데 def 도 높다`).toBeLessThan(20);
                }
            }
        }
    });

    it("마지막 페이즈는 방어를 버린다 — 몰아칠 창구가 반드시 열린다", () => {
        for (const b of BOSS_DEFS) {
            const ps = b.boss.phases;
            const last = ps[ps.length - 1];
            const maxDef = Math.max(...ps.map((p) => p.def ?? 0));
            const maxRes = Math.max(...ps.map((p) => p.res ?? 0));
            expect(last.def ?? 0, `${b.id} 마지막 def`).toBeLessThan(maxDef);
            expect(last.res ?? 0, `${b.id} 마지막 res`).toBeLessThan(maxRes);
        }
    });

    it("예고 시간은 전역 상수 0.8초다 (19-art §4)", () => {
        expect(balance.modes.nemesis.phaseTelegraphMs).toBe(800);
        expect(balance.modes.nemesis.slamTelegraphMs).toBe(800);
    });

    it("★★ REGEN 은 방어 페이즈와 겹치지 않는다 — 겹치면 소프트락이다", () => {
        // 회복 중인 보스에 방어까지 붙으면 순DPS 가 회복량 아래로 떨어져
        // **어떤 편성으로도 죽지 않는다.** 실제로 3-20 이 그 상태였다
        // (400초 타임아웃, 보스 HP 100% 유지).
        for (const b of BOSS_DEFS) {
            for (const p of b.boss.phases) {
                if (!(p.tags ?? []).includes("REGEN")) continue;
                expect(p.res ?? 0, `${b.id}·${p.name} REGEN + 높은 res`).toBeLessThan(25);
            }
        }
    });

    it("★★ 보스 스테이지마다 보스가 다르다 — 같은 보스를 두 번 세우면 관문이 하나다 (P6-06)", () => {
        // 1-10 과 1-20 이 같은 giant_rhino_beetle 이었다. 월드 1 의 두 관문이
        // **완전히 같은 문제**를 냈다는 뜻이고, 그러면 보스 스테이지가 사실상 하나다.
        const seen = new Map();
        for (let i = 0; i < NEMESIS_STAGES.length; i++) {
            const bossId = DEPLOYED_BOSS_IDS[i];
            const id = NEMESIS_STAGES[i];
            expect(seen.has(bossId), `${bossId} 가 ${seen.get(bossId)} 와 ${id} 에 중복 배치`).toBe(false);
            seen.set(bossId, id);
        }
        expect(seen.size).toBe(NEMESIS_STAGES.length);
    });

    it("★ 배치된 보스는 전부 페이즈 데이터를 갖는다 — '그냥 큰 적'이 관문에 서지 않는다", () => {
        // 2-10 은 brawny_ogre(페이즈 없음), 3-10 은 grave_revenant(페이즈 없음) 였다.
        // 보스 모드인데 보스 시스템이 조용히 꺼진 채로 돌고 있었다.
        for (let i = 0; i < NEMESIS_STAGES.length; i++) {
            expect(DEPLOYED_BOSSES[i], `${NEMESIS_STAGES[i]} 의 ${DEPLOYED_BOSS_IDS[i]} 에 boss.phases 없음`).toBeTruthy();
        }
    });

    it("★★ 배치된 보스는 페이즈 태그 시퀀스가 서로 다르다 — 같으면 보스가 하나다 (P6-06)", () => {
        // 태그 전환이 '보스마다 다른 답'을 만드는 유일한 수단이다.
        // ARMORED→WARDED→무방비 를 6체가 똑같이 하면 첫 보스에서 배운 답이
        // 마지막 보스까지 그대로 통한다 — 그 순간 보스는 HP 만 다른 같은 적이 된다.
        //
        // ★ '배치된' 보스만 본다. 정의만 있고 어느 스테이지에도 서지 않는 보스는
        //   플레이어가 만나지 않으므로 중복이어도 경험을 해치지 않는다
        //   (humongous_ettin 이 정확히 giant_rhino_beetle 과 같은 시퀀스였고,
        //    그래서 P6-06 에서 배치를 내렸다).
        const seqs = new Map();
        for (const b of DEPLOYED_BOSSES) {
            const seq = b.boss.phases.map((p) => [...(p.tags ?? [])].sort().join("+")).join(" → ");
            expect(seqs.has(seq), `${b.id} 와 ${seqs.get(seq)} 의 페이즈 시퀀스가 완전히 같다`).toBe(false);
            seqs.set(seq, b.id);
        }
    });

    it("★ 보스가 쓰는 아틀라스 프레임 이름이 비어 있지 않다 — 전용 아트는 giant.scale 로 키우지 않는다", () => {
        // 100×250px 원본 보스 아트에 몬스터 16×16 용 배율(×4 × giant ×4)을 그대로
        // 곱하면 화면을 통째로 덮는다. 전용 아트는 art.scale 로만 조절한다.
        for (const b of BOSS_DEFS) {
            expect(b.art?.frame, `${b.id} art.frame`).toBeTruthy();
            if (b.art.atlas === "bosses") {
                expect(b.giant.scale, `${b.id} 전용 보스 아트인데 giant.scale ≠ 1`).toBe(1);
            }
        }
    });

    it("★★ 슬램 한 방은 지휘관을 죽이지 못한다 — 전 보스 · 전 페이즈 (P6-06)", () => {
        // ★ 배율(bossSlamCommanderMult)만으로는 이 규칙을 지킬 수 없다.
        //   지휘관 HP 는 고정인데 보스 ATK 는 스테이지 지수 커브를 탄다
        //   (실측: 1-10 보스 ATK 278 → 3-20 51,260). 그래서 **HP 비율 상한**이
        //   따로 있다. 여기가 그 상한이 실제로 걸리는지 보는 자리다.
        const ratio = balance.combat.bossSlamCommanderHpRatio;
        expect(ratio, "bossSlamCommanderHpRatio 없음").toBeGreaterThan(0);
        // 한 방에 죽지 않는 것으로는 부족하다 — 최소 3방은 버텨야 회피가 실력이 된다
        expect(ratio, "슬램 3방을 못 버틴다").toBeLessThanOrEqual(1 / 3);

        for (const id of NEMESIS_STAGES) {
            const cfg = buildStageConfig(id, SIX);
            const def = Object.values(cfg.enemyDefs).find((d) => d.boss);
            for (const p of def.boss.phases) {
                if (p.slamEveryMs <= 0) continue;
                const atk = Math.round(def.atk * p.atkMult);
                const raw = atk * p.slamDamageMult * cfg.combat.bossSlamCommanderMult;
                const dealt = Math.min(raw, cfg.commanderHp * ratio);
                expect(dealt, `${id} · ${p.name} 슬램이 지휘관을 즉사시킨다`).toBeLessThan(
                    cfg.commanderHp
                );
            }
        }
    });

    it("★ 거대화 보스의 REGEN 은 별도 비율을 쓴다 — 비율 규칙은 배율과 곱해지면 깨진다", () => {
        // 최대 HP 의 2% 는 400HP 잡몹(8/s)에는 맞지만 HP 배율 32 배 보스에서는
        // 192,748/s 가 된다. 거대화는 HP 배율이지 회복 배율이 아니다.
        expect(balance.combat.regenRatioGiant).toBeLessThan(balance.combat.regenRatio);
    });
});

/* ══════════════════════════════════════════════════════════════
 * 페이즈 전환
 * ══════════════════════════════════════════════════════════════ */
describe("페이즈 전환", () => {
    const stageId = NEMESIS_STAGES[0];

    it("보스가 등장하면 1페이즈로 시작한다", () => {
        const s = runUntilBoss(stageId, 3);
        const snap = bossSnapshot(s);
        expect(snap).not.toBeNull();
        expect(snap.phase).toBe(1);
        expect(snap.phaseTotal).toBe(3);
    });

    it("★★ HP 를 깎으면 태그가 실제로 바뀐다", () => {
        const s = runUntilBoss(stageId, 3);
        const bs = s.modeState.boss;
        const e = bs.e;
        expect(e).not.toBeNull();

        const tagsAtPhase = [maskToTags(e.tags)];

        // 페이즈를 강제로 넘긴다 — 임계값 바로 아래로 HP 를 내린다
        for (let target = 1; target < bs.phases.length; target++) {
            e.hp = e.hpMax * bs.phases[target].atRatio - 1;
            // 예고 + 전환이 끝날 때까지 돌린다
            for (let i = 0; i < 60 && bs.phaseIndex < target; i++) tick(s);
            expect(bs.phaseIndex, `페이즈 ${target + 1} 로 전환 실패`).toBe(target);
            tagsAtPhase.push(maskToTags(e.tags));
        }

        // 인접 페이즈끼리 태그가 다르다
        for (let i = 1; i < tagsAtPhase.length; i++) {
            expect(tagsAtPhase[i].join(",")).not.toBe(tagsAtPhase[i - 1].join(","));
        }
    });

    it("★ 전환 예고 동안 보스는 멈추고 때리지 않는다", () => {
        const s = runUntilBoss(stageId, 3);
        const bs = s.modeState.boss;
        const e = bs.e;

        e.hp = e.hpMax * bs.phases[1].atRatio - 1;
        tick(s); // 이 틱에 예고가 시작된다

        expect(bs.transitionTo).toBe(1);
        const until = bs.transitionAt;

        // 예고 중에는 속도 0, 공격 준비 시각이 전환 시점 뒤로 밀려 있다
        while (s.t < until && s.phase === "battle") {
            expect(e.speed).toBe(0);
            expect(e.atkReadyAt).toBeGreaterThanOrEqual(until);
            tick(s);
        }
        expect(bs.phaseIndex).toBe(1);
        expect(e.speed).toBeGreaterThan(0);
    });

    it("예고 길이가 정확히 phaseTelegraphMs 다", () => {
        const s = runUntilBoss(stageId, 3);
        const bs = s.modeState.boss;
        const e = bs.e;

        e.hp = e.hpMax * bs.phases[1].atRatio - 1;
        const before = s.t;
        tick(s);
        // s.t 는 TICK_MS(=1000/30) 누적이라 부동소수 오차가 낀다
        expect(bs.transitionAt - before).toBeCloseTo(
            s.cfg.modeParams.phaseTelegraphMs + TICK_MS,
            6
        );
    });

    it("★ 한 방에 두 임계값을 뚫으면 최종 페이즈로 한 번에 간다 — 예고가 쌓이지 않는다", () => {
        const s = runUntilBoss(stageId, 3);
        const bs = s.modeState.boss;
        const e = bs.e;

        /**
         * ★ **마지막 임계값 바로 아래**로 둔다 — 죽지 않을 만큼은 남긴다.
         *
         *   예전에는 `e.hp = 1` 이었다. 그러면 다음 한 대에 보스가 **죽어서**
         *   예고 중인 전환이 취소되는데, 그 타이밍이 전투 전개에 달려 있어
         *   피해가 조금만 흔들려도 결과가 뒤집힌다 (크리티컬 구현 때 실제로 뒤집혔다).
         *   이 검사가 재려는 것은 "두 임계값을 한 번에 넘는가"이지 죽음 경합이 아니다.
         */
        e.hp = e.hpMax * bs.phases[2].atRatio - 1;
        tick(s);
        expect(bs.transitionTo).toBe(2);

        for (let i = 0; i < 60 && bs.phaseIndex < 2; i++) tick(s);
        expect(bs.phaseIndex).toBe(2);
    });

    it("페이즈가 뒤로 돌아가지 않는다 — 힐/재생으로 HP 가 올라가도", () => {
        const s = runUntilBoss(stageId, 3);
        const bs = s.modeState.boss;
        const e = bs.e;

        e.hp = e.hpMax * bs.phases[2].atRatio - 1;
        for (let i = 0; i < 80 && bs.phaseIndex < 2; i++) tick(s);
        expect(bs.phaseIndex).toBe(2);

        e.hp = e.hpMax; // 완전 회복
        for (let i = 0; i < 30; i++) tick(s);
        expect(bs.phaseIndex).toBe(2);
    });

    it("전환 시 스탯이 원본 기준으로 계산된다 — 배율이 누적되지 않는다", () => {
        const s = runUntilBoss(stageId, 3);
        const bs = s.modeState.boss;
        const e = bs.e;
        const base = { ...bs.base };

        for (let target = 1; target < bs.phases.length; target++) {
            e.hp = e.hpMax * bs.phases[target].atRatio - 1;
            for (let i = 0; i < 60 && bs.phaseIndex < target; i++) tick(s);
            const p = bs.phases[target];
            expect(e.atk).toBe(Math.round(base.atk * p.atkMult));
            expect(e.def).toBe(p.def ?? base.def);
            expect(e.res).toBe(p.res ?? base.res);
            expect(e.speed).toBe(Math.round(base.speed * p.speedMult));
        }
    });
});

/* ══════════════════════════════════════════════════════════════
 * 상성 — 페이즈가 정말 다른 답을 요구하는가
 * ══════════════════════════════════════════════════════════════ */
describe("페이즈별 상성", () => {
    /** 같은 공격력의 물리/술식 딜러가 각 페이즈에 넣는 피해 */
    function damageBy(dmgType, boss, cfgCombat) {
        const attacker = { atk: 100, dmgType, tags: 0, isAlly: true };
        return computeDamage(attacker, boss, cfgCombat, 1).amount;
    }

    it("★★ ARMORED 페이즈에서는 술식이, WARDED 페이즈에서는 물리가 낫다", () => {
        const cfg = buildStageConfig(NEMESIS_STAGES[0], SIX);
        const bossDef = Object.values(cfg.enemyDefs).find((d) => d.boss);
        expect(bossDef).toBeTruthy();

        for (const p of bossDef.boss.phases) {
            const boss = {
                hp: 1e9,
                hpMax: 1e9,
                def: p.def ?? bossDef.def,
                res: p.res ?? bossDef.res,
                tags: p.tagMask,
                shield: 0,
            };
            const phys = damageBy("physical", boss, cfg.combat);
            const arc = damageBy("arcane", boss, cfg.combat);

            if (p.tagMask & TAG.ARMORED) {
                expect(arc, "ARMORED 페이즈에서 술식이 물리보다 낫지 않다").toBeGreaterThan(phys);
            }
            if (p.tagMask & TAG.WARDED) {
                expect(phys, "WARDED 페이즈에서 물리가 술식보다 낫지 않다").toBeGreaterThan(arc);
            }
        }
    });
});

/* ══════════════════════════════════════════════════════════════
 * 슬램 — 예고 · 착탄 · 회피
 * ══════════════════════════════════════════════════════════════ */
describe("슬램", () => {
    const stageId = NEMESIS_STAGES[1] ?? NEMESIS_STAGES[0];

    /**
     * 슬램이 있는 페이즈로 강제 진입시킨다.
     *
     * ★ 보스가 등장하는 시점(2분대)에는 방주가 이미 얇다. 붙잡아 두지 않으면
     *   슬램 주기(6~10초)가 오기 전에 전투가 패배로 끝나서 슬램을 한 번도
     *   못 본다 — 실제로 그래서 테스트가 통째로 헛돌았다.
     *   여기서 보는 것은 슬램 메커니즘이지 스테이지 난이도가 아니다.
     */
    function toSlamPhase(s) {
        const bs = s.modeState.boss;
        const e = bs.e;
        const idx = bs.phases.findIndex((p) => p.slamEveryMs > 0);
        if (idx < 0) return -1;
        if (idx > 0) {
            e.hp = e.hpMax * bs.phases[idx].atRatio - 1;
            for (let i = 0; i < 200 && bs.phaseIndex < idx; i++) tick(s);
        }
        return bs.phaseIndex;
    }

    /** 보스·방주를 살려 둔 채 조건이 만족될 때까지 돌린다 */
    function pump(s, maxTicks, done) {
        const bs = s.modeState.boss;
        for (let i = 0; i < maxTicks; i++) {
            if (done()) return true;
            const e = bs.e;
            if (e) e.hp = Math.max(e.hp, e.hpMax * 0.32);
            s.arkHp = s.arkHpMax;
            if (!tick(s)) break;
        }
        return done();
    }

    it("착탄 전에 반드시 예고가 나간다", () => {
        const s = runUntilBoss(stageId, 5);
        expect(toSlamPhase(s)).toBeGreaterThanOrEqual(0);

        let telegraphAt = -1;
        let slamAt = -1;
        pump(s, 3000, () => {
            for (let k = 0; k < s.events.length; k++) {
                const ev = s.events.pool[k];
                if (ev.type === EV.MODE_BOSS_TELEGRAPH && telegraphAt < 0) telegraphAt = s.t;
                if (ev.type === EV.MODE_BOSS_SLAM && slamAt < 0) slamAt = s.t;
            }
            return slamAt > 0;
        });

        expect(telegraphAt, "예고가 나가지 않았다").toBeGreaterThan(0);
        expect(slamAt, "착탄이 없었다").toBeGreaterThan(0);
        expect(slamAt).toBeGreaterThan(telegraphAt);
        // 정확히 0.8초 (틱 경계 오차 1틱 허용)
        expect(slamAt - telegraphAt).toBeCloseTo(s.cfg.modeParams.slamTelegraphMs, 0);
    });

    it("★ 예고는 지휘관 레인을 노린다 — 그래서 회피가 실력이 된다", () => {
        const s = runUntilBoss(stageId, 5);
        const bs = s.modeState.boss;
        expect(toSlamPhase(s)).toBeGreaterThanOrEqual(0);

        s.commander.hp = s.commander.hpMax;
        s.commander.lane = 2;

        const ok = pump(s, 3000, () => {
            // 지휘관을 보스 옆에 계속 붙여 둔다
            if (bs.e) {
                s.commander.x = bs.e.x - 20;
                s.commander.targetX = s.commander.x;
            }
            return bs.slamPending;
        });
        expect(ok, "슬램 예고가 나오지 않았다").toBe(true);
        expect(bs.slamLane).toBe(2);
    });

    it("★ 지휘관이 사거리 밖이면 다른 레인을 노린다 — 뒤로 빼는 것이 공짜가 아니다", () => {
        const s = runUntilBoss(stageId, 5);
        const bs = s.modeState.boss;
        expect(toSlamPhase(s)).toBeGreaterThanOrEqual(0);

        s.commander.hp = s.commander.hpMax;
        s.commander.lane = 2;

        const ok = pump(s, 3000, () => {
            s.commander.x = s.cfg.arkX; // 방주 뒤로 완전히 뺀다
            s.commander.targetX = s.commander.x;
            return bs.slamPending;
        });
        expect(ok, "슬램 예고가 나오지 않았다").toBe(true);
        // 지휘관이 멀면 아군이 가장 많은 레인을 노린다
        const counts = s.lanes.map((l) => l.allies.length);
        expect(counts[bs.slamLane]).toBe(Math.max(...counts));
    });

    it("★ 예고 지점에 서 있으면 지휘관이 피해를 입는다 — 다만 한 방에 죽지는 않는다", () => {
        const s = runUntilBoss(stageId, 5);
        const bs = s.modeState.boss;
        expect(toSlamPhase(s)).toBeGreaterThanOrEqual(0);

        s.commander.hp = s.commander.hpMax;
        s.commander.lane = 2;

        // 예고가 뜰 때까지 붙어 있는다
        expect(
            pump(s, 3000, () => {
                if (bs.e) {
                    s.commander.x = bs.e.x - 20;
                    s.commander.targetX = s.commander.x;
                }
                return bs.slamPending;
            })
        ).toBe(true);

        const before = s.commander.hp;

        // ★ 예고를 무시하고 그대로 서 있으면 맞는다
        expect(
            pump(s, 200, () => {
                s.commander.x = bs.slamX;
                s.commander.lane = bs.slamLane;
                return s.commander.hp < before;
            }),
            "예고 지점에 서 있었는데 피해가 없다"
        ).toBe(true);

        // ★★ 한 방에 기절하지는 않는다.
        //   즉사로 두었더니 **자동 조작 플레이어가 매 슬램마다 기절**해
        //   오라가 7~10초마다 사라지고 보스 스테이지 승률이 무너졌다.
        //   회피는 '잘하면 이득'이어야지 '못하면 파탄'이면 안 된다.
        expect(s.commander.hp, "슬램 한 방에 지휘관이 즉사한다").toBeGreaterThan(0);
    });

    it("전환 예고 중에는 슬램하지 않는다 — 두 예고가 겹치면 읽을 수 없다", () => {
        const s = runUntilBoss(stageId, 5);
        const bs = s.modeState.boss;
        const e = bs.e;

        e.hp = e.hpMax * bs.phases[1].atRatio - 1;
        tick(s);
        expect(bs.transitionTo).toBe(1);

        while (bs.transitionTo >= 0 && s.phase === "battle") {
            expect(bs.slamPending).toBe(false);
            tick(s);
        }
    });
});

/* ══════════════════════════════════════════════════════════════
 * B1 결정론 — 하드 게이트
 * ══════════════════════════════════════════════════════════════ */
describe("B1 결정론 (보스)", () => {
    function summary(stageId, seed) {
        const s = createSim(buildStageConfig(stageId, SIX), seed);
        runToCompletion(s, (st) => autoPlayTick(st), 400);
        return JSON.stringify({
            phase: s.phase,
            t: s.t,
            arkHp: s.arkHp,
            kills: s.stats.kills,
            bossPhase: s.modeState.boss.phaseIndex,
            bossDead: s.modeState.bossDead,
        });
    }

    // ★ 보스 스테이지 전체를 **2회씩** 완주시켜 비교한다. 아래 '반드시 종료된다'와
    //   같은 이유로 기본 5초 예산을 넘는다 — 특히 방벽 스티키 수정(2026-08-04) 이후
    //   적이 제대로 붙들려 전투가 길어졌다. 느려진 것이지 깨진 것이 아니다.
    it("동일 시드는 보스 페이즈까지 완전히 동일하다", () => {
        for (const id of NEMESIS_STAGES) {
            expect(summary(id, 7), id).toBe(summary(id, 7));
        }
    }, 30000);

    // 6스테이지 × 3시드 = 18전투(최대 400초 시뮬)라 기본 5초 타임아웃 경계에 걸린다.
    it("보스전이 반드시 종료된다 — 무한 루프 없음", () => {
        for (const id of NEMESIS_STAGES) {
            for (const seed of [1, 2, 3]) {
                const s = createSim(buildStageConfig(id, SIX), seed);
                runToCompletion(s, (st) => autoPlayTick(st), 400);
                expect(["victory", "defeat"], `${id} seed ${seed}`).toContain(s.phase);
            }
        }
    }, 30000);

    it("★★ 보스가 방주에 닿으면 패배다 — 강한 보스가 오히려 쉬워지면 안 된다 (P6-06)", () => {
        // stepBreach 는 방주에 닿은 적을 필드에서 지운다. 보스에게도 그대로 적용되므로
        // 예전에는 필드가 비고 "전 웨이브 격퇴 = 승리"가 발동해 **보스를 못 잡았는데
        // 승리**가 떴다. 보스를 강하게 만들수록 승률이 올라가는 역전이 실제로 났다
        // (P6-06 튜닝 중 6개 보스 스테이지가 20/20 '방주 도달 승리').
        const s = runUntilBoss(NEMESIS_STAGES[0], 3);
        expect(s.modeState.boss.id, "보스가 등장하지 않았다").not.toBe(-1);

        // 보스를 방주 앞으로 순간이동시킨다 (전선을 뚫고 걸어간 상황의 최소 재현)
        const e = s.modeState.boss.e;
        e.hp = e.hpMax;
        e.x = s.cfg.arkX;
        s.arkHp = s.arkHpMax;
        for (let i = 0; i < 10 && s.phase === "battle"; i++) step(s);

        expect(s.modeState.bossBreached, "보스 돌파가 기록되지 않았다").toBe(true);
        expect(s.modeState.bossDead).toBe(false);
        expect(s.phase, "보스를 놓쳤는데 승리가 떴다").toBe("defeat");
    });

    it("보스전 승리는 반드시 보스 처치를 뜻한다", () => {
        for (const id of NEMESIS_STAGES) {
            for (const seed of [4, 9]) {
                const s = createSim(buildStageConfig(id, SIX), seed);
                runToCompletion(s, (st) => autoPlayTick(st), 400);
                if (s.phase === "victory") {
                    expect(s.modeState.bossDead, `${id} seed ${seed}`).toBe(true);
                }
            }
        }
    }, 30000);

    it("보스가 죽으면 참조가 끊긴다 — 풀 재사용 슬롯을 보스로 오인하지 않는다", () => {
        for (const id of NEMESIS_STAGES) {
            const s = createSim(buildStageConfig(id, SIX), 4);
            runToCompletion(s, (st) => autoPlayTick(st), 400);
            if (s.modeState.bossDead) {
                expect(s.modeState.boss.e, id).toBeNull();
                expect(bossSnapshot(s), id).toBeNull();
            }
        }
    });
});
