/**
 * 타겟 선정 · 공격
 *
 * ★ 레인은 1차원이므로 정렬 배열 병합 스윕으로 O(n+m) 에 모든 타겟을 정한다.
 *   범용 물리 엔진의 O(n²) 오버랩 검사가 필요 없고, 더 빠르며, 결정론적이다.
 *
 * @see docs/03-tech/22-simulation-spec.md §3.2
 */
import { LANE_COUNT, AIR_LANE, TOTAL_LANES, acquireProjectile } from "./state.js";
import { TICK_MS } from "./tick.js";
import { TAG } from "./tags.js";
import { computeDamage, canTarget } from "./combat.js";
import {
    auraActiveFor,
    auraPierceBonus,
    applyAuraOnHit,
    effectiveRange,
    effectiveInterval,
    damageTakenMult,
} from "./aura.js";
import { emit, EV } from "./events.js";
import { runHooks, HOOK } from "./sigils.js";
// ★ 발사체를 쓰는 역할은 `roles.js` 가 단일 출처다 — 검사기도 같은 값을 본다.
import { PROJECTILE_ROLES } from "./roles.js";
import { commanderUp } from "./commanderHit.js";
// ★ 지휘관 HP 를 깎는 자리는 하나뿐이다 (보스 슬램도 같은 함수를 쓴다).
import { damageCommander, COMMANDER_ID } from "./commanderHit.js";

/** 훅 컨텍스트 재사용 — 틱당 힙 할당 0 */
const hookCtx = { entity: null, target: null, blocker: null, projectile: null };
/**
 * `applyDamage` 전용 훅 컨텍스트.
 * ★ 위의 `hookCtx` 를 같이 쓰면 안 된다 — `tryAttack` 이 `applyDamage` 를 부른 뒤
 *   같은 객체에 onAttack 컨텍스트를 채우기 때문에 서로를 덮어쓴다.
 */
const dmgCtx = { entity: null, target: null, blocker: null, projectile: null };


export function resetEngagement(s) {
    const a = s.actives;
    for (let i = 0; i < a.length; i++) a[i].engaged = false;
}

/**
 * 정렬 배열에서 x 이상인 첫 인덱스 (lower bound).
 * 커서를 넘겨주면 이전 위치부터 전진해 전체가 O(n+m) 이 된다.
 */
function advanceCursor(arr, cursor, x) {
    while (cursor < arr.length && arr[cursor].x < x) cursor++;
    return cursor;
}

/** 사거리 안의 가장 가까운 상대를 고른다 (앞쪽 우선) */
function nearestTarget(arr, idx, self, range) {
    const front = idx < arr.length ? arr[idx] : null;
    const back = idx > 0 ? arr[idx - 1] : null;

    let best = null;
    let bestD = Infinity;

    if (front && canTarget(self, front)) {
        const d = front.x - self.x;
        if (d <= range) {
            best = front;
            bestD = d;
        }
    }
    if (back && canTarget(self, back)) {
        const d = self.x - back.x;
        if (d <= range && d < bestD) best = back;
    }
    return best;
}

export function stepCombat(s) {
    const cfgCombat = s.cfg.combat;
    const cfgCmd = s.cfg;

    for (let li = 0; li < TOTAL_LANES; li++) {
        const { allies, enemies } = s.lanes[li];

        // ── 아군 → 적 ────────────────────────────────
        let cur = 0;
        for (let i = 0; i < allies.length; i++) {
            const u = allies[i];

            if (u.role === "SUPPORT") {
                trySupport(s, u, allies, li);
                continue;
            }

            const range = effectiveRange(u, cfgCmd);
            cur = advanceCursor(enemies, cur, u.x);
            const tgt = nearestTarget(enemies, cur, u, range);
            if (!tgt) continue;

            u.engaged = true;
            tryAttack(s, u, tgt, li, cfgCombat, cfgCmd);
        }

        // ── 적 → 아군 ────────────────────────────────
        // 공중 적은 유닛과 교전하지 않고 방주로 직행한다
        if (li === AIR_LANE) continue;

        let cur2 = 0;
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            const range = e.range;
            cur2 = advanceCursor(allies, cur2, e.x);
            const tgt = nearestTarget(allies, cur2, e, range);
            if (!tgt) {
                // ★ 사거리 안에 동료가 없을 때에만 지휘관을 본다 (아래 주석 참조)
                tryHitCommander(s, e, li, cfgCombat, cfgCmd);
                continue;
            }

            e.engaged = true;
            tryAttack(s, e, tgt, li, cfgCombat, cfgCmd);
        }
    }

    // ── 대공: 지상 ANTI_AIR 아군이 공중 적을 요격한다 ──
    interceptAir(s, cfgCombat, cfgCmd);
    // ── 강하: 오라 안 FLYER 아군이 고도를 낮춰 지상을 때린다 ──
    strikeGround(s, cfgCombat, cfgCmd);
}

/**
 * ★★★ **적이 지휘관을 노린다** (2026-08-05).
 *
 *   `docs/02-design/20-commander-combat.md` §2.1 은 지휘관 평타의 대가를 이렇게
 *   못박아 두었다: "평타를 넣으려면 오라 앞쪽을 적에게 내주는 자리까지 나가야
 *   하고, 그러면 SUPPORT 가 끊기고 **지휘관이 맞는다**." 그런데 지휘관은
 *   `lanes[].allies` 에 없어 `nearestTarget` 의 후보가 아니었고, 지휘관 HP 를
 *   깎는 코드는 **보스 슬램뿐**이었다. 대가의 절반이 존재하지 않았다.
 *
 * ★★★ **규칙: 적은 지휘관을 맨 마지막에 본다.**
 *
 *   자기 사거리 안에 동료(아군 유닛)가 하나라도 있으면 그를 때린다. **하나도
 *   없을 때에만** 같은 지상 레인의 지휘관을 노린다.
 *
 *   "가장 가까운 것"으로 만들면 안 된다 — 지휘관이 전선에 서는 순간 그 레인의
 *   무리 전체가 지휘관에게 몰린다. 그것은 미끼가 아니라 즉사이고, C3(중앙에
 *   세워만 둬도 70% 효율)도 함께 죽는다.
 *
 *   이 규칙은 §2.1 의 부등식을 그대로 뒤집어 준다:
 *     · 아군 라인 **뒤**(= 오라를 온전히 씌운 자리)에 있으면 적의 사거리 안에는
 *       언제나 동료가 먼저 있다 → 지휘관은 후보조차 아니다. 방치 효율이 유지된다.
 *     · 평타 사거리(140)까지 나가면 지휘관이 동료보다 앞에 선다 → 전선 앞의
 *       적들에게는 **지휘관이 유일한 표적**이 된다.
 *   즉 위험이 위치에서 연속적으로 자란다. 앞으로 나갈수록 "동료가 사거리 밖이고
 *   지휘관은 사거리 안"인 띠가 넓어지고, 그만큼 많은 적이 지휘관을 본다.
 *
 * ★ **공중 적은 지휘관을 때리지 않는다.** 애초에 공중 레인은 이 루프에 오지
 *   않는다(위 `continue`). 지휘관이 공중을 못 때리는 것과 대칭이고, 그래서
 *   1-6 "공중"이 편성 퍼즐로 남는다 (C2).
 *
 * ★ **결정론.** 후보가 지휘관 하나뿐이라 타이브레이크가 아예 없다. 난수도
 *   추가되지 않는다 — `damageCommander` 는 크리티컬을 굴리지 않는다.
 *
 * ★ **틱 예산.** 이 함수는 `nearestTarget` 이 **빈손일 때만** 불린다. 교전 중인
 *   적(대다수)에게는 비용이 0 이고, 나머지도 비교 두 번이다. 매 틱 전 적이
 *   지휘관 거리를 재는 O(n) 을 만들지 않는다.
 *
 * @see docs/02-design/20-commander-combat.md §2.3
 */
function tryHitCommander(s, e, lane, cfgCombat, cfgCmd) {
    const c = s.commander;
    if (c.lane !== lane) return;
    if (!commanderUp(s)) return;

    const d = c.x > e.x ? c.x - e.x : e.x - c.x;
    if (d > e.range) return;

    const interval = effectiveInterval(e, cfgCmd);
    if (s.t < e.atkReadyAt) return;
    e.atkReadyAt = s.t + interval;
    e.engaged = true;

    emit(s.events, EV.ATTACK, e.id, COMMANDER_ID, lane);

    // ★ 원거리 적은 여기서도 발사체를 쏜다 (②와 같은 규약). 그 탄이 지휘관에게
    //   닿는 판정은 `projectiles.js` 가 한다 — 지휘관은 레인 배열에 없으므로
    //   명중 루프가 따로 봐야 한다.
    if (PROJECTILE_ROLES[e.role]) {
        cmdTarget.x = c.x;
        spawnProjectile(s, e, cmdTarget, lane);
        return;
    }
    damageCommander(s, e.atk, cfgCombat.enemyHitCommanderHpRatio ?? 0);
}

/**
 * 발사체 조준용 지휘관 대역 — `spawnProjectile` 은 `tgt.x` 만 읽는다.
 * ★ 매 공격마다 객체를 만들지 않는다 (절대규칙 7).
 */
const cmdTarget = { x: 0 };

/**
 * ★★★ **오라 안 FLYER 는 고도를 낮춰 지상 적을 때린다** (2026-08-05, 사용자 제보 ①).
 *
 *   `docs/02-design/11-core-loop.md` §4.2 의 역할별 오라 표는
 *   `FLYER | 고도 하강(지상 공격 가능) | 공중만` 이라고 적어 두었고
 *   `balance.json:commander.auraEffects.FLYER.canHitGround` 에 그 값이 있었다.
 *   **그런데 그 값을 읽는 코드가 없었다.**
 *
 *   결과: 비행 동료(4종)는 **공중 적이 없는 판에서 한 대도 때리지 않았다.**
 *   공중 레인에 떠서 아이들 애니메이션만 돌았다. 사용자가 "일부 아군이 어떤 공격도
 *   하지 않는다"고 제보한 것이 이 이야기다. `roles.js:BACKLINE_ROLES` 는 FLYER 를
 *   "후열 화력"으로 세고 있었으므로 편성 분석까지 거짓말을 하고 있었다.
 *
 * ★ 비행 아군은 레인이 하나(AIR_LANE)뿐이라 세 지상 레인을 모두 본다.
 *   병합 스윕이 성립하지 않지만 **비행 아군은 편성 6칸 중 몇 개뿐**이라
 *   비용이 (비행 수 × 적 수)로 묶인다. 배열 생성·정렬은 하지 않는다 (절대규칙 7).
 * ★ 동거리 타이브레이크는 **id 오름차순**이다 — 없으면 레인 순회 순서에 결과가 묶인다.
 */
function strikeGround(s, cfgCombat, cfgCmd) {
    if (!cfgCmd.auraEffects?.FLYER?.canHitGround) return;
    const flyers = s.lanes[AIR_LANE].allies;
    if (!flyers.length) return;

    for (let i = 0; i < flyers.length; i++) {
        const u = flyers[i];
        if (u.role !== "FLYER") continue;
        if (!u.inAura) continue; // 오라 밖에서는 공중만 (설계 표 그대로)
        // ★ 쿨다운 검사를 여기서 하지 않는다. `engaged` 는 "사거리 안에 상대가 있다"는
        //   뜻이지 "이번 틱에 때렸다"가 아니다 — 쿨다운 틱에 풀리면 비행 아군이
        //   공격 사이마다 목표를 지나쳐 날아간다. 쿨다운은 `tryAttack` 이 본다.

        let best = null;
        let bestD = Infinity;
        let bestLane = 0;
        for (let li = 0; li < LANE_COUNT; li++) {
            const enemies = s.lanes[li].enemies;
            for (let j = 0; j < enemies.length; j++) {
                const e = enemies[j];
                const d = e.x > u.x ? e.x - u.x : u.x - e.x;
                if (d > u.range) continue;
                if (d > bestD || (d === bestD && best && e.id > best.id)) continue;
                if (!canTarget(u, e)) continue;
                best = e;
                bestD = d;
                bestLane = li;
            }
        }
        if (!best) continue;

        u.engaged = true;
        tryAttack(s, u, best, bestLane, cfgCombat, cfgCmd);
    }
}

/**
 * ★ 대공 수단이 없으면 비행 웨이브를 아예 처리하지 못한다.
 *   이 구조적 요구가 "편성 퍼즐" 설계를 성립시킨다.
 */
function interceptAir(s, cfgCombat, cfgCmd) {
    const air = s.lanes[AIR_LANE].enemies;
    if (!air.length) return;

    for (let li = 0; li < LANE_COUNT; li++) {
        const allies = s.lanes[li].allies;
        let cur = 0;
        for (let i = 0; i < allies.length; i++) {
            const u = allies[i];
            if ((u.tags & TAG.ANTI_AIR) === 0 && u.dmgType === "physical") continue;
            if (u.role === "SUPPORT" || u.role === "BLOCKER") continue;

            const range = effectiveRange(u, cfgCmd);
            cur = advanceCursor(air, cur, u.x);
            const tgt = nearestTarget(air, cur, u, range);
            if (!tgt) continue;

            u.engaged = true;
            tryAttack(s, u, tgt, AIR_LANE, cfgCombat, cfgCmd);
        }
    }
}

function tryAttack(s, atk, tgt, lane, cfgCombat, cfgCmd) {
    const interval = effectiveInterval(atk, cfgCmd);
    if (s.t < atk.atkReadyAt) return;
    atk.atkReadyAt = s.t + interval;

    emit(s.events, EV.ATTACK, atk.id, tgt.id, lane);

    if (PROJECTILE_ROLES[atk.role]) {
        spawnProjectile(s, atk, tgt, lane);
        return;
    }
    applyDamage(s, atk, tgt, lane, cfgCombat, cfgCmd);

    // 각인: 처형·넉백·상태이상 등 (아군 공격에만 적용)
    if (atk.isAlly && s.hooks.onAttack.length) {
        hookCtx.entity = atk;
        hookCtx.target = tgt;
        runHooks(s, HOOK.ON_ATTACK, hookCtx);
        hookCtx.entity = null;
        hookCtx.target = null;
    }
}

function spawnProjectile(s, atk, tgt, lane) {
    const p = acquireProjectile(s);
    if (!p) {
        // 풀 고갈. 프레임 드랍보다는 낫지만 **연출이 아니라 그 한 방이 사라지는 것**이라
        // 조용히 넘어가지 않는다 — `acquireProjectile` 이 stats.projectileDropped 를 센다.
        return;
    }
    p.isAlly = atk.isAlly;
    p.lane = lane;
    p.x = atk.x;
    p.vx = (tgt.x >= atk.x ? 1 : -1) * s.cfg.projectileSpeed;
    p.damage = atk.atk;
    p.dmgType = atk.dmgType;
    p.sourceId = atk.id;
    p.defId = atk.defId;
    // 오라 안 RANGED 는 관통. 별 트리(atk.pierce)와 각인으로 더 늘어난다.
    // ★ 관통 1 은 여기 박혀 있던 숫자였다 — 지금은 auraEffects.RANGED.pierceBonus 다 (절대규칙 4).
    p.pierce = auraPierceBonus(atk, s.cfg) + atk.pierce;

    // 각인: 관통·투사체 피해 보정
    if (atk.isAlly && s.hooks.projectileSpawn.length) {
        hookCtx.projectile = p;
        hookCtx.entity = atk;
        runHooks(s, HOOK.PROJECTILE_SPAWN, hookCtx);
        hookCtx.projectile = null;
        hookCtx.entity = null;
    }

    s.projectiles.push(p);
    emit(s.events, EV.PROJECTILE_SPAWN, p.id, atk.id, lane, p.vx > 0 ? 1 : 0);
}

/**
 * 실제 피해 적용. 투사체 명중에서도 호출된다.
 *
 * ★★ **크리티컬은 여기서 굴린다** (2026-08-04 구현).
 *   `balance.json:combat.critChance / critMult` 는 오래 전부터 있었고
 *   `18-ux-ui.md` §2.4 와 `19-art-audio-direction.md` 가 연출까지 규정해 두었는데,
 *   **그 값을 읽는 코드가 없었다** — 크리티컬은 한 번도 발생하지 않았다.
 *
 * ★ 굴림은 반드시 **시드 PRNG**(`s.rng.combat`)다. `Math.random()` 을 쓰면
 *   결정론이 깨져 밸런스 자동검증·리플레이가 전부 무의미해진다 (절대 규칙 1).
 *   `combat` 스트림은 이미 만들어져 있었고 아무도 쓰지 않았다.
 *
 * ★ 배율은 `mult` 에 곱해 넘긴다 — `computeDamage` 는 상성만 알면 되고
 *   크리티컬이 무엇인지 몰라도 된다.
 */
export function applyDamage(s, atk, tgt, lane, cfgCombat, cfgCmd, mult = 1) {
    const critChance = cfgCombat.critChance ?? 0;
    const crit = critChance > 0 && s.rng.combat() < critChance;
    const r = computeDamage(atk, tgt, cfgCombat, crit ? mult * (cfgCombat.critMult ?? 1) : mult);
    const taken = r.amount * damageTakenMult(tgt, cfgCmd);

    if (r.absorbed) {
        s.stats.damageBlocked += atk.atk;
        emit(s.events, EV.DAMAGE, tgt.id, 0, lane, 1);
        return;
    }

    tgt.hp -= taken;
    if (atk.isAlly) s.stats.damageDealt += taken;
    else s.stats.damageBlocked += 0;

    /**
     * ★★ **역할별 오라 효과 — 근접 처형 · 공성 밀어내기** (11-core-loop.md §4.2).
     *   근접 직격과 투사체 명중이 둘 다 이 함수를 지나므로 여기가 유일한 자리다.
     *   ★ 처형으로 죽인 HP 는 `damageDealt` 에 세지 않는다 — 각인 '처형'과 같은 규약.
     */
    if (atk.isAlly && !tgt.isAlly) applyAuraOnHit(atk, tgt, cfgCmd);

    /**
     * 각인: 피격 반응.
     * ★ `HOOK.ON_DAMAGE_TAKEN` 은 선언만 되어 있고 **아무도 부르지 않았다** —
     *   `sigils.js:HOOK` 에도 `validate-data.mjs:VALID_HOOKS` 에도 있어서
     *   그 훅을 쓰는 각인을 데이터에 적으면 예외도 경고도 없이 죽었을 것이다.
     *   이 저장소가 반복해서 당한 사고(선언만 있고 읽는 곳이 없다)라 여기서 잇는다.
     * ★ 규약: `entity` = 맞은 쪽, `target` = 때린 쪽.
     */
    if (s.hooks.onDamageTaken.length) {
        dmgCtx.entity = tgt;
        dmgCtx.target = atk;
        runHooks(s, HOOK.ON_DAMAGE_TAKEN, dmgCtx);
        dmgCtx.entity = null;
        dmgCtx.target = null;
    }

    emit(
        s.events,
        EV.DAMAGE,
        tgt.id,
        Math.round(taken),
        lane,
        // ★ 상성(약점·저항)이 크리티컬보다 먼저다 — 플레이어가 편성을 고치는 근거는
        //   상성이고, 크리티컬은 그날의 운이다. 둘 다일 때는 상성을 보여 준다.
        r.effective ? 2 : r.resisted ? 3 : crit ? 4 : 0,
        /**
         * ★★★ **때린 쪽의 데미지 타입** (2026-08-07).
         *
         *   이 값이 없던 동안 `BattleScene.onDamage` 는 `findEntity(e.a)` 로 **대상**을
         *   찾아 그 대상의 `dmgType` 으로 숫자 색과 색약 접두("물/술/신")를 골랐다.
         *   `e.a` 는 **맞은 쪽**의 id 이므로(바로 아래 `playHurt(e.a)` 가 그 증거다)
         *   지휘관의 물리 평타가 술식 적 위에서 **파란 숫자**로 떴다.
         *   `DamageTextPool` 이 "색약에게 상성 정보가 통째로 사라진다"며 만든 장치가
         *   정반대로 작동하고 있었다.
         *
         * ★ 큐는 문자열 슬롯(`s`)을 하나 갖고 있고 `EV.DAMAGE` 는 그것을 쓰지 않았다 —
         *   새 필드를 만들지 않고 그 자리를 쓴다 (틱당 할당 0 유지).
         */
        atk.dmgType
    );
}

/**
 * SUPPORT — ★ 오라 *밖*에서만 작동한다.
 * 이 반전이 "지휘관을 전선에 세워두면 끝"이라는 단일 최적해를 제거한다.
 */
function trySupport(s, u, allies, lane) {
    if (!auraActiveFor(u, s.cfg)) return; // 오라 안이면 비활성 (auraEffects.SUPPORT.inverted)
    if (s.t < u.atkReadyAt) return;

    // 사거리 안에서 HP 비율이 가장 낮은 아군을 찾는다
    let best = null;
    let bestRatio = 1;
    for (let i = 0; i < allies.length; i++) {
        const a = allies[i];
        if (a === u) continue;
        if (Math.abs(a.x - u.x) > u.range) continue;
        const ratio = a.hp / a.hpMax;
        if (ratio < bestRatio) {
            bestRatio = ratio;
            best = a;
        }
    }
    if (!best || bestRatio >= 1) return;

    u.atkReadyAt = s.t + u.atkInterval;
    const heal = u.atk;
    best.hp = Math.min(best.hpMax, best.hp + heal);
    emit(s.events, EV.HEAL, best.id, Math.round(heal), lane);
}

/** REGEN 태그 적의 지속 회복 — 버스트 딜을 요구하는 장치 */
export function stepRegen(s) {
    const dt = TICK_MS / 1000;
    const a = s.actives;
    for (let i = 0; i < a.length; i++) {
        const e = a[i];
        if (e.regenPerSec > 0 && e.hp < e.hpMax) {
            e.hp = Math.min(e.hpMax, e.hp + e.regenPerSec * dt);
        }
    }
}
