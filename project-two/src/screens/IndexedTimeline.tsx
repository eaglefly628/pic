import { useEffect, useMemo, useRef, useState } from "react";
import { fmtSize } from "../lib/format";
import { getRemoteTimeline, type RemoteTimelineData, type RemoteTimelinePlace } from "../lib/remoteIndex";
import { card } from "../ui";
import { IconPin } from "../icons";

export default function IndexedTimeline({ summary }: { summary: RemoteTimelineData }) {
  const [selected, setSelected] = useState(() => summary.periods[summary.periods.length - 1]?.period || "");
  const [places, setPlaces] = useState<RemoteTimelinePlace[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [error, setError] = useState("");
  const axisRef = useRef<HTMLDivElement>(null);
  const maxFiles = Math.max(1, ...summary.periods.map((item) => item.files));
  const selectedPeriod = summary.periods.find((item) => item.period === selected);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    setLoadingPlaces(true);
    getRemoteTimeline(selected)
      .then((next) => {
        if (!active) return;
        if (!next.ok) throw new Error(next.error || "无法读取地点分布");
        setPlaces(next.places);
        setError("");
      })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "无法读取地点分布"); })
      .finally(() => { if (active) setLoadingPlaces(false); });
    return () => { active = false; };
  }, [selected, summary.processed]);

  useEffect(() => {
    const target = axisRef.current?.querySelector(`[data-period="${selected}"]`) as HTMLElement | null;
    target?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [selected]);

  const yearStarts = useMemo(() => {
    const seen = new Set<string>();
    return new Set(summary.periods.filter((item) => {
      const year = item.period.slice(0, 4);
      if (seen.has(year)) return false;
      seen.add(year);
      return true;
    }).map((item) => item.period));
  }, [summary.periods]);

  const maxPlace = Math.max(1, ...places.map((item) => item.files));
  const progress = summary.total ? Math.min(100, summary.processed / summary.total * 100) : 0;

  return (
    <div className="fv-indexed-timeline" style={{ padding: "22px 30px 42px", animation: "fvFade .28s ease" }}>
      <div style={{ ...card, padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>家庭影像时间轴</div>
            <div style={{ marginTop: 5, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55 }}>
              横向选择月份，纵向展开当月地点。全部来自本机索引，不读取整张照片，也不联网查询地名。
            </div>
          </div>
          <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
            <div style={{ fontSize: 12, color: summary.analysisStatus === "running" ? "var(--accent)" : "var(--green)" }}>
              {summary.analysisStatus === "running" ? "● 时间地点分析中" : summary.analysisStatus === "completed" ? "✓ 分析完成" : "Ⅱ 可继续分析"}
            </div>
            <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-tertiary)" }}>{summary.processed.toLocaleString()} / {summary.total.toLocaleString()}</div>
          </div>
        </div>
        <div style={{ height: 6, marginTop: 13, borderRadius: 5, overflow: "hidden", background: "var(--track)" }}>
          <div style={{ width: `${progress}%`, height: "100%", borderRadius: 5, background: "var(--accent)", transition: "width .35s ease" }} />
        </div>
        {!!summary.suspiciousTime && <div style={{ marginTop: 8, fontSize: 11, color: "var(--orange)" }}>另有 {summary.suspiciousTime.toLocaleString()} 项异常时间已移入待确认，不混入主时间轴。</div>}
      </div>

      <div style={{ ...card, padding: "18px 0 15px", marginTop: 16, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, padding: "0 20px 13px" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>时间</div>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>柱高代表当月媒体数量 · 圆点代表 GPS 覆盖率</div>
        </div>
        <div ref={axisRef} className="fv-scroll fv-time-axis" style={{ display: "flex", alignItems: "flex-end", gap: 4, overflowX: "auto", padding: "7px 20px 9px", scrollSnapType: "x proximity" }}>
          {summary.periods.map((item) => {
            const active = item.period === selected;
            const height = 18 + Math.sqrt(item.files / maxFiles) * 58;
            const gpsPct = item.files ? item.gps / item.files : 0;
            const [year, month] = item.period.split("-");
            return (
              <button key={item.period} data-period={item.period} type="button" aria-pressed={active}
                onClick={() => setSelected(item.period)} className="fv-tap fv-time-node"
                style={{ flex: "0 0 52px", scrollSnapAlign: "center", border: "none", borderRadius: 10, padding: "7px 5px 6px", background: active ? "var(--accent-soft)" : "transparent", color: active ? "var(--accent)" : "var(--text-secondary)", cursor: "pointer", textAlign: "center" }}>
                <span style={{ display: "block", height: 13, fontSize: 10.5, color: yearStarts.has(item.period) ? "var(--text-primary)" : "transparent", fontWeight: 500 }}>{year}</span>
                <span style={{ height: 78, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                  <span style={{ width: 18, height, display: "block", borderRadius: "6px 6px 3px 3px", background: active ? "var(--accent)" : "var(--separator-strong)", transition: "height .3s ease, background .2s ease", position: "relative" }}>
                    <span aria-hidden style={{ position: "absolute", left: "50%", bottom: Math.max(3, height * gpsPct - 3), width: 6, height: 6, transform: "translateX(-50%)", borderRadius: "50%", background: active ? "#fff" : "var(--accent)" }} />
                  </span>
                </span>
                <span style={{ display: "block", marginTop: 5, fontSize: 11, fontWeight: active ? 600 : 400 }}>{Number(month)}月</span>
                <span style={{ display: "block", marginTop: 2, fontSize: 9.5, color: "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}>{compact(item.files)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ ...card, padding: "18px 20px 20px", marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{selected ? monthLabel(selected) : "地点"}</div>
            <div style={{ marginTop: 4, fontSize: 11.5, color: "var(--text-tertiary)" }}>
              {selectedPeriod ? `${selectedPeriod.files.toLocaleString()} 项 · GPS ${selectedPeriod.gps.toLocaleString()} · 待确认 ${selectedPeriod.needsReview.toLocaleString()}` : "正在整理地点…"}
            </div>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>地点按约 10 公里范围聚合</div>
        </div>

        {error && <div style={{ color: "var(--red)", fontSize: 12 }}>{error}</div>}
        {loadingPlaces && places.length === 0 ? (
          <div style={{ padding: "24px 0", color: "var(--text-tertiary)", fontSize: 12 }}>正在展开地点…</div>
        ) : (
          <div key={selected} className="fv-location-axis" style={{ position: "relative", display: "grid", gap: 8 }}>
            {places.map((place, index) => (
              <PlaceRow key={place.key} place={place} max={maxPlace} index={index} />
            ))}
            {!places.length && <div style={{ padding: "24px 0", color: "var(--text-tertiary)", fontSize: 12 }}>这个月暂时没有已分析的地点数据。</div>}
          </div>
        )}
      </div>
    </div>
  );
}

function PlaceRow({ place, max, index }: { place: RemoteTimelinePlace; max: number; index: number }) {
  const unknown = place.key === "unknown";
  const imagePct = place.files ? place.images / place.files * 100 : 0;
  const videoPct = place.files ? place.videos / place.files * 100 : 0;
  return (
    <div className="fv-location-row fv-rise-up" style={{ animationDelay: `${Math.min(index, 12) * 28}ms`, display: "grid", gridTemplateColumns: "minmax(145px, .9fr) minmax(180px, 2.1fr) auto", alignItems: "center", gap: 14, padding: "10px 11px", borderRadius: 10, background: "var(--fill-quaternary)" }}>
      <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 9 }}>
        <span style={{ width: 24, height: 24, flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", color: unknown ? "var(--orange)" : "var(--accent)", background: unknown ? "color-mix(in srgb,var(--orange) 12%,transparent)" : "var(--accent-soft)" }}><IconPin size={13} stroke="currentColor" /></span>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{place.label}</span>
          {place.context && <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2, fontSize: 10.5, color: "var(--text-tertiary)" }}>{place.context}</span>}
        </span>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ height: 8, width: `${Math.max(3, place.files / max * 100)}%`, minWidth: 8, display: "flex", overflow: "hidden", borderRadius: 6, background: "var(--track)", transition: "width .35s ease" }}>
          <span style={{ width: `${imagePct}%`, background: unknown ? "var(--text-tertiary)" : "var(--accent)" }} />
          <span style={{ width: `${videoPct}%`, background: "var(--orange)" }} />
        </div>
        <div style={{ marginTop: 5, fontSize: 10.5, color: "var(--text-tertiary)" }}>照片 {place.images.toLocaleString()} · 视频 {place.videos.toLocaleString()}{place.needsReview ? ` · 待确认 ${place.needsReview.toLocaleString()}` : ""}</div>
      </div>
      <div style={{ textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{place.files.toLocaleString()} 项</div>
        <div style={{ marginTop: 2, fontSize: 10.5, color: "var(--text-tertiary)" }}>{fmtSize(place.bytes)}</div>
      </div>
    </div>
  );
}

function monthLabel(period: string) {
  const [year, month] = period.split("-");
  return `${year} 年 ${Number(month)} 月的地点`;
}

function compact(value: number) {
  if (value >= 10000) return `${(value / 10000).toFixed(value >= 100000 ? 0 : 1)}万`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}
