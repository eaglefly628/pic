import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Bet, BetSport, BetStatus, DevData } from "../../types";
import { Btn, Segmented, TextField, card, inputStyle, EmptyState } from "../../ui";
import { IconPlus, IconClose, IconCheck, IconTrash, IconRefresh } from "../../icons";
import { uid } from "./shared";
import WorldCupModel from "./WorldCupModel";
import {
  profit, potential, summarize, STATUS_LABEL,
  fetchSports, type MatchT, type SportsResp,
  ymd, addDays, fmtKick,
} from "../../lib/bets";

type Mut = (fn: (d: DevData) => void) => void;
type View = "worldcup" | "basketball" | "bets";

const fmtMoney = (n: number, cur = "¥") => cur + Math.round(n).toLocaleString("zh-CN");
const fmtSigned = (n: number, cur = "¥") => (n > 0 ? "+" : n < 0 ? "−" : "") + cur + Math.abs(Math.round(n)).toLocaleString("zh-CN");
const STATUS_COLOR: Record<BetStatus, string> = { pending: "var(--orange)", won: "var(--green)", lost: "var(--red)", void: "var(--text-tertiary)" };

export default function Sports({ data, mut }: { data: DevData; mut: Mut }) {
  const [view, setView] = useState<View>("worldcup");
  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <Segmented<View> value={view} onChange={setView} style={{ width: 330 }}
          options={[{ value: "worldcup", label: "⚽ 世界杯" }, { value: "basketball", label: "🏀 篮球" }, { value: "bets", label: "我的下注" }]} />
      </div>
      {view === "worldcup" && <WorldCup data={data} mut={mut} />}
      {view === "basketball" && <Basketball data={data} mut={mut} />}
      {view === "bets" && <BetsLedger data={data} mut={mut} />}
    </div>
  );
}

// ── 世界杯：赛况(实时) + 我在世界杯的下注 ─────────────────────────
function WorldCup({ data, mut }: { data: DevData; mut: Mut }) {
  const [editing, setEditing] = useState<Bet | null>(null);
  const [wcTab, setWcTab] = useState<"live" | "model">("model");
  const bets = (data.bets ?? []).filter((b) => b.sport === "football");
  const sum = summarize(bets);

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 16 }}>
        <Segmented<"live" | "model"> value={wcTab} onChange={setWcTab} style={{ width: 320 }}
          options={[{ value: "model", label: "⚽ 数据模型" }, { value: "live", label: "赛况 · 下注" }]} />
      </div>
      {wcTab === "model" ? <WorldCupModel data={data} mut={mut} /> : (
      <>{/* 赛况 · 下注 */}
      {/* 我的世界杯战绩 */}
      <div style={{ ...card, padding: "16px 18px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: bets.length ? 14 : 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>⚽ 我在世界杯的下注</div>
            <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 2 }}>压了哪队 · 赔率 · 本金 · 赚亏，都在这——手动记，没人替你记你押了啥</div>
          </div>
          <Btn onClick={() => setEditing(newBet("football", "fifa.world"))}><IconPlus size={15} stroke="#fff" />记一笔</Btn>
        </div>
        {bets.length > 0 && <SummaryRow sum={sum} />}
        {bets.length > 0 && <BetList bets={bets} mut={mut} onEdit={setEditing} />}
      </div>

      {/* 世界杯赛况 */}
      <LivePanel title="🏆 世界杯赛况" league="fifa.world" emptyText="现在没有世界杯赛事（休赛期或赛程未开）。开赛期间这里会显示比分和接下来的对阵。" />

      {editing && <BetEditor key={editing.id} initial={editing} onClose={() => setEditing(null)}
        onSave={(b) => { saveBet(mut, b); setEditing(null); }} onDelete={() => { delBet(mut, editing.id); setEditing(null); }} />}
      </>
      )}
    </div>
  );
}

// ── 篮球：昨天 + 接下来 ───────────────────────────────────────
function Basketball({ data, mut }: { data: DevData; mut: Mut }) {
  const [editing, setEditing] = useState<Bet | null>(null);
  const bets = (data.bets ?? []).filter((b) => b.sport === "basketball");
  const today = new Date();
  const yest = ymd(addDays(today, -1));
  const tom = ymd(addDays(today, 1));

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>🏀 NBA</div>
          <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 2 }}>昨天打成啥样 · 接下来打谁</div>
        </div>
        <Btn variant="soft" onClick={() => setEditing(newBet("basketball", "nba"))}><IconPlus size={15} />记一笔</Btn>
      </div>
      {bets.length > 0 && (
        <div style={{ ...card, padding: "14px 18px", marginBottom: 16 }}>
          <SummaryRow sum={summarize(bets)} />
          <BetList bets={bets} mut={mut} onEdit={setEditing} />
        </div>
      )}
      <LivePanel title="昨天的比赛" league="nba" dates={yest} emptyText="昨天没有 NBA 比赛（季后赛结束 / 休赛期就会这样）。" />
      <div style={{ height: 16 }} />
      <LivePanel title="接下来" league="nba" dates={tom} emptyText="接下来这天暂无安排。" />

      {editing && <BetEditor key={editing.id} initial={editing} onClose={() => setEditing(null)}
        onSave={(b) => { saveBet(mut, b); setEditing(null); }} onDelete={() => { delBet(mut, editing.id); setEditing(null); }} />}
    </div>
  );
}

// ── 我的下注：全量台账 + 汇总 ─────────────────────────────────
function BetsLedger({ data, mut }: { data: DevData; mut: Mut }) {
  const [editing, setEditing] = useState<Bet | null>(null);
  const [filter, setFilter] = useState<"all" | BetStatus>("all");
  const all = data.bets ?? [];
  const sum = summarize(all);
  const list = filter === "all" ? all : all.filter((b) => b.status === filter);

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ ...card, padding: "18px 20px", marginBottom: 16 }}>
        <BigSummary sum={sum} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {(["all", "pending", "won", "lost", "void"] as const).map((f) => (
          <button key={f} className="fv-tap" onClick={() => setFilter(f)}
            style={{ border: "0.5px solid " + (filter === f ? "transparent" : "var(--separator)"), cursor: "pointer", fontSize: 12.5, fontWeight: 600, padding: "6px 12px", borderRadius: 9, color: filter === f ? "var(--bg-elevated)" : "var(--text-secondary)", background: filter === f ? "var(--text-primary)" : "var(--bg-elevated)" }}>
            {f === "all" ? "全部" : STATUS_LABEL[f]}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <Btn onClick={() => setEditing(newBet("football"))}><IconPlus size={15} stroke="#fff" />记一笔</Btn>
      </div>

      {all.length === 0 ? (
        <EmptyState icon={<span style={{ fontSize: 26 }}>🎟️</span>} title="还没有下注记录"
          text="记一笔：压了哪场、哪个队、赔率多少、押了多少钱。结算后标个赢/输，这里就帮你算赚了多少、亏了多少、回报率。"
          action={<Btn onClick={() => setEditing(newBet("football"))}><IconPlus size={15} stroke="#fff" />记一笔</Btn>} />
      ) : (
        <BetList bets={list} mut={mut} onEdit={setEditing} />
      )}

      {editing && <BetEditor key={editing.id} initial={editing} onClose={() => setEditing(null)}
        onSave={(b) => { saveBet(mut, b); setEditing(null); }} onDelete={() => { delBet(mut, editing.id); setEditing(null); }} />}
    </div>
  );
}

// ── 汇总展示 ────────────────────────────────────────────────
function SummaryRow({ sum }: { sum: ReturnType<typeof summarize> }) {
  return (
    <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 12.5 }}>
      <Stat label="净盈亏" value={fmtSigned(sum.net)} color={sum.net > 0 ? "var(--green)" : sum.net < 0 ? "var(--red)" : "var(--text-primary)"} big />
      <Stat label="赚" value={fmtMoney(sum.won)} color="var(--green)" />
      <Stat label="亏" value={fmtMoney(sum.lost)} color="var(--red)" />
      <Stat label="在押" value={fmtMoney(sum.atRisk)} />
      <Stat label="总投入" value={fmtMoney(sum.totalStaked)} />
    </div>
  );
}
function BigSummary({ sum }: { sum: ReturnType<typeof summarize> }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>净盈亏</div>
      <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", color: sum.net > 0 ? "var(--green)" : sum.net < 0 ? "var(--red)" : "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{fmtSigned(sum.net)}</div>
      <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
        已结算 {sum.settled} 笔 · 回报率 {(sum.roi * 100).toFixed(1)}%{sum.pending > 0 && ` · 还有 ${sum.pending} 笔待结算`}
      </div>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 12.5, marginTop: 14, paddingTop: 14, borderTop: "0.5px solid var(--separator)" }}>
        <Stat label="赚" value={fmtMoney(sum.won)} color="var(--green)" />
        <Stat label="亏" value={fmtMoney(sum.lost)} color="var(--red)" />
        <Stat label="在押（待结算本金）" value={fmtMoney(sum.atRisk)} color="var(--orange)" />
        <Stat label="总投入" value={fmtMoney(sum.totalStaked)} />
      </div>
    </div>
  );
}
function Stat({ label, value, color, big }: { label: string; value: string; color?: string; big?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: big ? 18 : 15, fontWeight: 700, color: color || "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

// ── 下注列表 ────────────────────────────────────────────────
function BetList({ bets, mut, onEdit }: { bets: Bet[]; mut: Mut; onEdit: (b: Bet) => void }) {
  const ordered = useMemo(() => [...bets].sort((a, b) => {
    const rank = (s: BetStatus) => (s === "pending" ? 0 : 1);
    return rank(a.status) - rank(b.status) || b.createdAt - a.createdAt;
  }), [bets]);
  if (!bets.length) return <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", padding: "16px 0" }}>这个筛选下没有记录。</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
      {ordered.map((b) => <BetRow key={b.id} b={b} mut={mut} onEdit={onEdit} />)}
    </div>
  );
}

function BetRow({ b, mut, onEdit }: { b: Bet; mut: Mut; onEdit: (b: Bet) => void }) {
  const cur = b.currency || "¥";
  const pnl = profit(b);
  const settle = (status: BetStatus) => mut((d) => { const i = (d.bets ?? []).findIndex((x) => x.id === b.id); if (i >= 0) d.bets[i] = { ...d.bets[i], status, updatedAt: Date.now() }; });
  return (
    <div className="fv-card-int" style={{ border: "0.5px solid var(--separator)", borderRadius: 12, padding: "12px 14px", background: "var(--bg-elevated)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span style={{ fontSize: 16, flex: "none", marginTop: 1 }}>{b.sport === "basketball" ? "🏀" : b.sport === "football" ? "⚽" : "🎟️"}</span>
        <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => onEdit(b)}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.match || "（未填比赛）"}</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 3 }}>
            压 <strong style={{ color: "var(--text-primary)" }}>{b.pick || "—"}</strong>
            <span style={{ color: "var(--text-tertiary)" }}> · 赔率 {b.odds} · 本金 {fmtMoney(b.stake, cur)}</span>
            {b.eventDate && <span style={{ color: "var(--text-tertiary)" }}> · {b.eventDate.slice(5)}</span>}
          </div>
          {b.note && <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 3 }}>{b.note}</div>}
        </div>
        <div style={{ textAlign: "right", flex: "none" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLOR[b.status], background: "color-mix(in srgb," + STATUS_COLOR[b.status] + " 12%, transparent)", padding: "2px 8px", borderRadius: 6 }}>{STATUS_LABEL[b.status]}</span>
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6, fontVariantNumeric: "tabular-nums", color: b.status === "won" ? "var(--green)" : b.status === "lost" ? "var(--red)" : "var(--text-tertiary)" }}>
            {b.status === "won" || b.status === "lost" ? fmtSigned(pnl, cur)
              : b.status === "pending" ? "可赢 " + fmtMoney(potential(b), cur) : "—"}
          </div>
        </div>
      </div>
      {b.status === "pending" && (
        <div style={{ display: "flex", gap: 8, marginTop: 10, paddingTop: 10, borderTop: "0.5px solid var(--separator)" }}>
          <span style={{ fontSize: 11.5, color: "var(--text-tertiary)", alignSelf: "center", marginRight: "auto" }}>结算：</span>
          <button className="fv-tap" onClick={() => settle("won")} style={pill("var(--green)")}>赢了</button>
          <button className="fv-tap" onClick={() => settle("lost")} style={pill("var(--red)")}>输了</button>
          <button className="fv-tap" onClick={() => settle("void")} style={pill("var(--text-tertiary)")}>取消/退</button>
        </div>
      )}
      {b.status !== "pending" && (
        <div style={{ display: "flex", marginTop: 8 }}>
          <button className="fv-tap" onClick={() => settle("pending")} style={{ ...pill("var(--text-tertiary)"), marginLeft: "auto", borderColor: "var(--separator)" }}>改回待结算</button>
        </div>
      )}
    </div>
  );
}
const pill = (color: string): React.CSSProperties => ({ border: "0.5px solid " + color, color, background: "transparent", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" });

// ── 编辑下注 ────────────────────────────────────────────────
function newBet(sport: BetSport, league?: string): Bet {
  const now = Date.now();
  return { id: uid("bet"), sport, league, match: "", pick: "", odds: 2, stake: 100, currency: "¥", status: "pending", createdAt: now, updatedAt: now };
}
function saveBet(mut: Mut, b: Bet) {
  mut((d) => {
    if (!d.bets) d.bets = [];
    const i = d.bets.findIndex((x) => x.id === b.id);
    const clean = { ...b, match: b.match.trim(), pick: b.pick.trim(), note: b.note?.trim() || undefined, updatedAt: Date.now() };
    if (i >= 0) d.bets[i] = clean; else d.bets.unshift(clean);
  });
}
function delBet(mut: Mut, id: string) { mut((d) => { d.bets = (d.bets ?? []).filter((x) => x.id !== id); }); }

function BetEditor({ initial, onClose, onSave, onDelete }: { initial: Bet; onClose: () => void; onSave: (b: Bet) => void; onDelete: () => void }) {
  const [b, setB] = useState<Bet>(initial);
  const isNew = !initial.match && !initial.pick;
  const payout = b.stake * b.odds;
  return (
    <Modal title={isNew ? "记一笔下注" : "下注"} onClose={onClose} footer={<>
      {!isNew && <Btn variant="danger" onClick={onDelete}><IconTrash size={14} stroke="currentColor" />删除</Btn>}
      <div style={{ flex: 1 }} />
      <Btn variant="ghost" onClick={onClose}>取消</Btn>
      <Btn onClick={() => onSave(b)} disabled={!b.match.trim() || !b.pick.trim() || !(b.odds > 0) || !(b.stake >= 0)}><IconCheck size={15} stroke="#fff" />保存</Btn>
    </>}>
      <Row>
        <L label="项目" flex={1}>
          <Segmented<BetSport> value={b.sport} onChange={(s) => setB({ ...b, sport: s, league: s === "basketball" ? "nba" : s === "football" ? "fifa.world" : undefined })}
            options={[{ value: "football", label: "⚽ 足球" }, { value: "basketball", label: "🏀 篮球" }, { value: "other", label: "其它" }]} />
        </L>
      </Row>
      <L label="比赛"><TextField value={b.match} onChange={(e) => setB({ ...b, match: e.target.value })} placeholder="阿根廷 vs 法国" autoFocus /></L>
      <Row>
        <L label="压哪个（队 / 玩法）" flex={1.3}><TextField value={b.pick} onChange={(e) => setB({ ...b, pick: e.target.value })} placeholder="阿根廷 / 大 2.5 / 让球…" /></L>
        <L label="比赛日（选填）" flex={1}><input type="date" value={b.eventDate ?? ""} onChange={(e) => setB({ ...b, eventDate: e.target.value || undefined })} style={{ ...inputStyle, height: 36, padding: "0 12px" }} /></L>
      </Row>
      <Row>
        <L label="赔率（十进制）" flex={1}><input type="number" step="0.01" min="1" value={b.odds} onChange={(e) => setB({ ...b, odds: parseFloat(e.target.value) || 0 })} style={{ ...inputStyle, height: 36, padding: "0 12px" }} /></L>
        <L label="本金（押多少）" flex={1}><input type="number" step="1" min="0" value={b.stake} onChange={(e) => setB({ ...b, stake: parseFloat(e.target.value) || 0 })} style={{ ...inputStyle, height: 36, padding: "0 12px" }} /></L>
      </Row>
      <div style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "-4px 0 14px", lineHeight: 1.6 }}>
        若赢：拿回 <strong style={{ color: "var(--green)" }}>{fmtMoney(payout)}</strong>（盈利 {fmtMoney(payout - b.stake)}）；若输：亏 <strong style={{ color: "var(--red)" }}>{fmtMoney(b.stake)}</strong>。
      </div>
      <Row>
        <L label="状态" flex={1}>
          <Segmented<BetStatus> value={b.status} onChange={(s) => setB({ ...b, status: s })}
            options={[{ value: "pending", label: "待结算" }, { value: "won", label: "赢" }, { value: "lost", label: "输" }, { value: "void", label: "取消" }]} />
        </L>
      </Row>
      <L label="备注（选填）"><TextField value={b.note ?? ""} onChange={(e) => setB({ ...b, note: e.target.value })} placeholder="盘口、心得…" /></L>
    </Modal>
  );
}

// ── 赛事面板（实时数据，经 run.py 代取 ESPN）──────────────────────
function LivePanel({ title, league, dates, emptyText }: { title: string; league: string; dates?: string; emptyText: string }) {
  const [resp, setResp] = useState<SportsResp | null>(null);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const my = ++reqId.current;
    setLoading(true);
    const r = await fetchSports(league, dates);
    if (my === reqId.current) { setResp(r); setLoading(false); }
  }, [league, dates]);
  useEffect(() => { load(); }, [load]);

  const events = resp?.events ?? [];
  return (
    <div style={{ ...card, padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", flex: 1 }}>{title}</div>
        <button className="fv-icnbtn" onClick={load} disabled={loading} title="刷新"
          style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: "transparent", border: "0.5px solid var(--separator)", cursor: loading ? "default" : "pointer", color: "var(--text-secondary)" }}>
          <span style={{ display: "inline-flex", animation: loading ? "fvSpin 0.8s linear infinite" : undefined }}><IconRefresh size={14} stroke="currentColor" /></span>
        </button>
      </div>
      {loading && !resp && <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", padding: "12px 0" }}>读取中…</div>}
      {resp && !resp.ok && <div style={{ fontSize: 12.5, color: "var(--orange)", padding: "8px 0", lineHeight: 1.6 }}>{resp.error || "拉取失败"}</div>}
      {resp && resp.ok && events.length === 0 && <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", padding: "10px 0", lineHeight: 1.6 }}>{emptyText}</div>}
      {events.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {events.map((m) => <MatchRow key={m.id} m={m} />)}
        </div>
      )}
      <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", marginTop: 12, paddingTop: 10, borderTop: "0.5px solid var(--separator)" }}>
        数据：ESPN 公开接口 · 由本机 run.py 代取（不用 API key）{resp?.asOf ? " · " + fmtKick(new Date(resp.asOf).toISOString()) + " 更新" : ""}
      </div>
    </div>
  );
}

function MatchRow({ m }: { m: MatchT }) {
  const live = m.state === "in";
  const post = m.state === "post" || m.completed;
  const status = live ? <span style={{ color: "var(--red)", fontWeight: 700 }}>● {m.detail || "进行中"}</span>
    : post ? <span style={{ color: "var(--text-tertiary)" }}>{m.detail || "完场"}</span>
    : <span style={{ color: "var(--accent)" }}>{fmtKick(m.date) || m.detail || "未开始"}</span>;
  return (
    <div className="fv-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 6px", borderRadius: 8 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {m.note && <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", marginBottom: 3 }}>{m.note}</div>}
        <TeamLine side={m.home} score={post || live ? m.home?.score : undefined} win={post && m.home?.winner} />
        <TeamLine side={m.away} score={post || live ? m.away?.score : undefined} win={post && m.away?.winner} />
      </div>
      <div style={{ flex: "none", textAlign: "right", fontSize: 11.5, minWidth: 76 }}>{status}</div>
    </div>
  );
}
function TeamLine({ side, score, win }: { side?: { name?: string; short?: string; logo?: string } | null; score?: string; win?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "1px 0" }}>
      {side?.logo ? <img src={side.logo} alt="" style={{ width: 16, height: 16, objectFit: "contain", flex: "none" }} /> : <span style={{ width: 16, flex: "none", textAlign: "center", fontSize: 11 }}>•</span>}
      <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: win ? 700 : 500, color: win ? "var(--text-primary)" : "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{side?.short || side?.name || "TBD"}</span>
      {score != null && score !== "" && <span style={{ flex: "none", fontSize: 13.5, fontWeight: 700, color: win ? "var(--text-primary)" : "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>{score}</span>}
    </div>
  );
}

// ── 共用：弹窗 / 表单行 ──────────────────────────────────────
function Modal({ title, onClose, children, footer, width = 480 }: { title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode; width?: number }) {
  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.34)", backdropFilter: "blur(2px)", animation: "fvFade .15s ease" }}>
      <div style={{ ...card, width, maxWidth: "92%", maxHeight: "90%", display: "flex", flexDirection: "column", overflow: "hidden", animation: "fvPop .18s ease" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "14px 20px", borderBottom: "0.5px solid var(--separator)" }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div><div style={{ flex: 1 }} />
          <button className="fv-icnbtn" onClick={onClose} style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 7, background: "transparent", border: "none", cursor: "pointer", color: "var(--text-tertiary)" }}><IconClose size={17} stroke="currentColor" /></button>
        </div>
        <div style={{ padding: "16px 20px", overflowY: "auto" }}>{children}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 20px", borderTop: "0.5px solid var(--separator)" }}>{footer}</div>
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
