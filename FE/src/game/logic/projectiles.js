/**
 * 발사체
 *
 * 관통(pierce)이 남아 있으면 명중 후에도 계속 날아간다.
 * 오라 안 RANGED 는 기본 관통 1, 각인으로 더 늘어난다.
 *
 * ★★★ **관통은 "적을 몇 체 더 맞히는가"이지 "몇 번 더 때리는가"가 아니다.**
 *   2026-08-05 이전 구현은 이 둘을 구분하지 못했고, 그래서 관통 화살이
 *   선언한 일을 하지 않았다. 실측(같은 시드 · 같은 편성 · 적 5체):
 *
 *     스택   맞힌 고유 적 수 (적 간격 40px)
 *     ────────────────────────────────────
 *      0      1
 *      1      1   ← +1 이 아니라 +0
 *      2      1   (같은 적을 2번)
 *      3      1   (같은 적을 3번)
 *
 *   원인은 둘이었다.
 *   ① **오프바이원.** 명중 시 `pierce--` 를 먼저 하고 루프가 끝난 뒤
 *      `pierce <= 0` 이면 소멸시켰다. 관통 1 짜리가 적 하나를 맞히면
 *      그 자리에서 0 이 되어 **두 번째 적을 만나기도 전에 사라졌다.**
 *      같은 틱의 ±24px 창 안에 적이 둘 이상 겹쳐 있을 때만 우연히 작동했다.
 *   ② **재명중.** 살아남은 발사체가 다음 틱에도 같은 적의 명중 창 안에 있어서
 *      그 적을 다시 때렸다 (`state.js:hitIds` 주석 참조).
 *
 *   지금은 `hitIds` 로 같은 적을 두 번 때리지 않고, 관통이 **남아 있는 동안에는
 *   소멸하지 않는다.** 결과는 선언 그대로 "맞히는 고유 적 수 = 1 + pierce" 다.
 *
 * ★★ **피해는 발사체 자신의 것이다.** 예전에는 발사자가 살아 있으면 `src` 를
 *   그대로 넘겨서 `p.damage` 를 **한 번도 읽지 않았다** — 바로 위 줄의 주석은
 *   "발사체는 자체 스탯으로 때린다"라고 써 있는데 코드가 그러지 않았다.
 *   그래서 `mulProjectileDamage` 를 쓰는 각인(육중한 사격 +35%)이 **발사자가
 *   비행 중에 죽은 경우에만** 효과를 냈다 — 사실상 무효였다 (실측: 83 → 83).
 */
import { releaseProjectile } from "./state.js";
import { TICK_MS } from "./tick.js";
import { applyDamage } from "./engage.js";
import { canTarget } from "./combat.js";
import { emit, EV } from "./events.js";
import { runHooks, HOOK } from "./sigils.js";
// ★ 지휘관 HP 를 깎는 자리는 하나뿐이다 (`commanderHit.js` 주석 참조).
import { damageCommander, commanderUp, COMMANDER_ID } from "./commanderHit.js";

/** 명중 판정 폭 (디자인 해상도 1280×720 기준) */
const HIT_WIDTH = 24;

/** 훅 컨텍스트 재사용 — 틱당 힙 할당 0 (절대규칙 7) */
const hookCtx = { entity: null, target: null, blocker: null, projectile: null };

/**
 * 발사체 자신의 스탯으로 때리는 합성 공격자.
 * ★ 매 명중마다 객체를 만들지 않는다 (절대규칙 7) — 모듈 스코프에서 재사용한다.
 */
/**
 * ★ `role` · `inAura` 도 싣는다 (2026-08-05). 역할별 오라 효과(공성 밀어내기)는
 *   `applyDamage` 에서 걸리는데, 공성·원거리·시전은 **투사체로** 때리므로 여기서
 *   발사자의 역할과 오라 상태를 넘기지 않으면 그 효과가 통째로 사라진다.
 *   발사자가 비행 중에 죽었으면 `role` 을 비워 효과를 끈다 — 죽은 유닛의
 *   오라 판정을 추정하지 않는다.
 */
const shooter = { atk: 0, dmgType: "physical", isAlly: false, tags: 0, role: "", inAura: false };

export function stepProjectiles(s) {
    const dt = TICK_MS / 1000;
    const cfgCombat = s.cfg.combat;
    const list = s.projectiles;

    for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.x += p.vx * dt;

        // 화면 밖
        if (p.x < s.cfg.arkX - 32 || p.x > s.cfg.riftX + 32) {
            list.splice(i, 1);
            releaseProjectile(s, p);
            continue;
        }

        const targets = p.isAlly ? s.lanes[p.lane].enemies : s.lanes[p.lane].allies;
        const src = findById(s, p.sourceId);

        /** 관통을 다 쓰고 명중했는가 — 이때만 소멸한다 */
        let spent = false;

        for (let j = 0; j < targets.length; j++) {
            const t = targets[j];
            if (Math.abs(t.x - p.x) > HIT_WIDTH) continue;
            if (alreadyHit(p, t.id)) continue; // 같은 적은 한 발에 한 번만
            // 조준 자격은 **쏜 유닛**의 것이다 (대공 등). 발사자가 죽었으면 이미 통과한 조준을 존중한다.
            if (src && !canTarget(src, t)) continue;

            // 발사체는 자체 스탯으로 때린다 (발사자가 죽어도 유효 · 각인 보정이 여기 담긴다)
            shooter.atk = p.damage;
            shooter.dmgType = p.dmgType;
            shooter.isAlly = p.isAlly;
            shooter.tags = src ? src.tags : 0;
            shooter.role = src ? src.role : "";
            shooter.inAura = src ? src.inAura : false;
            applyDamage(s, shooter, t, p.lane, cfgCombat, s.cfg);

            p.hitIds.push(t.id);
            emit(s.events, EV.PROJECTILE_HIT, p.id, t.id, p.lane);

            /**
             * 각인: 처형·넉백·상태이상.
             * ★ 근접만 `onAttack` 을 받고 원거리는 못 받던 것이 오래된 구멍이었다 —
             *   `engage.js:tryAttack` 이 투사체 역할이면 훅 앞에서 return 하기 때문에
             *   "처형"이 **활·술사·공성에는 존재하지 않았다** (실측: 근접 hp 0,
             *   원거리 hp 999,999,917). 설명 문구에는 역할 제한이 없다.
             */
            if (p.isAlly && (s.hooks.onAttack.length || s.hooks.projectileHit.length)) {
                hookCtx.entity = src;
                hookCtx.target = t;
                hookCtx.projectile = p;
                runHooks(s, HOOK.ON_ATTACK, hookCtx);
                runHooks(s, HOOK.PROJECTILE_HIT, hookCtx);
                hookCtx.entity = null;
                hookCtx.target = null;
                hookCtx.projectile = null;
            }

            if (p.pierce > 0) {
                p.pierce--;
                continue; // 관통: 계속 날아간다 (이 틱에 없으면 다음 틱에 만난다)
            }
            spent = true;
            break;
        }

        /**
         * ★★★ **적의 탄은 지휘관에게도 맞는다** (2026-08-05).
         *
         *   지휘관은 `lanes[].allies` 에 없다 — 그 배열은 x 오름차순 불변식 위에
         *   병합 스윕과 블로킹이 서 있고 지휘관은 레인을 자유롭게 옮기기 때문이다.
         *   그래서 위 루프는 지휘관을 영영 만나지 못한다. 여기서 따로 본다.
         *
         * ★ **동료 다음이다.** 위 루프에서 아무도 못 맞혔을 때(`!spent`)만 검사한다.
         *   지휘관이 동료에게 갈 탄을 가로채면 "앞에 세워두면 탱커"가 되어
         *   설계결정 5(벽은 편성 퍼즐)가 무너진다. `engage.js:tryHitCommander` 의
         *   우선순위 규칙과 **같은 한 문장**이다: 지휘관은 언제나 맨 마지막이다.
         *
         * ★ 이 한 줄이 없으면 원거리 적이 지휘관을 조준해도 탄이 그대로 통과해,
         *   "노리는데 안 맞는" 죽은 규칙이 된다.
         */
        if (!spent && !p.isAlly) {
            const c = s.commander;
            if (
                c.lane === p.lane &&
                commanderUp(s) &&
                !alreadyHit(p, COMMANDER_ID) &&
                (c.x > p.x ? c.x - p.x : p.x - c.x) <= HIT_WIDTH
            ) {
                const taken = damageCommander(s, p.damage, cfgCombat.enemyHitCommanderHpRatio ?? 0);
                if (taken > 0) {
                    p.hitIds.push(COMMANDER_ID);
                    emit(s.events, EV.PROJECTILE_HIT, p.id, COMMANDER_ID, p.lane);
                    if (p.pierce > 0) p.pierce--;
                    else spent = true;
                }
            }
        }

        if (spent) {
            list.splice(i, 1);
            releaseProjectile(s, p);
        }
    }
}

/**
 * 이 발사체가 이미 때린 적인가.
 * ★ 길이가 `pierce + 2` 를 넘지 않으므로(한 발에 한 번씩만 쌓인다 · 지휘관 한 칸)
 *   선형 탐색이 Set 보다 싸고 할당이 없다.
 */
function alreadyHit(p, id) {
    const ids = p.hitIds;
    for (let k = 0; k < ids.length; k++) {
        if (ids[k] === id) return true;
    }
    return false;
}

/** 활성 엔티티에서 id 조회. 발사자가 이미 죽었을 수 있다. */
function findById(s, id) {
    const a = s.actives;
    for (let i = 0; i < a.length; i++) {
        if (a[i].id === id) return a[i];
    }
    return null;
}
