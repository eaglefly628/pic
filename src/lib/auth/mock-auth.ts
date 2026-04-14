import { User, ConsultationRecord, PurchasedService } from "@/types/user";

const STORAGE_KEY = "tangxi_user";

export const mockUser: User = {
  id: "u_001",
  nickname: "爱美的小鹿",
  avatar: "",
  wechatOpenId: "mock_openid_12345",
  createdAt: "2026-03-15",
};

export const mockConsultations: ConsultationRecord[] = [
  {
    id: "c_001",
    date: "2026-04-10",
    topic: "面部轮廓填充咨询",
    status: "completed",
    summary: "建议先做皮肤检测，再确定填充方案",
  },
  {
    id: "c_002",
    date: "2026-04-12",
    topic: "光子嫩肤项目了解",
    status: "completed",
    summary: "适合油皮，建议每月一次，连续5次",
  },
  {
    id: "c_003",
    date: "2026-04-15",
    topic: "抗衰项目对比",
    status: "pending",
  },
];

export const mockPurchases: PurchasedService[] = [
  {
    id: "p_001",
    serviceName: "一对一专家咨询服务",
    purchaseDate: "2026-04-08",
    status: "used",
    orderId: "ORD20260408001",
  },
  {
    id: "p_002",
    serviceName: "医美陪诊卡",
    purchaseDate: "2026-04-12",
    status: "active",
    orderId: "ORD20260412002",
  },
];

export function getUser(): User | null {
  if (typeof window === "undefined") return null;
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : null;
}

export function login(): User {
  if (typeof window === "undefined") return mockUser;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(mockUser));
  return mockUser;
}

export function logout(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
