import assert from "node:assert/strict";
import {
  DEFAULT_PENSION_INPUTS, pensionScenario, pensionScenarios,
  pensionStressTest, savedContributionFutureValue, validatePensionInputs, workbookStopMonthly,
} from "../src/lib/pension.ts";

const scenarios = pensionScenarios(DEFAULT_PENSION_INPUTS);
assert.equal(scenarios.length, 6);
assert.equal(scenarios[0].totalPaidYears, DEFAULT_PENSION_INPUTS.paidYears);
assert.equal(scenarios[0].averageIndex, DEFAULT_PENSION_INPUTS.averageIndex);
assert.equal(scenarios[0].totalContributions, 0);
assert.ok(Number.isFinite(scenarios[0].firstMonthly));
assert.ok(Number.isFinite(workbookStopMonthly(DEFAULT_PENSION_INPUTS)));
assert.equal(pensionStressTest(DEFAULT_PENSION_INPUTS).length, 9);
assert.ok(savedContributionFutureValue(DEFAULT_PENSION_INPUTS) > 0);
const flat = { ...DEFAULT_PENSION_INPUTS, wageGrowth: 0, accountInterest: 0, ownInvestmentReturn: 0 };
assert.ok(Number.isFinite(pensionScenario(flat, 60, 0.6).firstMonthly));
assert.ok(Number.isFinite(savedContributionFutureValue(flat)));
assert.deepEqual(validatePensionInputs(flat), []);
assert.ok(validatePensionInputs({ ...flat, yearsTo60: 10.5 }).length > 0);
assert.ok(validatePensionInputs({ ...flat, yearsTo63: 17 }).length > 0);
console.log("养老金测算校验通过");
