// 运行时按需加载外部脚本/样式（人脸模型、地图库）。仅在用户主动开启相应功能时调用。
const cache = new Map<string, Promise<void>>();

export function loadScript(src: string): Promise<void> {
  if (!cache.has(src)) {
    cache.set(src, new Promise<void>((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.async = true;
      s.onload = () => res();
      s.onerror = () => rej(new Error("脚本加载失败：" + src));
      document.head.appendChild(s);
    }));
  }
  return cache.get(src)!;
}

export function loadCss(href: string): Promise<void> {
  if (!cache.has(href)) {
    cache.set(href, new Promise<void>((res) => {
      const l = document.createElement("link");
      l.rel = "stylesheet"; l.href = href;
      l.onload = () => res(); l.onerror = () => res();
      document.head.appendChild(l);
    }));
  }
  return cache.get(href)!;
}
