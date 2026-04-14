export const brand = {
  name: "糖糖和小希",
  nameEn: "Tang & Xi",
  tagline: "你的医美避雷闺蜜",
  description:
    "拒绝盲目变美，用真实数据和专业审美，陪你做出最适合自己的选择。",

  personas: {
    tang: {
      name: "糖糖",
      nameEn: "Tang",
      role: "感性审美官",
      description:
        '负责发掘最新的全球审美趋势，从艺术和视觉角度给用户建议。她是那个告诉你\u201C你已经很美，只需要一点点微调\u201D的温柔闺蜜。',
      color: "champagne",
    },
    xi: {
      name: "小希",
      nameEn: "Xi",
      role: "理性避雷针",
      description:
        "负责用数据说话。她会拆解每一个项目的原理、风险、恢复期以及历史反馈。她是那个在你冲动下单前，拿出一份分析报告让你冷静的专业军师。",
      color: "rose-deep",
    },
  },

  contact: {
    wechatId: "tangxi_beauty",
    wechatServiceUrl: "https://work.weixin.qq.com/kfid/xxxxx",
    qrCodePath: "/images/wechat-qr.png",
  },

  disclaimer:
    "本平台仅提供信息中介与咨询服务，所有内容不构成医疗诊断或治疗建议。就医请前往正规医疗机构。",

  coreValues: [
    { label: "真实", description: "拒绝滤镜，只链接最真实的术后反馈" },
    {
      label: "客观",
      description: "不绑定单一医院，基于用户画像推荐最合适的方案",
    },
    { label: "陪伴", description: "医美不是一次性买卖，而是长期的自我投资" },
  ],
} as const;
