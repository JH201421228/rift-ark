/**
 * P8-06 — 디버그 잔재 검사의 검사
 *
 * ★★ **"고쳤다"가 아니라 "되돌리면 깨진다"를 만든다.**
 *   검사기가 통과한다는 사실만으로는 아무것도 증명되지 않는다 — 아무것도 검사하지 않는
 *   검사기도 통과한다. 그래서 여기서는 **일부러 위반을 만들어** 검사기가 그것을 잡는지
 *   확인한다. 손으로 한 번 깨뜨려 보는 것과 달리 이 확인은 매 `npm run test` 마다 반복된다.
 *
 * ★ 역할 분담을 분명히 한다.
 *   - **번들 대조**(트리셰이킹이 실제로 일어났는가)는 빌드가 있어야 하므로
 *     `npm run check:prod` 가 한다 (`vite build` 를 먼저 돌린다).
 *   - 여기서는 **검사기 자체**를 고정한다 — 위반을 넣으면 반드시 잡고,
 *     멀쩡한 코드에는 절대 발동하지 않는다. 거짓 경보 한 번이면 아무도 믿지 않는다.
 *   - `dist/` 가 소스와 같은 시점이면 실제 번들 대조도 여기서 한 번 더 돌린다.
 *
 * @see tools/check-production.mjs
 * @see docs/04-plan/33-execution-plan.md P8-06
 * @see docs/04-plan/32-definition-of-done.md §4
 */
import { describe, it, expect, beforeAll } from "vitest";
import { analyze, loadProject, lex, guardRange, devRegions } from "../tools/check-production.mjs";

/** 위반이 없는 최소 입력. 각 테스트는 여기서 **한 가지만** 어긋나게 만든다. */
const CLEAN_BUNDLE = () =>
    new Map([
        ["dist/index.html", "<!doctype html><div id=root></div>"],
        ["dist/assets/index-aaaa.js", 'console.warn("[x] 실패");'],
        ["dist/assets/index-aaaa.css", "._a_1abcd{color:red}"],
    ]);
const CLEAN_CAP = { android: { webContentsDebuggingEnabled: false } };
/** 광고를 켠 정상 상태. id 는 형식만 맞으면 되고 실제 값일 필요는 없다. */
const CLEAN_ADS = () => ({
    enabled: true,
    testMode: false,
    units: { android: "ca-app-pub-1234567890123456/1111111111", ios: "" },
});
const CLEAN_MANIFEST = (id = "ca-app-pub-1234567890123456~2222222222") =>
    `<manifest><application><meta-data\n` +
    `  android:name="com.google.android.gms.ads.APPLICATION_ID"\n` +
    `  android:value="${id}" />\n</application></manifest>`;

function run({
    sources = new Map(),
    bundle = CLEAN_BUNDLE(),
    capacitor = CLEAN_CAP,
    ads = CLEAN_ADS(),
    manifest = CLEAN_MANIFEST(),
    stale = [],
}) {
    return analyze({ sources, bundle, capacitor, ads, manifest, stale });
}
const joined = (r) => r.errors.join("\n");

/* ═════════════════ 렉서 — 나머지 전부가 여기에 얹힌다 ═════════════════ */

describe("렉서", () => {
    it("주석을 지우되 길이를 보존한다 (범위 판정이 오프셋에 의존한다)", () => {
        const src = 'const a = 1; /* 개발 전용 */ const b = "살아있음";';
        const { masked } = lex(src);
        expect(masked.length).toBe(src.length);
        expect(masked).not.toContain("개발 전용");
        expect(masked.indexOf("const b")).toBe(src.indexOf("const b"));
    });

    it("문자열 내용은 masked 에서 사라지지만 리터럴로는 남는다", () => {
        const { masked, literals } = lex('f("괄호 { 안 넣기");');
        expect(masked).not.toContain("괄호");
        expect(literals.map((l) => l.value)).toContain("괄호 { 안 넣기");
    });

    it("템플릿은 `${}` 로 끊긴 **정적 조각**으로 쪼갠다", () => {
        // ★ 조각을 이어붙이면 안 된다 — 번들에 그 모양으로 나타나지 않는다.
        const { literals } = lex("const s = `[perf] 첫 프레임: ${ms}ms (목표)`;");
        const vals = literals.map((l) => l.value);
        expect(vals).toContain("[perf] 첫 프레임: ");
        expect(vals).toContain("ms (목표)");
        expect(vals.join("|")).not.toContain("첫 프레임: ms");
    });

    it("정규식 안의 따옴표에 넘어가지 않는다", () => {
        const { literals } = lex(`const re = /["']/g; const t = "진짜 문자열";`);
        expect(literals.map((l) => l.value)).toContain("진짜 문자열");
    });
});

/* ═════════════════ 가드 범위 ═════════════════ */

describe("DEV 가드 범위", () => {
    const rangeOf = (src) => {
        const { masked } = lex(src);
        const m = /import\.meta\.env\??\.DEV\b/.exec(masked);
        const r = guardRange(masked, m.index, m.index + m[0].length);
        return r && masked.slice(r[0], r[1]);
    };

    it("if 블록 · 한 줄 if · JSX && · 삼항을 모두 잡는다", () => {
        expect(rangeOf("if (import.meta.env.DEV) { a(); }")).toBe("{ a(); }");
        expect(rangeOf("if (import.meta.env.DEV && x) { a(); }")).toBe("{ a(); }");
        expect(rangeOf("if (import.meta.env.DEV) a();")).toBe("a();");
        expect(rangeOf("x = import.meta.env.DEV && (<Dev />);")).toBe("(<Dev />)");
        expect(rangeOf("x = import.meta.env.DEV ? [A] : [];")).toBe("[A]");
    });

    it("삼항의 **거짓 가지**는 가드가 아니다", () => {
        // 실제 코드: `{import.meta.env.DEV ? "개발" : "배포"}` — "배포" 는 프로덕션 문구다
        const src = 'x = import.meta.env.DEV ? "개발" : "배포";';
        const { masked, literals } = lex(src);
        const m = /import\.meta\.env\.DEV\b/.exec(masked);
        const [s, e] = guardRange(masked, m.index, m.index + m[0].length);
        const at = (v) => literals.find((l) => l.value === v).start;
        expect(at("개발") >= s && at("개발") < e).toBe(true);
        expect(at("배포") >= s && at("배포") < e).toBe(false);
    });

    it("값으로 쓰인 DEV 는 가드가 아니다 (native/ads.js 모양)", () => {
        // ★ 여기서 억지로 범위를 잡으면 가드가 아닌 코드의 문자열이
        //   '개발 전용'으로 분류되어 검사기가 거짓말을 시작한다.
        expect(rangeOf("let p = make(import.meta.env?.DEV === true);")).toBeNull();
    });

    it("가드가 부르는 모듈 스코프 선언까지 전이적으로 따라간다", () => {
        const src = [
            'const MENU = { label: "개발자" };',
            "const on = import.meta.env.DEV;",
            "export default function S() { return on ? [MENU] : []; }",
        ].join("\n");
        const { masked, literals } = lex(src);
        const ranges = devRegions("src/screens/X.jsx", masked);
        const lit = literals.find((l) => l.value === "개발자");
        expect(ranges.some(([s, e]) => lit.start >= s && lit.start < e)).toBe(true);
    });

    it("가드 밖에서도 쓰이는 이름은 따라가지 않는다", () => {
        // ★ `devVisible ? [...SECTIONS, DEV_SECTION] : SECTIONS` 의 SECTIONS 를 삼켜
        //   멀쩡한 설정 탭 이름을 개발 전용으로 신고했던 실제 오검출이다.
        const src = [
            'const SECTIONS = [{ label: "접근성" }];',
            'const DEV_SECTION = { label: "계측기" };',
            "const on = import.meta.env.DEV;",
            "export default function S() { return on ? [...SECTIONS, DEV_SECTION] : SECTIONS; }",
        ].join("\n");
        const { masked, literals } = lex(src);
        const ranges = devRegions("src/screens/X.jsx", masked);
        const at = (v) => literals.find((l) => l.value === v).start;
        expect(ranges.some(([s, e]) => at("접근성") >= s && at("접근성") < e)).toBe(false);
        expect(ranges.some(([s, e]) => at("계측기") >= s && at("계측기") < e)).toBe(true);
    });
});

/* ═════════════════ 검사기가 실제로 발동한다 ═════════════════ */

describe("소스 규칙 — 일부러 깨뜨린 소스", () => {
    it("S1 가드 없는 console.log 를 잡는다", () => {
        const r = run({ sources: new Map([["src/a.js", 'console.log("안녕");']]) });
        expect(joined(r)).toMatch(/S1 src\/a\.js:1 .*console\.log/);
    });

    it("S1 가드 안의 console.log 는 잡지 않는다", () => {
        for (const src of [
            'if (import.meta.env.DEV) console.log("x");',
            'if (import.meta.env.DEV) {\n  console.log("x");\n}',
            // ★ 물음표를 빠뜨렸다가 analytics.js 의 정상 가드를 위반으로 잡았다
            'if (import.meta.env?.DEV) {\n  console.debug("x");\n}',
        ]) {
            expect(joined(run({ sources: new Map([["src/a.js", src]]) })), src).not.toMatch(/S1/);
        }
    });

    it("S1 console.warn · console.error 는 남겨도 된다 (실패 진단이다)", () => {
        const src = 'console.warn("실패");\nconsole.error("실패");';
        expect(joined(run({ sources: new Map([["src/a.js", src]]) }))).not.toMatch(/S1/);
    });

    it("S2 개발 전용 화면을 가드 없이 그리면 잡는다", () => {
        const sources = new Map([
            ["src/screens/DevPanelScreen.jsx", "export default function DevPanelScreen() {}"],
            ["src/router/index.jsx", "const r = [{ element: <DevPanelScreen /> }];"],
        ]);
        expect(joined(run({ sources }))).toMatch(/S2 src\/router\/index\.jsx.*DevPanelScreen/);
    });

    it("S2 가드 안에서 그리면 잡지 않는다", () => {
        const sources = new Map([
            ["src/screens/DevPanelScreen.jsx", "export default function DevPanelScreen() {}"],
            [
                "src/router/index.jsx",
                "const r = [...(import.meta.env.DEV ? [{ element: <DevPanelScreen /> }] : [])];",
            ],
        ]);
        expect(joined(run({ sources }))).not.toMatch(/S2/);
    });
});

describe("번들 규칙 — 일부러 깨뜨린 번들", () => {
    const DEV_SRC = new Map([
        [
            "src/a.js",
            'if (import.meta.env.DEV) {\n  globalThis.__peek = 1;\n  log("개발 전용 문구다");\n}',
        ],
    ]);

    it("B1 DEV 전용 문구가 번들에 있으면 잡는다", () => {
        const bundle = CLEAN_BUNDLE();
        bundle.set("dist/assets/index-aaaa.js", 'x("개발 전용 문구다")');
        expect(joined(run({ sources: DEV_SRC, bundle }))).toMatch(/B1 .*개발 전용 문구다/);
    });

    it("B1 번들에 없으면 잡지 않는다 (트리셰이킹된 정상 상태)", () => {
        expect(joined(run({ sources: DEV_SRC }))).not.toMatch(/B1/);
    });

    it("B1 프로덕션 코드에도 있는 문구는 마커로 쓰지 않는다", () => {
        // ★ 거짓 경보 방지. `riftark-analytics-`(대시보드) vs `riftark-analytics-queue`(싱크)
        //   처럼 **부분 문자열**로도 겹치면 뺀다.
        const sources = new Map([
            ...DEV_SRC,
            ["src/b.js", 'export const T = "개발 전용 문구다 — 그런데 프로덕션에도 있다";'],
        ]);
        const bundle = CLEAN_BUNDLE();
        bundle.set("dist/assets/index-aaaa.js", 'x("개발 전용 문구다")');
        expect(joined(run({ sources, bundle }))).not.toMatch(/B1/);
    });

    it("B2 DEV 전역 핸들이 번들에 있으면 잡는다", () => {
        const bundle = CLEAN_BUNDLE();
        bundle.set("dist/assets/index-aaaa.js", "globalThis.__peek=1;");
        expect(joined(run({ sources: DEV_SRC, bundle }))).toMatch(/B2 .*__peek/);
    });

    it("B3 개발 전용 CSS 모듈이 번들 CSS 에 있으면 잡는다", () => {
        const sources = new Map([
            [
                "src/screens/DevPanel.module.css",
                ".stepBar { color: red }\n.tdEmitter { color: blue }",
            ],
            ["src/screens/Other.module.css", ".title { color: red }"],
        ]);
        const bundle = CLEAN_BUNDLE();
        // ★ Vite 의 실제 산출 모양이다: `_이름_해시_줄번호` (실측 `_stepBarFill_niade_236`).
        //   뒤의 `_줄번호` 를 regex 에서 빼먹었다가 일부러 깨뜨린 빌드에서 B3 가 발동하지 않았다.
        bundle.set("dist/assets/index-aaaa.css", "._stepBar_1m9ih_12{}._tdEmitter_1m9ih_40{}");
        expect(joined(run({ sources, bundle }))).toMatch(/B3 .*_1m9ih/);

        const noLine = CLEAN_BUNDLE();
        noLine.set("dist/assets/index-aaaa.css", "._stepBar_1m9ih{}._tdEmitter_1m9ih{}");
        expect(joined(run({ sources, bundle: noLine }))).toMatch(/B3 .*_1m9ih/);
    });

    it("B3 이름 하나만 우연히 겹치는 것은 증거가 아니다", () => {
        // ★ 아틀라스 프레임 이름 `_stat_icon` 이 `.stat` 과 겹쳐 오검출됐던 자리다.
        const sources = new Map([["src/screens/DevPanel.module.css", ".stat { color: red }"]]);
        const bundle = CLEAN_BUNDLE();
        bundle.set("dist/assets/index-aaaa.js", 'frame("_stat_icon")');
        expect(joined(run({ sources, bundle }))).not.toMatch(/B3/);
    });

    it("B4 소스맵을 잡는다", () => {
        const withMap = CLEAN_BUNDLE();
        withMap.set("dist/assets/index-aaaa.js.map", "{}");
        expect(joined(run({ bundle: withMap }))).toMatch(/B4 .*\.map/);

        const withUrl = CLEAN_BUNDLE();
        withUrl.set("dist/assets/index-aaaa.js", "a=1;\n//# sourceMappingURL=index.js.map");
        expect(joined(run({ bundle: withUrl }))).toMatch(/B4 .*sourceMappingURL/);
    });

    it("B5 debugger 문을 잡는다", () => {
        const bundle = CLEAN_BUNDLE();
        bundle.set("dist/assets/index-aaaa.js", "function f(){debugger;return 1}");
        expect(joined(run({ bundle }))).toMatch(/B5 .*debugger/);
    });

    it("B6 빌드 기계의 절대 경로 · 이메일을 잡는다", () => {
        for (const leak of ["C:\\\\Users\\\\jinu\\\\proj", "/home/jinu/proj", "me@example.com"]) {
            const bundle = CLEAN_BUNDLE();
            bundle.set("dist/assets/index-aaaa.js", `x("${leak}")`);
            expect(joined(run({ bundle })), leak).toMatch(/B6/);
        }
    });

    it("B7 TODO · FIXME 가 번들에 있으면 잡는다", () => {
        const bundle = CLEAN_BUNDLE();
        bundle.set("dist/assets/index-aaaa.js", 'x("TODO: 보상 수치 확정")');
        expect(joined(run({ bundle }))).toMatch(/B7 .*TODO/);
    });

    it("C1 웹뷰 디버깅이 켜져 있으면 잡는다 (DoD §4)", () => {
        const r = run({ capacitor: { android: { webContentsDebuggingEnabled: true } } });
        expect(joined(r)).toMatch(/C1 .*webContentsDebuggingEnabled/);
        expect(joined(run({ capacitor: { android: {} } }))).toMatch(/C1/);
    });

    /* ── A1–A4 광고 배선 ──
     *
     * ★ 광고의 실패는 전부 조용하다 — 어댑터가 초기화 실패·동의 거부·오프라인·빈 id 를
     *   같은 결과로 다루기 때문에, **잘못된 설정도 정상과 같은 얼굴로 배포된다.**
     *   그래서 여기서는 "잡는다"뿐 아니라 **"정상은 안 잡는다"** 도 같이 못박는다.
     */
    it("A1 광고를 켜 놓고 units.android 가 비면 잡는다 (수익 0)", () => {
        const ads = CLEAN_ADS();
        ads.units.android = "";
        expect(joined(run({ ads }))).toMatch(/A1 .*units\.android 가 비어 있다/);
    });

    it("A1 광고가 꺼져 있으면 빈 id 를 잡지 않는다 (켜기 전의 정상 상태다)", () => {
        const ads = CLEAN_ADS();
        ads.enabled = false;
        ads.units.android = "";
        expect(joined(run({ ads }))).not.toMatch(/A1/);
    });

    it("A2 광고 단위 자리에 앱 id(`~`) 를 넣으면 잡는다", () => {
        const ads = CLEAN_ADS();
        ads.units.android = "ca-app-pub-1234567890123456~1111111111";
        expect(joined(run({ ads }))).toMatch(/A2 .*units\.android/);
    });

    it("A2 빈 ios 는 잡지 않는다 (Android 만 내는 상태다)", () => {
        expect(joined(run({}))).not.toMatch(/A2/);
    });

    it("A3 testMode 인 채로 배포하면 잡는다", () => {
        const ads = CLEAN_ADS();
        ads.testMode = true;
        expect(joined(run({ ads }))).toMatch(/A3 .*testMode/);
    });

    it("A4 매니페스트에 앱 id 자체가 없으면 잡는다 (앱이 부팅 즉시 죽는다)", () => {
        expect(joined(run({ manifest: "<manifest><application/></manifest>" }))).toMatch(
            /A4 .*APPLICATION_ID meta-data 가 없다/
        );
    });

    it("A4 매니페스트에 광고 단위 id(`/`) 를 넣으면 잡는다", () => {
        const bad = CLEAN_MANIFEST("ca-app-pub-1234567890123456/3333333333");
        expect(joined(run({ manifest: bad }))).toMatch(/A4 .*앱 id 형식이 아니다/);
    });

    it("A4 광고를 켠 채 구글 테스트 앱 id 가 남으면 잡는다", () => {
        const bad = CLEAN_MANIFEST("ca-app-pub-3940256099942544~3347511713");
        expect(joined(run({ manifest: bad }))).toMatch(/A4 .*테스트 앱 id/);
    });

    it("A4 광고가 꺼져 있으면 테스트 앱 id 를 잡지 않는다", () => {
        // 플러그인이 설치돼 있으면 매니페스트에는 **무엇이든** 있어야 하고,
        // 켜기 전이라면 테스트 값이 정상이다.
        const ads = CLEAN_ADS();
        ads.enabled = false;
        const m = CLEAN_MANIFEST("ca-app-pub-3940256099942544~3347511713");
        expect(joined(run({ ads, manifest: m }))).not.toMatch(/A4/);
    });

    it("정상 배선은 A 규칙을 하나도 발동시키지 않는다", () => {
        expect(joined(run({}))).not.toMatch(/A[1-4]/);
    });

    it("D1 번들이 없거나 낡으면 통과시키지 않는다", () => {
        // ★ 빌드하지 않고 통과한 검사는 아무것도 보증하지 않는다.
        expect(joined(run({ bundle: new Map() }))).toMatch(/D1 .*번들 JS 가 없다/);
        expect(joined(run({ stale: ["src/a.js"] }))).toMatch(/D1 src\/a\.js/);
    });

    it("마커를 하나도 못 뽑으면 조용히 통과하지 않는다", () => {
        // 렉서가 깨져 DEV 영역을 못 찾는 상태의 '통과'가 가장 나쁜 실패다.
        expect(
            run({ sources: new Map([["src/a.js", "export const a = 1;"]]) }).warnings.join()
        ).toMatch(/마커를 하나도 뽑지 못했다|DEV 전용 문구를 하나도 뽑지 못했다/);
    });
});

/* ═════════════════ 실제 저장소 ═════════════════ */

describe("실제 저장소", () => {
    let project;
    let result;
    /**
     * ★ 훅 시간 제한을 넉넉히 준다 (2026-08-05).
     *   `loadProject()` 는 `src/` 전체와 `dist/` 번들 2MB 를 읽는다. 파일 수가 늘면서
     *   **전체 병렬 실행에서만** 기본 10초를 넘겨 실패했다 — 단독 실행은 2초였다.
     *   느려진 것이 아니라 다른 파일들과 CPU 를 나눠 쓰는 것이므로, 여기서
     *   기다려 주는 것이 맞다. 이 훅이 재는 것은 속도가 아니라 **내용**이다.
     */
    beforeAll(async () => {
        project = await loadProject();
        result = analyze({ ...project, stale: [] });
    }, 60_000);

    it("소스 규칙(S1·S2)을 위반하지 않는다", () => {
        expect(result.errors.filter((e) => /^S\d/.test(e))).toEqual([]);
    });

    it("웹뷰 디버깅이 꺼져 있다 (DoD §4)", () => {
        expect(project.capacitor?.android?.webContentsDebuggingEnabled).toBe(false);
    });

    it("대조할 마커가 실제로 있다 — 선례가 된 자리를 이름으로 고정한다", () => {
        /**
         * ★ 이 마커가 집합에서 사라지면, 그것은 가드가 없어졌거나 검사기가 그 자리를
         *   더 이상 보지 않는다는 뜻이다. 둘 다 조용한 실패다.
         * ★ `/dev/analytics`(계측 대시보드)는 2026-08-04 경량화로 사라졌다.
         *
         * ★★★ **마커가 한국어 문구에서 i18n 키로 바뀌었다** (2026-08-07).
         *
         *   예전 값은 `"전체 지급 (개발용)"` 이었다. 이중 언어화로 그 문구가
         *   `messages/companions.json` 으로 옮겨 갔고, 화면에는 `t("companions.grantAllDev")`
         *   만 남았다. 그런데 **카탈로그 JSON 은 프로덕션 번들에 통째로 들어간다** —
         *   즉 예전 방식대로 "한국어 문구가 번들에 없는가"를 물으면 이제 **언제나
         *   실패**한다. 검사기가 재려던 것(개발 전용 UI 가 배포에 남았는가)과
         *   무관한 이유로.
         *
         *   그래서 대조 대상은 **DEV 영역 안의 i18n 키**다. 키는 그 자리에만 있고
         *   언어와 무관하다 — 이 저장소가 UI 를 영어로 바꿔도 검사가 그대로 산다.
         *   (인벤토리가 예고한 "`check-production` 이 한글을 마커로 쓰므로 영어화하면
         *   거짓 통과한다" 가 정확히 이 자리였다. 지금은 거짓 통과가 아니라 **명시적
         *   실패**로 드러났고, 그래서 고칠 수 있었다.)
         */
        expect(result.markers).toContain("companions.grantAllDev"); // 동료 전량 지급 버튼
        expect(result.markers).toContain("settings.sectionDev"); // 설정의 개발자 절
        expect(result.markers.length).toBeGreaterThan(8);
        expect(result.devGlobals).toContain("__store");

        /**
         * ★★ **마커가 한국어에만 의존하지 않는다**는 것을 여기서 못박는다.
         *   언어를 하나 더 늘리거나 UI 를 영어로 돌려도 이 검사가 살아 있어야 한다.
         */
        const asciiMarkers = result.markers.filter((m) => !/[가-힣]/.test(m));
        expect(
            asciiMarkers.length,
            "마커가 전부 한글이면 UI 를 영어로 바꾸는 순간 이 검사는 조용히 무력해진다"
        ).toBeGreaterThan(4);
    });

    /**
     * ★ 시간 제한을 넉넉히 준다 (2026-08-05) — `beforeAll` 과 같은 이유다.
     *   이 테스트는 `loadProject()` 로 `src/` 전체와 `dist/` 번들 2MB 를 **한 번 더**
     *   읽는다. 파일 수가 늘면서 전체 병렬 실행에서만 기본 5초를 넘겼다
     *   (단독 실행은 2초). 재는 것은 속도가 아니라 **번들의 내용**이므로 기다린다.
     */
    it.skipIf(process.env.CI)(
        "dist 가 최신이면 번들에 잔재가 없다",
        async () => {
            const fresh = await loadProject();
            if (fresh.stale.length || !fresh.bundle.size) return; // 빌드가 낡았다 — check:prod 가 답한다
            expect(analyze(fresh).errors).toEqual([]);
        },
        60_000
    );
});
