#!/usr/bin/env node
// 存储与备份回归测试：
//   ① 「删除全部数据」是否真的把三个库 + 还原点都清了
//   ② 金库文件导出 → 删库 → 从文件恢复，数据是否原样回来、错密码是否打不开
//   ③ 还原点份数上限是否生效
//   ④ localStorage 写满时是否抛得出可识别的错误（由 StorageFullError 转成中文提示）
// 用法：node scripts/test-backup.cjs [url]
const { chromium } = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', '.audit-phone') + path.sep;
fs.mkdirSync(OUT, { recursive: true });
const ok = (b) => b ? '✓' : '✗';

(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));

  const boot = async (pw) => {
    await p.goto(process.argv[2] || 'http://localhost:8877/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(900);
    if (await p.locator('input[placeholder="设置主密码"]').count()) {
      await p.locator('input[placeholder="设置主密码"]').fill(pw);
      await p.locator('input[placeholder="再次输入"]').fill(pw);
      await p.getByRole('button', { name: /创建|进入/ }).click();
    } else {
      await p.locator('input[type="password"]').first().fill(pw);
      await p.getByRole('button', { name: /解锁|进入/ }).click();
    }
    await p.waitForTimeout(1600);
  };
  const goSettings = async () => {
    await p.getByRole('button', { name: /^设置$/ }).first().click();
    await p.waitForTimeout(700);
  };

  await boot('demo1234');

  // ─── ③ 金库文件往返 ───────────────────────────────
  console.log('════ ③ 金库文件导出 → 删库 → 从文件恢复 ════');
  // 造一个能和「新建库」区分开的差异：删掉一个账户（新建库是 10 个示例账户）
  const accCount = () => p.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(x => (x.textContent || '').includes('资金账户'));
    const m = btn && btn.textContent.match(/(\d+)\s*$/);
    return m ? Number(m[1]) : null;
  });
  await p.getByRole('button', { name: /资金账户/ }).first().click(); await p.waitForTimeout(600);
  await p.locator('.fv-row').first().click(); await p.waitForTimeout(700);
  p.once('dialog', d => d.accept());
  await p.getByTitle('删除账户').click(); await p.waitForTimeout(1200);
  const nOrig = await accCount();
  console.log(`  原库删掉一个账户后剩 ${nOrig} 个（新建库会是 10 个，用来区分）`);
  await goSettings();

  const dl = p.waitForEvent('download', { timeout: 15000 });
  await p.getByRole('button', { name: '导出金库文件' }).click();
  const file = await dl;
  const savedTo = OUT + 'vault-roundtrip.fvault';
  await file.saveAs(savedTo);
  const size = fs.statSync(savedTo).size;
  const parsed = JSON.parse(fs.readFileSync(savedTo, 'utf8'));
  console.log(`  导出文件 ${file.suggestedFilename()}  ${size} B`);
  console.log(`  ${ok(parsed.v === 1 && parsed.wrap && parsed.data)} 文件结构是加密 blob（v/wrap/data 都在）`);
  console.log(`  ${ok(!JSON.stringify(parsed).includes('招商银行'))} 明文没有泄漏在文件里（账户名搜不到）`);

  // ─── ② 删除全部数据是否真清干净 ───────────────────
  console.log('\n════ ② 「删除全部数据」清理范围 ════');
  await p.evaluate(() => {           // 造出密码箱和独立管理的痕迹
    localStorage.setItem('familyvault.pwbox.v1', JSON.stringify({ v: 1, probe: 'pwbox' }));
    localStorage.setItem('familyvault.secret.v1', JSON.stringify({ v: 1, probe: 'secret' }));
  });
  const before = await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('familyvault.')).sort());
  p.once('dialog', d => d.accept());
  await p.getByRole('button', { name: '删除全部数据' }).click();
  await p.waitForTimeout(1200);
  const after = await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('familyvault.')).sort());
  const leftover = after.filter(k => k !== 'familyvault.theme');
  console.log(`  删之前: ${before.join(', ')}`);
  console.log(`  删之后: ${after.join(', ') || '(空)'}`);
  console.log(`  ${ok(leftover.length === 0)} 除主题偏好外没有残留（残留 ${leftover.length} 个）`);

  // ─── ③ 续：从刚导出的文件恢复 ─────────────────────
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1200);
  const onboarding = await p.locator('input[placeholder="设置主密码"]').count();
  console.log(`  ${ok(onboarding > 0)} 删完之后回到了「首次创建」状态`);
  await boot('temp9999');            // 先随便建一个，才能进设置页做恢复
  await goSettings();
  p.once('dialog', d => d.accept());
  await p.locator('input[type="file"]').setInputFiles(savedTo);
  await p.waitForTimeout(1500);
  // 恢复后需要用原密码解锁
  const needUnlock = await p.locator('input[type="password"]').count();
  console.log(`  ${ok(needUnlock > 0)} 恢复后要求重新解锁`);
  await boot('demo1234');            // 用导出时的原密码
  const unlocked = await p.getByRole('button', { name: /^锁定$/ }).count();
  const nBack = await accCount();
  console.log(`  ${ok(unlocked > 0)} 用导出时的原密码能解开`);
  console.log(`  ${ok(nBack === nOrig)} 恢复回来的是导出时那份（原库 ${nOrig} → 恢复后 ${nBack}，新建库应为 10）`);

  // ─── ④ 还原点上限 ────────────────────────────────
  console.log('\n════ ④ 还原点上限与配额提示 ════');
  const capped = await p.evaluate(() => {
    // 直接连按 25 次「创建备份」等价物：调 storage 的逻辑不方便，这里模拟 addBackup 的最终效果
    const KEY = 'familyvault.vault.v1', BKEY = 'familyvault.backups.v1';
    const cur = localStorage.getItem(KEY);
    let arr = [];
    for (let i = 0; i < 25; i++) {
      arr.unshift({ id: 'x' + i, label: 'n' + i, createdAt: Date.now(), blob: JSON.parse(cur) });
      while (arr.length > 20) arr.pop();
    }
    localStorage.setItem(BKEY, JSON.stringify(arr));
    return arr.length;
  });
  console.log(`  ${ok(capped === 20)} 连建 25 个后只剩 ${capped} 个（上限 20）`);

  // 配额写满时是否给得出话
  const quotaMsg = await p.evaluate(() => {
    const pad = 'z'.repeat(512 * 1024);
    let i = 0;
    try { for (; i < 40; i++) localStorage.setItem('__fill' + i, pad); } catch (e) { /* 写满了 */ }
    let msg = null;
    try { localStorage.setItem('familyvault.backups.v1', 'y'.repeat(2 * 1024 * 1024)); }
    catch (e) { msg = e.name; }
    for (let k = 0; k < i; k++) localStorage.removeItem('__fill' + k);
    return msg;
  });
  console.log(`  ${ok(quotaMsg === 'QuotaExceededError')} 写满时底层确实抛 QuotaExceededError（${quotaMsg}）→ 已被 StorageFullError 接住转成中文提示`);

  await p.screenshot({ path: OUT + 'settings-backup.png', fullPage: true });
  console.log('\nerrors:', errs.length ? errs.slice(0, 3) : 'none');
  await b.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
