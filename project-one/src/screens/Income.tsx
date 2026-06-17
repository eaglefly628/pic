import React, { useState } from "react";
import { useVault } from "../vault/VaultContext";
import type { IncomeItem } from "../vault/types";
import { fmt } from "../lib/format";
import { Btn, Field, Modal, Select, TextField, TextArea, EmptyState, card, uid } from "../ui";
import { useCountUp, rise } from "../lib/anim";
import { IconPlus, IconEdit, IconTrash } from "../icons";

const CATS = ["工资", "奖金", "经营", "投资分红", "租金", "其他"];

function monthly(it: IncomeItem): number {
  return it.period === "month" ? it.amount : it.amount / 12;
}

export default function Income() {
  const { data, update } = useVault();
  const items = data?.incomes ?? [];
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<IncomeItem | null>(null);

  const totalMonthly = items.reduce((s, it) => s + monthly(it), 0);
  const mAnim = useCountUp(totalMonthly);
  const yAnim = useCountUp(totalMonthly * 12);

  const startNew = () => { setEditing(null); setOpen(true); };
  const remove = (id: string) => update((d) => { d.incomes = (d.incomes ?? []).filter((x) => x.id !== id); });

  return (
    <div style={{ padding: "24px 32px 40px" }}>
      <div className="fv-rise" style={{ ...rise(0), display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 18 }}>
        <div style={{ background: "linear-gradient(155deg, var(--green), #1FAD66)", borderRadius: 14, padding: "18px 22px", color: "#fff", boxShadow: "0 8px 20px -6px rgba(52,199,89,0.4)" }}>
          <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.85)", fontWeight: 500 }}>每月收入合计</div>
          <div style={{ fontSize: 25, fontWeight: 700, marginTop: 8, fontVariantNumeric: "tabular-nums" }}>{fmt(mAnim)}</div>
        </div>
        <Metric label="每年收入合计" value={fmt(yAnim)} />
        <Metric label="收入来源" value={`${items.length} 项`} />
      </div>

      <div className="fv-rise" style={{ ...rise(70), display: "flex", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>记录工资、租金、分红等收入</div>
        <div style={{ flex: 1 }} />
        <Btn onClick={startNew}><IconPlus />新增收入</Btn>
      </div>

      {items.length === 0 ? (
        <EmptyState text="还没有收入记录" action={<Btn variant="soft" onClick={startNew}>添加第一项</Btn>} />
      ) : (
        <div className="fv-rise" style={{ ...rise(140), ...card, overflow: "hidden" }}>
          <div style={{ display: "flex", padding: "8px 22px", fontSize: 11, color: "var(--text-tertiary)", background: "var(--bg-card-2)" }}>
            <span style={{ flex: 1 }}>名称</span>
            <span style={{ width: 90 }}>分类</span>
            <span style={{ width: 140, textAlign: "right" }}>金额</span>
            <span style={{ width: 70, textAlign: "center" }}>周期</span>
            <span style={{ width: 140, textAlign: "right" }}>折合每月</span>
            <span style={{ width: 70 }} />
          </div>
          {items.map((it) => (
            <div key={it.id} style={{ display: "flex", alignItems: "center", padding: "12px 22px", borderTop: "0.5px solid var(--separator)", fontSize: 13 }}>
              <span style={{ flex: 1, color: "var(--text-primary)", fontWeight: 500 }}>{it.name}</span>
              <span style={{ width: 90, fontSize: 11.5, color: "var(--text-secondary)" }}>{it.category}</span>
              <span style={{ width: 140, textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--text-primary)" }}>{fmt(it.amount)}</span>
              <span style={{ width: 70, textAlign: "center", fontSize: 11.5, color: "var(--text-tertiary)" }}>{it.period === "month" ? "每月" : "每年"}</span>
              <span style={{ width: 140, textAlign: "right", fontWeight: 600, color: "var(--green)", fontVariantNumeric: "tabular-nums" }}>{fmt(monthly(it))}</span>
              <span style={{ width: 70, display: "flex", justifyContent: "flex-end", gap: 4 }}>
                <button onClick={() => { setEditing(it); setOpen(true); }} title="编辑" className="fv-icnbtn" style={mini}><IconEdit size={14} stroke="var(--text-secondary)" /></button>
                <button onClick={() => remove(it.id)} title="删除" className="fv-icnbtn" style={mini}><IconTrash size={14} stroke="var(--red)" /></button>
              </span>
            </div>
          ))}
        </div>
      )}

      <Editor open={open} initial={editing} onClose={() => setOpen(false)} onSave={(vals) => {
        update((d) => {
          d.incomes = d.incomes ?? [];
          if (editing) { const it = d.incomes.find((x) => x.id === editing.id); if (it) Object.assign(it, vals, { updatedAt: Date.now() }); }
          else { const now = Date.now(); d.incomes.push({ id: uid("inc"), ...vals, createdAt: now, updatedAt: now }); }
        });
        setOpen(false);
      }} />
    </div>
  );
}

const mini: React.CSSProperties = { width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, background: "var(--fill-quaternary)", border: "none", cursor: "pointer" };

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ ...card, padding: "18px 22px" }}>
      <div style={{ fontSize: 12.5, color: "var(--text-secondary)", fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 25, fontWeight: 600, color: "var(--text-primary)", marginTop: 8, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

type Vals = Omit<IncomeItem, "id" | "createdAt" | "updatedAt">;
function Editor({ open, initial, onClose, onSave }: { open: boolean; initial: IncomeItem | null; onClose: () => void; onSave: (v: Vals) => void }) {
  const [name, setName] = useState(""); const [amount, setAmount] = useState(""); const [period, setPeriod] = useState<"month" | "year">("month");
  const [category, setCategory] = useState(CATS[0]); const [note, setNote] = useState("");
  React.useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? ""); setAmount(initial ? String(initial.amount) : ""); setPeriod(initial?.period ?? "month");
    setCategory(initial?.category ?? CATS[0]); setNote(initial?.note ?? "");
  }, [open, initial]);
  const submit = () => { if (!name.trim()) return; onSave({ name: name.trim(), amount: parseFloat(amount.replace(/[^0-9.\-]/g, "")) || 0, period, category, note }); };
  return (
    <Modal open={open} title={initial ? "编辑收入" : "新增收入"} onClose={onClose}
      footer={<><Btn variant="ghost" onClick={onClose}>取消</Btn><Btn onClick={submit}>保存</Btn></>}>
      <Field label="名称"><TextField value={name} onChange={(e) => setName(e.target.value)} placeholder="如 工资" autoFocus /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 12 }}>
        <Field label="金额"><TextField value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} inputMode="decimal" placeholder="0" /></Field>
        <Field label="周期"><Select value={period} options={[{ value: "month", label: "每月" }, { value: "year", label: "每年" }]} onChange={(e) => setPeriod(e.target.value as "month" | "year")} /></Field>
        <Field label="分类"><Select value={category} options={CATS.map((c) => ({ value: c, label: c }))} onChange={(e) => setCategory(e.target.value)} /></Field>
      </div>
      <Field label="备注（可选）"><TextArea value={note} onChange={(e) => setNote(e.target.value)} /></Field>
    </Modal>
  );
}
