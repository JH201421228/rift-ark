/**
 * 렌더 풀의 **동시 최댓값**을 헤드리스 시뮬로 잰다.
 *
 * ★★★ **왜 시뮬에서 재는가.** 풀 크기는 렌더의 값이지만 그 값을 정하는 것은
 *   시뮬이다 — 화면에 발사체가 몇 개 떠 있는지는 `sim.projectiles.length` 이고,
 *   데미지 숫자가 몇 개 떠 있는지는 그 수명 창 안의 DAMAGE·HEAL 이벤트 수다.
 *   브라우저를 띄우지 않고도 답이 나오고, 어디서 돌려도 같은 수가 나온다.
 *
 * ★★ **데미지 숫자는 "틱당 몇 개"가 아니라 "겹쳐 있는 몇 개"다.**
 *   `DamageTextPool.show()` 의 트윈이 620ms 이고 그 사이 새로 들어온 것이 전부
 *   동시에 살아 있다. 그리고 전투 배속만큼 시뮬이 빨리 도므로, 실시간 620ms 안에
 *   들어오는 틱은 `30Hz × 0.62s × 배속상한` 이다. 창을 좁게 잡으면 풀이 모자란
 *   것을 못 본다. 배속 상한은 **데이터에서 읽는다** (`settings.json`) — 선택지가
 *   늘면 창도 같이 넓어져야 한다.
 *
 * ★ 풀이 마르면 무슨 일이 나는가: `SpritePool.acquire()` · `DamageTextPool.acquire()`
 *   둘 다 **가장 오래된 활성분을 회수**한다. 크래시도 경고도 없이 날아가던
 *   발사체가 사라지고 숫자가 꺼진다. 그래서 이 계측이 없으면 아무도 모른다.
 *
 * @see docs/03-tech/26-performance-budget.md §2
 */
import { createSim, step, chooseSigil, isTerminalPhase } from "../../src/game/logic/sim.js";
import { buildStageConfig } from "../../src/game/logic/stageConfig.js";
import { autoPlayTick } from "../../src/game/logic/autoPlay.js";
import { EV } from "../../src/game/logic/events.js";
import { TICK_MS } from "../../src/game/logic/tick.js";
import settingsData from "../../src/game/data/settings.json" with { type: "json" };

/** `DamageTextPool.show()` 의 트윈 길이 (ms) — 저쪽을 고치면 여기도 고친다 */
export const DAMAGE_TEXT_MS = 620;
/**
 * 전투 배속 상한.
 * ★ 하드코딩하지 않는다 (절대규칙 4의 정신). 자동 진행 속도가 전투 속도를
 *   덮으므로 둘 중 큰 쪽이 실효 상한이다 (`BattleScene.applySpeedSetting`).
 */
export const MAX_BATTLE_SPEED = Math.max(
    ...["battleSpeed", "autoAdvanceSpeed"].flatMap((k) =>
        (settingsData.options?.[k] ?? []).map((o) => o.value)
    ),
    1
);
/** 데미지 숫자 하나가 살아 있는 동안 지나가는 최대 틱 수 */
export const DT_WINDOW_TICKS = Math.ceil((DAMAGE_TEXT_MS / TICK_MS) * MAX_BATTLE_SPEED);

/** 레벨 20 표준 편성 — 부하를 재는 것이므로 이기는 편성이어야 한다 */
export const HEAVY_LOADOUT = [
    { id: "slow_turtle", level: 20 },
    { id: "bold_man_at_arms", level: 20 },
    { id: "determined_soldier", level: 20 },
    { id: "elf_sharpshooter", level: 20 },
    { id: "novice_pyromancer", level: 20 },
    { id: "jovial_friar", level: 20 },
];

/**
 * 한 스테이지를 끝까지 돌리며 동시 최댓값을 모은다.
 *
 * ★ 각인 드래프트를 넘긴다. 넘기지 않으면 첫 드래프트에서 멈춰 전투의 앞
 *   4분의 1만 재게 된다 (`tools/bench-sim.mjs` 가 같은 함정에 빠져 있었다).
 *
 * @param {string} stageId
 * @param {number} seed
 * @param {object} [opts] { loadout, summonCooldownMs, maxSeconds }
 */
export function measurePeaks(stageId, seed, opts = {}) {
    const cfg = buildStageConfig(stageId, opts.loadout ?? HEAVY_LOADOUT);
    const s = createSim(cfg, seed);
    const summonCooldownMs = opts.summonCooldownMs ?? 120;
    const guardTicks = Math.round(((opts.maxSeconds ?? 600) * 1000) / TICK_MS);

    let maxActives = 0;
    let maxProjectiles = 0;
    let maxEventsPerTick = 0;
    let maxDamageTexts = 0;

    // 수명 창 안의 데미지 숫자 합 (링 버퍼 — 할당 없음)
    const ring = new Int32Array(DT_WINDOW_TICKS);
    let head = 0;
    let win = 0;

    let draftPick = 0;
    let ticks = 0;
    while (!isTerminalPhase(s.phase) && ticks < guardTicks) {
        if (s.phase === "draft") {
            chooseSigil(s, draftPick++ % (s.pendingDraft?.options?.length || 1));
            continue;
        }
        ticks++;
        autoPlayTick(s, { summonCooldownMs });
        step(s);

        const q = s.events;
        let dmg = 0;
        for (let i = 0; i < q.length; i++) {
            const t = q.pool[i].type;
            if (t === EV.DAMAGE || t === EV.HEAL) dmg++;
        }

        win += dmg - ring[head];
        ring[head] = dmg;
        head = (head + 1) % DT_WINDOW_TICKS;

        if (s.actives.length > maxActives) maxActives = s.actives.length;
        if (s.projectiles.length > maxProjectiles) maxProjectiles = s.projectiles.length;
        if (q.length > maxEventsPerTick) maxEventsPerTick = q.length;
        if (win > maxDamageTexts) maxDamageTexts = win;
    }

    return { stageId, seed, ticks, maxActives, maxProjectiles, maxEventsPerTick, maxDamageTexts };
}
