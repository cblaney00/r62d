// Node's zlib, for the phone (see fs.js): only replays use it, and a phone doesn't keep replays
const sink = () => { const s = { write() { return true; }, end() {}, on() { return s; }, pipe(x) { return x; } }; return s; };
export const constants = { Z_SYNC_FLUSH: 2 };
export const createGzip = sink;
export function gunzipSync() { throw new Error('no replays on a phone'); }
export default { constants, createGzip, gunzipSync };
