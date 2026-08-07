/**
 * 진단 배너 — **무슨 일이 일어났는지 화면이 말한다** (2026-08-05)
 *
 * ★★ **왜 필요한가.** `ScreenErrorBoundary` 는 **React 렌더**가 실패한 경우만
 *   잡는다. 그런데 이 게임이 실제로 멈춘 자리는 전부 그 바깥이었다 —
 *   Phaser 프레임 안의 예외 · WebGL 컨텍스트 손실 · 잠든 채 깨지 않은 루프 ·
 *   무한 루프. 그 넷 중 무엇이 일어나도 **React 는 아무 일 없이 계속 그린다.**
 *   화면은 멀쩡한데 게임만 죽어 있고, 사용자가 볼 수 있는 것은 아무것도 없었다.
 *
 * ★★★ **배포 빌드에서 보여야 한다.** 사용자가 쓰는 것은 APK 이고 거기서
 *   `import.meta.env.DEV` 는 false 다. 그래서 이 컴포넌트에는 DEV 가드가 없다.
 *   개발자 도구를 열 수 없는 사람에게 이것이 **유일한 창**이다.
 *
 * ★ 게임을 가리지 않는다. 화면 위쪽에 한 줄로 뜨고, [자세히] 를 눌러야 펼쳐진다.
 *   전투 중에 모달이 뜨면 그 자체가 판을 망친다.
 *
 * ★ 지연(stall)은 배너를 띄우지 않는다 (`diagnostics.js:QUIET`). 자주 일어날 수
 *   있는 것으로 화면을 가리면 배너 자체가 버그가 된다 — 지연은 설정 화면에서 읽는다.
 */
import { useState, useSyncExternalStore } from "react";
import { RotateCw, TriangleAlert, X } from "lucide-react";
import {
    activeFault,
    describeFaultContext,
    dismissFault,
    faultLabel,
    faultVersion,
    subscribeFaults,
} from "@/utils/diagnostics";
import { useT } from "@/i18n/useT";
import s from "./FaultOverlay.module.css";

/**
 * ★★ **개발 UI 처럼 생겼지만 번역한다.** 이 배너는 배포 빌드에서 뜨고(위 머리말),
 *   실기기 사용자가 개발자 도구 없이 볼 수 있는 유일한 창이다. 영어권 사용자가
 *   그것을 못 읽으면 우리는 그 사건을 두 번 다시 못 본다.
 */
export function FaultOverlay() {
    const t = useT();
    // ★ 스냅샷은 정수 하나다. 배열을 돌려주면 매 렌더마다 새 참조가 되어
    //   useSyncExternalStore 가 무한 루프로 판단한다.
    useSyncExternalStore(subscribeFaults, faultVersion, () => 0);
    const [open, setOpen] = useState(false);
    const fault = activeFault();
    if (!fault) return null;

    return (
        <div className={s.bar} role="alert">
            <div className={s.head}>
                <TriangleAlert size={14} aria-hidden />
                <span className={s.title}>
                    {faultLabel(fault.kind) || t("system.faultUnknown")}
                    {fault.count > 1 && <span className={s.count}>×{fault.count}</span>}
                </span>
                <span className={s.msg}>{fault.msg}</span>
                <button
                    className={`${s.link} interactive`}
                    onClick={() => setOpen((v) => !v)}
                    aria-expanded={open}
                >
                    {open ? t("system.detailsCollapse") : t("system.detailsExpand")}
                </button>
                <button
                    className={`${s.icon} interactive`}
                    aria-label={t("system.faultDismissAria")}
                    onClick={() => {
                        setOpen(false);
                        dismissFault();
                    }}
                >
                    <X size={14} aria-hidden />
                </button>
            </div>

            {open && (
                <div className={s.detail}>
                    {describeFaultContext(fault) && (
                        <p className={s.line}>{describeFaultContext(fault)}</p>
                    )}
                    {fault.stack && <pre className={s.stack}>{fault.stack}</pre>}
                    {/*
                      ★ `<b>` 강조를 뺐다. 강조를 남기려면 문장을 세 조각으로 쪼개
                        코드에서 이어 붙여야 하는데, 그것은 i18n 규약 위반이고
                        `display:flex` 안에서 문장이 옆으로 눕는 그 결함의 모양이다
                        (CLAUDE.md — 2026-08-04 무기고 안내문).
                    */}
                    <p className={s.note}>{t("system.faultBannerNote")}</p>
                    <button
                        className={`${s.btn} interactive`}
                        onClick={() => globalThis.location?.reload?.()}
                    >
                        <RotateCw size={13} aria-hidden />
                        {t("system.reloadApp")}
                    </button>
                </div>
            )}
        </div>
    );
}

export default FaultOverlay;
