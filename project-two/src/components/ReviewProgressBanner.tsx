import { useEffect, useState } from "react";
import { getPhotoDuplicateCleanupStatus, getPhotoDuplicateStatus, getPhotoOrganizeStatus, type PhotoDuplicateCleanupStatus, type PhotoDuplicateStatus, type PhotoOrganizeStatus } from "../lib/remoteIndex";
import { fmtSize } from "../lib/format";

export default function ReviewProgressBanner({ onOpen }: { onOpen: () => void }) {
  const [job, setJob] = useState<PhotoOrganizeStatus | null>(null);
  const [duplicate, setDuplicate] = useState<PhotoDuplicateStatus | null>(null);
  const [cleanup, setCleanup] = useState<PhotoDuplicateCleanupStatus | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const [result, duplicateResult, cleanupResult] = await Promise.all([getPhotoOrganizeStatus(), getPhotoDuplicateStatus(), getPhotoDuplicateCleanupStatus()]);
        if (active) { setJob(result); setDuplicate(duplicateResult); setCleanup(cleanupResult); }
      } catch { /* The detailed connection error remains available in 索引报告. */ }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 3000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  if (cleanup && cleanup.status !== "not_started") {
    const percent = cleanup.percent || 0;
    return (
      <button onClick={onOpen} style={{ width: "100%", border: "none", borderBottom: "0.5px solid var(--separator)", background: "var(--fill-quaternary)", color: "var(--text-primary)", textAlign: "left", padding: "9px 18px", cursor: "pointer" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", fontSize: 11.5 }}>
          <strong>完全重复副本清理 · {cleanup.status === "completed" ? "已完成" : cleanup.status === "running" ? "进行中" : cleanup.status === "paused" ? "已暂停" : "需检查"} · {(cleanup.deleted || 0).toLocaleString()} / {(cleanup.total || 0).toLocaleString()}（{percent.toFixed(1)}%）</strong>
          <span>已释放 {fmtSize(cleanup.deletedBytes || 0)} · 剩余 {(cleanup.remaining || 0).toLocaleString()} · 错误 {cleanup.errors || 0}　查看详情 ›</span>
        </div>
        <div style={{ height: 4, marginTop: 7, background: "var(--track)", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${percent}%`, background: "var(--green)", transition: "width .4s" }} />
        </div>
      </button>
    );
  }
  if (duplicate && duplicate.status !== "not_started") {
    const percent = duplicate.monthPercent || 0;
    const current = duplicate.currentMonth;
    return (
      <button onClick={onOpen} style={{ width: "100%", border: "none", borderBottom: "0.5px solid var(--separator)", background: "var(--fill-quaternary)", color: "var(--text-primary)", textAlign: "left", padding: "9px 18px", cursor: "pointer" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", fontSize: 11.5 }}>
          <strong>按月重复检测 · {duplicate.status === "completed" ? "已完成" : duplicate.status === "running" ? "进行中" : duplicate.status === "paused" ? "已暂停" : "需检查"} · {duplicate.completedMonths || 0}/{duplicate.months || 0} 个月（{percent.toFixed(1)}%）</strong>
          <span>{current ? `当前 ${current.month}：${current.percent.toFixed(1)}%` : ""} · 已确认额外副本 {(duplicate.confirmedDuplicateFiles || 0).toLocaleString()} 个 · 只读检查　查看详情 ›</span>
        </div>
        <div style={{ height: 4, marginTop: 7, background: "var(--track)", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${percent}%`, background: "var(--green)", transition: "width .4s" }} />
        </div>
      </button>
    );
  }
  if (!job || (job.layout !== "review_month_year" && job.layout !== "other_review")) return null;
  const total = job.total || 0;
  const verified = job.verified || 0;
  const percent = total ? Math.min(100, verified / total * 100) : 0;
  const phase = job.reviewPhase;
  const otherReview = job.layout === "other_review";
  return (
    <button onClick={onOpen} style={{ width: "100%", border: "none", borderBottom: "0.5px solid var(--separator)", background: "var(--fill-quaternary)", color: "var(--text-primary)", textAlign: "left", padding: "9px 18px", cursor: "pointer" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", fontSize: 11.5 }}>
        <strong>{otherReview ? "其他文件收纳" : "待确认时间归档"} · {job.status === "completed" ? "已完成" : job.status === "running" ? "进行中" : job.status === "planned" ? "准备中" : job.status === "paused" ? "已暂停" : "需检查"} · {verified.toLocaleString()} / {total.toLocaleString()}</strong>
        <span>{otherReview
          ? `保留原相对路径 · 错误 ${(job.errors || 0).toLocaleString()}　查看详情 ›`
          : phase && `月份 ${phase.month.verified.toLocaleString()}/${phase.month.total.toLocaleString()} · 仅年份 ${phase.yearOnly.verified.toLocaleString()}/${phase.yearOnly.total.toLocaleString()} · 未能归档 ${phase.unclassified.verified.toLocaleString()}/${phase.unclassified.total.toLocaleString()} · 错误 ${(job.errors || 0).toLocaleString()}　查看详情 ›`}</span>
      </div>
      <div style={{ height: 4, marginTop: 7, background: "var(--track)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${percent}%`, background: "var(--green)", transition: "width .4s" }} />
      </div>
    </button>
  );
}
