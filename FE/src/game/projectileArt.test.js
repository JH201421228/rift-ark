/**
 * 발사체 아트 — **쏘는 것들이 정말 서로 다른 그림을 쏘는가** (2026-08-05 재작성)
 *
 * ★★★ 이 파일은 세 번 틀린 것을 지킨다.
 *
 *   ① `asset/projectile/` 의 한 행에는 **종류가 둘** 들어 있다 (열 0–4 / 빈칸 /
 *      열 6–9). 행 전체로 애니메이션을 만들면 다른 탄환이 섞여 깜빡였고,
 *      그게 싫다고 애니메이션을 걷어내니 에셋이 통째로 죽었다.
 *      정답은 `projectileAnim.js:clipFrames` — 연속된 열 구간만 모은다.
 *
 *   ② 이 파일의 예전 판본은 `u.art.projectile` 을 검사했는데 **씬은 최상위
 *      `u.projectile` 을 읽었다.** 두 필드의 내용이 서로 달랐다. 게다가
 *      `stageConfig.normalizeDef` 가 그 최상위 필드를 옮기지 못해 **결국 30종
 *      전원이 기본 탄 하나만 쏘고 있었다.** 검사기는 그 내내 초록불이었다.
 *
 *   ③ 색은 **시트**가 갖는다. 예전엔 주황 원본에 곱셈 틴트로 파랑을 곱했는데
 *      rgb(102,107,39) — 탁한 올리브가 나왔다 ("색이 다 비슷하다"의 정체).
 *
 * ★★ **규칙을 여기에 다시 적지 않는다.** 예전 이 파일에는 `rowFrames()` 라는
 *   복제본이 있었고, 구현이 바뀌자 테스트만 옛 규칙에 남아 **틀린 구현을 통과
 *   시켰다.** 이제 `clipFrames` · `projectileFrame` 을 그대로 부른다.
 *
 * ★ 아틀라스가 아직 없으면(패킹 전 CI) 조용히 건너뛴다 — 검사기가 빌드 순서에
 *   의존하지 않게 한다 (`tools/validate-data.mjs` 의 아틀라스 검사와 같은 규약).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import fx from "./data/fx.json" with { type: "json" };
import unitsData from "./data/units.json" with { type: "json" };
import enemiesData from "./data/enemies.json" with { type: "json" };
import { UNIT_DEFS } from "./logic/stageConfig.js";
// ★ 역할 목록을 여기 다시 적지 않는다. 그 사본이 `validate-data.mjs` 에도 하나 더
//   있었고, 둘 다 **아군만** 보고 있어서 "사거리 190 짜리 적이 즉발로 때린다"를
//   아무도 잡지 못했다 (2026-08-05).
import { usesProjectile } from "./logic/roles.js";
import { clipFrames, projectileFrame, flipPlan, ALL_FACINGS, USABLE_FACINGS } from "./projectileAnim.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ATLAS = join(ROOT, "public", "assets", "atlas", "projectiles.json");

/** 데미지 타입 셋 — `logic/` 과 데이터가 함께 쓰는 값 */
const DMG_TYPES = ["physical", "arcane", "holy"];
/** 정지 이미지로 떨어지지 않으려면 최소 이만큼 */
const MIN_FRAMES = 2;

/**
 * 발사체를 쏘는 것들 — **아군과 적을 한 목록으로 본다** (2026-08-05).
 *
 * ★ 이 파일은 오래도록 `unitsData` 만 돌았다. 그 사이 `enemies.json` 에는 `role` 이
 *   한 종도 없어 62/62 가 MELEE 로 정규화됐고, 사거리 120–190 짜리 적 11종이
 *   즉발로 때렸다 — 검사가 **볼 생각을 안 한 곳**이라 끝까지 초록불이었다.
 */
const SHOOTERS = [
    ...unitsData.units.map((u) => ({ at: `units/${u.id}`, ...u })),
    ...enemiesData.enemies.map((e) => ({ at: `enemies/${e.id}`, ...e })),
];

/** 아틀라스 프레임 이름 전체. 없으면 null. */
function loadFrames() {
    if (!existsSync(ATLAS)) return null;
    const atlas = JSON.parse(readFileSync(ATLAS, "utf8"));
    return atlas.frames
        ? Object.keys(atlas.frames)
        : atlas.textures.flatMap((t) => t.frames.map((f) => f.filename));
}

/** 게임이 실제로 쏘는 모든 발사체 선언 — [누구, 모양, 데미지타입] */
function declared() {
    const out = [["fx.json:projectile", fx.projectile.shape, "physical"]];
    for (const s of SHOOTERS) {
        if (s.art?.projectile) out.push([s.at, s.art.projectile.shape, s.dmgType]);
    }
    return out;
}

describe("발사체 선언", () => {
    it("★★ 시트 배정이 데미지 타입 셋을 전부 덮는다 — 빠진 타입은 색이 없다", () => {
        for (const t of DMG_TYPES) {
            expect(fx.projectileSheet?.[t], `projectileSheet['${t}'] 없음`).toBeTruthy();
        }
    });

    it("★★ 타입마다 시트가 다르다 — 같은 시트를 쓰면 색으로 구분되지 않는다", () => {
        const used = DMG_TYPES.map((t) => fx.projectileSheet[t]);
        expect(new Set(used).size).toBe(DMG_TYPES.length);
    });

    it("★★★ 쏘는 역할은 모양을 갖고, 쏘지 않는 역할은 갖지 않는다 (죽은 데이터 금지)", () => {
        for (const s of SHOOTERS) {
            const has = Boolean(s.art?.projectile?.shape);
            expect(has, `${s.at} (${s.role ?? "MELEE"})`).toBe(usesProjectile(s.role));
        }
    });

    it("★★★ 옛 최상위 `projectile` 필드가 남아 있지 않다 — 두 출처가 서로 다른 그림을 가리켰다", () => {
        expect(SHOOTERS.filter((s) => s.projectile).map((s) => s.at)).toEqual([]);
    });

    it("★★★ 씬이 읽는 경로로 실제로 도달한다 (`stageConfig` 가 옮기는가)", () => {
        // ★ 이것이 빠져 있었다. 데이터에는 있고 정규화가 놓쳐서 전원이 기본 탄을 쐈다.
        for (const u of unitsData.units) {
            if (!usesProjectile(u.role)) continue;
            expect(UNIT_DEFS[u.id].projectile?.shape, `units/${u.id}`).toBe(u.art.projectile.shape);
        }
        // ★ 적은 `UNIT_DEFS` 같은 export 가 없다 — 정규화 도달은 `data:validate` 가
        //   `buildStageConfig` 로 확인한다 (같은 명제를 두 곳에서 재지 않는다).
    });

    it("모양은 `<행>_<열>` 규칙을 지킨다 — 규칙이 바뀌면 애니메이션이 조용히 죽는다", () => {
        for (const [who, shape] of declared()) {
            expect(String(shape), `${who}: 모양 이름 규칙 위반`).toMatch(/^\d+_\d+$/);
        }
    });
});

describe("발사체 아트 ↔ 아틀라스", () => {
    it("★★ 선언한 모양마다 애니메이션 프레임이 둘 이상 잡힌다", () => {
        const names = loadFrames();
        if (!names) return; // 아틀라스 미생성 — 검사 생략
        for (const [who, shape, dmgType] of declared()) {
            const frame = projectileFrame(fx.projectileSheet, dmgType, shape);
            const clip = clipFrames(names, frame);
            expect(clip, `${who}: '${frame}' 이 아틀라스에 없다`).toContain(frame);
            expect(
                clip.length,
                `${who}: '${frame}' 의 클립이 ${clip.length}장뿐이다 — ` +
                    `애니메이션이 만들어지지 않고 정지 이미지로 떨어진다`
            ).toBeGreaterThanOrEqual(MIN_FRAMES);
        }
    });

    it("★★ 모양은 **모든 시트**에서 성립한다 — 유닛의 dmgType 이 바뀌어도 그림이 사라지지 않는다", () => {
        const names = loadFrames();
        if (!names) return;
        for (const [who, shape] of declared()) {
            for (const t of DMG_TYPES) {
                const frame = projectileFrame(fx.projectileSheet, t, shape);
                expect(clipFrames(names, frame), `${who}: '${t}' 색이 없다`).toContain(frame);
            }
        }
    });

    /**
     * ★★★ **모양은 클립의 첫 열이어야 한다.**
     *
     *   이것이 없으면 `1_1` `1_2` `1_3` `1_4` 네 유닛이 **같은 클립 1_0~1_4** 를
     *   쏘면서 서로 다른 탄인 척한다. 실제로 그 상태였고, `$note` 에는
     *   "주술탄" "부여의 빛" "물살" "저주탄" 이라고 적혀 있었다.
     */
    it("★★★ 모양이 정규다 — 클립 한가운데를 가리키지 않는다", () => {
        const names = loadFrames();
        if (!names) return;
        for (const [who, shape, dmgType] of declared()) {
            const frame = projectileFrame(fx.projectileSheet, dmgType, shape);
            const clip = clipFrames(names, frame);
            expect(clip[0], `${who}: 모양 '${shape}' 은 클립 한가운데다`).toBe(frame);
        }
    });

    it("★★★ 서로 다른 모양은 서로 다른 클립을 쓴다 — 같은 그림이면 차별화가 아니다", () => {
        const names = loadFrames();
        if (!names) return;
        const byClip = new Map();
        for (const [, shape, dmgType] of declared()) {
            const clip = clipFrames(names, projectileFrame(fx.projectileSheet, dmgType, shape));
            const prev = byClip.get(clip[0]);
            expect(prev ?? shape, `클립 ${clip[0]} 을 '${shape}' 와 '${prev}' 가 함께 쓴다`).toBe(shape);
            byClip.set(clip[0], shape);
        }
    });

    it("★ 클립이 빈 열을 넘지 않는다 (경계가 곧 종류의 구분)", () => {
        const names = loadFrames();
        if (!names) return;
        const has = new Set(names);
        for (const [who, shape, dmgType] of declared()) {
            const frame = projectileFrame(fx.projectileSheet, dmgType, shape);
            const clip = clipFrames(names, frame);
            const [group, cell] = frame.split("/");
            const row = cell.split("_")[0];
            const cols = clip.map((f) => Number(f.split("_").pop()));

            // ① 열이 연속이다
            for (let i = 1; i < cols.length; i++) {
                expect(cols[i], `${who}: 클립에 구멍이 있다 (${clip.join(", ")})`).toBe(cols[i - 1] + 1);
            }
            // ② 양 끝 바로 바깥은 **아틀라스에 없다** — 있으면 구간을 덜 먹은 것이다
            for (const edge of [cols[0] - 1, cols[cols.length - 1] + 1]) {
                expect(
                    has.has(`${group}/${row}_${edge}`),
                    `${who}: 열 ${edge} 가 붙어 있는데 클립이 거기서 끊겼다`
                ).toBe(false);
            }
        }
    });

    /**
     * ★★★ **한 그림을 너무 많이 공유하지 않는다.**
     *
     *   위의 "서로 다른 모양은 서로 다른 클립" 만으로는 **모두가 같은 모양을 적는**
     *   퇴화를 못 잡는다 — 실제로 30종 전원이 한 탄만 쏘고 있었다. 공유 자체는
     *   정상이지만(엘프 궁수 둘이 같은 화살촉을 쏘는 것은 맞다) 상한이 있어야
     *   "원거리 조합의 차이가 화면에 보인다" 가 유지된다.
     */
    it("★★★ 한 그림을 넷 넘게 쓰지 않는다 — 전원이 같은 탄을 쏘던 상태로 되돌아가면 잡는다", () => {
        const names = loadFrames();
        if (!names) return;
        const MAX_PER_PICTURE = 4;
        const users = new Map();
        for (const [who, shape, dmgType] of declared()) {
            const frame = projectileFrame(fx.projectileSheet, dmgType, shape);
            users.set(frame, [...(users.get(frame) ?? []), who]);
        }
        for (const [frame, who] of users) {
            expect(who.length, `${frame}: ${who.join(", ")}`).toBeLessThanOrEqual(MAX_PER_PICTURE);
        }
    });
});

/**
 * ★★★ **그림이 향한 쪽** (2026-08-05)
 *
 *   사용자 제보: "반대 방향으로 쏘면 투사체 방향도 바뀌어야 하는데 방향은 그대로다."
 *   원인은 뒤집기 코드가 아니라 **고른 그림**이었다 — 담겨 있던 16종 중 좌우 방향이
 *   있는 것이 화살촉 하나뿐이라, 뒤집어도 화면에 아무 변화가 없었다.
 */
describe("발사체 방향", () => {
    it("★★★ 아틀라스의 모든 모양이 방향으로 분류돼 있다 — 빠지면 그 모양은 영영 안 뒤집힌다", () => {
        const names = loadFrames();
        if (!names) return;
        const shapes = new Set();
        for (const n of names) {
            const clip = clipFrames(names, n);
            if (clip[0]) shapes.add(clip[0].split("/")[1]);
        }
        for (const s of shapes) {
            expect(ALL_FACINGS, `모양 '${s}' 미분류`).toContain(fx.shapeFacing?.[s]);
        }
    });

    it("★★ 분류표에 아틀라스에 없는 모양이 없다", () => {
        const names = loadFrames();
        if (!names) return;
        const has = new Set(names.map((n) => n.split("/")[1]));
        for (const s of Object.keys(fx.shapeFacing)) {
            expect(has.has(s), `shapeFacing['${s}'] 이 아틀라스에 없다`).toBe(true);
        }
    });

    it("★★★ 방향이 있는 그림이 실제로 쓰이고 있다 — 전부 대칭이면 뒤집기가 눈에 안 보인다", () => {
        const flippable = declared().filter(([, s]) => {
            const f = fx.shapeFacing[s];
            return f === "right" || f === "left";
        });
        // 예전에는 이 값이 사실상 0 이었다 (열 0-9 가 거의 전부 방사 대칭)
        expect(flippable.length).toBeGreaterThanOrEqual(6);
    });

    it("★★★ 가로로 날 수 없는 그림(up · diagonal)을 아무도 쓰지 않는다", () => {
        for (const [who, shape] of declared()) {
            expect(USABLE_FACINGS, `${who}: 모양 '${shape}'`).toContain(fx.shapeFacing[shape]);
        }
    });

    it("★★ 대칭 그림은 어느 쪽으로 날아도 뒤집지 않는다 (칸 중심 미러라 옆으로 튄다)", () => {
        expect(flipPlan("none")).toEqual({ left: false, right: false });
        expect(flipPlan(undefined)).toEqual({ left: false, right: false });
    });

    it("★★ 오른쪽을 본 그림은 왼쪽으로 날 때만, 왼쪽을 본 그림은 오른쪽으로 날 때만 뒤집는다", () => {
        expect(flipPlan("right")).toEqual({ left: true, right: false });
        expect(flipPlan("left")).toEqual({ left: false, right: true });
    });

    /**
     * ★★★ **회전이 아니라 뒤집기인 근거를 코드로 고정한다.**
     *   발사체에 `vy` 가 생기면 진행 각도가 0°/180° 밖으로 나가고, 그 순간 flipX 는
     *   더 이상 정답이 아니다. 시뮬 쪽이 바뀌면 여기서 걸려야 한다.
     */
    it("★★★ 발사체는 가로로만 난다 — `vy` 가 생기면 뒤집기 전략을 다시 정해야 한다", () => {
        const root = join(dirname(fileURLToPath(import.meta.url)), "logic");
        const state = readFileSync(join(root, "state.js"), "utf8");
        const step = readFileSync(join(root, "projectiles.js"), "utf8");
        expect(state, "state.js 의 발사체에 vy 가 생겼다").not.toMatch(/\bvy\s*:/);
        expect(step, "projectiles.js 가 y 를 움직인다").not.toMatch(/p\.y\s*\+=/);
    });
});

describe("clipFrames — 순수 규칙", () => {
    const NAMES = [
        "g/0_0",
        "g/0_1",
        "g/0_3", // 2 가 비어 있다 → 경계
        "g/0_4",
        "g/1_0",
        "g/10_0", // 행 1 의 접두사에 걸리면 안 된다
    ];

    it("연속 구간만 모은다", () => {
        expect(clipFrames(NAMES, "g/0_0")).toEqual(["g/0_0", "g/0_1"]);
        expect(clipFrames(NAMES, "g/0_4")).toEqual(["g/0_3", "g/0_4"]);
    });

    it("★ 행 10 이 행 1 에 섞이지 않는다 (접두사 함정)", () => {
        expect(clipFrames(NAMES, "g/1_0")).toEqual(["g/1_0"]);
    });

    it("없는 프레임 · 규칙에 안 맞는 이름은 빈 배열", () => {
        expect(clipFrames(NAMES, "g/0_9")).toEqual([]);
        expect(clipFrames(NAMES, "쓰레기")).toEqual([]);
        expect(clipFrames(NAMES, undefined)).toEqual([]);
    });
});

describe("projectileFrame — 색과 모양의 결합", () => {
    const SHEETS = { physical: "silver", arcane: "cyan", holy: "gold" };

    it("시트와 모양을 붙인다", () => {
        expect(projectileFrame(SHEETS, "arcane", "4_0")).toBe("cyan/4_0");
    });

    it("배정 없는 데미지 타입 · 규칙에 안 맞는 모양은 null", () => {
        expect(projectileFrame(SHEETS, "chaos", "4_0")).toBeNull();
        expect(projectileFrame(SHEETS, "holy", "가시")).toBeNull();
        expect(projectileFrame(SHEETS, "holy", undefined)).toBeNull();
        expect(projectileFrame(undefined, "holy", "4_0")).toBeNull();
    });
});
