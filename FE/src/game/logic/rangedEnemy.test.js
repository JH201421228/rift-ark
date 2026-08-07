/**
 * 원거리 적 — **발사체를 쏘는가, 아니면 즉발로 때리는가** (2026-08-05)
 *
 * ★★★ 사용자 제보: "원거리 적이 즉발로 때린다."
 *
 *   원인은 전투 코드가 아니라 **빈 필드**였다. `enemies.json` 에는 `role` 이
 *   한 종도 없었고, `stageConfig.js:normalizeDef` 의 `raw.role ?? "MELEE"` 가
 *   적 62종을 전부 근접으로 정규화했다. `engage.js:tryAttack` 은
 *   `PROJECTILE_ROLES` (RANGED · CASTER · SIEGE) 일 때만 발사체를 만들므로,
 *   **사거리 120–190 을 가진 적 11종이 화면을 가로질러 즉발로 때렸다.**
 *   문법은 완전했고 아무 검사도 실패하지 않았다 — 검사기는 아군만 보고 있었다.
 *
 * ★ 여기서 재는 것은 "적이 센가"가 아니라 **규칙이 지켜지는가**다:
 *   ① 원거리 적의 공격은 **그 틱에 도착하지 않는다** (이동 시간이 있다)
 *   ② 근접 적은 여전히 즉발이다 (대조군 — 전부 발사체로 만들어 버리지 않았는가)
 *   ③ 적의 발사체는 **아군만** 때린다
 *   ④ 발사체 풀이 마르는 것은 조용히 지나가지 않는다
 *
 * ★ 사거리 ↔ 역할의 데이터 대조는 `tools/validate-data.mjs` 의 발사체 절이 한다.
 *   같은 명제를 두 곳에서 검사하면 두 임계값이 갈라진다 — 이 저장소의 단일 실패 유형이다.
 */
import { describe, it, expect } from "vitest";
import { createSim } from "./sim.js";
import { buildStageConfig } from "./stageConfig.js";
import { spawnEnemy } from "./spawn.js";
import { stepCombat } from "./engage.js";
import { stepProjectiles } from "./projectiles.js";
import { usesProjectile } from "./roles.js";
import { acquireProjectile } from "./state.js";
import { enemiesData } from "./stageConfig.js";

const SIX = [
    { id: "slow_turtle", level: 1 },
    { id: "bold_man_at_arms", level: 1 },
    { id: "determined_soldier", level: 1 },
    { id: "elf_sharpshooter", level: 1 },
    { id: "novice_pyromancer", level: 1 },
    { id: "jovial_friar", level: 1 },
];

/** 원거리 적(goblin_slinger)과 근접 적(goblin_fighter 계열)이 함께 나오는 판 */
const STAGE = "2-2";

function sim() {
    return createSim(buildStageConfig(STAGE, SIX, { meta: {} }), 1);
}

/** 사거리 안에 가만히 서 있는 표적 아군. 죽지도 움직이지도 않는다. */
function putDummy(s, lane, x) {
    const u = {
        id: 30000 + lane,
        defId: "dummy",
        isAlly: true,
        role: "MELEE",
        lane,
        x,
        hp: 1e9,
        hpMax: 1e9,
        atk: 0,
        def: 0,
        res: 0,
        range: 0,
        speed: 0,
        atkInterval: 1e9,
        atkReadyAt: 1e9,
        blockCount: 0,
        blocking: 0,
        blockedBy: -1,
        shield: 0,
        pierce: 0,
        tags: 0,
        dmgType: "physical",
        engaged: false,
        inAura: false,
    };
    s.lanes[lane].allies.push(u);
    s.actives.push(u);
    return u;
}

/** 적 하나를 아군에게서 `gap` px 떨어진 곳에 세운다 */
function putEnemyAt(s, id, lane, x) {
    const def = s.cfg.enemyDefs[id];
    expect(def, `${STAGE} 의 waveTable 에 '${id}' 가 없다`).toBeTruthy();
    const e = spawnEnemy(s, def, lane);
    e.x = x;
    e.speed = 0; // 이 테스트가 재는 것은 이동이 아니라 타격 방식이다
    return e;
}

describe("원거리 적 — 발사체", () => {
    it("★★★ 원거리 적의 공격은 **그 틱에 도착하지 않는다** (즉발이 아니다)", () => {
        const s = sim();
        const target = putDummy(s, 0, 400);
        const e = putEnemyAt(s, "goblin_slinger", 0, 400 + 120); // 사거리 150 안

        expect(usesProjectile(e.role), "goblin_slinger 의 역할이 발사체 역할이 아니다").toBe(true);

        const before = target.hp;
        stepCombat(s);

        expect(s.projectiles.length, "발사체가 생기지 않았다 — 즉발로 때리고 있다").toBe(1);
        expect(target.hp, "공격한 틱에 이미 피해가 들어갔다 — 이동 시간이 없다").toBe(before);

        // 날아가서 맞는다
        for (let i = 0; i < 30 && target.hp === before; i++) stepProjectiles(s);
        expect(target.hp, "발사체가 끝내 명중하지 않았다").toBeLessThan(before);
    });

    it("★ 근접 적은 여전히 즉발이다 (전부 발사체로 만들어 버리지 않았는가)", () => {
        const s = sim();
        const target = putDummy(s, 0, 400);
        const melee = enemiesData.enemies.find((x) => !x.role && s.cfg.enemyDefs[x.id]);
        const e = putEnemyAt(s, melee.id, 0, 400 + 10);

        expect(usesProjectile(e.role)).toBe(false);
        const before = target.hp;
        stepCombat(s);

        expect(s.projectiles.length, "근접 적이 발사체를 만들었다").toBe(0);
        expect(target.hp, "근접 적의 피해가 그 틱에 들어가지 않았다").toBeLessThan(before);
    });

    it("★ 적의 발사체는 아군만 때린다 (진영이 뒤집히지 않는다)", () => {
        const s = sim();
        const target = putDummy(s, 0, 400);
        putEnemyAt(s, "goblin_slinger", 0, 400 + 120);
        // 사수 뒤에 선 같은 편 — 발사체가 지나가도 맞으면 안 된다
        const friend = putEnemyAt(s, "goblin_slinger", 0, 400 + 60);
        const friendHp = friend.hp;

        stepCombat(s);
        for (let i = 0; i < 30; i++) stepProjectiles(s);

        expect(friend.hp, "적의 발사체가 같은 편을 때렸다").toBe(friendHp);
        expect(target.hp).toBeLessThan(1e9);
    });

    /**
     * ★★★ **풀 고갈은 조용히 지나가지 않는다.**
     *
     *   `acquireProjectile` 은 풀이 비면 `null` 을 돌려주고 `spawnProjectile` 이
     *   그냥 돌아간다. 그 침묵은 연출 누락이 아니라 **그 한 방이 통째로 사라지는 것**
     *   이다 — 발사체는 자기 스탯으로 때리기 때문이다(`projectiles.js`).
     *   `stats.spawnDropped` 와 같은 규약으로 숫자를 남긴다.
     */
    it("★★ 발사체 풀이 마르면 stats.projectileDropped 가 센다", () => {
        const s = sim();
        putDummy(s, 0, 400);
        putEnemyAt(s, "goblin_slinger", 0, 400 + 120);

        const held = [];
        for (let p = acquireProjectile(s); p; p = acquireProjectile(s)) held.push(p);
        expect(held.length, "풀이 비어 있지 않다").toBeGreaterThan(0);
        expect(s.stats.projectileDropped, "고갈 직전인데 이미 세고 있다").toBe(1);

        stepCombat(s);
        expect(s.projectiles.length).toBe(0);
        expect(s.stats.projectileDropped, "태어나지 못한 탄을 세지 않는다").toBe(2);
    });
});
