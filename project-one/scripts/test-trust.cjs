#!/usr/bin/env node
// 家族信托 / 独立运营资产的回归测试：
//   ① 默认开启：设置里开关是开的，分组里直接有「家族信托」（产品面向有一定资产规模的家庭）
//   ② 关掉再打开：关掉后分组里就没有了，入口收起来
//   ③ 选成家族信托会自动给一套默认：独立运营 + 今天起锁 2 年，解锁日算对
//   ④ 建好之后：净资产、总资产一分没变（信托不进总数），单独一张卡列出来，合计对得上
//   ⑤ 账户列表有「独立运营」标，详情页有锁定期进度条，利息预测单独说明
//   ⑥ 把开关关掉：给出提示，信托重新计回净资产，钱一分不少；再打开又回到分开算
//   ⑦ 手机排版不溢出
// 用法：node scripts/test-trust.cjs [url]
const { chromium } = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const URL_ = process.argv[2] || 'http://localhost:8877/index.html';
const OUT = path.join(__dirname, '..', '.audit-phone') + path.sep;
fs.mkdirSync(OUT, { recursive: true });
const PW = 'demo1234';
const AMT = 1000000;
let fails = 0;
const check = (b, msg) => { console.log(`  ${b ? '✓' : '✗'} ${msg}`); if (!b) fails++; };
const money = (s) => Number(String(s || '').replace(/[^\d.-]/g, ''));

(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const dialogs = []; p.on('dialog', (d) => { dialogs.push(d.message()); d.accept(); });

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

  const nav = async (name) => { await p.getByRole('button', { name }).first().click(); await p.waitForTimeout(900); };
  const body = () => p.locator('body').innerText();
  // 「净资产」「总资产」这些数字是紧跟在标签后面的那个兄弟节点
  const labelled = async (label) => await p.evaluate((l) => {
    for (const el of document.querySelectorAll('div')) {
      if (el.textContent.trim() === l && el.nextElementSibling) return el.nextElementSibling.textContent.trim();
    }
    return null;
  }, label);
  const readTotals = async () => { await p.waitForTimeout(1300); return { net: money(await labelled('净资产')), assets: money(await labelled('总资产')) }; };
  const openAccEditor = async () => { await nav(/^资金账户/); await p.getByRole('button', { name: /新增账户/ }).first().click(); await p.waitForTimeout(600); };
  const catSelect = () => p.locator('select').first();
  const settingsSwitch = () => p.locator('label.fv-switch');
  const switchOn = async () => await p.locator('label.fv-switch input[type="checkbox"]').first().isChecked();

  console.log('① 默认就是开的');
  await nav(/^仪表盘/);
  const t0 = await readTotals();
  check(t0.net > 0 && t0.assets > 0, `读到基线：净资产 ${t0.net.toLocaleString()} / 总资产 ${t0.assets.toLocaleString()}`);
  check(!/独立运营资产/.test(await body()), '还没建信托账户时不出现「独立运营资产」卡');
  await nav(/^设置$/);
  check(await settingsSwitch().count() === 1, '设置「功能模块」里有这个开关');
  check(await switchOn(), '开关默认就是打开的（产品面向有一定资产规模的家庭）');
  check(!/用不到就别开/.test(await body()), '文案不再把它当小众功能劝退');
  await openAccEditor();
  let cats = await catSelect().locator('option').allTextContents();
  check(cats.includes('家族信托'), `分组里直接就有「家族信托」：${cats.join('/')}`);
  await p.getByRole('button', { name: /^取消$/ }).click(); await p.waitForTimeout(500);

  console.log('\n② 家里没有这类资产可以关掉');
  await nav(/^设置$/);
  await settingsSwitch().click(); await p.waitForTimeout(700);
  check(!(await switchOn()), '关掉了');
  check(/已关闭/.test(await body()), '说明了关掉之后会怎样');
  await openAccEditor();
  cats = await catSelect().locator('option').allTextContents();
  check(!cats.includes('家族信托'), `关掉后分组里就没有了：${cats.join('/')}`);
  check(!/独立运营设定/.test(await body()), '「独立运营设定」那一块也收起来了');
  await p.getByRole('button', { name: /^取消$/ }).click(); await p.waitForTimeout(500);
  await nav(/^设置$/);
  await settingsSwitch().click(); await p.waitForTimeout(700);   // 再打开，继续往下测
  await openAccEditor();

  console.log('\n③ 选成家族信托的默认设定');
  await catSelect().selectOption({ label: '家族信托' }); await p.waitForTimeout(600);
  let txt = await body();
  check(/独立运营设定/.test(txt), '出现「独立运营设定」');
  const lockSel = p.locator('select').nth(3);   // 分组/资产类型/归属/锁定期
  const lockVal = await lockSel.inputValue();
  check(lockVal === '24', `锁定期默认 2 年（实得 ${lockVal} 个月）`);
  const startISO = await p.locator('input[type="date"]').inputValue();
  const today = new Date();
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  check(startISO === todayISO, `锁定起始日默认今天（${startISO}）`);
  const want = `${today.getFullYear() + 2}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  check(txt.includes(want), `解锁日算成两年后 ${want}`);
  check(/不会锁住任何操作/.test(txt), '说明了锁定期只是提示');
  const offSwitch = p.locator('label.fv-switch');
  check(await offSwitch.count() === 1 && /不计入家庭总资产/.test(await offSwitch.innerText()), '「不计入家庭总资产」默认打开');

  await p.locator('input[placeholder="如 招商银行储蓄卡"]').fill('家族信托-恒信一号');
  await p.locator('input[placeholder="如 50000"]').first().fill(String(AMT));
  await p.locator('input[placeholder="0"]').first().fill('4.5');
  await p.locator('select').nth(2).selectOption({ label: '配偶' });
  await p.getByRole('button', { name: '添加', exact: true }).click(); await p.waitForTimeout(1300);

  console.log('\n④ 建好之后总数没被改');
  await nav(/^仪表盘/);
  const t1 = await readTotals();
  check(t1.net === t0.net, `净资产一分没变：${t0.net.toLocaleString()} → ${t1.net.toLocaleString()}`);
  check(t1.assets === t0.assets, `总资产一分没变：${t0.assets.toLocaleString()} → ${t1.assets.toLocaleString()}`);
  txt = await body();
  check(/独立运营资产/.test(txt), '多出「独立运营资产」卡');
  check(txt.includes('1,000,000'), '卡上是信托的 1,000,000');
  check(txt.includes((t0.net + AMT).toLocaleString('en-US')), `合计 = 净资产 + 信托 = ${(t0.net + AMT).toLocaleString()}`);
  check(/预计年化收益/.test(txt) && txt.includes('45,000'), '按 4.5% 算出年化收益 45,000');
  check(/归属 配偶/.test(txt), '带上了归属人');
  check(/还锁 2 年/.test(txt), '显示还锁 2 年');
  // 侧边栏徽标数的是账户列表有几条（含信托），「总资产」下面那行数的是计入总数的有几个（不含信托）
  const counts = await p.evaluate(() => {
    const nav = [...document.querySelectorAll('.fv-nav')].find((e) => e.textContent.includes('资金账户'));
    const chip = [...document.querySelectorAll('div,span')].find((e) => /^\d+ 个账户$/.test(e.textContent.trim()));
    return { nav: (nav ? nav.textContent.match(/(\d+)\s*$/) || [] : [])[1], chip: chip ? chip.textContent.trim() : null };
  });
  check(Number(counts.nav) === 11, `侧边栏账户数含信托：${counts.nav}`);
  check(counts.chip === '10 个账户', `「总资产」那行只数计入总数的：${counts.chip}`);
  await p.screenshot({ path: OUT + 'trust-dashboard.png' });

  console.log('\n⑤ 列表 / 详情 / 利息');
  await nav(/^资金账户/);
  check(/独立运营/.test(await body()), '账户列表有「独立运营」标');
  await p.locator('.fv-row').filter({ hasText: '家族信托-恒信一号' }).first().click(); await p.waitForTimeout(900);
  txt = await body();
  check(/不计入净资产/.test(txt), '详情页说明了不计入哪些数');
  check(/年化 4\.50%/.test(txt), '详情页显示年化利率');
  check(new RegExp(`${startISO} → ${want}`).test(txt.replace(/\s+/g, ' ')), '详情页给出锁定区间');
  const barW = await p.evaluate(() => {
    const el = [...document.querySelectorAll('div')].find((d) => d.style.height === '6px' && d.firstElementChild);
    return el ? el.firstElementChild.style.width : null;
  });
  check(barW != null && parseFloat(barW) < 5, `刚开始锁，进度条几乎是空的（${barW}）`);
  await p.screenshot({ path: OUT + 'trust-detail.png' });
  await nav(/^利息预测/);
  check(/来自独立运营资产/.test(await body()), '利息预测里单独说明了独立运营那部分');

  console.log('\n⑥ 关掉开关：钱不会丢');
  await nav(/^设置$/);
  dialogs.length = 0;
  await settingsSwitch().click(); await p.waitForTimeout(900);
  check(dialogs.some((m) => /1 个账户/.test(m) && /重新计入/.test(m)), `关之前提示了后果：${(dialogs[0] || '').slice(0, 40)}…`);
  await nav(/^仪表盘/);
  const t2 = await readTotals();
  check(t2.net === t0.net + AMT, `信托重新计回净资产：${t2.net.toLocaleString()} = ${t0.net.toLocaleString()} + ${AMT.toLocaleString()}`);
  check(!/独立运营资产/.test(await body()), '「独立运营资产」卡消失');
  await nav(/^资金账户/);
  check(/家族信托-恒信一号/.test(await body()), '账户本身还在，没被删');
  check(!/独立运营/.test(await body()), '关着时列表也不再打标');

  console.log('\n  再打开');
  await nav(/^设置$/);
  await settingsSwitch().click(); await p.waitForTimeout(900);
  await nav(/^仪表盘/);
  const t3 = await readTotals();
  check(t3.net === t0.net, `又回到分开算：净资产 ${t3.net.toLocaleString()}`);
  check(/独立运营资产/.test(await body()), '卡又回来了');

  console.log('\n⑦ 手机');
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(900);
  const over = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  check(!over, '无横向溢出');
  const clipped = await p.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll('div,span,label')) {
      if (!el.children.length && el.textContent.trim() && el.scrollWidth > el.clientWidth + 2) bad.push(el.textContent.trim().slice(0, 22));
    }
    return bad;
  });
  check(clipped.length === 0, `没有文字被截断${clipped.length ? '：' + clipped.slice(0, 4).join(' | ') : ''}`);
  check(/独立运营资产/.test(await body()), '手机上卡片照常显示');
  await p.screenshot({ path: OUT + 'trust-phone.png', fullPage: true });

  console.log('\n页面错误:', errs.length ? errs.slice(0, 3) : '无');
  if (errs.length) fails++;
  await b.close();
  console.log(`\n截图：${OUT}trust-dashboard.png / trust-detail.png / trust-phone.png`);
  console.log(fails ? `✗ ${fails} 项失败` : '全部通过 ✓');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
