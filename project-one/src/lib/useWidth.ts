import { useCallback, useRef, useState } from "react";

/** 量出某个元素的实际像素宽度，并跟着变化。用法：`const [ref, w] = useWidth(); <div ref={ref}>`
 *
 *  图表为什么需要它：`<svg viewBox="0 0 640 180" style="width:100%;height:180px">`
 *  看起来是「宽度自适应」，其实不是。viewBox 默认按 preserveAspectRatio="xMidYMid meet"
 *  等比缩放并居中——元素 1086 宽、210 高时，缩放取 min(1086/600, 210/210) = 1，
 *  内容只画 600 宽，左右各空 243px。于是两件事都错：
 *    ① 白白浪费了近一半宽度；
 *    ② 鼠标位置换算成图上坐标时，(clientX-left)/元素宽*600 是错的，
 *       实际要减掉居中留白再除以缩放比，不改的话越靠边偏得越厉害。
 *  把 viewBox 的宽度设成量到的真实像素宽，缩放比就恒为 1，两个问题一起没了。
 *
 *  用 callback ref 而不是 useRef + useEffect：图表常常是「先渲染『加载中』、数据到了才
 *  挂上真正的节点」，只在挂载时跑一次的 effect 那会儿 ref.current 还是 null，
 *  之后再也不会触发，宽度就永远停在 0 了。callback ref 在节点真正挂上时才调用。 */
export function useWidth<T extends HTMLElement>(): [(node: T | null) => void, number] {
  const [w, setW] = useState(0);
  const roRef = useRef<ResizeObserver | null>(null);
  const ref = useCallback((node: T | null) => {
    roRef.current?.disconnect();
    roRef.current = null;
    if (!node) return;
    const read = () => setW(Math.round(node.getBoundingClientRect().width));
    read();
    if (typeof ResizeObserver === "undefined") return;   // 老浏览器：至少量到挂载时那一次
    const ro = new ResizeObserver(read);
    ro.observe(node);
    roRef.current = ro;
  }, []);
  return [ref, w];
}
