/**
 * 진단 기록 목록 — **PC 없이 읽어서 알려줄 수 있는 화면** (2026-08-05)
 *
 * ★★ **왜 설정 화면에 두는가.** 실기기에서 멈춤을 겪는 사람에게 개발자 도구는
 *   없다. 그가 우리에게 줄 수 있는 것은 화면에 보이는 것뿐이고, 지금까지 그
 *   화면에는 아무것도 없었다 — "1-14 에서 멈춰요"가 제보의 전부였다.
 *   여기 숫자가 있으면 그것이 그대로 재현 조건이 된다.
 *
 * ★ 이 컴포넌트는 **자기 스타일을 들고 다닌다.** 설정 화면의 CSS 모듈을 빌려
 *   쓰면 그 파일의 클래스 이름에 묶여, 화면 주인이 이름을 바꾸는 날 조용히
 *   모양이 깨진다 (그 화면은 이 티켓의 소유가 아니다).
 *
 * ★ 배포 빌드에서 보인다 (DEV 가드 없음). 그것이 이 화면의 존재 이유다.
 */
import { useSyncExternalStore } from "react";
import { Trash2 } from "lucide-react";
import {
    FAULT,
    clearFaults,
    describeFaultContext,
    faultLabel,
    faultVersion,
    listFaults,
    subscribeFaults,
} from "@/utils/diagnostics";
import { useT } from "@/i18n/useT";
import s from "./FaultLog.module.css";

/** `14:07:32` — 날짜는 적지 않는다. 알고 싶은 것은 "이번 판의 언제"다 */
function clock(ms) {
    if (!ms) return "";
    const d = new Date(ms);
    const p = (n) => String(n).padStart(2, "0");
    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function FaultLog() {
    const t = useT();
    useSyncExternalStore(subscribeFaults, faultVersion, () => 0);
    const faults = listFaults();

    return (
        <div className={s.group}>
            <h2 className={s.groupTitle}>{t("system.faultLogTitle")}</h2>
            <p className={s.note}>{t("system.faultLogNote")}</p>

            {faults.length === 0 ? (
                <p className={s.empty}>{t("system.faultLogEmpty")}</p>
            ) : (
                <>
                    <ul className={s.list}>
                        {faults.map((f, i) => (
                            <li key={`${f.at}-${i}`} className={s.item}>
                                <div className={s.line}>
                                    <span className={s.time}>{clock(f.at)}</span>
                                    <span
                                        className={
                                            f.kind === FAULT.STALL ? s.kindWarn : s.kindBad
                                        }
                                    >
                                        {faultLabel(f.kind)}
                                        {f.count > 1 && ` ×${f.count}`}
                                    </span>
                                    {f.ms > 0 && <span className={s.ms}>{f.ms}ms</span>}
                                </div>
                                <div className={s.msg}>{f.msg}</div>
                                {describeFaultContext(f) && (
                                    <div className={s.ctx}>{describeFaultContext(f)}</div>
                                )}
                                {f.stack && <pre className={s.stack}>{f.stack}</pre>}
                            </li>
                        ))}
                    </ul>
                    <button className={`${s.btn} interactive`} onClick={() => clearFaults()}>
                        <Trash2 size={13} aria-hidden /> {t("system.faultLogClear")}
                    </button>
                </>
            )}
        </div>
    );
}

export default FaultLog;
