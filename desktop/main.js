// 「我家里的一切」Mac 桌面壳（Electron）。
// 做的事很简单：把仓库里的 run.py 当后端拉起来，再用一个原生窗口打开 http://localhost:5180。
// 数据仍由 run.py 存到本机磁盘（~/Library/Application Support/我家里的一切），换新版本 App 也读得到。
const { app, BrowserWindow, shell, dialog } = require("electron");
const { spawn, spawnSync } = require("child_process");
const path = require("path");
const http = require("http");

const PORT = 5180;
const URL = `http://localhost:${PORT}/`;
let py = null;
let win = null;

// 打包后 run.py / hub / 各 dist 被放进 .app 的 Resources/payload；开发时就是仓库根目录。
function payloadDir() {
  return app.isPackaged ? path.join(process.resourcesPath, "payload") : path.join(__dirname, "..");
}

// 找一个能用的 Python（GUI 应用的 PATH 往往很干净，多探几个常见位置）。
function findPython() {
  const cands = [process.env.PYTHON, "python3", "/usr/bin/python3", "/usr/local/bin/python3", "/opt/homebrew/bin/python3", "python"].filter(Boolean);
  for (const c of cands) {
    try {
      const r = spawnSync(c, ["-c", "import sys;print(sys.version)"], { timeout: 5000 });
      if (r.status === 0) return c;
    } catch (e) { /* try next */ }
  }
  return null;
}

function ping() {
  return new Promise((res) => {
    const req = http.get(URL, (r) => { r.resume(); res(true); });
    req.on("error", () => res(false));
    req.setTimeout(800, () => { req.destroy(); res(false); });
  });
}

async function waitForServer(tries = 60) {
  for (let i = 0; i < tries; i++) {
    if (await ping()) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

// 确保后端在跑：已有就直接用；没有就用 Python 拉起 run.py。
async function ensureServer() {
  if (await ping()) return true;                 // 已有 run.py 在跑（比如你手动开着）
  const python = findPython();
  if (!python) return "no-python";
  py = spawn(python, ["run.py"], {
    cwd: payloadDir(),
    env: {
      ...process.env,
      HOME_NO_BROWSER: "1", PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8",
      // 打包安装的 = 发布版；npm start 跑的 = 开发版
      HOME_CHANNEL: app.isPackaged ? "release" : "dev",
    },
  });
  if (py.stdout) py.stdout.on("data", () => {});
  if (py.stderr) py.stderr.on("data", () => {});
  py.on("error", () => {});
  return (await waitForServer()) ? true : "timeout";
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
  win.loadURL(URL);
}

app.whenReady().then(async () => {
  const ok = await ensureServer();
  if (ok === "no-python") {
    showError(`<div style="font:15px -apple-system,sans-serif;padding:40px;line-height:1.8;color:#1d1d1f">
      <h2>没找到 Python 3</h2>
      <p>这个 App 用本机的 Python 当后端。请先安装 Python 3，再重新打开：</p>
      <p><a href="https://www.python.org/downloads/">https://www.python.org/downloads/</a>（或用 <code>brew install python</code>）</p>
      <p style="color:#86868b">装好后重开本 App 即可；你的数据一直安全存在本机。</p></div>`);
    return;
  }
  if (ok === "timeout") {
    showError(`<div style="font:15px -apple-system,sans-serif;padding:40px;line-height:1.8;color:#1d1d1f">
      <h2>后端没能起来</h2>
      <p>端口 ${PORT} 可能被占用，或 run.py 启动失败。可先手动在仓库里跑 <code>python3 run.py</code> 再打开本 App。</p></div>`);
    return;
  }
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

// 关掉窗口就退出（顺带停掉后端）——这是个单窗口小工具，不用常驻 Dock。
app.on("window-all-closed", () => app.quit());
app.on("quit", () => { if (py) { try { py.kill(); } catch (e) { /* ignore */ } } });
