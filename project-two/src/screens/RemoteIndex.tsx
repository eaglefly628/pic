import { useEffect, useRef, useState, type ReactNode } from "react";
import { fmtSize } from "../lib/format";
import {
  backupRemoteIndex,
  getPhotoDuplicateStatus,
  getPhotoDuplicateCleanupStatus,
  getPhotoOrganizeStatus,
  getRemoteIndexStatus,
  pausePhotoOrganize,
  pauseMetadataAnalysis,
  planPhotoOrganize,
  planPhotoReviewOrganize,
  revealRemoteIndex,
  startPhotoOrganize,
  startMetadataAnalysis,
  startRemoteIndex,
  type PhotoOrganizeStatus,
  type PhotoDuplicateStatus,
  type PhotoDuplicateCleanupStatus,
  type RemoteIndexStatus,
} from "../lib/remoteIndex";
import { Btn, card } from "../ui";
import BackupDirectoryScanner from "../components/BackupDirectoryScanner";

export default function RemoteIndex() {
  const [data, setData] = useState<RemoteIndexStatus | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [backupMessage, setBackupMessage] = useState("");
  const [organize, setOrganize] = useState<PhotoOrganizeStatus | null>(null);
  const [duplicate, setDuplicate] = useState<PhotoDuplicateStatus | null>(null);
  const [cleanup, setCleanup] = useState<PhotoDuplicateCleanupStatus | null>(null);
  const [organizeConfirm, setOrganizeConfirm] = useState(false);
  const [metadataRate, setMetadataRate] = useState(0);
  const metadataSample = useRef<{ processed: number; at: number } | null>(null);
  const organizePolling = useRef(false);

  const acceptOrganizeStatus = (next: PhotoOrganizeStatus) => {
    setOrganize(next);
  };

  const refreshOrganize = async () => {
    if (organizePolling.current) return;
    organizePolling.current = true;
    try { acceptOrganizeStatus(await getPhotoOrganizeStatus()); }
    catch (err) { setError(err instanceof Error ? err.message : "无法读取整理进度"); }
    finally { organizePolling.current = false; }
  };

  const loadStatus = async () => {
    try {
      const [next, organizeNext] = await Promise.all([getRemoteIndexStatus(), getPhotoOrganizeStatus()]);
      const analysis = next.metadataAnalysis;
      if (analysis?.processAlive) {
        const now = Date.now();
        const previous = metadataSample.current;
        if (!previous || analysis.processed < previous.processed) {
          metadataSample.current = { processed: analysis.processed, at: now };
        } else if (analysis.processed > previous.processed) {
          const seconds = (now - previous.at) / 1000;
          if (seconds > 0) {
            const currentRate = (analysis.processed - previous.processed) / seconds;
            setMetadataRate((old) => old > 0 ? old * 0.65 + currentRate * 0.35 : currentRate);
          }
          metadataSample.current = { processed: analysis.processed, at: now };
        }
      } else {
        metadataSample.current = null;
      }
      setData(next);
      acceptOrganizeStatus(organizeNext);
    }
    catch (err) { setError(err instanceof Error ? err.message : "无法读取索引报告"); }
  };

  useEffect(() => { void loadStatus(); }, []);
  useEffect(() => {
    if (!data?.processAlive && !data?.metadataAnalysis?.processAlive && !organize?.processAlive) return;
    // The directory summary comes from the live index, which organize updates on every move.
    // Poll it less often than the lightweight organize progress endpoint.
    const interval = data?.processAlive || data?.metadataAnalysis?.processAlive ? 1800 : 20000;
    const timer = window.setInterval(() => void loadStatus(), interval);
    return () => window.clearInterval(timer);
  }, [data?.processAlive, data?.metadataAnalysis?.processAlive, organize?.processAlive]);
  useEffect(() => {
    if (organize?.status === "completed" || organize?.status === "error" || organize?.status === "paused") {
      void loadStatus();
    }
  }, [organize?.status]);
  useEffect(() => {
    void refreshOrganize();
    // 即使当前显示为暂停也要继续低频探测：任务可能由后台恢复、服务重启或网络重连。
    const timer = window.setInterval(() => void refreshOrganize(), organize?.processAlive ? 1200 : 5000);
    return () => window.clearInterval(timer);
  }, [organize?.processAlive]);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const [next, cleanupNext] = await Promise.all([getPhotoDuplicateStatus(), getPhotoDuplicateCleanupStatus()]);
        if (active) { setDuplicate(next); setCleanup(cleanupNext); }
      }
      catch { /* Other index functions remain usable if this progress endpoint is unavailable. */ }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 3000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

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
  const mediaDirectories = (data.topDirectories || []).filter((d) => d.media > 0);
  const maxDir = Math.max(1, ...mediaDirectories.map((d) => d.media));
  const metadataPending = data.metadataPending || 0;
  const unarchivedMedia = data.unarchivedMedia || 0;

  const rescan = async () => {
    if (!data.source) return;
    setBusy(true); setError("");
    try { setData(await startRemoteIndex(data.source)); }
    catch (err) { setError(err instanceof Error ? err.message : "启动增量扫描失败"); }
    finally { setBusy(false); }
  };

  const analyzeMetadata = async () => {
    if (!data.source) return;
    setBusy(true); setError("");
    try {
      const next = await startMetadataAnalysis(data.source);
      setData(next);
      if (!next.ok) setError(next.error || "时间与地点分析启动失败");
    } catch (err) { setError(err instanceof Error ? err.message : "时间与地点分析启动失败"); }
    finally { setBusy(false); }
  };

  const pauseMetadata = async () => {
    setBusy(true);
    try { await pauseMetadataAnalysis(); await loadStatus(); }
    catch (err) { setError(err instanceof Error ? err.message : "暂停分析失败"); }
    finally { setBusy(false); }
  };

  const backupIndex = async () => {
    setBusy(true); setBackupMessage(""); setError("");
    try {
      const result = await backupRemoteIndex();
      if (result.ok) setBackupMessage(`已备份到 S300：${result.remotePath}`);
      else setBackupMessage(result.error || `本机备份已保存：${result.localPath || ""}`);
    } catch (err) { setError(err instanceof Error ? err.message : "备份失败"); }
    finally { setBusy(false); }
  };

  const planOrganize = async () => {
    setBusy(true); setError("");
    try {
      const next = await planPhotoOrganize();
      acceptOrganizeStatus(next);
      if (!next.ok) setError(next.error || "生成整理预演失败");
    } catch (err) { setError(err instanceof Error ? err.message : "生成整理预演失败"); }
    finally { setBusy(false); }
  };

  const planReviewOrganize = async () => {
    setBusy(true); setError("");
    try {
      const next = await planPhotoReviewOrganize();
      acceptOrganizeStatus(next);
      if (!next.ok) setError(next.error || "生成待确认项预演失败");
    } catch (err) { setError(err instanceof Error ? err.message : "生成待确认项预演失败"); }
    finally { setBusy(false); }
  };

  const runOrganize = async () => {
    setOrganizeConfirm(false);
    setBusy(true); setError("");
    if (organize) setOrganize({ ...organize, status: "running", processAlive: true, message: "启动请求已收到，正在连接 S300…" });
    try {
      const next = await startPhotoOrganize();
      acceptOrganizeStatus(next);
      if (!next.ok) setError(next.error || "启动整理失败");
    } catch (err) { setError(err instanceof Error ? err.message : "启动整理失败"); }
    finally { setBusy(false); }
  };

  const pauseOrganize = async () => {
    setBusy(true); setError("");
    try { acceptOrganizeStatus(await pausePhotoOrganize()); }
    catch (err) { setError(err instanceof Error ? err.message : "暂停整理失败"); }
    finally { setBusy(false); }
  };

  return (
    <div className="fv-remote-index" style={{ padding: "24px 32px 42px", width: "100%", maxWidth: 1020, boxSizing: "border-box", animation: "fvFade .25s ease" }}>
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
          <Btn variant="ghost" onClick={backupIndex} disabled={busy}>备份数据库</Btn>
          <Btn onClick={rescan} disabled={busy || data.processAlive || (data.scanMode === "selected" && data.status === "paused")}>{busy ? "启动中…" : "全盘复查"}</Btn>
        </div>
        {backupMessage && <div style={{ marginTop: 10, fontSize: 11.5, color: backupMessage.startsWith("已备份到") ? "var(--green)" : "var(--orange)", overflowWrap: "anywhere" }}>{backupMessage}</div>}
        {error && <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--red)" }}>{error}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(135px,1fr))", gap: 10, marginTop: 17 }}>
          <Metric label="全部文件" value={totalFiles.toLocaleString()} />
          <Metric label="照片" value={image.files.toLocaleString()} />
          <Metric label="视频" value={video.files.toLocaleString()} />
          <Metric label="媒体容量" value={fmtSize(image.bytes + video.bytes)} />
          <Metric label="数据库" value={fmtSize(data.dbBytes || 0)} />
          <Metric label="待分析媒体" value={metadataPending.toLocaleString()} />
          <Metric label="库外待归档" value={unarchivedMedia.toLocaleString()} />
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

      <BackupDirectoryScanner source={data.source || data.defaultSource} status={data}
        disabled={busy || !!data.metadataAnalysis?.processAlive || !!organize?.processAlive} onStarted={setData} />

      <div style={{ ...card, padding: "18px 22px", marginTop: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>下一步工作流</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10 }}>
          <WorkflowStep index="1" title="文件索引" desc="清单、类型、容量和目录结构" state={data.processAlive ? "扫描中" : data.status === "paused" ? "可继续" : "已完成"} active={!data.processAlive && data.status === "completed"} />
          <WorkflowStep index="2" title="时间与地点" desc="只处理尚未分析的媒体；读取拍摄时间和位置，标记不确定项"
            state={data.metadataAnalysis?.processAlive ? "进行中" : metadataPending ? `待分析 ${metadataPending.toLocaleString()} 项` : "已完成"}
            active={!metadataPending && data.metadataAnalysis?.status === "completed"}
            action={data.metadataAnalysis?.processAlive
              ? <Btn variant="ghost" onClick={pauseMetadata} disabled={busy}>安全暂停</Btn>
              : !metadataPending
                ? <span style={{ fontSize: 11, color: "var(--green)" }}>时间与地点已分析</span>
                : <Btn onClick={analyzeMetadata} disabled={busy || data.processAlive}>{data.metadataAnalysis?.status === "paused" ? "继续分析" : "分析新增媒体"}</Btn>} />
          <WorkflowStep index="3" title={unarchivedMedia ? "新增备份归档" : organize?.layout === "other_review" ? "其他文件收纳" : organize?.layout === "review_month_year" ? "待确认项目归档" : "按时间整理"} desc="先生成预演，再在 S300 内原子移动；同步更新索引，可暂停续跑"
            state={organize?.processAlive ? "进行中" : organize?.status === "planned" ? "待确认" : unarchivedMedia ? `库外 ${unarchivedMedia.toLocaleString()} 项` : "已完成"}
            active={!unarchivedMedia && organize?.status === "completed"}
            action={organize?.processAlive
              ? <Btn variant="ghost" onClick={pauseOrganize} disabled={busy}>安全暂停</Btn>
              : organize?.status === "planned" || organize?.status === "paused" || organize?.status === "error"
                ? <Btn onClick={organize.status === "planned" ? () => setOrganizeConfirm(true) : runOrganize} disabled={busy}>{organize.status === "planned" ? "确认并开始整理" : "继续整理"}</Btn>
                : !unarchivedMedia && organize?.status === "completed"
                  ? <span style={{ fontSize: 11, color: "var(--green)" }}>文件和索引均已更新</span>
                  : organize?.status === "completed" && (organize.layout === "day" || organize.layout === "month") && (organize.needsReview || 0) > 0
                    ? <Btn onClick={planReviewOrganize} disabled={busy || !!data.processAlive || metadataPending > 0 || !!data.metadataAnalysis?.processAlive}>生成待确认项预演</Btn>
                  : <Btn onClick={planOrganize} disabled={busy || !!data.processAlive || metadataPending > 0 || !!data.metadataAnalysis?.processAlive}>生成新增文件预演</Btn>} />
          <WorkflowStep index="4" title="重复检测" desc="按年、月目录依次比较；同月内先按大小筛选，再以完整哈希确认" state={duplicate?.status === "completed" ? "已完成" : duplicate?.status === "running" ? "进行中" : duplicate?.status === "error" ? "需检查" : "等待整理"}
            active={duplicate?.status === "completed"}
            action={duplicate?.status !== "not_started" && duplicate ? <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{duplicate.completedMonths || 0}/{duplicate.months || 0} 个月</span> : undefined} />
          <WorkflowStep index="5" title="重复副本清理" desc="同月、同大小、完整哈希一致；每组保留一份，按断点记录进度"
            state={cleanup?.status === "completed" ? "已完成" : cleanup?.status === "running" ? "进行中" : cleanup?.status === "paused" ? "已暂停" : cleanup?.status === "error" ? "需检查" : "等待审核"}
            active={cleanup?.status === "completed"}
            action={cleanup && cleanup.status !== "not_started" ? <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{(cleanup.deleted || 0).toLocaleString()}/{(cleanup.total || 0).toLocaleString()} 项</span> : undefined} />
        </div>
        {duplicate && duplicate.status !== "not_started" && (
          <div style={{ marginTop: 13, padding: "13px 14px", borderRadius: 10, border: "1px solid var(--separator)", background: "var(--fill-quaternary)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12.5, color: "var(--text-primary)" }}>
              <strong>按月重复检测：{duplicate.completedMonths || 0} / {duplicate.months || 0} 个月</strong>
              <strong>{(duplicate.monthPercent || 0).toFixed(1)}%</strong>
            </div>
            <div style={{ height: 6, marginTop: 8, background: "var(--track)", borderRadius: 5, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${duplicate.monthPercent || 0}%`, background: "var(--green)", borderRadius: 5 }} />
            </div>
            <div style={{ marginTop: 7, fontSize: 11.5, color: "var(--text-secondary)" }}>
              {duplicate.currentMonth ? `当前 ${duplicate.currentMonth.month}：${duplicate.currentMonth.percent.toFixed(1)}% · ` : ""}
              同月同大小的待核查文件 {(duplicate.candidates || 0).toLocaleString()} · 错误 {duplicate.errors || 0}
            </div>
            <div style={{ marginTop: 5, fontSize: 11.5, color: "var(--text-primary)" }}>
              已经完整哈希确认：{(duplicate.confirmedGroups || 0).toLocaleString()} 组，额外副本 {(duplicate.confirmedDuplicateFiles || 0).toLocaleString()} 个，理论可节省 {fmtSize(duplicate.potentialReclaimBytes || 0)}。检测已完成；清理进度见下方。
            </div>
            {duplicate.error && <div style={{ marginTop: 5, color: "var(--red)", fontSize: 11 }}>{duplicate.error}</div>}
          </div>
        )}
        {cleanup && cleanup.status !== "not_started" && (
          <div style={{ marginTop: 13, padding: "13px 14px", borderRadius: 10, border: "1px solid var(--separator)", background: "var(--fill-quaternary)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12.5, color: "var(--text-primary)" }}>
              <strong>重复副本清理：{(cleanup.deleted || 0).toLocaleString()} / {(cleanup.total || 0).toLocaleString()} 项</strong>
              <strong>{(cleanup.percent || 0).toFixed(1)}%</strong>
            </div>
            <div style={{ height: 6, marginTop: 8, background: "var(--track)", borderRadius: 5, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${cleanup.percent || 0}%`, background: "var(--green)", borderRadius: 5 }} />
            </div>
            <div style={{ marginTop: 7, fontSize: 11.5, color: "var(--text-secondary)" }}>
              已释放 {fmtSize(cleanup.deletedBytes || 0)} · 剩余 {(cleanup.remaining || 0).toLocaleString()} 项 · 错误 {cleanup.errors || 0}
            </div>
            {cleanup.error && <div style={{ marginTop: 5, color: "var(--red)", fontSize: 11 }}>{cleanup.error}</div>}
          </div>
        )}
        {organizeConfirm && organize?.status === "planned" && (
          <div style={{ marginTop: 13, padding: "13px 14px", borderRadius: 10, border: "1px solid var(--orange)", background: "var(--fill-quaternary)" }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)" }}>确认开始整理</div>
            <div style={{ marginTop: 6, fontSize: 11.5, lineHeight: 1.6, color: "var(--text-secondary)" }}>
              {organize.layout === "other_review"
                ? `本轮将在 S300 内把 ${(organize.total || 0).toLocaleString()} 个其他文件移入“家庭影像库/_其他文件待审核”，保留原相对路径；不覆盖文件，可暂停续跑。`
                : organize.layout === "review_month_year"
                ? `本轮将在 S300 内移动 ${(organize.total || 0).toLocaleString()} 项：月份 ${(organize.reviewPhase?.month.total || 0).toLocaleString()}、仅年份 ${(organize.reviewPhase?.yearOnly.total || 0).toLocaleString()}、未能归档 ${(organize.reviewPhase?.unclassified.total || 0).toLocaleString()}。原路径与索引一并记录；可暂停续跑。`
                : `将在 S300 内移动 ${(organize.total || 0).toLocaleString()} 个可信时间文件（${fmtSize(organize.bytesTotal || 0)}）。不会覆盖、删除或合并文件；${(organize.needsReview || 0).toLocaleString()} 个低可信项继续留在原处。任务可安全暂停并续跑。`}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <Btn onClick={runOrganize} disabled={busy}>{busy ? "正在启动…" : "开始整理"}</Btn>
              <Btn variant="ghost" onClick={() => setOrganizeConfirm(false)} disabled={busy}>取消</Btn>
            </div>
          </div>
        )}
        {data.metadataAnalysis && data.metadataAnalysis.status !== "not_started" && (
          <div style={{ marginTop: 13, padding: "11px 12px", borderRadius: 9, background: "var(--fill-quaternary)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 11.5, color: "var(--text-secondary)" }}>
              <span>时间地点分析：{data.metadataAnalysis.processed.toLocaleString()} / {data.metadataAnalysis.total.toLocaleString()}</span>
              <span>GPS {(data.metadataAnalysis.withGps || 0).toLocaleString()} · 待确认 {(data.metadataAnalysis.needsReview || 0).toLocaleString()}</span>
            </div>
            {data.metadataAnalysis.processAlive && (
              <div style={{ marginTop: 5, fontSize: 11, color: "var(--text-tertiary)" }}>
                {metadataRate > 0
                  ? `当前约 ${metadataRate.toFixed(1)} 个/秒 · 预计剩余 ${formatDuration((data.metadataAnalysis.total - data.metadataAnalysis.processed) / metadataRate)}`
                  : "正在采样处理速度，稍后显示预计剩余时间…"}
              </div>
            )}
            <div style={{ height: 7, background: "var(--track)", borderRadius: 5, marginTop: 7, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${data.metadataAnalysis.total ? Math.min(100, data.metadataAnalysis.processed / data.metadataAnalysis.total * 100) : 0}%`, background: "var(--accent)", borderRadius: 5 }} />
            </div>
          </div>
        )}
        {organize && organize.status !== "not_started" && (
          <div style={{ marginTop: 13, padding: "12px", borderRadius: 9, background: "var(--fill-quaternary)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", fontSize: 11.5, color: "var(--text-secondary)" }}>
              <span>{organize.layout === "other_review" ? "其他文件收纳" : organize.layout === "review_month_year" ? "待确认项目归档" : "时间整理"}：{(organize.verified || 0).toLocaleString()} / {(organize.total || 0).toLocaleString()}</span>
              <span>{organize.layout === "other_review"
                ? `待审核 ${(organize.total || 0).toLocaleString()} · 错误 ${(organize.errors || 0).toLocaleString()}`
                : organize.layout === "review_month_year"
                ? `仍需人工判定年份 ${(organize.needsReview || 0).toLocaleString()} · 错误 ${(organize.errors || 0).toLocaleString()}`
                : `可信时间 ${(organize.reliable || 0).toLocaleString()} · 待确认 ${(organize.needsReview || 0).toLocaleString()} · ${fmtSize(organize.bytesTotal || 0)}`}</span>
            </div>
            {organize.layout === "review_month_year" && organize.reviewPhase && (
              <div style={{ marginTop: 7, fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.55 }}>
                归入月份 {organize.reviewPhase.month.verified.toLocaleString()} / {organize.reviewPhase.month.total.toLocaleString()}
                {' · '}仅确定年份 {organize.reviewPhase.yearOnly.verified.toLocaleString()} / {organize.reviewPhase.yearOnly.total.toLocaleString()}
                {' · '}未能归档，未归类 {organize.reviewPhase.unclassified.verified.toLocaleString()} / {organize.reviewPhase.unclassified.total.toLocaleString()}
              </div>
            )}
            <div style={{ height: 7, background: "var(--track)", borderRadius: 5, marginTop: 7, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${organize.total ? Math.min(100, (organize.verified || 0) / organize.total * 100) : 0}%`, background: "var(--green)", borderRadius: 5 }} />
            </div>
            {organize.processAlive && (
              <div style={{ marginTop: 7, fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.55 }}>
                <div>{organize.averageRate && organize.estimatedRemainingSeconds != null
                  ? `已完成批次累计平均约 ${organize.averageRate.toFixed(1)} 个/秒 · 预计剩余 ${formatStableDuration(organize.estimatedRemainingSeconds)}`
                  : "任务已启动，正在统计已完成批次…"} · 已整理 {fmtSize(organize.bytesMoved || 0)}</div>
                {organize.lastPath && <div title={organize.lastPath} style={{ marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-tertiary)" }}>当前：{organize.lastPath}</div>}
              </div>
            )}
            {!!organize.errors && <div style={{ marginTop: 6, fontSize: 11, color: "var(--red)" }}>错误 {organize.errors.toLocaleString()} · 任务会停止等待核对，不会跳过后继续覆盖。</div>}
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-tertiary)", overflowWrap: "anywhere" }}>
              {organize.layout === "other_review"
                ? `目标：${organize.targetRoot}/_其他文件待审核。保留原相对路径；同名文件不覆盖。`
                : organize.layout === "review_month_year"
                ? `目标：${organize.targetRoot}。只确定年份的进入“_仅确定年份”；年份冲突或未知的进入“未能归档，未归类”并保留原相对路径。同名文件不覆盖。`
                : `目标：${organize.targetRoot}。按“年份 / 月份”存放，文件名以拍摄时间开头，按名称即可按时间排序；低可信项原地保留，同名文件绝不覆盖。`}
            </div>
            {organize.status === "planned" && !!organize.examples?.length && (
              <div style={{ marginTop: 9, display: "grid", gap: 4 }}>
                {organize.examples.slice(0, 4).map((item) => <div key={item.sourceRel} style={{ fontSize: 10.5, color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={`${item.sourceRel} → ${item.targetRel}`}>{item.sourceRel} → {item.targetRel}</div>)}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="fv-report-split" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.5fr) minmax(240px,1fr)", gap: 16, marginTop: 16 }}>
        <div style={{ ...card, padding: "18px 22px" }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>
            媒体最多的目录{organize?.processAlive ? "（整理中，约每 20 秒更新）" : ""}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 12 }}>
            数量为照片与视频；容量包括目录中其他已索引文件。
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {mediaDirectories.map((dir) => (
              <div key={dir.topDir}>
                <div className="fv-directory-row" style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "baseline", fontSize: 11.5, marginBottom: 4 }}>
                  <span title={dir.topDir} style={{ flex: "1 1 auto", minWidth: 0, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dir.topDir}</span>
                  <span style={{ flex: "0 0 auto", color: "var(--text-tertiary)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{dir.media.toLocaleString()} · {fmtSize(dir.bytes)}</span>
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

      <div style={{ marginTop: 12, fontSize: 11, color: "var(--text-tertiary)", overflowWrap: "anywhere" }}>数据库：{data.db}</div>
      {!!data.skippedDirectories?.length && <div style={{ marginTop: 4, fontSize: 11, color: "var(--orange)" }}>无权限跳过：{data.skippedDirectories.map((d) => d.rel_path || "(根目录)").join("、")}</div>}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div style={{ background: "var(--fill-quaternary)", padding: "10px 12px", borderRadius: 9 }}><div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 3 }}>{label}</div><div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{value}</div></div>;
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "不到 1 分钟";
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  if (minutes < 60) return `约 ${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `约 ${hours} 小时 ${rest} 分钟` : `约 ${hours} 小时`;
}

function formatStableDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "不到 1 分钟";
  const minutes = Math.ceil(seconds / 60);
  const step = minutes >= 360 ? 30 : minutes >= 60 ? 15 : 5;
  return formatDuration(Math.ceil(minutes / step) * step * 60);
}

function WorkflowStep({ index, title, desc, state, active = false, action }: { index: string; title: string; desc: string; state: string; active?: boolean; action?: ReactNode }) {
  return <div style={{ padding: 13, borderRadius: 10, border: `0.5px solid ${active ? "var(--accent)" : "var(--separator)"}`, background: active ? "var(--accent-soft)" : "var(--fill-quaternary)" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 21, height: 21, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: active ? "var(--accent)" : "var(--track)", color: active ? "#fff" : "var(--text-secondary)", fontSize: 11 }}>{index}</span><b style={{ fontSize: 12.5, color: "var(--text-primary)" }}>{title}</b><span style={{ marginLeft: "auto", fontSize: 10.5, color: active ? "var(--accent)" : "var(--text-tertiary)" }}>{state}</span></div>
    <div style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.55, marginTop: 7 }}>{desc}</div>
    {action && <div style={{ marginTop: 10 }}>{action}</div>}
  </div>;
}
