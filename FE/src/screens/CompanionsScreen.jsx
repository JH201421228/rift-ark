/**
 * 동료 화면 (P5-03) + 별 트리 (P5-08)
 *
 * ★★ **성장은 레벨 하나뿐이다** (2026-08-04 경량화). 승급 · 장비 · 소유 효과가
 *   같이 사라졌다 — 셋 다 가챠 · 상점 · 강화석에 물려 있었고, 그것들을 걷어내면
 *   재화가 들어올 곳 없는 UI 만 남는다. 그 자리는 방주 무기고가 이어받는다.
 *
 * ★ 성장 상한이 왜 막혔는지를 항상 문장으로 말해준다.
 *   "레벨 상한"만 표기하면 플레이어는 훈련장을 올려야 한다는 걸 모른다.
 */
import { useState, useMemo } from "react";
import { Lock } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useGameStore } from "@/store";
import { GuideButton } from "@/components/GuideOverlay";
import LangToggle from "@/components/LangToggle";
import { useT, usePick, useLang } from "@/i18n/useT";
import { Sprite } from "@/components/Sprite";
import { GameIcon } from "@/components/GameIcon";
import { RarityName } from "@/components/RarityName";
import {
    unitLevelCap,
    unitLevelCost,
    levelUpPlan,
    STAR_NODES,
} from "@/game/logic/progression";
import { ConfirmModal } from "@/components/ConfirmModal";
import { AirMark } from "@/components/AirMark";
import { OwnedMark } from "@/components/OwnedMark";
import { loreOf } from "@/game/logic/unitLore";
import { RARITY_ORDER } from "@/game/logic/labels";
import { RECRUITABLE, canRecruit, recruitCost, recruitUnlockStage } from "@/game/logic/recruit";
import unitsData from "@/game/data/units.json";
import s from "./Meta.module.css";

const UNITS = unitsData.units;
const UNIT = Object.fromEntries(UNITS.map((u) => [u.id, u]));

/**
 * ★★ **역할 · 데미지 타입 · 태그 이름은 `terms` 네임스페이스가 유일한 출처다**
 *   (2026-08-07). 예전에는 `logic/labels.js` · `logic/roles.js` 의 한국어 표를
 *   지역 상수로 받아 두었고, 그 규약이 지킨 명제("사전은 하나다")는 지금도 옳다.
 *   달라진 것은 사전이 **두 언어**가 되면서 출처가 `i18n/messages/terms.json`
 *   하나로 옮겨 갔다는 것뿐이다 — 화면은 여전히 표를 다시 들지 않는다
 *   (`check:a11y` A5 가 그것을 강제한다).
 * ★ 키는 `roles.js` · `tags.js` · `units.json:dmgType` 의 **id 그대로**다.
 */

/**
 * 등급 이름.
 * ★★ 표를 만들지 않고 **부르는 곳을 정적으로 남긴다** — `t("companions.rarity" + r)`
 *   로 조립하면 `check:i18n` 의 키 사용 대조(I6)가 그 키들을 "아무도 안 부르는 것"
 *   으로 읽는다. 등급은 넷 고정이므로 나열이 가장 정직하다.
 * ★ 등급을 **색으로만** 말하지 않는다는 규약(A3)은 `RarityName` 이 지킨다 —
 *   여기 있는 것은 상세 한 줄에 글자로 적히는 이름이다.
 */
function rarityLabel(t, rarity) {
    return rarity === "L"
        ? t("companions.rarityL")
        : rarity === "E"
          ? t("companions.rarityE")
          : rarity === "R"
            ? t("companions.rarityR")
            : rarity === "C"
              ? t("companions.rarityC")
              : "—";
}

/** 별 트리 가지 이름 — 위와 같은 이유로 나열한다 */
function branchLabel(t, branch) {
    return branch === "might"
        ? t("companions.branchMight")
        : branch === "endurance"
          ? t("companions.branchEndurance")
          : branch === "flow"
            ? t("companions.branchFlow")
            : branch === "insight"
              ? t("companions.branchInsight")
              : branch;
}

const n = (v) => Math.floor(v).toLocaleString();

export default function CompanionsScreen() {
    const t = useT();
    const [tab, setTab] = useState("units");
    /**
     * 보유 골드 (2026-08-05, 사용자 요청).
     * ★★ 성장·영입·별 트리가 전부 **골드를 쓰는 화면**인데 정작 잔액이 없었다.
     *   "레벨업 · 골드 340" 옆에 지갑이 없으면 계획을 세울 수 없다 —
     *   방주 화면은 이미 헤더에 골드 칩을 달고 있고, 그 규약을 여기에도 맞춘다.
     */
    const gold = useGameStore((st) => st.meta.currencies.gold);
    return (
        <div className={s.screen}>
            <header className={s.header}>
                <h1 className={s.title}>{t("companions.title")}</h1>
                <GuideButton screen="companions" />
                {/* ★ 언어 전환은 **모든 화면 머리글**에 있다 (`LangToggle.jsx` 머리말) */}
                <LangToggle />
                <div className={s.presetTabs}>
                    <button
                        className={`${s.presetTab} ${tab === "units" ? s.on : ""} interactive`}
                        onClick={() => setTab("units")}
                    >
                        {t("companions.tabGrowth")}
                    </button>
                    <button
                        className={`${s.presetTab} ${tab === "recruit" ? s.on : ""} interactive`}
                        onClick={() => setTab("recruit")}
                    >
                        {t("companions.tabRecruit")}
                    </button>
                    <button
                        className={`${s.presetTab} ${tab === "stars" ? s.on : ""} interactive`}
                        onClick={() => setTab("stars")}
                    >
                        {t("companions.tabStars")}
                    </button>
                </div>
                {/* ★ 방주 화면 헤더와 **같은 자리·같은 모양**의 지갑이다 */}
                <span className={s.chip} style={{ marginLeft: "auto" }}>
                    <GameIcon name="currency.gold" size={14} decorative /> {t("common.gold")}{" "}
                    <b>{n(gold)}</b>
                </span>
            </header>
            {tab === "units" ? <UnitGrowth /> : tab === "recruit" ? <Recruit /> : <StarTree />}
        </div>
    );
}

/* ═══════════════════════ 동료 성장 ═══════════════════════ */

function UnitGrowth() {
    const t = useT();
    const pick = usePick();
    /**
     * ★ 서사는 `logic/unitLore.js` 가 **언어를 인자로** 받는다 — 그 모듈은 순수
     *   함수라 스토어를 볼 수 없다 (절대 규칙 1). 언어를 넘기지 않으면 모듈
     *   스코프의 현재 언어로 떨어지고, 그러면 React 가 그 변화를 못 본다.
     */
    const lang = useLang();
    const { owned, gold, trainingYard } = useGameStore(
        useShallow((st) => ({
            owned: st.roster.owned,
            gold: st.meta.currencies.gold,
            trainingYard: st.meta.ark.trainingYard ?? 0,
        }))
    );
    const store = useGameStore.getState;
    const [sel, setSel] = useState(null);
    /**
     * 확인 대기 중인 레벨업 단계 (2026-08-05, 사용자 요청).
     * ★ `+1` 과 `+10` 이 나란히 있어서 큰 금액이 한 번의 오탭으로 나갔다.
     *   골드는 이 게임의 **유일한 재화**라, 잘못 쓴 골드는 다른 성장을 그만큼 미룬다.
     */
    const [pendingLv, setPendingLv] = useState(null);

    /**
     * 보유 목록 — **정의가 있는 동료만.**
     *
     * ★★ 예전에는 `Object.keys(owned)` 를 그대로 썼다. 그런데 바로 아래 카드 그리드는
     *   `const d = UNIT[id]; if (!d) return null;` 로 정의 없는 id 를 걸러 낸다.
     *   그래서 정의가 빠진 동료가 하나라도 있으면 **헤더의 '보유 N종' 과 실제 카드 수가
     *   어긋난다** — P8-04 가 편성 화면에서 잡은 FLYER 사고와 똑같은 모양이고,
     *   빈 상태 판정(`!ids.length`)도 같이 틀린다.
     *
     * ★ 세이브 쪽은 **일부러** 모르는 id 를 지우지 않는다 (P8-05: 데이터가 잠깐 빠진
     *   빌드로 한 번 켠 것만으로 뽑은 동료를 영구히 잃게 만들 수 없다).
     *   그러므로 이 불일치는 화면에서 닫는 것이 맞다.
     */
    const ids = useMemo(() => Object.keys(owned).filter((id) => UNIT[id]), [owned]);

    // ★ 선택도 같은 목록에서 고른다. `owned[sel]` 만 보면 정의 없는 id 가 선택된 채로
    //   남아 상세 패널이 통째로 빈다 (`def` 가 null).
    const selId = sel && UNIT[sel] && owned[sel] ? sel : (ids[0] ?? null);
    const u = selId ? owned[selId] : null;
    const def = selId ? UNIT[selId] : null;

    if (!ids.length) {
        return (
            <div className={s.body}>
                <div className={s.detail}>
                    <p className={s.warn}>{t("companions.noneOwned")}</p>
                    <p className={`${s.warn} ${s.info}`}>{t("companions.noneOwnedHint")}</p>
                    {/*
                      * ★★ 개발 전용. **프로덕션 번들에 절대 들어가면 안 된다.**
                      *
                      *   가드 없이 두었다가 실제로 `dist/assets/index-*.js` 안에서
                      *   그대로 발견됐다. 신규 설치 → 하단 '동료' 탭 → 1탭이면
                      *   레전더리 포함 전 동료를 획득한다. 확정 지급이라는 진행 보상의
                      *   존재 이유가 통째로 사라지고, 무과금 파워 기준으로 짠
                      *   난이도 설계(게이트 B4)도 같이 무너진다.
                      *
                      * ★ `import.meta.env.DEV` 는 빌드 시 리터럴 `false` 로 치환되므로
                      *   이 블록은 프로덕션에서 **트리셰이킹으로 사라진다.**
                      *   런타임 조건문(예: 스토어 플래그)으로 감추면 코드는 그대로
                      *   남아 누구든 찾아낼 수 있다 — 지우는 것과 숨기는 것은 다르다.
                      */}
                    {import.meta.env.DEV && (
                        <button
                            className={`${s.btn} interactive`}
                            onClick={() => {
                                for (const x of UNITS) store().grantUnit(x.id);
                            }}
                        >
                            {t("companions.grantAllDev")}
                        </button>
                    )}
                </div>
            </div>
        );
    }

    const cap = unitLevelCap(trainingYard);
    const lvCheck = selId ? store().canLevelUp(selId) : null;

    return (
        <div className={s.split}>
            {/* ── 왼쪽: 보유 목록 (자기 안에서만 스크롤한다) ── */}
            <section className={s.splitPane}>
                <h2 className={s.h2}>
                    {t("common.owned")}{" "}
                    <span className={s.dim}>{t("common.countKinds", { n: ids.length })}</span>
                </h2>
                <div className={`${s.roster} scrollable`}>
                    <div className={s.cards}>
                        {ids.map((id) => {
                            const d = UNIT[id];
                            if (!d) return null;
                            return (
                                <button
                                    key={id}
                                    className={`${s.card} ${id === selId ? s.picked : ""} interactive`}
                                    aria-pressed={id === selId}
                                    onClick={() => {
                                        setSel(id);
                                    }}
                                >
                                    <span className={s.cardArt}>
                                        <Sprite atlas={d.art.atlas} frame={d.art.frame} scale={2} />
                                    </span>
                                    <RarityName rarity={d.rarity}>{pick(d, "name")}</RarityName>
                                    <span className={s.cardMeta}>Lv.{owned[id].level}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ── 오른쪽: 고른 하나의 상세 ──
                ★ 머리와 발(레벨업)은 고정이고 가운데 본문만 스크롤한다 —
                  이 탭에서 할 수 있는 유일한 행동이 스크롤 밖으로 밀리면 안 된다. */}
            <section className={s.splitPane}>
                {def && u && (
                    <div className={`${s.detail} ${s.detailPane}`}>
                        <div className={`${s.facilityTop} ${s.detailHead}`}>
                            <Sprite atlas={def.art.atlas} frame={def.art.frame} scale={3} />
                            <div>
                                <RarityName rarity={def.rarity}>{pick(def, "name")}</RarityName>
                                <div className={s.detailMeta}>
                                    {/* ★ 등급 이름·역할·데미지 타입은 카탈로그가 유일한
                                        출처다 (terms.* · companions.rarity*). 화면이 사전을
                                        복제하면 같은 개념이 화면마다 다른 이름으로 불린다. */}
                                    <span>
                                        {rarityLabel(t, def.rarity)} · {t(`terms.role.${def.role}`)}{" "}
                                        · {t(`terms.dmg.${def.dmgType}`)} ·{" "}
                                        {t("companions.cost", { n: def.cost })}
                                        {/* ★ 떼로 나오는 동료 — 마나도 그 수만큼 나간다 (2026-08-05) */}
                                        {def.squad > 1 ? ` ×${def.squad}` : ""}
                                    </span>
                                    {/* ★ 역할만으로는 공중에 닿는지 알 수 없다 (2026-08-05) */}
                                    <AirMark def={def} />
                                </div>
                            </div>
                        </div>

                        <div className={`${s.detailScroll} scrollable`}>
                            {/*
                              ★ 서사는 `data/unitLore.json` 이 정본이다 (2026-08-05, 사용자 요청).
                                `units.json` 에 섞지 않은 이유는 그 파일이 **전투 수치의 정본**이기
                                때문이다 — 성격이 다른 것을 한 파일에 두면 밸런스를 만질 때마다
                                문장을 지나치게 되고, 문장을 고칠 때마다 수치 파일이 더러워진다.
                              ★ `.prose` 를 준다. 플렉스 컨테이너에 문장을 넣으면 토막난다
                                (textLayout.test.js 가 검사한다).
                            */}
                            {loreOf(selId, lang) && (
                                <p className={`${s.warn} ${s.info} ${s.prose} ${s.lore}`}>
                                    {loreOf(selId, lang)}
                                </p>
                            )}

                            {/* 태그 — 이름은 `terms.tag.*` 가 유일한 출처다 (a11y A5) */}
                            {def.tags?.length > 0 && (
                                <div className={s.dist}>
                                    {/* ★ 인자 이름을 `t` 로 두지 않는다 — 번역 함수 `t` 를 가린다 */}
                                    {def.tags.map((tag) => (
                                        <span key={tag} className={s.chip}>
                                            {t(`terms.tag.${tag}`)}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/*
                              ★ 수치는 전부 `units.json` 에서 온다. 화면이 값을 지어내지
                                않는다 (절대규칙 4) — ms → 초 환산만 여기서 한다.
                              ★ 방벽 용량은 **있을 때만** 적는다. 0 을 "블록 0" 이라고
                                쓰면 방벽이 아닌 동료에게 없는 개념을 가르치게 된다.
                            */}
                            <div className={s.statGrid}>
                                <span>
                                    {t("common.level")} <b>{u.level} / {cap}</b>
                                </span>
                                <span>
                                    HP <b>{n(def.base.hp)}</b>
                                </span>
                                <span>
                                    ATK <b>{n(def.base.atk)}</b>
                                </span>
                                <span>
                                    DEF <b>{def.base.def}</b>
                                </span>
                                <span>
                                    RES <b>{def.base.res}</b>
                                </span>
                                <span>
                                    {t("companions.statRange")} <b>{def.base.range}</b>
                                </span>
                                <span>
                                    {t("companions.statSpeed")} <b>{def.base.speed}</b>
                                </span>
                                <span>
                                    {t("companions.statAtkCycle")}{" "}
                                    <b>
                                        {t("common.seconds", {
                                            n: (def.base.atkInterval / 1000).toFixed(2),
                                        })}
                                    </b>
                                </span>
                                {def.base.blockCount > 0 && (
                                    <span>
                                        {t("companions.statBlock")}{" "}
                                        <b>
                                            {t("companions.blockCount", { n: def.base.blockCount })}
                                        </b>
                                    </span>
                                )}
                            </div>

                            {/* ★★ 문장 안의 `<b>` 를 걷어냈다 (2026-08-07, i18n) — 강조할
                                낱말의 자리는 언어마다 다르다. 자리를 잡아 두려면 문장을
                                조각으로 잘라 코드에서 이어야 하고, 그 결합이 정확히
                                금지된 것이다. `.prose` 는 그대로 둔다. */}
                            <p className={`${s.warn} ${s.info} ${s.prose}`}>
                                {t("companions.armoryNote")}
                            </p>
                        </div>

                        {/* ── 레벨 ── */}
                        <div className={s.detailFoot}>
                            <div className={s.gearRow}>
                                <span className={s.grow}>
                                    {t("companions.levelUpCost", { n: n(unitLevelCost(u.level)) })}
                                </span>
                                {/* ★ 누르면 바로 나가지 않는다 — 확인 모달이 치를 값과
                                    도달할 레벨을 숫자로 말한다 (2026-08-05 사용자 요청) */}
                                <button
                                    className={`${s.miniBtn} interactive`}
                                    disabled={!lvCheck?.ok}
                                    onClick={() => setPendingLv(1)}
                                >
                                    +1
                                </button>
                                <button
                                    className={`${s.miniBtn} interactive`}
                                    disabled={!lvCheck?.ok}
                                    onClick={() => setPendingLv(10)}
                                >
                                    +10
                                </button>
                            </div>
                            {lvCheck && !lvCheck.ok && (
                                <p className={`${s.warn} ${s.info}`}>
                                    {lvCheck.reason === "cap"
                                        ? t("companions.capReason", { n: cap })
                                        : t("companions.goldShort", { n: n(gold) })}
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </section>

            {pendingLv != null &&
                def &&
                u &&
                (() => {
                    const plan = levelUpPlan(u.level, cap, gold, pendingLv);
                    return (
                        <ConfirmModal
                            title={t("companions.levelUpTitle")}
                            subject={t("companions.levelSubject", {
                                name: pick(def, "name"),
                                from: plan.from,
                                to: plan.to,
                            })}
                            cost={plan.cost}
                            after={plan.after}
                            confirmLabel={t("companions.confirmRaise")}
                            confirmSfx="meta.level_up"
                            onCancel={() => setPendingLv(null)}
                            onConfirm={() => {
                                setPendingLv(null);
                                store().levelUp(selId, pendingLv);
                            }}
                        >
                            {/* ★ 누른 횟수와 실제 오르는 횟수가 다를 수 있다 —
                                상한이나 잔액에 걸리면 거기서 멈춘다. 그 사실을 숨기지 않는다.
                                ★★ 사유 조각을 문장 **안**에 끼워 넣지 않는다 (2026-08-07):
                                한국어는 조사 '에' 가 조각을 문장에 묶지만 영어에는 그 조사가
                                없어 "— the level cap" 이라는 토막이 남는다. 조각을 완결된
                                절로 만들고 틀은 대시로만 잇는다. */}
                            {plan.steps < pendingLv
                                ? t("companions.levelPartial", {
                                      n: pendingLv,
                                      steps: plan.steps,
                                      cond:
                                          plan.to >= cap
                                              ? t("companions.levelPartialCap")
                                              : t("companions.levelPartialGold"),
                                  })
                                : t("companions.levelFull", { n: plan.steps })}
                        </ConfirmModal>
                    );
                })()}
        </div>
    );
}

/* ═══════════════════════ 영입 ═══════════════════════ */

/**
 * 동료 영입 (2026-08-04 · 2026-08-05 좌우 2단 재배치).
 *
 * ★★ 가챠를 걷어내자 **동료 30종 중 10종만 획득 경로가 남았다.** 여기가 나머지다.
 *   확률이 없다 — 값을 치르면 그 동료가 온다.
 *
 * ★ 판정은 화면이 하지 않는다. `logic/recruit.js:canRecruit` 하나가 답하고
 *   스토어도 같은 함수를 부른다 — 화면에만 자물쇠를 그리면 다음 호출부가 통과한다.
 *
 * ★ 잠긴 칸도 **그린다.** 무엇을 향해 가는지가 보여야 한다 (스테이지 목록과 같은 원칙).
 *
 * ★★ **좌 목록 / 우 상세** (2026-08-05, 사용자 요청). 클래스는 **성장 탭·편성 탭과
 *   같은 것**(`.split` / `.splitPane` / `.detailPane` / `.detailScroll` / `.detailFoot`)이다 —
 *   같은 게임에서 세 화면이 서로 다른 규칙으로 움직이면 그 자체가 배워야 할 비용이다
 *   (`docs/02-design/18-ux-ui.md` §4.1 · §4.2).
 *
 * ★★★ **카드 탭은 이제 고르기일 뿐 사기가 아니다.** 예전에는 40칸 격자에서 카드를
 *   누르는 것이 곧 **되돌릴 수 없는 지출의 시작**이었고, 그래서 홀드 툴팁·`disabled`·
 *   콜백 가드가 전부 그 한 번의 탭을 지키느라 붙어 있었다. 지출은 오른쪽 발의
 *   [영입한다] 하나로 모였고, 카드는 **잠긴 것·보유한 것도 눌러서 볼 수 있다** —
 *   무엇을 향해 가는지 읽으려면 눌러야 하기 때문이다.
 *
 * ⛔ **홀드 툴팁(`useHoldTip`)은 여기서 걷어냈다.** 그것이 있던 이유는 "카드에
 *   이름·등급·가격밖에 없어 무엇을 사는지 알 수 없다"였는데, 그 정보가 지금은
 *   오른쪽에 **누르고 있지 않아도** 상시로 있다. 같은 사실을 두 곳에서 말하면
 *   반드시 갈라진다 (실제로 갈라졌었다 — 툴팁만 가격을 말하고 카드는 "보유 중"이라
 *   말하던 시절이 있다). 홀드가 사라지면서 탭 판정도 포인터 이벤트에서 `onClick` 으로
 *   돌아왔고, `disabled` 우회 사고(2026-08-05)의 **원인 자체**가 없어졌다.
 *   훅은 전투 HUD·지휘관 패널이 계속 쓴다.
 */
function Recruit() {
    const t = useT();
    const pick = usePick();
    const lang = useLang();
    const { owned, gold, highestStage } = useGameStore(
        useShallow((st) => ({
            owned: st.roster.owned,
            gold: st.meta.currencies.gold,
            highestStage: st.meta.highestStage,
        }))
    );
    const store = useGameStore.getState;
    const [toast, setToast] = useState(null);
    /** 확인 대기 중인 영입 대상 (2026-08-05, 사용자 요청) */
    const [pendingBuy, setPendingBuy] = useState(null);
    /** 왼쪽에서 고른 동료 — 오른쪽 상세가 이것 하나를 본다 */
    const [sel, setSel] = useState(null);
    const flash = (m) => {
        setToast(m);
        setTimeout(() => setToast(null), 2400);
    };

    /**
     * ★ 등급 순 → 파일 순. 등급이 곧 가격대라 같은 값의 카드가 붙어 보인다.
     *   `RARITY_ORDER` 를 쓰는 이유는 등급 표기 순서의 단일 출처이기 때문이다.
     *   ★ 이름에 `_KO` 가 붙어 있었는데 **순서에는 언어가 없다** — 이름이 거짓말이라
     *   이중 언어화(2026-08-07)에서 접미사를 뗐다.
     */
    const rows = useMemo(() => {
        const rank = Object.fromEntries(RARITY_ORDER.map((r, i) => [r, i]));
        return RECRUITABLE.map((id) => ({ id, def: UNIT[id] }))
            .filter((r) => r.def)
            .sort((a, b) => (rank[b.def.rarity] ?? 9) - (rank[a.def.rarity] ?? 9));
    }, []);

    const mine = rows.filter((r) => owned[r.id]).length;

    /**
     * 고른 하나. **선택이 없으면 첫 번째다** — 빈 상세 패널은 고장으로 읽힌다.
     * ★ 목록에 없는 id 가 고른 채로 남으면 오른쪽이 통째로 빈다. 목록에서 고른다.
     */
    const selId = sel && rows.some((r) => r.id === sel) ? sel : (rows[0]?.id ?? null);
    const selDef = selId ? UNIT[selId] : null;
    /** ★ 스토어와 **같은 순수 함수**를 부른다 (판정 사본 금지) */
    const selCheck = selId ? canRecruit({ unitId: selId, owned, gold, highestStage }) : null;
    const selHave = selCheck?.reason === "owned";
    const selCost = selId ? recruitCost(selId) : null;
    const selAt = selId ? recruitUnlockStage(selId) : null;

    /**
     * ★★★ **이 화면에서 골드가 나가는 문은 이것 하나다.**
     *   `disabled` 가 대신 막아 줄 것이라고 믿지 않는다 (2026-08-05 에 두 번 당했다) —
     *   규칙 모듈이 이미 답한 것을 여기서 한 번 더 지킨다. 화면이 스스로 판정하지
     *   않지만, 화면이 판정을 **무시하지도** 않는다.
     */
    const buy = () => {
        if (!selCheck || !selCheck.ok) return;
        setPendingBuy(selId);
    };

    /**
     * 왜 못 사는가를 **문장으로** 말한다. 흐린 버튼만 두면 플레이어는 화면이
     * 고장 났다고 읽는다 — 성장 탭의 레벨 상한 안내와 같은 규약이다.
     * ★ 수치는 전부 규칙 모듈·스토어에서 온다 (절대규칙 4).
     */
    const denial = !selCheck || selCheck.ok
        ? null
        : selCheck.reason === "owned"
          ? t("companions.denyOwned")
          : selCheck.reason === "locked"
            ? t("companions.denyLocked", { stage: selAt, now: highestStage })
            : selCheck.reason === "gold"
              ? t("companions.denyGold", {
                    n: n(Math.max(0, (selCost ?? 0) - gold)),
                    have: n(gold),
                })
              : t("companions.denyOther");

    return (
        <div className={s.split}>
            {/* ── 왼쪽: 영입할 수 있는 동료 (자기 안에서만 스크롤한다) ── */}
            <section className={s.splitPane}>
                <h2 className={s.h2}>
                    {t("companions.tabRecruit")}{" "}
                    <span className={s.dim}>
                        {t("companions.recruitCount", { mine, all: rows.length })}
                    </span>
                </h2>
                <p className={`${s.warn} ${s.info}`}>{t("companions.noChance")}</p>
                {/* ★ 한 줄에 맞춘다. 좌측 칸이 반으로 좁아지면서(2026-08-05) 이 문장이
                    915px 에서 "다." 한 자만 셋째 줄로 넘어갔고, 그 한 줄이 카드 한 줄을
                    밀어냈다. 두 언어 모두 두 줄 안에 든다.
                    ★★ `<b>` 를 걷어냈다 (2026-08-07) — 강조어의 자리가 언어마다 다르다. */}
                <p className={`${s.warn} ${s.info} ${s.prose}`}>
                    {t("companions.guaranteedNote")}
                </p>

                <div className={`${s.roster} scrollable`}>
                    <div className={s.cards}>
                        {rows.map(({ id, def }) => {
                            // ★ 스토어와 **같은 순수 함수**를 부른다 (판정 사본 금지)
                            const check = canRecruit({ unitId: id, owned, gold, highestStage });
                            /**
                             * ★ 보유 여부도 **그 함수가 답한다** (`owned[id]` 를 화면이 다시
                             *   보지 않는다). 판정을 화면이 복제하면 갈라진다 — 오늘만
                             *   세 번 겪은 실패 유형이다 (CLAUDE.md "같은 사실을 두 곳에").
                             */
                            const have = check.reason === "owned";
                            const cost = recruitCost(id);
                            const at = recruitUnlockStage(id);
                            /**
                             * ★★ **조건부 꼬리는 문장을 나눠서 붙인다** (2026-08-07).
                             *   예전에는 `…코스트 4${have ? " · 보유 중" : ""}` 처럼
                             *   문자열을 이어 붙였다. 그 결합은 한국어에서만 맞는다 —
                             *   영어는 구두점과 어순이 달라 조각이 그대로 남는다.
                             *   앞 문장을 **완성한 뒤** 통째로 {base} 에 넣는다.
                             */
                            const cardTitle = t("companions.cardTitle", {
                                name: pick(def, "name"),
                                role: t(`terms.role.${def.role}`),
                                dmg: t(`terms.dmg.${def.dmgType}`),
                                cost: def.cost,
                            });
                            return (
                                <button
                                    key={id}
                                    className={`${s.card} ${id === selId ? s.picked : ""} interactive`}
                                    aria-pressed={id === selId}
                                    /**
                                     * ★★ **카드는 고르기다.** 잠긴 것도 보유한 것도 눌러서 볼 수
                                     *   있어야 한다 — 무엇을 향해 가는지가 오른쪽에 있기 때문이다.
                                     *   `disabled` 를 걸면 그 정보에 닿을 방법이 사라진다.
                                     * ★ 지출은 여기가 아니라 오른쪽 발의 [영입한다] 하나다.
                                     */
                                    onClick={() => setSel(id)}
                                    title={
                                        have
                                            ? t("companions.cardTitleOwned", { base: cardTitle })
                                            : cardTitle
                                    }
                                >
                                    <span className={s.cardArt}>
                                        <Sprite atlas={def.art.atlas} frame={def.art.frame} scale={2} />
                                    </span>
                                    <RarityName rarity={def.rarity}>{pick(def, "name")}</RarityName>
                                    <span className={s.cardMeta}>
                                        {have ? (
                                            /* ★ 가격 자리에 **보유 배지**가 선다 — 회색
                                               `보유 중` 한 줄은 옆 칸의 `골드 4,000` 과
                                               구별되지 않았다 (2026-08-05 사용자 요청) */
                                            <OwnedMark />
                                        ) : check.reason === "locked" ? (
                                            <>
                                                <Lock size={10} aria-hidden />{" "}
                                                {t("companions.stageAt", { id: at })}
                                            </>
                                        ) : (
                                            <span className={cost > gold ? s.lack : ""}>
                                                {t("companions.goldAmount", { n: n(cost) })}
                                            </span>
                                        )}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ── 오른쪽: 고른 하나의 상세 + [영입한다] ──
                ★ 머리(이름·등급)와 발(값·버튼)은 고정이고 가운데만 스크롤한다 —
                  이 탭에서 할 수 있는 유일한 행동이 스크롤 밖으로 밀리면 안 된다. */}
            <section className={s.splitPane}>
                {selDef && (
                    <div className={`${s.detail} ${s.detailPane}`}>
                        <div className={`${s.facilityTop} ${s.detailHead}`}>
                            <Sprite atlas={selDef.art.atlas} frame={selDef.art.frame} scale={3} />
                            <div>
                                <RarityName rarity={selDef.rarity}>
                                    {pick(selDef, "name")}
                                </RarityName>
                                <div className={s.detailMeta}>
                                    {/* ★ 등급 이름·역할·데미지 타입 전부 카탈로그가 유일한
                                        출처다 (terms.* · companions.rarity*). 성장 탭과
                                        **같은 줄**이다. */}
                                    <span>
                                        {rarityLabel(t, selDef.rarity)} ·{" "}
                                        {t(`terms.role.${selDef.role}`)} ·{" "}
                                        {t(`terms.dmg.${selDef.dmgType}`)} ·{" "}
                                        {t("companions.cost", { n: selDef.cost })}
                                        {selDef.squad > 1 ? ` ×${selDef.squad}` : ""}
                                    </span>
                                    {/* ★ 역할만으로는 공중에 닿는지 알 수 없다 (2026-08-05) */}
                                    <AirMark def={selDef} />
                                    {selHave && <OwnedMark />}
                                </div>
                            </div>
                        </div>

                        <div className={`${s.detailScroll} scrollable`}>
                            {/* ★ 서사는 `data/unitLore.json` 이 정본이다. `.prose` 를 함께
                                준다 — 플렉스 컨테이너에 문장을 넣으면 토막난다. */}
                            {loreOf(selId, lang) && (
                                <p className={`${s.warn} ${s.info} ${s.prose} ${s.lore}`}>
                                    {loreOf(selId, lang)}
                                </p>
                            )}

                            {/* 태그 — 이름은 `terms.tag.*` 가 유일한 출처다 (a11y A5) */}
                            {selDef.tags?.length > 0 && (
                                <div className={s.dist}>
                                    {/* ★ 인자 이름을 `t` 로 두지 않는다 — 번역 함수를 가린다 */}
                                    {selDef.tags.map((tag) => (
                                        <span key={tag} className={s.chip}>
                                            {t(`terms.tag.${tag}`)}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* ★ 수치는 전부 `units.json` 에서 온다 (절대규칙 4) —
                                ms → 초 환산만 여기서 한다. 성장 탭과 같은 표다. */}
                            <div className={s.statGrid}>
                                <span>
                                    HP <b>{n(selDef.base.hp)}</b>
                                </span>
                                <span>
                                    ATK <b>{n(selDef.base.atk)}</b>
                                </span>
                                <span>
                                    DEF <b>{selDef.base.def}</b>
                                </span>
                                <span>
                                    RES <b>{selDef.base.res}</b>
                                </span>
                                <span>
                                    {t("companions.statRange")} <b>{selDef.base.range}</b>
                                </span>
                                <span>
                                    {t("companions.statSpeed")} <b>{selDef.base.speed}</b>
                                </span>
                                <span>
                                    {t("companions.statAtkCycle")}{" "}
                                    <b>
                                        {t("common.seconds", {
                                            n: (selDef.base.atkInterval / 1000).toFixed(2),
                                        })}
                                    </b>
                                </span>
                                {selDef.base.blockCount > 0 && (
                                    <span>
                                        {t("companions.statBlock")}{" "}
                                        <b>
                                            {t("companions.blockCount", {
                                                n: selDef.base.blockCount,
                                            })}
                                        </b>
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* ── 값과 문 ── */}
                        <div className={s.detailFoot}>
                            <div className={s.gearRow}>
                                <span className={s.grow}>
                                    {selHave ? (
                                        <OwnedMark />
                                    ) : (
                                        <>
                                            <GameIcon name="currency.gold" size={14} decorative />{" "}
                                            {t("companions.recruitPrice")}{" "}
                                            <b className={selCost > gold ? s.lack : ""}>
                                                {n(selCost)}
                                            </b>
                                        </>
                                    )}
                                </span>
                                <button
                                    className={`${s.btn} ${s.btnPrimary} interactive`}
                                    disabled={!selCheck?.ok}
                                    onClick={buy}
                                >
                                    {t("companions.recruitDo")}
                                </button>
                            </div>
                            {denial && <p className={`${s.warn} ${s.info} ${s.prose}`}>{denial}</p>}
                        </div>
                    </div>
                )}
            </section>

            {/* ★★ 영입은 **되돌릴 수 없는 골드 지출**이다 (2026-08-05, 사용자 요청).
                레벨업·시설 강화와 같은 규약으로 한 번 멈춘다. 2단이 되면서 지출은
                버튼 하나로 모였지만 **모달은 남는다** — 골드는 이 게임의 유일한
                재화라, 잘못 쓴 골드는 다른 성장을 그만큼 미룬다. */}
            {pendingBuy &&
                (() => {
                    const def = UNIT[pendingBuy];
                    const cost = recruitCost(pendingBuy);
                    if (!def) return null;
                    return (
                        <ConfirmModal
                            title={t("companions.recruitTitle")}
                            subject={t("companions.recruitSubject", {
                                name: pick(def, "name"),
                                role: t(`terms.role.${def.role}`),
                                dmg: t(`terms.dmg.${def.dmgType}`),
                            })}
                            cost={cost}
                            after={gold - cost}
                            confirmLabel={t("companions.recruitDo")}
                            confirmSfx="ui.purchase"
                            onCancel={() => setPendingBuy(null)}
                            onConfirm={() => {
                                setPendingBuy(null);
                                const r = store().recruitUnit(pendingBuy);
                                if (r.ok) flash(t("companions.joined", { name: pick(def, "name") }));
                            }}
                        >
                            {loreOf(pendingBuy, lang)}
                        </ConfirmModal>
                    );
                })()}

            {toast && <div className={s.toast}>{toast}</div>}
        </div>
    );
}

/* ═══════════════════════ 별 트리 ═══════════════════════ */

function StarTree() {
    const t = useT();
    const pick = usePick();
    const starTree = useGameStore((st) => st.meta.starTree);
    const store = useGameStore.getState;
    const stars = store().getStars();
    /**
     * 확인 대기 중인 별 트리 노드 (2026-08-05, 사용자 요청).
     * ★ 별은 **되돌릴 수 없다** — 환급 경로가 없고, 전관왕이 300 별인데 트리 만렙은
     *   324 라 애초에 전부 찍을 수 없다. 즉 한 번의 오탭이 다른 가지를 영영 미룬다.
     */
    const [pendingNode, setPendingNode] = useState(null);

    const branches = useMemo(() => {
        const by = {};
        for (const node of STAR_NODES) (by[node.branch] ??= []).push(node);
        return by;
    }, []);

    return (
        <div className={s.body}>
            <section className={s.col} style={{ flex: 2 }}>
                <h2 className={s.h2}>
                    {t("companions.tabStars")}
                    <span className={s.starCount}>
                        <GameIcon name="currency.star" size={14} /> {stars.available}{" "}
                        <span className={s.dim}>
                            {t("companions.starsEarned", { n: stars.earned })}
                        </span>
                    </span>
                </h2>
                <p className={`${s.warn} ${s.info} ${s.prose}`}>{t("companions.starNote")}</p>
                <div className={s.tree}>
                    {Object.entries(branches).map(([branch, nodes]) => (
                        <div key={branch} className={s.branch}>
                            <h3 className={s.roleTitle}>{branchLabel(t, branch)}</h3>
                            {nodes.map((node) => {
                                const rank = starTree[node.id] ?? 0;
                                const check = store().canBuyStar(node.id);
                                const maxed = rank >= node.maxRank;
                                return (
                                    <button
                                        key={node.id}
                                        data-sfx="ui.purchase"
                                        className={`${s.node} ${maxed ? s.maxed : ""} interactive`}
                                        disabled={!check.ok}
                                        onClick={() => setPendingNode(node)}
                                    >
                                        <span className={s.grow}>
                                            <b>{pick(node, "name")}</b>
                                            <span className={s.dim}> {describeNode(t, node)}</span>
                                        </span>
                                        <span className={s.rank}>
                                            {rank}/{node.maxRank}
                                        </span>
                                        <span className={s.dim}>
                                            {maxed ? (
                                                t("companions.nodeDone")
                                            ) : check.reason === "locked" ? (
                                                t("companions.nodeLocked")
                                            ) : (
                                                <>
                                                    <GameIcon name="currency.star" size={12} />{" "}
                                                    {node.cost}
                                                </>
                                            )}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </section>

            {/* ★★ 별은 환급이 없다 (2026-08-05, 사용자 요청). 노드가 세로로 촘촘히
                붙어 있어 옆 줄을 누르는 오탭이 쉬운 자리이고, 잘못 쓴 별은
                되돌릴 방법이 없다 — 골드와 달리 다시 벌기도 훨씬 느리다. */}
            {pendingNode &&
                (() => {
                    const rank = starTree[pendingNode.id] ?? 0;
                    return (
                        <ConfirmModal
                            title={t("companions.starTitle")}
                            subject={t("companions.starSubject", {
                                name: pick(pendingNode, "name"),
                                from: rank,
                                to: rank + 1,
                                max: pendingNode.maxRank,
                            })}
                            confirmLabel={t("companions.confirmSpend")}
                            confirmSfx="ui.purchase"
                            onCancel={() => setPendingNode(null)}
                            onConfirm={() => {
                                const id = pendingNode.id;
                                setPendingNode(null);
                                store().buyStarNode(id);
                            }}
                        >
                            {describeNode(t, pendingNode)}
                            <p className={s.confirmStars}>
                                {t("companions.starCost", {
                                    cost: pendingNode.cost,
                                    left: stars.available - pendingNode.cost,
                                })}
                            </p>
                            <p className={s.confirmStars}>{t("companions.starNoRefund")}</p>
                        </ConfirmModal>
                    );
                })()}
        </div>
    );
}

/**
 * 별 트리 효과 — **숫자 서식만** 여기서 만든다.
 *
 * ★★★ **문장은 코드에 없다** (2026-08-07). 예전에는 이 표가 문장을 통째로 지었다
 *   (`아군 공격력 +${…}%`). 그런데 이 열 줄은 영어에서 **어순이 정확히 뒤집힌다** —
 *   ko "아군 공격력 +20%" 는 en "+20% Ally ATK" 다. 라벨과 값을 코드에서 이어
 *   붙이는 한 어느 한쪽은 반드시 어색해지고, 그 어색함은 열 곳에 복제된다.
 *   그래서 **문장 전체가 카탈로그의 한 키**이고 (`companions.effect.*`), 여기
 *   남은 것은 언어와 무관한 것 — 백분율 환산과 소수 자릿수뿐이다.
 *
 * ★ 자릿수가 종류마다 다르다는 사실 자체가 데이터가 아니라 **표기 규칙**이다:
 *   체력은 0.1%p 단위로 튜닝되고(`toFixed(1)`) 공격력은 그렇지 않다.
 */
const EFFECT_VALUE = {
    allyAtkPct: (v) => (v * 100).toFixed(0),
    allyHpPct: (v) => (v * 100).toFixed(1),
    allyPierce: (v) => String(v),
    arkHpPct: (v) => (v * 100).toFixed(0),
    blockerDefFlat: (v) => String(v),
    manaRegenPct: (v) => (v * 100).toFixed(0),
    startManaFlat: (v) => String(v),
    summonCostPct: (v) => (v * 100).toFixed(0),
    sigilRerolls: (v) => String(v),
    sigilOptions: (v) => String(v),
};

/**
 * @param {(key: string, params?: object) => string} t `useT()` 가 준 것.
 *   ★ 모듈에서 바로 import 하지 않는다 — 그러면 언어를 바꿔도 이 문장만 안 바뀐다.
 */
function describeNode(t, node) {
    const kind = node.effect.kind;
    const fmt = EFFECT_VALUE[kind];
    if (!fmt) return "";
    return t("companions.perRank", {
        effect: t(`companions.effect.${kind}`, { v: fmt(node.effect.perRank) }),
    });
}
