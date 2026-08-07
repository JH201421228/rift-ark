/**
 * 등급이 붙은 이름 — **색약 대응 단일 통로** (P9-04)
 *
 * ★★ **등급은 이 게임에서 색으로만 표시되고 있었다.** 편성 · 동료 · 도감 · 프리뷰
 *   네 화면이 각자 `RARITY_VAR` 표를 들고 `style={{ color: var(--rarity-l) }}` 로
 *   이름을 칠했다. 적록색약(남성 약 8%)에게 `--rarity-e`(#b45ad6 보라)와
 *   `--rarity-r`(#4a9ee0 파랑)은 사실상 같은 색이고, `--rarity-l`(#f2b33d 금)과
 *   `--rarity-c`(#b8b8b8 회색)도 채도가 낮은 화면에서는 구분되지 않는다.
 *   즉 **그 사용자에게 등급 정보는 존재하지 않았다** (`18-ux-ui.md` §6).
 *
 * ★★ 고치는 방법이 "화면마다 표기를 하나씩 더 붙이기"면 반드시 하나를 빠뜨린다 —
 *   이 저장소가 반복해서 겪은 결함의 모양이다(역할 목록 사본에 FLYER 누락).
 *   그래서 **색을 칠하는 자리를 하나로 줄였다.** `--rarity-*` 를 직접 쓰는 곳은
 *   이 컴포넌트 하나뿐이고, `tools/check-a11y.mjs` 의 A3 가 그것을 강제한다.
 *
 * ★ 표식은 등급 **코드 문자**(C · R · E · L)다. 한국어 이름("레전더리")을 그대로 붙이면
 *   카드 폭이 한글 4자만큼 늘어 6칸 편성 슬롯이 무너지고(절대규칙 9), 이름의 첫 글자만
 *   따면 "레어"와 "레전더리"가 둘 다 `레` 가 된다. 코드 문자는 데이터 자신의 표기이며
 *   1글자 고정폭이다. 읽는 이름은 `title`/`aria-label` 로 함께 준다.
 *
 * ★ 표식은 **색약 모드에서만 보인다** — 데미지 숫자의 속성 표기(`물`·`술`·`신`)와
 *   같은 규약이다 (`DamageTextPool.setColorBlind`). 켜고 끄는 것은 CSS 한 줄
 *   (`:root[data-colorblind="on"]`)이므로, 화면이 설정을 읽지 않아 "켰는데 안 나온다"가
 *   되는 경로가 없다. `App.jsx` 가 `data-colorblind` 를 세우는 것이 유일한 배선이다.
 *
 * @see docs/02-design/18-ux-ui.md §6
 * @see src/game/logic/labels.js (등급 이름의 단일 출처 = gacha.json)
 */
import { RARITY_ORDER, rarityLabel } from "@/game/logic/labels";
import { useT, useLang } from "@/i18n/useT";
import s from "./RarityName.module.css";

/**
 * @param {object} p
 * @param {string} [p.rarity] `units.json` 의 등급 코드 (C · R · E · L).
 *   ★ 없어도 된다 — 도감의 상성·각인 엔트리처럼 등급이라는 개념이 없는 것도 지나간다.
 *     그때는 색도 표식도 붙지 않는다 (없는 등급을 지어내지 않는다).
 * @param {React.ReactNode} p.children 표시할 이름
 * @param {string} [p.className]
 * @param {string} [p.as] 태그 이름. 도감 상세는 `h3` 로 그린다 — 등급 표기를 위해
 *   문서 구조(제목 레벨)를 바꾸지 않는다.
 */
export function RarityName({ rarity, children, className = "", as = "b" }) {
    // ★ 구조분해에서 바로 `as: Tag` 로 받지 않는다 — 이 저장소의 no-unused-vars 는
    //   대문자 **변수**만 예외로 두고(varsIgnorePattern), 인자에는 그 예외가 없다.
    //   JSX 안의 `<Tag>` 는 core ESLint 가 사용으로 세지 못해 오탐이 난다.
    const Tag = as;
    const t = useT();
    /**
     * ★★ **등급 이름 자체는 이 컴포넌트의 것이 아니다** — `logic/labels.js` 가
     *   단일 출처이고 편성·동료·가이드가 같은 함수를 부른다. 여기서 두 언어 표를
     *   새로 만들면 그 순간 출처가 둘이 되고, 이 파일의 존재 이유("색을 칠하는
     *   자리를 하나로 줄였다")와 정확히 반대되는 일을 하게 된다.
     *
     * ★★★ **표(`RARITY_LABEL_KO`)가 아니라 함수(`rarityLabel`)를 부른다.** 표는
     *   모듈이 로드될 때 한 번 계산되므로 언어를 바꿔도 영원히 부팅 당시의
     *   언어로 남는다 — 그 객체는 그래서 deprecated 다.
     * ★ `lang` 을 명시적으로 넘긴다. `useLang()` 이 스토어를 구독하므로 언어가
     *   바뀌면 이 컴포넌트가 다시 그려지고, 그때 새 언어로 조회된다.
     */
    const lang = useLang();
    /**
     * ★★ **없는 등급을 먼저 걸러낸다.** `t()` 는 모르는 키에 **키 문자열**을
     *   돌려주므로(그 편이 침묵보다 낫다), 등급이 없는 엔트리 — 도감의 상성·각인 —
     *   에 그대로 물으면 `label` 이 `"rules.rarity.undefined"` 가 되어 **없던 표식이
     *   생긴다.** 예전 표(`RARITY_LABEL_KO[rarity]`)는 `undefined` 를 돌려줘서
     *   이 자리가 저절로 비어 있었다.
     */
    const label = RARITY_ORDER.includes(rarity) ? rarityLabel(rarity, lang) : "";
    return (
        <Tag
            className={`${s.name} ${className}`}
            data-rarity={rarity ?? ""}
            title={label ? t("system.rarityTier", { name: label }) : undefined}
        >
            {children}
            {/*
              ★ 조건부 렌더가 아니라 **항상 그리고 CSS 로 감춘다.**
                설정을 구독하면 이 컴포넌트가 목록 수십 개 자리에서 리렌더 대상이 되고,
                무엇보다 "이 화면만 구독을 빠뜨림"이라는 결함 경로가 새로 생긴다.
            */}
            {label && (
                <span className={s.mark} aria-label={t("system.rarityTier", { name: label })}>
                    {rarity}
                </span>
            )}
        </Tag>
    );
}
