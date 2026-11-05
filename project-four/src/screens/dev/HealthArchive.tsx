import { useEffect, useMemo, useRef, useState } from "react";
import { Btn } from "../../ui";
import "./HealthArchive.css";
import { HEALTH_CATEGORIES, METRIC_INFO } from "../../data/healthMetrics";

type Report = { source_id: string; date: string | null; filename: string; provider?: string; pages: number; count: number; pdf_url: string; source_available: boolean; issues: { text: string }[]; sampled_at?: string; encounter_id?: string; panel_name?: string; historical_references?: {date: string; name: string; original_cell: string; source_page: number; status: string}[]; findings?: { text: string }[] };
type Row = { sampled_at?: string; normalization_note?: string; supporting_sources?: {source_id: string; source_page: number}[]; id: string; source_id: string; source_page: number; date: string | null; metric_key: string; name: string; original_value: string; original_unit?: string; normalized_value: number | null; normalized_unit: string | null; reference_range_raw?: string; report_flag?: string; trend_eligible?: boolean; comparator?: string | null; needs_review?: boolean };
type Archive = { reports: Report[]; observations: Row[]; updated_at?: string };
const GROUPS = ["全部", ...HEALTH_CATEGORIES];
const preferred = ["lipid.ldl", "lipid.tc", "lipid.tg", "glucose.fasting", "glucose.hba1c.percent", "body.weight", "body.waist", "bp.systolic", "liver.alt", "renal.creatinine", "cbc.wbc"];
const errorText = (e: unknown) => e instanceof Error ? e.message : "操作失败，请重试";
const dateLabel = (d: string | null) => d || "日期待确认";
const unitLabel = (u: string | null) => u === "1" ? "无量纲" : u || "单位待核对";
function download(blob: Blob, name: string) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }

export default function HealthArchive() {
  const [archive, setArchive] = useState<Archive | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<File | null>(null);
  const [view, setView] = useState<"trends" | "timeline" | "review" | "library">("trends");
  const [infoKey, setInfoKey] = useState<string | null>(null);
  const infoDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = infoDialog.current; if (!dialog) return; if (infoKey && !dialog.open) dialog.showModal(); else if (!infoKey && dialog.open) dialog.close(); }, [infoKey]);
  const [group, setGroup] = useState("全部");
  const [query, setQuery] = useState("");
  const [metric, setMetric] = useState("lipid.ldl");
  const [unit, setUnit] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reportId, setReportId] = useState("");
  const [reverse, setReverse] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  async function load() {
    setLoading(true); setError("");
    try { const r = await fetch("/api/health/archive", { cache: "no-store" }); if (!r.ok) throw new Error("健康服务暂不可用，请从统一入口启动应用"); const d = await r.json(); if (!d.ok) throw new Error(d.error); setArchive(d); }
    catch (e) { setError(errorText(e)); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  const rows = archive?.observations ?? [];
  const reports = useMemo(() => [...(archive?.reports ?? [])].sort((a, b) => a.date === null ? (b.date === null ? 0 : 1) : b.date === null ? -1 : a.date.localeCompare(b.date)), [archive]);
  const dated = reports.filter(r => r.date);
  const encounters = [...new Map(dated.map(r => [r.encounter_id || r.source_id, dated.filter(d => (d.encounter_id || d.source_id) === (r.encounter_id || r.source_id))])).values()];
  const historical = reports.flatMap(r => (r.historical_references || []).map(h => ({...h, source_id:r.source_id, pdf_url:r.pdf_url})));
  const metrics = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) if ((group === "全部" || METRIC_INFO[r.metric_key]?.categories.includes(group)) && (!query || (r.name + r.metric_key).toLowerCase().includes(query.toLowerCase()))) map.set(r.metric_key, r.name);
    return [...map].sort((a, b) => { const ai = preferred.indexOf(a[0]), bi = preferred.indexOf(b[0]); return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi) || a[1].localeCompare(b[1], "zh"); });
  }, [rows, group, query]);
  const activeMetric = metrics.some(m => m[0] === metric) ? metric : metrics[0]?.[0] ?? "";
  const metricRows = rows.filter(r => r.metric_key === activeMetric && r.date && (!from || r.date >= from) && (!to || r.date <= to)).sort((a, b) => a.date!.localeCompare(b.date!));
  const units = [...new Set(metricRows.filter(r => r.trend_eligible).map(r => r.normalized_unit).filter((u): u is string => !!u))];
  const activeUnit = units.includes(unit) ? unit : units[0] ?? "";
  const points = metricRows.filter(r => r.trend_eligible && r.normalized_unit === activeUnit && typeof r.normalized_value === "number" && Number.isFinite(r.normalized_value));
  const selectedReport = reports.find(r => r.source_id === reportId);
  const listed = reportId ? rows.filter(r => r.source_id === reportId) : metricRows;
  const latest = points[points.length - 1], previous = points[points.length - 2];
  const issuesCount = reports.reduce((n, r) => n + (r.issues?.length || 0), 0);
  async function importFile() {
    if (!pending || busy) return;
    setBusy(true); setNotice(""); setError("");
    try { const res = await fetch("/api/health/import", { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: pending }); if (!res.ok) throw new Error("导入请求失败"); const result = await res.json(); if (!result.ok) throw new Error(result.error); setPending(null); setNotice(`导入完成：新增 ${result.added} 条，跳过 ${result.duplicates} 条重复记录。`); await load(); }
    catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  async function backup() {
    setBusy(true); setError("");
    try { const r = await fetch("/api/health/export"); if (!r.ok || !r.headers.get("content-type")?.includes("zip")) throw new Error("备份未完成，请核对原件是否可读取"); download(await r.blob(), "health-archive.zip"); setNotice("备份已生成，包含结构化记录和可用的报告原件，可在 Mac 导入。"); } catch(e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  function exportCsv() {
    const fields: (keyof Row)[] = ["date", "name", "metric_key", "original_value", "original_unit", "normalized_value", "normalized_unit", "reference_range_raw", "report_flag", "source_page", "source_id"];
    const quote = (v: unknown) => { let s = String(v ?? ""); if (/^[=+@]/.test(s)) s = "'" + s; return '"' + s.replaceAll('"', '""') + '"'; };
    download(new Blob(["\ufeff" + [fields.join(","), ...rows.map(r => fields.map(f => quote(r[f])).join(","))].join("\r\n")], { type: "text/csv;charset=utf-8" }), "health-observations.csv"); setNotice("已导出全部指标明细。");
  }
  const reportLink = (r: Row) => { const doc = reports.find(d => d.source_id === r.source_id); return doc?.source_available ? <a href={`${doc.pdf_url}#page=${r.source_page}`} target="_blank" rel="noreferrer">第 {r.source_page} 页 ↗</a> : <span>原件未迁入</span>; };
  return <div className="ha">
    <section className="ha-hero"><div><div className="ha-eyebrow">YOUR HEALTH, OVER TIME</div><h1>把每一次检查，连成健康的时间线。</h1><p>体检、医院化验与日常测量，在同一份档案里追溯。每一个数字，都有出处。</p><div className="ha-hero-tag">本地档案 · 原件可追溯 · {dated.length ? `${dated[0].date} — ${dated[dated.length - 1]?.date}` : "等待首次导入"}</div></div><div className="ha-hero-mark" aria-hidden="true"><svg viewBox="0 0 160 100"><path d="M5 55H35L49 20L70 85L89 38L102 55H155" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/></svg></div></section>
    <div className="ha-toolbar"><nav>{([["trends", "指标趋势"], ["timeline", "检查时间线"], ["review", "待核对事项"], ["library", "指标百科"]] as const).map(([v, label]) => <button key={v} className={view === v ? "active" : ""} onClick={() => { setView(v); setReportId(""); }}>{label}</button>)}</nav><div className="ha-actions"><Btn variant="ghost" disabled={busy} onClick={() => input.current?.click()}>追加档案</Btn><Btn variant="ghost" disabled={busy || !rows.length} onClick={exportCsv}>导出明细</Btn><Btn disabled={busy || !archive} onClick={() => void backup()}>{busy ? "处理中…" : "备份 / 迁移到 Mac"}</Btn></div></div>
    <input ref={input} type="file" accept=".json,.zip" hidden onChange={e => { const f = e.target.files?.[0]; if (f) { if (f.size > 100 * 1024 * 1024) setError("文件超过 100 MB，请分批导入"); else setPending(f); } e.currentTarget.value = ""; }}/>
    {pending && <div className="ha-message"><b>追加：{pending.name}</b><p>接受已标准化的健康档案 JSON 或本应用备份 ZIP。重复记录跳过，修订冲突会拒绝覆盖。原始 PDF 需先识别整理，不能直接当作标准化档案导入。</p><Btn disabled={busy} onClick={() => void importFile()}>确认追加</Btn> <Btn variant="ghost" disabled={busy} onClick={() => setPending(null)}>取消</Btn></div>}
    {error && <div className="ha-message ha-error" role="alert">{error} <button onClick={() => void load()}>重新加载</button></div>}
    {notice && <div className="ha-message" role="status">{notice}</div>}
    <div className="ha-stats"><div><span>有日期的检查</span><b>{encounters.length}<small>次</small></b></div><div><span>统一归档记录</span><b>{rows.length}<small>条</small></b></div><div><span>可查看指标</span><b>{new Set(rows.map(r => r.metric_key)).size}<small>项</small></b></div><div><span>最近检查日期</span><b className="ha-date">{dated[dated.length - 1]?.date || "暂无"}</b><small>优先采样日，其次检查日</small></div></div>
    {loading && <div className="ha-empty" role="status">正在读取健康档案…</div>}
    {!loading && !rows.length && !error && <div className="ha-empty"><h2>从第一份健康档案开始</h2><p>导入已整理的 JSON，或恢复完整健康备份。原始报告需要先提取并核对日期、单位和来源。</p></div>}
    {(view === "trends" || view === "library") && !!rows.length && <div className="ha-groups" aria-label="医学分类">{GROUPS.map(label => <button key={label} className={label === group ? "active" : ""} onClick={() => { setGroup(label); setReportId(""); }}>{label}<small>{new Set(rows.filter(r => label === "全部" || METRIC_INFO[r.metric_key]?.categories.includes(label)).map(r => r.metric_key)).size}</small></button>)}</div>}
    {view === "library" && <section className="ha-section"><div className="ha-section-head"><div><h2>看懂每一个健康指标</h2><p>按医学领域查找，点击查看含义、用途、解读限制与资料来源。同一指标可属于多个领域。</p></div></div><input className="ha-library-search" placeholder="搜索指标名称或代码" value={query} onChange={e => setQuery(e.target.value)}/><div className="ha-library">{metrics.map(([key, name]) => <button key={key} className="ha-info-card" onClick={() => setInfoKey(key)}><span>{METRIC_INFO[key]?.categories.join(" · ") || "待分类"}</span><strong>{name}</strong><small>{key}</small><p>{METRIC_INFO[key]?.what || "医学说明尚待整理，不自动猜测。"}</p><b>查看医学说明 ↗</b></button>)}</div>{!metrics.length && <p className="ha-empty">没有匹配指标，请更换分类或搜索词。</p>}</section>}
    {view === "trends" && !!rows.length && <>
      <div className="ha-filters"><label>查找指标<input placeholder="名称或指标代码" value={query} onChange={e => setQuery(e.target.value)}/></label><label className="ha-select">查看指标<select value={activeMetric} onChange={e => { setMetric(e.target.value); setReportId(""); }}>{metrics.map(([key, name]) => <option value={key} key={key}>{name}</option>)}</select></label><label>从<input type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)}/></label><label>到<input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)}/></label><button className="ha-reset" onClick={() => { setFrom(""); setTo(""); setQuery(""); }}>重置</button></div>
      <section className="ha-chart-card"><div className="ha-chart-head"><div><div className="ha-eyebrow">LONGITUDINAL VIEW</div><h2>{metrics.find(m => m[0] === activeMetric)?.[1] || "没有匹配的指标"} {activeMetric && <button className="ha-info-trigger" onClick={() => setInfoKey(activeMetric)}>ⓘ 医学说明</button>}</h2><p>实际检查日期 · {points.length} 个可比测量点 · {unitLabel(activeUnit)}</p></div>{latest && <div className="ha-current"><strong>{latest.normalized_value}</strong><span>{unitLabel(activeUnit)}</span><small>{latest.date}{previous ? ` · 较上次 ${(latest.normalized_value! - previous.normalized_value!).toFixed(2)}` : ""}</small></div>}</div>
      {units.length > 1 && <label>按标准单位分别查看 <select value={activeUnit} onChange={e => setUnit(e.target.value)}>{units.map(u => <option key={u}>{u}</option>)}</select></label>}
      <TrendChart rows={points} onSelect={r => setReportId(r.source_id)}/><div className="ha-chart-note">点选测量点查看当次报告。虚线仅连接已测结果；空缺年份无测量，不补值。各次参考范围保留在下表。</div></section>
    </>}
    {view === "timeline" && <section className="ha-section"><div className="ha-section-head"><div><h2>按时间浏览每一次检查</h2><p>体检与医院单项化验共用时间线，同年多次检查分别保留。</p></div><button onClick={() => setReverse(v => !v)}>{reverse ? "最新在前" : "最早在前"} ⇅</button></div><div className="ha-timeline">{(reverse ? [...encounters].reverse() : encounters).map(batch => <div key={batch[0].encounter_id || batch[0].source_id}>{batch.length > 1 && <h3>{batch[0].date} · 同次采样 · {batch.length} 份分项报告</h3>}{batch.map(report => <ReportCard key={report.source_id} report={report} selected={reportId === report.source_id} onSelect={() => setReportId(report.source_id)}/>)}</div>)}</div>{reports.some(r => !r.date) && <><h3>日期待确认的附件</h3><div className="ha-timeline">{reports.filter(r => !r.date).map(report => <ReportCard key={report.source_id} report={report} selected={reportId === report.source_id} onSelect={() => setReportId(report.source_id)}/>)}</div></>}</section>}
    {view === "review" && <section className="ha-section"><h2>来源核对与提取说明</h2><p>历史栏交叉核验：{historical.filter(h => h.status === "matched").length} 项与原件一致，仅补充出处；{historical.filter(h => h.status === "needs_review").length} 项待复核；{historical.filter(h => h.status === "reference_only").length} 项仅有历史引用，保留原格，暂不纳入主曲线。</p><p>{issuesCount} 条归档说明，包含覆盖范围、日期或内容疑点。它们与医学异常标记分开管理。</p>{reports.map(report => <details key={report.source_id} className="ha-review"><summary>{dateLabel(report.date)} · {report.filename} <small>{report.issues?.length || 0} 条说明</small></summary>{report.issues?.map((issue, i) => <p key={i}>{issue.text}</p>)}{report.historical_references?.length ? <details><summary>查看历史引用核验明细（{report.historical_references.length}）</summary><div className="ha-table-wrap"><table><thead><tr><th>历史日期</th><th>指标</th><th>原始历史格</th><th>核验</th><th>出处</th></tr></thead><tbody>{report.historical_references.map((h,i) => <tr key={i}><td>{h.date}</td><td>{h.name}</td><td style={{whiteSpace:"pre-line"}}>{h.original_cell}</td><td>{h.status === "matched" ? "原件一致，已去重" : h.status === "reference_only" ? "仅历史引用" : "待复核"}</td><td><a href={`${report.pdf_url}#page=${h.source_page}`} target="_blank" rel="noreferrer">第 {h.source_page} 页 ↗</a></td></tr>)}</tbody></table></div></details> : null}{report.source_available && <a href={report.pdf_url} target="_blank" rel="noreferrer">打开报告原件 ↗</a>}</details>)}</section>}
    {(view === "trends" || reportId) && !!rows.length && <section className="ha-section"><div className="ha-section-head"><div><h2>{selectedReport ? `${dateLabel(selectedReport.date)} · 当次检查明细` : "历次测量与原始记录"}</h2><p>{selectedReport?.filename || "标准值用于比较，原始值与当次参考范围用于追溯。"}</p></div>{reportId && <button onClick={() => setReportId("")}>返回指标记录</button>}</div>{selectedReport && <div className="ha-report-meta">{selectedReport.provider} · {selectedReport.pages} 页 · {listed.length} 条记录 {selectedReport.source_available && <a target="_blank" rel="noreferrer" href={selectedReport.pdf_url}>查看完整原件 ↗</a>}</div>}<div className="ha-table-wrap"><table><thead><tr><th>检查日期</th>{reportId && <th>指标</th>}<th>原始结果</th><th>标准值 / 单位</th><th>当次参考范围</th><th>报告标记</th><th>来源</th></tr></thead><tbody>{listed.map(r => <tr key={r.id}><td>{r.date || "待确认"}{r.sampled_at && <small className="ha-muted">采样 {r.sampled_at.slice(11).replace("+08:00", "")}</small>}</td>{reportId && <td><button className="ha-metric-link" title="查看医学说明" onClick={() => setInfoKey(r.metric_key)}>{r.name} ⓘ</button></td>}<td>{r.original_value} <small>{r.original_unit}</small></td><td>{r.normalized_value !== null ? `${r.comparator || ""}${r.normalized_value}` : "—"} <small>{r.normalized_unit && unitLabel(r.normalized_unit)}</small>{!r.trend_eligible && <small className="ha-muted" title={r.normalization_note}>单独保留{r.needs_review ? " · 待核对" : ""}</small>}</td><td>{r.reference_range_raw || "未提供"}</td><td>{r.report_flag ? <span className="ha-flag">{r.report_flag}</span> : "—"}</td><td>{reportLink(r)}{r.supporting_sources?.map((p,i) => <small className="ha-muted" key={i}><a target="_blank" rel="noreferrer" href={`${reports.find(d=>d.source_id===p.source_id)?.pdf_url}#page=${p.source_page}`}>历史复核出处 ↗</a></small>)}</td></tr>)}</tbody></table>{!listed.length && <p className="ha-empty">此范围没有可用记录。</p>}</div></section>}
    <dialog ref={infoDialog} className="ha-info-dialog" onClose={() => setInfoKey(null)}>
      <div className="ha-info-dialog-head"><span>指标医学说明</span><button autoFocus onClick={() => setInfoKey(null)} aria-label="关闭医学说明">关闭 ×</button></div>
      {infoKey && <><h2>{rows.find(r => r.metric_key === infoKey)?.name || infoKey}</h2><code>{infoKey}</code><div className="ha-info-tags">{METRIC_INFO[infoKey]?.categories.map(c => <span key={c}>{c}</span>)}</div>
      {METRIC_INFO[infoKey] ? <><section><h3>它测的是什么？</h3><p>{METRIC_INFO[infoKey].what}</p></section><section><h3>常用于了解什么？</h3><p>{METRIC_INFO[infoKey].meaning}</p></section><section className="ha-info-limits"><h3>解读时需要注意</h3><p>{METRIC_INFO[infoKey].limits}</p></section><section><h3>参考资料</h3>{METRIC_INFO[infoKey].sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a>)}<small>资料核对：{METRIC_INFO[infoKey].checkedOn} · 通用医学科普，未对你的结果作个体诊断。具体参考范围见各次原报告。</small></section></> : <p>该新指标的医学说明尚待整理，保留原始结果，不自动生成解释。</p>}
      <Btn onClick={() => { setMetric(infoKey); setGroup("全部"); setQuery(""); setReportId(""); setView("trends"); setInfoKey(null); }}>查看我的历史曲线</Btn></>}
    </dialog>
    <footer className="ha-footer">本地工作档案 · 云端备份由你单独管理 · 健康档案及备份目前为本机明文文件，独立于原加密工作台。<br/>当前已整理报告和化验；Apple 健康数据尚未导入。历史数据不表示当前状况。</footer>
  </div>;
}

function ReportCard({ report, selected, onSelect }: { report: Report; selected: boolean; onSelect: () => void }) {
  return <button className={`ha-report ${selected ? "selected" : ""}`} onClick={onSelect}><span className="ha-report-dot"/><time>{dateLabel(report.date)}</time><strong>{report.panel_name || report.provider || "附件待核对"}</strong>{report.sampled_at && <small>采样：{report.sampled_at.replace("T", " ").replace("+08:00", "（UTC+8）")}</small>}<span className="ha-file-name">{report.filename}</span><div><span>{report.count} 条记录</span><span>{report.pages} 页原件</span></div><small>查看当次记录 →</small></button>;
}
function TrendChart({ rows, onSelect }: { rows: Row[]; onSelect: (r: Row) => void }) {
  if (!rows.length) return <div className="ha-empty">没有可绘制的数值。定性结果、带比较符的值和待核对单位在明细中保留。</div>;
  const times = rows.map(r => Date.parse(r.date! + "T12:00:00Z"));
  const minX = Math.min(...times), maxX = Math.max(...times);
  const values = rows.map(r => r.normalized_value!); const low = Math.min(...values), high = Math.max(...values), margin = Math.max((high - low) * .3, Math.abs(high) * .06, .1);
  const minY = low - margin, maxY = high + margin;
  const X = (t: number) => 70 + (maxX > minX ? (t - minX) / (maxX - minX) : .5) * 770;
  const Y = (v: number) => 30 + (1 - (v - minY) / (maxY - minY)) * 195;
  return <svg className="ha-chart" viewBox="0 0 920 285" role="group" aria-label="按实际检查日期排列的指标趋势">
    {[0, 1, 2, 3].map(i => { const value = minY + (maxY - minY) * i / 3; return <g key={i}><line x1="65" x2="860" y1={Y(value)} y2={Y(value)} stroke="var(--separator)" strokeDasharray="3 5"/><text x="53" y={Y(value) + 4} textAnchor="end" fill="var(--text-tertiary)" fontSize="11">{Number(value.toFixed(2))}</text></g>; })}
    <path d={rows.map((r, i) => `${i ? "L" : "M"}${X(times[i])},${Y(r.normalized_value!)}`).join(" ")} fill="none" stroke="#269c87" strokeWidth="2" strokeDasharray="5 5" opacity=".6"/>
    {rows.map((r, i) => <g key={r.id} className="ha-point" tabIndex={0} role="button" aria-label={`${r.date}，${r.normalized_value}，查看报告`} onClick={() => onSelect(r)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(r); } }}><title>{r.date} · {r.original_value} · 第{r.source_page}页</title><circle cx={X(times[i])} cy={Y(r.normalized_value!)} r="14" fill="transparent"/><circle cx={X(times[i])} cy={Y(r.normalized_value!)} r="5" fill="#218f7d" stroke="var(--bg-elevated)" strokeWidth="2"/><text x={X(times[i])} y={Y(r.normalized_value!) - 14} textAnchor="middle" fill="var(--text-primary)" fontSize="12" fontWeight="600">{r.normalized_value}</text><text x={X(times[i])} y={250 + (i % 2) * 16} textAnchor="middle" fill="var(--text-tertiary)" fontSize="10">{r.date}</text></g>)}
  </svg>;
}
