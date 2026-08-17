#!/usr/bin/env node
// 手机版布局审计：逐页查横向溢出 / 越出视口 / 文字被裁 / 点击目标过小。
// 用法：先 npm run build 并把 dist 起在某个端口，然后
//   node scripts/audit-phone.cjs [url]     默认 http://localhost:8877/index.html
const { chromium } = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');
const fs = require('fs'), path = require('path');
const URL_ = process.argv[2] || 'http://localhost:8877/index.html';
const OUT = path.join(__dirname, '..', '.audit-phone');
fs.mkdirSync(OUT, { recursive: true });

const AUDIT = () => {
  const VW = document.documentElement.clientWidth;
  const out = { overflow: [], outside: [], clipped: [], tiny: [] };
  const label = (el) => {
    const t = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 26);
    const cls = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).join('.') : '';
    return `${el.tagName.toLowerCase()}${cls}${t ? ` «${t}»` : ''}`;
  };
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || !el.getClientRects().length) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if (el.scrollWidth > el.clientWidth + 2 && cs.overflowX !== 'auto' && cs.overflowX !== 'scroll')
      out.overflow.push({ el: label(el), over: el.scrollWidth - el.clientWidth });
    // 祖先里有横滚容器的跳过——那是设计成能滑的
    let inScroller = false;
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const acs = getComputedStyle(a);
      if (acs.overflowX === 'auto' || acs.overflowX === 'scroll') { inScroller = true; break; }
    }
    if (!inScroller && (r.right > VW + 1 || r.left < -1)) out.outside.push({ el: label(el), right: Math.round(r.right), vw: VW });
    if (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1 && !el.children.length)
      out.clipped.push({ el: label(el) });
    if ((el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') && el.children.length <= 2 && r.height < 34)
      out.tiny.push({ el: label(el), h: Math.round(r.height) });
  }
  const uniq = a => [...new Map(a.map(x => [JSON.stringify(x), x])).values()];
  return { overflow: uniq(out.overflow), outside: uniq(out.outside), clipped: uniq(out.clipped), tiny: uniq(out.tiny) };
};

(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const report = [];
  const shot = async (name) => {
    await p.waitForTimeout(650);
    await p.screenshot({ path: path.join(OUT, name + '.png'), fullPage: true });
    const a = await p.evaluate(AUDIT);
    const n = a.overflow.length + a.outside.length + a.clipped.length;
    report.push({ name, ...a });
    console.log(`── ${name}  ${n ? '⚠ ' + n + ' 处' : '✓ 干净'}`);
    for (const x of a.outside.slice(0, 5)) console.log(`   越出视口 right=${x.right}/${x.vw}  ${x.el}`);
    for (const x of a.overflow.slice(0, 5)) console.log(`   横向溢出 +${x.over}px  ${x.el}`);
    for (const x of a.clipped.slice(0, 5)) console.log(`   文字被裁  ${x.el}`);
  };
  const tab = async (n) => { await p.getByRole('navigation').getByRole('button', { name: n, exact: true }).click(); await p.waitForTimeout(500); };

  await p.goto(URL_, { waitUntil: 'load' });
  await p.waitForTimeout(1000);
  await shot('00-解锁');
  await p.locator('input[placeholder="设置主密码"]').fill('demo1234');
  await p.locator('input[placeholder="再次输入"]').fill('demo1234');
  await p.getByRole('button', { name: /创建|进入/ }).click();
  await p.waitForTimeout(1600);

  await shot('01-仪表盘');
  await tab('账户'); await shot('02-资金账户');
  await p.locator('.fv-row').first().click(); await shot('03-账户详情');
  await tab('收支'); await shot('04-收入情况');
  await tab('保险箱'); await shot('05-密码保险箱');
  await tab('更多'); await shot('06-更多');
  for (const [label, file] of [['利息预测','07-利息预测'], ['预算与预测','08-预算与预测'], ['财经行情','09-财经行情'],
                               ['导入 / 导出','10-导入导出'], ['个人信息','11-个人信息'], ['设置','12-设置']]) {
    await p.getByRole('button', { name: label, exact: true }).click();
    await shot(file);
    await tab('更多');
  }
  await tab('仪表盘');
  await p.getByTitle('切换外观').click(); await shot('13-仪表盘-深色');

  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  const total = report.reduce((a, r) => a + r.overflow.length + r.outside.length + r.clipped.length, 0);
  console.log(`\n════ 合计 ${total} 处问题（截图与明细在 ${OUT}）════`);
  console.log('pageerrors:', errs.length ? errs.slice(0, 3) : 'none');
  await b.close();
  process.exit(total ? 1 : 0);
})().catch(e => { console.error('FAILED', e.message); process.exit(2); });
