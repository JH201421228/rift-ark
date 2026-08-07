/**
 * 세이브 마이그레이션.
 *
 * ★ version 을 올릴 때마다 반드시 작성한다. 세이브 파손은 리뷰 폭탄 직행이다
 *   (CLAUDE.md 리뷰 반려 사유 10).
 *
 * ★ zustand persist 는 저장된 객체를 **통째로** 기본값 위에 얹는다.
 *   슬라이스에 필드를 추가해도 구세이브에는 그 키가 없으므로 undefined 가 된다.
 *   신규 필드를 여기서 채우지 않으면 업데이트 직후 앱이 화이트스크린이 된다.
 *
 * ★ 스토어에서 분리해 둔 이유: 여기가 **단위 테스트가 가장 필요한 코드**인데,
 *   store/index.js 는 Capacitor 저장소를 import 하고 모듈 로드만으로 persist
 *   하이드레이션을 시작한다. 순수 함수로 떼어 두면 Node 에서 그대로 검증된다.
 *
 * ★★ **v1–v15 의 개별 블록은 접었다** (2026-08-04 경량화 · 튜토리얼 삭제).
 *   그 블록들이 채우던 키(`shop` · `gacha` · `daily` · `dungeons` · `tower` ·
 *   `trials` · `ads`)는 이제 **존재하지 않는다.** 사라진 슬라이스의 기본값을
 *   만들어 주려고 삭제된 모듈을 import 하는 마이그레이션은 그 자체가 부채다.
 *   남은 것은 살아 있는 세 키(`meta` · `roster` · `settings`)를
 *   어떤 옛 버전에서 와도 성립하게 만드는 일뿐이고, 그것은 버전별 분기가 아니라
 *   **한 번의 정규화**로 끝난다.
 *
 * @see docs/03-tech/21-state-management.md §6
 */
import { normalizeSettings } from "./slices/settingsSlice";
import { blankUnit } from "./slices/rosterSlice";
import { guaranteedUnitsUpTo } from "@/game/logic/unlocks";
import { COMMANDER_ITEMS } from "@/game/logic/commander";
import { normalizeSpellLoadout } from "@/game/logic/spells";
import { globalStageIndex } from "@/game/logic/difficulty";

/**
 * 사라진 최상위 키 — 남아 있으면 세이브만 무겁게 한다.
 *
 * ★ v15 경량화: `shop` · `gacha` · `daily` · `dungeons` · `tower` · `trials` · `ads`
 * ★ v16 튜토리얼 삭제(2026-08-04): `ftue`
 */
const DROPPED_KEYS = [
    "shop",
    "gacha",
    "daily",
    "dungeons",
    "tower",
    "trials",
    "ads",
    "ftue",
];

/**
 * v15 에서 사라진 `meta` 하위 키.
 *
 * ★ `dispatch`(파견) · `idleAdClaims`(광고 2배) · `idleLastClaimAt`(방치 정산 시각) ·
 *   `sigilEvolutionsFound`(각인 진화 도감)는 그 시스템과 함께 사라졌다.
 *   `bestiary` 도 도감 화면이 없어져 읽는 곳이 없다.
 */
const DROPPED_META_KEYS = [
    "dispatch",
    "dispatchAuto",
    "idleAdClaims",
    "idleLastClaimAt",
    "lastIdleAt",
    "sigilEvolutionsFound",
    "bestiary",
];

/**
 * 잃는 재화의 환산율 (골드당).
 *
 * ★★ **버리지 않고 골드로 바꾼다.** 젬은 결제 재화였고 강화석은 장비 재화였다 —
 *   둘 다 소모처가 사라졌으므로 그대로 두면 "가진 것이 조용히 증발"한다.
 *   이 저장소에 실플레이어는 없지만, 개발 계정도 세이브를 잃으면 진행 검증이
 *   처음부터다. 환산율은 옛 상점의 젬→골드 교환가(1젬 ≈ 20골드)와 강화석의
 *   대략적 가치(1석 ≈ 12골드)를 그대로 쓴다.
 */
const GEM_TO_GOLD = 20;
const STONE_TO_GOLD = 12;

export function migrate(persisted, from) {
    // ★ 객체가 아닌 세이브(문자열·배열·null)는 스프레드가 이상한 모양을 만든다.
    //   "세이브 없음"과 같게 다룬다 — 아래 블록 전부가 `s.x?.y` 로 방어된다.
    const s =
        persisted && typeof persisted === "object" && !Array.isArray(persisted)
            ? { ...persisted }
            : {};

    // ★ 숫자를 그대로 적는다 — `SAVE_VERSION` 을 import 하면 index ↔ migrate
    //   순환이 생긴다. `saveVersion.test.js` 가 이 수와 SAVE_VERSION 을 대조한다.
    if (from < 16) {
        for (const k of DROPPED_KEYS) delete s[k];

        const meta = { ...(s.meta ?? {}) };
        for (const k of DROPPED_META_KEYS) delete meta[k];

        // ── 방주: 사라진 시설을 지우고 `forge` 를 `armory` 로 승계한다.
        //   ★ 레벨을 그대로 옮긴다. 대장간에 쓴 골드는 이제 무기고에 쓴 것이 된다 —
        //     둘 다 "전투력을 올리는 시설"이었으므로 의미가 이어진다.
        const ark = { ...(meta.ark ?? {}) };
        if (ark.forge != null && ark.armory == null) ark.armory = ark.forge;
        delete ark.forge;
        delete ark.observatory;
        delete ark.market;
        meta.ark = ark;
        meta.arkBuilding = {}; // 건설 시간 게이트가 사라졌다 — 진행 중이던 공사는 즉시 완료로 본다

        // ── 재화: 골드 한 종으로 접는다.
        const cur = { ...(meta.currencies ?? {}) };
        const gold =
            (Number(cur.gold) || 0) +
            (Number(cur.gems) || 0) * GEM_TO_GOLD +
            (Number(cur.stones) || 0) * STONE_TO_GOLD;
        meta.currencies = { gold: Math.round(gold) };

        // ── 별 트리: 사라진 노드(`idle_1`)에 쓴 별은 환급하지 않는다.
        //   ★ `normalizeMeta` 가 미지의 노드를 무시하고 `starsSpent` 도 세지 않으므로
        //     별은 **자동으로 되돌아온다.** 여기서 손대면 이중 환급이 된다.
        if (meta.starTree && typeof meta.starTree === "object") {
            const tree = { ...meta.starTree };
            delete tree.idle_1;
            meta.starTree = tree;
        }

        s.meta = meta;

        // ── 동료: 승급·장비·소유효과 필드를 떨어낸다.
        //   ★ 레벨은 그대로다. 여기서 초기화하면 "업데이트했더니 1레벨" 이 된다.
        if (s.roster?.owned && typeof s.roster.owned === "object") {
            const owned = {};
            for (const [id, u] of Object.entries(s.roster.owned)) {
                owned[id] = { level: Number(u?.level) || 1 };
            }
            s.roster = { ...s.roster, owned };
        }

        // ── 설정: 알림·가챠 스킵 스위치를 떨어내고 형태를 맞춘다. 멱등이다.
        s.settings = normalizeSettings(s.settings);

    }

    /**
     * ── 확정 지급 동료 소급 (P8-02 / P8-03).
     *
     * ★ 확정 지급은 "진행하면 반드시 갖는다"는 명제인데, 그 명제가 설치 시점에
     *   따라 달라지면 명제가 아니다. 멱등이고, 이미 보유한 동료는 건드리지 않는다.
     *
     * ★★ **버전 블록 밖에 둔다** (2026-08-05). 예전에는 `from < 16` 안에 있었는데,
     *   `SAVE_VERSION` 이 17 로 오르자 **v16 세이브가 이 소급을 건너뛰었다** —
     *   즉 명제가 "16 미만에서 올라온 계정에만" 성립하게 됐다.
     *   `saveDurability.test.js` 가 그것을 잡았다.
     */
    s.roster = { ...s.roster, owned: withGuaranteedUnits(s) };

    /**
     * v17 = **지휘관 성장** (2026-08-05).
     *
     * ★★ 장구는 확정 지급이므로 **소급 지급한다** — 동료(P8-02)와 같은 논리다.
     *   "5-10 을 깬 계정에는 지휘관의 인장이 있다"가 명제인데, 그 명제가 설치
     *   시점에 따라 달라지면 명제가 아니다. 멱등이고, 이미 가진 것은 건드리지 않는다.
     * ★ 레벨은 1 로 시작한다. 소급해서 올릴 근거가 없다 — 골드로 사는 것이고,
     *   그 골드는 이미 다른 데 썼을 수 있다.
     */
    if (from < 17) {
        const meta = { ...(s.meta ?? {}) };
        const c = meta.commander ?? {};
        const items = new Set(Array.isArray(c.items) ? c.items.filter((x) => typeof x === "string") : []);
        const equipped = { ...(c.equipped ?? {}) };
        for (const item of commanderItemsUpTo(Number(meta.highestStage ?? 0) || 0)) {
            if (items.has(item.id)) continue;
            items.add(item.id);
            if (!equipped[item.slot]) equipped[item.slot] = item.id;
        }
        meta.commander = {
            level: Math.max(1, Number(c.level) || 1),
            items: [...items],
            equipped,
        };
        s.meta = meta;
    }

    /**
     * v18 = **지휘관 주문 12종 / 장착 4칸** (2026-08-05).
     *
     * ★ 해금 자체는 저장하지 않는다 — `highestStage` 의 파생이다 (저장하면 진행도의
     *   두 번째 출처가 되고 되감기·슬롯 이동에서 갈라진다). 여기서 채우는 것은
     *   **장착 4칸**뿐이고, 옛 세이브에는 그 필드가 없으므로 기본 4종으로 시작한다.
     * ★ `normalizeSpellLoadout` 이 형태를 보장한다 — 손으로 채우지 않는다.
     */
    if (from < 18) {
        const meta = { ...(s.meta ?? {}) };
        const c = meta.commander ?? {};
        meta.commander = { ...c, spells: normalizeSpellLoadout(c.spells) };
        s.meta = meta;
    }

    return s;
}

/**
 * 그 진행도까지 **확정으로 받았어야 하는** 지휘관 장구.
 * ★ 스테이지 순번 비교는 `globalStageIndex` 하나가 한다 — 여기서 `"2-8" < "3-1"`
 *   같은 문자열 비교를 하면 10 번대 스테이지에서 조용히 틀린다.
 */
function commanderItemsUpTo(highestStage) {
    return COMMANDER_ITEMS.filter((it) => {
        const idx = globalStageIndex(it.stage);
        return Number.isFinite(idx) && idx <= highestStage;
    });
}

/**
 * 진행도가 보장하는 동료를 **채워 넣은** owned 맵.
 *
 * ★ **덮어쓰지 않는다.** 이미 보유한 동료는 레벨을 그대로 두고 건너뛴다 —
 *   여기서 `blankUnit()` 을 얹으면 30레벨 동료가 1레벨로 초기화된다.
 */
function withGuaranteedUnits(s) {
    const highest = Number(s.meta?.highestStage ?? 0) || 0;
    const owned = { ...(s.roster?.owned ?? {}) };
    for (const unitId of guaranteedUnitsUpTo(highest)) {
        if (!owned[unitId]) owned[unitId] = blankUnit();
    }
    return owned;
}
