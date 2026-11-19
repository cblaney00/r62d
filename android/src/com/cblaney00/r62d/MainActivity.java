package com.cblaney00.r62d;

// The whole Android app: a full-screen, landscape web view. It starts on assets/start.html, which offers:
//  - PLAY ON THIS PHONE (he asked 2026-11-16: no computer needed): the game's own files are served to the web view from
//    https://local.r62d/ (shouldInterceptRequest below; nothing goes over the network) and the game's server runs inside
//    the page (public/phone/). The files come from the newest "game pack": the copy built into the app, or a newer
//    R62D-update.zip from the GitHub releases, fetched each time the app opens (Updater) and kept in the app's storage.
//  - JOIN: a game hosted on a computer (home Wi-Fi or Lando's VPN), shown straight from that computer.
// The page sees this app as window.r62dApp (the name the Windows program uses), so main.js knows it is in an app.

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.DisplayCutout;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.RoundedCorner;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.Inet4Address;
import java.net.InterfaceAddress;
import java.net.NetworkInterface;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.json.JSONArray;
import org.json.JSONObject;

public class MainActivity extends Activity {
  static final String START = "file:///android_asset/start.html";
  static final String HOST = "local.r62d", LOCAL = "https://" + HOST + "/";
  // What this app can run. A game pack says which app it needs ("android" in desktop/build.json); a pack asking for more
  // than this waits for a new app (the start page then offers the download).
  static final int APP_LEVEL = 1;
  static final String RELEASES = "https://api.github.com/repos/cblaney00/r62d/releases?per_page=15", ASSET = "R62D-update.zip";

  WebView web;
  volatile File packDir = null;  // null = the pack built into the app (assets/game)
  volatile int packN = 0;        // its build number
  volatile String packVer = "", status = "", needApp = "";
  volatile String insets = "{}"; // the screen edges to keep clear, in page pixels (measureInsets)
  File readyDir = null; int readyN = 0; String readyVer = ""; // a newer pack downloaded while you were playing: used next PLAY

  @Override protected void onCreate(Bundle saved) {
    super.onCreate(saved);
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); // no screen dimming mid-round
    pickPack();
    web = new WebView(this);
    web.setBackgroundColor(0xff05070a);
    WebSettings s = web.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);           // profile token, settings, the phone's saved profiles
    s.setMediaPlaybackRequiresUserGesture(false);
    s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
    s.setUserAgentString(s.getUserAgentString() + " R62D-Android");
    web.addJavascriptInterface(new Bridge(), "r62dApp");
    web.addOnLayoutChangeListener((v, a, b, c, d, e, f, g, h) -> measureInsets()); // turning the phone moves the camera hole
    web.setWebChromeClient(new WebChromeClient());
    web.setWebViewClient(new WebViewClient() {
      @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
        Uri u = r.getUrl(); String host = u.getHost() == null ? "" : u.getHost();
        // links out (GitHub downloads and the like) open in the phone's browser; games stay in here
        if (host.endsWith("github.com") || host.endsWith("githubusercontent.com")) { startActivity(new Intent(Intent.ACTION_VIEW, u)); return true; }
        return false;
      }
      @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
        return HOST.equals(r.getUrl().getHost()) ? serve(r.getUrl().getPath()) : null;
      }
      @Override public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
        String u = r.getUrl().toString();
        if (r.isForMainFrame() && !u.startsWith("file:") && !u.startsWith(LOCAL)) v.loadUrl(START + "?lost=" + Uri.encode(r.getUrl().getHost()));
      }
    });
    setContentView(web);
    hideBars();
    web.loadUrl(START);
    new Thread(this::update, "r62d-update").start();
  }

  // ---------------- the game's files, for PLAY ON THIS PHONE ----------------
  static final Map<String, String> TYPES = new HashMap<>();
  static {
    TYPES.put("html", "text/html"); TYPES.put("js", "text/javascript"); TYPES.put("mjs", "text/javascript"); TYPES.put("css", "text/css");
    TYPES.put("png", "image/png"); TYPES.put("svg", "image/svg+xml"); TYPES.put("json", "application/json"); TYPES.put("ogg", "audio/ogg");
    TYPES.put("wasm", "application/wasm"); TYPES.put("jpg", "image/jpeg"); TYPES.put("webp", "image/webp"); TYPES.put("woff2", "font/woff2");
  }
  WebResourceResponse serve(String p) {
    if (p == null || p.equals("/")) p = "/index.html";
    if (p.contains("..")) return missing();
    String rel = p.startsWith("/server/") || p.startsWith("/shared/") ? p.substring(1) : "public" + p;
    try {
      File d = packDir;
      InputStream in = d != null ? new FileInputStream(new File(d, rel)) : getAssets().open("game/" + rel);
      String ext = p.substring(p.lastIndexOf('.') + 1).toLowerCase();
      if (ext.equals("js") || ext.equals("html")) in = new ByteArrayInputStream(rewrite(p, new String(readAll(in), StandardCharsets.UTF_8)).getBytes(StandardCharsets.UTF_8));
      Map<String, String> h = new HashMap<>(); h.put("Cache-Control", "no-cache"); h.put("Access-Control-Allow-Origin", "*");
      String type = TYPES.get(ext);
      return new WebResourceResponse(type != null ? type : "application/octet-stream", "utf-8", 200, "OK", h, in);
    } catch (Exception e) { return missing(); }
  }
  WebResourceResponse missing() { return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", new HashMap<>(), new ByteArrayInputStream(new byte[0])); }
  // The same rules as tests/phonehost.mjs: the server's Node parts swapped for public/phone/node/*, and the phone's shim
  // first in the page, so the game's server runs in the page.
  static String rewrite(String p, String t) {
    if (p.startsWith("/server/") && p.endsWith(".js")) return t.replaceAll("from 'node:(\\w+)'", "from '/phone/node/$1.js'").replace("process.env", "__PENV").replace(".unref()", "");
    if (p.equals("/index.html")) return t.replace("<head>", "<head><script src=\"/phone/shim.js\"></script>");
    return t;
  }
  static byte[] readAll(InputStream in) throws java.io.IOException {
    ByteArrayOutputStream o = new ByteArrayOutputStream(); byte[] b = new byte[16384]; int n;
    try { while ((n = in.read(b)) > 0) o.write(b, 0, n); } finally { in.close(); }
    return o.toByteArray();
  }

  // ---------------- game packs ----------------
  // build.json of a pack: { version, date, n, android }
  JSONObject buildOf(File d) {
    try { return new JSONObject(new String(d == null ? readAll(getAssets().open("game/desktop/build.json")) : readAll(new FileInputStream(new File(d, "desktop/build.json"))), StandardCharsets.UTF_8)); }
    catch (Exception e) { return null; }
  }
  File packs() { File f = new File(getFilesDir(), "game"); f.mkdirs(); return f; }
  // the newest pack this app can run: the built-in one, or a downloaded one that is newer
  void pickPack() {
    JSONObject b = buildOf(null); packDir = null; packN = b != null ? b.optInt("n") : 0; packVer = b != null ? b.optString("version") : "";
    File[] list = packs().listFiles(); if (list == null) return;
    for (File d : list) {
      if (!d.isDirectory() || !d.getName().matches("\\d+")) continue;
      JSONObject x = buildOf(d);
      if (x != null && x.optInt("n") > packN && x.optInt("android") >= 1 && x.optInt("android") <= APP_LEVEL) { packDir = d; packN = x.optInt("n"); packVer = x.optString("version"); }
    }
  }
  void say(String s) { status = s; runOnUiThread(() -> { if (web.getUrl() != null && web.getUrl().startsWith("file:")) web.evaluateJavascript("window.onPack && onPack()", null); }); }
  // Each time the app opens (he asked): the newest release's game files, if newer than what is here. No internet: play
  // what is here.
  void update() {
    try {
      say("Checking for a newer game…");
      JSONArray rels = new JSONArray(new String(get(RELEASES), StandardCharsets.UTF_8));
      int bestN = 0; JSONObject bestA = null;
      for (int i = 0; i < rels.length(); i++) {
        JSONObject r = rels.getJSONObject(i); String tag = r.optString("tag_name");
        if (r.optBoolean("draft") || !tag.matches("b\\d+")) continue;
        JSONArray as = r.getJSONArray("assets");
        for (int j = 0; j < as.length(); j++) if (ASSET.equals(as.getJSONObject(j).optString("name")) && Integer.parseInt(tag.substring(1)) > bestN) { bestN = Integer.parseInt(tag.substring(1)); bestA = as.getJSONObject(j); }
      }
      if (bestA == null || bestN <= packN) { say("Game up to date"); return; }
      File d = new File(packs(), String.valueOf(bestN));
      JSONObject have = d.isDirectory() ? buildOf(d) : null;
      if (have == null) {
        say("Downloading the newest game (build " + bestN + ")…");
        byte[] zip = get(bestA.getString("browser_download_url"));
        String want = bestA.optString("digest", "").replace("sha256:", "");
        if (!want.isEmpty() && !hex(MessageDigest.getInstance("SHA-256").digest(zip)).equals(want)) { say("The download came in damaged: playing build " + packN); return; }
        File tmp = new File(packs(), bestN + ".tmp"); wipe(tmp); unzip(zip, tmp);
        have = buildOf(tmp);
        if (have == null) { wipe(tmp); say("That download wasn't a game: playing build " + packN); return; }
        wipe(d); if (!tmp.renameTo(d)) { wipe(tmp); say("Couldn't store the update: playing build " + packN); return; }
      }
      int lvl = have.optInt("android");
      if (lvl < 1 || lvl > APP_LEVEL) { needApp = "Build " + bestN + " needs a newer R62D app"; say(lvl > APP_LEVEL ? needApp : "Game up to date"); return; }
      synchronized (this) { readyDir = d; readyN = bestN; readyVer = have.optString("version"); }
      runOnUiThread(() -> { String u = web.getUrl(); if (u == null || !u.startsWith(LOCAL)) usePending(); }); // not mid-game: switch now
      say("Updated to build " + bestN);
    } catch (Exception e) { say(packN > 0 ? "Couldn't check for updates (offline?)" : "Offline"); }
  }
  synchronized void usePending() {
    if (readyDir == null) return;
    packDir = readyDir; packN = readyN; packVer = readyVer; readyDir = null;
    File[] list = packs().listFiles(); // old packs go
    if (list != null) for (File f : list) if (!f.equals(packDir)) wipe(f);
  }
  static byte[] get(String u) throws Exception {
    HttpURLConnection c = (HttpURLConnection) new URL(u).openConnection();
    c.setConnectTimeout(6000); c.setReadTimeout(20000); c.setInstanceFollowRedirects(true);
    c.setRequestProperty("User-Agent", "R62D-Android"); c.setRequestProperty("Accept", "application/vnd.github+json, */*");
    try { if (c.getResponseCode() != 200) throw new Exception("HTTP " + c.getResponseCode()); return readAll(c.getInputStream()); } finally { c.disconnect(); }
  }
  static String hex(byte[] b) { StringBuilder s = new StringBuilder(); for (byte x : b) s.append(String.format("%02x", x)); return s.toString(); }
  static void wipe(File f) { File[] l = f.listFiles(); if (l != null) for (File x : l) wipe(x); f.delete(); }
  static void unzip(byte[] zip, File to) throws Exception {
    String root = to.getCanonicalPath() + File.separator;
    try (ZipInputStream z = new ZipInputStream(new ByteArrayInputStream(zip))) {
      ZipEntry e; byte[] b = new byte[16384];
      while ((e = z.getNextEntry()) != null) {
        File f = new File(to, e.getName());
        if (!f.getCanonicalPath().startsWith(root)) throw new Exception("bad path in the update");
        if (e.isDirectory()) { f.mkdirs(); continue; }
        f.getParentFile().mkdirs();
        try (FileOutputStream o = new FileOutputStream(f)) { int n; while ((n = z.read(b)) > 0) o.write(b, 0, n); }
      }
    }
  }

  // ---------------- the window ----------------
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
  @Override public void onWindowFocusChanged(boolean has) { super.onWindowFocusChanged(has); if (has) { hideBars(); measureInsets(); } }
  // The camera hole and the rounded screen corners (he asked 2026-11-18): how far in from each edge the game keeps its
  // buttons and text. The hole: Android's safe strip on that side. A rounded corner of radius r cuts off a square
  // 0.3 r deep from both edges next to it. In page (CSS) pixels; the page asks with insets() and hears onInsets().
  void measureInsets() {
    try {
      WindowInsets w = getWindow().getDecorView().getRootWindowInsets(); if (w == null) return;
      float d = getResources().getDisplayMetrics().density, l = 0, t = 0, r = 0, b = 0;
      // (he asked 2026-11-18: the whole screen moved away from the camera hole and looked lopsided; now the edges only keep
      // clear of the rounded corners, and the hole itself goes to the page as a box, so only what would sit on it moves)
      org.json.JSONArray holes = new org.json.JSONArray();
      if (Build.VERSION.SDK_INT >= 28) { DisplayCutout c = w.getDisplayCutout(); if (c != null) for (android.graphics.Rect h : c.getBoundingRects()) holes.put(new JSONObject().put("x", h.left / d).put("y", h.top / d).put("w", h.width() / d).put("h", h.height() / d)); }
      if (Build.VERSION.SDK_INT >= 31) {
        RoundedCorner tl = w.getRoundedCorner(RoundedCorner.POSITION_TOP_LEFT), tr = w.getRoundedCorner(RoundedCorner.POSITION_TOP_RIGHT),
          bl = w.getRoundedCorner(RoundedCorner.POSITION_BOTTOM_LEFT), br = w.getRoundedCorner(RoundedCorner.POSITION_BOTTOM_RIGHT);
        float k = 0.3f, a = tl == null ? 0 : tl.getRadius() * k, e = tr == null ? 0 : tr.getRadius() * k, f = bl == null ? 0 : bl.getRadius() * k, g = br == null ? 0 : br.getRadius() * k;
        l = Math.max(l, Math.max(a, f)); r = Math.max(r, Math.max(e, g)); t = Math.max(t, Math.max(a, e)); b = Math.max(b, Math.max(f, g));
      }
      String n = new JSONObject().put("l", l / d).put("t", t / d).put("r", r / d).put("b", b / d).put("holes", holes).toString();
      if (!n.equals(insets)) { insets = n; web.evaluateJavascript("window.onInsets && onInsets()", null); }
    } catch (Exception ex) {}
  }

  // a controller (he asked 2026-11-18: a phone in a controller attachment): its buttons go to the page (the browser's
  // controller support reads them) and count as handled, so Android never turns an unused one, B above all, into Back
  @Override public boolean dispatchKeyEvent(KeyEvent e) {
    int s = e.getSource();
    boolean pad = (s & InputDevice.SOURCE_GAMEPAD) == InputDevice.SOURCE_GAMEPAD || (s & InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK;
    if (pad && e.getKeyCode() != KeyEvent.KEYCODE_BACK) { super.dispatchKeyEvent(e); return true; }
    return super.dispatchKeyEvent(e);
  }
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
    // PLAY ON THIS PHONE: the newest pack here, its server in the page
    @JavascriptInterface public void play() { runOnUiThread(() -> { usePending(); web.loadUrl(LOCAL); }); }
    // for the start page: which game is here and how the update check went
    @JavascriptInterface public String pack() {
      try { return new JSONObject().put("n", packN).put("version", packVer).put("status", status).put("needApp", needApp).put("app", APP_LEVEL).toString(); } catch (Exception e) { return "{}"; }
    }
    @JavascriptInterface public String insets() { return insets; }
    @JavascriptInterface public String gameVersion() { return packVer + (packN > 0 ? " (build " + packN + ")" : ""); }
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
