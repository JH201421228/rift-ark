/**
 * 지휘관 오라
 *
 * 이 게임의 시그니처 메커니즘.
 * **동료의 특수능력은 오라 안에서만 발동한다.** 그리고 역할마다 의존 방식이 다르다.
 *
 * ★ SUPPORT 만 반대로 작동한다 — 오라 *밖*에서만 힐/버프가 나간다.
 *   이 하나가 "지휘관을 전선에 세워두면 끝"이라는 단일 최적해를 제거한다.
 *   힐러를 쓰는 편성은 지휘관을 앞에 두고, 안 쓰는 편성은 자유롭다.
 *   → 편성이 조작 스타일을 결정한다.
 *
 * @see docs/02-design/11-core-loop.md §4.2
 */
import { LANE_COUNT, AIR_LANE } from "./state.js";
import { commanderUp } from "./commanderHit.js";

/**
 * 매 틱 inAura 플래그를 갱신한다.
 * 오라는 원형이며 **레인을 가로지른다** — 인접 레인 일부가 포함되므로
 * 지휘관 위치가 진짜 판단이 된다.
 */
export function stepAura(s) {
    const c = s.commander;
    const laneY = s.cfg.laneY;
    // ★ 술어는 `commanderHit.js:commanderUp` 하나다 (2026-08-05). 여기는 시간 항만
    //   보고 있었는데, 그것이 맞았던 이유는 `stepCommander` 가 바로 앞에서 도는
    //   **순서 덕분**이었다 — 순서가 바뀌면 조용히 틀린다.
    const active = commanderUp(s);
    const r2 = c.auraRadius * c.auraRadius;
    const cy = laneY[c.lane];

    for (let li = 0; li < LANE_COUNT; li++) {
        const dy = laneY[li] - cy;
        const dy2 = dy * dy;
        const list = s.lanes[li].allies;
        for (let i = 0; i < list.length; i++) {
            const u = list[i];
            if (!active) {
                u.inAura = false;
                continue;
            }
            const dx = u.x - c.x;
            u.inAura = dx * dx + dy2 <= r2;
        }
    }

    // 공중 아군은 지휘관 레인과의 수직 거리를 airY 기준으로 잰다
    const airDy = s.cfg.airY - cy;
    const airDy2 = airDy * airDy;
    const air = s.lanes[AIR_LANE].allies;
    for (let i = 0; i < air.length; i++) {
        const u = air[i];
        if (!active) {
            u.inAura = false;
            continue;
        }
        const dx = u.x - c.x;
        u.inAura = dx * dx + airDy2 <= r2;
    }
}

/**
 * 역할별 오라 보정을 조회한다.
 * ★ SUPPORT 는 inverted — 오라 밖에서 활성화된다.
 *
 * ★★ **반전 역할은 데이터가 정한다** (`auraEffects.SUPPORT.inverted`).
 *   예전에는 이 함수가 `"SUPPORT"` 를 코드에 박고 있었고, 그래서 데이터의
 *   `inverted: true` 는 **아무도 읽지 않는 필드**였다 — 그 값을 false 로 바꿔도
 *   게임은 하나도 달라지지 않았다. 같은 사실이 두 곳에 적히면 갈라진다.
 *
 * @param {object} unit
 * @param {object} cfg 시뮬 설정. **반드시 넘긴다** — 빠뜨리면 SUPPORT 의 반전이
 *   조용히 사라져 힐러가 오라 안에서 작동한다 (설계 의도의 정반대).
 */
export function auraActiveFor(unit, cfg) {
    if (cfg?.auraEffects?.[unit.role]?.inverted) return !unit.inAura;
    return unit.inAura;
}

/** 오라 안 BLOCKER 는 블록 슬롯이 1 늘어난다 */
export function effectiveBlockCount(unit, cfg) {
    if (unit.role !== "BLOCKER") return 0;
    const bonus = unit.inAura ? (cfg.auraEffects.BLOCKER.blockBonus ?? 0) : 0;
    return unit.blockCount + bonus;
}

/** 오라 안 BLOCKER 는 받는 피해가 줄어든다 */
export function damageTakenMult(unit, cfg) {
    if (unit.role === "BLOCKER" && unit.inAura) {
        return cfg.auraEffects.BLOCKER.damageTakenMult ?? 1;
    }
    return 1;
}

/** 오라 안 RANGED 는 사거리가 늘어난다 */
export function effectiveRange(unit, cfg) {
    if (unit.role === "RANGED" && unit.inAura) {
        return unit.range * (cfg.auraEffects.RANGED.rangeMult ?? 1);
    }
    return unit.range;
}

/** 오라 안 CASTER 는 쿨다운이 줄어든다 */
export function effectiveInterval(unit, cfg) {
    if (unit.role === "CASTER" && unit.inAura) {
        return unit.atkInterval * (cfg.auraEffects.CASTER.cooldownMult ?? 1);
    }
    return unit.atkInterval;
}

/** 오라 안 RANGED 는 투사체가 관통한다 (설계 표: '관통 또는 사거리 +30%' — 둘 다 준다) */
export function auraPierceBonus(unit, cfg) {
    if (unit.role !== "RANGED" || !auraActiveFor(unit, cfg)) return 0;
    return cfg.auraEffects.RANGED?.pierceBonus ?? 0;
}

/**
 * ★★★ **오라 안 MELEE 는 처형한다** (2026-08-05 배선).
 *
 *   `docs/02-design/11-core-loop.md` §4.2 · GDD §4.4 의 역할별 오라 표는
 *   `MELEE | 특수 효과 발동 (넉백/처형/연쇄) | 평타만` 이라고 적어 두었고
 *   `balance.json` 에는 그 자리에 `special: true` 만 있었다.
 *   **그 값을 읽는 코드가 없었다** — 근접 동료는 오라 안팎이 완전히 같았다.
 *   (FLYER 의 `canHitGround` 가 2026-08-05 까지 당한 것과 같은 사고다.)
 *
 * ★ 셋 중 **처형**을 골랐다. 넉백은 SIEGE 의 칸(`pushPower`)이고, 근접에까지 주면
 *   방벽이 붙든 적의 간격이 매 틱 흔들려 스티키 블록이 풀린다. 연쇄는 레인당
 *   타겟을 하나 더 찾아야 해서 병합 스윕의 O(n+m) 을 깬다.
 * ★ 임계는 각인 '처형'(0.18 · 역할 무관 · 상시)보다 낮다. 그래야 각인이
 *   여전히 고를 값이 있다 (§5.3 "아무 일도 하지 않는 선택지" 경고).
 *
 * @returns {number} 대상 HP 비율 임계. 0 이면 처형 없음.
 */
export function auraExecuteThreshold(unit, cfg) {
    if (unit.role !== "MELEE" || !auraActiveFor(unit, cfg)) return 0;
    return cfg.auraEffects.MELEE?.execThreshold ?? 0;
}

/**
 * ★★★ **오라 안 SIEGE 는 적을 밀어낸다** (2026-08-05 배선).
 *
 *   설계 표의 `SIEGE | 방주 방향 밀어내기 강화 | 기본` 이 그 자리이고,
 *   여기도 `special: true` 하나뿐이라 4개월간 아무 일도 하지 않았다.
 *   '오라 안' 칸은 언제나 **강화**이므로, 미는 방향은 방주에서 멀어지는 쪽
 *   (= 균열 쪽, +x)이다. 방주 쪽으로 미는 것은 강화가 아니라 자해다.
 *
 * ★ 적용은 `movement.js` 가 한다 — 여기서 x 를 직접 밀면 레인 배열의 x 정렬이
 *   틱 중간에 깨지고, 다음 틱의 병합 스윕(`engage.js`)이 잘못된 이웃을 본다.
 *
 * @returns {number} 한 대당 밀어내는 px. 0 이면 밀어내기 없음.
 */
export function auraPushPower(unit, cfg) {
    if (unit.role !== "SIEGE" || !auraActiveFor(unit, cfg)) return 0;
    return cfg.auraEffects.SIEGE?.pushPower ?? 0;
}

/**
 * 아군 한 대가 적에게 들어갔을 때의 **역할별 오라 효과**를 적용한다.
 * `engage.js:applyDamage` 가 유일한 호출부다 — 근접 직격과 투사체 명중이
 * 둘 다 그곳을 지나므로, 여기 한 곳에 두면 역할별로 갈라지지 않는다.
 *
 * ★ 시뮬 상태(`s`)를 받지 않는다. 이 함수가 하는 일은 **대상 하나를 고치는 것**
 *   뿐이고, 위치 변경조차 `pushX` 로 예약만 한다 (`movement.js` 가 소비한다).
 *
 * @param {object} atk 공격자 (아군). 합성 공격자면 role 이 없을 수 있다
 * @param {object} tgt 대상 (적)
 * @param {object} cfg 시뮬 설정
 */
export function applyAuraOnHit(atk, tgt, cfg) {
    if (!cfg.auraEffects || tgt.hp <= 0) return;

    // 근접 처형 — 남은 HP 가 임계 이하이면 즉시 처치 (사망 처리는 stepDeaths 가 한다)
    const exec = auraExecuteThreshold(atk, cfg);
    if (exec > 0 && tgt.hp <= tgt.hpMax * exec) {
        tgt.hp = 0;
        return; // 죽은 적을 밀어낼 이유가 없다
    }

    /**
     * 공성 밀어내기 — **다음 이동 스텝에서** 적용된다 (`movement.js`).
     * ★ 붙들린 적에게는 쌓지 않는다. `stepBlocking` 이 `gap > b.range` 로 블록을
     *   푸는데, 밀어내면 그 간격이 바로 넘어가 **용량 안의 적이 풀려난다** —
     *   2026-08-04 에 고친 "방벽을 간헐적으로 넘어간다"가 그대로 재발한다.
     */
    const push = auraPushPower(atk, cfg);
    if (push > 0 && tgt.blockedBy === -1) tgt.pushX += push;
}
