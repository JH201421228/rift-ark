# 21. 상태 관리 — Zustand ↔ Phaser 경계

> **이 문서의 §3이 프로젝트 전체에서 가장 중요한 단일 결정이다.**
> 잘못하면 60fps가 30fps가 되고, 배터리가 녹고, 저사양 안드로이드에서 게임이 성립하지 않는다.

> ## ⚠ 2026-08-04 범위 절삭 — 슬라이스가 12 → 6 이 됐다
>
> **남은 슬라이스:** `run` · `roster` · `meta` · `ui` · `settings`.
> `shop` · `daily` · `dungeon` · `tower` · `trials` · `ads` 는 삭제.
> **`ftue` 는 2026-08-04 튜토리얼 삭제로 함께 사라졌다** (v16).
> **저장되는 최상위 키는 셋:** `roster` · `meta` · `settings` — 목록의 단일 출처는
> `store/index.js:SAVED_KEYS` 이고 `partialize` 와 슬롯 초기화가 그것을 함께 읽는다.
> `SAVE_VERSION 16` 이고 마이그레이션은 **버전별 분기를 접어** 한 번의 정규화로 처리한다.
> 상세: [`../04-plan/34-scope-cut.md`](../04-plan/34-scope-cut.md) §3

---

## 1. 단일 스토어, 두 얼굴

Zustand 코어는 프레임워크 독립적이다. React와 Phaser가 **같은 스토어 객체**를 만지도록 두 개의 인터페이스를 노출한다.

```js
// src/store/index.js
import { create } from 'zustand';
import { subscribeWithSelector, persist, createJSONStorage } from 'zustand/middleware';
import { capacitorStorage } from '@/native/storage';

import { createRunSlice }      from './slices/runSlice';
import { createRosterSlice }   from './slices/rosterSlice';
import { createMetaSlice }     from './slices/metaSlice';
import { createUiSlice }       from './slices/uiSlice';
import { createSettingsSlice } from './slices/settingsSlice';

export const useGameStore = create(
  subscribeWithSelector(
    persist(
      (...a) => ({
        ...createRunSlice(...a),
        ...createRosterSlice(...a),
        ...createMetaSlice(...a),
        ...createUiSlice(...a),
        ...createSettingsSlice(...a),
      }),
      {
        name: 'riftark-save-v1',
        version: 1,
        storage: createJSONStorage(() => capacitorStorage),
        // ★ 필수: 전투 중 상태(runSlice)를 저장하면 콜드 스타트에 반쯤 끝난 전투가 복원된다
        partialize: (s) => ({
          roster:   s.roster,
          meta:     s.meta,
          settings: s.settings,
        }),
        migrate: (persisted, from) => (from < 1 ? migrateV0(persisted) : persisted),
      }
    )
  )
);

// Phaser 및 비-React 코드용 핸들 — React import 불필요
export const gameStore = {
  get:       useGameStore.getState,
  set:       useGameStore.setState,
  subscribe: useGameStore.subscribe,
};
```

- **React**: `useGameStore(selector)`
- **Phaser**: `gameStore.get()` / `gameStore.set()` / `gameStore.subscribe()`

---

## 2. 슬라이스

Zustand 공식 가이드는 **스토어 1개 + 슬라이스 다수**다.

| 슬라이스 | 내용 | 영속 |
|---|---|---|
| `runSlice` | 현재 전투: `phase`, `wave`, `mana`, `riftEnergy`, `arkHp`, `selectedSlot`, `sigils[]`, `commanderLane` | ❌ |
| `rosterSlice` | 보유 동료, 레벨/랭크/장비, 편성 프리셋 3개, 소유 효과 집계 | ✅ |
| `metaSlice` | 진행도, 재화, 방주 시설, 별, 방치 타임스탬프, 도감 | ✅ |
| `uiSlice` | 모달 스택, 토스트, 화면 전환 상태 | ❌ |
| `settingsSlice` | 볼륨·음소거, 햅틱, 언어, 품질 티어, 조작 방식, 접근성(색약·텍스트 크기·히트스톱·자동 진행 속도), 전투 속도 | ✅ |

> **`settingsSlice` 의 기본값·선택지는 코드가 아니라 `src/game/data/settings.json` 에 있다** (P7-15).
> `npm run data:validate` 가 "기본값이 선택지 안에 있는가"를 검사한다 — 벗어나면 화면의
> 세그먼트 버튼이 아무것도 선택되지 않은 채 떠서 되돌릴 방법이 사라진다.
>
> 슬라이스 상단에 **키 → 반영되는 곳** 배선표가 있다. 항목을 추가하면 그 표도 같이 채운다.
> 화면에만 있고 아무것도 하지 않는 설정은 기능이 아니다.

```js
// src/store/slices/runSlice.js
export const createRunSlice = (set, get) => ({
  phase: 'idle',              // idle | loading | deploy | battle | draft | victory | defeat | paused
  stageId: null,
  wave: 0,
  waveTotal: 0,
  mana: 0,
  riftEnergy: 0,
  arkHp: 100,
  arkHpMax: 100,
  selectedSlot: 0,
  summonCounts: {},           // { unitType: n } — 코스트 상승용
  sigils: [],
  commanderLane: 1,
  tempoShifted: false,

  startBattle: (stageId, cfg) => set({
    phase: 'deploy', stageId, wave: 0, waveTotal: cfg.waves,
    mana: cfg.startMana, riftEnergy: 0,
    arkHp: cfg.arkHp, arkHpMax: cfg.arkHp,
    summonCounts: {}, sigils: [], tempoShifted: false,
  }),

  // ★ Phaser의 update()가 10Hz로 호출하는 유일한 동기화 함수
  syncFromSim: (snapshot) => {
    const p = get();
    // 얕은 비교 후 변경분만 set — 불필요한 알림 차단
    if (p.mana === snapshot.mana && p.arkHp === snapshot.arkHp
        && p.wave === snapshot.wave && p.riftEnergy === snapshot.riftEnergy) return;
    set(snapshot);
  },

  endBattle: (result) => set({ phase: result }),   // 'victory' | 'defeat'
});
```

---

## 3. ★ 경계 규칙 — 무엇이 어디에 사는가

### 3.1 Zustand가 소유하는 것 (저빈도 · 경계 통과 · 영속)

- **메타 진행**: 보유 동료, 레벨, 재화, 해금 스테이지, 설정
- **전투 레벨 상태**: `phase`, `wave`, `mana`, `riftEnergy`, `arkHp`, `selectedSlot`, 획득 각인 목록
- **쿨다운은 잔여 시간이 아니라 타임스탬프로**: `{ cooldownUntil: 1234567.89 }` — 매 프레임 감소하는 카운터를 넣지 않는다
- **React → Phaser 의도**: "플레이어가 2번 슬롯을 레인 1에 소환하려 함"

### 3.2 Phaser 씬 메모리가 소유하는 것 (프레임 단위 · 휘발 · 고빈도)

- 모든 엔티티의 `x/y/vx/vy`, 애니메이션 프레임, 물리 바디, 현재 타겟 참조
- 발사체, 파티클, 트윈 핸들, 풀링된 오브젝트 배열
- 충돌/어그로 공간 구조

### 3.3 판단 기준

> **초당 10회 넘게 변하거나, 인스턴스가 20개를 넘으면 Zustand에 넣지 않는다.**
> 씬 안의 평범한 배열이나 `Phaser.GameObjects.Group` 에 두고, **집계값만 스로틀해서** 스토어에 밀어 넣는다 ("생존 유닛 14", "보스 HP 62%").

### 3.4 금지 사항

| # | 금지 | 결과 |
|---|---|---|
| 1 | `update()` 에서 조건 없이 `set()` 호출 | 초당 60회 setState × 구독 컴포넌트 N개 = 렌더 폭풍, 저사양 안드로이드에서 프레임 붕괴 |
| 2 | Zustand에 Phaser `GameObject` 참조 저장 | 직렬화 불가, `persist` 파손, 씬 그래프 전체 누수 |
| 3 | React에서 `useGameStore(s => s)` | 모든 변경에 재렌더 |
| 4 | React에서 메모 없는 객체 셀렉터 `s => ({a, b})` | **Zustand v5에서 경고/무한 루프.** `useShallow` 필수 |
| 5 | 씬 `shutdown()` 에서 구독 해제 누락 | 씬 재시작 시 리스너 중복 — 버그 1순위 원인 |

---

## 4. Phaser에서 스토어 사용하기

### 4.1 읽기 — `update()` 안에서는 구독하지 않는다

```js
update(time, delta) {
  const { phase } = gameStore.get();      // 구독 없음, 재렌더 없음
  if (phase !== 'battle') return;
  this.stepSimulation(delta);
  this.renderSimulation();
  this.throttledSync(delta);
}
```

### 4.2 쓰기 — 10Hz 스로틀

```js
// src/game/scenes/BattleScene.js
_syncAccum = 0;

throttledSync(delta) {
  this._syncAccum += delta;
  if (this._syncAccum < 100) return;      // 10Hz
  this._syncAccum = 0;

  const s = this.sim;
  gameStore.get().syncFromSim({
    mana:        Math.floor(s.mana),
    riftEnergy:  Math.floor(s.riftEnergy),
    arkHp:       s.arkHp,
    wave:        s.wave,
  });
}
```

`syncFromSim` 이 내부에서 얕은 비교를 하므로 값이 안 바뀌면 알림조차 발생하지 않는다.

#### ★★★ 목록은 **위치가 아니라 키**로 실어 보낸다 (2026-08-06)

시뮬 → HUD 로 넘기는 값 중 **여러 개짜리**(주문 쿨다운 · 슬롯 코스트)는
배열 위치로 실으면 **두 쪽이 같은 목록을 본다는 가정**이 유일한 보증이 된다.
그리고 그 가정이 깨져도 **아무도 실패하지 않는다** — 길이만 맞으면 엉뚱한 값이
그대로 그려진다.

실제로 그랬다. `BattleScreen` 이 씬 페이로드에 `spells` 를 빠뜨려 시뮬은
`spells.json:defaultLoadout` 4종으로 싸우고 HUD 는 플레이어가 고른 4종을 그렸다.
`cds[i]` 는 **남의 쿨다운**이었고, 화면에는 "쓰지도 않은 주문 위의 숫자"로 나타났다.
사용자 제보가 정확히 그것이다.

```js
// ❌ 위치 결합 — 어긋나도 조용하다
const cds = equipped.map((id) => cooldownPct(s, id));   // [0.9, 0, 0, 0]
const cd = cooldowns[i];

// ✅ 키 결합 — 어긋나면 그냥 없는 값(0)이다
const cds = {};
for (const id of equipped) cds[id] = cooldownPct(s, id);
const cd = cooldowns[sp.id] ?? 0;
```

> **참조 유지 최적화는 그대로 간다.** 배열이 객체가 되면서 `sameList` 옆에
> `sameMap` 이 생겼다 — 값이 같으면 참조를 유지해 10Hz 재렌더를 막는다.
>
> **`slotCosts` 는 아직 위치 배열이다.** 그쪽은 편성 슬롯이 씬·HUD 양쪽에서
> **같은 `cfg.loadout`** 에서 나오므로 어긋날 경로가 없다. 그 전제가 깨지는 날
> 같은 사고가 난다는 것만 기억한다.
>
> 지키는 검사: `src/hud/spellCooldown.test.js`

#### ★★ 씬 페이로드는 전투 설정이 읽는 것을 **전부** 담는다

`BattleScreen` 이 만드는 `cfg` 는 **React 표시용**이고, 씬은 같은 인자로
`buildStageConfig` 를 **다시 부른다.** 그래서 `switchScene("Battle", {...})` 에서
빠진 값은 **전투에 존재하지 않는다** — 화면과 시뮬이 다른 설정으로 돈다.

이 사고는 두 번 났다: 지휘관 HP 게이지(2026-08-05)와 주문 4칸(2026-08-06).
같은 검사(`spellCooldown.test.js` 의 페이로드 키 대조)가 두 호출부를 대조한다.

### 4.3 구독 — `subscribeWithSelector`

```js
create() {
  this._unsubs = [];

  // phase가 실제로 바뀔 때만 발동
  this._unsubs.push(gameStore.subscribe(
    (s) => s.phase,
    (phase) => {
      if (phase === 'battle') this.beginWave();
      if (phase === 'draft')  this.scene.pause();
      if (phase === 'defeat') this.playDefeatFx();
    },
    { fireImmediately: true }
  ));

  // 설정 변경 즉시 반영
  this._unsubs.push(gameStore.subscribe(
    (s) => s.settings.qualityTier,
    (tier) => this.applyQualityTier(tier)
  ));
}

shutdown() {
  this._unsubs.forEach((u) => u());
  this._unsubs.length = 0;
  this.tweens.killAll();
  this.pools.releaseAll();
}
```

> **`shutdown()` 에서의 구독 해제는 선택이 아니다.** Phaser는 씬 재시작 시 `create()` 를 다시 부르므로, 해제하지 않으면 구독이 누적된다.

---

## 5. React에서 스토어 사용하기

### 5.1 좁은 셀렉터

```jsx
// ✅
const mana = useGameStore(s => s.mana);
const arkHp = useGameStore(s => s.arkHp);

// ✅ 여러 값은 useShallow
import { useShallow } from 'zustand/react/shallow';
const { mana, wave, arkHp } = useGameStore(
  useShallow(s => ({ mana: s.mana, wave: s.wave, arkHp: s.arkHp }))
);

// ❌ 전체 구독
const state = useGameStore(s => s);

// ❌ v5에서 무한 루프 경고
const obj = useGameStore(s => ({ mana: s.mana, wave: s.wave }));
```

### 5.2 HUD 컴포넌트 분할

**HUD를 하나의 큰 컴포넌트로 만들지 않는다.** 값마다 별도 컴포넌트로 쪼개서 재렌더 범위를 최소화한다.

```jsx
// ❌ mana가 바뀔 때마다 HUD 전체 재렌더
function Hud() {
  const { mana, arkHp, wave, slots } = useGameStore(useShallow(...));
  return <>...</>;
}

// ✅ 각자 자기 값만 구독
function ManaBar()  { const mana  = useGameStore(s => s.mana);  return <Bar v={mana} />; }
function ArkHpBar() { const hp    = useGameStore(s => s.arkHp); return <Bar v={hp} />; }
function WaveText() { const wave  = useGameStore(s => s.wave);  return <span>{wave}</span>; }
```

10Hz 동기화 × 잘게 쪼갠 컴포넌트 = **React 렌더 비용이 프레임 예산에서 사실상 사라진다.**

### 5.3 액션은 셀렉터 밖에서

```jsx
// 액션 참조는 안정적이므로 재렌더를 유발하지 않는다
const summon = useGameStore(s => s.requestSummon);
```

---

## 6. 영속화

### 6.1 Capacitor Preferences 어댑터

```js
// src/native/storage.js
import { Preferences } from '@capacitor/preferences';

export const capacitorStorage = {
  getItem:    async (key) => (await Preferences.get({ key })).value ?? null,
  setItem:    async (key, value) => { await Preferences.set({ key, value }); },
  removeItem: async (key) => { await Preferences.remove({ key }); },
};
```

**왜 localStorage/IndexedDB가 아닌가:** WebView의 localStorage와 IndexedDB는 **OS가 언제든 삭제할 수 있다.** 특히 iOS는 persisted-storage API가 없어 위험하다. `@capacitor/preferences` 는 네이티브 `UserDefaults` / `SharedPreferences` 에 기록한다.

### 6.2 하이드레이션 게이팅

Preferences는 비동기이므로 하이드레이션 완료 전까지 라우터를 막는다.

```jsx
function Root() {
  const hydrated = useGameStore.persist.hasHydrated();
  useEffect(() => {
    if (hydrated) SplashScreen.hide();
  }, [hydrated]);
  if (!hydrated) return null;   // 스플래시 유지
  return <RouterProvider router={router} />;
}
```

### 6.3 저장 시점

| 시점 | 이유 |
|---|---|
| 메타 상태 변경 시 (자동, `persist` 기본) | |
| **`App.pause` 이벤트** | 앱 종료 시 유실 방지 — 가장 중요 |
| 전투 종료 직후 | |
| 5분 주기 백업 | 안전망 |

### 6.3.1 세이브 슬롯 3 (2026-08-04)

`src/store/slots.js`. 세이브가 하나뿐이던 시절, "처음부터 다시"는 곧 "기존 진행을
지운다" 였다 — 다시 해 보고 싶다는 마음을 **잃어도 되는가**라는 질문으로 바꾼다.

| 규칙 | 이유 |
|---|---|
| **슬롯 1 은 옛 키(`riftark-save`)를 그대로 쓴다** | 슬롯 도입 전 세이브가 정확히 그 키에 있다. 키를 바꾸면 기존 진행이 통째로 사라진 것처럼 보인다 |
| **슬롯 요약을 저장하지 않는다** | 목록의 진행도·별·마지막 플레이는 전부 그 슬롯의 세이브 원문에서 읽는다. 따로 저장하면 두 번째 출처가 되고, 언젠가 "목록에는 45스테이지인데 들어가면 12"가 된다 |
| **`readSlot` 은 어떤 입력에도 던지지 않는다** | 슬롯 하나가 손상됐다고 타이틀이 죽으면 나머지 두 슬롯에도 못 들어간다 |
| 읽히지 않는 슬롯은 **'손상됨'**이지 '비어 있음'이 아니다 | 덮어쓰기 전에 지울지 말지 고를 기회를 준다 |

**갈아타는 순서가 규칙이다:**

```js
store.persist.setOptions({ name: slotKey(slot) });  // ① 저장 키 교체
resetToPristine();                                  // ② 바닥을 지운다
await store.persist.rehydrate();                    // ③ 새 키를 얹는다
```

> ★★ **②는 저장되는 키만 되돌린다.** 한때 `setState(PRISTINE, true)` 로 상태를
> 통째로 갈아치웠는데, 그러면 `ui.assetsReady` 처럼 **세션당 한 번만 켜지는 플래그**
> 까지 false 가 된다. 그 플래그는 `PreloadScene.create()` 에서만 켜지고
> `BattleScreen` 은 false 면 씬을 시작하지 않는다 — **슬롯을 고른 뒤의 모든 전투가
> 빈 화면**이 됐다 (웨이브 0/0 · 배경 없음 · 오류 한 줄 없음).
> 개발 중에는 HMR 이 스토어 모듈을 프리로드 뒤에 다시 평가해 `PRISTINE` 에
> `assetsReady: true` 가 찍히는 바람에 **콜드 스타트에서만** 깨져 있었다.
> 되돌릴 목록은 `SAVED_KEYS` 하나이고 `partialize` 도 같은 것을 읽는다.
>
> ★★ **②가 없으면 빈 슬롯에 이전 계정이 남는다.** `rehydrate()` 는 저장본을
> *현재 상태 위에 얹을* 뿐이라 빈 슬롯에는 얹을 것이 없다. 실제로 그렇게
> 동작했다 — 빈 슬롯 2를 골랐는데 슬롯 1의 골드와 진행도가 보였다.
> `store/index.js:resetToPristine()` 이 모듈 로드 시점의 초기 상태를 되돌린다.
>
> 검증: `src/store/slots.test.js` 가 이 **호출 순서 자체**를 단언한다.

### 6.4 마이그레이션

`version` 을 올릴 때마다 `migrate` 를 반드시 작성한다. **세이브 파손은 리뷰 폭탄 직행이다.**

**`migrate` 는 `src/store/migrate.js` 에 따로 있다** (P7-15에서 분리).
`store/index.js` 는 Capacitor 저장소를 import 하고 모듈 로드만으로 하이드레이션을 시작해서
안에 있는 동안에는 단위 테스트가 불가능했다 — 정작 **가장 테스트가 필요한 코드**였다.
순수 함수로 떼어 두면 Node 에서 그대로 검증된다 (`src/store/migrate.test.js`).

```js
// src/store/migrate.js
export function migrate(persisted, from) {
  const s = { ...persisted };
  if (from < 2) { /* … */ }
  if (from < 3) { /* … */ }
  return s;
}
```

**신규 필드는 반드시 채운다.** zustand persist 는 저장본을 기본값 **위에** 통째로 얹으므로,
슬라이스에 필드를 추가해도 구세이브에는 그 키가 없다. 채우지 않으면 업데이트 직후 첫 렌더가
그대로 터진다 (P5에서 `idleAdClaims.day` 로 실제 발생).

**이름을 바꿀 때는 값을 옮긴다.** `uiScale → textScale`(v4)에서 값을 안 옮겼다면 UI 를 130% 로
쓰던 저시력 사용자가 업데이트 한 번에 100% 로 되돌아간다 — 조용하고 가장 나쁜 종류의 회귀다.

**이중 안전망.** `migrate` 는 version 이 낮을 때만 돈다. 손상된 세이브·외부 툴이 건드린
세이브는 버전이 최신인데 필드가 빌 수 있다. `onRehydrateStorage` 에서 `normalizeMeta` ·
`normalizeRoster` · `normalizeSettings` 를 매 부팅 돌린다 (전부 멱등).

**★★ 초기값은 마이그레이션이 아니다** (P8-03 → 통합, v13 → v14).
슬라이스의 초기값을 고쳐도 **세이브가 있는 계정에는 닿지 않는다** — persist 의 병합이
저장된 최상위 키를 통째로 얹기 때문이다. 확정 지급 동료의 시작 보유를 초기값에만 넣었더니
그 사이에 만들어진 세이브는 영원히 동료 0종이었고, 편성 화면이 빈 채로 FTUE 가 막혔다.
**"모든 계정이 갖는다"는 명제는 초기값이 아니라 마이그레이션 블록이 지킨다.**
초기값과 블록은 반드시 **같은 함수**를 불러 갈라질 수 없게 만든다.

**★★ 하이드레이션 경로에서는 절대 던지지 않는다** (P8-05).
zustand 의 하이드레이션 체인은 어디서든 throw 하면 `.catch` 로 빠지고, 그 경로는
`hasHydrated` 를 **true 로 만들지 않는다.** `App.jsx` 가 `if (!hydrated) return null` 이므로
그 계정은 **영원히 빈 화면**이고 설정 화면에 못 들어가니 초기화도 불가능하다 — 재설치가
유일한 복구 경로다. 그래서 두 자리를 막는다:
- `src/native/storage.js` — **파싱 불가 = 세이브 없음.** 잘린 JSON 에서 `JSON.parse` 가
  던지지 않게 어댑터가 먼저 삼킨다.
- `store/index.js:onRehydrateStorage` — `normalize*` 묶음을 `try/catch` 로 감싼다.
  슬라이스가 늘어날 때마다 같은 위험이 새로 생기고, 그때 잃는 것이 "필드 하나가 기본값"
  인지 "앱이 안 뜬다" 인지는 이 `try` 하나가 정한다.

이 두 가지는 `src/store/saveDurability.test.js` 가 고정한다. 그 파일은 **어댑터를 모킹하지
않는다** — 네이티브 플러그인만 가짜로 두고 `capacitorStorage` 는 앱이 쓰는 그것 그대로
지나가게 한다. 어댑터를 대체하면 위 첫 번째 수정이 관측 대상에서 통째로 빠진다.

**출시 전 QA 항목:** 이전 버전 세이브 파일로 신버전을 실행해 정상 동작하는지 매 릴리스마다 검증.

---

## 7. 성능 검증

| 검사 | 방법 | 기준 |
|---|---|---|
| 전투 중 React 렌더 횟수 | React DevTools Profiler, 60초 전투 | **< 700회** (10Hz × 60s × 컴포넌트 소수) |
| `set()` 호출 빈도 | 스토어에 카운터 래핑 (개발 모드) | **< 12회/초** |
| 스토어 구독자 수 | `useGameStore.subscribe` 카운트 | 씬 전환 후에도 증가하지 않을 것 |
| 세이브 크기 | `JSON.stringify(persisted).length` | **< 200KB** |
| 하이드레이션 시간 | 계측 | **< 150ms** |

**CI 게이트:** 개발 빌드에서 `set()` 이 초당 20회를 초과하면 콘솔 경고를 띄운다. 이 규칙을 어기는 코드는 리뷰에서 반려한다.

---

## 8. 안티패턴 사례집

```js
// ❌ 프레임마다 스토어 업데이트
update(t, dt) {
  gameStore.set({ commanderX: this.commander.x });   // 60Hz setState
}

// ✅ 씬 로컬 상태로 두고, 필요 시 이벤트로만 통지
update(t, dt) {
  this.commander.x = this.sim.commander.x;           // Phaser 내부
  if (this.laneChanged) EventBus.emit('commander-lane', this.sim.commander.lane);
}


// ❌ 쿨다운을 감소 카운터로 저장
set({ spellCooldown: prev - dt });                   // 60Hz

// ✅ 만료 타임스탬프로 저장
set({ spellReadyAt: this.sim.t + 3000 });            // 1회


// ❌ 유닛 배열을 스토어에
set({ units: this.units });                          // 100+ 객체, 매 프레임

// ✅ 집계값만
set({ aliveCount: this.units.length });              // 10Hz, 숫자 하나
```
