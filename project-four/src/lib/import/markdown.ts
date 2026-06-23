// Markdown / 纯文本 —— 覆盖 Obsidian、Bear、Logseq、Joplin、Notion(单文件 .md)、Typora 等。
import type { ImportFile, Importer, ParsedNote } from "./types";

function extractTags(text: string): string[] | undefined {
  const tags = new Set<string>();
  const add = (s: string) => s.split(/[,，;；\s]+/).forEach((t) => { const x = t.replace(/[[\]"'#]/g, "").trim(); if (x) tags.add(x); });
  // 优先 YAML frontmatter：tags: [a, b] 或 tags: a b
  const fm = text.match(/^---\n([\s\S]*?)\n---/);
  if (fm) {
    const ym = fm[1].match(/tags\s*:\s*\[([^\]]*)\]/i) || fm[1].match(/tags\s*:\s*(.+)/i);
    if (ym) add(ym[1]);
  } else {
    // 否则找元数据行：Tags: a, b / 标签：a b
    const m = text.match(/^\s*(tags|标签|关键词)\s*[:：]\s*(.+)$/im);
    if (m) add(m[2]);
  }
  return tags.size ? [...tags] : undefined;
}

export const markdownImporter: Importer = {
  id: "markdown",
  label: "Markdown / 纯文本",
  exts: ["md", "markdown", "mdown", "mkd", "txt", "text"],
  parse(f: ImportFile): ParsedNote[] {
    let text = f.text;
    // 去掉 YAML frontmatter 作为正文（标签已单独提取）
    const tags = extractTags(text);
    const body0 = text.replace(/^---\n[\s\S]*?\n---\n?/, "");
    const lines = body0.split(/\r?\n/);
    const h = lines.find((l) => /^#{1,3}\s+\S/.test(l));
    let title: string;
    let body: string;
    if (h) {
      title = h.replace(/^#{1,3}\s+/, "").trim();
      body = body0.replace(h, "").replace(/^\s+/, "");
    } else {
      const fl = lines.find((l) => l.trim());
      title = fl ? fl.trim().slice(0, 80) : f.name;
      body = body0.trim();
    }
    return [{ title: title || f.name, body: body.trim(), tags, source: f.ext === "txt" || f.ext === "text" ? "纯文本" : "Markdown" }];
  },
};
