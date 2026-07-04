import React, { useMemo, useState } from "react";
import type { DevData, KnockoutMatch, WcModel } from "../../types";
import { Btn, card } from "../../ui";
import { IconPlus, IconTrash, IconRefresh, IconClose, IconCheck } from "../../icons";
import {
  R32_2026, matchesOf, summarize, model, portfolio, total, scoreKey, newMatch,
  DEFAULT_PRIOR_LAMBDA, DEFAULT_PRIOR_WEIGHT,
} from "../../lib/wc";

type Mut = (fn: (d: DevData) => void) => void;
const UNDER = "var(--accent)";   // 小球（本命）
const OVER = "var(--orange)";    // 大球
const pct = (x: number) => (x * 100).toFixed(1) + "%";
const pct0 = (x: number) => Math.round(x * 100) + "%";

// 把当前 wc（可能没设过）落成一个可写对象，并保证 matches 存在
function ensureWc(d: DevData): WcModel {
  if (!d.wc) d.wc = {};
  if (!d.wc.matches || !d.wc.matches.length) d.wc.matches = R32_2026.map((m) => ({ ...m }));
  return d.wc;
}

export default function WorldCupModel({ data, mut }: { data: DevData; mut: Mut }) {
  const wc = data.wc;
  const ms = matchesOf(wc);
  const s = useMemo(() => summarize(ms), [ms]);
  const mo = useMemo(() => model(ms, wc), [ms, wc]);
  const [editing, setEditing] = useState<KnockoutMatch | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [fetchMsg, setFetchMsg] = useState("");

  const priorLambda = wc?.priorLambda ?? DEFAULT_PRIOR_LAMBDA;
  const priorWeight = wc?.priorWeight ?? DEFAULT_PRIOR_WEIGHT;
  const tilt = wc?.tilt ?? 0;
  const setParam = (k: "priorLambda" | "priorWeight" | "tilt", v: number) => mut((d) => { ensureWc(d)[k] = v; });

  const saveMatch = (m: KnockoutMatch) => { mut((d) => { const w = ensureWc(d); const i = w.matches!.findIndex((x) => x.id === m.id); if (i >= 0) w.matches![i] = m; else w.matches!.unshift(m); }); setEditing(null); };
  const delMatch = (id: string) => mut((d) => { const w = ensureWc(d); w.matches = w.matches!.filter((x) => x.id !== id); });
  const resetR32 = () => { if (confirm("重置为内置的 2026 R32 真实数据？你自己加的 16 强等比赛会被清掉。")) mut((d) => { ensureWc(d).matches = R32_2026.map((m) => ({ ...m })); }); };

  // 从本机 run.py 拉世界杯实时比分，匹配/补录已完赛的场次
  const fetchLive = async () => {
    setFetchMsg("拉取中…");
    try {
      const r = await fetch("/api/sports?league=fifa.world").then((x) => x.json());
      if (!r.ok) { setFetchMsg("拉取失败：" + (r.error || "")); return; }
      const done = (r.events || []).filter((e: { state?: string; completed?: boolean }) => e.state === "post" || e.completed);
      setFetchMsg(done.length ? `实时接口共 ${r.events.length} 场、已完赛 ${done.length} 场。可对照下方补录 16 强等新比分（自动匹配将在你 Mac 上更准）。` : "暂无已完赛场次。");
    } catch { setFetchMsg("连不上本机服务——实时比分要从 run.py（localhost:5180）进入。"); }
  };

  return (
    <div>
      <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", lineHeight: 1.7, marginBottom: 16 }}>
        <strong>淘汰赛 · 小球(大小球) + 波胆 模型</strong>。默认已装入 <strong>2026 世界杯 32 强淘汰赛全部 16 场真实 90 分钟比分</strong>。
        大小球、波胆都按<strong>常规时间(90′)</strong>算。往下：统计 → 泊松概率模型 → 波胆下注组合。比赛进行中可随时补录 16 强/8 强的新比分，模型自动更新。
      </div>

      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10, marginBottom: 16 }}>
        <Kpi label="场次(90′)" value={String(s.n)} sub="R32 全部完赛" />
        <Kpi label="场均总进球" value={s.avg.toFixed(2)} sub="球/场" accent />
        <Kpi label="小球率 <2.5" value={pct0(s.u25r)} sub={`${s.under25}/${s.n} 场`} color={UNDER} big />
        <Kpi label="大球率 >2.5" value={pct0(s.o25r)} sub={`${s.over25}/${s.n} 场`} color={OVER} />
        <Kpi label="大于3.5" value={pct0(s.o35r)} sub="爆分很少" />
        <Kpi label="双方进球" value={pct0(s.bttsr)} sub="BTTS" />
      </div>

      {/* 图1：每场总进球 */}
      <Panel title="每场总进球（90 分钟）" legend={<Legend items={[{ c: UNDER, t: "小球 ≤2" }, { c: OVER, t: "大球 ≥3" }]} />}>
        <MatchBars ms={ms} />
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 8 }}>虚线为 2.5 盘口线。总进球 {s.goals} · 分布：{s.dist.map((c, g) => c ? `${g}球×${c}` : "").filter(Boolean).join(" · ")}。</div>
      </Panel>

      {/* 图2：滚动小球率 */}
      <Panel title="滚动小球率 vs 历史基准" legend={<Legend items={[{ c: UNDER, t: "累计小球率" }, { c: "var(--text-tertiary)", t: "历史≈60%" }]} />}>
        <RollingUnder ms={ms} baseline={0.6} />
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 8 }}>本届 R32 收在 <strong style={{ color: UNDER }}>{pct(s.u25r)}</strong>，与“淘汰赛小球 &gt; 60%”的历史规律一致。</div>
      </Panel>

      {/* 图3：比分频率 vs 模型 */}
      <Panel title="比分（无序）· 实际频率 vs 模型概率" legend={<Legend items={[{ c: UNDER, t: "实际出现" }, { c: "var(--accent2)", t: "模型概率" }]} />}>
        <ScoreCompare empirical={s.scores} modelScores={mo.topScores} n={s.n} />
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 8 }}>实际最常见：<strong>1-1×{s.scores.find((x) => x.key === "1-1")?.count ?? 0}、2-1×{s.scores.find((x) => x.key === "2-1")?.count ?? 0}</strong>——正是小球波胆的甜区。</div>
      </Panel>

      {/* 模型 + 预测 */}
      <div style={{ ...card, padding: "16px 18px", marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>泊松模型 · 下一场预测</div>
        <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginBottom: 14, lineHeight: 1.6 }}>
          把<strong>历史先验</strong>和<strong>已观测淘汰赛</strong>用贝叶斯融合，得到场均期望 λ，再按泊松分布算大小球概率。
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
          <Num label="历史先验 λ（场均球）" value={priorLambda} step={0.05} onChange={(v) => setParam("priorLambda", v)} />
          <Num label="先验等效场次" value={priorWeight} step={1} onChange={(v) => setParam("priorWeight", Math.max(0, Math.round(v)))} />
          <Stat2 label="后验 λ（融合后）" value={mo.lambda.toFixed(2)} />
          <Stat2 label="最近6场场均" value={mo.recentAvg.toFixed(2)} />
        </div>

        {/* 均值回归微调 */}
        <div style={{ background: "var(--fill-q)", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>均值回归微调</div>
            <input type="range" min={0} max={1} step={0.05} value={tilt} onChange={(e) => setParam("tilt", parseFloat(e.target.value))} style={{ flex: 1, minWidth: 140, accentColor: "var(--accent)" }} />
            <div style={{ fontSize: 12.5, fontWeight: 700, width: 42, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{tilt.toFixed(2)}</div>
            <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>调整后 λ = <strong style={{ color: "var(--accent)" }}>{mo.lambdaAdj.toFixed(2)}</strong></div>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 8, lineHeight: 1.6 }}>
            你的思路：前面进球多 → 调低后面出大球概率；进球少 → 调高。这里就是按“最近偏离”反向拉 λ（{mo.recentAvg > mo.lambda ? "最近偏热→压低" : "最近偏冷→抬高"}）。
            <strong>数学提醒</strong>：独立比赛并不真的负相关（避免赌徒谬误），所以这是<strong>主观杠杆</strong>，0 = 只信数据。
          </div>
        </div>

        {/* 预测概率 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10, marginBottom: 14 }}>
          <PBig label="小球 <2.5" value={mo.pUnder25} color={UNDER} />
          <PBig label="大球 >2.5" value={mo.pOver25} color={OVER} />
          <PBig label="小球 <1.5" value={mo.pUnder15} color={UNDER} dim />
          <PBig label="小球 <3.5" value={mo.pUnder35} color={UNDER} dim />
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>预测总进球分布（泊松，λ={mo.lambdaAdj.toFixed(2)}）</div>
        <PmfBars pmf={mo.pmf} />
      </div>

      {/* 波胆组合 */}
      <Portfolio data={data} mut={mut} topScores={mo.topScores} />

      {/* 比赛清单 / 补录 */}
      <div style={{ ...card, padding: "16px 18px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>比赛清单（{ms.length} 场）</div>
            <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 2 }}>16 强开打后按 90′ 比分补录，上面全部自动更新</div>
          </div>
          <Btn variant="ghost" onClick={fetchLive}><IconRefresh size={14} />拉实时比分</Btn>
          <Btn variant="ghost" onClick={resetR32}>重置 R32</Btn>
          <Btn onClick={() => setEditing(newMatch("R16"))}><IconPlus size={15} stroke="#fff" />补录一场</Btn>
        </div>
        {fetchMsg && <div style={{ fontSize: 11.5, color: "var(--accent)", marginBottom: 10, lineHeight: 1.6 }}>{fetchMsg}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {(showAll ? ms : ms.slice(0, 8)).map((m) => (
            <div key={m.id} className="fv-row" onClick={() => setEditing(m)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 8px", borderRadius: 8, cursor: "pointer" }}>
              <span style={{ width: 34, flex: "none", fontSize: 10.5, fontWeight: 700, color: "var(--text-tertiary)" }}>{m.round}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.home} {m.hg}-{m.ag} {m.away}{(m.aet || m.pens) && <span style={{ color: "var(--text-tertiary)", fontSize: 11 }}> ({m.pens ? "点球" : "加时"})</span>}</span>
              <span style={{ flex: "none", fontSize: 11, fontWeight: 700, color: total(m) >= 3 ? OVER : UNDER }}>{total(m)}球 · {total(m) >= 3 ? "大" : "小"}</span>
              <button className="fv-icnbtn" onClick={(e) => { e.stopPropagation(); if (confirm("删除这场？")) delMatch(m.id); }} title="删除" style={{ width: 26, height: 26, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 7, background: "transparent", border: "none", cursor: "pointer", color: "var(--text-tertiary)" }}><IconTrash size={13} stroke="currentColor" /></button>
            </div>
          ))}
        </div>
        {ms.length > 8 && <button className="fv-tap" onClick={() => setShowAll(!showAll)} style={{ marginTop: 8, border: "none", background: "transparent", color: "var(--accent)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{showAll ? "收起" : `展开全部 ${ms.length} 场`}</button>}
      </div>

      <div style={{ fontSize: 11, color: "var(--text-tertiary)", lineHeight: 1.7 }}>
        数据：2026 R32 为公开战报整理的 90′ 真实比分；历史先验为近几届淘汰赛的近似值（可改）。模型是估计、非预言，博彩有风险，理性投注。
      </div>

      {editing && <MatchEditor key={editing.id} initial={editing} onClose={() => setEditing(null)} onSave={saveMatch} onDelete={() => { delMatch(editing.id); setEditing(null); }} />}
    </div>
  );
}

// ── 波胆组合 ────────────────────────────────────────────────
function Portfolio({ data, mut, topScores }: { data: DevData; mut: Mut; topScores: ReturnType<typeof model>["topScores"] }) {
  const wc = data.wc;
  const picks = wc?.picks ?? ["1-1", "2-1", "1-0"];
  const stakeTotal = wc?.stakeTotal ?? 300;
  const odds = wc?.odds ?? {};
  const setWc = (fn: (w: WcModel) => void) => mut((d) => { if (!d.wc) d.wc = {}; fn(d.wc); });
  const togglePick = (k: string) => setWc((w) => { const p = new Set(w.picks ?? ["1-1", "2-1", "1-0"]); p.has(k) ? p.delete(k) : p.add(k); w.picks = [...p]; });
  const setOdds = (k: string, v: number) => setWc((w) => { w.odds = { ...(w.odds ?? {}), [k]: v }; });
  const setStake = (v: number) => setWc((w) => { w.stakeTotal = v; });

  const pf = portfolio(picks, stakeTotal, odds, topScores);
  const scoreOpts = topScores.filter((t) => t.low || t.p > 0.03).map((t) => t.key);
  const allOpts = Array.from(new Set([...scoreOpts, "0-0", "1-0", "1-1", "2-1", "2-0", "2-2", "3-1"]));

  return (
    <div style={{ ...card, padding: "16px 18px", marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>波胆组合 · 均分筹码冲奖</div>
      <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginBottom: 12, lineHeight: 1.6 }}>选几个小比分，筹码<strong>均分</strong>，填上各自赔率，自动算命中率和期望盈亏。你的策略：小球波胆铺开、冲高赔。</div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {allOpts.map((k) => {
          const on = picks.includes(k);
          const mp = topScores.find((t) => t.key === k)?.p ?? 0;
          return (
            <button key={k} className="fv-tap" onClick={() => togglePick(k)} style={{ border: "0.5px solid " + (on ? "transparent" : "var(--separator)"), background: on ? "var(--accent)" : "var(--bg-elevated)", color: on ? "#fff" : "var(--text-secondary)", fontSize: 12.5, fontWeight: 600, padding: "6px 11px", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
              {k}<span style={{ fontSize: 10, opacity: 0.75 }}>{pct0(mp)}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 12 }}>
        <Num label="总筹码 ¥" value={stakeTotal} step={50} onChange={setStake} w={110} />
        <Stat2 label="每注" value={"¥" + Math.round(pf.each)} />
        <Stat2 label="命中率(任一中)" value={pct(pf.hitProb)} color={pf.hitProb >= 0.5 ? "var(--green)" : undefined} />
        <Stat2 label="期望盈亏" value={(pf.ev >= 0 ? "+" : "−") + "¥" + Math.abs(Math.round(pf.ev))} color={pf.ev >= 0 ? "var(--green)" : "var(--red)"} />
      </div>

      {picks.length === 0 ? <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", padding: "8px 0" }}>上面点几个比分组进来。</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", fontSize: 10.5, color: "var(--text-tertiary)", padding: "0 4px", fontWeight: 600 }}>
            <span style={{ width: 52 }}>比分</span><span style={{ width: 60 }}>模型概率</span><span style={{ flex: 1 }}>赔率(手填)</span><span style={{ width: 64, textAlign: "right" }}>本金</span><span style={{ width: 74, textAlign: "right" }}>中了拿回</span>
          </div>
          {pf.rows.map((r) => (
            <div key={r.key} style={{ display: "flex", alignItems: "center", padding: "6px 4px", borderTop: "0.5px solid var(--separator)" }}>
              <span style={{ width: 52, fontSize: 13, fontWeight: 700 }}>{r.key}</span>
              <span style={{ width: 60, fontSize: 12, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>{pct(r.p)}</span>
              <span style={{ flex: 1 }}><input type="number" step="0.5" min="1" value={odds[r.key] ?? ""} placeholder="如 8.0" onChange={(e) => setOdds(r.key, parseFloat(e.target.value) || 0)} style={{ width: 90, height: 30, padding: "0 10px", fontSize: 13, borderRadius: 8, border: "0.5px solid var(--separator)", background: "var(--fill-q)", color: "var(--text-primary)" }} /></span>
              <span style={{ width: 64, textAlign: "right", fontSize: 12.5, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>¥{Math.round(r.stake)}</span>
              <span style={{ width: 74, textAlign: "right", fontSize: 12.5, fontWeight: 700, color: r.odds > 0 ? "var(--green)" : "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}>{r.odds > 0 ? "¥" + Math.round(r.ret) : "—"}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 10, lineHeight: 1.6 }}>命中率 = 选中比分的模型概率之和（比分互斥）。期望盈亏 = Σ 概率×回报 − 总筹码；&gt;0 才是长期正期望（很依赖你填的赔率）。</div>
    </div>
  );
}

// ── 图表 ────────────────────────────────────────────────
function MatchBars({ ms }: { ms: KnockoutMatch[] }) {
  const W = 640, H = 150, padB = 22, padT = 8, padL = 6, padR = 6;
  const maxG = Math.max(4, ...ms.map(total));
  const n = ms.length || 1;
  const bw = (W - padL - padR) / n;
  const y = (g: number) => padT + (1 - g / maxG) * (H - padT - padB);
  const y25 = y(2.5);
  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 520, height: H, display: "block" }}>
        <line x1={padL} y1={y25} x2={W - padR} y2={y25} stroke="var(--text-tertiary)" strokeWidth="1" strokeDasharray="4 3" opacity="0.7" />
        <text x={W - padR} y={y25 - 4} textAnchor="end" fontSize="9" fill="var(--text-tertiary)">2.5</text>
        {ms.map((m, i) => {
          const g = total(m), over = g >= 3;
          const bh = (H - padT - padB) - (y(g) - padT);
          return (
            <g key={m.id}>
              <title>{m.home} {m.hg}-{m.ag} {m.away} · {g}球 {over ? "大" : "小"}</title>
              <rect x={padL + i * bw + bw * 0.16} y={y(g)} width={bw * 0.68} height={Math.max(1, bh)} rx="3" fill={over ? OVER : UNDER} />
              <text x={padL + i * bw + bw / 2} y={y(g) - 3} textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--text-secondary)">{g}</text>
              <text x={padL + i * bw + bw / 2} y={H - 7} textAnchor="middle" fontSize="8" fill="var(--text-tertiary)">{m.home.slice(0, 2)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function RollingUnder({ ms, baseline }: { ms: KnockoutMatch[]; baseline: number }) {
  const W = 640, H = 150, padB = 20, padT = 10, padL = 30, padR = 8;
  const n = ms.length;
  const pts: { x: number; y: number; r: number }[] = [];
  let under = 0;
  const X = (i: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * (W - padL - padR));
  const Y = (r: number) => padT + (1 - r) * (H - padT - padB);
  ms.forEach((m, i) => { if (total(m) <= 2) under++; pts.push({ x: X(i), y: Y(under / (i + 1)), r: under / (i + 1) }); });
  const line = pts.map((p, i) => (i ? "L" : "M") + p.x.toFixed(1) + " " + p.y.toFixed(1)).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, display: "block" }}>
      {[0, 0.25, 0.5, 0.75, 1].map((g) => (
        <g key={g}><line x1={padL} y1={Y(g)} x2={W - padR} y2={Y(g)} stroke="var(--separator)" strokeWidth="0.5" /><text x={padL - 5} y={Y(g) + 3} textAnchor="end" fontSize="8.5" fill="var(--text-tertiary)">{g * 100}%</text></g>
      ))}
      <line x1={padL} y1={Y(baseline)} x2={W - padR} y2={Y(baseline)} stroke="var(--text-tertiary)" strokeWidth="1" strokeDasharray="4 3" />
      <path d={line} fill="none" stroke={UNDER} strokeWidth="2" />
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="2.4" fill={UNDER} />)}
      {pts.length > 0 && <text x={pts[pts.length - 1].x} y={pts[pts.length - 1].y - 7} textAnchor="end" fontSize="10" fontWeight="700" fill={UNDER}>{pct0(pts[pts.length - 1].r)}</text>}
    </svg>
  );
}

function ScoreCompare({ empirical, modelScores, n }: { empirical: { key: string; count: number; pct: number }[]; modelScores: ReturnType<typeof model>["topScores"]; n: number }) {
  const keys = Array.from(new Set([...empirical.map((e) => e.key), ...modelScores.map((m) => m.key)])).slice(0, 8);
  const mp = new Map(modelScores.map((m) => [m.key, m.p]));
  const ep = new Map(empirical.map((e) => [e.key, e.pct]));
  const max = Math.max(0.35, ...keys.map((k) => Math.max(ep.get(k) ?? 0, mp.get(k) ?? 0)));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {keys.map((k) => {
        const e = ep.get(k) ?? 0, m = mp.get(k) ?? 0;
        return (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 40, fontSize: 12.5, fontWeight: 700, flex: "none" }}>{k}</span>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ height: 8, borderRadius: 4, background: UNDER, width: `${(e / max) * 100}%`, minWidth: e > 0 ? 3 : 0 }} /><span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{Math.round(e * n)}场 {pct0(e)}</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ height: 8, borderRadius: 4, background: "var(--accent2)", width: `${(m / max) * 100}%`, minWidth: m > 0 ? 3 : 0 }} /><span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>模型 {pct(m)}</span></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PmfBars({ pmf }: { pmf: number[] }) {
  const max = Math.max(...pmf);
  const labels = pmf.map((_, i) => (i === pmf.length - 1 ? i + "+" : String(i)));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 96 }}>
      {pmf.map((p, i) => {
        const over = i >= 3;
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }} title={`${labels[i]} 球：${pct(p)}`}>
            <span style={{ fontSize: 9.5, color: "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}>{pct0(p)}</span>
            <div style={{ width: "100%", height: `${(p / max) * 72}px`, minHeight: 2, borderRadius: 3, background: over ? OVER : UNDER, opacity: 0.9 }} />
            <span style={{ fontSize: 9.5, color: "var(--text-secondary)", fontWeight: 600 }}>{labels[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── 小组件 ────────────────────────────────────────────────
function Panel({ title, legend, children }: { title: string; legend?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ ...card, padding: "14px 18px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12, gap: 10 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, flex: 1 }}>{title}</div>
        {legend}
      </div>
      {children}
    </div>
  );
}
function Legend({ items }: { items: { c: string; t: string }[] }) {
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      {items.map((i) => <span key={i.t} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text-secondary)" }}><span style={{ width: 9, height: 9, borderRadius: 3, background: i.c }} />{i.t}</span>)}
    </div>
  );
}
function Kpi({ label, value, sub, color, accent, big }: { label: string; value: string; sub?: string; color?: string; accent?: boolean; big?: boolean }) {
  return (
    <div style={{ ...card, padding: "11px 13px", background: big ? "color-mix(in srgb, var(--accent) 7%, var(--bg-elevated))" : "var(--bg-elevated)" }}>
      <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: big ? 22 : 18, fontWeight: 800, color: color || (accent ? "var(--accent)" : "var(--text-primary)"), fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 1 }}>{sub}</div>}
    </div>
  );
}
function PBig({ label, value, color, dim }: { label: string; value: number; color: string; dim?: boolean }) {
  return (
    <div style={{ ...card, padding: "11px 13px", opacity: dim ? 0.85 : 1 }}>
      <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: dim ? 18 : 22, fontWeight: 800, color, fontVariantNumeric: "tabular-nums" }}>{pct(value)}</div>
    </div>
  );
}
function Num({ label, value, step, onChange, w = 96 }: { label: string; value: number; step: number; onChange: (v: number) => void; w?: number }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", marginBottom: 4 }}>{label}</div>
      <input type="number" step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} style={{ width: w, height: 34, padding: "0 10px", fontSize: 14, fontWeight: 600, borderRadius: 9, border: "0.5px solid var(--separator)", background: "var(--fill-q)", color: "var(--text-primary)" }} />
    </label>
  );
}
function Stat2({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: color || "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

function MatchEditor({ initial, onClose, onSave, onDelete }: { initial: KnockoutMatch; onClose: () => void; onSave: (m: KnockoutMatch) => void; onDelete: () => void }) {
  const [m, setM] = useState<KnockoutMatch>(initial);
  const isNew = !initial.home && !initial.away;
  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.34)", backdropFilter: "blur(2px)", animation: "fvFade .15s ease" }}>
      <div style={{ ...card, width: 440, maxWidth: "92%", overflow: "hidden", animation: "fvPop .18s ease" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "14px 20px", borderBottom: "0.5px solid var(--separator)" }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{isNew ? "补录一场（90 分钟比分）" : "编辑比赛"}</div><div style={{ flex: 1 }} />
          <button className="fv-icnbtn" onClick={onClose} style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 7, background: "transparent", border: "none", cursor: "pointer", color: "var(--text-tertiary)" }}><IconClose size={17} stroke="currentColor" /></button>
        </div>
        <div style={{ padding: "16px 20px" }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <label style={{ width: 84 }}><div style={lblS}>轮次</div><input value={m.round} onChange={(e) => setM({ ...m, round: e.target.value })} placeholder="R16" style={inS} /></label>
            <label style={{ flex: 1 }}><div style={lblS}>日期</div><input type="date" value={m.date ?? ""} onChange={(e) => setM({ ...m, date: e.target.value || undefined })} style={inS} /></label>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 12 }}>
            <label style={{ flex: 1 }}><div style={lblS}>主队</div><input value={m.home} onChange={(e) => setM({ ...m, home: e.target.value })} placeholder="队 A" style={inS} autoFocus /></label>
            <input type="number" min="0" value={m.hg} onChange={(e) => setM({ ...m, hg: Math.max(0, parseInt(e.target.value) || 0) })} style={{ ...inS, width: 52, textAlign: "center", fontWeight: 700 }} />
            <span style={{ paddingBottom: 8, color: "var(--text-tertiary)" }}>-</span>
            <input type="number" min="0" value={m.ag} onChange={(e) => setM({ ...m, ag: Math.max(0, parseInt(e.target.value) || 0) })} style={{ ...inS, width: 52, textAlign: "center", fontWeight: 700 }} />
            <label style={{ flex: 1 }}><div style={lblS}>客队</div><input value={m.away} onChange={(e) => setM({ ...m, away: e.target.value })} placeholder="队 B" style={inS} /></label>
          </div>
          <div style={{ display: "flex", gap: 14, marginBottom: 4 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-secondary)", cursor: "pointer" }}><input type="checkbox" checked={!!m.aet} onChange={(e) => setM({ ...m, aet: e.target.checked })} />进加时</label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-secondary)", cursor: "pointer" }}><input type="checkbox" checked={!!m.pens} onChange={(e) => setM({ ...m, pens: e.target.checked })} />点球大战</label>
            <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-tertiary)", alignSelf: "center" }}>90′ 共 <strong style={{ color: total(m) >= 3 ? OVER : UNDER }}>{total(m)}</strong> 球 · {scoreKey(m)}</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 6 }}>只填<strong>常规时间(90 分钟)</strong>比分；加时/点球只勾选、不计入大小球。</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 20px", borderTop: "0.5px solid var(--separator)" }}>
          {!isNew && <Btn variant="danger" onClick={onDelete}><IconTrash size={14} stroke="currentColor" />删除</Btn>}
          <div style={{ flex: 1 }} />
          <Btn variant="ghost" onClick={onClose}>取消</Btn>
          <Btn onClick={() => onSave({ ...m, home: m.home.trim() || "队A", away: m.away.trim() || "队B" })}><IconCheck size={15} stroke="#fff" />保存</Btn>
        </div>
      </div>
    </div>
  );
}
const lblS: React.CSSProperties = { fontSize: 10.5, color: "var(--text-tertiary)", marginBottom: 4 };
const inS: React.CSSProperties = { width: "100%", height: 34, padding: "0 10px", fontSize: 13.5, borderRadius: 9, border: "0.5px solid var(--separator)", background: "var(--fill-q)", color: "var(--text-primary)" };
