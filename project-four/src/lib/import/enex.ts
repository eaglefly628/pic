// Evernote 导出（.enex，XML）。也是很多笔记软件的中转格式。
import type { ImportFile, Importer, ParsedNote } from "./types";
import { htmlToMarkdown } from "./html";

// Evernote 时间："20210115T123000Z" → 毫秒
function enDate(s?: string | null): number | undefined {
  if (!s) return undefined;
  const m = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
  if (!m) { const t = Date.parse(s); return isNaN(t) ? undefined : t; }
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
}

export const enexImporter: Importer = {
  id: "enex",
  label: "Evernote (.enex)",
  exts: ["enex"],
  detect: (f) => f.text.includes("<en-export") || f.text.includes("<en-note"),
  parse(f: ImportFile): ParsedNote[] {
    const doc = new DOMParser().parseFromString(f.text, "application/xml");
    return [...doc.querySelectorAll("note")].map((n) => {
      const title = n.querySelector("title")?.textContent?.trim() || "未命名笔记";
      const content = n.querySelector("content")?.textContent || ""; // ENML（CDATA 内 XHTML）
      const tags = [...n.querySelectorAll("tag")].map((t) => t.textContent?.trim() || "").filter(Boolean);
      return {
        title,
        body: htmlToMarkdown(content),
        tags: tags.length ? tags : undefined,
        createdAt: enDate(n.querySelector("created")?.textContent),
        updatedAt: enDate(n.querySelector("updated")?.textContent),
        source: "Evernote",
      };
    });
  },
};
