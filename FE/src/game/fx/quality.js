/**
 * 품질 티어 — "이 기기에서 무엇을 줄일 것인가"의 단 하나의 문
 *
 * ★★ **이 파일이 생기기 전까지 `settings.qualityTier` 는 거짓말이었다.**
 *   `settings.json` 에 키가 있고 `settingsSlice` 가 저장하고 세이브에 실려 다녔는데
 *   **읽는 코드가 한 줄도 없었다.** 화면에 노출하지 않은 것만이 유일한 방어였고
 *   (`SettingsScreen` 주석: "배선되는 날 여기에 붙인다"), 그 상태가 티켓 하나만큼
 *   오래 갔다. 아무것도 하지 않는 설정은 기능이 아니라 거짓말이다.
 *
 * ★ 값은 `src/game/data/quality.json` 이 갖는다 (절대규칙 4의 정신).
 *   여기 있는 것은 **배선**뿐이다 — 어떤 설정이 어떤 티어로 풀리는가, 그리고
 *   그 티어를 누가 읽는가.
 *
 * ★ 이 표의 어떤 값도 전투 결과를 바꾸지 않는다. 성능 예산이지 밸런스가 아니다.
 *   그래서 `balance.json` 이 아니고, `balance:check` 도 이 파일을 보지 않는다.
 *
 * @see docs/03-tech/26-performance-budget.md §4
 * @see src/store/slices/settingsSlice.js 의 배선표
 */
import QUALITY_DATA from "../data/quality.json" with { type: "json" };
/**
 * ★ `config.js` 가 아니라 `device.js` 에서 받는다. 같은 값이지만 `config.js` 는
 *   `phaser` 를 끌고 오고, 이 모듈은 순수하게 유지되어야 테스트가 브라우저
 *   환경 없이 돈다 (vitest environment: node).
 */
import { IS_LOW_END } from "../device.js";

/** 티어 표 — `{ effects, dmgText, shake, bgLayers }` */
export const QUALITY_TIERS = QUALITY_DATA.tiers;

/**
 * 발사체 스프라이트 풀 크기 — **티어 손잡이가 아니다.**
 *
 * ★★ 몇 개가 날고 있는지는 기기가 아니라 시뮬이 정한다. 저사양에서 이 값을
 *   줄여도 일은 줄지 않는다 — `SpritePool` 은 마르면 `grow()` 하지 않고
 *   가장 오래된 활성분을 회수하므로, 줄이면 **날아가던 발사체가 소리 없이
 *   사라질 뿐**이다. 티어로 줄일 수 있는 것은 이펙트·데미지 숫자처럼
 *   "있어도 되고 없어도 되는 것"뿐이다.
 */
export const PROJECTILE_POOL = QUALITY_DATA.projectilePool;

/** 자동이 아닌 실제 티어 이름들 */
export const TIER_NAMES = Object.keys(QUALITY_TIERS);

/** 표가 비어 있으면 아무것도 배선되지 않은 것이므로 여기서 멈추는 편이 낫다 */
const FALLBACK = "high";

/**
 * 설정값 → 실제 티어 이름.
 *
 * ★ `auto` 는 티어가 아니라 **위임**이다. 렌더러 선택과 **같은 판정**(`IS_LOW_END`)을
 *   쓴다 — 한 기기가 "Canvas 로 부팅할 만큼 낮은데 그래픽은 최고"인 상태는
 *   설명할 수 없고, 판정을 둘로 두면 반드시 갈라진다.
 *
 * ★ 알 수 없는 값은 조용히 `high` 로 떨어진다. 손상된 세이브가 전투를 못 열게
 *   만들지 않는다 (`normalizeSettings` 가 이미 한 번 걸러 주지만, 이 함수는
 *   스토어 없이 부르는 자리도 있다).
 *
 * @param {string} [setting] `settings.qualityTier`
 * @param {boolean} [lowEnd] 테스트가 기기 판정을 주입할 수 있게 열어 둔다
 * @returns {'high'|'medium'|'low'}
 */
export function resolveTier(setting, lowEnd = IS_LOW_END) {
    if (setting === "auto" || setting == null) return lowEnd ? "low" : FALLBACK;
    return setting in QUALITY_TIERS ? setting : FALLBACK;
}

/**
 * 설정값 → 예산 표.
 * @param {string} [setting]
 * @param {boolean} [lowEnd]
 * @returns {{effects: number, dmgText: number, shake: number, bgLayers: number}}
 */
export function qualityOf(setting, lowEnd = IS_LOW_END) {
    return QUALITY_TIERS[resolveTier(setting, lowEnd)] ?? QUALITY_TIERS[FALLBACK];
}
