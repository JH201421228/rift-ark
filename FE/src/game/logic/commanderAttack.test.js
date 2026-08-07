/**
 * 지휘관 평타 검증
 *
 * ★★ 여기서 지키는 것은 "평타가 센가"가 아니라 **평타가 게임을 망가뜨리지 않는가**다.
 *
 *   평타는 딜 수단이 아니라 미끼로 설계됐다 (20-commander-combat.md).
 *   그 설계는 아래 넷이 동시에 참일 때만 성립한다. 하나라도 깨지면
 *   "지휘관을 앞에 세워두면 끝"이라는 단일 최적해가 돌아온다:
 *
 *     ① 사거리 < 오라 반경        — 평타를 넣으려면 대가를 치러야 한다
 *     ② 공중을 때리지 않는다      — 대공 편성이 선택으로 남는다
 *     ③ 기절 중에는 안 때린다     — 기절이 오라 상실만의 페널티가 아니다
 *     ④ 결정론                    — 같은 시드는 같은 결과 (절대규칙 1)
 *
 * ★ 난이도·승률은 밸런스 하네스(balance-check)가 본다. 여기서 보지 않는다.
 */
import { describe, it, expect } from "vitest";
import { createSim, step } from "./sim.js";
import { buildStageConfig } from "./stageConfig.js";
import { stepCommanderAttack } from "./commanderAttack.js";
import { AIR_LANE } from "./state.js";
import { EV } from "./events.js";
import { TICK_MS } from "./tick.js";
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

function sim(stageId = "1-1", seed = 7) {
    return createSim(buildStageConfig(stageId, SIX, { meta: {} }), seed);
}

/** 지정 레인/좌표에 시험용 적을 하나 세운다 (실제 스폰 경로를 타지 않는 최소 더미) */
function putEnemy(s, lane, x, hp = 9999) {
    const e = {
        id: 90000 + lane,
        isAlly: false,
        lane,
        x,
        hp,
        hpMax: hp,
        atk: 0,
        def: 0,
        res: 0,
        shield: 0,
        tags: 0,
        dmgType: "physical",
    };
    s.lanes[lane].enemies.push(e);
    s.actives.push(e);
    return e;
}

describe("지휘관 평타 — 설계 불변식", () => {
    it("★★★ 사거리가 오라 반경보다 짧다 — 이 부등식이 설계 전부다", () => {
        const a = balance.commander.attack;
        expect(a, "balance.json 에 commander.attack 이 없다").toBeTruthy();
        expect(
            a.range,
            `평타 사거리(${a.range})가 오라 반경(${balance.commander.auraRadius}) 이상이면 ` +
                `앞에 세워두는 것이 공짜가 된다`
        ).toBeLessThan(balance.commander.auraRadius);
    });

    it("★ 피해 타입은 물리다 — 술식/신성이면 지휘관이 상성 스테이지를 혼자 푼다", () => {
        expect(balance.commander.attack.dmgType).toBe("physical");
    });

    it("사거리 안의 적을 때린다", () => {
        const s = sim();
        const c = s.commander;
        const before = putEnemy(s, c.lane, c.x + balance.commander.attack.range - 10).hp;
        stepCommanderAttack(s);
        expect(s.lanes[c.lane].enemies[0].hp).toBeLessThan(before);
    });

    it("사거리 밖의 적은 때리지 않는다", () => {
        const s = sim();
        const c = s.commander;
        const e = putEnemy(s, c.lane, c.x + balance.commander.attack.range + 40);
        stepCommanderAttack(s);
        expect(e.hp).toBe(e.hpMax);
    });

    it("★ 다른 레인의 적은 때리지 않는다", () => {
        const s = sim();
        const c = s.commander;
        const other = c.lane === 0 ? 1 : 0;
        const e = putEnemy(s, other, c.x + 20);
        stepCommanderAttack(s);
        expect(e.hp).toBe(e.hpMax);
    });

    it("★★ 공중은 때리지 않는다 — 대공 편성이 선택으로 남아야 한다", () => {
        const s = sim();
        const c = s.commander;
        const e = putEnemy(s, AIR_LANE, c.x + 20);
        stepCommanderAttack(s);
        expect(e.hp).toBe(e.hpMax);
    });

    it("★★ 기절 중에는 때리지 않는다", () => {
        const s = sim();
        const c = s.commander;
        const e = putEnemy(s, c.lane, c.x + 20);
        c.hp = 0;
        c.downUntil = s.t + 8000;
        stepCommanderAttack(s);
        expect(e.hp).toBe(e.hpMax);
    });

    it("쿨다운을 지킨다 — 한 틱에 두 번 때리지 않는다", () => {
        const s = sim();
        const c = s.commander;
        const e = putEnemy(s, c.lane, c.x + 20);
        stepCommanderAttack(s);
        const afterFirst = e.hp;
        stepCommanderAttack(s); // 같은 시각 — 아직 쿨다운
        expect(e.hp).toBe(afterFirst);

        s.t += balance.commander.attack.intervalMs;
        stepCommanderAttack(s);
        expect(e.hp).toBeLessThan(afterFirst);
    });

    it("★ 방주에 가장 가까운 적을 노린다 (결정론적 조준)", () => {
        const s = sim();
        const c = s.commander;
        const far = putEnemy(s, c.lane, c.x + 100);
        const near = putEnemy(s, c.lane, c.x + 20);
        stepCommanderAttack(s);
        expect(near.hp).toBeLessThan(near.hpMax);
        expect(far.hp).toBe(far.hpMax);
    });

    it("COMMANDER_ATTACK 이벤트를 낸다 — 연출이 붙을 수 있어야 한다", () => {
        const s = sim();
        const c = s.commander;
        putEnemy(s, c.lane, c.x + 20);
        stepCommanderAttack(s);
        // ★ 큐는 풀 기반이라 0..length-1 만 유효하다 (events.js §"렌더가 소비할 때")
        let found = false;
        for (let i = 0; i < s.events.length; i++) {
            if (s.events.pool[i].type === EV.COMMANDER_ATTACK) found = true;
        }
        expect(found).toBe(true);
    });

    it("★★ 결정론 — 같은 시드는 같은 결과 (절대규칙 1)", () => {
        const run = () => {
            const s = sim("1-3", 42);
            for (let i = 0; i < 600 && s.phase === "battle"; i++) step(s);
            return { phase: s.phase, arkHp: s.arkHp, t: s.t, kills: s.stats.kills };
        };
        expect(run()).toEqual(run());
    });

    it("평타가 tick 예산을 넘기지 않는다 — 배열 생성 없이 한 번만 훑는다", () => {
        const s = sim();
        const c = s.commander;
        for (let i = 0; i < 40; i++) putEnemy(s, c.lane, c.x + i * 5);
        // 호출이 예외 없이 끝나고 대상이 정확히 하나만 맞는지
        stepCommanderAttack(s);
        const hurt = s.lanes[c.lane].enemies.filter((e) => e.hp < e.hpMax);
        expect(hurt).toHaveLength(1);
        expect(hurt[0].x).toBe(c.x); // 가장 가까운(=x 최소) 적
    });
});

describe("지휘관 평타 — 시뮬 통합", () => {
    it("전투를 돌려도 평타가 예외를 내지 않는다", () => {
        const s = sim("1-1", 3);
        for (let i = 0; i < 2000 && (s.phase === "battle" || s.phase === "draft"); i++) {
            if (s.phase === "draft") break;
            step(s);
        }
        expect(["battle", "draft", "victory", "defeat"]).toContain(s.phase);
        expect(Number.isFinite(s.t)).toBe(true);
        expect(s.t).toBeGreaterThan(TICK_MS);
    });
});
