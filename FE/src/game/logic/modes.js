/**
 * 전투 모드 규칙 (GDD §4.8)
 *
 * ★ 모드는 난이도가 아니라 **승리 조건**을 바꾼다.
 *
 * | 모드     | 승리           | 패배      |
 * |----------|----------------|-----------|
 * | assault  | 전 웨이브 격퇴 | 방주 HP 0 |
 * | nemesis  | 보스 처치      | 방주 HP 0 |
 *
 * ★★ **2026-08-04 경량화 — 모드는 둘로 줄었다.**
 *   버티기(endure) · 돌파(breakthrough) · 호위(escort) 를 걷어냈다. 셋은 각각
 *   별도의 승리 조건 · 별도의 HUD · 별도의 렌더 대상(수레 · 균열)을 요구했고,
 *   플레이어 입장에서는 "스테이지에 들어가 봐야 규칙을 아는" 학습 비용이었다.
 *   해당 25 스테이지는 assault 로 내렸다 (`tools/`, `stages.json`).
 *
 *   **nemesis 는 남긴다.** 그것은 규칙 변주가 아니라 월드의 마침표이고,
 *   보스 3페이즈는 이 게임에서 가장 값싸게 얻은 연출이다 (boss.js).
 *
 * ★ 이 파일도 logic/ 규칙을 따른다 — Phaser · DOM · Math.random · Date.now 없음.
 *
 * @see docs/02-design/10-GDD.md §4.8
 */
import { TOTAL_LANES } from "./state.js";
import { emit, EV } from "./events.js";
import { initBossState, attachBoss, detachBoss } from "./boss.js";

export const MODE = {
    ASSAULT: "assault",
    NEMESIS: "nemesis",
};

/**
 * 전투 시작 시 모드별 상태를 세운다.
 * ★ createSim 이 부르며, 여기서만 modeState 를 만든다.
 *   이후 스텝 함수들은 필드를 추가하지 않는다 (히든 클래스 고정).
 */
export function initModeState() {
    // ★ 두 모드가 **같은 필드 집합**을 갖는다. 모드별로 필드를 빼면
    //   히든 클래스가 갈라진다.
    return {
        /** 살아 있는 보스 엔티티 id. -1 이면 아직 등장 전 */
        bossId: -1,
        bossDead: false,
        /** 보스가 방주에 닿았다 = 패배 (noteBossBreach) */
        bossBreached: false,
        /** 보스 사망 후 잔챙이 정리를 이미 했는가 (despawnAdds — 한 판에 한 번) */
        addsDespawned: false,
        /** 보스 페이즈 런타임 (P6-05) */
        boss: initBossState(),
    };
}

/* ── 보스 ───────────────────────────────────────────────────── */

/** 스폰된 적이 이 스테이지의 보스인가 (spawn.js 가 부른다) */
export function noteBossSpawn(s, e, def) {
    if (s.mode !== MODE.NEMESIS) return;
    if (s.modeState.bossId !== -1) return;
    if (!def.giant) return;
    s.modeState.bossId = e.id;
    emit(s.events, EV.MODE_BOSS_SPAWN, e.id, e.lane, 0, 0, def.id);
    // 페이즈 데이터가 있으면 보스 시스템을 켠다 (없으면 그냥 큰 적이다)
    attachBoss(s, e, def);
}

/** 보스가 죽었는가 (lifecycle.reap 이 부른다) */
export function noteBossDeath(s, e) {
    if (s.mode !== MODE.NEMESIS) return;
    if (e.id !== s.modeState.bossId) return;
    s.modeState.bossDead = true;
    detachBoss(s);
    emit(s.events, EV.MODE_BOSS_DEAD, e.id);
}

/**
 * ★★ 보스가 방주에 닿았다 (lifecycle.stepBreach 가 부른다) — **패배다.**
 *
 *   stepBreach 는 방주에 닿은 적을 **필드에서 제거한다.** 보스에게도 그대로
 *   적용되므로, 보스가 방어선을 지나쳐 걸어가면 필드가 텅 비고
 *   "전 웨이브 격퇴 = 승리"(clearAllWavesWins)가 발동해 **보스를 못 잡았는데
 *   승리가 뜬다.** P6-06 에서 보스를 실제로 위협적인 수치로 올리자마자
 *   전 보스 스테이지가 이 경로로 100% 승리했다 (실측: 20/20 이 '방주 도달 승리').
 *
 *   즉 보스를 강하게 만들수록 쉬워지는 역전이 일어난다 — 난이도 곡선이
 *   아예 반대로 뒤집힌다. 방주 HP 를 30 남짓 깎고 사라지는 것이
 *   '보스를 놓친' 대가일 수는 없다.
 *
 *   modes.test.js 는 이미 "보스전 승리 ⇒ bossDead" 를 단언하고 있었다.
 *   여기는 그 계약을 데이터가 아니라 **규칙으로** 지키는 자리다.
 */
export function noteBossBreach(s, e) {
    if (s.mode !== MODE.NEMESIS) return;
    if (e.id !== s.modeState.bossId) return;
    s.modeState.bossBreached = true;
    detachBoss(s);
}

/* ── 승패 판정 ──────────────────────────────────────────────── */

/**
 * 모드별 승패.
 * @returns {"victory"|"defeat"|null} null 이면 계속 진행
 *
 * ★ 방주 HP 0 은 모든 모드 공통 패배다. 그건 stepWinLose 가 먼저 본다.
 */
export function checkModeWinLose(s) {
    if (s.mode !== MODE.NEMESIS) return null;
    // 보스를 놓치면(방주 도달) 그 자리에서 패배다 — noteBossBreach 참조.
    if (s.modeState.bossBreached) return "defeat";
    return s.modeState.bossDead ? "victory" : null;
}

/**
 * 모드가 "전 웨이브 격퇴"를 승리로 인정하는가.
 *
 * ★ 지금은 두 모드 다 인정한다 (보스전은 보스까지 다 죽였다는 뜻이다).
 *   그래도 함수를 남기는 이유는 `checkModeWinLose` 와 짝을 이루는 계약이기
 *   때문이다 — 새 모드를 넣는 날 여기를 고치지 않으면 그 모드는 웨이브만
 *   막아도 이겨 버린다.
 */
export function clearAllWavesWins(mode) {
    return mode === MODE.ASSAULT || mode === MODE.NEMESIS;
}

/**
 * 보스 사망 시 잔챙이를 정리한다.
 *
 * ★★★ **이 함수는 2026-08-05 까지 아무도 부르지 않았다.**
 *   `balance.json:modes.nemesis.addsDespawnOnBossDeath` 는 `true` 였고
 *   `stageConfig.js:buildModeParams` 가 그 값을 `modeParams` 로 옮겨 놓기까지 했는데,
 *   호출부가 없어서 **보스를 잡아도 졸개가 화면에 그대로 남았다.**
 *   위 §checkModeWinLose 주석이 약속한 "잔챙이를 다 정리할 필요가 없다"의
 *   나머지 절반이 빠져 있었던 셈이다 — 승리는 즉시 나는데 화면은 정리되지 않았다.
 *
 * ★ **전투 결과는 바뀌지 않는다.** `sim.js` 의 스텝 순서상 보스가 죽은 그 틱에
 *   `stepWinLose` 가 곧바로 승리를 확정하므로, 남은 졸개는 어차피 한 번도 더
 *   행동하지 못했다. 이것은 연출(잔상 제거)의 문제이지 밸런스의 문제가 아니다.
 *
 * ★ 한 판에 한 번만 돈다 (`addsDespawned`). 승리 확정 후에도 틱이 도는 경로가
 *   생기면 매 틱 전 레인을 훑게 된다.
 *
 * @param {object} s
 * @param {(s:object, e:object, lane:number, idx:number) => void} releaseFn
 *   레인 배열에서 빼고 풀에 반납하는 함수 — 이벤트 발행은 호출부의 책임이다
 *   (`logic/` 은 렌더를 모른다는 규약을 지키기 위해 여기서 emit 하지 않는다).
 * @returns {number} 정리한 적의 수
 */
export function despawnAdds(s, releaseFn) {
    if (s.mode !== MODE.NEMESIS) return 0;
    if (!s.modeState.bossDead || s.modeState.addsDespawned) return 0;
    if (!s.cfg.modeParams?.addsDespawnOnBossDeath) return 0;

    s.modeState.addsDespawned = true;
    let n = 0;
    for (let li = 0; li < TOTAL_LANES; li++) {
        const enemies = s.lanes[li].enemies;
        for (let i = enemies.length - 1; i >= 0; i--) {
            releaseFn(s, enemies[i], li, i);
            n++;
        }
    }
    return n;
}
