import { useEffect, useState } from "react";
import { fmtSize } from "../lib/format";
import {
  exportPhotoHandoff,
  getPhotoHandoffStatus,
  importPhotoHandoff,
  type PhotoHandoffStatus,
} from "../lib/remoteIndex";
import { Btn, card } from "../ui";

export default function Handoff({ goIndex }: { goIndex: () => void }) {
  const [data, setData] = useState<PhotoHandoffStatus | null>(null);
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [error, setError] = useState("");

  const refresh = async () => {
    try {
      const next = await getPhotoHandoffStatus();
      setData(next);
      setError(next.ok ? "" : next.error || "接力状态读取失败");
    } catch (err) {
      setError(err instanceof Error ? err.message : "接力状态读取失败");
    }
  };

  useEffect(() => { void refresh(); }, []);

  const run = async (action: "export" | "import") => {
    setBusy(action);
    setError("");
    try {
      const next = action === "export" ? await exportPhotoHandoff() : await importPhotoHandoff();
      setData(next);
      if (!next.ok) setError(next.error || "接力操作失败");
    } catch (err) {
      setError(err instanceof Error ? err.message : "接力操作失败");
    } finally {
      setBusy(null);
    }
  };

  if (!data) {
    return <div style={{ padding: "40px 32px", color: "var(--text-secondary)" }}>{error || "正在检查接力环境…"}</div>;
  }

  const isWindows = data.platform === "windows";
  const platformLabel = isWindows ? "Windows 电脑" : data.platform === "mac" ? "Mac" : "其他系统";
  const manifest = data.manifest;
  const imported = data.action === "imported" && data.ok;
  const exported = data.action === "exported" && data.ok;

  return (
    <div style={{ padding: "24px 32px 40px", maxWidth: 900, display: "flex", flexDirection: "column", gap: 16, animation: "fvFade .25s ease" }}>
      <div style={{ ...card, padding: "22px 24px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ fontSize: 18, fontWeight: 650, color: "var(--text-primary)" }}>其他电脑一键接力</div>
            <div style={{ marginTop: 7, fontSize: 12.5, lineHeight: 1.7, color: "var(--text-secondary)" }}>
              在当前电脑生成索引接力包，在另一台电脑导入并自动把路径重绑定到映射的 S300。接力包只含索引和进度，不含照片、视频或密码。
            </div>
          </div>
          <span style={{ padding: "5px 9px", borderRadius: 20, background: "var(--fill-quaternary)", color: "var(--green)", fontSize: 11.5 }}>
            ✓ 使用当前应用 Python {data.pythonVersion}
          </span>
        </div>

        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 10 }}>
          <Info label="当前设备" value={platformLabel} />
          <Info label="S300 路径" value={data.sourceRoot || "尚未检测到挂载目录"} />
          <Info label="接力包" value={data.bundle ? fmtSize(data.bundleBytes || 0) : "尚未生成或未检测到"} />
        </div>
      </div>

      <div style={{ ...card, padding: "20px 24px" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{isWindows ? "接收并继续" : "准备给其他电脑"}</div>
        <div style={{ marginTop: 7, fontSize: 12, lineHeight: 1.7, color: "var(--text-secondary)" }}>
          {isWindows
            ? "自动识别 S300 上的最新接力包，备份本机索引，恢复扫描、时间地点和整理进度，然后继续工作。"
            : "生成当前索引的一致性快照并保存到 S300。另一台电脑拉取最新代码并启动应用后，点击同一个菜单即可继续。"}
        </div>

        {manifest && (
          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 10, background: "var(--fill-quaternary)", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 10 }}>
            <Info label="整理任务" value={manifest.runId ? `#${manifest.runId}` : "尚未开始"} compact />
            <Info label="整理进度" value={`${(manifest.verified || 0).toLocaleString()} / ${(manifest.total || 0).toLocaleString()}`} compact />
            <Info label="错误" value={(manifest.errors || 0).toLocaleString()} compact />
            <Info label="生成时间" value={formatDate(manifest.exportedAt)} compact />
          </div>
        )}

        <div style={{ marginTop: 16, display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
          {isWindows ? (
            <Btn onClick={() => void run("import")} disabled={busy !== null || !data.canImport}>
              {busy === "import" ? "正在安全接力…" : "一键接力并继续"}
            </Btn>
          ) : (
            <Btn onClick={() => void run("export")} disabled={busy !== null || !data.canExport}>
              {busy === "export" ? "正在准备接力…" : "一键准备接力"}
            </Btn>
          )}
          <Btn variant="ghost" onClick={() => void refresh()} disabled={busy !== null}>重新检测</Btn>
          {(imported || exported) && <span style={{ fontSize: 12, color: "var(--green)" }}>✓ {data.message}</span>}
        </div>

        {error && <div style={{ marginTop: 12, color: "var(--red)", fontSize: 12, lineHeight: 1.6 }}>{error}</div>}
        {!error && !data.canImport && <div style={{ marginTop: 12, color: "var(--orange)", fontSize: 12 }}>尚未检测到可导入的接力包；请确认 S300 已挂载，并先在另一台电脑生成接力包。</div>}
      </div>

      {imported && (
        <div style={{ ...card, padding: "18px 22px", border: "1px solid color-mix(in srgb,var(--green) 35%,transparent)" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--green)" }}>接力完成</div>
          <div style={{ marginTop: 7, fontSize: 12, lineHeight: 1.7, color: "var(--text-secondary)" }}>
            已恢复 {(data.importResult?.verified || data.organize?.verified || 0).toLocaleString()} / {(data.importResult?.total || data.organize?.total || 0).toLocaleString()} 的整理进度。现在可以直接进入索引报告继续按时间整理。
          </div>
          <Btn style={{ marginTop: 12 }} onClick={goIndex}>打开索引报告并继续</Btn>
        </div>
      )}

      <div style={{ fontSize: 11, color: "var(--text-tertiary)", overflowWrap: "anywhere" }}>
        当前解释器：{data.python} · 本机索引：{data.indexDatabase}{data.bundle ? ` · 接力包：${data.bundle}` : ""}
      </div>
    </div>
  );
}

function Info({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div style={compact ? undefined : { padding: "11px 12px", borderRadius: 10, background: "var(--fill-quaternary)", minWidth: 0 }}>
      <div style={{ fontSize: 10.5, color: "var(--text-tertiary)" }}>{label}</div>
      <div title={value} style={{ marginTop: 3, fontSize: 12, fontWeight: 550, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
    </div>
  );
}

function formatDate(value?: string) {
  if (!value) return "未知";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
