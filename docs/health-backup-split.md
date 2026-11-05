# 健康备份分层

“我家里的一切”大厅的“备份轻量数据到本机”保存整屋数据及已整理的健康结果，不包含 PDF、截图或逐页提取的 `raw-pages.json`。健康页面“导出健康 ZIP”也只包含 `archive-index.json`。

“加密备份并上传 GitHub”先在本机生成两份 AES-256-GCM 密文并验证，再上传到公开仓库的 `backup-data` 目录：

- `YYYY-MM.homeenc`：轻量整屋数据和健康结果。
- `YYYY-MM-health-originals.homeenc`：独立的健康报告原件。原件路径和 SHA-256 会逐份核对。

恢复密钥在本机 App 数据目录的 `backup-recovery.key`，永远不进入 Git。请另存离线副本；丢失后 GitHub 上的密文无法恢复。旧版 `encrypted-backups` 已有密文保留作迁移前恢复点，新备份不再写入该目录。

本机命令：`python3 encrypted_backup.py verify <轻量密文>` 和 `python3 encrypted_backup.py verify-originals <原件密文>`。上传流程 `backup_git.py` 需要本机 Git 已登录且可推送 `eaglefly628/pic` 的 `main` 分支。
