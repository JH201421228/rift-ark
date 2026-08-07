/**
 * App — 레이아웃 셸
 *
 * 구조:
 *   #game-container  ... Phaser 캔버스 (풀블리드, 레터박스가 노치를 흡수)
 *   #ui-overlay      ... React DOM UI (세이프에어리어 패딩은 여기에만)
 *
 * ★ Phaser 캔버스는 라우트와 무관하게 항상 마운트되어 있다.
 *   라우트 변경마다 파괴/재생성하면 로딩이 반복되고 메모리가 파편화된다.
 *
 * ★ 세이브 하이드레이션이 끝나기 전에는 게임을 띄우지 않는다.
 *   Preferences 는 비동기이므로, 게이팅하지 않으면 빈 상태로 한 프레임 렌더된 뒤
 *   값이 튀어 들어온다.
 *
 * @see docs/03-tech/20-architecture.md §4.4, §8
 * @see docs/03-tech/21-state-management.md §6.2
 */
import { Suspense, useEffect, useRef, useSyncExternalStore } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { LucideProvider } from "lucide-react";
import { SplashScreen } from "@capacitor/splash-screen";
import { PhaserGame } from "@/components/PhaserGame";
import { TabBar } from "@/components/TabBar";
import { ScreenErrorBoundary } from "@/components/ScreenErrorBoundary";
import { FaultOverlay } from "@/components/FaultOverlay";
import { EventBus, EVT } from "@/game/EventBus";
import { bootstrapNative, isNative } from "@/native/bootstrap";
// ★ 콜드 스타트 계측 — 목표 3초 (26-performance-budget.md §8 · P1-08)
import { reportFirstFrame } from "@/utils/perf";
import { installDiagnostics } from "@/utils/diagnostics";
import { installLifecycle, uninstallLifecycle } from "@/native/lifecycle";
import { useGameStore, flushSave } from "@/store";
import { setHapticsEnabled } from "@/native/haptics";
import { t } from "@/i18n";
import { installSfxRuntime } from "@/game/fx/installSfx";
import { playSfx } from "@/game/fx/SfxEngine";
import { SFX } from "@/game/fx/sfxKeys";

/**
 * 토스트.
 *
 * ★★ **`ui.toasts` 는 오래 전부터 있었는데 그리는 곳이 없었다** (2026-08-04 발견).
 *   `uiSlice.toast()` 를 부르면 배열에 쌓이기만 하고 화면에는 아무것도 뜨지 않았다 —
 *   "만들었는데 아무도 못 쓰는 것"의 전형이고, 뒤로가기 종료 안내를 붙이려다 드러났다.
 *
 * ★ 라우트 밖에 둔다. 토스트는 화면을 가로지르며 이어지는 알림이다.
 */
function ToastLayer() {
    const toasts = useGameStore((s) => s.ui.toasts);
    const dismiss = useGameStore((s) => s.dismissToast);

    useEffect(() => {
        if (!toasts.length) return;
        const timers = toasts.map((t) => setTimeout(() => dismiss(t.id), 2000));
        return () => timers.forEach(clearTimeout);
    }, [toasts, dismiss]);

    if (!toasts.length) return null;
    return (
        <div className="toastLayer" role="status" aria-live="polite">
            {toasts.map((t) => (
                <div key={t.id} className="toastItem">
                    {t.text}
                </div>
            ))}
        </div>
    );
}

export default function App() {
    const location = useLocation();
    // 외부 스토어(persist) 구독은 useSyncExternalStore 가 정석이다.
    // useEffect + setState 조합은 캐스케이딩 렌더를 유발한다.
    const hydrated = useSyncExternalStore(
        (cb) => useGameStore.persist.onFinishHydration(cb),
        () => useGameStore.persist.hasHydrated(),
        () => false
    );

    /**
     * 안드로이드 뒤로가기 — **히스토리를 되감지 않는다** (2026-08-04).
     *
     * ★★ 예전에는 `window.history.back()` 이었고, 해시 라우터라 히스토리에
     *   지나온 전투가 전부 쌓여 **뒤로가기가 방금 깬 스테이지로 돌아갔다.**
     *
     * ★ 대신 화면마다 **부모**를 정한다. 뒤로가기는 그 부모로 *앞으로* 간다.
     *   - 전투 중 → 일시정지 모달 (나가기는 거기서 고른다. 실수로 판을 버리지 않는다)
     *   - 방주·타이틀 → 처리하지 않음 → 앱 종료 (안드로이드 관례)
     *   - 그 밖의 화면 → 방주
     *
     * ★ ref 로 넘긴다. 리스너는 마운트 때 한 번만 등록되므로 클로저가 첫 경로에
     *   고정되고, 그러면 어느 화면에서 눌러도 같은 곳으로 간다.
     */
    const navigate = useNavigate();
    /**
     * ★★ **종료 직전에 한 번 물어본다** (2026-08-04).
     *   예전에는 방주·타이틀에서 뒤로가기를 누르면 **문구 하나 없이 앱이 닫혔다.**
     *   안드로이드 관례대로 "한 번 더" 를 요구한다 — 모달을 띄우지 않는 이유는
     *   그것이 게임을 멈추고 확인 버튼을 찾게 만들기 때문이다. 토스트면 충분하다.
     */
    const exitArmedAt = useRef(0);
    const onBackRef = useRef(() => false);
    // ★ 렌더 중에 ref 를 쓰지 않는다 (react-hooks 규칙). 경로가 바뀔 때만 갱신한다.
    useEffect(() => {
        onBackRef.current = () => {
            const path = location.pathname;
            if (path.startsWith("/battle")) {
                // 이미 멈춰 있으면(일시정지·결과·드래프트) 뒤로가기는 아무것도 하지 않는다
                const s = useGameStore.getState();
                if (s.phase !== "paused") s.pauseRun?.();
                return true;
            }
            if (path === "/" || path === "/ark") {
                const now = performance.now();
                if (now - exitArmedAt.current < 2000) return false; // 두 번째 → 종료
                exitArmedAt.current = now;
                useGameStore.getState().toast(t("common.exitConfirm"));
                return true;
            }
            navigate("/ark");
            return true;
        };
    }, [location.pathname, navigate]);

    /**
     * 진단 — **가장 먼저 설치한다** (2026-08-05).
     *
     * ★★ 여기가 저장소에서 유일한 전역 예외 수집 지점이다. 이 훅이 없던 동안
     *   `window.onerror` · `unhandledrejection` 을 듣는 곳이 **0곳**이었고,
     *   그래서 프레임 안에서 터진 예외는 아무 흔적 없이 게임을 영구 정지시켰다
     *   (Phaser 의 rAF 는 콜백이 던지면 다음 프레임을 예약하지 못한다 —
     *   `utils/diagnostics.js` 머리말).
     *
     * ★ 다른 이펙트보다 위에 둔다. 부팅 도중에 터지는 것이 가장 알기 어렵다.
     * ★ 배포 빌드에서도 돈다. 사용자가 쓰는 것은 APK 다.
     */
    useEffect(() => installDiagnostics(), []);

    // 네이티브 부트스트랩 + 생명주기
    useEffect(() => {
        bootstrapNative();
        installLifecycle({
            // ★ 앱이 백그라운드로 갈 때 즉시 저장한다. OS 가 언제 죽일지 모른다.
            onPause: () => flushSave(),
            onBack: () => onBackRef.current(),
        });
        return () => uninstallLifecycle();
    }, []);

    // 설정 → 네이티브 반영
    useEffect(
        () =>
            useGameStore.subscribe(
                (s) => s.settings.haptics,
                (v) => setHapticsEnabled(v),
                { fireImmediately: true }
            ),
        []
    );

    /**
     * 설정 → 접근성 표현 (P7-15).
     *
     * ★ 여기서만 적용한다. 화면마다 uiScale 을 읽어 인라인 스타일을 주면
     *   새 화면이 추가될 때마다 빠뜨리고, 저시력 사용자에게는 "어떤 화면은 크고
     *   어떤 화면은 작은" 상태가 된다. 루트 변수 하나가 전 화면에 걸리게 한다.
     *
     * ★ 색약 모드는 CSS 만으로 색을 바꾸는 것이 아니라, 색으로만 전달되던 정보에
     *   **글자 표기를 추가**하는 스위치다 (전투 데미지 숫자는 DamageTextPool 이 담당).
     */
    useEffect(
        () =>
            useGameStore.subscribe(
                (s) => s.settings,
                (v) => {
                    const root = document.documentElement;
                    root.style.setProperty("--ui-scale", String(v.textScale ?? 1));
                    root.dataset.colorblind = v.colorBlindMode ? "on" : "off";
                    /**
                     * ★★ **표시 언어의 DOM 쪽** (2026-08-07).
                     *
                     *   `<html lang>` 은 스크린리더의 발음, 브라우저의 줄바꿈 규칙,
                     *   `:lang()` CSS 가 전부 보는 속성이고 `index.html` 에 `lang="ko"`
                     *   로 박혀 있었다.
                     *
                     * ★★★ **모듈 스코프 언어(`setLang`)는 여기서 세팅하지 않는다.**
                     *   이펙트는 렌더보다 늦게 돌므로, `useMemo` 안에서 `pick()` 을
                     *   부르는 화면이 **첫 렌더를 한국어로 계산해 기억해 버린다**
                     *   (실기에서 출격 프리뷰가 통째로 한국어로 남았다).
                     *   그래서 `store/index.js` 가 모듈 평가 시점에 구독한다 —
                     *   그 파일은 어떤 컴포넌트보다 먼저 평가된다.
                     */
                    root.lang = v.language ?? "ko";
                    // ★ 앱 전환기·브라우저 탭에 뜨는 이름. `index.html` 에 박혀 있었다.
                    document.title = t("common.appName");
                },
                { fireImmediately: true }
            ),
        []
    );

    /**
     * 효과음 런타임 (P3-14).
     *
     * ★ 여기서 한 번만 설치한다. 효과음은 화면과 전장 양쪽에서 나므로
     *   라우트 안에 두면 화면마다 설치·해제가 반복되고, 그때마다 쿨다운
     *   상태가 초기화되어 상한이 사실상 없는 것이 된다.
     *
     * ★ 소리 정의는 `src/game/data/sfx.json` 이고 파일은 하나도 쓰지 않는다
     *   (Web Audio 절차적 합성 — SfxEngine.js 상단 주석 참조).
     */
    useEffect(() => installSfxRuntime(), []);

    /**
     * 화면 전환음.
     * ★ 첫 진입에는 울리지 않는다 — 부팅 직후는 아직 제스처 전이라 어차피
     *   버려지고, 무엇보다 "전환"이 아니다.
     */
    const prevPath = useRef(null);
    useEffect(() => {
        const path = location.pathname;
        if (prevPath.current !== null && prevPath.current !== path) {
            playSfx(SFX.UI_TRANSITION, path.length);
        }
        prevPath.current = path;
    }, [location.pathname]);

    // 스플래시는 launchAutoHide:false 이므로 수동으로 숨긴다.
    // 씬이 실제로 준비된 뒤에 숨겨야 흰 화면 플래시가 없다.
    useEffect(() => {
        const onReady = () => {
            if (isNative()) SplashScreen.hide().catch(() => {});
            /**
             * ★★ **콜드 스타트 계측의 소비자가 없었다** (2026-08-05).
             *   `index.html` 이 `window.__t0` 를 찍고 `utils/perf.js` 가
             *   `reportFirstFrame()` 을 정의해 두었는데, **부르는 곳이 저장소에
             *   하나도 없었다.** P1-08 이 "이 시점부터 계속 감시"라고 적어 둔 지표를
             *   한 번도 재지 않고 있었던 것이다.
             *
             * ★ 재는 시점은 **씬이 준비되어 스플래시를 내리는 순간**이다 —
             *   그것이 플레이어가 처음 게임을 보는 시각이고, P9-01 실기기 계측이
             *   비교할 기준이기도 하다.
             */
            reportFirstFrame();
        };
        EventBus.on(EVT.SCENE_READY, onReady);
        return () => EventBus.off(EVT.SCENE_READY, onReady);
    }, []);

    /**
     * 스플래시 유지.
     * ★ 그래도 **진단 배너는 그린다.** 하이드레이션이 실패하면 이 분기에서
     *   영원히 나오지 못하는데(`native/storage.js` 주석의 '빈 화면' 모드),
     *   그때 화면에 아무것도 없으면 사용자는 무엇이 잘못됐는지 알 길이 없다.
     */
    if (!hydrated) return <FaultOverlay />;

    return (
        <>
            <PhaserGame />
            <div id="ui-overlay">
                {/*
                  시스템 UI 아이콘 기본값. 게임 세계관 아이콘은 <GameIcon> 이다.
                  ★ absoluteStrokeWidth: 아이콘을 12px 로 줄이면 lucide 는 선까지
                    같이 굵어져 픽셀 폰트 옆에서 뭉친다. 절대 굵기로 고정하면
                    크기와 무관하게 선이 일정하다.
                */}
                <LucideProvider strokeWidth={1.75} absoluteStrokeWidth size={16}>
                    {/*
                      ★★ 라우트 화면은 전부 지연 로딩이다 (P9-05 · router/index.jsx).
                        경계를 **여기 하나만** 둔다 — 라우트마다 <Suspense> 를 감싸면
                        화면 수만큼 늘어나고, 그중 하나를 빠뜨리는 날 그 화면만
                        흰 화면으로 떨어진다 (React 는 경계가 없으면 상위로 던진다).

                      ★ fallback 이 null 인 이유: 청크 하나는 로컬 파일에서 수 ms 안에
                        온다. 로딩 화면을 띄우면 거의 항상 한 프레임만 번쩍이고 사라진다 —
                        18-ux-ui.md §5 가 팁을 요구하는 것은 전투 진입 같은 **긴**
                        대기이지 라우트 전환이 아니다. 탭바와 캔버스는 이미 떠 있으므로
                        화면이 통째로 비지도 않는다.
                    */}
                    {/*
                      ★★ **경계가 <Suspense> 와 같은 자리에 있다** (ScreenErrorBoundary
                        상단 주석). Suspense 는 pending 만 처리한다 — 동적 import 가
                        **reject** 하면 그 에러는 루트까지 올라가고, 루트 라우트가 곧
                        이 App 이므로 PhaserGame · TabBar 를 포함한 셸이
                        통째로 언마운트되며 react-router 내장 영문 오류 화면이 뜬다.
                      ★ routeKey 를 넘겨 라우트가 바뀌면 경계가 스스로 풀리게 한다.
                    */}
                    <ScreenErrorBoundary routeKey={location.pathname}>
                        <Suspense fallback={null}>
                            <Outlet />
                        </Suspense>
                    </ScreenErrorBoundary>
                    <TabBar />
                    <ToastLayer />
                    {/*
                      ★★ 라우트 밖이다. 멈춤은 화면을 가리지 않고 어디서든 일어난다 —
                        그리고 그 사실을 말해 주는 곳이 저장소에 여기 하나뿐이다.
                    */}
                    <FaultOverlay />
                </LucideProvider>
            </div>
        </>
    );
}
