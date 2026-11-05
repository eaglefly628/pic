import { useEffect, useMemo, useState } from "react";
import { card } from "../../ui";

type Point = { date: string; time?: string; value?: number; average?: number; count?: number; asleep_minutes?: number };
type Metric = { type: string; unit: string; samples: number; granularity: string; points: Point[] };
type Activity = { ok: boolean; watch_source: string; last_import_at: string; data_cutoff_date: string; heart_rate_hourly: Point[]; steps_daily: Point[]; sleep_nights: Point[]; metric_series: Metric[]; workouts: unknown[]; unassigned_count: number; import_issues: string[] };
const names: Record<string, string> = {
  HeartRateVariabilitySDNN: "心率变异性", OxygenSaturation: "血氧饱和度", VO2Max: "有氧适能", HeartRateRecoveryOneMinute: "运动后心率恢复", RunningGroundContactTime: "跑步触地时间", RunningVerticalOscillation: "跑步垂直振幅", RunningStrideLength: "跑步步幅", RunningPower: "跑步功率", RunningSpeed: "跑步速度", WalkingAsymmetryPercentage: "步行左右不对称", ActiveEnergyBurned: "活动能量", BasalEnergyBurned: "静息能量", AppleExerciseTime: "运动时间", AppleStandTime: "站立时间", AppleStandHour: "站立小时", AppleSleepingWristTemperature: "睡眠腕温", RespiratoryRate: "呼吸频率", RestingHeartRate: "静息心率", WalkingHeartRateAverage: "步行平均心率", EnvironmentalAudioExposure: "环境声音", HeadphoneAudioExposure: "耳机音量", DistanceWalkingRunning: "步行及跑步距离", DistanceCycling: "骑行距离", FlightsClimbed: "爬楼层数", PhysicalEffort: "体力消耗", StairAscentSpeed: "上楼速度", StairDescentSpeed: "下楼速度", TimeInDaylight: "日照时间" };
const label = (type: string) => names[type.replace(/^HK(?:Quantity|Category)TypeIdentifier/, "")] || type.replace(/^HK(?:Quantity|Category)TypeIdentifier/, "");
function Chart({ rows, field }: { rows: Point[]; field: "value" | "average" | "count" | "asleep_minutes" }) {
  const values = rows.map(r => Number(r[field])).filter(Number.isFinite).slice(-90);
  if (!values.length) return <p>暂无数值。</p>;
  const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1;
  const points = values.map((v, i) => `${10 + i * 620 / Math.max(1, values.length - 1)},${130 - (v - lo) * 110 / span}`).join(" ");
  return <div><svg viewBox="0 0 640 145" style={{ width: "100%", maxHeight: 150 }} aria-label="时间趋势"><polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="2.5" /></svg><div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>最近 {values.length} 个数据点 · {Math.round(lo * 10) / 10} 至 {Math.round(hi * 10) / 10}</div></div>;
}
export default function HealthActivity() {
  const isCloud = !['localhost', '127.0.0.1'].includes(location.hostname);
  const [data, setData] = useState<Activity | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [selected, setSelected] = useState("steps");
  const load = () => fetch("/api/health/activity", { cache: "no-store" }).then(r => r.json()).then(setData).catch(e => setError(String(e)));
  useEffect(() => { void load(); }, []);
  const stale = data?.last_import_at ? (Date.now() - Date.parse(data.last_import_at)) / 86400000 > 30 : false;
  const metrics = useMemo(() => data?.metric_series || [], [data]);
  const chosen = metrics.find(m => m.type === selected);
  const rows = selected === "steps" ? data?.steps_daily || [] : selected === "heart" ? data?.heart_rate_hourly || [] : selected === "sleep" ? data?.sleep_nights || [] : chosen?.points || [];
  const field = selected === "steps" ? "count" : selected === "heart" ? "average" : selected === "sleep" ? "asleep_minutes" : "value";
  async function upload(file: File) {
    setBusy(true); setError(""); setResult("");
    try {
      const isZip = file.name.toLowerCase().endsWith(".zip");
      if (isZip === isCloud) throw Error(isCloud ? "网页请导入 Mac 导出的运动数据 JSON" : "Mac 请导入 Apple 健康 ZIP");
      const endpoint = isZip ? "/api/health/activity/import" : "/api/health/activity/sync";
      const response = await fetch(endpoint, { method: "POST", body: file, headers: { "Content-Type": isZip ? "application/zip" : "application/json" } });
      const body = await response.json(); if (!response.ok || !body.ok) throw Error(body.error || "导入未完成");
      setResult(isZip ? `导入完成，截止 ${body.cutoff}；新增记录 ${Object.values(body.added || {}).reduce((a: number, b) => a + Number(b), 0)} 条。` : "整理后的运动数据已同步。顶栏的云端状态会显示保存结果。");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  return <div>
    <div style={{ ...card, padding: 18, marginBottom: 14 }}>
      <strong>Apple Watch 运动数据</strong>
      <p style={{ fontSize: 13, lineHeight: 1.6 }}>导入 Apple 健康 ZIP 后，心率和步数只保存整理后的图表；睡眠只取 Apple Watch。低频的体重、血压等家庭成员归属尚未确认，暂不并入个人曲线。</p>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13 }}><span>数据截止：<b>{data?.data_cutoff_date || "尚未导入"}</b></span><span>上次导入：<b>{data?.last_import_at ? new Date(data.last_import_at).toLocaleDateString() : "—"}</b></span><span>运动记录：{data?.workouts.length || 0} 次</span><span>待确认归属：{data?.unassigned_count || 0} 条</span></div>
      {stale && <p style={{ color: "var(--orange)", fontWeight: 600 }}>距离上次更新已超过 30 天，可以导入新的 Apple 健康 ZIP 增量更新。</p>}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
        <label className="fv-btn" style={{ padding: "8px 12px", cursor: "pointer" }}>{isCloud ? "导入 Mac 整理的运动数据" : "增量导入 Apple 健康 ZIP"}<input type="file" accept={isCloud ? ".json" : ".zip"} hidden disabled={busy} onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} /></label>
        {!isCloud && data?.watch_source && <a className="fv-btn" href="/api/health/activity/export" download="apple-watch-activity.json" style={{ padding: "8px 12px", textDecoration: "none" }}>导出网页同步文件</a>}
      </div>
      {busy && <p>正在处理，请保持页面打开…</p>}{result && <p style={{ color: "var(--green)" }}>{result}</p>}{error && <p style={{ color: "var(--red)" }}>{error}</p>}
    </div>
    {data?.watch_source && <div style={{ ...card, padding: 18 }}><div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
      {[{ id: "steps", name: "步数" }, { id: "heart", name: "心率" }, { id: "sleep", name: "睡眠" }, ...metrics.map(m => ({ id: m.type, name: label(m.type) }))].map(x => <button key={x.id} onClick={() => setSelected(x.id)} className="fv-btn" style={{ padding: "5px 8px", background: selected === x.id ? "var(--accent)" : undefined, color: selected === x.id ? "white" : undefined }}>{x.name}</button>)}
    </div><Chart rows={rows} field={field} /><p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>图表数据点：{rows.length}{chosen ? ` · 原始记录 ${chosen.samples} 条 · ${chosen.unit}` : ""}</p></div>}
  </div>;
}
