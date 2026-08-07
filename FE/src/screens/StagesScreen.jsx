/**
 * 출격 — 스테이지 선택 + 프리뷰 (P6-09)
 *
 * ★ 월드별로 끊어 보여준다. 60개를 한 덩어리로 쌓으면 "지금 어느 월드인지"가
 *   사라지고, 월드마다 적 구성이 다르다는 사실도 전달되지 않는다.
 *
 * ★ 스테이지를 누르면 **바로 전투로 들어가지 않는다.** 먼저 프리뷰를 연다.
 *   이 게임의 벽은 편성 퍼즐이므로, 편성을 고치지 못한 채 들어가는 클릭은
 *   플레이어에게서 선택을 빼앗는다. 출격은 프리뷰 안에서 한 번 더 누른다.
 *
 * @see docs/04-plan/33-execution-plan.md P6-09
 */
import { useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { GuideButton } from "@/components/GuideOverlay";
import LangToggle from "@/components/LangToggle";
import { DifficultySelect } from "@/components/DifficultySelect";
import { GameIcon } from "@/components/GameIcon";
import { useT, usePick } from "@/i18n/useT";
import { useGameStore } from "@/store";
import stagesData from "@/game/data/stages.json";
import worldsData from "@/game/data/worlds.json";
/**
 * ★★ 캠페인 진행 게이트. **여기에 `>=` 를 쓰지 않는다** — 같은 술어를
 *   `StagePreview` 의 [출격]과 `BattleScreen` 의 마운트 가드가 함께 쓴다.
 *   세 곳이 각자 비교하면 "버튼은 잠겼는데 딥링크로는 들어가진다"가 된다.
 */
import { stageMark, nextStageId } from "@/game/logic/stageUnlock";
import { worldOfStage } from "@/game/logic/difficulty";
// ★ 별 칸 수는 `computeStars` 의 상한이 정한다 — 화면에 3 을 적지 않는다.
import { MAX_STARS } from "@/game/logic/lifecycle";
import { StagePreview } from "./StagePreview";
import styles from "./Screen.module.css";
import p from "./StagePreview.module.css";

/**
 * 월드 정의 — **worlds.json 에서 파생한다.**
 *
 * ★ 사본을 손으로 적어 두었더니 월드 4·5 가 빠져 출격 화면에 "월드 4 · " 로
 *   이름이 빈 채 나왔다. 이름은 `worlds.json` 에 이미 있고, 월드를 늘리는 사람이
 *   이 화면을 기억할 이유가 없다.
 * ★★ 이름 **문자열**이 아니라 정의를 담는다 (2026-08-07 i18n). 모듈 스코프는
 *   한 번만 평가되므로, 여기서 언어를 골라 굳히면 언어를 바꿔도 그대로 남는다.
 *   언어는 렌더 시점의 `usePick(def, "name")` 이 고른다.
 */
const WORLD_DEF = Object.fromEntries(worldsData.worlds.map((w) => [w.world, w]));

const WORLDS = [...new Set(stagesData.stages.map((s) => s.world))];

/**
 * 스테이지 버튼 하나.
 *
 * ★★ **예전에는 `<b>{s.id}</b><span>{s.teaches}</span>` 뿐이었다.**
 *   `meta.stageStars` 도 `meta.highestStage` 도 한 번도 읽지 않았고, 그래서
 *   1-1 부터 5-20 까지 **똑같이 생긴 버튼 100개**가 나란히 있었다.
 *   어디까지 깼는지 · 다음이 어디인지 · 무엇이 잠겼는지를 알 방법이 없었다.
 *
 * ★ 세 표기가 전부 `stageMark` 하나에서 나온다 — 화면이 비교 연산자를 쓰지 않는다.
 * ★ 잠긴 칸도 **그린다.** 무엇을 향해 가는지가 보여야 한다 (특수 콘텐츠 카드와 같은 원칙).
 *   다만 프리뷰는 열어 준다 — 이 게임의 벽은 편성 퍼즐이고, 퍼즐은 정보가 열려 있을 때만
 *   퍼즐이다 (StagePreview 상단 주석). 막는 것은 **출격**이다.
 */
function StageButton({ stage, mark, stars, selected, onSelect }) {
    const t = useT();
    const pick = usePick();
    const locked = mark === "locked";
    /**
     * ★ 세 문구가 전부 리터럴 `t("…")` 호출이다 — `t(어떤변수)` 로 쓰면
     *   `check:i18n` 의 I6(카탈로그 ↔ 호출 대조)가 그 키를 정적으로 셀 수 없다.
     */
    const label = locked
        ? t("common.locked")
        : mark === "next"
          ? t("stages.markNext")
          : mark === "cleared"
            ? t("stages.markCleared")
            : "";
    return (
        <button
            type="button"
            // ★ 화면이 열릴 때 이 카드로 스크롤을 맞추기 위한 표식 (아래 useEffect)
            data-stage={stage.id}
            className={[
                styles.stageBtn,
                selected ? styles.stageBtnOn : "",
                locked ? styles.stageBtnLocked : "",
                mark === "next" ? styles.stageBtnNext : "",
                "interactive",
            ]
                .filter(Boolean)
                .join(" ")}
            onClick={() => onSelect(stage.id)}
            aria-label={label ? t("stages.ariaStage", { id: stage.id, mark: label }) : stage.id}
        >
            <b className={styles.stageHead}>
                {locked && <Lock size={11} aria-hidden />}
                {stage.id}
                {mark === "next" && (
                    <span className={styles.nextBadge}>{t("stages.nextBadge")}</span>
                )}
            </b>
            {/* 부제(`teaches`)는 `stages.json` 이 단일 출처다 — 카탈로그로 옮기지 않는다 */}
            <span>{pick(stage, "teaches")}</span>
            <span className={styles.stageStars} aria-hidden>
                {Array.from({ length: MAX_STARS }, (_, i) => (
                    <GameIcon
                        key={i}
                        name={i < stars ? "rank.star" : "rank.starOff"}
                        size={16}
                        decorative
                    />
                ))}
            </span>
        </button>
    );
}

export default function StagesScreen() {
    const t = useT();
    const pick = usePick();
    /**
     * ★ 좁은 셀렉터만 쓴다 (`s => s` 는 리뷰 반려 사유). 별 기록은 객체이므로
     *   `useShallow` 로 감싸 참조가 매번 달라지는 것을 막는다.
     */
    const { highestStage, stageStars } = useGameStore(
        useShallow((s) => ({
            highestStage: s.meta.highestStage,
            stageStars: s.meta.stageStars,
        }))
    );

    /**
     * ★★ **처음 골라져 있는 곳은 "다음 도전"이다** (2026-08-05, 사용자 제보).
     *
     *   예전 초기값은 `stages[0]`, 즉 **언제나 1-1** 이었다. 그런데 보고 있는
     *   월드는 아래에서 *다음 도전* 기준으로 정한다 — 둘이 어긋난다.
     *   월드 1 에 있는 동안에는 **1-1 이 선택 테두리를, 다음 스테이지가 "다음"
     *   배지를 동시에** 달아서 두 곳이 골라진 것처럼 보였고, 월드 2 이후에는
     *   화면에 보이지도 않는 1-1 의 프리뷰가 오른쪽에 떠 있었다.
     *
     * ★ 두 상태가 **같은 한 값**(`nextStageId`)에서 나오게 한다. 초기값을 각자
     *   정하면 언젠가 또 갈라진다 — 이 저장소의 단일 실패 유형이다.
     */
    const [selected, setSelected] = useState(() => nextStageId(highestStage));

    /** 보고 있는 월드 — 기본값은 **지금 도전할 곳**이다 (위 `selected` 와 같은 출처) */
    const [world, setWorld] = useState(
        () => worldOfStage(nextStageId(highestStage)) || WORLDS[0]
    );

    /**
     * ★★ **골라 놓고 화면 밖에 두지 않는다** (2026-08-05).
     *
     *   초기 선택을 "다음 도전"으로 바꾸고 나니 이번에는 그 카드가 **목록 스크롤
     *   밖**에 있었다 — 1-8 이 골라져 있는데 보이는 것은 1-1·1-2 다. 프리뷰만
     *   1-8 을 말하고 목록에는 아무것도 골라져 보이지 않으니, 고치려던 "어디가
     *   골라진 것인지 모르겠다"가 모양만 바꿔 남는다.
     *
     * ★ 화면이 처음 열릴 때와 **월드를 바꿀 때**만 맞춘다. 사용자가 스스로 카드를
     *   고를 때마다 스크롤이 튀면 그것이 더 성가시다 — 그래서 의존성에 `selected`
     *   를 넣지 않는다.
     * ★ `block: "nearest"` — 이미 보이면 아무것도 하지 않는다.
     */
    const listRef = useRef(null);
    useEffect(() => {
        const el = listRef.current?.querySelector(`[data-stage="${CSS.escape(selected ?? "")}"]`);
        el?.scrollIntoView({ block: "nearest", inline: "nearest" });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [world]);

    return (
        <div className={styles.screen}>
            <div className={p.layout}>
                <div className={`${styles.panel} ${styles.stagePanel} ${p.listPane}`}>
                    <div className={styles.titleRow}>
                        <h1 className={styles.title}>{t("stages.title")}</h1>
                        <GuideButton screen="stages" />
                        <LangToggle />
                    </div>
                    {/* ★ 안내문은 한 줄이다. 폰 가로에서 두 줄이면 스테이지 카드가
                        한 줄밖에 안 보인다 — 월드 목록은 바로 아래 탭이 이미 말해 준다.
                      ★★ 예전에는 스테이지 id 만 `<b>` 로 감싸 문장이 셋으로 쪼개져 있었다.
                        영어는 어순이 달라 그 조각을 재배열할 수 없다 — **문장 전체가
                        한 키**여야 한다 (i18n 규약 ②). 강조는 그 대가로 포기한다. */}
                    <p className={styles.note}>
                        {t("stages.note", {
                            id: nextStageId(highestStage),
                            n: stagesData.stages.length,
                        })}
                    </p>

                    {/*
                      ★★ **월드를 탭으로 고른다** (2026-08-04).
                        예전에는 100 스테이지를 한 줄기로 쌓아서 **월드 5 를 보려면
                        5,800px 을 스크롤**해야 했다 (폰 가로 실측). 사용자가 지적한
                        그 문제다. 한 번에 한 월드만 그리면 스크롤이 20 스테이지로 줄고,
                        월드 이동은 탭 한 번이 된다.

                      ★ 기본값은 **지금 도전할 월드**다. 켤 때마다 "내 자리"에서 시작한다.
                    */}
                    <div className={styles.worldTabs}>
                        {WORLDS.map((w) => (
                            <button
                                key={w}
                                className={`${styles.worldTab} ${w === world ? styles.worldTabOn : ""} interactive`}
                                onClick={() => setWorld(w)}
                                aria-pressed={w === world}
                            >
                                {t("stages.worldTab", { n: w })}
                            </button>
                        ))}
                    </div>

                    <div ref={listRef} className={`${styles.stageScroll} scrollable`}>
                        {[world].map((w) => {
                            const list = stagesData.stages.filter((s) => s.world === w);
                            return (
                                <section key={w}>
                                    <h2 className={styles.worldTitle}>
                                        {t("stages.worldTitle", {
                                            n: w,
                                            name: pick(WORLD_DEF[w], "name"),
                                        })}{" "}
                                        <span className={styles.note}>
                                            {t("stages.worldStageCount", { n: list.length })}
                                        </span>
                                    </h2>
                                    {/* 난이도는 월드 단위로 열린다 (P6-10) */}
                                    <DifficultySelect world={w} />
                                    <div className={styles.stageGrid}>
                                        {list.map((s) => {
                                            const stars = stageStars[s.id] ?? 0;
                                            return (
                                                <StageButton
                                                    key={s.id}
                                                    stage={s}
                                                    stars={stars}
                                                    mark={stageMark(s.id, highestStage, stars)}
                                                    selected={s.id === selected}
                                                    onSelect={setSelected}
                                                />
                                            );
                                        })}
                                    </div>
                                </section>
                            );
                        })}
                    </div>
                </div>

                <StagePreview stageId={selected} />
            </div>
        </div>
    );
}
