import { Service, Order, PaymentMethod } from "@/types/payment";

export const services: Service[] = [
  {
    id: "svc_001",
    name: "一对一专家咨询服务",
    description:
      "专属顾问为你详细分析需求，提供项目科普、机构对比报告和个性化变美方案。全程微信语音/视频沟通，不限次数咨询。",
    features: [
      "60分钟深度语音/视频咨询",
      "个性化项目对比分析报告",
      "3家机构口碑详细调研",
      "术后7天跟踪关怀",
      "无限次微信文字答疑（30天内）",
    ],
    price: 299,
    originalPrice: 499,
    tag: "人气之选",
  },
  {
    id: "svc_002",
    name: "医美陪诊卡",
    description:
      "顾问全程陪同到店面诊，帮你记录医生建议、对比方案、审核合同条款，确保每一分钱都花在刀刃上。",
    features: [
      "全程到店陪同面诊",
      "实时记录医生方案",
      "多家机构对比分析",
      "合同条款审核把关",
      "术后3次电话回访",
      "赠送一对一咨询服务",
    ],
    price: 599,
    originalPrice: 899,
    tag: "超值套餐",
  },
];

let orderCounter = 1;

export function createMockOrder(
  serviceId: string,
  paymentMethod: PaymentMethod
): Order {
  const service = services.find((s) => s.id === serviceId);
  const orderId = `ORD${Date.now()}${String(orderCounter++).padStart(3, "0")}`;

  return {
    id: orderId,
    serviceId,
    serviceName: service?.name ?? "未知服务",
    amount: service?.price ?? 0,
    paymentMethod,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
}
