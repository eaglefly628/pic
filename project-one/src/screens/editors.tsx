import React, { useState } from "react";
import type { AccountMeta, Category } from "../data/types";
import type { AccountInput } from "../vault/ops";
import { Btn, Field, Modal, Select, Switch, TextField } from "../ui";

const CATS: { value: Category; label: string }[] = [
  { value: "liquid", label: "流动资金" },
  { value: "invest", label: "投资理财" },
  { value: "estate", label: "家庭房产" },
  { value: "fixed", label: "家庭其他固定资产" },
  { value: "debt", label: "负债" },
];
/** 家族信托是可选功能（设置里开），没开时分组列表里不出现 */
const TRUST_CAT = { value: "trust" as Category, label: "家族信托" };
const COMPS = ["现金及银行", "股票", "理财/固收", "基金", "黄金", "房产", "养老金", "公积金", "家族信托", "其他固定资产", "负债", "其他"].map((v) => ({ value: v, label: v }));
const OWNERS = ["本人", "配偶", "全家", "父亲", "母亲", "孩子"];
/** 锁定期预设。家族信托常见 2 年起，所以默认给 2 年。 */
const LOCKS = [
  { value: "0", label: "不锁定" }, { value: "6", label: "6 个月" }, { value: "12", label: "1 年" },
  { value: "24", label: "2 年" }, { value: "36", label: "3 年" }, { value: "60", label: "5 年" }, { value: "120", label: "10 年" },
];
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

export function AccountEditor({ open, initial, trustOn, onClose, onSubmit }: {
  open: boolean; initial?: AccountMeta & { comp?: string }; onClose: () => void;
  /** 「家族信托 / 独立运营资产」这个可选功能开没开（设置里控制）。没开就完全看不到这些字段。 */
  trustOn?: boolean;
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
  const [offBalance, setOffBalance] = useState(false);
  const [lockStart, setLockStart] = useState("");
  const [lockMonths, setLockMonths] = useState("0");

  React.useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? ""); setCat(initial?.cat ?? "liquid");
    setComp(initial?.comp ?? initial?.type ?? "现金及银行"); setInstitution(initial?.institution ?? ""); setOwner(initial?.owner ?? "本人");
    setColor(initial?.color ?? PALETTE[0]); setBalance("");
    setRatePct(initial?.rate != null ? String(+(initial.rate * 100).toFixed(4)) : "");
    setOffBalance(!!initial?.offBalance);
    setLockStart(initial?.lockStart ?? "");
    setLockMonths(String(initial?.lockMonths ?? 0));
  }, [open, initial]);

  // 选到「家族信托」时给一套常见默认：独立运营 + 今天起锁 2 年。手动改过就不再覆盖。
  const pickCat = (v: Category) => {
    setCat(v);
    if (v === "trust" && !initial?.offBalance) {
      setOffBalance(true);
      if (comp === "现金及银行") setComp("家族信托");
      if (!lockStart) setLockStart(localISO(new Date()));
      if (lockMonths === "0") setLockMonths("24");
    }
  };

  const months = Number(lockMonths) || 0;
  // 编辑老数据时，存着的期限可能不在预设里（比如从别处导入的 18 个月），补一个选项进去
  const lockOpts = LOCKS.some((o) => o.value === lockMonths) ? LOCKS : [{ value: lockMonths, label: `${months} 个月` }, ...LOCKS];
  const showTrust = !!trustOn && (cat === "trust" || offBalance);

  const submit = () => {
    if (!name.trim()) return;
    onSubmit(
      {
        name: name.trim(), cat, type: comp, comp, institution: institution.trim() || "—", owner: owner.trim() || "全家",
        color, rate: (parseFloat(ratePct) || 0) / 100,
        // 功能没开时不写这些字段，免得关着开关也悄悄往数据里塞东西
        ...(trustOn ? { offBalance, lockStart: months > 0 ? lockStart || undefined : undefined, lockMonths: months || undefined } : {}),
      },
      parseNum(balance)
    );
    onClose();
  };

  return (
    <Modal open={open} title={editing ? "编辑账户" : "新增账户"} onClose={onClose}
      footer={<><Btn variant="ghost" onClick={onClose}>取消</Btn><Btn onClick={submit}>{editing ? "保存" : "添加"}</Btn></>}>
      <Field label="账户名称"><TextField value={name} onChange={(e) => setName(e.target.value)} placeholder="如 招商银行储蓄卡" autoFocus /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="分组"><Select value={cat} options={trustOn ? [...CATS, TRUST_CAT] : CATS} onChange={(e) => pickCat(e.target.value as Category)} /></Field>
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

      {showTrust && (
        <div style={{ marginTop: 4, padding: "13px 14px", borderRadius: 11, background: "var(--fill-quaternary)", border: "0.5px solid var(--separator)" }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>独立运营设定</div>
          <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", lineHeight: 1.7, marginBottom: 12 }}>
            家族信托这类资产通常独立于家庭日常收支运作，也不方便随时动用。打开后它不进净资产、总资产/负债和资产构成，在仪表盘「独立运营资产」里单独列示；账户列表和利息预测里照常能看到。
          </div>
          <div style={{ marginBottom: 12 }}>
            <Switch checked={offBalance} onChange={setOffBalance} label="不计入家庭总资产" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="锁定期"><Select value={lockMonths} options={lockOpts} onChange={(e) => {
              setLockMonths(e.target.value);
              if (e.target.value !== "0" && !lockStart) setLockStart(localISO(new Date()));
            }} /></Field>
            {months > 0 && <Field label="锁定起始日"><TextField type="date" value={lockStart} onChange={(e) => setLockStart(e.target.value)} /></Field>}
          </div>
          {months > 0 && lockStart && (
            <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: -6 }}>
              解锁日 <strong style={{ fontVariantNumeric: "tabular-nums" }}>{unlockDate(lockStart, months)}</strong>
              <span style={{ color: "var(--text-tertiary)" }}> · 到期前只提示，不会锁住任何操作</span>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

/** 起始日 + 月数 → 解锁日（「1月31日 + 1个月」夹到 2 月最后一天，不溢出到 3 月） */
function unlockDate(startISO: string, months: number): string {
  const d = new Date(startISO + "T00:00:00");
  if (isNaN(d.getTime())) return "—";
  const day = d.getDate();
  const t = new Date(d.getFullYear(), d.getMonth() + months, 1);
  t.setDate(Math.min(day, new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()));
  return localISO(t);
}

/** 本地时区的 YYYY-MM-DD。不能用 toISOString——那是 UTC，
 *  在 UTC+8 的凌晨会算成前一天，默认日期就差一天。 */
function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
/** 某月最后一天 */
function monthEnd(year: number, monthIdx: number): Date {
  return new Date(year, monthIdx + 1, 0);
}

export function SnapshotEditor({ open, accountName, recorded, onClose, onSubmit }: {
  open: boolean; accountName: string;
  /** 这个账户「确实记录过」的日期 → 当时余额。用来标出哪些月份漏了。 */
  recorded?: Map<string, number>;
  onClose: () => void; onSubmit: (date: string, amount: number) => void;
}) {
  const today = localISO(new Date());
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState("");
  const rec = recorded ?? new Map<string, number>();

  React.useEffect(() => { if (open) { setDate(today); setAmount(""); } }, [open, today]);

  // 最近 8 个月，标出哪几个月这个账户还没记过——「漏掉了哪一期」一眼能看出来
  const months = React.useMemo(() => {
    const now = new Date();
    const out: { key: string; label: string; date: string; hasDate?: string }[] = [];
    for (let i = 0; i < 8; i++) {
      const end = monthEnd(now.getFullYear(), now.getMonth() - i);
      const key = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}`;
      // 这个月里有没有已记录的日期（不一定正好是月末）
      const hit = [...rec.keys()].filter((d) => d.startsWith(key)).sort().pop();
      // 本月的「月末」还没到，钳到今天——否则会记出一条未来日期的快照
      const target = end > now ? now : end;
      out.push({ key, label: `${end.getMonth() + 1}月`, date: hit ?? localISO(target), hasDate: hit });
    }
    return out;
  }, [rec, open]);

  const existing = rec.get(date);
  const missing = months.filter((m) => !m.hasDate).length;

  // 「跟上次一样」用的上一期：所选日期之前、最近一次确实记录过的余额。
  // 它跟「干脆不记」是两件事：不记 = 这期没看过（净值按结转算，但「最后更新」停在上一期）；
  // 记一笔跟上次一样 = 这期看过了、确认没变，「最后更新」会刷新到这一期。
  const prev = React.useMemo(() => {
    const before = [...rec.entries()].filter(([d]) => d < date).sort((a, b) => a[0].localeCompare(b[0]));
    return before.length ? before[before.length - 1] : null;
  }, [rec, date]);

  const submit = () => {
    if (!amount.trim()) return;
    onSubmit(date, parseNum(amount));
    onClose();
  };
  const sameAsLast = () => {
    if (!prev) return;
    onSubmit(date, prev[1]);
    onClose();
  };

  return (
    <Modal open={open} title={`新增快照 · ${accountName}`} onClose={onClose} width={420}
      footer={<><Btn variant="ghost" onClick={onClose}>取消</Btn><Btn onClick={submit}>{existing != null ? "覆盖这一期" : "添加"}</Btn></>}>

      {/* 补漏用：最近 8 个月哪些记过、哪些没记，点一下直接跳到那期 */}
      <div style={{ marginBottom: 13 }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>
          最近 8 个月{missing > 0 && <span style={{ color: "var(--orange)", fontWeight: 500 }}> · 有 {missing} 个月没记</span>}
        </span>
        <div className="fv-scroll" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
          {months.map((m) => {
            const on = date.startsWith(m.key);
            return (
              <button key={m.key} type="button" className="fv-tap" onClick={() => setDate(m.date)}
                title={m.hasDate ? `已记录 ${m.hasDate}` : "这个月还没记过"}
                style={{
                  flex: "none", minWidth: 52, padding: "6px 9px", borderRadius: 8, cursor: "pointer",
                  border: on ? "1px solid var(--accent)" : "0.5px solid var(--separator-strong)",
                  background: on ? "var(--accent-soft)" : m.hasDate ? "var(--fill-quaternary)" : "transparent",
                  color: on ? "var(--accent)" : m.hasDate ? "var(--text-secondary)" : "var(--orange)",
                  fontSize: 12, fontWeight: on ? 600 : 500, whiteSpace: "nowrap",
                }}>
                {m.label}{m.hasDate ? " ·" : " ○"}
              </button>
            );
          })}
        </div>
      </div>

      <Field label="日期（可以往前选，用来补记漏掉的月份）">
        <TextField type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
      </Field>
      {existing != null && (
        <div style={{ fontSize: 12, color: "var(--orange)", marginTop: -7, marginBottom: 13, lineHeight: 1.6 }}>
          这一期已经记过（{fmtPlain(existing)}），确认后会覆盖成新的数字。
        </div>
      )}

      {/* 一键「这期看过了，跟上次一样」——不用再把同一个数字敲一遍 */}
      {prev && (
        <div style={{ marginBottom: 13 }}>
          <button type="button" className="fv-tap" onClick={sameAsLast}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
              width: "100%", padding: "10px 12px", borderRadius: 10, cursor: "pointer",
              border: "1px solid var(--accent)", background: "var(--accent-soft)", color: "var(--accent)",
              fontSize: 13.5, fontWeight: 600, textAlign: "left",
            }}>
            <span>{existing != null ? "覆盖成跟上次一样" : "跟上次一样"} · {fmtPlain(prev[1])}</span>
            <span style={{ fontSize: 11.5, fontWeight: 500, color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>{mmdd(prev[0])} 记的</span>
          </button>
          <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", lineHeight: 1.6, marginTop: 6 }}>
            余额没变也点一下：这一期就算「看过、确认没变」，「最后更新」会记到这一期；跳过不记则停留在上一期。
          </div>
        </div>
      )}

      <Field label={prev ? "余额（变了就填这里）" : "余额（整数或小数均可）"}>
        <TextField value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder={prev ? `上次 ${fmtPlain(prev[1])}` : "如 50000"} inputMode="decimal" autoFocus />
      </Field>
    </Modal>
  );
}

/** 2026-08-31 → 8月31日 */
function mmdd(iso: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${Number(m[1])}月${Number(m[2])}日` : iso;
}

/** 提示里用的朴素金额（不带货币符号处理，够看即可） */
function fmtPlain(n: number): string {
  return "¥" + Math.round(n).toLocaleString("zh-CN");
}
