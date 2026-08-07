import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
    // 빌드 산출물과 네이티브 플랫폼 폴더는 검사하지 않는다.
    // android/ios 안에는 cap sync 로 복사된 dist 번들이 들어 있다.
    globalIgnores([
        "dist",
        "android",
        "ios",
        "node_modules",
        "public/assets",
        "asset",
        "coverage",
    ]),

    {
        files: ["**/*.{js,jsx}"],
        extends: [
            js.configs.recommended,
            reactHooks.configs.flat.recommended,
            reactRefresh.configs.vite,
        ],
        languageOptions: {
            ecmaVersion: 2022,
            globals: globals.browser,
            parserOptions: {
                ecmaVersion: "latest",
                ecmaFeatures: { jsx: true },
                sourceType: "module",
            },
        },
        rules: {
            "no-unused-vars": ["error", { varsIgnorePattern: "^[A-Z_]" }],
        },
    },

    /* ──────────────────────────────────────────────────────────────
     * ★ 시뮬레이션 격리 (docs/03-tech/22-simulation-spec.md §1)
     *
     * src/game/logic/ 은 Phaser 를 모르고, 실시간을 모르고, 비결정적
     * 난수를 쓰지 않는다. 여기서 결정론 · 밸런스 자동검증 · 리플레이 ·
     * 백그라운드 복귀 안전성이 전부 나온다.
     * 이 규칙들은 리뷰가 아니라 린트로 강제한다.
     * ────────────────────────────────────────────────────────────── */
    {
        files: ["src/game/logic/**/*.js"],
        ignores: ["src/game/logic/**/*.test.js"],
        languageOptions: {
            // 브라우저 전역을 아예 주지 않는다 — window/document 사용이 곧 에러가 된다.
            globals: {},
        },
        rules: {
            "no-restricted-imports": [
                "error",
                {
                    patterns: [
                        {
                            group: ["phaser", "@/game/scenes/*", "@/game/presenters/*", "@/store*"],
                            message:
                                "src/game/logic/ 은 순수 시뮬레이션입니다. Phaser·씬·스토어를 import 할 수 없습니다.",
                        },
                    ],
                },
            ],
            "no-restricted-globals": [
                "error",
                { name: "window", message: "시뮬레이션은 DOM 에 접근하지 않습니다." },
                { name: "document", message: "시뮬레이션은 DOM 에 접근하지 않습니다." },
                { name: "navigator", message: "시뮬레이션은 브라우저 API 를 쓰지 않습니다." },
                { name: "performance", message: "시뮬 시간은 state.t 를 사용하세요." },
                { name: "localStorage", message: "시뮬레이션은 저장소에 접근하지 않습니다." },
            ],
            "no-restricted-properties": [
                "error",
                {
                    object: "Math",
                    property: "random",
                    message:
                        "결정론이 깨집니다. state.rng.<stream>() 시드 PRNG 를 사용하세요 (logic/rng.js).",
                },
                {
                    object: "Date",
                    property: "now",
                    message: "결정론이 깨집니다. state.t 를 사용하세요.",
                },
            ],
            "no-restricted-syntax": [
                "error",
                {
                    selector: "NewExpression[callee.name='Date']",
                    message: "결정론이 깨집니다. state.t 를 사용하세요.",
                },
            ],
        },
    },

    /* ──────────────────────────────────────────────────────────────
     * ★ 렌더 루프 안티패턴 (docs/03-tech/21-state-management.md §3.4,
     *   docs/03-tech/26-performance-budget.md §13)
     *
     * update() 는 초당 60회 실행된다. 여기서의 배열 생성과 스토어 쓰기가
     * GC 스터터와 React 렌더 폭풍의 1순위 원인이다.
     * ────────────────────────────────────────────────────────────── */
    {
        files: ["src/game/scenes/**/*.js", "src/game/presenters/**/*.js"],
        rules: {
            "no-restricted-syntax": [
                "error",
                {
                    selector:
                        "MethodDefinition[key.name='update'] CallExpression[callee.property.name=/^(filter|map|reduce|flatMap|concat|slice)$/]",
                    message:
                        "update() 안에서 배열을 생성하지 마세요 (초당 60회 = GC 스터터). 사전 할당된 배열을 재사용하세요.",
                },
                {
                    selector:
                        "MethodDefinition[key.name='update'] CallExpression[callee.object.name='gameStore'][callee.property.name='set']",
                    message:
                        "update() 에서 직접 set() 하지 마세요 (초당 60회 setState = 렌더 폭풍). throttledSync() 를 사용하세요.",
                },
                {
                    selector:
                        "MethodDefinition[key.name='update'] CallExpression[callee.object.property.name='console']",
                    message: "update() 안에서 로깅하지 마세요 (초당 60회).",
                },
            ],
        },
    },

    /* ──────────────────────────────────────────────────────────────
     * UI — 아이콘 정책 (docs/02-design/19-art-audio-direction.md §5.2)
     *
     * 아이콘은 lucide-react 또는 <GameIcon> 두 곳에서만 온다.
     * 이모지·기호 글리프는 기기·OS마다 글리프가 다르고(일부 기기에서는 두부 □)
     * 크기·색·정렬을 제어할 수단이 없다. 게임 톤과도 무관하게 렌더된다.
     *
     * ★ 주석·문서 문자열의 ★ 는 잡지 않는다 — JSX 텍스트와 문자열 리터럴만 본다.
     * ────────────────────────────────────────────────────────────── */
    /* Phaser 프레젠터 — 화면에 그려지는 문자열에도 같은 규칙이 적용된다.
       ★ 1차 적용 때 `.jsx` 만 걸어서 `EnemyBadges.js` 의 이모지 태그 배지를
         놓쳤다. 게임에서 가장 중요한 상성 표기가 이모지였다. */
    {
        files: ["src/game/presenters/**/*.js", "src/game/scenes/**/*.js", "src/hud/**/*.js"],
        // ★ 테스트는 아무것도 렌더하지 않는다. 이 규칙이 막으려는 것은 **화면에
        //   그려지는 문자열**이고, 테스트 이름의 ★ 는 그 대상이 아니다
        //   (logic 격리 규칙이 테스트를 제외하는 것과 같은 이유).
        ignores: ["src/game/**/*.test.js", "src/hud/**/*.test.js"],
        rules: {
            "no-restricted-syntax": [
                "error",
                {
                    selector:
                        "Literal[value=/[\\u2300-\\u23FF\\u25A0-\\u27BF\\u2B00-\\u2BFF\\uD83C-\\uD83E]/]",
                    message:
                        "화면에 이모지·글리프를 그리지 마세요. UI 아틀라스 프레임(ui/tag-*, ui/star-* 등)을 쓰세요 (19-art-audio-direction.md §5.2).",
                },
            ],
        },
    },

    {
        files: ["src/**/*.jsx"],
        rules: {
            "no-restricted-syntax": [
                "error",
                {
                    selector:
                        "JSXText[value=/[\\u2190-\\u21FF\\u2300-\\u23FF\\u25A0-\\u27BF\\u2B00-\\u2BFF\\uD83C-\\uD83E]/]",
                    message:
                        "아이콘을 이모지·글리프로 넣지 마세요. 시스템 UI 는 lucide-react, 게임 세계관 아이콘은 <GameIcon name=\"...\" /> 입니다 (19-art-audio-direction.md §5.2).",
                },
                {
                    selector:
                        "JSXAttribute[name.name=/^(title|placeholder|aria-label)$/] Literal[value=/[\\u2190-\\u21FF\\u2300-\\u23FF\\u25A0-\\u27BF\\u2B00-\\u2BFF\\uD83C-\\uD83E]/]",
                    message:
                        "아이콘을 이모지·글리프로 넣지 마세요 (19-art-audio-direction.md §5.2).",
                },
            ],
        },
    },

    // Node 전용 스크립트 (에셋 패킹, 밸런스 하네스 등)
    {
        files: ["tools/**/*.{js,mjs}", "*.config.js"],
        languageOptions: { globals: globals.node },
        rules: { "no-console": "off" },
    },

    // 테스트
    {
        files: ["src/**/*.test.js"],
        languageOptions: { globals: { ...globals.node } },
    },
]);
