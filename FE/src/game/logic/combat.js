/**
 * 데미지 계산
 *
 * 물리 / 술식 / 신성 세 타입이 서로 **성격이 다른 방어 스탯**을 상대한다.
 *   물리 : DEF 로 절대 감산  → 고DEF 저HP 는 다단히트에 강하고 큰 한 방에 약함
 *   술식 : DEF 완전 무시, RES 로 비율 감산 → 장갑을 뚫는 유일한 답
 *   신성 : RES 감산 + CORRUPT ×1.6 / LIVING ×0.7 → 언데드·악마 특효, 그 외 페널티
 *
 * ★ 최소 피해 10% 보장:
 *   "내 유닛이 아무것도 안 한다"는 좌절을 막는다. 다만 10% 는 사실상 무력하므로
 *   상성은 여전히 결정적이다.
 *
 * @see docs/02-design/11-core-loop.md §3.1
 */
import { TAG } from "./tags.js";

/** 계산 결과를 담는 out 파라미터 — 틱당 힙 할당 0 을 위해 객체를 재사용한다 */
export const dmgResult = { amount: 0, absorbed: false, effective: false, resisted: false };

/**
 * REGEN 태그의 초당 회복량.
 *
 * ★★ 거대화(giant)에는 다른 비율을 쓴다.
 *   "최대 HP 의 2%" 는 비율 규칙이라 **HP 배율과 곱해지는 순간 깨진다.**
 *   HP 배율 32 를 받은 월드 3 보스가 회복 192,748/s 가 되어 어떤 편성으로도
 *   죽지 않는 소프트락이 됐다 (실측). 거대화는 HP 배율이지 회복 배율이 아니다.
 *
 * @param {object} cfgCombat balance.combat
 * @param {number} tagMask
 * @param {number} hpMax
 * @param {boolean} isGiant
 */
export function regenPerSec(cfgCombat, tagMask, hpMax, isGiant) {
    if ((tagMask & TAG.REGEN) === 0) return 0;
    const ratio = isGiant
        ? (cfgCombat?.regenRatioGiant ?? 0.0025)
        : (cfgCombat?.regenRatio ?? 0.02);
    return hpMax * ratio;
}

/**
 * @param {import('./types.js').Entity} atk
 * @param {import('./types.js').Entity} tgt
 * @param {object} cfg  balance.combat
 * @param {number} [mult] 각인·버프 배율
 * @returns {typeof dmgResult} 재사용되는 객체 — 즉시 소비할 것
 */
export function computeDamage(atk, tgt, cfg, mult = 1) {
    const r = dmgResult;
    r.absorbed = false;
    r.effective = false;
    r.resisted = false;

    // SHIELDED: 첫 N회 피해를 통째로 무효화한다. 다단히트가 답.
    if (tgt.shield > 0) {
        tgt.shield--;
        r.amount = 0;
        r.absorbed = true;
        return r;
    }

    const power = atk.atk * mult;
    const floor = power * cfg.minDamageRatio;
    let dmg;

    switch (atk.dmgType) {
        case "physical":
            dmg = power - tgt.def;
            break;

        case "arcane":
            // ★ DEF 를 완전히 무시한다
            dmg = power * (1 - tgt.res / 100);
            break;

        case "holy": {
            const base = power * (1 - tgt.res / 100);
            const mulHoly = (tgt.tags & TAG.CORRUPT) !== 0
                ? cfg.holyMultCorrupt
                : (tgt.tags & TAG.LIVING) !== 0
                  ? cfg.holyMultLiving
                  : 1;
            dmg = base * mulHoly;
            r.effective = mulHoly > 1;
            break;
        }

        default:
            dmg = power;
    }

    if (dmg <= floor) {
        // 상성 불일치 — UI 가 "저항!" 을 띄우는 근거
        r.amount = floor;
        r.resisted = true;
    } else {
        r.amount = dmg;
    }

    // 술식이 ARMORED 를 뚫었을 때도 "약점!" 으로 표시한다
    if (atk.dmgType === "arcane" && (tgt.tags & TAG.ARMORED) !== 0) r.effective = true;
    if (atk.dmgType === "physical" && (tgt.tags & TAG.WARDED) !== 0) r.effective = true;

    return r;
}

/**
 * 공중에 닿는가 — **사거리가 아니라 자격**의 문제다.
 *
 * ★ 이 명제가 `canTarget` 안에만 있으면 시뮬 밖에서는 알 수 없다. 실제로
 *   추천 편성이 `WARDED` 의 답으로 **근접 물리**를 골랐는데 그 스테이지의
 *   WARDED 적이 전부 비행이라, 답이 표적에 영원히 닿지 못한 적이 있다
 *   (5-15 · 5-19 벽, 2026-08-03). 편성을 판단하는 쪽도 같은 명제를 물어야 한다.
 *
 * @param {number} tagMask 공격자 태그 비트마스크
 * @param {string} dmgType 공격자 데미지 타입
 */
export function canHitFlying(tagMask, dmgType) {
    return (tagMask & TAG.ANTI_AIR) !== 0 || dmgType !== "physical";
}

/**
 * 공격 대상이 될 수 있는가.
 * ★ FLYING 은 ANTI_AIR 를 가진 유닛만 때릴 수 있다 — 대공 수단이 없으면
 *   비행 웨이브를 아예 처리하지 못한다는 구조적 요구가 여기서 나온다.
 */
export function canTarget(attacker, target) {
    if ((target.tags & TAG.FLYING) === 0) return true;
    return canHitFlying(attacker.tags, attacker.dmgType);
}
