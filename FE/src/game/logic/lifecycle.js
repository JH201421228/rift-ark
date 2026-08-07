/**
 * 사망 · 방주 돌파 · 승패 판정
 *
 * ★ 태그별 미처치 수를 집계한다.
 *   이것이 패배 화면의 원인 진단("ARMORED 적 12체를 처치하지 못했습니다")의
 *   근거 데이터이며, "벽 = 편성 퍼즐" 설계를 실제로 작동시키는 장치다.
 *   진단이 없으면 상성 시스템은 전략이 아니라 그냥 벽이다.
 *
 * @see docs/02-design/18-ux-ui.md §2.6
 */
import { TOTAL_LANES, releaseEntity, removeFrom } from "./state.js";
import { TAG, maskToTags } from "./tags.js";
import { applyKillRefund } from "./resources.js";
import { emit, EV, DEATH_CAUSE } from "./events.js";
import { runHooks, HOOK } from "./sigils.js";
import { noteNightmareDeath } from "./nightmare.js";
import {
    checkModeWinLose,
    clearAllWavesWins,
    noteBossDeath,
    noteBossBreach,
    despawnAdds,
} from "./modes.js";

/** 훅 컨텍스트 재사용 */
const hookCtx = { entity: null, target: null, blocker: null, projectile: null };

export function stepDeaths(s) {
    for (let li = 0; li < TOTAL_LANES; li++) {
        const lane = s.lanes[li];
        reap(s, lane.allies, li);
        reap(s, lane.enemies, li);
    }
    /**
     * ★★ 보스가 죽었으면 잔챙이를 정리한다 (`modes.js:despawnAdds`).
     *   그 함수는 2026-08-05 까지 **호출부가 없었다** — 데이터
     *   (`modes.nemesis.addsDespawnOnBossDeath`)는 켜져 있는데 아무 일도 일어나지
     *   않아서, 보스를 잡은 화면에 졸개가 그대로 서 있었다.
     *
     * ★ reap 루프 **뒤**여야 한다. 루프 안에서 레인 배열을 통째로 비우면
     *   그 루프의 인덱스가 무너진다.
     */
    despawnAdds(s, despawnEnemy);
}

/**
 * 규칙에 의한 소멸 — **처치가 아니다.**
 * `stats.kills` 도 환급도 처치 훅도 타지 않는다. 렌더가 스프라이트를 지울 수
 * 있도록 DEATH 이벤트만 내보내되 `d` 로 사유를 구분한다 (`DEATH_CAUSE`).
 */
function despawnEnemy(s, e, lane, idx) {
    emit(s.events, EV.DEATH, e.id, lane, 0, DEATH_CAUSE.DESPAWNED, e.defId);
    s.lanes[lane].enemies.splice(idx, 1);
    removeFrom(s.actives, e);
    releaseEntity(s, e);
}

function reap(s, arr, lane) {
    for (let i = arr.length - 1; i >= 0; i--) {
        const e = arr[i];
        if (e.hp > 0) continue;

        emit(s.events, EV.DEATH, e.id, lane, e.isAlly ? 1 : 0, DEATH_CAUSE.KILLED, e.defId);

        if (!e.isAlly) {
            s.stats.kills++;
            applyKillRefund(s, e);
            noteBossDeath(s, e); // 모드(보스): 보스가 죽었는지 기록
            /**
             * 나이트메어 ①: 지상에서 **처치된** 적이 그 자리에 장판을 남긴다.
             * ★ 여기(= reap)에만 둔다. `despawnEnemy` 는 처치가 아니므로
             *   보스를 잡은 순간 잔챙이 수십이 한꺼번에 장판을 까는 일이 없다.
             * ★ 규칙이 안 걸린 전투에서는 첫 줄에서 그대로 돌아간다.
             */
            noteNightmareDeath(s, e, lane);

            // 각인: 처치 보상 (전리품·망자의 세금 등)
            if (s.hooks.onKill.length) {
                hookCtx.target = e;
                runHooks(s, HOOK.ON_KILL, hookCtx);
                hookCtx.target = null;
            }
        }

        arr.splice(i, 1);
        removeFrom(s.actives, e);
        releaseEntity(s, e);
    }
}

/** 방주 도달 — 적이 소멸하며 방주 HP 를 깎는다 */
export function stepBreach(s) {
    const arkX = s.cfg.arkX;

    for (let li = 0; li < TOTAL_LANES; li++) {
        const enemies = s.lanes[li].enemies;
        for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i];
            if (e.x > arkX + 4) continue;

            s.arkHp = Math.max(0, s.arkHp - e.breachDamage);
            s.stats.breaches++;
            // ★ 보스가 여기까지 왔다면 그 전투는 이미 진 것이다.
            //   제거하고 "적이 없으니 승리"로 넘기면 강한 보스일수록 쉬워진다.
            noteBossBreach(s, e);

            // 어떤 태그의 적을 못 막았는지 기록한다
            const names = maskToTags(e.tags & ~TAG.LIVING);
            for (const n of names) {
                s.stats.unkilledByTag[n] = (s.stats.unkilledByTag[n] ?? 0) + 1;
            }

            emit(s.events, EV.BREACH, e.id, e.breachDamage, li, s.arkHp);

            enemies.splice(i, 1);
            removeFrom(s.actives, e);
            releaseEntity(s, e);
        }
    }
}

/** 지휘관 기절 — 사망이 아니라 8초 재출격. 오라 상실 자체가 페널티다. */
export function stepCommander(s) {
    const c = s.commander;
    if (c.hp > 0 || s.t < c.downUntil) return;

    if (c.hp <= 0 && c.downUntil === 0) {
        c.downUntil = s.t + s.cfg.commanderRespawnMs;
        c.x = s.cfg.arkX + 120;
        c.targetX = c.x;
        emit(s.events, EV.COMMANDER_DOWN, Math.round(c.downUntil));
        return;
    }
    if (c.downUntil > 0 && s.t >= c.downUntil) {
        c.hp = c.hpMax;
        c.downUntil = 0;
        emit(s.events, EV.COMMANDER_UP);
    }
}

/**
 * 승패. 전투는 반드시 종료되어야 한다 (무한 루프 없음).
 *
 * ★ 순서가 규칙이다.
 *   ① 방주 HP 0 은 모든 모드 공통 패배 — 무엇보다 먼저 본다.
 *   ② 모드 고유 조건 (버티기 시간 · 균열 파괴 · 수레 · 보스).
 *   ③ 전 웨이브 격퇴는 **격퇴·보스전에서만** 승리다.
 *     버티기·돌파·호위에서 웨이브를 다 막았다고 끝내버리면 모드가 사라진다.
 */
export function stepWinLose(s) {
    if (s.arkHp <= 0) {
        s.phase = "defeat";
        return;
    }

    const modeResult = checkModeWinLose(s);
    if (modeResult) {
        s.phase = modeResult;
        return;
    }

    if (!clearAllWavesWins(s.mode)) return;

    if (s.wave < s.waveTotal) return;
    if (s.pendingSpawns.length > 0) return;

    // 남은 적이 없으면 승리
    for (let li = 0; li < TOTAL_LANES; li++) {
        if (s.lanes[li].enemies.length > 0) return;
    }
    s.phase = "victory";
}

/**
 * 스테이지 하나가 줄 수 있는 최대 별.
 *
 * ★ `computeStars` 가 실제로 만들 수 있는 상한이고, 화면(결과·출격)과
 *   해금 감사기가 같은 값을 봐야 한다. 사본이 세 벌 있었다 —
 *   `unlockAudit.js` 의 private 상수, `BattleResult.jsx` 의 `[0,1,2]`,
 *   그리고 출격 화면에는 아예 없었다.
 */
export const MAX_STARS = 3;

/**
 * 별 등급 산정.
 * ★1 클리어 / ★2 방주 무손실 / ★3 목표 시간 내
 *
 * ★ ★2 기준은 데이터(balance.stars.arkRatio)로 뺐다.
 *   90% 였을 때 달성률이 95% 로 나와 ★2 가 사실상 참가상이 됐다.
 *   별은 메타 성장의 화폐이므로, 아무나 다 받으면 경제가 무너진다.
 *   "한 마리도 통과시키지 않았다"는 읽기 쉽고 실제로 선택적인 기준이다.
 */
export function computeStars(s) {
    if (s.phase !== "victory") return 0;
    const t = s.cfg.stars ?? { arkRatio: 1, timeRatio: 1 };
    let stars = 1;
    if (s.arkHp >= s.arkHpMax * t.arkRatio) stars++;
    if (s.t <= s.cfg.targetTimeSec * 1000 * t.timeRatio) stars++;
    return stars;
}

/**
 * 패배 원인 진단 — 결과 화면이 이 문자열을 쓴다.
 * @returns {{tag: string|null, count: number}}
 */
export function diagnoseDefeat(s) {
    let worst = null;
    let worstCount = 0;
    const byTag = s.stats.unkilledByTag;
    // 결정론을 위해 키를 정렬해 순회한다
    for (const tag of Object.keys(byTag).sort()) {
        if (byTag[tag] > worstCount) {
            worstCount = byTag[tag];
            worst = tag;
        }
    }
    return { tag: worst, count: worstCount };
}
