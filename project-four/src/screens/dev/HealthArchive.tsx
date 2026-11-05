import { useEffect, useMemo, useRef, useState } from "react";
import { Btn } from "../../ui";
import { HEALTH_METRIC_ALIASES, HEALTH_METRIC_NAMES } from "../../data/healthMetricAliases";
import "./HealthArchive.css";
import { HEALTH_CATEGORIES, METRIC_INFO } from "../../data/healthMetrics";
import { PHYSICAL_METRIC_INFO } from "../../data/healthPhysicalMetrics";
const HEALTH_INFO = { ...METRIC_INFO, ...PHYSICAL_METRIC_INFO };

type HistoricalReference = { date: string; name: string; original_cell: string; source_page: number; status: string; metric_key?: string; numeric_value?: number; unit?: string };
type Report = { source_id: string; date: string | null; filename: string; provider?: string; pages: number; count: number; pdf_url: string; source_available: boolean; issues: { text: string }[]; sampled_at?: string; encounter_id?: string; panel_name?: string; historical_references?: HistoricalReference[]; findings?: { text: string; source_page?: number }[] };
type Row = { sampled_at?: string; normalization_note?: string; supporting_sources?: {source_id: string; source_page: number}[]; historical_source?: boolean; id: string; source_id: string; source_page: number; date: string | null; metric_key: string; name: string; original_value: string; original_unit?: string; normalized_value: number | null; normalized_unit: string | null; reference_range_raw?: string; report_flag?: string; trend_eligible?: boolean; comparator?: string | null; needs_review?: boolean };
type ClinicalSummary = { note: string; longitudinal: { title: string; text: string }[]; by_exam: { date: string; summary: string; follow_up: string }[] };
type Archive = { reports: Report[]; observations: Row[]; clinical_summary?: ClinicalSummary; updated_at?: string };
const GROUPS = ["全部", ...HEALTH_CATEGORIES, "耳鼻喉与口腔", "呼吸系统", "待分类"];
const canonicalMetric = (key: string) => {
  let current = key;
  for (let i = 0; i < 4 && HEALTH_METRIC_ALIASES[current] && HEALTH_METRIC_ALIASES[current] !== current; i++) current = HEALTH_METRIC_ALIASES[current];
  return current;
};
function categoriesFor(key: string, name: string): string[] {
  if (HEALTH_INFO[key]) return HEALTH_INFO[key].categories;
  const n = name.replace(/\s+/g, "").replaceAll("⻔", "门").toLowerCase();
  if (/尿|比重|酸碱度|ph值|上皮细胞|管型|结晶|浊度|潜血|隐血|^颜色|^胆红素$|^亚硝酸盐$|^维生素c$|镜检|leukocyte|nitrite|urobilinogen|specificgravity|pathocast|hyalinecast|crystals|epithelial|wbcsmicroscopy|rbcsmicroscopy/.test(n)) return ["肾脏与尿检"];
  if (/甲状腺素|三碘甲状原氨酸|三碘甲状腺原氨酸|促甲状腺激素|甲状腺过氧化物酶|\b(?:ft3|ft4|tsh|tpo)\b/.test(n)) return ["甲状腺"];
  if (/糖类抗原|前列腺特异|神经元特异|细胞角蛋白|肿瘤特异|人绒毛膜促性腺激素|\b(?:psa|nse|scc|cyfra|cea|hcg)\b/.test(n)) return ["肿瘤标志物"];
  if (/乙型肝炎|甲型肝炎|丙型肝炎|eb病毒|巨细胞病毒|嗜t细胞病毒|感染|抗eb病毒|乙肝|丙肝|甲肝|血沉|\b(?:ebv|cmv|htlv|hbsag|hbsab)\b/.test(n)) return ["感染与免疫"];
  if (/凝血|国际标准化比值|\b(?:pt-inr|aptt|prothrombintime)\b/.test(n)) return ["凝血功能"];
  if (/红细胞分布|血小板体积|大血小板|\b(?:rdw|pdw|p-lcr|mch|mchc|mcv)\b/.test(n)) return ["血常规"];
  if (/肾小球滤过率|尿素氮|\b(?:egfr|bun)\b/.test(n)) return ["肾脏与尿检"];
  if (/不饱和铁结合力|总铁结合力|铁饱和度/.test(n)) return ["铁代谢与营养"];
  if (/修正钙/.test(n)) return ["电解质与酸碱"];
  if (/ast\/alt|肝损伤r值/.test(n)) return ["肝脏与胆道"];
  if (/动脉粥样硬化|动脉硬化|心脏杂音|心音|^心率$|外周血管/.test(n)) return ["心血管与血脂"];
  if (/视力|外眼|眼底|眼压|裂隙灯/.test(n)) return ["眼科"];
  if (/^耳$|^鼻$|口咽|牙周|口腔|颌面|牙体|听力/.test(n)) return ["耳鼻喉与口腔"];
  if (/营养|面容|肺部|^肝脏$|脾脏|腹部|皮肤|淋巴结|^甲状腺$|乳房|脊柱|四肢关节|既往史|主诉|体态|胸廓|下肢浮肿|神经反射/.test(n)) return ["体格检查"];
  if (/c13呼气|幽门螺杆菌|肛门指诊/.test(n)) return ["消化道检测"];
  return ["待分类"];
}
const preferred = ["body.weight", "body.bmi", "body.waist", "bp.systolic", "bp.diastolic", "vital.pulse", "lipid.ldl", "lipid.tc", "lipid.hdl", "lipid.tg", "glucose.fasting", "glucose.hba1c.percent", "liver.alt", "liver.ast", "liver.ggt", "liver.total_bilirubin", "renal.creatinine", "renal.egfr.ckd_epi", "renal.uric_acid", "cbc.wbc", "cbc.rbc", "cbc.hgb", "cbc.plt", "thyroid.tsh", "thyroid.ft4", "thyroid.ft3", "tumor.cea", "tumor.afp", "tumor.ca199"];
const errorText = (e: unknown) => e instanceof Error ? e.message : "操作失败，请重试";
const dateLabel = (d: string | null) => d || "日期待确认";
const unitLabel = (u: string | null) => u === "1" ? "无量纲" : u || "单位待核对";
type Bounds = { low?: number; high?: number; strictLow?: boolean; strictHigh?: boolean };
function rangeBounds(raw?: string): Bounds | null {
  if (!raw) return null;
  const text = raw.trim().replace(/[－—–]/g, "-");
  let match = text.match(/^(<=|<|≤)\s*(\d+(?:\.\d+)?)/);
  if (match) return { high: Number(match[2]), strictHigh: match[1] === "<" };
  match = text.match(/^(>=|>|≥)\s*(\d+(?:\.\d+)?)/);
  if (match) return { low: Number(match[2]), strictLow: match[1] === ">" };
  match = text.match(/^(\d+(?:\.\d+)?)\s*(?:--|~|-|至)\s*(\d+(?:\.\d+)?)/);
  if (match) return { low: Number(match[1]), high: Number(match[2]) };
  return null;
}
function isAbnormal(row: Row): boolean {
  const bounds = rangeBounds(row.reference_range_raw);
  const value = row.normalized_value;
  if (bounds && typeof value === "number") return (bounds.low !== undefined && (value < bounds.low || (bounds.strictLow === true && value === bounds.low))) || (bounds.high !== undefined && (value > bounds.high || (bounds.strictHigh === true && value === bounds.high)));
  return row.report_flag === "↑" || row.report_flag === "↓";
}
function combinedRows(reports: Report[], direct: Row[]): Row[] {
  const rows = direct.map(r => ({...r, metric_key: canonicalMetric(r.metric_key)}));
  const existing = new Set(rows.map(r => `${r.date}|${r.metric_key}`));
  for (const report of reports) for (const h of report.historical_references || []) {
    const metricKey = canonicalMetric(h.metric_key || "");
    const key = `${h.date}|${metricKey}`;
    if (!h.metric_key || existing.has(key)) continue;
    existing.add(key);
    rows.push({ id: `history:${report.source_id}:${h.source_page}:${key}`, source_id: report.source_id, source_page: h.source_page,
      date: h.date, metric_key: metricKey, name: h.name, original_value: h.original_cell,
      original_unit: h.unit, normalized_value: typeof h.numeric_value === "number" ? h.numeric_value : null,
      normalized_unit: h.unit || null, trend_eligible: !!h.unit && typeof h.numeric_value === "number",
      historical_source: true, report_flag: h.original_cell.includes("↑") ? "↑" : h.original_cell.includes("↓") ? "↓" : undefined,
      normalization_note: `历史日期 ${h.date}，见 ${report.date} 报告第 ${h.source_page} 页` });
  }
  return rows;
}
function download(blob: Blob, name: string) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }

export default function HealthArchive() {
  const [archive, setArchive] = useState<Archive | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<File | null>(null);
  const [view, setView] = useState<"trends" | "abnormal" | "library">("trends");
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
  const input = useRef<HTMLInputElement>(null);
  async function load() {
    setLoading(true); setError("");
    try { const r = await fetch("/api/health/archive", { cache: "no-store" }); if (!r.ok) throw new Error("健康档案读取失败，请确认家庭云空间已解锁"); const d = await r.json(); if (!d.ok) throw new Error(d.error); setArchive(d); }
    catch (e) { setError(errorText(e)); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  const reports = useMemo(() => [...(archive?.reports ?? [])].sort((a, b) => a.date === null ? (b.date === null ? 0 : 1) : b.date === null ? -1 : a.date.localeCompare(b.date)), [archive]);
  const rows = useMemo(() => combinedRows(reports, archive?.observations ?? []), [reports, archive]);
  const allExamDates = [...rows.map(r => r.date).filter((d): d is string => !!d)].sort();
  const latestExamDate = allExamDates[allExamDates.length - 1];
  const recentCutoff = latestExamDate ? `${Number(latestExamDate.slice(0, 4)) - 2}${latestExamDate.slice(4)}` : "";
  const abnormalRows = rows.filter(r => isAbnormal(r) && !!r.date && r.date >= recentCutoff);
  const dated = reports.filter(r => r.date);
    const metrics = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) if ((group === "全部" || categoriesFor(r.metric_key, HEALTH_METRIC_NAMES[r.metric_key] || r.name).includes(group)) && (!query || ((HEALTH_METRIC_NAMES[r.metric_key] || "") + r.name + r.metric_key).toLowerCase().includes(query.toLowerCase()))) map.set(r.metric_key, HEALTH_METRIC_NAMES[r.metric_key] || r.name);
    const coverage = (key: string) => new Set(rows.filter(r => r.metric_key === key && typeof r.normalized_value === "number").map(r => r.date).filter(Boolean)).size;
    const history = (key: string) => new Set(rows.filter(r => r.metric_key === key).map(r => r.date).filter(Boolean)).size;
    return [...map].sort((a, b) => { const ai = preferred.indexOf(a[0]), bi = preferred.indexOf(b[0]); return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi) || coverage(b[0]) - coverage(a[0]) || history(b[0]) - history(a[0]) || a[1].localeCompare(b[1], "zh"); });
  }, [rows, group, query]);
  const activeMetric = metrics.some(m => m[0] === metric) ? metric : metrics[0]?.[0] ?? "";
  const stepMetric = (step: number) => {
    if (!metrics.length) return;
    const current = metrics.findIndex(m => m[0] === activeMetric);
    setMetric(metrics[(current + step + metrics.length) % metrics.length][0]);
    setReportId("");
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (view !== "trends" || !["ArrowLeft", "ArrowRight"].includes(event.key) ||
          event.altKey || event.ctrlKey || event.metaKey ||
          ["INPUT", "TEXTAREA", "SELECT"].includes((event.target as HTMLElement)?.tagName)) return;
      event.preventDefault();
      const current = metrics.findIndex(m => m[0] === activeMetric);
      if (metrics.length) { setMetric(metrics[(current + (event.key === "ArrowRight" ? 1 : -1) + metrics.length) % metrics.length][0]); setReportId(""); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeMetric, metrics, view]);
  const metricRows = rows.filter(r => r.metric_key === activeMetric && r.date && (!from || r.date >= from) && (!to || r.date <= to)).sort((a, b) => a.date!.localeCompare(b.date!));
  const units = [...new Set(metricRows.filter(r => typeof r.normalized_value === "number").map(r => r.normalized_unit || "单位未标"))];
  const preferredUnit = [...units].sort((a, b) => metricRows.filter(r => (r.normalized_unit || "单位未标") === b && typeof r.normalized_value === "number").length - metricRows.filter(r => (r.normalized_unit || "单位未标") === a && typeof r.normalized_value === "number").length)[0] ?? "";
  const activeUnit = units.includes(unit) ? unit : preferredUnit;
  const points = metricRows.filter(r => (r.normalized_unit || "单位未标") === activeUnit && typeof r.normalized_value === "number" && Number.isFinite(r.normalized_value));
  const qualitative = metricRows.filter(r => typeof r.normalized_value !== "number" || !Number.isFinite(r.normalized_value));
  const selectedReport = reports.find(r => r.source_id === reportId);
  const listed = reportId ? rows.filter(r => r.source_id === reportId) : metricRows;
  const latest = points[points.length - 1], previous = points[points.length - 2];
  async function importFile() {
    if (!pending || busy) return;
    setBusy(true); setNotice(""); setError("");
    try { const res = await fetch("/api/health/import", { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: pending }); if (!res.ok) throw new Error("导入请求失败"); const result = await res.json(); if (!result.ok) throw new Error(result.error); setPending(null); setNotice(`导入完成：新增 ${result.added} 条，跳过 ${result.duplicates} 条重复记录。`); await load(); }
    catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  async function backup() {
    setBusy(true); setError("");
    try { const r = await fetch("/api/health/export"); if (!r.ok || !r.headers.get("content-type")?.includes("zip")) throw new Error("备份未完成，请核对原件是否可读取"); download(await r.blob(), "health-archive.zip"); setNotice("ZIP 已导出，含健康明细及可用原件，此文件未加密，请妥善保存；加密整屋备份可使用页面顶部按钮。"); } catch(e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  function exportCsv() {
    const fields: (keyof Row)[] = ["date", "name", "metric_key", "original_value", "original_unit", "normalized_value", "normalized_unit", "reference_range_raw", "report_flag"];
    const quote = (v: unknown) => { let s = String(v ?? ""); if (/^[=+@]/.test(s)) s = "'" + s; return '"' + s.replaceAll('"', '""') + '"'; };
    download(new Blob(["\ufeff" + [fields.join(","), ...rows.map(r => fields.map(f => quote(r[f])).join(","))].join("\r\n")], { type: "text/csv;charset=utf-8" }), "health-observations.csv"); setNotice("已导出全部指标明细。");
  }
  return <div className="ha">
    <section className="ha-hero"><div><div className="ha-eyebrow">YOUR HEALTH, OVER TIME</div><h1>把每一次检查，连成健康的时间线。</h1><p>体检、医院化验与日常测量，在同一份档案里追溯。数值和医生结论均按年份整理。</p><div className="ha-hero-tag">本地档案 · 仅本机保存 · {dated.length ? `${dated[0].date} — ${dated[dated.length - 1]?.date}` : "等待首次导入"}</div></div><div className="ha-hero-mark" aria-hidden="true"><svg viewBox="0 0 160 100"><path d="M5 55H35L49 20L70 85L89 38L102 55H155" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/></svg></div></section>
    <div className="ha-toolbar"><nav>{([ ["trends", "健康结果"], ["abnormal", `异常追踪 ${abnormalRows.length}`], ["library", "指标百科"] ] as const).map(([v, label]) => <button key={v} className={view === v ? "active" : ""} onClick={() => { setView(v); setReportId(""); }}>{label}</button>)}</nav><div className="ha-actions"><Btn variant="ghost" disabled={busy} onClick={() => input.current?.click()}>追加档案</Btn><Btn variant="ghost" disabled={busy || !rows.length} onClick={exportCsv}>导出明细</Btn><Btn disabled={busy || !archive} onClick={() => void backup()}>{busy ? "处理中…" : "导出健康 ZIP（未加密）"}</Btn></div></div>
    <input ref={input} type="file" accept=".json,.zip" hidden onChange={e => { const f = e.target.files?.[0]; if (f) { if (f.size > 100 * 1024 * 1024) setError("文件超过 100 MB，请分批导入"); else setPending(f); } e.currentTarget.value = ""; }}/>
    {pending && <div className="ha-message"><b>追加：{pending.name}</b><p>接受已标准化的健康档案 JSON 或本应用备份 ZIP。重复记录跳过，修订冲突会拒绝覆盖。原始 PDF 需先识别整理，不能直接当作标准化档案导入。</p><Btn disabled={busy} onClick={() => void importFile()}>确认追加</Btn> <Btn variant="ghost" disabled={busy} onClick={() => setPending(null)}>取消</Btn></div>}
    {error && <div className="ha-message ha-error" role="alert">{error} <button onClick={() => void load()}>重新加载</button></div>}
    {notice && <div className="ha-message" role="status">{notice}</div>}
    <div className="ha-stats"><div><span>检查日期</span><b>{new Set(rows.map(r => r.date).filter(Boolean)).size}<small>个</small></b></div><div><span>健康结果</span><b>{rows.length}<small>条</small></b><small>历年报告对照值已合并，重复项只计一次</small></div><div><span>原始文件</span><b>{reports.length}<small>份</small></b></div><div><span>可查看指标</span><b>{new Set(rows.map(r => r.metric_key)).size}<small>项</small></b></div><div><span>医学分类</span><b>{GROUPS.length - 2}<small>类</small></b></div></div>
    {loading && <div className="ha-empty" role="status">正在读取健康档案…</div>}
    {!loading && !rows.length && !error && <div className="ha-empty"><h2>从第一份健康档案开始</h2><p>导入已整理的 JSON，或恢复完整健康备份。原始报告需要先提取并核对日期、单位和来源。</p></div>}
    {(view === "trends" || view === "library") && !!rows.length && <div className="ha-groups" aria-label="医学分类">{GROUPS.map(label => <button key={label} className={label === group ? "active" : ""} onClick={() => { setGroup(label); setReportId(""); }}>{label}<small>{new Set(rows.filter(r => label === "全部" || categoriesFor(r.metric_key, r.name).includes(label)).map(r => r.metric_key)).size}</small></button>)}</div>}
    {view === "abnormal" && <section className="ha-section"><div className="ha-section-head"><div><h2>最近两年的异常指标</h2><p>以最新检查日期 {latestExamDate || "—"} 为基准，显示 {recentCutoff || "—"} 以来超出当次参考范围的记录；更早的记录仍可在指标时间线查看。</p></div></div><div className="ha-alert-list">{[...new Set(abnormalRows.map(r => r.metric_key))].map(key => { const values = abnormalRows.filter(r => r.metric_key === key).sort((a,b) => (b.date || "").localeCompare(a.date || "")); return <button key={key} onClick={() => { setGroup("全部"); setQuery(""); setMetric(key); setReportId(""); setView("trends"); }}><strong>{values[0].name}</strong><small>{values.length} 次超出原报告范围 · 最近 {values[0].date}：{values[0].original_value} {values[0].original_unit} · 原参考 {values[0].reference_range_raw || "报告箭头标记"} → 查看曲线</small></button>; })}</div>{!abnormalRows.length && <p className="ha-empty">当前没有可明确判定的超范围记录。</p>}</section>}
    {view === "library" && <section className="ha-section"><div className="ha-section-head"><div><h2>看懂每一个健康指标</h2><p>按医学领域查找，点击查看含义、用途、解读限制与资料来源。同一指标可属于多个领域。</p></div></div><input className="ha-library-search" placeholder="搜索指标名称或代码" value={query} onChange={e => setQuery(e.target.value)}/><div className="ha-library">{metrics.map(([key, name]) => <button key={key} className="ha-info-card" onClick={() => setInfoKey(key)}><span>{categoriesFor(key, name).join(" · ")}</span><strong>{name}</strong><small>{key}</small><p>{HEALTH_INFO[key]?.what || "医学说明尚待整理，不自动猜测。"}</p><b>查看医学说明 ↗</b></button>)}</div>{!metrics.length && <p className="ha-empty">没有匹配指标，请更换分类或搜索词。</p>}</section>}
    {view === "trends" && !!rows.length && <>
      <div className="ha-filters"><label>查找指标<input placeholder="名称或指标代码" value={query} onChange={e => setQuery(e.target.value)}/></label><button className="ha-step" onClick={() => stepMetric(-1)} disabled={!metrics.length} title="上一个指标，也可按键盘左键">←</button><label className="ha-select">查看指标<select value={activeMetric} onChange={e => { setMetric(e.target.value); setReportId(""); }}>{metrics.map(([key, name]) => <option value={key} key={key}>{new Set(rows.filter(r => r.metric_key === key && r.date && typeof r.normalized_value === "number").map(r => r.date)).size >= 2 ? "↗ " : ""}{name}</option>)}</select></label><button className="ha-step" onClick={() => stepMetric(1)} disabled={!metrics.length} title="下一个指标，也可按键盘右键">→</button><label>从<input type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)}/></label><label>到<input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)}/></label><button className="ha-reset" onClick={() => { setFrom(""); setTo(""); setQuery(""); }}>重置</button></div>
      <section className="ha-chart-card"><div className="ha-chart-head"><div><div className="ha-eyebrow">LONGITUDINAL VIEW</div><h2>{metrics.find(m => m[0] === activeMetric)?.[1] || "没有匹配的指标"}</h2><p className="ha-metric-brief">{HEALTH_INFO[activeMetric]?.what}</p><p>实际检查日期 · {points.length} 个数值点{activeUnit ? ` · ${unitLabel(activeUnit)}` : ""}{qualitative.length ? ` · ${qualitative.length} 条文字结果` : ""}</p></div>{latest && <div className="ha-current"><strong>{latest.normalized_value}</strong><span>{unitLabel(activeUnit)}</span><small>{latest.date}{previous ? ` · 较上次 ${(latest.normalized_value! - previous.normalized_value!).toFixed(2)}` : ""}</small></div>}</div>
      {units.length > 1 && <label>按标准单位分别查看 <select value={activeUnit} onChange={e => setUnit(e.target.value)}>{units.map(u => <option key={u}>{u}</option>)}</select></label>}
      {points.length ? <><TrendChart rows={points} references={[]} onSelect={r => setReportId(r.source_id)} onSelectReference={() => {}}/><div className="ha-chart-note">红色虚线采用最近一次提供参考范围的报告；有参考区间时显示两条。各次参考范围见下方明细，不同单位分别查看。</div></> : !qualitative.length && <p className="ha-empty">这一项暂无检查结果。</p>}
      {qualitative.length > 0 && <div className="ha-qualitative"><h3>逐年文字结果</h3><div className="ha-qual-grid">{qualitative.map(r => <div className="ha-qual-card" key={r.id}><time>{r.date}</time><strong>{r.original_value}</strong><small>{r.name}{r.report_flag ? ` · ${r.report_flag}` : ""}</small></div>)}</div></div>}
      {activeMetric === "hpylori.overview" && <p className="ha-method-note">呼气检测值、血清抗体和胃窦活检属于不同方法。数值按单位分别查看，文字结论按日期并列，不能把各方法的数值直接相连。</p>}
      {activeMetric && <button className="ha-info-trigger" onClick={() => setInfoKey(activeMetric)}>查看详细医学说明 ↗</button>}</section>
    </>}
    {!!reports.length && <section className="ha-section"><h2>报告与原件</h2><p>按检查日期查看来源。原件只在已解锁设备中解密打开；缺失原件可重新追加完整健康 ZIP。</p><div className="ha-source-list">{reports.map(r => <article key={r.source_id}><button className="ha-metric-link" onClick={() => {setReportId(r.source_id);setView("trends");}}>{dateLabel(r.date)} · {r.filename}</button><small>{r.provider || ""} · {r.pages} 页 · {r.count} 条结果</small>{r.source_available ? <a href={r.pdf_url} target="_blank" rel="noopener noreferrer">查看解密原件 ↗</a> : <span>原件未迁入</span>}</article>)}</div></section>}
    {view === "trends" && archive?.clinical_summary && <section className="ha-section"><div className="ha-section-head"><div><h2>历年医生结论</h2><p>{archive.clinical_summary.note}</p></div></div><div className="ha-doctor-grid">{archive.clinical_summary.longitudinal.map(item => <article key={item.title}><h3>{item.title}</h3><p>{item.text}</p></article>)}</div><div className="ha-doctor-timeline">{[...archive.clinical_summary.by_exam].reverse().map(item => <details key={item.date}><summary>{item.date} · 医生结论</summary><p>{item.summary}</p><p className="ha-muted">报告建议：{item.follow_up}</p></details>)}</div></section>}
    {(view === "trends" || reportId) && !!rows.length && <section className="ha-section"><div className="ha-section-head"><div><h2>{selectedReport ? `${dateLabel(selectedReport.date)} · 检查明细` : "历次测量与文字记录"}</h2><p>原始值和当次参考范围用于核对。点选指标可切换时间线。</p></div>{reportId && <button onClick={() => setReportId("")}>返回指标记录</button>}</div><div className="ha-table-wrap"><table><thead><tr><th>检查日期</th><th>指标 / 方法</th><th>原始结果</th><th>标准值 / 单位</th><th>当次参考范围</th><th>报告标记</th></tr></thead><tbody>{listed.map(r => <tr key={r.id} className={isAbnormal(r) ? "ha-alert-row" : ""}><td>{r.date || "待确认"}{r.sampled_at && <small className="ha-muted">采样 {r.sampled_at.slice(11).replace("+08:00", "")}</small>}</td><td><button className="ha-metric-link" onClick={() => { setMetric(r.metric_key); setGroup("全部"); setQuery(""); setReportId(""); }}>{r.name}</button></td><td>{r.original_value} <small>{r.original_unit}</small></td><td>{r.normalized_value !== null ? `${r.comparator || ""}${r.normalized_value}` : "—"} <small>{r.normalized_unit && unitLabel(r.normalized_unit)}</small></td><td>{r.reference_range_raw || "未提供"}</td><td>{isAbnormal(r) ? <span className="ha-alert-tag">超出范围 {r.report_flag || ""}</span> : r.report_flag ? <span className="ha-flag">原报告 {r.report_flag}</span> : "—"}</td></tr>)}</tbody></table>{!listed.length && <p className="ha-empty">此范围没有可用记录。</p>}</div></section>}
    <dialog ref={infoDialog} className="ha-info-dialog" onClose={() => setInfoKey(null)}>
      <div className="ha-info-dialog-head"><span>指标医学说明</span><button autoFocus onClick={() => setInfoKey(null)} aria-label="关闭医学说明">关闭 ×</button></div>
      {infoKey && <><h2>{rows.find(r => r.metric_key === infoKey)?.name || infoKey}</h2><code>{infoKey}</code><div className="ha-info-tags">{categoriesFor(infoKey, rows.find(r => r.metric_key === infoKey)?.name || infoKey).map(c => <span key={c}>{c}</span>)}</div>
      {HEALTH_INFO[infoKey] ? <><section><h3>它测的是什么？</h3><p>{HEALTH_INFO[infoKey].what}</p></section><section><h3>常用于了解什么？</h3><p>{HEALTH_INFO[infoKey].meaning}</p></section><section className="ha-info-limits"><h3>解读时需要注意</h3><p>{HEALTH_INFO[infoKey].limits}</p></section><section><h3>参考资料</h3>{HEALTH_INFO[infoKey].sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a>)}<small>资料核对：{HEALTH_INFO[infoKey].checkedOn} · 通用医学科普，未对你的结果作个体诊断。具体参考范围见各次原报告。</small></section></> : <p>该新指标的医学说明尚待整理，保留原始结果，不自动生成解释。</p>}
      <Btn onClick={() => { setMetric(infoKey); setGroup("全部"); setQuery(""); setReportId(""); setView("trends"); setInfoKey(null); }}>查看我的历史曲线</Btn></>}
    </dialog>
    <footer className="ha-footer">健康档案与手记分开保存；请根据各端的同步状态核对备份版本。<br/>支持标准化健康 JSON 和健康 ZIP；Apple 健康 XML 自动解析暂未接入。历史数据不表示当前状况。</footer>
  </div>;
}

function TrendChart({ rows, references, onSelect, onSelectReference }: { rows: Row[]; references: (HistoricalReference & {source_id: string})[]; onSelect: (r: Row) => void; onSelectReference: (h: HistoricalReference & {source_id: string}) => void }) {
  if (!rows.length && !references.length) return <div className="ha-empty">没有可绘制的数值。定性结果、带比较符的值和待核对单位在明细中保留。</div>;
  const times = rows.map(r => Date.parse(r.date! + "T12:00:00Z"));
  const referenceTimes = references.map(h => Date.parse(h.date + "T12:00:00Z"));
  const minX = Math.min(...times, ...referenceTimes), maxX = Math.max(...times, ...referenceTimes);
  const latestBounds = [...rows].reverse().map(r => rangeBounds(r.reference_range_raw)).find(Boolean);
  const limits = latestBounds ? [["下限", latestBounds.low], ["上限", latestBounds.high]].filter((item): item is [string, number] => typeof item[1] === "number").map(([label, value]) => ({ label, value })) : [];
  const values = [...rows.map(r => r.normalized_value!), ...references.map(h => h.numeric_value!), ...limits.map(b => b.value)]; const low = Math.min(...values), high = Math.max(...values), margin = Math.max((high - low) * .3, Math.abs(high) * .06, .1);
  const minY = low - margin, maxY = high + margin;
  const X = (t: number) => 70 + (maxX > minX ? (t - minX) / (maxX - minX) : .5) * 770;
  const Y = (v: number) => 30 + (1 - (v - minY) / (maxY - minY)) * 195;
  return <svg className="ha-chart" viewBox="0 0 920 285" role="group" aria-label="按实际检查日期排列的指标趋势">
    {[0, 1, 2, 3].map(i => { const value = minY + (maxY - minY) * i / 3; return <g key={i}><line x1="65" x2="860" y1={Y(value)} y2={Y(value)} stroke="var(--separator)" strokeDasharray="3 5"/><text x="53" y={Y(value) + 4} textAnchor="end" fill="var(--text-tertiary)" fontSize="11">{Number(value.toFixed(2))}</text></g>; })}
    {limits.map(({label, value}) => <g key={`${label}:${value}`}><line x1="65" x2="860" y1={Y(value)} y2={Y(value)} stroke="#c74c47" strokeWidth="3" strokeDasharray="8 5"/><text x="858" y={Y(value)-6} textAnchor="end" fill="#c74c47" fontSize="11" fontWeight="700">{label} {value}</text></g>)}
    <path d={rows.map((r, i) => `${i ? "L" : "M"}${X(times[i])},${Y(r.normalized_value!)}`).join(" ")} fill="none" stroke="#269c87" strokeWidth="2" strokeDasharray="5 5" opacity=".6"/>
    {references.map((h,i) => <g key={`${h.source_id}:${h.source_page}:${h.date}:${i}`} className="ha-point" tabIndex={0} role="button" aria-label={`${h.date}，历史对照 ${h.original_cell}，查看后续报告`} onClick={() => onSelectReference(h)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelectReference(h); } }}><title>{h.date} · 历史对照 {h.original_cell} · 后续报告第 {h.source_page} 页</title><circle cx={X(referenceTimes[i])} cy={Y(h.numeric_value!)} r="14" fill="transparent"/><circle cx={X(referenceTimes[i])} cy={Y(h.numeric_value!)} r="6" fill="var(--bg-elevated)" stroke="#b98538" strokeWidth="2"/><text x={X(referenceTimes[i])} y={Y(h.numeric_value!) - 14} textAnchor="middle" fill="var(--text-primary)" fontSize="12">{h.numeric_value}</text><text x={X(referenceTimes[i])} y={267 - (i % 2) * 16} textAnchor="middle" fill="#a17a45" fontSize="10">{h.date} 对照</text></g>)}
    {rows.map((r, i) => <g key={r.id} className="ha-point" tabIndex={0} role="button" aria-label={`${r.date}，${r.normalized_value}，查看报告`} onClick={() => onSelect(r)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(r); } }}><title>{r.date} · {r.name} · {r.original_value}</title><circle cx={X(times[i])} cy={Y(r.normalized_value!)} r="14" fill="transparent"/><circle cx={X(times[i])} cy={Y(r.normalized_value!)} r="5" fill="#218f7d" stroke="var(--bg-elevated)" strokeWidth="2"/><text x={X(times[i])} y={Y(r.normalized_value!) - 14} textAnchor="middle" fill="var(--text-primary)" fontSize="12" fontWeight="600">{r.normalized_value}</text><text x={X(times[i])} y={250 + (i % 2) * 16} textAnchor="middle" fill="var(--text-tertiary)" fontSize="10">{r.date}</text></g>)}
  </svg>;
}
