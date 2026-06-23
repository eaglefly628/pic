// 通用 JSON + Google Keep(Takeout) + Standard Notes 等。
// 自动从常见字段名里取 标题/正文/标签/时间，尽量兼容各家导出。
import type { ImportFile, Importer, ParsedNote } from "./types";

const pick = (o: Record<string, unknown>, keys: string[]): string => {
  for (const k of keys) { const v = o[k]; if (typeof v === "string" && v.trim()) return v; }
  return "";
};

function mapNote(o: unknown): ParsedNote | null {
  if (!o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>;
  const title = pick(r, ["title", "name", "subject", "heading"]);
  const body = pick(r, ["body", "content", "text", "textContent", "markdown", "note", "plaintext"]);
  if (!title && !body) return null;
  // 标签：tags / labels(可能是 [{name}]) / keywords
  let tags: string[] | undefined;
  const raw = r.tags ?? r.labels ?? r.keywords;
  if (Array.isArray(raw)) {
    tags = raw.map((t) => (typeof t === "string" ? t : (t && typeof t === "object" ? String((t as Record<string, unknown>).name ?? "") : ""))).filter(Boolean);
    if (!tags.length) tags = undefined;
  }
  // 时间：Keep 用微秒 userEditedTimestampUsec
  const usec = r.userEditedTimestampUsec ?? r.createdTimestampUsec;
  const created = typeof usec === "number" || typeof usec === "string" ? Math.round(Number(usec) / 1000) : undefined;
  return { title: title || "未命名笔记", body, tags, createdAt: created && isFinite(created) ? created : undefined, source: "JSON" };
}

export const jsonImporter: Importer = {
  id: "json",
  label: "JSON / Google Keep / 通用",
  exts: ["json"],
  parse(f: ImportFile): ParsedNote[] {
    const data = JSON.parse(f.text);
    const arr: unknown[] = Array.isArray(data)
      ? data
      : (data && typeof data === "object" && Array.isArray((data as Record<string, unknown>).notes))
        ? (data as { notes: unknown[] }).notes
        : [data];
    return arr.map(mapNote).filter((x): x is ParsedNote => x !== null);
  },
};
