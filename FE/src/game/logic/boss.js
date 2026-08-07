/**
 * 보스 — 3페이즈 · 페이즈마다 태그 변경 · 예고 후 광역 슬램 (P6-05)
 *
 * ★★ **페이즈마다 태그가 바뀌는 것이 이 시스템의 전부다.**
 *
 *   보스가 그냥 HP 큰 적이면, 답은 "가장 센 딜러를 넣는다" 하나뿐이고
 *   보스전은 스탯 검사로 끝난다. 태그가 페이즈마다 바뀌면 1페이즈에서
 *   통하던 물리가 2페이즈에서 막히고 술식이 필요해진다 —
 *   **한 편성 안에 서로 다른 답을 같이 넣어야 하는** 유일한 지점이 된다.
 *   상성 시스템(GDD §4.2)이 스테이지 단위가 아니라 *전투 안에서* 작동하는 곳이다.
 *
 *   그래서 페이즈 태그는 반드시 **서로 다른 데미지 타입을 요구**하도록 짠다.
 *   ARMORED(→술식) → WARDED(→물리) → CORRUPT(→신성) 이 기본형이다.
 *   같은 답이 연속되는 페이즈 구성은 이 시스템을 없는 것으로 만든다.
 *
 * ★ 전환 예고 (기본 800ms). 보스는 멈추고 아무것도 하지 않는다.
 *   즉시 바꿔버리면 플레이어는 **무엇이 바뀌었는지 모른 채** 딜이 안 박히기
 *   시작한다. 예고는 연출이 아니라 정보 전달 장치다.
 *   보스는 이 동안에도 피해를 받는다 — 무적 구간은 "쏟아부은 딜이 사라졌다"는
 *   감각을 만들고, 페이즈 순서는 어차피 HP 임계값이 보장한다.
 *
 * ★ 슬램 예고 (기본 800ms). **지휘관이 있는 레인**을 노린다.
 *   동료는 자동 전투라 피할 수 없지만 지휘관은 플레이어가 직접 움직인다.
 *   즉 "예고를 보고 지휘관을 뺀다"가 이 게임에서 회피가 실력이 되는 유일한
 *   지점이다 (19-art-audio-direction.md §4 "회피 가능성이 곧 실력 표현").
 *   지휘관이 멀리 있으면 아군이 가장 많은 레인을 노린다 — 안전지대가 없다.
 *
 * ★ logic/ 규칙: phaser · DOM · Math.random · Date.now 없음.
 *   슬램 대상 레인은 난수가 아니라 **지휘관 위치**로 정해진다. 결정론이 유지되고,
 *   동시에 플레이어의 선택이 결과를 바꾼다.
 *
 * @see docs/02-design/10-GDD.md §4.8
 * @see docs/02-design/19-art-audio-direction.md §4
 */
import { TOTAL_LANES } from "./state.js";
import { emit, EV } from "./events.js";
import { applyDamage } from "./engage.js";
import { regenPerSec } from "./combat.js";
// ★ 지휘관 HP 를 깎는 자리는 하나뿐이다 (`commanderHit.js` 주석 참조).
import { damageCommander } from "./commanderHit.js";

/**
 * 보스 런타임 상태. **전투 시작 시 한 번만 만든다** (히든 클래스 고정).
 * 보스가 아직 등장하지 않았으면 id 가 -1 이다.
 */
export function initBossState() {
    return {
        /** 살아 있는 보스 엔티티 id. -1 이면 미등장 */
        id: -1,
        /** 엔티티 직접 참조. 풀 재사용 대비로 id 를 함께 검사한다 */
        e: null,
        defId: "",
        /** 정규화된 페이즈 배열 (stageConfig.normalizeBoss) */
        phases: null,
        phaseIndex: 0,
        /** 스폰 시점 원본 스탯 — 배율을 누적이 아니라 원본 기준으로 적용한다 */
        base: { atk: 0, def: 0, res: 0, speed: 0, atkInterval: 0 },

        // ── 페이즈 전환 예고 ──
        /** 전환 예정 페이즈. -1 이면 전환 중이 아니다 */
        transitionTo: -1,
        /** 이 시각에 전환이 확정된다 */
        transitionAt: 0,

        // ── 슬램 ──
        /** 다음 착탄 시각. 0 이면 예약 없음 */
        slamAt: 0,
        /** 예고가 나갔는가 */
        slamPending: false,
        slamLane: -1,
        slamX: 0,

        // ── 파라미터 (modeParams 에서 복사) ──
        phaseTelegraphMs: 800,
        slamTelegraphMs: 800,
        firstSlamDelayMs: 6000,
        commanderReach: 220,
    };
}

/**
 * 보스가 스폰됐다. modes.noteBossSpawn 이 부른다.
 * ★ 페이즈 데이터가 없는 적은 그냥 큰 적이다 — 시스템이 조용히 꺼진다.
 *   (거대화 엘리트 전부에 페이즈를 강제하면 초반 관문이 갑자기 어려워진다)
 */
export function attachBoss(s, e, def) {
    const bs = s.modeState.boss;
    if (!bs || bs.id !== -1) return;

    bs.id = e.id;
    bs.e = e;
    bs.defId = def.id;
    bs.base.atk = e.atk;
    bs.base.def = e.def;
    bs.base.res = e.res;
    bs.base.speed = e.speed;
    bs.base.atkInterval = e.atkInterval;

    const p = s.cfg.modeParams ?? {};
    bs.phaseTelegraphMs = p.phaseTelegraphMs ?? 800;
    bs.slamTelegraphMs = p.slamTelegraphMs ?? 800;
    bs.firstSlamDelayMs = p.firstSlamDelayMs ?? 6000;
    bs.commanderReach = p.slamCommanderReach ?? 220;

    bs.phases = def.boss?.phases ?? null;
    if (!bs.phases || bs.phases.length === 0) return;

    // 1페이즈를 즉시 적용한다 — 데이터의 1페이즈가 기본 스탯과 다를 수 있다
    applyPhase(s, bs, e, 0);
}

/** 보스가 죽었다. 참조를 끊어 풀 재사용 시 오작동을 막는다 */
export function detachBoss(s) {
    const bs = s.modeState?.boss;
    if (!bs) return;
    bs.e = null;
    bs.slamPending = false;
    bs.slamAt = 0;
    bs.transitionTo = -1;
}

/**
 * 보스 1틱. sim.step 이 stepProjectiles 뒤 · stepDeaths 앞에서 부른다.
 * ★ 순서가 규칙이다 — 슬램이 죽인 아군이 같은 틱에 수거되어야 한다.
 */
export function stepBoss(s) {
    const bs = s.modeState?.boss;
    if (!bs || bs.id === -1 || !bs.phases) return;

    const e = bs.e;
    // 풀에서 재사용된 슬롯을 보스로 착각하지 않도록 id 까지 확인한다
    if (!e || !e.active || e.id !== bs.id || e.hp <= 0) return;

    stepPhase(s, bs, e);
    stepSlam(s, bs, e);
}

/* ── 페이즈 ─────────────────────────────────────────────────── */

/** HP 비율에 해당하는 가장 진행된 페이즈 인덱스 */
function phaseForRatio(bs, ratio) {
    let idx = 0;
    for (let i = 0; i < bs.phases.length; i++) {
        if (ratio <= bs.phases[i].atRatio) idx = i;
    }
    return idx;
}

function stepPhase(s, bs, e) {
    // 전환 예고 중 — 멈춰 서서 아무것도 하지 않는다
    if (bs.transitionTo >= 0) {
        e.speed = 0;
        e.atkReadyAt = bs.transitionAt;
        if (s.t < bs.transitionAt) return;
        applyPhase(s, bs, e, bs.transitionTo);
        return;
    }

    // ★ 한 번에 두 임계값을 뚫는 버스트가 나올 수 있다.
    //   예고를 두 번 쌓지 않고 도달한 최종 페이즈로 한 번에 넘어간다.
    const next = phaseForRatio(bs, e.hp / e.hpMax);
    if (next <= bs.phaseIndex) return;

    bs.transitionTo = next;
    bs.transitionAt = s.t + bs.phaseTelegraphMs;
    bs.slamPending = false;
    bs.slamAt = 0;
    // ★ 예고가 시작되는 이 틱부터 멈춘다. 다음 틱으로 미루면
    //   "예고가 떴는데 한 걸음 더 들어온다"가 되어 예고를 믿을 수 없게 된다.
    e.speed = 0;
    e.atkReadyAt = bs.transitionAt;
    emit(
        s.events,
        EV.MODE_BOSS_PHASE_TELEGRAPH,
        e.id,
        next + 1,
        bs.phases.length,
        bs.phaseTelegraphMs,
        bs.defId
    );
}

function applyPhase(s, bs, e, idx) {
    const p = bs.phases[idx];
    bs.phaseIndex = idx;
    bs.transitionTo = -1;
    bs.transitionAt = 0;

    // ★★ 태그 교체 — 이 한 줄이 보스전을 스탯 검사에서 편성 퍼즐로 바꾼다
    e.tags = p.tagMask;

    e.atk = Math.round(bs.base.atk * p.atkMult);
    // ★ def/res 는 절대값이다. 배율이면 res 0 인 보스에 WARDED 를 붙여도
    //   0 × n = 0 이라 태그만 바뀌고 상성은 그대로다 (stageConfig.normalizeBoss 참조).
    e.def = p.def ?? bs.base.def;
    e.res = p.res ?? bs.base.res;
    e.speed = Math.round(bs.base.speed * p.speedMult);
    e.atkInterval = Math.round(bs.base.atkInterval * p.atkIntervalMult);
    // 전환 직후에 바로 때리지 않는다 — 예고를 보고 대응할 틈을 남긴다
    e.atkReadyAt = s.t + e.atkInterval;
    // REGEN 이 붙거나 빠지는 페이즈가 있다.
    // ★ 보스는 언제나 giant 이므로 거대화 비율을 쓴다 (combat.regenPerSec 참조).
    e.regenPerSec = regenPerSec(s.cfg.combat, p.tagMask, e.hpMax, true);

    bs.slamPending = false;
    bs.slamAt = p.slamEveryMs > 0 ? s.t + bs.firstSlamDelayMs : 0;

    emit(s.events, EV.MODE_BOSS_PHASE, e.id, idx + 1, bs.phases.length, e.tags, bs.defId);
}

/* ── 슬램 ───────────────────────────────────────────────────── */

/**
 * 슬램이 떨어질 레인.
 * ★ 지휘관이 사거리 안이면 **지휘관 레인**. 이것이 회피를 실력으로 만든다.
 *   멀리 도망가 있으면 아군이 가장 많은 레인 — 지휘관을 뒤로 빼는 것이
 *   공짜가 되지 않는다.
 */
function pickSlamLane(s, e, reach) {
    const c = s.commander;
    if (c.hp > 0 && Math.abs(c.x - e.x) <= reach) return c.lane;

    let best = 0;
    let bestN = -1;
    for (let li = 0; li < TOTAL_LANES; li++) {
        const n = s.lanes[li].allies.length;
        if (n > bestN) {
            bestN = n;
            best = li;
        }
    }
    return best;
}

function stepSlam(s, bs, e) {
    if (bs.transitionTo >= 0) return; // 전환 중에는 슬램하지 않는다
    if (bs.slamAt <= 0) return;

    const p = bs.phases[bs.phaseIndex];
    if (!p || p.slamEveryMs <= 0) return;

    // 예고 — 착탄 slamTelegraphMs 전에 위치를 확정하고 알린다
    if (!bs.slamPending) {
        if (s.t < bs.slamAt - bs.slamTelegraphMs) return;
        bs.slamPending = true;
        bs.slamLane = pickSlamLane(s, e, bs.commanderReach);
        bs.slamX = e.x;
        emit(
            s.events,
            EV.MODE_BOSS_TELEGRAPH,
            e.id,
            bs.slamLane,
            Math.round(bs.slamX),
            Math.round(p.slamRadius),
            bs.defId
        );
        return;
    }

    if (s.t < bs.slamAt) return;

    resolveSlam(s, bs, e, p);
    bs.slamPending = false;
    bs.slamAt = s.t + p.slamEveryMs;
}

function resolveSlam(s, bs, e, p) {
    const lane = bs.slamLane;
    const radius = p.slamRadius;
    const allies = s.lanes[lane].allies;

    // 뒤에서부터 훑는다 — applyDamage 는 배열을 건드리지 않지만
    // 사망 수거(stepDeaths)와 같은 틱에 돌므로 순서를 고정해 둔다
    for (let i = allies.length - 1; i >= 0; i--) {
        const a = allies[i];
        if (Math.abs(a.x - bs.slamX) > radius) continue;
        applyDamage(s, e, a, lane, s.cfg.combat, s.cfg, p.slamDamageMult);
    }

    // ★ 지휘관도 맞는다. 슬램의 진짜 대가는 동료 피해가 아니라 **오라 공백**이다.
    //
    // ★★ 즉사가 아니라 **피해**다. 한 방에 기절시키면 예고를 못 본 플레이어는
    //   물론이고 **자동 조작 플레이어는 매 슬램마다 반드시 기절한다.**
    //   오라가 7~10초마다 사라지므로 전선이 영구적으로 무너지고, 밸런스
    //   하네스에서 보스 스테이지 승률이 100% → 60% 로 무너졌다 (실측).
    //   회피는 *잘하면 이득*이어야지 *못하면 파탄*이면 안 된다.
    //   피해로 두면: 한 번 맞는 것은 견디고, 연속으로 맞으면 기절한다.
    //
    // ★★ 피해에는 **상한**이 있다 — 지휘관 최대 HP 의 일정 비율.
    //   배율만으로는 위 규칙을 지킬 수 없다. 지휘관 HP 는 고정인데 보스 ATK 는
    //   스테이지 지수 커브를 탄다 (실측: 1-10 278 → 3-20 51,260, 184배).
    //   배율 하나로는 월드 1 에서 맞추면 월드 2부터 즉사, 월드 3에서 맞추면
    //   월드 1 슬램이 무피해가 된다. 상한을 HP 비율로 두면 **월드가 몇 개 늘어나도**
    //   "한 방에 죽지 않는다"가 규칙으로 유지된다.
    //
    // ★ 상한을 여기서 계산하지 않는다 (2026-08-05). 일반 적의 타격도 같은 벽에
    //   부딪혀 같은 답을 냈으므로, 상한 적용·HP 차감·기절 신호·피격 이벤트는
    //   `commanderHit.js:damageCommander` 하나가 맡는다. 같은 규칙을 두 곳에
    //   적으면 반드시 갈라진다 — 이 저장소의 단일 실패 유형이다.
    const c = s.commander;
    if (c.hp > 0 && c.lane === lane && Math.abs(c.x - bs.slamX) <= radius) {
        const cb = s.cfg.combat;
        const raw = e.atk * p.slamDamageMult * (cb.bossSlamCommanderMult ?? 0.5);
        damageCommander(s, raw, cb.bossSlamCommanderHpRatio ?? 0.3);
    }

    emit(
        s.events,
        EV.MODE_BOSS_SLAM,
        e.id,
        lane,
        Math.round(bs.slamX),
        Math.round(radius),
        bs.defId
    );
}

/* ── 조회 (렌더 · HUD 용) ───────────────────────────────────── */

/**
 * 현재 보스 요약. 없으면 null.
 * ★ 매 틱 부르지 않는다 — HUD 동기화(10Hz)에서만 쓴다.
 */
export function bossSnapshot(s) {
    const bs = s.modeState?.boss;
    if (!bs || bs.id === -1 || !bs.e || !bs.e.active || bs.e.id !== bs.id) return null;
    const e = bs.e;
    return {
        id: e.id,
        defId: bs.defId,
        hp: e.hp,
        hpMax: e.hpMax,
        tags: e.tags,
        phase: bs.phaseIndex + 1,
        phaseTotal: bs.phases ? bs.phases.length : 1,
        transitioning: bs.transitionTo >= 0,
    };
}
