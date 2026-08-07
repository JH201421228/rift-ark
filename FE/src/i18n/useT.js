/**
 * React 쪽 i18n 진입점.
 *
 * ★★ **왜 `index.js` 와 파일이 다른가.** `index.js` 는 Phaser 씬과 `game/logic/`
 *   의 라벨 함수도 import 한다. 그쪽에서 Zustand 스토어를 끌어오면 시뮬 계통이
 *   UI 상태에 의존하게 되고(절대규칙 1의 정신), 헤드리스 하네스에서 스토어 전체를
 *   로드하게 된다. 스토어를 아는 것은 **이 파일뿐**이다.
 *
 * ★★★ **`t` 를 그냥 import 해서 쓰면 언어를 바꿔도 화면이 안 바뀐다.**
 *   `t` 는 모듈 스코프 값을 읽는 순수 함수라 React 가 그 변화를 볼 수 없다.
 *   그래서 컴포넌트는 반드시 이 훅을 통해 받는다 — 훅이 `settings.language` 를
 *   **구독**하므로 언어가 바뀌면 그 컴포넌트가 다시 그려진다.
 *   (이 저장소가 반복해서 당한 "선언했는데 아무도 안 읽는 것"의 반대편 사고다:
 *    읽기는 하는데 **다시 읽지 않는 것**.)
 */
import { useCallback } from "react";
import { useGameStore } from "@/store";
import { t as rawT, pick as rawPick } from "./index.js";

/**
 * @returns {(key: string, params?: object) => string}
 *
 * ★ `useCallback` 의 의존성은 `lang` 하나다 — 언어가 그대로면 같은 함수 신원을
 *   유지하므로, 이 함수를 의존성으로 받는 `useMemo` 가 매 렌더 다시 돌지 않는다.
 */
export function useT() {
    const lang = useGameStore((s) => s.settings.language);
    return useCallback((key, params) => rawT(key, params, lang), [lang]);
}

/** 데이터 객체(`{nameKo, nameEn}`)에서 현재 언어의 필드를 고르는 훅 버전 */
export function usePick() {
    const lang = useGameStore((s) => s.settings.language);
    return useCallback((obj, base) => rawPick(obj, base, lang), [lang]);
}

/** 현재 언어 (구독한다 — 값이 바뀌면 컴포넌트가 다시 그려진다) */
export function useLang() {
    return useGameStore((s) => s.settings.language);
}
