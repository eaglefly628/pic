#!/usr/bin/env node
// 「跟上次一样」回归测试：
//   ① 按钮显示上一期的金额和日期；点一下直接记一笔，不用再敲数字
//   ② 记完这一期就算「看过、确认没变」（历史里多一条同值记录）
//   ③ 往前补记时，「上次」取的是所选日期之前那一期，而不是最新那一期
//   ④ 所选日期早于所有记录（没有上一期可抄）时按钮不出现
//   ⑤ 这一期已经记过时按钮变成「覆盖成跟上次一样」
// 用法：node scripts/test-same-as-last.cjs [url]
const { chromium } = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');
const URL_ = process.argv[2] || 'http://localhost:8877/index.html';
const PW = 'demo1234';
let fails = 0;
const check = (b, msg) => { console.log(`  ${b ? '✓' : '✗'} ${msg}`); if (!b) fails++; };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  p.on('dialog', (d) => d.accept());

  await p.goto(URL_, { waitUntil: 'load' }); await p.waitForTimeout(900);
  if (await p.locator('input[placeholder="设置主密码"]').count()) {
    await p.locator('input[placeholder="设置主密码"]').fill(PW);
    await p.locator('input[placeholder="再次输入"]').fill(PW);
    await p.getByRole('button', { name: /创建|进入/ }).click();
  } else {
    await p.locator('input[type="password"]').first().fill(PW);
    await p.getByRole('button', { name: /解锁|进入/ }).click();
  }
  await p.waitForTimeout(1800);

  const NAME = `同值测试-${Date.now().toString(36).slice(-4)}`;
  const sameBtn = p.locator('button').filter({ hasText: /跟上次一样/ });
  const dateIn = p.locator('input[type="date"]');
  const amtIn = p.locator('input[inputmode="decimal"]').first();
  const openSnap = async () => { await p.getByRole('button', { name: /新增快照/ }).first().click(); await p.waitForTimeout(600); };
  const closeSnap = async () => { await p.getByRole('button', { name: /^取消$/ }).click(); await p.waitForTimeout(400); };
  const setDate = async (v) => { await dateIn.fill(v); await p.waitForTimeout(400); };
  const btnText = async () => (await sameBtn.count()) ? ((await sameBtn.first().innerText()) || '').replace(/\s+/g, ' ') : '';

  // 新建账户：初始余额会落到数据集里已有的最后一期（不是今天），正好当「上一期」
  await p.getByRole('button', { name: /^资金账户/ }).first().click(); await p.waitForTimeout(700);
  await p.getByRole('button', { name: /新增账户/ }).first().click(); await p.waitForTimeout(500);
  await p.locator('input[placeholder="如 招商银行储蓄卡"]').fill(NAME);
  await p.locator('input[placeholder="如 50000"]').first().fill('50000');
  await p.getByRole('button', { name: '添加', exact: true }).click(); await p.waitForTimeout(1200);
  await p.locator('.fv-row').filter({ hasText: NAME }).first().click(); await p.waitForTimeout(900);   // 账户行是 div 不是 button
  console.log(`账户「${NAME}」已建（初始 50,000）\n`);

  console.log('① 一键记同值');
  await openSnap();
  const todayISO = await dateIn.inputValue();
  const t0 = await btnText();
  check(/50,?000/.test(t0), `按钮带着上一期的金额：${t0}`);
  const md = /(\d+月\d+日) 记的/.exec(t0);
  check(!!md, '按钮带着上一期的日期');
  const baseMD = md ? md[1] : '';
  const ph = await amtIn.getAttribute('placeholder');
  check(/上次 ¥?50,?000/.test(ph || ''), `余额框占位符提示上次的值：${ph}`);
  await sameBtn.first().click(); await p.waitForTimeout(1400);
  check(await dateIn.count() === 0, '点一下就记完并关窗（不用再填数字、再点添加）');

  console.log('\n② 这一期算「看过、确认没变」');
  check((await p.locator('body').innerText()).match(/50,000/g)?.length >= 2, '上一期和这一期都是 50,000（金额跟上次相同）');
  await openSnap();                       // 重开弹窗，用「这一期已经记过」反查今天确实记上了
  const warn = await p.locator('text=/这一期已经记过/').count();
  const warnTxt = warn ? await p.locator('text=/这一期已经记过/').first().innerText() : '';
  check(warn > 0 && /50,?000/.test(warnTxt), `今天这一期确实记上了：${warnTxt.replace(/\s+/g, ' ')}`);
  await closeSnap();

  console.log('\n③ 往前补记时「上次」取所选日期之前那一期');
  // 在「上一期」和今天之间插一笔 33,333，制造两个候选
  const mid = new Date(todayISO); mid.setDate(mid.getDate() - 20);
  const midISO = iso(mid);
  await openSnap(); await setDate(midISO);
  await amtIn.fill('33333');
  await p.getByRole('button', { name: /^添加$|^覆盖这一期$/ }).click(); await p.waitForTimeout(1300);
  console.log(`  （已在 ${midISO} 插入 33,333）`);
  await openSnap();
  await setDate(todayISO);
  const tAfter = await btnText();
  check(/33,?333/.test(tAfter), `选今天 → 抄它前面最近那期 33,333：${tAfter}`);
  const early = new Date(todayISO); early.setDate(early.getDate() - 25);
  await setDate(iso(early));
  const tBefore = await btnText();
  check(/50,?000/.test(tBefore) && tBefore.includes(baseMD), `选 33,333 之前的日期 → 抄回更早那期 50,000（${baseMD}），而不是最新的：${tBefore}`);

  console.log('\n④ 没有上一期可抄时');
  await setDate('2015-01-05');
  check(await sameBtn.count() === 0, '所选日期早于所有记录 → 不显示按钮');

  console.log('\n⑤ 这一期已经记过时');
  await setDate(midISO);
  const tDup = await btnText();
  check(/覆盖成跟上次一样/.test(tDup), `按钮改口为覆盖：${tDup}`);
  check(/50,?000/.test(tDup), '覆盖时抄的仍是它之前那期，不是自己');
  await closeSnap();

  console.log('\n页面错误:', errs.length ? errs.slice(0, 3) : '无');
  await b.close();
  console.log(fails ? `\n✗ ${fails} 项失败` : '\n全部通过 ✓');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
