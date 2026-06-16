import { useEffect, useMemo, useState } from "react";
import type { MediaItem } from "../types";
import { useLibrary } from "../lib/library";
import { MediaGrid } from "../components/Media";
import { Btn, EmptyState, TextField } from "../ui";
import { IconLock, IconArrowRight } from "../icons";

const HKEY = "familygallery.pwhash";
async function sha256(s: string): Promise<string> {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export default function Private({ onOpen }: { onOpen: (list: MediaItem[], i: number) => void }) {
  const { items } = useLibrary();
  const [status, setStatus] = useState<"loading" | "setup" | "locked" | "unlocked">("loading");
  const [pw, setPw] = useState(""); const [pw2, setPw2] = useState(""); const [err, setErr] = useState("");

  useEffect(() => { setStatus(localStorage.getItem(HKEY) ? "locked" : "setup"); }, []);

  const list = useMemo(() => items.filter((m) => m.private), [items]);

  const submit = async () => {
    setErr("");
    if (status === "setup") {
      if (pw.length < 4) return setErr("密码至少 4 位");
      if (pw !== pw2) return setErr("两次输入不一致");
      localStorage.setItem(HKEY, await sha256(pw));
      setStatus("unlocked");
    } else {
      const ok = (await sha256(pw)) === localStorage.getItem(HKEY);
      if (!ok) { setErr("密码错误"); setPw(""); return; }
      setStatus("unlocked");
    }
  };

  if (status === "loading") return null;

  if (status !== "unlocked") {
    const setup = status === "setup";
    return (
      <div style={{ padding: "60px 32px", display: "flex", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, width: 300 }}>
          <div style={{ width: 56, height: 56, borderRadius: 15, background: "linear-gradient(160deg,var(--accent),#5E5CE6)", display: "flex", alignItems: "center", justifyContent: "center" }}><IconLock size={26} stroke="#fff" /></div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>{setup ? "设置私密区密码" : "私密区已锁定"}</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{setup ? "用于保护私人照片/视频的访问" : "输入密码以查看私密内容"}</div>
          </div>
          <TextField type="password" autoFocus value={pw} placeholder={setup ? "设置密码" : "密码"} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !setup) submit(); }} />
          {setup && <TextField type="password" value={pw2} placeholder="再次输入" onChange={(e) => setPw2(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />}
          {err && <div style={{ fontSize: 12, color: "var(--red)" }}>{err}</div>}
          <Btn onClick={submit} style={{ height: 40, width: "100%" }}>{setup ? "设置并进入" : "解锁"}<IconArrowRight size={15} stroke="#fff" /></Btn>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", textAlign: "center", lineHeight: 1.6 }}>提示：当前为访问密码保护；文件本身的端到端加密为后续计划。</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 32px 40px", animation: "fvFade 0.3s ease" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
        <IconLock size={16} stroke="var(--accent)" />私密区<span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-tertiary)" }}>{list.length} 项</span>
      </div>
      {list.length ? <MediaGrid items={list} onOpenIndex={(i) => onOpen(list, i)} /> : <EmptyState icon={<IconLock size={26} stroke="var(--text-tertiary)" />} text="私密区为空。在查看大图时点锁形图标，或导入时勾选「私密」。" />}
    </div>
  );
}
