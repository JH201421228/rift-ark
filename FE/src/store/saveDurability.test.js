/**
 * 세이브 내구성 — 손상 · 미래 버전 · 부분 결손 · 적대적 값 (P8-05)
 *
 * ★★ **이 파일은 `migrate()` 를 테스트하지 않는다.** 그것은 `migrate.test.js` 가 한다.
 *   여기가 재는 것은 **플레이어가 실제로 지나는 경로 전체**다:
 *
 *       디스크의 바이트 → JSON.parse → migrate → persist merge → normalize*
 *
 *   순수 함수만 검증하면 "migrate 는 완벽한데 앱은 검은 화면"이 그대로 통과한다.
 *   실제로 이 저장소가 그랬다 (아래 '하이드레이션 게이트' 블록).
 *
 * ★★ **"죽지 않는다"만으로는 부족하다.** 손상된 세이브에서 진행도가 조용히 0 이 되는
 *   것은 크래시보다 나쁘다 — 크래시는 재시작하면 되지만 지워진 진행은 돌아오지 않는다.
 *   그래서 모든 케이스에서 **무엇이 살아남고 무엇이 버려지는지**를 단언한다.
 *
 * ★ 값을 여기 다시 적지 않는다. 유닛 id 는 `UNIT_DEFS`, 저장 키 목록은 **실제
 *   partialize 가 기록한 봉투**, 스테이지 상한은 `stages.json` 에서 가져온다.
 *   손으로 적는 순간 이 파일이 두 번째 출처가 되고, 그것이 이 저장소의 단골 사고다.
 *
 * @see docs/03-tech/21-state-management.md §6
 * @see src/store/migrate.test.js — 마이그레이션 블록 단위 규칙
 * @see src/store/saveVersion.test.js — SAVE_VERSION ↔ 블록 정합성
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from "vitest";
import { migrate } from "./migrate.js";
// ★ 검사 구간을 손으로 적지 않는다 — 상수가 올라가면 구간도 같이 올라가야 한다.
import { SAVE_VERSION } from "./index.js";
import { LOADOUT_SIZE } from "./slices/rosterSlice.js";
// ★ 검사기는 규칙 모듈을 import 해서 대조한다 (값 복사 금지).
import { UNIT_DEFS, stagesData, buildStageConfig } from "@/game/logic/stageConfig";
import { globalStageIndex, DEFAULT_DIFFICULTY } from "@/game/logic/difficulty";
// ★ 나이트메어를 문자열로 적지 않는다 — 규칙이 걸리는 난이도가 곧 그것이다.
import { RULE_DIFFICULTIES } from "@/game/logic/nightmare";
import { facilityUnlocked } from "@/game/logic/progression";
import balance from "@/game/data/balance.json";

/** 신규 계정 시작 골드 — 수치를 여기 적지 않는다 (절대 규칙 4) */
const START_GOLD = balance.economy.startingGold;

/* ═══════════════════════ 하네스 ═══════════════════════ */

/** vi.mock 팩토리보다 먼저 만들어져야 한다 (index.test.js 와 같은 규약) */
const io = vi.hoisted(() => ({
    /** @type {string|null} 디스크에 들어 있는 **원문 바이트** */
    raw: null,
    /** @type {string[]} 기록된 원문 */
    writes: [],
}));

/**
 * ★★ **어댑터(`@/native/storage`)를 갈아 끼우지 않는다 — 그 아래의 플러그인만 바꾼다.**
 *
 *   예전에는 `vi.mock("@/native/storage")` 로 어댑터째 대체했다. 그러면
 *   "디스크의 바이트 → JSON.parse → migrate → merge → normalize" 중
 *   **첫 칸이 통째로 테스트에서 빠진다** — 그런데 이 파일이 가장 비싸게 잡은 결함
 *   (손상 세이브 → 하이드레이션 게이트가 영원히 닫힘)의 수정 자리가 바로 그 첫 칸이다.
 *   어댑터를 대체한 채로는 그 수정을 **관측할 수 없고**, 되돌아가도 아무도 모른다.
 *
 *   그래서 경계를 한 칸 아래로 내린다: 네이티브 플러그인만 가짜로 두고
 *   `capacitorStorage` 는 **앱이 쓰는 그것 그대로** 지나간다.
 */
vi.mock("@capacitor/core", () => ({
    Capacitor: { isNativePlatform: () => true },
}));
vi.mock("@capacitor/preferences", () => ({
    Preferences: {
        get: async () => ({ value: io.raw }),
        set: async ({ value }) => {
            io.writes.push(value);
        },
        remove: async () => {
            io.raw = null;
        },
    },
}));

/** 매크로태스크 한 번 — 하이드레이션 체인(성공·실패 양쪽)이 여기서 정착한다 */
const settle = () => new Promise((r) => setTimeout(r, 0));

let warnSpy;
beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
    warnSpy.mockRestore();
});

/**
 * 주어진 바이트를 디스크에 놓고 앱을 **콜드 스타트**한다.
 *
 * ★ `onFinishHydration` 을 기다리지 않는다 — 손상된 세이브에서는 그 이벤트가
 *   **영원히 오지 않기 때문이다.** 기다리면 테스트가 타임아웃으로 죽고, 정작
 *   측정하려던 사실(게이트가 열리지 않는다)은 기록되지 않는다.
 *
 * @param {string|object|null} save 원문 문자열 · 봉투 객체 · null(세이브 없음)
 */
async function boot(save) {
    vi.resetModules();
    io.raw = save == null ? null : typeof save === "string" ? save : JSON.stringify(save);
    io.writes = [];
    const mod = await import("@/store");
    await settle();
    await settle();
    return mod;
}

/**
 * **partialize 가 실제로 기록한 봉투.**
 *
 * ★ 저장 키 목록을 손으로 적지 않기 위해 기본 상태를 한 번 저장시켜 그 결과를 쓴다.
 *   손으로 적으면 슬라이스가 하나 늘어난 날 이 파일만 옛 목록으로 남는다 —
 *   이 저장소가 실제로 겪은 사고의 모양 그대로다.
 */
let ENVELOPE;
/** @type {string[]} 최상위 세이브 키 (roster · meta · … ) */
let SAVE_KEYS;

/** 데이터가 정하는 캠페인 마지막 스테이지의 전역 순번 */
const MAX_STAGE_INDEX = stagesData.stages.reduce((m, s) => Math.max(m, globalStageIndex(s.id)), 0);

/** 실재하는 동료 id — 픽스처가 썩지 않도록 정의에서 가져온다 */
const REAL_UNITS = Object.keys(UNIT_DEFS);

/**
 * 나이트메어 난이도 id.
 *
 * ★ `"nightmare"` 를 손으로 적지 않는다 (이 파일 머리말의 규약). 나이트메어는
 *   **월드별 규칙이 걸리는 난이도**로 데이터에서 정의되고, `RULE_DIFFICULTIES`
 *   가 그 목록을 `balance.json` 에서 파생한다.
 */
const RULE_DIFF = RULE_DIFFICULTIES[0];

beforeAll(async () => {
    const { flushSave, SAVE_VERSION } = await boot(null);
    await flushSave();
    ENVELOPE = JSON.parse(io.writes.at(-1));
    SAVE_KEYS = Object.keys(ENVELOPE.state);
    expect(ENVELOPE.version).toBe(SAVE_VERSION);
});

/** 기본 봉투에 조각을 얹은 세이브 */
const envelopeWith = (patch, version = null) => ({
    version: version ?? ENVELOPE.version,
    state: { ...structuredClone(ENVELOPE.state), ...patch },
});

/** 진행도가 있는 계정 — "무엇이 살아남는가" 를 물을 대상 */
const PROGRESS = () => ({
    meta: {
        ...structuredClone(ENVELOPE.state.meta),
        currencies: { gold: 12345 },
        highestStage: 45,
        stageStars: { "1-1": 3, "1-2": 2 },
    },
    roster: {
        owned: {
            [REAL_UNITS[0]]: { level: 20 },
        },
        presets: [{ name: "기본", units: [REAL_UNITS[0], null, null, null, null, null] }],
        activePreset: 0,
    },
});

/** 스토어가 **정말로 쓸 수 있는가** — 화면들이 부팅 직후 부르는 것만 모았다 */
function assertUsable(store) {
    const s = store.getState();
    expect(() => s.getStars()).not.toThrow();
    expect(Number.isFinite(s.getStars().available)).toBe(true);
    expect(s.getLoadout()).toHaveLength(LOADOUT_SIZE);
    expect(() => s.getBattleSlots()).not.toThrow();
    expect(() => s.getArkVisual()).not.toThrow();
    expect(() => s.getSigilParams()).not.toThrow();
    // ★ 출격이 되는가 — 편성에 유령 id 가 남으면 여기서 throw 한다
    //   (`buildStageConfig`: "알 수 없는 동료").
    expect(() => buildStageConfig("1-1", s.getBattleSlots())).not.toThrow();
    // 최상위 세이브 키가 하나도 비어 있지 않다
    for (const k of SAVE_KEYS) expect(s[k], `${k} 가 undefined 다`).toBeDefined();
}

/* ═══════════════════════ 1. 손상된 세이브 ═══════════════════════ */

describe("손상된 세이브", () => {
    it("잘린 JSON — 스토어는 기본값으로 살아나고 아무것도 던지지 않는다", async () => {
        const { useGameStore } = await boot('{"version":13,"state":{"meta":{"currencies":{"gold":1');
        assertUsable(useGameStore);
        // ★ 기본값 = 신규 계정 = 시작 골드를 가진 상태다 (balance.json:economy.startingGold)
        expect(useGameStore.getState().meta.currencies.gold).toBe(START_GOLD);
        expect(useGameStore.getState().meta.highestStage).toBe(0);
    });

    /**
     * ★★ **해결됨 (P8-05 → 통합).**
     *
     *   zustand persist 의 하이드레이션 체인은 `JSON.parse` 가 던지면 `.catch` 로
     *   빠지고, 그 경로에서는 **`hasHydrated` 를 true 로 만들지 않는다**
     *   (node_modules/zustand/esm/middleware.mjs — 성공 경로에만 set 한다).
     *
     *   그런데 `App.jsx` 는 `if (!hydrated) return null` 이다.
     *   → 고치기 전에는 **세이브 파일이 한 바이트라도 잘리면 앱이 영원히 아무것도
     *     그리지 않았다.** 스플래시가 안 사라지고, 설정 화면에 못 들어가니 초기화도
     *     못 한다. 재설치 외에 복구 경로가 없다 — 리뷰 폭탄의 정확한 모양이다.
     *
     *   고친 자리는 `src/native/storage.js` 다 — **파싱 불가 = 세이브 없음.**
     *   이 단언이 이 저장소에서 그 사실을 지키는 유일한 그물이다.
     *   되돌리면(어댑터의 try/catch 제거) 여기가 빨개진다.
     */
    it("★ 잘린 JSON 이어도 하이드레이션 게이트가 열린다 — 검은 화면이 되지 않는다", async () => {
        const { useGameStore, flushSave } = await boot('{"version":13,"state":{"meta":');
        expect(
            useGameStore.persist.hasHydrated(),
            "게이트가 닫혔다 — native/storage.js 의 '파싱 불가 = 세이브 없음' 가드가 사라졌다"
        ).toBe(true);
        // 게이트가 열렸으므로 앱 일시정지 시 세이브 flush 도 정상 동작한다
        expect(await flushSave()).toBe(true);
        // 그리고 스토어는 기본값으로 실제로 쓸 수 있어야 한다 (게이트만 열려서는 소용없다)
        assertUsable(useGameStore);
        expect(useGameStore.getState().meta.highestStage).toBe(0);
    });

    it("JSON 이 아예 아닌 바이트도 앱을 죽이지 않는다", async () => {
        const { useGameStore } = await boot("이건 세이브가 아니다");
        assertUsable(useGameStore);
    });

    it("배열이어야 할 곳이 객체다 — 목록이 통째로 깨져도 화면이 살아난다", async () => {
        const { useGameStore } = await boot(
            envelopeWith({
                roster: { owned: {}, presets: {}, activePreset: 0 },
                meta: { ...structuredClone(ENVELOPE.state.meta), sigilsFound: {} },
            })
        );
        assertUsable(useGameStore);
        const s = useGameStore.getState();
        expect(Array.isArray(s.roster.presets)).toBe(true);
        expect(Array.isArray(s.meta.sigilsFound)).toBe(true);
    });

    it("숫자여야 할 곳이 문자열 · null · 음수다", async () => {
        const { useGameStore } = await boot(
            envelopeWith({
                meta: {
                    ...structuredClone(ENVELOPE.state.meta),
                    currencies: { gold: "많이" },
                    highestStage: "45",
                    stageStars: { "1-1": "3", "1-2": -2, "1-3": null },
                },
            })
        );
        assertUsable(useGameStore);
        const m = useGameStore.getState().meta;
        expect(Number.isFinite(m.currencies.gold)).toBe(true);
        expect(m.currencies.gold).toBeGreaterThanOrEqual(0);
        // ★ "45" 는 **버리지 않고 살린다.** 진행도를 0 으로 만드는 쪽이 훨씬 나쁘다.
        expect(m.highestStage).toBe(45);
        expect(Number.isFinite(useGameStore.getState().getStars().earned)).toBe(true);
        // 문자열 별은 숫자로, 음수·null 은 0 으로
        expect(useGameStore.getState().getStars().earned).toBe(3);
    });

    it("★ NaN 이 highestStage 에 들어와도 해금이 통째로 잠기지 않는다", async () => {
        // JSON 에 NaN 은 없지만 null · "" · {} 는 전부 Number() 에서 NaN 이 된다.
        // NaN >= 25 는 false 다 — 그 순간 던전 · 탑 · 시험이 **전부 잠긴 것처럼 보인다.**
        // 크래시가 아니라서 아무도 원인을 모른다. 정확히 '조용한 진행도 0' 이다.
        const { useGameStore } = await boot(
            envelopeWith({ meta: { ...structuredClone(ENVELOPE.state.meta), highestStage: {} } })
        );
        assertUsable(useGameStore);
        const h = useGameStore.getState().meta.highestStage;
        expect(Number.isFinite(h)).toBe(true);
        expect(h).toBe(0);
    });

    it("최상위 값이 null 이어도 살아난다", async () => {
        const nulled = Object.fromEntries(SAVE_KEYS.map((k) => [k, null]));
        const { useGameStore } = await boot({ version: ENVELOPE.version, state: nulled });
        assertUsable(useGameStore);
    });

    it("최상위 값이 빈 객체여도 살아난다 — 정규화가 던지면 게이트가 닫힌다", async () => {
        // ★★ 이것이 '부분 결손' 보다 **위험한** 모양이다. 키가 없으면 persist 의 얕은
        //   병합이 기본값을 남기지만, `{}` 는 기본값을 **밀어낸 뒤 비워 둔다.**
        //   normalize* 가 여기서 던지면 하이드레이션 체인이 reject 되고
        //   `hasHydrated` 가 false 로 멈춘다 — 잘린 JSON 과 같은 검은 화면이다.
        const emptied = Object.fromEntries(SAVE_KEYS.map((k) => [k, {}]));
        const { useGameStore } = await boot({ version: ENVELOPE.version, state: emptied });
        expect(useGameStore.persist.hasHydrated()).toBe(true);
        assertUsable(useGameStore);
    });
});

/* ═══════════════════════ 2. 미래 버전 세이브 ═══════════════════════ */

/**
 * ★★ **판단: 초기화가 아니라 '최선 시도' 다.**
 *
 *   미래 버전 세이브를 만나는 경로는 하나뿐이다 — **다운그레이드 설치**
 *   (스토어 롤백 · TestFlight 이전 빌드 · 기기 이전). 그 사용자는 잘못한 것이 없다.
 *
 *   ① 초기화하면 **확실한 전손**이다. 되돌릴 방법이 없다.
 *   ② 최선 시도는 이 빌드가 아는 필드를 전부 살리고, 모르는 필드만 잃는다.
 *      잃는 양이 ①보다 작고, 상한이 "새 버전이 추가한 것"으로 한정된다.
 *
 *   ②의 유일한 위험은 **다시 올릴 때의 이중 마이그레이션**이다 (v14 형태의 데이터에
 *   v13→v14 블록이 한 번 더 도는 것). 그래서 그 위험을 여기서 직접 막는다 —
 *   아래 '모든 마이그레이션 블록은 멱등이다' 가 ②를 안전하게 만드는 근거다.
 *   그 검사가 빨개지는 날 이 판단도 같이 재검토해야 한다.
 */
describe("미래 버전 세이브 (다운그레이드 설치)", () => {
    it("version 99 세이브의 진행도를 지킨다 — 초기화하지 않는다", async () => {
        const { useGameStore } = await boot(
            envelopeWith({ ...PROGRESS(), 언젠가_생길_키: { x: 1 } }, 99)
        );
        assertUsable(useGameStore);
        const s = useGameStore.getState();
        expect(s.meta.currencies.gold).toBe(12345);
        expect(s.meta.highestStage).toBe(45);
        expect(s.roster.owned[REAL_UNITS[0]].level).toBe(20);
        // 해금은 highestStage 의 함수다 — 다운그레이드가 콘텐츠를 거꾸로 잠그지 않는다
        expect(facilityUnlocked("archive", s.meta.highestStage)).toBe(true);
    });

    it("이 빌드가 모르는 최상위 키는 다음 저장에서 사라진다 (partialize 가 유일한 출처)", async () => {
        const { flushSave } = await boot(envelopeWith({ 언젠가_생길_키: { x: 1 } }, 99));
        await flushSave();
        const disk = JSON.parse(io.writes.at(-1));
        expect(disk.version).toBe(ENVELOPE.version);
        expect(disk.state).not.toHaveProperty("언젠가_생길_키");
        expect(Object.keys(disk.state).sort()).toEqual([...SAVE_KEYS].sort());
    });

    /**
     * ★ 다운그레이드 → 재업그레이드가 안전한 **유일한 근거**.
     *   미래 세이브를 최선 시도로 읽어 두면 그 데이터는 이미 신버전 형태인데,
     *   다시 올라갈 때 `from` 이 이 빌드의 버전이라 그 구간 블록이 한 번 더 돈다.
     *   블록이 멱등이 아니면 그때 값이 두 배가 되거나 초기화된다.
     */
    it("모든 마이그레이션 블록이 멱등이다 — 두 번 돌아도 같다", () => {
        for (let from = 0; from <= SAVE_VERSION; from++) {
            const once = migrate(structuredClone(ENVELOPE.state), from);
            const twice = migrate(structuredClone(once), from);
            expect(twice, `v${from} 블록이 멱등이 아니다`).toEqual(once);
        }
    });
});

/* ═══════════════════════ 3. 부분 결손 ═══════════════════════ */

describe("부분 결손 — 최상위 키가 통째로 없다", () => {
    it("검사 대상 키를 실제 partialize 에서 가져왔다", () => {
        // 정규식·손목록이 빗나가면 아래 루프 전체가 조용히 0건이 된다
        expect(SAVE_KEYS.length).toBeGreaterThanOrEqual(3);
        expect(SAVE_KEYS).toContain("roster");
        expect(SAVE_KEYS).toContain("meta");
    });

    /**
     * ★ `it.each` 를 쓰지 않는다. 키 목록은 **수집 시점에 아직 없다** —
     *   봉투를 만들려면 스토어를 한 번 부팅해야 하기 때문이다. 목록을 손으로 적어
     *   `it.each` 에 넣으면 그 순간 이 파일이 partialize 의 두 번째 출처가 된다.
     */
    it("최상위 키를 하나씩 지워도 전부 살아난다", async () => {
        for (const missing of SAVE_KEYS) {
            const state = structuredClone(ENVELOPE.state);
            delete state[missing];
            const { useGameStore } = await boot({ version: ENVELOPE.version, state });
            expect(
                useGameStore.persist.hasHydrated(),
                `'${missing}' 가 없는 세이브에서 하이드레이션이 멈췄다`
            ).toBe(true);
            assertUsable(useGameStore);
            // 없어진 키는 기본값으로 복원된다 (다른 키의 진행도는 그대로다)
            expect(useGameStore.getState()[missing], `'${missing}' 가 복원되지 않았다`).toBeDefined();
        }
    });

    it("진행도가 있는 계정에서 키 하나가 사라져도 나머지 진행은 남는다", async () => {
        const state = { ...structuredClone(ENVELOPE.state), ...PROGRESS() };
        const { useGameStore } = await boot({ version: ENVELOPE.version, state });
        assertUsable(useGameStore);
        const s = useGameStore.getState();
        expect(s.meta.currencies.gold).toBe(12345);
        expect(s.meta.highestStage).toBe(45);
        expect(s.roster.owned[REAL_UNITS[0]].level).toBe(20);
    });
});

/* ═══════════════════════ 4. 적대적 값 ═══════════════════════ */

describe("적대적 값", () => {
    it("highestStage 99999 — 존재하는 마지막 스테이지로 잘린다", async () => {
        const { useGameStore } = await boot(
            envelopeWith({ meta: { ...structuredClone(ENVELOPE.state.meta), highestStage: 99999 } })
        );
        assertUsable(useGameStore);
        expect(useGameStore.getState().meta.highestStage).toBe(MAX_STAGE_INDEX);
    });

    it("gold -1 — 0 으로 올린다 (음수 잔액은 모든 구매를 영구히 막는다)", async () => {
        const { useGameStore } = await boot(
            envelopeWith({
                meta: {
                    ...structuredClone(ENVELOPE.state.meta),
                    currencies: { gold: -1 },
                },
            })
        );
        const c = useGameStore.getState().meta.currencies;
        expect(c.gold).toBe(0);

    });

    it("★ 존재하지 않는 동료가 편성에 들어 있으면 출격이 통째로 막힌다 — 그 칸을 비운다", async () => {
        const [u0] = REAL_UNITS;
        const { useGameStore } = await boot(
            envelopeWith({
                roster: {
                    owned: {
                        [u0]: { level: 9, rank: 2, shards: 0, ownedStep: 0, gear: {}, gearPlus: {} },
                        폐기된_동료: { level: 5, rank: 1, shards: 0 },
                    },
                    presets: [{ name: "기본", units: ["폐기된_동료", u0] }],
                    activePreset: 0,
                },
            })
        );
        assertUsable(useGameStore); // ← buildStageConfig 가 여기서 throw 하던 자리
        const s = useGameStore.getState();
        expect(s.getLoadout()).not.toContain("폐기된_동료");
        expect(s.getLoadout()).toContain(u0);
        // ★ **보유 기록은 지우지 않는다.** 데이터가 잠깐 빠진 빌드에서 계정을 켠 것만으로
        //   영구히 잃게 만들면 안 된다 — 편성만 비우면 증상은 완전히 사라진다.
        expect(s.roster.owned).toHaveProperty("폐기된_동료");
        expect(s.roster.owned[u0].level).toBe(9);
    });

    it("프리셋 길이가 슬롯 수와 다르면 슬롯 수에 맞춘다", async () => {
        const [u0, u1, u2] = REAL_UNITS;
        const { useGameStore } = await boot(
            envelopeWith({
                roster: {
                    owned: {},
                    presets: [
                        { name: "짧다", units: [u0] },
                        { name: "길다", units: Array(20).fill(u1) },
                        { name: "구멍", units: null },
                    ],
                    activePreset: 1,
                },
            })
        );
        const s = useGameStore.getState();
        for (const p of s.roster.presets) {
            expect(p.units, `${p.name} 의 슬롯 수가 다르다`).toHaveLength(LOADOUT_SIZE);
        }
        // 같은 동료가 두 칸을 차지하지 않는다 (setPresetSlot 과 같은 불변식)
        const filled = s.roster.presets[1].units.filter(Boolean);
        expect(new Set(filled).size).toBe(filled.length);
        expect(u2).toBeDefined();
        assertUsable(useGameStore);
    });

    it("activePreset 이 범위를 벗어나면 잘라 낸다", async () => {
        const { useGameStore } = await boot(
            envelopeWith({
                roster: { owned: {}, presets: [{ name: "기본", units: [] }], activePreset: 99 },
            })
        );
        const s = useGameStore.getState();
        expect(s.roster.activePreset).toBeLessThan(s.roster.presets.length);
        expect(s.roster.activePreset).toBeGreaterThanOrEqual(0);
        assertUsable(useGameStore);
    });

    it("별 기록이 음수 · 문자열이어도 별 트리 계산이 NaN 이 되지 않는다", async () => {
        const { useGameStore } = await boot(
            envelopeWith({
                meta: {
                    ...structuredClone(ENVELOPE.state.meta),
                    stageStars: { "1-1": -3, "1-2": "2", "1-3": "많이" },
                    difficultyStars: { hard: { "1-1": null } },
                    starTree: { 없는_노드: 5 },
                },
            })
        );
        const stars = useGameStore.getState().getStars();
        expect(Number.isFinite(stars.earned)).toBe(true);
        expect(Number.isFinite(stars.spent)).toBe(true);
        expect(stars.earned).toBe(2);
        assertUsable(useGameStore);
    });

    /**
     * ★★ **나이트메어 별은 새 키다 — 그런데 `SAVE_VERSION` 은 오르지 않았다** (2026-08-05).
     *
     *   `difficultyStars` 는 난이도 id 를 키로 하는 열린 표라, 나이트메어가 붙어도
     *   스키마가 바뀌지 않는다. 그래서 마이그레이션이 없고, **바로 그것이 위험하다**:
     *   마이그레이션이 없다는 말은 *아무도 이 조합을 밟아 보지 않는다*는 뜻이다.
     *
     *   두 방향을 다 본다 —
     *   ① **없어도** 뜬다 (나이트메어 이전 세이브가 절대다수다)
     *   ② **있어도** 별 계산·부팅·출격이 전부 성립한다
     *
     * ★ `"nightmare"` 를 손으로 적지 않는다. `RULE_DIFFICULTIES` 가 `balance.json`
     *   에서 파생하므로, 규칙 난이도의 이름이 바뀌면 이 표본이 따라온다.
     */
    it("★★ 나이트메어 별이 든 세이브도 · 없는 세이브도 그대로 뜬다", async () => {
        expect(RULE_DIFF, "규칙 난이도가 하나도 없다 — 표본이 헛돈다").toBeTruthy();

        const withNm = await boot(
            envelopeWith({
                meta: {
                    ...structuredClone(ENVELOPE.state.meta),
                    highestStage: MAX_STAGE_INDEX,
                    stageStars: { "1-1": 3 },
                    difficultyStars: { hard: { "1-1": 3 }, [RULE_DIFF]: { "1-1": 2 } },
                },
            })
        );
        const nmStars = withNm.useGameStore.getState().getStars();
        expect(Number.isFinite(nmStars.earned)).toBe(true);
        expect(nmStars.earned, "나이트메어 별이 합계에 들어오지 않는다").toBe(8);
        assertUsable(withNm.useGameStore);

        // ② 나이트메어 이전 세이브 — 키 자체가 없다
        const without = await boot(
            envelopeWith({
                meta: {
                    ...structuredClone(ENVELOPE.state.meta),
                    stageStars: { "1-1": 3 },
                    difficultyStars: { hard: { "1-1": 3 } },
                },
            })
        );
        expect(without.useGameStore.getState().getStars().earned).toBe(6);
        assertUsable(without.useGameStore);
    });

    it("알 수 없는 난이도가 선택돼 있으면 기본 난이도로 되돌린다", async () => {
        const { useGameStore } = await boot(
            envelopeWith({
                meta: { ...structuredClone(ENVELOPE.state.meta), selectedDifficulty: "지옥" },
            })
        );
        expect(useGameStore.getState().meta.selectedDifficulty).toBe(DEFAULT_DIFFICULTY);
        expect(useGameStore.getState().resolveDifficulty("1-1")).toBe(DEFAULT_DIFFICULTY);
    });
});

/* ═══════════════════════ 5. v1 → v13 전 구간 ═══════════════════════ */

/**
 * ★ `migrate.test.js` 는 **블록의 규칙**을 본다 (무엇을 채우고 무엇을 소급하지 않는가).
 *   여기서 보는 것은 다른 질문이다: **어느 버전에서 시작해도 앱이 뜨고 진행이 남는가.**
 *   중간 버전에서 시작한 세이브는 블록 일부만 만나므로, 그 조합이 실제로
 *   부팅까지 도달하는지는 블록 단위 테스트가 답하지 못한다.
 */
describe("v1 → 현재 버전 — 어느 버전에서 시작해도 도달한다", () => {
    it("검사할 버전 구간이 비어 있지 않다 — 루프가 0회면 이 블록 전체가 무의미하다", () => {
        expect(SAVE_VERSION).toBeGreaterThanOrEqual(15);
    });

    /** 그 시절에도 있었던 필드만 담은 구세이브 */
    const legacy = () => ({
        meta: {
            currencies: { gold: 5000 },
            highestStage: 45,
            stageStars: { "1-1": 3, "1-2": 2 },
        },
        roster: {
            owned: { [REAL_UNITS[0]]: { level: 20, rank: 2, shards: 1 } }, // 승급 필드는 v15 가 떨어낸다
            presets: [{ name: "기본", units: [REAL_UNITS[0], null, null, null, null, null] }],
            activePreset: 0,
        },
    });

    for (let from = 1; from <= SAVE_VERSION; from++) {
        it(`v${from} 세이브가 부팅되고 진행도가 남는다`, async () => {
            const { useGameStore } = await boot({ version: from, state: legacy() });
            expect(useGameStore.persist.hasHydrated()).toBe(true);
            assertUsable(useGameStore);
            const s = useGameStore.getState();
            expect(s.meta.currencies.gold).toBe(5000);
            expect(s.meta.highestStage).toBe(45);
            expect(s.roster.owned[REAL_UNITS[0]].level).toBe(20);
            // ★ v15 는 승급·장비 필드를 떨어낸다 — 레벨만 남는 것이 정상이다
            expect(s.roster.owned[REAL_UNITS[0]]).not.toHaveProperty("rank");
            expect(s.getStars().earned).toBe(5);

            /**
             * ★★ `from === SAVE_VERSION` 이면 **zustand 는 migrate 를 아예 부르지 않는다**
             *   (middleware.mjs: `version !== options.version` 일 때만 호출).
             *   확정 지급 소급도 그때는 돌지 않으므로, 최신 버전으로 저장된
             *   손상 세이브를 메워 주는 그물은 **normalize\* 하나뿐**이다.
             *   이 사실이 `saveVersion.test.js` 가 지키는 명제의 반대편이고,
             *   이 파일이 normalize\* 를 그렇게 집요하게 두들기는 이유다.
             */
            if (from < SAVE_VERSION) {
                // 소급: 45 스테이지까지의 확정 지급 동료가 들어와 있다
                expect(Object.keys(s.roster.owned).length).toBeGreaterThan(1);
            }
        });
    }

    /**
     * ★★★ **손상 × 구버전** — 이 파일에 오래 비어 있던 교집합이다.
     *
     *   위쪽 '손상된 세이브' 블록은 전부 `version = SAVE_VERSION` 으로 부팅하므로
     *   **migrate 를 아예 타지 않는다**(zustand 는 버전이 같으면 부르지 않는다).
     *   아래 마이그레이션 매트릭스는 `legacy()` 라는 **깨끗한** 상태만 올린다.
     *   그 사이에 아무 검사도 없었고, 정작 하이드레이션 경로에서 유일하게
     *   보호되지 않은 코드가 migrate 였다 — 거기서 던지면 `onRehydrateStorage` 의
     *   try/catch 보다 **앞**이라 `hasHydrated` 가 영원히 false 로 굳는다.
     *
     *   실측(고치기 전): 사라진 슬라이스의 손상된 배열에서 TypeError → **영구 빈 화면**.
     *   그 슬라이스들은 2026-08-04 경량화로 사라졌지만 **이 블록은 남긴다** —
     *   지키는 것은 특정 키가 아니라 "migrate 가 던져도 게이트는 열린다"는 성질이고,
     *   그 그물은 `store/index.js:safeMigrate` 다.
     */
    describe("★ 손상된 구버전 세이브 — migrate 가 던져도 게이트가 열린다", () => {
        const corrupt = [
            ["roster 가 배열이다", { roster: [] }],
            ["roster.owned 가 배열이다", { roster: { owned: [1, 2] } }],
            ["meta 가 null 이다", { meta: null }],
            ["meta.ark 가 문자열이다", { meta: { ark: "없음" } }],
            ["meta.starTree 가 숫자다", { meta: { starTree: 5 } }],
            ["settings 가 배열이다", { settings: [] }],
            ["사라진 슬라이스가 손상된 채 남아 있다", { trials: { claimed: {} }, daily: 7 }],
        ];

        for (const [label, patch] of corrupt) {
            // v12 미만이어야 `from < 12` 블록(스프레드가 던지던 자리)을 지난다
            it(`v11 + ${label} — 검은 화면이 되지 않는다`, async () => {
                const { useGameStore } = await boot({
                    version: 11,
                    state: { ...legacy(), ...patch },
                });
                expect(
                    useGameStore.persist.hasHydrated(),
                    "게이트가 닫혔다 — migrate 의 그물이 사라졌다 (store/index.js:safeMigrate)"
                ).toBe(true);
                assertUsable(useGameStore);
            });
        }

        it("v11 + 손상이어도 나머지 진행도는 살아남는다 (세이브를 통째로 버리지 않는다)", async () => {
            const { useGameStore } = await boot({
                version: 11,
                state: { ...legacy(), trials: { claimed: {} }, daily: 7 },
            });
            const s = useGameStore.getState();
            expect(s.meta.highestStage).toBe(45);
            expect(s.meta.currencies.gold).toBe(5000);
            // ★ 사라진 슬라이스는 세이브에서도 사라진다
            expect(s).not.toHaveProperty("trials");
        });

        it("파싱은 되지만 객체가 아닌 state — 기본값으로 살아난다", async () => {
            const { useGameStore } = await boot({ version: 3, state: "세이브가 아니다" });
            expect(useGameStore.persist.hasHydrated()).toBe(true);
            assertUsable(useGameStore);
        });
    });

    it("현재 버전 세이브는 확정 지급을 다시 굴리지 않는다 — 레벨이 1 로 돌아가지 않는다", async () => {
        const state = legacy();
        // 이미 소급을 받아 30레벨까지 키운 동료
        const granted = REAL_UNITS[1];
        state.roster.owned[granted] = {
            level: 30,
            rank: 4,
            shards: 0,
            ownedStep: 0,
            gear: {},
            gearPlus: {},
        };
        const { useGameStore } = await boot({ version: SAVE_VERSION, state });
        expect(useGameStore.getState().roster.owned[granted].level).toBe(30);
        // 한 버전 아래에서 올라온 계정도 마찬가지다 (덮어쓰지 않는다)
        const { useGameStore: older } = await boot({ version: SAVE_VERSION - 1, state });
        expect(older.getState().roster.owned[granted].level).toBe(30);
    });
});
