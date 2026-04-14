import { Service } from "@/types/payment";

export default function OrderSummary({ service }: { service: Service }) {
  return (
    <div className="bg-white rounded-xl p-5 border border-champagne-dark/10">
      <h3 className="text-sm font-medium text-brand-text mb-4">订单信息</h3>

      <div className="space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <p className="font-medium text-brand-text">{service.name}</p>
            {service.tag && (
              <span className="inline-block mt-1 px-2 py-0.5 bg-rose-soft text-rose-deep text-xs rounded-full">
                {service.tag}
              </span>
            )}
          </div>
        </div>

        <div className="border-t border-champagne-dark/10 pt-3">
          <ul className="space-y-1.5">
            {service.features.map((feature, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-brand-text-light">
                <svg
                  className="w-4 h-4 text-green-500 shrink-0 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-champagne-dark/10 pt-3 flex justify-between items-baseline">
          <span className="text-sm text-brand-text-light">应付金额</span>
          <div className="text-right">
            <span className="text-2xl font-bold text-rose-deep">
              ¥{service.price}
            </span>
            {service.originalPrice && (
              <span className="text-sm text-warm-gray line-through ml-2">
                ¥{service.originalPrice}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
