import { useEffect, useState } from "react";
import { fmtSize } from "../lib/format";
import {
  getRemoteIndexFiles,
  getRemoteIndexStatus,
  revealRemoteIndex,
  startRemoteIndex,
  type RemoteIndexFile,
  type RemoteIndexStatus,
} from "../lib/remoteIndex";
import { Btn, Select, TextField, card } from "../ui";

const PAGE_SIZE = 100;

export default function RemoteIndex() {
  const [data, setData] = useState<RemoteIndexStatus | null>(null);
  const [files, setFiles] = useState<RemoteIndexFile[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [kind, setKind] = useState("");
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const loadStatus = async () => {
    try { setData(await getRemoteIndexStatus()); }
    catch (err) { setError(err instanceof Error ? err.message : "无法读取索引报告"); }
  };

  useEffect(() => { void loadStatus(); }, []);
  useEffect(() => {
    if (!data?.processAlive) return;
    const timer = window.setInterval(() => void loadStatus(), 1800);
    return () => window.clearInterval(timer);
  }, [data?.processAlive]);
  useEffect(() => {
    let active = true;
    getRemoteIndexFiles({ offset, limit: PAGE_SIZE, kind, q: appliedQuery })
      .then((next) => { if (active) { setFiles(next.items); setTotal(next.total); setError(next.ok ? "" : (next.error || "读取记录失败")); } })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "读取记录失败"); });
    return () => { active = false; };
  }, [offset, kind, appliedQuery]);

  if (!data && !error) return <div style={{ padding: 32, color: "var(--text-tertiary)" }}>正在读取本机索引…</div>;
  if (!data) return <div style={{ padding: 32, color: "var(--red)" }}>{error}</div>;
  if (data.status === "not_started") return <div style={{ padding: 32, color: "var(--text-secondary)" }}>尚未建立远程媒体索引，请先到“导入”页连接并扫描 S300。</div>;

  const image = data.totals?.image || { files: 0, bytes: 0 };
  const video = data.totals?.video || { files: 0, bytes: 0 };
  const other = data.totals?.other || { files: 0, bytes: 0 };
  const sidecar = data.totals?.sidecar || { files: 0, bytes: 0 };
  const totalFiles = image.files + video.files + other.files + sidecar.files;
  const mediaFiles = image.files + video.files;
  const photoPct = mediaFiles ? (image.files / mediaFiles) * 100 : 0;
  const maxDir = Math.max(1, ...(data.topDirectories || []).map((d) => d.media));

  const rescan = async () => {
    if (!data.source) return;
    setBusy(true); setError("");
    try { setData(await startRemoteIndex(data.source)); }
    catch (err) { setError(err instanceof Error ? err.message : "启动增量扫描失败"); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ padding: "24px 32px 42px", maxWidth: 1020, animation: "fvFade .25s ease" }}>
      <div style={{ ...card, padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ fontSize: 17, fontWeight: 650, color: "var(--text-primary)" }}>S300 影像索引</div>
            <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 5 }}>扫描结果已保存在本机；这里浏览的是文件元数据，不会加载或上传原始照片。</div>
          </div>
          <span style={{ padding: "5px 9px", borderRadius: 20, fontSize: 11.5, color: data.status === "completed" ? "var(--green)" : "var(--orange)", background: "var(--fill-quaternary)" }}>
            {data.status === "completed" ? "✓ 索引完成" : data.processAlive ? "● 扫描中" : "Ⅱ 可继续"}
          </span>
          <Btn variant="ghost" onClick={() => void revealRemoteIndex()}>显示数据库</Btn>
          <Btn onClick={rescan} disabled={busy || data.processAlive}>{busy ? "启动中…" : "检查新增文件"}</Btn>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(135px,1fr))", gap: 10, marginTop: 17 }}>
          <Metric label="全部文件" value={totalFiles.toLocaleString()} />
          <Metric label="照片" value={image.files.toLocaleString()} />
          <Metric label="视频" value={video.files.toLocaleString()} />
          <Metric label="媒体容量" value={fmtSize(image.bytes + video.bytes)} />
          <Metric label="数据库" value={fmtSize(data.dbBytes || 0)} />
        </div>

        <div style={{ marginTop: 17 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-secondary)", marginBottom: 7 }}>
            <span>照片 {image.files.toLocaleString()} · {fmtSize(image.bytes)}</span>
            <span>视频 {video.files.toLocaleString()} · {fmtSize(video.bytes)}</span>
          </div>
          <div style={{ display: "flex", height: 13, overflow: "hidden", borderRadius: 8, background: "var(--track)" }}>
            <div style={{ width: `${photoPct}%`, background: "linear-gradient(90deg,var(--accent),#64D2FF)" }} />
            <div style={{ flex: 1, background: "#AF52DE" }} />
          </div>
        </div>
      </div>

      <div style={{ ...card, padding: "18px 22px", marginTop: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>下一步工作流</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10 }}>
          <WorkflowStep index="1" title="文件索引" desc="清单、类型、容量和目录结构" state="已完成" active />
          <WorkflowStep index="2" title="时间与地点" desc="提取 EXIF / 视频时间 / GPS，标记不确定项" state="下一步" />
          <WorkflowStep index="3" title="重复检测" desc="按大小筛选，再用哈希确认完全重复" state="等待" />
          <WorkflowStep index="4" title="清理审核" desc="人工确认后先隔离，不直接永久删除" state="等待" />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.5fr) minmax(240px,1fr)", gap: 16, marginTop: 16 }}>
        <div style={{ ...card, padding: "18px 22px" }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>媒体最多的目录</div>
          <div style={{ display: "grid", gap: 10 }}>
            {(data.topDirectories || []).map((dir) => (
              <div key={dir.topDir}>
                <div style={{ display: "flex", gap: 8, justifyContent: "space-between", fontSize: 11.5, marginBottom: 4 }}>
                  <span title={dir.topDir} style={{ color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dir.topDir}</span>
                  <span style={{ color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>{dir.media.toLocaleString()} · {fmtSize(dir.bytes)}</span>
                </div>
                <div style={{ height: 7, borderRadius: 5, background: "var(--track)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.max(2, (dir.media / maxDir) * 100)}%`, borderRadius: 5, background: "var(--accent)" }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...card, padding: "18px 22px" }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 11 }}>格式与候选</div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {(data.extensions || []).map((x) => <span key={`${x.kind}-${x.extension}`} title={fmtSize(x.bytes)} style={{ fontSize: 11.5, padding: "5px 8px", borderRadius: 7, color: "var(--text-secondary)", background: "var(--fill-quaternary)" }}>{x.extension} · {x.files.toLocaleString()}</span>)}
          </div>
          <div style={{ marginTop: 14, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.8 }}>
            截图候选：{(data.hints?.screenshot?.files || 0).toLocaleString()}<br />
            录屏候选：{(data.hints?.screen_recording?.files || 0).toLocaleString()}<br />
            其他文件：{other.files.toLocaleString()} · {fmtSize(other.bytes)}<br />
            跳过目录：{(data.directories?.skipped || 0).toLocaleString()}
          </div>
        </div>
      </div>

      <div style={{ ...card, padding: "18px 22px", marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 13 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>浏览索引记录</div>
          <div style={{ flex: 1 }} />
          <form onSubmit={(e) => { e.preventDefault(); setOffset(0); setAppliedQuery(query.trim()); }} style={{ display: "flex", gap: 7 }}>
            <TextField value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索路径或文件名" style={{ width: 220, height: 32 }} />
            <Btn variant="ghost" type="submit">搜索</Btn>
          </form>
          <Select value={kind} onChange={(e) => { setKind(e.target.value); setOffset(0); }} style={{ width: 120, height: 32 }} options={[
            { value: "", label: "全部类型" }, { value: "image", label: "照片" }, { value: "video", label: "视频" }, { value: "other", label: "其他" }, { value: "sidecar", label: "辅助文件" },
          ]} />
        </div>
        {error && <div style={{ color: "var(--red)", fontSize: 12, marginBottom: 10 }}>{error}</div>}
        <div style={{ border: "0.5px solid var(--separator)", borderRadius: 10, overflow: "hidden" }}>
          {files.map((file, i) => (
            <div key={file.relPath} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 72px 88px", gap: 10, alignItems: "center", padding: "8px 11px", borderTop: i ? "0.5px solid var(--separator)" : "none", background: i % 2 ? "var(--fill-quaternary)" : "transparent" }}>
              <div title={file.relPath} style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, color: "var(--text-primary)" }}>{file.relPath}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", textTransform: "uppercase" }}>{file.extension || file.kind}</div>
              <div style={{ fontSize: 11.5, textAlign: "right", color: "var(--text-tertiary)" }}>{fmtSize(file.size)}</div>
            </div>
          ))}
          {!files.length && <div style={{ padding: 28, textAlign: "center", color: "var(--text-tertiary)", fontSize: 12.5 }}>没有匹配的记录</div>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
          <span style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>第 {total ? offset + 1 : 0}–{Math.min(offset + PAGE_SIZE, total)} 条，共 {total.toLocaleString()} 条</span>
          <div style={{ flex: 1 }} />
          <Btn variant="ghost" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>上一页</Btn>
          <Btn variant="ghost" disabled={offset + PAGE_SIZE >= total} onClick={() => setOffset(offset + PAGE_SIZE)}>下一页</Btn>
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-tertiary)", overflowWrap: "anywhere" }}>数据库：{data.db}</div>
        {!!data.skippedDirectories?.length && <div style={{ marginTop: 4, fontSize: 11, color: "var(--orange)" }}>无权限跳过：{data.skippedDirectories.map((d) => d.rel_path || "(根目录)").join("、")}</div>}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div style={{ background: "var(--fill-quaternary)", padding: "10px 12px", borderRadius: 9 }}><div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 3 }}>{label}</div><div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{value}</div></div>;
}

function WorkflowStep({ index, title, desc, state, active = false }: { index: string; title: string; desc: string; state: string; active?: boolean }) {
  return <div style={{ padding: 13, borderRadius: 10, border: `0.5px solid ${active ? "var(--accent)" : "var(--separator)"}`, background: active ? "var(--accent-soft)" : "var(--fill-quaternary)" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 21, height: 21, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: active ? "var(--accent)" : "var(--track)", color: active ? "#fff" : "var(--text-secondary)", fontSize: 11 }}>{index}</span><b style={{ fontSize: 12.5, color: "var(--text-primary)" }}>{title}</b><span style={{ marginLeft: "auto", fontSize: 10.5, color: active ? "var(--accent)" : "var(--text-tertiary)" }}>{state}</span></div>
    <div style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.55, marginTop: 7 }}>{desc}</div>
  </div>;
}
