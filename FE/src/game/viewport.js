/**
 * 뷰포트 — 레터박스 없이 화면을 채우되 **게임플레이 좌표계는 고정**한다
 *
 * ★★ 문제: `Scale.FIT` 은 1280×720 을 통째로 맞추므로 화면비가 다르면
 *   좌우에 검은 여백이 남는다. 20:9 안드로이드에서는 좌우 240px 씩,
 *   즉 화면의 20% 가 검은 띠다.
 *
 * ★★ 해법: **세로 720 만 고정하고 가로는 열어 준다.**
 *
 *     zoom = 화면높이 / 720
 *     보이는 가로 = 화면너비 / zoom   (16:9 보다 넓으면 1280 초과)
 *
 *   이러면 기존 좌표가 **전부 그대로 유효하다.** 레인 y(320/416/512),
 *   방주 x(96), 균열 x(1184), HUD 높이 — 하나도 안 바뀐다.
 *   단지 x < 0 과 x > 1280 구역이 추가로 보일 뿐이고, 그 구역은
 *   **배경만** 채운다. 게임플레이는 여전히 0~1280 안에서만 일어난다.
 *
 * ★ 왜 ENVELOP 이 아닌가: ENVELOP 은 짧은 축을 채우느라 긴 축을 **잘라낸다.**
 *   세로가 잘리면 HUD 와 레인이 화면 밖으로 나간다.
 *
 * ★ 왜 세로를 고정하는가: 레인이 가로로 놓인 게임이라 세로가 곧 레이아웃이다.
 *   가로는 "더 보여도 되는" 축이고, 세로는 한 픽셀도 양보할 수 없다.
 *
 * ★ 픽셀 아트 떨림: zoom 이 비정수가 될 수 있다. 정수로 반올림하면 화면
 *   위아래에 여백이 생기므로, 여기서는 정확한 배율을 쓰고 대신
 *   `roundPixels` 로 표본화를 안정시킨다 (config.js).
 *
 * @see docs/03-tech/20-architecture.md §5
 */
import { DESIGN } from "./config.js";

/**
 * 현재 화면에서 보이는 디자인 좌표 범위.
 * ★ 매 프레임 부르지 않는다 — resize 때만 갱신해 캐시한다.
 */
export function computeViewport(scene) {
    const w = scene.scale.gameSize.width || DESIGN.width;
    const h = scene.scale.gameSize.height || DESIGN.height;

    /**
     * ★★ **줌은 두 축 중 더 빡빡한 쪽이 정한다** (2026-08-04 수정).
     *
     *   예전에는 `zoom = h / 720` 고정이고 `visibleWidth` 만 1280 으로 **끌어올렸다.**
     *   그건 계산상의 값일 뿐이라 **카메라는 여전히 `w / zoom` 만 보여 준다** —
     *   16:9 보다 좁은 화면(4:3 태블릿 1024×768)에서 실제 가시 폭이 960 이 되어
     *   **균열(x=1184)이 화면 밖으로 나갔다.** 주석은 "위아래에 여백이 남는다"고
     *   적혀 있었는데 그렇게 만드는 코드가 없었다.
     *
     *   이제 좁은 화면에서는 줌을 더 낮춰 **가로 1280 을 통째로 보장하고**,
     *   남는 세로를 배경으로 채운다. 넓은 화면에서는 예전과 완전히 같다
     *   (`w/1280 > h/720` 이므로 `h/720` 이 선택된다).
     */
    const zoom = Math.min(h / DESIGN.height, w / DESIGN.width);
    const visibleWidth = w / zoom;
    const centerX = DESIGN.width / 2;

    return {
        zoom,
        visibleWidth,
        left: centerX - visibleWidth / 2,
        right: centerX + visibleWidth / 2,
    };
}

/**
 * 씬 카메라를 뷰포트에 맞춘다.
 * @returns {ReturnType<typeof computeViewport>}
 */
export function applyViewport(scene) {
    const vp = computeViewport(scene);
    const cam = scene.cameras.main;
    cam.setZoom(vp.zoom);

    /**
     * ★★★ **스크롤을 줌으로 나누지 않는다** (2026-08-04 재수정 — 두 번 틀렸다).
     *
     *   Phaser 의 카메라 줌은 **뷰포트 중앙을 기준으로** 적용된다. 그래서 월드의
     *   한 점을 화면 중앙에 두는 식은 줌과 무관하다:
     *
     *       scrollX = 월드중앙X − cam.width / 2        (`Camera.centerOn` 이 하는 그대로)
     *
     *   예전 주석은 "centerOn 은 줌을 무시한다"며 `cam.width / zoom / 2` 를 썼는데
     *   **그 나눗셈이 버그였다.** 데스크톱(1536×730, 줌 1.01)에서는 오차가 10px 라
     *   눈에 띄지 않았지만, 폰 가로(915×412, 줌 0.57)에서는 **342px** 어긋난다:
     *     · 방주(x=96)가 화면 한가운데로 오고
     *     · 균열(x=1184)이 오른쪽 화면 밖으로 나가고
     *     · 세로도 154px 밀려 레인이 실제와 다른 높이에 그려진다
     *   (사용자 제보 3건 — "균열이 안 보인다" · "레인 탭이 엉뚱한 곳" ·
     *    "로딩 화면이 가운데가 아니다" — 이 한 줄이 전부였다.)
     *
     * ★ 크기는 `scale.gameSize` 에서 읽는다. `cam.width` 는 `create()` 시점에
     *   아직 설정값(1280×720)일 수 있다 — 그것이 첫 번째 실수였다.
     */
    const { width: w, height: h } = scene.scale.gameSize;
    cam.setScroll(DESIGN.width / 2 - (w || DESIGN.width) / 2, DESIGN.height / 2 - (h || DESIGN.height) / 2);
    return vp;
}

/**
 * 씬에 뷰포트를 붙이고 resize 를 따라가게 한다.
 *
 * ★ 반드시 정리한다. Scale 이벤트는 **게임 전역**이라 씬이 죽어도 남는다 —
 *   씬을 몇 번 드나들면 죽은 씬의 카메라를 만지는 리스너가 쌓인다.
 *
 * @param {Phaser.Scene} scene
 * @param {(vp: object) => void} [onChange] 배경 등을 다시 그려야 하는 쪽
 * @returns {() => void} 해제 함수
 */
export function installViewport(scene, onChange) {
    const handler = () => {
        // ★ 죽은 씬의 카메라를 만지지 않는다. Scale 이벤트는 게임 전역이라
        //   씬이 정지된 뒤에도 도착할 수 있다.
        if (!scene.sys?.isActive?.() || !scene.cameras?.main) return;
        try {
            const vp = applyViewport(scene);
            scene.viewport = vp;
            onChange?.(vp);
        } catch (e) {
            console.warn("[viewport] resize handling failed", e);
        }
    };

    // ★★ 뷰포트는 **연출**이다. 여기서 던지면 씬의 create() 가 중단되고
    //   그 뒤의 `scene.start(...)` 가 실행되지 않아 **부팅 체인이 멈춘다.**
    //   실제로 Boot 에서 그 일이 났다. 화면 비율 계산이 게임을 못 켜게 만들면 안 된다.
    try {
        scene.viewport = applyViewport(scene);
    } catch (e) {
        console.warn("[viewport] initial apply failed — falling back to the design coordinate space", e);
        scene.viewport = { zoom: 1, visibleWidth: DESIGN.width, left: 0, right: DESIGN.width };
    }

    scene.scale.on("resize", handler);
    /**
     * ★★ 씬이 다시 깨어날 때도 맞춘다. 멈춰 있는 동안 온 리사이즈는 위 핸들러가
     *   놓칠 수 있고(정지한 씬의 카메라를 만지지 않으므로), 그러면 돌아왔을 때
     *   **카메라만 옛 크기에 남는다.**
     */
    scene.events.on("resume", handler);
    scene.events.on("wake", handler);
    scene.events.once("shutdown", () => {
        scene.scale.off("resize", handler);
        scene.events.off("resume", handler);
        scene.events.off("wake", handler);
    });

    return () => {
        scene.scale.off("resize", handler);
        scene.events.off("resume", handler);
        scene.events.off("wake", handler);
    };
}

/**
 * 카메라가 실제 화면 크기와 어긋났으면 다시 맞춘다.
 *
 * ★★★ **왜 이런 것이 필요한가** (2026-08-04, 실측).
 *
 *   `scale.gameSize` 는 1536×673 으로 갱신됐는데 `cam.zoom` 은 0.5(=옛 640×360)에
 *   그대로 남아 있는 상태를 재현했다. 씬은 `isActive() === true` 였고 멈춰 있지도
 *   않았다 — 즉 리사이즈 이벤트가 그냥 도착하지 않았다. `scale.refresh()` 를 부르자
 *   0.936 으로 즉시 교정됐다.
 *
 *   화면에서는 **게임 전체가 잘못된 배율로 그려지는** 것으로 나타난다. 폰에서
 *   회전하거나 키보드가 올라왔다 내려가면 그대로 재현될 수 있는 종류의 사고다.
 *
 * ★ 이벤트를 믿지 않고 **값을 직접 비교**한다. 부동소수 오차를 넘는 차이일 때만
 *   손댄다 — 매 호출 카메라를 재설정하면 그것대로 낭비다.
 *
 * ★ 호출부는 이미 스로틀된 자리여야 한다 (BattleScene 의 10Hz 동기화 블록).
 *   비교는 곱셈 두 번이라 그 주기에서는 사실상 공짜다.
 *
 * @param {Phaser.Scene} scene
 * @returns {boolean} 교정했으면 true
 */
export function resyncViewportIfDrifted(scene) {
    const cam = scene.cameras?.main;
    if (!cam || !scene.scale) return false;
    const { width: w, height: h } = scene.scale.gameSize;
    if (!(w > 0) || !(h > 0)) return false;

    const expected = Math.min(h / DESIGN.height, w / DESIGN.width);
    if (Math.abs(cam.zoom - expected) < 1e-4) return false;

    scene.viewport = applyViewport(scene);
    return true;
}

/**
 * 디자인 좌표 → 화면(CSS) 좌표.
 *
 * ★★ **카메라와 같은 식을 쓴다.** HUD 가 레인 위치를 자기 방식으로 계산하면
 *   카메라를 고칠 때마다 둘이 갈라진다 — 실제로 갈라졌다. 레인 선택 영역이
 *   실제 레인과 다른 높이에 떠 있었고(2026-08-04 제보), 원인은 카메라 버그였지만
 *   **같은 식을 쓰지 않는 한 다음에도 갈라진다.**
 *
 * @param {number} designY  1280×720 좌표계의 y
 * @param {{top:number, height:number, width:number}} rect 캔버스의 화면 사각형
 * @returns {number} 화면 y (px)
 */
export function designYToScreen(designY, rect) {
    const zoom = Math.min(rect.height / DESIGN.height, rect.width / DESIGN.width);
    if (!(zoom > 0)) return rect.top;
    // 카메라가 보는 세로 범위의 위쪽 끝 (applyViewport 와 동일)
    const visibleTop = DESIGN.height / 2 - rect.height / zoom / 2;
    return rect.top + (designY - visibleTop) * zoom;
}

/**
 * 디자인 좌표 → 화면(CSS) 좌표, 가로.
 *
 * ★ `designYToScreen` 과 **같은 줌**을 쓴다. 레인 강조 사각형을 전장 폭
 *   (방주 96 ~ 균열 1184)에 맞추려면 가로도 카메라와 같은 식이어야 한다 —
 *   DOM 이 자기 방식으로 계산하면 화면비가 바뀔 때마다 사각형이 전장과 어긋난다.
 *
 * @param {number} designX  1280×720 좌표계의 x
 * @param {{left:number, height:number, width:number}} rect 캔버스의 화면 사각형
 * @returns {number} 화면 x (px)
 */
export function designXToScreen(designX, rect) {
    const zoom = Math.min(rect.height / DESIGN.height, rect.width / DESIGN.width);
    if (!(zoom > 0)) return rect.left;
    const visibleLeft = DESIGN.width / 2 - rect.width / zoom / 2;
    return rect.left + (designX - visibleLeft) * zoom;
}
