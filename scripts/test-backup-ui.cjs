#!/usr/bin/env node
// 备份安全的端到端测试：自己起一个 run.py（临时数据目录 + 独立端口，不碰真实数据），
// 先打几条 HTTP，再用无头浏览器走一遍入口页的「从本机备份恢复」：
//   ① /api/backup/keep 的 Origin 校验、/api/backup/get 的路径穿越
//   ② 恢复面板列出多份历史、最新在前
//   ③ 选一份较旧的恢复 → 恢复前自动存安全副本 → 刷新后仍是恢复的那份（不会被开机同步拉回去）
//   ④ 再用安全副本恢复回来 → 数据回到恢复前
//   ⑤ 坏备份（截断 / 缺加密结构）在 localStorage.clear() 之前就被拒
//   ⑥ 另一个入口写过盘后，本窗口写盘被拒并有提示；刷新后自动拉取最新、恢复正常写盘
// 用法：node scripts/test-backup-ui.cjs
const { chromium } = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = 5182;
const URL_ = `http://localhost:${PORT}/`;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'home-ui-test-'));
const PW = 'demo1234';
const tag = Date.now().toString(36).slice(-4);
const ok = (b) => (b ? '✓' : '✗');
let fails = 0;
const check = (b, msg) => { console.log(`  ${ok(b)} ${msg}`); if (!b) fails++; };

async function waitServer() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(URL_ + 'api/version'); if (r.ok) return true; } catch (e) { }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

async function openFinance(p) {
  await p.goto(URL_, { waitUntil: 'load' });
  await p.waitForTimeout(3500);                        // 给开机同步 + 可能的 reload 留时间
  await p.locator('.scard').first().click(); await p.waitForTimeout(1200);
  const gpw = p.locator('#gpw');
  if (await gpw.isVisible()) {
    await gpw.fill(PW);
    const g2 = p.locator('#gpw2'); if (await g2.isVisible()) await g2.fill(PW);
    await p.keyboard.press('Enter'); await p.waitForTimeout(3000);
  }
  const fr = p.frameLocator('#frame');
  const sp = fr.locator('input[placeholder="设置主密码"]');
  if (await sp.count()) { await sp.fill(PW); await fr.locator('input[placeholder="再次输入"]').fill(PW); await fr.getByRole('button', { name: /创建|进入/ }).click(); await p.waitForTimeout(2000); }
  const unlockIn = fr.locator('input[type="password"]');
  if (await unlockIn.count()) { await unlockIn.first().fill(PW); await fr.getByRole('button', { name: /解锁|进入/ }).click(); await p.waitForTimeout(2000); }
  await fr.getByRole('button', { name: /^资金账户/ }).first().click(); await p.waitForTimeout(700);
  return fr;
}
const bodyText = (fr) => fr.locator('body').innerText();
async function addAccount(p, fr, name) {
  await fr.getByRole('button', { name: /新增账户/ }).first().click(); await p.waitForTimeout(500);
  await fr.locator('input[placeholder="如 招商银行储蓄卡"]').fill(name);
  const bal = fr.locator('input[placeholder="如 50000"]'); if (await bal.count()) await bal.fill('12345');
  await fr.getByRole('button', { name: '添加', exact: true }).click(); await p.waitForTimeout(1000);
}
async function forceSave(p) {
  await p.locator('#setbtn').click(); await p.waitForTimeout(600);
  await p.locator('#bknow').click(); await p.waitForTimeout(2500);
  const st = ((await p.locator('#bkstatus').textContent()) || '').trim();
  await p.locator('#sclose').click(); await p.waitForTimeout(400);
  return st;
}
const listDisk = () => fs.readdirSync(path.join(DATA, 'backups')).filter((n) => n.endsWith('.home'));
const latest = async () => { const r = await fetch(URL_ + 'api/backup/latest'); return r.status === 204 ? null : r.json(); };

(async () => {
  const py = spawn('python3', [path.join(ROOT, 'run.py')], {
    env: { ...process.env, HOME_DATA_DIR: DATA, HOME_PORT: String(PORT), HOME_NO_BROWSER: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let pyLog = ''; py.stdout.on('data', (d) => (pyLog += d)); py.stderr.on('data', (d) => (pyLog += d));
  const cleanup = () => { try { py.kill(); } catch (e) { } try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) { } };
  process.on('exit', cleanup);
  if (!(await waitServer())) { console.error('服务器没起来：\n' + pyLog); process.exit(1); }
  console.log(`服务器已起：${URL_}  数据目录：${DATA}\n`);

  console.log('① HTTP 护栏');
  const bundle = JSON.stringify({ __home_backup: 1, localStorage: { k: 'v' }, indexedDB: [] });
  let r = await fetch(URL_ + 'api/backup/keep', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://evil.example' }, body: bundle });
  check(r.status === 403, '/api/backup/keep 拒绝外来 Origin（403）');
  r = await fetch(URL_ + 'api/backup/save', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://evil.example' }, body: bundle });
  check(r.status === 403, '/api/backup/save 拒绝外来 Origin（403）');
  for (const bad of ['../current.home', '..%2Fcurrent.home', '%2e%2e/current.home', '/etc/passwd', 'current.home']) {
    r = await fetch(URL_ + 'api/backup/get?name=' + bad);
    check(r.status === 404, `/api/backup/get?name=${bad} → 404`);
  }
  check((await fetch(URL_ + 'api/backup/latest')).status === 204, '空目录时 /api/backup/latest → 204');

  console.log('\n② 恢复面板');
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  p.on('dialog', (d) => d.accept());
  const OLD = `恢复测试-旧-${tag}`, NEW = `恢复测试-新-${tag}`;
  let fr = await openFinance(p);
  await addAccount(p, fr, OLD);
  const st1 = await forceSave(p);
  check(/已自动存到本机/.test(st1) && /每周 12 周/.test(st1), `第一次写盘：${st1.slice(0, 40)}…`);
  const snapA = await latest();
  await addAccount(p, fr, NEW);
  const st2 = await forceSave(p);
  check(/已自动存到本机/.test(st2), '第二次写盘（含新账户）');
  const snapB = await latest();
  check(snapB.savedAt > snapA.savedAt, '两次 savedAt 递增');
  check((await bodyText(fr)).includes(OLD) && (await bodyText(fr)).includes(NEW), '恢复前：两个账户都在');

  await p.locator('#setbtn').click(); await p.waitForTimeout(500);
  await p.locator('#bkrestore').click(); await p.waitForTimeout(800);
  const pick = p.locator('#bkpick');
  check(await pick.isVisible(), '点「从本机备份恢复…」弹出历史版本面板');
  let opts = await p.locator('#bksel option').allTextContents();
  check(opts.length >= 2, `列出 ${opts.length} 份历史`);
  check(/^最新 · /.test(opts[0] || ''), `第一项标「最新」：${opts[0]}`);
  const diskBefore = listDisk().length;

  console.log('\n③ 恢复较旧的一份');
  await p.locator('#bksel').selectOption({ index: 1 });   // 第二新 = 只有旧账户那份
  await p.locator('#bkgo').click();
  await p.waitForTimeout(4000);
  await p.waitForLoadState('load'); await p.waitForTimeout(3500);
  const keepFiles = listDisk().filter((n) => n.startsWith('keep-恢复前-'));
  check(keepFiles.length === 1, `恢复前自动存了安全副本：${keepFiles[0] || '（没有）'}`);
  const snapC = await latest();
  check(snapC.savedAt > snapB.savedAt, '恢复结果已写回磁盘（current.home 更新）');
  check(listDisk().length === diskBefore + 2, '磁盘上多了两份：安全副本 + 恢复后的自动备份');
  fr = await openFinance(p);
  let txt = await bodyText(fr);
  check(txt.includes(OLD) && !txt.includes(NEW), '刷新后仍是恢复的那份：旧账户在、新账户不在（没被开机同步拉回去）');

  console.log('\n④ 用安全副本恢复回来');
  await p.locator('#setbtn').click(); await p.waitForTimeout(500);
  await p.locator('#bkrestore').click(); await p.waitForTimeout(800);
  opts = await p.locator('#bksel option').allTextContents();
  const idx = opts.findIndex((t) => t.includes('恢复前的安全副本'));
  check(idx >= 0, `面板里能认出安全副本：${opts[idx]}`);
  await p.locator('#bksel').selectOption({ index: idx });
  await p.locator('#bkgo').click();
  await p.waitForTimeout(4000);
  await p.waitForLoadState('load'); await p.waitForTimeout(3500);
  fr = await openFinance(p);
  txt = await bodyText(fr);
  check(txt.includes(OLD) && txt.includes(NEW), '两个账户都回来了');

  console.log('\n⑤ 坏备份在清库前被拒');
  const res5 = await p.evaluate(async () => {
    const out = {};
    out.notOurs = validateBundle({});
    out.truncated = validateBundle({ __home_backup: 1, localStorage: { 'familyvault.vault.v1': '{"v":1,"wrap":"x' } });
    out.noCrypto = validateBundle({ __home_backup: 1, localStorage: { 'familyvault.vault.v1': JSON.stringify({ v: 1 }) } });
    out.badIdb = validateBundle({ __home_backup: 1, localStorage: {}, indexedDB: 'nope' });
    out.good = validateBundle({ __home_backup: 1, localStorage: { 'familyvault.vault.v1': JSON.stringify({ v: 1, wrap: {}, data: 'abc' }), other: 'x' }, indexedDB: [] });
    const before = localStorage.getItem('familyvault.vault.v1');
    let threw = null;
    try { await applyBundle({ __home_backup: 1, localStorage: { 'familyvault.vault.v1': '{"v":1,"wrap":"x' } }); } catch (e) { threw = String(e.message || e); }
    out.threw = threw;
    out.intact = before != null && localStorage.getItem('familyvault.vault.v1') === before;
    return out;
  });
  check(typeof res5.notOurs === 'string', `不是本系统 → ${res5.notOurs}`);
  check(/不是合法 JSON/.test(res5.truncated || ''), `截断的金库 → ${res5.truncated}`);
  check(/缺少加密结构/.test(res5.noCrypto || ''), `缺加密结构 → ${res5.noCrypto}`);
  check(typeof res5.badIdb === 'string', `indexedDB 段坏 → ${res5.badIdb}`);
  check(res5.good === null, '正常 bundle → 通过');
  check(/校验失败/.test(res5.threw || ''), `applyBundle 坏数据抛错：${res5.threw}`);
  check(res5.intact, '抛错后本机金库原封不动（没被 clear）');

  console.log('\n⑥ 另一个入口写过盘 → 本窗口写盘被拒');
  const res6 = await p.evaluate(async () => {
    localStorage.setItem('home.diskSyncedAt', '1');          // 假装我上次同步是很久以前
    localStorage.setItem('home.test.dummy', String(Date.now()));   // 改点内容，避开「内容没变」短路
    const r = await autoSave('manual');
    const status = document.getElementById('bkstatus').innerText;
    localStorage.removeItem('home.test.dummy');
    return { r, status };
  });
  check(res6.r && res6.r.error === 'stale', `写盘返回 stale：${JSON.stringify(res6.r && { error: res6.r.error })}`);
  check(/未写盘：磁盘上有更新的数据/.test(res6.status), `设置里有明确提示：${res6.status.slice(0, 30)}…`);
  const snapD = await latest();
  check(snapD.savedAt === snapC.savedAt || snapD.savedAt > snapC.savedAt, '磁盘上的数据没被这次写盘覆盖');
  const diskDummy = JSON.stringify(snapD.localStorage || {}).includes('home.test.dummy');
  check(!diskDummy, '被拒的那份内容确实没落盘');
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(4000);
  const res6b = await p.evaluate(async () => ({ synced: localStorage.getItem('home.diskSyncedAt'), r: await autoSave('manual') }));
  check(Number(res6b.synced) > 1, '刷新后开机同步拉取了磁盘最新（diskSyncedAt 更新）');
  check(res6b.r && res6b.r.ok === true, '之后写盘恢复正常');

  console.log('\n页面错误:', errs.length ? errs.slice(0, 3) : '无');
  await b.close();
  cleanup();
  console.log(fails ? `\n✗ ${fails} 项失败` : '\n全部通过 ✓');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
