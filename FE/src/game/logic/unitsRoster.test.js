/**
 * 로스터 성질 검증 (P6-04).
 *
 * ★ 여기서 묻는 것은 "수치가 좋은가"가 아니다. 그건 밸런스 하네스가 답한다.
 *   이 파일은 **동료를 추가할 때 조용히 깨지는 것들**만 고정한다.
 *   전부 실제로 한 번씩 일어났거나, 코드를 읽어야만 알 수 있어서 반드시 다시 일어날 것들이다.
 *
 *   ① 파일 순서 — `stagePreview.recommendedLoadout` 은 후보를 **units.json 순서로** 훑는다.
 *      중간에 한 종을 끼워 넣으면 100 스테이지의 추천 편성이 통째로 바뀌고,
 *      게이트 B3(설계된 첫 패배)·B4(무과금 추천 승률) 수치가 같이 움직인다.
 *      "동료를 하나 넣었을 뿐인데 난이도 곡선이 달라졌다"는 원인 추적이 거의 불가능하다.
 *
 *   ② 도달 가능성 — 게이트 B7 은 **모든 동료가 최소 1개 편성에 등장**할 것을 요구한다(하드).
 *      아키타입은 등급 티어(C·R)와 코스트 상위 6종만 훑으므로, 그 사이에 낀 코스트로
 *      추가하면 **아무 편성에도 못 들어가는 동료**가 생긴다. 실제로 `goblin_fighter` 가
 *      성능이 아니라 파일 순서 때문에 그렇게 됐었다.
 *
 *   ③ 적혀 있는데 작동하지 않는 필드 — 시뮬이 읽지 않는 키를 데이터에 적으면
 *      "능력이 있다고 적힌 동료"가 생긴다. `pierce` 와 `projectile` 이 실제로 그랬다.
 *
 * ★ 규칙은 전부 **원본에서 import 해서** 묻는다. 여기에 규칙을 다시 적으면
 *   그 사본이 갈라지는 순간 이 파일이 거짓말을 시작한다.
 *
 * @see docs/04-plan/33-execution-plan.md P6-04
 */
import { describe, it, expect } from "vitest";
import unitsData from "../data/units.json" with { type: "json" };
import { ROLE_ORDER } from "./roles.js";
import { TAG, tagsToMask } from "./tags.js";
// ★ '공중에 닿는가'는 전투 규칙이다. 판정을 여기에 옮겨 적지 않는다.
import { canHitFlying } from "./combat.js";
// ★ 게이트 B7 이 실제로 쓰는 편성 목록. 하네스와 같은 것을 물어야 의미가 있다.

const UNITS = unitsData.units;
const byId = (id) => UNITS.find((u) => u.id === id);

/**
 * P6-04 2차 확장 **이전**의 25종 — 파일 순서 그대로.
 * ★ 값을 갱신하려면 그 앞에 무엇이 끼어들었는지 먼저 설명할 수 있어야 한다.
 *   (끝에 덧붙이는 것은 이 배열을 건드리지 않는다 — 그것이 이 배열의 요점이다.)
 */
const LEGACY_ORDER = [
    "slow_turtle",
    "bold_man_at_arms",
    "honking_goose",
    "clucking_chicken",
    "determined_soldier",
    "elf_sharpshooter",
    "novice_pyromancer",
    "devout_acolyte",
    "jovial_friar",
    "spikey_porcupine",
    "goblin_fighter",
    "halfling_slinger",
    "goblin_archer",
    "merfolk_javelineer",
    "elf_wayfarer",
    "leaf_ranger",
    "wind_hashashin",
    "iron_golem",
    "magical_fairy",
    "deft_sorceress",
    "fire_elemental",
    "adept_necromancer",
    "holy_crusader",
    "favored_cleric",
    "resolute_angel",
];

/** P6-04 2차 확장에서 채운 칸 — 각각이 존재하는 이유 */
const FILLED_CELLS = [
    { role: "RANGED", dmgType: "arcane", why: "원거리 7종이 전원 물리였다 (W4 ARMORED 26%)" },
    { role: "SIEGE", dmgType: "arcane", why: "방벽 뒤에서 넘겨 쏘는 술식이 없었다" },
    { role: "MELEE", dmgType: "holy", why: "W5 CORRUPT 73% 인데 전열 신성이 방벽 1종뿐이었다" },
    { role: "BLOCKER", dmgType: "arcane", why: "막으면서 DEF 를 무시할 수단이 없었다" },
    { role: "FLYER", dmgType: "physical", why: "WARDED+FLYING 의 답인 물리 대공이 2종뿐이었다" },
];

describe("로스터 규모", () => {
    it("★ 로스터 50종이고 id 가 겹치지 않는다 (2026-08-04 확장)", () => {
        expect(UNITS.length).toBe(50);
        expect(new Set(UNITS.map((u) => u.id)).size).toBe(UNITS.length);
    });

    it("기존 25종의 파일 순서가 그대로 앞에 남아 있다", () => {
        // ★ 추천 편성의 후보 순회가 파일 순서다. 중간 삽입은 100 스테이지의
        //   추천을 바꾸고 그대로 B3·B4 수치를 바꾼다.
        expect(UNITS.slice(0, LEGACY_ORDER.length).map((u) => u.id)).toEqual(LEGACY_ORDER);
    });

    it("모든 역할이 roles.js 에 있다", () => {
        const unknown = [...new Set(UNITS.map((u) => u.role))].filter(
            (r) => !ROLE_ORDER.includes(r)
        );
        expect(unknown, `ROLE_ORDER 에 없는 역할: ${unknown.join(", ")}`).toEqual([]);
    });
});

describe("역할 × 데미지타입 구멍", () => {
    it.each(FILLED_CELLS)("$role × $dmgType 이 비어 있지 않다 — $why", ({ role, dmgType }) => {
        const hit = UNITS.filter((u) => u.role === role && u.dmgType === dmgType);
        expect(hit.length, `${role} × ${dmgType}`).toBeGreaterThan(0);
    });

    it("물리 대공이 3종 이상이다", () => {
        // ★ WARDED(RES 높음)는 물리로만 뚫리고, FLYING 은 ANTI_AIR 로만 닿는다.
        //   둘이 겹친 적(월드 5)의 답은 **물리 대공**뿐이라, 2종은 6칸 편성에서
        //   다른 요구와 부딪치면 곧바로 답이 사라진다 (5-15 · 5-19 벽).
        const n = UNITS.filter(
            (u) => u.dmgType === "physical" && (u.tags ?? []).includes("ANTI_AIR")
        ).length;
        expect(n).toBeGreaterThanOrEqual(3);
    });

    it("술식 최속이 500ms 이하다 — ARMORED+SHIELDED 의 유일한 답", () => {
        // ★ SHIELDED 는 피해량이 아니라 **피격 횟수**를 흡수한다(combat.computeDamage).
        //   ARMORED 는 술식으로만 뚫린다. 둘이 겹치면 '술식이면서 자주 때리는' 것
        //   하나만 답이 되는데, 확장 전 술식 최속은 magical_fairy 900ms 였다.
        const fastest = Math.min(
            ...UNITS.filter((u) => u.dmgType === "arcane").map((u) => u.base.atkInterval)
        );
        expect(fastest).toBeLessThanOrEqual(500);
    });
});

describe("시뮬이 실제로 읽는 것만 적혀 있다", () => {
    /**
     * `stageConfig.normalizeDef` 가 옮기는 키 + 데이터 전용 메타(등급·이름·연출).
     * ★ 여기 없는 키를 데이터에 적으면 시뮬이 조용히 무시한다 — 그것이 곧
     *   "능력이 있다고 적혀 있는데 실제로는 없는 동료"다.
     */
    const TOP_KEYS = new Set([
        "$comment",
        "id",
        "name",
        "flavor",
        "rarity",
        "role",
        "dmgType",
        "tags",
        "cost",
        "squad",
        "pierce",
        "base",
        "art",
        "projectile",
    ]);
    const BASE_KEYS = new Set([
        "hp",
        "atk",
        "def",
        "res",
        "range",
        "speed",
        "atkInterval",
        "blockCount",
        "pierce",
        "shield",
    ]);

    it("모든 동료가 알려진 필드만 갖는다", () => {
        for (const u of UNITS) {
            const bad = Object.keys(u).filter((k) => !TOP_KEYS.has(k));
            expect(bad, `${u.id}: 시뮬이 읽지 않는 필드`).toEqual([]);
            const badBase = Object.keys(u.base).filter((k) => !BASE_KEYS.has(k));
            expect(badBase, `${u.id}.base: 시뮬이 읽지 않는 필드`).toEqual([]);
        }
    });

    it("모든 태그가 tags.js 에 정의돼 있다", () => {
        for (const u of UNITS) expect(() => tagsToMask(u.tags), u.id).not.toThrow();
    });

    it("물리 비행 동료는 반드시 ANTI_AIR 를 갖는다", () => {
        // ★ 공중 레인에 있는 적은 전부 FLYING 이므로, ANTI_AIR 없는 물리 비행은
        //   canTarget 이 항상 false 다 — 평생 한 대도 때리지 못하는 동료가 된다.
        for (const u of UNITS.filter((x) => x.role === "FLYER")) {
            expect(canHitFlying(tagsToMask(u.tags), u.dmgType), `${u.id} 가 공중에 닿지 못한다`).toBe(
                true
            );
        }
    });

    it("ANTI_AIR 를 물리가 아닌 동료에게 붙이지 않는다", () => {
        // ★ 술식·신성은 canHitFlying 이 이미 참이다. 태그를 또 붙이면 도감·프리뷰에서
        //   "이 태그가 있어야 공중을 때린다"는 잘못된 규칙을 가르친다.
        const redundant = UNITS.filter(
            (u) => u.dmgType !== "physical" && (u.tags ?? []).includes("ANTI_AIR")
        ).map((u) => u.id);
        // ★ 기존 2종(magical_fairy · resolute_angel)은 P6-04 이전부터 있던 표기라 남긴다.
        //   **새로 추가하는 동료에는 붙이지 않는다** — 그래서 이 목록이 늘어나면 실패한다.
        expect(redundant).toEqual(["magical_fairy", "resolute_angel"]);
    });
});

/**
 * ★★ **게이트 B7 은 2026-08-04 에 질문이 바뀌었다** (로스터 30 → 50).
 *   "모든 동료가 고정 아키타입에 등장하는가"는 로스터가 아키타입보다 커지는 순간
 *   자동으로 실패하는 질문이었다 — 게이트가 "쓸모없는 동료"가 아니라
 *   "로스터가 크다"를 재고 있었다. 지금 묻는 것은 `tools/balance-check.mjs` 의
 *   B7a(클래스가 죽지 않았는가) · B7b(완전히 열등한 동료가 없는가)이고,
 *   아래는 그중 **데이터만으로 판정되는 B7b** 를 여기서도 지킨다.
 */
describe("게이트 B7b — 완전히 열등한 동료가 없다", () => {
    const dps = (u) => (u.base.atk / (u.base.atkInterval / 1000)) * (u.squad ?? 1);

    it("고를 이유가 없는 동료가 하나도 없다", () => {
        const dominated = [];
        for (const a of UNITS) {
            for (const b of UNITS) {
                if (a.id === b.id || a.role !== b.role || a.dmgType !== b.dmgType) continue;
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
        expect(
            dominated,
            "같은 역할·데미지타입에서 모든 지표가 열등한 동료다 — 어떤 편성에서도 고를 이유가 없다"
        ).toEqual([]);
    });

    it("★ 모든 역할 × 데미지타입 조합에 최소 2종이 있다 — 선택이 성립한다", () => {
        const byClass = {};
        for (const u of UNITS) (byClass[`${u.role}/${u.dmgType}`] ??= []).push(u.id);
        const lonely = Object.entries(byClass)
            .filter(([, ids]) => ids.length < 2)
            .map(([c, ids]) => `${c}(${ids.join(",")})`);
        /**
         * ★ 1종뿐인 클래스는 "그 답이 필요하면 그 유닛뿐"이라 편성 퍼즐이 아니라 정답이 된다.
         *   아래 7개는 **로스터 확장(2026-08-04) 이전부터 있던 것**이고, 이 목록이
         *   **늘어나면 실패한다** — 새 동료를 넣으면서 새로운 외톨이 클래스를 만들지 않는다.
         */
        expect(lonely.sort()).toEqual([
            "BLOCKER/arcane(grizzled_treant)",
            "BLOCKER/holy(holy_crusader)",
            "CASTER/holy(devout_acolyte)",
            "FLYER/holy(resolute_angel)",
            "FLYER/physical(pygmy_wyvern)",
            "MELEE/arcane(fire_elemental)",
            "MELEE/holy(blessed_gladiator)",
            "RANGED/arcane(merfolk_mystic)",
        ]);
    });
});

describe("신규 5종이 기존 동료와 겹치지 않는다", () => {
    const ADDED = [
        "merfolk_mystic",
        "pygmy_wyvern",
        "water_elemental",
        "blessed_gladiator",
        "grizzled_treant",
    ];

    it("전부 존재한다", () => {
        for (const id of ADDED) expect(byId(id), id).toBeTruthy();
    });

    it("아틀라스 프레임을 다른 동료와 공유하지 않는다", () => {
        // ★ 프레임이 겹치면 편성 화면에서 서로 다른 두 동료가 같은 그림으로 뜬다.
        const keys = UNITS.map((u) => `${u.art.atlas}/${u.art.frame}`);
        expect(new Set(keys).size, "중복된 art 프레임").toBe(keys.length);
    });

    it("공성 동료는 사거리가 방벽보다 길다 — 넘겨 쏘지 못하면 포대가 아니다", () => {
        // ★ 아군은 사거리 안에 적이 들어와야 멈춘다. 사거리가 짧은 공성은
        //   전선을 영원히 따라가기만 하고 한 발도 쏘지 못한다 (iron_golem 실측).
        const maxBlockerRange = Math.max(
            ...UNITS.filter((u) => u.role === "BLOCKER").map((u) => u.base.range)
        );
        for (const u of UNITS.filter((x) => x.role === "SIEGE")) {
            expect(u.base.range, `${u.id} 사거리`).toBeGreaterThan(maxBlockerRange * 3);
        }
    });

    it("방벽은 전부 blockCount 를 갖는다", () => {
        for (const u of UNITS.filter((x) => x.role === "BLOCKER")) {
            expect(u.base.blockCount, u.id).toBeGreaterThan(0);
        }
    });

    it("TAG 상수에 ANTI_AIR 가 있다 — 태그 이름이 바뀌면 위 검사들이 무의미해진다", () => {
        expect(TAG.ANTI_AIR).toBeTypeOf("number");
    });
});
