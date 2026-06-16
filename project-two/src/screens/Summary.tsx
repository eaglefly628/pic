import { useMemo } from "react";
import { useLibrary } from "../lib/library";
import { placeKey } from "../lib/exif";
import { dateLabel } from "../lib/format";
import { card, EmptyState, Btn } from "../ui";
import { IconPhoto } from "../icons";

export default function Summary({ goImport }: { goImport: () => void }) {
  const { items } = useLibrary();
  const s = useMemo(() => {
    const v = items.filter((m) => !m.private);
    const images = v.filter((m) => m.kind === "image").length;
    const videos = v.filter((m) => m.kind === "video").length;
    const ts = v.map((m) => m.takenAt).sort((a, b) => a - b);
    const places = new Set(v.map((m) => placeKey(m.lat, m.lng)).filter(Boolean) as string[]);
    const withGps = v.filter((m) => placeKey(m.lat, m.lng)).length;
    const favorites = v.filter((m) => m.favorite).length;
    const privateCount = items.filter((m) => m.private).length;
    const byYear = new Map<number, number>();
    for (const m of v) { const y = new Date(m.takenAt).getFullYear(); byYear.set(y, (byYear.get(y) ?? 0) + 1); }
    const years = [...byYear.entries()].sort((a, b) => a[0] - b[0]);
    const maxYear = years.reduce((mx, [, c]) => Math.max(mx, c), 1);
    return { total: v.length, images, videos, from: ts[0], to: ts[ts.length - 1], places: places.size, withGps, favorites, privateCount, years, maxYear };
  }, [items]);

  if (s.total === 0) {
    return <div style={{ padding: "40px 32px" }}><EmptyState icon={<IconPhoto size={30} stroke="var(--text-tertiary)" />} text="导入照片后，这里会自动按时间、地点汇总" action={<Btn variant="soft" onClick={goImport}>开始导入</Btn>} /></div>;
  }

  return (
    <div style={{ padding: "24px 32px 40px", animation: "fvFade 0.3s ease" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 16 }}>
        <Metric label="照片 + 视频" value={String(s.total)} sub={`${s.images} 图 · ${s.videos} 视频`} accent />
        <Metric label="时间跨度" value={s.from ? `${new Date(s.from).getFullYear()}–${new Date(s.to).getFullYear()}` : "—"} sub={s.from ? `${dateLabel(s.from)} 起` : ""} />
        <Metric label="地点" value={String(s.places)} sub={`${s.withGps} 张含定位`} />
        <Metric label="收藏 / 私密" value={`${s.favorites} / ${s.privateCount}`} sub="收藏 / 私密区" />
      </div>

      <div style={{ ...card, padding: "18px 22px" }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 14 }}>按年份分布</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {s.years.map(([y, c]) => (
            <div key={y} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 48, fontSize: 12.5, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>{y}</span>
              <div style={{ flex: 1, height: 14, background: "var(--track)", borderRadius: 7, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(c / s.maxYear) * 100}%`, background: "linear-gradient(90deg, var(--accent), #5E5CE6)", borderRadius: 7 }} />
              </div>
              <span style={{ width: 44, textAlign: "right", fontSize: 12, color: "var(--text-primary)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{c}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div style={{ ...(accent ? { background: "linear-gradient(155deg, var(--accent), #5E5CE6)", color: "#fff" } : card), borderRadius: 14, padding: "16px 20px", ...(accent ? { boxShadow: "0 6px 18px var(--accent-soft)" } : {}) }}>
      <div style={{ fontSize: 12, color: accent ? "rgba(255,255,255,0.85)" : "var(--text-secondary)", fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, marginTop: 7, fontVariantNumeric: "tabular-nums", color: accent ? "#fff" : "var(--text-primary)" }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, marginTop: 4, color: accent ? "rgba(255,255,255,0.8)" : "var(--text-tertiary)" }}>{sub}</div>}
    </div>
  );
}
