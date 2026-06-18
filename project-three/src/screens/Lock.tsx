import { useRef, useState } from "react";
import { useVault } from "../lib/vault";
import { strength } from "../lib/generate";
import { Btn, card } from "../ui";
import { IconLock, IconEye, IconEyeOff } from "../icons";

const STR_LABEL = ["很弱", "弱", "一般", "强", "很强"];
const STR_COLOR = ["var(--red)", "var(--red)", "var(--orange)", "var(--green)", "var(--green)"];

export default function Lock() {
  const { status, setup, unlock, importVault } = useVault();
  const isSetup = status === "setup";
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    setErr("");
    if (isSetup) {
      if (pw.length < 8) { setErr("主密码至少 8 位"); return; }
      if (pw !== pw2) { setErr("两次输入不一致"); return; }
      setBusy(true); await setup(pw); setBusy(false);
    } else {
      setBusy(true);
      const ok = await unlock(pw);
      setBusy(false);
      if (!ok) { setErr("主密码错误"); setPw(""); }
    }
  };

  const onImport = async (f: File) => {
    setErr("");
    const r = await importVault(f);
    if (r === "bad") setErr("文件无法识别，请选择导出的 .vault 文件");
    else { setPw(""); setPw2(""); }
  };

  const s = strength(pw);
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "var(--bg)" }}>
      <div style={{ ...card, width: 380, maxWidth: "100%", padding: "34px 30px", animation: "fvPop .25s ease" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 22 }}>
          <div style={{ position: "relative", overflow: "hidden", width: 56, height: 56, borderRadius: 16, background: "linear-gradient(160deg, var(--accent), var(--accent2))", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
            <div aria-hidden className="fv-sheen" />
            <IconLock size={26} stroke="#fff" />
          </div>
          <div style={{ fontSize: 19, fontWeight: 700 }}>{isSetup ? "创建主密码" : "解锁保险库"}</div>
          <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", marginTop: 6, textAlign: "center", lineHeight: 1.6 }}>
            {isSetup ? "这是打开全家保险库的唯一钥匙。请务必牢记——它不会被保存，也无法找回。" : "输入主密码以解锁。所有数据都在本机本地解密。"}
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <div style={{ position: "relative", marginBottom: 12 }}>
            <input
              type={show ? "text" : "password"} value={pw} autoFocus placeholder="主密码"
              onChange={(e) => setPw(e.target.value)} autoComplete={isSetup ? "new-password" : "current-password"}
              style={inp}
            />
            <button type="button" onClick={() => setShow((v) => !v)} style={eyeBtn} tabIndex={-1}>
              {show ? <IconEyeOff stroke="var(--text-tertiary)" /> : <IconEye stroke="var(--text-tertiary)" />}
            </button>
          </div>

          {isSetup && (
            <>
              <input type={show ? "text" : "password"} value={pw2} placeholder="再次输入主密码" onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" style={{ ...inp, marginBottom: 12 }} />
              {pw && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <div style={{ flex: 1, height: 5, background: "var(--track)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(s / 4) * 100}%`, background: STR_COLOR[s], transition: "width .2s" }} />
                  </div>
                  <span style={{ fontSize: 11.5, color: STR_COLOR[s], fontWeight: 600 }}>{STR_LABEL[s]}</span>
                </div>
              )}
            </>
          )}

          {err && <div style={{ fontSize: 12.5, color: "var(--red)", marginBottom: 12 }}>{err}</div>}
          <Btn type="submit" full disabled={busy || !pw}>{busy ? "处理中…" : isSetup ? "创建保险库" : "解锁"}</Btn>
        </form>

        <div style={{ marginTop: 16, textAlign: "center" }}>
          <input ref={fileRef} type="file" accept=".vault,.json,application/json" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.currentTarget.value = ""; }} />
          <button onClick={() => fileRef.current?.click()} style={linkBtn}>
            {isSetup ? "已有保险库？从文件导入" : "导入其它保险库文件"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inp: React.CSSProperties = { width: "100%", padding: "12px 14px", fontSize: 15, borderRadius: 11, border: "0.5px solid var(--separator)", background: "var(--fill-q)", color: "var(--text-primary)" };
const eyeBtn: React.CSSProperties = { position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", padding: 6, display: "flex" };
const linkBtn: React.CSSProperties = { background: "none", border: "none", color: "var(--accent)", fontSize: 12.5, fontWeight: 500 };
