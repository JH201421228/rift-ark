/**
 * 라우터
 *
 * ★ createHashRouter 를 쓴다. Capacitor 는 file:// 유사 오리진에서 실행되므로
 *   BrowserRouter 는 새로고침·딥링크에서 깨진다.
 *
 * ★ Phaser 캔버스는 App 셸에 있고 라우트 변경과 무관하게 유지된다. 씬만 전환한다.
 *
 * ★★ **라우트 element 는 전부 지연 로딩이다** (P9-05).
 *
 *   그리고 **배럴(`@/screens`)을 거치지 않는다.** 배럴을 import 하면 재수출된
 *   화면이 전부 한 덩어리로 딸려 오므로 지연 로딩이 이름만 남는다 — 그래서
 *   `src/screens/index.jsx` 를 지웠다. 여기가 화면 모듈의 유일한 진입점이다.
 *
 *   첫 진입을 사는 거래이고, 이 게임에서 첫 진입은 스플래시 뒤 첫 프레임까지의 시간이다.
 *
 * ★ **App 셸(PhaserGame · TabBar)은 정적 import 그대로 둔다.**
 *   Phaser 캔버스는 라우트와 무관하게 항상 마운트되는 것이 이 앱의 구조다 (CLAUDE.md).
 *   lazy 는 라우트 element 에만 건다.
 *
 * @see docs/03-tech/20-architecture.md §8
 */
import { lazy } from "react";
import { createHashRouter, Navigate } from "react-router-dom";
import App from "@/App";

/**
 * 화면 모듈 — **전부 모듈 스코프에서 한 번만** `lazy()` 로 감싼다.
 *
 * ★ 렌더 안에서 `lazy()` 를 부르면 전환할 때마다 컴포넌트 타입이 새로 만들어져
 *   화면이 매번 재마운트되고 상태가 날아간다 (eslint `react-hooks/static-components`
 *   가 이것을 막는다).
 *
 * ★ `<Suspense>` 경계는 **App 셸의 `<Outlet />` 한 곳뿐**이다. 라우트마다 감싸면
 *   화면 수만큼 늘어나고, 그중 하나를 빠뜨리는 날 그 화면만 흰 화면으로 떨어진다.
 *
 * ★★ 표기를 바꾸지 말 것: `tools/check-reachability.mjs` 가 이 선언들을 읽어
 *   라우트 element 이름을 화면 파일로 되돌린다. 모양을 벗어나면
 *   `npm run check:screens` 가 R2/파싱 실패로 막는다 — 조용히 통과하지 않는다.
 */
const TitleScreen = lazy(() => import("@/screens/TitleScreen"));
const ArkScreen = lazy(() => import("@/screens/ArkScreen"));
const StagesScreen = lazy(() => import("@/screens/StagesScreen"));
const LoadoutScreen = lazy(() => import("@/screens/LoadoutScreen"));
const CompanionsScreen = lazy(() => import("@/screens/CompanionsScreen"));
const SettingsScreen = lazy(() => import("@/screens/SettingsScreen"));
const BattleScreen = lazy(() => import("@/screens/BattleScreen"));

const router = createHashRouter([
    {
        element: <App />,
        children: [
            /**
             * ★★ `/` 는 **타이틀**이다 (2026-08-04). 슬롯을 고르기 전에는 게임 안이 아니다.
             *   예전에는 앱을 켜면 곧바로 방주였고, 그래서 "어떤 계정으로 놀고 있는가"를
             *   물어볼 자리가 없었다. 방주는 `/ark` 로 내려갔다.
             */
            { path: "/", element: <TitleScreen /> },
            { path: "/ark", element: <ArkScreen /> },
            { path: "/stages", element: <StagesScreen /> },
            { path: "/loadout", element: <LoadoutScreen /> },
            { path: "/companions", element: <CompanionsScreen /> },
            { path: "/settings", element: <SettingsScreen /> },
            /**
             * ★★ **화면은 여섯이다** (2026-08-04 경량화). 상점 · 일일 · 패스 · 도감 ·
             *   던전 · 탑 · 시험 · 계측 대시보드를 라우트째로 지웠다. 라우트만 남기고
             *   화면을 지우면 `npm run check:screens` 가 도달 불가로 잡고, 화면만 남기고
             *   라우트를 지우면 죽은 코드가 번들에 실린다 — 둘 다 같은 PR 에서 지운다.
             *
             * ★ 전투는 캠페인 하나뿐이라 `isTowerStageId()` 분기도 함께 사라졌다.
             */
            { path: "/battle/:stageId", element: <BattleScreen /> },
            { path: "*", element: <Navigate to="/" replace /> },
        ],
    },
]);

export default router;
