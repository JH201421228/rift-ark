/**
 * PhaserGame — Phaser 캔버스 마운트 지점
 *
 * ★ useEffect 가 아니라 useLayoutEffect 를 쓴다.
 *   Phaser 가 크기를 조회하기 전에 컨테이너 div 가 DOM 에 있어야 한다.
 *   아니면 Scale Manager 가 0×0 을 읽고 캔버스가 사라진다.
 *
 * ★ 라우트가 바뀌어도 이 컴포넌트를 언마운트하지 않는다.
 *   씬만 전환한다. 매번 파괴/재생성하면 로딩이 반복되고 메모리가 파편화된다.
 *
 * @see docs/03-tech/20-architecture.md §4.1
 */
import { useLayoutEffect, useRef } from "react";
import { gameManager } from "@/game/GameManager";

export function PhaserGame() {
    const containerRef = useRef(null);

    useLayoutEffect(() => {
        const el = containerRef.current;
        gameManager.init(el);
        return () => gameManager.destroy();
    }, []);

    return <div ref={containerRef} id="game-container" />;
}

export default PhaserGame;
