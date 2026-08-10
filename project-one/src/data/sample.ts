// 示例数据（脱敏演示用）—— 来自设计稿的演示账户。
// 真实数据由 `npm run import:excel` 生成的 history.json 覆盖（不进仓库）。

import type { AccountMeta, Dataset, Snapshot } from "./types";

type SampleAcc = AccountMeta & { comp: string; latest: number };

const ACCS: SampleAcc[] = [
  { id: "cmb",    name: "招商银行储蓄卡", cat: "liquid", type: "储蓄/活期", comp: "现金及银行", institution: "招商银行", owner: "爸爸", color: "#ae431e", latest: 128500 },
  { id: "icbc",   name: "工商银行储蓄卡", cat: "liquid", type: "储蓄/活期", comp: "现金及银行", institution: "工商银行", owner: "妈妈", color: "#c2603a", latest: 86200 },
  { id: "wechat", name: "微信零钱",       cat: "liquid", type: "现金/支付", comp: "现金及银行", institution: "微信支付", owner: "妈妈", color: "#008a62", latest: 8750 },
  { id: "cash",   name: "家庭现金",       cat: "liquid", type: "现金",      comp: "现金及银行", institution: "—",        owner: "全家", color: "#8a7a6e", latest: 12000 },
  { id: "stock",  name: "招商证券",       cat: "invest", type: "证券/股票", comp: "股票",       institution: "招商证券", owner: "爸爸", color: "#7d8a1e", latest: 234000 },
  { id: "bond",   name: "国债 · 三年定期", cat: "invest", type: "定期",     comp: "理财/固收", institution: "中国银行", owner: "妈妈", color: "#be850c", latest: 200000 },
  { id: "fund",   name: "华夏基金定投",   cat: "invest", type: "基金",      comp: "基金",       institution: "华夏基金", owner: "爸爸", color: "#a964ba", latest: 156800 },
  { id: "alipay", name: "支付宝 · 余额宝", cat: "invest", type: "理财",     comp: "理财/固收", institution: "支付宝",   owner: "爸爸", color: "#0f7f74", latest: 45300 },
  { id: "house",  name: "自住房产",       cat: "estate", type: "房产",      comp: "房产",       institution: "—",        owner: "全家", color: "#005b9b", latest: 3200000 },
  { id: "loan",   name: "住房贷款",       cat: "debt",   type: "负债/房贷", comp: "负债",       institution: "招商银行", owner: "全家", color: "#a03a63", latest: -1450000 },
];

// 设计稿的 12 个月净值曲线，用于按比例反推每个账户的历史余额
const TREND = [2358000, 2372000, 2390000, 2405000, 2440000, 2468000, 2495000, 2510000, 2548000, 2572000, 2598000, 2621550];

function months(): string[] {
  // 最近 12 个月，截止到 2026-06
  const out: string[] = [];
  let y = 2025, m = 7;
  for (let i = 0; i < 12; i++) {
    const lastDay = new Date(y, m, 0).getDate();
    out.push(`${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

function buildSnapshots(): Snapshot[] {
  const ms = months();
  const lastTrend = TREND[TREND.length - 1];
  return TREND.map((t, i) => {
    const ratio = t / lastTrend;
    const balances: Record<string, number> = {};
    for (const a of ACCS) balances[a.id] = Math.round(a.latest * ratio);
    return { date: ms[i], balances, source: "manual" as const };
  });
}

export const sampleDataset: Dataset = {
  vaultName: "junbai家专用理财软件",
  userName: "eaglefly",
  real: false,
  accounts: ACCS.map((a) => ({
    id: a.id, name: a.name, cat: a.cat, type: a.type, comp: a.comp,
    institution: a.institution, owner: a.owner, color: a.color,
  })),
  snapshots: buildSnapshots(),
};
