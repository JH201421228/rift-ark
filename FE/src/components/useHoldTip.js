/**
 * 홀드 툴팁 — **누르고 있는 동안만 설명이 보인다** (2026-08-05, 사용자 요청)
 *
 * ★★ **`title` 속성은 터치 기기에서 뜨지 않는다.** 이 게임은 폰 가로가 본체이므로
 *   `title` 만 달아 둔 설명은 사실상 없는 것과 같다. 그래서 **길게 누르면** 설명을
 *   띄운다 — 전투 HUD 의 주문 도크가 이 방식으로 먼저 만들어졌고, 편성 화면의
 *   지휘관 주문도 같은 요청을 받았다.
 *
 * ★★ **훅으로 뽑은 이유.** 같은 동작을 두 화면이 각자 구현하면 반드시 갈라진다 —
 *   한쪽만 홀드 후 탭을 막거나, 한쪽만 포인터 이탈을 처리하는 식이다. 이 저장소가
 *   오늘 하루에만 세 번 겪은 실패 유형이다 (발사체 필드 · 대공 판정 · 틴트 표).
 *
 * ★★★ **홀드가 성립하면 손을 떼도 탭이 일어나지 않는다.** 설명을 보려다 균열력을
 *   쓰거나 장착을 바꾸는 것은 이 UI 가 만들 수 있는 가장 나쁜 사고다.
 *
 * ★ 상태는 **누르고 있는 대상 하나**뿐이다. 손을 떼거나 벗어나면 즉시 사라진다 —
 *   "떴다가 알아서 사라지는" 타이머를 두지 않는다. 사용자가 요청한 것이 정확히
 *   "누르고 있는 동안만" 이고, 타이머는 화면을 가리는 시간을 스스로 정해 버린다.
 */
import { useCallback, useRef, useState } from "react";

/** 홀드로 판정하는 시간(ms). 이보다 길게 누르면 설명이 뜨고 **탭은 취소된다.** */
export const HOLD_MS = 350;

/**
 * @param {{holdMs?: number}} [opts]
 * @returns {{held: any, bind: (item: any, onTap?: () => void) => object, clear: () => void}}
 *   `bind(item, onTap)` 이 돌려주는 것을 버튼에 펼쳐 넣는다.
 *   ★ `onClick` 을 쓰지 않는다 — 포인터 이벤트로 탭을 직접 판정해야
 *     홀드 뒤의 클릭을 막을 수 있다.
 */
export function useHoldTip({ holdMs = HOLD_MS } = {}) {
    const [held, setHeld] = useState(null);
    /** 타이머와 "이번 누름이 홀드였는가" — 렌더를 유발하지 않아야 하므로 ref 다 */
    const st = useRef({ timer: null, fired: false });

    const stop = useCallback(() => {
        if (st.current.timer) clearTimeout(st.current.timer);
        st.current.timer = null;
    }, []);

    const clear = useCallback(() => {
        stop();
        st.current.fired = false;
        setHeld(null);
    }, [stop]);

    const bind = useCallback(
        (item, onTap) => ({
            onPointerDown: () => {
                st.current.fired = false;
                stop();
                st.current.timer = setTimeout(() => {
                    st.current.fired = true;
                    setHeld(item);
                }, holdMs);
            },
            onPointerUp: () => {
                stop();
                if (st.current.fired) {
                    // 설명을 봤을 뿐이다 — 탭은 일어나지 않는다
                    st.current.fired = false;
                    setHeld(null);
                    return;
                }
                onTap?.();
            },
            // 손가락이 버튼을 벗어나면 취소한다 (누른 채 끌어서 빠져나가는 경우)
            onPointerLeave: clear,
            onPointerCancel: clear,
            /**
             * ★ 키보드 사용자는 홀드를 할 수 없다. Enter/Space 는 그대로 탭이다.
             *   (설명은 `title` 로도 붙어 있어 마우스 호버에서는 읽힌다.)
             */
            onKeyDown: (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onTap?.();
                }
            },
        }),
        [clear, holdMs, stop]
    );

    return { held, bind, clear };
}
