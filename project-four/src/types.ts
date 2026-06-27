// 「男主的开发世界」数据模型：个人工作台（任务 / 笔记 / 代码片段 / 书签）。
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
  body: string;        // 纯文本 / Markdown
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

export interface DevSettings {
  autoLockMin: number; // 闲置自动锁定（分钟），0 = 不自动锁
}

// 开发密钥库：API key / 服务器 / 数据库 / 环境变量
export type SecretKind = "api" | "server" | "db" | "env" | "other";
export interface SecretEntry {
  label: string;
  value: string;
  secret?: boolean;   // 是否打码（默认值字段打码）
}
export interface DevSecret {
  id: string;
  title: string;
  kind: SecretKind;
  entries: SecretEntry[];
  tags?: string[];
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

// ── 账户 · 余额：工作账户（订阅/预付额度）+ 生活储值卡 ──────────────
export type AccountDomain = "work" | "life";   // 工作账户 / 生活储值卡
export type AccountKind = "subscription" | "prepaid"; // 订阅型 / 预付余额型
export type AccountCycle = "month" | "year";   // 订阅续费周期

export interface Account {
  id: string;
  domain: AccountDomain;
  name: string;          // Claude Code / 阿里云 / 那家川菜馆
  category?: string;     // AI 模型 / 云服务 / 餐饮 …（自由文本，带建议）
  kind: AccountKind;
  currency: string;      // ¥ / $ / € …
  balance?: number;      // 当前余额
  balanceAt?: number;    // 余额更新时间
  lowBalance?: number;   // 预付：低余额预警阈值
  // 订阅型
  cycle?: AccountCycle;  // 月 / 年
  price?: number;        // 每期费用
  renewAt?: string;      // YYYY-MM-DD 下次续费日
  // 通用 / 生活卡
  expireAt?: string;     // YYYY-MM-DD 有效期 / 到期日
  // 账户信息
  login?: string;        // 登录账号 / 卡号 / 绑定手机
  secret?: string;       // 密码 / Key（打码 + 复制）
  url?: string;          // 控制台 / 官网链接（工作）
  phone?: string;        // 商家电话（生活）
  note?: string;
  createdAt: number;
  updatedAt: number;
}

/** 解锁后内存中的完整数据 */
export interface DevData {
  tasks: DevTask[];
  notes: DevNote[];
  snippets: DevSnippet[];
  links: DevLink[];
  collections: CollectionDef[];   // 生活：自定义集合（数据格式由用户自己定）
  lifeItems: LifeItem[];          // 生活：各集合下的条目
  secrets: DevSecret[];           // 开发密钥库
  accounts: Account[];            // 账户 · 余额（工作账户 + 生活储值卡）
  company: CompanyInfo;           // 公司资料（单家）
  invoices: Invoice[];            // 公司：发票 / 报销记录
  settings: DevSettings;
  updatedAt: number;
}

// ── 公司 · 发票报销 ───────────────────────────────────────────
/** 公司基本资料（一家公司，自由填） */
export interface CompanyInfo {
  name?: string;         // 公司名称
  taxId?: string;        // 统一社会信用代码 / 税号
  legalPerson?: string;  // 法人
  address?: string;      // 注册地址
  bank?: string;         // 开户行
  bankAccount?: string;  // 银行账号
  phone?: string;        // 联系电话
  note?: string;
}

/** 一张发票：核心是图片，按月份归档、按类别归类 */
export interface Invoice {
  id: string;
  date: string;       // YYYY-MM-DD 归属日期（默认上传当天），用于按月归档
  photo?: string;     // 发票图片（压缩后的 data URL，随保险库加密）—— 核心
  category?: string;  // 归类：差旅交通 / 餐饮 / 办公用品 …
  note?: string;      // 备注 / 简短标题（选填）
  createdAt: number;
  updatedAt: number;
}

// ── 生活 · 通用「集合 + 字段 + 条目」数据格式 ──────────────────
export type FieldType =
  | "text" | "longtext" | "number" | "money" | "rating"
  | "date" | "select" | "tags" | "phone" | "url" | "location" | "bool" | "email";

export interface FieldDef {
  id: string;
  label: string;
  type: FieldType;
  secret?: boolean;     // 私密：列表/详情里打码显示
  unit?: string;        // number / money 的单位（如 ¥、kg）
  options?: string[];   // select 的可选项
}

export interface CollectionDef {
  id: string;
  name: string;
  emoji: string;
  color: string;
  fields: FieldDef[];   // 这个集合的字段模板 = 它的数据格式
  createdAt: number;
  updatedAt: number;
}

/** 字段取值：按类型分别为 string / number / boolean / string[] */
export type FieldValue = string | number | boolean | string[] | undefined;

export interface LifeItem {
  id: string;
  collectionId: string;
  title: string;
  favorite?: boolean;
  rating?: number;                    // 0–5
  tags?: string[];
  notes?: string;
  values: Record<string, FieldValue>; // fieldId → 值
  createdAt: number;
  updatedAt: number;
}
