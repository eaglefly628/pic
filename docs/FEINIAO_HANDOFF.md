# 飞鸟 / PIC 接手入口

统一主仓库：https://github.com/eaglefly628/pic 。默认分支沿用 claude/setup-beauty-platform-Dd0m9。家庭源码 project-one～four 供 Mac 和 Web 共同构建；Web 构建适配在 web/feiniao/scripts/pic-web-adapter.mjs。不要再次维护 integrations/pic 的代码副本。

网站项目 appgprj_6ad3990fe64c8191a2f2b73b42a81af2，原网址 https://folio-personal-garden-1017.tinyrice9.chatgpt.site/ 。保留原密码入口、数据库和 R2 绑定。发布仍走 Sites：从本仓库确切提交构建，将同一源码树同步到 Sites 源码镜像，记录 DEPLOY_SOURCE.json，然后保存该镜像提交及归档并发布。GitHub push/CI 成功不等于网站已发布。不要另建网站。

## 备份协议与权限

shared/pic/versions.js 是分区规则。finance（理财主库和还原点）、health（独立体检档案及原件）、shared（账号、工作台及健康手记、影像等）分别具有 backup_versions。App VERSION、dataVersion、文件时间不决定备份新旧。同分区低版本拒绝；同版本内容不同拒绝；版本分叉保留同步前副本，人工合并。

旧 D1 vault id=pic 的整屋快照冻结。网页首次解锁从旧快照读出资料，迁移到 pic-shared / pic-health；金融优先读 pic-finance，否则继续读冻结的旧金融内容。金融 PUT 只允许已登记 Mac 的 Ed25519 签名；网页会话不能登记 Mac，登记工具 pic_register_mac 必须通过站点所有者 MCP 身份调用。

网站只把加密信封和不可变密文对象发送服务器。金融备份从网页导入时保持原金融源。没有 backup_versions 的旧 .home/.pic 不能按时间自动替换新版，须在 Mac 完成基线迁移。健康 ZIP 是追加记录，验证 ID、日期、单位、页码和原件哈希；重复跳过，修订冲突拒绝。

## Mac 首次设置

需要在真实 Mac 上运行新版桌面包，云同步菜单填写网站根地址及家庭云主密码，密码和设备私钥由 Electron safeStorage/钥匙串加密保存。把生成的 public_key（不是私钥、密码或恢复密钥）交给所有者会话，调用 pic_register_mac 后才能同步。当前执行环境无法生成用户 Mac 的钥匙串身份，不能伪称已配对。

先在新版网页解锁一次，完成旧整屋快照分区迁移，再首次 Mac 同步。Mac 本机资料在同步前备份到 backups/version-conflicts。云端版本更高且本机存在未同步编辑时拒绝自动覆盖。Mac 实机安装、钥匙串、现有个人库与云端首次实际同步必须单独验收。GitHub Actions 提供未签名 Mac 包构建，不代表 Apple 签名/公证。

## 健康导入与移动端

标题栏“更多”收纳同步、加载云端、导出和导入。健康手记与独立体检档案不同；健康入口可用原工作台密码解锁手记。JSON 内嵌标准 reports/observations 会识别；未知健康分区停止替换并提供不含记录值的结构诊断。用户目前报告 .home/.json 同时缺体检与手记，但未提供实际文件；不能宣称已恢复其真实健康记录。须用结构诊断继续核对。

## 验证

根目录 npm ci，npm run web:build，npm run web:test；python scripts/test-health-archive.py；node scripts/build-mac-cloud.mjs。原 Mac/Python 备份测试需按新 syncProtocol=3 与 backup_versions 更新，不能把旧的 savedAt 顺序断言当新协议。真实手机/桌面浏览器验收当前不可用；模拟 DOM 测试不能冒充实机视觉通过。

不恢复旧 GitHub 备份事项、不重复创建游戏/AI/上海定时任务、不修改现有访问范围、不向 Git 提交个人明文、密钥或运行环境秘密。
