"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import PaymentMethodSelector from "@/components/payment/PaymentMethodSelector";
import OrderSummary from "@/components/payment/OrderSummary";
import { services, createMockOrder } from "@/lib/payment/mock-payment";
import { PaymentMethod, Order, Service } from "@/types/payment";
import { brand } from "@/config/brand";

function PaymentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const serviceId = searchParams.get("serviceId");

  const [service, setService] = useState<Service | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("wechat");
  const [processing, setProcessing] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (serviceId) {
      const found = services.find((s) => s.id === serviceId);
      setService(found ?? null);
    }
  }, [serviceId]);

  const handlePayment = () => {
    if (!service) return;
    setProcessing(true);

    // Simulate payment process
    const newOrder = createMockOrder(service.id, paymentMethod);
    setTimeout(() => {
      setOrder({ ...newOrder, status: "paid" });
      setProcessing(false);
    }, 2000);
  };

  // Payment Success
  if (order?.status === "paid") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
            <svg
              className="w-10 h-10 text-green-500"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-brand-text mb-2">
            支付成功
          </h2>
          <p className="text-sm text-brand-text-light mb-1">
            订单号：{order.id}
          </p>
          <p className="text-sm text-brand-text-light mb-6">
            服务：{order.serviceName}
          </p>
          <p className="text-xs text-warm-gray mb-6">
            我们的顾问将在24小时内通过微信联系您，请留意消息通知。
          </p>
          <div className="space-y-3">
            <Link
              href="/profile"
              className="block w-full py-3 bg-gradient-to-r from-rose-deep to-rose-deep-dark text-white rounded-full font-medium"
            >
              查看我的订单
            </Link>
            <Link
              href="/"
              className="block w-full py-3 text-brand-text-light text-sm"
            >
              返回首页
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // No service selected
  if (!service) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-brand-text-light mb-4">请先选择一个服务</p>
          <Link
            href="/services"
            className="px-6 py-2 bg-rose-deep text-white rounded-full text-sm"
          >
            查看服务项目
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-16">
      <section className="bg-gradient-to-br from-champagne-light to-rose-soft-light py-12">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-brand-text">
            确认支付
          </h1>
        </div>
      </section>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <OrderSummary service={service} />

        <PaymentMethodSelector
          selected={paymentMethod}
          onChange={setPaymentMethod}
        />

        <button
          onClick={handlePayment}
          disabled={processing}
          className="w-full py-4 bg-gradient-to-r from-rose-deep to-rose-deep-dark text-white rounded-full font-medium text-lg hover:shadow-xl transition-shadow disabled:opacity-50"
        >
          {processing
            ? "支付处理中..."
            : `确认支付 ¥${service.price}`}
        </button>

        <p className="text-xs text-warm-gray text-center">
          支付即表示您同意{brand.name}的服务条款。
          如有任何问题，请联系微信客服。
        </p>
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          <p className="text-brand-text-light">加载中...</p>
        </div>
      }
    >
      <PaymentContent />
    </Suspense>
  );
}
