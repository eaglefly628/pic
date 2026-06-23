// 零知识加密：主密码 → PBKDF2-SHA256 派生密钥 → AES-256-GCM 加密整个保险库。
// 主密码绝不保存；解密失败（密码错误或文件损坏）会抛出异常。
const enc = new TextEncoder();
const dec = new TextDecoder();
export const DEFAULT_ITER = 600_000; // PBKDF2 迭代次数（OWASP 推荐量级）

function b64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Web Crypto 接受 BufferSource；新版 TS 把 Uint8Array 泛型化，这里统一转换。
const bs = (u: Uint8Array): BufferSource => u as unknown as BufferSource;

export interface VaultFile {
  app: "junbai-dev";
  v: 1;
  iter: number;
  salt: string; // base64
  iv: string;   // base64
  ct: string;   // base64（密文，含 GCM 认证标签）
}

async function deriveKey(password: string, salt: Uint8Array, iter: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", bs(enc.encode(password)), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: bs(salt), iterations: iter, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** 用已派生的密钥封装数据（保存时复用，避免每次都重新派生） */
export async function sealWithKey(key: CryptoKey, salt: Uint8Array, iter: number, data: unknown): Promise<VaultFile> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: bs(iv) }, key, bs(enc.encode(JSON.stringify(data))));
  return { app: "junbai-dev", v: 1, iter, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
}

/** 用主密码新建保险库（首次设置 / 改密码） */
export async function createVault(password: string, data: unknown, iter = DEFAULT_ITER): Promise<{ file: VaultFile; key: CryptoKey; salt: Uint8Array; iter: number }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(password, salt, iter);
  const file = await sealWithKey(key, salt, iter, data);
  return { file, key, salt, iter };
}

/** 用主密码解密保险库；密码错误会抛错 */
export async function openVault<T = unknown>(password: string, file: VaultFile): Promise<{ data: T; key: CryptoKey; salt: Uint8Array; iter: number }> {
  const salt = unb64(file.salt);
  const key = await deriveKey(password, salt, file.iter);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bs(unb64(file.iv)) }, key, bs(unb64(file.ct)));
  return { data: JSON.parse(dec.decode(pt)) as T, key, salt, iter: file.iter };
}

export function isVaultFile(o: unknown): o is VaultFile {
  const f = o as VaultFile;
  return !!f && f.app === "junbai-dev" && typeof f.salt === "string" && typeof f.iv === "string" && typeof f.ct === "string";
}
