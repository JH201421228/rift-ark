/**
 * 효과음 런타임 설치 (P3-14)
 *
 * App 셸이 부팅 때 한 번 부른다. 여기서 하는 일은 네 가지다:
 *
 *   ① 컨텍스트 공급  — Phaser 의 AudioContext 를 빌린다 (SfxEngine 주석 ③ 참조)
 *   ② 제스처 해제    — 첫 탭에서 resume. 그 전 소리는 조용히 버려진다
 *   ③ 설정 구독      — **실효 볼륨**(음소거 반영) + 이펙트 강도
 *   ④ UI 탭 위임     — 화면마다 onClick 에 소리를 심지 않는다
 *
 * ★ ③ 이 `sfxLevel` 셀렉터를 구독하는 이유: 볼륨과 음소거를 따로 구독하면
 *   음소거 토글이 "볼륨이 안 바뀐 것"으로 보여 반영되지 않는다.
 *   BattleScene 이 AudioManager 에 같은 실수를 하지 않으려고 쓴 방식과 같다.
 *
 * ★ ④ 를 위임(delegation)으로 하는 이유: 버튼은 12개 화면에 흩어져 있고
 *   앞으로도 늘어난다. 화면마다 손으로 붙이면 **반드시 하나를 빠뜨리고**,
 *   빠뜨린 버튼은 아무 에러 없이 그냥 조용하다. 한 곳에서 잡으면
 *   새 화면이 추가돼도 자동으로 소리가 난다.
 *   특별한 소리가 필요한 버튼은 `data-sfx="ui.purchase"` 로 덮어쓴다.
 *
 * @see docs/02-design/19-art-audio-direction.md §6.3
 */
import { sfxEngine } from "./SfxEngine.js";
import { SFX } from "./sfxKeys.js";
import { gameManager } from "@/game/GameManager";
import { useGameStore } from "@/store";
import { sfxLevel, EFFECT_BUDGET } from "@/store/slices/settingsSlice";

/** 탭 소리를 낼 대상. 스크롤 컨테이너·카드 전체가 아니라 '누르는 것'만 */
const TAPPABLE = 'button, a, [role="button"], input[type="checkbox"], input[type="radio"]';

/**
 * @param {Document} [doc]
 * @returns {() => void} 해제 함수
 */
export function installSfxRuntime(doc = globalThis.document) {
    // ① Phaser 의 컨텍스트를 빌린다. 아직 없으면 엔진이 자체 컨텍스트로 폴백한다.
    sfxEngine.setContextProvider(() => gameManager.game?.sound?.context);

    // ② 첫 제스처에서 해제 (모바일 자동재생 정책)
    const unlisten = sfxEngine.installUnlock();

    // ③ 설정 → 엔진
    const unsubLevel = useGameStore.subscribe(
        (s) => sfxLevel(s.settings),
        (v) => sfxEngine.setLevel(v),
        { fireImmediately: true }
    );
    const unsubIntensity = useGameStore.subscribe(
        (s) => s.settings.effectIntensity,
        (v) => sfxEngine.setIntensityRatio(EFFECT_BUDGET[v] ?? 1),
        { fireImmediately: true }
    );

    // ④ UI 탭 위임
    let onTap = null;
    if (doc?.addEventListener) {
        onTap = (ev) => {
            const el = ev.target?.closest?.(`[data-sfx], ${TAPPABLE}`);
            if (!el) return;
            if (el.disabled || el.getAttribute?.("aria-disabled") === "true") return;
            // ★ 씨앗은 요소가 아니라 좌표에서 뽑는다 — 같은 버튼을 연타해도
            //   높이가 미세하게 달라져 기계적으로 들리지 않는다.
            sfxEngine.play(el.dataset?.sfx || SFX.UI_TAP, (ev.clientX | 0) * 31 + (ev.clientY | 0));
        };
        // capture: 화면이 stopPropagation 을 걸어도 소리는 난다
        doc.addEventListener("pointerdown", onTap, { capture: true, passive: true });
    }

    return () => {
        if (onTap) doc.removeEventListener("pointerdown", onTap, { capture: true });
        unsubLevel();
        unsubIntensity();
        unlisten();
        sfxEngine.stopAll();
    };
}
