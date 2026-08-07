/**
 * 앱 아이콘 · 스플래시 생성기
 *
 * ★★★ **아이콘이 4개월 동안 Capacitor 기본값이었다** (2026-08-07).
 *   흰 배경에 청록색 안드로이드 벡터, 스플래시는 하늘색 X 자. 스토어에 그대로
 *   올리면 "미완성 앱"으로 읽히고, 실제로 구글플레이 심사에서 자주 지적되는
 *   항목이다. 그리고 이것은 **디자인 문제가 아니라 배선 문제**다 — 아무도
 *   `android/app/src/main/res/mipmap-*` 를 건드린 적이 없었다.
 *
 * ★★ **그림을 저장소에 던져 넣지 않고 스크립트로 만든다.** 이 저장소의 규약은
 *   "출처를 알 수 없는 산출물을 두지 않는다"이다 (에셋 라이선스 · ATTRIBUTIONS).
 *   아이콘은 게임이 이미 쓰는 스프라이트 **하나**에서 온다:
 *
 *     public/assets/structures/rift-idle.png  (균열 — 8프레임 중 가장 밝은 프레임)
 *
 *   즉 아이콘에 그려진 것은 **게임 안에 실제로 있는 것**이다. 스토어 심사가
 *   "스크린샷·아이콘이 실제 게임과 다르다"로 반려하는 경로를 원천적으로 막는다.
 *
 * ★★★ **균열 하나만 그린다** (2026-08-07, 사용자 결정 — "그냥 균열만 있는게 보기 좋다").
 *
 *   처음에는 균열 + 금색 방주 실루엣 + 발밑 레인 세 줄을 한 칸에 넣었다. 셋 다
 *   게임의 사실이지만, 런처 아이콘이 실제로 보이는 크기는 **48dp** 다. 그 크기에서
 *   요소가 셋이면 어느 것도 읽히지 않고 "복잡한 얼룩"이 된다 — 아이콘은 설명이
 *   아니라 **표식**이고, 표식은 모양이 하나여야 멀리서 구분된다.
 *   균열은 이 게임에서 가장 강한 단일 형태다: 뾰족한 보라 마름모, 대칭, 고대비.
 *
 * ★ 색은 하드코딩이 아니라 게임 팔레트에서 온다 (아래 PALETTE 주석 참조).
 *
 * ★★ **적응형 아이콘의 안전 영역을 지킨다.** 안드로이드 8+ 는 108dp 중 **가운데
 *   72dp** 만 보이도록 마스크를 씌운다(원·스퀘어클·물방울 — 제조사마다 다르다).
 *   전경 그림을 108dp 에 꽉 채우면 픽셀 원의 뾰족한 끝이 **잘린다.** 그래서
 *   전경은 `SAFE_RATIO` 안에만 그린다.
 *
 * 사용:
 *   node tools/gen-app-icons.mjs          # 생성
 *   node tools/gen-app-icons.mjs --check  # 존재·크기만 검사 (CI)
 */
import sharp from "sharp";
import { mkdir, writeFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RES = join(ROOT, "android/app/src/main/res");
const OUT_STORE = join(ROOT, "resources");

/**
 * 게임 팔레트.
 * ★ 값의 정본은 `capacitor.config.json:android.backgroundColor`(#0f0f1e) 와
 *   `src/index.css` 의 금색(#f2b33d) · 균열 보라(#b45ad6)다. 여기서 바꾸면
 *   앱 배경과 아이콘 배경이 갈라진다 — 스플래시에서 특히 눈에 띈다.
 */
const PALETTE = {
    bgTop: "#161334",
    bgBottom: "#0b0b18",
    gold: "#f2b33d",
    goldDim: "#8a6320",
    rift: "#b45ad6",
};

/** 적응형 아이콘 전경이 차지해도 되는 비율 (108dp 중 72dp) */
const SAFE_RATIO = 72 / 108;

/** 안드로이드 런처 아이콘 밀도별 픽셀 크기 */
const MIPMAP = [
    ["mipmap-mdpi", 48, 108],
    ["mipmap-hdpi", 72, 162],
    ["mipmap-xhdpi", 96, 216],
    ["mipmap-xxhdpi", 144, 324],
    ["mipmap-xxxhdpi", 192, 432],
];

const RIFT_SHEET = join(ROOT, "public/assets/structures/rift-idle.png");
const ARK_SPRITE = join(ROOT, "public/assets/structures/ark-100.png");
/** 균열 시트에서 가장 밝은 프레임 (0-based). 8프레임 × 192px */
const RIFT_FRAME = 4;
const RIFT_FRAME_W = 192;
const RIFT_FRAME_H = 480;

/* ────────────────────────── 조각 ────────────────────────── */

/**
 * 배경 — 세로 그라디언트 + 균열빛 라디얼 (그림 없이 SVG 하나).
 * ★ 가로/세로를 따로 받는다. 스플래시는 정사각이 아니고, `composite` 는 캔버스보다
 *   **큰 입력을 거부한다** — 한 변으로 만들어 얹으면 그 자리에서 던진다.
 */
function backgroundSvg(w, h = w) {
    return Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${PALETTE.bgTop}"/>
      <stop offset="100%" stop-color="${PALETTE.bgBottom}"/>
    </linearGradient>
    <radialGradient id="r" cx="50%" cy="44%" r="46%">
      <stop offset="0%" stop-color="${PALETTE.rift}" stop-opacity="0.42"/>
      <stop offset="100%" stop-color="${PALETTE.rift}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <rect width="${w}" height="${h}" fill="url(#r)"/>
</svg>`);
}

/**
 * 균열 프레임 하나를 잘라 원하는 크기로 키운다 (픽셀 아트 → nearest).
 *
 * ★ 원본은 1:2.5 로 **가늘다.** 전장에서는 배경 구조물이라 그래도 되지만 아이콘에서는
 *   가운데의 실 한 줄이 된다. 가로만 늘려 굵은 마름모로 만든다 (`widen`) —
 *   픽셀 아트라 nearest 로 늘리면 계단이 그대로 커져 오히려 스타일에 맞는다.
 */
async function riftLayer(height, widen = 1) {
    const h = Math.round(height);
    const w = Math.round((RIFT_FRAME_W / RIFT_FRAME_H) * h * widen);
    return sharp(RIFT_SHEET)
        .extract({ left: RIFT_FRAME * RIFT_FRAME_W, top: 0, width: RIFT_FRAME_W, height: RIFT_FRAME_H })
        .resize({ width: w, height: h, fit: "fill", kernel: "nearest" })
        .png()
        .toBuffer();
}

/**
 * 균열 하나를 캔버스 가운데 놓는다.
 * @param {number} size       캔버스 한 변
 * @param {number} heightRatio 캔버스 대비 균열 높이
 */
async function riftOnCanvas(size, heightRatio) {
    /**
     * ★ `widen` 으로 가로를 늘려 굵은 마름모로 만든다. 원본은 1:2.5 로 가늘어서
     *   그대로 두면 48dp 에서 **실 한 줄**이 된다.
     */
    const rift = await riftLayer(size * heightRatio, 1.9);
    const m = await sharp(rift).metadata();
    return sharp({
        create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
        .composite([
            {
                input: rift,
                left: Math.round(size / 2) - Math.round(m.width / 2),
                top: Math.round(size / 2) - Math.round(m.height / 2),
            },
        ])
        .png()
        .toBuffer();
}

/**
 * 적응형 아이콘의 `foreground`.
 *
 * ★★ **안전 영역(108dp 중 72dp) 안에만 그린다.** 제조사 마스크가 원·스퀘어클·
 *   물방울로 제각각이라, 꽉 채우면 픽셀 균열의 **뾰족한 위아래 끝이 잘린다.**
 *   96% 를 쓰는 것은 그 끝에 한 픽셀의 여유를 더 주기 위해서다.
 */
async function foregroundPng(size) {
    return riftOnCanvas(size, SAFE_RATIO * 0.96);
}

/**
 * 레거시 런처 아이콘과 **스토어 원본**이 쓰는 비율.
 *
 * ★★ 적응형과 달리 이쪽에는 마스크 안전 영역이 없다 — 보이는 그대로 나간다.
 *   그래서 **더 크게 그린다.** 안전 영역 비율(0.64)을 그대로 쓰면 512×512 스토어
 *   아이콘에서 균열이 가운데 작게 떠 있어 **여백이 주인공**이 된다.
 */
const FULL_RATIO = 0.82;

/** 배경까지 합친 완성 아이콘 (레거시 런처 · 스토어 512/1024 용) */
async function fullIcon(size, { round = false } = {}) {
    const fg = await riftOnCanvas(size, FULL_RATIO);
    let img = sharp(backgroundSvg(size)).composite([{ input: fg }]);

    if (round) {
        const r = size / 2;
        const mask = Buffer.from(
            `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><circle cx="${r}" cy="${r}" r="${r}" fill="#fff"/></svg>`
        );
        img = sharp(await img.png().toBuffer()).composite([{ input: mask, blend: "dest-in" }]);
    }
    return img.png().toBuffer();
}

/**
 * 스플래시 — 아이콘과 같은 재료로 만들되 **가로 화면**을 전제한다.
 * ★ 이 게임은 가로 고정이다. Capacitor 기본 스플래시(정사각 480×320 하늘색 X)는
 *   방향도 색도 앱과 맞지 않아, 실행 첫 0.5초가 다른 앱처럼 보였다.
 */
async function splashPng(width, height) {
    const short = Math.min(width, height);
    const rift = await riftLayer(short * 0.52, 1.9);
    const rm = await sharp(rift).metadata();

    return sharp(backgroundSvg(width, height))
        .composite([
            {
                input: rift,
                left: Math.round(width / 2) - Math.round(rm.width / 2),
                top: Math.round(height / 2) - Math.round(rm.height / 2),
            },
        ])
        .png()
        .toBuffer();
}

/* ────────────────────────── 실행 ────────────────────────── */

/** 안드로이드 스플래시 밀도 — Capacitor 가 만들어 둔 폴더 구성을 그대로 채운다 */
const SPLASH = [
    ["drawable", 480, 320],
    ["drawable-land-mdpi", 480, 320],
    ["drawable-land-hdpi", 800, 480],
    ["drawable-land-xhdpi", 1280, 720],
    ["drawable-land-xxhdpi", 1600, 960],
    ["drawable-land-xxxhdpi", 1920, 1280],
    ["drawable-port-mdpi", 320, 480],
    ["drawable-port-hdpi", 480, 800],
    ["drawable-port-xhdpi", 720, 1280],
    ["drawable-port-xxhdpi", 960, 1600],
    ["drawable-port-xxxhdpi", 1280, 1920],
];

async function main() {
    const check = process.argv.includes("--check");

    if (check) {
        let bad = 0;
        for (const [dir, legacy, adaptive] of MIPMAP) {
            for (const [name, want] of [
                ["ic_launcher.png", legacy],
                ["ic_launcher_round.png", legacy],
                ["ic_launcher_foreground.png", adaptive],
            ]) {
                const p = join(RES, dir, name);
                try {
                    await access(p);
                    const m = await sharp(p).metadata();
                    if (m.width !== want || m.height !== want) {
                        console.error(`✗ ${dir}/${name} ${m.width}×${m.height} (기대 ${want}×${want})`);
                        bad++;
                    }
                } catch {
                    console.error(`✗ ${dir}/${name} 없음`);
                    bad++;
                }
            }
        }
        if (bad) {
            console.error(`\n아이콘 ${bad}건 불일치 — node tools/gen-app-icons.mjs 로 다시 만들라`);
            process.exit(1);
        }
        console.log("아이콘 전 밀도 확인 — 정상");
        return;
    }

    await mkdir(OUT_STORE, { recursive: true });

    // ── 런처 아이콘 ──
    for (const [dir, legacy, adaptive] of MIPMAP) {
        const d = join(RES, dir);
        await mkdir(d, { recursive: true });
        await writeFile(join(d, "ic_launcher.png"), await fullIcon(legacy));
        await writeFile(join(d, "ic_launcher_round.png"), await fullIcon(legacy, { round: true }));
        await writeFile(join(d, "ic_launcher_foreground.png"), await foregroundPng(adaptive));
        console.log(`  ${dir}  ${legacy}px / 전경 ${adaptive}px`);
    }

    // ── 스플래시 ──
    for (const [dir, w, h] of SPLASH) {
        const d = join(RES, dir);
        await mkdir(d, { recursive: true });
        await writeFile(join(d, "splash.png"), await splashPng(w, h));
    }
    console.log(`  스플래시 ${SPLASH.length}종`);

    // ── 스토어 · iOS 원본 ──
    // ★ 512(구글플레이) · 1024(앱스토어) 는 **알파가 없어야 한다**. 알파가 있으면
    //   업로드 단계에서 그대로 반려된다 (앱스토어 커넥트).
    await writeFile(
        join(OUT_STORE, "icon-512.png"),
        await sharp(await fullIcon(512)).flatten({ background: "#0b0b18" }).png().toBuffer()
    );
    await writeFile(
        join(OUT_STORE, "icon-1024.png"),
        await sharp(await fullIcon(1024)).flatten({ background: "#0b0b18" }).png().toBuffer()
    );
    await writeFile(join(OUT_STORE, "icon-foreground-1024.png"), await foregroundPng(1024));
    await writeFile(join(OUT_STORE, "splash-2732.png"), await splashPng(2732, 2732));
    console.log("  resources/ 에 스토어 원본 4종");

    console.log("\n완료. `npx cap sync android` 는 아이콘을 덮어쓰지 않는다 (res/ 는 그대로 둔다).");
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
