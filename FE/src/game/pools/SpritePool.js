/**
 * 스프라이트 풀
 *
 * ★ new Sprite() / destroy() 순환이 GC 스터터의 주범이다.
 *   전투 중 유닛·이펙트·데미지텍스트가 초당 수십 개씩 생멸하므로 전부 풀링한다.
 *
 * ★ release 시 붙어 있는 모든 것(트윈·이미터)을 정지시킨다.
 *   안 하면 보이지 않는 객체가 영원히 비용을 낸다.
 *
 * ★★ **`acquire()` 는 전투 중에 풀을 키우지 않는다.** 마르면 가장 오래된
 *   활성분을 회수한다 — 텍스처 업로드와 표시 목록 재정렬이 한 프레임에 몰리는
 *   것보다, 오래된 발사체 하나가 조금 일찍 사라지는 편이 낫다.
 *   그 대신 **처음부터 충분히 커야 한다**: `pools/poolSizing.test.js` 가
 *   100 스테이지 실측으로 그것을 강제한다.
 *
 * ★ `phaser` 를 import 하지 않는다. 쓰는 것이 JSDoc 타입뿐이었는데, 그 한 줄
 *   때문에 이 모듈을 테스트하려면 브라우저 환경이 필요했다
 *   (`vitest environment: node` · `fx/quality.js` 의 같은 주석 참조).
 *
 * @see docs/03-tech/26-performance-budget.md §5
 */

export class SpritePool {
    /**
     * @param {Phaser.Scene} scene
     * @param {string} textureKey 프리워밍용 텍스처
     * @param {number} size
     * @param {number} depth
     * @param {string} [frame] 기본 프레임.
     *   ★ 아틀라스에서 프레임을 생략하면 Phaser 는 `__BASE`(시트 이미지 전체)를
     *     그린다. 화면을 뒤덮는 거대한 사각형이 되므로 반드시 지정한다.
     */
    constructor(scene, textureKey, size = 64, depth = 0, frame) {
        this.scene = scene;
        this.size = 0;
        this.free = [];
        this.active = [];
        this.defaultFrame = frame;
        // grow() 가 같은 모양으로 더 만들 수 있게 기억해 둔다
        this.textureKey = textureKey;
        this.depth = depth;

        this.grow(size);
    }

    /**
     * 풀을 키운다 (품질 티어 상향 · 26-performance-budget.md §4).
     *
     * ★★ **키우지 않으면 상한만 올라간다.** `EffectSystem` 은 동시 재생 예산을
     *   풀 크기와 따로 들고 있어서, 예산만 24 로 올리고 풀이 12 인 채면
     *   `acquire()` 가 **재생 중인 가장 오래된 이펙트를 회수**한다 — 애니메이션이
     *   뚝 끊긴다. 그것은 EffectSystem 이 일부러 피하기로 한 동작이다.
     *
     * ★ 줄이지는 않는다. 활성 스프라이트를 골라 지우는 것은 위험하고, 비활성
     *   스프라이트가 남아 있는 비용은 사실상 0 이다 (그리지 않는다).
     */
    grow(size) {
        for (let i = this.size; i < size; i++) {
            const s =
                this.defaultFrame !== undefined
                    ? this.scene.add.sprite(0, 0, this.textureKey, this.defaultFrame)
                    : this.scene.add.sprite(0, 0, this.textureKey);
            s.setActive(false).setVisible(false).setDepth(this.depth);
            this.free.push(s);
        }
        if (size > this.size) this.size = size;
    }

    /**
     * @returns {Phaser.GameObjects.Sprite|null} 상한 도달 시 최고령을 회수해 재사용
     *
     * ★★★ **재활용은 `activeCount` 를 늘리지 않는다.** `free` 가 비면 최고령을
     *   `shift` 해서 `push` 하므로 활성 수가 그대로다. 이것은 의도된 동작이지만,
     *   **호출부가 `while (activeCount < N)` 으로 돌면 그 루프는 영원히 끝나지 않는다.**
     *   실제로 그렇게 짜여 있었고, 발사체 수가 풀을 넘긴 순간 게임이 통째로 멈췄다
     *   (2026-08-05 사용자 제보 — "버튼조차 눌리지 않는다").
     *
     *   ★ 그래서 **호출부는 조건이 아니라 상한이 있는 for 로 대여한다.**
     *     `pools/poolSizing.test.js` 가 "재활용 시 activeCount 가 늘지 않는다"를
     *     못 박아, 이 성질을 모른 채 while 로 되돌리는 것을 막는다.
     */
    acquire() {
        let s = this.free.pop();
        if (!s) {
            s = this.active.shift();
            if (!s) return null;
            this.detach(s);
        }
        s.setActive(true).setVisible(true).setAlpha(1).setScale(1).setAngle(0);
        s.clearTint();
        this.active.push(s);
        return s;
    }

    /**
     * ★ **활성이 아닌 것은 `free` 에 넣지 않는다** (2026-08-05).
     *   예전에는 `indexOf` 가 -1 이어도 그대로 `free.push` 했다 — 같은 스프라이트가
     *   `free` 에 두 번 들어가면 **한 객체를 두 곳에서 동시에 쓰게 된다**
     *   (한쪽이 위치를 옮기면 다른 쪽 발사체가 순간이동한다).
     */
    release(s) {
        if (!s) return;
        const i = this.active.indexOf(s);
        if (i < 0) return;
        this.active.splice(i, 1);
        this.detach(s);
        s.setActive(false).setVisible(false);
        this.free.push(s);
    }

    /** 붙어 있는 트윈·이미터·타이머를 전부 끊는다 */
    detach(s) {
        this.scene.tweens.killTweensOf(s);
        if (s.stop) s.stop();
        if (s._fxTimer) {
            s._fxTimer.remove();
            s._fxTimer = null;
        }
    }

    releaseAll() {
        for (let i = this.active.length - 1; i >= 0; i--) this.release(this.active[i]);
    }

    destroy() {
        this.releaseAll();
        for (const s of this.free) s.destroy();
        this.free.length = 0;
        this.active.length = 0;
    }

    get activeCount() {
        return this.active.length;
    }
}
