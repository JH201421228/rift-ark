/**
 * 패배의 質 측정 공통 함수 (P7-03)
 *
 * ★★ **사본 금지 때문에 존재하는 파일이다.**
 *   `tools/defeat-quality.mjs`(측정)와 `tools/tune-first-defeat.mjs`(튜닝)가
 *   같은 지표를 재야 한다. 튜닝 도구가 자체 구현을 갖고 있을 때 `pendingSpawns`
 *   (큐에 들어왔지만 아직 필드에 없는 적)를 빠뜨려, **후반 급증 물량이 통째로
 *   집계에서 사라지고** 잔여가 0% 로 보였다 — 즉 "완벽하게 아깝게 진 판"으로
 *   오독됐다. 튜닝이 그 값을 좇았다면 잘못된 스테이지 설정을 확정할 뻔했다.
 *
 * ★ "잔여"는 남은 **개체 수**가 아니라 남은 **HP 총량**이다.
 *   저HP 다수(SWARM)와 고HP 소수가 섞이면 마릿수는 진행도를 대변하지 못한다.
 *
 * @see docs/04-plan/33-execution-plan.md P7-03
 */

/**
 * 이 웨이브 테이블이 내보내는 적 HP 총량 (분모).
 * ★ `cfg.enemyDefs` 를 쓴다 — 원본 `enemies.json` 이 아니다.
 *   난이도 배율 · 스테이지 배율 · 거대화가 반영된 값이어야 분자와 단위가 맞는다.
 * ★ 웨이브 테이블도 `cfg` 것을 쓴다 — 튜닝 도구가 급증을 적용한 뒤의 테이블이어야 한다.
 */
export function totalEnemyHp(cfg) {
    let sum = 0;
    for (const w of cfg.waveTable) {
        for (const spec of w.spawns) {
            const def = cfg.enemyDefs[spec.id];
            // 레인은 배수가 아니라 분배처다 (stageConfig.js:enemyScale 주석 참조)
            if (def) sum += def.hp * spec.count;
        }
    }
    return sum;
}

/**
 * 패배 시점에 남아 있던 적 HP (분자).
 * 살아 있는 적의 현재 HP + **스폰 대기 중인 적** + 아직 큐에 안 들어온 웨이브.
 * ★ 가운데 항을 빼면 후반 급증이 통째로 사라진다 (위 주석 참조).
 */
export function remainingEnemyHp(s) {
    let sum = 0;
    for (const e of s.actives) {
        if (!e.isAlly && e.hp > 0) sum += e.hp;
    }
    for (const p of s.pendingSpawns) sum += p.def.hp;
    for (const w of s.cfg.waveTable) {
        if (w.wave <= s.wave) continue;
        for (const spec of w.spawns) {
            const def = s.cfg.enemyDefs[spec.id];
            if (def) sum += def.hp * spec.count;
        }
    }
    return sum;
}

/**
 * 패배의 종류를 가른다.
 *
 * ★★ **시간 초과는 "아깝게 진 것"이 아니다.** `runToCompletion` 은 400초를 넘기면
 *   phase 를 defeat 로 바꾼다(sim.js). 방주 회복량을 올리면 방주가 죽지 않아
 *   전투가 끝나지 않고, 그 타임아웃이 "잔여 0%" 로 집계되어 **완벽한 접전처럼
 *   보인다.** 실제로 튜닝 첫 스윕에서 그렇게 나왔다.
 *   타임아웃은 그 자체로 설계 실패이며(게이트 B9 전투 길이) 잔여 지표에서 빼야 한다.
 *
 * @returns {"victory"|"ark"|"timeout"}
 */
export function outcomeOf(s) {
    if (s.phase === "victory") return "victory";
    return s.arkHp > 0 ? "timeout" : "ark";
}
