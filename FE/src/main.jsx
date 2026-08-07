import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import router from "@/router";
import "./index.css";

/*
 * ★ react-query 를 걷어냈다 (2026-08-04). 이 게임에는 서버가 없고, 그래서
 *   가져올 것도 캐시할 것도 없다. 상태는 전부 Zustand 한 곳에 있다.
 */

// ★ StrictMode 는 개발에서 켜 둔다.
//   Phaser 인스턴스·트윈·리스너 누수를 잡는 가장 싼 탐지기이며,
//   여기서 깨지는 것은 결국 Capacitor resume 에서도 깨진다.
//   대응은 GameManager 의 멱등 init + destroy(true) + HMR dispose 세 겹.
createRoot(document.getElementById("root")).render(
    <StrictMode>
        <RouterProvider router={router} />
    </StrictMode>
);
