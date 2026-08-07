/**
 * 시뮬레이션 타입 정의 (JSDoc)
 *
 * TypeScript 를 쓰지 않으므로 여기서 계약을 문서화한다.
 * @see docs/03-tech/22-simulation-spec.md §3
 */

/** @typedef {'physical'|'arcane'|'holy'} DamageType */

/**
 * 유닛 역할. 오라 효과가 역할별로 다르다.
 * @typedef {'BLOCKER'|'MELEE'|'RANGED'|'CASTER'|'SUPPORT'|'SPECIALIST'|'SIEGE'|'FLYER'} Role
 */

/**
 * 적 태그. **조합된다** — ARMORED + FLYING 은 "술식 원거리"라는 2조건 답을 요구한다.
 * 이것이 평면 가위바위보보다 우월한 이유이며, 단일 카운터 유닛의 지배를 구조적으로 막는다.
 * @typedef {'ARMORED'|'WARDED'|'FLYING'|'SWARM'|'CORRUPT'|'LIVING'|'SHIELDED'|'REGEN'|'ANTI_AIR'} Tag
 */

/** @typedef {'battle'|'draft'|'victory'|'defeat'} SimPhase */

/**
 * @typedef {object} Entity
 * @property {number}  id        증가 정수. 렌더가 스프라이트 매칭에 쓴다
 * @property {string}  defId     units.json / enemies.json 의 id
 * @property {boolean} isAlly
 * @property {number}  lane      0..2, 공중은 AIR_LANE
 * @property {number}  x
 * @property {number}  hp
 * @property {number}  hpMax
 * @property {number}  atk
 * @property {number}  def       물리 절대 감산
 * @property {number}  res       술식/신성 비율 감산 (0~100)
 * @property {DamageType} dmgType
 * @property {Role}    role
 * @property {number}  tags      비트마스크 (tags.js)
 * @property {number}  range
 * @property {number}  speed     px/초
 * @property {number}  atkInterval ms
 * @property {number}  atkReadyAt  시뮬 시각(ms)
 * @property {number}  blockCount  BLOCKER 만 > 0
 * @property {number}  blockedBy   자신을 막고 있는 상대 id, 없으면 -1
 * @property {number}  blocking    이 유닛이 막고 있는 수
 * @property {number}  shield      남은 무효화 횟수
 * @property {boolean} inAura
 * @property {number}  cost        처치 환급 계산용
 * @property {number}  breachDamage 방주 도달 시 피해
 * @property {boolean} active      풀 반환 여부
 */

/**
 * @typedef {object} Projectile
 * @property {number}  id
 * @property {boolean} isAlly
 * @property {number}  lane
 * @property {number}  x
 * @property {number}  vx        px/초
 * @property {number}  damage
 * @property {DamageType} dmgType
 * @property {number}  pierce    남은 관통 횟수
 * @property {number}  sourceId
 * @property {boolean} active
 */

export {};
