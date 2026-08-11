# 全面 Code Review 与苹果三端上架准备报告

> 版本基线：v0.3.0（commit 86210cc）· Review 日期：2026-08-11
> 目标：iPhone（手机）/ iPad（平板）/ Mac（桌面）三端上架 App Store
> 范围：run.py · hub · desktop(Electron) · project-one(理财) · project-two(影像) · project-three(密码) · project-four(开发世界) · CI/构建链

---

## 一、总体结论

代码本身有不少扎实之处：**project-three 的密码学核心合格且干净**（PBKDF2-SHA256 600k 迭代、随机 salt/IV、AES-256-GCM 正确用法、密钥不可导出、TOTP 实现正确）；project-one 的信封加密（KEK 包裹 DEK、改密码只 rewrap）设计正确；project-four 的零依赖 zip/markdown/泊松模型实现颇见功力；全库几乎没有 `innerHTML`/`dangerouslySetInnerHTML`，XSS 面整体干净。

但按「苹果三端上架」的标准衡量，当前形态是**纯桌面自用 Web 工具**，距可提交状态有三层差距：

1. **架构层硬阻断**：所有应用依赖本机 Python 服务器（run.py）。iOS 上不能跑 Python；Mac App Store 沙盒内不允许 spawn 系统 Python（desktop/main.js 现在就是这么做的）。这是必须先解决的第一性问题。
2. **隐私与安全承诺不成立**：影像的「私密区加密」实际不存在；开发世界的加密用硬编码密码；理财主密码明文放 sessionStorage。这些与 README 的宣传直接冲突，苹果审核（Guideline 2.3.1 宣传不实、5.1.1/5.1.2 隐私）会出问题，更重要的是对家人数据是真实风险。
3. **三端适配约等于零**：四个子应用 + hub 全部零宽度媒体查询、零 safe-area 处理、大量写死像素宽度（理财甚至写死 1200×800 模拟 macOS 窗口）、hover-only 交互、输入框 <16px 触发 iOS 缩放、`confirm()` 在 WKWebView 中静默失效。iPhone 上目前基本不可用，iPad 勉强。

另外发现了一批**与上架无关但真实存在的数据丢失 bug**（详见第四节各模块「高」级问题），建议无论是否上架都优先修复。

---

## 二、上架阻断项（P0，不解决无法提交）

### P0-1 去掉「本机 Python 后端」依赖
- `desktop/main.js:20-29,52-60`：探测并 spawn 系统 Python 跑 run.py。MAS 沙盒禁止执行 bundle 外二进制；`main.js:89-93` 找不到 Python 时引导用户去 python.org 下载，直接违反 Guideline 2.5。
- 前端对 `/api/*` 的全部依赖点（详单见 §4.7）：备份（hub）、金价/汇率/币价（project-one 行情页）、比分（project-four 看球）、磁盘扫描清理（project-four 磁盘页）。
- **方向**：把「存盘备份」抽象成可替换的存储接口（Web 版走 fetch，App 版走原生桥/文件系统）；行情与比分改前端直连公开 API（project-one `src/lib/markets.ts` 里已有现成的 CoinGecko/frankfurter 直连实现，目前是死代码）；磁盘清理功能按平台裁剪（见 P0-4）。

### P0-2 签名 / 公证 / entitlements 从零开始
- `desktop/package.json:65` `"identity": null` 显式关闭签名；target 只有 dmg/zip，无 `mas` target；全仓库无 entitlements.plist、无 hardenedRuntime、无公证配置、无任何 iOS 工程。
- `desktop/README.md:34` 把「右键打开绕过 Gatekeeper」写成正常流程——上架前需要 Apple Developer 账号、3rd Party Mac Developer / Distribution 证书、`com.apple.security.app-sandbox` + network entitlements、privacy manifest（PrivacyInfo.xcprivacy）。

### P0-3 隐私承诺与实现对齐（审核 + 实质安全）
| 问题 | 位置 | 说明 |
|---|---|---|
| 影像「私密区」无任何加密、无密码门、无设为私密的 UI | project-two 全库（store.ts:50-56 明文存 IndexedDB） | README/启动器宣传「私密区加密」，实现为零；且 Events/People/MapView/Cleanup 四个页面不过滤 `private` 标记 |
| 开发世界主密码硬编码 | project-four `src/lib/vault.tsx:43` `AUTO_PW = "dev-world::no-password"` | API key、账户密码、公司税号、发票全部用公开常量加密，零知识承诺不成立 |
| 理财主密码明文进 sessionStorage | hub `index.html:378` 写入、project-one `VaultContext.tsx:74` 读取 | 四个子应用同源，任一子应用 XSS 即可读走主密码解密全部数据 |
| 真实家庭数据可能打进安装包 | project-one `src/data/defaultData.ts:7`（glob 打包 history.json）；`sample.ts:49-50`、`exportExcel.ts:47` 硬编码真实姓名 | 构建机上存在真实 history.json 时，全家账户余额明文进 bundle JS |
| GPS 坐标发给第三方 | project-two `geocode.ts:5-6`（nominatim） | 需在隐私营养标签中申报，UI 需明示 |

### P0-4 按平台裁剪不可行功能
- **磁盘清理**（run.py:405-490 + project-four Disk.tsx）：删 `~/Library/Caches`、清空废纸篓——iOS 无此概念，MAS 沙盒也做不到。iOS/iPad 版必须整页隐藏；Mac 版要么砍掉、要么走 Developer ID 公证的非 MAS 分发。审核对「永久连不上服务的整页占位」很敏感（Disk.tsx:47 的报错文案会一直显示）。
- **Touch ID 解锁**（hub:596-657 WebAuthn+PRF）：WKWebView 内基本不可用，且三处硬编码「用 http://localhost:5180 打开」的提示。需换原生 LocalAuthentication 桥。
- **`confirm()`/`alert()`**：WKWebView 默认不弹（恒返 false）——影像/密码/开发世界共 10+ 处删除确认会**静默失效**。需统一换成应用内确认组件。

### P0-5 审核策略风险（提前想好答复）
- **4.2 最低功能**：「四合一家庭工具 + 顶栏 iframe 切换」形态要让每个模块都有完整独立价值，避免被认为是打包网页。
- **2.3.1 / 5.1.1**：宣传文案（本地加密、不联网）必须与实现一致——修完 P0-3 后才成立。当前 project-two 运行时从 jsdelivr CDN 注入 face-api/leaflet（cdn.ts:4-15，无 SRI）、拉 OSM 瓦片，与「不联网」矛盾，也需要在 ATS/隐私标签中申报或打包进本地。
- App 名「我家里的一切」需准备英文本地化名；四端截图、隐私政策 URL、年龄分级（含「看球/盘口」内容——odds 字段可能触发博彩相关审核关注，建议上架版隐藏盘口显示）。

---

## 三、三端技术路线建议

### 关键决策：桌面/移动壳的技术栈要先统一

现状是**两套桌面方案并存**：desktop/ 是 Electron 壳，project-one 里又有 Tauri 的 Windows 打包（CI 唯一的 workflow 也在打 Tauri Windows 包，且触发分支写死为已废弃的临时分支 build-windows.yml:8）。上架前必须二选一。

**推荐：统一 Tauri 2。** 理由：
- Tauri 2 同时支持 macOS 和 **iOS**（以及 Android/Windows），一套 Rust 后端命令可以替代 run.py 的全部职责（备份存盘、行情代理、比分代理），三端共用；
- 体积小、内存低，对 iPad/iPhone 友好；MAS 上架路径成熟；
- 仓库里已有 project-one 的 src-tauri 底子，团队已接触过。

备选：**Capacitor（iOS/iPad）+ Electron 重构（Mac）**——前端几乎不用动构建方式，但要维护两套原生层，且 Electron 走 MAS 要把 run.py 逻辑用 Node 重写进主进程、补 mas target 与 entitlements，工作量不比 Tauri 少。

### 共同前置工程（无论选哪条路线）

1. **数据层抽象**：定义统一 `StorageProvider` 接口（读/写/备份/恢复），Web 版实现走 `/api/backup/*`，App 版走原生文件（iOS：应用容器 + iCloud Drive 可选；Mac：Application Support）。理财的 localStorage 持久层（storage.ts）迁到 IndexedDB/原生文件——iOS 的 localStorage 属可清除存储，对加密金库不可接受；影像原图全存 IndexedDB 在 iOS 有被系统整库清除的风险（`navigator.storage.persist()` 在 iOS 不生效），必须改原生文件存储。
2. **hub 集成方式重构**：iframe 方案在 iOS WebKit 有 `height:100%` 失效的顽疾（hub:37 + body overflow:hidden 会裁掉子应用下半截），且绝对路径 `/finance/` 强依赖根路径托管。建议改为单 SPA 路由集成或至少实测 WKWebView 下的 iframe 行为。
3. **响应式与触屏改造**（详单见 §4）：每个应用一轮系统性改造，统一处理：
   - 断点布局（侧栏可折叠、表格横向滚动容器、grid 降列）；
   - `100vh` → `100dvh`；viewport 加 `viewport-fit=cover` + `env(safe-area-inset-*)`；
   - 所有 input `font-size ≥ 16px`（防 iOS 聚焦缩放）；
   - 触控目标 ≥ 44pt；`:hover` 包进 `@media (hover:hover)`；tooltip/title 信息给触屏替代入口；
   - 图表 tooltip 加 pointer/touch 事件；Lightbox 加滑动手势；视频加 `playsInline muted`。
4. **外部数据直连化**：金价/汇率/币价/比分从「本机代理」改为前端直连（或轻量云函数），错误文案去掉「run.py / localhost:5180」字样。
5. **HEIC**：iPhone 相册默认 HEIC，project-two 目前用 `new Image()` 解码、失败静默跳过（整批 iPhone 照片丢失无提示）——需引入转码（heic2any 或原生桥）。

### 分端要点

| | iPhone | iPad | Mac |
|---|---|---|---|
| 壳 | Tauri 2 iOS（或 Capacitor） | 同 iPhone，+ 分栏布局利用大屏 | Tauri（或 Electron 重构 + mas target） |
| 存储 | 原生文件 + 可选 iCloud | 同左 | Application Support（沿用现有目录） |
| 生物识别 | LocalAuthentication 桥（替代 WebAuthn） | 同左 | Touch ID（同一桥） |
| 功能裁剪 | 磁盘页隐藏；导出改 Share Sheet | 同左 | 磁盘清理砍掉或走非 MAS 分发 |
| 审核重点 | 隐私标签、最低功能 | 同左 + 真机 iPad 布局截图 | 沙盒 entitlements、公证 |

---

## 四、代码级发现明细（按模块）

> 每个模块内按 高 / 中 / 低 排序，行号基于 v0.3.0。

### 4.1 project-three 家庭密码（密码管理器）

**高**
- `lib/vault.tsx:132-139` 导入未试解密就 `saveVaultFile` 覆盖唯一保险库，不留旧库备份——导入损坏文件 = 全家密码永久丢失。**全仓库最该先修的问题之一**：导入前先用用户输入的密码试解密，成功才落盘，并自动备份旧库。
- `lib/crypto.ts:66-69` `isVaultFile` 不校验 `iter`/`v`：`iter:1` 弱化 KDF、`iter:1e10` 解锁卡死、`iter` 缺失则库永远打不开。
- `lib/vault.tsx:156-164` 自动锁只靠 setTimeout，iOS 切后台定时器挂起，无 `visibilitychange`/`pagehide` 立即锁定。

**中**
- `lib/vault.tsx:151` 剪贴板 25 秒自动清空在 iOS 后台不执行且失败被静默吞掉；清空前不校验剪贴板内容，会误清用户后续复制的内容。
- `lib/store.ts:10-22` IndexedDB 打开失败的 rejected Promise 被永久缓存，此后所有读写失败。
- `lib/vault.tsx:89-103` saveItem/deleteItem/toggleFavorite 基于闭包旧 data 整库重写，快速连续操作丢更新；多标签页 last-write-wins 互相覆盖（store.ts:33-38）。

**低**
- `lib/generate.ts:21` 取模偏差（应拒绝采样）；不保证每类勾选字符至少出现一次。
- `screens/VaultScreen.tsx:65` 「新建」菜单靠 onBlur 关闭，Safari 点击 button 不给焦点 → 菜单关不上（目标平台真实交互 bug）。
- `screens/ItemModal.tsx:245` 等 30×30 图标按钮 < 44pt；`ItemModal.tsx:31`、`SettingsScreen.tsx:27` 用 `confirm()`。
- 适配：侧栏写死 196px（VaultScreen.tsx:46）、零宽度媒体查询、100vh（App.tsx:13,18）、输入 13.5-15px、toast 压 Home Indicator（App.tsx:37）。
- ✅ 无任何后端依赖（纯本地），架构上最接近可上架状态。

### 4.2 project-one 家庭理财

**高**
- `screens/Settings.tsx:47-48` 关闭二次验证：`update()` 异步未 await，`clearPwBox()` 同步先删——迁移落盘前崩溃/刷新 = 密码全部丢失。
- `screens/Settings.tsx:74-78` `resetAll` 只清主金库，pwbox/secret/backups 残留 → 新建金库后密码保险箱被旧二次验证门永久锁死。
- `vault/VaultContext.tsx:103-111` 写路径无队列：闭包旧 data + sealVault 异步完成顺序不定，旧密文可覆盖新密文（同型：Secret.tsx:75、Passwords.tsx:44 的 fire-and-forget）。
- `vault/VaultContext.tsx:74` sessionStorage 明文主密码（见 P0-3）。
- `data/defaultData.ts:7` 真实 history.json 会被 glob 进 bundle（见 P0-3）。

**中**
- `lib/parseExcel.ts:54-69` 表头找不到时魔法列号 21 兜底；无条件把第 2 行当利率行，普通表格会把余额当利率（5000000% 年利率）污染预测。
- `lib/storage.ts:22-24,62-75` 不处理 QuotaExceededError：备份是全库副本，顶到 5MB 后所有保存静默失败但 UI 显示成功。
- `lib/crypto.ts:6` PBKDF2 310k 迭代低于 OWASP 现行 600k 建议；最短主密码仅 6 位，二次验证/独立管理最短仅 4 位（Settings.tsx:28,36、Secret.tsx:41,57）。

**低**
- `vault/pwStore.ts:35`、`secretStore.ts:39` `JSON.parse(null)` 路径；`vault/ops.ts:20` 等三处用 UTC 日期（东八区早 8 点前差一天）；`lib/compute.ts:180 vs 85` 「较上期」与趋势图口径不一致；`compute.ts:116-117` setMonth 月末溢出；`Unlock.tsx:24-25` 建库失败按钮永久锁死；`lib/markets.ts:96` key 拼 URL（死代码，连同 loadQuotes 建议删除）。
- 适配（改造量最大的模块）：App.tsx:94 写死 1200×800 + 侧栏 236px；全部表格固定列宽无横向滚动（Interest/Income/Budget/Detail/Accounts/Passwords）；图表 tooltip 仅鼠标（Dashboard.tsx:147-163、Budget.tsx:144-155）;100vh、无 safe-area、输入 13.5px、Modal 无键盘避让；行情页 3 个 `/api/*` 调用 + 文案硬编码「由本机 run.py 代取」（Markets.tsx:86,143,201,130,185,243）。

### 4.3 project-two 家庭影像

**高**
- **「私密区」不存在**（见 P0-3）：无加密、无密码门、无设私密的 UI；且 Events/People/MapView/Cleanup 不过滤 private，私密照片直接可见可删。
- `library.tsx:122-126` `updateItem` 在 setState updater 里做落盘判断——React 不保证同步执行，收藏/地名/相册修改会**静默不落盘**。
- `Cleanup.tsx:65-72` 删除磁盘目录索引项只删索引不删文件，下次同步原样「复活」——去重清理对磁盘库整体无效。
- `exif.ts:66-69` 视频缩略图等 `loadeddata` 无超时，iOS 低电量/不支持编码时导入永久卡死。
- HEIC 静默丢失（exif.ts:46-49 + baseDir.ts:8）：iPhone 照片整批缺失无提示。
- `ImportScreen.tsx:82,93` 拖文件夹实际导入 0 张（未用 webkitGetAsEntry 递归）；`f.type` 为空的合法媒体被误跳过。
- 运行时 CDN 注入 face-api/leaflet 无 SRI（cdn.ts:4-15），与「不联网」宣传矛盾且是供应链风险——上架版打包进本地。

**中**
- `library.tsx:98-120` 算了 SHA-256 却不查重，重复导入全变双份；`library.tsx:18` 整文件读入内存算 hash（GB 级视频移动端 OOM）；原图整 Blob 进 IndexedDB（store.ts:50-56，iOS 有整库被清风险，见 §3）。
- `People.tsx:15-19`、`faces.ts:25-45` objectURL 泄漏；`library.tsx:69` 启动为全库缩略图建常驻 blob URL + Gallery 无虚拟化——万张级库 WKWebView 内存崩溃。
- `geocode.ts:5-6` GPS 明文发 nominatim（隐私标签需申报）。

**低**
- render 期 setState（People/Events/Timeline）；视频按封面帧混入相似判定（library.tsx:159-173）；Lightbox 大图闪烁重载（Lightbox.tsx:12-19）。
- 适配：App.tsx:44 写死 1320px 假 macOS 窗口（含交通灯装饰）、侧栏 224px 不可收起、零断点；Lightbox 无滑动手势、视频缺 `playsInline`（iPhone 强制全屏播放器）；`webkitdirectory` 与 File System Access API 在 iOS/Safari 全不可用——**「媒体库文件夹」模式三端 Safari/WKWebView 全灭**，App 版需走原生相册选择器（PHPicker）。

### 4.4 project-four 开发世界

**高**
- `lib/vault.tsx:43` 硬编码 AUTO_PW（见 P0-3）。
- `screens/dev/md.tsx:16` markdown 链接 href 不过滤 scheme：`javascript:` 存储型 XSS；导入器（html.ts:22 等）会把外部文件的恶意链接带进笔记库形成完整攻击链。同型：`Accounts.tsx:136` a.url 原样进 href。
- `Notes.tsx:59-63,34-39` 新建笔记编辑器空白（mut 异步 + effect 只依赖 sel）；`Notes.tsx:42-53` 防抖 cleanup 直接 clearTimeout，切换前 400ms 内输入静默丢失。
- `lib/vault.tsx:128-136` `changeMaster` 不走串行队列，in-flight 旧密钥密文可覆盖新库 → 新密码打不开。
- `lib/vault.tsx:166-173` 复制密钥「N 秒清剪贴板」的 clipTimer 从未设置——密码永久留在剪贴板（iOS 还会被通用剪贴板同步到其他设备），且文案宣称「加密剪贴板」与实现不符。
- `crypto.ts:66-69` 导入不校验 iter（同 project-three）。

**中**
- 导入器：csv.ts:31 全局 `\t→,` 破坏含逗号字段；markdown.ts:8,28 不支持 CRLF；zip.ts:41-44 local header 无校验、不支持 ZIP64（Google Takeout 大包崩）；导出 zip 中文文件名未设 UTF-8 位（Windows 解压乱码，lib/zip.ts:23,33）。
- `lib/vault.tsx:31,63-70` 每次 update 深拷贝 + 整库（含发票 dataURL 图片）重加密重写——发票多了每次击键几十 MB 序列化。
- `autoLockMin` 设置存在但无任何实现（types.ts:44）；`lock()` 不清剪贴板/不重置明文显示状态。

**低**
- bets.ts:31 已退款注单计入总投入；Disk.tsx:9-10 十进制阈值配二进制除数；Spend.tsx:89,92 非受控输入显示陈旧值。
- 适配：App.tsx:47-56 顶栏 **14 个 tab 单行不换行**，iPhone 大部分 tab 不可达；Notes/Life/Calendar/Tasks 等写死多列 grid；100vh、零 safe-area、输入 <16px；6 处 `confirm()`（WKWebView 全部静默失效）；磁盘页整页依赖 localhost（见 P0-4）；比分依赖 `/api/sports`、错误文案提「你 Mac 上的 run.py」。

### 4.5 hub（统一入口）

- **高**：sessionStorage 明文主密码（:378，见 P0-3）；iframe `height:100%` 的 iOS 顽疾（:37）；WebAuthn/PRF 在 WKWebView 不可用 + 硬编码 localhost 提示（:596-657）；`/api/backup` 失败被静默吞掉，自动备份失效无感知（:534-589）。
- **中**：doors 固定横排无断点（:47）、sharedcards 写死 3 列（:65）、输入 14px（:101,118）、顶栏 50px 无 safe-area（:24）、hover-only（:31 等 5 处）、`confirm()`（:486,:567）、大量 innerHTML 拼接（:291-306,663-666，当前数据是常量暂无注入，模式危险）。

### 4.6 desktop（Electron 壳）+ 构建链

- **高**：系统 Python 依赖与零签名配置（见 P0-1/P0-2）；Electron 31 已 EOL、electron-builder 24 落后（MAS 相关修复在 25+）（package.json:15-16）。
- **中**：`main.js:49` 只要 5180 有响应就认为是自家后端——任意本地程序占用 5180 即可把自己的页面装进这个 App（应校验 `/api/version` 特征）；`will-navigate` 未拦截（:79-82 只管了 window.open）；缺 `sandbox:true` 与 CSP；崩溃时 Python 孤儿进程（:108）；子进程 stdout/stderr 全丢弃无诊断（:61-63）。
- **构建链**：CI 触发分支写死已废弃的临时分支（build-windows.yml:8），只有 Windows/Tauri 无 macOS/iOS；`npm run mac` 不先构建四个子项目——dist 过期会**静默发布旧代码**（desktop/package.json:11,28-57）；版本同步只覆盖 desktop（sync-version.js:11-16），四个子项目和 tauri.conf.json 版本脱节；project-three 缺 package-lock.json 构建不可复现；`xlsx@0.18.5` 带已知 CVE（原型污染 CVE-2023-30533、ReDoS CVE-2024-22363），npm 渠道已停更需换源或换库；Vite 5 已过维护期。

### 4.7 run.py（我的补充审查）

- `resolve():175` 目录穿越防护用字符串前缀比较且未拼接分隔符——同级形如 `dist2` 的目录会被误判在 `dist` 内。当前挂载名固定，实际不可利用，但建议改为 `Path.is_relative_to()`。
- 静态服务无 Range 支持（do_GET 整文件读入内存返回）：Safari 的 `<video>` 依赖 Range 请求，若未来从服务端出视频会无法拖动进度；大文件全量进内存也不经济。
- POST 的 Origin 校验（:593-595,604-606）「无 Origin 头即放行」：浏览器场景下有 preflight 兜底基本安全，但同机任意进程可直接调 `/api/disk/clean` 删文件——本机自用可接受，App 化后此层应移除或加 token。
- `backup_save`（:103-148）读-比-写无锁，多入口并发保存存在竞态（ThreadingTCPServer 多线程）。
- `_safe_custom`（:431-439）深度 ≥4 即放行：`~/某目录` 恰好 4 段，不在黑名单的家目录一级子目录可被整目录清理——阈值建议再收紧一级。
- `fetch_fx`（:265）用 `time.mktime` 按本地时区解析日期，历史曲线时间戳随机器时区漂移（图表按天展示影响轻微）。

---

## 五、修复优先级路线

**第一批：数据安全（1-2 天，与技术选型无关，现在就该修）**
1. project-three 导入先试解密再覆盖 + 自动备份旧库；两个 crypto.ts 补 iter/v 校验（下限 100k、上限 5M）。
2. project-one Settings 关闭二次验证改为「先迁移成功、后清理」；resetAll 清理全部姊妹存储。
3. project-four md.tsx / Accounts.tsx 链接 scheme 白名单（http/https）；修 clipTimer；修 Notes 新建空白与防抖丢字。
4. project-two updateItem 移出 setState updater；私密过滤补齐 4 个页面（或先把「私密区」宣传撤下）。
5. 三处写路径统一加串行写队列（project-one VaultContext、project-three vault、project-four changeMaster）。

**第二批：技术选型与后端替换（决策点）**
6. 定桌面/移动壳：推荐统一 Tauri 2（见 §3）；同时清理 Electron/Tauri 双轨。
7. 数据层抽象 StorageProvider；理财迁出 localStorage；影像原图迁原生文件。
8. 行情/比分改直连；磁盘页按平台裁剪；WebAuthn → LocalAuthentication 桥；confirm() → 应用内组件。
9. 去除硬编码真实姓名/真实数据打包路径；project-four 恢复真实主密码或接 Keychain。

**第三批：三端 UI 改造（每应用一轮）**
10. 统一基建：viewport-fit=cover、safe-area、100dvh、input≥16px、hover 媒体查询、44pt 触控目标——建议做成共享 CSS 底座后逐应用套用。
11. 各应用断点布局（hub doors/卡片、理财表格横滚+侧栏折叠、影像去假窗口+虚拟化+手势、开发世界 14-tab 折叠、密码库侧栏折叠）。
12. HEIC 转码、视频 playsInline、图表 touch tooltip。

**第四批：上架工程**
13. Apple Developer 账号、Bundle ID 规划（建议一个主 App 而非四个）、证书/描述文件。
14. entitlements + 沙盒适配、privacy manifest、隐私营养标签（申报：本机存储、nominatim 反地理编码、行情 API、OSM 瓦片）。
15. CI 补 macOS + iOS 构建与签名流水线（修掉写死的触发分支）；`npm run mac` 前串联四个子项目 build；版本同步覆盖全部 package.json + tauri.conf.json。
16. 商店素材：三端截图（iPhone 6.7"/iPad 12.9"/Mac）、本地化名称与描述、隐私政策页、年龄分级（注意盘口/博彩内容的分级影响）。

---

## 六、一句话总结

**代码底子（尤其密码学）比想象中好，但「本机 Python 后端 + 桌面像素布局 + 三处名不副实的加密承诺」这三件事决定了：先修数据安全 bug、再定 Tauri/Capacitor 技术路线替换后端、然后做一轮系统性响应式改造，最后才是签名上架流程。** 按上面四批推进即可，第一批与技术选型无关，建议立即开始。
