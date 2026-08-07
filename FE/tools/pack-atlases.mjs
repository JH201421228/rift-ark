/**
 * 아틀라스 패킹 — asset/ → public/assets/
 *
 * 낱장 PNG 7,471개를 그대로 로드하면 드로우콜과 HTTP 요청이 폭발한다.
 * 모바일 GPU 는 단일 텍스처 바인딩 + 배치 정점에 최적화되어 있으므로
 * 아틀라스화가 이 프로젝트 최대의 성능 레버다.
 *
 * 사용:
 *   npm run assets:pack
 *
 * @see docs/03-tech/23-asset-pipeline.md
 */
// ★ default export 는 콜백 기반 packer 다. Promise 판은 named export 를 써야 한다.
import { packAsync } from "free-tex-packer-core";
import sharp from "sharp";
import { readFile, writeFile, mkdir, rm, cp, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { collectPngs, sliceFile, sliceWarnings } from "./lib/slice.mjs";

const SRC = "asset";
const OUT = "public/assets";
const ATLAS_OUT = path.join(OUT, "atlas");

/** 전 그룹 공통 패킹 옵션 */
const COMMON = {
    powerOfTwo: true,
    // 픽셀아트에서 회전은 디버깅을 어렵게만 한다
    allowRotation: false,
    allowTrim: true,
    // 동일 프레임 중복 제거 — 4프레임 아이들 루프에 중복이 흔하다
    detectIdentical: true,
    // ★ 패딩 2px 은 선택이 아니다. 비정수 배율에서 인접 프레임이 새어 나온다.
    padding: 2,
    extrude: 0,
    // 이 둘은 함께 켜야 "AcidAnt/0" 같은 깔끔한 프레임 이름이 나온다 (slice.mjs 주석 참조)
    removeFileExtension: true,
    prependFolderName: true,
    exporter: "Phaser3",
};

const fmtKB = (n) => `${(n / 1024).toFixed(0)}KB`;

async function buildGroup(group) {
    const files = [];

    for (const src of group.sources) {
        const paths = await collectPngs(path.join(SRC, src.dir), {
            exclude: src.exclude ?? [],
            include: src.include ?? [],
        });
        if (!paths.length) {
            console.warn(`  ⚠ ${src.dir}: 대상 파일 0개`);
            continue;
        }
        for (const f of paths) {
            files.push(...(await sliceFile(f, src)));
        }
    }

    if (!files.length) {
        console.warn(`✗ ${group.name}: 프레임 0개 — 건너뜁니다`);
        return null;
    }

    const size = group.maxSize ?? 2048;
    const packed = await packAsync(files, {
        ...COMMON,
        width: size,
        height: size,
        textureName: group.name,
    });

    let bytes = 0;
    for (const f of packed) {
        await writeFile(path.join(ATLAS_OUT, f.name), f.buffer);
        bytes += f.buffer.length;
    }

    const pages = packed.filter((f) => f.name.endsWith(".png"));
    const dims = [];
    for (const p of pages) {
        const m = await sharp(p.buffer).metadata();
        dims.push(`${m.width}×${m.height}`);
    }

    console.log(
        `✔ ${group.name.padEnd(14)} ${String(files.length).padStart(4)} 프레임 → ` +
            `${pages.length} 페이지 [${dims.join(", ")}] ${fmtKB(bytes)}`
    );

    return { name: group.name, frames: files.length, pages: pages.length, bytes, dims };
}

/**
 * 균일 그리드 시트를 다른 열 수로 재배치한다.
 *
 * 읽기 순서(좌→우, 상→하)를 보존하므로 **프레임 인덱스가 바뀌지 않는다.**
 * GPU 텍스처 상한 2048 을 넘는 세로로 긴 시트를 구제하는 용도.
 */
async function reshapeSheet(from, to, [cw, ch], cols) {
    const src = sharp(from);
    const m = await src.metadata();
    const srcCols = Math.floor(m.width / cw);
    const srcRows = Math.floor(m.height / ch);
    const cells = srcCols * srcRows;

    const rows = Math.ceil(cells / cols);
    const width = cols * cw;
    const height = rows * ch;

    const buf = await readFile(from);
    const composites = [];
    for (let i = 0; i < cells; i++) {
        const sx = (i % srcCols) * cw;
        const sy = Math.floor(i / srcCols) * ch;
        const input = await sharp(buf)
            .extract({ left: sx, top: sy, width: cw, height: ch })
            .png()
            .toBuffer();
        composites.push({ input, left: (i % cols) * cw, top: Math.floor(i / cols) * ch });
    }

    await sharp({
        create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
        .composite(composites)
        .png()
        .toFile(to);

    return { width, height, cells };
}

async function main() {
    const manifest = JSON.parse(await readFile("tools/atlas-manifest.json", "utf8"));

    await rm(OUT + "/atlas", { recursive: true, force: true });
    await rm(OUT + "/sheets", { recursive: true, force: true });
    await mkdir(ATLAS_OUT, { recursive: true });
    await mkdir(path.join(OUT, "sheets"), { recursive: true });

    console.log("── 아틀라스 패킹 ──────────────────────────────");
    const results = [];
    for (const group of manifest.groups) {
        results.push(await buildGroup(group));
    }

    // ── 폴더 통째 복사 (배경·구조물) ──
    // 아틀라스에 넣지 않는다: 배경은 1280 폭이라 페이지를 통째로 먹고,
    // 한 전투에 필요한 것은 한 월드 4장뿐이다 (월드별 지연 로드).
    if (manifest.passthrough?.length) {
        console.log("── 대형 이미지 복사 ───────────────────────────");
        for (const p of manifest.passthrough) {
            const from = path.join(SRC, p.from);
            const to = path.join(OUT, p.to);
            await rm(to, { recursive: true, force: true });
            await cp(from, to, { recursive: true });

            const names = (await readdir(to)).filter((f) => f.endsWith(".png"));
            let bytes = 0;
            for (const n of names) bytes += (await stat(path.join(to, n))).size;
            console.log(`✔ ${p.to.padEnd(22)} ${String(names.length).padStart(3)}장  ${fmtKB(bytes)}`);
        }
    }

    console.log("── 원본 시트 복사 ─────────────────────────────");
    const sheetDims = [];
    for (const c of manifest.copy ?? []) {
        const from = path.join(SRC, c.from);
        const to = path.join(OUT, c.to);
        await mkdir(path.dirname(to), { recursive: true });

        if (c.grid && c.cols) {
            const d = await reshapeSheet(from, to, c.grid, c.cols);
            sheetDims.push({ name: c.to, ...d });
            console.log(`✔ ${c.to.padEnd(22)} ${d.width}×${d.height}  (${d.cells}칸, ${c.cols}열로 재배치)`);
        } else {
            await cp(from, to);
            const m = await sharp(to).metadata();
            sheetDims.push({ name: c.to, width: m.width, height: m.height });
            console.log(`✔ ${c.to.padEnd(22)} ${m.width}×${m.height}`);
        }
    }

    const ok = results.filter(Boolean);
    const totalBytes = ok.reduce((s, r) => s + r.bytes, 0);
    const totalPages = ok.reduce((s, r) => s + r.pages, 0);
    const totalFrames = ok.reduce((s, r) => s + r.frames, 0);

    console.log("───────────────────────────────────────────────");
    console.log(`총 ${totalFrames} 프레임 / ${totalPages} 페이지 / ${fmtKB(totalBytes)}`);

    let failed = false;

    /**
     * ★★ 격자를 넘어온 이웃 그림 (lib/slice.mjs:findEdgeBleed).
     *   눈으로만 잡히던 종류의 결함이라 **빌드를 실패시킨다** — 아틀라스가
     *   한 번 나가면 그 뒤로는 "원래 저렇게 생긴 탄" 이 되어 버린다.
     */
    if (sliceWarnings.length) {
        for (const w of sliceWarnings) console.error(`✗ ${w}`);
        failed = true;
    }

    // 예산 검증 — docs/03-tech/26-performance-budget.md §3.2
    // WebGL 이 보장하는 MAX_TEXTURE_SIZE 는 2048 뿐이다. 초과하면 구형 기기에서 로드 실패.
    for (const r of ok) {
        for (const d of r.dims) {
            const [w, h] = d.split("×").map(Number);
            if (w > 2048 || h > 2048) {
                console.error(`✗ ${r.name}: 페이지 ${d} 가 2048 상한을 초과했습니다`);
                failed = true;
            }
        }
    }
    for (const s of sheetDims) {
        if (s.width > 2048 || s.height > 2048) {
            console.error(
                `✗ ${s.name}: ${s.width}×${s.height} 가 2048 상한을 초과했습니다. ` +
                    `manifest 의 copy 항목에 grid/cols 를 지정해 재배치하세요.`
            );
            failed = true;
        }
    }
    if (totalPages > 12) {
        console.error(`✗ 아틀라스 페이지 ${totalPages}개 — 상한 12개를 초과했습니다`);
        failed = true;
    }
    if (failed) process.exit(1);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
