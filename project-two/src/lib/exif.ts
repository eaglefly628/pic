// 读取拍摄时间(EXIF DateTimeOriginal) 与 GPS，并生成缩略图。纯前端、纯本地。
import exifr from "exifr";
import type { MediaKind } from "../types";

export interface Parsed {
  takenAt: number;
  takenSource: "exif" | "file";
  lat?: number;
  lng?: number;
}

export async function extractMeta(file: File, kind: MediaKind): Promise<Parsed> {
  let takenAt = file.lastModified || Date.now();
  let takenSource: "exif" | "file" = "file";
  let lat: number | undefined;
  let lng: number | undefined;
  if (kind === "image") {
    try {
      const ex = await exifr.parse(file).catch(() => null);
      const d = ex?.DateTimeOriginal || ex?.CreateDate || ex?.ModifyDate;
      if (d instanceof Date && !isNaN(d.getTime())) { takenAt = d.getTime(); takenSource = "exif"; }
      const gps = await exifr.gps(file).catch(() => null);
      if (gps && typeof gps.latitude === "number" && typeof gps.longitude === "number") {
        lat = gps.latitude; lng = gps.longitude;
      }
    } catch { /* 无 EXIF 时回退文件时间 */ }
  }
  return { takenAt, takenSource, lat, lng };
}

function fit(w: number, h: number, max: number) {
  if (!w || !h) return { w: max, h: max };
  const r = Math.min(max / w, max / h, 1);
  return { w: Math.max(1, Math.round(w * r)), h: Math.max(1, Math.round(h * r)) };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("image decode failed"));
    img.src = url;
  });
}

export async function makeImageThumb(file: Blob, max = 480): Promise<{ blob: Blob; width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const { w, h } = fit(img.naturalWidth, img.naturalHeight, max);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), "image/jpeg", 0.82));
    return { blob, width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function makeVideoThumb(file: Blob, max = 480): Promise<{ blob: Blob; width: number; height: number; durationSec: number }> {
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  v.src = url; v.muted = true; v.preload = "metadata"; v.playsInline = true;
  try {
    await new Promise<void>((res, rej) => {
      v.onloadeddata = () => res();
      v.onerror = () => rej(new Error("video load failed"));
    });
    await new Promise<void>((res) => {
      v.onseeked = () => res();
      try { v.currentTime = Math.min(1, (v.duration || 2) * 0.1); } catch { res(); }
    });
    const { w, h } = fit(v.videoWidth, v.videoHeight, max);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d")!.drawImage(v, 0, 0, w, h);
    const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), "image/jpeg", 0.8));
    return { blob, width: v.videoWidth, height: v.videoHeight, durationSec: v.duration || 0 };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** 按 GPS 粗聚类的 key（约 1km 网格）；无 GPS 返回 null */
export function placeKey(lat?: number, lng?: number): string | null {
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}
