/**
 * 보상형 광고 — **규칙** (2026-08-07)
 *
 * ★★★ **이 파일은 "광고를 볼 수 있는가" 와 "보면 얼마를 받는가" 만 안다.**
 *   광고를 *띄우는* 것은 `native/ads.js`, 시청 기록은 `store/slices/metaSlice.js`(meta.ads),
 *   수치는 `game/data/ads.json` 이다. 넷을 나눈 이유는 하나다 — 이 규칙이
 *   **순수해야 `npm run economy` 하네스가 광고를 켠 곡선을 계산할 수 있다.**
 *   경제 검증이 광고를 모르면, 광고가 경제를 망가뜨려도 아무도 실패하지 않는다.
 *
 * ★ 순수 함수다 — `Math.random()` · `Date.now()` · DOM · Phaser 가 없다 (절대 규칙 1).
 *   "지금"이 필요한 판정은 **호출자가 시각을 넘긴다.** 그래야 하네스가 하루를
 *   앞뒤로 돌려 가며 상한을 검증할 수 있다.
 *
 * ★ 수치는 하나도 여기 없다 — 전부 `data/ads.json` (절대 규칙 4).
 *
 * ★★ **확률형이 아니다.** 광고를 보면 **반드시** 정해진 배수를 받는다 (절대 규칙 6).
 *   "광고를 보면 확률로 더 준다"는 형태를 만들지 않는다 — 그 순간 이 게임이
 *   구조적으로 소멸시킨 확률 공개 의무가 되살아난다.
 *
 * @see docs/06-release/56-admob-rewarded-integration.md
 * @see docs/06-release/55-monetization-decision.md (왜 위험한지의 계산)
 */
import DATA from "../data/ads.json" with { type: "json" };
import { globalStageIndex } from "./difficulty.js";

export const AD_ENABLED = DATA.enabled === true;
export const AD_REWARD_MULT = DATA.rewardMult;
export const AD_DAILY_VIEWS = DATA.dailyViews;
export const AD_COOLDOWN_MS = DATA.cooldownMs;

/**
 * 하루 상한이 **없는가** (`dailyViews <= 0` = 무제한, 2026-08-08 사용자 결정).
 *
 * ★★★ **무제한을 "아주 큰 숫자"로 흉내 내지 않는다.** 999 같은 값을 넣으면
 *   `viewsLeft` 가 "오늘 999회 남음"을 화면에 그리고, 하네스는 그것을 상한으로
 *   착각해 계산하며, 검사기는 여전히 "상한이 있다"고 통과시킨다. **셋 다 거짓말이다.**
 *   무제한은 **상태이지 숫자가 아니다** — 그래서 술어로 만든다.
 *
 * ★★ 무제한이 되면 남는 유일한 제동 장치는 **쿨다운**(`cooldownMs`)이다.
 *   그 값이 0 이면 결과 화면에서 연타로 무한히 받을 수 있다.
 */
export const AD_UNLIMITED = !(Number(DATA.dailyViews) > 0);

/**
 * 시청 기록의 하루 경계를 만드는 키.
 *
 * ★★ 서버가 없으므로 **기기 로컬 자정**이 유일한 경계다. `Date` 를 여기서 만들지
 *   않고 호출자가 넘긴 ms 를 나누는 이유는 절대 규칙 1 이다 — 그리고 그 덕에
 *   테스트가 "자정을 넘겼다"를 인자 하나로 만들 수 있다.
 * ★ UTC 가 아니라 **로컬** 자정이어야 한다. UTC 로 자르면 한국(UTC+9)에서
 *   오전 9시에 상한이 초기화되어 "하루"가 사용자의 하루와 어긋난다.
 *
 * @param {number} nowMs
 * @param {number} tzOffsetMin `new Date().getTimezoneOffset()` (분, UTC 기준 역부호)
 */
export function dayKey(nowMs, tzOffsetMin = 0) {
    return Math.floor((nowMs - tzOffsetMin * 60_000) / 86_400_000);
}

/**
 * 오늘 이미 본 횟수 — **손상된 값을 관대한 쪽으로 읽지 않는다.**
 *
 * ★★★ 검사가 잡은 실제 구멍이다 (2026-08-07). `views: -99` 인 세이브를 그대로
 *   빼면 남은 횟수가 **105회**가 된다 — 손상이 상한을 *푸는* 방향으로 작동했다.
 *   상한은 경제를 지키는 유일한 장치이므로(`ads.json:_dailyViewsDoc`),
 *   읽는 쪽에서도 한 번 더 막는다. `normalizeMeta` 가 이미 `nonNegInt` 로 거르지만,
 *   이 모듈은 **하네스도 직접 부른다** — 스토어를 지나지 않는 경로가 있다.
 * ★ 숫자가 아닌 값(문자열·null)은 0 으로 읽는다. "알 수 없으면 안 본 것"이 아니라
 *   "알 수 없으면 안전한 쪽"이며, 여기서는 둘이 같다.
 */
function takenToday(state, today) {
    if (!state || state.day !== today) return 0;
    const v = Number(state.views);
    if (!Number.isFinite(v) || v <= 0) return 0;
    // ★ 무제한이면 clamp 할 상한이 없다 — 그대로 센다 (표시용으로만 쓰인다)
    return AD_UNLIMITED ? Math.floor(v) : Math.min(AD_DAILY_VIEWS, Math.floor(v));
}

/**
 * 이 스테이지에서 광고 보상을 제안해도 되는가.
 *
 * ★ 초반 제외는 데이터가 정한다 (`minStage`). 그 이유는 `ads.json:_stageRangeDoc`.
 */
export function adAllowedForStage(stageId) {
    const i = globalStageIndex(stageId);
    if (!Number.isFinite(i)) return false;
    return i >= DATA.minStage && i <= DATA.maxStage;
}

/**
 * 지금 광고 보상을 받을 수 있는가 — **이유까지 돌려준다** (`spells.js:canCast` 와 같은 규약).
 *
 * ★★ 화면이 자기 판정을 만들지 않게 하는 것이 이 함수의 존재 이유다. 버튼의
 *   비활성 사유와 실제 지급 판정이 갈라지면, "눌리는데 아무 일도 안 일어나는 버튼"이
 *   생긴다 — 이 저장소가 영입 카드에서 이미 겪은 사고다.
 *
 * @param {object} p
 * @param {string} p.stageId
 * @param {number} p.nowMs
 * @param {number} [p.tzOffsetMin]
 * @param {object} [p.state] `{ day: number, views: number, lastAtMs: number }`
 * @param {boolean} [p.ready] 어댑터가 광고를 실제로 들고 있는가
 * @returns {{ok: boolean, reason?: string, left?: number, waitMs?: number}}
 */
export function canWatchAd({ stageId, nowMs, tzOffsetMin = 0, state = null, ready = true }) {
    if (!AD_ENABLED) return { ok: false, reason: "disabled" };
    if (!adAllowedForStage(stageId)) return { ok: false, reason: "stage" };

    const today = dayKey(nowMs, tzOffsetMin);
    // ★ 무제한이면 `left` 는 Infinity 다 — 화면은 `AD_UNLIMITED` 를 보고 문구를 지운다.
    //   여기서 큰 유한수로 바꾸지 않는다. 그러면 "오늘 999회 남음" 이 그려진다.
    const left = AD_UNLIMITED ? Infinity : AD_DAILY_VIEWS - takenToday(state, today);
    if (left <= 0) return { ok: false, reason: "daily", left: 0 };

    const last = state?.lastAtMs ?? 0;
    // ★ 시계가 뒤로 간 경우(`nowMs < last`)를 쿨다운으로 취급하지 않는다 — 기기 시간을
    //   바꾼 사용자가 영원히 잠기는 것보다, 그냥 다시 볼 수 있는 편이 낫다.
    const since = nowMs - last;
    if (last > 0 && since >= 0 && since < AD_COOLDOWN_MS) {
        return { ok: false, reason: "cooldown", waitMs: AD_COOLDOWN_MS - since, left };
    }

    if (!ready) return { ok: false, reason: "notReady", left };
    return { ok: true, left };
}

/**
 * 광고를 끝까지 본 뒤 **추가로** 지급할 골드.
 *
 * ★★ **배수가 아니라 증분을 돌려준다.** 화면과 스토어가 각자 `gold * mult` 를
 *   계산하면 반올림이 갈라지고, 무엇보다 "이미 준 보상"과 "광고로 더 준 것"을
 *   결과 화면이 구분해서 보여 줄 수 없다. 플레이어가 광고를 본 대가를 눈으로
 *   확인하지 못하면 그 광고는 사기처럼 느껴진다.
 *
 * @param {number} baseGold 이미 지급된 클리어 보상
 * @returns {number} 추가 지급액 (0 이상 정수)
 */
export function adBonusGold(baseGold) {
    const g = Math.floor(Number(baseGold) || 0);
    if (g <= 0) return 0;
    return Math.max(0, Math.round(g * AD_REWARD_MULT) - g);
}

/**
 * 시청 1회를 반영한 다음 상태.
 * ★ 상태를 **제자리에서 고치지 않는다** — 스토어가 불변 갱신을 하므로 새 객체를 준다.
 */
export function recordView(state, nowMs, tzOffsetMin = 0) {
    const today = dayKey(nowMs, tzOffsetMin);
    return {
        day: today,
        views: takenToday(state, today) + 1,
        lastAtMs: nowMs,
    };
}

/**
 * 오늘 남은 횟수 (화면이 "오늘 3회 남음" 을 그리는 근거).
 *
 * ★ 무제한이면 **`Infinity`** 다. 화면은 이 값을 그리기 전에 `AD_UNLIMITED` 를
 *   먼저 보고 문구 자체를 빼야 한다 — 안 그러면 "오늘 Infinity회 남음" 이 뜬다.
 *   그렇게 되는 것이 큰 유한수를 돌려주는 것보다 낫다: **틀린 화면은 눈에 띄지만
 *   그럴듯한 거짓 숫자는 안 띈다.**
 */
export function viewsLeft(state, nowMs, tzOffsetMin = 0) {
    if (AD_UNLIMITED) return Infinity;
    return Math.max(0, AD_DAILY_VIEWS - takenToday(state, dayKey(nowMs, tzOffsetMin)));
}
