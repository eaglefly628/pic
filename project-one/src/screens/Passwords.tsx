import React, { useState } from "react";
import { useVault } from "../vault/VaultContext";
import type { PasswordItem } from "../vault/types";
import { hasPwBox, unlockPwBox, savePwBox, pwSession } from "../vault/pwStore";
import { passwordStrength } from "../lib/crypto";
import { Btn, Field, Modal, Select, TextField, TextArea, EmptyState, card, uid } from "../ui";
import { IconCopy, IconEye, IconEyeOff, IconTrash, IconEdit, IconKey, IconPlus, IconRefresh, IconStar, IconCheck, IconArrowRight } from "../icons";

const CATS = ["网站账号", "银行/支付", "邮箱", "社交", "工作", "WiFi", "设备", "其他"];
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

function genPassword(len = 16, symbols = true): string {
  const lower = "abcdefghijkmnpqrstuvwxyz", upper = "ABCDEFGHJKLMNPQRSTUVWXYZ", digits = "23456789", sym = "!@#$%^&*-_=+?";
  const pool = lower + upper + digits + (symbols ? sym : "");
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  let out = "";
  for (let i = 0; i < len; i++) out += pool[arr[i] % pool.length];
  return out;
}

export default function Passwords() {
  const { data, update } = useVault();
  const clearSec = data?.settings.clipboardClearSec ?? 30;
  if (hasPwBox()) return <PwGate clearSec={clearSec} />;
  return (
    <PwVault
      items={data?.passwords ?? []}
      clearSec={clearSec}
      onMutate={(fn) => update((d) => { d.passwords = d.passwords ?? []; fn(d.passwords); })}
    />
  );
}

function PwGate({ clearSec }: { clearSec: number }) {
  const [sess, setSess] = useState(pwSession.get());
  if (!sess) return <PwUnlock onUnlocked={(s) => { pwSession.set(s); setSess(s); }} />;
  return (
    <PwVault
      items={sess.items}
      clearSec={clearSec}
      onMutate={(fn) => {
        const next = clone(sess.items); fn(next);
        void savePwBox(sess.keys, next);
        const ns = { keys: sess.keys, items: next };
        pwSession.set(ns); setSess(ns);
      }}
    />
  );
}

function PwUnlock({ onUnlocked }: { onUnlocked: (s: NonNullable<ReturnType<typeof pwSession.get>>) => void }) {
  const [pw, setPw] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true); const r = await unlockPwBox(pw); setBusy(false);
    if (!r) { setErr("密码错误"); setPw(""); return; }
    onUnlocked(r);
  };
  return (
    <div style={{ padding: "60px 32px", display: "flex", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, width: 300 }}>
        <div style={{ width: 56, height: 56, borderRadius: 15, background: "linear-gradient(160deg,var(--accent),#b08a5e)", display: "flex", alignItems: "center", justifyContent: "center" }}><IconKey size={26} stroke="#fff" /></div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>密码保险箱已锁定</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>已开启二次验证，请输入独立密码</div>
        </div>
        <TextField type="password" autoFocus value={pw} placeholder="二次验证密码" onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
        {err && <div style={{ fontSize: 12, color: "var(--red)" }}>{err}</div>}
        <Btn onClick={submit} disabled={busy} style={{ height: 40, width: "100%" }}>{busy ? "处理中…" : "解锁"}{!busy && <IconArrowRight size={15} stroke="#fff" />}</Btn>
      </div>
    </div>
  );
}

function PwVault({ items, clearSec, onMutate }: { items: PasswordItem[]; clearSec: number; onMutate: (fn: (items: PasswordItem[]) => void) => void }) {
  const [editing, setEditing] = useState<PasswordItem | null>(null);
  const [open, setOpen] = useState(false);
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string>("");

  const copy = async (text: string, tag: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(tag);
      setTimeout(() => setCopied(""), 1200);
      if (clearSec > 0) setTimeout(() => navigator.clipboard.writeText("").catch(() => {}), clearSec * 1000);
    } catch { /* ignore */ }
  };

  const startNew = () => { setEditing(null); setOpen(true); };
  const remove = (id: string) => onMutate((arr) => { const i = arr.findIndex((p) => p.id === id); if (i >= 0) arr.splice(i, 1); });
  const toggleFav = (id: string) => onMutate((arr) => { const p = arr.find((x) => x.id === id); if (p) p.favorite = !p.favorite; });

  const sorted = [...items].sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.updatedAt - a.updatedAt);

  return (
    <div style={{ padding: "24px 32px 40px", animation: "fvFade 0.3s ease" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>共 {items.length} 条 · 全部本地加密存储</div>
        <div style={{ flex: 1 }} />
        <Btn onClick={startNew}><IconPlus />新增密码</Btn>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={<IconKey size={28} stroke="var(--text-tertiary)" />} text="还没有保存任何密码" action={<Btn variant="soft" onClick={startNew}>添加第一条</Btn>} />
      ) : (
        <div style={{ ...card, overflow: "hidden" }}>
          {sorted.map((it, i) => {
            const st = passwordStrength(it.password);
            return (
              <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 13, padding: "13px 20px", borderTop: i === 0 ? "none" : "0.5px solid var(--separator)" }}>
                <span style={{ width: 36, height: 36, borderRadius: 9, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--accent-soft)", color: "var(--accent)", fontSize: 14, fontWeight: 700 }}>{it.title.slice(0, 1)}</span>
                <div style={{ minWidth: 0, width: 200 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.title}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.username || it.url || "—"}</div>
                </div>
                {it.category && <span style={{ fontSize: 11, color: "var(--text-secondary)", background: "var(--fill-quaternary)", padding: "3px 9px", borderRadius: 6 }}>{it.category}</span>}
                <div style={{ flex: 1, minWidth: 80, fontFamily: "ui-monospace, monospace", fontSize: 13, color: "var(--text-secondary)", letterSpacing: reveal[it.id] ? 0 : 2 }}>
                  {reveal[it.id] ? it.password : "••••••••"}
                </div>
                <span title={`强度：${st.label}`} style={{ width: 7, height: 7, borderRadius: "50%", background: st.score >= 3 ? "var(--green)" : st.score >= 2 ? "var(--orange)" : "var(--red)" }} />
                <RowBtn title={reveal[it.id] ? "隐藏" : "显示"} onClick={() => setReveal((r) => ({ ...r, [it.id]: !r[it.id] }))}>{reveal[it.id] ? <IconEyeOff /> : <IconEye />}</RowBtn>
                <RowBtn title="复制密码" onClick={() => copy(it.password, "pw" + it.id)}>{copied === "pw" + it.id ? <IconCheck stroke="var(--green)" /> : <IconCopy />}</RowBtn>
                <RowBtn title={it.favorite ? "取消收藏" : "收藏"} onClick={() => toggleFav(it.id)}><span key={it.favorite ? "f" : "n"} className={it.favorite ? "fv-pop" : undefined} style={{ display: "inline-flex" }}><IconStar stroke={it.favorite ? "var(--orange)" : "var(--text-tertiary)"} /></span></RowBtn>
                <RowBtn title="编辑" onClick={() => { setEditing(it); setOpen(true); }}><IconEdit /></RowBtn>
                <RowBtn title="删除" onClick={() => remove(it.id)}><IconTrash stroke="var(--red)" /></RowBtn>
              </div>
            );
          })}
        </div>
      )}

      <PasswordEditor
        open={open} initial={editing} onClose={() => setOpen(false)}
        onSave={(vals) => {
          onMutate((arr) => {
            if (editing) { const p = arr.find((x) => x.id === editing.id); if (p) Object.assign(p, vals, { updatedAt: Date.now() }); }
            else { const now = Date.now(); arr.push({ id: uid("pw"), ...vals, createdAt: now, updatedAt: now }); }
          });
          setOpen(false);
        }}
      />
    </div>
  );
}

function RowBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button onClick={onClick} title={title} className="fv-icnbtn" style={{ width: 28, height: 28, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 7, background: "transparent", border: "none", cursor: "pointer", color: "var(--text-secondary)" }}>
      {children}
    </button>
  );
}

type PwVals = Omit<PasswordItem, "id" | "createdAt" | "updatedAt">;

function PasswordEditor({ open, initial, onClose, onSave }: { open: boolean; initial: PasswordItem | null; onClose: () => void; onSave: (v: PwVals) => void }) {
  const [title, setTitle] = useState(""); const [url, setUrl] = useState(""); const [username, setUsername] = useState("");
  const [password, setPassword] = useState(""); const [category, setCategory] = useState(CATS[0]); const [notes, setNotes] = useState("");
  const [show, setShow] = useState(false);

  React.useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? ""); setUrl(initial?.url ?? ""); setUsername(initial?.username ?? "");
    setPassword(initial?.password ?? ""); setCategory(initial?.category ?? CATS[0]); setNotes(initial?.notes ?? ""); setShow(false);
  }, [open, initial]);

  const st = passwordStrength(password);
  const submit = () => { if (!title.trim()) return; onSave({ title: title.trim(), url, username, password, category, notes, favorite: initial?.favorite }); };

  return (
    <Modal open={open} title={initial ? "编辑密码" : "新增密码"} onClose={onClose}
      footer={<><Btn variant="ghost" onClick={onClose}>取消</Btn><Btn onClick={submit}>保存</Btn></>}>
      <Field label="名称"><TextField value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如 招商银行网银" autoFocus /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="用户名"><TextField value={username} onChange={(e) => setUsername(e.target.value)} /></Field>
        <Field label="分类"><Select value={category} options={CATS.map((c) => ({ value: c, label: c }))} onChange={(e) => setCategory(e.target.value)} /></Field>
      </div>
      <Field label="网址（可选）"><TextField value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" /></Field>
      <Field label="密码">
        <div style={{ display: "flex", gap: 8 }}>
          <TextField type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} style={{ fontFamily: "ui-monospace, monospace" }} />
          <Btn variant="ghost" type="button" onClick={() => setShow((s) => !s)} style={{ width: 40, padding: 0 }}>{show ? <IconEyeOff /> : <IconEye />}</Btn>
          <Btn variant="ghost" type="button" title="生成强密码" className="fv-spin-hover" onClick={() => { setPassword(genPassword(16)); setShow(true); }} style={{ width: 40, padding: 0 }}><IconRefresh /></Btn>
        </div>
        {password && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <div style={{ flex: 1, height: 4, borderRadius: 2, background: "var(--track)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(st.score / 4) * 100}%`, background: st.score >= 3 ? "var(--green)" : st.score >= 2 ? "var(--orange)" : "var(--red)" }} />
            </div>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{st.label}</span>
          </div>
        )}
      </Field>
      <Field label="备注（可选）"><TextArea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
    </Modal>
  );
}
