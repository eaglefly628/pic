// 像素级分析（纯前端，从缩略图计算）：
//  - 感知哈希 dHash（找相似/近重复）
//  - 清晰度 = 拉普拉斯方差（越小越糊）
import type { MediaItem } from "../types";

export interface Analysis { phash: string; blur: number; }

const gray = (d: Uint8ClampedArray, i: number) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];

function ctxOf(w: number, h: number): CanvasRenderingContext2D {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c.getContext("2d", { willReadFrequently: true })!;
}

export async function analyzeBlob(blob: Blob): Promise<Analysis> {
  const bmp = await createImageBitmap(blob);
  try {
    // dHash 9x8
    const c1 = ctxOf(9, 8);
    c1.drawImage(bmp, 0, 0, 9, 8);
    const d1 = c1.getImageData(0, 0, 9, 8).data;
    let bits = "";
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        const i = (y * 9 + x) * 4, j = (y * 9 + x + 1) * 4;
        bits += gray(d1, i) < gray(d1, j) ? "1" : "0";
      }
    let phash = "";
    for (let k = 0; k < 64; k += 4) phash += parseInt(bits.slice(k, k + 4), 2).toString(16);

    // 清晰度：64x64 灰度拉普拉斯方差
    const N = 64;
    const c2 = ctxOf(N, N);
    c2.drawImage(bmp, 0, 0, N, N);
    const d2 = c2.getImageData(0, 0, N, N).data;
    const g = new Float64Array(N * N);
    for (let p = 0; p < N * N; p++) g[p] = gray(d2, p * 4);
    let sum = 0, sum2 = 0, cnt = 0;
    for (let y = 1; y < N - 1; y++)
      for (let x = 1; x < N - 1; x++) {
        const idx = y * N + x;
        const lap = -4 * g[idx] + g[idx - 1] + g[idx + 1] + g[idx - N] + g[idx + N];
        sum += lap; sum2 += lap * lap; cnt++;
      }
    const mean = sum / cnt;
    const blur = Math.round(sum2 / cnt - mean * mean);
    return { phash, blur };
  } finally {
    bmp.close?.();
  }
}

const POP = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];
export function hamming(a?: string, b?: string): number {
  if (!a || !b || a.length !== b.length) return 64;
  let d = 0;
  for (let i = 0; i < a.length; i++) d += POP[(parseInt(a[i], 16) ^ parseInt(b[i], 16)) & 0xf];
  return d;
}

const SHOT_RE = /screen ?shot|截屏|截图|屏幕快照|screenrecord|录屏/i;
/** 疑似截屏：文件名命中关键词，或（无相机 EXIF + 无 GPS + 竖屏手机比例 + 较大） */
export function isScreenshot(m: MediaItem): boolean {
  if (m.kind !== "image") return false;
  if (SHOT_RE.test(m.name)) return true;
  const w = m.width || 0, h = m.height || 0;
  if (!w || !h) return false;
  const tall = h / w;
  const phoneScreen = tall >= 1.9 && tall <= 2.3 && Math.max(w, h) >= 1000;
  return m.takenSource === "file" && m.lat == null && phoneScreen;
}
