/**
 * 발사체 아트 — **시트 = 색 · 열구간 = 모양**
 *
 * ★★★ 축이 둘이다 (2026-08-05).
 *
 *   `asset/projectile/All_Fire_Bullet_Pixel_16x16_00..07.png` 여덟 장은 빈칸
 *   패턴도 프레임 크기도 **완전히 같은 색 변형**이다 (7,000칸 전수 대조, 불일치 0).
 *   그래서 **색은 시트**가, **모양은 한 행 안의 열 구간**이 정한다.
 *
 *     실제 프레임 이름 = `projectileSheet[dmgType]` + "/" + `shape`
 *
 *   유닛 데이터는 **모양만** 적는다. 색을 유닛이 적게 두면 신성 유닛이 술식
 *   시트를 가리키는 실수가 조용히 들어오고, 상성이 색으로 읽힌다는 규약이 깨진다.
 *
 * ★★ 런타임 틴트로는 색을 못 바꾼다. 원본이 채도 높은 주황(#f59b27)이라
 *   곱셈 틴트에 술식 파랑(0x6ab0ff)을 곱하면 rgb(102,107,39) — 파랑이 아니라
 *   **탁한 올리브**다. 예전 `BattleScene` 이 정확히 그 짓을 하고 있었고,
 *   그래서 "색이 다 비슷하다"였다.
 *
 * ── 아래는 **모양** 쪽 규칙 ─────────────────────────────────
 *
 * 발사체 애니메이션 — **한 행 안에 종류가 둘이다**
 *
 * ★★★ 이 파일이 존재하는 이유 (2026-08-04, 세 번째 시도에서 확정).
 *
 *   `asset/projectile/All_Fire_Bullet_Pixel_16x16_*.png` 는 16×16 격자인데,
 *   **한 행이 한 종류가 아니다.** 실제 픽셀을 열어 보면 이렇게 생겼다:
 *
 *       열  0  1  2  3  4     5     6  7  8  9
 *          └── 종류 A ──┘   (빈칸)  └─ 종류 B ─┘
 *
 *   · 열 0–4 : 종류 A 의 애니메이션 5프레임
 *   · 열 5   : 완전히 비어 있다 (패커가 `skipEmpty` 로 버린다)
 *   · 열 6–9 : **다른 종류** B 의 애니메이션 4프레임
 *
 *   프레임 크기가 이것을 증명한다 — 8행 × 2시트 **전부**에서 열 0–4 는 자기들끼리
 *   같은 크기이고 열 6–9 는 **다른** 크기다 (예: 행 1 은 16×16 대 16×10,
 *   행 4 는 10×9 대 13×15). 같은 물체의 애니메이션이라면 크기가 갈릴 수 없다.
 *
 * ★★ 그래서 지금까지 두 번 다 틀렸다:
 *
 *   ① 처음엔 **행 전체**(0,1,2,3,4,6,7,8,9)로 애니메이션을 만들었다. 화염 구체와
 *      가로 빔이 번갈아 나와 **다른 스프라이트가 섞여 깜빡였다**
 *      (사용자 제보 — "투사체가 애니메이션이 서로 섞여 있어").
 *
 *   ② 그래서 애니메이션을 통째로 걷어내고 정지 프레임으로 되돌렸다. 섞임은
 *      멈췄지만 **에셋의 애니메이션이 전부 죽었다** — 원인은 "애니메이션"이
 *      아니라 "행 전체를 한 벌로 본 것"이었는데 엉뚱한 쪽을 껐다.
 *
 * ★ 정답은 **연속된 열 구간**이다. 시트의 빈 열이 곧 종류의 경계이므로,
 *   선언한 열이 속한 연속 구간만 모으면 종류를 넘지 않는다. 경계를 상수로
 *   박지 않는다 — 시트가 바뀌면 빈칸의 위치도 바뀐다.
 *
 * @see docs/02-design/19-art-audio-direction.md §2
 */

/** 프레임 이름 규칙: `<그룹>/<행>_<열>` */
const NAME_RE = /^(.+)\/(\d+)_(\d+)$/;

/** 모양 이름 규칙: `<행>_<열>` */
const SHAPE_RE = /^\d+_\d+$/;

/**
 * 모양 + 데미지 타입 → 아틀라스 프레임 이름.
 *
 * ★ 여기서만 둘을 붙인다. 씬은 **create() 에서 한 번** 부르고 결과를 캐시한다 —
 *   `update()` 에서 부르면 발사체 수만큼 문자열이 생긴다 (규칙 7).
 *
 * @param {Object<string,string>} sheets `fx.json:projectileSheet`
 * @param {string} dmgType  physical | arcane | holy
 * @param {string} shape    `<행>_<열>` (그 종류가 **시작하는** 열)
 * @returns {string|null} 배정이 없거나 모양이 규칙에 안 맞으면 null
 */
export function projectileFrame(sheets, dmgType, shape) {
    const sheet = sheets?.[dmgType];
    if (!sheet || !SHAPE_RE.test(String(shape))) return null;
    return `${sheet}/${shape}`;
}

/**
 * 그림이 향한 쪽 → **가로 발사체로 쓸 수 있는가**.
 *
 * ★ `up` · `diagonal` 은 담겨 있지만 쓸 수 없다. 이 게임의 발사체는 가로로만 나는데
 *   (아래 주석 참조) 그 그림들은 어느 쪽으로 뒤집어도 진행 방향과 어긋난다.
 */
export const USABLE_FACINGS = ["right", "left", "none"];
/** 분류표에 쓸 수 있는 전체 값 — `up` · `diagonal` 은 "왜 안 쓰는지"의 기록이다 */
export const ALL_FACINGS = [...USABLE_FACINGS, "up", "diagonal"];

/**
 * 진행 방향에 맞춰 **뒤집을지**를 미리 계산한다.
 *
 * ★★★ **회전이 아니라 뒤집기인 이유.**
 *   `logic/state.js` 의 발사체에는 `vy` 라는 필드가 아예 없고 `logic/projectiles.js`
 *   는 `p.x += p.vx * dt` 만 한다. 레인 y 는 고정이다. 즉 **진행 각도는 0° 아니면
 *   180° 뿐**이고, 가로로 그려진 그림에서 그 둘은 `flipX` 로 정확히 표현된다
 *   (리샘플링 0 · 트랜스폼 0). 회전이 이득인 경우는 45° 대각 그림뿐인데 45° 는
 *   16px 픽셀아트에 최악의 각도라 윤곽이 뭉갠다 — 그래서 그 그림은 쓰지 않는다.
 *
 * ★★ **`none` 은 절대 뒤집지 않는다.** 이 시트의 그림 상당수가 16×16 칸 안에서
 *   x 로 0.5~1.5px 치우쳐 있고 Phaser 의 flipX 는 **칸 중심** 기준이라, 대칭인
 *   그림도 뒤집으면 화면에서 1~3px 옆으로 튄다. 얻는 것 없이 튐만 생긴다.
 *
 * @param {string} facing `fx.json:shapeFacing` 값
 * @returns {{left: boolean, right: boolean}} 왼쪽으로 날 때 / 오른쪽으로 날 때 뒤집는가
 */
export function flipPlan(facing) {
    if (facing === "right") return { left: true, right: false };
    if (facing === "left") return { left: false, right: true };
    return { left: false, right: false };
}

/**
 * 선언한 프레임이 속한 **한 종류**의 프레임들을 열 순서로 돌려준다.
 *
 * ★ 같은 행이라도 **연속되지 않은 열은 다른 종류**다. 빈 열(패킹에서 빠진 열)이
 *   경계 역할을 한다.
 *
 * @param {string[]} names 아틀라스의 전체 프레임 이름
 * @param {string} frame  `fx.json` / `units.json` 이 선언한 프레임
 * @returns {string[]} 애니메이션 프레임 (선언 프레임이 없으면 빈 배열)
 */
export function clipFrames(names, frame) {
    const m = NAME_RE.exec(String(frame));
    if (!m) return [];
    const [, group, row, col] = m;
    const prefix = `${group}/${row}_`;

    // ★ `startsWith(prefix)` 만으로 충분하다 — 행 1 의 접두사 `g/1_` 는
    //   행 10 (`g/10_0`) 에 걸리지 않는다. 다음 글자가 `_` 여야 하기 때문이다.
    const present = new Set();
    for (const n of names) {
        if (!n.startsWith(prefix)) continue;
        const c = Number(n.slice(prefix.length));
        if (Number.isInteger(c)) present.add(c);
    }

    const target = Number(col);
    if (!present.has(target)) return [];

    // 선언한 열을 품은 연속 구간
    let lo = target;
    let hi = target;
    while (present.has(lo - 1)) lo--;
    while (present.has(hi + 1)) hi++;

    const out = [];
    for (let c = lo; c <= hi; c++) out.push(`${prefix}${c}`);
    return out;
}
