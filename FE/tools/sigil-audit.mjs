/**
 * 각인 전수 감사 — **선언한 효과가 실제로 전투를 바꾸는가** (2026-08-04)
 *
 * ★★ **왜 필요한가.** 각인은 `sigils.json` 이 훅(`on`)과 연산(`op`)을 선언하고
 *   `logic/sigils.js:OPS` 가 실행한다. 이 사슬은 **어디가 끊겨도 조용하다** —
 *   훅 이름 오타, 시뮬이 그 훅을 안 부름, 조건이 실전에서 성립 안 함.
 *   그 어느 경우에도 예외도 경고도 없고, 드래프트에는 멀쩡히 뜬다.
 *   사용자가 "관통 화살이 작동하지 않는 것 같다"고 물은 것이 이 사슬의 이야기다.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ★★★ 2026-08-05 — **이 감사는 두 가지를 따로 본다.**
 *
 *   ① 지문(fingerprint) 검사 — "결과가 달라지는가"
 *   ② **관측량(observable) 검사 — "선언한 방향으로 움직이는가"**
 *
 *   ①만 보던 시절에 관통 화살은 초록불이었다. 그런데 실제로 하던 일은
 *   "적을 1체 더 관통"이 **아니라** "같은 적을 한 번 더 때리기"였다.
 *   결과는 당연히 달라지므로 ①은 통과한다. **달라지는 것과 선언한 대로
 *   되는 것은 다른 명제다.** 육중한 사격(투사체 피해 +35%)은 반대로
 *   ①에서도 죽어 있었지만 스택 3 의 우연한 부작용에 가려져 있었다.
 *
 *   ②는 각인마다 **그 각인만이 움직일 수 있는 숫자 하나**를 통제된 무대에서
 *   재고, 기대 방향(↑ / ↓)으로 갔는지 본다. 정밀한 배율 검증은
 *   `src/game/logic/sigils.effect.test.js` 가 하고, 여기서는 실제 전투
 *   흐름 안에서도 그 방향이 유지되는지를 본다.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ★ 검사 방법: **같은 시드로 두 번 돌린다.** 각인 없이 한 번, 각인만 얹어 한 번.
 *   시뮬은 결정론이므로(시드 PRNG · 고정 30Hz 틱) 각인이 아무 일도 하지 않으면
 *   두 결과는 **완전히 동일**하다. 하나라도 다르면 그 각인은 살아 있다.
 *
 * ★ 여러 스테이지 · 여러 시드로 돈다. 각인마다 발동 조건이 다르기 때문이다 —
 *   관통은 한 레인에 적이 둘 이상 있어야 하고, 처형은 빈사인 적이 있어야 한다.
 *   한 판만 보고 "효과 없음"이라고 말하면 그것이 거짓말이 된다.
 *
 * 사용: node tools/sigil-audit.mjs
 */
import { createSim, runToCompletion, step } from "../src/game/logic/sim.js";
import { buildStageConfig } from "../src/game/logic/stageConfig.js";
import { autoPlayTick } from "../src/game/logic/autoPlay.js";
import { applySigil } from "../src/game/logic/sigils.js";
import { recommendedLoadoutForStage } from "../src/game/logic/stagePreview.js";
import { UNIT_DEFS } from "../src/game/logic/stageConfig.js";
import { trySummon, spawnEnemy } from "../src/game/logic/spawn.js";
import { EV, forEachEvent } from "../src/game/logic/events.js";
import { TAG } from "../src/game/logic/tags.js";
import sigilData from "../src/game/data/sigils.json" with { type: "json" };

/** 각인 효과가 드러나려면 전투가 충분히 길고 적이 많아야 한다 */
const STAGES = ["1-12", "2-10", "3-8", "4-9"];
const SEEDS = 6;
/** 관통·처형처럼 조건부인 것들을 위해 최대 스택까지 얹는다 */
const STACKS = 3;

/** 그 스테이지의 추천 편성을 레벨 20 으로 세운다 (효과가 보이는 수준) */
function loadoutFor(stageId) {
    return recommendedLoadoutForStage(stageId)
        .filter((id) => UNIT_DEFS[id])
        .map((id) => ({ id, level: 20 }));
}

/** 한 판의 결과를 **한 줄로 압축**한다. 하나라도 다르면 문자열이 달라진다. */
function fingerprint(s) {
    return [
        s.phase,
        Math.round(s.t),
        s.arkHp,
        s.stats.kills,
        Math.round(s.stats.damageDealt ?? 0),
        s.actives.length,
    ].join("|");
}

function runOnce(stageId, seed, sigilId) {
    const cfg = buildStageConfig(stageId, loadoutFor(stageId), {});
    const s = createSim(cfg, seed);
    if (sigilId) {
        // ★ 드래프트를 거치지 않고 직접 얹는다 — 드래프트 확률에 검사를 맡기면
        //   "안 뜬 각인"과 "효과 없는 각인"을 구분할 수 없다.
        for (let i = 0; i < STACKS; i++) applySigil(s, sigilId);
    }
    // ★ 드래프트는 **받지 않는다** (항상 첫 칸을 골라도 각인이 섞여 비교가 오염된다).
    //   대신 리롤 없이 첫 칸 고정 — 기준선과 실험군이 같은 선택을 하므로 상쇄된다.
    runToCompletion(s, (st) => autoPlayTick(st), 400, () => 0);
    return fingerprint(s);
}

/* ══════════════════════════════════════════════════════════════
 * ② 관측량 — "그 각인만이 움직일 수 있는 숫자"
 *
 * ★ 무대를 직접 세운다. 웨이브·오라를 끄고 표적 더미만 두면
 *   관측량이 각인 하나의 함수가 된다 (자동 플레이의 잡음이 섞이지 않는다).
 * ══════════════════════════════════════════════════════════════ */

const PROBE_STAGE = "1-12";
const PROBE_SEED = 7;
const LANE = 1;
const OFF_FIELD = -100000;

/** 역할별 대표 동료 */
const PROBE = {
    BLOCKER: "slow_turtle",
    MELEE: "determined_soldier",
    RANGED: "halfling_slinger",
    CASTER: "novice_pyromancer",
    SIEGE: "spikey_porcupine",
    SUPPORT: "jovial_friar",
};

function arena(sigilId, stacks, opts = {}) {
    const cfg = buildStageConfig(PROBE_STAGE, [{ id: "elf_sharpshooter", level: 1 }]);
    const s = createSim(cfg, PROBE_SEED);
    s.cfg.waveTable = [];
    s.waveTotal = 5;
    s.nextWaveAt = Infinity;
    s.commander.x = opts.commanderX ?? OFF_FIELD;
    s.commander.targetX = s.commander.x;
    s.commander.lane = LANE;
    for (let i = 0; i < stacks; i++) applySigil(s, sigilId);
    return s;
}

function summon(s, unitId, x = 300) {
    s.mana = s.manaMax;
    if (!trySummon(s, UNIT_DEFS[unitId], LANE)) throw new Error(`${unitId} 소환 실패`);
    const u = s.actives[s.actives.length - 1];
    u.x = x;
    u.speed = 0;
    return u;
}

function dummy(s, x, opts = {}) {
    const baseId = Object.keys(s.cfg.enemyDefs)[0];
    const tagMask = opts.tagMask ?? 0;
    const e = spawnEnemy(s, { ...s.cfg.enemyDefs[baseId], tagMask }, LANE);
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

function roleOf(def) {
    return def.hooks[0].params?.role ?? "MELEE";
}

/**
 * 각인 → { label, dir, measure }
 *   dir: "up" | "down" — 기대 방향
 *   measure(stacks): 통제된 무대에서 잰 숫자
 *
 * ★ **각인마다 다른 숫자를 잰다.** 전부 "피해량"으로 재면 관통과 화력 각인을
 *   구분하지 못하고, 그것이 바로 이 감사가 처음에 놓친 실패였다.
 */
const OBSERVABLES = {
    piercing_arrow: {
        label: "한 발이 맞힌 고유 적 수",
        dir: "up",
        measure: (n) => {
            const s = arena("piercing_arrow", n);
            const u = summon(s, "elf_sharpshooter");
            u.atkInterval = 10_000_000; // 딱 한 발
            for (let i = 0; i < 5; i++) dummy(s, 400 + i * 40);
            const hit = new Set();
            stepN(s, 90, (e) => {
                if (e.type === EV.PROJECTILE_HIT) hit.add(e.b);
            });
            return hit.size;
        },
    },
    heavy_shot: {
        label: "한 발의 실제 피해",
        dir: "up",
        measure: (n) => {
            const s = arena("heavy_shot", n);
            const u = summon(s, "elf_sharpshooter");
            u.atkInterval = 10_000_000;
            dummy(s, 400);
            stepN(s, 60);
            return Math.round(s.stats.damageDealt);
        },
    },
    execute: {
        label: "빈사 적 처치 수 (근접+원거리)",
        dir: "up",
        measure: (n) => {
            let killed = 0;
            for (const [unit, x] of [["determined_soldier", 320], ["elf_sharpshooter", 400]]) {
                const s = arena("execute", n);
                summon(s, unit);
                const e = dummy(s, x, { hpMax: 1e10, hp: 1e10 * 0.12 });
                stepN(s, 60);
                if (e.hp <= 0) killed++;
            }
            return killed;
        },
    },
    aura_frost: {
        label: "오라 안 적의 1초 전진 거리",
        dir: "down",
        measure: (n) => {
            const s = arena("aura_frost", n, { commanderX: 600 });
            const e = dummy(s, 700, { speed: 24 });
            const x0 = e.x;
            stepN(s, 30);
            return Number((x0 - e.x).toFixed(4));
        },
    },
    wide_command: { label: "오라 반경", dir: "up", measure: (n) => arena("wide_command", n).commander.auraRadius },
    mana_well: {
        label: "템포 이후 1초 마나 재생",
        dir: "up",
        measure: (n) => {
            const s = arena("mana_well", n);
            s.tempoShifted = true; // ★ 후반 구간에서 잰다 — 여기가 죽어 있던 자리다
            s.mana = 0;
            stepN(s, 30);
            return Number(s.mana.toFixed(4));
        },
    },
    reinforced_ark: { label: "방주 최대 체력", dir: "up", measure: (n) => arena("reinforced_ark", n).arkHpMax },
    rallying_cry: {
        label: "웨이브 시작 회복량",
        dir: "up",
        measure: (n) => {
            const s = arena("rallying_cry", n);
            const u = summon(s, PROBE.MELEE);
            u.hp = 1;
            s.nextWaveAt = s.t;
            stepN(s, 1);
            return Math.round(u.hp);
        },
    },
    flak_rounds: {
        label: "물리 원거리가 공중에 준 피해",
        dir: "up",
        measure: (n) => {
            const s = arena("flak_rounds", n);
            summon(s, PROBE.RANGED);
            dummy(s, 400, { tagMask: TAG.FLYING });
            stepN(s, 90);
            return Math.round(s.stats.damageDealt);
        },
    },
    rapid_fire: {
        label: "5초 동안 쏜 발수",
        dir: "up",
        measure: (n) => {
            const s = arena("rapid_fire", n);
            summon(s, PROBE.RANGED);
            dummy(s, 380);
            let shots = 0;
            stepN(s, 150, (e) => {
                if (e.type === EV.PROJECTILE_SPAWN) shots++;
            });
            return shots;
        },
    },
    bulwark: {
        label: "동시에 붙든 적 수",
        dir: "up",
        measure: (n) => {
            const s = arena("bulwark", n);
            summon(s, PROBE.BLOCKER);
            for (const dx of [22, 28, 34, 39]) dummy(s, 300 + dx);
            stepN(s, 2);
            return s.lanes[LANE].enemies.filter((e) => e.blockedBy !== -1).length;
        },
    },
};

/** 스탯형은 전부 같은 방식으로 잰다 — 역할 대표를 소환해 그 필드를 읽는다 */
const STAT_FIELD = { mulRoleAtk: "atk", mulRoleHp: "hpMax", mulAtkSpeed: "atkInterval" };

function observableFor(def) {
    if (OBSERVABLES[def.id]) return OBSERVABLES[def.id];
    const field = STAT_FIELD[def.hooks[0].op];
    if (!field) return null;
    const role = roleOf(def);
    return {
        label: `${role} 의 ${field}`,
        dir: field === "atkInterval" ? "down" : "up",
        measure: (n) => summon(arena(def.id, n), PROBE[role])[field],
    };
}

/* ── 실행 ─────────────────────────────────────────────────── */

const rows = [];
for (const sig of sigilData.sigils) {
    // ① 지문
    const hits = [];
    for (const stageId of STAGES) {
        for (let seed = 0; seed < SEEDS; seed++) {
            const base = runOnce(stageId, seed, null);
            const withSigil = runOnce(stageId, seed, sig.id);
            if (base !== withSigil) hits.push(`${stageId}#${seed}`);
        }
    }

    // ② 관측량
    const obs = observableFor(sig);
    let probe = null;
    if (obs) {
        const max = sig.maxStacks ?? 1;
        const base = obs.measure(0);
        const full = obs.measure(max);
        const moved = obs.dir === "up" ? full > base : full < base;
        probe = { label: obs.label, dir: obs.dir, base, full, max, moved };
    }

    rows.push({
        id: sig.id,
        ko: sig.name?.ko ?? sig.id,
        hooks: (sig.hooks ?? []).map((h) => `${h.on}:${h.op}`).join(", "),
        changed: hits.length,
        total: STAGES.length * SEEDS,
        probe,
    });
}

/* ── 출력 ─────────────────────────────────────────────────── */
console.log("── 각인 전수 감사 ───────────────────────────────");
console.log(`스테이지 ${STAGES.join(" · ")} × 시드 ${SEEDS} × 스택 ${STACKS}`);
console.log("");

console.log("① 전투 결과가 달라지는가 (같은 시드 2회 비교)");
for (const r of [...rows].sort((a, b) => a.changed - b.changed)) {
    const mark = r.changed === 0 ? "✗" : r.changed < 3 ? "△" : "✔";
    console.log(
        `  ${mark} ${r.ko.padEnd(10)} ${String(r.changed).padStart(2)}/${r.total}  ${r.hooks}`
    );
}

console.log("");
console.log("② 선언한 방향으로 움직이는가 (통제된 무대 · 0스택 → 최대스택)");
for (const r of rows) {
    if (!r.probe) {
        console.log(`  · ${r.ko.padEnd(10)} 관측량 미정의`);
        continue;
    }
    const p = r.probe;
    const arrow = p.dir === "up" ? "↑" : "↓";
    console.log(
        `  ${p.moved ? "✔" : "✗"} ${r.ko.padEnd(10)} ${p.label} ${arrow}  ` +
            `${p.base} → ${p.full} (×${p.max})`
    );
}

console.log("───────────────────────────────────────────────");

const dead = rows.filter((r) => r.changed === 0);
const wrongWay = rows.filter((r) => r.probe && !r.probe.moved);
const unmeasured = rows.filter((r) => !r.probe);

let failed = false;
if (dead.length) {
    console.error(
        `✗ 아무 것도 바꾸지 못한 각인 ${dead.length}종: ${dead.map((d) => d.ko).join(" · ")}`
    );
    console.error("  드래프트에는 뜨지만 전투에는 존재하지 않는 선택지다.");
    failed = true;
}
if (wrongWay.length) {
    console.error(
        `✗ 선언한 방향으로 움직이지 않은 각인 ${wrongWay.length}종: ` +
            wrongWay.map((d) => `${d.ko}(${d.probe.base}→${d.probe.full})`).join(" · ")
    );
    console.error("  결과는 달라지는데 **다른 것을 바꾸고 있다.**");
    failed = true;
}
if (unmeasured.length) {
    // ★ 경고가 아니라 실패다. 관측량이 없는 각인은 ①만 통과하면 되는데,
    //   ①은 관통 화살을 6개월간 초록불로 통과시켰다.
    console.error(
        `✗ 관측량이 정의되지 않은 각인 ${unmeasured.length}종: ` +
            unmeasured.map((d) => d.ko).join(" · ")
    );
    console.error("  tools/sigil-audit.mjs 의 OBSERVABLES 에 그 각인만의 숫자를 추가할 것.");
    failed = true;
}
if (failed) process.exit(1);

console.log(`✅ ${rows.length}종 전부 전투 결과를 바꾸고, 선언한 방향으로 움직인다`);
