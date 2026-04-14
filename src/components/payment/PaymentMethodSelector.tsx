"use client";

import { PaymentMethod } from "@/types/payment";

interface PaymentMethodSelectorProps {
  selected: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
}

const methods: { value: PaymentMethod; label: string; color: string; icon: string }[] = [
  {
    value: "wechat",
    label: "微信支付",
    color: "border-[#07C160] bg-[#07C160]/5",
    icon: "M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348z",
  },
  {
    value: "alipay",
    label: "支付宝",
    color: "border-[#1677FF] bg-[#1677FF]/5",
    icon: "M21.422 14.989c-1.604-.742-3.505-1.638-5.053-2.404.478-.984.876-2.07 1.136-3.236h-4.07V7.847h5.065V6.892h-5.065V4.006h-1.82s-.04.283-.124.57c-.21.718-.673 1.075-1.213 1.075H8.39v1.24h3.975v1.503H7.75v.955h7.392c-.218.876-.53 1.686-.907 2.405A38.67 38.67 0 008 9.967l-.856 1.2s3.21 1.663 5.634 3.474c-1.636 2.153-4.003 3.62-7.028 4.272l.677 1.412c3.461-.788 6.162-2.545 8.003-5.06 1.87 1.464 3.395 3.014 3.395 3.014l1.115-1.263s-1.357-1.31-3.084-2.698c.52-.817.96-1.71 1.309-2.668 2.191 1.077 3.816 1.928 3.816 1.928l.44-1.59z",
  },
];

export default function PaymentMethodSelector({
  selected,
  onChange,
}: PaymentMethodSelectorProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-brand-text">选择支付方式</h3>
      {methods.map((method) => (
        <button
          key={method.value}
          onClick={() => onChange(method.value)}
          className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-colors ${
            selected === method.value
              ? method.color
              : "border-champagne-dark/20 bg-white"
          }`}
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path d={method.icon} />
          </svg>
          <span className="font-medium text-brand-text">{method.label}</span>
          {selected === method.value && (
            <svg
              className="w-5 h-5 ml-auto text-green-500"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
          )}
        </button>
      ))}
    </div>
  );
}
