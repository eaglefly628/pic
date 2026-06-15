# 君白家专用理财 · Family Vault

一款**本地优先、全程加密的家庭理财与机密信息管理桌面应用**。按 [`需求文档.md`](./需求文档.md)
实现，界面还原设计稿（macOS 风格窗口、明暗主题）。

> **桌面 · 纯本地 · 单一主密码 · AES-256 加密**

## 功能（第一版）

- 🔐 **主密码 + 本地加密**：首次启动创建主密码，全部数据用 **AES-256-GCM** 加密、**PBKDF2** 派生密钥（信封加密），主密码不落盘；闲置自动锁定、复制密码后自动清空剪贴板。
- 📊 **仪表盘**：总资产 / 总负债 / 净资产、净资产趋势（近3月/近1年/全部）、资产构成环形图、最近更新。
- 💳 **资金账户**：按流动资金 / 投资理财 / 不动产 / 负债分组；**新增 / 编辑 / 删除账户**。
- 📈 **账户详情**：余额历史折线图 + 余额快照表；**新增快照**（按日期记账，自动结转保持净值一致）。
- 🔑 **密码保险箱**：增删改、密码生成器、强度提示、显示/隐藏、一键复制（自动清剪贴板）、收藏。
- 🪪 **个人信息**：身份证 / 银行卡 / WiFi 等机密信息，自定义字段；家庭成员自动汇总。
- 📥 **导入数据**：应用内选择 Excel，读取指定工作表导入（替换资金数据）。
- ⚙️ **设置**：修改主密码、自动锁定时长、剪贴板清空、主题、**加密备份导出 / 恢复**、重置。

## 快速开始

**最简单（推荐，只需 Python）**

```bash
python run.py        # 或 python3 run.py
```

会自动在本机启动并打开浏览器。仓库已内置打包好的 `dist/`，因此**无需安装 Node** 即可运行；
若删除了 `dist/` 且本机装有 Node，`run.py` 会自动重新构建。

**Windows 最省事**：双击 `start.bat` 即可。

**开发模式（需要 Node）**

```bash
npm install
npm run dev        # 打开 http://localhost:5180
npm run build      # 类型检查 + 生产构建（更新 dist/）
```

### 常见问题

- **启动后终端不动 / 像“卡死”**：这是正常的——服务正在运行。浏览器会自动打开
  `http://127.0.0.1:5180/`；想停止按 `Ctrl+C`。
- **在 VS Code 里报 `FileNotFoundError: ...App Debug Helper`**：这是用了 VS Code 的
  调试按钮（▶/F5）且焦点不在 `run.py` 上导致的，与本应用无关。请改为在**终端**里运行
  `python run.py`，或直接双击 `start.bat`。
- **`python` 命令不存在**：用 `py run.py`，或填 Python 安装的完整路径。

首次进入会要求**创建主密码**；金库会以内置的**默认数据库**（真实历史数据）初始化。
之后每次打开用主密码解锁。数据加密保存在本机（localStorage），不联网、不上传。

> ⚠️ 主密码无法找回，请牢记；建议在「设置 → 备份」中导出 `.vault` 加密备份。

## 默认数据库

应用内置 `src/data/history.json` 作为默认数据库（已按要求随仓库提交）。
更新数据有两种方式：

1. **应用内**：左侧「导入数据」→ 选择 Excel → 指定工作表（默认 `Sheet2`）→ 确认导入。
2. **命令行**（重建默认库）：
   ```bash
   npm run import:excel -- /path/to/表格.xlsx Sheet2
   ```

表格结构：第 1 行表头（A 列日期、B… 为各账户名，至 `total asset` 列结束），第 2 行可选利率，
其后每行一个日期 + 各账户余额；非日期行（如「房款」「利息可能」）自动跳过。净值由各账户余额逐期求和。

## 需要校正的假设

账户的**分组 / 类型 / 归属 / 颜色 / 构成分类**是根据账户名（`cc招行`、`桔子gg`、`华通bb`…）的
**推测**，集中在 [`scripts/import-excel.mjs`](./scripts/import-excel.mjs) 与
[`src/lib/parseExcel.ts`](./src/lib/parseExcel.ts) 的 `ACCOUNT_META`。可在应用内逐个编辑账户，
或改这两处后重新导入。

## 项目结构

```
src/
  App.tsx              门控 + 窗口外壳 + 导航 + 路由
  icons.tsx  ui.tsx    图标 / 通用 UI 组件
  styles.css           明暗主题变量
  lib/
    crypto.ts          AES-256-GCM + PBKDF2 信封加密
    storage.ts         加密金库的本地持久化
    compute.ts         数据 -> 视图模型（趋势/构成/分组/快照）
    parseExcel.ts      浏览器端 Excel 解析
    format.ts theme.tsx
  vault/
    VaultContext.tsx   解锁状态机、内存密钥、自动锁定、保存即加密
    types.ts  ops.ts   金库数据结构 / 增删改操作
  data/
    types.ts  sample.ts  defaultData.ts
    history.json       默认数据库（真实历史数据）
  screens/             Unlock / Dashboard / Accounts / Detail /
                       Passwords / Info / ImportData / Settings / editors
scripts/import-excel.mjs   Excel(Sheet2) -> history.json
需求文档.md                 产品需求文档（PRD）
```

## 路线图（下一版）

- 用 **Tauri**（推荐）或 Electron 打包为 Windows/macOS 本地应用，数据落地为本地加密文件（SQLCipher）。
- KDF 升级为 **Argon2id**；可选 **Touch ID / Windows Hello** 快捷解锁。
- 全局搜索、收支流水、提醒、TOTP、附件、多币种。

## 技术栈

Vite + React 18 + TypeScript。图表为纯 SVG；加密用浏览器内置 Web Crypto，零密码学第三方依赖。
