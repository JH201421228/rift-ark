# 28. 코딩 컨벤션

---

## 1. 언어 & 스타일

- **JavaScript (ESM)**, TypeScript 아님. 기존 프로젝트 설정을 따른다
- **JSDoc 타입 주석**으로 타입 안전성을 보완한다 (특히 `src/game/logic/`)
- Prettier 설정은 `.prettierrc` 를 따른다 (탭 4칸, 세미콜론)
- ESLint는 `eslint.config.js`. **경고를 남기지 않는다** (`--max-warnings 0`)

```js
/**
 * 데미지를 계산한다.
 * @param {import('./types').Entity} attacker
 * @param {import('./types').Entity} target
 * @returns {{ dmg: number, absorbed: boolean, effective: boolean }}
 */
export function computeDamage(attacker, target) { /* ... */ }
```

---

## 2. 네이밍

| 대상 | 규칙 | 예 |
|---|---|---|
| 파일 (컴포넌트) | PascalCase | `PhaserGame.jsx`, `LoadoutScreen.jsx` |
| 파일 (모듈) | camelCase | `runSlice.js`, `assetUrl.js` |
| 파일 (씬/클래스) | PascalCase | `BattleScene.js`, `ProjectilePool.js` |
| 상수 | UPPER_SNAKE | `TICK_MS`, `LANE_Y` |
| 데이터 id | snake_case | `honking_goose`, `piercing_arrow` |
| 스테이지 id | `<world>-<index>` | `4-12` |
| 이벤트 (EventBus) | kebab-case | `battle-ended`, `sigil-draft-open` |
| 아틀라스 키 | kebab-case | `atlas-units`, `atlas-boss-bringer` |
| 프레임 키 | 원본 경로 유지 | `Animals/HonkingGoose` |
| Zustand 액션 | 동사 시작 | `startBattle`, `claimIdle` |

**한국어 주석 허용.** 팀 언어가 한국어이므로 주석은 한국어로 쓰되, **식별자는 영어**로 통일한다.

---

## 3. 폴더 규칙

`20-architecture.md` §3의 구조를 따른다. 추가 규칙:

| 규칙 | 이유 |
|---|---|
| `src/game/logic/` 에 `phaser`, `@/store`, DOM API import 금지 (ESLint 강제) | 결정론·테스트 가능성 |
| `src/game/scenes/` 는 게임 규칙을 갖지 않는다. 렌더와 입력만 | 로직 이중화 방지 |
| `src/store/slices/` 는 서로를 import하지 않는다. 교차 접근은 `get()` 으로 | 순환 의존 방지 |
| `src/screens/` 는 Phaser를 직접 만지지 않는다. EventBus 또는 스토어를 통한다 | 경계 유지 |
| `tools/` 는 브라우저 코드를 import하지 않는다 (Node 전용) | |
| 밸런스 수치는 `src/game/data/*.json` 에만 | SSOT |

---

## 4. import 순서

```js
// 1. 외부 패키지
import Phaser from 'phaser';
import { create } from 'zustand';

// 2. 내부 절대경로 (@/)
import { gameStore } from '@/store';
import { assetUrl } from '@/game/assetUrl';

// 3. 상대경로
import { step, TICK_MS } from '../logic/sim';
import { ProjectilePool } from '../pools/ProjectilePool';

// 4. 데이터/스타일
import unitsData from '@/game/data/units.json';
import styles from './Screen.module.css';
```

---

## 5. React 규칙

```jsx
// ✅ 좁은 셀렉터
const mana = useGameStore(s => s.mana);

// ✅ 여러 값은 useShallow
import { useShallow } from 'zustand/react/shallow';
const { a, b } = useGameStore(useShallow(s => ({ a: s.a, b: s.b })));

// ❌ 전체 구독
const state = useGameStore(s => s);

// ❌ 메모 없는 객체 셀렉터 (v5에서 경고/루프)
const obj = useGameStore(s => ({ a: s.a, b: s.b }));
```

| 규칙 | 이유 |
|---|---|
| HUD는 값 단위로 컴포넌트를 쪼갠다 | 재렌더 범위 최소화 (`21` §5.2) |
| CSS Modules 사용 (`*.module.css`) | 전역 오염 방지 |
| 인라인 스타일은 동적 값에만 | |
| `useEffect` 의존성 배열을 비우지 않는다 (의도적일 때 주석 명시) | |
| Phaser 캔버스를 라우트마다 언마운트하지 않는다 | 로딩 반복·메모리 파편화 |

---

## 6. Phaser 씬 규칙

**모든 씬은 이 골격을 따른다.**

```js
export class BattleScene extends Phaser.Scene {
  constructor() { super({ key: 'Battle' }); }

  init(data)   { /* 파라미터 수신, 상태 초기화 */ }
  preload()    { /* 씬 전용 에셋 (지연 로드는 별도 메서드) */ }
  create()     {
    this._unsubs = [];
    this.pools = { /* ... */ };
    // 구독 등록
  }
  update(t, dt){ /* 고정 틱 구동 + 렌더 */ }

  // ★ 반드시 구현한다
  shutdown() {
    this._unsubs.forEach(u => u());
    this._unsubs.length = 0;
    this.tweens.killAll();
    this.time.removeAllEvents();
    Object.values(this.pools).forEach(p => p.destroy());
    EventBus.off('request-summon', this.onSummon, this);
  }
}
```

| 규칙 | 이유 |
|---|---|
| **`shutdown()` 미구현 씬은 리뷰 반려** | 씬 재시작 시 리스너·트윈 중복이 버그 1순위 |
| `update()` 에서 조건 없이 `gameStore.set()` 금지 | 렌더 폭풍 |
| `update()` 에서 배열 생성·문자열 결합 금지 | GC 스터터 |
| 반복 생성 객체는 반드시 풀링 | |
| 매직 넘버 금지 — `config.js` 또는 데이터로 | |

---

## 7. 시뮬레이션 규칙 (`src/game/logic/`)

| # | 규칙 |
|---|---|
| 1 | `phaser` / DOM / `window` / `document` import 금지 |
| 2 | `Math.random()` 금지 → `state.rng.<stream>()` |
| 3 | `Date.now()` / `new Date()` 금지 → `state.t` |
| 4 | 객체 키 순회는 `Object.keys(o).sort()` 후 |
| 5 | 정렬은 항상 타이브레이크(`id`) 포함 |
| 6 | 틱당 힙 할당 0 지향 — 임시 객체 반환 대신 out 파라미터 |
| 7 | 모든 공개 함수에 JSDoc + 단위 테스트 |

**ESLint가 1–3을 강제한다** (`22` §1).

---

## 8. 데이터 규칙

| 규칙 |
|---|
| 밸런스 수치는 코드가 아니라 `src/game/data/*.json` |
| 모든 표시 문자열은 `{ "ko": "...", "en": "..." }` 형태 |
| 스키마 파일(`data/schemas/*.schema.json`)을 함께 갱신 |
| 데이터 변경 커밋에는 **`npm run balance:quick` 결과 요약을 커밋 메시지에 포함** |
| 아트 참조(`art.atlas`, `art.frame`)는 데이터 필드. **코드에 하드코딩 금지** (리스킨·이벤트 스킨·A/B 대응) |

---

## 9. Git

### 9.1 브랜치

```
main            항상 배포 가능
develop         통합
feature/<설명>  기능
fix/<설명>      버그
balance/<설명>  밸런스 전용 (데이터만 변경)
```

### 9.2 커밋 메시지

```
<타입>(<범위>): <요약>

<본문 — 왜 이렇게 했는지>

<밸런스 변경 시 필수>
balance: B2 89.2% → 91.4%, B4 all pass, B7 44/44
```

**타입:** `feat` `fix` `perf` `refactor` `balance` `docs` `test` `chore` `art` `data`
**범위:** `sim` `scene` `store` `ui` `hud` `pipeline` `native` `data`

```
feat(sim): 각인 진화 판정 추가

각인 획득 시점에만 1회 검사한다. 매 틱 검사하면 75종 × 12조합을
30Hz로 스캔하게 되어 틱 예산을 초과한다.

balance: B13 픽률 4.2–11.8% (기준 3–12% 통과), B14 31%
```

### 9.3 PR 체크리스트

- [ ] `npm run lint` 통과 (경고 0)
- [ ] `npm run test` 통과
- [ ] `npm run data:validate` 통과 (데이터 변경 시)
- [ ] `npm run balance:check` 하드 게이트 통과 (밸런스 영향 시)
- [ ] 새 씬에 `shutdown()` 구현
- [ ] `update()` 에 스토어 무조건 쓰기 없음
- [ ] 새 반복 객체에 풀링 적용
- [ ] 한국어 문자열로 UI 확인 (한글 폭 2배)
- [ ] 새 에셋 참조가 데이터 필드로 되어 있음

---

## 10. 리뷰 반려 사유 (자동)

| # | 사유 |
|---|---|
| 1 | `src/game/logic/` 에서 `Math.random()` 또는 Phaser import |
| 2 | `update()` 에서 조건 없는 `gameStore.set()` |
| 3 | 씬에 `shutdown()` 없음 또는 구독 해제 누락 |
| 4 | 밸런스 수치를 코드에 하드코딩 |
| 5 | 에셋 경로를 코드에 하드코딩 |
| 6 | `update()` 안에서 배열 생성 / 문자열 결합 / `filter` / `map` |
| 7 | 새 반복 생성 객체에 풀링 없음 |
| 8 | React 컴포넌트에서 `useGameStore(s => s)` |
| 9 | **확률형 요소 추가 (어디든)** — 2026-08-04 이후 이 게임에는 확률형이 하나도 없다 |
| 10 | 세이브 스키마 변경에 `migrate` 누락 |

---

## 11. 국제화

```js
// src/i18n/index.js
export function t(key, params) { /* ... */ }
```

| 규칙 |
|---|
| **하드코딩된 사용자 노출 문자열 금지** |
| 데이터의 표시 문자열은 `{ ko, en }` 객체 |
| UI 문자열은 `src/i18n/<lang>.json` |
| **한국어를 기준 언어로 개발**하고 영어를 맞춘다 (레이아웃이 한글에서 깨지지 않게) |
| 숫자 포맷은 `Intl.NumberFormat` |
| 날짜는 UTC 저장, 표시만 로컬 |

출시 언어: 한국어 · 영어. 이후 일본어 · 중국어 번체 · 태국어.

---

## 12. 로깅

```js
// src/utils/logger.js
export const log = {
  debug: import.meta.env.DEV ? console.log.bind(console, '[dbg]') : () => {},
  info:  console.log.bind(console, '[info]'),
  warn:  console.warn.bind(console, '[warn]'),
  error: (msg, err) => { console.error('[err]', msg, err); reportToCrashlytics(msg, err); },
};
```

| 규칙 |
|---|
| 프로덕션에서 `console.log` 직접 호출 금지 |
| `update()` 안에서 로깅 금지 (초당 60회) |
| 에러는 반드시 크래시 리포터로 전송 |
| **개인정보를 로그에 남기지 않는다** |

---

## 13. 성능 관련 린트

```js
// eslint.config.js 추가 규칙
{
  files: ['src/game/scenes/**/*.js', 'src/game/logic/**/*.js'],
  rules: {
    'no-restricted-syntax': ['error',
      {
        selector: "MethodDefinition[key.name='update'] CallExpression[callee.property.name=/^(filter|map|reduce)$/]",
        message: 'update() 안에서 배열 생성 금지 — 사전 할당된 배열을 재사용하세요',
      },
      {
        selector: "MethodDefinition[key.name='update'] CallExpression[callee.object.name='gameStore'][callee.property.name='set']",
        message: 'update() 에서 직접 set() 금지 — throttledSync() 를 사용하세요',
      },
    ],
  },
}
```

린트로 잡을 수 있는 것은 리뷰가 아니라 린트로 잡는다.

---

## 14. 문서

| 규칙 |
|---|
| 아키텍처 결정이 바뀌면 `docs/` 를 **같은 PR에서** 갱신한다 |
| 새 시스템은 해당 설계 문서에 절을 추가한다 |
| 밸런스 정책 변경은 `02-design/14-economy-balance.md` 갱신 필수 |
| **문서와 코드가 다르면 문서가 버그다** — 발견 즉시 수정하거나 이슈 등록 |
