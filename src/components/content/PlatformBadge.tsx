import { Platform, platformLabels } from "@/types/content";

const platformStyles: Record<Platform, string> = {
  xiaohongshu: "bg-red-50 text-red-500 border-red-200",
  douyin: "bg-gray-50 text-gray-700 border-gray-200",
};

export default function PlatformBadge({ platform }: { platform: Platform }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${platformStyles[platform]}`}
    >
      {platformLabels[platform]}
    </span>
  );
}
