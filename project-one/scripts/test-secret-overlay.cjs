#!/usr/bin/env node
// 「独立管理」里的一年资产走势叠加卡的回归测试：
//   ① 独立管理这边还没数据时，给的是说明而不是空图
//   ② 记了账之后画出两条线（独立管理 + 家庭理财），统计数字对得上
//   ③ 「合计家庭总资产」开关：打开多一条线和一个数，合计 = 两本账相加；关掉就消失
//   ④ 开关状态记得住（退出重进还是上次那样）
//   ⑤ 指数模式：各自从 100 起算
//   ⑥ 图铺满卡片宽度（viewBox 等比缩放居中会白白浪费近一半宽度）
//   ⑦ 鼠标和高亮的点对齐（等比缩放居中还会让鼠标换算错位，越靠边越偏）
//   ⑧ 指针移动能读出某个月各条线的值
//   ⑨ 手机排版不溢出
// 用法：node scripts/test-secret-overlay.cjs [url]
const { chromium } = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const URL_ = process.argv[2] || 'http://localhost:8877/index.html';
const OUT = path.join(__dirname, '..', '.audit-phone') + path.sep;
fs.mkdirSync(OUT, { recursive: true });
const PW = 'demo1234', SPW = 'secret9999';
let fails = 0;
const check = (b, msg) => { console.log(`  ${b ? '✓' : '✗'} ${msg}`); if (!b) fails++; };
const yuan = (s) => Number(String(s).replace(/[^\d.-]/g, ''));

(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
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

  // 隐藏入口：右下角 v0.1.0 连点 5 下（1.5 秒内）
  const enterSecret = async () => {
    const tap = p.locator('text=v0.1.0').last();
    for (let i = 0; i < 5; i++) { await tap.click({ force: true }); await p.waitForTimeout(90); }
    await p.waitForTimeout(700);
    const set = S().locator('input[placeholder="设置独立管理密码"]');
    if (await set.count()) {
      await set.fill(SPW); await S().locator('input[placeholder="再次输入"]').fill(SPW);
      await S().getByRole('button', { name: /创建并进入/ }).click();
    } else {
      await S().locator('input[placeholder="独立管理密码"]').fill(SPW);
      await S().getByRole('button', { name: /^解锁/ }).click();
    }
    await p.waitForTimeout(1800);
  };
  const S = () => p.locator('[data-screen="secret"]');   // 这一屏是浮层，底下主界面有同名按钮，选择器必须限定在这层里
  const card = () => p.locator('[data-card="secret-overlay"]');
  const cardText = async () => await card().innerText();
  const sw = () => card().locator('label.fv-switch');
  // 开关自己的标签就叫「合计家庭总资产」，查那条线在不在得把开关那行排除掉
  const hasTotalLine = async () => (await card().innerText()).replace(/合计家庭总资产/g, '').includes('家庭总资产');
  const legendVal = async (name) => {
    // 统计块里一条线的小块：第一个子元素是线名，第二个是金额
    return await p.evaluate((n) => {
      const root = document.querySelector('[data-card="secret-overlay"]');
      for (const el of root.querySelectorAll('div')) {
        if (el.children.length >= 2 && el.children[0].textContent.trim() === n) return el.children[1].textContent.trim();
      }
      return null;
    }, name);
  };

  await enterSecret();
  console.log('① 独立管理还没数据时');
  let t = await cardText();
  check(/一年资产走势/.test(t), '仪表盘下面有「一年资产走势」卡');
  check(/独立管理这边还没有快照/.test(t), '给的是「先记一笔」的说明，不是一张空图');
  check(await sw().count() > 0, '「合计家庭总资产」开关在');

  console.log('\n② 记几笔之后');
  await S().getByRole('button', { name: '账户', exact: true }).click(); await p.waitForTimeout(600);
  await S().getByRole('button', { name: /新增账户/ }).first().click(); await p.waitForTimeout(500);
  await S().locator('input[placeholder="如 招商银行储蓄卡"]').fill('私房钱-现金');
  await S().locator('input[placeholder="如 50000"]').first().fill('80000');
  await S().getByRole('button', { name: '添加', exact: true }).click(); await p.waitForTimeout(1200);
  await S().locator('.fv-row').filter({ hasText: '私房钱-现金' }).first().click(); await p.waitForTimeout(900);
  // 往前补两期，凑出一条有起伏的线
  const today = new Date();
  const back = (n) => { const d = new Date(today); d.setMonth(d.getMonth() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  for (const [months, amt] of [[6, '50000'], [3, '62000']]) {
    await S().getByRole('button', { name: /新增快照/ }).first().click(); await p.waitForTimeout(600);
    await S().locator('input[type="date"]').fill(back(months)); await p.waitForTimeout(400);
    await S().locator('input[inputmode="decimal"]').first().fill(amt);
    await S().getByRole('button', { name: /^添加$|^覆盖这一期$/ }).click(); await p.waitForTimeout(1100);
  }
  // 详情页里顶栏 tab 是收起来的，先用账户名那个返回键回到列表，tab 才出来
  await S().getByRole('button', { name: /私房钱-现金/ }).first().click(); await p.waitForTimeout(700);
  await S().getByRole('button', { name: '仪表盘', exact: true }).click(); await p.waitForTimeout(900);
  await card().scrollIntoViewIfNeeded().catch(() => { });
  await p.evaluate(() => { for (const el of document.querySelectorAll('div')) { if (el.scrollHeight > el.clientHeight + 40 && getComputedStyle(el).overflowY === 'auto') el.scrollTop = el.scrollHeight; } });
  await p.waitForTimeout(700);
  t = await cardText();
  check(!/还没有快照/.test(t), '不再是空状态');
  const vSecret = yuan(await legendVal('独立管理'));
  const vMain = yuan(await legendVal('家庭理财'));
  check(vSecret === 80000, `独立管理现值 = 最新那期 80,000（实得 ${vSecret}）`);
  check(vMain > 0, `家庭理财现值取到了（${vMain.toLocaleString()}）`);
  check(/近一年/.test(t), '每条线都给了近一年的变化');
  await p.screenshot({ path: OUT + 'secret-overlay.png' });

  console.log('\n③ 合计开关');
  const vTotal = yuan(await legendVal('家庭总资产'));
  check(vTotal === vSecret + vMain, `合计 = 独立管理 + 家庭理财（${vSecret} + ${vMain} = ${vTotal}）`);
  const paths = () => p.evaluate(() => [...document.querySelectorAll('[data-card="secret-overlay"] svg path')].filter((e) => (e.getAttribute('d') || '').includes('L')).length);
  const on = await paths();
  check(on === 3, `打开时图上三条线（实得 ${on}）`);
  await sw().click(); await p.waitForTimeout(600);
  check(!(await hasTotalLine()), '关掉之后「家庭总资产」这一项消失');
  const off = await paths();
  check(off === on - 1, `图上少了一条线（${on} → ${off}）`);
  await sw().click(); await p.waitForTimeout(600);
  check(await hasTotalLine(), '再打开又回来了');

  console.log('\n④ 开关状态记得住');
  await sw().click(); await p.waitForTimeout(400);          // 关掉
  await S().getByRole('button', { name: /^退出$/ }).click(); await p.waitForTimeout(800);
  await enterSecret();
  await p.evaluate(() => { for (const el of document.querySelectorAll('div')) { if (el.scrollHeight > el.clientHeight + 40 && getComputedStyle(el).overflowY === 'auto') el.scrollTop = el.scrollHeight; } });
  await p.waitForTimeout(700);
  check(!(await hasTotalLine()), '重进之后还是关着的');
  await sw().click(); await p.waitForTimeout(500);
  check(await hasTotalLine(), '打开后恢复三条线');

  console.log('\n⑤ 指数模式');
  // 私房钱 8 万 vs 家里 262 万，量级差 6 倍以上 → 一进来就该默认在指数，否则小的那条贴底看不出动静
  check(/各自以最早那个月为 100/.test(await cardText()), '量级悬殊时默认就是指数模式');
  await S().getByRole('button', { name: '指数', exact: true }).click(); await p.waitForTimeout(700);
  t = await cardText();
  check(/各自以最早那个月为 100/.test(t), '给了指数的解释');
  const axis = await p.evaluate(() => [...document.querySelectorAll('[data-card="secret-overlay"] svg text[text-anchor="end"]')].map((e) => e.textContent));
  check(axis.length === 4 && axis.every((a) => !/[¥万]/.test(a)), `纵轴换成了纯数字：${axis.join(' ')}`);
  await S().getByRole('button', { name: '金额', exact: true }).click(); await p.waitForTimeout(600);
  const axis2 = await p.evaluate(() => [...document.querySelectorAll('[data-card="secret-overlay"] svg text[text-anchor="end"]')].map((e) => e.textContent));
  check(axis2.length === 4 && axis2.every((a) => /[¥万]/.test(a)), `切回金额纵轴带钱号：${axis2.join(' ')}`);
  check(!axis2.some((a) => a.startsWith('−')), `全是正数时纵轴不出负刻度：${axis2.join(' ')}`);
  check(/量级差得多/.test(await cardText()), '金额模式下提示可以切指数看涨跌幅');

  console.log('\n⑥ 图铺满宽度、不是等比缩放后居中');
  const box0 = await card().locator('svg[viewBox]').boundingBox();
  const fit = await p.evaluate(() => {
    const s = document.querySelector('[data-card="secret-overlay"] svg[viewBox]');
    const r = s.getBoundingClientRect(), vb = s.getAttribute('viewBox').split(/\s+/).map(Number);
    const scale = Math.min(r.width / vb[2], r.height / vb[3]);
    return { w: Math.round(r.width), vbw: vb[2], scale: +scale.toFixed(3), letterbox: Math.round((r.width - vb[2] * scale) / 2) };
  });
  check(fit.scale === 1, `缩放比是 1:1（viewBox ${fit.vbw} × 元素 ${fit.w}px，scale=${fit.scale}）`);
  check(fit.letterbox === 0, `左右没有居中留白（实得 ${fit.letterbox}px）`);

  console.log('\n⑦ 鼠标和高亮点对齐');
  // 用户报的问题：鼠标和它对应的点错位，越靠边偏得越多。
  // 判据：高亮的竖线必须是离鼠标最近的那个月，也就是和鼠标的距离不超过半格。
  const guideX = async () => await p.evaluate(() => {
    const g = document.querySelector('[data-card="secret-overlay"] svg line[data-role="guide"]');
    if (!g) return null;
    const b = g.getBoundingClientRect();
    return b.left + b.width / 2;
  });
  const gap = (box0.width - 52 - 10) / 11;                    // 12 个月，11 段
  let worst = 0;
  for (const f of [0.08, 0.25, 0.5, 0.75, 0.95]) {
    const mx = box0.x + 52 + (box0.width - 52 - 10) * f;      // 只在数据区里取点
    await p.mouse.move(mx, box0.y + box0.height / 2); await p.waitForTimeout(220);
    const gx = await guideX();
    const off = gx == null ? Infinity : Math.abs(gx - mx);
    worst = Math.max(worst, off);
    check(off <= gap / 2 + 2, `鼠标在 ${Math.round(f * 100)}% 处：竖线偏 ${off === Infinity ? '没画出来' : off.toFixed(1) + 'px'}（半格 ${(gap / 2).toFixed(1)}px）`);
  }
  check(worst <= gap / 2 + 2, `最大偏移 ${worst.toFixed(1)}px，都在半格内`);
  // 高亮圆点也应该落在竖线上
  const dotOff = await p.evaluate(() => {
    const g = document.querySelector('[data-card="secret-overlay"] svg line[data-role="guide"]');
    const d = document.querySelector('[data-card="secret-overlay"] svg circle[data-role="focus-dot"]');
    if (!g || !d) return null;
    const gb = g.getBoundingClientRect(), db = d.getBoundingClientRect();
    return Math.abs((gb.left + gb.width / 2) - (db.left + db.width / 2));
  });
  check(dotOff != null && dotOff <= 1.5, `高亮圆点就在竖线上（差 ${dotOff == null ? '取不到' : dotOff.toFixed(2) + 'px'}）`);

  console.log('\n⑧ 指针读数');
  const svg = card().locator('svg[viewBox]');   // 图例里那几个小色块也是 svg，取带 viewBox 的主图
  const box = await svg.boundingBox();
  const readout = async () => (await p.evaluate(() => {
    const root = document.querySelector('[data-card="secret-overlay"]');
    const el = [...root.querySelectorAll('div')].find((d) => d.children.length && /^\d{2}\/\d{2}/.test(d.textContent.trim()));
    return el ? el.textContent.trim().replace(/\s+/g, ' ') : '';
  }));
  await p.mouse.move(box.x + box.width * 0.85, box.y + box.height / 2); await p.waitForTimeout(300);
  const rRight = await readout();
  await p.mouse.move(box.x + box.width * 0.1, box.y + box.height / 2); await p.waitForTimeout(300);
  const rLeft = await readout();
  check(!!rRight && !!rLeft, `读数行有内容：右「${rRight}」左「${rLeft}」`);
  check(rRight !== rLeft, '移到不同位置读到的是不同月份');
  check(/独立管理/.test(rRight) && /家庭理财/.test(rRight), '读数行按线名列出各条线的值');

  console.log('\n⑨ 手机');
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(800);
  await p.evaluate(() => { for (const el of document.querySelectorAll('div')) { if (el.scrollHeight > el.clientHeight + 40 && getComputedStyle(el).overflowY === 'auto') el.scrollTop = el.scrollHeight; } });
  await p.waitForTimeout(700);
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
  check(/一年资产走势/.test(await cardText()), '手机上卡片照常显示');
  await p.screenshot({ path: OUT + 'secret-overlay-phone.png', fullPage: true });

  console.log('\n页面错误:', errs.length ? errs.slice(0, 3) : '无');
  if (errs.length) fails++;
  await b.close();
  console.log(`\n截图：${OUT}secret-overlay.png / secret-overlay-phone.png`);
  console.log(fails ? `✗ ${fails} 项失败` : '全部通过 ✓');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
