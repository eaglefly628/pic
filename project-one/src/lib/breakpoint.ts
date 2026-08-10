import { useEffect, useState } from "react";

export type Breakpoint = "desktop" | "tablet" | "phone";

// ≥1024 桌面（侧栏常驻）｜768–1023 平板（侧栏可折叠成图标条）｜<768 手机（底部 Tab Bar）
// 平板只支持横屏，所以按宽度判断就够，不看 orientation。
export function bpOf(w: number): Breakpoint {
  if (w < 768) return "phone";
  if (w < 1024) return "tablet";
  return "desktop";
}

export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(() =>
    typeof window === "undefined" ? "desktop" : bpOf(window.innerWidth)
  );
  useEffect(() => {
    const onResize = () => setBp(bpOf(window.innerWidth));
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return bp;
}
