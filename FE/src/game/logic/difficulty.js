/**
 * 난이도 모드 (P6-10)
 *
 * ★★ 난이도는 **데이터**다. 이 파일에는 배율 숫자가 하나도 없다.
 *   전부 `balance.json:difficulty` 에서 온다 (절대 규칙 4).
 *   난이도를 추가·조정하는 작업이 코드 수정이 되는 순간,
 *   밸런스 담당자가 개발자를 기다려야 하고 하네스 스윕도 불가능해진다.
 *
 * ★ 확률 요소가 없다. 하드는 "운이 나쁘면 지는 판"이 아니라
 *   "같은 판이 더 무거운 것"이다 — 결정론이 유지되어야
 *   `DIFFICULTY=hard node tools/balance.mjs` 로 하드를 측정할 수 있고,
 *   가챠 외 확률 금지(절대 규칙 6)와도 일관된다.
 *
 * ★ 미구현 난이도는 `implemented: false` 로 **데이터에 남아 있다**.
 *   삭제하면 "언젠가 온다"는 사실이 사라지고, 잘못 호출했을 때
 *   `알 수 없는 난이도` 라는 거짓말을 하게 된다. 둘은 다른 사고다.
 *
 * @see docs/02-design/15-content-plan.md §2
 * @see docs/02-design/14-economy-balance.md §2
 */
import balance from "../data/balance.json" with { type: "json" };
import stagesData from "../data/stages.json" with { type: "json" };
/**
 * ★★ **문장을 런타임에 이어 붙이지 않는다** (2026-08-07). 예전에는
 *   `'…않았습니다' + (note ? '(…)' : '') + '. 지금은 …'` 처럼 조각을 이었고,
 *   해금 문구는 `${min}별 이상으로 ` 라는 **부분 문자열**을 문장 중간에 끼웠다.
 *   한국어에서는 굴러가지만 어순이 다른 언어에서는 그 자리가 그대로 무너진다.
 *   지금은 조건마다 **문장 전체가 키 하나**다.
 */
import { t, pick } from "../../i18n/index.js";

const D = balance.difficulty;
const E = balance.economy;

/** 난이도 id 목록 (쉬운 순) */
export const DIFFICULTY_IDS = D.order;

/** 기본 난이도 — 항상 order 의 첫 번째다 */
export const DEFAULT_DIFFICULTY = D.order[0];

/**
 * 난이도 이름.
 *
 * ★★ **카탈로그가 정본이다** (`terms.difficulty.<id>` — 두 언어). 난이도 이름은
 *   화면 · 프리뷰 · 출격 버튼이 같은 단어로 불러야 하는 개념어라 태그·역할과 같은
 *   자리에 둔다. 카탈로그에 없는 난이도(= 데이터에 새로 적힌 것)만 데이터에서 읽는다 —
 *   `pick` 은 정본 `{name:{ko,en}}` 과 구형 `nameKo` 를 둘 다 읽는다.
 * ★ 함수여야 한다. 상수로 두면 설정에서 언어를 바꿔도 값이 바뀌지 않는다.
 */
export function difficultyName(id, lang) {
    const key = `terms.difficulty.${id}`;
    const label = t(key, undefined, lang);
    if (label !== key) return label;
    return pick(D.levels[id] ?? {}, "name", lang) || id;
}

/**
 * 미구현 난이도의 안내 문구 (`balance.json:difficulty.levels.*.note`).
 * ★ 함수여야 한다 — 아래 `DIFFICULTIES` 주석 참조.
 */
export function difficultyNote(id, lang) {
    const lv = D.levels[id];
    return lv ? pick(lv, "note", lang) : "";
}

/**
 * UI 가 그대로 쓰는 요약 목록.
 *
 * ★★★ **여기에 이름을 담지 않는다** (2026-08-07, 실기에서 잡음).
 *
 *   한때 `name: difficultyName(id)` 를 담았다. 모듈 스코프 상수는 **로드 시점에
 *   한 번** 계산되므로 그 값은 부팅 언어로 굳는다 — 설정에서 영어로 바꿔도
 *   출격 화면의 난이도 줄만 `노멀 · 하드 · 나이트메어` 로 남았다.
 *   게다가 화면은 `pick(d, "name")` 으로 읽고 있었는데, 그 값은 이미 **문자열**이라
 *   `pick` 이 그대로 돌려주며 **아무도 실패하지 않았다.**
 *
 *   "호출부가 옮겨질 때까지의 다리"로 남겨 두는 선택지도 있었지만, 이 저장소의
 *   규약은 **별칭을 남기지 않는 것**이다 — 남기면 다음 호출부가 그대로 그것을 쓴다.
 *   이름이 필요하면 `difficultyName(id)` 를, 안내 문구가 필요하면
 *   `difficultyNote(id)` 를 **부를 때마다** 부른다.
 */
export const DIFFICULTIES = D.order.map((id) => ({
    id,
    implemented: D.levels[id].implemented === true,
}));

/** 스테이지 id("4-12") → 전역 순번(1..200) */
export function globalStageIndex(id) {
    const [w, i] = String(id).split("-").map(Number);
    return (w - 1) * 20 + i;
}

/** 스테이지 id → 월드 번호 */
export function worldOfStage(id) {
    return Number(String(id).split("-")[0]);
}

/** 해당 월드의 스테이지 id 목록 */
export function stageIdsOfWorld(world) {
    return stagesData.stages.filter((s) => s.world === Number(world)).map((s) => s.id);
}

/** 정의만 꺼낸다 (구현 여부·존재 여부를 판단하지 않는다) */
export function difficultyDef(id) {
    return D.levels[id] ?? null;
}

export function isKnownDifficulty(id) {
    return Boolean(D.levels[id]);
}

export function isDifficultyImplemented(id) {
    return D.levels[id]?.implemented === true;
}

const implementedNames = () =>
    D.order
        .filter((id) => D.levels[id].implemented)
        .map((id) => difficultyName(id))
        .join(" · ");

/**
 * 전투에 쓸 난이도 설정을 꺼낸다.
 *
 * ★ 두 실패를 **다른 메시지로** 구분한다.
 *   - 오타/버그 → "알 수 없는 난이도"
 *   - 아직 안 만든 것 → "구현되지 않았습니다 + 무엇이 없는지 + 지금 되는 것"
 *   두 번째를 첫 번째로 뭉뚱그리면 플레이어는 자기 세이브가 깨진 줄 안다.
 *
 * @throws {Error} 사용자에게 그대로 보여줄 수 있는 한국어 메시지
 */
export function difficultyConfig(id = DEFAULT_DIFFICULTY) {
    const lv = D.levels[id];
    if (!lv) {
        throw new Error(
            t("rules.difficulty.unknown", {
                id,
                list: D.order.map((d) => difficultyName(d)).join(" · "),
            })
        );
    }
    if (!lv.implemented) {
        // ★ note 가 있고 없고는 **다른 문장**이다 — 뒤에 조각을 이어 붙이지 않는다
        const note = pick(lv, "note") || lv.note || "";
        throw new Error(
            t(note ? "rules.difficulty.notImplementedNote" : "rules.difficulty.notImplemented", {
                name: difficultyName(id),
                note,
                list: implementedNames(),
            })
        );
    }
    return lv;
}

/* ───────────────────────── 해금 ───────────────────────── */

/**
 * 난이도 해금 진행도.
 *
 * @param {string} id 난이도
 * @param {number} world 월드 번호
 * @param {Record<string, Record<string, number>>} starsByDifficulty
 *   { normal: { "1-1": 3, ... }, hard: {...} } — 난이도별 스테이지 획득 별
 * @returns {{unlocked:boolean, done:number, total:number, requirement:object|null}}
 */
export function difficultyProgress(id, world, starsByDifficulty = {}) {
    const lv = D.levels[id];
    if (!lv) return { unlocked: false, done: 0, total: 0, requirement: null };

    const u = lv.unlock ?? { type: "always" };
    if (u.type === "always") return { unlocked: true, done: 0, total: 0, requirement: u };

    if (u.type === "worldCleared") {
        const ids = stageIdsOfWorld(world);
        const src = starsByDifficulty[u.difficulty] ?? {};
        const min = u.minStars ?? 1;
        let done = 0;
        for (const sid of ids) if ((src[sid] ?? 0) >= min) done++;
        return {
            unlocked: ids.length > 0 && done === ids.length,
            done,
            total: ids.length,
            requirement: u,
        };
    }

    // 알 수 없는 해금 방식은 **잠긴 것으로 취급한다**.
    // 기본값을 '열림'으로 두면 데이터 오타 하나가 전 난이도를 개방한다.
    return { unlocked: false, done: 0, total: 0, requirement: u };
}

export function isDifficultyUnlocked(id, world, starsByDifficulty = {}) {
    return difficultyProgress(id, world, starsByDifficulty).unlocked;
}

/**
 * 잠금 사유 한 줄 (UI 가 그대로 출력한다).
 *
 * ★★ 별 조건이 있고 없고는 **문장이 둘**이다. 예전에는 `${min}별 이상으로 ` 라는
 *   부분 문자열을 만들어 문장 중간에 끼웠는데, 그 조각은 영어에서 갈 자리가 없다
 *   ("cleared on Hard **with 2+ stars**" 는 문장 끝이다). 조각이 아니라 문장을 고른다.
 */
export function difficultyUnlockText(id, world) {
    const lv = D.levels[id];
    if (!lv) return "";
    const u = lv.unlock ?? { type: "always" };
    if (u.type === "always") return "";
    if (u.type === "worldCleared") {
        const stars = u.minStars ?? 1;
        const params = { world, difficulty: difficultyName(u.difficulty), stars };
        return t(
            stars > 1 ? "rules.difficulty.unlockWorldStars" : "rules.difficulty.unlockWorld",
            params
        );
    }
    return t("rules.difficulty.lockedUnknown");
}

/* ───────────────────────── 보상 ───────────────────────── */

/**
 * 클리어 보상.
 *
 * ★ 골드 기준선은 경제 모델(`economy.goldPerStage*`)과 **같은 식**을 쓴다.
 *   여기서 따로 정의하면 tools/calibrate-economy.mjs 가 검증하는 곡선과
 *   실제 지급액이 갈라지고, 그 괴리는 아무 테스트에도 잡히지 않는다.
 *
 * ★ 별은 보상이 아니라 기록이다 — 여기서 지급하지 않는다.
 *   별 합계는 스토어가 난이도별 stageStars 에서 직접 센다.
 *
 * @param {object} args
 * @param {string} args.stageId
 * @param {string} [args.difficulty]
 * @param {boolean} [args.firstClear] 이 난이도에서 처음 깬 판인가
 * @returns {{gold:number, stones:number, gems:number}}
 */
export function stageReward({ stageId, difficulty = DEFAULT_DIFFICULTY, firstClear = false }) {
    const lv = D.levels[difficulty];
    if (!lv) return { gold: 0 };

    const idx = globalStageIndex(stageId);
    const r = lv.reward ?? {};
    const baseGold = E.goldPerStageBase * Math.pow(E.goldPerStageGrowth, idx);

    // ★ 재화는 골드 하나다 (2026-08-04 경량화). 첫 클리어는 **골드 보너스**로 준다 —
    //   예전에는 젬이었고, 그것이 이 게임에 남은 마지막 결제 재화 유입로였다.
    const first = firstClear ? (r.firstClearGoldMult ?? 0) : 0;
    return { gold: Math.round(baseGold * ((r.goldMult ?? 1) + first)) };
}
