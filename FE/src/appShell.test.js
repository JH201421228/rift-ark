/**
 * App 셸의 계약 — 소스 대조 검사.
 *
 * ★ 테스트 환경이 `environment: "node"` 라 렌더할 수 없다 (vite.config.js).
 *   그래서 `check-*.mjs` · `saveVersion.test.js` 와 같은 방식으로 소스를 읽어 대조한다.
 *
 * ★★ 지키는 명제: **라우트 화면 하나가 못 뜨는 것과 앱이 죽는 것은 다르다.**
 *   라우트 element 를 전부 `React.lazy` 로 바꾼 뒤, 동적 import 가 reject 하면
 *   에러가 루트까지 올라간다. 루트 라우트가 곧 `App` 이므로 경계가 없으면
 *   PhaserGame · TabBar 를 포함한 셸이 통째로 언마운트되고,
 *   react-router 7 의 기본 경계가 **영문 스택 화면**을 그린다 (절대 규칙 9 위반).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = readFileSync(join(HERE, "App.jsx"), "utf8");

describe("지연 로딩 화면의 오류 경계", () => {
    it("★ <Outlet/> 이 오류 경계 안에 있다 — 청크 로드 실패가 셸을 죽이지 않는다", () => {
        const m = /<ScreenErrorBoundary[\s\S]*?<\/ScreenErrorBoundary>/.exec(APP);
        expect(
            m,
            "App 셸에 ScreenErrorBoundary 가 없다 — 동적 import 가 reject 하면 " +
                "캔버스·탭바까지 언마운트되고 영문 오류 화면이 뜬다"
        ).toBeTruthy();
        expect(m[0], "경계가 Outlet 을 감싸지 않는다").toContain("<Outlet />");
        expect(m[0], "Suspense 도 같은 경계 안에 있어야 한다").toContain("<Suspense");
    });

    it("경계는 저장소에 정확히 하나다 — 14벌이 되면 그중 하나를 빠뜨린다", () => {
        const roots = ["screens", "components", "hud"];
        let count = /<ScreenErrorBoundary/.test(APP) ? 1 : 0;
        const walk = (dir) => {
            for (const e of readdirSync(dir, { withFileTypes: true })) {
                const p = join(dir, e.name);
                if (e.isDirectory()) walk(p);
                else if (/\.jsx$/.test(e.name) && e.name !== "ScreenErrorBoundary.jsx") {
                    count += (readFileSync(p, "utf8").match(/<ScreenErrorBoundary/g) ?? []).length;
                }
            }
        };
        for (const d of roots) walk(join(HERE, d));
        expect(count).toBe(1);
    });

    it("복구 안내가 한국어다 (절대 규칙 9)", () => {
        const src = readFileSync(join(HERE, "components", "ScreenErrorBoundary.jsx"), "utf8");
        expect(src).toContain("다시 시도");
        expect(src).toMatch(/getDerivedStateFromError/);
        // 세이브를 건드리는 버튼을 여기 두지 않는다 — 가장 비싼 오조작 경로가 된다
        expect(src).not.toMatch(/resetSave|clearStorage/);
    });
});

/**
 * 탭 바 (2026-08-04)
 *
 * ★★ 한때 튜토리얼 진행에 따라 탭을 하나씩 여는 배선이 있었다. 튜토리얼을
 *   걷어내면서 그 근거가 사라졌고, **진행도로 다시 잠그지 않는다** —
 *   화면은 여섯 개뿐이고, 무엇을 숨겨서 얻는 것보다 "눌렀는데 없다"로 잃는 것이 크다.
 *
 * ★ 렌더 없이 소스를 읽는다 — 이 저장소에는 testing-library 가 없고,
 *   재려는 것이 렌더 결과가 아니라 **규칙의 존재**다 (a11y.test.js 와 같은 수법).
 */
describe("탭 바", () => {
    const TAB = readFileSync(join(HERE, "components", "TabBar.jsx"), "utf8");

    it("탭은 다섯이고 전부 라우트를 가리킨다", () => {
        const tos = [...TAB.matchAll(/to:\s*"([^"]+)"/g)].map((m) => m[1]);
        expect(tos).toEqual(["/ark", "/stages", "/loadout", "/companions", "/settings"]);
    });

    it("★★ 어떤 조건으로도 탭을 잠그지 않는다", () => {
        expect(TAB, "진행도로 탭을 숨기면 '눌렀는데 없다'가 돌아온다").not.toMatch(
            /highestStage|unlock|isFtueUnlocked/
        );
    });

    it("전투와 타이틀에서는 탭 바 자체를 숨긴다", () => {
        expect(TAB).toMatch(/pathname === "\/" \|\| pathname\.startsWith\("\/battle"\)/);
    });
});
