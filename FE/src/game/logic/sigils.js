/**
 * 각인 (Sigil) — 런 내 로그라이트 드래프트
 *
 * ★ 각인은 **스탯이 아니라 행동을 바꾼다.**
 *   "공격력 +10%" 가 아니라 "블로커가 블록할 때마다 광역 충격파".
 *   이것이 엔지니어링 시간당 재미가 가장 큰 항목이며, 같은 6유닛으로
 *   매 판 다른 전투를 만든다.
 *
 * ★ 메타 성장은 각인 **풀의 넓이 · 선택지 수 · 리롤 횟수**만 늘린다.
 *   각인 자체의 수치는 절대 올리지 않는다.
 *   → 메타는 *가능성*을 사고, 런이 *빌드*를 결정한다.
 *   (Naavik 이 지목한 "로그라이트 vs 성장" 함정 회피책)
 *
 * ★ 진화는 **발견형**이다. 조합을 미리 알려주지 않고 `✨반응` 힌트만 준다.
 *   위키·유튜브·입소문을 만드는 조합 테이블이 여기서 나온다.
 *
 * @see docs/02-design/11-core-loop.md §5.3
 */
import sigilData from "../data/sigils.json" with { type: "json" };
import { TAG } from "./tags.js";

export const SIGILS = Object.fromEntries(sigilData.sigils.map((s) => [s.id, s]));
export const EVOLUTIONS = sigilData.evolutions;

/** 훅 종류 — 시뮬 각 지점에서 호출된다 */
export const HOOK = {
    APPLY: "apply", // 각인 획득 시 1회
    MODIFY_STAT: "modifyStat", // 유닛 스폰 시 스탯 보정
    ON_SUMMON: "onSummon",
    ON_ATTACK: "onAttack",
    ON_KILL: "onKill",
    ON_BLOCK: "onBlock",
    ON_DAMAGE_TAKEN: "onDamageTaken",
    ON_WAVE_START: "onWaveStart",
    PROJECTILE_SPAWN: "projectileSpawn",
    PROJECTILE_HIT: "projectileHit",
};

/** 빈 훅 테이블 (createSim 이 사용) */
export function createHooks() {
    const h = Object.create(null);
    for (const k of Object.values(HOOK)) h[k] = [];
    return h;
}

/* ══════════════════════════════════════════════════════════════
 * 연산자 — sigils.json 의 `op` 가 여기에 매핑된다.
 * 데이터가 선언하고 코드가 실행한다. 새 각인은 대부분 데이터만 추가하면 된다.
 * ══════════════════════════════════════════════════════════════ */

export const OPS = {
    /* ── 자원 ── */
    addMana: (s, v) => {
        s.mana = Math.min(s.manaMax, s.mana + v);
    },
    addRift: (s, v) => {
        s.riftEnergy = Math.min(s.riftMax, s.riftEnergy + v);
    },
    /**
     * ★★ 배율은 `s.cfg.manaRegenBase` 가 아니라 **전역 수정자**에 쌓는다.
     *
     *   예전에는 cfg 를 복제해 `manaRegenBase` 만 곱했는데, `resources.js` 는
     *   템포 시프트 이후 `manaRegenTempo` 를 읽는다. 그래서 마나 샘은
     *   **전투의 60% 지점부터 조용히 사라졌다** (실측: 템포 후 0.40 → 0.40,
     *   즉 +0%). 드래프트는 3웨이브마다 열리므로 후반에 고른 마나 샘은
     *   아예 한 번도 작동하지 않았다.
     */
    mulManaRegen: (s, v) => {
        s.mods.manaRegenMult *= v;
    },

    /* ── 방주 ── */
    mulArkHpMax: (s, v) => {
        s.arkHpMax = Math.round(s.arkHpMax * v);
        s.arkHp = Math.min(s.arkHp, s.arkHpMax);
    },
    healArk: (s, v) => {
        s.arkHp = Math.min(s.arkHpMax, s.arkHp + v);
    },

    /* ── 오라 ── */
    mulAuraRadius: (s, v) => {
        s.commander.auraRadius = Math.round(s.commander.auraRadius * v);
    },
    /**
     * ★★ **곱해서 쌓는다.** 예전에는 `Math.max` 였는데 원천이 이 각인 하나뿐이라
     *   2스택째가 **아무 일도 하지 않았다** (실측: 0.25 → 0.25). `maxStacks: 2` 로
     *   드래프트에 다시 뜨는데 고르면 손해인, 가장 나쁜 종류의 선택지였다.
     *
     * ★ 덧셈이 아니라 곱셈인 이유: 몇 스택을 쌓아도 100%(완전 정지)에 도달하지
     *   않는다. 이동 정지는 이 게임에서 방벽만 할 수 있는 일이다.
     *   0.25 → 2스택 0.4375.
     */
    setAuraSlow: (s, v) => {
        s.mods.auraSlow = 1 - (1 - s.mods.auraSlow) * (1 - v);
    },

    /* ── 유닛 스탯 (스폰 시 적용) ── */
    mulRoleAtk: (s, v, ctx, params) => {
        if (!ctx.entity || !ctx.entity.isAlly) return;
        if (params.role && ctx.entity.role !== params.role) return;
        ctx.entity.atk = Math.round(ctx.entity.atk * v);
    },
    /**
     * ★ **체력 비율을 보존한다.** 스폰 시에는 hp === hpMax 이므로 예전 동작
     *   (`hp = hpMax`)과 결과가 같지만, **이미 나와 있는 아군에게 소급 적용될 때**
     *   `hp = hpMax` 는 전체 회복이 되어 버린다 — 체력 각인이 몰래 '결집의 함성'을
     *   겸하게 된다. 각인은 선언한 일만 해야 한다.
     */
    mulRoleHp: (s, v, ctx, params) => {
        if (!ctx.entity || !ctx.entity.isAlly) return;
        if (params.role && ctx.entity.role !== params.role) return;
        const e = ctx.entity;
        const ratio = e.hpMax > 0 ? e.hp / e.hpMax : 1;
        e.hpMax = Math.round(e.hpMax * v);
        e.hp = Math.round(e.hpMax * ratio);
    },
    addRoleBlock: (s, v, ctx, params) => {
        if (!ctx.entity || !ctx.entity.isAlly) return;
        if (params.role && ctx.entity.role !== params.role) return;
        ctx.entity.blockCount += v;
    },
    addTag: (s, v, ctx, params) => {
        if (!ctx.entity || !ctx.entity.isAlly) return;
        if (params.role && ctx.entity.role !== params.role) return;
        const bit = TAG[params.tag];
        if (bit) ctx.entity.tags |= bit;
    },
    mulAtkSpeed: (s, v, ctx, params) => {
        if (!ctx.entity || !ctx.entity.isAlly) return;
        if (params.role && ctx.entity.role !== params.role) return;
        ctx.entity.atkInterval = Math.round(ctx.entity.atkInterval * v);
    },

    /* ── 투사체 ── */
    addPierce: (s, v, ctx) => {
        if (ctx.projectile) ctx.projectile.pierce += v;
    },
    mulProjectileDamage: (s, v, ctx) => {
        if (ctx.projectile) ctx.projectile.damage = Math.round(ctx.projectile.damage * v);
    },

    /* ── 전투 ── */
    execute: (s, v, ctx) => {
        // 처형: 대상 HP 가 임계 이하이면 즉시 처치
        const t = ctx.target;
        if (!t || t.isAlly) return;
        if (t.hp / t.hpMax <= v) t.hp = 0;
    },
    splashOnBlock: (s, v, ctx) => {
        // 블록 성공 시 주변 적에게 광역
        const b = ctx.blocker;
        if (!b) return;
        const enemies = s.lanes[b.lane]?.enemies;
        if (!enemies) return;
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (Math.abs(e.x - b.x) > 80) continue;
            e.hp -= v;
        }
    },
    knockback: (s, v, ctx) => {
        const t = ctx.target;
        if (t && !t.isAlly) t.x = Math.min(s.cfg.riftX, t.x + v);
    },
    applyStatus: (s, v, ctx, params) => {
        const t = ctx.target;
        if (!t) return;
        if (params.type === "freeze") t.frozenUntil = s.t + params.ms;
        if (params.type === "slow") t.slowUntil = s.t + params.ms;
    },

    /* ── 웨이브 ── */
    healAlliesOnWave: (s, v) => {
        const a = s.actives;
        for (let i = 0; i < a.length; i++) {
            const u = a[i];
            if (u.isAlly) u.hp = Math.min(u.hpMax, u.hp + u.hpMax * v);
        }
    },
};

/* ══════════════════════════════════════════════════════════════
 * 적용
 * ══════════════════════════════════════════════════════════════ */

/**
 * 각인을 시뮬에 적용한다.
 * @returns {string|null} 발생한 진화 id (없으면 null)
 */
export function applySigil(s, sigilId) {
    const def = SIGILS[sigilId];
    if (!def) throw new Error(`알 수 없는 각인: ${sigilId}`);

    s.sigils.push(sigilId);

    for (const hook of def.hooks ?? []) {
        if (hook.on === HOOK.APPLY) {
            runOp(s, hook, null);
            continue;
        }
        s.hooks[hook.on].push(hook);
        if (hook.on === HOOK.MODIFY_STAT && RETROACTIVE_OPS[hook.op]) {
            applyToActiveAllies(s, hook);
        }
    }

    // ★ 진화는 획득 시점에만 1회 검사한다. 매 틱 검사하면 75종 × 12조합을
    //   30Hz 로 스캔하게 되어 틱 예산을 초과한다.
    return checkEvolutions(s);
}

/**
 * ★★★ **소급 적용되는 연산 — "할 수 있는 일"을 여는 것만이다** (2026-08-05, 제보 ②③).
 *
 *   `addRoleBlock`(철벽 · 블록 수 +1) · `addTag`(대공탄 · 공중 요격)는
 *   **지금 화면에 있는 위협을 보고 고르는 각인**이다. 비행 웨이브가 몰려오는 것을
 *   보고 대공탄을 골랐는데 "그때 이미 나와 있던 궁수는 끝까지 공중에 못 닿는다"면,
 *   그 각인은 고른 사람에게 아무 일도 하지 않는다. 사용자 제보가 정확히 이 둘이었다.
 *   두 각인의 설명도 "**모든** 방벽 / **모든** 원거리 동료"다.
 *
 * ★ 반대로 **수치를 미는 각인(공격력·체력·공속)은 소급하지 않는다.** 그 규칙은
 *   `spawn.js` 가 오래전부터 지켜 온 설계(각인을 일찍 고르는 판단이 의미를 갖는다)이고,
 *   소급시키면 게이트 B16("방벽 없는 편성은 크게 샌다")이 실측으로 무너진다
 *   (무방벽 잔여 HP 48.9% → 72.0%, 상한 70%). 배제가 곧 결정이라는 이 게임의
 *   설계결정 1과도 같은 방향이다.
 */
const RETROACTIVE_OPS = { addRoleBlock: 1, addTag: 1 };

/**
 * 이 각인이 **언제부터** 효과를 내는가 (2026-08-06, 사용자 제보 ③).
 *
 * ★★★ **답은 셋이다. 둘로 물으면 8종이 거짓말을 한다.**
 *
 *   2026-08-05 에는 `isRetroactive()` 라는 **참/거짓** 술어였고, 화면은
 *   거짓이면 "다음에 소환하는 동료부터 적용됩니다"라고 적었다. 그런데 그 술어는
 *   `modifyStat` 훅만 본다 — **`modifyStat` 훅이 아예 없는 각인 8종**
 *   (관통 화살 · 강타 · 처형 · 서리 오라 · 넓은 지휘 · 결집의 함성 · 마나 샘 ·
 *   보강된 방주)이 전부 거짓으로 떨어져 같은 문구를 달고 있었다.
 *   이들은 **소환과 아무 상관이 없고 고르는 즉시 걸린다** — 오라 반경이나 방주
 *   최대 HP 는 '동료 소환'이라는 개념 자체가 없다. 사용자가 "설명은 다음
 *   소환부터라는데 실제로는 바로 적용되는 것 같다"고 한 것이 정확히 이것이다.
 *
 * @param {string} sigilId
 * @returns {"immediate"|"retroactive"|"nextSummon"}
 *   - `immediate`   소환과 무관하게 즉시 (오라 · 방주 · 발사체 · 타격/처치 훅)
 *   - `retroactive` 동료 스탯을 만지되 **이미 서 있는 동료에게도** 소급
 *   - `nextSummon`  동료 스탯을 만지고 **다음에 소환하는 동료부터**
 */
export function sigilTiming(sigilId) {
    const def = SIGILS[sigilId];
    if (!def) return "nextSummon";
    const hooks = def.hooks ?? [];
    const stat = hooks.filter((h) => h.on === HOOK.MODIFY_STAT);
    // ★ 소환 시점이 의미를 갖는 것은 `modifyStat` 뿐이다. 그것이 없으면
    //   "다음 소환부터"라는 말 자체가 성립하지 않는다.
    if (!stat.length) return "immediate";
    return stat.some((h) => RETROACTIVE_OPS[h.op]) ? "retroactive" : "nextSummon";
}

/*
 * ★ 예전의 `isRetroactive()` 는 지웠다 (2026-08-06). `sigilTiming` 이 답을 셋으로
 *   늘렸으므로 참/거짓 별칭을 남기면 **다시 둘로 묻는 호출부**가 생긴다 —
 *   그것이 8종을 거짓말하게 만든 원인이다.
 */

/** 소급 적용 전용 ctx — 획득 시 1회뿐이지만 규약상 재사용한다 */
const retroCtx = { entity: null, target: null, blocker: null, projectile: null };

/**
 * ★★★ **스탯 각인은 이미 전장에 나와 있는 아군에게도 적용된다** (2026-08-05, 제보 ②③).
 *
 *   예전에는 `spawn.js:trySummon` 에서만 `modifyStat` 훅이 돌았다. 그래서:
 *     · '철벽'(방벽 블록 수 +1)을 골라도 **이미 세워 둔 거북이는 그대로**였다.
 *     · '대공탄'(모든 원거리가 공중 요격)을 **비행 웨이브를 보고** 골랐는데
 *       그때 나와 있던 궁수들은 끝까지 공중에 닿지 못했다.
 *   두 각인 모두 설명이 "**모든** 방벽 / **모든** 원거리 동료"다. 거짓말이었다.
 *   사용자 제보는 정확히 이 둘이었다 ("적용되지 않는 것 같다").
 *
 * ★ 그래서 규약을 하나로 정한다: **각인은 이 전투 전체에 적용된다.**
 *   "먼저 고르면 이득"이라는 예전 의도는 남는다 — 각인은 웨이브 3마다만 열리고,
 *   일찍 고를수록 그 효과를 받는 시간이 길다.
 * ★ 체력 각인은 비율을 보존한다(`mulRoleHp`) — 소급 적용이 전체 회복이 되지 않게.
 */
function applyToActiveAllies(s, hook) {
    const a = s.actives;
    for (let i = 0; i < a.length; i++) {
        if (!a[i].isAlly) continue;
        retroCtx.entity = a[i];
        runOp(s, hook, retroCtx);
    }
    retroCtx.entity = null;
}

function runOp(s, hook, ctx) {
    const fn = OPS[hook.op];
    if (!fn) throw new Error(`알 수 없는 각인 연산: ${hook.op}`);
    fn(s, hook.value, ctx ?? {}, hook.params ?? {});
}

/** 훅 실행. ctx 객체는 호출부가 재사용한다 (틱당 할당 0). */
export function runHooks(s, hookName, ctx) {
    const list = s.hooks[hookName];
    if (!list || !list.length) return;
    for (let i = 0; i < list.length; i++) runOp(s, list[i], ctx);
}

/** 조합이 성립하면 진화 각인을 추가로 적용한다 */
function checkEvolutions(s) {
    for (const evo of EVOLUTIONS) {
        if (s.evolved.includes(evo.id)) continue;
        if (!evo.requires.every((r) => s.sigils.includes(r))) continue;

        s.evolved.push(evo.id);
        for (const hook of evo.hooks ?? []) {
            if (hook.on === HOOK.APPLY) {
                runOp(s, hook, null);
                continue;
            }
            s.hooks[hook.on].push(hook);
            if (hook.on === HOOK.MODIFY_STAT && RETROACTIVE_OPS[hook.op]) {
                applyToActiveAllies(s, hook);
            }
        }
        return evo.id;
    }
    return null;
}

/* ══════════════════════════════════════════════════════════════
 * 드래프트
 * ══════════════════════════════════════════════════════════════ */

/**
 * 3지선다 생성.
 *
 * ★ `sigil` RNG 스트림만 소비한다. 전투 스트림을 건드리면
 *   각인 하나 추가가 전 스테이지 밸런스를 흔든다.
 *
 * @param {object} s
 * @param {number} count 선택지 수 (기록보관소 업그레이드로 3→4)
 */
export function rollDraft(s, count = 3) {
    const owned = new Set(s.sigils);
    const pool = [];

    for (const def of sigilData.sigils) {
        if (def.minWave && s.wave < def.minWave) continue;
        const stacks = s.sigils.filter((id) => id === def.id).length;
        if (stacks >= (def.maxStacks ?? 1)) continue;
        pool.push(def);
    }
    if (!pool.length) return [];

    // 가중 추출 (중복 없이)
    const picked = [];
    const avail = pool.slice();
    for (let n = 0; n < count && avail.length; n++) {
        let total = 0;
        for (const d of avail) total += d.weight ?? 100;
        let r = s.rng.sigil() * total;
        let idx = 0;
        for (let i = 0; i < avail.length; i++) {
            r -= avail[i].weight ?? 100;
            if (r <= 0) {
                idx = i;
                break;
            }
        }
        picked.push(avail[idx].id);
        avail.splice(idx, 1);
    }

    return picked.map((id) => ({
        id,
        /** ★ 조합이 존재한다는 힌트만 준다. 무엇과 조합되는지는 알려주지 않는다. */
        reactive: hasReaction(s, id, owned),
    }));
}

/** 보유 각인 중 이 각인과 진화 조합을 이루는 것이 있는가 */
function hasReaction(s, id, owned) {
    for (const evo of EVOLUTIONS) {
        if (s.evolved.includes(evo.id)) continue;
        if (!evo.requires.includes(id)) continue;
        const rest = evo.requires.filter((r) => r !== id);
        if (rest.every((r) => owned.has(r))) return true;
    }
    return false;
}

/** 스테이지에서 드래프트가 열리는 웨이브인가 (3웨이브마다) */
export function isDraftWave(s) {
    return s.wave > 0 && s.wave % 3 === 0 && s.wave <= s.waveTotal;
}
