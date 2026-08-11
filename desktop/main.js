// 「我家里的一切」Mac 桌面壳（Electron）。
// 后端不再依赖系统 Python：run.py 的逻辑已移植成 server.js（Node），
// 直接在本进程里内嵌启动，再用一个原生窗口打开 http://localhost:5180。
// 数据仍存到本机磁盘（~/Library/Application Support/我家里的一切），和以前的 run.py 完全同一个目录，换版本也读得到。
const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const http = require("http");
const server = require("./server");

const PORT = server.PORT;
const URL = `http://localhost:${PORT}/`;
let win = null;

// 打包后 hub / 各 dist 被放进 .app 的 Resources/payload；开发时就是仓库根目录。
function payloadDir() {
  return app.isPackaged ? path.join(process.resourcesPath, "payload") : path.join(__dirname, "..");
}

// 端口被占用时确认对方确实是本系统的服务（有 /api/version），不是随便一个占了 5180 的程序。
function isOurServer() {
  return new Promise((res) => {
    const req = http.get(URL + "api/version", (r) => {
      let body = "";
      r.on("data", (c) => { body += c; });
      r.on("end", () => {
        try { res(Boolean(JSON.parse(body).version)); } catch (e) { res(false); }
      });
    });
    req.on("error", () => res(false));
    req.setTimeout(1500, () => { req.destroy(); res(false); });
  });
}

async function ensureServer() {
  try {
    const r = await server.start({
      root: payloadDir(),
      noBrowser: true, // 窗口就是浏览器，不再另开系统浏览器
      // 打包安装的 = 发布版；npm start 跑的 = 开发版
      channel: app.isPackaged ? "release" : "dev",
    });
    if (r === "already-running") return (await isOurServer()) ? true : "port-taken";
    return true;
  } catch (e) {
    return e && e.message ? String(e.message) : "start-failed";
  }
}

function showError(html) {
  win = new BrowserWindow({ width: 720, height: 460, title: "我家里的一切" });
  win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 880, minWidth: 1040, minHeight: 720,
    title: "我家里的一切", backgroundColor: "#f2f2f7",
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  // 站内链接留在窗口里；真正的外链（http/https 到别处）交给系统浏览器。
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url) && !url.startsWith(URL)) { shell.openExternal(url); return { action: "deny" }; }
    return { action: "allow" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (/^https?:\/\//.test(url) && !url.startsWith(URL)) { e.preventDefault(); shell.openExternal(url); }
  });
  win.loadURL(URL);
}

app.whenReady().then(async () => {
  const ok = await ensureServer();
  if (ok !== true) {
    const msg = ok === "port-taken"
      ? `端口 ${PORT} 被别的程序占用了。请退出占用该端口的程序后重开本 App。`
      : `后端没能起来：${ok}。可先在仓库里跑 <code>node desktop/server.js</code> 看报错。`;
    showError(`<div style="font:15px -apple-system,sans-serif;padding:40px;line-height:1.8;color:#1d1d1f">
      <h2>启动失败</h2><p>${msg}</p>
      <p style="color:#86868b">你的数据一直安全存在本机，不受影响。</p></div>`);
    return;
  }
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

// 关掉窗口就退出——这是个单窗口小工具，不用常驻 Dock。后端跑在本进程里，随进程一起退出。
app.on("window-all-closed", () => app.quit());
