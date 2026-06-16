import { useState } from "react";
import { useVault } from "../vault/VaultContext";
import { passwordStrength } from "../lib/crypto";
import { defaultDataset } from "../data/defaultData";
import { IconShield, IconArrowRight, IconClock } from "../icons";
import { Btn, TextField } from "../ui";

export default function Unlock() {
  const vault = useVault();
  const onboard = vault.status === "onboard";
  const name = defaultDataset.vaultName;

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const strength = passwordStrength(pw);

  const submit = async () => {
    setErr("");
    if (onboard) {
      if (pw.length < 6) return setErr("主密码至少 6 位");
      if (pw !== pw2) return setErr("两次输入不一致");
      setBusy(true);
      await vault.create(pw);
    } else {
      setBusy(true);
      const ok = await vault.unlock(pw);
      setBusy(false);
      if (!ok) { setErr("主密码错误"); setPw(""); }
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--wallpaper)", padding: 32 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, width: 320, animation: "fvRise .3s ease" }}>
        <div style={{ width: 64, height: 64, borderRadius: 17, background: "linear-gradient(160deg,var(--accent),#5E5CE6)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 30px var(--accent-soft)" }}>
          <IconShield size={30} stroke="#fff" />
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>{onboard ? `欢迎使用 ${name}` : `${name}已锁定`}</div>
          <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 5 }}>
            {onboard ? "设置主密码以加密保护全部数据" : "输入主密码以解锁全部内容"}
          </div>
        </div>

        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
          <TextField
            type="password" autoFocus value={pw} placeholder={onboard ? "设置主密码" : "主密码"}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !onboard) submit(); }}
          />
          {onboard && (
            <>
              <TextField type="password" value={pw2} placeholder="再次输入" onChange={(e) => setPw2(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, height: 5, borderRadius: 3, background: "var(--track)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(strength.score / 4) * 100}%`, background: strength.score >= 3 ? "var(--green)" : strength.score >= 2 ? "var(--orange)" : "var(--red)", transition: "width .2s" }} />
                </div>
                <span style={{ fontSize: 11, color: "var(--text-tertiary)", width: 28 }}>{pw ? strength.label : ""}</span>
              </div>
            </>
          )}
          {err && <div style={{ fontSize: 12, color: "var(--red)", textAlign: "center" }}>{err}</div>}
          <Btn onClick={submit} disabled={busy} style={{ height: 40, marginTop: 2 }}>
            {busy ? "处理中…" : onboard ? "创建金库" : "解锁"}
            {!busy && <IconArrowRight size={15} stroke="#fff" />}
          </Btn>
        </div>

        {onboard ? (
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", textAlign: "center", lineHeight: 1.6, maxWidth: 280 }}>
            ⚠️ 主密码无法找回，一旦遗忘将无法解密数据。<br />数据使用 AES-256 加密，仅保存在本机。
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--text-tertiary)" }}>
            <IconClock /> 本地加密 · 数据已从内存清除
          </div>
        )}
      </div>
    </div>
  );
}
