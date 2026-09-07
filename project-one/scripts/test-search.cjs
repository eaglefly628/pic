#!/usr/bin/env node
// 全局搜索回归：⌘K 呼出、跨实体命中、键盘导航、手机抽屉；
// 以及安全断言——密码条目只按标题/用户名/网址匹配，密码本身既不显示也不能当关键词搜到。
// 用法：node scripts/test-search.cjs [url]
const { chromium } = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');
const path = require('path');
const OUT = path.join(__dirname, '..', '.audit-phone') + path.sep;
require('fs').mkdirSync(OUT, { recursive: true });
const ok = b => b ? '✓' : '✗';

(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(process.argv[2] || 'http://localhost:8877/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(900);
  await p.locator('input[placeholder="设置主密码"]').fill('demo1234');
  await p.locator('input[placeholder="再次输入"]').fill('demo1234');
  await p.getByRole('button', { name: /创建|进入/ }).click(); await p.waitForTimeout(1800);

  // 先造一条密码，用来验证「搜得到标题、搜不到密码本身」
  await p.getByRole('button', { name: /^密码保险箱/ }).first().click(); await p.waitForTimeout(700);
  // 密码保险箱有一道二次验证：首次是设置（两个框），之后是解锁（一个框）。两种都填同一个值。
  const gatePw = p.locator('input[type="password"]:visible');
  if (await gatePw.count()) {
    for (let i = 0; i < await gatePw.count(); i++) await gatePw.nth(i).fill('box9999');
    await p.getByRole('button', { name: /解锁|创建|进入|设置/ }).first().click(); await p.waitForTimeout(1200);
  }
  const addPw = p.getByRole('button', { name: /新增密码/ });
  console.log(`  [准备] 二次验证已过、看到「新增密码」: ${ok(await addPw.count())}`);
  if (await addPw.count()) {
    await addPw.first().click(); await p.waitForTimeout(500);
    await p.locator('input[placeholder="如 招商银行网银"]').fill('淘宝账号');
    const pwField = p.locator('input[type="password"]:visible').last();
    if (await pwField.count()) await pwField.fill('SECRET-hunter2-XYZ');
    await p.getByRole('button', { name: '保存', exact: true }).click(); await p.waitForTimeout(800);
    const listed = (await p.locator('body').innerText()).includes('淘宝账号');
    console.log(`  [准备] 密码条目已建: ${ok(listed)}`);
  }
  await p.getByRole('button', { name: /^仪表盘/ }).first().click(); await p.waitForTimeout(500);

  console.log('════ 桌面 ════');
  await p.keyboard.press('Meta+k'); await p.waitForTimeout(400);
  const box = p.locator('input[placeholder^="搜账户"]');
  console.log(`  ⌘K 打开面板: ${ok(await box.count() && await box.isVisible())}`);
  console.log(`  输入框自动聚焦: ${ok(await box.evaluate(e => document.activeElement === e))}`);

  await box.fill('招商'); await p.waitForTimeout(300);
  const hits = p.locator('button').filter({ hasText: /账户|收入|开销|密码|信息/ }).filter({ has: p.locator('span') });
  const titles = await p.evaluate(() => [...document.querySelectorAll('button')].filter(b => b.textContent.includes('账户') && b.querySelector('span')).map(b => b.textContent.trim().slice(0, 30)));
  console.log(`  搜「招商」命中 ${titles.length} 条: ${titles.slice(0, 3).join(' | ')}`);
  console.log(`  ${ok(titles.length >= 2)} 至少命中招商银行储蓄卡 + 招商证券`);
  await p.screenshot({ path: OUT + 'search-desktop.png' });

  await p.keyboard.press('ArrowDown'); await p.waitForTimeout(150);
  await p.keyboard.press('Enter'); await p.waitForTimeout(900);
  const onDetail = await p.getByRole('button', { name: /^资金账户$/ }).count();   // 详情页顶栏的返回按钮
  const closed = !(await box.count());
  console.log(`  ↓ + Enter 后：面板关闭 ${ok(closed)}，跳到了账户详情 ${ok(onDetail > 0)}`);

  // 密码搜索不泄露
  await p.keyboard.press('Meta+k'); await p.waitForTimeout(300);
  await p.locator('input[placeholder^="搜账户"]').fill('淘宝'); await p.waitForTimeout(300);
  let body = await p.locator('body').innerText();
  console.log(`  搜「淘宝」命中密码条目: ${ok(body.includes('淘宝账号'))}`);
  console.log(`  面板里没有出现密码明文: ${ok(!body.includes('hunter2'))}`);
  await p.locator('input[placeholder^="搜账户"]').fill('hunter2'); await p.waitForTimeout(300);
  body = await p.locator('body').innerText();
  console.log(`  用密码本身当关键词搜不到任何东西: ${ok(body.includes('没有匹配'))}`);

  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  console.log(`  Esc 关闭: ${ok(!(await p.locator('input[placeholder^="搜账户"]').count()))}`);

  console.log('\n════ 手机 ════');
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(600);
  const sbtn = p.getByTitle('搜索');
  console.log(`  顶栏有搜索图标钮: ${ok(await sbtn.count())}`);
  await sbtn.click(); await p.waitForTimeout(500);
  const pb = p.locator('input[placeholder^="搜账户"]');
  console.log(`  点开后是底部抽屉: ${ok(await pb.isVisible())}`);
  await pb.fill('房'); await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + 'search-phone.png' });
  const over = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  console.log(`  横向溢出: ${over ? '有 ✗' : '无 ✓'}`);
  console.log('\nerrors:', errs.length ? errs.slice(0, 3) : 'none');
  await b.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
