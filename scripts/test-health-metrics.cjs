// Content coverage and safety-boundary checks; fixture contains only metric IDs.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('../project-four/node_modules/typescript');
const source = fs.readFileSync(path.join(__dirname, '../project-four/src/data/healthMetrics.ts'), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const mod = { exports: {} }; new Function('exports', js)(mod.exports);
const { METRIC_INFO, HEALTH_CATEGORIES } = mod.exports;
const expected = JSON.parse(fs.readFileSync(path.join(__dirname, 'health-metric-keys.json'), 'utf8'));
assert.ok(expected.length >= 155);
for (const key of expected) {
  const info = METRIC_INFO[key]; assert.ok(info, `Missing medical description: ${key}`);
  assert.ok(info.what.trim() && info.meaning.trim() && info.limits.trim(), key);
  assert.ok(info.categories.length && info.categories.every(c => HEALTH_CATEGORIES.includes(c)), key);
  assert.ok(info.sources.length && info.sources.every(s => /^https:\/\//.test(s.url) && s.title), key);
  assert.equal(info.checkedOn, '2026-11-05');
}
assert.notEqual(METRIC_INFO['cbc.neut.absolute'].what, METRIC_INFO['cbc.neut.percent'].what);
assert.match(METRIC_INFO['cbc.pct'].limits, /不是.*降钙素原/);
assert.match(METRIC_INFO['tumor.cea'].limits, /正常也不能排除癌症/);
assert.match(METRIC_INFO['tumor.tsgf'].limits, /未核实/);
assert.match(METRIC_INFO['virus.hbs_ab'].limits, /不是越高越严重/);
assert.match(METRIC_INFO['glucose.glucose_unspecified'].limits, /不与空腹血糖/);
assert.ok(!METRIC_INFO['stool.occult_blood'].categories.includes('肿瘤标志物'));
console.log(`Health metric coverage and interpretation boundaries passed: ${expected.length} metrics, ${HEALTH_CATEGORIES.length} categories.`);
