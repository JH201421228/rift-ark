/**
 * 시뮬레이션 상태
 *
 * ★ 레인은 1차원 문제다.
 *   lanes[i].allies / .enemies 를 x 오름차순으로 유지하면
 *   "가장 가까운 적" 탐색이 정렬 배열의 병합 스윕으로 O(n+m) 에 끝난다.
 *   범용 물리 엔진의 O(n²) 브로드페이즈보다 압도적으로 빠르고 결정론적이다.
 *
 * ★ 엔티티는 풀에서 대여한다. 틱당 힙 할당 0 이 목표다.
 *
 * @see docs/03-tech/22-simulation-spec.md §3
 */
import { makeStreams } from "./rng.js";
import { createSpellState } from "./spells.js";
import { createEventQueue } from "./events.js";
import { createHooks } from "./sigils.js";
import { initModeState, MODE } from "./modes.js";
// ★ `nightmare.js` 는 이 파일을 import 하지 않는다 (순환 금지 — 그쪽 머리말 참조).
import { createPlagueState } from "./nightmare.js";

export const LANE_COUNT = 3;
/** 공중 레이어는 레인 인덱스 3 으로 취급한다 (블로킹 불가) */
export const AIR_LANE = 3;
export const TOTAL_LANES = 4;

/**
 * 엔티티 풀 용량.
 *
 * ★★ **나이트메어를 켜기 전에 다시 쟀다** (2026-08-05, P11-03). 설계 문서는
 *   선형 추정으로 215체, 보수 추정으로 240–260체를 예상했고 풀은 256 이었다 —
 *   즉 "아마 아슬아슬하다"였다. 실측은 다르다.
 *
 *   100 스테이지 × 2 시드, **죽이지 못하는 편성**(피해 0 · HP 201배 방벽 6기 ·
 *   방주 무한)으로 스폰 압력의 상한을 재면:
 *
 *     노멀 163체 · 하드 180체 · **나이트메어 197체** (셋 다 1-9 가 최다)
 *
 *   추정이 과했던 이유는 `spawnCountMult` 가 마릿수에 곱해질 때 `Math.round` 로
 *   묶이고(유일 개체는 아예 안 늘어난다), 체류 시간 증가분이 방벽 용량 상한에
 *   먼저 걸리기 때문이다.
 *
 * ★ 그래도 256 은 197 의 1.30배뿐이라 노멀이 갖고 있던 여유(1.57배)보다 얇다.
 *   **288 로 올린다** — 197 의 1.46배. 객체 32개는 전투 시작 시 한 번의 할당이고
 *   틱 비용은 0 이다. 반대로 고갈은 **침묵**이다(적이 소리 없이 사라지고 그 판이
 *   쉬워진다), 그래서 여유를 얇게 두는 쪽의 기대값이 훨씬 나쁘다.
 *
 * ★ 이 값이 충분한지는 `sim.test.js` 의 '엔티티 풀' 블록이 난이도 3종으로 검사한다.
 */
const ENTITY_POOL = 288;
const PROJECTILE_POOL = 128;

function makeEntity() {
    return {
        id: 0,
        defId: "",
        isAlly: false,
        lane: 0,
        x: 0,
        hp: 0,
        hpMax: 0,
        atk: 0,
        def: 0,
        res: 0,
        dmgType: "physical",
        role: "MELEE",
        tags: 0,
        range: 0,
        speed: 0,
        atkInterval: 1000,
        atkReadyAt: 0,
        blockCount: 0,
        blockedBy: -1,
        blocking: 0,
        /**
         * **붙잡혀 있던 누적 시간(ms).** 나이트메어 ② 결박 파열이 읽는다
         * (`movement.js:stepBlocking` · docs/02-design/22-nightmare.md §3).
         * ★ 붙잡혀 있는 틱에만 `TICK_MS` 씩 더한다 — 고정 틱의 누적이라 결정론적이다.
         * ★★ 풀 재사용 시 반드시 0 으로 되돌린다. 이전 개체의 누적 시간이 남으면
         *   **새 적이 스폰 즉시 파열**한다 (`buff` · `hitIds` 와 같은 이유로 목록에 있다).
         */
        blockedMs: 0,
        /**
         * 결박을 끊은 적인가. **되돌릴 수 없는 상태 전이**다 (개체당 한 번).
         * ★ 재붙잡기를 허용하면 2026-08-04 에 고친 결함이 그대로 재발한다 —
         *   매 틱 관계가 붙었다 풀렸다 하면서 무리 전체가 절반 속도로 전진한다.
         * ★★ 풀 재사용 시 반드시 false 로 되돌린다. 남으면 그 슬롯을 쓰는
         *   모든 적이 영원히 블로킹되지 않는다.
         */
        unbindable: false,
        shield: 0,
        /** 별 트리가 주는 상시 관통 (투사체 스폰 시 더해진다) */
        pierce: 0,
        regenPerSec: 0,
        /**
         * 다음 이동 스텝에서 x 에 더할 밀어냄(px). 오라 안 SIEGE 가 쌓고
         * `movement.js` 가 소비하며 0 으로 되돌린다.
         * ★ 명중 시점에 x 를 직접 밀지 않는 이유: 레인 배열은 x 오름차순이고
         *   전투 · 블로킹이 그 정렬에 의존한다 (병합 스윕). 위치는 이동 스텝만
         *   바꾸고 그 직후 `resortLane` 이 정렬을 복구한다.
         */
        pushX: 0,
        inAura: false,
        /**
         * 지휘관 주문 버프의 **사슬** `{stat, amount, until, next}` — 없으면 null.
         * ★ 만료 시 **기록해 둔 증분**을 되돌린다 (`spells.js:stepSpellBuffs`).
         *   풀 재사용 시 반드시 초기화해야 한다 — 안 하면 죽은 유닛의 버프가
         *   다음에 그 슬롯을 쓰는 유닛에게 **영구 스탯**으로 남는다.
         * ★★ 객체 하나가 아니라 사슬인 이유: 주문이 12종이 되면서 오라 버프가 셋이
         *   됐고(강철 명령 · 진격 나팔 · 사수 명령), 덮어쓰면 앞 버프의 되돌릴 값이
         *   그 자리에서 사라진다 (= 영구 스탯).
         */
        buff: null,
        /** 이번 틱에 사거리 안의 상대와 교전 중인가 (교전 중이면 전진하지 않는다) */
        engaged: false,
        cost: 0,
        breachDamage: 0,
        active: false,
    };
}

function makeProjectile() {
    return {
        id: 0,
        isAlly: false,
        lane: 0,
        x: 0,
        vx: 0,
        damage: 0,
        dmgType: "physical",
        pierce: 0,
        /**
         * ★★ 이 발사체가 **이미 때린 엔티티 id**.
         *
         *   이것이 없으면 관통 발사체가 **같은 적을 매 틱 다시 때린다.**
         *   발사체는 틱당 14px(420px/s ÷ 30Hz) 움직이는데 명중 판정 폭은 ±24px 라,
         *   멈춰 있는 적 하나 위에 3틱을 머문다. 실측(2026-08-05): 관통 3스택 아처가
         *   적 하나를 **3번** 때렸고 다른 적은 한 번도 못 때렸다 — "1체 더 관통"이
         *   아니라 조용한 피해 배율이었다.
         *
         * ★ 풀 재사용이므로 배열을 새로 만들지 않고 `length = 0` 으로 비운다
         *   (절대규칙 7·8). 길이는 `pierce + 1` 을 넘지 않는다.
         */
        hitIds: [],
        sourceId: -1,
        /**
         * 쏜 유닛의 정의 id. **렌더가 발사체 스프라이트를 고르는 근거**다.
         * ★ 아트가 아니라 id 만 들고 있는다 — logic 은 스프라이트를 모른다.
         *   쏜 유닛이 먼저 죽어도 발사체는 자기 출처를 알아야 하므로
         *   sourceId(엔티티) 가 아니라 defId 를 따로 갖는다.
         */
        defId: "",
        active: false,
    };
}

/**
 * @param {object} cfg   스테이지 설정 (stageConfig.js 가 만든다)
 * @param {number} seed
 */
export function createSim(cfg, seed) {
    const lanes = new Array(TOTAL_LANES);
    for (let i = 0; i < TOTAL_LANES; i++) {
        lanes[i] = { allies: [], enemies: [] };
    }

    const entityPool = new Array(ENTITY_POOL);
    for (let i = 0; i < ENTITY_POOL; i++) entityPool[i] = makeEntity();

    const projPool = new Array(PROJECTILE_POOL);
    for (let i = 0; i < PROJECTILE_POOL; i++) projPool[i] = makeProjectile();

    return {
        // ── 시간 ─────────────────────────────
        t: 0,
        tick: 0,

        // ── 자원 ─────────────────────────────
        mana: cfg.startMana,
        manaMax: cfg.manaMax,
        manaRegen: cfg.manaRegenBase,
        riftEnergy: 0,
        riftMax: cfg.riftMax,
        /**
         * 지휘관 주문 — 장착 4종 · 쿨다운(다음 사용 가능 시각) · 발동 횟수.
         * ★ 12종 중 무엇을 들고 왔는지는 **설정이 정한다** (`stageConfig.js`).
         *   여기서 기본값을 다시 적으면 출처가 둘이 된다.
         */
        spells: createSpellState(cfg.equippedSpells),

        // ── 방주 ─────────────────────────────
        arkHp: cfg.arkHp,
        arkHpMax: cfg.arkHp,

        // ── 웨이브 ───────────────────────────
        wave: 0,
        waveTotal: cfg.waves,
        nextWaveAt: cfg.deployDelayMs,
        pendingSpawns: [],
        tempoShifted: false,
        tempoShiftWave: Math.max(1, Math.floor(cfg.waves * cfg.tempoShiftRatio)),

        // ── 엔티티 ───────────────────────────
        lanes,
        /** 활성 엔티티 (레인 배열과 중복 참조. 전역 순회용) */
        actives: [],
        projectiles: [],
        entityPool,
        entityFree: entityPool.length,
        projPool,
        projFree: projPool.length,
        nextId: 1,

        // ── 지휘관 ───────────────────────────
        commander: {
            x: cfg.arkX + 120,
            lane: 1,
            hp: cfg.commanderHp,
            hpMax: cfg.commanderHp,
            auraRadius: cfg.auraRadius,
            downUntil: 0,
            targetX: cfg.arkX + 120,
            /** 평타 쿨다운 (docs/02-design/20-commander-combat.md) */
            atkReadyAt: 0,
        },

        // ── 편성 ─────────────────────────────
        loadout: cfg.loadout,
        summonCounts: Object.create(null),
        summonDecayAt: Object.create(null),

        // ── 각인 ─────────────────────────────
        /** 획득한 각인 id (중복 가능) */
        sigils: [],
        /** 발생한 진화 id */
        evolved: [],
        /** 훅 테이블 — 비어 있으면 비용 0 */
        hooks: createHooks(),
        /** 드래프트 대기 상태 { options, rerolls } */
        pendingDraft: null,
        draftsTaken: 0,
        rerollsLeft: cfg.rerolls ?? 1,
        /**
         * 각인이 설정하는 전역 수정자.
         * ★ 여기에 두는 이유 — `s.cfg` 를 복제해 덮어쓰면 그 값을 읽는 경로가
         *   **하나라도 빠졌을 때 조용히 무효**가 된다. `manaRegenMult` 가 그랬다
         *   (`manaRegenBase` 만 곱해서 템포 시프트 이후 마나 샘이 사라졌다).
         */
        mods: { auraSlow: 0, manaRegenMult: 1 },

        /**
         * ── 나이트메어 ① 역병 장판 (docs/02-design/22-nightmare.md §2) ──
         *
         * ★★ **난이도와 무관하게 항상 만든다.** 나이트메어에서만 만들면 시뮬 상태의
         *   히든 클래스가 갈라져 노멀과 나이트메어의 틱 비용을 비교하는 것 자체가
         *   무의미해지고, 노멀 경로에서 `s.nightmare` 가 `undefined` 라 어느 소비처가
         *   방어를 빠뜨리는 순간 조용히 터진다.
         * ★ 엔티티가 아니라 **고정 12슬롯 구조체**다 — 동시 엔티티 증가 0.
         */
        nightmare: createPlagueState(LANE_COUNT),

        // ── 전투 모드 (GDD §4.8) ─────────────
        /** "assault" | "endure" | "breakthrough" | "escort" | "nemesis" */
        mode: cfg.mode ?? MODE.ASSAULT,
        modeState: initModeState(),

        // ── 결과 ─────────────────────────────
        phase: "battle",
        stats: {
            kills: 0,
            summons: 0,
            damageDealt: 0,
            damageBlocked: 0,
            breaches: 0,
            /** 태그별 미처치 수 — 패배 원인 진단(P3-13)의 근거 데이터 */
            unkilledByTag: Object.create(null),
            /**
             * ★★★ **풀이 고갈되어 태어나지 못한 개체 수** (2026-08-05).
             *
             *   `acquireEntity` 는 풀이 비면 `null` 을 돌려주고 스폰이 **조용히**
             *   실패한다. 그 결과는 크래시가 아니라 **침묵**이다 — 가장 무거운 판에서
             *   적이 소리 없이 사라지고, 그 판이 쉬워지고, 아무 테스트도 실패하지 않는다.
             *   이 저장소가 계속 잡아 온 결함의 정확한 모양이다 (성소 · 각인 6종 · 발사체).
             *
             *   그래서 **세어서 상태에 남긴다.** 순수성을 지키느라(로그도 throw 도 없이)
             *   숫자 하나를 두면, 하네스·테스트·디버그 오버레이가 그것을 볼 수 있다.
             *   `sim.test.js` 가 100 스테이지 전수로 **0 이어야 한다**를 검사한다.
             */
            spawnDropped: 0,
            /**
             * ★★★ **풀이 고갈되어 발사되지 못한 탄 수** (2026-08-05).
             *
             *   `acquireProjectile` 도 `acquireEntity` 와 똑같이 `null` 을 돌려주고
             *   `engage.js:spawnProjectile` 이 조용히 돌아간다. 다만 이쪽의 침묵은
             *   **연출이 아니라 피해가 사라지는 것**이다 — 발사체는 자기 스탯으로
             *   때리므로(`projectiles.js`), 태어나지 못한 탄은 그 한 방이 통째로 없다.
             *
             *   적 11종에 발사체 역할이 생기면서(2026-08-05) 이 풀을 쓰는 쪽이
             *   아군에서 양 진영으로 늘었다. 고갈되면 **가장 붐비는 판에서만**
             *   조용히 쉬워지고, 그 판이 바로 밸런스 게이트가 재는 판이다.
             *   `spawnDropped` 와 같은 규약으로 숫자만 남긴다 (절대규칙 1 — 로그도 throw 도 없다).
             */
            projectileDropped: 0,
        },

        // ── RNG ──────────────────────────────
        seed,
        rng: makeStreams(seed),

        // ── 렌더 이벤트 ──────────────────────
        events: createEventQueue(),

        cfg,
    };
}

/* ── 엔티티 풀 ──────────────────────────────────────────────── */

/**
 * 풀에서 엔티티를 꺼낸다. 고갈되면 `null`.
 *
 * ★★ **고갈은 조용히 지나가지 않는다** (2026-08-05). 예전에는 `null` 만 돌려주고
 *   호출부가 그냥 돌아갔다 — 가장 무거운 판에서 적이 소리 없이 사라지고, 그 판이
 *   쉬워지고, 아무 검사도 실패하지 않았다. 지금은 `stats.spawnDropped` 가 센다.
 *   `logic/` 은 순수해야 하므로(절대규칙 1) 로그도 throw 도 하지 않고 **숫자만** 남긴다 —
 *   그 숫자를 하네스·테스트·디버그 오버레이가 본다.
 */
export function acquireEntity(s) {
    if (s.entityFree === 0) {
        s.stats.spawnDropped++;
        return null;
    }
    const e = s.entityPool[--s.entityFree];
    e.active = true;
    e.id = s.nextId++;
    e.blockedBy = -1;
    e.blocking = 0;
    // ★ 나이트메어 ② — 초기화를 빼먹으면 새 적이 스폰 즉시 파열하거나(누적 시간),
    //   그 슬롯을 쓰는 모든 적이 영원히 블로킹되지 않는다(파열 표식).
    e.blockedMs = 0;
    e.unbindable = false;
    e.shield = 0;
    e.regenPerSec = 0;
    e.pushX = 0;
    e.inAura = false;
    // ★ 풀 재사용 — 이전 유닛의 주문 버프가 남으면 영구 스탯이 된다
    e.buff = null;
    return e;
}

export function releaseEntity(s, e) {
    e.active = false;
    s.entityPool[s.entityFree++] = e;
}

export function acquireProjectile(s) {
    if (s.projFree === 0) {
        s.stats.projectileDropped++;
        return null;
    }
    const p = s.projPool[--s.projFree];
    p.active = true;
    p.id = s.nextId++;
    // ★ 풀 재사용 — 지난 발사체의 명중 기록이 남으면 그 id 의 적을 영영 못 맞힌다
    p.hitIds.length = 0;
    return p;
}

export function releaseProjectile(s, p) {
    p.active = false;
    s.projPool[s.projFree++] = p;
}

/* ── 정렬 배열 유지 ─────────────────────────────────────────── */

/**
 * x 오름차순을 유지하며 삽입한다.
 * ★ 동점일 때 id 로 타이브레이크하지 않으면 플랫폼별 정렬 구현 차이로
 *   결과가 갈린다.
 */
export function insertSorted(arr, e) {
    let lo = 0;
    let hi = arr.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        const o = arr[mid];
        if (o.x < e.x || (o.x === e.x && o.id < e.id)) lo = mid + 1;
        else hi = mid;
    }
    arr.splice(lo, 0, e);
}

export function removeFrom(arr, e) {
    const i = arr.indexOf(e);
    if (i >= 0) arr.splice(i, 1);
}

/**
 * 이동 후 정렬 복구.
 * 거의 정렬된 배열이므로 삽입 정렬이 O(n) 에 가깝다.
 */
export function resortLane(arr) {
    for (let i = 1; i < arr.length; i++) {
        const cur = arr[i];
        let j = i - 1;
        while (j >= 0 && (arr[j].x > cur.x || (arr[j].x === cur.x && arr[j].id > cur.id))) {
            arr[j + 1] = arr[j];
            j--;
        }
        arr[j + 1] = cur;
    }
}
