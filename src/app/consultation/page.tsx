"use client";

import { useState } from "react";
import WechatContact from "@/components/contact/WechatContact";

const faqs = [
  {
    q: "你们是医疗机构吗？",
    a: "不是。我们是医美信息中介与咨询服务平台，帮助您了解项目信息、对比机构口碑，但不提供任何医疗诊断或治疗服务。",
  },
  {
    q: "咨询服务包括什么？",
    a: "我们提供一对一专属顾问服务，包括：变美需求分析、项目科普讲解、机构口碑调查、陪诊服务等。帮您在做决定前，充分了解所有信息。",
  },
  {
    q: "陪诊服务是什么？",
    a: "我们的专属顾问可以陪您一起去面诊，帮您在现场记录医生建议、对比不同方案、把关合同条款，避免冲动消费。",
  },
  {
    q: "收费标准是怎样的？",
    a: '初次微信咨询免费。深度咨询和陪诊服务根据不同套餐收费，详情可在\u201C服务项目\u201D页面查看，也可以直接添加客服微信了解。',
  },
  {
    q: "你们推荐的机构靠谱吗？",
    a: "我们不绑定任何单一机构。所有推荐基于公开数据、用户反馈和专业分析，同时会如实告知每个机构的优缺点，帮您做出客观判断。",
  },
];

export default function ConsultationPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="pb-16">
      {/* Header */}
      <section className="bg-gradient-to-br from-champagne-light to-rose-soft-light py-16">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-brand-text mb-3">
            咨询服务
          </h1>
          <p className="text-brand-text-light max-w-lg mx-auto">
            添加糖糖和小希专属顾问微信，获取免费初步咨询。
            我们用专业和真诚，陪你做出最适合自己的选择。
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Left: Services + FAQ */}
          <div>
            {/* Services Description */}
            <div className="mb-10">
              <h2 className="text-xl font-bold text-brand-text mb-6">
                我们的服务
              </h2>
              <div className="space-y-4">
                <div className="bg-white rounded-xl p-5 border border-champagne-dark/10">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-champagne to-champagne-light flex items-center justify-center shrink-0">
                      <svg
                        className="w-5 h-5 text-champagne-dark"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-brand-text">
                        免费微信咨询
                      </h3>
                      <p className="text-sm text-brand-text-light mt-1">
                        添加客服微信，描述你的变美想法，获取初步方向建议
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-5 border border-champagne-dark/10">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-rose-soft to-rose-soft-light flex items-center justify-center shrink-0">
                      <svg
                        className="w-5 h-5 text-rose-deep"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-brand-text">
                        一对一深度咨询
                      </h3>
                      <p className="text-sm text-brand-text-light mt-1">
                        专属顾问详细分析你的需求，提供项目对比报告和机构推荐
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-5 border border-champagne-dark/10">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-rose-deep/20 to-champagne flex items-center justify-center shrink-0">
                      <svg
                        className="w-5 h-5 text-rose-deep"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-brand-text">
                        医美陪诊服务
                      </h3>
                      <p className="text-sm text-brand-text-light mt-1">
                        顾问陪你到店面诊，全程帮你记录、对比、把关，不花冤枉钱
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* FAQ */}
            <div>
              <h2 className="text-xl font-bold text-brand-text mb-6">
                常见问题
              </h2>
              <div className="space-y-3">
                {faqs.map((faq, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-xl border border-champagne-dark/10 overflow-hidden"
                  >
                    <button
                      className="w-full text-left px-5 py-4 flex items-center justify-between"
                      onClick={() =>
                        setOpenIndex(openIndex === i ? null : i)
                      }
                    >
                      <span className="font-medium text-brand-text text-sm">
                        {faq.q}
                      </span>
                      <svg
                        className={`w-5 h-5 text-warm-gray shrink-0 transition-transform ${openIndex === i ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {openIndex === i && (
                      <div className="px-5 pb-4">
                        <p className="text-sm text-brand-text-light leading-relaxed">
                          {faq.a}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: WeChat Contact */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <WechatContact />
          </div>
        </div>
      </div>
    </div>
  );
}
