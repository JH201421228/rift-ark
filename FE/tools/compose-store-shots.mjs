import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STORE = path.join(ROOT, "asset", "generated", "store");

function readLanguage() {
    const index = process.argv.indexOf("--lang");
    const lang = index < 0 ? "ko" : process.argv[index + 1];
    if (lang !== "ko" && lang !== "en") {
        throw new Error(`--lang 는 ko 또는 en 이어야 한다 (현재 ${JSON.stringify(lang)})`);
    }
    return lang;
}

const LANG = readLanguage();
const LANGUAGE_ROOT = LANG === "ko" ? STORE : path.join(STORE, "en");
const RAW = path.join(LANGUAGE_ROOT, "raw");

const SETS = [
    {
        rawPrefix: "play",
        outputDir: path.join(LANGUAGE_ROOT, "play"),
        outputName: (id) => `play-screenshot-${id}.png`,
        source: { width: 3840, height: 2160 },
        target: { width: 1920, height: 1080 },
    },
    {
        rawPrefix: "ios-69",
        outputDir: path.join(LANGUAGE_ROOT, "ios"),
        outputName: (id) => `ios-69-${id}.png`,
        source: { width: 4692, height: 2160 },
        target: { width: 2868, height: 1320 },
    },
    /**
     * ★★★ **6.5형도 함께 뽑는다** (2026-08-10).
     *
     *   App Store Connect 의 업로드 슬롯이 6.9형(2868×1320)과 **6.5형**을 따로
     *   요구하고, 6.5형 슬롯은 `2688×1242` 또는 `2778×1284` 만 받는다.
     *   6.9형 이미지를 그 칸에 끌어다 놓으면 **크기가 다르다고 거부된다** —
     *   화면이 어느 칸을 보여 주는지는 계정·시점에 따라 다르므로 **양쪽을 다
     *   가지고 있는 것이 유일하게 안전한 상태**다.
     *
     * ★ `raw/` 가 4692×2160 고해상도라 **게임을 다시 촬영하지 않는다.**
     *   같은 원본에서 크기만 다르게 줄인다 — 두 세트의 그림이 같다는 것이
     *   구조적으로 보장된다. (따로 촬영하면 시드·프레임이 달라진다.)
     *
     * ⚠ 종횡비가 정확히 같지 않다: 원본 2.1722 · 6.9형 2.1727 · **6.5형 2.1636**.
     *   `fit: "fill"` 이라 6.5형은 가로가 **0.4% 눌린다.** 6.9형의 0.02% 보다는
     *   크지만 눈으로 구분되지 않는 값이고, 잘라내면 카피가 가장자리에서 잘릴
     *   위험이 있어 **누르는 쪽을 택했다.**
     */
    {
        rawPrefix: "ios-69",
        outputDir: path.join(LANGUAGE_ROOT, "ios"),
        outputName: (id) => `ios-65-${id}.png`,
        source: { width: 4692, height: 2160 },
        target: { width: 2778, height: 1284 },
    },
];

function resizeOptions(source, target) {
    const enlarging = target.width > source.width || target.height > source.height;
    if (!enlarging) return { width: target.width, height: target.height, fit: "fill" };

    const scaleX = target.width / source.width;
    const scaleY = target.height / source.height;
    if (!Number.isInteger(scaleX) || scaleX !== scaleY) {
        throw new Error(
            `비정수 확대 금지: ${source.width}x${source.height} -> ${target.width}x${target.height}`
        );
    }
    return {
        width: target.width,
        height: target.height,
        fit: "fill",
        kernel: sharp.kernel.nearest,
    };
}

async function composeOne(set, id) {
    const input = path.join(RAW, `${set.rawPrefix}-${id}.png`);
    const output = path.join(set.outputDir, set.outputName(id));
    const metadata = await sharp(input).metadata();
    if (metadata.width !== set.source.width || metadata.height !== set.source.height) {
        throw new Error(
            `${path.basename(input)} 원본 크기 오류: ${metadata.width}x${metadata.height}, ` +
                `기대 ${set.source.width}x${set.source.height}`
        );
    }

    await sharp(input)
        .resize(resizeOptions(set.source, set.target))
        .toColourspace("srgb")
        .ensureAlpha(1)
        .png({ compressionLevel: 9, palette: false })
        .toFile(output);
    console.log(`[compose] ${path.relative(ROOT, output)}`);
}

for (const set of SETS) {
    await mkdir(set.outputDir, { recursive: true });
    for (let id = 1; id <= 8; id++) await composeOne(set, id);
}

console.log(`[compose:${LANG}] Play 8장 + iOS 6.9형 8장 + iOS 6.5형 8장 리사이즈 완료`);
