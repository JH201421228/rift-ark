/**
 * 아틀라스 프레임을 React UI 에 그린다.
 *
 * ★ 아틀라스 JSON 을 화면마다 fetch 하지 않는다. 모듈 스코프에서 한 번만 받고
 *   같은 Promise 를 공유한다. 편성 화면에는 스프라이트가 40개 넘게 뜨는데
 *   컴포넌트마다 fetch 하면 콜드 스타트에 네트워크가 40번 열린다.
 *
 * ★ 배율은 정수만 받는다. 1.5배 같은 값을 주면 픽셀 그리드가 어긋나 흐려진다.
 *
 * ★ Phaser 가 이미 같은 png 를 로드했더라도 브라우저 캐시가 공유되므로
 *   추가 다운로드는 발생하지 않는다.
 */
import { useSyncExternalStore } from "react";

const ATLAS_BASE = `${import.meta.env.BASE_URL}assets/atlas`;

/** @type {Record<string, {frames: Map<string, object>, image: string|null, w: number, h: number}>} */
const cache = {};
const pending = new Set();
const listeners = new Set();

const notify = () => listeners.forEach((l) => l());

function loadAtlas(name) {
    if (cache[name] || pending.has(name)) return;
    pending.add(name);
    fetch(`${ATLAS_BASE}/${name}.json`)
        .then((r) => r.json())
        .then((json) => {
            const frames = new Map();
            const tex = json.textures?.[0];
            for (const t of json.textures ?? []) {
                for (const f of t.frames ?? []) frames.set(f.filename, f.frame);
            }
            cache[name] = {
                frames,
                image: `${ATLAS_BASE}/${tex?.image ?? `${name}.png`}`,
                w: tex?.size?.w ?? 0,
                h: tex?.size?.h ?? 0,
            };
            notify();
        })
        .catch((e) => {
            console.warn(`[Sprite] atlas load failed: ${name}`, e);
            cache[name] = { frames: new Map(), image: null, w: 0, h: 0 };
            notify();
        });
}

const subscribe = (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
};
/** 아틀라스가 하나 더 로드될 때마다 값이 바뀌면 된다 */
const getSnapshot = () => Object.keys(cache).length;

/**
 * @param {object} p
 * @param {string} p.atlas  아틀라스 이름 (units / npcs / fx …)
 * @param {string} p.frame  프레임 이름. 애니메이션이면 "Name" 만 줘도 첫 프레임을 찾는다.
 * @param {number} [p.scale] 정수 배율
 */
export function Sprite({ atlas, frame, scale = 3, className = "", title, style }) {
    useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    loadAtlas(atlas);

    const a = cache[atlas];
    // 애니메이션 프레임이면 첫 장을 쓴다 — UI 는 정지 이미지로 충분하다
    const f =
        a?.frames.get(frame) ?? a?.frames.get(`${frame}/1`) ?? a?.frames.get(`${frame}/0`) ?? null;

    const s = Math.max(1, Math.round(scale));
    const base = { display: "inline-block", flexShrink: 0, ...style };

    if (!f || !a?.image) {
        // 로딩 중·누락 프레임: 자리만 잡는다. 크기가 0 이면 목록이 튄다.
        return (
            <span
                className={className}
                title={title}
                style={{ ...base, width: 16 * s, height: 16 * s }}
            />
        );
    }

    return (
        <span
            className={className}
            title={title}
            style={{
                ...base,
                width: f.w * s,
                height: f.h * s,
                backgroundImage: `url(${a.image})`,
                backgroundPosition: `${-f.x * s}px ${-f.y * s}px`,
                backgroundSize: `${a.w * s}px ${a.h * s}px`,
                backgroundRepeat: "no-repeat",
                imageRendering: "pixelated",
            }}
        />
    );
}
