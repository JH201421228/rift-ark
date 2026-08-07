/**
 * 데미지 숫자 — **한 개당 비용이 0 에 가까운가** (2026-08-05)
 *
 * ══════════════════════════════════════════════════════════════════
 * 이 테스트가 지키는 것
 * ══════════════════════════════════════════════════════════════════
 * 1-14 후반에서 게임이 멈춘다는 제보의 정체는 이 클래스였다. 6× CPU 스로틀에서
 * 200ms 를 넘긴 프레임의 내용물은 언제나 같았다 —
 * 프레임 171ms 중 `dmgText.show` 가 **70ms.**
 *
 * 원인은 두 가지였고 둘 다 코드에서 보이지 않았다:
 *   ① Phaser `Text` 는 문자열이 바뀌면 캔버스를 다시 그리고 GPU 텍스처를 다시
 *      올린다(0.85ms). 스타일을 바꾸면 `setStyle` 이 속성표 30개를 훑는다(2.04ms).
 *   ② 숫자마다 트윈을 1~2개씩 만들고 있었다 (동시 108개).
 *
 * 그래서 **BitmapText + 직접 보간**으로 옮겼다 (실측 0.0098ms).
 *
 * ★ 여기서 재는 것은 시간이 아니라 **횟수**다. "빠른가"는 기기마다 다르지만
 *   "몇 번 만드는가"는 어디서 돌려도 같다. 다음 사람이 편의로 트윈 한 줄을
 *   붙이거나 `Text` 로 되돌리는 순간 여기서 막힌다.
 *
 * @see docs/03-tech/26-performance-budget.md §10-B
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LANGS, DEFAULT_LANG, setLang } from "@/i18n";

// ★ `../config.js` 는 phaser 를 import 한다 (node 환경에는 window 가 없다).
//   여기서 필요한 것은 폰트 이름 문자열 하나뿐이라 그것만 대역으로 세운다.
vi.mock("../config.js", () => ({ PIXEL_FONT: "Mulmaru" }));

const { DamageTextPool, DAMAGE_GLYPHS } = await import("./DamageTextPool.js");

/**
 * Phaser `BitmapText` 의 **비용 구조**만 흉내 낸 대역.
 *
 * ★ `setText`/`setFont`/`setFontSize` 는 전부 "다음 렌더에 글리프 목록을 다시
 *   만든다"는 표시(_dirty)일 뿐이다 — 캔버스도 텍스처 업로드도 없다.
 *   `setFont` 만 폰트 데이터를 갈아 끼우므로 따로 센다.
 */
function fakeBitmapText(counters, font) {
    const t = {
        text: "",
        font,
        fontSize: 0,
        x: 0,
        y: 0,
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        visible: false,
        setText(v) {
            if (v !== t.text) {
                t.text = v;
                counters.setText++;
            }
            return t;
        },
        setFont(key) {
            t.font = key;
            counters.setFont++;
            return t;
        },
        setFontSize(n) {
            t.fontSize = n;
            counters.setFontSize++;
            return t;
        },
        setOrigin: () => t,
        setDepth: () => t,
        setActive: () => t,
        setVisible: (v) => {
            t.visible = v;
            return t;
        },
        setPosition: (x, y) => {
            t.x = x;
            t.y = y;
            return t;
        },
        setAlpha: (a) => {
            t.alpha = a;
            return t;
        },
        setScale: (s) => {
            t.scaleX = s;
            t.scaleY = s;
            return t;
        },
        destroy: () => {
            counters.destroyed++;
        },
    };
    return t;
}

/** 구워진 글리프 표 — `bakeDamageFont` 가 실제로 그린 문자만 들어간다 */
function fakeScene(counters) {
    const baked = new Set();
    const fonts = new Map();
    return {
        baked,
        fonts,
        add: {
            bitmapText: (_x, _y, key) => {
                counters.made++;
                return fakeBitmapText(counters, key);
            },
            // ★ `Text` 로 되돌리면 여기서 잡힌다 — 대역이 아예 없다
            text: () => {
                throw new Error("데미지 숫자는 Phaser Text 를 쓰지 않는다");
            },
        },
        tweens: {
            add() {
                counters.tweens++;
                return {};
            },
            killTweensOf: () => {},
        },
        textures: {
            exists: (k) => counters.textures.has(k),
            createCanvas: (k, w, h) => {
                counters.textures.add(k);
                counters.bakes++;
                return {
                    getContext: () => ({
                        set font(v) {
                            this._f = v;
                        },
                        get font() {
                            return this._f;
                        },
                        textBaseline: "top",
                        fillStyle: "#fff",
                        measureText: (c) => ({ width: c.charCodeAt(0) > 127 ? 32 : 18 }),
                        fillText: (c) => baked.add(c),
                    }),
                    refresh: () => {},
                    setFilter: (f) => {
                        counters.filter = f;
                    },
                    width: w,
                    height: h,
                };
            },
        },
        cache: {
            bitmapFont: {
                exists: (k) => fonts.has(k),
                add: (k, v) => fonts.set(k, v),
            },
        },
    };
}

/** `globalThis.document` 대역 — 폭 계측용 캔버스 하나 */
const installDocument = () => {
    globalThis.document = {
        fonts: { check: () => true },
        createElement: () => ({
            getContext: () => ({
                font: "",
                measureText: (c) => ({ width: c.charCodeAt(0) > 127 ? 32 : 18 }),
            }),
        }),
    };
};

/** show() 가 낼 수 있는 모든 갈래 */
const KINDS = [
    { dmgType: "physical" },
    { dmgType: "arcane" },
    { dmgType: "holy" },
    { dmgType: "arcane", effective: true },
    { dmgType: "holy", resisted: true },
    { dmgType: "physical", crit: true },
    { absorbed: true },
    { heal: true },
];

describe("데미지 숫자 — 호출당 비용", () => {
    let counters;
    let scene;
    let pool;

    beforeEach(() => {
        installDocument();
        counters = {
            made: 0,
            setText: 0,
            setFont: 0,
            setFontSize: 0,
            tweens: 0,
            destroyed: 0,
            bakes: 0,
            textures: new Set(),
            filter: null,
        };
        scene = fakeScene(counters);
        pool = new DamageTextPool(scene, 8);
        counters.setText = 0;
        counters.setFont = 0;
        counters.setFontSize = 0;
    });

    // ★ 언어는 모듈 스코프의 값 하나다 — 한 테스트가 바꾸면 뒤의 테스트가 그것을 본다
    afterEach(() => setLang(DEFAULT_LANG));

    it("★★★ show() 는 트윈을 하나도 만들지 않는다", () => {
        for (let i = 0; i < 200; i++) pool.show(i, i, 100 + i, KINDS[i % KINDS.length]);
        expect(counters.tweens).toBe(0);
    });

    it("★★ show() 한 번에 문자열 갱신은 많아야 한 번이다", () => {
        const N = 200;
        for (let i = 0; i < N; i++) pool.show(i, i, 100 + i, KINDS[i % KINDS.length]);
        expect(counters.setText).toBeLessThanOrEqual(N);
    });

    it("★★ 색이 그대로면 폰트를 갈아 끼우지 않는다", () => {
        // 같은 종류만 200번 — 첫 8번(풀 크기)만 색이 바뀐다
        for (let i = 0; i < 200; i++) pool.show(i, i, 100 + i, { dmgType: "physical" });
        expect(counters.setFont).toBeLessThanOrEqual(pool.size);
    });

    it("★★★ 폰트는 **전투당 한 번** 굽는다 (그리고 두 번째 풀은 굽지 않는다)", () => {
        expect(counters.bakes).toBe(1);
        // 같은 씬에 풀을 하나 더 만들어도 텍스처·폰트 캐시는 게임 전역이다
        new DamageTextPool(scene, 4);
        expect(counters.bakes).toBe(1);
    });

    /**
     * ★★★ **언어마다 따로 검사한다** (2026-08-07).
     *
     *   폰트는 전투당 한 번 굽고 텍스처·폰트 캐시는 **게임 전역**이라 다시
     *   굽히지 않는다. 그런데 언어는 설정에서 **전투 밖에서** 바뀐다. 현재
     *   언어의 글자만 구우면 한국어로 한 판 돈 뒤 영어로 바꾼 다음 판에서
     *   `Weak!` 의 A–Z 가 폰트에 없고, Phaser BitmapText 는 없는 글자를
     *   **경고 없이 건너뛴다** — 데미지 숫자가 통째로 · 조용히 사라진다.
     *
     *   그래서 **한 번 구운 폰트**로 두 언어의 문구를 전부 낼 수 있어야 한다.
     *   아래 루프는 그것을 그대로 흉내 낸다: 풀은 `beforeEach` 에서 한 번만
     *   만들어졌고(=폰트도 그때 한 번 구워졌고), 언어만 바꿔 가며 문구를 낸다.
     */
    it("★★★ 한 번 구운 폰트로 **모든 언어**의 모든 문구를 그릴 수 있다", () => {
        // 색약 표기까지 켜서 최대 문자 집합을 만든다
        pool.setColorBlind(true);

        const emitted = new Set();
        for (const lang of LANGS) {
            setLang(lang);
            // 실제로 만들어진 문구를 모은다
            for (const kind of KINDS) pool.show(0, 0, 1234567890, kind);
            for (const t of [...pool.active, ...pool.free]) {
                for (const ch of t.text) emitted.add(ch);
            }
        }

        expect(LANGS.length).toBeGreaterThan(1);
        expect(emitted.size).toBeGreaterThan(0);
        for (const ch of emitted) {
            expect(
                scene.baked.has(ch),
                `'${ch}' 가 폰트에 없다 — BitmapText 는 조용히 건너뛴다`
            ).toBe(true);
        }
        // 선언한 글리프 집합 자체도 전부 구워져 있어야 한다
        for (const ch of DAMAGE_GLYPHS) expect(scene.baked.has(ch)).toBe(true);
    });

    /**
     * ★★ **검사기를 깨뜨려 확인한다.** 위 테스트가 실제로 무언가를 지키는지는
     *   "빠뜨렸을 때 빨개지는가"로만 알 수 있다. 여기서는 그 반대편을 고정한다 —
     *   두 언어의 문구가 **실제로 다른 글자를 쓰는가.** 만약 어느 날 영어 문구가
     *   비어 한국어로 폴백하면(= `t()` 의 `?? entry.ko`) 위 루프는 언어를 하나만
     *   돈 것과 같아지고, 그때 이 테스트가 먼저 터진다.
     */
    it("★★ 두 언어의 상성 문구는 서로 다른 글자를 쓴다 (폴백이면 여기서 걸린다)", () => {
        // ★ 낱말이 들어가는 갈래만 본다. 회복(`+42`)과 평타(`42`)는 두 언어에서
        //   같은 것이 **정상**이다 — 숫자에는 번역할 것이 없다.
        const WORD_KINDS = [
            { dmgType: "arcane", effective: true },
            { dmgType: "holy", resisted: true },
            { absorbed: true },
        ];
        const textsOf = (lang) => {
            setLang(lang);
            const out = new Set();
            const p = new DamageTextPool(scene, 8);
            p.setColorBlind(true);
            for (const kind of WORD_KINDS) p.show(0, 0, 42, kind);
            for (const x of [...p.active, ...p.free]) if (x.text) out.add(x.text);
            return out;
        };
        const ko = textsOf("ko");
        const en = textsOf("en");
        for (const label of ko) {
            expect(en.has(label), `'${label}' 이 두 언어에서 같다 — 영어 번역이 비었을 수 있다`)
                .toBe(false);
        }
    });

    /**
     * ★★★ **UV 를 빠뜨리면 아무것도 그려지지 않는다** (2026-08-05, 실제로 겪음).
     *
     *   `BatchChar` 는 글리프의 `u0/v0/u1/v1` 을 그대로 정점에 싣는다. 없으면
     *   사각형은 배치에 들어가는데 화면에는 **한 픽셀도 남지 않는다.** 그런데
     *   `width`·`height`·`getTextBounds()` 는 전부 정상으로 보이고, 예외도
     *   경고도 없다 — 눈으로 보기 전까지 아무도 모른다. 그래서 여기서 센다.
     */
    it("★★★ 글리프마다 UV 가 있다 (없으면 소리 없이 안 그려진다)", () => {
        for (const [key, entry] of scene.fonts) {
            const chars = Object.values(entry.data.chars);
            expect(chars.length, `${key} 에 글리프가 없다`).toBeGreaterThan(0);
            for (const g of chars) {
                for (const k of ["u0", "v0", "u1", "v1"]) {
                    expect(Number.isFinite(g[k]), `${key} 글리프에 ${k} 가 없다`).toBe(true);
                    expect(g[k]).toBeGreaterThanOrEqual(0);
                    expect(g[k]).toBeLessThanOrEqual(1);
                }
                expect(g.u1).toBeGreaterThan(g.u0);
                expect(g.v1).toBeGreaterThan(g.v0);
            }
        }
    });

    it("★★ update() 가 수명이 끝난 숫자를 풀에 돌려준다 (트윈 onComplete 대신)", () => {
        pool.show(10, 20, 42, { dmgType: "physical" });
        expect(pool.activeCount).toBe(1);
        pool.update(300);
        expect(pool.activeCount).toBe(1); // 아직 살아 있다
        pool.update(400);
        expect(pool.activeCount).toBe(0);
        expect(pool.free.length).toBe(pool.size);
    });

    it("★ update() 는 떠오르며 흐려진다 — 얼어붙지 않는다", () => {
        pool.show(100, 200, 42, { dmgType: "physical" });
        const t = pool.active[0];
        pool.update(310); // 절반
        expect(t.y).toBeLessThan(200);
        expect(t.alpha).toBeLessThan(1);
        expect(t.alpha).toBeGreaterThan(0);
    });

    it("density=off 는 아무것도 만들지 않는다", () => {
        pool.setDensity("off");
        for (let i = 0; i < 50; i++) pool.show(i, i, 999, {});
        expect(counters.setText).toBe(0);
        expect(pool.activeCount).toBe(0);
    });

    it("풀이 마르면 가장 오래된 것을 회수한다 (조용히 사라지지 않는다)", () => {
        for (let i = 0; i < pool.size + 5; i++) pool.show(i, i, 100 + i, {});
        expect(pool.activeCount).toBe(pool.size);
    });
});
