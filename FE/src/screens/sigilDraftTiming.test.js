/**
 * 각인 적용 시점 문구 (2026-08-06, 사용자 제보 ③)
 *
 * ★★★ 제보: "각인 설명에는 **다음 소환부터** 적용된다고 나오는데 실제로는
 *   바로 적용되는 것 같다."
 *
 *   맞는 지적이었다. 판정이 `isRetroactive()` 라는 **참/거짓** 술어였고, 그 술어는
 *   `modifyStat` 훅만 본다. 그래서 **`modifyStat` 훅이 아예 없는 각인 8종**
 *   (오라 · 방주 · 발사체 · 타격/처치 훅)이 전부 거짓으로 떨어져
 *   "다음에 소환하는 동료부터"라는 **거짓 문구**를 달고 있었다.
 *   오라 반경이나 방주 최대 HP 에는 '동료 소환'이라는 개념 자체가 없다.
 *
 * ★ 지키는 명제 셋:
 *   ① 모든 각인이 세 시점 중 정확히 하나로 분류된다
 *   ② `modifyStat` 훅이 없는 각인은 **하나도** `nextSummon` 이 아니다
 *   ③ 화면의 문구 표가 `sigilTiming` 의 반환값을 **전부** 갖는다
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { SIGILS, sigilTiming } from "@/game/logic/sigils";
import SIGIL_DATA from "@/game/data/sigils.json" with { type: "json" };

const SRC = readFileSync(new URL("./SigilDraft.jsx", import.meta.url), "utf8");

const ALL = Object.keys(SIGILS);
const TIMINGS = ["immediate", "retroactive", "nextSummon"];

describe("각인 적용 시점", () => {
    it("전제 — 각인이 18종 이상 있고 전부 훅을 갖는다", () => {
        expect(ALL.length).toBeGreaterThanOrEqual(18);
    });

    it("★ 모든 각인이 세 시점 중 하나로 분류된다", () => {
        for (const id of ALL) {
            expect(TIMINGS, `${id} 의 시점이 알 수 없는 값이다`).toContain(sigilTiming(id));
        }
    });

    /**
     * ★★ **이것이 제보를 직접 지킨다.** `modifyStat` 훅이 없는 각인에게
     *   "다음 소환부터"라고 말하는 것은 거짓이다.
     */
    it("★★ modifyStat 훅이 없는 각인은 nextSummon 이 아니다 (제보 ③)", () => {
        const noStat = SIGIL_DATA.sigils.filter(
            (d) => !(d.hooks ?? []).some((h) => h.on === "modifyStat")
        );
        expect(
            noStat.length,
            "stat 훅 없는 각인이 하나도 없다면 이 검사의 전제가 사라진 것이다"
        ).toBeGreaterThan(0);

        for (const d of noStat) {
            expect(
                sigilTiming(d.id),
                `${d.id} 는 동료 스탯을 만지지 않는데 "다음 소환부터"라고 말한다`
            ).toBe("immediate");
        }
    });

    it("★ 소급 op(addRoleBlock · addTag)를 가진 각인은 retroactive 다", () => {
        const retro = SIGIL_DATA.sigils.filter((d) =>
            (d.hooks ?? []).some(
                (h) => h.on === "modifyStat" && (h.op === "addRoleBlock" || h.op === "addTag")
            )
        );
        expect(retro.length, "소급 각인이 사라졌다면 전제가 바뀐 것이다").toBeGreaterThan(0);
        for (const d of retro) expect(sigilTiming(d.id), d.id).toBe("retroactive");
    });

    it("★ 수치를 미는 각인은 nextSummon 이다 (일찍 고르는 판단이 의미를 갖는다)", () => {
        const stat = SIGIL_DATA.sigils.filter((d) =>
            (d.hooks ?? []).some(
                (h) => h.on === "modifyStat" && h.op !== "addRoleBlock" && h.op !== "addTag"
            )
        );
        expect(stat.length).toBeGreaterThan(0);
        for (const d of stat) expect(sigilTiming(d.id), d.id).toBe("nextSummon");
    });
});

describe("화면은 판정하지 않고 문구만 고른다", () => {
    it("★ SigilDraft 가 sigilTiming 을 쓴다 — 자체 판정을 만들지 않는다", () => {
        expect(/sigilTiming\(/.test(SRC), "화면이 sigilTiming 을 부르지 않는다").toBe(true);
        expect(
            /isRetroactive/.test(SRC),
            "참/거짓 술어로 되돌아갔다 — 그것이 8종을 거짓말하게 만든 원인이다"
        ).toBe(false);
    });

    /**
     * ★★ 문구 표에 키가 빠지면 화면에 `undefined` 가 뜬다. 새 시점을 추가하고
     *   문구를 잊는 것을 여기서 잡는다.
     */
    it("★★ TIMING_NOTE 가 세 시점 문구를 전부 갖는다", () => {
        for (const t of TIMINGS) {
            expect(
                new RegExp(`${t}\\s*:\\s*["'“]`).test(SRC),
                `TIMING_NOTE 에 ${t} 문구가 없다 — 그 각인 카드에 undefined 가 뜬다`
            ).toBe(true);
        }
    });

    it("★ 실제로 쓰이는 시점이 전부 문구를 갖는다", () => {
        const used = new Set(ALL.map(sigilTiming));
        for (const t of used) {
            expect(new RegExp(`${t}\\s*:`).test(SRC), `${t} 문구 누락`).toBe(true);
        }
    });
});
