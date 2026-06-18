// 图标集（取自设计稿的内联 SVG）
import React from "react";

type P = { size?: number; stroke?: string; width?: number };
const base = (size: number, stroke: string, sw: number): React.SVGProps<SVGSVGElement> => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none",
  stroke, strokeWidth: sw, strokeLinecap: "round", strokeLinejoin: "round",
});

export const IconDashboard = ({ size = 17, stroke = "currentColor", width = 1.7 }: P) => (
  <svg {...base(size, stroke, width)}>
    <rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" />
  </svg>
);
export const IconCard = ({ size = 17, stroke = "currentColor", width = 1.7 }: P) => (
  <svg {...base(size, stroke, width)}>
    <rect x="2.5" y="6" width="19" height="13" rx="2.5" /><path d="M2.5 10h19" /><path d="M6 15h4" />
  </svg>
);
export const IconLock = ({ size = 17, stroke = "currentColor", width = 1.7 }: P) => (
  <svg {...base(size, stroke, width)}>
    <rect x="4" y="10" width="16" height="11" rx="2.5" /><path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);
export const IconUser = ({ size = 17, stroke = "currentColor", width = 1.7 }: P) => (
  <svg {...base(size, stroke, width)}>
    <circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
  </svg>
);
export const IconImport = ({ size = 17, stroke = "currentColor", width = 1.7 }: P) => (
  <svg {...base(size, stroke, width)}>
    <path d="M12 3v12" /><path d="m7.5 10.5 4.5 4.5 4.5-4.5" /><path d="M4 18.5h16" />
  </svg>
);
export const IconGear = ({ size = 17, stroke = "currentColor", width = 1.7 }: P) => (
  <svg {...base(size, stroke, width)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 14a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V20a2 2 0 0 1-4 0v-.1A1.6 1.6 0 0 0 7 18.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4 14H3.9a2 2 0 0 1 0-4H4a1.6 1.6 0 0 0 1.1-2.7L5 7.2a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 4.6V4a2 2 0 0 1 4 0v.1A1.6 1.6 0 0 0 16.8 5l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.6 1.6 0 0 0 19.4 10H20a2 2 0 0 1 0 4h-.1Z" />
  </svg>
);
export const IconChevron = ({ size = 14, stroke = "var(--text-tertiary)", width = 2 }: P) => (
  <svg {...base(size, stroke, width)}><path d="m9 6 6 6-6 6" /></svg>
);
export const IconSearch = ({ size = 14, stroke = "var(--text-tertiary)", width = 2 }: P) => (
  <svg {...base(size, stroke, width)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
);
export const IconPlus = ({ size = 16, stroke = "currentColor", width = 2.2 }: P) => (
  <svg {...base(size, stroke, width)}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconBack = ({ size = 17, stroke = "currentColor", width = 2.1 }: P) => (
  <svg {...base(size, stroke, width)}><path d="m15 18-6-6 6-6" /></svg>
);
export const IconClock = ({ size = 13, stroke = "currentColor", width = 1.8 }: P) => (
  <svg {...base(size, stroke, width)}><circle cx="12" cy="12" r="9" /><path d="M12 8v4l2.5 2" /></svg>
);
export const IconEdit = ({ size = 14, stroke = "currentColor", width = 2 }: P) => (
  <svg {...base(size, stroke, width)}>
    <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);
export const IconArrowRight = ({ size = 15, stroke = "#fff", width = 2.4 }: P) => (
  <svg {...base(size, stroke, width)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
export const IconShield = ({ size = 30, stroke = "#fff", width = 1.7 }: P) => (
  <svg {...base(size, stroke, width)}>
    <path d="M12 2 4 5v6c0 5 3.4 8.4 8 11 4.6-2.6 8-6 8-11V5l-8-3Z" />
    <circle cx="12" cy="11" r="2.4" fill={stroke} stroke="none" /><path d="M12 13v3" />
  </svg>
);
export const IconCopy = ({ size = 15, stroke = "currentColor", width = 1.9 }: P) => (
  <svg {...base(size, stroke, width)}>
    <rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M5 15V5a2 2 0 0 1 2-2h8" />
  </svg>
);
export const IconEye = ({ size = 15, stroke = "currentColor", width = 1.9 }: P) => (
  <svg {...base(size, stroke, width)}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
export const IconEyeOff = ({ size = 15, stroke = "currentColor", width = 1.9 }: P) => (
  <svg {...base(size, stroke, width)}>
    <path d="M3 3l18 18" /><path d="M10.6 6.2A9.8 9.8 0 0 1 12 6c6.5 0 10 6 10 6a16 16 0 0 1-3.3 3.9" />
    <path d="M6.3 6.4A16 16 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 4-.9" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </svg>
);
export const IconTrash = ({ size = 15, stroke = "currentColor", width = 1.9 }: P) => (
  <svg {...base(size, stroke, width)}>
    <path d="M4 7h16" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
  </svg>
);
export const IconRefresh = ({ size = 15, stroke = "currentColor", width = 1.9 }: P) => (
  <svg {...base(size, stroke, width)}>
    <path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 4v5h-5" />
  </svg>
);
export const IconDownload = ({ size = 15, stroke = "currentColor", width = 1.9 }: P) => (
  <svg {...base(size, stroke, width)}><path d="M12 3v12" /><path d="m7 11 5 5 5-5" /><path d="M5 21h14" /></svg>
);
export const IconUpload = ({ size = 15, stroke = "currentColor", width = 1.9 }: P) => (
  <svg {...base(size, stroke, width)}><path d="M12 21V9" /><path d="m7 13 5-5 5 5" /><path d="M5 4h14" /></svg>
);
export const IconKey = ({ size = 17, stroke = "currentColor", width = 1.7 }: P) => (
  <svg {...base(size, stroke, width)}>
    <circle cx="8" cy="15" r="4" /><path d="m10.8 12.2 8.2-8.2" /><path d="m16 7 2 2" /><path d="m19 4 2 2" />
  </svg>
);
export const IconStar = ({ size = 15, stroke = "currentColor", width = 1.7 }: P) => (
  <svg {...base(size, stroke, width)}>
    <path d="M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6L12 17l-5.3 2.6 1.1-6L3.4 9.4l6-.8L12 3Z" />
  </svg>
);
export const IconCheck = ({ size = 15, stroke = "currentColor", width = 2.2 }: P) => (
  <svg {...base(size, stroke, width)}><path d="m5 12 5 5L20 7" /></svg>
);
export const IconPercent = ({ size = 17, stroke = "currentColor", width = 1.8 }: P) => (
  <svg {...base(size, stroke, width)}><path d="M19 5 5 19" /><circle cx="7.5" cy="7.5" r="2.5" /><circle cx="16.5" cy="16.5" r="2.5" /></svg>
);
export const IconWallet = ({ size = 17, stroke = "currentColor", width = 1.7 }: P) => (
  <svg {...base(size, stroke, width)}><path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v0" /><rect x="3" y="7" width="18" height="12" rx="2.5" /><path d="M16 12.5h2.5" /></svg>
);
export const IconChartUp = ({ size = 17, stroke = "currentColor", width = 1.7 }: P) => (
  <svg {...base(size, stroke, width)}><path d="M4 4v16h16" /><path d="m7 14 3.5-3.5 3 3L20 7" /><path d="M20 11V7h-4" /></svg>
);
export const IconMarkets = ({ size = 17, stroke = "currentColor", width = 1.7 }: P) => (
  <svg {...base(size, stroke, width)}><path d="M4 4v16h16" /><rect x="7" y="9" width="2.6" height="7" rx="0.8" /><rect x="12.5" y="6" width="2.6" height="10" rx="0.8" /><path d="M8.3 9V7M8.3 18v-2M13.8 6V4.5M13.8 18v-2" /></svg>
);
