// Base 目录模式：用 File System Access API 指定一个本机文件夹作为媒体库。
// 原文件留在磁盘（不拷贝），App 只保存索引与缩略图，按需从磁盘读原图。
// 仅 Chromium 系（Chrome/Edge）支持。
/* eslint-disable @typescript-eslint/no-explicit-any */

export type DirHandle = any; // FileSystemDirectoryHandle（lib.dom 类型不全，统一用 any）

const IMG = /\.(jpe?g|png|gif|webp|bmp|tiff?|heic|heif|avif)$/i;
const VID = /\.(mp4|mov|m4v|webm|mkv|avi|3gp)$/i;

export function fsSupported(): boolean {
  return typeof (window as any).showDirectoryPicker === "function";
}

export function kindByName(name: string): "image" | "video" | null {
  if (IMG.test(name)) return "image";
  if (VID.test(name)) return "video";
  return null;
}

export async function pickDirectory(): Promise<DirHandle | null> {
  try {
    return await (window as any).showDirectoryPicker({ mode: "read", id: "familyGalleryBase" });
  } catch {
    return null; // 用户取消
  }
}

export async function ensurePermission(handle: DirHandle, request: boolean): Promise<boolean> {
  try {
    const opts = { mode: "read" };
    if ((await handle.queryPermission?.(opts)) === "granted") return true;
    if (request && (await handle.requestPermission?.(opts)) === "granted") return true;
  } catch { /* 忽略 */ }
  return false;
}

/** 递归遍历目录，产出所有图片/视频文件 */
export async function* walkMedia(dir: DirHandle, prefix = ""): AsyncGenerator<{ handle: any; path: string; kind: "image" | "video" }> {
  for await (const entry of dir.values()) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.kind === "file") {
      const k = kindByName(entry.name);
      if (k) yield { handle: entry, path, kind: k };
    } else if (entry.kind === "directory") {
      yield* walkMedia(entry, path);
    }
  }
}

/** 按相对路径从根目录取文件 */
export async function fileByPath(root: DirHandle, path: string): Promise<File | null> {
  try {
    const parts = path.split("/");
    let dir = root;
    for (let i = 0; i < parts.length - 1; i++) dir = await dir.getDirectoryHandle(parts[i]);
    const fh = await dir.getFileHandle(parts[parts.length - 1]);
    return await fh.getFile();
  } catch {
    return null; // 文件可能已被移动/删除
  }
}
