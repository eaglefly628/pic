// HTML / 网页剪藏 / OneNote 导出的 HTML / Apple Notes 导出的 HTML。
// 也被 Evernote(.enex) 复用，把 ENML 内容转成可读的 Markdown 文本。
import type { ImportFile, Importer, ParsedNote } from "./types";

const BLOCK = new Set(["P", "DIV", "SECTION", "ARTICLE", "UL", "OL", "TABLE", "TR", "BLOCKQUOTE", "PRE", "H1", "H2", "H3", "H4", "H5", "H6", "HR"]);

function walk(node: Node, out: string[], depth = 0): void {
  node.childNodes.forEach((c) => {
    if (c.nodeType === 3) { // text
      const t = (c.textContent ?? "").replace(/\s+/g, " ");
      if (t.trim()) out.push(t);
      return;
    }
    if (c.nodeType !== 1) return;
    const el = c as HTMLElement;
    const tag = el.tagName;
    if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") return;
    if (tag === "BR") { out.push("\n"); return; }
    if (tag === "HR") { out.push("\n---\n"); return; }
    if (/^H[1-6]$/.test(tag)) { out.push("\n\n" + "#".repeat(+tag[1]) + " " + el.textContent!.trim() + "\n"); return; }
    if (tag === "LI") { out.push("\n" + "  ".repeat(depth) + "- "); walk(el, out, depth + 1); return; }
    if (tag === "A") { const href = el.getAttribute("href"); const txt = el.textContent!.trim(); out.push(href && txt && href !== txt ? `[${txt}](${href})` : txt); return; }
    if (tag === "IMG") { const alt = el.getAttribute("alt") || "图片"; out.push(`![${alt}]`); return; }
    if (tag === "B" || tag === "STRONG") { out.push("**" + el.textContent!.trim() + "**"); return; }
    if (tag === "I" || tag === "EM") { out.push("*" + el.textContent!.trim() + "*"); return; }
    if (tag === "CODE" && el.parentElement?.tagName !== "PRE") { out.push("`" + el.textContent + "`"); return; }
    if (tag === "PRE") { out.push("\n```\n" + (el.textContent ?? "").replace(/\n+$/, "") + "\n```\n"); return; }
    const block = BLOCK.has(tag);
    if (block) out.push("\n");
    walk(el, out, depth);
    if (block) out.push("\n");
  });
}

/** 把一段 HTML 转成精简 Markdown 文本 */
export function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script,style,noscript").forEach((e) => e.remove());
  const out: string[] = [];
  walk(doc.body, out);
  return out.join("")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function htmlTitle(html: string, fallback: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const t = doc.querySelector("title")?.textContent?.trim()
    || doc.querySelector("h1")?.textContent?.trim()
    || doc.querySelector("h2")?.textContent?.trim();
  return (t && t.length <= 120 ? t : "") || fallback;
}

export const htmlImporter: Importer = {
  id: "html",
  label: "HTML / 网页剪藏 / OneNote 导出",
  exts: ["html", "htm", "xhtml"],
  parse(f: ImportFile): ParsedNote[] {
    return [{ title: htmlTitle(f.text, f.name), body: htmlToMarkdown(f.text), source: "HTML" }];
  },
};
