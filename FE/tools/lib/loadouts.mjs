/**
 * 편성 아키타입 (P4-09)
 *
 * 시뮬레이터는 **사람이 만들 법한 편성 패턴**을 대표해야 한다.
 * 실패 케이스(방벽 없음·상성 불일치·스팸)를 포함하는 것이 핵심이다 —
 * 그것들이 실제로 져야 검증이 의미를 갖는다.
 *
 * @see docs/03-tech/27-testing-balance-harness.md §4.2
 */
import { UNIT_DEFS } from "../../src/game/logic/stageConfig.js";
import { recommendedLoadout, recommendedLoadoutForStage } from "../../src/game/logic/stagePreview.js";
import unitsData from "../../src/game/data/units.json" with { type: "json" };

/**
 * ★ 추천 편성 로직은 **게임 코드가 갖는다** (P6-09).
 *   여기에 사본을 두면 하네스가 검증하는 편성과 게임 안 [추천 적용] 버튼이
 *   조용히 갈라진다 — 그 순간 게이트 B4 수치는 플레이어 경험을 대변하지 못한다.
 *   재수출만 하고 구현은 `src/game/logic/stagePreview.js` 하나뿐이다.
 *
 * ★ 스테이지 추천은 **반드시 `recommendedLoadoutForStage(id)`** 를 쓴다.
 *   태그 집합만 넘기면 마릿수를 모르고, 마릿수를 모르면 "그 태그를 지닌 적이
 *   비행인가"를 물을 수 없어 **닿지 못하는 답**이 뽑힌다 (5-15 · 5-19 벽).
 *   `recommendedLoadout(tagSet)` 은 스테이지가 없는 합성 검사(B7)용으로만 남긴다.
 */
export { recommendedLoadout, recommendedLoadoutForStage };

const ALL = Object.values(UNIT_DEFS);
const byRole = (r) => ALL.filter((u) => u.role === r).map((u) => u.id);
const byDmg = (d) => ALL.filter((u) => u.dmgType === d).map((u) => u.id);
/**
 * 최저가 **딜러**. 순수 벽(ATK 0)을 고르면 승률 0% 라는 무의미한 결과가 나온다 —
 * 검증하려는 것은 "스팸이 다양화보다 나쁜가" 이지 "딜이 없으면 지는가" 가 아니다.
 */
const cheapestDealer = () =>
    ALL.filter((u) => u.atk > 0).sort((a, b) => a.cost - b.cost)[0].id;
const priciest = () => ALL.slice().sort((a, b) => b.cost - a.cost)[0].id;

const take = (arr, n) => arr.slice(0, n);
/**
 * 등급은 시뮬 수치가 아니라 **소유 진행도**라서 `UNIT_DEFS` 에 없다.
 * (거기 넣으면 전투 로직이 등급을 읽을 수 있게 되고, 그건 규칙이 아니다.)
 * 하네스만 원본 데이터에서 직접 가져온다.
 */
const RARITY = new Map(unitsData.units.map((u) => [u.id, u.rarity]));

/** 해당 등급에서 싼 순서로 n 종. 동가면 id 로 타이브레이크 (결정론) */
const byRarityCheapest = (rarity, n) =>
    ALL.filter((u) => RARITY.get(u.id) === rarity)
        .sort((a, b) => a.cost - b.cost || (a.id < b.id ? -1 : 1))
        .slice(0, n)
        .map((u) => u.id);

/**
 * ★★ 아키타입은 **항상 6칸을 채운다.**
 *
 *   로스터에 술식이 2종뿐이라 `arcane_heavy` 가 `방벽 + 2 = 3인` 으로 구성되고
 *   있었다. 그걸 6인 `physical_only` 와 비교했으니 B5(ARMORED 에 술식 > 물리)가
 *   실패한 것은 **데미지 타입 때문이 아니라 인원수 때문**이었다.
 *   빈 칸을 남기면 비교가 성립하지 않는다 — 슬롯 수를 맞춘 뒤에야
 *   "타입이 유리한가"를 물을 수 있다.
 *
 *   채우는 순서는 역할 다양성 우선(방벽·근접·원거리·시전·지원·공성)이며,
 *   같은 값이면 싼 것부터 — 실제 플레이어가 남는 칸을 메우는 방식이다.
 */
const ROLE_FILL = ["BLOCKER", "MELEE", "RANGED", "CASTER", "SUPPORT", "SIEGE", "FLYER", "SPECIALIST"];

function padTo6(picks) {
    const out = picks.filter(Boolean);
    if (out.length >= 6) return out.slice(0, 6);
    for (const r of ROLE_FILL) {
        const pool = ALL.filter((u) => u.role === r).sort((a, b) => a.cost - b.cost);
        for (const u of pool) {
            if (out.length >= 6) return out;
            if (!out.includes(u.id)) out.push(u.id);
        }
    }
    return out;
}

/** 고정 아키타입 10종 */
export const ARCHETYPES = [
    {
        id: "balanced",
        label: "균형",
        units: padTo6([
            byRole("BLOCKER")[0],
            byRole("MELEE")[0],
            byRole("RANGED")[0],
            byRole("CASTER")[0],
            byRole("SUPPORT")[0],
            byRole("SIEGE")[0],
        ]),
    },
    {
        id: "physical_only",
        label: "물리 일변도",
        units: padTo6(
            take(
                byDmg("physical").filter((id) => UNIT_DEFS[id].atk > 0),
                6
            )
        ),
    },
    {
        id: "arcane_heavy",
        label: "술식 중심",
        units: padTo6([byRole("BLOCKER")[0], ...byDmg("arcane")]),
    },
    {
        id: "holy_heavy",
        label: "신성 중심",
        units: padTo6([byRole("BLOCKER")[0], ...byDmg("holy")]),
    },
    {
        id: "no_blocker",
        label: "방벽 없음",
        units: take(
            ALL.filter((u) => u.role !== "BLOCKER").map((u) => u.id),
            6
        ),
    },
    {
        id: "spam_cheapest",
        label: "최저가 스팸",
        // ★ 방벽 1 + 최저가 딜러 1. "다양화보다 스팸이 나쁜가" 를 검증하는 편성이다.
        units: [byRole("BLOCKER")[0], cheapestDealer()].filter(Boolean),
    },
    {
        id: "all_expensive",
        label: "고코스트만",
        units: take(
            ALL.slice()
                .sort((a, b) => b.cost - a.cost)
                .map((u) => u.id),
            6
        ),
        note: priciest(),
    },
    {
        id: "turtle",
        label: "방벽 과다",
        units: [...byRole("BLOCKER"), ...take(byRole("SIEGE"), 1)].filter(Boolean),
    },
    /**
     * ★★ 공성 중심 — **로스터 확장(2026-08-04)이 드러낸 사각.**
     *
     *   기존 아키타입 11종에는 공성을 축으로 삼는 편성이 없었다. `balanced` 가
     *   `byRole("SIEGE")[0]` 한 기를 넣을 뿐이고, `arcane_heavy` 는 술식 유닛이
     *   14종이 되면서 `padTo6` 의 앞 6칸에서 공성이 잘렸다. 그 결과
     *   **`SIEGE/arcane` 클래스가 어떤 편성 원형에도 나오지 않게 됐다** (게이트 B7a).
     *
     *   게이트를 무르게 하는 대신 원형을 만든다 — 공성 과다는 실제로 존재하는
     *   플레이 방식이고("뒤에서 다 부순다"), 그것이 통하는지 재는 것 자체가 값이 있다.
     *
     * ★ 방벽 1기는 넣는다. 공성만으로 6칸을 채우면 전선이 없어서
     *   "공성이 약한가"가 아니라 "방벽이 없으면 지는가"를 재게 된다 (B16 이 그 질문이다).
     */
    {
        id: "siege_heavy",
        label: "공성 중심",
        units: padTo6([byRole("BLOCKER")[0], ...byRole("SIEGE")]),
    },
    /**
     * ★★ 등급 티어 편성 — **"C만 가진 사람이 벽에 막히는가"**
     *
     *   기존 8종은 전부 로스터 전체를 쓸 수 있다고 가정했다. 그건 아무도
     *   겪지 않는 상황이다: 초반 플레이어는 C 등급밖에 없고, 중반에야 R 이 모인다.
     *   등급이 곧 진행도인데 그 축을 아예 재지 않고 있었다.
     *
     *   그리고 이 축이 없으면 로스터가 커질수록 **어떤 편성에도 못 들어가는
     *   유닛**이 생긴다 (실제로 `goblin_fighter` 가 그랬다 — 성능이 아니라
     *   `take(..., 6)` 의 파일 순서에서 밀렸다). 등급별로 훑으면 그 사각이 사라진다.
     *
     * ★ 티어 편성은 6칸을 억지로 채우지 않는다. 채우려면 다른 등급을 끌어와야
     *   하는데, 그 순간 "그 등급만으로 되는가" 라는 질문 자체가 사라진다.
     */
    {
        id: "c_only",
        label: "C 등급만",
        // 마나가 가장 마른 구간이므로 **싼 순서**가 곧 실제 선택이다
        units: byRarityCheapest("C", 6),
    },
    {
        id: "r_only",
        label: "R 등급만",
        units: byRarityCheapest("R", 6),
    },
];
