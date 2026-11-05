# 个人健康管理：维护讨论与付费产品调研

日期：2026-11-05；资料来自官方产品页/帮助中心，属于公开资料调研，未付费体验，不是市场份额排名。价格为页面显示美元标价，地区与结账价格可能不同。

## 用户已确认
目标是统一汇总：历年体检/化验报告、持续设备测量、日常状态、症状/用药/复查等均需要。正常识别自动整理，只确认疑点。允许云端处理，优先识别效果与便利性。当前优先解决 Apple Watch 数据导出。

## Apple Watch：历史导出与后续维护
手表数据先同步到配对 iPhone 的健康 App。在 iPhone 打开健康 -> 右上角头像 -> 导出所有健康数据 -> 导出 -> 保存到文件或 AirDrop 给 Mac。保留完整 ZIP 原件，内部 XML 作为第一版导入目标；实际指标覆盖以用户导出样例为准，不能假定所有手表功能都有数据。
官方步骤：https://support.apple.com/zh-cn/guide/iphone/iph5ede58c3d/ios
完整 ZIP/XML 说明：https://athlyticapp.helpscoutdocs.com/article/47-can-i-export-data-from-athlytic

推荐首期：官方全量导出建立历史底库，之后重复导入时去重，只新增/修订记录，不重复计算。全量文件导出是手动流程，不应称为实时同步。
后续可评估 Health Auto Export：JSON/CSV 等导出与自动化，帮助中心说明锁屏、后台刷新、低电量与系统调度可能影响任务，不能承诺准时实时运行。不要只保存汇总 CSV 而丢掉需要的原始精度。
https://www.healthyapps.dev/
https://help.healthyapps.dev/en/health-auto-export/automations/
Mac 网页/Electron 不能被假定可以直接读取 iPhone 健康库；原生授权桥接与文件导入是不同方案。Apple 可用性文档：https://developer.apple.com/documentation/HealthKit/HKHealthStore/isHealthDataAvailable%28%29

## 代表性付费产品与设计借鉴
| 产品 | 官方功能/收费 | 对本项目的设计启发 |
| --- | --- | --- |
| Guava | Premium $78/年或 $8/月；整合医疗记录、设备、上传文档；付费提供化验自动提取、自动洞察、AI 助手、家庭管理 | 最接近统一档案入口：报告、结构化指标、时间轴与就诊摘要互通 |
| InsideTracker | Membership $149/年；上传历史血检，整合血液、DNA 与设备信息，指标分析、类别评分与行动计划 | 化验指标纵向比较值得借鉴；参考区间、产品理想区间和个人目标应明确区分 |
| Function Health | 官方公告 $365/年，包含检测服务、医生审阅和持续追踪，不能当作纯软件订阅比较 | 借鉴报告到解读到行动再到复测的闭环；不复制其检测套餐商业模式 |
| Athlytic | 付费 Pro，官网 widgets 页约 $30/年；围绕 Apple Watch 恢复、训练负荷、睡眠、摘要和小组件 | 用少量摘要承接大量传感器数据，缺数据标缺失；不将恢复评分当体检结论 |
| Welltory | Premium 提供 HRV、压力/精力、睡眠、运动与血压分析；定价因方案而异，本次不固定报价 | 借鉴每日简报与多设备聚合；其官方说明不收医疗数据，因此不能替代完整医疗档案 |
| Bearable | 免费基础追踪，Premium 增加相关性报告、更长历史、自定义测量/目标等 | 症状、用药、习惯和事件放同一时间线；相关性只提示共同变化，不表述为因果 |

来源：
- https://guavahealth.com/plans
- https://guavahealth.com/article/guava-ultimate-guide （支持修改抽取错误及 PDF/CSV 导出）
- https://store.insidetracker.com/products/insidetracker-membership
- https://www.functionhealth.com/article/function365
- https://athlyticapp.com/widgets/
- https://athlyticapp.helpscoutdocs.com/article/47-can-i-export-data-from-athlytic
- https://help.welltory.com/en/articles/4007331-welltory-premium-personalized-guidance-habit-analytics-and-so-much-more
- https://help.welltory.com/en/articles/11130907-data-sources-and-how-to-connect-them
- https://bearable.app/support/common-questions/bearable-free-vs-premium-features/

## 维护方案（建议，未实现）
1. 原件层：保留报告/设备导出原件与哈希；解析失败也保留并给出原因。
2. 统一记录层：保存原值/原单位和规范值/单位、测量时间/时间精度、来源设备/机构、报告参考区间、标本与方法。定性结果、范围值及睡眠区间单独处理。
3. 派生层：日/周/月摘要及趋势可重算，注明算法版本、覆盖率与数据更新时间。临床低频化验和高频传感器分开展示，支持对齐时间查看。
4. 自动维护：结构化数据校验通过可自动入库；OCR 错位、陌生指标、不明单位、日期冲突、疑似重复、多个来源矛盾进入待确认。识别疑点与医学异常分开标记。
5. 修订维护：不覆盖原件；更正记录保留前值、理由及时间。重导幂等；修订/撤销后重算摘要。保留删除标记以免下次全量导入复活。
6. 数据新鲜度：首页显示各来源最后一次成功导入、覆盖日期、缺口和失败状态；无数据不是 0。不同设备重叠不直接相加。
7. 迁移备份：原件、规范数据、词典版本及修订记录整体备份，可导出机器可读格式；Mac 换机验证恢复。Git 仅存代码/文档，不存健康原件。
8. 云端识别允许接入；具体供应商、数据保留/训练选项、费用和密钥配置尚未确定，尚无健康数据上传。

## 推荐页面结构
总览（变化与待办） / 健康时间线 / 指标趋势 / 报告与导入 / 症状与用药 / 数据来源与备份。
下一步先拿 Apple 官方导出样例与一份历史体检样例，验证导入模型；此轮未进入实现。
