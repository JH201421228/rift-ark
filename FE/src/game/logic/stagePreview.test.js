/**
 * 스테이지 프리뷰 테스트 (P6-09)
 *
 * ★ 이 테스트가 지키는 것은 두 가지다.
 *   1. 집계가 **실제 스폰 수와 같다** — 프리뷰가 거짓말을 하면 편성 퍼즐이 무너진다.
 *   2. 추천 편성이 **밸런스 하네스와 같은 함수다** — 갈라지는 순간 게이트 B4 가
 *      플레이어 경험을 대변하지 못한다.
 */
import { describe, it, expect } from "vitest";
import {
    stageEnemyCounts,
    stageWarnings,
    stagePreview,
    recommendedLoadout,
    recommendedLoadoutForStage,
    TAG_WARNING_RULES,
    STAGE_WARNING_TEXT,
    PREVIEW_TAG_ORDER,
    RECOMMEND_SIZE,
} from "./stagePreview.js";
import { UNIT_DEFS } from "./stageConfig.js";
import { TAG } from "./tags.js";
import { canHitFlying } from "./combat.js";
import stagesData from "../data/stages.json" with { type: "json" };
import enemiesData from "../data/enemies.json" with { type: "json" };
import { LANGS, t } from "../../i18n/index.js";

const ENEMY = Object.fromEntries(enemiesData.enemies.map((e) => [e.id, e]));

/** 프리뷰와 **독립적으로** 다시 센다 — 같은 코드를 두 번 부르는 테스트는 무의미하다 */
function bruteForceCounts(stage) {
    const tags = {};
    let total = 0;
    for (const w of stage.waveTable) {
        for (const sp of w.spawns) {
            total += sp.count;
            for (const t of ENEMY[sp.id].tags ?? []) tags[t] = (tags[t] ?? 0) + sp.count;
        }
    }
    return { total, tags };
}

describe("stageEnemyCounts — 적 태그 집계", () => {
    it("없는 스테이지는 null 이다", () => {
        expect(stageEnemyCounts("99-99")).toBeNull();
    });

    it("1-1 은 구더기 15마리이고 SWARM·LIVING 이 각각 15다", () => {
        const c = stageEnemyCounts("1-1");
        expect(c.total).toBe(15);
        expect(c.enemies).toEqual([
            expect.objectContaining({ id: "foraging_maggot", count: 15 }),
        ]);
        const byTag = Object.fromEntries(c.tags.map((t) => [t.tag, t.count]));
        expect(byTag).toEqual({ SWARM: 15, LIVING: 15 });
    });

    it("60 스테이지 전부 총합·태그별 마릿수가 원본 스폰 테이블과 일치한다", () => {
        for (const stage of stagesData.stages) {
            const c = stageEnemyCounts(stage.id);
            const ref = bruteForceCounts(stage);
            expect(c.total, stage.id).toBe(ref.total);
            const byTag = Object.fromEntries(c.tags.map((t) => [t.tag, t.count]));
            expect(byTag, stage.id).toEqual(ref.tags);
        }
    });

    it("레인 수를 곱하지 않는다 — lanes 는 분배 규칙이지 배수가 아니다", () => {
        // 1-1 wave3 은 count 4 에 lanes 3개다. 곱했다면 12가 되어 총합이 어긋난다.
        const w3 = stagesData.stages[0].waveTable.find((w) => w.wave === 3);
        expect(w3.spawns[0].lanes.length).toBe(3);
        expect(stageEnemyCounts("1-1").total).toBe(15);
    });

    it("share 는 총합 대비 비율이고 0~1 범위다", () => {
        for (const stage of stagesData.stages) {
            for (const t of stageEnemyCounts(stage.id).tags) {
                expect(t.share).toBeGreaterThan(0);
                expect(t.share).toBeLessThanOrEqual(1);
                expect(t.share).toBeCloseTo(t.count / stageEnemyCounts(stage.id).total, 9);
            }
        }
    });

    it("표시 순서는 상성 우선순위를 따른다", () => {
        const c = stageEnemyCounts("3-20");
        const order = c.tags.map((t) => t.tag);
        const expected = PREVIEW_TAG_ORDER.filter((t) => order.includes(t));
        expect(order).toEqual(expected);
    });

    it("결정론 — 같은 스테이지는 항상 같은 결과다", () => {
        const a = stageEnemyCounts("2-13");
        const b = stageEnemyCounts("2-13");
        expect({ ...a, tagSet: [...a.tagSet] }).toEqual({ ...b, tagSet: [...b.tagSet] });
    });

    it("tagSet 은 하네스의 stageTags() 와 같은 집합이다", () => {
        // ★ 추천 편성이 하네스와 일치하려면 입력 태그 집합부터 같아야 한다.
        for (const stage of stagesData.stages) {
            const ref = new Set();
            for (const w of stage.waveTable) {
                for (const sp of w.spawns) for (const t of ENEMY[sp.id].tags ?? []) ref.add(t);
            }
            expect([...stageEnemyCounts(stage.id).tagSet].sort(), stage.id).toEqual([...ref].sort());
        }
    });

    it("보스 스테이지는 페이즈 태그를 따로 낸다 (tagSet 에는 섞지 않는다)", () => {
        const c = stageEnemyCounts("3-20");
        expect(c.bossPhases.length).toBeGreaterThan(0);
        // 페이즈 태그를 tagSet 에 합치면 하네스와 추천이 갈라진다
        const phaseOnly = c.bossPhases.flatMap((p) => p.tags);
        const spawnTags = new Set();
        for (const e of c.enemies) for (const t of e.tags) spawnTags.add(t);
        expect([...c.tagSet].sort()).toEqual([...spawnTags].sort());
        expect(phaseOnly.length).toBeGreaterThan(0);
    });
});

describe("stageWarnings — 경고", () => {
    /** 합성 집계 — 임계값 경계를 직접 겨눈다 */
    const synth = (tags, total) => ({
        tags: Object.entries(tags).map(([tag, count]) => ({ tag, count, share: count / total })),
        total,
        bossPhases: [],
        giantCount: 0,
    });

    it("비행 비중이 높으면 치명 경고를 낸다", () => {
        const w = stageWarnings(synth({ FLYING: 10 }, 20));
        expect(w[0].code).toBe("flying_heavy");
        expect(w[0].severity).toBe("critical");
        expect(w[0].text).toContain("지상 전용");
    });

    it("비행이 소수면 경고 단계로 낮아진다", () => {
        const w = stageWarnings(synth({ FLYING: 1 }, 100));
        expect(w.map((x) => x.code)).toContain("flying");
        expect(w.find((x) => x.code === "flying").severity).toBe("warn");
    });

    it("같은 태그로 치명·경고를 동시에 내지 않는다", () => {
        const w = stageWarnings(synth({ FLYING: 10, ARMORED: 10 }, 20));
        const byTag = w.filter((x) => x.tag).map((x) => x.tag);
        expect(new Set(byTag).size).toBe(byTag.length);
    });

    it("중장갑 다수면 술식을 요구한다", () => {
        const w = stageWarnings(synth({ ARMORED: 8 }, 10));
        expect(w[0].code).toBe("armored_heavy");
        expect(w[0].text).toContain("술식");
    });

    it("치명 경고가 항상 위로 온다", () => {
        const w = stageWarnings(synth({ CORRUPT: 5, ARMORED: 9 }, 10));
        expect(w[0].severity).toBe("critical");
    });

    it("보스 페이즈 경고는 최상단이다 — 편성 안에 답을 둘 넣으라는 지시다", () => {
        const c = { ...synth({ ARMORED: 9 }, 10), bossPhases: [{ name: "", tags: ["ARMORED"] }] };
        const w = stageWarnings(c);
        expect(w[0].code).toBe("boss_phases");
    });

    it("거대화가 있으면 방벽 경고를 붙이고 안내(info)보다 위에 둔다", () => {
        const w = stageWarnings({ ...synth({ LIVING: 10, CORRUPT: 4 }, 10), giantCount: 2 });
        const g = w.findIndex((x) => x.code === "giant");
        expect(g).toBeGreaterThanOrEqual(0);
        expect(w[g].text).toContain("2마리");
        expect(w.findIndex((x) => x.severity === "info")).toBeGreaterThan(g);
    });

    it("위협이 없으면 '균형 편성으로 충분' 안내가 나온다", () => {
        const w = stageWarnings(synth({}, 0));
        expect(w).toEqual([
            expect.objectContaining({ code: "no_threat", severity: STAGE_WARNING_TEXT.no_threat.severity }),
        ]);
    });

    it("null 집계는 빈 배열이다", () => {
        expect(stageWarnings(null)).toEqual([]);
    });

    it("모든 스테이지에서 치환되지 않은 자리표시자가 남지 않는다", () => {
        for (const stage of stagesData.stages) {
            for (const w of stageWarnings(stageEnemyCounts(stage.id))) {
                expect(w.text, `${stage.id}/${w.code}`).not.toMatch(/\{(count|share)\}/);
                expect(w.text.length).toBeGreaterThan(0);
            }
        }
    });

    it("경고 규칙 코드는 유일하고 문구는 한국어다", () => {
        const codes = TAG_WARNING_RULES.map((r) => r.code);
        expect(new Set(codes).size).toBe(codes.length);
        for (const r of TAG_WARNING_RULES) {
            /**
             * ★★ 문구가 코드에서 카탈로그로 옮겨졌다 (2026-08-07). "한국어인가"를
             *   묻는 것으로는 이제 아무것도 지키지 않는다 — 지켜야 할 것은
             *   **두 언어 모두에서 실제 문장이 나오는가**이고, 없는 키는 `t()` 가
             *   키 자체를 돌려주므로 그것을 잡는다.
             */
            for (const lang of LANGS) {
                const text = t(r.key, { count: 2, share: 30 }, lang);
                expect(text, `${r.code}/${lang}`).not.toBe(r.key);
                expect(text.length).toBeGreaterThan(0);
                if (r.oneKey) {
                    const one = t(r.oneKey, { count: 1, share: 30 }, lang);
                    expect(one, `${r.code}/${lang} 단수`).not.toBe(r.oneKey);
                }
            }
            expect(PREVIEW_TAG_ORDER).toContain(r.tag);
        }
    });

    it("데이터에 실제로 존재하는 모든 태그에 안내 규칙이 있다", () => {
        const used = new Set();
        for (const e of enemiesData.enemies) for (const t of e.tags ?? []) used.add(t);
        const covered = new Set(TAG_WARNING_RULES.map((r) => r.tag));
        for (const t of used) expect([...covered], `태그 ${t} 안내 없음`).toContain(t);
    });
});

describe("recommendedLoadout — 추천 편성", () => {
    it("하네스(tools/lib/loadouts.mjs)가 재수출하는 함수와 동일하다", async () => {
        // ★ 사본이 다시 생기면 여기서 깨진다 — 그것이 이 테스트의 목적이다.
        const tools = await import("../../../tools/lib/loadouts.mjs");
        expect(tools.recommendedLoadout).toBe(recommendedLoadout);
    });

    it("항상 6칸 이하이고 중복이 없다", () => {
        for (const stage of stagesData.stages) {
            const ids = recommendedLoadout(stageEnemyCounts(stage.id).tagSet);
            expect(ids.length, stage.id).toBeLessThanOrEqual(RECOMMEND_SIZE);
            expect(new Set(ids).size, stage.id).toBe(ids.length);
            for (const id of ids) expect(UNIT_DEFS[id], id).toBeTruthy();
        }
    });

    it("60 스테이지 전부 6칸을 채우고 방벽을 먼저 넣는다", () => {
        for (const stage of stagesData.stages) {
            const ids = recommendedLoadout(stageEnemyCounts(stage.id).tagSet);
            expect(ids.length, stage.id).toBe(RECOMMEND_SIZE);
            expect(UNIT_DEFS[ids[0]].role, stage.id).toBe("BLOCKER");
        }
    });

    it("ARMORED 면 술식을, CORRUPT 면 신성을, FLYING 이면 대공을 넣는다", () => {
        const arcane = recommendedLoadout(new Set(["ARMORED"]));
        expect(arcane.some((id) => UNIT_DEFS[id].dmgType === "arcane")).toBe(true);

        const holy = recommendedLoadout(new Set(["CORRUPT"]));
        expect(holy.some((id) => UNIT_DEFS[id].dmgType === "holy")).toBe(true);

        const air = recommendedLoadout(new Set(["FLYING"]));
        expect(
            air.some(
                (id) =>
                    (UNIT_DEFS[id].tagMask & TAG.ANTI_AIR) !== 0 ||
                    UNIT_DEFS[id].role === "RANGED" ||
                    UNIT_DEFS[id].role === "CASTER"
            )
        ).toBe(true);
    });

    it("WARDED 면 방벽이 아닌 물리 딜러가 들어간다", () => {
        const ids = recommendedLoadout(new Set(["WARDED"]));
        expect(
            ids.some((id) => UNIT_DEFS[id].dmgType === "physical" && UNIT_DEFS[id].role !== "BLOCKER")
        ).toBe(true);
    });

    /**
     * ★★ 닿지 못하는 답은 답이 아니다 — 5-15 · 5-19 벽의 회귀 방지 (2026-08-03).
     *
     *   `WARDED` 의 답은 물리여야 하는데(RES 를 피하려고), 그 스테이지의 WARDED 적이
     *   전부 **비행**이면 근접 물리는 영원히 닿지 못한다. 예전 규칙은 태그의 유무만
     *   보고 `clucking_chicken`(근접)을 골랐고, 5-15 승률이 **15%** 였다.
     *
     *   기존 테스트가 못 잡은 이유는 전부 **"물리 딜러가 들어갔는가"** 만 물었기
     *   때문이다. 들어가 있었다. 닿지 못했을 뿐이다.
     */
    describe("닿는 답 — 태그는 적별로 조합된다", () => {
        /** 그 태그를 지닌 적 중 비행 비율 */
        const flyingShare = (counts, tag) => {
            let carriers = 0;
            let flying = 0;
            for (const e of counts.enemies) {
                if (!e.tags.includes(tag)) continue;
                carriers += e.count;
                if (e.tags.includes("FLYING")) flying += e.count;
            }
            return carriers > 0 ? flying / carriers : 0;
        };
        const airborneWarded = stagesData.stages.filter(
            (s) => flyingShare(stageEnemyCounts(s.id), "WARDED") >= 0.5
        );

        it("검사 대상이 존재한다 — 없으면 아래 검사가 통째로 공회전이다", () => {
            expect(airborneWarded.length).toBeGreaterThan(0);
        });

        it(`WARDED 적이 과반 비행인 ${airborneWarded.length} 스테이지 — 공중에 닿는 물리가 들어간다`, () => {
            for (const s of airborneWarded) {
                const ids = recommendedLoadoutForStage(s.id);
                const reaches = ids.filter((id) => {
                    const u = UNIT_DEFS[id];
                    return u.dmgType === "physical" && canHitFlying(u.tagMask, u.dmgType);
                });
                // 수정 전에는 `clucking_chicken`(근접 물리)이 유일한 WARDED 답이었다
                expect(reaches.length, `${s.id}: ${ids.join(" ")}`).toBeGreaterThan(0);
            }
        });

        it("한 유닛이 두 답을 겸하지 않는다 — 겸하면 뒤 태그가 답 없이 지나간다", () => {
            // 5-15 는 ARMORED·WARDED·CORRUPT·FLYING 이 모두 있고 WARDED 가 비행이라
            // '물리 대공'이 WARDED 와 FLYING 양쪽의 답이 된다. 둘은 다른 유닛이어야 한다.
            const ids = recommendedLoadoutForStage("5-15");
            const physAir = ids.filter((id) => {
                const u = UNIT_DEFS[id];
                return u.dmgType === "physical" && (u.tagMask & TAG.ANTI_AIR) !== 0;
            });
            expect(physAir.length, ids.join(" ")).toBe(2);
        });

        it("벽이었던 두 스테이지의 추천이 실제로 바뀌었다", () => {
            for (const id of ["5-15", "5-19"]) {
                const ids = recommendedLoadoutForStage(id);
                // 근접 물리는 이 스테이지들의 답이 될 수 없다
                expect(ids, id).not.toContain("clucking_chicken");
                expect(ids, id).toContain("elf_sharpshooter");
                expect(ids, id).toContain("leaf_ranger");
            }
        });

        it("스테이지 입구는 하나다 — ForStage 와 집계 직접 전달이 같다", () => {
            for (const s of stagesData.stages) {
                expect(recommendedLoadoutForStage(s.id), s.id).toEqual(
                    recommendedLoadout(stageEnemyCounts(s.id))
                );
            }
        });

        it("하네스도 같은 입구를 재수출한다", async () => {
            const tools = await import("../../../tools/lib/loadouts.mjs");
            expect(tools.recommendedLoadoutForStage).toBe(recommendedLoadoutForStage);
        });
    });

    it("배열로 줘도 Set 과 같은 결과다", () => {
        expect(recommendedLoadout(["ARMORED", "FLYING"])).toEqual(
            recommendedLoadout(new Set(["ARMORED", "FLYING"]))
        );
    });

    it("null·빈 입력에도 6칸을 낸다", () => {
        expect(recommendedLoadout(null).length).toBe(RECOMMEND_SIZE);
        expect(recommendedLoadout(new Set())).toEqual(recommendedLoadout(null));
    });

    it("결정론 — 같은 입력이면 항상 같은 순서다", () => {
        const a = recommendedLoadout(new Set(["ARMORED", "FLYING", "CORRUPT"]));
        const b = recommendedLoadout(new Set(["CORRUPT", "FLYING", "ARMORED"]));
        expect(a).toEqual(b);
    });

    it("후보를 제한하면 그 안에서만 고른다 (보유 동료 기준 추천)", () => {
        const pool = Object.keys(UNIT_DEFS).slice(0, 4);
        const ids = recommendedLoadout(new Set(["ARMORED"]), pool);
        expect(ids.length).toBeLessThanOrEqual(pool.length);
        for (const id of ids) expect(pool).toContain(id);
    });

    it("전 로스터를 후보로 주면 제한 없는 결과와 같다", () => {
        const all = Object.keys(UNIT_DEFS);
        expect(recommendedLoadout(new Set(["ARMORED"]), all)).toEqual(
            recommendedLoadout(new Set(["ARMORED"]))
        );
    });

    it("후보가 없으면 빈 배열이다", () => {
        expect(recommendedLoadout(new Set(["ARMORED"]), [])).toEqual([]);
    });
});

describe("stagePreview — 화면이 쓰는 묶음", () => {
    it("집계·경고·추천을 한 번에 낸다", () => {
        const p = stagePreview("1-10");
        expect(p.total).toBeGreaterThan(0);
        expect(p.warnings.length).toBeGreaterThan(0);
        expect(p.recommended.length).toBe(RECOMMEND_SIZE);
    });

    it("없는 스테이지는 null 이다", () => {
        expect(stagePreview("0-0")).toBeNull();
    });

    it("보유 동료를 주면 그 안에서 추천한다", () => {
        const pool = Object.keys(UNIT_DEFS).slice(0, 3);
        const p = stagePreview("1-10", { unitIds: pool });
        for (const id of p.recommended) expect(pool).toContain(id);
    });

    /**
     * ★★ **진입 전에 규칙을 읽을 수 있어야 한다.** 그러지 않으면 나이트메어는 전략이
     *   아니라 좌절이다 — 프리뷰가 태그 집계를 보여 주는 것과 같은 논리다.
     * ★ 화면이 월드 번호로 분기하지 않는다. 판정은 `logic/nightmare.js` 하나다.
     */
    it("★ 나이트메어에서만 규칙 배지가 나온다", () => {
        expect(stagePreview("5-3").nightmare).toBeNull();
        expect(stagePreview("5-3", { difficulty: "hard" }).nightmare).toBeNull();
        const nm = stagePreview("5-3", { difficulty: "nightmare" }).nightmare;
        expect(nm.id).toBe("attrition");
        expect(nm.name).toBeTruthy();
        expect(nm.summary).toBeTruthy();
    });

    it("월드마다 다른 규칙이 나온다 (누적하지 않는다)", () => {
        const idOf = (s) => stagePreview(s, { difficulty: "nightmare" }).nightmare.id;
        expect([idOf("1-3"), idOf("2-3"), idOf("3-3"), idOf("4-3"), idOf("5-3")]).toEqual([
            "plague_bloom",
            "bond_break",
            "plague_bloom",
            "bond_break",
            "attrition",
        ]);
    });
});
