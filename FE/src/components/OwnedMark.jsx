/**
 * 보유 표기 — **"이 동료는 이미 내 것"을 영입 목록에서 한눈에 말한다** (2026-08-05)
 *
 * ★★ 사용자 요청: "동료 > 영입에서 이미 소유하고 있는 동료는 소유하고 있음을
 *   표시해줘."
 *
 *   표시가 아예 없었던 것은 아니다 — 카드 아래 한 줄에 `보유 중` 이라는 **회색
 *   글자**가 가격과 **같은 자리·같은 색**으로 들어가 있었다. 문제는 그 옆 칸의
 *   `골드 4,000`, 그 옆의 `스테이지 30` 과 구별되지 않는다는 것이고, 게다가
 *   `button:disabled { opacity: 0.6 }`(index.css) 이 **보유·잠김·골드부족 셋을
 *   전부 똑같이 흐리게** 만들어 놓아서, 40칸 격자에서 "내가 가진 것"만 골라내려면
 *   카드마다 10px 회색 글자를 읽어야 했다.
 *
 * ★★ 보유는 "쓸 수 없는 상태"가 아니라 **끝난 상태**다 — 잠긴 칸·돈이 모자란 칸과
 *   같은 시각적 처지에 두면 셋이 한 덩어리로 뭉개진다. 한때는 흐림을 되돌리는
 *   클래스(`.ownedCard`)가 그 일을 했는데, 영입 탭이 2단이 되면서 **카드가 아예
 *   disabled 가 아니게 되어**(탭 = 고르기) 되돌릴 흐림 자체가 사라졌다 (2026-08-05).
 *
 * ★ 색으로만 구분하지 않는다 — **글자가 있다**("보유 중"). 색약 사용자에게
 *   글자는 색 대신 남는 유일한 채널이다 (check:a11y A3 규약, `AirMark` 와 같은 규약).
 *   체크 아이콘은 **시스템 UI** 이므로 lucide-react 다 (절대규칙 5) — 이모지·글리프가
 *   아니다.
 *
 * ★ 판정은 여기서 하지 않는다. 이 컴포넌트는 "보유"라고 **말할** 뿐이고,
 *   "보유인가"는 `logic/recruit.js:canRecruit` 하나가 답한다 (호출부 참고).
 */
import { Check } from "lucide-react";
import { useT } from "@/i18n/useT";
import s from "./OwnedMark.module.css";

/**
 * @param {object} p
 * @param {boolean} [p.compact] 좁은 자리 — 글자를 줄인다 ("보유")
 */
export function OwnedMark({ compact = false }) {
    const t = useT();
    return (
        <span className={s.mark} title={t("system.ownedTitle")}>
            {/*
              ★ 영어는 좁은 자리에서도 "Owned" 한 낱말이라 두 갈래가 같은 말이 된다.
                한국어만 "보유" / "보유 중" 으로 갈린다 — 줄이는 것은 **한글이 넓기
                때문**이지 정보가 다르기 때문이 아니다 (절대규칙 9의 반대편).
            */}
            <Check size={10} aria-hidden />{" "}
            {compact ? t("common.owned") : t("system.ownedLong")}
        </span>
    );
}
