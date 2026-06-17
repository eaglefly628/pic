import React, { useEffect, useRef, useState } from "react";

export const reduceMotion =
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** 数字滚动到目标值（easeOutCubic）。尊重「减少动效」。 */
export function useCountUp(target: number, duration = 750): number {
  const [val, setVal] = useState(reduceMotion ? target : 0);
  const fromRef = useRef(reduceMotion ? target : 0);
  useEffect(() => {
    if (reduceMotion) { setVal(target); return; }
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const e = 1 - Math.pow(1 - t, 3);
      setVal(from + (target - from) * e);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); fromRef.current = target; };
  }, [target, duration]);
  return val;
}

/** 配合 className="fv-rise" 做错落入场的延迟样式 */
export function rise(delayMs: number): React.CSSProperties {
  return { animationDelay: `${delayMs}ms` };
}
