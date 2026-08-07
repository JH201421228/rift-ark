/**
 * 하단 탭 바
 *
 * ★ 가로 모드 엄지 도달 영역을 고려해 하단에 둔다.
 *   터치 타깃 최소 44px (docs/02-design/18-ux-ui.md §1.2)
 *
 * ★★ **탭은 다섯이고, 언제나 다섯이다** (2026-08-04). 아홉이었다 — 일일 · 패스 ·
 *   도감 · 상점이 경량화로 같이 사라졌다. 가로 모드에서 탭이 아홉이면 하나당 폭이
 *   44px 터치 타깃 근처까지 내려가고, 무엇보다 그 넷은 **전투로 가는 길이 아니었다.**
 *
 * ★★ **점진 공개도 사라졌다.** 튜토리얼 진행에 따라 탭을 하나씩 여는 배선이
 *   있었는데, 튜토리얼을 걷어내면서(2026-08-04) 그 근거가 없어졌다.
 *   진행도로 다시 잠그지 않는다 — 화면은 여섯 개뿐이고, 그중 무엇을 숨겨서
 *   얻는 것보다 "눌렀는데 없다"로 잃는 것이 크다.
 */
import { NavLink, useLocation } from "react-router-dom";
import { useT } from "@/i18n/useT";
import styles from "@/screens/Screen.module.css";

export function TabBar() {
    const t = useT();
    const { pathname } = useLocation();

    /**
     * ★★ **목록을 모듈 스코프에 두지 않는다.** 거기서 만들면 배열이 한 번만
     *   평가되어 언어를 바꿔도 탭 바만 이전 언어로 남는다 (`t` 는 순수 함수이고
     *   React 는 그 변화를 볼 수 없다 — `useT.js` 머리말). 렌더마다 다섯 칸을
     *   다시 만드는 비용은 이 컴포넌트가 라우트 전환에만 다시 그려지므로 없다.
     *
     * ★★ 그리고 `t(tab.key)` 처럼 **변수로 조회하지 않는다.** `check:i18n` 의
     *   선언 ↔ 소비 대조(I6)는 리터럴 `t("…")` 만 셀 수 있어서, 변수로 부르면
     *   이 다섯 키가 "아무도 부르지 않는 키"로 보고된다 — 그러면 진짜로 죽은
     *   키와 구별되지 않고, 언젠가 누가 청소하다가 탭 이름을 지운다.
     *
     * ★ 영어 낱말은 **짧은 쪽**을 골랐다: `Allies`(≠Companions) · `Squad`(≠Loadout) ·
     *   `Deploy`. `.tab { flex: 1 }` 이라 한 칸이 화면 폭의 1/5 인데 한글 2자를
     *   그대로 옮기면 두 배가 된다 (절대규칙 9의 반대 방향).
     */
    const TABS = [
        { to: "/ark", label: t("system.tabArk") },
        { to: "/stages", label: t("system.tabStages") },
        { to: "/loadout", label: t("system.tabLoadout") },
        { to: "/companions", label: t("system.tabCompanions") },
        { to: "/settings", label: t("system.tabSettings") },
    ];

    // 전투 중에는 탭 바를 숨긴다.
    // ★ 타이틀(`/`)에서도 숨긴다 — 슬롯을 고르기 전에는 게임 안이 아니다 (2026-08-04).
    if (pathname === "/" || pathname.startsWith("/battle")) return null;

    return (
        <nav className={styles.tabs}>
            {TABS.map((tab) => (
                <NavLink
                    key={tab.to}
                    to={tab.to}
                    className={({ isActive }) =>
                        `${styles.tab} interactive ${isActive ? styles.active : ""}`
                    }
                >
                    {tab.label}
                </NavLink>
            ))}
        </nav>
    );
}
