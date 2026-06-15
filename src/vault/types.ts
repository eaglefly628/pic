import type { Dataset } from "../data/types";

export interface PasswordItem {
  id: string;
  title: string;
  url?: string;
  username?: string;
  password: string;
  category?: string;
  notes?: string;
  favorite?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface InfoField {
  label: string;
  value: string;
  secret?: boolean;
}

export interface InfoItem {
  id: string;
  title: string;
  type: string; // 身份证 / 银行卡 / WiFi / 紧急联系人 ...
  owner?: string;
  fields: InfoField[];
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Settings {
  autoLockMin: number; // 自动锁定（分钟），0 表示不自动锁定
  clipboardClearSec: number; // 复制后清空剪贴板（秒）
}

/** 解锁后内存中的完整金库数据 */
export interface VaultData {
  dataset: Dataset; // 资金账户与历史快照
  passwords: PasswordItem[];
  infos: InfoItem[];
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  autoLockMin: 5,
  clipboardClearSec: 30,
};
