# 我家里的一切

我们家所有应用的**统一入口**。一个入口、一个端口，进去后用顶部菜单选择进入各应用。
本地优先、注重隐私：数据都存在本机，不联网、不上传。

## 启动（唯一入口）

```bash
node desktop/server.js   # Mac 可双击 start-mac.command；Windows 双击 start.bat
# 浏览器打开 http://127.0.0.1:5180/ ，顶部菜单进入「家庭理财 / 家庭影像」
```

服务器已用 Node 重写（`desktop/server.js`，为苹果上架做准备、App 不再依赖系统 Python）。
数据目录、端口、接口与旧版完全一致，老数据直接读到。没装 Node 的机器仍可用
`python run.py`（旧版服务器，保留作后备，行为相同）。

## 包含的应用

| 入口菜单 | 目录 | 说明 |
|---|---|---|
| 💰 家庭理财 | [`project-one/`](./project-one) | 净资产/账户/利息/预算预测/密码保险箱/独立管理，AES‑256 本地加密 |
| 🖼 家庭影像 | [`project-two/`](./project-two) | 照片/视频按**时间·地点**归类、去重清理、相册、私密区 |
| 🔐 家庭密码 | [`project-three/`](./project-three) | 网站账号/银行卡/安全笔记/家庭信息，**一个主密码**、零知识 AES‑256 加密、可导出迁移 |
| 👨‍💻 男主的开发世界 | [`project-four/`](./project-four) | 任务看板/笔记本/代码片段/书签，主密码 AES‑256 本地加密的个人工作台 |
| ＋ 更多 | — | 敬请期待（文档/日程/清单等） |

## 架构

- `hub/index.html`：统一入口页（品牌 + 顶部应用菜单 + 内容区）。
- `desktop/server.js`：统一服务器（Node 版，Electron 桌面壳内嵌同一份；`run.py` 为等价的 Python 旧版后备），按路径加载各应用的 `dist`：
  - `/` → 入口页　·　`/finance/*` → `project-one/dist`　·　`/gallery/*` → `project-two/dist`　·　`/vault/*` → `project-three/dist`　·　`/dev/*` → `project-four/dist`
- 各应用仍是**独立项目**（独立源码/构建/可单独打包），通过入口集成；新增应用只需：构建出 `dist`，在 `desktop/server.js` 的 `MOUNTS` 加一行（若还用 Python 后备，`run.py` 同步加）、在 `hub/index.html` 加一个菜单/卡片。

> 单独开发某个应用：进入其目录 `npm run dev`（理财 5180 / 影像 5181 / 密码 5182 / 开发世界 5183 的开发端口）。
> 数据按浏览器来源（host:端口）隔离——统一入口都在 5180，请固定从这里进入。

## 设计原则

数据只存本机、不联网、不上传；敏感内容本地加密（理财主密码 / 影像私密区）。
