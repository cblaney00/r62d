// First-time voice setup (he asked: so new players can talk to the bots easier). Offered once after entering the game, and
// from Settings → Sound. Reads a few orders through the same recogniser and rules a match uses; only words are logged, no sound.
import { pttDown, pttUp, pttReady, pttSetState, pttVocab } from './ptt.js';
import { parseCommand } from '/shared/commands.js';
import { actionFor, bindsFor, keyName } from './keys.js';
import * as audio from './audio.js';

const LINES = ['follow me', 'where are they', 'hold here', 'push the site'];
const meaning = t => { const r = parseCommand(t); return [r.intent, r.updown, r.site].join('|'); };
let dlg = null;
export const voiceTestOpen = () => !!dlg;
export function openVoiceTest(onClose) {
  if (dlg) return;
  const key = keyName(bindsFor('ptt')[0] || 'KeyX');
  dlg = document.createElement('div'); dlg.id = 'voiceDlg'; dlg.className = 'overlay';
  dlg.innerHTML = '<div class="menu"><h2>VOICE SETUP</h2><div id="vtBody"></div><div id="vtBtns"></div></div>';
  document.body.appendChild(dlg);
  const body = dlg.querySelector('#vtBody'), btns = dlg.querySelector('#vtBtns');
  const btn = (text, fn, primary) => { const b = document.createElement('button'); b.textContent = text; if (primary) b.className = 'primary'; b.onclick = () => { audio.ui(); fn(); }; btns.appendChild(b); };
  let i = 0, tries = 0, right = 0, busy = false, armed = false, levels = [], restore = null;
  const close = () => {
    removeEventListener('keydown', down, true); removeEventListener('keyup', up, true);
    if (restore) pttSetState(restore[0], restore[1]);
    try { localStorage.setItem('r62d-voicetest', '1'); } catch {}
    dlg.remove(); dlg = null; if (onClose) onClose();
  };
  const down = e => {
    e.stopImmediatePropagation();
    if (e.code === 'Escape') { close(); return; }
    if (armed && !busy && !e.repeat && actionFor(e.code) === 'ptt') { e.preventDefault(); busy = true; dlg.querySelector('#vtHeard').textContent = 'Listening...'; dlg.querySelector('#vtHeard').className = 'on'; pttDown(); }
  };
  const up = e => {
    e.stopImmediatePropagation();
    if (armed && busy && actionFor(e.code) === 'ptt') { armed = false; pttUp(result); }
  };
  addEventListener('keydown', down, true); addEventListener('keyup', up, true);
  const result = (text, loud) => {
    busy = false; levels.push(loud);
    try { fetch('/api/miclog', { method: 'POST', body: `test "${LINES[i]}" level ${loud.toFixed(4)} heard: ${text || '(nothing)'}` }).catch(() => {}); } catch {}
    const ok = text && meaning(text) === meaning(LINES[i]), h = dlg.querySelector('#vtHeard');
    h.className = ok ? 'good' : 'bad';
    h.textContent = ok ? `✓ ${text}` : !text ? 'No words heard' : `Heard: ${text}`;
    tries++;
    if (!ok && tries < 2) { h.textContent += ', try once more'; armed = true; return; }
    if (ok) right++;
    setTimeout(() => { if (!dlg) return; i++; tries = 0; i < LINES.length ? line() : end(); }, ok ? 900 : 1800);
  };
  const line = () => {
    armed = true; btns.innerHTML = '';
    body.innerHTML = `<p class="vtStep">${i + 1} of ${LINES.length}</p><p class="vtLine">${LINES[i]}</p><p>Hold <b>${key}</b>, say it the way you would in a match, then let go</p><div id="vtBar"><i></i></div><p id="vtHeard"></p>`;
    btn('SKIP', close);
  };
  const end = () => {
    levels.sort((a, b) => a - b); const mid = levels[levels.length >> 1] || 0;
    if (mid < 0.012) { try { localStorage.setItem('r62d-micboost', '200'); const s = document.getElementById('micBoost'); if (s) { s.value = 200; s.dispatchEvent(new Event('change')); } } catch {} }
    const say = mid < 0.004 ? 'The microphone is hearing almost nothing. Check that the right one is plugged in and not muted.'
      : right === LINES.length ? 'All set.' : right >= LINES.length - 1 ? 'That will work well.' : 'Try speaking a little slower or moving closer. You can run this again in Settings → Sound.';
    const vol = mid < 0.004 ? 'too quiet' : mid > 0.35 ? 'too loud' : 'good';
    body.innerHTML = `<p class="vtLine">${right} of ${LINES.length} understood</p><p>Microphone volume: <b>${vol}</b>. The game evens out your voice by itself, so anything marked good is fine.</p><p>${say}</p><p>In a match, hold <b>${key}</b> to give orders like "go to the kitchen" or ask "where are they". Your team's bots answer in chat. Your voice stays on this computer: only the words go to your team.</p>`;
    btns.innerHTML = ''; btn('DONE', close, true);
  };
  const start = async () => {
    btns.innerHTML = ''; body.innerHTML = '<p class="vtLine">Starting your microphone...</p><p>If your browser asks, choose Allow.</p>';
    restore = pttSetState(k => { if (k === 'nomic') noMic(); }, (t, lv) => { if (!dlg) return; const bar = dlg.querySelector('#vtBar i'); if (bar && lv) bar.style.width = (lv * 100).toFixed(0) + '%'; const h = dlg.querySelector('#vtHeard'); if (h && t) h.textContent = t; });
    pttVocab([], [], []);
    if (!await pttReady()) { noMic(); return; }
    if (dlg) line();
  };
  const noMic = () => { armed = false; body.innerHTML = '<p class="vtLine">No microphone found</p><p>Plug one in or allow it in your browser, then run this again from Settings → Sound. Everything else in the game works without one, and you can always type to your team.</p>'; btns.innerHTML = ''; btn('CLOSE', close, true); };
  body.innerHTML = `<p>You can give your team's bots orders with your voice: hold <b>${key}</b> and talk. Let's check they can understand you. It takes about a minute.</p>`;
  btn('START', start, true); btn('NOT NOW', close);
}
