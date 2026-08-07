/**
 * 무과금 파워 모델 (P4-10 → P6 재작성 → 2026-08-04 경량화)
 *
 * ★ 이전 모델은 "수입을 추정해서 도달 가능한 레벨을 역산"했다. 방향이 틀렸다.
 *   그렇게 하면 수입 상수를 아무렇게나 넣어도 모델이 조용히 낮은 레벨을 내놓고,
 *   하네스는 "이 스테이지는 무과금으로 못 이긴다"고만 말한다.
 *   난이도가 문제인지 경제가 문제인지 구분이 안 된다.
 *
 * ★ 그래서 뒤집었다.
 *     targetPower(s)   — 그 스테이지에서 플레이어가 **가져야 하는** 파워 (설계값)
 *     requiredGold(s)  — 그 파워에 필요한 골드
 *     availableGold(s) — 실제 경제가 그때까지 주는 골드
 *   balance.mjs 는 targetPower 로 전투를 돌려 "난이도"를 검증하고,
 *   calibrate-economy.mjs 는 required vs available 로 "경제"를 검증한다.
 *   두 실패가 분리되어야 고칠 곳을 알 수 있다.
 *
 * ★★ **2026-08-04 경량화 이후 성장 갈래는 셋이다** — 동료 레벨 · 무기고 · 별 트리.
 *   승급(파편) · 장비(강화석)가 사라진 자리를 무기고 시설이 그대로 이어받는다.
 *   무기고 배율표(`meta.json:ark.armory.effect.mult`)는 옛 rank×gear 곡선을
 *   따라가도록 뽑은 값이라, **스테이지 난이도(difficultyMult)를 다시 잡지 않았다.**
 *
 * ★★ 그리고 **골드원이 하나로 줄었다.** 방치 · 파견 · 던전 · 시험 · 일일이 전부
 *   사라졌으므로 `availableGold` 는 캠페인 클리어만 센다. 예전 이 함수는
 *   방치·파견이 40% 를 대던 모델이었다 — 그 항을 지우고 `goldPerStage*` 를
 *   다시 잡는 것이 경량화에서 가장 위험한 한 걸음이었다 (calibrate-economy 가 검증).
 *
 * @see docs/02-design/14-economy-balance.md §2.3, §2.4
 */
import balance from "../../src/game/data/balance.json" with { type: "json" };
// ★ 광고 수치의 정본 (절대규칙 4). 하네스가 같은 데이터를 읽어야 검증이 참이다.
import ADS from "../../src/game/data/ads.json" with { type: "json" };
import meta from "../../src/game/data/meta.json" with { type: "json" };
// ★ "그 시점에 실제로 몇 명을 갖고 있는가" 는 확정 지급 규칙이 정한다.
//   여기 6 을 고정으로 적으면 초반 필요 골드가 실제의 3배로 부풀고,
//   그 부풀린 값이 "스테이지 1 부터 골드 부족" 이라는 유령 실패를 만든다.
import { guaranteedUnitsUpTo } from "../../src/game/logic/unlocks.js";

const P = balance.progression;
const E = balance.economy;
const FACILITY = Object.fromEntries(meta.ark.facilities.map((f) => [f.id, f]));
// ★ 무기고 배율은 **게임 데이터가 단일 출처다.** 도구가 사본을 들면
//   화면이 말하는 파워와 게이트가 검증한 파워가 갈라진다.
const ARMORY_MULT = FACILITY.armory.effect.mult;

/** 편성 슬롯 수 — 상한이다. 실제 분모는 `slotsAt()` 이 정한다. */
export const SLOTS = 6;

/**
 * 스테이지 s 시점에 **실제로 키우고 있는 동료 수.**
 *
 * ★ 확정 지급이 6명을 채우기 전까지 플레이어는 6명분 골드를 쓸 수 없다 —
 *   쓸 곳이 없기 때문이다. 분모를 6 으로 고정하면 초반 구간이 영원히
 *   "골드 부족" 으로 보이고, 그 유령을 고치려고 수입을 3배로 올리게 된다.
 */
export function slotsAt(s) {
    const owned = guaranteedUnitsUpTo(Math.max(0, Math.floor(s))).size;
    return Math.max(1, Math.min(SLOTS, owned));
}

/* ────────────────────────── 목표 파워 곡선 ────────────────────────── */

/**
 * 스테이지 s 시점의 목표 레벨.
 * ★ 레벨은 대략 스테이지를 따라간다. 훈련장 상한(= 시설레벨 + 10)이
 *   실제 천장이므로, 방주를 키우지 않으면 여기서 막히는 것이 설계 의도다.
 */
export function targetLevel(s) {
    return Math.max(
        1,
        Math.min(E.targetLevelCap, Math.round(E.targetLevelBase + s * E.targetLevelPerStage))
    );
}

/**
 * 스테이지 s 시점의 목표 무기고 레벨과 그 배율.
 *
 * ★ 5스테이지마다 한 레벨 (상한 20 = 스테이지 100). 옛 모델의 "12스테이지마다 승급 ·
 *   20스테이지마다 장비 티어"를 하나의 계단으로 합친 것이고, 배율표가 그 둘의
 *   곱을 따라가므로 같은 스테이지에서 같은 파워가 나온다.
 */
export function targetArmory(s) {
    const level = Math.min(
        ARMORY_MULT.length - 1,
        Math.floor(Math.max(0, s) / E.stagesPerArmoryLevel)
    );
    return { level, mult: ARMORY_MULT[level] };
}

/** 별 트리 누적 — 스테이지당 별 2개 획득 가정, 저렴한 노드부터 */
export function targetStarMult(s) {
    return 1 + Math.min(E.starMultMax, s * E.starMultPerStage);
}

/**
 * 목표 총 파워 배율 (base 대비).
 * @returns {{level:number, armory:object, star:number, power:number}}
 */
export function targetPower(s) {
    const level = targetLevel(s);
    const armory = targetArmory(s);
    const star = targetStarMult(s);
    const power = Math.pow(P.unitAtkGrowth, level - 1) * armory.mult * star;
    return { level, armory, star, power };
}

/* ────────────────────────── 필요 자원 ────────────────────────── */

/** 1레벨 → target 레벨 누적 골드 (1명분) */
export function cumulativeLevelCost(target) {
    let sum = 0;
    for (let l = 1; l < target; l++) {
        sum += P.unitLevelCostBase * Math.pow(P.unitLevelCostGrowth, l - 1);
    }
    return sum;
}

/**
 * 목표 레벨을 지탱하는 데 필요한 훈련장 레벨과 그 누적 비용.
 * ★ 레벨 상한 = 11 + (훈련장 − 1). 훈련장을 빼고 계산하면
 *   "골드는 충분한데 레벨이 안 오른다"는 상태를 모델이 못 본다.
 *   실제 플레이어가 겪는 벽은 대부분 이 모양이다.
 */
export function requiredTrainingYard(s) {
    const cap = FACILITY.trainingYard.effect;
    return Math.max(1, Math.ceil((targetLevel(s) - cap.base) / cap.perLevel) + 1);
}

function facilityCost(f, toLevel) {
    let sum = 0;
    for (let l = 0; l < toLevel - 1; l++) sum += f.goldBase * Math.pow(f.goldGrowth, l);
    return sum;
}

/**
 * 편성 전체가 목표 파워에 도달하는 데 드는 골드.
 *
 * ★★ 무기고가 **여기 들어온 것이 경량화의 값이다.** 예전에는 장비 티어가
 *   "진행 보상"이라 공짜였고 강화만 강화석을 먹었다 — 즉 파워의 절반이
 *   골드 모델 **밖**에 있었다. 이제 파워 전체가 골드 하나로 계산되므로
 *   `calibrate-economy` 의 통과가 실제 플레이어의 통과와 같은 뜻이 된다.
 */
export function requiredGold(s) {
    return (
        cumulativeLevelCost(targetLevel(s)) * slotsAt(s) +
        facilityCost(FACILITY.trainingYard, requiredTrainingYard(s)) +
        // ★ 무기고는 레벨 0 에서 시작하므로 `level + 1` 을 넘긴다
        //   (facilityCost 는 1레벨을 이미 지은 것으로 센다).
        facilityCost(FACILITY.armory, targetArmory(s).level + 1)
    );
}

/* ────────────────────────── 실제 수입 ────────────────────────── */

/**
 * 스테이지 s 에 도달하기까지 걸린 일수.
 *
 * ★ 수입이 전부 전투에서 나오는 지금도 이 함수는 남는다 — `playthrough` 하네스가
 *   "며칠 만에 완주하는가"를 보고하기 때문이다. 다만 **골드 계산에는 더 이상
 *   쓰이지 않는다** (시간당 수입원이 하나도 없다).
 */
export function daysToStage(s) {
    if (s <= 0) return 0;
    // s = a·ln(1+d/b) 꼴을 뒤집는다
    return Math.max(0.2, E.daysB * (Math.exp(s / E.daysA) - 1));
}

/** 스테이지 1클리어당 골드 */
export function goldPerStage(s) {
    return E.goldPerStageBase * Math.pow(E.goldPerStageGrowth, s);
}

/**
 * s 까지 진행하며 얻는 총 골드.
 *
 * ★★ **전투뿐이다.** 방치 · 파견 · 던전 · 시험이 전부 사라졌다 (2026-08-04).
 *   `repeatFactor` 는 "각 스테이지를 평균 몇 번 도는가" 이고, 이 게임에서
 *   막혔을 때의 유일한 대응이 그것이므로 이제 **가장 중요한 손잡이**다.
 */
export function availableGold(s, { ads = false, force = false } = {}) {
    let battle = 0;
    for (let i = 1; i <= s; i++) battle += goldPerStage(i) * E.repeatFactor;
    // ★ 시작 골드는 **모델에도 들어가야 한다.** 게임이 주는데 모델이 모르면
    //   초반 구간이 영원히 "골드 부족"으로 보이고, 그 유령을 고치려고
    //   수입 상수를 필요 이상으로 올리게 된다 (실제로 한 번 그랬다).
    return battle + (E.startingGold ?? 0) + (ads ? adGold(s, force) : 0);
}

/**
 * 보상형 광고로 **추가로** 들어오는 골드 (2026-08-07).
 *
 * ★★★ **경제 검증이 광고를 모르면, 광고가 경제를 망가뜨려도 아무도 실패하지 않는다.**
 *   `docs/06-release/55-monetization-decision.md` §2 의 계산이 그것이다 — 이 게임의
 *   골드원은 캠페인 클리어 하나뿐이라 배수를 무제한으로 주면 총수입이 그대로
 *   배가 되고, 여유 0.79~1.30배가 1.6~2.6배가 되어 40–60 구간의 벽이 사라진다.
 *   그래서 `npm run economy` 가 **광고를 켠 곡선도 함께** 낸다.
 *
 * ★★ 상한 모델: 하루 `dailyViews` 회. 하루에 실제로 몇 스테이지를 도는지는
 *   `daysToStage(s)` 가 이미 알고 있으므로, **그 기간 동안 볼 수 있는 총 횟수**를
 *   상한으로 잡는다. 그것이 상한을 가장 관대하게(=위험하게) 본 값이고,
 *   검증은 언제나 나쁜 쪽을 봐야 한다.
 * ★ 광고 보상은 **최근 스테이지**에 붙는다고 본다 — 플레이어는 골드가 가장 큰
 *   스테이지를 반복한다. 초반 스테이지에 붙는다고 모델링하면 위험을 과소평가한다.
 * ★ `ads.json:minStage` 미만은 제외한다.
 */
/**
 * @param {number} s
 * @param {boolean} [force] `enabled` 가 false 여도 계산한다 — 켜기 전에 미리 보기 위해서다
 */
export function adGold(s, force = false) {
    if (ADS.enabled !== true && !force) return 0;
    const mult = Number(ADS.rewardMult) || 1;
    if (mult <= 1) return 0;

    // 이 시점까지 볼 수 있었던 총 시청 횟수 (하루 상한 × 경과 일수)
    const budget = Math.floor(Math.max(0, daysToStage(s)) * (Number(ADS.dailyViews) || 0));
    if (budget <= 0) return 0;

    // 골드가 큰 순서(= 최근 스테이지부터)로 예산을 소진한다
    let left = budget;
    let extra = 0;
    for (let i = s; i >= Math.max(1, ADS.minStage ?? 1) && left > 0; i--) {
        // 그 스테이지를 도는 횟수만큼만 광고를 볼 수 있다
        const plays = Math.min(left, Math.ceil(E.repeatFactor));
        extra += goldPerStage(i) * (mult - 1) * plays;
        left -= plays;
    }
    return extra;
}

/**
 * **골드 → 도달 가능한 파워** (`requiredGold` 의 역함수).
 *
 * ★★★ **광고가 위험한 이유는 골드가 아니라 파워다** (2026-08-07 정정).
 *
 *   처음에는 골드 여유(`가용/필요`)로 게이트를 만들었다. 그것은 **틀린 축**이다 —
 *   골드 여유는 지금도 1.06~2.12 로 언제나 1 을 넘고, 넘는 것이 정상이다.
 *   실제로 게임을 쉽게 만드는 것은 **그 골드로 산 파워가 적 HP 대비 얼마인가**이고,
 *   그 비는 0.79~1.26 사이에서 40–60 구간에 의도적으로 낮게 잡혀 있다.
 *
 *   그리고 둘은 **선형이 아니다.** 레벨·시설 비용이 지수라, 골드 +63% 가
 *   파워 +63% 를 뜻하지 않는다. 골드로 게이트를 걸면 실제보다 훨씬 가혹하게
 *   판정한다 — 그래서 축을 바꾼다.
 *
 * ★ `requiredGold(s)` 가 s 에 대해 단조증가이므로 이분 탐색으로 뒤집는다.
 *   같은 함수를 뒤집으므로 모델이 둘로 갈라질 수 없다.
 *
 * @param {number} gold
 * @returns {number} 그 골드로 도달할 수 있는 '목표 파워 기준' 스테이지 (실수)
 */
export function stageAffordableWith(gold) {
    let lo = 0;
    let hi = 200;
    for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        if (requiredGold(Math.max(1, Math.round(mid))) <= gold) lo = mid;
        else hi = mid;
    }
    return lo;
}

/** 그 골드로 실제로 도달하는 파워 */
export function powerFromGold(gold) {
    const s = Math.max(1, Math.round(stageAffordableWith(gold)));
    return targetPower(s).power;
}

/* ────────────────────────── 하네스 인터페이스 ────────────────────────── */

/**
 * 해당 스테이지 시점의 무과금 파워.
 * ★ balance.mjs 가 이 값으로 전투를 돌린다.
 * @param {number} globalStage 1..200
 */
export function estimateF2PPower(globalStage) {
    const t = targetPower(globalStage);
    // ★ 무기고(배율) × 별 트리(가산 %) 를 하나의 `1 + pct` 로 접는다 —
    //   `progression.js:buildLoadoutSlots` 와 **같은 식**이어야 한다.
    const pct = t.armory.mult * t.star - 1;
    return {
        level: t.level,
        armory: t.armory.level,
        atkPct: pct,
        hpPct: pct,
        gold: availableGold(globalStage),
    };
}

/** 편성 id 배열 → 성장 적용된 슬롯 배열 */
export function withF2PProgression(unitIds, globalStage) {
    const p = estimateF2PPower(globalStage);
    return unitIds.map((id) => ({
        id,
        level: p.level,
        atkPct: p.atkPct,
        hpPct: p.hpPct,
    }));
}
