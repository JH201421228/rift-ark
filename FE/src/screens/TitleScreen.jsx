/**
 * 타이틀 화면 — 게임 시작 · 이어하기 · 세이브 슬롯 3 (2026-08-04)
 *
 * ★★ **이 화면이 없어서 생기던 문제.** 세이브가 하나뿐이라 "처음부터 다시"는
 *   곧 "기존 진행을 지운다" 였고, 앱을 켜면 곧바로 방주였다 — 어떤 계정으로
 *   놀고 있는지 물어볼 자리가 없었다.
 *
 * ★ 슬롯 요약은 **저장하지 않고 세이브 원문에서 읽는다** (`store/slots.js`).
 *   요약을 따로 두면 "목록에는 45스테이지인데 들어가면 12" 가 된다.
 *
 * ★ 배경은 codex 가 만든 스토어 키아트다 (`assets/title/title-bg.png`).
 *
 * ★★ 이 화면은 **탭바를 띄우지 않는다** (`App.jsx` 의 TabBar 가 `/` 를 제외한다).
 *   슬롯을 고르기 전에는 게임 안이 아니다.
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, RotateCcw, Trash2 } from "lucide-react";
import { useGameStore } from "@/store";
import { SLOTS, deleteSlot, lastSlot, openSlot, readAllSlots } from "@/store/slots";
import { GuideButton } from "@/components/GuideOverlay";
import LangToggle from "@/components/LangToggle";
import { useT, useLang } from "@/i18n/useT";
import { globalStageIndex } from "@/game/logic/difficulty";
import stagesData from "@/game/data/stages.json";
import s from "./Title.module.css";

const TOTAL_STAGES = stagesData.stages.length;

/** 전역 순번 → "1-7" 표기. 0 이면 아직 아무것도 못 깼다. */
function stageLabel(highest) {
    if (!highest) return "1-1";
    const found = stagesData.stages.find((st) => globalStageIndex(st.id) === highest);
    return found?.id ?? String(highest);
}

/**
 * "3일 전" 같은 상대 표기.
 * ★ 절대 시각을 쓰지 않는다 — 기기 시계가 어긋난 채로 저장된 세이브에서
 *   미래 날짜가 뜨면 그것이 더 이상하다.
 * ★★ **문장을 코드에서 결합하지 않는다** — `${min}분 전` 을 그대로 두면 영어에서
 *   어순이 뒤집히는 자리를 만들 수 없다. 구간마다 **문장 전체가 한 키**이고,
 *   이 함수는 어느 키를 쓸지만 고른다 (`t` 를 인자로 받는 이유다 — 모듈 스코프에서
 *   `t` 를 직접 import 하면 언어를 바꿔도 이 화면이 다시 그려지지 않는다).
 */
function whenLabel(savedAt, now, t) {
    if (!savedAt) return "";
    const min = Math.max(0, Math.round((now - savedAt) / 60000));
    if (min < 1) return t("title.whenNow");
    if (min < 60) return t("title.whenMinutes", { n: min });
    const hour = Math.round(min / 60);
    if (hour < 24) return t("title.whenHours", { n: hour });
    return t("title.whenDays", { n: Math.round(hour / 24) });
}

export default function TitleScreen() {
    const t = useT();
    // ★ 로고는 언어마다 다른 것을 그린다 — 한국어는 워드마크 그림, 영어는 글자
    const lang = useLang();
    const navigate = useNavigate();
    const [slots, setSlots] = useState(null);
    const [last, setLast] = useState(null);
    const [busy, setBusy] = useState(false);
    const [confirming, setConfirming] = useState(null);
    // ★ 렌더 중 Date.now() 를 부르지 않는다 — 같은 입력에 다른 출력이 나오면
    //   목록이 매 렌더 미세하게 흔들린다. 한 번 찍고 그 값으로 계산한다.
    const [now] = useState(() => Date.now());

    const refresh = useCallback(async () => {
        setSlots(await readAllSlots());
        setLast(await lastSlot());
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    /** 슬롯을 열고 방주로 — **여기가 게임에 들어가는 유일한 문이다** */
    const enter = useCallback(
        async (slot) => {
            if (busy) return;
            setBusy(true);
            try {
                await openSlot(useGameStore, slot);
                navigate("/ark");
            } finally {
                setBusy(false);
            }
        },
        [busy, navigate]
    );

    const doDelete = useCallback(
        async (slot) => {
            await deleteSlot(slot);
            setConfirming(null);
            await refresh();
        },
        [refresh]
    );

    // 하이드레이션과 마찬가지로, 슬롯을 다 읽기 전에는 아무것도 그리지 않는다
    if (!slots) return null;

    const firstEmpty = slots.find((x) => x.empty)?.slot ?? null;
    const resumeSlot =
        slots.find((x) => x.slot === last && !x.empty)?.slot ??
        slots.filter((x) => !x.empty).sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0))[0]?.slot ??
        null;

    return (
        <div className={s.screen}>
            <div className={s.veil} />
            <div className={s.inner}>
                {/*
                  ★★ **언어 전환은 이 화면에 반드시 있어야 한다** (2026-08-07, 사용자 요청).
                    영어권 사용자가 처음 보는 화면이 여기이고, 여기서 언어를 못 바꾸면
                    "설정"이라는 두 글자를 읽어 낼 수 있는 사람만 앱을 쓸 수 있다.
                    로고 오른쪽 — 슬롯 카드를 밀어내지 않으면서 가장 먼저 눈에 드는 자리다.
                  ★★★ **로고 그림은 한국어 워드마크뿐이다** (`logo-ko.png`).
                    영어에서 그것을 그대로 띄우면 첫 화면이 통째로 읽을 수 없는 글자가
                    된다 — 유료앱에서는 그 첫인상이 곧 환불이다.
                  ★ 영어 로고 **그림을 새로 만들지 않는다.** 이 게임의 픽셀 폰트는
                    ASCII 95자를 전부 갖고 있으므로(`docs/03-tech/29-i18n.md` §4),
                    같은 글자체로 **글자를 직접 그리면** 그림과 갈라질 자리가 없다.
                    그림 파일을 하나 더 두면 이름을 바꿀 때 둘이 어긋난다 —
                    이 저장소의 단일 실패 유형이다.
                */}
                <div className={s.topRow}>
                    {lang === "ko" ? (
                        <img
                            className={s.logo}
                            src="assets/title/logo-ko.png"
                            alt={t("common.appName")}
                        />
                    ) : (
                        <h1 className={s.logoText}>{t("common.appName")}</h1>
                    )}
                    <LangToggle />
                </div>
                <p className={s.tagline}>{t("title.tagline")}</p>

                <div className={s.slots}>
                    {SLOTS.map((no) => {
                        const d = slots.find((x) => x.slot === no) ?? { slot: no, empty: true };
                        if (d.empty) {
                            return (
                                <button
                                    key={no}
                                    className={`${s.slot} ${s.empty} interactive`}
                                    disabled={busy}
                                    onClick={() => enter(no)}
                                >
                                    <span className={s.slotHead}>
                                        <span className={s.slotNo}>
                                            {t("title.slotNo", { n: no })}
                                        </span>
                                    </span>
                                    <span className={s.slotStage}>{t("common.empty")}</span>
                                    <span className={s.slotWhen}>{t("title.slotEmptyHint")}</span>
                                </button>
                            );
                        }
                        return (
                            <div key={no} className={`${s.slot} interactive`}>
                                <span className={s.slotHead}>
                                    <span className={s.slotNo}>
                                        {t("title.slotNo", { n: no })}
                                    </span>
                                    {no === last && <span>{t("title.lastPlayed")}</span>}
                                </span>
                                {d.broken ? (
                                    <>
                                        <span className={s.slotBroken}>{t("title.broken")}</span>
                                        <span className={s.slotWhen}>{t("title.brokenHint")}</span>
                                    </>
                                ) : (
                                    <>
                                        <span className={s.slotStage}>
                                            {stageLabel(d.highestStage)}
                                        </span>
                                        <span className={s.slotMeta}>
                                            <span>
                                                {t("title.slotProgress", {
                                                    n: d.highestStage,
                                                    total: TOTAL_STAGES,
                                                })}
                                            </span>
                                            <span>{t("title.slotStars", { n: d.stars })}</span>
                                            <span>{t("title.slotUnits", { n: d.units })}</span>
                                        </span>
                                        <span className={s.slotWhen}>
                                            {whenLabel(d.savedAt, now, t)}
                                        </span>
                                    </>
                                )}
                                <div className={s.actions}>
                                    {!d.broken && (
                                        <button
                                            className={`${s.btn} ${s.small} interactive`}
                                            disabled={busy}
                                            onClick={() => enter(no)}
                                        >
                                            {t("title.resume")}
                                        </button>
                                    )}
                                    <button
                                        className={`${s.btn} ${s.small} ${s.danger} interactive`}
                                        disabled={busy}
                                        onClick={() => setConfirming(no)}
                                        aria-label={t("title.ariaDeleteSlot", { n: no })}
                                    >
                                        <Trash2 size={12} aria-hidden /> {t("title.delete")}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className={s.actions}>
                    <button
                        className={`${s.btn} ${s.btnPrimary} interactive`}
                        disabled={busy || resumeSlot === null}
                        onClick={() => resumeSlot && enter(resumeSlot)}
                    >
                        <Play size={14} aria-hidden /> {t("title.resume")}
                    </button>
                    <button
                        className={`${s.btn} interactive`}
                        disabled={busy || firstEmpty === null}
                        onClick={() => firstEmpty && enter(firstEmpty)}
                        title={firstEmpty === null ? t("title.noEmptySlot") : undefined}
                    >
                        <RotateCcw size={14} aria-hidden /> {t("title.newGame")}
                    </button>
                    <GuideButton screen="ark" label={t("title.guideLabel")} />
                </div>

                <p className={s.foot}>{t("title.foot")}</p>
            </div>

            {confirming !== null && (
                <div className={s.confirm} role="dialog" aria-modal="true">
                    <div className={s.confirmBox}>
                        <p>
                            {t("title.deleteConfirm", { n: confirming })}
                            <br />
                            {t("title.deleteWarn")}
                            <br />
                            <b>{t("title.deleteIrreversible")}</b>
                        </p>
                        <div className={s.confirmRow}>
                            <button
                                className={`${s.btn} ${s.danger} interactive`}
                                onClick={() => doDelete(confirming)}
                            >
                                {t("title.delete")}
                            </button>
                            <button
                                className={`${s.btn} interactive`}
                                onClick={() => setConfirming(null)}
                            >
                                {t("common.cancel")}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
