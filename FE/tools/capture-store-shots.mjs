import { spawn, spawnSync } from "node:child_process";
import { readFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STORE = path.join(ROOT, "asset", "generated", "store");
const COPY_FILE = path.join(ROOT, "tools", "store-copy.json");
const APP_PORT = 5199;
const CDP_PORT = 9333;
const APP_URL = `http://127.0.0.1:${APP_PORT}/`;
const CDP_URL = `http://127.0.0.1:${CDP_PORT}`;
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const HIGHEST_STAGE = 90;
const SPELLS = ["shatter_volley", "war_horn", "healing_wave", "execution_decree"];
const RESUME = process.argv.includes("--resume");

const LANGUAGE_CONFIG = Object.freeze({
    ko: {
        copyKey: "ko",
        fontSize: "5.5vh",
        outDir: "raw",
        htmlLang: "ko",
        title: { slotOne: "슬롯 1", resume: "이어하기", start: "게임 시작하기" },
    },
    en: {
        copyKey: "en",
        fontSize: "6.2vh",
        outDir: "en/raw",
        htmlLang: "en",
        title: { slotOne: "Slot 1", resume: "Continue", start: "New Game" },
    },
});

function readLanguage() {
    const index = process.argv.indexOf("--lang");
    const lang = index < 0 ? "ko" : process.argv[index + 1];
    if (!LANGUAGE_CONFIG[lang]) {
        throw new Error(`--lang 는 ko 또는 en 이어야 한다 (현재 ${JSON.stringify(lang)})`);
    }
    return lang;
}

const LANG = readLanguage();
const LANG_CONFIG = LANGUAGE_CONFIG[LANG];
const RAW = path.join(STORE, LANG_CONFIG.outDir);

const VIEWPORTS = [
    {
        id: "play",
        css: { width: 1280, height: 720 },
        raw: { width: 3840, height: 2160 },
    },
    {
        id: "ios-69",
        css: { width: 1564, height: 720 },
        raw: { width: 4692, height: 2160 },
    },
];

/** §3.2 장면 정의의 코드 단일 사본. */
const SCENES = [
    { id: 1, name: "전투 한복판", route: "#/battle/2-4", type: "battle-mid" },
    { id: 2, name: "지휘관 오라", route: "#/battle/3-2", type: "battle-aura" },
    { id: 3, name: "각인 3지선다", route: "#/battle/2-7", type: "battle-draft" },
    { id: 4, name: "보스", route: "#/battle/2-10", type: "battle-boss" },
    {
        id: 5,
        name: "편성",
        route: "#/loadout",
        type: "static",
        readyText: { ko: "편성", en: "Loadout" },
    },
    {
        id: 6,
        name: "동료 상세",
        route: "#/companions",
        type: "static",
        readyText: { ko: "동료", en: "Companions" },
    },
    {
        id: 7,
        name: "방주",
        route: "#/ark",
        type: "static",
        readyText: { ko: "방주", en: "Ark" },
    },
    {
        id: 8,
        name: "출격/난이도",
        route: "#/stages",
        type: "static",
        readyText: { ko: "출격", en: "Deploy" },
    },
];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class CdpClient {
    constructor(url) {
        this.url = url;
        this.nextId = 1;
        this.pending = new Map();
        this.socket = null;
    }

    async connect() {
        this.socket = new WebSocket(this.url);
        await new Promise((resolve, reject) => {
            const onError = () => reject(new Error(`CDP WebSocket 연결 실패: ${this.url}`));
            this.socket.addEventListener("open", resolve, { once: true });
            this.socket.addEventListener("error", onError, { once: true });
        });
        this.socket.addEventListener("message", (event) => {
            const message = JSON.parse(String(event.data));
            if (!message.id) return;
            const pending = this.pending.get(message.id);
            if (!pending) return;
            this.pending.delete(message.id);
            if (message.error) pending.reject(new Error(message.error.message));
            else pending.resolve(message.result);
        });
        this.socket.addEventListener("close", () => {
            for (const pending of this.pending.values()) {
                pending.reject(new Error("CDP WebSocket가 닫혔다"));
            }
            this.pending.clear();
        });
    }

    send(method, params = {}) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            return Promise.reject(new Error(`CDP가 열려 있지 않다: ${method}`));
        }
        const id = this.nextId++;
        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
            this.socket.send(JSON.stringify({ id, method, params }));
        });
    }

    close() {
        this.socket?.close();
    }
}

function stopProcessTree(child) {
    if (!child?.pid || child.exitCode !== null) return;
    if (process.platform === "win32") {
        spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
            stdio: "ignore",
            windowsHide: true,
        });
    } else {
        child.kill("SIGTERM");
    }
}

function collectOutput(child, label) {
    let tail = "";
    const append = (chunk) => {
        tail = `${tail}${chunk}`.slice(-12000);
    };
    child.stdout?.on("data", append);
    child.stderr?.on("data", append);
    return () => (tail ? `\n[${label} output]\n${tail}` : "");
}

async function waitForHttp(url, label, timeoutMs = 30000) {
    const started = Date.now();
    let lastError = null;
    while (Date.now() - started < timeoutMs) {
        try {
            const response = await fetch(url);
            if (response.ok) return response;
            lastError = new Error(`HTTP ${response.status}`);
        } catch (error) {
            lastError = error;
        }
        await delay(100);
    }
    throw new Error(`${label} 대기 시간 초과: ${lastError?.message ?? "응답 없음"}`);
}

async function assertPortFree(url, label) {
    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(500) });
        if (response.ok) throw new Error(`${label} 포트가 이미 사용 중이다: ${url}`);
    } catch (error) {
        if (error.message?.includes("이미 사용 중")) throw error;
    }
}

async function evaluate(cdp, expression) {
    const response = await cdp.send("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
        userGesture: true,
    });
    if (response.exceptionDetails) {
        const description = response.exceptionDetails.exception?.description;
        throw new Error(description ?? response.exceptionDetails.text ?? "브라우저 평가 실패");
    }
    return response.result?.value;
}

async function waitFor(cdp, expression, label, timeoutMs = 30000, intervalMs = 100) {
    const started = Date.now();
    let last = null;
    while (Date.now() - started < timeoutMs) {
        try {
            last = await evaluate(cdp, expression);
            if (last) return last;
        } catch (error) {
            last = error.message;
        }
        await delay(intervalMs);
    }
    throw new Error(`${label} 대기 시간 초과 (마지막 값: ${JSON.stringify(last)})`);
}

async function setViewport(cdp, viewport) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: viewport.css.width,
        height: viewport.css.height,
        deviceScaleFactor: 3,
        mobile: false,
        screenWidth: viewport.css.width,
        screenHeight: viewport.css.height,
        positionX: 0,
        positionY: 0,
        dontSetVisibleSize: false,
    });
}

async function navigatePage(cdp, url) {
    await cdp.send("Page.navigate", { url });
    // 첫 dev 변환은 i18n 카탈로그와 게임 데이터를 함께 묶어 저사양 환경에서 30초를 넘긴다.
    await waitFor(cdp, "document.readyState === 'complete'", `페이지 로드 ${url}`, 90000);
}

async function navigateHash(cdp, route, readyText = null) {
    await evaluate(
        cdp,
        `(() => {
            document.getElementById('__store-copy-overlay')?.remove();
            location.hash = ${JSON.stringify(route)};
            return true;
        })()`
    );
    await waitFor(cdp, `location.hash === ${JSON.stringify(route)}`, `${route} 라우트`);
    if (readyText) {
        await waitFor(
            cdp,
            `document.body?.innerText?.includes(${JSON.stringify(readyText)})`,
            `${route} 화면 내용`
        );
    }
    await delay(350);
}

async function hideDebug(cdp) {
    await evaluate(
        cdp,
        `(() => {
            globalThis.__game?.scene?.stop?.('Debug');
            document.getElementById('__store-copy-overlay')?.remove();
            return true;
        })()`
    );
}

async function openFirstSlot(cdp) {
    await waitFor(
        cdp,
        "globalThis.__store && document.querySelectorAll('button').length > 0",
        "타이틀"
    );
    const clicked = await evaluate(
        cdp,
        `(() => {
            const buttons = [...document.querySelectorAll('button')];
            const empty = buttons.find((button) => button.textContent?.includes(${JSON.stringify(LANG_CONFIG.title.slotOne)}));
            const resume = buttons.find((button) => button.textContent?.trim() === ${JSON.stringify(LANG_CONFIG.title.resume)} && !button.disabled);
            const start = buttons.find((button) => button.textContent?.includes(${JSON.stringify(LANG_CONFIG.title.start)}) && !button.disabled);
            const target = empty ?? resume ?? start;
            target?.click();
            return !!target;
        })()`
    );
    if (!clicked) throw new Error("타이틀에서 열 수 있는 세이브 슬롯을 찾지 못했다");
    await waitFor(cdp, "location.hash === '#/ark'", "슬롯 열기");
}

async function injectStoreState(cdp) {
    const result = await evaluate(
        cdp,
        `(async () => {
            const unitModule = await import('/src/game/data/units.json');
            const stageModule = await import('/src/game/data/stages.json');
            const unitIds = unitModule.default.units.map((unit) => unit.id);
            const stageIds = stageModule.default.stages.map((stage) => stage.id);
            const owned = Object.fromEntries(unitIds.map((id) => [id, { level: 5 }]));
            const stageStars = Object.fromEntries(stageIds.map((id) => [id, 3]));
            const spells = ${JSON.stringify(SPELLS)};
            await globalThis.__store.setState((state) => ({
                meta: {
                    ...state.meta,
                    highestStage: ${HIGHEST_STAGE},
                    stageStars,
                    difficultyStars: {
                        ...state.meta.difficultyStars,
                        hard: stageStars,
                        nightmare: stageStars,
                    },
                    selectedDifficulty: 'normal',
                    currencies: { ...state.meta.currencies, gold: 9999999 },
                    ark: {
                        ...Object.fromEntries(
                            Object.keys(state.meta.ark ?? {}).map((key) => [key, 12])
                        ),
                        archive: 0,
                    },
                    commander: {
                        ...state.meta.commander,
                        level: 20,
                        spells,
                    },
                },
                roster: {
                    ...state.roster,
                    owned,
                    activePreset: 0,
                    presets: state.roster.presets.map((preset, index) =>
                        index === 0 ? { ...preset, units: unitIds.slice(0, 6) } : preset
                    ),
                },
                settings: {
                    ...state.settings,
                    language: ${JSON.stringify(LANG)},
                    autoCommander: false,
                    battleSpeed: 1,
                    effectIntensity: 'high',
                    damageNumbers: 'all',
                },
            }));
            return {
                units: unitIds.length,
                loadout: globalThis.__store.getState().getLoadout().filter(Boolean).length,
                highestStage: globalThis.__store.getState().meta.highestStage,
            };
        })()`
    );
    if (result?.units !== 50 || result?.loadout !== 6 || result?.highestStage !== HIGHEST_STAGE) {
        throw new Error(`스토어 상태 주입 실패: ${JSON.stringify(result)}`);
    }
}

async function installCopy(cdp, copy) {
    await evaluate(
        cdp,
        `(async () => {
            document.getElementById('__store-copy-overlay')?.remove();
            const overlay = document.createElement('div');
            overlay.id = '__store-copy-overlay';
            overlay.lang = ${JSON.stringify(LANG_CONFIG.htmlLang)};
            overlay.textContent = ${JSON.stringify(copy)};
            Object.assign(overlay.style, {
                position: 'fixed',
                zIndex: '2147483647',
                top: '6%',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '88%',
                maxWidth: '88%',
                boxSizing: 'border-box',
                padding: '0.35em 0.7em',
                color: '#ffffff',
                background: 'rgba(15, 15, 30, 0.78)',
                fontFamily: 'inherit',
                fontSize: ${JSON.stringify(LANG_CONFIG.fontSize)},
                lineHeight: '1.2',
                textAlign: 'center',
                whiteSpace: 'normal',
                overflowWrap: 'break-word',
                pointerEvents: 'none',
            });
            document.body.appendChild(overlay);
            await document.fonts.ready;
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            return true;
        })()`
    );
}

async function captureBuffer(cdp, copy, viewport) {
    await hideDebug(cdp);
    await installCopy(cdp, copy);
    try {
        const result = await cdp.send("Page.captureScreenshot", {
            format: "png",
            fromSurface: true,
            captureBeyondViewport: false,
        });
        const buffer = Buffer.from(result.data, "base64");
        const metadata = await sharp(buffer).metadata();
        if (metadata.width !== viewport.raw.width || metadata.height !== viewport.raw.height) {
            throw new Error(
                `${viewport.id} 캡처 크기 오류: ${metadata.width}x${metadata.height}, ` +
                    `기대 ${viewport.raw.width}x${viewport.raw.height}`
            );
        }
        return buffer;
    } finally {
        await evaluate(cdp, "document.getElementById('__store-copy-overlay')?.remove(); true");
    }
}

function battlePumpExpression({ autoDraft, speed, commanderFront, keepArkFull = false }) {
    return `(() => {
        const battle = globalThis.__battle;
        if (!battle?.sim || !battle.sys?.isActive?.()) return null;
        battle.speedMultiplier = ${speed};
        const sim = battle.sim;
        sim.mana = sim.manaMax;
        sim.riftEnergy = sim.riftMax;
        if (${keepArkFull ? "true" : "false"}) {
            sim.arkHp = sim.arkHpMax;
            sim.commander.hp = sim.commander.hpMax;
            sim.commander.downUntil = 0;
        }
        if (${commanderFront ? "true" : "false"}) {
            sim.commander.lane = 1;
            sim.commander.x = 620;
            sim.commander.targetX = 620;
        }
        if (sim.phase === 'draft' && ${autoDraft ? "true" : "false"}) {
            battle._onSigilChoose?.(0);
        }
        const allies = sim.actives.filter((entity) => entity.isAlly).length;
        if (sim.phase === 'battle' && allies < 24 && battle._inputQueue.length < 7) {
            for (let slot = 0; slot < Math.min(6, sim.loadout.length); slot++) {
                battle.handleSummon(slot, slot % 3);
            }
        }
        const ground = sim.lanes.slice(0, 3).map((lane) => ({
            allies: lane.allies.length,
            enemies: lane.enemies.length,
        }));
        const enemies = sim.actives.filter((entity) => !entity.isAlly).length;
        const airEnemies = sim.lanes[3]?.enemies?.length ?? 0;
        const engagedGround = ground.filter((lane) => lane.allies > 0 && lane.enemies > 0).length;
        const boss = sim.modeState?.boss;
        return {
            phase: sim.phase,
            wave: sim.wave,
            t: sim.t,
            allies,
            enemies,
            airEnemies,
            engagedGround,
            projectiles: sim.projectiles.length,
            effects: battle.fx?.activeCount ?? 0,
            draftOptions: sim.pendingDraft?.options?.length ?? 0,
            bossId: boss?.id ?? -1,
            bossTransition: boss?.transitionTo ?? -1,
            terminal: sim.phase === 'victory' || sim.phase === 'defeat',
        };
    })()`;
}

async function pumpBattle(cdp, options) {
    return evaluate(cdp, battlePumpExpression(options));
}

async function waitBattleMoment(cdp, options, predicate, label, timeoutMs = 40000) {
    const started = Date.now();
    let last = null;
    while (Date.now() - started < timeoutMs) {
        last = await pumpBattle(cdp, options);
        if (last?.terminal) throw new Error(`${label} 전에 전투가 끝났다: ${JSON.stringify(last)}`);
        if (last && predicate(last)) return last;
        await delay(60);
    }
    throw new Error(`${label} 대기 시간 초과: ${JSON.stringify(last)}`);
}

async function startBattle(cdp, scene) {
    await navigateHash(cdp, "#/ark", LANG === "ko" ? "방주" : "Ark");
    await evaluate(
        cdp,
        `globalThis.__store.setState((state) => ({
            settings: { ...state.settings, autoCommander: false, battleSpeed: 1 }
        })); true`
    );
    await navigateHash(cdp, scene.route);
    const stageId = scene.route.split("/").at(-1);
    await waitFor(
        cdp,
        `Boolean(globalThis.__battle?.stageId === ${JSON.stringify(stageId)} && ` +
            "globalThis.__battle?.sys?.isActive?.() && globalThis.__battle?.sim)",
        `${scene.name} BattleScene`,
        30000
    );
    await hideDebug(cdp);
    await delay(250);
}

async function freezeBattle(cdp) {
    await evaluate(cdp, "globalThis.__battle.speedMultiplier = 0; true");
    await delay(60);
}

function battleScore(summary) {
    return (
        summary.engagedGround * 30 +
        Math.min(summary.airEnemies, 4) * 10 +
        Math.min(summary.enemies, 24) * 3 +
        Math.min(summary.allies, 24) * 2 +
        Math.min(summary.projectiles, 20) * 2 +
        Math.min(summary.effects, 20)
    );
}

async function captureBattleMid(cdp, copy, viewport) {
    const scene = SCENES[0];
    await startBattle(cdp, scene);
    const pump = { autoDraft: true, speed: 8, commanderFront: false };
    let moment = await waitBattleMoment(
        cdp,
        pump,
        (value) => value.wave >= 4 && value.allies >= 8 && value.enemies >= 5,
        "전투 한복판 첫 후보"
    );
    const candidates = [];
    for (let index = 0; index < 3; index++) {
        await freezeBattle(cdp);
        moment = await pumpBattle(cdp, { ...pump, speed: 0 });
        candidates.push({
            score: battleScore(moment),
            summary: moment,
            buffer: await captureBuffer(cdp, copy, viewport),
        });
        if (index === 2) break;
        const targetTime = moment.t + 1800;
        await waitBattleMoment(
            cdp,
            pump,
            (value) => value.t >= targetTime && value.enemies >= 4,
            `전투 한복판 후보 ${index + 2}`,
            15000
        );
    }
    candidates.sort((a, b) => b.score - a.score);
    console.log(`[capture] 1번 후보 점수 ${candidates.map((item) => item.score).join(", ")}`);
    console.log(`[capture] 1번 선택 상태 ${JSON.stringify(candidates[0].summary)}`);
    return candidates[0].buffer;
}

async function captureBattleAura(cdp, copy, viewport) {
    const scene = SCENES[1];
    await startBattle(cdp, scene);
    const pump = { autoDraft: true, speed: 8, commanderFront: true };
    const moment = await waitBattleMoment(
        cdp,
        pump,
        (value) => value.wave >= 4 && value.allies >= 8 && value.enemies >= 4,
        "지휘관 오라 장면"
    );
    await freezeBattle(cdp);
    console.log(`[capture] 2번 상태 ${JSON.stringify(moment)}`);
    return captureBuffer(cdp, copy, viewport);
}

async function captureBattleDraft(cdp, copy, viewport) {
    const scene = SCENES[2];
    await startBattle(cdp, scene);
    const pump = { autoDraft: false, speed: 8, commanderFront: false };
    const moment = await waitBattleMoment(
        cdp,
        pump,
        (value) => value.phase === "draft" && value.draftOptions === 3,
        "각인 3지선다"
    );
    await freezeBattle(cdp);
    console.log(`[capture] 3번 상태 ${JSON.stringify(moment)}`);
    return captureBuffer(cdp, copy, viewport);
}

async function captureBattleBoss(cdp, copy, viewport) {
    const scene = SCENES[3];
    await startBattle(cdp, scene);
    const pump = {
        autoDraft: true,
        speed: 10,
        commanderFront: true,
        keepArkFull: true,
    };
    const moment = await waitBattleMoment(
        cdp,
        pump,
        (value) => value.bossId >= 0,
        "보스 등장",
        50000
    );
    await freezeBattle(cdp);
    await evaluate(
        cdp,
        `(() => {
            const battle = globalThis.__battle;
            const boss = battle?.sim?.modeState?.boss;
            if (!boss?.e?.active) return false;
            if (boss.transitionTo < 0) boss.e.hp = Math.min(boss.e.hp, boss.e.hpMax * 0.58);
            battle.speedMultiplier = 1;
            return true;
        })()`
    );
    await waitBattleMoment(
        cdp,
        { autoDraft: true, speed: 1, commanderFront: true },
        (value) => value.bossTransition >= 1,
        "보스 페이즈 전환",
        5000
    );
    await freezeBattle(cdp);
    console.log(`[capture] 4번 등장 상태 ${JSON.stringify(moment)}`);
    return captureBuffer(cdp, copy, viewport);
}

async function captureStatic(cdp, scene, copy, viewport) {
    await navigateHash(cdp, scene.route, scene.readyText?.[LANG]);
    await hideDebug(cdp);
    return captureBuffer(cdp, copy, viewport);
}

async function captureScene(cdp, scene, copy, viewport) {
    if (scene.type === "battle-mid") return captureBattleMid(cdp, copy, viewport);
    if (scene.type === "battle-aura") return captureBattleAura(cdp, copy, viewport);
    if (scene.type === "battle-draft") return captureBattleDraft(cdp, copy, viewport);
    if (scene.type === "battle-boss") return captureBattleBoss(cdp, copy, viewport);
    return captureStatic(cdp, scene, copy, viewport);
}

async function loadCopy() {
    const rows = JSON.parse(await readFile(COPY_FILE, "utf8"));
    if (!Array.isArray(rows) || rows.length !== 8)
        throw new Error("store-copy.json 은 8행이어야 한다");
    return new Map(rows.map((row) => [row.id, row[LANG_CONFIG.copyKey]]));
}

async function hasValidRaw(output, viewport) {
    if (!RESUME) return false;
    try {
        const metadata = await sharp(output).metadata();
        return metadata.width === viewport.raw.width && metadata.height === viewport.raw.height;
    } catch {
        return false;
    }
}

async function main() {
    const copy = await loadCopy();
    await mkdir(RAW, { recursive: true });
    await assertPortFree(APP_URL, "Vite");
    await assertPortFree(`${CDP_URL}/json/version`, "Chrome CDP");

    const profile = await mkdtemp(path.join(os.tmpdir(), "riftark-store-capture-"));
    const safeTempRoot = path.resolve(os.tmpdir());
    if (!path.resolve(profile).startsWith(`${safeTempRoot}${path.sep}`)) {
        throw new Error(`Chrome 임시 프로필이 임시 폴더 밖이다: ${profile}`);
    }

    let server = null;
    let chrome = null;
    let cdp = null;
    try {
        server = spawn(
            process.execPath,
            [
                path.join(ROOT, "node_modules", "vite", "bin", "vite.js"),
                "--host",
                "127.0.0.1",
                "--port",
                String(APP_PORT),
                "--strictPort",
            ],
            {
                cwd: ROOT,
                stdio: ["ignore", "pipe", "pipe"],
                windowsHide: true,
            }
        );
        const serverTail = collectOutput(server, "vite");
        await waitForHttp(APP_URL, "Vite dev 서버").catch((error) => {
            throw new Error(`${error.message}${serverTail()}`);
        });

        chrome = spawn(
            CHROME,
            [
                "--headless=new",
                `--remote-debugging-port=${CDP_PORT}`,
                `--user-data-dir=${profile}`,
                "--hide-scrollbars",
                "--mute-audio",
                "--no-first-run",
                "--no-default-browser-check",
                "--window-size=1564,720",
                "about:blank",
            ],
            { stdio: ["ignore", "pipe", "pipe"], windowsHide: true }
        );
        const chromeTail = collectOutput(chrome, "chrome");
        await waitForHttp(`${CDP_URL}/json/list`, "Chrome CDP").catch((error) => {
            throw new Error(`${error.message}${chromeTail()}`);
        });
        const targets = await (await fetch(`${CDP_URL}/json/list`)).json();
        const page = targets.find((target) => target.type === "page");
        if (!page?.webSocketDebuggerUrl) throw new Error("Chrome page CDP target을 찾지 못했다");

        cdp = new CdpClient(page.webSocketDebuggerUrl);
        await cdp.connect();
        await cdp.send("Page.enable");
        await cdp.send("Runtime.enable");

        await setViewport(cdp, VIEWPORTS[0]);
        await navigatePage(cdp, `${APP_URL}#/`);
        await waitFor(cdp, "Boolean(globalThis.__store && globalThis.__game)", "게임 부팅", 45000);
        await evaluate(
            cdp,
            `globalThis.__store.setState((state) => ({
                settings: { ...state.settings, language: ${JSON.stringify(LANG)} }
            })); true`
        );
        await waitFor(
            cdp,
            `document.documentElement.lang === ${JSON.stringify(LANG_CONFIG.htmlLang)}`,
            `${LANG} 언어 적용`
        );
        await openFirstSlot(cdp);
        await injectStoreState(cdp);
        await delay(500);
        await hideDebug(cdp);

        for (const viewport of VIEWPORTS) {
            await setViewport(cdp, viewport);
            await delay(500);
            for (const scene of SCENES) {
                const output = path.join(RAW, `${viewport.id}-${scene.id}.png`);
                if (await hasValidRaw(output, viewport)) {
                    console.log(`[capture] 기존 원본 유지 ${path.relative(ROOT, output)}`);
                    continue;
                }
                const text = copy.get(scene.id);
                if (!text) throw new Error(`${scene.id}번 ${LANG} 카피가 없다`);
                console.log(`[capture:${LANG}] ${viewport.id} ${scene.id}/8 ${scene.name}`);
                const buffer = await captureScene(cdp, scene, text, viewport);
                await writeFile(output, buffer);
                console.log(`[capture] 저장 ${path.relative(ROOT, output)}`);
            }
        }
    } finally {
        cdp?.close();
        stopProcessTree(chrome);
        stopProcessTree(server);
        await rm(profile, { recursive: true, force: true });
    }

    console.log(`[capture:${LANG}] 실제 게임 원본 16장 완료 — Chrome·Vite 정리 완료`);
}

await main();
