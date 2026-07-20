import { useState } from "react";
import type { DevData, VehicleData, VehicleLog, VehicleLogType } from "../../types";
import { card, Btn, inputStyle, Segmented } from "../../ui";
import { IconPlus, IconTrash } from "../../icons";
import { uid } from "./shared";

type Mut = (fn: (d: DevData) => void) => void;

const todayStr = () => { const d = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const yuan = (n: number) => "¥" + (Math.round((n || 0) * 100) / 100).toLocaleString("zh-CN", { maximumFractionDigits: 2 });
const TYPE_LABEL: Record<VehicleLogType, string> = { fuel: "加油", maintenance: "保养", other: "其它" };
const TYPE_COLOR: Record<VehicleLogType, string> = { fuel: "var(--accent)", maintenance: "var(--orange)", other: "var(--text-tertiary)" };

function ensureVehicle(d: DevData): VehicleData {
  if (!d.vehicle) d.vehicle = { vehicles: [], logs: [] };
  if (!Array.isArray(d.vehicle.vehicles)) d.vehicle.vehicles = [];
  if (!Array.isArray(d.vehicle.logs)) d.vehicle.logs = [];
  return d.vehicle;
}

// 从加油记录(按里程排序)算最近一次的油耗 L/100km：升数 / 本次与上次加油的里程差 * 100
function fuelEconomy(logs: VehicleLog[]): { latest?: number; avg?: number } {
  const fuel = logs.filter((l) => l.type === "fuel" && l.odometer != null && l.liters != null).sort((a, b) => (a.odometer! - b.odometer!));
  if (fuel.length < 2) return {};
  const segs: number[] = [];
  for (let i = 1; i < fuel.length; i++) {
    const dist = fuel[i].odometer! - fuel[i - 1].odometer!;
    if (dist > 0) segs.push((fuel[i].liters! / dist) * 100);
  }
  if (!segs.length) return {};
  return { latest: segs[segs.length - 1], avg: segs.reduce((a, b) => a + b, 0) / segs.length };
}

export default function VehicleScreen({ data, mut }: { data: DevData; mut: Mut }) {
  const vd = data.vehicle ?? { vehicles: [], logs: [] };
  const vehicles = vd.vehicles ?? [];
  const logs = vd.logs ?? [];
  const [open, setOpen] = useState<string | null>(vehicles[0]?.id ?? null);
  const [adding, setAdding] = useState(false);

  const addVehicle = (name: string, plate: string) => mut((d) => { const v = ensureVehicle(d); const id = uid("veh"); v.vehicles.push({ id, name: name.trim() || "我的车", plate: plate.trim() || undefined, createdAt: Date.now() }); });
  const delVehicle = (id: string, name: string) => { if (confirm(`删除车辆「${name}」及它的所有记录？`)) mut((d) => { const v = ensureVehicle(d); v.vehicles = v.vehicles.filter((x) => x.id !== id); v.logs = v.logs.filter((x) => x.vehicleId !== id); }); };
  const addLog = (vehicleId: string, log: Omit<VehicleLog, "id" | "vehicleId" | "createdAt">) => mut((d) => { ensureVehicle(d).logs.unshift({ id: uid("vl"), vehicleId, createdAt: Date.now(), ...log }); });
  const delLog = (id: string) => mut((d) => { const v = ensureVehicle(d); v.logs = v.logs.filter((x) => x.id !== id); });

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>爱车</div>
        <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", marginTop: 4, lineHeight: 1.6 }}>记里程、加油、保养。加油记两次就能算出油耗(L/100km)。</div>
      </div>

      {!vehicles.length && !adding && (
        <div style={{ ...card, padding: "30px 18px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13.5 }}>还没有车辆。加一辆开始记 🚗</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {vehicles.map((v) => {
          const vLogs = logs.filter((l) => l.vehicleId === v.id).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
          const odo = vLogs.find((l) => l.odometer != null)?.odometer;
          const spent = vLogs.reduce((a, l) => a + (l.cost || 0), 0);
          const fuelSpent = vLogs.filter((l) => l.type === "fuel").reduce((a, l) => a + (l.cost || 0), 0);
          const maintSpent = vLogs.filter((l) => l.type === "maintenance").reduce((a, l) => a + (l.cost || 0), 0);
          const eco = fuelEconomy(vLogs);
          const isOpen = open === v.id;
          return (
            <div key={v.id} style={{ ...card, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                <div style={{ fontSize: 15.5, fontWeight: 700 }}>{v.name}</div>
                {v.plate && <span style={{ fontSize: 11.5, color: "var(--text-tertiary)", background: "var(--fill-q)", padding: "2px 8px", borderRadius: 6 }}>{v.plate}</span>}
                <div style={{ flex: 1 }} />
                <button onClick={() => delVehicle(v.id, v.name)} className="fv-tap" title="删除车辆" style={{ border: "none", background: "transparent", color: "var(--text-tertiary)", padding: 4, borderRadius: 6, cursor: "pointer", display: "flex" }}><IconTrash size={15} stroke="currentColor" /></button>
              </div>

              <div style={{ display: "flex", gap: 22, flexWrap: "wrap", marginBottom: 10 }}>
                <Stat label="里程表" value={odo != null ? `${odo.toLocaleString()} km` : "—"} />
                <Stat label="近期油耗" value={eco.latest != null ? `${eco.latest.toFixed(1)} L/100km` : "—"} color="var(--accent)" />
                <Stat label="平均油耗" value={eco.avg != null ? `${eco.avg.toFixed(1)} L/100km` : "—"} />
                <Stat label="总花费" value={yuan(spent)} color="var(--orange)" />
                <Stat label="油费 / 保养" value={`${yuan(fuelSpent)} / ${yuan(maintSpent)}`} />
                <div style={{ flex: 1 }} />
                <button onClick={() => setOpen(isOpen ? null : v.id)} className="fv-tap" style={{ border: "none", background: "transparent", color: "var(--accent)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: "2px 4px" }}>{isOpen ? "收起" : `记一笔 · ${vLogs.length} 笔 ▾`}</button>
              </div>

              {isOpen && <VehicleLogPanel logs={vLogs} onAdd={(log) => addLog(v.id, log)} onDel={delLog} lastOdo={odo} />}
            </div>
          );
        })}
      </div>

      {adding ? (
        <AddVehicle onAdd={(n, p) => { addVehicle(n, p); setAdding(false); }} onCancel={() => setAdding(false)} />
      ) : (
        <div style={{ marginTop: 12 }}>
          <Btn variant="ghost" onClick={() => setAdding(true)}><IconPlus size={14} stroke="currentColor" /> 加一辆车</Btn>
        </div>
      )}
    </div>
  );
}

function AddVehicle({ onAdd, onCancel }: { onAdd: (name: string, plate: string) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [plate, setPlate] = useState("");
  return (
    <div style={{ ...card, padding: "14px 16px", marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="车辆昵称（如 Model 3）" style={{ ...inputStyle, flex: 1, minWidth: 160 }} autoFocus />
      <input value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="车牌（可选）" style={{ ...inputStyle, width: 140 }} />
      <Btn onClick={() => name.trim() && onAdd(name, plate)} disabled={!name.trim()}>加车</Btn>
      <Btn variant="ghost" onClick={onCancel}>取消</Btn>
    </div>
  );
}

function VehicleLogPanel({ logs, onAdd, onDel, lastOdo }: { logs: VehicleLog[]; onAdd: (log: Omit<VehicleLog, "id" | "vehicleId" | "createdAt">) => void; onDel: (id: string) => void; lastOdo?: number }) {
  const [type, setType] = useState<VehicleLogType>("fuel");
  const [date, setDate] = useState(todayStr());
  const [odometer, setOdometer] = useState(lastOdo ? String(lastOdo) : "");
  const [liters, setLiters] = useState("");
  const [cost, setCost] = useState("");
  const [label, setLabel] = useState("");

  const add = () => {
    const odo = odometer ? parseFloat(odometer) : undefined;
    const l = liters ? parseFloat(liters) : undefined;
    const c = cost ? parseFloat(cost) : undefined;
    if (type === "fuel" && (!odo || !l)) return;
    if (type === "maintenance" && !label.trim()) return;
    onAdd({ type, date: date || todayStr(), odometer: odo, liters: type === "fuel" ? l : undefined, cost: c, label: type !== "fuel" ? label.trim() || undefined : undefined });
    setLiters(""); setCost(""); setLabel(""); setDate(todayStr());
  };
  const priceHint = liters && cost ? `¥${(parseFloat(cost) / parseFloat(liters)).toFixed(2)}/L` : "";

  return (
    <div style={{ marginTop: 12, borderTop: "0.5px solid var(--separator)", paddingTop: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
        <Segmented value={type} onChange={setType} style={{ width: 200 }} options={[{ value: "fuel", label: "加油" }, { value: "maintenance", label: "保养" }, { value: "other", label: "其它" }]} />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inputStyle, width: 148 }} />
        <input type="number" inputMode="decimal" value={odometer} onChange={(e) => setOdometer(e.target.value)} placeholder="里程(km)" style={{ ...inputStyle, width: 110 }} />
        {type === "fuel" && <input type="number" inputMode="decimal" value={liters} onChange={(e) => setLiters(e.target.value)} placeholder="升数" style={{ ...inputStyle, width: 90 }} />}
        {type !== "fuel" && <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="项目" style={{ ...inputStyle, flex: 1, minWidth: 100 }} />}
        <input type="number" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="花费" style={{ ...inputStyle, width: 100 }} />
        <Btn onClick={add}><IconPlus size={13} stroke="currentColor" /> 加</Btn>
      </div>
      {priceHint && type === "fuel" && <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 8 }}>约 {priceHint}</div>}
      {!logs.length ? (
        <div style={{ padding: "10px 4px", color: "var(--text-tertiary)", fontSize: 12.5 }}>还没有记录。</div>
      ) : logs.map((l) => (
        <div key={l.id} className="fv-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 6px", borderRadius: 8, fontSize: 13 }}>
          <span style={{ width: 46, flex: "none", fontSize: 11, color: "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}>{l.date?.slice(5)}</span>
          <span style={{ width: 44, flex: "none", fontSize: 11, fontWeight: 700, color: TYPE_COLOR[l.type] }}>{TYPE_LABEL[l.type]}</span>
          <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--text-secondary)" }}>
            {l.type === "fuel" ? `${l.odometer?.toLocaleString() ?? "—"} km · ${l.liters ?? "—"}L` : (l.label || (l.odometer != null ? `${l.odometer.toLocaleString()} km` : "—"))}
          </span>
          <span style={{ flex: "none", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{l.cost != null ? yuan(l.cost) : "—"}</span>
          <button onClick={() => onDel(l.id)} className="fv-tap" title="删除" style={{ border: "none", background: "transparent", color: "var(--text-tertiary)", padding: 3, borderRadius: 6, cursor: "pointer", display: "flex", flex: "none" }}><IconTrash size={14} stroke="currentColor" /></button>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: color ?? "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}
