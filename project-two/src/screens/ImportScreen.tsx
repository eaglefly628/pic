import { useEffect, useRef, useState } from "react";
import { useLibrary } from "../lib/library";
import { Btn, Select, card } from "../ui";
import { IconUpload, IconImage } from "../icons";
import { fmtSize } from "../lib/format";
import { getRemoteIndexStatus, pauseRemoteIndex, startRemoteIndex, type RemoteIndexStatus } from "../lib/remoteIndex";

export default function ImportScreen({ goGallery, goIndex }: { goGallery: () => void; goIndex: () => void }) {
  const { addFile, albums, baseDir, pickBaseDir, syncBaseDir, disconnectBaseDir } = useLibrary();
  const [bprog, setBprog] = useState<{ done: number; total: number } | null>(null);
  const runBase = async (fn: (cb: (d: number, t: number) => void) => Promise<void>) => {
    setBprog({ done: 0, total: 0 });
    await fn((d, t) => setBprog({ done: d, total: t }));
    setBprog(null);
  };
  const fileRef = useRef<HTMLInputElement>(null);
  const dirRef = useRef<HTMLInputElement | null>(null);
  const setDir = (el: HTMLInputElement | null) => {
    if (el) { el.setAttribute("webkitdirectory", ""); el.setAttribute("directory", ""); el.setAttribute("mozdirectory", ""); }
    dirRef.current = el;
  };
  const [albumId, setAlbumId] = useState("");
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState({ done: 0, total: 0, current: "" });
  const [result, setResult] = useState<{ added: number; skipped: number; failed: number } | null>(null);
  const [drag, setDrag] = useState(false);
  const [remote, setRemote] = useState<RemoteIndexStatus | null>(null);
  const [remoteError, setRemoteError] = useState("");
  const [remoteBusy, setRemoteBusy] = useState(false);
  const [remoteSource, setRemoteSource] = useState("");

  const refreshRemote = async () => {
    try {
      const next = await getRemoteIndexStatus();
      setRemote(next);
      const readable = next.sources?.filter((source) => source.readable) || [];
      const indexedIsReadable = !!next.source && readable.some((source) => source.path === next.source);
      setRemoteSource(indexedIsReadable ? next.source! : readable[0]?.path || next.source || next.defaultSource || "");
      setRemoteError(next.ok ? "" : (next.error || "读取照片索引失败"));
    } catch (err) {
      setRemoteError(err instanceof Error ? err.message : "无法连接照片索引服务");
    }
  };

  useEffect(() => {
    void refreshRemote();
    const timer = window.setInterval(() => void refreshRemote(), remote?.processAlive ? 1800 : 5000);
    return () => window.clearInterval(timer);
    // 定时器只需跟随运行状态调整频率；路径变化不应重建定时器。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remote?.processAlive]);

  const startRemote = async () => {
    setRemoteBusy(true); setRemoteError("");
    try {
      const next = await startRemoteIndex(remoteSource);
      setRemote(next);
      if (!next.ok) setRemoteError(next.error || "启动扫描失败");
    } catch (err) {
      setRemoteError(err instanceof Error ? err.message : "启动扫描失败");
    } finally { setRemoteBusy(false); }
  };

  const pauseRemote = async () => {
    setRemoteBusy(true); setRemoteError("");
    try {
      setRemote(await pauseRemoteIndex());
    } catch (err) {
      setRemoteError(err instanceof Error ? err.message : "暂停扫描失败");
    } finally { setRemoteBusy(false); }
  };

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setBusy(true); setResult(null);
    let added = 0, skipped = 0, failed = 0;
    setProg({ done: 0, total: list.length, current: "" });
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      setProg({ done: i, total: list.length, current: f.name });
      if (!f.type.startsWith("image/") && !f.type.startsWith("video/")) { skipped++; continue; }
      try {
        await addFile(f, { albums: albumId ? [albumId] : [] });
        added++;
      } catch { failed++; }
    }
    setProg({ done: list.length, total: list.length, current: "" });
    setBusy(false);
    setResult({ added, skipped, failed });
  };

  const pct = prog.total ? Math.round((prog.done / prog.total) * 100) : 0;

  return (
    <div style={{ padding: "24px 32px 40px", animation: "fvFade 0.3s ease", maxWidth: 760 }}>
      {/* 大型 Samba 媒体库：由本机服务只读扫描，索引可暂停/续跑。 */}
      <div style={{ ...card, padding: "20px 26px", marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 250 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>S300 / Samba 全局索引（只读）</div>
            <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.7 }}>
              通过 Wi-Fi 读取文件名、大小和时间，原照片与视频始终留在联想云储存。索引保存在本机，掉线或退出后可继续；这一阶段不会移动、复制或删除任何文件。
            </div>
          </div>
          <span style={{ padding: "4px 9px", borderRadius: 20, fontSize: 11.5, color: remote?.processAlive ? "var(--green)" : "var(--text-secondary)", background: "var(--fill-quaternary)" }}>
            {remote?.processAlive ? "● 扫描中" : remote?.status === "completed" ? "✓ 已完成" : remote?.status === "paused" ? "Ⅱ 已暂停" : "只读模式"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          <Select
            aria-label="Samba 挂载目录"
            value={remoteSource}
            onChange={(e) => setRemoteSource(e.target.value)}
            disabled={!!remote?.processAlive || remoteBusy}
            style={{ minWidth: 270, flex: 1 }}
            options={(remote?.sources?.length ? remote.sources : [{ name: "S300（尚未挂载）", path: remote?.defaultSource || "", readable: false, writable: false }])
              .map((s) => ({ value: s.path, label: `${s.readable ? "✓" : "○"} ${s.name} — ${s.path}` }))}
          />
          {remote?.processAlive ? (
            <Btn variant="ghost" onClick={pauseRemote} disabled={remoteBusy}>{remoteBusy ? "处理中…" : "安全暂停"}</Btn>
          ) : (
            <Btn onClick={startRemote} disabled={remoteBusy || !remote?.sources?.some((s) => s.path === remoteSource && s.readable)}
              style={!remote?.sources?.some((s) => s.path === remoteSource && s.readable) ? { opacity: 0.45, cursor: "not-allowed" } : undefined}>
              {remoteBusy ? "启动中…" : remote?.status === "paused" ? "继续扫描" : remote?.status === "completed" ? "检查新增文件" : "开始扫描"}
            </Btn>
          )}
        </div>

        {!remote?.sources?.some((s) => s.path === remoteSource && s.readable) && !remoteError && (
          <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--orange)", lineHeight: 1.6 }}>
            尚未检测到 S300。{remote?.platform === "windows"
              ? <>请先在 Windows 将 Samba 共享映射为网络驱动器，再导入接力包并重启应用。</>
              : <>请先在 Finder 连接 <b>smb://192.168.31.247/24684804</b>，然后回到这里等待几秒。</>}
          </div>
        )}
        {remoteError && (
          <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--red)", lineHeight: 1.6 }}>
            {remoteError}。请从项目入口 <b>http://localhost:5180</b> 打开；直接打开 file:// 页面无法调用扫描服务。
          </div>
        )}

        {remote && remote.status !== "not_started" && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "0.5px solid var(--separator)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10 }}>
              <Metric label="本轮已见" value={(remote.indexedThisRun || 0).toLocaleString()} />
              <Metric label="照片" value={(remote.totals?.image?.files || 0).toLocaleString()} />
              <Metric label="视频" value={(remote.totals?.video?.files || 0).toLocaleString()} />
              <Metric label="媒体容量" value={fmtSize((remote.totals?.image?.bytes || 0) + (remote.totals?.video?.bytes || 0))} />
            </div>
            <div style={{ marginTop: 12, height: 7, background: "var(--track)", borderRadius: 6, overflow: "hidden" }}>
              <div style={{ height: "100%", width: remote.processAlive ? "38%" : remote.status === "completed" ? "100%" : "12%", background: "var(--accent)", borderRadius: 6, transition: "width .4s" }} />
            </div>
            <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--text-tertiary)", lineHeight: 1.6, overflowWrap: "anywhere" }}>
              已完成目录 {(remote.directories?.done || 0).toLocaleString()} · 待扫描 {(remote.directories?.pending || 0).toLocaleString()} · 错误 {(remote.errors || 0).toLocaleString()}
              {remote.lastPath ? <> · 当前：{remote.lastPath}</> : null}
            </div>
            {(remote.hints?.screenshot?.files || remote.hints?.screen_recording?.files) ? (
              <div style={{ marginTop: 6, fontSize: 11.5, color: "var(--text-secondary)" }}>
                初步标记：截图 {(remote.hints?.screenshot?.files || 0).toLocaleString()} · 录屏 {(remote.hints?.screen_recording?.files || 0).toLocaleString()}（只标记，尚未删除）
              </div>
            ) : null}
            {remote.message && <div style={{ marginTop: 6, fontSize: 11.5, color: "var(--orange)" }}>{remote.message}</div>}
            {remote.status === "completed" && <div style={{ marginTop: 12 }}><Btn variant="soft" onClick={goIndex}>查看完整索引报告与下一步</Btn></div>}
          </div>
        )}
      </div>

      {/* 浏览器文件夹模式适合较小的本地媒体库。 */}
      <div style={{ ...card, padding: "20px 26px", marginBottom: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>浏览器文件夹模式（适合小型本地目录）</div>
        <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 14 }}>
          指定一个文件夹当媒体库：把全家照片都拷进这个文件夹，App 只建立索引与缩略图，<strong>原文件留在磁盘、不复制</strong>。之后点「同步」即可更新新增/删除。需 Chrome / Edge 浏览器。
        </div>
        {!baseDir.supported ? (
          <div style={{ fontSize: 12.5, color: "var(--orange)" }}>当前浏览器不支持文件夹库，请用 Chrome / Edge（或之后的桌面版）。可先用下方「导入」拷贝模式。</div>
        ) : baseDir.name ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: "var(--text-primary)" }}>📁 当前媒体库：<b>{baseDir.name}</b></span>
            <div style={{ flex: 1 }} />
            <Btn onClick={() => runBase(syncBaseDir)} disabled={!!bprog}>{bprog ? "同步中…" : "同步"}</Btn>
            <Btn variant="ghost" onClick={() => { if (confirm("断开媒体库文件夹？仅移除这些磁盘文件的索引，原文件不会被删除。")) disconnectBaseDir(); }} disabled={!!bprog}>断开</Btn>
          </div>
        ) : (
          <Btn onClick={() => runBase(pickBaseDir)} disabled={!!bprog}>{bprog ? "扫描中…" : "选择媒体库文件夹"}</Btn>
        )}
        {bprog && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>扫描/索引中… {bprog.done}{bprog.total ? `/${bprog.total}` : ""}</div>
            <div style={{ height: 8, background: "var(--track)", borderRadius: 5, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${bprog.total ? (bprog.done / bprog.total) * 100 : 10}%`, background: "var(--accent)", borderRadius: 5, transition: "width .2s" }} />
            </div>
          </div>
        )}
      </div>

      <div style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "0 2px 10px" }}>或：把文件<strong>拷贝进应用</strong>（适合少量、或不方便保留文件夹时）</div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files) handleFiles(e.dataTransfer.files); }}
        onClick={() => fileRef.current?.click()}
        style={{
          ...card, padding: "44px 26px", textAlign: "center", cursor: "pointer", marginBottom: 18,
          border: drag ? "2px dashed var(--accent)" : "2px dashed var(--separator-strong)",
          background: drag ? "var(--accent-soft)" : "var(--bg-card)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <span style={{ width: 56, height: 56, borderRadius: 15, background: "linear-gradient(160deg,var(--accent),#5E5CE6)", display: "flex", alignItems: "center", justifyContent: "center" }}><IconImage size={28} /></span>
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>点击选择文件，或把照片/视频/整个文件夹拖到这里</div>
        <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", marginTop: 6 }}>支持批量导入；也可用下方「选择文件夹」整目录导入。自动读取拍摄时间与 GPS，按时间/地点归类。文件全部存在本机。</div>
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple style={{ display: "none" }}
          onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ""; }} />
        <input ref={setDir} type="file" multiple style={{ display: "none" }}
          onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ""; }} />
      </div>

      <div style={{ ...card, padding: "16px 22px", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>加入相册</span>
          <Select value={albumId} onChange={(e) => setAlbumId(e.target.value)} style={{ width: 180, height: 32 }}
            options={[{ value: "", label: "（不加入）" }, ...albums.map((a) => ({ value: a.id, label: a.name }))]} />
        </div>
        <div style={{ flex: 1 }} />
        <Btn variant="ghost" onClick={() => dirRef.current?.click()} disabled={busy}>选择文件夹</Btn>
        <Btn onClick={() => fileRef.current?.click()} disabled={busy}><IconUpload size={15} stroke="#fff" />选择文件</Btn>
      </div>

      {busy && (
        <div style={{ ...card, padding: "16px 22px", marginTop: 18 }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>正在导入… {prog.done}/{prog.total}（{prog.current}）</div>
          <div style={{ height: 8, background: "var(--track)", borderRadius: 5, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: "var(--accent)", borderRadius: 5, transition: "width .2s" }} />
          </div>
        </div>
      )}

      {result && !busy && (
        <div style={{ ...card, padding: "16px 22px", marginTop: 18, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 13.5, color: "var(--text-primary)" }}>
            ✅ 导入完成：成功 <b>{result.added}</b>{result.skipped ? ` · 跳过 ${result.skipped}（非图片/视频）` : ""}{result.failed ? ` · 失败 ${result.failed}` : ""}
          </div>
          <div style={{ flex: 1 }} />
          {result.added > 0 && <Btn variant="soft" onClick={goGallery}>去看图库</Btn>}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "var(--fill-quaternary)", padding: "9px 11px", borderRadius: 9 }}>
      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{value}</div>
    </div>
  );
}
