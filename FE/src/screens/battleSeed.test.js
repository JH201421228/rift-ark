/**
 * 전투 시드는 **출격마다 바뀐다** (2026-08-06, 사용자 제보 ②)
 *
 * ★★★ 제보: "게임을 할 때마다 늘 같은 조합의 균열 각인이 나오는 거 아니야?"
 *
 *   맞았다. 시드가 `1000 + runKey * 7919` 였고 `runKey` 는 **전투 화면의 지역
 *   상태(`useState(0)`)** 였다. 화면을 나갔다 들어오면 0 으로 돌아가므로
 *   **모든 첫 출격이 시드 1000** 이었다 — 각인 3지선다는 `rng.sigil` 스트림에서
 *   나오니 매판 같은 순서로 뽑혔다. 바뀌는 것은 *같은 화면 안에서의 재도전*
 *   뿐이었는데, 주석은 그것을 "재도전마다 바뀐다"고만 적어 두어 아무도 의심하지
 *   않았다.
 *
 * ★ 고친 뒤에도 **`Math.random()`·`Date.now()` 를 쓰지 않는다.** 시드는 재현
 *   가능해야 제보 한 판을 그대로 다시 돌릴 수 있다 (절대 규칙 1 의 정신).
 *   `meta.runSeq` 는 저장되는 단조 증가 카운터다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createMetaSlice } from "@/store/slices/metaSlice";

const SRC = readFileSync(new URL("./BattleScreen.jsx", import.meta.url), "utf8");
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => (/^\s*(\/\/|\*)/.test(l) ? "" : l))
    .join("\n");

/**
 * 슬라이스만 떼어 최소 스토어를 만든다 (전체 스토어는 persist 를 탄다).
 * ★ **접근자를 돌려준다.** `set` 이 새 객체를 만들므로 처음 반환한 객체를 들고
 *   있으면 값이 갱신되지 않는다 — 처음에 그렇게 써서 검사가 헛돌았다.
 */
function makeStore() {
    let state = {};
    const set = (fn) => {
        state = { ...state, ...(typeof fn === "function" ? fn(state) : fn) };
    };
    const get = () => state;
    state = createMetaSlice(set, get);
    return get;
}

describe("출격 시드", () => {
    it("★★ nextRunSeed() 는 부를 때마다 다른 값을 준다", () => {
        const st = makeStore();
        const seen = new Set();
        for (let i = 0; i < 50; i++) seen.add(st().nextRunSeed());
        expect(seen.size, "같은 시드가 반복된다 — 각인 조합이 매판 같아진다").toBe(50);
    });

    it("★ 카운터가 저장되는 곳(meta)에 있다 — 세션 변수면 앱 재시작마다 반복된다", () => {
        const st = makeStore();
        expect(st().meta.runSeq, "meta.runSeq 초기값이 없다").toBe(0);
        st().nextRunSeed();
        expect(st().meta.runSeq, "카운터가 meta 에 기록되지 않는다").toBe(1);
    });

    it("★ 결정론 — 같은 카운터 값이면 같은 시드다 (제보 한 판을 재현할 수 있다)", () => {
        const a = makeStore();
        const b = makeStore();
        const seedsA = [a().nextRunSeed(), a().nextRunSeed(), a().nextRunSeed()];
        const seedsB = [b().nextRunSeed(), b().nextRunSeed(), b().nextRunSeed()];
        expect(seedsA).toEqual(seedsB);
    });

    it("★ 옛 세이브(runSeq 없음)도 0 에서 시작한다 — migrate 없이 성립", () => {
        const st = makeStore();
        // 옛 세이브를 흉내낸다 — 이 필드가 아예 없던 시절
        delete st().meta.runSeq;
        expect(() => st().nextRunSeed()).not.toThrow();
        expect(st().meta.runSeq).toBe(1);
    });
});

describe("전투 화면이 그 시드를 쓴다", () => {
    it("★★ 고정 상수 시드로 되돌아가지 않았다", () => {
        expect(
            /seed:\s*1000\s*\+\s*runKey/.test(CODE),
            "지역 상태만으로 시드를 만든다 — 모든 첫 출격이 같은 판이 된다"
        ).toBe(false);
    });

    it("★ nextRunSeed() 를 부른다", () => {
        expect(/nextRunSeed\(\)/.test(CODE), "화면이 저장된 카운터를 쓰지 않는다").toBe(true);
    });

    it("★ 화면에서 Math.random()/Date.now() 로 시드를 만들지 않는다", () => {
        const at = CODE.indexOf("seed:");
        expect(at).toBeGreaterThan(0);
        const line = CODE.slice(at, CODE.indexOf("\n", at));
        expect(/Math\.random|Date\.now/.test(line), "시드가 재현 불가능해졌다").toBe(false);
    });
});
