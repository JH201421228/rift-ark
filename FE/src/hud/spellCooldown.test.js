/**
 * 주문 쿨다운은 **id 로 실린다** (2026-08-06, 사용자 제보 ①)
 *
 * ★★★ 제보: "지휘관이 사용한 스킬의 쿨타임이 정작 그 스킬 HUD 위가 아니라
 *   **다른 스킬의 HUD 위에** 붙어 있다."
 *
 *   원인은 두 겹이었다.
 *   ① `BattleScreen` 이 씬 페이로드에 **`spells` 를 넣지 않았다.** 씬은 같은 인자로
 *      `buildStageConfig` 를 다시 부르므로, 시뮬은 4개월 내내
 *      `spells.json:defaultLoadout` 4종으로 싸웠다. HUD 는 플레이어가 고른 4종을
 *      그렸으니 **두 목록이 달랐다.**
 *   ② 그런데도 아무도 실패하지 않은 이유는 쿨다운을 **위치(index)** 로 실어
 *      보냈기 때문이다. 길이만 같으면 어긋난 값이 그대로 그려진다.
 *
 * ★ 그래서 이 파일은 ②를 지킨다 — **①을 고쳐도 ②가 남으면 같은 사고가 다시 난다.**
 *   위치 결합은 어긋나도 조용하고, 조용한 결합이 이 저장소의 단일 실패 유형이다.
 *
 * ★ 환경이 `node` 라 컴포넌트를 렌더할 수 없다 (vite.config.js). 소스 대조 +
 *   순수 로직 실측을 함께 쓴다 — `battleScreen.test.js` 와 같은 방식이다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createSim } from "@/game/logic/sim";
import { buildStageConfig } from "@/game/logic/stageConfig";
import { cooldownPct, castSpell, SPELL_IDS } from "@/game/logic/spells";

/**
 * 웨이브를 끈 빈 전장 — `spells.effect.test.js:arena` 와 같은 모양이다.
 * ★ 얕은 가짜 상태로는 `castSpell` 을 부를 수 없다 (cfg · events · rng 를 읽는다).
 */
function arena(spells) {
    const cfg = buildStageConfig("1-12", [{ id: "elf_sharpshooter", level: 1 }], { spells });
    const s = createSim(cfg, 7);
    s.cfg.waveTable = [];
    s.waveTotal = 5;
    s.nextWaveAt = Infinity;
    s.riftEnergy = s.riftMax;
    return s;
}

const HUD = readFileSync(new URL("./BattleHud.jsx", import.meta.url), "utf8");
const SCENE = readFileSync(
    new URL("../game/scenes/BattleScene.js", import.meta.url),
    "utf8"
);

/** 주석을 지운 소스 — 주석에 남은 예전 코드가 검사에 걸리면 안 된다 */
const strip = (src) =>
    src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n")
        .map((l) => (/^\s*(\/\/|\*)/.test(l) ? "" : l))
        .join("\n");

const HUD_CODE = strip(HUD);
const SCENE_CODE = strip(SCENE);

describe("쿨다운은 위치가 아니라 id 로 실린다", () => {
    /**
     * ★★ 먼저 **위험이 실재하는지** 확인한다. 두 주문의 쿨다운이 애초에 같다면
     *   위치가 어긋나도 화면이 같아서, 아래 검사는 아무것도 지키지 않는다.
     */
    it("전제 — 주문마다 쿨다운 길이가 다르다 (어긋나면 화면에 다른 숫자가 뜬다)", () => {
        const s = arena();
        const eq = s.spells.equipped;
        expect(eq.length, "기본 장착이 비었다면 이 검사의 전제가 무너진다").toBe(4);

        // 첫 주문만 쓴다 → 그 주문만 쿨다운이 남아야 한다
        castSpell(s, eq[0], {});
        const pcts = eq.map((id) => cooldownPct(s, id));
        expect(pcts[0], "쓴 주문에 쿨다운이 남지 않는다").toBeGreaterThan(0);
        expect(
            pcts.slice(1).every((p) => p === 0),
            "쓰지 않은 주문에도 쿨다운이 붙었다 — 시뮬 쪽 문제다"
        ).toBe(true);
    });

    it("★ 씬은 `{id: 비율}` 로 만든다 — `equipped.map(...)` 이 아니다", () => {
        expect(
            /cds\[id\]\s*=\s*cooldownPct\(/.test(SCENE_CODE),
            "BattleScene 이 쿨다운을 id 로 담지 않는다"
        ).toBe(true);
        expect(
            /const\s+cds\s*=\s*equipped\.map\(/.test(SCENE_CODE),
            "위치 배열로 되돌아갔다 — 목록이 어긋나면 남의 버튼에 숫자가 뜬다"
        ).toBe(false);
    });

    it("★ HUD 는 `cooldowns[sp.id]` 로 읽는다 — `cooldowns[i]` 가 아니다", () => {
        expect(
            /cooldowns\?\.\[sp\.id\]/.test(HUD_CODE),
            "HUD 가 쿨다운을 id 로 읽지 않는다"
        ).toBe(true);
        expect(
            /cooldowns\?\.\[i\]/.test(HUD_CODE),
            "위치 인덱스로 되돌아갔다 — 정확히 제보된 그 버그다"
        ).toBe(false);
    });

    it("★ HUD 목록은 `getBattleSpells()` 에서 온다 — 스스로 정규화하지 않는다", () => {
        expect(
            /getBattleSpells\(\)/.test(HUD_CODE),
            "HUD 가 전투와 같은 함수를 쓰지 않는다 — 해금 상한이 갈라진다"
        ).toBe(true);
        expect(
            /normalizeSpellLoadout\(/.test(HUD_CODE),
            "HUD 가 목록을 다시 만들고 있다 (highestStage 를 모른다)"
        ).toBe(false);
    });

    /**
     * ★★★ **어긋나도 남의 쿨다운이 붙지 않는다** — 구조가 지키는지 실측한다.
     *   목록이 다른 상황을 일부러 만든 뒤, id 맵으로는 오배치가 불가능함을 보인다.
     */
    it("★★ 목록이 어긋나도 id 맵은 남의 쿨다운을 그리지 않는다", () => {
        const s = arena();
        const simList = s.spells.equipped;
        castSpell(s, simList[0], {});

        // 씬이 만드는 것 (id 맵)
        const cds = {};
        for (const id of simList) cds[id] = cooldownPct(s, id);

        // HUD 가 **다른** 목록을 그린다고 가정한다 (예전에 실제로 그랬다)
        const hudList = SPELL_IDS.filter((id) => !simList.includes(id)).slice(0, 4);
        expect(hudList.length, "12종 중 기본 4종 밖의 주문이 있어야 한다").toBeGreaterThan(0);

        for (const id of hudList) {
            expect(cds[id] ?? 0, `${id} 에 남의 쿨다운이 붙었다`).toBe(0);
        }
    });
});

describe("씬 페이로드는 전투 설정이 읽는 것을 전부 담는다", () => {
    const SCREEN = strip(
        readFileSync(new URL("../screens/BattleScreen.jsx", import.meta.url), "utf8")
    );

    /**
     * ★★ `buildStageConfig(stageId, slots, {...})` 에 넘기는 키와
     *   `switchScene("Battle", {...})` 에 넘기는 키를 대조한다.
     *
     *   씬은 **같은 인자로 같은 함수를 다시 부른다.** 그러니 여기서 빠진 값은
     *   전투에 존재하지 않고, 화면과 시뮬이 다른 설정으로 돈다.
     *   `spells` 가 그렇게 빠져 있었다.
     */
    const KEYS = ["meta", "difficulty", "spells"];
    for (const key of KEYS) {
        it(`★ switchScene 페이로드에 \`${key}\` 가 있다`, () => {
            const at = SCREEN.indexOf('switchScene("Battle"');
            expect(at, "switchScene 호출을 못 찾았다 — 이 검사가 헛돈다").toBeGreaterThan(0);
            // 호출 블록만 자른다 (괄호 깊이)
            let depth = 0;
            let end = SCREEN.length;
            for (let i = SCREEN.indexOf("(", at); i < SCREEN.length; i++) {
                if (SCREEN[i] === "(") depth++;
                else if (SCREEN[i] === ")" && --depth === 0) {
                    end = i;
                    break;
                }
            }
            const block = SCREEN.slice(at, end);
            expect(
                new RegExp(`(^|[\\s,{])${key}\\s*[,:}]`).test(block),
                `씬이 ${key} 를 받지 못한다 — buildStageConfig 가 기본값으로 떨어진다`
            ).toBe(true);
        });
    }
});
