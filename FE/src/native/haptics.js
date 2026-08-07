/**
 * 햅틱 피드백
 *
 * ★ 빈도 상한 필수 (초당 3회). 스웜 유닛 20마리가 동시에 공격할 때
 *   진동이 연속되면 배터리와 불쾌감 양쪽이 문제가 된다.
 *
 * @see docs/02-design/19-art-audio-direction.md §6.5
 */
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Capacitor } from "@capacitor/core";

const MIN_INTERVAL_MS = 333; // 초당 최대 3회
let lastAt = 0;
let enabled = true;

/** 설정 화면에서 토글. 기본 ON */
export function setHapticsEnabled(v) {
    enabled = !!v;
}

function impact(style) {
    if (!enabled || !Capacitor.isNativePlatform()) return;
    const now = performance.now();
    if (now - lastAt < MIN_INTERVAL_MS) return;
    lastAt = now;
    Haptics.impact({ style }).catch(() => {
        /* 미지원 기기 무시 */
    });
}

/** UI 탭, 유닛 소환 */
export const hapticTap = () => impact(ImpactStyle.Light);
/** 크리티컬, 엘리트 처치, 방주 피격 */
export const hapticHit = () => impact(ImpactStyle.Medium);
/** 보스 페이즈 전환, 패배 */
export const hapticHeavy = () => impact(ImpactStyle.Heavy);
