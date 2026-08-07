/**
 * 각인 **메커니즘** 검증 — "선언한 그 현상이 실제로 일어나는가" (2026-08-05)
 *
 * ★★★ `sigils.test.js` 와 `tools/sigil-audit.mjs` 는 **"결과가 달라지는가"** 를 본다.
 *   그 명제는 필요조건일 뿐이다. 관통 각인이 실수로 **같은 적을 두 번 때리는**
 *   피해 배율이 되어 있어도 결과는 달라지고, 그 감사는 초록불을 켠다.
 *   실제로 그랬다 (2026-08-05 사용자 제보 "관통이 정말 작동하는지 의문이다").
 *
 * ★ 그래서 여기서는 각인마다 **그 각인만이 만들 수 있는 관측량**을 하나 고르고,
 *   같은 시드 · 같은 무대에서 각인 없이 한 번, 각인만 얹어 한 번 재서 비교한다.
 *   "달라졌다"가 아니라 "선언한 만큼 달라졌다"를 본다.
 *
 *     관통 → 발사체 **한 발이 맞힌 고유 적 수** (명중 횟수가 아니다)
 *     육중한 사격 → 그 한 발이 실제로 입힌 피해
 *     처형 → 임계 이하 적이 **정말 즉사하는가** (근접·원거리 양쪽)
 *     마나 샘 → 템포 시프트 **전과 후** 양쪽의 초당 재생량
 *     ...
 *
 * ★ 난수를 쓰지 않는다. 시드 PRNG 와 고정 30Hz 틱만으로 같은 답이 나온다.
 *
 * @see docs/02-design/11-core-loop.md §5.3
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { createSim, step } from "./sim.js";
import { buildStageConfig, UNIT_DEFS } from "./stageConfig.js";
import { trySummon, spawnEnemy } from "./spawn.js";
import { applySigil, HOOK, OPS } from "./sigils.js";
import { EV, forEachEvent } from "./events.js";
import { effectiveBlockCount } from "./aura.js";
import { TAG } from "./tags.js";
import sigilData from "../data/sigils.json" with { type: "json" };

/* ══════════════════════════════════════════════════════════════
 * 무대 — 각인 하나만 변수로 남긴다
 * ══════════════════════════════════════════════════════════════ */

const STAGE = "1-12";
const SEED = 7;
const LANE = 1;
/** 지휘관을 전장 밖으로 치우는 좌표 — 오라가 변수로 끼어들지 않게 한다 */
const OFF_FIELD = -100000;

/**
 * 웨이브를 끄고 지휘관을 치운 빈 전장.
 * ★ 스폰·오라·템포가 전부 상수여야 관측량이 각인 하나의 함수가 된다.
 */
function arena(sigils = [], opts = {}) {
    const cfg = buildStageConfig(STAGE, [{ id: "elf_sharpshooter", level: 1 }]);
    const s = createSim(cfg, SEED);

    s.cfg.waveTable = []; // 웨이브가 열려도 아무도 나오지 않는다
    s.waveTotal = 5; // 0 으로 두면 "적이 없으니 승리"로 전투가 끝난다
    s.nextWaveAt = Infinity; // 웨이브는 테스트가 직접 연다

    s.commander.x = opts.commanderX ?? OFF_FIELD;
    s.commander.targetX = s.commander.x; // 지휘관이 스스로 걸어오지 않게 고정
    s.commander.lane = opts.commanderLane ?? LANE;

    for (const id of sigils) applySigil(s, id);
    return s;
}

/** 동료 하나를 원하는 자리에 세운다 (기본은 제자리 고정) */
function summon(s, unitId, x = 300, lane = LANE) {
    s.mana = s.manaMax;
    expect(trySummon(s, UNIT_DEFS[unitId], lane), `${unitId} 소환 실패`).toBe(true);
    const u = s.actives[s.actives.length - 1];
    u.x = x;
    u.speed = 0;
    return u;
}

/**
 * 표적 더미. DEF·RES·태그 0, 반격 0 —
 * 관측량이 상성이나 반격으로 오염되지 않게 한다.
 */
function dummy(s, x, opts = {}) {
    const baseId = Object.keys(s.cfg.enemyDefs)[0];
    const tagMask = opts.tagMask ?? 0;
    const e = spawnEnemy(s, { ...s.cfg.enemyDefs[baseId], tagMask }, opts.lane ?? LANE);
    e.x = x;
    e.speed = opts.speed ?? 0;
    e.atk = 0;
    e.def = 0;
    e.res = 0;
    e.tags = tagMask;
    e.regenPerSec = 0;
    e.hpMax = opts.hpMax ?? 1e9;
    e.hp = opts.hp ?? e.hpMax;
    return e;
}

function stepN(s, n, onEvent) {
    for (let i = 0; i < n; i++) {
        step(s);
        if (onEvent) forEachEvent(s.events, onEvent);
    }
}

/**
 * 발사체 **한 발**이 맞힌 고유 적 수.
 * ★ 명중 **횟수**가 아니라 **고유 적 수**를 센다. 이 구분이 이 파일의 존재 이유다 —
 *   예전 구현은 관통 3스택으로 적 하나를 세 번 때리고 있었고, 횟수만 세면 통과한다.
 */
function uniqueEnemiesHitByOneShot(sigils, { gap = 40, enemies = 5, unit = "elf_sharpshooter" } = {}) {
    const s = arena(sigils);
    const u = summon(s, unit, 300);
    u.atkInterval = 10_000_000; // 딱 한 발만 쏘게 한다
    for (let i = 0; i < enemies; i++) dummy(s, 400 + i * gap);

    const byProjectile = new Map();
    stepN(s, 90, (e) => {
        if (e.type !== EV.PROJECTILE_HIT) return;
        if (!byProjectile.has(e.a)) byProjectile.set(e.a, new Set());
        byProjectile.get(e.a).add(e.b);
    });

    expect(byProjectile.size, "발사체가 한 발도 나가지 않았다").toBe(1);
    return [...byProjectile.values()][0].size;
}

/* ══════════════════════════════════════════════════════════════
 * ① 관통 화살 — 사용자가 의심한 바로 그것
 * ══════════════════════════════════════════════════════════════ */

describe("관통 화살 (piercing_arrow)", () => {
    /**
     * ★★ 회귀 방지 — 2026-08-05 이전 실측값:
     *   간격 40px 에서 0/1/2/3 스택이 전부 **고유 1체**였다.
     *   즉 "1체 더 관통"은 일어나지 않았고, 2·3 스택은 같은 적을 2·3번 때렸다.
     */
    it("한 발이 맞히는 고유 적 수가 스택마다 정확히 +1 이다", () => {
        expect(uniqueEnemiesHitByOneShot([])).toBe(1);
        expect(uniqueEnemiesHitByOneShot(["piercing_arrow"])).toBe(2);
        expect(uniqueEnemiesHitByOneShot(["piercing_arrow", "piercing_arrow"])).toBe(3);
        expect(uniqueEnemiesHitByOneShot(new Array(3).fill("piercing_arrow"))).toBe(4);
    });

    /**
     * ★ 적 간격에 의존하지 않아야 한다. 예전 구현은 명중 창(±24px) 안에 적이
     *   둘 이상 겹쳐 있을 때만 우연히 관통했다 — 간격이 넓어지면 조용히 죽었다.
     */
    it("적 간격이 넓어도 같은 수를 관통한다 — 우연히 겹친 적을 세는 것이 아니다", () => {
        for (const gap of [10, 40, 100, 160]) {
            expect(uniqueEnemiesHitByOneShot(["piercing_arrow"], { gap }), `간격 ${gap}`).toBe(2);
        }
    });

    /** ★ 같은 적을 두 번 때리는 것은 관통이 아니다 (조용한 피해 배율이었다) */
    it("한 발이 같은 적을 두 번 때리지 않는다", () => {
        const s = arena(new Array(3).fill("piercing_arrow"));
        const u = summon(s, "elf_sharpshooter", 300);
        u.atkInterval = 10_000_000;
        dummy(s, 400); // 적은 하나뿐이다

        let hits = 0;
        stepN(s, 90, (e) => {
            if (e.type === EV.PROJECTILE_HIT) hits++;
        });
        expect(hits, "관통이 남아 있어도 같은 적을 다시 때리면 안 된다").toBe(1);
    });

    it("관통이 없는 발사체는 첫 명중에 소멸한다", () => {
        const s = arena();
        const u = summon(s, "elf_sharpshooter", 300);
        u.atkInterval = 10_000_000;
        dummy(s, 400);
        dummy(s, 460);

        let hits = 0;
        stepN(s, 90, (e) => {
            if (e.type === EV.PROJECTILE_HIT) hits++;
        });
        expect(hits).toBe(1);
        expect(s.projectiles.length).toBe(0);
    });

    /** ★ 풀 재사용 — 앞 발사체의 명중 기록이 남으면 그 적을 영영 못 맞힌다 */
    it("풀에서 재사용된 발사체가 앞 발의 명중 기록을 물려받지 않는다", () => {
        const s = arena();
        summon(s, "halfling_slinger", 300); // 700ms 간격 = 여러 발
        const target = dummy(s, 380);

        let hits = 0;
        let shots = 0;
        stepN(s, 200, (e) => {
            if (e.type === EV.PROJECTILE_SPAWN) shots++;
            if (e.type === EV.PROJECTILE_HIT && e.b === target.id) hits++;
        });
        // 표적은 멈춰 있고 사거리 안이므로 **쏜 것은 전부 맞아야 한다**
        // (마지막 한 발은 아직 비행 중일 수 있다).
        expect(shots).toBeGreaterThan(5);
        expect(hits, `${shots}발 중 ${hits}발만 명중했다`).toBeGreaterThanOrEqual(shots - 1);
    });
});

/* ══════════════════════════════════════════════════════════════
 * ② 투사체 피해 · 처형
 * ══════════════════════════════════════════════════════════════ */

/** 한 발이 실제로 입힌 피해 (발사체 정의 damage 가 아니라 **적이 잃은 HP**) */
function damageOfOneShot(sigils) {
    const s = arena(sigils);
    const u = summon(s, "elf_sharpshooter", 300);
    u.atkInterval = 10_000_000;
    dummy(s, 400);
    stepN(s, 60);
    return s.stats.damageDealt;
}

describe("육중한 사격 (heavy_shot)", () => {
    /**
     * ★★ 회귀 방지 — `stepProjectiles` 가 발사자가 살아 있으면 `src` 를 그대로
     *   넘겨서 `p.damage` 를 한 번도 읽지 않았다. 실측 83 → 83 (+0%).
     *   "발사자가 비행 중에 죽은 발사체"에만 효과가 있던 각인이다.
     */
    it("한 발의 실제 피해가 데이터 배율만큼 늘어난다", () => {
        const base = damageOfOneShot([]);
        const withSigil = damageOfOneShot(["heavy_shot"]);
        expect(base).toBeGreaterThan(0);

        const atk = UNIT_DEFS.elf_sharpshooter.atk;
        const mult = sigilOf("heavy_shot").hooks[0].value;
        // 발사체 피해는 스폰 시 정수로 반올림된다
        expect(withSigil / base).toBeCloseTo(Math.round(atk * mult) / atk, 6);
    });

    it("발사체 자신의 damage 필드에 반영된다", () => {
        const s = arena(["heavy_shot"]);
        const u = summon(s, "elf_sharpshooter", 300);
        dummy(s, 400);
        stepN(s, 1);
        expect(s.projectiles.length).toBe(1);
        expect(s.projectiles[0].damage).toBe(
            Math.round(u.atk * sigilOf("heavy_shot").hooks[0].value)
        );
    });
});

describe("처형 (execute)", () => {
    const threshold = () => sigilOf("execute").hooks[0].value;

    /** 임계 바로 아래의 적 하나를 세우고, 한 대 맞으면 죽는지 본다 */
    function survivesOneHit(sigils, unitId, x) {
        const s = arena(sigils);
        summon(s, unitId, 300);
        const e = dummy(s, x, { hpMax: 1e10, hp: 1e10 * (threshold() - 0.05) });
        stepN(s, 60);
        return e.hp > 0;
    }

    it("근접 공격이 임계 이하의 적을 즉시 처치한다", () => {
        expect(survivesOneHit([], "determined_soldier", 320)).toBe(true);
        expect(survivesOneHit(["execute"], "determined_soldier", 320)).toBe(false);
    });

    /**
     * ★★ 회귀 방지 — `engage.js:tryAttack` 이 투사체 역할이면 onAttack 훅 **앞에서**
     *   return 했다. 그래서 처형은 활·술사·공성에 **존재하지 않았다** (실측:
     *   근접 hp 0 vs 원거리 hp 999,999,917). 설명 문구에는 역할 제한이 없다.
     */
    it("원거리 투사체도 임계 이하의 적을 처치한다", () => {
        expect(survivesOneHit([], "elf_sharpshooter", 400)).toBe(true);
        expect(survivesOneHit(["execute"], "elf_sharpshooter", 400)).toBe(false);
    });

    /**
     * ★ 처형으로 죽은 적도 **정상 처치**다 — 처치 수 · 마나 환급 · 균열력이
     *   전부 붙어야 한다. 붙지 않으면 "죽였는데 아무 보상이 없는" 죽음이 된다.
     */
    it("처형된 적이 처치로 집계되고 환급도 들어온다", () => {
        const s = arena(["execute"]);
        summon(s, "determined_soldier", 300);
        const e = dummy(s, 320, { hpMax: 1e10, hp: 1e10 * (threshold() - 0.05) });
        e.cost = 100; // 환급이 관측되도록
        s.mana = 0;
        s.riftEnergy = 0;
        stepN(s, 60);

        expect(e.hp).toBe(0);
        expect(s.stats.kills, "처형이 처치로 세어지지 않는다").toBe(1);
        expect(s.mana, "처치 환급이 들어오지 않는다").toBeGreaterThan(
            60 * (s.cfg.manaRegenBase / 30)
        );
        expect(Object.keys(s.stats.unkilledByTag)).toEqual([]);
    });

    it("임계보다 체력이 높은 적은 처형되지 않는다", () => {
        const s = arena(["execute"]);
        summon(s, "determined_soldier", 320);
        const e = dummy(s, 340, { hpMax: 1e10, hp: 1e10 * (threshold() + 0.3) });
        stepN(s, 60);
        expect(e.hp).toBeGreaterThan(0);
    });
});

/* ══════════════════════════════════════════════════════════════
 * ③ 스탯 각인 — 어떤 역할에 붙는가까지 잰다
 * ══════════════════════════════════════════════════════════════ */

/** 역할별 대표 동료 — 스탯 각인의 표적 판정을 재는 자 */
const PROBE = {
    BLOCKER: "slow_turtle",
    MELEE: "determined_soldier",
    RANGED: "halfling_slinger",
    CASTER: "novice_pyromancer",
    SIEGE: "spikey_porcupine",
    SUPPORT: "jovial_friar",
};

function statOf(sigils, unitId, field) {
    const s = arena(sigils);
    return summon(s, unitId)[field];
}

describe("역할 스탯 각인", () => {
    const cases = [
        ["sharpened_blades", "MELEE", "atk"],
        ["arcane_focus", "CASTER", "atk"],
        ["siege_calibration", "SIEGE", "atk"],
        ["hallowed_edge", "SUPPORT", "atk"],
        ["iron_hide", "BLOCKER", "hpMax"],
    ];

    for (const [id, role, field] of cases) {
        it(`${sigilOf(id).name.ko} — ${role} 의 ${field} 만 데이터 배율만큼 바뀐다`, () => {
            const mult = sigilOf(id).hooks[0].value;
            const base = statOf([], PROBE[role], field);
            expect(statOf([id], PROBE[role], field)).toBe(Math.round(base * mult));

            // ★ 다른 역할은 건드리지 않는다 — "설명은 X 인데 Y 에 붙는" 결함 검사
            for (const other of Object.keys(PROBE)) {
                if (other === role) continue;
                expect(statOf([id], PROBE[other], field), `${id} 가 ${other} 에도 붙었다`).toBe(
                    statOf([], PROBE[other], field)
                );
            }
        });
    }

    it("지휘관의 예기 (commanders_edge) — 모든 역할의 공격력이 오른다", () => {
        const mult = sigilOf("commanders_edge").hooks[0].value;
        for (const unitId of Object.values(PROBE)) {
            expect(statOf(["commanders_edge"], unitId, "atk")).toBe(
                Math.round(statOf([], unitId, "atk") * mult)
            );
        }
    });

    it("단련된 대열 (hardened_ranks) — 모든 역할의 체력이 오른다", () => {
        const mult = sigilOf("hardened_ranks").hooks[0].value;
        for (const unitId of Object.values(PROBE)) {
            expect(statOf(["hardened_ranks"], unitId, "hpMax")).toBe(
                Math.round(statOf([], unitId, "hpMax") * mult)
            );
        }
    });

    it("체력 각인은 최대치뿐 아니라 현재 체력도 채운다", () => {
        const s = arena(["hardened_ranks"]);
        const u = summon(s, PROBE.MELEE);
        expect(u.hp).toBe(u.hpMax);
    });

    /**
     * ★★★ **소급 규약** (2026-08-05 제보 ②③ 이후).
     *
     *   · **능력을 여는 각인**(`addRoleBlock` 철벽 · `addTag` 대공탄)은 이미 나와 있는
     *     아군에게도 즉시 적용된다 — 그 각인은 "지금 오는 위협"을 보고 고르는 것이라
     *     소급되지 않으면 고른 사람에게 아무 일도 하지 않는다.
     *   · **수치를 미는 각인**(공격력·체력·공속)은 **이후 소환분부터**다 —
     *     일찍 고르는 판단이 의미를 갖게 하는 오래된 설계이고, 소급시키면
     *     게이트 B16(방벽 필수성)이 실측으로 무너진다 (무방벽 잔여 HP 48.9% → 72.0%).
     */
    it("수치 각인은 이후 소환분부터다", () => {
        const s = arena();
        const before = summon(s, PROBE.MELEE);
        const atkBefore = before.atk;
        applySigil(s, "sharpened_blades");
        const after = summon(s, PROBE.MELEE, 340);

        expect(before.atk, "이미 나와 있던 아군까지 세지면 B16 이 무너진다").toBe(atkBefore);
        expect(after.atk).toBe(
            Math.round(atkBefore * sigilOf("sharpened_blades").hooks[0].value)
        );
    });

    /** ★ 소급이 켜지는 op 는 딱 둘이다 — 목록이 늘면 이 검사가 먼저 알려 준다 */
    it("소급되는 각인은 철벽과 대공탄뿐이다", () => {
        const retro = [];
        for (const def of sigilData.sigils) {
            const s = arena();
            const u = summon(s, PROBE.BLOCKER); // 방벽이자 아군 — 모든 role 필터를 통과하진 않는다
            const snap = `${u.atk}|${u.hpMax}|${u.blockCount}|${u.tags}|${u.atkInterval}`;
            applySigil(s, def.id);
            if (`${u.atk}|${u.hpMax}|${u.blockCount}|${u.tags}|${u.atkInterval}` !== snap) {
                retro.push(def.id);
            }
        }
        expect(retro).toEqual(["bulwark"]); // 대공탄은 RANGED 전용이라 방벽으로는 안 잡힌다
    });

    /**
     * ★ 체력 각인은 **비율을 보존**한다. 지금은 소급되지 않지만, 소급 목록이
     *   넓어지는 날 `hp = hpMax` 였다면 체력 각인이 몰래 전체 회복을 겸하게 된다.
     */
    it("체력 각인이 현재 체력 비율을 보존한다", () => {
        const e = { isAlly: true, role: "MELEE", hp: 60, hpMax: 200 };
        OPS.mulRoleHp(null, 1.5, { entity: e }, {});
        expect(e.hpMax).toBe(300);
        expect(e.hp / e.hpMax).toBeCloseTo(0.3, 6);
    });

    it("적에게는 소급 적용되지 않는다", () => {
        const s = arena();
        const e = dummy(s, 400);
        const blockCount = e.blockCount;
        const tags = e.tags;
        applySigil(s, "bulwark");
        applySigil(s, "flak_rounds");
        expect(e.blockCount).toBe(blockCount);
        expect(e.tags).toBe(tags);
    });
});

describe("속사 (rapid_fire)", () => {
    it("원거리 동료의 공격 간격이 데이터 배율만큼 줄어든다", () => {
        const mult = sigilOf("rapid_fire").hooks[0].value;
        const base = statOf([], PROBE.RANGED, "atkInterval");
        expect(statOf(["rapid_fire"], PROBE.RANGED, "atkInterval")).toBe(Math.round(base * mult));
    });

    it("같은 시간 안에 실제로 더 많이 쏜다", () => {
        const shots = (sigils) => {
            const s = arena(sigils);
            summon(s, PROBE.RANGED, 300);
            dummy(s, 380);
            let n = 0;
            stepN(s, 150, (e) => {
                if (e.type === EV.PROJECTILE_SPAWN) n++;
            });
            return n;
        };
        expect(shots(["rapid_fire"])).toBeGreaterThan(shots([]));
    });
});

describe("철벽 (bulwark)", () => {
    it("방벽의 블록 수가 +1 된다", () => {
        const add = sigilOf("bulwark").hooks[0].value;
        const base = statOf([], PROBE.BLOCKER, "blockCount");
        expect(statOf(["bulwark"], PROBE.BLOCKER, "blockCount")).toBe(base + add);
    });

    /** ★ 숫자가 아니라 **실제로 한 명 더 붙드는가**를 본다 */
    it("실제로 적을 한 체 더 붙든다", () => {
        const blocked = (sigils) => {
            const s = arena(sigils);
            const b = summon(s, PROBE.BLOCKER, 300);
            // 방벽 사거리(40) 안, 최소 간격(20) 밖에 넷을 세운다
            for (const dx of [22, 28, 34, 39]) dummy(s, 300 + dx);
            stepN(s, 2);
            expect(effectiveBlockCount(b, s.cfg)).toBeGreaterThan(0);
            return s.lanes[LANE].enemies.filter((e) => e.blockedBy !== -1).length;
        };
        expect(blocked(["bulwark"])).toBe(blocked([]) + sigilOf("bulwark").hooks[0].value);
    });

    /**
     * ★★ 사용자 제보 ② — "방벽을 한 칸 늘리는 각인이 적용되지 않는 것 같다".
     *   **이미 세워 둔 방벽**에 적용되지 않던 것이 정체였다.
     *   각인은 웨이브 3마다 열리는데, 그때 방벽은 이미 전선에 서 있다.
     */
    it("이미 세워 둔 방벽도 곧바로 한 체 더 붙든다", () => {
        const s = arena();
        const b = summon(s, PROBE.BLOCKER, 300);
        for (const dx of [22, 28, 34, 39]) dummy(s, 300 + dx);
        stepN(s, 2);
        const before = s.lanes[LANE].enemies.filter((e) => e.blockedBy !== -1).length;

        applySigil(s, "bulwark");
        stepN(s, 2);
        const after = s.lanes[LANE].enemies.filter((e) => e.blockedBy !== -1).length;

        expect(effectiveBlockCount(b, s.cfg)).toBeGreaterThan(before);
        expect(after, "각인을 고른 뒤에도 붙든 수가 그대로다").toBe(
            before + sigilOf("bulwark").hooks[0].value
        );
    });
});

describe("대공탄 (flak_rounds)", () => {
    /**
     * ★ 관측량은 태그 비트가 아니라 **공중 적이 실제로 피해를 입는가**다.
     *   `halfling_slinger` 는 물리 원거리이고 ANTI_AIR 가 없다 —
     *   각인이 없으면 공중 적을 영원히 못 때린다.
     */
    function airDamage(sigils) {
        const s = arena(sigils);
        summon(s, PROBE.RANGED, 300);
        const air = dummy(s, 400, { tagMask: TAG.FLYING });
        expect(air.lane).not.toBe(LANE); // 공중 레인으로 갔는가
        stepN(s, 90);
        return s.stats.damageDealt;
    }

    it("물리 원거리가 공중 적을 요격하게 된다", () => {
        expect(airDamage([])).toBe(0);
        expect(airDamage(["flak_rounds"])).toBeGreaterThan(0);
    });

    it("ANTI_AIR 태그가 실제로 붙는다", () => {
        expect(statOf([], PROBE.RANGED, "tags") & TAG.ANTI_AIR).toBe(0);
        expect(statOf(["flak_rounds"], PROBE.RANGED, "tags") & TAG.ANTI_AIR).not.toBe(0);
    });

    it("원거리가 아닌 역할에는 붙지 않는다", () => {
        expect(statOf(["flak_rounds"], PROBE.MELEE, "tags") & TAG.ANTI_AIR).toBe(0);
    });

    /**
     * ★★ 사용자 제보 ③ — "전부 공중 공격을 가능하게 해주는 각인이 적용되지 않는 것 같다".
     *   **비행 웨이브를 보고 각인을 고르는 순간, 궁수는 이미 전장에 있다.**
     *   그때 나와 있던 궁수가 끝까지 공중에 닿지 못한 것이 정체였다.
     */
    it("이미 나와 있던 원거리 동료가 곧바로 공중을 때린다", () => {
        const s = arena();
        const u = summon(s, PROBE.RANGED, 300);
        dummy(s, 400, { tagMask: TAG.FLYING });
        stepN(s, 60);
        expect(s.stats.damageDealt, "각인 전에는 닿지 않아야 이 검사가 성립한다").toBe(0);

        applySigil(s, "flak_rounds");
        expect(u.tags & TAG.ANTI_AIR).not.toBe(0);
        stepN(s, 60);
        expect(s.stats.damageDealt, "각인을 골랐는데도 공중에 닿지 않는다").toBeGreaterThan(0);
    });
});

describe("축성된 날 (hallowed_edge)", () => {
    /** ★ 지원의 공격력은 **치유량**이다. 그 숫자를 직접 잰다. */
    function healAmount(sigils) {
        const s = arena(sigils);
        summon(s, PROBE.SUPPORT, 300);
        const patient = summon(s, PROBE.MELEE, 320);
        patient.hp = 1;

        let heal = 0;
        stepN(s, 4, (e) => {
            if (e.type === EV.HEAL && heal === 0) heal = e.b;
        });
        return heal;
    }

    it("치유량이 데이터 배율만큼 늘어난다", () => {
        const mult = sigilOf("hallowed_edge").hooks[0].value;
        const base = healAmount([]);
        expect(base).toBeGreaterThan(0);
        expect(healAmount(["hallowed_edge"])).toBe(Math.round(base * mult));
    });
});

/* ══════════════════════════════════════════════════════════════
 * ④ 오라 · 자원 · 방주
 * ══════════════════════════════════════════════════════════════ */

describe("오라 냉기 (aura_frost)", () => {
    /** 30틱(1초) 동안 적이 실제로 전진한 거리 */
    function advance(sigils, x) {
        const s = arena(sigils, { commanderX: 600 });
        const e = dummy(s, x, { speed: 24 });
        const x0 = e.x;
        stepN(s, 30);
        return x0 - e.x;
    }

    it("오라 안의 적만 데이터 비율만큼 느려진다", () => {
        const slow = sigilOf("aura_frost").hooks[0].value;
        const inside = 700; // 지휘관(600)에서 100 — 오라 반경 192 안
        const outside = 1100; // 오라 밖

        expect(advance(["aura_frost"], inside)).toBeCloseTo(advance([], inside) * (1 - slow), 4);
        expect(advance(["aura_frost"], outside)).toBeCloseTo(advance([], outside), 4);
    });

    /**
     * ★★ 회귀 방지 — `setAuraSlow` 가 `Math.max` 라서 원천이 이 각인 하나뿐인데도
     *   2스택째가 **아무 일도 하지 않았다** (0.25 → 0.25). `maxStacks: 2` 로
     *   드래프트에 다시 뜨는, 고르면 손해인 선택지였다.
     */
    it("2스택이 실제로 더 느리게 만든다 — 그리고 100% 에 도달하지 않는다", () => {
        expect(arena(["aura_frost"]).mods.auraSlow).toBe(0.25);
        expect(arena(["aura_frost", "aura_frost"]).mods.auraSlow).toBeCloseTo(0.4375, 6);
        expect(arena(new Array(8).fill("aura_frost")).mods.auraSlow).toBeLessThan(1);
    });
});

describe("광역 지휘 (wide_command)", () => {
    it("오라 반경이 데이터 배율만큼 커진다", () => {
        const mult = sigilOf("wide_command").hooks[0].value;
        const base = arena().commander.auraRadius;
        expect(arena(["wide_command"]).commander.auraRadius).toBe(Math.round(base * mult));
    });

    it("반경 밖이던 동료가 실제로 오라 안에 들어온다", () => {
        const inAura = (sigils) => {
            const s = arena(sigils, { commanderX: 400 });
            const u = summon(s, PROBE.MELEE, 400 + 220); // 기본 반경(192) 밖
            stepN(s, 1);
            return u.inAura;
        };
        expect(inAura([])).toBe(false);
        expect(inAura(["wide_command"])).toBe(true);
    });
});

describe("결집의 함성 (rallying_cry)", () => {
    it("웨이브가 시작될 때 최대 체력의 데이터 비율만큼 회복한다", () => {
        const ratio = sigilOf("rallying_cry").hooks[0].value;
        const s = arena(["rallying_cry"]);
        const u = summon(s, PROBE.MELEE);
        u.hp = Math.round(u.hpMax * 0.5);
        const before = u.hp;

        s.nextWaveAt = s.t; // 다음 틱에 웨이브가 열린다
        stepN(s, 1);
        expect(s.wave).toBe(1);
        expect(u.hp).toBeCloseTo(before + u.hpMax * ratio, 4);
    });

    it("웨이브가 열리지 않으면 회복하지 않는다", () => {
        const s = arena(["rallying_cry"]);
        const u = summon(s, PROBE.MELEE);
        u.hp = 10;
        stepN(s, 30);
        expect(u.hp).toBe(10);
    });
});

describe("마나 샘 (mana_well)", () => {
    /** 30틱(1초) 동안 실제로 찬 마나 */
    function regenPerSec(sigils, tempoShifted) {
        const s = arena(sigils);
        s.tempoShifted = tempoShifted;
        s.mana = 0;
        stepN(s, 30);
        return s.mana;
    }

    /**
     * ★★ 회귀 방지 — `mulManaRegen` 이 `s.cfg.manaRegenBase` 만 곱했는데
     *   `resources.js` 는 템포 시프트 이후 `manaRegenTempo` 를 읽는다.
     *   마나 샘은 **전투의 60% 지점부터 조용히 사라졌다** (실측: 0.40 → 0.40).
     *   드래프트는 3웨이브마다 열리므로 후반에 고른 마나 샘은 한 번도 작동하지 않았다.
     */
    it("템포 시프트 전과 후 **양쪽**에서 데이터 배율만큼 는다", () => {
        const mult = sigilOf("mana_well").hooks[0].value;
        for (const tempo of [false, true]) {
            const base = regenPerSec([], tempo);
            expect(base).toBeGreaterThan(0);
            expect(regenPerSec(["mana_well"], tempo), `tempoShifted=${tempo}`).toBeCloseTo(
                base * mult,
                6
            );
        }
    });

    it("템포 시프트 자체는 여전히 재생을 올린다", () => {
        expect(regenPerSec([], true)).toBeGreaterThan(regenPerSec([], false));
    });
});

describe("보강된 방주 (reinforced_ark)", () => {
    it("방주 최대 체력이 데이터 배율만큼 는다", () => {
        const mult = sigilOf("reinforced_ark").hooks[0].value;
        const base = arena().arkHpMax;
        expect(arena(["reinforced_ark"]).arkHpMax).toBe(Math.round(base * mult));
    });

    it("최대치만 올리고 현재 체력을 회복시키지는 않는다", () => {
        const s = arena();
        s.arkHp = 10;
        applySigil(s, "reinforced_ark");
        expect(s.arkHp).toBe(10);
        expect(s.arkHpMax).toBeGreaterThan(s.cfg.arkHp);
    });
});

/* ══════════════════════════════════════════════════════════════
 * ⑤ 전수 규약 — 새 각인이 들어와도 기계가 잡는다
 * ══════════════════════════════════════════════════════════════ */

function sigilOf(id) {
    const def = sigilData.sigils.find((s) => s.id === id);
    if (!def) throw new Error(`테스트가 없는 각인을 참조한다: ${id}`);
    return def;
}

/** 스택을 쌓았을 때 **반드시 달라져야 하는 숫자** — op 하나당 하나 */
const OBSERVE = {
    mulArkHpMax: (s) => s.arkHpMax,
    mulAuraRadius: (s) => s.commander.auraRadius,
    setAuraSlow: (s) => s.mods.auraSlow,
    mulManaRegen: (s) => s.mods.manaRegenMult,
    mulRoleAtk: (s, h) => summon(s, probeFor(h)).atk,
    mulRoleHp: (s, h) => summon(s, probeFor(h)).hpMax,
    mulAtkSpeed: (s, h) => summon(s, probeFor(h)).atkInterval,
    addRoleBlock: (s, h) => summon(s, probeFor(h)).blockCount,
    addTag: (s, h) => summon(s, probeFor(h)).tags,
    addPierce: (s) => firstProjectile(s).pierce,
    mulProjectileDamage: (s) => firstProjectile(s).damage,
    healAlliesOnWave: (s) => {
        const u = summon(s, PROBE.MELEE);
        u.hp = 1;
        s.nextWaveAt = s.t;
        stepN(s, 1);
        return u.hp;
    },
};

function probeFor(hook) {
    return PROBE[hook.params?.role] ?? PROBE.MELEE;
}

function firstProjectile(s) {
    summon(s, PROBE.RANGED, 300);
    dummy(s, 400);
    stepN(s, 1);
    expect(s.projectiles.length, "발사체가 나가지 않았다").toBe(1);
    return s.projectiles[0];
}

describe("전수 규약", () => {
    /**
     * ★★ `maxStacks` 는 거짓말을 하면 안 된다.
     *   같은 훅을 두 번 등록해도 결과가 같은 연산(임계값·설정형)에 maxStacks > 1 을
     *   주면, 드래프트에 다시 뜨는 그 각인은 **아무 일도 하지 않는 선택지**가 된다.
     *   '처형'(임계 18%)과 '오라 냉기'(Math.max)가 실제로 그랬다.
     */
    it("maxStacks 가 2 이상인 각인은 스택마다 관측량이 실제로 달라진다", () => {
        for (const def of sigilData.sigils) {
            const max = def.maxStacks ?? 1;
            if (max < 2) continue;
            expect(def.hooks.length, `${def.id}: 훅이 하나여야 이 검사가 성립한다`).toBe(1);

            const hook = def.hooks[0];
            const observe = OBSERVE[hook.op];
            expect(
                observe,
                `${def.id}: op '${hook.op}' 의 관측량이 OBSERVE 에 없다 — 스택 검증 불가`
            ).toBeTypeOf("function");

            const seen = new Set();
            for (let n = 1; n <= max; n++) {
                seen.add(observe(arena(new Array(n).fill(def.id)), hook));
            }
            expect(
                seen.size,
                `${def.id}: ${max}스택까지 쌓아도 관측값이 [${[...seen]}] 뿐이다`
            ).toBe(max);
        }
    });

    /**
     * ★★ 설명 문구의 퍼센트와 데이터의 실제 수치가 어긋나면 그것은 **거짓말**이다.
     *   플레이어가 읽는 유일한 근거가 desc.ko 이고, 수치는 hooks[].value 에 있다.
     */
    it("설명 문구의 퍼센트가 데이터 수치와 일치한다", () => {
        /** op → 문구에 적히는 퍼센트 (없으면 문구에 % 가 없어야 한다) */
        const PERCENT = {
            mulRoleAtk: (v) => (v - 1) * 100,
            mulRoleHp: (v) => (v - 1) * 100,
            mulProjectileDamage: (v) => (v - 1) * 100,
            mulArkHpMax: (v) => (v - 1) * 100,
            mulManaRegen: (v) => (v - 1) * 100,
            mulAuraRadius: (v) => (v - 1) * 100,
            mulAtkSpeed: (v) => (1 / v - 1) * 100, // 간격 배율 → 속도 증가율
            setAuraSlow: (v) => v * 100,
            execute: (v) => v * 100,
            healAlliesOnWave: (v) => v * 100,
        };

        for (const def of sigilData.sigils) {
            const written = def.desc.ko.match(/(\d+(?:\.\d+)?)\s*%/);
            const fn = PERCENT[def.hooks[0].op];

            if (!fn) {
                expect(written, `${def.id}: op '${def.hooks[0].op}' 는 퍼센트를 만들지 않는다`).toBeNull();
                continue;
            }
            expect(written, `${def.id}: 설명에 퍼센트가 없다`).not.toBeNull();
            expect(Number(written[1]), `${def.id}: 설명 ${written[1]}% ≠ 데이터`).toBeCloseTo(
                fn(def.hooks[0].value),
                6
            );
        }
    });

    /**
     * ★★ **선언만 되고 아무도 부르지 않는 훅**은 이 저장소가 반복해서 당한 사고다.
     *   `HOOK.PROJECTILE_HIT` 와 `HOOK.ON_DAMAGE_TAKEN` 이 그 상태였다 —
     *   `validate-data.mjs:VALID_HOOKS` 에도 있어서, 그 훅을 쓰는 각인을 데이터에
     *   적으면 예외도 경고도 없이 죽었을 것이다.
     */
    it("HOOK 상수는 전부 시뮬 어딘가에서 실제로 실행된다", () => {
        const dir = dirname(fileURLToPath(import.meta.url));
        const fired = new Set();
        let applyHandled = false;

        for (const file of readdirSync(dir)) {
            if (!file.endsWith(".js") || file.endsWith(".test.js")) continue;
            // ★ 주석을 먼저 지운다. 이걸 빼먹으면 **주석 처리된 호출**이 살아 있는
            //   호출로 잡힌다 (이 검사 자체를 일부러 깨뜨려 보다가 발견했다).
            const src = readFileSync(join(dir, file), "utf8")
                .replace(/\/\*[\s\S]*?\*\//g, "")
                .replace(/(^|[^:])\/\/.*$/gm, "$1");
            for (const m of src.matchAll(/runHooks\(\s*\w+\s*,\s*HOOK\.(\w+)/g)) fired.add(m[1]);
            // APPLY 만 예외 — 획득 즉시 1회이므로 applySigil 이 runOp 를 직접 부른다
            if (file === "sigils.js" && /hook\.on === HOOK\.APPLY/.test(src)) applyHandled = true;
        }

        expect(applyHandled, "applySigil 이 APPLY 훅을 처리하지 않는다").toBe(true);
        for (const key of Object.keys(HOOK)) {
            if (key === "APPLY") continue;
            expect(fired.has(key), `HOOK.${key} 를 실행하는 runHooks 호출이 없다`).toBe(true);
        }
    });

    /** 데이터가 선언한 훅은 전부 HOOK 상수에 존재해야 한다 (오타 방지) */
    it("데이터의 훅 이름이 전부 HOOK 상수에 있다", () => {
        const known = new Set(Object.values(HOOK));
        for (const def of sigilData.sigils) {
            for (const h of def.hooks ?? []) {
                expect(known.has(h.on), `${def.id}: 알 수 없는 훅 '${h.on}'`).toBe(true);
            }
        }
    });

    /** 18종 전부가 이 파일 어딘가에서 실제로 이름 불려야 한다 — 빠진 각인 방지 */
    it("모든 각인이 이 파일에서 최소 한 번 검증된다", () => {
        const src = readFileSync(fileURLToPath(import.meta.url), "utf8");
        const generic = /for \(const def of sigilData\.sigils\)/.test(src);
        expect(generic, "전수 루프가 사라졌다").toBe(true);
        expect(sigilData.sigils.length).toBe(18);
    });
});
