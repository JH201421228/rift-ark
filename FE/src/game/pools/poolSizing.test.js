/**
 * 렌더 풀 크기 — **풀이 실제 부하보다 작지 않은가** (2026-08-05)
 *
 * ══════════════════════════════════════════════════════════════════
 * 왜 이 검사가 필요한가
 * ══════════════════════════════════════════════════════════════════
 * `SpritePool.acquire()` 는 풀이 마르면 **`grow()` 하지 않는다.** 대신
 * **가장 오래된 활성분을 회수**해 돌려준다. 그래서 풀이 모자란 증상은
 * 크래시도 경고도 아니고 **침묵**이다:
 *
 *   · 날아가던 발사체가 중간에 사라진다 ("맞지도 않고 없어진다")
 *   · 살아 있는 엘리트의 외곽선이 꺼진다
 *
 * 아무 테스트도 실패하지 않고, 눈으로 보는 사람만 "이상하다"고 느낀다.
 * 그러니 **재서 막는다.** 시뮬은 헤드리스로 돌릴 수 있으므로 브라우저 없이
 * 100 스테이지의 동시 최댓값을 뽑을 수 있다 (`tools/lib/pool-peaks.mjs`).
 *
 * ★ `grow()` 를 부르는 경로가 아예 없는 것은 아니다 — `EffectSystem.setCapacity`
 *   가 품질 티어 상향에서 부른다. 그것은 사용자가 전투 중에 설정을 올린
 *   순간뿐이고, 그 프레임 하나가 튀는 것은 감수한 대가다. 반면 **전투가
 *   스스로 풀을 넘기는 것**은 감수한 적이 없다 — 이 파일이 그것을 막는다.
 *
 * ★ 전수는 느리므로 **가장 무거운 대표**를 고른다 (`sim.test.js` 의 엔티티 풀
 *   블록과 같은 규약). 전수는 `npm run bench:pools` 가 한다.
 *
 * @see docs/03-tech/26-performance-budget.md §2 · §10-B
 */
import { describe, it, expect } from "vitest";
import { measurePeaks } from "../../../tools/lib/pool-peaks.mjs";
import { QUALITY_TIERS, PROJECTILE_POOL } from "../fx/quality.js";
import { SpritePool } from "./SpritePool.js";

/**
 * 발사체가 가장 많이 뜨는 판 + 엔티티가 가장 많은 판.
 * ★ 2026-08-05 전수 실측(100 스테이지 × 3 시드)에서 발사체 상위:
 *   1-13(49) · 1-8(44) · 2-6(44) · 1-11(38) · 1-12(32). 엔티티 최다는 1-9(136).
 *   1-14 는 제보가 온 판이다.
 *
 * ★★ **2-2 · 2-5 는 적이 쏘는 판이다** (2026-08-05). 원래 목록은 월드 1 이 다섯에
 *   2-6 하나였는데, **월드 1 에는 사거리 100 을 넘는 적이 한 종도 없다.** 적 11종에
 *   발사체 역할이 생긴 뒤에도 이 검사는 **바뀐 것을 한 번도 재지 않았다** —
 *   같은 풀을 이제 양 진영이 나눠 쓴다. (`tools/bench-sim.mjs` 도 같은 이유로 2-5 를 넣었다.)
 */
const HEAVY = ["1-8", "1-9", "1-11", "1-13", "1-14", "2-6", "2-2", "2-5"];

describe("렌더 풀 크기 — 전투가 풀을 넘기지 않는다", () => {
    it.each(HEAVY)("%s — 동시 발사체가 발사체 풀을 넘지 않는다", (stageId) => {
        let peak = 0;
        for (let seed = 1; seed <= 3; seed++) {
            peak = Math.max(peak, measurePeaks(stageId, seed).maxProjectiles);
        }
        expect(
            peak,
            `${stageId}: 동시 발사체 ${peak} > 풀 ${PROJECTILE_POOL} — ` +
                `SpritePool 은 마르면 가장 오래된 발사체를 회수한다. ` +
                `날아가던 것이 소리 없이 사라진다. data/quality.json 의 projectilePool 을 올려라`
        ).toBeLessThanOrEqual(PROJECTILE_POOL);
    });

    /**
     * ★ 검사가 실제로 발동하는가. 풀을 실측보다 작게 잡으면 잡혀야 한다.
     *   (이 줄이 없으면 위 블록은 "언제나 통과"와 구별되지 않는다)
     */
    it("★ 일부러 깨뜨리면 잡힌다 — 풀을 1 로 두면 전부 초과다", () => {
        const peak = measurePeaks("1-13", 1).maxProjectiles;
        expect(peak).toBeGreaterThan(1);
        expect(() => expect(peak).toBeLessThanOrEqual(1)).toThrow();
    });

    /**
     * 데미지 숫자는 사정이 다르다 — **일부러** 부하보다 작다.
     *
     * ★ 수명 창(620ms × 배속 상한) 안에 겹치는 숫자는 100 스테이지 전수에서
     *   최대 93개다. 풀은 30 이다. 이건 결함이 아니라 예산이다
     *   (26-performance-budget.md §2): 화면이 숫자로 덮이는 것보다 오래된 것이
     *   조금 일찍 사라지는 편이 낫다. 다만 **그 사실이 우연이 아니어야** 하므로
     *   여기에 못 박는다 — 풀이 창을 넘길 만큼 커지면 예산을 다시 논의하라는 뜻이다.
     */
    it("데미지 숫자 풀은 화면 예산이지 부하 추종이 아니다", () => {
        const peak = measurePeaks("1-9", 1).maxDamageTexts;
        expect(peak).toBeGreaterThan(QUALITY_TIERS.high.dmgText);
        // 예산은 절대 상한(§2 의 48) 안에 있어야 한다
        expect(QUALITY_TIERS.high.dmgText).toBeLessThanOrEqual(48);
    });
});

/**
 * `SpritePool` 의 **고갈 시 행동**을 못 박는다.
 *
 * ★★ 다음 사람이 "풀이 모자라면 늘리면 되지"라고 생각하는 것은 자연스럽다.
 *   그런데 `acquire()` 안에서 `grow()` 를 부르면 **가장 바쁜 프레임에**
 *   스프라이트 생성 + 텍스처 업로드 + 표시 목록 재정렬이 한꺼번에 일어난다.
 *   그것이 정확히 이 티켓이 쫓던 종류의 스파이크다. 늘리는 것은 **처음에** 한다.
 */
describe("SpritePool — 고갈되어도 전투 중에 커지지 않는다", () => {
    const fakeScene = (counters) => ({
        add: {
            sprite: () => {
                counters.made++;
                const s = {
                    setActive: () => s,
                    setVisible: () => s,
                    setDepth: () => s,
                    setAlpha: () => s,
                    setScale: () => s,
                    setAngle: () => s,
                    clearTint: () => s,
                    stop: () => s,
                    destroy: () => {},
                };
                return s;
            },
        },
        tweens: { killTweensOf: () => {} },
    });

    it("★★★ 상한을 넘겨 대여해도 스프라이트를 새로 만들지 않는다", () => {
        const counters = { made: 0 };
        const pool = new SpritePool(fakeScene(counters), "atlas", 4, 0, "f/0");
        expect(counters.made).toBe(4);

        const got = [];
        for (let i = 0; i < 40; i++) got.push(pool.acquire());

        expect(got.every(Boolean)).toBe(true);
        expect(pool.activeCount).toBe(4);
        expect(counters.made, "전투 중에 스프라이트가 새로 만들어졌다").toBe(4);
    });

    it("★ 일부러 깨뜨리면 잡힌다 — grow() 를 부르면 개수가 는다", () => {
        const counters = { made: 0 };
        const pool = new SpritePool(fakeScene(counters), "atlas", 4, 0, "f/0");
        pool.grow(9); // 품질 티어 상향이 하는 일 (EffectSystem.setCapacity)
        expect(counters.made).toBe(9);
    });
});

/**
 * ★★★ **게임이 영원히 멈추던 자리** (2026-08-05, 사용자 제보)
 *
 *   제보: "1-14 13웨이브쯤에서 멈춘다. **버튼조차 눌리지 않는다.** 앱을 꺼야 한다."
 *
 *   그것은 느림이 아니라 **무한 루프**였다. 예외였다면 스택이 풀리고 DOM 은 살아
 *   있어 버튼이 눌린다. GC·컨텍스트 손실도 입력을 막지 않는다. **메인 스레드가
 *   영원히 한 루프 안에 있을 때만** 그 셋이 동시에 성립한다.
 *
 *   범인은 두 성질의 조합이었다:
 *     ① `acquire()` 는 `free` 가 비면 최고령을 회수한다 → **activeCount 가 안 는다**
 *     ② 호출부가 `while (pool.activeCount < list.length)` 로 돌았다
 *   발사체 수가 풀 크기를 넘는 순간 조건이 영원히 참이고 `acquire()` 는 null 도
 *   아니어서 탈출구가 없었다. 후반 웨이브에서만·간헐적으로 나던 이유가 이것이다.
 *
 * ★ 아래 두 검사는 **그 성질 자체**를 못 박는다. 수치가 아니라 성질이므로
 *   풀 크기를 바꾸거나 스테이지가 늘어도 계속 유효하다.
 */
describe("풀 고갈이 무한 루프가 되지 않는다", () => {
    /** Phaser 없이 `SpritePool` 만 돌리기 위한 최소 스텁 */
    const stubScene = () => ({
        add: {
            sprite: () => {
                const o = {
                    setActive: () => o,
                    setVisible: () => o,
                    setDepth: () => o,
                    setAlpha: () => o,
                    setScale: () => o,
                    setAngle: () => o,
                    clearTint: () => o,
                    stop: () => o,
                };
                return o;
            },
        },
        tweens: { killTweensOf: () => {} },
    });

    it("★ 재활용은 activeCount 를 늘리지 않는다 — 이 성질을 모르고 while 을 쓰면 멈춘다", () => {
        const pool = new SpritePool(stubScene(), "tex", 3, 0, "f");
        for (let i = 0; i < 3; i++) expect(pool.acquire()).toBeTruthy();
        expect(pool.activeCount).toBe(3);

        // 풀이 말랐다 — 최고령 회수. 객체는 돌려주지만 활성 수는 그대로다.
        const recycled = pool.acquire();
        expect(recycled, "재활용은 null 이 아니다 (그래서 `if (!s) break` 로도 못 빠져나온다)").toBeTruthy();
        expect(pool.activeCount, "★ 여기가 늘어난다고 가정하면 호출부가 무한 루프가 된다").toBe(3);
    });

    it("★★ 시뮬 발사체가 풀보다 많아도 동기화가 끝난다 (무한 루프 재현)", () => {
        const pool = new SpritePool(stubScene(), "tex", 4, 0, "f");
        /** `BattleScene.syncProjectiles` 가 쓰는 것과 **같은 모양**의 대여 루프 */
        const sync = (simCount) => {
            const want = Math.min(simCount, pool.size);
            for (let n = pool.activeCount; n > want; n--) {
                pool.release(pool.active[pool.active.length - 1]);
            }
            for (let n = pool.activeCount; n < want; n++) {
                if (!pool.acquire()) break;
            }
            return simCount - pool.activeCount;
        };

        // 풀(4)보다 많은 발사체(9) — 예전 코드는 여기서 영원히 돌았다
        expect(sync(9)).toBe(5); // 그리지 못한 5개를 **센다**
        expect(pool.activeCount).toBe(4);
        // 줄어들 때도 정확히 맞춘다
        expect(sync(2)).toBe(0);
        expect(pool.activeCount).toBe(2);
    });

    it("활성이 아닌 스프라이트를 반납해도 free 가 오염되지 않는다", () => {
        const pool = new SpritePool(stubScene(), "tex", 2, 0, "f");
        const s = pool.acquire();
        pool.release(s);
        const freeBefore = pool.free.length;
        pool.release(s); // 두 번째 반납 — 무시되어야 한다
        expect(pool.free.length, "같은 객체가 free 에 두 번 들어가면 두 곳에서 동시에 쓰인다").toBe(
            freeBefore
        );
    });
});
