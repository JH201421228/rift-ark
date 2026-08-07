/**
 * 가이드 오버레이 — 다시 볼 수 있는 설명 (2026-08-04)
 *
 * ★★ **FTUE 와 나눈 이유.** FTUE 는 손을 잡고 처음 한 번 지나가는 길이다 —
 *   문구가 40자로 제한돼 있고(말풍선이 3줄을 넘으면 화면을 가린다), 지나가면 끝이다.
 *   "왜 이렇게 되는가"를 설명할 자리가 이 저장소에 없었고, 사용자가 그것을 지적했다.
 *
 * ★ 라우트를 만들지 않는다. 도움말은 **보던 화면 위에 잠깐** 뜨는 것이 맞는 모양이고,
 *   라우트를 늘리면 탭바 · 도달 그래프 · 뒤로가기가 전부 따라와야 한다.
 *
 * ★ 본문의 `**강조**` 는 여기서 `<b>` 로 바꾼다. 마크다운 파서를 붙이지 않는 이유:
 *   가이드가 쓰는 표기는 강조 하나뿐이고, 그 하나 때문에 의존성을 늘릴 이유가 없다.
 *   `dangerouslySetInnerHTML` 도 쓰지 않는다 — 문자열을 조각내 배열로 렌더한다.
 *
 * @see src/game/logic/guide.js
 */
import { useMemo, useState } from "react";
import { HelpCircle, X } from "lucide-react";
import { GROUPS, TOPICS, guideFacts, topicsForScreen } from "@/game/logic/guide";
import { useT, usePick } from "@/i18n/useT";
import s from "./Guide.module.css";

/**
 * 본문을 언제나 **줄 배열**로 만든다.
 *
 * ★★ `guide.json` 의 `body` 는 `{ ko: [...], en: [...] }` 이고 `pick` 이 그 배열을
 *   꺼내 준다. 그래도 여기서 한 번 더 거르는 이유: 이 오버레이는 **모든 화면의
 *   헤더**에서 열린다. 여기서 `.map is not a function` 이 나면 그 화면이 통째로
 *   `ScreenErrorBoundary` 로 떨어진다 — 도움말 버튼이 화면을 죽이는 셈이다.
 */
function toLines(body) {
    if (Array.isArray(body)) return body;
    return typeof body === "string" && body ? [body] : [];
}

/** `a **b** c` → ["a ", <b>b</b>, " c"] */
function emphasize(line) {
    return line.split(/\*\*(.+?)\*\*/g).map((part, i) =>
        i % 2 === 1 ? <b key={i}>{part}</b> : part
    );
}

/**
 * @param {object} p
 * @param {string} [p.screen] 이 화면의 주제를 먼저 연다 (ark · stages · loadout …)
 * @param {() => void} p.onClose
 */
export function GuideOverlay({ screen, onClose }) {
    const t = useT();
    /**
     * ★★★ **`guide.json` 의 `title` · `body` 는 `{ko, en}` 객체다** (2026-08-07).
     *   `body` 는 그 안에 **줄 배열**이 들어 있다 (`{ ko: [...], en: [...] }`).
     *   객체를 그대로 `.map()` 하면 그 자리에서 터지고, 오버레이는 화면 어디서나
     *   열리므로 **가이드 버튼을 누르는 순간 그 화면이 통째로 죽는다.**
     *   `pick` 은 값이 객체면 `v[lang] ?? v.ko` 를 돌려주므로 배열도 그대로 나온다.
     */
    const pick = usePick();
    // ★ 화면이 주제를 갖고 있으면 그것부터. 없으면 첫 주제 — 빈 본문으로 열지 않는다.
    const initial = useMemo(() => topicsForScreen(screen)[0]?.id ?? TOPICS[0]?.id, [screen]);
    const [openId, setOpenId] = useState(initial);
    // ★ 반복 변수를 `t` 로 두지 않는다 — 번역 함수와 이름이 겹치면, 이 JSX 안에서
    //   문구 하나를 번역하려는 다음 사람이 조용히 주제 객체를 호출하게 된다.
    const topic = TOPICS.find((tp) => tp.id === openId) ?? TOPICS[0];
    const facts = topic?.facts ? guideFacts(topic.facts) : [];

    return (
        <div
            className={s.backdrop}
            role="dialog"
            aria-modal="true"
            aria-label={t("system.guideDialogAria")}
        >
            <div className={s.panel}>
                <nav className={`${s.nav} scrollable`}>
                    {GROUPS.map((g) => (
                        <div key={g.id}>
                            <h3 className={s.groupTitle}>{pick(g, "title")}</h3>
                            {TOPICS.filter((tp) => tp.group === g.id).map((tp) => (
                                <button
                                    key={tp.id}
                                    className={`${s.navItem} ${tp.id === openId ? s.on : ""} interactive`}
                                    onClick={() => setOpenId(tp.id)}
                                >
                                    {pick(tp, "title")}
                                </button>
                            ))}
                        </div>
                    ))}
                </nav>

                <div className={s.body}>
                    <header className={s.head}>
                        <h2 className={s.title}>{pick(topic, "title")}</h2>
                        <button className={`${s.close} interactive`} onClick={onClose}>
                            <X size={13} aria-hidden /> {t("common.close")}
                        </button>
                    </header>

                    <div className={`${s.content} scrollable`}>
                        {/*
                          ★ `pick` 이 배열을 돌려주지 못하는 경우(키 누락 · 문자열
                            하나)에도 **터지지 않아야 한다.** 이 오버레이는 전 화면의
                            헤더에서 열리므로, 여기서 던지면 그 화면이 통째로 죽는다.
                        */}
                        {toLines(pick(topic, "body")).map((line, i) => (
                            <p key={i} className={s.para}>
                                {emphasize(line)}
                            </p>
                        ))}

                        {facts.length > 0 && (
                            <div className={s.facts}>
                                {/*
                                  ★★ 이 표의 값은 **게임 데이터에서 그때그때 읽는다**
                                    (`logic/guide.js:guideFacts`). 문장에 숫자를 박으면
                                    밸런스를 고친 다음 날부터 가이드가 거짓말을 시작한다.
                                */}
                                <p className={s.factsLabel}>{t("system.guideFactsLabel")}</p>
                                {facts.map((f, i) => (
                                    <div key={i} className={s.factRow}>
                                        <span className={s.factKey}>{f.label}</span>
                                        <span className={s.factVal}>{f.value}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * 화면 헤더에 놓는 [?] 버튼.
 *
 * ★ 화면마다 모달 상태를 따로 들지 않게 버튼과 오버레이를 한 컴포넌트로 묶는다 —
 *   화면은 `<GuideButton screen="ark" />` 한 줄만 놓으면 된다.
 */
export function GuideButton({ screen, label }) {
    const t = useT();
    const [open, setOpen] = useState(false);
    // ★ 기본값을 인자 자리에 적을 수 없다 — 훅보다 먼저 평가된다 (ConfirmModal 과 같은 이유)
    const text = label ?? t("system.help");
    return (
        <>
            <button
                className={`${s.helpBtn} interactive`}
                onClick={() => setOpen(true)}
                aria-label={t("system.openAria", { label: text })}
                title={text}
            >
                <HelpCircle size={13} aria-hidden />
                {text}
            </button>
            {open && <GuideOverlay screen={screen} onClose={() => setOpen(false)} />}
        </>
    );
}
