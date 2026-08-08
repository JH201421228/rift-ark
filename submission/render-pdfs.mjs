import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DOCUMENTS = [
    ["03-game-introduction.html", "03-game-introduction.pdf"],
    ["04-ai-usage-technical-document.html", "04-ai-usage-technical-document.pdf"],
];

const CHROME_CANDIDATES = [
    process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
].filter(Boolean);

async function findChrome() {
    for (const candidate of CHROME_CANDIDATES) {
        try {
            await access(candidate);
            return candidate;
        } catch {
            // 다음 후보를 확인한다.
        }
    }
    throw new Error("Chrome을 찾지 못했다. CHROME_PATH 환경 변수를 지정하라.");
}

function run(command, args) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
        let output = "";
        child.stdout.on("data", (chunk) => (output += chunk));
        child.stderr.on("data", (chunk) => (output += chunk));
        child.on("error", reject);
        child.on("exit", (code) => {
            if (code === 0) resolve(output);
            else reject(new Error(`Chrome PDF 변환 실패 (${code})\n${output}`));
        });
    });
}

async function assertPdf(file) {
    const [header, fileStat] = await Promise.all([readFile(file).then((b) => b.subarray(0, 5)), stat(file)]);
    if (header.toString("ascii") !== "%PDF-") throw new Error(`${path.basename(file)} 가 PDF가 아니다`);
    if (fileStat.size < 50_000) throw new Error(`${path.basename(file)} 용량이 비정상적으로 작다`);
    console.log(`[pdf] ${path.basename(file)} ${(fileStat.size / 1024 / 1024).toFixed(2)} MiB`);
}

const chrome = await findChrome();
const profile = await mkdtemp(path.join(os.tmpdir(), "riftark-submission-pdf-"));

try {
    for (const [htmlName, pdfName] of DOCUMENTS) {
        const html = path.join(ROOT, htmlName);
        const pdf = path.join(ROOT, pdfName);
        await run(chrome, [
            "--headless=new",
            "--disable-gpu",
            "--hide-scrollbars",
            "--no-pdf-header-footer",
            `--user-data-dir=${profile}`,
            `--print-to-pdf=${pdf}`,
            pathToFileURL(html).href,
        ]);
        await assertPdf(pdf);
    }
} finally {
    await rm(profile, { recursive: true, force: true });
}

