/**
 * 지휘관 주문 (11-core-loop.md §4.4)
 *
 * ★★ **균열력의 소비처다.** `riftEnergy` 는 P2 부터 시뮬에 있었지만 아무도 쓰지 않아
 *   재생·처치 보너스로 쌓이기만 했다. HUD 의 주문 버튼 4개는 `disabled` 인 채였고
 *   결국 죽은 UI 로 제거됐다. 이 모듈이 그 자원을 실제 결정으로 만든다.
 *
 * ★★★ **주문은 12종이고 전투에는 4종만 들고 나간다** (2026-08-05, 사용자 결정).
 *   그 4칸을 강제하는 곳이 **여기**다 — `createSpellState(equipped)` 가 4종만 담고,
 *   `canCast` 가 그 밖의 주문에 `unequipped` 를 돌려주며, `pickAutoSpell` 도 그
 *   4종 안에서만 돈다. **화면에만 자물쇠를 그리면 다음 호출부가 그대로 통과한다**
 *   (CLAUDE.md 진행 게이트 규약 — 화면과 스토어가 같은 함수를 부른다).
 *
 * ★ 순수 함수다 — `Math.random()` · `Date.now()` · DOM 이 없다 (절대 규칙 1).
 *   난수가 아예 없으므로 주문은 **완전 결정론**이고, B1(동일 시드 동일 결과)을
 *   구조적으로 깨지 않는다. 12종을 늘리면서도 확률형은 하나도 넣지 않았다
 *   (절대 규칙 6) — 어느 주문이 언제 열리는지가 데이터에 스테이지로 적혀 있다.
 *
 * ★ 수치는 하나도 여기 없다 — 전부 `data/spells.json` (절대 규칙 4).
 *
 * ★★ **발동은 반드시 `step()` 안에서 일어난다.** 틱 밖에서 부르면 다음 `step()` 의
 *   `resetQueue` 가 그 이벤트를 지운다 — 소환에서 정확히 그 사고가 있었다
 *   (P3 노트: "소환한 아군의 스프라이트가 안 생김"). 그래서 화면은 의도를 큐에 넣고,
 *   `applyInputs` 가 틱 안에서 `castSpell` 을 부른다.
 *
 * @see docs/02-design/11-core-loop.md §2.2 · §4.4
 * @see docs/04-plan/33-execution-plan.md 지휘관 주문
 */
import DATA from "../data/spells.json" with { type: "json" };
import { computeDamage } from "./combat.js";
import { emit, EV } from "./events.js";
import { commanderUp } from "./commanderHit.js";
// ★ `difficulty.js` 는 JSON 만 import 한다 — `stageConfig.js` 를 거치면 순환이 된다
//   (stageConfig → … → state.js → spells.js). 해금 판정에만 쓴다.
import { globalStageIndex } from "./difficulty.js";

/**
 * 지휘관이 기절 중인가.
 *
 * ★ 술어는 `commanderHit.js:commanderUp` 하나다 (2026-08-05). 여기 별도 판정을
 *   만들면 오라·평타·주문이 서로 다른 기절 판정을 갖게 된다 — 실제로 이 파일은
 *   시간 항만 보고 있어서, 지휘관이 죽은 그 틱에는 **주문이 여전히 나갔다.**
 *
 * ★ `state.js` 에서 `TOTAL_LANES` 를 import 하지 않는다 — `state.js` 가 이 파일의
 *   `createSpellState` 를 부르므로 **순환 참조**가 된다. ESM 이 견디긴 하지만
 *   초기화 순서에 따라 `undefined` 를 읽는 종류의 버그를 부른다.
 *   레인 수는 `s.lanes.length` 로 상태에서 직접 읽는다.
 */
function isCommanderDown(s) {
    return !commanderUp(s);
}

export const SPELLS = DATA.spells;
export const SPELL_IDS = Object.freeze(SPELLS.map((s) => s.id));
export const AUTO = DATA.autoPlay;

/** 전투에 들고 나가는 칸 수 — HUD 도크와 편성 화면이 이 값을 그대로 쓴다 */
export const LOADOUT_SIZE = DATA.loadoutSize;
/** 아무것도 고르지 않은 계정의 기본 장착 (신규 계정이 빈 손으로 들어가지 않게) */
export const DEFAULT_LOADOUT = Object.freeze([...DATA.defaultLoadout]);

const BY_ID = Object.fromEntries(SPELLS.map((s) => [s.id, s]));

/** @returns {object|undefined} */
export function spellDef(id) {
    return BY_ID[id];
}

/* ══════════════════════════ 해금 · 장착 ══════════════════════════
 *
 * ★★ 해금은 **확정 지급**이다 (절대 규칙 6 — 확률형 0개).
 *   `commander.json:items[].stage` 와 **같은 규약**이고, 같은 이유로
 *   "어떤 스테이지가 무엇을 주는가"를 화면이 미리 보여 줄 수 있다.
 */

/** 이 주문을 여는 스테이지 id — `null` 이면 처음부터 열려 있다 */
export function spellUnlockStage(id) {
    return BY_ID[id]?.unlockStage ?? null;
}

/**
 * 이 스테이지를 **처음** 깰 때 열리는 주문 id 목록.
 * ★ `logic/commander.js:commanderItemsForStage` 와 같은 모양이다 — 지급 처리를
 *   하는 쪽(스토어)이 동료·장구·주문을 한 자리에서 같은 방식으로 다룰 수 있게.
 */
export function spellsForStage(stageId) {
    const out = [];
    for (const sp of SPELLS) if (sp.unlockStage === stageId) out.push(sp.id);
    return out;
}

/**
 * 최고 스테이지가 `highestStage`(전역 인덱스) 인 계정이 **보유한** 주문 전체.
 * ★ `unlocks.js:guaranteedUnitsUpTo` 와 같은 경계(`<=`)다 — 스테이지 N 의 보상은
 *   N 을 깬 뒤에 들어오므로, `highestStage` 는 이미 '깬 것'의 인덱스다.
 */
export function unlockedSpellIds(highestStage = 0) {
    const out = [];
    for (const sp of SPELLS) {
        if (!sp.unlockStage || globalStageIndex(sp.unlockStage) <= highestStage) out.push(sp.id);
    }
    return out;
}

/** 화면이 자물쇠를 그리는 근거 — 스토어와 **같은 함수**를 쓴다 */
export function isSpellUnlocked(id, highestStage = 0) {
    const sp = BY_ID[id];
    if (!sp) return false;
    return !sp.unlockStage || globalStageIndex(sp.unlockStage) <= highestStage;
}

/**
 * 편성 화면이 한 칸을 바꿀 수 있는가 — 이유까지 돌려준다 (`canCast` 와 같은 규약).
 * @returns {{ok: boolean, reason?: string}}
 */
export function canEquipSpell(equipped, id, highestStage = 0) {
    if (!BY_ID[id]) return { ok: false, reason: "unknown" };
    if (!isSpellUnlocked(id, highestStage)) {
        return { ok: false, reason: "locked", stage: spellUnlockStage(id) };
    }
    const list = Array.isArray(equipped) ? equipped : [];
    if (list.includes(id)) return { ok: false, reason: "already" };
    if (list.length >= LOADOUT_SIZE) return { ok: false, reason: "full" };
    return { ok: true };
}

/**
 * 장착 목록을 **정확히 `LOADOUT_SIZE` 칸**으로 정규화한다.
 *
 * ★ 알 수 없는 id · 중복 · 4칸 초과분은 버린다. 아직 해금되지 않은 주문도 버린다 —
 *   세이브를 옮겨 붙이거나 계정을 되감았을 때 잠긴 주문을 들고 전투에 들어가는
 *   것을 막는다.
 *
 * ★★ **비었을 때만** 기본 장착으로 채운다. 무조건 4칸을 채우면 "셋만 들고 간다"는
 *   플레이어의 결정을 조용히 덮어쓰게 된다 — 여기서 막으려는 것은 그것이 아니라
 *   **빈 손으로 전투에 들어가는 것**이다 (그러면 균열력이 다시 '쌓이기만 하는
 *   자원'이 된다). 신규 계정 · 손상된 세이브가 그 경우다.
 */
export function normalizeSpellLoadout(equipped, highestStage = Infinity) {
    const out = [];
    const seen = new Set();
    const push = (id) => {
        if (out.length >= LOADOUT_SIZE || seen.has(id) || !BY_ID[id]) return;
        if (!isSpellUnlocked(id, highestStage)) return;
        seen.add(id);
        out.push(id);
    };
    if (Array.isArray(equipped)) for (const id of equipped) push(id);
    // ★ 기본 4종은 `data:validate` 가 '기본 해금'을 강제하므로 이 보충이
    //   잠긴 주문을 끼워 넣는 일은 없다.
    if (out.length === 0) for (const id of DEFAULT_LOADOUT) push(id);
    return out;
}

/**
 * 전투 시작 시의 주문 상태.
 *
 * ★ 쿨다운은 **다음 사용 가능 시각**(ms)이다. 남은 시간을 매 틱 감산하면
 *   틱 수만큼 부동소수 오차가 쌓이고, 그 오차는 시드마다 다르게 누적된다.
 *
 * ★★ `order` 는 **장착 4종을 코스트 오름차순(동가면 id 순)으로 미리 정렬한** 것이다.
 *   자동 플레이가 매 틱 정렬하면 틱마다 배열을 만들게 되고(절대 규칙 7),
 *   정렬이 불안정하면 같은 시드가 다른 결과를 낸다(B1). 한 번만 정한다.
 *
 * @param {string[]} [equipped] 장착 주문 id — 없으면 기본 장착
 */
export function createSpellState(equipped) {
    const list = normalizeSpellLoadout(equipped);
    const readyAt = Object.create(null);
    // ★ 12종 전부에 자리를 만든다. 장착 판정은 `equipped` 가 하고, 여기서 키가
    //   없으면 `readyAt[id]` 가 `undefined` 인 경로가 생긴다.
    for (const id of SPELL_IDS) readyAt[id] = 0;
    const order = [...list].sort((a, b) => {
        const ca = BY_ID[a].cost;
        const cb = BY_ID[b].cost;
        if (ca !== cb) return ca - cb;
        return a < b ? -1 : 1;
    });
    return { readyAt, casts: 0, equipped: list, order };
}

/** 이 전투에 들고 온 주문인가 — 4칸 규칙의 **단일 판정점** */
export function isEquipped(s, id) {
    const eq = s.spells?.equipped;
    return eq ? eq.includes(id) : DEFAULT_LOADOUT.includes(id);
}

/** HUD 가 그릴 주문 정의 4개 (순서는 플레이어가 고른 순서 그대로) */
export function equippedSpells(s) {
    const eq = s.spells?.equipped ?? DEFAULT_LOADOUT;
    return eq.map((id) => BY_ID[id]).filter(Boolean);
}

/** 지금 쓸 수 있는가 — 이유까지 돌려준다 (버튼 비활성 사유 표기용) */
export function canCast(s, id) {
    const def = BY_ID[id];
    if (!def) return { ok: false, reason: "unknown" };
    // ★★ 장착 검사가 **먼저**다. 들고 오지 않은 주문은 코스트도 쿨다운도 의미가 없고,
    //   여기가 4칸 규칙이 실제로 집행되는 자리다.
    if (!isEquipped(s, id)) return { ok: false, reason: "unequipped" };
    if (s.phase !== "battle") return { ok: false, reason: "phase" };
    // ★ 지휘관이 기절 중이면 오라가 없다 — 주문도 같이 잠근다.
    //   오라 밖에서 회복·버프가 걸리면 "기절 페널티"가 사라진다.
    if (isCommanderDown(s)) return { ok: false, reason: "commander_down" };
    const cost = spellCost(s, def);
    if (s.riftEnergy < cost) return { ok: false, reason: "rift", cost };
    const readyAt = s.spells?.readyAt?.[id] ?? 0;
    if (s.t < readyAt) return { ok: false, reason: "cooldown", readyAt };
    return { ok: true, cost };
}

/** 실 코스트 — 각인·메타가 배율을 걸 수 있다 */
export function spellCost(s, def) {
    const scale = s.cfg?.spellCostScale ?? DATA.riftCostScale ?? 1;
    return Math.max(1, Math.round(def.cost * scale));
}

/** 남은 쿨다운 비율 0~1 (HUD 원형 게이지) */
export function cooldownPct(s, id) {
    const def = BY_ID[id];
    if (!def) return 0;
    const readyAt = s.spells?.readyAt?.[id] ?? 0;
    const left = readyAt - s.t;
    return left <= 0 ? 0 : Math.min(1, left / def.cooldownMs);
}

/* ══════════════════════════ 효과 ══════════════════════════ */

/**
 * ★ 대상 수집은 배열을 **새로 만들지 않는다** (절대 규칙 7 — update() 안 할당 금지).
 *   주문은 틱마다 불리지 않지만, 시뮬 코드가 할당 습관을 갖는 순간
 *   그 습관이 틱 루프로 번진다. 호출자가 준 버퍼를 채운다.
 */
const targetBuf = [];

function collectAuraAllies(s, out) {
    out.length = 0;
    for (const lane of s.lanes) {
        for (const a of lane.allies) if (a.hp > 0 && a.inAura) out.push(a);
    }
    return out;
}

function collectLaneEnemies(s, lane, out) {
    out.length = 0;
    const L = s.lanes[lane];
    if (L) for (const e of L.enemies) if (e.hp > 0) out.push(e);
    return out;
}

/** 레인형 주문의 대상 레인 — HUD 는 레인을 보내지 않는다 (`$target` 참조) */
function laneOf(s, target) {
    return target.lane ?? s.commander?.lane ?? 0;
}

/**
 * 버프 한 겹을 건다.
 *
 * ★★★ **버프는 사슬이다** (2026-08-05, 12종화). 예전에는 `a.buff` 가 객체 하나였고,
 *   주문 버프가 **하나뿐**이라 그것으로 충분했다. 12종에는 오라 버프가 셋(강철 명령 ·
 *   진격 나팔 · 사수 명령) 있고, 둘째를 걸면 첫째 객체를 **덮어써서 되돌릴 값이
 *   사라진다** — 그 자리에서 영구 스탯이 된다. 그래서 `next` 로 이어 붙인다.
 *   비어 있을 때는 여전히 `null` 이다 (풀 재사용 검사가 그 명제를 본다).
 *
 * ★ **만료 시각과 실제 적용 증분을 함께** 기록한다. 증분을 기억하지 않고 만료 때
 *   데이터 상수를 빼면, 비율 버프·클램프가 걸린 순간 스탯이 조용히 어긋난다.
 */
function applyBuff(a, fx, until, power) {
    const stat = fx.stat;
    const base = a[stat];
    // 비율(pct) 이면 대상의 현재 값에서, 절대(amount) 면 데이터 값에서 증분을 만든다
    let delta = fx.pct !== undefined ? base * fx.pct * power : fx.amount * power;
    delta = Math.round(delta);
    // ★ 스탯을 0 이하로 만들지 않는다. 공격 간격이 0 이 되면 그 유닛은 한 틱에
    //   무한 번 때린다 — 클램프한 만큼을 그대로 기록해야 되돌림이 정확하다.
    if (base + delta < 1) delta = 1 - base;
    if (delta === 0) return;
    a[stat] = base + delta;
    a.buff = { stat, amount: delta, until, next: a.buff ?? null };
}

/**
 * 주문 발동. **`step()` 안에서만 부른다.**
 *
 * @param {object} s 시뮬 상태
 * @param {string} id 주문 id
 * @param {{lane?: number}} [target] 레인형 주문의 대상 레인
 * @returns {boolean} 발동했는가
 */
export function castSpell(s, id, target = {}) {
    const check = canCast(s, id);
    if (!check.ok) return false;
    const def = BY_ID[id];

    s.riftEnergy -= check.cost;
    s.spells.readyAt[id] = s.t + def.cooldownMs;
    s.spells.casts++;

    const fx = def.effect;
    /**
     * ★ 주문 위력 배율 — 지휘관 유물이 미는 값이다 (2026-08-05).
     *   기본은 1 이므로 유물이 없으면 예전과 완전히 같다.
     * ★ **이산량에는 곱하지 않는다** (`spells.json:$power`) — 결계의 무효화 횟수와
     *   처형의 임계 비율. 반올림 한 번에 50% 가 뛰거나, 유물 하나로 '거의 전부
     *   즉사'가 만들어진다.
     */
    const power = s.cfg?.spellPowerMult ?? 1;

    /**
     * ★★ **대상 수집은 `target` 축이, 효과는 `kind` 축이 정한다.**
     *   둘을 한 분기에 섞으면 `target` 이 데이터에만 있고 아무도 읽지 않는 필드가
     *   된다 — 이 저장소가 반복해서 당한 사고이고, `data:validate` 가 그것을
     *   양방향으로 잡는다. 여기서 한 번만 모으면 kind 분기는 목록만 소비한다.
     * ★ `self` 는 아무것도 모으지 않는다 (방주·마나 등 전역 자원).
     */
    let list = null;
    if (def.target === "lane") list = collectLaneEnemies(s, laneOf(s, target), targetBuf);
    else if (def.target === "aura") list = collectAuraAllies(s, targetBuf);
    // ★ `self` 는 모을 대상이 없다. 그래도 **공유 버퍼를 비운다** — 남겨 두면
    //   self 주문에 kind 를 하나 더 붙이는 날 앞 주문의 목록을 그대로 때린다.
    else if (def.target === "self") targetBuf.length = 0;

    if (fx.kind === "damage") {
        // ★ 공격 주문은 **지휘관을 시전자로** 삼는다. 별도 스탯을 만들면
        //   상성(dmgType × 방어타입)이 주문에서만 다른 규칙을 타게 된다.
        const caster = { dmgType: fx.dmgType, atk: fx.amount * power, tags: 0, crit: 0 };
        for (const e of list) {
            /**
             * ★★★ **`s.cfg.combat` 이다. `s.cfg` 가 아니다** (2026-08-05 수정).
             *
             *   `computeDamage` 의 셋째 인자는 `balance.combat` 이고 `engage.js` 는
             *   그렇게 부른다. 여기만 `s.cfg` 를 넘기고 있었고, 그래서
             *   `cfg.holyMultCorrupt` · `cfg.minDamageRatio` 가 전부 `undefined` 였다.
             *   결과는 조용하지 않았다 — **정화의 빛의 피해가 `NaN`** 이었고
             *   (`base * undefined`), 맞은 적의 HP 가 `NaN` 이 됐다.
             *   `NaN > 0` 도 `NaN <= 0` 도 거짓이라 그 적은 **살아 있지도 죽지도 않은**
             *   상태로 전장에 남았다. 자동 플레이는 공격 계층에서 정화의 빛을
             *   **가장 먼저** 집으므로 하네스가 내내 그 상태를 재고 있었다.
             *   `spells.effect.test.js` 의 상성 검사가 이것을 잡았다.
             */
            const r = computeDamage(caster, e, s.cfg.combat);
            e.hp -= r.amount;
            /**
             * ★★★ **`EV.DAMAGE` 의 규약은 `(대상id, 피해, 레인, 종류, dmgType)` 이다**
             *   (2026-08-07 수정).
             *
             *   여기는 4개월 동안 `(…, e.x, e.y, id)` 를 보내고 있었다. 엔티티에는
             *   `y` 필드가 **아예 없으므로**(`state.js:makeEntity`) 넷째 인자는 언제나
             *   `undefined → 0`, 즉 **"일반 피해"** 였고, 셋째에는 레인 대신 x 좌표가
             *   들어갔다. 결과는 조용했다 — 예외도 로그도 없이 **주문의 "약점!/저항!"
             *   표기가 한 번도 뜨지 않았다.**
             *
             *   실측(3-1 · 정화의 빛 → 언데드): `computeDamage` 는 `effective: true` 를
             *   내는데 이벤트는 `d=0` 이었다. 정화의 빛의 존재 이유("적 구성을 읽게
             *   만든다")가 화면에서 완전히 침묵하고 있었다.
             *
             * ★ 크리티컬(4)은 여기서 나올 수 없다 — 주문은 굴림을 하지 않는다
             *   (`s.rng.combat` 을 당기면 그 뒤 모든 굴림이 밀려 B1 이 깨진다).
             */
            emit(
                s.events,
                EV.DAMAGE,
                e.id,
                r.amount,
                e.lane,
                r.effective ? 2 : r.resisted ? 3 : 0,
                fx.dmgType
            );
            // ★ 주문 피해도 집계에 넣는다. 넣지 않으면 `sigils:audit`·`balance-check` 가
            //   쓰는 `damageDealt` 에 주문이 한 점도 안 잡혀, 주문 수치를 튜닝해도
            //   그 도구들에는 아무 변화가 보이지 않는다.
            s.stats.damageDealt += r.amount;
        }
    } else if (fx.kind === "execute") {
        /**
         * ★ 처형은 **난수가 아니다.** 임계 이하면 반드시 죽고, 아니면 반드시 산다
         *   (절대 규칙 6). `aura.js:auraExecuteThreshold` 와 같은 규약이고,
         *   사망 처리·처치 집계·환급은 `lifecycle.js:stepDeaths` 가 그대로 한다 —
         *   여기서 kills 를 직접 올리면 집계가 두 곳으로 갈라진다.
         */
        for (const e of list) {
            if (e.hp > e.hpMax * fx.pct) continue;
            const removed = e.hp;
            e.hp = 0;
            // ★ 규약은 `(대상id, 피해, **레인**, 종류, dmgType)` 이다 (위 damage 절 주석 참조).
            //   처형은 상성이 아니라 규칙이므로 종류는 0(일반)이고, 타입은 없다.
            emit(s.events, EV.DAMAGE, e.id, removed, e.lane, 0, "");
        }
    } else if (fx.kind === "knockback") {
        /**
         * ★★ **붙들린 적은 밀지 않는다.** `aura.js:applyAuraOnHit` 과 같은 규약이다 —
         *   밀면 `stepBlocking` 의 `gap > b.range` 가 바로 넘어가 **용량 안의 적이
         *   풀려난다.** 2026-08-04 에 고친 "방벽을 간헐적으로 넘어간다"의 재발이다.
         * ★ x 를 직접 옮기지 않고 `pushX` 에 예약한다 — 레인 배열은 x 오름차순이고
         *   `movement.js` 만이 그 정렬을 안전하게 복구한다.
         */
        const push = fx.pushPx * power;
        for (const e of list) {
            if (e.blockedBy !== -1) continue;
            e.pushX += push;
        }
    } else if (fx.kind === "heal") {
        for (const a of list) {
            const before = a.hp;
            a.hp = Math.min(a.hpMax, a.hp + a.hpMax * fx.pctOfMax * power);
            // ★ `EV.HEAL` 의 규약도 `(대상id, 양, **레인**)` 이다 (`engage.js:trySupport`).
            //   여기만 x·y 를 보내고 있었다 — `EV.DAMAGE` 와 같은 사고다.
            if (a.hp > before) emit(s.events, EV.HEAL, a.id, a.hp - before, a.lane, 0, id);
        }
    } else if (fx.kind === "shield") {
        /**
         * ★ `shield` 는 **이미 전투가 읽는 필드**다 (`combat.js:computeDamage` 가
         *   한 대를 통째로 무효화하고 1 을 깎는다). 새 개념을 만들지 않은 이유이고,
         *   그래서 SHIELDED 태그를 가진 적과 완전히 같은 규칙으로 작동한다.
         */
        for (const a of list) a.shield += fx.hits;
    } else if (fx.kind === "buff") {
        const until = s.t + fx.durationMs;
        for (const a of list) {
            // ★ 역할을 적은 버프는 그 역할에만 붙는다 (사수 명령 = BLOCKER 전용)
            if (fx.role && a.role !== fx.role) continue;
            applyBuff(a, fx, until, power);
        }
    } else if (fx.kind === "mana") {
        s.mana = Math.min(s.manaMax, s.mana + fx.amount * power);
    } else if (fx.kind === "arkHeal") {
        s.arkHp = Math.min(s.arkHpMax, s.arkHp + s.arkHpMax * fx.pctOfMax * power);
    }

    /**
     * ★★★ **주문에 연출을 붙일 수 있게 하는 유일한 신호다** (2026-08-07).
     *
     *   이 이벤트는 4개월 동안 `(0,0,0,0,id)` 였고, 소비처는 저장소 전체에 **0개**였다.
     *   그래서 주문을 눌러 **성공하면 전장이 무음·무연출**이고, **실패하면** 화면이
     *   흔들리고 소리가 났다(`BattleScene.applyQueuedInputs`). 반응이 실패에만 있는
     *   UI 는 플레이어에게 "이 버튼은 작동하지 않는다"로 읽힌다 — 사용자가 "지휘관
     *   스킬이 제대로 작동되는지 의심스럽다"고 말한 이유가 이것이다.
     *
     * ★ 그래서 **연출이 필요로 하는 것을 전부 싣는다.** 렌더는 시뮬 상태를 읽지
     *   않는다(이벤트 큐가 유일한 접점) — 여기서 빠진 값은 화면에 존재하지 않는다.
     *
     *   a = 대상 레인 (self 주문이면 지휘관 레인)
     *   b = 지휘관 x  (self·aura 주문의 연출 원점)
     *   c = 실제로 영향을 받은 대상 수 (0 이면 허공에 쓴 것 — 연출을 줄인다)
     *   s = 주문 id  (연출 프로파일은 `presenters.json:commander.spells` 가 갖는다)
     */
    emit(
        s.events,
        EV.SPELL_CAST,
        def.target === "lane" ? laneOf(s, target) : (s.commander?.lane ?? 0),
        Math.round(s.commander?.x ?? 0),
        list ? list.length : 0,
        0,
        id
    );
    return true;
}

/**
 * 만료된 버프를 되돌린다. `step()` 이 매 틱 부른다.
 * ★ 되돌릴 때 **기록해 둔 증분**을 뺀다 (`applyBuff` 주석 참조).
 * ★ 사슬을 훑되 **배열을 만들지 않는다** — 만료된 마디만 끊어 낸다.
 */
export function stepSpellBuffs(s) {
    for (const lane of s.lanes) {
        for (const a of lane.allies) {
            let b = a.buff;
            if (!b) continue;
            let prev = null;
            while (b) {
                const next = b.next;
                if (s.t >= b.until) {
                    a[b.stat] -= b.amount;
                    if (prev) prev.next = next;
                    else a.buff = next;
                } else {
                    prev = b;
                }
                b = next;
            }
        }
    }
}

/* ══════════════════════════ 자동 플레이 ══════════════════════════ */

/**
 * 자동 플레이가 이번 틱에 쓸 주문 — 없으면 null.
 *
 * ★★ **하네스가 플레이어와 같은 게임을 재게 하는 것이 이 함수의 존재 이유다.**
 *   자동 플레이가 주문을 안 쓰면 밸런스 하네스는 '주문 없는 게임'을 재고,
 *   플레이어는 주문 있는 게임을 한다. 그 괴리가 게이트 수치를 무의미하게 만든다 —
 *   이 저장소가 추천 편성에서 이미 겪은 실패다(로스터 전체를 주고 B4 를 쟀다).
 *
 * ★★★ **주문 id 를 이 파일에 적지 않는다** (2026-08-05, 12종화). 예전에는
 *   `canCast(s, "healing_wave")` 처럼 네 개의 id 가 코드에 박혀 있었다. 12종이 되고
 *   그중 4종만 들고 나가는 순간 그 방식은 **들고 나간 주문을 조용히 무시한다** —
 *   자동 플레이가 정화의 빛을 안 들고 왔는데도 그것만 찾다가 아무것도 안 쓰게 된다.
 *   그러면 하네스는 다시 '주문 없는 게임'을 재고, 그것이 바로 이 함수가 막으려던
 *   실패다. 그래서 정책은 **효과 종류(kind) 계층**으로 쓰고, 후보는 언제나
 *   `s.spells.order`(장착 4종을 코스트 오름차순으로 미리 정렬한 것)에서 고른다.
 *
 * ★ 사람처럼 **아껴 쓴다.** 임계값은 `spells.json:autoPlay` 가 갖는다.
 *   쿨다운마다 무조건 쓰면 하네스가 게임을 실제보다 쉽게 잰다.
 *
 * ★★ 계층 순서는 **기본 4종에서 예전 동작과 완전히 같도록** 잡혀 있다:
 *   회복 → (신성 → 술식) 공격 → 버프. 그래서 12종을 넣어도 하네스가 재는 게임은
 *   바뀌지 않았다. 아래 ⑦ 의 사고 기록이 그 순서를 바꾸면 안 되는 이유다.
 */
export function pickAutoSpell(s) {
    if (isCommanderDown(s)) return null;

    const order = s.spells?.order ?? DEFAULT_LOADOUT;

    /** 장착 4종 중 이 조건에 맞는 첫 주문 (코스트 오름차순 · 동가면 id 순) */
    const firstCastable = (match) => {
        for (let i = 0; i < order.length; i++) {
            const def = BY_ID[order[i]];
            if (!def || !match(def)) continue;
            if (canCast(s, def.id).ok) return def;
        }
        return null;
    };
    const ofKind = (kind) => firstCastable((def) => def.effect.kind === kind);

    /* ── 오라 안 아군 요약 (회복·버프 판단의 근거) ── */
    const allies = collectAuraAllies(s, targetBuf);
    const auraCount = allies.length;
    let auraHp = 0;
    let auraHpMax = 0;
    for (let i = 0; i < auraCount; i++) {
        auraHp += allies[i].hp;
        auraHpMax += allies[i].hpMax;
    }

    /* ── 가장 붐비는 레인 (결정론: 동수면 낮은 레인) ── */
    let bestLane = -1;
    let bestN = 0;
    for (let i = 0; i < s.lanes.length; i++) {
        let n = 0;
        for (const e of s.lanes[i].enemies) if (e.hp > 0) n++;
        if (n > bestN) {
            bestN = n;
            bestLane = i;
        }
    }

    /**
     * ① 방주 수리 — **패배가 눈앞일 때만.** 가장 비싼 주문이고, 전장을 포기하는
     *   선택이므로 여유가 있을 때 누르면 그냥 손해다.
     */
    if (s.arkHpMax > 0 && s.arkHp / s.arkHpMax <= AUTO.arkBelowPct) {
        const sp = ofKind("arkHeal");
        if (sp) return { id: sp.id };
    }

    // ② 회복 — 오라 안 아군이 다쳤을 때가 가장 값어치가 크다
    if (auraCount > 0 && auraHpMax > 0 && auraHp / auraHpMax < AUTO.healBelowPct) {
        const sp = ofKind("heal");
        if (sp) return { id: sp.id };
    }

    if (bestLane >= 0) {
        /**
         * ③ 처형 — **임계 이하가 여럿 모였을 때만.** 갓 나온 웨이브에 쓰면
         *   균열력만 버린다. 한 체 지우자고 34 를 쓰는 것도 마찬가지다.
         */
        const exec = firstCastable((def) => def.effect.kind === "execute");
        if (exec) {
            let n = 0;
            for (const e of s.lanes[bestLane].enemies) {
                if (e.hp > 0 && e.hp <= e.hpMax * exec.effect.pct) n++;
            }
            if (n >= AUTO.executeMinTargets) return { id: exec.id, lane: bestLane };
        }

        if (bestN >= AUTO.minEnemiesForDamage) {
            /**
             * ④ 공격 — 데미지 타입 순서로 본다. 신성이 먼저인 것은 CORRUPT 특효라
             *   값어치가 상황 의존적이기 때문이고, 물리가 마지막인 것은 DEF 에
             *   깎이기 때문이다. **기본 4종에서 예전 순서(정화의 빛 → 균열 낙뢰)와
             *   완전히 같다.**
             */
            for (const dmgType of AUTO.damageTypeOrder) {
                const sp = firstCastable(
                    (def) => def.effect.kind === "damage" && def.effect.dmgType === dmgType
                );
                if (sp) return { id: sp.id, lane: bestLane };
            }

            /**
             * ⑤ 밀어내기 — 피해가 0 이므로 **공격 다음**이다. 선두가 방주 코앞까지
             *   왔을 때만 쓴다. 레인 배열은 x 오름차순이고 방주는 낮은 x 쪽이므로
             *   `enemies[0]` 이 가장 앞선 적이다.
             */
            const front = s.lanes[bestLane].enemies[0];
            if (front && front.x - s.cfg.arkX <= AUTO.knockbackArkPx) {
                const sp = ofKind("knockback");
                if (sp) return { id: sp.id, lane: bestLane };
            }
        }
    }

    /**
     * ⑥ 징집 — 마나가 말랐을 때만. 소환할 것이 없으면(편성 0) 마나는 쓸모가 없다.
     */
    if (s.cfg.loadout?.length > 0 && s.mana < s.manaMax * AUTO.manaBelowPct) {
        const sp = ofKind("mana");
        if (sp) return { id: sp.id };
    }

    /**
     * ⑦ 버프·결계는 **맨 마지막**이다 — 남는 균열력의 용처이지 우선순위가 아니다.
     *
     * ★★ 처음에는 회복 다음, 공격보다 **앞**에 두었다. 그랬더니 게이트 B6(스팸 억제)이
     *   4-13 에서 깨졌다. 원인은 게임이 아니라 **이 정책**이었다:
     *   `balanced` 는 오라 안 아군이 많아 `steel_command` 를 집었고, `spam_cheapest` 는
     *   조건에 못 미쳐 공격 주문으로 떨어졌다. 그리고 그 판에서는 **공격이 더 셌다** —
     *   즉 정책이 다양화 편성만 골라 손해 보는 선택을 시켰고, 하네스는 그것을
     *   "스팸이 더 낫다"로 보고했다.
     *   주문 없이 재면 둘은 **94.7% 로 완전히 같았다.** 게임은 멀쩡했다.
     *
     * ★ 교훈: 자동 플레이는 밸런스 측정의 **일부**다. 정책이 특정 편성에만 나쁜 선택을
     *   하면 그 편차가 게이트 수치로 나타나고, 게임을 고치게 만든다.
     *   DEF 버프는 '맞고 있을 때'의 헤지이고, 레인을 비우는 것은 직접적이다.
     */
    if (auraCount >= AUTO.buffMinEnemiesInAura) {
        const sp = firstCastable((def) => {
            const kind = def.effect.kind;
            if (kind !== "buff" && kind !== "shield") return false;
            /**
             * ★ 역할 전용 버프(사수 명령)는 **그 역할이 오라 안에 있을 때만** 쓴다.
             *   없으면 균열력만 태운다 — 그리고 그 낭비는 '방벽 없는 편성'에만
             *   나타나므로, 잡지 않으면 게이트가 편성 탓으로 보고한다.
             */
            if (!def.effect.role) return true;
            for (let i = 0; i < auraCount; i++) {
                if (allies[i].role === def.effect.role) return true;
            }
            return false;
        });
        if (sp) return { id: sp.id };
    }
    return null;
}
