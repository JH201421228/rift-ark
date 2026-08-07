# 23. 에셋 파이프라인

> **현재 프로젝트 최대 병목.** `FE/asset/` 의 7,845개 파일은 `public/` 밖에 있어 **Vite가 서빙조차 못 한다.**
> 낱장 PNG 7,471개를 그대로 로드하면 드로우콜과 HTTP 요청이 폭발한다.

---

## 1. 원칙

| # | 원칙 |
|---|---|
| 1 | **원본 `asset/` 은 절대 `public/` 에 복사하지 않는다.** 항상 패킹 산출물만 배포 |
| 2 | 아틀라스 페이지 **최대 2048×2048**, 2의 거듭제곱 | WebGL이 보장하는 최소 상한이 2048. 4096은 약 99% 지원이지만 VRAM이 4배 |
| 3 | **패딩 2px 필수** — 비정수 배율에서 인접 프레임 블리딩 방지 |
| 4 | **회전 비활성**, 트림 활성, 동일 프레임 중복 제거 활성 |
| 5 | 코드는 **논리 키**로만 접근한다 (`unit.holy_crusader`). 물리 경로를 모른다 |
| 6 | 타일셋은 **별도 패킹**, 트림·회전 모두 비활성 (균일 그리드 필수) |

**원칙 5 덕분에** 아트 교체 · 리스킨 · 이벤트 스킨 · 해상도 티어 대응이 전부 패킹 설정 변경으로 끝난다 (`01-research/04` §5).

---

## 2. 아틀라스 구성

| 아틀라스 | 내용 | 목표 크기 | 로드 시점 |
|---|---|---|---|
| `atlas-ui` | UI 프레임·버튼·아이콘 (선별 ~200종) | 1024² | Preload |
| `atlas-units` | 동료 44종 (16×16, 32×32) | 1024² | Preload |
| `atlas-enemies-<세력>` | 세력별 15종 × 10세력 | 512² 각 | **월드 진입 시** |
| `atlas-fx` | 선별 이펙트 60종 | 2048² × 2페이지 | Preload |
| `atlas-projectile` | 발사체 **모양 16종 × 색 3시트** = 216프레임 | 1024×128 | Preload |
| `atlas-boss-<이름>` | 보스별 개별 | 2048² 각 | **보스 스테이지 진입 시** |
| `atlas-ark` | 방주 시설·NPC | 1024² | Ark 씬 |
| `tiles-<월드>` | 월드별 배경 3레이어 | 1024² 각 | 스테이지 진입 시 |

### 2.1 선별이 핵심이다

**전량 패킹은 낭비다.**

| 원본 | 전량 | 실제 사용 | 절감 |
|---|---|---|---|
| 이펙트 252시트 (9색상행 포함) | ~500MB | **60시트 × 필요 색상행만** | 90%+ |
| 아이콘 6,576파일 | — | **`Full Spritesheet/32x32.png` 1장** (프레임 인덱스 접근) | 파일 6,575개 감소 |
| 몬스터 150종 | 전부 | 전부 (각 64×16, 매우 작음) | — |
| 발사체 8시트 × 25행 × 40열 | 8,000칸 | **3시트 × 8행 × 9열 = 216칸** | 97% |

> **아이콘은 절대 `Separated Files/` 를 패킹하지 않는다.** 2,192 × 3 = 6,576개 낱장을 넣으면 빌드가 폭발한다. `Full Spritesheet/32x32.png` (512×4384) 한 장을 그리드 스프라이트시트로 로드하고 인덱스로 접근한다.

### 2.2 이펙트 색상행 처리

`effect/Free` 는 **9행이 전부 같은 알파에 RGB만 다른 색상 변형**이다. 즉 **1행만 패킹하고 런타임에 틴트로 색을 바꾸는 것이 압도적으로 효율적이다.**

```js
// 색상 변형은 틴트로
effectSprite.setTintFill(WORLD_TINT[worldId]);   // 알파 유지, RGB 치환
```
→ **패킹 용량 1/9.** 원본 색상 품질이 필요한 특수 이펙트만 예외적으로 원본 행을 사용한다.

### 2.3 발사체는 반대로 한다 — 색을 **시트로** 넣는다 (2026-08-05)

`asset/projectile/All_Fire_Bullet_Pixel_16x16_00..07.png` 여덟 장도 색 변형이다.
빈칸 패턴도 프레임 크기도 시트끼리 완전히 같다 (7,000칸 전수 대조, 불일치 0).
그런데 여기서는 §2.2 의 수법이 **먹히지 않는다.**

원본이 채도 높은 주황(`#f59b27`)이라 Phaser 의 **곱셈** 틴트에 술식 파랑
(`0x6ab0ff`)을 곱하면 `rgb(102,107,39)` — 파랑이 아니라 **탁한 올리브**가 된다.
이펙트는 원본이 거의 흰빛이라 틴트가 색을 실어 나르지만, 발사체는 원본이 이미
색을 갖고 있어 틴트가 색을 *어둡게 할* 뿐이다. 실제로 그렇게 배선되어 있었고
사용자 제보가 "색이 다 비슷하다" 였다.

**그래서 축을 나눈다:**

| 축 | 무엇이 정하는가 | 어디에 |
|---|---|---|
| **색** | 데미지 타입 | `fx.json:projectileSheet` — physical 은빛(`_06`) · arcane 청록(`_02`) · holy 금빛(`_00`) |
| **모양** | 유닛 | `units.json:art.projectile.shape` = `<행>_<열>` |
| **방향** | 그림 자체 | `fx.json:shapeFacing` — §2.5 |

실제 프레임 이름은 `projectileSheet[dmgType] + "/" + shape` 로 만든다
(`src/game/projectileAnim.js:projectileFrame`). 유닛은 **모양만** 적는다 —
색을 유닛이 적게 두면 신성 유닛이 술식 시트를 가리키는 실수가 조용히 들어온다.

> **한 행이 한 종류가 아니다.** 한 행에 종류가 여럿 들어 있고 **빈 열이 경계**다.
> 그래서 모양은 반드시 **그 종류가 시작하는 열**이어야 한다 — 한가운데를 가리키면
> `1_1` `1_2` `1_3` `1_4` 가 같은 클립을 쏘면서 서로 다른 탄인 척한다.
> 경계 판정은 `projectileAnim.js:clipFrames` 가 단일 출처이고,
> `data:validate` 와 `src/game/projectileArt.test.js` 가 같은 함수를 부른다.

### 2.4 격자를 넘어온 이웃 그림

16px 격자로 자른 칸에는 위 칸 그림의 바닥선 1px 이 넘어와 있는 경우가 있다.
그대로 두면 **탄환 위에 가로 막대가 붙어** 날아간다.

`tools/lib/slice.mjs:findEdgeBleed` 가 패킹할 때마다 전 격자 프레임을 훑는다 —
판정은 **가장자리 줄이 절반 넘게 차 있는데 바로 안쪽 줄이 완전히 비었다**이고,
걸리면 **빌드가 실패한다.** 고치는 법은 매니페스트에 한 줄이다:

```json
"rowInsets": { "4": { "top": 1 } }
```

★ 잘라내지 않고 **지운다.** 크기를 줄이면 `sourceSize` 가 16 이 아니게 되어
스프라이트 중심이 반 픽셀 밀린다. 투명하게 만들면 트리밍이 알아서 걷어내고
`spriteSourceSize` 로 위치가 보존된다.

★ "절반" 이라는 밀도 조건이 없으면 이펙트 팩이 줄줄이 걸린다. 64×64 폭발은
파편 한두 픽셀이 칸 끝에 떠 있는 것이 정상이다 — 넘어온 것은 **막대**이고
파편은 **점**이며, 그 차이가 곧 임계값이다.

### 2.5 발사체 방향 — 회전이 아니라 뒤집기다 (2026-08-05)

> "반대 방향으로 쏘면 투사체 방향도 바뀌어야 하는데 방향은 그대로고
> 날아가는 방향만 바뀌니까 어색해 보인다."

씬에는 `setFlipX(p.vx < 0)` 이 이미 있었다. **문제는 코드가 아니라 고른 그림이었다.**
처음 담은 열 0–9 는 구체 · 십자 · 별 · 파열처럼 거의 전부 **좌우 대칭인 방사형**이라
뒤집어도 화면에 아무 변화가 없었고, 유일한 예외인 `3_6` 은 45° 대각이라 어느 쪽으로
뒤집어도 진행 방향과 어긋났다. **뒤집을 방향이 애초에 그림에 없었다.**

가로로 날아가는 방향성 탄환(볼트 · 화살 · 창 · 포탄 · 로켓)은 **열 26–29** 에 몰려
있다. 그래서 `colRanges: [[0,9],[26,29]]` 로 두 구간을 띄엄띄엄 담는다 — 사이를
통째로 담으면 아틀라스가 3배가 된다. 열 번호가 곧 프레임 이름이라 기존 배정은
그대로 유효하다.

**왜 회전이 아닌가.** `logic/state.js` 의 발사체에는 `vy` 라는 필드가 **없고**
`logic/projectiles.js` 는 `p.x += p.vx * dt` 만 한다. 레인 y 는 고정이다.
즉 진행 각도는 **0° 아니면 180° 뿐**이고, 가로로 그려진 그림에서 그 둘은
`flipX` 로 정확히 표현된다 (리샘플링 0 · 트랜스폼 0). 회전이 이득인 경우는
45° 대각 그림 하나뿐인데 45° 는 16px 픽셀아트에 최악의 각도라 윤곽을 뭉갠다 —
그래서 회전을 넣는 대신 그 그림을 쓰지 않는다.

| `shapeFacing` 값 | 뜻 | 렌더 |
|---|---|---|
| `right` | +x 를 향해 그려짐 | 왼쪽으로 날 때 뒤집는다 |
| `left` | −x 를 향해 그려짐 | 오른쪽으로 날 때 뒤집는다 |
| `none` | 방향 없음 (방사 대칭 · 잘린 빔) | **절대 뒤집지 않는다** |
| `up` · `diagonal` | 위 / 45° 대각 | **가로 발사체로 쓸 수 없다** (`data:validate` 가 배정을 막는다) |

> ★★ **`none` 을 뒤집지 않는 것은 최적화가 아니라 버그 수정이다.** 이 시트의 그림
> 상당수가 16×16 칸 안에서 x 로 0.5–1.5px 치우쳐 있다. Phaser 의 `flipX` 는
> **칸 중심** 기준이라, 대칭인 그림도 뒤집으면 화면에서 1–3px 옆으로 튄다.
> 얻는 것은 없고 튐만 생긴다.

★ 뒤집기 여부는 `projectileAnim.js:flipPlan` 이 `{left, right}` 두 불리언으로
미리 계산해 뷰에 넣어 둔다. `update()` 안에서는 `p.vx < 0 ? view.flipLeft :
view.flipRight` 한 줄이고 문자열 비교도 분기 계산도 없다 (규칙 7).

---

## 3. 패킹 스크립트

```bash
npm i -D free-tex-packer-core
```

```js
// tools/pack-atlases.mjs
import packAsync from 'free-tex-packer-core';
import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const SRC = 'asset';
const OUT = 'public/assets/atlas';

async function collect(dir, filter = () => true) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await collect(p, filter));
    else if (e.name.toLowerCase().endsWith('.png') && filter(p)) {
      out.push({
        path: path.relative(dir, p).replace(/\\/g, '/').replace(/\.png$/i, ''),
        contents: await readFile(p),
      });
    }
  }
  return out;
}

// 선별 목록은 데이터로 관리 (tools/atlas-manifest.json)
const MANIFEST = JSON.parse(await readFile('tools/atlas-manifest.json', 'utf8'));

const COMMON = {
  width: 2048, height: 2048,
  powerOfTwo: true,
  allowRotation: false,      // 픽셀아트에서 회전은 혼란만 유발
  allowTrim: true,
  detectIdentical: true,     // 동일 프레임 중복 제거
  padding: 2,                // ★ 필수 — 블리딩 방지
  extrude: 0,
  removeFileExtension: true,
  prependFolderName: true,
  exporter: 'Phaser3',       // JSON hash, Phaser 네이티브
};

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

for (const group of MANIFEST.groups) {
  const allow = new Set(group.include ?? []);
  const files = await collect(path.join(SRC, group.dir),
    (p) => !group.include || [...allow].some(k => p.includes(k)));

  if (!files.length) { console.warn(`⚠ ${group.name}: 파일 0개`); continue; }

  const packed = await packAsync(files, {
    ...COMMON,
    ...group.options,
    textureName: group.name,
  });

  for (const f of packed) await writeFile(path.join(OUT, f.name), f.buffer);
  const pages = packed.filter(f => f.name.endsWith('.png')).length;
  console.log(`✔ ${group.name}: ${files.length} frames → ${pages} page(s)`);
}
```

```json
// tools/atlas-manifest.json (발췌)
{
  "groups": [
    { "name": "atlas-units",   "dir": "monsters", "include": ["Holy", "Humanoid", "Magical", "Animal"] },
    { "name": "atlas-fx",      "dir": "effect/Free", "include": ["Part 16", "Part 19", "Part 22", "Part 28", "Part 33"] },
    { "name": "atlas-boss-bringer", "dir": "bosses/Bringer-Of-Death", "options": { "width": 2048, "height": 2048 } },
    { "name": "atlas-boss-nightborne", "dir": "bosses/NightBorne" }
  ]
}
```

```json
// package.json
"scripts": {
  "assets:pack":   "node tools/pack-atlases.mjs",
  "assets:audio":  "node tools/encode-audio.mjs",
  "assets:all":    "npm run assets:pack && npm run assets:audio",
  "prebuild":      "npm run assets:all"
}
```

### 3.1 다행 시트 처리 (보스·이펙트)

`NightBorne.png`(1840×400, 23열×5행) 처럼 **행이 애니메이션인 시트**는 패킹하지 않고 **그대로 복사한 뒤 `spritesheet` 로 로드**하는 것이 낫다.

```js
this.load.spritesheet('nightborne', assetUrl('sheets/NightBorne.png'), {
  frameWidth: 80, frameHeight: 80,
});
this.anims.create({
  key: 'nightborne-attack',
  frames: this.anims.generateFrameNumbers('nightborne', { start: 46, end: 57 }),  // 3행
  frameRate: 12,
});
```

**판단 기준:** 균일 그리드 + 단일 캐릭터 = `spritesheet` 그대로. 이질적 크기의 낱장 다수 = 아틀라스 패킹.

---

## 4. 오디오 인코딩

원본 MP3 21곡을 그대로 쓰면 수십 MB다.

```js
// tools/encode-audio.mjs  (ffmpeg 필요)
import { execFile } from 'node:child_process';
import { readdir, mkdir } from 'node:fs/promises';
import { promisify } from 'node:util';
import path from 'node:path';
const run = promisify(execFile);

const SRC = 'asset/bgm';
const OUT = 'public/assets/audio';
await mkdir(OUT, { recursive: true });

for (const f of await readdir(SRC)) {
  if (!f.endsWith('.mp3')) continue;
  const base = path.basename(f, '.mp3').replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
  const src  = path.join(SRC, f);

  // OGG Vorbis 96kbps 모노 — 주 포맷
  await run('ffmpeg', ['-y', '-i', src, '-ac', '1', '-b:a', '96k',
                       '-c:a', 'libvorbis', path.join(OUT, `${base}.ogg`)]);
  // M4A/AAC — iOS 폴백
  await run('ffmpeg', ['-y', '-i', src, '-ac', '1', '-b:a', '96k',
                       '-c:a', 'aac', path.join(OUT, `${base}.m4a`)]);
  console.log(`✔ ${base}`);
}
```

```js
// Phaser는 배열로 주면 지원되는 첫 포맷을 고른다
this.load.audio('bgm-battle', [
  assetUrl('audio/battle_118.ogg'),
  assetUrl('audio/battle_118.m4a'),
]);
```

| 용도 | 포맷 | 비트레이트 |
|---|---|---|
| BGM | OGG Vorbis + M4A | 96kbps 모노 |
| SFX | OGG + M4A | 64kbps 모노 |

**루프 포인트:** 퍼커션 루프는 무음 구간 없이 딱 떨어져야 한다. ffmpeg 인코딩 시 `-af "silenceremove"` 를 쓰지 말고, 필요하면 Audacity로 수동 트림 후 원본을 교체한다.

---

## 5. `public/` vs `src/`

| 위치 | 처리 | 용도 |
|---|---|---|
| `public/assets/**` | 그대로 복사, 해시 없음, 번들 제외 | **아틀라스, 타일맵 JSON, 오디오, 런타임 데이터** — Phaser가 런타임 URL로 로드 |
| `src/assets/**` | 해시·번들·인라인 | 부트 스프라이트, 로고, 폰트 등 극소수 |

```js
// src/game/assetUrl.js
export const assetUrl = (p) =>
  `${import.meta.env.BASE_URL}assets/${p}?v=${__ASSET_VERSION__}`;
```

```js
// vite.config.js
define: { __ASSET_VERSION__: JSON.stringify(Date.now().toString(36)) },
```

**Capacitor에서 캐시 버스팅이 크게 중요하지 않은 이유:** `dist/` 가 APK/IPA 안에 들어가므로 새 빌드 = 새 설치다. 다만 **OTA 업데이트(Live Updates)를 도입하면 필수**가 되므로 미리 넣어 둔다.

`base: './'` 는 반드시 유지한다 — Capacitor의 `file://` 유사 오리진에서 절대 경로는 깨진다.

---

## 6. 로딩 전략

### 6.1 3단 부트 체인

```
BootScene      프로그레스 바 스프라이트만        < 200KB
    ↓
PreloadScene   전역 아틀라스 + 메뉴 BGM          < 3MB
    ↓
Ark / Battle   씬별 지연 로드
```

**목표: 첫 인터랙티브 프레임 3초 이내** (`02-design/16` §1).

### 6.2 씬별 지연 로드

`preload()` 밖에서도 로더를 쓸 수 있다. `load.start()` 를 직접 호출한다.

```js
// src/game/scenes/BattleScene.js
async loadStageAssets(stage, onProgress) {
  const need = [];
  if (!this.textures.exists(`atlas-enemies-${stage.faction}`)) {
    this.load.atlas(`atlas-enemies-${stage.faction}`,
      assetUrl(`atlas/atlas-enemies-${stage.faction}.png`),
      assetUrl(`atlas/atlas-enemies-${stage.faction}.json`));
    need.push(1);
  }
  if (stage.boss && !this.textures.exists(`atlas-boss-${stage.boss}`)) {
    this.load.atlas(`atlas-boss-${stage.boss}`, ...);
    need.push(1);
  }
  if (!this.textures.exists(`tiles-w${stage.world}`)) {
    this.load.image(`tiles-w${stage.world}-far`, ...);
    // ...
  }
  if (!need.length) return;

  return new Promise((resolve) => {
    this.load.on('progress', onProgress);
    this.load.once('complete', () => { this.load.off('progress', onProgress); resolve(); });
    this.load.start();
  });
}
```

### 6.3 메모리 해제

```js
shutdown() {
  // 다른 월드로 이동할 때 이전 월드 텍스처 해제
  if (this.prevWorld !== this.world) {
    this.textures.remove(`atlas-enemies-${this.prevFaction}`);
    this.textures.remove(`tiles-w${this.prevWorld}-far`);
    this.cache.audio.remove(`bgm-w${this.prevWorld}`);
  }
}
```

**보스 아틀라스는 스테이지 종료 즉시 해제한다.** 2048² RGBA = GPU에서 16MB다.

---

## 7. 예산

| 항목 | 목표 | 한계 |
|---|---|---|
| JS 번들 (gzip) | **≤ 1.5MB** | Phaser 3.90 풀빌드가 min+gz 약 1.2MB. Matter/Spine/Impact 미사용이면 커스텀 빌드 검토 |
| 부트 + 프리로드 에셋 | **≤ 3MB** | 3초 목표의 직접 근거 |
| APK/IPA 총 에셋 | **30–60MB** | Play Store는 AAB 사용 (APK 100MB 제한 회피) |
| 런타임 텍스처 메모리 | **≤ 150MB** | 중급 안드로이드. 2048² RGBA = 16MB/페이지 |
| 동시 상주 아틀라스 페이지 | **≤ 8** | |

**측정 방법**
```bash
npm run build && npx vite-bundle-visualizer
du -sh public/assets/*
```

**빌드 게이트:** `dist/` 총 크기가 임계값을 넘으면 CI 실패.

---

## 8. Tiled 통합

### 8.1 판단: 하이브리드

가로 레인 게임에서 **지면을 타일맵으로 그릴 필요는 없다.**

| 용도 | 방식 |
|---|---|
| **배경 시각** | `TileSprite` 시차 3–4레이어 (`02-design/19` §3.2). 드로우콜 4개 |
| **레벨 데이터** | **Tiled를 데이터 파일로만 사용** — 레인 정의, 스폰 포인트, 웨이포인트, 배치 구역, 환경 소품 위치 |

타일맵 렌더 비용을 내지 않으면서 **기획자가 시각적 레벨 에디터를 쓸 수 있다.**

### 8.2 Tiled 내보내기 규칙

- 타일 레이어는 **CSV 또는 Base64 무압축** (zlib/gzip 금지 — Phaser가 못 읽는다)
- **타일셋을 맵에 임베드** (Embed Tileset)
- `File → Export As → JSON map files (.json)`
- 타일셋 PNG는 **아틀라스에 넣지 않는다** (균일 그리드 필요, 트림·회전 금지)

### 8.3 오브젝트 레이어 → 게임플레이 데이터

```js
create() {
  const map = this.make.tilemap({ key: `stage-${stageId}` });

  const lanes = map.getObjectLayer('Lanes').objects
    .filter(o => o.type === 'lane')
    .map(o => ({
      index: prop(o, 'index'),
      y: o.y,
      x0: o.x,
      x1: o.x + o.width,
    }))
    .sort((a, b) => a.index - b.index);

  const spawns = map.getObjectLayer('Spawns').objects
    .map(o => ({ lane: prop(o, 'lane'), x: o.x, y: o.y }));

  const props = map.getObjectLayer('Props').objects
    .map(o => ({ key: prop(o, 'sprite'), x: o.x, y: o.y, anim: prop(o, 'anim') }));

  this.sim.configureLanes(lanes, spawns);
  this.placeProps(props);          // torch/candle/spike 애니메이션 배치
}

const prop = (o, name) => o.properties?.find(p => p.name === name)?.value;
```

### 8.4 애니메이션 타일

Phaser 3 Tilemap API는 Tiled의 타일 애니메이션을 **네이티브로 재생하지 않는다.**
→ **오브젝트 레이어에 배치하고 일반 `Sprite` 로 애니메이션 재생**하는 것이 부품이 적고 확실하다. `torch_1..4`, `candleA/B_01..04`, `spike_0..4` 를 이 방식으로 처리한다.

---

## 9. 워크플로

```
아티스트가 asset/ 에 파일 추가
    ↓
tools/atlas-manifest.json 에 선별 목록 갱신
    ↓
npm run assets:pack        → public/assets/atlas/
    ↓
src/game/data/*.json 에 논리 키 등록
    ↓
npm run dev                → 즉시 확인
```

**`public/assets/` 는 `.gitignore` 에 넣는다.** 생성물이므로 저장소에 올리지 않는다. CI가 빌드 시 재생성한다.

```gitignore
# .gitignore 추가
public/assets/atlas/
public/assets/audio/
```

**단, `public/assets/tilemaps/` 와 `public/assets/data/` 는 커밋한다** — 수작업 산출물이다.
