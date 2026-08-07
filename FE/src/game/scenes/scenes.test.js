/**
 * 씬 계약 — **모든 씬이 지켜야 하는 두 가지** (2026-08-04)
 *
 * ★★ ① **뷰포트를 붙인다.** 이 저장소의 모든 좌표는 디자인 좌표(1280×720)다.
 *   `installViewport` 를 부르지 않은 씬은 카메라가 줌 1 · 스크롤 0 이라
 *   화면 픽셀 좌표를 그대로 보고, 그러면 `DESIGN.width / 2` 가 화면 한가운데가
 *   **아니게 된다.** 부팅·프리로드 씬이 정확히 그 상태였고, 넓은 화면일수록
 *   로딩 화면이 왼쪽으로 치우쳐 보였다 (1536px 창에서 42% 지점).
 *
 * ★★ ② **`shutdown()` 이 있다** (절대 규칙 3). Phaser 는 이것을 자동으로 부르지
 *   않는다 — `GameManager.wireShutdownHooks()` 가 SHUTDOWN 이벤트에 연결한다.
 *   씬에 메서드가 없으면 그 연결은 조용히 아무것도 하지 않는다.
 *
 * ★ 렌더 없이 소스를 읽는다. 재려는 것이 실행 결과가 아니라 **계약의 존재**다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));

/** 씬 파일 — 등록부(index.js)와 테스트는 제외 */
const sceneFiles = readdirSync(HERE)
    .filter((n) => n.endsWith("Scene.js"))
    .map((n) => [n, readFileSync(join(HERE, n), "utf8")]);

describe("씬 계약", () => {
    it("씬 파일을 실제로 찾았다", () => {
        expect(sceneFiles.length).toBeGreaterThanOrEqual(3);
    });

    it("★★ 모든 씬이 installViewport 를 부른다 — 안 부르면 화면 중앙이 중앙이 아니다", () => {
        const missing = sceneFiles
            .filter(([, src]) => !/installViewport\(\s*this/.test(src))
            .map(([name]) => name);
        expect(
            missing,
            `이 씬들은 디자인 좌표(1280×720)를 쓰면서 카메라를 맞추지 않는다 — ` +
                `화면이 넓을수록 내용이 왼쪽으로 치우친다: ${missing.join(" · ")}`
        ).toEqual([]);
    });

    it("★★ 모든 씬이 shutdown() 을 구현한다 (절대 규칙 3)", () => {
        const missing = sceneFiles
            .filter(([, src]) => !/\n\s*shutdown\s*\(\s*\)\s*\{/.test(src))
            .map(([name]) => name);
        expect(
            missing,
            `구독 해제·트윈 킬·풀 반환이 갈 곳이 없다. 그리는 것이 없어도 빈 shutdown() 을 ` +
                `남긴다 — GameManager.wireShutdownHooks() 의 계약에 구멍이 생긴다: ${missing.join(" · ")}`
        ).toEqual([]);
    });

    it("등록부가 실재하는 씬만 가리킨다", async () => {
        const index = readFileSync(join(HERE, "index.js"), "utf8");
        const names = new Set(sceneFiles.map(([n]) => n));
        for (const m of index.matchAll(/from\s+"\.\/([\w]+\.js)"/g)) {
            expect(names.has(m[1]), `등록부가 없는 파일을 import 한다: ${m[1]}`).toBe(true);
        }
    });
});
