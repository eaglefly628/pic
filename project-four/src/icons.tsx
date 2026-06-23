import React from "react";

type P = { size?: number; stroke?: string; width?: number };
const base = (size: number, stroke: string, sw: number): React.SVGProps<SVGSVGElement> => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none",
  stroke, strokeWidth: sw, strokeLinecap: "round", strokeLinejoin: "round",
});

export const IconLock = ({ size = 17, stroke = "currentColor", width = 1.7 }: P) => (
  <svg {...base(size, stroke, width)}><rect x="4" y="10" width="16" height="11" rx="2.5" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
);
export const IconKey = ({ size = 17, stroke = "currentColor", width = 1.7 }: P) => (
  <svg {...base(size, stroke, width)}><circle cx="8" cy="15" r="4" /><path d="M10.8 12.2 20 3M16 7l3 3M14 9l2 2" /></svg>
);
export const IconCard = ({ size = 17, stroke = "currentColor", width = 1.7 }: P) => (
  <svg {...base(size, stroke, width)}><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 9.5h19" /></svg>
);
export const IconNote = ({ size = 17, stroke = "currentColor", width = 1.7 }: P) => (
  <svg {...base(size, stroke, width)}><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></svg>
);
export const IconInfo = ({ size = 17, stroke = "currentColor", width = 1.7 }: P) => (
  <svg {...base(size, stroke, width)}><rect x="4" y="3" width="16" height="18" rx="2.5" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>
);
export const IconStar = ({ size = 16, stroke = "currentColor", width = 1.7 }: P) => (
  <svg {...base(size, stroke, width)}><path d="M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6L12 17l-5.3 2.6 1.1-6L3.4 9.4l6-.8L12 3Z" /></svg>
);
export const IconSearch = ({ size = 15, stroke = "var(--text-tertiary)", width = 2 }: P) => (
  <svg {...base(size, stroke, width)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
);
export const IconCopy = ({ size = 15, stroke = "currentColor", width = 1.7 }: P) => (
  <svg {...base(size, stroke, width)}><rect x="9" y="9" width="12" height="12" rx="2.5" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></svg>
);
export const IconEye = ({ size = 15, stroke = "currentColor", width = 1.7 }: P) => (
  <svg {...base(size, stroke, width)}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
);
export const IconEyeOff = ({ size = 15, stroke = "currentColor", width = 1.7 }: P) => (
  <svg {...base(size, stroke, width)}><path d="M2 12s3.6-7 10-7c1.6 0 3 .4 4.3 1M22 12s-3.6 7-10 7c-1.6 0-3-.4-4.3-1" /><path d="M9.5 9.5a3 3 0 0 0 4.2 4.2M3 3l18 18" /></svg>
);
export const IconPlus = ({ size = 17, stroke = "currentColor", width = 2 }: P) => (
  <svg {...base(size, stroke, width)}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconTrash = ({ size = 15, stroke = "currentColor", width = 1.7 }: P) => (
  <svg {...base(size, stroke, width)}><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" /></svg>
);
export const IconGear = ({ size = 17, stroke = "currentColor", width = 1.7 }: P) => (
  <svg {...base(size, stroke, width)}><circle cx="12" cy="12" r="3" /><path d="M19.4 14a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V20a2 2 0 0 1-4 0v-.1A1.6 1.6 0 0 0 7 18.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4 14H3.9a2 2 0 0 1 0-4H4a1.6 1.6 0 0 0 1.1-2.7L5 7.2a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 4.6V4a2 2 0 0 1 4 0v.1A1.6 1.6 0 0 0 16.8 5l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.6 1.6 0 0 0 19.4 10H20a2 2 0 0 1 0 4h-.1Z" /></svg>
);
export const IconClose = ({ size = 18, stroke = "currentColor", width = 2 }: P) => (
  <svg {...base(size, stroke, width)}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const IconRefresh = ({ size = 15, stroke = "currentColor", width = 1.8 }: P) => (
  <svg {...base(size, stroke, width)}><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" /></svg>
);
export const IconTerminal = ({ size = 17, stroke = "currentColor", width = 1.7 }: P) => (
  <svg {...base(size, stroke, width)}><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="m7 9 3 3-3 3" /><path d="M13 15h4" /></svg>
);
export const IconList = ({ size = 16, stroke = "currentColor", width = 1.8 }: P) => (
  <svg {...base(size, stroke, width)}><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" /></svg>
);
export const IconCode = ({ size = 16, stroke = "currentColor", width = 1.9 }: P) => (
  <svg {...base(size, stroke, width)}><path d="m9 8-4 4 4 4" /><path d="m15 8 4 4-4 4" /><path d="m13 6-2 12" /></svg>
);
export const IconLink = ({ size = 15, stroke = "currentColor", width = 1.8 }: P) => (
  <svg {...base(size, stroke, width)}><path d="m10 14 4-4" /><path d="M12.5 7.5 14 6a3.5 3.5 0 0 1 5 5l-1.5 1.5" /><path d="M11.5 16.5 10 18a3.5 3.5 0 0 1-5-5l1.5-1.5" /></svg>
);
export const IconCalendar = ({ size = 16, stroke = "currentColor", width = 1.8 }: P) => (
  <svg {...base(size, stroke, width)}><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M3 9.5h18" /><path d="M8 3v4M16 3v4" /></svg>
);
export const IconPin = ({ size = 14, stroke = "currentColor", width = 1.8 }: P) => (
  <svg {...base(size, stroke, width)}><path d="M12 17v5" /><path d="M9 3.5h6l-1 6.5 2.5 2.5a1 1 0 0 1-.7 1.7H8.2a1 1 0 0 1-.7-1.7L10 10 9 3.5Z" /></svg>
);
export const IconCheck = ({ size = 15, stroke = "currentColor", width = 2.2 }: P) => (
  <svg {...base(size, stroke, width)}><path d="m5 12 5 5L20 7" /></svg>
);
export const IconArrowRight = ({ size = 15, stroke = "currentColor", width = 2.2 }: P) => (
  <svg {...base(size, stroke, width)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
export const IconBack = ({ size = 15, stroke = "currentColor", width = 2.1 }: P) => (
  <svg {...base(size, stroke, width)}><path d="m15 18-6-6 6-6" /></svg>
);
