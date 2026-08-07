/**
 * 세이브 저장소 어댑터
 *
 * ★ WebView 의 localStorage 와 IndexedDB 는 OS 가 언제든 삭제할 수 있다.
 *   특히 iOS 는 persisted-storage API 가 없어 위험하다.
 *   @capacitor/preferences 는 네이티브 UserDefaults / SharedPreferences 에 기록한다.
 *
 * 웹(개발) 환경에서는 localStorage 로 폴백한다.
 *
 * @see docs/03-tech/25-capacitor-mobile.md §6
 * @see docs/03-tech/21-state-management.md §6
 */
import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";

const useNative = Capacitor.isNativePlatform();

/** Zustand persist 의 createJSONStorage 에 그대로 넘길 수 있는 비동기 스토리지 */
export const capacitorStorage = {
    getItem: async (key) => {
        const raw = useNative ? ((await Preferences.get({ key })).value ?? null) : localStorage.getItem(key);
        if (raw == null) return null;
        /**
         * ★★ **손상된 세이브는 '세이브 없음'과 똑같이 취급한다** (P8-05).
         *
         *   여기서 파싱이 던지면 zustand 의 하이드레이션 체인이 `.catch` 로 빠지고,
         *   그 경로는 **`hasHydrated` 를 true 로 만들지 않는다**
         *   (node_modules/zustand/esm/middleware.mjs — 성공 경로에만 set 한다).
         *   `App.jsx` 는 `if (!hydrated) return null` 이므로 그 계정은 **영원히 빈 화면**이다.
         *   설정 화면에 들어갈 수 없으니 세이브 초기화조차 불가능하고,
         *   재설치 외에 복구 경로가 없다 — 리뷰 폭탄의 정확한 모양이다.
         *
         *   세이브 한 판을 잃는 것과 앱이 영영 안 뜨는 것 중에서는 전자가 낫다.
         *   그리고 잘린 JSON 은 어차피 읽을 수 없다 — 잃을 것이 이미 없다.
         */
        try {
            JSON.parse(raw);
        } catch {
            console.warn("[storage] save is corrupt — ignoring it and starting fresh");
            return null;
        }
        return raw;
    },
    setItem: async (key, value) => {
        if (!useNative) {
            localStorage.setItem(key, value);
            return;
        }
        await Preferences.set({ key, value });
    },
    removeItem: async (key) => {
        if (!useNative) {
            localStorage.removeItem(key);
            return;
        }
        await Preferences.remove({ key });
    },
};
