// 影像条目数据模型。原图与缩略图为二进制（存 IndexedDB），元数据单独存。
export type MediaKind = "image" | "video";

export interface MediaItem {
  id: string;
  name: string; // 文件名
  kind: MediaKind;
  mime: string;
  size: number;
  width?: number;
  height?: number;
  durationSec?: number; // 视频时长
  /** 拍摄时间（毫秒）。优先 EXIF，否则取文件修改时间 */
  takenAt: number;
  takenSource: "exif" | "file";
  /** GPS */
  lat?: number;
  lng?: number;
  /** 地点标签（按 GPS 聚类的 key，或用户命名） */
  place?: string;
  albums: string[];
  tags: string[];
  favorite?: boolean;
  /** 是否归入私密区 */
  private?: boolean;
  /** 内容指纹（SHA-256），用于精确去重 */
  hash?: string;
  /** 感知哈希（dHash, 64bit 16hex），用于相似/近重复 */
  phash?: string;
  /** 清晰度（拉普拉斯方差，越小越糊） */
  blur?: number;
  /** Base 目录模式：相对基准目录的路径（存在则原文件在磁盘，不在 IndexedDB） */
  path?: string;
  addedAt: number;
}

export interface Album {
  id: string;
  name: string;
  cover?: string; // 封面 item id
  createdAt: number;
}
