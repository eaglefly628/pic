import { NextResponse } from "next/server";
import { services } from "@/lib/payment/mock-payment";
import { PaymentMethod } from "@/types/payment";

// Mock order creation endpoint
// In production, this would:
// 1. Validate user session
// 2. Create order in database
// 3. Call WeChat/Alipay API to create payment
// 4. Return payment parameters for frontend
export async function POST(request: Request) {
  const body = await request.json();
  const { serviceId, paymentMethod } = body as {
    serviceId: string;
    paymentMethod: PaymentMethod;
  };

  const service = services.find((s) => s.id === serviceId);
  if (!service) {
    return NextResponse.json({ error: "服务不存在" }, { status: 404 });
  }

  if (!["wechat", "alipay"].includes(paymentMethod)) {
    return NextResponse.json({ error: "不支持的支付方式" }, { status: 400 });
  }

  // Mock order creation
  const orderId = `ORD${Date.now()}`;

  return NextResponse.json({
    success: true,
    order: {
      id: orderId,
      serviceId: service.id,
      serviceName: service.name,
      amount: service.price,
      paymentMethod,
      status: "pending",
      createdAt: new Date().toISOString(),
    },
    // In production, these would be real payment parameters
    paymentParams: {
      method: paymentMethod,
      redirectUrl:
        paymentMethod === "wechat"
          ? "weixin://wap/pay?prepayid=mock_prepay_id"
          : "alipays://platformapi/startapp?appId=mock_app_id",
    },
  });
}
