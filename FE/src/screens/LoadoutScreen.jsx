/**
 * 편성 화면 (P5-10/11/12)
 *
 * ★ 이 게임의 벽은 "편성 퍼즐"이어야 한다. 그러려면 무엇이 부족한지
 *   **전투 전에** 보여야 한다. 3번 지고 나서 대공이 없었다는 걸 깨닫는 것은
 *   퍼즐이 아니라 정보 은닉이다. 분석 패널이 이 화면의 존재 이유다.
 *
 * @see docs/02-design/13-progression-meta.md §5
 */
import { useState, useMemo, useRef } from "react";
import { CircleX, Info, TriangleAlert } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useGameStore } from "@/store";
import { GuideButton } from "@/components/GuideOverlay";
import LangToggle from "@/components/LangToggle";
import { Sprite } from "@/components/Sprite";
import { AirMark } from "@/components/AirMark";
import { CommanderPanel } from "./CommanderPanel";
import { analyzeLoadout, recommendLoadout, ROLE_ORDER } from "@/game/logic/loadoutAnalysis";
import { useT, usePick } from "@/i18n/useT";
import { RarityName } from "@/components/RarityName";
import { LOADOUT_SIZE } from "@/store/slices/rosterSlice";
import unitsData from "@/game/data/units.json";
import stagesData from "@/game/data/stages.json";
import s from "./Meta.module.css";

const UNITS = unitsData.units;
const UNIT = Object.fromEntries(UNITS.map((u) => [u.id, u]));

/**
 * ★★ **역할·데미지 타입 이름은 `terms` 네임스페이스가 유일한 출처다** (2026-08-07).
 *
 *   예전에는 `ROLE_LABEL_KO` · `DMG_TYPE_LABEL_KO` 표를 이 파일이 지역 상수로
 *   받아 두었다. 그 규약이 지킨 것("사전은 하나다")은 지금도 옳지만, 사전이
 *   **두 언어**가 되면서 출처가 `i18n/messages/terms.json` 하나로 옮겨 갔다.
 *   화면이 표를 다시 들지 않는다는 명제는 그대로이고(check:a11y A5),
 *   달라진 것은 조회 경로뿐이다 — `t("terms.role.BLOCKER")`.
 *
 * ★ 키는 `roles.js:ROLE_ORDER` · `units.json:dmgType` 의 **id 그대로**다.
 *   여기서 id 를 가공하지 않으므로, 역할이 하나 늘면 카탈로그 한 줄이면 된다.
 */

/**
 * 이 거리(px)를 넘게 움직여야 드래그로 본다.
 * ★ 손가락은 탭할 때도 몇 px 흔들린다. 0 으로 두면 칸을 고르는 탭이 전부
 *   "제자리 드래그"로 먹혀 선택이 안 된다.
 */
const DRAG_SLOP = 8;

export default function LoadoutScreen() {
    /**
     * ★★ `t` 를 모듈에서 바로 import 하지 않는다 — 그러면 언어를 바꿔도 이
     *   컴포넌트가 다시 그려지지 않는다 (`i18n/useT.js` 머리말).
     */
    const t = useT();
    const pick = usePick();
    const { presets, activePreset, owned } = useGameStore(
        useShallow((st) => ({
            presets: st.roster.presets,
            activePreset: st.roster.activePreset,
            owned: st.roster.owned,
        }))
    );
    const setPresetSlot = useGameStore((st) => st.setPresetSlot);
    const swapPresetSlots = useGameStore((st) => st.swapPresetSlots);
    const setPresetUnits = useGameStore((st) => st.setPresetUnits);
    const setActivePreset = useGameStore((st) => st.setActivePreset);

    /**
     * 화면 안 탭 — 편성 / 지휘관 (2026-08-05, 사용자 제안).
     * ★ 하단 탭 바는 다섯 칸 고정이다 (CLAUDE.md). 늘리지 않고 여기서 나눈다.
     */
    const [pane, setPane] = useState("units");
    const [slot, setSlot] = useState(0);
    /**
     * 분석 대상 스테이지 — **기본은 '전체'다** (2026-08-05, 사용자 요청).
     *
     * ★ 예전 기본값은 `stages.at(-1)` 즉 **마지막 스테이지(5-20)** 였다.
     *   1-3 을 하고 있는 계정이 편성 화면을 열면 최종 스테이지 기준으로
     *   분석이 돌아 "치명적으로 부족하다"가 뜬다 — 지금 편성이 지금 스테이지에
     *   맞는지를 보러 온 사람에게 아무 의미 없는 경고다.
     */
    const [stageId, setStageId] = useState(null);
    const [toast, setToast] = useState(null);

    const units = presets[activePreset]?.units ?? Array(LOADOUT_SIZE).fill(null);

    // ★ 보유 목록이 비어 있으면 전부 보유한 것으로 취급한다.
    //   가챠(P7) 전까지 이 화면을 실제로 만져볼 수 없으면 검증이 불가능하다.
    const ownedIds = useMemo(() => {
        const ids = Object.keys(owned);
        return ids.length ? ids : UNITS.map((u) => u.id);
    }, [owned]);

    const analysis = useMemo(() => analyzeLoadout(units, stageId), [units, stageId]);

    /**
     * ── 편성 칸 드래그 앤 드롭 (2026-08-05, 사용자 요청) ────────────────────
     *
     * ★★ **HTML5 드래그 API 를 쓰지 않는다.** `draggable` + `dragstart` 는
     *   터치 기기에서 발화하지 않는다 — 이 게임은 폰 가로가 본체이므로 그 구현은
     *   "데스크톱에서만 되는 기능"이 된다. 포인터 이벤트는 마우스·터치·펜을 같은
     *   경로로 다룬다.
     *
     * ★ 전투의 소환 드래그를 걷어냈던 이유(엄지가 화면을 가로지름·목적지를 가림)는
     *   여기 해당하지 않는다. 여섯 칸은 **서로 붙어 있고** 손가락 이동이 짧다.
     *
     * ★ **탭과 드래그를 구분한다.** `DRAG_SLOP`(px) 를 넘게 움직였을 때만 드래그로
     *   본다 — 그렇지 않으면 칸을 고르는 탭이 전부 드래그로 먹힌다.
     */
    const [drag, setDrag] = useState({ from: null, over: null, moved: false });
    const dragOrigin = useRef({ x: 0, y: 0 });

    const dragStart = (e, i) => {
        // ★ 포인터를 이 요소에 묶는다. 묶지 않으면 손가락이 칸을 벗어나는 순간
        //   pointermove 가 끊겨 드롭 대상을 알 수 없다.
        e.currentTarget.setPointerCapture?.(e.pointerId);
        dragOrigin.current = { x: e.clientX, y: e.clientY };
        setDrag({ from: i, over: i, moved: false });
    };

    const dragMove = (e) => {
        if (drag.from === null) return;
        const dx = e.clientX - dragOrigin.current.x;
        const dy = e.clientY - dragOrigin.current.y;
        const moved = drag.moved || Math.hypot(dx, dy) > DRAG_SLOP;
        // ★ 포인터 캡처 때문에 이벤트 대상은 계속 원래 칸이다.
        //   실제로 어느 칸 위에 있는지는 좌표로 찾는다.
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const over = el?.closest("[data-slot]")?.dataset?.slot;
        const overIndex = over == null ? null : Number(over);
        if (moved !== drag.moved || overIndex !== drag.over) {
            setDrag((d) => ({ ...d, moved, over: overIndex }));
        }
    };

    const dragEnd = () => {
        const { from, over, moved } = drag;
        setDrag({ from: null, over: null, moved: false });
        if (from === null) return;
        // 움직이지 않았으면 **탭**이다 — 칸 선택
        if (!moved || over === null || over === from) {
            setSlot(from);
            return;
        }
        swapPresetSlots(activePreset, from, over);
        // ★ 끌고 간 칸을 따라 선택도 옮긴다. 그러지 않으면 방금 옮긴 동료가
        //   아니라 엉뚱한 칸이 선택된 채로 남는다.
        setSlot(over);
    };

    const dragCancel = () => setDrag({ from: null, over: null, moved: false });

    const flash = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2200);
    };

    const applyRecommend = () => {
        setPresetUnits(activePreset, recommendLoadout(ownedIds, stageId));
        flash(t("loadout.autoFillDone"));
    };

    return (
        <div className={s.screen}>
            <header className={s.header}>
                <h1 className={s.title}>{t("loadout.title")}</h1>
                <GuideButton screen="loadout" />
                {/* ★ 언어 전환은 **모든 화면 머리글**에 있다 — 언어를 잘못 만난
                    사람은 설정을 찾아갈 수 없다 (`LangToggle.jsx` 머리말) */}
                <LangToggle />

                {/* ── 편성 / 지휘관 (2026-08-05, 사용자 제안) ──────────────────
                    ★★ 지휘관은 동료 6칸과 **다른 층위**다 — 레벨·장구·주문을 고르는
                      곳인데 편성 화면 아래에 붙어 있어서, 슬롯을 만지러 온 사람에게는
                      길고 지휘관을 만지러 온 사람에게는 찾기 어려웠다.
                    ★ **하단 탭은 늘리지 않는다** (CLAUDE.md — 탭은 언제나 다섯이다).
                      동료 화면의 성장·영입·별 트리와 같은 **화면 안 탭**으로 나눈다.
                    ★ 프리셋 탭·대상 선택은 편성에서만 의미가 있으므로 그때만 보인다. */}
                <div className={s.presetTabs}>
                    <button
                        className={`${s.presetTab} ${pane === "units" ? s.on : ""} interactive`}
                        onClick={() => setPane("units")}
                    >
                        {t("loadout.tabUnits")}
                    </button>
                    <button
                        className={`${s.presetTab} ${pane === "commander" ? s.on : ""} interactive`}
                        onClick={() => setPane("commander")}
                    >
                        {t("loadout.tabCommander")}
                    </button>
                </div>

                {pane === "units" && (
                    <>
                        <div className={s.presetTabs}>
                            {presets.map((p, i) => (
                                <button
                                    key={i}
                                    className={`${s.presetTab} ${i === activePreset ? s.on : ""} interactive`}
                                    onClick={() => setActivePreset(i)}
                                >
                                    {p.name}
                                </button>
                            ))}
                        </div>
                        <label className={s.stagePick}>
                            {t("loadout.presetTarget")}
                            <select
                                value={stageId ?? ""}
                                onChange={(e) => setStageId(e.target.value || null)}
                            >
                                <option value="">{t("loadout.presetTargetAll")}</option>
                                {stagesData.stages.map((st) => (
                                    <option key={st.id} value={st.id}>
                                        {st.id}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </>
                )}
            </header>

            {/* ★ 지휘관 탭 — 편성 슬롯·로스터를 걷어내고 지휘관만 넓게 본다 */}
            {pane === "commander" && (
                <div className={`${s.body} scrollable`}>
                    <section className={s.col}>
                        <CommanderPanel />
                    </section>
                </div>
            )}

            {/* ★★ `hidden` 속성을 쓰지 않는다 (2026-08-05, 실측으로 잡음).
                UA 기본 규칙 `[hidden]{display:none}` 은 **작성자 스타일시트보다 약하다.**
                `.body { display: flex }` 가 그대로 이겨서 지휘관 탭에서도 편성 화면이
                통째로 그려지고 있었다 — 화면에는 두 탭이 겹쳐 보인다.
                조건부 렌더가 이 종류의 사고를 구조적으로 없앤다. */}
            {pane === "units" && (
            /**
             * ★★ **좌 편성 · 우 보유 동료. 두 칸은 정확히 반반이다** (2026-08-05, 사용자 요청).
             *
             *   `.body` 를 쓰던 시절에는 두 칸이 `flex: 1 1 380px` 이라 **내용이 큰 쪽이
             *   칸을 밀어냈고**(슬롯 6칸의 최소 폭 vs 카드 그리드), 어느 칸도 자기 안에서
             *   스크롤하지 않아 **페이지가 통째로 흘렀다** — 보유 동료를 훑으면 편성 6칸이
             *   화면 밖으로 사라진다. 고르는 쪽과 놓는 쪽은 **동시에 보여야** 한다.
             *
             * ★ 클래스는 **동료 > 성장 탭과 같은 것**(`.split` / `.splitPane`)이다.
             *   같은 게임에서 두 화면이 다른 규칙으로 움직이면 그 자체가 배워야 할 비용이다.
             */
            <div className={s.split}>
                {/* ── 왼쪽: 편성 6칸 + 분석 (자기 안에서만 스크롤한다) ── */}
                <section className={s.splitPane}>
                    <div className={s.slots}>
                        {units.map((id, i) => {
                            const u = id ? UNIT[id] : null;
                            return (
                                <button
                                    key={i}
                                    data-slot={i}
                                    className={[
                                        s.slot,
                                        i === slot ? s.on : "",
                                        drag.from === i ? s.dragging : "",
                                        drag.over === i && drag.from !== i ? s.dragOver : "",
                                        "interactive",
                                    ]
                                        .filter(Boolean)
                                        .join(" ")}
                                    onPointerDown={(e) => dragStart(e, i)}
                                    onPointerMove={dragMove}
                                    onPointerUp={dragEnd}
                                    onPointerCancel={dragCancel}
                                >
                                    {u ? (
                                        <>
                                            <Sprite atlas={u.art.atlas} frame={u.art.frame} scale={2} />
                                            <RarityName rarity={u.rarity}>
                                                {pick(u, "name")}
                                            </RarityName>
                                            <span>
                                                {t(`terms.role.${u.role}`)} · {u.cost}
                                                {u.squad > 1 ? ` ×${u.squad}` : ""}{" "}
                                                {/* ★ 대공 여부는 역할이 말해 주지 않는다 (2026-08-05) */}
                                                <AirMark def={u} compact />
                                            </span>
                                        </>
                                    ) : (
                                        <span className={s.empty}>{t("loadout.emptySlot")}</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* ★ 6칸 **위**는 고정, 분석만 스크롤, [자동 추천]은 발에 고정이다.
                        세로 412px 짜리 폰 가로에서 분석 경고가 3줄 이상 나오면 예전에는
                        버튼이 화면 밖으로 밀려 **누를 수 없는 UI** 가 됐다. */}
                    <div className={`${s.detailScroll} scrollable`}>
                        <AnalysisPanel analysis={analysis} />
                    </div>

                    {/*
                      ★★ **공유 코드는 삭제했다** (2026-08-04, 사용자 판단).
                        복사 · 붙여넣기 · 불러오기 셋이 폰 가로에서 한 줄을 통째로 먹고
                        있었는데, 이 게임에는 코드를 주고받을 상대가 없다 —
                        소셜은 영원히 만들지 않기로 한 항목이다 (34-scope-cut.md).
                        `logic/loadoutCode.js` 는 남겨 둔다: 순수 함수이고 테스트가 있으며,
                        되살릴 때 화면만 붙이면 된다.
                    */}
                    <div className={s.detailFoot}>
                        <div className={s.actions}>
                            <button className={`${s.btn} interactive`} onClick={applyRecommend}>
                                {t("loadout.autoFill")}
                            </button>
                        </div>
                    </div>

                    {/* ★★ **지휘관은 여기 없다** (2026-08-05, 사용자 제보 2회).
                        한때 "지휘관도 전투에 들고 나가는 것"이라는 이유로 동료 6칸
                        아래에 붙어 있었다. 그런데 지휘관은 **다른 층위**다 —
                        레벨·장구·주문을 고르는 화면이고, 그것이 여기 있으면 편성
                        화면이 세로로 길어져 정작 6칸을 고르는 일이 밀려난다.
                        지금은 위쪽 [지휘관] 탭이 유일한 자리다. **여기 다시
                        붙이지 마라** — `loadoutPanes.test.js` 가 막는다. */}
                </section>

                {/* ── 오른쪽: 함께할 수 있는 동료 전부 (자기 안에서만 스크롤한다) ── */}
                <section className={s.splitPane}>
                    <h2 className={s.h2}>
                        {t("loadout.rosterTitle")}{" "}
                        <span className={s.dim}>
                            {t("common.countKinds", { n: ownedIds.length })}
                        </span>
                    </h2>
                    <div className={`${s.roster} scrollable`}>
                        {ROLE_ORDER.map((role) => {
                            const list = ownedIds.map((id) => UNIT[id]).filter((u) => u?.role === role);
                            if (!list.length) return null;
                            return (
                                <div key={role} className={s.roleGroup}>
                                    <h3 className={s.roleTitle}>{t(`terms.role.${role}`)}</h3>
                                    <div className={s.cards}>
                                        {list.map((u) => {
                                            const picked = units.includes(u.id);
                                            return (
                                                <button
                                                    key={u.id}
                                                    className={`${s.card} ${picked ? s.picked : ""} interactive`}
                                                    onClick={() =>
                                                        setPresetSlot(
                                                            activePreset,
                                                            slot,
                                                            picked && units[slot] === u.id ? null : u.id
                                                        )
                                                    }
                                                >
                                                    <span className={s.cardArt}>
                                                        <Sprite atlas={u.art.atlas} frame={u.art.frame} scale={2} />
                                                    </span>
                                                    <RarityName rarity={u.rarity}>
                                                        {pick(u, "name")}
                                                    </RarityName>
                                                    <span className={s.cardMeta}>
                                                        {t(`terms.dmg.${u.dmgType}`)} · {u.cost}{" "}
                                                        {/*
                                                          ★★ 예전에는 `tags.includes("ANTI_AIR")` 일 때만
                                                            "· 대공"을 붙였다. 그런데 **술식·신성은 태그가
                                                            없어도 공중에 닿는다** (`combat.js:canHitFlying`) —
                                                            즉 이 표기는 대공 가능한 동료의 일부만 대공이라고
                                                            말하고 있었다. 판정을 규칙 모듈로 넘긴다 (2026-08-05).
                                                        */}
                                                        <AirMark def={u} compact />
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            </div>
            )}

            {toast && <div className={s.toast}>{toast}</div>}
        </div>
    );
}

/**
 * 경고 심각도 아이콘.
 * ★ 색만으로 심각도를 구분하지 않는다 — 형태가 다르므로 색각 이상에서도 읽힌다.
 */
function SeverityIcon({ severity }) {
    const t = useT();
    const Ico = severity === "critical" ? CircleX : severity === "warn" ? TriangleAlert : Info;
    /** ★ `aria-label` 도 번역 대상이다 — 스크린 리더는 화면과 같은 언어로 읽는다 */
    const label =
        severity === "critical"
            ? t("loadout.sevCritical")
            : severity === "warn"
              ? t("loadout.sevWarn")
              : t("loadout.sevInfo");
    return <Ico size={13} aria-label={label} />;
}

/** 편성 분석 패널 — 이 화면의 핵심 */
function AnalysisPanel({ analysis }) {
    const t = useT();
    const { roles, dmgTypes, avgCost, fitness, warnings, count } = analysis;
    const fitColor = fitness >= 80 ? "#4caf7d" : fitness >= 50 ? "var(--gold)" : "#e05555";

    return (
        <div className={s.analysis}>
            <div className={s.fitRow}>
                <span className={s.dim}>{t("loadout.fitness")}</span>
                <div className={s.fitBar}>
                    <div style={{ width: `${fitness}%`, background: fitColor }} />
                </div>
                <b style={{ color: fitColor }}>{fitness}</b>
            </div>

            <div className={s.dist}>
                {ROLE_ORDER.filter((r) => roles[r] > 0).map((r) => (
                    <span key={r} className={s.chip}>
                        {t(`terms.role.${r}`)} <b>{roles[r]}</b>
                    </span>
                ))}
                {Object.entries(dmgTypes)
                    .filter(([, n]) => n > 0)
                    .map(([k, n]) => (
                        <span key={k} className={`${s.chip} ${s.chipDmg}`}>
                            {t(`terms.dmg.${k}`)} <b>{n}</b>
                        </span>
                    ))}
                {count > 0 && (
                    <span className={s.chip}>
                        {t("loadout.avgCost")} <b>{avgCost}</b>
                    </span>
                )}
            </div>

            {warnings.length === 0 ? (
                <p className={`${s.warn} ${s.ok}`}>{t("loadout.noIssues")}</p>
            ) : (
                warnings.map((w) => (
                    <p key={w.code} className={`${s.warn} ${s[w.severity]}`}>
                        <SeverityIcon severity={w.severity} /> {w.text}
                    </p>
                ))
            )}
        </div>
    );
}
