// Node's crypto, for the phone (see fs.js): random ids, and a quick fingerprint (not a real sha; only compared with itself)
const hex = b => [...b].map(x => x.toString(16).padStart(2, '0')).join('');
export function randomBytes(n) { const b = crypto.getRandomValues(new Uint8Array(n)); return { toString: () => hex(b), length: n }; }
export function createHash() {
  let a = 0x811c9dc5, b = 0x01000193, c = 0x9e3779b9;
  const h = { update(d) { const s = typeof d === 'string' ? d : new TextDecoder().decode(d); for (let i = 0; i < s.length; i++) { const x = s.charCodeAt(i); a = Math.imul(a ^ x, 16777619); b = Math.imul(b + x, 2246822519); c = Math.imul(c ^ (x + i), 3266489917); } return h; },
    digest: () => [a, b, c, a ^ b ^ c].map(x => (x >>> 0).toString(16).padStart(8, '0')).join('') };
  return h;
}
export default { randomBytes, createHash };
