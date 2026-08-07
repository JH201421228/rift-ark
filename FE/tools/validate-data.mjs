/**
 * 데이터 정합성 검사 (P4-06 / P4-07)
 *
 * ★ 기획자가 오타 하나로 게임을 깨뜨리는 것을 막는다.
 *   스키마 검사(형식)와 참조 검사(존재)를 함께 수행한다.
 *
 * 외부 스키마 라이브러리를 쓰지 않는 이유: 검사 규칙 대부분이
 * "이 id 가 저 파일에 있는가" 같은 **교차 참조**라 어차피 직접 짜야 한다.
 *
 * 사용: npm run data:validate
 *
 * @see docs/03-tech/24-data-schema.md §8
 */
import { readFile, readdir } from "node:fs/promises";
// ★ 효과음 논리 키도 같은 이유로 코드에서 직접 가져온다 (P3-14).
//   여기서 키 목록을 손으로 다시 적으면 검사기가 두 번째 출처가 된다.
import { ALL_SFX_KEYS } from "../src/game/fx/sfxKeys.js";
// ★ 역할 목록은 roles.js 가 **단일 출처**다. 여기서 다시 적으면 사본이 하나 더 늘고,
//   그 사본에 FLYER 가 빠져서 동료 2종이 편성 화면에서 사라진 적이 있다
//   (33-execution-plan.md '통합 감사' ①).
import { ROLE_ORDER } from "../src/game/logic/roles.js";
// ★ 대공 판정은 전투 코드가 유일한 출처다. "물리인데 대공 태그가 없는 비행 동료"는
//   공중 레인의 적을 평생 한 대도 못 때린다 — 문법은 완전하고 항목만 하나 없는,
//   테스트가 잡기 어려운 종류의 결함이다 (P6-04).
import { canHitFlying } from "../src/game/logic/combat.js";
import { tagsToMask } from "../src/game/logic/tags.js";
// ★ 영입 · 가이드 규칙도 규칙 모듈이 단일 출처다 (개수·가격·표를 여기 적지 않는다).
import {
    RECRUITABLE,
    isRecruitable,
    recruitCost,
    recruitUnlockStage,
} from "../src/game/logic/recruit.js";
import { STAGE_GRANTS, STARTING_UNITS } from "../src/game/logic/unlocks.js";
import { globalStageIndex as gIdx } from "../src/game/logic/difficulty.js";
import { FACT_KINDS as GUIDE_FACT_KINDS, guideFacts } from "../src/game/logic/guide.js";
// ★ 발사체 클립 경계 판정도 런타임과 **같은 함수**를 쓴다. 여기에 규칙을 다시 적으면
//   검사기가 구현과 갈라지고, 실제로 그렇게 갈라져서 "검사기가 통과시킨 것과
//   화면에 뜬 것이 다른 그림"이 됐다 (2026-08-05).
import { clipFrames, projectileFrame, ALL_FACINGS, USABLE_FACINGS } from "../src/game/projectileAnim.js";
// ★ 씬은 `UNIT_DEFS` 를 거쳐 발사체 아트를 본다. 데이터만 검사하면
//   "데이터에는 있는데 정규화가 놓쳐서 화면에는 없는" 상태를 통째로 놓친다 —
//   2026-08-04 에 정확히 그래서 30종 전원이 기본 탄 하나만 쐈다.
import { UNIT_DEFS, buildStageConfig } from "../src/game/logic/stageConfig.js";
// ★ "이 역할은 발사체를 쏘는가" 도 규칙 모듈이 단일 출처다. 여기에 목록을 다시 적었더니
//   그 사본이 아군만 보고 있었고, **적 11종이 사거리 190 을 들고 즉발로 때리는 것**을
//   4개월간 아무도 잡지 못했다 (2026-08-05).
import { PROJECTILE_ROLES, usesProjectile } from "../src/game/logic/roles.js";
// ★ "이 저장소가 아는 나이트메어 규칙" 도 규칙 모듈이 단일 출처다 (N2).
//   여기에 목록을 다시 적으면 데이터에만 있는 유령 규칙이 그 사본 뒤에 숨는다.
import { NIGHTMARE_IDS, nightmareFor } from "../src/game/logic/nightmare.js";

const DATA = "src/game/data";
const load = async (f) => JSON.parse(await readFile(`${DATA}/${f}`, "utf8"));

/**
 * 여러 디렉터리의 소스를 한 덩어리 문자열로 읽는다.
 *
 * ★ 데이터가 "코드에 이런 호출부가 있다" 고 주장할 때, 그 주장을 코드에서 확인하는
 *   유일한 방법이다 (LOADOUT_SIZE 대조와 같은 수법). 파싱하지 않는 이유는 검사기가
 *   두 번째 번들러가 되면 안 되기 때문이다 — 문자열 포함 검사면 충분하다.
 */
async function collectSourceText(dirs) {
    let out = "";
    const walk = async (dir) => {
        let entries;
        try {
            entries = await readdir(dir, { withFileTypes: true });
        } catch {
            return; // 없는 디렉터리는 조용히 건너뛴다
        }
        for (const e of entries) {
            const p = `${dir}/${e.name}`;
            if (e.isDirectory()) await walk(p);
            else if (/\.(jsx?|tsx?)$/.test(e.name)) out += await readFile(p, "utf8");
        }
    };
    for (const d of dirs) await walk(d);
    return out;
}

/** 디렉터리 안의 소스 파일 경로 (재귀). `collectSourceText` 와 같은 규약. */
async function listFiles(dir, out = []) {
    let entries;
    try {
        entries = await readdir(dir, { withFileTypes: true });
    } catch {
        return out; // 없는 디렉터리는 조용히 건너뛴다
    }
    for (const e of entries) {
        const p = `${dir}/${e.name}`;
        if (e.isDirectory()) await listFiles(p, out);
        else if (/\.(jsx?|tsx?)$/.test(e.name)) out.push(p);
    }
    return out;
}

const errors = [];
/** 확정 지급 요약 — 출력 절이 읽는다 */
let unlockSummary = "";
let recruitSummary = "";
let guideSummary = "";
let commanderSummary = "";
let spellSummary = "";
/** 발사체 요약 — "서로 다른 그림 몇 장" 이 한 줄로 보여야 회귀를 눈으로도 안다 */
let projectileSummary = "";
/** 선언↔소비 대조 요약 — 무엇을 몇 개나 지키고 있는지가 보여야 검사가 늘어난다 */
let declaredSummary = "";
/** 나이트메어 규칙 요약 — 어느 월드에 무엇이 걸렸는지가 한 줄로 보여야 한다 */
let nightmareSummary = "";
const warnings = [];
const err = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

/* ── 로드 ─────────────────────────────────────────────────── */
const balance = await load("balance.json");
const units = await load("units.json");
const enemies = await load("enemies.json");
const stages = await load("stages.json");
const sigils = await load("sigils.json");
const fx = await load("fx.json");
const presenters = await load("presenters.json");
/** 방치 수입 상수 — 던전 경제 가드가 이것과 대조한다 (logic/idle.js 와 같은 파일) */
const metaData = await load("meta.json");
const worlds = await load("worlds.json");

/** `$` 로 시작하는 키는 이 저장소의 주석 규약이다 (`$comment` · `$boss` · `$fix`) */
const isNote = (k) => k.startsWith("$");

/**
 * 지원 언어. 사용자에게 보이는 데이터 필드는 `{ ko, en }` 이 정본이다
 * (`src/i18n/index.js:pick`). **두 언어를 둘 다 검사한다** — 한쪽만 보면
 * 번역이 빠진 자리가 조용히 남고, 화면은 반대 언어로 떨어져 아무도 실패하지 않는다.
 */
const I18N_LANGS = ["ko", "en"];

const UNIT = new Map(units.units.map((u) => [u.id, u]));
const ENEMY = new Map(enemies.enemies.map((e) => [e.id, e]));
const SIGIL = new Map(sigils.sigils.map((s) => [s.id, s]));

/* ── 아틀라스 프레임 ──────────────────────────────────────────
 * ★ art.frame 이 "문자열인가"만 보면 오타를 못 잡는다.
 *   실제로 `BoldMan-at-Arms` (아틀라스는 `BoldManAtArms`) 오타 때문에
 *   스타터 방벽이 마젠타 플레이스홀더로 떴고, 아무 검사도 걸리지 않았다.
 *   아틀라스가 아직 패킹되지 않았으면 조용히 건너뛴다 (CI 순서 의존 방지).
 */
const ATLAS_FRAMES = {};
for (const name of ["units", "npcs", "bosses"]) {
    try {
        const a = JSON.parse(await readFile(`public/assets/atlas/${name}.json`, "utf8"));
        const list = a.frames
            ? Object.keys(a.frames)
            : (a.textures ?? []).flatMap((t) => t.frames.map((f) => f.filename));
        ATLAS_FRAMES[name] = new Set(list.map((f) => f.split("/")[0]));
    } catch {
        // 아틀라스 미생성 — 검사 생략
    }
}
const atlasesLoaded = Object.keys(ATLAS_FRAMES).length > 0;

/**
 * 발사체 아틀라스는 **프레임 이름 전체**가 필요하다.
 * 이름이 `그룹/행_열` 이라 위의 "그룹만 모은 집합" 으로는 클립을 잴 수 없다.
 */
let PROJ_FRAMES = null;
try {
    const a = JSON.parse(await readFile("public/assets/atlas/projectiles.json", "utf8"));
    PROJ_FRAMES = a.frames
        ? Object.keys(a.frames)
        : (a.textures ?? []).flatMap((t) => t.frames.map((f) => f.filename));
} catch {
    // 아틀라스 미생성 — 검사 생략
}

function checkArt(at, art) {
    if (!art?.frame) return err(`${at}: art.frame 없음`);
    if (!atlasesLoaded) return;
    const atlas = art.atlas ?? "units";
    const frames = ATLAS_FRAMES[atlas];
    if (!frames) return err(`${at}: 알 수 없는 아틀라스 '${atlas}'`);
    if (!frames.has(art.frame)) {
        err(`${at}: 아틀라스 '${atlas}' 에 프레임 '${art.frame}' 없음 — 마젠타로 뜬다`);
    }
}

const VALID_ROLES = [
    "BLOCKER",
    "MELEE",
    "RANGED",
    "CASTER",
    "SUPPORT",
    "SPECIALIST",
    "SIEGE",
    "FLYER",
];
const VALID_TAGS = [
    "ARMORED",
    "WARDED",
    "FLYING",
    "SWARM",
    "CORRUPT",
    "LIVING",
    "SHIELDED",
    "REGEN",
    "ANTI_AIR",
];
const VALID_DMG = ["physical", "arcane", "holy"];

/** 등급별 코스트 범위 — docs/02-design/12-unit-roster.md §1.1 */
const RARITY_COST = { C: [8, 18], R: [20, 35], E: [38, 60], L: [65, 95] };

/* ── 유닛 ─────────────────────────────────────────────────── */
for (const u of units.units) {
    const at = `units/${u.id}`;
    if (!u.name?.ko) err(`${at}: 한국어 이름 없음`);
    if (!VALID_ROLES.includes(u.role)) err(`${at}: 알 수 없는 role '${u.role}'`);
    if (!VALID_DMG.includes(u.dmgType)) err(`${at}: 알 수 없는 dmgType '${u.dmgType}'`);
    for (const t of u.tags ?? []) {
        if (!VALID_TAGS.includes(t)) err(`${at}: 알 수 없는 태그 '${t}'`);
    }
    if (!u.base) err(`${at}: base 스탯 없음`);
    checkArt(at, u.art);

    const range = RARITY_COST[u.rarity];
    if (!range) err(`${at}: 알 수 없는 등급 '${u.rarity}'`);
    else if (u.cost < range[0] || u.cost > range[1]) {
        err(`${at}: ${u.rarity} 등급 코스트 범위 ${range[0]}–${range[1]} 를 벗어남 (${u.cost})`);
    }

    if (u.role === "BLOCKER" && !(u.base?.blockCount > 0)) {
        err(`${at}: BLOCKER 인데 blockCount 가 0 이다 — 아무것도 막지 못한다`);
    }
    if (u.role !== "BLOCKER" && u.base?.blockCount > 0) {
        warn(`${at}: BLOCKER 가 아닌데 blockCount 가 있다 (무시됨)`);
    }
}

/**
 * ★★★ **발사체 — 쏘는 것들이 정말 서로 다른 그림을 쏘는가** (2026-08-05 전수 재작성)
 *
 *   ★ 2026-08-05 2차: **적도 여기서 함께 검사한다.** 아군만 보던 판본이
 *     "사거리 190 인데 발사체가 없는 적 11종"을 통째로 놓쳤다 (아래 ⑥).
 *
 *   전 판본은 `u.art.projectile` 을 검사했는데 **씬은 최상위 `u.projectile` 을
 *   읽고 있었다.** 두 필드의 내용이 서로 달랐으므로 검사기가 통과시킨 그림과
 *   화면에 뜬 그림이 달랐다. 게다가 씬은 `raw.projectile` 을 정규화에서 놓쳐
 *   **결국 30종 전원이 기본 탄 하나만 쏘고 있었다.**
 *
 *   그래서 이 절은 "선언이 있는가" 가 아니라 **"화면에 서로 다른 그림이 뜨는가"**
 *   를 잰다. 아래 다섯 가지가 전부 참이어야 그 말이 성립한다:
 *
 *     ① 시트 배정이 데미지 타입 셋을 전부 덮는가 (색이 빠진 타입이 없는가)
 *     ② 쏘는 역할은 모양을 갖고, 안 쏘는 역할은 갖지 않는가 (죽은 데이터 금지)
 *     ③ 선언한 모양이 **모든 시트에서** 실제 프레임으로 풀리는가
 *     ④ 클립이 2장 이상인가 (정지 이미지로 퇴화하지 않았는가)
 *     ⑤ 모양이 **정규**(클립의 첫 열)이고, 서로 다른 모양의 클립이 겹치지 않는가
 *
 *     ⑥ **사거리와 역할이 어긋나지 않는가** (적) — 즉발로 때려도 되는 사거리인가
 *
 *   ⑤ 가 없으면 `1_1` `1_2` `1_3` `1_4` 네 유닛이 **같은 클립 1_0~1_4** 를 쏘면서
 *   서로 다른 탄인 척한다. 실제로 그 상태였다.
 */
{
    const sheets = fx.projectileSheet;

    // ── ① 시트 배정 ──
    if (!sheets) err(`fx.json: projectileSheet 가 없다 — 발사체 색이 데미지 타입과 무관해진다`);
    else {
        for (const t of VALID_DMG) {
            if (!sheets[t]) err(`fx.json:projectileSheet: '${t}' 배정 없음 — 그 타입은 색이 없다`);
        }
        for (const t of Object.keys(sheets)) {
            if (!VALID_DMG.includes(t)) err(`fx.json:projectileSheet: 알 수 없는 데미지 타입 '${t}'`);
        }
        if (PROJ_FRAMES) {
            const groups = new Set(PROJ_FRAMES.map((f) => f.split("/")[0]));
            for (const [t, g] of Object.entries(sheets)) {
                if (!groups.has(g)) {
                    err(
                        `fx.json:projectileSheet['${t}'] = '${g}' 가 projectiles 아틀라스에 없다 — ` +
                            `tools/atlas-manifest.json 의 include 와 어긋났다`
                    );
                }
            }
            // 색이 실제로 갈리는가 — 같은 시트를 두 타입이 쓰면 색으로 구분되지 않는다
            const seen = new Map();
            for (const [t, g] of Object.entries(sheets)) {
                if (seen.has(g)) err(`fx.json:projectileSheet: '${seen.get(g)}' 와 '${t}' 가 같은 시트 '${g}' 를 쓴다`);
                seen.set(g, t);
            }
        }
    }

    /**
     * ★★★ **모든 모양이 방향으로 분류되어 있는가** (2026-08-05).
     *
     *   `shapeFacing` 이 비어 있으면 렌더가 전부 "방향 없음" 으로 떨어져 **아무것도
     *   뒤집히지 않는다.** 새 열 구간을 담고 분류를 빠뜨리면 조용히 그 상태가 된다.
     *   그래서 아틀라스에 실재하는 모양을 세어 표와 대조한다 — 표가 아틀라스보다
     *   모자라도, 남아돌아도 오류다.
     */
    const facing = fx.shapeFacing;
    if (!facing) err(`fx.json: shapeFacing 이 없다 — 발사체가 진행 방향으로 뒤집히지 않는다`);
    else if (PROJ_FRAMES) {
        // 아틀라스에 실재하는 **정규 모양**(각 클립의 첫 열) 목록
        const atlasShapes = new Set();
        for (const name of PROJ_FRAMES) {
            const clip = clipFrames(PROJ_FRAMES, name);
            if (clip[0]) atlasShapes.add(clip[0].split("/")[1]);
        }
        for (const s of atlasShapes) {
            if (!facing[s]) err(`fx.json:shapeFacing: 모양 '${s}' 이 아틀라스에 있는데 방향이 분류되지 않았다`);
        }
        for (const [s, v] of Object.entries(facing)) {
            if (!atlasShapes.has(s)) err(`fx.json:shapeFacing: 모양 '${s}' 이 아틀라스에 없다`);
            if (!ALL_FACINGS.includes(v)) {
                err(`fx.json:shapeFacing['${s}'] = '${v}' — 허용값은 ${ALL_FACINGS.join(" · ")}`);
            }
        }
        // 방향이 있는 그림이 실제로 있는가. 전부 none 이면 뒤집기가 눈에 보이지 않는다.
        const directional = Object.values(facing).filter((v) => v === "right" || v === "left").length;
        if (directional === 0) {
            err(`fx.json:shapeFacing: 방향이 있는 모양이 하나도 없다 — 어느 쪽으로 쏘든 그림이 같다`);
        }
    }

    // ── ② 선언의 유무 ──
    /** @type {Array<[string, string, string]>} [누구, 모양, 데미지타입] */
    const declared = [];
    if (fx.projectile?.shape) declared.push(["fx.json:projectile", fx.projectile.shape, "physical"]);
    else err(`fx.json:projectile 에 shape 이 없다`);

    /**
     * ★★★ **적도 같은 규약을 지킨다** (2026-08-05).
     *
     *   전 판본은 `units.units` 만 돌았다. 그런데 `enemies.json` 에는 `role` 이
     *   **한 종도 없었고**, `stageConfig.js:normalizeDef` 가 `raw.role ?? "MELEE"`
     *   로 62/62 를 근접으로 정규화했다. 그래서 사거리 120–190 을 가진 적 11종이
     *   **발사체 없이 즉발로** 때렸다 — 화면에서 원거리 적과 근접 적을 구분할
     *   방법이 없었고, 검사기는 아군만 보고 있었으므로 끝까지 초록불이었다.
     *
     *   ★ 적의 정규화 사본은 만들지 않는다. `UNIT_DEFS` 같은 export 가 적에는
     *     없으므로, **게임이 실제로 지나는 경로**(`buildStageConfig`)를 그대로
     *     지나게 해서 `cfg.enemyDefs` 를 본다 — `BattleScene` 이 `_projEnemy` 를
     *     만들 때 읽는 바로 그 객체다. 검사기가 두 번째 정규화기가 되면
     *     그 사본이 갈라진다.
     */
    const ENEMY_DEFS = {};
    for (const st of stages.stages) {
        let cfg;
        try {
            cfg = buildStageConfig(st.id, []);
        } catch {
            continue; // 스테이지 자체의 오류는 다른 절이 보고한다
        }
        for (const id in cfg.enemyDefs) if (!ENEMY_DEFS[id]) ENEMY_DEFS[id] = cfg.enemyDefs[id];
    }

    /**
     * ★★★ **"즉발로 때려도 되는 사거리"의 상한** (2026-08-05).
     *
     *   역할은 **사거리에서 파생시키지 않는다** — 파생 규칙을 두면 "왜 이 적이
     *   원거리인가"를 데이터가 아니라 코드가 정하게 되고, 사거리를 68 → 72 로
     *   튜닝한 순간 그 적이 조용히 발사체를 쏘기 시작한다. 대신 데이터에 명시하고
     *   여기서 **대조**한다. 실측(적 62종)이 이 값을 고른 근거다:
     *
     *     근접 28–72 (최장은 창을 든 lizard_spearman 의 72)
     *     ───── 간극 48px ─────
     *     원거리 120–190 (최단은 evil_wizard 의 120)
     *
     *   100 은 그 간극 한가운데다. 어느 쪽으로도 4종 이상 여유가 있어 정상적인
     *   튜닝이 이 선을 건드리지 않는다.
     *
     * ★★ **아군도 같은 선을 쓴다** (2026-08-05 2차). 전 판본은 아군을 면제하면서
     *   "FLYER(160–200)는 지금 즉발이지만 그것을 바꾸는 것은 별개의 결정"이라고
     *   적어 두었다 — 그 결정을 내렸고(`roles.js:PROJECTILE_ROLES` 에 FLYER 추가),
     *   면제할 이유가 사라졌다. 아군 실측도 같은 모양으로 갈린다:
     *
     *     근접 36–62 (BLOCKER 40–52 · MELEE 36–62)
     *     ───── 간극 88px ─────
     *     원거리 150–330 (최단은 RANGED 의 150)
     *
     * ★ **SUPPORT 만 뺀다.** 사거리 190–235 로 선을 넘지만 `engage.js:trySupport` 는
     *   `tryAttack` 을 지나지 않는다 — 피해가 아니라 힐이라 "즉발로 때린다"가
     *   성립하지 않고, 발사체 역할로 넣으면 한 발도 안 쏘는 죽은 선언이 된다.
     */
    const MELEE_RANGE_MAX = 100;
    /** 사거리 대조에서 빠지는 역할 — 피해를 주지 않는 역할만 */
    const RANGE_CHECK_EXEMPT = { SUPPORT: 1 };

    for (const u of units.units) {
        if (u.projectile) {
            err(
                `units/${u.id}: 최상위 'projectile' 은 옛 필드다 — 아무도 읽지 않는다. ` +
                    `art.projectile 하나만 남긴다`
            );
        }
        const proj = u.art?.projectile;
        const uRange = u.base?.range ?? 0;
        const uShoots = usesProjectile(u.role);

        // ── 사거리 ↔ 역할 대조 (적과 같은 규약) ──
        if (!RANGE_CHECK_EXEMPT[u.role]) {
            if (uRange > MELEE_RANGE_MAX && !uShoots) {
                err(
                    `units/${u.id}: 사거리 ${uRange} 인데 역할이 '${u.role}' 라 **즉발로** 때린다 — ` +
                        `${MELEE_RANGE_MAX} 를 넘는 사거리는 ${Object.keys(PROJECTILE_ROLES).join(" · ")} ` +
                        `중 하나여야 한다`
                );
            }
            if (uRange <= MELEE_RANGE_MAX && uShoots) {
                err(
                    `units/${u.id}: 사거리 ${uRange} 로 '${u.role}' 발사체를 쏜다 — ` +
                        `${MELEE_RANGE_MAX} 이하는 근접이다. 사거리를 늘리거나 역할을 바꾼다`
                );
            }
        }

        if (!uShoots) {
            // ★ 쏘지 않는 역할의 선언은 **죽은 데이터**다. logic/roles.js 의
            //   PROJECTILE_ROLES 에 없는 역할(BLOCKER·MELEE·SUPPORT)은 평생 한 발도
            //   쏘지 않는다. 실제로 6종이 그렇게 적혀 있었다.
            if (proj) err(`units/${u.id}: ${u.role} 는 발사체를 쏘지 않는데 art.projectile 이 있다 (죽은 데이터)`);
            continue;
        }
        if (!proj?.shape) {
            err(`units/${u.id}: ${u.role} 인데 art.projectile.shape 이 없다 — 기본 탄만 쏜다`);
            continue;
        }
        if (proj.frame || proj.atlas) {
            err(
                `units/${u.id}: art.projectile 에 frame/atlas 를 적지 않는다 — ` +
                    `시트는 dmgType 이 정한다 (fx.json:projectileSheet)`
            );
        }
        // ★ 데이터에 적힌 것이 **씬이 읽는 자리까지 도달하는가**. 이 한 줄이
        //   없어서 검사기가 초록불인 채로 전원이 기본 탄을 쐈다.
        if (UNIT_DEFS[u.id]?.projectile?.shape !== proj.shape) {
            err(
                `units/${u.id}: art.projectile 이 stageConfig.normalizeDef 를 통과하지 못한다 — ` +
                    `데이터에는 있는데 화면에는 기본 탄이 뜬다`
            );
        }
        declared.push([`units/${u.id}`, proj.shape, u.dmgType]);
    }

    for (const e of enemies.enemies) {
        const at = `enemies/${e.id}`;
        if (e.projectile) {
            err(`${at}: 최상위 'projectile' 은 옛 필드다 — art.projectile 하나만 남긴다`);
        }
        if (e.role !== undefined && !ROLE_ORDER.includes(e.role)) {
            err(`${at}: 알 수 없는 역할 '${e.role}' — ${ROLE_ORDER.join(" · ")} 중 하나`);
            continue;
        }
        const proj = e.art?.projectile;
        const range = e.base?.range ?? 0;
        const shoots = usesProjectile(e.role);

        // ── 사거리 ↔ 역할 대조 (아군과 같은 규약 · 같은 면제표) ──
        // ★ 지금 적에는 면제 대상이 없다. 표를 공유해 두어야 나중에 지원형 적이
        //   생겨도 아군 쪽 판정과 갈라지지 않는다.
        if (!RANGE_CHECK_EXEMPT[e.role]) {
            if (range > MELEE_RANGE_MAX && !shoots) {
                err(
                    `${at}: 사거리 ${range} 인데 역할이 '${e.role ?? "(없음 → MELEE)"}' 라 ` +
                        `**즉발로** 때린다 — ${MELEE_RANGE_MAX} 를 넘는 사거리는 ` +
                        `${Object.keys(PROJECTILE_ROLES).join(" · ")} 중 하나여야 한다`
                );
            }
            if (range <= MELEE_RANGE_MAX && shoots) {
                err(
                    `${at}: 사거리 ${range} 로 '${e.role}' 발사체를 쏜다 — ` +
                        `${MELEE_RANGE_MAX} 이하는 근접이다. 사거리를 늘리거나 역할을 지운다`
                );
            }
        }

        if (!shoots) {
            if (proj) err(`${at}: ${e.role ?? "MELEE"} 는 발사체를 쏘지 않는데 art.projectile 이 있다 (죽은 데이터)`);
            continue;
        }
        if (!proj?.shape) {
            err(`${at}: ${e.role} 인데 art.projectile.shape 이 없다 — 기본 탄만 쏜다`);
            continue;
        }
        if (proj.frame || proj.atlas) {
            err(`${at}: art.projectile 에 frame/atlas 를 적지 않는다 — 시트는 dmgType 이 정한다`);
        }
        // ★ 아군과 같은 이유로, **씬이 읽는 자리까지 도달하는가**를 본다.
        //   `role` 과 `art.projectile` 은 둘 다 normalizeDef 를 지나야 하고,
        //   `pierce` 가 예전에 그 자리에서 조용히 사라졌다.
        const nd = ENEMY_DEFS[e.id];
        if (!nd) {
            err(`${at}: 어느 스테이지의 waveTable 에도 없어 정규화 경로를 확인할 수 없다`);
        } else {
            if (nd.role !== e.role) {
                err(`${at}: role 이 stageConfig.normalizeDef 를 통과하지 못한다 (${nd.role}) — 즉발로 때린다`);
            }
            if (nd.projectile?.shape !== proj.shape) {
                err(`${at}: art.projectile 이 normalizeDef 를 통과하지 못한다 — 화면에는 기본 탄이 뜬다`);
            }
        }
        declared.push([at, proj.shape, e.dmgType]);
    }

    // ── ③④⑤ 아틀라스와 대조 ──
    if (PROJ_FRAMES && sheets) {
        const MIN_FRAMES = 2;
        /**
         * 한 그림을 몇 유닛까지 공유해도 되는가.
         *
         * ★ "서로 다른 모양인데 같은 클립" 만 잡으면 **모두가 같은 모양을 적는**
         *   퇴화를 못 잡는다. 실제로 그렇게 30종이 한 탄만 쐈다. 공유 자체는
         *   정상이지만(엘프 궁수 둘이 같은 화살촉을 쏘는 것은 맞다) 상한이 있어야
         *   "원거리 조합의 차이가 화면에 보인다" 가 유지된다.
         */
        const MAX_PER_PICTURE = 4;
        /** 그림(시트/모양) → 그것을 쓰는 선언들 */
        const users = new Map();
        /** 모양 → 그 모양을 처음 선언한 사람 (겹침 보고용) */
        const owner = new Map();
        /** 클립 첫 프레임 → 모양 (다른 모양이 같은 클립을 쓰는지) */
        const clipOwner = new Map();

        for (const [who, shape, dmgType] of declared) {
            /**
             * ★★★ **가로로 날 수 없는 그림을 쓰지 않는가** (2026-08-05).
             *
             *   발사체는 가로로만 난다 (`logic/projectiles.js` 에 `vy` 가 없다).
             *   `up`(위를 향한 불꽃) · `diagonal`(45° 대각 화살)은 어느 쪽으로
             *   뒤집어도 진행 방향과 어긋난다 — 45° 회전은 16px 픽셀아트를
             *   뭉개므로 대안이 아니다. 표에는 남겨 두되 배정은 막는다.
             */
            const f = fx.shapeFacing?.[shape];
            if (f && !USABLE_FACINGS.includes(f)) {
                err(
                    `${who}: 모양 '${shape}' 은 '${f}' 방향으로 그려져 있어 가로 발사체로 쓸 수 없다 — ` +
                        `${USABLE_FACINGS.join(" · ")} 중 하나인 모양을 고른다`
                );
                continue;
            }

            /**
             * 모양은 **모든 시트에서** 성립해야 한다. 그래야 유닛의 dmgType 이
             * 바뀌어도 그림이 사라지지 않는다.
             *
             * ★ 시트는 서로 색만 다른 동일 구조라 한 시트에서 틀리면 세 시트 전부
             *   틀린다. 같은 말을 세 번 하지 않고 **첫 시트에서 멈춘다** —
             *   오류 목록이 셋으로 부풀면 진짜 항목 수를 못 읽는다.
             */
            let ok = true;
            for (const t of VALID_DMG) {
                const frame = projectileFrame(sheets, t, shape);
                if (!frame) {
                    err(`${who}: 모양 '${shape}' 을 '${t}' 시트로 풀 수 없다`);
                    ok = false;
                    break;
                }
                const clip = clipFrames(PROJ_FRAMES, frame);
                if (!clip.includes(frame)) {
                    err(`${who}: 아틀라스에 '${frame}' 없음 — 마젠타로 뜬다`);
                    ok = false;
                    break;
                }
                if (clip.length < MIN_FRAMES) {
                    err(`${who}: '${frame}' 의 클립이 ${clip.length}장뿐이다 — 정지 이미지로 떨어진다`);
                    ok = false;
                    break;
                }
                // ⑤ 정규 모양 — 클립의 **첫 열**이어야 한다
                if (clip[0] !== frame) {
                    err(
                        `${who}: 모양 '${shape}' 은 클립 한가운데다. 그 종류는 ` +
                            `'${clip[0].split("/")[1]}' 에서 시작한다 — 다른 모양인 척하게 된다`
                    );
                    ok = false;
                    break;
                }
            }
            if (!ok) continue;

            // 겹침은 **실제로 쓰는 색**에서만 잰다 (다른 색이면 다른 그림이다)
            const frame = projectileFrame(sheets, dmgType, shape);
            const clip = clipFrames(PROJ_FRAMES, frame);
            const prev = clipOwner.get(clip[0]);
            if (prev && prev !== shape) {
                err(`${who}: 모양 '${shape}' 과 '${prev}' 가 같은 클립(${clip[0]})을 쓴다 — 차별화가 없다`);
            }
            clipOwner.set(clip[0], shape);
            if (!owner.has(shape)) owner.set(shape, who);

            const bucket = users.get(clip[0]) ?? [];
            bucket.push(who);
            users.set(clip[0], bucket);
        }

        for (const [picture, who] of users) {
            if (who.length > MAX_PER_PICTURE) {
                err(
                    `발사체 그림 '${picture}' 을 ${who.length}종이 함께 쏜다 (상한 ${MAX_PER_PICTURE}) — ` +
                        `${who.join(", ")}`
                );
            }
        }

        // 실제로 화면에 뜨는 서로 다른 그림의 수 — 요약에 남긴다
        const flippable = declared.filter(([, s]) => {
            const f = fx.shapeFacing?.[s];
            return f === "right" || f === "left";
        }).length;
        projectileSummary =
            `발사체 ${declared.length}선언 → 서로 다른 그림 ${users.size}장 ` +
            `(모양 ${owner.size}종 × 색 ${new Set(declared.map(([, , t]) => t)).size}) · ` +
            `한 그림 최다 공유 ${Math.max(...[...users.values()].map((v) => v.length))}종 · ` +
            `방향 있는 선언 ${flippable}`;
    }
}

/* ── 적 ───────────────────────────────────────────────────── */
for (const e of enemies.enemies) {
    const at = `enemies/${e.id}`;
    if (!e.name?.ko) err(`${at}: 한국어 이름 없음`);
    if (!VALID_DMG.includes(e.dmgType)) err(`${at}: 알 수 없는 dmgType '${e.dmgType}'`);
    for (const t of e.tags ?? []) {
        if (!VALID_TAGS.includes(t)) err(`${at}: 알 수 없는 태그 '${t}'`);
    }
    checkArt(at, e.art);
    if (!(e.breachDamage > 0)) err(`${at}: breachDamage 가 0 — 방주를 위협하지 않는다`);

    // CORRUPT 와 LIVING 은 동시에 가질 수 없다 (신성 배율이 모순된다)
    const tags = e.tags ?? [];
    if (tags.includes("CORRUPT") && tags.includes("LIVING")) {
        err(`${at}: CORRUPT 와 LIVING 을 동시에 가질 수 없다`);
    }

    if (e.boss) checkBossPhases(at, e);
}

/**
 * 보스 페이즈 검사 (P6-05)
 *
 * ★ 여기서 보는 것은 "어려운가"가 아니라 **페이즈가 편성 퍼즐을 만드는가**다.
 *   태그만 바꾸고 실제 방어 수치를 안 바꾸면 시스템 전체가 연출로 전락한다
 *   (실제로 그렇게 짰다가 테스트에 잡혔다).
 */
function checkBossPhases(at, e) {
    const ps = e.boss.phases;
    if (!Array.isArray(ps) || ps.length < 2) {
        err(`${at}: boss.phases 는 2개 이상이어야 한다`);
        return;
    }

    if ((ps[0].at ?? 1) !== 1) err(`${at}: 1페이즈의 at 은 1.0 이어야 한다`);

    let prevAt = Infinity;
    for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        const pat = `${at}/페이즈${i + 1}`;
        const t = p.tags ?? [];

        for (const tag of t) if (!VALID_TAGS.includes(tag)) err(`${pat}: 알 수 없는 태그 '${tag}'`);

        const a = p.at ?? 1;
        if (a > prevAt || (i > 0 && a === prevAt)) err(`${pat}: at 이 단조 감소하지 않는다`);
        if (a <= 0) err(`${pat}: at 은 0 보다 커야 한다`);
        prevAt = a;

        // ARMORED + WARDED = 물리도 술식도 안 통하는 벽. 편성 퍼즐이 아니라 정지 화면이다.
        if (t.includes("ARMORED") && t.includes("WARDED")) {
            err(`${pat}: ARMORED 와 WARDED 를 동시에 가질 수 없다 (아무것도 안 통한다)`);
        }
        if (t.includes("CORRUPT") && t.includes("LIVING")) {
            err(`${pat}: CORRUPT 와 LIVING 을 동시에 가질 수 없다`);
        }

        // ★★ 태그와 실제 수치가 일치해야 한다. 상성은 태그가 아니라 def/res 가 만든다.
        if (t.includes("ARMORED") && !((p.def ?? 0) >= 20)) {
            err(`${pat}: ARMORED 인데 def 가 ${p.def ?? 0} — 태그만 있고 장갑이 없다`);
        }
        if (t.includes("WARDED") && !((p.res ?? 0) >= 40)) {
            err(`${pat}: WARDED 인데 res 가 ${p.res ?? 0} — 태그만 있고 저항이 없다`);
        }

        // ★★ 회복 + **RES** = 소프트락.
        //   res 는 술식·신성 **둘 다**를 깎으므로 세 답 중 둘이 동시에 막힌다.
        //   순DPS 가 회복량 아래로 떨어지면 어떤 편성으로도 보스가 죽지 않는다
        //   — 3-20 이 실제로 그랬다 (400초 타임아웃, 보스 HP 100% 유지).
        //   def 는 물리 하나만 깎으므로 REGEN 과 공존해도 답이 남는다.
        if (t.includes("REGEN") && (p.res ?? 0) >= 25) {
            err(`${pat}: REGEN 과 높은 res(${p.res})를 겹칠 수 없다 — 술식·신성이 동시에 막혀 보스가 죽지 않는다`);
        }

    }

    // 인접 페이즈의 태그가 같으면 그 전환은 연출일 뿐이다
    for (let i = 1; i < ps.length; i++) {
        const a = [...(ps[i - 1].tags ?? [])].sort().join(",");
        const b = [...(ps[i].tags ?? [])].sort().join(",");
        if (a === b) err(`${at}: 페이즈 ${i} → ${i + 1} 의 태그가 같다 (전환이 무의미하다)`);
    }

    // 한 보스 안에 ARMORED·WARDED 가 모두 나와야 단일 딜러가 지배하지 못한다
    const all = new Set(ps.flatMap((p) => p.tags ?? []));
    if (!all.has("ARMORED") || !all.has("WARDED")) {
        warn(`${at}: ARMORED·WARDED 페이즈가 모두 있어야 편성 다양성이 강제된다`);
    }

    // 마지막 페이즈는 방어를 버려야 몰아칠 창구가 열린다
    const last = ps[ps.length - 1];
    const maxDef = Math.max(...ps.map((p) => p.def ?? 0));
    const maxRes = Math.max(...ps.map((p) => p.res ?? 0));
    if ((last.def ?? 0) >= maxDef || (last.res ?? 0) >= maxRes) {
        warn(`${at}: 마지막 페이즈가 방어를 버리지 않는다 (처치 창구가 없다)`);
    }
}

/**
 * 스테이지 비행 비율 상한.
 *
 * ★★ FLYING 은 블로킹이 불가능하다 (movement.js). 한 스테이지의 절반 이상이
 *   비행이면 **방벽 슬롯이 순수 손해**가 되어 "방벽 없는 편성"이 균형 편성을
 *   이긴다 — B16(방벽 필수성)이 규칙이 아니라 **데이터 때문에** 뒤집힌다.
 *   실측(2026-08-02): 3-19 는 비행 55% 였고 no_blocker 100% vs balanced 33.7%.
 *
 * ★ 비행은 "대공을 요구하는 변주"여야지 "방벽을 무의미하게 만드는 기본값"이면 안 된다.
 */
const MAX_FLYING_RATIO = 0.4;

function checkFlyingRatio(st) {
    let total = 0;
    let air = 0;
    for (const w of st.waveTable ?? []) {
        for (const sp of w.spawns ?? []) {
            const n = sp.count * (sp.lanes?.length ?? 3);
            total += n;
            if ((ENEMY.get(sp.id)?.tags ?? []).includes("FLYING")) air += n;
        }
    }
    if (total === 0) return;
    const ratio = air / total;
    if (ratio > MAX_FLYING_RATIO) {
        err(
            `stages/${st.id}: 비행 비율 ${(ratio * 100).toFixed(0)}% — 상한 ${MAX_FLYING_RATIO * 100}% 초과. ` +
                `방벽이 막을 것이 없어져 B16(방벽 필수성)이 뒤집힌다`
        );
    }
}

/* ── 스테이지 ─────────────────────────────────────────────── */
for (const st of stages.stages) {
    checkFlyingRatio(st);
    const at = `stages/${st.id}`;
    if (!/^\d+-\d+$/.test(st.id)) err(`${at}: id 형식은 '<월드>-<번호>' 여야 한다`);
    if (!st.waveTable?.length) err(`${at}: waveTable 이 비어 있다`);
    if (!(st.targetTimeSec > 0)) err(`${at}: targetTimeSec 없음 (★3 조건)`);

    const waves = new Set();
    for (const w of st.waveTable ?? []) {
        if (waves.has(w.wave)) err(`${at}: 웨이브 ${w.wave} 중복`);
        waves.add(w.wave);
        if (w.wave > st.waves) err(`${at}: 웨이브 ${w.wave} 가 총 웨이브 ${st.waves} 를 초과`);

        for (const sp of w.spawns ?? []) {
            if (!ENEMY.has(sp.id)) err(`${at} 웨이브 ${w.wave}: 알 수 없는 적 '${sp.id}'`);
            for (const l of sp.lanes ?? []) {
                if (l < 0 || l > 2) err(`${at} 웨이브 ${w.wave}: 잘못된 레인 ${l}`);
            }
        }
    }
    for (let i = 1; i <= st.waves; i++) {
        if (!waves.has(i)) warn(`${at}: 웨이브 ${i} 정의 없음 (아무것도 스폰되지 않는다)`);
    }
}

/* ── 각인 ─────────────────────────────────────────────────── */
const VALID_HOOKS = [
    "apply",
    "modifyStat",
    "onSummon",
    "onAttack",
    "onKill",
    "onBlock",
    "onDamageTaken",
    "onWaveStart",
    "projectileSpawn",
    "projectileHit",
];

for (const s of sigils.sigils) {
    const at = `sigils/${s.id}`;
    if (!s.name?.ko) err(`${at}: 한국어 이름 없음`);
    if (!s.desc?.ko) err(`${at}: 한국어 설명 없음`);
    if (!sigils.categories[s.category]) err(`${at}: 알 수 없는 카테고리 '${s.category}'`);
    if (!s.hooks?.length) err(`${at}: 훅이 없다 — 아무 효과도 없는 각인`);

    for (const h of s.hooks ?? []) {
        if (!VALID_HOOKS.includes(h.on)) err(`${at}: 알 수 없는 훅 '${h.on}'`);
        if (h.params?.role && !VALID_ROLES.includes(h.params.role)) {
            err(`${at}: 알 수 없는 role '${h.params.role}'`);
        }
        if (h.params?.tag && !VALID_TAGS.includes(h.params.tag)) {
            err(`${at}: 알 수 없는 태그 '${h.params.tag}'`);
        }
    }

    // ★ 대가형은 반드시 페널티를 가진다 — 숨기면 다크 패턴이다
    if (s.category === "cost") {
        const penalty = s.hooks.some(
            (h) => h.value < 0 || (h.op.startsWith("mul") && h.value < 1)
        );
        if (!penalty) err(`${at}: category 'cost' 인데 페널티가 없다`);
    }
}

for (const e of sigils.evolutions) {
    const at = `evolutions/${e.id}`;
    if (!e.name?.ko) err(`${at}: 한국어 이름 없음`);
    if (!e.requires?.length) err(`${at}: requires 가 비어 있다`);
    for (const r of e.requires ?? []) {
        if (!SIGIL.has(r)) err(`${at}: 알 수 없는 재료 각인 '${r}'`);
    }
    for (const h of e.hooks ?? []) {
        if (!VALID_HOOKS.includes(h.on)) err(`${at}: 알 수 없는 훅 '${h.on}'`);
    }
}

/* ── 연출 프로파일 ────────────────────────────────────────── */
for (const role of VALID_ROLES) {
    if (!presenters.profiles[role]) err(`presenters: 역할 '${role}' 프로파일 없음`);
}
for (const [role, p] of Object.entries(presenters.profiles)) {
    if (!VALID_ROLES.includes(role)) err(`presenters: 알 수 없는 역할 '${role}'`);
    for (const state of ["idle", "attack", "hurt", "death", "spawn"]) {
        if (!p[state]) warn(`presenters/${role}: '${state}' 연출 없음`);
    }
    // 이펙트 참조 검사
    for (const key of ["attack", "death", "spawn"]) {
        const eff = p[key]?.effect ?? p[key]?.ringEffect;
        if (eff && !fx.effects[eff]) err(`presenters/${role}.${key}: 알 수 없는 이펙트 '${eff}'`);
    }
}

/* ── 밸런스 상수 ──────────────────────────────────────────── */
{
    const g = balance.scaling.enemyHpGrowth;
    for (let i = 1; i < g.length; i++) {
        if (g[i].rate > g[i - 1].rate) {
            err(
                `balance: 적 HP 성장률이 감쇠하지 않는다 (${g[i - 1].rate} → ${g[i].rate}). ` +
                    `감쇠는 스테이지 30–50 벽의 구조적 처방이다`
            );
        }
    }
    if (balance.combat.minDamageRatio <= 0 || balance.combat.minDamageRatio >= 0.3) {
        err(`balance: minDamageRatio 는 0–0.3 사이여야 한다 (현재 ${balance.combat.minDamageRatio})`);
    }
    if (balance.resources.summonCostGrowth <= 1) {
        err(`balance: summonCostGrowth 가 1 이하 — 스팸 억제가 작동하지 않는다`);
    }

    /**
     * ★★ 지휘관 평타 — **사거리가 오라 반경보다 짧아야 한다.**
     *
     *   이 부등식이 평타 설계의 전부다. 평타를 넣으려면 오라의 앞쪽 절반을 적에게
     *   내주는 자리까지 나가야 하고, 그래서 SUPPORT 가 끊기고 지휘관이 맞는다.
     *   사거리가 오라보다 길어지면 그 비용이 통째로 사라져 "앞에 세워두면 끝"이
     *   된다 — 이 게임이 제거하려던 바로 그 단일 최적해다.
     *
     *   숫자 하나를 올리는 것만으로 조용히 깨지므로 기계가 지킨다.
     *   @see docs/02-design/20-commander-combat.md §3
     */
    /**
     * ★★★ **패배가 도달 가능한가** (2026-08-04).
     *
     *   방주 HP 는 월드 상수인데 스폰량은 밀도 램프로 늘어난다. 두 값을 비교하는
     *   코드가 파이프라인 어디에도 없어서, 월드 1 의 앞 세 스테이지는 **산술적으로
     *   질 수가 없었다** — 스폰되는 적 전부가 방주에 자폭해도 HP 가 남았다
     *   (1-1: 22마리 × 2 = 44 vs 방주 100). 1-1 이 가르치려는 것이 "소환 = 승리"인데
     *   아무것도 소환하지 않아도 이겨서 정반대를 가르치고 있었다.
     *
     *   `balance:check` 는 승률만 보므로 이것을 못 잡는다 — 승률 100% 는 "쉽다"이지
     *   "질 수 없다"가 아니다. 그 둘의 차이를 여기서만 볼 수 있다.
     *
     *   가장 관대한 조건(최대 별트리 방주 HP)으로도 전멸 자폭이 방주를 부수지 못하면
     *   그 스테이지는 승리가 확정이다.
     */
    const arkNode = metaData?.starTree?.nodes?.find((n) => n.effect?.kind === "arkHpPct");
    const maxArkPct = arkNode ? (arkNode.effect.perRank ?? 0) * (arkNode.maxRank ?? 0) : 0;
    /**
     * ★ **가장 적게 나오는 난이도(노멀)** 로 잰다. 하드의 스폰 배율을 쓰면 적이 많아져
     *   검사가 느슨해진다 — 정작 신규 플레이어가 서는 곳은 노멀이므로, 노멀에서
     *   질 수 있어야 한다.
     */
    const minSpawnMult = balance.difficulty?.levels?.normal?.spawnCountMult ?? 1;
    const tempoRatio = balance.battlefield?.tempoShiftRatio ?? 0.6;
    const tempoMult = balance.battlefield?.tempoDensityMult ?? 1.6;
    const enemyById = new Map((enemies.enemies ?? enemies).map((e) => [e.id, e]));

    for (const st of stages.stages ?? stages) {
        const tempoWave = Math.max(1, Math.floor(st.waves * tempoRatio));
        let maxBreach = 0;
        for (const entry of st.waveTable ?? []) {
            const density = (entry.wave >= tempoWave ? tempoMult : 1) * minSpawnMult;
            for (const spec of entry.spawns ?? []) {
                const def = enemyById.get(spec.id);
                if (!def) continue;
                // spawn.js:spawnCountFor 와 같은 식 — 보스·거대화는 배율을 안 받는다
                const unique = !!def.boss?.phases?.length || !!def.giant;
                const n = unique ? spec.count : Math.max(1, Math.round(spec.count * density));
                maxBreach += n * (def.breachDamage ?? 0);
            }
        }
        const maxArkHp = st.arkHp * (1 + maxArkPct);
        if (maxBreach <= maxArkHp) {
            err(
                `stages/${st.id}: 패배가 도달 불가능하다 — 스폰 전량이 자폭해도 ` +
                    `${maxBreach} 피해뿐인데 방주 HP 는 최대 ${Math.round(maxArkHp)} 다. ` +
                    `worlds.json 의 해당 beat 에 arkHp 를 낮춰라 (34-scope-cut 아님, 20-commander-combat 아님 — ` +
                    `tools/lib/stages-core.mjs 의 beat.arkHp)`
            );
        }
    }

    const ca = balance.commander?.attack;
    if (ca) {
        if (!(ca.damage > 0) || !(ca.intervalMs > 0) || !(ca.range > 0)) {
            err(`balance: commander.attack 의 damage/intervalMs/range 는 모두 양수여야 한다`);
        }
        if (ca.range >= balance.commander.auraRadius) {
            err(
                `balance: commander.attack.range(${ca.range}) 가 auraRadius(${balance.commander.auraRadius}) 이상이다 — ` +
                    `평타의 위치 비용이 사라진다 (20-commander-combat.md §2.1)`
            );
        }
        if (!["physical", "arcane", "holy"].includes(ca.dmgType)) {
            err(`balance: commander.attack.dmgType 이 알 수 없는 값이다 (${ca.dmgType})`);
        }
        if (ca.dmgType !== "physical") {
            warn(
                `balance: commander.attack.dmgType 이 '${ca.dmgType}' 이다 — 물리가 아니면 ` +
                    `지휘관이 중장갑·상성 스테이지를 혼자 푼다 (설계결정 5)`
            );
        }
    }
}

/* ── 선언했으면 읽힌다 ─────────────────────────────────────── */
/**
 * ★★★ **데이터에 적었는데 읽는 코드가 없는 값**을 기계가 찾는다 (2026-08-05).
 *
 *   이 저장소가 가장 자주 당한 사고다. 전수 조사에서 한 번에 이만큼 나왔다:
 *     · `auraEffects.MELEE.special` · `SIEGE.special` · `RANGED.special`
 *       — 역할별 오라 효과 3종이 4개월 동안 존재하지 않았다.
 *     · `auraEffects.SUPPORT.inverted` — 반전 규칙이 코드에 박혀 있어서 死필드였다.
 *     · `auraEffects.SPECIALIST` — 2026-08-04 에 사라진 역할의 유령.
 *     · `scaling.enemyHpBase` · `enemyAtkBase` — 참조 없는 기준값.
 *   전부 **문법이 완전하고 항목만 하나 없는** 종류라 테스트가 잡지 못한다.
 *
 * ★ 검사는 문자열 포함이다. 파서를 쓰지 않는 이유는 `collectSourceText` 주석 참조 —
 *   검사기가 두 번째 번들러가 되면 안 된다. 오탐(주석에만 등장) 위험은 있지만,
 *   **미탐이 훨씬 비싸다.** 위 목록이 그 증거다.
 */
{
    /** `$` 로 시작하는 키는 주석 규약이다 (balance.json 전체가 쓴다) */
    const isComment = (k) => k.startsWith("$");
    const logicText = await collectSourceText(["src/game/logic"]);
    const allText = logicText + (await collectSourceText(["src", "tools"]));

    /* ① 오라 역할 효과 — 키는 실재하는 역할이어야 하고, 값은 읽혀야 한다 */
    const ae = balance.commander?.auraEffects ?? {};
    for (const [role, eff] of Object.entries(ae)) {
        if (isComment(role)) continue;
        if (!ROLE_ORDER.includes(role)) {
            err(
                `balance: auraEffects 에 실재하지 않는 역할 '${role}' 이 있다 — ` +
                    `logic/roles.js:ROLE_ORDER 에 없는 역할의 오라 효과는 영원히 발동하지 않는다 ` +
                    `(SPECIALIST 가 2026-08-04 경량화 뒤 그렇게 남아 있었다)`
            );
            continue;
        }
        for (const key of Object.keys(eff ?? {})) {
            if (isComment(key)) continue;
            if (key === "special") {
                err(
                    `balance: auraEffects.${role}.special — **불투명한 플래그를 두지 않는다.** ` +
                        `'여기에 무언가 있다'는 표식은 읽는 코드를 쓸 수 없게 만들고, ` +
                        `실제로 MELEE·RANGED·SIEGE 가 그래서 4개월간 아무 일도 하지 않았다. ` +
                        `효과에 이름을 붙여라 (execThreshold · pushPower · pierceBonus …)`
                );
                continue;
            }
            if (!logicText.includes(key)) {
                err(
                    `balance: auraEffects.${role}.${key} 를 읽는 코드가 src/game/logic 에 없다 — ` +
                        `선언만 되고 돌지 않는 규칙이다 (docs/02-design/11-core-loop.md §4.2)`
                );
            }
        }
    }
    for (const role of ROLE_ORDER) {
        if (!ae[role]) {
            warn(
                `balance: auraEffects 에 역할 '${role}' 이 없다 — ` +
                    `그 역할은 오라 안팎이 완전히 같다. 의도라면 빈 객체로라도 적어라`
            );
        }
    }

    /* ② 적 성장 커브 — 선언한 손잡이는 전부 어딘가에서 돌아야 한다 */
    for (const key of Object.keys(balance.scaling ?? {})) {
        if (isComment(key)) continue;
        if (!allText.includes(key)) {
            err(
                `balance: scaling.${key} 를 읽는 코드가 없다 — 死필드다. ` +
                    `쓰거나 지워라 (enemyHpBase · enemyAtkBase 가 그래서 2026-08-05 에 사라졌다)`
            );
        }
    }
}

/* ── 난이도 (P6-10) ───────────────────────────────────────── */
/**
 * ★ 여기서 보는 것은 "어려운가"가 아니라 **난이도가 단조인가 · 경제를 깨지 않는가**다.
 *   배율 표는 손으로 고치는 자리라 하드가 노멀보다 쉬워지는 오타가 반드시 언젠가 난다.
 */
{
    const D = balance.difficulty;
    if (!D?.order?.length || !D.levels) {
        err(`balance: difficulty.order / difficulty.levels 가 없다`);
    } else {
        if (D.order[0] !== "normal") err(`balance: difficulty.order 의 첫 항목은 'normal' 이어야 한다`);

        const seen = [];
        for (const id of D.order) {
            const lv = D.levels[id];
            const at = `balance/difficulty/${id}`;
            if (!lv) {
                err(`${at}: order 에 있는데 levels 에 정의가 없다`);
                continue;
            }
            // ★ 이름은 `{ ko, en }` 이 정본이다 — 한 언어만 있으면 반대 언어가 빈다
            for (const L of I18N_LANGS) {
                if (!lv.name?.[L]) err(`${at}: 이름의 '${L}' 가 없다`);
            }
            if (typeof lv.implemented !== "boolean") err(`${at}: implemented 플래그가 없다`);
            if (lv.implemented === false && !lv.note) {
                err(`${at}: 미구현인데 note 가 없다 — 플레이어에게 '왜 못 하는지'를 말할 수 없다`);
            }

            for (const k of ["enemyHpMult", "enemyAtkMult", "spawnCountMult"]) {
                if (!(lv[k] >= 1)) err(`${at}: ${k} 는 1 이상이어야 한다 (현재 ${lv[k]})`);
            }

            // 배율 단조성 — 뒤 난이도가 앞 난이도보다 약하면 순서가 거짓말이 된다
            const prev = seen[seen.length - 1];
            if (prev) {
                for (const k of ["enemyHpMult", "enemyAtkMult", "spawnCountMult"]) {
                    if (lv[k] < prev.lv[k]) {
                        err(`${at}: ${k} 가 '${prev.id}' 보다 낮다 (${lv[k]} < ${prev.lv[k]})`);
                    }
                }
            }
            seen.push({ id, lv });

            // 해금 조건은 자기보다 **앞선** 난이도만 참조할 수 있다 (순환 잠금 방지)
            const u = lv.unlock;
            if (!u?.type) err(`${at}: unlock 없음`);
            else if (u.type === "worldCleared") {
                const i = D.order.indexOf(u.difficulty);
                if (i < 0) err(`${at}: unlock.difficulty '${u.difficulty}' 가 order 에 없다`);
                else if (i >= D.order.indexOf(id)) {
                    err(`${at}: unlock 이 자기 자신 또는 더 어려운 난이도를 요구한다 — 영원히 열리지 않는다`);
                }
                if (!(u.minStars >= 1 && u.minStars <= 3)) {
                    err(`${at}: unlock.minStars 는 1–3 이어야 한다 (현재 ${u.minStars})`);
                }
            } else if (u.type !== "always") {
                err(`${at}: 알 수 없는 unlock.type '${u.type}'`);
            }

            // ★★ 경제 방어선. 하드 1회 수입이 노멀 반복 평균 수입(repeatFactor)을
            //   넘어서면 calibrate-economy 의 골드 곡선이 통째로 틀어지고,
            //   그 인플레이션은 레벨업 비용 곡선에 복리로 얹힌다.
            const rf = balance.economy.repeatFactor;
            const gm = lv.reward?.goldMult ?? 1;
            if (!(gm >= 1)) err(`${at}: reward.goldMult 는 1 이상이어야 한다`);
            if (gm > rf) {
                err(
                    `${at}: reward.goldMult ${gm} 가 economy.repeatFactor ${rf} 를 초과한다 — ` +
                        `하드가 '도전'이 아니라 '골드 파밍장'이 된다`
                );
            }
        }

        if (D.levels.normal) {
            const n = D.levels.normal;
            if (n.enemyHpMult !== 1 || n.enemyAtkMult !== 1 || n.spawnCountMult !== 1) {
                err(`balance/difficulty/normal: 노멀의 배율은 전부 1 이어야 한다 (기준선이다)`);
            }
            if ((n.reward?.stonesBase ?? 0) > 0 || (n.reward?.stonesPerStage ?? 0) > 0) {
                warn(
                    `balance/difficulty/normal: 노멀이 강화석을 준다 — ` +
                        `강화석은 하드·던전 전용 게이트 재화다 (15-content-plan.md §2)`
                );
            }
        }
    }
}

/* ── 나이트메어 규칙 (P11) ────────────────────────────────────
 *
 * ★★ 여기서 보는 것은 "어려운가"가 아니라 **규칙이 실재하는가 · 배정이 온전한가**다.
 *   나이트메어의 위험은 배율이 아니라 **규칙이 데이터에만 있고 아무 일도 하지
 *   않는 상태**이고, 그것이 이 저장소가 2026-08-05 하루에 여섯 건 겪은 모양이다.
 *
 * @see docs/02-design/22-nightmare.md §9
 */
{
    const nm = balance.difficulty?.levels?.nightmare;
    const M = nm?.mechanics;
    if (!M) {
        err(`balance/nightmare: mechanics 가 없다 — 배율만으로는 나이트메어가 아니다`);
    } else {
        const at = "balance/nightmare/mechanics";

        /* N2 — 데이터에만 있는 유령 규칙 (읽는 코드가 아는 id 뿐인가) */
        for (const id of Object.keys(M)) {
            if (isNote(id)) continue;
            if (!NIGHTMARE_IDS.includes(id)) {
                err(
                    `${at}: 규칙 '${id}' 를 logic/nightmare.js 가 모른다 — ` +
                        `데이터에만 있는 규칙은 적혀 있는데 아무 일도 하지 않는다 ` +
                        `(NIGHTMARE_IDS 에 등록하거나 지워라)`
                );
            }
        }
        for (const id of NIGHTMARE_IDS) {
            if (!M[id]) err(`${at}: logic/nightmare.js 가 아는 '${id}' 가 데이터에 없다`);
        }

        /* N1 — 월드 1–5 각각 정확히 하나. 0개 = 규칙 없는 나이트메어 월드,
           2개 = 누적 금지 위반 (§1 "규칙은 누적하지 않는다") */
        const byWorld = Object.create(null);
        for (const [id, m] of Object.entries(M)) {
            if (isNote(id)) continue;
            for (const w of m.worlds ?? []) (byWorld[w] ??= []).push(id);
        }
        for (const w of worlds.worlds) {
            const got = byWorld[w.world] ?? [];
            if (got.length !== 1) {
                err(
                    got.length === 0
                        ? `${at}: 월드 ${w.world} 에 걸리는 규칙이 없다 — 그 월드의 나이트메어는 배율뿐이다`
                        : `${at}: 월드 ${w.world} 에 규칙이 ${got.length}개다 (${got.join(", ")}) — ` +
                          `규칙은 누적하지 않는다 (22-nightmare.md §1). 들어가 봐야 규칙을 아는 판이 된다`
                );
                continue;
            }
            // ★ 데이터가 아니라 **규칙 모듈에게 물어본다.** 둘이 갈라지면 프리뷰가
            //   말하는 규칙과 전투가 거는 규칙이 다른 상태이고, 그것이 최악이다.
            const asked = nightmareFor(w.world)?.id ?? null;
            if (asked !== got[0]) {
                err(
                    `${at}: 월드 ${w.world} — 데이터는 '${got[0]}' 인데 ` +
                        `logic/nightmare.js:nightmareFor 는 '${asked}' 를 돌려준다`
                );
            }
        }
        for (const w of Object.keys(byWorld)) {
            if (!worlds.worlds.some((x) => String(x.world) === String(w))) {
                err(`${at}: 존재하지 않는 월드 ${w} 에 규칙이 배정돼 있다`);
            }
        }

        /* N3 — implemented:true 인데 규칙 소비처가 하나라도 없으면 오류.
           ★ **켜기 전에 못 켜게 한다.** 아래 FIELD_CONSUMERS 절이 필드 단위로
             같은 일을 하지만, 이 항은 "규칙 모듈 자체가 시뮬에 붙어 있는가"를 본다. */
        if (nm.implemented === true) {
            const WIRED = {
                plague_bloom: [
                    ["src/game/logic/sim.js", "stepNightmare"],
                    ["src/game/logic/lifecycle.js", "noteNightmareDeath"],
                ],
                bond_break: [["src/game/logic/movement.js", "bond_break"]],
                attrition: [["src/game/logic/stageConfig.js", "attrition"]],
            };
            for (const [id, pairs] of Object.entries(WIRED)) {
                for (const [file, needle] of pairs) {
                    const src = await readFile(file, "utf8").catch(() => null);
                    if (src === null) err(`${at}/${id}: 소비처 '${file}' 이 없다`);
                    else if (!src.includes(needle)) {
                        err(
                            `${at}/${id}: implemented:true 인데 ${file} 이 '${needle}' 을 부르지 않는다 — ` +
                                `규칙 없는 나이트메어는 하드의 연장일 뿐이다`
                        );
                    }
                }
            }
        }

        const P = M.plague_bloom;
        const B = M.bond_break;
        const A = M.attrition;

        /* N4 — 병합 간격이 반경 이상이면 병합이 슬롯을 통째로 잡아먹는다 */
        if (P && !(P.mergeGap < P.radius)) {
            err(
                `${at}/plague_bloom: mergeGap ${P.mergeGap} 가 radius ${P.radius} 이상이다 — ` +
                    `병합 범위가 장판보다 넓으면 레인마다 사실상 슬롯 하나만 산다`
            );
        }
        if (P && !(P.tickMs > 0 && P.durationMs > P.tickMs)) {
            err(`${at}/plague_bloom: durationMs 는 tickMs 보다 커야 한다 (한 번도 안 때리는 장판)`);
        }
        if (P && !(P.dpsPctOfMaxHp > 0 && P.dpsPctOfMaxHp < 1)) {
            err(`${at}/plague_bloom: dpsPctOfMaxHp 는 0 초과 1 미만이어야 한다`);
        }
        if (P && !(P.maxPerLane >= 1)) err(`${at}/plague_bloom: maxPerLane 은 1 이상`);

        /* N5 — 예고가 파열보다 늦거나, 파열이 감속이 되는 상태 */
        if (B && !(B.holdMs > B.telegraphMs)) {
            err(
                `${at}/bond_break: holdMs ${B.holdMs} 가 telegraphMs ${B.telegraphMs} 이하다 — ` +
                    `예고가 파열보다 늦으면 예고가 아니다`
            );
        }
        if (B && !(B.postBreakSpeedMult >= 1)) {
            err(
                `${at}/bond_break: postBreakSpeedMult ${B.postBreakSpeedMult} < 1 — ` +
                    `결박을 끊은 적이 느려지면 그것은 파열이 아니라 보상이다`
            );
        }

        /* N6 — 고갈의 두 배율은 0..1. 1 초과는 "환급이 늘어나는 고갈" */
        for (const k of ["killRefundMult", "summonDecayMult"]) {
            if (A && !(A[k] >= 0 && A[k] <= 1)) {
                err(`${at}/attrition: ${k} 는 0..1 이어야 한다 (현재 ${A?.[k]})`);
            }
        }

        /* 규칙 이름·요약은 프리뷰가 그대로 출력한다 — 비면 화면이 빈다 */
        for (const [id, m] of Object.entries(M)) {
            if (isNote(id)) continue;
            // ★ 이름·요약은 `{ ko, en }` 이다. **두 언어를 다 본다** — 한쪽이 비면
            //   그 언어의 프리뷰에서 규칙을 읽을 수 없고, 그 상태로도 아무도 실패하지 않는다.
            for (const L of I18N_LANGS) {
                if (!m.name?.[L]) err(`${at}/${id}: name.${L} 가 없다 (프리뷰 배지가 빈다)`);
                if (!m.summary?.[L]) {
                    err(`${at}/${id}: summary.${L} 가 없다 (진입 전에 규칙을 못 읽는다)`);
                }
            }
        }

        nightmareSummary =
            `나이트메어 규칙 ${Object.keys(M).filter((k) => !isNote(k)).length}종 · ` +
            `월드 ${worlds.worlds.map((w) => `${w.world}:${(byWorld[w.world] ?? ["—"])[0]}`).join(" ")}`;
    }
}

/* ── 월드별 요구 답안 가용성 ──────────────────────────────── */
/**
 * ★ "벽 = 편성 퍼즐" 명제의 자동 검증.
 *   각 월드가 요구하는 데미지 타입의 동료가 존재해야 한다.
 */
{
    const needByTag = { ARMORED: "arcane", WARDED: "physical", CORRUPT: "holy" };
    const haveDmg = new Set(units.units.map((u) => u.dmgType));
    const haveAntiAir = units.units.some(
        (u) => (u.tags ?? []).includes("ANTI_AIR") || u.dmgType !== "physical"
    );

    const usedTags = new Set();
    for (const st of stages.stages) {
        for (const w of st.waveTable ?? []) {
            for (const sp of w.spawns ?? []) {
                for (const t of ENEMY.get(sp.id)?.tags ?? []) usedTags.add(t);
            }
        }
    }
    for (const [tag, dmg] of Object.entries(needByTag)) {
        if (usedTags.has(tag) && !haveDmg.has(dmg)) {
            err(`로스터: '${tag}' 적이 등장하는데 ${dmg} 동료가 없다 — 뚫을 수단이 없는 벽`);
        }
    }
    if (usedTags.has("FLYING") && !haveAntiAir) {
        err(`로스터: FLYING 적이 등장하는데 대공 수단이 없다`);
    }
}

/* ── 설정 (P7-15) ─────────────────────────────────────────── */
/**
 * ★ 여기서 보는 것은 "설정이 예쁜가"가 아니라 **화면이 성립하는가**다.
 *   기본값이 선택지 밖이면 세그먼트 버튼이 아무것도 선택되지 않은 상태로 뜨고,
 *   사용자는 그 설정을 **원래 값으로 되돌릴 방법이 없다.**
 */
{
    const settings = await load("settings.json");
    const D = settings.defaults;
    if (!D) err("settings: defaults 가 없다");
    else {
        for (const [key, opts] of Object.entries(settings.options ?? {})) {
            const at = `settings/options/${key}`;
            if (!(key in D)) {
                err(`${at}: defaults 에 없는 키의 선택지다`);
                continue;
            }
            if (!Array.isArray(opts) || !opts.length) err(`${at}: 선택지가 비어 있다`);
            for (const o of opts) {
                if (!o.label) err(`${at}: value ${o.value} 에 한국어 라벨이 없다`);
                if (typeof o.value !== typeof D[key]) {
                    err(`${at}: value ${JSON.stringify(o.value)} 의 타입이 기본값과 다르다`);
                }
            }
            if (!opts.some((o) => o.value === D[key])) {
                err(`${at}: 기본값 ${JSON.stringify(D[key])} 가 선택지에 없다 — 되돌릴 수 없는 설정이 된다`);
            }
        }
        for (const [level, ratio] of Object.entries(settings.effectBudget ?? {})) {
            if (!(ratio > 0 && ratio <= 1)) err(`settings/effectBudget/${level}: 0 초과 1 이하여야 한다`);
        }
        for (const t of VALID_DMG) {
            if (!settings.damageTypeShort?.[t]) {
                err(`settings/damageTypeShort: '${t}' 표기가 없다 — 색약 모드에서 그 타입만 색으로만 남는다`);
            }
        }
    }
}

/* ── 크레딧 (P7-15) ───────────────────────────────────────── */
/**
 * ★ 크레딧 누락은 데이터 오류가 아니라 **법적·평판 리스크**다.
 *   `docs/legal/ATTRIBUTIONS.md` 는 이 JSON 에서 생성되므로
 *   (`npm run docs:attributions`), 여기가 비면 문서도 조용히 빈다.
 */
{
    const attr = await load("attributions.json");
    if (!attr.updated) err("attributions: updated(갱신일)가 없다");
    if (!attr.sections?.length) err("attributions: sections 가 비어 있다");

    const ids = new Set();
    for (const sec of attr.sections ?? []) {
        const at = `attributions/${sec.id}`;
        if (!sec.id) err("attributions: id 없는 절이 있다");
        if (ids.has(sec.id)) err(`${at}: id 중복`);
        ids.add(sec.id);
        if (!sec.title) err(`${at}: 한국어 제목 없음`);
        if (!Array.isArray(sec.entries)) {
            err(`${at}: entries 가 배열이 아니다`);
            continue;
        }
        // 빈 절은 "왜 비었는지"를 반드시 말해야 한다 (효과음이 그렇다)
        if (!sec.entries.length && !sec.note) {
            err(`${at}: 항목이 없는데 note 도 없다 — 빠뜨린 것인지 예정인지 알 수 없다`);
        }
        for (const e of sec.entries) {
            if (!e.name) err(`${at}: 이름 없는 항목이 있다`);
            if (e.url && !/^https?:\/\//.test(e.url)) err(`${at}/${e.name}: url 형식이 아니다`);
        }
    }

    // 실제로 재생하는 BGM 트랙이 크레딧에 있는지 — 코드와 크레딧이 갈라지는 것을 막는다
    const credited = new Set(
        (attr.sections.find((s) => s.id === "music")?.entries ?? []).map((e) => e.name)
    );
    const bgm = await readFile("src/game/fx/AudioManager.js", "utf8");
    for (const m of bgm.matchAll(/"([a-z0-9][a-z0-9_-]{12,})"/g)) {
        if (!credited.has(m[1])) warn(`attributions/music: 재생 중인 트랙 '${m[1]}' 이 크레딧에 없다`);
    }
}

/* ── 효과음 (P3-14) ───────────────────────────────────────────
 *
 * ★★ 여기서 막는 것은 **무증상 무음**이다.
 *
 *   효과음은 파일이 아니라 sfx.json 의 합성 파라미터다. 오타가 나면 예외도,
 *   404 도, 마젠타 플레이스홀더도 없다 — 그냥 그 소리만 안 난다. 그리고
 *   아무도 모른다. 실제로 이 기능의 원래 상태가 "sfx() 는 있는데 아무도
 *   부르지 않는다"였고, 몇 스프린트 동안 발견되지 않았다.
 *
 *   그래서 코드의 논리 키 목록(sfxKeys.js)과 데이터를 **양방향**으로 대조한다.
 *   정의 없는 키(무음)도, 아무도 안 쓰는 정의(죽은 데이터)도 오류다.
 *
 * ★ Web Audio 명세가 요구하는 것도 함께 본다: 지수 램프는 0 을 목표로 삼을 수
 *   없으므로 주파수·게인은 반드시 양수여야 한다. 0 이 들어가면 브라우저가
 *   그 레이어에서 throw 하고, 그 판의 소리가 통째로 죽는다.
 */
const WAVES = ["sine", "square", "sawtooth", "triangle"];
const FILTERS = ["lowpass", "highpass", "bandpass"];
let sfxCount = 0;
{
    const sfx = await load("sfx.json");
    const sounds = sfx.sounds ?? {};
    const names = Object.keys(sounds);
    sfxCount = names.length;

    const lim = sfx.limiter ?? {};
    if (!(sfx.master > 0 && sfx.master <= 1)) err("sfx: master 게인은 0<x<=1 이어야 한다");
    if (!(lim.globalMaxVoices >= 1)) err("sfx: limiter.globalMaxVoices 가 없다 — 상한 없는 오디오는 찢어진다");
    if (!(lim.maxDurationSec > 0)) err("sfx: limiter.maxDurationSec 가 없다");

    /* 코드 ↔ 데이터 양방향 대조 */
    for (const key of ALL_SFX_KEYS) {
        if (!sounds[key]) err(`sfx: 논리 키 '${key}' 의 정의가 없다 — 그 소리는 영원히 무음이다`);
    }
    for (const key of names) {
        if (!ALL_SFX_KEYS.includes(key)) {
            err(`sfx/${key}: 아무도 쓰지 않는 정의다 — src/game/fx/sfxKeys.js 에 추가하거나 지워라`);
        }
    }

    for (const [name, def] of Object.entries(sounds)) {
        const at = `sfx/${name}`;
        if (!Array.isArray(def.layers) || !def.layers.length) {
            err(`${at}: layers 가 비었다 — 소리를 만들 재료가 없다`);
            continue;
        }
        if (!(def.gain > 0 && def.gain <= 1)) err(`${at}: gain 은 0<x<=1 이어야 한다`);
        if (!(def.cooldownMs >= 0)) err(`${at}: cooldownMs 가 없다 — 중복 재생 제한이 무력화된다`);
        if (!(def.maxVoices >= 1)) err(`${at}: maxVoices 는 1 이상이어야 한다`);
        if (!(def.pitchVar >= 0 && def.pitchVar <= 0.5)) {
            err(`${at}: pitchVar 은 0~0.5 여야 한다 (넘으면 음정이 아니라 고장으로 들린다)`);
        }

        let dur = 0;
        for (let i = 0; i < def.layers.length; i++) {
            const L = def.layers[i];
            const la = `${at}/layer${i}`;
            if (L.src !== "tone" && L.src !== "noise") err(`${la}: src 는 'tone' 또는 'noise' 다`);
            if (!(L.gain > 0)) err(`${la}: gain 은 양수여야 한다`);
            if (!(L.decay > 0)) err(`${la}: decay 가 없다 — 끝나지 않는 소리가 된다`);
            if (L.src === "tone") {
                if (!WAVES.includes(L.wave)) err(`${la}: 알 수 없는 파형 '${L.wave}'`);
                if (!(L.freq > 0)) err(`${la}: freq 는 양수여야 한다 (지수 램프는 0 을 못 쓴다)`);
                if (L.freqEnd !== undefined && !(L.freqEnd > 0)) err(`${la}: freqEnd 는 양수여야 한다`);
            }
            if (L.filter) {
                if (!FILTERS.includes(L.filter.type)) err(`${la}: 알 수 없는 필터 '${L.filter.type}'`);
                if (!(L.filter.freq > 0)) err(`${la}: filter.freq 는 양수여야 한다`);
                if (L.filter.freqEnd !== undefined && !(L.filter.freqEnd > 0)) {
                    err(`${la}: filter.freqEnd 는 양수여야 한다`);
                }
            }
            dur = Math.max(dur, (L.delay ?? 0) + (L.attack ?? 0) + (L.hold ?? 0) + (L.decay ?? 0));
        }

        if (dur > lim.maxDurationSec) {
            err(`${at}: 길이 ${dur.toFixed(2)}초가 상한 ${lim.maxDurationSec}초를 넘는다 — 효과음이 아니라 BGM 이다`);
        }
        // ★ 긴 소리가 여러 개 겹치면 화음이 아니라 진흙이 된다.
        //   짧은 타격음은 3~4개까지 겹쳐도 '난전'으로 들리지만,
        //   0.35초를 넘는 소리는 두 개만 겹쳐도 무엇이 울렸는지 알 수 없다.
        if (dur > 0.35 && def.maxVoices > 2) {
            warn(`${at}: 길이 ${Math.round(dur * 1000)}ms 인데 동시 ${def.maxVoices}개까지 허용한다 — 겹치면 뭉갠다`);
        }
        // ★ 쿨다운 0 + 높은 상한은 사실상 무제한이다.
        if (!def.cooldownMs && def.maxVoices > 2) {
            warn(`${at}: 쿨다운이 0 인데 동시 ${def.maxVoices}개까지 허용한다 — 상한이 사실상 없다`);
        }
    }
}

/* ── 로스터 대공 정합성 (P6-04) ──────────────────────────────
 *
 * ★★ 여기서 막는 것은 **평생 한 대도 못 때리는 동료**다.
 *   공중 레인의 적은 전부 FLYING 이고, 물리 딜러는 ANTI_AIR 태그가 없으면
 *   `canTarget` 이 항상 거부한다. 문법은 완전하고 태그 하나가 없을 뿐이라
 *   lint 도 타입도 기존 테스트도 잡지 못한다.
 *
 * ★ 판정은 combat.js 를 **import 해서** 쓴다. 여기서 "물리면 ANTI_AIR 필요"를
 *   다시 적으면 검사기가 두 번째 출처가 되고, 규칙이 바뀌는 날 갈라진다.
 */
{
    for (const u of units.units) {
        const at = `units/${u.id}`;
        if (u.role !== "FLYER") continue;
        if (!canHitFlying(tagsToMask(u.tags ?? []), u.dmgType)) {
            err(
                `${at}: FLYER 인데 공중을 때릴 수 없다 (dmgType '${u.dmgType}' + 태그 ${JSON.stringify(u.tags ?? [])}). ` +
                    `공중 레인의 적은 전부 FLYING 이므로 이 동료는 평생 한 대도 못 때린다 — ANTI_AIR 를 붙여라`
            );
        }
    }

    // ★ 같은 그림을 쓰는 동료가 둘이면 레인에서 구분할 수 없다 (P6-04).
    const seenArt = new Map();
    for (const u of units.units) {
        const key = `${u.art?.atlas ?? "units"}/${u.art?.frame}`;
        if (seenArt.has(key)) {
            err(`units/${u.id}: 스프라이트 '${key}' 가 '${seenArt.get(key)}' 와 같다 — 전장에서 구분할 수 없다`);
        }
        seenArt.set(key, u.id);
    }

    // ★ 역할 목록의 **단일 출처 검사.** 데이터에만 있는 역할은 화면에서 사라진다.
    for (const u of units.units) {
        if (!ROLE_ORDER.includes(u.role)) {
            err(
                `units/${u.id}: 역할 '${u.role}' 이 logic/roles.js:ROLE_ORDER 에 없다 — ` +
                    `편성 화면·도감·분석 패널이 이 동료를 그리지 않는다`
            );
        }
    }
}

/* ── 캠페인 확정 지급 (P8-02) ──────────────────────────────────
 *
 * ★★ 이 절이 이 기능의 **집행 지점**이다.
 *   `unlocks.json` 은 "요구되기 전에 준다"를 **주장**할 뿐이고, 그 주장이 참인지는
 *   스테이지 데이터가 바뀔 때마다 달라진다. 여기서 매번 대조하지 않으면
 *   `gen:stages` 한 번에 조용히 거짓이 된다.
 *
 * ★ 검사식: 모든 스테이지 S 에 대해
 *     recommendedLoadoutForStage(S) ⊆ guaranteedUnitsBefore(S)
 *   즉 **그 스테이지가 요구하는 편성을 그 스테이지에 들어가기 전에 갖고 있어야 한다.**
 *   위반하면 그 스테이지의 답은 뽑기 운에 걸리고, "벽 = 편성 퍼즐"이 무너진다
 *   (CLAUDE.md 설계 결정 5 · 15-content-plan.md §1.1).
 */
{
    // ★ STAGE_GRANTS · STARTING_UNITS 는 파일 맨 위에서 이미 가져왔다 (영입 절이 쓴다)
    const { guaranteedUnitsBefore } = await import("../src/game/logic/unlocks.js");
    const { stageEnemyCounts, stageCounterTags } = await import(
        "../src/game/logic/stagePreview.js"
    );

    const stageIds = new Set(stages.stages.map((s) => s.id));
    const unitIds = new Set(units.units.map((u) => u.id));

    // ① 참조 정합성 — 존재하지 않는 스테이지·동료를 가리키면 지급이 조용히 사라진다
    const seen = new Set();
    for (const g of STAGE_GRANTS) {
        if (!stageIds.has(g.stage)) err(`unlocks: 알 수 없는 스테이지 '${g.stage}'`);
        for (const u of g.units) {
            if (!unitIds.has(u)) err(`unlocks: 알 수 없는 동료 '${u}' (${g.stage})`);
            if (seen.has(u)) err(`unlocks: '${u}' 가 두 번 지급된다 (${g.stage})`);
            seen.add(u);
        }
    }
    for (const u of STARTING_UNITS) {
        if (seen.has(u)) err(`unlocks: '${u}' 는 시작 보유다 — 캠페인 지급과 중복`);
    }

    /**
     * ② ★ 핵심 검사 — **요구 답안**을 요구되기 전에 갖고 있는가.
     *
     * ★ 처음에는 "추천 편성 6종 전부"를 검사했는데 **검사가 틀렸다.**
     *   `recommendedLoadout` 은 상성 답을 넣은 뒤 남은 칸을 일반 화력으로 **항상 6칸까지**
     *   채운다. 그래서 1-1 조차 6종을 요구하는 것으로 보였지만, 실제로는 2종으로 이긴다
     *   (`tools/playthrough.mjs` 실측 — 1-1~1-8 을 시작 2종으로 완주).
     *   15-content-plan.md §1.1 이 요구하는 것도 "요구 **답안** 동료"이지 편성 전체가 아니다.
     *
     * ★ 그래서 검사 대상은 **답의 범주**다. 채우기 칸은 무엇이 오든 상관없다.
     */
    const ANSWERS = [
        {
            tag: "ARMORED",
            label: "술식(DEF 무시)",
            ok: (u) => u.dmgType === "arcane",
        },
        {
            tag: "CORRUPT",
            label: "신성(CORRUPT 특효)",
            ok: (u) => u.dmgType === "holy",
        },
        {
            tag: "FLYING",
            label: "대공",
            ok: (u) => canHitFlying(tagsToMask(u.tags ?? []), u.dmgType),
        },
    ];

    for (const s of stages.stages) {
        const have = [...guaranteedUnitsBefore(s.id)].map((id) => UNIT.get(id)).filter(Boolean);
        const tags = stageCounterTags(stageEnemyCounts(s.id));

        // 막는 것은 오직 BLOCKER 뿐이다 — 어떤 상성 답으로도 대체되지 않는다
        if (!have.some((u) => u.role === "BLOCKER")) {
            err(`unlocks: ${s.id} 시점에 확정 보유 방벽이 없다`);
        }
        for (const a of ANSWERS) {
            if (!tags.has(a.tag)) continue;
            if (!have.some(a.ok)) {
                err(
                    `unlocks: ${s.id} 가 ${a.tag} 를 내는데 그 답(${a.label})이 확정 지급에 없다 — ` +
                        `확정 보유 ${have.length}종. 뽑기 운으로 답을 구하게 되면 ` +
                        `"벽 = 편성 퍼즐"이 성립하지 않는다 (15-content-plan §1.1)`
                );
            }
        }
    }

    // ③ 6칸을 채울 수 있는 시점 — 채우지 못하면 편성 퍼즐 자체가 성립하지 않는다
    const fullAt = stages.stages.find((s) => guaranteedUnitsBefore(s.id).size >= 6);
    if (!fullAt) err("unlocks: 확정 지급만으로는 6칸을 끝내 채우지 못한다");

    unlockSummary = `확정 지급 ${seen.size}종 (시작 보유 ${STARTING_UNITS.length}종 별도) · 6칸 완성 ${fullAt?.id ?? "-"}`;
}

/* ── 동료 영입 (2026-08-04) ────────────────────────────────────
 *
 * ★★ **왜 이 절이 필요한가.** 가챠를 걷어내자 30종 중 20종이 **아무 경로로도
 *   얻을 수 없는 상태**가 됐다 — 데이터는 멀쩡했고, 화면도 멀쩡했고, 다만
 *   그 동료들에게 도달하는 문이 사라졌을 뿐이라 어떤 검사기도 잡지 못했다.
 *
 * ★ 그래서 규칙을 하나 세운다: **모든 동료는 확정 지급이거나 영입 가능하다.**
 *   둘 다 아니면 그것은 존재하지 않는 콘텐츠다.
 */
{
    const grantedIds = new Set([...STARTING_UNITS, ...STAGE_GRANTS.flatMap((g) => g.units)]);

    // ★ 캠페인 마지막 스테이지의 전역 순번 — 이 수를 여기 적지 않는다
    const MAX_CAMPAIGN_STAGE = Math.max(...stages.stages.map((s) => gIdx(s.id)));

    for (const u of units.units) {
        const granted = grantedIds.has(u.id);
        const recruitable = isRecruitable(u.id);
        if (!granted && !recruitable) {
            err(
                `recruit: '${u.id}' 는 확정 지급도 영입도 되지 않는다 — ` +
                    `데이터에만 있고 얻을 수 없는 동료다`
            );
        }
        if (granted && recruitable) {
            err(`recruit: '${u.id}' 가 지급과 영입 양쪽에 있다 — 골드를 내고 중복 구매된다`);
        }
        if (!recruitable) continue;

        const cost = recruitCost(u.id);
        const at = recruitUnlockStage(u.id);
        if (!(cost > 0)) err(`recruit: '${u.id}' 의 영입가가 0 이하다 (${cost})`);
        if (!(at >= 1) || at > MAX_CAMPAIGN_STAGE) {
            err(`recruit: '${u.id}' 의 해금 지점 ${at} 이 캠페인 범위(1~${MAX_CAMPAIGN_STAGE}) 밖이다`);
        }
    }

    // ★ 가장 싼 영입이 열리는 시점에 살 수 있어야 한다 — 아니면 목록이 조롱이 된다
    const first = RECRUITABLE.map((id) => ({ id, at: recruitUnlockStage(id), cost: recruitCost(id) }))
        .sort((a, b) => a.at - b.at || a.cost - b.cost)[0];
    if (first) {
        // ★ 수입 공식은 difficulty.js:stageRewards 와 **같아야 한다** — 여기서
        //   "대충 base × 스테이지 수" 로 어림하면 성장률만큼 과소평가해서
        //   멀쩡한 가격에 경고가 뜬다 (실제로 떴다).
        const E = balance.economy;
        const g = E.goldPerStageGrowth;
        const earn =
            E.startingGold + (E.goldPerStageBase * (Math.pow(g, first.at) - 1)) / (g - 1);
        if (first.cost > earn) {
            warn(
                `recruit: 첫 영입 '${first.id}' 가 ${first.cost}골드인데 ` +
                    `해금 시점(스테이지 ${first.at})까지 누적 수입은 약 ${Math.round(earn)}골드다`
            );
        }
    }

    recruitSummary = `영입 ${RECRUITABLE.length}종 (확정 지급 ${grantedIds.size}종)`;
}

/* ── 가이드 (2026-08-04) ───────────────────────────────────────
 *
 * ★★ 가이드는 **밸런스 수치를 문장에 적지 않고** `guideFacts()` 로 그때그때
 *   읽어 온다 (절대 규칙 4). 그 규약이 지켜지는지 여기서 본다 —
 *   ① 알 수 없는 fact 종류를 적으면 표가 조용히 비고,
 *   ② 본문에 숫자를 박으면 밸런스를 고친 다음 날부터 가이드가 거짓말을 한다.
 */
{
    const guide = await load("guide.json");
    const groupIds = new Set(guide.groups.map((g) => g.id));
    const seen = new Set();

    for (const t of guide.topics) {
        const at = `guide/${t.id}`;
        if (seen.has(t.id)) err(`${at}: 주제 id 가 중복이다`);
        seen.add(t.id);
        if (!groupIds.has(t.group)) err(`${at}: 알 수 없는 그룹 '${t.group}'`);
        /**
         * ★ 제목·본문은 `{ ko, en }` 이다 (i18n 정본 — `src/i18n/index.js:pick`).
         *   본문은 **언어마다 배열**이라, 두 배열의 줄 수가 어긋나면 강조와 순서가
         *   갈라진다 (한쪽에서 사라진 문장은 아무도 실패하지 않는다). 여기서 잡는다.
         */
        for (const L of I18N_LANGS) {
            if (!t.title?.[L]) err(`${at}: 제목의 '${L}' 가 없다`);
            if (!Array.isArray(t.body?.[L]) || t.body[L].length === 0) {
                err(`${at}: 본문의 '${L}' 가 비었다`);
            }
        }
        if (
            Array.isArray(t.body?.ko) &&
            Array.isArray(t.body?.en) &&
            t.body.ko.length !== t.body.en.length
        ) {
            err(`${at}: 본문 줄 수가 언어마다 다르다 (ko ${t.body.ko.length} · en ${t.body.en.length})`);
        }

        if (t.facts) {
            if (!GUIDE_FACT_KINDS.includes(t.facts)) {
                err(`${at}: 알 수 없는 fact 종류 '${t.facts}' — logic/guide.js:FACT_KINDS 참고`);
            } else if (guideFacts(t.facts).length === 0) {
                err(`${at}: fact '${t.facts}' 가 아무 값도 만들지 않는다 (표가 빈 채로 뜬다)`);
            }
        }

        // ★ 본문에 박힌 수치 — 골드·초·% 가 문장에 있으면 데이터와 갈라진다
        //   ★ 두 언어를 **둘 다** 본다. 한 언어만 검사하면 다른 쪽이 조용히 썩는다.
        for (const line of I18N_LANGS.flatMap((L) => t.body?.[L] ?? [])) {
            const m = line.match(/\d[\d,.]*\s*(골드|초|%|마나)/);
            if (m) {
                warn(`${at}: 본문에 수치 '${m[0]}' 가 박혀 있다 — facts 로 옮기는 것이 맞다`);
            }

            /**
             * ★★ **강조는 `**…**` 뿐이다.** `GuideOverlay` 는 마크다운 파서를 붙이지
             *   않고 그 한 문법만 `<b>` 로 바꾼다 (그 파일 머리말에 이유가 있다).
             *   그래서 홑별표를 쓰면 **별표가 화면에 그대로 나온다** — 문법 오류가
             *   아니라 조용한 오타라 아무도 실패하지 않는다. 실제로 그렇게 나갔다
             *   (2026-08-05, `battle.commander` 의 "오라 *밖*에서만").
             */
            const stray = line.replace(/\*\*.+?\*\*/g, "");
            if (stray.includes("*")) {
                err(
                    `${at}: 본문에 홑별표가 있다 — 강조는 \`**…**\` 뿐이고, ` +
                        `그 밖의 별표는 화면에 그대로 찍힌다: "${line.slice(0, 60)}…"`
                );
            }
        }
    }

    // 화면 키는 실재하는 라우트여야 한다
    const SCREENS = ["ark", "stages", "loadout", "companions", "battle", "settings"];
    for (const t of guide.topics) {
        if (t.screen && !SCREENS.includes(t.screen)) {
            err(`guide/${t.id}: 알 수 없는 화면 '${t.screen}'`);
        }
    }

    guideSummary = `가이드 ${guide.topics.length}주제 / ${guide.groups.length}묶음`;
}

/* ── 지휘관 성장 (2026-08-05) ──────────────────────────────────
 *
 * ★★ 이 절이 지휘관 성장의 **집행 지점**이다. 검사하는 명제는 넷이다:
 *   ① 장구가 가리키는 스테이지가 실재하는가 (없으면 그 장구는 영원히 못 받는다)
 *   ② 슬롯 · 아이콘 참조가 실재하는가
 *   ③ **선언한 효과 키를 코드가 실제로 읽는가** — 이 저장소가 반복해서 겪은
 *      "데이터에만 있고 아무도 안 읽는 필드"를 처음부터 막는다
 *   ④ 성장이 아무리 쌓여도 **평타 사거리 < 오라 반경** 부등식이 유지되는가
 *      (docs/02-design/20-commander-combat.md §2.1 — 이 게임의 설계 심장)
 */
{
    const commanderData = await load("commander.json");
    const iconsData = await load("icons.json");
    const { commanderEffects, COMMANDER_MAX_LEVEL } = await import(
        "../src/game/logic/commander.js"
    );

    const stageIds = new Set(stages.stages.map((s) => s.id));
    const slotIds = new Set(commanderData.slots.map((s) => s.id));
    // ★ 아이콘 키는 `icons.json` 이 단일 출처다 — 없는 키를 쓰면 화면에 빈 칸이 뜬다
    const ICON_KEYS = new Set(Object.keys(iconsData.icons ?? {}));
    const seenItem = new Set();

    for (const it of commanderData.items) {
        const at = `commander/${it.id}`;
        if (seenItem.has(it.id)) err(`${at}: 장구 id 가 중복이다`);
        seenItem.add(it.id);
        if (!slotIds.has(it.slot)) err(`${at}: 알 수 없는 슬롯 '${it.slot}'`);
        if (!stageIds.has(it.stage)) {
            err(`${at}: 알 수 없는 스테이지 '${it.stage}' — 이 장구는 영원히 지급되지 않는다`);
        }
        if (!ICON_KEYS.has(it.icon)) err(`${at}: 알 수 없는 아이콘 키 '${it.icon}'`);
        if (!it.effect || Object.keys(it.effect).length === 0) {
            err(`${at}: 효과가 비어 있다 — 얻어도 아무 일이 일어나지 않는다`);
        }
    }

    /**
     * ③ **선언 ↔ 소비 대조.**
     *   `commanderEffects()` 가 돌려주는 키 집합과 `stageConfig.js` 가 읽는 키 집합이
     *   같아야 한다. 한쪽에만 있으면 그 값은 조용히 버려진다.
     */
    const produced = Object.keys(commanderEffects({ level: 2, sanctum: 1 }));
    const stageConfigSrc = await readFile("src/game/logic/stageConfig.js", "utf8");
    const spellsSrc = await readFile("src/game/logic/spells.js", "utf8");
    for (const key of produced) {
        // `spellPowerPct` 는 stageConfig 가 `spellPowerMult` 로 바꿔 spells.js 가 읽는다
        const read =
            stageConfigSrc.includes(`m.${key}`) ||
            (key === "spellPowerPct" && spellsSrc.includes("spellPowerMult"));
        if (!read) {
            err(
                `commander: 효과 키 '${key}' 를 읽는 코드가 없다 — ` +
                    `데이터에만 있는 성장은 골드를 받고 아무것도 하지 않는다 (성소가 그랬다)`
            );
        }
    }
    // 반대 방향 — 아이템이 선언한 키가 합산 결과에 없으면 오타다
    for (const it of commanderData.items) {
        for (const k of Object.keys(it.effect)) {
            if (!produced.includes(k)) {
                err(`commander/${it.id}: 효과 키 '${k}' 는 commanderEffects 가 합산하지 않는다`);
            }
        }
    }

    /**
     * ④ **부등식.** 최대 성장(만렙 + 전 슬롯 장착 + 성소 만렙)에서도
     *   평타 사거리가 오라 반경보다 짧아야 한다.
     */
    const sanctumMax =
        metaData.ark.facilities.find((f) => f.id === "sanctum")?.maxLevel ?? 0;
    const equipped = {};
    for (const slot of commanderData.slots) {
        // 각 슬롯에서 가장 센 것을 끼운 상태를 가정한다 (효과 합이 가장 큰 것)
        const best = commanderData.items
            .filter((i) => i.slot === slot.id)
            .sort(
                (a, b) =>
                    Object.values(b.effect).reduce((x, y) => x + y, 0) -
                    Object.values(a.effect).reduce((x, y) => x + y, 0)
            )[0];
        if (best) equipped[slot.id] = best.id;
    }
    const maxEff = commanderEffects({
        level: COMMANDER_MAX_LEVEL,
        equipped,
        sanctum: sanctumMax,
    });
    const cmd = balance.commander;
    const maxAura = cmd.auraRadius + maxEff.auraRadiusFlat;
    if (!(cmd.attack.range < maxAura)) {
        err(
            `commander: 최대 성장에서 평타 사거리(${cmd.attack.range}) 가 ` +
                `오라 반경(${maxAura}) 보다 짧지 않다 — 지휘관이 오라 안에 머문 채 ` +
                `때릴 수 있게 되면 '미끼'라는 설계가 사라진다 (20-commander-combat.md §2.1)`
        );
    }
    if (maxAura > (cmd.auraRadiusMax ?? maxAura)) {
        err(
            `commander: 최대 오라 반경 ${maxAura} 가 데이터의 상한 ` +
                `${cmd.auraRadiusMax} 를 넘는다 — 가이드가 플레이어에게 약속한 값과 어긋난다`
        );
    }

    /**
     * ★★★ **`auraRadiusMax` 는 계산해서 대조한다** (2026-08-05).
     *
     *   예전 값(336)은 **어디서도 강제되지 않는 숫자**였다. 그런데 가이드는
     *   그 값을 그대로 읽어 "최대 반경 336 (성소 · 각인)" 이라고 플레이어에게
     *   말하고 있었고, 실제 도달치는 533 이었다 — 화면이 거짓말을 하고 있었다.
     *
     *   상한을 강제하는 대신(광역 지휘 너프가 된다) **사실을 적기로** 했으므로,
     *   이 값은 이제 **파생값**이다. 손으로 적힌 파생값은 반드시 갈라지므로
     *   여기서 계산해 대조한다 — 성소·각인 어느 쪽을 바꿔도 이 검사가 먼저 실패한다.
     *
     * ★ 반올림 위치까지 실제 코드와 같아야 한다: 성소는 **더하고**(정수),
     *   각인은 `sigils.js:mulAuraRadius` 가 스택마다 `Math.round` 한다.
     */
    {
        const wide = sigils.sigils.find((s) =>
            (s.hooks ?? []).some((h) => h.op === "mulAuraRadius")
        );
        let reach = cmd.auraRadius + maxEff.auraRadiusFlat;
        if (wide) {
            const mul = wide.hooks.find((h) => h.op === "mulAuraRadius").value;
            for (let i = 0; i < (wide.maxStacks ?? 1); i++) reach = Math.round(reach * mul);
        }
        if (cmd.auraRadiusMax !== reach) {
            err(
                `commander: auraRadiusMax 가 ${cmd.auraRadiusMax} 인데 실제 도달치는 ${reach} 다 ` +
                    `(성소 만렙 ${cmd.auraRadius + maxEff.auraRadiusFlat}` +
                    `${wide ? ` → '${wide.name.ko}' ${wide.maxStacks}스택` : ""}). ` +
                    `가이드가 이 값을 "최대 반경"이라고 플레이어에게 그대로 보여 준다 — ` +
                    `상한을 실제로 걸지 않는 한 이 숫자는 **사실**이어야 한다`
            );
        }
    }

    commanderSummary =
        `지휘관 장구 ${commanderData.items.length}종 / 슬롯 ${commanderData.slots.length} · ` +
        `만렙 ${COMMANDER_MAX_LEVEL} · 오라 ${cmd.auraRadius} → 성소 만렙 ${maxAura} → ` +
        `각인 포함 ${cmd.auraRadiusMax}`;
}

/* ── 지휘관 주문 (2026-08-05, 12종 → 장착 4칸) ──────────────────
 *
 * ★★ 주문이 4종일 때는 이 절이 없어도 됐다. 눈으로 다 보였기 때문이다.
 *   12종이 되고 그중 **4종만 들고 나가는** 순간 조용히 죽는 자리가 늘어난다:
 *     · 기본 장착이 아직 해금되지 않은 주문을 가리키면 → 신규 계정이 빈 손이다
 *     · 해금 스테이지가 오타면 → 그 주문은 **영원히** 열리지 않는다
 *     · `kind` 를 `spells.js` 가 모르면 → 발동은 되고 아무 일도 안 일어난다
 *     · `effect` 에 적은 필드를 코드가 안 읽으면 → 기획자가 튜닝해도 화면은 그대로
 *   전부 **문법이 완전하고 아무도 실패하지 않는** 종류라 테스트가 잡지 못한다.
 *
 * ★ 검사 방향은 지휘관 장구 절(§지휘관 성장 ③)과 같다 — 선언과 소비를 **양쪽에서**
 *   맞춘다. 데이터에만 있는 것도, 코드에만 있는 것도 오류다.
 */
{
    const spellData = await load("spells.json");
    const iconsData = await load("icons.json");
    const spellsSrc = await readFile("src/game/logic/spells.js", "utf8");

    const stageIds = new Set(stages.stages.map((s) => s.id));
    const ICON_KEYS = new Set(Object.keys(iconsData.icons ?? {}));
    const list = spellData.spells ?? [];
    const byId = new Map(list.map((sp) => [sp.id, sp]));

    /** 대상 축 — 값마다 `spells.js` 가 실제로 분기하는지 본다 */
    const VALID_TARGETS = ["lane", "aura", "self"];

    /* ① 개별 항목 */
    const seen = new Set();
    const seenIcon = new Map();
    for (const sp of list) {
        const at = `spells/${sp.id}`;
        if (seen.has(sp.id)) err(`${at}: 주문 id 가 중복이다`);
        seen.add(sp.id);

        if (!(sp.cost > 0)) err(`${at}: cost 가 양수가 아니다`);
        if (!(sp.cooldownMs > 0)) err(`${at}: cooldownMs 가 양수가 아니다`);
        /**
         * ★ 정본은 `{ "name": { ko, en } }` 다 (2026-08-07). `nameKo`/`descKo` 는
         *   구형이고 `check:i18n` 의 I5 가 따로 잡는다 — 여기서는 **한국어가 있는가**만
         *   본다. 영어는 두 검사기가 같은 명제를 나눠 갖는 것이 아니라, 하나는
         *   '데이터가 완전한가', 하나는 '두 언어가 갖춰졌는가'를 본다.
         */
        if (!sp.name?.ko || !sp.desc?.ko) err(`${at}: 한글 이름·설명이 있어야 한다`);
        /**
         * ★ `$why` 는 장식이 아니다. **12종을 만드는 순간 "수치만 다른 12종"이
         *   되기 가장 쉬우므로**, 왜 이것이 다른 선택인지를 한 줄로 적게 강제한다.
         *   적을 수 없으면 그 주문은 만들 이유가 없다는 뜻이다.
         */
        if (!sp.$why) err(`${at}: $why 가 없다 — '왜 이것이 다른 선택인가'를 한 줄로 적어라`);
        if (!ICON_KEYS.has(sp.icon)) err(`${at}: 알 수 없는 아이콘 키 '${sp.icon}'`);

        // ★ 아이콘이 겹치면 12칸짜리 고르는 화면에서 두 주문이 같은 그림이 된다
        if (sp.icon && seenIcon.has(sp.icon)) {
            err(
                `${at}: 아이콘 '${sp.icon}' 이 '${seenIcon.get(sp.icon)}' 과 겹친다 — ` +
                    `12칸을 고르는 화면에서 같은 그림 둘은 고르는 근거를 지운다`
            );
        }
        seenIcon.set(sp.icon, sp.id);

        if (!VALID_TARGETS.includes(sp.target)) {
            err(`${at}: 알 수 없는 대상 '${sp.target}' (${VALID_TARGETS.join(" · ")})`);
        } else if (!spellsSrc.includes(`def.target === "${sp.target}"`)) {
            err(
                `${at}: 대상 '${sp.target}' 을 분기하는 코드가 logic/spells.js 에 없다 — ` +
                    `대상 축이 데이터에만 있으면 그 값을 바꿔도 아무 일도 일어나지 않는다`
            );
        }

        if (sp.unlockStage !== undefined && !stageIds.has(sp.unlockStage)) {
            err(
                `${at}: 알 수 없는 해금 스테이지 '${sp.unlockStage}' — ` +
                    `이 주문은 영원히 지급되지 않는다 (commander.json 장구와 같은 규약)`
            );
        }

        /**
         * ② **선언 ↔ 소비 대조.** `effect` 에 적은 필드는 `spells.js` 가 `fx.<키>` 로
         *   읽어야 한다. 지휘관 장구 절과 같은 수법이고, 여기서 실제로 잡혔다:
         *   `radius` 가 두 주문에 적혀 있었는데 `castSpell` 은 레인 전체를 때렸다 —
         *   4개월간 아무도 읽지 않은 필드였다 (2026-08-05 제거).
         */
        for (const key of Object.keys(sp.effect ?? {})) {
            if (key === "kind") continue;
            if (!spellsSrc.includes(`fx.${key}`)) {
                err(
                    `${at}: effect.${key} 를 읽는 코드가 logic/spells.js 에 없다 — ` +
                        `데이터에만 있는 수치는 기획자가 고쳐도 전투가 아무 반응을 하지 않는다 ` +
                        `(effect.radius 가 정확히 그 상태였다)`
                );
            }
        }
    }

    /* ③ kind 양방향 대조 — 데이터가 모르는 분기도, 코드가 모르는 kind 도 오류다 */
    const declaredKinds = new Set(list.map((sp) => sp.effect?.kind).filter(Boolean));
    const handledKinds = new Set(
        [...spellsSrc.matchAll(/fx\.kind === "(\w+)"/g)].map((m) => m[1])
    );
    for (const k of declaredKinds) {
        if (!handledKinds.has(k)) {
            err(
                `spells: effect.kind '${k}' 를 처리하는 분기가 logic/spells.js 에 없다 — ` +
                    `발동은 되고 아무 일도 일어나지 않는 주문이 된다`
            );
        }
    }
    for (const k of handledKinds) {
        if (!declaredKinds.has(k)) {
            err(`spells: logic/spells.js 가 처리하는 kind '${k}' 를 쓰는 주문이 없다 — 死분기다`);
        }
    }

    /**
     * ④ **자동 플레이가 12종 전부를 집을 수 있는가.**
     *   `pickAutoSpell` 이 어떤 kind 를 아예 모르면 그 주문은 하네스에서 한 번도
     *   나가지 않고, 하네스는 다시 '주문 없는 게임'을 잰다 — 이 저장소가 이미
     *   겪은 실패다 (spells.js:pickAutoSpell 상단 주석).
     */
    {
        const from = spellsSrc.indexOf("export function pickAutoSpell");
        const policy = from < 0 ? "" : spellsSrc.slice(from);
        if (!policy) err(`spells: logic/spells.js 에 pickAutoSpell 이 없다 — 검사가 무의미해졌다`);
        for (const k of declaredKinds) {
            if (!policy.includes(`"${k}"`)) {
                err(
                    `spells: 자동 플레이가 kind '${k}' 를 한 번도 고르지 않는다 — ` +
                        `그 주문을 장착한 판은 하네스에서 '주문 없는 게임'으로 측정된다`
                );
            }
        }
    }

    /* ⑤ autoPlay 임계값 — 선언한 손잡이는 전부 정책이 읽어야 한다 */
    for (const key of Object.keys(spellData.autoPlay ?? {})) {
        if (key.startsWith("$")) continue;
        if (!spellsSrc.includes(`AUTO.${key}`)) {
            err(`spells: autoPlay.${key} 를 읽는 코드가 없다 — 死필드다. 쓰거나 지워라`);
        }
    }

    /* ⑥ 장착 4칸 */
    const size = spellData.loadoutSize;
    if (!(size > 0)) err(`spells: loadoutSize 가 양수가 아니다`);
    if (!spellsSrc.includes("DATA.loadoutSize")) {
        err(
            `spells: loadoutSize 를 읽는 코드가 logic/spells.js 에 없다 — ` +
                `4칸을 강제하는 곳이 화면뿐이면 다음 호출부가 그대로 통과한다`
        );
    }
    const def4 = spellData.defaultLoadout ?? [];
    if (def4.length !== size) {
        err(`spells: defaultLoadout 이 ${def4.length}종인데 loadoutSize 는 ${size} 다`);
    }
    if (new Set(def4).size !== def4.length) err(`spells: defaultLoadout 에 중복이 있다`);
    for (const id of def4) {
        const sp = byId.get(id);
        if (!sp) {
            err(`spells: defaultLoadout 의 '${id}' 가 존재하지 않는다`);
            continue;
        }
        /**
         * ★★ 기본 장착은 **전부 기본 해금**이어야 한다. 아니면 신규 계정이
         *   자기 기본 장착을 쓸 수 없는 상태로 시작하고, 균열력은 다시
         *   '쌓이기만 하는 자원'이 된다.
         */
        if (sp.unlockStage) {
            err(
                `spells/${id}: 기본 장착인데 해금 스테이지('${sp.unlockStage}')가 있다 — ` +
                    `신규 계정이 빈 손으로 전투에 들어간다`
            );
        }
    }

    /**
     * ⑦ **가장 싼 loadoutSize 종의 합 > riftMax.**
     *   넘지 않으면 가득 찬 균열력 하나로 장착 전부를 쏠 수 있고, 그러면 4칸이
     *   '무엇을 고를까'가 아니라 '어느 순서로 누를까'가 된다.
     */
    const riftMax = balance.resources.riftMax;
    const cheapest = list
        .map((sp) => sp.cost)
        .sort((a, b) => a - b)
        .slice(0, size)
        .reduce((a, b) => a + b, 0);
    if (cheapest <= riftMax) {
        err(
            `spells: 가장 싼 ${size}종의 코스트 합이 ${cheapest} 로 riftMax(${riftMax}) 이하다 — ` +
                `가득 찬 균열력 하나로 장착 전부가 나간다. 장착 4칸이 선택이 아니라 순서가 된다`
        );
    }

    /**
     * ⑧ **상성 세 축이 전부 대표되는가.** 물리·술식·신성은 이 게임의 설계 결정 2 이고,
     *   공격 주문이 두 축만 덮으면 나머지 한 축은 '주문으로는 답할 수 없는 상황'이 된다.
     */
    const spellDmgTypes = new Set(
        list.filter((sp) => sp.effect?.kind === "damage").map((sp) => sp.effect.dmgType)
    );
    for (const t of VALID_DMG) {
        if (!spellDmgTypes.has(t)) {
            err(
                `spells: 데미지 타입 '${t}' 의 공격 주문이 없다 — ` +
                    `상성 세 축(물리·술식·신성)은 주문에서도 전부 대표되어야 한다 ` +
                    `(CLAUDE.md 설계 결정 2)`
            );
        }
    }
    for (const t of spellDmgTypes) {
        if (!VALID_DMG.includes(t)) err(`spells: 알 수 없는 데미지 타입 '${t}'`);
    }

    /* ⑨ 해금이 캠페인 안에서 실제로 도달 가능한 순서인가 (요약에 함께 보인다) */
    const unlocked = list.filter((sp) => sp.unlockStage);
    spellSummary =
        `지휘관 주문 ${list.length}종 / 장착 ${size}칸 · 기본 해금 ${list.length - unlocked.length}종 · ` +
        `스테이지 해금 ${unlocked.length}종 (${unlocked.map((sp) => sp.unlockStage).join(" ")}) · ` +
        `효과 ${declaredKinds.size}종 · 최저 ${size}종 합 ${cheapest} > 균열력 ${riftMax}`;
}

/* ── 선언 ↔ 소비 대조 (2026-08-05) ──────────────────────────────
 *
 * ★★★ **이 저장소의 단일 실패 유형: "선언했는데 아무도 읽지 않는 것."**
 *
 *   한 번의 전수 조사에서 나온 것만 이렇다:
 *     · `enemies.json:archetype` — 62/62 에 적혀 있고 읽는 코드 0건
 *     · `worlds.json:beats[].bossGiant` — 2건. 생성기가 읽지 않았고, 값도
 *       실제(`enemies.json:giant`)와 달랐다 (hpMult 11 vs 36)
 *     · `fx.json` 이펙트 4종 — 어떤 프로파일에도 붙어 있지 않음
 *     · `EVT.REQUEST_COMMANDER_MOVE` — emit 0 · on 0
 *   전부 **문법은 완전하고 아무도 실패하지 않는** 종류다. 테스트는 통과하고,
 *   기획자는 그 값을 고치며 튜닝하고, 화면은 아무 반응도 하지 않는다.
 *
 *   위 '지휘관 효과 키 대조'(§지휘관 성장 ③)가 그 한 사례를 막았다.
 *   이 절은 그것을 **일반 규칙으로 넓힌 것**이고, 세 갈래다:
 *     ① 데이터 필드 — 등록표에 적은 소비처가 그 필드를 실제로 읽는가
 *     ② 논리 이름   — fx 이펙트 · 아이콘 키가 어디선가 쓰이는가
 *     ③ 이벤트      — EVT 상수마다 emit 하는 곳과 on 하는 곳이 **둘 다** 있는가
 *
 * ★ **전수 자동 추론을 하지 않는다.** 필드 이름만으로 소비처를 찾으면
 *   `id` · `name` · `cost` 가 저장소 어디에나 걸려 검사가 항상 통과한다 —
 *   통과만 하는 검사는 없는 것보다 나쁘다(있다고 믿게 만든다).
 *   그래서 **소비처 파일과 그 안에서 찾을 문자열을 손으로 적는다.**
 *   대신 등록표에 없는 필드가 데이터에 생기면 그것도 오류다. 목록은 사람이
 *   관리하되, **목록이 낡는 것은 기계가 잡는다.**
 *
 * ★ 문자열 포함 검사인 이유는 위(`collectSourceText`)와 같다 — 검사기가
 *   두 번째 번들러가 되면 안 된다. 접근 표현(`raw.giant` · `beat.surge`)을
 *   적으므로 이름만 겹치는 우연한 통과는 사실상 없다.
 */
{
    const icons = await load("icons.json");

    /** 소비처 파일 텍스트 캐시 — 같은 파일을 수십 번 읽지 않는다 */
    const fileCache = new Map();
    const srcOf = async (f) => {
        if (!fileCache.has(f)) fileCache.set(f, await readFile(f, "utf8").catch(() => null));
        return fileCache.get(f);
    };

    /**
     * 필드 등록표 — `{ 필드: { 소비처파일: 그 안에서 찾을 접근 표현 } }`.
     *
     * ★ 소비처가 여럿이면 **하나만 맞아도 통과**다. 한 소비처가 사라지는 것은
     *   정상적인 리팩터링이고, 여기서 잡으려는 것은 **전부 사라진** 상태다.
     */
    const FIELD_CONSUMERS = [
        {
            at: "enemies.json:enemies[]",
            records: enemies.enemies,
            fields: {
                id: { "src/game/logic/stageConfig.js": "raw.id" },
                name: { "src/game/logic/stageConfig.js": "raw.name" },
                faction: { "tools/lib/stages-core.mjs": "e.faction" },
                tags: { "src/game/logic/stageConfig.js": "raw.tags" },
                dmgType: { "src/game/logic/stageConfig.js": "raw.dmgType" },
                // ★ 11종에만 있다. 이것이 없어서 62/62 가 MELEE 로 정규화되고
                //   사거리 190 짜리가 즉발로 때렸다 (2026-08-05).
                role: { "src/game/logic/stageConfig.js": "raw.role" },
                base: { "src/game/logic/stageConfig.js": "raw.base" },
                breachDamage: { "src/game/logic/stageConfig.js": "raw.breachDamage" },
                cost: { "tools/lib/stages-core.mjs": ".cost" },
                art: { "src/game/logic/stageConfig.js": "raw.art" },
                giant: {
                    "src/game/logic/stageConfig.js": "raw.giant",
                    "src/game/presenters/UnitPresenter.js": "def.giant?.scale",
                },
                boss: { "src/game/logic/stageConfig.js": "raw.boss" },
            },
        },
        {
            at: "enemies.json:enemies[].base",
            records: enemies.enemies.map((e) => e.base),
            fields: {
                hp: { "src/game/logic/stageConfig.js": "b.hp" },
                atk: { "src/game/logic/stageConfig.js": "b.atk" },
                def: { "src/game/logic/stageConfig.js": "b.def" },
                res: { "src/game/logic/stageConfig.js": "b.res" },
                range: { "src/game/logic/stageConfig.js": "b.range" },
                speed: { "src/game/logic/stageConfig.js": "b.speed" },
                atkInterval: { "src/game/logic/stageConfig.js": "b.atkInterval" },
                shield: { "src/game/logic/stageConfig.js": "b.shield" },
            },
        },
        {
            at: "enemies.json:enemies[].giant",
            records: enemies.enemies.map((e) => e.giant),
            fields: {
                scale: { "src/game/presenters/UnitPresenter.js": "def.giant?.scale" },
                hpMult: { "src/game/logic/stageConfig.js": "g.hpMult" },
                atkMult: { "src/game/logic/stageConfig.js": "g.atkMult" },
                speedMult: { "src/game/logic/stageConfig.js": "g.speedMult" },
            },
        },
        /**
         * ★ `enemies[].art.*` 는 **여기서 검사하지 않는다.**
         *   `src/game/wiring.test.js:W1` 이 같은 명제를 이미 지키고 있고
         *   (프레젠터가 `art.*` 키 전부를 읽는가), 같은 사실을 두 곳에서 검사하면
         *   두 소비처 목록이 갈라진다 — 이 저장소가 데이터에서 겪은 그 실패를
         *   검사기에서 반복하는 셈이다. 여기서는 `art` 필드 **자체**만 본다.
         */
        {
            at: "worlds.json",
            records: [worlds],
            fields: {
                densityCurve: { "tools/lib/stages-core.mjs": "worldsData.densityCurve" },
                modeRotation: { "tools/lib/stages-core.mjs": "worldsData.modeRotation" },
                postProcess: { "tools/lib/stages-core.mjs": "worldsData.postProcess" },
                worlds: { "tools/lib/stages-core.mjs": "worldsData.worlds" },
            },
        },
        {
            at: "worlds.json:densityCurve",
            records: [worlds.densityCurve],
            fields: {
                rampBase: { "tools/lib/stages-core.mjs": "C.rampBase" },
                rampGrowth: { "tools/lib/stages-core.mjs": "C.rampGrowth" },
                rampEndStage: { "tools/lib/stages-core.mjs": "C.rampEndStage" },
                plateauDrift: { "tools/lib/stages-core.mjs": "C.plateauDrift" },
                gateIndex: { "tools/lib/stages-core.mjs": "C.gateIndex" },
                gateMult: { "tools/lib/stages-core.mjs": "C.gateMult" },
                bossIndex: { "tools/lib/stages-core.mjs": "C.bossIndex" },
                bossMult: { "tools/lib/stages-core.mjs": "C.bossMult" },
                maxDensity: { "tools/lib/stages-core.mjs": "C.maxDensity" },
                maxBodies: { "tools/lib/stages-core.mjs": "C.maxBodies" },
            },
        },
        {
            at: "worlds.json:postProcess",
            records: [worlds.postProcess],
            fields: { flyingCap: { "tools/lib/stages-core.mjs": "P.flyingCap" } },
        },
        {
            at: "worlds.json:worlds[]",
            records: worlds.worlds,
            fields: {
                world: { "tools/lib/stages-core.mjs": "world.world" },
                // ★ `{ko,en}` 이라 화면은 `pick()` 을 거친다 (i18n 정본)
                name: { "src/screens/StagesScreen.jsx": '"name"' },
                faction: { "tools/lib/stages-core.mjs": "world.faction" },
                arkHp: { "tools/lib/stages-core.mjs": "world.arkHp" },
                designedDefeatIndex: {
                    "tools/lib/stages-core.mjs": "world.designedDefeatIndex",
                },
                beats: { "tools/lib/stages-core.mjs": "world.beats" },
            },
        },
        {
            /**
             * ★ 비트는 **기획자가 손으로 쓰는 유일한 스테이지 손잡이**다.
             *   여기 적은 값이 생성기에 닿지 않으면 그 스테이지는 영원히
             *   기획서와 다르게 돈다 — `bossGiant` 가 정확히 그 상태였다.
             */
            at: "worlds.json:worlds[].beats[]",
            records: worlds.worlds.flatMap((w) => w.beats),
            fields: {
                index: { "tools/lib/stages-core.mjs": "beat.index" },
                teaches: { "tools/lib/stages-core.mjs": "beat.teaches" },
                pool: { "tools/lib/stages-core.mjs": "beat.pool" },
                emphasis: { "tools/lib/stages-core.mjs": "beat.emphasis" },
                arkHp: { "tools/lib/stages-core.mjs": "beat.arkHp" },
                boss: { "tools/lib/stages-core.mjs": "beat.boss" },
                bossMult: { "tools/lib/stages-core.mjs": "beat.bossMult" },
                difficultyMult: { "tools/lib/stages-core.mjs": "beat.difficultyMult" },
                surge: { "tools/lib/stages-core.mjs": "beat.surge" },
                arkRegenPerWave: { "tools/lib/stages-core.mjs": "beat.arkRegenPerWave" },
            },
        },
        /**
         * ★★ 나이트메어 규칙 3종 (P11 · 22-nightmare.md §9.1).
         *   규칙을 **이 그물 안에서 태어나게** 한다 — 새 손잡이를 데이터에 적고
         *   읽는 코드를 빠뜨리면, 기획자는 난이도를 조정했다고 믿고 전투는 그대로다.
         */
        {
            at: "balance.json:difficulty.levels.nightmare.mechanics.plague_bloom",
            records: [balance.difficulty?.levels?.nightmare?.mechanics?.plague_bloom],
            fields: {
                // ★ 이름·요약은 `{ko,en}` 이다 — 프리뷰가 pick() 으로 고른다
                name: { "src/game/logic/nightmare.js": "m.name" },
                summary: { "src/game/logic/nightmare.js": "m.summary" },
                worlds: { "src/game/logic/nightmare.js": "m.worlds.includes" },
                radius: { "src/game/logic/nightmare.js": "m.radius" },
                durationMs: { "src/game/logic/nightmare.js": "m.durationMs" },
                tickMs: { "src/game/logic/nightmare.js": "m.tickMs" },
                dpsPctOfMaxHp: { "src/game/logic/nightmare.js": "m.dpsPctOfMaxHp" },
                maxPerLane: { "src/game/logic/nightmare.js": "MECH.plague_bloom?.maxPerLane" },
                mergeGap: { "src/game/logic/nightmare.js": "m.mergeGap" },
            },
        },
        {
            at: "balance.json:difficulty.levels.nightmare.mechanics.bond_break",
            records: [balance.difficulty?.levels?.nightmare?.mechanics?.bond_break],
            fields: {
                // ★ 이름·요약은 `{ko,en}` 이다 — 프리뷰가 pick() 으로 고른다
                name: { "src/game/logic/nightmare.js": "m.name" },
                summary: { "src/game/logic/nightmare.js": "m.summary" },
                worlds: { "src/game/logic/nightmare.js": "m.worlds.includes" },
                holdMs: { "src/game/logic/movement.js": "bond.holdMs" },
                telegraphMs: { "src/game/logic/movement.js": "bond.telegraphMs" },
                postBreakSpeedMult: { "src/game/logic/movement.js": "bond.postBreakSpeedMult" },
            },
        },
        {
            at: "balance.json:difficulty.levels.nightmare.mechanics.attrition",
            records: [balance.difficulty?.levels?.nightmare?.mechanics?.attrition],
            fields: {
                // ★ 이름·요약은 `{ko,en}` 이다 — 프리뷰가 pick() 으로 고른다
                name: { "src/game/logic/nightmare.js": "m.name" },
                summary: { "src/game/logic/nightmare.js": "m.summary" },
                worlds: { "src/game/logic/nightmare.js": "m.worlds.includes" },
                killRefundMult: { "src/game/logic/stageConfig.js": "attrition.killRefundMult" },
                summonDecayMult: { "src/game/logic/stageConfig.js": "attrition.summonDecayMult" },
            },
        },
        {
            at: "fx.json",
            records: [fx],
            fields: {
                atlas: { "src/game/fx/EffectSystem.js": "fxData.atlas" },
                effects: { "src/game/fx/EffectSystem.js": "fxData.effects" },
                worldTint: { "src/game/fx/EffectSystem.js": "fxData.worldTint" },
                damageTypeTint: { "src/game/fx/EffectSystem.js": "fxData.damageTypeTint" },
                projectileSheet: { "src/game/scenes/BattleScene.js": "fxData.projectileSheet" },
                shapeFacing: { "src/game/scenes/BattleScene.js": "fxData.shapeFacing" },
                projectile: { "src/game/scenes/BattleScene.js": "fxData.projectile;" },
            },
        },
        {
            at: "presenters.json",
            records: [presenters],
            fields: {
                profiles: { "src/game/presenters/UnitPresenter.js": "presetData.profiles" },
                giantMultiplier: {
                    "src/game/presenters/UnitPresenter.js": "presetData.giantMultiplier",
                },
                outline: { "src/game/presenters/UnitPresenter.js": "presetData.outline" },
                // 발밑 피아 표식 — 아군은 채운 타원, 적은 빈 링 (2026-08-05)
                sideMark: { "src/game/presenters/EnemyBadges.js": "presetData.sideMark" },
                hitEffect: { "src/game/presenters/UnitPresenter.js": "presetData.hitEffect" },
                commander: {
                    "src/game/presenters/CommanderPresenter.js": "presetData.commander",
                },
            },
        },
        {
            /**
             * ★ 연출 손잡이도 같은 병에 걸린다 — `attack` 블록에 값을 적고
             *   프레젠터가 그것을 읽지 않으면, 아티스트는 연출을 바꿨다고 믿고
             *   화면은 그대로다. 위 '연출 프로파일' 절은 **이펙트 이름의 실재**만
             *   보고 손잡이 자체는 보지 않았다.
             */
            at: "presenters.json:profiles[].attack",
            records: Object.values(presenters.profiles).map((p) => p.attack),
            fields: {
                lungePx: { "src/game/presenters/UnitPresenter.js": "p.lungePx" },
                lungeMs: { "src/game/presenters/UnitPresenter.js": "p.lungeMs" },
                recoilPx: { "src/game/presenters/UnitPresenter.js": "p.recoilPx" },
                recoilMs: { "src/game/presenters/UnitPresenter.js": "p.recoilMs" },
                risePx: { "src/game/presenters/UnitPresenter.js": "p.risePx" },
                riseMs: { "src/game/presenters/UnitPresenter.js": "p.riseMs" },
                squash: { "src/game/presenters/UnitPresenter.js": "p.squash" },
                glow: { "src/game/presenters/UnitPresenter.js": "p.glow" },
                hitStopMs: { "src/game/presenters/UnitPresenter.js": "p.hitStopMs" },
                cameraShake: { "src/game/presenters/UnitPresenter.js": "p.cameraShake" },
                effect: { "src/game/presenters/UnitPresenter.js": "p.effect" },
                effectAt: { "src/game/presenters/UnitPresenter.js": "p.effectAt" },
                hitByDamageType: {
                    "src/game/presenters/UnitPresenter.js": "p.hitByDamageType",
                },
            },
        },
    ];

    for (const t of FIELD_CONSUMERS) {
        const present = new Set();
        for (const rec of t.records) {
            if (!rec || typeof rec !== "object") continue;
            for (const k of Object.keys(rec)) if (!isNote(k)) present.add(k);
        }

        // ① 등록표에 없는 새 필드 — **결정을 강제한다**
        for (const k of present) {
            if (t.fields[k]) continue;
            err(
                `${t.at}: 필드 '${k}' 가 소비처 등록표에 없다 — 읽는 코드를 ` +
                    `tools/validate-data.mjs 의 FIELD_CONSUMERS 에 등록하거나, ` +
                    `읽는 코드가 없다면 데이터에서 지워라 (archetype 이 62/62 에 그 상태로 있었다)`
            );
        }

        for (const [k, readers] of Object.entries(t.fields)) {
            // ② 낡은 등록 — 데이터에서 사라진 필드가 표에만 남아 있다
            if (!present.has(k)) {
                err(`${t.at}: 등록표의 '${k}' 가 데이터에 하나도 없다 — 등록을 지워라`);
                continue;
            }

            // ③ 아무도 읽지 않는다
            let read = false;
            for (const [file, needle] of Object.entries(readers)) {
                const src = await srcOf(file);
                if (src === null) {
                    err(`${t.at}/${k}: 등록한 소비처 '${file}' 이 없다 — 파일이 옮겨졌다`);
                    continue;
                }
                if (src.includes(needle)) read = true;
            }
            if (!read) {
                const where = Object.entries(readers)
                    .map(([f, n]) => `${f} 의 '${n}'`)
                    .join(" · ");
                err(
                    `${t.at}: '${k}' 를 읽는 코드가 없다 (${where}) — ` +
                        `데이터에만 있는 필드는 기획자가 고쳐도 게임이 아무 반응을 하지 않는다. ` +
                        `쓰거나 지워라`
                );
            }
        }
    }

    /* ── ② 논리 이름 ─────────────────────────────────────────
     *
     * ★ 테스트 파일은 소비처로 치지 않는다. 테스트만 쓰는 이름은 "게임 안에서
     *   쓰이는 것"이 아니라 그 이름이 살아 있다는 **착시**를 만든다.
     */
    const prodFiles = (await listFiles("src")).filter((f) => !/\.test\./.test(f));
    let prodSrc = "";
    for (const f of prodFiles) prodSrc += await readFile(f, "utf8");

    /** `$` 주석을 제외한 모든 문자열 값 (데이터가 논리 이름을 참조하는 유일한 방법) */
    function dataStrings(node, out = new Set()) {
        if (typeof node === "string") out.add(node);
        else if (Array.isArray(node)) for (const v of node) dataStrings(v, out);
        else if (node && typeof node === "object") {
            for (const [k, v] of Object.entries(node)) if (!isNote(k)) dataStrings(v, out);
        }
        return out;
    }

    // 이펙트 — presenters.json 의 프로파일에 붙었거나, 씬이 이름을 직접 재생하거나.
    const presenterNames = dataStrings(presenters);
    for (const name of Object.keys(fx.effects)) {
        if (presenterNames.has(name) || prodSrc.includes(`play("${name}"`)) continue;
        err(
            `fx/${name}: 어디에도 붙어 있지 않다 — presenters.json 의 프로파일 ` +
                `(attack.effect · death.effect · spawn.ringEffect · hitEffect · commander) 에 ` +
                `넣거나 fx.json 에서 지워라`
        );
    }

    /**
     * 아이콘 키 — 화면이 직접 쓰거나(`<GameIcon name="currency.gold">`),
     * 데이터가 `icon` 필드로 가리킨다(`commander.json` · `spells.json`).
     *
     * ★ 화면이 키를 조립하는 경우가 있다 (`tag.${t.tag}` · `dmg.${dmgType}`).
     *   그 접두사만 예외로 적는다 — **접두사도 손으로 적어야** 조립하지 않는
     *   죽은 키가 그 뒤에 숨지 못한다.
     */
    const ICON_PREFIX_BUILT = {
        "tag.": "src/screens/StagePreview.jsx",
        "dmg.": "src/game/logic/labels.js",
    };
    const dataIconRefs = new Set();
    for (const f of await readdir(DATA)) {
        if (!f.endsWith(".json") || f === "icons.json") continue;
        dataStrings(await load(f), dataIconRefs);
    }
    for (const key of Object.keys(icons.icons)) {
        if (isNote(key)) continue;
        if (dataIconRefs.has(key) || prodSrc.includes(`"${key}"`)) continue;
        const prefix = Object.keys(ICON_PREFIX_BUILT).find((p) => key.startsWith(p));
        if (prefix && prodSrc.includes(`\`${prefix}$`)) continue;
        err(
            `icons/${key}: 아무도 쓰지 않는다 — 화면에 배치하거나 icons.json 에서 지워라 ` +
                `(아이콘은 좌표까지 손으로 잰 값이라, 안 쓰는 것을 남겨 두면 다음 사람이 ` +
                `그 좌표를 신뢰하고 붙였다가 엉뚱한 칸을 얻는다)`
        );
    }

    /* ── ③ 이벤트 ────────────────────────────────────────────
     *
     * ★ `EventBus.js` 를 import 하지 않고 텍스트로 읽는다 — 그 파일은 Phaser 를
     *   가져오고, Phaser 는 DOM 없는 node 에서 부팅하지 않는다.
     *
     * ★★ **emit 과 on 이 둘 다 있어야 한다.** 한쪽만 있는 이벤트는 조용히
     *   사라지는 신호이고, 그건 없는 것보다 나쁘다 — 다음 사람이 그 이름을 보고
     *   "이미 배선돼 있다"고 믿는다. `REQUEST_COMMANDER_MOVE` 가 그렇게 남아 있었다
     *   (emit 0 · on 0. 지휘관 이동은 캔버스가 포인터로 직접 받는다).
     *
     * ★ `src/game/wiring.test.js:W5` 는 **반대편**을 본다 — "구독하는데 쏘는 곳이
     *   없다". 그 검사는 구독을 순회하므로 **양쪽이 다 없는 이름은 볼 수 없다.**
     *   여기서 보는 것은 선언이다. 두 검사가 만나는 지점은 있지만 방향이 다르다.
     */
    const busSrc = await readFile("src/game/EventBus.js", "utf8");
    const evtKeys = [...busSrc.matchAll(/^ {4}([A-Z][A-Z0-9_]*):\s*"/gm)].map((m) => m[1]);
    if (evtKeys.length === 0) err("EventBus: EVT 상수를 하나도 읽지 못했다 — 검사가 무의미해졌다");
    for (const k of evtKeys) {
        const emits = prodSrc.includes(`emit(EVT.${k}`);
        const listens = prodSrc.includes(`on(EVT.${k}`);
        if (emits && listens) continue;
        err(
            `EventBus/${k}: ${!emits && !listens ? "emit 도 on 도 없다" : !emits ? "emit 하는 곳이 없다" : "on 하는 곳이 없다"} — ` +
                `배선하거나 EVT 에서 지워라 (지울 때는 이유를 주석으로 남긴다)`
        );
    }

    declaredSummary =
        `선언↔소비 대조: 데이터 필드 ${FIELD_CONSUMERS.reduce((n, t) => n + Object.keys(t.fields).length, 0)} · ` +
        `이펙트 ${Object.keys(fx.effects).length} · 아이콘 ${Object.keys(icons.icons).filter((k) => !isNote(k)).length} · ` +
        `이벤트 ${evtKeys.length}`;
}

/* ── 출력 ─────────────────────────────────────────────────── */
console.log("── 데이터 정합성 검사 ─────────────────────────");
console.log(
    `유닛 ${units.units.length} · 적 ${enemies.enemies.length} · ` +
        `스테이지 ${stages.stages.length} · 각인 ${sigils.sigils.length} · ` +
        `진화 ${sigils.evolutions.length} · 이펙트 ${Object.keys(fx.effects).length} · ` +
        `효과음 ${sfxCount}`
);
console.log(unlockSummary);
console.log(recruitSummary);
console.log(guideSummary);
console.log(commanderSummary);
console.log(spellSummary);
if (nightmareSummary) console.log(nightmareSummary);
if (projectileSummary) console.log(projectileSummary);
console.log(declaredSummary);

for (const w of warnings) console.warn(`⚠ ${w}`);
for (const e of errors) console.error(`✗ ${e}`);

console.log("───────────────────────────────────────────────");
if (errors.length) {
    console.error(`✗ 오류 ${errors.length}건 · 경고 ${warnings.length}건`);
    process.exit(1);
}
console.log(`✅ 통과 (경고 ${warnings.length}건)`);
