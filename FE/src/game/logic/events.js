/**
 * 렌더 이벤트 큐
 *
 * 시뮬은 렌더를 직접 호출하지 않는다. 이벤트를 큐에 넣고, BattleScene 이
 * 이를 소비해 트윈·이펙트·히트스톱·카메라를 구동한다.
 *
 * ★ 이 큐가 시뮬과 렌더의 유일한 접점이다.
 *   헤드리스 실행(밸런스 하네스)에서는 큐를 그냥 버린다.
 *
 * ★ 틱당 힙 할당 0 을 위해 이벤트 객체도 풀링한다.
 *   배열은 length=0 으로 재사용한다.
 *
 * @see docs/03-tech/22-simulation-spec.md §5.6
 */

export const EV = {
    SPAWN: 1,
    ATTACK: 2,
    /**
     * a=대상id b=피해 c=레인 d=종류(0일반 1무효 2약점 3저항 4크리) **s=때린 쪽 dmgType**
     *
     * ★★★ `s` 는 2026-08-07 에 붙었다. 그 전에는 렌더가 `findEntity(e.a)` 로 **맞은 쪽**을
     *   찾아 그 `dmgType` 으로 숫자 색을 골랐다 — 지휘관의 물리 평타가 술식 적 위에서
     *   파란 숫자로 떴다. `c` 는 반드시 **레인**이다 (x 좌표가 아니다 — `spells.js` 가
     *   4개월 동안 x·y 를 보내고 있었고, 그래서 주문의 "약점!/저항!" 이 한 번도 뜨지 않았다).
     */
    DAMAGE: 3,
    DEATH: 4,
    BREACH: 5,
    TEMPO_SHIFT: 6,
    WAVE_START: 7,
    PROJECTILE_SPAWN: 8,
    PROJECTILE_HIT: 9,
    COMMANDER_DOWN: 10,
    COMMANDER_UP: 11,
    HEAL: 12,
    SIGIL_DRAFT: 13,
    SIGIL_TAKEN: 14,
    EVOLUTION: 15,

    // ── 전투 모드 (GDD §4.8) ──
    // ★★ 16–19 는 **비워 둔다.** 버티기·돌파·호위 이벤트였고 2026-08-04 경량화로
    //   사라졌지만, 번호를 당기면 저장된 리플레이·로그의 같은 숫자가 다른 사건을
    //   가리키게 된다 (아래 SPELL_CAST 주석과 같은 이유).
    MODE_BOSS_SPAWN: 20,
    MODE_BOSS_DEAD: 21,

    // ── 보스 페이즈 (P6-05) ──
    /** a=id b=다음페이즈(1-based) c=총페이즈 d=예고ms s=defId */
    MODE_BOSS_PHASE_TELEGRAPH: 22,
    /** a=id b=페이즈(1-based) c=총페이즈 d=새 태그마스크 s=defId */
    MODE_BOSS_PHASE: 23,
    /** a=id b=레인 c=x d=반경 s=defId — 착탄 예고 */
    MODE_BOSS_TELEGRAPH: 24,
    /** a=id b=레인 c=x d=반경 s=defId — 착탄 */
    MODE_BOSS_SLAM: 25,

    // ── 지휘관 주문 ──
    // ★ 번호는 **덧붙이기만** 한다. 중간에 끼워 넣으면 저장된 리플레이·로그의
    //   같은 숫자가 다른 사건을 가리키게 된다.
    /** a=대상레인 b=지휘관x c=영향받은 대상 수 s=주문id — 지휘관 주문 발동 */
    SPELL_CAST: 26,
    /** a=대상id b=레인 c=지휘관x — 지휘관 평타 (docs/02-design/20-commander-combat.md) */
    COMMANDER_ATTACK: 27,

    // ── 나이트메어 (docs/02-design/22-nightmare.md) ──
    // ★ 여기도 **덧붙이기만** 한다. 위 SPELL_CAST 주석과 같은 이유다.
    //
    // ★★ 세 규칙은 **이벤트를 아낀다.** 26 §12 의 하드 게이트가 틱당 이벤트
    //   p99 ≤ 24 이고 1-9 는 이미 DAMAGE 만으로 틱당 최대 17개다. 그래서
    //   역병 장판은 **피해에 이벤트를 내지 않고** 슬롯의 상태 변화만 낸다.
    /** a=슬롯인덱스 b=레인 c=x d=1생성/0만료 — 역병 장판 슬롯 상태 변화 */
    NIGHTMARE_ZONE: 28,
    /** a=적id b=레인 c=x d=예고ms s=defId — 결박 파열 예고 (보스 슬램과 같은 규약) */
    NIGHTMARE_BOND_TELEGRAPH: 29,
    /** a=적id b=레인 c=x s=defId — 결박 파열. 개체당 정확히 한 번 */
    NIGHTMARE_BOND_BREAK: 30,
};

/**
 * `EV.DEATH` 의 `d` 필드 — **왜 사라졌는가.**
 *
 * ★ 이 구분이 없으면 보스 처치 후 잔챙이 정리(`modes.js:despawnAdds`)가
 *   도감의 **처치 수를 부풀린다.** 잡지 않은 적을 잡았다고 기록하는 것은
 *   숫자가 틀리는 문제가 아니라 플레이어에게 거짓말을 하는 문제다.
 */
export const DEATH_CAUSE = {
    /** 체력이 0 이 되어 죽었다 */
    KILLED: 0,
    /** 규칙에 의해 필드에서 사라졌다 (처치가 아니다) */
    DESPAWNED: 1,
};

/**
 * 이벤트 객체 풀 — 슬롯을 재사용해 GC 를 피한다.
 *
 * `epoch` 는 큐가 비워진 횟수다. 소비자(렌더러)가 "지금 보고 있는 큐 내용이
 * 지난번에 본 것과 같은 세대인가"를 판별하는 유일한 수단이다 — 자세한 이유는
 * `createEventReader` 주석 참조.
 */
export function createEventQueue(capacity = 512) {
    const pool = new Array(capacity);
    for (let i = 0; i < capacity; i++) {
        pool[i] = { type: 0, a: 0, b: 0, c: 0, d: 0, s: "" };
    }
    return { pool, length: 0, capacity, epoch: 0 };
}

/**
 * 이벤트를 큐에 넣는다. 용량을 넘으면 조용히 버린다
 * (연출 누락이 프레임 드랍보다 낫다).
 */
export function emit(q, type, a = 0, b = 0, c = 0, d = 0, s = "") {
    if (q.length >= q.capacity) return null;
    const e = q.pool[q.length++];
    e.type = type;
    e.a = a;
    e.b = b;
    e.c = c;
    e.d = d;
    e.s = s;
    return e;
}

/** 매 틱 시작 시 호출 — 할당 없이 비운다 */
export function resetQueue(q) {
    q.length = 0;
    q.epoch++;
}

/** 렌더가 소비할 때 사용 (0..length-1 만 유효) */
export function forEachEvent(q, fn) {
    for (let i = 0; i < q.length; i++) fn(q.pool[i]);
}

/* ══════════════════════════════════════════════════════════════
 * 소비 커서 (P8 회귀 수정)
 * ══════════════════════════════════════════════════════════════ */

/**
 * 이벤트 소비 커서. 렌더러가 **하나씩** 들고 있는다.
 *
 * ─── 왜 필요한가 ────────────────────────────────────────────────
 * 큐는 `step()` 첫머리에서만 비워진다. 그런데 시뮬을 재개시키는 진입점은
 * `step()` 하나가 아니다 — `chooseSigil()` 도 같은 큐에 SIGIL_TAKEN·EVOLUTION 을
 * **append** 한다. 그리고 드래프트는 `stepWaves()` 안에서 열리므로,
 * 드래프트가 열린 틱의 이벤트(SPAWN/ATTACK/DAMAGE/DEATH/TEMPO_SHIFT)는
 * 그 틱이 끝날 때까지 계속 쌓인 채 큐에 **남는다**.
 *
 * 소비자가 매번 0 번부터 훑으면 각인을 고르는 순간 그 직전 틱 전체가
 * 재실행된다. 실제 피해: SPAWN 재실행 → 스프라이트 맵 덮어쓰기로 유령 유닛,
 * DEATH 재실행 → 도감 처치 수 2배, TEMPO_SHIFT 재실행 → 히트스톱 재발동.
 * (18스테이지 × 12시드 헤드리스 재현: 드래프트 1,971회 중 639회 = 32.4%)
 *
 * ─── 왜 '커서만' 으로는 부족한가 ────────────────────────────────
 * `q.length` 는 매 틱 0 으로 되돌아가므로, 커서만 들고 있으면
 * "큐가 리셋됐다"와 "이번 틱은 이벤트가 적다"를 구분할 수 없다.
 * (직전 5개 소비 → 커서 5, 다음 틱 8개 방출 → 앞의 5개를 통째로 놓친다)
 * 그래서 큐가 세대(epoch)를 세고, 커서는 세대가 바뀌면 0 으로 되돌아간다.
 *
 * ─── 왜 `chooseSigil()` 안에서 큐를 비우지 않는가 ───────────────
 * 그 방법도 이 증상은 없앤다. 채택하지 않은 이유는 두 가지다.
 *   1. 렌더 사정(“소비자가 두 번 읽는다”)을 이유로 시뮬 진입점의 동작을
 *      바꾸는 것이 된다. logic/ 은 소비자가 무엇을 어떻게 읽는지 몰라야 한다.
 *   2. 앞으로 큐에 append 하는 시뮬 진입점이 하나 늘 때마다 같은 버그가
 *      다시 생긴다. "리셋을 잊지 않기"를 규율로 유지하는 대신,
 *      **소비 측에서 '각 이벤트를 정확히 한 번' 을 구조적으로 보장한다.**
 *
 * epoch 는 결정론에 영향을 주지 않는다 — 시뮬 수학은 큐를 읽지 않는다.
 */
export function createEventReader() {
    // epoch -1: 어떤 큐의 0세대와도 다르므로 첫 drain 은 반드시 0 부터 읽는다
    return { epoch: -1, cursor: 0 };
}

/**
 * 아직 소비하지 않은 이벤트만 넘긴다. 호출마다 힙 할당이 없어야 하므로
 * `fn` 은 **미리 만들어 둔** 함수를 넘긴다 (절대규칙 7).
 *
 * @param {ReturnType<createEventQueue>} q
 * @param {ReturnType<createEventReader>} r
 * @param {(e: object) => void} fn
 */
export function drainEvents(q, r, fn) {
    if (r.epoch !== q.epoch) {
        r.epoch = q.epoch;
        r.cursor = 0;
    }
    // 커서를 먼저 올린다 — fn 이 재진입해도 같은 이벤트를 두 번 주지 않는다
    while (r.cursor < q.length) fn(q.pool[r.cursor++]);
}
