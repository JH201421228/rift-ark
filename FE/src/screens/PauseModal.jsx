/**
 * 일시정지 모달
 *
 * ★ 백그라운드에서 복귀할 때 자동 재개하지 않는다.
 *   "탭하여 계속"을 거쳐야 플레이어가 상황을 파악할 시간이 생긴다.
 *
 * @see docs/03-tech/25-capacitor-mobile.md §5
 */
import { useState } from "react";
import { useGameStore } from "@/store";
import { hapticTap } from "@/native/haptics";
// ★ 전투 규칙을 물어볼 수 있는 유일한 자리가 여기다 — 전장에는 헤더가 없다.
import { GuideOverlay } from "@/components/GuideOverlay";
/**
 * ★★ **언어 전환도 같은 이유로 여기 선다** (2026-08-07). 전투 HUD 에는 넣지
 *   않는다 — 소환·주문을 누르는 손이 지나가는 자리라 오조작 위험이 크고,
 *   상단 한 줄에는 이미 여섯 가지가 서 있다. 전투가 **멈춘** 자리가 그 자리다.
 */
import LangToggle from "@/components/LangToggle";
import { useT } from "@/i18n/useT";
import styles from "./BattleResult.module.css";

export function PauseModal({ onExit }) {
    const t = useT();
    const resumeRun = useGameStore((s) => s.resumeRun);
    const [guide, setGuide] = useState(false);

    if (guide) return <GuideOverlay screen="battle" onClose={() => setGuide(false)} />;

    return (
        <div className={styles.overlay}>
            <div className={styles.card}>
                <LangToggle className={styles.lang} compact />
                <h1 className={styles.title}>{t("battle.pausedTitle")}</h1>
                <p className={styles.sub}>{t("battle.pausedSub")}</p>
                <div className={styles.actions}>
                    <button
                        data-sfx="ui.warn"
                        className={`${styles.btn} interactive`}
                        onClick={onExit}
                    >
                        {t("battle.pauseGiveUp")}
                    </button>
                    <button
                        className={`${styles.btn} interactive`}
                        onClick={() => setGuide(true)}
                    >
                        {t("battle.pauseHelp")}
                    </button>
                    <button
                        className={`${styles.btn} ${styles.primary} interactive`}
                        onClick={() => {
                            hapticTap();
                            resumeRun();
                        }}
                    >
                        {t("battle.pauseResume")}
                    </button>
                </div>
            </div>
        </div>
    );
}
