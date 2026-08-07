/**
 * BattleSfx — 시뮬 이벤트 → 효과음 (P3-14)
 *
 * ★ **별도 모듈로 둔다.** BattleScene 은 이미 900줄이고 이벤트 큐는 이 저장소에서
 *   가장 예민한 코드다(소비 커서 회귀 참조). 씬에 case 를 10개 더 심는 대신
 *   `dispatchEvent()` 첫 줄에서 이 객체에 이벤트를 그대로 넘긴다 —
 *   씬 쪽 추가는 총 4줄이고, 소리 배선이 늘어도 씬은 다시 안 건드린다.
 *
 * ★ 피치 씨앗은 **엔티티 id** 다. 같은 유닛의 연속 타격은 같은 높이로,
 *   다른 유닛은 다른 높이로 울린다. 시뮬의 시드 PRNG 는 건드리지 않는다
 *   (sfxGate.jitterPitch 주석 참조) — 결정론·리플레이가 여기에 걸려 있다.
 *
 * ★ 상성이 귀로도 구분되어야 한다. 물리·술식·신성은 서로 다른 소리이며,
 *   약점 적중(치명타)은 타격음 **위에 겹쳐** 울린다 — 화면의 노란 데미지
 *   숫자와 같은 순간, 같은 정보다.
 *
 * @see docs/02-design/19-art-audio-direction.md §6.3
 */
import { EV } from "../logic/events.js";
import { sfxEngine } from "./SfxEngine.js";
import { SFX, HIT_BY_DAMAGE_TYPE } from "./sfxKeys.js";

/** DAMAGE 이벤트의 d 필드 (engage.js applyDamage) */
const DMG_ABSORBED = 1;
const DMG_EFFECTIVE = 2;
/** 크리티컬 (2026-08-04 구현 — 그전까지 이 값은 발생하지 않았다) */
const DMG_CRIT = 4;

/** SPAWN·DEATH 의 c 필드 — 진영 */
const FACTION_ALLY = 1;

export class BattleSfx {
    /**
     * @param {(id:number) => object|null} findEntity 씬의 엔티티 조회
     *   (공격자의 데미지 타입은 이벤트에 실리지 않는다 — 큐를 넓히는 것보다
     *    이미 있는 조회를 빌리는 쪽이 싸다)
     */
    constructor(findEntity) {
        this.findEntity = findEntity;
        this.engine = sfxEngine;
    }

    /** 논리 키로 직접 재생 (마나 부족 등, 이벤트가 아닌 것) */
    play(key, seed = 0) {
        this.engine.play(key, seed);
    }

    /**
     * 이벤트 1건 → 소리.
     * ★ 이 함수는 틱마다 수십 번 불린다. 배열·문자열을 만들지 않는다 (절대규칙 7).
     */
    onEvent(e) {
        switch (e.type) {
            case EV.SPAWN:
                // 적 스폰은 소리 내지 않는다 — 웨이브마다 수십 마리다
                if (e.c === FACTION_ALLY) this.engine.play(SFX.SUMMON, e.a);
                break;

            case EV.ATTACK: {
                const atk = this.findEntity(e.a);
                const key = HIT_BY_DAMAGE_TYPE[atk?.dmgType];
                if (key) this.engine.play(key, e.a);
                break;
            }

            /**
             * ★★★ **지휘관 평타는 다른 이벤트를 쓴다** (2026-08-07 수정).
             *   동료 평타는 `EV.ATTACK` 이라 위 절이 타격음을 내는데, 지휘관은
             *   `EV.COMMANDER_ATTACK` 을 쓴다는 이유만으로 이 switch 에서 빠져
             *   있었다. 실측: 2-5 전선 전진 시 전투당 57번 휘두르는 동안
             *   **소리가 한 번도 나지 않았다.**
             * ★ 지휘관 평타의 데미지 타입은 언제나 물리다
             *   (`balance.json:commander.attack.dmgType` · 그것이 설계다 —
             *    술식·신성이면 지휘관이 상성 스테이지를 혼자 푼다).
             *   그래도 표를 거쳐 고른다 — 데이터가 바뀌면 소리도 따라가야 한다.
             */
            case EV.COMMANDER_ATTACK:
                this.engine.play(HIT_BY_DAMAGE_TYPE.physical, e.a);
                break;

            /** 주문 발동 — a=레인을 피치 씨앗으로 쓴다 (레인마다 미세하게 다른 높이) */
            case EV.SPELL_CAST:
                this.engine.play(SFX.COMMANDER_SPELL, e.a);
                break;

            case EV.COMMANDER_DOWN:
                this.engine.play(SFX.COMMANDER_DOWN, 0);
                break;

            case EV.COMMANDER_UP:
                this.engine.play(SFX.COMMANDER_UP, 0);
                break;

            case EV.DAMAGE:
                if (e.d === DMG_ABSORBED) this.engine.play(SFX.BLOCK, e.a);
                else if (e.d === DMG_EFFECTIVE || e.d === DMG_CRIT)
                    this.engine.play(SFX.HIT_CRITICAL, e.a);
                break;

            case EV.DEATH:
                this.engine.play(e.c === FACTION_ALLY ? SFX.DEATH_ALLY : SFX.DEATH_ENEMY, e.a);
                break;

            case EV.BREACH:
                this.engine.play(SFX.ARK_HIT, e.a);
                break;

            case EV.MODE_BOSS_TELEGRAPH:
                this.engine.play(SFX.BOSS_TELEGRAPH, e.a);
                break;

            case EV.MODE_BOSS_SLAM:
                this.engine.play(SFX.BOSS_SLAM, e.a);
                break;

            case EV.SIGIL_TAKEN:
                this.engine.play(SFX.SIGIL_PICK, e.a);
                break;

            case EV.EVOLUTION:
                this.engine.play(SFX.SIGIL_EVOLVE, e.a);
                break;

            default:
                break;
        }
    }

    /**
     * ★ 씬 shutdown 에서 반드시 부른다 (절대규칙 3).
     *   울리고 있던 전투음을 끊고 쿨다운 상태를 비운다 — 안 그러면 다음 판이
     *   이전 판의 쿨다운을 물려받아 첫 타격이 무음이 된다.
     */
    destroy() {
        this.engine.stopAll();
        this.findEntity = null;
    }
}
