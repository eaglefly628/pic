import React, { useState } from "react";
import { useVault } from "../vault/VaultContext";
import { useTheme } from "../lib/theme";
import { passwordStrength } from "../lib/crypto";
import { clearAllVaultData, listBackups, addBackup, restoreBackup, deleteBackup, exportBlobString, importBlobString, MAX_BACKUPS, StorageFullError } from "../lib/storage";
import { hasPwBox, createPwBox, unlockPwBox, changePwBoxPassword, clearPwBox, pwSession } from "../vault/pwStore";
import { Btn, Field, Select, TextField, card } from "../ui";
import { IconDownload, IconUpload, IconCheck } from "../icons";

export default function Settings() {
  const { data, update, changePassword, lock, reload } = useVault();
  const { theme, toggle } = useTheme();

  const [pw, setPw] = useState(""); const [pw2, setPw2] = useState(""); const [pwMsg, setPwMsg] = useState("");
  const [vname, setVname] = useState(data?.dataset.vaultName ?? "");
  const [uname, setUname] = useState(data?.dataset.userName ?? "");
  const [savedName, setSavedName] = useState(false);
  const [backups, setBackups] = useState(() => listBackups());
  const [bkLabel, setBkLabel] = useState("");
  const autoLock = data?.settings.autoLockMin ?? 5;
  const clip = data?.settings.clipboardClearSec ?? 30;

  const [pwOn, setPwOn] = useState(hasPwBox());
  const [npw, setNpw] = useState(""); const [cpw, setCpw] = useState(""); const [pwBoxMsg, setPwBoxMsg] = useState("");

  const enablePwBox = async () => {
    setPwBoxMsg("");
    if (npw.length < 4) return setPwBoxMsg("密码至少 4 位");
    await createPwBox(npw, data?.passwords ?? []);
    update((d) => { d.passwords = []; }); // 已迁移到独立加密库
    pwSession.set(null); setPwOn(true); setNpw(""); setPwBoxMsg("ok");
    setTimeout(() => setPwBoxMsg(""), 2500);
  };
  const changePwBox = async () => {
    setPwBoxMsg("");
    if (npw.length < 4) return setPwBoxMsg("新密码至少 4 位");
    const r = await unlockPwBox(cpw);
    if (!r) return setPwBoxMsg("当前密码错误");
    await changePwBoxPassword(r.keys, npw);
    pwSession.set(null); setCpw(""); setNpw(""); setPwBoxMsg("ok");
    setTimeout(() => setPwBoxMsg(""), 2500);
  };
  const disablePwBox = async () => {
    setPwBoxMsg("");
    const r = await unlockPwBox(cpw);
    if (!r) return setPwBoxMsg("当前密码错误");
    update((d) => { d.passwords = r.items; }); // 迁回主金库
    clearPwBox(); pwSession.set(null); setPwOn(false); setCpw(""); setNpw("");
  };

  const refreshBk = () => setBackups(listBackups());
  const [bkMsg, setBkMsg] = useState("");
  const createBackup = () => {
    setBkMsg("");
    try {
      addBackup(bkLabel.trim() || `备份 ${new Date().toLocaleString("zh-CN")}`);
      setBkLabel("");
      refreshBk();
    } catch (e) {
      setBkMsg(e instanceof StorageFullError ? e.message : "创建还原点失败：" + (e instanceof Error ? e.message : String(e)));
    }
  };
  const restoreBk = (id: string) => {
    if (!confirm("恢复到该备份？当前数据会被替换（建议先创建一个当前备份）。恢复后需用该备份对应的主密码解锁。")) return;
    try { restoreBackup(id); reload(); }
    catch (e) { setBkMsg(e instanceof StorageFullError ? e.message : "恢复失败：" + (e instanceof Error ? e.message : String(e))); }
  };
  const deleteBk = (id: string) => { if (confirm("删除该备份？")) { deleteBackup(id); refreshBk(); } };

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

  const resetAll = () => {
    if (!confirm(
      "确定要删除本机全部数据吗？\n\n会一并删除：理财主数据、密码保险箱、独立管理、以及全部程序内还原点。\n" +
      "此操作不可恢复。建议先用下面的「导出金库文件」存一份。"
    )) return;
    clearAllVaultData();     // 以前只删了主金库，密码箱和独立管理会残留
    reload();
  };

  // ③ 导出/导入金库文件。以前 storage.ts 里这两个函数定义了却没人调用，
  //    而「重置金库」的确认框却写着「建议先导出备份」——指向一个不存在的按钮。
  const [ioMsg, setIoMsg] = useState("");
  const fileRef = React.useRef<HTMLInputElement>(null);
  const exportVaultFile = () => {
    const blob = exportBlobString();
    if (!blob) { setIoMsg("本机还没有金库可导出。"); return; }
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([blob], { type: "application/json" }));
    a.download = `家庭理财-金库-${stamp}.fvault`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    setIoMsg("已导出。文件仍是加密的，恢复时要用导出当时的那个主密码。");
  };
  const importVaultFile = async (f: File) => {
    setIoMsg("");
    if (!confirm(`用「${f.name}」替换本机当前的理财数据？\n\n当前数据会被覆盖，之后需用该文件对应的主密码解锁。`)) return;
    try {
      const text = await f.text();
      if (!importBlobString(text)) { setIoMsg("这个文件不是本应用导出的金库文件（或已损坏）。"); return; }
      reload();
    } catch (e) {
      setIoMsg(e instanceof StorageFullError ? e.message : "读取文件失败：" + (e instanceof Error ? e.message : String(e)));
    }
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

      {/* 密码保险箱二次验证 */}
      <Section title="密码保险箱 · 二次验证">
        {!pwOn ? (
          <>
            <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 12 }}>为密码保险箱单独设一道密码（与主密码独立）。启用后进入密码保险箱需再验证；已有密码会自动迁入独立加密库。</div>
            <div style={{ display: "flex", gap: 10 }}>
              <TextField type="password" value={npw} onChange={(e) => setNpw(e.target.value)} placeholder="设置二次验证密码（≥4 位）" />
              <Btn onClick={enablePwBox} style={{ whiteSpace: "nowrap" }}>启用</Btn>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 12.5, color: "var(--green)", marginBottom: 12 }}>已启用：密码保险箱由独立密码加密保护。</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 4 }}>
              <Field label="当前二次验证密码"><TextField type="password" value={cpw} onChange={(e) => setCpw(e.target.value)} /></Field>
              <Field label="新密码（用于修改）"><TextField type="password" value={npw} onChange={(e) => setNpw(e.target.value)} /></Field>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn onClick={changePwBox}>修改密码</Btn>
              <Btn variant="danger" onClick={disablePwBox}>关闭二次验证</Btn>
            </div>
          </>
        )}
        {pwBoxMsg === "ok" ? <div style={{ fontSize: 12.5, color: "var(--green)", marginTop: 10, display: "flex", alignItems: "center", gap: 4 }}><IconCheck stroke="var(--green)" />已完成</div> : pwBoxMsg && <div style={{ fontSize: 12.5, color: "var(--red)", marginTop: 10 }}>{pwBoxMsg}</div>}
      </Section>

      {/* 外观 */}
      <Section title="外观">
        <Row label="主题" hint="浅色 / 深色"><Btn variant="ghost" onClick={toggle}>{theme === "light" ? "🌙 切换深色" : "☀️ 切换浅色"}</Btn></Row>
      </Section>

      {/* 程序内备份 */}
      <Section title="程序内备份（命名还原点）">
        <div style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.7, marginBottom: 12 }}>
          还原点存在<strong>浏览器本机</strong>，和主数据同生共死——清浏览器数据会一起没。
          它是防误操作的快速回退，<strong>不能当灾难备份用</strong>；异地留底请用下面的「导出金库文件」或大厅的整屋导出。
          最多保留 {MAX_BACKUPS} 个，超出会自动挤掉最旧的。
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: backups.length ? 12 : 4 }}>
          <TextField value={bkLabel} onChange={(e) => setBkLabel(e.target.value)} placeholder="备份名称（如 月末盘点）" onKeyDown={(e) => { if (e.key === "Enter") createBackup(); }} />
          <Btn onClick={createBackup} style={{ whiteSpace: "nowrap" }}><IconDownload />创建备份</Btn>
        </div>
        {backups.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "var(--text-tertiary)" }}>还没有备份。创建后可随时一键恢复到该时间点（数据保存在本机）。</div>
        ) : (
          backups.map((b) => (
            <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: "0.5px solid var(--separator)" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{b.label}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>{new Date(b.createdAt).toLocaleString("zh-CN")}</div>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <Btn variant="soft" onClick={() => restoreBk(b.id)}>恢复</Btn>
                <Btn variant="ghost" onClick={() => deleteBk(b.id)}>删除</Btn>
              </div>
            </div>
          ))
        )}
      </Section>

      {bkMsg && (
        <div style={{ fontSize: 12.5, color: "var(--red)", lineHeight: 1.7, padding: "0 2px 4px" }}>{bkMsg}</div>
      )}

      {/* ③ 金库文件：只含理财这一个库，可拷到 U 盘异地留底 */}
      <Section title="金库文件（只含家庭理财）">
        <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 12 }}>
          导出成<strong>一个加密文件</strong>（<code>.fvault</code>），可以拷到 U 盘或云盘异地留底。
          文件本身是密文，<strong>恢复时要用导出当时的那个主密码</strong>。
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Btn onClick={exportVaultFile}><IconDownload />导出金库文件</Btn>
          <Btn variant="ghost" onClick={() => fileRef.current?.click()}><IconUpload size={15} stroke="currentColor" />从金库文件恢复…</Btn>
          <input ref={fileRef} type="file" accept=".fvault,.json,application/json" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importVaultFile(f); e.currentTarget.value = ""; }} />
        </div>
        {ioMsg && <div style={{ fontSize: 12.5, color: "var(--accent)", lineHeight: 1.7, marginTop: 10 }}>{ioMsg}</div>}
      </Section>

      {/* 整屋备份在大厅做 */}
      <Section title="整屋备份">
        <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.7 }}>
          想一次性备份<strong>全家所有世界</strong>（理财 + 影像 + 密码 + 各人的空间）请去<strong>大厅「设置 · 数据」</strong>，
          那里导出的是一个文件含全部。另外，<strong>从 <code>run.py</code> 启动时</strong>大厅会每隔一会儿自动把整屋数据写到本机磁盘并保留最近 40 份历史；
          如果是直接打开网页的，那条自动备份不生效，大厅顶栏会有红色提示。
        </div>
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
