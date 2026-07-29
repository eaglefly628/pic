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

/** 某个月份的预测净值快照。该月还没有真实记录时，每次都会用最新假设覆写；
 *  一旦这个月有了真实记录，就不再被写入——最后一次的值被"冻结"下来，
 *  留作虚线，跟后来的真实值对比参考。 */
export interface ForecastPoint {
  forMonth: string;   // "YY/MM"，预测目标月份（与图表月份标签同格式）
  predictedNet: number;
  updatedAt: number;
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
  /** 资产预测的历史快照（按月冻结），用于预测 vs 现实的对比虚线 */
  forecastHistory?: ForecastPoint[];
}

export const DEFAULT_SETTINGS: Settings = {
  autoLockMin: 5,
  clipboardClearSec: 30,
};
