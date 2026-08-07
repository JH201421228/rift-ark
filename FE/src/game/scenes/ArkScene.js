/**
 * ArkScene — 전투 밖의 **빈 씬** (2026-08-04)
 *
 * ★★ **이 씬은 아무것도 그리지 않는다. 그것이 지금의 설계다.**
 *
 *   예전에는 방주 거점을 단면도로 그렸다 — 하늘 그라디언트 · 층 바닥 · 외벽 ·
 *   균열 발광 · 시설 6채의 실루엣 · 배회 NPC 12체. 목적은 "전투 밖 화면에
 *   서사적 존재 이유를 준다"였다.
 *
 *   실제로 화면에 나타난 것은 **불투명 UI 뒤에서 비치는 알아볼 수 없는 도형들**이었다.
 *   방주 화면은 시설 카드 목록이라 그림을 가리고, 출격 화면은 스테이지 격자라
 *   더 가린다. 남은 것은 "왜 뒤에 회색 상자가 있지?" 하는 질문뿐이었다.
 *   사용자가 그것을 지적했고(2026-08-04), 지우는 것이 맞았다.
 *
 * ★ 그래도 **씬 자체는 남는다.** Phaser 캔버스는 라우트와 무관하게 항상 마운트되고
 *   (`docs/03-tech/20-architecture.md` §8), 전투를 나올 때 `switchScene("Ark")` 로
 *   돌아올 자리가 필요하다. 씬을 지우면 그 전환이 갈 곳을 잃는다.
 *
 * ★ 되살린다면: 방주 그림은 **화면을 가리지 않는 자리**(전용 전체화면 뷰)로 가야 한다.
 *   UI 뒤에 깔아 두는 배경으로는 두 번 다 실패했다.
 *
 * @see docs/04-plan/34-scope-cut.md
 */
import Phaser from "phaser";
import { EventBus, EVT } from "../EventBus.js";
import { installViewport } from "../viewport.js";

export class ArkScene extends Phaser.Scene {
    constructor() {
        super({ key: "Ark" });
    }

    create() {
        // 레터박스 없는 뷰포트 — 세로 720 고정, 가로만 열린다 (viewport.js)
        installViewport(this);
        // ★ 캔버스를 **비운다.** 배경색은 UI(CSS)가 그린다 — 두 곳에서 배경을
        //   칠하면 화면 전환마다 색이 한 프레임 튄다.
        this.cameras.main.setBackgroundColor("#0b0b18");
        EventBus.emit(EVT.SCENE_READY, this);
    }

    /**
     * ★ 그리는 것이 없어도 `shutdown()` 은 남긴다 (절대 규칙 3).
     *   `GameManager.wireShutdownHooks()` 가 전 씬에 이것을 연결하고,
     *   여기만 없으면 그 계약에 구멍이 하나 생긴다.
     */
    shutdown() {
        this.tweens?.killAll();
    }
}
