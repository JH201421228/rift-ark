# 22. 결정론적 시뮬레이션 스펙

> **이 프로젝트에서 가장 레버리지가 큰 아키텍처 결정.**
> 전투 수학 전체를 `src/game/logic/` 의 **Phaser import 0, DOM 0, `Math.random()` 0** 인 순수 함수로 둔다.
> 여기서 결정론 · 밸런스 자동검증 · 리플레이 · 백그라운드 복귀 안전성이 **한꺼번에** 나온다.

---

## 1. 원칙

| # | 규칙 | 위반 시 |
|---|---|---|
| 1 | `src/game/logic/**` 는 `phaser` 를 import 하지 않는다 | ESLint 규칙으로 차단 |
| 2 | `Math.random()` 금지. 시드 PRNG만 | 결정론 붕괴 → 밸런스 하네스·리플레이 무의미 |
| 3 | `Date.now()` / `new Date()` 금지. 시뮬 시간 `state.t` 만 | 동일 |
| 4 | 고정 틱 **30Hz** (33.333ms). 렌더 프레임과 완전 분리 | 프레임률에 따라 밸런스가 달라짐 |
| 5 | 시뮬은 렌더를 모른다. 렌더가 시뮬을 읽는다 | 단방향 의존 유지 |
| 6 | 부동소수점 연산 순서를 고정한다 (배열 순회 순서 결정론) | 플랫폼 간 재현성 |

**ESLint 강제**
```js
// eslint.config.js
{
  files: ['src/game/logic/**/*.js'],
  rules: {
    'no-restricted-imports': ['error', { patterns: ['phaser', '@/game/scenes/*', '@/store/*'] }],
    'no-restricted-globals': ['error', 'window', 'document', 'navigator', 'performance'],
    'no-restricted-properties': ['error',
      { object: 'Math', property: 'random', message: 'rng.js의 시드 PRNG를 사용하세요' },
      { object: 'Date', property: 'now',    message: 'state.t를 사용하세요' },
    ],
  },
}
```

---

## 2. 시드 PRNG

```js
// src/game/logic/rng.js
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randInt(rng, min, max) { return min + Math.floor(rng() * (max - min + 1)); }
export function pick(rng, arr)         { return arr[Math.floor(rng() * arr.length)]; }
export function shuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
```

**RNG 스트림 분리.** 하나의 스트림을 공유하면 한 시스템의 호출 횟수 변경이 다른 시스템의 결과를 바꾼다.

```js
state.rng = {
  spawn:  mulberry32(seed ^ 0x1111),   // 웨이브 생성
  combat: mulberry32(seed ^ 0x2222),   // 크리티컬, 처형 판정
  sigil:  mulberry32(seed ^ 0x3333),   // 각인 드래프트
  fx:     mulberry32(seed ^ 0x4444),   // 연출 변형 (시뮬 무관, 분리 필수)
};
```

> **게임 전체에 확률형 요소가 없다** (2026-08-04). 여기 있는 RNG 스트림은 전투 · 스폰 · 각인 드래프트뿐이고, 전부 시드 결정론이다.

---

## 3. 상태 구조

```js
// src/game/logic/state.js
export function createSim(stageCfg, loadout, metaMods, seed) {
  return {
    // 시간
    t: 0,                       // 시뮬 밀리초 (틱 × 33.333)
    tick: 0,

    // 자원
    mana: stageCfg.startMana,
    manaRegen: 6.0,
    riftEnergy: 0,
    riftRegen: 2.0,

    // 방주
    arkHp: stageCfg.arkHp,
    arkHpMax: stageCfg.arkHp,

    // 웨이브
    wave: 0,
    waveTotal: stageCfg.waves,
    nextWaveAt: 0,
    tempoShifted: false,
    tempoShiftWave: Math.floor(stageCfg.waves * 0.6),

    // 엔티티 — 레인별 정렬 배열이 핵심
    lanes: [
      { allies: [], enemies: [] },   // lane 0
      { allies: [], enemies: [] },   // lane 1
      { allies: [], enemies: [] },   // lane 2
    ],
    air: { allies: [], enemies: [] },
    projectiles: [],

    // 지휘관
    commander: {
      x: 120, lane: 1, hp: 0, hpMax: 0,
      auraRadius: 96, auraPower: 1.0,
      stunnedUntil: 0,
      spells: [ /* { id, cost, cooldownUntil } */ ],
    },

    // 편성
    loadout,                    // [{ unitId, baseCost, ... }] 6개
    summonCounts: {},           // { unitId: n }
    summonDecayAt: {},          // { unitId: t }

    // 각인
    sigils: [],
    pendingDraft: null,

    // 결과
    phase: 'battle',            // battle | draft | victory | defeat
    stats: { kills: 0, damageDealt: {}, damageBlocked: {}, breaches: [] },

    // RNG
    rng: makeStreams(seed),
    seed,

    // 이벤트 큐 — 렌더가 소비
    events: [],
  };
}
```

### 3.1 엔티티

```js
{
  id: 17,                 // 증가 정수 (렌더가 스프라이트 매칭에 사용)
  defId: 'elf_sharpshooter',
  side: 'ally' | 'enemy',
  lane: 0 | 1 | 2 | 'air',
  x: 120.5,
  hp: 340, hpMax: 340,
  atk: 42, def: 10, res: 0,
  dmgType: 'physical' | 'arcane' | 'holy',
  role: 'BLOCKER' | 'MELEE' | 'RANGED' | 'CASTER' | 'SUPPORT' | 'SPECIALIST' | 'SIEGE' | 'FLYER',
  tags: ['ARMORED', 'FLYING'],
  range: 40,
  speed: 18,              // px/초
  atkInterval: 900,       // ms
  atkReadyAt: 0,
  blockCount: 0,          // BLOCKER만
  blockedBy: null,        // 이 유닛을 막고 있는 상대 id
  blocking: [],           // 이 유닛이 막고 있는 상대 id들
  shield: 0,
  statuses: [],           // [{ type, until, magnitude }]
  pushX: 0,               // 다음 이동 스텝에서 x 에 더할 밀어냄(px)
  inAura: false,          // 매 틱 갱신
}
```

> ★★ **위치를 바꾸는 스텝은 `stepMovement` 하나뿐이다.** 명중 시점(오라 안 `SIEGE`
> 의 밀어내기 · `logic/aura.js:applyAuraOnHit`)에는 `pushX` 에 **예약만** 하고,
> 다음 이동 스텝이 그것을 소비한 뒤 `resortLane` 이 정렬을 복구한다.
> 명중 자리에서 `x` 를 직접 밀면 §3.2 의 x 오름차순이 틱 중간에 깨지고,
> 그러면 다음 틱의 병합 스윕이 **잘못된 이웃을 타겟으로 고른다.**

### 3.2 왜 레인별 정렬 배열인가

**레인은 1차원 문제다.** `lanes[i].enemies` 를 `x` 오름차순으로 유지하면:
- "가장 가까운 적" = 인접 인덱스 조회 → **O(1)**
- 사거리 내 적 목록 = 정렬 배열의 구간 → **O(k)**
- 물리 엔진 불필요

100+ 엔티티에서 순진한 O(n²) 충돌 검사 대비 **압도적으로 빠르고**, 결정론적이다.

삽입 시 이진 탐색으로 위치를 찾고, 이동 후에는 **인접 스왑 정렬**(거의 정렬된 배열에 O(n))로 유지한다.

---

## 4. 틱 스텝

```js
// src/game/logic/sim.js
export const TICK_MS = 1000 / 30;

export function step(s, cfg) {
  s.tick++;
  s.t += TICK_MS;
  s.events.length = 0;              // 이번 틱의 렌더 이벤트

  stepResources(s);                 // 마나/균열력 재생, 소환 코스트 감쇠
  stepWaveSpawn(s, cfg);            // 웨이브 스폰, 템포 시프트
  stepAura(s);                      // inAura 플래그 갱신
  stepStatuses(s);                  // 버프/디버프 만료
  stepMovement(s);                  // 이동, 블로킹 판정
  stepCombat(s);                    // 타겟 선정, 공격, 데미지
  stepProjectiles(s);               // 발사체 이동, 명중  ← 양 진영이 함께 쓴다
  stepDeaths(s);                    // 사망 처리, 환급, 배열 정리
  stepBreach(s);                    // 방주 도달
  stepWinLose(s, cfg);              // 승패 판정
  return s;
}
```

**순서가 결정론의 일부다.** 순서를 바꾸면 결과가 바뀌므로 함부로 재배치하지 않는다.

> ★★ **누가 발사체를 쓰는가는 역할 하나가 정한다** — `logic/roles.js:PROJECTILE_ROLES`
> (`RANGED` · `CASTER` · `SIEGE` · `FLYER`). `tryAttack` 이 그 역할이면 `spawnProjectile` 로
> 빠지고 나머지는 그 자리에서 `applyDamage` 한다. **아군·적을 구분하지 않는다.**
>
> 2026-08-05 까지 적에게는 `role` 이 데이터에 없어 62/62 가 `MELEE` 로 정규화됐고,
> 그래서 **사거리 190 짜리 적이 즉발로 때렸다.** 규칙은 처음부터 양 진영을 보고
> 있었고 빈 것은 데이터였다 — 검사기가 아군만 보고 있었던 것이 그 침묵의 이유다
> (`24-data-schema.md` §2.2).

### 4.1 씬에서의 구동 (스파이럴 오브 데스 방지)

```js
// BattleScene.update()
update(time, delta) {
  if (this.paused) return;

  // ★ 클램프: Capacitor resume 후 delta가 수 분일 수 있다
  this._acc += Math.min(delta * this.speedMultiplier, 250);

  let steps = 0;
  while (this._acc >= TICK_MS && steps < 8) {   // 프레임당 최대 8틱
    step(this.sim, this.cfg);
    this.consumeEvents(this.sim.events);
    this._acc -= TICK_MS;
    steps++;
  }
  if (steps === 8) this._acc = 0;               // 따라잡기 포기

  const alpha = this._acc / TICK_MS;
  this.renderSim(this.sim, alpha);              // 위치 보간
}
```

- **250ms 클램프**가 백그라운드 복귀 시 "5분치 시뮬을 한 프레임에 계산"하는 사고를 막는다
- **배속(×2/×3)은 `speedMultiplier` 로 구현** — 시뮬 틱을 더 돌리고 렌더는 60fps 유지

#### ★ 전투를 끝내는 것은 승/패뿐이다 (`isTerminalPhase`)

`phase` 는 `battle | draft | victory | defeat` 를 오간다.
**`draft` 는 전투를 *멈추는* 상태이지 *끝내는* 상태가 아니다.**

```js
// ✗ 각인 드래프트가 열리는 순간 전투가 패배로 끝난다
if (this.sim.phase !== "battle") this.finishBattle();

// ✓ 종료 판정은 logic 이 소유한다
if (isTerminalPhase(this.sim.phase)) this.finishBattle();
if (this.sim.phase === "draft") this._acc = 0;  // 고민한 시간은 버린다
```

실제로 이 버그가 있었고, **유닛 테스트가 전혀 잡지 못했다** —
`runToCompletion()` 이 `draft` 를 스스로 처리해 이 경로를 타지 않기 때문이다.
씬이 시뮬 상태를 문자열로 직접 비교하기 시작하면 이런 구멍이 계속 생긴다.
**판정은 `logic/` 에 함수로 두고 씬은 그것을 부른다.**

---

## 5. 핵심 서브시스템

### 5.1 자원

```js
function stepResources(s) {
  const regen = s.tempoShifted ? s.manaRegen * 2 : s.manaRegen;
  s.mana = Math.min(s.manaMax, s.mana + regen * (TICK_MS / 1000));
  s.riftEnergy = Math.min(100, s.riftEnergy + s.riftRegen * (TICK_MS / 1000));

  // 소환 코스트 감쇠: 12초마다 카운트 -1
  for (const id in s.summonCounts) {
    if (s.t >= (s.summonDecayAt[id] ?? 0)) {
      s.summonCounts[id] = Math.max(0, s.summonCounts[id] - 1);
      s.summonDecayAt[id] = s.t + 12000;
    }
  }
}

export function summonCost(s, unitId, baseCost) {
  return Math.ceil(baseCost * Math.pow(1.18, s.summonCounts[unitId] ?? 0));
}
```

### 5.2 오라

```js
function stepAura(s) {
  const c = s.commander;
  const active = s.t >= c.stunnedUntil;
  const r2 = c.auraRadius * c.auraRadius;

  for (let li = 0; li < 3; li++) {
    const laneDy = Math.abs(LANE_Y[li] - LANE_Y[c.lane]);
    for (const u of s.lanes[li].allies) {
      if (!active) { u.inAura = false; continue; }
      const dx = u.x - c.x;
      u.inAura = (dx * dx + laneDy * laneDy) <= r2;
    }
  }
}
```

**오라는 레인을 가로지른다** — 인접 레인의 일부가 포함되므로 지휘관 위치가 진짜 판단이 된다.

역할별 효과는 `combat.js` / `movement.js` 가 `u.inAura` 를 읽어 분기한다. **지원 역할만 `!u.inAura` 로 반전.**

### 5.3 데미지

```js
// src/game/logic/combat.js
export function computeDamage(attacker, target) {
  const atk = attacker.atk;
  let dmg;
  switch (attacker.dmgType) {
    case 'physical':
      dmg = Math.max(atk * 0.1, atk - target.def);
      break;
    case 'arcane':
      dmg = Math.max(atk * 0.1, atk * (1 - target.res / 100));
      break;
    case 'holy': {
      const base = Math.max(atk * 0.1, atk * (1 - target.res / 100));
      const mul = target.tags.includes('CORRUPT') ? 1.6
                : target.tags.includes('LIVING')  ? 0.7 : 1.0;
      dmg = base * mul;
      break;
    }
  }
  if (target.shield > 0) { target.shield--; return { dmg: 0, absorbed: true }; }
  return { dmg, absorbed: false, effective: isEffective(attacker, target) };
}
```

`effective` / `absorbed` 플래그가 렌더의 "약점!" / "저항!" 표시를 만든다 (`02-design/18` §2.4).

### 5.4 블로킹

> ### ★★★ 블록은 **스티키**다 (2026-08-04 수정)
>
> 한 번 성립한 블록은 아래 셋 중 하나가 아니면 **풀리지 않는다.**
> ① 블로커가 죽거나 레인에서 사라짐 ② 사거리 이탈 ③ 용량 감소(오라 이탈 등)
>
> **왜 규약인가.** 예전 구현은 매 틱 `blockedBy` 를 전부 지우고 **가까운 순으로
> 다시** 배정했다. 용량 2 · 적 4 이면 붙잡히는 둘이 매 틱 교대하고, 풀려난 둘은
> 그 틱에 전진한다 — **넷 전부가 절반 속도로 계속 다가왔다.** §3.3 의
> "블록 슬롯이 남아 있으면 정지"가 지켜지지 않았다.
> 1초쯤이면 무리 전체가 `blockMinGap`(20) 바로 위에 뭉치고, 그 뒤로는 새 적이
> 올 때마다 **붙잡혀 있던 적**이 20 아래로 밀려 영구히 못 잡는 적이 된다.
> 화면에서는 "방벽을 간헐적으로 통과한다"로 보인다 (실제 제보).
> 자동 플레이 21회 표본에서 방벽 통과 88건 중 **9건은 슬롯이 비어 있는데도** 통과했다.
>
> **`blockMinGap` 은 '새로 잡을 때'의 규칙이지 '계속 잡고 있을 때'의 규칙이 아니다.**
> 이미 붙든 적에 minGap 을 적용해 놓아주면 그 적은 영구히 못 잡는 적이 된다.
>
> 검증: `src/game/logic/blocking.test.js`

```js
// 구현: src/game/logic/movement.js:stepBlocking — 두 단계다.
function stepBlocking(s) {
  for (const lane of s.lanes) {
    for (const a of lane.allies) a.blocking = 0;   // 용량만 초기화 (관계는 유지)

    // ① 성립한 블록을 먼저 지킨다 (스티키). 적은 x 오름차순이라 가까운 쪽이 우선.
    for (const e of lane.enemies) {
      if (e.blockedBy === -1) continue;
      const b = findBlocker(lane.allies, e.blockedBy);   // 죽었으면 null
      const gap = b ? e.x - b.x : 0;
      if (!b || gap <= 0 || gap > b.range || b.blocking >= cap(b)) { e.blockedBy = -1; continue; }
      b.blocking++;                                       // ★ minGap 을 보지 않는다
    }

    // ② 남은 슬롯만 새 적으로 채운다
    for (const b of lane.allies) {
      if (b.role !== 'BLOCKER') continue;
      for (const e of lane.enemies) {
        if (b.blocking >= cap(b)) break;
        if (e.blockedBy !== -1 || (e.tags & TAG.FLYING)) continue;
        if (e.x - b.x < s.cfg.combat.blockMinGap) continue;  // 이미 파고든 적은 뚫린 것
        if (e.x - b.x > b.range) break;
        e.blockedBy = b.id; b.blocking++;
        runHooks(s, HOOK.ON_BLOCK, ...);                    // ★ 성립 순간 1회
      }
    }
  }
}
const cap = (b) => b.blockCount + (b.inAura ? 1 : 0);   // 오라 보너스
```

### 5.5 각인

각인은 **시뮬 상태에 등록된 수정자**다. 각 서브시스템이 해당 훅에서 조회한다.

```js
// src/game/logic/sigils.js
export const SIGIL_HOOKS = {
  onSummon: [], onAttack: [], onKill: [], onBlock: [],
  onDamageTaken: [], onWaveStart: [], modifyStat: [],
};

export function applySigil(s, sigilId) {
  const def = SIGIL_DEFS[sigilId];
  s.sigils.push(sigilId);
  def.hooks.forEach(([hook, fn]) => s.hooks[hook].push(fn));
  checkEvolutions(s);              // 진화 조합 성립 여부
}
```

**진화 판정은 각인 획득 시점에 1회만** 수행한다. 매 틱 검사하지 않는다.

### 5.6 전투 모드 (GDD §4.8)

모드는 **난이도가 아니라 승리 조건**을 바꾼다. 규칙은 `src/game/logic/modes.js`,
수치는 `balance.json:modes`, 월드 표현은 `presenters/ModePresenter.js` 가 갖는다.

```js
// stepWinLose 의 판정 순서 — 순서 자체가 규칙이다
if (s.arkHp <= 0) return (s.phase = "defeat");   // ① 모든 모드 공통
const r = checkModeWinLose(s);                    // ② 모드 고유
if (r) return (s.phase = r);
if (!clearAllWavesWins(s.mode)) return;           // ③ 전 웨이브 격퇴는
//    격퇴·보스전에서만 승리다. 버티기·돌파·호위에서 인정하면 모드가 사라진다.
```

| 모드 | 승리 | 패배 | 시뮬에 추가되는 것 |
|---|---|---|---|
| `assault` | 전 웨이브 격퇴 | 방주 0 | — |
| `endure` | 제한 시간 생존 | 방주 0 | 개막 전개 후 **소환 잠금** |
| `breakthrough` | 균열 HP 0 | 방주 0 | 균열 오브젝트 (아군이 때린다) |
| `escort` | 수레가 균열 도달 | **수레 0** · 방주 0 | 수레 오브젝트 (적이 때린다) |
| `nemesis` | 보스 처치 | 방주 0 · **보스의 방주 도달** | 보스 id 추적 + **3페이즈 상태** |

**모드 상태(`s.modeState`)도 결정론의 일부다.** 수레 위치·균열 HP·개막 전개 순서가
비결정적이면 리플레이와 비동기 PvP 고스트가 무너진다. 그래서 개막 전개의 레인 배분은
`rng` 가 아니라 슬롯 인덱스 순환으로 정한다.

### 9.1 보스 페이즈 (`logic/boss.js`, P6-05)

`stepBoss` 는 `stepProjectiles` 뒤 · `stepDeaths` 앞에서 돈다.
**순서가 규칙이다** — 슬램이 죽인 아군이 같은 틱에 수거되어야 한다.

| 요소 | 규칙 |
|---|---|
| 페이즈 전환 | HP 비율이 `phases[i].atRatio` 이하가 되면 진입. **`phaseTelegraphMs`(800) 예고 후** 확정 |
| 예고 중 | 보스 `speed = 0`, `atkReadyAt = transitionAt` — 멈추고 아무것도 하지 않는다. **피해는 그대로 받는다** (무적 구간은 "쏟은 딜이 사라졌다"를 만든다) |
| 태그 | `e.tags = phase.tagMask` 로 통째 교체. `REGEN` 진입/이탈 시 `regenPerSec` 재계산 |
| 스탯 | `atk`/`speed`/`atkInterval` 은 **스폰 시점 원본 기준 배율** (누적 금지). `def`/`res` 는 **절대값** |
| 다중 돌파 | 한 번에 두 임계값을 뚫으면 도달한 **최종 페이즈로 1회** 전환 (예고를 쌓지 않는다) |
| 역행 | 없음. HP 가 회복돼도 페이즈는 내려가지 않는다 |
| 슬램 | `slamEveryMs` 주기. `slamTelegraphMs`(800) 전에 레인·좌표 확정 후 이벤트 발행 → 착탄 |
| 슬램 대상 | 지휘관이 `slamCommanderReach`(220) 안이면 **지휘관 레인**, 아니면 아군이 가장 많은 레인 (동수는 낮은 인덱스). **난수를 쓰지 않는다** |
| 전환 중 슬램 | 없음. 두 예고가 겹치면 읽을 수 없다 |

> **★ `def`/`res` 가 배율이 아니라 절대값인 이유.**
> `res` 는 0–100 퍼센트이고 대부분의 적은 `res: 0` 이다. 배율로 두면
> `WARDED` 태그를 붙여도 `0 × 1.5 = 0` 이라 **태그만 바뀌고 상성은 그대로**다.
> 실제로 그렇게 구현했다가 테스트에 잡혔다 — 상성을 만드는 것은 태그가 아니라
> 이 두 숫자다. 난이도 커브(`scaleEnemy`)도 `def`/`res` 는 건드리지 않으므로 일관된다.

> **★ 슬램이 지휘관 레인을 노리는 이유.**
> 동료는 자동 전투라 회피할 수 없다. 지휘관만 플레이어가 직접 움직이므로,
> 여기가 **회피가 실력이 되는 유일한 지점**이다. 맞으면 기절 → 오라 공백 →
> 전선 전체가 약해진다. 지휘관이 멀면 아군 최다 레인을 노려
> "뒤로 빼두면 무료"를 막는다.

> **★★ 슬램의 지휘관 피해에는 HP 비율 상한이 있다 (P6-06).**
> `min(atk × slamDamageMult × bossSlamCommanderMult, 지휘관 최대HP × bossSlamCommanderHpRatio)`
>
> 지휘관 HP 는 600 고정인데 보스 ATK 는 스테이지 지수 커브를 탄다 —
> 실측으로 1-10 보스 278, 3-20 보스 51,260 이다 (**184배**). 배율 하나로는
> 월드 1 에 맞추면 월드 2부터 전부 즉사고, 월드 3에 맞추면 월드 1 슬램이 무피해가 된다.
> 단위가 다른 두 값을 곱하고 있었던 것이다. 상한을 **최대 HP 비율(0.3 = 최소 4방)** 로
> 두면 월드가 몇 개 늘어나도 "한 방에 죽지 않는다"가 규칙으로 유지된다.
> 즉사로 두면 자동 조작이 매 슬램마다 기절해 오라가 영구 소멸한다.

> **★★ 보스가 방주에 닿으면 그 자리에서 패배다 (P6-06).**
> `stepBreach` 는 방주에 닿은 적을 **필드에서 제거한다.** 보스도 예외가 아니어서,
> 보스가 방어선을 지나쳐 걸어가면 필드가 비고 ③ "전 웨이브 격퇴 = 승리"가 발동해
> **보스를 못 잡았는데 승리**가 떴다. 보스를 강하게 만들수록 승률이 올라가는
> 역전이 실측으로 재현됐다 (P6-06 튜닝 중 보스 스테이지 20/20 이 '방주 도달 승리').
> `noteBossBreach` → `modeState.bossBreached` → `checkModeWinLose` 가 `defeat` 를 낸다.

**모드 파라미터를 스테이지 *총* 적 HP 에 비례시키지 않는다.** 총합은 웨이브 수에
비례해 부풀기 때문에 웨이브가 긴 스테이지에서 목표물이 같이 커진다.
균열은 *적 개체 평균 HP × N*, 수레는 *적 최대 공격력 × 피격 횟수* 기준이다.

### 5.7 렌더 이벤트 큐

시뮬은 렌더를 직접 호출하지 않고 **이벤트를 큐에 넣는다.**

```js
s.events.push({ type: 'attack', id: 17, targetId: 42, dmgType: 'physical' });
s.events.push({ type: 'damage', id: 42, amount: 31, effective: true });
s.events.push({ type: 'death',  id: 42, defId: 'goblin_fighter' });
s.events.push({ type: 'spawn',  id: 55, defId: 'elf_sharpshooter', lane: 1, x: 60 });
s.events.push({ type: 'tempo_shift' });
s.events.push({ type: 'breach', damage: 4 });
```

`BattleScene.consumeEvents()` 가 이를 읽어 트윈·이펙트·히트스톱·카메라를 구동한다.
**이 큐가 시뮬과 렌더의 유일한 접점이다.** 헤드리스 실행에서는 큐를 그냥 버린다.

---

## 6. 리플레이

```js
// 리플레이 = 시드 + 입력 로그
{
  version: 1,
  stageId: '4-12',
  seed: 918273,
  loadout: [...],
  metaMods: {...},                      // 레벨/랭크/장비 스냅샷
  inputs: [
    { tick: 12,  type: 'summon', unitId: 'elf_sharpshooter', lane: 1 },
    { tick: 48,  type: 'move',   x: 210, lane: 2 },
    { tick: 91,  type: 'spell',  spellId: 'rift_bolt', x: 400, lane: 0 },
    { tick: 150, type: 'sigil',  choice: 2 },
  ],
}
```

**용도**
- **비동기 PvP 고스트 배틀** — 상대 리플레이를 재생
- **서버 검증** — 클라이언트가 보고한 결과를 서버에서 동일 시드로 재실행해 대조 (치트 방지)
- **버그 리포트** — 유저가 리플레이 코드를 첨부
- **밸런스 분석** — 실제 플레이 로그를 대량 재실행

리플레이 크기: 90초 전투 기준 **약 1–3KB**. 저장 비용이 사실상 없다.

---

## 7. 결정론 유지 규칙

| 항목 | 규칙 |
|---|---|
| 배열 순회 | 항상 인덱스 오름차순. `for...of` 는 배열에만 (Object 순회 금지) |
| 객체 키 순회 | `Object.keys(o).sort()` 로 정렬 후 순회 |
| 부동소수점 | 연산 순서 고정. `reduce` 대신 명시적 루프 |
| 정렬 | 안정 정렬 보장 — 동점 시 `id` 로 타이브레이크 |
| 시간 | `state.t` 만. 실시간 참조 금지 |
| 난수 | 스트림 분리, 호출 순서 고정 |

**타이브레이크 예시**
```js
lane.enemies.sort((a, b) => (a.x - b.x) || (a.id - b.id));
```
`x` 가 같을 때 `id` 로 결정하지 않으면 플랫폼별 정렬 구현 차이로 결과가 갈린다.

---

## 8. 검증

```js
// src/game/logic/sim.test.js
import { describe, it, expect } from 'vitest';
import { createSim, step, TICK_MS } from './sim';

describe('결정론', () => {
  it('동일 시드는 동일 결과를 낸다', () => {
    const run = () => {
      const s = createSim(CFG, LOADOUT, MODS, 12345);
      for (let i = 0; i < 30 * 120; i++) step(s, CFG);   // 120초
      return { hp: s.arkHp, kills: s.stats.kills, phase: s.phase, t: s.t };
    };
    expect(run()).toEqual(run());
  });

  it('다른 시드는 다른 결과를 낸다', () => {
    const a = runSeed(1), b = runSeed(2);
    expect(a.kills).not.toBe(b.kills);
  });
});

describe('데미지 공식', () => {
  it('술식은 DEF를 무시한다', () => {
    const atk = { atk: 100, dmgType: 'arcane' };
    expect(computeDamage(atk, { def: 0,   res: 0, tags: [] }).dmg).toBe(100);
    expect(computeDamage(atk, { def: 999, res: 0, tags: [] }).dmg).toBe(100);
  });

  it('최소 피해 10%가 보장된다', () => {
    const atk = { atk: 100, dmgType: 'physical' };
    expect(computeDamage(atk, { def: 9999, res: 0, tags: [] }).dmg).toBe(10);
  });

  it('신성은 CORRUPT에 1.6배', () => {
    const atk = { atk: 100, dmgType: 'holy' };
    expect(computeDamage(atk, { def: 0, res: 0, tags: ['CORRUPT'] }).dmg).toBeCloseTo(160);
    expect(computeDamage(atk, { def: 0, res: 0, tags: ['LIVING'] }).dmg).toBeCloseTo(70);
  });
});
```

전체 밸런스 검증 코퍼스는 `27-testing-balance-harness.md` 참조.

---

## 9. 성능

| 항목 | 예산 |
|---|---|
| 1틱 실행 시간 (엔티티 120체) | **< 1.2ms** |
| 프레임당 최대 틱 | 8 (배속 ×3 대응) |
| 프레임당 시뮬 총 비용 | **< 4ms** (16.67ms 예산 중) |
| 메모리 할당 | **틱당 0 할당 목표** — 엔티티·발사체·이벤트 전부 풀링 |

**할당 0 전략:** `events` 배열은 `length = 0` 으로 재사용, 엔티티는 프리얼로케이트된 풀에서 대여, 임시 객체 생성 금지 (`{x, y}` 반환 대신 out 파라미터).

**측정:** `DebugScene` 이 틱 실행 시간의 이동 평균을 표시한다 (`tick` 줄).
계측은 `BattleScene.runSimulation` 이 하고 **개발 빌드에서만** 돈다 —
`import.meta.env.DEV` 는 빌드 시 리터럴이라 배포에서는 두 줄이 통째로 접힌다.
지수 이동 평균(계수 0.1)이라 배열을 쌓지 않는다 (절대규칙 7).
오버레이 자체는 `26-performance-budget.md` §10.
