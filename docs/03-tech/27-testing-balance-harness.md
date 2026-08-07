# 27. 테스트 & 밸런스 하네스

> **콘텐츠가 커지기 *전에* 구축한다.** 200 스테이지 × 44 유닛 × 75 각인을 손으로 밸런싱하는 것은 불가능하다.
> 이것이 `22-simulation-spec.md` 의 순수 시뮬레이션이 존재하는 진짜 이유다.

> ## ⚠ 2026-08-04 범위 절삭
>
> `npm run economy` 가 보는 것은 **둘뿐**이다: ① 필요 골드 ≤ 가용 골드,
> ② 목표 파워 ≥ 적 HP × 0.75. 방치 비중 게이트와 파편 게이트는 그 시스템과 함께 사라졌다.
> `f2p-power.mjs` 의 파워 모델도 **레벨 × 무기고 × 별 트리** 셋으로 줄었다.
> 상세: [`../04-plan/34-scope-cut.md`](../04-plan/34-scope-cut.md) §4

---

## 1. 왜 이것이 가능한가

시뮬이 **Phaser를 import하지 않고, 시드 PRNG만 쓰고, 고정 30Hz로 도는 순수 함수**이기 때문에:

- **Node에서 그대로 실행된다** — 캔버스도, jsdom도, 모킹도 필요 없다
- **결정론적이다** — 동일 시드 = 동일 결과
- **빠르다** — 90초 전투를 실시간의 수백 배 속도로 실행. 수천 판을 몇 초에 돌린다

---

## 2. Vitest 설정

```bash
npm i -D vitest @vitest/coverage-v8
```

```js
// vite.config.js 에 추가
export default defineConfig({
  // ...
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['src/game/logic/**'],
      thresholds: { lines: 85, functions: 85, branches: 75 },
    },
  },
});
```

```json
"scripts": {
  "test":          "vitest run",
  "test:watch":    "vitest",
  "test:coverage": "vitest run --coverage"
}
```

**커버리지 목표는 `src/game/logic/` 에만 건다.** Phaser 씬은 단위 테스트 대상이 아니다 (E2E/수동 QA 영역).

---

## 3. 단위 테스트

### 3.1 결정론

```js
// src/game/logic/sim.test.js
import { describe, it, expect } from 'vitest';
import { createSim, step } from './sim';
import { CFG, LOADOUT, MODS } from './__fixtures__';

const runToEnd = (seed, maxTicks = 30 * 300) => {
  const s = createSim(CFG, LOADOUT, MODS, seed);
  let n = 0;
  while (s.phase === 'battle' && n < maxTicks) { step(s, CFG); n++; }
  return { phase: s.phase, arkHp: s.arkHp, kills: s.stats.kills, ticks: n };
};

describe('결정론', () => {
  it('동일 시드는 동일 결과', () => {
    expect(runToEnd(12345)).toEqual(runToEnd(12345));
  });
  it('다른 시드는 다른 결과', () => {
    expect(runToEnd(1).kills).not.toBe(runToEnd(2).kills);
  });
  it('RNG 스트림이 서로 오염되지 않는다', () => {
    // 각인 드래프트 호출 횟수를 바꿔도 전투 결과가 동일해야 한다
    expect(runWithExtraSigilRolls(999).kills).toBe(runToEnd(999).kills);
  });
});
```

**세 번째 테스트가 중요하다.** RNG 스트림을 분리하지 않으면 한 시스템의 호출 횟수 변경이 다른 시스템의 결과를 바꿔서, 각인 하나 추가했을 뿐인데 전 스테이지 밸런스가 흔들린다.

### 3.2 데미지 공식

```js
describe('데미지', () => {
  it('물리는 DEF로 감산된다', () => {
    expect(computeDamage({ atk: 100, dmgType: 'physical' },
                         { def: 30, res: 0, tags: [] }).dmg).toBe(70);
  });
  it('술식은 DEF를 완전히 무시한다', () => {
    const a = { atk: 100, dmgType: 'arcane' };
    expect(computeDamage(a, { def: 0,   res: 0, tags: [] }).dmg).toBe(100);
    expect(computeDamage(a, { def: 999, res: 0, tags: [] }).dmg).toBe(100);
  });
  it('최소 피해 10%가 보장된다', () => {
    expect(computeDamage({ atk: 100, dmgType: 'physical' },
                         { def: 9999, res: 0, tags: [] }).dmg).toBe(10);
  });
  it('신성은 CORRUPT 1.6배 / LIVING 0.7배', () => {
    const a = { atk: 100, dmgType: 'holy' };
    expect(computeDamage(a, { res: 0, tags: ['CORRUPT'] }).dmg).toBeCloseTo(160);
    expect(computeDamage(a, { res: 0, tags: ['LIVING']  }).dmg).toBeCloseTo(70);
  });
});
```

### 3.3 오라

```js
describe('오라', () => {
  it('SUPPORT은 오라 밖에서만 작동한다', () => {
    const s = simWithSupport({ commanderX: 100, supportX: 105 });   // 오라 안
    step(s, CFG);
    expect(healApplied(s)).toBe(0);

    const s2 = simWithSupport({ commanderX: 100, supportX: 400 });  // 오라 밖
    step(s2, CFG);
    expect(healApplied(s2)).toBeGreaterThan(0);
  });

  it('BLOCKER는 오라 안에서 블록 수가 +1 된다', () => { /* ... */ });

  it('지휘관 기절 중에는 오라가 없다', () => { /* ... */ });
});
```

### 3.4 코스트 상승

```js
describe('소환 코스트', () => {
  it('타입별로 1.18배씩 상승한다', () => {
    const s = createSim(CFG, LOADOUT, MODS, 1);
    expect(summonCost(s, 'archer', 30)).toBe(30);
    s.summonCounts.archer = 1; expect(summonCost(s, 'archer', 30)).toBe(36);
    s.summonCounts.archer = 3; expect(summonCost(s, 'archer', 30)).toBe(50);
  });
  it('다른 타입은 영향을 받지 않는다', () => {
    const s = createSim(CFG, LOADOUT, MODS, 1);
    s.summonCounts.archer = 5;
    expect(summonCost(s, 'tank', 30)).toBe(30);
  });
  it('12초마다 감쇠한다', () => { /* ... */ });
});
```

---

## 4. 헤드리스 밸런스 하네스

### 4.1 실행기

```js
// tools/balance.mjs
import { createSim, step } from '../src/game/logic/sim.js';
import { buildStageConfig } from '../src/game/logic/stageConfig.js';
import { LOADOUT_ARCHETYPES } from './loadouts.mjs';
import { readFile, writeFile } from 'node:fs/promises';

const STAGES = JSON.parse(await readFile('src/game/data/stages.json','utf8')).stages;
const SEEDS  = Number(process.env.SEEDS ?? 300);

const rows = [['stageId','loadout','winRate','avgSec','avgArkHp','star2Rate','star3Rate']];

for (const stage of STAGES) {
  const cfg = buildStageConfig(stage);
  // 그 시점의 "무과금 도달 가능 최대 파워" 를 자동 산출
  const mods = estimateF2PPower(stage.index + (stage.world - 1) * 20);

  for (const lo of LOADOUT_ARCHETYPES) {
    let wins = 0, secSum = 0, hpSum = 0, s2 = 0, s3 = 0;

    for (let seed = 0; seed < SEEDS; seed++) {
      const s = createSim(cfg, lo.units, mods, seed);
      let ticks = 0;
      while (s.phase === 'battle' && ticks < 30 * 400) { step(s, cfg); ticks++; }
      const sec = ticks / 30;
      if (s.phase === 'victory') {
        wins++; secSum += sec; hpSum += s.arkHp;
        if (s.arkHp >= s.arkHpMax * 0.9) s2++;
        if (sec <= stage.targetTimeSec)  s3++;
      }
    }
    rows.push([stage.id, lo.id,
      (wins/SEEDS*100).toFixed(1),
      wins ? (secSum/wins).toFixed(1) : '-',
      wins ? (hpSum/wins).toFixed(1) : '-',
      (s2/SEEDS*100).toFixed(1),
      (s3/SEEDS*100).toFixed(1)]);
  }
}

await writeFile('balance-report.csv', rows.map(r => r.join(',')).join('\n'));
console.log(`✔ ${STAGES.length} 스테이지 × ${LOADOUT_ARCHETYPES.length} 편성 × ${SEEDS} 시드`);
```

### 4.2 편성 아키타입

시뮬레이터는 사람이 만들 법한 편성 패턴을 대표해야 한다.

```js
// tools/loadouts.mjs
export const LOADOUT_ARCHETYPES = [
  { id: 'recommended', units: /* 스테이지 프리뷰 기반 자동 생성 */ },
  { id: 'balanced',    units: ['blocker','melee','ranged','caster','support','siege'] },
  { id: 'physical_only', units: [/* 전부 물리 */] },      // 상성 실패 검증용
  { id: 'arcane_only',   units: [/* 전부 술식 */] },
  { id: 'holy_only',     units: [/* 전부 신성 */] },
  { id: 'no_blocker',    units: [/* 방벽 없음 */] },       // 구조적 실패 검증용
  { id: 'spam_cheapest', units: [/* 최저가 1종 반복 */] }, // 스팸 억제 검증용
  { id: 'all_legendary', units: [/* 최고가만 */] },        // 코스트 과부하 검증용
];
```

### 4.3 무과금 파워 추정

```js
// 그 스테이지 시점에 무과금이 도달 가능한 최대 파워를 산출
export function estimateF2PPower(globalStage) {
  const gold   = cumulativeGold(globalStage);
  const shards = cumulativeShards(globalStage);
  const stars  = cumulativeStars(globalStage);
  return {
    avgLevel:  solveMaxLevel(gold),
    avgRank:   solveMaxRank(shards),
    gearTier:  solveGearTier(globalStage),
    starTree:  solveStarTree(stars),
  };
}
```

**이 함수가 "벽 = 편성 퍼즐" 명제를 검증 가능하게 만든다.** 무과금 최대 파워로 승률 55%를 못 넘으면 그것은 경제 벽이다.

---

## 5. 검증 코퍼스 (하드 게이트)

```js
// tools/balance-check.mjs — npm run balance:check
```

| # | 검사 | 통과 기준 | 게이트 |
|---|---|---|---|
| **B1** | 결정론 | 동일 시드 2회 완전 일치 | **하드** |
| B2 | 튜토리얼 승률 | 스테이지 1–10 `recommended` 승률 **85–95%** | 하드 |
| B3 | 설계된 첫 패배 | 스테이지 1-9 승률 **30–45%**, 패배 시 적 잔여 HP **5–15%** | 하드 |
| **B4** | 구간 통과 가능성 | 10스테이지 구간 최종, 무과금 최대 파워 + `recommended` 승률 **≥55%** | **하드** |
| B5 | 상성 유효성 | 완전 불일치 편성 승률 **<15%**, 정답 편성 **>75%** | 하드 |
| **B6** | 스팸 억제 | `spam_cheapest` 승률 < `balanced` 승률 (전 스테이지) | **하드** |
| **B7** | 등급 유용성 | **44 동료 전원이 최소 1개 스테이지의 최적 편성에 포함** | **하드** |
| B8 | 편성 다양성 | 전 스테이지 최적 편성에서 상위 6종 사용률 합 **<55%** | 소프트 |
| B9 | 전투 길이 | 일반 **90–150초**, 보스 **180–240초** (평균) | 소프트 |
| B10 | ★2 달성률 | `recommended` 기준 **45–60%** | 소프트 |
| B11 | ★3 달성률 | **20–35%** | 소프트 |
| B12 | 지휘관 기여 | 자동 위치 모드 효율 **65–75%** | 소프트 |
| B13 | 각인 밸런스 | 각인별 픽률 **3–12%** | 소프트 |
| B14 | 진화 도달률 | 일반 스테이지에서 진화 1개 이상 완성 **25–40%** | 소프트 |
| B15 | 경제 정합 | 100스테이지 진행 시 획득 골드 / 필요 비용 = **1.05–1.25** | 하드 |
| B16 | 방벽 필수성 | `no_blocker` 승률이 스테이지 15 이후 **<20%** | 하드 |
| B17 | 코스트 과부하 | `all_legendary` 승률 < `balanced` (스테이지 30 이전) | 소프트 |

**하드 게이트 실패 = 빌드 차단.** 소프트는 경고 후 통과.

```json
"scripts": {
  "balance":       "node tools/balance.mjs",
  "balance:check": "node tools/balance.mjs && node tools/balance-check.mjs",
  "balance:quick": "SEEDS=50 node tools/balance.mjs"
}
```

**환경 변수** — 튜닝 반복용 필터. 최종 확인은 반드시 필터 없이 돌린다.

| 변수 | 예 | 효과 |
|---|---|---|
| `SEEDS` | `SEEDS=30` | 시드 수 (기본 300) |
| `LOADOUTS` | `LOADOUTS=recommended,turtle` | 편성 아키타입 필터 |
| `STAGES` | `STAGES='1-(5\|10)$'` | 스테이지 id 정규식 |
| `DIFFICULTY` | `DIFFICULTY=hard` | 난이도 (P6-10). 결과는 `balance-report-hard.csv` 로 분리 저장된다 |
| `OUT` | `OUT=tmp.csv` | 출력 파일 |

> **하드는 "데이터를 읽어서" 검증할 수 없다.** 스폰 수 배율은 승률에 비선형으로
> 작용하고 광역 편성과 단일 대상 편성이 전혀 다르게 반응한다. 같은 시드·같은
> 편성으로 두 난이도를 각각 돌려 비교하는 것이 유일한 검증이다.

---

## 6. 기획자 워크플로

```
1. src/game/data/*.json 수정
2. npm run data:validate     → 스키마 + 참조 정합성
3. npm run balance:quick     → 50시드, 약 30초
4. balance-report.csv 확인   → 승률/시간/별 분포
5. npm run balance:check     → 300시드 풀 검증
6. 통과하면 커밋
```

> **엔지니어 개입 없이 이 사이클이 돌아야 한다.** 이것이 라이브옵스 케이던스(월 8–15 이벤트)를 가능하게 하는 전제 조건이다.

**리포트 시각화:** `balance-report.csv` 를 읽어 스테이지별 승률 히트맵을 HTML로 생성하는 `tools/balance-report.mjs` 를 함께 제공한다. 벽 구간이 빨간 띠로 즉시 보인다.

---

## 7. 회귀 스냅샷

밸런스 변경의 **의도하지 않은 파급**을 잡는다.

```js
// tools/balance-snapshot.mjs
// 기준 커밋의 balance-report.csv 와 현재를 비교
// 변경 의도가 없던 스테이지에서 승률이 ±8%p 이상 변하면 경고
```

**사용 예:** "궁수 공격력만 5% 올렸는데 스테이지 47 승률이 22%p 떨어졌다" 를 커밋 전에 발견한다.

---

## 8. 텔레메트리 ↔ 시뮬 대조

출시 후 **실제 플레이 데이터와 시뮬 예측을 대조**한다.

| 비교 | 의미 |
|---|---|
| 실제 승률 ≪ 시뮬 승률 | 플레이어가 최적 편성을 못 찾고 있다 → **UI/프리뷰/진단 문제** |
| 실제 승률 ≫ 시뮬 승률 | 시뮬이 놓친 강력한 전략이 있다 → 밸런스 재검토 |
| 실제 전투 시간 ≫ 시뮬 | 플레이어가 소극적으로 플레이 → 템포 설계 재검토 |
| 특정 유닛 사용률 ≪ 시뮬 최적 | 유닛이 강한데 **덜 매력적으로 보인다** → 표현/설명 문제 |

**"강한데 안 쓰인다"는 밸런스 문제가 아니라 커뮤니케이션 문제다.** 이 구분을 데이터로 할 수 있다는 것이 이 하네스의 숨은 가치다.

---

## 9. E2E / 수동 QA

시뮬로 검증할 수 없는 영역.

| 영역 | 방법 |
|---|---|
| 연출 타이밍 (히트스톱, 카메라) | 수동 플레이 + 영상 프레임 분석 |
| 입력 반응성 | 실기기 수동 |
| UI 레이아웃 (한글 오버플로) | 스크린샷 자동 캡처 + 육안 |
| 생명주기 (백그라운드/복귀) | 실기기 시나리오 테스트 (`25` §13) |
| 세이브 마이그레이션 | 이전 버전 세이브 파일 아카이브 + 자동 로드 테스트 |
| 결제 흐름 | 스토어 샌드박스 |
| 크래시 | Crashlytics / Sentry |

**세이브 마이그레이션 테스트는 자동화한다.** 매 릴리스의 세이브 샘플을 `test/fixtures/saves/` 에 보관하고, 신버전이 전부 로드 가능한지 CI에서 검증한다. **세이브 파손은 리뷰 폭탄 직행이다.**

---

## 10. CI 파이프라인

```yaml
# .github/workflows/ci.yml (개요)
jobs:
  quality:
    - npm ci
    - npm run lint
    - npm run data:validate
    - npm run test:coverage        # logic/ 커버리지 85%
    - npm run balance:check        # 하드 게이트 B1,B3,B4,B5,B6,B7,B15,B16
    - npm run perf:sim             # 틱 1.5ms 이내
    - npm run build
    - npm run perf:bundle          # 번들 크기
```

**PR에 balance-report 차이를 코멘트로 자동 게시**한다. 리뷰어가 밸런스 영향을 코드와 함께 본다.


---

## ★ 각인 감사 (`npm run sigils:audit`, 2026-08-04)

**각인이 선언한 효과를 실제로 내는가**를 18종 전부에 대해 확인한다.

방법은 **같은 시드로 두 번 돌리기**다 — 각인 없이 한 번, 각인만 얹어 한 번.
시뮬은 결정론이므로(시드 PRNG · 고정 30Hz 틱) 각인이 아무 일도 하지 않으면
두 결과가 **완전히 동일**하다. 하나라도 다르면 그 각인은 살아 있다.

```
✔ 관통 화살   24/24   projectileSpawn:addPierce
✔ 처형       10/24   onAttack:execute       ← 조건부(빈사인 적)라 판수가 낮다
```

> ★ 스테이지 4곳 × 시드 6개로 돈다. 각인마다 발동 조건이 다르기 때문이다 —
> 한 판만 보고 "효과 없음"이라고 말하면 그것이 거짓말이 된다.
>
> ★★ 이 도구가 답한 질문은 "각인이 작동하는가"였고, 답은 **작동한다**였다.
> 진짜 문제는 **화면에 표시가 없다**는 것이었고 그쪽을 고쳤다 (전투 HUD 각인 띠).
> 검사기는 "무엇이 고장났는지"만이 아니라 **"무엇이 고장나지 않았는지"** 도 말해 준다.
