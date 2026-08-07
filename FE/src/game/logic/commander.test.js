/**
 * 지휘관 성장 — **"올렸는데 전투가 모른다"를 막는 그물** (2026-08-05)
 *
 * ★★ 이 파일이 지키는 명제는 하나다: **화면에서 오른 것이 전투에서도 오른다.**
 *   성소 시설이 정확히 그 명제를 어기고 있었다 — `meta.json` 이 `hpPerLevel` 을
 *   정의하고 화면이 25레벨까지 골드를 받았는데, 그 값을 읽는 코드가 없었다.
 *   여기서 검사하는 것은 "함수가 숫자를 돌려주는가"가 아니라
 *   **그 숫자가 `buildStageConfig` 를 지나 전투 설정에 도착하는가**다.
 */
import { describe, it, expect } from "vitest";
import {
    COMMANDER_ITEMS,
    COMMANDER_ITEM_BY_ID,
    COMMANDER_MAX_LEVEL,
    commanderEffects,
    commanderItemsForStage,
    commanderLevelCost,
    commanderLevelPlan,
    itemsOfSlot,
} from "./commander.js";
import { FACILITIES, unitLevelCap } from "./progression.js";
import { buildStageConfig } from "./stageConfig.js";
import { createSim, step } from "./sim.js";
import balance from "../data/balance.json" with { type: "json" };
import stagesData from "../data/stages.json" with { type: "json" };
import commanderData from "../data/commander.json" with { type: "json" };

const SLOT = [{ id: "slow_turtle", level: 10 }, { id: "elf_sharpshooter", level: 10 }];

describe("지휘관 레벨", () => {
    it("1레벨은 보정이 0 이다 — 하네스가 재는 곡선을 흔들지 않는다", () => {
        const e = commanderEffects({ level: 1, sanctum: 0 });
        for (const [k, v] of Object.entries(e)) expect(v, k).toBe(0);
    });

    it("레벨이 오르면 공격력·체력·균열력 재생이 함께 오른다", () => {
        const a = commanderEffects({ level: 1 });
        const b = commanderEffects({ level: 10 });
        expect(b.commanderAtkPct).toBeGreaterThan(a.commanderAtkPct);
        expect(b.commanderHpPct).toBeGreaterThan(a.commanderHpPct);
        expect(b.riftRegenPct).toBeGreaterThan(a.riftRegenPct);
    });

    /**
     * ★★★ **"오르기는 한다"로는 부족하다** (2026-08-05, 사용자 제보).
     *
     *   위 테스트는 단조성만 본다 — 그래서 덧셈 0.04/레벨이 **만렙에서도 ×2.16**
     *   이라는 사실을 4개월 동안 아무도 잡지 못했다. 같은 캠페인에서 동료는
     *   레벨로 ×200 넘게 자라므로, 지휘관은 진행할수록 **없는 것과 같아졌다.**
     *   약하게 설계된 것이 아니라 **함께 자라지 않은** 것이다.
     *
     * ★ 그래서 여기서 재는 것은 **배율의 크기**다. 임계는 데이터에서 파생시킨다 —
     *   숫자를 박으면 커브를 튜닝한 날 이 테스트가 거짓말을 시작한다.
     */
    it("★★★ 만렙 지휘관의 공격력 배율이 한 자릿수에 머물지 않는다", () => {
        const max = commanderData.level.max;
        const top = commanderEffects({ level: max });
        const mult = 1 + top.commanderAtkPct;

        /**
         * 기준선: **동료가 방주 훈련장을 절반까지 키웠을 때의 레벨 상한**에서
         * 레벨만으로 갖는 배율. 손으로 고른 숫자가 아니라 두 데이터(훈련장 상한 ·
         * `unitAtkGrowth`)에서 파생하므로, 성장 곡선을 튜닝하면 기준도 따라온다.
         */
        const yard = FACILITIES.find((f) => f.id === "trainingYard");
        const refCap = unitLevelCap(Math.floor(yard.maxLevel / 2));
        const allyMult = Math.pow(balance.progression.unitAtkGrowth, refCap - 1);

        expect(
            mult,
            `만렙 지휘관 ×${mult.toFixed(1)} — 같은 시점의 동료 한 기가 ×${allyMult.toFixed(1)} 다. ` +
                `이보다 낮으면 지휘관은 진행할수록 없는 것과 같아진다 (덧셈 시절이 ×2.2 였다)`
        ).toBeGreaterThanOrEqual(allyMult);

        // 그렇다고 캐리는 아니다 — 미끼라는 설계(20-commander-combat.md §2.1)를 넘지 않는다
        expect(
            mult,
            `지휘관 ×${mult.toFixed(1)} 이 동료 한 기의 두 배를 넘었다 — ` +
                `딜 캐리가 되면 '오라를 어디에 둘 것인가'라는 실력 천장이 사라진다`
        ).toBeLessThan(allyMult * 2);
    });

    it("비용은 레벨마다 오른다 (같은 골드로 무한히 올릴 수 없다)", () => {
        expect(commanderLevelCost(10)).toBeGreaterThan(commanderLevelCost(1));
    });

    it("계획은 상한과 잔액에서 멈춘다", () => {
        const rich = commanderLevelPlan(1, 10_000_000, 5);
        expect(rich.steps).toBe(5);
        expect(rich.to).toBe(6);

        const broke = commanderLevelPlan(1, 0, 5);
        expect(broke.steps).toBe(0);
        expect(broke.cost).toBe(0);

        const capped = commanderLevelPlan(COMMANDER_MAX_LEVEL, 10_000_000, 5);
        expect(capped.steps).toBe(0);
    });
});

describe("지휘관 장구", () => {
    it("모든 장구가 실재하는 스테이지에서 확정 지급된다", () => {
        const ids = new Set(stagesData.stages.map((s) => s.id));
        for (const it of COMMANDER_ITEMS) {
            expect(ids.has(it.stage), `${it.id} 의 지급 스테이지 ${it.stage}`).toBe(true);
            expect(commanderItemsForStage(it.stage)).toContain(it.id);
        }
    });

    it("슬롯마다 두 개 이상이다 — 하나뿐이면 고를 것이 없다", () => {
        for (const slot of commanderData.slots) {
            expect(itemsOfSlot(slot.id).length, slot.id).toBeGreaterThan(1);
        }
    });

    it("★ 슬롯이 맞지 않는 장구는 무시된다 (손상된 세이브가 전투 규칙을 바꾸지 못한다)", () => {
        const weapon = itemsOfSlot("weapon")[0];
        const wrong = commanderEffects({ level: 1, equipped: { armor: weapon.id } });
        expect(wrong.commanderAtkPct).toBe(0);
    });

    it("장착한 장구의 효과가 실제로 합산된다", () => {
        const item = COMMANDER_ITEM_BY_ID.worn_saber;
        const e = commanderEffects({ level: 1, equipped: { weapon: item.id } });
        expect(e.commanderAtkPct).toBeCloseTo(item.effect.commanderAtkPct, 5);
    });
});

describe("성소 (방주 시설)", () => {
    it("★★ 성소 레벨이 오라 반경과 지휘관 체력을 올린다 — 예전에는 읽는 코드가 없었다", () => {
        const none = commanderEffects({ level: 1, sanctum: 0 });
        const built = commanderEffects({ level: 1, sanctum: 10 });
        expect(none.auraRadiusFlat).toBe(0);
        expect(built.auraRadiusFlat).toBeGreaterThan(0);
        expect(built.commanderHpPct).toBeGreaterThan(0);
    });

    it("오라 반경은 데이터의 상한을 넘지 않는다 (가이드가 약속한 값이다)", () => {
        const e = commanderEffects({ level: COMMANDER_MAX_LEVEL, sanctum: 9999 });
        const cmd = balance.commander;
        expect(cmd.auraRadius + e.auraRadiusFlat).toBeLessThanOrEqual(cmd.auraRadiusMax);
    });
});

describe("★★ 성장이 전투 설정까지 도착한다", () => {
    const base = buildStageConfig("1-5", SLOT, {});

    it("보정이 없으면 예전과 완전히 같은 값이다", () => {
        const cmd = balance.commander;
        expect(base.commanderHp).toBe(cmd.hp);
        expect(base.auraRadius).toBe(cmd.auraRadius);
        expect(base.commanderAttack.damage).toBe(cmd.attack.damage);
        expect(base.commanderAttack.intervalMs).toBe(cmd.attack.intervalMs);
        expect(base.spellPowerMult).toBe(1);
    });

    it("레벨·장구·성소가 전투 설정을 실제로 민다", () => {
        const meta = commanderEffects({
            level: 20,
            equipped: { weapon: "swift_baton", armor: "ward_plate", relic: "commanders_seal" },
            sanctum: 10,
        });
        const cfg = buildStageConfig("1-5", SLOT, { meta });

        expect(cfg.commanderHp, "체력").toBeGreaterThan(base.commanderHp);
        expect(cfg.auraRadius, "오라 반경").toBeGreaterThan(base.auraRadius);
        expect(cfg.commanderAttack.damage, "평타 공격력").toBeGreaterThan(
            base.commanderAttack.damage
        );
        expect(cfg.commanderAttack.intervalMs, "평타 간격(짧을수록 빠르다)").toBeLessThan(
            base.commanderAttack.intervalMs
        );
        expect(cfg.riftRegenBase, "균열력 재생").toBeGreaterThan(base.riftRegenBase);
        expect(cfg.spellPowerMult, "주문 위력").toBeGreaterThan(1);
    });

    it("★ 평타 사거리는 성장하지 않는다 — 오라보다 짧다는 부등식이 설계 심장이다", () => {
        const meta = commanderEffects({
            level: COMMANDER_MAX_LEVEL,
            equipped: { weapon: "sanction_spear", armor: "bulwark_regalia", relic: "deep_well" },
            sanctum: 25,
        });
        const cfg = buildStageConfig("1-5", SLOT, { meta });
        expect(cfg.commanderAttack.range).toBe(balance.commander.attack.range);
        expect(cfg.commanderAttack.range).toBeLessThan(cfg.auraRadius);
    });

    it("성장을 얹어도 결정론이 유지된다 (B1)", () => {
        const meta = commanderEffects({ level: 15, sanctum: 5 });
        const run = () => {
            const s = createSim(buildStageConfig("1-5", SLOT, { meta }), 7);
            for (let i = 0; i < 300; i++) step(s);
            return `${s.t}|${s.arkHp}|${s.stats?.kills ?? 0}`;
        };
        expect(run()).toBe(run());
    });
});
