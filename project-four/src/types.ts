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
  settings: DevSettings;
  updatedAt: number;
}
