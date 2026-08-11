import { useMemo, useState } from "react";
import type { Account, AccountCycle, AccountDomain, AccountKind } from "../../types";
import { useVault } from "../../lib/vault";
import { Btn, TextField, TextArea, Select, Segmented, card, inputStyle, EmptyState } from "../../ui";
import { IconPlus, IconSearch, IconGear, IconClose, IconEye, IconEyeOff, IconCopy, IconLink, IconCard, IconCheck } from "../../icons";
import { uid } from "./shared";
import { CATEGORIES, CURRENCIES, fmtMoney, daysUntil, dateTone, toneColor, accountAlerts, totalsByCurrency } from "../../lib/accounts";

type Mut = (fn: (d: import("../../types").DevData) => void) => void;

const EMOJI: Record<string, string> = {
  "AI 模型": "🤖", "云服务": "☁️", "代码托管": "🐙", "订阅服务": "🔄", "域名 / 服务器": "🖥️", "数据 / API": "🔌",
  "餐饮": "🍜", "美发美容": "💈", "洗车养车": "🚗", "健身": "🏋️", "咖啡饮品": "☕", "超市会员": "🛒", "娱乐": "🎮", "出行": "🚕",
};
const emojiFor = (a: Account) => EMOJI[a.category ?? ""] ?? (a.domain === "work" ? "💼" : "🧾");
const KIND_LABEL: Record<AccountKind, string> = { subscription: "订阅", prepaid: "预付" };
const agoText = (ts?: number) => { if (!ts) return ""; const d = Math.floor((Date.now() - ts) / 86400000); return d <= 0 ? "今天更新" : d === 1 ? "昨天更新" : `${d} 天前更新`; };
// 与 Bookmarks 一致的 normalize/白名单：无协议补 https://；javascript:/data: 等其他 scheme 一律拒绝（返回 null，渲染成纯文本）
const safeUrl = (u: string) => { const t = u.trim(); if (/^https?:\/\//i.test(t)) return t; if (!t || /^[a-z][\w+.-]*:/i.test(t)) return null; return "https://" + t; };

export default function Accounts({ data, mut }: { data: import("../../types").DevData; mut: Mut }) {
  const { copy } = useVault();
  const [domain, setDomain] = useState<AccountDomain>("work");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Account | null>(null);
  const [shown, setShown] = useState<Set<string>>(new Set());
  const toggleShow = (k: string) => setShown((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const all = data.accounts ?? [];
  const inDomain = all.filter((a) => a.domain === domain);
  const ql = q.trim().toLowerCase();
  const list = ql ? inDomain.filter((a) => (a.name + " " + (a.category ?? "") + " " + (a.login ?? "") + " " + (a.note ?? "")).toLowerCase().includes(ql)) : inDomain;

  const alerts = useMemo(() => accountAlerts(inDomain), [inDomain]);
  const totals = useMemo(() => totalsByCurrency(inDomain), [inDomain]);

  const save = (a: Account) => { mut((d) => { const i = d.accounts.findIndex((x) => x.id === a.id); if (i >= 0) d.accounts[i] = { ...a, updatedAt: Date.now() }; else d.accounts.unshift(a); }); setEdit(null); };
  const del = (id: string) => { mut((d) => { d.accounts = d.accounts.filter((x) => x.id !== id); }); setEdit(null); };
  const newAccount = () => setEdit({
    id: uid("a"), domain, name: "", category: "", kind: "prepaid",
    currency: domain === "work" ? "$" : "¥", balance: undefined, balanceAt: Date.now(), createdAt: Date.now(), updatedAt: Date.now(),
  });

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <Segmented<AccountDomain> value={domain} onChange={(v) => { setDomain(v); setQ(""); }} style={{ flex: "none", width: 240 }}
          options={[{ value: "work", label: "工作账户" }, { value: "life", label: "生活储值卡" }]} />
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 12px", borderRadius: 10, background: "var(--fill-q)", border: "0.5px solid var(--separator)" }}>
          <IconSearch /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={domain === "work" ? "搜索账户（名称 / 类别 / 账号）" : "搜索储值卡（商家 / 类别）"} style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 13, color: "var(--text-primary)" }} />
        </div>
        <Btn onClick={newAccount}><IconPlus size={15} />新建</Btn>
      </div>

      {/* 一眼看到：还躺着多少钱 + 需要留意的 */}
      {(Object.keys(totals).length > 0 || alerts.length > 0) && (
        <div style={{ ...card, padding: "13px 16px", marginBottom: 16, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14 }}>
          {Object.keys(totals).length > 0 && (
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{domain === "work" ? "账上余额合计" : "外面还躺着"}</span>
              <span style={{ fontSize: 19, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
                {Object.entries(totals).map(([c, n]) => fmtMoney(n, c)).join("  ·  ")}
              </span>
            </div>
          )}
          {alerts.length > 0 && <div style={{ width: 1, height: 22, background: "var(--separator)" }} />}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, flex: 1 }}>
            {alerts.slice(0, 6).map((al, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: toneColor(al.tone), background: `color-mix(in srgb, ${toneColor(al.tone)} 12%, transparent)`, padding: "3px 9px", borderRadius: 7 }}>
                <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>{al.account.name}</span>{al.text}
              </span>
            ))}
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState icon={<IconCard size={26} stroke="var(--text-tertiary)" />}
          title={q ? "没有匹配的账户" : domain === "work" ? "还没有工作账户" : "还没有储值卡"}
          text={q ? undefined : domain === "work"
            ? "把 Claude / DeepSeek / 阿里云 / GitHub 这些账户记下来：余额、订阅续费、登录信息都集中在这。"
            : "把你充过钱的地方记下来：那家餐厅、理发店、洗车、健身……别忘了里面还有余额。"}
          action={!q && <Btn onClick={newAccount}><IconPlus size={15} />新建{domain === "work" ? "账户" : "储值卡"}</Btn>} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12, alignItems: "start" }}>
          {list.map((a) => {
            const renewDays = a.kind === "subscription" ? daysUntil(a.renewAt) : null;
            const renewT = dateTone(renewDays);
            const expDays = daysUntil(a.expireAt);
            const expT = dateTone(expDays);
            const low = a.kind === "prepaid" && a.balance != null && a.lowBalance != null && a.balance <= a.lowBalance;
            const revealed = shown.has(a.id);
            const urlHref = a.url ? safeUrl(a.url) : null;
            return (
              <div key={a.id} style={{ ...card, padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
                  <span style={{ fontSize: 18 }}>{emojiFor(a)}</span>
                  <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-primary)", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name || "未命名"}</span>
                  {a.category && <span style={{ fontSize: 10.5, color: "var(--text-tertiary)" }}>{a.category}</span>}
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-secondary)", background: "var(--fill-q)", border: "0.5px solid var(--separator)", padding: "1px 7px", borderRadius: 5 }}>{KIND_LABEL[a.kind]}</span>
                  <button className="fv-icnbtn" onClick={() => setEdit(a)} title="编辑" style={icnBtn}><IconGear size={14} stroke="currentColor" /></button>
                </div>

                {/* 金额区 */}
                <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
                  {a.balance != null && (
                    <div>
                      <div style={{ fontSize: 23, fontWeight: 700, color: low ? "var(--orange)" : "var(--text-primary)", fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>{fmtMoney(a.balance, a.currency)}</div>
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>余额{a.balanceAt ? " · " + agoText(a.balanceAt) : ""}{low ? " · 偏低" : ""}</div>
                    </div>
                  )}
                  {a.kind === "subscription" && (a.price != null || a.renewAt) && (
                    <div style={{ marginLeft: a.balance != null ? "auto" : 0, textAlign: a.balance != null ? "right" : "left" }}>
                      {a.price != null && <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{fmtMoney(a.price, a.currency)}<span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 400 }}>/{a.cycle === "year" ? "年" : "月"}</span></div>}
                      {a.renewAt && <div style={{ fontSize: 11.5, fontWeight: 600, color: toneColor(renewT.tone), marginTop: 2 }}>续费 {renewT.text || a.renewAt}</div>}
                    </div>
                  )}
                </div>

                {/* 到期 / 提醒 chip */}
                {a.expireAt && (
                  <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: toneColor(expT.tone) }}>
                    <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}>有效期</span>{expDays != null && expDays < 0 ? `已过期 ${-expDays} 天` : (expT.text || a.expireAt)}
                  </div>
                )}

                {/* 账户信息 */}
                {(a.login || a.secret || a.url || a.phone) && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
                    {a.login && <InfoRow label={a.domain === "work" ? "账号" : "卡号 / 手机"} value={a.login} onCopy={() => copy(a.login!, a.domain === "work" ? "账号" : "卡号")} />}
                    {a.secret && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--fill-q)", border: "0.5px solid var(--separator)", borderRadius: 8, padding: "6px 9px" }}>
                        <span style={{ fontSize: 11.5, color: "var(--text-tertiary)", width: 64, flex: "none" }}>密码 / Key</span>
                        <span style={{ flex: 1, minWidth: 0, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{revealed ? a.secret : "•".repeat(Math.min(14, Math.max(6, a.secret.length)))}</span>
                        <button className="fv-icnbtn" onClick={() => toggleShow(a.id)} title={revealed ? "隐藏" : "显示"} style={icnBtn}>{revealed ? <IconEyeOff size={14} stroke="currentColor" /> : <IconEye size={14} stroke="currentColor" />}</button>
                        <button className="fv-icnbtn" onClick={() => copy(a.secret!, "密码")} title="复制" style={icnBtn}><IconCopy size={13} stroke="currentColor" /></button>
                      </div>
                    )}
                    {a.url && (urlHref
                      ? <a href={urlHref} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--accent)", textDecoration: "none" }}><IconLink size={12} stroke="currentColor" />{a.url.replace(/^https?:\/\//, "")}</a>
                      : <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-tertiary)" }}><IconLink size={12} stroke="currentColor" />{a.url}</span>)}
                    {a.phone && <InfoRow label="电话" value={a.phone} onCopy={() => copy(a.phone!, "电话")} />}
                  </div>
                )}

                {a.note && <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 9, lineHeight: 1.6 }}>{a.note}</div>}
              </div>
            );
          })}
        </div>
      )}

      {edit && <AccountEditor key={edit.id} initial={edit} isNew={!all.some((x) => x.id === edit.id)} onClose={() => setEdit(null)} onSave={save} onDelete={() => del(edit.id)} />}
    </div>
  );
}

function InfoRow({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--fill-q)", border: "0.5px solid var(--separator)", borderRadius: 8, padding: "6px 9px" }}>
      <span style={{ fontSize: 11.5, color: "var(--text-tertiary)", width: 64, flex: "none" }}>{label}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</span>
      <button className="fv-icnbtn" onClick={onCopy} title="复制" style={icnBtn}><IconCopy size={13} stroke="currentColor" /></button>
    </div>
  );
}

function AccountEditor({ initial, isNew, onClose, onSave, onDelete }: { initial: Account; isNew: boolean; onClose: () => void; onSave: (a: Account) => void; onDelete: () => void }) {
  const [a, setA] = useState<Account>(initial);
  const [balanceStr, setBalanceStr] = useState(initial.balance != null ? String(initial.balance) : "");
  const [lowStr, setLowStr] = useState(initial.lowBalance != null ? String(initial.lowBalance) : "");
  const [priceStr, setPriceStr] = useState(initial.price != null ? String(initial.price) : "");
  const work = a.domain === "work";
  const num = (s: string): number | undefined => { const v = parseFloat(s); return isNaN(v) ? undefined : v; };

  const submit = () => {
    const balance = num(balanceStr);
    const changed = balance !== initial.balance;
    onSave({
      ...a,
      name: a.name.trim(),
      balance,
      balanceAt: balance != null ? (changed ? Date.now() : (a.balanceAt ?? Date.now())) : undefined,
      lowBalance: a.kind === "prepaid" ? num(lowStr) : undefined,
      price: a.kind === "subscription" ? num(priceStr) : undefined,
      cycle: a.kind === "subscription" ? (a.cycle ?? "month") : undefined,
    });
  };

  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.34)", backdropFilter: "blur(2px)", animation: "fvFade .15s ease" }}>
      <div style={{ ...card, width: 580, maxWidth: "92%", maxHeight: "90%", display: "flex", flexDirection: "column", overflow: "hidden", animation: "fvPop .18s ease" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "14px 20px", borderBottom: "0.5px solid var(--separator)" }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{isNew ? "新建" : "编辑"}{work ? "工作账户" : "生活储值卡"}</div><div style={{ flex: 1 }} />
          <button className="fv-icnbtn" onClick={onClose} style={icnBtn}><IconClose size={17} stroke="currentColor" /></button>
        </div>
        <div style={{ padding: "16px 20px", overflowY: "auto" }}>
          <Row>
            <L label="名称" flex={1.4}><TextField value={a.name} onChange={(e) => setA({ ...a, name: e.target.value })} placeholder={work ? "Claude Code / 阿里云" : "那家川菜馆 / 楼下理发店"} autoFocus /></L>
            <L label="类型" flex={1}><Segmented<AccountKind> value={a.kind} onChange={(v) => setA({ ...a, kind: v })} options={[{ value: "prepaid", label: "预付余额" }, { value: "subscription", label: "订阅" }]} /></L>
          </Row>
          <Row>
            <L label="类别" flex={1.4}>
              <input list="acc-cats" value={a.category ?? ""} onChange={(e) => setA({ ...a, category: e.target.value })} placeholder="选择或输入" style={{ ...inputStyle, height: 36, padding: "0 12px" }} />
              <datalist id="acc-cats">{CATEGORIES[a.domain].map((c) => <option key={c} value={c} />)}</datalist>
            </L>
            <L label="币种" flex={1}><Select value={a.currency} onChange={(e) => setA({ ...a, currency: e.target.value })} options={CURRENCIES.map((c) => ({ value: c, label: c }))} /></L>
          </Row>
          <Row>
            <L label="当前余额" flex={1}><TextField value={balanceStr} onChange={(e) => setBalanceStr(e.target.value)} inputMode="decimal" placeholder="还剩多少" /></L>
            {a.kind === "prepaid"
              ? <L label="低余额预警" flex={1}><TextField value={lowStr} onChange={(e) => setLowStr(e.target.value)} inputMode="decimal" placeholder="低于此值提醒（可选）" /></L>
              : <L label="有效期 / 到期" flex={1}><input type="date" value={a.expireAt ?? ""} onChange={(e) => setA({ ...a, expireAt: e.target.value || undefined })} style={{ ...inputStyle, height: 36, padding: "0 12px" }} /></L>}
          </Row>
          {a.kind === "subscription" && (
            <Row>
              <L label="续费周期" flex={1}><Select value={a.cycle ?? "month"} onChange={(e) => setA({ ...a, cycle: e.target.value as AccountCycle })} options={[{ value: "month", label: "每月" }, { value: "year", label: "每年" }]} /></L>
              <L label="每期金额" flex={1}><TextField value={priceStr} onChange={(e) => setPriceStr(e.target.value)} inputMode="decimal" placeholder="如 20" /></L>
              <L label="下次续费日" flex={1}><input type="date" value={a.renewAt ?? ""} onChange={(e) => setA({ ...a, renewAt: e.target.value || undefined })} style={{ ...inputStyle, height: 36, padding: "0 12px" }} /></L>
            </Row>
          )}
          <Row>
            <L label={work ? "登录账号" : "卡号 / 绑定手机"} flex={1}><TextField value={a.login ?? ""} onChange={(e) => setA({ ...a, login: e.target.value || undefined })} placeholder={work ? "邮箱 / 用户名" : "会员卡号或手机号"} /></L>
            {work
              ? <L label="控制台 / 官网" flex={1}><TextField value={a.url ?? ""} onChange={(e) => setA({ ...a, url: e.target.value || undefined })} placeholder="https://" /></L>
              : <L label="商家电话" flex={1}><TextField value={a.phone ?? ""} onChange={(e) => setA({ ...a, phone: e.target.value || undefined })} placeholder="可选" /></L>}
          </Row>
          <L label={work ? "密码 / API Key（打码保存，可复制）" : "密码 / 取餐码（打码保存）"}><TextField value={a.secret ?? ""} onChange={(e) => setA({ ...a, secret: e.target.value || undefined })} placeholder="可选，列表里默认打码" style={{ fontFamily: "ui-monospace, monospace" }} /></L>
          {work && a.kind === "prepaid" && <L label="有效期 / 到期"><input type="date" value={a.expireAt ?? ""} onChange={(e) => setA({ ...a, expireAt: e.target.value || undefined })} style={{ ...inputStyle, height: 36, padding: "0 12px" }} /></L>}
          <L label="备注"><TextArea value={a.note ?? ""} onChange={(e) => setA({ ...a, note: e.target.value || undefined })} placeholder="比如：哪张卡绑的、谁推荐的、注意事项" /></L>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 20px", borderTop: "0.5px solid var(--separator)" }}>
          {!isNew && <Btn variant="danger" onClick={onDelete}>删除</Btn>}
          <div style={{ flex: 1 }} />
          <Btn variant="ghost" onClick={onClose}>取消</Btn>
          <Btn onClick={submit} disabled={!a.name.trim()}><IconCheck size={15} stroke="#fff" />保存</Btn>
        </div>
      </div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) { return <div style={{ display: "flex", gap: 12 }}>{children}</div>; }
function L({ label, children, flex }: { label: string; children: React.ReactNode; flex?: number }) {
  return (
    <label style={{ display: "block", marginBottom: 12, flex: flex ?? "1 1 100%", minWidth: 0 }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-tertiary)", marginBottom: 5, letterSpacing: ".02em" }}>{label}</div>
      {children}
    </label>
  );
}

const icnBtn: React.CSSProperties = { width: 28, height: 28, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 7, background: "transparent", border: "none", cursor: "pointer", color: "var(--text-tertiary)" };
