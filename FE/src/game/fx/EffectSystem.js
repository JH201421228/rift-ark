/**
 * 이펙트 시스템
 *
 * ★ effect/ 팩은 9색상행 중 0행만 패킹했다 (용량 1/9).
 *   색은 런타임 setTintFill 로 바꾼다 — 같은 이펙트가 월드마다,
 *   데미지 타입마다 다르게 보인다.
 *
 * @see docs/02-design/19-art-audio-direction.md §1.4
 */
import { SpritePool } from "../pools/SpritePool.js";
import fxData from "../data/fx.json" with { type: "json" };
import { EFFECT_BUDGET } from "@/store/slices/settingsSlice";

export class EffectSystem {
    /**
     * @param {Phaser.Scene} scene
     * @param {number} worldId
     * @param {number} capacity 동시 이펙트 상한 (품질 티어로 조절)
     * @param {string} [intensity] 'high'|'medium'|'low' — 설정 > 그래픽 > 이펙트 강도
     */
    constructor(scene, worldId = 1, capacity = 24, intensity = "high") {
        this.scene = scene;
        this.capacity = capacity;
        this.worldTint = Number(fxData.worldTint[String(worldId)] ?? 0xffffff);
        /**
         * ★ 이펙트 강도를 **풀 크기**가 아니라 **동시 재생 예산**으로 구현한다.
         *   풀을 줄이면 초과분이 가장 오래된 이펙트를 강제 회수해 **재생 중인
         *   애니메이션이 뚝 끊긴다** — 저사양일수록 더 자주, 더 눈에 띄게.
         *   예산을 넘긴 요청을 그냥 버리면 이미 나온 이펙트는 끝까지 재생된다.
         *   저사양에서 줄여야 하는 것은 개수이지 품질이 아니다.
         */
        this.budget = capacity;
        this.setIntensity(intensity);

        // 아틀라스의 첫 프레임으로 프리워밍
        this.pool = new SpritePool(scene, fxData.atlas, capacity, 600);

        this.anims = new Map();
        /**
         * ★ 재생마다 클로저를 만들지 않는다 (절대규칙 7). 이펙트는 타격마다 나고,
         *   `() => this.pool.release(spr)` 는 호출마다 새 함수 객체다.
         *   Phaser 는 `animationcomplete` 의 세 번째 인자로 게임오브젝트를 준다.
         */
        this._onAnimComplete = (_anim, _frame, gameObject) => this.pool.release(gameObject);
        this.buildAnimations();
    }

    buildAnimations() {
        const tex = this.scene.textures.get(fxData.atlas);
        if (!tex || tex.key === "__MISSING") {
            console.warn("[fx] atlas is not loaded");
            return;
        }

        for (const [name, def] of Object.entries(fxData.effects)) {
            const key = `fx:${name}`;
            if (this.scene.anims.exists(key)) {
                this.anims.set(name, { key, def });
                continue;
            }

            const frames = [];
            for (let i = 0; i < def.frames; i++) {
                const fname = `${def.prefix}/${i}`;
                if (tex.has(fname)) frames.push({ key: fxData.atlas, frame: fname });
            }
            if (!frames.length) {
                console.warn(`[fx] no frames for: ${name} (${def.prefix})`);
                continue;
            }

            this.scene.anims.create({ key, frames, frameRate: def.rate, repeat: 0 });
            this.anims.set(name, { key, def });
        }
    }

    /**
     * 이펙트 1회 재생.
     * @param {string} name  fx.json 의 논리 이름
     * @param {number} x
     * @param {number} y
     * @param {object} [opts] { scale, tint, dmgType, depth, flipX }
     */
    play(name, x, y, opts = {}) {
        const entry = this.anims.get(name);
        if (!entry) return null;
        if (this.pool.activeCount >= this.budget) return null;

        const spr = this.pool.acquire();
        if (!spr) return null;

        const scale = (entry.def.scale ?? 1) * (opts.scale ?? 1);
        spr.setPosition(x, y).setScale(scale).setDepth(opts.depth ?? 600);
        if (opts.flipX) spr.setFlipX(true);

        // 데미지 타입 색이 우선, 없으면 월드 색보정
        const tint = opts.tint ?? this.dmgTint(opts.dmgType) ?? this.worldTint;
        if (tint && tint !== 0xffffff) spr.setTint(tint);

        spr.play(entry.key);
        spr.once("animationcomplete", this._onAnimComplete);
        return spr;
    }

    dmgTint(dmgType) {
        if (!dmgType) return null;
        const v = fxData.damageTypeTint[dmgType];
        return v ? Number(v) : null;
    }

    /**
     * 동시 이펙트 상한 (품질 티어 · 26-performance-budget.md §4).
     *
     * ★★ 풀도 함께 키운다. 예산만 올리고 풀이 그대로면 `acquire()` 가 **재생 중인
     *   가장 오래된 이펙트를 회수**해 애니메이션이 뚝 끊긴다 — 위 주석이
     *   피하기로 한 바로 그 동작이다. 티어를 전투 중에 올릴 수 있으므로
     *   실제로 일어나는 경로다.
     * ★ 내릴 때는 풀을 줄이지 않는다. 예산이 내려가면 새 요청이 먼저 막히고,
     *   보이지 않는 스프라이트가 남아 있는 비용은 사실상 0 이다.
     */
    setCapacity(n) {
        this.capacity = n;
        this.pool?.grow(n);
        this.setIntensity(this.intensity);
    }

    /**
     * 이펙트 강도 (설정 > 그래픽).
     * ★ 최소 1은 남긴다 — 0이 되면 타격 피드백이 통째로 사라져 "게임이 멈춘 것"처럼 보인다.
     */
    setIntensity(level) {
        this.intensity = level in EFFECT_BUDGET ? level : "high";
        this.budget = Math.max(1, Math.round(this.capacity * EFFECT_BUDGET[this.intensity]));
    }

    releaseAll() {
        this.pool.releaseAll();
    }

    destroy() {
        this.pool.destroy();
        this.anims.clear();
    }

    get activeCount() {
        return this.pool.activeCount;
    }
}
