/**
 * 에셋 아이콘을 논리 키로 그린다.
 *
 * ★ 아이콘 정책 (docs/02-design/19-art-audio-direction.md §5):
 *     게임 세계관 아이콘(재화·등급·전투 개념) → 이 컴포넌트 (에셋 아이콘)
 *     시스템 UI 아이콘(일시정지·리롤·경고·닫기) → lucide-react 직접 import
 *
 *   픽셀 유닛 옆에 벡터 라인 아이콘으로 '골드'를 그리면 두 세계가 섞여
 *   어느 쪽도 진짜로 보이지 않는다. 반대로 일시정지 버튼을 픽셀로 그리면
 *   기계 장치가 게임 오브젝트처럼 보여 오조작을 부른다.
 *
 * ★ 경로를 코드에 박지 않는다. `icons.json` 이 유일한 좌표 출처다.
 *   리스킨·이벤트 스킨은 이 JSON 만 바꾸면 끝난다.
 *
 * ★ 시트는 균일 그리드라 아틀라스 JSON 을 fetch 할 필요가 없다.
 *   인덱스 → (row, col) 산술로 끝나므로 네트워크 왕복이 0이다.
 */
import ICONS from "@/game/data/icons.json";
import { assetUrl } from "@/game/assetUrl";
import { usePick } from "@/i18n/useT";
import { Sprite } from "./Sprite";

const SHEETS = ICONS.sheets;
const TABLE = ICONS.icons;

/** 개발 중 오타를 조용히 넘기지 않는다 — 빈 칸은 발견이 늦다 */
const warned = new Set();

/**
 * @param {object} p
 * @param {string} p.name    논리 키 (예: "currency.gold")
 * @param {number} [p.size]  화면 픽셀 크기. 셀 크기의 정수 약수/배수로 스냅된다
 * @param {string} [p.className]
 * @param {string} [p.title] 없으면 icons.json 의 label 을 쓴다
 * @param {boolean} [p.decorative] 순수 장식. 스크린리더가 건너뛴다.
 *   ★ 별 5개를 나란히 두면 "별 별 별 별 별"로 읽힌다 — 묶는 쪽에 라벨을 단다.
 */
export function GameIcon({ name, size = 16, className = "", title, decorative = false, style }) {
    /**
     * ★★ `icons.json` 의 `label` 은 **`{ko, en}` 객체**다 (2026-08-07). 예전처럼
     *   `def.label` 을 그대로 넘기면 `title`/`aria-label` 이 `"[object Object]"` 가
     *   된다 — 화면에는 아이콘이 멀쩡히 뜨고 스크린리더에만 그 글자가 나가므로
     *   **눈으로는 절대 발견되지 않는다.**
     */
    const pick = usePick();
    const def = TABLE[name];

    if (!def) {
        if (import.meta.env.DEV && !warned.has(name)) {
            warned.add(name);
            console.warn(`[GameIcon] unknown icon key: ${name}`);
        }
        return <span className={className} style={{ width: size, height: size, ...style }} />;
    }

    const label = pick(def, "label");

    // ── 자체 UI 키트 (아틀라스) ──
    // 프레임 크기가 제각각(8~48px)이라 Sprite 가 아틀라스 JSON 에서 읽어야 한다.
    if (def.atlas) {
        return (
            <Sprite
                atlas={def.atlas}
                frame={def.frame}
                scale={Math.max(1, Math.round(size / 16))}
                className={className}
                title={decorative ? undefined : (title ?? (label || undefined))}
                style={{ verticalAlign: "-0.15em", ...style }}
            />
        );
    }

    return (
        <SheetIcon
            sheet={def.sheet}
            index={def.index}
            size={size}
            className={className}
            decorative={decorative}
            // ★ `pick` 은 없는 라벨에 빈 문자열을 준다 — `??` 로는 걸러지지 않는다
            title={title ?? (label || name)}
            style={style}
        />
    );
}

/**
 * 시트 인덱스로 직접 그리는 저수준 아이콘.
 *
 * ★ 논리 키가 아니라 **데이터가 들고 있는 인덱스**를 쓰는 경우를 위한 것이다.
 *   각인 36종은 `sigils.json` 에 각자 `icon` 인덱스를 갖고 있어서
 *   icons.json 에 36줄을 복제할 이유가 없다.
 *   반대로 재화·등급처럼 **코드가 이름으로 부르는** 아이콘은 반드시
 *   `GameIcon` + `icons.json` 을 거친다 (절대규칙 5).
 *
 * @param {object} p
 * @param {string} [p.sheet] icons.json 의 시트 키
 * @param {number|string} p.index 시트 내 인덱스
 */
export function SheetIcon({
    sheet = "icons32",
    index,
    size = 16,
    className = "",
    title,
    decorative = false,
    style,
}) {
    const s = SHEETS[sheet];
    const i = Number(index);
    if (!s || !Number.isFinite(i)) {
        return <span className={className} style={{ width: size, height: size, ...style }} />;
    }

    const { cell, cols } = s;
    // 정수 배율로만 확대/축소한다. 1.5배는 픽셀 그리드를 어긋나게 해 흐려진다.
    const scale = size / cell;
    const col = i % cols;
    const row = Math.floor(i / cols);

    return (
        <span
            className={className}
            role={decorative ? undefined : "img"}
            aria-hidden={decorative || undefined}
            aria-label={decorative ? undefined : title}
            title={decorative ? undefined : title}
            style={{
                display: "inline-block",
                flexShrink: 0,
                verticalAlign: "-0.15em",
                width: size,
                height: size,
                backgroundImage: `url(${assetUrl(s.file)})`,
                backgroundPosition: `${-col * cell * scale}px ${-row * cell * scale}px`,
                backgroundSize: `${cols * cell * scale}px auto`,
                backgroundRepeat: "no-repeat",
                imageRendering: "pixelated",
                ...style,
            }}
        />
    );
}
