// 「我家里的一切」Mac 桌面壳（Electron）。
// 把随 App 打包的 run.py 当后端拉起来，再用原生窗口打开它的本机地址。
// 数据仍由 run.py 存到本机磁盘（~/Library/Application Support/我家里的一切），换新版本 App 也读得到。
const { app, BrowserWindow, shell, dialog, ipcMain, safeStorage } = require("electron");
const { spawn, spawnSync } = require("child_process");
const path = require("path");
const http = require("http");
const net = require("net");

let port = 5180;
let url = `http://localhost:${port}/`;
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
    const req = http.get(url, (r) => { r.resume(); res(true); });
    req.on("error", () => res(false));
    req.setTimeout(800, () => { req.destroy(); res(false); });
  });
}

function freeLocalPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const chosen = server.address().port;
      server.close((error) => error ? reject(error) : resolve(chosen));
    });
  });
}

async function waitForServer(tries = 60) {
  for (let i = 0; i < tries; i++) {
    if (await ping()) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

// 开发模式可复用已有服务；安装版总是运行包内的后端。
async function ensureServer() {
  // 安装版总是运行包内的后端，避免误连正在开发的旧版本。
  if (app.isPackaged) {
    try { port = await freeLocalPort(); } catch { return "timeout"; }
    url = `http://localhost:${port}/`;
  } else if (await ping()) return true;
  const python = findPython();
  if (!python) return "no-python";
  py = spawn(python, ["run.py"], {
    cwd: payloadDir(),
    env: {
      ...process.env,
      HOME_NO_BROWSER: "1", PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8",
      HOME_PORT: String(port),
      HOME_NODE_BINARY: process.execPath, HOME_NODE_ELECTRON: "1",
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
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload:path.join(__dirname,"cloud-preload.cjs") },
  });
  // 站内链接留在窗口里；真正的外链（http/https 到别处）交给系统浏览器。
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:\/\//.test(target) && !target.startsWith(url)) { shell.openExternal(target); return { action: "deny" }; }
    return { action: "allow" };
  });
  win.loadURL(url);
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
      <p>本地端口 ${port} 无法启动，或 run.py 启动失败。请关闭 App 后重试。</p></div>`);
    return;
  }
  const {createMacSync}=require('./cloud-runtime.cjs');
  const cloud=createMacSync({dataDir:process.env.HOME_DATA_DIR||path.join(app.getPath('appData'),'我家里的一切'),safeStorage});
  for(const [channel,method] of [['pic-cloud-info','info'],['pic-cloud-setup','setup'],['pic-cloud-sync','sync']])ipcMain.handle(channel,async(event,arg)=>{if(new URL(event.senderFrame.url).origin!==new URL(url).origin)throw Error('仅本机大厅可调用同步');return cloud[method](arg);});
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

// 关掉窗口就退出（顺带停掉后端）——这是个单窗口小工具，不用常驻 Dock。
app.on("window-all-closed", () => app.quit());
app.on("quit", () => { if (py) { try { py.kill(); } catch (e) { /* ignore */ } } });
