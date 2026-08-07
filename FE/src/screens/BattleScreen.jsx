/**
 * 전투 화면 — Phaser BattleScene 과 React HUD 를 잇는다.
 *
 * ★ React 는 HUD 와 모달만 그린다. 월드 앵커 요소(데미지 숫자·HP 바·오라 링)는
 *   전부 Phaser 가 그린다 — 60Hz 로 갱신되고 카메라 변환을 따라야 하므로
 *   DOM 으로 하면 프레임마다 레이아웃 스래싱이 난다.
 *
 * @see docs/03-tech/20-architecture.md §4.4
 */
import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { gameManager } from "@/game/GameManager";
import { EventBus, EVT } from "@/game/EventBus";
import { useGameStore } from "@/store";
import { buildStageConfig } from "@/game/logic/stageConfig";
// ★ 캠페인 진행 게이트 — 술어는 규칙 모듈 하나가 갖는다 (출격 화면·프리뷰와 같은 함수).
import { canEnterStage } from "@/game/logic/stageUnlock";
import { BattleHud } from "@/hud/BattleHud";
import { BattleResult } from "./BattleResult";
import { PauseModal } from "./PauseModal";
import { SigilDraft } from "./SigilDraft";
import { hapticHeavy } from "@/native/haptics";
import { playSfx } from "@/game/fx/SfxEngine";
import { SFX } from "@/game/fx/sfxKeys";
import styles from "./Screen.module.css";

/**
 * ★★ **여기에 기본 편성 목록을 다시 만들지 말 것.**
 *
 *   예전에는 `DEFAULT_LOADOUT` 이라는 하드코딩 6종이 있었다. 그 목록에는 어떤
 *   경로로도 얻을 수 없는 동료(`determined_soldier`)가 들어 있었고, 슬롯을
 *   `{id}` 로만 만들어 **레벨·랭크·장비·별 트리가 전부 무시됐다.**
 *   시작 로스터의 두 번째 출처이기도 했다 (P8-03 가 찾았다).
 *
 *   빈 편성을 무엇으로 채울지는 **로스터의 규칙**이지 화면의 사정이 아니다 —
 *   `store/slices/rosterSlice.js:getBattleLoadout` 하나가 답한다.
 */

export default function BattleScreen() {
    const { stageId = "1-1" } = useParams();
    const navigate = useNavigate();
    const phase = useGameStore((s) => s.phase);
    /** 오토 플레이 중에만 각인 자동 선택이 걸린다 */
    const autoPlaying = useGameStore((s) => s.settings.autoCommander);
    const [result, setResult] = useState(null);
    const [runKey, setRunKey] = useState(0);

    /**
     * 이번 출격의 동료 — 프리셋이 비어 있으면 보유분에서 추천으로 채운다.
     *
     * ★ 무엇으로 채울지는 **스토어가 정한다** (`getBattleLoadout`). 화면이 자기 폴백
     *   목록을 갖는 순간 그것이 시작 로스터의 두 번째 출처가 된다 (위 주석 참조).
     *
     * ★★★ **구독하지 않는다. 출격 시점에 한 번 읽고 고정한다.**
     *
     *   예전에는 `useGameStore((s) => s.getBattleLoadout(...).join(","))` 였고,
     *   그 값이 아래 마운트 effect 의 **의존성**에 들어 있었다. 그런데
     *   `getBattleLoadout` 은 활성 프리셋이 비면 `recommendLoadout(Object.keys(owned))`
     *   로 떨어지므로 **`roster.owned` 의 함수**다 — 그리고 `owned` 는 이 화면이
     *   마운트된 채로 바뀐다: `onEnd` 안의 `claimStageReward` 가 확정 지급
     *   (`unlocks.json:stageGrants`)을 그 자리에서 실행한다.
     *
     *   실측(신규 계정 · 빈 프리셋 · 1-1): 지급 전 `"slow_turtle,elf_sharpshooter"` →
     *   `bold_man_at_arms` 지급 직후 `"slow_turtle,bold_man_at_arms,elf_sharpshooter"`.
     *   의존성이 바뀌므로 effect 가 정리(`switchScene("Ark")`)되고 즉시 재실행되어
     *   **`setResult(null)` 이 같은 렌더 배치에서 결과를 덮는다** —
     *   게임 최초 승리에서 결과 화면이 뜨지 않고 1-1 이 처음부터 다시 시작된다.
     *   같은 일이 확정 지급이 있는 모든 스테이지에서 프리셋이 빈 동안 반복된다.
     *
     *   실제 슬롯은 어차피 아래에서 `getState()` 로 읽는다. 편성은 **전투가 시작될 때**
     *   정해지는 것이지 전투 중에 따라 바뀌는 것이 아니다 — 그러니 스냅샷이 맞다.
     *   덤으로 10Hz 스토어 통지마다 `recommendLoadout` + `stageThreats` 가
     *   통째로 다시 돌던 것(초당 200개 안팎의 단명 배열)도 함께 사라진다.
     */
    /**
     * ★ 값은 **이번 출격을 식별하는 키**다 (재도전 번호 + 그 시점의 편성).
     *   화면에 그리지 않고 오직 아래 effect 의 의존성으로만 쓴다.
     *   재도전(runKey)에는 다시 읽는다 — 그 사이 편성 화면을 다녀왔을 수 있다.
     */
    const runLoadoutKey = useMemo(
        () => [runKey, ...useGameStore.getState().getBattleLoadout(stageId)].join(","),
        [stageId, runKey]
    );

    // ★ 전역 아틀라스가 로드되기 전에 전투 씬을 시작하면
    //   스프라이트도 이펙트도 없는 빈 전장이 뜬다.
    const assetsReady = useGameStore((s) => s.ui.assetsReady);

    // 편성 정의는 HUD 가 이름·코스트를 표시하는 데 필요하다
    const [loadoutDefs, setLoadoutDefs] = useState([]);

    useEffect(() => {
        if (!assetsReady) return;

        /**
         * ★★★ **딥링크로 앞 스테이지를 열 수 없다.**
         *
         *   예전에는 아무 가드도 없었다. `/battle/5-20` 을 주소창·딥링크·뒤로가기로
         *   열면 그대로 시작됐고, 한 번 이기면 `recordStageClear` 의
         *   `highestStage = max(prev, globalIndex)` 가 **방주 시설·하드 전 월드를
         *   한꺼번에 열었다.** 진행 순서를 강제하는 코드가 어디에도 없었다.
         *
         *   판정은 화면이 아니라 규칙 모듈이 한다 (`logic/stageUnlock.js`) —
         *   출격 화면의 자물쇠와 **같은 술어**여야 "버튼은 잠겼는데 딥링크로는
         *   들어가진다"가 생기지 않는다.
         */
        if (!canEnterStage(stageId, useGameStore.getState().meta.highestStage)) {
            navigate("/stages", { replace: true });
            return;
        }

        // ★ 레벨·시설·별 트리를 합성한 슬롯을 넘긴다.
        //   여기서 id 배열만 넘기면 성장이 전투에 전혀 반영되지 않는다 —
        //   화면에는 "Lv.30"이라고 떠 있는데 전투에서는 1레벨로 싸운다.
        const st = useGameStore.getState();
        const slots = st.getBattleSlots(stageId).filter(Boolean);
        const meta = st.getMetaEffects();
        const sigil = st.getSigilParams();
        const difficulty = st.resolveDifficulty(stageId);
        /**
         * ★ 주문은 **12종 중 고른 4종**만 들고 나간다 (2026-08-05).
         *   무엇을 들고 가는지는 스토어가 답한다 (`getBattleSpells`) — 화면이
         *   목록을 만들면 편성 화면이 보여 주는 것과 전투가 쓰는 것이 갈라진다.
         */
        const spells = st.getBattleSpells();

        let cfg;
        try {
            cfg = buildStageConfig(stageId, slots, { meta, difficulty, spells, ...sigil });
        } catch (e) {
            // ★ 개발자 로그다 — 사용자에게 보이지 않으므로 카탈로그를 거치지 않는다.
            //   대신 **영어로** 적는다: 한국어를 남기면 `check:i18n`(I4)이
            //   "번역이 덜 끝난 화면"으로 잡고, 그러면 진짜 누락과 구별되지 않는다.
            console.error("[battle] failed to build stage config", e);
            navigate("/stages", { replace: true });
            return;
        }
        setLoadoutDefs(cfg.loadout);
        setResult(null);

        /**
         * ★★★ **씬 페이로드는 `buildStageConfig` 가 읽는 것을 전부 담아야 한다** (2026-08-06).
         *
         *   여기서 만든 `cfg` 는 **React 쪽 표시용**이고, 씬은 같은 인자로
         *   `buildStageConfig` 를 **다시** 부른다. 그래서 이 객체에서 빠진 값은
         *   전투에 존재하지 않는다 — 화면과 시뮬이 다른 설정으로 돈다.
         *
         *   `spells` 가 정확히 그렇게 4개월 빠져 있었다. 시뮬은 늘
         *   `spells.json:defaultLoadout` 4종으로 싸웠고, HUD 는 플레이어가 고른
         *   4종을 그렸다. 그래서 **쿨다운이 엉뚱한 버튼 위에 떴고**, 기본 장착이
         *   아닌 주문은 눌러도 `unequipped` 로 조용히 튕겼다.
         *   `battleScreen.test.js` 가 이제 두 호출부의 키를 대조한다.
         */
        gameManager.switchScene("Battle", {
            stageId,
            loadout: slots,
            meta,
            difficulty,
            spells,
            ...sigil,
            /**
             * ★★ **시드는 출격마다 바뀌어야 한다** (2026-08-06, 사용자 제보 —
             *   "게임을 할 때마다 늘 같은 조합의 각인이 나온다").
             *
             *   예전 값은 `1000 + runKey * 7919` 였는데 `runKey` 는 **이 컴포넌트의
             *   지역 상태**다. 화면을 나갔다 들어오면 0 으로 돌아가므로 **모든 첫
             *   출격이 시드 1000**이었다 — 각인 3지선다는 `rng.sigil` 스트림에서
             *   나오므로 매번 같은 순서로 뽑혔다. 바뀌는 것은 *같은 화면 안에서의
             *   재도전*뿐이었고, 주석은 그것을 "재도전마다 바뀐다"고 적어 두었다.
             *
             *   `nextRunSeed()` 는 **저장되는 단조 증가 카운터**다. `Math.random()`
             *   이나 `Date.now()` 를 쓰지 않는 이유: 시드가 재현 가능해야 제보 한 판을
             *   그대로 다시 돌릴 수 있고, 이 저장소의 결정론 규약(절대 규칙 1)이
             *   화면 밖에서도 깨지지 않는다.
             */
            seed: st.nextRunSeed() + runKey * 7919,
        });

        return () => {
            gameManager.switchScene("Ark");
        };
        // ★ 편성은 문자열 키(runLoadoutKey)로 비교한다 — 배열 신원은 매 렌더 달라진다.
        //   그리고 그 키는 **구독이 아니라 스냅샷**이다 (위 주석 참조).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stageId, runLoadoutKey, runKey, assetsReady]);

    useEffect(() => {
        const onEnd = (r) => {
            // ★ 승리 보상은 여기서 딱 한 번 지급된다 (P6-10).
            //   씬은 스토어를 모르고, 스토어는 씬을 모른다 — 그 사이를 잇는
            //   유일한 지점이 결과 이벤트다. 재도전은 새 씬이므로 다시 지급되지만
            //   첫 클리어 보너스는 claimStageReward 가 기록으로 막는다.
            const reward =
                r.result === "victory"
                    ? useGameStore.getState().claimStageReward(r.stageId, r.stars, r.difficulty)
                    : null;

            setResult({ ...r, ...(reward ? { reward } : null) });
            if (r.result === "defeat") hapticHeavy();
            // ★ 결과 스팅어. 전투음과 달리 상한 1·쿨다운 800ms 라 재도전을
            //   연타해도 겹치지 않는다 (sfx.json result.*).
            playSfx(r.result === "victory" ? SFX.VICTORY : SFX.DEFEAT);
        };
        EventBus.on(EVT.BATTLE_ENDED, onEnd);
        return () => EventBus.off(EVT.BATTLE_ENDED, onEnd);
    }, []);

    // 각인 드래프트
    const [draftState, setDraftState] = useState(null);
    useEffect(() => {
        const onDraft = (payload) => setDraftState(payload.draft ? payload : null);
        EventBus.on(EVT.SIGIL_DRAFT_OPEN, onDraft);
        return () => EventBus.off(EVT.SIGIL_DRAFT_OPEN, onDraft);
    }, []);

    const chooseSigilOption = useCallback((i) => EventBus.emit(EVT.SIGIL_CHOOSE, i), []);
    const rerollSigils = useCallback(() => EventBus.emit(EVT.SIGIL_REROLL), []);

    const retry = useCallback(() => {
        setResult(null);
        setRunKey((k) => k + 1);
    }, []);

    const exit = useCallback(() => navigate("/stages"), [navigate]);
    const toLoadout = useCallback(() => navigate("/loadout"), [navigate]);

    return (
        <div className={`${styles.screen} ${styles.transparent}`}>
            {/**
             * ★ 소환 가능 여부는 **여기서** 정한다 — 드래프트와 결과 화면을 아는 것은
             *   이 화면뿐이다 (드래프트는 스토어가 아니라 EventBus 로 온다).
             *   HUD 가 같은 이벤트를 또 구독하면 판정이 두 곳이 된다.
             */}
            <BattleHud loadout={loadoutDefs} canSummon={!draftState && !result} />

            {draftState && !result && (
                <SigilDraft
                    // 리롤하면 새 컴포넌트로 마운트되어 타이머가 초기화된다
                    key={draftState.draft.options.map((o) => o.id).join("|")}
                    draft={draftState.draft}
                    rerollsLeft={draftState.rerollsLeft}
                    evolution={draftState.evolution}
                    onChoose={chooseSigilOption}
                    onReroll={rerollSigils}
                    // ★ 자동 선택은 오토 플레이에서만. 수동 플레이는 제한 시간이 없다.
                    autoSelect={autoPlaying}
                />
            )}

            {phase === "paused" && !result && !draftState && <PauseModal onExit={exit} />}

            {result && (
                <BattleResult
                    result={result}
                    onRetry={retry}
                    onLoadout={toLoadout}
                    onExit={exit}
                    onNext={exit}
                />
            )}
        </div>
    );
}
