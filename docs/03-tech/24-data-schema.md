# 24. 데이터 스키마

> **밸런스 수치의 단일 진실 원천은 `src/game/data/*.json` 이다.** 코드에 하드코딩하지 않는다.
> 기획자가 엔지니어 없이 이 파일들을 수정하고 `npm run balance` 로 검증할 수 있어야 한다.

> ## ⚠ 2026-08-04 범위 절삭 — 데이터 파일 12개가 사라졌다
>
> 삭제: `gacha.json` · `gachaFx.json` · `shop.json` · `battlepass.json` · `quests.json` ·
> `login.json` · `notifications.json` · `ads.json` · `analytics.json` · `dungeons.json` ·
> `tower.json` · `trials.json`.
>
> 세이브 스키마의 동료 항목은 **`{ level }` 하나뿐**이고, `meta.currencies` 는 `{ gold }` 다.
> 상세: [`../04-plan/34-scope-cut.md`](../04-plan/34-scope-cut.md) §3

---

## 1. `units.json` — 동료 정의

```jsonc
{
  "$schema": "./schemas/units.schema.json",
  "version": "1.0.0",
  "units": [
    {
      "id": "honking_goose",
      "name": { "ko": "꽥꽥 거위", "en": "Honking Goose" },
      "flavor": {
        "ko": "이 새는 균열을 두려워하지 않는다. 이 새는 아무것도 두려워하지 않는다.",
        "en": "This bird does not fear the Rift. This bird fears nothing."
      },
      "rarity": "R",                    // C | R | E | L
      "role": "BLOCKER",                // BLOCKER MELEE RANGED CASTER SUPPORT SPECIALIST SIEGE FLYER
      "dmgType": "physical",            // physical | arcane | holy
      "tags": [],

      "cost": 22,                       // 기본 소환 코스트
      "deployCooldown": 8000,           // ms

      "base": {
        "hp": 480, "atk": 26, "def": 14, "res": 0,
        "range": 22, "speed": 14, "atkInterval": 1100,
        "blockCount": 1
      },
      "growth": { "hp": 1.060, "atk": 1.055 },   // 레벨당 배율
      "rankMult": [1.0, 1.35, 1.85, 2.50, 3.40],

      "ability": {
        "id": "taunt",
        "params": { "radius": 60, "auraRadiusMult": 2.0 },
        "auraGated": true               // 오라 안에서만 발동 (SUPPORT은 반전)
      },

      "ownedEffect": {
        "stat": "blocker_hp_pct",
        "perStack": 0.02,
        "maxStacks": 5
      },

      "art": {
        "atlas": "atlas-units",
        "frame": "Animals/HonkingGoose",
        "frameCount": 4,
        "frameRate": 8,
        "scale": 2,
        "presenter": "small_melee"      // presenters.json 참조
      },

      "sfx": { "attack": "hit_blunt_a", "death": "death_small", "spawn": "summon_a" }
    }
  ]
}
```

### 1.1 `presenters.json` — 4프레임 제약 상쇄 연출 프로파일

```jsonc
{
  "profiles": {
    "small_melee": {
      "idle":  { "bounceY": 1, "bouncePeriod": 900 },
      "move":  { "bounceY": 2, "bouncePeriod": 500, "tiltDeg": 3, "dust": true },
      "attack": {
        "lungePx": 10, "lungeMs": 80, "recoilPx": -4, "recoilMs": 120,
        "squash": [1.15, 0.85], "hitStopMs": 40,
        "effect": "slash_a", "effectAt": "target"
      },
      "hurt":  { "tint": "0xffffff", "tintMs": 60, "knockbackPx": -3, "squash": [0.85, 1.15] },
      "death": { "spinDeg": 720, "durationMs": 300, "effect": "puff_a", "particles": 8 },
      "spawn": { "fadeMs": 150, "scaleFrom": 0.6, "overshoot": 1.15, "ringEffect": "summon_ring" }
    },
    "small_ranged": {
      "attack": { "lungePx": 0, "recoilPx": -5, "recoilMs": 100, "hitStopMs": 25,
                  "projectile": "arrow_a", "effect": "impact_small", "effectAt": "target" }
    },
    "large_caster": {
      "attack": { "risePx": 3, "glow": true, "hitStopMs": 60,
                  "effect": "arcane_burst", "effectAt": "target", "effectScale": 2 }
    },
    "siege": {
      "attack": { "recoilPx": -8, "cameraShake": 2, "hitStopMs": 80,
                  "projectile": "mortar_a", "arc": true, "effect": "explosion_large" }
    }
  }
}
```

> **연출을 데이터로 두는 것이 이 프로젝트의 아트 전략 전체를 지탱한다** (`02-design/19` §2). 프로파일 하나를 고치면 그 역할의 모든 유닛 연출이 바뀐다.

---

## 2. `enemies.json`

```jsonc
{
  "enemies": [
    {
      "id": "acid_ant",
      "name": { "ko": "산성 개미", "en": "Acid Ant" },
      "faction": "vermin",
      "tags": ["SWARM", "LIVING"],
      "dmgType": "physical",
      "base": { "hp": 40, "atk": 8, "def": 2, "res": 0,
                "range": 16, "speed": 26, "atkInterval": 800 },
      "breachDamage": 2,
      "goldValue": 3,
      "manaRefund": 2,
      "art": { "atlas": "atlas-enemies-vermin", "frame": "AcidAnt",
               "frameCount": 4, "frameRate": 8, "scale": 2, "presenter": "small_melee" }
    },
    {
      "id": "giant_rhino_beetle",
      "name": { "ko": "거대 코뿔소 딱정벌레", "en": "Giant Rhino Beetle" },
      "faction": "vermin",
      "giant": { "scale": 4, "hpMult": 15, "atkMult": 3.5, "speedMult": 0.6 },
      "tags": ["ARMORED", "LIVING"],
      "base": { "hp": 40, "atk": 8, "def": 12, "res": 0, "range": 20, "speed": 26, "atkInterval": 1400 },
      "breachDamage": 25,
      "art": { "atlas": "atlas-enemies-vermin", "frame": "RhinoBeetle",
               "outline": "0xff3344" }
    }
  ]
}
```

**거대화 엘리트는 별도 스프라이트가 아니라 `giant` 필드다.** 스케일과 배율만 데이터로 지정하면 어떤 적이든 엘리트가 된다 (`02-design/12` §3.3).

> **`archetype` 은 없다 (2026-08-05 삭제).** 62/62 에 적혀 있었고 읽는 코드가 0건이었다.
> 위협의 모양은 `tags`(상성) · `base.speed`/`base.range`(속도·사거리) · `giant` 가 이미 말한다.
> 게다가 여기 적혀 있던 값 목록(`sniper` · `summoner`)은 데이터에 하나도 없었고, 실제 값의
> 절반(`bruiser` · `caster` · `ranged` · `rusher` · `swarm`)은 이 문서에 없었다 —
> **읽는 코드가 없으면 검사기도 없고, 검사기가 없으면 명세부터 썩는다.**
> 되살리려면 먼저 소비처를 정하고 `tools/validate-data.mjs` 의 `FIELD_CONSUMERS` 에 등록해야 한다.
> 등록 없이 필드만 더하면 `data:validate` 가 오류로 잡는다.

> **보스의 거대화 배율도 여기 하나뿐이다.** `worlds.json` 의 비트에 `bossGiant` 를 적어도
> 생성기는 읽지 않는다 (2026-08-05 삭제 — 남아 있던 값은 실제의 3분의 1이었다).

### 2.1 `art.outline` — 엘리트·보스 표시

**배선됨 (2026-08-05).** 그전까지 10종에 색이 적혀 있었는데 **참조하는 코드가 0건**이었다.
데이터를 넣은 사람은 "엘리트가 눈에 띄게 됐다"고 믿었고, 화면에서는 아무 일도 없었다.

`UnitPresenter.attachOutline()` 이 본체 뒤에 **색 실루엣 스프라이트**를 깐다
(1px 확대 → `setTintFill`). 두께·투명도·맥동은 `presenters.json:outline` 이 정하고,
**색만** 여기서 온다 — 적 10종에 같은 두께를 열 번 적지 않는다.

> **`postFX.addGlow` 를 쓰지 않은 이유:** postFX 는 **WebGL 전용**인데 이 저장소는
> 저사양 기기에서 일부러 CANVAS 로 부팅한다 (`game/device.js:IS_LOW_END`).
> glow 로 구현하면 **하필 그 기기에서만** 엘리트 표시가 통째로 사라진다 —
> 화면이 가장 혼잡한 쪽이 저사양 기기다. 그리고 glow 는 블러라
> `pixelArt: true` 로 지켜 온 픽셀 위계를 흐린다.

> **`groundCrack` 은 스키마 예시에서 뺐다** (2026-08-05). 데이터에 실제로 쓰인 적이
> 없고 읽는 코드도 없다. `src/game/wiring.test.js` 의 **W1** 이 이제
> `enemies.json` 의 `art.*` **키 전부**에 대해 프레젠터가 읽는지를 검사하므로,
> 예시만 보고 필드를 더하면 테스트가 막는다.
>
> 현재 `art` 의 유효 키는 **`atlas` · `frame` · `scale` · `outline` · `projectile`** 다섯이다.
> `projectile` 만 프레젠터가 아니라 `logic/stageConfig.js` 가 읽으므로
> **W1 의 소비처 예외표(`ART_CONSUMER_DIR`)에 등록돼 있다** (§2.2).

### 2.2 `role` · `art.projectile` — 원거리 적

**배선됨 (2026-08-05).** 그전까지 `enemies.json` 에는 `role` 이 **한 종도 없었고**,
`stageConfig.js:normalizeDef` 의 `raw.role ?? "MELEE"` 가 62/62 를 근접으로 정규화했다.
`engage.js:tryAttack` 은 `roles.js:PROJECTILE_ROLES`(RANGED · CASTER · SIEGE · **FLYER**)일 때만
발사체를 만들므로, **사거리 120–190 을 가진 적 11종이 화면을 가로질러 즉발로 때렸다.**
원거리 적과 근접 적을 화면에서 구분할 방법이 없었고, 피해가 도착하기까지의 시간도 없었다.

> ★★ **FLYER 는 같은 날 오후에 들어갔다** (2026-08-05 2차). 적 11종을 고치고도
> **아군 비행 4종**(사거리 160–200)이 즉발로 남아 있었다 — 상수가 아군·적을 함께
> 보게 된 뒤에도 목록에 FLYER 가 없었기 때문이다. 사거리 대조도 그때 아군까지
> 넓혔다. **SUPPORT 만 면제**다: 사거리 190–235 로 선을 넘지만 `trySupport` 가
> `tryAttack` 을 지나지 않아 "즉발로 때린다"가 성립하지 않는다 (힐이다).

```jsonc
{
  "id": "goblin_slinger",
  "role": "RANGED",                     // 없으면 MELEE (근접 51종은 적지 않는다)
  "dmgType": "physical",
  "base": { "range": 150, /* … */ },
  "art": {
    "projectile": { "shape": "3_0", "$note": "돌팔매" },   // 모양만. 색은 dmgType 이 정한다
    "atlas": "units", "frame": "GoblinSlinger", "scale": 4
  }
}
```

**역할을 사거리에서 파생시키지 않는다.** 파생 규칙을 두면 "왜 이 적이 원거리인가"를
데이터가 아니라 코드가 정하게 되고, 사거리를 68 → 72 로 튜닝한 순간 그 적이 조용히
발사체를 쏘기 시작한다. 대신 **명시하고 대조한다** — `tools/validate-data.mjs` 의
발사체 절이 사거리 100 을 경계로 양방향 검사한다 (실측: 근접 28–72, 원거리 120–190,
간극 48px). 발사체 그림 규약(모양 × 색)은 동료와 **완전히 같다** (§`fx.json`).

> **FLYING 인 셋(`floating_eye` · `ghastly_eye` · `warp_skull`)은 지금 한 발도 쏘지 않는다.**
> 비행 적은 `AIR_LANE` 으로 스폰되고 `engage.js:stepCombat` 이 그 레인의 적→아군 루프를
> 통째로 건너뛴다 — 비행 적은 교전하지 않고 방주로 직행한다는 설계다. 그래서 그 셋의
> `base.range` 는 전투에서 한 번도 읽히지 않는다. 역할과 발사체를 그래도 적어 두는 이유는
> "이 적이 무엇인가"가 그 규칙과 무관하게 참이기 때문이다.
> **실제로 화면이 달라지는 것은 지상 8종이다.**

> **아군 `FLYER` 4종(사거리 160–200)은 아직 즉발이다.** 같은 결함이지만 고치면 아군 DPS 가
> 통째로 움직이므로 별개의 결정이다 — 여기에 조용히 끼워 넣지 않았다.

---

## 3. `stages.json`

```jsonc
{
  "stages": [
    {
      "id": "4-12",
      "world": 4,
      "index": 12,
      "mode": "assault",                // assault breach escort endure nemesis
      "faction": "raiders",
      "arkHp": 100,
      "startMana": 60,
      "waves": 12,
      "tempoShiftWave": 7,              // floor(waves * 0.6)
      "targetTimeSec": 110,             // ★3 조건
      "waveInterval": [6000, 9000],

      "waveTable": [
        { "wave": 1,  "spawns": [ { "id": "lizardfolk_scout", "count": 4, "lanes": [0,1,2], "delayMs": 400 } ] },
        { "wave": 2,  "spawns": [ { "id": "lizardfolk_spearman", "count": 3, "lanes": [1] },
                                  { "id": "goblin_archer", "count": 2, "lanes": [0,2] } ] },
        { "wave": 7,  "elite": true,
                      "spawns": [ { "id": "giant_lizardfolk_gladiator", "count": 1, "lanes": [1] } ] }
      ],

      "preview": {                      // 진입 전 프리뷰 UI (자동 생성 가능하나 수동 오버라이드 허용)
        "tagCounts": { "ARMORED": 18, "FLYING": 4, "SWARM": 22 },
        "warning": { "ko": "물리 데미지가 크게 감소합니다", "en": "Physical damage heavily reduced" }
      },

      "rewards": {
        "gold": 1240,
        "firstClear": { "gems": 50, "shards": { "elf_enchanter": 5 } },
        "drops": [ { "item": "upgrade_stone", "min": 2, "max": 5, "chance": 0.6 } ]
      },

      "sigilPool": "standard",
      "bgm": "battle_130"
    }
  ]
}
```

**웨이브 테이블 생성기:** 200 스테이지를 손으로 쓰지 않는다. `tools/gen-stages.mjs` 가 월드 설정 + 난이도 커브 + 아키타입 비율에서 생성한다.

> ★ **`stages.json` 은 손으로 고치지 않는다** (2026-08-03 정리 이후).
> 생성기 밖의 조정은 재생성 때 조용히 사라진다 — 실제로 18 스테이지가 그 상태였다.
> 조정할 곳은 `worlds.json` 하나다.
>
> | 바꾸고 싶은 것 | 고칠 곳 |
> |---|---|
> | 등장 적 · 강조 적 · 가르치는 것 · 보스 | `worlds.worlds[].beats[]` |
> | 스테이지 하나만 조이기 | `beats[].difficultyMult` (1-9 = 3.75) |
> | 밀도 곡선 · 모드별 예산 | `densityCurve` |
> | FLYING 비율 상한 · 버티기 물량 | `postProcess` |
>
> 생성 규칙은 `tools/lib/stages-core.mjs` 순수 함수이고,
> `src/game/data/stages.gen.test.js` 가 "재생성해도 파일이 안 바뀐다"를 검증한다.
> `npm run gen:stages` 는 차이가 있으면 **보여주고 멈춘다** — 덮어쓰려면 `--force`,
> 새 스테이지만 붙이려면 `--new`. 자세한 내용은 `docs/04-plan/33-execution-plan.md` P6-01.

---

## 4. `sigils.json` — 각인

```jsonc
{
  "sigils": [
    {
      "id": "piercing_arrow",
      "name": { "ko": "관통 화살", "en": "Piercing Arrow" },
      "desc": { "ko": "원거리 동료의 투사체가 적 2체를 관통합니다" },
      "category": "role",               // role aura resource commander cost evolution_seed
      "weight": 100,                    // 드래프트 등장 가중치
      "minWave": 1,
      "maxStacks": 3,
      "hooks": [ { "on": "projectileSpawn", "op": "addPierce", "value": 1 } ],
      "evolvesWith": ["aura_frost", "chain_lightning"],
      "icon": "icon_1204"
    },
    {
      "id": "tax_of_the_dead",
      "name": { "ko": "망자의 세금" },
      "desc": { "ko": "적 처치 시 마나 +4. 방주 최대 HP −8%" },
      "category": "cost",               // ★ 대가형 — UI에 ⚠ 표기
      "weight": 45,
      "hooks": [
        { "on": "kill", "op": "addMana", "value": 4 },
        { "on": "apply", "op": "mulArkHpMax", "value": 0.92 }
      ],
      "evolvesWith": ["execute"],
      "icon": "icon_0877"
    }
  ],

  "evolutions": [
    {
      "id": "frost_pierce",
      "name": { "ko": "서리 관통" },
      "requires": ["piercing_arrow", "aura_frost"],
      "desc": { "ko": "관통 + 명중 시 0.5초 빙결" },
      "hooks": [
        { "on": "projectileSpawn", "op": "addPierce", "value": 2 },
        { "on": "projectileHit",   "op": "applyStatus", "value": { "type": "freeze", "ms": 500 } }
      ],
      "unlockedBy": "stars",             // 별로 해금
      "icon": "icon_1611"
    }
  ]
}
```

**진화 발견성:** 클라이언트는 `evolvesWith` 를 알지만 **어떤 진화가 되는지는 표시하지 않는다.** 드래프트 UI에는 `✨반응` 배지만 뜬다 (`02-design/18` §2.5).

---

## 5. `bosses.json`

```jsonc
{
  "bosses": [
    {
      "id": "bringer_of_death",
      "name": { "ko": "죽음을 옮기는 자", "en": "Bringer of Death" },
      "world": 10,
      "art": {
        "atlas": "atlas-boss-bringer",
        "scale": 2,
        "anims": {
          "idle":   { "prefix": "Individual Sprite/Idle/Bringer-of-Death_Idle_",   "start": 1, "end": 8,  "rate": 8,  "repeat": -1 },
          "walk":   { "prefix": "Individual Sprite/Walk/Bringer-of-Death_Walk_",   "start": 1, "end": 8,  "rate": 10, "repeat": -1 },
          "attack": { "prefix": "Individual Sprite/Attack/Bringer-of-Death_Attack_","start": 1, "end": 10, "rate": 14 },
          "cast":   { "prefix": "Individual Sprite/Cast/Bringer-of-Death_Cast_",   "start": 1, "end": 9,  "rate": 12 },
          "spell":  { "prefix": "Individual Sprite/Spell/Bringer-of-Death_Spell_", "start": 1, "end": 16, "rate": 16 },
          "hurt":   { "prefix": "Individual Sprite/Hurt/Bringer-of-Death_Hurt_",   "start": 1, "end": 3,  "rate": 14 },
          "death":  { "prefix": "Individual Sprite/Death/Bringer-of-Death_Death_", "start": 1, "end": 10, "rate": 10 }
        },
        "useNoEffectVariant": true     // 원본 FX 제거 후 자체 이펙트 오버레이
      },
      "phases": [
        { "hpPct": 100, "tags": ["ARMORED"],            "pattern": "melee_charge" },
        { "hpPct": 66,  "tags": ["WARDED", "SHIELDED"], "pattern": "cast_aoe", "summon": "grave_revenant" },
        { "hpPct": 33,  "tags": ["CORRUPT", "FLYING"],  "pattern": "spell_cycle", "enrage": 1.4 }
      ],
      "base": { "hp": 4200000, "atk": 3400, "def": 180, "res": 45, "speed": 8 },
      "telegraphMs": 800,               // 대형 공격 예고 시간
      "bgm": "boss_final"
    }
  ]
}
```

---

## 6. `balance.json` — 전역 튜닝

```jsonc
{
  "combat": {
    "minDamageRatio": 0.10,
    "holyMultCorrupt": 1.6,
    "holyMultLiving": 0.7
  },
  "resources": {
    "manaRegenBase": 6.0,
    "manaRegenTempo": 12.0,
    "manaMax": 200,
    "riftRegenBase": 2.0,
    "riftMax": 100,
    "killRefundRatio": 0.15,
    "summonCostGrowth": 1.18,
    "summonDecayMs": 12000
  },
  "commander": {
    "auraRadiusBase": 96,
    "auraRadiusMax": 168,
    "respawnMs": 8000,
    "dashCooldownMs": 6000,
    "autoPositionEfficiency": 0.70
  },
  "scaling": {
    // ★ `enemyHpBase` · `enemyAtkBase` 는 2026-08-05 에 **삭제됐다.** 아무도 읽지
    //   않는 死필드였다 — 개체 기준값은 enemies.json 의 base.hp / base.atk 이고,
    //   여기 전역 기준값을 또 두면 같은 사실의 두 번째 출처가 된다.
    //   tools/validate-data.mjs 가 이제 "scaling 의 키는 전부 읽힌다"를 강제한다.
    "enemyHpGrowth": [
      { "maxStage": 30,  "rate": 1.110 },
      { "maxStage": 80,  "rate": 1.075 },
      { "maxStage": 999, "rate": 1.055 }
    ],
    "enemyAtkGrowth": [
      { "maxStage": 30,  "rate": 1.085 },
      { "maxStage": 80,  "rate": 1.060 },
      { "maxStage": 999, "rate": 1.045 }
    ],
    "bossHpMult": 1.4,
    "hardMult": 1.35,
    "nightmareMult": 1.90
  },
  "progression": {
    "unitLevelCostBase": 60,
    "unitLevelCostGrowth": 1.12,
    "rankShards": [10, 25, 60, 120],
    "ownedEffectRoleCap": 0.25
  },
  "idle": {
    "capHours": 8,
    "capHoursSubscriber": 12,
    "adDoublePerDay": 3,
    "notifyBeforeCapMinutes": 90
  },
  "gacha": {
    "tableVersion": "1.0.0",
    "rates": { "L": 0.0200, "E": 0.1200, "R": 0.3400, "C": 0.5200 },
    "softPityStart": 45,
    "softPityStep": 0.02,
    "hardPity": 60,
    "featuredGuarantee": 120,
    "pityCarriesOver": true,
    "tenPullMinRarity": "R",
    "pricePerPull": 150
  }
}
```

> **`gacha` 블록은 서버가 소유하고, 클라이언트는 표시용 사본만 갖는다.** 실제 롤은 서버에서 실행하고 `tableVersion` 과 함께 로깅한다 (`02-design/17` §4.2).

---

## 7. 세이브 스키마

```jsonc
{
  "schemaVersion": 1,
  "profile": { "name": "지휘관", "commanderId": "guardian", "createdAt": 1754000000000 },

  "meta": {
    "currencies": { "gold": 148200, "gems": 3140, "stones": 890, "guildCoins": 0 },
    "highestStage": 87,
    // stageStars 는 **노멀 기록**이다. 노멀 외 난이도만 difficultyStars 에 들어간다 —
    // 통합 구조로 바꾸면 배포된 세이브 전부를 변환해야 하고 별 트리·시설 해금이
    // 그 변환 하나에 걸린다 (P6-10, 세이브 v3).
    "stageStars": { "1-1": 3, "1-2": 3, "4-12": 2 },
    "difficultyStars": { "hard": { "1-1": 3, "1-2": 2 } },
    "selectedDifficulty": "hard",
    "ark": { "forge": 12, "sanctum": 9, "trainingYard": 15,
             "observatory": 7, "market": 5, "archive": 6 },
    "survivors": [ { "id": "blacksmith", "assignedTo": "world_3", "returnsAt": 1754014400000 } ],
    "idleLastClaimAt": 1754000000000,
    // 도감 해금 (P7-14, 세이브 v6). 전투 중에는 씬 로컬에 모았다가
    // 전투가 끝날 때 recordCodex() 한 번으로 밀어 넣는다 — 스폰마다 set() 하면
    // 그것이 곧 렌더 폭풍이다 (절대규칙 2).
    "bestiary": { "seen": ["acid_ant", "goblin_archer"], "killed": { "acid_ant": 412 } },
    // 한 번이라도 **획득한** 각인. 드래프트에 뜬 것은 포함하지 않는다 —
    // 포함하면 리롤로 도감을 채우는 경로가 생긴다.
    "sigilsFound": ["piercing_arrow", "aura_frost"],
    "sigilEvolutionsFound": ["frost_pierce"],
    "starTree": { "commonAtk": 4, "manaRegen": 2 },
    // ★★ 출격 일련번호 — **전투 시드의 출처** (2026-08-06).
    //   `nextRunSeed()` 가 하나 올리고 `1000 + n * 104729` 를 돌려준다.
    //   저장하는 이유: 세션 변수로 두면 앱을 껐다 켤 때마다 같은 판이 반복된다.
    //   `Math.random()`·`Date.now()` 를 쓰지 않는 이유: 시드가 재현 가능해야
    //   제보 한 판을 그대로 다시 돌릴 수 있다.
    //   옛 세이브에는 없다 — `normalizeMeta` 가 0 으로 채운다 (migrate 불필요).
    "runSeq": 41
  },

  "roster": {
    "owned": {
      "honking_goose": { "level": 34, "rank": 3, "shards": 18,
                         "gear": { "weapon": "w_012", "armor": null, "trinket": "t_003" },
                         "gearPlus": { "weapon": 7 } }
    },
    "presets": [
      { "name": "기본",   "units": ["slow_turtle","determined_soldier","elf_sharpshooter",
                                    "novice_pyromancer","jovial_friar","spikey_porcupine"] },
      { "name": "대장갑", "units": [] },
      { "name": "대공",   "units": [] }
    ],
    "activePreset": 0
  },

  "settings": {
    "bgmVolume": 0.6, "sfxVolume": 0.8, "haptics": true,
    "language": "ko", "qualityTier": "auto",
    "summonMode": "oneTouch", "autoCommander": false,
    "damageNumbers": "all", "screenShake": 1.0
  },

  "liveops": {
    "battlePassSeason": 1, "battlePassTier": 23, "battlePassPremium": false,
    "loginStreak": 12, "lastLoginDate": "2026-08-01",
    "dailyQuests": [ { "id": "dq_clear_3", "progress": 2, "claimed": false } ]
  }
}
```

**`partialize` 대상:** `profile`, `meta`, `roster`, `settings`, `liveops`. **`run`(전투 중) 상태는 절대 저장하지 않는다** (`21` §1).

**크기 목표: 200KB 미만.** `bestiary.killed` 처럼 무한 증가하는 필드는 상한을 두거나 구간 압축한다.

---

## 8. 스키마 검증

```bash
npm i -D ajv ajv-cli
```

```json
"scripts": {
  "data:validate": "ajv validate -s src/game/data/schemas/units.schema.json -d src/game/data/units.json --strict=false && ajv validate -s src/game/data/schemas/stages.schema.json -d src/game/data/stages.json --strict=false"
}
```

**CI 게이트:** 스키마 검증 실패 시 빌드 차단. 기획자가 오타로 게임을 깨뜨리는 것을 막는다.

**추가 정합성 검사** (`tools/validate-data.mjs`)
- 모든 `stages[].waveTable[].spawns[].id` 가 `enemies.json` 에 존재하는가
- 모든 `units[].art.frame` 이 아틀라스 JSON에 존재하는가
- 모든 `sigils[].evolvesWith` 가 실제 각인 id인가
- 모든 `evolutions[].requires` 가 존재하는 각인인가
- 등급별 코스트 범위가 정책과 일치하는가 (C 8–18, R 20–35, E 38–60, L 65–95)
- 각 월드의 "요구 답안" 동료가 그 월드 시작 전에 획득 가능한가 ← **`02-design/15` §1.1 규칙의 자동 검증**
- **모든 동료가 확정 지급이거나 영입 가능한가** (2026-08-04) ← 아래 §8.1
- **가이드 주제가 데이터에서 수치를 읽는가** (2026-08-04) ← 아래 §8.2
- **신규 계정의 시작 동료**는 `unlocks.json:startingUnits` 다 (2026-08-04). 한때
  `ftue.json` 의 단계별 `unlocks` 에서 파생됐는데, 튜토리얼을 지우면서 옮겼다 —
  그대로 뒀으면 **신규 계정의 보유 동료가 0종**이 되고 이 파일의 확정 지급 검사가
  존재하지 않는 로스터 위에서 통과했을 것이다.

### 8.1 `recruit.json` — 골드 영입 (2026-08-04)

```json
{
  "byRarity": {
    "C": { "gold": 2500,  "unlockStage": 3  },
    "R": { "gold": 9000,  "unlockStage": 12 },
    "E": { "gold": 30000, "unlockStage": 30 },
    "L": { "gold": 90000, "unlockStage": 55 }
  }
}
```

**영입 목록을 이 파일에 적지 않는다.** `logic/recruit.js` 가 `units.json` 에서
**확정 지급(`unlocks.js`) 대상을 뺀 나머지**로 파생한다 — 손으로 적으면 동료를
추가한 날 목록에 넣는 것을 잊고, 그 동료는 영원히 얻을 수 없다.

`data:validate` 가 강제하는 것:

| 검사 | 왜 |
|---|---|
| 확정 지급도 영입도 아닌 동료가 없다 | 가챠를 걷어냈을 때 30종 중 20종이 조용히 그 상태가 됐다. **문법이 완전해서 어떤 검사기도 잡지 못했다** |
| 지급과 영입에 동시에 들어간 동료가 없다 | 진행하면 무료로 오는 동료를 골드 받고 미리 파는 꼴이 된다 |
| 해금 지점이 캠페인 범위(1..마지막 스테이지) 안이다 | 밖이면 목록에 영영 안 뜬다 |
| 첫 영입가 ≤ 그 시점까지의 누적 수입 | 살 수 없는 가격표는 목록이 아니라 조롱이다. 수입은 `difficulty.js:stageRewards` **와 같은 등비합**으로 계산한다 |

### 8.2 `guide.json` — 가이드 (2026-08-04)

```json
{
  "groups": [{ "id": "battle", "title": "전투" }],
  "topics": [{
    "id": "mana", "group": "battle", "title": "마나와 소환",
    "screen": "battle",            // 그 화면의 [?] 가 이 주제를 먼저 연다 (선택)
    "facts": "mana",               // logic/guide.js:FACT_KINDS 중 하나 (선택)
    "body": ["문장. **강조**만 지원한다."]
  }]
}
```

★★ **본문에 수치를 적지 않는다** (절대 규칙 4). 숫자는 `facts` 키가 가리키는
`guideFacts()` 가 `balance.json` · `spells.json` · `FACILITIES` · 영입표에서
**그때그때 읽어** "지금 적용 중인 값" 표로 만든다. `data:validate` 가
빈 본문 · 없는 그룹 · 없는 fact 종류 · 값이 하나도 안 나오는 표 · **문장에 박힌
수치**(`\d+(골드|초|%|마나)`)를 잡는다.

---

## 9. 원격 설정 대상

라이브옵스가 클라이언트 빌드 없이 바꿀 수 있어야 하는 데이터.

| 파일 | 원격 | 비고 |
|---|---|---|
| `balance.json` | ✅ | 밸런스 핫픽스 |
| `stages.json` | ✅ | 난이도 조정 |
| `events/*.json` | ✅ | 이벤트 7종 템플릿 |
| `shop.json` | ✅ | 상점 재고, 오퍼 |
| ~~`banners.json`~~ | — | 가챠와 함께 삭제 (2026-08-04) |
| `units.json` | ⚠ 부분 | 스탯은 원격, **아트 참조는 클라이언트 고정**(아틀라스가 빌드에 있어야 함) |
| `sigils.json` | ⚠ 부분 | 동일 |

**로딩 순서:** 번들 기본값 → 원격 설정 페치(타임아웃 2초) → 병합. **네트워크 실패 시 번들 기본값으로 정상 동작해야 한다** (기내 모드 플레이 가능).
