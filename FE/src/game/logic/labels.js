/**
 * 전투 개념의 표기 — **단일 출처** (P9-04 · 2026-08-07 두 언어)
 *
 * ★★ **여기 있는 이름들은 색이 아닌 유일한 채널이다.**
 *   이 게임의 상성은 색으로도 읽히지만(데미지 숫자 색 · 태그 배지 색), 색각 이상
 *   사용자에게는 **글자만 남는다.** 그 글자가 화면마다 다르면 색약 대응은 없는 것과
 *   같다 — "결계"에 막혀 죽었는데 패배 화면은 "마법저항"이라고 말한다면, 플레이어는
 *   그 둘을 **서로 다른 개념으로 배운다.**
 *
 * ★★ 실제로 갈라져 있었다 (2026-08-03 발견). `codex.js` 는 "라벨을 화면이 아니라
 *   여기에 둔다"고 적어 두었지만 사본이 셋 더 있었고, 그중 넷이 이미 달랐다:
 *
 *   | 태그 | codex(정) | StagePreview | BattleResult | BossPresenter |
 *   |---|---|---|---|---|
 *   | ARMORED | 중장갑 | 중장갑 | **장갑** | **장갑** |
 *   | WARDED  | 결계   | 결계   | **마법저항** | **마법저항** |
 *   | CORRUPT | 타락   | 타락   | **오염**   | **오염** |
 *   | LIVING  | 생명체 | 생명체 | **생명**   | **생명** |
 *
 *   프리뷰에서 배운 단어를 전장·패배 화면에서 못 알아보면 프리뷰는 없는 것과 같다
 *   (`18-ux-ui.md` §2.3).
 *
 * ★★★ **글자는 이제 `i18n/messages/terms.json` 이 갖는다** (2026-08-07).
 *   위 사고는 언어가 둘이 되면 **두 배로** 일어난다 — 한국어 사본 넷이 갈라졌던
 *   자리에 영어 사본 넷이 더 생기기 때문이다. 그래서 이 모듈은 사전을 **소유하지
 *   않고 조회만 한다.** 여기 있는 것은 `id → 카탈로그 키` 규칙 하나뿐이다.
 *
 * ★ 이 모듈은 의존성이 가볍다. 라벨을 쓰려고 `codex.js`(stages.json · enemies.json ·
 *   sigils.json 전량)를 끌어오면 Phaser 프레젠터와 결과 화면이 도감 데이터를 통째로
 *   안고 다니게 된다. 라벨은 도감의 소유물이 아니다. `i18n/index.js` 는 순수한
 *   JSON 조회층이라(스토어 · DOM · Phaser 없음) 절대규칙 1 을 깨지 않는다.
 *
 * @see docs/02-design/18-ux-ui.md §6
 * @see src/game/logic/tags.js (비트 정의 — 이름이 아니라 개념의 출처)
 * @see src/i18n/messages/terms.json (태그 · 데미지타입 · 역할 · 난이도 · 모드)
 * @see src/i18n/messages/rules.json (등급)
 */
import iconsData from "../data/icons.json" with { type: "json" };
import settingsData from "../data/settings.json" with { type: "json" };
import { t, pick } from "../../i18n/index.js";

/**
 * 태그 id 목록.
 * ★ `tags.js:TAG` 의 **모든 키**를 덮어야 한다 — 덮지 못하면 화면에 영어 id 가
 *   그대로 노출된다 (세력 이름에서 실제로 겪었다). 여기서 `tags.js` 를 import 해
 *   자동으로 파생시키지 않는 이유는, 그렇게 하면 "이름이 있는가"를 묻는 검사가
 *   **정의상 참**이 되어 아무것도 지키지 않게 되기 때문이다.
 */
export const TAG_IDS = [
    "ARMORED",
    "WARDED",
    "FLYING",
    "SWARM",
    "CORRUPT",
    "LIVING",
    "SHIELDED",
    "REGEN",
    "ANTI_AIR",
];

/** 데미지 타입 3종. 순서가 곧 화면 표시 순서다 (물리 → 술식 → 신성). */
export const DAMAGE_TYPES = ["physical", "arcane", "holy"];

/** 등급 표시 순서 (상위 등급부터) */
export const RARITY_ORDER = ["L", "E", "R", "C"];

/* ───────────────────────── 조회 함수 ─────────────────────────
 *
 * ★★ **함수여야 한다.** 상수 객체는 모듈이 로드될 때 한 번 계산되므로, 설정에서
 *   언어를 바꿔도 그 값은 영원히 부팅 당시의 언어로 남는다. 화면이 다시 렌더돼도
 *   같은 객체를 읽으므로 아무 일도 일어나지 않는다.
 * ★ 없는 id 는 `t()` 가 **키 자체**를 돌려준다 (`terms.tag.FOO`). 빈 문자열이면
 *   화면에서 조용히 사라지는데, 그것이 이 저장소가 가장 자주 당한 사고의 모양이다.
 */

/** 적/유닛 태그 이름 */
export function tagLabel(tag, lang) {
    return t(`terms.tag.${tag}`, undefined, lang);
}

/** 데미지 타입 이름 (물리 · 술식 · 신성) */
export function dmgTypeLabel(dmgType, lang) {
    return t(`terms.dmg.${dmgType}`, undefined, lang);
}

/**
 * 색약 모드에서 데미지 숫자 앞에 붙는 짧은 표기 (`물` · `Ph` …).
 *
 * ★★★ **출처는 `settings.json:damageTypeShort` 하나다** (2026-08-07 정정).
 *   한때 이 표가 카탈로그(`terms.dmgShort.*`)와 게임 데이터 **두 곳**에 있었다 —
 *   이 함수는 카탈로그를, `pools/DamageTextPool.js` 는 데이터를 읽었고, 둘이 갈라지면
 *   **HUD 의 데미지 숫자와 화면의 설명이 서로 다른 글자**를 쓰게 된다. 색약 모드에서
 *   그 글자는 색을 대신하는 유일한 채널이므로, 갈라지는 순간 대응 자체가 무의미해진다.
 *   `data:validate` 와 `check:a11y` 가 이미 데이터 쪽 표를 알고 있으므로 그쪽이 정본이다.
 *
 * ★ 영어는 한 글자로 Physical · Holy 가 구분되지 않아 두 글자다.
 * ★ `store/` 를 거치지 않는다 — `settingsSlice.js` 도 같은 JSON 을 재수출할 뿐이고,
 *   `logic/` 이 스토어를 import 하면 순수 격리가 깨진다 (절대규칙 1).
 */
export function dmgTypeShort(dmgType, lang) {
    return pick(settingsData.damageTypeShort ?? {}, dmgType, lang);
}

/**
 * 등급 이름.
 *
 * ★ 2026-08-04 경량화로 가챠가 사라지면서 `gacha.json` 도 사라졌다. 등급 자체는
 *   남는다 — 동료의 희소성 표기는 편성·동료 화면이 여전히 쓴다. 뽑을 수 없을 뿐
 *   "레전더리 동료"는 그대로 레전더리다.
 */
export function rarityLabel(rarity, lang) {
    return t(`rules.rarity.${rarity}`, undefined, lang);
}

/* ───────────────────────── 재화 표기 ─────────────────────────
 *
 * ★★ **아이콘 키 표가 화면마다 복제돼 있었다** — 상점 · 일일 · 던전 · 배틀패스가
 *   `{gold, gems, stones, guildCoins} → "currency.*"` 를 글자 하나까지 같게 각자
 *   들고 있었다. 그 화면들도 그 재화들도 2026-08-04 경량화로 사라졌지만,
 *   **파생 규칙은 그대로 둔다** — 아이콘 키의 출처는 `icons.json` 하나여야 한다
 *   (절대 규칙 5).
 */

/** `currency.*` 아이콘 키 목록에서 재화 id 를 뽑는다 */
const CURRENCY_ICON_KEYS = Object.keys(iconsData.icons).filter((k) => k.startsWith("currency."));

/** 재화 id → 논리 아이콘 키 (`<GameIcon name={CURRENCY_ICON.gold} />`) */
export const CURRENCY_ICON = Object.fromEntries(
    CURRENCY_ICON_KEYS.map((k) => [k.slice("currency.".length), k])
);

/**
 * 재화 이름.
 * ★★ `icons.json` 의 `label` 은 **한국어 한 언어뿐**이다. 이름은 두 화면 이상에서
 *   같은 뜻으로 쓰이는 낱말이므로 `common` 네임스페이스가 정본이다 —
 *   아이콘 키(`icons.json`)와 이름(카탈로그)의 출처를 나눠 둔다.
 */
export function currencyLabel(currency, lang) {
    return t(`common.${currency}`, undefined, lang);
}

/* ─────────────────── 지운 것 (2026-08-07) ───────────────────
 *
 * ★★★ `TAG_LABEL_KO` · `DMG_TYPE_LABEL_KO` · `RARITY_LABEL_KO` · `CURRENCY_LABEL_KO`
 *   **네 개를 지웠다.** 호출부가 전부 위의 함수로 옮겨졌다.
 *
 *   상수 객체로 두면 **모듈이 로드될 때 한 번** 계산되므로 부팅 당시의 언어로
 *   고정되고, 설정에서 언어를 바꿔도 값이 바뀌지 않는다 — 영어로 켠 뒤 한국어로
 *   바꾼 사용자에게 태그 배지만 영어로 남는다. 화면이 다시 렌더돼도 같은 객체를
 *   읽으므로 아무 일도 일어나지 않고, **아무도 실패하지 않는다.**
 *   별칭을 남기지 않는 이유는 이 저장소의 규약 그대로다: 남기면 다음 호출부가
 *   그것을 쓴다.
 *
 * ★ `CURRENCY_LABEL_KO` 는 애초에 **저장소 어디에서도 읽지 않았다.** 출처였던
 *   `icons.json:<key>.label` 이 `{ko, en}` 이 되면서 그 자리에서 깨졌는데도
 *   아무도 실패하지 않은 것이 그 증거다 — "선언했는데 아무도 읽지 않는 것"이라
 *   되살리지 않는다. 재화 이름은 `currencyLabel(id)` 가 낸다.
 */

