# Mac 接续开发（2026-11-05）

代码从 GitHub 的 `codex/daily-modules` 分支获取，不要使用落后的默认分支。个人报告、测量值和提取中间文件不在 Git 中，需下载单独的私有健康备份。

## 首次恢复

安装 Python 3.10+、Node 22.12+ 和 Git，然后：

```bash
git clone --branch codex/daily-modules https://github.com/eaglefly628/pic.git
cd pic
python3 scripts/restore-health-archive.py "$HOME/Downloads/pic-health-backup-2026-11-05.zip"
python3 run.py
```

访问 http://127.0.0.1:5180/dev/#health 。使用 Mac 原有工作台密码；全新安装按页面建立自己的工作台。健康侧档案本身是明文，本次备份不含 Windows 预览密码或其他模块的保险库数据。

已有项目：先保存 Mac 在途改动，再切换同一分支并更新；不要直接覆盖未提交内容。恢复工具会先在临时目录完整恢复并核对所有原件哈希，再增量写入 `health-data.local`。相同记录跳过，修订冲突拒绝覆盖。也可在页面“追加档案”选择 ZIP。

如果下载时浏览器修改了文件名，将命令中的路径替换为实际名称。可先运行：

```bash
python3 scripts/restore-health-archive.py /path/to/backup.zip --check-only
```

私有备份的 `analysis-workspace/` 包含提取中间结果、一次性整理脚本及审计信息。应用运行只需根清单和原件路径；辅助脚本中的旧 Windows 路径需按 Mac 调整。不要盲目重跑旧构建脚本，它们可能重建早期快照；以 `archive-index.json` 为准。

## 开发验证

```bash
npm ci --prefix project-four
npm run build --prefix project-four
python3 scripts/test-health-archive.py
node scripts/test-health-metrics.cjs
python3 scripts/test-backup-safety.py
```

Python 入口读取 `project-four/dist`。修改源码后须重新构建。完整开发记录见 `DEVELOPMENT_LOG.md`，数据接口及边界见 `docs/health-archive.md`，Guava 参考方案见 `HEALTH_PLAN.md`。

当前具备时间线、医学分类与说明、单位分组趋势、历史引用核验、来源追溯及 ZIP 迁移。原始 PDF/照片自动 OCR 和 Apple 健康 XML 导入尚未接入。Windows 已验证构建与恢复；Mac Electron 安装包需在 Mac 上实际构建和验证。
