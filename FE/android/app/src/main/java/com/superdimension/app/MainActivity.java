package com.superdimension.app;

import android.os.Bundle;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * 몰입 모드(immersive sticky) — 상태바 · 네비게이션 바를 숨긴다.
 *
 * 가로 모드에서 3버튼 네비게이션 바는 화면 *좌우*를 먹는다 — 정확히 뒤로가기 ·
 * 탭 바 · 일시정지를 두는 자리다. edge-to-edge 라 WebView 는 그 아래까지
 * 그려지지만 터치는 시스템이 먼저 가져가므로, 버튼이 보이는데 눌리지 않는다.
 *
 * BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE 로 두는 이유:
 *   기본 동작(BEHAVIOR_DEFAULT)에서는 가장자리를 한 번 쓸면 바가 *영구히* 돌아온다.
 *   sticky 는 반투명으로 잠깐 떴다가 스스로 사라져서, 게임 중 우발적인 스와이프가
 *   화면을 되돌리지 않는다. 시스템 뒤로/홈 제스처는 바가 숨어도 그대로 동작한다.
 *
 * ★ onCreate 만으로는 부족하다. 창이 포커스를 얻기 전 호출은 무시될 수 있고,
 *   백그라운드 복귀 · 알림 셰이드를 내렸다 올리면 바가 되살아난다.
 *   그래서 포커스를 얻을 때마다 다시 건다.
 *
 * @see docs/03-tech/25-capacitor-mobile.md §3.3
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        hideSystemBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    private void hideSystemBars() {
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(
            getWindow(),
            getWindow().getDecorView()
        );
        controller.setSystemBarsBehavior(
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        );
        controller.hide(WindowInsetsCompat.Type.systemBars());
    }
}
