/**
 * 보상형 광고 어댑터 — 네이티브 경계 (2026-08-07)
 *
 * ★★★ **이 파일이 앱에서 AdMob 을 아는 유일한 곳이다.**
 *   화면은 `showRewarded()` 가 `true` 를 돌려주는지만 안다. 규칙은
 *   `game/logic/adReward.js`(순수), 상태는 `store/slices/metaSlice.js`(`meta.ads`),
 *   수치는 `game/data/ads.json` 이다.
 *
 * ★★ **광고가 없어도 앱이 죽지 않는다.** 웹 개발 서버·vitest 에는 네이티브가 없고,
 *   실기에서도 오프라인·미로드·동의 거부가 흔하다. 그 전부를 **같은 결과**로 다룬다 —
 *   `adReady()` 가 false 이고 버튼이 비활성될 뿐, 게임은 100% 돌아간다.
 *   이 게임이 서버 없이 완전 오프라인이라는 명제는 광고가 들어와도 유지된다.
 *
 * ★ **전면·배너를 만들지 않는다.** 보상형 하나뿐이다 (CLAUDE.md 하지 말 것).
 *   그래서 광고를 *보여 주는* API 는 넷뿐이다:
 *   `initAds` · `preloadRewarded` · `adReady` · `showRewarded`.
 *   여기에 **동의 철회** 둘이 더 있다 (`privacyOptionsRequired` ·
 *   `openPrivacyOptions`) — 광고를 만드는 수단이 아니라 **끄는 수단**이다.
 *
 * @see docs/06-release/56-admob-rewarded-integration.md
 */
import { Capacitor } from "@capacitor/core";
import { AdMob, RewardAdPluginEvents, AdmobConsentStatus } from "@capacitor-community/admob";
import ADS from "@/game/data/ads.json";
import { AD_ENABLED } from "@/game/logic/adReward";

let initPromise = null;
let loaded = false;
/** 광고를 요청해도 되는가 (초기화 완료 + 동의 확보) */
let allowed = false;
/**
 * 이 사용자에게 **동의 철회 입구를 보여 줘야 하는가** (UMP 가 답한다).
 *
 * ★★★ GDPR 은 동의를 **준 것만큼 쉽게 철회**할 수 있어야 한다고 요구한다.
 *   UMP 는 그 수단으로 `showPrivacyOptionsForm()` 을 주고, 보여 줄지 말지는
 *   `privacyOptionsRequirementStatus` 가 지역·메시지 설정에 따라 답한다.
 *   **우리가 판단하지 않는다** — 한국은 `NOT_REQUIRED`, EEA·영국은 `REQUIRED` 다.
 * ★ 기본값 false: 모르면 보여 주지 않는다. 없는 화면으로 가는 버튼보다 낫다.
 */
let privacyRequired = false;

const isNative = () => Capacitor.isNativePlatform?.() === true;
const isTesting = () => import.meta.env.DEV || ADS.testMode === true;

/**
 * 이번 빌드가 쓸 광고 단위 id.
 *
 * ★★★ **개발 빌드는 무조건 테스트 광고다.** 실제 단위 id 로 자기 광고를 한 번이라도
 *   클릭하면 AdMob 계정이 정지될 수 있고, 그 사고는 언제나 "개발 중에 눌러 봤다"에서
 *   나온다. `import.meta.env.DEV` 는 빌드 시 리터럴이라 배포 번들에는 이 분기가 없다.
 * ★ 실제 id 가 비어 있어도 테스트 id 로 떨어진다 — 실수로 빈 값이 배포되면
 *   '광고가 안 뜬다'로 끝나고, 잘못된 id 로 매출이 남에게 가지 않는다.
 */
function adUnitId() {
    const u = ADS.units ?? {};
    const ios = Capacitor.getPlatform?.() === "ios";
    const test = ios ? u.testIos : u.testAndroid;
    if (isTesting()) return test;
    return (ios ? u.ios : u.android) || test;
}

/**
 * 광고 준비 — **앱 부팅이 아니라 처음 필요할 때** 부른다.
 *
 * ★★ 부팅에 끼워 넣지 않는 이유: 콜드 스타트 3초 예산(`26-performance-budget.md` §8)에
 *   네트워크 왕복을 넣지 않기 위해서다. 광고는 첫 전투가 끝나야 의미가 생긴다.
 * ★ 여러 번 불러도 초기화는 한 번이다.
 */
export function initAds() {
    if (!AD_ENABLED || !isNative()) return Promise.resolve(false);
    if (initPromise) return initPromise;

    initPromise = (async () => {
        try {
            await AdMob.initialize({ initializeForTesting: isTesting() });

            /**
             * ★★★ **동의 여부는 `canRequestAds` 가 답한다** (2026-08-07 수정).
             *
             *   처음에는 `status === "REQUIRED"` 일 때 폼을 띄우고 **무조건**
             *   `allowed = true` 로 두었다. 그러면 폼을 띄운 뒤 **거부하고 닫은**
             *   사용자에게도 광고를 요청하게 된다 — 그것은 버그가 아니라
             *   **GDPR 정책 위반**이고, 정지 사유다.
             *
             *   플러그인이 `canRequestAds` 를 주므로(v7.0.3+) 그것 하나만 본다.
             *   없을 때(구버전)의 폴백은 `NOT_REQUIRED | OBTAINED` 두 상태다 —
             *   "요구되지 않음"과 "받았음"만 요청해도 되는 상태다.
             */
            let info = await AdMob.requestConsentInfo();
            if (ADS.requireConsent && info?.isConsentFormAvailable) {
                if (info.status === AdmobConsentStatus.REQUIRED) {
                    await AdMob.showConsentForm();
                    info = await AdMob.requestConsentInfo();
                }
            }
            allowed =
                info?.canRequestAds !== undefined
                    ? info.canRequestAds === true
                    : info?.status === AdmobConsentStatus.NOT_REQUIRED ||
                      info?.status === AdmobConsentStatus.OBTAINED;
            // ★ 동의를 **거부해도** 철회 입구는 필요하다 — allowed 와 독립이다.
            privacyRequired = info?.privacyOptionsRequirementStatus === "REQUIRED";
            return allowed;
        } catch {
            // 초기화 실패 · 동의 거부 · 네트워크 없음 — 전부 같은 결과다
            allowed = false;
            privacyRequired = false;
            return false;
        }
    })();
    return initPromise;
}

/**
 * 다음 광고를 미리 받아 둔다.
 * ★ **결과 화면에 들어올 때** 부른다. 버튼을 누른 뒤에 받으면 그 사이가 빈 화면이 된다.
 */
export async function preloadRewarded() {
    /**
     * ★★★ **`initAds()` 의 반환값을 보지 않는다 — `allowed` 를 본다** (2026-08-08).
     *
     *   `initAds` 는 `initPromise` 를 캐시하므로 두 번째 호출부터는 **처음 결정된
     *   값을 영원히** 돌려준다. 그래서 예전 코드(`if (!(await initAds())) return false`)
     *   는 이런 순서에서 조용히 죽었다:
     *
     *     ① EEA 사용자가 최초 동의 폼에서 **거부** → initAds 가 false 로 굳는다
     *     ② 나중에 설정에서 **동의로 바꾼다** → `openPrivacyOptions` 가 allowed = true 로 갱신
     *     ③ 그런데도 preloadRewarded 는 캐시된 false 를 보고 **즉시 되돌아간다**
     *
     *   결과: 동의했는데 그 세션 내내 광고가 한 번도 안 뜬다. 예외도 로그도 없다.
     *   `initAds()` 는 **초기화를 보장하려고** 부르고, 허가 판정은 살아 있는
     *   `allowed` 가 한다 (`openPrivacyOptions` 가 그것을 갱신한다).
     */
    await initAds();
    if (!allowed) return false;
    try {
        await AdMob.prepareRewardVideoAd({
            adId: adUnitId(),
            isTesting: isTesting(),
            /**
             * ★★★ **몰입 모드는 여기서 켠다 — `show` 가 아니라 `prepare` 의 옵션이다.**
             *
             *   이 게임은 가로 고정이고 시스템 바를 숨긴다 (`MainActivity.java` ·
             *   `native/bootstrap.js:hideSystemBars`). 3버튼 네비게이션 바는 가로에서
             *   화면 **좌우**를 먹는데, 그 자리가 정확히 뒤로가기·탭 바·일시정지다.
             *   광고가 바를 되돌려 놓으면 **버튼이 보이는데 눌리지 않는** 그 사고가
             *   그대로 재현된다 (CLAUDE.md 몰입 모드 절).
             */
            immersiveMode: true,
        });
        loaded = true;
    } catch {
        loaded = false;
    }
    return loaded;
}

/** 지금 바로 보여 줄 광고를 들고 있는가 (버튼 활성 판정의 한 항) */
export function adReady() {
    return AD_ENABLED && isNative() && allowed && loaded;
}

/**
 * 보상형 광고를 보여 준다.
 *
 * @returns {Promise<boolean>} **끝까지 봤는가.** 중간에 닫으면 false 이고,
 *   그때는 보상을 주지 않는다 — 그것이 보상형 광고의 계약이다.
 *
 * ★★★ **`showRewardVideoAd()` 를 그냥 `await` 하면 버튼이 영구히 굳는다** (2026-08-07).
 *
 *   플러그인 v7.2.0 의 네이티브 구현(Android `RewardedAdCallbackAndListeners.kt` ·
 *   iOS `AdRewardExecutor.swift`)은 `call.resolve()` 를 **보상 콜백 안에서만** 부른다.
 *   사용자가 보상 전에 광고를 닫으면 `Dismissed` **이벤트만** 나가고 그 PluginCall 은
 *   resolve 도 reject 도 되지 않는다 — 프로미스가 영원히 대기한다.
 *   그러면 `finally { setBusy(false) }` 에 도달하지 못해 **버튼이 굳고**, 화면에는
 *   아무 설명도 뜨지 않는다. 예외도 로그도 없는, 이 저장소가 가장 자주 당한 모양이다.
 *
 *   그래서 **보상·이탈·실패를 경주시킨다.** 먼저 오는 쪽이 답이다.
 *
 * ★ 리스너는 **반드시 해제한다.** 남기면 결과 화면을 오갈 때마다 쌓여, 한 번의
 *   시청이 여러 번의 지급으로 읽힌다 (절대규칙 3 의 정신 — 구독은 반드시 짝을 맞춘다).
 */
export async function showRewarded() {
    if (!adReady()) return false;

    const handles = [];
    const off = async () => {
        for (const h of handles) {
            try {
                await (await h)?.remove?.();
            } catch {
                /* 이미 제거됐거나 플러그인이 내려갔다 — 정리 실패가 결과를 바꾸지 않는다 */
            }
        }
        handles.length = 0;
    };

    try {
        const settled = new Promise((resolve) => {
            handles.push(
                AdMob.addListener(RewardAdPluginEvents.Rewarded, () => resolve(true)),
                AdMob.addListener(RewardAdPluginEvents.Dismissed, () => resolve(false)),
                AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => resolve(false))
            );
        });

        /**
         * ★ `showRewardVideoAd()` 자체도 경주에 넣는다 — 보상을 받고 닫히는 정상 경로에서는
         *   이쪽이 먼저 resolve 될 수 있고, 그때 값이 있으면 시청 완료다.
         *   던지는 경우(표시 실패)는 `catch` 가 받는다.
         */
        const shown = AdMob.showRewardVideoAd()
            .then((r) => !!r)
            .catch(() => false);

        return await Promise.race([settled, shown]);
    } catch {
        return false;
    } finally {
        loaded = false; // 한 번 보여 준 광고는 재사용할 수 없다
        await off();
    }
}

/**
 * 이 사용자에게 **동의 철회 입구를 그려야 하는가.**
 *
 * ★★★ 이 술어가 없으면 개인정보 처리방침이 거짓이 된다 (`56 §4.5-A`).
 *   GDPR 은 동의를 준 것만큼 쉽게 철회할 수 있어야 한다고 요구하는데,
 *   2026-08-08 까지 이 앱에는 그 수단이 **하나도 없었다** — UMP 폼은 최초
 *   실행 때 한 번 뜨고 끝이었다.
 *
 * ★ **화면이 지역으로 판정하지 않는다.** "EEA 면 보여 준다" 를 화면에 적으면
 *   그 목록이 두 번째 출처가 되고 UMP 설정이 바뀌어도 따라가지 못한다.
 *   답은 UMP 하나다 (`privacyOptionsRequirementStatus`).
 * ★ `initAds()` 를 먼저 부르지 않았으면 언제나 false 다 — 모르면 안 그린다.
 */
export function privacyOptionsRequired() {
    return AD_ENABLED && isNative() && privacyRequired;
}

/**
 * 동의 철회·변경 폼을 연다.
 *
 * @returns {Promise<boolean>} 폼이 실제로 열렸는가. 실패해도 **던지지 않는다** —
 *   설정 화면이 광고 SDK 때문에 깨지면 안 된다 (이 파일의 머리말 원칙).
 */
export async function openPrivacyOptions() {
    if (!privacyOptionsRequired()) return false;
    try {
        await AdMob.showPrivacyOptionsForm();
        /**
         * ★ 폼을 닫은 뒤 상태를 다시 읽는다. 사용자가 동의를 철회했다면
         *   `canRequestAds` 가 false 로 바뀌고 **그 순간부터 광고를 요청하면 안 된다.**
         *   여기서 갱신하지 않으면 이번 세션 내내 옛 판정으로 광고가 나간다 —
         *   정확히 GDPR 위반이다.
         */
        const info = await AdMob.requestConsentInfo();
        allowed = info?.canRequestAds === true;
        privacyRequired = info?.privacyOptionsRequirementStatus === "REQUIRED";
        if (!allowed) loaded = false; // 받아 둔 광고도 더는 보여 주면 안 된다
        return true;
    } catch {
        return false;
    }
}

/**
 * 테스트용 모듈 상태 초기화.
 * ★ 프로덕션 경로에서는 부르지 않는다.
 */
export function __resetAdsForTest() {
    initPromise = null;
    loaded = false;
    allowed = false;
    privacyRequired = false;
}
