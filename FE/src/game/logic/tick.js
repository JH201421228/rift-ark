/**
 * 고정 틱 상수
 *
 * ★ 30Hz 고정. 렌더 프레임과 완전히 분리한다.
 *   프레임률에 따라 밸런스가 달라지면 밸런스 하네스가 무의미해진다.
 *
 * 별도 모듈인 이유: sim.js ↔ resources.js 순환 import 를 피하기 위해.
 */
export const TICK_HZ = 30;
export const TICK_MS = 1000 / TICK_HZ;

/** 프레임당 최대 틱 — 배속 ×3 대응 + 스파이럴 오브 데스 방지 */
export const MAX_TICKS_PER_FRAME = 8;

/** delta 클램프 — Capacitor resume 후 delta 가 수 분일 수 있다 */
export const MAX_DELTA_MS = 250;
