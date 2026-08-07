/**
 * BattleScene — 전투 렌더러
 *
 * ★ 이 씬은 게임 규칙을 갖지 않는다. 시뮬 상태를 읽어 스프라이트를 움직일 뿐이다.
 *   모든 전투 수학은 src/game/logic/ 의 순수 함수에 있다.
 *
 * ★ 고정 30Hz 틱 구동 + 250ms 클램프.
 *   Capacitor resume 후 delta 가 수 분일 수 있는데, 클램프가 없으면
 *   "5분치 시뮬을 한 프레임에 계산"하는 사고가 난다.
 *
 * ★ 스토어 동기화는 10Hz 스로틀. 60Hz setState 는 렌더 폭풍을 만든다.
 *
 * @see docs/03-tech/22-simulation-spec.md §4.1
 * @see docs/03-tech/21-state-management.md §4.2
 */
import Phaser from "phaser";
import { DESIGN, LANES, PIXEL_FONT } from "../config.js";
import { EventBus, EVT } from "../EventBus.js";
import { installViewport, resyncViewportIfDrifted } from "../viewport.js";
import { gameStore } from "@/store";
import { bgmLevel, sfxLevel } from "@/store/slices/settingsSlice";

import {
    createSim,
    step,
    chooseSigil,
    rerollDraft,
    isTerminalPhase,
} from "../logic/sim.js";
import { TICK_MS, MAX_TICKS_PER_FRAME, MAX_DELTA_MS } from "../logic/tick.js";
import { buildStageConfig } from "../logic/stageConfig.js";
import { castSpell, canCast, cooldownPct } from "@/game/logic/spells";
import { trySummon } from "../logic/spawn.js";
import { summonCost } from "../logic/resources.js";
import { computeStars, diagnoseDefeat } from "../logic/lifecycle.js";
import { autoPlayTick } from "../logic/autoPlay.js";
import { EV, DEATH_CAUSE, createEventReader, drainEvents } from "../logic/events.js";
import { AIR_LANE } from "../logic/state.js";
// ★ 지휘관의 예약 id — 엔티티가 아니라서 스프라이트 맵에 없다 (onDamage 참조)
import { COMMANDER_ID, commanderUp } from "../logic/commanderHit.js";
import { MODE } from "../logic/modes.js";
import fxData from "../data/fx.json" with { type: "json" };
// ★ 지휘관 주문·기절 연출 프로파일. 이펙트 이름을 코드에 박지 않는다 (절대규칙 5).
import presenterData from "../data/presenters.json" with { type: "json" };
/**
 * 주문 연출의 재사용 옵션 객체 (절대규칙 7 — 매 발동마다 할당하지 않는다).
 * ★ `EffectSystem.play` 는 이 객체를 붙들지 않고 그 자리에서 읽는다.
 */
const SPELL_FX_OPTS = { scale: 1, tint: undefined };
/**
 * ★ 씬은 React 가 아니므로 `useT()` 를 쓸 수 없다 — 모듈 스코프의 현재 언어를 읽는
 *   `t` 를 직접 쓴다. 씬은 매 프레임 다시 그리므로 언어가 바뀌면 다음 프레임에
 *   따라온다 (`throttledSync` 가 10Hz 로 HUD 에 다시 실어 보낸다).
 */
import { t } from "@/i18n";

import { EffectSystem } from "../fx/EffectSystem.js";
import { CameraFx } from "../fx/CameraFx.js";
import { qualityOf, PROJECTILE_POOL } from "../fx/quality.js";
import { AudioManager } from "../fx/AudioManager.js";
import { BattleSfx } from "../fx/BattleSfx.js";
import { SFX } from "../fx/sfxKeys.js";
import { hapticHit } from "@/native/haptics";
import { setContextProvider, clearContextProvider } from "@/utils/diagnostics";
import { UnitPresenter } from "../presenters/UnitPresenter.js";
import { ParallaxLayers, preloadWorldBackground } from "../presenters/ParallaxLayers.js";
import { StructurePresenter, preloadStructures } from "../presenters/StructurePresenter.js";
import { BlockPresenter } from "../presenters/BlockPresenter.js";
import { PlagueZones } from "../presenters/PlagueZones.js";
import { EnemyBadges } from "../presenters/EnemyBadges.js";
import { CommanderPresenter, preloadCommander } from "../presenters/CommanderPresenter.js";
import { BossPresenter } from "../presenters/BossPresenter.js";
import { DamageTextPool } from "../pools/DamageTextPool.js";
import { SpritePool } from "../pools/SpritePool.js";
import { clipFrames, projectileFrame, flipPlan } from "../projectileAnim.js";

/** HUD 동기화 주기 (10Hz) */
const SYNC_MS = 100;

/**
 * 발사체 애니메이션 재생 속도.
 * ★ 4~5프레임짜리 짧은 루프라 빠르게 돌려야 "이글거린다"로 읽힌다.
 *   느리면 프레임이 하나씩 또렷이 보여 깜빡임처럼 느껴진다.
 */
const PROJ_FPS = 12;

export class BattleScene extends Phaser.Scene {
    constructor() {
        super({ key: "Battle" });
    }

    init(data) {
        this.stageId = data?.stageId ?? "1-1";
        this.loadout = data?.loadout ?? [];
        this.seed = data?.seed ?? 1;
        /**
         * ★ 메타 성장은 여기서 받아 buildStageConfig 로 그대로 넘긴다.
         *   씬이 스토어에서 직접 읽지 않는 이유: 씬은 리플레이·밸런스 하네스에서
         *   스토어 없이도 같은 데이터로 재현 가능해야 한다.
         */
        this.metaOpts = {
            meta: data?.meta ?? {},
            draftOptions: data?.draftOptions,
            rerolls: data?.rerolls,
            // 난이도도 '데이터로 받는 값'이다 (P6-10). 씬이 스토어를 직접 읽으면
            // 리플레이·하네스에서 재현이 깨진다.
            difficulty: data?.difficulty,
            /**
             * ★★★ **장착 주문 4칸** (2026-08-06, 사용자 제보 — "쿨타임이 다른 스킬
             *   HUD 위에 붙어 있다").
             *
             *   이 줄이 4개월 없었다. `buildStageConfig` 는 `opts.spells` 가 없으면
             *   `spells.json:defaultLoadout` 으로 떨어지므로(그 파일 §387 의 경고
             *   그대로), **시뮬은 늘 기본 4종으로 싸웠다.** HUD 는 플레이어가 고른
             *   4종을 그렸으니 목록이 어긋났고, 쿨다운을 **위치**로 실어 보내던
             *   탓에 그 어긋남이 "남의 버튼 위의 숫자"로 나타났다.
             *   지금은 쿨다운도 id 로 실어 보낸다 (`syncHud`).
             */
            spells: data?.spells,
        };
        this.speedMultiplier = 1;
        this._acc = 0;
        this._syncAcc = 0;
        this._unsubs = [];
        /**
         * ★★ 정의 맵을 **진영별로 나눈다** (2026-08-05).
         *   `units.json` 과 `enemies.json` 에 **같은 id 가 10종** 있다
         *   (vile_witch · elf_enchanter · ice_golem …). 한 Map 에 적을 나중에
         *   넣으면 아군 정의가 통째로 덮여서, 아군 `crushing_cyclops` 가 적 쪽의
         *   `scale` 미지정 정의를 물고 **×1 로 쪼그라들어** 떴다. 발사체도
         *   같은 경로로 남의 것을 쏘게 된다.
         */
        this._allyDefs = new Map();
        this._enemyDefs = new Map();
        /**
         * ★ 플레이어 입력은 틱 경계에서만 적용한다.
         *   틱 밖에서 시뮬을 건드리면 다음 step() 의 resetQueue 가 그 이벤트를
         *   지워버려 연출이 통째로 사라진다. 그리고 무엇보다,
         *   입력을 틱에 정렬해야 리플레이·비동기 PvP 고스트가 성립한다.
         */
        this._inputQueue = [];
        /**
         * 이벤트 소비 커서.
         *
         * ★ 큐를 0번부터 다시 훑지 않는다. `chooseSigil()` 은 **드래프트가 열린
         *   틱의 이벤트가 아직 큐에 남아 있는 상태에서** 같은 큐 뒤에 append 한다.
         *   커서 없이 소비하면 각인을 고르는 순간 직전 틱이 통째로 재실행되어
         *   유령 유닛(스프라이트 맵 덮어쓰기) · 도감 처치 2배 · 히트스톱 재발동이
         *   일어난다. 근거와 대안 비교는 logic/events.js `createEventReader` 참조.
         *
         * ★ 씬 재시작마다 새로 만든다 — 커서가 이전 전투의 세대를 기억하면 안 된다.
         */
        this._evReader = createEventReader();
        /** ★ 매 틱 새 클로저를 만들지 않는다 (절대규칙 7) */
        this._onSimEvent = (e) => this.dispatchEvent(e);
        /**
         * 도감 기록 버퍼 (P7-14).
         * ★ 스폰·처치마다 스토어를 건드리지 않는다 — 한 판에 수백 번이다.
         *   씬 로컬에 모았다가 전투가 끝날 때 한 번에 밀어 넣는다 (절대규칙 2).
         */
        this._codex = {
            enemies: new Set(),
            kills: new Map(),
            sigils: new Set(),
            evolutions: new Set(),
        };
    }

    /** 배경·BGM 이 쓰는 월드 번호 */
    battleWorldId() {
        return Number((this.stageId ?? "1-1").split("-")[0]) || 1;
    }

    preload() {
        const world = this.battleWorldId();
        // 전투 BGM 레이어는 씬 진입 시 지연 로드한다 (프리로드 예산 보호)
        AudioManager.preload(this, world);
        // ★ 배경은 **그 월드 4장만** 받는다. 40장 전체는 3.3MB 다.
        preloadWorldBackground(this, world);
        preloadStructures(this);
        preloadCommander(this);
    }

    create() {
        const settings = gameStore.get().settings;

        this.cfg = buildStageConfig(this.stageId, this.loadout, this.metaOpts);
        this.sim = createSim(this.cfg, this.seed);
        this.worldId = this.battleWorldId();

        // 정의 조회용 맵 (스프라이트 생성 시 art 정보가 필요하다). 진영별로 나눈다 — init() 주석 참조
        for (const d of this.cfg.loadout) this._allyDefs.set(d.id, d);
        for (const id in this.cfg.enemyDefs) this._enemyDefs.set(id, this.cfg.enemyDefs[id]);

        // ★ 카메라를 먼저 맞춘다 — 배경이 보이는 폭을 알아야 만들 수 있다.
        //   화면 크기가 바뀌면 배경만 다시 만든다 (좌표계는 안 바뀐다).
        installViewport(this, (vp) => this.parallax?.resize(vp));

        /**
         * ★★ 품질 티어 (26-performance-budget.md §4). `settings.qualityTier` 가
         *   **처음으로** 무언가를 하는 자리다 — 그 전까지 이 키는 저장되기만 하고
         *   아무도 읽지 않았다. 표는 `data/quality.json`, 배선은 `fx/quality.js`.
         *
         * ★ 셰이크는 접근성 설정을 **대체하지 않고 곱한다.** 끄기(0)는 티어와
         *   무관하게 언제나 0 이어야 한다 (check-a11y M1 의 규율).
         */
        this.quality = qualityOf(settings.qualityTier);

        // ── 렌더 레이어 ──
        this.parallax = new ParallaxLayers(this, this.worldId, this.quality.bgLayers);
        this.cameraFx = new CameraFx(this, {
            shakeScale: this.shakeScaleFor(settings),
            hitStopEnabled: settings.hitStop ?? true,
        });
        this.fx = new EffectSystem(
            this,
            this.worldId,
            this.quality.effects,
            settings.effectIntensity ?? "high"
        );
        this.presenter = new UnitPresenter(this, this.fx, this.cameraFx);
        this.badges = new EnemyBadges(this);
        this.badges.setLoadout(this.cfg.loadout);
        this.commander = new CommanderPresenter(this, this.fx);
        // "누가 막고 있는가" 시각화 — 방벽과 근접의 차이를 화면이 설명한다
        this.blockFx = new BlockPresenter(this);
        /**
         * 나이트메어 ① 역병 장판. **난이도와 무관하게 만든다** — 슬롯 구조체가
         * 언제나 있으므로 규칙이 안 걸린 판에서는 아무것도 그리지 않는다.
         * (씬을 난이도로 갈라 놓으면 "나이트메어에서만 나는 렌더 버그"가 생긴다.)
         */
        this.plagueFx = new PlagueZones(this);
        // 보스 페이즈 연출 (P6-05). 보스전이 아니면 만들지 않는다.
        this.bossFx = this.sim.mode === MODE.NEMESIS ? new BossPresenter(this, this.cameraFx) : null;
        this.dmgText = new DamageTextPool(this, this.quality.dmgText);
        this.dmgText.setDensity(settings.damageNumbers ?? "all");
        this.dmgText.setColorBlind(settings.colorBlindMode ?? false);
        this.projArt = fxData.projectile;
        this.registerProjectileAnims();
        /**
         * ★ 프레임을 명시한다 — 생략하면 아틀라스 시트 전체가 그려진다.
         *   기본 뷰는 registerProjectileAnims() 가 이미 만들어 뒀다.
         *
         * ★★ 크기는 **데이터가 정한다** (`data/quality.json:projectilePool`).
         *   `SpritePool` 은 마르면 `grow()` 하지 않고 **가장 오래된 활성분을
         *   회수**한다 — 날아가던 발사체가 소리 없이 사라진다. 그래서 이 값이
         *   실측 최댓값보다 작으면 안 되고, `pools/poolSizing.test.js` 가
         *   100 스테이지 실측으로 그것을 강제한다.
         *   품질 티어로 줄이지 않는 이유는 `fx/quality.js:PROJECTILE_POOL` 참조.
         */
        this.projPool = new SpritePool(
            this,
            this.projArt.atlas,
            PROJECTILE_POOL,
            350,
            this._projDefault.frame
        );
        // ★ 음소거는 스토어에만 있는 개념이다. AudioManager 는 숫자만 안다 —
        //   설정 스키마가 바뀔 때마다 오디오 계층을 고치지 않기 위해서다.
        this.audio = new AudioManager(this, {
            bgmVolume: bgmLevel(settings),
            sfxVolume: sfxLevel(settings),
        });
        this.audio.startBattle(this.worldId);
        // ★ 효과음은 절차적 합성이다 (SFX 에셋 0개). 볼륨·이펙트 강도 구독은
        //   App 이 전역으로 걸어 둔다 — UI 효과음이 씬 밖에서도 울려야 하므로.
        this.battleSfx = new BattleSfx((id) => this.findEntity(id));
        this.applySpeedSetting(settings);

        this.drawStructures();
        this.setupInput();

        // 전투 시작을 스토어에 알린다.
        // ★ 구독 등록보다 **먼저** 해야 한다. 순서를 바꾸면 setPhase 가
        //   create() 안에서 자기 구독을 동기 호출해 재진입하고,
        //   아직 등록되지 않은 ScenePlugin 에 접근해 터진다.
        gameStore.get().startBattle(this.stageId, {
            waves: this.cfg.waves,
            startMana: this.cfg.startMana,
            manaMax: this.cfg.manaMax,
            arkHp: this.cfg.arkHp,
            // ★ HUD 의 지휘관 게이지가 이 값으로 최대치를 잡는다. 빠뜨리면 최대치가
            //   0 이라 **게이지가 통째로 안 뜬다** — 에러 없이 조용히 (실제로 그랬다).
            commanderHp: this.cfg.commanderHp,
            mode: this.cfg.mode,
        });
        gameStore.get().setPhase("battle");

        this.setupSubscriptions();
        this.installDiagnosticContext();
        EventBus.emit(EVT.SCENE_READY, this);

        // 개발 콘솔에서 시뮬 상태를 들여다보기 위한 핸들
        if (import.meta.env.DEV) globalThis.__battle = this;
    }

    /**
     * 진단 기록에 **전투의 상황**을 실어 준다 (`utils/diagnostics.js`).
     *
     * ★★ 이것이 없으면 기록은 "400ms 프레임" 한 줄뿐이고, 그 줄로는 아무것도
     *   재현할 수 없다. 웨이브 · 동시 엔티티 · 발사체가 함께 남아야 사용자가
     *   PC 없이 숫자만 읽어 줘도 우리가 그 자리를 다시 만들 수 있다.
     *
     * ★ 함수는 **기록하는 순간에만** 불린다 (예외 · 스톨 · 심장박동). 매 프레임
     *   맥락을 모으면 감시가 그 자체로 부하가 된다 (절대규칙 7).
     *
     * ★ 객체를 만들지 않는다 — 넘겨받은 레코드에 숫자를 채워 넣을 뿐이다.
     */
    installDiagnosticContext() {
        this._diagContext = (rec) => {
            rec.scene = t("battle.sceneTag", { stage: this.stageId });
            rec.wave = this.sim?.wave ?? 0;
            rec.actives = this.sim?.actives?.length ?? 0;
            rec.projectiles = this.sim?.projectiles?.length ?? 0;
            rec.dmgText = this.dmgText?.activeCount ?? 0;
            rec.tweens = this.tweens?.getTweens?.().length ?? 0;
            // ★ 풀이 모자라 그리지 못한 발사체 — 말없이 사라지는 것을 센다
            rec.undrawn = this._projUndrawn ?? 0;
            // ★ 시뮬 풀이 고갈되어 **태어나지 못한** 개체·탄 (logic/state.js)
            rec.spawnDropped = this.sim?.stats?.spawnDropped ?? 0;
            rec.projectileDropped = this.sim?.stats?.projectileDropped ?? 0;
        };
        setContextProvider(this._diagContext);
    }

    /* ── 정적 구조물 ────────────────────────────────────────── */

    drawStructures() {
        // 방주·균열 실루엣 (아트가 없으면 도형 폴백)
        this.structures = new StructurePresenter(this);

        this.riftGlow = this.add.graphics().setDepth(41);
        /**
         * ★★ **레인 강조는 여기서 그리지 않는다** (2026-08-04).
         *
         *   예전에는 이 씬이 금색 사각형 3개를 그리고, DOM 의 `LanePicker` 도
         *   같은 자리에 자기 띠를 그렸다 — **주인이 둘**이었다. 그래서
         *   · 레인마다 다른 색을 주자 캔버스의 금색과 겹쳐 색이 섞였고
         *   · 캔버스가 그리던 안내 문구는 디자인 좌표(y=106)에 고정인데
         *     HUD 는 CSS 픽셀이라, 줌이 바뀌면 **마나·균열력 위에 올라탔다.**
         *
         *   레인 강조는 **탭 대상**이고 탭 대상은 DOM 이 갖는다. 히트 영역 ·
         *   색 · 숫자 · 눌림 상태가 한 곳에 모여야 서로 어긋나지 않는다.
         *   → `hud/BattleHud.jsx:LanePicker` 가 단일 주인이다.
         */
    }

    /* ── 입력 ───────────────────────────────────────────────── */

    setupInput() {
        // 지휘관 이동: 전장 탭/드래그
        this.input.on("pointerdown", (p) => this.moveCommanderTo(p));
        this.input.on("pointermove", (p) => {
            if (p.isDown) this.moveCommanderTo(p);
        });

        // HUD → 씬
        this._onSummon = ({ slotIndex, lane }) => this.handleSummon(slotIndex, lane);
        EventBus.on(EVT.REQUEST_SUMMON, this._onSummon, this);

        // 지휘관 주문 — 의도만 큐에 넣는다 (적용은 틱 안, applyQueuedInputs)
        this._onCastSpell = ({ spellId, lane }) =>
            this._inputQueue.push({ type: "spell", spellId, lane });
        EventBus.on(EVT.CAST_SPELL, this._onCastSpell, this);

        // 각인 드래프트 선택/리롤
        this._onSigilChoose = (index) => {
            const evo = chooseSigil(this.sim, index);
            this.consumeEvents();
            if (evo) {
                this.cameraFx.zoomPulse(1.12, 260, 120);
                this.fx.play("holy_burst", LANES.arkX + 200, LANES.ground[1].y, { scale: 2 });
            }
            // ★ 획득한 각인을 HUD 에 알린다 (드래프트마다 한 번 — 10Hz 동기화 아님).
            //   이 한 줄이 없던 동안 각인은 **작동하면서도 보이지 않았다.**
            gameStore.get().setRunSigils([...this.sim.sigils]);
            this.emitDraftState();
        };
        this._onSigilReroll = () => {
            if (rerollDraft(this.sim)) this.emitDraftState();
        };
        EventBus.on(EVT.SIGIL_CHOOSE, this._onSigilChoose, this);
        EventBus.on(EVT.SIGIL_REROLL, this._onSigilReroll, this);
    }

    /** 드래프트 상태를 React 로 보낸다 */
    emitDraftState(evolution = null) {
        EventBus.emit(EVT.SIGIL_DRAFT_OPEN, {
            draft: this.sim.pendingDraft,
            rerollsLeft: this.sim.rerollsLeft,
            evolution,
        });
    }

    moveCommanderTo(pointer) {
        if (gameStore.get().settings.autoCommander) return;
        const y = pointer.worldY;
        const top = LANES.hud.topH;
        const bottom = DESIGN.height - LANES.hud.bottomH;
        if (y < top || y > bottom) return; // HUD 영역 탭은 무시

        // 가장 가까운 레인
        let best = 0;
        let bestD = Infinity;
        LANES.ground.forEach((l, i) => {
            const d = Math.abs(l.y - y);
            if (d < bestD) {
                bestD = d;
                best = i;
            }
        });
        this.sim.commander.lane = best;
        this.sim.commander.targetX = Phaser.Math.Clamp(
            pointer.worldX,
            LANES.arkX + 24,
            LANES.riftX - 24
        );
    }

    /**
     * 소환. lane 이 null 이면 원터치 모드 — 가장 비어 있는 레인에 자동 배치.
     * ★ 원터치가 기본값이다 (캐주얼 접근성).
     */
    /** 입력을 큐에 넣기만 한다. 실제 적용은 다음 틱 직전 (§runSimulation) */
    handleSummon(slotIndex, lane) {
        if (this.sim.phase !== "battle") return;
        this._inputQueue.push({ type: "summon", slotIndex, lane });
    }

    /** 큐에 쌓인 입력을 틱 직전에 적용한다 */
    applyQueuedInputs() {
        const q = this._inputQueue;
        if (!q.length) return;

        for (let i = 0; i < q.length; i++) {
            const cmd = q[i];

            /**
             * ★ 지휘관 주문 — 소환과 **같은 경로**로 들어온다.
             *   `castSpell` 을 EventBus 핸들러에서 직접 부르면 그 SPELL_CAST·DAMAGE
             *   이벤트를 다음 `step()` 의 `resetQueue` 가 지운다 (소환에서 겪은 그 사고).
             */
            if (cmd.type === "spell") {
                /**
                 * ★★ 사유를 **시전 전에** 묻는다 (2026-08-05).
                 *   `castSpell` 은 성공 여부(boolean)만 돌려주고, 실패하면 아무것도
                 *   바꾸지 않은 채 나온다. 그러니 사후에 물으면 답은 같지만
                 *   **성공했을 때 물으면 쿨다운이 이미 걸려 있어** "재사용 대기 중"이
                 *   나온다. 판정을 새로 만들지 않고 `canCast` 를 그대로 쓰는 것이
                 *   핵심이다 — HUD 가 스스로 판정하면 두 곳이 갈라진다.
                 */
                const check = canCast(this.sim, cmd.spellId);
                const ok = castSpell(this.sim, cmd.spellId, { lane: cmd.lane });
                if (!ok) {
                    this.cameraFx.shake(1, 60); // 균열력 부족·쿨다운 피드백
                    this.battleSfx?.play(SFX.MANA_SHORT, 0);
                }
                /**
                 * ★ 명령 하나당 **정확히 한 번**. 큐에서 꺼낸 자리에 있으므로
                 *   틱이 몇 번 돌든 탭 한 번에 문구 한 번이다 (EventBus 는 React
                 *   소비자라 매 프레임 쏘면 그대로 리렌더가 된다).
                 * ★ 사유를 뭉뚱그리지 않는다 — `commander_down`(지휘관 기절)을
                 *   "균열력 부족"으로 말하면 플레이어는 영영 오지 않을 자원을 기다린다.
                 */
                EventBus.emit(EVT.SPELL_RESULT, {
                    spellId: cmd.spellId,
                    ok,
                    reason: ok ? null : check.reason,
                });
                continue;
            }

            if (cmd.type !== "summon") continue;

            const def = this.cfg.loadout[cmd.slotIndex];
            if (!def) continue;

            const targetLane = cmd.lane ?? this.emptiestLane();
            /**
             * ★★ **떼 소환을 여기서 반복하지 않는다** (2026-08-05).
             *   예전에는 `for (squad)` 로 `trySummon` 을 여러 번 불렀고, 그래서
             *   마나가 마릿수만큼 나가면서 **코스트 상승도 마릿수만큼** 일어났다.
             *   두 번째 탭에 2마리, 세 번째에 1마리가 나오던 것이 그 결과다.
             *   이제 `trySummon` 이 `def.squad` 를 알고 **전부 아니면 0** 으로 처리한다.
             */
            const ok = trySummon(this.sim, def, targetLane);
            if (!ok) this.cameraFx.shake(1, 60); // 마나 부족 피드백
            if (!ok) this.battleSfx?.play(SFX.MANA_SHORT, cmd.slotIndex);
        }
        q.length = 0;
    }

    emptiestLane() {
        let best = 0;
        let bestScore = Infinity;
        for (let i = 0; i < LANES.ground.length; i++) {
            const l = this.sim.lanes[i];
            let threat = 0;
            for (const e of l.enemies) threat += e.hp;
            const score = l.allies.length * 300 - threat;
            if (score < bestScore) {
                bestScore = score;
                best = i;
            }
        }
        return best;
    }

    /* ── 스토어 구독 ────────────────────────────────────────── */

    setupSubscriptions() {
        this._unsubs.push(
            gameStore.subscribe(
                (s) => s.phase,
                (phase) => {
                    // 씬이 아직/이미 살아 있지 않으면 무시한다 (전환 중 재진입 방어)
                    if (!this.sys?.isActive?.() && !this.sys?.isPaused?.()) return;
                    if (phase === "paused") this.scene.pause();
                    else if (phase === "battle" && this.scene.isPaused()) this.scene.resume();
                }
            )
        );

        this._unsubs.push(
            gameStore.subscribe(
                (s) => s.settings.screenShake,
                () => this.cameraFx.setShakeScale(this.shakeScaleFor(gameStore.get().settings))
            )
        );

        /**
         * 품질 티어 (26-performance-budget.md §4).
         *
         * ★ **다음 전투부터 적용됩니다** 로 두지 않는다. 사용자에게 그것은
         *   "설정이 안 먹는다"와 구별되지 않는다 — 이 저장소가 방금 고친 결함이
         *   정확히 그 모양(저장되지만 아무 일도 없는 키)이었다.
         *   그래서 넷 다 그 자리에서 반영한다.
         */
        this._unsubs.push(
            gameStore.subscribe(
                (s) => s.settings.qualityTier,
                (v) => this.applyQuality(v)
            )
        );

        this._unsubs.push(
            gameStore.subscribe(
                (s) => s.settings.damageNumbers,
                (v) => this.dmgText.setDensity(v)
            )
        );

        // ★ 셀렉터가 음소거를 포함한 **실효 볼륨**이다. 볼륨과 음소거를 따로
        //   구독하면 음소거 토글이 볼륨 변화로 보이지 않아 반영되지 않는다.
        this._unsubs.push(
            gameStore.subscribe(
                (s) => bgmLevel(s.settings),
                (v) => this.audio.setVolumes({ bgmVolume: v })
            )
        );
        this._unsubs.push(
            gameStore.subscribe(
                (s) => sfxLevel(s.settings),
                (v) => this.audio.setVolumes({ sfxVolume: v })
            )
        );

        /* ── 접근성 · 그래픽 (P7-15) ── */
        this._unsubs.push(
            gameStore.subscribe(
                (s) => s.settings.effectIntensity,
                (v) => this.fx.setIntensity(v)
            )
        );
        this._unsubs.push(
            gameStore.subscribe(
                (s) => s.settings.hitStop,
                (v) => this.cameraFx.setHitStopEnabled(v)
            )
        );
        this._unsubs.push(
            gameStore.subscribe(
                (s) => s.settings.colorBlindMode,
                (v) => this.dmgText.setColorBlind(v)
            )
        );

        // 전투 속도 · 자동 진행 속도는 서로를 덮으므로 한 곳에서 계산한다
        this._unsubs.push(
            gameStore.subscribe(
                (s) => s.settings,
                (v) => this.applySpeedSetting(v)
            )
        );
    }

    /**
     * 실효 셰이크 강도 = 접근성 설정 × 품질 티어 배율.
     *
     * ★ 곱셈이다. 티어가 셰이크를 **되살리지 못하게** 하려면 접근성 값이 0 일 때
     *   결과도 0 이어야 한다. 두 값 중 하나를 고르는 식(`??`)으로 두면 저사양
     *   티어가 "끄기"를 덮어쓴다.
     */
    shakeScaleFor(settings) {
        return (settings?.screenShake ?? 1) * (this.quality?.shake ?? 1);
    }

    /**
     * 품질 티어를 살아 있는 전투에 반영한다.
     * ★ 값은 데이터가 정하고(`data/quality.json`) 여기는 넘겨 주기만 한다.
     */
    applyQuality(tierSetting) {
        this.quality = qualityOf(tierSetting);
        this.fx?.setCapacity(this.quality.effects);
        this.dmgText?.setCapacity(this.quality.dmgText);
        this.parallax?.setLayerCount(this.quality.bgLayers);
        this.cameraFx?.setShakeScale(this.shakeScaleFor(gameStore.get().settings));
    }

    /**
     * 시뮬 배속을 설정에서 계산해 적용한다.
     *
     * ★ 자동 진행(오토)일 때는 **자동 진행 속도**가 전투 속도를 덮는다.
     *   두 값이 각자 setSpeed 를 부르면 마지막에 바뀐 쪽이 이기는 경합이 된다.
     *   운동 접근성(최소 조작 플레이)의 체감 속도를 사용자가 따로 정할 수 있어야
     *   하므로 값을 합치지는 않는다 — 대신 우선순위를 여기 한 곳에 못 박는다.
     */
    applySpeedSetting(settings) {
        const s = settings ?? {};
        this.setSpeed(s.autoCommander ? (s.autoAdvanceSpeed ?? 1) : (s.battleSpeed ?? 1));
    }

    /* ── 메인 루프 ──────────────────────────────────────────── */

    update(time, delta) {
        this.cameraFx.update(delta);
        this.parallax.update(delta);

        if (this.sim.phase === "battle") {
            this.runSimulation(delta);
        } else if (this.sim.phase === "draft" && !this._draftOpen) {
            // 시뮬이 드래프트에서 멈췄다 — React 에 선택 UI 를 띄우라고 알린다
            this._draftOpen = true;
            this.emitDraftState();
        }
        if (this.sim.phase !== "draft") this._draftOpen = false;

        this.presenter.sync(this.sim, time);
        this.badges.sync(this.sim, this.presenter, time);
        /**
         * ★ 데미지 숫자는 **트윈을 쓰지 않는다** — 여기서 굴린다.
         *   왜 그렇게 했는지는 `pools/DamageTextPool.js` 머리말에 있다.
         *   이 한 줄이 빠지면 숫자가 뜬 자리에 **얼어붙는다.**
         */
        this.dmgText.update(delta);
        this.commander.sync(this.sim, time);
        this.blockFx.sync(this.sim, time);
        // ★ 장판 피해는 데미지 숫자를 띄우지 않는다 — 이 한 줄이 그 규칙의 유일한 설명이다
        this.plagueFx.sync(this.sim, time);
        this.syncProjectiles();
        this.drawRift(time);
        this.structures?.sync(this.sim);
        this.bossFx?.sync(this.sim, time);
        this.throttledSync(delta);
    }

    runSimulation(delta) {
        // ★ 250ms 클램프 — resume 후 밀린 delta 를 한 프레임에 몰아 계산하는 사고 방지
        const scaled = Math.min(delta, MAX_DELTA_MS) * this.speedMultiplier * this.cameraFx.timeScale;
        this._acc += scaled;

        // ★ 입력은 step() 내부(이벤트 큐 리셋 직후)에서 적용된다.
        //   틱 밖에서 소환하면 그 SPAWN 이벤트가 지워져 연출이 사라진다.
        if (!this._applyInputs) {
            this._applyInputs = (sim) => {
                this.applyQueuedInputs();
                if (gameStore.get().settings.autoCommander) autoPlayTick(sim);
            };
        }

        let steps = 0;
        /**
         * ★ 틱 실행 시간 계측 — **개발 빌드에서만** (22-simulation-spec.md §7).
         *   `import.meta.env.DEV` 는 빌드 시 리터럴이라 배포에서는 이 두 줄이
         *   통째로 접힌다. 스토어 플래그로 감추면 번들에 남는다 (P8-06).
         */
        const t0 = import.meta.env.DEV ? performance.now() : 0;
        while (this._acc >= TICK_MS && steps < MAX_TICKS_PER_FRAME) {
            step(this.sim, this._applyInputs);
            this.consumeEvents();
            this._acc -= TICK_MS;
            steps++;
            if (this.sim.phase !== "battle") break;
        }
        if (import.meta.env.DEV && steps > 0) {
            // 지수 이동 평균 — 배열을 쌓지 않는다 (절대규칙 7)
            const per = (performance.now() - t0) / steps;
            this.avgTickMs = this.avgTickMs === undefined ? per : this.avgTickMs * 0.9 + per * 0.1;
        }
        if (steps === MAX_TICKS_PER_FRAME) this._acc = 0; // 따라잡기 포기

        // ★ 전투를 끝내는 것은 승/패뿐이다.
        //   "battle 이 아니면 종료"로 두면 **각인 드래프트(phase='draft')가
        //   전투를 즉시 패배로 끝낸다.** 드래프트는 전투를 *멈추는* 상태이지
        //   끝내는 상태가 아니다.
        //   유닛 테스트는 runToCompletion 이 draft 를 직접 처리하므로 이 경로를
        //   타지 않는다 — 실제 플레이에서만 드러난다.
        if (isTerminalPhase(this.sim.phase)) this.finishBattle();
        // 드래프트로 멈췄으면 누적 델타를 버린다.
        // 안 버리면 선택하는 동안 쌓인 시간이 재개 순간 한꺼번에 소비된다.
        if (this.sim.phase === "draft") this._acc = 0;
    }

    /**
     * 시뮬 이벤트를 연출로 변환한다.
     * ★ 이 큐가 시뮬과 렌더의 유일한 접점이다.
     *
     * ★ **아직 소비하지 않은 것만** 처리한다 (`drainEvents`).
     *   step() 뒤와 chooseSigil() 뒤 양쪽에서 불리는데, 후자는 큐가 비워지지 않은
     *   상태에서 불린다 — 0번부터 훑으면 직전 틱이 두 번 연출된다.
     */
    consumeEvents() {
        drainEvents(this.sim.events, this._evReader, this._onSimEvent);
    }

    /** 이벤트 1건 → 연출. `drainEvents` 만 호출한다. */
    dispatchEvent(e) {
        // ★ 소리는 별도 모듈이 받는다 (fx/BattleSfx.js). 이 switch 를 넓히지 않는다.
        this.battleSfx?.onEvent(e);
        switch (e.type) {
            case EV.SPAWN:
                this.onSpawn(e);
                break;
            case EV.ATTACK:
                this.onAttack(e);
                break;
            case EV.DAMAGE:
                this.onDamage(e);
                break;
            case EV.HEAL:
                this.onHeal(e);
                break;
            case EV.DEATH:
                this.onDeath(e);
                break;
            case EV.BREACH:
                this.onBreach(e);
                break;
            case EV.TEMPO_SHIFT:
                this.onTempoShift();
                break;
            // 지휘관 평타 — a=대상id b=레인 c=지휘관x (20-commander-combat.md §5)
            case EV.COMMANDER_ATTACK:
                this.onCommanderAttack(e);
                break;
            /**
             * ★★★ **지휘관 주문 · 기절 · 복귀** (2026-08-07).
             *   셋 다 시뮬은 4개월간 방출하고 있었고 **소비처가 0개**였다.
             *   주문은 성공해도 전장이 무음이었고(실패해야만 화면이 흔들렸다),
             *   지휘관이 쓰러지는 순간 — 8초간 오라가 통째로 사라지는, 전투에서
             *   가장 큰 단일 사건 — 에도 화면은 아무 말도 하지 않았다.
             */
            case EV.SPELL_CAST:
                this.onSpellCast(e);
                break;
            case EV.COMMANDER_DOWN:
                this.onCommanderDown();
                break;
            case EV.COMMANDER_UP:
                this.onCommanderUp();
                break;
            // ── 보스 페이즈 (P6-05) ──
            case EV.MODE_BOSS_PHASE_TELEGRAPH:
                this.bossFx?.onPhaseTelegraph(e.b, e.c, e.d, this.time.now);
                break;
            case EV.MODE_BOSS_PHASE:
                this.bossFx?.onPhase(e.b, e.c, e.d);
                break;
            case EV.MODE_BOSS_SLAM:
                this.bossFx?.onSlam();
                break;
            /**
             * ── 나이트메어 ② 결박 파열 (22-nightmare.md §3) ──
             *
             * ★ **기존 이펙트 프로파일을 재사용한다.** 규칙 하나에 새 이펙트를 만들면
             *   저사양 티어의 동시 이펙트 예산(12)을 그만큼 먹는다.
             * ★ 예고는 "정보 전달 시간"이므로 보스 슬램과 **같은 규약**이다 —
             *   예고가 읽히지 않으면 파열은 그냥 "적이 방벽을 통과한 버그"로 보인다.
             */
            case EV.NIGHTMARE_BOND_TELEGRAPH:
                this.onBondTelegraph(e);
                break;
            case EV.NIGHTMARE_BOND_BREAK:
                this.onBondBreak(e);
                break;
            // ── 도감 (P7-14) — 획득한 각인·진화만 기록한다 ──
            case EV.SIGIL_TAKEN:
                this._codex.sigils.add(e.s);
                break;
            case EV.EVOLUTION:
                this._codex.evolutions.add(e.s);
                break;
            default:
                break;
        }
    }

    onSpawn(e) {
        // 도감 해금 — e.c 는 진영(1 아군 / 0 적). 실제로 화면에 나온 적만 연다.
        if (e.c === 0) this._codex.enemies.add(e.s);

        const ent = this.findEntity(e.a);
        if (!ent) return;
        // ★ 진영을 함께 본다 — 아군·적에 같은 id 가 10종 있다 (init() 주석)
        const def = (e.c === 1 ? this._allyDefs : this._enemyDefs).get(e.s);
        if (!def) return;
        const y = ent.lane === AIR_LANE ? LANES.air.y : LANES.ground[ent.lane].y;
        this.presenter.spawn(ent, def, y);
    }

    /**
     * 지휘관 평타 연출.
     * ★ 대상이 이미 죽어 사라졌어도 지휘관의 돌진은 그린다 — 입력에 대한 반응이
     *   사라지면 "안 때린 것"으로 보인다.
     */
    onCommanderAttack(e) {
        const y = LANES.ground[e.b]?.y ?? LANES.ground[1].y;
        const tgt = this.findEntity(e.a);
        this.commander?.playAttack(tgt ? tgt.x : e.c + 40, y, e.c);
    }

    /**
     * ★★★ **지휘관 주문 연출** (2026-08-07, 사용자 요청).
     *
     *   페이로드는 `logic/spells.js:castSpell` 이 싣는다:
     *     a=대상레인 · b=지휘관x · c=영향받은 대상 수 · s=주문id
     *
     * ★ 무엇을 그릴지는 **데이터가 정한다** (`presenters.json:commander.spells`).
     *   여기서 주문 id 로 분기하면 주문을 하나 더할 때마다 씬을 고쳐야 하고,
     *   그 순간 "선언했는데 아무도 안 읽는 데이터"가 다시 태어난다.
     *
     * ★★ **대상이 없어도 연출은 낸다 — 다만 줄인다.** 허공에 쓴 주문에 아무 반응이
     *   없으면 그것은 "실패"로 읽히는데, 실제로는 균열력을 쓰고 쿨다운이 걸린
     *   **성공**이다. 그 둘을 화면이 구분하지 못하면 플레이어는 버튼을 불신한다.
     */
    onSpellCast(e) {
        const P = presenterData.commander.spells;
        const prof = P[e.s] ?? P.$default;
        if (!prof?.effect) return;

        const lane = e.a;
        const y = LANES.ground[lane]?.y ?? LANES.ground[1].y;
        const cx = e.b;
        // ★ 대상 0 이면 규모를 줄인다 (연출은 내되 "뭔가 맞았다"고 거짓말하지 않는다)
        const hit = e.c > 0;
        /**
         * ★★ 재사용 객체다 (절대규칙 7). `EffectSystem.play` 는 opts 를 붙들지 않고
         *   그 자리에서 읽는다 — `CMD_FX_OPTS` 와 같은 규약이다.
         * ★ `tint` 는 **모양 위에 얹는 2차 단서**다 (색만으로 구분하지 않는다).
         *   값이 없으면 `undefined` 를 넣어 EffectSystem 이 월드 색보정으로 떨어지게 한다.
         */
        SPELL_FX_OPTS.scale = (prof.scale ?? 1) * (hit ? 1 : 0.6);
        SPELL_FX_OPTS.tint = prof.tint ? Number(prof.tint) : undefined;
        const opts = SPELL_FX_OPTS;

        if (prof.shape === "lane") {
            /**
             * 레인을 따라 방주 → 균열 방향으로 나눠 터뜨린다.
             * ★ 배열을 만들지 않는다 (절대규칙 7) — 인덱스 산술만 쓴다.
             * ★ 횟수는 데이터가 정한다. 저사양 티어의 동시 이펙트 예산(12)을
             *   한 번에 먹지 않도록 3을 넘기지 않게 데이터에 적어 두었다.
             */
            const n = Math.max(1, prof.count ?? 1);
            const from = LANES.arkX + 120;
            const span = LANES.riftX - 80 - from;
            for (let i = 0; i < n; i++) {
                const x = from + (span * (i + 0.5)) / n;
                this.fx.play(prof.effect, x, y, opts);
            }
        } else if (prof.shape === "aura") {
            // 오라 반경 위 — "여기까지 걸렸다"가 곧 그 주문의 규칙이다
            const r = this.sim.commander.auraRadius;
            const base = SPELL_FX_OPTS.scale;
            SPELL_FX_OPTS.scale = base * 1.2;
            this.fx.play(prof.effect, cx, y, opts);
            SPELL_FX_OPTS.scale = base * 0.7;
            this.fx.play(prof.effect, cx - r * 0.7, y, opts);
            this.fx.play(prof.effect, cx + r * 0.7, y, opts);
            SPELL_FX_OPTS.scale = base;
        } else if (prof.shape === "target") {
            /**
             * 대상마다 하나씩. **처형처럼 "누가 죽었는가"가 곧 정보인 주문**만 이 모양이다.
             * ★ 상한을 둔다 — 스웜 20마리를 한 프레임에 터뜨리면 이펙트 예산이 통째로
             *   날아가고, 그 판은 정확히 가장 무거운 판이다.
             */
            const enemies = this.sim.lanes[lane]?.enemies ?? [];
            let n = 0;
            for (let i = 0; i < enemies.length && n < 6; i++) {
                const en = enemies[i];
                if (en.hp > 0) continue; // 이번 주문으로 죽은 것들
                this.fx.play(prof.effect, en.x, y, opts);
                n++;
            }
            if (n === 0) this.fx.play(prof.effect, cx, y, opts);
        } else {
            // self — 지휘관 발밑
            this.fx.play(prof.effect, cx, y, opts);
        }

        if (prof.shake) this.cameraFx.shake(prof.shake, 120);
        if (prof.hitStop) this.cameraFx.hitStop(prof.hitStop);
    }

    /**
     * 지휘관 기절 — 8초간 오라가 사라진다. **전투에서 가장 큰 단일 사건**이다.
     * ★ 그런데 화면에 있던 것은 스프라이트 알파 0.3 과 머리 위 "재출격 N" 뿐이었고,
     *   HUD 의 금색 바는 10Hz 동기화 뒤에야 0 이 된다 — 사건이 일어난 그 순간에는
     *   아무 일도 일어나지 않았다.
     */
    onCommanderDown() {
        const p = presenterData.commander.down;
        const c = this.sim.commander;
        const y = LANES.ground[c.lane]?.y ?? LANES.ground[1].y;
        if (p?.effect) this.fx.play(p.effect, c.x, y, { scale: p.scale ?? 1 });
        if (p?.shake) this.cameraFx.shake(p.shake, 220);
        if (p?.hitStop) this.cameraFx.hitStop(p.hitStop);
    }

    onCommanderUp() {
        const p = presenterData.commander.up;
        const c = this.sim.commander;
        const y = LANES.ground[c.lane]?.y ?? LANES.ground[1].y;
        if (p?.effect) this.fx.play(p.effect, c.x, y, { scale: p.scale ?? 1 });
    }

    onAttack(e) {
        const tgt = this.findEntity(e.b);
        const atk = this.findEntity(e.a);
        if (!atk) return;
        const y = e.c === AIR_LANE ? LANES.air.y : LANES.ground[e.c]?.y ?? LANES.ground[1].y;
        this.presenter.playAttack(e.a, tgt ? tgt.x : atk.x + 40, y, atk.dmgType);
    }

    onDamage(e) {
        /**
         * ★★★ **지휘관은 엔티티가 아니다** (2026-08-05).
         *   `s.actives` 에 없으므로 `findEntity` 도 스프라이트 맵도 그를 모른다.
         *   예약 id 로 갈라내지 않으면 적이 지휘관을 때리는 것이 **화면에서
         *   완전히 무음**이 된다 — 알 수 있는 것은 갑자기 뜨는 "재출격 8" 뿐이다.
         *   (b=피해 · c=레인 — `logic/commanderHit.js:damageCommander`)
         */
        if (e.a === COMMANDER_ID) {
            const y = LANES.ground[e.c]?.y ?? LANES.ground[1].y;
            this.commander?.playHurt();
            this.dmgText.show(this.sim.commander.x, y - 72, e.b, {});
            return;
        }
        const spr = this.presenter.sprites.get(e.a);
        const kind = e.d; // 0 일반 / 1 무효 / 2 약점 / 3 저항 / 4 크리티컬
        this.presenter.playHurt(e.a, kind === 2);

        if (spr) {
            this.dmgText.show(spr.x, spr.y - spr.displayHeight, e.b, {
                /**
                 * ★★★ **때린 쪽의 타입이다** (2026-08-07 수정).
                 *   여기는 `ent?.dmgType` 이었는데 `ent = findEntity(e.a)` 이고
                 *   `e.a` 는 **맞은 쪽**의 id 다 (바로 위 `playHurt(e.a)` 가 증거).
                 *   그래서 지휘관의 물리 평타가 술식 적 위에서 파란 숫자로 떴고,
                 *   색약 모드의 접두("물/술/신")도 통째로 반대였다 —
                 *   `DamageTextPool` 이 색약을 위해 만든 장치가 정반대로 작동했다.
                 *   지금은 `logic/engage.js:applyDamage` 가 `e.s` 로 실어 보낸다.
                 * ★ `ent?.dmgType` 폴백을 남기지 않는다. 남기면 값이 빈 경로에서
                 *   조용히 옛 동작으로 돌아가고, 그 경로를 아무도 못 본다.
                 */
                dmgType: e.s || undefined,
                absorbed: kind === 1,
                effective: kind === 2,
                resisted: kind === 3,
                crit: kind === 4,
            });
        }
        // ★ 크리티컬 연출 — 19-art-audio-direction.md §: 히트스톱 70ms + 셰이크 2px
        if (kind === 4) {
            this.cameraFx.hitStop(70);
            this.cameraFx.shake(2, 100);
            /**
             * ★★ 진동 (19-art-audio-direction.md §6.5 — 크리티컬 = Medium).
             *   빈도 상한(초당 3회)은 `native/haptics.js` 가 이미 갖고 있다.
             *   여기서 또 세지 않는다 — 상한이 두 곳에 생기면 둘이 갈라지고,
             *   무엇보다 스웜 20마리의 크리티컬을 막는 것은 저쪽의 책임이다.
             */
            hapticHit();
        }
    }

    onHeal(e) {
        const spr = this.presenter.sprites.get(e.a);
        if (!spr) return;
        this.dmgText.show(spr.x, spr.y - spr.displayHeight, e.b, { heal: true });
        this.fx.play("heal", spr.x, spr.y - 24, { scale: 0.8 });
    }

    onDeath(e) {
        /**
         * e.c 는 진영(1 아군 / 0 적) — 도감의 처치 카운트는 적만 센다.
         * ★ e.d 는 사유다. 보스 처치 후 잔챙이 정리(`modes.js:despawnAdds`)로
         *   사라진 적은 **잡은 적이 아니다.** 세면 도감이 거짓말을 한다.
         */
        const killed = e.d !== DEATH_CAUSE.DESPAWNED;
        if (e.c === 0 && e.s && killed) {
            this._codex.kills.set(e.s, (this._codex.kills.get(e.s) ?? 0) + 1);
        }
        this.presenter.playDeath(e.a);
        this.badges.remove(e.a);
    }

    /**
     * 결박 파열 예고 — `telegraphMs` 동안 "곧 끊긴다"를 알린다.
     * ★ 지속 시간은 **시뮬이 준다**(`e.d`). 여기서 숫자를 정하면 데이터를 고쳐도
     *   예고 길이가 안 따라온다 (절대규칙 4).
     */
    onBondTelegraph(e) {
        const y = LANES.ground[e.b]?.y ?? LANES.ground[1].y;
        this.fx.play("rift_pulse", e.c, y, { scale: 0.7 });
    }

    /** 파열 — 개체당 한 번뿐이라 히트스톱 없이 짧게 터뜨린다 */
    onBondBreak(e) {
        const y = LANES.ground[e.b]?.y ?? LANES.ground[1].y;
        this.fx.play("impact_blunt", e.c, y, { scale: 1.1 });
        this.cameraFx.shake(2, 90);
    }

    onBreach(e) {
        const y = e.c === AIR_LANE ? LANES.air.y : LANES.ground[e.c]?.y ?? LANES.ground[1].y;
        this.presenter.remove(e.a);
        this.badges.remove(e.a);
        this.fx.play("breach", LANES.arkX + 16, y, { scale: 1.2 });
        this.cameraFx.shake(5, 200);
        this.cameraFx.hitStop(50);
        this.cameraFx.damageFlash();
        /**
         * ★ 진동 (§6.5 — 방주 피격 = Medium).
         *   섬광은 접근성 설정으로 끌 수 있고 소리는 음소거될 수 있다.
         *   "방주가 맞았다"는 이 게임에서 유일하게 되돌릴 수 없는 사건이므로
         *   채널을 하나 더 준다 — 그리고 이 채널도 설정으로 끌 수 있다
         *   (`설정 > 접근성 > 진동` → App → setHapticsEnabled).
         */
        hapticHit();
    }

    onTempoShift() {
        this.cameraFx.zoomPulse(1.06, 220, 80);
        this.cameraFx.shake(4, 300);
        this.cameraFx.hitStop(200);
        this.fx.play("rift_pulse", LANES.riftX, LANES.ground[1].y, { scale: 2 });
        // ★ 곡을 바꾸지 않고 레이어를 얹는다 — 끊김 없이 강도가 오른다
        this.audio.enterTempoShift();
        EventBus.emit("tempo-shift");
    }

    findEntity(id) {
        const a = this.sim.actives;
        for (let i = 0; i < a.length; i++) {
            if (a[i].id === id) return a[i];
        }
        return null;
    }

    /* ── 발사체 · 균열 ──────────────────────────────────────── */

    /**
     * 발사체 **뷰**(프레임 · 애니메이션 키 · 배율)를 정의마다 미리 만들어 둔다.
     *
     * ★★★ 여기서 **모양(데이터) × 색(데미지 타입)** 을 합친다 (2026-08-05).
     *   유닛 데이터는 `art.projectile.shape` 만 적고, 시트는
     *   `fx.json:projectileSheet[dmgType]` 이 정한다 — `projectileAnim.js` 참조.
     *
     * ★★ `update()` 안에서 만들지 않는다. 프레임 이름도 애니메이션 키도 문자열
     *   결합이 필요한데, 그것이 매 프레임 · 발사체 수만큼 일어나면 규칙 7 위반이다.
     *   여기서 **defId → 뷰** 맵을 채워 두면 런타임에는 `Map.get` 하나다.
     *
     * ★ 등장할 수 있는 정의는 create() 시점에 전부 알 수 있다 — 편성과 적 정의가
     *   이미 들어와 있고, 나머지는 기본값뿐이다.
     *
     * ★ 진영별로 나눈 맵을 그대로 쓴다. 같은 id 의 아군·적이 서로 다른 dmgType 을
     *   가질 수 있고, 그러면 같은 모양이라도 **색이 달라야** 한다.
     *
     * ★★ **적도 쏜다** (2026-08-05). 그 전까지는 아군뿐이었다 — 그때
     *   `logic/roles.js:PROJECTILE_ROLES` 는 RANGED·CASTER·SIEGE 뿐이었는데
     *   `enemies.json` 에 `role` 이 한 종도 없어 62/62 가 MELEE 로 정규화됐고,
     *   사거리 120–190 짜리 적 11종이 **즉발로** 때렸다. 그때 이 맵을 미리 만들어
     *   둔 덕에 고친 것은 데이터뿐이고 이 파일은 한 줄도 바뀌지 않았다.
     *   같은 날 오후 **아군 비행 4종**(FLYER)이 목록에 들어갔을 때도 마찬가지였다.
     */
    registerProjectileAnims() {
        this._projAlly = new Map();
        this._projEnemy = new Map();
        // 같은 (시트, 모양) 을 여러 유닛이 쓰므로 뷰는 재사용한다
        const cache = new Map();

        const view = (art, dmgType) => {
            const src = art ?? this.projArt;
            const atlas = src.atlas ?? this.projArt.atlas;
            const shape = src.shape ?? this.projArt.shape;
            const frame = projectileFrame(fxData.projectileSheet, dmgType, shape);
            // 배정이 없으면 기본 뷰로 떨어진다 (data:validate 가 오류로 잡는다)
            if (!frame) return this._projDefault ?? null;

            const cacheKey = `${atlas}|${frame}`;
            const hit = cache.get(cacheKey);
            if (hit) return hit;

            const tex = this.textures.get(atlas);
            const frames = clipFrames(tex ? tex.getFrameNames() : [], frame);
            // 프레임이 하나뿐인 종류는 애니메이션을 만들지 않는다 — 정지 프레임으로 둔다
            let key = null;
            if (frames.length > 1) {
                key = `proj:${atlas}:${frames[0]}`;
                // ★ `this.anims` 는 **게임 전역**이다. 씬을 다시 들어와도 남아 있으므로
                //   있으면 다시 만들지 않는다 (중복 생성은 Phaser 가 경고만 하고 무시한다).
                if (!this.anims.exists(key)) {
                    this.anims.create({
                        key,
                        frames: frames.map((f) => ({ key: atlas, frame: f })),
                        frameRate: PROJ_FPS,
                        repeat: -1,
                    });
                }
            }
            /**
             * ★★ 뒤집기 여부도 **여기서 미리** 정한다 (`projectileAnim.js:flipPlan`).
             *   `update()` 에서 문자열(`"right"`)을 비교하면 발사체 수만큼 분기가
             *   생기고, 무엇보다 방향 규칙이 데이터가 아니라 씬으로 새어 들어온다.
             */
            const flip = flipPlan(fxData.shapeFacing?.[shape]);
            const v = {
                frame,
                key,
                scale: src.scale ?? this.projArt.scale ?? 1,
                flipLeft: flip.left,
                flipRight: flip.right,
            };
            cache.set(cacheKey, v);
            return v;
        };

        // 기본값 먼저 — 배정이 빠진 정의가 여기로 떨어진다.
        // ★ 이것이 null 이 되는 것은 `fx.json` 이 깨졌다는 뜻이고, 그때는
        //   발사체를 **아예 그리지 않는다** — 프레임 없는 스프라이트는 시트 전체를
        //   그려서 화면을 뒤덮기 때문이다. `data:validate` 가 먼저 잡는다.
        this._projDefault = view(this.projArt, "physical");
        for (const [id, d] of this._allyDefs) this._projAlly.set(id, view(d.projectile, d.dmgType));
        for (const [id, d] of this._enemyDefs) this._projEnemy.set(id, view(d.projectile, d.dmgType));
    }

    syncProjectiles() {
        const list = this.sim.projectiles;
        const pool = this.projPool;

        /**
         * ★★★ **게임이 영원히 멈추던 자리다** (2026-08-05, 사용자 제보 —
         *   "1-14 13웨이브쯤에서 멈추고, 버튼조차 눌리지 않는다").
         *
         *   예전 코드:
         *       while (pool.activeCount < list.length) { const s = pool.acquire(); if (!s) break; }
         *
         *   `SpritePool.acquire()` 는 `free` 가 비면 **최고령 활성분을 회수한다** —
         *   `active.shift()` 로 빼서 `active.push()` 로 도로 넣는다. 즉 **`activeCount`
         *   가 변하지 않는다.** 그런데 위 루프의 조건은 그 값이고, `acquire()` 는
         *   null 도 아니다. 발사체 수가 풀 크기를 넘는 순간 **조건이 영원히 참이고
         *   탈출도 없다 — 메인 스레드가 통째로 멈춘다.**
         *
         *   증상이 정확히 그것이었다: 영구 정지 · UI 도 안 눌림(무한 루프라 이벤트
         *   루프가 돌지 않는다) · 후반 웨이브(발사체가 가장 많을 때) · 간헐적
         *   (그 수를 넘느냐 마느냐). 프레임 최적화로는 절대 고쳐지지 않는 종류다.
         *
         * ★ 그래서 **조건 루프를 없앤다.** 필요한 수는 처음부터 알고 있다:
         *   `min(발사체 수, 풀 크기)`. 상한이 있는 for 루프는 구조적으로 끝난다.
         *
         * ★ 풀이 모자라면 **그리지 못한 발사체 수를 센다.** 조용히 덜 그리는 것은
         *   이 저장소가 계속 잡아 온 침묵이다 (`stats.spawnDropped` 와 같은 규약).
         */
        const want = Math.min(list.length, pool.size);
        for (let n = pool.activeCount; n > want; n--) {
            pool.release(pool.active[pool.active.length - 1]);
        }
        for (let n = pool.activeCount; n < want; n++) {
            if (!pool.acquire()) break;
        }
        this._projUndrawn = list.length - pool.activeCount;

        for (let i = 0; i < list.length && i < pool.active.length; i++) {
            const p = list[i];
            const s = pool.active[i];
            const y = p.lane === AIR_LANE ? LANES.air.y : LANES.ground[p.lane].y;
            /**
             * ★★★ **위치를 반드시 여기서 준다.** 이 한 줄이 빠져 있었다 —
             *   애니메이션을 걷어내는 편집에서 같이 지워졌고, 그 결과 발사체 60개가
             *   전부 월드 원점(0,0)에 겹쳐 멈춰 있었다. 풀이 스프라이트를 (0,0)에서
             *   만들기 때문에 "안 보인다"가 아니라 "왼쪽 위 구석에 뭉쳐 있다"였다.
             *   lint 의 `y is assigned but never used` 가 유일한 흔적이었다.
             */
            s.setPosition(p.x, y);
            /**
             * ★★ 발사체 그림은 **쏜 유닛마다 다르다.**
             *   원거리 12종이 전부 같은 화염탄을 쏘고 있었다 — 누가 쏘는지,
             *   무엇이 날아오는지가 화면에서 구분되지 않으면 원거리 조합의
             *   차이가 감각으로 전달되지 않는다.
             *
             * ★ 진영으로 맵을 고른다 — 아군·적에 같은 id 가 10종 있다.
             * ★ 뷰는 create() 에서 다 만들어 뒀다: 여기서는 `Map.get` 하나이고
             *   문자열 결합도 배열 생성도 없다 (규칙 7).
             *
             * ★★★ **틴트를 걸지 않는다** (2026-08-05). 색은 이미 시트가 갖고 있다.
             *   예전엔 여기서 주황 원본에 술식 파랑(0x6ab0ff)을 곱했는데, 곱셈
             *   틴트라 rgb(102,107,39) — 파랑이 아니라 탁한 올리브가 나왔다.
             *   그래서 "발사체 색이 다 비슷하다"였다.
             */
            const view = (p.isAlly ? this._projAlly : this._projEnemy).get(p.defId) ?? this._projDefault;
            // 뷰가 없다 = fx.json 이 깨졌다. 프레임 없는 스프라이트는 시트 전체를
            // 그려 화면을 뒤덮으므로 아무것도 그리지 않는다 (data:validate 가 먼저 잡는다).
            if (!view) {
                s.setVisible(false);
                continue;
            }
            // ★ 배율은 데이터가 정한다 (`fx.json` / `units.json` 의 `art.scale`).
            //   유닛이 ×2 인데 발사체만 ×1 이면 픽셀 밀도 위계가 깨진다.
            s.setScale(view.scale);
            /**
             * ★★ 애니메이션은 **연속된 열 구간**으로만 만든다 — `projectileAnim.js`.
             *   한 행에 종류가 둘이라 행 전체를 재생하면 다른 탄환이 섞여 깜빡인다.
             *
             * ★★ 정지 프레임으로 떨어질 때 **먼저 애니메이션을 멈춘다.** 풀에서
             *   돌려쓰는 스프라이트라, 앞 종류의 루프가 돌고 있으면 `setFrame` 이
             *   다음 프레임에 곧바로 덮인다 — 이전 종류의 그림을 물고 간다.
             */
            if (view.key) s.play(view.key, true); // 같은 애니메이션이 이미 돌면 다시 시작하지 않는다
            else {
                s.stop();
                s.setFrame(view.frame);
            }
            /**
             * ★★★ **그림이 향한 쪽을 진행 방향에 맞춘다** (2026-08-05).
             *
             *   예전에는 `setFlipX(p.vx < 0)` 한 줄이었다. 그런데 담겨 있던 그림
             *   16종 중 좌우 방향이 있는 것은 화살촉 하나뿐이고 나머지는 방사 대칭
             *   이라, 뒤집어도 화면에 아무 변화가 없었다 — 사용자 제보 "반대로 쏘면
             *   방향도 바뀌어야 하는데 날아가는 방향만 바뀐다"의 정체다. 방향성
             *   탄환이 있는 **열 26-29 를 새로 담고** 방향을 데이터로 옮겼다.
             *
             * ★★ **대칭 그림은 뒤집지 않는다.** 이 시트의 그림 상당수가 16×16 칸
             *   안에서 x 로 치우쳐 있고 flipX 는 칸 중심 기준이라, 대칭인 그림도
             *   뒤집으면 화면에서 1~3px 옆으로 튄다. 얻는 것 없이 튐만 생긴다.
             *   그래서 `flipLeft`/`flipRight` 를 **뷰마다 미리** 정해 둔다.
             *
             * ★ 회전이 아니라 뒤집기인 근거는 `projectileAnim.js:flipPlan` 에 있다
             *   (발사체에 `vy` 가 없어 진행 각도가 0°/180° 뿐이다).
             */
            s.setFlipX(p.vx < 0 ? view.flipLeft : view.flipRight);
            /**
             * ★★★ **틴트를 걸지 않는다** (2026-08-05). 색은 이미 시트가 갖고 있다.
             *   예전엔 여기서 주황 원본에 술식 파랑을 곱했는데, 곱셈 틴트라
             *   rgb(102,107,39) — 파랑이 아니라 탁한 올리브가 나왔다. 그래서
             *   "발사체 색이 다 비슷하다"였다. 풀의 `acquire()` 가 대여 시점에
             *   `clearTint()` 하므로 여기서 지울 필요도 없다.
             */
        }
    }

    drawRift(timeMs) {
        const g = this.riftGlow;
        g.clear();
        const pulse = 0.4 + 0.6 * Math.abs(Math.sin(timeMs / 700));
        const w = this.sim.tempoShifted ? 16 : 8;
        g.fillStyle(0xb45ad6, 0.18 * pulse);
        g.fillRect(LANES.riftX - w, LANES.hud.topH, w * 2, DESIGN.height - LANES.hud.bottomH - LANES.hud.topH);
    }

    /* ── 스토어 동기화 (10Hz) ──────────────────────────────── */

    throttledSync(delta) {
        this._syncAcc += delta;
        if (this._syncAcc < SYNC_MS) return;
        this._syncAcc = 0;

        /**
         * ★ 카메라가 화면 크기와 어긋났으면 되돌린다 (10Hz — 사실상 공짜).
         *   리사이즈 이벤트가 도착하지 않는 경우가 실제로 있었다. 배경도 다시 그린다.
         */
        if (resyncViewportIfDrifted(this)) this.parallax?.resize(this.viewport);

        const s = this.sim;

        /**
         * ★★★ **풀 고갈을 조용히 넘기지 않는다** (P11-03).
         *
         *   `acquireEntity`/`acquireProjectile` 은 풀이 비면 `null` 을 돌려주고
         *   호출부가 그냥 돌아간다. 그 실패는 크래시가 아니라 **침묵**이다 —
         *   가장 무거운 판에서 적이 소리 없이 사라지고, 그 판이 쉬워지고,
         *   아무 검사도 실패하지 않는다. `logic/` 은 순수해야 하므로 숫자만 남기고
         *   (절대규칙 1), **그 숫자를 보는 것은 여기다.**
         *
         * ★ 개발 빌드에서만, 그리고 **처음 한 번만** 말한다. 10Hz 로 계속 짖으면
         *   콘솔이 덮여 아무도 읽지 않는다. 헤드리스 쪽 판정은 `bench:sim` 과
         *   `sim.test.js` 가 한다.
         */
        if (import.meta.env.DEV && !this._poolWarned) {
            const dropped = (s.stats.spawnDropped ?? 0) + (s.stats.projectileDropped ?? 0);
            if (dropped > 0) {
                this._poolWarned = true;
                console.warn(
                    `[battle] 시뮬 풀 고갈 — 개체 ${s.stats.spawnDropped}체 · 탄 ` +
                        `${s.stats.projectileDropped}발이 태어나지 못했다 ` +
                        `(${this.stageId} · 웨이브 ${s.wave} · 동시 ${s.actives.length}체). ` +
                        `이 판은 그만큼 조용히 쉬워진다 — logic/state.js 의 풀 용량을 다시 재라`
                );
            }
        }

        // 슬롯별 현재 코스트 — HUD 가 밸런스 공식을 알 필요가 없게 계산해서 넘긴다
        const costs = this.cfg.loadout.map((d) => summonCost(s, d.id, d.cost));

        /**
         * 주문 재사용 대기 — **남은 비율(0~1)** (2026-08-05, 사용자 요청).
         *
         * ★★ HUD 는 시뮬 상태를 볼 수 없다. 예전에는 균열력만 보고 대략적인 활성화만
         *   그렸고, **쿨다운은 화면에 한 글자도 없었다** — 눌렀는데 아무 일도 안 나면
         *   플레이어는 균열력이 모자란 줄 안다 (그 사유 구분은 토스트가 하지만,
         *   *언제 다시 쓸 수 있는지*는 여전히 알 수 없었다).
         *
         * ★ 계산은 `logic/spells.js:cooldownPct` 가 한다 — 그 주석이 "HUD 원형 게이지"
         *   라고 적어 둔 바로 그 용도이고, 4개월간 부르는 곳이 없었다.
         *
         * ★★★ **id 로 실어 보낸다. 위치로 보내지 않는다** (2026-08-06, 사용자 제보).
         *
         *   예전에는 `equipped.map(cooldownPct)` 였고 HUD 는 `cooldowns[i]` 로 읽었다.
         *   두 목록이 같다는 **가정**이 유일한 보증이었는데, 씬이 `spells` 를 받지
         *   못해 시뮬은 기본 4종 · HUD 는 플레이어의 4종이었다. 그래서 쿨다운이
         *   남의 버튼 위에 떴다. **위치 결합은 어긋나도 아무도 실패하지 않는다** —
         *   그것이 이 저장소가 반복해서 당한 형태다.
         *
         *   id 로 보내면 목록이 어긋나도 **없는 키는 그냥 0** 이 되고, 남의 쿨다운이
         *   붙는 일은 구조적으로 불가능하다. `hud.spellCooldown.test.js` 가 지킨다.
         *
         * ★ 매 동기화마다 객체를 새로 만들지만 10Hz 이고 키는 4개다. `syncFromSim` 이
         *   값이 같으면 참조를 유지하므로 구독자는 다시 그리지 않는다.
         */
        const equipped = s.spells?.equipped ?? [];
        const cds = {};
        for (const id of equipped) cds[id] = cooldownPct(s, id);

        const obj = this.describeObjective(s);

        gameStore.get().syncFromSim({
            mana: Math.floor(s.mana),
            riftEnergy: Math.floor(s.riftEnergy),
            arkHp: Math.round(s.arkHp),
            /**
             * 지휘관 체력 — 기절 중에는 0 으로 보낸다 (2026-08-05).
             * ★ 술어를 여기서 다시 쓰지 않는다. `commanderUp` 이 단일 출처다 —
             *   죽은 그 틱에는 `downUntil` 이 아직 0 이라 시간만 보면 살아 있는
             *   것으로 읽힌다.
             */
            commanderHp: commanderUp(s) ? Math.round(s.commander.hp) : 0,
            wave: s.wave,
            tempoShifted: s.tempoShifted,
            slotCosts: costs,
            spellCooldowns: cds,
            objectiveText: obj.text,
            objectiveRatio: obj.ratio,
        });
    }

    /**
     * 모드 목표를 HUD 문자열로 요약한다.
     *
     * ★ 문자열을 씬이 만든다. HUD 가 시뮬 구조(modeState)를 알면 그때부터
     *   React 가 전투 규칙을 알게 되고, 규칙이 두 군데로 갈라진다.
     *
     * ★ 비율은 소수 둘째 자리로 끊는다. 그대로 넘기면 매 동기화마다 값이
     *   달라져 10Hz 리렌더가 항상 발생한다.
     */
    describeObjective(s) {
        const ms = s.modeState;

        switch (s.mode) {
            case "nemesis": {
                if (ms.bossId === -1) return { text: t("battle.objBossWait"), ratio: 0 };
                if (ms.bossDead) return { text: t("battle.objBossDead"), ratio: 1 };

                // ★ 페이즈를 HUD 에도 올린다. 월드의 배너는 1.3초면 사라지므로,
                //   "지금 몇 페이즈인가"를 계속 확인할 곳이 필요하다.
                //   페이즈를 놓친 플레이어가 상성을 다시 맞출 방법이 없어진다.
                const bs = ms.boss;
                const boss = bs?.e;
                if (!bs?.phases || !boss || boss.id !== bs.id) {
                    return { text: t("battle.objBossDead"), ratio: 0 };
                }
                const hp = Math.max(0, 1 - boss.hp / boss.hpMax);
                const label =
                    bs.transitionTo >= 0
                        ? t("battle.objPhaseShift")
                        : t("battle.objPhaseN", { n: bs.phaseIndex + 1 });
                return {
                    text: t("battle.objBossPhase", {
                        label,
                        pct: Math.ceil((1 - hp) * 100),
                    }),
                    ratio: Math.round(hp * 100) / 100,
                };
            }
        }
        return { text: "", ratio: 0 };
    }

    /* ── 종료 ───────────────────────────────────────────────── */

    /**
     * 도감 기록을 스토어로 넘긴다 (P7-14).
     *
     * ★ 전투 종료 **와** shutdown 양쪽에서 부른다. 중도 이탈(뒤로가기·라우트 변경)로
     *   끝나는 판이 실제로 더 흔한데, 종료 경로에만 두면 "분명히 만났는데 도감이
     *   안 열린다"가 된다. 넘긴 뒤 버퍼를 비우므로 두 번 불러도 중복 집계되지 않는다.
     */
    flushCodex() {
        const c = this._codex;
        if (!c) return;
        const kills = {};
        for (const [id, n] of c.kills) kills[id] = n;
        gameStore.get().recordCodex?.({
            enemies: [...c.enemies],
            kills,
            sigils: [...c.sigils],
            evolutions: [...c.evolutions],
        });
        c.enemies.clear();
        c.kills.clear();
        c.sigils.clear();
        c.evolutions.clear();
    }

    finishBattle() {
        if (this._finished) return;
        this._finished = true;

        this.flushCodex();

        const stars = computeStars(this.sim);
        const diag = this.sim.phase === "defeat" ? diagnoseDefeat(this.sim) : null;

        gameStore.get().endBattle(this.sim.phase);

        EventBus.emit(EVT.BATTLE_ENDED, {
            stageId: this.stageId,
            // ★ 보상 차등의 근거. 결과에 난이도를 싣지 않으면 지급 시점에
            //   스토어의 '현재 선택값'을 다시 읽게 되고, 전투 도중 난이도를
            //   바꾸면 노멀을 깨고 하드 보상을 받는 구멍이 생긴다.
            difficulty: this.cfg.difficulty,
            result: this.sim.phase,
            stars,
            arkHp: Math.round(this.sim.arkHp),
            arkHpMax: this.sim.arkHpMax,
            durationSec: Math.round(this.sim.t / 1000),
            kills: this.sim.stats.kills,
            // ★ 퀘스트 진행(P7-12)의 근거. 시뮬은 이미 세고 있었지만 결과에 싣지
            //   않아서 밖에서는 볼 수 없었다 — 씬은 퀘스트를 모르고, 퀘스트는
            //   씬을 모른다. 그 사이를 잇는 것은 이 payload 하나뿐이다.
            summons: this.sim.stats.summons,
            sigils: [...this.sim.sigils],
            diagnosis: diag,
            unkilledByTag: { ...this.sim.stats.unkilledByTag },
        });

        if (this.sim.phase === "victory") {
            this.cameraFx.zoomPulse(1.1, 300, 200);
        } else {
            // ★ 카메라를 만지는 문은 CameraFx 하나다 (접근성 설정이 여기에만 있다).
            this.cameraFx.fadeOut(600, 40, 8, 16);
        }
    }

    setSpeed(mult) {
        this.speedMultiplier = mult;
    }

    /**
     * ★ shutdown() 미구현 씬은 리뷰 반려 사유다.
     *   씬 재시작 시 리스너·트윈 중복이 이 스택의 버그 1순위 원인이다.
     *
     * ★ **init/create 가 끝나지 않은 씬에서도 안전해야 한다.**
     *   Phaser 는 시작 요청만 큐에 오른 씬에도 SHUTDOWN 을 보낸다 —
     *   라우트를 빠르게 두 번 바꾸면 실제로 그 경로를 탄다.
     *   여기서 throw 하면 그 뒤의 정리(오디오·풀·구독)가 통째로 건너뛰어지고,
     *   증상은 "BGM 이 안 꺼진다"로 나타난다. 정리 코드는 절대 던지지 않는다.
     */
    shutdown() {
        // ★ 정리 코드는 절대 throw 하지 않는다 (create 전에도 불릴 수 있다).
        try {
            this.flushCodex();
        } catch (e) {
            console.warn("[battle] 도감 기록 실패", e);
        }

        // ★ 등록한 것과 같은 함수일 때만 푼다 — 씬 전환이 겹치면 다음 전투가
        //   이미 걸어 둔 것을 지워 기록에서 맥락이 통째로 빠진다
        clearContextProvider(this._diagContext);
        this._diagContext = null;

        this._unsubs?.forEach((u) => u());
        if (this._unsubs) this._unsubs.length = 0;

        EventBus.off(EVT.REQUEST_SUMMON, this._onSummon, this);
        EventBus.off(EVT.CAST_SPELL, this._onCastSpell, this);
        EventBus.off(EVT.SIGIL_CHOOSE, this._onSigilChoose, this);
        EventBus.off(EVT.SIGIL_REROLL, this._onSigilReroll, this);
        this.input.removeAllListeners();

        this.tweens.killAll();
        this.time.removeAllEvents();

        this.audio?.destroy();
        this.battleSfx?.destroy();
        this.battleSfx = null;
        this.presenter?.destroy();
        this.badges?.destroy();
        this.commander?.destroy();
        this.blockFx?.destroy();
        this.blockFx = null;
        this.plagueFx?.destroy();
        this.plagueFx = null;
        this.bossFx?.destroy();
        this.bossFx = null;
        this.fx?.destroy();
        this.dmgText?.destroy();
        this.projPool?.destroy();
        this.structures?.destroy();
        this.structures = null;
        this.parallax?.destroy();
        this.cameraFx?.reset();

        this._allyDefs?.clear();
        this._enemyDefs?.clear();
        this._projAlly?.clear();
        this._projEnemy?.clear();
        this._projDefault = null;
        this._finished = false;
        this._poolWarned = false;
    }
}
