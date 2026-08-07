/**
 * `SAVE_VERSION` 과 마이그레이션 블록의 정합성.
 *
 * ★ 이 파일이 있는 이유는 실제로 난 사고 때문이다.
 *   여러 에이전트가 **병렬로** 기능을 붙이면서 각자 `migrate.js` 에 블록을 쌓았는데,
 *   `src/store/index.js` 의 `SAVE_VERSION` 은 9 에 멈춰 있었다.
 *   블록은 `from < 10` · `from < 11` 까지 있는데 버전이 9 였으므로,
 *   **zustand 는 저장된 버전(9)과 현재 버전(9)이 같아 `migrate` 를 아예 부르지 않는다.**
 *   정성껏 쓴 마이그레이션이 조용히 죽은 코드가 된다.
 *
 *   증상이 즉시 드러나지도 않는다 — `onRehydrateStorage` 의 정규화가 빈 필드를
 *   메워 주기 때문에 겉보기엔 멀쩡하다. 그래서 더 위험하다:
 *   정규화가 못 메우는 필드(소급 판단이 필요한 것)만 조용히 빠진 채로 남는다.
 *
 * ★ 사람의 규율로는 막히지 않는다. 블록을 추가하는 사람과 상수를 올리는 사람이
 *   다른 파일을 보고 있기 때문이다. 그래서 테스트가 잡는다.
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { SAVE_VERSION, HYDRATION_STEPS, runHydrationSteps } from "./index.js";

/**
 * `migrate.js` 에서 `from < N` 패턴을 전부 긁는다.
 *
 * ★ 소스를 문자열로 읽는다. 함수를 실행해서 알아내려면 "몇 번까지 있는가"를
 *   결국 다시 가정해야 하고, 그 가정이 틀리면 검사 자체가 무의미해진다.
 */
function migrationTargets() {
    const src = readFileSync(new URL("./migrate.js", import.meta.url), "utf8");
    const out = [];
    for (const m of src.matchAll(/from\s*<\s*(\d+)/g)) out.push(Number(m[1]));
    return out.sort((a, b) => a - b);
}

describe("SAVE_VERSION 과 마이그레이션 정합성", () => {
    const targets = migrationTargets();

    it("마이그레이션 블록이 최소 하나는 있다 — 정규식이 조용히 빗나가면 이 검사 전체가 무의미하다", () => {
        expect(targets.length).toBeGreaterThan(0);
    });

    it("SAVE_VERSION 이 가장 높은 마이그레이션 대상 이상이다", () => {
        const highest = Math.max(...targets);
        expect(
            SAVE_VERSION,
            `migrate.js 에 from < ${highest} 블록이 있는데 SAVE_VERSION 은 ${SAVE_VERSION} 이다. ` +
                `버전을 올리지 않으면 zustand 가 migrate 를 부르지 않아 그 블록이 실행되지 않는다.`
        ).toBeGreaterThanOrEqual(highest);
    });

    it("마이그레이션 대상에 빈 구간이 없다 — v1 세이브가 순차로 올라와야 한다", () => {
        // from < 2, 3, 4 ... 처럼 연속이어야 한다. 중간이 비면 그 버전으로 저장된
        // 세이브가 어떤 블록도 만나지 못한 채 현재 스키마로 취급된다.
        const uniq = [...new Set(targets)];
        for (let i = 1; i < uniq.length; i++) {
            expect(
                uniq[i] - uniq[i - 1],
                `마이그레이션 대상이 ${uniq[i - 1]} 다음 ${uniq[i]} 로 건너뛴다`
            ).toBe(1);
        }
    });

    /**
     * ★ v15(2026-08-04 경량화)가 v1–v14 블록을 하나로 접었다. 그래서 남은 대상은
     *   15 하나이고, 그것은 "어떤 옛 버전에서 와도 같은 정규화를 거친다"는 뜻이다.
     */
    it("마이그레이션 대상이 SAVE_VERSION 을 넘지 않는다", () => {
        expect(Math.max(...targets)).toBeLessThanOrEqual(SAVE_VERSION);
    });
});

/**
 * ★★ **마이그레이션이 채운 키가 `partialize` 에 없으면 저장되지 않는다.**
 *
 *   이것은 마이그레이션 누락보다 증상이 더 조용하다: 앱은 정상 동작하고,
 *   화면도 멀쩡하고, 그날의 플레이도 그대로다. 다만 **앱을 껐다 켤 때마다** 그 키가
 *   초기값으로 되살아난다 — 진행도든 튜토리얼이든, 아무도 즉시 알아채지 못한다.
 *
 *   그래서 손목록이 아니라 **소스를 읽어** 대조한다.
 */
describe("세이브 키가 실제로 저장되는가", () => {
    const src = readFileSync(new URL("./index.js", import.meta.url), "utf8");
    /**
     * ★★ **목록을 손으로 적지 않는다.** 예전에는 여기에 10개짜리 표가 손으로
     *   적혀 있었고 `partialize` 는 11개를 저장하고 있었다 — 빠진 것은 천장 카운터가
     *   사는 키였다. 손목록은 반드시 소스보다 낡는다.
     *
     * ★ 2026-08-04부터 목록은 `SAVED_KEYS` 하나다. `partialize` 도 슬롯 초기화
     *   (`resetToPristine`)도 그것을 읽는다 — 둘이 갈라졌을 때 무슨 일이 나는지는
     *   `store/index.js:SAVED_KEYS` 주석에 적혀 있다 (전투가 통째로 빈 화면이 됐다).
     */
    const savedKeys = (/export const SAVED_KEYS = \[([^\]]*)\]/.exec(src)?.[1] ?? "")
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);

    it("SAVED_KEYS 를 실제로 찾았다 — 정규식이 빗나가면 이 검사가 무의미하다", () => {
        expect(savedKeys.slice().sort()).toEqual(["meta", "roster", "settings"]);
    });

    it("★★ partialize 와 슬롯 초기화가 **같은 목록**을 읽는다 (사본 금지)", () => {
        // ★ 주석을 지우고 본다 — 이 규칙의 **설명**에 옛 코드가 인용돼 있어서,
        //   주석을 포함해 검사하면 문서가 자기 테스트를 깨뜨린다 (실제로 깨졌다).
        const code = src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
        expect(
            code,
            "partialize 가 키를 다시 손으로 적으면 SAVED_KEYS 와 갈라진다"
        ).toMatch(/partialize:\s*\(s\)\s*=>\s*Object\.fromEntries\(SAVED_KEYS/);
        expect(
            code,
            "resetToPristine 이 상태를 통째로 되돌리면 ui.assetsReady 같은 " +
                "세션 플래그까지 꺼진다 — 슬롯을 고른 뒤 모든 전투가 빈 화면이 됐다"
        ).toMatch(/function resetToPristine\(\)[\s\S]{0,200}SAVED_KEYS/);
        expect(code, "replace(true) 로 통째 교체하면 그 회귀가 그대로 돌아온다").not.toMatch(
            /setState\(PRISTINE,\s*true\)/
        );
    });

    /**
     * 최상위 세이브 키 → 그 키를 정규화하는 액션.
     * ★ 규약은 `xxx` → `normalizeXxx` 다. 1:1 이 아닌 예외가 생기면 여기 적는다 —
     *   적지 않으면 "정규화가 없다"와 "이름이 다르다"를 구분할 수 없다.
     */
    const normalizerFor = (key) => `normalize${key[0].toUpperCase()}${key.slice(1)}`;

    for (const key of savedKeys) {
        it(`'${key}' 에 하이드레이션 정규화가 걸려 있다 (이중 안전망)`, () => {
            const normalizer = normalizerFor(key);
            expect(
                HYDRATION_STEPS,
                `'${key}' 를 정규화하는 ${normalizer} 가 HYDRATION_STEPS 에 없다 — ` +
                    `저장은 되는데 손상값을 걸러 주는 그물이 없다`
            ).toContain(normalizer);
        });
    }
});

/**
 * ★★ **정규화 하나가 던져도 나머지가 전부 돈다.**
 *
 *   예전에는 열한 번의 호출이 `try` 블록 하나 안에 나열되어 있었다. 그 모양에서
 *   첫 번째가 던지면 나머지는 실행되지 않고, catch 의 문구("남은 필드는 기본값으로
 *   갑니다")와 달리 **남은 슬라이스는 디스크의 손상값을 그대로 들고 간다.**
 *   실측: `normalizeMeta` 만 던지게 하면 편성의 유령 id 가 살아남아
 *   `buildStageConfig` 가 던지고 — 어떤 전투도 시작되지 않는다.
 *
 *   되돌리면(단일 try 로 되돌리면) 이 블록이 빨개진다.
 */
describe("하이드레이션 정리 단계의 격리", () => {
    /** 각 단계를 세는 가짜 상태 — `boom` 에 적힌 단계만 던진다 */
    const fakeState = (boom = []) => {
        const calls = [];
        const state = {};
        for (const name of HYDRATION_STEPS) {
            state[name] = () => {
                calls.push(name);
                if (boom.includes(name)) throw new Error(`${name} 폭발`);
            };
        }
        return { state, calls };
    };

    it("아무도 안 던지면 전 단계가 순서대로 돈다", () => {
        const { state, calls } = fakeState();
        expect(runHydrationSteps(state)).toEqual([]);
        expect(calls).toEqual(HYDRATION_STEPS);
    });

    it("첫 단계가 던져도 나머지 전부가 돈다", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const { state, calls } = fakeState([HYDRATION_STEPS[0]]);
        expect(runHydrationSteps(state)).toEqual([HYDRATION_STEPS[0]]);
        expect(calls, "실패 뒤 단계가 건너뛰어졌다 — try 블록이 하나로 합쳐졌다").toEqual(
            HYDRATION_STEPS
        );
        warn.mockRestore();
    });

    it("여러 단계가 던져도 밖으로 새지 않는다 — 하이드레이션 게이트를 막으면 검은 화면이다", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        // ★ 인덱스를 박지 않는다 — 단계 수가 줄면(실제로 4 → 3 이 됐다)
        //   `HYDRATION_STEPS[3]` 이 undefined 가 되어 이 검사가 거짓말을 한다.
        const boom = [HYDRATION_STEPS[1], HYDRATION_STEPS[HYDRATION_STEPS.length - 1]];
        const { state, calls } = fakeState(boom);
        expect(() => runHydrationSteps(state)).not.toThrow();
        expect(runHydrationSteps(state)).toEqual(boom);
        expect(calls.length).toBe(HYDRATION_STEPS.length * 2);
        warn.mockRestore();
    });

    it("상태가 없거나 액션이 빠져 있어도 던지지 않는다 (create 전에도 불릴 수 있다)", () => {
        expect(() => runHydrationSteps(undefined)).not.toThrow();
        expect(() => runHydrationSteps({})).not.toThrow();
    });
});
