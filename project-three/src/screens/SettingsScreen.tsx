import { useRef, useState } from "react";
import { useVault } from "../lib/vault";
import { Btn, Field, card, inputStyle } from "../ui";

const LOCK_OPTS = [
  { v: 1, l: "1 分钟" }, { v: 5, l: "5 分钟" }, { v: 15, l: "15 分钟" }, { v: 30, l: "30 分钟" }, { v: 0, l: "不自动锁定" },
];

export default function SettingsScreen() {
  const { items, settings, updateSettings, changeMaster, exportVault, importVault } = useVault();
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [msg, setMsg] = useState<{ t: "ok" | "err"; m: string } | null>(null);
  const [impPw, setImpPw] = useState("");
  const [impMsg, setImpMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const doChange = async () => {
    setMsg(null);
    if (newPw.length < 8) return setMsg({ t: "err", m: "新主密码至少 8 位" });
    if (newPw !== newPw2) return setMsg({ t: "err", m: "两次新密码不一致" });
    const ok = await changeMaster(oldPw, newPw);
    if (ok) { setMsg({ t: "ok", m: "主密码已更新" }); setOldPw(""); setNewPw(""); setNewPw2(""); }
    else setMsg({ t: "err", m: "当前主密码错误" });
  };

  const doImport = async (f: File) => {
    if (!confirm("导入会用所选文件【替换】本机当前保险库，且需用该文件对应的主密码解锁。确定继续？")) return;
    const r = await importVault(f, impPw);
    if (r === "bad") setImpMsg("文件无法识别");
    else if (r === "badpass") setImpMsg("该备份文件的主密码错误，本机保险库未被替换");
    else setImpPw("");
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "26px 24px 50px", animation: "fvFade .25s ease" }}>
      <Section title="保险库">
        <Row k="记录数量" v={`${items.length} 条`} />
        <Row k="存储位置" v="本机浏览器（IndexedDB，加密）" />
      </Section>

      <Section title="自动锁定">
        <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", marginBottom: 10 }}>闲置一段时间后自动锁定，需重新输入主密码。</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {LOCK_OPTS.map((o) => (
            <button key={o.v} onClick={() => updateSettings({ autoLockMin: o.v })}
              style={{ padding: "8px 14px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", border: settings.autoLockMin === o.v ? "1.5px solid var(--accent)" : "0.5px solid var(--separator)", background: settings.autoLockMin === o.v ? "rgba(94,92,230,0.08)" : "var(--bg-elevated)", color: settings.autoLockMin === o.v ? "var(--accent)" : "var(--text-secondary)" }}>{o.l}</button>
          ))}
        </div>
      </Section>

      <Section title="备份与迁移">
        <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 12 }}>
          导出的是<strong>加密文件</strong>（没有主密码打不开）。把它拷到另一台机器，用「导入」载入后，输入主密码即可使用——这就是多台机器共享的方式。
        </div>
        <Field label="该备份文件的主密码（导入前必填）"><input type="password" value={impPw} onChange={(e) => setImpPw(e.target.value)} autoComplete="off" style={inputStyle} /></Field>
        {impMsg && <div style={{ fontSize: 12.5, color: "var(--red)", marginBottom: 10 }}>{impMsg}</div>}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Btn variant="soft" onClick={exportVault}>导出加密文件</Btn>
          <input ref={fileRef} type="file" accept=".vault,.json,application/json" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f); e.currentTarget.value = ""; }} />
          <Btn variant="ghost" onClick={() => { setImpMsg(""); if (!impPw) { setImpMsg("请先输入该备份文件的主密码"); return; } fileRef.current?.click(); }}>导入（替换本机）</Btn>
        </div>
      </Section>

      <Section title="修改主密码">
        <Field label="当前主密码"><input type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} autoComplete="current-password" style={inputStyle} /></Field>
        <Field label="新主密码（至少 8 位）"><input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" style={inputStyle} /></Field>
        <Field label="确认新主密码"><input type="password" value={newPw2} onChange={(e) => setNewPw2(e.target.value)} autoComplete="new-password" style={inputStyle} /></Field>
        {msg && <div style={{ fontSize: 12.5, color: msg.t === "ok" ? "var(--green)" : "var(--red)", marginBottom: 10 }}>{msg.m}</div>}
        <Btn onClick={doChange} disabled={!oldPw || !newPw}>更新主密码</Btn>
      </Section>

      <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", lineHeight: 1.7, marginTop: 8 }}>
        🔒 零知识：主密码用 PBKDF2 派生密钥、AES-256-GCM 加密整库；主密码不保存、不上传，<strong>遗失无法找回</strong>。请牢记主密码并定期导出备份。所有数据仅存于本机。
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="fv-rise" style={{ ...card, padding: "18px 20px", marginBottom: 16 }}>
      <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13.5 }}>
      <span style={{ color: "var(--text-secondary)" }}>{k}</span>
      <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{v}</span>
    </div>
  );
}
