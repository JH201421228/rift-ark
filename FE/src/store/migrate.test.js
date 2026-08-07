/**
 * 세이브 마이그레이션 테스트
 *
 * ★ 이 파일이 막으려는 사고는 하나다: **업데이트 직후 화이트스크린.**
 *   구세이브에는 신규 필드가 없고, zustand persist 는 저장본을 기본값 위에
 *   통째로 얹는다. 채우지 않은 필드에 접근하는 순간 첫 렌더가 터진다.
 *
 * ★★ **v15(2026-08-04 경량화)가 v1–v14 블록을 통째로 접었다.** 그 블록들이
 *   채우던 키(`shop` · `gacha` · `daily` · `dungeons` · `tower` · `trials` · `ads`)는
 *   더 이상 존재하지 않는다. 그래서 이 파일이 검사하는 것도 하나로 줄었다:
 *   **어떤 옛 버전에서 와도 살아 있는 네 키가 온전한가** (meta · roster · settings · ftue).
 */
import { describe, it, expect } from "vitest";
import { migrate } from "./migrate.js";
import SETTINGS_DATA from "@/game/data/settings.json";
// ★ 확정 지급 목록을 테스트가 다시 적지 않는다 — 규칙 모듈이 유일한 출처다.
import { guaranteedUnitsUpTo, STARTING_UNITS } from "@/game/logic/unlocks";

/** 경량화 직전(v14) 시점의 세이브 모양 */
const v14Save = () => ({
    roster: {
        owned: {
            slow_turtle: { level: 30, rank: 4, shards: 12, ownedStep: 2, gear: { weapon: 3 }, gearPlus: { weapon: 7 } },
        },
        presets: [],
        activePreset: 0,
    },
    meta: {
        currencies: { gold: 1000, gems: 50, stones: 100, guildCoins: 7 },
        highestStage: 42,
        ark: { trainingYard: 12, forge: 8, sanctum: 4, observatory: 6, market: 3, archive: 2 },
        arkBuilding: { sanctum: 99999999999 },
        idleLastClaimAt: 1234,
        dispatch: [null, null, null, null, null],
        dispatchAuto: true,
        bestiary: { seen: ["goblin"], killed: { goblin: 10 } },
        sigilsFound: ["s1"],
        sigilEvolutionsFound: ["e1"],
        starTree: { atk_1: 3, idle_1: 5 },
    },
    settings: { bgmVolume: 0.4, gachaSkip: true, notifyIdleFull: true },
    ftue: { stepIndex: 4, done: false },
    shop: { purchases: {} },
    gacha: { seed: 1, log: [] },
    daily: { login: { claimCount: 3 } },
    dungeons: { day: 5, runs: {} },
    tower: { bestFloor: 17 },
    trials: { claimed: ["t1a"] },
    ads: { total: 3 },
});

describe("migrate — v15 경량화: 사라진 시스템을 세이브에서 걷어낸다", () => {
    it("삭제된 최상위 키를 전부 지운다", () => {
        const out = migrate(v14Save(), 14);
        for (const k of ["shop", "gacha", "daily", "dungeons", "tower", "trials", "ads"]) {
            expect(out, `${k} 가 남아 있다 — 아무도 읽지 않는 바이트다`).not.toHaveProperty(k);
        }
    });

    it("삭제된 meta 하위 키도 지운다", () => {
        const out = migrate(v14Save(), 14);
        for (const k of ["dispatch", "dispatchAuto", "idleLastClaimAt", "bestiary", "sigilEvolutionsFound"]) {
            expect(out.meta).not.toHaveProperty(k);
        }
        // 살아 있는 것은 그대로다
        expect(out.meta.highestStage).toBe(42);
        expect(out.meta.sigilsFound).toEqual(["s1"]);
    });

    /**
     * ★★ **버리지 않고 골드로 바꾼다.** 젬·강화석은 소모처가 사라졌으므로
     *   그대로 두면 "가진 것이 조용히 증발"한다.
     */
    it("젬 · 강화석을 골드로 환산한다", () => {
        const out = migrate(v14Save(), 14);
        expect(out.meta.currencies).toEqual({ gold: 1000 + 50 * 20 + 100 * 12 });
    });

    it("길드 코인처럼 소모처가 없던 재화는 남기지 않는다", () => {
        const out = migrate(v14Save(), 14);
        expect(out.meta.currencies).not.toHaveProperty("guildCoins");
    });

    /**
     * ★ 대장간 레벨을 무기고가 승계한다. 둘 다 "전투력을 올리는 시설"이었으므로
     *   거기 쓴 골드의 의미가 이어진다.
     */
    it("대장간(forge) 레벨을 무기고(armory)가 이어받고 사라진 시설은 지운다", () => {
        const out = migrate(v14Save(), 14);
        expect(out.meta.ark.armory).toBe(8);
        expect(out.meta.ark).not.toHaveProperty("forge");
        expect(out.meta.ark).not.toHaveProperty("observatory");
        expect(out.meta.ark).not.toHaveProperty("market");
        expect(out.meta.ark.trainingYard).toBe(12);
    });

    it("진행 중이던 건설은 즉시 완료로 본다 — 시간 게이트가 사라졌다", () => {
        const out = migrate(v14Save(), 14);
        expect(out.meta.arkBuilding).toEqual({});
    });

    /**
     * ★ 사라진 별 트리 노드(`idle_1`)에 쓴 별은 **자동으로 되돌아온다** —
     *   `starsSpent` 가 모르는 노드를 세지 않기 때문이다. 여기서 손대면 이중 환급이다.
     */
    it("사라진 별 트리 노드를 지운다 (별은 자동 환급된다)", () => {
        const out = migrate(v14Save(), 14);
        expect(out.meta.starTree).toEqual({ atk_1: 3 });
    });

    it("동료는 레벨만 남기고 승급·장비·소유효과 필드를 떨어낸다", () => {
        const out = migrate(v14Save(), 14);
        expect(out.roster.owned.slow_turtle).toEqual({ level: 30 });
    });

    it("★ 레벨을 초기화하지 않는다 — '업데이트했더니 1레벨' 은 회귀다", () => {
        const out = migrate(v14Save(), 14);
        expect(out.roster.owned.slow_turtle.level).toBe(30);
    });

    it("사라진 설정 스위치를 떨어내고 남은 값은 보존한다", () => {
        const out = migrate(v14Save(), 14);
        expect(out.settings.bgmVolume).toBe(0.4);
        expect(out.settings).not.toHaveProperty("gachaSkip");
        expect(out.settings).not.toHaveProperty("notifyIdleFull");
    });

    it("신규 설정 키를 빠짐없이 채운다 — 첫 렌더가 터지지 않는다", () => {
        const out = migrate(v14Save(), 14);
        for (const key of Object.keys(SETTINGS_DATA.defaults)) {
            expect(out.settings, `${key} 가 채워지지 않았다`).toHaveProperty(key);
            expect(out.settings[key]).not.toBeUndefined();
        }
    });
});

/**
 * ★★ 이미 플레이한 계정에 튜토리얼을 다시 띄우지 않는다.
 *   "병사를 소환하세요" 손가락이 30레벨 계정에 뜨는 것은 업데이트가 만들 수 있는
 *   가장 모욕적인 회귀다.
 */
describe("migrate — v16 튜토리얼 삭제", () => {
    it("★ 옛 세이브의 ftue 키를 떨어낸다", () => {
        const out = migrate(
            { meta: { currencies: { gold: 0 }, highestStage: 3 }, ftue: { stepIndex: 7, done: false } },
            15
        );
        expect(out.ftue).toBeUndefined();
    });

    it("★★ 튜토리얼이 주던 시작 동료는 그대로 남는다 — 삭제가 진행을 깎지 않는다", () => {
        // 예전에는 시작 2종이 `ftue.json` 의 unlocks 에서 파생됐다. 그 출처가 사라져도
        // `unlocks.json:startingUnits` 가 같은 둘을 주고, 소급 지급이 그것을 채운다.
        const out = migrate({ meta: { currencies: { gold: 0 }, highestStage: 0 } }, 7);
        for (const id of STARTING_UNITS) {
            expect(out.roster.owned[id], `${id} 가 시작 보유에서 사라졌다`).toBeDefined();
        }
    });
});

describe("migrate — 확정 지급 동료 소급", () => {
    it("진행도가 보장하는 동료를 전부 채운다", () => {
        const out = migrate({ meta: { highestStage: 40 }, roster: { owned: {} } }, 12);
        for (const id of guaranteedUnitsUpTo(40)) {
            expect(out.roster.owned, id).toHaveProperty(id);
        }
    });

    it("이미 보유한 동료의 레벨을 덮어쓰지 않는다", () => {
        const out = migrate(
            { meta: { highestStage: 40 }, roster: { owned: { slow_turtle: { level: 30 } } } },
            12
        );
        expect(out.roster.owned.slow_turtle.level).toBe(30);
    });

    it("신규 계정(진행도 0)도 시작 보유를 받는다", () => {
        const out = migrate({ meta: { highestStage: 0 } }, 13);
        for (const id of guaranteedUnitsUpTo(0)) {
            expect(out.roster.owned, id).toHaveProperty(id);
        }
    });
});

/**
 * ★★ **여기서 던지면 앱이 안 뜬다.** zustand 는 migrate 를 하이드레이션 프로미스
 *   체인 안에서 부르므로 실패가 `hasHydrated === false` 로 굳고, 화면이 영구히 빈다.
 */
describe("migrate — 손상된 세이브에 절대 던지지 않는다", () => {
    for (const bad of [null, undefined, "문자열", 42, [], [1, 2, 3], { meta: null }, { roster: 5 }]) {
        it(`${JSON.stringify(bad) ?? "undefined"} 를 넣어도 던지지 않는다`, () => {
            expect(() => migrate(bad, 1)).not.toThrow();
            expect(() => migrate(bad, 14)).not.toThrow();
        });
    }

    it("meta.currencies 가 쓰레기여도 골드가 NaN 이 되지 않는다", () => {
        const out = migrate({ meta: { currencies: { gold: "x", gems: null } } }, 14);
        expect(Number.isFinite(out.meta.currencies.gold)).toBe(true);
    });

    it("roster.owned 가 배열이어도 살아남는다", () => {
        expect(() => migrate({ roster: { owned: [1, 2] } }, 14)).not.toThrow();
    });

    it("멱등이다 — 두 번 돌려도 같은 결과다", () => {
        const once = migrate(v14Save(), 14);
        const twice = migrate(structuredClone(once), 14);
        expect(twice).toEqual(once);
    });
});
