/**
 * 설정 · 접근성 · 라이선스 (P7-15)
 *
 * ★ 이 화면의 모든 항목은 **실제로 무언가를 바꾼다.** 배선표는
 *   `src/store/slices/settingsSlice.js` 상단에 있다. 화면에만 있고 아무것도
 *   하지 않는 스위치는 기능이 아니라 거짓말이고, 그런 스위치는 출시 후
 *   "설정이 먹통"이라는 리뷰로 정확히 돌아온다.
 *
 * ★ 접근성의 핵심은 색약 항목이 아니라 **색만으로 정보를 주지 않는 것**이다.
 *   그래서 이 화면 자체도 선택 상태를 색+표식으로 이중 표기한다 (Settings.module.css).
 *
 * ★ 기본값·선택지는 `src/game/data/settings.json` 에서 온다. 여기에 숫자를 박지 않는다.
 * ★ 크레딧은 `src/game/data/attributions.json` 이 단일 출처다.
 *   `docs/legal/ATTRIBUTIONS.md` 는 `npm run docs:attributions` 로 그 JSON 에서 생성된다.
 *
 * @see docs/02-design/18-ux-ui.md §6
 * @see docs/03-tech/21-state-management.md §2
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import {
    Accessibility,
    Database,
    FlaskConical,
    Gamepad2,
    LogOut,
    Monitor,
    RotateCcw,
    ScrollText,
    ShieldCheck,
    TriangleAlert,
    Volume2,
    VolumeX,
} from "lucide-react";
import { initAds, privacyOptionsRequired, openPrivacyOptions } from "@/native/ads";
import { useGameStore, resetSave, flushSave, SAVE_VERSION } from "@/store";
import { GuideButton } from "@/components/GuideOverlay";
import LangToggle from "@/components/LangToggle";
// 진단 기록 (2026-08-05) — 자기 스타일을 들고 다니는 자족 컴포넌트다
import { FaultLog } from "@/components/FaultLog";
import { useT, usePick } from "@/i18n/useT";
import { SETTING_OPTIONS } from "@/store/slices/settingsSlice";
import ATTRIBUTIONS from "@/game/data/attributions.json";
import { hapticTap } from "@/native/haptics";
import s from "./Settings.module.css";

/**
 * 좌측 분류.
 *
 * ★★ `label` 이 문자열이 아니라 **`t` 를 받는 함수**인 이유가 둘 있다.
 *   ① 모듈 스코프는 한 번만 평가된다 — 여기서 `t("…")` 를 바로 부르면 부팅 당시
 *      언어로 굳어 버리고, 언어를 바꿔도 좌측 분류만 그대로 남는다.
 *   ② 그러면서도 소스에는 **리터럴 키**가 남아, `check:i18n` 의 I6(카탈로그 ↔ 호출
 *      대조)가 이 키들을 정적으로 셀 수 있다. `t(sec.key)` 로 두면 셀 수 없다.
 */
const SECTIONS = [
    { id: "audio", label: (t) => t("settings.sectionAudio"), Icon: Volume2 },
    { id: "graphics", label: (t) => t("settings.sectionGraphics"), Icon: Monitor },
    { id: "access", label: (t) => t("settings.sectionAccess"), Icon: Accessibility },
    { id: "play", label: (t) => t("settings.sectionPlay"), Icon: Gamepad2 },
    { id: "data", label: (t) => t("settings.sectionData"), Icon: Database },
    { id: "credits", label: (t) => t("settings.sectionCredits"), Icon: ScrollText },
];

/**
 * 개발자 메뉴 (P7-04). **개발 빌드에만 존재한다** (P8-06).
 *
 * ★★ 원래는 배포 빌드에서도 세이브 형식 표기를 7회 누르면 열렸다. 걷어냈다.
 *   7탭 이스터에그는 안드로이드에서 **널리 알려진 관용구**라 플레이어가 반드시 찾아낸다.
 *   그리고 런타임 조건으로 감춘 코드는 번들에 그대로 남는다 —
 *   실제로 `dist/assets/index-*.js` 안에서 계측 대시보드 전체가 발견됐다(P8-06 실측).
 *   **숨기는 것과 지우는 것은 다르다.** 원래 명분이던 "QA 가 기기에서 확인"은
 *   외부 테스터가 없다는 방침 전환(2026-08-03)으로 사라졌다 — QA 는 개발 빌드로 한다.
 */
const DEV_SECTION = { id: "dev", label: (t) => t("settings.sectionDev"), Icon: FlaskConical };

export default function SettingsScreen() {
    const t = useT();
    const [section, setSection] = useState("audio");
    /**
     * ★ 런타임 값이 아니라 **빌드 시 리터럴**이다. `import.meta.env.DEV` 는 프로덕션에서
     *   `false` 로 치환되고, 아래 두 갈래는 트리셰이킹으로 통째로 사라진다.
     *   스토어 플래그·탭 카운터 같은 런타임 조건으로 바꾸면 그 순간 코드가 남는다.
     *   `npm run check:prod` 가 dist 를 실제로 뒤져 이것을 검사한다.
     */
    const devVisible = import.meta.env.DEV;
    const sections = devVisible ? [...SECTIONS, DEV_SECTION] : SECTIONS;

    return (
        <div className={s.screen}>
            <header className={s.header}>
                <h1 className={s.title}>{t("common.settings")}</h1>
                <GuideButton screen="settings" />
                {/* ★ 설정 안에 [표시 언어] 행이 따로 있는데도 머리글에 또 둔다 —
                    그 행을 찾으려면 '접근성' 이라는 세 글자를 읽어야 하기 때문이다. */}
                <LangToggle />
                <span className={s.version}>{t("settings.version", { n: SAVE_VERSION })}</span>
            </header>

            <div className={s.body}>
                <nav className={s.nav}>
                    {sections.map((sec) => {
                        // 구조분해를 인자에서 하면 lucide 컴포넌트가 "쓰이지 않은 인자"로 잡힌다
                        const Icon = sec.Icon;
                        return (
                            <button
                                key={sec.id}
                                className={`${s.navItem} ${section === sec.id ? s.on : ""} interactive`}
                                onClick={() => setSection(sec.id)}
                            >
                                <Icon size={14} aria-hidden />
                                {sec.label(t)}
                            </button>
                        );
                    })}
                </nav>

                <div className={`${s.panel} scrollable`}>
                    {section === "audio" && <AudioSection />}
                    {section === "graphics" && <GraphicsSection />}
                    {section === "access" && <AccessSection />}
                    {section === "play" && <PlaySection />}
                    {section === "data" && <DataSection />}
                    {section === "credits" && <CreditsSection />}
                    {section === "dev" && devVisible && <DevSection />}
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════ 공용 컨트롤 ═══════════════════════ */

function Row({ label, hint, children }) {
    return (
        <div className={s.row}>
            <span className={s.rowLabel}>
                {label}
                {hint && <span className={s.hint}>{hint}</span>}
            </span>
            {children}
        </div>
    );
}

/**
 * 열거형 선택지. 선택지 목록은 settings.json 이 준다.
 * ★ 라디오가 아니라 세그먼트 버튼인 이유: 터치 타깃 44px 를 라디오로 확보하려면
 *   결국 라벨 전체를 버튼처럼 키워야 한다. 그럴 바에는 버튼이 정직하다.
 */
function Segment({ settingKey, value, onChange }) {
    /**
     * ★★ 라벨은 `game/data/settings.json:options[].label` 의 `{ko,en}` 에서 온다.
     *   카탈로그(`i18n/messages/settings.json`)에 사본을 만들지 않는다 — 기획이
     *   선택지를 늘리는 순간 둘이 갈라진다.
     */
    const pick = usePick();
    const opts = SETTING_OPTIONS[settingKey] ?? [];
    return (
        <div className={s.seg} role="group">
            {opts.map((o) => (
                <button
                    key={String(o.value)}
                    className={`${s.segBtn} ${o.value === value ? s.on : ""} interactive`}
                    aria-pressed={o.value === value}
                    onClick={() => {
                        hapticTap();
                        onChange(o.value);
                    }}
                >
                    {pick(o, "label")}
                </button>
            ))}
        </div>
    );
}

/** 켜기/끄기. ★ 상태를 색이 아니라 글자로 말한다 */
function Toggle({ value, onChange, onLabel, offLabel }) {
    const t = useT();
    const on = onLabel ?? t("common.on");
    const off = offLabel ?? t("common.off");
    return (
        <button
            className={`${s.toggle} ${value ? s.on : ""} interactive`}
            role="switch"
            aria-checked={value}
            onClick={() => {
                hapticTap();
                onChange(!value);
            }}
        >
            {value ? on : off}
        </button>
    );
}

/* ═══════════════════════ 오디오 ═══════════════════════ */

function VolumeRow({ label, hint, volumeKey, mutedKey }) {
    const t = useT();
    const { volume, muted } = useGameStore(
        useShallow((st) => ({ volume: st.settings[volumeKey], muted: st.settings[mutedKey] }))
    );
    const setSetting = useGameStore((st) => st.setSetting);
    const toggleMute = useGameStore((st) => st.toggleMute);

    return (
        <Row label={label} hint={hint}>
            <div className={s.sliderRow}>
                <button
                    className={`${s.iconBtn} ${muted ? s.muted : ""} interactive`}
                    aria-label={
                        muted
                            ? t("settings.ariaUnmute", { name: label })
                            : t("settings.ariaMute", { name: label })
                    }
                    onClick={() => {
                        hapticTap();
                        toggleMute(volumeKey === "bgmVolume" ? "bgm" : "sfx");
                    }}
                >
                    {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                <input
                    className={`${s.slider} interactive`}
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={Math.round(volume * 100)}
                    disabled={muted}
                    aria-label={label}
                    onChange={(e) => setSetting(volumeKey, Number(e.target.value) / 100)}
                />
                {/* ★ 음소거 중에는 퍼센트가 아니라 "음소거"라고 쓴다.
                    슬라이더 값(60%)만 남기면 왜 소리가 안 나는지 알 수 없다. */}
                <span className={s.pct}>
                    {muted
                        ? t("settings.muted")
                        : t("common.percent", { n: Math.round(volume * 100) })}
                </span>
            </div>
        </Row>
    );
}

function AudioSection() {
    const t = useT();
    return (
        <div className={s.group}>
            <h2 className={s.groupTitle}>{t("settings.sectionAudio")}</h2>
            <VolumeRow
                label={t("settings.rowBgm")}
                hint={t("settings.hintBgm")}
                volumeKey="bgmVolume"
                mutedKey="bgmMuted"
            />
            <VolumeRow label={t("settings.rowSfx")} volumeKey="sfxVolume" mutedKey="sfxMuted" />
            {/*
              ★★ "효과음 에셋은 아직 소싱 중입니다" 라는 안내가 여기 있었는데
                **사실이 아니었다** (2026-08-05에 제거). `fx/SfxEngine.js` 의 절차적
                합성음이 `App.jsx` 와 `BattleScene.js` 에서 실제로 돌고 있다 —
                오디오 파일이 하나도 없는 것은 맞지만, 그것은 **설계**이지 미완성이
                아니다 (`data/sfx.json` 상단 주석: 용량 0 · 라이선스 0 · 로딩 0).
                거짓 안내는 없는 것보다 나쁘다 — 플레이어는 소리가 안 나는 줄 안다.
            */}
            <p className={s.note}>{t("settings.noteAudio")}</p>
        </div>
    );
}

/* ═══════════════════════ 그래픽 ═══════════════════════ */

function GraphicsSection() {
    const t = useT();
    const { screenShake, damageNumbers, effectIntensity, qualityTier } = useGameStore(
        useShallow((st) => ({
            screenShake: st.settings.screenShake,
            damageNumbers: st.settings.damageNumbers,
            effectIntensity: st.settings.effectIntensity,
            qualityTier: st.settings.qualityTier,
        }))
    );
    const setSetting = useGameStore((st) => st.setSetting);

    return (
        <>
            <div className={s.group}>
                <h2 className={s.groupTitle}>{t("settings.groupScreenFx")}</h2>
                {/*
                  ★ 라벨이 "화면 흔들림"만 말하면 거짓말이 된다 (P9-04). 이 손잡이는
                    셰이크 · 줌 펄스 · 피격 섬광을 함께 끈다. 무엇이 꺼지는지 적지 않으면
                    멀미 때문에 끈 사용자가 보스 등장 줌을 보고 "안 꺼졌다"고 결론짓는다.
                */}
                <Row label={t("settings.rowShake")} hint={t("settings.hintShake")}>
                    <Segment
                        settingKey="screenShake"
                        value={screenShake}
                        onChange={(v) => setSetting("screenShake", v)}
                    />
                </Row>
                <Row
                    label={t("settings.rowDamageNumbers")}
                    hint={t("settings.hintDamageNumbers")}
                >
                    <Segment
                        settingKey="damageNumbers"
                        value={damageNumbers}
                        onChange={(v) => setSetting("damageNumbers", v)}
                    />
                </Row>
                <Row
                    label={t("settings.rowEffectIntensity")}
                    hint={t("settings.hintEffectIntensity")}
                >
                    <Segment
                        settingKey="effectIntensity"
                        value={effectIntensity}
                        onChange={(v) => setSetting("effectIntensity", v)}
                    />
                </Row>
                <p className={s.note}>{t("settings.noteScreenFx")}</p>
            </div>

            {/*
              ★★ `qualityTier`(품질 티어)는 2026-08-05 에 배선되면서 화면에 붙었다.
                그 전까지는 스토어에 저장되기만 하고 **읽는 코드가 한 줄도 없어서**
                일부러 감춰 두고 있었다 — 아무것도 하지 않는 스위치를 누른 사용자는
                "설정이 먹통"이라고 결론짓기 때문이다. 이제 표는
                `game/data/quality.json`, 배선은 `game/fx/quality.js` 다.
            */}
            <div className={s.group}>
                <h2 className={s.groupTitle}>{t("settings.groupQuality")}</h2>
                <Row label={t("settings.rowQuality")} hint={t("settings.hintQuality")}>
                    <Segment
                        settingKey="qualityTier"
                        value={qualityTier}
                        onChange={(v) => setSetting("qualityTier", v)}
                    />
                </Row>
                <p className={s.note}>{t("settings.noteQuality")}</p>
            </div>
        </>
    );
}

/* ═══════════════════════ 접근성 ═══════════════════════ */

function AccessSection() {
    const t = useT();
    const { language, colorBlindMode, textScale, hitStop, autoAdvanceSpeed, haptics } =
        useGameStore(
            useShallow((st) => ({
                language: st.settings.language,
                colorBlindMode: st.settings.colorBlindMode,
                textScale: st.settings.textScale,
                hitStop: st.settings.hitStop,
                autoAdvanceSpeed: st.settings.autoAdvanceSpeed,
                haptics: st.settings.haptics,
            }))
        );
    const setSetting = useGameStore((st) => st.setSetting);

    return (
        <>
            <div className={s.group}>
                <h2 className={s.groupTitle}>{t("settings.groupView")}</h2>
                {/*
                  ★★ **표시 언어가 '보기' 의 첫 줄이다** (2026-08-07).
                    글자를 읽을 수 있게 만드는 손잡이 셋 — 언어 · 색약 표기 · 글자 크기 —
                    이 한 자리에 모인다. 언어를 '일반' 같은 새 분류로 빼면 분류가
                    하나 더 늘고, 그 분류 이름 역시 읽어야 찾을 수 있다.
                  ★ 선택지(`한국어` / `English`)는 `game/data/settings.json:options.language`
                    가 준다. **두 언어 모두 endonym** 이라 어느 언어로 잘못 들어와도
                    돌아올 이름이 화면에 그대로 있다.
                */}
                <Row label={t("settings.rowLanguage")} hint={t("settings.hintLanguage")}>
                    <Segment
                        settingKey="language"
                        value={language}
                        onChange={(v) => setSetting("language", v)}
                    />
                </Row>
                <Row label={t("settings.rowColorBlind")} hint={t("settings.hintColorBlind")}>
                    <Toggle
                        value={colorBlindMode}
                        onChange={(v) => setSetting("colorBlindMode", v)}
                    />
                </Row>
                <Row label={t("settings.rowTextScale")} hint={t("settings.hintTextScale")}>
                    <Segment
                        settingKey="textScale"
                        value={textScale}
                        onChange={(v) => setSetting("textScale", v)}
                    />
                </Row>
                {/*
                  ★ 이 문장이 이 화면에서 가장 중요하다 (P9-04). 색약 모드는
                    "색을 바꾸는" 스위치가 아니라 **색으로만 주던 정보에 글자를 더하는**
                    스위치이며, 색으로만 주지 않는 것이 원칙이고 스위치는 보조다.
                    적 태그처럼 원래부터 형태로 구분되는 것은 이 스위치와 무관하다.
                */}
                {/* ★★ 예전에는 '항상' 만 `<b>` 로 감싸 문장이 셋으로 쪼개져 있었다.
                    영어는 어순이 달라 그 조각을 재배열할 수 없다 — 문장 전체가 한 키다. */}
                <p className={s.note}>{t("settings.noteColorBlind")}</p>
            </div>

            <div className={s.group}>
                <h2 className={s.groupTitle}>{t("settings.groupControl")}</h2>
                <Row label={t("settings.rowHitStop")} hint={t("settings.hintHitStop")}>
                    <Toggle value={hitStop} onChange={(v) => setSetting("hitStop", v)} />
                </Row>
                <Row label={t("settings.rowAutoSpeed")} hint={t("settings.hintAutoSpeed")}>
                    <Segment
                        settingKey="autoAdvanceSpeed"
                        value={autoAdvanceSpeed}
                        onChange={(v) => setSetting("autoAdvanceSpeed", v)}
                    />
                </Row>
                <Row label={t("settings.rowHaptics")} hint={t("settings.hintHaptics")}>
                    <Toggle value={haptics} onChange={(v) => setSetting("haptics", v)} />
                </Row>
            </div>

            <p className={s.note}>{t("settings.noteAccess")}</p>
        </>
    );
}

/* ═══════════════════════ 게임플레이 ═══════════════════════ */

function PlaySection() {
    const t = useT();
    const { battleSpeed, autoCommander } = useGameStore(
        useShallow((st) => ({
            battleSpeed: st.settings.battleSpeed,
            autoCommander: st.settings.autoCommander,
        }))
    );
    const setSetting = useGameStore((st) => st.setSetting);

    return (
        <div className={s.group}>
            <h2 className={s.groupTitle}>{t("settings.groupBattle")}</h2>
            <Row label={t("settings.rowBattleSpeed")} hint={t("settings.hintBattleSpeed")}>
                <Segment
                    settingKey="battleSpeed"
                    value={battleSpeed}
                    onChange={(v) => setSetting("battleSpeed", v)}
                />
            </Row>
            {/*
              ★★★ **이 스위치는 하는 것보다 적게 말하고 있었다** (2026-08-07 전수조사).
                이름이 "자동 지휘", 설명이 "지휘관 위치를 자동으로 잡습니다" 였는데
                실제로는 `BattleScene` 이 `autoPlayTick(sim)` 을 **opts 없이** 부른다 —
                이동뿐 아니라 **소환 · 주문**이 자동이고, `BattleScreen` 이 **각인
                3지선다까지** 자동으로 고르며, `moveCommanderTo` 가 조기 반환되어
                **플레이어가 지휘관을 손으로 옮길 수도 없다** (아무 피드백 없이).
                즉 전체 오토배틀이다. 위치만 자동인 줄 알고 켠 사람은 그 순간
                전투를 통째로 잃는다.
              ★ 고친 것은 **문구뿐**이다. 동작은 밸런스 하네스가 같은 함수를 쓰므로
                건드리지 않는다. 스토어 키(`autoCommander`)도 그대로다 —
                세이브 스키마를 문구 때문에 바꾸지 않는다.
            */}
            <Row label={t("settings.rowAutoCommander")} hint={t("settings.hintAutoCommander")}>
                <Toggle value={autoCommander} onChange={(v) => setSetting("autoCommander", v)} />
            </Row>
            <p className={s.note}>{t("settings.noteBattle")}</p>
            {/*
              ★ `summonMode` 도 노출하지 않는다 — 소환은 탭 · 탭 하나뿐이라 고를 것이 없다.
                지금 전투는 **두 방식을 동시에** 지원한다: 슬롯을 탭하면 자동 배치,
                끌어다 놓으면 그 레인. 즉 설정으로 고를 것이 없다. 배치 방식을
                하나로 강제하려면 BattleScene 의 입력 의미부터 바꿔야 하고,
                그건 이 티켓이 아니라 조작 설계의 문제다 (18-ux-ui.md §3).
            */}
        </div>
    );
}

/* ═══════════════════════ 데이터 ═══════════════════════ */

/**
 * 세이브 초기화.
 *
 * ★★ 2단계 확인이다. 1단계는 "정말?", 2단계는 **무엇을 잃는지 나열한 뒤** 확인.
 *   되돌릴 수 없는 동작에서 한 번의 오조작이 계정을 지우게 두지 않는다.
 *   두 단계를 다 통과하기 전에는 `resetSave()` 가 호출되지 않는다.
 */
/**
 * 광고 동의 철회·변경 — **UMP 가 요구할 때만 나타난다.**
 *
 * ★★★ GDPR 은 동의를 **준 것만큼 쉽게 철회**할 수 있어야 한다고 요구한다.
 *   2026-08-08 까지 이 앱에는 그 수단이 하나도 없었고, 그래서 개인정보
 *   처리방침 초안의 "설정에서 언제든 변경할 수 있습니다" 는 **거짓**이었다
 *   (`docs/06-release/56-admob-rewarded-integration.md` §4.5-A).
 *
 * ★ **지역으로 판정하지 않는다.** "EEA 면 보여 준다" 를 여기 적으면 그 목록이
 *   두 번째 출처가 되고, AdMob 콘솔의 메시지 설정이 바뀌어도 따라가지 못한다.
 *   답은 UMP 하나다 — `privacyOptionsRequired()` 가 그것을 중계한다.
 *   한국은 `NOT_REQUIRED` 라 **이 절이 아예 그려지지 않는다.**
 *
 * ★ `hidden` 이나 `disabled` 로 감추지 않고 **조건부 렌더**한다 (CLAUDE.md —
 *   `[hidden]` 은 작성자 스타일시트보다 약하고 `disabled` 는 포인터 이벤트를
 *   막지 못한다).
 */
function PrivacyOptionsGroup() {
    const t = useT();
    const [show, setShow] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let alive = true;
        // ★ initAds 는 멱등이다. 광고가 꺼져 있거나 웹이면 즉시 false 로 끝난다.
        initAds().then(() => {
            if (alive) setShow(privacyOptionsRequired());
        });
        return () => {
            alive = false;
        };
    }, []);

    if (!show) return null;

    return (
        <div className={s.group}>
            <h2 className={s.groupTitle}>{t("settings.groupAdPrivacy")}</h2>
            <p className={`${s.note} prose`}>{t("settings.noteAdPrivacy")}</p>
            <button
                className={`${s.btn} interactive`}
                disabled={busy}
                onClick={async () => {
                    if (busy) return; // ★ disabled 를 믿지 않는다 (CLAUDE.md)
                    hapticTap();
                    setBusy(true);
                    try {
                        await openPrivacyOptions();
                        // 철회했다면 입구 자체가 사라질 수 있다 — 다시 묻는다
                        setShow(privacyOptionsRequired());
                    } finally {
                        setBusy(false);
                    }
                }}
            >
                <ShieldCheck size={14} aria-hidden /> {t("settings.btnAdPrivacy")}
            </button>
        </div>
    );
}

function DataSection() {
    const t = useT();
    const [step, setStep] = useState(0);
    const [busy, setBusy] = useState(false);
    const resetSettings = useGameStore((st) => st.resetSettings);
    const navigate = useNavigate();

    const doReset = async () => {
        setBusy(true);
        await resetSave();
        // ★ 메모리 상태를 손으로 되돌리지 않고 재시작한다 (store/index.js resetSave 주석).
        window.location.reload();
    };

    return (
        <>
            {/*
              ★★ **타이틀로 나가는 문이 하나도 없었다** (2026-08-05, 사용자 제보 —
                "메인 화면으로 넘어가는 버튼이 없어").
                타이틀(`/`)은 **슬롯을 고르는 자리**다. 슬롯 3개를 만들어 놓고
                게임에 들어간 뒤에는 다른 슬롯으로 갈 방법이 없었다 — 앱을 껐다
                켜야 했다. 탭 바는 다섯 칸 고정이라 여기(설정)가 그 문의 자리다.
              ★ 진행도는 이미 저장돼 있다. 나가기 전에 한 번 더 밀어 넣는 이유는
                안드로이드에서 OS 가 언제 프로세스를 죽일지 모르기 때문이다
                (`App.jsx` 의 onPause 와 같은 이유).
            */}
            <div className={s.group}>
                <h2 className={s.groupTitle}>{t("settings.groupToTitle")}</h2>
                <p className={s.note}>{t("settings.noteToTitle")}</p>
                <button
                    className={`${s.btn} interactive`}
                    onClick={async () => {
                        hapticTap();
                        await flushSave();
                        navigate("/");
                    }}
                >
                    <LogOut size={14} aria-hidden /> {t("settings.btnToTitle")}
                </button>
            </div>

            {/*
              ★★ 진단 기록 (2026-08-05). 실기기에서 "게임이 멈춘다"를 겪는 사람에게
                개발자 도구는 없다 — 그가 우리에게 줄 수 있는 것은 화면에 보이는
                것뿐이고, 지금까지 그 화면에는 아무것도 없었다. 여기 숫자가 있으면
                그것이 그대로 재현 조건이 된다 (`utils/diagnostics.js` 머리말).
              ★ 배포 빌드에서도 보인다. 개발자 메뉴가 아니라 **사용자의 창**이다.
            */}
            <FaultLog />

            <PrivacyOptionsGroup />

            <div className={s.group}>
                <h2 className={s.groupTitle}>{t("settings.groupResetSettings")}</h2>
                <p className={s.note}>{t("settings.noteResetSettings")}</p>
                <button
                    className={`${s.btn} interactive`}
                    onClick={() => {
                        hapticTap();
                        resetSettings();
                    }}
                >
                    <RotateCcw size={14} aria-hidden /> {t("settings.btnResetSettings")}
                </button>
            </div>

            <div className={s.group}>
                <h2 className={s.groupTitle}>{t("settings.groupResetSave")}</h2>

                {step === 0 && (
                    <>
                        <p className={s.note}>{t("settings.noteResetSave")}</p>
                        <button
                            className={`${s.btn} ${s.btnDanger} interactive`}
                            onClick={() => setStep(1)}
                        >
                            {t("settings.btnResetSave")}
                        </button>
                    </>
                )}

                {step === 1 && (
                    <>
                        <div className={s.warnBox}>
                            <TriangleAlert size={14} aria-hidden />
                            <span>{t("settings.warnResetSave1")}</span>
                        </div>
                        <p className={s.note}>{t("settings.noteResetSave2")}</p>
                        <div className={s.seg}>
                            <button
                                className={`${s.btn} interactive`}
                                onClick={() => setStep(0)}
                            >
                                {t("common.cancel")}
                            </button>
                            <button
                                className={`${s.btn} ${s.btnDanger} interactive`}
                                onClick={() => setStep(2)}
                            >
                                {t("settings.btnUnderstood")}
                            </button>
                        </div>
                    </>
                )}

                {step === 2 && (
                    <>
                        <div className={s.warnBox}>
                            <TriangleAlert size={14} aria-hidden />
                            <span>{t("settings.warnResetSave2")}</span>
                        </div>
                        <div className={s.seg}>
                            <button
                                className={`${s.btn} interactive`}
                                disabled={busy}
                                onClick={() => setStep(0)}
                            >
                                {t("common.cancel")}
                            </button>
                            <button
                                className={`${s.btn} ${s.btnDanger} interactive`}
                                disabled={busy}
                                onClick={doReset}
                            >
                                {busy ? t("settings.erasing") : t("settings.btnErase")}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </>
    );
}

/* ═══════════════════════ 개발자 ═══════════════════════ */

/**
 * 개발 빌드에서만 보이는 진단 정보.
 *
 * ★★ 계측 대시보드는 2026-08-04 경량화로 통째로 사라졌다. 이 프로젝트에는 서버도
 *   외부 분석 SDK 도 없고, **아무 데도 보내지 않는 대시보드**를 유지할 이유가 없었다.
 */
function DevSection() {
    const t = useT();
    return (
        <>
            <div className={s.group}>
                <h2 className={s.groupTitle}>{t("settings.groupBuild")}</h2>
                <Row label={t("settings.rowBuildMode")} hint={t("settings.hintBuildMode")}>
                    <span className={s.pct}>
                        {import.meta.env.DEV ? t("settings.buildDev") : t("settings.buildProd")}
                    </span>
                </Row>
                <Row label={t("settings.rowSaveFormat")} hint={t("settings.hintSaveFormat")}>
                    <span className={s.pct}>v{SAVE_VERSION}</span>
                </Row>
            </div>
        </>
    );
}

/* ═══════════════════════ 라이선스 ═══════════════════════ */

function CreditsSection() {
    const t = useT();
    return (
        <>
            <div className={s.group}>
                <h2 className={s.groupTitle}>{t("settings.groupCredits")}</h2>
                {/*
                  ★ 크레딧 **본문**은 번역하지 않는다. `attributions.json` 은
                    `npm run docs:attributions` 가 읽는 생성 원본이고, 저작자 이름 ·
                    라이선스 문구는 **원문 그대로가 법적으로 옳다.** 그래서
                    `check:i18n` 도 이 파일을 I5 대상에서 빼 둔다.
                */}
                {ATTRIBUTIONS.intro.map((line) => (
                    <p key={line} className={s.note}>
                        · {stripMarkdown(line)}
                    </p>
                ))}
                <p className={s.note}>
                    {t("settings.creditsUpdated", { date: ATTRIBUTIONS.updated })}
                </p>
            </div>

            {ATTRIBUTIONS.sections.map((sec) => (
                <div key={sec.id} className={s.group}>
                    <h2 className={s.groupTitle}>{sec.title}</h2>
                    {sec.note && <p className={s.note}>· {sec.note}</p>}
                    <div className={s.credits}>
                        {sec.entries.length === 0 && (
                            <span className={s.empty}>{t("settings.creditsEmpty")}</span>
                        )}
                        {sec.entries.map((e) => (
                            <div key={e.name} className={s.creditRow}>
                                <span className={s.creditName}>{e.name}</span>
                                {e.author && (
                                    <span className={s.creditAuthor}>
                                        {e.url ? (
                                            <a
                                                className={`${s.creditLink} interactive`}
                                                href={e.url}
                                                target="_blank"
                                                rel="noreferrer noopener"
                                            >
                                                {e.author}
                                            </a>
                                        ) : (
                                            e.author
                                        )}
                                    </span>
                                )}
                                {e.note && <span className={s.creditNote}>{e.note}</span>}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </>
    );
}

/**
 * intro 문장은 마크다운 문서에도 그대로 들어가므로 백틱이 섞여 있다.
 * ★ 화면에서는 코드 표기가 의미가 없으니 벗겨서 보여준다 —
 *   문구를 JSON 에 두 벌 유지하는 것보다 이쪽이 단일 출처를 지킨다.
 */
function stripMarkdown(text) {
    return text.replaceAll("`", "");
}
