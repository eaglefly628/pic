# 家庭影像只读索引

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
