# pic — 本地优先的家庭工具集（Monorepo）

本仓库包含两个相互独立、风格一致（macOS 风、纯本地、注重隐私）的桌面应用：

| 目录 | 应用 | 用途 |
|---|---|---|
| [`project-one/`](./project-one) | **junbai家专用理财软件** | 家庭理财与机密信息管理（净资产/账户/利息/预测/密码保险箱/独立管理），AES‑256 本地加密 |
| [`project-two/`](./project-two) | **家庭影像 · Family Gallery** | 家庭照片/视频管理，按**时间/地点**自动归类与汇总、相册、私密区 |

两个项目各自独立（各有 `package.json` / `dist` / 启动器）。

## 快速开始

```bash
# 理财
cd project-one && python run.py      # http://127.0.0.1:5180/

# 影像
cd project-two && python run.py      # http://127.0.0.1:5181/
```

各自目录下的 `README.md` 有更详细说明与打包方式（Tauri / Windows 安装包等）。

> 设计原则：数据只存本机、不联网、不上传；敏感内容本地加密。
