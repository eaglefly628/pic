// 导入框架入口：注册表 + 文件读取 + 分派解析。
//
// 扩展新格式只需两步：
//   1) 在 ./importers 写一个实现 Importer 接口的对象；
//   2) import 进来并加入下面的 IMPORTERS 数组。
// UI、文件读取、预览、写入都会自动适配，无需改动其它代码。
import type { ImportFile, Importer, ParsedNote } from "./types";
import { markdownImporter } from "./markdown";
import { htmlImporter } from "./html";
import { enexImporter } from "./enex";
import { jsonImporter } from "./json";
import { csvImporter } from "./csv";
import { zipImporter } from "./zip";

export type { ParsedNote, Importer, ImportFile } from "./types";

export const IMPORTERS: Importer[] = [
  markdownImporter, // Obsidian / Bear / Logseq / Joplin / Notion(.md) / Typora …
  htmlImporter,     // 网页剪藏 / OneNote 导出 / Apple Notes 导出
  enexImporter,     // Evernote
  jsonImporter,     // Google Keep / Standard Notes / 通用 JSON
  csvImporter,      // Notion 数据库 / Excel CSV
  zipImporter,      // Notion / Obsidian / Joplin / Takeout 整库
];

/** 当前支持的全部扩展名（用于 <input accept>） */
export const ACCEPT = "." + [...new Set(IMPORTERS.flatMap((i) => i.exts))].join(",.");

const td = new TextDecoder("utf-8");
const TEXTY = /^(md|markdown|mdown|mkd|txt|text|html|htm|xhtml|enex|json|csv|tsv)$/;

export async function readImportFile(file: File): Promise<ImportFile> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const name = file.name.replace(/\.[^.]+$/, "");
  const text = TEXTY.test(ext) ? td.decode(bytes) : "";
  return { name, ext, text, bytes };
}

export function importerFor(f: ImportFile): Importer | undefined {
  return IMPORTERS.find((i) => i.exts.includes(f.ext) && (!i.detect || i.detect(f)))
    || IMPORTERS.find((i) => i.exts.includes(f.ext))
    || IMPORTERS.find((i) => i.detect?.(f));
}

export interface FileResult {
  fileName: string;
  importer?: Importer;
  notes: ParsedNote[];
  error?: string;
}

/** 解析一批文件，返回每个文件的结果（供预览） */
export async function parseFiles(files: File[]): Promise<FileResult[]> {
  const results: FileResult[] = [];
  for (const file of files) {
    try {
      const f = await readImportFile(file);
      const importer = importerFor(f);
      if (!importer) { results.push({ fileName: file.name, notes: [], error: "暂不支持该格式" }); continue; }
      const notes = (await importer.parse(f)).filter((n) => (n.title && n.title.trim()) || (n.body && n.body.trim()));
      results.push({ fileName: file.name, importer, notes });
    } catch (e) {
      results.push({ fileName: file.name, notes: [], error: e instanceof Error ? e.message : "解析失败" });
    }
  }
  return results;
}
