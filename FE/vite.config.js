import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
    plugins: [react()],

    // ★ Capacitor 의 file:// 유사 오리진에서 절대 경로는 깨진다. 반드시 상대 경로.
    base: "./",

    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
    },

    define: {
        // public/ 은 Vite 가 해시를 붙이지 않으므로 빌드 스탬프로 캐시를 무효화한다.
        // Capacitor 는 dist 를 앱에 동봉하므로 지금은 큰 의미가 없지만,
        // OTA 업데이트를 도입하면 필수가 된다.
        __ASSET_VERSION__: JSON.stringify(Date.now().toString(36)),
    },

    build: {
        /**
         * 청크 분리 (P9-05).
         *
         * ★ **목적은 총량 감소가 아니라 캐시 수명 분리다.** gzip 총합은 오히려 조금
         *   늘어난다(청크 경계마다 압축 사전이 끊긴다). 얻는 것은 이것이다:
         *   Phaser 1.4MB 는 우리가 고치는 파일이 아니므로, 게임 코드를 고쳐 배포해도
         *   재다운로드되지 않아야 한다. 한 덩어리면 한 줄만 고쳐도 2.2MB 가 전부 무효가 된다.
         *   Capacitor 는 dist 를 앱에 동봉하므로 지금 이득은 **OTA 업데이트 때** 나타난다.
         *
         * ★ **동기 import 를 청크로 쪼갠다고 콜드 스타트가 빨라지지는 않는다.**
         *   Vite 가 `modulepreload` 를 넣으므로 첫 화면에서 전부 받는다. 실제로
         *   덜 받으려면 라우트를 `React.lazy` 로 **동적 import** 해야 한다 —
         *   그 변경은 `src/router/index.jsx` 소유자의 몫이다 (측정치는 실행 계획 노트에).
         *
         * ★ Phaser 를 lazy 로 만들지 않는다. 캔버스는 라우트와 무관하게 항상 마운트되는
         *   것이 이 앱의 구조다 (CLAUDE.md). 첫 화면부터 필요하므로 지연 로드 대상이 아니다.
         */
        rollupOptions: {
            output: {
                manualChunks(id) {
                    // ★ Windows 경로 구분자에 걸리지 않게 정규화한다.
                    const p = id.replace(/\\/g, "/");
                    if (!p.includes("/node_modules/")) return undefined;
                    if (/\/node_modules\/phaser\//.test(p)) return "phaser";
                    if (/\/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(p)) {
                        return "react";
                    }
                    return undefined;
                },
            },
        },
        /**
         * ★ Phaser 청크(약 1.4MB)는 우리가 줄일 수 있는 대상이 아니다. 500kB 경고를
         *   그대로 두면 매 빌드마다 "고칠 수 없는 경고"가 뜨고, 그런 경고는 곧
         *   전부 무시된다. 예산은 `32-definition-of-done.md` §3.3-b (gzip ≤ 1.6MB) 가 지킨다.
         */
        chunkSizeWarningLimit: 1500,
    },

    test: {
        // ★ 시뮬레이션이 Phaser·DOM 을 import 하지 않으므로 순수 Node 환경이면 충분하다.
        //   canvas 도, jsdom 도, 모킹도 필요 없다.
        environment: "node",
        include: ["src/**/*.test.js"],
        coverage: {
            provider: "v8",
            include: ["src/game/logic/**"],
            thresholds: { lines: 85, functions: 85, branches: 75 },
        },
    },
});
