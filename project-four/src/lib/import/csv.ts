// CSV / 表格导出（Notion 数据库、Excel 另存为 CSV 等）。
import type { ImportFile, Importer, ParsedNote } from "./types";

// 最小 RFC4180 解析（支持引号、转义、字段内换行）
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else if (c === "\r") { /* skip */ }
    else cur += c;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const TITLE_KEYS = ["title", "标题", "name", "名称", "主题"];
const BODY_KEYS = ["content", "body", "note", "notes", "正文", "内容", "description", "备注"];

export const csvImporter: Importer = {
  id: "csv",
  label: "CSV / 表格",
  exts: ["csv", "tsv"],
  parse(f: ImportFile): ParsedNote[] {
    const rows = parseCsv(f.ext === "tsv" ? f.text.replace(/\t/g, ",") : f.text);
    if (!rows.length) return [];
    const header = rows[0].map((h) => h.toLowerCase().trim());
    const hasHeader = header.some((h) => [...TITLE_KEYS, ...BODY_KEYS].includes(h));
    const ti = hasHeader ? header.findIndex((h) => TITLE_KEYS.includes(h)) : 0;
    const bi = hasHeader ? header.findIndex((h) => BODY_KEYS.includes(h)) : -1;
    const tagi = hasHeader ? header.findIndex((h) => ["tags", "标签", "labels"].includes(h)) : -1;
    return rows.slice(hasHeader ? 1 : 0).map((r) => {
      const title = (ti >= 0 ? r[ti] : r[0])?.trim() || "未命名";
      const body = bi >= 0 ? (r[bi] ?? "") : (hasHeader ? r.filter((_, i) => i !== ti).join("\n") : r.slice(1).join("\n"));
      const tags = tagi >= 0 && r[tagi] ? r[tagi].split(/[,，;；\s]+/).filter(Boolean) : undefined;
      return { title, body: body.trim(), tags, source: "CSV" };
    });
  },
};
