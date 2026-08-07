/**
 * 런타임 에셋 URL 헬퍼
 *
 * public/assets/** 는 Vite 가 해시를 붙이지 않고 그대로 복사한다.
 * Phaser 로더는 런타임에 해석 가능한 URL 이 필요하므로 여기를 통한다.
 *
 * ★ 코드는 논리 경로만 안다. 물리 파일 배치가 바뀌어도 이 함수만 고치면 된다.
 *
 * @see docs/03-tech/23-asset-pipeline.md §5
 */

/* global __ASSET_VERSION__ */
const VERSION = typeof __ASSET_VERSION__ !== "undefined" ? __ASSET_VERSION__ : "dev";
const BASE = import.meta.env.BASE_URL;

/**
 * @param {string} p `assets/` 이후의 경로. 예: "atlas/units.png"
 * @returns {string}
 */
export const assetUrl = (p) => `${BASE}assets/${p}?v=${VERSION}`;

/** 아틀라스 png/json 쌍을 한 번에 */
export const atlasUrls = (name) => [assetUrl(`atlas/${name}.png`), assetUrl(`atlas/${name}.json`)];

/** 오디오는 ogg 우선, m4a 폴백 (Phaser 가 지원되는 첫 포맷을 고른다) */
export const audioUrls = (name) => [assetUrl(`audio/${name}.ogg`), assetUrl(`audio/${name}.m4a`)];
