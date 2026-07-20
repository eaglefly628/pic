import { useMemo, useState } from "react";
import type { DevData, TravelData, TravelStatus } from "../../types";
import { card, Btn, inputStyle, Segmented } from "../../ui";
import { IconPlus, IconTrash } from "../../icons";
import { uid } from "./shared";

type Mut = (fn: (d: DevData) => void) => void;

const STATUS_LABEL: Record<TravelStatus, string> = { wishlist: "想去", planned: "已计划", done: "已完成" };
const STATUS_COLOR: Record<TravelStatus, string> = { wishlist: "var(--text-tertiary)", planned: "var(--accent)", done: "var(--green)" };
const CONTINENTS = ["亚洲", "欧洲", "北美洲", "南美洲", "非洲", "大洋洲", "南极洲"];

// 世界知名景点预设（近似经纬度，供地图示意 + 快速填表用，不代表已去过）。
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
  return d.travel;
}

export default function Travel({ data, mut }: { data: DevData; mut: Mut }) {
  const td = data.travel ?? { spots: [] };
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

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>旅游计划</div>
        <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", marginTop: 4, lineHeight: 1.6 }}>世界知名景点清单 + 示意地图。想去的先放进来，去计划了再改状态。</div>
      </div>

      <div style={{ ...card, padding: "16px 18px", marginBottom: 14, display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
        <Stat label="想去" value={String(counts.wishlist)} color="var(--text-tertiary)" />
        <Stat label="已计划" value={String(counts.planned)} color="var(--accent)" />
        <Stat label="已完成" value={String(counts.done)} color="var(--green)" big />
        <div style={{ flex: 1 }} />
        <Btn onClick={() => { setPrefill(null); setAdding((v) => !v); }} variant={adding ? "ghost" : "primary"}><IconPlus size={14} stroke="currentColor" /> 加景点</Btn>
      </div>

      {spots.length > 0 && (
        <div style={{ ...card, padding: "14px 16px", marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>示意地图</div>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 8 }}>按经纬度定位的示意图（非精确地图），只有填了经纬度的点才会显示。</div>
          <WorldMap spots={spots.filter((s) => s.lat != null && s.lon != null)} />
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

function WorldMap({ spots }: { spots: import("../../types").TravelSpot[] }) {
  const W = 640, H = 300;
  const X = (lon: number) => ((lon + 180) / 360) * W;
  const Y = (lat: number) => ((90 - lat) / 180) * H;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", background: "var(--fill-q)", borderRadius: 10, display: "block" }}>
      {/* 经纬网格(赤道/本初子午线加粗) */}
      {Array.from({ length: 7 }, (_, i) => i * 30).map((lon) => <line key={lon} x1={X(lon - 180)} y1={0} x2={X(lon - 180)} y2={H} stroke="var(--separator)" strokeWidth={lon === 180 ? 1 : 0.5} />)}
      {Array.from({ length: 5 }, (_, i) => i * 45 - 90).map((lat) => <line key={lat} x1={0} y1={Y(lat)} x2={W} y2={Y(lat)} stroke="var(--separator)" strokeWidth={lat === 0 ? 1 : 0.5} />)}
      {spots.map((s) => (
        <g key={s.id}>
          <circle cx={X(s.lon!)} cy={Y(s.lat!)} r={4.5} fill={STATUS_COLOR[s.status]} stroke="var(--bg-elevated)" strokeWidth={1.2} />
          <text x={X(s.lon!) + 6} y={Y(s.lat!) + 3} fontSize={9} fill="var(--text-secondary)">{s.name}</text>
        </g>
      ))}
    </svg>
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
