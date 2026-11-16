// Builds "R62D — Complete Change History" (.docx): every saved change by day (git history) and his finished ideas
// (r6-todo.md). Run by tools/changelog/update.sh after every commit and when the game opens (he asked 2026-11-16:
// kept up to date in his Documents folder). Needs the docx npm package (update.sh keeps one outside the project).
// Usage: node make.cjs <out.docx>
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, LevelFormat, Table, TableRow, TableCell, WidthType,
  ShadingType, BorderStyle, Footer, Header, PageNumber, PageBreak, TableOfContents,
} = require('docx');

const OUT = process.argv[2] || 'R62D-change-history.docx';
const GOLD = 'B8860B', DARK = '1F2933', DIM = '5F6B76', BLUE = '2F6FB3';

// ---------- text clean-up: plain words for a reader, "you" instead of "he" ----------
function plain(t) {
  return String(t)
    .replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1')
    .replace(/\(([^()]*?)\)/g, (m, inner) => /[a-z][A-Z]|_[A-Z]|\.js\b|\/api|\b[A-Z0-9]+_[A-Z0-9_]+\b|\w+\(\)/.test(inner) ? '' : m) // code-only brackets go
    .replace(/\bhe asked\b/g, 'you asked').replace(/\bHe asked\b/g, 'You asked').replace(/\bhe chose\b/g, 'you chose').replace(/\bHe chose\b/g, 'You chose')
    .replace(/\bhe says\b/g, 'you said').replace(/\bhe said\b/g, 'you said').replace(/\bHe said\b/g, 'You said').replace(/\bhe saw\b/g, 'you saw')
    .replace(/\bhe found\b/g, 'you found').replace(/\bhe decided\b/g, 'you decided').replace(/\bhe meant\b/g, 'you meant').replace(/\bhe wants\b/g, 'you want')
    .replace(/\bhe played\b/g, 'you played').replace(/\bhe set\b/g, 'you set').replace(/\bhe should\b/g, 'you should').replace(/\bhe can\b/g, 'you can')
    .replace(/\bhis (screen|words|times|choices?|choice|real|PC|GPU|own|voice|list|ideas?|profile|kind of|desktop|Firefox|computer|phone|live notes|test|first|range|band|computer's)\b/g, 'your $1').replace(/\bHis (choices?|words|idea|list)\b/g, 'Your $1')
    .replace(/\btell him\b/g, 'tell you').replace(/\bfor him\b/g, 'for you').replace(/\bhe has\b/g, 'you have').replace(/\bhe had\b/g, 'you had').replace(/\bhe likes\b/g, 'you like').replace(/\bhe thought\b/g, 'you thought').replace(/\bhe sees\b/g, 'you see').replace(/\bhe noticed\b/g, 'you noticed').replace(/\bhe confirmed\b/g, 'you confirmed').replace(/\bhe gave\b/g, 'you gave').replace(/\bhe was\b/g, 'you were')
    .replace(/\bby him\b/g, 'by you').replace(/\bto him\b/g, 'to you').replace(/Not yet (played|seen|watched|tried|used)( [a-z ]+)? by you/g, 'Not yet $1$2 by you at the time')
    .replace(/\s+([,.;:])/g, '$1').replace(/\(\s*\)/g, '').replace(/\s{2,}/g, ' ').trim();
}
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;

// ---------- Part 1: every change, by day ----------
const SKIP = /^(Change history|Idea list|To-?do|Todo|Notes?\b|List\b|List and notes|Tidy todo|Add new ideas|chore:|Note |Note his|Plan for|Ticked off|Record the|Build progress|Remove the temporary build|Roadmap|One idea list|Four new ideas|His choices|Balance notes|Lag item done|Cars lighting: he confirmed|Smoothness confirmed|Push to talk tried|Batch notes)/i;
const commits = execFileSync('git', ['-C', ROOT, 'log', '--reverse', '--format=%ad%x1f%s%x1f%b%x1e', '--date=short'], { encoding: 'utf8', maxBuffer: 64 << 20 }).split('\x1e').map(s => s.trim()).filter(Boolean).map(s => { const [d, subj, body] = s.split('\x1f'); return { d, subj: subj.trim(), body: (body || '').trim() }; });
const days = new Map();
for (const c of commits) {
  if (SKIP.test(c.subj)) continue;
  const parts = c.subj.replace(/^(feat|fix):\s*/i, '').split(/;\s+(?=[A-Za-z])/).map(plain).filter(x => x.length > 2);
  if (!days.has(c.d)) days.set(c.d, []);
  days.get(c.d).push({ main: cap(parts[0]), more: parts.slice(1).map(cap), body: c.body ? c.body.split('\n').map(plain).filter(x => x && !/^Co-Authored-By/i.test(x)) : [] });
}
// one line per day for the summary table; days not in days.json get their first changes instead (update it when a day's work ends)
const SUM0 = JSON.parse(fs.readFileSync(path.join(__dirname, 'days.json'), 'utf8'));
const SUM = new Proxy(SUM0, { get: (o, d) => o[d] || (days.get(d) ? days.get(d).slice(0, 4).map(c => c.main).join('. ') + '.' : '') });

// ---------- Part 2: his idea list, oldest first ----------
const todo = fs.readFileSync(path.join(ROOT, 'r6-todo.md'), 'utf8').split('\n');
const done = [];
let inDone = false, cur = null;
for (const line of todo) {
  if (/^## Done/.test(line)) { inDone = true; continue; }
  if (!inDone) continue;
  const m = /^- \[x\]\s+(.*)$/.exec(line);
  if (m) { cur = { text: m[1], sub: [] }; done.push(cur); continue; }
  const s = /^\s+(?:- \[x\]\s+|-\s+)?(.*\S)\s*$/.exec(line);
  if (s && cur) { if (/^\s+- /.test(line)) cur.sub.push(s[1]); else cur.text += ' ' + s[1]; }
}
done.reverse();
// split an item into the request and what was done
function splitItem(t) {
  t = t.replace(/^\(you asked [^)]*\)\s*/i, '').replace(/^\(he asked [^)]*\)\s*/i, '').trim();
  // the answer is the bracket that closes the item: find the "(" matching its last ")"
  const end = /\)\.?$/.test(t) ? t.lastIndexOf(')') : -1; let at = -1;
  if (end > 0) { let depth = 0; for (let i = end; i >= 0; i--) { if (t[i] === ')') depth++; else if (t[i] === '(') { depth--; if (depth === 0) { at = i; break; } } } }
  if (at < 15) { // no closing bracket: the first sentence is the idea, the rest what was done
    const p = plain(t), m = /^(.{20,}?[.!?:])\s+(?=[A-Z"])/.exec(p);
    return m ? { ask: m[1], did: p.slice(m[0].length) } : { ask: p, did: '' };
  }
  let ask = t.slice(0, at).trim(), did = t.slice(at + 1, end).trim();
  did = did.replace(/^DONE\s*(\d{4}-\d\d-\d\d)?\s*:?\s*/i, (x, d) => d ? `Done ${d}: ` : '');
  return { ask: plain(ask), did: plain(did) };
}

// ---------- document ----------
const DAYN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const nice = d => { const [y, m, dd] = d.split('-').map(Number), D = new Date(Date.UTC(y, m - 1, dd)); return `${DAYN[D.getUTCDay()]} ${dd} ${MON[m - 1]} ${y}`; };
const P = (text, o = {}) => new Paragraph({ spacing: { after: o.after ?? 120, before: o.before ?? 0, line: 276 }, alignment: o.align, children: [new TextRun({ text, size: o.size ?? 22, bold: o.bold, italics: o.italics, color: o.color })] });
const border = { style: BorderStyle.SINGLE, size: 4, color: 'D0D5DA' }, borders = { top: border, bottom: border, left: border, right: border };
const cell = (text, w, o = {}) => new TableCell({ borders, width: { size: w, type: WidthType.DXA }, shading: o.fill ? { fill: o.fill, type: ShadingType.CLEAR, color: 'auto' } : undefined, margins: { top: 80, bottom: 80, left: 120, right: 120 },
  children: [new Paragraph({ children: [new TextRun({ text, bold: o.bold, size: o.size ?? 19, color: o.color })] })] });

const children = [];
// title page
children.push(new Paragraph({ spacing: { before: 2400, after: 200 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'R62D', size: 96, bold: true, color: DARK, font: 'Arial' })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: 'Complete Change History', size: 40, color: GOLD, bold: true })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [new TextRun({ text: `Every change to the game, from the first day (${nice([...days.keys()][0])}) to ${nice([...days.keys()].pop())}`, size: 24, color: DIM })] }));
const nChanges = [...days.values()].reduce((a, l) => a + l.length, 0);
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: `${days.size} days of work · ${nChanges} saved changes · ${done.length} of your ideas built`, size: 22, color: DARK, bold: true })] }));
children.push(new Paragraph({ children: [new PageBreak()] }));

// how to read
children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('About this document')] }));
children.push(P('This document lists everything that has changed in R62D since the project was created. It has two parts:'));
children.push(new Paragraph({ numbering: { reference: 'bul', level: 0 }, spacing: { after: 80 }, children: [new TextRun({ text: 'Part 1, Day by day: ', bold: true, size: 22 }), new TextRun({ text: 'every change saved to the game, in date order. This includes the things you asked for and everything done along the way that affected the game: bug fixes, speed-ups, balance changes, bot behaviour, tests and tools. Planning notes and idea-list bookkeeping are left out.', size: 22 })] }));
children.push(new Paragraph({ numbering: { reference: 'bul', level: 0 }, spacing: { after: 200 }, children: [new TextRun({ text: 'Part 2, Your ideas and what was built: ', bold: true, size: 22 }), new TextRun({ text: 'every finished item from your idea list, oldest first: what you asked for (in bold), then what was built and what you chose along the way.', size: 22 })] }));
children.push(P('Days that are missing are days nothing was saved. Some entries mention things you had not yet tried at the time they were made. This document rebuilds itself after every change to the game.', { color: DIM, size: 20 }));

// at a glance table
children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('At a glance')] }));
const W1 = 1900, W2 = 1200, W3 = 6260;
const rows = [new TableRow({ tableHeader: true, children: [cell('Date', W1, { bold: true, fill: '1F2933', color: 'FFFFFF' }), cell('Changes', W2, { bold: true, fill: '1F2933', color: 'FFFFFF' }), cell('Highlights', W3, { bold: true, fill: '1F2933', color: 'FFFFFF' })] })];
let alt = false;
for (const [d, list] of days) { rows.push(new TableRow({ children: [cell(nice(d), W1, { fill: alt ? 'F4F6F8' : undefined, bold: true }), cell(String(list.length), W2, { fill: alt ? 'F4F6F8' : undefined }), cell(SUM[d] || '', W3, { fill: alt ? 'F4F6F8' : undefined, size: 18 })] })); alt = !alt; }
children.push(new Table({ width: { size: W1 + W2 + W3, type: WidthType.DXA }, columnWidths: [W1, W2, W3], rows }));


// Part 1
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Part 1: Day by day')] }));
children.push(P('Every saved change, in the order it was made. The first line of each entry is the change; indented lines are more of the same change.', { color: DIM, size: 20 }));
for (const [d, list] of days) {
  children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(`${nice(d)}  ·  ${list.length} change${list.length === 1 ? '' : 's'}`)] }));
  if (SUM[d]) children.push(new Paragraph({ spacing: { after: 160 }, border: { left: { style: BorderStyle.SINGLE, size: 18, color: GOLD, space: 8 } }, indent: { left: 200 }, children: [new TextRun({ text: SUM[d], italics: true, size: 21, color: DARK })] }));
  for (const c of list) {
    children.push(new Paragraph({ numbering: { reference: 'bul', level: 0 }, spacing: { after: 60, line: 264 }, children: [new TextRun({ text: c.main, size: 21 })] }));
    for (const x of c.more.concat(c.body)) children.push(new Paragraph({ numbering: { reference: 'bul', level: 1 }, spacing: { after: 40, line: 264 }, children: [new TextRun({ text: x, size: 20, color: '39424C' })] }));
  }
}

// Part 2
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Part 2: Your ideas and what was built')] }));
children.push(P(`All ${done.length} finished items from your idea list, oldest first. Bold: what you asked for. Below it: what was built, including the choices you made when asked.`, { color: DIM, size: 20 }));
done.forEach((it, i) => {
  const { ask, did } = splitItem(it.text);
  children.push(new Paragraph({ keepNext: true, spacing: { before: 160, after: did || it.sub.length ? 40 : 100 }, children: [new TextRun({ text: `${i + 1}.  `, bold: true, color: GOLD, size: 21 }), new TextRun({ text: cap(ask), bold: true, size: 21, color: DARK })] }));
  if (did) children.push(new Paragraph({ indent: { left: 360 }, spacing: { after: 60, line: 264 }, children: [new TextRun({ text: cap(did), size: 20, color: '39424C' })] }));
  for (const s of it.sub) { const sp = splitItem(s); children.push(new Paragraph({ numbering: { reference: 'bul', level: 1 }, spacing: { after: 40, line: 264 }, children: [new TextRun({ text: cap(sp.ask + (sp.did ? ' — ' + sp.did : '')), size: 20, color: '39424C' })] })); }
});

const doc = new Document({
  creator: 'R62D', title: 'R62D — Complete Change History', description: 'Every change to R62D by date',
  styles: {
    default: { document: { run: { font: 'Arial', size: 22, color: '222222' } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Arial', size: 36, bold: true, color: DARK }, paragraph: { spacing: { before: 360, after: 200 }, keepNext: true, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Arial', size: 28, bold: true, color: BLUE }, paragraph: { spacing: { before: 320, after: 120 }, keepNext: true, outlineLevel: 1, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'D0D5DA', space: 4 } } } },
    ],
  },
  numbering: { config: [{ reference: 'bul', levels: [
    { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 260 } } } },
    { level: 1, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 760, hanging: 260 } } } },
  ] }] },
  features: { updateFields: true },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1200, bottom: 1200, left: 1440, right: 1440 } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'R62D · Complete Change History', size: 16, color: DIM })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Page ', size: 16, color: DIM }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: DIM })] })] }) },
    children,
  }],
});
Packer.toBuffer(doc).then(b => { fs.writeFileSync(OUT + '.tmp', b); fs.renameSync(OUT + '.tmp', OUT); console.log('wrote', OUT, b.length, 'bytes;', days.size, 'days,', nChanges, 'changes,', done.length, 'ideas'); });
