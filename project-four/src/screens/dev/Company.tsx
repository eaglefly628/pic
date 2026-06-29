import React, { useMemo, useRef, useState } from "react";
import type { CompanyInfo, DevData, Invoice } from "../../types";
import { useVault } from "../../lib/vault";
import { Btn, TextField, TextArea, Segmented, card, inputStyle, EmptyState } from "../../ui";
import { IconPlus, IconGear, IconClose, IconCopy, IconCheck, IconReceipt, IconBuilding, IconImport, IconTrash } from "../../icons";
import { uid } from "./shared";
import { INVOICE_CATEGORIES, INVOICE_EMOJI, groupByMonth, type MonthGroup } from "../../lib/invoices";
import { zipStore, dataUrlToBytes, isPdf } from "../../lib/zip";

type Mut = (fn: (d: DevData) => void) => void;
type View = "invoices" | "company";

const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const fmtDate = (s?: string) => { if (!s) return "—"; const p = s.split("-"); return p.length === 3 ? `${+p[1]}/${+p[2]}` : s; };

/** 读图 + 压缩成 jpeg data URL（长边 ≤ 1600），失败则退回原图。 */
async function fileToDataURL(file: File, max = 1600, quality = 0.85): Promise<string> {
  const raw = await new Promise<string>((res, rej) => {
    const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = () => rej(new Error("read")); r.readAsDataURL(file);
  });
  // PDF（及任何非图片）原样保存，不走 canvas——canvas 加载不了 PDF。
  if (file.type === "application/pdf" || !file.type.startsWith("image/")) return raw;
  return await new Promise<string>((res) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      if (scale >= 1 && file.size < 500_000) return res(raw);
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
        <Segmented<View> value={view} onChange={setView} style={{ width: 260 }}
          options={[{ value: "invoices", label: "发票" }, { value: "company", label: "公司资料" }]} />
      </div>
      {view === "invoices" ? <Invoices data={data} mut={mut} /> : <CompanyProfile data={data} mut={mut} />}
    </div>
  );
}

// ── 发票：上传 → 归类 → 按月归档 / 月底导出 ──────────────────────
function Invoices({ data, mut }: { data: DevData; mut: Mut }) {
  const [cat, setCat] = useState<string>("");          // "" = 全部
  const [edit, setEdit] = useState<Invoice | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const all = data.invoices ?? [];
  const cats = useMemo(() => {
    const present = new Set(all.map((v) => v.category || "").filter(Boolean));
    return [...INVOICE_CATEGORIES.filter((c) => present.has(c)), ...[...present].filter((c) => !INVOICE_CATEGORIES.includes(c))];
  }, [all]);
  const filtered = cat ? all.filter((v) => (v.category || "") === cat) : all;
  const groups = useMemo(() => groupByMonth(filtered), [filtered]);

  const addFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setBusy(true);
    const photos = await Promise.all(Array.from(files).map((f) => fileToDataURL(f).catch(() => undefined)));
    mut((d) => {
      if (!d.invoices) d.invoices = [];
      const now = Date.now();
      photos.forEach((p, i) => { if (!p) return; d.invoices.unshift({ id: uid("inv"), date: todayStr(), photo: p, category: cat || undefined, createdAt: now + i, updatedAt: now + i }); });
    });
    setBusy(false);
  };
  const save = (v: Invoice) => { mut((d) => { const i = (d.invoices ?? []).findIndex((x) => x.id === v.id); if (i >= 0) d.invoices[i] = { ...v, updatedAt: Date.now() }; }); setEdit(null); };
  const del = (id: string) => { mut((d) => { d.invoices = (d.invoices ?? []).filter((x) => x.id !== id); }); setEdit(null); };

  // 打包本月所有发票成一个 zip，一次下载（图片 + PDF 都行）。
  const exportMonth = (g: MonthGroup) => {
    const safe = (s: string) => s.replace(/[\\/:*?"<>|\n]/g, "_").trim();
    const files: { name: string; data: Uint8Array }[] = [];
    g.items.forEach((v, i) => {
      if (!v.photo) return;
      const { bytes, ext } = dataUrlToBytes(v.photo);
      const cat = safe(v.category || "未归类");
      const tail = safe(v.note || "").slice(0, 16);
      files.push({ name: `${g.ym}_${String(i + 1).padStart(2, "0")}_${cat}${tail ? "_" + tail : ""}.${ext}`, data: bytes });
    });
    if (!files.length) return;
    const blob = new Blob([zipStore(files) as BlobPart], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `发票_${g.ym}_${files.length}张.zip`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div>
      {/* 类别筛选（也是上传时的默认归类）+ 上传 */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1, minWidth: 0 }}>
          <CatChip active={cat === ""} onClick={() => setCat("")}>全部</CatChip>
          {cats.map((c) => <CatChip key={c} active={cat === c} onClick={() => setCat(c)}>{(INVOICE_EMOJI[c] ?? "🧾") + " " + c}</CatChip>)}
        </div>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple style={{ display: "none" }} onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = ""; }} />
        <Btn onClick={() => fileRef.current?.click()} disabled={busy}>{busy ? "上传中…" : <><IconImport size={15} stroke="#fff" />上传发票</>}</Btn>
      </div>

      {all.length === 0 ? (
        <EmptyState icon={<IconReceipt size={26} stroke="var(--text-tertiary)" />}
          title="还没有发票"
          text="把发票拍照、截图或 PDF 传上来，选个类别归好。到月底按月打包成 zip 一键导出，交给会计就行——不用在这填金额、记账。"
          action={<Btn onClick={() => fileRef.current?.click()}><IconImport size={15} stroke="#fff" />上传发票</Btn>} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<IconReceipt size={26} stroke="var(--text-tertiary)" />} title={`「${cat}」下还没有发票`} text="换个类别看看，或上传后归到这一类。" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {groups.map((g) => (
            <div key={g.ym}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text-primary)" }}>{g.label}</div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{g.items.length} 张</div>
                <div style={{ flex: 1 }} />
                <button className="fv-tap" onClick={() => exportMonth(g)} title="把本月发票打包成 zip 一次下载（图片 + PDF）" style={{ display: "inline-flex", alignItems: "center", gap: 5, border: "0.5px solid var(--separator)", background: "var(--bg-elevated)", color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, padding: "6px 11px", borderRadius: 8, cursor: "pointer" }}>
                  <span style={{ display: "inline-flex", transform: "rotate(180deg)" }}><IconImport size={13} stroke="currentColor" /></span>打包导出本月
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))", gap: 12 }}>
                {g.items.map((v) => (
                  <div key={v.id} className="fv-card-int" style={{ ...card, overflow: "hidden", cursor: "pointer" }} onClick={() => setEdit(v)}>
                    <div style={{ position: "relative", aspectRatio: "3 / 4", background: "var(--fill-q)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {v.photo
                        ? (isPdf(v.photo)
                            ? <div onClick={(e) => { e.stopPropagation(); setLightbox(v.photo!); }} style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, cursor: "zoom-in" }}>
                                <span style={{ fontSize: 34 }}>📄</span>
                                <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-secondary)", letterSpacing: ".06em" }}>PDF</span>
                              </div>
                            : <img src={v.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onClick={(e) => { e.stopPropagation(); setLightbox(v.photo!); }} />)
                        : <span style={{ fontSize: 34 }}>{INVOICE_EMOJI[v.category ?? ""] ?? "🧾"}</span>}
                      <span style={{ position: "absolute", left: 8, top: 8, fontSize: 10.5, fontWeight: 600, color: "#fff", background: "rgba(0,0,0,0.52)", padding: "2px 7px", borderRadius: 6 }}>{v.category ? (INVOICE_EMOJI[v.category] ?? "🧾") + " " + v.category : "未归类"}</span>
                      <button className="fv-tap" title="删除这张" onClick={(e) => { e.stopPropagation(); if (confirm("删除这张发票？")) del(v.id); }}
                        style={{ position: "absolute", right: 6, top: 6, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 7, background: "rgba(0,0,0,0.5)", border: "none", cursor: "pointer", color: "#fff" }}><IconTrash size={13} stroke="currentColor" /></button>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px" }}>
                      <span style={{ fontSize: 11.5, color: "var(--text-tertiary)", fontVariantNumeric: "tabular-nums", flex: "none" }}>{fmtDate(v.date)}</span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "right" }}>{v.note || ""}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {edit && <InvoiceEditor key={edit.id} initial={edit} onClose={() => setEdit(null)} onSave={save} onDelete={() => del(edit.id)} />}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: "fixed", inset: 0, zIndex: 95, background: "rgba(0,0,0,0.82)", display: "flex", alignItems: "center", justifyContent: "center", padding: 30, cursor: isPdf(lightbox) ? "default" : "zoom-out", animation: "fvFade .15s ease" }}>
          {isPdf(lightbox)
            ? <iframe src={lightbox} title="发票 PDF" onClick={(e) => e.stopPropagation()} style={{ width: "min(900px, 92vw)", height: "90vh", border: "none", borderRadius: 10, background: "#fff", boxShadow: "0 10px 40px rgba(0,0,0,0.5)" }} />
            : <img src={lightbox} alt="发票" style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 10, boxShadow: "0 10px 40px rgba(0,0,0,0.5)" }} />}
        </div>
      )}
    </div>
  );
}

function CatChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className="fv-tap" onClick={onClick} style={{ border: "0.5px solid " + (active ? "transparent" : "var(--separator)"), cursor: "pointer", fontSize: 12.5, fontWeight: 600, padding: "7px 12px", borderRadius: 9, whiteSpace: "nowrap", color: active ? "var(--bg-elevated)" : "var(--text-secondary)", background: active ? "var(--text-primary)" : "var(--bg-elevated)" }}>{children}</button>
  );
}

function InvoiceEditor({ initial, onClose, onSave, onDelete }: { initial: Invoice; onClose: () => void; onSave: (v: Invoice) => void; onDelete: () => void }) {
  const [v, setV] = useState<Invoice>(initial);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const replace = async (f?: File) => { if (!f) return; setBusy(true); try { const url = await fileToDataURL(f); setV((p) => ({ ...p, photo: url })); } catch { /* ignore */ } setBusy(false); };

  return (
    <Modal title="发票" width={460} onClose={onClose} footer={<>
      <Btn variant="danger" onClick={onDelete}>删除</Btn>
      <div style={{ flex: 1 }} />
      <Btn variant="ghost" onClick={onClose}>取消</Btn>
      <Btn onClick={() => onSave({ ...v, note: v.note?.trim() || undefined })}><IconCheck size={15} stroke="#fff" />保存</Btn>
    </>}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
        {v.photo
          ? (isPdf(v.photo)
              ? <iframe src={v.photo} title="发票 PDF" style={{ width: "100%", height: 360, border: "0.5px solid var(--separator)", borderRadius: 10, background: "#fff" }} />
              : <img src={v.photo} alt="发票" style={{ maxWidth: "100%", maxHeight: 320, borderRadius: 10, border: "0.5px solid var(--separator)", display: "block" }} />)
          : <div style={{ width: "100%", height: 180, borderRadius: 10, background: "var(--fill-q)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>{INVOICE_EMOJI[v.category ?? ""] ?? "🧾"}</div>}
      </div>
      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={(e) => { replace(e.target.files?.[0]); e.currentTarget.value = ""; }} />
        <button onClick={() => fileRef.current?.click()} disabled={busy} style={{ border: "none", background: "transparent", color: "var(--accent)", fontSize: 12.5, fontWeight: 600, cursor: busy ? "default" : "pointer" }}>{busy ? "处理中…" : v.photo ? "替换文件（图片 / PDF）" : "上传文件（图片 / PDF）"}</button>
      </div>
      <Row>
        <L label="类别（归类）" flex={1.4}>
          <input list="inv-cats" value={v.category ?? ""} onChange={(e) => setV({ ...v, category: e.target.value || undefined })} placeholder="选择或输入" style={{ ...inputStyle, height: 36, padding: "0 12px" }} />
          <datalist id="inv-cats">{INVOICE_CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
        </L>
        <L label="日期" flex={1}><input type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} style={{ ...inputStyle, height: 36, padding: "0 12px" }} /></L>
      </Row>
      <L label="备注（选填）"><TextField value={v.note ?? ""} onChange={(e) => setV({ ...v, note: e.target.value })} placeholder="比如：高铁票、客户晚餐…方便以后找" /></L>
    </Modal>
  );
}

// ── 公司资料（一次填好放着）─────────────────────────────────────
function CompanyProfile({ data, mut }: { data: DevData; mut: Mut }) {
  const { copy } = useVault();
  const info = data.company ?? {};
  const [editInfo, setEditInfo] = useState(false);
  const hasInfo = !!(info.name || info.taxId || info.legalPerson || info.address || info.bank || info.bankAccount || info.phone || info.note);
  const saveInfo = (c: CompanyInfo) => { mut((d) => { d.company = c; }); setEditInfo(false); };

  return (
    <div style={{ maxWidth: 620 }}>
      <div style={{ ...card, padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: hasInfo ? 16 : 0 }}>
          <span style={{ width: 34, height: 34, borderRadius: 9, background: "color-mix(in srgb, var(--accent) 14%, transparent)", display: "flex", alignItems: "center", justifyContent: "center" }}><IconBuilding size={18} stroke="var(--accent)" /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{info.name || "公司资料"}</div>
            <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 1 }}>{hasInfo ? "一次填好放着 · 税号、开户行都收在这" : "还没填"}</div>
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
      {editInfo && <CompanyInfoEditor initial={info} onClose={() => setEditInfo(false)} onSave={saveInfo} />}
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
