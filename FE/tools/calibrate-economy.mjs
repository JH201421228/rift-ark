/**
 * 경제 보정 — "무과금이 의도한 파워에 도달할 수 있는가" (P6)
 *
 * ★ 밸런스 하네스(balance.mjs)는 "의도한 파워로 이길 수 있는가"를 본다.
 *   그 파워에 **도달할 수 있는가**는 전혀 다른 질문이고, 여기서 본다.
 *   두 질문을 한 스크립트에 섞으면 실패했을 때 무엇이 문제인지 알 수 없다.
 *
 * ★ 이것이 "스테이지 30–50 벽"의 진짜 정체다.
 *   적 HP 는 1.11^s 로 오르는데 골드 수입이 그만큼 따라오지 않으면,
 *   플레이어는 아무리 잘 해도 파워가 모자란 상태로 벽에 부딪힌다.
 *   벽은 난이도 문제가 아니라 **경제 문제**로 먼저 나타난다.
 *
 * ★★ **2026-08-04 경량화 이후 손잡이가 둘로 줄었다.**
 *   예전에는 방치 비중(35–50%) · 파편 · 콘텐츠 수도꼭지(던전 · 시험)까지 넷을 봤다.
 *   지금 골드원은 **캠페인 클리어 하나뿐**이므로 볼 것은 두 가지다:
 *     ① 필요 골드 ≤ 가용 골드 (목표 파워에 도달할 수 있는가)
 *     ② 목표 파워 ≥ 적 HP × 0.75 (편성으로 메울 수 있는 구간인가)
 *   손잡이도 둘뿐이다 — `goldPerStage*` 와 `repeatFactor`.
 *
 * 사용: npm run economy
 */
import balance from "../src/game/data/balance.json" with { type: "json" };
import ADS from "../src/game/data/ads.json" with { type: "json" };
import {
    targetPower,
    requiredGold,
    availableGold,
    daysToStage,
    requiredTrainingYard,
} from "./lib/f2p-power.mjs";

const S = balance.scaling;
const E = balance.economy;

function growthMultiplier(stage, curve) {
    let m = 1;
    let from = 0;
    for (const seg of curve) {
        const to = Math.min(stage, seg.maxStage);
        if (to > from) m *= Math.pow(seg.rate, to - from);
        from = to;
        if (stage <= seg.maxStage) break;
    }
    return m;
}

const MAX_STAGE = 100;
const CHECKPOINTS = [1, 5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100];

console.log("── 경제 보정 ──────────────────────────────────────────────────────");
console.log(
    `골드원: 캠페인 클리어 1종 (스테이지당 평균 ${E.repeatFactor}회 반복 가정)\n`
);
console.log("스테  일수  적HP배  목표파워    비  │   필요골드   가용골드    배  │ 성장");
console.log("──────────────────────────────────────────────────────────────────");

let goldFail = 0;
let powerFail = 0;
let adGoldFail = 0;
/**
 * 광고가 **더해도 되는 골드의 비율 상한** (총 가용 골드 대비).
 *
 * ★★★ **절대 여유가 아니라 증가분을 본다.** 처음에는 "광고 켠 여유 ≤ 1.5배"로
 *   두었는데, 그러면 100 스테이지가 언제나 실패한다 — 거기는 광고 없이도 여유가
 *   **2.12 배**다(캠페인을 다 깨면 골드를 쓸 곳이 없으니 당연하다). 의도된 잉여를
 *   광고 탓으로 신고하는 검사기는 아무도 믿지 않게 되고, 그 순간 검사기가 죽는다.
 *
 * ★★ 지켜야 하는 명제는 하나다 — **40–60 구간의 "의도적으로 모자람"이 살아 있는가.**
 *   실측 여유는 40:0.83 · 50:0.79 · 60:0.80 이다. 여유가 1.0 에 닿는 순간 그 구간은
 *   골드로 풀리고, 편성 퍼즐이 경제 벽으로 바뀐다 (`55-monetization-decision.md` §2).
 *   가장 빡빡한 곳은 **스테이지 40** 이고, 거기서 1.0 에 닿지 않으려면
 *   증가분이 `(1 - 0.83) / 0.83 = +20%` 를 넘으면 안 된다. **이 숫자는 고른 것이
 *   아니라 계산된 것이다** — 곡선이 바뀌면 여기도 다시 계산해야 한다.
 *
 * ★ 손잡이는 `ads.json` 의 `rewardMult` · `dailyViews` · `minStage` 셋이다.
 *   이 값을 올리려면 100 스테이지의 `difficultyMult` 를 다시 잡아야 한다.
 */
const AD_GAIN_MAX = 0.2;

for (const s of CHECKPOINTS) {
    const enemyHp = growthMultiplier(s, S.enemyHpGrowth);
    const t = targetPower(s);
    const days = daysToStage(s);

    const needGold = requiredGold(s);
    const haveGold = availableGold(s);
    /**
     * ★★★ **광고를 켠 곡선도 함께 잰다** (2026-08-07).
     *   광고가 경제를 망가뜨려도 검증이 그것을 모르면 아무도 실패하지 않는다 —
     *   이 저장소가 반복해서 당한 "선언했는데 아무도 안 읽는 것"의 경제판이다.
     */
    const haveGoldAds = ADS.enabled === true ? availableGold(s, { ads: true }) : haveGold;
    const goldRatio = haveGold / needGold;
    const powerRatio = t.power / enemyHp;

    if (goldRatio < 1) goldFail++;
    /**
     * ★★ 광고를 켠 여유가 `adRatioMax` 를 넘으면 **경제 벽이 사라진 것**이다.
     *   광고 없이도 도달하는 것이 설계이므로(설계 결정 5), 광고는 '조금 빨라지는 것'
     *   이어야지 '다른 게임'이 되면 안 된다. 상한은 데이터가 정한다.
     */
    if (ADS.enabled === true && haveGoldAds / haveGold > 1 + AD_GAIN_MAX) adGoldFail++;
    // 아군 파워가 적 HP 의 0.75배 밑으로 떨어지면 편성으로 메울 수 없는 구간이다
    if (powerRatio < 0.75) powerFail++;

    const mark = goldRatio < 1 || powerRatio < 0.75 ? "✗" : " ";
    console.log(
        `${mark}${String(s).padStart(3)} ${days.toFixed(1).padStart(5)} ` +
            `${enemyHp.toFixed(1).padStart(7)} ${t.power.toFixed(1).padStart(9)} ` +
            `${powerRatio.toFixed(2).padStart(5)} │ ` +
            `${Math.round(needGold).toLocaleString().padStart(10)} ` +
            `${Math.round(haveGold).toLocaleString().padStart(10)} ${goldRatio.toFixed(2).padStart(5)} ` +
            (ADS.enabled === true
                ? `광고 ${(haveGoldAds / needGold).toFixed(2).padStart(5)} ` +
                  `+${(((haveGoldAds - haveGold) / haveGold) * 100).toFixed(0).padStart(3)}% `
                : "") +
            "│ " +
            `Lv${String(t.level).padStart(3)} 무기고 ${String(t.armory.level).padStart(2)} ` +
            `훈련장 ${String(requiredTrainingYard(s)).padStart(2)}`
    );
}

console.log("──────────────────────────────────────────────────────────────────");

const fails = [];
if (goldFail) fails.push(`골드 부족 ${goldFail}개 구간 — 목표 파워에 도달할 수 없다`);
if (powerFail) fails.push(`파워 미달 ${powerFail}개 구간 — 편성으로 메울 수 없는 벽`);
if (adGoldFail)
    fails.push(
        `광고 증가분 초과 ${adGoldFail}개 구간 (> +${Math.round(AD_GAIN_MAX * 100)}%) — ` +
            `광고가 경제 벽을 없앤다. ads.json 의 rewardMult · dailyViews · minStage 를 낮춰라 ` +
            `(docs/06-release/56-admob-rewarded-integration.md §6)`
    );

if (fails.length) {
    console.log("✗ 실패");
    for (const f of fails) console.log(`  · ${f}`);
    console.log("\n조정 후보:");
    console.log("  · balance.json economy.goldPerStageBase / goldPerStageGrowth");
    console.log("  · balance.json economy.repeatFactor (반복 클리어 가정)");
    console.log("  · meta.json ark.facilities[armory|trainingYard].goldBase / goldGrowth");
    console.log("  · balance.json scaling.enemyHpGrowth (적 성장 완화)");
    process.exit(1);
}

console.log("✅ 통과 — 무과금이 의도한 파워 곡선에 도달할 수 있다");
console.log(`(스테이지 1–${MAX_STAGE} 검사)`);
