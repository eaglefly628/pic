import React, { useState } from "react";
import type { AccountMeta, Category } from "../data/types";
import type { AccountInput } from "../vault/ops";
import { Btn, Field, Modal, Select, TextField } from "../ui";

const CATS: { value: Category; label: string }[] = [
  { value: "liquid", label: "流动资金" },
  { value: "invest", label: "投资理财" },
  { value: "estate", label: "家庭房产" },
  { value: "fixed", label: "家庭其他固定资产" },
  { value: "debt", label: "负债" },
];
const COMPS = ["现金及银行", "股票", "理财/固收", "基金", "黄金", "房产", "养老金", "公积金", "其他固定资产", "负债", "其他"].map((v) => ({ value: v, label: v }));
const OWNERS = ["本人", "配偶", "全家", "父亲", "母亲", "孩子"];
const PALETTE = ["#FF2D55", "#FF6482", "#FF9500", "#FFD60A", "#34C759", "#30D158", "#30B0C7", "#64D2FF", "#007AFF", "#5E5CE6", "#BF5AF2", "#8E8E93"];

// 宽松解析金额：整数、小数、负数均可（自动去掉 ¥、逗号、空格等）
function parseNum(s: string): number {
  const n = parseFloat(s.replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? 0 : n;
}

export function AccountEditor({ open, initial, onClose, onSubmit }: {
  open: boolean; initial?: AccountMeta & { comp?: string }; onClose: () => void;
  onSubmit: (meta: AccountInput, balance: number) => void;
}) {
  const editing = !!initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [cat, setCat] = useState<Category>(initial?.cat ?? "liquid");
  const [type, setType] = useState(initial?.type ?? "储蓄/活期");
  const [comp, setComp] = useState(initial?.comp ?? "现金及银行");
  const [institution, setInstitution] = useState(initial?.institution ?? "");
  const [owner, setOwner] = useState(initial?.owner ?? "本人");
  const [color, setColor] = useState(initial?.color ?? PALETTE[0]);
  const [balance, setBalance] = useState("");
  const [ratePct, setRatePct] = useState("");

  React.useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? ""); setCat(initial?.cat ?? "liquid"); setType(initial?.type ?? "储蓄/活期");
    setComp(initial?.comp ?? "现金及银行"); setInstitution(initial?.institution ?? ""); setOwner(initial?.owner ?? "本人");
    setColor(initial?.color ?? PALETTE[0]); setBalance("");
    setRatePct(initial?.rate != null ? String(+(initial.rate * 100).toFixed(4)) : "");
  }, [open, initial]);

  const submit = () => {
    if (!name.trim()) return;
    onSubmit(
      { name: name.trim(), cat, type: type.trim() || "其他", comp, institution: institution.trim() || "—", owner: owner.trim() || "全家", color, rate: (parseFloat(ratePct) || 0) / 100 },
      parseNum(balance)
    );
    onClose();
  };

  return (
    <Modal open={open} title={editing ? "编辑账户" : "新增账户"} onClose={onClose}
      footer={<><Btn variant="ghost" onClick={onClose}>取消</Btn><Btn onClick={submit}>{editing ? "保存" : "添加"}</Btn></>}>
      <Field label="账户名称"><TextField value={name} onChange={(e) => setName(e.target.value)} placeholder="如 招商银行储蓄卡" autoFocus /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="分组"><Select value={cat} options={CATS} onChange={(e) => setCat(e.target.value as Category)} /></Field>
        <Field label="资产构成"><Select value={comp} options={COMPS} onChange={(e) => setComp(e.target.value)} /></Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="类型"><TextField value={type} onChange={(e) => setType(e.target.value)} placeholder="储蓄/股票/房产…" /></Field>
        <Field label="归属">
          <Select value={owner} onChange={(e) => setOwner(e.target.value)}
            options={(OWNERS.includes(owner) ? OWNERS : [owner, ...OWNERS]).map((o) => ({ value: o, label: o }))} />
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="机构（可选）"><TextField value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="如 招商银行" /></Field>
        <Field label="年利率（%，默认 0）"><TextField value={ratePct} onChange={(e) => setRatePct(e.target.value)} inputMode="decimal" placeholder="0" /></Field>
      </div>
      {!editing && (
        <Field label="当前余额（整数或小数，负债填负数）"><TextField value={balance} onChange={(e) => setBalance(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="如 50000" inputMode="decimal" /></Field>
      )}
      <Field label="颜色">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {PALETTE.map((c) => (
            <button key={c} onClick={() => setColor(c)} style={{ width: 26, height: 26, borderRadius: 7, background: c, border: color === c ? "2px solid var(--text-primary)" : "2px solid transparent", cursor: "pointer" }} />
          ))}
        </div>
      </Field>
    </Modal>
  );
}

export function SnapshotEditor({ open, accountName, onClose, onSubmit }: {
  open: boolean; accountName: string; onClose: () => void; onSubmit: (date: string, amount: number) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState("");

  React.useEffect(() => { if (open) { setDate(today); setAmount(""); } }, [open, today]);

  const submit = () => {
    if (!amount.trim()) return;
    onSubmit(date, parseNum(amount));
    onClose();
  };

  return (
    <Modal open={open} title={`新增快照 · ${accountName}`} onClose={onClose} width={400}
      footer={<><Btn variant="ghost" onClick={onClose}>取消</Btn><Btn onClick={submit}>添加</Btn></>}>
      <Field label="日期"><TextField type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <Field label="余额（整数或小数均可）"><TextField value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="如 50000" inputMode="decimal" autoFocus /></Field>
    </Modal>
  );
}
