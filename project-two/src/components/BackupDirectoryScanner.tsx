import { useEffect, useState } from "react";
import { getBackupDirectories, startRemoteIndex, type BackupDirectory, type RemoteIndexStatus } from "../lib/remoteIndex";
import { Btn, card } from "../ui";

export default function BackupDirectoryScanner({ source, status, disabled, onStarted }: {
  source: string;
  status: RemoteIndexStatus | null;
  disabled?: boolean;
  onStarted: (next: RemoteIndexStatus) => void;
}) {
  const [directories, setDirectories] = useState<BackupDirectory[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const resume = status?.scanMode === "selected" && status.status === "paused" && !!status.selectedDirectories?.length;

  const refresh = async (preselectNew: boolean) => {
    if (!source) return;
    setError("");
    try {
      const result = await getBackupDirectories(source);
      if (!result.ok) throw new Error(result.error || "无法读取备份目录");
      setDirectories(result.directories);
      setSelected((old) => preselectNew
        ? result.directories.filter((item) => item.readable && item.indexedImages + item.indexedVideos === 0).map((item) => item.relPath)
        : old.filter((path) => result.directories.some((item) => item.relPath === path && item.readable)));
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "无法读取备份目录");
    }
  };

  useEffect(() => { void refresh(true); }, [source]);
  useEffect(() => {
    if (resume && status?.selectedDirectories) setSelected(status.selectedDirectories);
  }, [resume, status?.runId]);

  const start = async () => {
    const includes = resume ? status!.selectedDirectories! : selected;
    if (!source || includes.length === 0) return;
    setBusy(true); setError("");
    try {
      const next = await startRemoteIndex(source, includes);
      if (!next.ok) throw new Error(next.error || "启动扫描失败");
      onStarted(next);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "启动扫描失败");
    } finally { setBusy(false); }
  };

  const selectedScan = status?.scanMode === "selected";
  const newImages = status?.newInRun?.image || 0;
  const newVideos = status?.newInRun?.video || 0;

  return (
    <div style={{ ...card, padding: "18px 22px", marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>新增备份目录</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.6 }}>
            选择 S300 上名称含“备份”的目录，只检查所选目录及其子目录。原件留在原处，扫描后再分析时间与地点。
          </div>
        </div>
        <Btn variant="ghost" onClick={() => void refresh(false)} disabled={busy || !source}>刷新目录</Btn>
      </div>
      {directories.length === 0 && !error && <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 12 }}>当前没有发现可选的备份目录。</div>}
      {directories.map((item) => (
        <label key={item.relPath} style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 11, fontSize: 12.5, color: item.readable ? "var(--text-primary)" : "var(--text-tertiary)", cursor: item.readable ? "pointer" : "default" }}>
          <input type="checkbox" checked={selected.includes(item.relPath)} disabled={!item.readable || busy || disabled || resume || !!status?.processAlive}
            onChange={(event) => setSelected((old) => event.target.checked ? [...old, item.relPath] : old.filter((value) => value !== item.relPath))} />
          <span style={{ flex: 1, overflowWrap: "anywhere" }}>{item.name}</span>
          <span style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>
            {item.readable ? `索引中已有 ${(item.indexedImages + item.indexedVideos).toLocaleString()} 项` : "无法读取"}
          </span>
        </label>
      ))}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 15, flexWrap: "wrap" }}>
        <Btn onClick={start} disabled={busy || disabled || !!status?.processAlive || (!resume && selected.length === 0)}>
          {busy ? "启动中…" : resume ? "继续定向扫描" : `扫描所选 ${selected.length} 个备份目录`}
        </Btn>
        <span style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>未选择的目录不会被标为缺失；再次勾选同一目录可检查后来同步的文件。</span>
      </div>
      {error && <div style={{ marginTop: 9, fontSize: 12, color: "var(--red)" }}>{error}</div>}
      {selectedScan && status && (
        <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7 }}>
          本轮新增照片 {newImages.toLocaleString()} 张、视频 {newVideos.toLocaleString()} 个
          {' · '}已检查 {(status.indexedThisRun || 0).toLocaleString()} 项
          {' · '}目录完成 {(status.directories?.done || 0).toLocaleString()} / {((status.directories?.done || 0) + (status.directories?.pending || 0) + (status.directories?.scanning || 0)).toLocaleString()}
          {status.errors ? ` · 错误 ${status.errors}` : ""}
        </div>
      )}
    </div>
  );
}
