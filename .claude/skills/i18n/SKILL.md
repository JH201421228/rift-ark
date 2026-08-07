---
name: i18n
description: RIFT ARK 의 한국어/영어 이중 언어 작업. 사용자에게 보이는 문자열을 추가·수정·번역할 때, 새 화면이나 새 데이터 필드를 만들 때, "영어에서 글자가 안 나온다 / [object Object] 가 뜬다 / 언어를 바꿔도 안 바뀐다" 를 고칠 때 사용한다. 번역·i18n·locale·언어·English·한국어 라는 말이 나오면 먼저 이 스킬을 읽는다.
---

# i18n — 한국어 · 영어

이 저장소의 이중 언어 규약과 **실제로 깨지는 방식**을 적는다.
정본 코드는 `FE/src/i18n/index.js` 의 머리말이고, 기계 강제는 `FE/tools/check-i18n.mjs` 다.

```bash
cd FE && npm run check:i18n          # 전체 검사
node tools/check-i18n.mjs --list-korean src/screens/ArkScreen.jsx   # 그 파일의 한국어만
```

---

## 0. 한 문장 요약

**두 언어를 언제나 같은 자리에 나란히 적는다.** 파일을 나누지 않는다.

```json
"title": { "ko": "방주", "en": "The Ark" }
```

`ko.json` / `en.json` 을 따로 두는 흔한 구조를 쓰지 않는 이유: 이 저장소가 반복해서
당한 단일 실패 유형이 **"같은 사실을 두 곳에 적으면 갈라진다"** 이고, 두 파일 구조는
그 사고를 **설계로 보장**한다.

---

## 1. 문자열이 사는 곳은 딱 두 군데다

| 무엇 | 어디 | 읽는 법 |
|---|---|---|
| UI 문구 (버튼·제목·안내·aria-label) | `FE/src/i18n/messages/<네임스페이스>.json` | `t("<네임스페이스>.<키>")` |
| 게임 데이터 이름·설명 (동료·적·각인·주문·시설·가이드) | `FE/src/game/data/*.json` 의 **그 항목 안** | `pick(obj, "name")` |

데이터 이름을 카탈로그로 옮기지 않는다 — 밸런스를 만지는 사람이 두 파일을 오가게
되고, 그 순간 둘이 갈라진다.

### 네임스페이스 = 파일 이름
`messages/ark.json` 의 `title` → `t("ark.title")`.
새 네임스페이스를 만들면 **`i18n/index.js` 의 import 와 `NAMESPACES` 에 둘 다** 등록해야
한다. 빠뜨리면 그 네임스페이스 전체가 조용히 키 문자열로 표시된다 (`check:i18n` I2 가 잡는다).

병렬 작업에서 네임스페이스 파일 하나 = 담당자 하나다. 카탈로그를 한 파일로 합치면
그 파일이 유일한 충돌 지점이 된다.

---

## 2. React 에서는 반드시 `useT()`

```jsx
import { useT, usePick, useLang } from "@/i18n/useT";

const t = useT();
const pick = usePick();
<h1>{t("ark.title")}</h1>
<b>{pick(def, "name")}</b>
```

**`import { t } from "@/i18n"` 를 컴포넌트에서 직접 쓰면 언어를 바꿔도 그 컴포넌트가
다시 그려지지 않는다.** `t` 는 모듈 스코프 값을 읽는 순수 함수라 React 가 변화를 볼 수
없다. `useT()` 는 `settings.language` 를 **구독**한다.

React 가 아닌 곳(Phaser 씬 · 프레젠터 · `game/logic/`)은 `t`/`pick` 을 직접 쓰되,
언어가 바뀌면 다시 그려야 하는 것은 `onLangChange(fn)` 을 구독하고 **씬의 `shutdown()`
에서 해제**한다 (절대규칙 3).

---

## 3. 문장을 코드에서 결합하지 않는다

한국어와 영어는 **어순이 다르다.** 조각을 이어 붙이면 한쪽은 반드시 어색해진다.

```jsx
// 금지
`골드가 ${n} 부족합니다`
`${min}별 이상으로` + `클리어하면 열립니다`

// 올바름 — 문장 전체가 한 키
t("companions.goldShort", { n })
//  ko: "골드가 {n} 부족합니다"
//  en: "{n} more gold needed"
```

- 자리표는 `{name}` 꼴. ko 와 en 의 자리표 **집합이 같아야** 한다 (`check:i18n` I3).
- 문장 안에 조건부 조각이 들어가면, 조각도 키로 만들고 **틀을 언어마다 자연스러운
  어순으로** 다시 쓴다. 같은 틀에 번역만 끼우려 하지 마라.
- 영어는 **복수형**이 필요하다. 실제로 1이 될 수 있는 곳만 키를 둘로 나눈다
  (`…One` / `…Many`). 모든 곳에 만들면 카탈로그가 두 배가 되고 아무도 안 읽는다.

---

## 4. 데이터 필드의 정본 형태

```json
{ "name": { "ko": "성기사", "en": "Paladin" } }
```

검사 대상 필드 이름: `name` `desc` `flavor` `label` `title` `body` `hint` `lore`.
배열도 같다 — `"body": { "ko": [...], "en": [...] }`.

**금지**: `nameKo` 접미사, 맨 한국어 문자열. 둘 다 `check:i18n` I5 가 오류로 잡는다.

`pick()` 은 구형 두 갈래도 읽어 주지만, **새로 그렇게 적으면 검사기가 막는다.**
호환 갈래는 마이그레이션 중에만 의미가 있다.

### 데이터 구조를 바꾸면 읽는 코드가 죽는다
`nameKo` → `name: {ko,en}` 로 바꾸는 순간 화면은 `undefined` 나 `[object Object]` 를
그린다. **바꾸기 전에 `grep -rn "nameKo\|\.name\.ko\|\.label\b" src` 로 소비처를 전부
찾아라.** 특히 `?? ""` · `?? id` 같은 폴백이 있는 곳은 **죽지 않고 조용히 틀린다** —
가장 나쁜 종류다.

---

## 5. 언어를 바꾸는 경로

| 무엇 | 어디 |
|---|---|
| 저장 | `settings.language` (`game/data/settings.json:defaults` · zustand persist) |
| 신규 계정 기본값 | `settingsSlice.defaultSettings()` → `detectLang()` (기기 로케일. `navigator` 가 없으면 `ko`) |
| 모듈 스코프 반영 | `App.jsx` → `setLang(v.language)` — 이 한 줄이 없으면 화면은 영어인데 **전장 글자만 한국어** |
| `<html lang>` · `document.title` | 같은 자리 |
| 버튼 | `components/LangToggle.jsx` — **모든 화면 머리글**에 있다 (설정 안에만 두면 영어권 사용자가 찾아갈 수 없다) |
| 런처 아이콘 아래 이름 | **웹뷰가 못 바꾼다.** `android/app/src/main/res/values-en/strings.xml` · iOS `InfoPlist.strings`. OS 로케일이 정한다 |

언어 이름은 **언제나 endonym** 이다 — 영어 화면에서도 `한국어`, 한국어 화면에서도
`English`. "Korean" 이라고 적으면 실수로 영어로 바꾼 사람이 되돌아올 단서를 잃는다.

---

## 6. 이 저장소에서 번역이 실패하는 다섯 가지 방식

`tools/check-i18n.mjs` 는 정확히 이것들을 잡는다.

| 코드 | 무엇 | 증상 |
|---|---|---|
| I1 | 한 언어만 적음 / `en` 에 한글이 남음 | 그 자리가 비거나 영어 화면에 한글 |
| I2 | `messages/` 에 파일을 넣고 `index.js` import 를 잊음 | 그 네임스페이스 **전체**가 키 문자열 |
| I3 | 자리표가 한쪽에만 있음 | 영어 문장에서 숫자가 통째로 사라짐 |
| I4 | 카탈로그를 만들어 놓고 화면은 여전히 하드코딩 | 언어를 바꿔도 그 화면만 안 바뀜 |
| I5 | 데이터에 `en` 이 없거나 구형 형태 | 영어 화면에 한국어가 튀어나옴 |
| I6 | 없는 키를 부름 / 아무도 안 부르는 키 | 화면에 키가 그대로 뜸 (오류) · 죽은 카탈로그 (경고) |

`PENDING` 집합은 **부채 목록**이다. 줄어들기만 해야 한다 — 새 파일을 거기 더하는 것은 회귀다.

---

## 7. 영어가 **더 넓다** — CLAUDE.md 절대규칙 9 의 전제가 이 폰트에서는 거꾸로다

폰트(`Mulmaru`)는 한글:라틴 = **1 : 0.5** 듀오스페이스다. 실측:

| | 비 |
|---|---|
| 동료 이름 50종 | 영어가 평균 **1.30배** 넓다 (40/50) |
| 적 이름 62종 | 평균 **1.19배** (44/62) |
| 최악 | `황금 갑충 여왕`(14) → `Royal Scarab Matriarch`(22) — **1.57배** |

즉 **한국어에 맞춘 고정 폭 상자는 영어에서 말줄임된다.** 문자열을 옮길 때 CSS 도 함께
본다. 위험한 곳: `.enemyName{max-width:92px}` · `.roleTag{max-width:34px}` ·
`Meta.module.css .card{width:92px}` · `.nav{width:128px}` · `.tab`.
고칠 때는 **두 언어 다 확인**한다 — 영어를 고치다 한국어를 망가뜨리면 그것도 회귀다.

---

## 8. 조용히 깨지는 두 곳 (반드시 기억)

### ① 비트맵 폰트 글리프 화이트리스트
`game/pools/damageFont.js` 의 `DAMAGE_GLYPHS` 가 데미지 텍스트에 쓸 글자를 못박는다.
**Phaser BitmapText 는 폰트에 없는 문자를 경고 없이 건너뛴다.** 영어 문구(`Weak!`
`Resist` …)를 쓰면서 A–Z 를 넣지 않으면 **전투 중 숫자가 조용히 사라진다.**
두 언어의 모든 문구에 쓰이는 글자를 전부 넣고, 테스트가 **두 언어를 다** 검사하게 한다.

### ② `check-production.mjs` 의 마커
프로덕션 빌드의 디버그 잔재를 **"한글이 든 텍스트 덩어리"** 로 찾는다. UI 를 영어로
바꾸면 그 마커가 사라져 **거짓 통과**한다. 영어 문자열도 함께 보게 고쳐야 한다.

---

## 9. 새 문자열을 추가하는 절차

1. 어느 네임스페이스인지 정한다 (두 화면 이상에서 쓰면 `common`, 전투 개념이면 `terms`).
2. `messages/<ns>.json` 에 `{ "ko": …, "en": … }` 로 **동시에** 적는다.
3. 화면에서 `useT()` 로 부른다.
4. `npm run check:i18n` 이 통과하는지 본다.
5. **검사기를 한 번 깨뜨려 본다** — `en` 을 지우거나 한글을 넣어 실제로 잡히는지.
   이 저장소의 규약이다: 검사기가 아무것도 안 지키면서 통과한 전례가 셋 있다.
6. 두 언어로 **화면을 실제로 열어 본다.** lint·테스트를 다 통과한 채 화면에서만
   드러난 결함이 이 저장소에 셋 있었다.

---

## 10. 번역 품질

- **판타지 게임 영어**로 쓴다. 기계 번역 투를 쓰지 않는다.
- 확정 역어는 `messages/common.json` 과 `terms.json` 에 있다. **새 낱말을 만들기 전에
  거기부터 본다.** Rift · Ark · Commander · Companion · Sigil · Spell,
  역할 Blocker/Melee/Ranged/Caster/Support/Siege/Flyer,
  태그 Armored/Warded/Flying/Swarm/Corrupt/Living/Shielded/Regen/Anti-Air,
  타입 Physical/Arcane/Holy.
- 전투 UI 는 특히 짧게. 이름은 12자 이내를 노린다.
- 가이드 본문은 **다시 쓴다.** 직역하면 읽히지 않는다. 정보량과 순서는 유지하고,
  본문에 **수치를 넣지 않는다** (`guideFacts()` 가 데이터에서 읽어 표로 만든다).
- `**강조**` 마크다운은 위치가 의미다. 영어에서 강조해야 할 낱말에 다시 붙인다.
