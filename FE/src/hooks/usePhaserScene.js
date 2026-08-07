/**
 * 화면이 마운트되는 동안 특정 Phaser 씬을 띄운다.
 *
 * ★ 아틀라스 로드 전에 씬을 시작하면 스프라이트가 없는 빈 화면이 뜬다.
 *   assetsReady 를 반드시 기다린다 (P3 에서 실제로 겪은 버그다).
 *
 * ★ 언마운트에서 씬을 끄지 않는다. 다음 화면이 자기 씬을 켜면
 *   GameManager 의 desiredScene 이 이전 씬을 정리한다. 여기서 또 끄면
 *   화면 전환 한 프레임 동안 캔버스가 검게 비는 깜빡임이 생긴다.
 */
import { useEffect } from "react";
import { useGameStore } from "@/store";
import { gameManager } from "@/game/GameManager";

/** @returns {boolean} 씬이 실제로 떠 있는지 (= 아틀라스 로드 완료) */
export function usePhaserScene(sceneKey, data) {
    const assetsReady = useGameStore((s) => s.ui.assetsReady);

    useEffect(() => {
        if (!assetsReady || !sceneKey) return;
        gameManager.switchScene(sceneKey, data);
        // data 는 매 렌더 새 객체일 수 있으므로 의존성에 넣지 않는다.
        // 씬 파라미터가 바뀌어야 하는 화면은 직접 switchScene 을 부른다.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sceneKey, assetsReady]);

    return assetsReady;
}
