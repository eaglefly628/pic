import React, { useMemo, useState } from "react";
import { useVault } from "../vault/VaultContext";
import type { InfoItem, InfoField } from "../vault/types";
import { Btn, Field, Modal, Select, TextField, TextArea, card, uid } from "../ui";
import { IconLock, IconUser, IconEdit, IconTrash, IconPlus } from "../icons";

const TYPES = ["实名信息", "身份证", "银行卡", "护照", "社保/医保", "驾驶证", "保险单", "会员卡", "WiFi", "紧急联系人", "其他"];
const MEMBER_COLORS = ["#0A84FF", "#FF2D55", "#FF9500", "#30D158", "#BF5AF2", "#64D2FF"];

export default function Info() {
  const { data, update } = useVault();
  const infos = data?.infos ?? [];
  const userName = data?.dataset.userName ?? "我";
  const vaultName = data?.dataset.vaultName ?? "家庭金库";
  const autoLock = data?.settings.autoLockMin ?? 5;
  const userInitial = (userName.slice(0, 1) || "U").toUpperCase();

  const members = useMemo(() => {
    const owners = Array.from(new Set((data?.dataset.accounts ?? []).map((a) => a.owner).filter((o): o is string => !!o && o !== "—")));
    const list = owners.map((o, i) => ({
      name: o === "本人" ? `${userName}（本人）` : o,
      role: o === "本人" ? "户主 · 管理员" : o === "配偶" ? "配偶" : o === "全家" ? "共有" : "成员",
      initial: o.slice(0, 1), color: MEMBER_COLORS[i % MEMBER_COLORS.length],
      access: o === "本人" ? "完全控制" : o === "全家" ? "共有" : "可编辑",
    }));
    return list.length ? list : [{ name: userName, role: "户主 · 管理员", initial: userInitial, color: "#0A84FF", access: "完全控制" }];
  }, [data?.dataset.accounts, userName, userInitial]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<InfoItem | null>(null);
  const startNew = () => { setEditing(null); setOpen(true); };
  const startEdit = (it: InfoItem) => { setEditing(it); setOpen(true); };
  const remove = (id: string) => update((d) => { d.infos = d.infos.filter((x) => x.id !== id); });

  return (
    <div style={{ padding: "24px 32px 40px", animation: "fvFade 0.3s ease" }}>
      <div style={{ ...card, borderRadius: 16, overflow: "hidden", marginBottom: 18 }}>
        <div style={{ height: 88, background: "linear-gradient(120deg, var(--accent), #5E5CE6 70%, #AF52DE)" }} />
        <div style={{ padding: "0 26px 22px", display: "flex", alignItems: "flex-end", gap: 18, marginTop: -34 }}>
          <span style={{ width: 78, height: 78, borderRadius: 22, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(160deg,#0A84FF,#5E5CE6)", color: "#fff", fontSize: 30, fontWeight: 700, border: "4px solid var(--bg-card)", boxShadow: "0 6px 16px rgba(0,0,0,0.18)" }}>{userInitial}</span>
          <div style={{ flex: 1, minWidth: 0, paddingBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--text-primary)" }}>{userName}</h1>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", background: "var(--accent-soft)", padding: "3px 9px", borderRadius: 6 }}>户主 · 管理员</span>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", marginTop: 4 }}>{vaultName}</div>
          </div>
          <Btn variant="ghost" onClick={startNew}><IconPlus />添加信息</Btn>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {infos.length === 0 ? (
            <div style={{ ...card, padding: "40px 22px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
              还没有机密信息，点击右上角「添加信息」录入身份证、银行卡、WiFi 等。
            </div>
          ) : infos.map((it) => (
            <div key={it.id} style={{ ...card, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "15px 22px 12px" }}>
                <IconLock size={15} stroke="var(--text-secondary)" width={1.8} />
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>{it.title}</div>
                <span style={{ fontSize: 10.5, color: "var(--text-secondary)", background: "var(--fill-quaternary)", padding: "2px 8px", borderRadius: 6 }}>{it.type}</span>
                <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                  <button onClick={() => startEdit(it)} title="编辑" style={miniBtn}><IconEdit size={14} stroke="var(--text-secondary)" /></button>
                  <button onClick={() => remove(it.id)} title="删除" style={miniBtn}><IconTrash size={14} stroke="var(--red)" /></button>
                </span>
              </div>
              {it.fields.filter((f) => f.label || f.value).map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", padding: "11px 22px", borderTop: "0.5px solid var(--separator)", fontSize: 13 }}>
                  <span style={{ width: 96, flex: "none", color: "var(--text-tertiary)" }}>{f.label}</span>
                  <span style={{ flex: 1, color: "var(--text-primary)", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{f.value}</span>
                </div>
              ))}
              {it.notes && <div style={{ padding: "10px 22px 14px", borderTop: "0.5px solid var(--separator)", fontSize: 12, color: "var(--text-secondary)" }}>{it.notes}</div>}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ ...card, overflow: "hidden" }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", padding: "15px 22px 12px" }}>登录与安全</div>
            <SecRow name="主密码" detail="AES-256 加密 · 可在设置中修改" status="强" color="var(--green)" bg="color-mix(in srgb, var(--green) 13%, transparent)" />
            <SecRow name="生物识别" detail="Touch ID / Windows Hello" status="待启用" color="var(--text-secondary)" bg="var(--fill-quaternary)" />
            <SecRow name="自动锁定" detail="闲置后自动锁定并清除内存" status={autoLock > 0 ? `${autoLock} 分钟` : "已关闭"} color="var(--text-secondary)" bg="var(--fill-quaternary)" />
          </div>

          <div style={{ ...card, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", padding: "15px 22px 12px" }}>
              <IconUser size={15} stroke="var(--text-secondary)" />家庭成员
            </div>
            {members.map((m) => (
              <div key={m.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 22px", borderTop: "0.5px solid var(--separator)" }}>
                <span style={{ width: 32, height: 32, borderRadius: "50%", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: `color-mix(in srgb, ${m.color} 16%, transparent)`, color: m.color, fontSize: 12, fontWeight: 700 }}>{m.initial}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{m.role}</div>
                </div>
                <span style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--text-secondary)", background: "var(--fill-quaternary)", padding: "3px 9px", borderRadius: 6 }}>{m.access}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <InfoEditor open={open} initial={editing} onClose={() => setOpen(false)}
        onSave={(vals) => {
          update((d) => {
            if (editing) { const it = d.infos.find((x) => x.id === editing.id); if (it) Object.assign(it, vals, { updatedAt: Date.now() }); }
            else { const now = Date.now(); d.infos.push({ id: uid("info"), ...vals, createdAt: now, updatedAt: now }); }
          });
          setOpen(false);
        }} />
    </div>
  );
}

function SecRow({ name, detail, status, color, bg }: { name: string; detail: string; status: string; color: string; bg: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 22px", borderTop: "0.5px solid var(--separator)" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{name}</div>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{detail}</div>
      </div>
      <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600, color, background: bg, padding: "3px 9px", borderRadius: 6, whiteSpace: "nowrap" }}>{status}</span>
    </div>
  );
}

const miniBtn: React.CSSProperties = { width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, background: "var(--fill-quaternary)", border: "none", cursor: "pointer" };

type InfoVals = Omit<InfoItem, "id" | "createdAt" | "updatedAt">;

function InfoEditor({ open, initial, onClose, onSave }: { open: boolean; initial: InfoItem | null; onClose: () => void; onSave: (v: InfoVals) => void }) {
  const [title, setTitle] = useState(""); const [type, setType] = useState(TYPES[0]); const [owner, setOwner] = useState("本人");
  const [fields, setFields] = useState<InfoField[]>([{ label: "", value: "" }]); const [notes, setNotes] = useState("");

  React.useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? ""); setType(initial?.type ?? TYPES[0]); setOwner(initial?.owner ?? "本人");
    setFields(initial?.fields?.length ? initial.fields.map((f) => ({ ...f })) : [{ label: "", value: "" }]);
    setNotes(initial?.notes ?? "");
  }, [open, initial]);

  const setField = (i: number, key: keyof InfoField, val: string) => setFields((fs) => fs.map((f, j) => (j === i ? { ...f, [key]: val } : f)));
  const addField = () => setFields((fs) => [...fs, { label: "", value: "" }]);
  const delField = (i: number) => setFields((fs) => fs.filter((_, j) => j !== i));

  const submit = () => {
    if (!title.trim()) return;
    onSave({ title: title.trim(), type, owner, fields: fields.filter((f) => f.label || f.value), notes });
  };

  return (
    <Modal open={open} title={initial ? "编辑信息" : "添加信息"} onClose={onClose} width={500}
      footer={<><Btn variant="ghost" onClick={onClose}>取消</Btn><Btn onClick={submit}>保存</Btn></>}>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12 }}>
        <Field label="标题"><TextField value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如 我的身份证" autoFocus /></Field>
        <Field label="类型"><Select value={type} options={TYPES.map((t) => ({ value: t, label: t }))} onChange={(e) => setType(e.target.value)} /></Field>
      </div>
      <Field label="归属"><TextField value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="本人/配偶/孩子" /></Field>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>字段</div>
      {fields.map((f, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <TextField value={f.label} onChange={(e) => setField(i, "label", e.target.value)} placeholder="名称" style={{ width: 120 }} />
          <TextField value={f.value} onChange={(e) => setField(i, "value", e.target.value)} placeholder="内容" />
          <Btn variant="ghost" type="button" onClick={() => delField(i)} style={{ width: 40, padding: 0 }}><IconTrash /></Btn>
        </div>
      ))}
      <Btn variant="soft" type="button" onClick={addField} style={{ height: 30, marginBottom: 14 }}><IconPlus size={14} stroke="currentColor" />添加字段</Btn>
      <Field label="备注（可选）"><TextArea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
    </Modal>
  );
}
