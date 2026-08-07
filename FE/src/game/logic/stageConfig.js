/**
 * 스테이지 설정 빌더
 *
 * JSON 데이터 + 밸런스 커브 + 플레이어 성장을 합쳐 시뮬이 먹을 수 있는
 * 평평한 설정 객체를 만든다.
 *
 * ★ 적 HP 성장률을 구간별로 감쇠시키는 것이
 *   "스테이지 30–50 벽"에 대한 가장 효과적인 구조적 처방이다.
 *   플레이어 파워는 업그레이드 비용 상승으로 자연 감속하므로,
 *   적 성장도 감속시키지 않으면 격차가 무한히 벌어진다.
 *
 * @see docs/02-design/14-economy-balance.md §2, §6
 */
// ★ import attribute 를 명시한다.
//   Vite 는 없어도 되지만 순수 Node 에서는 필수이며, 밸런스 하네스(P4)와
//   벤치 스크립트가 Node 로 직접 이 모듈을 로드한다.
import balance from "../data/balance.json" with { type: "json" };
import unitsData from "../data/units.json" with { type: "json" };
import enemiesData from "../data/enemies.json" with { type: "json" };
import stagesData from "../data/stages.json" with { type: "json" };
import { tagsToMask } from "./tags.js";
import { TICK_MS } from "./tick.js";
import {
    difficultyConfig,
    DEFAULT_DIFFICULTY,
    globalStageIndex,
    worldOfStage,
} from "./difficulty.js";
// ★ "이 월드에 어떤 규칙이 걸리는가"의 단일 출처. 여기서 월드 번호로 분기하지 않는다.
import { nightmareFor } from "./nightmare.js";
// ★ 장착 주문 4칸의 정규화는 `logic/spells.js` 가 단일 출처다 — 여기서 기본값을
//   다시 적으면 "화면이 아무것도 안 고른 계정"의 규칙이 두 곳에 생긴다.
import { normalizeSpellLoadout } from "./spells.js";

/** 구간별 감쇠 커브를 적용한 누적 배율 */
export function growthMultiplier(stage, curve) {
    let mult = 1;
    let from = 0;
    for (const seg of curve) {
        const to = Math.min(stage, seg.maxStage);
        if (to > from) mult *= Math.pow(seg.rate, to - from);
        from = to;
        if (stage <= seg.maxStage) break;
    }
    return mult;
}

// ★ 난이도 모듈이 스테이지 id 파싱을 갖는다 (해금 조건이 월드 단위라 먼저 필요하다).
//   여기서 재수출하는 이유는 하네스·벤치·테스트가 예전부터 이 경로로 import 하기 때문이다.
export { globalStageIndex };

/**
 * 보스 페이즈 정규화 (P6-05).
 *
 * ★ 태그 문자열 → 비트마스크 변환을 **여기서 한 번만** 한다.
 *   전환은 전투당 2회뿐이지만, logic/ 이 문자열 배열을 들고 있으면
 *   `includes()` 유혹이 생기고 그 순간 태그 검사가 틱 예산을 먹는다.
 *
 * @see docs/02-design/19-art-audio-direction.md §4
 */
function normalizeBoss(raw, modeDefaults = {}) {
    if (!raw || !Array.isArray(raw.phases) || raw.phases.length === 0) return null;

    const phases = raw.phases.map((p) => ({
        /** HP 비율이 이 값 이하가 되면 이 페이즈로 넘어간다 */
        atRatio: p.at ?? 1,
        tagMask: tagsToMask(p.tags),
        atkMult: p.atkMult ?? 1,
        speedMult: p.speedMult ?? 1,
        /**
         * ★ def/res 는 배율이 아니라 **절대값**이다.
         *   res 는 0–100 퍼센트이고 대부분의 적은 res 0 이다.
         *   배율로 두면 `WARDED` 태그를 붙여도 0 × 1.5 = 0 이라
         *   **태그만 바뀌고 실제로는 아무것도 안 바뀐다** (실제로 그렇게 짰다가
         *   테스트에 잡혔다). 상성은 태그가 아니라 이 두 숫자가 만든다.
         *   난이도 커브도 def/res 는 건드리지 않으므로(scaleEnemy) 일관된다.
         *   null 이면 스폰 시점 값을 유지한다.
         */
        def: p.def ?? null,
        res: p.res ?? null,
        atkIntervalMult: p.atkIntervalMult ?? 1,
        /** 0 이면 이 페이즈에는 슬램이 없다 */
        slamEveryMs: p.slamEveryMs ?? modeDefaults.slamEveryMs ?? 0,
        slamDamageMult: p.slamDamageMult ?? modeDefaults.slamDamageMult ?? 0,
        slamRadius: p.slamRadius ?? modeDefaults.slamRadius ?? 0,
        name: p.name ?? "",
    }));

    return { phases };
}

/** 유닛/적 정의를 시뮬용으로 정규화한다 (태그 → 비트마스크) */
function normalizeDef(raw, extra = {}) {
    const b = raw.base;
    return {
        id: raw.id,
        name: raw.name,
        role: raw.role ?? "MELEE",
        dmgType: raw.dmgType ?? "physical",
        tagMask: tagsToMask(raw.tags),
        hp: b.hp,
        atk: b.atk,
        def: b.def,
        res: b.res,
        range: b.range,
        speed: b.speed,
        atkInterval: b.atkInterval,
        blockCount: b.blockCount ?? 0,
        shield: b.shield ?? 0,
        // ★ spawn.js 가 `def.pierce` 를 읽는다. 여기서 옮기지 않으면 데이터에
        //   pierce 를 적어도 조용히 0 이 된다 — "적혀 있는데 작동하지 않는" 유닛이 된다.
        pierce: raw.pierce ?? b.pierce ?? 0,
        cost: raw.cost ?? 0,
        breachDamage: raw.breachDamage ?? 0,
        squad: raw.squad ?? 1,
        art: raw.art,
        /**
         * ★ 렌더가 발사체 스프라이트를 고르는 근거. 여기서 옮기지 않으면
         *   데이터에 적어도 조용히 무시된다 (`pierce` 가 똑같이 당했다).
         *
         * ★★★ 출처는 **`raw.art.projectile` 하나뿐이다** (2026-08-05).
         *   한때 `units.json` 에 최상위 `projectile` 과 `art.projectile` 이 **둘 다**
         *   있었다. 씬은 최상위를, 검사기와 테스트는 `art.projectile` 을 읽었고,
         *   여기서는 `raw.projectile` 을 집었다. 둘의 내용이 서로 달랐으므로
         *   **검사기가 통과시킨 것과 화면에 뜬 것이 다른 그림**이었다.
         *   `data:validate` 가 이제 최상위 `projectile` 을 오류로 잡는다.
         */
        projectile: raw.art?.projectile,
        ...extra,
    };
}

export const UNIT_DEFS = Object.fromEntries(
    unitsData.units.map((u) => [u.id, normalizeDef(u)])
);

/**
 * 플레이어 성장을 유닛 정의에 적용한 사본을 만든다.
 *
 * ★ 여기는 성장 '규칙'을 모른다. 이미 합성된 배율만 받는다.
 *   장비·소유효과·별 트리를 합성하는 책임은 logic/progression.js 에 있고,
 *   전투는 그 결과값만 본다. 이 분리 덕에 메타를 바꿔도 전투 테스트가 안 깨진다.
 *
 * ★ 2026-08-04 경량화로 `rank` 가 사라졌다. 승급이 담당하던 이산 계단은
 *   무기고 시설이 `atkPct`/`hpPct` 에 실려 들어온다 — 이 함수가 보는 것은
 *   여전히 "이미 합성된 배율" 하나뿐이라 전투 쪽에서 바뀐 것은 없다.
 *
 * @param {object} mods { level, atkPct, hpPct, pierce, defFlat }
 */
export function applyProgression(def, mods = {}) {
    const p = balance.progression;
    const level = mods.level ?? 1;
    const atkPct = 1 + (mods.atkPct ?? 0);
    const hpPct = 1 + (mods.hpPct ?? 0);

    return {
        ...def,
        hp: Math.round(def.hp * Math.pow(p.unitHpGrowth, level - 1) * hpPct),
        atk: Math.round(def.atk * Math.pow(p.unitAtkGrowth, level - 1) * atkPct),
        def: def.def + (mods.defFlat ?? 0),
        pierce: (def.pierce ?? 0) + (mods.pierce ?? 0),
    };
}

/**
 * 스테이지 난이도 커브를 적용한 적 정의
 *
 * ★ 난이도 배율은 HP 와 ATK 를 **따로** 받는다.
 *   경제 문서 §2.2 의 원칙("좌절은 '못 죽인다'보다 '순식간에 뚫린다'에서 온다")대로
 *   나중에 하드의 ATK 만 낮춰야 할 수 있다. 한 숫자로 묶어두면 그 조정이 불가능하다.
 *
 * @param {object} diff difficulty.json 레벨 설정 (enemyHpMult / enemyAtkMult)
 * @param {number} stageMult 스테이지 고유 배율 (설계된 패배·관문에만 쓴다)
 */
function scaleEnemy(raw, stageIndex, diff, stageMult = 1) {
    const sc = balance.scaling;
    const hpMult = growthMultiplier(stageIndex, sc.enemyHpGrowth);
    const atkMult = growthMultiplier(stageIndex, sc.enemyAtkGrowth);
    const diffHp = (diff.enemyHpMult ?? 1) * stageMult;
    const diffAtk = (diff.enemyAtkMult ?? 1) * stageMult;

    const g = raw.giant;
    const def = normalizeDef(raw, {
        giant: g,
        boss: normalizeBoss(raw.boss, balance.modes?.nemesis ?? {}),
    });

    // ★ 전역 배율. 적 27종을 하나씩 고치지 않고 전체 난이도를 한 손잡이로 돌린다.
    //   튜닝 반복을 데이터 편집이 아니라 상수 하나로 만드는 것이 하네스를 쓸모 있게 한다.
    def.hp = Math.round(def.hp * (sc.enemyHpMult ?? 1) * hpMult * diffHp * (g ? g.hpMult : 1));
    def.atk = Math.round(def.atk * (sc.enemyAtkMult ?? 1) * atkMult * diffAtk * (g ? g.atkMult : 1));
    def.speed = Math.round(def.speed * (g ? g.speedMult : 1));
    return def;
}

/**
 * 모드별 파라미터. 수치는 balance.json 이 갖고, 여기서는 계산만 한다.
 *
 * ★ 2026-08-04 경량화로 모드는 assault · nemesis 둘뿐이다 (modes.js 상단 참조).
 *   버티기·돌파·호위가 쓰던 `enemyScale()` (개체 평균 HP · 최대 공격력)도
 *   같이 사라졌다 — 균열 HP · 수레 HP 를 스테이지 규모에 비례시키던 계산이었다.
 */
function buildModeParams(stage) {
    if (stage.mode !== "nemesis") return {};
    const p = balance.modes?.nemesis ?? {};
    return {
        victoryOnBossDeath: p.victoryOnBossDeath !== false,
        addsDespawnOnBossDeath: p.addsDespawnOnBossDeath !== false,
        // 보스 페이즈 (P6-05) — 예고 시간은 "정보 전달 시간"이므로
        // 스테이지가 아니라 전역 상수다. 월드마다 다르면 학습이 안 된다.
        phaseTelegraphMs: p.phaseTelegraphMs ?? 800,
        slamTelegraphMs: p.slamTelegraphMs ?? 800,
        firstSlamDelayMs: p.firstSlamDelayMs ?? 6000,
        slamCommanderReach: p.slamCommanderReach ?? 220,
    };
}

/**
 * 나이트메어 ③ 고갈이 적용된 소환 코스트 감쇠 주기.
 *
 * ★ 배율 0(감쇠 없음)일 때는 **주기를 건드리지 않는다.** 끄는 것은 `summonDecayEnabled`
 *   가 하고, 여기서 `base/0 = Infinity` 를 만들면 화면이 그것을 초로 환산한다.
 */
function attritionDecayMs(baseMs, attrition) {
    const m = attrition?.summonDecayMult;
    if (m === undefined || m <= 0 || m >= 1) return baseMs;
    return Math.round(baseMs / m);
}

/**
 * 시뮬 설정 생성.
 *
 * @param {string} stageId
 * @param {Array<{id: string, level?: number, atkPct?: number, hpPct?: number}>} loadout 편성 6칸
 * @param {object} [opts] { difficulty, meta, spells }
 *   spells 는 플레이어가 고른 지휘관 주문 id 배열이다 (12종 중 4종).
 *   넘기지 않으면 `spells.json:defaultLoadout` 으로 떨어진다.
 *   meta 는 logic/progression.js 의 starTreeEffects() 결과다.
 *   ★ 별 트리는 전투 '규칙'을 바꾸지 않고 '숫자'만 민다. 그래야 별을 아무리
 *     퍼부어도 시뮬 동작이 예측 가능하고, 밸런스 하네스가 유효하게 남는다.
 *
 * ★★ **이 파일의 `throw` 문구는 번역하지 않는다** (2026-08-07, i18n 전수 작업).
 *
 *   여기서 던지는 것은 전부 **데이터 정합성 실패**다 — 없는 스테이지 id · 없는 적 id ·
 *   없는 태그. 플레이어가 정상적으로 게임을 해서 도달할 수 있는 상태가 아니고,
 *   `npm run data:validate` 가 100 스테이지 전수로 먼저 잡는다. 즉 이 문장을 읽는
 *   사람은 **언제나 개발자**이고, 문장에서 실제로 쓸모 있는 부분은 대괄호 안의 id 다.
 *
 *   ⚠ 다만 **완전히 안 보이는 것은 아니다.** `ScreenErrorBoundary` 는 `error.message`
 *   를 그리지 않지만 `recordFault()` 에 넘기고, `FaultOverlay` 는 그 문자열을
 *   **배포 빌드에서도** 한 줄로 보여 준다. 영어권 사용자가 그 줄을 못 읽는 대신
 *   id 는 그대로 보이므로 제보에는 충분하다 — 이 판단이 바뀌면 여기 문구부터 옮긴다.
 *
 *   ★ 플레이어가 **선택**해서 도달하는 실패(난이도 오타 · 미구현 난이도)는 다르다.
 *     그것은 `difficulty.js` 가 `rules.difficulty.*` 로 번역해서 던진다.
 */
export function buildStageConfig(stageId, loadout, opts = {}) {
    const stage = stagesData.stages.find((s) => s.id === stageId);
    if (!stage) throw new Error(`알 수 없는 스테이지: ${stageId}`);

    // ★ 미구현·오타는 여기서 **사용자가 읽을 수 있는 문장으로** 던진다.
    //   difficulty.js 가 두 경우를 다른 메시지로 구분한다.
    const difficulty = opts.difficulty ?? DEFAULT_DIFFICULTY;
    const diff = difficultyConfig(difficulty);

    const stageIndex = globalStageIndex(stageId);

    /**
     * ★★ **나이트메어 규칙은 여기서 한 번만 정해진다** (docs/02-design/22-nightmare.md).
     *   전투 코드 어디에도 `difficulty === "nightmare"` 라는 분기가 없다 —
     *   `cfg.nightmare` 가 있으면 규칙이 걸린 것이고, 없으면 없는 것이다.
     *   규칙이 어느 월드에 걸리는지는 `logic/nightmare.js` 가 유일하게 안다.
     */
    const nightmare = diff.mechanics ? nightmareFor(worldOfStage(stageId)) : null;
    /** ③ 고갈만 자원 손잡이를 건드린다 (§4) */
    const attrition = nightmare?.id === "attrition" ? nightmare : null;

    // 이 스테이지에 등장하는 적만 스케일해서 담는다
    const enemyDefs = {};
    for (const w of stage.waveTable) {
        for (const spec of w.spawns) {
            if (enemyDefs[spec.id]) continue;
            const raw = enemiesData.enemies.find((e) => e.id === spec.id);
            if (!raw) throw new Error(`스테이지 ${stageId}: 알 수 없는 적 '${spec.id}'`);
            enemyDefs[spec.id] = scaleEnemy(raw, stageIndex, diff, stage.difficultyMult ?? 1);
        }
    }

    // 편성 정규화 (null 슬롯 제거 + 성장 적용)
    const loadoutDefs = (loadout ?? [])
        .filter(Boolean)
        .map((slot) => {
            const id = typeof slot === "string" ? slot : slot.id;
            const base = UNIT_DEFS[id];
            if (!base) throw new Error(`알 수 없는 동료: ${id}`);
            return applyProgression(base, typeof slot === "string" ? {} : slot);
        });

    const r = balance.resources;
    const bf = balance.battlefield;
    const cmd = balance.commander;
    const m = opts.meta ?? {};

    return {
        stageId,
        stageIndex,
        difficulty,
        mode: stage.mode,
        modeParams: buildModeParams(stage),
        /**
         * 이 전투에 걸린 나이트메어 규칙 (`{id, ...파라미터}`) 또는 `null`.
         * 읽는 곳: `logic/nightmare.js` (①) · `logic/movement.js` (②) · 위 자원 절 (③).
         */
        nightmare,
        tickMs: TICK_MS,

        // 전장
        arkX: bf.arkX,
        riftX: bf.riftX,
        laneY: bf.laneY,
        airY: bf.airY,

        // 자원
        startMana: r.manaStart + (m.startManaFlat ?? 0),
        manaMax: r.manaMax,
        manaRegenBase: r.manaRegenBase * (1 + (m.manaRegenPct ?? 0)),
        // ★ 별 트리의 '마나 재생 +%' 는 **템포 이후에도** 유효해야 한다.
        //   여기 배율을 빼먹었을 때 그 별 노드(최대 +15%)는 전투의 60% 지점부터
        //   사라졌다 — 각인 '마나 샘' 이 당한 것과 같은 사고다.
        manaRegenTempo: r.manaRegenTempo * (1 + (m.manaRegenPct ?? 0)),
        riftMax: r.riftMax,
        // ★ 지휘관 유물·레벨이 균열력 재생을 민다 (2026-08-05)
        riftRegenBase: r.riftRegenBase * (1 + (m.riftRegenPct ?? 0)),
        riftPerKill: r.riftPerKill,
        /**
         * ★ 나이트메어 ③ 고갈은 **여기서 두 손잡이를 0 으로 돌리는 것이 전부**다.
         *   `resources.js` 에 난이도 분기를 만들지 않는다 — 배율(불리언이 아니라)로
         *   두는 이유는 나중에 "환급 절반"을 시험할 때 코드를 고치지 않기 위해서다.
         */
        killRefundRatio: r.killRefundRatio * (attrition ? attrition.killRefundMult : 1),
        summonCostGrowth: r.summonCostGrowth,
        /**
         * ★★ **`summonDecayMult` 는 감쇠 *속도*의 배율이다.** 0.5 면 원복이 두 배
         *   느려진다 — 즉 주기를 나눈다. 처음에는 0 만 보고 불리언처럼 다뤘는데,
         *   그러면 데이터에 0.5 를 적어도 **아무 일도 일어나지 않는다** (이 저장소가
         *   반복해서 겪은 "적혀 있는데 안 읽히는 값"이 그 자리에서 다시 생긴다).
         *   설계 문서가 불리언 대신 배율로 둔 이유가 정확히 그 튜닝이다 (§4.3).
         */
        summonDecayMs: attritionDecayMs(r.summonDecayMs, attrition),
        /**
         * 소환 코스트 감쇠를 **아예 돌리는가**. 기본은 켬. 배율 0 일 때만 끈다.
         *
         * ★★ `summonDecayMs = Infinity` 로 표현하지 않는다 — 그 값은 HUD·가이드가
         *   초로 환산하는 순간 `Infinity` 를 화면에 내고, 산술에 섞이면 `NaN` 이 된다.
         * ★ 설계 문서(§4.4)는 처음에 "`resources.js` 를 고치지 않는다"고 적었는데
         *   두 요구가 양립하지 않는다. 대신 **난이도를 모르는 일반 설정 플래그**로
         *   내려보낸다 — `resources.js` 는 여전히 나이트메어가 무엇인지 모른다.
         */
        summonDecayEnabled: !(attrition && attrition.summonDecayMult === 0),

        // 지휘관
        summonCostMult: 1 + (m.summonCostPct ?? 0),

        /**
         * ★★ 지휘관 성장(레벨 · 장구 · 성소)이 여기서 전투에 들어온다 (2026-08-05).
         *
         *   그 전까지 지휘관은 100 스테이지 내내 **1레벨 고정**이었고, 성소 시설은
         *   골드를 25레벨까지 받으면서 `hpPerLevel`·`auraPerLevel` 을 **아무도 읽지
         *   않았다.** 보정은 전부 `logic/commander.js:commanderEffects` 가 합산해
         *   `meta` 로 들어온다 — 여기서 다시 계산하지 않는다.
         *
         * ★ 보정이 0 이면 예전과 **완전히 같은 값**이다. 밸런스 하네스는 지휘관
         *   레벨 1 · 성소 0 으로 재므로 게이트 수치가 흔들리지 않는다.
         */
        commanderHp: Math.round(cmd.hp * (1 + (m.commanderHpPct ?? 0))),
        commanderSpeed: cmd.moveSpeed,
        commanderRespawnMs: Math.round(
            cmd.respawnMs * (1 - Math.min(0.9, m.commanderRespawnPct ?? 0))
        ),
        auraRadius: cmd.auraRadius + (m.auraRadiusFlat ?? 0),
        auraEffects: cmd.auraEffects,
        /**
         * 평타. 수치는 데이터가 정한다 (절대규칙 4).
         * ★ **`range` 는 보정하지 않는다.** 사거리 < 오라 반경 부등식이 이 게임의
         *   설계 심장이다 (20-commander-combat.md §2.1) — 오라만 넓어지므로
         *   성장할수록 그 간격은 **벌어진다.**
         */
        commanderAttack: {
            ...cmd.attack,
            damage: Math.round(cmd.attack.damage * (1 + (m.commanderAtkPct ?? 0))),
            intervalMs: Math.max(
                60,
                Math.round(cmd.attack.intervalMs / (1 + (m.commanderAtkSpeedPct ?? 0)))
            ),
        },
        /** 주문 위력 배율 — `logic/spells.js` 가 읽는다 */
        spellPowerMult: 1 + (m.spellPowerPct ?? 0),
        /**
         * ★★ **전투에 들고 나가는 주문 4종** (2026-08-05). 12종 중 넷이고,
         *   `createSpellState` 가 이 값으로 4칸을 만든다 (`logic/spells.js`).
         *
         * ★ `opts.spells` 를 아무도 넘기지 않으면 **기본 장착**으로 떨어진다 —
         *   밸런스 하네스·벤치·플레이스루가 전부 그 경로이므로, 주문을 12종으로
         *   늘려도 게이트가 재는 게임은 예전과 같다.
         */
        equippedSpells: normalizeSpellLoadout(opts.spells),

        // 별 판정 기준 (밸런스 하네스 B10/B11 로 조정한다)
        stars: balance.stars ?? { arkRatio: 1, timeRatio: 1 },

        // 전투
        combat: balance.combat,
        projectileSpeed: 420,

        // 웨이브
        arkHp: Math.round(stage.arkHp * (1 + (m.arkHpPct ?? 0))),
        waves: stage.waves,
        waveTable: stage.waveTable,
        waveIntervalMs: bf.waveIntervalMs,
        deployDelayMs: bf.deployDelayMs,
        tempoShiftRatio: bf.tempoShiftRatio,
        tempoDensityMult: bf.tempoDensityMult ?? 1.6,
        // ★ 난이도의 세 번째 손잡이. HP·ATK 만 올리면 하드가 '더 오래 때리기'가 되고,
        //   스폰 수를 올려야 광역·방벽 용량이 실제로 시험된다.
        spawnCountMult: diff.spawnCountMult ?? 1,
        /**
         * 웨이브 사이 방주 회복량 (P7-03). **스테이지 데이터의 값이며 기본은 0** —
         * 즉 이 규칙은 명시적으로 켠 스테이지에만 적용된다.
         * ★ 비율이 아니라 절대값인 이유: 난이도 배율이 방주 HP 를 건드릴 때
         *   회복량까지 같이 움직이면 하드에서 회복이 조용히 세진다.
         */
        arkRegenPerWave: stage.arkRegenPerWave ?? 0,
        targetTimeSec: stage.targetTimeSec,

        // 각인 — ★ 메타 성장이 늘리는 것은 이 둘뿐이다 (각인 수치가 아니다)
        draftOptions: opts.draftOptions ?? 3,
        rerolls: opts.rerolls ?? 1,

        // 정의
        enemyDefs,
        loadout: loadoutDefs,
    };
}

export { stagesData, enemiesData, unitsData, balance };
