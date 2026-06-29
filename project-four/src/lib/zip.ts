// 极简 ZIP 打包（仅存储 / 不压缩）——发票多是 jpg/pdf，本身已压缩，store 即可，零依赖。
const enc = new TextEncoder();

function crc32(buf: Uint8Array): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

export function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const locals: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const size = f.data.length;
    const lh = new Uint8Array(30 + name.length);
    const dv = new DataView(lh.buffer);
    dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 0, true);
    dv.setUint16(8, 0, true); dv.setUint16(10, 0, true); dv.setUint16(12, 0x21, true); // 固定一个时间，避免依赖 Date
    dv.setUint32(14, crc, true); dv.setUint32(18, size, true); dv.setUint32(22, size, true);
    dv.setUint16(26, name.length, true); dv.setUint16(28, 0, true);
    lh.set(name, 30);
    locals.push(lh, f.data);

    const ch = new Uint8Array(46 + name.length);
    const cv = new DataView(ch.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true); cv.setUint16(10, 0, true); cv.setUint16(12, 0, true); cv.setUint16(14, 0x21, true);
    cv.setUint32(16, crc, true); cv.setUint32(20, size, true); cv.setUint32(24, size, true);
    cv.setUint16(28, name.length, true); cv.setUint16(30, 0, true); cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true); cv.setUint16(36, 0, true); cv.setUint32(38, 0, true); cv.setUint32(42, offset, true);
    ch.set(name, 46);
    central.push(ch);
    offset += lh.length + size;
  }
  const centralSize = central.reduce((s, c) => s + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true); ev.setUint32(16, offset, true);

  const out = new Uint8Array(offset + centralSize + 22);
  let p = 0;
  for (const c of locals) { out.set(c, p); p += c.length; }
  for (const c of central) { out.set(c, p); p += c.length; }
  out.set(eocd, p);
  return out;
}

export function isPdf(dataUrl?: string): boolean {
  return !!dataUrl && dataUrl.startsWith("data:application/pdf");
}

/** data URL → 字节 + 扩展名（用于打包命名）。 */
export function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; ext: string } {
  const m = /^data:([^;,]*)(;base64)?,([\s\S]*)$/.exec(dataUrl);
  if (!m) return { bytes: new Uint8Array(), ext: "bin" };
  const mime = m[1] || "application/octet-stream";
  const body = m[3];
  let bytes: Uint8Array;
  if (m[2]) {
    const bin = atob(body);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } else {
    bytes = enc.encode(decodeURIComponent(body));
  }
  const ext = mime.includes("pdf") ? "pdf" : mime.includes("png") ? "png" : mime.includes("svg") ? "svg"
    : (mime.includes("jpeg") || mime.includes("jpg")) ? "jpg" : mime.includes("webp") ? "webp" : "bin";
  return { bytes, ext };
}
