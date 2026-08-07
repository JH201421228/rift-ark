/**
 * UnitPresenter — 4프레임 제약 상쇄 연출 엔진
 *
 * ★★ 이 파일이 이 게임 아트의 성패를 결정한다.
 *
 * 유닛 스프라이트에는 공격·이동·사망 애니메이션이 없다.
 * 몬스터 150종은 전부 16×16 4프레임 아이들 루프뿐이다.
 * 따라서 "살아 있다"는 인상은 전적으로 아래 조합에서 나온다:
 *
 *   대기  … 4프레임 루프 + 미세 상하 바운스(사인파)
 *   이동  … 같은 루프를 가속 + 바운스 증폭 + 진행 방향 기울기
 *   공격  … 전방 돌진 → 리코일 → 스쿼시 → 이펙트 → 히트스톱
 *   피격  … 흰색 틴트 플래시 → 넉백 → 역방향 스쿼시
 *   사망  … 붉은 틴트 → 회전 + 축소 + 페이드 → 소멸 이펙트
 *   소환  … 페이드 인 + 탄성 스케일 + 바닥 링
 *
 * 모든 수치는 presenters.json 의 데이터다. 프로파일 하나를 고치면
 * 그 역할의 모든 유닛 연출이 바뀐다.
 *
 * @see docs/02-design/19-art-audio-direction.md §2
 */
import Phaser from "phaser";
import presetData from "../data/presenters.json" with { type: "json" };
import { LANE_COUNT } from "../logic/state.js";
import { SpritePool } from "../pools/SpritePool.js";

/**
 * 스쳐 지나가기 (syncPassBy) 파라미터.
 * ★ 시뮬 수치가 아니라 **연출 상수**다. 밸런스에 영향을 주지 않으므로
 *   balance.json 이 아니라 여기 둔다.
 */
/** 이 거리 안이면 겹친 것으로 본다 (유닛 스프라이트 폭 ≈ 64) */
const PASS_RANGE = 44;
/** 비켜서는 세로 거리. 레인 간격(96)의 1/4 이하 — 레인을 착각하지 않을 만큼만 */
const PASS_OFFSET_Y = -18;
/** 프레임당 보간 계수 */
const PASS_LERP = 0.18;

/**
 * 밀집 분산 (syncCrowd) 파라미터.
 * ★ 역시 연출 상수다. 시뮬 좌표는 건드리지 않는다.
 */
/** 같은 편끼리 이 거리 안이면 밀집으로 본다 */
const CROWD_RANGE = 30;
/**
 * 밀집 순번별 세로 오프셋(부채꼴).
 * 레인 간격 96 의 절반(48) 을 넘지 않아야 다른 레인으로 착각하지 않는다.
 * `_passY`(-18) 와 겹쳐도 최대 -42 로 48 미만이다.
 */
const CROWD_FAN = [0, -13, 13, -24, 24, -7, 7];

const PROFILES = presetData.profiles;
const GIANT = presetData.giantMultiplier;
/**
 * 데미지 타입별 타격 이펙트 (`presenters.json:hitEffect`).
 * ★ 역할 프로파일의 `attack.effect` 는 **물리 타격의 모양**이고, 술식·신성은
 *   그림 자체가 다르다. 근거는 `presenters.json:$hitEffect` 에 있다.
 */
const HIT_BY_DMG = presetData.hitEffect ?? {};
/** 적 외곽선 — 두께·투명도·맥동. 색은 `enemies.json` 의 `art.outline` 이 정한다 */
const OUTLINE = presetData.outline;

/**
 * 외곽선 스프라이트 풀 크기.
 *
 * ★ 외곽선을 가진 적은 `enemies.json` 에 **10종**(엘리트·보스)뿐이고, 한 화면에
 *   그만큼이 동시에 나오는 웨이브는 없다. 그래도 상한을 넉넉히 두는 이유는
 *   풀이 마르면 `acquire()` 가 **가장 오래된 것을 회수**해서, 살아 있는 엘리트의
 *   외곽선이 조용히 사라지기 때문이다. 12개는 프리워밍 비용이 무시할 만하다.
 */
const OUTLINE_POOL = 12;

/**
 * `fx.play` 에 넘기는 **재사용 옵션 객체** (절대규칙 7).
 * ★ `EffectSystem.play` 는 이 객체를 그 자리에서 다 읽고 붙들지 않는다 —
 *   그래서 하나를 돌려써도 안전하다. 붙드는 코드를 넣게 되면 여기부터 깨진다.
 */
const FX_OPTS = { dmgType: null, scale: 1, flipX: false };

export class UnitPresenter {
    /**
     * @param {Phaser.Scene} scene
     * @param {import('../fx/EffectSystem.js').EffectSystem} fx
     * @param {import('../fx/CameraFx.js').CameraFx} cameraFx
     */
    constructor(scene, fx, cameraFx) {
        this.scene = scene;
        this.fx = fx;
        this.cameraFx = cameraFx;
        /** @type {Map<number, Phaser.GameObjects.Sprite>} 엔티티 id → 스프라이트 */
        this.sprites = new Map();
        /**
         * 외곽선 실루엣 풀.
         * ★ 첫 외곽선 적이 나올 때 만든다 — 아틀라스 키를 그때야 알 수 있고,
         *   외곽선 적이 한 마리도 없는 스테이지에서 12장을 프리워밍할 이유도 없다.
         * @type {SpritePool|null}
         */
        this.outlinePool = null;
    }

    /* ── 생성 · 소멸 ────────────────────────────────────────── */

    /**
     * 엔티티 스프라이트를 만든다.
     * @param {object} ent 시뮬 엔티티
     * @param {object} def 유닛/적 정의 (art 포함)
     * @param {number} baseY 레인 baseline
     */
    spawn(ent, def, baseY) {
        const art = def.art ?? {};
        const atlas = art.atlas ?? "units";
        const frame = this.firstFrameOf(atlas, art.frame);

        let spr;
        if (frame) {
            spr = this.scene.add.sprite(ent.x, baseY, atlas, frame);
        } else {
            // 아트가 아직 없으면 눈에 띄는 플레이스홀더로 (조용히 사라지는 것보다 낫다)
            spr = this.scene.add.sprite(ent.x, baseY, atlas);
            spr.setTint(0xff00ff);
        }

        const scale = (art.scale ?? 4) * (def.giant?.scale ?? 1);
        spr.setOrigin(0.5, 1); // 발밑이 baseline
        spr.setScale(scale);
        spr.setDepth(this.depthFor(ent, baseY));
        if (!ent.isAlly) spr.setFlipX(true);

        spr._baseY = baseY;
        spr._baseScale = scale;
        spr._profile = PROFILES[def.role] ?? PROFILES.MELEE;
        spr._giant = !!def.giant;
        // 바운스 위상을 유닛마다 흩뜨린다. 난수가 아니라 id 에서 유도해
        // 렌더가 시뮬 RNG 를 오염시키지 않게 한다 (황금비로 고르게 분산).
        spr._phase = (ent.id * 0.618033988749895) % 1;

        this.playIdle(spr, atlas, art.frame);
        // ★ 프레임을 못 찾았으면 외곽선도 붙이지 않는다 — `__BASE`(시트 전체)의
        //   실루엣을 깔면 화면이 통째로 색으로 덮인다.
        if (frame && art.outline) this.attachOutline(spr, atlas, frame, art.frame, art.outline);
        this.playSpawn(spr, ent, baseY);

        this.sprites.set(ent.id, spr);
        return spr;
    }

    /* ── 외곽선 ────────────────────────────────────────────────
     *
     * ★★ **왜 실루엣 스프라이트인가 — `postFX.addGlow` 를 쓰지 않은 이유.**
     *
     *   Phaser 의 postFX 는 **WebGL 전용**이다. 그런데 이 저장소는 저사양 기기에서
     *   일부러 CANVAS 로 부팅한다 (`game/device.js:IS_LOW_END` → `Phaser.CANVAS`).
     *   glow 로 구현하면 **하필 그 기기에서만** 엘리트 표시가 통째로 사라진다 —
     *   화면이 가장 혼잡하고 "저 큰 놈이 뭐냐"가 가장 급한 쪽이 저사양 기기다.
     *   두 갈래(WebGL=glow / Canvas=실루엣)로 나누면 실제로 굴려 보는 것은 한쪽뿐이고,
     *   나머지 한쪽은 다음 사람이 고칠 때 조용히 깨진다.
     *
     *   그리고 glow 는 블러다. `pixelArt: true` 로 근접 표본화를 지켜 온 화면에
     *   부드러운 번짐을 얹으면 픽셀 위계(굵은 픽셀=병력 / 고운 픽셀=이름 있는 존재)가
     *   흐려진다. 1px 확대 실루엣은 **픽셀아트의 아웃라인 그 자체**다.
     *
     * ★ 반복 생성되므로 풀링한다 (절대규칙 8).
     */

    /**
     * 적 스프라이트 뒤에 색 실루엣을 깐다.
     *
     * @param {Phaser.GameObjects.Sprite} spr 본체
     * @param {string} atlas
     * @param {string} frame  실재 확인된 첫 프레임
     * @param {string} framePrefix 아이들 루프용 접두사
     * @param {string} color `enemies.json` 의 `art.outline` ("0xff3344")
     */
    attachOutline(spr, atlas, frame, framePrefix, color) {
        const tint = Number(color);
        // 색이 아니면 조용히 넘어간다 — 연출 실패가 전투를 멈추게 두지 않는다
        if (!Number.isFinite(tint)) return;

        if (!this.outlinePool) {
            this.outlinePool = new SpritePool(this.scene, atlas, OUTLINE_POOL, 0, frame);
        }
        const o = this.outlinePool.acquire();
        if (!o) return;

        o.setTexture(atlas, frame).setOrigin(0.5, 1).setTintFill(tint);
        this.playIdle(o, atlas, framePrefix);

        /**
         * ★ 배율을 **화면 두께에서 역산한다.** 고정 배율(1.06 같은 값)로 두면
         *   ×2 인 대형 보스는 외곽선이 두 배로 두꺼워지고 ×4 인 잡몹은 얇아져,
         *   같은 "엘리트 표시"가 적마다 다른 굵기로 보인다.
         */
        const w = spr.width * spr._baseScale;
        spr._outlineFactor = w > 0 ? (w + OUTLINE.px * 2) / w : 1;
        spr._outline = o;
    }

    /**
     * 외곽선을 본체에 맞춘다. **매 프레임** — 본체가 트윈으로 움직이기 때문이다.
     * ★ 할당이 없다 (절대규칙 7).
     */
    syncOutline(spr, timeMs) {
        const o = spr._outline;
        if (!o || !o.active) return;
        const f = spr._outlineFactor;
        /**
         * ★ y 를 두께만큼 내린다. 원점이 발밑(0.5, 1)이라 그냥 키우면 위·옆으로만
         *   자라고 **발밑에는 외곽선이 없다** — 레인 바닥에 붙어 서는 게임이라
         *   가장 눈에 띄는 쪽이 하필 거기다.
         */
        o.setPosition(spr.x, spr.y + OUTLINE.px);
        o.setScale(spr.scaleX * f, spr.scaleY * f);
        o.setAngle(spr.angle);
        o.setFlipX(spr.flipX);
        // 본체 바로 뒤. 레인 간 깊이 간격(9.6)보다 훨씬 작아 순서를 흔들지 않는다
        o.setDepth(spr.depth - 0.5);

        // ★ 본체 알파를 곱한다 — 소환 페이드가 외곽선만 남겨 두지 않게.
        const pulse = OUTLINE.pulse
            ? Math.abs(Math.sin((timeMs / OUTLINE.pulsePeriodMs + spr._phase) * Math.PI)) *
              OUTLINE.pulse
            : 0;
        o.setAlpha(Math.min(1, (OUTLINE.alpha + pulse) * spr.alpha));
    }

    /** 외곽선을 풀에 돌려준다. 본체가 사라지는 모든 경로에서 부른다 */
    releaseOutline(spr) {
        if (!spr?._outline) return;
        this.outlinePool?.release(spr._outline);
        spr._outline = null;
    }

    /**
     * 프레임 접두사로 **실제로 존재하는 첫 프레임**을 찾는다.
     *
     * ★ `${frame}/0` 을 가정하면 안 된다. 아틀라스 패킹이 동일 프레임을 중복
     *   제거하기 때문에 인덱스가 듬성듬성하다 (예: `BoldManAtArms` 는 /1, /2 만 있다).
     *   /0 을 가정했더니 멀쩡한 스프라이트가 마젠타 플레이스홀더로 떴다.
     */
    firstFrameOf(atlas, prefix) {
        if (!prefix) return null;
        const tex = this.scene.textures.get(atlas);
        if (!tex || tex.key === "__MISSING") return null;

        const exact = `${prefix}/0`;
        if (tex.has(exact)) return exact;

        let best = null;
        let bestIdx = Infinity;
        for (const n of tex.getFrameNames()) {
            if (!n.startsWith(`${prefix}/`)) continue;
            const idx = Number(n.slice(prefix.length + 1));
            if (Number.isFinite(idx) && idx < bestIdx) {
                bestIdx = idx;
                best = n;
            }
        }
        return best;
    }

    /** 아이들 루프 애니메이션 (없으면 생성) */
    playIdle(spr, atlas, framePrefix) {
        const key = `${atlas}:${framePrefix}`;
        if (!this.scene.anims.exists(key)) {
            const tex = this.scene.textures.get(atlas);
            if (!tex || tex.key === "__MISSING") return;
            const frames = tex
                .getFrameNames()
                .filter((n) => n.startsWith(`${framePrefix}/`))
                .sort((a, b) => Number(a.split("/")[1]) - Number(b.split("/")[1]))
                .map((f) => ({ key: atlas, frame: f }));
            if (!frames.length) return;
            this.scene.anims.create({ key, frames, frameRate: 8, repeat: -1 });
        }
        spr.play(key);
    }

    /** 후방 레인이 먼저 그려지도록 깊이를 정한다 */
    depthFor(ent, baseY) {
        return 100 + baseY * 0.1 + (ent.isAlly ? 0 : 0.05);
    }

    remove(id) {
        const spr = this.sprites.get(id);
        if (!spr) return;
        this.releaseOutline(spr);
        this.scene.tweens.killTweensOf(spr);
        spr.destroy();
        this.sprites.delete(id);
    }

    /* ── 상태 연출 ──────────────────────────────────────────── */

    /** 소환: 페이드 인 + 탄성 스케일 + 바닥 링 */
    playSpawn(spr, ent, baseY) {
        const p = spr._profile.spawn;
        if (!p) return;

        spr.setAlpha(0).setScale(spr._baseScale * (p.scaleFrom ?? 0.6));

        this.scene.tweens.add({
            targets: spr,
            alpha: 1,
            duration: p.fadeMs ?? 150,
        });
        this.scene.tweens.add({
            targets: spr,
            scaleX: spr._baseScale * (p.overshoot ?? 1.15),
            scaleY: spr._baseScale * (p.overshoot ?? 1.15),
            duration: (p.fadeMs ?? 150) * 0.7,
            yoyo: false,
            onComplete: () => {
                this.scene.tweens.add({
                    targets: spr,
                    scaleX: spr._baseScale,
                    scaleY: spr._baseScale,
                    duration: 120,
                    ease: "Back.easeOut",
                });
            },
        });

        if (p.ringEffect) this.fx.play(p.ringEffect, ent.x, baseY, { scale: 0.8, depth: 90 });
    }

    /**
     * 공격: 돌진 → 리코일 → 스쿼시 → 이펙트 → 히트스톱
     * ★ 이 조합이 "애니메이션이 있는 것처럼" 보이게 하는 핵심이다.
     */
    playAttack(attackerId, targetX, targetY, dmgType) {
        const spr = this.sprites.get(attackerId);
        if (!spr) return;
        const p = spr._profile.attack;
        if (!p) return;

        const gm = spr._giant ? GIANT : null;
        const dir = spr.flipX ? -1 : 1;
        const homeX = spr._homeX ?? spr.x;
        spr._homeX = homeX;

        // ① 돌진
        if (p.lungePx) {
            const lunge = p.lungePx * (gm ? gm.lunge : 1);
            this.scene.tweens.add({
                targets: spr,
                x: homeX + dir * lunge,
                duration: p.lungeMs ?? 80,
                ease: "Quad.easeOut",
                yoyo: true,
                onComplete: () => {
                    spr._homeX = undefined;
                },
            });
        }

        // ② 리코일 (원거리·공성)
        if (p.recoilPx) {
            this.scene.tweens.add({
                targets: spr,
                x: homeX + dir * p.recoilPx,
                duration: p.recoilMs ?? 110,
                ease: "Quad.easeOut",
                yoyo: true,
                onComplete: () => {
                    spr._homeX = undefined;
                },
            });
        }

        // ③ 상승 (술사·지원)
        if (p.risePx) {
            this.scene.tweens.add({
                targets: spr,
                y: spr._baseY - p.risePx,
                duration: p.riseMs ?? 160,
                ease: "Sine.easeOut",
                yoyo: true,
            });
        }

        // ④ 스쿼시
        if (p.squash) this.squash(spr, p.squash[0], p.squash[1], 110);

        // ⑤ 발광 (술사)
        if (p.glow) this.flashTint(spr, 0xffffff, 50);

        // ⑥ 이펙트
        // ★ 객체 리터럴을 만들지 않는다 (절대규칙 7) — 공격은 이 게임에서 가장 잦은
        //   사건이고, 예전에는 호출마다 좌표 객체 하나 + 옵션 객체 하나를 만들었다.
        if (p.effect) {
            const toTarget = p.effectAt === "target";
            FX_OPTS.dmgType = dmgType;
            FX_OPTS.scale = gm ? gm.effectScale : 1;
            FX_OPTS.flipX = dir < 0;
            /**
             * ★ 술식·신성은 **다른 그림**을 쓴다 (`presenters.json:hitEffect`).
             *   객체를 만들지 않는다 — 미리 만들어 둔 표를 두 번 인덱싱할 뿐이다.
             *
             * ★★ `hitByDamageType` 을 켠 역할에만 건다. SUPPORT 의 `attack.effect` 는
             *   **힐**이고 그 동료들은 대부분 신성이라, 자동으로 걸면 치유 연출이
             *   통째로 신성 타격으로 바뀐다 (`presenters.json:$hitEffect`).
             */
            const byDmg = p.hitByDamageType ? HIT_BY_DMG[dmgType] : null;
            const effect = byDmg ? (gm ? byDmg.giant : byDmg.normal) ?? p.effect : p.effect;
            this.fx.play(
                effect,
                toTarget ? targetX : spr.x,
                (toTarget ? targetY : spr.y) - 20,
                FX_OPTS
            );
        }

        // ⑦ 히트스톱 + 셰이크
        if (p.hitStopMs) this.cameraFx.hitStop(p.hitStopMs * (gm ? gm.hitStop : 1));
        if (p.cameraShake) this.cameraFx.shake(p.cameraShake * (gm ? gm.shake : 1), 100);
    }

    /**
     * ★★★ **틴트 플래시에 타이머를 걸지 않는다** (2026-08-05).
     *
     *   예전에는 피격마다 `time.delayedCall(60, () => spr.clearTint())` 이었다.
     *   피격은 이 게임에서 가장 잦은 사건이고(1-9 후반 초당 수십 회), 호출마다
     *   **클로저 하나 + TimerEvent 하나**가 새로 생겨 그대로 GC 압력이 됐다
     *   (절대규칙 7). 게다가 씬 shutdown 이 `time.removeAllEvents()` 로 그것들을
     *   지우면 틴트가 **켜진 채로** 남는다.
     *
     *   대신 만료 시각만 스프라이트에 적어 두고 `sync()` 가 지운다 — 어차피 매
     *   프레임 도는 루프이고, 할당이 하나도 없다.
     */
    flashTint(spr, color, ms) {
        spr.setTintFill(color);
        spr._tintUntil = this.scene.time.now + ms;
    }

    /** 피격: 흰색 틴트 → 넉백 → 역스쿼시 */
    playHurt(entityId, effective) {
        const spr = this.sprites.get(entityId);
        if (!spr) return;
        const p = spr._profile.hurt;
        if (!p) return;

        this.flashTint(spr, effective ? 0xffee88 : 0xffffff, p.tintMs ?? 60);

        if (p.knockbackPx) {
            const dir = spr.flipX ? 1 : -1;
            const home = spr.x;
            this.scene.tweens.add({
                targets: spr,
                x: home + dir * p.knockbackPx,
                duration: 70,
                yoyo: true,
                ease: "Quad.easeOut",
            });
        }

        if (p.squash) this.squash(spr, p.squash[0], p.squash[1], 90);
    }

    /** 사망: 붉은 틴트 → 회전 + 축소 + 페이드 → 이펙트 */
    playDeath(entityId) {
        const spr = this.sprites.get(entityId);
        if (!spr) {
            return;
        }
        const p = spr._profile.death ?? { spinDeg: 720, durationMs: 300 };

        // ★ 외곽선은 사망 연출을 따라가지 않는다. 맵에서 빠지는 순간 sync() 가
        //   더 이상 갱신하지 않으므로, 남겨 두면 회전·축소하는 본체 뒤에
        //   **멈춰 선 색 실루엣**이 남는다.
        this.releaseOutline(spr);
        this.sprites.delete(entityId); // 즉시 맵에서 제거 — 이후 갱신 대상 아님
        this.scene.tweens.killTweensOf(spr);
        spr.setTintFill(0xff5566);

        if (p.effect) this.fx.play(p.effect, spr.x, spr.y - 24, { scale: spr._giant ? 2 : 1 });

        this.scene.tweens.add({
            targets: spr,
            angle: p.spinDeg ?? 720,
            scaleX: 0,
            scaleY: 0,
            alpha: 0,
            y: spr.y - 16,
            duration: p.durationMs ?? 300,
            ease: "Quad.easeIn",
            onComplete: () => spr.destroy(),
        });
    }

    /* ── 매 프레임 갱신 ────────────────────────────────────── */

    /**
     * 시뮬 상태를 스프라이트에 반영한다.
     * @param {object} sim
     * @param {number} timeMs 렌더 시각 (바운스 위상용)
     */
    sync(sim, timeMs) {
        this.syncCrowd(sim);
        this.syncPassBy(sim);

        const actives = sim.actives;
        for (let i = 0; i < actives.length; i++) {
            const ent = actives[i];
            const spr = this.sprites.get(ent.id);
            if (!spr || !spr.active) continue;

            // 트윈이 x 를 잡고 있으면 건드리지 않는다 (돌진 중)
            if (spr._homeX === undefined) spr.x = ent.x;

            // 상하 바운스 — 이동 중이면 증폭
            const prof = spr._profile;
            const moving = !ent.engaged && ent.speed > 0 && ent.blockedBy === -1;
            const b = moving ? prof.move : prof.idle;
            if (b?.bounceY) {
                const period = b.bouncePeriod ?? 900;
                const phase = (timeMs / period + spr._phase) * Math.PI * 2;
                spr.y = spr._baseY - Math.abs(Math.sin(phase)) * b.bounceY;
            } else {
                spr.y = spr._baseY;
            }
            // 비켜서기 오프셋 (syncCrowd · syncPassBy 가 계산해 둔 값)
            if (spr._crowdY) spr.y += spr._crowdY;
            if (spr._passY) spr.y += spr._passY;

            /**
             * ★ 깊이는 **최종 화면 y** 로 정한다. 밀집 분산으로 아래에 선 유닛이
             *   앞에 그려져야 겹침이 실제로 풀린다 (y 만 옮기고 깊이가 같으면
             *   그리는 순서가 뒤죽박죽이라 여전히 하나로 뭉쳐 보인다).
             *
             * ★★ **값이 바뀔 때만 넣는다** (2026-08-05). Phaser 의 `depth` setter 는
             *   같은 값을 넣어도 `queueDepthSort()` 를 부르고, 그러면 표시 목록
             *   전체가 그 프레임에 다시 정렬된다. `_crowdY` 는 lerp 라 수렴한 뒤에도
             *   부동소수점 끝자리가 계속 흔들리므로, 그냥 두면 **정렬 플래그가
             *   영원히 꺼지지 않는다** (실측: `sortByDepth` 셀프타임 1.0~1.1%).
             *   0.01 은 레인 간 깊이 간격(9.6)의 1/960 이라 순서를 바꾸지 못한다.
             */
            const depth =
                this.depthFor(ent, spr._baseY + (spr._crowdY ?? 0)) -
                (spr._passY < -0.5 ? 0.2 : 0);
            if (Math.abs(spr.depth - depth) > 0.01) spr.setDepth(depth);

            // 진행 방향 기울기 — 같은 각도를 다시 넣지 않는다 (각도 setter 는 랩 계산을 한다)
            if (b?.tiltDeg !== undefined) {
                const dir = ent.isAlly ? 1 : -1;
                const tilt = moving ? b.tiltDeg * dir : 0;
                if (spr.angle !== tilt) spr.setAngle(tilt);
            }

            /**
             * 피격·발광 틴트 만료 (`flashTint` 주석 참조).
             * ★ `_auraGlow` 도 함께 내린다 — 틴트를 지우면 오라 발광까지 같이
             *   사라지는데, 플래그가 켜진 채면 아래 분기가 다시 칠하지 않아
             *   **한 번 맞은 아군은 오라 안에 있어도 영영 어둡게** 남는다.
             */
            if (spr._tintUntil && timeMs >= spr._tintUntil) {
                spr._tintUntil = 0;
                spr.clearTint();
                spr._auraGlow = false;
            }

            // 오라 안이면 은은한 발광 (지휘관 위치가 결과를 바꾼다는 걸 보여주는 장치)
            if (ent.isAlly) {
                if (ent.inAura && !spr._auraGlow) {
                    spr.setTint(0xfff0c0);
                    spr._auraGlow = true;
                } else if (!ent.inAura && spr._auraGlow) {
                    spr.clearTint();
                    spr._auraGlow = false;
                }
            }

            // 엘리트·보스 외곽선 (enemies.json 의 art.outline)
            if (spr._outline) this.syncOutline(spr, timeMs);
        }
    }

    /**
     * ★★ 스쳐 지나가기 — 적이 아군을 **뚫고 지나가는 것처럼 보이는** 문제
     *
     *   규칙상 적을 멈추는 것은 `BLOCKER` 뿐이다 (movement.js). 이건 이 게임의
     *   구조적 심장이라 바꾸지 않는다. 문제는 **그림**이다: 막지 못하는 아군과
     *   적이 같은 레인 같은 y 에 있으니 스프라이트가 정확히 겹쳐 통과해,
     *   "충돌이 없는 버그"로 읽힌다 (실제 제보).
     *
     *   그래서 겹치는 순간에만 적을 **살짝 안쪽(위)으로 비켜 세우고 뒤에 그린다.**
     *   규칙은 그대로 — 적은 여전히 지나간다 — 하지만 화면에서는
     *   "뚫고 지나감"이 아니라 "옆으로 스쳐 지나감"이 된다.
     *
     * ★ 블록당한 적은 비키지 않는다. 붙들려 있다는 사실이 더 중요하다.
     * ★ 매 프레임 배열을 만들지 않는다 (절대규칙 7). 레인 배열을 인덱스로만 훑는다.
     */
    syncPassBy(sim) {
        for (let li = 0; li < LANE_COUNT; li++) {
            const { allies, enemies } = sim.lanes[li];
            if (!allies.length || !enemies.length) continue;

            for (let ei = 0; ei < enemies.length; ei++) {
                const e = enemies[ei];
                const spr = this.sprites.get(e.id);
                if (!spr || !spr.active) continue;

                let overlap = false;
                if (e.blockedBy === -1) {
                    // 정렬 배열이라 가까운 쪽만 보면 된다
                    for (let ai = 0; ai < allies.length; ai++) {
                        const a = allies[ai];
                        if (a.x < e.x - PASS_RANGE) continue;
                        if (a.x > e.x + PASS_RANGE) break;
                        overlap = true;
                        break;
                    }
                }

                // 부드럽게 비켜선다. 즉시 옮기면 유닛이 순간이동한 것처럼 보인다.
                const target = overlap ? PASS_OFFSET_Y : 0;
                const cur = spr._passY ?? 0;
                spr._passY = cur + (target - cur) * PASS_LERP;
                // 깊이는 sync() 가 최종 y 로 한 번에 정한다 (여기서 정하면
                // 밀집 오프셋을 모르는 채로 덮어써 버린다)
            }
        }
    }

    /**
     * ★★ 밀집 분산 — **같은 유닛 여럿이 한 마리로 보이는** 문제
     *
     *   같은 편 같은 레인의 유닛은 x 가 시뮬 좌표 그대로라, 같은 지점에 소환하거나
     *   같은 속도로 함께 전진하면 스프라이트가 **정확히 포개진다.** 4마리를 냈는데
     *   화면엔 1마리다 (실제 제보). 코스트를 썼는데 쓴 티가 안 나면 게임이 망가진다.
     *
     *   그래서 x 가 붙어 있는 같은 편 유닛을 세로로 **부채꼴로 흩는다.**
     *   시뮬 x 는 그대로다 — 사거리 · 블록 판정은 한 톨도 바뀌지 않는다.
     *
     * ★ 순번은 레인 배열 순서(=x 정렬)에서 유도한다. 난수를 쓰면 프레임마다
     *   자리가 바뀌어 떨린다. 같은 배치면 항상 같은 모양이어야 한다.
     * ★ 매 프레임 배열을 만들지 않는다 (절대규칙 7). 인덱스로만 훑는다.
     */
    syncCrowd(sim) {
        for (let li = 0; li < LANE_COUNT; li++) {
            const lane = sim.lanes[li];
            this.fanOut(lane.allies);
            this.fanOut(lane.enemies);
        }
    }

    /**
     * x 오름차순 배열을 훑으며 붙어 있는 구간마다 순번을 매겨 부채꼴 오프셋을 준다.
     * @param {object[]} arr x 로 정렬된 같은 편 엔티티 배열
     */
    fanOut(arr) {
        let rank = 0;
        let prevX = -Infinity;
        for (let i = 0; i < arr.length; i++) {
            const ent = arr[i];
            // 붙어 있으면 순번을 올리고, 떨어지면 새 무리로 리셋한다
            rank = ent.x - prevX < CROWD_RANGE ? rank + 1 : 0;
            prevX = ent.x;

            const spr = this.sprites.get(ent.id);
            if (!spr || !spr.active) continue;

            const target = CROWD_FAN[rank % CROWD_FAN.length];
            const cur = spr._crowdY ?? 0;
            spr._crowdY = cur + (target - cur) * PASS_LERP;
        }
    }

    squash(spr, sx, sy, ms) {
        this.scene.tweens.add({
            targets: spr,
            scaleX: spr._baseScale * sx,
            scaleY: spr._baseScale * sy,
            duration: ms * 0.4,
            yoyo: true,
            ease: "Quad.easeOut",
        });
    }

    /** ★ 씬 종료 시 반드시 호출 — 트윈·스프라이트 누수 방지 */
    destroy() {
        for (const spr of this.sprites.values()) {
            spr._outline = null; // 풀이 통째로 사라지므로 개별 반납은 의미가 없다
            this.scene.tweens.killTweensOf(spr);
            spr.destroy();
        }
        this.sprites.clear();
        this.outlinePool?.destroy();
        this.outlinePool = null;
    }

    get count() {
        return this.sprites.size;
    }
}
