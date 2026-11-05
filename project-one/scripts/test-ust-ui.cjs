#!/usr/bin/env node
// 美债这一列的渲染测试。本机跑不通财政部数据源，所以拦住 /api/ust 喂形状一样的假数据，
// 验证：正常曲线 / 倒挂 / 只有现价没走势 / 完全取不到 四种情形，以及桌面和手机两种排版。
// 用法：node scripts/test-ust-ui.cjs [url]
const { chromium } = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const URL_ = process.argv[2] || 'http://localhost:8877/index.html';
const OUT = path.join(__dirname, '..', '.audit-phone') + path.sep;
fs.mkdirSync(OUT, { recursive: true });
const PW = 'demo1234';
let fails = 0;
const check = (b, msg) => { console.log(`  ${b ? '✓' : '✗'} ${msg}`); if (!b) fails++; };

const TENORS = [['1M', 1], ['3M', 3], ['6M', 6], ['1Y', 12], ['2Y', 24], ['3Y', 36], ['5Y', 60], ['7Y', 84], ['10Y', 120], ['20Y', 240], ['30Y', 360]];
const DAY = 86400000;

// 造一份形状跟 run.py 的 fetch_ust 一致的假数据。inverted=true 时把短端抬到长端之上。
function mock({ inverted = false, days = 130 } = {}) {
  const base = inverted
    ? { '1M': 5.35, '3M': 5.30, '6M': 5.10, '1Y': 4.80, '2Y': 4.55, '3Y': 4.40, '5Y': 4.28, '7Y': 4.26, '10Y': 4.25, '20Y': 4.55, '30Y': 4.45 }
    : { '1M': 3.95, '3M': 4.00, '6M': 4.05, '1Y': 4.08, '2Y': 4.12, '3Y': 4.18, '5Y': 4.30, '7Y': 4.42, '10Y': 4.55, '20Y': 4.85, '30Y': 4.92 };
  const end = Date.now() - DAY;
  const rows = [];
  for (let i = days - 1; i >= 0; i--) {
    const t = end - i * DAY;
    const wob = Math.sin(i / 9) * 0.13 + (i / days) * 0.22;   // 有点起伏，图才看得出是条曲线
    const y = {};
    for (const [k] of TENORS) y[k] = +(base[k] + wob).toFixed(2);
    rows.push({ date: new Date(t).toISOString().slice(0, 10), t, y });
  }
  const keep = ['3M', '2Y', '5Y', '10Y', '30Y'];
  const history = {};
  for (const k of keep) history[k] = rows.map((r) => ({ t: r.t, usd: r.y[k] }));
  const last = rows[rows.length - 1], prev = rows[rows.length - 2];
  const monthAgo = rows[Math.max(0, rows.length - 22)];
  return {
    ok: true, src: 'treasury', asOf: Date.now(),
    tenors: TENORS.map(([key, months]) => ({ key, months })),
    latest: { date: last.date, t: last.t, y: last.y },
    prev: { date: prev.date, y: prev.y },
    history,
    curves: [last, monthAgo, rows[0]].map((r) => ({ date: r.date, t: r.t, y: r.y })),
  };
}

(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2 });
  let payload = mock();
  await ctx.route('**/api/ust*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) }));
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));

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

  const gotoUst = async () => {
    await p.getByRole('button', { name: /^财经行情/ }).first().click(); await p.waitForTimeout(700);
    await p.getByRole('button', { name: '美债', exact: true }).first().click(); await p.waitForTimeout(1200);
  };
  const txt = () => p.locator('body').innerText();
  const overflow = () => p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);

  console.log('① 正常（不倒挂）');
  await gotoUst();
  let t = await txt();
  check(/美债收益率/.test(t), '进到了「美债」这一列');
  check(t.includes('4.55%'), '10 年期收益率显示为 4.55%');
  check(/10 年期/.test(t), '大号数字标的是 10 年期');
  check(/\+43bp/.test(t), `10年−2年 利差按基点显示（4.55−4.12=43bp）：${(/[+−-]\d+bp/.exec(t) || [])[0]}`);
  check(t.includes('正常') && !t.includes('倒挂：'), '标为「正常」，不出倒挂警告');
  check(/各期限的收益率连起来/.test(t), '有收益率曲线卡片');
  const legend = (t.match(/\d{4}-\d{2}-\d{2}/g) || []).length;
  check(legend >= 3, `曲线图例列出 3 个对比日期（找到 ${legend} 个日期）`);
  check(await p.locator('svg path[stroke]').count() >= 4, '走势线 + 三条曲线都画出来了');
  check(!(await overflow()), '桌面无横向溢出');
  // viewBox 写死宽度时会等比缩放后居中，左右白白空掉一截；这里要求图铺满卡片
  const fit = await p.evaluate(() => [...document.querySelectorAll('svg[viewBox]')]
    .filter((s) => s.getBoundingClientRect().width > 300)
    .map((s) => { const r = s.getBoundingClientRect(), vb = s.getAttribute('viewBox').split(/\s+/).map(Number);
      const k = Math.min(r.width / vb[2], r.height / vb[3]);
      return { w: Math.round(r.width), vbw: vb[2], letterbox: Math.round((r.width - vb[2] * k) / 2) }; }));
  check(fit.length > 0 && fit.every((f) => f.letterbox === 0), `图都铺满宽度、没有居中留白：${fit.map((f) => `${f.vbw}/${f.w}px留白${f.letterbox}`).join('  ')}`);
  await p.screenshot({ path: OUT + 'ust-desktop.png', fullPage: true });
  // 曲线卡在内层滚动容器里，scrollIntoView 推不动，直接找那个容器把它滚到底
  await p.evaluate(() => {
    for (const el of document.querySelectorAll('div')) {
      if (el.scrollHeight > el.clientHeight + 40 && getComputedStyle(el).overflowY !== 'visible') { el.scrollTop = el.scrollHeight; break; }
    }
  });
  await p.waitForTimeout(800);
  await p.screenshot({ path: OUT + 'ust-curve.png' });
  // 最新那条曲线必须是实线（其余虚线/点线），不然三条一个样
  const dashes = await p.evaluate(() => [...document.querySelectorAll('svg path[stroke-dasharray], svg path[stroke]')]
    .filter((el) => (el.getAttribute('d') || '').split('L').length > 5).map((el) => el.getAttribute('stroke-dasharray') || 'solid'));
  check(dashes.filter((d) => d === 'solid').length >= 2, `最新曲线和走势线是实线，历史曲线是虚线：${dashes.join(' / ')}`);
  check(new Set(dashes).size >= 3, '三条曲线线型互不相同（不靠颜色区分，色觉障碍也分得出）');

  console.log('\n② 切换档位和区间');
  await p.getByRole('button', { name: '10年–2年', exact: true }).click(); await p.waitForTimeout(700);
  t = await txt();
  check(/10年–2年走势/.test(t), '标题跟着切到「10年–2年走势」');
  check(/低于 0 就是倒挂/.test(t), '利差图下面有解释');
  await p.getByRole('button', { name: '30年', exact: true }).click(); await p.waitForTimeout(700);
  check(/30年走势/.test(await txt()), '切到 30 年');
  await p.getByRole('button', { name: '近1年', exact: true }).click(); await p.waitForTimeout(900);
  check(/30年走势/.test(await txt()), '换区间后仍停在所选档位');

  console.log('\n③ 倒挂');
  payload = mock({ inverted: true });
  await p.getByRole('button', { name: /刷新/ }).click(); await p.waitForTimeout(1200);
  t = await txt();
  check(t.includes('倒挂'), '标出「倒挂」');
  check(/长短端倒挂：10 年期收益率低于 2 年期/.test(t), '给了一句人话解释');
  check(/不是买卖建议/.test(t), '明确说了不构成建议');
  check(/[−-]30bp/.test(t), `利差是负的（4.25−4.55=−30bp）：${(/[+−-]\d+bp/.exec(t) || [])[0]}`);
  await p.screenshot({ path: OUT + 'ust-inverted.png', fullPage: true });

  console.log('\n④ 只有现价、没有走势（降级到 Yahoo）');
  payload = { ok: true, src: 'yahoo', asOf: Date.now(), partial: true, note: '只取到当前收益率，没有历史走势（财政部数据源暂时取不到）', tenors: [{ key: '3M', months: 3 }, { key: '5Y', months: 60 }, { key: '10Y', months: 120 }, { key: '30Y', months: 360 }], latest: { date: null, y: { '3M': 4.2, '5Y': 4.0, '10Y': 4.3, '30Y': 4.8 } }, prev: null, history: {}, curves: [] };
  await p.getByRole('button', { name: /刷新/ }).click(); await p.waitForTimeout(1200);
  t = await txt();
  check(t.includes('4.30%'), '现价照常显示');
  check(t.includes('没有历史走势'), '明确告诉用户走势缺了，而不是空白一片');
  check(t.includes('暂无走势数据'), '走势图位置给了占位说明');
  check(!/各期限的收益率连起来/.test(t), '没有曲线数据时整张曲线卡片不出现（不留空壳）');
  check(!(await overflow()), '降级状态也没有横向溢出');

  console.log('\n⑤ 完全取不到');
  payload = { ok: false, error: '美债收益率获取失败（需联网）' };
  await p.getByRole('button', { name: /刷新/ }).click(); await p.waitForTimeout(1200);
  t = await txt();
  check(/美债收益率获取失败/.test(t), '把错误原因显示出来');
  check(/点右上「刷新」/.test(t), '告诉用户怎么重试');

  console.log('\n⑥ 手机排版');
  payload = mock();
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(700);
  await p.getByRole('button', { name: /刷新/ }).click(); await p.waitForTimeout(1400);
  check(!(await overflow()), '手机无横向溢出');
  const clipped = await p.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll('div,span,button')) {
      if (!el.children.length && el.textContent.trim() && el.scrollWidth > el.clientWidth + 2) bad.push(el.textContent.trim().slice(0, 24));
    }
    return bad;
  });
  check(clipped.length === 0, `没有文字被截断${clipped.length ? '：' + clipped.slice(0, 4).join(' | ') : ''}`);
  check((await txt()).includes('4.55%'), '手机上数字照常显示');
  await p.screenshot({ path: OUT + 'ust-phone.png', fullPage: true });

  console.log('\n页面错误:', errs.length ? errs.slice(0, 3) : '无');
  if (errs.length) fails++;
  await b.close();
  console.log(`\n截图：${OUT}ust-desktop.png / ust-inverted.png / ust-phone.png`);
  console.log(fails ? `✗ ${fails} 项失败` : '全部通过 ✓');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
