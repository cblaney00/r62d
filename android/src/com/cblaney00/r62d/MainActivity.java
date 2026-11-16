package com.cblaney00.r62d;

// The whole Android app: a full-screen, landscape web view. It starts on assets/start.html (find a game, type a code)
// and then shows the game straight from the computer hosting it, so the game itself is always the host's version.
// The page sees this app as window.r62dApp (the same name the Windows program uses), which tells main.js it is in an
// app: QUIT comes back here, and the download links are hidden.

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.net.Inet4Address;
import java.net.InterfaceAddress;
import java.net.NetworkInterface;
import java.util.Collections;

public class MainActivity extends Activity {
  static final String START = "file:///android_asset/start.html";
  WebView web;

  @Override protected void onCreate(Bundle saved) {
    super.onCreate(saved);
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); // no screen dimming mid-round
    web = new WebView(this);
    web.setBackgroundColor(0xff05070a);
    WebSettings s = web.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);           // profile token, settings
    s.setMediaPlaybackRequiresUserGesture(false);
    s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
    s.setUserAgentString(s.getUserAgentString() + " R62D-Android");
    web.addJavascriptInterface(new Bridge(), "r62dApp");
    web.setWebChromeClient(new WebChromeClient());
    web.setWebViewClient(new WebViewClient() {
      @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
        Uri u = r.getUrl(); String host = u.getHost() == null ? "" : u.getHost();
        // links out (GitHub downloads and the like) open in the phone's browser; games stay in here
        if (host.endsWith("github.com") || host.endsWith("githubusercontent.com")) { startActivity(new Intent(Intent.ACTION_VIEW, u)); return true; }
        return false;
      }
      @Override public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
        if (r.isForMainFrame() && !r.getUrl().toString().startsWith("file:")) v.loadUrl(START + "?lost=" + Uri.encode(r.getUrl().getHost()));
      }
    });
    setContentView(web);
    hideBars();
    web.loadUrl(START);
  }

  void hideBars() {
    if (Build.VERSION.SDK_INT >= 30) {
      getWindow().setDecorFitsSystemWindows(false);
      WindowInsetsController c = getWindow().getInsetsController();
      if (c != null) { c.hide(WindowInsets.Type.systemBars()); c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE); }
    } else {
      getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN
        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
    }
    if (Build.VERSION.SDK_INT >= 28) getWindow().getAttributes().layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
  }

  @Override public void onWindowFocusChanged(boolean has) { super.onWindowFocusChanged(has); if (has) hideBars(); }

  // the phone's Back button: on the start page it closes the app, in the game it is Esc (pause menu, or back a page)
  @Override public void onBackPressed() {
    String u = web.getUrl();
    if (u == null || u.startsWith("file:")) { finish(); return; }
    web.evaluateJavascript("for (const t of ['keydown','keyup']) dispatchEvent(new KeyboardEvent(t, { key: 'Escape', code: 'Escape', bubbles: true }));", null);
  }

  @Override protected void onPause() { super.onPause(); web.onPause(); }
  @Override protected void onResume() { super.onResume(); web.onResume(); hideBars(); }

  class Bridge {
    // QUIT in the game: back to the start page (the game's own quit asks first)
    @JavascriptInterface public void quit() { runOnUiThread(() -> web.loadUrl(START)); }
    // QUIT on the start page: close the app
    @JavascriptInterface public void exit() { runOnUiThread(() -> finish()); }
    // the phone's own addresses, so the start page knows which networks to look for games on: "ip/prefix ip/prefix"
    @JavascriptInterface public String nets() {
      StringBuilder b = new StringBuilder();
      try {
        for (NetworkInterface n : Collections.list(NetworkInterface.getNetworkInterfaces())) {
          if (!n.isUp() || n.isLoopback()) continue;
          for (InterfaceAddress a : n.getInterfaceAddresses())
            if (a.getAddress() instanceof Inet4Address) b.append(a.getAddress().getHostAddress()).append('/').append(a.getNetworkPrefixLength()).append(' ');
        }
      } catch (Exception e) { }
      return b.toString().trim();
    }
    @JavascriptInterface public String version() {
      try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; } catch (Exception e) { return ""; }
    }
  }
}
