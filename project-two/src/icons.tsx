import React from "react";

type P = { size?: number; stroke?: string; width?: number };
const base = (size: number, stroke: string, sw: number): React.SVGProps<SVGSVGElement> => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none",
  stroke, strokeWidth: sw, strokeLinecap: "round", strokeLinejoin: "round",
});

export const IconSummary = ({ size = 17, stroke = "currentColor", width = 1.7 }: P) => (
  <svg {...base(size, stroke, width)}><path d="M4 4v16h16" /><path d="M7 14l3-3 3 3 4-5" /></svg>
);
export const IconPhoto = ({ size = 17, stroke = "currentColor", width = 1.7 }: P) => (
  <svg {...base(size, stroke, width)}><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="8.5" cy="9.5" r="1.6" /><path d="M21 16l-5-5L5 20" /></svg>
);
export const IconCalendar = ({ size = 17, stroke = "currentColor", width = 1.7 }: P) => (
  <svg {...base(size, stroke, width)}><rect x="3" y="4.5" width="18" height="16" rx="2.5" /><path d="M3 9h18M8 2.5v4M16 2.5v4" /></svg>
);
export const IconPin = ({ size = 17, stroke = "currentColor", width = 1.7 }: P) => (
  <svg {...base(size, stroke, width)}><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" /><circle cx="12" cy="10" r="2.6" /></svg>
);
export const IconAlbum = ({ size = 17, stroke = "currentColor", width = 1.7 }: P) => (
  <svg {...base(size, stroke, width)}><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3 9h18" /><path d="M8 5V3.5M16 5V3.5" /></svg>
);
export const IconLock = ({ size = 17, stroke = "currentColor", width = 1.7 }: P) => (
  <svg {...base(size, stroke, width)}><rect x="4" y="10" width="16" height="11" rx="2.5" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
);
export const IconUpload = ({ size = 17, stroke = "currentColor", width = 1.7 }: P) => (
  <svg {...base(size, stroke, width)}><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 20h14" /></svg>
);
export const IconGear = ({ size = 17, stroke = "currentColor", width = 1.7 }: P) => (
  <svg {...base(size, stroke, width)}><circle cx="12" cy="12" r="3" /><path d="M19.4 14a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V20a2 2 0 0 1-4 0v-.1A1.6 1.6 0 0 0 7 18.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4 14H3.9a2 2 0 0 1 0-4H4a1.6 1.6 0 0 0 1.1-2.7L5 7.2a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 4.6V4a2 2 0 0 1 4 0v.1A1.6 1.6 0 0 0 16.8 5l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.6 1.6 0 0 0 19.4 10H20a2 2 0 0 1 0 4h-.1Z" /></svg>
);
export const IconChevron = ({ size = 14, stroke = "var(--text-tertiary)", width = 2 }: P) => (
  <svg {...base(size, stroke, width)}><path d="m9 6 6 6-6 6" /></svg>
);
export const IconSearch = ({ size = 14, stroke = "var(--text-tertiary)", width = 2 }: P) => (
  <svg {...base(size, stroke, width)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
);
export const IconStar = ({ size = 15, stroke = "currentColor", width = 1.7 }: P) => (
  <svg {...base(size, stroke, width)}><path d="M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6L12 17l-5.3 2.6 1.1-6L3.4 9.4l6-.8L12 3Z" /></svg>
);
export const IconTrash = ({ size = 15, stroke = "currentColor", width = 1.9 }: P) => (
  <svg {...base(size, stroke, width)}><path d="M4 7h16" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /></svg>
);
export const IconPlay = ({ size = 22, stroke = "#fff", width = 1.7 }: P) => (
  <svg {...base(size, stroke, width)}><circle cx="12" cy="12" r="9" fill="rgba(0,0,0,0.35)" /><path d="M10 8.5l6 3.5-6 3.5Z" fill={stroke} stroke="none" /></svg>
);
export const IconClose = ({ size = 22, stroke = "#fff", width = 2 }: P) => (
  <svg {...base(size, stroke, width)}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const IconArrowRight = ({ size = 15, stroke = "#fff", width = 2.4 }: P) => (
  <svg {...base(size, stroke, width)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
export const IconImage = ({ size = 30, stroke = "#fff", width = 1.6 }: P) => (
  <svg {...base(size, stroke, width)}><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="8.5" cy="9.5" r="1.6" /><path d="M21 16l-5-5L5 20" /></svg>
);
