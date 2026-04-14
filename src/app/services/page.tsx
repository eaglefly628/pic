import Link from "next/link";
import { services } from "@/lib/payment/mock-payment";

export default function ServicesPage() {
  return (
    <div className="pb-16">
      {/* Header */}
      <section className="bg-gradient-to-br from-champagne-light to-rose-soft-light py-16">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-brand-text mb-3">
            服务项目
          </h1>
          <p className="text-brand-text-light max-w-lg mx-auto">
            糖糖和小希为你精心设计的专属服务，让变美之路不再迷茫
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {services.map((service) => (
            <div
              key={service.id}
              className="bg-white rounded-2xl overflow-hidden shadow-sm border border-champagne-dark/10 hover:shadow-lg transition-shadow flex flex-col"
            >
              {/* Card Header with Gradient */}
              <div className="bg-gradient-to-br from-rose-soft-light to-champagne-light p-6 relative">
                {service.tag && (
                  <span className="absolute top-4 right-4 px-3 py-1 bg-rose-deep text-white text-xs rounded-full font-medium">
                    {service.tag}
                  </span>
                )}
                <h2 className="text-xl font-bold text-brand-text mb-2">
                  {service.name}
                </h2>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-rose-deep">
                    ¥{service.price}
                  </span>
                  {service.originalPrice && (
                    <span className="text-sm text-warm-gray line-through">
                      ¥{service.originalPrice}
                    </span>
                  )}
                </div>
              </div>

              {/* Card Body */}
              <div className="p-6 flex-1 flex flex-col">
                <p className="text-sm text-brand-text-light mb-4 leading-relaxed">
                  {service.description}
                </p>

                <ul className="space-y-2.5 mb-6 flex-1">
                  {service.features.map((feature, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-brand-text"
                    >
                      <svg
                        className="w-5 h-5 text-rose-deep shrink-0"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link
                  href={`/payment?serviceId=${service.id}`}
                  className="block w-full text-center py-3 bg-gradient-to-r from-rose-deep to-rose-deep-dark text-white rounded-full font-medium hover:shadow-lg transition-shadow"
                >
                  立即购买
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Trust Badges */}
        <div className="mt-12 grid grid-cols-3 gap-4 text-center">
          <div className="bg-white rounded-xl p-4 border border-champagne-dark/10">
            <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-champagne-light flex items-center justify-center">
              <svg
                className="w-5 h-5 text-champagne-dark"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <p className="text-xs text-brand-text font-medium">安全支付</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-champagne-dark/10">
            <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-rose-soft-light flex items-center justify-center">
              <svg
                className="w-5 h-5 text-rose-deep"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <p className="text-xs text-brand-text font-medium">不满意退款</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-champagne-dark/10">
            <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-champagne-light flex items-center justify-center">
              <svg
                className="w-5 h-5 text-champagne-dark"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-xs text-brand-text font-medium">24h 内响应</p>
          </div>
        </div>
      </div>
    </div>
  );
}
