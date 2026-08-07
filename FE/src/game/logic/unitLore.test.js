/**
 * 동료 서사 전수 검사.
 *
 * ★ 이 파일이 지키는 것은 문장의 품질이 아니라 **구멍이 없다는 것**이다.
 *   로스터에 동료를 하나 추가하면 스탯·아트·영입가는 검사기가 잡아 주는데
 *   서사만 아무도 요구하지 않는다. 그러면 "카드를 열면 설명 칸이 비어 있는
 *   동료"가 생기고, 그건 만든 사람만 모르는 결함이다 — 이 저장소가 여러 번
 *   겪은 형태다 (편성 목록에서 사라진 FLYER · 획득 경로 없는 동료 20종).
 *
 * ★ 수치 검사가 있는 이유: 본문 수치는 이 저장소에서 **데이터가 만든다**
 *   (`logic/guide.js:guideFacts`). 문장에 박아 둔 숫자는 밸런스를 만지는 날
 *   전부 거짓말이 되고, 아무 검사기도 그것을 잡지 못한다.
 */
import { describe, it, expect } from "vitest";
import unitsData from "../data/units.json" with { type: "json" };
import LORE_DATA from "../data/unitLore.json" with { type: "json" };
import { UNIT_LORE, loreOf } from "./unitLore.js";

const UNIT_IDS = unitsData.units.map((u) => u.id);
const ENTRIES = Object.entries(UNIT_LORE);

/**
 * ★ 항목은 `{ ko, en }` 이다 (2026-08-07 i18n). 글의 규약은 **두 언어 각각**에
 *   묻는다 — 한쪽만 검사하면 번역된 쪽에 숫자·중복·빈 칸이 들어와도 통과한다.
 */
const LANGS = ["ko", "en"];
const textsOf = (lang) => ENTRIES.map(([id, v]) => [id, v[lang]]);

/**
 * 한 동료당 허용 길이. 카드 상세 한 칸에 들어가고, 그러면서 문장이 되는 폭.
 * ★ 영어 상한이 더 큰 것은 글이 길어져서가 아니라 **글자가 좁아서**다 —
 *   이 게임의 폰트는 한글:라틴 = 1:0.5 라, 라틴 150자가 한글 75자 폭이다.
 *   즉 두 값은 같은 칸 폭을 서로 다른 단위로 적은 것이다.
 */
const LEN_RANGE = { ko: [40, 90], en: [60, 150] };

/** 코드포인트로 센다 — 한글은 UTF-16 한 칸이지만, 섞여 들어온 문자까지 같은 기준으로 본다. */
const len = (s) => [...s].length;

describe("동료 서사 — 구멍이 없다", () => {
    it("모듈이 데이터 파일을 그대로 재수출한다 (사본 없음)", () => {
        // 값이 같은지가 아니라 **같은 것인지**를 본다. 사본은 언젠가 갈라진다.
        expect(UNIT_LORE).toBe(LORE_DATA.lore);
    });

    it.each(LANGS)("동료 50종 전부에 서사가 있다 (%s)", (lang) => {
        // ★ 언어를 넘겨서 묻는다. 현재 언어로만 물으면 영어 화면에서만 비는
        //   동료가 통과한다 — `pick` 의 한국어 폴백이 그 구멍을 덮어 주기 때문이다.
        const missing = UNIT_IDS.filter((id) => !loreOf(id, lang));
        expect(missing, `${lang} 서사가 없는 동료: ${missing.join(", ")}`).toEqual([]);
    });

    it("두 언어가 같은 자리에 있고, 영어에 한글이 남아 있지 않다", () => {
        const bad = ENTRIES.filter(
            ([, v]) => typeof v?.ko !== "string" || typeof v?.en !== "string"
        ).map(([id]) => id);
        expect(bad, `{ko, en} 가 아닌 항목: ${bad.join(", ")}`).toEqual([]);
        const leaked = ENTRIES.filter(([, v]) => /[가-힣]/.test(v.en)).map(([id]) => id);
        expect(leaked, `en 에 한글이 남은 동료: ${leaked.join(", ")}`).toEqual([]);
    });

    it("언어를 넘기지 않으면 현재 언어(기본 한국어)를 쓴다", () => {
        expect(loreOf("slow_turtle")).toBe(loreOf("slow_turtle", "ko"));
        expect(loreOf("slow_turtle", "en")).not.toBe(loreOf("slow_turtle", "ko"));
    });

    it("units.json 에 없는 id 가 적혀 있지 않다", () => {
        const unknown = ENTRIES.map(([id]) => id).filter((id) => !UNIT_IDS.includes(id));
        expect(unknown, `로스터에 없는 id: ${unknown.join(", ")}`).toEqual([]);
    });

    it("loreOf 는 모르는 id 에 null 을 준다 — 빈 문자열이 아니다", () => {
        expect(loreOf("정말_없는_동료")).toBeNull();
        expect(loreOf(undefined)).toBeNull();
        // JSON 객체가 물고 있는 프로토타입 키가 문장인 척하지 않는다
        expect(loreOf("constructor")).toBeNull();
    });
});

describe.each(LANGS)("동료 서사 — 글의 규약 (%s)", (lang) => {
    const ENTRIES = textsOf(lang);
    const [MIN_LEN, MAX_LEN] = LEN_RANGE[lang];

    it("길이가 범위 안이다", () => {
        const bad = ENTRIES.filter(([, t]) => len(t) < MIN_LEN || len(t) > MAX_LEN).map(
            ([id, t]) => `${id}(${len(t)}자)`
        );
        expect(bad, `길이 ${MIN_LEN}~${MAX_LEN}자를 벗어남: ${bad.join(", ")}`).toEqual([]);
    });

    it("수치가 박혀 있지 않다", () => {
        // 아라비아 숫자 · 전각 숫자 어느 쪽도 허용하지 않는다.
        // 밸런스를 만지는 날 조용히 거짓이 되는 유일한 문장 성분이다.
        const bad = ENTRIES.filter(([, t]) => /[0-9０-９]/.test(t)).map(([id]) => id);
        expect(bad, `문장에 숫자가 있는 동료: ${bad.join(", ")}`).toEqual([]);
    });

    it("이모지·특수 글리프가 없다 (절대 규칙 5)", () => {
        // 기기마다 글리프가 다르고 크기·정렬을 제어할 수단이 없다.
        // 화살표·기호·딩뱃(U+2190~U+2BFF) 과 서로게이트 쌍(이모지 대부분).
        // 한글 음절(U+AC00~U+D7A3)은 어디에도 걸리지 않는다.
        const GLYPH = /[\u2190-\u2BFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]/;
        const bad = ENTRIES.filter(([, t]) => GLYPH.test(t)).map(([id]) => id);
        expect(bad, `글리프가 섞인 동료: ${bad.join(", ")}`).toEqual([]);
    });

    it("서사가 통째로 겹치지 않는다", () => {
        const seen = new Map();
        const dup = [];
        for (const [id, t] of ENTRIES) {
            if (seen.has(t)) dup.push(`${id} = ${seen.get(t)}`);
            seen.set(t, id);
        }
        expect(dup, `같은 서사: ${dup.join(", ")}`).toEqual([]);
    });

    it("문장 하나 단위로도 겹치지 않는다 — 같은 틀을 오십 번 찍지 않는다", () => {
        const seen = new Map();
        const dup = [];
        for (const [id, t] of ENTRIES) {
            for (const raw of t.split(".")) {
                const s = raw.trim();
                if (!s) continue;
                if (seen.has(s)) dup.push(`${id} = ${seen.get(s)}: "${s}"`);
                seen.set(s, id);
            }
        }
        expect(dup, `같은 문장: ${dup.join(" / ")}`).toEqual([]);
    });

    it("units.json 의 한 줄 flavor 를 베끼지 않는다", () => {
        // 화면이 둘을 같이 그린다. 같으면 같은 문장이 두 번 보인다.
        // ★ 같은 언어끼리 대조한다 — 한국어만 보면 영어에서만 겹치는 것을 놓친다.
        const same = unitsData.units
            .filter((u) => u.flavor?.[lang] && u.flavor[lang] === loreOf(u.id, lang))
            .map((u) => u.id);
        expect(same, `flavor 와 같은 서사: ${same.join(", ")}`).toEqual([]);
    });
});
