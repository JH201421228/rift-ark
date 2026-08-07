/**
 * 편성 분석 · 자동 추천 · 공유 코드 (P5-10/11/12)
 *
 * ★ 이 게임의 벽은 "숫자가 모자란 벽"이 아니라 "편성 퍼즐"이어야 한다.
 *   그러려면 플레이어가 자기 편성의 무엇이 부족한지 **전투 전에** 알 수 있어야 한다.
 *   3번 지고 나서야 대공이 없다는 걸 깨닫는 것은 퍼즐이 아니라 정보 은닉이다.
 *
 * ★ 여기서도 난수를 쓰지 않는다. 같은 편성 + 같은 스테이지는 항상 같은 진단을 낸다.
 *
 * @see docs/02-design/13-progression-meta.md §5
 */
import unitsData from "../data/units.json" with { type: "json" };
import enemiesData from "../data/enemies.json" with { type: "json" };
import stagesData from "../data/stages.json" with { type: "json" };
import { ROLE_ORDER, BACKLINE_ROLES } from "./roles.js";
/**
 * ★★ 경고 문장은 두 언어를 `i18n/messages/rules.json` 이 갖는다 (2026-08-07).
 *   키는 경고의 **안정 `code` 그대로**다 (`rules.warn.<code>`) — code 는 이미 화면과
 *   테스트가 쓰는 식별자이므로, 번역 키를 따로 만들면 같은 사실이 두 곳에 적힌다.
 */
import { t } from "../../i18n/index.js";

const UNIT = Object.fromEntries(unitsData.units.map((u) => [u.id, u]));
const ENEMY = Object.fromEntries(enemiesData.enemies.map((e) => [e.id, e]));

/**
 * ★ 여기서 정의하지 않는다. `roles.js` 가 단일 출처다.
 *   예전에 여기 사본이 있었고 FLYER 가 빠져 있어서 편성 화면에서
 *   비행 동료 2종이 통째로 사라졌다. 기존 import 경로를 위해 재수출만 한다.
 * ★ 역할 **이름**은 재수출하지 않는다 — `roles.js:roleLabel()` 을 직접 부를 것.
 *   (상수 `ROLE_LABEL_KO` 는 언어 전환을 따라가지 못해 2026-08-07 에 사라졌다.)
 */
export { ROLE_ORDER };

export const SEVERITY = { CRITICAL: "critical", WARN: "warn", INFO: "info" };

/** 스테이지에 실제로 나오는 적 태그·이름 집합 */
export function stageThreats(stageId) {
    const stage = stagesData.stages.find((s) => s.id === stageId);
    if (!stage) return { tags: new Set(), ids: [], hasFlying: false, hasArmored: false };

    const ids = new Set();
    const tags = new Set();
    for (const w of stage.waveTable) {
        for (const sp of w.spawns) {
            ids.add(sp.id);
            for (const t of ENEMY[sp.id]?.tags ?? []) tags.add(t);
        }
    }
    return {
        tags,
        ids: [...ids],
        hasFlying: tags.has("FLYING"),
        hasArmored: tags.has("ARMORED"),
        hasSwarm: tags.has("SWARM"),
    };
}

/**
 * 편성 진단.
 *
 * @param {Array<string|null>} unitIds 6칸 (null 허용)
 * @param {string} [stageId] 주면 스테이지 특화 경고까지 낸다
 * @returns {{roles:object, dmgTypes:object, cost:number, avgCost:number,
 *            warnings:Array<{severity:string, code:string, text:string}>, fitness:number}}
 */
export function analyzeLoadout(unitIds, stageId = null) {
    const units = (unitIds ?? []).filter(Boolean).map((id) => UNIT[id]).filter(Boolean);

    const roles = Object.fromEntries(ROLE_ORDER.map((r) => [r, 0]));
    const dmgTypes = { physical: 0, arcane: 0, holy: 0 };
    let cost = 0;
    let antiAir = 0;

    for (const u of units) {
        roles[u.role] = (roles[u.role] ?? 0) + 1;
        dmgTypes[u.dmgType] = (dmgTypes[u.dmgType] ?? 0) + 1;
        cost += u.cost;
        // 원거리·시전자는 기본 대공. ANTI_AIR 태그는 근접에게도 대공을 준다.
        if (u.role === "RANGED" || u.role === "CASTER" || u.tags.includes("ANTI_AIR")) antiAir++;
    }

    const warnings = [];
    /**
     * ★ 문구를 받지 않는다. **code 가 곧 키다** — 호출부가 문장을 고르는 순간
     *   같은 경고가 두 문장을 갖게 되고, 그때 화면과 테스트가 갈라진다.
     * @param {object} [params] 자리표에 꽂을 값
     */
    const warn = (severity, code, params) =>
        warnings.push({ severity, code, text: t(`rules.warn.${code}`, params) });

    if (units.length === 0) {
        warn(SEVERITY.CRITICAL, "empty");
        return { roles, dmgTypes, cost, avgCost: 0, warnings, fitness: 0, count: 0 };
    }

    /* ── 구조 경고 (스테이지 무관) ── */
    if (roles.BLOCKER === 0) warn(SEVERITY.CRITICAL, "no_blocker");
    // ★ FLYER 도 후열 화력이다. 빠져 있어서 비행 편성이 "화력 없음"으로 오탐됐다.
    if (BACKLINE_ROLES.reduce((n, r) => n + (roles[r] ?? 0), 0) === 0) {
        warn(SEVERITY.CRITICAL, "no_damage");
    }
    if (units.length < 4) {
        // ★ 1칸은 영어에서 단수다 — `thinOne` 이 따로 있고, code 는 그대로 `thin` 이다
        //   (code 는 화면·테스트가 쓰는 식별자이므로 문법 때문에 갈라지면 안 된다).
        warnings.push({
            severity: SEVERITY.WARN,
            code: "thin",
            text: t(units.length === 1 ? "rules.warn.thinOne" : "rules.warn.thin", {
                n: units.length,
            }),
        });
    }
    const avgCost = cost / units.length;
    if (avgCost > 22) {
        warn(SEVERITY.WARN, "expensive");
    }
    if (units.length >= 4 && avgCost < 9) {
        warn(SEVERITY.INFO, "cheap");
    }
    if (dmgTypes.physical === units.length && units.length >= 3) {
        warn(SEVERITY.WARN, "physical_only");
    }

    /* ── 스테이지 특화 경고 ── */
    let fitness = 100;
    if (stageId) {
        const th = stageThreats(stageId);
        if (th.hasFlying && antiAir === 0) {
            warn(SEVERITY.CRITICAL, "no_anti_air");
        } else if (th.hasFlying && antiAir === 1) {
            warn(SEVERITY.WARN, "thin_anti_air");
        }
        if (th.hasArmored && dmgTypes.arcane + dmgTypes.holy === 0) {
            warn(SEVERITY.CRITICAL, "no_armor_break");
        }
        if (th.hasSwarm && roles.CASTER + roles.SIEGE === 0) {
            warn(SEVERITY.INFO, "no_splash");
        }
    }

    for (const w of warnings) {
        fitness -= w.severity === SEVERITY.CRITICAL ? 35 : w.severity === SEVERITY.WARN ? 12 : 4;
    }

    return {
        roles,
        dmgTypes,
        cost,
        avgCost: Math.round(avgCost * 10) / 10,
        count: units.length,
        antiAir,
        warnings,
        fitness: Math.max(0, Math.min(100, fitness)),
    };
}

/**
 * 자동 추천 편성 (P5-11).
 *
 * 보유 동료 중에서 스테이지 위협에 맞춰 6칸을 채운다.
 * 결정론적 그리디 — "추천을 눌렀는데 매번 다른 게 나온다"는 신뢰를 깎는다.
 *
 * @param {string[]} ownedIds
 * @param {string|null} stageId
 */
export function recommendLoadout(ownedIds, stageId = null, size = 6) {
    const pool = ownedIds.map((id) => UNIT[id]).filter(Boolean);
    if (!pool.length) return [];

    const th = stageId ? stageThreats(stageId) : { hasFlying: false, hasArmored: false, hasSwarm: false };
    const picked = [];
    const taken = new Set();

    const take = (pred) => {
        // 같은 조건이면 저코스트 우선 — 전개 속도가 곧 생존이다
        const cands = pool
            .filter((u) => !taken.has(u.id) && pred(u))
            .sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id));
        if (!cands.length) return false;
        taken.add(cands[0].id);
        picked.push(cands[0].id);
        return true;
    };

    const isAntiAir = (u) => u.role === "RANGED" || u.role === "CASTER" || u.tags.includes("ANTI_AIR");
    const breaksArmor = (u) => u.dmgType === "arcane" || u.dmgType === "holy";

    // 1. 방벽 2기 — 없으면 어떤 편성도 성립하지 않는다
    take((u) => u.role === "BLOCKER");
    take((u) => u.role === "BLOCKER");
    // 2. 위협 대응
    if (th.hasArmored) take(breaksArmor);
    if (th.hasFlying) take(isAntiAir);
    // 3. 기본 화력
    take((u) => u.role === "RANGED");
    if (th.hasSwarm) take((u) => u.role === "CASTER" || u.role === "SIEGE");
    // 4. 남는 칸은 코스트 대비 넓은 역할로 채운다
    while (picked.length < size) {
        const before = picked.length;
        take(() => true);
        if (picked.length === before) break;
    }

    return picked.slice(0, size);
}

/* ────────────────────────── 편성 공유 코드 (P5-12) ────────────────────────── */

/**
 * ★ 유닛 id 문자열을 그대로 인코딩하지 않는다.
 *   units.json 의 정렬 순서를 인덱스로 쓰면 코드가 짧아지지만,
 *   유닛을 추가·삭제하는 순간 예전 코드가 조용히 다른 편성으로 해석된다.
 *   따라서 id 를 그대로 담되, 버전 접두어로 해석 규칙을 못박는다.
 */
const CODE_VERSION = "A";
const SEP = ".";

/** @param {Array<string|null>} unitIds */
export function encodeLoadout(unitIds) {
    const body = (unitIds ?? [])
        .slice(0, 6)
        .map((id) => (id && UNIT[id] ? id : ""))
        .join(SEP);
    const sum = checksum(body);
    return `${CODE_VERSION}${sum}-${btoaUrl(body)}`;
}

/**
 * @returns {{ok: true, units: Array<string|null>} | {ok: false, reason: string}}
 */
export function decodeLoadout(code) {
    if (typeof code !== "string") return { ok: false, reason: t("rules.code.malformed") };
    const trimmed = code.trim();
    const dash = trimmed.indexOf("-");
    if (dash < 2) return { ok: false, reason: t("rules.code.malformed") };

    const version = trimmed[0];
    if (version !== CODE_VERSION) return { ok: false, reason: t("rules.code.version") };

    const sum = trimmed.slice(1, dash);
    let body;
    try {
        body = atobUrl(trimmed.slice(dash + 1));
    } catch {
        return { ok: false, reason: t("rules.code.corrupt") };
    }
    if (checksum(body) !== sum) return { ok: false, reason: t("rules.code.corrupt") };

    const parts = body.split(SEP);
    const units = parts.map((id) => (id && UNIT[id] ? id : null));
    if (units.every((u) => u === null)) return { ok: false, reason: t("rules.code.unknownUnits") };
    while (units.length < 6) units.push(null);
    return { ok: true, units: units.slice(0, 6) };
}

/** 4자리 36진수 체크섬 — 오타를 조용히 통과시키지 않기 위한 최소 장치 */
function checksum(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36).slice(-4).padStart(4, "0");
}

/**
 * base64url.
 * ★ btoa/atob 는 Node 16+ 에도 전역으로 있으므로 Buffer 폴백이 필요 없다.
 *   폴백을 두면 브라우저 번들에 Node shim 이 딸려 들어온다.
 * ★ 한글 이름이 들어가도 깨지지 않도록 UTF-8 로 먼저 바꾼다 (btoa 는 latin1 만 받는다).
 */
function btoaUrl(s) {
    const bytes = new TextEncoder().encode(s);
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function atobUrl(s) {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}
