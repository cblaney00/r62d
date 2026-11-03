// Updates (he asked): each time R62D opens it asks GitHub for the releases on cblaney00/r62d. A release tagged b<n>
// (n = the game's build number) with an R62D-update.zip newer than what this computer has is fetched, checked and
// unpacked into %APPDATA%\R62D\game\<n>; the newest working copy is the one that runs. No internet = play what is here.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

const RELEASES = 'https://api.github.com/repos/cblaney00/r62d/releases?per_page=15';
const ASSET = 'R62D-update.zip';

const buildOf = dir => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'desktop', 'build.json'), 'utf8')); } catch { return null; } };

// update(bundledDir, gameRoot, say) -> the folder of the newest game copy to run
export async function update(bundled, root, say) {
  fs.mkdirSync(root, { recursive: true });
  const electron = process.versions.electron;
  // copies already here (a finished copy has its build.json; half-unpacked ones end in .part and are cleared)
  let best = { dir: bundled, n: (buildOf(bundled) || {}).n || 0 };
  for (const f of fs.readdirSync(root)) {
    const dir = path.join(root, f), b = /^\d+$/.test(f) && buildOf(dir);
    if (!b) { fs.rmSync(dir, { recursive: true, force: true }); continue; }
    if (b.n > best.n && b.electron === electron) best = { dir, n: b.n };
  }

  say('CHECKING FOR UPDATES…');
  let rel;
  try {
    const r = await fetch(RELEASES, { headers: { accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) throw new Error('GitHub answered ' + r.status);
    rel = (await r.json())
      .filter(x => !x.draft && /^b\d+$/.test(x.tag_name) && x.assets.some(a => a.name === ASSET))
      .map(x => ({ n: +x.tag_name.slice(1), asset: x.assets.find(a => a.name === ASSET) }))
      .sort((a, b) => b.n - a.n)[0];
  } catch (e) { console.log('No update check:', e.message); }
  if (!rel || rel.n <= best.n) { prune(root, best.dir); return best.dir; }

  const dir = path.join(root, String(rel.n)), part = dir + '.part';
  try {
    say('DOWNLOADING UPDATE…', 0);
    const r = await fetch(rel.asset.browser_download_url, { signal: AbortSignal.timeout(120000) });
    if (!r.ok) throw new Error('download answered ' + r.status);
    const total = +r.headers.get('content-length') || rel.asset.size, chunks = [];
    let got = 0;
    for await (const c of r.body) { chunks.push(c); got += c.length; say('DOWNLOADING UPDATE…', got / total); }
    const zip = Buffer.concat(chunks.map(c => Buffer.from(c)));
    const sum = (rel.asset.digest || '').replace(/^sha256:/, '');
    if (sum && crypto.createHash('sha256').update(zip).digest('hex') !== sum) throw new Error('the download came in damaged');
    say('INSTALLING UPDATE…', 1);
    fs.rmSync(part, { recursive: true, force: true });
    unzip(zip, part);
    const b = buildOf(part);
    if (!b || b.n !== rel.n) throw new Error('the update is incomplete');
    if (b.electron !== electron) { // needs a newer program around it: keep playing this one
      fs.rmSync(part, { recursive: true, force: true });
      say('A NEW VERSION NEEDS A FRESH DOWNLOAD FROM THE R62D PAGE');
      await new Promise(ok => setTimeout(ok, 2500));
      return best.dir;
    }
    fs.rmSync(dir, { recursive: true, force: true });
    fs.renameSync(part, dir);
    prune(root, dir);
    return dir;
  } catch (e) {
    console.log('Update failed:', e.message);
    fs.rmSync(part, { recursive: true, force: true });
    say('UPDATE FAILED, STARTING THE VERSION YOU HAVE');
    await new Promise(ok => setTimeout(ok, 1500));
    return best.dir;
  }
}

// only the copy in use is kept
function prune(root, keep) {
  for (const f of fs.readdirSync(root)) { const d = path.join(root, f); if (d !== keep) fs.rmSync(d, { recursive: true, force: true }); }
}

// a small .zip reader (stored or deflated files), enough for the update made by desktop/release.sh
function unzip(buf, to) {
  let end = buf.length - 22;
  while (end >= 0 && buf.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0) throw new Error('not a zip file');
  let p = buf.readUInt32LE(end + 16);
  const count = buf.readUInt16LE(end + 10), base = path.resolve(to);
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('broken zip file');
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), nlen = buf.readUInt16LE(p + 28);
    const local = buf.readUInt32LE(p + 42), name = buf.toString('utf8', p + 46, p + 46 + nlen);
    p += 46 + nlen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
    const out = path.resolve(base, name);
    if (!out.startsWith(base + path.sep)) throw new Error('bad file name in update');
    if (name.endsWith('/')) { fs.mkdirSync(out, { recursive: true }); continue; }
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28), data = buf.subarray(start, start + csize);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, method === 0 ? data : method === 8 ? zlib.inflateRawSync(data) : (() => { throw new Error('unknown packing in update'); })());
  }
}
