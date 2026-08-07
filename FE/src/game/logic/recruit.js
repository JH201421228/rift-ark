/**
 * 동료 영입 — **골드로 동료를 데려온다** (2026-08-04)
 *
 * ★★ 이 모듈이 메우는 구멍: 가챠를 걷어내자 **동료 30종 중 10종만 획득 경로가
 *   남았다.** 확정 지급(`unlocks.js`)이 8+2 종이고 나머지 20종은 데이터에는
 *   있는데 어떤 방법으로도 손에 넣을 수 없었다.
 *
 * ★★ **확률이 없다.** 값을 치르면 그 동료가 온다 — 그것이 가챠를 지운 이유이고,
 *   "이 게임에 확률형이 하나도 없다"(절대 규칙 6)를 지키는 방식이다.
 *
 * ★ **확정 지급 대상은 영입 목록에서 빠진다.** 진행하면 무료로 오는 동료를
 *   돈 받고 미리 파는 것은 진행 보상이라는 약속을 깨는 일이다.
 *   목록은 여기 적지 않고 `unlocks.js` 에서 파생한다 — 사본을 두면 확정 지급을
 *   바꾼 날 "돈 주고 샀는데 다음 스테이지에서 또 준다"가 생긴다.
 *
 * ★ 순수 함수다. `Date.now()` · 난수 · DOM 이 없다 (절대 규칙 1).
 *
 * @see docs/02-design/13-progression-meta.md
 * @see docs/04-plan/34-scope-cut.md
 */
import RECRUIT from "../data/recruit.json" with { type: "json" };
import unitsData from "../data/units.json" with { type: "json" };
import { STAGE_GRANTS, STARTING_UNITS } from "./unlocks.js";

/** 등급별 비용·해금. **수치의 단일 출처는 `recruit.json` 이다.** */
export const BY_RARITY = RECRUIT.byRarity;

/**
 * 진행만으로 반드시 손에 들어오는 동료 — 영입 목록에서 제외된다.
 * ★ `unlocks.js` 에서 파생한다 (목록 사본 금지).
 */
const GUARANTEED = new Set([...STARTING_UNITS, ...STAGE_GRANTS.flatMap((g) => g.units)]);

/**
 * 영입 가능한 동료 정의 — **파일 순서를 유지한다.**
 * ★ 정렬을 넣지 않는다. 화면이 등급·역할로 다시 묶으므로 여기서 정렬하면
 *   "왜 이 순서지"의 출처가 둘이 된다.
 */
export const RECRUITABLE = Object.freeze(
    unitsData.units.filter((u) => !GUARANTEED.has(u.id)).map((u) => u.id)
);

const DEF = Object.fromEntries(unitsData.units.map((u) => [u.id, u]));

/** 이 동료가 영입 대상인가 (확정 지급분은 아니다) */
export function isRecruitable(unitId) {
    return RECRUITABLE.includes(unitId);
}

/**
 * 영입 비용 (골드). 대상이 아니거나 등급이 표에 없으면 null.
 * ★ null 을 0 으로 바꾸지 않는다 — 0 은 "공짜"이고 null 은 "살 수 없다"다.
 */
export function recruitCost(unitId) {
    if (!isRecruitable(unitId)) return null;
    return BY_RARITY[DEF[unitId]?.rarity]?.gold ?? null;
}

/** 이 동료가 영입 목록에 나타나는 최소 `highestStage`. 대상이 아니면 null. */
export function recruitUnlockStage(unitId) {
    if (!isRecruitable(unitId)) return null;
    return BY_RARITY[DEF[unitId]?.rarity]?.unlockStage ?? null;
}

/**
 * 진행도 `highestStage` 에서 **목록에 보이는** 영입 대상.
 * ★ 잠긴 것도 화면에는 그린다 — 무엇을 향해 가는지가 보여야 한다.
 *   이 함수는 "지금 살 수 있는 것"만 돌려주고, 화면이 잠긴 칸을 따로 그린다.
 */
export function recruitableAt(highestStage) {
    const n = Math.max(0, Math.floor(Number(highestStage)) || 0);
    return RECRUITABLE.filter((id) => (recruitUnlockStage(id) ?? Infinity) <= n);
}

/**
 * 영입 가능 여부. **판정은 여기 하나뿐이다** — 화면과 스토어가 같은 함수를 부른다.
 *
 * ★★ 화면에만 자물쇠를 그리면 공유 코드·딥링크·다음 호출부가 그대로 통과한다
 *   (장비 티어에서 실제로 겪었다 — `progression.isGearTierAvailable` 의 교훈).
 *
 * @returns {{ok:boolean, reason?:string, cost?:number, at?:number}}
 */
export function canRecruit({ unitId, owned = {}, gold = 0, highestStage = 0 }) {
    if (!DEF[unitId]) return { ok: false, reason: "unknown" };
    if (owned[unitId]) return { ok: false, reason: "owned" };
    if (!isRecruitable(unitId)) return { ok: false, reason: "granted" };

    const cost = recruitCost(unitId);
    const at = recruitUnlockStage(unitId);
    if (cost === null || at === null) return { ok: false, reason: "unknown" };

    const n = Math.max(0, Math.floor(Number(highestStage)) || 0);
    if (n < at) return { ok: false, reason: "locked", cost, at };
    if ((Number(gold) || 0) < cost) return { ok: false, reason: "gold", cost, at };
    return { ok: true, cost, at };
}
