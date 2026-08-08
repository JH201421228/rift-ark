/**
 * 보상형 광고 규칙 검증 (2026-08-07).
 *
 * ★★★ **여기서 지키는 것은 "광고가 뜨는가"가 아니라 "광고가 경제를 깨지 않는가"다.**
 *
 *   `docs/06-release/55-monetization-decision.md` 의 계산이 남긴 결론은 명확하다 —
 *   이 게임의 골드원은 **캠페인 클리어 하나뿐**이라 배수를 무제한으로 주면
 *   총수입이 그대로 배가 되고, `npm run economy` 의 여유(0.79~1.30배)가
 *   1.6~2.6배가 되어 40–60 구간의 벽이 사라진다. 그러면 설계 결정 5
 *   ("벽은 항상 편성 퍼즐이고 절대 경제 벽이 아니다")가 "광고를 봤는가"로 뒤집힌다.
 *
 *   그 사고를 막는 유일한 장치가 **상한**이다. 아래 검사는 그 상한이 실재하는지,
 *   그리고 손상된 세이브가 상한을 **푸는 방향**으로 작동하지 않는지를 본다.
 */
import { describe, it, expect } from "vitest";
import {
    canWatchAd,
    adBonusGold,
    recordView,
    viewsLeft,
    dayKey,
    adAllowedForStage,
    AD_ENABLED,
    AD_REWARD_MULT,
    AD_DAILY_VIEWS,
    AD_COOLDOWN_MS,
} from "./adReward.js";
import ADS from "../data/ads.json" with { type: "json" };

/** 하루 상한을 실제로 검사하려면 기능이 켜져 있다고 가정해야 한다 */
const skipIfOff = AD_ENABLED ? it : it.skip;

const T0 = 1_800_000_000_000; // 임의의 고정 시각. `Date.now()` 를 쓰지 않는다 (절대규칙 1)
const STAGE = "2-5"; // 전역 인덱스 25 — ads.json 의 허용 범위 안

describe("보상형 광고 — 데이터 규약", () => {
    it("★★ 수치가 전부 데이터에 있다 (코드에 박혀 있지 않다)", () => {
        expect(AD_REWARD_MULT).toBe(ADS.rewardMult);
        expect(AD_DAILY_VIEWS).toBe(ADS.dailyViews);
        expect(AD_COOLDOWN_MS).toBe(ADS.cooldownMs);
    });

    it("★★★ 하루 상한이 실재한다 — 이것이 경제를 지키는 유일한 장치다", () => {
        expect(
            Number.isInteger(ADS.dailyViews) && ADS.dailyViews > 0,
            "dailyViews 가 없거나 0 이하면 광고 보상이 무제한이 된다 — " +
                "골드원이 클리어 하나뿐이라 총수입이 그대로 배가 되고 " +
                "40–60 구간의 편성 퍼즐이 사라진다 (55-monetization-decision.md §2)"
        ).toBe(true);
        expect(ADS.dailyViews).toBeLessThanOrEqual(20);
    });

    it("★ 초반 스테이지에는 광고를 제안하지 않는다", () => {
        expect(ADS.minStage).toBeGreaterThan(1);
        expect(adAllowedForStage("1-1")).toBe(false);
        expect(adAllowedForStage("1-2")).toBe(false);
    });

    it("★ 캠페인 밖의 id 는 통과하지 않는다 (NaN 인덱스 방어)", () => {
        expect(adAllowedForStage("tower-12")).toBe(false);
        expect(adAllowedForStage("")).toBe(false);
    });

    it("★★ 실제 광고 단위 id 없이 기능이 켜져 있지 않다", () => {
        if (!ADS.enabled) return; // 아직 계정이 없다 — 정상 상태
        expect(
            ADS.units.android || ADS.units.ios,
            "enabled 를 켰는데 광고 단위 id 가 비어 있다 (docs/06-release/56 §1)"
        ).toBeTruthy();
    });
});

describe("보상 계산", () => {
    it("배수가 아니라 **증분**을 돌려준다", () => {
        // 화면이 '이미 받은 것'과 '광고로 더 받은 것'을 구분해 보여 줄 수 있어야 한다
        expect(adBonusGold(1000)).toBe(Math.round(1000 * AD_REWARD_MULT) - 1000);
    });

    it("0 이하·비정상 입력에서 음수를 내지 않는다", () => {
        for (const v of [0, -5, NaN, null, undefined, "abc"]) expect(adBonusGold(v)).toBe(0);
    });
});

describe("하루 경계", () => {
    it("★★ 로컬 자정이 기준이다 — UTC 로 자르면 한국에서 오전 9시에 초기화된다", () => {
        const KST = -540; // UTC+9
        const utcMidnight = 1_800_000_000_000 - (1_800_000_000_000 % 86_400_000);
        // UTC 자정 직후는 KST 로는 이미 오전 9시 — 같은 '어제'여야 한다
        expect(dayKey(utcMidnight + 1000, KST)).toBe(dayKey(utcMidnight - 1000, KST));
    });

    it("자정을 넘기면 상한이 초기화된다", () => {
        const st = { day: dayKey(T0, 0), views: AD_DAILY_VIEWS, lastAtMs: T0 };
        expect(viewsLeft(st, T0, 0)).toBe(0);
        expect(viewsLeft(st, T0 + 86_400_000, 0)).toBe(AD_DAILY_VIEWS);
    });
});

describe("시청 가능 판정", () => {
    skipIfOff("아무것도 안 본 상태에서는 볼 수 있다", () => {
        const r = canWatchAd({ stageId: STAGE, nowMs: T0, state: null, ready: true });
        expect(r.ok).toBe(true);
        expect(r.left).toBe(AD_DAILY_VIEWS);
    });

    skipIfOff("★★ 상한을 넘기면 막힌다", () => {
        let st = null;
        for (let i = 0; i < AD_DAILY_VIEWS; i++) {
            // 쿨다운을 피해 가며 상한까지 채운다
            st = recordView(st, T0 + i * (AD_COOLDOWN_MS + 1000), 0);
        }
        const r = canWatchAd({
            stageId: STAGE,
            nowMs: T0 + AD_DAILY_VIEWS * (AD_COOLDOWN_MS + 1000),
            state: st,
            ready: true,
        });
        expect(r.ok).toBe(false);
        expect(r.reason).toBe("daily");
    });

    /**
     * ★★★ **`dailyViews: 1` 에서 쿨다운은 도달할 수 없다** (2026-08-08 발견).
     *
     *   이 테스트는 원래 `recordView` 한 번 뒤에 `reason === "cooldown"` 을 기대했다.
     *   그런데 상한이 1 이면 그 한 번으로 `left` 가 0 이 되어 `canWatchAd` 가
     *   **`daily` 로 먼저 막는다.** 그 순서는 옳다 — 시청 횟수가 남지 않았는데
     *   "30초 뒤에 다시 오라"고 말하는 것은 거짓말이다.
     *
     *   ⚠ 이 실패는 **광고를 켜기 전까지 보이지 않았다.** `AD_ENABLED` 가 false 인
     *     동안 이 파일의 17개가 전부 `it.skip` 이었기 때문이다. 스위치 하나가
     *     **한 번도 실행된 적 없는 테스트 17개를 동시에 깨웠다.**
     *
     *   그래서 여기서 재는 것을 둘로 나눈다:
     *     ① 우선순위 — 상한이 먼저다 (데이터와 무관하게 언제나 참이어야 한다)
     *     ② 쿨다운 자체 — **상한이 2 이상일 때만 도달 가능하다**
     */
    skipIfOff("★ 시청 횟수가 없으면 쿨다운이 아니라 상한으로 막는다 (거짓말하지 않는다)", () => {
        const st = recordView(null, T0, 0);
        const r = canWatchAd({ stageId: STAGE, nowMs: T0 + 1000, state: st, ready: true });
        expect(r.ok).toBe(false);
        // 상한을 다 쓴 상태에서 "cooldown" 이라고 답하면 화면이 "30초 뒤"라고 쓴다.
        expect(r.reason).toBe(AD_DAILY_VIEWS >= 2 ? "cooldown" : "daily");
    });

    skipIfOff("쿨다운 안에서는 막고, 지나면 열린다", () => {
        if (AD_DAILY_VIEWS < 2) {
            // ★ 지금 설정(dailyViews 1)에서는 쿨다운이 **한 번도 발동하지 않는다.**
            //   그것은 버그가 아니라 이 조합의 성질이다. dailyViews 를 2 이상으로
            //   올리는 순간 살아나므로 규칙은 남겨 둔다 — 다만 지금 이 값이
            //   **무효**라는 사실을 여기서 못박아, 나중에 cooldownMs 를 튜닝하는
            //   사람이 "왜 반응이 없지"로 시간을 쓰지 않게 한다.
            expect(AD_COOLDOWN_MS).toBeGreaterThanOrEqual(0);
            return;
        }
        const st = recordView(null, T0, 0);
        expect(canWatchAd({ stageId: STAGE, nowMs: T0 + 1000, state: st, ready: true }).reason).toBe(
            "cooldown"
        );
        expect(
            canWatchAd({ stageId: STAGE, nowMs: T0 + AD_COOLDOWN_MS + 1, state: st, ready: true }).ok
        ).toBe(true);
    });

    skipIfOff("★ 기기 시계를 되돌려도 영원히 잠기지 않는다", () => {
        const st = recordView(null, T0, 0);
        // 시계가 과거로 갔다 — 쿨다운으로 취급하면 사용자가 영영 못 본다
        const r = canWatchAd({ stageId: STAGE, nowMs: T0 - 100_000, state: st, ready: true });
        expect(r.reason).not.toBe("cooldown");
    });

    skipIfOff("광고가 준비되지 않았으면 이유가 'notReady' 다 (다른 사유와 섞지 않는다)", () => {
        const r = canWatchAd({ stageId: STAGE, nowMs: T0, state: null, ready: false });
        expect(r.ok).toBe(false);
        expect(r.reason).toBe("notReady");
    });

    skipIfOff("허용 범위 밖 스테이지는 이유가 'stage' 다", () => {
        expect(canWatchAd({ stageId: "1-1", nowMs: T0, state: null, ready: true }).reason).toBe(
            "stage"
        );
    });

    it("기능이 꺼져 있으면 언제나 'disabled' 다 — 다른 판정을 지나치지 않는다", () => {
        if (AD_ENABLED) return;
        expect(canWatchAd({ stageId: STAGE, nowMs: T0, state: null, ready: true }).reason).toBe(
            "disabled"
        );
    });
});

describe("손상된 상태", () => {
    it("★★ 손상이 상한을 **푸는 방향**으로 작동하지 않는다", () => {
        // 음수 views · 미래의 day · 문자열 — 전부 '오늘 0회 본 것'보다 관대해지면 안 된다
        for (const bad of [
            { day: dayKey(T0, 0), views: -99, lastAtMs: 0 },
            { day: dayKey(T0, 0), views: "0", lastAtMs: 0 },
            { day: 9_999_999, views: 0, lastAtMs: 0 },
        ]) {
            const left = viewsLeft(bad, T0, 0);
            expect(left).toBeLessThanOrEqual(AD_DAILY_VIEWS);
            expect(left).toBeGreaterThanOrEqual(0);
        }
    });
});
