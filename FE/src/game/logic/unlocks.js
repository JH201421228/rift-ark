/**
 * 캠페인 확정 지급 (P8-02)
 *
 * ★★ 이 모듈이 지키는 명제는 하나다:
 *   **진행에 필요한 최소 로스터는 뽑기 운이 아니라 플레이로 보장된다.**
 *
 *   15-content-plan.md §1.1 이 요구하는 규칙("각 월드의 요구 답안 동료는 그 월드가
 *   시작되기 전에 반드시 획득 가능해야 한다")의 구현체이고, 그 규칙이 없으면
 *   CLAUDE.md 의 설계 결정 5("벽은 항상 편성 퍼즐이고 절대 경제 벽이 아니다")가
 *   성립하지 않는다 — 답이 되는 동료를 못 뽑으면 벽은 퍼즐이 아니라 확률이 된다.
 *
 * ★ 순수 함수다. `Date.now()` · 난수 · DOM 이 없다 (절대 규칙 1).
 *   지급은 **결정론**이다 — 같은 스테이지는 언제나 같은 동료를 준다 (절대 규칙 6).
 *
 * @see docs/02-design/15-content-plan.md §1.1
 * @see docs/04-plan/33-execution-plan.md P8-02
 */
import UNLOCKS from "../data/unlocks.json" with { type: "json" };
import { globalStageIndex } from "./stageConfig.js";

/**
 * ★ `why` 는 **두 언어를 나란히** 갖는다 (`{ko, en}`) — 게임 데이터의 정본 형태다
 *   (`i18n/index.js` 머리말). 읽는 쪽은 `pick(grant, "why")` 를 쓴다.
 * @type {Array<{stage:string, units:string[], why?:{ko:string, en:string}}>}
 */
export const STAGE_GRANTS = UNLOCKS.stageGrants ?? [];

/**
 * 신규 계정이 **처음부터** 갖는 동료.
 *
 * ★ 목록을 여기 적지 않는다 — `unlocks.json:startingUnits` 가 유일한 출처다.
 *
 * ★★ 2026-08-04 튜토리얼 삭제 전까지 이 값은 `ftue.json` 의 단계별 `unlocks`
 *   에서 파생됐다. 튜토리얼이 사라지면서 그 출처도 사라졌고, 그대로 두면
 *   **신규 계정의 보유 동료가 0종**이 된다 — 이 모듈을 전제로 선 검사기 셋
 *   (validate-data · check-unlocks · playthrough)이 전부 거짓 위에 서게 된다.
 */
export const STARTING_UNITS = Object.freeze(UNLOCKS.startingUnits ?? []);

/** 스테이지 하나를 **처음** 클리어했을 때 지급되는 동료 */
export function unitGrantsFor(stageId) {
    const row = STAGE_GRANTS.find((g) => g.stage === stageId);
    return row ? [...row.units] : [];
}

/**
 * 이 동료를 **확정 지급하는** 스테이지 — 없으면 null (= 가챠·배틀패스로만 얻는다).
 *
 * ★ 프리뷰 화면이 "부족한 동료를 어디서 얻는가"를 답하는 데 쓴다.
 *   막힌 플레이어에게 "이 편성으로는 못 깬다"까지만 말하고 획득 경로를 안 알려 주면,
 *   그것은 진단이지 안내가 아니다.
 * ★ 시작 보유분은 이미 갖고 있으므로 여기서 나오지 않는다 (그 경우 null).
 */
export function grantStageOf(unitId) {
    return STAGE_GRANTS.find((g) => g.units.includes(unitId))?.stage ?? null;
}

/**
 * `stageId` 를 **플레이하는 시점에** 보유가 보장되는 동료 전체.
 *
 * ★ 경계가 이 함수의 전부다: 스테이지 N 의 보상은 N 을 **깬 뒤에** 들어오므로,
 *   N 을 플레이할 때 보장되는 것은 **N 미만**의 지급분이다.
 *   `<` 를 `<=` 로 바꾸면 "그 스테이지가 요구하는 답을 그 스테이지를 깨야 얻는"
 *   순환이 생기고, 검사가 그것을 통과시켜 버린다.
 *
 * @param {string} stageId
 * @returns {Set<string>}
 */
export function guaranteedUnitsBefore(stageId) {
    const idx = globalStageIndex(stageId);
    const out = new Set(STARTING_UNITS);
    for (const g of STAGE_GRANTS) {
        if (globalStageIndex(g.stage) < idx) for (const u of g.units) out.add(u);
    }
    return out;
}

/**
 * 최고 스테이지가 `highestStage` 인 계정이 **받았어야 하는** 동료 전체.
 * ★ 세이브 마이그레이션이 쓴다 — 이미 진행한 계정에 소급 지급하기 위해서다.
 *   소급하지 않으면 기존 플레이어만 영원히 확정 지급을 받지 못한다.
 */
export function guaranteedUnitsUpTo(highestStage) {
    const out = new Set(STARTING_UNITS);
    for (const g of STAGE_GRANTS) {
        if (globalStageIndex(g.stage) <= highestStage) for (const u of g.units) out.add(u);
    }
    return out;
}
