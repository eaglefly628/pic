import Link from "next/link";
import { brand } from "@/config/brand";

const featureCards = [
  {
    title: "小希避雷清单",
    description:
      "想做热玛吉？先让小希帮你看看你的皮肤厚度适不适合。输入你的坐标，实时调取当地机构红黑榜。",
    href: "/cases",
    gradient: "from-rose-soft to-rose-soft-light",
    icon: (
      <svg
        className="w-8 h-8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        viewBox="0 0 24 24"
      >
        <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    title: "糖糖的审美提案",
    description:
      '拒绝网红脸。糖糖结合面部分析，为你定制专属的\u201C高级感\u201D变美方案，不走弯路。',
    href: "/services",
    gradient: "from-champagne to-champagne-light",
    icon: (
      <svg
        className="w-8 h-8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        viewBox="0 0 24 24"
      >
        <path d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
      </svg>
    ),
  },
  {
    title: "一键直达真实",
    description:
      "不再被精修图欺骗。实时接入抖音/小红书真实日记，看术后第7天到底长什么样。",
    href: "/cases",
    gradient: "from-rose-deep/20 to-champagne",
    icon: (
      <svg
        className="w-8 h-8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        viewBox="0 0 24 24"
      >
        <path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export default function Home() {
  return (
    <div className="pb-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-champagne-light via-rose-soft-light to-champagne py-20 md:py-32">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-10 left-10 w-40 h-40 bg-rose-soft rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-56 h-56 bg-champagne rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-rose-deep/10 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-6xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-brand-text mb-4">
            <span className="bg-gradient-to-r from-rose-deep to-champagne-dark bg-clip-text text-transparent">
              {brand.name}
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-brand-text-light mb-2">
            {brand.tagline}
          </p>
          <p className="text-base text-brand-text-light/80 max-w-md mx-auto mb-8">
            {brand.description}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/consultation"
              className="px-8 py-3 bg-gradient-to-r from-rose-deep to-rose-deep-dark text-white rounded-full font-medium hover:shadow-lg transition-shadow"
            >
              立即咨询
            </Link>
            <Link
              href="/cases"
              className="px-8 py-3 bg-white/80 text-brand-text rounded-full font-medium hover:bg-white transition-colors border border-champagne-dark/30"
            >
              查看真实案例
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Cards */}
      <section className="max-w-6xl mx-auto px-4 -mt-12 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {featureCards.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className="group bg-white rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all border border-champagne-dark/10 hover:-translate-y-1"
            >
              <div
                className={`w-14 h-14 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center text-rose-deep mb-4`}
              >
                {card.icon}
              </div>
              <h3 className="text-lg font-semibold text-brand-text mb-2 group-hover:text-rose-deep transition-colors">
                {card.title}
              </h3>
              <p className="text-sm text-brand-text-light leading-relaxed">
                {card.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Brand Story */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <h2 className="text-2xl md:text-3xl font-bold text-center text-brand-text mb-12">
          认识我们
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Tang */}
          <div className="bg-gradient-to-br from-champagne-light to-white rounded-2xl p-8 border border-champagne-dark/10">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-champagne to-champagne-dark flex items-center justify-center mb-4">
              <span className="text-3xl font-bold text-white">糖</span>
            </div>
            <h3 className="text-xl font-bold text-brand-text mb-1">
              {brand.personas.tang.name}
              <span className="text-sm font-normal text-brand-text-light ml-2">
                {brand.personas.tang.role}
              </span>
            </h3>
            <p className="text-sm text-brand-text-light leading-relaxed mt-3">
              {brand.personas.tang.description}
            </p>
          </div>

          {/* Xi */}
          <div className="bg-gradient-to-br from-rose-soft-light to-white rounded-2xl p-8 border border-rose-soft/30">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-rose-soft to-rose-deep flex items-center justify-center mb-4">
              <span className="text-3xl font-bold text-white">希</span>
            </div>
            <h3 className="text-xl font-bold text-brand-text mb-1">
              {brand.personas.xi.name}
              <span className="text-sm font-normal text-brand-text-light ml-2">
                {brand.personas.xi.role}
              </span>
            </h3>
            <p className="text-sm text-brand-text-light leading-relaxed mt-3">
              {brand.personas.xi.description}
            </p>
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section className="bg-gradient-to-r from-champagne-light to-rose-soft-light py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-brand-text mb-10">
            我们的理念
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {brand.coreValues.map((value) => (
              <div
                key={value.label}
                className="bg-white/60 backdrop-blur-sm rounded-xl p-6 text-center"
              >
                <h3 className="text-xl font-bold text-rose-deep mb-2">
                  {value.label}
                </h3>
                <p className="text-sm text-brand-text-light">
                  {value.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-brand-text mb-4">
          准备好开始了吗？
        </h2>
        <p className="text-brand-text-light mb-8 max-w-md mx-auto">
          添加糖糖和小希的专属顾问微信，获取免费初步咨询
        </p>
        <Link
          href="/consultation"
          className="inline-block px-10 py-4 bg-gradient-to-r from-rose-deep to-rose-deep-dark text-white rounded-full font-medium text-lg hover:shadow-xl transition-shadow"
        >
          免费咨询
        </Link>
      </section>
    </div>
  );
}
