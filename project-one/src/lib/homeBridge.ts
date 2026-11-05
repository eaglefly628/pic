/**
 * 从同源大厅领取只存在父页面内存中的主密码。
 * 密码不落 sessionStorage；父页面刷新、锁定或关闭后立即消失。
 */
export function requestHomePassword(timeoutMs = 1500): Promise<string | null> {
  if (window.parent === window) return Promise.resolve(null);
  const requestId = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return new Promise((resolve) => {
    let done = false;
    const finish = (password: string | null) => {
      if (done) return;
      done = true;
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timer);
      resolve(password);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent || event.origin !== location.origin) return;
      if (event.data?.__homeKeyResponse !== requestId) return;
      finish(typeof event.data.password === "string" ? event.data.password : null);
    };
    const timer = window.setTimeout(() => finish(null), timeoutMs);
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ __homeKeyRequest: requestId }, location.origin);
  });
}
