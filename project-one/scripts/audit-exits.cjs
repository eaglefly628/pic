#!/usr/bin/env node
// 出口审计：逐个进入每一个「点得进去的地方」，断言存在一个真能用的出口
// （存在 + 可见 + 完整在视口内 + 没被别的元素盖住）。
// 用法：node scripts/audit-exits.cjs [url]
const { chromium } = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');
const URL_ = process.argv[2] || 'http://localhost:8877/index.html';

const results = [];
function rec(where, what, ok, note) {
  results.push({ where, what, ok, note });
  console.log(`  ${ok ? '✓' : '✗'} ${where.padEnd(24)} ${what}${note ? '  — ' + note : ''}`);
}

async function usable(p, locator) {
  if (!(await locator.count())) return { ok: false, note: '按钮不存在' };
  const el = locator.first();
  if (!(await el.isVisible())) return { ok: false, note: '不可见' };
  const box = await el.boundingBox();
  if (!box) return { ok: false, note: '没有布局盒' };
  const vp = p.viewportSize();
  if (box.x < 0 || box.y < 0 || box.x + box.width > vp.width + 1 || box.y + box.height > vp.height + 1)
    return { ok: false, note: `跑出视口 x=${Math.round(box.x)} y=${Math.round(box.y)}` };
  const hit = await el.evaluate((n) => {
    const r = n.getBoundingClientRect();
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return !!top && (n === top || n.contains(top) || top.contains(n));
  });
  return hit ? { ok: true, note: `${Math.round(box.width)}×${Math.round(box.height)}` }
             : { ok: false, note: '被别的元素盖住' };
}

async function run(width, height, label) {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width, height } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const phone = width < 768;

  await p.goto(URL_, { waitUntil: 'load' });
  await p.waitForTimeout(900);
  await p.locator('input[placeholder="设置主密码"]').fill('demo1234');
  await p.locator('input[placeholder="再次输入"]').fill('demo1234');
  await p.getByRole('button', { name: /创建|进入/ }).click();
  await p.waitForTimeout(1500);
  console.log(`\n════ ${label}（${width}×${height}）════`);

  // 侧栏按钮的可及名带 badge 数字（如「资金账户 10」），所以不能用 exact
  const nav = (n) => phone
    ? p.getByRole('navigation').getByRole('button', { name: n, exact: true })
    : p.getByRole('button', { name: new RegExp('^' + n.replace(/ /g, '\\s*') + '(\\s+\\d+)?$') }).first();
  const goTab = async (n) => { await nav(n).click(); await p.waitForTimeout(450); };
  let r;

  await goTab(phone ? '账户' : '资金账户');
  await p.locator('.fv-row').first().click(); await p.waitForTimeout(600);
  r = await usable(p, p.getByRole('button', { name: /^资金账户$/ })); rec('账户详情', '返回「资金账户」', r.ok, r.note);

  // 各类弹窗/抽屉都要有「取消」
  for (const [open, name, tab] of [[/新增快照/, '新增快照', null],
                                   [/新增账户/, '新增账户', phone ? '账户' : '资金账户'],
                                   [/新增收入/, '新增收入', phone ? '收支' : '收入情况'],
                                   [/新增密码/, '新增密码', phone ? '保险箱' : '密码保险箱']]) {
    if (tab) await goTab(tab);
    const btn = p.getByRole('button', { name: open });
    if (!(await btn.count())) continue;
    await btn.first().click(); await p.waitForTimeout(500);
    r = await usable(p, p.getByRole('button', { name: '取消', exact: true }));
    rec(`弹窗·${name}`, '「取消」', r.ok, r.note);
    await p.getByRole('button', { name: '取消', exact: true }).click(); await p.waitForTimeout(400);
  }

  if (phone) {
    for (const t of ['利息预测', '预算与预测', '财经行情', '导入 / 导出', '个人信息', '设置']) {
      await goTab('更多');
      await p.getByRole('button', { name: t, exact: true }).click(); await p.waitForTimeout(500);
      r = await usable(p, p.getByRole('button', { name: /^更多$/ }).first());
      rec(`更多 → ${t}`, '返回「更多」', r.ok, r.note);
    }
  }

  // 隐藏区（连点右下角版本号 5 次）
  await goTab('仪表盘');
  const ver = p.getByText('v0.1.0', { exact: true });
  for (let i = 0; i < 5; i++) { await ver.click(); await p.waitForTimeout(90); }
  await p.waitForTimeout(700);
  r = await usable(p, p.getByRole('button', { name: '退出', exact: true })); rec('独立管理·设密码', '「退出」', r.ok, r.note);
  await p.locator('input[placeholder="设置独立管理密码"]').fill('secret123');
  await p.locator('input[placeholder="再次输入"]').fill('secret123');
  await p.getByRole('button', { name: /创建|进入/ }).click(); await p.waitForTimeout(1200);
  for (const t of [null, '账户', '利息', '退休预测']) {
    if (t) { const tb = p.getByRole('button', { name: t, exact: true }); if (!(await tb.count())) continue; await tb.last().click(); await p.waitForTimeout(500); }
    r = await usable(p, p.getByRole('button', { name: '退出', exact: true }));
    rec(`独立管理${t ? '·' + t : '·已解锁'}`, '「退出」', r.ok, r.note);
  }
  await p.getByRole('button', { name: '改密码', exact: true }).click(); await p.waitForTimeout(500);
  r = await usable(p, p.getByRole('button', { name: '取消', exact: true })); rec('独立管理·改密码弹窗', '「取消」', r.ok, r.note);

  if (errs.length) console.log('  pageerrors:', errs.slice(0, 3));
  await b.close();
}

(async () => {
  await run(390, 844, '手机');
  await run(900, 700, '平板');
  await run(1440, 950, '桌面');
  const bad = results.filter(x => !x.ok);
  console.log(`\n════ 出口检查：${results.length} 项，${bad.length ? bad.length + ' 项不合格 ✗' : '全部合格 ✓'} ════`);
  for (const x of bad) console.log(`   ✗ ${x.where} → ${x.what}（${x.note}）`);
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error('FAILED', e.message); process.exit(2); });
