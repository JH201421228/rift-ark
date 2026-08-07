/**
 * 스테이지 생성 코어 — **순수 함수. fs · process · 난수 없음.**
 *
 * ★ 왜 CLI 에서 분리했는가 (2026-08-03, 생성기 드리프트 정리)
 *   `tools/gen-stages.mjs` 의 출력과 `stages.json` 이 18 스테이지에서 어긋나 있었다.
 *   원인은 전부 **생성 후에 따로 돌린 후처리 스크립트**였다.
 *   파이프라인 밖에 있으니 재생성 때 조용히 사라진다 — 그래서 안으로 넣었다.
 *   후처리를 생성 안으로 넣고, 그 결과를 **테스트가 검증할 수 있게** 순수 함수로 뺐다.
 *   (`src/game/data/stages.gen.test.js` 가 stages.json 과 이 함수의 출력을 비교한다)
 *
 * ★ 결정론이다. 같은 (worlds, enemies) 면 항상 같은 배열이 나온다.
 *   난수를 쓰면 재생성할 때마다 밸런스가 흔들려 하네스가 무의미해진다.
 */

/* ────────────────────────────────────────────────────────────────
 * 1. 밀도 곡선
 * ──────────────────────────────────────────────────────────────── */

/**
 * 스테이지 총 물량.
 * ★ 지수 곡선 + 관문 급등 + 보스 완화.
 *   보스가 물량으로도 이기면 그건 보스전이 아니라 물량전이다.
 */
function densityFor(C, world, index) {
    // ★ 전역 순번으로 계산한다. 월드마다 리셋하면 2-1 이 1-20 보다 쉬워진다.
    const g = (world - 1) * 20 + index;

    // 램프 구간(전역 1~10)만 가파르다 — 튜토리얼이 90마리로 시작할 수는 없다.
    // 그 뒤는 평탄. 난이도 상승은 개체 HP/ATK 커브가 담당한다.
    const rampTop = C.rampBase * Math.pow(C.rampGrowth, C.rampEndStage - 1);
    let n =
        g <= C.rampEndStage
            ? C.rampBase * Math.pow(C.rampGrowth, g - 1)
            : rampTop * Math.pow(C.plateauDrift, g - C.rampEndStage);

    // 월드 안의 리듬. 관문에서 조이고 보스에서 푼다.
    if (index === C.gateIndex || index === 19) n *= C.gateMult;
    if (index === C.bossIndex || index === 20) n *= C.bossMult;

    // ★ 상한을 반드시 건다. 동시 180체가 성능 예산이고, 그걸 넘기면
    //   난이도가 아니라 프레임 드랍이 플레이어를 죽인다.
    return Math.max(2, Math.min(C.maxDensity, Math.round(n)));
}

/**
 * 웨이브 수 — 물량에 비례하되 상한을 둔다. 웨이브가 20개면 전투가 늘어진다.
 *
 * ★ 웨이브 수는 난이도 손잡이가 아니다. 난이도는 density(총 물량)와 개체 스탯이
 *   정한다. 웨이브 수는 그 물량을 몇 조각으로 나누는가일 뿐이다.
 *   그래서 이 값은 **각인 드래프트 픽 수**에 맞춰 잡는다.
 *
 *   드래프트는 3웨이브마다 열리고(`sigils.isDraftWave`), GDD §4.6 은
 *   스테이지당 **4–6픽**을 요구한다 → 평탄 구간에서 **12–18웨이브**가 필요하다.
 *   이전 계수(3 + density/11)는 평탄 구간에서 10웨이브 = 3픽밖에 나오지 않아
 *   로그라이트 층이 설계보다 얇았다 (`sigils.test.js` 가 이걸 잡았다).
 *
 *   튜토리얼 구간은 density 가 작아 자연히 짧게 남는다 (1-1 ≈ 4웨이브).
 */
function waveCountFor(density) {
    return Math.max(3, Math.min(18, Math.round(3 + density / 6)));
}

/** 목표 전투 시간(초) — 결과 화면의 ★ 판정 기준이 된다 */
function targetTimeFor(waves, isBoss) {
    const base = 34 + waves * 11;
    return Math.round(isBoss ? base * 1.25 : base);
}

/**
 * 인덱스 → 모드.
 * ★ 월드 안 인덱스(1~20)를 그대로 쓴다. 10 으로 접으면 변주가 월드당 2배로 나온다.
 */
function modeFor(MODES, index) {
    return MODES[String(index)] ?? "assault";
}

/**
 * 레인 배분. 결정론적으로 순환시킨다.
 * ★ 매 웨이브 3레인 전부에 뿌리면 "레인을 읽는" 플레이가 사라진다.
 *   초반은 1~2레인, 후반으로 갈수록 3레인으로 넓힌다.
 */
function lanesFor(waveIdx, totalWaves, spawnIdx) {
    const progress = waveIdx / Math.max(1, totalWaves - 1);
    const width = progress < 0.3 ? 1 : progress < 0.65 ? 2 : 3;
    const start = (waveIdx + spawnIdx) % 3;
    const lanes = [];
    for (let k = 0; k < width; k++) lanes.push((start + k) % 3);
    return lanes.sort((a, b) => a - b);
}

/**
 * ★ 밀도는 '마리 수'가 아니라 '위협 예산'이다.
 *   구더기 110마리와 무덤의 망령 110마리는 전혀 다른 스테이지다.
 *   머릿수로만 세면 엘리트만 모인 풀(3-19)이 전 조합 0% 가 된다 — 실제로 그랬다.
 *   각 적의 cost 를 소모 단가로 삼아 예산을 나눠 담는다.
 */
const REF_COST = 17;

function countForBudget(ENEMY, budget, enemyId) {
    const cost = Math.max(1, ENEMY.get(enemyId)?.cost ?? REF_COST);
    return Math.max(1, Math.round(budget / cost));
}

/**
 * 한 스테이지의 웨이브 테이블을 만든다.
 *
 * 배분 원칙:
 *   - emphasis 로 지정된 적은 그 스테이지의 '문제'다. 예산 지분을 크게 준다.
 *   - 뒤 웨이브일수록 무거운 적의 비중이 오른다.
 *   - 보스는 마지막 웨이브에 단독 1체.
 */
function buildWaves(ENEMY, C, beat, density, waves, world) {
    const pool = beat.pool.filter((id) => ENEMY.has(id));
    if (!pool.length) throw new Error(`${world}-${beat.index}: 유효한 적이 없다`);

    // 가벼운 적부터 정렬 — 웨이브가 진행될수록 뒤쪽(무거운 쪽)을 쓴다
    const sorted = [...pool].sort(
        (a, b) => (ENEMY.get(a).cost ?? 0) - (ENEMY.get(b).cost ?? 0) || a.localeCompare(b)
    );

    const bossWave = beat.boss ? 1 : 0;
    const normalWaves = waves - bossWave;
    const table = [];
    // 예산 단위로 환산한다 (density 는 '기준 코스트 적 몇 마리 분량'이라는 뜻)
    let remaining = density * REF_COST;
    const totalBudget = remaining;

    for (let w = 0; w < normalWaves; w++) {
        const isLast = w === normalWaves - 1;
        // 후반 웨이브에 예산을 더 싣는다 — 압박이 우상향해야 한다
        const share = isLast
            ? remaining
            : Math.max(
                  REF_COST,
                  Math.round((totalBudget / normalWaves) * (0.7 + (w / normalWaves) * 0.6))
              );
        const n = Math.min(remaining, share);
        remaining -= n;
        if (n <= 0) continue;

        // 이 웨이브가 쓸 적 종류: 진행도에 따라 무거운 쪽으로 창을 민다
        const progress = normalWaves > 1 ? w / (normalWaves - 1) : 1;
        const pick = [];
        const lead = Math.min(sorted.length - 1, Math.floor(progress * sorted.length));
        pick.push(sorted[lead]);
        if (beat.emphasis && !pick.includes(beat.emphasis) && ENEMY.has(beat.emphasis)) {
            pick.push(beat.emphasis);
        } else if (sorted.length > 1 && w % 2 === 1) {
            pick.push(sorted[(lead + 1) % sorted.length]);
        }

        const spawns = [];
        // emphasis 가 있으면 그쪽에 60% 를 준다 — 그 스테이지의 '문제'가 흐려지면 안 된다
        const weights =
            pick.length === 2 && pick[1] === beat.emphasis
                ? [0.4, 0.6]
                : pick.map(() => 1 / pick.length);

        let left = n;
        pick.forEach((id, i) => {
            const budget = i === pick.length - 1 ? left : Math.max(1, Math.round(n * weights[i]));
            left -= budget;
            if (budget <= 0) return;
            spawns.push({
                id,
                count: countForBudget(ENEMY, budget, id),
                lanes: lanesFor(w, normalWaves, i),
            });
        });

        if (spawns.length) table.push({ wave: w + 1, spawns });
    }

    if (beat.boss) {
        table.push({ wave: table.length + 1, spawns: [{ id: beat.boss, count: 1, lanes: [1] }] });
    }

    /**
     * ★★ 후반 급증 (surge) — **난이도의 모양을 바꾸는 손잡이.**
     *
     *   `difficultyMult` 는 적 스탯을 균일하게 올린다. 그래서 전투가
     *   **처음부터** 어려워지고, 플레이어는 웨이브 5~6 에서 무너진다.
     *   "설계된 첫 패배"에서는 그게 정확히 틀린 모양이다 — 실측해 보니
     *   1-9 패배 시 적 잔여 HP 중앙값이 **67.5%** 였다. 3분의 2를 남기고 지면
     *   "편성을 바꾸면 넘겠다"가 아니라 "이건 벽이다"로 읽히고, 거기서 이탈한다.
     *   P7-03 이 요구하는 것은 잔여 **5–15%** 다.
     *
     *   그래서 총량이 아니라 **분포**를 뒤로 민다. 앞 웨이브는 넘기게 두고
     *   마지막 몇 웨이브에서 무너지게 한다.
     *
     * ★ 머릿수 상한(maxBodies) **앞에서** 적용한다. 뒤에서 하면 상한을 넘겨
     *   포화 구간(어떤 편성을 짜도 똑같이 지는 구간)으로 넘어간다.
     *   앞에서 하면 상한이 비례 축소해 주므로 총량은 유지되고 모양만 바뀐다.
     */
    if (beat.surge) {
        const sw = beat.surge.waves ?? 3;
        const sm = beat.surge.mult ?? 2;
        const end = table.length - bossWave; // 보스 웨이브는 건드리지 않는다
        for (let i = Math.max(0, end - sw); i < end; i++) {
            for (const sp of table[i].spawns) sp.count = Math.max(1, Math.round(sp.count * sm));
        }
    }

    // ★ 머릿수 상한. 위협 예산만으로는 싼 적 풀에서 200마리가 나온다.
    //   6유닛 편성이 물리적으로 막을 수 있는 한계가 있고, 그 위로는
    //   난이도가 아니라 포화다 — 어떤 편성을 짜도 똑같이 진다.
    //   동시 180체 성능 예산과도 같은 방향의 제약이다.
    const total = table.reduce((a, w) => a + w.spawns.reduce((b, s) => b + s.count, 0), 0);
    if (total > C.maxBodies) {
        const k = C.maxBodies / total;
        for (const w of table) {
            for (const sp of w.spawns) sp.count = Math.max(1, Math.round(sp.count * k));
        }
    }
    return table;
}

function buildStage(ENEMY, C, MODES, world, beat) {
    const index = beat.index;
    const isBoss = !!beat.boss;
    const mode = modeFor(MODES, index);
    let density = densityFor(C, world.world, index);
    if (beat.bossMult) density = Math.round(density * beat.bossMult);

    // ★ 버티기는 소환 경제를 통째로 빼앗는 모드다 (개막 전개 6기가 전부).
    //   같은 물량을 그대로 주면 증원이 없는 쪽만 일방적으로 진다 —
    //   실제로 1-13 이 승률 0% 벽이 됐다. 물량 예산을 따로 준다.
    const modeMult = C.modeDensityMult?.[mode];
    if (modeMult) density = Math.max(2, Math.round(density * modeMult));

    const waves = waveCountFor(density);
    const waveTable = buildWaves(ENEMY, C, beat, density, waves, world.world);

    const stage = {
        id: `${world.world}-${index}`,
        world: world.world,
        index,
        mode,
        faction: world.faction,
        /**
         * ★★ 비트별 방주 HP override (2026-08-04).
         *
         *   방주 HP 는 월드 상수인데 스폰량은 밀도 램프로 늘어난다. 두 값을 비교하는
         *   코드가 어디에도 없어서, **월드 1 의 앞 세 스테이지는 산술적으로 질 수가
         *   없었다** — 스폰되는 적 전부가 방주에 자폭해도 HP 가 남는다
         *   (1-1: 22마리 × 2 = 44 피해 vs 방주 100).
         *   1-1 이 가르치려는 것이 "소환 = 승리"인데, 아무것도 소환하지 않아도
         *   이겨서 정반대를 가르치고 있었다.
         *
         *   월드 상수를 낮추면 뒤 스테이지가 같이 어려워지므로 **비트 단위**로 연다.
         *   검증은 `tools/validate-data.mjs` 의 "패배가 도달 가능한가" 검사가 한다.
         */
        arkHp: beat.arkHp ?? world.arkHp,
        waves: waveTable.length,
        targetTimeSec: targetTimeFor(waveTable.length, isBoss),
        teaches: beat.teaches,
        waveTable,
    };

    // ★ 설계된 첫 패배는 데이터에 명시한다. 밸런스 게이트가 이 플래그로
    //   "여기는 30–45% 가 정상"임을 알고, 나머지 구간에서는 벽으로 취급한다.
    if (world.designedDefeatIndex === index) stage.designedDefeat = true;

    // ★ 스테이지 고유 배율. 전역 배율로 특정 스테이지만 조이려 하면
    //   다른 월드가 통째로 무너진다 — 실제로 그래서 도입했다.
    //   (1-9 = 3.6 은 200시드 실측값이다. 33-execution-plan.md P7-01 표 참조)
    if (beat.difficultyMult) stage.difficultyMult = beat.difficultyMult;

    /**
     * ★★ **웨이브 사이 방주 회복** (2026-08-05 배선).
     *
     *   `logic/stageConfig.js` 는 `stage.arkRegenPerWave` 를 오래전부터 읽고 있었고
     *   `tools/tune-first-defeat.mjs` 는 그것을 축으로 튜닝하는데, **생성기가 그 값을
     *   스테이지에 실어 주지 않았다.** 즉 데이터에 적을 방법이 없어서 켠 스테이지가
     *   0개였다 — "구현은 있는데 켤 수 없는 손잡이"였다.
     *
     * ★ 이 축이 필요한 이유는 `tune-first-defeat.mjs` 상단에 있다: 총압력만 올리면
     *   **초반에** 무너져 "벽"으로 읽히고, 내리면 승률이 뜬다. 회복은 초반 누적을
     *   상쇄하고 후반 급증이 그것을 넘어선다 — 초반 생존과 후반 치사성을 분리한다.
     */
    if (beat.arkRegenPerWave) stage.arkRegenPerWave = beat.arkRegenPerWave;

    return stage;
}

/* ────────────────────────────────────────────────────────────────
 * 2. 후처리 — **예전에는 파이프라인 밖의 별도 스크립트였다.**
 *
 * ★ 후처리를 밖에 두면 생성기가 그것을 모른다. `npm run gen:stages` 한 번이면
 *   실측으로 얻은 조정이 통째로 날아간다 (실제로 18 스테이지가 그 상태였다).
 *   수치는 코드가 아니라 `worlds.json:postProcess` 에 있다 (절대 규칙 4).
 * ──────────────────────────────────────────────────────────────── */

/** 한 스폰 항목이 실제로 내보내는 적 수 (레인마다 count 만큼 나온다) */
const bodies = (sp) => sp.count * (sp.lanes?.length ?? 3);

/**
 * FLYING 비율 상한 (B16 방벽 필수성).
 *
 * ★★ FLYING 은 블로킹이 불가능하다. 한 스테이지의 절반 이상이 비행이면
 *   **방벽 슬롯이 순수 손해**가 되어 "방벽 없는 편성"이 균형 편성을 이긴다.
 *   실측: 3-19 는 적의 55% 가 비행이었고 no_blocker 100% vs balanced 33.7% 였다.
 *   B16(방벽 필수성)이 데이터 때문에 뒤집힌 것이지 규칙이 틀린 게 아니다.
 *
 * 초과분은 **같은 세력의 지상 적** 중 비용이 가장 가까운 것으로 바꾼다.
 * (세력 = 월드 정체성이므로 섞지 않는다)
 *
 * ★ 멱등이다 — 이미 상한 아래면 아무것도 하지 않는다. 두 번 돌려도 같다.
 */
export function capFlyingRatio(stages, enemies, cap) {
    if (!(cap > 0) || cap >= 1) return [];

    const E = new Map(enemies.map((e) => [e.id, e]));
    const isAir = (id) => (E.get(id)?.tags ?? []).includes("FLYING");

    /** 같은 세력의 지상 적 중 비용이 가장 가까운 것 */
    const twinCache = new Map();
    function groundTwin(airId) {
        if (twinCache.has(airId)) return twinCache.get(airId);
        const a = E.get(airId);
        const pool = enemies.filter(
            (e) => e.faction === a.faction && !(e.tags ?? []).includes("FLYING")
        );
        const id = pool.length
            ? pool.reduce((best, e) =>
                  Math.abs(e.cost - a.cost) < Math.abs(best.cost - a.cost) ? e : best
              ).id
            : null;
        twinCache.set(airId, id);
        return id;
    }

    const log = [];
    for (const st of stages) {
        const all = st.waveTable.flatMap((w) => w.spawns);
        const total = all.reduce((n, sp) => n + bodies(sp), 0);
        let air = all.filter((sp) => isAir(sp.id)).reduce((n, sp) => n + bodies(sp), 0);
        if (total === 0 || air / total <= cap) continue;

        const before = air / total;
        // 뒤쪽 웨이브부터 바꾼다 — 초반 웨이브의 "비행이 온다" 학습은 남긴다
        const airSpawns = [];
        for (const w of st.waveTable) for (const sp of w.spawns) if (isAir(sp.id)) airSpawns.push(sp);
        airSpawns.reverse();

        for (const sp of airSpawns) {
            if (air / total <= cap) break;
            const twin = groundTwin(sp.id);
            if (!twin) continue;
            air -= bodies(sp);
            sp.id = twin;
        }
        log.push({ id: st.id, before, after: air / total });
    }
    return log;
}

/* ────────────────────────────────────────────────────────────────
 * 3. 진입점
 * ──────────────────────────────────────────────────────────────── */

/**
 * `worlds.json` + `enemies.json` → 스테이지 배열.
 *
 * @param {object} worldsData `src/game/data/worlds.json`
 * @param {object} enemiesData `src/game/data/enemies.json`
 * @param {object} [overrides] 스윕용 임시 덮어쓰기 `{ flyingCap }`.
 *        **정식 값은 worlds.json 에 있다.** 여기 넣은 값은 파일에 기록되지 않는다.
 * @returns {{ stages: object[], missing: string[], flyingLog: object[] }}
 */
export function generateStages(worldsData, enemiesData, overrides = {}) {
    const enemies = enemiesData.enemies;
    const ENEMY = new Map(enemies.map((e) => [e.id, e]));
    const C = worldsData.densityCurve;
    const MODES = worldsData.modeRotation;
    const P = worldsData.postProcess ?? {};

    const stages = [];
    const missing = [];

    for (const world of worldsData.worlds) {
        for (const beat of world.beats) {
            for (const id of [...beat.pool, beat.boss].filter(Boolean)) {
                if (!ENEMY.has(id)) missing.push(`${world.world}-${beat.index}: ${id}`);
            }
            stages.push(buildStage(ENEMY, C, MODES, world, beat));
        }
    }

    /**
     * ★ 후처리는 비행 상한 하나뿐이다. 모드별 스폰 보정(`scaleModeSpawns`)은
     *   버티기 모드와 함께 2026-08-04 경량화로 사라졌다.
     */
    const flyingLog = capFlyingRatio(stages, enemies, overrides.flyingCap ?? P.flyingCap);

    return { stages, missing, flyingLog };
}
