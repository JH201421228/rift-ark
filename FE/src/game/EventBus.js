/**
 * EventBus — React ↔ Phaser 일회성 이벤트 채널
 *
 * ★ 규칙: 지속 상태는 Zustand, 순간 이벤트는 EventBus. 둘을 섞지 않는다.
 *
 * Zustand 로 표현하기 부적절한 것들만 여기로 보낸다:
 *   - 연출 트리거 (씬 준비 완료, 각인 드래프트 열림)
 *   - 사용자 의도 (슬롯 탭, 지휘관 이동 요청)
 *
 * @see docs/03-tech/20-architecture.md §4.3
 */
import Phaser from "phaser";

export const EventBus = new Phaser.Events.EventEmitter();

/**
 * 이벤트 이름 상수.
 * 문자열 오타로 인한 무응답 버그를 막기 위해 반드시 이 상수를 쓴다.
 */
export const EVT = {
    // Phaser → React
    SCENE_READY: "scene-ready",
    BATTLE_ENDED: "battle-ended",
    SIGIL_DRAFT_OPEN: "sigil-draft-open",
    /**
     * 주문 시전 결과 — `{ spellId, ok, reason }` (2026-08-05).
     *
     * ★★ 판정은 **씬에만** 있다. 균열력은 HUD 도 알지만 쿨다운은 시뮬 상태이고,
     *   HUD 가 스스로 판정하면 "화면은 성공이라는데 아무 일도 안 일어나는" 갈라짐이
     *   생긴다. 그래서 `castSpell` 의 결과를 그대로 실어 보낸다.
     */
    SPELL_RESULT: "spell-result",

    // React → Phaser
    REQUEST_SUMMON: "request-summon",
    CAST_SPELL: "cast-spell",
    SIGIL_CHOOSE: "sigil-choose",
    SIGIL_REROLL: "sigil-reroll",
    /**
     * ★ `SUMMON_DRAG` 는 없앴다 (2026-08-04). 드래그 소환이 탭·탭으로 바뀌면서
     *   이 이벤트의 유일한 용도였던 캔버스 레인 하이라이트도 사라졌다 —
     *   레인 강조는 이제 `hud/BattleHud.jsx:LanePicker` 하나가 그린다.
     *   죽은 이벤트 이름을 남겨 두면 다음 사람이 그 경로를 되살린다.
     *
     * ★ `REQUEST_COMMANDER_MOVE` 도 같은 이유로 없앴다 (2026-08-05).
     *   **지휘관 이동은 EventBus 를 타지 않는다.** 전장 탭·드래그는 캔버스가
     *   직접 받고(`scenes/BattleScene.js:setupInput` → `moveCommanderTo`),
     *   React 는 이 의도를 아예 만들지 않는다 — 이동 대상이 되는 좌표계가
     *   씬의 월드 좌표이고, 그것을 DOM 이 다시 계산하면 줌·뷰포트마다 어긋난다
     *   (레인 강조가 캔버스에 있던 시절에 겪은 그 문제다).
     *   선언만 있고 emit 도 on 도 0건인 채로 남아 있었다.
     *
     * ★★ 이 종류의 유령은 이제 `tools/validate-data.mjs` 의
     *   "선언 ↔ 소비 대조" 절이 잡는다 — 여기 적은 EVT 는 emit 하는 곳과
     *   on 하는 곳이 **둘 다** 있어야 한다.
     */
};
