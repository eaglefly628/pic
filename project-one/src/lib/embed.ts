// 这个应用平时是嵌在大厅（hub）的 iframe 里跑的。手机竖版下大厅顶栏那排 tab
// 很挤，光靠它回首页不好点，所以应用内部自己也要给一个明确的「返回我家里的一切」。
// 单独打开（不在 iframe 里）时这些入口不显示——那时候没有可返回的上一层。

export function isEmbedded(): boolean {
  try {
    return window.parent !== window;
  } catch {
    return true; // 跨域访问 parent 抛错，说明确实被嵌着
  }
}

/** 请求大厅切回首页。用 postMessage 而不是直接摸 parent 的 DOM，跨域也不会炸。 */
export function goHomeHub(): void {
  try {
    window.parent.postMessage({ __homeNav: "home" }, window.location.origin);
  } catch {
    /* 单独打开时没有 parent，忽略即可 */
  }
}
