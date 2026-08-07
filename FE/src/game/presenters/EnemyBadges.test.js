/**
 * 체력바·태그 배지 — **프레임당 만드는 것이 없어야 한다** (2026-08-05)
 *
 * ══════════════════════════════════════════════════════════════════
 * 이 테스트가 지키는 것
 * ══════════════════════════════════════════════════════════════════
 * 예전 구현은 엔티티마다 `scene.add.graphics()` 를 하나씩 가졌다. 1-9 처럼
 * 동시 152체가 나오는 스테이지에서는 **Graphics 객체 125개**이고, Phaser 는
 * Graphics 를 만날 때마다 스프라이트 배치를 끊는다 — 프레임당 드로우콜이
 * 그만큼 늘고 표시 목록도 그만큼 길어진다.
 *
 * 실측(6× CPU 스로틀 = 중급 스마트폰 대역, 1-9, 180초):
 *   · 표시 목록 777개 → **653개** (Graphics 124개가 사라졌다)
 *   · `GraphicsWebGLRenderer` 3,721ms → 2,568ms
 *   · `sortByDepth` 2,065ms → 1,789ms
 *   · `badges.sync` 3,634ms(평균 0.392ms) → 2,322ms(평균 0.234ms)
 *
 * 그리고 `sync()` 는 매 프레임 `new Set()` 과 `[...items.keys()]` 를 만들고,
 * 적 하나당 `String(ent.tags)` 를 하나씩 만들고 있었다 (절대규칙 7).
 *
 * ★ 여기서 재는 것은 속도가 아니라 **개수**다. 기기마다 다른 값은 회귀 검사가
 *   될 수 없지만, "프레임마다 몇 개를 새로 만드는가"는 어디서 돌려도 같다.
 *
 * @see docs/03-tech/26-performance-budget.md §5
 */
import { describe, it, expect, beforeEach } from "vitest";
import { EnemyBadges } from "./EnemyBadges.js";
import { TAG } from "../logic/tags.js";

function fakeScene(counters) {
    const chain = (obj) => obj;
    const graphics = () => {
        counters.graphics++;
        const g = {
            clear: () => g,
            fillStyle: () => g,
            fillRect: () => g,
            fillEllipse: () => {
                counters.ellipses++;
                return g;
            },
            lineStyle: () => g,
            strokeEllipse: () => {
                counters.ellipses++;
                return g;
            },
            setDepth: () => g,
            destroy: () => {
                counters.graphicsDestroyed++;
            },
        };
        return g;
    };
    const image = () => {
        counters.images++;
        const im = {
            setOrigin: () => im,
            setScale: () => im,
            setDepth: () => im,
            setVisible: () => im,
            setFrame: () => im,
            setPosition: () => im,
            setTint: () => im,
            clearTint: () => im,
            setAlpha: () => im,
            destroy: () => {
                counters.imagesDestroyed++;
            },
        };
        return chain(im);
    };
    return { add: { graphics, image } };
}

/** 시뮬 엔티티 대역 — 배지가 읽는 필드만 갖는다 */
const ent = (id, tags = TAG.ARMORED, isAlly = false) => ({
    id,
    isAlly,
    hp: 50,
    hpMax: 100,
    tags,
});

/** UnitPresenter 대역 — 스프라이트 위치만 있으면 된다 */
function fakePresenter(ids) {
    const sprites = new Map();
    for (const id of ids) {
        sprites.set(id, {
            x: 100 + id,
            y: 300,
            displayWidth: 64,
            displayHeight: 64,
            alpha: 1,
            active: true,
        });
    }
    return { sprites };
}

const sim = (ents) => ({ actives: ents });

describe("체력바·배지 — 프레임당 생성 0", () => {
    let counters;
    let badges;

    beforeEach(() => {
        counters = {
            graphics: 0,
            images: 0,
            ellipses: 0,
            graphicsDestroyed: 0,
            imagesDestroyed: 0,
        };
        badges = new EnemyBadges(fakeScene(counters));
        badges.setLoadout([{ dmgType: "physical", tagMask: 0 }]);
    });

    /**
     * ★ 명제는 "Graphics 가 **1개**"가 아니라 **"개체 수와 무관하게 고정"** 이다.
     *   지금은 둘이다 — 체력바(유닛 **위**)와 발밑 피아 표식(유닛 **아래**)은
     *   depth 가 달라야 하고 Graphics 는 depth 를 하나만 갖는다. 지켜야 할 것은
     *   개수의 **상한**이지 특정 숫자가 아니다.
     */
    it("★★★ Graphics 는 적이 몇이든 같은 개수다", () => {
        const many = [];
        for (let i = 0; i < 120; i++) many.push(ent(i));
        const p = fakePresenter(many.map((e) => e.id));
        for (let f = 0; f < 30; f++) badges.sync(sim(many), p, f * 16);
        const withMany = counters.graphics;

        // ★ 생성자가 이미 Graphics 를 만든다 — 기준점은 `new` **앞**에서 잡는다
        const before = counters.graphics;
        const solo = new EnemyBadges(fakeScene(counters));
        solo.sync(sim([ent(1)]), fakePresenter([1]), 0);
        const withOne = counters.graphics - before;

        expect(withMany, "적 120체에 Graphics 가 개체 수만큼 늘었다").toBe(withOne);
        expect(withMany, "Graphics 가 화면당 두 개(체력바 · 발밑 표식)를 넘는다").toBeLessThanOrEqual(2);
    });

    /**
     * ★★★ **만피 아군에게도 표식이 그려진다** — 이 테스트의 존재 이유다.
     *   체력바는 "피해를 입은 뒤에만" 뜨므로(바로 아래 테스트), 표식이 그
     *   `continue` 아래로 내려가면 **정확히 고치려던 경우에만 사라진다.**
     */
    it("★★★ 만피 아군도 발밑 표식은 그려진다 (체력바가 없는 그 경우가 문제였다)", () => {
        const ally = ent(1, 0, true);
        ally.hp = ally.hpMax;
        badges.sync(sim([ally]), fakePresenter([1]), 0);
        expect(counters.ellipses, "만피 아군에게 아무 표식도 없다").toBe(1);
        expect(badges.items.size, "체력바까지 생기면 화면이 막대밭이 된다").toBe(0);
    });

    it("적과 아군 모두 표식을 받는다 (개체 수만큼 정확히)", () => {
        const ents = [ent(1), ent(2), ent(3, 0, true)];
        badges.sync(sim(ents), fakePresenter([1, 2, 3]), 0);
        expect(counters.ellipses).toBe(3);
    });

    it("★★ 첫 프레임 뒤로는 아무것도 새로 만들지 않는다", () => {
        const ents = [];
        for (let i = 0; i < 60; i++) ents.push(ent(i));
        const p = fakePresenter(ents.map((e) => e.id));

        badges.sync(sim(ents), p, 0);
        const after1 = counters.graphics + counters.images;

        for (let f = 1; f < 60; f++) badges.sync(sim(ents), p, f * 16);
        expect(counters.graphics + counters.images).toBe(after1);
    });

    /**
     * ★ 교체가 일어나는 **그 한 프레임**에는 두 세대가 겹친다 — 새 적을 세운 뒤에야
     *   누가 사라졌는지 알 수 있기 때문이다(세대 도장). 그래서 프리리스트의
     *   최고 수위는 "동시 최대 × 2 세대"에서 멈추고, **그 뒤로는 자라지 않는다.**
     *   이 테스트가 지키는 것은 "0 개 생성"이 아니라 **"수위가 고정된다"** 이다.
     */
    it("★★ 웨이브가 몇 번 갈려도 아이콘 생성은 한 번 수위를 잡은 뒤 멈춘다", () => {
        const wave = (w) => {
            const next = [];
            for (let i = 0; i < 20; i++) next.push(ent(w * 1000 + i));
            return next;
        };

        let ents = wave(0);
        badges.sync(sim(ents), fakePresenter(ents.map((e) => e.id)), 0);
        expect(counters.images).toBe(20 * 3);

        // 첫 교체에서 수위가 두 세대분으로 오른다
        ents = wave(1);
        badges.sync(sim(ents), fakePresenter(ents.map((e) => e.id)), 100);
        const highWater = counters.images;
        expect(highWater).toBe(20 * 3 * 2);

        // 그 뒤로는 교체를 아무리 반복해도 새로 만들지 않는다
        for (let w = 2; w <= 20; w++) {
            ents = wave(w);
            badges.sync(sim(ents), fakePresenter(ents.map((e) => e.id)), w * 100);
        }
        expect(counters.images).toBe(highWater);
        expect(counters.imagesDestroyed).toBe(0);
    });

    it("사라진 엔티티는 정리된다 — 아이콘이 화면에 남지 않는다", () => {
        const ents = [ent(1), ent(2), ent(3)];
        const p = fakePresenter([1, 2, 3]);
        badges.sync(sim(ents), p, 0);
        expect(badges.items.size).toBe(3);

        badges.sync(sim([ent(1)]), fakePresenter([1]), 16);
        expect(badges.items.size).toBe(1);
        expect(badges.iconFree.length).toBe(6);
    });

    it("태그가 바뀌면 프레임을 교체한다 (보스 페이즈 전환)", () => {
        const e = ent(1, TAG.ARMORED);
        const p = fakePresenter([1]);
        badges.sync(sim([e]), p, 0);
        const it = badges.items.get(1);
        expect(it.mask).toBe(TAG.ARMORED);

        e.tags = TAG.ARMORED | TAG.FLYING;
        badges.sync(sim([e]), p, 16);
        expect(it.mask).toBe(TAG.ARMORED | TAG.FLYING);
        expect(it.shown).toBe(2);
    });

    it("만점 아군은 체력바를 갖지 않는다 — 화면이 막대밭이 되지 않게", () => {
        const ally = ent(1, 0, true);
        ally.hp = ally.hpMax;
        const p = fakePresenter([1]);
        badges.sync(sim([ally]), p, 0);
        expect(badges.items.size).toBe(0);

        ally.hp = 10;
        badges.sync(sim([ally]), p, 16);
        expect(badges.items.size).toBe(1);
    });

    it("destroy() 가 공유 Graphics 와 아이콘을 모두 치운다 (절대규칙 3)", () => {
        const ents = [ent(1), ent(2)];
        badges.sync(sim(ents), fakePresenter([1, 2]), 0);
        const made = counters.graphics;
        badges.destroy();
        expect(badges.items.size).toBe(0);
        // ★ 만든 Graphics 를 **전부** 치운다 — 숫자를 박으면 하나 더 늘어난 날
        //   그 하나만 조용히 남는다 (재도전마다 하나씩 쌓인다)
        expect(counters.graphicsDestroyed).toBe(made);
        expect(counters.imagesDestroyed).toBe(counters.images);
    });
});
