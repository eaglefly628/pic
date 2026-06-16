// TOTP（基于时间的一次性验证码 / 2FA），RFC 6238。用 Web Crypto 的 HMAC-SHA1。
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(s: string): Uint8Array | null {
  const clean = s.replace(/[\s=-]/g, "").toUpperCase();
  if (!clean) return null;
  let bits = 0, val = 0;
  const out: number[] = [];
  for (const c of clean) {
    const idx = B32.indexOf(c);
    if (idx < 0) return null;
    val = (val << 5) | idx; bits += 5;
    if (bits >= 8) { bits -= 8; out.push((val >> bits) & 0xff); }
  }
  return new Uint8Array(out);
}

export function isValidTotpSecret(s: string): boolean {
  return base32Decode(s) !== null && base32Decode(s)!.length > 0;
}

export const TOTP_PERIOD = 30;

/** 返回 6 位验证码；密钥非法时返回空串 */
export async function totp(secret: string, t = Date.now(), period = TOTP_PERIOD, digits = 6): Promise<string> {
  const key = base32Decode(secret);
  if (!key || key.length === 0) return "";
  const counter = Math.floor(t / 1000 / period);
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setUint32(0, Math.floor(counter / 2 ** 32));
  view.setUint32(4, counter >>> 0);
  const ck = await crypto.subtle.importKey("raw", key as unknown as BufferSource, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", ck, buf));
  const off = sig[sig.length - 1] & 0x0f;
  const code = ((sig[off] & 0x7f) << 24) | (sig[off + 1] << 16) | (sig[off + 2] << 8) | sig[off + 3];
  return String(code % 10 ** digits).padStart(digits, "0");
}

/** 当前周期剩余秒数 */
export function totpRemaining(t = Date.now(), period = TOTP_PERIOD): number {
  return period - Math.floor((t / 1000) % period);
}
