/**
 * 적/유닛 태그 — 비트마스크
 *
 * 태그 검사는 매 틱 수천 번 일어난다. 문자열 배열 includes() 는
 * 틱 예산(1.2ms)을 잡아먹으므로 비트 연산으로 처리한다.
 *
 * ★ 태그는 **조합된다.** ARMORED + FLYING 은 "술식 원거리"라는 2조건 답을 요구한다.
 *   이것이 단일 카운터 유닛의 지배를 구조적으로 막는 장치다.
 *
 * @see docs/02-design/11-core-loop.md §3
 */

export const TAG = {
    ARMORED: 1 << 0, // DEF 높음 → 술식으로 우회
    WARDED: 1 << 1, // RES 높음 → 물리로 우회
    FLYING: 1 << 2, // 블로킹 불가, 근접 공격 대상 아님
    SWARM: 1 << 3, // 저HP 다수 → 광역
    CORRUPT: 1 << 4, // 신성 ×1.6
    LIVING: 1 << 5, // 신성 ×0.7
    SHIELDED: 1 << 6, // 첫 N회 피해 무효
    REGEN: 1 << 7, // 초당 회복 → 버스트
    ANTI_AIR: 1 << 8, // 공중을 때릴 수 있다
};

/**
 * ★★ **이 파일의 `throw` 문구는 번역하지 않는다** (2026-08-07, i18n 전수 작업).
 *
 *   여기서 던지는 것은 전부 **데이터 정합성 실패**다 — 없는 스테이지 id · 없는 적 id ·
 *   없는 태그. 플레이어가 정상적으로 게임을 해서 도달할 수 있는 상태가 아니고,
 *   `npm run data:validate` 가 100 스테이지 전수로 먼저 잡는다. 즉 이 문장을 읽는
 *   사람은 **언제나 개발자**이고, 문장에서 실제로 쓸모 있는 부분은 대괄호 안의 id 다.
 *
 *   ⚠ 다만 **완전히 안 보이는 것은 아니다.** `ScreenErrorBoundary` 는 `error.message`
 *   를 그리지 않지만 `recordFault()` 에 넘기고, `FaultOverlay` 는 그 문자열을
 *   **배포 빌드에서도** 한 줄로 보여 준다. 영어권 사용자가 그 줄을 못 읽는 대신
 *   id 는 그대로 보이므로 제보에는 충분하다 — 이 판단이 바뀌면 여기 문구부터 옮긴다.
 *
 *   ★ 플레이어가 **선택**해서 도달하는 실패(난이도 오타 · 미구현 난이도)는 다르다.
 *     그것은 `difficulty.js` 가 `rules.difficulty.*` 로 번역해서 던진다.
 */
/** 사람이 읽는 이름 → 비트 */
export function tagsToMask(list) {
    let m = 0;
    if (!list) return m;
    for (const t of list) {
        const bit = TAG[t];
        if (bit === undefined) throw new Error(`알 수 없는 태그: ${t}`);
        m |= bit;
    }
    return m;
}

/** 비트 → 이름 배열 (디버그·UI용) */
export function maskToTags(mask) {
    const out = [];
    // Object.keys 순회는 결정론을 위해 정렬한다
    for (const name of Object.keys(TAG).sort()) {
        if (mask & TAG[name]) out.push(name);
    }
    return out;
}

export const hasTag = (mask, bit) => (mask & bit) !== 0;
