/**
 * 비행 아군 — **발사체를 쏘는가, 아니면 즉발로 때리는가** (2026-08-05)
 *
 * ★★★ 적 11종을 고친 그 결함이 **아군 쪽에 그대로 남아 있었다.**
 *
 *   2026-08-05 오전에 `PROJECTILE_ROLES` 를 `engage.js` 의 private const 에서
 *   `roles.js` 로 꺼내 아군·적이 같은 값을 보게 만들었다. 그런데 목록 자체는
 *   `RANGED · CASTER · SIEGE` 그대로였고, 아군 비행 4종(사거리 160–200)은
 *   **화면을 가로질러 즉발로** 때리고 있었다 — 적 원거리와 정확히 같은 그림이다.
 *   검사기가 못 잡은 이유도 같다: 사거리 ↔ 역할 대조가 **적만** 돌고 있었다.
 *
 * ★ 여기서 재는 것은 "비행이 센가"가 아니라 **규칙이 지켜지는가**다:
 *   ① 비행 아군의 공격은 **그 틱에 도착하지 않는다** (이동 시간이 있다)
 *   ② 오라 안 강하 타격(`strikeGround`)도 같은 규약을 따른다
 *   ③ SUPPORT 는 여전히 발사체가 아니다 (대조군 — 사거리 190–235 를 싹 쓸어
 *      발사체로 만들어 버리지 않았는가. 지원은 피해가 아니라 힐이다)
 *
 * ★ 사거리 ↔ 역할의 **데이터** 대조는 `tools/validate-data.mjs` 의 발사체 절이 한다.
 *   같은 명제를 두 곳에서 검사하면 두 임계값이 갈라진다 — 이 저장소의 단일 실패 유형이다.
 */
import { describe, it, expect } from "vitest";
import { createSim } from "./sim.js";
import { buildStageConfig, UNIT_DEFS } from "./stageConfig.js";
import { spawnEnemy, trySummon } from "./spawn.js";
import { stepCombat } from "./engage.js";
import { stepProjectiles } from "./projectiles.js";
import { usesProjectile, ROLE_ORDER } from "./roles.js";
import { AIR_LANE } from "./state.js";
import unitsData from "../data/units.json" with { type: "json" };

/** 공중 적(swooping_bat)이 나오는 판 */
const STAGE = "1-6";

const SIX = [
    { id: "slow_turtle", level: 1 },
    { id: "bold_man_at_arms", level: 1 },
    { id: "determined_soldier", level: 1 },
    { id: "elf_sharpshooter", level: 1 },
    { id: "magical_fairy", level: 1 },
    { id: "jovial_friar", level: 1 },
];

function sim() {
    const s = createSim(buildStageConfig(STAGE, SIX, { meta: {} }), 1);
    s.mana = 9999; // 이 테스트가 재는 것은 자원이 아니라 타격 방식이다
    return s;
}

/** 동료 하나를 실제 소환 경로로 올린 뒤 x 를 맞춘다 */
function putAlly(s, id, x, lane = 0) {
    const before = s.actives.length;
    expect(trySummon(s, UNIT_DEFS[id], lane), `${id} 소환 실패`).toBe(true);
    const u = s.actives[before];
    u.x = x;
    u.speed = 0;
    return u;
}

/** 적 하나를 정해진 자리에 세운다 */
function putEnemy(s, id, lane, x) {
    const def = s.cfg.enemyDefs[id];
    expect(def, `${STAGE} 의 waveTable 에 '${id}' 가 없다`).toBeTruthy();
    const e = spawnEnemy(s, def, lane);
    e.x = x;
    e.speed = 0;
    return e;
}

describe("비행 아군 — 발사체", () => {
    it("★★★ 비행 아군의 공격은 **그 틱에 도착하지 않는다** (즉발이 아니다)", () => {
        const s = sim();
        const fairy = putAlly(s, "magical_fairy", 400);
        expect(fairy.lane, "FLYER 가 공중 레인에 서지 않았다").toBe(AIR_LANE);
        expect(usesProjectile(fairy.role), "FLYER 가 발사체 역할이 아니다").toBe(true);

        const bat = putEnemy(s, "swooping_bat", 0, 400 + 120); // 사거리 170 안 · FLYING 이라 공중으로 간다
        expect(bat.lane).toBe(AIR_LANE);

        const before = bat.hp;
        stepCombat(s);

        expect(s.projectiles.length, "발사체가 생기지 않았다 — 즉발로 때리고 있다").toBe(1);
        expect(bat.hp, "공격한 틱에 이미 피해가 들어갔다 — 이동 시간이 없다").toBe(before);

        // 날아가서 맞는다
        for (let i = 0; i < 40 && bat.hp === before; i++) stepProjectiles(s);
        expect(bat.hp, "발사체가 끝내 명중하지 않았다").toBeLessThan(before);
    });

    /**
     * ★ 오라 안 비행은 고도를 낮춰 **지상**을 때린다(`engage.js:strikeGround`).
     *   그 경로는 `stepCombat` 의 레인 루프가 아니라 별도 함수라, 발사체 규약이
     *   한쪽에만 걸리면 "공중 적에게는 탄을 쏘고 지상 적은 즉발로 때리는"
     *   반쪽 상태가 된다. 실제로 그렇게 갈라지기 쉬운 자리다.
     */
    it("★★ 강하 타격(오라 안 → 지상)도 발사체로 나간다", () => {
        const s = sim();
        expect(s.cfg.auraEffects?.FLYER?.canHitGround, "강하 타격이 꺼져 있다").toBeTruthy();

        const fairy = putAlly(s, "magical_fairy", 400);
        fairy.inAura = true;
        const ground = putEnemy(s, "soldier_ant", 0, 400 + 100); // 지상 레인 · 사거리 안

        const before = ground.hp;
        stepCombat(s);

        expect(s.projectiles.length, "강하 타격이 즉발로 나갔다").toBe(1);
        expect(s.projectiles[0].lane, "탄이 표적의 지상 레인으로 가지 않았다").toBe(0);
        expect(ground.hp, "공격한 틱에 이미 피해가 들어갔다").toBe(before);

        for (let i = 0; i < 40 && ground.hp === before; i++) stepProjectiles(s);
        expect(ground.hp, "발사체가 끝내 명중하지 않았다").toBeLessThan(before);
    });

    /**
     * ★★★ **대조군.** 사거리만 보고 쓸어 담지 않았는지 확인한다.
     *   SUPPORT 는 190–235 로 경계(100)를 한참 넘지만 `trySupport` 가
     *   `tryAttack` 을 지나지 않는다 — 피해가 아니라 힐이라 "즉발이 부당한가"라는
     *   질문 자체가 성립하지 않는다. 여기 넣으면 한 발도 안 쏘는 죽은 선언이 된다.
     */
    it("★★ SUPPORT 는 발사체 역할이 아니다 (사거리만 보고 쓸어 담지 않았다)", () => {
        expect(usesProjectile("SUPPORT")).toBe(false);
        const s = sim();
        const friar = putAlly(s, "jovial_friar", 400);
        const hurt = putAlly(s, "determined_soldier", 420);
        hurt.hp = 1; // 힐 대상

        // 오라 밖에서만 작동한다 (auraEffects.SUPPORT.inverted)
        friar.inAura = false;
        friar.atkReadyAt = 0;
        stepCombat(s);

        expect(s.projectiles.length, "지원이 발사체를 만들었다").toBe(0);
        expect(hurt.hp, "힐이 나가지 않았다 — 대조군이 성립하지 않는다").toBeGreaterThan(1);
    });

    it("★ 발사체 역할 목록은 `roles.js` 하나에서 온다 (사본이 생기면 갈라진다)", () => {
        // 후열 화력 역할은 전부 발사체다 — 근접·방벽·지원만 즉발이다
        for (const role of ROLE_ORDER) {
            const shoots = usesProjectile(role);
            const isMeleeish = role === "BLOCKER" || role === "MELEE" || role === "SUPPORT";
            expect(shoots, `${role}`).toBe(!isMeleeish);
        }
        // 데이터 쪽도 같은 답을 낸다
        for (const u of unitsData.units) {
            if (u.role !== "FLYER") continue;
            expect(u.art?.projectile?.shape, `units/${u.id}: 비행인데 탄 그림이 없다`).toBeTruthy();
        }
    });
});
