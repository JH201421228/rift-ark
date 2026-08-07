/**
 * 전투 HUD
 *
 * ★ 값 단위로 컴포넌트를 쪼갠다.
 *   HUD 를 하나의 큰 컴포넌트로 만들면 마나가 바뀔 때마다 전체가 재렌더된다.
 *   10Hz 동기화 × 잘게 쪼갠 컴포넌트 = React 렌더 비용이 프레임 예산에서 사라진다.
 *
 * @see docs/03-tech/21-state-management.md §5.2
 */
import { memo, useLayoutEffect, useMemo, useState } from "react";
import { ChevronUp, Pause, Shield } from "lucide-react";
import { Sprite } from "@/components/Sprite";
import { SheetIcon } from "@/components/GameIcon";
import { SIGILS } from "@/game/logic/sigils";
import { GameIcon } from "@/components/GameIcon";
import { AirMark } from "@/components/AirMark";
import { useHoldTip } from "@/components/useHoldTip";
import { useGameStore } from "@/store";
import { EventBus, EVT } from "@/game/EventBus";
import { spellDef } from "@/game/logic/spells";
import { DESIGN, LANES } from "@/game/config";
import { designYToScreen, designXToScreen } from "@/game/viewport";
/**
 * ★★★ **React 는 `t` 를 직접 import 하지 않는다** (`@/i18n` 의 그것). 그 함수는
 *   모듈 스코프 값을 읽는 순수 함수라 React 가 변화를 볼 수 없어서, 언어를 바꿔도
 *   HUD 만 이전 언어로 남는다. 훅은 `settings.language` 를 **구독**한다.
 * ★ `pick` 은 게임 데이터(`spells.json` · `units.json` · `sigils.json`)의
 *   `{ko, en}` 필드를 고른다 — 카탈로그가 아니라 데이터가 출처인 이름·설명이다.
 */
import { useT, usePick } from "@/i18n/useT";
import { hapticTap } from "@/native/haptics";
import styles from "./Hud.module.css";

/* ── 상단 ─────────────────────────────────────────────────── */

const ArkHpBar = memo(function ArkHpBar() {
    const t = useT();
    const hp = useGameStore((s) => s.arkHp);
    const max = useGameStore((s) => s.arkHpMax);
    const ratio = max ? Math.max(0, hp / max) : 0;
    return (
        <div className={styles.arkBlock}>
            {/* ★ 낱말 하나짜리 라벨은 `common` 에서 온다 — 화면마다 다시 적으면 갈라진다 */}
            <span>{t("common.ark")}</span>
            <div className={styles.bar}>
                <div
                    className={`${styles.barFill} ${styles.arkFill} ${ratio < 0.35 ? styles.low : ""}`}
                    style={{ transform: `scaleX(${ratio})` }}
                />
            </div>
            <span>{hp}</span>
        </div>
    );
});

/**
 * 지휘관 체력 (2026-08-05).
 *
 * ★★ **적이 지휘관을 때리기 시작했는데 읽을 숫자가 없었다.** 자동 조작 실측으로
 *   2-5 에서 평균 600 중 546 이 사라진 채 전투가 끝나는데, HUD 에는 기절한
 *   *뒤에* 뜨는 패배 사유 한 줄뿐이었다. 앞으로 나가는 것이 위험하다는 사실은
 *   맞고 나서가 아니라 **맞기 전에** 읽혀야 한다 (설계 문서 §2.1 의 미끼 규칙).
 *
 * ★ 방주 바 옆에 세우되 **좁게** 둔다. 상단 첫 줄은 이미 붐비고(일시정지 · 방주 ·
 *   웨이브 · 목표 · 템포 · 각인) 한글 라벨은 라틴의 두 배 폭이다 (절대 규칙 9).
 * ★ 색으로만 구분하지 않는다 — 앞에 "지휘관" 라벨이 붙는다 (`check:a11y`).
 * ★ 기절 중에는 숫자 대신 "기절"을 쓴다. **재출격까지 몇 초인지는 여기서 세지
 *   않는다** — `CommanderPresenter` 가 지휘관 위에 이미 그린다.
 */
const CommanderHpBar = memo(function CommanderHpBar() {
    const t = useT();
    const hp = useGameStore((s) => s.commanderHp);
    const max = useGameStore((s) => s.commanderHpMax);
    if (!max) return null;
    const ratio = Math.max(0, hp / max);
    const down = hp <= 0;
    return (
        <div className={styles.arkBlock}>
            <span>{t("common.commander")}</span>
            <div className={`${styles.bar} ${styles.barSm}`}>
                <div
                    className={`${styles.barFill} ${styles.cmdFill} ${
                        !down && ratio < 0.35 ? styles.low : ""
                    }`}
                    style={{ transform: `scaleX(${ratio})` }}
                />
            </div>
            <span className={down ? styles.cmdDown : ""}>
                {down ? t("battle.commanderDown") : hp}
            </span>
        </div>
    );
});

const WaveText = memo(function WaveText() {
    const t = useT();
    const wave = useGameStore((s) => s.wave);
    const total = useGameStore((s) => s.waveTotal);
    /* ★ 문장을 코드에서 잇지 않는다 — "웨이브 3/8" 과 "Wave 3/8" 은 어순이 같지만
       다음 언어에서도 같으리라는 보장이 없다. 한 키가 문장 전체를 갖는다. */
    return <span className={styles.waveText}>{t("battle.wave", { n: wave, total })}</span>;
});

const TempoBadge = memo(function TempoBadge() {
    const t = useT();
    const shifted = useGameStore((s) => s.tempoShifted);
    if (!shifted) return null;
    return <span className={styles.tempoBadge}>{t("battle.tempoShift")}</span>;
});

/**
 * 변주 모드 목표 (GDD §4.8).
 *
 * ★ 문자열은 씬이 만들어 넘긴다. HUD 가 modeState 를 직접 읽으면
 *   전투 규칙이 React 와 시뮬 양쪽에 생긴다.
 *
 * ★ 격퇴(assault)에서는 아무것도 그리지 않는다 — 목표가 곧 웨이브이고,
 *   그건 이미 WaveText 가 말하고 있다. 같은 정보를 두 번 쓰지 않는다.
 */
const ObjectiveBadge = memo(function ObjectiveBadge() {
    const text = useGameStore((s) => s.objectiveText);
    const mode = useGameStore((s) => s.mode);
    if (!text) return null;
    return (
        <span className={`${styles.objective} ${styles["mode_" + mode]}`}>{text}</span>
    );
});

/* ── 하단 ─────────────────────────────────────────────────── */

const ManaBar = memo(function ManaBar() {
    const t = useT();
    const mana = useGameStore((s) => s.mana);
    const max = useGameStore((s) => s.manaMax);
    return (
        <>
            <span>{t("common.mana")}</span>
            <div className={styles.bar}>
                <div
                    className={`${styles.barFill} ${styles.manaFill}`}
                    style={{ transform: `scaleX(${max ? mana / max : 0})` }}
                />
            </div>
            <span>{mana}</span>
        </>
    );
});

/**
 * 균열력 바 — 지휘관 주문의 자원.
 *
 * ★ 한때 이 자리의 바와 주문 버튼 4개는 **죽은 UI** 였다. 버튼은 하드코딩 한글
 *   배열에 `disabled` 였고, `riftEnergy` 는 오르기만 하고 차감하는 코드가 저장소
 *   전체에 하나도 없었다 — 전투 내내 100 에서 포화된 게이지 옆의 누를 수 없는 버튼.
 *   "아직 없다"보다 **"있는 것처럼 보이는데 죽어 있다"** 가 나쁘므로 제거했었고,
 *   `logic/spells.js` + `data/spells.json` 이 붙은 지금 되살렸다.
 */
const RiftBar = memo(function RiftBar() {
    const t = useT();
    const rift = useGameStore((s) => s.riftEnergy);
    const max = useGameStore((s) => s.riftMax ?? 100);
    return (
        <>
            <span>{t("common.rift")}</span>
            <div className={styles.bar}>
                <div
                    className={`${styles.barFill} ${styles.riftFill}`}
                    style={{ transform: `scaleX(${max ? rift / max : 0})` }}
                />
            </div>
            <span>{rift}</span>
        </>
    );
});

/**
 * 지휘관 주문 4슬롯.
 *
 * ★ 목록·이름·코스트를 여기 적지 않는다 — `data/spells.json` 이 정본이고
 *   `logic/spells.js` 가 읽는다 (절대 규칙 4·5).
 * ★ 발동 가능 여부를 HUD 가 스스로 판정하지 않는다. 시뮬 상태는 씬에만 있으므로
 *   **균열력만 보고** 대략적인 활성화를 그리고, 진짜 판정은 `castSpell` 이 한다
 *   (쿨다운 중이면 씬이 실패 피드백을 준다). 두 곳에서 판정하면 갈라진다.
 */
const SpellRow = memo(function SpellRow() {
    const t = useT();
    /** ★ 주문 이름·설명은 카탈로그가 아니라 **데이터**(`spells.json`)가 갖는다 */
    const pick = usePick();
    const rift = useGameStore((s) => s.riftEnergy);
    /**
     * 홀드 중인 주문 id (2026-08-05, 사용자 제보 — "네 개의 작은 카드가 무슨 역할인지
     * 모르겠고 화면을 가린다").
     *
     * ★★ `title` 속성은 **터치 기기에서 뜨지 않는다.** 이 게임은 폰 가로가 본체이므로
     *   설명이 사실상 없는 것과 같았다. 그래서 **길게 누르면** 설명 카드를 띄운다.
     * ★ 홀드가 성립하면 손을 떼도 시전하지 않는다 — 설명을 보려다 균열력을 쓰는 것은
     *   이 UI 가 만들 수 있는 가장 나쁜 사고다.
     */
    const { held, bind } = useHoldTip();
    /**
     * 주문별 남은 재사용 대기 비율 — 씬이 10Hz 로 넘긴다 (0 = 준비됨).
     * ★ **`{주문id: 비율}`** 이다 (2026-08-06). 위치로 읽으면 목록이 어긋난 순간
     *   남의 쿨다운을 그린다 — 실제로 그랬다.
     */
    const cooldowns = useGameStore((st) => st.spellCooldowns);

    /**
     * ★★ **12종 중 들고 온 4종만 그린다** (2026-08-05, 주문 확장).
     *
     *   주문이 4 → 12 종이 되면서 `SPELLS` 를 그대로 map 하면 도크에 **12칸**이 뜬다.
     *   전투가 실제로 쓰는 것은 4종뿐이므로(`logic/spells.js:canCast` 가
     *   `unequipped` 로 막는다), 나머지 8칸은 누를 수 있는 것처럼 보이는 죽은 UI 다.
     *
     * ★★★ **목록의 출처는 `getBattleSpells` 하나다** (2026-08-06 수정).
     *
     *   이 주석은 처음부터 그렇게 적혀 있었는데 **코드는 그러지 않았다.**
     *   여기서 `normalizeSpellLoadout(equipped)` 을 직접 부르고 있었고, 그 호출은
     *   `highestStage` 를 모르므로 **해금 상한이 `Infinity`** 다. 전투가 쓰는
     *   `getBattleSpells()` 는 상한을 적용하니 두 목록이 갈라질 수 있었다.
     *   "화면이 스스로 판정하지 않는다"가 이 저장소의 규약이다.
     */
    const equipped = useGameStore((s) => s.meta.commander?.spells);
    const highestStage = useGameStore((s) => s.meta.highestStage);
    const list = useMemo(() => {
        const ids = useGameStore.getState().getBattleSpells();
        return ids.map((id) => spellDef(id)).filter(Boolean);
        // ★ 값 자체가 아니라 **그 값이 파생되는 두 입력**을 의존성으로 둔다.
        //   getBattleSpells 는 셀렉터가 아니라 액션이라 구독되지 않는다.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [equipped, highestStage]);

    return (
        <div className={styles.spellDock}>
            {held && (
                <div className={styles.spellTip} role="note">
                    <b className={styles.spellTipName}>{pick(held, "name")}</b>
                    {/* ★ 균열력에는 전용 아이콘이 없다 (icons.json 에 없는 키를 쓰면
                        data:validate 가 잡는다). 상단 바와 같은 라벨로 맞춘다.
                        ★ 한국어는 "균열력 40", 영어는 "40 Rift" — **낱말과 숫자의
                        순서가 뒤집힌다.** 그래서 코드에서 잇지 않고 한 키로 둔다. */}
                    <span className={styles.spellTipCost}>
                        {t("battle.riftCost", { cost: held.cost })}
                    </span>
                    <span className={styles.spellTipDesc}>{pick(held, "desc")}</span>
                </div>
            )}

            <div className={styles.spellRow}>
                {list.map((sp) => {
                    const affordable = rift >= sp.cost;
                    /**
                     * ★★ **남은 재사용 대기** (2026-08-05, 사용자 요청).
                     *   씬이 10Hz 로 `cooldownPct` 결과를 넘긴다 (0 = 준비됨).
                     *   덮개 높이로 남은 비율을, 글자로 남은 초를 말한다 —
                     *   **색만으로 상태를 표시하지 않는다** (check:a11y A3 규약).
                     */
                    const cd = cooldowns?.[sp.id] ?? 0;
                    const left = cd > 0 ? Math.ceil((sp.cooldownMs * cd) / 1000) : 0;
                    const name = pick(sp, "name");
                    const desc = pick(sp, "desc");
                    const cast = () => {
                        hapticTap();
                        EventBus.emit(EVT.CAST_SPELL, { spellId: sp.id });
                    };
                    return (
                        <button
                            key={sp.id}
                            type="button"
                            className={`${styles.spellBtn} interactive ${
                                affordable && !cd ? "" : styles.spellOff
                            }`}
                            /**
                             * ★★ **조건부 꼬리는 문장을 나눈다.** 예전에는
                             *   "…. 재사용까지 3초" 가 한 문자열 안에 조건부로
                             *   이어 붙어 있었다 — 영어는 그 자리에 오지 않는다
                             *   ("Ready in 3s" 는 앞 문장의 꼬리가 아니라 별개 문장이다).
                             *   두 키를 **문장 단위로** 잇는다.
                             */
                            aria-label={
                                t("battle.spellAria", { name, cost: sp.cost, desc }) +
                                (left ? ` ${t("battle.spellAriaCooldown", { n: left })}` : "")
                            }
                            title={t("battle.spellTitle", { name, cost: sp.cost, desc })}
                            {...bind(sp, cast)}
                        >
                            <GameIcon name={sp.icon} className={styles.spellIcon} />
                            <span className={styles.spellCost}>{sp.cost}</span>
                            {cd > 0 && (
                                <>
                                    <span
                                        className={styles.spellCd}
                                        style={{ transform: `scaleY(${cd})` }}
                                        aria-hidden
                                    />
                                    <b className={styles.spellCdText}>{left}</b>
                                </>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
});

/** 주문 결과 안내가 화면 가운데 머무는 시간(ms) */
const SPELL_TOAST_MS = 1600;

/**
 * 시전 실패 사유 → 문장.
 * ★ 사유 코드는 `logic/spells.js:canCast` 가 정한다 — 여기서 새로 만들지 않는다.
 *   모르는 사유가 오면 뭉뚱그린 기본 문장으로 떨어지되, **거짓말은 하지 않는다.**
 *
 * ★★ 값이 문자열이 아니라 **`t` 를 받는 함수**인 이유: `check:i18n`(I6)이 세는 것은
 *   `t("…")` 처럼 **문자열 그대로 적힌 호출**뿐이다. 키를 표에 담고 `t(TABLE[x])` 로
 *   부르면 그 키들은 "카탈로그에 있는데 아무도 부르지 않는 키"로 잡히고, 그러면
 *   진짜로 죽은 키와 구별할 수 없게 된다.
 */
const SPELL_FAIL = {
    rift: (t) => t("battle.spellFailRift"),
    cooldown: (t) => t("battle.spellFailCooldown"),
    commander_down: (t) => t("battle.spellFailCommanderDown"),
    phase: (t) => t("battle.spellFailPhase"),
    // ★ 12종 중 4종만 들고 나온다 — 들고 오지 않은 주문은 전장에서 쓸 수 없다
    unequipped: (t) => t("battle.spellFailUnequipped"),
};

/**
 * 주문 시전 결과 — **화면 가운데에 떴다가 사라진다** (2026-08-05, 사용자 요청).
 *
 * ★★ 지금까지 주문을 누르면 **아무 문장도 나오지 않았다.** 실패는 화면 흔들림과
 *   짧은 버즈뿐이었고, 성공은 전장 어딘가의 이펙트뿐이라 "무엇이 일어났는지"를
 *   초보자가 알 방법이 없었다.
 *
 * ★ 판정은 여기서 하지 않는다. 씬(`BattleScene.applyQueuedInputs`)이 `castSpell`
 *   의 결과를 그대로 실어 보낸다 — HUD 가 스스로 판정하면 두 곳이 갈라진다.
 */
const SpellToast = memo(function SpellToast() {
    const t = useT();
    const pick = usePick();
    /**
     * ★★ 상태에는 **번역된 문장이 아니라 이벤트 원본**을 담는다 (2026-08-07).
     *   구독은 마운트 때 한 번만 걸리므로 핸들러가 그때의 `t` 를 붙잡는다 —
     *   문장을 여기서 만들어 담으면 **일시정지 화면에서 언어를 바꾼 뒤** 뜨는
     *   토스트가 이전 언어로 나온다. 번역은 그리는 순간에 한다.
     */
    const [msg, setMsg] = useState(null);

    useLayoutEffect(() => {
        let timer = null;
        const onResult = ({ spellId, ok, reason }) => {
            if (!spellDef(spellId)) return;
            setMsg({ spellId, ok, reason });
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => setMsg(null), SPELL_TOAST_MS);
        };
        EventBus.on(EVT.SPELL_RESULT, onResult);
        return () => {
            EventBus.off(EVT.SPELL_RESULT, onResult);
            if (timer) clearTimeout(timer);
        };
    }, []);

    if (!msg) return null;
    const sp = spellDef(msg.spellId);
    if (!sp) return null;
    /**
     * ★ 사유를 뭉뚱그리지 않는다. "균열력이 부족합니다" 하나로 덮으면
     *   **지휘관이 기절해서 못 쓰는 것**까지 자원 문제로 읽힌다 — 플레이어는
     *   균열력을 모으며 기다리지만 실제로 기다려야 하는 것은 지휘관의 부활이다.
     */
    const body = msg.ok
        ? pick(sp, "desc")
        : (SPELL_FAIL[msg.reason] ?? SPELL_FAIL.phase)(t);
    return (
        <div className={`${styles.spellToast} ${msg.ok ? "" : styles.spellToastFail}`} role="status">
            <b className={styles.spellToastTitle}>{pick(sp, "name")}</b>
            <span className={styles.spellToastBody}>{body}</span>
        </div>
    );
});

/**
 * 디자인 Y(1280×720 좌표) → 화면 Y.
 *
 * ★ 캔버스는 레터박스 없이 세로 720 만 고정되므로(`game/viewport.js`),
 *   캔버스의 실제 표시 높이로 비례 변환하면 된다.
 */
function screenYOf(designY) {
    const canvas = document.querySelector("canvas");
    if (!canvas) return null;
    const r = canvas.getBoundingClientRect();
    if (!r.height) return null;
    // ★ 카메라와 **같은 식**을 쓴다 (game/viewport.js). 여기서 자체 계산하면
    //   카메라를 고칠 때마다 레인 영역이 실제 레인과 갈라진다 — 실제로 갈라졌다.
    return designYToScreen(designY, r);
}

/**
 * 레인 선택 오버레이 — **탭 · 탭 소환** (2026-08-04).
 *
 * ★★ **드래그를 걷어낸 이유.** 예전에는 슬롯을 누른 채 전장으로 끌어야 레인을
 *   골랐다. 폰 가로 모드에서 그 제스처는 **엄지가 화면을 가로질러야** 하고,
 *   손가락이 목적지를 가린 채 놓아야 하며, 살짝 미끄러지면 조용히 자동 배치가 됐다.
 *   사용자가 탭·탭으로 바꿔 달라고 한 것이 이것이다.
 *
 * ★ 이제 슬롯을 탭하면 이 오버레이가 뜨고, 레인을 탭하면 거기에 소환된다.
 *   레인 영역은 **레인 중심 사이의 중점**으로 나눠 전장 전체를 덮는다 —
 *   빈틈이 있으면 "탭했는데 아무 일도 안 일어난다"가 된다.
 *
 * ★ 취소는 두 가지다: 같은 슬롯을 다시 탭 · 전장 밖(취소 띠)을 탭.
 *   막히지 않는 것이 이 UI 의 유일한 요구사항이다.
 */
function LanePicker({ onPick, onCancel }) {
    const t = useT();
    const [zones, setZones] = useState([]);
    /** 전장 사각형의 가로 범위 · 안내 문구가 앉을 y — 레인 색이 전장 밖으로 새지 않게 */
    const [field, setField] = useState(null);

    useLayoutEffect(() => {
        const measure = () => {
            const top = screenYOf(LANES.hud.topH);
            const bottom = screenYOf(DESIGN.height - LANES.hud.bottomH);
            if (top == null || bottom == null) return;
            const centers = LANES.ground.map((l) => screenYOf(l.y));

            /**
             * ★★ 색은 **전장 사각형 안에서만** 칠한다 (2026-08-04, 사용자 요청).
             *   히트 영역은 화면 폭 전체로 두고(빈틈 = "탭했는데 아무 일도 안 남"),
             *   보이는 사각형만 방주~균열로 좁힌다. 둘을 같게 만들면 둘 중 하나가 나빠진다.
             *
             * ★ 안내 문구는 **상단 HUD 아래**로 내린다. 예전엔 캔버스가 디자인
             *   좌표 y=106 에 그렸는데, HUD 는 CSS 픽셀이라 줌이 낮은 폰에서
             *   마나·균열력 줄(58~76px) 위에 그대로 올라탔다.
             */
            const canvas = document.querySelector("canvas");
            const r = canvas?.getBoundingClientRect();
            const hudBottom =
                document.querySelector("[data-hud-top]")?.getBoundingClientRect().bottom ?? 0;
            /**
             * ★★ 사각형 높이는 **레인마다 같다** (2026-08-04, 사용자 요청).
             *
             *   1번 구역은 전장 위쪽 끝까지 넓혀 놨으므로(빈틈 방지) 구역 높이가
             *   2·3번의 3배다. 구역을 그대로 칠하면 1번만 유독 큰 띠가 된다.
             *   히트 영역은 넓게 두고 **보이는 사각형만** 레인 간격(96 디자인px)에
             *   맞춘다 — 이웃 레인 중심 사이의 거리가 곧 그 값이다.
             */
            const laneH =
                centers.length > 1 ? centers[1] - centers[0] : edges[1] - edges[0];
            setField(
                r && r.height
                    ? {
                          left: designXToScreen(LANES.arkX, r),
                          right: designXToScreen(LANES.riftX, r),
                          laneH,
                          hintTop: Math.max(top, hudBottom) + 6,
                      }
                    : null
            );
            // 경계 = 이웃 레인 중심의 중점. 처음·끝은 전장 경계까지 넓힌다.
            const edges = [top];
            for (let i = 1; i < centers.length; i++) {
                edges.push((centers[i - 1] + centers[i]) / 2);
            }
            edges.push(bottom);
            /**
             * ★★ `center` 를 따로 들고 다닌다 — **구역의 한가운데가 레인이 아니다.**
             *
             *   1번 구역은 전장 위쪽 끝까지 넓혀 놨으므로(빈틈이 있으면 "탭했는데
             *   아무 일도 안 일어난다"가 된다) 구역 한가운데가 레인보다 한참 위다.
             *   폰 가로에서 구역 중앙 117 · 실제 레인 167 — **50px 어긋난다.**
             *   숫자를 구역 중앙에 놓으면 "1 이 1번 레인 위에 있지 않다"가 된다.
             */
            setZones(
                centers.map((c, i) => ({
                    top: edges[i],
                    height: edges[i + 1] - edges[i],
                    center: c,
                }))
            );
        };
        measure();
        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
    }, []);

    if (!zones.length) return null;

    return (
        <div className={styles.lanePicker}>
            {/* 전장 밖을 덮는 취소 면 — 오조작으로 갇히지 않게 */}
            <button
                className={`${styles.laneCancel} ${styles.cancelTop} interactive`}
                style={{ top: 0, height: zones[0].top }}
                onClick={onCancel}
                aria-label={t("battle.summonCancel")}
            >
                <span className={styles.cancelLabel}>{t("common.cancel")}</span>
            </button>
            {zones.map((z, i) => (
                <button
                    key={i}
                    /**
                     * ★ 레인마다 **다른 색**이다. 세 띠가 같은 색이면 어디를 눌렀는지
                     *   손가락이 덮은 채로는 알 수 없다. 색만으로 알리지 않도록
                     *   숫자도 함께 둔다 (a11y — 색 단독 금지).
                     *
                     * ★ 버튼 자체는 **투명하고 화면 폭 전체**다 — 히트 영역.
                     *   보이는 것은 안쪽 `laneRect` 뿐이다.
                     */
                    className={`${styles.laneZone} ${styles[`lane${i + 1}`]} interactive`}
                    style={{ top: z.top, height: z.height }}
                    onClick={() => onPick(i)}
                    /* ★ 서수다. 한국어는 "1번 레인에 소환", 영어는 "Summon to lane 1" —
                       숫자가 문장의 **반대쪽 끝**에 온다. 자리표 하나짜리 한 문장으로 둔다. */
                    aria-label={t("battle.summonToLane", { n: i + 1 })}
                >
                    {field && (
                        <span
                            className={styles.laneRect}
                            style={{
                                left: field.left,
                                width: field.right - field.left,
                                // 레인 중심을 기준으로 **같은 높이**로 (구역 높이가 아니라)
                                top: z.center - z.top - field.laneH / 2,
                                height: field.laneH,
                            }}
                            aria-hidden
                        />
                    )}
                    {/* ★ 숫자는 **레인 위**에 놓는다 — 구역 중앙이 아니라 */}
                    <span className={styles.laneLabel} style={{ top: z.center - z.top }}>
                        {i + 1}
                    </span>
                </button>
            ))}
            {/* ★ 안내 문구 — 상단 HUD 아래에 앉는다 (캔버스가 아니라 DOM 이므로 겹칠 수 없다) */}
            {field && (
                <span className={styles.laneHint} style={{ top: field.hintTop }}>
                    {t("battle.laneHint")}
                </span>
            )}
            <button
                className={`${styles.laneCancel} ${styles.cancelBottom} interactive`}
                style={{
                    top: zones[zones.length - 1].top + zones[zones.length - 1].height,
                    bottom: 0,
                }}
                onClick={onCancel}
                aria-label={t("battle.summonCancel")}
            >
                <span className={styles.cancelLabel}>{t("common.cancel")}</span>
            </button>
        </div>
    );
}

/**
 * 동료 슬롯 하나.
 * ★ 코스트 상승(▲)을 표시한다 — 스팸 억제가 플레이어에게 보여야 한다.
 * ★ 소환은 **탭 · 탭**이다: 이 카드를 탭하면 레인 선택이 열리고, 레인을 탭하면 간다.
 */
const CompanionSlot = memo(function CompanionSlot({ index, def, cost, affordable, armed, onArm }) {
    const t = useT();
    const pick = usePick();
    const raised = cost > def.cost;

    return (
        <button
            className={`${styles.slot} ${affordable ? styles.affordable : styles.tooExpensive} ${
                armed ? styles.armed : ""
            } interactive`}
            aria-pressed={armed}
            onClick={() => {
                hapticTap();
                onArm(armed ? null : index);
            }}
        >
            {/*
              ★★ **배지를 한 줄에 몰아넣지 않는다** (2026-08-05, 사용자 제보 —
                "글자가 커서 다음 줄로 넘어가고 제대로 보이지도 않는다").
                슬롯은 68px 인데 역할("원거리") + 대공 + 붙듦을 가로로 이어 붙이면
                반드시 넘친다. 글자를 더 줄이는 것은 **답이 아니다** — 최소 10px 는
                접근성 하한이고(한글은 라틴의 2배 폭, check:a11y A4), 그 아래로
                내리면 폰에서 획이 뭉갠다.
                그래서 **모서리로 흩는다**: 역할은 좌상단, 대공은 우상단,
                붙듦·떼 소환은 코스트 옆.

              ★★ 두 배지를 **한 줄(flex)로 묶는다** (2026-08-07, i18n).
                예전에는 각자 `position:absolute` 로 좌·우 모서리에 못 박혀 있었고,
                역할 라벨의 폭은 `max-width:34px` 라는 **한국어 기준 상수**가 정했다.
                영어는 같은 자리에서 넓다 — "Blocker" · "Support" 는 라틴 7자라
                34px 를 넘겨 우상단 대공 배지 **위로 파고든다** (한글 "원거리"는 30px).
                한 줄로 묶으면 대공 배지가 제 폭을 먼저 가져가고 역할이 남는 만큼
                줄어들므로, **어느 언어에서도 두 배지가 겹치지 않는다.**
            */}
            <span className={styles.badgeRow}>
                {/* ★ 역할 이름은 `terms.role.*` 하나가 출처다 — 화면이 표를 다시
                    들면 반드시 갈라진다 (check:a11y A5). */}
                <span className={styles.roleTag}>
                    {def.role ? t(`terms.role.${def.role}`) : ""}
                </span>
                {/* ★ 역할만으로는 공중에 닿는지 알 수 없다 — 같은 '원거리'라도
                    물리는 못 닿고 술식은 닿는다 (2026-08-05 사용자 제보) */}
                <span className={styles.airTag}>
                    <AirMark def={def} compact />
                </span>
            </span>
            {/* ★ 이름만 있으면 전투 중에 읽어야 한다. 전투 중에는 글자를 읽을 시간이
                없다 — 스프라이트가 있으면 모양으로 즉시 구분된다. */}
            {def.art && (
                <Sprite
                    atlas={def.art.atlas}
                    frame={def.art.frame}
                    scale={2}
                    className={styles.slotArt}
                />
            )}
            {/* ★ 강화 레벨을 전투 중에도 보여 준다 (2026-08-05 사용자 요청).
                `applyProgression` 이 합성에 쓴 레벨을 결과에 남기므로,
                여기 보이는 값이 곧 **지금 싸우고 있는 그 레벨**이다. */}
            <span className={styles.slotName}>
                {/* ★ 동료 이름은 카탈로그가 아니라 `units.json` 이 갖는다 (`{ko, en}`) */}
                {pick(def, "name") || def.id}
                {def.level > 1 && (
                    <b className={styles.slotLv}>{t("common.levelShort", { n: def.level })}</b>
                )}
            </span>
            {/*
              ★★ **떼로 나오는 동료는 그렇다고 말한다** (2026-08-05, 사용자 제보 —
                "꼬꼬댁 닭이 처음에 3마리씩 소환되는데 의도된 것인가?").
                `units.json:squad` 는 처음부터 있었고 소환 코드도 그대로 지키고
                있었지만, **화면 어디에도 그 사실이 없었다.** 의도한 동작이
                설명되지 않으면 플레이어에게는 버그와 구별되지 않는다.
            */}
            <span className={`${styles.slotCost} ${affordable ? "" : styles.cant}`}>
                {cost}
                {raised && (
                    <ChevronUp
                        size={11}
                        className={styles.costUp}
                        aria-label={t("battle.costUp")}
                    />
                )}
                {/*
                  ★★ **떼로 나오는 동료는 그렇다고 말한다** (2026-08-05, 사용자 제보 —
                    "꼬꼬댁 닭이 처음에 3마리씩 소환되는데 의도된 것인가?").
                    `units.json:squad` 는 처음부터 있었고 소환 코드도 지키고 있었지만
                    **화면 어디에도 그 사실이 없었다.** 설명되지 않은 의도는
                    플레이어에게 버그와 구별되지 않는다.
                  ★ 코스트 옆에 붙인다 — 마나도 그 수만큼 나가기 때문이다.
                */}
                {def.squad > 1 && (
                    <b
                        className={styles.slotSquad}
                        title={t("battle.squadCount", { n: def.squad })}
                    >
                        ×{def.squad}
                    </b>
                )}
                {/*
                  ★★ **방벽이 몇 체를 붙드는지 적는다** (2026-08-05).
                    사용자 제보: "일부 근접 몬스터가 방벽을 뚫고 지나간다 — 의도인가?"
                    전수 조사 결과 **의도였다** (용량 초과분과 FLYING 은 원래 안 막힌다).
                    화면에 용량이 없으면 플레이어는 "용량을 넘겨서 샌 것"과
                    "버그로 통과한 것"을 구분할 수단이 없다.
                */}
                {def.blockCount > 0 && (
                    <b
                        className={styles.blockCap}
                        title={t("battle.blockCap", { n: def.blockCount })}
                    >
                        {/* ★ 시스템 UI 아이콘은 lucide 다 — 이모지·유니코드 글리프 금지 (절대규칙 5) */}
                        <Shield size={10} aria-hidden />
                        {def.blockCount}
                    </b>
                )}
            </span>
        </button>
    );
});

/**
 * 슬롯 줄 + 레인 선택.
 *
 * ★★ **선택 상태를 여기 둔다.** 슬롯 안에 두면 슬롯마다 하나씩 생겨서
 *   두 장이 동시에 선택될 수 있다. 소환은 한 번에 하나다.
 */
function SlotRow({ loadout, canSummon: allowed = true }) {
    const mana = useGameStore((s) => s.mana);
    const costs = useGameStore((s) => s.slotCosts);
    const [armed, setArmed] = useState(null);
    /**
     * ★★ **전투 중이 아니면 레인을 그리지 않는다** (2026-08-04, 사용자 요청).
     *
     *   각인 드래프트가 열리거나 전투가 끝나도 레인 띠가 화면에 남아 있었다.
     *   드래프트는 시간을 멈추고 카드를 고르는 화면이고 결과 화면은 이미 끝난
     *   전투인데, 그 위에 "여기에 소환하세요"가 계속 떠 있으면 **누를 수 있는
     *   것처럼 보인다.** 실제로는 소환되지 않는다 — 죽은 UI 다.
     *
     *   `runSlice.phase` 는 씬이 `setPhase("battle")` 로 넣고, 드래프트·일시정지·
     *   승패에서 값이 바뀐다. 그 하나만 보면 된다.
     */
    const phase = useGameStore((s) => s.phase);
    // 스토어의 phase 는 승패·일시정지를, 상위의 allowed 는 드래프트·결과 화면을 안다
    const canSummon = allowed && phase === "battle";

    // 전투가 아니게 되면 겨눔을 푼다 — 돌아왔을 때 유령 선택이 남지 않게
    if (!canSummon && armed !== null) setArmed(null);

    const summon = (lane) => {
        if (armed === null) return;
        hapticTap();
        EventBus.emit(EVT.REQUEST_SUMMON, { slotIndex: armed, lane });
        setArmed(null);
    };

    return (
        <>
            {canSummon && armed !== null && (
                <LanePicker onPick={summon} onCancel={() => setArmed(null)} />
            )}
            <div className={styles.slots}>
                {loadout.map((def, i) => {
                    const cost = costs?.[i] ?? def.cost;
                    return (
                        <CompanionSlot
                            key={def.id}
                            index={i}
                            def={def}
                            cost={cost}
                            affordable={mana >= cost}
                            armed={armed === i}
                            onArm={setArmed}
                        />
                    );
                })}
            </div>
        </>
    );
}

/**
 * 획득한 각인 띠.
 *
 * ★★ **이것이 없어서 각인이 "작동하지 않는 것처럼" 보였다** (2026-08-04).
 *   시뮬은 18종 전부를 제대로 적용하고 있었지만(`tools/sigil-audit.mjs` 18/18),
 *   고른 뒤에는 화면 어디에도 흔적이 없었다. 플레이어에게 각인은 **고르면
 *   사라지는 선택지**였다.
 *
 * ★ 같은 각인을 여러 번 고를 수 있으므로 **스택으로 묶어** 센다 (×2, ×3).
 * ★ 이름을 다 적지 않는다 — 전투 중에 읽을 시간이 없다. 아이콘 + 스택이면 된다.
 *   무엇인지 확인해야 할 때는 길게 눌러 `title` 을 본다.
 */
const SigilStrip = memo(function SigilStrip() {
    const t = useT();
    const pick = usePick();
    const sigils = useGameStore((s) => s.sigils);
    if (!sigils?.length) return null;

    const stacks = [];
    for (const id of sigils) {
        const found = stacks.find((x) => x.id === id);
        if (found) found.n += 1;
        else stacks.push({ id, n: 1 });
    }

    return (
        <div className={styles.sigilStrip}>
            {stacks.map(({ id, n }) => {
                const def = SIGILS[id];
                if (!def) return null;
                return (
                    <span
                        key={id}
                        className={styles.sigilChip}
                        title={t("battle.sigilChipTitle", {
                            name: pick(def, "name") || id,
                            desc: pick(def, "desc"),
                        })}
                    >
                        <SheetIcon index={def.icon} size={18} decorative />
                        {n > 1 && <b className={styles.sigilStack}>×{n}</b>}
                    </span>
                );
            })}
        </div>
    );
});

/* ── 조립 ─────────────────────────────────────────────────── */

export function BattleHud({ loadout = [], canSummon = true }) {
    const t = useT();
    const pauseRun = useGameStore((s) => s.pauseRun);

    return (
        <div className={styles.hud}>
            {/**
             * ★★ 마나·균열력은 **위**에 있다 (2026-08-04, 사용자 요청).
             *
             *   예전에는 하단 묶음의 첫 줄이었는데, 폰 가로(667×375)에서 그 줄이
             *   화면 y 211~229 에 앉는다. **레인 2 의 중심이 216 이다** —
             *   자원 표시가 전장 한복판, 그것도 가운데 레인 위에 얹혀 있었다.
             *
             *   위로 올리면 전장 위쪽 빈 하늘에 머문다. 상단 묶음이 78px 이고
             *   공중 레인(화면 y 117)까지 38px 여유가 남는다.
             *
             * ★ 한 줄에 다 넣지 않고 **둘째 줄**로 쌓는다. 상단 첫 줄에는 이미
             *   일시정지·방주HP·웨이브·목표·템포·각인이 있고, 한글 라벨은 라틴의
             *   두 배 폭이라(절대 규칙 9) 폰 가로에서 넘친다.
             */}
            <div className={styles.topStack} data-hud-top>
                <div className={styles.top}>
                    <button
                        className={`${styles.pauseBtn} interactive`}
                        onClick={() => {
                            hapticTap();
                            pauseRun();
                        }}
                        aria-label={t("battle.pause")}
                    >
                        <Pause size={16} aria-hidden />
                    </button>
                    <ArkHpBar />
                    <CommanderHpBar />
                    <WaveText />
                    <ObjectiveBadge />
                    <TempoBadge />
                    <SigilStrip />
                </div>

                <div className={styles.resources}>
                    <ManaBar />
                    <RiftBar />
                </div>
            </div>

            {/* ★★ 주문 4장은 **우측 하단**에 따로 선다 (2026-08-05, 사용자 제보).
                예전에는 소환 슬롯 **바로 위**에 가로로 놓여 전장 하단을 가렸고,
                무엇을 하는 카드인지 알 방법도 없었다 (`title` 은 터치에서 안 뜬다). */}
            <div className={styles.spellDockAnchor}>
                <SpellRow />
            </div>

            <SpellToast />

            <div className={styles.bottom}>
                <div className={styles.slotRow}>
                    <SlotRow loadout={loadout} canSummon={canSummon} />
                </div>
            </div>
        </div>
    );
}
