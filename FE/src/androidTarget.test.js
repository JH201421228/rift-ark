/**
 * 안드로이드 대상 API 수준 — **Play 의 마감은 매년 온다**
 *
 * ★★★ 2026-08-08 에 Play Console 이 경고를 띄웠다:
 *
 *   "2026년 8월 31일부터 최신 Android 출시로부터 1년 이내의 대상 API 수준을
 *    타겟팅하지 않는 경우 앱을 **업데이트할 수 없습니다.**"
 *
 *   ⚠ **막히는 것은 신규 등록이 아니라 업데이트다.** 이미 출시한 앱도 그날부터
 *   새 버전을 올릴 수 없다 — 버그를 고쳐도 배포할 방법이 없어진다.
 *
 * ★★ 이 검사가 없으면 무엇이 조용한가: `targetSdkVersion` 은 `variables.gradle`
 *   한 줄이고, 낮춰도 **빌드가 성공한다.** 실패는 몇 달 뒤 Play 업로드에서 나고,
 *   그때는 이미 출시된 뒤다. 그래서 값 하나를 여기서 붙잡아 둔다.
 *
 * ★ 이 검사는 **매년 갱신되어야 한다.** 다음 상향(예상: 2027년 8월, API 37)이
 *   오면 `REQUIRED` 를 올리고 이 머리말의 날짜를 함께 고친다. 검사가 낡으면
 *   통과가 거짓말이 된다.
 *
 * @see docs/06-release/50-google-play-paid-codemagic.md
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Play 가 요구하는 최소 대상 API — 2026-08-31 부터 **36**(Android 16) */
const REQUIRED = 36;

const GRADLE = fileURLToPath(new URL("../android/variables.gradle", import.meta.url));

/** `ext { ... }` 안의 `name = 숫자` 를 읽는다. */
function readInt(src, name) {
    const m = src.match(new RegExp(`^\\s*${name}\\s*=\\s*(\\d+)`, "m"));
    return m ? Number(m[1]) : NaN;
}

describe("안드로이드 대상 API 수준", () => {
    const src = readFileSync(GRADLE, "utf8");

    it("★★★ Play 요구치를 만족한다 — 낮으면 앱을 업데이트할 수 없다", () => {
        const target = readInt(src, "targetSdkVersion");
        expect(Number.isFinite(target), "variables.gradle 에서 targetSdkVersion 을 못 읽었다").toBe(
            true
        );
        expect(
            target,
            `targetSdkVersion 이 ${target} 다. Play 는 2026-08-31 부터 ${REQUIRED} 이상을 요구하며, ` +
                "미달이면 **새 버전을 올릴 수 없다**(신규 등록이 아니라 업데이트가 막힌다)"
        ).toBeGreaterThanOrEqual(REQUIRED);
    });

    it("★ compileSdk 가 targetSdk 보다 낮지 않다", () => {
        // 낮은 compileSdk 로 높은 target 을 선언하면 새 API 를 컴파일 단계에서 볼 수 없고,
        // AGP 는 그것을 경고 없이 통과시킨다.
        expect(readInt(src, "compileSdkVersion")).toBeGreaterThanOrEqual(
            readInt(src, "targetSdkVersion")
        );
    });

    it("minSdk 는 그대로 둔다 — 올리면 쓸 수 있는 기기가 줄어든다", () => {
        // Play 는 minSdk 를 강제하지 않는다. 여기서 재는 것은 '실수로 올라가지 않았는가' 다.
        expect(readInt(src, "minSdkVersion")).toBeLessThanOrEqual(23);
    });
});
