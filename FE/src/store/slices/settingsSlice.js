/**
 * settingsSlice — 사용자 설정 (영속)
 *
 * ★ 기본값을 코드에 박지 않는다. `src/game/data/settings.json` 이 단일 출처다
 *   (절대규칙 4·5의 정신: 값은 데이터, 코드는 배선).
 *   기획이 기본 볼륨을 바꾸는 일에 빌드가 필요하면 안 된다.
 *
 * ★ 여기의 값은 **전부 배선되어 있어야 한다.** 화면에만 있고 아무것도 하지
 *   않는 설정은 기능이 아니라 거짓말이다. 배선 위치는 아래 표에 적는다.
 *
 * | 키 | 반영되는 곳 |
 * |---|---|
 * | bgmVolume · bgmMuted   | BattleScene → AudioManager.setVolumes |
 * | sfxVolume · sfxMuted   | BattleScene → AudioManager.setVolumes / sfx() |
 * | screenShake            | BattleScene → CameraFx.setShakeScale — 셰이크 · **줌 펄스 · 피격 섬광**까지 (P9-04) |
 * | damageNumbers          | BattleScene → DamageTextPool.setDensity |
 * | effectIntensity        | BattleScene → EffectSystem.setIntensity |
 * | qualityTier            | BattleScene.applyQuality → EffectSystem · DamageTextPool · ParallaxLayers · CameraFx (표는 `game/data/quality.json`, 배선은 `game/fx/quality.js`) |
 * | hitStop                | BattleScene → CameraFx.setHitStopEnabled |
 * | colorBlindMode         | BattleScene → DamageTextPool.setColorBlind + App → data-colorblind → RarityName 등급 표기 |
 * | textScale              | App → :root --ui-scale |
 * | battleSpeed            | BattleScene.setSpeed |
 * | autoAdvanceSpeed       | BattleScene.setSpeed (자동 진행 중일 때) |
 * | autoCommander          | BattleScene.runSimulation → autoPlayTick |
 * | haptics                | App → setHapticsEnabled |
 * | language               | App → i18n.setLang + `<html lang>` · `components/LangToggle` · `i18n/useT` |
 *
 * ★ 이 표는 장식이 아니다 — `tools/check-a11y.mjs` 의 A1 이 이 표와
 *   settings.json 을 한 줄씩 대조한다. 키를 늘리고 표를 안 고치면 검사기가 막는다.
 *
 * ★★ 2026-08-04 경량화로 `gachaSkip` · `notifyAsked` · `notify*` 여섯 키가 사라졌다.
 *   가챠도 로컬 알림도 없어졌고, **아무것도 하지 않는 설정은 기능이 아니라 거짓말이다.**
 *
 * ★ 아직 아무도 읽지 않는 키 — **설정 화면에 노출하지 않는다.**
 *   값은 남겨 둔다(세이브 마이그레이션 표면을 늘리지 않기 위해). 배선되는 날 화면에 붙인다.
 *
 * ★★ `qualityTier` 는 2026-08-05 에 이 표에서 **위 표로 옮겨졌다.** 저장되기만 하고
 *   읽는 코드가 한 줄도 없던 상태가 티켓 하나만큼 이어졌다 — 그 동안 화면에 노출하지
 *   않은 것만이 유일한 방어였다. 이 표는 그 방어를 기계가 하게 만드는 장치다.
 *
 * | 키 | 왜 아직 없는가 |
 * |---|---|
 * | summonMode  | 소환은 **탭 · 탭** 하나뿐이다 (2026-08-04, 드래그 삭제) — 고를 것이 없다 |
 *
 * ★★ `language` 는 2026-08-07 에 이 표에서 **위 표로 옮겨졌다.** 키는 처음부터
 *   `settings.json:defaults` 에 있었지만 `options` 가 없어 `normalizeSettings` 의
 *   검증 루프를 타지 않았다 — 즉 **어떤 값이 들어와도 그대로 저장됐다.**
 *   화면에 노출하는 것과 실제로 배선하는 것을 이 저장소가 기계로 묶어 두었기에
 *   (`check:a11y` 의 A1), 둘 중 하나만 하는 것은 애초에 불가능하다.
 *
 * @see docs/02-design/18-ux-ui.md §6
 * @see docs/03-tech/26-performance-budget.md §4
 */
import SETTINGS_DATA from "@/game/data/settings.json";
import { detectLang } from "@/i18n";

/** @typedef {'auto'|'high'|'medium'|'low'} QualityTier */

/**
 * 데이터가 정한 기본값. 복사본을 돌려주므로 호출자가 마음대로 써도 원본이 안 바뀐다.
 *
 * ★★★ **언어만 기기에서 온다** (2026-08-07). `settings.json` 의 `"language": "ko"`
 *   를 그대로 쓰면, 영어권 기기의 신규 계정이 **읽을 수 없는 화면**을 처음 본다.
 *   유료앱에서 첫 화면을 못 읽는 것은 그대로 환불이다.
 *   `detectLang()` 은 `navigator` 가 없는 환경(헤드리스 하네스 · vitest)에서는
 *   기본값으로 떨어지므로 검사기·스냅샷이 흔들리지 않는다.
 *
 * ★ 저장된 설정이 있으면 persist 가 이 값을 덮어쓴다 — 즉 **한 번이라도 고른
 *   사람의 선택이 언제나 이긴다.** 이 함수는 신규 계정과 `resetSettings` 에만 쓰인다.
 */
export const defaultSettings = () => ({ ...SETTINGS_DATA.defaults, language: detectLang() });

/** 열거형 선택지 (화면이 버튼을 그릴 때 쓴다) */
export const SETTING_OPTIONS = SETTINGS_DATA.options;

/** 이펙트 강도 → 동시 이펙트 예산 비율 */
export const EFFECT_BUDGET = SETTINGS_DATA.effectBudget;

/** 색약 모드에서 데미지 숫자 앞에 붙는 타입 표기 */
export const DAMAGE_TYPE_SHORT = SETTINGS_DATA.damageTypeShort;

/**
 * 음소거를 반영한 실효 볼륨.
 *
 * ★ 음소거를 "볼륨 0 저장"으로 구현하지 않는 이유: 음소거를 풀었을 때
 *   원래 볼륨으로 돌아와야 한다. 값을 덮어쓰면 그 정보가 사라진다.
 */
export const bgmLevel = (settings) => (settings?.bgmMuted ? 0 : (settings?.bgmVolume ?? 0));
export const sfxLevel = (settings) => (settings?.sfxMuted ? 0 : (settings?.sfxVolume ?? 0));

const clamp01 = (v) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : null);

/**
 * 저장된 설정을 **항상 사용 가능한 형태**로 만든다.
 *
 * ★ 멱등이다. migrate 가 놓친 경우(손상된 세이브 · 외부 툴 · 버전은 최신인데
 *   필드가 빈 세이브)에도 부팅마다 한 번 더 돌려 화이트스크린을 막는다.
 *   실제로 P5 에서 신규 필드 접근이 터진 전례가 있다 (store/index.js 주석).
 *
 * ★ 알 수 없는 값은 기본값으로 되돌린다. `screenShake: "매우강하게"` 같은 값이
 *   들어오면 세그먼트 버튼이 아무것도 선택되지 않은 상태가 되어 되돌릴 방법이 없다.
 */
export function normalizeSettings(raw) {
    const d = defaultSettings();
    const s = { ...d, ...(raw ?? {}) };

    s.bgmVolume = clamp01(Number(s.bgmVolume)) ?? d.bgmVolume;
    s.sfxVolume = clamp01(Number(s.sfxVolume)) ?? d.sfxVolume;

    for (const k of [
        "bgmMuted",
        "sfxMuted",
        "colorBlindMode",
        "hitStop",
        "autoCommander",
        "haptics",
    ]) {
        s[k] = Boolean(s[k]);
    }

    for (const [key, opts] of Object.entries(SETTING_OPTIONS)) {
        if (!opts.some((o) => o.value === s[key])) s[key] = d[key];
    }

    // 기본값에 없는 키는 버린다 — 삭제된 설정이 세이브에 영원히 남지 않게 한다
    for (const k of Object.keys(s)) if (!(k in d)) delete s[k];
    return s;
}

export const createSettingsSlice = (set, get) => ({
    settings: defaultSettings(),

    setSetting: (key, value) => set((s) => ({ settings: { ...s.settings, [key]: value } })),

    /** 음소거 토글 — 볼륨 값은 건드리지 않는다 */
    toggleMute: (which) =>
        set((s) => {
            const key = which === "bgm" ? "bgmMuted" : "sfxMuted";
            return { settings: { ...s.settings, [key]: !s.settings[key] } };
        }),

    /** 설정만 초기화한다. 진행도·재화는 건드리지 않는다 */
    resetSettings: () => set({ settings: defaultSettings() }),

    normalizeSettings: () => set({ settings: normalizeSettings(get().settings) }),
});
