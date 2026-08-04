import { useCallback, useEffect, useMemo, useState } from "react";
import { Btn, card } from "../../ui";
import { IconRefresh, IconTrash } from "../../icons";

type Item = { path: string; label: string; bytes: number; isDir: boolean };
type Target = { id: string; label: string; desc: string; bytes: number; exists: boolean; permanentOnly: boolean };
type Disk = { total: number; used: number; free: number };

const fmtB = (b: number) =>
  b >= 1e9 ? (b / 1073741824).toFixed(2) + " GB" : b >= 1e6 ? Math.round(b / 1048576) + " MB" : b >= 1e3 ? Math.round(b / 1024) + " KB" : b + " B";

export default function Disk() {
  // 逐层浏览
  const [home, setHome] = useState("");
  const [path, setPath] = useState("");
  const [entries, setEntries] = useState<Item[] | null>(null);
  const [total, setTotal] = useState(0);       // 本层 du 真实总量（自身行）
  const [scanned, setScanned] = useState(0);   // 可见项之和
  const [disk, setDisk] = useState<Disk | null>(null);
  const [partial, setPartial] = useState(false);
  const [denied, setDenied] = useState(false);
  const [deniedPaths, setDeniedPaths] = useState<string[]>([]);
  const [exLoading, setExLoading] = useState(false);
  const [exErr, setExErr] = useState("");
  const [exMsg, setExMsg] = useState("");
  const [perm, setPerm] = useState(false);
  // 安全清理
  const [targets, setTargets] = useState<Target[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [cleanMsg, setCleanMsg] = useState("");

  const open = useCallback(async (p?: string) => {
    setExLoading(true); setExErr(""); setExMsg("");
    try {
      const url = p ? "/api/disk/ls?path=" + encodeURIComponent(p) : "/api/disk/scan";
      const d = await fetch(url).then((r) => r.json());
      if (!d.ok) setExErr(d.error || "读取失败");
      else {
        if (d.home) setHome(d.home);
        setPath(d.path || d.home || "");
        setEntries(d.items || []);
        setTotal(d.total || 0);
        setScanned(d.scanned ?? (d.items || []).reduce((s: number, i: Item) => s + i.bytes, 0));
        setDisk(d.disk || null);
        setPartial(!!d.partial);
        setDenied(!!d.denied);
        setDeniedPaths(Array.isArray(d.deniedPaths) ? d.deniedPaths : []);
      }
    } catch { setExErr("连不上本机服务——这个功能需要通过 run.py 从 http://localhost:5180 进入。"); }
    finally { setExLoading(false); }
  }, []);

  const loadTargets = useCallback(async () => {
    try { const d = await fetch("/api/disk/targets").then((r) => r.json()); setTargets(d.ok ? d.targets : []); }
    catch { setTargets([]); }
  }, []);
  useEffect(() => { loadTargets(); }, [loadTargets]);

  const inHome = (p: string) => !!home && (p === home || p.startsWith(home + "/"));

  const removeItem = async (it: Item) => {
    if (!inHome(it.path)) return;
    const verb = perm ? "永久删除" : "移到废纸篓";
    if (!confirm(`确定要${verb}吗？\n${it.label}\n${it.path}\n\n${perm ? "⚠️ 永久删除，不可恢复！" : "会移到废纸篓，可恢复。"}`)) return;
    setExMsg("处理中…");
    try {
      const d = await fetch("/api/disk/clean", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: it.path, contents: false, mode: perm ? "delete" : "trash" }) }).then((r) => r.json());
      if (d.ok) { setExMsg(`已${d.mode === "delete" ? "删除" : "移到废纸篓"}「${it.label}」，释放约 ${fmtB(d.freed)}`); open(path); loadTargets(); }
      else setExMsg("没成功：" + (d.error || ""));
    } catch { setExMsg("连不上本机服务"); }
  };

  const cleanTarget = async (t: Target) => {
    const permanent = !!t.permanentOnly;
    if (!confirm(`确定要${permanent ? "永久删除" : "移到废纸篓"}「${t.label}」吗？\n${permanent ? "⚠️ 不可恢复！" : "可在废纸篓里恢复。"}`)) return;
    setBusy(t.id); setCleanMsg("");
    try {
      const d = await fetch("/api/disk/clean", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: t.id, mode: permanent ? "delete" : "trash" }) }).then((r) => r.json());
      if (d.ok) { setCleanMsg(`已${d.mode === "delete" ? "删除" : "移到废纸篓"} ${d.count} 项，释放约 ${fmtB(d.freed)}`); loadTargets(); if (entries) open(path); }
      else setCleanMsg("没成功：" + (d.error || ""));
    } catch { setCleanMsg("连不上本机服务"); }
    finally { setBusy(null); }
  };

  // 绝对路径面包屑：整机(/) → … → 当前；命中用户目录时标注 ~
  const crumbs = useMemo(() => {
    if (!path) return [] as { label: string; path: string }[];
    const out = [{ label: "整机", path: "/" }];
    let cur = "";
    for (const s of path.split("/").filter(Boolean)) {
      cur += "/" + s;
      out.push({ label: home && cur === home ? "~ 用户目录" : s, path: cur });
    }
    return out;
  }, [home, path]);

  const maxB = Math.max(1, ...(entries || []).map((e) => e.bytes));
  const usedPct = disk && disk.total ? Math.min(100, (disk.used / disk.total) * 100) : 0;

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", marginBottom: 16, lineHeight: 1.7 }}>
        磁盘清理 · 由<strong>本机 run.py</strong> 执行（只在你本机、不联网）。可<strong>扫描整机</strong>或用户目录，点文件夹<strong>逐层钻进去</strong>看占用。
        删除只对<strong>用户目录（~）</strong>开放——系统区域只读、带🔒；默认<strong>移到废纸篓</strong>、删前确认。
      </div>

      {/* 磁盘总览（df 真实数据） */}
      {disk && (
        <div style={{ ...card, padding: "14px 18px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>磁盘总量</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
              已用 <strong style={{ color: "var(--text-primary)" }}>{fmtB(disk.used)}</strong> / 共 {fmtB(disk.total)} · 可用 {fmtB(disk.free)}
            </div>
          </div>
          <div style={{ height: 10, borderRadius: 6, background: "var(--fill-q)", overflow: "hidden", display: "flex" }}>
            <div style={{ width: `${usedPct}%`, background: "linear-gradient(90deg, var(--accent), var(--accent2))", borderRadius: 6 }} />
          </div>
        </div>
      )}

      {/* 逐层浏览 + 删除 */}
      <div style={{ ...card, padding: "16px 18px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: entries ? 12 : 0, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>谁在吃硬盘 · 逐层钻取</div>
            <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 2 }}>{entries ? "点文件夹进入下一层；用户目录里每项可删" : "先扫描用户目录或整机，按占用从大到小排列"}</div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: perm ? "var(--red)" : "var(--text-secondary)", cursor: "pointer", whiteSpace: "nowrap" }}>
            <input type="checkbox" checked={perm} onChange={(e) => setPerm(e.target.checked)} />永久删除
          </label>
          <div style={{ display: "flex", gap: 6 }}>
            <Btn variant="soft" onClick={() => open()} disabled={exLoading}>用户目录</Btn>
            <Btn variant="soft" onClick={() => open("/")} disabled={exLoading}>整机</Btn>
            <Btn onClick={() => open(path || undefined)} disabled={exLoading}><IconRefresh size={14} stroke="#fff" />{exLoading ? "扫描中…" : "刷新"}</Btn>
          </div>
        </div>

        {entries && (
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 2, marginBottom: 10, fontSize: 12.5 }}>
            {crumbs.map((c, i) => (
              <span key={c.path} style={{ display: "inline-flex", alignItems: "center" }}>
                {i > 0 && <span style={{ color: "var(--text-tertiary)", margin: "0 2px" }}>/</span>}
                <button onClick={() => open(c.path)} className="fv-tap" style={{ border: "none", background: "transparent", cursor: "pointer", color: i === crumbs.length - 1 ? "var(--text-primary)" : "var(--accent)", fontWeight: i === crumbs.length - 1 ? 600 : 500, padding: "2px 4px", fontSize: 12.5, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.label}</button>
              </span>
            ))}
          </div>
        )}

        {/* 本层合计 + 对账说明 */}
        {entries && entries.length > 0 && (
          <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginBottom: 10, lineHeight: 1.6, paddingBottom: 8, borderBottom: "0.5px solid var(--separator)" }}>
            本层合计 <strong style={{ color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>{fmtB(total)}</strong>
            {scanned > 0 && Math.abs(scanned - total) > total * 0.02 && <span>（可见 {fmtB(scanned)}）</span>}
            {partial && <span style={{ color: "var(--orange)" }}> · 目录太大未扫完，仅部分结果</span>}
            {path === "/" && disk && (
              <div style={{ marginTop: 4 }}>
                扫描合计通常<strong>小于上面的「已用」</strong>：APFS <strong>快照</strong>与<strong>可清除空间</strong>（系统数据）
                无法被逐文件统计——这部分差额是正常的，跟下面的权限问题是两回事。
              </div>
            )}
          </div>
        )}

        {/* 权限受限：这是"扫不全/用不了"最常见的原因，给到能直接照做的步骤 */}
        {denied && (
          <div style={{ ...card, background: "color-mix(in srgb, var(--orange) 8%, var(--bg-elevated))", border: "0.5px solid color-mix(in srgb, var(--orange) 30%, var(--separator))", padding: "12px 14px", marginBottom: 12 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--orange)", marginBottom: 4 }}>⚠️ 有些文件夹读不到，扫描结果偏少</div>
            {deniedPaths.length > 0 && (
              <div style={{ fontSize: 12, color: "var(--text-primary)", marginBottom: 4 }}>
                这一层具体读不到：<strong>{deniedPaths.join("、")}</strong>
              </div>
            )}
            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7 }}>
              macOS 默认保护 <strong>桌面 / 文稿 / 下载</strong> 等目录，没授权的话程序读不到里面的内容（不会报错，只是数不到、总量偏低）。去
              <strong> 系统设置 → 隐私与安全性 → 完全磁盘访问权限</strong>，把下面这个打勾：
            </div>
            <div style={{ fontSize: 12, color: "var(--text-primary)", margin: "6px 0", paddingLeft: 8, lineHeight: 1.8 }}>
              · 用 <code style={{ background: "var(--fill-q)", padding: "1px 5px", borderRadius: 4 }}>python3 run.py</code> 启动的 → 给 <strong>终端（Terminal）</strong>授权<br />
              · 用安装版 App 打开的 → 给 <strong>我家里的一切</strong>这个 App 本身授权
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <a href="x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles" style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "var(--orange)", padding: "6px 12px", borderRadius: 7, textDecoration: "none" }}>直接打开系统设置</a>
              <span style={{ fontSize: 11, color: "var(--text-tertiary)", alignSelf: "center" }}>勾上之后<strong>重启程序</strong>（退出 App 或 Ctrl+C 重跑 run.py）再扫一次才生效。</span>
            </div>
          </div>
        )}

        {exErr && <div style={{ fontSize: 12.5, color: "var(--orange)", marginTop: 8 }}>{exErr}</div>}
        {entries && entries.length === 0 && !exErr && !denied && <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", padding: "10px 0" }}>这个文件夹是空的。</div>}

        {entries && entries.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {entries.map((it) => {
              const canDel = inHome(it.path);
              return (
                <div key={it.path} className="fv-row" onClick={() => it.isDir && open(it.path)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 8px", borderRadius: 8, cursor: it.isDir ? "pointer" : "default" }} title={it.path}>
                  <span style={{ fontSize: 14, flex: "none", width: 18, textAlign: "center" }}>{it.isDir ? "📁" : "📄"}</span>
                  <span style={{ width: 150, flex: "none", fontSize: 12.5, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.label}</span>
                  <div style={{ flex: 1, minWidth: 30, height: 7, borderRadius: 4, background: "var(--fill-q)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.max(2, (it.bytes / maxB) * 100)}%`, background: it.isDir ? "var(--accent)" : "var(--text-tertiary)", borderRadius: 4 }} />
                  </div>
                  <span style={{ width: 70, flex: "none", textAlign: "right", fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{fmtB(it.bytes)}</span>
                  <span style={{ width: 12, flex: "none", color: "var(--text-tertiary)", fontSize: 13 }}>{it.isDir ? "›" : ""}</span>
                  {canDel ? (
                    <button className="fv-icnbtn" onClick={(e) => { e.stopPropagation(); removeItem(it); }} title={perm ? "永久删除" : "移到废纸篓"}
                      style={{ width: 28, height: 28, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 7, background: "transparent", border: "none", cursor: "pointer", color: perm ? "var(--red)" : "var(--text-tertiary)" }}><IconTrash size={14} stroke="currentColor" /></button>
                  ) : (
                    <span title="系统区域 · 只读（只能删用户目录 ~ 里的东西）" style={{ width: 28, height: 28, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "var(--text-tertiary)", opacity: 0.5 }}>🔒</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {exMsg && <div style={{ fontSize: 12.5, color: "var(--accent)", marginTop: 10 }}>{exMsg}</div>}
      </div>

      {/* 安全清理 */}
      <div style={{ ...card, padding: "16px 18px" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>安全清理 · 一键</div>
        <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginBottom: 12 }}>公认的垃圾（缓存 / 日志 / 开发缓存 / 废纸篓），清掉不影响使用。</div>
        {targets === null ? (
          <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", padding: "8px 0" }}>读取中…（需通过 run.py 进入）</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {targets.map((t) => (
              <div key={t.id} className="fv-row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 8px", borderRadius: 8, opacity: t.exists ? 1 : 0.5 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{t.label}{t.permanentOnly && <span style={{ fontSize: 10.5, color: "var(--red)", marginLeft: 6 }}>永久</span>}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.desc}</div>
                </div>
                <span style={{ width: 72, textAlign: "right", fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{t.exists ? fmtB(t.bytes) : "—"}</span>
                <Btn variant={t.permanentOnly ? "danger" : "soft"} onClick={() => cleanTarget(t)} disabled={!t.exists || t.bytes === 0 || busy === t.id}>{busy === t.id ? "清理中…" : t.permanentOnly ? "清空" : "清理"}</Btn>
              </div>
            ))}
          </div>
        )}
        {cleanMsg && <div style={{ fontSize: 12.5, color: "var(--accent)", marginTop: 12 }}>{cleanMsg}</div>}
      </div>
    </div>
  );
}
