export type Platform = "xiaohongshu" | "douyin";

export interface SocialPost {
  id: string;
  title: string;
  summary: string;
  coverGradient: string;
  platform: Platform;
  originalUrl: string;
  author: string;
  likes: number;
  comments: number;
  category: string;
  date: string;
}

export const platformLabels: Record<Platform, string> = {
  xiaohongshu: "小红书",
  douyin: "抖音",
};
