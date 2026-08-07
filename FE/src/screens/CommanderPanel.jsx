/**
 * 지휘관 패널 — **편성 화면 안의 일곱 번째 자리** (2026-08-05)
 *
 * ★★ 편성 화면에 둔 이유: 여기가 **전투에 들고 나갈 것을 고르는 자리**다.
 *   동료 6칸을 고르는 화면에서 지휘관만 다른 탭에 있으면, 플레이어는 지휘관을
 *   편성의 일부로 배우지 않는다. 탭은 다섯 칸 고정이므로 새 탭도 만들지 않는다.
 *
 * ★ 성장은 두 갈래다:
 *     · **레벨** — 골드. 평타 공격력 · HP · 균열력 재생이 함께 오른다
 *     · **장구** — 스테이지 확정 지급. 슬롯마다 하나를 **고른다** (모으는 것이 아니라)
 *   오라 반경은 여기 없다 — 그것은 **방주 성소**의 몫이고, 그 사실을 화면이 말한다.
 *
 * ★ 수치는 하나도 여기 없다. 전부 `logic/commander.js` 가 데이터에서 읽어 준다.
 *
 * @see docs/02-design/21-commander-growth.md
 */
import { useState } from "react";
import { Lock } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useGameStore } from "@/store";
import { GameIcon } from "@/components/GameIcon";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useHoldTip } from "@/components/useHoldTip";
import {
    COMMANDER_MAX_LEVEL,
    COMMANDER_SLOTS,
    commanderLevelPlan,
    itemsOfSlot,
} from "@/game/logic/commander";
// ★ 주문 목록·해금 판정은 규칙 모듈이 답한다 — 화면이 자기 판정을 갖지 않는다
import {
    LOADOUT_SIZE as SPELL_SLOTS,
    SPELLS,
    spellUnlockStage,
    unlockedSpellIds,
} from "@/game/logic/spells";
import { useT, usePick } from "@/i18n/useT";
import s from "./Meta.module.css";
/**
 * ★ 지휘관 탭 전용 — **왼쪽 아이콘 · 오른쪽 설명** 가로 줄 (2026-08-06, 사용자 요청).
 *   공유 `Meta.module.css` 의 `.card` 를 고치지 않는 이유는 그 파일 상단에 있다.
 */
import r from "./CommanderPanel.module.css";

const n = (v) => Math.floor(v).toLocaleString();
/** 비율 보정을 사람이 읽는 문자열로. 0 이면 아무 말도 하지 않는다 */
const pct = (v) => `+${Math.round(v * 100)}%`;

export function CommanderPanel() {
    /**
     * ★★ 훅으로 받는다. `t` 를 그냥 import 하면 언어를 바꿔도 이 패널이 다시
     *   그려지지 않는다 (`i18n/useT.js` 머리말).
     * ★ `pick` 은 **데이터의** 이름·설명(장구 12종 · 주문 12종)을 고른다 —
     *   그 문장들의 정본은 `data/commander.json` · `data/spells.json` 이고
     *   카탈로그로 옮기지 않는다 (`i18n/index.js:pick` 머리말).
     */
    const t = useT();
    const pick = usePick();
    const { gold, commander, sanctum, highestStage } = useGameStore(
        useShallow((st) => ({
            gold: st.meta.currencies.gold,
            commander: st.meta.commander,
            sanctum: st.meta.ark?.sanctum ?? 0,
            highestStage: st.meta.highestStage,
        }))
    );
    const store = useGameStore.getState;
    const [pending, setPending] = useState(null);
    /** 주문 카드 홀드 툴팁 — 전투 HUD 와 **같은 훅**이다 (사본 금지) */
    const { held: heldSpell, bind: bindSpell } = useHoldTip();

    const level = commander?.level ?? 1;
    const owned = commander?.items ?? [];
    const equipped = commander?.equipped ?? {};
    const eff = store().getCommanderEffects();
    const lvCheck = store().canLevelUpCommander();

    /** 지금 들고 나가는 4칸 · 보유한 주문 · 칸이 찼을 때 밀려날 것 */
    const equippedSpells = commander?.spells ?? [];
    const unlocked = unlockedSpellIds(highestStage);
    // ★ 칸이 찼으면 **가장 먼저 넣은 것**을 뺀다 — 어떤 것이 밀려나는지 화면이 말한다
    const oldest = equippedSpells.length >= SPELL_SLOTS ? equippedSpells[0] : null;

    return (
        <div className={s.detail}>
            <div className={s.facilityTop}>
                <b>{t("common.commander")}</b>
                <span className={s.lv}>
                    Lv.{level} / {COMMANDER_MAX_LEVEL}
                </span>
            </div>

            {/* ── 지금 붙어 있는 보정 ── */}
            <div className={s.statGrid}>
                <span>
                    {t("loadout.cmdAtk")} <b>{pct(eff.commanderAtkPct)}</b>
                </span>
                <span>
                    {t("loadout.cmdHp")} <b>{pct(eff.commanderHpPct)}</b>
                </span>
                <span>
                    {t("loadout.cmdAtkSpeed")} <b>{pct(eff.commanderAtkSpeedPct)}</b>
                </span>
                <span>
                    {t("loadout.cmdRiftRegen")} <b>{pct(eff.riftRegenPct)}</b>
                </span>
                <span>
                    {t("loadout.cmdSpellPower")} <b>{pct(eff.spellPowerPct)}</b>
                </span>
                <span>
                    {t("loadout.cmdAuraRadius")} <b>+{eff.auraRadiusFlat}</b>
                </span>
            </div>

            {/* ── 레벨 ── */}
            <div className={s.gearRow}>
                <span className={s.grow}>
                    {t("loadout.cmdLevelUp", {
                        n: lvCheck.cost != null ? n(lvCheck.cost) : "—",
                    })}
                </span>
                <button
                    className={`${s.miniBtn} interactive`}
                    disabled={!lvCheck.ok}
                    onClick={() => setPending(1)}
                >
                    +1
                </button>
                <button
                    className={`${s.miniBtn} interactive`}
                    disabled={!lvCheck.ok}
                    onClick={() => setPending(5)}
                >
                    +5
                </button>
            </div>
            {!lvCheck.ok && (
                <p className={`${s.warn} ${s.info}`}>
                    {lvCheck.reason === "max"
                        ? t("loadout.cmdMaxLevel", { n: COMMANDER_MAX_LEVEL })
                        : t("loadout.cmdGoldShort", { n: n(gold) })}
                </p>
            )}

            {/* ── 장구 ── */}
            {COMMANDER_SLOTS.map((slot) => (
                <div key={slot.id} className={s.commanderSlot}>
                    <h3 className={s.h3}>
                        {pick(slot, "name")} <span className={s.dim}>{pick(slot, "desc")}</span>
                    </h3>
                    <div className={r.rows}>
                        {itemsOfSlot(slot.id).map((item) => {
                            const have = owned.includes(item.id);
                            const on = equipped[slot.id] === item.id;
                            return (
                                <button
                                    key={item.id}
                                    className={`${r.row} ${on ? r.picked : ""} interactive`}
                                    disabled={!have}
                                    // ★ 같은 것을 다시 누르면 해제된다 — 무보정 상태도 선택지다
                                    onClick={() =>
                                        store().equipCommanderItem(slot.id, on ? null : item.id)
                                    }
                                >
                                    <span className={r.art}>
                                        <GameIcon name={item.icon} size={28} decorative />
                                    </span>
                                    <span className={r.body}>
                                        <b className={r.name}>{pick(item, "name")}</b>
                                        <span className={r.desc}>{pick(item, "desc")}</span>
                                    </span>
                                    <span className={`${r.state} ${on ? r.stateOn : ""}`}>
                                        {have ? (
                                            on ? (
                                                t("loadout.gearEquipped")
                                            ) : (
                                                t("common.owned")
                                            )
                                        ) : (
                                            <>
                                                <Lock size={10} aria-hidden /> {item.stage}
                                            </>
                                        )}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}

            {/* ── 주문 4칸 (2026-08-05) ──────────────────────────────────
                ★★ 주문은 **12종인데 4칸**이다. 편성이 50 중 6칸인 것과 같은 규약이고
                  (설계 결정 1 — 배제가 곧 결정이다), 12종을 다 쓰게 하면 HUD 도크가
                  무너지는 동시에 그 결정이 사라진다.
                ★ 판정은 전부 `logic/spells.js` 가 한다 — 화면은 이유를 그리기만 한다.
                  화면에만 자물쇠를 그리면 다음 호출부가 그대로 통과한다. */}
            <h3 className={s.h3}>
                {t("loadout.spellsTitle")}{" "}
                <span className={s.dim}>
                    {t("loadout.spellsCount", {
                        a: equippedSpells.length,
                        b: SPELL_SLOTS,
                        c: unlocked.length,
                    })}
                </span>
            </h3>
            {/* ★★ **누르고 있는 동안만 설명이 보인다** (2026-08-05, 사용자 요청).
                `title` 은 터치 기기에서 뜨지 않아 폰에서는 설명이 없는 것과 같다.
                전투 HUD 의 주문 도크와 **같은 훅**을 쓴다 — 사본을 만들면 한쪽만
                홀드 뒤 탭을 막는 식으로 갈라진다. */}
            {heldSpell && (
                <div className={s.spellTip} role="note">
                    <b className={s.spellTipName}>{pick(heldSpell, "name")}</b>
                    <span className={s.spellTipCost}>
                        {t("loadout.spellTipCost", {
                            cost: heldSpell.cost,
                            sec: Math.round(heldSpell.cooldownMs / 1000),
                        })}
                    </span>
                    <span className={s.spellTipDesc}>{pick(heldSpell, "desc")}</span>
                </div>
            )}
            <div className={r.rows}>
                {SPELLS.map((sp) => {
                    const on = equippedSpells.includes(sp.id);
                    const have = unlocked.includes(sp.id);
                    return (
                        <button
                            key={sp.id}
                            className={`${r.row} ${on ? r.picked : ""} interactive`}
                            disabled={!have}
                            /** ★ `title` 속성도 번역 대상이다 */
                            title={have ? pick(sp, "desc") : undefined}
                            {...bindSpell(sp, () => {
                                /**
                                 * ★ `disabled` 를 믿지 않는다 — 브라우저가 막는 것은
                                 *   `click`·`mousedown` 뿐이고 홀드 툴팁 때문에 이
                                 *   카드는 **포인터 이벤트**로 탭을 판정한다.
                                 *   보유하지 않은 주문을 눌러 장착이 시도되는 것을
                                 *   콜백 첫 줄에서 다시 거른다 (2026-08-05 영입 카드
                                 *   사고와 같은 형태 · `recruitCard.test.js`).
                                 */
                                if (!have) return;
                                if (on) store().unequipSpell(sp.id);
                                else store().equipSpell(sp.id, oldest);
                            })}
                        >
                            <span className={r.art}>
                                <GameIcon name={sp.icon} size={28} decorative />
                            </span>
                            <span className={r.body}>
                                <b className={r.name}>{pick(sp, "name")}</b>
                                <span className={r.desc}>{pick(sp, "desc")}</span>
                            </span>
                            <span className={`${r.state} ${on ? r.stateOn : ""}`}>
                                {have ? (
                                    on ? (
                                        t("loadout.spellEquipped", { cost: sp.cost })
                                    ) : (
                                        t("loadout.spellCost", { cost: sp.cost })
                                    )
                                ) : (
                                    <>
                                        <Lock size={10} aria-hidden /> {spellUnlockStage(sp.id)}
                                    </>
                                )}
                            </span>
                        </button>
                    );
                })}
            </div>
            {/*
              ★★ **문장 안의 `<b>` 를 걷어냈다** (2026-08-07, i18n).
                강조할 낱말의 자리는 언어마다 다르다 — ko "장구는 **확정 지급**입니다" 의
                강조어는 en "Gear is granted **outright**" 에서 문장 끝으로 간다.
                자리를 잡아 두려면 문장을 조각으로 잘라 코드에서 이어야 하고, 그것은
                이 저장소가 금지한 결합이다 (어순이 다른 언어에서 반드시 깨진다).
                **문장 전체가 한 키**이고, `.prose` 는 그대로 둔다 — 지금은 자식이
                텍스트 하나뿐이라 토막날 일이 없지만, 이 클래스가 사라지면 다음에
                요소를 하나 넣는 순간 `textLayout.test.js` 가 잡을 자리다.
            */}
            <p className={`${s.warn} ${s.info} ${s.prose}`}>{t("loadout.spellSwapNote")}</p>

            <p className={`${s.warn} ${s.info} ${s.prose}`}>{t("loadout.gearNote")}</p>
            <p className={`${s.warn} ${s.info} ${s.prose}`}>
                {t("loadout.auraNote", { n: sanctum })}
            </p>

            {pending != null &&
                (() => {
                    const plan = commanderLevelPlan(level, gold, pending);
                    return (
                        <ConfirmModal
                            title={t("loadout.cmdLevelTitle")}
                            subject={t("loadout.cmdLevelSubject", {
                                from: plan.from,
                                to: plan.to,
                            })}
                            cost={plan.cost}
                            after={plan.after}
                            confirmLabel={t("loadout.cmdConfirmRaise")}
                            confirmSfx="meta.level_up"
                            onCancel={() => setPending(null)}
                            onConfirm={() => {
                                setPending(null);
                                store().levelUpCommander(pending);
                            }}
                        >
                            {/*
                              ★★ 삼항 조각을 문장 **안**에 끼워 넣지 않는다 (2026-08-07).
                                한국어는 조사 '에' 가 조각을 문장에 묶지만 영어에는 그
                                조사가 없어 "— max level" 이라는 토막이 남는다.
                                조각을 **완결된 절**로 만들고 틀은 대시로만 잇는다.
                            */}
                            {plan.steps < pending
                                ? t("loadout.cmdLevelPartial", {
                                      n: pending,
                                      steps: plan.steps,
                                      cond:
                                          plan.to >= COMMANDER_MAX_LEVEL
                                              ? t("loadout.cmdLevelPartialMax")
                                              : t("loadout.cmdLevelPartialGold"),
                                  })
                                : t("loadout.cmdLevelFull", { n: plan.steps })}
                        </ConfirmModal>
                    );
                })()}
        </div>
    );
}
