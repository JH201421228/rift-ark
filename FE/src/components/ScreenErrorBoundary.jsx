/**
 * 라우트 화면의 오류 경계 (P9-05 후속)
 *
 * ★★ **왜 필요한가.** 라우트 element 를 전부 `React.lazy` 로 바꾸면서 **로드 실패를
 *   받아 줄 자리가 생기지 않았다.** `<Suspense fallback={null}>` 는 pending 만
 *   처리한다 — 동적 import 가 **reject** 하면 그 에러는 위로 던져지고, 저장소
 *   전체에 `errorElement` · `componentDidCatch` 가 0건이었다.
 *
 *   react-router 7 의 데이터 라우터는 루트 라우트에 기본 경계를 항상 끼우므로
 *   실제로 그려지는 것은 라우터 내장 컴포넌트 — **"Unexpected Application Error!"
 *   영문 스택 화면**이다 (절대 규칙 9 위반). 그리고 루트 라우트가 곧 `App` 이므로
 *   경계가 발동하는 순간 **PhaserGame · TabBar 를 포함한 셸 전체가
 *   언마운트된다** — 캔버스가 파괴되고 복구 버튼이 없다.
 *   정적 import 시절에는 존재하지 않던 실패 모드이고, 화면 수만큼 표면이 늘었다.
 *
 * ★ 그래서 경계를 **`<Outlet/>` 바깥, `<Suspense>` 와 같은 자리**에 하나 둔다.
 *   셸(캔버스·탭바·튜토리얼)은 살아 있고 죽는 것은 그 화면 하나뿐이다.
 *   라우트마다 감싸지 않는 이유는 `<Suspense>` 를 하나만 두는 이유와 같다 —
 *   14벌이 되면 그중 하나를 빠뜨리는 날 그 화면만 조용히 다른 동작을 한다.
 *
 * ★ 복구는 두 단계다.
 *     ① [다시 시도] — 경계 상태만 초기화한다. 청크가 그 사이 도착했으면 그대로 뜬다.
 *     ② [앱 새로고침] — `location.reload()`. 앱 업데이트가 부분 적용되었거나 웹뷰
 *        캐시가 어긋나 청크가 404 로 오는 경우가 이것 하나로 대부분 회복된다.
 *   세이브는 건드리지 않는다. 화면 하나가 못 뜬 것과 세이브는 아무 관계가 없고,
 *   여기서 초기화를 제안하는 순간 그것이 가장 비싼 오조작 경로가 된다.
 *
 * ★ **클래스 컴포넌트다.** React 19 에도 렌더 오류를 잡는 훅이 없다 —
 *   `getDerivedStateFromError` / `componentDidCatch` 가 유일한 수단이다.
 */
import { Component } from "react";
import { RotateCw, TriangleAlert } from "lucide-react";
import { FAULT, recordFault } from "@/utils/diagnostics";
/**
 * ★★ 클래스 컴포넌트라 훅(`useT`)을 쓸 수 없다. 모듈 함수 `t` 를 직접 부르되,
 *   **렌더 안에서** 부른다 — 모듈 스코프에서 부르면 언어를 정하기 전(하이드레이션
 *   전)의 값이 그대로 굳는다. 이 경계는 그 순간에도 그려질 수 있다.
 * ★ 언어를 바꿔도 이 화면이 다시 그려지지 않는 경우가 남지만, 오류 화면을 띄운
 *   채로 설정에 들어가 언어를 바꾸는 경로는 존재하지 않는다 (라우트가 죽어 있다).
 */
import { t } from "@/i18n";
import s from "./ScreenErrorBoundary.module.css";

export class ScreenErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        // ★ 삼키지 않는다. 원인을 콘솔에 남겨야 개발 빌드에서 재현이 가능하다.
        console.error("[screen] failed to render", error, info?.componentStack);
        /**
         * ★★ 진단 기록에도 남긴다 (2026-08-05). 콘솔은 **실기기에서 볼 수 없다** —
         *   APK 를 쓰는 사용자에게 이 실패는 지금까지 흔적이 0 이었고,
         *   그가 우리에게 줄 수 있는 말은 "설정 탭이 이상해요"가 전부였다.
         */
        recordFault(FAULT.SCREEN, error?.message ?? String(error), error);
    }

    /**
     * ★ 라우트가 바뀌면 경계를 스스로 푼다. 안 그러면 한 화면이 실패한 뒤
     *   탭바로 다른 화면에 가도 오류 화면이 그대로 남는다 — 탭이 죽은 것처럼 보인다.
     */
    componentDidUpdate(prev) {
        if (this.state.error && prev.routeKey !== this.props.routeKey) {
            this.setState({ error: null });
        }
    }

    render() {
        if (!this.state.error) return this.props.children;
        return (
            <div className={s.box} role="alert">
                <h2 className={s.title}>
                    <TriangleAlert size={16} aria-hidden />
                    {t("system.screenErrorTitle")}
                </h2>
                <p className={s.note}>{t("system.screenErrorNote")}</p>
                <div className={s.actions}>
                    <button
                        className={`${s.btn} ${s.btnPrimary} interactive`}
                        onClick={() => this.setState({ error: null })}
                    >
                        <RotateCw size={14} aria-hidden />
                        {t("system.retry")}
                    </button>
                    <button
                        className={`${s.btn} interactive`}
                        onClick={() => globalThis.location?.reload?.()}
                    >
                        {t("system.reloadApp")}
                    </button>
                </div>
            </div>
        );
    }
}

export default ScreenErrorBoundary;
