/**
 * 전투 이벤트 → 효과음 배선 테스트 (P3-14)
 *
 * ★ "sfx() 를 정의만 하고 아무도 부르지 않았다"가 이 기능의 원래 상태였다.
 *   배선이 실제로 걸려 있는지는 테스트할 수 있다 — 소리가 나는지는 못 해도.
 */
import { describe, it, expect, beforeEach } from "vitest";
import SFX_DATA from "../data/sfx.json" with { type: "json" };
import { EV } from "../logic/events.js";
import { BattleSfx } from "./BattleSfx.js";
import { SFX } from "./sfxKeys.js";

/** 엔진 대역 — 실제로 무엇을 재생하려 했는지만 기록한다 */
function recorder() {
    const calls = [];
    return { calls, play: (key, seed) => calls.push({ key, seed }) };
}

/** 이벤트 큐 슬롯과 같은 모양 */
const ev = (type, a = 0, b = 0, c = 0, d = 0, s = "") => ({ type, a, b, c, d, s });

describe("BattleSfx 이벤트 배선", () => {
    let bs;
    let rec;
    /** @type {Map<number, object>} */
    let world;

    beforeEach(() => {
        world = new Map();
        bs = new BattleSfx((id) => world.get(id) ?? null);
        rec = recorder();
        bs.engine = rec;
    });

    it("아군 소환만 소리를 낸다 — 적 스폰은 웨이브마다 수십 마리다", () => {
        bs.onEvent(ev(EV.SPAWN, 7, 0, 1)); // c=1 아군
        bs.onEvent(ev(EV.SPAWN, 8, 0, 0)); // c=0 적
        expect(rec.calls).toEqual([{ key: SFX.SUMMON, seed: 7 }]);
    });

    it("데미지 타입마다 다른 타격음이 난다 — 상성이 귀로도 구분된다", () => {
        world.set(1, { dmgType: "physical" });
        world.set(2, { dmgType: "arcane" });
        world.set(3, { dmgType: "holy" });
        bs.onEvent(ev(EV.ATTACK, 1));
        bs.onEvent(ev(EV.ATTACK, 2));
        bs.onEvent(ev(EV.ATTACK, 3));
        expect(rec.calls.map((c) => c.key)).toEqual([
            SFX.HIT_PHYSICAL,
            SFX.HIT_ARCANE,
            SFX.HIT_HOLY,
        ]);
    });

    it("공격자를 못 찾으면 조용히 넘어간다 (같은 틱에 죽은 유닛)", () => {
        expect(() => bs.onEvent(ev(EV.ATTACK, 999))).not.toThrow();
        expect(rec.calls).toEqual([]);
    });

    it("무효(d=1)는 블록음, 약점(d=2)은 치명타음, 일반(d=0)은 무음", () => {
        bs.onEvent(ev(EV.DAMAGE, 5, 10, 0, 1));
        bs.onEvent(ev(EV.DAMAGE, 5, 10, 0, 2));
        bs.onEvent(ev(EV.DAMAGE, 5, 10, 0, 0));
        bs.onEvent(ev(EV.DAMAGE, 5, 10, 0, 3)); // 저항 — 타격음으로 충분하다
        expect(rec.calls.map((c) => c.key)).toEqual([SFX.BLOCK, SFX.HIT_CRITICAL]);
    });

    it("아군 사망과 적 사망은 다른 소리다", () => {
        bs.onEvent(ev(EV.DEATH, 11, 0, 1));
        bs.onEvent(ev(EV.DEATH, 12, 0, 0));
        expect(rec.calls.map((c) => c.key)).toEqual([SFX.DEATH_ALLY, SFX.DEATH_ENEMY]);
    });

    it("방주 피격 · 보스 예고 · 보스 착탄이 전부 배선되어 있다", () => {
        bs.onEvent(ev(EV.BREACH, 3));
        bs.onEvent(ev(EV.MODE_BOSS_TELEGRAPH, 4));
        bs.onEvent(ev(EV.MODE_BOSS_SLAM, 4));
        expect(rec.calls.map((c) => c.key)).toEqual([
            SFX.ARK_HIT,
            SFX.BOSS_TELEGRAPH,
            SFX.BOSS_SLAM,
        ]);
    });

    it("각인 선택과 진화가 배선되어 있다", () => {
        bs.onEvent(ev(EV.SIGIL_TAKEN, 1));
        bs.onEvent(ev(EV.EVOLUTION, 0));
        expect(rec.calls.map((c) => c.key)).toEqual([SFX.SIGIL_PICK, SFX.SIGIL_EVOLVE]);
    });

    it("배선된 모든 키가 sfx.json 에 정의되어 있다", () => {
        world.set(1, { dmgType: "physical" });
        world.set(2, { dmgType: "arcane" });
        world.set(3, { dmgType: "holy" });
        for (const t of Object.values(EV)) {
            for (const c of [0, 1]) {
                for (const d of [0, 1, 2, 3]) {
                    bs.onEvent(ev(t, 1, 0, c, d));
                }
            }
        }
        expect(rec.calls.length).toBeGreaterThan(0);
        for (const call of rec.calls) expect(SFX_DATA.sounds[call.key]).toBeDefined();
    });

    it("피치 씨앗은 엔티티 id 다 — 유닛마다 높이가 다르게 들린다", () => {
        bs.onEvent(ev(EV.DEATH, 42, 0, 0));
        expect(rec.calls[0].seed).toBe(42);
    });

    it("알 수 없는 이벤트에도 터지지 않는다", () => {
        expect(() => bs.onEvent(ev(9999))).not.toThrow();
        expect(rec.calls).toEqual([]);
    });

    it("destroy 는 울리던 소리를 끊고 참조를 놓는다", () => {
        let stopped = 0;
        bs.engine = { play: () => {}, stopAll: () => stopped++ };
        bs.destroy();
        expect(stopped).toBe(1);
        expect(bs.findEntity).toBeNull();
    });
});
