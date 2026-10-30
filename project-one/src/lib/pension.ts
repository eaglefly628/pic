/** 上海职工基本养老金的情景估算。默认值是公开示例；个人数据由本机加密金库保存。 */
export interface PensionInputs {
  asOfYear: number;
  paidYears: number;
  averageIndex: number;
  accountBalance: number;
  monthlyAverageWage: number;
  pensionRate: number;
  medicalRate: number;
  personalAccountRate: number;
  monthsAt60: number;
  monthsAt63: number;
  yearsTo60: number;
  yearsTo63: number;
  wageGrowth: number;
  accountInterest: number;
  ownInvestmentReturn: number;
}

export const DEFAULT_PENSION_INPUTS: PensionInputs = {
  asOfYear: 2026,
  paidYears: 20,
  averageIndex: 1,
  accountBalance: 100000,
  monthlyAverageWage: 12577,
  pensionRate: 0.2,
  medicalRate: 0.1,
  personalAccountRate: 0.08,
  monthsAt60: 139,
  monthsAt63: 117,
  yearsTo60: 10,
  yearsTo63: 13,
  wageGrowth: 0.03,
  accountInterest: 0.03,
  ownInvestmentReturn: 0.03,
};

export type PensionInputKey = keyof PensionInputs;

export interface PensionScenario {
  id: string;
  label: string;
  retirementAge: 60 | 63;
  contributionFactor: number;
  futureYears: number;
  totalPaidYears: number;
  averageIndex: number;
  retirementYear: number;
  retirementAverageWage: number;
  totalContributions: number;
  retirementAccountBalance: number;
  basicMonthly: number;
  accountMonthly: number;
  firstMonthly: number;
}

const scenarioSpecs = [
  { id: "stop60", label: "停缴 → 60岁", age: 60, factor: 0 },
  { id: "low60", label: "0.6倍 → 60岁", age: 60, factor: 0.6 },
  { id: "one60", label: "1倍 → 60岁", age: 60, factor: 1 },
  { id: "two60", label: "2倍 → 60岁", age: 60, factor: 2 },
  { id: "three60", label: "3倍 → 60岁", age: 60, factor: 3 },
  { id: "low63", label: "0.6倍 → 63岁", age: 63, factor: 0.6 },
] as const;

export function pensionScenario(
  inputs: PensionInputs,
  age: 60 | 63,
  factor: number,
  wageGrowth = inputs.wageGrowth,
  accountInterest = inputs.accountInterest,
): PensionScenario {
  const futureYears = age === 60 ? inputs.yearsTo60 : inputs.yearsTo63;
  // 停缴期间不是缴费年限，也不能以 0 指数加入平均缴费指数的分母。
  const newPaidYears = factor === 0 ? 0 : futureYears;
  const totalPaidYears = inputs.paidYears + newPaidYears;
  const averageIndex = totalPaidYears > 0
    ? (inputs.paidYears * inputs.averageIndex + newPaidYears * factor) / totalPaidYears
    : 0;
  let retirementAccountBalance = inputs.accountBalance;
  let totalContributions = 0;
  let monthlyWage = inputs.monthlyAverageWage;
  for (let year = 0; year < futureYears; year++) {
    totalContributions += monthlyWage * factor * (inputs.pensionRate + inputs.medicalRate) * 12;
    retirementAccountBalance = retirementAccountBalance * (1 + accountInterest)
      + monthlyWage * factor * inputs.personalAccountRate * 12;
    monthlyWage *= 1 + wageGrowth;
  }
  const retirementAverageWage = monthlyWage;
  const basicMonthly = retirementAverageWage * (1 + averageIndex) / 2 * totalPaidYears * 0.01;
  const accountMonthly = retirementAccountBalance / (age === 60 ? inputs.monthsAt60 : inputs.monthsAt63);
  return {
    id: `${factor}-${age}`,
    label: `${factor === 0 ? "停缴" : `${factor}倍`} → ${age}岁`,
    retirementAge: age,
    contributionFactor: factor,
    futureYears,
    totalPaidYears,
    averageIndex,
    retirementYear: inputs.asOfYear + futureYears,
    retirementAverageWage,
    totalContributions,
    retirementAccountBalance,
    basicMonthly,
    accountMonthly,
    firstMonthly: basicMonthly + accountMonthly,
  };
}

export function pensionScenarios(inputs: PensionInputs): PensionScenario[] {
  return scenarioSpecs.map(({ id, label, age, factor }) => ({
    ...pensionScenario(inputs, age, factor), id, label,
  }));
}

/** 原工作簿「停缴」行的计算口径，仅供与 Excel 对照；它把未缴费的未来年数也计入缴费年限。 */
export function workbookStopMonthly(inputs: PensionInputs): number {
  const stopped = pensionScenario(inputs, 60, 0);
  const workbookYears = inputs.paidYears + inputs.yearsTo60;
  const workbookIndex = workbookYears > 0
    ? inputs.paidYears * inputs.averageIndex / workbookYears
    : 0;
  return stopped.retirementAverageWage * (1 + workbookIndex) / 2 * workbookYears * 0.01
    + stopped.accountMonthly;
}

export function pensionStressTest(inputs: PensionInputs) {
  return [0.02, 0.03, 0.04].flatMap((wageGrowth) =>
    [0.02, 0.03, 0.04].map((accountInterest) => ({
      wageGrowth,
      accountInterest,
      result: pensionScenario(inputs, 60, 0.6, wageGrowth, accountInterest),
    })),
  );
}

/** 相同年度支出若在年末投入自有投资账户，到退休时的名义终值。 */
export function savedContributionFutureValue(inputs: PensionInputs, factor = 0.6): number {
  let balance = 0;
  let monthlyWage = inputs.monthlyAverageWage;
  for (let year = 0; year < inputs.yearsTo60; year++) {
    balance = balance * (1 + inputs.ownInvestmentReturn)
      + monthlyWage * factor * (inputs.pensionRate + inputs.medicalRate) * 12;
    monthlyWage *= 1 + inputs.wageGrowth;
  }
  return balance;
}

export function validatePensionInputs(inputs: PensionInputs): string[] {
  const errors: string[] = [];
  for (const [key, value] of Object.entries(inputs)) {
    if (!Number.isFinite(value)) errors.push(`${key} 不是有效数字`);
  }
  if (inputs.asOfYear < 2000 || inputs.asOfYear > 2100) errors.push("模型起点年份超出范围");
  if (inputs.paidYears < 0 || inputs.paidYears > 60) errors.push("已有缴费年限须在 0–60 年之间");
  if (inputs.averageIndex < 0 || inputs.averageIndex > 3) errors.push("已有平均缴费指数须在 0–3 之间");
  if (inputs.accountBalance < 0 || inputs.monthlyAverageWage <= 0) errors.push("个人账户不能为负，月平均工资须大于 0");
  if (inputs.yearsTo60 < 0 || inputs.yearsTo63 > 60 || inputs.yearsTo63 !== inputs.yearsTo60 + 3)
    errors.push("距 63 岁年数须比距 60 岁多 3 年");
  if (!Number.isInteger(inputs.yearsTo60) || !Number.isInteger(inputs.yearsTo63))
    errors.push("距退休年数须为整年");
  if (inputs.monthsAt60 <= 0 || inputs.monthsAt63 <= 0) errors.push("计发月数须大于 0");
  for (const key of ["pensionRate", "medicalRate", "personalAccountRate"] as const) {
    if (inputs[key] < 0 || inputs[key] > 1) errors.push(`${key} 须在 0–100% 之间`);
  }
  for (const key of ["wageGrowth", "accountInterest", "ownInvestmentReturn"] as const) {
    if (inputs[key] <= -1 || inputs[key] > 1) errors.push(`${key} 须在 -100% 到 100% 之间`);
  }
  return errors;
}
