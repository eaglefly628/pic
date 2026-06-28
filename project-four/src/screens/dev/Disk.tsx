import { useCallback, useEffect, useState } from "react";
import { Btn, card } from "../../ui";
import { IconRefresh, IconTrash } from "../../icons";

type ScanItem = { path: string; label: string; bytes: number };
type Target = { id: string; label: string; desc: string; bytes: number; exists: boolean; permanentOnly: boolean };

const fmtB = (b: number) =>
  b >= 1e9 ? (b / 1073741824).toFixed(2) + " GB" : b >= 1e6 ? Math.round(b / 1048576) + " MB" : b >= 1e3 ? Math.round(b / 1024) + " KB" : b + " B";

export default function Disk() {
  const [scan, setScan] = useState<{ items: ScanItem[]; home?: string } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanErr, setScanErr] = useState("");
  const [targets, setTargets] = useState<Target[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [custom, setCustom] = useState("");
  const [perm, setPerm] = useState(false);

  const loadTargets = useCallback(async () => {
    try { const d = await fetch("/api/disk/targets").then((r) => r.json()); setTargets(d.ok ? d.targets : []); }
    catch { setTargets([]); }
  }, []);
  useEffect(() => { loadTargets(); }, [loadTargets]);

  const doScan = async () => {
    setScanning(true); setScanErr("");
    try {
      const d = await fetch("/api/disk/scan").then((r) => r.json());
      if (d.ok) setScan({ items: d.items, home: d.home }); else setScanErr(d.error || "扫描失败");
    } catch { setScanErr("连不上本机服务——这个功能需要通过 run.py 从 http://localhost:5180 进入。"); }
    finally { setScanning(false); }
  };

  const clean = async (spec: { id?: string; path?: string; contents?: boolean }, label: string, permanent: boolean) => {
    const verb = permanent ? "永久删除" : "移到废纸篓";
    if (!confirm(`确定要${verb}「${label}」吗？\n${permanent ? "⚠️ 不可恢复！" : "可在废纸篓里恢复。"}`)) return;
    setBusy(spec.id || "custom"); setMsg("");
    try {
      const d = await fetch("/api/disk/clean", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...spec, mode: permanent ? "delete" : "trash" }) }).then((r) => r.json());
      if (d.ok) { setMsg(`已${d.mode === "delete" ? "删除" : "移到废纸篓"} ${d.count} 项，释放约 ${fmtB(d.freed)}` + (d.errors?.length ? `（${d.errors.length} 项跳过）` : "")); loadTargets(); }
      else setMsg("没成功：" + (d.error || ""));
    } catch { setMsg("连不上本机服务"); }
    finally { setBusy(null); }
  };

  const maxScan = Math.max(1, ...(scan?.items || []).map((i) => i.bytes));

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", marginBottom: 16, lineHeight: 1.7 }}>
        磁盘清理 · 由<strong>本机 run.py</strong> 执行扫描与清理（只在你本机、不联网）。清理<strong>默认移到废纸篓</strong>，可恢复；删除前都会让你确认。
      </div>

      {/* 扫描 */}
      <div style={{ ...card, padding: "16px 18px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: scan ? 14 : 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>谁在吃硬盘</div>
            <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 2 }}>扫描用户目录、按占用排序{scan?.home ? ` · ${scan.home}` : ""}</div>
          </div>
          <Btn onClick={doScan} disabled={scanning}><IconRefresh size={14} stroke="#fff" />{scanning ? "扫描中…（可能要等一会儿）" : "扫描"}</Btn>
        </div>
        {scanErr && <div style={{ fontSize: 12.5, color: "var(--orange)", marginTop: 12 }}>{scanErr}</div>}
        {scan && (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {scan.items.map((it) => (
              <div key={it.path} style={{ display: "flex", alignItems: "center", gap: 10 }} title={it.path}>
                <span style={{ width: 150, flex: "none", fontSize: 12.5, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.label}</span>
                <div style={{ flex: 1, height: 8, borderRadius: 4, background: "var(--fill-q)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.max(2, (it.bytes / maxScan) * 100)}%`, background: "var(--accent)", borderRadius: 4 }} />
                </div>
                <span style={{ width: 72, flex: "none", textAlign: "right", fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{fmtB(it.bytes)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 安全清理 */}
      <div style={{ ...card, padding: "16px 18px", marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>安全清理</div>
        <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginBottom: 12 }}>公认的垃圾（缓存 / 日志 / 开发缓存 / 废纸篓），清掉不影响使用。</div>
        {targets === null ? (
          <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", padding: "8px 0" }}>读取中…（需通过 run.py 进入）</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {targets.map((t) => (
              <div key={t.id} className="fv-row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 8px", borderRadius: 8, opacity: t.exists ? 1 : 0.5 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{t.label}{t.permanentOnly && <span style={{ fontSize: 10.5, color: "var(--red)", marginLeft: 6 }}>永久</span>}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.desc}</div>
                </div>
                <span style={{ width: 72, textAlign: "right", fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{t.exists ? fmtB(t.bytes) : "—"}</span>
                <Btn variant={t.permanentOnly ? "danger" : "soft"} onClick={() => clean({ id: t.id }, t.label, !!t.permanentOnly)} disabled={!t.exists || t.bytes === 0 || busy === t.id}>{busy === t.id ? "清理中…" : t.permanentOnly ? "清空" : "清理"}</Btn>
              </div>
            ))}
          </div>
        )}
        {msg && <div style={{ fontSize: 12.5, color: "var(--accent)", marginTop: 12 }}>{msg}</div>}
      </div>

      {/* 高级 / 自定义 */}
      <div style={{ ...card, padding: "16px 18px" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>高级 · 自定义路径</div>
        <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginBottom: 12, lineHeight: 1.7 }}>
          自己指定一个<strong>用户目录下</strong>的文件夹来清。关键目录（系统 / 文稿 / 下载 / 桌面 / 图片 等）会被自动拒绝。
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="如 ~/Library/Caches/SomeApp 或 /Users/你/某个缓存夹"
            style={{ flex: 1, minWidth: 220, height: 36, padding: "0 12px", fontSize: 13, borderRadius: 10, border: "0.5px solid var(--separator)", background: "var(--fill-q)", color: "var(--text-primary)", fontFamily: "ui-monospace, monospace" }} />
          <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: perm ? "var(--red)" : "var(--text-secondary)", cursor: "pointer", whiteSpace: "nowrap" }}>
            <input type="checkbox" checked={perm} onChange={(e) => setPerm(e.target.checked)} />永久删除
          </label>
          <Btn variant={perm ? "danger" : "ghost"} disabled={!custom.trim() || busy === "custom"} onClick={() => clean({ path: custom.trim() }, custom.trim(), perm)}>
            <IconTrash size={14} stroke="currentColor" />{busy === "custom" ? "清理中…" : "清理此路径"}
          </Btn>
        </div>
        {perm && <div style={{ fontSize: 11.5, color: "var(--red)", marginTop: 10 }}>⚠️ 永久删除不可恢复，请确认路径无误。</div>}
      </div>
    </div>
  );
}
