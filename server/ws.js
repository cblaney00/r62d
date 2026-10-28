// A tiny WebSocket server (text frames only), so the game needs no downloads.
// Big messages are compressed (the standard "permessage-deflate", which every browser understands):
// a game update shrinks from ~6 KB to ~1 KB, so friends on slow internet don't lag.
import crypto from 'node:crypto';
import zlib from 'node:zlib';
const TAIL = Buffer.from([0x00, 0x00, 0xff, 0xff]);
import { EventEmitter } from 'node:events';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

export class Socket extends EventEmitter {
  constructor(sock, deflate = false) {
    super();
    this.deflate = deflate; this.zipped = false;
    this.sock = sock; this.buf = Buffer.alloc(0); this.open = true; this.parts = [];
    sock.setNoDelay(true);
    sock.on('data', d => { this.buf = Buffer.concat([this.buf, d]); this.parse(); });
    sock.on('close', () => this.close());
    sock.on('error', () => this.close());
  }
  parse() {
    while (this.buf.length >= 2) {
      const b0 = this.buf[0], b1 = this.buf[1];
      const fin = b0 & 0x80, op = b0 & 0x0f, masked = b1 & 0x80, rsv1 = b0 & 0x40;
      let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
      if (len > 1 << 20) return this.close();
      const need = off + (masked ? 4 : 0) + len;
      if (this.buf.length < need) return;
      let payload = this.buf.subarray(off + (masked ? 4 : 0), need);
      if (masked) {
        const m = this.buf.subarray(off, off + 4); payload = Buffer.from(payload);
        for (let i = 0; i < payload.length; i++) payload[i] ^= m[i & 3];
      }
      this.buf = this.buf.subarray(need);
      if (op === 0x8) return this.close();
      if (op === 0x9) { this.frame(0xA, payload); continue; }
      if (op === 0x1 || op === 0x0) {
        if (op === 0x1) this.zipped = !!rsv1;
        this.parts.push(payload);
        if (fin) {
          let data = Buffer.concat(this.parts); this.parts = [];
          if (this.zipped) { try { data = zlib.inflateRawSync(Buffer.concat([data, TAIL]), { finishFlush: zlib.constants.Z_SYNC_FLUSH }); } catch { return this.close(); } }
          this.emit('message', data.toString('utf8'));
        }
      }
    }
  }
  frame(op, data, zip = false) {
    if (!this.open) return;
    const len = data.length, b0 = 0x80 | op | (zip ? 0x40 : 0);
    let head;
    if (len < 126) head = Buffer.from([b0, len]);
    else if (len < 65536) { head = Buffer.alloc(4); head[0] = b0; head[1] = 126; head.writeUInt16BE(len, 2); }
    else { head = Buffer.alloc(10); head[0] = b0; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
    this.sock.write(Buffer.concat([head, data]));
  }
  send(str) {
    let data = Buffer.from(str, 'utf8');
    if (this.deflate && data.length > 256) { // each message compressed on its own (no shared history), level 3 is quick
      data = zlib.deflateRawSync(data, { level: 3, finishFlush: zlib.constants.Z_SYNC_FLUSH });
      return this.frame(0x1, data.subarray(0, data.length - 4), true);
    }
    this.frame(0x1, data);
  }
  close() {
    if (!this.open) return;
    this.open = false;
    try { this.sock.end(); } catch {}
    this.emit('close');
  }
}

export function attachWebSocket(server, path, onConnect) {
  server.on('upgrade', (req, sock) => {
    if (!req.url.startsWith(path) || !req.headers['sec-websocket-key']) return sock.destroy();
    const accept = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + GUID).digest('base64');
    const deflate = /permessage-deflate/.test(req.headers['sec-websocket-extensions'] || '');
    sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n` +
      (deflate ? 'Sec-WebSocket-Extensions: permessage-deflate; server_no_context_takeover; client_no_context_takeover\r\n' : '') + '\r\n');
    onConnect(new Socket(sock, deflate), req);
  });
}
