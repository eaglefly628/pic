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

export interface IncomeItem {
  id: string;
  name: string;
  amount: number;
  period: "month" | "year";
  category?: string;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ExpenseItem {
  id: string;
  name: string;
  amount: number;
  period: "month" | "year" | "once";
  date?: string; // 一次性开销的日期
  category?: string;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Settings {
  autoLockMin: number; // 自动锁定（分钟），0 表示不自动锁定
  clipboardClearSec: number; // 复制后清空剪贴板（秒）
}

/** 行情数据源：twelvedata 需免费 key；frankfurter(汇率)、coingecko(加密) 免 key */
export type MarketSource = "twelvedata" | "frankfurter" | "coingecko";
export type MarketCategory = "index" | "forex" | "commodity" | "bond" | "stock" | "crypto";
export interface WatchItem {
  id: string;
  symbol: string;   // 数据源使用的代码
  name: string;     // 显示名
  category: MarketCategory;
  source: MarketSource;
}
export interface MarketConfig {
  apiKey?: string;     // Twelve Data 免费 key（解锁指数/个股/商品/美债）
  refreshSec: number;  // 自动刷新间隔（秒）
  watch: WatchItem[];
}

/** 「开发世界」：个人工作空间（任务 / 笔记 / 代码片段 / 书签） */
export type TaskStatus = "todo" | "doing" | "done";
export type TaskPriority = "low" | "med" | "high";
export interface DevTask {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due?: string;        // YYYY-MM-DD
  tags?: string[];
  note?: string;
  createdAt: number;
  updatedAt: number;
}
export interface DevNote {
  id: string;
  title: string;
  body: string;        // 纯文本/Markdown
  category?: string;
  tags?: string[];
  pinned?: boolean;
  createdAt: number;
  updatedAt: number;
}
export interface DevSnippet {
  id: string;
  title: string;
  lang?: string;
  code: string;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
}
export interface DevLink {
  id: string;
  title: string;
  url: string;
  category?: string;
  createdAt: number;
}
export interface DevWorld {
  tasks: DevTask[];
  notes: DevNote[];
  snippets: DevSnippet[];
  links: DevLink[];
}

/** 解锁后内存中的完整金库数据 */
export interface VaultData {
  dataset: Dataset; // 资金账户与历史快照
  passwords: PasswordItem[];
  infos: InfoItem[];
  settings: Settings;
  /** 「私房钱」独立账户（隐藏入口），结构与主账户一致 */
  secret?: Dataset;
  /** 收入来源 */
  incomes?: IncomeItem[];
  /** 未来预期开销 */
  expenses?: ExpenseItem[];
  /** 财经行情：自选清单与 API key */
  markets?: MarketConfig;
  /** 开发世界：个人工作空间 */
  devWorld?: DevWorld;
}

export const DEFAULT_SETTINGS: Settings = {
  autoLockMin: 5,
  clipboardClearSec: 30,
};
