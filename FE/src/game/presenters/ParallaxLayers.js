/**
 * 시차 스크롤 배경
 *
 * ★ 가로 레인 게임에서 지면을 타일맵으로 그릴 필요가 없다.
 *   TileSprite 3–4레이어면 드로우콜 4개로 깊이감이 나온다.
 *   Tiled 는 레벨 *데이터*(레인·스폰·소품 위치)로만 쓴다.
 *
 * ★ 정식 배경(월드 10개 × 4레이어 = 40장)을 쓴다.
 *   `sky` 는 스크롤하지 않고, `far`/`mid` 는 서로 다른 속도로 흐르고,
 *   `ground` 는 레인이 놓이는 바닥이라 고정이다.
 *
 * ★★ **도형 폴백을 남겨 둔다.**
 *   배경은 `npm run assets:pack` 산출물이고 `public/assets/bg/` 는 gitignore 다.
 *   클론 직후·패킹 전에는 파일이 없으며, 그때 검은 화면이 뜨면 원인을 찾는 데
 *   시간이 걸린다. 텍스처가 없으면 조용히 도형 배경으로 떨어진다.
 *
 * @see docs/02-design/19-art-audio-direction.md §3.2
 * @see docs/05-art-briefs/40-image-production-brief.md §2
 */
import { DESIGN, LANES } from "../config.js";
import { assetUrl } from "../assetUrl.js";

/**
 * 배경 레이어 4종 — 파일명 접미사 · 스크롤 계수 · 깊이 · **y 배치**
 *
 * ★ y 는 아트 브리프 §2.1 이 규정한 값이다. 계산으로 유도하지 않는다.
 *   레이어 높이(720/480/400/240)와 배치 y 가 서로 맞물려 설계되어 있어서
 *   "하단 정렬" 같은 규칙으로 유도하면 어긋난다 (실제로 far/mid 가 160px 떴다).
 */
/**
 * 배경 타일 폭. 디자인 폭의 3배 — 21:9 초광폭에서도 남는다.
 * ★ 절대 바꾸지 않는다. TileSprite 는 setSize() 로 늘린 영역을 그리지 않는다.
 */
const COVER_WIDTH = 3840;

const LAYER_SPEC = [
    { key: "sky", factor: 0, depth: 0, y: 0 },
    { key: "far", factor: 0.15, depth: 1, y: 240 },
    { key: "mid", factor: 0.45, depth: 2, y: 320 },
    { key: "ground", factor: 0, depth: 3, y: 480 },
];

/** 도형 폴백용 월드 색조 — 배경 아트가 없을 때만 쓴다 */
const WORLD_PALETTE = {
    1: { sky: [0x101a14, 0x1c2b1e], far: 0x2b3524, mid: 0x3d4a30, ground: 0x4a5638 },
    2: { sky: [0x18140f, 0x2e2b28], far: 0x3a332c, mid: 0x4a423a, ground: 0x5a4a38 },
    3: { sky: [0x0d1612, 0x1a2b22], far: 0x22332a, mid: 0x2d4436, ground: 0x35503f },
    4: { sky: [0x1a1512, 0x332b26], far: 0x3f352d, mid: 0x4f4238, ground: 0x5c4d3e },
    5: { sky: [0x0f0e1c, 0x1b1a35], far: 0x252347, mid: 0x2f2c5c, ground: 0x3a3670 },
    6: { sky: [0x0a0d10, 0x151a20], far: 0x1c252c, mid: 0x243038, ground: 0x2c3a44 },
    7: { sky: [0x1a0c0a, 0x2b1512], far: 0x421c15, mid: 0x5a2418, ground: 0x6e2e1c },
    8: { sky: [0x0f0714, 0x1a0f22], far: 0x261431, mid: 0x331b40, ground: 0x40224f },
    9: { sky: [0x181510, 0x2a2620], far: 0x3a342a, mid: 0x4a4335, ground: 0x5a5140 },
    10: { sky: [0x0c0c12, 0x151520], far: 0x1f1f2e, mid: 0x2a2a3d, ground: 0x33334a },
};

/** 텍스처 키 — 월드별로 분리한다 (씬 재진입 시 재사용) */
export const bgKey = (worldId, layer) => `bg-w${worldId}-${layer}`;

/**
 * 씬 preload 에서 호출 — **그 월드 4장만** 로드한다.
 *
 * ★ 40장을 전부 로드하면 월드 1 전투가 월드 10 배경까지 받는다 (3.3MB).
 *   한 전투에 필요한 것은 4장(약 300KB)뿐이다.
 */
export function preloadWorldBackground(scene, worldId) {
    for (const { key } of LAYER_SPEC) {
        const k = bgKey(worldId, key);
        if (scene.textures.exists(k)) continue;
        scene.load.image(k, assetUrl(`bg/w${worldId}-${key}.png`));
    }
}

export class ParallaxLayers {
    /**
     * @param {Phaser.Scene} scene
     * @param {number} worldId
     * @param {number} layerCount 품질 티어로 조절 (3 또는 4)
     */
    constructor(scene, worldId = 1, layerCount = 4) {
        this.scene = scene;
        this.worldId = worldId;
        this.pal = WORLD_PALETTE[worldId] ?? WORLD_PALETTE[1];
        this.layerCount = layerCount;
        this.scrollSpeed = 8; // px/초 — 전장이 흐르는 느낌만 준다
        this.layers = [];
        this.objects = [];
        /** resize 때 다시 맞출 배경 타일 */
        this.tiles = [];

        // 4장이 모두 있어야 아트 배경을 쓴다. 일부만 있으면 톤이 섞여 더 나쁘다.
        this.useArt = LAYER_SPEC.every(({ key }) => scene.textures.exists(bgKey(worldId, key)));
        if (this.useArt) this.buildArt();
        else this.buildFallback();
    }

    /* ── 아트 배경 ──────────────────────────────────────────── */

    buildArt() {
        // ★★ 보이는 폭에 딱 맞추지 않고 **넉넉하게 한 번만** 만든다.
        //
        //   처음에는 뷰포트 폭에 맞춰 만들고 resize 때 `setSize()` 로 늘렸는데,
        //   TileSprite 는 크기를 바꿔도 **바뀐 영역이 그려지지 않아** 오른쪽에
        //   캔버스 클리어 색(#0F0F1E)이 그대로 드러났다 (실측: 캔버스 x1400~1535).
        //   타일은 어차피 무한 반복이므로 화면비가 아무리 넓어도 덮을 만큼
        //   크게 만들어 두고 **크기를 절대 바꾸지 않는 것**이 옳다.
        //   카메라가 잘라내므로 실제 래스터화 비용은 보이는 만큼이다.
        const left = DESIGN.width / 2 - COVER_WIDTH / 2;

        for (const spec of LAYER_SPEC) {
            // 품질 티어 3 에서는 far 를 생략한다 (드로우콜·필레이트 절약)
            if (this.layerCount < 4 && spec.key === "far") continue;

            const key = bgKey(this.worldId, spec.key);
            const h = this.scene.textures.get(key).getSourceImage().height;

            // ★ TileSprite 로 만든다 — 가로로 무한 반복되므로 이음새 없이 흐른다.
            //   원본이 좌우 미러 타일로 제작되어 있다 (아트 브리프 §2.2).
            const t = this.scene.add
                .tileSprite(left, spec.y, COVER_WIDTH, h, key)
                .setOrigin(0, 0)
                .setDepth(spec.depth)
                .setScrollFactor(0);

            this.objects.push(t);
            this.tiles.push({ obj: t, spec });
            if (spec.factor > 0) this.layers.push({ obj: t, factor: spec.factor, tile: true });
        }

        this.drawLaneGuides(true);
    }

    /**
     * 품질 티어가 바뀌었다 (26-performance-budget.md §4).
     *
     * ★ 레이어 수는 생성 시점에 정해지므로 통째로 다시 만든다. 설정 화면에서
     *   티어를 바꾸는 빈도로는 이 비용이 문제가 되지 않고, "다음 전투부터
     *   적용됩니다"는 사용자에게 **설정이 안 먹는 것**과 구별되지 않는다.
     */
    setLayerCount(n) {
        const count = Math.max(1, Math.round(n));
        if (count === this.layerCount) return;
        this.layerCount = count;
        this.destroy();
        if (this.useArt) this.buildArt();
        else this.buildFallback();
    }

    /**
     * 화면 크기가 바뀌었다. **배경만** 다시 맞춘다.
     * ★ 좌표계는 안 바뀌므로 유닛·HUD·시뮬은 아무것도 할 일이 없다.
     */
    resize() {
        // 배경 타일은 넉넉히 만들어 두었으므로 손댈 것이 없다.
        // 레인 가이드만 새 폭으로 다시 그린다.
        this.laneGuides?.destroy();
        const i = this.objects.indexOf(this.laneGuides);
        if (i >= 0) this.objects.splice(i, 1);
        this.laneGuides = null;
        this.drawLaneGuides(this.useArt);
    }

    /* ── 도형 폴백 ──────────────────────────────────────────── */

    buildFallback() {
        const { height } = DESIGN;
        const left = DESIGN.width / 2 - COVER_WIDTH / 2;
        const width = COVER_WIDTH;
        const top = LANES.hud.topH;
        const bottom = height - LANES.hud.bottomH;

        const sky = this.scene.add.graphics().setDepth(0).setScrollFactor(0);
        sky.fillGradientStyle(this.pal.sky[0], this.pal.sky[0], this.pal.sky[1], this.pal.sky[1], 1);
        sky.fillRect(left, 0, width, height);
        this.objects.push(sky);

        if (this.layerCount >= 4) {
            this.layers.push(this.silhouette(this.pal.far, top + 60, 90, 0.15, 200, 1));
        }
        this.layers.push(this.silhouette(this.pal.mid, top + 130, 120, 0.45, 300, 2));

        const g = this.scene.add.graphics().setDepth(3);
        g.fillStyle(this.pal.ground, 1);
        g.fillRect(left, bottom - 60, width, 60 + LANES.hud.bottomH);
        this.objects.push(g);
        this.groundGraphics = g;

        this.drawLaneGuides();
    }

    /**
     * 반복 실루엣 레이어 (폴백 전용).
     * @returns {{obj: Phaser.GameObjects.Container, factor: number}}
     */
    silhouette(color, y, h, factor, seed, depth) {
        const c = this.scene.add.container(0, 0).setDepth(depth);
        const g = this.scene.add.graphics();
        g.fillStyle(color, 1);

        // 결정론적 의사난수 — 렌더가 시뮬 RNG 를 건드리지 않는다
        let s = seed;
        const rnd = () => {
            s = (s * 1103515245 + 12345) & 0x7fffffff;
            return s / 0x7fffffff;
        };

        // 화면 2배 폭으로 그려 이음새 없이 순환시킨다
        const w = DESIGN.width * 2;
        let x = 0;
        while (x < w) {
            const bw = 40 + rnd() * 90;
            const bh = h * (0.5 + rnd() * 0.5);
            g.fillRect(x, y + (h - bh), bw, bh);
            x += bw + rnd() * 30;
        }

        c.add(g);
        this.objects.push(c);
        return { obj: c, factor };
    }

    /**
     * 레인 구분선.
     *
     * ★★ **배경이 예뻐질수록 레인은 더 안 보인다.**
     *   도형 배경 위에서 충분했던 실선(검정 0.25 / 흰색 0.05)이 디테일한
     *   픽셀 배경 위에서는 그냥 사라진다. "내 유닛이 어느 레인에 있는가"는
     *   이 게임에서 가장 자주 하는 판단이고, 소환 레인 지정의 전제이기도 하다.
     *   아트 배경일 때는 **레인 바닥에 어두운 띠**를 깔아 유닛이 앉을 자리를 만든다.
     *
     * @param {boolean} onArt 아트 배경 위인가
     */
    drawLaneGuides(onArt = false) {
        const g = this.scene.add.graphics().setDepth(4);
        const left = DESIGN.width / 2 - COVER_WIDTH / 2;
        const right = left + COVER_WIDTH;

        LANES.ground.forEach((lane) => {
            if (onArt) {
                // 유닛 발밑 그림자 띠 — 배경 디테일을 눌러 실루엣을 세운다
                g.fillStyle(0x000000, 0.28);
                g.fillRect(left, lane.y - 6, COVER_WIDTH, 12);
                g.fillStyle(0x000000, 0.14);
                g.fillRect(left, lane.y - 14, COVER_WIDTH, 8);
            }
            g.lineStyle(2, 0x000000, onArt ? 0.5 : 0.25);
            g.lineBetween(left, lane.y + 1, right, lane.y + 1);
            g.lineStyle(1, 0xffffff, onArt ? 0.12 : 0.05);
            g.lineBetween(left, lane.y, right, lane.y);
        });

        this.objects.push(g);
        this.laneGuides = g;
    }

    /* ── 갱신 ───────────────────────────────────────────────── */

    /** 매 프레임 호출 */
    update(deltaMs) {
        const dx = (this.scrollSpeed * deltaMs) / 1000;
        for (const l of this.layers) {
            if (l.tile) {
                // TileSprite 는 tilePositionX 로 흐른다 — 이음새가 없다
                l.obj.tilePositionX += dx * l.factor;
                continue;
            }
            l.obj.x -= dx * l.factor;
            // 화면 1폭만큼 흐르면 되돌린다 (2배 폭으로 그렸으므로 이음새가 없다)
            if (l.obj.x <= -DESIGN.width) l.obj.x += DESIGN.width;
        }
    }

    destroy() {
        for (const o of this.objects) o.destroy();
        this.objects.length = 0;
        this.layers.length = 0;
        // ★ tiles 도 비운다. setLayerCount 가 destroy → build 로 다시 만들기 때문에,
        //   여기서 안 비우면 파괴된 TileSprite 참조가 쌓인다.
        this.tiles.length = 0;
        this.groundGraphics = null;
        this.laneGuides = null;
    }
}
