import { useEffect, useMemo, useRef, useState } from "react";
import { fmtSize } from "../lib/format";
import { getBrowseItems, getPhotoStorageStatus, getTrashPreview, getTrashPreviewMany, getTrashStatus, moveToTrash, moveManyToTrash, restoreFromTrash,
  previewManualArchive, moveManualArchive,
  type ArchivePrecision, type ArchivePreview, type BrowseHint, type BrowseItem, type BrowseScope,
  type BrowseSort, type BrowseSummary, type PhotoStorageStatus, type TrashBatch } from "../lib/remoteIndex";
import { loadCss, loadScript } from "../lib/cdn";
import AddressLookup from "../components/AddressLookup";
import PeopleReferenceLibrary from "../components/PeopleReferenceLibrary";
import AddPersonFromPhoto from "../components/AddPersonFromPhoto";
import { card } from "../ui";

const thumbnailSizes = [320, 260, 210, 160, 130, 105, 84] as const;
const itemsPerPage = [24, 32, 40, 48, 72, 96, 120] as const;
const thumbnailZoomKey = "family-gallery-thumbnail-zoom-v1";
function savedThumbnailZoom() {
  try {
    const value = Number(window.localStorage.getItem(thumbnailZoomKey) ?? 3);
    return Number.isInteger(value) && value >= 0 && value < thumbnailSizes.length ? value : 3;
  } catch { return 3; }
}
const muted = { color: "var(--text-tertiary)", fontSize: 12 } as const;
const button = { border: "1px solid var(--separator)", background: "var(--bg-elevated)", color: "var(--text-primary)", borderRadius: 8, padding: "7px 11px", cursor: "pointer" } as const;

function precision(item: BrowseItem) {
  if (item.timePrecision === "year") return "仅确定年份";
  if (item.timePrecision === "unknown") return "时间待确认";
  if (item.timePrecision === "month") return "仅确定月份";
  return item.captureTime?.slice(0, 10) || "日期待确认";
}

function SinglePreview({ item }: { item: BrowseItem }) {
  const [failed, setFailed] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  if (item.kind === "video") {
    if (failed) return <div style={{ ...muted, padding: 24, textAlign: "center" }}>浏览器暂时无法播放这个视频格式。封面和原文件信息仍可查看。</div>;
    const params = new URLSearchParams({ path: item.relPath });
    return <div style={{ textAlign: "center", marginTop: 12 }}>
      <button style={button} onClick={() => void videoRef.current?.play()}>▶ 播放视频</button>
      <video ref={videoRef} controls preload="metadata" playsInline
      poster={`/api/photos/browse/preview?${params}&size=384`}
      src={`/api/photos/browse/video?${params}`}
      onError={() => setFailed(true)}
      style={{ display: "block", maxWidth: "100%", maxHeight: "55vh", margin: "12px auto", borderRadius: 8 }} />
    </div>;
  }
  if (failed) return <div style={{ ...muted, padding: 24, textAlign: "center" }}>这张照片暂时无法预览，原片未被修改。</div>;
  const params = new URLSearchParams({ path: item.relPath });
  return <div style={{ textAlign: "center" }}>
    <button style={{ ...button, marginTop: 12 }} onClick={() => setZoomed((value) => !value)}>{zoomed ? "适合窗口" : "放大查看"}</button>
    <div style={{ maxHeight: "58vh", overflow: "auto", marginTop: 10 }}>
      <img src={`/api/photos/browse/preview?${params}`} alt={item.name} onError={() => setFailed(true)}
        style={{ display: "block", maxWidth: zoomed ? "none" : "100%", maxHeight: zoomed ? "none" : "53vh", objectFit: "contain", margin: "0 auto", borderRadius: 8 }} />
    </div>
  </div>;
}

export function MediaList({ scope, scopeKey, title, initialKind = "all", initialHint = "all", faceSample = false }: { scope: BrowseScope; scopeKey?: string; title: string; initialKind?: "all" | "image" | "video"; initialHint?: BrowseHint; faceSample?: boolean }) {
  const [kind, setKind] = useState<"all" | "image" | "video">(initialKind);
  const [sort, setSort] = useState<BrowseSort>("newest");
  const [hint, setHint] = useState<BrowseHint>(initialHint);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [thumbnailZoom, setThumbnailZoom] = useState(savedThumbnailZoom);
  const pageSize = itemsPerPage[thumbnailZoom];
  const thumbnailSize = thumbnailSizes[thumbnailZoom];
  const compactThumbnails = thumbnailZoom >= 4;
  const changeThumbnailZoom = (next: number) => {
    const index = Math.max(0, Math.min(thumbnailSizes.length - 1, next));
    if (index === thumbnailZoom) return;
    setPage((current) => Math.floor(current * pageSize / itemsPerPage[index]));
    setThumbnailZoom(index);
  };
  const [data, setData] = useState<{ total: number; items: BrowseItem[] } | null>(null);
  const [error, setError] = useState("");
  const [chosen, setChosen] = useState<BrowseItem | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [archivePaths, setArchivePaths] = useState<string[]>([]);
  const [archivePrecision, setArchivePrecision] = useState<ArchivePrecision>("month");
  const [archiveDate, setArchiveDate] = useState("");
  const [archivePreview, setArchivePreview] = useState<ArchivePreview | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveError, setArchiveError] = useState("");
  const [revision, setRevision] = useState(0);
  const [trashBusy, setTrashBusy] = useState(false);
  const [trashError, setTrashError] = useState("");
  const [showTrash, setShowTrash] = useState(false);
  const [trashBatches, setTrashBatches] = useState<TrashBatch[]>([]);
  const [trashPending, setTrashPending] = useState(0);
  const [cachePending, setCachePending] = useState(0);
  const [lastTrashed, setLastTrashed] = useState<string | null>(null);
  const [personItem, setPersonItem] = useState<BrowseItem | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [thumbProgress, setThumbProgress] = useState({ done: 0, total: 0 });
  const [storageAvailable, setStorageAvailable] = useState<boolean | null>(null);
  const [thumbRetry, setThumbRetry] = useState(0);
  const previousStorageAvailable = useRef<boolean | null>(null);
  useEffect(() => { try { window.localStorage.setItem(thumbnailZoomKey, String(thumbnailZoom)); } catch { /* Storage can be unavailable. */ } }, [thumbnailZoom]);
  const chosenIndex = chosen && data ? data.items.findIndex((item) => item.relPath === chosen.relPath) : -1;
  const move = (step: number) => {
    if (!data || chosenIndex < 0) return;
    const next = data.items[chosenIndex + step];
    if (next) setChosen(next);
  };
  const reloadTrash = async () => {
    const status = await getTrashStatus();
    if (status.ok) { setTrashBatches(status.batches); setTrashPending(status.pendingCount || 0); setCachePending(status.cachePendingCount || 0); }
  };
  const removeChosen = async () => {
    if (!chosen || trashBusy) return;
    setTrashBusy(true);
    setTrashError("");
    try {
      const preview = await getTrashPreview(chosen.relPath);
      if (!preview.ok) throw new Error(preview.error || "无法核对这项影像");
      const names = preview.items.map((item) => `${item.kind === "video" ? "视频" : "照片"}：${item.name}`).join("\n");
      if (!window.confirm(`将以下文件移到 S300 回收站？可在图库中恢复。\n\n${names}`)) return;
      const result = await moveToTrash(chosen.relPath, preview.items.map((item) => item.relPath));
      if (!result.ok || !result.batchId) throw new Error(result.error || "移入回收站失败");
      setLastTrashed(result.batchId);
      setCachePending(result.cache?.pending || 0);
      setChosen(null);
      setRevision((value) => value + 1);
      window.dispatchEvent(new Event("photo-library-changed"));
      if (showTrash) await reloadTrash();
    } catch (err) { setTrashError(err instanceof Error ? err.message : "移入回收站失败"); }
    finally { setTrashBusy(false); }
  };
  const removeSelected = async () => {
    if (trashBusy || !selectedPaths.length || selectedPaths.length > 200) return;
    setTrashBusy(true); setTrashError("");
    try {
      const preview = await getTrashPreviewMany(selectedPaths);
      if (!preview.ok) throw new Error(preview.error || "无法核对所选影像");
      const bytes = preview.items.reduce((sum, item) => sum + item.size, 0);
      const examples = preview.items.slice(0, 8).map((item) => item.name).join("、");
      if (!window.confirm(`将 ${preview.items.length} 个文件（${fmtSize(bytes)}）移到 S300 回收站？关联的照片或视频也会一起移动，可整批恢复。\n\n${examples}${preview.items.length > 8 ? "…" : ""}`)) return;
      const result = await moveManyToTrash(selectedPaths, preview.items.map((item) => item.relPath));
      if (!result.ok || !result.batchId) throw new Error(result.error || "批量移入回收站失败");
      setLastTrashed(result.batchId); setCachePending(result.cache?.pending || 0);
      setSelectedPaths([]); setSelecting(false); setChosen(null);
      setRevision((value) => value + 1);
      window.dispatchEvent(new Event("photo-library-changed"));
      if (showTrash) await reloadTrash();
    } catch (err) { setTrashError(err instanceof Error ? err.message : "批量移入回收站失败"); setRevision((value) => value + 1); }
    finally { setTrashBusy(false); }
  };
  const restore = async (batchId: string) => {
    if (trashBusy) return;
    setTrashBusy(true);
    setTrashError("");
    try {
      const result = await restoreFromTrash(batchId);
      if (!result.ok) throw new Error(result.error || "恢复失败");
      if (lastTrashed === batchId) setLastTrashed(null);
      setRevision((value) => value + 1);
      window.dispatchEvent(new Event("photo-library-changed"));
      await reloadTrash();
    } catch (err) { setTrashError(err instanceof Error ? err.message : "恢复失败"); }
    finally { setTrashBusy(false); }
  };
  const beginArchive = (paths: string[]) => {
    setArchivePaths(paths);
    setArchivePrecision("month");
    setArchiveDate("");
    setArchivePreview(null);
    setArchiveError("");
  };
  const toggleSelected = (path: string) => setSelectedPaths((previous) =>
    previous.includes(path) ? previous.filter((value) => value !== path) : previous.length < 200 ? [...previous, path] : previous);
  const loadArchivePreview = async () => {
    setArchiveBusy(true);
    setArchiveError("");
    try {
      const preview = await previewManualArchive(archivePaths, archivePrecision, archiveDate);
      if (!preview.ok) throw new Error(preview.error || "无法生成归档预览");
      setArchivePreview(preview);
    } catch (err) { setArchiveError(err instanceof Error ? err.message : "无法生成归档预览"); }
    finally { setArchiveBusy(false); }
  };
  const executeArchive = async () => {
    if (!archivePreview || archiveBusy) return;
    setArchiveBusy(true);
    setArchiveError("");
    try {
      const result = await moveManualArchive(archivePaths, archivePreview);
      if (!result.ok) throw new Error(result.error || "归档未完成");
      setArchivePaths([]);
      setArchivePreview(null);
      setSelectedPaths([]);
      setSelecting(false);
      setChosen(null);
      setRevision((value) => value + 1);
      window.dispatchEvent(new Event("photo-library-changed"));
    } catch (err) { setArchiveError(err instanceof Error ? err.message : "归档未完成"); setRevision((value) => value + 1); }
    finally { setArchiveBusy(false); }
  };
  useEffect(() => { setPage(0); setChosen(null); setSelectedPaths([]); setSelecting(false); }, [scope, scopeKey, kind, sort, hint, query]);
  useEffect(() => {
    let live = true;
    const checkStorage = async () => {
      try {
        const status = await getPhotoStorageStatus();
        if (live) setStorageAvailable(status.cache.status !== "unavailable");
      } catch { if (live) setStorageAvailable(null); }
    };
    void checkStorage();
    const timer = window.setInterval(() => void checkStorage(), 15000);
    return () => { live = false; window.clearInterval(timer); };
  }, []);
  useEffect(() => {
    if (storageAvailable && previousStorageAvailable.current === false) setThumbRetry((value) => value + 1);
    previousStorageAvailable.current = storageAvailable;
  }, [storageAvailable]);
  useEffect(() => {
    let live = true;
    setData(null);
    getBrowseItems({ scope, key: scopeKey, kind, sort, hint, q: query, offset: page * pageSize, limit: pageSize })
      .then((next) => {
        if (!live) return;
        if (!next.ok) throw new Error(next.error || "读取影像列表失败");
        setData(next);
        setError("");
      })
      .catch((err) => { if (live) setError(err instanceof Error ? err.message : "读取影像列表失败"); });
    return () => { live = false; };
  }, [scope, scopeKey, kind, sort, hint, query, page, pageSize, revision]);
  useEffect(() => {
    const items = data?.items || [];
    const controller = new AbortController();
    const urls: string[] = [];
    let active = true;
    let next = 0;
    let done = 0;
    setThumbs({});
    setThumbProgress({ done: 0, total: items.length });
    const worker = async () => {
      while (active && next < items.length) {
        const item = items[next++];
        try {
          const params = new URLSearchParams({ path: item.relPath, size: "384" });
          const response = await fetch(`/api/photos/browse/preview?${params}`, { signal: controller.signal });
          if (!response.ok) throw new Error("无法生成缩略图");
          const url = URL.createObjectURL(await response.blob());
          if (active) { urls.push(url); setThumbs((previous) => ({ ...previous, [item.relPath]: url })); }
          else URL.revokeObjectURL(url);
        } catch { /* Individual unsupported media keeps its placeholder. */ }
        if (active) { done++; setThumbProgress({ done, total: items.length }); }
      }
    };
    void Promise.all([worker(), worker()]);
    return () => { active = false; controller.abort(); urls.forEach(URL.revokeObjectURL); };
  }, [data, thumbRetry]);
  useEffect(() => {
    if (!chosen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setChosen(null);
      else if (event.key === "ArrowLeft") move(-1);
      else if (event.key === "ArrowRight") move(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chosen, chosenIndex, data]);
  return (
    <section style={{ ...card, padding: 18, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <strong style={{ color: "var(--text-primary)", fontSize: 15, marginRight: "auto" }}>{title}</strong>
        <span style={muted}>{data ? data.total.toLocaleString() + " 项" : "读取中…"}</span>
        {thumbProgress.total > 0 && thumbProgress.done < thumbProgress.total && <span style={muted}>缩略图 {thumbProgress.done}/{thumbProgress.total}</span>}
        <div role="group" aria-label="缩略图大小" style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <button type="button" style={button} onClick={() => changeThumbnailZoom(thumbnailZoom - 1)} disabled={thumbnailZoom === 0} aria-label="放大缩略图">＋</button>
          <input type="range" min={0} max={thumbnailSizes.length - 1} step={1} value={thumbnailZoom}
            onChange={(event) => changeThumbnailZoom(Number(event.target.value))} aria-label="缩略图大小"
            style={{ width: 90, accentColor: "var(--accent)" }} />
          <button type="button" style={button} onClick={() => changeThumbnailZoom(thumbnailZoom + 1)} disabled={thumbnailZoom === thumbnailSizes.length - 1} aria-label="缩小缩略图">－</button>
          <span style={{ ...muted, minWidth: 27, textAlign: "center" }}>{thumbnailZoom + 1}/{thumbnailSizes.length}</span>
        </div>
        <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} aria-label="媒体类型" style={button}>
          <option value="all">全部</option><option value="image">照片</option><option value="video">视频</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as BrowseSort)} aria-label="排序方式" style={button}>
          <option value="newest">时间：新到旧</option><option value="oldest">时间：旧到新</option>
          <option value="name_asc">文件名：升序</option><option value="name_desc">文件名：降序</option>
          <option value="size_desc">大小：大到小</option><option value="size_asc">大小：小到大</option>
        </select>
        <select value={hint} onChange={(e) => setHint(e.target.value as BrowseHint)} aria-label="文件名线索" style={button}>
          <option value="all">全部线索</option><option value="screenshot">截图文件名</option><option value="screen_recording">录屏文件名</option>
        </select>
        <form onSubmit={(e) => { e.preventDefault(); setQuery(draft.trim()); }} style={{ display: "flex", gap: 5 }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="搜索文件名" aria-label="搜索文件名"
            style={{ ...button, cursor: "text", width: 130 }} />
          <button type="submit" style={button}>查找</button>
        </form>
        <button style={button} onClick={() => { setShowTrash((value) => !value); void reloadTrash(); }}>回收站</button>
        <button style={button} onClick={() => { setSelecting((value) => !value); setSelectedPaths([]); }} aria-pressed={selecting}>{selecting ? "完成选择" : "批量选择"}</button>
      </div>
      {selecting && <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <span style={muted}>已选 {selectedPaths.length} 项；可翻页继续选择，最多 200 项。</span>
        <button style={button} onClick={() => setSelectedPaths((previous) => [...new Set([...previous, ...(data?.items.map((item) => item.relPath) || [])])].slice(0, 200))}>选择本页</button>
        <button style={button} onClick={() => setSelectedPaths([])}>清空选择</button>
        <button style={button} disabled={!selectedPaths.length || selectedPaths.length > 200} onClick={() => beginArchive(selectedPaths)}>批量归档…</button>
        <button style={{ ...button, color: "var(--red)" }} disabled={!selectedPaths.length || selectedPaths.length > 200 || trashBusy} onClick={() => void removeSelected()}>{trashBusy ? "核对中…" : "批量移到回收站…"}</button>
      </div>}
      {lastTrashed && <div style={{ ...muted, marginBottom: 10 }}>已移入 S300 回收站。 <button style={button} onClick={() => void restore(lastTrashed)} disabled={trashBusy}>恢复刚才的影像</button></div>}
      {trashError && <div style={{ color: "var(--red)", fontSize: 12, marginBottom: 10 }}>{trashError}</div>}
      {cachePending > 0 && <div style={{ color: "var(--orange)", fontSize: 12, marginBottom: 10 }}>{cachePending} 张预览缓存待清理；S300 连接正常后打开回收站会重试。</div>}
      {showTrash && <div style={{ ...card, padding: 12, marginBottom: 14, maxHeight: 220, overflowY: "auto" }}>
        <strong style={{ color: "var(--text-primary)", fontSize: 13 }}>S300 回收站</strong>
        {trashPending > 0 && <div style={{ color: "var(--orange)", fontSize: 12 }}>有 {trashPending} 项操作待核对，请保持 S300 已连接。</div>}
        {trashBatches.length === 0 && <div style={muted}>回收站暂无影像。</div>}
        {trashBatches.map((batch) => <div key={batch.batchId} style={{ display: "flex", gap: 8, alignItems: "center", paddingTop: 8 }}>
          <span style={{ ...muted, flex: 1, overflowWrap: "anywhere" }}>{batch.paths.map((p) => p.split("/").pop()).join("、")} · {fmtSize(batch.bytes)}</span>
          <button style={button} onClick={() => void restore(batch.batchId)} disabled={trashBusy}>恢复</button>
        </div>)}
      </div>}
      {error && <div style={{ color: "var(--red)", fontSize: 12, marginBottom: 12 }}>{error}</div>}
      {storageAvailable === false && <div role="status" style={{ color: "var(--orange)", fontSize: 13, marginBottom: 12 }}>
        S300 当前未挂载。照片列表来自本机索引，原片和缩略图需要连接 S300 才能显示；连接恢复后页面会自动重试。
      </div>}
      {!data && !error && <div style={muted}>正在读取本机索引…</div>}
      {data?.items.length === 0 && <div style={muted}>这个分类没有匹配的照片或视频。</div>}
      {data && data.items.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${thumbnailSize}px), 1fr))`, gap: compactThumbnails ? 5 : 10 }}>
          {data.items.map((item) => (
            <button key={item.relPath} onClick={() => selecting ? toggleSelected(item.relPath) : setChosen(item)} title={item.relPath}
              aria-label={`${item.name}，${precision(item)}，${item.kind === "video" ? "视频" : "照片"}`}
              aria-pressed={selecting ? selectedPaths.includes(item.relPath) : undefined}
              style={{ ...card, padding: 0, overflow: "hidden", textAlign: "left", border: selectedPaths.includes(item.relPath) ? "2px solid var(--accent)" : "1px solid var(--separator)", cursor: "pointer" }}>
              <div style={{ height: thumbnailSize, position: "relative", background: "var(--fill-quaternary)", display: "grid", placeItems: "center", color: "var(--accent)", fontSize: compactThumbnails ? 20 : 30 }}>
                {thumbs[item.relPath]
                  ? <img src={thumbs[item.relPath]} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center" }} />
                  : item.kind === "video" ? "▶" : "▧"}
                {item.kind === "video" && <span aria-label="视频，点击播放" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "white", fontSize: 28, textShadow: "0 1px 8px black" }}>▶</span>}
                {selecting && <span style={{ position: "absolute", top: 7, left: 7, padding: "3px 6px", background: "var(--bg-elevated)", borderRadius: 5, fontSize: 14 }}>{selectedPaths.includes(item.relPath) ? "☑" : "☐"}</span>}
              </div>
              {!compactThumbnails && <div style={{ padding: 10 }}>
                <div style={{ color: "var(--text-primary)", fontSize: 12, fontWeight: 600, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{item.name}</div>
                <div style={{ ...muted, marginTop: 5 }}>{precision(item)} · {fmtSize(item.size)}</div>
              </div>}
            </button>
          ))}
        </div>
      )}
      {data && data.total > pageSize && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 18 }}>
          <button style={button} disabled={page === 0} onClick={() => setPage(page - 1)}>上一页</button>
          <span style={muted}>第 {page + 1} / {Math.ceil(data.total / pageSize)} 页</span>
          <button style={button} disabled={(page + 1) * pageSize >= data.total} onClick={() => setPage(page + 1)}>下一页</button>
        </div>
      )}
      {chosen && (
        <div role="dialog" aria-modal="true" aria-label="影像详情" onClick={() => setChosen(null)}
          style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,.56)", display: "grid", placeItems: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...card, maxWidth: 610, width: "100%", padding: 24 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <strong style={{ color: "var(--text-primary)", overflowWrap: "anywhere", flex: 1 }}>{chosen.name}</strong>
              <button style={button} onClick={() => move(-1)} disabled={chosenIndex <= 0} aria-label="上一项">←</button>
              <button style={button} onClick={() => move(1)} disabled={!data || chosenIndex >= data.items.length - 1} aria-label="下一项">→</button>
              <button style={{ ...button, color: "var(--red)" }} onClick={() => void removeChosen()} disabled={trashBusy}>移到回收站</button>
              <button style={button} onClick={() => beginArchive([chosen.relPath])}>选择时间归档…</button>
              {chosen.kind === "image" && <button style={button} onClick={() => setPersonItem(chosen)}>添加人物…</button>}
              {faceSample && chosen.kind === "image" && <button style={button} onClick={() => {
                window.dispatchEvent(new CustomEvent("photo-person-sample-request", { detail: { path: chosen.relPath, name: chosen.name } }));
                setChosen(null);
              }}>选为人物样本</button>}
              <button style={button} onClick={() => setChosen(null)}>关闭</button>
            </div>
            <SinglePreview key={chosen.relPath} item={chosen} />
            <div style={{ ...muted, lineHeight: 1.9, marginTop: 12 }}>
              <div>{chosen.kind === "video" ? "视频" : "照片"} · {fmtSize(chosen.size)} · {precision(chosen)}</div>
              {chosen.latitude != null && chosen.longitude != null && <div>地点：<AddressLookup latitude={chosen.latitude} longitude={chosen.longitude} /></div>}
              <div style={{ overflowWrap: "anywhere" }}>{chosen.relPath}</div>
              <div>原片保存在 S300；当前页的小型缩略图缓存在 S300。</div>
            </div>
          </div>
        </div>
      )}
      {archivePaths.length > 0 && <div role="dialog" aria-modal="true" aria-label="时间归档" onClick={() => !archiveBusy && setArchivePaths([])}
        style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(0,0,0,.62)", display: "grid", placeItems: "center", padding: 20 }}>
        <div onClick={(event) => event.stopPropagation()} style={{ ...card, width: "100%", maxWidth: 630, maxHeight: "85vh", overflowY: "auto", padding: 24, display: "grid", gap: 12 }}>
          <strong style={{ color: "var(--text-primary)" }}>选择归档时间 · {archivePaths.length} 项</strong>
          <span style={muted}>按您确定的时间放到对应年份目录。仅知道年份或月份时，不会补造日期。</span>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <select value={archivePrecision} onChange={(event) => { setArchivePrecision(event.target.value as ArchivePrecision); setArchiveDate(""); setArchivePreview(null); }} style={button} aria-label="时间精度">
              <option value="year">只确定年份</option><option value="month">确定到月份</option><option value="day">确定到日期</option>
            </select>
            <input type={archivePrecision === "year" ? "number" : archivePrecision === "month" ? "month" : "date"}
              min={archivePrecision === "year" ? 1900 : "1900-01"}
              max={archivePrecision === "year" ? new Date().getFullYear() + 1 : undefined}
              value={archiveDate} onChange={(event) => { setArchiveDate(event.target.value); setArchivePreview(null); }}
              placeholder="输入年份" aria-label="归档时间" style={{ ...button, cursor: "text" }} />
            <button style={button} disabled={!archiveDate || archiveBusy} onClick={() => void loadArchivePreview()}>{archiveBusy ? "核对中…" : "预览目标"}</button>
          </div>
          {archiveError && <div style={{ color: "var(--red)", fontSize: 12 }}>{archiveError}</div>}
          {archivePreview && <>
            <div style={muted}>将移动 {archivePreview.count} 个文件到 {archivePreview.targetDirectory}。关联的 Live Photo 视频也会一起归档。</div>
            <div style={{ maxHeight: 230, overflowY: "auto", fontSize: 12, color: "var(--text-secondary)", overflowWrap: "anywhere" }}>
              {archivePreview.items.map((item) => <div key={item.sourceRel} style={{ padding: "5px 0", borderBottom: "1px solid var(--separator)" }}>{item.sourceRel} → {item.targetRel}</div>)}
            </div>
          </>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button style={button} disabled={archiveBusy} onClick={() => setArchivePaths([])}>取消</button>
            <button style={button} disabled={!archivePreview?.count || archiveBusy} onClick={() => void executeArchive()}>{archiveBusy ? "归档中…" : "确认归档"}</button>
          </div>
        </div>
      </div>}
      {personItem && <AddPersonFromPhoto item={personItem} onClose={() => setPersonItem(null)} onSaved={() => {
        setRevision((value) => value + 1);
        window.dispatchEvent(new Event("photo-library-changed"));
      }} />}
    </section>
  );
}

function Shell({ intro, children }: { intro: string; children: React.ReactNode }) {
  return <div className="fv-indexed-shell" style={{ padding: "20px 30px 42px", display: "grid", gap: 16, animation: "fvFade .28s ease" }}>
    <div style={{ ...card, padding: 16, ...muted, lineHeight: 1.6 }}>{intro}</div>{children}
  </div>;
}

function GroupButton({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
  return <button onClick={onClick} aria-pressed={active} style={{
    ...button, display: "flex", justifyContent: "space-between", gap: 16, textAlign: "left",
    background: active ? "var(--accent-soft)" : "var(--bg-elevated)", color: active ? "var(--accent)" : "var(--text-primary)"
  }}><span>{label}</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{count.toLocaleString()}</span></button>;
}

export function IndexedSummary({ summary, onNavigate }: { summary: BrowseSummary; onNavigate: (screen: "gallery" | "timeline" | "places" | "events" | "people") => void }) {
  const [storage, setStorage] = useState<PhotoStorageStatus | null>(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    const poll = async (force = false) => {
      try {
        const result = await getPhotoStorageStatus(force);
        if (!active) return;
        setStorage(result);
        timer = window.setTimeout(() => void poll(), result.cache.status === "scanning" ? 5000 : 60000);
      } catch {
        if (active) timer = window.setTimeout(() => void poll(), 60000);
      }
    };
    void poll(refresh > 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [refresh]);
  const groups = [
    { label: "家庭影像", count: summary.total, screen: "gallery" as const },
    { label: "年月目录", count: summary.months.length, screen: "timeline" as const },
    { label: "带定位影像", count: summary.gpsTotal, screen: "places" as const },
    { label: "日期候选", count: summary.events.length, screen: "events" as const },
    { label: "仅确定年份", count: summary.yearOnly.reduce((n, row) => n + row.files, 0), screen: "gallery" as const },
    { label: "未能归档", count: summary.unclassified, screen: "gallery" as const },
  ];
  return <Shell intro="家庭影像库索引概况。数据来自本机索引，重复文件清理期间会持续刷新。">
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(155px,1fr))", gap: 12 }}>
      {groups.map((group) => <button key={group.label} onClick={() => onNavigate(group.screen)}
        style={{ ...card, padding: 18, textAlign: "left", cursor: "pointer", border: "1px solid var(--separator)" }}>
        <div style={muted}>{group.label}</div>
        <div style={{ color: "var(--text-primary)", fontSize: 24, fontWeight: 700, marginTop: 8 }}>{group.count.toLocaleString()}</div>
      </button>)}
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
      <div style={{ ...card, padding: 18 }}>
        <div style={muted}>S300 缩略图缓存</div>
        <div style={{ color: "var(--text-primary)", fontSize: 24, fontWeight: 700, marginTop: 8 }}>
          {storage?.cache.bytes != null ? fmtSize(storage.cache.bytes) : storage?.cache.status === "unavailable" ? "S300 未连接" : "统计中…"}
        </div>
        <div style={{ ...muted, marginTop: 7 }}>
          {storage?.cache.status === "unavailable" ? "S300 未连接，显示上次统计" :
            storage?.cache.status === "scanning" ? "正在更新容量" :
            storage?.cache.status === "error" ? "暂时无法统计" : "照片缩略图与视频封面，可重新生成"}
        </div>
        <button style={{ ...button, marginTop: 10 }} onClick={() => setRefresh((value) => value + 1)}
          disabled={storage?.cache.status === "scanning" || storage?.cache.status === "unavailable"}>重新统计</button>
      </div>
      <div style={{ ...card, padding: 18 }}>
        <div style={muted}>本机数据库</div>
        <div style={{ color: "var(--text-primary)", fontSize: 24, fontWeight: 700, marginTop: 8 }}>
          {storage ? fmtSize(storage.database.totalBytes) : "读取中…"}
        </div>
        <div style={{ ...muted, marginTop: 7 }}>
          {storage && `影像索引 ${fmtSize(storage.database.indexBytes)} · 人物样本 ${fmtSize(storage.database.peopleBytes)}`}
        </div>
      </div>
    </div>
    <div style={{ ...card, padding: 18, lineHeight: 1.7, color: "var(--text-secondary)", fontSize: 12 }}>
      人物尚未建立可信索引；进入人物页可查看当前状态。图库会为当前页按需生成照片缩略图和视频封面，并缓存在 S300。
      <button onClick={() => onNavigate("people")} style={{ ...button, display: "block", marginTop: 10 }}>查看人物状态</button>
    </div>
  </Shell>;
}

export function IndexedGallery({ summary }: { summary: BrowseSummary }) {
  const latest = summary.months[0]?.period;
  const [selected, setSelected] = useState<{ scope: BrowseScope; key?: string; title: string }>(latest
    ? { scope: "month", key: latest, title: `${latest} · 照片与视频` }
    : { scope: "all", title: "全部家庭影像" });
  return <Shell intro={`家庭影像库现有 ${summary.total.toLocaleString()} 项。按目录中的年月归类；仅确定年份和未能归档的文件单列，不补造拍摄日期。`}>
    <div className="fv-indexed-columns" style={{ display: "grid", gridTemplateColumns: "minmax(200px,240px) minmax(0,1fr)", gap: 16, alignItems: "start" }}>
      <div style={{ ...card, padding: 12, display: "grid", gap: 6, maxHeight: "70vh", overflowY: "auto" }}>
        <GroupButton active={selected.scope === "all"} label="全部" count={summary.total} onClick={() => setSelected({ scope: "all", title: "全部家庭影像" })} />
        {summary.yearOnly.map((row) => <GroupButton key={row.year} active={selected.scope === "year_only" && selected.key === row.year}
          label={`${row.year} · 仅年份`} count={row.files}
          onClick={() => setSelected({ scope: "year_only", key: row.year, title: `${row.year} 年 · 仅确定年份` })} />)}
        {!!summary.unclassified && <GroupButton active={selected.scope === "unclassified"} label="未能归档，未归类" count={summary.unclassified}
          onClick={() => setSelected({ scope: "unclassified", title: "未能归档，未归类" })} />}
        {summary.months.map((row) => <GroupButton key={row.period} active={selected.scope === "month" && selected.key === row.period}
          label={row.period} count={row.files}
          onClick={() => setSelected({ scope: "month", key: row.period, title: `${row.period} · 照片与视频` })} />)}
      </div>
      <MediaList scope={selected.scope} scopeKey={selected.key} title={selected.title} />
    </div>
  </Shell>;
}

export function IndexedPlaces({ summary }: { summary: BrowseSummary }) {
  const [place, setPlace] = useState(summary.places[0]?.key || "");
  const selected = summary.places.find((p) => p.key === place);
  return <Shell intro={`共 ${summary.gpsTotal.toLocaleString()} 项带定位。按约 10 公里范围分组，显示本地保存的附近地名；未命名地点仍可查看照片。`}>
    <div className="fv-indexed-columns" style={{ display: "grid", gridTemplateColumns: "minmax(200px,240px) minmax(0,1fr)", gap: 16, alignItems: "start" }}>
      <div style={{ ...card, padding: 12, display: "grid", gap: 6, maxHeight: "70vh", overflowY: "auto" }}>
        {summary.places.map((p) => <GroupButton key={p.key} active={p.key === place} label={p.label} count={p.files} onClick={() => setPlace(p.key)} />)}
      </div>
      {selected ? <MediaList scope="place" scopeKey={place} title={`${selected.label} · 影像`} /> : <div style={muted}>没有带定位的文件。</div>}
    </div>
  </Shell>;
}

function OnlinePhotoMap({ places, onSelect }: { places: BrowseSummary["places"]; onSelect: (key: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    let active = true;
    let map: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    (async () => {
      try {
        await loadCss("https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css");
        await loadScript("https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js");
        if (!active || !ref.current) return;
        const L = (window as any).L; // eslint-disable-line @typescript-eslint/no-explicit-any
        map = L.map(ref.current, { preferCanvas: true, worldCopyJump: true });
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19, referrerPolicy: "strict-origin-when-cross-origin",
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).on("tileerror", () => { if (active) setStatus("error"); }).addTo(map);
        const points: [number, number][] = [];
        const max = Math.max(1, ...places.map((p) => p.files));
        for (const p of places) {
          if (!Number.isFinite(p.latitude) || !Number.isFinite(p.longitude)) continue;
          L.circleMarker([p.latitude, p.longitude], {
            radius: Math.max(5, Math.min(16, 5 + Math.sqrt(p.files / max) * 11)),
            color: "#fff", weight: 2, fillColor: "#2468d8", fillOpacity: .8,
          }).addTo(map).bindTooltip(`${p.label} · ${p.files.toLocaleString()} 项`)
            .on("click", () => onSelectRef.current(p.key));
          points.push([p.latitude, p.longitude]);
        }
        if (points.length) map.fitBounds(points, { padding: [28, 28], maxZoom: 12 });
        else map.setView([30, 110], 3);
        requestAnimationFrame(() => map.invalidateSize());
        if (active) setStatus("ready");
      } catch { if (active) setStatus("error"); }
    })();
    return () => { active = false; map?.remove(); };
  }, [places]);
  return <div>
    {status === "loading" && <div style={{ ...muted, marginBottom: 8 }}>正在加载地图…</div>}
    {status === "error" && <div style={{ ...muted, marginBottom: 8 }}>在线底图加载失败，请检查网络；照片坐标仍在下方可查看。</div>}
    <div ref={ref} aria-label="家庭影像在线地图" style={{ height: "min(65vh, 610px)", minHeight: 360, borderRadius: 10, background: "var(--fill-quaternary)" }} />
  </div>;
}

function OfflineWorldMap({ places, selected, onSelect }: {
  places: BrowseSummary["places"]; selected: string | null; onSelect: (key: string) => void;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; clientX: number; clientY: number; width: number } | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, w: 900, h: 450 });
  const max = Math.max(1, ...places.map((p) => p.files));
  const clamp = (x: number, y: number, w: number, h: number) => ({
    x: Math.max(0, Math.min(900 - w, x)), y: Math.max(0, Math.min(450 - h, y)), w, h,
  });
  const zoom = (factor: number, ax = .5, ay = .5) => setView((old) => {
    const w = Math.max(65, Math.min(900, old.w * factor));
    const h = w / 2;
    return clamp(old.x + old.w * ax - w * ax, old.y + old.h * ay - h * ay, w, h);
  });
  const focus = () => {
    const lead = places[0];
    if (!lead) return;
    const x = (lead.longitude + 180) * 2.5;
    const y = (90 - lead.latitude) * 2.5;
    setView(clamp(x - 75, y - 37.5, 150, 75));
  };
  return <div>
    <div style={{ display: "flex", gap: 6, marginBottom: 9 }}>
      <button style={button} onClick={() => zoom(.7)} aria-label="放大地图">＋</button>
      <button style={button} onClick={() => zoom(1.4)} aria-label="缩小地图">－</button>
      <button style={button} onClick={() => setView({ x: 0, y: 0, w: 900, h: 450 })}>世界</button>
      <button style={button} onClick={focus}>定位主要照片</button>
      <span style={{ ...muted, alignSelf: "center" }}>拖动地图或滚轮缩放 · 离线底图</span>
    </div>
    <svg ref={ref} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} role="img" aria-label="可缩放的家庭影像世界地图"
      style={{ width: "100%", maxHeight: "65vh", minHeight: 350, aspectRatio: "2 / 1", borderRadius: 10, background: "#cce5ed", touchAction: "none", cursor: drag.current ? "grabbing" : "grab" }}
      onWheel={(event) => {
        event.preventDefault();
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        zoom(event.deltaY < 0 ? .8 : 1.25,
          Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
          Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)));
      }}
      onPointerDown={(event) => {
        if ((event.target as Element).closest('[data-photo-map-marker]')) return;
        drag.current = { x: view.x, y: view.y, clientX: event.clientX, clientY: event.clientY,
          width: ref.current?.getBoundingClientRect().width || 900 };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!drag.current) return;
        const start = drag.current;
        const scale = view.w / start.width;
        setView((old) => clamp(start.x - (event.clientX - start.clientX) * scale,
          start.y - (event.clientY - start.clientY) * scale, old.w, old.h));
      }}
      onPointerUp={() => { drag.current = null; }}
      onPointerCancel={() => { drag.current = null; }}>
      <image href="./world-land.svg" x="0" y="0" width="900" height="450" />
      {places.map((p) => <circle key={p.key} cx={(p.longitude + 180) * 2.5} cy={(90 - p.latitude) * 2.5}
        data-photo-map-marker="true" role="button" tabIndex={0}
        aria-label={`查看${p.label}的${p.files.toLocaleString()}项影像`}
        r={Math.max(3, Math.min(17, 3 + Math.sqrt(p.files / max) * 14)) * view.w / 900}
        fill={selected === p.key ? "#e97523" : "#2468d8"} fillOpacity=".84"
        stroke="white" strokeWidth={Math.max(.3, view.w / 900)}
        style={{ cursor: "pointer" }} onClick={() => onSelect(p.key)}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(p.key); } }}>
        <title>{p.label} · {p.files.toLocaleString()} 项</title>
      </circle>)}
    </svg>
    <div style={{ ...muted, marginTop: 8 }}>底图来自 Natural Earth；放大后可查看照片分布。街道级地图可选择在线加载。</div>
  </div>;
}

export function IndexedMap({ summary }: { summary: BrowseSummary }) {
  const [selection, setSelection] = useState<{ key: string; serial: number } | null>(null);
  const [showTiles, setShowTiles] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const place = selection?.key || null;
  const selected = summary.places.find((p) => p.key === place);
  const selectPlace = (key: string) => setSelection((previous) => ({ key, serial: (previous?.serial || 0) + 1 }));
  useEffect(() => {
    if (!selection) return;
    const frame = requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "instant", block: "start" }));
    return () => cancelAnimationFrame(frame);
  }, [selection]);
  return <Shell intro={`${summary.gpsTotal.toLocaleString()} 项带 GPS。离线世界地图可直接缩放、拖动；街道级在线底图由你选择加载。`}>
    <div style={{ ...card, padding: 12, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        {!showTiles && <button style={button} onClick={() => setShowTiles(true)}>显示在线背景地图</button>}
        <span style={muted}>在线底图会从 tile.openstreetmap.org 下载；该服务能获知你查看的地图区域。</span>
      </div>
      {showTiles ? <OnlinePhotoMap places={summary.places} onSelect={selectPlace} />
        : <OfflineWorldMap places={summary.places} selected={place} onSelect={selectPlace} />}
    </div>
    {selected && <div ref={resultsRef} style={{ scrollMarginTop: 86, minHeight: "70vh" }}><div style={{ ...muted, marginBottom: 8 }}>{selected.label}</div>
      <MediaList scope="place" scopeKey={selected.key} title={`${selected.label} · ${selected.files.toLocaleString()} 项影像`} /></div>}
  </Shell>;
}

export function IndexedEvents({ summary }: { summary: BrowseSummary }) {
  const years = useMemo(() => [...new Set(summary.events.map((e) => e.day.slice(0, 4)))], [summary.events]);
  const [year, setYear] = useState(years[0] || "");
  const [day, setDay] = useState<string | null>(null);
  const selected = useMemo(() => summary.events.find((e) => e.day === day), [summary.events, day]);
  return <Shell intro={`有 ${summary.datedTotal.toLocaleString()} 项可按具体日期分组。这里显示日期候选，尚未给事件命名；仅确定月份或年份的文件不会被误归到某一天。`}>
    <div className="fv-indexed-columns" style={{ display: "grid", gridTemplateColumns: "minmax(200px,240px) minmax(0,1fr)", gap: 16, alignItems: "start" }}>
      <div style={{ ...card, padding: 12, display: "grid", gap: 6, maxHeight: "70vh", overflowY: "auto" }}>
        <select value={year} onChange={(e) => { setYear(e.target.value); setDay(null); }} aria-label="选择事件年份" style={button}>
          {years.map((y) => <option key={y} value={y}>{y} 年</option>)}
        </select>
        {summary.events.filter((e) => e.day.startsWith(year)).map((e) => <GroupButton key={e.day} active={day === e.day} label={e.day} count={e.files} onClick={() => setDay(e.day)} />)}
      </div>
      {selected ? <MediaList scope="day" scopeKey={selected.day} title={`${selected.day} 的影像`} /> : <div style={muted}>选择左侧日期，查看照片和视频。</div>}
    </div>
  </Shell>;
}

export function IndexedPeople({ summary }: { summary: BrowseSummary }) {
  const [person, setPerson] = useState<{ id: string; name: string } | null>(null);
  const [showAll, setShowAll] = useState(false);
  return <Shell intro={`家庭影像库现有 ${summary.total.toLocaleString()} 项媒体。先建立人物脸部样本库，再做小批准确性检查，最后运行一次性全库扫描。`}>
    <PeopleReferenceLibrary onSelectPerson={setPerson} />
    {person && <div><button style={button} onClick={() => setShowAll((value) => !value)}>{showAll ? `查看「${person.name}」的照片` : "浏览全部照片并添加人物"}</button></div>}
    {person && !showAll ? <MediaList scope="person" scopeKey={person.id} title={`已归类为「${person.name}」的照片`} initialKind="image" />
      : <MediaList scope="all" title="浏览待审核照片" initialKind="image" faceSample />}
  </Shell>;
}

export function IndexedReview({ summary, onPeople }: { summary: BrowseSummary; onPeople: () => void }) {
  const [reviewHint, setReviewHint] = useState<BrowseHint>("screenshot");
  const steps = [
    ["1 · 人物样本", "在人物页给家人命名，并为每个人保存数张已框选的清晰脸部样本。"],
    ["2 · 小批预演", "用不同年份、HEIC/JPG 和合照抽样，检查人脸匹配与误认，再决定全库扫描参数。"],
    ["3 · 一次性全库扫描", "按月份断点扫描，记录人脸、疑似截屏、疑似模糊与视觉相似线索；页面会显示进度和错误。"],
    ["4 · 人工挑选", "在月份里按时间或大小排序，逐组复核截图、模糊照片和连拍相似照片；由你决定哪些移入可恢复回收站。"],
  ];
  return <Shell intro={`家庭影像库有 ${summary.total.toLocaleString()} 项媒体。完全重复副本已完成清理；以下几类画面审核还没有对整库扫描，不能把当前空列表当作没有候选。`}>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
      {steps.map(([heading, body]) => <div key={heading} style={{ ...card, padding: 18 }}>
        <strong style={{ color: "var(--text-primary)", fontSize: 14 }}>{heading}</strong>
        <div style={{ ...muted, marginTop: 8 }}>{body}</div>
      </div>)}
    </div>
    <div style={{ ...card, padding: 18 }}>
      <strong style={{ color: "var(--text-primary)" }}>当前下一步：建立人物样本</strong>
      <div style={{ ...muted, margin: "8px 0 12px" }}>截图、未检出人脸、疑似模糊和连拍分组都会进入审核清单。风景照和无人像照片不会因此自动删除。</div>
      <button style={button} onClick={onPeople}>前往人物样本库</button>
    </div>
    <div style={{ ...card, padding: 18 }}>
      <strong style={{ color: "var(--text-primary)" }}>现有文件名线索</strong>
      <div style={{ ...muted, margin: "8px 0 12px" }}>已从文件名和原目录名称找到 {summary.screenshotNameHints.toLocaleString()} 张疑似截图、{summary.screenRecordingNameHints.toLocaleString()} 段疑似录屏。这里只是早期线索，不代表画面扫描结果；可在图库或月份里用“文件名线索”筛选。</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button style={button} onClick={() => setReviewHint("screenshot")}>审核疑似截图 · {summary.screenshotNameHints.toLocaleString()}</button>
        <button style={button} onClick={() => setReviewHint("screen_recording")}>审核疑似录屏 · {summary.screenRecordingNameHints.toLocaleString()}</button>
        <button style={button} onClick={() => setReviewHint("all")}>浏览全部</button>
      </div>
    </div>
    <MediaList key={reviewHint} scope="all" title={reviewHint === "screenshot" ? "疑似截图：逐张审核" : reviewHint === "screen_recording" ? "疑似录屏：逐段审核" : "全部影像：选择并清理"}
      initialKind={reviewHint === "screenshot" ? "image" : reviewHint === "screen_recording" ? "video" : "all"} initialHint={reviewHint} />
  </Shell>;
}
