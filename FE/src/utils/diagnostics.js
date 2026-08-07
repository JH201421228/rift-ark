/**
 * 진단 기록 — **침묵을 소리 나게 만드는 장치** (2026-08-05)
 *
 * ★★★ **왜 이 파일이 생겼나.**
 *
 *   실기기에서 "게임이 멈춘다"는 제보가 반복됐는데, 저장소 어디에도 그 사건이
 *   **흔적을 남기는 곳이 없었다.** WebGL 컨텍스트 손실 처리 0곳 · 전역 에러 핸들러
 *   0곳 · 씬 루프 보호 0곳. 그래서 다음 셋 중 무엇이 일어나도 화면은 그냥 멈추고,
 *   우리는 영원히 알 수 없었다:
 *
 *     ① 프레임 안에서 **예외 한 번** → Phaser 의 RAF 루프가 스스로 죽는다
 *        (`dom/RequestAnimationFrame.js` 의 `step` 은 `callback(time)` 이 **던지면
 *        다음 `requestAnimationFrame` 을 예약하지 못한다** — 영구 정지다.
 *        DOM 은 멀쩡히 살아 있으므로 HUD 버튼은 계속 눌린다. 제보의 모양 그대로다)
 *     ② **WebGL 컨텍스트 손실** (안드로이드 메모리 압박 · GPU 드라이버) → 캔버스 정지
 *     ③ `loop.sleep()` 후 **깨우는 신호가 오지 않음** (`native/lifecycle.js`) → 정지
 *
 *   `stats.spawnDropped` · `projectileDropped` 가 존재하는 이유와 같다:
 *   **말없이 사라지는 것을 세는 자리를 만든다.** 원인을 추측해 고치는 것보다
 *   원인이 스스로 드러나게 하는 것이 먼저다.
 *
 * ★★ **배포 빌드에서 살아 있어야 한다.** 사용자가 쓰는 것은 `npm run build` 로 만든
 *   APK 이고 거기서 `import.meta.env.DEV` 는 false 다. 그래서 이 모듈에는 DEV 가드가
 *   하나도 없고, 콘솔 출력도 `warn`/`error` 만 쓴다 (`check:prod` 의 S1 규율).
 *
 * ★★ **감시가 부하가 되면 안 된다** (절대규칙 7).
 *   기록은 **미리 할당한 링버퍼**에 쓴다 — 정상 프레임에서 이 모듈이 하는 일은
 *   rAF 콜백 하나에서 숫자 몇 개를 빼는 것뿐이고, 할당이 0 이다.
 *   맥락(웨이브 · 엔티티 수 …)은 **기록하는 순간에만** 씬에게 물어본다
 *   (`setContextProvider`) — 매 프레임 수집하면 그 자체가 비용이 된다.
 *
 * ★★ **삼키지 않는다.** 잡는 이유는 루프를 살리기 위해서지 없던 일로 만들기
 *   위해서가 아니다. 모든 기록은 (ⓐ) 콘솔 (ⓑ) 화면 배너(`components/FaultOverlay`)
 *   (ⓒ) 설정 > 데이터 > 진단 기록 세 곳에 동시에 남는다.
 *
 * ★ 수치는 `game/data/quality.json:watchdog` 이 갖는다 (절대규칙 4).
 *
 * @see src/components/FaultOverlay.jsx
 * @see src/game/GameManager.js  (루프 보호 · 컨텍스트 손실 · 생존 감시)
 */
import QUALITY_DATA from "@/game/data/quality.json";
/**
 * ★ React 가 아니므로 훅이 아니라 모듈 함수를 쓴다.
 * ★★ **언제 번역하는가가 두 갈래다.** 종류 이름(`faultLabel`)과 맥락
 *   (`describeFaultContext`)은 **그릴 때** 번역하므로 언어를 바꾸면 즉시 따라온다.
 *   기록 문구(`msg`)는 **기록하는 순간** 번역되어 링버퍼와 localStorage 에 문자열로
 *   굳는다 — 지난 실행의 기록까지 다시 번역하려면 링버퍼가 키와 인자를 들어야 하고,
 *   그것은 "곧 죽을지도 모르는 순간에 최소한만 한다"는 이 파일의 태도와 어긋난다.
 */
import { t } from "@/i18n";

/** 기록 종류 */
export const FAULT = {
    /** window.onerror — 어디서든 튀어나온 예외 */
    EXCEPTION: "exception",
    /** 처리되지 않은 Promise 거부 (청크 로드 실패가 여기로 온다) */
    PROMISE: "promise",
    /** 씬 update() 안에서 터졌다 */
    SCENE: "scene",
    /** 프레임(렌더·트윈 콜백·이벤트 소비) 안에서 터졌다 — 루프를 살려 낸 자리 */
    FRAME: "frame",
    /** React 렌더가 실패했다 (ScreenErrorBoundary) */
    SCREEN: "screen",
    /** WebGL 컨텍스트 손실 · 복원 */
    CONTEXT_LOST: "context-lost",
    CONTEXT_RESTORED: "context-restored",
    /** 화면은 보이는데 게임 루프가 멈춰 있었다 */
    LOOP_DEAD: "loop-dead",
    /** 프레임 간격이 임계를 넘었다 */
    STALL: "stall",
    /**
     * 지난 실행이 **응답 없이** 끝났다 (심장박동이 끊긴 채 다음 실행이 시작됨).
     *
     * ★★★ 이것이 이 파일에서 가장 중요한 종류다. 메인 스레드가 무한 루프에
     *   갇히면 — 2026-08-05 의 `syncProjectiles` 가 정확히 그랬다 —
     *   **페이지 안의 어떤 계측도 돌지 않는다.** rAF 도 타이머도 이벤트도 없다.
     *   그때 남는 유일한 증거는 **멈추기 직전에 이미 디스크에 적어 둔 것**이다.
     *   그래서 감시자는 몇 초마다 "살아 있음 + 지금 상황"을 저장소에 남기고,
     *   정상 종료(백그라운드 전환)에서만 그 표식을 지운다.
     *   다음 실행이 표식을 발견하면 그것이 곧 "지난번에 얼어붙었다"는 뜻이다.
     */
    HANG: "hang",
};

/**
 * 사용자에게 보여 줄 종류 이름.
 *
 * ★★★ **표가 아니라 함수다** (2026-08-07). 예전에는 모듈 스코프의 객체였는데,
 *   그러면 **부팅 시점의 언어로 굳는다** — 이 모듈은 `main.jsx` 가 가장 먼저
 *   부르므로 그 시점은 언제나 하이드레이션 이전이고, 설정에서 언어를 바꿔도
 *   진단 화면만 이전 언어로 남는다. 조회할 때마다 번역하면 그 경로가 없다.
 *
 * ★★ 키를 `"system.fault" + kind` 로 만들지 않고 **`switch` 로 하나씩 적는다.**
 *   문자열을 이어 붙이면 `check:i18n` 의 선언 ↔ 소비 대조(I6)가 그 키들을
 *   "아무도 부르지 않는 키"로 보고, 종류를 하나 지워도 아무도 실패하지 않는다 —
 *   이 저장소가 반복해서 당한 "선언했는데 아무도 읽지 않는 것"의 모양이다.
 *
 * @param {string} kind FAULT.*
 * @returns {string} 모르는 종류면 그 id 를 그대로 (침묵보다 낫다)
 */
export function faultLabel(kind) {
    switch (kind) {
        case FAULT.EXCEPTION:
            return t("system.faultException");
        case FAULT.PROMISE:
            return t("system.faultPromise");
        case FAULT.SCENE:
            return t("system.faultScene");
        case FAULT.FRAME:
            return t("system.faultFrame");
        case FAULT.SCREEN:
            return t("system.faultScreen");
        case FAULT.CONTEXT_LOST:
            return t("system.faultContextLost");
        case FAULT.CONTEXT_RESTORED:
            return t("system.faultContextRestored");
        case FAULT.LOOP_DEAD:
            return t("system.faultLoopDead");
        case FAULT.STALL:
            return t("system.faultStall");
        case FAULT.HANG:
            return t("system.faultHang");
        default:
            return String(kind ?? "");
    }
}

/**
 * 배너를 띄우지 않는 종류.
 * ★ 지연(stall)은 **자주** 일어날 수 있다. 그때마다 화면을 가리면 배너 자체가
 *   버그가 된다 — 지연은 조용히 쌓아 두고 설정 화면에서 읽는다.
 * ★ 복원은 좋은 소식이므로 배너로 덮지 않는다 (손실 배너가 이미 떠 있다).
 *
 * ★★★ **무응답 종료(HANG)도 여기로 옮겼다** (2026-08-07, 사용자 요청 —
 *   "상단에 무응답 종료 알림이 뜨는 것도 이제는 보이지 않게").
 *
 *   이 배너는 원래 **개발 중 진단**을 위한 것이었다. 앱이 응답 없이 죽은 뒤 다시
 *   켠 그 순간이 무슨 일이 있었는지 말해 줄 수 있는 유일한 순간이라, 그때 한 번
 *   띄우게 해 두었다. 그 목적은 이미 달성됐다.
 *
 *   그런데 출시 빌드에서 이 배너는 **오탐이 사람을 놀라게 하는 쪽**이 훨씬 크다:
 *   OS 가 메모리 압박으로 프로세스를 정리하거나, 사용자가 앱 전환기에서 밀어
 *   껐거나, 기기가 잠들었을 때도 `clean` 플래그가 남지 않아 **정상 종료가
 *   '응답 없이 끝났다'로 보고된다.** 게임을 켤 때마다 빨간 경고를 보는 것은
 *   그 자체로 품질이 나빠 보이는 일이다.
 *
 * ★ **탐지와 기록은 그대로 둔다.** `checkLastRun()` 은 계속 돌고 기록도 남는다 —
 *   설정 > 데이터 > 진단 기록에서 읽을 수 있다. 사라지는 것은 **배너뿐**이다.
 *   되살리려면 이 집합에서 `FAULT.HANG` 만 빼면 된다.
 */
const QUIET = new Set([FAULT.STALL, FAULT.CONTEXT_RESTORED, FAULT.HANG]);

const W = QUALITY_DATA.watchdog;
/** 링버퍼 크기 = 남길 최근 기록 수 */
const SIZE = W.records;
/** 이 간격을 넘은 프레임을 '멈춤'으로 본다 */
const STALL_MS = W.stallMs;
/** 화면이 보이는데 게임 루프가 이만큼 멈춰 있으면 죽은 것으로 본다 */
const LOOP_DEAD_MS = W.loopDeadMs;
/** 저장소에 밀어 넣는 최소 간격 — 기록이 몰아쳐도 디스크를 때리지 않는다 */
const PERSIST_MS = W.persistMs;
/** 심장박동 간격 — 이보다 촘촘히 적어도 알아낼 수 있는 것이 늘지 않는다 */
const HEARTBEAT_MS = W.heartbeatMs;

/** 문구가 길어지면 저장소가 부풀고 화면에서도 읽히지 않는다 */
const MAX_MSG = 160;
const MAX_STACK = 320;

/**
 * ★ localStorage 다. 세이브(`native/storage.js`)와 달리 **동기**여야 한다 —
 *   기록이 남아야 하는 순간은 앱이 곧 죽을지도 모르는 순간이고, 그때
 *   `await` 하나가 그대로 유실이 된다. 진단 로그는 잃어도 게임이 안 망가진다.
 */
const STORE_KEY = "riftark-diagnostics";
/** 심장박동 — 마지막으로 살아 있던 시각과 그때의 상황 */
const BEAT_KEY = "riftark-diagnostics-beat";

/* ── 링버퍼 ─────────────────────────────────────────────────
 *
 * ★ 레코드 객체를 **미리 만들어 둔다.** 기록할 때 객체를 새로 만들면 하필
 *   가장 나쁜 순간(스톨 · 예외 폭주)에 GC 압력을 더한다.
 */

/** @returns {object} 빈 레코드 */
function blank() {
    return {
        kind: "",
        /** 벽시계 (사용자에게 보여 줄 시각) */
        at: 0,
        /** 부팅 후 경과 초 */
        t: 0,
        msg: "",
        stack: "",
        /** 프레임 지연이면 그 길이(ms) */
        ms: 0,
        /* ── 맥락 (contextProvider 가 채운다) ── */
        scene: "",
        wave: 0,
        actives: 0,
        projectiles: 0,
        dmgText: 0,
        tweens: 0,
        /** 풀이 모자라 그리지 못한 발사체 수 (`BattleScene._projUndrawn`) */
        undrawn: 0,
        heapMB: 0,
        /** 같은 기록이 이어지면 줄을 늘리지 않고 센다 */
        count: 0,
    };
}

const ring = new Array(SIZE);
for (let i = 0; i < SIZE; i++) ring[i] = blank();
/** 다음에 쓸 자리 */
let head = 0;
/** 채워진 개수 */
let filled = 0;
/** 스냅샷 식별자 — useSyncExternalStore 가 이것만 본다 */
let version = 0;

const listeners = new Set();
/** @type {((rec: object) => void)|null} */
let contextProvider = null;
/** @type {(() => number)|null} 게임 루프가 마지막으로 돈 시각(performance.now) */
let livenessProbe = null;
/** 사용자가 배너를 닫은 기록 번호 */
let dismissedVersion = -1;

/** 최근 기록(최신 먼저)의 사본. 화면이 그릴 때만 부른다 */
export function listFaults() {
    const out = [];
    for (let i = 0; i < filled; i++) {
        const rec = ring[(head - 1 - i + SIZE * 2) % SIZE];
        if (rec.kind) out.push(rec);
    }
    return out;
}

/**
 * 기록 하나의 맥락을 사람이 읽는 한 줄로.
 *
 * ★★ **이 한 줄이 제보의 전부가 된다.** 실기기 사용자는 개발자 도구를 열 수 없고,
 *   화면을 찍어 보내는 것이 그가 할 수 있는 전부다. 그러니 여기에 재현에 필요한
 *   숫자가 전부 있어야 한다 — 어느 스테이지 · 몇 웨이브 · 동시 엔티티 · 발사체.
 *
 * ★ 0 인 값은 적지 않는다. 의미 없는 0 이 줄을 채우면 읽히지 않는다.
 */
export function describeFaultContext(f) {
    if (!f) return "";
    const parts = [];
    if (f.scene) parts.push(f.scene);
    if (f.wave) parts.push(t("system.ctxWave", { n: f.wave }));
    if (f.actives) parts.push(t("system.ctxActives", { n: f.actives }));
    if (f.projectiles) parts.push(t("system.ctxProjectiles", { n: f.projectiles }));
    if (f.undrawn > 0) parts.push(t("system.ctxUndrawn", { n: f.undrawn }));
    if (f.dmgText) parts.push(t("system.ctxDmgText", { n: f.dmgText }));
    if (f.tweens) parts.push(t("system.ctxTweens", { n: f.tweens }));
    if (f.heapMB) parts.push(t("system.ctxHeap", { n: f.heapMB }));
    return parts.join(" · ");
}

/** 구독 (React `useSyncExternalStore` 용) */
export function subscribeFaults(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
}

/** 스냅샷 — 값이 바뀔 때만 증가하는 정수 */
export function faultVersion() {
    return version;
}

/**
 * 배너로 알려야 하는 가장 최근 기록. 없으면 null.
 * ★ 사용자가 닫았으면 **그 시점 이후의 기록만** 다시 띄운다 — 같은 배너가
 *   닫아도 계속 돌아오면 사용자는 앱을 지운다.
 */
export function activeFault() {
    if (version <= dismissedVersion) return null;
    for (let i = 0; i < filled; i++) {
        const rec = ring[(head - 1 - i + SIZE * 2) % SIZE];
        if (rec.kind && !QUIET.has(rec.kind)) return rec;
    }
    return null;
}

/** 배너 닫기. 기록은 남는다 (설정 > 데이터 > 진단 기록) */
export function dismissFault() {
    // ★ `notify()` 가 version 을 올리므로 **올라간 뒤의 값**을 적어야 한다.
    //   현재 값을 적으면 닫는 그 순간 배너가 되살아난다.
    dismissedVersion = version + 1;
    notify();
}

/** 기록 전체 삭제 */
export function clearFaults() {
    for (let i = 0; i < SIZE; i++) {
        const r = ring[i];
        r.kind = "";
        r.count = 0;
    }
    head = 0;
    filled = 0;
    dismissedVersion = -1;
    try {
        globalThis.localStorage?.removeItem(STORE_KEY);
    } catch {
        /* 저장소가 없어도 기록 자체는 동작해야 한다 */
    }
    notify();
}

function notify() {
    version++;
    for (const cb of listeners) cb();
}

const clip = (s, n) => (typeof s === "string" ? (s.length > n ? `${s.slice(0, n)}…` : s) : "");

/**
 * 스택의 **앞 3줄**만 남긴다.
 * ★ 전량을 남기면 저장소가 부풀고, 무엇보다 화면에서 아무도 읽지 않는다.
 *   터진 자리를 아는 데 필요한 것은 맨 위 몇 줄이다.
 */
function headOfStack(err) {
    const raw = typeof err === "string" ? err : (err?.stack ?? "");
    if (!raw) return "";
    const lines = raw.split("\n");
    // 첫 줄이 메시지의 반복이면 건너뛴다 (V8 의 관례)
    const start = lines[0] && !lines[0].trim().startsWith("at") ? 1 : 0;
    return clip(lines.slice(start, start + 3).join("\n").trim(), MAX_STACK);
}

/**
 * 기록 한 건.
 *
 * ★ 같은 종류 · 같은 문구가 **연속**이면 줄을 늘리지 않고 센다. 예외는 대개
 *   매 프레임 재발하므로, 세지 않으면 링버퍼가 한 사건으로 가득 차서
 *   그 앞의 기록(원인일 수 있는 것)이 밀려 나간다.
 *
 * @param {string} kind FAULT.*
 * @param {string} msg
 * @param {Error|string} [err] 스택을 뽑을 대상
 * @param {number} [ms] 프레임 지연이면 그 길이
 */
export function recordFault(kind, msg, err, ms = 0) {
    const text = clip(String(msg ?? ""), MAX_MSG);
    const prev = ring[(head - 1 + SIZE) % SIZE];
    const now = performance.now();

    if (filled > 0 && prev.kind === kind && prev.msg === text) {
        prev.count++;
        prev.at = Date.now();
        prev.t = Math.round(now / 100) / 10;
        if (ms > prev.ms) prev.ms = Math.round(ms);
        notify();
        schedulePersist();
        return prev;
    }

    const rec = ring[head];
    rec.kind = kind;
    rec.at = Date.now();
    rec.t = Math.round(now / 100) / 10;
    rec.msg = text;
    rec.stack = headOfStack(err);
    rec.ms = Math.round(ms);
    rec.count = 1;
    rec.scene = "";
    rec.wave = 0;
    rec.actives = 0;
    rec.projectiles = 0;
    rec.dmgText = 0;
    rec.tweens = 0;
    rec.undrawn = 0;
    rec.heapMB = heapMB();
    // ★ 맥락은 **여기서만** 묻는다. 매 프레임 모으면 감시가 부하가 된다.
    try {
        contextProvider?.(rec);
    } catch {
        /* 맥락 수집 실패가 기록을 막지 않는다 */
    }

    head = (head + 1) % SIZE;
    if (filled < SIZE) filled++;

    /**
     * ★ 콘솔은 **영어**다 (i18n 규약). 여기 남는 것은 스택 트레이스와 함께 읽히고
     *   이슈에 붙여지는 것이므로, 화면 언어를 따라가면 검색이 안 된다.
     */
    if (kind === FAULT.STALL) {
        console.warn(`[diag] ${kind} ${rec.ms}ms — ${text}`);
    } else {
        console.error(`[diag] ${kind} — ${text}`, rec.stack);
    }

    notify();
    schedulePersist();
    return rec;
}

/**
 * ★ `performance.memory` 는 Chromium 전용이지만 안드로이드 WebView 도 Chromium 이다.
 *   없으면 0 — 없는 값을 지어내지 않는다.
 */
function heapMB() {
    const m = performance.memory;
    return m ? Math.round(m.usedJSHeapSize / 1048576) : 0;
}

/* ── 영속 ───────────────────────────────────────────────────
 *
 * ★★ **왜 저장하는가.** 앱이 통째로 죽거나(OOM) 사용자가 강제 종료하면 메모리의
 *   기록은 같이 사라진다. 그런데 우리가 가장 알고 싶은 것이 바로 **그 직전**이다.
 *   다음에 앱을 켰을 때 설정 화면에서 읽을 수 있어야 제보가 성립한다.
 *
 * ★ 세이브와 달리 localStorage 를 쓴다 — 동기여야 하고(곧 죽을지 모르는 순간이다),
 *   잃어도 게임이 망가지지 않는다.
 */
let persistAt = 0;
let persistTimer = null;

function schedulePersist() {
    const now = performance.now();
    if (now - persistAt >= PERSIST_MS) {
        persistNow();
        return;
    }
    if (persistTimer !== null) return;
    persistTimer = setTimeout(persistNow, PERSIST_MS - (now - persistAt));
}

function persistNow() {
    if (persistTimer !== null) {
        clearTimeout(persistTimer);
        persistTimer = null;
    }
    persistAt = performance.now();
    try {
        globalThis.localStorage?.setItem(STORE_KEY, JSON.stringify(listFaults()));
    } catch {
        /* 용량 초과·비활성 — 진단이 앱을 방해하지 않는다 */
    }
}

/**
 * 지난 실행의 기록을 링버퍼에 되살린다.
 * ★ 배너는 띄우지 않는다 (`dismissedVersion` 을 현재로 맞춘다) — 어제의 사고로
 *   오늘의 화면을 가리지 않는다. 설정 화면에는 그대로 보인다.
 */
export function restoreFaults() {
    let raw = null;
    try {
        raw = globalThis.localStorage?.getItem(STORE_KEY) ?? null;
    } catch {
        return 0;
    }
    if (!raw) return 0;
    let arr;
    try {
        arr = JSON.parse(raw);
    } catch {
        return 0;
    }
    if (!Array.isArray(arr)) return 0;

    // 저장은 최신 먼저 — 오래된 것부터 되넣어야 순서가 유지된다
    for (let i = Math.min(arr.length, SIZE) - 1; i >= 0; i--) {
        const src = arr[i];
        if (!src || typeof src !== "object" || !src.kind) continue;
        const rec = ring[head];
        for (const k in rec) rec[k] = src[k] ?? (typeof rec[k] === "number" ? 0 : "");
        head = (head + 1) % SIZE;
        if (filled < SIZE) filled++;
    }
    version++;
    dismissedVersion = version;
    return filled;
}

/* ── 심장박동 (블랙박스) ─────────────────────────────────────
 *
 * ★★★ **무한 루프는 페이지 안에서 관측할 수 없다.** 메인 스레드가 갇히면 rAF 도
 *   타이머도 이벤트도 돌지 않으므로, "멈췄다"를 그 자리에서 적을 방법이 없다.
 *   남는 길은 하나뿐이다 — **멈추기 전에 미리 적어 두는 것.**
 *
 *   그래서 감시자는 몇 초마다 "지금 살아 있고, 상황은 이렇다"를 저장소에 남긴다.
 *   앱이 정상적으로 배경으로 갈 때만 `clean` 표식을 세우고, 다음 실행이 표식 없는
 *   심장박동을 발견하면 **지난 실행이 응답 없이 끝났다**는 뜻이 된다.
 *   그때의 웨이브 · 엔티티 수 · 발사체 수가 함께 남으므로, 사용자는 PC 없이
 *   설정 화면의 숫자를 읽어 주는 것만으로 재현 조건을 알려줄 수 있다.
 */

/** ★ 매번 객체를 만들지 않는다 — 돌려쓴다 (절대규칙 7) */
const beat = {
    at: 0,
    clean: false,
    scene: "",
    wave: 0,
    actives: 0,
    projectiles: 0,
    dmgText: 0,
    tweens: 0,
    undrawn: 0,
    heapMB: 0,
};
let beatAt = 0;

function writeBeat(clean) {
    beat.at = Date.now();
    beat.clean = clean;
    beat.heapMB = heapMB();
    try {
        contextProvider?.(beat);
    } catch {
        /* 맥락 수집 실패가 심장박동을 막지 않는다 */
    }
    try {
        globalThis.localStorage?.setItem(BEAT_KEY, JSON.stringify(beat));
    } catch {
        /* 저장소가 없으면 블랙박스만 없는 것이지 게임은 돈다 */
    }
}

/**
 * 지난 실행이 응답 없이 끝났는지 본다. 그랬다면 기록 한 건을 남긴다.
 * ★ 이것은 배너를 띄운다 — 사용자가 앱을 다시 켠 그 순간이, 무슨 일이 있었는지
 *   말해 줄 수 있는 **유일한 순간**이다.
 * @returns {boolean} 무응답 종료를 발견했는가
 */
export function checkLastRun() {
    let raw = null;
    try {
        raw = globalThis.localStorage?.getItem(BEAT_KEY) ?? null;
    } catch {
        return false;
    }
    if (!raw) return false;
    try {
        globalThis.localStorage?.removeItem(BEAT_KEY);
    } catch {
        /* 지우지 못해도 아래에서 한 번은 신고한다 */
    }

    let hb;
    try {
        hb = JSON.parse(raw);
    } catch {
        return false;
    }
    if (!hb || hb.clean) return false;

    const rec = recordFault(
        FAULT.HANG,
        t("system.msgHang", {
            scene: hb.scene || t("system.unknownScene"),
            wave: hb.wave ?? 0,
        }),
        null
    );
    // ★ 맥락은 **그때 것**으로 덮어쓴다. 지금 것은 아무 의미가 없다.
    rec.scene = hb.scene ?? "";
    rec.wave = hb.wave ?? 0;
    rec.actives = hb.actives ?? 0;
    rec.projectiles = hb.projectiles ?? 0;
    rec.dmgText = hb.dmgText ?? 0;
    rec.tweens = hb.tweens ?? 0;
    rec.undrawn = hb.undrawn ?? 0;
    rec.heapMB = hb.heapMB ?? 0;
    rec.at = hb.at ?? rec.at;
    persistNow();
    return true;
}

/* ── 맥락 · 생존 신호 ───────────────────────────────────────── */

/**
 * 기록 순간의 맥락을 채워 줄 함수를 등록한다 (전투 씬이 부른다).
 * ★ 호출은 기록할 때뿐이다 — 정상 프레임에서는 한 번도 불리지 않는다.
 * @param {((rec: object) => void)|null} fn
 */
export function setContextProvider(fn) {
    contextProvider = fn;
}

/** 등록한 것과 같은 함수일 때만 해제한다 (씬 전환 경합 방어) */
export function clearContextProvider(fn) {
    if (contextProvider === fn) contextProvider = null;
}

/**
 * 게임 루프가 마지막으로 돈 시각(performance.now)을 돌려주는 함수.
 * ★ 이것이 rAF 는 도는데 **게임만** 멈춘 상태를 잡는 유일한 방법이다.
 *   `GameManager` 가 등록한다.
 * @param {(() => number)|null} fn
 */
export function setLivenessProbe(fn) {
    livenessProbe = fn;
}

/* ── 프레임 감시 ────────────────────────────────────────────
 *
 * ★ rAF 콜백 하나에 숫자 몇 개. 배열도 문자열도 만들지 않는다 (절대규칙 7).
 */

let watchHandle = 0;
let lastFrameAt = 0;
/** 루프 정지를 한 사건당 한 번만 신고하기 위한 빗장 */
let loopDeadReported = false;
/** @type {((atMs:number)=>void)|null} 루프가 죽었을 때 깨울 사람 (GameManager) */
let reviveLoop = null;

/**
 * 루프가 죽은 것을 발견했을 때 부를 복구 함수를 등록한다.
 * ★★ **조용한 복구가 아니다.** 부르기 전에 기록하고 배너를 띄운다 —
 *   무슨 일이 있었는지 말하지 않고 되살리면 이 사건은 영원히 재현되지 않는다.
 */
export function setLoopReviver(fn) {
    reviveLoop = fn;
}

/**
 * 지연의 심각도 구간. 사람이 읽는 말이면서 **합치기의 열쇠**다.
 * ★ 2초를 넘으면 그것은 더 이상 '끊김'이 아니라 '멈춤'이다 — 사용자가 앱이
 *   죽었다고 판단하기 시작하는 지점이라 따로 센다.
 */
function stallBucket(ms) {
    if (ms >= 2000) return t("system.stallOver2s");
    if (ms >= 1000) return t("system.stall1to2s");
    return t("system.stallUnder1s");
}

function tick() {
    const now = performance.now();
    const dt = now - lastFrameAt;
    lastFrameAt = now;

    if (dt > STALL_MS) {
        // ★ 첫 프레임(부팅 직후)과 백그라운드 복귀는 지연이 아니다.
        if (watchHandle && document.visibilityState === "visible") {
            /**
             * ★★ 문구를 **구간으로 뭉갠다.** `프레임 548ms` 처럼 숫자를 넣으면
             *   지연마다 다른 문구가 되어 링버퍼(24칸)가 지연으로 가득 차고,
             *   그 앞의 예외 — 원인일 수 있는 것 — 가 밀려 나간다.
             *   구간이면 한 줄에 횟수로 쌓이고 `ms` 칸에 최댓값이 남는다.
             */
            recordFault(FAULT.STALL, t("system.msgStall", { b: stallBucket(dt) }), null, dt);
        }
    }

    if (livenessProbe && document.visibilityState === "visible") {
        const since = now - livenessProbe();
        if (since > LOOP_DEAD_MS) {
            if (!loopDeadReported) {
                loopDeadReported = true;
                /**
                 * ★ 문구에 숫자를 넣지 않는다. 넣으면 매번 다른 문구가 되어
                 *   같은 사건이 링버퍼를 가득 채운다 (`recordFault` 의 합치기는
                 *   문구가 같을 때만 동작한다). 길이는 `ms` 칸에 담긴다.
                 */
                recordFault(FAULT.LOOP_DEAD, t("system.msgLoopDead"), null, since);
                reviveLoop?.(now);
            }
        } else {
            loopDeadReported = false;
        }
    }

    // ★ 블랙박스 — 무한 루프는 이 기록으로만 드러난다 (위 §심장박동)
    if (now - beatAt >= HEARTBEAT_MS) {
        beatAt = now;
        writeBeat(false);
    }

    watchHandle = requestAnimationFrame(tick);
}

/** 프레임 감시 시작 (멱등). @returns {() => void} 중지 함수 */
export function startFrameWatch() {
    if (watchHandle) return stopFrameWatch;
    lastFrameAt = performance.now();
    watchHandle = requestAnimationFrame(tick);
    return stopFrameWatch;
}

export function stopFrameWatch() {
    if (!watchHandle) return;
    cancelAnimationFrame(watchHandle);
    watchHandle = 0;
}

/* ── 전역 예외 ──────────────────────────────────────────────── */

function onError(e) {
    const err = e?.error;
    const where = e?.filename ? ` (${String(e.filename).split("/").pop()}:${e.lineno})` : "";
    const msg = e?.message ?? err?.message ?? t("system.unknownException");
    recordFault(FAULT.EXCEPTION, `${msg}${where}`, err);
}

function onRejection(e) {
    const r = e?.reason;
    recordFault(FAULT.PROMISE, r?.message ?? String(r ?? t("system.unknownFailure")), r);
}

/**
 * ★ 배경으로 갈 때가 **유일한 정상 종료 신호**다. 안드로이드는 프로세스를
 *   예고 없이 죽이므로 `pagehide` 를 기다릴 수 없다.
 */
/** 부팅 확인(지난 실행 점검)을 이미 했는가 — 프로세스당 한 번 */
let bootChecked = false;

function onHide(e) {
    // `pagehide` 는 아직 visible 상태에서 온다 — 종류로 가른다
    if (e?.type !== "pagehide" && document.visibilityState !== "hidden") return;
    persistNow();
    writeBeat(true);
}

/**
 * 전역 핸들러 설치 (`App.jsx` 에서 한 번).
 *
 * ★ 순서가 중요하다: 지난 기록을 먼저 되살리고(배너 없이), 그 다음 지난 실행이
 *   응답 없이 끝났는지 본다 — **그것만은 배너로 알린다.** 앱을 다시 켠 순간이
 *   무슨 일이 있었는지 말해 줄 수 있는 유일한 순간이다.
 *
 * @returns {() => void} 해제 함수
 */
export function installDiagnostics() {
    /**
     * ★★★ **부팅 확인은 프로세스당 한 번뿐이다** (2026-08-05 실측).
     *
     *   React StrictMode 는 이펙트를 mount → cleanup → mount 로 두 번 돌린다.
     *   처음엔 그대로 두었더니 ⓐ 첫 설치가 '무응답 종료'를 기록하고
     *   ⓑ 두 번째 설치의 `restoreFaults()` 가 **방금 기록한 것을 다시 읽어
     *   링버퍼에 복사**한 뒤 ⓒ `dismissedVersion` 을 현재로 맞춰
     *   **그 배너를 눌러 보지도 못하게 꺼 버렸다.** 브라우저에서 렌더러를 실제로
     *   죽여 보고서야 드러났다 (기록은 남는데 화면에는 아무것도 안 뜬다).
     */
    if (!bootChecked) {
        bootChecked = true;
        restoreFaults();
        checkLastRun();
    }
    globalThis.addEventListener?.("error", onError);
    globalThis.addEventListener?.("unhandledrejection", onRejection);
    globalThis.addEventListener?.("pagehide", onHide);
    document.addEventListener?.("visibilitychange", onHide);
    startFrameWatch();
    return () => {
        globalThis.removeEventListener?.("error", onError);
        globalThis.removeEventListener?.("unhandledrejection", onRejection);
        globalThis.removeEventListener?.("pagehide", onHide);
        document.removeEventListener?.("visibilitychange", onHide);
        stopFrameWatch();
        persistNow();
        /**
         * ★ 여기서 '정상 종료' 표식을 찍지 않는다. 언마운트는 앱이 끝났다는
         *   뜻이 아니다 (StrictMode 는 이 경로를 매번 지나간다). 정상 종료의
         *   유일한 신호는 화면이 배경으로 가는 것이다 — `onHide`.
         */
    };
}
