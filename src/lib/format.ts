// 金额格式化（与设计稿一致）

export function fmt(n: number): string {
  const neg = n < 0;
  return (neg ? "−¥" : "¥") + Math.abs(Math.round(n)).toLocaleString("zh-CN");
}

export function fmtWan(n: number): string {
  const neg = n < 0;
  const a = Math.abs(n);
  const s =
    a >= 10000
      ? (a / 10000).toLocaleString("zh-CN", { maximumFractionDigits: 1 }) + "万"
      : a.toLocaleString("zh-CN");
  return (neg ? "−¥" : "¥") + s;
}

export function fmtSigned(n: number): string {
  return (n >= 0 ? "+" : "−") + "¥" + Math.abs(Math.round(n)).toLocaleString("zh-CN");
}

export function fmtPct(frac: number, digits = 1): string {
  return (frac * 100).toFixed(digits) + "%";
}
