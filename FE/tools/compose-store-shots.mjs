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

console.log(`[compose:${LANG}] Play 8장 + iOS 6.9형 8장 리사이즈 완료`);
