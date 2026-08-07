/**
 * BootScene — 부팅 1단계
 *
 * ★ 에셋을 로드하지 않는다. 프로그레스 바를 Graphics 로 직접 그리므로
 *   이 씬은 0바이트다. 첫 픽셀이 화면에 뜨는 시각을 최대한 앞당긴다.
 *
 * Boot → Preload → Ark (빈 씬)
 *
 * @see docs/03-tech/23-asset-pipeline.md §6.1
 */
import Phaser from "phaser";
import { DESIGN, PIXEL_FONT } from "../config.js";
import { installViewport } from "../viewport.js";
/**
 * ★★ 구독(`onLangChange`)을 걸지 않는다. 이 씬은 `create()` 에서 곧바로
 *   `scene.start("Preload")` 를 부르고 사라지므로 다시 그릴 일이 없고, 무엇보다
 *   **언어는 이 씬보다 먼저 정해진다** — `App.jsx` 가 `hydrated` 전에는
 *   `<PhaserGame/>` 을 아예 그리지 않고, 그 하이드레이션 구독이 `setLang` 을
 *   `fireImmediately` 로 부른다. 즉 여기 도달한 시점의 언어가 이미 최종값이다.
 */
import { t } from "@/i18n";

/**
 * 라틴 로고타이프. **번역 대상이 아니다** — 로마자 표기 그 자체이고, 영어
 * 앱 이름(`common.appName.en`)과 대소문자만 다르다.
 */
const SUBTITLE = "RIFT ARK";

export class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: "Boot" });
    }

    create() {
        /**
         * ★★ **부팅 화면도 뷰포트를 쓴다** (2026-08-04).
         *
         *   이 씬만 `installViewport` 를 부르지 않아서, 카메라는 줌 1 · 스크롤 0 으로
         *   화면 픽셀 좌표를 그대로 보고 있었다. 그런데 글자는 `DESIGN.width / 2`
         *   (=640) 에 놓는다 — 1536px 창에서 640 은 42% 지점이라 **로딩 화면이
         *   왼쪽으로 치우쳐** 보였다. 화면이 넓을수록 더 치우친다.
         *
         *   뷰포트를 붙이면 `DESIGN.width / 2` 가 곧 **보이는 화면의 한가운데**가
         *   되고(`viewport.js:applyViewport` 가 카메라를 그렇게 스크롤한다),
         *   다른 모든 씬과 좌표계가 같아진다.
         */
        installViewport(this);
        const title = t("common.appName");
        this.add
            .text(DESIGN.width / 2, DESIGN.height / 2 - 24, title, {
                fontFamily: PIXEL_FONT,
                fontSize: "48px",
                color: "#f2b33d",
            })
            .setOrigin(0.5);

        /**
         * ★ 라틴 로고타이프는 **한국어일 때만** 아래에 깐다. 영어에서는 위 줄이
         *   이미 `Rift Ark` 라, 그대로 두면 같은 이름이 두 번 쌓인다.
         *   `title` 과 비교해서 판단한다 — 언어 id 로 분기하면 언어가 하나 늘 때
         *   이 자리가 조용히 틀린다 (화면이 스스로 판정하지 않는다).
         */
        if (title.toUpperCase() !== SUBTITLE) {
            this.add
                .text(DESIGN.width / 2, DESIGN.height / 2 + 20, SUBTITLE, {
                    fontFamily: PIXEL_FONT,
                    fontSize: "20px",
                    color: "#5a6b7a",
                })
                .setOrigin(0.5);
        }

        this.scene.start("Preload");
    }

    /**
     * ★ 정리할 것이 없어도 남긴다 (절대 규칙 3). `installViewport` 는 스스로
     *   `shutdown` 이벤트에 붙어 리스너를 뗀다 — 여기서는 그 계약을 비워 둘 뿐이고,
     *   메서드 자체가 없으면 `GameManager.wireShutdownHooks()` 의 연결에
     *   구멍이 하나 생긴다.
     */
    shutdown() {
        this.tweens?.killAll();
    }
}
