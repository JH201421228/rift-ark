/**
 * 진단 배선의 계약 — **감시자가 실제로 걸려 있는가** (2026-08-05)
 *
 * ★★ 감시 장치는 이 저장소에서 가장 조용히 죽는 종류다. 아무 일도 일어나지 않는
 *   동안에는 배선이 끊겨 있어도 정상과 구별되지 않고, 정작 필요한 날에야
 *   "아무 기록도 없다"로 드러난다 — `wireShutdownHooks` 가 없던 시절의 씬
 *   `shutdown()` 들이 정확히 그랬다 (전부 죽은 코드였다).
 *
 * ★ 렌더 없이 소스를 읽는다 (`appShell.test.js` · `scenes.test.js` 와 같은 수법).
 *   재려는 것은 실행 결과가 아니라 **계약의 존재**다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname, relative } from "node:path";

const SRC = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (...p) => readFileSync(join(SRC, ...p), "utf8");

describe("전역 예외 수집", () => {
    const APP = read("App.jsx");

    it("★★ App 이 전역 핸들러를 설치한다 — 이것이 저장소의 유일한 수집 지점이다", () => {
        expect(
            APP,
            "installDiagnostics() 가 없으면 window.onerror · unhandledrejection 을 " +
                "듣는 곳이 0곳이 된다. 프레임 안에서 터진 예외는 Phaser 의 rAF 루프를 " +
                "영구 정지시키는데(다음 프레임을 예약하지 못한다) 흔적이 남지 않는다"
        ).toMatch(/installDiagnostics\(\)/);
    });

    it("★ 배너를 그린다 — 잡아 놓고 보여 주지 않으면 잡지 않은 것과 같다", () => {
        expect(APP).toMatch(/<FaultOverlay\s*\/>/);
    });

    it("진단 모듈에 DEV 가드가 없다 — 사용자가 쓰는 것은 배포 빌드다", () => {
        // ★ 주석은 지운다. 이 파일들의 머리말이 그 조건을 **설명**하고 있다.
        const strip = (s) =>
            s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
        const files = [
            ["utils", "diagnostics.js"],
            ["components", "FaultOverlay.jsx"],
            ["components", "FaultLog.jsx"],
        ];
        for (const p of files) {
            expect(
                strip(read(...p)),
                `${p.join("/")} 가 개발 빌드에서만 동작하면 의미가 없다`
            ).not.toMatch(/import\.meta\.env\??\.DEV/);
        }
    });

    it("React 렌더 실패도 같은 곳으로 모인다", () => {
        expect(read("components", "ScreenErrorBoundary.jsx")).toMatch(/recordFault\(/);
    });
});

describe("게임 루프 보호", () => {
    const GM = read("game", "GameManager.js");

    it("★★★ rAF 콜백을 감싼다 — 프레임 하나의 예외가 게임 전체를 죽이지 못하게", () => {
        // Phaser: step(time) { callback(time); if (isRunning) requestAnimationFrame(step); }
        // callback 이 던지면 재예약 줄에 도달하지 못한다 → 영구 정지.
        expect(GM, "installLoopGuard() 가 사라졌다").toMatch(/installLoopGuard\s*\(\)\s*\{/);
        expect(GM, "raf.callback 을 감싸지 않으면 보호가 아니다").toMatch(/raf\.callback\s*=/);
        expect(GM).toMatch(/installLoopGuard\(\);/);
    });

    it("★ 씬 update() 도 따로 감싼다 — 어느 씬이었는지가 기록에 남아야 한다", () => {
        expect(GM).toMatch(/wireUpdateGuards\s*\(\)\s*\{/);
        expect(GM, "shutdown 배선과 같은 순회에서 걸어야 빠뜨릴 자리가 없다").toMatch(
            /this\.wireUpdateGuards\(\);/
        );
    });

    it("★★ 삼키지 않는다 — 잡은 자리마다 기록이 있다", () => {
        const catches = GM.match(/catch\s*\([\w$]*\)\s*\{/g) ?? [];
        expect(catches.length).toBeGreaterThan(0);
        expect(GM.match(/recordFault\(/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    });

    it("WebGL 컨텍스트 손실·복원을 듣는다", () => {
        expect(GM).toMatch(/webglcontextlost/);
        expect(GM).toMatch(/webglcontextrestored/);
        expect(GM, "해제하지 않으면 파괴된 캔버스의 리스너가 남는다").toMatch(
            /removeEventListener\("webglcontextlost"/
        );
    });

    it("★ 루프 생존 신호를 등록하고, 파괴할 때 푼다", () => {
        expect(GM).toMatch(/setLivenessProbe\(\(\)\s*=>/);
        expect(GM, "파괴된 게임의 시각을 계속 보면 '루프가 죽었다'를 영원히 신고한다").toMatch(
            /setLivenessProbe\(null\)/
        );
    });
});

describe("전투 맥락", () => {
    const BS = read("game", "scenes", "BattleScene.js");

    it("★★ 기록에 웨이브·엔티티·발사체가 실린다 — 숫자 없는 기록은 재현할 수 없다", () => {
        expect(BS).toMatch(/setContextProvider\(/);
        for (const k of ["rec.wave", "rec.actives", "rec.projectiles", "rec.undrawn"]) {
            expect(BS, `${k} 가 빠지면 그만큼 재현 조건이 사라진다`).toContain(k);
        }
    });

    it("씬이 끝나면 맥락 제공을 푼다 (같은 함수일 때만)", () => {
        expect(BS).toMatch(/clearContextProvider\(this\._diagContext\)/);
    });
});

describe("사용자가 읽을 수 있는가", () => {
    it("★★ 설정 화면에 진단 기록이 붙어 있다 — 실기기에는 개발자 도구가 없다", () => {
        const SET = read("screens", "SettingsScreen.jsx");
        expect(SET).toMatch(/<FaultLog\s*\/>/);
        expect(SET, "import 가 빠진 JSX 는 lint 가 못 잡는다").toMatch(
            /import\s*\{\s*FaultLog\s*\}/
        );
    });
});

describe("임계값은 데이터가 갖는다 (절대규칙 4)", () => {
    const QUALITY = JSON.parse(read("game", "data", "quality.json"));
    const DIAG = read("utils", "diagnostics.js");

    it("watchdog 표가 있다", () => {
        expect(QUALITY.watchdog).toBeTruthy();
    });

    it("★ 표의 모든 필드를 실제로 읽는 코드가 있다 — 아무도 안 읽는 값을 남기지 않는다", () => {
        for (const key of Object.keys(QUALITY.watchdog)) {
            expect(DIAG, `quality.json:watchdog.${key} 를 읽는 코드가 없다`).toContain(`W.${key}`);
        }
    });

    it("★ 임계값이 코드에 박혀 있지 않다", () => {
        expect(DIAG).not.toMatch(/const STALL_MS = \d/);
    });
});

/**
 * ★★★ **2026-08-05 의 영구 정지를 만든 모양을 저장소 전체에서 금지한다.**
 *
 *   `SpritePool.acquire()` 는 풀이 마르면 최고령 활성분을 **재활용**한다 —
 *   `active.shift()` 후 `active.push()` 라 **`activeCount` 가 변하지 않는다.**
 *   그런데 호출부가 `while (pool.activeCount < n) pool.acquire()` 로 돌고 있었고,
 *   발사체 수가 풀 크기를 넘는 순간 조건이 영원히 참이 됐다. 메인 스레드가
 *   통째로 멈췄고 — 무한 루프라 rAF 도 이벤트도 돌지 않아 — **어떤 계측도
 *   그 사실을 적을 수 없었다.** 이 검사가 유일한 방어선이다.
 */
describe("★★★ 진전을 보장하지 않는 대여 루프", () => {
    function jsFiles(dir, out = []) {
        for (const e of readdirSync(dir, { withFileTypes: true })) {
            const p = join(dir, e.name);
            if (e.isDirectory()) jsFiles(p, out);
            else if (/\.(js|jsx)$/.test(e.name) && !/\.test\.jsx?$/.test(e.name)) out.push(p);
        }
        return out;
    }

    it("풀에서 대여하는 조건 루프(while)가 한 곳도 없다", () => {
        const offenders = [];
        for (const file of jsFiles(SRC)) {
            const src = readFileSync(file, "utf8");
            // 주석 속 예시는 세지 않는다 (BattleScene 이 그 사고를 주석으로 남겼다)
            const code = src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
            for (const m of code.matchAll(/\bwhile\s*\(/g)) {
                if (/\.acquire\s*\(/.test(code.slice(m.index, m.index + 220))) {
                    offenders.push(`${relative(SRC, file)}:${code.slice(0, m.index).split("\n").length}`);
                }
            }
        }
        expect(
            offenders,
            "`acquire()` 는 루프 조건의 진전을 보장하지 않는다 (마르면 재활용하므로 " +
                "activeCount 가 그대로다). 상한이 있는 for 로 대여하라: " +
                offenders.join(" · ")
        ).toEqual([]);
    });
});
