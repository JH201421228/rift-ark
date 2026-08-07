/**
 * 스프라이트 소스 슬라이서
 *
 * 원본 에셋은 세 가지 형태로 들어온다:
 *   strip  — 가로 1줄 프레임 (monsters 64×16 = 16×16 4프레임)
 *   grid   — 2D 그리드 (NightBorne 1840×400 = 80×80 의 23×5)
 *   single — 파일 1개가 프레임 1개 (Bringer 개별 프레임)
 *
 * 전부 "이름 붙은 PNG 버퍼 목록"으로 정규화해서 패커에 넘긴다.
 *
 * @see docs/03-tech/23-asset-pipeline.md §3
 */
import sharp from "sharp";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

/**
 * ★ free-tex-packer 의 removeFileExtension 은 "마지막 점 이후를 제거"하는 방식이라
 *   점이 없는 이름을 통째로 빈 문자열로 만들어 버린다.
 *   따라서 프레임 경로에는 반드시 .png 를 붙여서 넘긴다.
 */
const withPng = (p) => (p.toLowerCase().endsWith(".png") ? p : `${p}.png`);

/** 디렉터리를 재귀 순회하며 png 경로를 모은다 */
export async function collectPngs(dir, { exclude = [], include = [] } = {}) {
    const out = [];
    async function walk(d) {
        let entries;
        try {
            entries = await readdir(d, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) {
                await walk(p);
                continue;
            }
            if (!e.name.toLowerCase().endsWith(".png")) continue;
            const rel = p.replace(/\\/g, "/");
            if (exclude.some((x) => rel.includes(x))) continue;
            if (include.length && !include.some((x) => rel.includes(x))) continue;
            out.push(p);
        }
    }
    if ((await stat(dir).catch(() => null))?.isDirectory()) await walk(dir);
    else out.push(dir);
    return out;
}

/**
 * ★★★ **격자를 넘어온 이웃 그림** 검출 (2026-08-05).
 *
 *   16px 격자로 자른 시트에는 위/아래 칸 그림의 가장자리 1px 이 넘어와 있는
 *   경우가 있다. 그대로 두면 **탄환 위에 가로 막대가 붙어** 날아간다.
 *
 * ★ 판정: **가장자리 줄이 절반 넘게 차 있는데 바로 안쪽 줄이 완전히 비었다.**
 *   진짜 그림은 긴 선을 긋고 한 줄 띄우지 않는다. 실제로 이 규칙으로
 *   `projectile` 시트를 훑어 행 1(열 0-4, 16/16px)과 행 4(열 6-9, 12/16px)
 *   둘을 찾았고, 그중 행 4 는 "13×15 라 칸을 거의 채운다"는 이유로
 *   **정상으로 오진**되어 그동안 십자 탄에 막대를 달고 있었다.
 *
 * ★★ "절반" 이 없으면 이펙트 팩이 줄줄이 걸린다. 64×64 폭발은 파편 한두 픽셀이
 *   칸 끝에 떠 있는 것이 정상이라, 밀도 없이 판정하면 정상 에셋을 막는다.
 *   넘어온 것은 **막대**이고 파편은 **점**이다 — 그 차이가 곧 임계값이다.
 *
 * ★ 고치는 법은 매니페스트에 `rowInsets: { "<행>": { "top": 1 } }` 한 줄이다.
 *   잘라내지 말고 **지운다** — 크기를 줄이면 sourceSize 가 바뀌어 중심이 밀린다.
 *
 * @returns {Promise<string|null>} 넘친 가장자리 이름 (없으면 null)
 */
const BLEED_FILL = 0.5;

async function findEdgeBleed(buf) {
    const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width: w, height: h, channels: ch } = info;
    if (ch < 4 || w < 3 || h < 3) return null;
    const on = (x, y) => data[(y * w + x) * ch + 3] > 0;
    const rowFill = (y) => {
        let n = 0;
        for (let x = 0; x < w; x++) if (on(x, y)) n++;
        return n;
    };
    const colFill = (x) => {
        let n = 0;
        for (let y = 0; y < h; y++) if (on(x, y)) n++;
        return n;
    };
    if (rowFill(0) >= w * BLEED_FILL && rowFill(1) === 0) return "위";
    if (rowFill(h - 1) >= w * BLEED_FILL && rowFill(h - 2) === 0) return "아래";
    if (colFill(0) >= h * BLEED_FILL && colFill(1) === 0) return "왼";
    if (colFill(w - 1) >= h * BLEED_FILL && colFill(w - 2) === 0) return "오른";
    return null;
}

/** 격자 슬라이스에서 발견된 넘침. pack-atlases 가 읽어 빌드를 실패시킨다. */
export const sliceWarnings = [];

/** 버퍼가 완전 투명한지 검사 (빈 그리드 셀 제거용) */
async function isFullyTransparent(buf) {
    const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
    if (info.channels < 4) return false;
    for (let i = 3; i < data.length; i += 4) {
        if (data[i] !== 0) return false;
    }
    return true;
}

/**
 * 이미지 하나를 프레임 목록으로 슬라이스한다.
 *
 * @param {string} file        원본 경로
 * @param {object} spec
 * @param {"strip"|"grid"|"single"} spec.type
 * @param {[number, number]} [spec.frame]  [w, h]. h 생략 또는 autoHeight 면 이미지 높이 사용
 * @param {boolean} [spec.autoHeight]      프레임 높이를 이미지 높이로 (16×16 / 16×18 혼재 대응)
 * @param {number[]} [spec.rows]           grid 에서 사용할 행 (이펙트의 9색상행 중 1행만 뽑을 때)
 * @param {number} [spec.maxCols]          행마다 앞쪽 N 열만
 * @param {Array<[number, number]>} [spec.colRanges] 담을 열 구간들 (maxCols 보다 우선)
 * @param {Object<string, {top?:number,bottom?:number,left?:number,right?:number}>} [spec.rowInsets]
 *        행 번호 → 지울 가장자리 픽셀. 이웃 행의 그림이 격자 경계를 넘어온 칸을 지운다.
 * @param {boolean} [spec.skipEmpty]       완전 투명 프레임 제거
 * @param {string} [spec.name]             프레임 이름 접두어를 직접 지정한다 (매니페스트용)
 * @param {(file: string) => string} [spec.naming]  프레임 이름 접두어 생성
 * @returns {Promise<Array<{path: string, contents: Buffer}>>}
 */
export async function sliceFile(file, spec) {
    const base = path.basename(file, ".png");
    // ★ 파일명이 곧 프레임 접두어라는 규칙은 monsters/ 처럼 파일 하나 = 캐릭터 하나일
    //   때만 성립한다. 보스 팩은 `Idle.png` · `idle.png` 처럼 **상태 이름**이 파일명이라
    //   그대로 쓰면 팩끼리 이름이 충돌한다. JSON 매니페스트에서는 함수를 쓸 수 없으므로
    //   문자열 `name` 으로 접두어를 지정한다.
    const name = spec.naming ? spec.naming(file) : (spec.name ?? base);
    const buf = await readFile(file);

    if (spec.type === "single") {
        // 개별 프레임은 상위 폴더를 네임스페이스로 쓴다 (Idle/, Attack/ …)
        const parent = path.basename(path.dirname(file));
        const p = spec.naming ? name : `${spec.name ?? parent}/${base}`;
        return [{ path: withPng(p), contents: buf }];
    }

    const img = sharp(buf);
    const meta = await img.metadata();

    const fw = spec.frame?.[0] ?? meta.width;
    const fh = spec.autoHeight ? meta.height : (spec.frame?.[1] ?? meta.height);

    const cols = Math.floor(meta.width / fw);
    const rows = spec.type === "strip" ? 1 : Math.floor(meta.height / fh);
    if (cols < 1 || rows < 1) {
        console.warn(`  ⚠ ${path.basename(file)}: ${meta.width}×${meta.height} 에서 ${fw}×${fh} 프레임을 못 만듭니다`);
        return [];
    }

    const wantRows = spec.rows ?? [...Array(rows).keys()];
    const frames = [];
    let idx = 0;

    /**
     * 어느 열을 담을지.
     *
     * ★ `maxCols` — 행마다 **앞쪽** 몇 열만. 뒤쪽이 같은 종류의 변형일 때 쓴다.
     *
     * ★★ `colRanges` — `[[0,9],[26,29]]` 처럼 **띄엄띄엄** 담는다 (2026-08-05).
     *   발사체 시트는 앞쪽(열 0–9)이 거의 전부 좌우 대칭인 방사형이고,
     *   **가로로 날아가는 방향성 있는 탄환은 열 26–29 에 몰려 있다.** 앞쪽만
     *   담았기 때문에 "반대로 쏴도 방향이 그대로"였다 — 뒤집을 방향이 애초에
     *   그림에 없었던 것이다. 사이의 열을 통째로 담으면 아틀라스만 3배가 된다.
     *
     * ★ 건너뛴 열은 아틀라스에 **없는** 열이 되고, 그것이 곧 클립 경계다
     *   (`projectileAnim.js:clipFrames`). 열 번호는 이름에 그대로 들어가므로
     *   범위를 바꿔도 이미 배정된 모양의 이름은 흔들리지 않는다.
     */
    const inRange = (c) =>
        spec.colRanges
            ? spec.colRanges.some(([a, b]) => c >= a && c <= b)
            : c < Math.min(cols, spec.maxCols ?? cols);

    for (const r of wantRows) {
        if (r >= rows) continue;
        for (let c = 0; c < cols; c++) {
            if (!inRange(c)) continue;
            let contents = await sharp(buf)
                .extract({ left: c * fw, top: r * fh, width: fw, height: fh })
                .png()
                .toBuffer();

            /**
             * ★★ `rowInsets` — **그 행에서만** 가장자리 몇 픽셀을 지운다.
             *
             *   발사체 시트의 행 1(열 0–4)은 맨 윗줄 한 픽셀이 **꽉 찬 가로 막대**다.
             *   위 행의 불꽃이 딛고 선 바닥선인데, 16px 격자가 그것을 아래 칸으로
             *   밀어 넣었다. 그대로 두면 시전 계열 7종이 **화염구 위에 가로 막대가
             *   붙은 탄환**을 쏜다 (사용자 제보 — "이상한 projectile 이 있다").
             *
             * ★ 잘라내지 않고 **지운다.** 크기를 줄이면 `sourceSize` 가 16 이 아니게
             *   되어 스프라이트 중심이 반 픽셀 밀린다. 투명하게 만들면 트리밍이
             *   알아서 걷어내고 `spriteSourceSize` 로 위치가 보존된다.
             *
             * ★ 전 행에 일괄 적용하지 않는다 — 행 4(열 6–9)는 13×15 로 칸을 거의
             *   채우는 정상 스프라이트라, 한 줄만 깎아도 진짜 그림이 잘린다.
             */
            const ins = spec.rowInsets?.[r] ?? spec.rowInsets?.[String(r)];
            if (ins) {
                const top = ins.top ?? 0;
                const bottom = ins.bottom ?? 0;
                const left = ins.left ?? 0;
                const right = ins.right ?? 0;
                const iw = fw - left - right;
                const ih = fh - top - bottom;
                if (iw > 0 && ih > 0) {
                    const inner = await sharp(contents)
                        .extract({ left, top, width: iw, height: ih })
                        .png()
                        .toBuffer();
                    contents = await sharp({
                        create: {
                            width: fw,
                            height: fh,
                            channels: 4,
                            background: { r: 0, g: 0, b: 0, alpha: 0 },
                        },
                    })
                        .composite([{ input: inner, top, left }])
                        .png()
                        .toBuffer();
                }
            }

            if (spec.skipEmpty && (await isFullyTransparent(contents))) continue;

            // 다중 행을 쓸 때만 행 번호를 이름에 넣는다
            const frameName = wantRows.length > 1 ? `${name}/${r}_${c}` : `${name}/${idx}`;

            // ★ 격자 슬라이스에서만 검사한다 — strip 은 한 줄이라 위아래 이웃이 없다
            if (spec.type === "grid") {
                const edge = await findEdgeBleed(contents);
                if (edge) {
                    sliceWarnings.push(
                        `${frameName}: ${edge}쪽 가장자리에 이웃 칸의 그림이 넘어와 있다 — ` +
                            `매니페스트에 rowInsets: { "${r}": { "${{ 위: "top", 아래: "bottom", 왼: "left", 오른: "right" }[edge]}": 1 } } 을 넣는다`
                    );
                }
            }
            frames.push({ path: withPng(frameName), contents });
            idx++;
        }
    }
    return frames;
}
