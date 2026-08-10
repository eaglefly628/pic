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
// 账户配色盘：给人手动挑的，不是编码用的分类色，所以不跑 CVD 全对校验。
// 取暖象牙 register（比原 iOS 色板更闷一档），前 5 个与 --cat-1..5 同源，挑到就跟环形图一致。
const PALETTE = [
  "#ae431e", "#c2603a", "#be850c", "#9a7b16", "#7d8a1e", "#008a62",
  "#0f7f74", "#005b9b", "#5e7fb5", "#a964ba", "#a03a63", "#8a7a6e",
];

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
  const [comp, setComp] = useState(initial?.comp ?? "现金及银行");
  const [institution, setInstitution] = useState(initial?.institution ?? "");
  const [owner, setOwner] = useState(initial?.owner ?? "本人");
  const [color, setColor] = useState(initial?.color ?? PALETTE[0]);
  const [balance, setBalance] = useState("");
  const [ratePct, setRatePct] = useState("");

  React.useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? ""); setCat(initial?.cat ?? "liquid");
    setComp(initial?.comp ?? initial?.type ?? "现金及银行"); setInstitution(initial?.institution ?? ""); setOwner(initial?.owner ?? "本人");
    setColor(initial?.color ?? PALETTE[0]); setBalance("");
    setRatePct(initial?.rate != null ? String(+(initial.rate * 100).toFixed(4)) : "");
  }, [open, initial]);

  const submit = () => {
    if (!name.trim()) return;
    onSubmit(
      { name: name.trim(), cat, type: comp, comp, institution: institution.trim() || "—", owner: owner.trim() || "全家", color, rate: (parseFloat(ratePct) || 0) / 100 },
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
        <Field label="资产类型"><Select value={comp} options={COMPS} onChange={(e) => setComp(e.target.value)} /></Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="归属">
          <Select value={owner} onChange={(e) => setOwner(e.target.value)}
            options={(OWNERS.includes(owner) ? OWNERS : [owner, ...OWNERS]).map((o) => ({ value: o, label: o }))} />
        </Field>
        <Field label="机构（可选）"><TextField value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="如 招商银行" /></Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="年利率（%，默认 0）"><TextField value={ratePct} onChange={(e) => setRatePct(e.target.value)} inputMode="decimal" placeholder="0" /></Field>
        {!editing && <Field label="当前余额（可负）"><TextField value={balance} onChange={(e) => setBalance(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="如 50000" inputMode="decimal" /></Field>}
      </div>
      <Field label="颜色">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {PALETTE.map((c) => (
            <button key={c} onClick={() => setColor(c)} className="fv-tap" style={{ width: 26, height: 26, borderRadius: 7, background: c, border: color === c ? "2px solid var(--text-primary)" : "2px solid transparent", cursor: "pointer" }} />
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
