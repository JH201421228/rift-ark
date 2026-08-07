/**
 * 스테이지 프리뷰 패널 (P6-09)
 *
 * ★ "무엇이 오는가"를 전투 **전에** 보여주는 화면이다.
 *   이 게임의 벽은 편성 퍼즐이어야 하고(CLAUDE.md §5), 퍼즐은 정보가 열려 있을 때만
 *   퍼즐이다. 지고 나서 대공이 없었다는 걸 알게 되는 것은 난이도가 아니라 정보 은닉이다.
 *
 * ★ 집계·경고·추천은 전부 `game/logic/stagePreview.js` 의 순수 함수가 낸다.
 *   여기는 표현만 한다 — 화면에 규칙을 두면 밸런스 하네스가 검증하는 것과
 *   플레이어가 보는 것이 갈라진다.
 *
 * ★ 추천 편성은 하네스의 `recommended` 편성과 **같은 함수**다.
 *   게이트 B4 가 "이 편성으로 클리어 가능"이라고 검증한 그 편성을 그대로 준다.
 *
 * @see docs/04-plan/33-execution-plan.md P6-09
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CircleX, Info, Lock, Sparkles, Swords, TriangleAlert } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useT, usePick, useLang } from "@/i18n/useT";
import { useGameStore } from "@/store";
import { GameIcon } from "@/components/GameIcon";
import { RarityName } from "@/components/RarityName";
import { Sprite } from "@/components/Sprite";
import { AirMark } from "@/components/AirMark";
import { stagePreview } from "@/game/logic/stagePreview";
// ★ 진행 게이트 · 획득 경로는 규칙 모듈이 답한다. 화면은 문장으로 옮기기만 한다.
import { canEnterStage } from "@/game/logic/stageUnlock";
import { grantStageOf } from "@/game/logic/unlocks";
import unitsData from "@/game/data/units.json";
import s from "./StagePreview.module.css";

const UNIT = Object.fromEntries(unitsData.units.map((u) => [u.id, u]));
const ALL_UNIT_IDS = unitsData.units.map((u) => u.id);

/**
 * ★★★ **전투 개념의 표기는 `terms` 네임스페이스 하나다** (2026-08-07 i18n).
 *
 *   태그(`terms.tag.*`) · 역할(`terms.role.*`) · 난이도(`terms.difficulty.*`) ·
 *   모드(`terms.mode.*`) 는 전부 `id` 로 조회한다. 이 화면이 사본을 들고 있으면
 *   프리뷰에서 배운 단어를 전장에서 못 알아본다 — 예전에 여기 있던 태그 사본이
 *   패배 화면·보스 HUD 사본과 갈라져 "결계" vs "마법저항" 이 됐던 그 사고다.
 *
 * ★ `t()` 에 템플릿 리터럴을 쓰는 것은 여기뿐이고, 그래도 되는 이유는
 *   `terms.*` 가 **접두 규칙이 있는 동적 조회**로 `check:i18n` I6 에서 면제되기
 *   때문이다. 그 밖의 네임스페이스는 반드시 리터럴 키로 부른다.
 */
const term = (t, kind, id) => t(`terms.${kind}.${id}`);

/**
 * 모드 한 줄 요약 — 승리 조건. **모드 이름은 여기 없다** (`terms.mode.*`).
 * ★ 키를 리터럴로 적어 두어 I6 가 정적으로 셀 수 있게 한다.
 * ★ 2026-08-04 경량화로 모드는 둘뿐이다 (endure · breakthrough · escort 는 사라졌고,
 *   `stages.json` 에도 한 건도 없다). 없는 모드의 문구를 남겨 두면 그것은
 *   "선언했는데 아무도 읽지 않는 것" 이 된다.
 */
const MODE_NOTE = {
    assault: (t) => t("stages.modeNoteAssault"),
    nemesis: (t) => t("stages.modeNoteNemesis"),
};

/** 적 목록은 상위 몇 종만 보여준다 — 전부 늘어놓으면 태그 요약이 묻힌다 */
const ENEMY_LIST_MAX = 6;

/**
 * 경고 심각도 아이콘.
 * ★ 색만으로 구분하지 않는다 — 형태가 다르므로 색각 이상에서도 읽힌다.
 *   (편성 화면 AnalysisPanel 과 같은 규칙을 쓴다)
 * ★ `aria-label` 도 번역 대상이다 — 스크린리더 사용자에게는 그 글자가
 *   심각도를 아는 **유일한** 채널이다.
 */
function SeverityIcon({ severity }) {
    const t = useT();
    const Ico = severity === "critical" ? CircleX : severity === "warn" ? TriangleAlert : Info;
    const label =
        severity === "critical"
            ? t("stages.severityCritical")
            : severity === "warn"
              ? t("stages.severityWarn")
              : t("stages.severityInfo");
    return <Ico size={13} aria-label={label} />;
}

/**
 * @param {object} p
 * @param {string|null} p.stageId
 */
export function StagePreview({ stageId }) {
    const t = useT();
    const pick = usePick();
    /**
     * ★★★ **언어가 `useMemo` 의 의존성이다** (2026-08-07, 화면에서 잡았다).
     *
     *   `stagePreview()` 는 순수 함수처럼 보이지만 순수하지 않다 — 적 이름과 부제를
     *   `i18n:pick()` 으로 고르고, 그 함수는 **모듈 스코프의 현재 언어**를 읽는다.
     *   그래서 언어를 바꾸면 답이 달라지는데, 의존성 배열에는 그 사실이 없었다.
     *   실측: 영어로 바꿔도 이 패널의 적 이름만 "인어 수술사" 로 남았다
     *   (배지·제목은 `t()` 라 즉시 바뀌었으므로 **한 패널 안에 두 언어**가 섞였다).
     *
     * ★ `pick` 이나 `t` 를 의존성에 넣는 것으로는 부족하다 — 그것들은 이 컴포넌트가
     *   부르는 것이고, `stagePreview()` 는 자기가 직접 모듈을 읽는다. 읽는 **값**을
     *   의존성으로 적어야 한다.
     */
    const lang = useLang();
    const { owned, presets, activePreset, presetName, highestStage, selectedDifficulty } =
        useGameStore(
            useShallow((st) => ({
                owned: st.roster.owned,
                presets: st.roster.presets,
                activePreset: st.roster.activePreset,
                presetName: st.roster.presets[st.roster.activePreset]?.name ?? "",
                highestStage: st.meta.highestStage,
                selectedDifficulty: st.meta.selectedDifficulty,
            }))
        );
    const setPresetUnits = useGameStore((st) => st.setPresetUnits);
    const setActivePreset = useGameStore((st) => st.setActivePreset);
    /**
     * ★★ **이 판이 실제로 시작될 난이도.** 선택값을 그대로 쓰지 않는다 —
     *   월드 2 나이트메어를 골라둔 채 월드 5 스테이지를 열면 전투는 노멀로 시작하고
     *   (`resolveDifficulty`), 프리뷰만 규칙을 그리면 화면이 거짓말을 한다.
     *   전투 진입(`BattleScreen`)이 부르는 것과 **같은 함수**를 부른다.
     */
    const resolveDifficulty = useGameStore((st) => st.resolveDifficulty);
    const [toast, setToast] = useState(null);

    // ★ 보유 목록이 비어 있으면 전 로스터를 후보로 본다.
    //   가챠(P7) 전까지 이 화면을 실제로 만져볼 수 없으면 검증이 불가능하다.
    //   (편성 화면과 같은 규칙 — 두 화면이 다른 추천을 내면 안 된다)
    const ownedIds = useMemo(() => {
        const ids = Object.keys(owned);
        return ids.length ? ids : ALL_UNIT_IDS;
    }, [owned]);

    /**
     * ★ 고른 값을 **인자로 넘긴다.** `resolveDifficulty` 는 안 넘기면 스토어에서
     *   같은 값을 읽지만, 그러면 이 메모가 무엇 때문에 다시 계산돼야 하는지가
     *   의존성 배열에서 사라진다 — 난이도를 바꿔도 배지가 그대로 남는 종류의 결함이다.
     */
    const difficulty = useMemo(
        () => (stageId ? resolveDifficulty(stageId, selectedDifficulty) : null),
        [stageId, selectedDifficulty, resolveDifficulty]
    );

    const preview = useMemo(
        () => (stageId ? stagePreview(stageId, { unitIds: ownedIds, difficulty }) : null),
        // eslint-disable-next-line react-hooks/exhaustive-deps -- lang: 위 주석 참조 (stagePreview 가 i18n 모듈 스코프를 읽는다)
        [stageId, ownedIds, difficulty, lang]
    );

    if (!preview) {
        return (
            <aside className={s.panel}>
                <p className={s.placeholder}>{t("stages.placeholder")}</p>
            </aside>
        );
    }

    const applyRecommended = () => {
        setPresetUnits(activePreset, preview.recommended);
        setToast(t("stages.toastApplied", { preset: presetName }));
        setTimeout(() => setToast(null), 2400);
    };

    return (
        <aside className={s.panel}>
            <header className={s.head}>
                <h2 className={s.stageId}>{preview.stageId}</h2>
                <span className={s.mode}>{term(t, "mode", preview.mode)}</span>
            </header>
            {/* 부제는 `stages.json` 이 단일 출처다 */}
            <p className={s.teaches}>{pick(preview, "teaches")}</p>
            <p className={s.modeNote}>{MODE_NOTE[preview.mode]?.(t) ?? ""}</p>

            {/*
              ★★ **나이트메어 규칙은 진입 *전에* 읽혀야 한다** (22-nightmare.md §5.3).
                규칙을 들어가서 알게 되면 그것은 난이도가 아니라 정보 은닉이고,
                이 패널이 적 태그를 미리 보여 주는 이유와 정확히 같은 논리다.

              ★ 스크롤 영역 **밖**이다 — 다른 절과 달리 이것은 "무엇이 다른 판인가"라
                한 번은 반드시 눈에 들어와야 한다. 노멀·하드에서는 `null` 이므로
                고정 공간을 먹지 않는다.

              ★ 판정도 문장도 화면이 만들지 않는다. `logic/nightmare.js` 가 월드를
                보고 고르고, 이름·요약은 `balance.json` 이 준다 — `usePick` 이 현재
                언어의 필드를 고르므로 `{ko,en}` 이든 구형 `nameKo` 든 같은 코드가 읽는다
                (화면에 `world === 5` 도 수치도 없다).

              ★ 아이콘이 없는 것은 실수가 아니다 — 역병·결박·고갈에 대응하는 글리프가
                아이콘 시트에 없고, 좌표를 지어내면 다음 사람이 엉뚱한 칸을 얻는다.
                이모지는 절대규칙 5 위반이다. 그래서 **텍스트가 유일하게 정직한 배지**다
                (22-nightmare.md §0-A #6).
            */}
            {preview.nightmare && (
                <div className={s.nightmare}>
                    <span className={s.nightmareLead}>
                        {t("stages.nightmareRule", {
                            difficulty: term(t, "difficulty", difficulty),
                        })}
                    </span>
                    <b className={s.nightmareName}>{pick(preview.nightmare, "name")}</b>
                    <p className={s.nightmareSummary}>{pick(preview.nightmare, "summary")}</p>
                </div>
            )}

            <div className={s.stats}>
                <span>
                    {t("common.wave")} <b>{preview.waves}</b>
                </span>
                <span>
                    {t("common.ark")} <b>{preview.arkHp}</b>
                </span>
                <span>
                    {t("stages.statTarget")} <b>{t("common.seconds", { n: preview.targetTimeSec })}</b>
                </span>
                <span>
                    {t("stages.statEnemies")} <b>{t("stages.enemyCount", { n: preview.total })}</b>
                </span>
            </div>

            <div className={`${s.scroll} scrollable`}>
                {/* ── 적 태그 카운트 ── */}
                <h3 className={s.h3}>{t("stages.headTags")}</h3>
                <div className={s.tags}>
                    {/* ★ 콜백 인자를 `tg` 로 바꿨다 — 예전 이름 `t` 가 번역 함수를 가린다 */}
                    {preview.tags.map((tg) => (
                        <span key={tg.tag} className={s.tagChip}>
                            {/* 8×8 원본이라 size 32 = ×2 배율(16px). 전투 화면 배지와 같은 그림이다 */}
                            <GameIcon name={`tag.${tg.tag}`} size={32} decorative />
                            {term(t, "tag", tg.tag)}
                            <b>{tg.count}</b>
                            <span className={s.share}>
                                {t("common.percent", { n: Math.round(tg.share * 100) })}
                            </span>
                        </span>
                    ))}
                </div>

                {/* ── 경고 ── */}
                <h3 className={s.h3}>{t("stages.headWarnings")}</h3>
                {preview.warnings.map((w) => (
                    <p key={w.code} className={`${s.warnRow} ${s[w.severity]}`}>
                        <SeverityIcon severity={w.severity} /> {w.text}
                    </p>
                ))}

                {/* ── 보스 페이즈 ── */}
                {preview.bossPhases.length > 0 && (
                    <>
                        <h3 className={s.h3}>{t("stages.headBossPhases")}</h3>
                        <div className={s.phases}>
                            {preview.bossPhases.map((ph, i) => (
                                <span key={i} className={s.phase}>
                                    <b>{i + 1}</b>
                                    {ph.tags.length
                                        ? ph.tags.map((tag) => (
                                              <GameIcon
                                                  key={tag}
                                                  name={`tag.${tag}`}
                                                  size={32}
                                                  title={term(t, "tag", tag)}
                                              />
                                          ))
                                        : t("stages.phaseNoDefense")}
                                </span>
                            ))}
                        </div>
                    </>
                )}

                {/* ── 등장 적 ── */}
                <h3 className={s.h3}>{t("stages.headEnemies")}</h3>
                <div className={s.enemies}>
                    {preview.enemies.slice(0, ENEMY_LIST_MAX).map((e) => (
                        <span key={e.id} className={s.enemy} title={pick(e, "name")}>
                            <Sprite atlas={e.art?.atlas ?? "units"} frame={e.art?.frame} scale={2} />
                            <span className={s.enemyName}>{pick(e, "name")}</span>
                            <b>{e.count}</b>
                            {/*
                              ★★ **멀리서 쏘는 적은 그렇다고 말한다** (2026-08-05).
                                태그는 "무엇으로 뚫는가"(상성)를 말할 뿐 **"어디서
                                때리는가"** 는 말하지 않는다. 원거리 적은 방벽 뒤로
                                후열을 계속 때리므로 **아군 사거리로 먼저 끊어야 하는**
                                전혀 다른 요구인데, 화면에 그 사실이 없었다.
                                (2026-08-05 이전에는 이 적들이 아예 즉발이었다 —
                                `enemies.json` 에 role 이 없어 62/62 가 근접이었다.)
                            */}
                            {e.ranged && (
                                <span className={s.enemyRanged} title={t("stages.rangedTip")}>
                                    {term(t, "role", "RANGED")}
                                </span>
                            )}
                        </span>
                    ))}
                    {preview.enemies.length > ENEMY_LIST_MAX && (
                        <span className={s.more}>
                            {t("stages.moreEnemies", {
                                n: preview.enemies.length - ENEMY_LIST_MAX,
                            })}
                        </span>
                    )}
                </div>

                {/* ── 추천 편성 ── */}
                <h3 className={s.h3}>{t("stages.headRecommended")}</h3>
                {/*
                  ★★ **문구는 조건부여야 한다.**
                    추천은 **보유분**에서 나온다(그것이 옳다). 그런데 예전에는 그 아래에
                    언제나 "밸런스 검증이 이 편성으로 클리어 가능을 확인한 구성입니다"가
                    붙어 있었다 — 보유 2종뿐인 신규 계정이 2-7 프리뷰를 열면 6칸 답안 대신
                    2칸이 뜨고, 바로 아래 문장이 "이걸로 깰 수 있다"고 단언했다.
                    막힌 플레이어에게 원인도 다음 행동도 알려 주지 않는 상태였다.
                    판정(`preview.gap`)은 `logic/stagePreview.js` 가 한다.
                */}
                {preview.gap.verified ? (
                    <p className={s.recNote}>{t("stages.recVerified")}</p>
                ) : (
                    <>
                        {/* ★ 역할 목록을 문장에 **끼워 넣는다** — 문장을 조각내지 않는다.
                            영어는 "also needs Blocker · Ranged" 로 어순이 반대다. */}
                        <p className={s.recNote}>
                            {t("stages.recBest", {
                                roles: preview.gap.missingRoles
                                    .map((r) => term(t, "role", r))
                                    .join(" · "),
                            })}
                        </p>
                        <ul className={s.recGap}>
                            {preview.gap.missingUnits.map((id) => {
                                const u = UNIT[id];
                                const from = grantStageOf(id);
                                return (
                                    <li key={id}>
                                        <RarityName rarity={u?.rarity}>
                                            {pick(u, "name") || id}
                                        </RarityName>
                                        <span className={s.recRole}>
                                            {from
                                                ? t("stages.grantFrom", { stage: from })
                                                : t("stages.grantSummon")}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    </>
                )}
                <div className={s.rec}>
                    {preview.recommended.map((id) => {
                        const u = UNIT[id];
                        if (!u) return null;
                        return (
                            <span key={id} className={s.recUnit}>
                                <Sprite atlas={u.art.atlas} frame={u.art.frame} scale={2} />
                                <RarityName rarity={u.rarity}>{pick(u, "name")}</RarityName>
                                <span className={s.recRole}>
                                    {term(t, "role", u.role)} · {u.cost}{" "}
                                    <AirMark def={u} compact />
                                </span>
                            </span>
                        );
                    })}
                </div>

                {/* ── 출전 프리셋 (2026-08-05, 사용자 요청) ──────────────────
                    ★★ 프리셋 3개는 편성 화면에만 있었고, 출격 직전에 고를 수 없었다.
                      "이 스테이지에는 대공 편성"처럼 **스테이지를 보고 고르는 것**이
                      프리셋의 존재 이유인데, 정작 스테이지를 보는 화면에서 못 바꿨다.
                    ★ 여기서 고르는 것은 `activePreset` 하나다 — 전투가 읽는 것과
                      **같은 값**이어야 한다. 출격 전용 선택을 따로 두면 편성 화면이
                      말하는 편성과 실제로 나가는 편성이 갈라진다.

                    ★★ **스크롤 영역 안에 있다** (2026-08-05, 사용자 제보 —
                      "적 태그부터 스크롤 가능한 요소의 크기가 너무 작다").
                      패널은 세로가 고정(폰 가로 412px)이고 `.scroll` 만 남는 높이를
                      가져간다. 프리셋을 바깥에 두면 제목·칩·여백이 **고정 공간**을
                      먹어 그만큼 스크롤 창이 줄어든다 — 적 태그·등장 적·추천 편성이
                      다 같이 좁아졌다. 출격 버튼(`.actions`)만 고정으로 남긴다:
                      그것은 **언제나 손이 닿아야 하는 것**이라 스크롤에 넣으면 안 된다. */}
                <h3 className={s.h3}>{t("stages.headPresets")}</h3>
                <div className={s.presetRow}>
                    {presets.map((p, i) => {
                        const filled = p.units.filter(Boolean).length;
                        return (
                            <button
                                key={i}
                                type="button"
                                className={`${s.presetChip} ${
                                    i === activePreset ? s.presetOn : ""
                                } interactive`}
                                aria-pressed={i === activePreset}
                                onClick={() => setActivePreset(i)}
                            >
                                <b>{p.name}</b>
                                <span className={s.presetCount}>{filled}/6</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className={s.actions}>
                <button
                    className={`${s.btn} interactive`}
                    onClick={applyRecommended}
                    disabled={preview.recommended.length === 0}
                >
                    <Sparkles size={14} /> {t("stages.applyRecommended")}
                </button>
                <Link to="/loadout" className={`${s.btn} interactive`}>
                    {t("stages.editLoadout")}
                </Link>
                {/*
                  ★★ **잠긴 스테이지는 출격 버튼이 없다** — 판정은 `BattleScreen` 의
                    마운트 가드와 **같은 술어**다. 예전에는 이 링크가 조건 없이 열려 있어
                    `/battle/5-20` 이 그대로 시작됐고, 한 번 이기면
                    `highestStage = max(prev, globalIndex)` 가 던전·탑·하드·방주 시설을
                    한꺼번에 열었다.
                  ★ 프리뷰 자체는 잠겨도 **보여 준다.** 막는 것은 출격이지 정보가 아니다.
                */}
                {canEnterStage(preview.stageId, highestStage) ? (
                    <Link
                        to={`/battle/${preview.stageId}`}
                        className={`${s.btn} ${s.btnPrimary} interactive`}
                    >
                        <Swords size={14} /> {t("stages.sortie")}
                    </Link>
                ) : (
                    <span className={`${s.btn} ${s.btnLocked}`} aria-disabled="true">
                        <Lock size={14} aria-hidden /> {t("stages.lockedSortie")}
                    </span>
                )}
            </div>

            {toast && <div className={s.toast}>{toast}</div>}
        </aside>
    );
}

export default StagePreview;
