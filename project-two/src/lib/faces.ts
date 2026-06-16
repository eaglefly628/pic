// 人脸识别：用 face-api.js（运行时从 CDN 加载，模型仅首次下载）在浏览器本地推理。
// 检测人脸 → 取 128 维特征向量 → 按欧氏距离贪心聚类成「人物」。
/* eslint-disable @typescript-eslint/no-explicit-any */
import { loadScript } from "./cdn";

const FA = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.js";
const MODEL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";
export const SAME_PERSON = 0.52; // 距离阈值：小于此视为同一人

export interface Person { id: string; name?: string; centroid: number[]; count: number; avatar?: Blob }
export interface DetFace { descriptor: number[]; box: { x: number; y: number; width: number; height: number }; personId?: string }

let ready = false;
export async function ensureFaceModels(): Promise<void> {
  if (ready) return;
  await loadScript(FA);
  const f = (window as any).faceapi;
  if (!f) throw new Error("人脸库加载失败");
  await f.nets.tinyFaceDetector.loadFromUri(MODEL);
  await f.nets.faceLandmark68Net.loadFromUri(MODEL);
  await f.nets.faceRecognitionNet.loadFromUri(MODEL);
  ready = true;
}

function imgFromBlob(b: Blob): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(b);
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => { URL.revokeObjectURL(url); rej(new Error("图片解码失败")); };
    im.src = url;
  });
}

export async function detectFaces(blob: Blob): Promise<{ faces: DetFace[]; img: HTMLImageElement }> {
  const f = (window as any).faceapi;
  const img = await imgFromBlob(blob);
  const res = await f.detectAllFaces(img, new f.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
    .withFaceLandmarks().withFaceDescriptors();
  const faces: DetFace[] = res.map((r: any) => ({
    descriptor: Array.from(r.descriptor as Float32Array),
    box: { x: r.detection.box.x, y: r.detection.box.y, width: r.detection.box.width, height: r.detection.box.height },
  }));
  return { faces, img };
}

export function dist(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; }
  return Math.sqrt(s);
}

/** 把人脸框（含留白）裁成正方形头像 */
export async function cropFace(img: HTMLImageElement, box: DetFace["box"]): Promise<Blob | undefined> {
  const pad = box.width * 0.35;
  const x = Math.max(0, box.x - pad), y = Math.max(0, box.y - pad);
  const w = Math.min(img.naturalWidth - x, box.width + pad * 2), h = Math.min(img.naturalHeight - y, box.height + pad * 2);
  const S = 120;
  const c = document.createElement("canvas"); c.width = S; c.height = S;
  const g = c.getContext("2d"); if (!g) return undefined;
  g.drawImage(img, x, y, w, h, 0, 0, S, S);
  return await new Promise<Blob | undefined>((r) => c.toBlob((b) => r(b ?? undefined), "image/jpeg", 0.85));
}
