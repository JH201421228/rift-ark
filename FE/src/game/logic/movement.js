/**
 * 이동 · 블로킹
 *
 * ★ BLOCKER 역할만 적의 전진을 막는다.
 *   나머지 근접 유닛은 사거리 안의 적을 때리지만 통과를 막지 못한다.
 *   → **탱커 없이 딜러만 편성하면 적이 그냥 걸어서 방주까지 온다.**
 *   이것이 이 게임의 구조적 심장이다 (명일방주 모델).
 *
 * ★ FLYING 은 블로킹되지 않는다.
 *
 * @see docs/02-design/11-core-loop.md §3.3
 */
import { LANE_COUNT, AIR_LANE, TOTAL_LANES, resortLane } from "./state.js";
import { TICK_MS } from "./tick.js";
import { TAG } from "./tags.js";
import { effectiveBlockCount } from "./aura.js";
import { canTarget } from "./combat.js";
import { runHooks, HOOK } from "./sigils.js";
import { emit, EV } from "./events.js";
import { commanderUp } from "./commanderHit.js";

/**
 * 아군이 적 앞에서 멈추는 간격(px).
 * ★ 0 으로 두면 스프라이트가 정확히 겹쳐 누가 누구인지 안 보인다.
 */
const CONTACT_GAP = 24;

/** 훅 컨텍스트 재사용 */
const hookCtx = { entity: null, target: null, blocker: null, projectile: null };

/**
 * **뒤로 돌아서지 않는 역할.**
 *
 * ★ `SUPPORT` 는 적을 쫓는 존재가 아니다 — 뒤로 새어 나간 적을 향해 달려가면
 *   힐러가 적진 한가운데로 걸어 들어간다. 전열을 따라가는 지금 동작이 맞다.
 * ★ `BLOCKER` 는 붙들고 있을 때만 자리를 지킨다(아래 `u.blocking` 검사).
 *   아무도 안 붙들고 있으면 새어 나간 적을 막으러 돌아서는 것이 옳다.
 */
const HOLDS_LINE = { SUPPORT: 1 };

/**
 * 블로킹 관계를 매 틱 재계산한다.
 * 블로커가 죽거나 적이 지나가면 자동으로 풀린다.
 */
/**
 * 이 레인에서 id 로 블로커를 찾는다. 죽었거나 블로커가 아니면 null.
 * ★ 레인당 아군은 한 자릿수라 선형 탐색이 맵보다 싸다 (할당 0).
 */
function findBlocker(allies, id) {
    for (let i = 0; i < allies.length; i++) {
        const a = allies[i];
        if (a.id !== id) continue;
        return a.role === "BLOCKER" && a.hp > 0 ? a : null;
    }
    return null;
}

/**
 * 블로킹 관계를 매 틱 갱신한다.
 *
 * ★★★ **이미 붙든 적을 놓지 않는다** (2026-08-04 수정 — 실제 제보 "방벽을 간헐적으로
 *   넘어가는 적이 있다").
 *
 *   예전에는 매 틱 `blockedBy` 를 전부 지우고 **가까운 순으로 다시** 배정했다.
 *   용량 2 에 적이 4 이면 이런 일이 벌어진다:
 *
 *     t   붙잡힌 적      풀려난 적
 *     ─────────────────────────────────
 *     852  #10 #11       #12 #13   ← 풀려난 둘이 이 틱에 **전진**한다
 *     853  #12 #13       #10 #11   ← 그래서 다음 틱엔 그 둘이 더 가까워 이긴다
 *     854  #10 #11       #12 #13   ← 무한 교대
 *
 *   붙잡힌 적만 멈추므로(`stepMovement`), 넷 **전부가** 절반 속도로 계속 다가온다.
 *   "블록 슬롯이 남아 있으면 정지"(11-core-loop.md §3.3)가 지켜지지 않았다.
 *   1초쯤 지나면 무리 전체가 `blockMinGap`(20) 바로 위에 뭉치고, 그 뒤로는 새 적이
 *   올 때마다 **붙잡혀 있던 적**이 20 아래로 밀려 영구히 못 잡는 적이 된다 —
 *   그것이 화면에서 "방벽을 그냥 통과했다"로 보인다.
 *   (자동 플레이 21회 표본에서 방벽 통과 88건 중 9건은 **슬롯이 비어 있는데도** 통과했다.)
 *
 * ★ 그래서 두 단계로 나눈다: ① 성립한 관계를 먼저 지키고 ② 남은 슬롯만 새로 채운다.
 *   결과는 설계 그대로다 — **용량만큼은 확실히 멈추고, 넘치는 만큼만 지나간다.**
 */
export function stepBlocking(s) {
    const cfg = s.cfg;
    /** 방벽이 적을 붙들 수 있는 최소 간격 — 겹쳐 서는 것을 막는다 */
    const minGap = cfg.combat?.blockMinGap ?? 20;
    /**
     * 나이트메어 ② 결박 파열 (docs/02-design/22-nightmare.md §3).
     * ★ 규칙이 안 걸린 전투에서는 `null` 이고, 아래 두 자리에서 비교 하나가 늘 뿐이다.
     */
    const bond = cfg.nightmare?.id === "bond_break" ? cfg.nightmare : null;

    for (let li = 0; li < LANE_COUNT; li++) {
        const { allies, enemies } = s.lanes[li];

        // 블록 슬롯 초기화 (관계는 지우지 않는다 — ①에서 검증한다)
        for (let i = 0; i < allies.length; i++) allies[i].blocking = 0;

        if (!allies.length || !enemies.length) {
            // 붙들 사람이 아무도 없으면 관계를 끊는다. 남겨 두면 유령 블록이 된다.
            for (let i = 0; i < enemies.length; i++) enemies[i].blockedBy = -1;
            continue;
        }

        /**
         * ── ① 이미 성립한 블록을 **먼저** 갱신한다 (스티키)
         *
         * ★ 여기서는 `minGap` 을 보지 않는다. 붙잡힌 적은 움직이지 않으므로 스스로
         *   파고들 수 없고, 블로커가 전진해 간격이 좁아졌다는 이유로 놓아주면
         *   그 적은 **영구히 못 잡는 적**이 되어 그대로 방주까지 간다.
         *   `minGap` 은 '새로 잡을 때'의 규칙이지 '계속 잡고 있을 때'의 규칙이 아니다.
         *
         * ★ 적은 x 오름차순이라, 용량이 줄었을 때 **가까운 적부터** 슬롯을 지킨다.
         */
        for (let ei = 0; ei < enemies.length; ei++) {
            const e = enemies[ei];
            if (e.blockedBy === -1) continue;
            const b = findBlocker(allies, e.blockedBy);
            if (!b) {
                e.blockedBy = -1;
                continue;
            }
            const gap = e.x - b.x;
            // 블로커가 적을 지나쳐 갔거나(gap<=0) 사거리를 벗어났으면 놓는다
            if (gap <= 0 || gap > b.range || b.blocking >= effectiveBlockCount(b, cfg)) {
                e.blockedBy = -1;
                continue;
            }

            /**
             * ★★ **붙잡혀 있는 틱만 센다.** 고정 틱의 누적이므로 부동소수 누적이
             *   아니라 같은 연산의 반복이고, 그래서 같은 시드가 같은 결과를 낸다.
             *   노멀·하드에서도 세지만 아무도 읽지 않는다 (`bond` 가 null 이다).
             */
            const held = e.blockedMs;
            e.blockedMs = held + TICK_MS;

            if (bond) {
                /**
                 * ★★★ **파열은 개체당 한 번, 되돌릴 수 없는 상태 전이다.**
                 *   재붙잡기를 허용하면 2026-08-04 에 고친 결함이 그대로 재발한다:
                 *   매 틱 관계가 붙었다 풀렸다 하면서 **무리 전체가 절반 속도로**
                 *   계속 전진하고, 결국 "방벽을 간헐적으로 넘어간다"가 된다.
                 *   `unbindable` 이 되면 아래 ② 가 이 적을 아예 보지 않으므로
                 *   진동할 상태 자체가 없다.
                 *
                 * ★ 스티키 블록을 부정하지 않는다 — 종료 조건이 하나(시간) 늘 뿐이고
                 *   그 조건은 시간의 단조 함수라 되돌아오지 않는다.
                 */
                if (held < bond.holdMs && e.blockedMs >= bond.holdMs) {
                    e.blockedBy = -1;
                    e.unbindable = true;
                    e.speed *= bond.postBreakSpeedMult;
                    emit(s.events, EV.NIGHTMARE_BOND_BREAK, e.id, li, Math.round(e.x), 0, e.defId);
                    continue; // 이 틱부터 블로커의 슬롯을 먹지 않는다
                }
                /**
                 * 예고 — 경계를 정확히 넘는 틱에 한 번만 낸다.
                 * ★ 플래그를 따로 두지 않는다. `blockedMs` 는 붙잡힌 틱마다 정확히
                 *   `TICK_MS` 씩만 늘어나므로 경계 통과는 한 번뿐이다 (개체당 최대 2회).
                 */
                const at = bond.holdMs - bond.telegraphMs;
                if (held < at && e.blockedMs >= at) {
                    emit(
                        s.events,
                        EV.NIGHTMARE_BOND_TELEGRAPH,
                        e.id,
                        li,
                        Math.round(e.x),
                        bond.telegraphMs,
                        e.defId
                    );
                }
            }

            b.blocking++;
        }

        // ── ② 남은 슬롯을 새 적으로 채운다 (블로커는 x 오름차순 유지됨)
        for (let ai = 0; ai < allies.length; ai++) {
            const b = allies[ai];
            if (b.role !== "BLOCKER") continue;
            const cap = effectiveBlockCount(b, cfg);
            if (cap <= 0) continue;

            // 이 블로커의 사거리 안에 있는 적을 앞에서부터 잡는다
            for (let ei = 0; ei < enemies.length && b.blocking < cap; ei++) {
                const e = enemies[ei];
                if (e.blockedBy !== -1) continue;
                if ((e.tags & TAG.FLYING) !== 0) continue; // 비행은 막히지 않는다
                // 나이트메어 ②: 결박을 끊은 적은 **어떤 블로커에게도** 다시 잡히지 않는다
                if (e.unbindable) continue;
                // ★★ 이미 파고든 적은 **뚫린 것으로 취급한다.**
                //   용량이 찬 동안 지나쳐 들어온 적을, 슬롯이 비는 순간
                //   방벽 위에 올라선 그 자리에서 붙들면 둘이 완전히 겹쳐 서고
                //   플레이어에게는 "적이 내 유닛을 통과했다"로 보인다 (실제 제보).
                //   뒤늦게 끌어당겨 잡는 것은 "용량을 넘기면 샌다"는 규칙 위반이기도 하다.
                if (e.x - b.x < minGap) continue;
                if (e.x - b.x > b.range) break; // 정렬되어 있으므로 이후는 더 멀다
                e.blockedBy = b.id;
                b.blocking++;

                /**
                 * 각인: 블록이 **성립하는 순간에만** 발동한다.
                 * ★ 여기 오는 적은 `blockedBy === -1` 이었던 적뿐이므로 새 블록이 맞다.
                 *   예전에는 `const wasBlocked = e.blockedBy !== -1` 로 판정했는데,
                 *   바로 위에서 `!== -1` 이면 `continue` 했으므로 **항상 false** 였다 —
                 *   죽은 가드였고, onBlock 훅을 쓰는 각인이 생기면 초당 30회 터졌을 것이다.
                 */
                if (s.hooks.onBlock.length) {
                    hookCtx.blocker = b;
                    hookCtx.target = e;
                    runHooks(s, HOOK.ON_BLOCK, hookCtx);
                    hookCtx.blocker = null;
                    hookCtx.target = null;
                }
            }
        }
    }
}

/**
 * 이동. 아군은 +x, 적은 -x.
 * 교전 중이거나 블록당한 유닛은 멈춘다.
 */
export function stepMovement(s) {
    const dt = TICK_MS / 1000;
    const arkX = s.cfg.arkX;
    const riftX = s.cfg.riftX;

    for (let li = 0; li < TOTAL_LANES; li++) {
        const lane = s.lanes[li];

        // ── 아군: 오른쪽으로 전진 ──
        //
        // ★ 아군은 **자기가 때릴 수 있는 적을 지나쳐 전진하지 않는다.**
        //   engaged(사거리 안) 판정만으로 막으면, 서로 마주 보고 달릴 때
        //   교전 판정이 난 틱과 이동한 틱 사이에 두 유닛이 서로를 **통과**한다.
        //   실제로 근접 아군이 적을 때리지도 않고 지나쳐 균열까지 걸어갔다.
        //
        //   이것은 "적은 BLOCKER 에게만 멈춘다"는 구조와 충돌하지 않는다.
        //   **적의 이동은 그대로다** — 막는 것은 아군의 전진뿐이다.
        //   즉 적은 여전히 방벽이 아니면 통과하지만, 아군이 적을 등지고
        //   달아나지는 않는다.
        const allies = lane.allies;
        let ec = 0; // 적 배열 커서 (x 오름차순 → 전체 O(n+m))
        const enemiesForBlock = lane.enemies;
        for (let i = 0; i < allies.length; i++) {
            const u = allies[i];
            if (u.speed === 0) continue; // 고정 포탑(SIEGE 일부)
            if (u.engaged) continue; // 사거리 안에 적이 있으면 정지
            // ★ 붙들고 있는 방벽은 절대 움직이지 않는다 — 스티키 블록이 통째로 풀린다
            if (u.role === "BLOCKER" && u.blocking > 0) continue;

            while (ec < enemiesForBlock.length && enemiesForBlock[ec].x <= u.x) ec++;

            // 앞쪽(오른쪽)에서 가장 가까운, 때릴 수 있는 적
            let front = null;
            for (let k = ec; k < enemiesForBlock.length; k++) {
                if (canTarget(u, enemiesForBlock[k])) {
                    front = enemiesForBlock[k];
                    break; // 못 때리는 적(비행 등)은 통과해도 된다
                }
            }
            // 뒤쪽(왼쪽 · 방주 쪽)에서 가장 가까운, 때릴 수 있는 적
            let back = null;
            for (let k = ec - 1; k >= 0; k--) {
                if (canTarget(u, enemiesForBlock[k])) {
                    back = enemiesForBlock[k];
                    break;
                }
            }

            /**
             * ★★★ **뒤로 도는 조건은 "앞에 아무도 없을 때" 하나뿐이다.**
             *
             *   "가까운 쪽으로 간다"로 만들면 전열의 아군이 뒤로 샌 적 하나를 쫓아
             *   **전선을 통째로 비운다.** 그러면 방벽 없는 편성도 뛰어다니며 버티게
             *   되어 게이트 B16("적은 BLOCKER 에게만 멈춘다")이 무너진다 —
             *   실측으로 무방벽 잔여 HP 가 기준선의 70% 상한을 넘어 72.5% 가 됐다.
             *   그 게이트는 이 게임의 구조적 심장이므로 규칙을 좁힌다.
             *
             *   좁혀도 제보 ①⑥ 은 그대로 해결된다 — 그 상황의 정의가
             *   "앞에는 아무도 없고 뒤의 적은 사거리 밖"이기 때문이다.
             */
            let next;
            if (!front && back && !HOLDS_LINE[u.role]) {
                // ★★ **뒤로 돌아선다** (2026-08-05 제보 ⑥).
                //   균열까지 걸어간 아군이 자기를 지나쳐 간 적을 향해 돌아서지 않아,
                //   그 적은 **아무 저항 없이 방주까지 걸어갔다.** 그리고 그 아군은
                //   사거리 밖의 적을 영원히 못 만나 "아무 공격도 하지 않는" 상태가 됐다
                //   (제보 ①과 같은 뿌리다 — 타겟 선정은 양방향인데 **이동이 단방향**이었다).
                //
                // ★ 진동하지 않는다: 가까운 쪽으로 다가가면 그쪽이 더 가까워지고,
                //   사거리에 들어오면 `engaged` 로 즉시 멈춘다.
                const limit = back.x + CONTACT_GAP;
                next = Math.max(limit, u.x - u.speed * dt);
                if (next > u.x) next = u.x; // 이미 붙어 있으면 제자리
            } else {
                next = u.x + u.speed * dt;
                if (front) {
                    const limit = front.x - CONTACT_GAP;
                    if (next > limit) next = Math.max(u.x, limit);
                }
            }

            u.x = next;
            if (u.x > riftX) u.x = riftX;
            if (u.x < arkX) u.x = arkX;
        }

        // ── 적: 왼쪽으로 전진 ──
        // ★ 적은 **BLOCKER 에게만** 멈춘다.
        //   교전(engaged) 여부로 멈추게 하면 원거리·술사도 사실상 블로커가 되어
        //   "방벽 없으면 적이 그냥 걸어서 방주까지 온다"는 구조적 심장이 무너진다.
        //   적은 아처를 때리면서도 계속 걸어간다.
        const enemies = lane.enemies;
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            /**
             * ★★ **오라 안 SIEGE 의 밀어냄** (`aura.js:applyAuraOnHit`).
             *   위치를 바꾸는 곳은 이 스텝 하나뿐이다 — 명중 시점에 밀면 레인 배열의
             *   x 정렬이 틱 중간에 깨지고, 다음 틱의 병합 스윕이 잘못된 이웃을 본다.
             *
             * ★ 붙들린 적은 **밀리지 않고 쌓인 값도 버린다.** 남겨 두면 방벽이 죽는
             *   순간 그 적이 한꺼번에 튀어 오른다. 그리고 `applyAuraOnHit` 이 애초에
             *   붙들린 적에게는 쌓지 않는다 — 여기는 '붙들리기 직전에 쌓인 값'을
             *   버리는 자리다.
             */
            if (e.blockedBy !== -1) {
                e.pushX = 0;
                continue; // 블로커에 막힘
            }
            if (e.pushX > 0) {
                e.x = Math.min(riftX, e.x + e.pushX);
                e.pushX = 0;
            }
            if (s.t < (e.frozenUntil ?? 0)) continue; // 각인: 빙결

            // 각인: 오라 냉기 · 둔화
            let speed = e.speed;
            if (s.mods.auraSlow > 0 && isInAura(s, e)) speed *= 1 - s.mods.auraSlow;
            if (s.t < (e.slowUntil ?? 0)) speed *= 0.7;

            e.x -= speed * dt;
            if (e.x < arkX) e.x = arkX;
        }

        // 이동 후 정렬 복구 (거의 정렬된 배열 → 삽입 정렬이 O(n) 에 가깝다)
        resortLane(allies);
        resortLane(enemies);
    }

    // 지휘관 이동
    const c = s.commander;
    if (commanderUp(s)) {
        const dx = c.targetX - c.x;
        const step = s.cfg.commanderSpeed * dt;
        if (Math.abs(dx) <= step) c.x = c.targetX;
        else c.x += Math.sign(dx) * step;
    }
}

/** 적이 지휘관 오라 안에 있는가 (각인 '오라 냉기'용) */
function isInAura(s, e) {
    const c = s.commander;
    if (!commanderUp(s)) return false;
    const laneY = s.cfg.laneY;
    const ey = e.lane === AIR_LANE ? s.cfg.airY : laneY[e.lane];
    const dx = e.x - c.x;
    const dy = ey - laneY[c.lane];
    return dx * dx + dy * dy <= c.auraRadius * c.auraRadius;
}

/** 공중 레인은 블로킹이 없으므로 별도 처리가 필요 없다 */
export const AIR = AIR_LANE;
