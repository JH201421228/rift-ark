/**
 * 가이드 (2026-08-04)
 *
 * ★★ 여기서 지키는 것은 문장이 아니라 **규약**이다: 가이드가 말하는 숫자는
 *   전투가 쓰는 숫자와 **정의상 같아야 한다**. 문장에 숫자를 박는 순간
 *   밸런스를 고친 다음 날부터 가이드가 거짓말을 시작하고, 그 거짓말은
 *   어떤 테스트도 잡지 못한다 — 문법이 완전하기 때문이다.
 */
import { describe, it, expect } from "vitest";
import {
    GROUPS,
    TOPICS,
    FACT_KINDS,
    guideFacts,
    groupTitle,
    topicBody,
    topicById,
    topicTitle,
    topicsForScreen,
} from "./guide.js";
import { LANGS, setLang, DEFAULT_LANG } from "../../i18n/index.js";
import balance from "../data/balance.json" with { type: "json" };
import sigilsData from "../data/sigils.json" with { type: "json" };
import { FACILITIES } from "./progression.js";
import { RECRUITABLE } from "./recruit.js";

describe("가이드 데이터", () => {
    it("주제 id 가 유일하다", () => {
        const ids = TOPICS.map((t) => t.id);
        expect(new Set(ids).size, `중복: ${ids.filter((v, i) => ids.indexOf(v) !== i)}`).toBe(
            ids.length
        );
    });

    it("모든 주제가 실재하는 묶음에 속한다", () => {
        const groups = new Set(GROUPS.map((g) => g.id));
        for (const t of TOPICS) expect(groups.has(t.group), `${t.id} → ${t.group}`).toBe(true);
    });

    it("빈 묶음이 없다 — 제목만 있고 내용이 없는 칸은 목차를 늘릴 뿐이다", () => {
        for (const g of GROUPS) {
            expect(TOPICS.some((t) => t.group === g.id), `${g.id} 가 비었다`).toBe(true);
        }
    });

    /**
     * ★★ **두 언어를 다 본다** (2026-08-07). 예전에는 `t.body` 가 배열인지만 물었는데,
     *   본문이 `{ko, en}` 이 된 뒤로는 그 물음이 **언어를 하나도 검사하지 않는다** —
     *   영어 본문이 통째로 비어 있어도 통과한다. 비어 있으면 영어권 사용자에게
     *   가이드는 제목만 있는 빈 창이고, 그것이 이 게임의 유일한 설명이다.
     */
    it.each(LANGS)("[%s] 모든 주제에 제목과 본문이 있다", (lang) => {
        for (const t of TOPICS) {
            const body = topicBody(t, lang);
            expect(body.length, `${t.id}: 본문 없음`).toBeGreaterThan(0);
            for (const line of body) expect(typeof line, `${t.id}: 문단이 문자열이 아니다`).toBe("string");
            expect(topicTitle(t, lang), `${t.id}: 제목 없음`).toBeTruthy();
        }
    });

    it.each(LANGS)("[%s] 모든 묶음에 제목이 있다", (lang) => {
        for (const g of GROUPS) expect(groupTitle(g, lang), `${g.id}: 제목 없음`).toBeTruthy();
    });

    it("topicById · topicsForScreen 이 같은 목록을 본다", () => {
        for (const t of TOPICS) expect(topicById(t.id)).toBe(t);
        expect(topicById("없는-주제")).toBeNull();
        for (const t of topicsForScreen("ark")) expect(t.screen).toBe("ark");
        expect(topicsForScreen(undefined)).toEqual([]);
    });
});

describe("guideFacts — 값은 데이터에서 온다", () => {
    it("선언된 facts 종류가 전부 구현돼 있다", () => {
        for (const t of TOPICS) {
            if (!t.facts) continue;
            expect(FACT_KINDS, `${t.id}: '${t.facts}'`).toContain(t.facts);
        }
    });

    it("모든 종류가 최소 한 줄을 만든다 — 빈 표로 열리지 않는다", () => {
        for (const kind of FACT_KINDS) {
            const rows = guideFacts(kind);
            expect(rows.length, `${kind} 가 비었다`).toBeGreaterThan(0);
            for (const r of rows) {
                expect(r.label, `${kind}: 라벨 없음`).toBeTruthy();
                expect(String(r.value).length, `${kind}: 값 없음`).toBeGreaterThan(0);
            }
        }
    });

    it("모르는 이름은 던지지 않고 빈 배열이다 — 가이드가 화면을 죽이지 않는다", () => {
        expect(guideFacts("없는-종류")).toEqual([]);
        expect(guideFacts(undefined)).toEqual([]);
    });

    it("★ 마나 표가 balance.json 을 그대로 읽는다 (사본이 아니다)", () => {
        const rows = guideFacts("mana");
        const val = (label) => rows.find((r) => r.label === label)?.value ?? "";
        expect(val("시작 마나")).toBe(String(balance.resources.manaStart));
        expect(val("최대 마나")).toBe(String(balance.resources.manaMax));
    });

    it("★ 시설·각인·영입 표의 개수가 규칙 모듈과 일치한다", () => {
        expect(guideFacts("facilities")).toHaveLength(FACILITIES.length);
        expect(guideFacts("sigils")[0].value).toBe(`${sigilsData.sigils.length}종`);
        expect(guideFacts("recruit")[0].value).toBe(`${RECRUITABLE.length}종`);
    });

    /**
     * ★★ 수치를 잡는 정규식도 **언어마다 다르다.** 한국어 단위(골드 · 초 · 마나)만
     *   보면 영어 본문의 "12 seconds" 는 그대로 통과한다 — 번역이 규약을 우회하는
     *   경로가 되면 안 된다.
     */
    it.each([
        ["ko", /\d[\d,.]*\s*(골드|초|%|마나)/],
        ["en", /\d[\d,.]*\s*(gold|seconds?|s\b|%|mana)/i],
    ])("[%s] ★★ 본문 문장에 수치가 박혀 있지 않다 — 그것이 표를 만든 이유다", (lang, re) => {
        const offenders = [];
        for (const t of TOPICS) {
            for (const line of topicBody(t, lang)) {
                const m = line.match(re);
                if (m) offenders.push(`${t.id}: "${m[0]}"`);
            }
        }
        expect(offenders, offenders.join(" · ")).toEqual([]);
    });

    /**
     * ★★★ **표는 두 언어 모두에서 채워져야 한다.** 키를 한쪽 언어에만 적으면
     *   `t()` 가 키 자체를 돌려주므로(`guide.mana.start`), 화면에 점 찍힌 영어 키가
     *   그대로 뜬다. 여기서 잡지 않으면 한국어로만 확인하고 넘어가게 된다.
     */
    it.each(LANGS)("[%s] 모든 표가 카탈로그 키를 노출하지 않는다", (lang) => {
        setLang(lang);
        try {
            const leaks = [];
            for (const kind of FACT_KINDS) {
                for (const r of guideFacts(kind)) {
                    for (const s of [r.label, String(r.value)]) {
                        if (/^(guide|common|terms|rules)\.[a-zA-Z]/.test(s)) {
                            leaks.push(`${kind}: ${s}`);
                        }
                    }
                }
            }
            expect(leaks, leaks.join(" · ")).toEqual([]);
        } finally {
            setLang(DEFAULT_LANG);
        }
    });
});
