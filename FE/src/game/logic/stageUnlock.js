/**
 * 캠페인 진행 게이트 — "지금 어느 스테이지까지 들어갈 수 있는가".
 *
 * ★★ **이 규칙이 없었다.** 출격 화면은 1-1 부터 5-20 까지 똑같이 생긴 버튼 100개를
 *   조건 없이 그렸고, 프리뷰의 [출격]은 `<Link to={/battle/${id}}>` 로 아무나 열었으며,
 *   `BattleScreen` 은 **탑만** 막고 캠페인은 아무 검사도 하지 않았다.
 *   그 상태의 결과는 두 가지다:
 *     ① 신규 플레이어가 "어디까지 깼고 다음이 어디인지"를 알 방법이 없다.
 *     ② `metaSlice.recordStageClear` 가 `highestStage = max(prev, globalIndex)` 이므로
 *        **후반 스테이지를 한 번만 이겨도** 던전(25)·탑(40)·하드 전 월드·방주 시설·
 *        던전 티어 사다리가 한꺼번에 열린다. 순서를 강제하는 코드가 어디에도 없었다.
 *
 * ★ 규칙은 하나뿐이다: **바로 다음 스테이지까지 열린다.**
 *   `globalStageIndex(id) <= highestStage + 1`
 *   `highestStage` 는 "노멀 기준으로 클리어한 가장 높은 전역 순번"이고 신규 계정은 0 이므로,
 *   1-1(순번 1)은 언제나 열려 있다. 되돌아가서 다시 도는 것도 언제나 열려 있다
 *   (별 트리 재화가 반복 플레이에서 나온다 — 13-progression-meta.md §4).
 *
 * ★ **난이도로 갈리지 않는다.** 하드 해금은 월드 단위의 별도 규칙이고
 *   (`difficulty.js:isDifficultyUnlocked`), 여기서 다시 판정하면 두 번째 출처가 된다.
 *
 * ★ Phaser · DOM · 스토어를 import 하지 않는다 (절대 규칙 1). 화면도 씬도 스토어도
 *   **이 술어 하나**를 부른다 — 사본을 두면 "버튼은 잠겼는데 딥링크로는 들어가진다"가 된다.
 *
 * @see docs/02-design/13-progression-meta.md §4
 */
import stagesData from "../data/stages.json";
import { globalStageIndex } from "./difficulty";

/** 캠페인 스테이지 id (데이터 순서 그대로) */
export const CAMPAIGN_STAGE_IDS = stagesData.stages.map((s) => s.id);

/** 마지막 캠페인 스테이지의 전역 순번 — 데이터가 정한다 */
export const LAST_STAGE_INDEX = CAMPAIGN_STAGE_IDS.reduce(
    (m, id) => Math.max(m, globalStageIndex(id)),
    0
);

/** 진행도를 숫자로 정리한다 (세이브가 문자열·NaN 을 들고 올 수 있다) */
const progress = (highestStage) => {
    const n = Math.floor(Number(highestStage));
    return Number.isFinite(n) && n > 0 ? Math.min(n, LAST_STAGE_INDEX) : 0;
};

/**
 * 이 스테이지에 들어갈 수 있는가.
 *
 * ★ 이름이 `is…Unlocked` 가 **아닌** 이유: `tools/check-reachability.mjs` 의 R5d 는
 *   그 이름 패턴을 "첫 인자가 진행도인 화면 해금 술어"로 보고 0..100 을 먹여 훑는다.
 *   이것은 화면 해금이 아니라 스테이지 게이트이고 인자 모양도 다르다.
 *
 * @param {string} stageId 캠페인 스테이지 id ("2-7")
 * @param {number} highestStage `meta.highestStage`
 */
export function canEnterStage(stageId, highestStage) {
    const idx = globalStageIndex(stageId);
    // ★ 캠페인 순번으로 읽히지 않는 id(탑·던전)는 이 규칙의 대상이 아니다 — 통과시킨다.
    //   막는 것은 각자의 규칙이다 (`tower.canEnterTowerFloor` 등). 여기서 fail-closed 로
    //   두면 탑 라우트가 이 술어에 걸려 통째로 잠긴다.
    if (!Number.isFinite(idx)) return true;
    return idx <= progress(highestStage) + 1;
}

/** 다음에 도전할 스테이지의 전역 순번 (전부 깼으면 마지막) */
export function nextStageIndex(highestStage) {
    return Math.min(LAST_STAGE_INDEX, progress(highestStage) + 1);
}

/** 다음에 도전할 스테이지 id — 출격 화면의 "여기부터" 마커가 이것 하나를 쓴다 */
export function nextStageId(highestStage) {
    const want = nextStageIndex(highestStage);
    return CAMPAIGN_STAGE_IDS.find((id) => globalStageIndex(id) === want) ?? CAMPAIGN_STAGE_IDS[0];
}

/**
 * 버튼 하나가 그려야 할 상태.
 *
 * ★ 화면이 `>=` 를 다시 쓰지 않게 **표기까지 여기서 정한다.** 잠금·클리어·다음은
 *   같은 진행도에서 파생되는 세 얼굴이고, 화면마다 조합하면 셋이 어긋난다.
 *
 * @returns {"locked"|"next"|"cleared"|"open"}
 */
export function stageMark(stageId, highestStage, stars = 0) {
    if (!canEnterStage(stageId, highestStage)) return "locked";
    if (stars > 0) return "cleared";
    return globalStageIndex(stageId) === nextStageIndex(highestStage) ? "next" : "open";
}
