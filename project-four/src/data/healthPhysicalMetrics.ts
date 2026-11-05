import type { MetricInfo } from "./healthMetrics";

// Explanations for the descriptive examination fields in the imported archive.
// These describe the examination, never infer a diagnosis from the recorded text.
const physicalSource = { title: "MedlinePlus · 体格检查", url: "https://medlineplus.gov/ency/article/002274.htm" };
const eyeSource = { title: "美国国家眼科研究所 · 散瞳眼科检查", url: "https://www.nei.nih.gov/eye-health-information/healthy-vision/finding-eye-doctor/get-dilated-eye-exam" };
const dentalSource = { title: "MedlinePlus · 口腔检查", url: "https://medlineplus.gov/lab-tests/dental-exam/" };
const physical = (categories: string[], what: string, meaning: string, source = physicalSource): MetricInfo => ({
  categories, what, meaning, limits: "这是体检医生的描述性观察，受检查方法和当时状态影响；需结合症状及其他检查理解，不宜按单个词语自行诊断。",
  sources: [source], checkedOn: "2026-11-05",
});
const body = ["体征与身体成分"];
const cardio = ["心血管与血脂"];
const eye = ["眼科"];
const ent = ["耳鼻喉与口腔"];
export const PHYSICAL_METRIC_INFO: Record<string, MetricInfo> = {
  "unmapped.597e6c0b6700": physical(body, "内科问诊中的既往病史记录。", "帮助医生了解过去疾病、治疗和手术情况。"),
  "unmapped.b7be4c10531d": physical(body, "此次就诊时主动提出的症状或主要问题。", "给检查和后续问诊提供背景。"),
  "unmapped.c335cf15073c": physical(body, "体检对营养状态的外观判断。", "辅助描述总体身体状况；不同于血液营养指标。"),
  "unmapped.6c455919e8fd": physical(body, "医生观察的面部外观和精神状态。", "作为体格检查的描述性线索。"),
  "unmapped.d23cc008384f": physical(body, "站姿、体形或身体姿态的检查记录。", "描述检查时的外观和姿态。"),
  "unmapped.599ec6e92ca9": physical(cardio, "听诊时记录的心音。", "用于描述心脏听诊所见。"),
  "unmapped.920945302d18": physical(cardio, "听诊时有无额外心脏杂音的记录。", "提示是否需要结合症状和超声心动图进一步评估。"),
  "unmapped.ec78aa1e6973": physical(["呼吸系统"], "肺部视诊、叩诊或听诊所见。", "帮助医生观察呼吸系统体征。"),
  "unmapped.0462ec0e6362": physical(["肝脏与胆道"], "腹部检查中肝脏触诊或叩诊所见。", "描述肝脏大小、压痛等体征，不等同肝功能化验。"),
  "unmapped.63dbe1d09acc": physical(["消化道检测"], "腹部检查中脾脏触诊所见。", "描述是否能触及脾脏等体征。"),
  "unmapped.117367657138": physical(["消化道检测"], "腹部视诊、触诊、叩诊或听诊所见。", "记录压痛、肠鸣音等检查线索。"),
  "unmapped.cd5778aef9fa": physical(body, "皮肤颜色、皮疹或其他表面改变的观察。", "记录体检时可见的皮肤体征。"),
  "unmapped.7b38db418383": physical(body, "颈部、腋下等浅表淋巴结的触诊记录。", "记录是否触及肿大、压痛等体征。"),
  "unmapped.620075dff1a2": physical(["甲状腺"], "颈部甲状腺的触诊所见。", "描述腺体大小或结节等体征，不代替甲功化验或超声。"),
  "unmapped.1f53a85797d5": physical(body, "乳房视诊与触诊所见。", "记录体检时可触及的改变。"),
  "unmapped.fbeef803d4cf": physical(body, "脊柱形态与活动的检查记录。", "描述姿态、压痛或活动限制。"),
  "unmapped.7d1a43f87c7a": physical(body, "四肢和关节的外观、活动、肿胀或压痛记录。", "描述运动系统体征。"),
  "unmapped.815a5fa69f11": physical(eye, "眼睑、结膜和眼球外观的检查记录。", "用于观察眼部表面是否有明显异常。", eyeSource),
  "unmapped.8481effa10a7": physical(ent, "外耳及耳道等部位的检查记录。", "描述体检时耳部所见。"),
  "unmapped.8940dd82b056": physical(ent, "鼻腔和鼻黏膜等部位的检查记录。", "可按年份查看鼻炎等原报告文字。", { title: "MedlinePlus · 变应性鼻炎", url: "https://medlineplus.gov/ency/article/000813.htm" }),
  "unmapped.ba93caf3fba3": physical(ent, "口咽部黏膜、扁桃体等部位的检查记录。", "描述咽部可见体征。"),
  "unmapped.5079a7d48923": physical(ent, "牙龈和牙周组织的检查记录。", "帮助观察牙周炎症及其他牙龈问题。", dentalSource),
  "unmapped.fa54abb63e5e": physical(ent, "口腔内黏膜的检查记录。", "描述口腔表面的可见改变。", dentalSource),
  "unmapped.9f653ee0879c": physical(ent, "颌骨、面部及口颌结构的检查记录。", "帮助记录牙科和颌面部外观所见。", dentalSource),
  "unmapped.3a55f7f0f1f2": physical(ent, "牙齿本身的检查记录。", "帮助观察龋齿、缺损等牙体情况。", dentalSource),
  "unmapped.cfa2589db1c9": physical(["呼吸系统"], "胸廓形态和呼吸运动的体检记录。", "描述胸部外观和活动情况。"),
  "unmapped.d9a3815aba52": physical(cardio, "小腿或踝部是否水肿的体检记录。", "作为体液状态和循环系统检查的一部分。"),
  "unmapped.1cda3beed49d": physical(body, "腱反射等神经系统体格检查记录。", "描述神经反射是否存在或对称。"),
  "unmapped.f406c8967fce": physical(cardio, "四肢外周动脉搏动和灌注的检查记录。", "描述体检时末梢循环体征。"),
  "unmapped.939ec8ce5c96": physical(["消化道检测"], "肛门和直肠的指诊记录。", "描述该部位的触诊所见；并非肠镜结果。"),
  "unmapped.8b6535f3e026": physical(body, "泌尿生殖系统的体格检查记录。", "描述检查时可见或可触及的体征。"),
  "unmapped.63fb6cdaf96d": physical(eye, "眼底视网膜、视神经等部位的检查记录。", "帮助观察眼底结构所见。", eyeSource),
  "unmapped.f67043583d96": physical(eye, "用裂隙灯显微镜观察眼前节等结构的记录。", "可更细致观察角膜、结膜等眼部结构。", eyeSource),
  "eye.iop.od": { categories: eye, what: "右眼眼内压力的测量值。", meaning: "作为眼科检查的一部分，结合视神经与视野评估。", limits: "单次眼压不能单独诊断或排除青光眼。", sources: [eyeSource], checkedOn: "2026-11-05" },
  "eye.iop.os": { categories: eye, what: "左眼眼内压力的测量值。", meaning: "作为眼科检查的一部分，结合视神经与视野评估。", limits: "单次眼压不能单独诊断或排除青光眼。", sources: [eyeSource], checkedOn: "2026-11-05" },
  "body.bsa": { categories: body, what: "根据身高和体重估算的体表面积，单位通常是平方米。", meaning: "可用于某些治疗方案的剂量计算。", limits: "它是计算值，不是体脂率或身体健康评分；算法不同可能略有差异。", sources: [{ title: "美国国家癌症研究所 · 体表面积计算", url: "https://ccrod.cancer.gov/confluence/download/attachments/51577349/eCRF_Instructions_v1.0.pdf" }], checkedOn: "2026-11-05" },
  "unmapped.335bf38cb9fb": { categories: ["肿瘤标志物"], what: "报告写作前列腺特异性抗原（PSA），但未明确总 PSA 还是游离 PSA。", meaning: "PSA 可用于前列腺相关问题的评估与随访。", limits: "本条不与总 PSA、游离 PSA 的曲线直接合并；PSA 高值也不能单独诊断癌症。", sources: [{ title: "MedlinePlus · PSA 检测", url: "https://medlineplus.gov/lab-tests/prostate-specific-antigen-psa-test/" }], checkedOn: "2026-11-05" },
};
