# 健康档案：使用与 Mac 交接

## 启动和入口
根目录 `python3 run.py`（Windows 可用 python），从大厅健康记录入口进入，或访问 `http://127.0.0.1:5180/dev/#health`，使用原工作台主密码解锁。健康页默认进入健康档案，原有血压、血脂、饮食手记保留。
开发后须 `npm ci --prefix project-four`，`npm run build --prefix project-four`，统一服务读取 dist。

## 数据目录和保存边界
`HOME_HEALTH_DIR` 可显式指定目录。未指定时：仓库存在 `health-data.local/archive-index.json` 则使用该本地档案，否则使用原应用 DATA_DIR 下的 health 目录。
健康档案目前为本机明文 JSON 与 PDF/图片，独立于旧工作台的加密保险库，不能把解锁页面当成健康档案的文件加密。默认不上传云端，不应提交个人数据到 Git。原全屋 .home 备份不包含此侧档案。
数据目录至少包含 archive-index.json 及清单引用的全部 PDF/图片；其他提取中间文件非运行必需。

## 使用
- 指标趋势：按医学领域筛选，选择指标、日期范围。横轴按实际检查日期间隔；缺失不补值；不同标准单位分开绘图。定性、带检测限符号及单位未确认的结果保留明细，不直接画为普通数值。
- 检查时间线：按日期排序，同次医院采样的分项报告归组，原件仍独立卡片。日期不明附件单列；点击当次卡片查看全表。
- 原件追溯：记录提供 PDF 页码或图片原件链接；后端校验文件路径和内容哈希。原件未迁入时标记缺失。
- 指标百科：按临床领域分类；当前词典覆盖188种已识别指标、14类。点击卡片、表格指标或趋势标题旁“医学说明”，查看测量含义、常见用途、解释限制、参考来源及核对日期，可切换到自己的历史曲线。
- 医学说明是通用科普，不是对当前用户的诊断。肿瘤标志物不单独确认/排除癌症；PCT血小板压积不与降钙素原混淆；感染抗体不统一解释为活动性感染。TSGF明确提示本轮未核实具体方法的临床依据。未来未知指标显示待整理，不自动编造解释。
- 待核对：保留日期、内容冲突与图片覆盖范围说明。医学异常与提取疑点分开。

## 新医院化验与追加
第一版接受标准化 archive JSON 或本页导出的 ZIP。原始 PDF/照片/Excel需先提取校对，不要把原件直接当标准化文件上传。当前报告提取在本地辅助流程完成，页面没有云OCR自动识别或Apple健康XML解析器。
每条记录需稳定ID、标准指标名、来源报告、页码和检查日期。保留原值与原单位、原参考范围；标准值/单位另存。尿素与尿素氮、血检与尿检、不同检验方法不盲目合并。
追加导入会跳过完全重复记录；同ID有差异时整批拒绝覆盖并保留旧库，提示先核对。每次成功导入在 health/history 留前版JSON；原件按内容哈希验证，不覆盖不同内容。

## Mac 迁移
1. Windows 健康页点击“备份 / 迁移到 Mac”，得到 ZIP，含结构化数据及可用报告原件。该文件包含个人健康隐私且未加密，应通过可信方式传输保管。
2. Mac 获取本轮代码（使用 codex/daily-modules 分支；完整命令见 docs/mac-health-handoff.md）。Node 22.12+、Python 3。需要重新构建子应用时执行上述npm命令。
3. 启动统一入口，在健康页“追加档案”选择ZIP并确认，默认恢复到Mac本机DATA_DIR/health。仅JSON不保证原件已迁移。
4. 验证时间线、记录数、关键曲线及原件链接。代码版本号仍沿用当前基线，未进行Mac安装包发布。
5. Electron打包已新增health_archive.py资源，须在Mac实测；本轮Windows未执行Mac打包。

## 开发入口与验证
- `health_archive.py`：校验、读取、增量导入、原件和便携备份。
- `run.py`：`/api/health/archive`、`/api/health/source`、`/api/health/export`、`/api/health/import`；导入严格同源并限制100MB。
- `project-four/src/screens/dev/HealthArchive.tsx`及CSS：实际页面。
- `project-four/src/data/healthMetrics.ts`：通用医学分类/说明，不包含个人数值。
- `python scripts/test-health-archive.py`：临时目录合成数据，测试重复、冲突、恢复、路径、日期与单位边界。
- `node scripts/test-health-metrics.cjs`：188项覆盖及关键解释边界；`scripts/health-metric-keys.json`仅标准指标代码，不含隐私。
- `python scripts/test-backup-safety.py`：原有备份安全回归；Windows跳过POSIX权限项。
- `npm run build --prefix project-four`：类型检查和构建。仍存在原有大包提示。锁文件Vite从8.3.2兼容升级至8.3.6，npm audit为0漏洞。
- DATA_VERSION保持7：本轮未改旧DevData持久化字段，健康档案使用独立draft-0.2结构。

资料核对日期2026-11-05。词典每项自带MedlinePlus、CDC、NIDDK、NCI或具体检验/仪器机构来源；未接受临床医生审校，不伪称医生审核。

## 历史核验与采样日期
历史栏与直接原件按历史日期和指标比较，数值须单位一致，文本保留原格。匹配项补充 supporting_sources，不再生成重复测量。无原件的历史引用保存在报告 historical_references 中，可在待核对页查看，暂不进入主曲线。不同结果留待复核，不用新报告日期替代历史测量日。
医院报告以明确采样日期归档，sampled_at保留时区与分钟/秒精度；不从截图文件名推断采样日。相同采样的分项报告通过明确 encounter_id 分组，不仅凭同一天合并。原蛋白电泳百分比与浓度、LDH同工酶与总活性分开。MDRD单位截断、未明确的载脂蛋白A分型、无单位项目保留疑点。

命令行完整恢复及Mac接续见 [Mac交接](mac-health-handoff.md)。
