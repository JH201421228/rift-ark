/**
 * rosterSlice 단위 테스트
 *
 * 슬라이스는 (set, get) => ({...}) 인 순수 팩토리이므로 zustand 없이 직접 테스트한다.
 *
 * ★★ 2026-08-04 경량화로 승급 · 장비 · 소유 효과가 사라졌고 그 테스트도 같이
 *   지웠다. 남은 성장은 레벨 하나이고, 확률형 요소는 이 게임에 존재하지 않는다.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DEFAULT_LANG, setLang, t } from "@/i18n";
import { createRosterSlice, LOADOUT_SIZE } from "./rosterSlice.js";
import { RECRUITABLE, recruitCost, recruitUnlockStage } from "@/game/logic/recruit";
import { levelUpPlan, unitLevelCap } from "@/game/logic/progression";

/**
 * 미니 스토어 — zustand 없이 set/get 만 흉내낸다.
 * rosterSlice 는 재화 차감을 위해 metaSlice 의 함수를 부르므로 최소 스텁을 끼운다.
 */
function makeSlice() {
    let state = {};
    const get = () => state;
    const set = (patch) => {
        const next = typeof patch === "function" ? patch(state) : patch;
        state = { ...state, ...next };
    };
    state = {
        meta: { currencies: { gold: 0 }, ark: {}, starTree: {}, highestStage: 0 },
        addCurrency: (kind, amt) => {
            state.meta.currencies[kind] = Math.max(0, state.meta.currencies[kind] + amt);
        },
        spendCurrency: (kind, amt) => {
            if (state.meta.currencies[kind] < amt) return false;
            state.meta.currencies[kind] -= amt;
            return true;
        },
        ...createRosterSlice(set, get),
    };
    return { get, set };
}

describe("rosterSlice", () => {
    let store;
    beforeEach(() => {
        store = makeSlice();
    });

    it("편성 슬롯은 6개다", () => {
        expect(store.get().getLoadout()).toHaveLength(LOADOUT_SIZE);
        expect(store.get().roster.presets).toHaveLength(3);
    });

    it("신규 동료는 1레벨로 지급된다", () => {
        expect(store.get().grantUnit("honking_goose")).toBe("new");
        expect(store.get().roster.owned.honking_goose).toEqual({ level: 1 });
    });

    it("★ 중복 지급은 이미 가진 것을 건드리지 않는다", () => {
        store.get().grantUnit("honking_goose");
        store.set((s) => ({
            roster: { ...s.roster, owned: { ...s.roster.owned, honking_goose: { level: 9 } } },
        }));
        expect(store.get().grantUnit("honking_goose")).toBe("duplicate");
        expect(store.get().roster.owned.honking_goose.level).toBe(9);
    });

    /* ─────────── 영입 (2026-08-04) ─────────── */

    it("영입은 골드를 차감하고 동료를 준다", () => {
        const id = RECRUITABLE[0];
        const cost = recruitCost(id);
        const at = recruitUnlockStage(id);
        store.set((s) => ({ meta: { ...s.meta, currencies: { gold: cost }, highestStage: at } }));

        expect(store.get().recruitUnit(id).ok).toBe(true);
        expect(store.get().roster.owned[id]).toEqual({ level: 1 });
        expect(store.get().meta.currencies.gold).toBe(0);
    });

    it("★ 골드가 모자라면 **아무것도** 일어나지 않는다 — 반쯤 성공이 없다", () => {
        const id = RECRUITABLE[0];
        const cost = recruitCost(id);
        const at = recruitUnlockStage(id);
        store.set((s) => ({
            meta: { ...s.meta, currencies: { gold: cost - 1 }, highestStage: at },
        }));

        expect(store.get().recruitUnit(id).ok).toBe(false);
        expect(store.get().roster.owned[id]).toBeUndefined();
        expect(store.get().meta.currencies.gold).toBe(cost - 1);
    });

    it("★ 해금 전에는 골드가 넘쳐도 막힌다 — 스토어가 판정한다", () => {
        const id = RECRUITABLE.find((x) => recruitUnlockStage(x) > 0);
        store.set((s) => ({
            meta: {
                ...s.meta,
                currencies: { gold: 1e9 },
                highestStage: recruitUnlockStage(id) - 1,
            },
        }));

        const r = store.get().recruitUnit(id);
        expect(r.ok).toBe(false);
        expect(r.reason).toBe("locked");
        expect(store.get().meta.currencies.gold).toBe(1e9);
    });

    it("같은 동료를 두 번 살 수 없다", () => {
        const id = RECRUITABLE[0];
        const cost = recruitCost(id);
        store.set((s) => ({
            meta: {
                ...s.meta,
                currencies: { gold: cost * 3 },
                highestStage: recruitUnlockStage(id),
            },
        }));
        expect(store.get().recruitUnit(id).ok).toBe(true);
        expect(store.get().recruitUnit(id).reason).toBe("owned");
        expect(store.get().meta.currencies.gold).toBe(cost * 2);
    });

    it("같은 동료가 두 칸에 중복 편성되지 않는다", () => {
        store.get().setPresetSlot(0, 0, "goose");
        store.get().setPresetSlot(0, 3, "goose");
        const units = store.get().roster.presets[0].units;
        expect(units.filter((u) => u === "goose")).toHaveLength(1);
        expect(units[3]).toBe("goose");
        expect(units[0]).toBeNull();
    });
    /* ─────────── 빈 편성 폴백 (통합, P8-03 후속) ───────────
     *
     * ★★ 예전에는 `BattleScreen` 에 `DEFAULT_LOADOUT` 이라는 하드코딩 6종이 있었다.
     *   그 목록에는 **어떤 경로로도 얻을 수 없는 동료**가 들어 있었고, 슬롯을
     *   `{id}` 로만 만들어 레벨·별 트리가 전부 무시됐다 —
     *   화면에는 "Lv.30" 인데 전투에서는 1레벨로 싸웠다.
     *   시작 로스터의 두 번째 출처이기도 했다.
     */
    describe("빈 편성으로 출격하면 보유분에서 채운다", () => {
        it("보유하지 않은 동료는 절대 고르지 않는다", () => {
            store.get().grantUnit("slow_turtle");
            store.get().grantUnit("elf_sharpshooter");
            const ids = store.get().getBattleLoadout("1-1");
            expect(ids.length).toBeGreaterThan(0);
            for (const id of ids) {
                expect(store.get().roster.owned, `${id} 를 보유하지 않았다`).toHaveProperty(id);
            }
        });

        it("결정론이다 — 같은 보유·같은 스테이지면 같은 답", () => {
            store.get().grantUnit("slow_turtle");
            store.get().grantUnit("elf_sharpshooter");
            const a = store.get().getBattleLoadout("1-1");
            for (let i = 0; i < 5; i++) expect(store.get().getBattleLoadout("1-1")).toEqual(a);
        });

        it("편성이 있으면 폴백을 쓰지 않는다", () => {
            store.get().grantUnit("slow_turtle");
            store.get().grantUnit("elf_sharpshooter");
            store.get().setPresetSlot(0, 0, "elf_sharpshooter");
            expect(store.get().getBattleLoadout("1-1")).toEqual(["elf_sharpshooter"]);
        });

        it("신규 계정은 시작 보유로 이미 채워진다 (P8-03)", () => {
            // 아무것도 하지 않은 슬라이스 = 신규 계정. 예전에는 여기가 0종이었다.
            expect(store.get().getBattleLoadout("1-1").length).toBeGreaterThan(0);
        });

        it("보유가 0종이면 빈 편성이다 — 없는 동료를 지어내지 않는다", () => {
            store.set((s) => ({ roster: { ...s.roster, owned: {} } }));
            expect(store.get().getBattleLoadout("1-1")).toEqual([]);
        });

        it("★ 폴백 슬롯도 성장이 반영된다 — 1레벨로 싸우지 않는다", () => {
            store.get().grantUnit("slow_turtle");
            store.set((s) => ({
                roster: { ...s.roster, owned: { ...s.roster.owned, slow_turtle: { level: 30 } } },
                meta: { ...s.meta, ark: { armory: 10 } },
            }));
            const slots = store.get().getBattleSlots("1-1");
            const turtle = slots.find((x) => x.id === "slow_turtle");
            expect(turtle, "폴백이 보유 동료를 고르지 않았다").toBeTruthy();
            expect(turtle.level).toBe(30);
            // ★ 무기고도 실려야 한다 — 시설을 올렸는데 전투가 모르면 그것도 같은 사고다
            expect(turtle.atkPct).toBeGreaterThan(0);
        });
    });
});

/**
 * ★★ 확인 모달이 말하는 숫자와 실제로 나가는 골드가 같은가 (2026-08-05).
 *
 *   모달은 `logic/progression.js:levelUpPlan` 으로 "치를 값과 도달할 레벨"을 계산하고,
 *   실제 처리는 `rosterSlice.levelUp` 이 한다. **둘은 서로 다른 코드다.** 갈라지면
 *   화면은 "12,400 골드"라고 말하고 지갑에서는 7,900 만 빠지는 식이 된다 —
 *   그 어긋남은 아무 테스트도 실패시키지 않으면서 신뢰만 깎는다.
 */
describe("레벨업 계획(모달) ↔ 실제 처리", () => {
    const cases = [
        { gold: 10_000_000, yard: 20, level: 1, times: 10, why: "여유로울 때" },
        { gold: 200, yard: 20, level: 1, times: 10, why: "골드에 걸릴 때" },
        { gold: 10_000_000, yard: 1, level: 1, times: 10, why: "레벨 상한에 걸릴 때" },
        { gold: 0, yard: 20, level: 5, times: 1, why: "한 번도 못 올릴 때" },
    ];

    for (const c of cases) {
        it(`${c.why} — 계획한 비용·도달 레벨이 실제와 일치한다`, () => {
            const store = makeSlice();
            store.set((s) => ({
                meta: {
                    ...s.meta,
                    currencies: { gold: c.gold },
                    ark: { ...s.meta.ark, trainingYard: c.yard },
                },
            }));
            store.get().grantUnit("honking_goose");
            store.set((s) => ({
                roster: { ...s.roster, owned: { ...s.roster.owned, honking_goose: { level: c.level } } },
            }));

            const cap = unitLevelCap(c.yard);
            const plan = levelUpPlan(c.level, cap, c.gold, c.times);

            store.get().levelUp("honking_goose", c.times);

            expect(store.get().roster.owned.honking_goose.level, "도달 레벨").toBe(plan.to);
            expect(store.get().meta.currencies.gold, "남는 골드").toBe(plan.after);
            expect(c.gold - store.get().meta.currencies.gold, "치른 골드").toBe(plan.cost);
        });
    }
});

/**
 * 편성 칸 맞바꾸기 — 드래그 앤 드롭의 규칙 (2026-08-05).
 *
 * ★★ 화면이 `setPresetSlot` 을 두 번 부르는 것으로 구현하면 **동료가 사라진다.**
 *   첫 호출 직후 같은 동료가 두 칸에 있는 중간 상태가 실제로 만들어지고,
 *   `setPresetSlot` 의 중복 제거 규칙이 그것을 보고 한 칸을 비우기 때문이다.
 *   그래서 맞바꾸기는 **한 번의 set** 이어야 한다.
 */
describe("편성 칸 맞바꾸기", () => {
    let store;
    beforeEach(() => {
        store = makeSlice();
        store.get().setPresetUnits(0, ["a_unit", "b_unit", null, null, null, null]);
    });

    it("두 칸이 자리를 바꾼다", () => {
        store.get().swapPresetSlots(0, 0, 1);
        const units = store.get().roster.presets[0].units;
        expect(units[0]).toBe("b_unit");
        expect(units[1]).toBe("a_unit");
    });

    it("★ 빈 칸과 바꾸면 '이동'이 된다 — 동료가 사라지지 않는다", () => {
        store.get().swapPresetSlots(0, 0, 4);
        const units = store.get().roster.presets[0].units;
        expect(units[4]).toBe("a_unit");
        expect(units[0]).toBe(null);
        expect(units.filter((x) => x === "a_unit")).toHaveLength(1);
    });

    it("같은 칸이거나 범위 밖이면 아무것도 바뀌지 않는다", () => {
        const before = [...store.get().roster.presets[0].units];
        store.get().swapPresetSlots(0, 2, 2);
        store.get().swapPresetSlots(0, 0, 99);
        store.get().swapPresetSlots(0, -1, 1);
        expect(store.get().roster.presets[0].units).toEqual(before);
    });

    it("다른 프리셋은 건드리지 않는다", () => {
        const other = [...store.get().roster.presets[1].units];
        store.get().swapPresetSlots(0, 0, 1);
        expect(store.get().roster.presets[1].units).toEqual(other);
    });
});

/**
 * ★★★ **프리셋 기본 이름은 세이브에 굳으면 안 된다** (2026-08-07).
 *
 *   예전에는 `"기본"` 이 그대로 디스크에 갔다. 그 순간 그 계정의 프리셋 이름은
 *   **만들어진 날의 언어**가 되고, 설정에서 영어로 바꿔도 편성 탭 세 칸만
 *   한국어로 남는다 — 되돌릴 방법은 손으로 이름을 고치는 것뿐이다.
 *
 *   세이브가 드는 것은 "이름을 지었는가"(`nameDefault`) 하나이고, 보이는 글자는
 *   읽을 때마다 카탈로그에서 온다.
 */
describe("rosterSlice — 프리셋 이름과 언어", () => {
    let store;
    beforeEach(() => {
        setLang(DEFAULT_LANG);
        store = makeSlice();
    });
    afterEach(() => setLang(DEFAULT_LANG));

    it("기본 프리셋은 '기본 이름'이라는 표식을 함께 든다", () => {
        for (const p of store.get().roster.presets) {
            expect(p.nameDefault).toBe(true);
            expect(typeof p.name).toBe("string");
            expect(p.name.length).toBeGreaterThan(0);
        }
    });

    it("★★★ 언어를 바꾸면 기본 이름이 따라온다", () => {
        expect(store.get().roster.presets[0].name).toBe(t("system.presetBasic", undefined, "ko"));
        setLang("en");
        store.get().relocalizePresets();
        expect(store.get().roster.presets[0].name).toBe(t("system.presetBasic", undefined, "en"));
        expect(store.get().roster.presets[2].name).toBe(t("system.presetAntiAir", undefined, "en"));
    });

    it("★★ 사용자가 지은 이름은 언어를 따라가지 않는다", () => {
        store.get().renamePreset(1, "돌격대");
        expect(store.get().roster.presets[1].nameDefault).toBe(false);
        setLang("en");
        store.get().relocalizePresets();
        expect(store.get().roster.presets[1].name).toBe("돌격대");
        // 다른 칸은 여전히 따라온다 — 하나가 굳었다고 전부 굳지 않는다
        expect(store.get().roster.presets[0].name).toBe(t("system.presetBasic", undefined, "en"));
    });

    it("이름을 지우면 기본으로 돌아가고 다시 언어를 따라간다", () => {
        store.get().renamePreset(0, "돌격대");
        store.get().renamePreset(0, "   ");
        expect(store.get().roster.presets[0].nameDefault).toBe(true);
        setLang("en");
        store.get().relocalizePresets();
        expect(store.get().roster.presets[0].name).toBe(t("system.presetBasic", undefined, "en"));
    });

    it("★★ 구세이브의 한국어 기본 이름을 알아본다 (SAVE_VERSION 을 올리지 않고)", () => {
        // `nameDefault` 가 없는 옛 모양 — 이름만 한국어로 적혀 있다
        store.set({
            roster: {
                owned: {},
                activePreset: 0,
                presets: [
                    { name: "기본", units: [] },
                    { name: "나의 편성", units: [] },
                    { name: "대공", units: [] },
                ],
            },
        });
        store.get().normalizeRoster();
        const p = store.get().roster.presets;
        expect(p[0].nameDefault).toBe(true);
        expect(p[1].nameDefault).toBe(false);
        expect(p[1].name).toBe("나의 편성");
        expect(p[2].nameDefault).toBe(true);

        setLang("en");
        store.get().relocalizePresets();
        expect(store.get().roster.presets[0].name).toBe(t("system.presetBasic", undefined, "en"));
        expect(store.get().roster.presets[1].name).toBe("나의 편성");
    });

    it("세 칸을 넘는 프리셋은 번호로 부른다 (구버전 계정을 이름 없는 칸으로 만들지 않는다)", () => {
        store.set({
            roster: {
                owned: {},
                activePreset: 0,
                presets: [{}, {}, {}, {}],
            },
        });
        store.get().normalizeRoster();
        expect(store.get().roster.presets).toHaveLength(4);
        expect(store.get().roster.presets[3].name).toBe(t("system.presetN", { n: 4 }));
    });
});
