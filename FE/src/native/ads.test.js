/**
 * 광고 어댑터 — **동의 철회 경로** 검증 (2026-08-08)
 *
 * ★★★ **여기서 지키는 것은 "광고가 뜨는가"가 아니라 "동의를 철회하면 그 자리에서
 *   멈추는가"다.** GDPR 은 동의를 준 것만큼 쉽게 철회할 수 있어야 한다고 요구하고,
 *   철회한 사용자에게 광고를 한 번 더 보여 주는 것은 버그가 아니라 **위반**이다.
 *   그리고 그 사고는 조용하다 — 화면에는 광고가 정상적으로 뜰 뿐이다.
 *
 * ★ 이 파일이 생기기 전까지 `native/ads.js` 를 직접 검사하는 테스트는 **없었다**
 *   (`grep native/ads --include=*.test.js` = 0건, 2026-08-08).
 *
 * @see docs/06-release/56-admob-rewarded-integration.md §4.5-A
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const admob = {
    initialize: vi.fn(async () => {}),
    requestConsentInfo: vi.fn(async () => ({
        status: "NOT_REQUIRED",
        canRequestAds: true,
        privacyOptionsRequirementStatus: "NOT_REQUIRED",
    })),
    showConsentForm: vi.fn(async () => {}),
    showPrivacyOptionsForm: vi.fn(async () => {}),
    prepareRewardVideoAd: vi.fn(async () => {}),
    showRewardVideoAd: vi.fn(async () => ({ type: "reward" })),
    addListener: vi.fn(async () => ({ remove: async () => {} })),
};

vi.mock("@capacitor-community/admob", () => ({
    AdMob: admob,
    RewardAdPluginEvents: { Rewarded: "r", Dismissed: "d", FailedToShow: "f" },
    AdmobConsentStatus: { NOT_REQUIRED: "NOT_REQUIRED", OBTAINED: "OBTAINED", REQUIRED: "REQUIRED" },
}));

vi.mock("@capacitor/core", () => ({
    Capacitor: { isNativePlatform: () => true, getPlatform: () => "android" },
}));

const {
    initAds,
    preloadRewarded,
    adReady,
    privacyOptionsRequired,
    openPrivacyOptions,
    __resetAdsForTest,
} = await import("./ads.js");

/** UMP 가 답하는 한 판의 상태를 통째로 갈아 끼운다. */
function consent({ canRequestAds = true, privacy = "NOT_REQUIRED" }) {
    admob.requestConsentInfo.mockResolvedValue({
        status: canRequestAds ? "OBTAINED" : "REQUIRED",
        isConsentFormAvailable: false,
        canRequestAds,
        privacyOptionsRequirementStatus: privacy,
    });
}

beforeEach(() => {
    __resetAdsForTest();
    vi.clearAllMocks();
    admob.initialize.mockResolvedValue(undefined);
    admob.showPrivacyOptionsForm.mockResolvedValue(undefined);
    admob.prepareRewardVideoAd.mockResolvedValue(undefined);
    consent({});
});

describe("동의 철회 입구 — 그릴지 말지는 UMP 가 답한다", () => {
    it("초기화 전에는 그리지 않는다 (모르면 안 그린다)", () => {
        expect(privacyOptionsRequired()).toBe(false);
    });

    it("한국처럼 NOT_REQUIRED 인 지역에서는 그리지 않는다", async () => {
        consent({ privacy: "NOT_REQUIRED" });
        await initAds();
        expect(privacyOptionsRequired()).toBe(false);
    });

    it("EEA 처럼 REQUIRED 인 지역에서는 그린다", async () => {
        consent({ privacy: "REQUIRED" });
        await initAds();
        expect(privacyOptionsRequired()).toBe(true);
    });

    it("★ 동의를 거부해도 철회 입구는 필요하다 — allowed 와 독립이다", async () => {
        consent({ canRequestAds: false, privacy: "REQUIRED" });
        await initAds();
        expect(adReady()).toBe(false);
        expect(privacyOptionsRequired()).toBe(true);
    });

    it("초기화가 실패하면 그리지 않는다", async () => {
        admob.initialize.mockRejectedValue(new Error("no network"));
        await initAds();
        expect(privacyOptionsRequired()).toBe(false);
    });
});

describe("폼 열기", () => {
    it("필요하지 않으면 폼을 열지 않는다", async () => {
        consent({ privacy: "NOT_REQUIRED" });
        await initAds();
        expect(await openPrivacyOptions()).toBe(false);
        expect(admob.showPrivacyOptionsForm).not.toHaveBeenCalled();
    });

    it("필요하면 연다", async () => {
        consent({ privacy: "REQUIRED" });
        await initAds();
        expect(await openPrivacyOptions()).toBe(true);
        expect(admob.showPrivacyOptionsForm).toHaveBeenCalledTimes(1);
    });

    it("플러그인이 던져도 설정 화면을 깨뜨리지 않는다", async () => {
        consent({ privacy: "REQUIRED" });
        await initAds();
        admob.showPrivacyOptionsForm.mockRejectedValue(new Error("boom"));
        await expect(openPrivacyOptions()).resolves.toBe(false);
    });
});

describe("★★★ 철회하면 그 자리에서 광고가 멈춘다", () => {
    it("받아 둔 광고까지 버린다 — 다음 한 번이 나가면 그것이 위반이다", async () => {
        consent({ canRequestAds: true, privacy: "REQUIRED" });
        await initAds();
        await preloadRewarded();
        expect(adReady()).toBe(true); // 여기까지는 정상 — 동의를 받은 상태다

        // 사용자가 폼에서 동의를 철회한다
        consent({ canRequestAds: false, privacy: "REQUIRED" });
        await openPrivacyOptions();

        expect(adReady()).toBe(false);
    });

    it("폼을 닫은 뒤 상태를 다시 읽는다 (옛 판정으로 세션 내내 나가지 않는다)", async () => {
        consent({ canRequestAds: true, privacy: "REQUIRED" });
        await initAds();
        const before = admob.requestConsentInfo.mock.calls.length;
        await openPrivacyOptions();
        expect(admob.requestConsentInfo.mock.calls.length).toBeGreaterThan(before);
    });

    it("철회 뒤 다시 동의하면 광고가 돌아온다", async () => {
        consent({ canRequestAds: false, privacy: "REQUIRED" });
        await initAds();
        expect(adReady()).toBe(false);

        consent({ canRequestAds: true, privacy: "REQUIRED" });
        await openPrivacyOptions();
        await preloadRewarded();
        expect(adReady()).toBe(true);
    });
});
