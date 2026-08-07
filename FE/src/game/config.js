/**
 * 게임 전역 설정
 *
 * 가로형 픽셀아트 모바일 게임. 디자인 해상도 1280×720 (16:9) + Scale.RESIZE.
 *
 * ★ FIT 을 버린 이유: 20:9 기기에서 좌우 240px 씩, 화면의 20% 가 검은 띠였다.
 *   RESIZE 로 캔버스가 화면을 채우고, 좌표계 고정은 viewport.js 가 맡는다
 *   (세로 720 만 고정 · 가로만 열림). 기존 좌표 상수는 전부 그대로 유효하다.
 *
 * ★★ Boot·Preload 에는 viewport 를 걸지 않는다. 부팅 체인이 끊긴다.
 *
 * @see docs/03-tech/20-architecture.md §5
 * @see docs/02-design/18-ux-ui.md §1
 */
import Phaser from "phaser";
import { IS_LOW_END } from "./device.js";

/**
 * 디자인 해상도 (16:9 픽셀아트 베이스)
 *
 * Scale.FIT + 고정 width/height 조합이므로 캔버스 백버퍼는 기기와 무관하게
 * 항상 1280×720 으로 고정된다. 즉 필레이트가 기기별로 변하지 않는다
 * (921,600px × 60fps = 55Mpx/s — 모바일 GPU 여유 범위).
 *
 * 640×360 이 아닌 이유:
 *   보스 원본이 80~250px 이라 640×360 에서는 EVil Wizard(250×250)가 ×1 에서도
 *   화면 높이의 69% 를 먹고 축소 선택지가 없었다. 1280×720 에서 ×1 = 35% 가 되어
 *   비로소 배율 선택지가 생긴다. 인게임 텍스트·Graphics 선명도도 2배.
 */
export const DESIGN = { width: 1280, height: 720 };

/** UI 안전 영역 — 4:3 태블릿에서도 보장되는 중앙 폭 */
export const SAFE = { width: 1136, height: 720 };

/**
 * 전장 레이아웃
 * @see docs/02-design/11-core-loop.md §1.1
 */
export const LANES = {
    /** 공중 레이어 (FLYING 전용) */
    air: { y: 224 },
    /** 지상 레인 3개 — 전방/중앙/후방 */
    ground: [{ y: 320 }, { y: 416 }, { y: 512 }],
    /** 아군 기지(방주) 벽 x */
    arkX: 96,
    /** 적 스폰(균열) x */
    riftX: 1184,
    /** HUD 영역 높이 */
    hud: { topH: 80, bottomH: 160 },
};

/**
 * 스프라이트 렌더 배율
 *
 * ★ 소형(16px)·대형(32px) 유닛이 모두 ×4 이므로 픽셀 밀도가 완전히 동일하다
 *   (1 소스px = 4 디자인px). 지휘관과 보스만 밀도가 다르며, 이것은 의도된
 *   스케일 위계다 — 굵은 픽셀 = 병력, 고운 픽셀 = 이름 있는 존재.
 *
 * @see docs/02-design/12-unit-roster.md §0
 */
export const SPRITE_SCALE = {
    /** 16×16 몬스터 → 64px */
    unitSmall: 4,
    /** 32×32 NPC → 128px */
    unitLarge: 4,
    /** 96×80 FREE_Adventurer → 192×160px */
    commander: 2,
    /** 64×64 이펙트 → 128~256px */
    effect: 2,
    /** 16×16 발사체 → 64px */
    projectile: 4,
    /** 보스는 개별 지정 (bosses.json 의 art.scale) — 화면 높이 280~400px 목표 */
    bossDefault: 4,
};

/** 레인 y 좌표만 뽑은 배열 — 시뮬/렌더에서 자주 쓰인다 */
export const LANE_Y = LANES.ground.map((l) => l.y);

/** 배경색 (Capacitor WebView 배경과 동일해야 흰 플래시가 없다) */
export const BG_COLOR = "#0f0f1e";

/** 픽셀 폰트 패밀리 — index.css 의 @font-face 와 일치해야 한다 */
export const PIXEL_FONT = "Mulmaru";

/**
 * 저사양 기기 감지 — 판정은 `device.js` 에 있다.
 *
 * ★★ **여기서 다시 재지 않는다.** 렌더러(CANVAS/AUTO)와 품질 티어가 같은 답을
 *   써야 하는데, 이 파일은 `phaser` 를 import 하므로 순수 모듈이 값 하나를 쓰려고
 *   렌더러 전체를 끌고 오게 된다. 판정만 떼어 두고 여기서는 다시 내보낸다.
 *
 * @see docs/03-tech/26-performance-budget.md §4
 */
export { IS_LOW_END };

export const GAME_CONFIG = {
    type: IS_LOW_END ? Phaser.CANVAS : Phaser.AUTO,
    backgroundColor: BG_COLOR,

    // 픽셀아트: roundPixels 활성 + antialias 비활성 (gl.NEAREST 샘플링)
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    autoRound: true,

    powerPreference: "high-performance",
    autoMobilePipeline: true, // Phaser 3.60+ 모바일 파이프라인

    /**
     * ★★ RESIZE — 캔버스가 화면을 꽉 채운다. 레터박스 없음.
     *
     *   좌표계가 흔들리는 것을 막는 것은 `viewport.js` 다:
     *   **세로 720 만 고정**하고(zoom = 화면높이/720) 가로만 열어 준다.
     *   그래서 레인 y·방주 x·균열 x 등 모든 기존 상수가 그대로 유효하고,
     *   넓은 화면에서는 x<0 · x>1280 구역이 추가로 보일 뿐이다.
     *   그 구역은 배경만 채우며 게임플레이는 0~1280 안에서만 일어난다.
     *
     *   FIT 을 버린 이유: 20:9 기기에서 좌우 240px 씩, 화면의 20% 가
     *   검은 띠였다. 노치 흡수는 세이프에어리어 패딩이 이미 하고 있다.
     */
    scale: {
        mode: Phaser.Scale.RESIZE,
        width: DESIGN.width,
        height: DESIGN.height,
    },

    physics: {
        default: "arcade",
        arcade: { gravity: { y: 0 }, debug: false },
    },

    fps: { target: 60, forceSetTimeOut: false },

    // 지휘관 드래그 + 슬롯 탭 동시 입력
    input: { activePointers: 3 },

    render: { transparent: false },
    audio: { disableWebAudio: false },
};
