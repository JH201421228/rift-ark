/**
 * 데미지 숫자 풀
 *
 * ★ 완전 투명성 (혁신 15). 팔라독의 지속적 불만이 "데미지 숫자 없음"이었다.
 *   2026년에는 실격 사유다 — 빌드 크래프팅은 읽을 수 있는 시뮬레이션을 요구한다.
 *
 * 타입별 색 + "약점!" / "저항!" 표기가 상성 실패를 즉시 이해시킨다.
 *
 * ══════════════════════════════════════════════════════════════════
 * ★★★ 이것은 이 게임에서 **가장 자주 일어나는 연출**이다 (2026-08-05)
 * ══════════════════════════════════════════════════════════════════
 * 1-14 후반(웨이브 13~15)에서 게임이 멈춘다는 제보를 6× CPU 스로틀로 재현했다.
 * 200ms 를 넘긴 프레임의 내용물은 언제나 같았다:
 *
 *   프레임 171ms = `runSimulation` 93.8 → `dispatchEvent` 91.2 → **`dmgText.show` 70.2**
 *
 * 한 프레임에 최대 8틱이 몰릴 수 있고 (`tick.js:MAX_TICKS_PER_FRAME`) 틱마다
 * DAMAGE 이벤트가 수십 개다. **호출 하나가 1ms 면 그 프레임은 이미 죽는다.**
 * 그리고 프레임이 늦으면 다음 프레임이 더 많은 틱을 따라잡으므로, 늦음이
 * 스스로를 키운다.
 *
 * 그래서 두 가지를 없앴다:
 *
 *   ① **Phaser `Text` → BitmapText** (`damageFont.js`).
 *      `Text` 는 문자열이 바뀔 때마다 캔버스를 다시 그리고 텍스처를 다시 올린다
 *      (0.85ms). 스타일을 바꾸면 `setStyle` 이 속성표 30개를 훑는다 (2.04ms).
 *      BitmapText 는 글리프 사각형 목록만 다시 만든다 — **0.0098ms.**
 *
 *   ② **트윈 → 직접 보간.** 숫자마다 트윈을 1~2개씩 만들고 있었다. 트윈은
 *      객체이고 트윈 매니저는 매 프레임 그것들을 전부 훑는다 (실측 동시 108개).
 *      `UnitPresenter` 가 틴트 플래시에서 `delayedCall` 을 걷어낸 것과 같은
 *      판단이다 — **어차피 매 프레임 도는 루프가 있으면 상태를 거기서 굴린다.**
 *      대신 씬이 `update(delta)` 를 불러 줘야 한다 (`BattleScene.update`).
 *
 * @see docs/02-design/18-ux-ui.md §2.4
 * @see docs/03-tech/26-performance-budget.md §10-B
 */
import { DAMAGE_TYPE_SHORT } from "@/store/slices/settingsSlice";
// ★ React 가 아니므로 `useT()` 가 아니라 모듈 함수를 직접 쓴다 (i18n 규약).
//   구독은 필요 없다 — 문구는 `show()` 가 **낼 때마다** 만들어진다.
import { LANGS, getLang, pick, t } from "@/i18n";
import { bakeDamageFont, damageFontKey, BAKE_SIZE } from "./damageFont.js";

/**
 * 색 표 — **인덱스가 곧 폰트 키다** (`damageFont.js` 가 이 순서대로 굽는다).
 * ★ 색을 더하려면 여기에 더하고 순서를 바꾸지 않는다. 순서가 규약이다.
 */
const COLORS = [
    "#ffffff", // 0 물리
    "#6ab0ff", // 1 술식
    "#ffd870", // 2 신성
    "#ff9d3d", // 3 약점
    "#8a8a9a", // 4 저항 · 무효
    "#6ee07a", // 5 회복
];
const C_PHYSICAL = 0;
const C_EFFECTIVE = 3;
const C_RESISTED = 4;
const C_HEAL = 5;
/** 데미지 타입 → 색 인덱스 */
const COLOR_OF = { physical: C_PHYSICAL, arcane: 1, holy: 2 };

/**
 * 이 풀이 그릴 수 있어야 하는 문자 전부.
 *
 * ══════════════════════════════════════════════════════════════════
 * ★★★ **빠뜨리면 조용히 안 그려진다** — 그리고 언어가 둘이면 두 배로 그렇다
 * ══════════════════════════════════════════════════════════════════
 * Phaser 의 BitmapText 는 폰트에 없는 문자를 **건너뛴다.** 경고도 예외도 없고,
 * `getTextBounds()` 조차 정상으로 보인다. 목록을 손으로 적던 시절에는 그것이
 * "한글 여섯 자"였으므로 눈으로 지킬 수 있었지만, 영어가 들어오는 순간
 * `WEAK!` · `RESIST` · `IMMUNE` · `Ph`/`Ar`/`Ho` 의 **A–Z 스물몇 자**가 된다.
 * 하나만 빠져도 그 문구가 통째로 · 조용히 사라진다.
 *
 * ★★★ 그래서 **손으로 적지 않는다.** 실제로 `show()` 가 부르는 것과 **같은
 *   조회**(`t` · `pick`)를 `LANGS` 전량에 대해 돌려 글자를 모은다. 문구를 고치거나
 *   언어를 더해도 이 상수가 저절로 따라오고, 두 곳에 적어서 갈라질 자리가 없다.
 *
 * ★★ **두 언어를 모두 굽는 이유.** 폰트는 전투당 한 번 굽고 그 텍스처는 게임
 *   전역이라 다시 굽히지 않는데(`damageFont.js`), 언어는 설정에서 전투 밖에서
 *   바뀐다. 현재 언어만 구우면 **언어를 바꾼 다음 판부터** 숫자가 사라진다.
 *
 * ★ 색약 표기(`물`/`Ph` …)는 데이터에서 온다 (`settings.json:damageTypeShort`).
 */
function collectGlyphs() {
    // 숫자 · 회복의 `+` · 크리티컬/상성의 `!` · 표기와 숫자 사이의 공백
    let acc = "0123456789+! ";
    for (const lang of LANGS) {
        acc += t("system.dmgImmune", undefined, lang);
        acc += t("terms.effective", undefined, lang);
        acc += t("terms.resisted", undefined, lang);
        for (const type of Object.keys(DAMAGE_TYPE_SHORT ?? {})) {
            acc += pick(DAMAGE_TYPE_SHORT, type, lang);
        }
    }
    // ★ 중복을 지운다 — 같은 글자를 두 번 구우면 텍스처만 넓어진다
    return [...new Set(acc)].join("");
}

export const DAMAGE_GLYPHS = collectGlyphs();

/**
 * 문구 캐시 — **언어가 바뀔 때만** 다시 만든다.
 *
 * ★★ `show()` 는 이 게임에서 가장 자주 불리는 함수다 (한 프레임에 수십 번).
 *   거기서 매번 `t()` 를 세 번 부르는 것 자체는 싸지만, 이 파일의 존재 이유가
 *   "호출당 비용을 0 에 가깝게"이므로 **호출당 비교 한 번**으로 줄인다.
 * ★ 구독(`onLangChange`)을 쓰지 않는 이유: 풀은 씬의 수명을 따르는데 언어는
 *   그 바깥에서 바뀐다. 구독을 걸면 해제할 자리를 하나 더 만들게 되고, 여기서는
 *   **읽을 때 확인하는 것**이 같은 답을 내면서 해제할 것이 없다.
 */
let cachedLang = null;
/** `무효` / `Immune` */
let L_ABSORBED = "";
/** `약점!` / `Weak!` */
let L_EFFECTIVE = "";
/** `저항!` / `Resist!` */
let L_RESISTED = "";
/** 데미지 타입 → 이미 뒤에 공백까지 붙은 색약 표기 (`"술 "` / `"Ar "`) */
let L_PREFIX = {};

function syncLabels() {
    const lang = getLang();
    if (lang === cachedLang) return;
    cachedLang = lang;
    L_ABSORBED = t("system.dmgImmune");
    L_EFFECTIVE = `${t("terms.effective")}!`;
    L_RESISTED = `${t("terms.resisted")}!`;
    const map = {};
    for (const type of Object.keys(DAMAGE_TYPE_SHORT ?? {})) {
        const short = pick(DAMAGE_TYPE_SHORT, type);
        map[type] = short ? `${short} ` : "";
    }
    L_PREFIX = map;
}

/** 떠오르는 거리(px) · 지속(ms) — 트윈이 하던 값 그대로 */
const RISE_PX = 44;
const RISE_MS = 620;
/** 약점·크리티컬의 "팝" — 커졌다 돌아오는 왕복 시간(ms) */
const POP_MS = 110;

export class DamageTextPool {
    constructor(scene, size = 30) {
        this.scene = scene;
        this.free = [];
        this.active = [];
        this.density = "all"; // all | big | off
        /**
         * ★ 색약 모드 (설정 > 접근성).
         *   물리(흰)·술식(파랑)·신성(노랑)을 **색으로만** 구분하면 적록/청황 색약에게는
         *   상성 정보가 통째로 사라진다 — 이 게임에서 상성은 부가 정보가 아니라 규칙이다.
         *   켜면 숫자 앞에 한 글자 표기를 붙여 색 없이도 읽히게 한다 (18-ux-ui.md §6).
         */
        this.colorBlind = false;
        /** 목표 풀 크기 — 품질 티어가 바꾼다 (setCapacity) */
        this.size = size;

        bakeDamageFont(scene, DAMAGE_GLYPHS, COLORS);
        for (let i = 0; i < size; i++) this.free.push(this.makeText());
    }

    makeText() {
        return this.scene.add
            .bitmapText(0, 0, damageFontKey(C_PHYSICAL), "", BAKE_SIZE)
            .setOrigin(0.5, 1)
            .setDepth(800)
            .setActive(false)
            .setVisible(false);
    }

    setDensity(d) {
        this.density = d;
    }

    /**
     * 풀 크기를 바꾼다 (품질 티어 · 26-performance-budget.md §4).
     *
     * ★ **줄일 때 살아 있는 숫자를 죽이지 않는다.** 여분(free)만 버린다.
     *   재생 중인 것을 회수하면 숫자가 화면에서 뚝 사라지고, 그것은 저사양
     *   기기에서 더 자주 · 더 눈에 띄게 일어난다 (EffectSystem 이 예산을
     *   풀 크기가 아니라 동시 재생 상한으로 구현한 것과 같은 이유다).
     *   활성분은 각자 수명이 끝나면 free 로 돌아오고, 그때 초과분이 정리된다.
     */
    setCapacity(n) {
        const size = Math.max(1, Math.round(n));
        if (size === this.size) return;
        this.size = size;

        while (this.free.length + this.active.length > size && this.free.length) {
            this.free.pop().destroy();
        }
        while (this.free.length + this.active.length < size) {
            this.free.push(this.makeText());
        }
    }

    setColorBlind(v) {
        this.colorBlind = Boolean(v);
    }

    /**
     * 색을 바꾼다 = 폰트를 바꾼다 (`damageFont.js` 주석 참조).
     *
     * ★ **같은 색이면 손대지 않는다.** `setFont` 은 폰트 데이터를 갈아 끼우고
     *   글자 크기를 다시 재므로, 공짜는 아니다. 풀에서 꺼낸 숫자가 직전과 같은
     *   색인 경우가 실제로 흔하다 (한 판의 대부분은 물리 데미지다).
     */
    applyColor(t, colorIndex) {
        if (t._dtColor === colorIndex) return false;
        t.setFont(damageFontKey(colorIndex));
        t._dtColor = colorIndex;
        return true;
    }

    /**
     * 색약 모드일 때만 붙는 데미지 타입 표기 (`"술 240"` · `"Ar 240"`).
     *
     * ★ 예전에는 `DAMAGE_TYPE_SHORT[dmgType]` 을 그대로 문자열로 썼다. 그 값이
     *   `{ko, en}` 객체가 된 뒤로 그 경로는 `"[object Object] 240"` 을 만든다 —
     *   그리고 그 글자들은 폰트에 없으므로 **화면에서는 그냥 사라진다.**
     */
    typePrefix(dmgType) {
        if (!this.colorBlind) return "";
        return L_PREFIX[dmgType] ?? "";
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {number} amount
     * @param {object} opts { dmgType, effective, resisted, absorbed, crit, heal }
     */
    show(x, y, amount, opts = {}) {
        if (this.density === "off") return;
        // 저사양: 큰 숫자와 특수 표기만 보여준다
        if (this.density === "big" && amount < 10 && !opts.effective && !opts.absorbed) return;

        // ★ 언어가 그대로면 비교 한 번으로 끝난다 (`syncLabels` 주석)
        syncLabels();

        const t = this.acquire();
        if (!t) return;

        let label;
        let color;
        let size = 20;
        let pop = 0;

        if (opts.absorbed) {
            label = L_ABSORBED;
            color = C_RESISTED;
        } else if (opts.heal) {
            label = `+${Math.round(amount)}`;
            color = C_HEAL;
        } else if (opts.resisted) {
            // ★ 상성 실패를 명확히 알린다
            label = `${this.typePrefix(opts.dmgType)}${L_RESISTED} ${Math.round(amount)}`;
            color = C_RESISTED;
            size = 16;
        } else if (opts.effective) {
            label = `${this.typePrefix(opts.dmgType)}${L_EFFECTIVE} ${Math.round(amount)}`;
            color = C_EFFECTIVE;
            size = 26;
            pop = 1.35;
        } else if (opts.crit) {
            // ★ 크리티컬 — 18-ux-ui.md §2.4 "크기 1.4배". 상성 표기와 색을 나눈다:
            //   약점/저항은 **편성을 고치라는 신호**이고 크리티컬은 그날의 운이다.
            label = `${this.typePrefix(opts.dmgType)}${Math.round(amount)}!`;
            color = COLOR_OF[opts.dmgType] ?? C_PHYSICAL;
            size = 28;
            pop = 1.4;
        } else {
            label = `${this.typePrefix(opts.dmgType)}${Math.round(amount)}`;
            color = COLOR_OF[opts.dmgType] ?? C_PHYSICAL;
        }

        this.applyColor(t, color);
        // ★ 같은 값을 다시 넣지 않는다 — BitmapText 는 그때마다 글리프 목록을
        //   다시 만든다 (`_dirty`). 싸지만 공짜는 아니다.
        if (t.text !== label) t.setText(label);
        if (t._dtSize !== size) {
            t.setFontSize(size);
            t._dtSize = size;
        }

        // 살짝 흩뜨려 겹치지 않게 (id 기반 결정론 대신 위치 해시)
        const jitter = ((x * 7 + y * 13) % 24) - 12;

        t.setPosition(x, y).setAlpha(1).setScale(1);
        t._dtT = 0;
        t._dtX = x;
        t._dtY = y;
        t._dtJit = jitter;
        t._dtPop = pop;
    }

    /**
     * 떠오르며 사라지는 연출 — **트윈 없이** 매 프레임 굴린다.
     *
     * ★★ 트윈 하나가 객체 하나이고, 트윈 매니저는 매 프레임 살아 있는 것을
     *   전부 훑는다. 데미지 숫자만으로 동시 60개(숫자 30 × 트윈 2)를 만들고
     *   있었다. 여기서는 활성 숫자 배열 하나를 도는 것이 전부이고 **할당이 없다.**
     *
     * ★ 뒤에서부터 돈다 — `release()` 가 배열에서 빼내므로 앞에서 돌면 건너뛴다.
     *
     * @param {number} dtMs 프레임 델타. 씬의 `update(time, delta)` 가 넘긴다
     */
    update(dtMs) {
        const a = this.active;
        for (let i = a.length - 1; i >= 0; i--) {
            const t = a[i];
            t._dtT += dtMs;
            const p = t._dtT / RISE_MS;
            if (p >= 1) {
                this.release(t);
                continue;
            }
            // Quad.easeOut — 트윈이 쓰던 것과 같은 곡선
            const e = 1 - (1 - p) * (1 - p);
            t.x = t._dtX + t._dtJit * e;
            t.y = t._dtY - RISE_PX * e;
            t.alpha = 1 - e;

            // 약점·크리티컬의 팝 (커졌다 돌아온다).
            // ★ 끝나면 플래그를 내린다 — 수명의 대부분을 배율 1 로 다시 쓰는 것은
            //   보이지도 않는 일이다 (수명 620ms 중 팝은 220ms).
            const pop = t._dtPop;
            if (pop) {
                const q = t._dtT / POP_MS;
                if (q >= 2) {
                    t._dtPop = 0;
                    t.scaleX = 1;
                    t.scaleY = 1;
                } else {
                    const s = 1 + (pop - 1) * (q < 1 ? q : 2 - q);
                    t.scaleX = s;
                    t.scaleY = s;
                }
            }
        }
    }

    /** @returns {object|null} 상한 도달 시 최고령을 회수해 재사용 */
    acquire() {
        let t = this.free.pop();
        if (!t) {
            t = this.active.shift();
            if (!t) return null;
        }
        t.setActive(true).setVisible(true);
        this.active.push(t);
        return t;
    }

    release(t) {
        const i = this.active.indexOf(t);
        if (i >= 0) this.active.splice(i, 1);
        t.setActive(false).setVisible(false);
        // ★ 티어를 낮추는 동안 재생 중이던 초과분은 **여기서** 정리된다.
        //   setCapacity 가 그것을 즉시 죽이지 않고 미뤄 둔 자리다.
        if (this.free.length + this.active.length >= this.size) {
            t.destroy();
            return;
        }
        this.free.push(t);
    }

    destroy() {
        for (const t of this.active) t.destroy();
        for (const t of this.free) t.destroy();
        this.active.length = 0;
        this.free.length = 0;
    }

    get activeCount() {
        return this.active.length;
    }
}
