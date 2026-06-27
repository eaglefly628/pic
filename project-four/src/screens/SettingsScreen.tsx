import { useRef, useState } from "react";
import { useVault } from "../lib/vault";
import { Btn, Field, card, inputStyle } from "../ui";

const LOCK_OPTS = [
  { v: 1, l: "1 分钟" }, { v: 5, l: "5 分钟" }, { v: 15, l: "15 分钟" }, { v: 30, l: "30 分钟" }, { v: 0, l: "不自动锁定" },
];

export default function SettingsScreen() {
  const { data, updateSettings, changeMaster, exportVault, importVault } = useVault();
  const settings = data.settings;
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [msg, setMsg] = useState<{ t: "ok" | "err"; m: string } | null>(null);
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
    if (!confirm("导入会用所选文件【替换】本机当前数据，且需用该文件对应的主密码解锁。确定继续？")) return;
    const r = await importVault(f);
    if (r === "bad") setMsg({ t: "err", m: "文件无法识别" });
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "26px 24px 50px", animation: "fvFade .25s ease" }}>
      <Section title="工作台概况">
        <Row k="任务" v={`${data.tasks.length} 条`} />
        <Row k="笔记" v={`${data.notes.length} 篇`} />
        <Row k="代码片段" v={`${data.snippets.length} 个`} />
        <Row k="书签" v={`${data.links.length} 个`} />
        <Row k="生活集合 / 条目" v={`${data.collections.length} 集合 · ${data.lifeItems.length} 条`} />
        <Row k="密钥" v={`${data.secrets.length} 条`} />
        <Row k="存储位置" v="本机浏览器（IndexedDB，加密）" />
      </Section>

      <Section title="自动锁定">
        <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", marginBottom: 10 }}>闲置一段时间后自动锁定，需重新输入主密码。</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {LOCK_OPTS.map((o) => (
            <button key={o.v} onClick={() => updateSettings({ autoLockMin: o.v })}
              style={{ padding: "8px 14px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", border: settings.autoLockMin === o.v ? "1.5px solid var(--accent)" : "0.5px solid var(--separator)", background: settings.autoLockMin === o.v ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "var(--bg-elevated)", color: settings.autoLockMin === o.v ? "var(--accent)" : "var(--text-secondary)" }}>{o.l}</button>
          ))}
        </div>
      </Section>

      <Section title="备份与迁移">
        <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 12 }}>
          导出的是<strong>加密文件</strong>（没有主密码打不开）。拷到另一台机器用「导入」载入、输入主密码即可使用——这就是多机共享的方式。
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Btn variant="soft" onClick={exportVault}>导出加密文件</Btn>
          <input ref={fileRef} type="file" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f); e.currentTarget.value = ""; }} />
          <Btn variant="ghost" onClick={() => fileRef.current?.click()}>导入（替换本机）</Btn>
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
        🔒 主密码用 PBKDF2 派生密钥、AES-256-GCM 加密整库；主密码不保存、不上传，<strong>遗失无法找回</strong>。请牢记主密码并定期导出备份。所有数据仅存于本机。
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
