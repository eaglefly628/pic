// General educational descriptions, checked 2026-11-05. No personal values or diagnostic thresholds.
export type MetricInfo = { categories: string[]; what: string; meaning: string; limits: string; sources: { title: string; url: string }[]; checkedOn: string };
export const HEALTH_CATEGORIES = ["心血管与血脂", "血糖与代谢", "肝脏与胆道", "肾脏与尿检", "血常规", "凝血功能", "甲状腺", "肿瘤标志物", "感染与免疫", "铁代谢与营养", "电解质与酸碱", "体征与身体成分", "眼科", "消化道检测"] as const;
export const METRIC_INFO: Record<string, MetricInfo> = {
  "hpylori.overview": {
    "categories": ["消化道检测", "感染与免疫"],
    "what": "汇总幽门螺杆菌的 C13 尿素呼气试验、血清抗体和胃黏膜病理记录；每条保留其检查方法。",
    "meaning": "按年份查看不同检查的原始结果。C13 呼气试验检测值可单独画趋势，定性结论按日期列出。",
    "limits": "血清抗体可反映既往接触，不能单凭抗体阳性确认当前感染；抗体数值与呼气试验数值不可直接比较。检测解释还受用药和检查条件影响。",
    "sources": [{"title": "MedlinePlus · 幽门螺杆菌检测", "url": "https://medlineplus.gov/lab-tests/helicobacter-pylori-h-pylori-tests/"}],
    "checkedOn": "2026-11-05"
  },
  "lipid.tc": {
    "categories": [
      "心血管与血脂"
    ],
    "what": "血液中各种脂蛋白携带的胆固醇总量。",
    "meaning": "辅助了解血脂、血压和心血管相关风险，适合结合多次检查看变化。",
    "limits": "个人目标需结合整体风险、用药和医生评估，不能用单项数值直接判断是否患病。",
    "sources": [
      {
        "title": "MedlinePlus · 胆固醇检测",
        "url": "https://medlineplus.gov/lab-tests/cholesterol-levels/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "lipid.ldl": {
    "categories": [
      "心血管与血脂"
    ],
    "what": "低密度脂蛋白携带的胆固醇，常用于动脉粥样硬化风险评估及降脂随访。",
    "meaning": "辅助了解血脂、血压和心血管相关风险，适合结合多次检查看变化。",
    "limits": "个人目标需结合整体风险、用药和医生评估，不能用单项数值直接判断是否患病。",
    "sources": [
      {
        "title": "MedlinePlus · 胆固醇检测",
        "url": "https://medlineplus.gov/lab-tests/cholesterol-levels/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "lipid.hdl": {
    "categories": [
      "心血管与血脂"
    ],
    "what": "高密度脂蛋白携带的胆固醇，参与胆固醇转运。",
    "meaning": "辅助了解血脂、血压和心血管相关风险，适合结合多次检查看变化。",
    "limits": "不是越高越好，也不能抵消其他心血管危险因素。",
    "sources": [
      {
        "title": "MedlinePlus · 胆固醇检测",
        "url": "https://medlineplus.gov/lab-tests/cholesterol-levels/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "lipid.non_hdl": {
    "categories": [
      "心血管与血脂"
    ],
    "what": "总胆固醇减去HDL胆固醇，概括多类致动脉粥样硬化脂蛋白所含胆固醇。",
    "meaning": "辅助了解血脂、血压和心血管相关风险，适合结合多次检查看变化。",
    "limits": "个人目标需结合整体风险、用药和医生评估，不能用单项数值直接判断是否患病。",
    "sources": [
      {
        "title": "MedlinePlus · 胆固醇检测",
        "url": "https://medlineplus.gov/lab-tests/cholesterol-levels/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "lipid.tg": {
    "categories": [
      "心血管与血脂"
    ],
    "what": "血液中的甘油三酯，是脂肪运输和能量储存的一种形式。",
    "meaning": "辅助了解血脂、血压和心血管相关风险，适合结合多次检查看变化。",
    "limits": "个人目标需结合整体风险、用药和医生评估，不能用单项数值直接判断是否患病。",
    "sources": [
      {
        "title": "MedlinePlus · 胆固醇检测",
        "url": "https://medlineplus.gov/lab-tests/cholesterol-levels/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "lipid.vldl": {
    "categories": [
      "心血管与血脂"
    ],
    "what": "极低密度脂蛋白携带的胆固醇；报告可能由其他指标计算。",
    "meaning": "辅助了解血脂、血压和心血管相关风险，适合结合多次检查看变化。",
    "limits": "计算公式、甘油三酯水平及空腹状态会影响可比性。",
    "sources": [
      {
        "title": "MedlinePlus · 胆固醇检测",
        "url": "https://medlineplus.gov/lab-tests/cholesterol-levels/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "lipid.atherosclerosis_index": {
    "categories": [
      "心血管与血脂"
    ],
    "what": "报告给出的血脂比值类计算指标。",
    "meaning": "辅助了解血脂、血压和心血管相关风险，适合结合多次检查看变化。",
    "limits": "不同机构计算公式可能不同；不是通用的心血管事件风险评分，应先核对公式。",
    "sources": [
      {
        "title": "MedlinePlus · 胆固醇检测",
        "url": "https://medlineplus.gov/lab-tests/cholesterol-levels/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "blood.homocysteine": {
    "categories": [
      "心血管与血脂",
      "铁代谢与营养"
    ],
    "what": "一种参与氨基酸代谢的物质，可受维生素状态、肾功能等影响。",
    "meaning": "辅助了解血脂、血压和心血管相关风险，适合结合多次检查看变化。",
    "limits": "升高原因多样，不能据此直接判断血管堵塞或自行补充维生素。",
    "sources": [
      {
        "title": "MedlinePlus · 同型半胱氨酸",
        "url": "https://medlineplus.gov/lab-tests/homocysteine-test/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "inflammation.hs_crp": {
    "categories": [
      "心血管与血脂",
      "感染与免疫"
    ],
    "what": "以高敏感度方法检测C反应蛋白，反映低水平炎症。",
    "meaning": "辅助了解血脂、血压和心血管相关风险，适合结合多次检查看变化。",
    "limits": "感染等也可升高；用于心血管风险评估时需考虑急性炎症，普通CRP与高敏CRP用途有差别。",
    "sources": [
      {
        "title": "MedlinePlus · C反应蛋白",
        "url": "https://medlineplus.gov/lab-tests/c-reactive-protein-crp-test/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "bp.systolic": {
    "categories": [
      "心血管与血脂"
    ],
    "what": "心脏收缩时动脉内的压力，即血压的高压。",
    "meaning": "辅助了解血脂、血压和心血管相关风险，适合结合多次检查看变化。",
    "limits": "单次体检血压不能直接诊断高血压；测量姿势、休息状态和重复测量很重要。",
    "sources": [
      {
        "title": "MedlinePlus · 生命体征",
        "url": "https://medlineplus.gov/ency/article/002341.htm"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "bp.diastolic": {
    "categories": [
      "心血管与血脂"
    ],
    "what": "心脏舒张时动脉内的压力，即血压的低压。",
    "meaning": "辅助了解血脂、血压和心血管相关风险，适合结合多次检查看变化。",
    "limits": "需与收缩压、重复测量及个人情况一起判断，不以单次读数定论。",
    "sources": [
      {
        "title": "MedlinePlus · 生命体征",
        "url": "https://medlineplus.gov/ency/article/002341.htm"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "glucose.fasting": {
    "categories": [
      "血糖与代谢"
    ],
    "what": "按空腹要求采血测得的葡萄糖浓度，用于血糖评估。",
    "meaning": "用于了解血糖调节及代谢状况，结合空腹状态和相关检测解读。",
    "limits": "应核对实际空腹情况；单次异常通常需要结合复查或其他检测。",
    "sources": [
      {
        "title": "MedlinePlus · 血糖",
        "url": "https://medlineplus.gov/lab-tests/blood-glucose-test/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "glucose.glucose_unspecified": {
    "categories": [
      "血糖与代谢"
    ],
    "what": "原报告未明确标注空腹条件的葡萄糖。",
    "meaning": "用于了解血糖调节及代谢状况，结合空腹状态和相关检测解读。",
    "limits": "不与空腹血糖直接混为同一曲线，先确认采血条件。",
    "sources": [
      {
        "title": "MedlinePlus · 血糖",
        "url": "https://medlineplus.gov/lab-tests/blood-glucose-test/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "glucose.hba1c.percent": {
    "categories": [
      "血糖与代谢"
    ],
    "what": "糖化血红蛋白的百分比结果，主要反映过去约2至3个月平均血糖情况。",
    "meaning": "用于了解血糖调节及代谢状况，结合空腹状态和相关检测解读。",
    "limits": "贫血、血红蛋白异常及红细胞寿命改变等可影响结果，不能替代所有即时血糖信息。",
    "sources": [
      {
        "title": "MedlinePlus · 糖化血红蛋白",
        "url": "https://medlineplus.gov/lab-tests/hemoglobin-a1c-hba1c-test/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "glucose.hba1c.ifcc": {
    "categories": [
      "血糖与代谢"
    ],
    "what": "以IFCC体系的mmol/mol报告糖化血红蛋白，与百分比形式表达相关信息。",
    "meaning": "用于了解血糖调节及代谢状况，结合空腹状态和相关检测解读。",
    "limits": "与百分比单位数值不同；核对换算体系后才比较，不当作两次独立检测。",
    "sources": [
      {
        "title": "MedlinePlus · 糖化血红蛋白",
        "url": "https://medlineplus.gov/lab-tests/hemoglobin-a1c-hba1c-test/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "liver.alt": {
    "categories": [
      "肝脏与胆道"
    ],
    "what": "主要与肝细胞相关的酶，升高可提示肝细胞受损线索。",
    "meaning": "与其他肝酶、胆红素及蛋白指标结合，帮助了解肝胆相关变化。",
    "limits": "数值异常的原因不唯一，肝酶高低不直接等于肝损伤严重程度。",
    "sources": [
      {
        "title": "MedlinePlus · 肝功能检测",
        "url": "https://medlineplus.gov/lab-tests/liver-function-tests/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "liver.ast": {
    "categories": [
      "肝脏与胆道"
    ],
    "what": "存在于肝脏、肌肉等组织的酶。",
    "meaning": "与其他肝酶、胆红素及蛋白指标结合，帮助了解肝胆相关变化。",
    "limits": "肌肉损伤等也可影响，不能仅凭AST判断肝脏疾病。",
    "sources": [
      {
        "title": "MedlinePlus · 肝功能检测",
        "url": "https://medlineplus.gov/lab-tests/liver-function-tests/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "liver.alp": {
    "categories": [
      "肝脏与胆道"
    ],
    "what": "来源包括胆道和骨组织的一种酶。",
    "meaning": "与其他肝酶、胆红素及蛋白指标结合，帮助了解肝胆相关变化。",
    "limits": "升高不一定来自肝脏，常结合GGT等判断来源。",
    "sources": [
      {
        "title": "MedlinePlus · 肝功能检测",
        "url": "https://medlineplus.gov/lab-tests/liver-function-tests/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "liver.ggt": {
    "categories": [
      "肝脏与胆道"
    ],
    "what": "与肝胆系统相关的酶，可辅助判断胆道或某些肝脏变化。",
    "meaning": "与其他肝酶、胆红素及蛋白指标结合，帮助了解肝胆相关变化。",
    "limits": "数值异常的原因不唯一，肝酶高低不直接等于肝损伤严重程度。",
    "sources": [
      {
        "title": "MedlinePlus · 肝功能检测",
        "url": "https://medlineplus.gov/lab-tests/liver-function-tests/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "liver.total_bilirubin": {
    "categories": [
      "肝脏与胆道"
    ],
    "what": "红细胞分解相关色素的总量，包含直接与间接胆红素。",
    "meaning": "与其他肝酶、胆红素及蛋白指标结合，帮助了解肝胆相关变化。",
    "limits": "数值异常的原因不唯一，肝酶高低不直接等于肝损伤严重程度。",
    "sources": [
      {
        "title": "MedlinePlus · 肝功能检测",
        "url": "https://medlineplus.gov/lab-tests/liver-function-tests/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "liver.direct_bilirubin": {
    "categories": [
      "肝脏与胆道"
    ],
    "what": "经过肝脏结合处理的胆红素部分。",
    "meaning": "与其他肝酶、胆红素及蛋白指标结合，帮助了解肝胆相关变化。",
    "limits": "数值异常的原因不唯一，肝酶高低不直接等于肝损伤严重程度。",
    "sources": [
      {
        "title": "MedlinePlus · 肝功能检测",
        "url": "https://medlineplus.gov/lab-tests/liver-function-tests/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "liver.indirect_bilirubin": {
    "categories": [
      "肝脏与胆道"
    ],
    "what": "主要尚未经肝脏结合处理的胆红素，报告中可能由差值计算。",
    "meaning": "与其他肝酶、胆红素及蛋白指标结合，帮助了解肝胆相关变化。",
    "limits": "数值异常的原因不唯一，肝酶高低不直接等于肝损伤严重程度。",
    "sources": [
      {
        "title": "MedlinePlus · 肝功能检测",
        "url": "https://medlineplus.gov/lab-tests/liver-function-tests/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "liver.total_protein": {
    "categories": [
      "肝脏与胆道"
    ],
    "what": "血液中白蛋白和球蛋白等蛋白的总量。",
    "meaning": "与其他肝酶、胆红素及蛋白指标结合，帮助了解肝胆相关变化。",
    "limits": "数值异常的原因不唯一，肝酶高低不直接等于肝损伤严重程度。",
    "sources": [
      {
        "title": "MedlinePlus · 肝功能检测",
        "url": "https://medlineplus.gov/lab-tests/liver-function-tests/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "liver.albumin": {
    "categories": [
      "肝脏与胆道"
    ],
    "what": "由肝脏合成的重要血浆蛋白，参与物质运输及维持渗透压。",
    "meaning": "与其他肝酶、胆红素及蛋白指标结合，帮助了解肝胆相关变化。",
    "limits": "受炎症、营养、肝脏合成和蛋白丢失等影响，低值不等于单纯营养不足。",
    "sources": [
      {
        "title": "MedlinePlus · 肝功能检测",
        "url": "https://medlineplus.gov/lab-tests/liver-function-tests/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "liver.globulin": {
    "categories": [
      "肝脏与胆道"
    ],
    "what": "多类血浆蛋白的合计，可能由总蛋白减去白蛋白计算。",
    "meaning": "与其他肝酶、胆红素及蛋白指标结合，帮助了解肝胆相关变化。",
    "limits": "数值异常的原因不唯一，肝酶高低不直接等于肝损伤严重程度。",
    "sources": [
      {
        "title": "MedlinePlus · 肝功能检测",
        "url": "https://medlineplus.gov/lab-tests/liver-function-tests/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "liver.ag_ratio": {
    "categories": [
      "肝脏与胆道"
    ],
    "what": "白蛋白与球蛋白的比值。",
    "meaning": "与其他肝酶、胆红素及蛋白指标结合，帮助了解肝胆相关变化。",
    "limits": "需同时查看两者实际数值，不能仅凭比值判断免疫或肝功能。",
    "sources": [
      {
        "title": "MedlinePlus · 肝功能检测",
        "url": "https://medlineplus.gov/lab-tests/liver-function-tests/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "liver.ast_alt_ratio": {
    "categories": [
      "肝脏与胆道"
    ],
    "what": "AST与ALT的比值，是辅助描述肝酶变化的计算参数。",
    "meaning": "与其他肝酶、胆红素及蛋白指标结合，帮助了解肝胆相关变化。",
    "limits": "不能单凭比值诊断饮酒相关肝病，需看两种酶的实际水平和病史。",
    "sources": [
      {
        "title": "AASLD · 肝酶与R值",
        "url": "https://www.aasld.org/liver-fellow-network/core-series/back-basics/how-approach-elevated-liver-enzymes"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "liver.injury_r": {
    "categories": [
      "肝脏与胆道"
    ],
    "what": "用ALT及ALP相对各自参考上限的倍数计算，辅助描述肝损伤模式。",
    "meaning": "与其他肝酶、胆红素及蛋白指标结合，帮助了解肝胆相关变化。",
    "limits": "主要用于已有肝酶异常的临床评估；低R值本身不等于胆汁淤积，也不是通用肝健康分。",
    "sources": [
      {
        "title": "AASLD · 肝酶与R值",
        "url": "https://www.aasld.org/liver-fellow-network/core-series/back-basics/how-approach-elevated-liver-enzymes"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "renal.creatinine": {
    "categories": [
      "肾脏与尿检"
    ],
    "what": "肌肉代谢产生并经肾脏清除的物质，可用于估算肾脏滤过功能。",
    "meaning": "帮助了解肾脏滤过、尿路或尿液成分，血检与尿检分别解读。",
    "limits": "受肌肉量、饮食和药物等影响，不能仅凭肌酐诊断肾病。",
    "sources": [
      {
        "title": "MedlinePlus · 肌酐",
        "url": "https://medlineplus.gov/lab-tests/creatinine-test/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "urine.creatinine.random": {
    "categories": [
      "肾脏与尿检"
    ],
    "what": "随机尿样中的肌酐，常用于校正其他尿中物质的浓度。",
    "meaning": "帮助了解肾脏滤过、尿路或尿液成分，血检与尿检分别解读。",
    "limits": "与血肌酐不是同一指标；尿液浓缩程度会影响数值。",
    "sources": [
      {
        "title": "MedlinePlus · 肌酐",
        "url": "https://medlineplus.gov/lab-tests/creatinine-test/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "renal.egfr.ckd_epi": {
    "categories": [
      "肾脏与尿检"
    ],
    "what": "采用CKD-EPI公式等信息估算的肾小球滤过率。",
    "meaning": "帮助了解肾脏滤过、尿路或尿液成分，血检与尿检分别解读。",
    "limits": "属于估计值；公式、年龄和肌酐方法影响可比性，单次结果不能单独诊断慢性肾病。",
    "sources": [
      {
        "title": "MedlinePlus · 肾小球滤过率",
        "url": "https://medlineplus.gov/lab-tests/estimated-glomerular-filtration-rate-egfr-and-gfr-tests/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "renal.bun": {
    "categories": [
      "肾脏与尿检"
    ],
    "what": "尿素中氮的浓度，是蛋白代谢与排泄相关指标。",
    "meaning": "帮助了解肾脏滤过、尿路或尿液成分，血检与尿检分别解读。",
    "limits": "与尿素并非相同数值口径，不能只因英文缩写相似直接合并；饮食与水分也会影响。",
    "sources": [
      {
        "title": "MedlinePlus · 尿素氮",
        "url": "https://medlineplus.gov/lab-tests/bun-blood-urea-nitrogen/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "renal.urea": {
    "categories": [
      "肾脏与尿检"
    ],
    "what": "蛋白代谢产生并主要经肾脏排泄的尿素。",
    "meaning": "帮助了解肾脏滤过、尿路或尿液成分，血检与尿检分别解读。",
    "limits": "尿素和尿素氮需按各自定义与单位解读，不能原数值直接互换。",
    "sources": [
      {
        "title": "MedlinePlus · 尿素氮",
        "url": "https://medlineplus.gov/lab-tests/bun-blood-urea-nitrogen/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "renal.uric_acid": {
    "categories": [
      "血糖与代谢",
      "肾脏与尿检"
    ],
    "what": "嘌呤代谢形成的尿酸，常用于高尿酸、痛风相关评估。",
    "meaning": "用于了解血糖调节及代谢状况，结合空腹状态和相关检测解读。",
    "limits": "单次升高不等于痛风，数值正常也不能独立排除一次痛风发作。",
    "sources": [
      {
        "title": "MedlinePlus · 尿酸",
        "url": "https://medlineplus.gov/lab-tests/uric-acid-test/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "urine.acr": {
    "categories": [
      "肾脏与尿检"
    ],
    "what": "尿白蛋白与尿肌酐的比值，降低尿液稀释程度对判断的影响。",
    "meaning": "帮助了解肾脏滤过、尿路或尿液成分，血检与尿检分别解读。",
    "limits": "运动、感染等可造成暂时变化，通常需结合重复检测及血压、肾功能。",
    "sources": [
      {
        "title": "MedlinePlus · 尿白蛋白肌酐比",
        "url": "https://medlineplus.gov/lab-tests/microalbumin-creatinine-ratio/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "urine.albumin.random": {
    "categories": [
      "肾脏与尿检"
    ],
    "what": "随机尿液中的白蛋白浓度，反映尿中白蛋白排出线索。",
    "meaning": "帮助了解肾脏滤过、尿路或尿液成分，血检与尿检分别解读。",
    "limits": "浓度受饮水影响；与尿白蛋白肌酐比不是同一结果口径。",
    "sources": [
      {
        "title": "MedlinePlus · 尿白蛋白肌酐比",
        "url": "https://medlineplus.gov/lab-tests/microalbumin-creatinine-ratio/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "urine.color": {
    "categories": [
      "肾脏与尿检"
    ],
    "what": "描述尿液颜色，是尿常规的外观信息。",
    "meaning": "帮助了解肾脏滤过、尿路或尿液成分，血检与尿检分别解读。",
    "limits": "饮食、药物及水分都会影响，颜色本身不能确定病因。",
    "sources": [
      {
        "title": "MedlinePlus · 尿液分析",
        "url": "https://medlineplus.gov/ency/article/003579.htm"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "urine.turbidity": {
    "categories": [
      "肾脏与尿检"
    ],
    "what": "描述尿液清澈或浑浊程度。",
    "meaning": "帮助了解肾脏滤过、尿路或尿液成分，血检与尿检分别解读。",
    "limits": "细胞、结晶和采样条件均可影响，浑浊不直接等于感染。",
    "sources": [
      {
        "title": "MedlinePlus · 尿液分析",
        "url": "https://medlineplus.gov/ency/article/003579.htm"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "urine.specific_gravity": {
    "categories": [
      "肾脏与尿检"
    ],
    "what": "描述尿液相对水的密度，反映浓缩程度的线索。",
    "meaning": "帮助了解肾脏滤过、尿路或尿液成分，血检与尿检分别解读。",
    "limits": "饮水、运动、标本采集和检验方法会影响结果，单次异常不能独立诊断肾病或感染。",
    "sources": [
      {
        "title": "MedlinePlus · 尿液分析",
        "url": "https://medlineplus.gov/ency/article/003579.htm"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "urine.ph": {
    "categories": [
      "肾脏与尿检"
    ],
    "what": "尿液酸碱度，不等同于血液酸碱度。",
    "meaning": "帮助了解肾脏滤过、尿路或尿液成分，血检与尿检分别解读。",
    "limits": "饮水、运动、标本采集和检验方法会影响结果，单次异常不能独立诊断肾病或感染。",
    "sources": [
      {
        "title": "MedlinePlus · 尿液分析",
        "url": "https://medlineplus.gov/ency/article/003579.htm"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "urine.protein": {
    "categories": [
      "肾脏与尿检"
    ],
    "what": "尿中蛋白的定性或半定量检测。",
    "meaning": "帮助了解肾脏滤过、尿路或尿液成分，血检与尿检分别解读。",
    "limits": "饮水、运动、标本采集和检验方法会影响结果，单次异常不能独立诊断肾病或感染。",
    "sources": [
      {
        "title": "MedlinePlus · 尿液分析",
        "url": "https://medlineplus.gov/ency/article/003579.htm"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "urine.glucose": {
    "categories": [
      "肾脏与尿检"
    ],
    "what": "尿中葡萄糖的检测。",
    "meaning": "帮助了解肾脏滤过、尿路或尿液成分，血检与尿检分别解读。",
    "limits": "与血糖不是同一指标，阴性不能单独排除血糖问题。",
    "sources": [
      {
        "title": "MedlinePlus · 尿液分析",
        "url": "https://medlineplus.gov/ency/article/003579.htm"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "urine.ketone": {
    "categories": [
      "肾脏与尿检"
    ],
    "what": "尿中酮体的检测。",
    "meaning": "帮助了解肾脏滤过、尿路或尿液成分，血检与尿检分别解读。",
    "limits": "可受禁食等影响；是否有临床危险需结合血糖、症状和其他检查。",
    "sources": [
      {
        "title": "MedlinePlus · 尿液分析",
        "url": "https://medlineplus.gov/ency/article/003579.htm"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "urine.bilirubin": {
    "categories": [
      "肾脏与尿检"
    ],
    "what": "尿中胆红素的检测，可提供肝胆相关线索。",
    "meaning": "帮助了解肾脏滤过、尿路或尿液成分，血检与尿检分别解读。",
    "limits": "饮水、运动、标本采集和检验方法会影响结果，单次异常不能独立诊断肾病或感染。",
    "sources": [
      {
        "title": "MedlinePlus · 尿液分析",
        "url": "https://medlineplus.gov/ency/article/003579.htm"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "urine.urobilinogen": {
    "categories": [
      "肾脏与尿检"
    ],
    "what": "胆红素代谢后在尿中检测的一类产物。",
    "meaning": "帮助了解肾脏滤过、尿路或尿液成分，血检与尿检分别解读。",
    "limits": "饮水、运动、标本采集和检验方法会影响结果，单次异常不能独立诊断肾病或感染。",
    "sources": [
      {
        "title": "MedlinePlus · 尿液分析",
        "url": "https://medlineplus.gov/ency/article/003579.htm"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "urine.occult_blood": {
    "categories": [
      "肾脏与尿检"
    ],
    "what": "检测尿液中的血红素反应，属于血尿筛查线索。",
    "meaning": "帮助了解肾脏滤过、尿路或尿液成分，血检与尿检分别解读。",
    "limits": "不直接等于尿红细胞计数，应结合镜检和采样情况。",
    "sources": [
      {
        "title": "MedlinePlus · 尿液分析",
        "url": "https://medlineplus.gov/ency/article/003579.htm"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "urine.leukocyte_esterase": {
    "categories": [
      "肾脏与尿检"
    ],
    "what": "尿试纸检测白细胞相关酶的反应。",
    "meaning": "帮助了解肾脏滤过、尿路或尿液成分，血检与尿检分别解读。",
    "limits": "阳性并不能独立诊断尿路感染，需结合尿白细胞、症状等。",
    "sources": [
      {
        "title": "MedlinePlus · 尿液分析",
        "url": "https://medlineplus.gov/ency/article/003579.htm"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "urine.leukocyte": {
    "categories": [
      "肾脏与尿检"
    ],
    "what": "尿白细胞的定性检测，记录阴性或阳性等结果。",
    "meaning": "帮助了解肾脏滤过、尿路或尿液成分，血检与尿检分别解读。",
    "limits": "饮水、运动、标本采集和检验方法会影响结果，单次异常不能独立诊断肾病或感染。",
    "sources": [
      {
        "title": "MedlinePlus · 尿液分析",
        "url": "https://medlineplus.gov/ency/article/003579.htm"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "urine.nitrite": {
    "categories": [
      "肾脏与尿检"
    ],
    "what": "检测部分细菌代谢产生的亚硝酸盐。",
    "meaning": "帮助了解肾脏滤过、尿路或尿液成分，血检与尿检分别解读。",
    "limits": "阴性不能排除尿路感染，不是所有细菌都会产生阳性结果。",
    "sources": [
      {
        "title": "MedlinePlus · 尿液分析",
        "url": "https://medlineplus.gov/ency/article/003579.htm"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "urine.wbc": {
    "categories": [
      "肾脏与尿检"
    ],
    "what": "尿液中白细胞的数量。",
    "meaning": "帮助了解肾脏滤过、尿路或尿液成分，血检与尿检分别解读。",
    "limits": "与血液白细胞计数分开，不直接相加或比较同一参考范围。",
    "sources": [
      {
        "title": "MedlinePlus · 尿液分析",
        "url": "https://medlineplus.gov/ency/article/003579.htm"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "urine.rbc": {
    "categories": [
      "肾脏与尿检"
    ],
    "what": "尿液中红细胞的数量。",
    "meaning": "帮助了解肾脏滤过、尿路或尿液成分，血检与尿检分别解读。",
    "limits": "与血液红细胞计数分开解读。",
    "sources": [
      {
        "title": "MedlinePlus · 尿液分析",
        "url": "https://medlineplus.gov/ency/article/003579.htm"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "urine.wbc_microscopy": {
    "categories": [
      "肾脏与尿检"
    ],
    "what": "显微镜视野下观察到的尿白细胞数量或范围。",
    "meaning": "帮助了解肾脏滤过、尿路或尿液成分，血检与尿检分别解读。",
    "limits": "饮水、运动、标本采集和检验方法会影响结果，单次异常不能独立诊断肾病或感染。",
    "sources": [
      {
        "title": "MedlinePlus · 尿液分析",
        "url": "https://medlineplus.gov/ency/article/003579.htm"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "urine.rbc_microscopy": {
    "categories": [
      "肾脏与尿检"
    ],
    "what": "显微镜视野下观察到的尿红细胞数量或范围。",
    "meaning": "帮助了解肾脏滤过、尿路或尿液成分，血检与尿检分别解读。",
    "limits": "饮水、运动、标本采集和检验方法会影响结果，单次异常不能独立诊断肾病或感染。",
    "sources": [
      {
        "title": "MedlinePlus · 尿液分析",
        "url": "https://medlineplus.gov/ency/article/003579.htm"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "urine.epithelial": {
    "categories": [
      "肾脏与尿检"
    ],
    "what": "尿液中的鳞状上皮细胞计数。",
    "meaning": "帮助了解肾脏滤过、尿路或尿液成分，血检与尿检分别解读。",
    "limits": "数量增多可能与采集污染等有关，需结合其他项目。",
    "sources": [
      {
        "title": "MedlinePlus · 尿液分析",
        "url": "https://medlineplus.gov/ency/article/003579.htm"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "urine.non_epithelial": {
    "categories": [
      "肾脏与尿检"
    ],
    "what": "尿液中非鳞状上皮细胞的分类计数。",
    "meaning": "帮助了解肾脏滤过、尿路或尿液成分，血检与尿检分别解读。",
    "limits": "具体来源与方法有关，不能据总数独立判断肾损伤。",
    "sources": [
      {
        "title": "MedlinePlus · 尿液分析",
        "url": "https://medlineplus.gov/ency/article/003579.htm"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "urine.epithelial_microscopy": {
    "categories": [
      "肾脏与尿检"
    ],
    "what": "显微镜下观察到的尿上皮细胞，需结合具体类型。",
    "meaning": "帮助了解肾脏滤过、尿路或尿液成分，血检与尿检分别解读。",
    "limits": "饮水、运动、标本采集和检验方法会影响结果，单次异常不能独立诊断肾病或感染。",
    "sources": [
      {
        "title": "MedlinePlus · 尿液分析",
        "url": "https://medlineplus.gov/ency/article/003579.htm"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "urine.cast": {
    "categories": [
      "肾脏与尿检"
    ],
    "what": "尿液中的管型，是在肾小管内形成的结构。",
    "meaning": "帮助了解肾脏滤过、尿路或尿液成分，血检与尿检分别解读。",
    "limits": "饮水、运动、标本采集和检验方法会影响结果，单次异常不能独立诊断肾病或感染。",
    "sources": [
      {
        "title": "MedlinePlus · 尿液分析",
        "url": "https://medlineplus.gov/ency/article/003579.htm"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "urine.casts_microscopy": {
    "categories": [
      "肾脏与尿检"
    ],
    "what": "显微镜下观察到的管型计数。",
    "meaning": "帮助了解肾脏滤过、尿路或尿液成分，血检与尿检分别解读。",
    "limits": "饮水、运动、标本采集和检验方法会影响结果，单次异常不能独立诊断肾病或感染。",
    "sources": [
      {
        "title": "MedlinePlus · 尿液分析",
        "url": "https://medlineplus.gov/ency/article/003579.htm"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "urine.hyaline_cast": {
    "categories": [
      "肾脏与尿检"
    ],
    "what": "尿液中透明管型的数量。",
    "meaning": "帮助了解肾脏滤过、尿路或尿液成分，血检与尿检分别解读。",
    "limits": "需结合数量、其他管型和肾功能，单独出现未必表示疾病。",
    "sources": [
      {
        "title": "MedlinePlus · 尿液分析",
        "url": "https://medlineplus.gov/ency/article/003579.htm"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "urine.pathocast": {
    "categories": [
      "肾脏与尿检"
    ],
    "what": "仪器或检验报告归为病理管型的计数。",
    "meaning": "帮助了解肾脏滤过、尿路或尿液成分，血检与尿检分别解读。",
    "limits": "需要核对具体管型及镜检，不能仅凭这个汇总名称定诊断。",
    "sources": [
      {
        "title": "MedlinePlus · 尿液分析",
        "url": "https://medlineplus.gov/ency/article/003579.htm"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "urine.crystals": {
    "categories": [
      "肾脏与尿检"
    ],
    "what": "尿液中结晶的观察或计数。",
    "meaning": "帮助了解肾脏滤过、尿路或尿液成分，血检与尿检分别解读。",
    "limits": "结晶种类和尿液条件重要，出现结晶不等于已患结石。",
    "sources": [
      {
        "title": "MedlinePlus · 尿液分析",
        "url": "https://medlineplus.gov/ency/article/003579.htm"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "urine.mucus": {
    "categories": [
      "肾脏与尿检"
    ],
    "what": "尿液中黏液丝的描述，属于显微镜或仪器观察信息。",
    "meaning": "帮助了解肾脏滤过、尿路或尿液成分，血检与尿检分别解读。",
    "limits": "饮水、运动、标本采集和检验方法会影响结果，单次异常不能独立诊断肾病或感染。",
    "sources": [
      {
        "title": "MedlinePlus · 尿液分析",
        "url": "https://medlineplus.gov/ency/article/003579.htm"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "cbc.wbc": {
    "categories": [
      "血常规"
    ],
    "what": "血液中白细胞的总数量，反映免疫细胞数量变化。",
    "meaning": "用于描述血细胞数量、比例或形态参数，辅助评估造血、贫血与免疫相关情况。",
    "limits": "需要与血常规其他项目及症状结合，单项异常不能确定病因。",
    "sources": [
      {
        "title": "MedlinePlus · 血常规",
        "url": "https://medlineplus.gov/lab-tests/complete-blood-count-cbc/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "cbc.rbc": {
    "categories": [
      "血常规"
    ],
    "what": "血液中红细胞数量，红细胞主要负责运输氧。",
    "meaning": "用于描述血细胞数量、比例或形态参数，辅助评估造血、贫血与免疫相关情况。",
    "limits": "需要与血常规其他项目及症状结合，单项异常不能确定病因。",
    "sources": [
      {
        "title": "MedlinePlus · 血常规",
        "url": "https://medlineplus.gov/lab-tests/complete-blood-count-cbc/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "cbc.hgb": {
    "categories": [
      "血常规"
    ],
    "what": "红细胞内携氧蛋白的浓度，是贫血评估的重要参数。",
    "meaning": "用于描述血细胞数量、比例或形态参数，辅助评估造血、贫血与免疫相关情况。",
    "limits": "需要与血常规其他项目及症状结合，单项异常不能确定病因。",
    "sources": [
      {
        "title": "MedlinePlus · 血常规",
        "url": "https://medlineplus.gov/lab-tests/complete-blood-count-cbc/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "cbc.hct": {
    "categories": [
      "血常规"
    ],
    "what": "红细胞占全血体积的比例。",
    "meaning": "用于描述血细胞数量、比例或形态参数，辅助评估造血、贫血与免疫相关情况。",
    "limits": "百分比与L/L两种表达应先核对换算，不能直接按数值大小比较。",
    "sources": [
      {
        "title": "MedlinePlus · 血常规",
        "url": "https://medlineplus.gov/lab-tests/complete-blood-count-cbc/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "cbc.plt": {
    "categories": [
      "血常规"
    ],
    "what": "血液中血小板的数量，参与止血。",
    "meaning": "用于描述血细胞数量、比例或形态参数，辅助评估造血、贫血与免疫相关情况。",
    "limits": "数量不代表全部血小板功能，不能单独判断是否会出血或血栓。",
    "sources": [
      {
        "title": "MedlinePlus · 血常规",
        "url": "https://medlineplus.gov/lab-tests/complete-blood-count-cbc/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "cbc.mcv": {
    "categories": [
      "血常规"
    ],
    "what": "平均一个红细胞的体积，可辅助区分贫血类型。",
    "meaning": "用于描述血细胞数量、比例或形态参数，辅助评估造血、贫血与免疫相关情况。",
    "limits": "需要与血常规其他项目及症状结合，单项异常不能确定病因。",
    "sources": [
      {
        "title": "MedlinePlus · 红细胞指数",
        "url": "https://medlineplus.gov/lab-tests/red-blood-cell-rbc-indices/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "cbc.mch": {
    "categories": [
      "血常规"
    ],
    "what": "平均每个红细胞携带的血红蛋白量。",
    "meaning": "用于描述血细胞数量、比例或形态参数，辅助评估造血、贫血与免疫相关情况。",
    "limits": "需要与血常规其他项目及症状结合，单项异常不能确定病因。",
    "sources": [
      {
        "title": "MedlinePlus · 红细胞指数",
        "url": "https://medlineplus.gov/lab-tests/red-blood-cell-rbc-indices/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "cbc.mchc": {
    "categories": [
      "血常规"
    ],
    "what": "红细胞内血红蛋白的平均浓度。",
    "meaning": "用于描述血细胞数量、比例或形态参数，辅助评估造血、贫血与免疫相关情况。",
    "limits": "需要与血常规其他项目及症状结合，单项异常不能确定病因。",
    "sources": [
      {
        "title": "MedlinePlus · 红细胞指数",
        "url": "https://medlineplus.gov/lab-tests/red-blood-cell-rbc-indices/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "cbc.rdw_cv": {
    "categories": [
      "血常规"
    ],
    "what": "红细胞大小差异的相对变异程度。",
    "meaning": "用于描述血细胞数量、比例或形态参数，辅助评估造血、贫血与免疫相关情况。",
    "limits": "需要与血常规其他项目及症状结合，单项异常不能确定病因。",
    "sources": [
      {
        "title": "MedlinePlus · 红细胞指数",
        "url": "https://medlineplus.gov/lab-tests/red-blood-cell-rbc-indices/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "cbc.rdw_sd": {
    "categories": [
      "血常规"
    ],
    "what": "红细胞体积分布宽度的绝对尺度。",
    "meaning": "用于描述血细胞数量、比例或形态参数，辅助评估造血、贫血与免疫相关情况。",
    "limits": "与RDW-CV定义和单位不同，需分开比较。",
    "sources": [
      {
        "title": "MedlinePlus · 红细胞指数",
        "url": "https://medlineplus.gov/lab-tests/red-blood-cell-rbc-indices/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "cbc.neut.absolute": {
    "categories": [
      "血常规"
    ],
    "what": "中性粒细胞的绝对数量；这类细胞参与抵御病原体和炎症反应。",
    "meaning": "用于描述血细胞数量、比例或形态参数，辅助评估造血、贫血与免疫相关情况。",
    "limits": "比例与绝对数量不能互换；数值变化并不直接确定感染类型或过敏原因。",
    "sources": [
      {
        "title": "MedlinePlus · 白细胞分类",
        "url": "https://medlineplus.gov/lab-tests/blood-differential/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "cbc.neut.percent": {
    "categories": [
      "血常规"
    ],
    "what": "中性粒细胞的占白细胞的比例；这类细胞参与抵御病原体和炎症反应。",
    "meaning": "用于描述血细胞数量、比例或形态参数，辅助评估造血、贫血与免疫相关情况。",
    "limits": "比例与绝对数量不能互换；数值变化并不直接确定感染类型或过敏原因。",
    "sources": [
      {
        "title": "MedlinePlus · 白细胞分类",
        "url": "https://medlineplus.gov/lab-tests/blood-differential/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "cbc.lymph.absolute": {
    "categories": [
      "血常规"
    ],
    "what": "淋巴细胞的绝对数量；这类细胞参与适应性等免疫反应。",
    "meaning": "用于描述血细胞数量、比例或形态参数，辅助评估造血、贫血与免疫相关情况。",
    "limits": "比例与绝对数量不能互换；数值变化并不直接确定感染类型或过敏原因。",
    "sources": [
      {
        "title": "MedlinePlus · 白细胞分类",
        "url": "https://medlineplus.gov/lab-tests/blood-differential/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "cbc.lymph.percent": {
    "categories": [
      "血常规"
    ],
    "what": "淋巴细胞的占白细胞的比例；这类细胞参与适应性等免疫反应。",
    "meaning": "用于描述血细胞数量、比例或形态参数，辅助评估造血、贫血与免疫相关情况。",
    "limits": "比例与绝对数量不能互换；数值变化并不直接确定感染类型或过敏原因。",
    "sources": [
      {
        "title": "MedlinePlus · 白细胞分类",
        "url": "https://medlineplus.gov/lab-tests/blood-differential/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "cbc.mono.absolute": {
    "categories": [
      "血常规"
    ],
    "what": "单核细胞的绝对数量；这类细胞参与吞噬和免疫反应。",
    "meaning": "用于描述血细胞数量、比例或形态参数，辅助评估造血、贫血与免疫相关情况。",
    "limits": "比例与绝对数量不能互换；数值变化并不直接确定感染类型或过敏原因。",
    "sources": [
      {
        "title": "MedlinePlus · 白细胞分类",
        "url": "https://medlineplus.gov/lab-tests/blood-differential/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "cbc.mono.percent": {
    "categories": [
      "血常规"
    ],
    "what": "单核细胞的占白细胞的比例；这类细胞参与吞噬和免疫反应。",
    "meaning": "用于描述血细胞数量、比例或形态参数，辅助评估造血、贫血与免疫相关情况。",
    "limits": "比例与绝对数量不能互换；数值变化并不直接确定感染类型或过敏原因。",
    "sources": [
      {
        "title": "MedlinePlus · 白细胞分类",
        "url": "https://medlineplus.gov/lab-tests/blood-differential/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "cbc.eo.absolute": {
    "categories": [
      "血常规"
    ],
    "what": "嗜酸性粒细胞的绝对数量；这类细胞与过敏反应、寄生虫等免疫过程有关。",
    "meaning": "用于描述血细胞数量、比例或形态参数，辅助评估造血、贫血与免疫相关情况。",
    "limits": "比例与绝对数量不能互换；数值变化并不直接确定感染类型或过敏原因。",
    "sources": [
      {
        "title": "MedlinePlus · 白细胞分类",
        "url": "https://medlineplus.gov/lab-tests/blood-differential/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "cbc.eo.percent": {
    "categories": [
      "血常规"
    ],
    "what": "嗜酸性粒细胞的占白细胞的比例；这类细胞与过敏反应、寄生虫等免疫过程有关。",
    "meaning": "用于描述血细胞数量、比例或形态参数，辅助评估造血、贫血与免疫相关情况。",
    "limits": "比例与绝对数量不能互换；数值变化并不直接确定感染类型或过敏原因。",
    "sources": [
      {
        "title": "MedlinePlus · 白细胞分类",
        "url": "https://medlineplus.gov/lab-tests/blood-differential/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "cbc.baso.absolute": {
    "categories": [
      "血常规"
    ],
    "what": "嗜碱性粒细胞的绝对数量；这类细胞参与过敏及炎症相关过程。",
    "meaning": "用于描述血细胞数量、比例或形态参数，辅助评估造血、贫血与免疫相关情况。",
    "limits": "比例与绝对数量不能互换；数值变化并不直接确定感染类型或过敏原因。",
    "sources": [
      {
        "title": "MedlinePlus · 白细胞分类",
        "url": "https://medlineplus.gov/lab-tests/blood-differential/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "cbc.baso.percent": {
    "categories": [
      "血常规"
    ],
    "what": "嗜碱性粒细胞的占白细胞的比例；这类细胞参与过敏及炎症相关过程。",
    "meaning": "用于描述血细胞数量、比例或形态参数，辅助评估造血、贫血与免疫相关情况。",
    "limits": "比例与绝对数量不能互换；数值变化并不直接确定感染类型或过敏原因。",
    "sources": [
      {
        "title": "MedlinePlus · 白细胞分类",
        "url": "https://medlineplus.gov/lab-tests/blood-differential/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "cbc.mpv": {
    "categories": [
      "血常规"
    ],
    "what": "血小板平均体积，描述血小板大小。",
    "meaning": "用于描述血细胞数量、比例或形态参数，辅助评估造血、贫血与免疫相关情况。",
    "limits": "需要与血常规其他项目及症状结合，单项异常不能确定病因。",
    "sources": [
      {
        "title": "HORIBA · 血小板体积参数",
        "url": "https://www.horiba.com/vnm/healthcare/academy/yumizen-bio/large-platelet-fraction/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "cbc.pdw": {
    "categories": [
      "血常规"
    ],
    "what": "血小板体积分布宽度，描述大小差异。",
    "meaning": "用于描述血细胞数量、比例或形态参数，辅助评估造血、贫血与免疫相关情况。",
    "limits": "需要与血常规其他项目及症状结合，单项异常不能确定病因。",
    "sources": [
      {
        "title": "HORIBA · 血小板体积参数",
        "url": "https://www.horiba.com/vnm/healthcare/academy/yumizen-bio/large-platelet-fraction/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "cbc.p_lcr": {
    "categories": [
      "血常规"
    ],
    "what": "按仪器标准归为较大血小板的比例。",
    "meaning": "用于描述血细胞数量、比例或形态参数，辅助评估造血、贫血与免疫相关情况。",
    "limits": "需要与血常规其他项目及症状结合，单项异常不能确定病因。",
    "sources": [
      {
        "title": "HORIBA · 血小板体积参数",
        "url": "https://www.horiba.com/vnm/healthcare/academy/yumizen-bio/large-platelet-fraction/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "cbc.pct": {
    "categories": [
      "血常规"
    ],
    "what": "血小板占全血体积的比例，即血小板压积。",
    "meaning": "用于描述血细胞数量、比例或形态参数，辅助评估造血、贫血与免疫相关情况。",
    "limits": "此处PCT是plateletcrit，不是感染检验中的降钙素原；两者不能混用。",
    "sources": [
      {
        "title": "HORIBA · 血小板体积参数",
        "url": "https://www.horiba.com/vnm/healthcare/academy/yumizen-bio/large-platelet-fraction/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "coag.pt": {
    "categories": [
      "凝血功能"
    ],
    "what": "凝血酶原时间，测量特定条件下血浆凝固所需时间。",
    "meaning": "用于了解凝血过程，部分检测也用于特定抗凝药物的监测。",
    "limits": "不同抗凝药影响不同检测，不能自行据此调整药量。",
    "sources": [
      {
        "title": "MedlinePlus · 凝血时间",
        "url": "https://medlineplus.gov/lab-tests/partial-thromboplastin-time-ptt-test/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "coag.inr": {
    "categories": [
      "凝血功能"
    ],
    "what": "对凝血酶原时间进行标准化后的比值。",
    "meaning": "用于了解凝血过程，部分检测也用于特定抗凝药物的监测。",
    "limits": "常用于华法林等特定情境；不适用于监测所有抗凝药。",
    "sources": [
      {
        "title": "MedlinePlus · 凝血时间",
        "url": "https://medlineplus.gov/lab-tests/partial-thromboplastin-time-ptt-test/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "coag.aptt": {
    "categories": [
      "凝血功能"
    ],
    "what": "活化部分凝血活酶时间，检测凝血过程的另一部分。",
    "meaning": "用于了解凝血过程，部分检测也用于特定抗凝药物的监测。",
    "limits": "不同抗凝药影响不同检测，不能自行据此调整药量。",
    "sources": [
      {
        "title": "MedlinePlus · 凝血时间",
        "url": "https://medlineplus.gov/lab-tests/partial-thromboplastin-time-ptt-test/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "thyroid.tsh": {
    "categories": [
      "甲状腺"
    ],
    "what": "垂体产生的促甲状腺激素，参与调节甲状腺激素分泌。",
    "meaning": "结合TSH、甲状腺激素及抗体，辅助评估甲状腺功能或自身免疫情况。",
    "limits": "药物、疾病状态和生物素等可能干扰结果，需要看整组检测。",
    "sources": [
      {
        "title": "NIDDK · 甲状腺检查",
        "url": "https://www.niddk.nih.gov/health-information/diagnostic-tests/thyroid"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "thyroid.t3": {
    "categories": [
      "甲状腺"
    ],
    "what": "血液中总三碘甲状腺原氨酸，包含结合及游离形式。",
    "meaning": "结合TSH、甲状腺激素及抗体，辅助评估甲状腺功能或自身免疫情况。",
    "limits": "药物、疾病状态和生物素等可能干扰结果，需要看整组检测。",
    "sources": [
      {
        "title": "NIDDK · 甲状腺检查",
        "url": "https://www.niddk.nih.gov/health-information/diagnostic-tests/thyroid"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "thyroid.ft3": {
    "categories": [
      "甲状腺"
    ],
    "what": "未与血液蛋白结合的游离T3。",
    "meaning": "结合TSH、甲状腺激素及抗体，辅助评估甲状腺功能或自身免疫情况。",
    "limits": "药物、疾病状态和生物素等可能干扰结果，需要看整组检测。",
    "sources": [
      {
        "title": "NIDDK · 甲状腺检查",
        "url": "https://www.niddk.nih.gov/health-information/diagnostic-tests/thyroid"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "thyroid.t4": {
    "categories": [
      "甲状腺"
    ],
    "what": "血液中总甲状腺素，包含结合及游离形式。",
    "meaning": "结合TSH、甲状腺激素及抗体，辅助评估甲状腺功能或自身免疫情况。",
    "limits": "药物、疾病状态和生物素等可能干扰结果，需要看整组检测。",
    "sources": [
      {
        "title": "NIDDK · 甲状腺检查",
        "url": "https://www.niddk.nih.gov/health-information/diagnostic-tests/thyroid"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "thyroid.ft4": {
    "categories": [
      "甲状腺"
    ],
    "what": "未与血液蛋白结合的游离T4。",
    "meaning": "结合TSH、甲状腺激素及抗体，辅助评估甲状腺功能或自身免疫情况。",
    "limits": "药物、疾病状态和生物素等可能干扰结果，需要看整组检测。",
    "sources": [
      {
        "title": "NIDDK · 甲状腺检查",
        "url": "https://www.niddk.nih.gov/health-information/diagnostic-tests/thyroid"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "thyroid.tpo_ab": {
    "categories": [
      "甲状腺"
    ],
    "what": "针对甲状腺过氧化物酶的抗体，提供自身免疫相关线索。",
    "meaning": "结合TSH、甲状腺激素及抗体，辅助评估甲状腺功能或自身免疫情况。",
    "limits": "阳性不直接等于甲状腺功能异常，也不能据此单独决定治疗。",
    "sources": [
      {
        "title": "NIDDK · 甲状腺检查",
        "url": "https://www.niddk.nih.gov/health-information/diagnostic-tests/thyroid"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "iron.serum": {
    "categories": [
      "铁代谢与营养"
    ],
    "what": "血液中循环铁的浓度，受时间及近期摄入等影响。",
    "meaning": "组合查看铁的运输、储存和可利用情况，辅助评估铁代谢问题。",
    "limits": "炎症、肝病和近期饮食等可影响结果，不能仅凭单项决定补铁。",
    "sources": [
      {
        "title": "MedlinePlus · 铁代谢",
        "url": "https://medlineplus.gov/lab-tests/iron-tests/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "iron.ferritin": {
    "categories": [
      "铁代谢与营养"
    ],
    "what": "与铁储存相关的蛋白，常用于了解铁储备。",
    "meaning": "组合查看铁的运输、储存和可利用情况，辅助评估铁代谢问题。",
    "limits": "炎症和肝脏情况等可使其升高，不能把所有高值都解释为铁过多。",
    "sources": [
      {
        "title": "MedlinePlus · 铁代谢",
        "url": "https://medlineplus.gov/lab-tests/iron-tests/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "iron.transferrin": {
    "categories": [
      "铁代谢与营养"
    ],
    "what": "运输铁的主要血浆蛋白。",
    "meaning": "组合查看铁的运输、储存和可利用情况，辅助评估铁代谢问题。",
    "limits": "炎症、肝病和近期饮食等可影响结果，不能仅凭单项决定补铁。",
    "sources": [
      {
        "title": "MedlinePlus · 铁代谢",
        "url": "https://medlineplus.gov/lab-tests/iron-tests/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "iron.tibc": {
    "categories": [
      "铁代谢与营养"
    ],
    "what": "总铁结合力，反映血液中结合铁的潜在能力。",
    "meaning": "组合查看铁的运输、储存和可利用情况，辅助评估铁代谢问题。",
    "limits": "炎症、肝病和近期饮食等可影响结果，不能仅凭单项决定补铁。",
    "sources": [
      {
        "title": "MedlinePlus · 铁代谢",
        "url": "https://medlineplus.gov/lab-tests/iron-tests/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "iron.uibc": {
    "categories": [
      "铁代谢与营养"
    ],
    "what": "不饱和铁结合力，描述尚可结合铁的部分能力。",
    "meaning": "组合查看铁的运输、储存和可利用情况，辅助评估铁代谢问题。",
    "limits": "炎症、肝病和近期饮食等可影响结果，不能仅凭单项决定补铁。",
    "sources": [
      {
        "title": "MedlinePlus · 铁代谢",
        "url": "https://medlineplus.gov/lab-tests/iron-tests/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "iron.saturation": {
    "categories": [
      "铁代谢与营养"
    ],
    "what": "铁占铁结合能力的比例，通常由血清铁和总铁结合力计算。",
    "meaning": "组合查看铁的运输、储存和可利用情况，辅助评估铁代谢问题。",
    "limits": "炎症、肝病和近期饮食等可影响结果，不能仅凭单项决定补铁。",
    "sources": [
      {
        "title": "MedlinePlus · 铁代谢",
        "url": "https://medlineplus.gov/lab-tests/iron-tests/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "electrolyte.sodium": {
    "categories": [
      "电解质与酸碱"
    ],
    "what": "血钠浓度，与水分和电解质平衡有关。",
    "meaning": "用于了解电解质、水分或酸碱平衡的部分状态。",
    "limits": "需要结合肾功能、药物及标本情况，单项不能代表完整酸碱或营养评估。",
    "sources": [
      {
        "title": "MedlinePlus · 综合代谢检测",
        "url": "https://medlineplus.gov/lab-tests/comprehensive-metabolic-panel-cmp/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "electrolyte.potassium": {
    "categories": [
      "电解质与酸碱"
    ],
    "what": "血钾浓度，与神经、肌肉及心脏电活动有关。",
    "meaning": "用于了解电解质、水分或酸碱平衡的部分状态。",
    "limits": "标本溶血可影响结果，异常需结合采血及临床情况评估。",
    "sources": [
      {
        "title": "MedlinePlus · 综合代谢检测",
        "url": "https://medlineplus.gov/lab-tests/comprehensive-metabolic-panel-cmp/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "electrolyte.chloride": {
    "categories": [
      "电解质与酸碱"
    ],
    "what": "血氯浓度，参与水分、电解质和酸碱平衡。",
    "meaning": "用于了解电解质、水分或酸碱平衡的部分状态。",
    "limits": "需要结合肾功能、药物及标本情况，单项不能代表完整酸碱或营养评估。",
    "sources": [
      {
        "title": "MedlinePlus · 综合代谢检测",
        "url": "https://medlineplus.gov/lab-tests/comprehensive-metabolic-panel-cmp/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "electrolyte.co2": {
    "categories": [
      "电解质与酸碱"
    ],
    "what": "血清总二氧化碳，主要反映碳酸氢盐相关信息。",
    "meaning": "用于了解电解质、水分或酸碱平衡的部分状态。",
    "limits": "不是血气分析的全部结果，也不等同于血液二氧化碳分压。",
    "sources": [
      {
        "title": "MedlinePlus · 综合代谢检测",
        "url": "https://medlineplus.gov/lab-tests/comprehensive-metabolic-panel-cmp/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "electrolyte.calcium": {
    "categories": [
      "电解质与酸碱"
    ],
    "what": "血中总钙，包括蛋白结合及游离等部分。",
    "meaning": "用于了解电解质、水分或酸碱平衡的部分状态。",
    "limits": "受白蛋白等影响，不等于骨密度或体内全部钙储量。",
    "sources": [
      {
        "title": "MedlinePlus · 综合代谢检测",
        "url": "https://medlineplus.gov/lab-tests/comprehensive-metabolic-panel-cmp/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "electrolyte.calcium_corrected": {
    "categories": [
      "电解质与酸碱"
    ],
    "what": "根据白蛋白等计算修正的总钙估计值。",
    "meaning": "用于了解电解质、水分或酸碱平衡的部分状态。",
    "limits": "公式有适用限制，不能直接替代离子钙测量。",
    "sources": [
      {
        "title": "MedlinePlus · 综合代谢检测",
        "url": "https://medlineplus.gov/lab-tests/comprehensive-metabolic-panel-cmp/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "body.height": {
    "categories": [
      "体征与身体成分"
    ],
    "what": "身体身高，是BMI等计算所需的基础测量。",
    "meaning": "用于记录身体状态，长期比较时尽量保持测量设备和条件一致。",
    "limits": "身体成分估算受设备和水分影响，指标不能替代个体临床评估。",
    "sources": [
      {
        "title": "CDC · 体重指数",
        "url": "https://www.cdc.gov/BMI/about/index.html"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "body.weight": {
    "categories": [
      "体征与身体成分"
    ],
    "what": "身体体重，适合在相似条件下观察长期变化。",
    "meaning": "用于记录身体状态，长期比较时尽量保持测量设备和条件一致。",
    "limits": "身体成分估算受设备和水分影响，指标不能替代个体临床评估。",
    "sources": [
      {
        "title": "CDC · 体重指数",
        "url": "https://www.cdc.gov/BMI/about/index.html"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "body.bmi": {
    "categories": [
      "体征与身体成分"
    ],
    "what": "体重除以身高平方的指数，用于体重相关风险筛查。",
    "meaning": "用于记录身体状态，长期比较时尽量保持测量设备和条件一致。",
    "limits": "不能区分肌肉与脂肪，也不能单凭BMI完整判断个人健康。",
    "sources": [
      {
        "title": "CDC · 体重指数",
        "url": "https://www.cdc.gov/BMI/about/index.html"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "body.waist": {
    "categories": [
      "体征与身体成分"
    ],
    "what": "腰部周径，提供腹部脂肪分布的线索。",
    "meaning": "用于记录身体状态，长期比较时尽量保持测量设备和条件一致。",
    "limits": "身体成分估算受设备和水分影响，指标不能替代个体临床评估。",
    "sources": [
      {
        "title": "CDC · 体重指数",
        "url": "https://www.cdc.gov/BMI/about/index.html"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "body.hip": {
    "categories": [
      "体征与身体成分"
    ],
    "what": "臀部周径，可与腰围结合描述体型。",
    "meaning": "用于记录身体状态，长期比较时尽量保持测量设备和条件一致。",
    "limits": "身体成分估算受设备和水分影响，指标不能替代个体临床评估。",
    "sources": [
      {
        "title": "CDC · 体重指数",
        "url": "https://www.cdc.gov/BMI/about/index.html"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "body.waist_hip_percent": {
    "categories": [
      "体征与身体成分"
    ],
    "what": "腰围与臀围之比，原报告可能按百分比表达。",
    "meaning": "用于记录身体状态，长期比较时尽量保持测量设备和条件一致。",
    "limits": "比值与百分比相差100倍，需先统一表达，并核对测量位置。",
    "sources": [
      {
        "title": "CDC · 体重指数",
        "url": "https://www.cdc.gov/BMI/about/index.html"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "body.surface_area": {
    "categories": [
      "体征与身体成分"
    ],
    "what": "由身高和体重等估算的体表面积，用于部分医学参数按体型校正。",
    "meaning": "用于记录身体状态，长期比较时尽量保持测量设备和条件一致。",
    "limits": "不是体脂率或健康评分；不同公式可能产生差异。",
    "sources": [
      {
        "title": "MedlinePlus · 肾小球滤过率",
        "url": "https://medlineplus.gov/lab-tests/estimated-glomerular-filtration-rate-egfr-and-gfr-tests/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "body.fat_percent": {
    "categories": [
      "体征与身体成分"
    ],
    "what": "通过身体成分方法估计的脂肪占体重比例。",
    "meaning": "用于记录身体状态，长期比较时尽量保持测量设备和条件一致。",
    "limits": "水分、进食、运动和设备算法可影响结果，比较时保持条件一致。",
    "sources": [
      {
        "title": "TANITA · 身体成分估算",
        "url": "https://tanita.co.uk/blog/What-Do-Different-BIA-Results-Mean"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "body.water_percent": {
    "categories": [
      "体征与身体成分"
    ],
    "what": "设备估计的身体总水分占体重比例。",
    "meaning": "用于记录身体状态，长期比较时尽量保持测量设备和条件一致。",
    "limits": "不是抽血电解质检查，不能单凭此值判断脱水或肾功能。",
    "sources": [
      {
        "title": "TANITA · 身体成分估算",
        "url": "https://tanita.co.uk/blog/What-Do-Different-BIA-Results-Mean"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "vital.heart_rate": {
    "categories": ["体征与身体成分", "心血管与血脂"],
    "what": "每分钟心脏跳动次数。本档案包括内科体检和心电图记录。",
    "meaning": "帮助查看不同年份的测量值；与脉搏通常相关，但同一天不同时间或方法的数值应分别保留。",
    "limits": "活动、情绪、药物和测量时机都可能影响结果；不要把心电图心率与另一时刻的体检脉搏当作同一测量。",
    "sources": [{"title": "American Heart Association · All About Heart Rate", "url": "https://www.heart.org/en/health-topics/high-blood-pressure/the-facts-about-high-blood-pressure/all-about-heart-rate-pulse"}],
    "checkedOn": "2026-11-05"
  },
  "vital.pulse": {
    "categories": [
      "体征与身体成分", "心血管与血脂"
    ],
    "what": "每分钟心脏搏动或外周脉搏次数。档案把心率、脉搏放在同一时间线，保留原报告名称。",
    "meaning": "用于查看各年的心搏频率；同一天不同检查时刻的结果分别显示。",
    "limits": "心电图心率与体检脉搏可能在不同时间测得；活动、情绪和药物也会影响读数，不能将两次读数直接视为同一次测量。",
    "sources": [
      {
        "title": "MedlinePlus · 生命体征",
        "url": "https://medlineplus.gov/ency/article/002341.htm"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "vital.respiratory_rate": {
    "categories": [
      "体征与身体成分"
    ],
    "what": "每分钟呼吸次数。",
    "meaning": "用于记录身体状态，长期比较时尽量保持测量设备和条件一致。",
    "limits": "身体成分估算受设备和水分影响，指标不能替代个体临床评估。",
    "sources": [
      {
        "title": "MedlinePlus · 生命体征",
        "url": "https://medlineplus.gov/ency/article/002341.htm"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "vital.temperature": {
    "categories": [
      "体征与身体成分"
    ],
    "what": "在特定部位和方法下测得的体温。",
    "meaning": "用于记录身体状态，长期比较时尽量保持测量设备和条件一致。",
    "limits": "口腔、腋下等不同方法的结果不完全相同，需保留测量方法。",
    "sources": [
      {
        "title": "MedlinePlus · 生命体征",
        "url": "https://medlineplus.gov/ency/article/002341.htm"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "eye.iop.left": {
    "categories": [
      "眼科"
    ],
    "what": "左眼眼球内部压力的测量结果，是青光眼评估中的一项检查。",
    "meaning": "用于记录视力或眼压，辅助眼科检查。",
    "limits": "眼压或视力单项不能诊断或排除青光眼，需要眼科综合检查。",
    "sources": [
      {
        "title": "MedlinePlus · 青光眼检查",
        "url": "https://medlineplus.gov/lab-tests/glaucoma-tests/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "eye.acuity.corrected.left": {
    "categories": [
      "眼科"
    ],
    "what": "左眼配戴矫正镜片条件下测得的视力。",
    "meaning": "用于记录视力或眼压，辅助眼科检查。",
    "limits": "视力不等于近视度数；较好视力也不能排除其他眼病。",
    "sources": [
      {
        "title": "MedlinePlus · 青光眼检查",
        "url": "https://medlineplus.gov/lab-tests/glaucoma-tests/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "eye.iop.right": {
    "categories": [
      "眼科"
    ],
    "what": "右眼眼球内部压力的测量结果，是青光眼评估中的一项检查。",
    "meaning": "用于记录视力或眼压，辅助眼科检查。",
    "limits": "眼压或视力单项不能诊断或排除青光眼，需要眼科综合检查。",
    "sources": [
      {
        "title": "MedlinePlus · 青光眼检查",
        "url": "https://medlineplus.gov/lab-tests/glaucoma-tests/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "eye.acuity.corrected.right": {
    "categories": [
      "眼科"
    ],
    "what": "右眼配戴矫正镜片条件下测得的视力。",
    "meaning": "用于记录视力或眼压，辅助眼科检查。",
    "limits": "视力不等于近视度数；较好视力也不能排除其他眼病。",
    "sources": [
      {
        "title": "MedlinePlus · 青光眼检查",
        "url": "https://medlineplus.gov/lab-tests/glaucoma-tests/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "breath.c13.value": {
    "categories": [
      "消化道检测"
    ],
    "what": "C13尿素呼气试验的测量结果，用于提供幽门螺杆菌感染线索。",
    "meaning": "用于了解幽门螺杆菌相关证据或消化道出血线索。",
    "limits": "与抗体检测不同；药物和检测准备可影响结果，按检验机构要求解读。",
    "sources": [
      {
        "title": "MedlinePlus · 幽门螺杆菌检测",
        "url": "https://medlineplus.gov/lab-tests/helicobacter-pylori-h-pylori-tests/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "breath.c13.result": {
    "categories": [
      "消化道检测"
    ],
    "what": "C13呼气试验按该实验室标准给出的阴性或阳性判断。",
    "meaning": "用于了解幽门螺杆菌相关证据或消化道出血线索。",
    "limits": "检测方法、药物和采样条件会影响结果，应按具体检查的要求解释。",
    "sources": [
      {
        "title": "MedlinePlus · 幽门螺杆菌检测",
        "url": "https://medlineplus.gov/lab-tests/helicobacter-pylori-h-pylori-tests/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "virus.hp_ab": {
    "categories": [
      "消化道检测"
    ],
    "what": "血液中的幽门螺杆菌抗体，提示接触相关线索。",
    "meaning": "用于了解幽门螺杆菌相关证据或消化道出血线索。",
    "limits": "抗体可在既往感染后持续存在，不能单独确认当前感染或根除成功。",
    "sources": [
      {
        "title": "MedlinePlus · 幽门螺杆菌检测",
        "url": "https://medlineplus.gov/lab-tests/helicobacter-pylori-h-pylori-tests/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "stool.occult_blood": {
    "categories": [
      "消化道检测"
    ],
    "what": "检测肉眼看不到的粪便血液成分。",
    "meaning": "用于了解幽门螺杆菌相关证据或消化道出血线索。",
    "limits": "阳性不等于肠癌，阴性也不能排除所有消化道疾病；不同方法的准备要求可能不同。",
    "sources": [
      {
        "title": "MedlinePlus · 粪便隐血",
        "url": "https://medlineplus.gov/lab-tests/fecal-occult-blood-test-fobt/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "tumor.afp": {
    "categories": [
      "肿瘤标志物"
    ],
    "what": "甲胎蛋白，可用于某些肝脏及生殖细胞肿瘤等的辅助评估和随访。",
    "meaning": "在适用的临床情境中辅助评估或随访，具体用途取决于指标和疾病。",
    "limits": "升高不等于癌症，正常也不能排除癌症；通常需结合影像、病理及临床情况。",
    "sources": [
      {
        "title": "NCI · 肿瘤标志物的用途与限制",
        "url": "https://www.cancer.gov/about-cancer/diagnosis-staging/diagnosis/tumor-markers-fact-sheet"
      },
      {
        "title": "NCI · 常用肿瘤标志物",
        "url": "https://www.cancer.gov/about-cancer/diagnosis-staging/diagnosis/tumor-markers-list"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "tumor.cea": {
    "categories": [
      "肿瘤标志物"
    ],
    "what": "癌胚抗原，常用于适用肿瘤的随访，尤其结直肠癌相关情境。",
    "meaning": "在适用的临床情境中辅助评估或随访，具体用途取决于指标和疾病。",
    "limits": "升高不等于癌症，正常也不能排除癌症；通常需结合影像、病理及临床情况。",
    "sources": [
      {
        "title": "NCI · 肿瘤标志物的用途与限制",
        "url": "https://www.cancer.gov/about-cancer/diagnosis-staging/diagnosis/tumor-markers-fact-sheet"
      },
      {
        "title": "NCI · 常用肿瘤标志物",
        "url": "https://www.cancer.gov/about-cancer/diagnosis-staging/diagnosis/tumor-markers-list"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "tumor.ca199": {
    "categories": [
      "肿瘤标志物"
    ],
    "what": "糖类抗原19-9，在部分胰胆相关疾病的评估和随访中使用。",
    "meaning": "在适用的临床情境中辅助评估或随访，具体用途取决于指标和疾病。",
    "limits": "升高不等于癌症，正常也不能排除癌症；通常需结合影像、病理及临床情况。",
    "sources": [
      {
        "title": "NCI · 肿瘤标志物的用途与限制",
        "url": "https://www.cancer.gov/about-cancer/diagnosis-staging/diagnosis/tumor-markers-fact-sheet"
      },
      {
        "title": "NCI · 常用肿瘤标志物",
        "url": "https://www.cancer.gov/about-cancer/diagnosis-staging/diagnosis/tumor-markers-list"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "tumor.cyfra21_1": {
    "categories": [
      "肿瘤标志物"
    ],
    "what": "细胞角蛋白19片段，是部分肿瘤临床评估中的辅助指标。",
    "meaning": "在适用的临床情境中辅助评估或随访，具体用途取决于指标和疾病。",
    "limits": "升高不等于癌症，正常也不能排除癌症；通常需结合影像、病理及临床情况。",
    "sources": [
      {
        "title": "NCI · 肿瘤标志物的用途与限制",
        "url": "https://www.cancer.gov/about-cancer/diagnosis-staging/diagnosis/tumor-markers-fact-sheet"
      },
      {
        "title": "NCI · 常用肿瘤标志物",
        "url": "https://www.cancer.gov/about-cancer/diagnosis-staging/diagnosis/tumor-markers-list"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "tumor.scc": {
    "categories": [
      "肿瘤标志物"
    ],
    "what": "鳞状细胞癌相关抗原，可用于适用疾病的辅助评估或随访。",
    "meaning": "在适用的临床情境中辅助评估或随访，具体用途取决于指标和疾病。",
    "limits": "升高不等于癌症，正常也不能排除癌症；通常需结合影像、病理及临床情况。",
    "sources": [
      {
        "title": "NCI · 肿瘤标志物的用途与限制",
        "url": "https://www.cancer.gov/about-cancer/diagnosis-staging/diagnosis/tumor-markers-fact-sheet"
      },
      {
        "title": "NCI · 常用肿瘤标志物",
        "url": "https://www.cancer.gov/about-cancer/diagnosis-staging/diagnosis/tumor-markers-list"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "tumor.tsgf": {
    "categories": [
      "肿瘤标志物"
    ],
    "what": "报告列出的肿瘤特异生长因子类项目。",
    "meaning": "在适用的临床情境中辅助评估或随访，具体用途取决于指标和疾病。",
    "limits": "本应用仅说明归档名称；本轮未核实该具体方法的充分临床依据和通用筛查效能，需向检验科确认，不能据此诊断或排除癌症。",
    "sources": [
      {
        "title": "NCI · 肿瘤标志物的用途与限制",
        "url": "https://www.cancer.gov/about-cancer/diagnosis-staging/diagnosis/tumor-markers-fact-sheet"
      },
      {
        "title": "NCI · 常用肿瘤标志物",
        "url": "https://www.cancer.gov/about-cancer/diagnosis-staging/diagnosis/tumor-markers-list"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "tumor.ca724": {
    "categories": [
      "肿瘤标志物"
    ],
    "what": "糖类抗原72-4，在部分胃部相关疾病评估中作为辅助信息。",
    "meaning": "在适用的临床情境中辅助评估或随访，具体用途取决于指标和疾病。",
    "limits": "升高不等于癌症，正常也不能排除癌症；通常需结合影像、病理及临床情况。",
    "sources": [
      {
        "title": "PathWest · CA72-4 检验目录",
        "url": "https://pathwesttd.health.wa.gov.au/testdirectory/testdetail.aspx?TestID=332"
      },
      {
        "title": "NCI · 肿瘤标志物的用途与限制",
        "url": "https://www.cancer.gov/about-cancer/diagnosis-staging/diagnosis/tumor-markers-fact-sheet"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "tumor.nse": {
    "categories": [
      "肿瘤标志物"
    ],
    "what": "神经元特异性烯醇化酶，可用于部分神经内分泌相关肿瘤的辅助评估和随访。",
    "meaning": "在适用的临床情境中辅助评估或随访，具体用途取决于指标和疾病。",
    "limits": "并非通用癌症筛查；标本溶血等可能影响结果，应结合其他检查。",
    "sources": [
      {
        "title": "Mayo Clinic Laboratories · NSE",
        "url": "https://prd1.mayocliniclabs.com/test-catalog/overview/80913"
      },
      {
        "title": "NCI · 肿瘤标志物的用途与限制",
        "url": "https://www.cancer.gov/about-cancer/diagnosis-staging/diagnosis/tumor-markers-fact-sheet"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "hormone.hcg": {
    "categories": [
      "肿瘤标志物"
    ],
    "what": "人绒毛膜促性腺激素，常用于妊娠相关检查，也可用于特定生殖细胞肿瘤等的评估。",
    "meaning": "在适用的临床情境中辅助评估或随访，具体用途取决于指标和疾病。",
    "limits": "含义取决于人群和临床用途，本档案不能仅凭hCG判断肿瘤。",
    "sources": [
      {
        "title": "NCI · 常用肿瘤标志物",
        "url": "https://www.cancer.gov/about-cancer/diagnosis-staging/diagnosis/tumor-markers-list"
      },
      {
        "title": "NCI · 肿瘤标志物的用途与限制",
        "url": "https://www.cancer.gov/about-cancer/diagnosis-staging/diagnosis/tumor-markers-fact-sheet"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "prostate.tpsa": {
    "categories": [
      "肿瘤标志物"
    ],
    "what": "总前列腺特异性抗原，包含游离及结合形式，用于前列腺相关评估。",
    "meaning": "在适用的临床情境中辅助评估或随访，具体用途取决于指标和疾病。",
    "limits": "前列腺增生、炎症等也可影响PSA；比值尤其需要结合总PSA，不能单独诊断癌症。",
    "sources": [
      {
        "title": "MedlinePlus · PSA检测",
        "url": "https://medlineplus.gov/lab-tests/prostate-specific-antigen-psa-test/"
      },
      {
        "title": "NCI · 肿瘤标志物的用途与限制",
        "url": "https://www.cancer.gov/about-cancer/diagnosis-staging/diagnosis/tumor-markers-fact-sheet"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "prostate.fpsa": {
    "categories": [
      "肿瘤标志物"
    ],
    "what": "游离前列腺特异性抗原，是PSA中未结合蛋白的部分。",
    "meaning": "在适用的临床情境中辅助评估或随访，具体用途取决于指标和疾病。",
    "limits": "前列腺增生、炎症等也可影响PSA；比值尤其需要结合总PSA，不能单独诊断癌症。",
    "sources": [
      {
        "title": "MedlinePlus · PSA检测",
        "url": "https://medlineplus.gov/lab-tests/prostate-specific-antigen-psa-test/"
      },
      {
        "title": "NCI · 肿瘤标志物的用途与限制",
        "url": "https://www.cancer.gov/about-cancer/diagnosis-staging/diagnosis/tumor-markers-fact-sheet"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "prostate.fpsa_tpsa": {
    "categories": [
      "肿瘤标志物"
    ],
    "what": "游离PSA占总PSA的比例，在特定总PSA范围等情境下辅助评估。",
    "meaning": "在适用的临床情境中辅助评估或随访，具体用途取决于指标和疾病。",
    "limits": "前列腺增生、炎症等也可影响PSA；比值尤其需要结合总PSA，不能单独诊断癌症。",
    "sources": [
      {
        "title": "MedlinePlus · PSA检测",
        "url": "https://medlineplus.gov/lab-tests/prostate-specific-antigen-psa-test/"
      },
      {
        "title": "NCI · 肿瘤标志物的用途与限制",
        "url": "https://www.cancer.gov/about-cancer/diagnosis-staging/diagnosis/tumor-markers-fact-sheet"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "virus.hbs_ag": {
    "categories": [
      "感染与免疫"
    ],
    "what": "乙肝表面抗原，用于判断是否存在乙肝病毒感染线索。",
    "meaning": "用于了解特定病原体或免疫反应，需按抗原、抗体及核酸分别解读。",
    "limits": "单次结果不能区分所有感染阶段，需结合其他标志物及随访。",
    "sources": [
      {
        "title": "CDC · 乙肝检测及组合解读",
        "url": "https://www.cdc.gov/hepatitis-b/hcp/diagnosis-testing/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "virus.hbs_ab": {
    "categories": [
      "感染与免疫"
    ],
    "what": "乙肝表面抗体，可见于疫苗接种或感染恢复后。",
    "meaning": "用于了解特定病原体或免疫反应，需按抗原、抗体及核酸分别解读。",
    "limits": "需结合表面抗原和核心抗体等判断来源及意义，不是越高越严重。",
    "sources": [
      {
        "title": "CDC · 乙肝检测及组合解读",
        "url": "https://www.cdc.gov/hepatitis-b/hcp/diagnosis-testing/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "virus.hbc_total": {
    "categories": [
      "感染与免疫"
    ],
    "what": "乙肝核心总抗体，提供曾接触乙肝病毒的线索。",
    "meaning": "用于了解特定病原体或免疫反应，需按抗原、抗体及核酸分别解读。",
    "limits": "通常不能由单纯疫苗接种产生；须结合其他指标判断。",
    "sources": [
      {
        "title": "CDC · 乙肝检测及组合解读",
        "url": "https://www.cdc.gov/hepatitis-b/hcp/diagnosis-testing/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "virus.hbc_igm": {
    "categories": [
      "感染与免疫"
    ],
    "what": "乙肝核心IgM抗体，与近期感染等情境有关。",
    "meaning": "用于了解特定病原体或免疫反应，需按抗原、抗体及核酸分别解读。",
    "limits": "某些再激活或发作也可出现，不能单独判定感染时间。",
    "sources": [
      {
        "title": "CDC · 乙肝检测及组合解读",
        "url": "https://www.cdc.gov/hepatitis-b/hcp/diagnosis-testing/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "virus.hbe_ag": {
    "categories": [
      "感染与免疫"
    ],
    "what": "乙肝e抗原，提供病毒复制相关的辅助信息。",
    "meaning": "用于了解特定病原体或免疫反应，需按抗原、抗体及核酸分别解读。",
    "limits": "不能代替HBV DNA定量；阴性不代表不存在复制。",
    "sources": [
      {
        "title": "CDC · 乙肝检测及组合解读",
        "url": "https://www.cdc.gov/hepatitis-b/hcp/diagnosis-testing/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "virus.hbe_ab": {
    "categories": [
      "感染与免疫"
    ],
    "what": "乙肝e抗体，是针对e抗原的免疫反应。",
    "meaning": "用于了解特定病原体或免疫反应，需按抗原、抗体及核酸分别解读。",
    "limits": "阳性不能单独说明病毒已清除或没有传染性。",
    "sources": [
      {
        "title": "CDC · 乙肝检测及组合解读",
        "url": "https://www.cdc.gov/hepatitis-b/hcp/diagnosis-testing/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "virus.hav_igm": {
    "categories": [
      "感染与免疫"
    ],
    "what": "甲肝IgM抗体，用于近期甲肝感染的评估。",
    "meaning": "用于了解特定病原体或免疫反应，需按抗原、抗体及核酸分别解读。",
    "limits": "阳性不一定表示当前活动性感染，也不自动表示具有保护性；应结合检测组合和方法。",
    "sources": [
      {
        "title": "MedlinePlus · 肝炎检测",
        "url": "https://medlineplus.gov/lab-tests/hepatitis-testing/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "virus.hav_total": {
    "categories": [
      "感染与免疫"
    ],
    "what": "甲肝总抗体，包含IgG和IgM相关反应。",
    "meaning": "用于了解特定病原体或免疫反应，需按抗原、抗体及核酸分别解读。",
    "limits": "单项阳性不能区分疫苗免疫、既往感染和近期感染，需结合IgM等。",
    "sources": [
      {
        "title": "MedlinePlus · 肝炎检测",
        "url": "https://medlineplus.gov/lab-tests/hepatitis-testing/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "virus.hcv_ab": {
    "categories": [
      "感染与免疫"
    ],
    "what": "丙肝抗体，提供曾接触丙肝病毒的线索。",
    "meaning": "用于了解特定病原体或免疫反应，需按抗原、抗体及核酸分别解读。",
    "limits": "阳性通常需结合HCV RNA判断是否当前感染。",
    "sources": [
      {
        "title": "MedlinePlus · 肝炎检测",
        "url": "https://medlineplus.gov/lab-tests/hepatitis-testing/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "virus.cmv_igg": {
    "categories": [
      "感染与免疫"
    ],
    "what": "巨细胞病毒IgG抗体，通常反映既往接触相关免疫反应。",
    "meaning": "用于了解特定病原体或免疫反应，需按抗原、抗体及核酸分别解读。",
    "limits": "阳性不能独立确定感染发生时间或是否当前活动。",
    "sources": [
      {
        "title": "CDC · CMV实验室检测",
        "url": "https://www.cdc.gov/cytomegalovirus/php/laboratories/index.html"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "virus.cmv_igm": {
    "categories": [
      "感染与免疫"
    ],
    "what": "巨细胞病毒IgM抗体，可提供近期感染等线索。",
    "meaning": "用于了解特定病原体或免疫反应，需按抗原、抗体及核酸分别解读。",
    "limits": "可持续存在或受其他因素影响，单独阳性不能确诊近期初次感染。",
    "sources": [
      {
        "title": "CDC · CMV实验室检测",
        "url": "https://www.cdc.gov/cytomegalovirus/php/laboratories/index.html"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "virus.ebv_dna": {
    "categories": [
      "感染与免疫"
    ],
    "what": "对标本中的EB病毒DNA作定量检测，结果可带检测下限符号。",
    "meaning": "用于了解特定病原体或免疫反应，需按抗原、抗体及核酸分别解读。",
    "limits": "低于检测下限不是测得0，也不等同于排除所有EB病毒相关疾病。",
    "sources": [
      {
        "title": "CDC · EB病毒实验室检测",
        "url": "https://www.cdc.gov/epstein-barr/php/laboratories/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "virus.ebv_dna_qualitative": {
    "categories": [
      "感染与免疫"
    ],
    "what": "EB病毒核酸的定性结果，按方法报告检出或未检出。",
    "meaning": "用于了解特定病原体或免疫反应，需按抗原、抗体及核酸分别解读。",
    "limits": "需保留标本类型和检测限，不与抗体结果直接互换。",
    "sources": [
      {
        "title": "CDC · EB病毒实验室检测",
        "url": "https://www.cdc.gov/epstein-barr/php/laboratories/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "virus.ebv_ea_iga": {
    "categories": [
      "感染与免疫"
    ],
    "what": "针对EB病毒早期抗原的IgA抗体，用于特定临床评估。",
    "meaning": "用于了解特定病原体或免疫反应，需按抗原、抗体及核酸分别解读。",
    "limits": "EA-IgA不等于EA-IgG；不能单独用来诊断鼻咽癌或确定感染阶段。",
    "sources": [
      {
        "title": "新加坡国立大学医院 · EBV IgA检测",
        "url": "https://nuhsingapore.testcatalog.org/show/AEBV"
      },
      {
        "title": "MedlinePlus · 抗体检测",
        "url": "https://medlineplus.gov/lab-tests/antibody-serology-tests/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "virus.htlv": {
    "categories": [
      "感染与免疫"
    ],
    "what": "检测人类嗜T细胞病毒相关抗体；需保留I/II联合或II型分项的区别。",
    "meaning": "用于了解特定病原体或免疫反应，需按抗原、抗体及核酸分别解读。",
    "limits": "筛查反应性结果通常需进一步确认；抗体阳性不等于已经患白血病。",
    "sources": [
      {
        "title": "UKHSA · HTLV检测",
        "url": "https://www.gov.uk/guidance/human-t-cell-lymphotropic-virus-htlv-types-1-and-2"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "virus.htlv_ii": {
    "categories": [
      "感染与免疫"
    ],
    "what": "检测人类嗜T细胞病毒相关抗体；需保留I/II联合或II型分项的区别。",
    "meaning": "用于了解特定病原体或免疫反应，需按抗原、抗体及核酸分别解读。",
    "limits": "筛查反应性结果通常需进一步确认；抗体阳性不等于已经患白血病。",
    "sources": [
      {
        "title": "UKHSA · HTLV检测",
        "url": "https://www.gov.uk/guidance/human-t-cell-lymphotropic-virus-htlv-types-1-and-2"
      }
    ],
    "checkedOn": "2026-11-05"
  }
};

// Additional historic and hospital panel metadata; general education only.
Object.assign(METRIC_INFO, {
  "cbc.mid.percent": {
    "categories": [
      "血常规"
    ],
    "what": "三分类血常规中间细胞所占比例。",
    "meaning": "辅助了解白细胞分类构成。",
    "limits": "是多类细胞的合并区，不能直接等同单核细胞百分比；旧报告小数比例按×100换算%。",
    "sources": [
      {
        "title": "MedlinePlus · 白细胞分类",
        "url": "https://medlineplus.gov/lab-tests/blood-differential/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "cbc.mid.absolute": {
    "categories": [
      "血常规"
    ],
    "what": "三分类血常规中间细胞的绝对计数。",
    "meaning": "与总白细胞及分类比例一起观察。",
    "limits": "中间细胞不是单核细胞专属计数；三分类与五分类不直接互换。",
    "sources": [
      {
        "title": "MedlinePlus · 白细胞分类",
        "url": "https://medlineplus.gov/lab-tests/blood-differential/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "protein_electrophoresis.albumin_percent": {
    "categories": [
      "感染与免疫",
      "肝脏与胆道"
    ],
    "what": "血清蛋白电泳中白蛋白区带占总蛋白的比例。",
    "meaning": "帮助观察血清蛋白各区带分布。",
    "limits": "百分比不能与g/L浓度合并；需结合完整电泳图与其他检查，不能凭单个区带判断肿瘤。",
    "sources": [
      {
        "title": "MedlinePlus · 血清蛋白电泳",
        "url": "https://medlineplus.gov/ency/article/003540.htm"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "protein_electrophoresis.alpha1_percent": {
    "categories": [
      "感染与免疫",
      "肝脏与胆道"
    ],
    "what": "血清蛋白电泳中α1球蛋白区带占总蛋白的比例。",
    "meaning": "帮助观察血清蛋白各区带分布。",
    "limits": "百分比不能与g/L浓度合并；需结合完整电泳图与其他检查，不能凭单个区带判断肿瘤。",
    "sources": [
      {
        "title": "MedlinePlus · 血清蛋白电泳",
        "url": "https://medlineplus.gov/ency/article/003540.htm"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "protein_electrophoresis.alpha2_percent": {
    "categories": [
      "感染与免疫",
      "肝脏与胆道"
    ],
    "what": "血清蛋白电泳中α2球蛋白区带占总蛋白的比例。",
    "meaning": "帮助观察血清蛋白各区带分布。",
    "limits": "百分比不能与g/L浓度合并；需结合完整电泳图与其他检查，不能凭单个区带判断肿瘤。",
    "sources": [
      {
        "title": "MedlinePlus · 血清蛋白电泳",
        "url": "https://medlineplus.gov/ency/article/003540.htm"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "protein_electrophoresis.beta_percent": {
    "categories": [
      "感染与免疫",
      "肝脏与胆道"
    ],
    "what": "血清蛋白电泳中β球蛋白区带占总蛋白的比例。",
    "meaning": "帮助观察血清蛋白各区带分布。",
    "limits": "百分比不能与g/L浓度合并；需结合完整电泳图与其他检查，不能凭单个区带判断肿瘤。",
    "sources": [
      {
        "title": "MedlinePlus · 血清蛋白电泳",
        "url": "https://medlineplus.gov/ency/article/003540.htm"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "protein_electrophoresis.gamma_percent": {
    "categories": [
      "感染与免疫",
      "肝脏与胆道"
    ],
    "what": "血清蛋白电泳中γ球蛋白区带占总蛋白的比例。",
    "meaning": "帮助观察血清蛋白各区带分布。",
    "limits": "百分比不能与g/L浓度合并；需结合完整电泳图与其他检查，不能凭单个区带判断肿瘤。",
    "sources": [
      {
        "title": "MedlinePlus · 血清蛋白电泳",
        "url": "https://medlineplus.gov/ency/article/003540.htm"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "enzyme.ldh1_percent": {
    "categories": [
      "心血管与血脂"
    ],
    "what": "LDH1同工酶占乳酸脱氢酶的比例。",
    "meaning": "不同同工酶的分布帮助辅助判断组织来源。",
    "limits": "本项为百分比，不能与总LDH活性U/L合并；组织分布有重叠，单项不能定位损伤。",
    "sources": [
      {
        "title": "MedlinePlus · LDH同工酶",
        "url": "https://medlineplus.gov/lab-tests/lactate-dehydrogenase-ldh-isoenzymes-test/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "enzyme.ldh2_percent": {
    "categories": [
      "心血管与血脂"
    ],
    "what": "LDH2同工酶占乳酸脱氢酶的比例。",
    "meaning": "不同同工酶的分布帮助辅助判断组织来源。",
    "limits": "本项为百分比，不能与总LDH活性U/L合并；组织分布有重叠，单项不能定位损伤。",
    "sources": [
      {
        "title": "MedlinePlus · LDH同工酶",
        "url": "https://medlineplus.gov/lab-tests/lactate-dehydrogenase-ldh-isoenzymes-test/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "enzyme.ldh3_percent": {
    "categories": [
      "心血管与血脂"
    ],
    "what": "LDH3同工酶占乳酸脱氢酶的比例。",
    "meaning": "不同同工酶的分布帮助辅助判断组织来源。",
    "limits": "本项为百分比，不能与总LDH活性U/L合并；组织分布有重叠，单项不能定位损伤。",
    "sources": [
      {
        "title": "MedlinePlus · LDH同工酶",
        "url": "https://medlineplus.gov/lab-tests/lactate-dehydrogenase-ldh-isoenzymes-test/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "enzyme.ldh4_percent": {
    "categories": [
      "心血管与血脂"
    ],
    "what": "LDH4同工酶占乳酸脱氢酶的比例。",
    "meaning": "不同同工酶的分布帮助辅助判断组织来源。",
    "limits": "本项为百分比，不能与总LDH活性U/L合并；组织分布有重叠，单项不能定位损伤。",
    "sources": [
      {
        "title": "MedlinePlus · LDH同工酶",
        "url": "https://medlineplus.gov/lab-tests/lactate-dehydrogenase-ldh-isoenzymes-test/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "enzyme.ldh5_percent": {
    "categories": [
      "心血管与血脂"
    ],
    "what": "LDH5同工酶占乳酸脱氢酶的比例。",
    "meaning": "不同同工酶的分布帮助辅助判断组织来源。",
    "limits": "本项为百分比，不能与总LDH活性U/L合并；组织分布有重叠，单项不能定位损伤。",
    "sources": [
      {
        "title": "MedlinePlus · LDH同工酶",
        "url": "https://medlineplus.gov/lab-tests/lactate-dehydrogenase-ldh-isoenzymes-test/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "enzyme.ldh": {
    "categories": [
      "心血管与血脂"
    ],
    "what": "血液中乳酸脱氢酶总活性。",
    "meaning": "辅助了解组织损伤，结合其他检查判断。",
    "limits": "来源广泛，溶血也可影响；不能单凭升高判断心肌损伤或肿瘤。",
    "sources": [
      {
        "title": "MedlinePlus · LDH",
        "url": "https://medlineplus.gov/lab-tests/lactate-dehydrogenase-ldh-test/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "enzyme.ck": {
    "categories": [
      "心血管与血脂"
    ],
    "what": "血液中肌酸激酶总活性。",
    "meaning": "主要用于观察骨骼肌损伤等情况。",
    "limits": "运动、药物及其他因素可影响，需结合症状和其他检查。",
    "sources": [
      {
        "title": "MedlinePlus · CK",
        "url": "https://medlineplus.gov/lab-tests/creatine-kinase/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "enzyme.ck_mb": {
    "categories": [
      "心血管与血脂"
    ],
    "what": "肌酸激酶MB同工酶活性。",
    "meaning": "在相应临床情境中辅助评估心肌等组织损伤。",
    "limits": "活性U/L与质量浓度ng/mL不可直接合并；不能单独诊断心肌梗死。",
    "sources": [
      {
        "title": "MedlinePlus · CK同工酶",
        "url": "https://medlineplus.gov/lab-tests/creatine-kinase/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "enzyme.mito_ast": {
    "categories": [
      "肝脏与胆道"
    ],
    "what": "原报告标记为线粒体来源AST的酶活性。",
    "meaning": "作为AST相关分项保留，需核对实验室方法。",
    "limits": "不与总AST合并；该特定方法的独立诊断意义尚未核实，暂不作个体解释。",
    "sources": [
      {
        "title": "MedlinePlus · AST通用说明",
        "url": "https://medlineplus.gov/lab-tests/ast-test/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "enzyme.alpha_hbdh": {
    "categories": [
      "心血管与血脂"
    ],
    "what": "原报告的α羟丁酸脱氢酶活性项目。",
    "meaning": "作为LDH相关酶学分项追踪。",
    "limits": "该项目的具体方法及独立诊断阈值尚未核实；不等同LDH1百分比，不凭其诊断心脏病。",
    "sources": [
      {
        "title": "MedlinePlus · LDH同工酶背景",
        "url": "https://medlineplus.gov/lab-tests/lactate-dehydrogenase-ldh-isoenzymes-test/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "inflammation.esr": {
    "categories": [
      "感染与免疫"
    ],
    "what": "红细胞在规定时间内沉降的速度。",
    "meaning": "辅助观察炎症相关变化。",
    "limits": "非特异性，不能凭血沉确定炎症病因或排除疾病。",
    "sources": [
      {
        "title": "MedlinePlus · ESR",
        "url": "https://medlineplus.gov/lab-tests/erythrocyte-sedimentation-rate-esr/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "lipid.lpa": {
    "categories": [
      "心血管与血脂"
    ],
    "what": "血液中脂蛋白(a)水平。",
    "meaning": "辅助评估心血管相关风险。",
    "limits": "mg/dL与nmol/L不能使用固定通用系数强行互换；不是普通LDL胆固醇。",
    "sources": [
      {
        "title": "MedlinePlus · Lp(a)",
        "url": "https://medlineplus.gov/lab-tests/lipoprotein-a-blood-test/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "lipid.apoc2": {
    "categories": [
      "心血管与血脂"
    ],
    "what": "载脂蛋白C-II的浓度。",
    "meaning": "该蛋白参与脂蛋白脂酶激活及甘油三酯代谢。",
    "limits": "不能单项确定遗传性脂质疾病或自行调整治疗。",
    "sources": [
      {
        "title": "NCBI MeSH · ApoC-II",
        "url": "https://www.ncbi.nlm.nih.gov/mesh/68053304"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "lipid.apob": {
    "categories": [
      "心血管与血脂"
    ],
    "what": "载脂蛋白B浓度，反映相关脂蛋白的蛋白成分。",
    "meaning": "作为常规血脂之外的分项辅助了解脂质代谢。",
    "limits": "需核对具体检测方法与分型；不等同常规LDL-C。A未注明亚型时不自动归为A1；个人治疗目标需综合风险评估。",
    "sources": [
      {
        "title": "ASHP · ApoB及Lp(a)背景（其他分项方法待核对）",
        "url": "https://www.ashp.org/-/media/assets/ambulatory-care-practitioner/docs/ApoB-LPa-FAQ-Final.pdf?hash=E4FCFBAC732573F87A0A2597F0AB33F6&rev=b69e08785a6e47eea6884a212a63c043"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "lipid.apoa_unspecified": {
    "categories": [
      "心血管与血脂"
    ],
    "what": "原报告仅写载脂蛋白A，未明确亚型。",
    "meaning": "作为常规血脂之外的分项辅助了解脂质代谢。",
    "limits": "需核对具体检测方法与分型；不等同常规LDL-C。A未注明亚型时不自动归为A1；个人治疗目标需综合风险评估。",
    "sources": [
      {
        "title": "ASHP · ApoB及Lp(a)背景（其他分项方法待核对）",
        "url": "https://www.ashp.org/-/media/assets/ambulatory-care-practitioner/docs/ApoB-LPa-FAQ-Final.pdf?hash=E4FCFBAC732573F87A0A2597F0AB33F6&rev=b69e08785a6e47eea6884a212a63c043"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "lipid.apoa_apob_ratio": {
    "categories": [
      "心血管与血脂"
    ],
    "what": "原报告载脂蛋白A与载脂蛋白B的比值。",
    "meaning": "作为常规血脂之外的分项辅助了解脂质代谢。",
    "limits": "需核对具体检测方法与分型；不等同常规LDL-C。A未注明亚型时不自动归为A1；个人治疗目标需综合风险评估。",
    "sources": [
      {
        "title": "ASHP · ApoB及Lp(a)背景（其他分项方法待核对）",
        "url": "https://www.ashp.org/-/media/assets/ambulatory-care-practitioner/docs/ApoB-LPa-FAQ-Final.pdf?hash=E4FCFBAC732573F87A0A2597F0AB33F6&rev=b69e08785a6e47eea6884a212a63c043"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "lipid.sd_ldl": {
    "categories": [
      "心血管与血脂"
    ],
    "what": "小而密低密度脂蛋白胆固醇浓度。",
    "meaning": "作为常规血脂之外的分项辅助了解脂质代谢。",
    "limits": "需核对具体检测方法与分型；不等同常规LDL-C。A未注明亚型时不自动归为A1；个人治疗目标需综合风险评估。",
    "sources": [
      {
        "title": "ASHP · ApoB及Lp(a)背景（其他分项方法待核对）",
        "url": "https://www.ashp.org/-/media/assets/ambulatory-care-practitioner/docs/ApoB-LPa-FAQ-Final.pdf?hash=E4FCFBAC732573F87A0A2597F0AB33F6&rev=b69e08785a6e47eea6884a212a63c043"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "liver.bile_acids": {
    "categories": [
      "肝脏与胆道"
    ],
    "what": "血液中总胆汁酸水平。",
    "meaning": "辅助评估肝脏代谢及胆汁排泄相关情况。",
    "limits": "与肝功能其他指标及采样条件一起解释，不能独立定位病变。",
    "sources": [
      {
        "title": "RCPA · 胆汁酸",
        "url": "https://www.rcpa.edu.au/Manuals/RCPA-Manual/Pathology-Tests/B/Bile-Acids"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "nutrition.prealbumin": {
    "categories": [
      "铁代谢与营养",
      "肝脏与胆道"
    ],
    "what": "肝脏合成的前白蛋白浓度。",
    "meaning": "在营养及炎症等背景中辅助评估。",
    "limits": "炎症、感染及损伤都会影响，不能单凭它诊断营养不良。",
    "sources": [
      {
        "title": "MedlinePlus · 前白蛋白",
        "url": "https://medlineplus.gov/lab-tests/prealbumin-blood-test/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "nutrition.rbp": {
    "categories": [
      "铁代谢与营养"
    ],
    "what": "视黄醇结合蛋白浓度，参与维生素A运输。",
    "meaning": "结合其他营养、肝肾指标观察。",
    "limits": "血清与尿中RBP意义不同；该项不等于维生素A含量。",
    "sources": [
      {
        "title": "Mayo Clinic Laboratories · 检验目录",
        "url": "https://www.mayocliniclabs.com/test-catalog/pod/MayoTestCatalog-Rochester--SortedByTestName-duplex-interpretive.pdf"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "renal.bun_crea_ratio": {
    "categories": [
      "肾脏与尿检"
    ],
    "what": "原报告BUN:CREA比值。",
    "meaning": "用于保留肾功能相关计算结果。",
    "limits": "原表未明确单位和计算方式，暂不进入可比曲线；不可用不同单位的尿素与肌酐直接比较比值。",
    "sources": [
      {
        "title": "MedlinePlus · 尿素氮",
        "url": "https://medlineplus.gov/lab-tests/bun-blood-urea-nitrogen/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "renal.egfr.mdrd": {
    "categories": [
      "肾脏与尿检"
    ],
    "what": "通过MDRD公式估算的肾小球滤过率。",
    "meaning": "辅助评估肾脏过滤功能。",
    "limits": "截图单位被截断，需完整报告核对；不同公式的估算值不自动并为同一序列。",
    "sources": [
      {
        "title": "MedlinePlus · eGFR",
        "url": "https://medlineplus.gov/lab-tests/glomerular-filtration-rate-gfr-test/"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "urine.vitamin_c": {
    "categories": [
      "肾脏与尿检"
    ],
    "what": "尿液试纸的维生素C检测结果。",
    "meaning": "作为尿试纸背景信息保留。",
    "limits": "不等于血中维生素C水平或营养状态；具体试纸干扰规则需参考检验方法。",
    "sources": [
      {
        "title": "MedlinePlus · 尿液分析背景",
        "url": "https://medlineplus.gov/ency/article/003579.htm"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "virus.ebv_vca_iga": {
    "categories": [
      "感染与免疫"
    ],
    "what": "针对EB病毒衣壳抗原的IgA抗体。",
    "meaning": "在相应临床情境中与其他EBV检查综合评估。",
    "limits": "IgA与IgG/IgM不同，不能互换；本说明未核实该特定试剂的诊断性能，阳性不等同癌症。",
    "sources": [
      {
        "title": "CDC · EBV实验室检测背景",
        "url": "https://www.cdc.gov/epstein-barr/php/laboratories/index.html"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "virus.hbv_dna": {
    "categories": [
      "感染与免疫",
      "肝脏与胆道"
    ],
    "what": "血液中乙肝病毒DNA的定量检测。",
    "meaning": "结合血清学、肝功能和病史随访病毒复制情况。",
    "limits": "低于检出限保留比较符，不作为精确测量点；不单凭此项作乙肝筛查或诊断。",
    "sources": [
      {
        "title": "Public Health Ontario · HBV DNA",
        "url": "https://www.publichealthontario.ca/en/laboratory-services/test-information-index/hepatitis-b-dna-geno-drt"
      }
    ],
    "checkedOn": "2026-11-05"
  },
  "vital.heart_rate_exam": {
    "categories": [
      "体征与身体成分",
      "心血管与血脂"
    ],
    "what": "体检内科检查中记录的心率。",
    "meaning": "用于保留当次检查的心搏频率。",
    "limits": "不与同报告其他时刻的脉搏或手表连续测量自动去重；需保留测量背景。",
    "sources": [
      {
        "title": "MedlinePlus · 生命体征",
        "url": "https://medlineplus.gov/ency/article/002341.htm"
      }
    ],
    "checkedOn": "2026-11-05"
  }
});
