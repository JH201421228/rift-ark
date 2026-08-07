# 03. 에셋 전수 인벤토리

> 대상: `FE/asset` — **7,845개 파일** (재귀 카운트 기준)
> 조사일: 2026-08-01

| 확장자 | 개수 |
|---|---|
| `.png` | 7,471 |
| `.gif` | 178 |
| `.aseprite` | 158 |
| `.mp3` | 21 |
| `.txt` | 8 |
| `.psd` | 6 |
| `.ase` | 2 |
| `.pdf` | 1 |

**비에셋 파일:** `asset/segmodel_benchmark_v2_1.pdf` (1.3MB, 게임과 무관한 문서가 루트에 있음) — 파이프라인과 `public/`에서 제외 대상.

---

## 요약 카운트

| 지표 | 수량 |
|---|---|
| **플레이어 유닛 후보** | **~113** (Lively NPC 49 + Holy 15 + Humanoid 15 + Humanoid II 15 + Magical 15 + Adventurer 1 + 보스 승격 3) |
| **적 후보** | **~136** |
| **몬스터 스프라이트 총계** (`monsters/`) | **150** |
| **보스 스프라이트** | **9** (8팩; Undead Executioner가 보스 + 소환수 2개 제공) |
| **이펙트 애니메이션** | **252종** (9색상 변형 포함 **2,268**) |
| **아이콘** | **2,192종** (× 3해상도 = 6,576파일 + 시트 4장) |
| **아이템 아이콘** | **~448** (7시트 × 64, 그리드 추정) |
| **발사체 애니메이션** | **~200** (8시트 × ~25행) |
| **BGM** | **21** (1중복 → 20 고유) |
| **타일셋** | 2 (2,560 + 256 타일) + 애니메이션 소품 4종 |

---

## 1. `bgm` — MP3 21개 (평면 구조)

`11325622-epic-strings-intro-239971` · `5xbeatz-percussion-loop-118-bpm-free-385692` · `5xbeatz-percussion-loop-130bpm-387865` · `5xbeatz-percussion-loop-132bpm-387866` · `audioknap-drums-only-448491` · `dragon-studio-slow-cinematic-clock-ticking-405471` · `grand_project-deep-epic-cinematic-when-time-collapses_outro-501526` · `ncprime-cinematic-background-291979` · `ncprime-cinematic-background-293547` · `ncprime-noncopyright-music-pianos-295174` · `niteshnaagodiya-bongo-and-drum-instrumental-music-21295` · `simplesound-dark-horror-opener-443328` · `soundreality-cinematic-drums-percussion-474175` · `soundreality-cinematic-music-487645` · `soundreality-cinematic-percussion-471495 (1)` **(중복)** · `soundreality-cinematic-percussion-471495` · `soundreality-cinematic-percussion-kick-474176` · `universfield-atmospheric-cinematic-soundscape-152493` · `universfield-dark-horror-soundscape-345814` · `universfield-horror-background-atmosphere-025-499631` · `universfield-paranormal-horror-cinematic-498207`

파일명 패턴(`<작가>-<제목>-<ID>.mp3`)이 **Pixabay Audio** 다운로드와 일치. 크레딧 표기용 정보는 `04-license-audit.md` §2 참조.
**중요: SFX(효과음)는 에셋에 전혀 없다.** 별도 소싱 필요.

---

## 2. `bosses` — 8팩 / 보스 9체

### 2.1 `Necromancer_creativekind-Sheet.png` (루트 낱개 파일)
- 단일 시트 **2720 × 896**, 프레임 **160 × 128** → **17열 × 7행 = 119셀**
- 행 = 애니메이션 상태 (CreativeKind Necromancer 표준: idle / walk / attack / cast / hurt / death / summon)

### 2.2 `Bringer-Of-Death/` (작가: **Clembod**) — 가장 완성도 높은 보스
- **시트:** `Bringer-of-Death-SpritSheet.png` **1120 × 744**, `..._no-Effect.png` 동일 → 프레임 **140 × 93**, **8열 × 8행 = 64프레임**
- **개별 프레임** (전부 140 × 93):

| 상태 | 프레임 |
|---|---|
| Idle | 8 |
| Walk | 8 |
| Attack | 10 |
| Cast | 9 |
| Spell | 16 |
| Hurt | 3 |
| Death | 10 |
| `No Effect Sprites/` (Attack 10, Cast 9, Spell 16, Hurt 3, Death 10) | 마법 FX 레이어 제외판. **Idle/Walk 없음** |

### 2.3 `EVil Wizard 2/Sprites/` — 가로 스트립, 프레임 **250 × 250**

| 파일 | 크기 | 프레임 |
|---|---|---|
| `Idle.png` | 2000×250 | 8 |
| `Run.png` | 2000×250 | 8 |
| `Attack1.png` | 2000×250 | 8 |
| `Attack2.png` | 2000×250 | 8 |
| `Death.png` | 1750×250 | 7 |
| `Take hit.png` | 750×250 | 3 |
| `Jump.png` | 500×250 | 2 |
| `Fall.png` | 500×250 | 2 |

→ **유일하게 idle/run/공격2종/피격/사망을 모두 갖춘 대형 캐릭터.** CC-0.

### 2.4 `FREE_Samurai 2D Pixel Art v1.2/Sprites/` — 프레임 **96 × 96**

| 파일 | 크기 | 프레임 |
|---|---|---|
| `IDLE.png` | 960×96 | 10 |
| `RUN.png` | 1536×96 | 16 |
| `ATTACK 1.png` | 672×96 | 7 |
| `HURT.png` | 384×96 | 4 |

**사망 애니메이션 없음.**

### 2.5 `MainCharacter(FreePack)/` (작가: **KBPixelArt**)
- `Idle.png` **1920 × 128** → 프레임 **192 × 128**, **10프레임**. 팩 내 유일한 아트 파일
- → 필드 유닛 불가. **거점 NPC / 내레이터 / 초상화** 용도.

### 2.6 `Mecha-stone Golem 0.1/`
- `PNG sheet/Character_sheet.png` **1000 × 1000** (프레임 100 × 100 → **10 × 10 = 100셀**)
- `weapon PNG/arm_projectile.png` **100 × 100**, `arm_projectile_glowing.png`, `Laser_sheet.png` **300 × 1500** (100×100 → 3 × 15)
- `ASE files/` — 편집 소스 5종

### 2.7 `NightBorne/`
- `NightBorne.png` **1840 × 400**, 프레임 **80 × 80** → **23열 × 5행**
- 행 = idle 9 / run 6 / attack 12 / hurt 5 / death 23 (NightBorne 표준 레이아웃)
- 프리뷰 GIF 5종 (`NightBorne_death..gif` 는 점 2개 오타)

### 2.8 `Undead executioner/Undead executioner puppet/` — 보스 프레임 **100 × 100**, 소환수 **50 × 50**

| 파일 | 크기 | 배치 |
|---|---|---|
| `idle.png` | 500×100 | 5 |
| `idle2.png` | 400×200 | 4×2 = 8 |
| `attacking.png` | 600×300 | 6×3 = 18 |
| `skill1.png` | 600×200 | 6×2 = 12 |
| `death.png` | 1000×200 | 10×2 = 20 |
| `summon.png` | 400×200 | 4×2 = 8 |
| `summonAppear.png` | 150×100 | 3 (50px) |
| `summonIdle.png` | 200×50 | 4 (50px) |
| `summonDeath.png` | 150×100 | 3 (50px) |

→ **이 팩 하나가 보스 + 별도 소환 미니언 2체를 준다.**

---

## 3. `character` — 1팩 / 1체

### `FREE_Adventurer 2D Pixel Art/`
탑다운 **4방향** 캐릭터. 프레임 **96 × 80**, 각 파일이 가로 스트립 **768 × 80 = 8프레임**.

| 상태 | 파일 |
|---|---|
| IDLE | `idle_down/left/right/up.png` |
| RUN | `run_down/left/right/up.png` |
| ATTACK 1 | `attack1_down/left/right/up.png` |
| ATTACK 2 | `attack2_down/left/right/up.png` |

**피격/사망 없음.** 사이드뷰 게임에서는 `_left` / `_right` 세트만 사용 → **idle / run / attack1 / attack2 (각 8프레임)** 확보. 플레이어 영웅 최우선 후보.

---

## 4. `effect` — 1팩 / **252종 이펙트 애니메이션**

`effect/Free/Part 16` … `Part 36` (21개 폴더, Part 1–15 없음 — 대형 유료팩의 무료 티어).
각 폴더 = **PNG 시트 12장 + 프리뷰 GIF 1장.**

**검증된 프레임 구조**
- **프레임 셀 = 64 × 64 px**
- **모든 시트가 정확히 576px 높이 = 9행.** 9행은 알파가 픽셀 단위로 동일하고 RGB만 다르다 → **동일 애니메이션의 9가지 색상 변형**
  - 샘플링된 행 색상: 진홍 `174,45,72` / 인디고 `31,0,144` / 파랑 `19,62,186` / 초록 `17,83,57` / 녹슨빛 `93,44,40` / 회색 `47,47,47` / 보라 `58,41,76` / 흑청 `28,21,37` / 바이올렛 `36,15,62`
- **열 = 프레임 수** = 너비 / 64, **7~18프레임 범위**

| Part | 너비(×파일수) | 프레임 |
|---|---|---|
| 16 | 512 ×12 | 8 |
| 17 | 640 ×8, 704 ×4 | 10, 11 |
| 18 | 704 ×12 | 11 |
| 19–22 | 768 ×12 | 12 |
| 23 | 448 ×8, 512 ×4 | 7, 8 |
| 24 | 512 ×8, 576 ×4 | 8, 9 |
| 25 | 576 ×4, 640 ×8 | 9, 10 |
| 26 | 640 ×11, 768 ×1 | 10, 12 |
| 27 | 704 ×12 | 11 |
| 28 | 768 ×12 | 12 |
| 29 | 768 ×3, 832 ×9 | 12, 13 |
| 30 | 832 ×12 | 13 |
| 31 | 832 ×8, 896 ×4 | 13, 14 |
| 32 | 896 ×11, 960 ×1 | 14, 15 |
| 33–34 | 896 ×12 | 14 |
| 35 | 960 ×12 | 15 |
| 36 | 960 ×1, 1024 ×3, 1088 ×5, 1152 ×3 | 15–18 |

파일명은 원본 마스터팩의 숫자 ID (Part 16 = `766–769`, `776–779`, `786–789`; Part 36 = `1761–1764`, `1771–1774`, `1781–1784`). **각 파트가 3그룹 × 4 → 이펙트 아키타입 3종 × 형태/크기 변형 4종** 구성으로 추정.

> **설계 함의: 252 × 9색상 = 2,268개의 즉시 사용 가능한 색상별 이펙트.** 유닛에 공격 애니메이션이 없다는 제약을 이 이펙트 물량으로 상쇄한다.

---

## 5. `icons` — **2,192종 아이콘** (전체 파일 수의 84%)

### `Free - Raven Fantasy Icons/` (작가: **Caio / Clockwork Raven Studios**)

| 경로 | 파일 | 상세 |
|---|---|---|
| `Full Spritesheet/16x16.png` | 1 | **256 × 2192** — 16열 × 137행 |
| `Full Spritesheet/32x32.png` | 1 | **512 × 4384** |
| `Full Spritesheet/64x64.png` | 1 | **1024 × 8768** |
| `RPG Maker MV and MZ/IconSet.png` | 1 | **512 × 4384** |
| `Separated Files/16x16/` | **2,192** | `fa1.png` … `fa2192.png` |
| `Separated Files/32x32/` | **2,192** | `fb1.png` … `fb2192.png` |
| `Separated Files/64x64/` | **2,192** | `fc1.png` … `fc2192.png` |

`Special Note to the Dev.txt` 는 원작자(**Caio / Clockwork Raven Studios**)의 감사/Patreon 안내문이다. 크레딧 표기 시 활용.

> **파이프라인 주의: `Separated Files/`는 아틀라스 패킹에 절대 넣지 않는다.** `Full Spritesheet/32x32.png` 한 장만 쓰고 프레임 인덱스로 접근한다. 6,576개 낱장을 패킹하면 빌드가 폭발한다.

---

## 6. `item` — 시트 7장

`pixel items0.png` … `pixel items6.png`, **전부 256 × 256**.
투명 행 밴드 분석(y=32, 63, 128–132, 155–159, 224, 255) 기준 **32 × 32 셀 그리드 = 8 × 8 = 시트당 64 아이템** → **총 ~448 아이템 아이콘**. (16×16 그리드 가능성도 있어 육안 확인 필요.)
출처 정보 전무.

---

## 7. `projectile` — 시트 8장

`All_Fire_Bullet_Pixel_16x16_00.png` … `_07.png`, **전부 640 × 400**.
파일명이 그리드를 명시하고, 투명 열 구간(80–95, 160–177)이 16 배수로 확인됨. **셀 = 16 × 16 → 40열 × 25행 = 시트당 1,000셀.**
해석: **각 행 = 발사체 애니메이션 1종**(최대 40프레임) → 시트당 ~25종 × 8시트 ≈ **200종 발사체.**

---

## 8. `tilemap` — 1팩 (작가: **Szadi art**)

| 파일 | 크기 | 비고 |
|---|---|---|
| `mainlevbuild.png` | **1024 × 640** | 메인 타일셋 (16px 그리드 → 64 × 40 = 2,560타일) |
| `decorative.png` | **256 × 256** | 장식 (16 × 16 = 256타일) |
| `torch_1..4.png` | **16 × 16** | 횃불 4프레임 |
| `spike_0..4.png` | **13 × 12** | 가시 5프레임 |
| `candleA_01..04.png` | **7 × 14** | 초 A 4프레임 |
| `candleB_01..04.png` | — | 초 B 4프레임 |
| `PSD/` | — | 레이어드 소스 (mainlevbuild, decorative, Anim/ 4종) |

**타일 그리드 16 × 16.**
성격상 **던전/성채 플랫포머 타일셋**이며, 시차 스크롤용 원경 배경 레이어는 **없다** → 별도 제작 또는 타일셋 조합으로 생성 필요.

---

## 9. `monsters` — 10팩 / **150종**

10개 폴더 구조 동일. 팩당 **크리처 폴더 15 + 라인업 폴더 1**.
크리처당 파일 3개: `<이름>.png`(애니 스트립), `<이름>.gif`(프리뷰), `<이름>.aseprite`(편집 소스).

> ### ⚠️ 가장 중요한 설계 제약
> **크리처 PNG 규격: 64 × 16 → 프레임 16 × 16, 정확히 4프레임 (아이들/바운스 루프).**
> **예외: Holy 팩 4종이 64 × 18 (프레임 16 × 18)** — `DivinePlanetar`, `ResoluteAngel`, `RighteousDeva`, `SwordArchon`
>
> **10개 몬스터 팩 어디에도 run / attack / hurt / death 애니메이션이 없다.**
> 전투 연출은 전적으로 **트윈(돌진·리코일·스쿼시) + 틴트 플래시 + `effect/` 오버레이**로 구성해야 한다. → `02-design/19-art-audio-direction.md` 참조.

**라인업 시트** (15종 나란히, 3배율)

| 팩 | 시트 폴더 | 1× 크기 |
|---|---|---|
| `Basic Asset Pack` | Basic Humanoid II Sprites | 90 × 54 |
| `(1)` | Basic Animal Sprites | 90 × 54 |
| `(2)` | Basic Holy Sprites | 90 × 54 (3x = 360×216) |
| `(3)` | Basic Monster Sprites | 88 × 54 |
| `(4)` | Basic Humanoid Sprites | 90 × 54 |
| `(5)` | Basic Dragon Sprites | 89 × 54 |
| `(6)` | Basic Vermin Sprites | 90 × 54 |
| `(7)` | basic magical sprites | 89 × 54 |
| `(8)` | Basic Undead Sprites | 88 × 54 |
| `(9)` | Basic Demon Sprites | 87 × 54 |

### 전체 크리처 명단 (150종)

**`Basic Asset Pack` — Humanoid II (15)**
Adventurous Adolescent · Boisterous Youth · Elf Bladedancer · Elf Enchanter · Elf Lord · Elf Sharpshooter · Elf Wayfarer · Joyful Kid · Merfolk Aquamancer · Merfolk Impaler · Merfolk Javelineer · Merfolk Mystic · Merfolk Scout · Overworked Villager · Playful Child

**`(1)` — Animals (15)**
Clucking Chicken · Coral Crab · Croaking Toad · Dainty Pig · Honking Goose · Leaping Frog · Mad Boar · Meowing Cat · Pasturing Sheep · Slow Turtle · Snow Fox · Spikey Porcupine · Stinky Skunk · Timber Wolf · Tiny Chick

**`(2)` — Holy (15)**
Blessed Gladiator · Bold Man-at-Arms · Determined Soldier · Devout Acolyte · **Divine Planetar\*** · Favored Cleric · Floating Cherub · Gentle Shepard · Holy Crusader · Jovial Friar · **Resolute Angel\*** · **Righteous Deva\*** · **Sword Archon\*** · Veteran Swordsman · Zealous Priest
(\* = 16 × 18 프레임)

**`(3)` — Monsters (15)**
Blinded Grimlock · Bloodshot Eye · Brawny Ogre · Crimson Slaad · Crushing Cyclops · Death Slime · Fungal Myconid · Humongous Ettin · Murky Slaad · Ochre Jelly · Ocular Watcher · Red Cap · Shrieker Mushroom · Stone Troll · Swamp Troll

**`(4)` — Humanoid (15)**
bestial lizardfolk · goblin archer · goblin fanatic · goblin fighter · goblin occultist · goblin wolf rider · halfling assassin · halfling bard · halfling ranger · halfling rogue · halfling slinger · lizardfolk archer · lizardfolk gladiator · lizardfolk scout · lizardfolk spearman

**`(5)` — Dragons (15)**
Adult Green Dragon · Adult White Dragon · Aqua Drake · Baby Brass Dragon · Baby Copper Dragon · Baby Green Dragon · Baby White Dragon · Juvenile Bronze Dragon · Mature Bronze Dragon · Mud Wyvern · Poison Drake · Pygmy Wyvern · Viridian Drake · Young Brass Dragon · Young Red Dragon
*(보너스 소스 `BabyCopperDragonIdleSide.aseprite` — 사이드뷰 아이들 변형)*

**`(6)` — Vermin (15)**
Acid Ant · Bloated Bedbug · Dung Beetle · Engorged Tick · Famished Tick · Foraging Maggot · Infected Mouse · Lava Ant · Mawing Beaver · Plague Bat · Rhino Beetle · Soldier Ant · Swooping Bat · Tainted Cockroach · Tunneling Mole

**`(7)` — Magical (15)**
adept necromancer · corrupted treant · deft sorceress · earth elemental · expert druid · fire elemental · fluttering pixie · glowing wisp · grizzled treant · ice golem · iron golem · magical fairy · novice pyromancer · vile witch · water elemental

**`(8)` — Undead (15)**
Bound Cadaver · Brittle Archer · Carcass Feeder · Decrepit Bones · Dismembered Crawler · Ghastly Eye · Giant Royal Scarab · Grave Revenant · Mutilated Stumbler · Royal Scarab · Sand Ghoul · Skittering Hand · Toxic Hound · Unraveling Crawler · Vampire Bat

**`(9)` — Demons (15)**
antlered rascal · clawed abomination · crimson imp · Depraved Blackguard · fledgling demon · floating eye · foul gouger · grinning gremlin · nefarious scamp · pit balor · pointed demonspawn · Rascally Demonling · skewering stalker · tainted scoundrel · warp skull

---

## 10. `npcs` — **49종**

### `Lively_NPCs_v3.1/`
모든 캐릭터가 **시트**(`sprite sheets/<테마>/<이름>.png`)와 **개별 프레임**(`individual sprites/<테마>/<이름>/<이름>_NN.png`) 양쪽으로 제공. 개별 프레임은 전부 **32 × 32**. 시트는 32px 프레임 가로 스트립(높이 32 또는 34).

**아이들/앰비언트 루프 4–6프레임만 존재. run/attack/death 없음.**

**Elementals (7)** — 전부 128 × 32 = 4프레임
crystal_mauler · fire_knight · ground_monk · leaf_ranger · metal_bladekeeper · water_priestess · wind_hashashin

**Medieval (30)**

| 이름 | 시트 | 프레임 | | 이름 | 시트 | 프레임 |
|---|---|---|---|---|---|---|
| adventurer_01 | 170×34 | 5 | | guard | 128×32 | 4 |
| adventurer_02 | 170×34 | 5 | | jester | 170×34 | 5 |
| adventurer_03 | 128×32 | 4 | | king | 170×34 | 5 |
| adventurer_04 | 128×32 | 4 | | merchant | 160×32 | 5 |
| adventurer_05 | 128×32 | 4 | | mermaid | 128×32 | 4 |
| barkeep | 170×34 | 5 | | minstrel | 170×34 | 5 |
| barmaid | 170×34 | 5 | | priestess | 160×32 | 5 |
| beggar | 170×34 | 5 | | princess | 128×32 | 4 |
| blacksmith | 170×34 | 5 | | **seer** | 204×34 | **6** |
| captain | 128×32 | 4 | | shady_guy | 170×34 | 5 |
| dog | 128×32 | 4 | | stranger | 128×32 | 4 |
| dwarf | 128×32 | 4 | | villager_01 | 170×34 | 5 |
| elder | 128×32 | 4 | | villager_02 | 170×34 | 5 |
| fairy | 128×32 | 4 | | witch | 170×34 | 5 |
| farmer_01 | 160×32 | 5 | | | | |
| farmer_02 | 160×32 | 5 | | | | |

**Steampunk (12)**
aristocrat_01 (4) · aristocrat_02 (4) · bartender (4) · engineer_01 (4) · engineer_02 (4) · **gunslinger (5)** · masked_man (4) · masked_woman (4) · steambot_01 (4) · steambot_02 (4) · **steambot_03 (5)** · trader (4)

---

## 11. 시트 vs 개별 프레임 대조표

| 팩 | 시트 | 개별 프레임 |
|---|---|---|
| `monsters/*` (10팩) | ✅ 크리처별 4프레임 스트립 + 라인업 | ❌ (`.aseprite` 소스) |
| `npcs/Lively_NPCs_v3.1` | ✅ | ✅ **양쪽 제공** |
| `bosses/Bringer-Of-Death` | ✅ (2장) | ✅ **양쪽 제공**, no-FX 변형 포함 |
| `bosses/EVil Wizard 2` | ✅ 애니별 스트립 | ❌ |
| `bosses/FREE_Samurai` | ✅ 애니별 스트립 | ❌ |
| `bosses/NightBorne` | ✅ 단일 다행 시트 | ❌ (GIF 프리뷰만) |
| `bosses/Undead executioner` | ✅ 애니별 그리드 | ❌ (`.aseprite`) |
| `bosses/Mecha-stone Golem` | ✅ 10×10 그리드 | ❌ (`.ase`/`.aseprite`) |
| `bosses/Necromancer_creativekind` | ✅ 17×7 그리드 | ❌ |
| `bosses/MainCharacter(FreePack)` | ✅ 아이들 스트립만 | ❌ |
| `character/FREE_Adventurer` | ✅ 방향별 스트립 | ❌ |
| `effect/Free` | ✅ 64px 그리드, 9색상행 | ❌ |
| `icons/Raven Fantasy` | ✅ 전체 시트 3 + RPG Maker | ✅ 2,192 × 3 |
| `item` | ✅ | ❌ |
| `projectile` | ✅ | ❌ |
| `tilemap` | ✅ 타일셋 | ✅ 애니 프레임 + `.psd` |

---

## 12. 부족한 에셋 (별도 제작/소싱 필요)

| 항목 | 현황 | 대응 |
|---|---|---|
| **SFX (효과음)** | **0개** | 필수. CC0 소스(Freesound, Kenney, ZapSplat) 또는 구매. ~60종 필요 |
| **UI 프레임/버튼/9-slice 패널** | 없음 (아이콘만 있음) | 자체 제작. 픽셀 9-slice 프레임 세트 |
| **시차 스크롤 배경 레이어** | 없음 (타일셋은 플랫포머용) | 타일셋 조합으로 생성 또는 별도 제작. 월드당 3–4레이어 |
| **성/기지 스프라이트 (아군/적)** | 없음 | `tilemap/mainlevbuild`에서 조합 제작 |
| **유닛 사망 연출** | 없음 | 트윈 + 이펙트 + 파티클로 대체 (`19-art-audio-direction.md`) |
| ~~한글 픽셀 폰트~~ | ✅ **확보됨** — `asset/fonts/base_font.woff2` = **물마루 모노(Mulmaru Mono)**, by Mushsooni. 한글 음절 11,172자 전체 + 호환 자모 51자, 총 11,940 글리프, unitsPerEm 192(픽셀 그리드), 98KB | 서브셋팅 불필요. `src/assets/fonts/` 에 동일 파일 존재 |
| **로고 / 앱 아이콘 / 스토어 스크린샷** | 없음 | 출시 전 필수 |
| **컷신 / 일러스트** | 없음 | 텍스트 + 초상화 조합으로 대체 가능 |
