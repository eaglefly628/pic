// 强密码生成（使用 crypto.getRandomValues，避免 Math.random）。
export interface GenOpts { length: number; upper: boolean; lower: boolean; digits: boolean; symbols: boolean; }

const SETS = {
  upper: "ABCDEFGHJKLMNPQRSTUVWXYZ",   // 去掉易混的 I O
  lower: "abcdefghijkmnpqrstuvwxyz",   // 去掉 l o
  digits: "23456789",                  // 去掉 0 1
  symbols: "!@#$%^&*()-_=+[]{}",
};

export function generatePassword(o: GenOpts): string {
  let pool = "";
  if (o.upper) pool += SETS.upper;
  if (o.lower) pool += SETS.lower;
  if (o.digits) pool += SETS.digits;
  if (o.symbols) pool += SETS.symbols;
  if (!pool) pool = SETS.lower;
  const n = Math.max(4, Math.min(64, o.length));
  const rnd = crypto.getRandomValues(new Uint32Array(n));
  let out = "";
  for (let i = 0; i < n; i++) out += pool[rnd[i] % pool.length];
  return out;
}

/** 粗略强度评分 0-4 */
export function strength(pw: string): number {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(4, score);
}
