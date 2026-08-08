/**
 * 전투 결과 화면
 *
 * ★★ 패배 시 **원인 진단**이 이 화면의 존재 이유다.
 *
 * 진단이 없으면 상성 시스템은 전략이 아니라 그냥 벽이다.
 * 카툰워즈 3가 남긴 교훈 — 불투명한 속성 시스템은 좌절만 만든다.
 * "막히면 편성을 바꾼다"를 가르치는 유일한 지점이므로,
 * 무엇이 안 죽었는지 + 무엇을 넣어야 하는지를 명시한다.
 *
 * @see docs/02-design/18-ux-ui.md §2.6
 */
import { useEffect, useMemo, useState } from "react";
import { Clapperboard, Lightbulb, TriangleAlert } from "lucide-react";
import { GameIcon } from "@/components/GameIcon";
import { Sprite } from "@/components/Sprite";
import { UNIT_DEFS } from "@/game/logic/stageConfig";
import { COMMANDER_ITEM_BY_ID } from "@/game/logic/commander";
import { spellDef } from "@/game/logic/spells";
// ★ 광고 보상의 규칙 · 어댑터 · 스토어는 각자 자기 자리에 있다 (화면은 배선만 한다)
import { canWatchAd, viewsLeft, AD_REWARD_MULT, AD_UNLIMITED } from "@/game/logic/adReward";
import { preloadRewarded, showRewarded } from "@/native/ads";
import { gameManager } from "@/game/GameManager";
import { useGameStore } from "@/store";
import LangToggle from "@/components/LangToggle";
// ★ React 는 `t` 를 직접 import 하지 않는다 — 언어를 바꿔도 다시 그려지지 않는다
import { useT, usePick, useLang } from "@/i18n/useT";
import styles from "./BattleResult.module.css";

/**
 * 태그 → 왜 졌는가 + 무엇을 하면 되는가.
 *
 * ★ **이름은 여기에 적지 않는다** — 태그 이름의 단일 출처는 `terms.tag.*` 다 (P9-04).
 *   여기 있던 `ko` 는 사본이었고 이미 갈라져 있었다: 프리뷰·도감이 "결계"라고
 *   가르친 태그를 이 화면만 "마법저항"이라고 불렀다(ARMORED·CORRUPT·LIVING 도 같다).
 *   진단 화면은 플레이어가 **처음으로 태그 이름을 진지하게 읽는 자리**이고,
 *   거기서 다른 단어가 나오면 프리뷰에서 배운 것이 지워진다 (18-ux-ui.md §2.3).
 *
 * ★★ 값이 문장이 아니라 **`t` 를 받는 함수**인 이유: `check:i18n`(I6)이 세는 것은
 *   `t("…")` 처럼 **문자열 그대로 적힌 호출**뿐이다. 키를 표에 담아 `t(TABLE[x].why)`
 *   로 부르면 그 16개 키가 "카탈로그에 있는데 아무도 부르지 않는 키"로 잡혀,
 *   진짜로 죽은 키와 구별할 수 없게 된다.
 */
const TAG_INFO = {
    ARMORED: (t) => ({ why: t("result.whyArmored"), fix: t("result.fixArmored") }),
    WARDED: (t) => ({ why: t("result.whyWarded"), fix: t("result.fixWarded") }),
    FLYING: (t) => ({ why: t("result.whyFlying"), fix: t("result.fixFlying") }),
    SWARM: (t) => ({ why: t("result.whySwarm"), fix: t("result.fixSwarm") }),
    CORRUPT: (t) => ({ why: t("result.whyCorrupt"), fix: t("result.fixCorrupt") }),
    SHIELDED: (t) => ({ why: t("result.whyShielded"), fix: t("result.fixShielded") }),
    REGEN: (t) => ({ why: t("result.whyRegen"), fix: t("result.fixRegen") }),
    LIVING: (t) => ({ why: t("result.whyLiving"), fix: t("result.fixLiving") }),
};

/**
 * 결과 화면에 그릴 재화. 아이콘은 논리 키로만 참조한다 (절대규칙 5).
 *
 * ★ 2026-08-04 경량화로 재화는 골드 하나다. 그래도 표를 남기는 이유는
 *   `claimStageReward` 의 반환 형태를 화면이 손으로 풀어쓰지 않게 하기 위해서다.
 */
const REWARD_ROWS = [{ key: "gold", icon: "currency.gold", label: (t) => t("common.gold") }];

/**
 * 숫자 자릿점 로케일.
 *
 * ★★ 예전에는 `toLocaleString("ko-KR")` 이 **박혀 있었다.** 영어 화면에서도
 *   한국어 로케일로 찍히는데, 천 단위 구분자가 같아서 아무도 실패하지 않는다 —
 *   조용히 틀린 채로 남는 종류의 값이다. 언어를 따라가게 둔다.
 */
const NUM_LOCALE = { ko: "ko-KR", en: "en-US" };

/**
 * 보상형 광고 버튼 (2026-08-07, 사용자 결정 — 무료 + 광고).
 *
 * ★★★ **결과 화면 한 곳뿐이다.** 전투 중·화면 전환 중에는 절대 띄우지 않고,
 *   전면·배너는 아예 만들지 않는다 (CLAUDE.md 하지 말 것).
 *
 * ★★ **판정을 화면이 만들지 않는다.** 버튼을 그릴지는 `logic/adReward.js:canWatchAd`,
 *   실제 지급은 `store:claimAdBonus` 가 **같은 함수를 다시 부른다.** 화면에만
 *   자물쇠를 그리면 다음 호출부가 그대로 통과한다 (영입 카드에서 겪은 사고).
 *
 * ★ 광고가 없을 때(웹 개발 서버 · 오프라인 · 미로드) **버튼이 비활성될 뿐**
 *   게임은 그대로 돌아간다. 그것이 이 게임이 서버 없이 완전 오프라인이라는
 *   명제를 지키는 방식이다.
 */
function AdBonus({ stageId, baseGold }) {
    const t = useT();
    const lang = useLang();
    const claimAdBonus = useGameStore((st) => st.claimAdBonus);
    const adState = useGameStore((st) => st.meta.ads);
    const [busy, setBusy] = useState(false);
    const [note, setNote] = useState(null);
    const [gained, setGained] = useState(0);
    const [ready, setReady] = useState(false);

    // ★ 결과 화면에 들어올 때 미리 받아 둔다 — 버튼을 누른 뒤 받으면 그 사이가 빈 화면이다
    useEffect(() => {
        let alive = true;
        preloadRewarded().then((ok) => alive && setReady(ok));
        return () => {
            alive = false;
        };
    }, []);

    const nowMs = Date.now();
    const tz = new Date().getTimezoneOffset();
    const check = canWatchAd({ stageId, nowMs, tzOffsetMin: tz, state: adState, ready });

    // ★ 아예 해당 없는 경우(기능 꺼짐 · 스테이지 범위 밖 · 오늘 소진)는 **그리지 않는다.**
    //   누를 수 없는 버튼을 남겨 두는 것은 정보가 아니라 소음이다.
    if (gained === 0 && (check.reason === "disabled" || check.reason === "stage")) return null;
    if (gained === 0 && check.reason === "daily") return null;

    if (gained > 0) {
        return (
            <div className={styles.adRow}>
                <span className={styles.adGain}>{t("result.adGain", { n: gained })}</span>
            </div>
        );
    }

    const onWatch = async () => {
        if (busy) return;
        setBusy(true);
        setNote(null);
        try {
            const watched = await showRewarded();
            if (!watched) {
                setNote(t(ready ? "result.adFailed" : "result.adUnavailable"));
                return;
            }
            const r = claimAdBonus(stageId, baseGold);
            if (!r.ok) {
                setNote(t(r.reason === "daily" ? "result.adDaily" : "result.adCooldown"));
                return;
            }
            setGained(r.gold);
        } finally {
            /**
             * ★★★ **광고가 덮었던 화면을 렌더러에 다시 알려 준다** (2026-08-08 제보:
             *   "광고를 보고 다시 전투에 들어가면 좌측 하단으로 쏠린다").
             *
             *   보상형 광고는 **같은 프로세스의 다른 Activity** 로 화면을 덮는다.
             *   그래서 Capacitor 의 `appStateChange` 가 뜨지 않는다 — 그것은
             *   프로세스 단위 신호다. 그 사이 WebView 크기가 바뀌어도(시스템 바 복귀 ·
             *   몰입 모드 재적용) Phaser 는 모른 채 남고, 다음에 전투에 들어갈 때
             *   그 낡은 크기로 카메라를 세운다.
             *
             * ★ `finally` 다 — **끝까지 봤든 중간에 닫았든** 화면은 똑같이 덮였다.
             * ★ 어긋나지 않았으면 아무 일도 하지 않는다 (`syncScaleToCanvas`).
             */
            gameManager.resyncScale();
            setBusy(false);
        }
    };

    return (
        <div className={styles.adRow}>
            <button
                type="button"
                className={`${styles.adBtn} interactive`}
                onClick={onWatch}
                disabled={busy || !check.ok}
            >
                <Clapperboard size={14} aria-hidden />
                {t("result.adWatch", {
                    mult: AD_REWARD_MULT.toLocaleString(NUM_LOCALE[lang] ?? NUM_LOCALE.ko),
                })}
            </button>
            {/*
              ★ 상한이 있다는 사실을 **누르기 전에** 말한다. 누른 뒤에 알면 함정이다.
              ★★ 무제한이면 이 줄을 **그리지 않는다** — `viewsLeft` 가 `Infinity` 를
                돌려주므로 그대로 그리면 "오늘 Infinity회 남음" 이 뜬다. 남은 횟수가
                없는 것이 아니라 **셀 이유가 없는 것**이라, 0 으로 바꿔 그리는 것도 틀렸다.
                조건부 렌더다 (`hidden`·`disabled` 를 믿지 않는다 — CLAUDE.md).
            */}
            {!AD_UNLIMITED && (
                <span className={styles.adLeft}>
                    {t("result.adLeft", { n: viewsLeft(adState, nowMs, tz) })}
                </span>
            )}
            {note && <span className={styles.adNote}>{note}</span>}
        </div>
    );
}

/**
 * @param {object} props
 * @param {object} props.result BattleScene 이 EventBus 로 보낸 결과
 * @param {(() => void)|null} props.onRetry null 이면 재도전 버튼을 그리지 않는다
 * @param {(() => void)|null} props.onLoadout null 이면 편성 변경 버튼을 그리지 않는다
 * @param {() => void} props.onExit
 * @param {() => void} [props.onNext]
 */
export function BattleResult({ result, onRetry, onLoadout, onExit, onNext }) {
    const t = useT();
    const pick = usePick();
    const lang = useLang();
    const victory = result.result === "victory";

    const diag = useMemo(() => {
        if (victory) return null;
        const tag = result.diagnosis?.tag;
        const count = result.diagnosis?.count ?? 0;
        // 방주까지 도달한 적이 없는데 패배 = 시간 초과
        if (!tag || count === 0) {
            return {
                title: t("result.diagTimeTitle"),
                why: t("result.diagTimeWhy"),
                fix: t("result.diagTimeFix"),
                count: 0,
            };
        }
        const info = TAG_INFO[tag]?.(t) ?? {
            why: t("result.diagAnyWhy"),
            fix: t("result.diagAnyFix"),
        };
        /**
         * ★ 태그 이름은 `terms.tag.*` 에서 온다 (양 언어). 없는 태그면 키 대신 id 를
         *   그대로 — 지어내지 않는다.
         * ★★ 이름을 문장에 **박아 넣지 않는다.** 한국어는 "중장갑 적을 막지
         *   못했습니다", 영어는 "Armored enemies broke through" 로 이름의 자리와
         *   문장의 뼈대가 둘 다 다르다. 자리표 하나짜리 한 문장이 정답이다.
         */
        const label = t(`terms.tag.${tag}`);
        const name = label === `terms.tag.${tag}` ? tag : label;
        return { title: t("result.diagTitle", { tag: name }), why: info.why, fix: info.fix, count };
    }, [victory, result.diagnosis, t]);

    return (
        <div className={styles.overlay}>
            <div className={`${styles.card} ${victory ? styles.victory : styles.defeat}`}>
                {/* ★ 언어 전환은 **전투가 끝난 자리**에 둔다. 전투 HUD 에 두면
                    한 손 조작 중 오조작 위험이 크고 자리도 없다 (일시정지 모달과 여기). */}
                <LangToggle className={styles.lang} compact />
                <h1 className={styles.title}>{victory ? t("result.victory") : t("result.defeat")}</h1>
                <p className={styles.sub}>{t("result.stage", { id: result.stageId })}</p>

                {victory && (
                    <div className={styles.stars}>
                        {[0, 1, 2].map((i) => (
                            <GameIcon
                                key={i}
                                name={i < result.stars ? "rank.star" : "rank.starOff"}
                                size={32}
                                /* ★ 서수 — 한국어 "3번째 별", 영어 "Star 3" */
                                title={t("result.starTitle", { n: i + 1 })}
                                className={`${styles.star} ${i < result.stars ? styles.on : ""}`}
                            />
                        ))}
                    </div>
                )}

                {/*
                  * ★ 보상은 **받은 자리에서 보여야** 한다. `claimStageReward` 는
                  *   이미 재화를 지급했는데 화면에 아무 표시가 없으면, 플레이어는
                  *   하드가 왜 더 나은지 알 방법이 없다 — 난이도 선택이 도박이 된다.
                  * ★ 0 인 재화는 그리지 않는다. "골드 0" 이 세 줄 뜨는 것보다
                  *   실제로 받은 것만 보이는 쪽이 읽힌다.
                  */}
                {victory && result.reward && (
                    <div className={styles.reward}>
                        {result.reward.firstClear && (
                            <span className={styles.firstClear}>{t("result.firstClear")}</span>
                        )}
                        {REWARD_ROWS.map(({ key, icon, label }) =>
                            result.reward[key] > 0 ? (
                                <span key={key} className={styles.rewardItem}>
                                    <GameIcon name={icon} size={20} title={label(t)} />
                                    <b>
                                        {result.reward[key].toLocaleString(
                                            NUM_LOCALE[lang] ?? NUM_LOCALE.ko
                                        )}
                                    </b>
                                </span>
                            ) : null
                        )}
                    </div>
                )}

                {/*
                  ★★ 보상 바로 아래다. 별·동료 지급보다 위에 두지 않는다 —
                    플레이어가 먼저 읽어야 하는 것은 **자기가 이룬 것**이고,
                    광고는 그 다음의 선택지다.
                */}
                {victory && result.reward && (
                    <AdBonus stageId={result.stageId} baseGold={result.reward.gold ?? 0} />
                )}

                {/*
                  ★★ **새 동료는 여기서 알린다** (2026-08-04, 사용자 요청).
                    `claimStageReward` 는 확정 지급 동료를 그 자리에서 로스터에 넣고
                    `grantedUnits` 로 돌려주는데, **읽는 곳이 없어서** 새 동료가
                    조용히 들어왔다. 100 스테이지 중 8곳에서 일어나는 일이고,
                    그중 몇은 그 다음 스테이지의 **답**이다 — 받은 줄 모르면
                    편성에 넣을 이유도 모른다.
                  ★ 이름과 역할을 함께 보인다. 이름만으로는 무엇을 하는지 모른다.
                */}
                {victory && result.reward?.grantedUnits?.length > 0 && (
                    <div className={styles.granted}>
                        <span className={styles.grantedLabel}>{t("result.grantedUnits")}</span>
                        {result.reward.grantedUnits.map((id) => {
                            const def = UNIT_DEFS[id];
                            return (
                                <span key={id} className={styles.grantedItem}>
                                    {def?.art && (
                                        <Sprite
                                            atlas={def.art.atlas}
                                            frame={def.art.frame}
                                            scale={2}
                                        />
                                    )}
                                    <b>{pick(def, "name") || id}</b>
                                    {/* ★ 역할 이름의 단일 출처는 `terms.role.*` 다 */}
                                    <span className={styles.grantedRole}>
                                        {def?.role ? t(`terms.role.${def.role}`) : ""}
                                    </span>
                                </span>
                            );
                        })}
                    </div>
                )}

                {/*
                  ★ 지휘관 장구도 **같은 자리에서** 알린다 (2026-08-05).
                    동료와 똑같은 사고를 반복하지 않기 위해서다 — 지급하는 코드와
                    보여 주는 코드를 같은 PR 에서 붙인다.
                */}
                {victory && result.reward?.grantedItems?.length > 0 && (
                    <div className={styles.granted}>
                        <span className={styles.grantedLabel}>{t("result.grantedItems")}</span>
                        {result.reward.grantedItems.map((id) => {
                            const item = COMMANDER_ITEM_BY_ID[id];
                            if (!item) return null;
                            return (
                                <span key={id} className={styles.grantedItem}>
                                    <GameIcon name={item.icon} size={16} decorative />
                                    {/* ★ 장구 이름·설명은 `commander.json` 이 `{ko, en}` 으로 갖는다 */}
                                    <b>{pick(item, "name")}</b>
                                    <span className={styles.grantedRole}>
                                        {pick(item, "desc")}
                                    </span>
                                </span>
                            );
                        })}
                    </div>
                )}

                {/* ★ 주문 해금도 같은 자리에서 알린다 (2026-08-05). 해금은
                    `highestStage` 파생이라 저장하지 않지만, **받은 줄 모르면
                    편성 화면에 가서 고를 이유도 모른다.** */}
                {victory && result.reward?.grantedSpells?.length > 0 && (
                    <div className={styles.granted}>
                        <span className={styles.grantedLabel}>{t("result.grantedSpells")}</span>
                        {result.reward.grantedSpells.map((id) => {
                            const sp = spellDef(id);
                            if (!sp) return null;
                            return (
                                <span key={id} className={styles.grantedItem}>
                                    <GameIcon name={sp.icon} size={16} decorative />
                                    {/* ★ 주문 이름·설명은 `spells.json` 이 `{ko, en}` 으로 갖는다 */}
                                    <b>{pick(sp, "name")}</b>
                                    <span className={styles.grantedRole}>{pick(sp, "desc")}</span>
                                </span>
                            );
                        })}
                    </div>
                )}

                {/* ★ 여기는 문장이 아니라 **라벨 + 숫자**다. 그래서 낱말만 카탈로그에서
                    오고 숫자는 <b> 로 떼어 놓아도 어순 문제가 생기지 않는다. */}
                <div className={styles.stats}>
                    <span>
                        {t("result.statKills")} <b>{result.kills}</b>
                    </span>
                    <span>
                        {t("common.ark")} <b>{result.arkHp}</b>/{result.arkHpMax}
                    </span>
                    <span>
                        {t("result.statTime")}{" "}
                        <b>{t("common.seconds", { n: result.durationSec })}</b>
                    </span>
                </div>

                {diag && (
                    <div className={styles.diagnosis}>
                        <p className={styles.diagTitle}>
                            <TriangleAlert size={16} aria-hidden /> {diag.title}
                            {diag.count > 0 && ` ${t("result.diagPassed", { n: diag.count })}`}
                        </p>
                        <p className={styles.diagBody}>{diag.why}</p>
                        <p className={styles.hint}>
                            <Lightbulb size={14} aria-hidden /> {diag.fix}
                        </p>
                    </div>
                )}

                <div className={styles.actions}>
                    {victory ? (
                        <>
                            <button className={`${styles.btn} interactive`} onClick={onExit}>
                                {t("result.exit")}
                            </button>
                            <button
                                className={`${styles.btn} ${styles.primary} interactive`}
                                onClick={onNext ?? onRetry}
                            >
                                {t("result.next")}
                            </button>
                        </>
                    ) : (
                        <>
                            {onRetry ? (
                                <button className={`${styles.btn} interactive`} onClick={onExit}>
                                    {t("result.exit")}
                                </button>
                            ) : null}
                            {onLoadout ? (
                                <button className={`${styles.btn} interactive`} onClick={onLoadout}>
                                    {t("result.changeLoadout")}
                                </button>
                            ) : null}
                            <button
                                className={`${styles.btn} ${styles.primary} interactive`}
                                onClick={onRetry ?? onExit}
                            >
                                {onRetry ? t("result.retry") : t("result.back")}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
