/**
 * 적이 지휘관을 노린다 — **평타의 대가가 실제로 존재하는가** (2026-08-05)
 *
 * ★★★ `docs/02-design/20-commander-combat.md` §2.1 은 지휘관 평타를 이렇게 정당화한다:
 *
 *     "평타를 넣으려면 오라 앞쪽을 적에게 내주는 자리까지 나가야 하고,
 *      그러면 SUPPORT 가 끊기고 **지휘관이 맞는다.** 딜을 얻고 힐과 안전을 잃는다."
 *
 *   **그 대가의 절반이 구현되어 있지 않았다.** 지휘관은 `lanes[].allies` 에 없어
 *   `nearestTarget` 의 후보가 아니었고, 지휘관 HP 를 깎는 코드는 보스 슬램뿐이었다.
 *   즉 평타는 공짜였고, 문서만 대가를 약속하고 있었다.
 *
 * ★ 여기서 재는 것은 "지휘관이 센가"가 아니라 **규칙이 지켜지는가**다:
 *   ① 동료 라인 **뒤**에 있으면 아무도 지휘관을 보지 않는다 (방치 효율 · C3)
 *   ② 동료보다 **앞**에 나가면 맞는다 (§2.1 의 대가)
 *   ③ 한 방의 피해에 **상한**이 있다 — 월드 2 부터 즉사하지 않는다
 *   ④ 공중 적은 지휘관을 때리지 않는다 (지휘관이 공중을 못 때리는 것과 대칭 · C2)
 *   ⑤ 기절 중에는 맞지 않는다
 *   ⑥ 원거리 적의 탄이 실제로 지휘관에게 닿는다 (안 그러면 '노리는데 안 맞는' 죽은 규칙)
 *   ⑦ 지휘관 피해에는 난수가 없다 — `s.rng.combat` 을 당기지 않는다 (결정론 B1)
 */
import { describe, it, expect } from "vitest";
import { createSim } from "./sim.js";
import { buildStageConfig, UNIT_DEFS } from "./stageConfig.js";
import { spawnEnemy, trySummon } from "./spawn.js";
import { stepCombat } from "./engage.js";
import { stepProjectiles } from "./projectiles.js";
import { stepCommander } from "./lifecycle.js";
import { COMMANDER_ID, damageCommander } from "./commanderHit.js";
import { AIR_LANE } from "./state.js";
import { EV } from "./events.js";
import balance from "../data/balance.json" with { type: "json" };

/** 근접 적 · 원거리 적 · 공중 적이 모두 나오는 판이 필요해 둘로 나눈다 */
const STAGE_RANGED = "2-2"; // goblin_scrapper(근접 28) · goblin_slinger(원거리 150)
const STAGE_AIR = "1-6"; // swooping_bat(FLYING)

const SIX = [
    { id: "slow_turtle", level: 1 },
    { id: "bold_man_at_arms", level: 1 },
    { id: "determined_soldier", level: 1 },
    { id: "elf_sharpshooter", level: 1 },
    { id: "novice_pyromancer", level: 1 },
    { id: "jovial_friar", level: 1 },
];

function sim(stage = STAGE_RANGED) {
    const s = createSim(buildStageConfig(stage, SIX, { meta: {} }), 1);
    s.mana = 9999;
    return s;
}

function putEnemy(s, id, lane, x) {
    const def = s.cfg.enemyDefs[id];
    expect(def, `waveTable 에 '${id}' 가 없다`).toBeTruthy();
    const e = spawnEnemy(s, def, lane);
    e.x = x;
    e.speed = 0; // 이 테스트가 재는 것은 이동이 아니라 표적 선정이다
    return e;
}

function putAlly(s, id, x, lane) {
    const before = s.actives.length;
    expect(trySummon(s, UNIT_DEFS[id], lane)).toBe(true);
    const u = s.actives[before];
    u.x = x;
    u.speed = 0;
    return u;
}

/** 지휘관을 레인 li 의 x 에 세운다 */
function putCommander(s, lane, x) {
    const c = s.commander;
    c.lane = lane;
    c.x = x;
    c.targetX = x;
    return c;
}

describe("적 → 지휘관", () => {
    /**
     * ★★★ **동료가 사거리 안에 있으면 지휘관은 후보조차 아니다.**
     *   이 한 줄이 C3(중앙에 세워만 둬도 70% 효율)를 지킨다. "가장 가까운 것"으로
     *   만들면 지휘관이 전선에 서는 순간 무리 전체가 그에게 몰려 즉사한다.
     */
    it("★★★ 동료 라인 뒤에 서 있으면 아무도 지휘관을 때리지 않는다", () => {
        const s = sim();
        putAlly(s, "bold_man_at_arms", 500, 0);
        const c = putCommander(s, 0, 460); // 동료보다 뒤(방주 쪽)
        const e = putEnemy(s, "goblin_scrapper", 0, 520); // 동료가 사거리 안

        const before = c.hp;
        for (let i = 0; i < 60; i++) {
            s.t += 33;
            stepCombat(s);
        }
        expect(c.hp, "라인 뒤의 지휘관이 맞았다 — 방치 효율이 무너진다").toBe(before);
        expect(e.atkReadyAt, "적이 아무것도 때리지 않았다 — 대조가 성립하지 않는다").toBeGreaterThan(0);
    });

    it("★★★ 동료보다 앞으로 나가면 맞는다 (평타의 대가)", () => {
        const s = sim();
        putAlly(s, "bold_man_at_arms", 400, 0); // 한참 뒤
        const c = putCommander(s, 0, 700);
        putEnemy(s, "goblin_scrapper", 0, 720); // 지휘관은 사거리 안 · 동료는 밖

        const before = c.hp;
        for (let i = 0; i < 60; i++) {
            s.t += 33;
            stepCombat(s);
        }
        expect(c.hp, "앞에 나간 지휘관이 한 대도 맞지 않았다 — 평타가 여전히 공짜다").toBeLessThan(before);
    });

    it("★★ 다른 레인의 적은 지휘관을 보지 않는다", () => {
        const s = sim();
        const c = putCommander(s, 0, 700);
        putEnemy(s, "goblin_scrapper", 1, 720);

        const before = c.hp;
        for (let i = 0; i < 60; i++) {
            s.t += 33;
            stepCombat(s);
        }
        expect(c.hp).toBe(before);
    });

    /**
     * ★★★ **공중 적은 지휘관을 때리지 않는다.**
     *   지휘관이 공중을 때리지 않는 것과 대칭이다 (§2.1). 한쪽만 두면
     *   1-6 "공중 — 방벽을 무시한다"가 편성 퍼즐이 아니라 지휘관 문제가 된다.
     */
    it("★★ 공중 적은 지휘관을 때리지 않는다 (지휘관이 공중을 못 때리는 것과 대칭)", () => {
        const s = sim(STAGE_AIR);
        const c = putCommander(s, 0, 700);
        const bat = putEnemy(s, "swooping_bat", 0, 710);
        expect(bat.lane, "FLYING 이 공중 레인으로 가지 않았다").toBe(AIR_LANE);

        const before = c.hp;
        for (let i = 0; i < 60; i++) {
            s.t += 33;
            stepCombat(s);
        }
        expect(c.hp).toBe(before);
    });

    it("★ 기절 중에는 맞지 않는다", () => {
        const s = sim();
        const c = putCommander(s, 0, 700);
        c.hp = 0;
        stepCommander(s); // 기절 타이머를 건다
        expect(c.downUntil).toBeGreaterThan(s.t);
        putEnemy(s, "goblin_scrapper", 0, 710);

        for (let i = 0; i < 30; i++) {
            s.t += 33;
            stepCombat(s);
        }
        expect(c.hp, "기절한 지휘관이 또 맞았다").toBe(0);
    });

    /**
     * ★★★ **원거리 적의 탄이 실제로 닿는다.**
     *   지휘관은 레인 배열에 없으므로 `stepProjectiles` 의 명중 루프가 그를
     *   만나지 못한다. 따로 보지 않으면 원거리 적은 "조준은 하는데 탄이
     *   그대로 통과하는" 죽은 규칙이 된다.
     */
    it("★★★ 원거리 적의 탄이 지휘관에게 맞는다 (통과하지 않는다)", () => {
        const s = sim();
        const c = putCommander(s, 0, 600);
        putEnemy(s, "goblin_slinger", 0, 700); // 사거리 150 안 · 동료 없음

        const before = c.hp;
        stepCombat(s);
        expect(s.projectiles.length, "원거리 적이 즉발로 때렸다").toBe(1);
        expect(c.hp, "탄이 날기도 전에 피해가 들어갔다").toBe(before);

        for (let i = 0; i < 60 && c.hp === before; i++) {
            s.t += 33;
            stepProjectiles(s);
        }
        expect(c.hp, "탄이 지휘관을 그대로 통과했다").toBeLessThan(before);
    });

    it("★★ 탄은 동료를 먼저 맞힌다 — 지휘관이 동료의 탄을 가로채지 않는다", () => {
        const s = sim();
        const c = putCommander(s, 0, 600);
        const ally = putAlly(s, "bold_man_at_arms", 600, 0); // 지휘관과 같은 자리
        putEnemy(s, "goblin_slinger", 0, 700);

        const cHp = c.hp;
        const aHp = ally.hp;
        stepCombat(s);
        for (let i = 0; i < 60; i++) {
            s.t += 33;
            stepProjectiles(s);
        }
        expect(ally.hp, "동료가 맞지 않았다").toBeLessThan(aHp);
        expect(c.hp, "지휘관이 동료에게 갈 탄을 가로챘다").toBe(cHp);
    });
});

describe("지휘관 피해 상한", () => {
    /**
     * ★★★ **상한이 없으면 월드 2 부터 모든 적이 지휘관을 한 방에 눕힌다.**
     *   지휘관 HP 는 600 고정인데 적 ATK 는 1-1 의 10 에서 5-20 의 342,133 까지
     *   간다. 보스 슬램이 이미 같은 벽에 부딪혀 같은 답을 냈다.
     */
    it("★★★ 한 방은 최대 HP 의 정해진 비율을 넘지 못한다", () => {
        const s = sim();
        const c = s.commander;
        const ratio = balance.combat.enemyHitCommanderHpRatio;
        expect(ratio, "상한 비율이 데이터에 없다").toBeGreaterThan(0);

        const taken = damageCommander(s, 1e9, ratio);
        expect(taken).toBe(c.hpMax * ratio);
        expect(c.hp).toBe(c.hpMax - c.hpMax * ratio);
    });

    it("★★ 상한 이하의 피해는 그대로 들어간다 (월드 1 이 무피해가 되지 않는다)", () => {
        const s = sim();
        const c = s.commander;
        expect(damageCommander(s, 10, balance.combat.enemyHitCommanderHpRatio)).toBe(10);
        expect(c.hp).toBe(c.hpMax - 10);
    });

    it("★★ HP 가 0 이 되면 기절 신호(downUntil = 0)를 남긴다 — 타이머는 lifecycle 이 건다", () => {
        const s = sim();
        const c = s.commander;
        damageCommander(s, 1e9, 1);
        expect(c.hp).toBe(0);
        expect(c.downUntil, "여기서 타이머를 걸면 규칙이 두 곳에 생긴다").toBe(0);

        stepCommander(s);
        expect(c.downUntil).toBe(s.t + s.cfg.commanderRespawnMs);
    });

    it("★ 피격은 이벤트로 알린다 — 화면이 무음이면 '왜 쓰러졌지'만 남는다", () => {
        const s = sim();
        putCommander(s, 2, 700);
        damageCommander(s, 40, 1);
        const hit = [...Array(s.events.length).keys()]
            .map((i) => s.events.pool[i])
            .find((e) => e.type === EV.DAMAGE && e.a === COMMANDER_ID);
        expect(hit, "EV.DAMAGE 가 나가지 않았다").toBeTruthy();
        expect(hit.b).toBe(40);
        expect(hit.c, "레인을 싣지 않으면 연출이 어느 줄인지 모른다").toBe(2);
    });

    /**
     * ★★★ **결정론(B1).** 크리티컬을 굴리면 `s.rng.combat` 이 한 칸 밀리고,
     *   그 뒤의 모든 굴림이 달라져 같은 시드가 다른 전투가 된다 —
     *   밸런스 A/B 와 리플레이가 통째로 무의미해진다.
     */
    it("★★★ 지휘관 피해는 난수를 당기지 않는다", () => {
        const s = sim();
        const probe = () => s.rng.combat();
        const a = probe();
        damageCommander(s, 40, 1);
        damageCommander(s, 40, 1);
        const b = probe();

        const s2 = sim();
        const a2 = s2.rng.combat();
        const b2 = s2.rng.combat();
        expect([a, b]).toEqual([a2, b2]);
    });

    it("★ 화면이 예약 id 를 실제로 갈라낸다 (선언만 있고 읽는 곳이 없으면 무음이다)", async () => {
        const { readFileSync } = await import("node:fs");
        const { fileURLToPath } = await import("node:url");
        const { dirname, join } = await import("node:path");
        const root = dirname(fileURLToPath(import.meta.url));
        const scene = readFileSync(join(root, "..", "scenes", "BattleScene.js"), "utf8");
        expect(scene, "BattleScene 이 COMMANDER_ID 를 모른다").toContain("COMMANDER_ID");
        expect(scene, "지휘관 피격 연출이 없다").toContain("playHurt()");
    });

    /**
     * ★★★ **"지휘관이 서 있는가"를 손으로 다시 적지 않는다** (2026-08-05).
     *
     *   이 술어는 **두 항이다** — `hp > 0` 과 `t >= downUntil`. 그런데 저장소
     *   일곱 곳이 각자 적고 있었고, 그중 **넷이 시간 항만** 보고 있었다
     *   (`aura` · `movement` ×2 · `spells`). 그것들이 맞았던 이유는 `stepCommander`
     *   가 앞에서 도는 **순서 덕분**이지 조건이 옳아서가 아니다 — 지휘관이 죽는
     *   그 틱에는 `downUntil` 이 아직 0 이라(타이머는 다음 틱에 걸린다) 시간만
     *   보면 **HP 0 인 지휘관이 살아 있는 것으로 읽힌다.** 실제로 그 틱에는
     *   죽은 지휘관이 이동했고 주문이 나갔다.
     *
     * ★ 그래서 기계가 막는다. 상태를 **쓰는** 두 곳만 예외다:
     *   `lifecycle.js`(기절/복귀 상태 기계) · `state.js`(초기화) · `commanderHit.js`(본체).
     */
    it("★★ downUntil 을 직접 읽는 곳은 상태를 쓰는 세 파일뿐이다", async () => {
        const { readFileSync, readdirSync, statSync } = await import("node:fs");
        const { fileURLToPath } = await import("node:url");
        const { dirname, join, basename } = await import("node:path");
        const root = dirname(fileURLToPath(import.meta.url));
        const OWNERS = new Set(["lifecycle.js", "state.js", "commanderHit.js"]);

        /**
         * ★★★ **렌더러까지 훑는다** (2026-08-07 확장).
         *
         *   이 검사는 `logic/` **한 폴더만** 보고 있었다. 그래서
         *   `presenters/CommanderPresenter.js:sync()` 의 `const down = sim.t < c.downUntil;`
         *   — 정확히 이 검사가 막으려던 그 사본 — 을 **구조적으로 잡을 수 없었다.**
         *   지휘관이 죽는 그 프레임에 화면은 오라 링을 그대로 그렸고, 시뮬에서는
         *   이미 오라가 꺼져 있었다. 화면이 거짓말을 한 것이다.
         *
         *   교훈: 술어를 한 곳에 모으는 검사기는 **그 술어가 쓰이는 모든 계층**을
         *   봐야 한다. 폴더 하나로 범위를 좁히면 다음 사본은 그 폴더 밖에 생긴다.
         */
        const DIRS = [root, join(root, "..", "presenters"), join(root, "..", "scenes"), join(root, "..", "fx")];

        /**
         * ★★ 금지되는 것은 **비교**다 — `downUntil` 을 읽는 것 자체가 아니다.
         *
         *   `CommanderPresenter` 는 "재출격 N" 을 그리려고 `c.downUntil - sim.t` 를
         *   쓴다. 그것은 술어가 아니라 **남은 시간 계산**이고, 금지하면 씬이 남은
         *   초를 알 방법이 없어진다. 반면 `sim.t < c.downUntil` 처럼 **비교**로 쓰는
         *   순간 그것은 "지휘관이 서 있는가"를 손으로 다시 적은 것이고, 그 판정은
         *   `hp > 0` 항이 빠져 있다.
         *
         * ★ 주석은 지운다. 이 저장소의 주석은 본문보다 길고 대부분 이 술어를
         *   **설명**하고 있어서, 지우지 않으면 설명을 쓴 파일이 전부 위반이 된다.
         */
        const stripComments = (src) =>
            src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
        const COMPARISON = /(?:[<>]=?|[!=]==)\s*[\w.]*\bdownUntil\b|\bdownUntil\b\s*(?:[<>]=?|[!=]==)/;

        const offenders = [];
        for (const dir of DIRS) {
            let entries;
            try {
                entries = readdirSync(dir);
            } catch {
                continue; // 폴더가 없으면 건너뛴다 (구조가 바뀌어도 검사가 터지지 않게)
            }
            for (const f of entries) {
                const p = join(dir, f);
                if (!statSync(p).isFile()) continue;
                if (!f.endsWith(".js") || f.endsWith(".test.js")) continue;
                if (OWNERS.has(basename(f))) continue;
                if (COMPARISON.test(stripComments(readFileSync(p, "utf8")))) offenders.push(f);
            }
        }

        expect(
            offenders,
            `commanderUp(s) 를 쓰라 — 술어를 베낀 파일: ${offenders.join(", ")}`
        ).toEqual([]);
    });
});
