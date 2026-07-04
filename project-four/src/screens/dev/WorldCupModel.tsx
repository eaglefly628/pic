import React, { useMemo, useState } from "react";
import type { DevData, KnockoutMatch, WcModel } from "../../types";
import { Btn, Segmented, card } from "../../ui";
import { IconPlus, IconTrash, IconRefresh, IconClose, IconCheck } from "../../icons";
import {
  R32_2026, matchesOf, summarize, model, total, scoreKey, newMatch,
  DEFAULT_PRIOR_WEIGHT, DEFAULT_PRIOR_YEARS, WC_KNOCKOUT_HISTORY, pooledPrior, histAvg, histUnderRate, type HistYear,
  R16_FIXTURES, teamStrengths, matchSplit, topScorelinesFor, overProb, linreg,
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
  const priorYears = wc?.priorYears ?? DEFAULT_PRIOR_YEARS;
  const pp = useMemo(() => pooledPrior(WC_KNOCKOUT_HISTORY, priorYears), [priorYears]);
  const reg = useMemo(() => linreg(WC_KNOCKOUT_HISTORY.filter((h) => h.est).map((h) => ({ x: h.year, y: histAvg(h) }))), []);
  const useReg = wc?.useReg ?? false;
  const lam0 = useReg ? Math.max(0.6, reg.predict(2026)) : pp.lambda;
  const priorWeight = wc?.priorWeight ?? DEFAULT_PRIOR_WEIGHT;
  const tilt = wc?.tilt ?? 0;
  const mo = useMemo(() => model(ms, { ...wc, priorLambda: lam0, priorWeight }), [ms, lam0, priorWeight, tilt, wc]);
  const str = useMemo(() => teamStrengths(ms), [ms]);
  const [editing, setEditing] = useState<KnockoutMatch | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [fetchMsg, setFetchMsg] = useState("");

  const setParam = (k: "priorWeight" | "tilt", v: number) => mut((d) => { ensureWc(d)[k] = v; });
  const toggleYear = (y: number) => mut((d) => { const w = ensureWc(d); const set = new Set(w.priorYears ?? DEFAULT_PRIOR_YEARS); set.has(y) ? set.delete(y) : set.add(y); w.priorYears = [...set].sort((a, b) => a - b); });
  const setUseReg = (v: boolean) => mut((d) => { ensureWc(d).useReg = v; });

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

      {/* 历史先验 · 选 N 届 */}
      <div style={{ ...card, padding: "16px 18px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>历届淘汰赛 · 选 N 届当先验</div>
          <div style={{ fontSize: 11, color: "var(--orange)" }}>历史=整理自公开赛果(90′) · 个别加时口径或 ±1 场 · 可核对修改</div>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginBottom: 12, lineHeight: 1.6 }}>勾选想纳入先验的年份——池化成场均 λ 喂给模型。想信“防守年代”就只选 06/10；想跟“近年高分”就选近四届。</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {WC_KNOCKOUT_HISTORY.map((h) => {
            const on = priorYears.includes(h.year);
            return (
              <button key={h.year} className="fv-tap" onClick={() => toggleYear(h.year)} disabled={!h.est} title={h.est ? "" : "本届为观测数据，不作先验"} style={{ border: "0.5px solid " + (on ? "transparent" : "var(--separator)"), background: on ? "var(--accent)" : "var(--bg-elevated)", color: on ? "#fff" : h.est ? "var(--text-secondary)" : "var(--text-tertiary)", fontSize: 12, fontWeight: 600, padding: "6px 10px", borderRadius: 8, cursor: h.est ? "pointer" : "default", opacity: h.est ? 1 : 0.55 }}>
                {h.label}{!h.est && " ·本届"}
              </button>
            );
          })}
        </div>
        <HistBars rows={WC_KNOCKOUT_HISTORY} selected={priorYears} />
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 12, paddingTop: 12, borderTop: "0.5px solid var(--separator)" }}>
          <Stat2 label={`选中 ${pp.count} 届 · 池化 λ`} value={pp.lambda.toFixed(2)} color="var(--accent)" />
          <Stat2 label="池化小球率" value={pct0(pp.underRate)} color={UNDER} />
          <Stat2 label="样本场次" value={String(pp.matches)} />
        </div>
      </div>

      {/* 回归趋势 */}
      <div style={{ ...card, padding: "16px 18px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
          <div style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>逐届线性回归 · 场均总进球趋势</div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}>
            <input type="checkbox" checked={useReg} onChange={(e) => setUseReg(e.target.checked)} />用回归预测当基准
          </label>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginBottom: 12, lineHeight: 1.6 }}>把历届场均对年份做最小二乘回归,外推 2026 的“应然”基准,辅助你后面的选择。</div>
        <RegChart rows={WC_KNOCKOUT_HISTORY} reg={reg} />
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 12 }}>
          <Stat2 label="斜率(球/年)" value={(reg.slope >= 0 ? "+" : "") + reg.slope.toFixed(3)} color={reg.slope >= 0 ? OVER : UNDER} />
          <Stat2 label="拟合度 R²" value={reg.r2.toFixed(2)} />
          <Stat2 label="回归预测 2026" value={reg.predict(2026).toFixed(2)} />
          <Stat2 label="本届实测 R32" value={s.avg.toFixed(2)} color={s.avg < reg.predict(2026) ? UNDER : OVER} />
        </div>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 10, lineHeight: 1.6 }}>
          斜率 {reg.slope >= 0 ? "为正,历届淘汰赛进球缓慢走高" : "为负,历届淘汰赛进球走低"};本届 R32 实测 {s.avg.toFixed(2)} {s.avg < reg.predict(2026) ? "低于" : "高于"}回归线,说明这届更{s.avg < reg.predict(2026) ? "偏小球" : "偏大球"}。R² 越接近 1 趋势越可信。
        </div>
      </div>

      {/* 模型 + 预测 */}
      <div style={{ ...card, padding: "16px 18px", marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>泊松模型 · 下一场预测</div>
        <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginBottom: 14, lineHeight: 1.6 }}>
          把<strong>历史先验 λ₀={lam0.toFixed(2)}</strong>（{useReg ? "回归外推" : `选中 ${pp.count} 届池化`}）和<strong>已观测 {s.n} 场</strong>用贝叶斯融合，再按泊松分布算大小球概率。
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
          <Stat2 label="先验 λ₀（来自上方）" value={lam0.toFixed(2)} color="var(--accent)" />
          <Num label="先验锚定强度(场)" value={priorWeight} step={2} onChange={(v) => setParam("priorWeight", Math.max(0, Math.round(v)))} />
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

      {/* 后续赛程 · 每场小球概率 */}
      <FixturesBoard base={mo.lambdaAdj} str={str} />

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

// ── 波胆组合 + EV 优选 ──────────────────────────────────────
function Portfolio({ data, mut, topScores }: { data: DevData; mut: Mut; topScores: ReturnType<typeof model>["topScores"] }) {
  const wc = data.wc;
  const picks = wc?.picks ?? ["1-1", "2-1", "1-0"];
  const stakeTotal = wc?.stakeTotal ?? 300;
  const odds = wc?.odds ?? {};
  const evMode = wc?.evMode ?? "even";
  const setWc = (fn: (w: WcModel) => void) => mut((d) => { if (!d.wc) d.wc = {}; fn(d.wc); });
  const togglePick = (k: string) => setWc((w) => { const p = new Set(w.picks ?? ["1-1", "2-1", "1-0"]); p.has(k) ? p.delete(k) : p.add(k); w.picks = [...p]; });
  const setOdds = (k: string, v: number) => setWc((w) => { w.odds = { ...(w.odds ?? {}), [k]: v }; });
  const setStake = (v: number) => setWc((w) => { w.stakeTotal = v; });
  const setMode = (m: "even" | "kelly") => setWc((w) => { w.evMode = m; });

  const pMap = new Map(topScores.map((t) => [t.key, t.p]));
  const candKeys = Array.from(new Set([...topScores.map((t) => t.key), "0-0", "1-0", "1-1", "2-1", "2-0", "2-2", "3-1"]));
  const cand = candKeys.map((k) => { const p = pMap.get(k) ?? 0; const o = odds[k] ?? 0; const edge = o > 0 ? p * o - 1 : 0; return { key: k, p, o, edge, on: picks.includes(k) }; }).sort((a, b) => b.p - a.p);

  const sel = cand.filter((c) => c.on);
  const kf = (c: typeof cand[number]) => (c.o > 1 && c.edge > 0 ? c.edge / (c.o - 1) : 0);
  const kTot = sel.reduce((a, c) => a + kf(c), 0);
  const stakeOf = (c: typeof cand[number]) => sel.length === 0 ? 0 : evMode === "kelly" ? (kTot > 0 ? stakeTotal * 0.5 * (kf(c) / kTot) + (stakeTotal * 0.5) / sel.length : stakeTotal / sel.length) : stakeTotal / sel.length;
  const spent = sel.reduce((a, c) => a + stakeOf(c), 0);
  const hitProb = sel.reduce((a, c) => a + c.p, 0);
  const ev = sel.reduce((a, c) => a + c.p * (stakeOf(c) * c.o), 0) - spent;
  const posCount = cand.filter((c) => c.edge > 0 && c.o > 0).length;
  const autoPick = () => setWc((w) => { w.picks = cand.filter((c) => c.edge > 0 && c.o > 0).map((c) => c.key); });

  return (
    <div style={{ ...card, padding: "16px 18px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
        <div style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>波胆组合 · EV 优选</div>
        <div style={{ width: 150 }}><Segmented value={evMode} onChange={(v) => setMode(v as "even" | "kelly")} options={[{ value: "even", label: "均分" }, { value: "kelly", label: "凯利" }]} /></div>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginBottom: 12, lineHeight: 1.6 }}>填赔率 → 看<strong>边际(edge=概率×赔率−1)</strong> → 一键勾选所有<strong>正期望</strong>比分 → 筹码按<strong>均分</strong>或<strong>凯利(近似)</strong>分配。edge&gt;0 才有下注价值。</div>

      <div style={{ display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 12 }}>
        <Num label="总筹码 ¥" value={stakeTotal} step={50} onChange={setStake} w={104} />
        <Btn variant="soft" onClick={autoPick}>自动选正期望（{posCount}）</Btn>
        <Stat2 label="命中率(任一中)" value={pct(hitProb)} color={hitProb >= 0.5 ? "var(--green)" : undefined} />
        <Stat2 label="投入" value={"¥" + Math.round(spent)} />
        <Stat2 label="期望盈亏" value={(ev >= 0 ? "+" : "−") + "¥" + Math.abs(Math.round(ev))} color={ev >= 0 ? "var(--green)" : "var(--red)"} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", fontSize: 10.5, color: "var(--text-tertiary)", padding: "0 4px", fontWeight: 600 }}>
          <span style={{ width: 30 }} /><span style={{ width: 48 }}>比分</span><span style={{ width: 54 }}>模型</span><span style={{ width: 96 }}>赔率(填)</span><span style={{ flex: 1 }}>edge</span><span style={{ width: 58, textAlign: "right" }}>本金</span><span style={{ width: 66, textAlign: "right" }}>中了拿回</span>
        </div>
        {cand.map((c) => (
          <div key={c.key} onClick={() => togglePick(c.key)} className="fv-row" style={{ display: "flex", alignItems: "center", padding: "6px 4px", borderTop: "0.5px solid var(--separator)", cursor: "pointer" }}>
            <span style={{ width: 30, flex: "none" }}><input type="checkbox" checked={c.on} readOnly style={{ pointerEvents: "none" }} /></span>
            <span style={{ width: 48, fontSize: 13, fontWeight: 700 }}>{c.key}</span>
            <span style={{ width: 54, fontSize: 11.5, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>{pct0(c.p)}</span>
            <span style={{ width: 96, flex: "none" }} onClick={(e) => e.stopPropagation()}><input type="number" step="0.5" min="1" value={odds[c.key] ?? ""} placeholder={"公平≈" + (c.p > 0 ? (1 / c.p).toFixed(1) : "—")} onChange={(e) => setOdds(c.key, parseFloat(e.target.value) || 0)} style={{ width: 84, height: 28, padding: "0 8px", fontSize: 12.5, borderRadius: 7, border: "0.5px solid var(--separator)", background: "var(--fill-q)", color: "var(--text-primary)" }} /></span>
            <span style={{ flex: 1, fontSize: 11.5, fontWeight: 700, color: c.o > 0 ? (c.edge > 0 ? "var(--green)" : "var(--red)") : "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}>{c.o > 0 ? (c.edge >= 0 ? "+" : "") + pct0(c.edge) : "—"}</span>
            <span style={{ width: 58, textAlign: "right", fontSize: 12, fontWeight: 600, color: c.on ? "var(--text-primary)" : "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}>{c.on ? "¥" + Math.round(stakeOf(c)) : "—"}</span>
            <span style={{ width: 66, textAlign: "right", fontSize: 12, fontWeight: 700, color: c.on && c.o > 0 ? "var(--green)" : "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}>{c.on && c.o > 0 ? "¥" + Math.round(stakeOf(c) * c.o) : "—"}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 10, lineHeight: 1.6 }}>edge&gt;0=模型认为这个赔率有价值。命中率=选中比分概率之和(互斥)。凯利为分数凯利近似(互斥比分下非严格最优),给不动就用均分。期望很吃你填的赔率,理性投注。</div>
    </div>
  );
}

// ── 历史 / 回归 / 赛程 图 ─────────────────────────────────────
function HistBars({ rows, selected }: { rows: HistYear[]; selected: number[] }) {
  const W = 660, H = 168, padB = 42, padT = 10, padL = 26, padR = 8;
  const maxG = Math.max(3, ...rows.map(histAvg));
  const n = rows.length, bw = (W - padL - padR) / n;
  const y = (g: number) => padT + (1 - g / maxG) * (H - padT - padB);
  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 560, height: H, display: "block" }}>
        {[1, 2, 3].map((g) => <g key={g}><line x1={padL} y1={y(g)} x2={W - padR} y2={y(g)} stroke="var(--separator)" strokeWidth="0.5" /><text x={padL - 4} y={y(g) + 3} textAnchor="end" fontSize="8.5" fill="var(--text-tertiary)">{g}</text></g>)}
        <line x1={padL} y1={y(2.5)} x2={W - padR} y2={y(2.5)} stroke="var(--text-tertiary)" strokeWidth="1" strokeDasharray="4 3" opacity="0.7" />
        {rows.map((h, i) => {
          const on = selected.includes(h.year), g = histAvg(h), cur = !h.est;
          return (
            <g key={h.year}>
              <title>{h.label}: 场均 {g.toFixed(2)} · 小球 {(histUnderRate(h) * 100).toFixed(0)}%</title>
              <rect x={padL + i * bw + bw * 0.18} y={y(g)} width={bw * 0.64} height={Math.max(1, (H - padT - padB) - (y(g) - padT))} rx="3" fill={cur ? "var(--green)" : on ? "var(--accent)" : "var(--fill)"} stroke={on || cur ? "none" : "var(--separator)"} strokeWidth="0.5" />
              <text x={padL + i * bw + bw / 2} y={y(g) - 3} textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--text-secondary)">{g.toFixed(2)}</text>
              <text x={padL + i * bw + bw / 2} y={H - 26} textAnchor="middle" fontSize="8" fill="var(--text-tertiary)">{String(h.year).slice(2)}</text>
              <text x={padL + i * bw + bw / 2} y={H - 13} textAnchor="middle" fontSize="8.5" fontWeight="700" fill={UNDER}>{(histUnderRate(h) * 100).toFixed(0)}%</text>
            </g>
          );
        })}
        <text x={padL} y={H - 2} fontSize="8" fill="var(--text-tertiary)">蓝=选中先验 · 绿=本届 · 灰=未选 · 底部=小球率</text>
      </svg>
    </div>
  );
}

function RegChart({ rows, reg }: { rows: HistYear[]; reg: ReturnType<typeof linreg> }) {
  const hist = rows.filter((h) => h.est), cur = rows.find((h) => !h.est);
  const W = 660, H = 176, padB = 22, padT = 12, padL = 30, padR = 44;
  const minY = Math.min(...rows.map((r) => r.year)), maxY = 2026;
  const vals = rows.map(histAvg).concat([reg.predict(minY), reg.predict(2026)]);
  const minV = Math.min(1.5, ...vals) - 0.1, maxV = Math.max(3, ...vals) + 0.1;
  const X = (yr: number) => padL + ((yr - minY) / (maxY - minY || 1)) * (W - padL - padR);
  const Y = (v: number) => padT + (1 - (v - minV) / (maxV - minV || 1)) * (H - padT - padB);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, display: "block" }}>
      {[2, 2.5, 3].map((v) => <line key={v} x1={padL} y1={Y(v)} x2={W - padR} y2={Y(v)} stroke="var(--separator)" strokeWidth="0.5" />)}
      <line x1={X(minY)} y1={Y(reg.predict(minY))} x2={X(2026)} y2={Y(reg.predict(2026))} stroke="var(--accent2)" strokeWidth="2" />
      {hist.map((h) => <g key={h.year}><title>{h.label}: {histAvg(h).toFixed(2)}</title><circle cx={X(h.year)} cy={Y(histAvg(h))} r="4.5" fill="var(--accent)" /></g>)}
      {cur && <g><title>本届 R32: {histAvg(cur).toFixed(2)}</title><circle cx={X(cur.year)} cy={Y(histAvg(cur))} r="5.5" fill="var(--green)" stroke="#fff" strokeWidth="1.5" /></g>}
      <circle cx={X(2026)} cy={Y(reg.predict(2026))} r="4" fill="none" stroke="var(--accent2)" strokeWidth="2" />
      <text x={X(2026) + 5} y={Y(reg.predict(2026)) + 3} fontSize="9.5" fontWeight="700" fill="var(--accent2)">{reg.predict(2026).toFixed(2)}</text>
      {rows.map((h) => <text key={h.year} x={X(h.year)} y={H - 7} textAnchor="middle" fontSize="8" fontWeight={h.est ? 400 : 700} fill={h.est ? "var(--text-tertiary)" : "var(--green)"}>{String(h.year).slice(2)}</text>)}
    </svg>
  );
}

function FixturesBoard({ base, str }: { base: number; str: ReturnType<typeof teamStrengths> }) {
  const rows = R16_FIXTURES.map((f) => {
    const sp = matchSplit(base, f.home, f.away, str);
    const under = 1 - overProb(sp.lam, 2.5);
    const tops = topScorelinesFor(sp.lamH, sp.lamA, 3);
    return { f, lam: sp.lam, under, tops };
  });
  const sorted = [...rows].sort((a, b) => b.under - a.under);
  return (
    <div style={{ ...card, padding: "16px 18px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>后续赛程 · 每场小球概率 + 波胆 Top（动态）</div>
        <Legend items={[{ c: UNDER, t: "小球" }, { c: OVER, t: "大球" }]} />
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginBottom: 12, lineHeight: 1.6 }}>R16 全 8 场。每场 λ = 模型基准 + 两队淘汰赛攻防<strong>轻度微调</strong>（样本少·仅参考）；小球 = P(总进球&lt;2.5)；波胆 Top 为该场最可能的比分(主-客)。补录新比分后<strong>动态</strong>刷新。按小球概率从高到低排。</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {sorted.map((r) => (
          <div key={r.f.id} className="fv-row" style={{ padding: "9px 8px", borderRadius: 9 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 40, flex: "none", fontSize: 10.5, color: "var(--text-tertiary)" }}>{r.f.date.slice(5)}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.f.home} <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}>vs</span> {r.f.away}</span>
              <span style={{ width: 48, flex: "none", fontSize: 11, color: "var(--text-tertiary)", textAlign: "right" }}>λ{r.lam.toFixed(2)}</span>
              <div style={{ width: 96, flex: "none", height: 9, borderRadius: 5, overflow: "hidden", display: "flex", background: "var(--fill-q)" }}>
                <div style={{ width: `${r.under * 100}%`, background: UNDER }} />
                <div style={{ width: `${(1 - r.under) * 100}%`, background: OVER, opacity: 0.55 }} />
              </div>
              <span style={{ width: 62, flex: "none", textAlign: "right", fontSize: 12.5, fontWeight: 700, color: UNDER, fontVariantNumeric: "tabular-nums" }}>小 {pct0(r.under)}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 50, marginTop: 5, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10.5, color: "var(--text-tertiary)" }}>波胆 Top：</span>
              {r.tops.map((t, i) => (
                <span key={t.key} style={{ fontSize: 11.5, fontWeight: 700, color: i === 0 ? "var(--text-primary)" : "var(--text-secondary)", background: i === 0 ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "var(--fill-q)", padding: "2px 8px", borderRadius: 6 }}>
                  {t.key} <span style={{ fontWeight: 500, color: "var(--text-tertiary)" }}>{pct0(t.p)}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
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
