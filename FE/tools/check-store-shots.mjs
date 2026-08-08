import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STORE = path.join(ROOT, "asset", "generated", "store");
const COPY_FILE = path.join(ROOT, "tools", "store-copy.json");
const MAX_BYTES = 8 * 1024 * 1024;
/**
 * ★★★ **"광고"는 더 이상 금지어가 아니다 — 거짓 주장이 금지어다** (2026-08-07).
 *
 *   수익화가 무료 + 보상형 광고로 바뀌면서(`docs/06-release/55` · `58`),
 *   **"광고 없음" 이 거짓이 됐다.** 예전 목록은 정확히 반대로 되어 있었다 —
 *   `"광고"` 를 금지어로 두고, 그 대신 아래 면제 목록이 `"광고 없음"` 을
 *   **통과시키고** 있었다. 즉 검사기가 지금 반드시 막아야 할 문장 하나만
 *   콕 집어 허용하는 상태였다.
 *
 * ★ 지금 막는 것: 없는 것을 있다고 하거나(삭제된 시스템), **있는 것을 없다고 하는 것**.
 *   광고를 정직하게 언급하는 것(`광고는 선택` · `광고 보고 보너스`)은 **권장**이다.
 */
const FORBIDDEN_KO = [
    "방치",
    "접속하지 않아도",
    "가챠",
    "뽑기",
    "상점",
    "배틀패스",
    // ★ 광고가 있는데 없다고 말하는 것 — 스토어 오도성 표시이자 반려 사유다
    "광고 없음",
    "무광고",
    "광고 제거",
    "광고가 없",
];
const FORBIDDEN_EN = [
    // ★ 광고가 있는데 없다고 말하는 것 (위 FORBIDDEN_KO 주석 참조)
    "no ads",
    "ad-free",
    "ad free",
    "without ads",
    "zero ads",
    "gacha",
    "loot box",
    "lootbox",
    "battle pass",
    "season pass",
    "idle",
    "afk",
    "offline rewards",
    "shop",
    "store currency",
    "gems",
    "energy",
    "stamina",
    "watch an ad",
    "rewarded",
    "best",
    "#1",
    "number one",
    "top-rated",
    "ultimate",
    "free",
];
const errors = [];

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

const SETS = [
    {
        dir: path.join(LANGUAGE_ROOT, "play"),
        name: (id) => `play-screenshot-${id}.png`,
        width: 1920,
        height: 1080,
    },
    {
        dir: path.join(LANGUAGE_ROOT, "ios"),
        name: (id) => `ios-69-${id}.png`,
        width: 2868,
        height: 1320,
    },
];

async function checkCopy() {
    let rows;
    try {
        rows = JSON.parse(await readFile(COPY_FILE, "utf8"));
    } catch (error) {
        errors.push(`store-copy.json 읽기 실패: ${error.message}`);
        return;
    }
    if (!Array.isArray(rows) || rows.length !== 8) {
        errors.push(`store-copy.json 은 8행이어야 한다 (현재 ${rows?.length ?? "비배열"})`);
        return;
    }
    for (let id = 1; id <= 8; id++) {
        const row = rows.find((item) => item?.id === id);
        if (!row || typeof row.ko !== "string" || typeof row.en !== "string") {
            errors.push(`store-copy.json id ${id} 의 ko/en 카피가 없다`);
            continue;
        }
        if (LANG === "ko") {
            /**
             * ★★★ **면제에서 "광고 없음" 을 뺐다** (2026-08-07). 예전 주석은
             *   "부재 보장이라 괜찮다"고 적었는데, 광고가 실제로 들어오면서
             *   그 보장이 **거짓**이 됐다. 면제가 남아 있으면 검사기는 지금
             *   가장 위험한 문장 하나만 통과시킨다.
             * ★ 삭제된 시스템 이름은 여전히 면제한다 — "가챠 없음" 은 참이다.
             */
            const checkedKo = row.ko.replaceAll("가챠 없음", "").replaceAll("확률형 없음", "");
            for (const word of FORBIDDEN_KO) {
                if (checkedKo.includes(word)) {
                    errors.push(`금지 카피 발견: id ${id} ko에 "${word}"`);
                }
            }
        } else {
            // ★ `No ads.` 면제를 제거했다 — 그 문장이 이제 막아야 할 대상이다
            const checkedEn = row.en.replaceAll("No IAP.", "").replaceAll("No gacha.", "");
            for (const phrase of FORBIDDEN_EN) {
                const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                const pattern = phrase === "#1" ? escaped : `\\b${escaped}\\b`;
                if (new RegExp(pattern, "i").test(checkedEn)) {
                    errors.push(`금지 카피 발견: id ${id} en에 "${phrase}"`);
                }
            }
        }
    }
}

/**
 * ★★★ **카피는 캡처 순간 브라우저에 얹혀 원본 PNG 에 구워진다** — 그래서
 *   `store-copy.json` 을 고친 것만으로는 이미지가 바뀌지 않는다. 그런데 위
 *   `checkCopy()` 는 **그 JSON 만** 읽는다. 즉 카피를 고치고 재촬영하지 않으면
 *   **검사기는 통과하고 스토어에는 옛 문장이 올라간다.**
 *
 *   2026-08-08 에 실제로 그 상태였다:
 *     store-copy.json      2026-08-08 00:06   ("광고는 선택" 으로 이미 고쳐짐)
 *     raw/play-8.png       2026-08-06 20:23   ("광고 없음" 이 구워진 채)
 *     en/raw/play-8.png    2026-08-07 08:08
 *   광고를 켠 앱에 "광고 없음" 스크린샷이 함께 올라갈 뻔했다. 스토어 오도성
 *   표시이자 반려 사유이고, 통과한 검사기가 그것을 보증해 주고 있었다.
 *
 * ★ `check-production.mjs` 의 D1(“dist 가 소스보다 오래됐다”)과 같은 규칙이다.
 *   **검사 대상이 낡으면 통과는 거짓말이다.**
 */
async function checkFreshness() {
    let copyAt;
    try {
        copyAt = (await stat(COPY_FILE)).mtimeMs;
    } catch {
        return; // checkCopy 가 이미 오류를 냈다
    }
    const rawDir = path.join(LANGUAGE_ROOT, "raw");
    let names;
    try {
        names = (await readdir(rawDir)).filter((n) => n.endsWith(".png"));
    } catch {
        errors.push(`${path.relative(ROOT, rawDir)} 를 읽지 못했다 — 아직 촬영하지 않았다`);
        return;
    }
    const stale = [];
    for (const name of names) {
        const at = (await stat(path.join(rawDir, name))).mtimeMs;
        // 1초 여유 — 같은 실행 안에서 쓰인 파일들의 타임스탬프 흔들림을 흡수한다
        if (at + 1000 < copyAt) stale.push(name);
    }
    if (stale.length) {
        errors.push(
            `카피가 이미지보다 새롭다 — store-copy.json 을 고치고 재촬영하지 않았다. ` +
                `카피는 **캡처 순간 원본 PNG 에 구워지므로** compose 만 다시 돌려서는 바뀌지 않는다. ` +
                `\`npm run store:capture${LANG === "en" ? ":en" : ""}\` 부터 다시 돌려라 ` +
                `(낡은 원본 ${stale.length}장: ${stale.slice(0, 4).join(", ")}${stale.length > 4 ? " …" : ""})`
        );
    }
}

async function checkImage(file, expected) {
    let info;
    let stats;
    try {
        const image = sharp(file);
        [info, stats] = await Promise.all([image.metadata(), image.stats()]);
    } catch (error) {
        errors.push(`${path.relative(ROOT, file)} 읽기 실패: ${error.message}`);
        return;
    }

    const label = path.relative(ROOT, file);
    if (info.format !== "png") errors.push(`${label}: PNG가 아니다 (${info.format})`);
    if (info.width !== expected.width || info.height !== expected.height) {
        errors.push(
            `${label}: ${info.width}x${info.height}, 기대 ${expected.width}x${expected.height}`
        );
    }
    if (info.space !== "srgb") errors.push(`${label}: sRGB가 아니다 (${info.space})`);
    if (info.channels !== 4 || !info.hasAlpha) {
        errors.push(`${label}: PNG-32 RGBA가 아니다 (channels=${info.channels})`);
    } else if (stats.channels[3]?.min !== 255) {
        errors.push(`${label}: 완전 투명/반투명 픽셀이 있다 (alpha min=${stats.channels[3]?.min})`);
    }
    const bytes = (await stat(file)).size;
    if (bytes >= MAX_BYTES) {
        errors.push(`${label}: 파일 크기 ${(bytes / 1048576).toFixed(2)}MiB, 상한 8MiB 이상`);
    }
}

await checkCopy();
await checkFreshness();

for (const set of SETS) {
    let names = [];
    try {
        names = (await readdir(set.dir)).filter((name) => name.endsWith(".png"));
    } catch (error) {
        errors.push(`${path.relative(ROOT, set.dir)} 폴더 읽기 실패: ${error.message}`);
    }
    const expectedNames = Array.from({ length: 8 }, (_, i) => set.name(i + 1));
    for (const name of expectedNames) {
        if (!names.includes(name))
            errors.push(`${path.relative(ROOT, path.join(set.dir, name))} 없음`);
    }
    const unexpected = names.filter((name) => !expectedNames.includes(name));
    if (unexpected.length) {
        errors.push(`${path.relative(ROOT, set.dir)} 에 예상 밖 PNG: ${unexpected.join(", ")}`);
    }
    for (const name of expectedNames.filter((item) => names.includes(item))) {
        await checkImage(path.join(set.dir, name), set);
    }
}

if (errors.length) {
    console.error(`[store:check] 실패 ${errors.length}건`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
} else {
    console.log(
        `[store:check:${LANG}] 통과 — 16장, 규격·PNG-32·sRGB·불투명·용량·카피 확인`
    );
}
