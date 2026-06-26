import React, { useMemo, useRef, useState } from "react";
import type { CompanyInfo, DevData, Invoice, ReimburseStatus, TaxFiling } from "../../types";
import { useVault } from "../../lib/vault";
import { Btn, TextField, TextArea, Select, Segmented, card, inputStyle, EmptyState } from "../../ui";
import { IconPlus, IconSearch, IconGear, IconClose, IconCopy, IconCheck, IconReceipt, IconBuilding, IconImport } from "../../icons";
import { uid } from "./shared";
import { fmtMoney, daysUntil, dateTone, toneColor, CURRENCIES, type Tone } from "../../lib/accounts";
import {
  INVOICE_CATEGORIES, INVOICE_EMOJI, STATUS_META, STATUS_ORDER, TAX_CYCLE_LABEL,
  invoiceSummary, joinMoney, taxAlerts, stalePending,
} from "../../lib/invoices";

type Mut = (fn: (d: DevData) => void) => void;
type View = "invoices" | "company";

const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const fmtDate = (s?: string) => { if (!s) return "—"; const p = s.split("-"); return p.length === 3 ? `${+p[1]}/${+p[2]}` : s; };

/** 读图 + 压缩成 jpeg data URL（长边 ≤ 1400），失败则退回原图。 */
async function fileToDataURL(file: File, max = 1400, quality = 0.82): Promise<string> {
  const raw = await new Promise<string>((res, rej) => {
    const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = () => rej(new Error("read")); r.readAsDataURL(file);
  });
  return await new Promise<string>((res) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      if (scale >= 1 && file.size < 400_000) return res(raw);
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const ctx = c.getContext("2d"); if (!ctx) return res(raw);
      ctx.drawImage(img, 0, 0, w, h);
      try { res(c.toDataURL("image/jpeg", quality)); } catch { res(raw); }
    };
    img.onerror = () => res(raw);
    img.src = raw;
  });
}

export default function Company({ data, mut }: { data: DevData; mut: Mut }) {
  const [view, setView] = useState<View>("invoices");
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Segmented<View> value={view} onChange={setView} style={{ width: 280 }}
          options={[{ value: "invoices", label: "发票报销" }, { value: "company", label: "公司 · 税务" }]} />
      </div>
      {view === "invoices" ? <Invoices data={data} mut={mut} /> : <CompanyTax data={data} mut={mut} />}
    </div>
  );
}

// ── 发票 / 报销清单 ──────────────────────────────────────────
function Invoices({ data, mut }: { data: DevData; mut: Mut }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<ReimburseStatus | "all">("all");
  const [edit, setEdit] = useState<Invoice | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const all = data.invoices ?? [];
  const summary = useMemo(() => invoiceSummary(all), [all]);
  const tax = useMemo(() => taxAlerts(data.taxFilings ?? []), [data.taxFilings]);
  const stale = useMemo(() => stalePending(all), [all]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: all.length, pending: 0, submitted: 0, paid: 0 };
    for (const v of all) c[v.status]++;
    return c;
  }, [all]);

  const ql = q.trim().toLowerCase();
  const list = all
    .filter((v) => filter === "all" || v.status === filter)
    .filter((v) => !ql || `${v.purpose ?? ""} ${v.category ?? ""} ${v.seller ?? ""} ${v.handler ?? ""} ${v.invoiceNo ?? ""} ${v.note ?? ""}`.toLowerCase().includes(ql))
    .sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.createdAt - a.createdAt);

  const save = (v: Invoice) => { mut((d) => { if (!d.invoices) d.invoices = []; const i = d.invoices.findIndex((x) => x.id === v.id); if (i >= 0) d.invoices[i] = { ...v, updatedAt: Date.now() }; else d.invoices.unshift(v); }); setEdit(null); };
  const del = (id: string) => { mut((d) => { d.invoices = (d.invoices ?? []).filter((x) => x.id !== id); }); setEdit(null); };
  const cycleStatus = (v: Invoice) => mut((d) => {
    const cur = (d.invoices ?? []).find((x) => x.id === v.id); if (!cur) return;
    cur.status = STATUS_ORDER[(STATUS_ORDER.indexOf(cur.status) + 1) % STATUS_ORDER.length];
    cur.updatedAt = Date.now();
  });
  const newInvoice = () => setEdit({ id: uid("inv"), date: todayStr(), amount: 0, currency: "¥", category: "", purpose: "", status: "pending", createdAt: Date.now(), updatedAt: Date.now() });

  const FILTERS: { v: ReimburseStatus | "all"; label: string }[] = [
    { v: "all", label: "全部" }, { v: "pending", label: "待报销" }, { v: "submitted", label: "已报销" }, { v: "paid", label: "已到账" },
  ];

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {FILTERS.map((f) => {
            const active = filter === f.v;
            const col = f.v === "all" ? "var(--text-primary)" : STATUS_META[f.v].color;
            return (
              <button key={f.v} className="fv-tap" onClick={() => setFilter(f.v)} style={{
                border: "0.5px solid " + (active ? "transparent" : "var(--separator)"), cursor: "pointer", fontSize: 12.5, fontWeight: 600,
                padding: "7px 12px", borderRadius: 9, whiteSpace: "nowrap",
                color: active ? (f.v === "all" ? "var(--bg-elevated)" : "#fff") : "var(--text-secondary)",
                background: active ? (f.v === "all" ? "var(--text-primary)" : col) : "var(--bg-elevated)",
              }}>{f.label}<span style={{ marginLeft: 6, opacity: 0.7, fontVariantNumeric: "tabular-nums" }}>{counts[f.v]}</span></button>
            );
          })}
        </div>
        <div style={{ flex: 1, minWidth: 160, display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 12px", borderRadius: 10, background: "var(--fill-q)", border: "0.5px solid var(--separator)" }}>
          <IconSearch /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索用途 / 类别 / 经手人 / 发票号" style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 13, color: "var(--text-primary)" }} />
        </div>
        <Btn onClick={newInvoice}><IconPlus size={15} />记一张发票</Btn>
      </div>

      {/* 一眼看到：待报销 / 待到账 / 本月 + 提醒 */}
      {all.length > 0 && (
        <div style={{ ...card, padding: "13px 16px", marginBottom: 14, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 18 }}>
          <Stat label="待报销" value={joinMoney(summary.pending, fmtMoney)} sub={`${summary.pendingCount} 张`} color="var(--orange)" />
          <div style={{ width: 1, height: 26, background: "var(--separator)" }} />
          <Stat label="已报销 · 待到账" value={joinMoney(summary.submitted, fmtMoney)} sub={`${summary.submittedCount} 张`} color="var(--accent)" />
          <div style={{ width: 1, height: 26, background: "var(--separator)" }} />
          <Stat label="本月开票" value={joinMoney(summary.month, fmtMoney)} sub={`${summary.monthCount} 张`} color="var(--text-primary)" />
          {(tax.length > 0 || stale) && <div style={{ flex: 1 }} />}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {stale && <Chip tone="warn" label="待报销" text={`有 ${stale.count} 张压了 ${stale.oldestDays} 天`} />}
            {tax.slice(0, 3).map((al, i) => <Chip key={i} tone={al.tone} label={al.label} text={al.text} />)}
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState icon={<IconReceipt size={26} stroke="var(--text-tertiary)" />}
          title={q || filter !== "all" ? "没有符合的发票" : "还没有发票记录"}
          text={q || filter !== "all" ? undefined : "把每天每次报销的发票记在这：金额、用途、经手人、报销到哪一步，能贴张发票照片就更省心。"}
          action={!q && filter === "all" && <Btn onClick={newInvoice}><IconPlus size={15} />记一张发票</Btn>} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map((v) => {
            const sm = STATUS_META[v.status];
            return (
              <div key={v.id} className="fv-card-int" style={{ ...card, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                {v.photo
                  ? <button onClick={() => setLightbox(v.photo!)} title="查看发票" style={{ padding: 0, border: "none", background: "none", cursor: "zoom-in", flex: "none" }}><img src={v.photo} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover", display: "block", border: "0.5px solid var(--separator)" }} /></button>
                  : <span style={{ width: 40, height: 40, borderRadius: 8, background: "var(--fill-q)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flex: "none" }}>{INVOICE_EMOJI[v.category ?? ""] ?? "🧾"}</span>}
                <div style={{ width: 50, flex: "none", fontSize: 12.5, color: "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}>{fmtDate(v.date)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.purpose || v.category || "（未填用途）"}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {[v.category, v.handler && `经手 ${v.handler}`, v.seller, v.invoiceNo && `No.${v.invoiceNo}`].filter(Boolean).join("  ·  ") || "—"}
                  </div>
                </div>
                <div style={{ fontSize: 15.5, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums", flex: "none" }}>{fmtMoney(v.amount, v.currency)}</div>
                <button className="fv-tap" onClick={() => cycleStatus(v)} title="点一下切换：待报销 → 已报销 → 已到账" style={{ flex: "none", border: "none", cursor: "pointer", fontSize: 11.5, fontWeight: 700, color: sm.color, background: `color-mix(in srgb, ${sm.color} 14%, transparent)`, padding: "5px 0", borderRadius: 7, width: 62, textAlign: "center" }}>{sm.label}</button>
                <button className="fv-icnbtn" onClick={() => setEdit(v)} title="编辑" style={icnBtn}><IconGear size={14} stroke="currentColor" /></button>
              </div>
            );
          })}
        </div>
      )}

      {edit && <InvoiceEditor key={edit.id} initial={edit} isNew={!all.some((x) => x.id === edit.id)} onClose={() => setEdit(null)} onSave={save} onDelete={() => del(edit.id)} />}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: "fixed", inset: 0, zIndex: 95, background: "rgba(0,0,0,0.82)", display: "flex", alignItems: "center", justifyContent: "center", padding: 30, cursor: "zoom-out", animation: "fvFade .15s ease" }}>
          <img src={lightbox} alt="发票" style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 10, boxShadow: "0 10px 40px rgba(0,0,0,0.5)" }} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginBottom: 3 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: 19, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{value}</span>
        <span style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>{sub}</span>
      </div>
    </div>
  );
}
function Chip({ tone, label, text }: { tone: Tone; label: string; text: string }) {
  const c = toneColor(tone);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: c, background: `color-mix(in srgb, ${c} 12%, transparent)`, padding: "3px 9px", borderRadius: 7 }}>
      <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>{label}</span>{text}
    </span>
  );
}

function InvoiceEditor({ initial, isNew, onClose, onSave, onDelete }: { initial: Invoice; isNew: boolean; onClose: () => void; onSave: (v: Invoice) => void; onDelete: () => void }) {
  const [v, setV] = useState<Invoice>(initial);
  const [amountStr, setAmountStr] = useState(initial.amount ? String(initial.amount) : "");
  const [taxStr, setTaxStr] = useState(initial.tax != null ? String(initial.tax) : "");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const num = (s: string): number | undefined => { const n = parseFloat(s); return isNaN(n) ? undefined : n; };
  const amount = num(amountStr);

  const onPick = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try { const url = await fileToDataURL(f); setV((p) => ({ ...p, photo: url })); } catch { /* ignore */ }
    setBusy(false);
  };
  const submit = () => onSave({ ...v, amount: amount ?? 0, tax: num(taxStr), purpose: v.purpose?.trim() || undefined });

  return (
    <Modal title={isNew ? "记一张发票" : "编辑发票"} onClose={onClose} footer={<>
      {!isNew && <Btn variant="danger" onClick={onDelete}>删除</Btn>}
      <div style={{ flex: 1 }} />
      <Btn variant="ghost" onClick={onClose}>取消</Btn>
      <Btn onClick={submit} disabled={!amount || amount <= 0}><IconCheck size={15} stroke="#fff" />保存</Btn>
    </>}>
      <Row>
        <L label="日期" flex={1}><input type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} style={{ ...inputStyle, height: 36, padding: "0 12px" }} /></L>
        <L label="金额（含税）" flex={1}><TextField value={amountStr} onChange={(e) => setAmountStr(e.target.value)} inputMode="decimal" placeholder="如 420" autoFocus /></L>
        <L label="币种" flex={0.7}><Select value={v.currency} onChange={(e) => setV({ ...v, currency: e.target.value })} options={CURRENCIES.map((c) => ({ value: c, label: c }))} /></L>
      </Row>
      <Row>
        <L label="类别" flex={1}>
          <input list="inv-cats" value={v.category ?? ""} onChange={(e) => setV({ ...v, category: e.target.value })} placeholder="选择或输入" style={{ ...inputStyle, height: 36, padding: "0 12px" }} />
          <datalist id="inv-cats">{INVOICE_CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
        </L>
        <L label="报销状态" flex={1.3}><Segmented<ReimburseStatus> value={v.status} onChange={(s) => setV({ ...v, status: s })} options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS_META[s].label }))} /></L>
      </Row>
      <L label="用途 / 事由"><TextField value={v.purpose ?? ""} onChange={(e) => setV({ ...v, purpose: e.target.value })} placeholder="比如：客户午餐、出差高铁、买打印纸" /></L>
      <Row>
        <L label="经手人" flex={1}><TextField value={v.handler ?? ""} onChange={(e) => setV({ ...v, handler: e.target.value || undefined })} placeholder="谁垫付 / 谁报销" /></L>
        <L label="发票号（选填）" flex={1}><TextField value={v.invoiceNo ?? ""} onChange={(e) => setV({ ...v, invoiceNo: e.target.value || undefined })} placeholder="可不填" /></L>
      </Row>
      <Row>
        <L label="开票方 / 抬头（选填）" flex={1}><TextField value={v.seller ?? ""} onChange={(e) => setV({ ...v, seller: e.target.value || undefined })} placeholder="可不填" /></L>
        <L label="税额（选填）" flex={1}><TextField value={taxStr} onChange={(e) => setTaxStr(e.target.value)} inputMode="decimal" placeholder="可不填" /></L>
      </Row>
      <L label="发票照片 / 截图（自动压缩，随保险库加密存本机）">
        {v.photo ? (
          <div style={{ position: "relative", display: "inline-block" }}>
            <img src={v.photo} alt="发票" style={{ maxWidth: 200, maxHeight: 200, borderRadius: 10, border: "0.5px solid var(--separator)", display: "block" }} />
            <button onClick={() => setV({ ...v, photo: undefined })} title="移除照片" style={{ position: "absolute", top: -9, right: -9, width: 24, height: 24, borderRadius: "50%", background: "var(--text-primary)", color: "var(--bg-elevated)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--shadow)" }}><IconClose size={13} stroke="currentColor" /></button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()} disabled={busy} className="fv-btn" style={{ display: "inline-flex", alignItems: "center", gap: 7, border: "0.5px dashed var(--separator)", background: "var(--fill-q)", color: "var(--text-secondary)", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: busy ? "default" : "pointer" }}>
            {busy ? "处理中…" : <><IconImport size={15} stroke="currentColor" />上传发票照片</>}
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { onPick(e.target.files?.[0]); e.currentTarget.value = ""; }} />
      </L>
      <L label="备注"><TextArea value={v.note ?? ""} onChange={(e) => setV({ ...v, note: e.target.value || undefined })} placeholder="附加说明，可不填" /></L>
    </Modal>
  );
}

// ── 公司资料 + 税务 ──────────────────────────────────────────
function CompanyTax({ data, mut }: { data: DevData; mut: Mut }) {
  const { copy } = useVault();
  const info = data.company ?? {};
  const filings = data.taxFilings ?? [];
  const [editInfo, setEditInfo] = useState(false);
  const [editTax, setEditTax] = useState<TaxFiling | null>(null);
  const hasInfo = !!(info.name || info.taxId || info.legalPerson || info.address || info.bank || info.bankAccount || info.phone || info.note);

  const saveInfo = (c: CompanyInfo) => { mut((d) => { d.company = c; }); setEditInfo(false); };
  const saveTax = (f: TaxFiling) => { mut((d) => { if (!d.taxFilings) d.taxFilings = []; const i = d.taxFilings.findIndex((x) => x.id === f.id); if (i >= 0) d.taxFilings[i] = f; else d.taxFilings.push(f); }); setEditTax(null); };
  const delTax = (id: string) => { mut((d) => { d.taxFilings = (d.taxFilings ?? []).filter((x) => x.id !== id); }); setEditTax(null); };
  const newTax = () => setEditTax({ id: uid("tax"), name: "", cycle: "month", nextDate: "" });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 16, alignItems: "start" }}>
      {/* 公司资料 */}
      <div style={{ ...card, padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: hasInfo ? 16 : 0 }}>
          <span style={{ width: 34, height: 34, borderRadius: 9, background: "color-mix(in srgb, var(--accent) 14%, transparent)", display: "flex", alignItems: "center", justifyContent: "center" }}><IconBuilding size={18} stroke="var(--accent)" /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{info.name || "公司资料"}</div>
            <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 1 }}>{hasInfo ? "税号、开户行等都收在这" : "还没填"}</div>
          </div>
          <button className="fv-icnbtn" onClick={() => setEditInfo(true)} title="编辑" style={icnBtn}><IconGear size={15} stroke="currentColor" /></button>
        </div>
        {hasInfo ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {info.taxId && <InfoRow label="税号" value={info.taxId} onCopy={() => copy(info.taxId!, "税号")} mono />}
            {info.legalPerson && <InfoRow label="法人" value={info.legalPerson} />}
            {info.address && <InfoRow label="地址" value={info.address} />}
            {info.bank && <InfoRow label="开户行" value={info.bank} />}
            {info.bankAccount && <InfoRow label="银行账号" value={info.bankAccount} onCopy={() => copy(info.bankAccount!, "账号")} mono />}
            {info.phone && <InfoRow label="电话" value={info.phone} onCopy={() => copy(info.phone!, "电话")} />}
            {info.note && <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 3, lineHeight: 1.6 }}>{info.note}</div>}
          </div>
        ) : (
          <div style={{ marginTop: 14 }}>
            <Btn variant="soft" onClick={() => setEditInfo(true)}><IconPlus size={15} />填写公司信息</Btn>
          </div>
        )}
      </div>

      {/* 税务申报 */}
      <div style={{ ...card, padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>税务申报</div>
          <div style={{ flex: 1 }} />
          <button className="fv-tap" onClick={newTax} style={{ display: "inline-flex", alignItems: "center", gap: 4, border: "none", background: "transparent", color: "var(--accent)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 0 }}><IconPlus size={14} stroke="currentColor" />新增</button>
        </div>
        {filings.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", lineHeight: 1.7 }}>把要按时报的税记在这（增值税、企业所得税…），到点了首页和这里都会提醒。</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filings.map((f) => {
              const days = daysUntil(f.nextDate);
              const t = dateTone(days);
              return (
                <button key={f.id} onClick={() => setEditTax(f)} className="fv-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 9, border: "0.5px solid var(--separator)", background: "var(--fill-q)", cursor: "pointer", textAlign: "left", width: "100%" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{f.name || "未命名"}</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 1 }}>{TAX_CYCLE_LABEL[f.cycle]}申报{f.nextDate ? ` · 截止 ${f.nextDate}` : ""}</div>
                  </div>
                  {f.nextDate && <span style={{ fontSize: 11.5, fontWeight: 600, color: toneColor(t.tone), flex: "none" }}>{days != null && days < 0 ? `逾期 ${-days} 天` : t.text}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {editInfo && <CompanyInfoEditor initial={info} onClose={() => setEditInfo(false)} onSave={saveInfo} />}
      {editTax && <TaxEditor key={editTax.id} initial={editTax} isNew={!filings.some((x) => x.id === editTax.id)} onClose={() => setEditTax(null)} onSave={saveTax} onDelete={() => delTax(editTax.id)} />}
    </div>
  );
}

function CompanyInfoEditor({ initial, onClose, onSave }: { initial: CompanyInfo; onClose: () => void; onSave: (c: CompanyInfo) => void }) {
  const [c, setC] = useState<CompanyInfo>(initial);
  const set = (k: keyof CompanyInfo) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setC({ ...c, [k]: e.target.value || undefined });
  return (
    <Modal title="公司资料" onClose={onClose} footer={<><div style={{ flex: 1 }} /><Btn variant="ghost" onClick={onClose}>取消</Btn><Btn onClick={() => onSave(c)}><IconCheck size={15} stroke="#fff" />保存</Btn></>}>
      <L label="公司名称"><TextField value={c.name ?? ""} onChange={set("name")} placeholder="某某科技有限公司" autoFocus /></L>
      <Row>
        <L label="统一社会信用代码 / 税号" flex={1.5}><TextField value={c.taxId ?? ""} onChange={set("taxId")} placeholder="91xxxxxxxxxxxxxxxx" style={{ fontFamily: "ui-monospace, monospace" }} /></L>
        <L label="法人" flex={1}><TextField value={c.legalPerson ?? ""} onChange={set("legalPerson")} placeholder="姓名" /></L>
      </Row>
      <L label="注册地址"><TextField value={c.address ?? ""} onChange={set("address")} placeholder="可选" /></L>
      <Row>
        <L label="开户行" flex={1.3}><TextField value={c.bank ?? ""} onChange={set("bank")} placeholder="某银行某支行" /></L>
        <L label="联系电话" flex={1}><TextField value={c.phone ?? ""} onChange={set("phone")} placeholder="可选" /></L>
      </Row>
      <L label="银行账号"><TextField value={c.bankAccount ?? ""} onChange={set("bankAccount")} placeholder="对公账号" style={{ fontFamily: "ui-monospace, monospace" }} /></L>
      <L label="备注"><TextArea value={c.note ?? ""} onChange={set("note")} placeholder="发票抬头要点、专管员、注意事项…" /></L>
    </Modal>
  );
}

function TaxEditor({ initial, isNew, onClose, onSave, onDelete }: { initial: TaxFiling; isNew: boolean; onClose: () => void; onSave: (f: TaxFiling) => void; onDelete: () => void }) {
  const [f, setF] = useState<TaxFiling>(initial);
  return (
    <Modal title={isNew ? "新增申报事项" : "编辑申报事项"} width={460} onClose={onClose} footer={<>
      {!isNew && <Btn variant="danger" onClick={onDelete}>删除</Btn>}
      <div style={{ flex: 1 }} />
      <Btn variant="ghost" onClick={onClose}>取消</Btn>
      <Btn onClick={() => onSave({ ...f, name: f.name.trim() })} disabled={!f.name.trim()}><IconCheck size={15} stroke="#fff" />保存</Btn>
    </>}>
      <L label="税种 / 事项"><TextField value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="增值税 / 企业所得税 / 社保公积金" autoFocus /></L>
      <Row>
        <L label="申报周期" flex={1}><Select value={f.cycle} onChange={(e) => setF({ ...f, cycle: e.target.value as TaxFiling["cycle"] })} options={[{ value: "month", label: "月度" }, { value: "quarter", label: "季度" }, { value: "year", label: "年度" }]} /></L>
        <L label="下次截止日" flex={1}><input type="date" value={f.nextDate ?? ""} onChange={(e) => setF({ ...f, nextDate: e.target.value || undefined })} style={{ ...inputStyle, height: 36, padding: "0 12px" }} /></L>
      </Row>
      <L label="备注"><TextArea value={f.note ?? ""} onChange={(e) => setF({ ...f, note: e.target.value || undefined })} placeholder="可选" /></L>
    </Modal>
  );
}

// ── 共用小组件 ──────────────────────────────────────────────
function Modal({ title, onClose, children, footer, width = 580 }: { title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode; width?: number }) {
  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.34)", backdropFilter: "blur(2px)", animation: "fvFade .15s ease" }}>
      <div style={{ ...card, width, maxWidth: "92%", maxHeight: "90%", display: "flex", flexDirection: "column", overflow: "hidden", animation: "fvPop .18s ease" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "14px 20px", borderBottom: "0.5px solid var(--separator)" }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div><div style={{ flex: 1 }} />
          <button className="fv-icnbtn" onClick={onClose} style={icnBtn}><IconClose size={17} stroke="currentColor" /></button>
        </div>
        <div style={{ padding: "16px 20px", overflowY: "auto" }}>{children}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 20px", borderTop: "0.5px solid var(--separator)" }}>{footer}</div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, onCopy, mono }: { label: string; value: string; onCopy?: () => void; mono?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--fill-q)", border: "0.5px solid var(--separator)", borderRadius: 8, padding: "6px 9px" }}>
      <span style={{ fontSize: 11.5, color: "var(--text-tertiary)", width: 64, flex: "none" }}>{label}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: mono ? "ui-monospace, Menlo, monospace" : undefined }}>{value}</span>
      {onCopy && <button className="fv-icnbtn" onClick={onCopy} title="复制" style={icnBtn}><IconCopy size={13} stroke="currentColor" /></button>}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) { return <div style={{ display: "flex", gap: 12 }}>{children}</div>; }
function L({ label, children, flex }: { label: string; children: React.ReactNode; flex?: number }) {
  return (
    <label style={{ display: "block", marginBottom: 12, flex: flex ?? "1 1 100%", minWidth: 0 }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-tertiary)", marginBottom: 5, letterSpacing: ".02em" }}>{label}</div>
      {children}
    </label>
  );
}

const icnBtn: React.CSSProperties = { width: 28, height: 28, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 7, background: "transparent", border: "none", cursor: "pointer", color: "var(--text-tertiary)" };
