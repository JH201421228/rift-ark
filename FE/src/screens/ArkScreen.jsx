/**
 * 방주 화면 — **홈 대시보드** (2026-08-04)
 *
 * ★★ 이 화면은 두 번 다시 만들어졌다.
 *
 *   ① 원래는 "받기"의 목록이었다 — 방치 보상 · 파견 · 광고 2배 · 알림 권한.
 *      경량화로 그것들이 전부 사라지자 **시설 카드 4장만 남아 화면이 비었다.**
 *   ② 그래서 지금은 **진행 상황을 한눈에 보여 주는 자리**다. 홈에 필요한 것은
 *      "오늘 받을 것"이 아니라 **"내가 어디까지 왔고 다음은 어디인가"** 다.
 *
 * ★ 여기 있는 숫자는 전부 **파생값**이다 — 새로 저장하는 상태가 하나도 없다.
 *   진행도를 홈에 캐시해 두면 그 캐시가 언젠가 진짜와 갈라진다.
 *
 * @see docs/02-design/13-progression-meta.md §1
 */
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useGameStore, flushSave } from "@/store";
import { GameIcon } from "@/components/GameIcon";
import { GuideButton } from "@/components/GuideOverlay";
import LangToggle from "@/components/LangToggle";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useT, usePick } from "@/i18n/useT";
import { usePhaserScene } from "@/hooks/usePhaserScene";
import { FACILITIES } from "@/game/logic/progression";
import { nextStageId } from "@/game/logic/stageUnlock";
import { MAX_STARS } from "@/game/logic/lifecycle";
import { globalStageIndex, worldOfStage } from "@/game/logic/difficulty";
import { RECRUITABLE } from "@/game/logic/recruit";
import stagesData from "@/game/data/stages.json";
import unitsData from "@/game/data/units.json";
import worldsData from "@/game/data/worlds.json";
import s from "./Meta.module.css";

const n = (v) => Math.floor(v).toLocaleString();

/** 데이터가 정하는 것들 — 화면에 숫자를 적지 않는다 (절대 규칙 4) */
const TOTAL_STAGES = stagesData.stages.length;
const TOTAL_UNITS = unitsData.units.length;
/**
 * 월드 정의 자체를 들고 있는다 (이름 문자열이 아니라).
 * ★★ 이름은 `usePick(w, "name")` 이 현재 언어로 고른다 — `w.name` 을 미리
 *   문자열로 굳혀 두면 언어를 바꿔도 그 표가 다시 만들어지지 않는다
 *   (모듈 스코프는 한 번만 평가된다).
 */
const WORLD_DEF = Object.fromEntries(worldsData.worlds.map((w) => [w.world, w]));
const STAGES_PER_WORLD = Object.fromEntries(
    worldsData.worlds.map((w) => [
        w.world,
        stagesData.stages.filter((st) => st.world === w.world).length,
    ])
);

export default function ArkScreen() {
    const t = useT();
    const pick = usePick();
    const assetsReady = usePhaserScene("Ark");
    const { gold, highestStage, ark, owned, stageStars, difficultyStars } = useGameStore(
        useShallow((st) => ({
            gold: st.meta.currencies.gold,
            highestStage: st.meta.highestStage,
            ark: st.meta.ark,
            owned: st.roster.owned,
            stageStars: st.meta.stageStars,
            difficultyStars: st.meta.difficultyStars,
        }))
    );

    const navigate = useNavigate();
    const store = useGameStore.getState;
    /** 확인 대기 중인 시설 id (2026-08-05) */
    const [pendingArk, setPendingArk] = useState(null);
    const [toast, setToast] = useState(null);
    const flash = (m) => {
        setToast(m);
        setTimeout(() => setToast(null), 2600);
    };

    const visual = store().getArkVisual();
    const stars = store().getStars();
    const next = nextStageId(highestStage);

    /** 월드별 진행 — 클리어 수와 별을 한 번에 센다 */
    const worlds = useMemo(() => {
        const hardMap = difficultyStars?.hard ?? {};
        return worldsData.worlds.map((w) => {
            const ids = stagesData.stages
                .filter((st) => st.world === w.world)
                .map((st) => st.id);
            const cleared = ids.filter((id) => globalStageIndex(id) <= highestStage).length;
            const earned = ids.reduce(
                (a, id) => a + (stageStars[id] ?? 0) + (hardMap[id] ?? 0),
                0
            );
            return {
                world: w.world,
                // ★ 이름이 아니라 **정의**를 담는다 — 언어는 렌더 시점에 고른다
                def: w,
                cleared,
                total: ids.length,
                earned,
                max: ids.length * MAX_STARS * 2, // 노멀 + 하드
            };
        });
    }, [highestStage, stageStars, difficultyStars]);

    const ownedCount = Object.keys(owned).length;
    const clearedTotal = Math.min(highestStage, TOTAL_STAGES);
    const curWorld = worldOfStage(next) || 1;

    return (
        // ★ 로딩 전에는 불투명하게 둔다 — 프리로드 진행 바가 UI 사이로 비치지 않게
        <div className={`${s.screen} ${assetsReady ? s.screenAmbient : ""}`}>
            <header className={s.header}>
                <h1 className={s.title}>{t("common.ark")}</h1>
                <span className={s.dim}>
                    {t("ark.arkState", { label: pick(visual, "label"), sum: visual.sum })}
                </span>
                <GuideButton screen="ark" />
                {/* ★ 언어 전환은 **모든 화면 머리글**에 있다 (2026-08-07, 사용자 요청) —
                    설정 안에만 두면 그 두 글자를 못 읽는 사람이 영영 못 찾는다. */}
                <LangToggle />
                {/* ★★ **타이틀로 나가는 문**을 홈에도 둔다 (2026-08-05, 사용자 요청).
                    설정 안에도 있지만, 슬롯을 바꾸러 가는 사람이 설정을 먼저 떠올릴
                    이유가 없다. 방주가 홈 대시보드이므로 여기가 자연스러운 자리다.
                  ★ 나가기 전에 세이브를 한 번 더 밀어 넣는다 — 안드로이드에서 OS 가
                    언제 프로세스를 죽일지 모른다 (App.jsx 의 onPause 와 같은 이유). */}
                <button
                    className={`${s.miniBtn} interactive`}
                    title={t("ark.toTitleTip")}
                    onClick={async () => {
                        await flushSave();
                        navigate("/");
                    }}
                >
                    <LogOut size={12} aria-hidden /> {t("ark.toTitle")}
                </button>
                <div className={s.dist} style={{ marginLeft: "auto" }}>
                    {/* ★ 아이콘만 두지 않는다. 한글 라벨을 함께 남겨야
                        "이 그림이 무슨 재화인지"를 배우는 비용이 사라진다. */}
                    <span className={s.chip}>
                        <GameIcon name="currency.gold" size={14} decorative /> {t("common.gold")}{" "}
                        <b>{n(gold)}</b>
                    </span>
                    <span className={s.chip}>
                        <GameIcon name="currency.star" size={14} decorative /> {t("common.star")}{" "}
                        <b>{stars.available}</b>
                    </span>
                </div>
            </header>

            <div className={s.body}>
                {/* ── 왼쪽: 진행 ── */}
                <section className={s.col}>
                    <h2 className={s.h2}>
                        {t("ark.progressHeading")}{" "}
                        <span className={s.dim}>
                            {t("ark.worldOf", {
                                n: curWorld,
                                name: pick(WORLD_DEF[curWorld], "name"),
                            })}
                        </span>
                    </h2>

                    <Link to="/stages" className={`${s.nextCard} interactive`}>
                        <span className={s.nextLabel}>{t("ark.nextChallenge")}</span>
                        <b className={s.nextStage}>{next}</b>
                        <span className={s.dim}>{t("ark.goSortie")}</span>
                    </Link>

                    <div className={s.statGrid}>
                        <span>
                            {t("ark.statCleared")} <b>{clearedTotal} / {TOTAL_STAGES}</b>
                        </span>
                        <span>
                            {t("ark.statStarsEarned")} <b>{stars.earned}</b>
                        </span>
                        <span>
                            {t("ark.statStarsSpent")} <b>{stars.spent}</b>
                        </span>
                        <span>
                            {t("ark.statCompanions")} <b>{ownedCount} / {TOTAL_UNITS}</b>
                        </span>
                    </div>

                    <div className={s.worldList}>
                        {worlds.map((w) => {
                            const pct = Math.round((w.cleared / w.total) * 100);
                            return (
                                <div key={w.world} className={s.worldRow}>
                                    <span className={s.worldName}>
                                        {t("ark.worldOf", {
                                            n: w.world,
                                            name: pick(w.def, "name"),
                                        })}
                                    </span>
                                    <span className={s.worldBar}>
                                        <span style={{ width: `${pct}%` }} />
                                    </span>
                                    <span className={s.worldNum}>
                                        {w.cleared}/{w.total}
                                    </span>
                                    <span className={s.worldStar}>
                                        <GameIcon name="currency.star" size={11} decorative />{" "}
                                        {w.earned}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    <div className={s.quickRow}>
                        <Link to="/loadout" className={`${s.quick} interactive`}>
                            {t("ark.quickLoadout")}
                        </Link>
                        <Link to="/companions" className={`${s.quick} interactive`}>
                            {t("ark.quickCompanions")}
                        </Link>
                    </div>
                    <p className={`${s.warn} ${s.info}`}>
                        {t("ark.recruitNote", { n: RECRUITABLE.length })}
                    </p>
                </section>

                {/* ── 오른쪽: 시설 ── */}
                <section className={s.col}>
                    <h2 className={s.h2}>
                        {t("ark.facilitiesHeading")}{" "}
                        <span className={s.dim}>{t("ark.facilitiesHint")}</span>
                    </h2>
                    <div className={s.arkGrid}>
                        {FACILITIES.map((f) => {
                            const lv = ark[f.id] ?? 0;
                            const check = store().canUpgradeArk(f.id);
                            const cost = check.cost;

                            return (
                                <button
                                    key={f.id}
                                    className={`${s.facility} interactive`}
                                    disabled={!check.ok}
                                    // ★ 확인 모달을 거친다 (2026-08-05 사용자 요청).
                                    //   시설 강화는 이 게임에서 한 번에 가장 큰 골드가 나가는 자리다.
                                    onClick={() => setPendingArk(f.id)}
                                >
                                    <span className={s.facilityTop}>
                                        {/* 시설 이름·설명은 `meta.json` 이 단일 출처다 */}
                                        <b>{pick(f, "name")}</b>
                                        <span className={s.lv}>Lv.{lv}</span>
                                    </span>
                                    <span className={s.dim}>{pick(f, "desc")}</span>
                                    {check.reason === "locked" ? (
                                        <span className={s.cost}>
                                            {t("ark.facilityLocked", { stage: f.unlockStage })}
                                        </span>
                                    ) : check.reason === "max" ? (
                                        <span className={s.cost}>{t("common.maxLevel")}</span>
                                    ) : cost ? (
                                        <span className={s.cost}>
                                            <span className={gold < cost.gold ? s.lack : ""}>
                                                {t("ark.facilityCost", { n: n(cost.gold) })}
                                            </span>
                                        </span>
                                    ) : null}
                                </button>
                            );
                        })}
                    </div>
                    <p className={`${s.warn} ${s.info}`}>{t("ark.facilityNote")}</p>
                    {highestStage === 0 ? (
                        <p className={`${s.warn} ${s.info}`}>{t("ark.facilityLockNote")}</p>
                    ) : null}
                </section>
            </div>

            {pendingArk &&
                (() => {
                    const f = FACILITIES.find((x) => x.id === pendingArk);
                    const check = store().canUpgradeArk(pendingArk);
                    if (!f || !check.cost) return null;
                    const lv = ark[f.id] ?? 0;
                    const fname = pick(f, "name");
                    return (
                        <ConfirmModal
                            title={t("ark.upgradeTitle")}
                            subject={t("ark.upgradeSubject", {
                                name: fname,
                                from: lv,
                                to: lv + 1,
                            })}
                            cost={check.cost.gold}
                            after={gold - check.cost.gold}
                            confirmLabel={t("ark.upgradeConfirm")}
                            confirmSfx="meta.level_up"
                            onCancel={() => setPendingArk(null)}
                            onConfirm={() => {
                                setPendingArk(null);
                                if (!store().upgradeArk(f.id).ok) return;
                                flash(t("ark.upgradeDone", { name: fname, n: lv + 1 }));
                            }}
                        >
                            {pick(f, "desc")}
                        </ConfirmModal>
                    );
                })()}

            {toast && <div className={s.toast}>{toast}</div>}
        </div>
    );
}
