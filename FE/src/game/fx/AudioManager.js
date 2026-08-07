/**
 * 오디오 매니저 — 레이어드 BGM
 *
 * ★ 퍼커션 루프가 BPM별로 3곡 있다는 것이 큰 자산이다.
 *   곡을 바꾸는 게 아니라 **레이어를 더해** 강도를 올린다:
 *
 *     1막  [베이스 퍼커션]                       volume 1.0
 *     2막  [베이스] + [시네마틱 드럼]            크로스페이드 800ms
 *     3막  [베이스] + [시네마틱 드럼] + [드럼]   강도 최대
 *
 *   끊김 없이 강도가 오르는 체감을 만든다.
 *
 * ★ 동시 재생 채널 상한 4 (모바일). 같은 SFX 가 60ms 내 재요청되면 무시한다.
 *   스웜 유닛 20마리가 동시에 공격할 때 오디오가 뭉개지는 것을 방지.
 *
 * @see docs/02-design/19-art-audio-direction.md §6
 */
import { audioUrls } from "../assetUrl.js";

/** 전투 BGM 레이어 (월드 구간별 베이스 트랙) */
export const BGM_LAYERS = {
    base: {
        1: "5xbeatz-percussion-loop-118-bpm-free-385692",
        4: "5xbeatz-percussion-loop-130bpm-387865",
        8: "5xbeatz-percussion-loop-132bpm-387866",
    },
    /** 템포 시프트에서 겹쳐 넣는 레이어 */
    tempo: "soundreality-cinematic-drums-percussion-474175",
    /** 3막 총력전 레이어 */
    climax: "audioknap-drums-only-448491",
};

const MAX_CHANNELS = 4;
const SFX_DEDUPE_MS = 60;

export class AudioManager {
    /**
     * @param {Phaser.Scene} scene
     * @param {object} settings { bgmVolume, sfxVolume }
     */
    constructor(scene, settings = {}) {
        this.scene = scene;
        this.bgmVolume = settings.bgmVolume ?? 0.6;
        this.sfxVolume = settings.sfxVolume ?? 0.8;

        /** @type {Map<string, Phaser.Sound.BaseSound>} */
        this.layers = new Map();
        this.playing = [];
        this._lastSfxAt = Object.create(null);
    }

    /** 월드 번호에 맞는 베이스 트랙 키 */
    static baseTrackFor(worldId) {
        const keys = Object.keys(BGM_LAYERS.base)
            .map(Number)
            .sort((a, b) => a - b);
        let pick = keys[0];
        for (const k of keys) if (worldId >= k) pick = k;
        return BGM_LAYERS.base[pick];
    }

    /** 씬 preload 에서 호출 — 필요한 레이어만 로드한다 */
    static preload(scene, worldId) {
        const tracks = [
            AudioManager.baseTrackFor(worldId),
            BGM_LAYERS.tempo,
            BGM_LAYERS.climax,
        ];
        for (const t of tracks) {
            if (!scene.cache.audio.exists(t)) scene.load.audio(t, audioUrls(t));
        }
    }

    /** 1막 시작 */
    startBattle(worldId) {
        const base = AudioManager.baseTrackFor(worldId);
        this.addLayer("base", base, this.bgmVolume);
    }

    /** 템포 시프트 — 기존 레이어를 끊지 않고 위에 얹는다 */
    enterTempoShift() {
        this.addLayer("tempo", BGM_LAYERS.tempo, 0);
        this.fadeLayer("tempo", this.bgmVolume * 0.8, 800);
    }

    /** 3막 총력전 */
    enterClimax() {
        this.addLayer("climax", BGM_LAYERS.climax, 0);
        this.fadeLayer("climax", this.bgmVolume * 0.6, 600);
    }

    addLayer(name, key, volume) {
        if (this.layers.has(name)) return;
        if (!this.scene.cache.audio.exists(key)) return; // 아직 로드 전이면 조용히 건너뛴다

        // ★★ BGM 레이어는 **전역 유일**이어야 한다.
        //
        //   scene.sound 는 씬 소유가 아니라 게임 전역 SoundManager 다.
        //   씬이 shutdown 없이 사라지면(create 중복·강제 종료·HMR) 그 씬이 켠
        //   루프 BGM 은 **아무도 끌 수 없는 상태로 영원히 재생된다.**
        //   전투에 들어갈 때마다 같은 곡이 하나씩 겹쳐 쌓인다 — 실제 제보된 버그다.
        //
        //   근본 원인(씬 중복 생성)은 GameManager.switchScene 에서 막았지만,
        //   여기서도 불변식을 세운다. "같은 BGM 이 두 번 울릴 수 있는 구조"는
        //   원인이 무엇이든 버그이고, 이 검사는 전투당 3회뿐이라 사실상 공짜다.
        this.stopStrayLoops(key);

        const snd = this.scene.sound.add(key, { loop: true, volume });
        snd.play();
        this.layers.set(name, snd);
    }

    /** 이 매니저가 소유하지 않는, 같은 키의 유령 루프를 정리한다 */
    stopStrayLoops(key) {
        const mgr = this.scene.sound;
        if (!mgr?.sounds) return;
        // 역순 순회 — stop/destroy 가 sounds 배열을 줄인다
        for (let i = mgr.sounds.length - 1; i >= 0; i--) {
            const s = mgr.sounds[i];
            if (s.key !== key) continue;
            this.scene.tweens?.killTweensOf(s);
            s.stop();
            s.destroy();
        }
    }

    fadeLayer(name, to, ms) {
        const snd = this.layers.get(name);
        if (!snd) return;
        this.scene.tweens.add({ targets: snd, volume: to, duration: ms });
    }

    /**
     * SFX 재생.
     * ★ SFX 에셋은 아직 없다 (P3-14 소싱 대상). 키가 없으면 조용히 무시하고
     *   나중에 파일만 추가하면 그대로 동작한다.
     */
    sfx(key, volumeScale = 1) {
        if (!key) return;
        // ★ 음소거는 volume 0 재생이 아니라 **아예 재생하지 않는 것**이다.
        //   0으로 틀면 동시 채널 4칸을 들리지도 않는 소리가 잡아먹는다.
        if (this.sfxVolume <= 0) return;

        const now = this.scene.time.now;
        if (now - (this._lastSfxAt[key] ?? -Infinity) < SFX_DEDUPE_MS) return;
        this._lastSfxAt[key] = now;

        if (!this.scene.cache.audio.exists(key)) return;

        // 모바일은 동시 채널이 많으면 무너진다
        this.playing = this.playing.filter((s) => s.isPlaying);
        if (this.playing.length >= MAX_CHANNELS) return;

        const snd = this.scene.sound.add(key, { volume: this.sfxVolume * volumeScale });
        snd.once("complete", () => snd.destroy());
        snd.play();
        this.playing.push(snd);
    }

    setVolumes({ bgmVolume, sfxVolume }) {
        if (bgmVolume !== undefined) {
            this.bgmVolume = bgmVolume;
            for (const [name, snd] of this.layers) {
                const scale = name === "base" ? 1 : name === "tempo" ? 0.8 : 0.6;
                snd.setVolume(bgmVolume * scale);
            }
        }
        if (sfxVolume !== undefined) this.sfxVolume = sfxVolume;
    }

    stopAll() {
        for (const snd of this.layers.values()) {
            this.scene.tweens.killTweensOf(snd);
            snd.stop();
            snd.destroy();
        }
        this.layers.clear();
        for (const s of this.playing) s.destroy();
        this.playing.length = 0;
    }

    destroy() {
        this.stopAll();
    }
}
