/**
 * 씬 등록부
 *
 * 배열의 첫 씬이 자동으로 시작된다.
 * 부팅 체인: Boot → Preload → **Ark**
 *
 * ★★ **`MenuScene` 을 삭제했다 (2026-08-04).** 그것은 P1 파이프라인 검증용
 *   쇼케이스였다 — 유닛 11체를 늘어놓고 "P1 파이프라인 검증 · 아틀라스 5종
 *   로드됨" 이라고 적어 두는 화면. 부팅 뒤의 **기본 씬**이었고, 씬을 바꾸는
 *   화면은 방주와 전투뿐이라 **출격 · 편성 · 동료 · 설정에서는 그 검증 화면이
 *   UI 뒤에 계속 떠 있었다.** 사용자가 "뒷 화면에 이상한 게 보인다"고 지적한 것이
 *   정확히 이것이다.
 *
 * ★ 전투 밖의 쉬는 자리는 이제 **`ArkScene` 하나**다 (빈 씬).
 *   같은 일을 하는 빈 씬을 둘 두면 다음 사람이 어느 쪽을 고쳐야 할지 모른다.
 *
 * @see docs/03-tech/20-architecture.md §6
 */
import { BootScene } from "./BootScene.js";
import { PreloadScene } from "./PreloadScene.js";
import { ArkScene } from "./ArkScene.js";
import { BattleScene } from "./BattleScene.js";

export const SCENES = [BootScene, PreloadScene, ArkScene, BattleScene];

/**
 * ★★★ **`DebugScene` 은 이 목록에 없다 — 일부러 그렇다** (2026-08-05).
 *
 *   처음에는 여기에 `import { DebugScene }` 을 두고
 *   `import.meta.env.DEV ? [...CORE, DebugScene] : CORE` 로 갈랐다.
 *   **그런데 배포 번들에 그대로 남았다** (실측: `dist/assets/index-*.js` 안에
 *   `key:"Debug"` 와 오버레이 문구 전체). 삼항은 접혔지만 롤업이 **모듈을 못 지운다** —
 *   `class DebugScene extends Phaser.Scene` 의 상위 클래스가 멤버 접근식이라
 *   게터일 수 있고, 그래서 클래스 선언 자체가 "부수효과 있음"으로 남기 때문이다.
 *
 *   **정적 import 가 하나라도 있으면 트리셰이킹은 보장되지 않는다.**
 *   지우는 유일한 확실한 방법은 **DEV 가지 안의 동적 import** 다 —
 *   가지가 접히면 import 표현식째로 사라지고, 그러면 그 모듈을 부르는 곳이
 *   0곳이 되어 청크가 아예 만들어지지 않는다. 등록은 `GameManager` 가 한다.
 *
 *   이 실패는 소스만 봐서는 알 수 없다. `npm run check:prod` 가 dist 를 실제로 연다.
 */

/**
 * 다른 씬 위에 **겹쳐 떠 있어도 되는** 씬 키.
 *
 * ★ `GameManager.enforceDesiredScene()` 은 원하는 씬 하나만 남기고 전부 멈춘다
 *   (겹쳐 뜨는 화면 사고를 막는 규율이다 — `MenuScene` 삭제 사유 참조).
 *   오버레이는 그 규율의 **예외**이고, 예외는 목록으로 명시한다.
 *
 * ★ 여기 있는 것은 **문자열뿐**이다. 씬 클래스를 참조하면 위의 문제가 되돌아온다.
 */
export const OVERLAY_SCENES = import.meta.env.DEV ? ["Debug"] : [];
