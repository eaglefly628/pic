import { useEffect, useMemo, useState } from "react";
import type { AccountMeta, Dataset, LiquidityPlan } from "../data/types";
import { fmt } from "../lib/format";
import { liquidityRows, liquidityTotals, validateLiquidityPlan } from "../lib/liquidity";
import { useBreakpoint } from "../lib/breakpoint";
import { Btn, Field, TextField, card } from "../ui";

const muted = { fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.6 } as const;

export function MaturityNotice({ dataset, onOpen }: { dataset: Dataset; onOpen: () => void }) {
  const due = liquidityRows(dataset).filter((row) => row.remainingDays !== undefined && row.remainingDays <= row.remindDays);
  if (!due.length) return null;
  const overdue = due.filter((row) => row.remainingDays! < 0).length;
  return <button onClick={onOpen} className="fv-tap" style={{ width: "100%", margin: "0 0 16px", padding: "12px 16px", border: "1px solid var(--orange)", borderRadius: 12, background: "var(--bg-card)", textAlign: "left", cursor: "pointer", color: "var(--text-primary)" }}>
    <strong>到期提醒：{due.length} 笔资金需要查看</strong>
    <span style={{ ...muted, display: "block" }}>{overdue ? `其中 ${overdue} 笔已过到期日。` : ""}查看日期与转存安排 →</span>
  </button>;
}

export default function Liquidity({ dataset, onOpen }: { dataset: Dataset; onOpen: (id: string) => void }) {
  const phone = useBreakpoint() === "phone";
  const rows = useMemo(() => liquidityRows(dataset), [dataset]);
  const totals = liquidityTotals(rows);
  const accessible = rows.filter((row) => row.available > 0).sort((a, b) =>
    (a.arrivalDays ?? Infinity) - (b.arrivalDays ?? Infinity) || b.available - a.available);
  const maturities = rows.filter((row) => row.remainingDays !== undefined).sort((a, b) =>
    (a.remainingDays ?? Infinity) - (b.remainingDays ?? Infinity));
  const alerts = maturities.filter((row) => (row.remainingDays ?? Infinity) <= row.remindDays);

  return <div style={{ padding: phone ? "18px 14px 34px" : "24px 32px 40px" }}>
    <h1 style={{ fontSize: phone ? 21 : 25, color: "var(--text-primary)", margin: "0 0 5px" }}>资金安排</h1>
    <p style={{ ...muted, margin: "0 0 18px" }}>每个账户的可调金额和到账天数由你设定。这里是筹资模拟，不会改变账户余额，也不会发起转账。</p>

    <div style={{ display: "grid", gridTemplateColumns: phone ? "repeat(2,minmax(0,1fr))" : "repeat(4,minmax(0,1fr))", gap: 10, marginBottom: 20 }}>
      {([ ["可调总额", totals.total], ["当天可到", totals.today], ["7 天内可到", totals.week], ["30 天内可到", totals.month] ] as const).map(([label, amount]) =>
        <div key={label} style={{ ...card, padding: "15px 16px", minWidth: 0 }}>
          <div style={muted}>{label}</div>
          <div style={{ fontSize: phone ? 17 : 21, fontWeight: 650, color: "var(--text-primary)", marginTop: 5, overflowWrap: "anywhere" }}>{fmt(amount)}</div>
        </div>)}
    </div>
    {totals.unknown > 0 && <p style={{ ...muted, marginTop: -10 }}>其中 {fmt(totals.unknown)} 尚未填写到账天数，已计入可调总额，但未计入按天汇总。</p>}

    <section style={{ ...card, padding: phone ? 16 : 22, marginBottom: 18 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 5px", color: "var(--text-primary)" }}>从哪里调出</h2>
      <p style={{ ...muted, margin: "0 0 12px" }}>金额最多按该账户最新余额计算；余额下降时会自动收紧模拟额度。</p>
      {accessible.length ? accessible.map((row) => <button key={`${row.account.id}-${row.entryIndex}`} className="fv-row" onClick={() => onOpen(row.account.id)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "13px 2px", border: "none", borderTop: "1px solid var(--separator)", background: "transparent", textAlign: "left", cursor: "pointer", color: "var(--text-primary)" }}>
        <span style={{ flex: 1, minWidth: 0 }}><strong style={{ fontSize: 13.5 }}>{row.account.name}{row.entry.label ? ` · ${row.entry.label}` : ` · 第 ${row.entryIndex + 1} 笔`}</strong><br />
          <span style={muted}>{row.account.institution || row.account.type}{row.capped ? " · 设置额超过当前余额，已按余额计算" : ""}</span></span>
        <span style={{ fontWeight: 650, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmt(row.available)}</span>
        <span style={{ ...muted, minWidth: 84, textAlign: "right" }}>{row.arrivalDays === undefined ? "到账未填写" : row.arrivalDays === 0 ? "当天到账" : `${row.arrivalDays} 天到账`}</span>
      </button>) : <p style={muted}>还没有设置可调资金。进入任一账户详情，在“资金安排”里填写。</p>}
    </section>

    <section style={{ ...card, padding: phone ? 16 : 22 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 5px", color: "var(--text-primary)" }}>到期与转存</h2>
      <p style={{ ...muted, margin: "0 0 12px" }}>已有 {maturities.length} 笔资金填写到期日，其中 {alerts.length} 笔已进入提醒期。到期后是否变为活期，请以实际产品条款为准。</p>
      {maturities.length ? maturities.map((row) => {
        const left = row.remainingDays!;
        const tone = left < 0 ? "已过期" : left === 0 ? "今天到期" : left <= row.remindDays ? `还剩 ${left} 天 · 需关注转存` : `还剩 ${left} 天`;
        return <button key={`${row.account.id}-${row.entryIndex}`} className="fv-row" onClick={() => onOpen(row.account.id)}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "13px 2px", border: "none", borderTop: "1px solid var(--separator)", background: "transparent", textAlign: "left", cursor: "pointer", color: "var(--text-primary)" }}>
          <span style={{ flex: 1, minWidth: 0 }}><strong style={{ fontSize: 13.5 }}>{row.account.name}{row.entry.label ? ` · ${row.entry.label}` : ` · 第 ${row.entryIndex + 1} 笔`}</strong><br />
            <span style={muted}>{row.entry.depositedOn ? `存入 ${row.entry.depositedOn} · ` : ""}到期 {row.entry.maturesOn}{row.termDays !== undefined ? ` · 存期 ${row.termDays} 天` : ""}</span></span>
          <span style={{ fontSize: 12, fontWeight: left <= row.remindDays ? 650 : 500, color: left <= row.remindDays ? "var(--orange)" : "var(--text-secondary)", whiteSpace: "nowrap" }}>{tone}</span>
        </button>;
      }) : <p style={muted}>还没有设置到期日。可在账户详情里填写存入日、到期日和提前提醒天数。</p>}
    </section>
  </div>;
}

/** 一个账户可以有多笔资金，各自填写到账时间和到期日。 */
export function AccountLiquidityCard({ account, balance, onSave }: {
  account: AccountMeta;
  balance: number;
  onSave: (plans: LiquidityPlan[] | undefined) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<{
    label: string; amount: string; arrivalDays: string; depositedOn: string; maturesOn: string; remindDays: string;
  }[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const blank = () => ({ label: "", amount: "", arrivalDays: "", depositedOn: "", maturesOn: "", remindDays: "" });

  useEffect(() => {
    const plans = Array.isArray(account.liquidity) ? account.liquidity : [];
    setDrafts(plans.length ? plans.map((p) => ({
      label: p.label ?? "", amount: p.amount === undefined ? "" : String(p.amount),
      arrivalDays: p.arrivalDays === undefined ? "" : String(p.arrivalDays),
      depositedOn: p.depositedOn ?? "", maturesOn: p.maturesOn ?? "",
      remindDays: p.remindDays === undefined ? "" : String(p.remindDays),
    })) : [blank()]);
    setEditing(false); setMessage("");
  }, [account.id]);

  const change = (index: number, field: keyof ReturnType<typeof blank>, value: string) =>
    setDrafts((current) => current.map((draft, i) => i === index ? { ...draft, [field]: value } : draft));
  const save = async () => {
    const toNumber = (s: string) => s.trim() === "" ? undefined : Number(s);
    const plans: LiquidityPlan[] = drafts.map((draft) => ({
      label: draft.label.trim() || undefined, amount: toNumber(draft.amount), arrivalDays: toNumber(draft.arrivalDays),
      depositedOn: draft.depositedOn || undefined, maturesOn: draft.maturesOn || undefined,
      remindDays: toNumber(draft.remindDays),
    })).filter((plan) => Object.values(plan).some((v) => v !== undefined));
    for (const [index, plan] of plans.entries()) {
      const problem = validateLiquidityPlan(plan);
      if (problem) { setMessage(`第 ${index + 1} 笔：${problem}`); return; }
    }
    const total = plans.reduce((sum, plan) => sum + (plan.amount ?? 0), 0);
    if (total > 0 && (account.cat === "debt" || balance <= 0)) { setMessage("负债或余额非正的账户不能设置可调金额"); return; }
    if (total > balance) { setMessage("各笔可调金额之和不能超过当前余额"); return; }
    setSaving(true); setMessage("");
    try { await onSave(plans.length ? plans : undefined); setEditing(false); setMessage("已保存到加密金库"); }
    catch { setMessage("保存失败，请重试"); }
    finally { setSaving(false); }
  };

  const plans = Array.isArray(account.liquidity) ? account.liquidity : [];
  const total = plans.reduce((sum, plan) => sum + (plan.amount ?? 0), 0);
  return <section style={{ ...card, padding: "18px 22px", marginBottom: 18 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <div style={{ flex: 1 }}><strong style={{ fontSize: 14, color: "var(--text-primary)" }}>资金安排</strong><div style={muted}>每笔资金可单独设置到账、存期和转存提醒；只用于模拟，不改变真实余额。</div></div>
      <Btn variant="soft" onClick={() => { setEditing((v) => !v); setMessage(""); }}>{editing ? "收起" : plans.length ? "修改安排" : "设置安排"}</Btn>
    </div>
    {!editing && <div style={{ ...muted, marginTop: 12 }}>
      {plans.length ? <>已安排 {plans.length} 笔 · 可调 {fmt(Math.min(total, Math.max(0, balance)))}
        {plans.map((plan, i) => <div key={i}>{plan.label || `第 ${i + 1} 笔`}：{plan.amount === undefined ? "金额未填" : fmt(plan.amount)} · {plan.arrivalDays === undefined ? "到账未填" : plan.arrivalDays === 0 ? "当天到账" : `${plan.arrivalDays} 天到账`}{plan.maturesOn ? ` · ${plan.maturesOn} 到期` : ""}</div>)}</> : "尚未设置；此账户不会计入可调资金汇总。"}
    </div>}
    {editing && <div style={{ marginTop: 16 }}>
      {drafts.map((draft, index) => <div key={index} style={{ borderTop: "1px solid var(--separator)", padding: "14px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <strong style={{ fontSize: 13 }}>第 {index + 1} 笔</strong>
          <Btn variant="ghost" onClick={() => setDrafts((current) => current.filter((_, i) => i !== index))}>移除这笔</Btn>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "0 12px" }}>
          <Field label="资金名称（可留空）"><TextField value={draft.label} onChange={(e) => change(index, "label", e.target.value)} placeholder="例如三年定存" /></Field>
          <Field label="可调金额（元，可留空）"><TextField type="number" min="0" step="0.01" value={draft.amount} onChange={(e) => change(index, "amount", e.target.value)} placeholder="由你评估" /></Field>
          <Field label="申请后几天到账（可留空）"><TextField type="number" min="0" step="1" value={draft.arrivalDays} onChange={(e) => change(index, "arrivalDays", e.target.value)} placeholder="0 = 当天" /></Field>
          <Field label="存入日期（可留空）"><TextField type="date" value={draft.depositedOn} onChange={(e) => change(index, "depositedOn", e.target.value)} /></Field>
          <Field label="到期日期（可留空）"><TextField type="date" value={draft.maturesOn} onChange={(e) => change(index, "maturesOn", e.target.value)} /></Field>
          <Field label="提前提醒天数（默认 30 天）"><TextField type="number" min="0" step="1" value={draft.remindDays} onChange={(e) => change(index, "remindDays", e.target.value)} placeholder="30" /></Field>
        </div>
      </div>)}
      <Btn variant="soft" onClick={() => setDrafts((current) => [...current, blank()])}>添加一笔资金</Btn>
      {message && <p role="status" style={{ fontSize: 12, color: message.startsWith("已") ? "var(--green)" : "var(--red)" }}>{message}</p>}
      <div style={{ marginTop: 14 }}><Btn onClick={save} disabled={saving}>{saving ? "保存中…" : "保存全部安排"}</Btn></div>
    </div>}
    {!editing && message && <p role="status" style={{ ...muted, color: "var(--green)" }}>{message}</p>}
  </section>;
}
