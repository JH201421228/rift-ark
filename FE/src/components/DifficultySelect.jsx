/**
 * 난이도 토글 (P6-10)
 *
 * ★ 별도 파일인 이유: 스테이지 선택 화면은 P6-09 프리뷰 UI 로 통째로 교체될
 *   예정이다. 난이도 규칙이 그 화면 안에 흩어져 있으면 교체할 때마다 함께
 *   다시 짜야 한다. 화면은 이 컴포넌트를 **한 줄로** 얹기만 한다.
 *
 * ★ 잠긴 난이도를 숨기지 않는다. 숨기면 "하드가 있다"는 사실 자체가 전달되지
 *   않아 재도전 루프(13-progression-meta.md §6)가 존재하지 않는 것이 된다.
 *   대신 **무엇을 하면 열리는지**를 같은 자리에 적는다.
 *
 * @see docs/02-design/15-content-plan.md §2
 */
import { Lock } from "lucide-react";
import { useGameStore } from "@/store";
import {
    DIFFICULTIES,
    difficultyName,
    difficultyNote,
    difficultyUnlockText,
    stageIdsOfWorld,
} from "@/game/logic/difficulty";
/**
 * ★★ **월드별 규칙의 판정은 규칙 모듈 하나가 한다.** 여기서 `world === 5` 로
 *   분기하거나 `balance.json` 을 직접 읽으면 출처가 둘이 되고, 그때부터
 *   이 카드가 말하는 규칙과 전투가 거는 규칙이 갈라진다
 *   (`canEnterStage` · `canHitFlying` 과 같은 규약 — CLAUDE.md 가 지목한 단일 실패 유형).
 */
import { stageNightmareRule } from "@/game/logic/stagePreview";
import { useT, usePick, useLang } from "@/i18n/useT";
import styles from "./DifficultySelect.module.css";

/**
 * @param {object} props
 * @param {number} props.world 이 토글이 적용되는 월드
 */
export function DifficultySelect({ world }) {
    const t = useT();
    /**
     * ★★ 난이도·규칙 이름은 **데이터가 들고 있다** (`balance.json` · `nightmare`).
     *   `pick` 은 정본(`name: {ko, en}`)과 구형(`nameKo`)을 둘 다 읽으므로,
     *   데이터 쪽 전환이 끝나기 전에 바꿔도 이 화면은 깨지지 않는다.
     */
    const pick = usePick();
    /**
     * ★ 현재 언어를 **값으로** 들고 다닌다. `difficultyName`/`difficultyNote` 는
     *   `logic/` 의 순수 함수라 훅이 아니고, 인자로 언어를 받아야 이 컴포넌트가
     *   언어 변경에 다시 그려진다 (`useLang()` 이 스토어를 구독한다).
     */
    const lang = useLang();
    const selected = useGameStore((s) => s.meta.selectedDifficulty);
    const setDifficulty = useGameStore((s) => s.setDifficulty);
    const getProgress = useGameStore((s) => s.getDifficultyProgress);

    /**
     * 규칙 조회에 쓸 이 월드의 대표 스테이지.
     *
     * ★ 규칙은 **월드 단위**라 어느 스테이지를 넘겨도 답이 같다
     *   (`nightmareFor(world)`). 월드 번호로 직접 표를 뒤지지 않는 이유는 위 주석과
     *   같다 — 스테이지 → 월드 변환까지 규칙 모듈 안에서 끝나야 한다.
     */
    const sampleStageId = stageIdsOfWorld(world)[0] ?? null;

    return (
        <div
            className={styles.row}
            role="group"
            aria-label={t("system.worldDifficultyAria", { n: world })}
        >
            {DIFFICULTIES.map((d) => {
                const p = getProgress(d.id, world);
                const playable = d.implemented && p.unlocked;
                const active = selected === d.id && playable;
                /**
                 * ★ 이 난이도가 이 월드에 거는 규칙 (없으면 `null`).
                 *   잠겨 있어도 보여 준다 — **무엇이 기다리는지**를 아는 것이
                 *   잠긴 난이도를 숨기지 않는 이유와 같다 (이 파일 머리말).
                 */
                const rule = sampleStageId ? stageNightmareRule(sampleStageId, d.id) : null;
                /**
                 * ★★ 규칙 이름이 **비어 있으면 배지를 아예 그리지 않는다.** 이름은
                 *   `balance.json` → `nightmareBrief` 를 거쳐 오는데, 그 경유지가
                 *   두 언어 전환을 아직 안 마쳤을 수 있다. 빈 `<em>` 은 CSS 의
                 *   패딩·테두리만 남겨 **글자 없는 배지**를 그린다 — 그것은 결함처럼
                 *   보이는 것이 아니라 결함이다.
                 */
                const ruleName = rule ? pick(rule, "name") : "";

                // 잠금·미구현 사유를 한 문장으로 — 툴팁이 없는 기기가 대부분이므로
                // title 에만 두지 않고 버튼 아래 줄에도 노출한다.
                const reason = !d.implemented
                    ? t("system.difficultyPending", { note: difficultyNote(d.id, lang) })
                    : p.unlocked
                      ? ""
                      : `${difficultyUnlockText(d.id, world)} (${p.done}/${p.total})`;

                return (
                    <button
                        key={d.id}
                        type="button"
                        className={`${styles.btn} ${active ? styles.active : ""} interactive`}
                        aria-pressed={active}
                        disabled={!playable}
                        title={reason || undefined}
                        onClick={() => setDifficulty(d.id)}
                    >
                        {!playable && <Lock size={11} aria-hidden />}
                        {/*
                          ★ 이름은 데이터가 출처다 (`balance.json:difficulty.levels.*.name`).
                            `terms.difficulty.*` 는 그 표를 그대로 옮긴 것이므로 **같은 말**
                            이고, 데이터 경유지가 아직 두 언어를 안 실어 줄 때의 그물이다.
                        */}
                        {/*
                          ★★ **부를 때마다 부른다.** 예전에는 `DIFFICULTIES` 가 이름을
                            상수로 담고 있었고, 모듈 스코프 상수는 부팅 언어로 굳는다 —
                            영어로 바꿔도 이 줄만 한국어로 남았다 (실기 확인 2026-08-07).
                            게다가 그 값은 이미 문자열이라 `pick()` 이 그대로 돌려주며
                            **아무도 실패하지 않았다.**
                        */}
                        <span>{difficultyName(d.id, lang)}</span>
                        {/*
                          ★ 규칙 이름은 **텍스트 배지**다. 역병·결박·고갈에 맞는 글리프가
                            아이콘 시트에 없어 아이콘을 만들지 않았고(22-nightmare.md
                            §0-A #6), 이모지는 절대규칙 5 위반이다.
                          ★ 한 줄 요약은 여기 넣지 않는다 — 카드가 세 줄이 되면 스테이지
                            목록이 밀린다. 요약은 프리뷰가 진입 전에 그대로 낸다 (§5.3).
                        */}
                        {ruleName && <em className={styles.rule}>{ruleName}</em>}
                        {reason && <em className={styles.reason}>{reason}</em>}
                    </button>
                );
            })}
        </div>
    );
}

export default DifficultySelect;
