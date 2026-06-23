// .zip 整库导入（Notion / Obsidian 仓库 / Joplin / Google Takeout 等都导出 zip）。
// 用浏览器原生 DecompressionStream("deflate-raw") 解压，逐个文件再分派给对应解析器。
import type { ImportFile, Importer, ParsedNote } from "./types";
import { markdownImporter } from "./markdown";
import { htmlImporter } from "./html";
import { enexImporter } from "./enex";
import { jsonImporter } from "./json";
import { csvImporter } from "./csv";

const SUB: Importer[] = [markdownImporter, htmlImporter, enexImporter, jsonImporter, csvImporter];
const td = new TextDecoder("utf-8");

async function inflateRaw(comp: Uint8Array): Promise<Uint8Array> {
  const ds = new (globalThis as unknown as { DecompressionStream: typeof DecompressionStream }).DecompressionStream("deflate-raw");
  const stream = new Blob([comp as unknown as BlobPart]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

interface Entry { name: string; bytes: Uint8Array; }

async function unzip(bytes: Uint8Array): Promise<Entry[]> {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // 从尾部找 EOCD（0x06054b50）
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0 && i > bytes.length - 22 - 65536; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("不是有效的 zip 文件");
  const count = dv.getUint16(eocd + 10, true);
  let off = dv.getUint32(eocd + 16, true);
  const out: Entry[] = [];
  for (let n = 0; n < count && off + 46 <= bytes.length; n++) {
    if (dv.getUint32(off, true) !== 0x02014b50) break;
    const method = dv.getUint16(off + 10, true);
    const compSize = dv.getUint32(off + 20, true);
    const nameLen = dv.getUint16(off + 28, true);
    const extraLen = dv.getUint16(off + 30, true);
    const commentLen = dv.getUint16(off + 32, true);
    const lho = dv.getUint32(off + 42, true);
    const name = td.decode(bytes.subarray(off + 46, off + 46 + nameLen));
    const lnameLen = dv.getUint16(lho + 26, true);
    const lextraLen = dv.getUint16(lho + 28, true);
    const dataStart = lho + 30 + lnameLen + lextraLen;
    const comp = bytes.subarray(dataStart, dataStart + compSize);
    try {
      if (!name.endsWith("/")) {
        const data = method === 0 ? comp : method === 8 ? await inflateRaw(comp) : null;
        if (data) out.push({ name, bytes: data });
      }
    } catch { /* 跳过坏条目 */ }
    off += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

const baseName = (p: string) => (p.split("/").pop() || p).replace(/\.[^.]+$/, "");
const isJunk = (p: string) => /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db)/.test(p) || /(^|\/)\./.test(p);

export const zipImporter: Importer = {
  id: "zip",
  label: ".zip 整库（Notion / Obsidian / Joplin …）",
  exts: ["zip"],
  async parse(f: ImportFile): Promise<ParsedNote[]> {
    const entries = await unzip(f.bytes);
    const notes: ParsedNote[] = [];
    for (const e of entries) {
      if (isJunk(e.name)) continue;
      const ext = (e.name.split(".").pop() || "").toLowerCase();
      const imp = SUB.find((s) => s.exts.includes(ext));
      if (!imp) continue;
      const sub: ImportFile = { name: baseName(e.name), ext, bytes: e.bytes, text: ext === "json" || ext === "csv" || ext === "tsv" || /^(md|markdown|mdown|mkd|txt|text|html|htm|xhtml|enex)$/.test(ext) ? td.decode(e.bytes) : "" };
      try {
        const parsed = await imp.parse(sub);
        for (const p of parsed) notes.push({ ...p, source: p.source ? `ZIP · ${p.source}` : "ZIP" });
      } catch { /* 跳过解析失败的条目 */ }
    }
    return notes;
  },
};
