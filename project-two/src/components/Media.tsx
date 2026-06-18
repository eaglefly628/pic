import type { MediaItem } from "../types";
import { useLibrary } from "../lib/library";
import { fmtDuration } from "../lib/format";
import { IconPlay, IconStar, IconImage, IconLock } from "../icons";

export function MediaTile({ item, onOpen }: { item: MediaItem; onOpen: () => void }) {
  const { thumbUrl } = useLibrary();
  const url = thumbUrl(item.id);
  return (
    <button
      onClick={onOpen}
      className="fv-tile"
      style={{
        position: "relative", aspectRatio: "1 / 1", width: "100%", padding: 0, border: "none",
        borderRadius: 10, overflow: "hidden", cursor: "pointer", background: "var(--fill-quaternary)",
        boxShadow: "var(--card-shadow)",
      }}
    >
      {url ? (
        <img src={url} alt={item.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      ) : (
        <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)" }}><IconImage size={26} stroke="var(--text-tertiary)" /></span>
      )}
      {item.kind === "video" && (
        <>
          <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><IconPlay size={30} /></span>
          {item.durationSec ? <span style={{ position: "absolute", right: 6, bottom: 6, fontSize: 10.5, color: "#fff", background: "rgba(0,0,0,0.55)", padding: "1px 6px", borderRadius: 5, fontVariantNumeric: "tabular-nums" }}>{fmtDuration(item.durationSec)}</span> : null}
        </>
      )}
      {item.favorite && <span style={{ position: "absolute", left: 6, top: 6 }}><IconStar size={14} stroke="#FFD60A" /></span>}
      {item.private && <span style={{ position: "absolute", right: 6, top: 6 }}><IconLock size={13} stroke="#fff" /></span>}
    </button>
  );
}

export function MediaGrid({ items, onOpenIndex, min = 150 }: { items: MediaItem[]; onOpenIndex: (i: number) => void; min?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`, gap: 10 }}>
      {items.map((it, i) => (
        <MediaTile key={it.id} item={it} onOpen={() => onOpenIndex(i)} />
      ))}
    </div>
  );
}
