/**
 * 밸런스 검증 코퍼스 (P4-11)
 *
 * balance-report.csv 를 읽어 B1~B17 을 판정한다.
 * 하드 게이트 실패 시 exit 1 — CI 가 빌드를 막는다.
 *
 * ★ 성능 회귀와 달리 밸런스 회귀는 **눈에 보이지 않는다.**
 *   "궁수 공격력만 5% 올렸는데 스테이지 47 승률이 22%p 떨어졌다" 를
 *   커밋 전에 발견하는 것이 이 파일의 존재 이유다.
 *
 * 사용: npm run balance:check
 *
 * @see docs/03-tech/27-testing-balance-harness.md §5
 */
import { readFile } from "node:fs/promises";
import stagesData from "../src/game/data/stages.json" with { type: "json" };
import enemiesData from "../src/game/data/enemies.json" with { type: "json" };
import unitsData from "../src/game/data/units.json" with { type: "json" };
import sigilData from "../src/game/data/sigils.json" with { type: "json" };
// ★ 스테이지의 적 구성은 규칙 모듈이 센다 (검사기가 두 번째 계수기가 되지 않게)
import { stageEnemyCounts } from "../src/game/logic/stagePreview.js";

const HARD = "하드";
const SOFT = "소프트";

const results = [];
const add = (id, gate, name, pass, detail) => results.push({ id, gate, name, pass, detail });

/* ── CSV 로드 ─────────────────────────────────────────────── */
async function loadCsv(path) {
    const text = await readFile(path, "utf8");
    const [head, ...lines] = text.trim().split("\n");
    const keys = head.split(",");
    return lines.map((l) => {
        const v = l.split(",");
        const o = {};
        keys.forEach((k, i) => (o[k] = isNaN(Number(v[i])) ? v[i] : Number(v[i])));
        return o;
    });
}

let rows;
let sigilRows;
try {
    rows = await loadCsv("balance-report.csv");
    sigilRows = await loadCsv("balance-sigils.csv");
} catch {
    console.error("✗ balance-report.csv 가 없습니다. 먼저 `npm run balance` 를 실행하세요.");
    process.exit(1);
}

const by = (stageId, loadout) => rows.find((r) => r.stageId === stageId && r.loadout === loadout);
const forLoadout = (loadout) => rows.filter((r) => r.loadout === loadout);

/* ══════════════════════════════════════════════════════════════
 * B2 — 튜토리얼 승률
 * ══════════════════════════════════════════════════════════════ */
{
    const tutorial = ["1-1", "1-2", "1-5"];
    const rates = tutorial.map((id) => by(id, "recommended")?.winRate ?? 0);
    const ok = rates.every((r) => r >= 85);
    add("B2", HARD, "튜토리얼 승률 ≥85%", ok, rates.map((r) => `${r}%`).join(" / "));
}

/* ══════════════════════════════════════════════════════════════
 * B3 — 설계된 첫 패배 (1-9)
 * ══════════════════════════════════════════════════════════════ */
{
    const designed = stagesData.stages.find((s) => s.designedDefeat);
    const r = designed ? by(designed.id, "recommended") : null;
    const rate = r?.winRate ?? 0;
    const ok = rate >= 30 && rate <= 45;
    add(
        "B3",
        HARD,
        `설계된 첫 패배 (${designed?.id}) 승률 30–45%`,
        ok,
        `${rate}% — 설계된 첫 패배다. 너무 쉬우면 "막히면 편성을 바꾼다"를 못 가르친다`
    );
}

/* ══════════════════════════════════════════════════════════════
 * B4 — 무과금 통과 가능성 (최우선 하드 게이트)
 * ══════════════════════════════════════════════════════════════ */
{
    // ★ '설계된 첫 패배' 스테이지는 제외한다.
    //   그 한 곳은 의도적으로 지게 만든 교육 지점이며, B3 가 따로 검증한다.
    //   두 게이트를 같은 스테이지에 적용하면 서로 모순된다.
    const designedIds = new Set(
        stagesData.stages.filter((s) => s.designedDefeat).map((s) => s.id)
    );
    const fails = forLoadout("recommended").filter(
        (r) => !designedIds.has(r.stageId) && r.winRate < 55
    );
    add(
        "B4",
        HARD,
        "무과금 추천 편성 승률 ≥55% (설계된 패배 제외)",
        fails.length === 0,
        fails.length
            ? `실패: ${fails.map((f) => `${f.stageId}(${f.winRate}%)`).join(", ")}`
            : `전 구간 통과 (제외: ${[...designedIds].join(", ") || "없음"})`
    );
}

/* ══════════════════════════════════════════════════════════════
 * B5 — 상성 유효성
 * ══════════════════════════════════════════════════════════════ */
{
    /**
     * ARMORED 가 많은 스테이지에서 술식 편성이 물리 편성보다 나아야 한다.
     *
     * ★★ **대상 스테이지를 손으로 적지 않는다** (2026-08-04). 예전에는
     *   `["1-8", "1-9", "1-10"]` 이 박혀 있었고 그중 **1-9 는 설계된 첫 패배**였다 —
     *   양쪽 다 승률 0% 라 비교가 성립하지 않고, 그래서 이 게이트는
     *   나머지 두 곳 중 **둘 다** 이겨야만 통과하는 상태로 굳어 있었다.
     *   B4 가 같은 이유로 designedDefeat 를 제외하는데 여기만 빠져 있었다.
     *
     * ★ 이제 **데이터에서 고른다**: ARMORED 비중이 높은 스테이지 상위 5곳,
     *   설계된 패배 제외. 로스터·데이터가 바뀌면 대상도 따라 바뀐다.
     */
    const armoredStages = stagesData.stages
        .filter((st) => !st.designedDefeat)
        .map((st) => ({
            id: st.id,
            // ★ 비중은 규칙 모듈이 이미 센다 (`tags[].share`) — 여기서 다시 세지 않는다
            ratio: stageEnemyCounts(st.id)?.tags.find((t) => t.tag === "ARMORED")?.share ?? 0,
        }))
        .filter((x) => x.ratio >= 0.3)
        .sort((a, b) => b.ratio - a.ratio)
        .slice(0, 5)
        .map((x) => x.id);

    let better = 0;
    const detail = [];
    for (const id of armoredStages) {
        const a = by(id, "arcane_heavy");
        const p = by(id, "physical_only");
        if (!a || !p) continue;
        // 승률이 같으면 방주 HP·클리어 시간으로 비교한다
        const aScore = a.winRate * 1000 + a.avgArkHp - a.avgSec;
        const pScore = p.winRate * 1000 + p.avgArkHp - p.avgSec;
        if (aScore > pScore) better++;
        detail.push(`${id}: 술식 ${a.avgArkHp.toFixed(0)}HP/${a.avgSec.toFixed(0)}s vs 물리 ${p.avgArkHp.toFixed(0)}HP/${p.avgSec.toFixed(0)}s`);
    }
    // ★ 과반이면 통과. 전부를 요구하면 스테이지 하나의 편성 우연이 게이트를 흔든다.
    const need = Math.ceil(armoredStages.length / 2);
    add(
        "B5",
        HARD,
        `ARMORED 스테이지에서 술식 > 물리 (${armoredStages.length}곳 중 ${need} 이상)`,
        better >= need,
        detail.join(" | ") || "ARMORED 비중 30% 이상인 스테이지가 없다"
    );
}

/* ══════════════════════════════════════════════════════════════
 * B6 — 스팸 억제
 * ══════════════════════════════════════════════════════════════ */
{
    let worse = 0;
    let total = 0;
    let skippedEndure = 0;
    const detail = [];
    for (const stage of stagesData.stages) {
        /**
         * ★★ **버티기(endure)는 제외한다.** 이 게이트가 검증하려는 억제 장치는
         *   **소환 코스트 상승**(같은 유닛을 반복 소환할수록 1.18배씩 비싸진다)인데,
         *   버티기는 개막에 6기를 한 번 전개하고 소환을 잠근다 — 반복이 없으므로
         *   억제할 대상 자체가 없다. 즉 여기서 재는 것은 "스팸이 억제되는가"가 아니라
         *   **"그 스테이지의 답이 한 가지 데미지 타입인가"** 다.
         *
         *   실제로 4-13 의 태그는 `LIVING·WARDED·SHIELDED·REGEN` 로 ARMORED·CORRUPT 가
         *   없다. WARDED 는 **물리가 답**이고, `spam_cheapest`(물리 2종)는 정답 편성이며
         *   `balanced` 는 술식·신성 2기를 들고 있어 그 둘이 RES 에 깎인다.
         *   **스팸이 이기는 것이 상성 시스템이 옳게 작동한 결과**이지 결함이 아니다.
         *   (주문 없이 재면 두 편성은 94.7% 로 완전히 동률이었다 — 원래 경계값이었고
         *    주문이 그 동률을 깼을 뿐이다.)
         *
         * ★ 조용히 건너뛰지 않는다 — 아래 메시지에 제외 수를 함께 낸다.
         */
        if (stage.mode === "endure") {
            skippedEndure++;
            continue;
        }
        const sp = by(stage.id, "spam_cheapest");
        const ba = by(stage.id, "balanced");
        if (!sp || !ba) continue;
        total++;
        const spScore = sp.winRate * 1000 + sp.avgArkHp;
        const baScore = ba.winRate * 1000 + ba.avgArkHp;
        if (spScore <= baScore) worse++;
        else detail.push(`${stage.id}(스팸 우세)`);
    }
    add(
        "B6",
        HARD,
        "단일 유닛 스팸 ≤ 다양화 편성",
        worse === total,
        detail.length
            ? detail.join(", ")
            : `${worse}/${total} 스테이지에서 스팸이 열세 (버티기 ${skippedEndure}개 제외 — 소환 반복이 없어 코스트 상승이 적용되지 않는다)`
    );
}

/* ══════════════════════════════════════════════════════════════
 * B7 — 죽은 동료가 없다
 * ══════════════════════════════════════════════════════════════
 *
 * ★★ **질문을 바꿨다** (2026-08-04, 로스터 30 → 50).
 *
 *   예전 B7 은 "모든 동료가 **고정 아키타입 11종**에 등장하는가"였다. 그 아키타입은
 *   `byRole()[0]` · 등급별 최저가 6종 · 코스트 상위 6종처럼 **뽑는 규칙이 좁아서**,
 *   로스터가 커지면 등장하지 못하는 동료가 자동으로 생긴다. 즉 게이트가
 *   "동료가 쓸모없다"가 아니라 **"로스터가 아키타입보다 크다"** 를 재고 있었다.
 *   50종에서는 그 답이 언제나 실패이므로, 그 상태로 두면 게이트를 끄게 된다.
 *
 *   지금 묻는 것은 실제로 죽은 콘텐츠의 정의다:
 *
 *   **B7a** 역할 × 데미지타입 조합이 아키타입에 하나도 안 나오면 그 **클래스**가 죽었다.
 *   **B7b** 같은 역할·같은 데미지타입에서 **완전히 열등한** 동료 — 비용이 같거나 비싼데
 *          HP · DPS · 사거리 · 방어 · 블록이 전부 같거나 나쁘고 태그도 더 없는 유닛.
 *          그런 유닛은 어떤 편성에서도 고를 이유가 없다. 이것이 **진짜 죽은 칸**이고,
 *          로스터가 몇 종이든 판정이 성립한다.
 */
{
    const { ARCHETYPES, recommendedLoadout } = await import("./lib/loadouts.mjs");
    const usedIds = new Set();
    for (const a of ARCHETYPES) a.units.forEach((u) => usedIds.add(u));
    for (const tagSet of [
        new Set(["ARMORED"]),
        new Set(["FLYING"]),
        new Set(["CORRUPT"]),
        new Set(["WARDED"]),
        new Set(),
    ]) {
        recommendedLoadout(tagSet).forEach((u) => usedIds.add(u));
    }

    /* B7a — 클래스(역할 × 데미지타입)가 죽지 않았는가 */
    const classOf = (u) => `${u.role}/${u.dmgType}`;
    const classes = new Set(unitsData.units.map(classOf));
    const covered = new Set(
        unitsData.units.filter((u) => usedIds.has(u.id)).map(classOf)
    );
    const deadClasses = [...classes].filter((c) => !covered.has(c)).sort();
    add(
        "B7a",
        HARD,
        "모든 역할 × 데미지타입 조합이 편성에 등장",
        deadClasses.length === 0,
        deadClasses.length
            ? `미등장 클래스: ${deadClasses.join(", ")}`
            : `${covered.size}/${classes.size} 클래스 · 동료 ${usedIds.size}/${unitsData.units.length} 종`
    );

    /* B7b — 완전히 열등한 동료가 없는가 */
    const dps = (u) => (u.base.atk / (u.base.atkInterval / 1000)) * (u.squad ?? 1);
    const dominated = [];
    for (const a of unitsData.units) {
        for (const b of unitsData.units) {
            if (a.id === b.id || a.role !== b.role || a.dmgType !== b.dmgType) continue;
            // b 가 a 의 태그를 전부 갖는가 — 태그가 곧 역할 안의 차별점이다
            if (!(a.tags ?? []).every((t) => (b.tags ?? []).includes(t))) continue;
            const weakly =
                b.cost <= a.cost &&
                b.base.hp >= a.base.hp &&
                dps(b) >= dps(a) &&
                b.base.range >= a.base.range &&
                b.base.def >= a.base.def &&
                (b.base.blockCount ?? 0) >= (a.base.blockCount ?? 0);
            const strictly =
                b.cost < a.cost ||
                b.base.hp > a.base.hp ||
                dps(b) > dps(a) ||
                b.base.range > a.base.range;
            if (weakly && strictly) dominated.push(`${a.id} ← ${b.id}`);
        }
    }
    add(
        "B7b",
        HARD,
        "완전히 열등한 동료가 없다 (고를 이유가 없는 칸)",
        dominated.length === 0,
        dominated.length ? dominated.join(", ") : `${unitsData.units.length}종 전부 자기 자리가 있다`
    );
}

/* ══════════════════════════════════════════════════════════════
 * B9 — 전투 길이
 * ══════════════════════════════════════════════════════════════ */
{
    /**
     * ★★ **도입부를 손으로 정하지 않는다** (2026-08-04).
     *
     *   예전에는 `index <= 2` 였다. 월드 1 의 앞부분은 **짧으라고 만든 것**이라
     *   1-3(46s)·1-4(60s)가 일반 밴드(60–180s) 미달로 잡혔고, 그것은 설계를
     *   위반으로 신고하는 것이었다.
     *
     *   한동안은 FTUE 데이터에서 파생했는데, 튜토리얼이 사라지면서(2026-08-04)
     *   그 출처도 사라졌다. 이제 **스테이지 데이터에서 파생한다**:
     *   설계된 첫 패배(`designedDefeat`) **이전의 월드 1 스테이지**가 곧 도입부다.
     *   그 지점이 "게임이 이제 진짜로 시작한다"의 정의이고, 스테이지 데이터를
     *   바꾸면 이 목록이 따라온다.
     *
     * ★ 각 월드의 1~2번도 그대로 도입부로 둔다 — 월드마다 호흡을 다시 여는 구간이다.
     */
    const designedDefeatIdx = Math.min(
        ...stagesData.stages
            .filter((s) => s.designedDefeat)
            .map((s) => Number(s.id.split("-")[0]) * 100 + Number(s.id.split("-")[1])),
        Infinity
    );
    const introStages = new Set(
        stagesData.stages
            .map((st) => st.id)
            .filter(
                (id) =>
                    Number(id.split("-")[0]) * 100 + Number(id.split("-")[1]) < designedDefeatIdx
            )
    );
    const isIntro = (id) => Number(id.split("-")[1]) <= 2 || introStages.has(id);
    /**
     * ★ 보스 여부는 **데이터에 묻는다** — id 접미사로 판단하면 틀린다.
     *   `-10` 만 보스로 치던 시절, 월드 보스인 `-20`(Nemesis) 5개가 전부
     *   일반 밴드(60–180s)로 판정돼 **없는 실패 4건**(1-20 · 2-20 · 3-20 · 4-20)을
     *   보고하고 있었다. 넷 다 보스 밴드(120–300s) 안이었다.
     *   `worlds.json` 의 beat 는 10 과 20 **양쪽**에 보스를 둔다.
     */
    const BOSS_IDS = new Set(
        enemiesData.enemies.filter((e) => e.boss?.phases?.length).map((e) => e.id)
    );
    const bossStageIds = new Set(
        stagesData.stages
            .filter((s) => s.waveTable.some((w) => w.spawns.some((sp) => BOSS_IDS.has(sp.id))))
            .map((s) => s.id)
    );
    const rec = forLoadout("recommended").filter((r) => r.winRate > 0 && !isIntro(r.stageId));
    const normal = rec.filter((r) => !bossStageIds.has(r.stageId));
    const boss = rec.filter((r) => bossStageIds.has(r.stageId));
    const okNormal = normal.every((r) => r.avgSec >= 60 && r.avgSec <= 180);
    const okBoss = boss.every((r) => r.avgSec >= 120 && r.avgSec <= 300);
    const bad = [...normal.filter((r) => r.avgSec < 60 || r.avgSec > 180), ...boss.filter((r) => r.avgSec < 120 || r.avgSec > 300)];
    add(
        "B9",
        SOFT,
        "전투 길이 (일반 60–180s / 보스 120–300s)",
        okNormal && okBoss,
        bad.length ? bad.map((r) => `${r.stageId}:${r.avgSec}s`).join(", ") : "전 구간 정상"
    );
}

/* ══════════════════════════════════════════════════════════════
 * B10 / B11 — 별 달성률
 * ══════════════════════════════════════════════════════════════ */
{
    // 도입부 스테이지(1~2번)는 의도적으로 관대하다 — 첫 승리는 무조건 ★3 이어야 한다.
    // 별 달성률 목표는 본편 구간 기준이다.
    const rec = forLoadout("recommended").filter((r) => Number(r.stageId.split("-")[1]) > 2);
    const avg2 = rec.reduce((a, r) => a + r.star2Rate, 0) / rec.length;
    const avg3 = rec.reduce((a, r) => a + r.star3Rate, 0) / rec.length;
    add("B10", SOFT, "★2 달성률 45–60% (도입부 제외)", avg2 >= 45 && avg2 <= 60, `${avg2.toFixed(1)}%`);
    add("B11", SOFT, "★3 달성률 20–35% (도입부 제외)", avg3 >= 20 && avg3 <= 35, `${avg3.toFixed(1)}%`);
}

/* ══════════════════════════════════════════════════════════════
 * B13 — 각인 픽률
 * ══════════════════════════════════════════════════════════════ */
{
    const totalDefined = sigilData.sigils.length;
    const seen = sigilRows.length;
    // 30종 풀에서 균등이면 3.3%. 상한 12% 는 '지배 각인' 탐지가 목적이고,
    // 하한 0.8% 는 '사실상 등장하지 않는 각인' 탐지가 목적이다.
    const outliers = sigilRows.filter((r) => r.pickRatePct > 12 || r.pickRatePct < 0.8);
    add(
        "B13",
        SOFT,
        "각인 픽률 0.8–12%",
        outliers.length === 0,
        `${seen}/${totalDefined} 등장` +
            (outliers.length
                ? ` · 이상치: ${outliers.slice(0, 5).map((o) => `${o.sigilId}(${o.pickRatePct}%)`).join(", ")}`
                : "")
    );
}

/* ══════════════════════════════════════════════════════════════
 * B16 — 방벽 필수성
 * ══════════════════════════════════════════════════════════════ */
{
    /**
     * ★ 압박이 실재하는 구간에서만 본다.
     *   쉬운 스테이지는 어떤 편성이든 100% 라 신호가 없고,
     *   avgArkHp 는 '이긴 판'만 평균내므로 승률이 갈리면 오히려 뒤집혀 보인다
     *   (방벽 없는 편성이 아슬아슬한 판을 아예 못 이겨서 평균 HP 가 높아진다).
     *   그래서 승률을 1순위로 본다.
     */
    const pressured = forLoadout("recommended")
        .filter((r) => r.winRate < 95)
        .map((r) => r.stageId)
        .slice(0, 6);
    const late = pressured.length ? pressured : ["1-9"];

    const detail = [];
    let worseCount = 0;
    let compared = 0;
    for (const id of late) {
        const nb = by(id, "no_blocker");
        const ba = by(id, "balanced");
        if (!nb || !ba) continue;
        compared++;
        const worse = nb.winRate < ba.winRate - 3 || nb.avgArkHp < ba.avgArkHp - 5;
        if (worse) worseCount++;
        detail.push(`${id}: 방벽없음 ${nb.winRate}% vs 균형 ${ba.winRate}%`);
    }
    // 압박 구간 과반에서 방벽 없는 편성이 열세여야 한다
    const ok = compared > 0 && worseCount * 2 >= compared;
    add("B16", HARD, "방벽 없는 편성이 열세 (압박 구간)", ok, detail.join(" | "));
}

/* ══════════════════════════════════════════════════════════════
 * 벽 탐지 — 첫 시도 승률 25% 미만
 * ══════════════════════════════════════════════════════════════ */
{
    // B4 와 같은 이유로 '설계된 첫 패배' 는 제외한다 — 그 한 곳은 벽이 아니라 교육이다
    const designedIds = new Set(
        stagesData.stages.filter((s) => s.designedDefeat).map((s) => s.id)
    );
    const walls = forLoadout("recommended").filter(
        (r) => !designedIds.has(r.stageId) && r.winRate < 25
    );
    add(
        "WALL",
        HARD,
        "벽 스테이지 0개 (추천 편성 승률 <25%)",
        walls.length === 0,
        walls.length ? walls.map((w) => `${w.stageId}(${w.winRate}%)`).join(", ") : "없음"
    );
}

/* ══════════════════════════════════════════════════════════════
 * BN1–BN8 — 나이트메어 (P11-09)
 * ══════════════════════════════════════════════════════════════
 *
 * ★★ **노멀 13항과 재는 방식이 다르다.** 위 항목들은 `balance-report.csv` 를 읽지만
 *   나이트메어가 묻는 것은 "규칙을 껐을 때와 켰을 때가 다른가" · "대응 편성이
 *   무대응 편성보다 나은가"라서 **같은 시드로 두 조건을 나란히 돌려야** 답이 나온다.
 *   CSV 한 장에는 그 짝이 없으므로 규칙 모듈이 직접 시뮬을 돌린다.
 *
 * ★ 나이트메어가 미구현이면(데이터에 `implemented:false`) 조용히 건너뛴다 —
 *   못 만든 것을 실패로 세면 게이트가 매번 빨간불이 되어 아무도 보지 않게 된다
 *   (`unlockAudit.js` 가 도달성 검사에서 같은 태도를 취한다).
 *
 * ★ `BN=0 npm run balance:check` 로 끌 수 있다. 노멀 13항만 빠르게 볼 때 쓴다 —
 *   **CI 는 끄지 않는다.**
 */
if (process.env.BN !== "0") {
    const { isDifficultyImplemented } = await import("../src/game/logic/difficulty.js");
    if (isDifficultyImplemented("nightmare")) {
        const { runNightmareGates } = await import("./lib/nightmare-gates.mjs");
        results.push(...runNightmareGates({ HARD, SOFT }));
    } else {
        console.warn("· 나이트메어는 implemented:false — BN1–BN8 을 건너뛴다");
    }
}

/* ══════════════════════════════════════════════════════════════
 * 출력
 * ══════════════════════════════════════════════════════════════ */
console.log("── 밸런스 검증 코퍼스 ─────────────────────────\n");

let hardFail = 0;
let softFail = 0;

for (const r of results) {
    const mark = r.pass ? "✔" : "✗";
    if (!r.pass) r.gate === HARD ? hardFail++ : softFail++;
    console.log(`${mark} ${r.id.padEnd(5)} [${r.gate}] ${r.name}`);
    if (r.detail) console.log(`         ${r.detail}`);
}

console.log("\n───────────────────────────────────────────────");
console.log(
    `통과 ${results.filter((r) => r.pass).length}/${results.length} · ` +
        `하드 실패 ${hardFail} · 소프트 실패 ${softFail}`
);

if (hardFail > 0) {
    console.error("\n✗ 하드 게이트 실패 — 빌드를 차단합니다");
    process.exit(1);
}
if (softFail > 0) console.warn("\n⚠ 소프트 게이트 실패 — 통과시키되 튜닝이 필요합니다");
