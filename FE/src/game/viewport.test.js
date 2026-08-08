/**
 * 뷰포트 — **카메라가 실제 화면 크기를 따라가는가** (2026-08-04)
 *
 * ★★★ **이 파일이 지키는 사고는 실기기에서 났다.**
 *
 *   `applyViewport` 가 스크롤을 `cam.width` 로 계산했다. 그런데 `create()` 안에서
 *   처음 불릴 때 카메라는 아직 **설정값(1280×720)** 을 들고 있다 — Phaser 가
 *   리사이즈를 처리하기 전이다. 실제 캔버스가 그보다 넓은 기기에서는 카메라가
 *   통째로 어긋난다:
 *
 *     폰 가로 915×412 → zoom 0.572, 실제 보이는 폭 1599
 *     그런데 1280 으로 계산하면 scrollX = −479 → 보이는 범위 [−479, 1120]
 *       · 균열(x=1184)이 **화면 밖으로 나간다**
 *       · 방주(x=96)가 화면 36% 지점 — 거의 가운데로 온다
 *       · 세로도 −269 밀려 **레인이 실제와 다른 높이에 그려진다**
 *
 *   사용자가 따로 제보한 두 증상("균열이 안 보인다" · "레인 탭이 엉뚱한 곳")이
 *   전부 이 한 줄이었다.
 *
 * ★ 그래서 재는 것은 "스크롤 값"이 아니라 **불변식**이다:
 *   ① 방주와 균열이 항상 보인다  ② 세로는 언제나 정확히 0..720 이다.
 */
import { describe, it, expect, vi } from "vitest";

/**
 * ★ `config.js` 가 Phaser 상수를 쓰고, Phaser 는 import 만으로 `window` 를 찾는다.
 *   테스트 환경은 node 라 그대로는 뜨지 않는다 — 쓰는 두 상수만 대체한다.
 *   (뷰포트 수학 자체는 Phaser 를 전혀 쓰지 않는다.)
 */
vi.mock("phaser", () => ({
    default: { AUTO: 0, CANVAS: 1, Scale: { RESIZE: 3 } },
}));

const { applyViewport, computeViewport } = await import("./viewport.js");
const { DESIGN, LANES } = await import("./config.js");

/** 카메라를 흉내 낸 최소 씬. `cam.width` 는 **일부러 설정값에 머물러 있다.** */
function fakeScene(w, h, { staleCam = true } = {}) {
    const cam = {
        zoom: 1,
        scrollX: 0,
        scrollY: 0,
        // ★ 실기기 재현: 리사이즈 전이라 카메라는 아직 설정 크기다
        width: staleCam ? DESIGN.width : w,
        height: staleCam ? DESIGN.height : h,
        setZoom(z) {
            this.zoom = z;
            return this;
        },
        setScroll(x, y) {
            this.scrollX = x;
            this.scrollY = y;
            return this;
        },
    };
    /**
     * ★★★ **기준은 `parent`(#game-container) 다 — `canvas` 가 아니다.**
     *   캔버스 크기는 Phaser 가 `gameSize` 로부터 정하므로 둘은 언제나 일치한다.
     *   그래서 캔버스를 기준으로 삼은 첫 수정은 아무것도 잡지 못했다 (2026-08-08).
     *   부모는 CSS 로 창을 채우므로 **브라우저가 아는 실제 크기**다.
     */
    return {
        cameras: { main: cam },
        scale: {
            gameSize: { width: w, height: h },
            parent: { clientWidth: w, clientHeight: h },
            resize(nw, nh) {
                this.gameSize.width = nw;
                this.gameSize.height = nh;
            },
            refresh() {
                this.refreshed = (this.refreshed ?? 0) + 1;
            },
        },
    };
}

/**
 * 이 화면에서 실제로 보이는 디자인 좌표 범위.
 *
 * ★★★ **Phaser 의 줌은 뷰포트 *중앙* 기준이다.** 예전 이 헬퍼는
 *   `[scrollX, scrollX + w/zoom]` 으로 모델링했는데 그것은 줌이 좌상단 기준일 때의
 *   식이다. 모델이 틀렸으므로 **틀린 구현이 이 테스트를 통과했다** — 폰에서
 *   균열이 화면 밖으로 나가는 동안 20개 케이스가 전부 초록이었다.
 *
 *   Phaser 소스의 정의 그대로 쓴다:
 *     worldView.x = scrollX + (w − w/zoom) / 2
 *     worldView.width = w / zoom
 *   (그래서 `Camera.centerOn(x,y)` 은 `scrollX = x − w/2` 이다.)
 */
function visible(scene) {
    const cam = scene.cameras.main;
    const { width: w, height: h } = scene.scale.gameSize;
    const vw = w / cam.zoom;
    const vh = h / cam.zoom;
    const x0 = cam.scrollX + (w - vw) / 2;
    const y0 = cam.scrollY + (h - vh) / 2;
    return { x: [x0, x0 + vw], y: [y0, y0 + vh] };
}

/** 실기기 표본 — 폰 가로 · 태블릿 · 데스크톱 · 극단비 */
const SCREENS = [
    ["폰 가로 (Pixel)", 915, 412],
    ["폰 가로 (iPhone)", 844, 390],
    ["폰 가로 (좁은 20:9)", 800, 360],
    ["태블릿 4:3", 1024, 768],
    ["데스크톱 16:9", 1536, 730],
    ["초광폭 21:9", 2560, 1080],
];

describe("카메라가 화면 크기를 따라간다", () => {
    for (const [name, w, h] of SCREENS) {
        it(`★★ ${name} — 방주와 균열이 둘 다 보인다`, () => {
            const scene = fakeScene(w, h);
            applyViewport(scene);
            const v = visible(scene);
            expect(v.x[0], `${name}: 방주(x=${LANES.arkX})가 왼쪽 밖`).toBeLessThanOrEqual(
                LANES.arkX
            );
            expect(v.x[1], `${name}: 균열(x=${LANES.riftX})이 오른쪽 밖`).toBeGreaterThanOrEqual(
                LANES.riftX
            );
        });

        it(`★★ ${name} — 세로는 정확히 0..720 이다 (레인 위치가 곧 진실)`, () => {
            const scene = fakeScene(w, h);
            applyViewport(scene);
            const v = visible(scene);
            // 세로로 긴 화면(4:3)은 위아래로 더 보일 수 있다. 잘리지만 않으면 된다.
            expect(v.y[0], `${name}: 위가 잘렸다`).toBeLessThanOrEqual(0.01);
            expect(v.y[1], `${name}: 아래가 잘렸다`).toBeGreaterThanOrEqual(DESIGN.height - 0.01);
            for (const lane of LANES.ground) {
                expect(lane.y, `${name}: 레인 ${lane.y} 이 화면 밖`).toBeGreaterThan(v.y[0]);
                expect(lane.y).toBeLessThan(v.y[1]);
            }
        });

        it(`${name} — 카메라가 갱신된 뒤에 다시 불려도 같은 결과다 (멱등)`, () => {
            const a = fakeScene(w, h, { staleCam: true });
            const b = fakeScene(w, h, { staleCam: false });
            applyViewport(a);
            applyViewport(b);
            expect(a.cameras.main.scrollX).toBeCloseTo(b.cameras.main.scrollX, 6);
            expect(a.cameras.main.scrollY).toBeCloseTo(b.cameras.main.scrollY, 6);
        });
    }

    it("★ 가로 중앙은 언제나 디자인 중앙(640)이다", () => {
        for (const [, w, h] of SCREENS) {
            const scene = fakeScene(w, h);
            applyViewport(scene);
            const v = visible(scene);
            expect((v.x[0] + v.x[1]) / 2).toBeCloseTo(DESIGN.width / 2, 6);
        }
    });

    /**
     * ★★ **`scrollX` 를 `vp.left` 와 비교하지 않는다.** 그 둘은 같은 값이 아니다.
     *
     *   `vp.left` 는 **보이는 왼쪽 끝**이고, `scrollX` 는 Phaser 가 줌을
     *   중앙 기준으로 적용하기 전의 값이라 둘 사이에 `(w − w/zoom) / 2` 만큼
     *   차이가 난다. 폰 가로(915×412)에서 그 차이는 **342px** 다.
     *
     *   예전 이 단언은 `scrollX === vp.left` 였는데, 그것은 스크롤을 줌으로
     *   나누던 시절(= 카메라가 실제로 어긋나 있던 시절)의 식이었다. 카메라를
     *   고치자 이 단언만 옛 모델에 남아 실패했다 — **틀린 쪽은 구현이 아니라
     *   이 단언이었다.**
     *
     *   재야 할 것은 "두 함수가 같은 화면을 본다"이므로, `visible()` 로 얻은
     *   실제 가시 범위와 `computeViewport` 의 left/right 를 맞춘다.
     */
    it("★ computeViewport 와 applyViewport 가 같은 것을 본다", () => {
        for (const [name, w, h] of SCREENS) {
            const scene = fakeScene(w, h);
            const vp = computeViewport(scene);
            applyViewport(scene);
            const v = visible(scene);
            expect(scene.cameras.main.zoom, `${name}: 줌 불일치`).toBeCloseTo(vp.zoom, 6);
            expect(v.x[0], `${name}: 왼쪽 끝 불일치`).toBeCloseTo(vp.left, 6);
            expect(v.x[1], `${name}: 오른쪽 끝 불일치`).toBeCloseTo(vp.right, 6);
            expect(v.x[1] - v.x[0], `${name}: 가시 폭 불일치`).toBeCloseTo(vp.visibleWidth, 6);
        }
    });
});

/**
 * 카메라 드리프트 자가 교정 (2026-08-04)
 *
 * ★★ 실측에서 `scale.gameSize` 는 1536×673 으로 갱신됐는데 `cam.zoom` 은 0.5
 *   (=옛 640×360)에 남아 있었다. 씬은 active 였고 멈춰 있지도 않았다 — 리사이즈
 *   이벤트가 그냥 오지 않았다. 화면에서는 **게임 전체가 잘못된 배율**로 보인다.
 *   이벤트를 믿지 않고 값을 직접 비교해 되돌린다.
 */
const { resyncViewportIfDrifted } = await import("./viewport.js");

describe("카메라 드리프트 자가 교정", () => {
    it("★★ 어긋났으면 되돌린다", () => {
        const scene = fakeScene(1536, 673);
        applyViewport(scene);
        // 옛 크기의 줌으로 오염시킨다 (리사이즈를 놓친 상태 재현)
        scene.cameras.main.zoom = 0.5;
        expect(resyncViewportIfDrifted(scene)).toBe(true);
        expect(scene.cameras.main.zoom).toBeCloseTo(Math.min(673 / 720, 1536 / 1280), 6);
    });

    it("맞으면 손대지 않는다 — 매 호출 카메라를 재설정하지 않는다", () => {
        const scene = fakeScene(915, 412);
        applyViewport(scene);
        expect(resyncViewportIfDrifted(scene)).toBe(false);
    });

    it("카메라가 아직 없으면 조용히 넘어간다", () => {
        expect(resyncViewportIfDrifted({ scale: { gameSize: { width: 800, height: 600 } } })).toBe(
            false
        );
    });
});

/* ═══════════ 광고·복귀 뒤의 "좌측 하단 쏠림" (2026-08-08 사용자 제보) ═══════════ */

const { syncScaleToCanvas } = await import("./viewport.js");

describe("gameSize 자체가 낡은 경우 — 좌측 하단 쏠림", () => {
    /**
     * ★★★ **이것이 `resyncViewportIfDrifted` 만으로는 안 잡히던 사고다.**
     *   그 함수는 카메라 ↔ `gameSize` 를 대조하는데, 여기서 틀린 것은 `gameSize`
     *   **자신**이다. 카메라는 그 틀린 값에 정확히 맞춰져 있으므로 드리프트가 0 이다.
     *   *기준이 틀렸을 때 기준과의 일치는 아무것도 보증하지 않는다.*
     */
    it("★★★ 컨테이너만 커진 상태를 잡아낸다 (캔버스 기준 검사는 통과시켰다)", () => {
        const scene = fakeScene(915, 412);
        applyViewport(scene); // 카메라는 915×412 에 정확히 맞다
        // 광고가 화면을 덮었다 돌아오며 캔버스만 커졌다 — Phaser 는 리사이즈를 놓쳤다
        scene.scale.parent.clientWidth = 1080;
        scene.scale.parent.clientHeight = 500;

        // 카메라 ↔ gameSize 는 여전히 완전히 일치한다 (= 옛 검사는 false 를 냈다)
        const expectedOld = Math.min(412 / DESIGN.height, 915 / DESIGN.width);
        expect(scene.cameras.main.zoom).toBeCloseTo(expectedOld, 6);

        expect(resyncViewportIfDrifted(scene)).toBe(true);
        expect(scene.scale.gameSize).toEqual({ width: 1080, height: 500 });
        expect(scene.cameras.main.zoom).toBeCloseTo(
            Math.min(500 / DESIGN.height, 1080 / DESIGN.width),
            6
        );
    });

    it("어긋나지 않았으면 refresh 하지 않는다", () => {
        const scene = fakeScene(915, 412);
        applyViewport(scene);
        expect(syncScaleToCanvas(scene.scale)).toBe(false);
        expect(scene.scale.refreshed ?? 0).toBe(0);
    });

    it("★ 컨테이너가 0 이면 손대지 않는다 — 레이아웃 전이지 0 이 맞는 게 아니다", () => {
        const scene = fakeScene(915, 412);
        scene.scale.parent.clientWidth = 0;
        scene.scale.parent.clientHeight = 0;
        expect(syncScaleToCanvas(scene.scale)).toBe(false);
        expect(scene.scale.gameSize).toEqual({ width: 915, height: 412 });
    });

    it("1px 오차는 무시한다 (반올림으로 늘 흔들린다)", () => {
        const scene = fakeScene(915, 412);
        scene.scale.parent.clientWidth = 916;
        expect(syncScaleToCanvas(scene.scale)).toBe(false);
    });

    it("scale 이 없거나 refresh 가 없으면 조용히 넘어간다", () => {
        expect(syncScaleToCanvas(undefined)).toBe(false);
        expect(syncScaleToCanvas({ parent: { clientWidth: 100, clientHeight: 100 } })).toBe(false);
    });

    /**
     * ★★★ **이것이 실기에서 실제로 일어난 모양이다** (2026-08-08).
     *   광고가 세로로 뜨면서 회전 왕복이 일어났고, Phaser 가 **세로 크기**를
     *   자기 크기로 기억한 채 남았다. 컨테이너는 가로 그대로다.
     */
    it("★★★ 세로↔가로가 뒤바뀐 상태(광고 회전 왕복)를 잡아낸다", () => {
        const scene = fakeScene(915, 412);
        applyViewport(scene);
        // 광고가 세로로 떴다 — Phaser 만 세로 크기를 기억한 채 남았다
        scene.scale.gameSize.width = 412;
        scene.scale.gameSize.height = 915;
        scene.cameras.main.zoom = Math.min(915 / DESIGN.height, 412 / DESIGN.width);

        expect(resyncViewportIfDrifted(scene)).toBe(true);
        expect(scene.scale.gameSize).toEqual({ width: 915, height: 412 });
        const v = visible(scene);
        expect(v.x[0], "방주가 왼쪽 밖").toBeLessThanOrEqual(LANES.arkX);
        expect(v.x[1], "균열이 오른쪽 밖").toBeGreaterThanOrEqual(LANES.riftX);
    });

    /**
     * ★ 교정 뒤에는 **불변식**이 다시 성립해야 한다 — 이 파일의 존재 이유다.
     *   방주(96)와 균열(1184)이 보이고, 세로는 정확히 0..720 이다.
     */
    it("교정 뒤 방주와 균열이 다시 보인다", () => {
        const scene = fakeScene(915, 412);
        applyViewport(scene);
        scene.scale.parent.clientWidth = 2340;
        scene.scale.parent.clientHeight = 1080;
        resyncViewportIfDrifted(scene);

        /**
         * ★ `visible()` 을 쓴다. `scrollX .. scrollX + w/zoom` 으로 모델링하면
         *   **이 파일이 이미 경고한 옛 실수**를 반복하게 된다 — Phaser 의 줌은
         *   뷰포트 *중앙* 기준이라 그 식은 `(w − w/zoom)/2` 만큼 어긋난다.
         */
        const v = visible(scene);
        expect(v.x[0], "방주가 왼쪽 밖").toBeLessThanOrEqual(LANES.arkX);
        expect(v.x[1], "균열이 오른쪽 밖").toBeGreaterThanOrEqual(LANES.riftX);
        expect(v.y[0], "위가 잘렸다").toBeLessThanOrEqual(0.01);
        expect(v.y[1], "아래가 잘렸다").toBeGreaterThanOrEqual(DESIGN.height - 0.01);
    });
});
