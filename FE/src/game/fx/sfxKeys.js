/**
 * 효과음 논리 키 (P3-14)
 *
 * ★ 코드는 이 상수만 쓴다. 문자열 리터럴을 여기저기 흩어 두면 오타 하나가
 *   "그 소리만 안 나는" 무증상 버그가 되고, 아무도 알아채지 못한다.
 *   (fx.json 의 이펙트 이름이 겪었던 문제와 같다 — 절대규칙 5)
 *
 * ★ 이 목록과 `src/game/data/sfx.json` 의 `sounds` 는 **정확히 같아야 한다.**
 *   `tools/validate-data.mjs` 와 `sfxKeys.test.js` 가 양방향으로 대조한다:
 *   정의 없는 키(무음 버그)도, 아무도 안 쓰는 정의(죽은 데이터)도 오류다.
 *
 * ★ 이 파일은 의존성이 0이다. Node 스크립트(validate-data)가 별칭 해석 없이
 *   그대로 import 할 수 있어야 한다.
 *
 * @see docs/02-design/19-art-audio-direction.md §6.3
 */
export const SFX = Object.freeze({
    /* ── 전투 타격 ── */
    HIT_PHYSICAL: "hit.physical",
    HIT_ARCANE: "hit.arcane",
    HIT_HOLY: "hit.holy",
    HIT_CRITICAL: "hit.critical",
    BLOCK: "combat.block",

    /* ── 사망 · 방주 ── */
    DEATH_ALLY: "unit.death_ally",
    DEATH_ENEMY: "unit.death_enemy",
    ARK_HIT: "ark.hit",

    /* ── 보스 ── */
    BOSS_TELEGRAPH: "boss.telegraph",
    BOSS_SLAM: "boss.slam",

    /**
     * ── 지휘관 (2026-08-07) ──
     * ★★ 셋 다 시뮬은 오래전부터 이벤트를 내고 있었고 **듣는 쪽이 없었다.**
     *   주문은 성공하면 무음이고 실패해야만 마나 부족음이 났으며, 지휘관이
     *   쓰러지는 순간에도 소리가 없었다. 평타는 `EV.COMMANDER_ATTACK` 이라는
     *   **다른 이벤트**를 쓴다는 이유만으로 동료 평타의 타격음에서 빠져 있었다.
     */
    COMMANDER_SPELL: "commander.spell",
    COMMANDER_DOWN: "commander.down",
    COMMANDER_UP: "commander.up",

    /* ── 소환 · 성장 ── */
    SUMMON: "unit.summon",
    MANA_SHORT: "unit.mana_short",
    SIGIL_PICK: "sigil.pick",
    SIGIL_EVOLVE: "sigil.evolve",
    LEVEL_UP: "meta.level_up",

    /* ── UI ── */
    UI_TAP: "ui.tap",
    UI_TRANSITION: "ui.transition",
    UI_PURCHASE: "ui.purchase",
    UI_REWARD: "ui.reward",
    UI_WARN: "ui.warn",

    /* ── 결과 ── */
    VICTORY: "result.victory",
    DEFEAT: "result.defeat",
});

/** 데미지 타입 → 타격음. 상성이 귀로도 구분되어야 한다 */
export const HIT_BY_DAMAGE_TYPE = Object.freeze({
    physical: SFX.HIT_PHYSICAL,
    arcane: SFX.HIT_ARCANE,
    holy: SFX.HIT_HOLY,
});

/** 정의되어야 하는 모든 논리 키 */
export const ALL_SFX_KEYS = Object.freeze(Object.values(SFX));
