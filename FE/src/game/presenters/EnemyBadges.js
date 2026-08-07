/**
 * 적 HP 바 + 태그 배지
 *
 * ★ 상성이 보이지 않으면 상성이 아니라 좌절이다.
 *   카툰워즈 3의 불투명한 속성 시스템이 남긴 교훈 —
 *   "AI가 4–5성 유닛을 스팸한다"는 불만의 실체는 정보 부재였다.
 *
 * 모든 적 위에 태그 아이콘을 **상시** 표시하고,
 * 내 편성이 그 태그에 취약하면 **붉게 점멸**시킨다.
 *
 * ★ 이름은 "적"이지만 실제로는 **엔티티 위·아래에 얹히는 것 전부**를 이 파일이
 *   맡는다 — 아군 체력바도, 발밑 피아 표식도 여기서 그린다. 한 루프·한
 *   Graphics 로 모으는 것이 요점이라 파일을 쪼개지 않았다 (아래 성능 주석).
 *
 * @see docs/02-design/18-ux-ui.md §2.3
 */
import presetData from "../data/presenters.json" with { type: "json" };
import { TAG } from "../logic/tags.js";

/**
 * 발밑 피아 표식 — 수치는 전부 `presenters.json:sideMark` 가 정한다.
 * ★ 색·크기를 코드에 박지 않는다 (절대규칙 4·5 의 정신). 그 파일의 `$sideMark`
 *   에 **왜** 이것이 필요한지가 적혀 있다.
 */
const SIDE = presetData.sideMark;
const SIDE_ALLY = Number(SIDE.ally.color);
const SIDE_ENEMY = Number(SIDE.enemy.color);

/**
 * 태그 → UI 아틀라스 프레임 (8×8, 아트 브리프 §5.6).
 *
 * ★ 이모지 글리프를 쓰지 않는다. 기기·OS 마다 글리프가 달라 어떤 기기에서는
 *   두부(□)가 되고, 크기·정렬을 제어할 수단도 없다. 상성 가독성이 이 게임
 *   설계의 핵심인데 그것을 폰트 렌더러 운에 맡길 수 없다.
 *   (CLAUDE.md 절대규칙 5 · 19-art-audio-direction.md §5.2)
 */
const TAG_FRAME = [
    [TAG.ARMORED, "ui/tag-armored"],
    [TAG.WARDED, "ui/tag-warded"],
    [TAG.FLYING, "ui/tag-flying"],
    [TAG.SWARM, "ui/tag-swarm"],
    [TAG.CORRUPT, "ui/tag-corrupt"],
    [TAG.SHIELDED, "ui/tag-shielded"],
    [TAG.REGEN, "ui/tag-regen"],
];

const MAX_BADGES = 3;
/** 8px 원본을 ×2 — 유닛(×4)보다 작아야 배지가 유닛을 덮지 않는다 */
const BADGE_SCALE = 2;
const BADGE_W = 8 * BADGE_SCALE;
const BADGE_GAP = 2;

export class EnemyBadges {
    constructor(scene) {
        this.scene = scene;
        /**
         * ★★★ **체력바는 `Graphics` **하나**에 전부 그린다** (2026-08-05).
         *
         *   예전에는 엔티티마다 `scene.add.graphics()` 를 하나씩 가졌다. 1-9 처럼
         *   동시 152체가 나오는 스테이지에서는 그것이 **Graphics 객체 125개**이고,
         *   Phaser 는 Graphics 를 만날 때마다 스프라이트 배치를 끊고 자체 배치를
         *   비운다 — 프레임당 드로우콜 125개가 그냥 늘어난다. 표시 목록도 그만큼
         *   길어져 `sortByDepth` 가 매 프레임 777개를 정렬하고 있었다.
         *
         *   실측(6× CPU 스로틀, 1-9, 180초): `GraphicsWebGLRenderer` 셀프타임
         *   3,721ms(2.0%) · `sortByDepth` 2,065ms(1.1%) · `badges.sync` 3,634ms.
         *
         *   체력바는 전부 같은 깊이(500)이므로 나눌 이유가 애초에 없었다.
         * @type {Phaser.GameObjects.Graphics}
         */
        this.bars = scene.add.graphics().setDepth(500);
        /**
         * 발밑 피아 표식 — **유닛 뒤**에 깔려야 하므로 체력바와 depth 가 다르다.
         *
         * ★ Graphics 는 depth 를 하나만 가지므로 `bars`(500) 와 합칠 수 없다.
         *   그래도 **엔티티마다 만들지 않는다** — 이 화면 전체에서 둘이 전부다
         *   (위 `bars` 주석의 교훈은 "Graphics 를 여러 개 두지 마라"가 아니라
         *   **"개체 수에 비례해 늘리지 마라"** 이다).
         * ★ 60 은 역병 장판(38) · 블록 표시(45) · 오라 링(50) · 보스(58) 위,
         *   유닛(100+) 아래다.
         * @type {Phaser.GameObjects.Graphics}
         */
        this.marks = scene.add.graphics().setDepth(60);
        /** @type {Map<number, {icons: Phaser.GameObjects.Image[], mask: number, shown: number, gen: number}>} */
        this.items = new Map();
        /**
         * 태그 아이콘 프리리스트 (절대규칙 8).
         * ★ 적 하나가 죽고 하나가 나올 때마다 이미지 3장을 만들고 부수고 있었다.
         *   웨이브 후반에는 초당 수십 번이다.
         * @type {Phaser.GameObjects.Image[]}
         */
        this.iconFree = [];
        /**
         * 이번 프레임 세대.
         * ★★ `new Set()` 과 `[...items.keys()]` 를 **매 프레임** 만들고 있었다
         *   (절대규칙 7). 세대 도장을 찍으면 할당이 0 이 된다 — Map 은 순회 중
         *   delete 가 안전하다.
         */
        this.gen = 0;
        /** 내 편성이 대응하지 못하는 태그 비트 — 붉은 점멸의 근거 */
        this.weakAgainst = 0;
    }

    /**
     * 편성을 분석해 "대응 불가 태그"를 계산한다.
     * @param {Array<object>} loadout
     */
    setLoadout(loadout) {
        let mask = 0;
        const hasArcane = loadout.some((u) => u.dmgType === "arcane");
        const hasHoly = loadout.some((u) => u.dmgType === "holy");
        const hasPhysical = loadout.some((u) => u.dmgType === "physical");
        const hasAntiAir = loadout.some(
            (u) => (u.tagMask & TAG.ANTI_AIR) !== 0 || u.dmgType !== "physical"
        );

        if (!hasArcane) mask |= TAG.ARMORED; // 장갑을 뚫을 수단이 없다
        if (!hasPhysical) mask |= TAG.WARDED;
        if (!hasHoly) mask |= TAG.CORRUPT;
        if (!hasAntiAir) mask |= TAG.FLYING; // 대공 수단이 없다
        this.weakAgainst = mask;
    }

    /** 아이콘 1장 대여 — 프리리스트가 비었을 때만 만든다 */
    acquireIcon() {
        const ic = this.iconFree.pop();
        if (ic) return ic;
        return this.scene.add
            .image(0, 0, "ui", TAG_FRAME[0][1])
            .setOrigin(0.5, 1)
            .setScale(BADGE_SCALE)
            .setDepth(501)
            .setVisible(false);
    }

    ensure(ent) {
        let it = this.items.get(ent.id);
        if (it) return it;

        // 배지는 최대 3개이므로 미리 잡아 두고 보이기/숨기기만 한다.
        const icons = [];
        for (let i = 0; i < MAX_BADGES; i++) icons.push(this.acquireIcon());

        // ★ `mask` 는 **숫자**다. 예전에는 `String(ent.tags)` 를 키로 썼는데,
        //   그것이 적 하나당 프레임 하나당 문자열 하나였다 (절대규칙 7).
        it = { icons, mask: -1, shown: 0, gen: this.gen };
        this.items.set(ent.id, it);
        return it;
    }

    remove(id) {
        const it = this.items.get(id);
        if (!it) return;
        for (const ic of it.icons) {
            ic.setVisible(false).clearTint().setAlpha(1);
            this.iconFree.push(ic);
        }
        it.icons.length = 0;
        this.items.delete(id);
    }

    /**
     * 발밑 피아 표식 하나를 그린다.
     *
     * ★★ **아군은 채운 타원 · 적은 빈 링.** 색이 아니라 **모양**이 1차 단서다 —
     *   색약 모드에서도, 배경이 붉게 물드는 방주 피격 연출 중에도 갈린다
     *   (실제로 그 장면에서 화면 전체가 분홍이 된다).
     *
     * ★ 크기를 스프라이트 폭에서 파생시킨다. 고정값이면 ×2 대형과 ×4 잡몹이
     *   같은 표식을 서로 다른 비율로 달게 된다 (외곽선이 같은 실수를 했었다).
     * ★ 할당이 없다 (절대규칙 7) — 프레임마다 전 엔티티가 지나는 자리다.
     *
     * @param {Phaser.GameObjects.Graphics} g 공유 Graphics (`this.marks`)
     * @param {object} ent 시뮬 엔티티
     * @param {Phaser.GameObjects.Sprite} spr
     */
    drawSideMark(g, ent, spr) {
        const w = Math.max(SIDE.minWidth, spr.displayWidth * SIDE.widthRatio);
        const h = w * SIDE.heightRatio;
        // 원점이 발밑(0.5, 1)이라 spr.y 가 곧 baseline 이다
        const y = spr.y + SIDE.offsetY;
        // ★ 소환 페이드·사망 페이드를 따라간다 — 표식만 남아 떠 있지 않게
        const a = spr.alpha;
        const ally = ent.isAlly;

        /**
         * ★★ **분할 수를 넘긴다.** Phaser 기본값은 32 인데 이 표식은 가로 40px
         *   남짓이고, 무엇보다 **개체마다 · 프레임마다** 도는 자리다 — 동시 200체면
         *   기본값으로 프레임당 6,400 조각이다 (체력바의 `fillRect` 는 2 조각).
         *   이 화면이 Graphics 때문에 한 번 느려졌던 적이 있다 (constructor 주석).
         */
        if (ally) {
            g.fillStyle(SIDE_ALLY, SIDE.ally.alpha * a);
            g.fillEllipse(spr.x, y, w, h, SIDE.smoothness);
        } else {
            g.lineStyle(SIDE.lineWidth, SIDE_ENEMY, SIDE.enemy.alpha * a);
            g.strokeEllipse(spr.x, y, w, h, SIDE.smoothness);
        }
    }

    /**
     * @param {object} sim
     * @param {import('./UnitPresenter.js').UnitPresenter} presenter
     * @param {number} timeMs
     */
    sync(sim, presenter, timeMs) {
        // ★ 할당 없이 "이번 프레임에 본 것"을 표시한다 (constructor 의 gen 주석 참조)
        const gen = ++this.gen;
        const g = this.bars;
        g.clear();
        const mk = this.marks;
        mk.clear();
        const actives = sim.actives;

        for (let i = 0; i < actives.length; i++) {
            const ent = actives[i];
            const spr = presenter.sprites.get(ent.id);
            if (!spr || !spr.active) continue;

            /**
             * ★★★ **발밑 피아 표식 — 체력바보다 먼저, 그리고 언제나** (2026-08-05).
             *
             *   아래의 "아군은 피해를 입은 뒤에만"이 바로 문제의 절반이었다:
             *   만피 아군에게는 화면에 단서가 **하나도 없었다.** 그래서 표식은
             *   `continue` 보다 **위**에 있어야 한다 — 아래로 내리면 정확히
             *   고치려던 그 경우에만 안 그려진다.
             */
            this.drawSideMark(mk, ent, spr);

            // ★ 아군은 **피해를 입은 뒤에만** 체력바를 띄운다.
            //   전원 상시 표시는 화면이 바로 막대밭이 된다 (동시 60기 이상).
            //   "누가 위험한가"만 읽히면 되고, 그게 유일하게 필요한 정보다.
            const ally = ent.isAlly;
            if (ally && ent.hp >= ent.hpMax) {
                this.remove(ent.id);
                continue;
            }

            const it = this.ensure(ent);
            it.gen = gen;

            // 아군 바는 조금 좁게 — 적 바와 한눈에 구분되게 한다
            const w = ally ? 32 : 40;
            const h = ally ? 4 : 5;
            const x = spr.x - w / 2;
            const y = spr.y - spr.displayHeight - 12;
            const ratio = Math.max(0, ent.hp / ent.hpMax);

            // ★ 공유 Graphics 에 그린다 (constructor 의 `bars` 주석 참조)
            g.fillStyle(0x000000, 0.6).fillRect(x - 1, y - 1, w + 2, h + 2);
            if (ally) {
                // 아군 = 초록 계열. 적(붉은색)과 색으로 즉시 구분된다
                g.fillStyle(0x14301c, 1).fillRect(x, y, w, h);
                g.fillStyle(ratio > 0.35 ? 0x5ac878 : 0xffb648, 1).fillRect(x, y, w * ratio, h);
            } else {
                g.fillStyle(0x3a1418, 1).fillRect(x, y, w, h);
                g.fillStyle(ratio > 0.35 ? 0xd04050 : 0xff6060, 1).fillRect(x, y, w * ratio, h);
            }

            // 태그 배지 — 적에게만 붙인다 (상성 정보는 적을 읽는 장치다)
            if (ally) {
                if (it.mask !== 0) {
                    for (const ic of it.icons) ic.setVisible(false);
                    it.mask = 0;
                    it.shown = 0;
                }
                continue;
            }

            // ★ 태그는 스폰 후에도 바뀐다 (보스 페이즈 전환, P6-05).
            //   마스크를 캐시해 바뀔 때만 프레임을 교체한다.
            if (ent.tags !== it.mask) {
                it.mask = ent.tags;
                let n = 0;
                for (const [bit, frame] of TAG_FRAME) {
                    if ((ent.tags & bit) === 0) continue;
                    it.icons[n].setFrame(frame).setVisible(true);
                    if (++n >= MAX_BADGES) break;
                }
                it.shown = n;
                for (let k = n; k < MAX_BADGES; k++) it.icons[k].setVisible(false);
            }

            // 가로로 나란히 — 배지 묶음을 유닛 중앙에 맞춘다
            const shown = it.shown;
            const total = shown * BADGE_W + Math.max(0, shown - 1) * BADGE_GAP;
            let bx = spr.x - total / 2 + BADGE_W / 2;
            // ★ 대응 불가 태그면 붉게 점멸 — 즉각적 피드백
            const weak = (ent.tags & this.weakAgainst) !== 0;
            const pulse = weak ? 0.55 + 0.45 * Math.sin(timeMs / 160) : 1;
            for (let k = 0; k < shown; k++) {
                const ic = it.icons[k];
                ic.setPosition(bx, y - 3);
                if (weak) ic.setTint(0xff4455).setAlpha(pulse);
                else ic.clearTint().setAlpha(1);
                bx += BADGE_W + BADGE_GAP;
            }
        }

        // 사라진 엔티티 정리.
        // ★ Map 은 순회 중 delete 가 안전하다 — 키 배열을 새로 만들지 않는다.
        for (const [id, it] of this.items) {
            if (it.gen !== gen) this.remove(id);
        }
    }

    destroy() {
        for (const [id] of this.items) this.remove(id);
        for (const ic of this.iconFree) ic.destroy();
        this.iconFree.length = 0;
        this.bars?.destroy();
        this.bars = null;
        // ★ 절대규칙 3 — 씬이 내려갈 때 남기지 않는다. 이것을 빠뜨리면 재도전마다
        //   빈 Graphics 가 하나씩 쌓인다 (테스트 D2 가 잡는다).
        this.marks?.destroy();
        this.marks = null;
    }
}
