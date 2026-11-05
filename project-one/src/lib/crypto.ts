// 本地加密（Web Crypto）—— AES-256-GCM 数据加密 + PBKDF2 派生主密钥 + 信封加密。
// 主密码绝不存储；磁盘只保存：盐、KDF 参数、被主密钥包裹的数据密钥(DEK)、密文。
//
// 备注：PBKDF2 为浏览器内置、零依赖的稳妥选择；后续可升级为 Argon2id（见 README 路线图）。

// PBKDF2 迭代次数：与家庭密码/开发世界统一到 OWASP 现行建议量级。
// 老金库里存着它自己的 iter，仍能正常打开；解锁时会自动升级到这个值（见 needsKdfUpgrade）。
export const KDF_ITER = 600_000;
const enc = new TextEncoder();
const dec = new TextDecoder();

export interface VaultBlob {
  v: 1;
  kdf: "PBKDF2-SHA256";
  iter: number;
  salt: string; // b64
  wrap: { iv: string; ct: string }; // 被 KEK 包裹的 DEK
  data: { iv: string; ct: string }; // 被 DEK 加密的明文 JSON
}

export interface UnlockedKeys {
  dekKey: CryptoKey; // 用于加解密数据
  dekRaw: Uint8Array; // 用于改密码时重新包裹
  meta: Pick<VaultBlob, "v" | "kdf" | "iter" | "salt" | "wrap">;
}

function b64encode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function randomBytes(n: number): Uint8Array {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return a;
}
// 新版 TS 对 Uint8Array<ArrayBufferLike> 与 BufferSource 更严格，这里统一收敛。
const bs = (u: Uint8Array): BufferSource => u as unknown as BufferSource;

async function deriveKEK(password: string, salt: Uint8Array, iter: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", bs(enc.encode(password)), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: bs(salt), iterations: iter, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function aesEncrypt(key: CryptoKey, plain: Uint8Array): Promise<{ iv: string; ct: string }> {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: bs(iv) }, key, bs(plain));
  return { iv: b64encode(iv), ct: b64encode(new Uint8Array(ct)) };
}
async function aesDecrypt(key: CryptoKey, blob: { iv: string; ct: string }): Promise<Uint8Array> {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bs(b64decode(blob.iv)) }, key, bs(b64decode(blob.ct)));
  return new Uint8Array(pt);
}

/** 用主密码创建一个新金库（返回密文 blob 与内存密钥） */
export async function createVault(password: string, plaintext: unknown): Promise<{ blob: VaultBlob; keys: UnlockedKeys }> {
  const salt = randomBytes(16);
  const kek = await deriveKEK(password, salt, KDF_ITER);
  const dekRaw = randomBytes(32);
  const wrap = await aesEncrypt(kek, dekRaw);
  const dekKey = await crypto.subtle.importKey("raw", bs(dekRaw), { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  const data = await aesEncrypt(dekKey, enc.encode(JSON.stringify(plaintext)));
  const meta = { v: 1 as const, kdf: "PBKDF2-SHA256" as const, iter: KDF_ITER, salt: b64encode(salt), wrap };
  return { blob: { ...meta, data }, keys: { dekKey, dekRaw, meta } };
}

/** 用主密码解锁（密码错误会抛出异常） */
export async function unlockVault<T = unknown>(password: string, blob: VaultBlob): Promise<{ data: T; keys: UnlockedKeys }> {
  const salt = b64decode(blob.salt);
  const kek = await deriveKEK(password, salt, blob.iter);
  const dekRaw = await aesDecrypt(kek, blob.wrap); // 密码错误 -> 解密失败抛错
  const dekKey = await crypto.subtle.importKey("raw", bs(dekRaw), { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  const json = dec.decode(await aesDecrypt(dekKey, blob.data));
  const meta = { v: blob.v, kdf: blob.kdf, iter: blob.iter, salt: blob.salt, wrap: blob.wrap };
  return { data: JSON.parse(json) as T, keys: { dekKey, dekRaw, meta } };
}

/** 用内存中的 DEK 重新加密数据（保存编辑，无需主密码） */
export async function sealVault(keys: UnlockedKeys, plaintext: unknown): Promise<VaultBlob> {
  const data = await aesEncrypt(keys.dekKey, enc.encode(JSON.stringify(plaintext)));
  return { ...keys.meta, data };
}

/** 修改主密码：用新密码重新包裹同一个 DEK（数据无需重新加密） */
export async function rewrapVault(keys: UnlockedKeys, blob: VaultBlob, newPassword: string): Promise<{ blob: VaultBlob; keys: UnlockedKeys }> {
  const salt = randomBytes(16);
  const kek = await deriveKEK(newPassword, salt, KDF_ITER);
  const wrap = await aesEncrypt(kek, keys.dekRaw);
  const meta = { v: 1 as const, kdf: "PBKDF2-SHA256" as const, iter: KDF_ITER, salt: b64encode(salt), wrap };
  return { blob: { ...meta, data: blob.data }, keys: { ...keys, meta } };
}

/** 这个金库的 KDF 是否弱于当前标准（老版本 310k）——解锁时据此静默升级 */
export function needsKdfUpgrade(blob: VaultBlob): boolean {
  return (blob.iter || 0) < KDF_ITER;
}

/** 把金库的 KDF 升级到当前迭代次数：用主密码重新包裹同一个 DEK，数据密文原样不动 */
export async function upgradeKdf(keys: UnlockedKeys, blob: VaultBlob, password: string): Promise<{ blob: VaultBlob; keys: UnlockedKeys }> {
  return rewrapVault(keys, blob, password);
}

/** 粗略的密码强度评估（0-4） */
export function passwordStrength(pw: string): { score: number; label: string } {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  const labels = ["很弱", "较弱", "中等", "较强", "很强"];
  return { score: s, label: labels[s] };
}
