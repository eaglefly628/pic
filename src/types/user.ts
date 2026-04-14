export interface User {
  id: string;
  nickname: string;
  avatar: string;
  wechatOpenId: string;
  createdAt: string;
}

export interface ConsultationRecord {
  id: string;
  date: string;
  topic: string;
  status: "pending" | "completed" | "cancelled";
  summary?: string;
}

export interface PurchasedService {
  id: string;
  serviceName: string;
  purchaseDate: string;
  status: "active" | "used" | "expired";
  orderId: string;
}
