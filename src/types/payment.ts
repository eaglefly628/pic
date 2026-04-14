export type PaymentMethod = "wechat" | "alipay";

export interface Service {
  id: string;
  name: string;
  description: string;
  features: string[];
  price: number;
  originalPrice?: number;
  tag?: string;
}

export interface Order {
  id: string;
  serviceId: string;
  serviceName: string;
  amount: number;
  paymentMethod: PaymentMethod;
  status: "pending" | "paid" | "failed" | "cancelled";
  createdAt: string;
}
