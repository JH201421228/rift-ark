/**
 * 각인 드래프트 UI — 3지선다
 *
 * ★ `✨반응` 배지는 **조합이 존재한다는 힌트만** 준다.
 *   무엇과 조합되는지는 알려주지 않는다 — 이 발견의 즐거움이
 *   위키·유튜브·커뮤니티를 만드는 장치다.
 *
 * ★ 대가형은 `⚠` 로 명시한다. 페널티를 숨기면 다크 패턴이다.
 *
 * ★ **수동 플레이에는 제한 시간이 없다.**
 *   각인 선택은 이 게임의 로그라이트 축이고, 조합·진화를 따져 보는 것이
 *   재미의 본체다. 3초 카운트다운은 그 판단을 재촉해서 "아무거나 고르기"로
 *   만들었다. 시뮬은 드래프트 중 완전히 멈춰 있으므로 기다려도 손해가 없다.
 *
 * ★ 자동 선택은 **오토 플레이일 때만** 남는다.
 *   방치 중이라면 드래프트가 진행을 영원히 막아서는 안 된다.
 *
 * @see docs/02-design/18-ux-ui.md §2.5
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { SIGILS, sigilTiming } from "@/game/logic/sigils";
import { GameIcon, SheetIcon } from "@/components/GameIcon";
import { ConfirmModal } from "@/components/ConfirmModal";
import { hapticTap } from "@/native/haptics";
// ★ React 는 `t` 를 직접 import 하지 않는다 — 언어를 바꿔도 다시 그려지지 않는다
import { useT, usePick } from "@/i18n/useT";
import styles from "./SigilDraft.module.css";

/** 오토 플레이에서만 쓰는 자동 선택 시간 */
const AUTO_MS = 3000;

/**
 * 적용 시점 → 문구의 **카탈로그 키**. 키는 `logic/sigils.js:sigilTiming` 의 반환값이다.
 *
 * ★ 문구를 화면이 고르되 **판정은 하지 않는다.** 새 시점이 생기면 여기에 키가
 *   없어서 `undefined` 가 뜨고, `sigilDraftTiming.test.js` 가 그것을 잡는다.
 * ★ 표에 담는 것이 문장이 아니라 키인 이유는 언어가 둘이기 때문이다 —
 *   문장 자체를 두면 이 파일이 카탈로그의 사본이 된다.
 */
const TIMING_NOTE = {
    immediate: "battle.sigilTimingImmediate",
    retroactive: "battle.sigilTimingRetroactive",
    nextSummon: "battle.sigilTimingNextSummon",
};

/**
 * @param {object} props
 * @param {{options: Array<{id: string, reactive: boolean}>, wave: number}} props.draft
 * @param {number} props.rerollsLeft
 * @param {(index: number) => void} props.onChoose
 * @param {() => void} props.onReroll
 * @param {string|null} props.evolution 방금 발생한 진화 id
 * @param {boolean} [props.autoSelect] 오토 플레이 여부. false 면 제한 시간이 없다
 */
export function SigilDraft({ draft, rerollsLeft, onChoose, onReroll, evolution, autoSelect = false }) {
    const t = useT();
    /** ★ 각인 이름·설명은 카탈로그가 아니라 **데이터**(`sigils.json`)가 갖는다 */
    const pick = usePick();
    const [remain, setRemain] = useState(AUTO_MS);
    const chosen = useRef(false);
    /**
     * 확인 대기 중인 선택지 인덱스 (2026-08-05).
     * ★ 각인은 **되돌릴 수 없다** — 고르는 순간 그 전투의 빌드가 갈린다.
     *   카드가 손가락이 지나가는 자리에 있어서 스치듯 눌리는 사고가 났다.
     */
    const [pending, setPending] = useState(null);
    /**
     * 리롤 확인 (2026-08-05, 사용자 요청).
     * ★ 리롤은 **횟수가 정해진 자원**이다. 잘못 눌러 한 번 날리면 그 전투에서
     *   되돌릴 방법이 없고, 지금 보이는 세 장도 같이 사라진다.
     */
    const [pendingReroll, setPendingReroll] = useState(false);

    const choose = useCallback(
        (i) => {
            if (chosen.current) return;
            chosen.current = true;
            hapticTap();
            onChoose(i);
        },
        [onChoose]
    );

    // 자동 선택 타이머 — 오토 플레이에서만 돈다.
    // ★ 리롤 시에는 부모가 key 를 바꿔 이 컴포넌트를 리마운트한다 —
    //   그래야 이펙트 안에서 setState 로 초기화하는 캐스케이딩 렌더를 피할 수 있다.
    useEffect(() => {
        if (!autoSelect) return; // 수동 플레이: 제한 시간 없음
        const start = performance.now();
        let raf;
        const tick = () => {
            const left = AUTO_MS - (performance.now() - start);
            if (left <= 0) {
                choose(0);
                return;
            }
            setRemain(left);
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [choose, autoSelect]);

    return (
        <div className={styles.overlay}>
            {evolution && (
                <div className={styles.evolution}>
                    <GameIcon name="sigil.evolution" size={20} />{" "}
                    {t("battle.sigilEvolution", {
                        name: pick(SIGILS[evolution], "name") || evolution,
                    })}
                </div>
            )}

            <h2 className={styles.title}>{t("battle.sigilTitle")}</h2>
            <p className={styles.sub}>{t("battle.sigilSub", { n: draft.wave })}</p>

            <div className={styles.cards}>
                {draft.options.map((opt, i) => {
                    const def = SIGILS[opt.id];
                    if (!def) return null;
                    const isCost = def.category === "cost";
                    return (
                        <button
                            key={opt.id}
                            className={`${styles.card} ${isCost ? styles.cost : ""} interactive`}
                            // ★ 누르면 바로 확정하지 않고 확인 모달을 연다.
                            //   오토 플레이의 자동 선택은 `choose()` 를 직접 부르므로
                            //   이 관문을 지나지 않는다 — 방치 중에 모달이 뜨면 진행이 멈춘다.
                            onClick={() => setPending(i)}
                        >
                            {/* ★ 각인마다 고유 아이콘. sigils.json 이 이미 인덱스를
                                갖고 있었는데 화면이 쓰지 않고 있었다. 글자 3장을
                                비교하는 것보다 그림이 먼저 눈에 들어온다. */}
                            <SheetIcon
                                index={def.icon}
                                size={48}
                                decorative
                                className={styles.icon}
                            />
                            <span className={styles.name}>{pick(def, "name")}</span>
                            <span className={styles.desc}>{pick(def, "desc")}</span>
                            <span className={styles.badges}>
                                {isCost && (
                                    <span className={`${styles.badge} ${styles.badgeCost}`}>
                                        <TriangleAlert size={12} aria-hidden />{" "}
                                        {t("battle.sigilBadgeCost")}
                                    </span>
                                )}
                                {opt.reactive && (
                                    <span className={`${styles.badge} ${styles.badgeReactive}`}>
                                        <GameIcon name="sigil.reactive" size={12} />{" "}
                                        {t("battle.sigilBadgeReactive")}
                                    </span>
                                )}
                                {(def.maxStacks ?? 1) > 1 && (
                                    <span className={`${styles.badge} ${styles.badgeStack}`}>
                                        {t("battle.sigilBadgeStack", { n: def.maxStacks })}
                                    </span>
                                )}
                            </span>
                        </button>
                    );
                })}
            </div>

            <div className={styles.footer}>
                <button
                    className={`${styles.reroll} interactive`}
                    disabled={rerollsLeft <= 0}
                    onClick={() => setPendingReroll(true)}
                >
                    <RotateCcw size={14} aria-hidden /> {t("battle.sigilReroll", { n: rerollsLeft })}
                </button>
                {autoSelect ? (
                    <div>
                        <div className={styles.autoTimer}>
                            {t("battle.sigilAutoIn", { n: Math.ceil(remain / 1000) })}
                        </div>
                        <div className={styles.timerBar}>
                            <div
                                className={styles.timerFill}
                                style={{ transform: `scaleX(${remain / AUTO_MS})` }}
                            />
                        </div>
                    </div>
                ) : (
                    <div className={styles.autoTimer}>{t("battle.sigilNoTimer")}</div>
                )}
            </div>

            {pendingReroll && (
                <ConfirmModal
                    title={t("battle.sigilRerollTitle")}
                    subject={t("battle.sigilRerollSubject", { n: rerollsLeft })}
                    confirmLabel={t("battle.sigilRerollConfirm")}
                    onCancel={() => setPendingReroll(false)}
                    onConfirm={() => {
                        setPendingReroll(false);
                        hapticTap();
                        onReroll();
                    }}
                >
                    {t("battle.sigilRerollBody")}
                </ConfirmModal>
            )}

            {pending != null &&
                (() => {
                    const opt = draft.options[pending];
                    const def = SIGILS[opt?.id];
                    if (!def) return null;
                    return (
                        <ConfirmModal
                            title={t("battle.sigilPickTitle")}
                            subject={pick(def, "name")}
                            confirmLabel={t("battle.sigilPickConfirm")}
                            confirmSfx="sigil.pick"
                            onCancel={() => setPending(null)}
                            onConfirm={() => {
                                setPending(null);
                                choose(pending);
                            }}
                        >
                            {pick(def, "desc")}
                            {def.category === "cost" && (
                                <p className={styles.confirmWarn}>
                                    <TriangleAlert size={12} aria-hidden />{" "}
                                    {t("battle.sigilCostWarn")}
                                </p>
                            )}
                            {/*
                              ★★★ **언제부터 적용되는지를 말한다 — 답은 셋이다**
                                (2026-08-05 도입 · 2026-08-06 수정).

                                처음에는 참/거짓 두 갈래였고, 거짓이면 "다음에 소환하는
                                동료부터"라고 적었다. 그런데 그 술어는 `modifyStat` 훅만
                                보므로 **동료 스탯을 아예 만지지 않는 각인 8종**
                                (오라 · 방주 · 발사체 · 타격/처치 훅)이 전부 거짓으로
                                떨어져 같은 문구를 달았다. 그것들은 고르는 즉시 걸린다 —
                                사용자 제보가 정확히 그 거짓말이었다.
                                판정은 `logic/sigils.js:sigilTiming` 하나가 한다.
                            */}
                            <p className={styles.confirmNote}>
                                {t(TIMING_NOTE[sigilTiming(opt.id)])}
                            </p>
                            <p className={styles.confirmNote}>{t("battle.sigilPermanent")}</p>
                        </ConfirmModal>
                    );
                })()}
        </div>
    );
}
