import React, { useEffect, useState } from "react";
import type { MediaItem } from "../types";
import { useLibrary } from "../lib/library";
import { dateTimeLabel, fmtSize } from "../lib/format";
import { IconClose, IconChevron, IconStar, IconTrash, IconPin } from "../icons";

export function Lightbox({ items, index, setIndex, onClose }: {
  items: MediaItem[]; index: number; setIndex: (i: number) => void; onClose: () => void;
}) {
  const { getOrigUrl, updateItem, removeItem, items: all } = useLibrary();
  const [url, setUrl] = useState<string | undefined>();
  const cur = all.find((x) => x.id === items[index]?.id) ?? items[index];

  useEffect(() => {
    let dead = false, made: string | undefined;
    setUrl(undefined);
    if (cur) getOrigUrl(cur.id).then((u) => { if (dead) { if (u) URL.revokeObjectURL(u); } else { made = u; setUrl(u); } });
    return () => { dead = true; if (made) URL.revokeObjectURL(made); };
  }, [cur, getOrigUrl]);

  useEffect(() => {
    const n = items.length;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") setIndex((index - 1 + n) % n);
      else if (e.key === "ArrowRight") setIndex((index + 1) % n);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, items.length, onClose, setIndex]);

  if (!cur) return null;
  const n = items.length;

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 90, background: "rgba(0,0,0,0.92)", display: "flex", flexDirection: "column", animation: "fvFade .15s ease" }}>
      {/* 顶栏 */}
      <div style={{ height: 52, flex: "none", display: "flex", alignItems: "center", gap: 10, padding: "0 16px", color: "#fff" }}>
        <div style={{ fontSize: 13, opacity: 0.85, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cur.name}</div>
        <span style={{ fontSize: 12, opacity: 0.6 }}>{index + 1} / {n}</span>
        <div style={{ flex: 1 }} />
        <IconBtn title={cur.favorite ? "取消收藏" : "收藏"} onClick={() => updateItem(cur.id, { favorite: !cur.favorite })}><IconStar size={18} stroke={cur.favorite ? "#FFD60A" : "#fff"} /></IconBtn>
        <IconBtn title="删除" onClick={() => { if (confirm("删除这张照片/视频？")) { removeItem(cur.id); onClose(); } }}><IconTrash size={17} stroke="#FF6961" /></IconBtn>
        <IconBtn title="关闭" onClick={onClose}><IconClose size={20} /></IconBtn>
      </div>

      {/* 媒体 */}
      <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 0, padding: "0 8px" }}>
        {n > 1 && <Nav side="left" onClick={() => setIndex((index - 1 + n) % n)} />}
        {url ? (
          cur.kind === "video" ? (
            <video src={url} controls autoPlay style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 6 }} />
          ) : (
            <img src={url} alt={cur.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 6 }} />
          )
        ) : (
          <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>加载中…</span>
        )}
        {n > 1 && <Nav side="right" onClick={() => setIndex((index + 1) % n)} />}
      </div>

      {/* 底部信息 */}
      <div style={{ flex: "none", padding: "12px 18px 16px", color: "rgba(255,255,255,0.85)", display: "flex", alignItems: "center", gap: 18, fontSize: 12.5, justifyContent: "center", flexWrap: "wrap" }}>
        <span>📅 {dateTimeLabel(cur.takenAt)}{cur.takenSource === "file" ? "（文件时间）" : ""}</span>
        {cur.lat != null && cur.lng != null && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><IconPin size={14} stroke="rgba(255,255,255,0.85)" />{cur.place || `${cur.lat.toFixed(4)}, ${cur.lng.toFixed(4)}`}</span>
        )}
        {cur.width ? <span style={{ opacity: 0.7 }}>{cur.width}×{cur.height}</span> : null}
        <span style={{ opacity: 0.7 }}>{fmtSize(cur.size)}</span>
      </div>
    </div>
  );
}

function IconBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button onClick={onClick} title={title} style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 9, background: "rgba(255,255,255,0.08)", border: "none", cursor: "pointer" }}>{children}</button>
  );
}
function Nav({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ position: "absolute", [side]: 10, top: "50%", transform: "translateY(-50%)", width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.12)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ transform: side === "left" ? "rotate(180deg)" : "none", display: "inline-flex" }}><IconChevron size={22} stroke="#fff" /></span>
    </button>
  );
}
