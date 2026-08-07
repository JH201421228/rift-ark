/**
 * settingsSlice 테스트 (P7-15)
 *
 * 여기서 보는 것은 "설정이 저장되는가"가 아니라
 * **깨진 설정이 들어와도 앱이 살아남는가**다.
 * 설정은 세이브에 들어가므로 한 번 오염되면 그 기기는 영원히 그 값을 쓴다.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
    createSettingsSlice,
    defaultSettings,
    normalizeSettings,
    bgmLevel,
    sfxLevel,
    SETTING_OPTIONS,
    EFFECT_BUDGET,
} from "./settingsSlice.js";
import SETTINGS_DATA from "@/game/data/settings.json";

function makeSlice() {
    let state = {};
    const get = () => state;
    const set = (patch) => {
        const next = typeof patch === "function" ? patch(state) : patch;
        state = { ...state, ...next };
    };
    state = createSettingsSlice(set, get);
    return { get };
}

describe("settingsSlice — 데이터 계약", () => {
    it("기본값이 코드가 아니라 settings.json 에서 온다", () => {
        expect(defaultSettings()).toEqual(SETTINGS_DATA.defaults);
    });

    it("기본값 객체는 매번 새 사본이다 (공유 참조 오염 방지)", () => {
        const a = defaultSettings();
        a.bgmVolume = 0.01;
        expect(defaultSettings().bgmVolume).toBe(SETTINGS_DATA.defaults.bgmVolume);
    });

    it("모든 선택지 키가 기본값에 존재하고, 기본값이 선택지 안에 있다", () => {
        for (const [key, opts] of Object.entries(SETTING_OPTIONS)) {
            expect(SETTINGS_DATA.defaults, `${key} 가 defaults 에 없다`).toHaveProperty(key);
            expect(
                opts.some((o) => o.value === SETTINGS_DATA.defaults[key]),
                `${key} 의 기본값이 선택지에 없다 — 화면에서 아무것도 선택되지 않는다`
            ).toBe(true);
        }
    });

    it("이펙트 강도 예산이 0 보다 크고 1 이하다", () => {
        for (const [level, ratio] of Object.entries(EFFECT_BUDGET)) {
            expect(ratio, level).toBeGreaterThan(0);
            expect(ratio, level).toBeLessThanOrEqual(1);
        }
    });
});

describe("settingsSlice — 배선", () => {
    let s;
    beforeEach(() => {
        s = makeSlice();
    });

    it("setSetting 이 해당 키만 바꾼다", () => {
        s.get().setSetting("bgmVolume", 0.2);
        expect(s.get().settings.bgmVolume).toBe(0.2);
        expect(s.get().settings.sfxVolume).toBe(SETTINGS_DATA.defaults.sfxVolume);
    });

    it("음소거는 볼륨 값을 지우지 않는다 — 해제하면 원래 볼륨으로 돌아온다", () => {
        s.get().setSetting("bgmVolume", 0.35);
        s.get().toggleMute("bgm");
        expect(s.get().settings.bgmMuted).toBe(true);
        expect(s.get().settings.bgmVolume).toBe(0.35);
        expect(bgmLevel(s.get().settings)).toBe(0);

        s.get().toggleMute("bgm");
        expect(bgmLevel(s.get().settings)).toBe(0.35);
    });

    it("sfx 음소거는 bgm 에 영향을 주지 않는다", () => {
        s.get().toggleMute("sfx");
        expect(sfxLevel(s.get().settings)).toBe(0);
        expect(bgmLevel(s.get().settings)).toBe(SETTINGS_DATA.defaults.bgmVolume);
    });

    it("resetSettings 가 기본값으로 되돌린다", () => {
        s.get().setSetting("textScale", 1.3);
        s.get().setSetting("colorBlindMode", true);
        s.get().resetSettings();
        expect(s.get().settings).toEqual(SETTINGS_DATA.defaults);
    });

    it("normalizeSettings 액션이 오염된 상태를 복구한다", () => {
        s.get().setSetting("effectIntensity", "울트라");
        s.get().normalizeSettings();
        expect(s.get().settings.effectIntensity).toBe(SETTINGS_DATA.defaults.effectIntensity);
    });
});

describe("normalizeSettings — 손상 내성", () => {
    it("undefined 를 받아도 완전한 기본값을 만든다", () => {
        expect(normalizeSettings(undefined)).toEqual(SETTINGS_DATA.defaults);
    });

    it("빠진 키를 기본값으로 채운다", () => {
        const out = normalizeSettings({ bgmVolume: 0.1 });
        expect(out.bgmVolume).toBe(0.1);
        expect(out.hitStop).toBe(SETTINGS_DATA.defaults.hitStop);
        expect(Object.keys(out).sort()).toEqual(Object.keys(SETTINGS_DATA.defaults).sort());
    });

    it("볼륨을 0~1 로 클램프한다", () => {
        expect(normalizeSettings({ bgmVolume: 9 }).bgmVolume).toBe(1);
        expect(normalizeSettings({ sfxVolume: -3 }).sfxVolume).toBe(0);
    });

    it("숫자가 아닌 볼륨은 기본값으로 되돌린다 (NaN 이 슬라이더를 죽인다)", () => {
        expect(normalizeSettings({ bgmVolume: "크게" }).bgmVolume).toBe(
            SETTINGS_DATA.defaults.bgmVolume
        );
    });

    it("선택지에 없는 열거값은 기본값으로 되돌린다", () => {
        expect(normalizeSettings({ damageNumbers: "가끔" }).damageNumbers).toBe(
            SETTINGS_DATA.defaults.damageNumbers
        );
        expect(normalizeSettings({ textScale: 4 }).textScale).toBe(
            SETTINGS_DATA.defaults.textScale
        );
    });

    it("불리언이 아닌 값을 불리언으로 만든다", () => {
        expect(normalizeSettings({ hitStop: "false" }).hitStop).toBe(true);
        expect(normalizeSettings({ colorBlindMode: 0 }).colorBlindMode).toBe(false);
    });

    it("삭제된 설정 키를 세이브에서 걷어낸다", () => {
        const out = normalizeSettings({ uiScale: 1.3, 옛날설정: true });
        expect(out).not.toHaveProperty("uiScale");
        expect(out).not.toHaveProperty("옛날설정");
    });

    it("멱등이다 — 두 번 돌려도 같다", () => {
        const once = normalizeSettings({ bgmVolume: 2, damageNumbers: "???" });
        expect(normalizeSettings(once)).toEqual(once);
    });
});
