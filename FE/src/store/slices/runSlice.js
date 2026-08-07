/**
 * runSlice — 현재 전투 상태 (휘발성)
 *
 * ★ 이 슬라이스는 절대 영속화하지 않는다 (index.js 의 partialize).
 *   저장하면 콜드 스타트에 반쯤 끝난 전투가 복원된다.
 *
 * ★ 초당 10회 넘게 변하는 값은 여기 두지 않는다.
 *   엔티티 좌표·애니메이션 프레임·발사체는 Phaser 씬 메모리에 있고,
 *   여기에는 집계값만 10Hz 로 동기화된다.
 *
 * @see docs/03-tech/21-state-management.md §3
 */

/** @typedef {'idle'|'loading'|'deploy'|'battle'|'draft'|'victory'|'defeat'|'paused'} RunPhase */

export const createRunSlice = (set, get) => ({
    /** @type {RunPhase} */
    phase: "idle",
    stageId: null,

    wave: 0,
    waveTotal: 0,
    tempoShifted: false,

    mana: 0,
    manaMax: 200,
    riftEnergy: 0,
    riftMax: 100,

    arkHp: 100,
    arkHpMax: 100,

    /**
     * 지휘관 체력 (2026-08-05).
     *
     * ★★ **적이 지휘관을 때리기 시작한 날 함께 들어왔다.** 그전까지 지휘관을 깎는
     *   것은 보스 슬램 하나뿐이라 화면에 숫자가 없어도 티가 안 났는데, 이제는
     *   자동 조작 실측으로 2-5 에서 **평균 600 중 546 을 잃은 채** 전투가 끝난다.
     *   읽을 수 없는 자원은 관리할 수 없고, 관리할 수 없으면 "앞으로 나가면 위험하다"
     *   (설계 문서 §2.1 의 미끼 규칙)를 플레이어가 배울 방법이 없다.
     *
     * ★ 기절 카운트다운(`재출격 N`)은 여기 두지 않는다 — `CommanderPresenter` 가
     *   이미 지휘관 스프라이트 위에 그린다. 같은 정보를 두 번 쓰지 않는다.
     */
    commanderHp: 0,
    commanderHpMax: 0,

    selectedSlot: 0,
    /**
     * 슬롯별 현재 소환 코스트 (상승분 반영).
     * ★ 카운트가 아니라 계산된 코스트를 넘긴다 — HUD 가 밸런스 공식을 알 필요가 없다.
     */
    slotCosts: [],
    /**
     * 주문별 남은 재사용 대기 비율 (0~1) — **`{주문id: 비율}`** (2026-08-06).
     *
     * ★ 계산은 `logic/spells.js:cooldownPct` 가 한다. HUD 는 그리기만 한다.
     * ★★ 예전에는 **배열(장착 순서)**이었다. 씬과 HUD 가 서로 다른 목록을 갖는
     *   순간 쿨다운이 남의 버튼에 붙었고, 어긋나도 아무도 실패하지 않았다.
     *   id 로 두면 없는 키는 0 이 되고 오배치가 구조적으로 불가능하다.
     */
    spellCooldowns: {},
    /** 획득한 각인 id 목록 */
    sigils: [],
    /**
     * ★★ **`commanderLane` 은 2026-08-07 에 삭제됐다.**
     *   선언만 되어 있고 쓰는 곳도 읽는 곳도 0 이었다 — 값은 영원히 1 이었다.
     *   다음 사람이 "지휘관이 몇 번 레인인가"를 그리려고 이 값을 구독하면
     *   **언제나 2번 레인**이 나온다. 이 저장소가 반복해서 당한
     *   "선언했는데 아무도 읽지 않는 것"의 전형이고, 그중에서도 나쁜 종류다
     *   (없는 것보다 **틀린 값이 있는 것**이 더 오래 속인다).
     *   실제 값이 필요해지면 `BattleScene.throttledSync` 가 `s.commander.lane` 을
     *   실어 보내면 된다 — 그때 되살릴 것.
     */

    /**
     * 전투 모드 목표 (GDD §4.8).
     * ★ 객체가 아니라 원시값 2개로 둔다. 객체를 넣으면 매 동기화마다
     *   참조가 달라져 얕은 비교가 항상 실패하고 10Hz 리렌더가 그대로 터진다.
     */
    mode: "assault",
    objectiveText: "",
    objectiveRatio: 0,

    startBattle: (stageId, cfg) =>
        set({
            phase: "deploy",
            stageId,
            wave: 0,
            waveTotal: cfg.waves,
            tempoShifted: false,
            mode: cfg.mode ?? "assault",
            objectiveText: "",
            objectiveRatio: 0,
            mana: cfg.startMana,
            manaMax: cfg.manaMax ?? 200,
            riftEnergy: 0,
            arkHp: cfg.arkHp,
            arkHpMax: cfg.arkHp,
            commanderHp: cfg.commanderHp,
            commanderHpMax: cfg.commanderHp,
            selectedSlot: 0,
            slotCosts: [],
            spellCooldowns: {},
            sigils: [],
        }),

    /**
     * ★ Phaser 의 update() 가 10Hz 로 호출하는 유일한 동기화 지점.
     *   내부에서 얕은 비교를 하므로 값이 안 바뀌면 알림조차 발생하지 않는다.
     */
    syncFromSim: (s) => {
        const p = get();
        const sameList = (prev, next) =>
            !next || (prev.length === next.length && prev.every((v, i) => v === next[i]));
        const costsSame = sameList(p.slotCosts, s.slotCosts);
        /**
         * ★ 쿨다운도 같은 규약이되 **키 있는 객체**다 (2026-08-06). 값이 같으면
         *   참조를 유지해 10Hz 재렌더를 막는다.
         */
        const sameMap = (prev, next) => {
            if (!next) return true;
            const pk = Object.keys(prev);
            const nk = Object.keys(next);
            if (pk.length !== nk.length) return false;
            for (const k of nk) if (prev[k] !== next[k]) return false;
            return true;
        };
        const cdSame = sameMap(p.spellCooldowns ?? {}, s.spellCooldowns);

        if (
            costsSame &&
            cdSame &&
            p.mana === s.mana &&
            p.riftEnergy === s.riftEnergy &&
            p.arkHp === s.arkHp &&
            // ★ 새 필드를 여기 빠뜨리면 조용히 굳는다 — 그 값만 바뀐 동기화가
            //   위에서 걸러져 화면이 영영 안 따라온다 (지휘관 HP 가 그럴 뻔했다)
            p.commanderHp === s.commanderHp &&
            p.wave === s.wave &&
            p.tempoShifted === s.tempoShifted &&
            p.objectiveText === s.objectiveText &&
            p.objectiveRatio === s.objectiveRatio
        ) {
            return;
        }
        /**
         * ★★ **값이 같으면 배열 참조도 그대로 둔다** (2026-08-05, 성능 실측).
         *
         *   위 얕은 비교는 "전부 같으면 아무것도 하지 않는다"는 잘 지키고 있었다.
         *   문제는 **하나라도 다를 때**다 — 마나는 사실상 매 동기화마다 바뀌므로
         *   거의 항상 `set()` 이 돌고, 그때 씬이 만들어 준 **새 `slotCosts` 배열**이
         *   그대로 들어간다. 값이 한 자도 안 바뀌었는데 참조가 달라지므로
         *   `useGameStore((s) => s.slotCosts)` 를 구독하는 슬롯 줄이 **10Hz 로
         *   계속 다시 그려진다** — 스프라이트 6장짜리 카드가 초당 열 번이다.
         *
         *   React 커밋 한 번이 개발 빌드에서 약 4.8ms 였고(6× 스로틀 실측),
         *   그중 이 구독이 만든 몫이 슬롯 줄 전체다. 참조 하나를 아끼는 것이
         *   `memo` 를 더 두르는 것보다 확실하다.
         */
        const patch = { ...s };
        if (costsSame && s.slotCosts) patch.slotCosts = p.slotCosts;
        if (cdSame && s.spellCooldowns) patch.spellCooldowns = p.spellCooldowns;
        set(patch);
    },

    selectSlot: (i) => set({ selectedSlot: i }),
    setPhase: (phase) => set({ phase }),

    /**
     * 획득한 각인 목록 (드래프트에서 고를 때마다 한 번).
     *
     * ★★ **이 필드는 오래도록 비어 있었다** (2026-08-04 발견). 시뮬은 각인을
     *   제대로 적용하고 있었는데(전수 감사 18/18 통과) **화면에 알려 주는 경로가
     *   없어서**, 플레이어에게는 "고르면 사라지는 선택지"로 보였다.
     *   사용자가 "각인이 작동하는 게 맞느냐"고 물은 것이 이 침묵이다.
     *
     * ★ 10Hz 동기화에 얹지 않는다. 각인은 3웨이브마다 한 번 바뀐다 —
     *   그 빈도의 값을 프레임 동기화에 태우면 절대 규칙 2 를 어기는 것이다.
     */
    setRunSigils: (sigils) => set({ sigils }),
    pauseRun: () => (get().phase === "battle" ? set({ phase: "paused" }) : undefined),
    resumeRun: () => (get().phase === "paused" ? set({ phase: "battle" }) : undefined),
    endBattle: (result) => set({ phase: result }),
    resetRun: () => set({ phase: "idle", stageId: null }),
});
