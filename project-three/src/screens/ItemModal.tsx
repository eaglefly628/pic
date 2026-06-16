import { useEffect, useState } from "react";
import { useVault } from "../lib/vault";
import type { CustomField, ItemType, VaultItem } from "../types";
import { TYPE_LABEL } from "../types";
import { generatePassword, strength } from "../lib/generate";
import { totp, totpRemaining, TOTP_PERIOD, isValidTotpSecret } from "../lib/totp";
import { Btn, Field, inputStyle } from "../ui";
import { IconCopy, IconEye, IconEyeOff, IconStar, IconTrash, IconClose, IconRefresh, IconKey, IconCard, IconNote, IconInfo } from "../icons";

const TYPES: ItemType[] = ["login", "card", "note", "info"];
const TYPE_ICON = { login: IconKey, card: IconCard, note: IconNote, info: IconInfo };

export default function ItemModal({ item, newType, onClose }: { item?: VaultItem; newType?: ItemType; onClose: () => void }) {
  const { saveItem, deleteItem, toggleFavorite, copy } = useVault();
  const [edit, setEdit] = useState(!item);
  const [draft, setDraft] = useState<VaultItem>(() =>
    item ? { ...item, fields: item.fields ? item.fields.map((f) => ({ ...f })) : undefined }
      : { id: "", type: newType ?? "login", title: "", fields: newType === "info" ? [{ label: "", value: "" }] : undefined, createdAt: 0, updatedAt: 0 });
  const [reveal, setReveal] = useState<Set<string>>(new Set());
  const cur = item && !edit ? item : draft;

  const toggle = (k: string) => setReveal((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const set = (patch: Partial<VaultItem>) => setDraft((d) => ({ ...d, ...patch }));

  const save = async () => {
    if (!draft.title.trim()) { set({ title: draft.title }); return; }
    const clean = { ...draft, fields: draft.fields?.filter((f) => f.label || f.value) };
    await saveItem(clean);
    onClose();
  };
  const remove = async () => { if (item && confirm("确定删除这条记录？此操作不可撤销。")) { await deleteItem(item.id); onClose(); } };

  const Ic = TYPE_ICON[cur.type];

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={panel}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "16px 20px", borderBottom: "0.5px solid var(--separator)" }}>
          <span style={{ width: 36, height: 36, borderRadius: 10, background: "var(--fill-q)", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic size={18} stroke="var(--accent)" /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{edit ? (item ? "编辑" : "新建") + TYPE_LABEL[cur.type] : cur.title || "（无标题）"}</div>
            {!edit && <div style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>{TYPE_LABEL[cur.type]}</div>}
          </div>
          {item && !edit && (
            <button onClick={() => toggleFavorite(item.id)} style={iconBtn} title="收藏">
              <IconStar size={17} stroke={item.favorite ? "var(--orange)" : "var(--text-tertiary)"} />
            </button>
          )}
          <button onClick={onClose} style={iconBtn}><IconClose stroke="var(--text-tertiary)" /></button>
        </div>

        <div style={{ padding: "18px 20px", overflow: "auto", flex: 1 }}>
          {edit ? <EditForm draft={draft} set={set} setDraft={setDraft} isNew={!item} reveal={reveal} toggle={toggle} />
            : <ViewBody item={cur} reveal={reveal} toggle={toggle} copy={copy} />}
        </div>

        <div style={{ display: "flex", gap: 10, padding: "14px 20px", borderTop: "0.5px solid var(--separator)" }}>
          {edit ? (
            <>
              {item && <Btn variant="ghost" onClick={() => { setEdit(false); setDraft({ ...item }); }}>取消</Btn>}
              {!item && <Btn variant="ghost" onClick={onClose}>取消</Btn>}
              <div style={{ flex: 1 }} />
              <Btn onClick={save} disabled={!draft.title.trim()}>保存</Btn>
            </>
          ) : (
            <>
              <Btn variant="danger" onClick={remove}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><IconTrash size={14} stroke="var(--red)" /> 删除</span></Btn>
              <div style={{ flex: 1 }} />
              <Btn variant="soft" onClick={() => { setEdit(true); setDraft({ ...item!, fields: item!.fields?.map((f) => ({ ...f })) }); }}>编辑</Btn>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- 查看 ---------- */
function ViewBody({ item, reveal, toggle, copy }: { item: VaultItem; reveal: Set<string>; toggle: (k: string) => void; copy: (t: string, l?: string) => void }) {
  const rows: { k: string; label: string; value?: string; secret?: boolean; link?: boolean }[] = [];
  if (item.type === "login") {
    rows.push({ k: "url", label: "网址", value: item.url, link: true });
    rows.push({ k: "username", label: "账号 / 用户名", value: item.username });
    rows.push({ k: "password", label: "密码", value: item.password, secret: true });
  } else if (item.type === "card") {
    rows.push({ k: "cardNumber", label: "卡号", value: item.cardNumber, secret: true });
    rows.push({ k: "cardholder", label: "持卡人", value: item.cardholder });
    rows.push({ k: "expiry", label: "有效期", value: item.expiry });
    rows.push({ k: "cvv", label: "CVV", value: item.cvv, secret: true });
    rows.push({ k: "pin", label: "PIN", value: item.pin, secret: true });
  } else if (item.type === "info") {
    (item.fields ?? []).forEach((f, i) => rows.push({ k: "f" + i, label: f.label || "字段", value: f.value, secret: f.secret }));
  }
  return (
    <>
      {rows.filter((r) => r.value).map((r) => (
        <ViewRow key={r.k} {...r} shown={reveal.has(r.k)} onToggle={() => toggle(r.k)} onCopy={() => copy(r.value!, r.label)} />
      ))}
      {item.type === "login" && item.totp && isValidTotpSecret(item.totp) && <TotpRow secret={item.totp} copy={copy} />}
      {item.notes && (
        <div style={{ marginTop: 6 }}>
          <div style={labelCss}>备注</div>
          <div style={{ fontSize: 13.5, color: "var(--text-primary)", whiteSpace: "pre-wrap", lineHeight: 1.6, background: "var(--fill-q)", padding: "10px 12px", borderRadius: 10 }}>{item.notes}</div>
        </div>
      )}
      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 14 }}>更新于 {new Date(item.updatedAt).toLocaleString("zh-CN")}</div>
    </>
  );
}

function ViewRow({ label, value, secret, link, shown, onToggle, onCopy }: { label: string; value?: string; secret?: boolean; link?: boolean; shown: boolean; onToggle: () => void; onCopy: () => void }) {
  const masked = secret && !shown;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={labelCss}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--fill-q)", borderRadius: 10, padding: "9px 11px" }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontFamily: secret ? "ui-monospace, monospace" : undefined, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-primary)" }}>
          {masked ? "••••••••••" : link ? <a href={/^https?:\/\//.test(value!) ? value : `https://${value}`} target="_blank" rel="noreferrer" style={{ color: "var(--accent2)", textDecoration: "none" }}>{value}</a> : value}
        </span>
        {secret && <button onClick={onToggle} style={iconBtn} title={shown ? "隐藏" : "显示"}>{shown ? <IconEyeOff stroke="var(--text-tertiary)" /> : <IconEye stroke="var(--text-tertiary)" />}</button>}
        <button onClick={onCopy} style={iconBtn} title="复制"><IconCopy stroke="var(--text-secondary)" /></button>
      </div>
    </div>
  );
}

function TotpRow({ secret, copy }: { secret: string; copy: (t: string, l?: string) => void }) {
  const [code, setCode] = useState("……");
  const [left, setLeft] = useState(TOTP_PERIOD);
  useEffect(() => {
    let on = true;
    const tick = async () => { const c = await totp(secret); if (on) { setCode(c); setLeft(totpRemaining()); } };
    tick();
    const t = setInterval(tick, 1000);
    return () => { on = false; clearInterval(t); };
  }, [secret]);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={labelCss}>两步验证码（2FA）</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--fill-q)", borderRadius: 10, padding: "9px 11px" }}>
        <span style={{ flex: 1, fontSize: 18, fontWeight: 700, letterSpacing: 3, fontFamily: "ui-monospace, monospace", color: "var(--text-primary)" }}>{code.replace(/(\d{3})(\d{3})/, "$1 $2")}</span>
        <span style={{ fontSize: 12, color: left <= 5 ? "var(--red)" : "var(--text-tertiary)", width: 26, textAlign: "right" }}>{left}s</span>
        <button onClick={() => copy(code, "验证码")} style={iconBtn} title="复制"><IconCopy stroke="var(--text-secondary)" /></button>
      </div>
    </div>
  );
}

/* ---------- 编辑 ---------- */
function EditForm({ draft, set, setDraft, isNew, reveal, toggle }: { draft: VaultItem; set: (p: Partial<VaultItem>) => void; setDraft: React.Dispatch<React.SetStateAction<VaultItem>>; isNew: boolean; reveal: Set<string>; toggle: (k: string) => void }) {
  return (
    <>
      {isNew && (
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {TYPES.map((t) => {
            const Ic = TYPE_ICON[t];
            const on = draft.type === t;
            return (
              <button key={t} onClick={() => setDraft((d) => ({ ...d, type: t, fields: t === "info" && !d.fields?.length ? [{ label: "", value: "" }] : d.fields }))}
                style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "10px 4px", borderRadius: 11, cursor: "pointer", border: on ? "1.5px solid var(--accent)" : "0.5px solid var(--separator)", background: on ? "rgba(94,92,230,0.08)" : "var(--bg-elevated)", color: on ? "var(--accent)" : "var(--text-secondary)", fontSize: 12, fontWeight: 600 }}>
                <Ic size={18} stroke={on ? "var(--accent)" : "var(--text-secondary)"} /> {TYPE_LABEL[t]}
              </button>
            );
          })}
        </div>
      )}

      <Field label="标题 *"><input value={draft.title} autoFocus onChange={(e) => set({ title: e.target.value })} placeholder="如：招商银行 / 家里 WiFi" style={inputStyle} /></Field>

      {draft.type === "login" && (
        <>
          <Field label="网址"><input value={draft.url ?? ""} onChange={(e) => set({ url: e.target.value })} placeholder="example.com" style={inputStyle} /></Field>
          <Field label="账号 / 用户名"><input value={draft.username ?? ""} onChange={(e) => set({ username: e.target.value })} autoComplete="off" style={inputStyle} /></Field>
          <PasswordEdit value={draft.password ?? ""} onChange={(v) => set({ password: v })} shown={reveal.has("pw")} onToggle={() => toggle("pw")} />
          <Field label="两步验证密钥（2FA，可选）"><input value={draft.totp ?? ""} onChange={(e) => set({ totp: e.target.value })} placeholder="base32 密钥，如 JBSWY3DP…" autoComplete="off" style={inputStyle} /></Field>
        </>
      )}
      {draft.type === "card" && (
        <>
          <Field label="卡号"><input value={draft.cardNumber ?? ""} onChange={(e) => set({ cardNumber: e.target.value })} inputMode="numeric" autoComplete="off" style={inputStyle} /></Field>
          <Field label="持卡人"><input value={draft.cardholder ?? ""} onChange={(e) => set({ cardholder: e.target.value })} style={inputStyle} /></Field>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}><Field label="有效期"><input value={draft.expiry ?? ""} onChange={(e) => set({ expiry: e.target.value })} placeholder="MM/YY" style={inputStyle} /></Field></div>
            <div style={{ flex: 1 }}><Field label="CVV"><input value={draft.cvv ?? ""} onChange={(e) => set({ cvv: e.target.value })} autoComplete="off" style={inputStyle} /></Field></div>
          </div>
          <Field label="取款密码 / PIN"><input value={draft.pin ?? ""} onChange={(e) => set({ pin: e.target.value })} autoComplete="off" style={inputStyle} /></Field>
        </>
      )}
      {draft.type === "info" && <FieldsEditor fields={draft.fields ?? []} onChange={(fields) => set({ fields })} />}

      <Field label="备注"><textarea value={draft.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} rows={draft.type === "note" ? 8 : 3} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }} /></Field>
    </>
  );
}

function PasswordEdit({ value, onChange, shown, onToggle }: { value: string; onChange: (v: string) => void; shown: boolean; onToggle: () => void }) {
  const [opts, setOpts] = useState(false);
  const [len, setLen] = useState(16);
  const [sym, setSym] = useState(true);
  const s = strength(value);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={labelCss}>密码</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, ...inputStyle, padding: "4px 6px 4px 12px" }}>
        <input value={value} type={shown ? "text" : "password"} onChange={(e) => onChange(e.target.value)} autoComplete="off" style={{ flex: 1, border: "none", background: "transparent", color: "var(--text-primary)", fontSize: 14, fontFamily: "ui-monospace, monospace" }} />
        <button type="button" onClick={onToggle} style={iconBtn}>{shown ? <IconEyeOff stroke="var(--text-tertiary)" /> : <IconEye stroke="var(--text-tertiary)" />}</button>
        <button type="button" onClick={() => onChange(generatePassword({ length: len, upper: true, lower: true, digits: true, symbols: sym }))} style={iconBtn} title="生成强密码"><IconRefresh stroke="var(--accent)" /></button>
        <button type="button" onClick={() => setOpts((v) => !v)} style={{ ...iconBtn, fontSize: 11, color: "var(--text-tertiary)", width: "auto", padding: "0 6px" }}>选项</button>
      </div>
      {value && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          <div style={{ flex: 1, height: 4, background: "var(--track)", borderRadius: 3, overflow: "hidden" }}><div style={{ height: "100%", width: `${(s / 4) * 100}%`, background: s >= 3 ? "var(--green)" : s >= 2 ? "var(--orange)" : "var(--red)" }} /></div>
        </div>
      )}
      {opts && (
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8, fontSize: 12.5, color: "var(--text-secondary)" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>长度 {len}<input type="range" min={8} max={32} value={len} onChange={(e) => setLen(+e.target.value)} /></label>
          <label style={{ display: "flex", alignItems: "center", gap: 5 }}><input type="checkbox" checked={sym} onChange={(e) => setSym(e.target.checked)} />符号</label>
        </div>
      )}
    </div>
  );
}

function FieldsEditor({ fields, onChange }: { fields: CustomField[]; onChange: (f: CustomField[]) => void }) {
  const upd = (i: number, patch: Partial<CustomField>) => onChange(fields.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={labelCss}>信息字段</div>
      {fields.map((f, i) => (
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
          <input value={f.label} onChange={(e) => upd(i, { label: e.target.value })} placeholder="名称（如 宽带账号）" style={{ ...inputStyle, flex: "0 0 38%" }} />
          <input value={f.value} onChange={(e) => upd(i, { value: e.target.value })} placeholder="内容" type={f.secret ? "password" : "text"} autoComplete="off" style={{ ...inputStyle, flex: 1 }} />
          <button type="button" onClick={() => upd(i, { secret: !f.secret })} style={iconBtn} title="设为隐藏">{f.secret ? <IconEyeOff stroke="var(--text-tertiary)" /> : <IconEye stroke="var(--text-tertiary)" />}</button>
          <button type="button" onClick={() => onChange(fields.filter((_, j) => j !== i))} style={iconBtn}><IconTrash stroke="var(--text-tertiary)" /></button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...fields, { label: "", value: "" }])} style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 12.5, fontWeight: 600, marginTop: 2 }}>+ 添加字段</button>
    </div>
  );
}

const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 };
const panel: React.CSSProperties = { background: "var(--bg-content)", borderRadius: 18, width: 460, maxWidth: "100%", maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "var(--shadow)", animation: "fvPop .22s ease" };
const iconBtn: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, border: "none", background: "transparent", borderRadius: 8, flex: "none" };
const labelCss: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: "var(--text-tertiary)", marginBottom: 5, letterSpacing: ".02em" };
