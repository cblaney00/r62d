// REPLAYS (he asked 2026-11-15): the menu page with your last 3 matches, the playback bar while watching one (it plays
// through the Esports TV view: everyone visible, follow anyone, overview), and the download that asks whether you want
// the replay file or a video. The server side is server/replays.js.
import { MAPS } from '/shared/map.js';
let D = null; // { st, send, $, esc, mapThumb, switchMatch, audio }
const S = { list: [], info: null, at: 0, d: 0, p: 0, s: 1, e: 0, drag: false, rec: null };
export function initReplay(deps) { D = deps; buildBar(); buildDialog(); window.__rp = S; } // (__rp: for tests)

// ---------------- the REPLAYS page ----------------
const two = n => String(n).padStart(2, '0');
const clock = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + two(s % 60); };
const when = t => { const d = new Date(t), now = new Date(), day = d.toDateString() === now.toDateString() ? 'Today' : d.toDateString() === new Date(now - 864e5).toDateString() ? 'Yesterday' : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }); return `${day} ${two(d.getHours())}:${two(d.getMinutes())}`; };
export async function renderReplays() {
  const { $, esc } = D, el = $('rpList');
  el.innerHTML = '<p class="hint">Loading…</p>';
  try { S.list = (await (await fetch('/api/replays')).json()).list || []; } catch { S.list = []; }
  if (!S.list.length) { el.innerHTML = '<div class="rpEmpty"><b>NO REPLAYS YET</b><p class="hint">Play a Quick Match, Unranked or Ranked match: the last 3 are kept here. When the game gets a gameplay update, older replays are removed (they would no longer play back the same).</p></div>'; return; }
  el.innerHTML = '';
  for (const r of S.list) {
    const c = document.createElement('div'); c.className = 'rpCard';
    const pic = document.createElement('div'); pic.className = 'rpPic';
    if (MAPS[r.map]) { const t = D.mapThumb(r.map), cv = t.cloneNode(); cv.getContext('2d').drawImage(t, 0, 0); pic.appendChild(cv); }
    const people = r.players.filter(p => !p.b).map(p => esc(p.n)), bots = r.players.filter(p => p.b).length;
    const won = r.winner === 0 ? 'ALPHA won' : r.winner === 1 ? 'BRAVO won' : r.done ? '' : 'ended early';
    c.appendChild(pic);
    c.insertAdjacentHTML('beforeend', `<div class="rpTxt"><em>${esc(r.modeName)}</em><b>${esc(r.mapName)}</b>
      <span class="rpScore">${r.score[0]} – ${r.score[1]}</span><span class="hint">${won ? won + ' · ' : ''}${r.rounds} rounds · ${clock(r.duration)}</span>
      <span class="hint">${when(r.date)}</span><span class="rpWho">${people.join(', ')}${people.length && bots ? ' + ' : ''}${bots ? `${bots} bot${bots > 1 ? 's' : ''}` : ''}</span></div>
      <div class="rpBtns"><button class="primary" data-w>WATCH</button><button data-dl>DOWNLOAD</button></div>`);
    c.querySelector('[data-w]').onclick = () => { D.audio.ui(); watch(r.id); };
    c.querySelector('[data-dl]').onclick = () => { D.audio.ui('open'); askDownload(r); };
    el.appendChild(c);
  }
}
function watch(id, video = false) { S.info = null; S.at = 0; S.e = 0; S.video = video; D.switchMatch(null, null, { replay: id }); }
// a replay file someone downloaded: sent to the server, then watched
export function openFile() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.r62d';
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    const msg = D.$('rpMsg'); msg.textContent = 'Opening…';
    try { const r = await (await fetch('/api/replay/open', { method: 'POST', body: f })).json(); if (r.error) { msg.textContent = r.error; return; } msg.textContent = ''; watch(r.id); }
    catch { msg.textContent = 'Could not open that file.'; }
  };
  inp.click();
}

// ---------------- download: replay file or video ----------------
function buildDialog() {
  const d = document.createElement('div'); d.id = 'rpDl'; d.className = 'overlay hidden';
  d.innerHTML = `<div class="menu"><h2>DOWNLOAD</h2><p class="hint" id="rpDlWhat"></p>
    <button class="rpChoice" data-k="file"><b>REPLAY FILE</b><span>A small .r62d file. Open it again in R62D (REPLAYS → OPEN A REPLAY FILE) to watch it like this, follow anyone, change speed. Works only on the same version of the game.</span></button>
    <button class="rpChoice" data-k="video"><b>VIDEO</b><span id="rpVidTxt"></span></button>
    <button data-k="cancel">CANCEL</button></div>`;
  document.body.appendChild(d);
  d.onclick = e => { const b = e.target.closest('button'); if (!b || b.disabled) { if (e.target === d) d.classList.add('hidden'); return; }
    d.classList.add('hidden'); const r = S.dl;
    if (b.dataset.k === 'file') { const a = document.createElement('a'); a.href = '/api/replay/file?id=' + r.id; a.download = ''; document.body.appendChild(a); a.click(); a.remove(); }
    else if (b.dataset.k === 'video') recordVideo(r);
  };
}
function videoOk() { return !!(window.isSecureContext && navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia && window.MediaRecorder); }
function askDownload(r) {
  S.dl = r;
  D.$('rpDlWhat').textContent = `${r.mapName} · ${r.modeName} · ${when(r.date)}`;
  const vb = D.$('rpDl').querySelector('[data-k=video]'), ok = videoOk();
  vb.disabled = !ok;
  D.$('rpVidTxt').textContent = ok ? `A .webm video of the whole match. It plays the replay through once while it records, so it takes about ${Math.max(1, Math.round(r.duration / 60))} minutes; your browser asks which window to record (pick this one).`
    : 'Videos can only be made on the computer that saved the replay, or in the R62D program (this browser does not allow recording here).';
  D.$('rpDl').classList.remove('hidden');
}
// the video: the screen is recorded while the replay plays at normal speed from start to end, then saved
async function recordVideo(r) {
  let stream;
  try { stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30, displaySurface: 'browser' }, audio: true, preferCurrentTab: true, selfBrowserSurface: 'include', surfaceSwitching: 'exclude' }); }
  catch { D.$('rpMsg').textContent = 'The video was not started (recording was not allowed).'; return; }
  const snd = stream.getAudioTracks().length > 0; // (Firefox can't record the game's sound; Chrome and the program can)
  const types = snd ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'] : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'], type = types.find(t => MediaRecorder.isTypeSupported(t)) || '';
  const rec = new MediaRecorder(stream, { mimeType: type || undefined, videoBitsPerSecond: 8e6 }), parts = [];
  rec.ondataavailable = e => { if (e.data.size) parts.push(e.data); };
  rec.onerror = e => { console.log('video recording failed', e.error && e.error.message); D.$('rpMsg').textContent = 'The video recording failed.'; };
  S.rec = { rec, stream, r, parts, started: false, cancelled: false };
  rec.onstop = () => {
    for (const t of stream.getTracks()) t.stop();
    const R = S.rec; S.rec = null; document.documentElement.classList.remove('rprec'); D.$('rpRecTag').classList.add('hidden');
    if (!R || R.cancelled || !parts.length) return;
    const url = URL.createObjectURL(new Blob(parts, { type: 'video/webm' })), a = document.createElement('a'), d = new Date(r.date);
    a.href = url; a.download = `R62D ${r.mapName} ${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}.${two(d.getMinutes())}.webm`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
  };
  for (const t of stream.getVideoTracks()) t.onended = () => cancelVideo(); // they stopped sharing
  document.documentElement.classList.add('rprec');
  watch(r.id, true);
}
function startVideo() { // the replay is loaded: from the start, normal speed, then record
  const R = S.rec; if (!R || R.started) return;
  R.started = true; D.send({ t: 'rp', a: 'speed', v: 1 }); D.send({ t: 'rp', a: 'seek', v: 0 }); D.send({ t: 'rp', a: 'pause', v: 0 });
  setTimeout(() => { if (S.rec !== R) return; R.rec.start(1000); D.$('rpRecTag').classList.remove('hidden'); setTimeout(() => D.$('rpRecTag').classList.add('hidden'), 3000); }, 1500); // (a moment for the map to settle; the REC tag shows 3 s, then keeps out of the video)
}
export function cancelVideo() { const R = S.rec; if (!R) return; R.cancelled = true; try { R.rec.state !== 'inactive' ? R.rec.stop() : R.rec.onstop(); } catch {} }
function finishVideo() { const R = S.rec; if (R && R.started && R.rec.state === 'recording') setTimeout(() => { if (S.rec === R) R.rec.stop(); }, 3000); }

// ---------------- the playback bar ----------------
const SPEEDS = [0.25, 0.5, 1, 2, 4, 8];
function buildBar() {
  const b = document.createElement('div'); b.id = 'rpBar';
  b.innerHTML = `<button id="rpPlay" title="Play / pause (Space)">❚❚</button>
    <div class="rpSpeeds">${SPEEDS.map(v => `<button data-s="${v}">${v < 1 ? (v === 0.5 ? '½' : '¼') : v}×</button>`).join('')}</div>
    <span id="rpTime">0:00</span><div id="rpLine"><div id="rpDone"></div><div id="rpMarks"></div><div id="rpKnob"></div></div><span id="rpLen">0:00</span>
    <button id="rpBack" title="10 s back (←)">−10</button><button id="rpFwd" title="10 s on (→)">+10</button><button id="rpLeave">LEAVE</button>`;
  document.body.appendChild(b);
  const tag = document.createElement('div'); tag.id = 'rpRecTag'; tag.className = 'hidden'; tag.innerHTML = '● REC <span></span> · Esc stops'; document.body.appendChild(tag);
  const { $ } = D;
  $('rpPlay').onclick = () => D.send({ t: 'rp', a: 'pause' });
  for (const s of b.querySelectorAll('[data-s]')) s.onclick = () => D.send({ t: 'rp', a: 'speed', v: +s.dataset.s });
  $('rpBack').onclick = () => seekBy(-10); $('rpFwd').onclick = () => seekBy(10);
  $('rpLeave').onclick = () => { cancelVideo(); D.switchMatch(null); };
  const line = $('rpLine'), at = e => { const r = line.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * S.d; };
  line.onpointerdown = e => { S.drag = true; line.setPointerCapture(e.pointerId); S.at = at(e); paint(); };
  line.onpointermove = e => { if (S.drag) { S.at = at(e); paint(); } };
  line.onpointerup = e => { if (!S.drag) return; S.drag = false; D.send({ t: 'rp', a: 'seek', v: at(e) }); };
}
const seekBy = n => D.send({ t: 'rp', a: 'seek', v: S.at + n });
function paint() {
  const { $ } = D, f = S.d ? S.at / S.d : 0;
  $('rpDone').style.width = (f * 100) + '%'; $('rpKnob').style.left = (f * 100) + '%';
  $('rpTime').textContent = clock(S.at); $('rpLen').textContent = clock(S.d);
  $('rpPlay').textContent = S.p ? '▶' : '❚❚';
  for (const b of $('rpBar').querySelectorAll('[data-s]')) b.classList.toggle('on', +b.dataset.s === S.s);
  if (S.rec && S.rec.started) { $('rpRecTag').querySelector('span').textContent = `${clock(S.at)} / ${clock(S.d)}`; document.title = `● REC ${clock(S.at)} / ${clock(S.d)} · R62D`; }
  else if (document.title.startsWith('● REC')) document.title = 'R62D';
}
function status(x) {
  if (!S.drag) S.at = x.at; S.d = x.d; S.p = x.p; S.s = x.s;
  if (x.e && !S.e && S.rec) finishVideo();
  S.e = x.e; paint();
}
// messages from the replay server (main.js passes them on)
export function onMsg(m) {
  if (m.t === 'rpinfo') {
    S.info = m; S.d = m.d;
    D.$('rpMarks').innerHTML = m.rounds.map(r => `<i style="left:${(r.t / Math.max(1, m.d)) * 100}%" title="Round ${r.rd}"><span>R${r.rd}</span></i>`).join('');
    paint();
  } else if (m.t === 'rpst') status(m);
  else if (m.t === 'rpgone') { alert('That replay is gone (it was out of date or deleted).'); D.switchMatch(null); }
}
export const onSnap = s => { if (s.rp) status(s.rp); if (S.rec && !S.rec.started && S.info) startVideo(); }; // (snapshots only arrive once the map is loaded)
// keys while watching (before Esports TV's own: 1-0 follow, A director, M overview)
export function key(e) {
  if (S.rec) { if (e.code === 'Escape') { cancelVideo(); e.preventDefault(); return true; } return true; } // recording: hands off
  if (e.code === 'Space') { D.send({ t: 'rp', a: 'pause' }); return true; }
  if (e.code === 'ArrowLeft') { seekBy(-10); return true; }
  if (e.code === 'ArrowRight') { seekBy(10); return true; }
  if (e.code === 'Comma' || e.code === 'Period') { const i = SPEEDS.indexOf(S.s), j = Math.max(0, Math.min(SPEEDS.length - 1, (i < 0 ? 2 : i) + (e.code === 'Period' ? 1 : -1))); D.send({ t: 'rp', a: 'speed', v: SPEEDS[j] }); return true; }
  return false;
}
export const recording = () => !!S.rec;
