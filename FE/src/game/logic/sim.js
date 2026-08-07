/**
 * 시뮬레이션 스텝
 *
 * ★ 서브스텝의 **순서 자체가 결정론의 일부다.** 함부로 재배치하지 않는다.
 *
 * ★ 이 파일과 같은 폴더의 모든 모듈은 Phaser 를 모르고, 실시간을 모르고,
 *   비결정적 난수를 쓰지 않는다 (ESLint 가 강제한다).
 *   여기서 결정론 · 밸런스 자동검증 · 리플레이 · 백그라운드 복귀 안전성이
 *   전부 나온다.
 *
 * @see docs/03-tech/22-simulation-spec.md §4
 */
import { TICK_MS } from "./tick.js";
import { resetQueue } from "./events.js";
import { stepSpellBuffs } from "./spells.js";
import { stepResources } from "./resources.js";
import { stepWaves } from "./spawn.js";
import { stepAura } from "./aura.js";
import { resetEngagement, stepCombat, stepRegen } from "./engage.js";
import { stepBlocking, stepMovement } from "./movement.js";
import { stepProjectiles } from "./projectiles.js";
import { stepDeaths, stepBreach, stepCommander, stepWinLose } from "./lifecycle.js";
import { stepCommanderAttack } from "./commanderAttack.js";
import { stepBoss } from "./boss.js";
import { stepNightmare } from "./nightmare.js";

import { applySigil, rollDraft } from "./sigils.js";
import { emit, EV } from "./events.js";

export { TICK_MS };
export { createSim } from "./state.js";
export { trySummon } from "./spawn.js";
export { computeStars, diagnoseDefeat } from "./lifecycle.js";
export { bossSnapshot } from "./boss.js";
export { applySigil, rollDraft, isDraftWave } from "./sigils.js";

/**
 * 전투가 **끝난** 상태인가.
 *
 * ★ 'draft' 는 전투를 *멈추는* 상태이지 *끝내는* 상태가 아니다.
 *   렌더러가 "battle 이 아니면 종료"로 판단하면 각인 드래프트가 열리는 순간
 *   전투가 패배로 끝나버린다 (실제로 그 버그가 있었다).
 *   판정을 문자열 비교로 각자 하지 않고 여기 한 곳에 둔다.
 */
export function isTerminalPhase(phase) {
    return phase === "victory" || phase === "defeat";
}

/**
 * 드래프트 선택을 확정한다. 시뮬이 다시 진행된다.
 * @param {object} s
 * @param {number} index 선택지 인덱스
 * @returns {string|null} 발생한 진화 id
 */
export function chooseSigil(s, index) {
    const draft = s.pendingDraft;
    if (!draft) return null;
    const opt = draft.options[index] ?? draft.options[0];
    if (!opt) return null;

    const evo = applySigil(s, opt.id);
    s.pendingDraft = null;
    s.draftsTaken++;
    s.phase = "battle";

    emit(s.events, EV.SIGIL_TAKEN, s.draftsTaken, 0, 0, 0, opt.id);
    if (evo) emit(s.events, EV.EVOLUTION, 0, 0, 0, 0, evo);
    return evo;
}

/**
 * 드래프트 리롤. 남은 횟수가 없으면 false.
 * ★ 메타 성장이 늘리는 것은 이 횟수와 선택지 수뿐이다 — 각인 수치가 아니다.
 */
export function rerollDraft(s) {
    if (!s.pendingDraft || s.rerollsLeft <= 0) return false;
    s.rerollsLeft--;
    s.pendingDraft = {
        options: rollDraft(s, s.cfg.draftOptions ?? 3),
        wave: s.pendingDraft.wave,
    };
    return true;
}

/**
 * 1틱 진행. 상태를 제자리에서 변경한다 (할당 최소화).
 *
 * ★ 플레이어 입력은 반드시 `applyInputs` 콜백으로 넘긴다.
 *   틱 밖에서 trySummon() 을 호출하면 그 SPAWN 이벤트를 다음 step() 의
 *   resetQueue 가 지워버려 소환 연출이 통째로 사라진다.
 *   입력을 틱 경계에 정렬하는 것은 리플레이·비동기 PvP 고스트의 전제이기도 하다.
 *
 * @param {ReturnType<import('./state.js').createSim>} s
 * @param {(s: object) => void} [applyInputs] 큐 리셋 직후 실행된다
 */
export function step(s, applyInputs) {
    if (s.phase !== "battle") return s;

    s.tick++;
    s.t += TICK_MS;
    resetQueue(s.events);

    if (applyInputs) applyInputs(s); // 소환·주문 등 이번 틱의 입력

    stepResources(s); // 마나·균열력 재생, 소환 코스트 감쇠
    stepSpellBuffs(s); // 지휘관 주문 버프 만료 (stepCombat 앞이어야 스탯이 맞다)
    stepWaves(s); // 웨이브 스폰, 템포 시프트
    stepCommander(s); // 지휘관 기절/복귀
    stepAura(s); // inAura 플래그 갱신 (이후 전부 이 값을 읽는다)
    stepRegen(s); // REGEN 태그 회복
    resetEngagement(s);
    stepBlocking(s); // 블로킹 관계 재계산
    stepCombat(s); // 타겟 선정 · 공격 · 힐
    stepCommanderAttack(s); // 지휘관 평타 (stepCombat 과 같은 위상이어야 순서 의존이 없다)
    stepMovement(s); // 이동 + 정렬 복구
    stepProjectiles(s); // 발사체 이동 · 명중
    stepBoss(s); // 모드(보스): 페이즈 전환 · 슬램 예고/착탄 (stepDeaths 앞이어야 한다)
    /**
     * 나이트메어 ① 역병 장판 — 만료 · 0.5초 주기 피해.
     *
     * ★★ **`stepDeaths` 앞이다.** 설계 문서(22-nightmare.md P11-05)는 처음에 뒤로
     *   적었는데, 그러면 장판이 죽인 아군이 **다음 틱에 한 번 더 공격한다** —
     *   그 틱의 `stepCombat` 이 `stepDeaths` 보다 먼저이기 때문이다.
     *   앞에 두면 이번 틱의 `stepDeaths` 가 그대로 거둬 간다. 장판 생성은
     *   `stepDeaths` 안에서 일어나지만, 피해 판정 주기가 500ms 라 그 순서 차이가
     *   만드는 결과 차이는 없다 (문서를 이 순서로 고쳤다).
     */
    stepNightmare(s);
    stepDeaths(s); // 사망 처리 · 환급 · 배열 정리 (+ 나이트메어 ① 장판 생성)
    stepBreach(s); // 방주 도달
    stepWinLose(s); // 승패 판정

    return s;
}

/**
 * 전투를 끝까지 돌린다 (헤드리스 밸런스 하네스용).
 * @param {object} s
 * @param {(s: object) => void} [onTick] 입력 주입 훅. step 내부(큐 리셋 직후)에서 실행된다
 * @param {number} [maxSeconds]
 */
export function runToCompletion(s, onTick, maxSeconds = 400, draftPolicy) {
    const maxTicks = Math.ceil((maxSeconds * 1000) / TICK_MS);
    let n = 0;
    while ((s.phase === "battle" || s.phase === "draft") && n < maxTicks) {
        // 헤드리스에서는 정책이 즉시 고른다 (기본: 첫 선택지)
        if (s.phase === "draft") {
            chooseSigil(s, draftPolicy ? draftPolicy(s) : 0);
            continue;
        }
        step(s, onTick);
        n++;
    }
    // 시간 초과는 패배로 처리한다 (전투는 반드시 종료된다)
    if (s.phase === "battle") s.phase = "defeat";
    return s;
}
