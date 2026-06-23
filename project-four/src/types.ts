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

/** 解锁后内存中的完整数据 */
export interface DevData {
  tasks: DevTask[];
  notes: DevNote[];
  snippets: DevSnippet[];
  links: DevLink[];
  collections: CollectionDef[];   // 生活：自定义集合（数据格式由用户自己定）
  lifeItems: LifeItem[];          // 生活：各集合下的条目
  settings: DevSettings;
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
