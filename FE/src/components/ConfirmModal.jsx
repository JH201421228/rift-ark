/**
 * 확인 모달 — **되돌릴 수 없는 선택 앞에서 한 번 멈춘다** (2026-08-05)
 *
 * ★★ 이 게임에서 되돌릴 수 없는 것은 셋이다:
 *   ① **균열 각인 선택** — 고르는 순간 그 전투의 빌드가 갈린다. 리롤은 횟수가 있고,
 *      고른 뒤에는 아무것도 되돌릴 수 없다.
 *   ② **동료 레벨업** · ③ **방주 시설 강화** — 골드가 그 자리에서 빠진다. 골드는
 *      이 게임의 **유일한 재화**라, 잘못 쓴 골드는 다른 성장을 그만큼 미룬다.
 *
 * ★ 세 자리 모두 **한 번의 탭**으로 끝나던 곳이다. `+10` 처럼 큰 금액이 나가는
 *   버튼이 `+1` 바로 옆에 있고, 각인 카드는 손가락이 지나가는 자리에 있다.
 *
 * ★ **모달은 무엇을 치르고 무엇을 얻는지를 숫자로 말한다.** "정말요?"만 묻는 확인은
 *   한 번 더 누르게 만들 뿐 정보를 주지 않는다. 그래서 `cost` 와 `after` 를 받는다.
 *
 * ★ 아이콘은 두 곳에서만 온다 (절대규칙 5) — 재화는 `<GameIcon>`, 시스템 UI 는
 *   lucide-react. 이모지는 쓰지 않는다.
 *
 * @see docs/02-design/18-ux-ui.md §2.5
 */
import { useEffect, useRef } from "react";
import { GameIcon } from "@/components/GameIcon";
import { hapticTap } from "@/native/haptics";
import { useT } from "@/i18n/useT";
import s from "./ConfirmModal.module.css";

const n = (v) => Math.floor(v).toLocaleString();

/**
 * @param {object} props
 * @param {string} props.title 무엇을 하려는가 (예: "레벨업")
 * @param {string} [props.subject] 대상 이름 (예: "느림보 거북 Lv.4 → Lv.5")
 * @param {React.ReactNode} [props.children] 본문 — 각인 설명처럼 긴 것
 * @param {number} [props.cost] 치르는 골드. 있으면 아이콘과 함께 표시한다
 * @param {number} [props.after] 지불 후 남는 골드
 * @param {string} [props.confirmLabel] 없으면 `common.confirm` ("확인" / "Confirm").
 *   ★ 기본값을 인자 자리에 적을 수 없다 — 그 자리는 훅보다 먼저 평가되고,
 *     리터럴을 적으면 언어를 바꿔도 그 버튼만 한국어로 남는다.
 * @param {string} [props.confirmSfx] 확인 버튼의 효과음 키 (data-sfx)
 * @param {() => void} props.onConfirm
 * @param {() => void} props.onCancel
 */
export function ConfirmModal({
    title,
    subject,
    children,
    cost,
    after,
    confirmLabel,
    confirmSfx = "ui.tap",
    onConfirm,
    onCancel,
}) {
    const t = useT();
    const confirmRef = useRef(null);

    /**
     * ★ 열리면 **확인 버튼에 초점**을 준다. 키보드·게임패드 사용자가 모달에 갇히지
     *   않게 하는 최소 조치이고, 스크린 리더가 무엇을 묻는지 읽어 주는 기점이 된다.
     */
    useEffect(() => {
        confirmRef.current?.focus();
    }, []);

    /**
     * ★★ ESC 로 **취소**한다. 안드로이드 뒤로가기는 `native/lifecycle.js` 가
     *   "모달 → 일시정지 → 종료확인" 순서로 처리하므로 여기서 가로채지 않는다 —
     *   가로채면 그 순서가 두 곳으로 갈라진다.
     */
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape") {
                e.preventDefault();
                onCancel();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onCancel]);

    return (
        <div
            className={`${s.overlay} interactive`}
            // ★ 바깥을 누르면 취소다. 확인이 아니라 취소여야 한다 — 실수로 닫는 쪽이
            //   실수로 골드를 쓰는 쪽보다 언제나 싸다.
            onClick={onCancel}
        >
            <div
                className={s.card}
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirm-title"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 id="confirm-title" className={s.title}>
                    {title}
                </h2>
                {subject && <p className={s.subject}>{subject}</p>}

                {children && <div className={s.body}>{children}</div>}

                {cost != null && (
                    <div className={s.costRow}>
                        <span className={s.costLabel}>{t("system.costLabel")}</span>
                        <span className={s.costValue}>
                            <GameIcon name="currency.gold" size={14} decorative /> {n(cost)}
                        </span>
                        {after != null && (
                            <span className={s.after}>
                                {t("system.goldAfter", { n: n(after) })}
                            </span>
                        )}
                    </div>
                )}

                <div className={s.actions}>
                    <button className={`${s.btn} interactive`} onClick={onCancel}>
                        {t("common.cancel")}
                    </button>
                    <button
                        ref={confirmRef}
                        data-sfx={confirmSfx}
                        className={`${s.btn} ${s.primary} interactive`}
                        onClick={() => {
                            hapticTap();
                            onConfirm();
                        }}
                    >
                        {confirmLabel ?? t("common.confirm")}
                    </button>
                </div>
            </div>
        </div>
    );
}
