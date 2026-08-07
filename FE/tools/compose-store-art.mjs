import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STORE = path.join(ROOT, "asset", "generated", "store");
const EN = path.join(STORE, "en");

const PLAY_ICON_SOURCE = path.join(ROOT, "resources", "icon-512.png");
const PLAY_ICON_OUTPUT = path.join(STORE, "icon-512.png");
const FEATURE_BACKGROUND = path.join(STORE, "play-feature-graphic.png");
const EN_LOGO = path.join(STORE, "logo-en.png");
const EN_FEATURE_OUTPUT = path.join(EN, "play-feature-graphic-en.png");

async function makePlayIcon() {
    await sharp(PLAY_ICON_SOURCE)
        .resize(512, 512, { fit: "fill" })
        .toColourspace("srgb")
        // Play 요구: PNG-32 알파 채널 포함, 모든 픽셀은 불투명.
        .ensureAlpha(1)
        .png({ compressionLevel: 9, palette: false })
        .toFile(PLAY_ICON_OUTPUT);
}

async function makeEnglishFeature() {
    const logo = await sharp(EN_LOGO)
        // 문서 54 §3.3: 축소는 Lanczos. sharp 기본 커널이 Lanczos3다.
        .resize({ width: 340 })
        .png({ palette: false })
        .toBuffer();

    await sharp(FEATURE_BACKGROUND)
        .resize(1024, 500, { fit: "fill" })
        .composite([{ input: logo, left: 56, top: 52 }])
        .flatten({ background: "#0f0f1e" })
        .removeAlpha()
        .toColourspace("srgb")
        .png({ compressionLevel: 9, palette: false })
        .toFile(EN_FEATURE_OUTPUT);
}

async function assertImage(file, expected) {
    const image = sharp(file);
    const [info, stats, fileStat] = await Promise.all([image.metadata(), image.stats(), stat(file)]);
    if (info.width !== expected.width || info.height !== expected.height) {
        throw new Error(`${path.basename(file)} 크기 오류: ${info.width}x${info.height}`);
    }
    if (info.space !== "srgb") throw new Error(`${path.basename(file)} sRGB가 아니다`);
    if (expected.channels && info.channels !== expected.channels) {
        throw new Error(`${path.basename(file)} 채널 오류: ${info.channels}`);
    }
    if (expected.opaque && info.hasAlpha && stats.channels[3]?.min !== 255) {
        throw new Error(`${path.basename(file)} 에 투명/반투명 픽셀이 있다`);
    }
    if (expected.maxBytes && fileStat.size > expected.maxBytes) {
        throw new Error(`${path.basename(file)} 용량 초과: ${fileStat.size} bytes`);
    }
    console.log(
        `[store:art] ${path.relative(ROOT, file)} ${info.width}x${info.height} ` +
            `${info.channels}ch ${(fileStat.size / 1024).toFixed(0)}KiB`
    );
}

await mkdir(EN, { recursive: true });
await makePlayIcon();
await makeEnglishFeature();
await assertImage(PLAY_ICON_OUTPUT, {
    width: 512,
    height: 512,
    channels: 4,
    opaque: true,
    maxBytes: 1024 * 1024,
});
await assertImage(EN_FEATURE_OUTPUT, {
    width: 1024,
    height: 500,
    channels: 3,
    opaque: true,
});

console.log("[store:art] Play 512 아이콘 + 영문 피처 그래픽 완료");
