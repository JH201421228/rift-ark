/**
 * 역할 단일 출처 검증.
 *
 * ★ 이 파일이 존재하는 이유는 실제로 난 사고 때문이다.
 *   `loadoutAnalysis.js` 에 `ROLE_ORDER` 사본이 있었고 거기에 `FLYER` 가 빠져 있었다.
 *   편성 화면이 그 사본으로 카드를 그려서, **마법 요정과 결연한 천사가
 *   목록에 아예 나타나지 않았다** — 헤더는 "보유 동료 25종"인데 카드는 23장.
 *   가챠와 상점으로 얻을 수 있는 유닛을 편성에 넣을 수 없는 상태였고,
 *   도감·전투 HUD 는 같은 유닛을 정상 표시했으니 **화면마다 로스터가 달랐다.**
 *
 *   lint 도 타입도 이걸 잡지 못한다 — 문법은 완전하고 그냥 항목이 하나 없을 뿐이다.
 *   잡을 수 있는 것은 "데이터에 있는 역할이 목록에도 있는가"를 묻는 테스트뿐이다.
 */
import { describe, it, expect } from "vitest";
import unitsData from "../data/units.json" with { type: "json" };
import { ROLE_ORDER, roleLabel, BACKLINE_ROLES } from "./roles.js";
import { LANGS } from "../../i18n/index.js";
import { ROLE_ORDER as ANALYSIS_ROLE_ORDER } from "./loadoutAnalysis.js";
import { RECOMMEND_FILL_ORDER, recommendedLoadout, RECOMMEND_SIZE } from "./stagePreview.js";

const DATA_ROLES = [...new Set(unitsData.units.map((u) => u.role))].sort();

describe("역할 단일 출처", () => {
    it("units.json 에 있는 역할이 전부 ROLE_ORDER 에 있다", () => {
        const missing = DATA_ROLES.filter((r) => !ROLE_ORDER.includes(r));
        expect(missing, `ROLE_ORDER 에 빠진 역할: ${missing.join(", ")}`).toEqual([]);
    });

    /**
     * ★★ **두 언어 모두**를 본다. 예전에는 `ROLE_LABEL_KO[r]` 이 진실인지만 물었는데,
     *   그 사전은 이제 `terms.json` 조회에서 파생되므로 그렇게 물으면 **정의상 참**이
     *   되어 아무것도 지키지 않는다. 카탈로그에 키가 없으면 `t()` 는 키 자체를
     *   돌려주므로(`terms.role.FOO`), 그것을 잡는 것이 유일하게 뜻이 있는 검사다.
     */
    it("ROLE_ORDER 의 모든 역할에 두 언어 이름이 있다", () => {
        const missing = [];
        for (const lang of LANGS) {
            for (const r of ROLE_ORDER) {
                const label = roleLabel(r, lang);
                if (!label || label === `terms.role.${r}`) missing.push(`${lang}:${r}`);
            }
        }
        expect(missing, `이름 없는 역할: ${missing.join(", ")}`).toEqual([]);
    });

    it("ROLE_ORDER 에 중복이 없다", () => {
        expect(new Set(ROLE_ORDER).size).toBe(ROLE_ORDER.length);
    });

    it("loadoutAnalysis 는 사본이 아니라 같은 배열을 재수출한다", () => {
        // 값이 같은지가 아니라 **같은 것인지**를 본다. 사본은 언젠가 갈라진다.
        expect(ANALYSIS_ROLE_ORDER).toBe(ROLE_ORDER);
    });

    it("추천 편성 채우기 순서가 모든 역할을 덮는다", () => {
        const missing = ROLE_ORDER.filter((r) => !RECOMMEND_FILL_ORDER.includes(r));
        expect(missing, `추천 채우기에서 빠진 역할: ${missing.join(", ")}`).toEqual([]);
    });

    it("후열 화력 판정에 FLYER 가 포함된다", () => {
        // 비행 화력만으로 짠 편성이 "후열 화력 없음"으로 오탐되던 버그
        expect(BACKLINE_ROLES).toContain("FLYER");
    });
});

describe("역할별 유닛이 실제로 도달 가능하다", () => {
    it("모든 역할에 유닛이 최소 1종 있다 — 빈 역할은 죽은 개념이다", () => {
        for (const role of ROLE_ORDER) {
            const n = unitsData.units.filter((u) => u.role === role).length;
            expect(n, `${role} 역할 유닛 수`).toBeGreaterThan(0);
        }
    });

    it("추천 편성이 6칸을 채운다", () => {
        // 역할 목록이 잘못되면 후보가 줄어 칸이 빈다
        const picks = recommendedLoadout(new Set());
        expect(picks).toHaveLength(RECOMMEND_SIZE);
        expect(new Set(picks).size).toBe(RECOMMEND_SIZE); // 중복 없음
    });
});
