/**
 * 오디오 인코딩 — asset/bgm/*.mp3 → public/assets/audio/*.{ogg,m4a}
 *
 * 원본 MP3 를 그대로 쓰면 수십 MB 다. 게임 BGM 은 96kbps 모노로 충분하고,
 * OGG(주) + M4A(iOS 폴백) 2포맷을 내보내면 Phaser 가 알아서 고른다.
 *
 * 사용:
 *   npm run assets:audio
 *
 * @see docs/03-tech/23-asset-pipeline.md §4
 * @see docs/02-design/19-art-audio-direction.md §6.4
 */
import { execFile } from "node:child_process";
import { readdir, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";

const run = promisify(execFile);

const SRC = "asset/bgm";
const OUT = "public/assets/audio";

/** BGM 96kbps 모노 / SFX 64kbps 모노 */
const BITRATE = "96k";

/**
 * 파일명 정규화.
 * 공백·괄호·대문자를 제거해 URL 과 코드에서 안전한 키로 만든다.
 */
const slug = (name) =>
    name
        .toLowerCase()
        .replace(/\.mp3$/, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

/** 원본에 중복이 하나 있다 (soundreality-...-471495 (1).mp3) */
const isDuplicate = (name) => /\(\d+\)\./.test(name);

const fmtKB = (n) => `${(n / 1024).toFixed(0)}KB`;

async function encode(src, dest, args) {
    await run(ffmpegPath, ["-y", "-loglevel", "error", "-i", src, ...args, dest]);
    return (await stat(dest)).size;
}

async function main() {
    await rm(OUT, { recursive: true, force: true });
    await mkdir(OUT, { recursive: true });

    const entries = (await readdir(SRC)).filter((f) => f.toLowerCase().endsWith(".mp3")).sort();

    console.log("── 오디오 인코딩 ──────────────────────────────");
    let srcBytes = 0;
    let outBytes = 0;
    let skipped = 0;
    const index = {};

    for (const file of entries) {
        if (isDuplicate(file)) {
            console.log(`↷ ${file}  (중복, 건너뜀)`);
            skipped++;
            continue;
        }

        const src = path.join(SRC, file);
        const key = slug(file);
        srcBytes += (await stat(src)).size;

        const ogg = await encode(src, path.join(OUT, `${key}.ogg`), [
            "-ac", "1",
            "-b:a", BITRATE,
            "-c:a", "libvorbis",
        ]);
        const m4a = await encode(src, path.join(OUT, `${key}.m4a`), [
            "-ac", "1",
            "-b:a", BITRATE,
            "-c:a", "aac",
        ]);

        outBytes += ogg + m4a;
        index[key] = { source: file };
        console.log(`✔ ${key.padEnd(48)} ogg ${fmtKB(ogg).padStart(6)}  m4a ${fmtKB(m4a).padStart(6)}`);
    }

    // 키 목록을 코드에서 참조할 수 있게 남긴다
    await writeFile(path.join(OUT, "index.json"), JSON.stringify(index, null, 2));

    const count = entries.length - skipped;
    console.log("───────────────────────────────────────────────");
    console.log(
        `${count}곡 × 2포맷 | 원본 ${fmtKB(srcBytes)} → 출력 ${fmtKB(outBytes)} ` +
            `(${((1 - outBytes / srcBytes) * 100).toFixed(0)}% 절감)`
    );
}

main().catch((e) => {
    console.error(e.stderr?.toString() ?? e);
    process.exit(1);
});
