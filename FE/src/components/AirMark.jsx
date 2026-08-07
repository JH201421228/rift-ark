/**
 * 대공 표기 — **"이 동료가 공중에 닿는가"를 카드마다 말한다** (2026-08-05)
 *
 * ★★ 사용자 제보: "원거리 · 시전 이 정도로만 적혀 있으면 이게 공중 요격이
 *   가능한지 헷갈린다."
 *
 *   실제로 **역할은 대공 여부를 말해 주지 않는다.** 같은 '원거리'라도
 *   물리는 공중에 못 닿고 술식은 닿는다 (`combat.js:canHitFlying` —
 *   `ANTI_AIR` 태그가 있거나 물리가 아니면 닿는다). 그래서 화면이 역할만
 *   보여 주면, 비행 웨이브에서 아무것도 못 하는 편성을 짜 놓고도
 *   **왜 지는지 알 수 없다.** 이 게임의 벽은 편성 퍼즐이어야 하고,
 *   퍼즐은 정보가 열려 있을 때만 퍼즐이다.
 *
 * ★ 판정은 규칙 모듈이 한다 (`logic/roles.js:unitHitsAir` → `combat.js`).
 *   여기서 "술식이면 되겠지" 같은 사본을 만들면 시뮬과 갈라진다.
 *
 * ★ 색으로만 구분하지 않는다 — **글자가 다르다** ("대공" / "지상만").
 *   색약 사용자에게 글자는 색 대신 남는 유일한 채널이다 (check:a11y A3 규약).
 */
import { unitHitsAir } from "@/game/logic/roles";
import { tagLabel } from "@/game/logic/labels";
import { useT, useLang } from "@/i18n/useT";
import s from "./AirMark.module.css";

/**
 * @param {object} p
 * @param {{tags?: string[], dmgType: string}} p.def units.json 정의
 * @param {boolean} [p.compact] 전투 HUD 처럼 좁은 자리 — 글자를 줄인다
 */
export function AirMark({ def, compact = false }) {
    const t = useT();
    const lang = useLang();
    const hits = unitHitsAir(def);
    return (
        <span
            className={`${s.mark} ${hits ? s.can : s.cant} ${compact ? s.compact : ""}`}
            // ★ 키를 삼항으로 고르지 않는다 — `check:i18n` 의 I6 은 리터럴
            //   `t("…")` 만 세므로, 그렇게 부르면 이 두 키가 죽은 키로 보고된다
            title={hits ? t("system.airCanTitle") : t("system.airCantTitle")}
        >
            {/*
              ★ 긍정 쪽은 **태그 이름 그대로**다 (`labels.js:tagLabel`) — 편성·도감·
                보스 배너가 부르는 것과 같은 낱말이어야 플레이어가 같은 개념으로
                배운다. 여기서 카탈로그를 직접 조회하면 그 규약이 화면 하나에만
                적힌 것이 된다. 부정 쪽에는 대응하는 태그가 없어 여기서만 쓰는 말이다.
            */}
            {hits
                ? tagLabel("ANTI_AIR", lang)
                : compact
                  ? t("system.airCantShort")
                  : t("system.airCant")}
        </span>
    );
}
