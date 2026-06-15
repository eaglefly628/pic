import React, { useRef, useState } from "react";
import { useVault } from "../vault/VaultContext";
import { useTheme } from "../lib/theme";
import { passwordStrength } from "../lib/crypto";
import { clearVault, exportBlobString, importBlobString } from "../lib/storage";
import { Btn, Field, Select, TextField, card } from "../ui";
import { IconDownload, IconUpload, IconCheck } from "../icons";

export default function Settings() {
  const { data, update, changePassword, lock, reload } = useVault();
  const { theme, toggle } = useTheme();
  const importRef = useRef<HTMLInputElement>(null);

  const [pw, setPw] = useState(""); const [pw2, setPw2] = useState(""); const [pwMsg, setPwMsg] = useState("");
  const [vname, setVname] = useState(data?.dataset.vaultName ?? "");
  const [uname, setUname] = useState(data?.dataset.userName ?? "");
  const [savedName, setSavedName] = useState(false);
  const autoLock = data?.settings.autoLockMin ?? 5;
  const clip = data?.settings.clipboardClearSec ?? 30;

  const saveNames = () => {
    update((d) => {
      d.dataset.vaultName = vname.trim() || d.dataset.vaultName;
      d.dataset.userName = uname.trim() || d.dataset.userName;
    });
    setSavedName(true);
    setTimeout(() => setSavedName(false), 2000);
  };

  const doChangePw = async () => {
    setPwMsg("");
    if (pw.length < 6) return setPwMsg("新密码至少 6 位");
    if (pw !== pw2) return setPwMsg("两次输入不一致");
    await changePassword(pw);
    setPw(""); setPw2(""); setPwMsg("ok");
    setTimeout(() => setPwMsg(""), 2500);
  };

  const exportBackup = () => {
    const s = exportBlobString();
    if (!s) return;
    const blob = new Blob([s], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `familyvault-backup-${new Date().toISOString().slice(0, 10)}.vault`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const onImportFile = async (file: File) => {
    const text = await file.text();
    if (importBlobString(text)) {
      alert("备份已导入。请用该备份对应的主密码重新解锁。");
      reload();
    } else {
      alert("文件无效，导入失败。");
    }
  };

  const resetAll = () => {
    if (!confirm("确定要删除本机金库及全部数据吗？此操作不可恢复（建议先导出备份）。")) return;
    clearVault();
    reload();
  };

  const st = passwordStrength(pw);

  return (
    <div style={{ padding: "24px 32px 40px", animation: "fvFade 0.3s ease", maxWidth: 720, display: "flex", flexDirection: "column", gap: 16 }}>
      {/* 金库 */}
      <Section title="金库">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="金库名称"><TextField value={vname} onChange={(e) => setVname(e.target.value)} /></Field>
          <Field label="户主名称"><TextField value={uname} onChange={(e) => setUname(e.target.value)} /></Field>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Btn onClick={saveNames}>保存名称</Btn>
          {savedName && <span style={{ fontSize: 12.5, color: "var(--green)", display: "flex", alignItems: "center", gap: 4 }}><IconCheck stroke="var(--green)" />已保存</span>}
        </div>
      </Section>

      {/* 安全 */}
      <Section title="安全">
        <Row label="自动锁定" hint="闲置超时后锁定并从内存清除数据">
          <Select style={{ width: 140 }} value={String(autoLock)} onChange={(e) => update((d) => { d.settings.autoLockMin = Number(e.target.value); })}
            options={[{ value: "1", label: "1 分钟" }, { value: "5", label: "5 分钟" }, { value: "15", label: "15 分钟" }, { value: "30", label: "30 分钟" }, { value: "0", label: "关闭" }]} />
        </Row>
        <Row label="剪贴板清空" hint="复制密码后自动清空剪贴板">
          <Select style={{ width: 140 }} value={String(clip)} onChange={(e) => update((d) => { d.settings.clipboardClearSec = Number(e.target.value); })}
            options={[{ value: "15", label: "15 秒" }, { value: "30", label: "30 秒" }, { value: "60", label: "60 秒" }, { value: "0", label: "不清空" }]} />
        </Row>
        <Row label="立即锁定" hint="手动锁定金库"><Btn variant="ghost" onClick={lock}>锁定</Btn></Row>
      </Section>

      {/* 修改主密码 */}
      <Section title="修改主密码">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="新主密码"><TextField type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
          <Field label="确认新密码"><TextField type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></Field>
        </div>
        {pw && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: -4, marginBottom: 12 }}>
            <div style={{ flex: 1, height: 4, borderRadius: 2, background: "var(--track)", overflow: "hidden", maxWidth: 200 }}>
              <div style={{ height: "100%", width: `${(st.score / 4) * 100}%`, background: st.score >= 3 ? "var(--green)" : st.score >= 2 ? "var(--orange)" : "var(--red)" }} />
            </div>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{st.label}</span>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Btn onClick={doChangePw}>更新主密码</Btn>
          {pwMsg === "ok" ? <span style={{ fontSize: 12.5, color: "var(--green)", display: "flex", alignItems: "center", gap: 4 }}><IconCheck stroke="var(--green)" />已更新</span>
            : pwMsg && <span style={{ fontSize: 12.5, color: "var(--red)" }}>{pwMsg}</span>}
        </div>
      </Section>

      {/* 外观 */}
      <Section title="外观">
        <Row label="主题" hint="浅色 / 深色"><Btn variant="ghost" onClick={toggle}>{theme === "light" ? "🌙 切换深色" : "☀️ 切换浅色"}</Btn></Row>
      </Section>

      {/* 备份 */}
      <Section title="备份与恢复">
        <Row label="导出加密备份" hint="导出 .vault 文件（仍为加密，需主密码解锁）"><Btn variant="ghost" onClick={exportBackup}><IconDownload />导出</Btn></Row>
        <Row label="从备份恢复" hint="导入 .vault 文件后用对应主密码解锁">
          <Btn variant="ghost" onClick={() => importRef.current?.click()}><IconUpload />导入</Btn>
          <input ref={importRef} type="file" accept=".vault,.json,.txt" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportFile(f); e.target.value = ""; }} />
        </Row>
      </Section>

      {/* 危险区 */}
      <Section title="危险区">
        <Row label="重置金库" hint="删除本机全部数据，无法恢复"><Btn variant="danger" onClick={resetAll}>删除全部数据</Btn></Row>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ ...card, padding: "18px 22px" }}>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "10px 0", borderTop: "0.5px solid var(--separator)" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{label}</div>
        {hint && <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 2 }}>{hint}</div>}
      </div>
      <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>{children}</div>
    </div>
  );
}
