// 笔记导入框架 —— 统一接口。
// 新增一个来源/格式：在 ./importers 写一个 Importer 对象，到 ./index.ts 的 IMPORTERS 里加一行即可。
export interface ParsedNote {
  title: string;
  body: string;          // 纯文本 / Markdown
  tags?: string[];
  category?: string;
  createdAt?: number;
  updatedAt?: number;
  source?: string;       // 来源标记（Markdown / Evernote / Notion …）
}

export interface ImportFile {
  name: string;          // 去掉扩展名的文件名
  ext: string;           // 小写扩展名（不含点）
  text: string;          // 解码后的文本（zip 等二进制为空）
  bytes: Uint8Array;     // 原始字节（zip / 二进制用）
}

export interface Importer {
  id: string;
  label: string;
  exts: string[];                                   // 处理的扩展名
  detect?: (f: ImportFile) => boolean;              // 可选：按内容嗅探
  parse: (f: ImportFile) => Promise<ParsedNote[]> | ParsedNote[];
}
