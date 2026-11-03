// Gives R62D.exe its own icon (the one in Explorer, on the desktop and in the taskbar) without any Windows tool:
// it finds the icon pictures already inside the .exe (Electron's) and draws ours over each one, same size and format.
//   node desktop/seticon.mjs build/R62D/R62D.exe desktop/icon.png      (needs magick)
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const [exe, png] = process.argv.slice(2);
const b = fs.readFileSync(exe);
const pe = b.readUInt32LE(0x3c);
if (b.toString('latin1', pe, pe + 4) !== 'PE\0\0') throw new Error('not a Windows program');
const nSec = b.readUInt16LE(pe + 6), optSize = b.readUInt16LE(pe + 20), opt = pe + 24;
const dirs = opt + (b.readUInt16LE(opt) === 0x20b ? 112 : 96); // PE32+ or PE32
const resRva = b.readUInt32LE(dirs + 2 * 8);
const secs = [];
for (let i = 0, s = opt + optSize; i < nSec; i++, s += 40) secs.push({ va: b.readUInt32LE(s + 12), size: Math.max(b.readUInt32LE(s + 8), b.readUInt32LE(s + 16)), raw: b.readUInt32LE(s + 20) });
const off = rva => { const s = secs.find(s => rva >= s.va && rva < s.va + s.size); return rva - s.va + s.raw; };
const root = off(resRva);

// resource tree: type -> id -> language -> data entry
const entries = dir => {
  const n = b.readUInt16LE(dir + 12) + b.readUInt16LE(dir + 14), out = [];
  for (let i = 0; i < n; i++) { const e = dir + 16 + i * 8, o = b.readUInt32LE(e + 4); out.push({ id: b.readUInt32LE(e), sub: !!(o & 0x80000000), at: root + (o & 0x7fffffff) }); }
  return out;
};
const leaf = e => { while (e.sub) e = entries(e.at)[0]; return { entry: e.at, at: off(b.readUInt32LE(e.at)), size: b.readUInt32LE(e.at + 4) }; };
const type = id => entries(root).find(e => e.id === id);
const icons = new Map(entries(type(3).at).map(e => [e.id, leaf(e)]));
const group = leaf(entries(type(14).at)[0]);

const pic = (w, h, fmt) => execFileSync('magick', [png, '-background', 'none', '-resize', `${w}x${h}!`, ...(fmt === 'png' ? ['-strip', '-colors', '128', '-define', 'png:compression-level=9', 'PNG32:-'] : ['-depth', '8', 'rgba:-'])], { maxBuffer: 1 << 26 });
const count = b.readUInt16LE(group.at + 4);
for (let i = 0; i < count; i++) {
  const g = group.at + 6 + i * 14, w = b[g] || 256, h = b[g + 1] || 256, id = b.readUInt16LE(g + 12), ic = icons.get(id);
  if (!ic) continue;
  let data;
  if (b.readUInt32LE(ic.at) === 0x474e5089) { // stored as PNG (fewer colours so it fits in the space Electron's took)
    data = pic(w, h, 'png');
    if (data.length > ic.size) { console.log(`skipped ${w}x${h}: our picture is bigger than the space for it`); continue; }
  } else { // stored as a bitmap: same header, our pixels (32-bit, bottom row first) and a clear mask
    if (b.readUInt16LE(ic.at + 14) !== 32) { console.log(`skipped ${w}x${h}: not a 32-bit picture`); continue; }
    const hdr = b.readUInt32LE(ic.at), rgba = pic(w, h, 'rgba'), maskRow = Math.ceil(w / 32) * 4;
    data = Buffer.alloc(hdr + w * h * 4 + maskRow * h);
    b.copy(data, 0, ic.at, ic.at + hdr);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4, d = hdr + ((h - 1 - y) * w + x) * 4;
      data[d] = rgba[s + 2]; data[d + 1] = rgba[s + 1]; data[d + 2] = rgba[s]; data[d + 3] = rgba[s + 3];
    }
    data.writeInt32LE(w, 4); data.writeInt32LE(2 * h, 8); data.writeUInt32LE(0, 20); // width, height (picture + mask), size worked out by Windows
    if (data.length > ic.size) { console.log(`skipped ${w}x${h}: no room`); continue; }
  }
  b.fill(0, ic.at, ic.at + ic.size);
  data.copy(b, ic.at);
  b.writeUInt32LE(data.length, ic.entry + 4); // data entry size
  b.writeUInt32LE(data.length, g + 8);        // the group's note of it
  console.log(`icon ${w}x${h} replaced`);
}
fs.writeFileSync(exe, b);
