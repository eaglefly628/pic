export type ItemType = "login" | "card" | "note" | "info";

export interface CustomField {
  label: string;
  value: string;
  secret?: boolean; // 是否默认隐藏（如卡号、证件号）
}

export interface VaultItem {
  id: string;
  type: ItemType;
  title: string;
  favorite?: boolean;
  // 登录
  url?: string;
  username?: string;
  password?: string;
  totp?: string; // 2FA 密钥（base32）
  // 银行卡
  cardNumber?: string;
  cardholder?: string;
  expiry?: string;
  cvv?: string;
  pin?: string;
  // 家庭信息：自定义字段
  fields?: CustomField[];
  // 通用
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface VaultSettings {
  autoLockMin: number; // 闲置自动锁定（分钟），0=不自动锁
}

export interface VaultData {
  items: VaultItem[];
  settings: VaultSettings;
  updatedAt: number;
}

export const TYPE_LABEL: Record<ItemType, string> = {
  login: "登录",
  card: "银行卡",
  note: "安全笔记",
  info: "家庭信息",
};
