/**
 * 데미지 숫자용 **비트맵 폰트를 런타임에 굽는다**.
 *
 * ══════════════════════════════════════════════════════════════════
 * ★★★ 왜 Phaser `Text` 를 버렸나 (2026-08-05, 1-14 멈춤 제보)
 * ══════════════════════════════════════════════════════════════════
 * `Text` 는 문자열이 바뀔 때마다 **캔버스를 다시 그리고 GPU 텍스처를 다시
 * 올린다.** 스타일을 바꾸면 그 위에 `TextStyle.setStyle` 이 속성표 30개를
 * `GetAdvancedValue` 로 훑는다. 데미지 숫자는 그 두 가지를 **전부** 한다 —
 * 값도 색도 크기도 매번 다르기 때문이다.
 *
 * 실측 (6× CPU 스로틀 = 중급 스마트폰 대역, 1-14, 240초):
 *
 * | 호출 | ms |
 * |---|---|
 * | `Text.setText` (캔버스 재렌더 + 텍스처 업로드) | 0.85 |
 * | `Text.setStyle(patch, false)` (속성표 30개 순회) | **2.04** |
 * | `dmgText.show()` 전체 (실전 평균 3,416회) | **1.01** |
 * | BitmapText `setText + setFontSize + 위치·알파·배율` | **0.0098** |
 *
 * 웨이브 13~15 의 스파이크 프레임에서 `show()` 만으로 **70ms** 를 먹었다
 * (프레임 171ms 중). 100배 싼 경로가 있는데 그것을 안 쓰고 있었던 것이다.
 *
 * ══════════════════════════════════════════════════════════════════
 * ★★ 왜 **색을 구워** 넣는가 — `setTint` 를 쓰지 않은 이유
 * ══════════════════════════════════════════════════════════════════
 * 이 저장소는 저사양 기기에서 일부러 **CANVAS 로 부팅한다**
 * (`game/device.js:IS_LOW_END` → `Phaser.CANVAS`). Canvas 렌더러의
 * BitmapText 는 글리프를 `drawImage` 로 찍으므로 **틴트가 반영되지 않는다.**
 * 틴트로 구현하면 하필 그 기기에서만 데미지 타입 색이 통째로 사라진다 —
 * 상성은 이 게임의 부가 정보가 아니라 규칙이다.
 * (`UnitPresenter` 가 외곽선을 `postFX.addGlow` 대신 실루엣으로 만든 것과
 *  **같은 판단**이다. 두 갈래로 나누면 한쪽은 아무도 굴려 보지 않는다.)
 *
 * 그래서 색마다 한 줄씩 구워 **폰트를 색 수만큼 등록한다.** 색을 바꾸는 것은
 * `setFont(key)` 한 번이고, 텍스처는 여섯 줄이 **하나를 공유**한다 —
 * 드로우콜은 늘지 않는다.
 *
 * ★ 굽는 비용은 실측 **1.9ms**, 전투당 한 번이다. `textures`·`cache` 는 게임
 *   전역이므로 두 번째 전투부터는 0 이다.
 *
 * ★ 필터는 LINEAR 다. 크기(16·20·26·28)를 한 장에서 축소해 쓰는데 NEAREST 로
 *   내리면 가장자리가 톱니가 된다. 지금까지 `Text` 가 그리던 것도 브라우저가
 *   안티에일리어싱한 TTF 였으므로 **보이는 것은 달라지지 않는다.**
 *
 * @see docs/03-tech/26-performance-budget.md §10-B
 */
import { PIXEL_FONT } from "../config.js";

/**
 * `Phaser.Textures.FilterMode.LINEAR`.
 *
 * ★ 숫자로 적는다. 이 모듈이 `phaser` 를 import 하면 상수 하나 때문에 테스트가
 *   브라우저 환경을 요구하게 된다 (`vitest environment: node`) — `fx/quality.js` 가
 *   `config.js` 대신 `device.js` 를 보는 것과 같은 이유다.
 */
const FILTER_LINEAR = 1;

/** 구울 때의 기준 크기. `show()` 가 쓰는 최대 크기(28)보다 작으면 확대가 된다 */
export const BAKE_SIZE = 32;
/** 글리프 사이 여백 — LINEAR 필터가 이웃 글리프를 빨아들이지 않게 */
const PAD = 2;
/** 줄 높이 = 기준 크기 × 이 값. 한글 받침까지 잘리지 않을 만큼 */
const LINE_RATIO = 1.3;

/** 폰트 키는 색 인덱스로 만든다 — 색을 바꾸는 것이 곧 폰트를 바꾸는 것이다 */
export const damageFontKey = (colorIndex) => `dmgfont:${colorIndex}`;

/**
 * 색 목록만큼 폰트를 굽고 `cache.bitmapFont` 에 등록한다.
 *
 * ★ 이미 구워져 있으면 아무 일도 하지 않는다 — 텍스처도 폰트 캐시도 **게임
 *   전역**이라 씬을 다시 들어와도 남아 있다 (`registerProjectileAnims` 가
 *   `anims.exists` 를 보는 것과 같은 이유).
 *
 * ★★★ **두 언어의 글자를 한 장에 함께 굽는다** (2026-08-07). 폰트는 전투 시작에
 *   한 번 구워지고 텍스처·폰트 캐시는 **게임 전역**이라 다시 굽히지 않는다. 그런데
 *   언어는 설정에서 **전투 밖에서 언제든** 바뀐다 — 현재 언어의 글자만 구우면,
 *   한국어로 한 판 돈 뒤 영어로 바꾼 다음 판에서 `WEAK!` 의 A–Z 가 폰트에 없다.
 *   그리고 Phaser BitmapText 는 **없는 글자를 경고 없이 건너뛴다** — 데미지 숫자가
 *   조용히 사라진다. 그래서 호출부(`DamageTextPool.DAMAGE_GLYPHS`)가 `LANGS` 전량을
 *   돌아 글자를 모으고, 여기서는 받은 것을 전부 굽는다.
 *
 * @param {Phaser.Scene} scene
 * @param {string} chars 이 폰트가 그릴 수 있어야 하는 문자 전부 (**두 언어 합집합**)
 * @param {string[]} colors CSS 색 문자열 배열. 인덱스가 곧 폰트 키다
 * @returns {boolean} 실제로 구웠는가 (테스트·계측용)
 */
export function bakeDamageFont(scene, chars, colors) {
    const texKey = "dmgfont";
    if (scene.textures.exists(texKey) && scene.cache.bitmapFont.exists(damageFontKey(0))) {
        return false;
    }

    /**
     * ★ 폰트가 아직 안 실려 있으면 폴백(monospace)의 자형이 구워진다.
     *   `index.css` 의 `@font-face` 가 `font-display: block` 이고 전투에 오기까지
     *   타이틀·방주·출격 화면이 전부 이 폰트로 글자를 그리므로 실제로는 언제나
     *   실려 있다. 그래도 소리 없이 틀린 그림이 남는 것보다는 경고가 낫다.
     */
    if (globalThis.document?.fonts && !document.fonts.check(`${BAKE_SIZE}px ${PIXEL_FONT}`)) {
        console.warn("[dmgfont] pixel font not loaded yet — baking with the fallback face");
    }

    const glyphs = [...chars];
    const font = `${BAKE_SIZE}px "${PIXEL_FONT}", monospace`;
    const lineHeight = Math.ceil(BAKE_SIZE * LINE_RATIO);

    // ① 폭을 먼저 잰다 — 텍스처 크기를 알아야 만들 수 있다
    const probe = globalThis.document.createElement("canvas").getContext("2d");
    probe.font = font;
    const widths = glyphs.map((c) => Math.max(1, Math.ceil(probe.measureText(c).width)));
    const width = widths.reduce((a, w) => a + w + PAD, 0);
    const height = colors.length * (lineHeight + PAD);

    // ② 색마다 한 줄씩 찍는다
    const tex = scene.textures.createCanvas(texKey, width, height);
    if (!tex) return false;
    const ctx = tex.getContext();
    ctx.font = font;
    ctx.textBaseline = "top";

    for (let ci = 0; ci < colors.length; ci++) {
        const rowY = ci * (lineHeight + PAD);
        ctx.fillStyle = colors[ci];

        const chars2 = {};
        let x = 0;
        for (let gi = 0; gi < glyphs.length; gi++) {
            const w = widths[gi];
            ctx.fillText(glyphs[gi], x, rowY);
            /**
             * Phaser 의 비트맵 폰트 글리프 규격 (`ParseXMLBitmapFont` 와 같은 모양).
             *
             * ★★★ **`u0/v0/u1/v1` 을 빼면 아무것도 그려지지 않는다.**
             *   `BatchChar` 가 이 네 값을 그대로 정점에 싣는다 — 없으면 UV 가
             *   `undefined` 라 사각형은 배치에 들어가지만 화면에는 **아무 픽셀도
             *   남지 않는다.** 예외도 경고도 없고, `width`·`height`·`bounds` 는
             *   전부 정상으로 보인다. 실제로 그 상태를 한 번 만들었다 (2026-08-05).
             */
            chars2[glyphs[gi].charCodeAt(0)] = {
                x,
                y: rowY,
                width: w,
                height: lineHeight,
                centerX: Math.floor(w / 2),
                centerY: Math.floor(lineHeight / 2),
                xOffset: 0,
                yOffset: 0,
                xAdvance: w,
                data: {},
                kerning: {},
                u0: x / width,
                v0: rowY / height,
                u1: (x + w) / width,
                v1: (rowY + lineHeight) / height,
            };
            x += w + PAD;
        }

        scene.cache.bitmapFont.add(damageFontKey(ci), {
            data: {
                font: damageFontKey(ci),
                size: BAKE_SIZE,
                lineHeight,
                retroFont: false,
                chars: chars2,
            },
            texture: texKey,
            frame: null,
        });
    }

    tex.refresh();
    // ★ 축소해 쓰므로 LINEAR. NEAREST 로 두면 16px 저항 표기가 톱니가 된다
    tex.setFilter?.(FILTER_LINEAR);
    return true;
}
