# 家庭影像索引与安全整理

`scripts/photo_index.py` 是面向 Samba/NAS 大型影像库的第一阶段索引器。

- 只读取目录项和 `stat` 元数据，不读取图片像素或视频内容。
- 不创建、移动、重命名或删除源目录里的任何文件。
- SQLite 索引保存在本机；每 100 个目录项提交，支持暂停和续跑。
- 扫描未完整完成时绝不把未看到的文件标记为缺失。
- 第一阶段只按扩展名区分图片、视频和 sidecar，并按路径名称标记截屏/录屏候选。

正常使用不需要手动运行脚本：先在 Finder 挂载 Samba 目录，再从项目入口
`http://localhost:5180/#gallery` 打开家庭影像，在导入页点击“开始扫描”。页面可查看进度、
安全暂停和继续扫描。直接打开 `file://` 页面无法使用本机扫描服务。

开发排错时也可直接执行 `python3 scripts/photo_index.py status` 查看最近状态。

默认索引位置：

`~/Library/Application Support/我家里的一切/photo-index.sqlite3`

默认排除 `TimeMachine`、文档、音频及工作目录；可重复传入 `--exclude` 增加规则。

## 按时间整理

时间与地点分析完成后，可在“索引报告”生成整理预演。整理阶段有以下硬性保护：

- 可信时间进入 `家庭影像库/YYYY/YYYY-MM/`；文件名增加 `YYYYMMDD-HHMMSS__` 拍摄时间前缀，
  因而在 Finder、Windows 和 NAS 中按名称排序就是时间顺序。低可信或异常时间只生成
  `家庭影像库/_待确认时间/` 建议，第一轮原地保留，避免误拆软件素材或来源目录。
- 只允许在同一挂载卷内逐文件原子移动，不做一份占用约 550 GiB 的完整复制。
- 同名目标使用稳定的来源路径摘要后缀，绝不覆盖；Live Photo 图片、视频和 sidecar
  作为一组进入同一日期目录。
- 每移动一个文件就核对大小并同步更新 SQLite。中断后会核对源与目标的实际状态再续跑。
- 不合并重复内容、不自动删除旧目录；完成后自动生成并上传新的 SQLite 一致性快照。

开发测试可运行：

`python3 scripts/test-photo-organize.py`

## 在 Surface 上接力

索引数据库包含照片路径、拍摄时间和 GPS，不能明文提交到 GitHub。先在 Mac 上暂停整理，
再生成只包含 SQLite 索引和校验清单的接力包：

```bash
python3 project-two/scripts/photo_handoff.py export \
  --db "$HOME/Library/Application Support/我家里的一切/photo-index.sqlite3" \
  --output "$HOME/Desktop/photo-handoff.zip"
```

通过 U 盘、局域网或可信云盘把 ZIP 交给 Surface。在 Windows 中先把同一个 S300 共享目录
映射为盘符（例如 `Z:\`），停止 Mac 上的任务，然后在 PowerShell 导入并重新绑定路径：

```powershell
py project-two\scripts\photo_handoff.py import `
  --bundle "$HOME\Desktop\photo-handoff.zip" `
  --source-root "Z:\"
py run.py
```

若 Surface 已经生成过本地索引，导入命令会拒绝覆盖；核对无误后显式增加 `--replace`，旧索引会先备份。
任意时刻只允许一台电脑执行整理。接力包不含照片，导入时会做 SHA-256 和 SQLite 完整性检查。
