/**
 * 웨이브 스폰 · 템포 시프트 · 유닛 소환
 *
 * ★ 템포 시프트 (전체 웨이브의 60% 지점):
 *   마나 재생 ×2, 적 밀도 ×1.6.
 *   전투가 "경제 구축 → 스윙 → 해결" 3막 구조를 갖게 된다.
 *   평평한 DPS 경주를 "온다"는 가시적 비트가 있는 구조로 바꾸는 장치.
 *
 * @see docs/02-design/11-core-loop.md §5.2
 */
import { acquireEntity, insertSorted, AIR_LANE } from "./state.js";
import { TAG } from "./tags.js";
import { regenPerSec } from "./combat.js";
import { emit, EV } from "./events.js";
import { summonCost, registerSummon } from "./resources.js";
import { runHooks, HOOK, isDraftWave, rollDraft } from "./sigils.js";
import { noteBossSpawn } from "./modes.js";

/** 훅 컨텍스트 재사용 — 틱당 힙 할당 0 */
const ctx = { entity: null, target: null, blocker: null, projectile: null };

/** 정의(def)로 엔티티를 초기화한다 */
function initEntity(s, e, def, isAlly, lane, x) {
    e.defId = def.id;
    e.isAlly = isAlly;
    e.lane = lane;
    e.x = x;
    e.hpMax = def.hp;
    e.hp = def.hp;
    e.atk = def.atk;
    e.def = def.def;
    e.res = def.res;
    e.dmgType = def.dmgType;
    e.role = def.role;
    e.tags = def.tagMask;
    e.range = def.range;
    e.speed = def.speed;
    e.atkInterval = def.atkInterval;
    e.atkReadyAt = 0;
    e.blockCount = def.blockCount ?? 0;
    e.blocking = 0;
    e.blockedBy = -1;
    e.shield = def.shield ?? 0;
    e.pierce = def.pierce ?? 0;
    e.regenPerSec = regenPerSec(s.cfg.combat, def.tagMask, def.hp, !!def.giant);
    e.cost = def.cost ?? 0;
    e.breachDamage = def.breachDamage ?? 0;
    e.engaged = false;
    e.inAura = false;
    return e;
}

function addToLane(s, e) {
    const lane = s.lanes[e.lane];
    insertSorted(e.isAlly ? lane.allies : lane.enemies, e);
    s.actives.push(e);
}

/**
 * 동료 소환 — **떼 유닛(`squad`)도 한 번의 소환이다** (2026-08-05, 사용자 제보).
 *
 * ★★ **예전에는 호출부가 `squad` 만큼 이 함수를 반복해서 불렀다.** 그래서
 *   꼬꼬댁 닭(squad 3)을 한 번 탭하면:
 *     · 마나가 **세 번** 나가고 (9 → 10.6 → 12.5, 합 32)
 *     · 스팸 억제 카운터(`registerSummon`, 1.18배)가 **3단** 올랐다
 *   그 결과 두 번째 탭에서는 마나가 두 마리분만 남아 **2마리**, 그 다음은 **1마리**가
 *   나왔다. 사용자가 본 "3 → 2 → 1" 이 그것이다 — 설계가 아니라 **부작용**이었다.
 *
 * ★ 이제 규약은 하나다: **탭 한 번 = 소환 한 번.**
 *     · 총 코스트 = 지금 코스트 × 마릿수. **전부 낼 수 있을 때만** 나온다 (전부 아니면 0)
 *     · 코스트 상승은 **한 번만** 기록한다
 *   부분 소환을 없앤 이유: "3마리짜리를 샀는데 2마리가 나왔다"는 것을 화면이
 *   설명할 방법이 없다. 못 사면 안 사는 편이 언제나 읽기 쉽다.
 *
 * @param {number} lane 0..2 (FLYER 는 자동으로 공중)
 * @returns {boolean} 소환했는가
 */
export function trySummon(s, unitDef, lane) {
    const unit = summonCost(s, unitDef.id, unitDef.cost);
    const squad = Math.max(1, Math.floor(unitDef.squad ?? 1));
    const cost = unit * squad;
    if (s.mana < cost) return false;

    let spawned = 0;
    for (let i = 0; i < squad; i++) {
        // ★ 풀이 비면 거기서 멈춘다. 엔티티 풀은 120체 기준이라 실제로는
        //   일어나지 않지만, 일어나도 이미 나온 개체는 유효해야 한다.
        if (!spawnAlly(s, unitDef, lane)) break;
        spawned++;
    }
    if (spawned === 0) return false;

    s.mana -= cost;
    /**
     * ★ 카운트는 **실제로 선 몸의 수**만큼 올린다 (`resources.js:registerSummon`).
     *   1 만 올리면 떼 유닛의 스팸 억제가 1/squad 로 옅어져 하드 게이트 B6 가
     *   무너진다 — 실측으로 무너뜨려 본 뒤 되돌린 값이다.
     */
    registerSummon(s, unitDef.id, spawned);
    s.stats.summons++;
    return true;
}

/**
 * 개체 하나를 실제로 전장에 올린다 — **비용은 여기서 다루지 않는다.**
 * ★ 비용·스팸 카운터를 `trySummon` 하나로 모으기 위한 분리다 (위 주석 참조).
 * @returns {boolean} 올렸는가 (엔티티 풀 고갈이면 false)
 */
function spawnAlly(s, unitDef, lane) {
    const e = acquireEntity(s);
    if (!e) return false;

    const targetLane = unitDef.role === "FLYER" ? AIR_LANE : lane;
    initEntity(s, e, unitDef, true, targetLane, s.cfg.arkX + 16);

    // ★ 각인의 스탯 보정은 스폰 시점에 적용된다.
    //   ★★ **이미 나와 있던 아군에게도 적용된다** — 그쪽은 각인을 고르는 순간
    //   `sigils.js:applyToActiveAllies` 가 처리한다 (2026-08-05, 제보 ②③).
    //   여기와 저기가 **같은 훅을 정확히 한 번씩** 돌려야 한다.
    ctx.entity = e;
    runHooks(s, HOOK.MODIFY_STAT, ctx);
    runHooks(s, HOOK.ON_SUMMON, ctx);
    ctx.entity = null;

    addToLane(s, e);
    emit(s.events, EV.SPAWN, e.id, targetLane, 1, 0, unitDef.id);
    return true;
}

/** 적 스폰 (웨이브 테이블이 호출) */
export function spawnEnemy(s, enemyDef, lane) {
    const e = acquireEntity(s);
    if (!e) return null;

    const targetLane = (enemyDef.tagMask & TAG.FLYING) !== 0 ? AIR_LANE : lane;
    initEntity(s, e, enemyDef, false, targetLane, s.cfg.riftX - 16);
    addToLane(s, e);
    emit(s.events, EV.SPAWN, e.id, targetLane, 0, 0, enemyDef.id);
    noteBossSpawn(s, e, enemyDef); // 모드(보스): 거대화 엘리트를 보스로 등록
    return e;
}

/**
 * 웨이브 진행.
 * pendingSpawns 에 쌓아 두고 시간차로 내보낸다 (한 프레임에 몰리지 않게).
 */
export function stepWaves(s) {
    // 대기 중인 개별 스폰 처리
    const pend = s.pendingSpawns;
    for (let i = pend.length - 1; i >= 0; i--) {
        const p = pend[i];
        if (s.t < p.at) continue;
        spawnEnemy(s, p.def, p.lane);
        pend.splice(i, 1);
    }

    if (s.wave >= s.waveTotal) return;
    if (s.t < s.nextWaveAt) return;

    s.wave++;

    /**
     * ★★ **웨이브 사이 방주 회복** (P7-03) — 스테이지별 손잡이다. 기본값은 0 이다.
     *
     *   왜 이 규칙이 필요했나. "설계된 첫 패배"(1-9)는 승률 30–45% 와
     *   **패배 시 적 잔여 HP 5–15%** 를 동시에 만족해야 한다. 앞은 게이트 B3,
     *   뒤는 "아깝게 졌다"는 감각이고, 그것이 전달되어야 "편성을 바꾸면 넘는다"를 배운다.
     *
     *   그런데 기존 손잡이는 **전부 같은 변수(총압력)를 움직인다.** 승률을 40% 로
     *   낮추면 자동 플레이가 **초반에** 무너져 잔여 82% 로 지고(= 벽으로 읽힌다),
     *   패배를 뒤로 미루면 승률이 80% 아래로 내려가지 않는다.
     *   배율·웨이브 수·방주 HP·후반 급증을 7회 스윕해도 둘을 동시에 만족하지 못했다.
     *
     *   회복은 **초반 생존과 후반 치사성을 분리하는** 유일한 직접 수단이다.
     *   앞 구간의 누적 피해는 회복이 상쇄하고, 후반 급증은 회복 속도를 넘어선다.
     *
     * ★ 결정론이다 — 난수가 없고 웨이브 수의 함수다 (B1 그대로 통과).
     * ★ 첫 웨이브에는 회복하지 않는다. 아직 아무 피해도 없으므로 무의미하고,
     *   있으면 "시작하자마자 회복 연출"이 뜬다.
     */
    const regen = s.cfg.arkRegenPerWave ?? 0;
    if (regen > 0 && s.wave > 1 && s.arkHp > 0 && s.arkHp < s.arkHpMax) {
        s.arkHp = Math.min(s.arkHpMax, s.arkHp + regen);
    }

    emit(s.events, EV.WAVE_START, s.wave, s.waveTotal);
    runHooks(s, HOOK.ON_WAVE_START, ctx);

    // 템포 시프트
    if (!s.tempoShifted && s.wave >= s.tempoShiftWave) {
        s.tempoShifted = true;
        emit(s.events, EV.TEMPO_SHIFT, s.wave);
    }

    // ★ 3웨이브마다 각인 드래프트. 시뮬을 멈추고 선택을 기다린다.
    if (isDraftWave(s) && !s.pendingDraft) {
        const options = rollDraft(s, s.cfg.draftOptions ?? 3);
        if (options.length) {
            s.pendingDraft = { options, wave: s.wave };
            s.phase = "draft";
            emit(s.events, EV.SIGIL_DRAFT, s.wave, options.length);
        }
    }

    queueWave(s, s.wave);

    const [lo, hi] = s.cfg.waveIntervalMs;
    const span = hi - lo;
    s.nextWaveAt = s.t + lo + Math.floor(s.rng.spawn() * (span + 1));
}

/**
 * ★★ 이 스펙이 실제로 몇 마리를 내보내는가 — **유일 개체는 밀도로 늘리지 않는다.**
 *
 *   `Math.round(1 × 1.6) = 2` 라서 템포 시프트 이후에 등장하는 보스가
 *   **전 보스 스테이지에서 2체 스폰**되고 있었다 (1-10 웨이브 14 / 시프트 8,
 *   3-20 웨이브 16 / 시프트 9 — 6개 nemesis 스테이지 전부 해당).
 *
 *   그리고 두 번째 보스는 그냥 한 마리 더가 아니라 **규칙 밖의 개체**다:
 *   `attachBoss()` 가 이미 등록된 보스가 있으면 조기 반환하므로 페이즈 전환도
 *   슬램도 없이 base 태그로 고정되고, `noteBossBreach()` 는 등록된 id 만 보므로
 *   **"보스가 방주에 닿으면 패배"라는 규칙을 통째로 우회한다.**
 *   즉 복제 보스는 방주까지 걸어가도 아무 일이 없다.
 *
 *   보스와 거대화 엘리트는 **설계된 단일 조우**다. 밀도는 잡몹의 압력을
 *   조절하는 손잡이이지 이름 있는 존재를 복제하는 손잡이가 아니다.
 *
 * ★ 이 규칙이 없으면 전 스테이지 스폰 스펙 1,426개 중 63개가 조용히
 *   1 → 2 로 늘어난다 (그중 6개가 거대화 엘리트).
 *
 * ★ 별도 함수로 꺼낸 이유: 전투를 끝까지 돌려서 검증하면 **지는 판에서는
 *   보스가 아예 안 나와** 검사가 성립하지 않는다. 규칙만 따로 재야 한다.
 *
 * @param {object} def 적 정의 (`boss` · `giant` 포함)
 * @param {number} specCount 웨이브 테이블에 적힌 마릿수
 * @param {number} density 템포 × 난이도 배율
 * @returns {number} 실제 스폰 수
 */
export function spawnCountFor(def, specCount, density) {
    const unique = !!def?.boss?.phases?.length || !!def?.giant;
    if (unique) return specCount;
    return Math.max(1, Math.round(specCount * density));
}

/** 웨이브 테이블에서 이번 웨이브의 스폰 목록을 큐에 넣는다 */
function queueWave(s, waveNo) {
    const entry = s.cfg.waveTable.find((w) => w.wave === waveNo);
    if (!entry) return;

    // 템포 시프트(후반 밀도) × 난이도 스폰 배율.
    // ★ 곱해서 하나로 만든다 — 두 번 반올림하면 하드에서 1마리가 사라지는
    //   구간이 생기고, 그 손실이 어디서 왔는지 아무도 추적하지 못한다.
    const density = (s.tempoShifted ? s.cfg.tempoDensityMult : 1) * (s.cfg.spawnCountMult ?? 1);

    for (const spec of entry.spawns) {
        const def = s.cfg.enemyDefs[spec.id];
        if (!def) {
            // ★ 개발자용 문구다 — 번역하지 않는 근거는 `stageConfig.js:buildStageConfig`
            //   머리말에 있다 (데이터 정합성 실패 · data:validate 가 먼저 잡는다).
            throw new Error(`웨이브 ${waveNo}: 알 수 없는 적 '${spec.id}'`);
        }
        const count = spawnCountFor(def, spec.count, density);
        const lanes = spec.lanes ?? [0, 1, 2];
        const delay = spec.delayMs ?? 350;

        for (let i = 0; i < count; i++) {
            s.pendingSpawns.push({
                def,
                lane: lanes[i % lanes.length],
                at: s.t + i * delay,
            });
        }
    }
}
