import { useMemo, useState } from "react";
import type { DevData, TravelData, TravelStatus, Trip, TripStop } from "../../types";
import { card, Btn, inputStyle, Segmented } from "../../ui";
import { IconPlus, IconTrash, IconBack, IconArrowRight } from "../../icons";
import { uid } from "./shared";
import { RealMap } from "./RealMap";

type Mut = (fn: (d: DevData) => void) => void;
type Tab = "spots" | "trips";

const STATUS_LABEL: Record<TravelStatus, string> = { wishlist: "想去", planned: "已计划", done: "已完成" };
const STATUS_COLOR: Record<TravelStatus, string> = { wishlist: "var(--text-tertiary)", planned: "var(--accent)", done: "var(--green)" };
const CONTINENTS = ["亚洲", "欧洲", "北美洲", "南美洲", "非洲", "大洋洲", "南极洲"];
const todayStr = () => { const d = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const yuan = (n: number) => "¥" + (Math.round((n || 0) * 100) / 100).toLocaleString("zh-CN", { maximumFractionDigits: 2 });

// 世界知名景点预设（近似经纬度，供地图 + 快速填表用，不代表已去过）。
const FAMOUS_SPOTS: { name: string; country: string; continent: string; lat: number; lon: number }[] = [
  { name: "埃菲尔铁塔", country: "法国", continent: "欧洲", lat: 48.86, lon: 2.29 },
  { name: "罗马斗兽场", country: "意大利", continent: "欧洲", lat: 41.89, lon: 12.49 },
  { name: "大本钟", country: "英国", continent: "欧洲", lat: 51.5, lon: -0.12 },
  { name: "圣托里尼", country: "希腊", continent: "欧洲", lat: 36.39, lon: 25.46 },
  { name: "长城(八达岭)", country: "中国", continent: "亚洲", lat: 40.43, lon: 116.57 },
  { name: "故宫", country: "中国", continent: "亚洲", lat: 39.92, lon: 116.40 },
  { name: "富士山", country: "日本", continent: "亚洲", lat: 35.36, lon: 138.73 },
  { name: "吴哥窟", country: "柬埔寨", continent: "亚洲", lat: 13.41, lon: 103.87 },
  { name: "泰姬陵", country: "印度", continent: "亚洲", lat: 27.18, lon: 78.04 },
  { name: "哈利法塔", country: "阿联酋", continent: "亚洲", lat: 25.20, lon: 55.27 },
  { name: "自由女神像", country: "美国", continent: "北美洲", lat: 40.69, lon: -74.04 },
  { name: "大峡谷", country: "美国", continent: "北美洲", lat: 36.11, lon: -112.11 },
  { name: "黄石国家公园", country: "美国", continent: "北美洲", lat: 44.43, lon: -110.59 },
  { name: "奇琴伊察", country: "墨西哥", continent: "北美洲", lat: 20.68, lon: -88.57 },
  { name: "马丘比丘", country: "秘鲁", continent: "南美洲", lat: -13.16, lon: -72.55 },
  { name: "伊瓜苏瀑布", country: "巴西/阿根廷", continent: "南美洲", lat: -25.70, lon: -54.44 },
  { name: "复活节岛", country: "智利", continent: "南美洲", lat: -27.11, lon: -109.35 },
  { name: "吉萨金字塔", country: "埃及", continent: "非洲", lat: 29.98, lon: 31.13 },
  { name: "桌山", country: "南非", continent: "非洲", lat: -33.96, lon: 18.41 },
  { name: "撒哈拉沙漠", country: "摩洛哥", continent: "非洲", lat: 31.08, lon: -4.01 },
  { name: "悉尼歌剧院", country: "澳大利亚", continent: "大洋洲", lat: -33.86, lon: 151.22 },
  { name: "大堡礁", country: "澳大利亚", continent: "大洋洲", lat: -18.29, lon: 147.70 },
  { name: "米尔福德峡湾", country: "新西兰", continent: "大洋洲", lat: -44.67, lon: 167.93 },
];

function ensureTravel(d: DevData): TravelData {
  if (!d.travel) d.travel = { spots: [] };
  if (!Array.isArray(d.travel.spots)) d.travel.spots = [];
  if (!Array.isArray(d.travel.trips)) d.travel.trips = [];
  if (!Array.isArray(d.travel.tripExpenses)) d.travel.tripExpenses = [];
  return d.travel;
}

export default function Travel({ data, mut }: { data: DevData; mut: Mut }) {
  const [tab, setTab] = useState<Tab>("spots");
  const td = data.travel ?? { spots: [] };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>旅游计划</div>
        <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", marginTop: 4, lineHeight: 1.6 }}>世界知名景点清单 + 真实地图；把想去的串成一趟行程，配个预算。</div>
      </div>
      <Segmented value={tab} onChange={setTab} style={{ marginBottom: 16, maxWidth: 280 }} options={[{ value: "spots", label: "景点清单" }, { value: "trips", label: "行程规划" }]} />
      {tab === "spots" ? <SpotsView data={data} td={td} mut={mut} /> : <TripsView data={data} td={td} mut={mut} />}
    </div>
  );
}

// ── 景点清单 · 真实地图 ──────────────────────────────────────────
function SpotsView({ td, mut }: { data: DevData; td: TravelData; mut: Mut }) {
  const spots = td.spots ?? [];
  const [filter, setFilter] = useState<"all" | TravelStatus>("all");
  const [adding, setAdding] = useState(false);
  const [prefill, setPrefill] = useState<{ name: string; country: string; continent: string; lat?: number; lon?: number } | null>(null);

  const addSpot = (spot: Omit<import("../../types").TravelSpot, "id" | "createdAt">) => mut((d) => { ensureTravel(d).spots.unshift({ id: uid("trip"), createdAt: Date.now(), ...spot }); });
  const delSpot = (id: string) => mut((d) => { const t = ensureTravel(d); t.spots = t.spots.filter((x) => x.id !== id); });
  const setStatus = (id: string, status: TravelStatus) => mut((d) => { const t = ensureTravel(d); const s = t.spots.find((x) => x.id === id); if (s) s.status = status; });

  const filtered = filter === "all" ? spots : spots.filter((s) => s.status === filter);
  const grouped = useMemo(() => {
    const m = new Map<string, typeof spots>();
    for (const s of filtered) { const arr = m.get(s.continent) ?? []; arr.push(s); m.set(s.continent, arr); }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  const counts = { wishlist: spots.filter((s) => s.status === "wishlist").length, planned: spots.filter((s) => s.status === "planned").length, done: spots.filter((s) => s.status === "done").length };
  const mapSpots = useMemo(() => spots.filter((s) => s.lat != null && s.lon != null).map((s) => ({ id: s.id, name: s.name, country: s.country, lat: s.lat!, lon: s.lon!, status: s.status })), [spots]);

  return (
    <div>
      <div style={{ ...card, padding: "16px 18px", marginBottom: 14, display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
        <Stat label="想去" value={String(counts.wishlist)} color="var(--text-tertiary)" />
        <Stat label="已计划" value={String(counts.planned)} color="var(--accent)" />
        <Stat label="已完成" value={String(counts.done)} color="var(--green)" big />
        <div style={{ flex: 1 }} />
        <Btn onClick={() => { setPrefill(null); setAdding((v) => !v); }} variant={adding ? "ghost" : "primary"}><IconPlus size={14} stroke="currentColor" /> 加景点</Btn>
      </div>

      {spots.length > 0 && (
        <div style={{ ...card, padding: "14px 16px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>地图</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>OpenStreetMap 底图；只有填了经纬度的点会显示；圆点颜色=状态</div>
          </div>
          <RealMap spots={mapSpots} />
        </div>
      )}

      {adding && (
        <AddSpot
          prefill={prefill}
          onAdd={(s) => { addSpot(s); setAdding(false); setPrefill(null); }}
          onCancel={() => { setAdding(false); setPrefill(null); }}
          onPickPreset={(p) => setPrefill(p)}
        />
      )}

      <Segmented value={filter} onChange={setFilter} style={{ marginBottom: 14, maxWidth: 360 }} options={[{ value: "all", label: "全部" }, { value: "wishlist", label: "想去" }, { value: "planned", label: "已计划" }, { value: "done", label: "已完成" }]} />

      {!filtered.length ? (
        <div style={{ ...card, padding: "30px 18px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13.5 }}>还没有景点。点上面「加景点」，或从预设里挑一个 🗺️</div>
      ) : grouped.map(([continent, arr]) => (
        <div key={continent} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 8 }}>{continent} <span style={{ fontWeight: 400, color: "var(--text-tertiary)" }}>· {arr.length}</span></div>
          <div style={{ ...card, padding: "6px 8px" }}>
            {arr.map((s) => (
              <div key={s.id} className="fv-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 9, borderTop: "0.5px solid var(--separator)", flexWrap: "wrap" }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{s.country}{s.visitDate ? ` · ${s.visitDate}` : ""}{s.note ? ` · ${s.note}` : ""}</div>
                </span>
                <select value={s.status} onChange={(e) => setStatus(s.id, e.target.value as TravelStatus)} style={{ fontSize: 11.5, fontWeight: 700, color: STATUS_COLOR[s.status], background: `color-mix(in srgb, ${STATUS_COLOR[s.status]} 12%, transparent)`, border: "none", borderRadius: 7, padding: "4px 8px", flex: "none" }}>
                  {(["wishlist", "planned", "done"] as TravelStatus[]).map((st) => <option key={st} value={st}>{STATUS_LABEL[st]}</option>)}
                </select>
                <button onClick={() => delSpot(s.id)} className="fv-tap" title="删除" style={{ border: "none", background: "transparent", color: "var(--text-tertiary)", padding: 4, borderRadius: 6, cursor: "pointer", flex: "none", display: "flex" }}><IconTrash size={15} stroke="currentColor" /></button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AddSpot({ prefill, onAdd, onCancel, onPickPreset }: {
  prefill: { name: string; country: string; continent: string; lat?: number; lon?: number } | null;
  onAdd: (s: Omit<import("../../types").TravelSpot, "id" | "createdAt">) => void;
  onCancel: () => void;
  onPickPreset: (p: { name: string; country: string; continent: string; lat?: number; lon?: number }) => void;
}) {
  const [name, setName] = useState(prefill?.name ?? "");
  const [country, setCountry] = useState(prefill?.country ?? "");
  const [continent, setContinent] = useState(prefill?.continent ?? "亚洲");
  const [lat, setLat] = useState(prefill?.lat != null ? String(prefill.lat) : "");
  const [lon, setLon] = useState(prefill?.lon != null ? String(prefill.lon) : "");
  const [status, setStatus] = useState<TravelStatus>("wishlist");
  const [note, setNote] = useState("");

  const pick = (p: typeof FAMOUS_SPOTS[number]) => { setName(p.name); setCountry(p.country); setContinent(p.continent); setLat(String(p.lat)); setLon(String(p.lon)); onPickPreset(p); };
  const ok = name.trim() && country.trim();

  return (
    <div style={{ ...card, padding: "14px 16px", marginBottom: 16 }}>
      <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginBottom: 8 }}>常用点（点一下自动填表，还能改）：</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {FAMOUS_SPOTS.map((p) => (
          <button key={p.name} onClick={() => pick(p)} className="fv-tap" style={{ fontSize: 11.5, border: "0.5px solid var(--separator)", background: "var(--fill-q)", color: "var(--text-secondary)", borderRadius: 7, padding: "4px 9px", cursor: "pointer" }}>{p.name}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="景点名" style={{ ...inputStyle, flex: 1, minWidth: 140 }} />
        <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="国家" style={{ ...inputStyle, width: 120 }} />
        <select value={continent} onChange={(e) => setContinent(e.target.value)} style={{ ...inputStyle, width: 110 }}>
          {CONTINENTS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="number" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="纬度(可选)" style={{ ...inputStyle, width: 110 }} />
        <input type="number" inputMode="decimal" value={lon} onChange={(e) => setLon(e.target.value)} placeholder="经度(可选)" style={{ ...inputStyle, width: 110 }} />
        <select value={status} onChange={(e) => setStatus(e.target.value as TravelStatus)} style={{ ...inputStyle, width: 100 }}>
          {(["wishlist", "planned", "done"] as TravelStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="备注(可选)" style={{ ...inputStyle, flex: 1, minWidth: 120 }} />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <Btn onClick={() => ok && onAdd({ name: name.trim(), country: country.trim(), continent, lat: lat ? parseFloat(lat) : undefined, lon: lon ? parseFloat(lon) : undefined, status, note: note.trim() || undefined })} disabled={!ok}>加进清单</Btn>
        <Btn variant="ghost" onClick={onCancel}>取消</Btn>
      </div>
    </div>
  );
}

// ── 行程规划 · 把景点串成一趟行程 + 预算 ──────────────────────────
function TripsView({ td, mut }: { data: DevData; td: TravelData; mut: Mut }) {
  const trips = td.trips ?? [];
  const spots = td.spots ?? [];
  const expenses = td.tripExpenses ?? [];
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState(""); const [start, setStart] = useState(""); const [end, setEnd] = useState("");

  const addTrip = () => {
    if (!name.trim()) return;
    const id = uid("trip");
    mut((d) => { ensureTravel(d).trips!.unshift({ id, name: name.trim(), startDate: start || undefined, endDate: end || undefined, stops: [], createdAt: Date.now() }); });
    setName(""); setStart(""); setEnd(""); setAdding(false); setOpenId(id);
  };
  const delTrip = (id: string) => { if (!confirm("删除这趟行程？沿途景点本身不会被删。")) return; mut((d) => { const t = ensureTravel(d); t.trips = (t.trips ?? []).filter((x) => x.id !== id); t.tripExpenses = (t.tripExpenses ?? []).filter((x) => x.tripId !== id); }); if (openId === id) setOpenId(null); };

  const open = trips.find((t) => t.id === openId);
  if (open) return <TripDetail trip={open} spots={spots} expenses={expenses.filter((e) => e.tripId === open.id)} mut={mut} onBack={() => setOpenId(null)} />;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        <Btn onClick={() => setAdding((v) => !v)} variant={adding ? "ghost" : "primary"}><IconPlus size={14} stroke="currentColor" /> 新建行程</Btn>
      </div>
      {adding && (
        <div style={{ ...card, padding: "14px 16px", marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="行程名(如 日本关西7日游)" style={{ ...inputStyle, flex: 1, minWidth: 160 }} autoFocus />
          <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>出发</span>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={{ ...inputStyle, width: 148 }} />
          <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>结束</span>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={{ ...inputStyle, width: 148 }} />
          <Btn onClick={addTrip} disabled={!name.trim()}>建立</Btn>
          <Btn variant="ghost" onClick={() => setAdding(false)}>取消</Btn>
        </div>
      )}
      {!trips.length && !adding ? (
        <div style={{ ...card, padding: "30px 18px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13.5 }}>还没有行程。新建一趟，把想去的景点串起来，配个预算 ✈️</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {trips.map((t) => {
            const spent = expenses.filter((e) => e.tripId === t.id).reduce((a, e) => a + e.amount, 0);
            return (
              <div key={t.id} className="fv-card-int" style={{ ...card, padding: "14px 16px", cursor: "pointer" }} onClick={() => setOpenId(t.id)}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700 }}>{t.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 2 }}>
                      {t.startDate ? `${t.startDate} ~ ${t.endDate || "?"}` : "还没定日期"} · {t.stops.length} 站
                      {t.budget != null && <span> · 预算 {yuan(t.budget)}{spent > 0 && <span style={{ color: spent > t.budget ? "var(--red)" : "var(--text-tertiary)" }}>（已花 {yuan(spent)}）</span>}</span>}
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); delTrip(t.id); }} className="fv-tap" title="删除" style={{ border: "none", background: "transparent", color: "var(--text-tertiary)", padding: 4, borderRadius: 6, cursor: "pointer", flex: "none", display: "flex" }}><IconTrash size={15} stroke="currentColor" /></button>
                  <IconArrowRight size={15} stroke="var(--text-tertiary)" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TripDetail({ trip, spots, expenses, mut, onBack }: {
  trip: Trip; spots: import("../../types").TravelSpot[]; expenses: import("../../types").TripExpense[]; mut: Mut; onBack: () => void;
}) {
  const [addingStop, setAddingStop] = useState(false);
  const [pickSpotId, setPickSpotId] = useState("");
  const [stopDate, setStopDate] = useState("");
  const [amount, setAmount] = useState(""); const [label, setLabel] = useState(""); const [expDate, setExpDate] = useState(todayStr());

  const spotOf = (id: string) => spots.find((s) => s.id === id);
  const availableSpots = spots.filter((s) => !trip.stops.some((st) => st.spotId === s.id));

  const withTrip = (fn: (t: Trip) => void) => mut((d) => { if (!d.travel) return; const t = (d.travel.trips ?? []).find((x) => x.id === trip.id); if (t) fn(t); });
  const addStop = () => { if (!pickSpotId) return; withTrip((t) => t.stops.push({ spotId: pickSpotId, date: stopDate || undefined })); setPickSpotId(""); setStopDate(""); setAddingStop(false); };
  const delStop = (spotId: string) => withTrip((t) => { t.stops = t.stops.filter((s) => s.spotId !== spotId); });
  const moveStop = (i: number, dir: -1 | 1) => withTrip((t) => { const j = i + dir; if (j < 0 || j >= t.stops.length) return; [t.stops[i], t.stops[j]] = [t.stops[j], t.stops[i]]; });
  const setBudget = (v: string) => withTrip((t) => { const n = parseFloat(v); t.budget = v.trim() === "" || isNaN(n) ? undefined : n; });

  const addExpense = () => {
    const a = parseFloat(amount);
    if (!a || a <= 0 || !label.trim()) return;
    mut((d) => { const tv = ensureTravel(d); tv.tripExpenses!.unshift({ id: uid("texp"), tripId: trip.id, amount: a, label: label.trim(), date: expDate || todayStr(), createdAt: Date.now() }); });
    setAmount(""); setLabel(""); setExpDate(todayStr());
  };
  const delExpense = (id: string) => mut((d) => { const tv = ensureTravel(d); tv.tripExpenses = (tv.tripExpenses ?? []).filter((x) => x.id !== id); });

  const spent = expenses.reduce((a, e) => a + e.amount, 0);
  const budget = trip.budget ?? 0;
  const left = budget - spent;

  return (
    <div>
      <button onClick={onBack} className="fv-tap" style={{ display: "flex", alignItems: "center", gap: 4, border: "none", background: "transparent", color: "var(--accent)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: "4px 2px", marginBottom: 10 }}><IconBack size={14} stroke="currentColor" /> 所有行程</button>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>{trip.name}</div>
      <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 16 }}>{trip.startDate ? `${trip.startDate} ~ ${trip.endDate || "?"}` : "还没定日期"}</div>

      {/* 预算 */}
      <div style={{ ...card, padding: "16px 18px", marginBottom: 16, display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginBottom: 3 }}>预算</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
            <span style={{ color: "var(--text-tertiary)", fontSize: 15 }}>¥</span>
            <input type="number" inputMode="decimal" defaultValue={trip.budget ?? ""} onBlur={(e) => setBudget(e.target.value)} placeholder="0" style={{ border: "none", borderBottom: "1px solid var(--separator)", background: "transparent", fontSize: 18, fontWeight: 700, color: "var(--text-primary)", outline: "none", padding: "1px 0", width: 110 }} />
          </div>
        </div>
        <Stat label="已花" value={yuan(spent)} color="var(--orange)" />
        {budget > 0 && <Stat label={left >= 0 ? "还剩" : "超支"} value={yuan(Math.abs(left))} color={left >= 0 ? "var(--green)" : "var(--red)"} big />}
      </div>

      {/* 行程 · 按顺序的景点 */}
      <div style={{ ...card, padding: "14px 16px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, flex: 1 }}>行程安排</div>
          <Btn variant="ghost" onClick={() => setAddingStop((v) => !v)} style={{ height: 30 }}><IconPlus size={13} stroke="currentColor" /> 加一站</Btn>
        </div>
        {addingStop && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10, padding: "10px", background: "var(--fill-q)", borderRadius: 9 }}>
            <select value={pickSpotId} onChange={(e) => setPickSpotId(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 160 }}>
              <option value="">从「景点清单」里选…</option>
              {availableSpots.map((s) => <option key={s.id} value={s.id}>{s.name}（{s.country}）</option>)}
            </select>
            <input type="date" value={stopDate} onChange={(e) => setStopDate(e.target.value)} style={{ ...inputStyle, width: 148 }} />
            <Btn onClick={addStop} disabled={!pickSpotId}>加入</Btn>
          </div>
        )}
        {!trip.stops.length ? (
          <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", padding: "10px 4px" }}>{availableSpots.length ? "还没排景点，点上面「加一站」。" : "「景点清单」里还没有景点，先去那边加几个。"}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {trip.stops.map((st: TripStop, i: number) => {
              const s = spotOf(st.spotId);
              return (
                <div key={st.spotId + i} className="fv-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8 }}>
                  <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--accent-soft)", color: "var(--accent)", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>{i + 1}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600 }}>{s ? s.name : "（景点已被删除）"}</span>
                  <span style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>{s?.country}</span>
                  <span style={{ fontSize: 11.5, color: "var(--text-tertiary)", width: 90, textAlign: "right" }}>{st.date || "未定日期"}</span>
                  <div style={{ display: "flex", gap: 2, flex: "none" }}>
                    <button onClick={() => moveStop(i, -1)} disabled={i === 0} className="fv-tap" style={{ width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: "transparent", color: i === 0 ? "var(--text-quaternary)" : "var(--text-secondary)", cursor: i === 0 ? "default" : "pointer" }}>↑</button>
                    <button onClick={() => moveStop(i, 1)} disabled={i === trip.stops.length - 1} className="fv-tap" style={{ width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: "transparent", color: i === trip.stops.length - 1 ? "var(--text-quaternary)" : "var(--text-secondary)", cursor: i === trip.stops.length - 1 ? "default" : "pointer" }}>↓</button>
                  </div>
                  <button onClick={() => delStop(st.spotId)} className="fv-tap" title="移出行程" style={{ border: "none", background: "transparent", color: "var(--text-tertiary)", padding: 4, borderRadius: 6, cursor: "pointer", flex: "none", display: "flex" }}><IconTrash size={14} stroke="currentColor" /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 花费 */}
      <div style={{ ...card, padding: "14px 16px" }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>花费记录</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
          <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="金额" style={{ ...inputStyle, width: 100 }} />
          <input value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addExpense(); }} placeholder="花在哪了" style={{ ...inputStyle, flex: 1, minWidth: 140 }} />
          <input type="date" value={expDate} onChange={(e) => setExpDate(e.target.value)} style={{ ...inputStyle, width: 148 }} />
          <Btn onClick={addExpense} disabled={!amount || !label.trim()}><IconPlus size={13} stroke="currentColor" /> 记一笔</Btn>
        </div>
        {!expenses.length ? (
          <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", padding: "8px 4px" }}>这趟还没花过。</div>
        ) : expenses.map((e) => (
          <div key={e.id} className="fv-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 6px", borderRadius: 8, fontSize: 13 }}>
            <span style={{ width: 48, flex: "none", fontSize: 11, color: "var(--text-tertiary)" }}>{e.date?.slice(5)}</span>
            <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.label}</span>
            <span style={{ flex: "none", fontWeight: 700 }}>{yuan(e.amount)}</span>
            <button onClick={() => delExpense(e.id)} className="fv-tap" style={{ border: "none", background: "transparent", color: "var(--text-tertiary)", padding: 3, borderRadius: 6, cursor: "pointer", display: "flex", flex: "none" }}><IconTrash size={14} stroke="currentColor" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, color, big }: { label: string; value: string; color?: string; big?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: big ? 23 : 18, fontWeight: 700, color: color ?? "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}
