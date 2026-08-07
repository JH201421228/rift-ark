/**
 * 단일 Zustand 스토어 — React 와 Phaser 가 같은 객체를 만진다.
 *
 * 두 개의 얼굴을 노출한다:
 *   useGameStore(selector)  … React 컴포넌트용 훅
 *   gameStore.get/set/subscribe … Phaser 씬용 바닐라 API (React import 불필요)
 *
 * ★ 경계 규칙 (docs/03-tech/21-state-management.md §3)
 *   초당 10회 넘게 변하거나 인스턴스가 20개를 넘으면 여기 두지 않는다.
 *   씬 안의 평범한 배열에 두고 집계값만 스로틀해서 밀어 넣는다.
 */
import { create } from "zustand";
import { subscribeWithSelector, persist, createJSONStorage } from "zustand/middleware";
import { capacitorStorage } from "@/native/storage";
import { onLangChange, setLang } from "@/i18n";

import { createRunSlice } from "./slices/runSlice";
import { createRosterSlice } from "./slices/rosterSlice";
import { createMetaSlice } from "./slices/metaSlice";
import { createUiSlice } from "./slices/uiSlice";
import { createSettingsSlice } from "./slices/settingsSlice";
// ★ 마이그레이션은 별도 모듈이다 — 순수 함수라 Node 에서 직접 테스트한다
//   (store/migrate.test.js). 이유는 그 파일 상단 참조.
import { migrate } from "./migrate";

export const SAVE_KEY = "riftark-save";
/**
 * v15 = **경량화**(2026-08-04). 수익화 · 일일/방치 · 부가 콘텐츠 계열 슬라이스를
 * 통째로 걷어냈다 — `shop` · `gacha` · `daily` · `dungeons` · `tower` · `trials` · `ads`.
 * migrate 가 옛 세이브에서 그 키들을 지우고, 잃는 재화(젬·강화석)는 골드로 환산한다.
 *
 * v16 = **튜토리얼 삭제**(2026-08-04). `ftue` 키가 사라졌다. 진행도는 영향을 받지
 * 않는다 — 튜토리얼은 시작 보유 동료 2종을 주는 통로였고, 그 지급은 이제
 * `unlocks.json:startingUnits` 가 담당하며 마이그레이션이 소급 지급한다.
 *
 * v17 = **지휘관 성장**(2026-08-05). `meta.commander` 가 생겼다 — 레벨(골드) ·
 * 장구(스테이지 확정 지급) · 슬롯 장착. 마이그레이션이 진행도에 해당하는 장구를
 * **소급 지급**한다 (확정 지급 동료와 같은 논리).
 *
 * v18 = **주문 12종 / 장착 4칸**(2026-08-05). `meta.commander.spells` 가 생겼다.
 * 해금은 저장하지 않는다 — `highestStage` 의 파생이다.
 */
export const SAVE_VERSION = 18;

/**
 * 하이드레이션 직후에 도는 정리 단계 — **순서가 곧 의존 순서다.**
 *
 * ★★ **배열로 두는 것이 요점이다.** 예전에는 호출이 `try` 블록 **하나** 안에
 *   나열되어 있었다. 그 모양에서는 첫 번째가 던지는 순간 나머지가 통째로
 *   건너뛰어지고, catch 의 문구("남은 필드는 기본값으로 갑니다")와 달리
 *   **남은 슬라이스는 디스크의 손상값을 그대로 들고 간다.**
 *   실측: `normalizeMeta` 만 던지게 하고 세이브를 부팅하면 편성에 유령 id 가
 *   살아남아 `buildStageConfig` 가 던지고 — **어떤 전투도 시작되지 않는다.**
 *   화면에는 원인이 한 글자도 안 뜬다.
 *
 * ★ 이름을 **여기 한 곳에만** 적는다. `saveVersion.test.js` 가 이 배열을 import 해서
 *   `partialize` 의 최상위 키와 대조한다 — 손목록을 두 벌 두면 갈라진다.
 */
export const HYDRATION_STEPS = [
    "normalizeMeta",
    "normalizeRoster",
    "normalizeSettings",
];

/**
 * 디스크에 저장되는 최상위 키 — **`partialize` 와 슬롯 초기화가 같은 목록을 쓴다.**
 *
 * ★★ 갈라지면 어떻게 되는지 실제로 봤다 (2026-08-04). `resetToPristine()` 이
 *   상태를 **통째로** 되돌리는 바람에 `ui.assetsReady` 까지 false 로 돌아갔고,
 *   그 플래그는 프리로드가 끝날 때 한 번만 켜진다. 결과: **타이틀에서 슬롯을
 *   고른 뒤로는 모든 전투가 빈 화면**이었다 — 배경도 유닛도 없고 웨이브 0/0.
 *   새로고침해야만 돌아왔고, 화면에는 원인이 한 글자도 뜨지 않았다.
 *
 * ★ 그래서 슬롯 초기화는 **저장되는 것만** 되돌린다. 저장되지 않는 것(ui · run)은
 *   세션의 상태이지 계정의 상태가 아니다.
 */
export const SAVED_KEYS = ["roster", "meta", "settings"];

/**
 * 정리 단계를 **하나씩** 감싸 실행한다.
 *
 * ★★ **여기서는 절대 던지지 않는다** (P8-05). 씬의 `shutdown()` 과 같은 태도다.
 *   하나라도 밖으로 던지면 zustand 가 하이드레이션을 reject 하고 `hasHydrated` 가
 *   **영원히 false 로 멈춘다** — `App.jsx` 의 `if (!hydrated) return null` 때문에
 *   화면이 통째로 빈다. 설정 화면에 못 들어가니 세이브 초기화도 불가능하다.
 *
 * ★ 그리고 **한 단계의 실패가 다음 단계를 막지 않는다.** 잃는 것을 "필드 하나"로
 *   가두는 것이 이 함수의 전부다.
 *
 * @param {object} state 하이드레이션된 스토어 상태
 * @returns {string[]} 실패한 단계 이름 (테스트·진단용)
 */
export function runHydrationSteps(state) {
    const failed = [];
    for (const name of HYDRATION_STEPS) {
        try {
            state?.[name]?.();
        } catch (e) {
            failed.push(name);
            console.warn(`[store] hydration step failed (${name}) — only this field falls back to defaults`, e);
        }
    }
    return failed;
}

/**
 * 마이그레이션의 바깥 그물.
 *
 * ★★ **하이드레이션 경로에서 유일하게 보호되지 않던 코드가 `migrate` 였다.**
 *   zustand 는 migrate 를 하이드레이션 프로미스 체인 **안에서** 부르고, 거기서
 *   던지면 `.catch` 로 빠져 `hasHydrated` 를 true 로 만들지 않는다
 *   (node_modules/zustand/esm/middleware.mjs — 성공 경로에만 set 한다).
 *   `onRehydrateStorage` 의 try/catch 는 그보다 **뒤**라 아무것도 막지 못한다.
 *   실측: `{"version":11,"state":{"trials":{"claimed":{}}}}` →
 *   `[...(s.trials?.claimed ?? [])]` 가 TypeError → **영구 빈 화면**.
 *   (그 스프레드 자체도 `migrate.js` 에서 고쳤다. 여기는 *다음* 실수를 받는 그물이다.)
 *
 * ★ 실패를 "세이브 없음"으로 **강등**한다 — `native/storage.js` 의 파싱 가드와 같은 태도다.
 *   진행도를 잃는 것은 아프지만, 재설치 외에 복구 경로가 없는 검은 화면보다 낫다.
 *   `{}` 를 돌려주면 persist 가 기본 상태 위에 아무것도 얹지 않는다.
 */
function safeMigrate(persisted, version) {
    try {
        return migrate(persisted, version);
    } catch (e) {
        console.warn(
            `[store] migration failed (v${version} -> v${SAVE_VERSION}) — discarding the save and starting fresh`,
            e
        );
        return {};
    }
}

export const useGameStore = create(
    subscribeWithSelector(
        persist(
            (...a) => ({
                ...createRunSlice(...a),
                ...createRosterSlice(...a),
                ...createMetaSlice(...a),
                ...createUiSlice(...a),
                ...createSettingsSlice(...a),
            }),
            {
                name: SAVE_KEY,
                version: SAVE_VERSION,
                storage: createJSONStorage(() => capacitorStorage),
                // ★ run/ui 는 저장하지 않는다. 저장하면 콜드 스타트에
                //   반쯤 끝난 전투와 열린 모달이 복원된다.
                partialize: (s) => Object.fromEntries(SAVED_KEYS.map((k) => [k, s[k]])),
                migrate: safeMigrate,

                /**
                 * ★ 마이그레이션의 이중 안전망.
                 *   마이그레이션은 version 이 낮을 때만 돈다. 부분 저장·손상된 세이브·
                 *   외부 툴이 건드린 세이브는 버전이 최신인데 필드가 빌 수 있다.
                 *   normalize* 는 멱등이므로 매 부팅에 한 번 더 돌려도 손해가 없다.
                 *
                 * ★★ 단계별 try 는 `runHydrationSteps` 안에 있다 — 그 함수 주석 참조.
                 *   여기에 호출을 나열하지 않는 이유가 거기 적혀 있다.
                 */
                onRehydrateStorage: () => (state, error) => {
                    if (error) {
                        console.warn("[store] rehydrate failed — starting from a fresh save", error);
                        return;
                    }
                    runHydrationSteps(state);
                },
            }
        )
    )
);

/**
 * ★★★ **표시 언어가 바뀌면 세이브 안의 기본 이름도 따라간다** (2026-08-07).
 *
 *   편성 프리셋의 기본 이름("기본"/"Basic")은 **세이브에 문자열로 들어간다.**
 *   그대로 두면 계정이 만들어진 날의 언어로 굳어, 설정에서 영어로 바꿔도 편성
 *   탭 세 칸만 한국어로 남는다 (`rosterSlice.js` 의 프리셋 절 참조).
 *
 * ★★ **여기 한 곳에서만 연결한다.** 화면이 부르게 하면 "그 화면을 거치지 않으면
 *   안 바뀐다"가 되고, 프리셋 탭은 편성 화면 밖(출격 프리뷰)에서도 그려진다.
 *   `setLang` 이 실제로 값을 바꿨을 때만 구독자를 깨우므로(같은 값이면 false),
 *   부팅 시의 `fireImmediately` 로는 불리지 않는다.
 *
 * ★ 해제하지 않는다 — 스토어는 앱과 수명이 같다 (씬과 달리 `shutdown` 이 없다).
 */
onLangChange(() => {
    useGameStore.getState().relocalizePresets?.();
});

/**
 * ★★★ **표시 언어를 React 밖으로 내보내는 자리는 여기다** (2026-08-07, 실기 확인).
 *
 *   처음에는 `App.jsx` 의 `useEffect` 가 `setLang` 을 불렀다. 그런데 **React 는
 *   자식의 이펙트를 부모보다 먼저 돌리고, 렌더는 그보다도 먼저다.** 그래서
 *   첫 렌더에서 `i18n` 의 모듈 스코프 언어는 아직 기본값(한국어)이었다.
 *
 *   `useMemo` 안에서 `pick()` 을 부르는 화면 — `StagePreview` 가 그렇다 — 은
 *   그 첫 값을 **기억해 버린다.** 언어는 이미 영어인데 `useLang()` 값이 바뀌지
 *   않으므로 다시 계산되지도 않는다. 실기 결과: 영어 화면인데 **오른쪽 프리뷰만
 *   통째로 한국어**였다 (적 이름 · 경고문 · 부제). 새로고침해야만 나타나므로
 *   화면을 열어 보기 전에는 보이지 않는 종류의 결함이다.
 *
 * ★ 스토어 모듈은 **어떤 컴포넌트보다 먼저** 평가되므로, 여기서 구독하면
 *   첫 렌더 시점에 이미 옳은 언어다. 하이드레이션으로 값이 바뀌면 그때 또 온다.
 * ★ `App.jsx` 는 이제 DOM 쪽(`<html lang>` · `document.title`)만 맡는다 —
 *   그것들은 렌더 결과가 아니라 문서 속성이라 이펙트가 옳은 자리다.
 */
useGameStore.subscribe(
    /**
     * ★★★ **셀렉터는 절대 던지면 안 된다** (2026-08-07, `saveDurability` 가 잡았다).
     *
     *   `subscribeWithSelector` 는 **모든** 상태 변경마다 이 함수를 돌린다. 손상된
     *   세이브(`settings: null`)가 얹힌 순간 `st.settings.language` 가 던지면
     *   그 `setState` 가 통째로 중단되고, **위생 처리 파이프라인이 그 자리에서
     *   멈춘다** — `meta` 가 `null` 로 남아 그 뒤의 모든 화면이 죽는다.
     *   구독 하나가 세이브 복구 전체를 인질로 잡는 셈이다.
     * ★ 그래서 `?.` 다. 값이 없으면 `setLang` 이 기본값으로 떨어뜨린다.
     */
    (st) => st.settings?.language,
    (lang) => setLang(lang),
    { fireImmediately: true }
);

/**
 * **하이드레이션 이전의 순정 상태.**
 *
 * ★★ 슬롯을 갈아탈 때 필요하다 (`store/slots.js:openSlot`). zustand 의
 *   `persist.rehydrate()` 는 저장본을 **현재 상태 위에 얹을** 뿐이라, 빈 슬롯으로
 *   갈아타면 **이전 슬롯의 값이 그대로 남는다.** 실제로 그렇게 동작했다 —
 *   빈 슬롯 2를 골랐는데 슬롯 1의 골드·진행도가 그대로 보였다.
 *
 * ★ `create()` 의 초기화 함수는 동기적으로 돌므로, 모듈 스코프의 이 시점에는
 *   아직 어떤 세이브도 얹히지 않았다. 액션까지 함께 담기지만 그것들은
 *   `set`/`get` 을 닫은 안정된 클로저라 그대로 복원해도 된다.
 */
const PRISTINE = useGameStore.getState();

/**
 * **저장되는 상태만** 순정으로 되돌린다 — 슬롯 전환 전용.
 *
 * ★★ 예전에는 `setState(PRISTINE, true)` 로 **전부** 되돌렸다. 그러면
 *   `ui.assetsReady` 처럼 **세션에 한 번만 켜지는 플래그**까지 false 로 돌아간다.
 *   그 플래그는 `PreloadScene.create()` 에서 딱 한 번 켜지므로 다시 켜질 일이 없고,
 *   `BattleScreen` 은 그것이 false 면 씬을 시작하지 않는다 —
 *   **타이틀에서 슬롯을 고른 뒤의 모든 전투가 빈 화면이 됐다** (웨이브 0/0,
 *   배경도 유닛도 없음). 새로고침 전까지 복구되지 않고, 오류도 한 줄 안 뜬다.
 *
 * ★ 슬롯은 **계정**을 바꾸는 것이지 세션을 바꾸는 것이 아니다. 그래서 되돌릴 대상은
 *   디스크에 저장되는 것과 정확히 같다 (`SAVED_KEYS` — `partialize` 와 한 목록).
 */
export function resetToPristine() {
    useGameStore.setState(Object.fromEntries(SAVED_KEYS.map((k) => [k, PRISTINE[k]])));
}

/** Phaser · 비-React 코드용 핸들 */
export const gameStore = {
    get: useGameStore.getState,
    set: useGameStore.setState,
    subscribe: useGameStore.subscribe,
};

/**
 * 세이브를 즉시 디스크에 밀어 넣는다 (App.pause 대비).
 *
 * ★★ **하이드레이션이 끝나기 전에는 아무것도 쓰지 않는다.**
 *
 *   zustand persist 는 `api.setState` 를 감싸서 **하이드레이션 여부와 무관하게**
 *   즉시 storage.setItem 을 부른다 (node_modules/zustand/esm/middleware.mjs).
 *   그래서 콜드 스타트 도중 이 함수가 불리면 **디스크의 진짜 세이브를
 *   메모리의 기본 상태로 덮어쓴다.**
 *
 *   실제 경로: 네이티브 콜드 스타트 → App.jsx 는 `hydrated` 가 false 라 스플래시,
 *   그러나 `installLifecycle` 은 이미 등록돼 있다 → 사용자가 홈 버튼 →
 *   appStateChange(isActive:false) → onPause → flushSave().
 *   Preferences.get 응답이 아직 안 왔으면 roster·meta·settings 가
 *   전부 초기값인 채로 기록된다. 그리고 OS 가 앱을 죽이면(이 함수가 존재하는
 *   바로 그 이유) 다음 실행에서 세이브가 통째로 사라진 것으로 보인다.
 *
 * ★ 왜 '기다렸다 저장' 이 아니라 '저장하지 않음' 인가:
 *   1. 이 함수가 불린 시점은 **앱이 곧 죽을 수 있는 시점**이다. await 가
 *      돌아온다는 보장이 없으므로 기다림은 안전장치가 되지 못한다.
 *   2. `persist.rehydrate()` 를 여기서 다시 부르면 진행 중인 하이드레이션을
 *      **취소하고 새로 시작한다** (내부 hydrationVersion 이 증가한다).
 *      복구 도중에 복구를 재시작시키는 셈이라 더 위험하다.
 *   3. 무엇보다 **잃을 것이 없다.** 하이드레이션 전에는 UI 가 스플래시라
 *      플레이어가 만든 변경이 존재할 수 없다. 메모리 상태 == 초기값이고,
 *      디스크에는 이미 더 새로운 것이 들어 있다. 쓰지 않는 것이 정확히 옳다.
 *
 * ★ setState 의 반환값(setItem 프로미스)을 await 한다 — 예전 코드는 기록이
 *   끝나기 전에 반환했다. 앱이 죽기 직전이라면 그 차이가 세이브 한 판이다.
 *
 * @returns {Promise<boolean>} 실제로 디스크에 기록했으면 true
 */
export async function flushSave() {
    // zustand 5 의 persist API: rehydrate() / hasHydrated() 둘 다 **함수**다.
    // (예전 코드는 `await ...persist.rehydrate` — 괄호가 없어 함수 '참조' 를
    //  await 했고, 그것은 언제나 즉시 통과하는 no-op 가드였다.)
    if (!useGameStore.persist.hasHydrated()) {
        console.warn("[store] flushSave before hydration — skipping the write");
        return false;
    }
    try {
        // persist 가 setState 를 감싸 storage.setItem 프로미스를 돌려준다.
        // ★ 같은 기회에 "마지막 플레이 시각"을 찍는다 — 타이틀의 슬롯 목록이 이것을 읽는다.
        await useGameStore.setState((s) => ({ meta: { ...s.meta, savedAt: Date.now() } }));
        return true;
    } catch (e) {
        console.warn("[store] save flush failed", e);
        return false;
    }
}

/**
 * 세이브 전체 삭제 (설정 > 데이터, P7-15).
 *
 * ★ 되돌릴 수 없다. **호출부가 2단계 확인을 책임진다** — 이 함수는 확인하지 않는다.
 *   여기에 confirm 을 넣으면 테스트에서도 뜨고, 네이티브에서는 아예 안 뜬다.
 *
 * ★ 메모리 상태를 손으로 초기화하지 않고 재시작하는 이유:
 *   슬라이스가 늘어날 때마다 "초기화 목록"을 같이 고쳐야 하는 구조는 반드시
 *   언젠가 빠뜨린다. 그 빠뜨림은 "초기화했는데 재화가 남아 있다"로 나타난다.
 *   저장소를 비우고 새로 부팅하면 초기값이 유일한 진실이 된다.
 */
export async function resetSave() {
    try {
        await useGameStore.persist.clearStorage();
        // ★ zustand 5 의 clearStorage 는 storage.removeItem() 의 **프로미스를
        //   반환하지 않는다** (middleware.mjs: `clearStorage: () => { storage?.removeItem(name) }`).
        //   Preferences 는 비동기이므로 위의 await 는 삭제 완료를 기다리지 못하고
        //   즉시 통과한다. 호출부(SettingsScreen)는 반환 직후 앱을 재시작하므로,
        //   기다리지 않으면 "초기화했는데 세이브가 남아 있다" 가 된다.
        //   같은 키를 한 번 더 지우는 것은 멱등이라 손해가 없다.
        await capacitorStorage.removeItem(SAVE_KEY);
        return true;
    } catch (e) {
        console.warn("[store] save delete failed", e);
        return false;
    }
}

// 개발 빌드: set() 빈도 감시.
// docs/03-tech/21-state-management.md §7 — 초당 12회를 넘으면 렌더 폭풍 신호다.
if (import.meta.env.DEV) {
    // 콘솔에서 상태를 들여다보기 위한 핸들 (프로덕션에서는 트리셰이킹됨)
    globalThis.__store = useGameStore;

    let count = 0;
    let windowStart = performance.now();
    const origSet = useGameStore.setState;
    useGameStore.setState = (...args) => {
        const now = performance.now();
        if (now - windowStart >= 1000) {
            if (count > 20) {
                console.warn(
                    `[store] set() ${count}/s — likely violates the 10Hz throttle rule ` +
                        `(docs/03-tech/21-state-management.md §4.2)`
                );
            }
            count = 0;
            windowStart = now;
        }
        count++;
        return origSet(...args);
    };
    gameStore.set = useGameStore.setState;
}
