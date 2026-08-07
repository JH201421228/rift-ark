/**
 * uiSlice — 모달 스택 · 토스트 (휘발성)
 *
 * 안드로이드 뒤로가기가 이 스택을 소비한다:
 *   모달 있음 → 닫기 / 전투 중 → 일시정지 / 그 외 → 종료 확인
 *
 * @see docs/03-tech/25-capacitor-mobile.md §5
 */
export const createUiSlice = (set, get) => ({
    ui: {
        /** @type {Array<{id: string, props?: object}>} */
        modalStack: [],
        /** @type {Array<{id: number, text: string}>} */
        toasts: [],
        loading: false,
        loadProgress: 0,
        /**
         * 전역 아틀라스 로드 완료 여부.
         * ★ 이 플래그가 false 인데 전투 씬을 시작하면 스프라이트도 이펙트도 없는
         *   빈 전장이 뜬다. 씬 전환은 반드시 이걸 기다린다.
         */
        assetsReady: false,
    },

    setAssetsReady: (v) => set((s) => ({ ui: { ...s.ui, assetsReady: v } })),

    openModal: (id, props) =>
        set((s) => ({ ui: { ...s.ui, modalStack: [...s.ui.modalStack, { id, props }] } })),

    closeTopModal: () =>
        set((s) => ({ ui: { ...s.ui, modalStack: s.ui.modalStack.slice(0, -1) } })),

    closeAllModals: () => set((s) => ({ ui: { ...s.ui, modalStack: [] } })),

    hasModal: () => get().ui.modalStack.length > 0,

    toast: (text) =>
        set((s) => ({
            ui: { ...s.ui, toasts: [...s.ui.toasts, { id: Date.now() + Math.random(), text }] },
        })),

    dismissToast: (id) =>
        set((s) => ({ ui: { ...s.ui, toasts: s.ui.toasts.filter((t) => t.id !== id) } })),

    setLoading: (loading, progress = 0) =>
        set((s) => ({ ui: { ...s.ui, loading, loadProgress: progress } })),
});
