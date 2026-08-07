/**
 * 자원 — 마나 · 균열력 · 소환 코스트
 *
 * ★ 소환 코스트는 **유닛 타입별로** 상승한다 (전역이 아니다).
 *   전역이면 "다양화"가 벌이 되지만, 타입별이면 다양화가 자연스러운 반격이 된다.
 *   그리고 그게 정확히 가르치고 싶은 행동이다.
 *
 * ★ 12초 감쇠가 있어 완전 봉쇄가 아니라 리듬 강제다.
 *   후반 올인 스팸은 여전히 가능하되 비싸다.
 *
 * @see docs/02-design/11-core-loop.md §2
 */
import { TICK_MS } from "./tick.js";

export function stepResources(s) {
    const dt = TICK_MS / 1000;
    // ★ 각인 배율은 **두 구간 모두에** 곱해진다. 한쪽에만 걸면 템포 시프트가
    //   각인을 통째로 지운다 (마나 샘이 그랬다 — sigils.js:mulManaRegen 참조).
    const base = s.tempoShifted ? s.cfg.manaRegenTempo : s.cfg.manaRegenBase;
    const regen = base * s.mods.manaRegenMult;

    s.mana = Math.min(s.manaMax, s.mana + regen * dt);
    s.riftEnergy = Math.min(s.riftMax, s.riftEnergy + s.cfg.riftRegenBase * dt);

    /**
     * 소환 코스트 감쇠: 타입별 카운트를 12초마다 1 낮춘다.
     *
     * ★ 감쇠를 통째로 끌 수 있다 (`cfg.summonDecayEnabled`). 이 파일은 **왜** 꺼졌는지
     *   모른다 — 설정이 정한다. 그래야 전투 코드에 난이도 분기가 생기지 않는다.
     *   (나이트메어 ③ 고갈이 그것을 끈다. 22-nightmare.md §4)
     */
    if (s.cfg.summonDecayEnabled === false) return;

    const counts = s.summonCounts;
    const decay = s.summonDecayAt;
    for (const id in counts) {
        if (counts[id] > 0 && s.t >= decay[id]) {
            counts[id]--;
            decay[id] = s.t + s.cfg.summonDecayMs;
        }
    }
}

/**
 * 현재 소환 코스트. base × 1.18^n × 메타 배율
 *
 * ★ 메타 배율은 곱셈으로만 들어온다. 상승 지수(1.18^n)를 건드리면
 *   "같은 유닛 스팸 억제"(B6)가 메타 성장에 따라 무너진다.
 *
 * @param {string} unitId
 * @param {number} baseCost
 */
export function summonCost(s, unitId, baseCost) {
    const n = s.summonCounts[unitId] ?? 0;
    const mult = s.cfg.summonCostMult ?? 1;
    return Math.max(1, Math.ceil(baseCost * Math.pow(s.cfg.summonCostGrowth, n) * mult));
}

/**
 * 소환 성공 시 카운트를 올린다.
 *
 * ★★ **떼 유닛은 마릿수만큼 오른다** (2026-08-05). 한 번의 탭이지만
 *   전장에 서는 몸은 `squad` 개다 — 카운트를 1 만 올리면 **마릿수당 억제가
 *   1/squad 로 옅어진다.**
 *
 *   실제로 그렇게 만들었다가 하드 게이트 B6("단일 유닛 스팸 ≤ 다양화 편성")이
 *   3-5 에서 무너졌다. 하네스의 `spam_cheapest` 편성이 쓰는 최저가 딜러가
 *   바로 꼬꼬댁 닭(코스트 9 · squad 3)이기 때문이다.
 *
 * ★ 그래도 **탭 한 번 = 소환 한 번**이라는 규약은 그대로다. 사용자가 본 사고
 *   (3 → 2 → 1 마리)는 *탭 안에서* 코스트가 오르며 마나가 말라붙어 생긴 것이고,
 *   그것은 `spawn.js:trySummon` 이 총액을 한 번에 받는 것으로 이미 사라졌다.
 *   여기서 오르는 것은 **다음 탭의** 가격이다.
 *
 * @param {number} [count] 이번 소환으로 전장에 선 몸의 수
 */
export function registerSummon(s, unitId, count = 1) {
    const add = Math.max(1, Math.floor(count));
    const n = (s.summonCounts[unitId] ?? 0) + add;
    s.summonCounts[unitId] = n;
    // 감쇠 타이머는 첫 소환 때만 건다 (연속 소환이 타이머를 리셋하지 않게)
    if (n === add || s.summonDecayAt[unitId] === undefined) {
        s.summonDecayAt[unitId] = s.t + s.cfg.summonDecayMs;
    }
}

/**
 * 처치 환급 — 공격적 플레이가 스스로를 먹여 살리게 한다.
 * ★ 골드가 아니라 마나를 준다. 골드를 전투 시간에 연동하면
 *   "일부러 천천히 죽여 파밍" 최적해가 생긴다 (카툰워즈의 실패).
 */
export function applyKillRefund(s, enemy) {
    s.mana = Math.min(s.manaMax, s.mana + Math.floor(enemy.cost * s.cfg.killRefundRatio));
    s.riftEnergy = Math.min(s.riftMax, s.riftEnergy + s.cfg.riftPerKill);
}
