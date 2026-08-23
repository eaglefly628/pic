import { useEffect, useState } from "react";

/** <768 视为手机竖版。这个应用原本没有任何响应式处理，左侧分类栏是写死的 196px，
 *  在 390 宽的手机上等于左右各占一半，右边列表根本没法看。 */
export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(() =>
    typeof window === "undefined" ? false : window.innerWidth < 768
  );
  useEffect(() => {
    const on = () => setPhone(window.innerWidth < 768);
    window.addEventListener("resize", on);
    on();
    return () => window.removeEventListener("resize", on);
  }, []);
  return phone;
}
