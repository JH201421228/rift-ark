/**
 * P9-04 — 접근성 검사의 검사
 *
 * ★★ **"고쳤다"가 아니라 "되돌리면 깨진다"를 만든다.**
 *   검사기가 통과한다는 사실만으로는 아무것도 증명되지 않는다 — 아무것도 검사하지
 *   않는 검사기도 통과한다. 그래서 여기서는 **실제 저장소 소스를 읽어 P9-04 이전
 *   상태로 한 곳씩 되돌리고**, 검사기가 그 위반을 잡는지 확인한다.
 *   되돌리는 내용은 상상이 아니라 **실제로 있었던 코드**다:
 *     · `this.cameras.main.fade(600, 40, 8, 16)`      (BattleScene, 패배 암전)
 *     · `zoomPulse` 가 shakeScale 을 보지 않던 상태     (CameraFx)
 *     · `style={{ color: var(--rarity-l) }}`           (편성·동료·도감·프리뷰)
 *     · `{ ARMORED: "장갑", WARDED: "마법저항", … }`    (BattleResult, BossPresenter)
 *     · `root.dataset.colorblind` 를 아무 CSS 도 읽지 않던 상태
 *
 * ★ 픽스처를 손으로 쓰지 않는다. 진짜 파일을 읽어 한 군데만 바꾼다.
 *   가짜 픽스처는 실제 파일 모양이 바뀌면 조용히 무의미해진다.
 *
 * @see tools/check-a11y.mjs
 * @see docs/02-design/18-ux-ui.md §6
 */
import { describe, it, expect, beforeAll } from "vitest";
import {
    analyze,
    loadProject,
    parseWiringTables,
    stripComments,
    CAMERA_GATE,
    SETTINGS_JSON,
    SETTINGS_SLICE,
    SETTINGS_SCREEN,
    APP_FILE,
    RARITY_CSS,
    LABELS_FILE,
    MIN_FONT_PX,
} from "../../tools/check-a11y.mjs";

let project;

/** 원본 소스를 복제한 뒤 파일 하나만 바꿔서 검사기를 돌린다. */
function withEdit(file, edit) {
    const sources = new Map(project.sources);
    const before = sources.get(file);
    expect(before, `${file} 이 없다`).toBeTruthy();
    const after = edit(before);
    expect(after, `${file} 을 실제로 바꾸지 못했다 — 검사가 아무것도 증명하지 않는다`).not.toBe(
        before
    );
    sources.set(file, after);
    return analyze(sources, project.rules);
}

beforeAll(async () => {
    project = await loadProject();
});

describe("접근성 — 현재 저장소", () => {
    it("위반이 없다", () => {
        expect(analyze(project.sources, project.rules).errors).toEqual([]);
    });

    it("경고도 없다 (규칙 목록을 전부 실제 모듈에서 읽었다)", () => {
        expect(analyze(project.sources, project.rules).warnings).toEqual([]);
    });

    it("규칙 모듈에서 읽은 목록이 비어 있지 않다 — 빈 목록은 '검사 안 함'이다", () => {
        expect(project.rules.tagNames.length).toBeGreaterThan(0);
        expect(project.rules.damageTypes.length).toBeGreaterThan(0);
        // ★ `notifyKeys` 는 2026-08-04 경량화로 비었다 — 알림 시스템이 사라졌다.
        //   배선은 남아 있고, 목록 렌더 설정이 다시 생기면 그때 채운다.
        expect(Array.isArray(project.rules.notifyKeys)).toBe(true);
    });
});

describe("M1 — 화면 흔들림 설정이 닿지 않는 경로", () => {
    it("씬이 카메라 연출을 직접 부르면 잡는다 (실제로 있던 패배 암전)", () => {
        const r = withEdit("src/game/scenes/BattleScene.js", (s) =>
            s.replace(
                "this.cameraFx.fadeOut(600, 40, 8, 16);",
                "this.cameras.main.fade(600, 40, 8, 16);"
            )
        );
        expect(r.errors.join("\n")).toMatch(/M1 .*BattleScene\.js.*cameras\.main\.fade/);
    });

    it("프레젠터가 셰이크를 직접 부르면 잡는다", () => {
        const r = withEdit("src/game/presenters/BossPresenter.js", (s) =>
            s.replace("this.cameraFx?.shake?.(5, 220);", "this.scene.cameras.main.shake(220, 0.01);")
        );
        expect(r.errors.join("\n")).toMatch(/M1 .*BossPresenter\.js.*cameras\.main\.shake/);
    });

    it("줌 펄스가 shakeScale 을 보지 않으면 잡는다 (P9-04 이전 상태)", () => {
        const r = withEdit(CAMERA_GATE, (s) =>
            s.replace(
                "        if (this.shakeScale <= 0) return;\n        const scaled = 1 + (to - 1) * this.shakeScale;\n        this.cam.zoomTo(this._baseZoom * scaled",
                "        this.cam.zoomTo(this._baseZoom * to"
            )
        );
        expect(r.errors.join("\n")).toMatch(/M1 .*zoomPulse\(\) 가 shakeScale/);
    });

    it("섬광이 shakeScale 을 보지 않으면 잡는다 (P9-04 이전 상태)", () => {
        const r = withEdit(CAMERA_GATE, (s) =>
            s.replace(
                "        if (this.shakeScale <= 0) return;\n        const ms = Math.round(durationMs * this.shakeScale);\n        this.cam.flash(ms,",
                "        const ms = durationMs;\n        this.cam.flash(ms,"
            )
        );
        expect(r.errors.join("\n")).toMatch(/M1 .*damageFlash\(\) 가 shakeScale/);
    });

    it("관문 파일 자체가 사라지면 조용히 통과하지 않는다", () => {
        const sources = new Map(project.sources);
        sources.delete(CAMERA_GATE);
        expect(analyze(sources, project.rules).errors.join("\n")).toMatch(/M1 .*관문/);
    });

    it("뷰포트 배치(setZoom · setScroll)는 잡지 않는다 — 연출이 아니다", () => {
        // ★ 거짓 양성이 하나라도 나오면 검사기는 곧 무시된다.
        expect(analyze(project.sources, project.rules).errors.join("\n")).not.toMatch(/viewport/);
    });
});

describe("A1 — 설정 키와 배선표", () => {
    it("배선표에 없는 설정을 추가하면 잡는다", () => {
        const r = withEdit(SETTINGS_JSON, (s) =>
            s.replace('"screenShake": 1,', '"screenShake": 1,\n        "ghostSetting": true,')
        );
        expect(r.errors.join("\n")).toMatch(/A1 .*ghostSetting.*배선표에 없다/);
    });

    it("설정을 지웠는데 배선표에 남으면 잡는다", () => {
        const r = withEdit(SETTINGS_JSON, (s) => s.replace('"hitStop": true,\n', ""));
        expect(r.errors.join("\n")).toMatch(/A1 배선표에 있는 `hitStop`/);
    });

    it("배선되어 있다는 설정이 화면에 없으면 잡는다", () => {
        const r = withEdit(SETTINGS_SCREEN, (s) => s.replaceAll("hitStop", "hitStop_"));
        expect(r.errors.join("\n")).toMatch(/A1 `hitStop` 는 배선되어 있다고/);
    });

    it("아무것도 하지 않는 설정을 화면에 노출하면 잡는다", () => {
        /**
         * ★ `summonMode` 는 아직 아무 코드도 읽지 않는다 — 그래서 화면에 없다.
         * ★★ 여기 있던 예시는 `qualityTier` 였는데 **2026-08-05 에 배선되어**
         *   위 표로 옮겨 갔다. 배선된 키로 이 검사를 계속 쓰면 테스트가
         *   "노출하면 안 되는 키"를 잘못 가르친다.
         */
        const r = withEdit(SETTINGS_SCREEN, (s) =>
            s.replace('settingKey="effectIntensity"', 'settingKey="summonMode"')
        );
        expect(r.errors.join("\n")).toMatch(/A1 `summonMode` 는 .*표에 있는데/);
    });

    /**
     * ★ 목록 렌더 배선(`notifyKeys`)은 알림 시스템과 함께 비었지만 **경로는 살아 있다.**
     *   가짜 키로 "리터럴이 없어도 노출로 센다"가 여전히 참인지 확인한다 —
     *   이 경로가 죽으면 다음에 목록 렌더 설정을 만드는 사람이 이유 없이 막힌다.
     */
    it("목록 렌더 설정은 리터럴이 없어도 노출로 센다", () => {
        const NL = String.fromCharCode(10);
        const src = new Map(project.sources);
        src.set(
            SETTINGS_JSON,
            src.get(SETTINGS_JSON).replace(
                '"hitStop": true,',
                '"hitStop": true,' + NL + '        "ghostLoop": true,'
            )
        );
        const row = " * | haptics                | App → setHapticsEnabled |";
        src.set(
            SETTINGS_SLICE,
            src.get(SETTINGS_SLICE).replace(row, row + NL + " * | ghostLoop              | 목록 렌더 |")
        );
        expect(analyze(src, { ...project.rules, notifyKeys: [] }).errors.join(NL)).toMatch(
            /A1 `ghostLoop` 는 배선되어 있다고/
        );
        expect(
            analyze(src, { ...project.rules, notifyKeys: ["ghostLoop"] }).errors.join(NL)
        ).not.toMatch(/A1 `ghostLoop`/);
    });

    it("배선표 모양이 바뀌어 파싱이 깨지면 조용히 통과하지 않는다", () => {
        const r = withEdit(SETTINGS_SLICE, (s) => s.replace("아직 아무도 읽지 않는 키", "메모"));
        expect(r.errors.join("\n")).toMatch(/A1 .*표식을 찾지 못했다/);
    });
});

describe("A2 — 색약 스위치가 살아 있는가", () => {
    it("세우기만 하고 읽는 CSS 가 없으면 잡는다 (P9-04 이전 상태)", () => {
        const r = withEdit(RARITY_CSS, (s) =>
            s.replaceAll(':root[data-colorblind="on"]', ".neverOn")
        );
        expect(r.errors.join("\n")).toMatch(/A2 .*스위치가 죽어 있다/);
    });

    it("App 이 속성을 세우지 않으면 잡는다", () => {
        const r = withEdit(APP_FILE, (s) =>
            s.replace("root.dataset.colorblind =", "const unusedColorblind =")
        );
        expect(r.errors.join("\n")).toMatch(/A2 .*세우지 않는다/);
    });
});

describe("A3 — 등급을 색으로만 표시하는가", () => {
    it("화면이 등급 색을 인라인 스타일로 쓰면 잡는다 (P9-04 이전 상태)", () => {
        const r = withEdit("src/screens/LoadoutScreen.jsx", (s) =>
            s.replace(
                "<RarityName rarity={u.rarity}>",
                "<b style={{ color: `var(--rarity-l)` }}>" // 되돌린 모양
            )
        );
        expect(r.errors.join("\n")).toMatch(/A3 .*LoadoutScreen\.jsx.*인라인 스타일/);
    });

    it("새 CSS 모듈이 등급 색을 쓰면 잡는다", () => {
        const r = withEdit("src/screens/Meta.module.css", (s) =>
            s.replace(".empty {", ".empty {\n    color: var(--rarity-l);")
        );
        expect(r.errors.join("\n")).toMatch(/A3 src\/screens\/Meta\.module\.css/);
    });

    it("팔레트 선언(index.css)은 잡지 않는다 — 선언은 결함이 아니다", () => {
        expect(analyze(project.sources, project.rules).errors.join("\n")).not.toMatch(
            /A3 src\/index\.css/
        );
    });
});

describe("A4 — 최소 글자 크기", () => {
    it(`${MIN_FONT_PX}px 미만을 잡는다`, () => {
        const r = withEdit("src/hud/Hud.module.css", (s) =>
            s.replace("font-size: 10px;", "font-size: 9px;")
        );
        expect(r.errors.join("\n")).toMatch(/A4 .*Hud\.module\.css.*9px/);
    });
});

describe("A5 — 이름 사본", () => {
    it("태그 이름 표를 화면이 다시 들면 잡는다 (실제로 갈라져 있던 모양)", () => {
        const r = withEdit("src/screens/BattleResult.jsx", (s) =>
            s.replace(
                "const TAG_INFO = {",
                'const TAG_LABEL = { ARMORED: "장갑", WARDED: "마법저항", CORRUPT: "오염" };\nconst TAG_INFO = {'
            )
        );
        expect(r.errors.join("\n")).toMatch(/A5 .*BattleResult\.jsx.*태그 이름 표/);
    });

    it("프레젠터가 태그 이름을 다시 들어도 잡는다", () => {
        const r = withEdit("src/game/presenters/BossPresenter.js", (s) =>
            s.replace(
                "const BAR_W = 300;",
                'const TAG_LABEL = { ARMORED: "장갑", WARDED: "마법저항", FLYING: "비행" };\nconst BAR_W = 300;'
            )
        );
        expect(r.errors.join("\n")).toMatch(/A5 .*BossPresenter\.js/);
    });

    it("데미지 타입 이름 사본도 잡는다 (편성 화면에 있던 DMG_LABEL)", () => {
        /**
         * ★ 2026-08-07 i18n — 편성 화면은 더 이상 `DMG_TYPE_LABEL_KO` 를 지역 상수로
         *   받지 않는다 (`t("terms.dmg.physical")` 로 부른다). 그래서 되돌릴 **줄**이
         *   사라졌고, 대신 **표를 새로 심는다** — 검사기가 지키는 명제는 "그 줄이
         *   있는가" 가 아니라 **"화면이 이름 표를 직접 들면 잡는가"** 다.
         *   앵커는 파일 구조가 바뀌어도 남는 자리(기본 export 선언)를 쓴다.
         */
        const r = withEdit("src/screens/LoadoutScreen.jsx", (s) =>
            s.replace(
                "export default function LoadoutScreen() {",
                'const DMG_LABEL = { physical: "물리", arcane: "술식", holy: "신성" };\n' +
                    "export default function LoadoutScreen() {"
            )
        );
        expect(r.errors.join("\n")).toMatch(/A5 .*LoadoutScreen\.jsx.*데미지 타입/);
    });

    it("단일 출처 파일 자신은 잡지 않는다", () => {
        expect(analyze(project.sources, project.rules).errors.join("\n")).not.toMatch(
            new RegExp(`A5 ${LABELS_FILE.replace(/\//g, "\\/")}`)
        );
    });

    it("주석에 적힌 예시 표는 잡지 않는다", () => {
        // ★ labels.js 상단 주석에 갈라졌던 이름들이 표로 적혀 있다. 그것이 위반으로
        //   잡히면 "결함을 설명하면 검사기가 화낸다"가 되어 아무도 설명을 안 쓴다.
        const r = withEdit("src/game/logic/tags.js", (s) =>
            s.replace(
                "export const TAG = {",
                '// ARMORED: "장갑", WARDED: "마법저항", CORRUPT: "오염"\nexport const TAG = {'
            )
        );
        expect(r.errors.join("\n")).not.toMatch(/A5 .*tags\.js/);
    });
});

describe("보조 함수", () => {
    it("배선표 두 개를 나눠 읽는다", () => {
        const t = parseWiringTables(project.sources.get(SETTINGS_SLICE));
        expect(t.ok).toBe(true);
        expect(t.wired).toContain("screenShake");
        // ★ 2026-08-05 배선 — 옮겨 간 키가 양쪽 표에 동시에 있으면 안 된다
        expect(t.wired).toContain("qualityTier");
        expect(t.deferred).not.toContain("qualityTier");
        expect(t.deferred).toContain("summonMode");
        expect(t.wired).not.toContain("summonMode");
    });

    it("주석을 지운 뒤에 스캔한다", () => {
        expect(stripComments("// cameras.main.shake(1)\nconst a = 1;")).not.toMatch(/shake/);
        expect(stripComments("/* cameras.main.flash() */\nconst a = 1;")).not.toMatch(/flash/);
    });
});
