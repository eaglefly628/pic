import { useMemo, useState } from "react";
import { useBreakpoint } from "../lib/breakpoint";
import { fmt } from "../lib/format";
import {
  DEFAULT_PENSION_INPUTS, pensionScenarios, pensionStressTest,
  savedContributionFutureValue, validatePensionInputs, workbookStopMonthly,
  type PensionInputKey, type PensionInputs, type PensionScenario,
} from "../lib/pension";
import { useVault } from "../vault/VaultContext";
import { Btn, card, TextField } from "../ui";

type InputSpec = { key: PensionInputKey; label: string; hint?: string; kind?: "percent"; step?: string };

const GROUPS: { title: string; fields: InputSpec[] }[] = [
  { title: "已有记录", fields: [
    { key: "asOfYear", label: "当前年份", hint: "模型起点", step: "1" },
    { key: "paidYears", label: "当前缴费年限（年）", hint: "按实际月数折算成年", step: "0.083333" },
    { key: "averageIndex", label: "当前平均缴费指数（估）", hint: "可根据缴费记录填写", step: "0.001" },
    { key: "accountBalance", label: "当前养老个人账户（元）", hint: "请填写个人账户余额", step: "0.01" },
    { key: "monthlyAverageWage", label: "当前上海月平均工资（元）", hint: "示例基准，可修改", step: "1" },
  ] },
  { title: "未来时间与计发", fields: [
    { key: "yearsTo60", label: "距 60 岁年数", hint: "改动时自动联动 63 岁", step: "1" },
    { key: "yearsTo63", label: "距 63 岁年数", hint: "改动时自动联动 60 岁", step: "1" },
    { key: "monthsAt60", label: "60 岁计发月数", hint: "原表现行口径", step: "1" },
    { key: "monthsAt63", label: "63 岁计发月数", hint: "原表现行口径", step: "1" },
  ] },
  { title: "缴费与增长假设", fields: [
    { key: "pensionRate", label: "养老缴费比例", kind: "percent", hint: "原表灵活就业假设" },
    { key: "medicalRate", label: "医保缴费比例", kind: "percent", hint: "原表灵活就业假设" },
    { key: "personalAccountRate", label: "养老个人账户计入比例", kind: "percent", hint: "原表按缴费基数的 8%" },
    { key: "wageGrowth", label: "工资／缴费基数年增长率", kind: "percent", hint: "原表黄色关键假设，压力测试比较 2%／3%／4%" },
    { key: "accountInterest", label: "个人账户年记账率", kind: "percent", hint: "原表黄色关键假设，压力测试比较 2%／3%／4%" },
    { key: "ownInvestmentReturn", label: "自行投资年收益假设", kind: "percent", hint: "只用于展示停缴后的资金机会成本" },
  ] },
];

const ALL_FIELDS = GROUPS.flatMap((group) => group.fields);
const money = fmt;
const moneyCents = (value: number) => `¥${value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const rounded = (value: number) => value.toLocaleString("zh-CN", { maximumFractionDigits: 2 });

function draftFrom(inputs: PensionInputs): Record<PensionInputKey, string> {
  return Object.fromEntries(ALL_FIELDS.map(({ key, kind }) => [key,
    String(kind === "percent" ? inputs[key] * 100 : inputs[key]),
  ])) as Record<PensionInputKey, string>;
}

function readDraft(draft: Record<PensionInputKey, string>): { value: PensionInputs | null; errors: string[] } {
  const raw: Record<string, number> = {};
  const errors: string[] = [];
  for (const { key, label, kind } of ALL_FIELDS) {
    const text = draft[key].trim();
    const number = text === "" ? NaN : Number(text);
    if (!Number.isFinite(number)) errors.push(`请填写${label}`);
    raw[key] = kind === "percent" ? number / 100 : number;
  }
  if (errors.length) return { value: null, errors };
  const value = raw as unknown as PensionInputs;
  errors.push(...validatePensionInputs(value));
  return { value: errors.length ? null : value, errors };
}

const noteStyle = { color: "var(--text-tertiary)", fontSize: 12, lineHeight: 1.6 } as const;

export default function Pension() {
  const { data, update } = useVault();
  const saved = data?.pension ?? DEFAULT_PENSION_INPUTS;
  return <PensionView saved={saved} onSave={(next) => update((vault) => { vault.pension = next; })} />;
}

/** 同一页面可用于隔离的界面预览；正式入口始终由金库提供和保存数据。 */
export function PensionView({ saved, onSave, preview = false }: {
  saved: PensionInputs;
  onSave: (next: PensionInputs) => Promise<void> | void;
  preview?: boolean;
}) {
  const phone = useBreakpoint() === "phone";
  const [draft, setDraft] = useState(() => draftFrom(saved));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const parsed = useMemo(() => readDraft(draft), [draft]);
  const inputs = parsed.value ?? saved;
  const changed = ALL_FIELDS.some(({ key, kind }) => {
    const display = kind === "percent" ? saved[key] * 100 : saved[key];
    return Number(draft[key]) !== display;
  });
  const scenarios = useMemo(() => pensionScenarios(inputs), [inputs]);
  const stress = useMemo(() => pensionStressTest(inputs), [inputs]);
  const stopped = scenarios[0], low60 = scenarios[1], low63 = scenarios[5];
  const addedMonthly = low60.firstMonthly - stopped.firstMonthly;
  const delayedMonthly = low63.firstMonthly - low60.firstMonthly;
  const extraSpendingTo63 = low63.totalContributions - low60.totalContributions;
  const ownInvested = savedContributionFutureValue(inputs);
  const originalStopMonthly = workbookStopMonthly(inputs);
  const monthlyLowContribution = inputs.monthlyAverageWage * 0.6 * (inputs.pensionRate + inputs.medicalRate);

  const changeDraft = (key: PensionInputKey, value: string) => {
    setDraft((before) => {
      const next = { ...before, [key]: value };
      // 两个退休时间按同一出生日期联动，避免只改一格时表单暂时无法保存。
      const years = Number(value);
      if (Number.isInteger(years)) {
        if (key === "yearsTo60") next.yearsTo63 = String(years + 3);
        if (key === "yearsTo63") next.yearsTo60 = String(years - 3);
      }
      return next;
    });
    setMessage("");
  };

  const save = async () => {
    if (!parsed.value || saving) return;
    setSaving(true);
    setMessage("");
    try {
      const next = parsed.value;
      await onSave(next);
      setMessage(preview ? "预览中的假设已更新（关闭页面后不保留）" : "假设已保存到加密金库");
    } catch {
      setMessage("保存失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  return <div style={{ padding: phone ? "18px 14px 34px" : "26px 32px 42px", maxWidth: 1120, margin: "0 auto" }}>
    {preview && <div style={{ ...card, padding: "10px 14px", marginBottom: 14, color: "var(--accent)", fontSize: 12.5 }}>界面预览 · 不会修改当前家庭理财金库</div>}
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
      <div>
        <h1 style={{ fontSize: phone ? 22 : 26, margin: "0 0 6px", color: "var(--text-primary)" }}>上海养老金测算</h1>
        <p style={{ ...noteStyle, margin: 0 }}>逐项查看假设、六个方案、九组压力测试与一页汇总。</p>
      </div>
    </div>

    <nav className="fv-pension-nav" aria-label="养老金模型内容">
      <a href="#pension-inputs">可修改的假设</a>
      <a href="#pension-decision">决策摘要</a>
      <a href="#pension-scenarios">方案总览</a>
      <a href="#pension-stress">压力测试</a>
      <a href="#pension-print">一页汇总</a>
    </nav>

    <section id="pension-inputs" style={{ ...card, padding: phone ? 16 : 22, marginBottom: 18 }}>
      <div style={{ fontSize: 16, fontWeight: 650, color: "var(--text-primary)", marginBottom: 4 }}>模型假设 · 直接修改</div>
      <p style={{ ...noteStyle, margin: "0 0 14px" }}>以下 15 项对应 Excel“模型假设”蓝字输入。修改后即时重算；点“保存假设”才写入加密金库。工资增长、记账率和自行投资收益是原表黄色重点假设。</p>
      {GROUPS.map((group) => <div key={group.title} style={{ marginBottom: 17 }}>
        <div style={{ fontSize: 13, fontWeight: 650, color: "var(--text-secondary)", marginBottom: 10 }}>{group.title}</div>
        <div style={{ display: "grid", gridTemplateColumns: phone ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: "10px 16px" }}>
          {group.fields.map(({ key, label, hint, kind, step }) => <label key={key} style={{ display: "block", minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 5 }}>{label}{kind === "percent" ? "（%）" : ""}</span>
            <TextField type="number" step={step ?? "any"} value={draft[key]}
              onChange={(e) => changeDraft(key, e.target.value)} aria-label={label} />
            {hint && <span style={{ ...noteStyle, display: "block", fontSize: 11, marginTop: 3 }}>{hint}</span>}
          </label>)}
        </div>
      </div>)}
      {parsed.errors.length > 0 && <div role="alert" style={{ color: "var(--red)", fontSize: 12, marginBottom: 10 }}>{parsed.errors[0]}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Btn disabled={!parsed.value || !changed || saving} onClick={save}>{saving ? "保存中…" : "保存假设"}</Btn>
        {message && <span role="status" style={{ ...noteStyle, color: message.includes("失败") ? "var(--red)" : "var(--green)" }}>{message}</span>}
        {!parsed.value && <span style={noteStyle}>当前输入无效，结果暂按上次保存的假设显示。</span>}
      </div>
    </section>

    <div style={{ display: "grid", gridTemplateColumns: phone ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: 12, marginBottom: 18 }}>
      <SummaryCard label="0.6 倍缴到 60 岁" value={`${money(low60.firstMonthly)}／月`} detail={`预计 ${low60.retirementYear} 年开始领取`} strong />
      <SummaryCard label="停缴到 60 岁" value={`${money(stopped.firstMonthly)}／月`} detail={`两方案首月差额 ${money(addedMonthly)}／月`} />
      <SummaryCard label="0.6 倍缴到 63 岁" value={`${money(low63.firstMonthly)}／月`} detail={`比 60 岁方案每月多 ${money(delayedMonthly)}`} />
    </div>

    <section id="pension-decision" style={{ ...card, padding: phone ? 16 : 22, marginBottom: 18 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 12px", color: "var(--text-primary)" }}>决策摘要</h2>
      <div style={{ display: "grid", gridTemplateColumns: phone ? "1fr" : "1fr 1fr", gap: "0 24px" }}>
        <InfoRow label="当前平均缴费指数（估）" value={inputs.averageIndex.toFixed(3)} />
        <InfoRow label="0.6 倍缴到 60 岁的平均指数" value={low60.averageIndex.toFixed(3)} />
        <InfoRow label="0.6 倍缴到 60 岁的累计支出" value={money(low60.totalContributions)} />
        <InfoRow label="0.6 倍缴到 60 岁的首月养老金" value={money(low60.firstMonthly)} />
        <InfoRow label="停缴到 60 岁的首月养老金（修正）" value={money(stopped.firstMonthly)} />
        <InfoRow label="0.6 倍缴到 63 岁的首月养老金" value={money(low63.firstMonthly)} />
      </div>
      <p style={{ ...noteStyle, margin: "14px 0 0" }}>Excel 原表“模型倾向”：0.6缴到60岁，届时优先考虑60岁弹性退休。</p>
      <p style={{ ...noteStyle, margin: "8px 0 0" }}>Excel 原表“阅读方式”：先看“方案总览”比较停缴、0.6、1/2/3倍以及63岁方案；再看“压力测试”观察工资增长和账户记账率变化是否会推翻结论。当前中性假设下，0.6继续缴的综合性价比较高，而60岁与63岁的取舍主要取决于是否愿意放弃60—63岁三年的养老金领取。这些是原表文字，修改假设后不会自动改写。</p>
    </section>

    <section style={{ ...card, padding: phone ? 16 : 22, marginBottom: 18, border: "1px solid var(--separator-strong)" }}>
      <h2 style={{ fontSize: 16, margin: "0 0 8px", color: "var(--text-primary)" }}>与 Excel 原表对照</h2>
      <p style={{ ...noteStyle, margin: 0 }}>原表“停缴 → 60 岁”按 <strong>{moneyCents(originalStopMonthly)}／月</strong> 计算；本页按实际缴费年限修正为 <strong>{moneyCents(stopped.firstMonthly)}／月</strong>。原表将未来未缴费的 {inputs.yearsTo60} 年也加入缴费年限，所以这行相差 {moneyCents(originalStopMonthly - stopped.firstMonthly)}／月。其余五个方案在默认输入下与 Excel 缓存值一致。打印页另有一处固定文字“当前 0.6 月缴费 ¥2,263.80”；按其输入值计算是 {moneyCents(monthlyLowContribution)}。</p>
    </section>

    <section id="pension-scenarios" style={{ ...card, padding: phone ? 16 : 22, marginBottom: 18 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 4px", color: "var(--text-primary)" }}>方案总览</h2>
      <p style={{ ...noteStyle, margin: "0 0 14px" }}>对应 Excel“方案总览”全部列。累计支出包含养老和医保缴费；首月养老金只按基础养老金与个人账户养老金估算。</p>
      {phone ? <div style={{ display: "grid", gap: 9 }}>
        {scenarios.map((s) => <ScenarioCard key={s.id} scenario={s} />)}
      </div> : <div style={{ overflowX: "auto" }}>
        <table className="fv-pension-table"><thead><tr>
          <th>方案</th><th>退休年龄</th><th>未来倍数</th><th>未来缴费年数</th><th>退休累计年限</th><th>退休平均指数</th><th>退休月社平工资</th><th>累计社保支出</th><th>退休养老账户</th><th>基础养老金／月</th><th>个人账户养老金／月</th><th>首月养老金／月</th><th>备注</th>
        </tr></thead><tbody>{scenarios.map((s) => <tr key={s.id} style={{ background: s.id === "low60" ? "var(--accent-soft)" : undefined }}>
          <td>{s.label}</td><td>{s.retirementAge} 岁</td><td>{s.contributionFactor}</td><td>{s.futureYears} 年</td>
          <td>{rounded(s.totalPaidYears)} 年</td><td>{s.averageIndex.toFixed(3)}</td><td>{money(s.retirementAverageWage)}</td>
          <td>{money(s.totalContributions)}</td><td>{money(s.retirementAccountBalance)}</td>
          <td>{money(s.basicMonthly)}</td><td>{money(s.accountMonthly)}</td><td><strong>{money(s.firstMonthly)}</strong></td><td>{scenarioNote(s.id)}</td>
        </tr>)}</tbody></table>
      </div>}
    </section>

    <section style={{ display: "grid", gridTemplateColumns: phone ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 18 }}>
      <div style={{ ...card, padding: phone ? 16 : 22 }}>
        <h2 style={{ fontSize: 16, margin: "0 0 14px", color: "var(--text-primary)" }}>60 岁与 63 岁</h2>
        <InfoRow label="63 岁方案每月多领" value={money(delayedMonthly)} />
        <InfoRow label="60–63 岁可先领的 36 个月" value={money(low60.firstMonthly * 36)} />
        <InfoRow label="延后 3 年增加的社保支出" value={money(extraSpendingTo63)} />
        <p style={{ ...noteStyle, margin: "12px 0 0" }}>以上为名义金额，不计退休后调待、折现、税费或政策变动。是否能在 60 岁弹性退休，应以届时规定和个人资格为准。</p>
      </div>
      <div style={{ ...card, padding: phone ? 16 : 22 }}>
        <h2 style={{ fontSize: 16, margin: "0 0 14px", color: "var(--text-primary)" }}>停缴的资金机会成本</h2>
        <InfoRow label="0.6 倍缴到 60 岁的累计支出" value={money(low60.totalContributions)} />
        <InfoRow label="同额逐年自行投资的退休终值" value={money(ownInvested)} />
        <p style={{ ...noteStyle, margin: "12px 0 0" }}>按每年末投入、年收益 {rounded(inputs.ownInvestmentReturn * 100)}% 测算。该金额包含医保缴费的假想投资，不代表停缴后仍有职工医保，也不能直接与终身养老金等价比较。</p>
      </div>
    </section>

    <section id="pension-stress" style={{ ...card, padding: phone ? 16 : 22, marginBottom: 18 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 4px", color: "var(--text-primary)" }}>0.6 倍缴到 60 岁：压力测试</h2>
      <p style={{ ...noteStyle, margin: "0 0 14px" }}>先看 3 × 3 首月养老金，再看 Excel“压力测试”的全部八列。测试档位固定为 2%／3%／4%；其余输入跟随上方假设。</p>
      <div style={{ overflowX: "auto" }}><table className="fv-pension-table fv-pension-stress"><thead><tr>
        <th>工资增长 \ 记账率</th>{[2, 3, 4].map((v) => <th key={v}>{v}%</th>)}
      </tr></thead><tbody>{[2, 3, 4].map((growth, i) => <tr key={growth}>
        <td>{growth}%</td>{stress.slice(i * 3, i * 3 + 3).map(({ accountInterest, result }) => <td key={accountInterest} style={{ background: growth === 3 && accountInterest === 0.03 ? "var(--accent-soft)" : undefined }}>{money(result.firstMonthly)}</td>)}
      </tr>)}</tbody></table></div>
      <h3 style={{ fontSize: 14, margin: "22px 0 8px", color: "var(--text-primary)" }}>九组情景明细</h3>
      <div style={{ overflowX: "auto" }}><table className="fv-pension-table"><thead><tr>
        <th>工资增速</th><th>记账率</th><th>退休月社平工资</th><th>累计社保支出</th><th>退休养老账户</th><th>基础养老金／月</th><th>个人账户养老金／月</th><th>首月养老金／月</th>
      </tr></thead><tbody>{stress.map(({ wageGrowth, accountInterest, result }) => <tr key={`${wageGrowth}-${accountInterest}`}>
        <td>{rounded(wageGrowth * 100)}%</td><td>{rounded(accountInterest * 100)}%</td>
        <td>{money(result.retirementAverageWage)}</td><td>{money(result.totalContributions)}</td>
        <td>{money(result.retirementAccountBalance)}</td><td>{money(result.basicMonthly)}</td>
        <td>{money(result.accountMonthly)}</td><td><strong>{money(result.firstMonthly)}</strong></td>
      </tr>)}</tbody></table></div>
    </section>

    <section id="pension-print" style={{ ...card, padding: phone ? 16 : 22, marginBottom: 18 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 12px", color: "var(--text-primary)" }}>一页汇总</h2>
      <p style={{ ...noteStyle, margin: "0 0 14px" }}>对应 Excel 的“一页打印版”。这里随上方输入重算；原表的历史说明和决策文字单独标注。</p>
      <div style={{ display: "grid", gridTemplateColumns: phone ? "1fr" : "1fr 1fr", gap: "0 24px" }}>
        <InfoRow label="当前缴费年限" value={`${rounded(inputs.paidYears)} 年`} />
        <InfoRow label="当前平均指数（估）" value={inputs.averageIndex.toFixed(3)} />
        <InfoRow label="养老个人账户" value={moneyCents(inputs.accountBalance)} />
        <InfoRow label="上海月均工资" value={money(inputs.monthlyAverageWage)} />
        <InfoRow label="当前 0.6 倍月缴费（按输入计算）" value={moneyCents(monthlyLowContribution)} />
        <InfoRow label="工资增长／账户记账假设" value={`${rounded(inputs.wageGrowth * 100)}%／${rounded(inputs.accountInterest * 100)}%`} />
      </div>
      <p style={{ ...noteStyle, margin: "10px 0 16px" }}>原表的历史结构文字：2011–2024 年基本 3 倍封顶；2025 年起约 0.6 倍。当前总资产不影响社保公式。</p>
      <h3 style={{ fontSize: 14, margin: "0 0 8px", color: "var(--text-primary)" }}>核心方案对比</h3>
      <div style={{ overflowX: "auto" }}><table className="fv-pension-table"><thead><tr>
        <th>方案</th><th>退休年龄</th><th>未来倍数</th><th>累计年限</th><th>退休平均指数</th><th>累计社保支出</th><th>退休养老账户</th><th>基础养老金／月</th><th>个人账户／月</th><th>首月养老金／月</th>
      </tr></thead><tbody>{scenarios.map((s) => <tr key={s.id}>
        <td>{s.label}</td><td>{s.retirementAge} 岁</td><td>{s.contributionFactor}</td>
        <td>{rounded(s.totalPaidYears)} 年</td><td>{s.averageIndex.toFixed(3)}</td>
        <td>{money(s.totalContributions)}</td><td>{money(s.retirementAccountBalance)}</td>
        <td>{money(s.basicMonthly)}</td><td>{money(s.accountMonthly)}</td><td><strong>{money(s.firstMonthly)}</strong></td>
      </tr>)}</tbody></table></div>
      <h3 style={{ fontSize: 14, margin: "20px 0 8px", color: "var(--text-primary)" }}>0.6 倍缴到 60 岁：压力测试摘要</h3>
      <div style={{ overflowX: "auto" }}><table className="fv-pension-table"><thead><tr>
        <th>工资增速</th><th>账户记账率</th><th>累计社保支出</th><th>退休养老账户</th><th>首月养老金／月</th>
      </tr></thead><tbody>{[stress[0], stress[4], stress[8]].map(({ wageGrowth, accountInterest, result }) => <tr key={`${wageGrowth}-${accountInterest}`}>
        <td>{rounded(wageGrowth * 100)}%</td><td>{rounded(accountInterest * 100)}%</td>
        <td>{money(result.totalContributions)}</td><td>{money(result.retirementAccountBalance)}</td><td>{money(result.firstMonthly)}</td>
      </tr>)}</tbody></table></div>
      <div style={{ display: "grid", gridTemplateColumns: phone ? "1fr" : "1fr 1fr", gap: "0 24px", marginTop: 16 }}>
        <InfoRow label="60 岁首月养老金" value={money(low60.firstMonthly)} />
        <InfoRow label="63 岁首月养老金" value={money(low63.firstMonthly)} />
        <InfoRow label="两者首月差额" value={money(delayedMonthly)} />
        <InfoRow label="预计开始领取" value={`${low60.retirementYear}／${low63.retirementYear} 年`} />
      </div>
      <p style={{ ...noteStyle, margin: "14px 0 0" }}>Excel 原表“退休选择”：60岁先领3年；63岁月领更高。</p>
      <p style={{ ...noteStyle, margin: "8px 0 0" }}>Excel 原表“当前决策结论”：基准选择：继续按0.6最低档缴到60岁，并在届时政策允许的情况下优先考虑60岁弹性退休。理由：前期已有多年3倍封顶和较高个人账户；后期0.6主要用于低成本增加缴费年限并维持职工医保。中性模型下，0.6缴到60岁首月养老金约1.66万元；63岁约2.05万元，但63岁方案放弃60—63岁三年的养老金领取并继续缴费。该文字不随输入自动改写。</p>
      <p style={{ ...noteStyle, margin: "8px 0 0" }}>Excel 原表注：本页为一页打印摘要。金额均为模型估算，按现行养老金公式及假设计算；未来上海工资基数、个人账户记账利率、医保/养老缴费比例、弹性退休政策变化均会影响实际结果。</p>
    </section>

    <p style={{ ...noteStyle, margin: 0 }}>
      本页是情景测算，未纳入过渡性养老金及未来政策变化。原表“停缴”行把未缴费的未来年数计入缴费年限，本页已按实际缴费年限修正，因此停缴结果会与原表不同。
      公式依据：<a href="https://rsj.sh.gov.cn/tshbx_17729/20220117/t0035_1405188.html" target="_blank" rel="noreferrer">上海市人社局养老金计发办法</a>。
    </p>
  </div>;
}

function SummaryCard({ label, value, detail, strong = false }: { label: string; value: string; detail: string; strong?: boolean }) {
  return <div style={{ ...card, padding: "17px 18px", background: strong ? "var(--accent-soft)" : "var(--bg-card)" }}>
    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 700, color: strong ? "var(--accent)" : "var(--text-primary)", margin: "6px 0", fontVariantNumeric: "tabular-nums" }}>{value}</div>
    <div style={noteStyle}>{detail}</div>
  </div>;
}

function ScenarioCard({ scenario: s }: { scenario: PensionScenario }) {
  return <div style={{ border: "0.5px solid var(--separator)", borderRadius: 10, padding: 12, background: s.id === "low60" ? "var(--accent-soft)" : "var(--bg-card)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, color: "var(--text-primary)", fontWeight: 600, fontSize: 13 }}>
      <span>{s.label}</span><span>{money(s.firstMonthly)}／月</span>
    </div>
    <div style={{ ...noteStyle, marginTop: 7 }}>{scenarioNote(s.id)} · 退休 {s.retirementAge} 岁 · 未来 {s.contributionFactor} 倍缴 {s.futureYears} 年</div>
    <div style={noteStyle}>累计 {rounded(s.totalPaidYears)} 年 · 平均指数 {s.averageIndex.toFixed(3)} · 退休月社平工资 {money(s.retirementAverageWage)}</div>
    <div style={noteStyle}>累计支出 {money(s.totalContributions)} · 退休养老账户 {money(s.retirementAccountBalance)}</div>
    <div style={noteStyle}>基础 {money(s.basicMonthly)} ＋ 个人账户 {money(s.accountMonthly)}</div>
  </div>;
}

function scenarioNote(id: string): string {
  const notes: Record<string, string> = {
    stop60: "不新增社保", low60: "基准推荐", one60: "提高档位",
    two60: "高档", three60: "顶格", low63: "延迟退休",
  };
  return notes[id] ?? "";
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "0.5px solid var(--separator)" }}>
    <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{label}</span>
    <strong style={{ fontSize: 13, color: "var(--text-primary)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{value}</strong>
  </div>;
}
