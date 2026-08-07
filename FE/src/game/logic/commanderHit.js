/**
 * 지휘관이 **맞는** 방법 — 단일 출처.
 *
 * ★★★ 왜 파일이 따로 있는가 (2026-08-05).
 *
 *   설계 문서(`docs/02-design/20-commander-combat.md` §2.1)는 지휘관 평타를
 *   이렇게 규정한다:
 *
 *     "평타는 딜 수단이 아니라 **미끼**다 — 사거리(140)가 오라 반경(192)보다
 *      짧아서, 평타를 넣으려면 오라 앞쪽을 적에게 내주는 자리까지 나가야 하고
 *      **그러면 SUPPORT 가 끊기고 지휘관이 맞는다.**"
 *
 *   **그 대가가 구현되어 있지 않았다.** 지휘관은 `lanes[].allies` 에 들어가지
 *   않아 `engage.js:nearestTarget` 의 후보가 아니었고, 지휘관 HP 를 깎는 코드는
 *   **보스 슬램 하나뿐**이었다. 즉 지휘관 평타는 4개월 동안 공짜였다.
 *
 * ★★ **피해에는 상한이 있다 — 지휘관 최대 HP 의 비율.** 이것이 이 파일이
 *   존재하는 진짜 이유다. 보스 슬램이 이미 같은 벽에 부딪혀 같은 답을 냈고
 *   (`balance.json:combat.$bossSlamCommanderHpRatio` 참조), 일반 적도 사정이
 *   똑같다:
 *
 *     지휘관 HP 600 (레벨 보정만 · 스테이지와 무관하게 고정)
 *     적 ATK    1-1 10 → 5-20 342,133  (실측, 34,000배)
 *
 *   배율 하나로는 절대 맞출 수 없다. 월드 1 에서 "몇 대 버틴다"가 되게 맞추면
 *   월드 2 부터 **모든 적이 지휘관을 한 방에 눕히고**, 월드 5 기준으로 맞추면
 *   월드 1 의 피해가 0 에 수렴한다. 단위가 다른 두 값을 곱한 문제이므로
 *   **상한을 HP 비율로** 둔다 — 월드가 몇 개 늘어나도 "몇 대 버틴다"가 규칙으로 남는다.
 *
 * ★ **지휘관에게는 방어 스탯이 없다** (DEF·RES·태그·실드 전부 없음).
 *   `state.js` 의 지휘관 객체가 실제로 그 필드들을 갖고 있지 않고, 만들어 주는
 *   것은 성장 축을 하나 더 여는 일이다 (범위 절삭 §2). 그래서 피해 계산은
 *   `computeDamage` 를 지나지 않는다 — DEF 0 · RES 0 · 태그 0 이면 그 함수는
 *   `atk` 를 그대로 돌려주므로 **지나도 결과가 같다.** 보스 슬램도 같은 이유로
 *   같은 모양이었고, 이제 둘이 이 함수 하나를 쓴다.
 *
 * ★ **크리티컬을 굴리지 않는다.** 상한이 걸리는 구간(월드 2 이후)에서는 어차피
 *   결과가 같고, 무엇보다 `s.rng.combat` 을 한 번 더 당기면 그 뒤의 모든 굴림이
 *   밀려 **결정론 비교(B1)와 밸런스 A/B 가 통째로 무의미해진다.**
 *
 * @see docs/02-design/20-commander-combat.md §2.3
 */
import { emit, EV } from "./events.js";

/**
 * 지휘관의 **예약 id**.
 *
 * ★ 지휘관은 `s.actives` 의 엔티티가 아니라 id 가 없었다. 그런데 피해를
 *   `EV.DAMAGE` 로 알리려면 대상 id 가 있어야 한다 — 엔티티 id 는 `s.nextId` 가
 *   1 부터 세므로 음수는 영원히 충돌하지 않는다.
 * ★ 렌더는 이 id 를 보고 스프라이트 맵이 아니라 `CommanderPresenter` 로 보낸다.
 */
export const COMMANDER_ID = -1;

/**
 * 지휘관이 **지금 전장에 서 있는가.**
 *
 * ★★ 이 술어는 한 줄이지만 **두 항이다** — `hp > 0` 과 `t >= downUntil`.
 *   둘 중 하나만 쓰면 조용히 틀린다: 죽은 그 틱에는 `downUntil` 이 아직 0 이라
 *   (타이머는 `lifecycle.js:stepCommander` 가 다음 틱에 건다) 시간 항만 보면
 *   **HP 0 인 지휘관이 살아 있는 것으로 읽힌다.**
 *
 * ★ 그래서 여기 한 번만 적는다. 지금 이 조건은 저장소 다섯 곳에 손으로 복제되어
 *   있고(`engage` · `commanderAttack` · `movement` · `nightmare` · 이 파일),
 *   화면까지 여섯 번째로 베끼면 언젠가 하나가 뒤처진다.
 */
export function commanderUp(s) {
    const c = s.commander;
    return c.hp > 0 && s.t >= c.downUntil;
}

/**
 * 지휘관을 때린다 — **여기가 지휘관 HP 를 깎는 유일한 자리다.**
 *
 * @param {object} s 시뮬 상태
 * @param {number} raw 상한 적용 전 피해
 * @param {number} capRatio 한 방의 상한 (지휘관 최대 HP 비율)
 * @returns {number} 실제로 들어간 피해 (0 이면 아무 일도 없었다)
 */
export function damageCommander(s, raw, capRatio) {
    const c = s.commander;
    // 기절 중에는 맞지 않는다. `stepCommander` 가 hp 를 0 으로 두고 재출격을 센다.
    if (!commanderUp(s)) return 0;

    const cap = c.hpMax * capRatio;
    const taken = raw > cap ? cap : raw;
    if (!(taken > 0)) return 0;

    c.hp = c.hp > taken ? c.hp - taken : 0;
    // ★ 기절 타이머는 `lifecycle.js:stepCommander` 가 건다 (downUntil === 0 이 신호).
    //   여기서 걸면 같은 사실을 두 곳이 정하게 되고, 그 둘은 반드시 갈라진다.
    if (c.hp <= 0) c.downUntil = 0;

    emit(s.events, EV.DAMAGE, COMMANDER_ID, Math.round(taken), c.lane, 0);
    return taken;
}
