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
    // ★ ATT(App Tracking Transparency, iOS 전용) — 기본은 "아직 안 물어봤다"
    trackingAuthorizationStatus: vi.fn(async () => ({ status: "notDetermined" })),
    requestTrackingAuthorization: vi.fn(async () => {}),
};

vi.mock("@capacitor-community/admob", () => ({
    AdMob: admob,
    RewardAdPluginEvents: { Rewarded: "r", Dismissed: "d", FailedToShow: "f" },
    AdmobConsentStatus: { NOT_REQUIRED: "NOT_REQUIRED", OBTAINED: "OBTAINED", REQUIRED: "REQUIRED" },
}));

// ★ getPlatform 을 vi.fn() 으로 둔다 — ATT 는 iOS 전용이라 테스트마다 플랫폼을 바꿔야 한다.
const mockGetPlatform = vi.fn(() => "android");
vi.mock("@capacitor/core", () => ({
    Capacitor: { isNativePlatform: () => true, getPlatform: mockGetPlatform },
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
    // ★ clearAllMocks 는 호출 기록만 지운다 — mockReturnValue 로 바꾼 구현은
    //   남으므로, 이전 테스트가 "ios" 로 바꿔 둔 것을 여기서 명시적으로 되돌린다.
    mockGetPlatform.mockReturnValue("android");
    admob.initialize.mockResolvedValue(undefined);
    admob.showPrivacyOptionsForm.mockResolvedValue(undefined);
    admob.prepareRewardVideoAd.mockResolvedValue(undefined);
    admob.trackingAuthorizationStatus.mockResolvedValue({ status: "notDetermined" });
    admob.requestTrackingAuthorization.mockResolvedValue(undefined);
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

/**
 * ATT(App Tracking Transparency, iOS 14+) — 2026-08-08 추가.
 *
 * ★★★ UMP 와는 **다른 층**이다. UMP 는 GDPR 상 EEA 사용자 동의이고, ATT 는
 *   iOS 가 **모든 지역**에 요구하는 OS 레벨 IDFA 접근 허가다. 그래서 한국처럼
 *   UMP 가 즉시 통과되는 지역에서도 ATT 프롬프트는 그대로 떠야 한다 — "UMP 가
 *   필요없으니 ATT 도 필요없다"로 착각하지 않는다 (`56 §3.3`).
 */
describe("★ iOS ATT — UMP 다음에 요청한다", () => {
    it("iOS 이고 아직 안 물어봤으면(notDetermined) 요청한다", async () => {
        mockGetPlatform.mockReturnValue("ios");
        await initAds();
        expect(admob.trackingAuthorizationStatus).toHaveBeenCalledTimes(1);
        expect(admob.requestTrackingAuthorization).toHaveBeenCalledTimes(1);
    });

    it("Android 에서는 절대 부르지 않는다 — ATT 는 iOS 전용 API 다", async () => {
        mockGetPlatform.mockReturnValue("android");
        await initAds();
        expect(admob.trackingAuthorizationStatus).not.toHaveBeenCalled();
        expect(admob.requestTrackingAuthorization).not.toHaveBeenCalled();
    });

    it("이미 답이 정해져 있으면(authorized) 다시 묻지 않는다", async () => {
        mockGetPlatform.mockReturnValue("ios");
        admob.trackingAuthorizationStatus.mockResolvedValue({ status: "authorized" });
        await initAds();
        expect(admob.requestTrackingAuthorization).not.toHaveBeenCalled();
    });

    it("denied 상태에서도 다시 묻지 않는다 — 이미 낸 답을 존중한다", async () => {
        mockGetPlatform.mockReturnValue("ios");
        admob.trackingAuthorizationStatus.mockResolvedValue({ status: "denied" });
        await initAds();
        expect(admob.requestTrackingAuthorization).not.toHaveBeenCalled();
    });

    it("★★★ UMP 에서 이미 거부됐으면 ATT 를 묻지 않는다 — 그 선택을 무시하지 않는다", async () => {
        mockGetPlatform.mockReturnValue("ios");
        consent({ canRequestAds: false, privacy: "REQUIRED" });
        await initAds();
        expect(admob.trackingAuthorizationStatus).not.toHaveBeenCalled();
        expect(admob.requestTrackingAuthorization).not.toHaveBeenCalled();
    });

    it("ATT 요청이 실패해도 초기화 자체는 깨지지 않는다 — 광고는 비개인화로 계속된다", async () => {
        mockGetPlatform.mockReturnValue("ios");
        admob.requestTrackingAuthorization.mockRejectedValue(new Error("boom"));
        // ATT 실패가 initAds() 밖으로 던져지면 여기서 reject 되어 테스트가 실패한다.
        await expect(initAds()).resolves.toBe(true);
        expect(adReady()).toBe(false); // preloadRewarded 를 안 불렀으니 아직 광고는 없다 — 죽지만 않았다
    });

    it("상태 조회 자체가 실패해도 초기화는 계속된다", async () => {
        mockGetPlatform.mockReturnValue("ios");
        admob.trackingAuthorizationStatus.mockRejectedValue(new Error("boom"));
        await expect(initAds()).resolves.toBe(true);
        expect(admob.requestTrackingAuthorization).not.toHaveBeenCalled();
    });
});
