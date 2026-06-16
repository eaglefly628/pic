import { useRef, useState } from "react";
import { useLibrary } from "../lib/library";
import { Btn, Select, card } from "../ui";
import { IconUpload, IconImage } from "../icons";

export default function ImportScreen({ goGallery }: { goGallery: () => void }) {
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
      {/* 媒体库文件夹（Base 目录，不拷贝） */}
      <div style={{ ...card, padding: "20px 26px", marginBottom: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>媒体库文件夹（推荐 · 不拷贝）</div>
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
