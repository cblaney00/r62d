// Finds cut-off text on the current screen (run in the page, e.g. as a tests/shoot.mjs "js" step with newlines removed):
// text past the window, text clipped by a box that hides overflow, and ellipsis cut-offs. Prints one line each.
(() => { const W = innerWidth, H = innerHeight, out = [];
  const name = e => (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '') || e.tagName;
  const vis = e => { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  for (const e of document.body.querySelectorAll('*')) {
    if (!vis(e) || e.closest('.hidden') || e.tagName === 'CANVAS' || e.tagName === 'OPTION') continue;
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e), txt = (e.innerText || e.value || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    let p = e.parentElement, inScroll = false; while (p) { const o = getComputedStyle(p); if (/auto|scroll/.test(o.overflowY + o.overflowX)) { inScroll = true; break; } p = p.parentElement; }
    const own = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (own && !inScroll && (r.right > W + 1 || r.bottom > H + 1 || r.left < -1 || r.top < -1)) out.push(`OFFSCREEN ${name(e)} [${r.left|0},${r.top|0},${r.right|0},${r.bottom|0}] "${txt}"`);
    if (/hidden|clip/.test(cs.overflowX + cs.overflowY) && txt && (e.scrollWidth > e.clientWidth + 2 || e.scrollHeight > e.clientHeight + 2) && cs.textOverflow !== 'ellipsis') out.push(`CLIPPED ${name(e)} ${e.scrollWidth}x${e.scrollHeight}>${e.clientWidth}x${e.clientHeight} "${txt}"`);
    if (cs.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 2) out.push(`ELLIPSIS ${name(e)} "${txt}"`);
  }
  return out.slice(0, 40).join('\n');
})()
