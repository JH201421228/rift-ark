/**
 * P8-01 — 전 화면 도달 경로 검사의 검사
 *
 * ★★ **"고쳤다"가 아니라 "되돌리면 깨진다"를 만든다.**
 *   검사기가 통과한다는 사실만으로는 아무것도 증명되지 않는다 — 아무것도
 *   검사하지 않는 검사기도 통과한다. 그래서 여기서는 **실제 저장소 소스를 읽어
 *   일부러 위반을 만들고**, 검사기가 그 위반을 잡는지 확인한다.
 *   손으로 한 번 깨뜨려 보는 것과 달리 이 확인은 매 `npm run test` 마다 반복된다.
 *
 * ★ 픽스처를 손으로 쓰지 않는다. 진짜 라우터·진짜 화면을 읽어 한 군데만 바꾼다.
 *   가짜 픽스처는 실제 파일 모양이 바뀌면 조용히 무의미해진다.
 *
 * @see tools/check-reachability.mjs
 * @see docs/04-plan/33-execution-plan.md P8-01
 */
import { describe, it, expect, beforeAll } from "vitest";
import {
    analyze,
    loadProject,
    matchRoute,
    collectNavTargets,
    ROUTER_FILE,
    SCREEN_INDEX,
    START_ROUTE,
} from "../../tools/check-reachability.mjs";

let project;

/** 라우터의 캐치올 바로 앞에 라우트를 하나 끼워 넣는다 (실제 표기 그대로). */
const CATCHALL = '{ path: "*", element: <Navigate to="/" replace /> },';
const insertRoute = (src, path, element) =>
    src.replace(CATCHALL, `{ path: "${path}", element: <${element} /> },\n            ${CATCHALL}`);

/** 라우터 상단에 지연 로딩 선언을 하나 더 붙인다 (실제 표기 그대로). */
const declareLazy = (src, name, spec) =>
    src.replace(
        'const router = createHashRouter([',
        `const ${name} = lazy(() => import("${spec}"));\n\nconst router = createHashRouter([`
    );

/** 원본 소스를 복제한 뒤 파일 하나만 바꿔서 검사기를 돌린다. */
function withEdit(file, edit, opts = {}) {
    const sources = new Map(project.sources);
    const before = sources.get(file);
    expect(before, `${file} 이 없다`).toBeTruthy();
    const after = edit(before);
    expect(after, `${file} 을 실제로 바꾸지 못했다 — 검사가 아무것도 증명하지 않는다`).not.toBe(
        before
    );
    sources.set(file, after);
    return analyze(sources, { ...project, ...opts });
}

beforeAll(async () => {
    project = await loadProject();
});

describe("도달 경로 — 현재 저장소", () => {
    it("모든 라우트가 시작점에서 도달 가능하다", () => {
        const r = analyze(project.sources, project);
        expect(r.errors).toEqual([]);
    });

    it("경고도 없다 (해금 상수·술어를 전부 실제 모듈에서 읽었다)", () => {
        expect(analyze(project.sources, project).warnings).toEqual([]);
    });

    it("라우트마다 진입점이 최소 1개 있다", () => {
        const r = analyze(project.sources, project);
        for (const [routePath, sites] of r.entries) {
            /**
             * ★ **시작 라우트는 예외다** (2026-08-04). `/` 는 앱을 켜면 나오는
             *   화면이므로 그리로 가는 링크가 없는 것이 정상이다 — 타이틀 화면을
             *   `/` 에 두면서 이 단언이 처음으로 걸렸다. 검사기 본체는 이미
             *   `START_ROUTE` 에서 BFS 를 시작하므로 여기만 맞추면 된다.
             */
            if (routePath === START_ROUTE) continue;
            expect(sites.length, `${routePath} 에 진입점이 없다`).toBeGreaterThan(0);
        }
    });

    /**
     * ★ 2026-08-04 경량화로 **조건부 진입 화면이 하나도 남지 않았다** (던전 · 탑 ·
     *   시험 카드가 사라졌다). 그래서 이 단언은 "비어 있어도 좋다, 다만 있는 것은
     *   전부 달성 가능해야 한다"로 바뀐다 — 검사기 자체가 살아 있다는 증거는
     *   아래 R5c/R5d 합성 케이스가 든다.
     */
    it("해금 술어가 있다면 달성 가능한 진행도에서 참이 된다", () => {
        for (const n of Object.values(project.unlockPredicates)) expect(n).not.toBeNull();
    });
});

describe("검사기가 실제로 발동한다 — 일부러 깨뜨린 소스", () => {
    it("R1 아무도 그리지 않는 화면 파일을 잡는다", () => {
        const sources = new Map(project.sources);
        sources.set("src/screens/GhostScreen.jsx", "export default function GhostScreen() {}\n");
        const r = analyze(sources, project);
        expect(r.errors.join("\n")).toMatch(/R1 .*GhostScreen/);
    });

    it("R2 파일로 해석되지 않는 element 를 잡는다", () => {
        // 라우트는 있는데 그 element 를 lazy 로도 import 로도 선언하지 않은 경우.
        const r = withEdit(ROUTER_FILE, (s) => insertRoute(s, "/ghost", "GhostScreen"));
        expect(r.errors.join("\n")).toMatch(/R2 \/ghost/);
    });

    it("R2 지연 로딩 지정자가 실재하지 않는 모듈을 가리키면 잡는다", () => {
        const r = withEdit(ROUTER_FILE, (s) =>
            insertRoute(declareLazy(s, "GhostScreen", "@/screens/GhostScreen"), "/ghost", "GhostScreen")
        );
        expect(r.errors.join("\n")).toMatch(/R2 \/ghost/);
    });

    /**
     * ★★ 배럴을 동적 import 하면 한 화면만 열어도 재수출된 화면 전부가 딸려 온다 —
     *   코드 분할이 **이름만 남는다** (P9-05 가 잰 620 → 567 kB gzip 을 통째로 잃는다).
     *   증상이 화면에 전혀 나타나지 않아 사람 눈으로는 영원히 안 보인다.
     */
    it("R2 배럴을 지연 로딩하면 잡는다 — 코드 분할이 이름만 남는다", () => {
        const sources = new Map(project.sources);
        sources.set(SCREEN_INDEX, 'export { default as GhostScreen } from "./ArkScreen";\n');
        sources.set(
            ROUTER_FILE,
            declareLazy(project.sources.get(ROUTER_FILE), "GhostScreen", "@/screens")
        );
        expect(analyze(sources, project).errors.join("\n")).toMatch(/배럴/);
    });

    /**
     * ★★★ **표기를 벗어난 선언은 *그 라우트*를 R2 로 만든다 — 옆 라우트가 아니라.**
     *
     *   `LAZY_BINDING_RE` 의 틈이 `[\s\S]{0,120}?` 였을 때, 모양을 벗어난 선언은
     *   **다음 줄의 lazy 선언을 자기 것으로 삼켰다.** 실측 출력이 이랬다:
     *     ✗ R2 /stages 의 element <StagesScreen> 를 파일로 해석할 수 없다
     *     ✗ R1 src/screens/ArkScreen.jsx 은 어떤 라우트의 렌더 집합에도 없다
     *   깨진 것은 `/` 인데 무고한 `/stages` 를 지목했고, 무엇보다 **BFS 시작점 `/` 의
     *   렌더 집합이 조용히 StagesScreen 으로 계산됐다** — 모든 도달성이 그 위에 선다.
     *   실패는 나므로 false-green 은 아니지만, 줄 번호가 틀린 검사기는 곧 무시된다.
     */
    it("★ 표기를 벗어난 lazy 선언은 그 라우트를 R2 로 만든다 (옆 라우트를 지목하지 않는다)", () => {
        const r = withEdit(ROUTER_FILE, (s) =>
            s.replace(
                'const ArkScreen = lazy(() => import("@/screens/ArkScreen"));',
                'const ArkScreen = lazy(function () { return import("@/screens/ArkScreen"); });'
            )
        );
        const joined = r.errors.join("\n");
        expect(joined, "깨진 라우트('/ark')를 지목하지 않는다").toMatch(/R2 \/ark 의 element <ArkScreen>/);
        expect(joined, "무고한 /stages 를 지목했다 — 틈이 선언 경계를 넘었다").not.toMatch(
            /R2 \/stages/
        );
        expect(joined, "StagesScreen 이 ArkScreen 의 바인딩에 삼켜졌다").not.toMatch(
            /R1 src\/screens\/StagesScreen\.jsx/
        );
    });

    it("R3 오타 난 이동 지시를 잡는다 (캐치올이 조용히 삼키는 결함)", () => {
        const r = withEdit("src/screens/StagePreview.jsx", (s) =>
            s.replace('to="/loadout"', 'to="/loadouts"')
        );
        expect(r.errors.join("\n")).toMatch(/R3 .*"\/loadouts"/);
    });

    it("R4 탭바에서 항목 하나를 지우면 그 화면이 도달 불가가 된다", () => {
        // ★ 이것이 이 저장소가 반복해서 겪은 결함의 모양이다 —
        //   "문법은 완전한데 목록에 항목 하나가 빠진" 상태.
        const r = withEdit("src/components/TabBar.jsx", (s) =>
            s.replace(/\{ to: "\/settings".*\n/, "")
        );
        // ★ 대상은 **탭바가 유일한 진입점**인 화면이어야 한다. 방주 대시보드가
        //   출격·편성·동료로 가는 바로가기를 갖게 되면서(2026-08-04) 그 셋은
        //   탭을 지워도 여전히 도달 가능하다 — 검사가 아무것도 증명하지 못한다.
        expect(r.errors.join("\n")).toMatch(/R4 \/settings/);
    });

    it("R4 라우트만 만들고 링크를 만들지 않으면 잡는다", () => {
        // ★★ 병렬 개발이 실제로 만드는 결함의 모양이다 — 화면과 라우트는 한 티켓이
        //   만들고, 그리로 가는 버튼은 다른 티켓의 파일에 있다. 하나가 빠져도
        //   문법은 완전하므로 lint·타입·빌드가 전부 침묵한다.
        const withScreen = new Map(project.sources);
        withScreen.set(
            "src/screens/GhostScreen.jsx",
            "export default function GhostScreen() { return null; }\n"
        );
        withScreen.set(
            ROUTER_FILE,
            insertRoute(
                declareLazy(
                    project.sources.get(ROUTER_FILE),
                    "GhostScreen",
                    "@/screens/GhostScreen"
                ),
                "/ghost",
                "GhostScreen"
            )
        );
        const r = analyze(withScreen, project);
        expect(r.errors.join("\n")).toMatch(/R4 \/ghost 로 가는 링크/);
    });

    /**
     * ★★ 지연 로딩이 **배럴을 거치면** 한 화면만 열어도 전 화면이 딸려 온다 —
     *   그러면 코드 분할이 이름만 남는다 (P9-05 가 620 → 567 kB gzip 을 잃는다).
     *   그리고 검사기 입장에서는 **모든 라우트의 렌더 집합이 같아져** 진입점
     *   그래프가 통째로 무의미해진다. 그러므로 지정자는 개별 모듈이어야 한다.
     */
    it("라우트마다 렌더 집합이 실제로 잡힌다 — 지연 로딩 선언을 읽지 못하면 여기가 빈다", () => {
        const r = analyze(project.sources, project);
        const real = r.routes.filter((x) => x.path !== "*");
        expect(real.length).toBeGreaterThan(0);
        for (const route of real) {
            expect(
                r.routeFiles.get(route.path)?.size,
                `${route.path} 의 렌더 집합이 비었다`
            ).toBeGreaterThan(0);
        }
        // 화면마다 서로 다른 파일 집합이어야 한다 — 배럴을 통째로 물면 전부 같아진다
        const sizes = real.map((x) => r.routeFiles.get(x.path).size);
        expect(new Set(sizes).size).toBeGreaterThan(1);
    });

    /**
     * ★★ **R5a·R5b 는 합성 소스로 검사한다** (2026-08-04).
     *   경량화로 조건부 진입 카드가 저장소에서 사라졌기 때문이다. 실제 파일을
     *   깨뜨릴 대상이 없다고 해서 검사를 지우면, 다음에 조건부 진입점을 만드는
     *   사람이 아무 그물 없이 만들게 된다 — 그때가 정확히 이 규칙이 필요한 시점이다.
     *
     * ★ 대상은 **진입점 파일**이어야 한다 (R5 는 `entryFiles` 만 훑는다).
     *   지금 저장소에서 라우트로 가는 링크를 실제로 그리는 화면 파일이 여기다.
     */
    const ENTRY_FILE = "src/screens/StagePreview.jsx";
    const withGatedEntry = (body) => {
        const src = new Map(project.sources);
        src.set(
            "src/screens/StagesScreen.jsx",
            src.get("src/screens/StagesScreen.jsx").replace(
                "export default function StagesScreen() {",
                `function GatedEntry({ highestStage }) {\n${body}\n}\n\nexport default function StagesScreen() {`
            )
        );
        return analyze(src, project);
    };

    it("R5a 진입점이 해금 수치를 직접 적으면 잡는다", () => {
        const r = withGatedEntry('    return highestStage >= 25 ? <Link to="/loadout" /> : null;');
        expect(r.errors.join("\n")).toMatch(/R5a .*StagesScreen/);
    });

    it("R5b 영원히 거짓인 진입 조건을 잡는다", () => {
        const r = withGatedEntry('    const item = { to: "/loadout", unlocked: false };\n    return item;');
        expect(r.errors.join("\n")).toMatch(/R5b .*StagesScreen/);
    });

    /**
     * ★★ R5c·R5d 도 합성 소스다. 경량화 후 저장소에는 규칙 모듈의 해금 상수·술어를
     *   import 하는 **진입점 파일이 하나도 없다.** 검사기가 그것을 읽는 경로 자체는
     *   살아 있어야 하므로, import 를 붙인 진입점을 만들어 확인한다.
     */
    const withUnlockImport = (names) => {
        const src = new Map(project.sources);
        src.set(
            "src/screens/StagesScreen.jsx",
            `import { ${names} } from "@/game/logic/stageUnlock";
` +
                src.get("src/screens/StagesScreen.jsx") +
                // ★ R5 는 **진입점 파일만** 훑는다. 링크가 없으면 이 파일은 검사 대상이
                //   아니고, 그러면 이 테스트는 아무것도 증명하지 못한다.
                `
function GhostEntry() { return <Link to="/loadout" />; }
`
        );
        return src;
    };

    it("R5c 달성 불가능한 해금 상수를 잡는다", () => {
        const key = "src/game/logic/stageUnlock.js:GHOST_UNLOCK_STAGE";
        const r = analyze(withUnlockImport("GHOST_UNLOCK_STAGE"), {
            ...project,
            unlockValues: { ...project.unlockValues, [key]: project.maxStage + 1 },
        });
        expect(r.errors.join("\n")).toMatch(/R5c .*GHOST_UNLOCK_STAGE/);
    });

    it("R5d 어떤 진행도에서도 참이 되지 않는 해금 술어를 잡는다", () => {
        const key = "src/game/logic/stageUnlock.js:isGhostUnlocked";
        const r = analyze(withUnlockImport("isGhostUnlocked"), {
            ...project,
            unlockPredicates: { ...project.unlockPredicates, [key]: null },
        });
        expect(r.errors.join("\n")).toMatch(/R5d .*isGhostUnlocked/);
    });

    it("라우터 정의 모양이 바뀌어 파싱이 깨지면 조용히 통과하지 않는다", () => {
        // ★ 검사기가 라우트를 0개로 읽고 "전부 도달 가능"이라고 말하는 것이
        //   가장 나쁜 실패다. 그 경우를 명시적으로 실패로 만든다.
        const r = withEdit(ROUTER_FILE, (s) => s.replace(/element:/g, "elem:"));
        expect(r.errors.join("\n")).toMatch(/라우터 파싱 실패/);
    });
});

describe("보조 함수", () => {
    it("파라미터 라우트가 구체적인 경로를 받는다", () => {
        const paths = ["/", "/stages", "/battle/:stageId"];
        expect(matchRoute("/battle/:param", paths)).toBe("/battle/:stageId");
        expect(matchRoute("/", paths)).toBe("/");
        expect(matchRoute("/battle/1-1/extra", paths)).toBeNull();
        expect(matchRoute("/nope", paths)).toBeNull();
    });

    it("이동 지시의 네 가지 표기를 모두 읽는다", () => {
        const code = [
            '<Link to="/shop" />',
            "navigate(`/battle/${id}`)",
            '{ to: "/daily", label: "일일" }',
            'navigate("/tower", { replace: true })',
            '<a href="#/trials">',
        ].join("\n");
        const got = collectNavTargets(code).map((t) => t.target);
        expect(got).toContain("/shop");
        expect(got).toContain("/battle/:param");
        expect(got).toContain("/daily");
        expect(got).toContain("/tower");
        expect(got).toContain("/trials");
    });
});
