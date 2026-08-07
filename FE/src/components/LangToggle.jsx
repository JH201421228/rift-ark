/**
 * 언어 전환 버튼 — 모든 화면 머리글에 선다.
 *
 * ★★★ **설정 안에만 두지 않는다** (2026-08-07, 사용자 요청 "각 탭 혹은 메인 화면").
 *
 *   언어를 잘못 만난 사람은 **설정을 찾아갈 수 없다.** 영어권 사용자가 한국어
 *   화면을 처음 봤을 때 "설정"이라는 두 글자를 읽지 못하면 그 앱은 그 자리에서
 *   끝난다 — 유료앱에서는 곧 환불이다. 그래서 이 버튼은 **읽지 않아도 눌린다**:
 *   글자가 `한 / EN` 두 글자이고, 지금 언어가 아닌 **다른 언어의 이름**을 보여 준다.
 *
 * ★★ **라벨은 언제나 endonym 이다.** 한국어 화면에서도 `English`, 영어 화면에서도
 *   `한국어` 라고 쓴다. 영어 화면에 "Korean" 이라고 적으면 한국어만 읽는 사용자가
 *   실수로 영어로 바꾼 뒤 되돌아올 단서를 잃는다.
 *
 * ★ 두 언어뿐이므로 **토글**이다. 셋이 되면 그때 드롭다운으로 바꾼다 —
 *   지금 드롭다운을 만드는 것은 없는 문제를 위한 UI 다.
 *
 * ★ 아이콘은 `lucide-react` 다 (CLAUDE.md 절대규칙 5 — 시스템 UI 아이콘의 출처).
 *   국기를 쓰지 않는다: 언어와 국가는 다르고, 영어의 국기는 존재하지 않는다.
 */
import { Languages } from "lucide-react";
import { useGameStore } from "@/store";
import { t } from "@/i18n";
import s from "./LangToggle.module.css";

/**
 * @param {{compact?: boolean, className?: string}} props
 *   compact — 글자를 빼고 아이콘만 (자리가 없는 머리글용)
 */
export default function LangToggle({ compact = false, className = "" }) {
    const lang = useGameStore((st) => st.settings.language);
    const setSetting = useGameStore((st) => st.setSetting);

    const next = lang === "ko" ? "en" : "ko";
    /**
     * 버튼이 보여 주는 것은 **바꿔 갈 언어**다 (지금 언어가 아니라).
     * ★ 문자열은 카탈로그에서 온다 — 두 언어 항목이 **둘 다 endonym** 이라
     *   어느 언어로 읽어도 같은 글자가 나온다 (`common.json:$lang` 참조).
     */
    const nextLabel = t(next === "ko" ? "common.langKo" : "common.langEn", null, lang);
    const nextShort = t(next === "ko" ? "common.langKoShort" : "common.langEnShort", null, lang);

    return (
        <button
            type="button"
            className={`${s.btn} interactive ${className}`}
            onClick={() => setSetting("language", next)}
            /**
             * ★ `aria-label` 은 **현재 언어로** 말한다 — 스크린리더는 지금 화면의
             *   언어로 읽고 있고, 여기만 다른 언어면 발음이 무너진다.
             */
            aria-label={t("common.languageSwitchAria", null, lang)}
            title={nextLabel}
            lang={next}
        >
            <Languages size={12} aria-hidden />
            {!compact && <span className={s.label}>{nextShort}</span>}
        </button>
    );
}
