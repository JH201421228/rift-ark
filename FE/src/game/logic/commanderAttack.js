/**
 * 지휘관 평타
 *
 * ★★★ **이것은 딜 수단이 아니라 미끼다.**
 *
 *   GDD §3 은 지휘관을 "직접 걸어 나가 **싸울 수 있는** 유일한 존재"라고 써 놓고,
 *   §4.4 의 스탯 목록에는 공격이 없었다. 플레이어 캐릭터가 전장 한가운데 서서
 *   아무것도 하지 않는 것이 기본값이었다.
 *
 *   그런데 평타를 그냥 세게 만들면 이 게임이 망가진다:
 *     · 설계결정 3 — 실력 천장이 '오라 운영'에서 '지휘관 조준'으로 옮겨간다
 *     · 설계결정 5 — 지휘관이 만능딜을 하면 편성이 틀려도 뚫린다 (벽이 퍼즐이 아니게 된다)
 *
 * ★★ 그래서 **사거리를 오라 반경보다 짧게** 만들었다. 이 부등식 하나가 설계 전부다:
 *
 *       평타 사거리(140) < 오라 반경(192)
 *
 *   평타를 넣으려면 오라의 앞쪽 절반을 적에게 내주는 자리까지 나가야 한다. 그러면
 *     · SUPPORT 가 죽는다 — 지원은 오라 *밖*에서만 작동한다 (GDD §4.4)
 *     · 지휘관이 맞기 시작한다 — 기절하면 8초간 오라가 통째로 사라진다
 *   딜을 얻고 힐과 안전을 잃는다. 판단할 것이 하나 **늘어난다.**
 *
 * ★ 공중을 때리지 않고 피해 타입이 물리인 것도 같은 이유다. 지휘관이 공중을 때리면
 *   1-6 "공중 — 방벽을 무시한다"가, 술식이면 1-5 "중장갑"이 편성 퍼즐이 아니게 된다.
 *
 * ★ 난수 없음 · Phaser 없음 (절대규칙 1). 조준은 "방주에 가장 가까운 적" 하나로
 *   결정되고, 크리티컬만 기존 공용 굴림(`s.rng.combat`)을 탄다.
 *
 * @see docs/02-design/20-commander-combat.md
 */
import { applyDamage } from "./engage.js";
import { emit, EV } from "./events.js";
import { commanderUp } from "./commanderHit.js";

/**
 * 지휘관이 자기 레인의 지상 적 하나를 때린다.
 *
 * ★ `stepCombat` **뒤**, `stepMovement` 앞에서 부른다 — 유닛 전투와 같은 틱 위상에
 *   두어야 "같은 틱에 두 번 맞는" 순서 의존이 생기지 않는다.
 *
 * @param {object} s 시뮬 상태
 */
export function stepCommanderAttack(s) {
    const atkCfg = s.cfg.commanderAttack;
    if (!atkCfg || !(atkCfg.damage > 0)) return;

    const c = s.commander;
    // 기절 중에는 때리지 않는다 — 기절 페널티가 '오라 상실'만이 아니게 된다
    if (!commanderUp(s)) return;
    if (s.t < c.atkReadyAt) return;

    const lane = s.lanes[c.lane];
    if (!lane) return;
    const enemies = lane.enemies;
    if (!enemies.length) return;

    /**
     * ★ 조준: 사거리 안에서 **방주에 가장 가까운 적**(x 최소).
     *   "가장 급한 적"이라는 직관과 결정론이 같은 답을 낸다.
     *   ★ 배열 생성·정렬을 하지 않는다 (절대규칙 7) — 한 번 훑어 최소값만 든다.
     */
    let tgt = null;
    for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (e.hp <= 0) continue;
        if (Math.abs(e.x - c.x) > atkCfg.range) continue;
        if (tgt === null || e.x < tgt.x) tgt = e;
    }
    if (!tgt) return;

    c.atkReadyAt = s.t + atkCfg.intervalMs;

    /**
     * ★ 합성 공격자. 지휘관은 `s.actives` 의 엔티티가 아니므로 `applyDamage` 가 읽는
     *   세 필드만 갖춘 객체를 넘긴다 (`atk` · `dmgType` · `isAlly`).
     *   ★ 매 틱 새 객체를 만들지 않는다 (절대규칙 7) — 모듈 스코프에서 재사용한다.
     */
    attacker.atk = atkCfg.damage;
    attacker.dmgType = atkCfg.dmgType;

    emit(s.events, EV.COMMANDER_ATTACK, tgt.id, c.lane, Math.round(c.x));
    applyDamage(s, attacker, tgt, c.lane, s.cfg.combat, s.cfg);
}

/** 재사용되는 합성 공격자 (절대규칙 7 — 매 틱 할당 금지) */
const attacker = { atk: 0, dmgType: "physical", isAlly: true };
