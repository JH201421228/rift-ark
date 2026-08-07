/**
 * DebugScene — 프레임 · 틱 · 엔티티 · 힙 오버레이 (개발 빌드 전용)
 *
 * ★★ **문서 세 곳이 이 씬이 있다고 규정하는데 파일이 없었다** (2026-08-05).
 *   `26-performance-budget.md` §10 · `20-architecture.md` §6 · `22-simulation-spec.md` §7 이
 *   전부 "DebugScene 이 보여 준다"고 적혀 있었고, 실제로는 없었다. 60fps 를
 *   **기능**이라고 부르면서 프레임을 보는 수단이 없는 상태였다는 뜻이다.
 *
 * ★★ **배포 번들에 남으면 안 된다.** 등록은 `scenes/index.js` 에서
 *   `import.meta.env.DEV` 리터럴로 가른다 — 롤업이 그 가지를 접으면 이 모듈을
 *   참조하는 곳이 하나도 없어져 통째로 사라진다. 런타임 조건(스토어 플래그 ·
 *   탭 카운터)으로 감추면 코드는 그대로 남는다 (P8-06 · `check-production.mjs`).
 *   `npm run check:prod` 가 dist 를 실제로 열어 확인한다.
 *
 * ★ 씬 계약 두 가지를 지킨다 (절대규칙 3): `installViewport(this)` 와 `shutdown()`.
 *   `scenes/scenes.test.js` 가 전수 검사한다.
 *
 * ★ 문서(§10)의 예시 코드와 다른 곳 — **코드가 맞고 문서를 고쳤다** (절대규칙 10):
 *   · `battle.pools.projectile` → 실제 이름은 `battle.projPool` · `battle.fx`
 *   · `sim.allyCount / enemyCount` 는 없다 — `sim.actives` 를 세어 만든다
 *   · 4손가락 탭 토글은 넣지 않았다. 입력 포인터는 3개이고(`config.js`),
 *     제스처를 하나 더 만드는 것보다 개발 빌드에서 항상 보이는 편이 낫다.
 *
 * @see docs/03-tech/26-performance-budget.md §10
 */
import Phaser from "phaser";
import { PIXEL_FONT } from "../config.js";
import { installViewport } from "../viewport.js";
import { gameStore } from "@/store";
import { resolveTier } from "../fx/quality.js";

/**
 * 갱신 주기(ms).
 *
 * ★★ 매 프레임 갱신하지 않는다. 이 오버레이는 문자열 9줄을 만들고 텍스트를 다시
 *   레이아웃한다 — 60Hz 로 하면 **재는 도구가 재려는 값을 망가뜨린다**
 *   (절대규칙 7: update() 안에서 배열 생성·문자열 결합 금지).
 *   5Hz 면 눈으로 읽기에도 충분하고, fps 는 어차피 Phaser 가 평균을 낸다.
 */
const REFRESH_MS = 200;

/** 재사용 버퍼 — 갱신마다 배열을 새로 만들지 않는다 */
const LINES = new Array(9);

export class DebugScene extends Phaser.Scene {
    constructor() {
        // ★ active:false — 등록만 하고 자동 시작하지 않는다.
        //   띄우는 것은 GameManager 다 (부팅이 끝난 뒤 `scene.run`).
        super({ key: "Debug", active: false });
    }

    create() {
        installViewport(this);

        this._acc = REFRESH_MS; // 첫 프레임에 바로 한 번 채운다
        this.text = this.add
            .text(8, 8, "", {
                fontFamily: PIXEL_FONT,
                fontSize: "14px",
                color: "#7dffb0",
                backgroundColor: "#000000a0",
                padding: { x: 6, y: 4 },
            })
            // ★ 스크롤 팩터 0 — 카메라가 어디를 보든 화면 왼쪽 위에 붙는다.
            //   뷰포트가 가로로 열려 있어 디자인 x=8 은 화면 왼쪽 끝이 아니다.
            .setScrollFactor(0)
            .setDepth(9999);
    }

    update(_time, delta) {
        this._acc += delta;
        if (this._acc < REFRESH_MS) return;
        this._acc = 0;

        const battle = this.scene.get("Battle");
        // 씬 인스턴스는 정지 상태로도 남아 있다 — 살아 있는 전투만 읽는다
        const sim = battle?.sys?.isActive?.() ? battle.sim : null;

        let allies = 0;
        let enemies = 0;
        if (sim) {
            const a = sim.actives;
            for (let i = 0; i < a.length; i++) {
                if (a[i].isAlly) allies++;
                else enemies++;
            }
        }

        const tier = gameStore.get().settings.qualityTier;
        const mem = globalThis.performance?.memory?.usedJSHeapSize ?? 0;

        LINES[0] = `fps    ${this.game.loop.actualFps.toFixed(1)}`;
        LINES[1] = `tick   ${battle?.avgTickMs?.toFixed(2) ?? "-"}ms`;
        LINES[2] = `tex    ${Object.keys(this.textures.list).length}`;
        LINES[3] = `unit   ally ${allies} · foe ${enemies}`;
        LINES[4] = `proj   ${battle?.projPool?.activeCount ?? 0}`;
        LINES[5] = `fx     ${battle?.fx?.activeCount ?? 0}`;
        LINES[6] = `dmg    ${battle?.dmgText?.activeCount ?? 0}`;
        LINES[7] = `tween  ${this.tweens.getTweens().length}`;
        LINES[8] = `tier   ${tier} → ${resolveTier(tier)}   heap ${(mem / 1048576).toFixed(1)}MB`;

        this.text.setText(LINES);
    }

    /**
     * ★ 절대규칙 3. 그리는 것이 텍스트 하나뿐이어도 계약은 지킨다 —
     *   빈 shutdown() 이 없으면 `GameManager.wireShutdownHooks()` 의 연결에
     *   구멍이 생기고, 다음 사람이 여기에 구독을 추가할 때 갈 곳이 없다.
     * ★ 정리 코드는 절대 throw 하지 않는다 (`?.`).
     */
    shutdown() {
        this.text?.destroy();
        this.text = null;
    }
}
