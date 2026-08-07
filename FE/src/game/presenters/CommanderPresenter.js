/**
 * 지휘관 + 오라 시각화
 *
 * ★ 이 게임의 시그니처 메커니즘.
 *   "지휘관 위치를 바꾸면 전투 결과가 눈에 띄게 달라진다"가 P3 게이트 항목이다.
 *   따라서 오라가 **어디까지 닿는지 한눈에 보여야** 한다.
 *
 * ★ SUPPORT 는 오라 *밖*에서만 작동한다는 반전을 시각적으로도 암시한다
 *   (링 바깥에 은은한 두 번째 테두리).
 *
 * @see docs/02-design/11-core-loop.md §4
 */
import presetData from "../data/presenters.json" with { type: "json" };
import { LANES, PIXEL_FONT, SPRITE_SCALE } from "../config.js";
import { assetUrl } from "../assetUrl.js";
// ★ "지휘관이 서 있는가" 의 단일 출처. 시간 항만 보면 죽은 그 틱에 살아 있는 것으로 읽힌다.
import { commanderUp } from "../logic/commanderHit.js";
// ★ 프레젠터는 React 가 아니다 — 모듈 스코프의 현재 언어를 읽는 t 를 직접 쓴다.
//   매 프레임 sync 하므로 언어가 바뀌면 다음 프레임에 따라온다.
import { t } from "@/i18n";

/**
 * 지휘관 평타 연출 값 (`presenters.json:commander.attack`).
 * ★ 이펙트 이름을 코드에 박지 않는다 (절대규칙 5) — 근거는 그 파일의 `$commander`.
 */
const CMD_ATTACK = presetData.commander.attack;
/** 지휘관 피격 연출 값 (`presenters.json:commander.hurt`) */
const CMD_HURT = presetData.commander.hurt ?? {};
/** ★ 재사용 옵션 객체 (절대규칙 7) — 피격은 공격보다 잦다 */
const CMD_HURT_FX_OPTS = { scale: CMD_HURT.effectScale ?? 1 };
/** ★ 재사용 옵션 객체 (절대규칙 7). `EffectSystem.play` 는 붙들지 않고 그 자리에서 읽는다. */
const CMD_FX_OPTS = { scale: CMD_ATTACK.effectScale ?? 1 };

/**
 * 지휘관 스프라이트 — FREE_Adventurer, 96×80 × 8프레임.
 *
 * ★★ **ATTACK 이 여기 있다** (2026-08-04). 한때 "지휘관은 시뮬에서 공격하지 않으므로
 *   IDLE·RUN 좌우 4장만 쓴다"고 적혀 있었는데, 지휘관 평타가 생기면서 그 전제가
 *   사라졌다 (`docs/02-design/20-commander-combat.md`). 에셋은 처음부터 있었다 —
 *   `asset/character/FREE_Adventurer .../ATTACK 1/`.
 *
 * ★ 유닛 스프라이트에 공격 애니메이션이 없다는 아트 제약(CLAUDE.md)은 **몬스터
 *   150종 이야기**다. 지휘관은 예외로 4종(IDLE·RUN·ATTACK 좌우)을 갖는다.
 */
const CMD_SHEETS = [
    "idle-right",
    "idle-left",
    "run-right",
    "run-left",
    "attack-right",
    "attack-left",
];
const CMD_FRAME = { width: 96, height: 80 };
const CMD_FRAMES = 8;

/**
 * ★★ 발끝 원점. 캐릭터는 96×80 프레임의 **y 24~57** 만 차지하고 아래로 22px 이
 *   투명 여백이다. 원점을 프레임 바닥(1.0)에 두면 배율 2에서 **44px 떠 보이고**,
 *   레인선 위에 그려지는 오라 원이 캐릭터보다 아래에 있는 것처럼 어긋난다
 *   ("원이 주인공 중심이 아니다"라는 제보의 실제 원인).
 *   시각적 발끝(y=58)을 원점으로 잡으면 배율과 무관하게 레인선에 정확히 선다.
 */
const CMD_FEET_ORIGIN_Y = 58 / CMD_FRAME.height;

const cmdKey = (name) => `cmd-${name}`;

/** 씬 preload 에서 호출 */
export function preloadCommander(scene) {
    for (const n of CMD_SHEETS) {
        const k = cmdKey(n);
        if (scene.textures.exists(k)) continue;
        scene.load.spritesheet(k, assetUrl(`sheets/cmd-${n}.png`), {
            frameWidth: CMD_FRAME.width,
            frameHeight: CMD_FRAME.height,
        });
    }
}

export class CommanderPresenter {
    constructor(scene, fx) {
        this.scene = scene;
        this.fx = fx;

        this.ring = scene.add.graphics().setDepth(50);
        this.sprite = null;
        this.downText = null;
        this.facing = "right";
        this.moving = false;
        /**
         * 평타 돌진 오프셋 (px).
         *
         * ★★ 스프라이트의 `x` 를 직접 트윈하지 않는다. `sync()` 가 매 프레임
         *   `c.x` 로 위치를 덮어쓰므로 트윈이 그 자리에서 지워진다 —
         *   지휘관은 시뮬이 좌표의 주인이고 연출은 **오프셋만** 얹을 수 있다.
         *   (공격 애니메이션 자체는 있다 — 돌진은 그 위에 무게를 더하는 용도다.
         *    19-art-audio-direction.md §2)
         */
        this.lunge = 0;
        this._lungeTween = null;
        /** 공격 애니메이션 재생 중 — updateAnim 이 이걸 보고 비켜선다 */
        this.attacking = false;
        /** 피격 틴트가 풀리는 시각 (ms). 0 이면 틴트 없음 */
        this._hurtUntil = 0;
        this.useArt = CMD_SHEETS.every((n) => scene.textures.exists(cmdKey(n)));
        this.buildSprite();
    }

    /**
     * 평타 연출 — 살짝 돌진했다 돌아오고, 맞은 자리에 이펙트 하나.
     *
     * @param {number} targetX 맞은 적의 x (디자인 좌표)
     * @param {number} y       레인 y
     * @param {number} cmdX    지휘관 x — 방향 판정용
     */
    playAttack(targetX, y, cmdX) {
        const dir = targetX >= cmdX ? 1 : -1;
        this.facing = dir > 0 ? "right" : "left";

        /**
         * ★★ 실제 **공격 스프라이트**를 재생한다 (2026-08-04).
         *   `updateAnim` 이 매 프레임 idle/run 으로 되돌리려 하므로, 재생이 끝날
         *   때까지 그 전환을 막는 플래그를 든다. 안 그러면 공격 1프레임만 보이고
         *   즉시 idle 로 덮인다.
         */
        if (this.useArt) {
            this.attacking = true;
            this.sprite.play(`cmd-anim-attack-${this.facing}`, true);
            this.sprite.once("animationcomplete", () => {
                this.attacking = false;
                // 끝나면 현재 상태에 맞는 애니메이션으로 되돌린다
                this.moving = null; // updateAnim 이 반드시 다시 play 하도록
            });
        }

        // ★ 트윈을 겹쳐 쌓지 않는다 — 공격 간격보다 짧게 끝내고, 이전 것은 죽인다
        this._lungeTween?.stop();
        this.lunge = 0;
        this._lungeTween = this.scene.tweens.add({
            targets: this,
            lunge: dir * 9,
            duration: 90,
            yoyo: true,
            ease: "Quad.easeOut",
            onComplete: () => {
                this.lunge = 0;
                this._lungeTween = null;
            },
        });

        this.fx?.play(CMD_ATTACK.effect, targetX, y, CMD_FX_OPTS);
    }

    /**
     * 피격 연출 — 흰 틴트 한 번.
     *
     * ★★★ 2026-08-05 이전에는 **지휘관이 맞는 일 자체가 없었다** (보스 슬램 제외).
     *   일반 적이 지휘관을 노리게 되면서(`logic/engage.js:tryHitCommander`) 이
     *   연출이 필요해졌다 — 화면에 아무 반응이 없으면 플레이어는 "왜 갑자기
     *   쓰러졌지?" 만 남는다. 기절은 이미 알파 0.3 + "재출격 N" 으로 보인다.
     *
     * ★ 유닛과 같은 수단(틴트 플래시)을 쓴다. 지휘관 스프라이트는 시뮬이 좌표의
     *   주인이라 넉백 트윈을 얹을 수 없다 (`this.lunge` 주석 참조).
     */
    playHurt() {
        const spr = this.sprite;
        if (!spr) return;
        spr.setTintFill(0xffffff);
        this._hurtUntil = this.scene.time.now + (CMD_HURT.tintMs ?? 70);
        if (CMD_HURT.effect) this.fx?.play(CMD_HURT.effect, spr.x, spr.y - 24, CMD_HURT_FX_OPTS);
    }

    buildSprite() {
        if (this.useArt) {
            for (const n of CMD_SHEETS) {
                const anim = `cmd-anim-${n}`;
                if (this.scene.anims.exists(anim)) continue;
                this.scene.anims.create({
                    key: anim,
                    frames: this.scene.anims.generateFrameNumbers(cmdKey(n), {
                        start: 0,
                        end: CMD_FRAMES - 1,
                    }),
                    // 달릴 때가 더 빨라야 이동이 읽힌다
                    frameRate: n.startsWith("run") ? 12 : n.startsWith("attack") ? 16 : 8,
                    // ★ 공격만 1회 재생이다. 반복시키면 평타 간격(900ms)보다 오래
                    //   휘둘러서 "계속 칼질하는 사람"이 된다.
                    repeat: n.startsWith("attack") ? 0 : -1,
                });
            }

            this.sprite = this.scene.add
                .sprite(LANES.arkX + 120, LANES.ground[1].y, cmdKey("idle-right"))
                .setOrigin(0.5, CMD_FEET_ORIGIN_Y)
                .setScale(SPRITE_SCALE.commander)
                .setDepth(400);
            this.sprite.play("cmd-anim-idle-right");
            return;
        }

        // ── 폴백: 스프라이트시트가 없을 때(패킹 전) 도형으로 대체 ──
        // ★ generateTexture 는 (0,0) 부터 캡처하므로 반드시 양수 좌표에 그린다.
        const key = "__commander_placeholder";
        if (!this.scene.textures.exists(key)) {
            const g = this.scene.make.graphics({ x: 0, y: 0, add: false });
            g.fillStyle(0x2a1a08, 1);
            g.fillRect(0, 0, 24, 56); // 아웃라인
            g.fillStyle(0xffe0a0, 1);
            g.fillRect(4, 2, 16, 14); // 머리
            g.fillStyle(0xf2b33d, 1);
            g.fillRect(2, 16, 20, 38); // 몸통
            g.fillStyle(0xb45ad6, 1);
            g.fillRect(18, 20, 6, 26); // 균열빛 무기
            g.generateTexture(key, 24, 56);
            g.destroy();
        }

        this.sprite = this.scene.add
            .sprite(LANES.arkX + 120, LANES.ground[1].y, key)
            .setOrigin(0.5, 1)
            .setScale(SPRITE_SCALE.commander)
            .setDepth(400);
    }

    /**
     * 이동 방향·상태에 맞는 애니메이션으로 전환한다.
     * ★ 같은 애니메이션이면 다시 play 하지 않는다 — 매 프레임 재시작하면
     *   1프레임에서 멈춘 것처럼 보인다.
     */
    updateAnim(c) {
        if (!this.useArt) return;
        // ★ 공격 재생 중에는 idle/run 으로 덮지 않는다 (playAttack 참조)
        if (this.attacking) return;

        const dx = c.targetX - c.x;
        const moving = Math.abs(dx) > 1;
        // 멈출 때는 마지막 방향을 유지한다 — 제자리에서 방향이 튀지 않는다
        const facing = moving ? (dx > 0 ? "right" : "left") : this.facing;

        if (moving === this.moving && facing === this.facing) return;
        this.moving = moving;
        this.facing = facing;
        this.sprite.play(`cmd-anim-${moving ? "run" : "idle"}-${facing}`, true);
    }

    /**
     * @param {object} sim
     * @param {number} timeMs
     */
    sync(sim, timeMs) {
        const c = sim.commander;
        const y = LANES.ground[c.lane].y;
        /**
         * ★★★ **술어는 두 항이다 — `hp > 0` 과 `t >= downUntil`** (2026-08-07 수정).
         *
         *   여기는 시간 항만 보고 있었다. 지휘관이 죽는 그 틱에는 `downUntil` 이
         *   아직 0 이라(타이머는 다음 틱의 `stepCommander` 가 건다) **HP 0 인
         *   지휘관이 살아 있는 것으로 읽힌다** — 그 프레임에 오라 링이 그대로
         *   그려졌다. 시뮬에서는 이미 오라가 꺼져 있으므로 화면이 거짓말을 한다.
         *
         *   CLAUDE.md 가 경고한 바로 그 사고이고, `commanderTarget.test.js` 의
         *   `downUntil` 검사기가 이것을 못 잡은 이유는 그 검사기가 `logic/` **한
         *   폴더만** 훑기 때문이다. 렌더러는 범위 밖이었다.
         */
        const down = !commanderUp(sim);

        // ★ 연출 오프셋은 시뮬 좌표 **위에** 얹는다 (좌표의 주인은 시뮬)
        this.sprite.setPosition(c.x + this.lunge, y);
        this.sprite.setAlpha(down ? 0.3 : 1);
        // 피격 틴트 해제 — `UnitPresenter` 의 `_tintUntil` 과 같은 규약이다
        if (this._hurtUntil && timeMs >= this._hurtUntil) {
            this.sprite.clearTint();
            this._hurtUntil = 0;
        }
        this.updateAnim(c);

        // 미세 바운스 — 아이들 애니메이션이 있으면 불필요하다 (이중으로 흔들린다)
        if (!down && !this.useArt) this.sprite.y = y - Math.abs(Math.sin(timeMs / 700)) * 3;

        // ★ 사거리는 **시뮬 설정**에서 온다 (절대규칙 4). 숫자를 여기 적지 않는다.
        this.drawAura(c, y, down, timeMs, sim.cfg?.commanderAttack?.range ?? 0);

        if (down) {
            const left = Math.ceil((c.downUntil - sim.t) / 1000);
            if (!this.downText) {
                this.downText = this.scene.add
                    .text(0, 0, "", {
                        fontFamily: PIXEL_FONT,
                        fontSize: "20px",
                        color: "#ff6070",
                    })
                    .setOrigin(0.5, 1)
                    .setDepth(520);
            }
            this.downText.setText(t("battle.commanderRespawn", { n: left })).setPosition(c.x, y - 70).setVisible(true);
        } else if (this.downText) {
            this.downText.setVisible(false);
        }
    }

    /**
     * 지휘관 오라.
     *
     * ★ **원의 중심은 지휘관의 발밑이다.** 시뮬이 오라를 (x, 레인y) 좌표계의
     *   원으로 판정하고(`aura.js`), 레인 간격이 곧 실제 거리이므로 이 원은
     *   기하학적으로 정확하다.
     *
     * ★★ 그런데 스프라이트가 발밑을 기준으로 위로 서 있어서, 캐릭터가 원의
     *   위쪽에 치우쳐 보인다 — "원이 주인공 중심이 아니다"라는 제보가 실제로 나왔다.
     *   원을 캐릭터 몸통 중심으로 옮기면 보기는 좋아지지만 **오라 판정과 어긋난다**
     *   (거짓말하는 UI가 된다). 대신 중심에 앵커를 그려 "여기가 기준점"임을 밝힌다.
     */
    drawAura(c, y, down, timeMs, attackRange = 0) {
        this.ring.clear();
        if (down) return;

        const r = c.auraRadius;
        const pulse = 0.5 + 0.5 * Math.sin(timeMs / 500);

        /**
         * ★★★ **평타 사거리 — 원이 아니라 그 레인의 띠다** (2026-08-07, 전수조사 ③).
         *
         *   화면이 그리던 유일한 도형은 오라 원(192)이고 평타 사거리는 140 이다.
         *   게다가 오라는 원이라 레인 간격 96 을 넘어 **이웃 레인을 ±166px 까지
         *   덮는다.** 실측: 전투 시간의 35~54% 동안 "금색 원 안에 서 있는 적을
         *   지휘관이 절대 때리지 않는" 그림이 화면에 있었다. 시뮬은 정상인데
         *   플레이어가 읽을 수 있는 단서가 **틀린 원 하나뿐**이었다.
         *
         *   띠로 그리면 '같은 레인만' 과 '이만큼만' 이 **한 도형으로 동시에** 읽힌다.
         *
         * ★ 오라보다 **먼저** 그린다 — 오라의 채움(alpha 0.06)이 위에 얹혀야
         *   두 영역이 겹치는 구간이 더 밝아지고, 그 겹침이 곧 "때릴 수 있으면서
         *   오라도 걸린 자리"다.
         */
        const band = CMD_ATTACK.rangeBand;
        if (attackRange > 0 && band) {
            const h = band.height ?? 40;
            const color = Number(band.color ?? 0xf2b33d);
            this.ring.fillStyle(color, band.fillAlpha ?? 0.1);
            this.ring.fillRect(c.x - attackRange, y - h / 2, attackRange * 2, h);
            this.ring.lineStyle(1, color, band.edgeAlpha ?? 0.45);
            this.ring.strokeRect(c.x - attackRange, y - h / 2, attackRange * 2, h);
        }

        // 채워진 영역 — 어디까지 닿는지 즉시 읽힌다
        this.ring.fillStyle(0xf2b33d, 0.06);
        this.ring.fillCircle(c.x, y, r);

        // 주 테두리
        this.ring.lineStyle(2, 0xf2b33d, 0.35 + pulse * 0.25);
        this.ring.strokeCircle(c.x, y, r);

        // ★ 바깥 테두리 — SUPPORT 는 이 바깥에서만 작동한다는 암시
        this.ring.lineStyle(1, 0x6ee07a, 0.18);
        this.ring.strokeCircle(c.x, y, r + 8);

        // ★ 중심 앵커 — 원이 어디를 기준으로 그려졌는지 밝힌다.
        //   발밑 타원 + 십자. 이것 하나로 "치우쳐 있다"는 인상이 사라진다.
        this.ring.fillStyle(0xf2b33d, 0.22);
        this.ring.fillEllipse(c.x, y, 34, 12);
        this.ring.lineStyle(1, 0xf2b33d, 0.55);
        this.ring.strokeEllipse(c.x, y, 34, 12);
        this.ring.lineStyle(1, 0xf2b33d, 0.7);
        this.ring.lineBetween(c.x - 6, y, c.x + 6, y);
        this.ring.lineBetween(c.x, y - 4, c.x, y + 4);
    }

    destroy() {
        // ★ 절대규칙 3 — 트윈을 반드시 죽인다. 씬이 죽은 뒤 this.lunge 를 만지면
        //   해제된 객체를 건드린다.
        this._lungeTween?.stop();
        this._lungeTween = null;
        this.attacking = false;
        this.sprite?.off("animationcomplete");
        this.ring.destroy();
        this.sprite?.destroy();
        this.downText?.destroy();
    }
}
