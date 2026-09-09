#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""备份安全回归测试——不起服务器，直接调 run.py 里的函数，数据目录用临时目录（不碰真实数据）。
  ① 分层保留：最近 40 次全留；30 天内每天留当天最后一份；12 周每周留一份；keep- 安全副本单独留 10 份
  ② 乐观并发：baseSavedAt 比磁盘旧 → 拒绝(stale)，磁盘不动；内容没变 → unchanged；老客户端不带字段 → 放行
  ③ baseSavedAt 只用于校验、不落盘
  ④ backup_get 防目录穿越（../、绝对路径、backups/ 外的软链接都拿不到）
  ⑤ 新写的文件权限 600；_tighten_perms 把旧版留下的 644 收成 600
  ⑥ backup_keep 存安全副本、不动 current.home；非本系统数据拒收
  ⑦ backup_list 按时间倒序，安全副本按真实时间穿插
用法：python3 scripts/test-backup-safety.py
"""
import datetime as dt
import importlib.util
import json
import os
import shutil
import stat
import sys
import tempfile
import time
from pathlib import Path

TMP = Path(tempfile.mkdtemp(prefix="home-backup-test-"))
os.environ["HOME_DATA_DIR"] = str(TMP)
ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("home_run", ROOT / "run.py")
run = importlib.util.module_from_spec(spec)
spec.loader.exec_module(run)
assert run.DATA_DIR == TMP, f"数据目录没指到临时目录：{run.DATA_DIR}"

FAILS = []


def check(cond, msg):
    print(("  ✓ " if cond else "  ✗ ") + msg)
    if not cond:
        FAILS.append(msg)


BK = TMP / "backups"
AUTO = "我家里的一切-备份-{}.home"
KEEP = "keep-恢复前-{}.home"


def stamp(day: dt.date, hh: int, mm: int = 0) -> str:
    return f"{day:%Y%m%d}-{hh:02d}{mm:02d}00"


# ───────── ① 分层保留 ─────────
print("① 分层保留")
shutil.rmtree(BK); BK.mkdir()
today = dt.date.today()
auto_files = {}   # name -> (day, stamp)
for offset in range(0, 120):
    day = today - dt.timedelta(days=offset)
    n = 20 if offset < 3 else 2          # 最近三天很勤（一天 20 次），再往前一天两次
    for i in range(n):
        st = stamp(day, i if n == 20 else 9 + i * 8)
        name = AUTO.format(st)
        (BK / name).write_text("x")
        auto_files[name] = (day, st)
keep_files = []
for offset in range(0, 15):
    st = stamp(today - dt.timedelta(days=offset), 12)
    name = KEEP.format(st)
    (BK / name).write_text("k")
    keep_files.append((st, name))
total_before = len(list(BK.glob("*.home")))

run._prune_backups()

remaining = {f.name for f in BK.glob("*.home")}
by_stamp = sorted(auto_files.items(), key=lambda kv: kv[1][1])
last40 = {name for name, _ in by_stamp[-40:]}
check(last40 <= remaining, f"最近 40 次全部保留（{len(last40 & remaining)}/40）")
# 30 天内每天最后一份
day_last = {}
for name, (day, st) in by_stamp:
    day_last[day] = name          # 升序遍历，后者覆盖前者 = 当天最后一份
daily_expected = {day_last[today - dt.timedelta(days=o)] for o in range(0, 30)}
check(daily_expected <= remaining, f"30 天内每天最后一份保留（{len(daily_expected & remaining)}/{len(daily_expected)}）")
# 12 周每周最后一份
week_last = {}
for name, (day, st) in by_stamp:
    y, w, _ = day.isocalendar()
    week_last[(y, w)] = name
weekly_expected = {week_last[k] for k in sorted(week_last)[-12:]}
check(weekly_expected <= remaining, f"最近 12 周每周最后一份保留（{len(weekly_expected & remaining)}/12）")
# 边界日（第 30/31 天）随当天时刻可能算进也可能算不进，不做断言；其它都该删
boundary = {day_last[today - dt.timedelta(days=o)] for o in (30, 31)}
allowed = last40 | daily_expected | weekly_expected | boundary
extra = {n for n in remaining if n in auto_files and n not in allowed}
check(not extra, f"没有多留其它自动备份（多留 {len(extra)} 份）")
# 具体抽查：60 天前那天的第一份该删，那周最后一份该留
d60 = today - dt.timedelta(days=60)
first_of_d60 = AUTO.format(stamp(d60, 9))
check(first_of_d60 not in remaining, "60 天前当天的第一份已删")
y, w, _ = d60.isocalendar()
check(week_last[(y, w)] in remaining, "60 天前那一周的最后一份仍在")
d100 = today - dt.timedelta(days=100)
check(AUTO.format(stamp(d100, 17)) not in remaining, "100 天前（超过 12 周）的已删")
# keep-
kept_keep = sorted(n for n in remaining if n.startswith("keep-"))
expect_keep = sorted(n for _, n in sorted(keep_files)[-10:])
check(kept_keep == expect_keep, f"安全副本只留最近 10 份（{len(kept_keep)}），且是最新的 10 份")
print(f"  （{total_before} 份 → {len(remaining)} 份）")

# ───────── ② ③ 乐观并发 / baseSavedAt 不落盘 ─────────
print("② 乐观并发")
shutil.rmtree(BK); BK.mkdir()
for f in (TMP / "current.home", TMP / "meta.json"):
    if f.exists():
        f.unlink()


def save(ls, base=None):
    b = {"__home_backup": 1, "v": 1, "localStorage": ls, "indexedDB": []}
    if base is not None:
        b["baseSavedAt"] = base
    time.sleep(0.003)      # savedAt 是毫秒，保证单调
    return run.backup_save(json.dumps(b, ensure_ascii=False).encode("utf-8"))


r1 = save({"k": "v1"}, base=0)
check(r1.get("ok") is True, "首次写入（磁盘为空）放行")
t1 = r1["savedAt"]
r2 = save({"k": "v2"}, base=t1)
check(r2.get("ok") is True and r2["savedAt"] > t1, "带上最新 baseSavedAt 的写入放行")
t2 = r2["savedAt"]
r3 = save({"k": "v3"}, base=t1)
check(r3.get("ok") is False and r3.get("error") == "stale" and r3.get("diskSavedAt") == t2, "baseSavedAt 过期 → 拒绝(stale)，并告知磁盘时间")
cur = json.loads((TMP / "current.home").read_text(encoding="utf-8"))
check(cur["localStorage"]["k"] == "v2" and cur["savedAt"] == t2, "被拒绝时磁盘内容纹丝不动")
r4 = save({"k": "v4"})
check(r4.get("ok") is True, "老客户端不带 baseSavedAt → 向后兼容放行")
t4 = r4["savedAt"]
r5 = save({"k": "v4"}, base=0)
check(r5.get("ok") is True and r5.get("unchanged") is True and r5["savedAt"] == t4, "内容没变 → unchanged（不改时间戳，也不当 stale）")
cur = json.loads((TMP / "current.home").read_text(encoding="utf-8"))
check("baseSavedAt" not in cur, "③ baseSavedAt 不落盘")
check(cur.get("dataVersion") == run.DATA_VERSION and cur.get("appVersion") == run.APP_VERSION, "落盘带 dataVersion / appVersion")
check(len(list(BK.glob("我家里的一切-备份-*.home"))) == 3, "三次有效写入 → 三份历史备份")

# ───────── ④ 防穿越 ─────────
print("④ backup_get 防穿越")
real = sorted(BK.glob("*.home"))[-1].name
check(run.backup_get(real) is not None, "正常文件名能取到")
for bad in ("../current.home", "..\\current.home", "/etc/passwd", "", ".", "..", "current.home", "x.txt", "sub/" + real):
    check(run.backup_get(bad) is None, f"拒绝 {bad!r}")
if hasattr(os, "symlink"):
    link = BK / "evil.home"
    try:
        os.symlink(TMP / "current.home", link)
        check(run.backup_get("evil.home") is None, "backups/ 里指向外面的软链接也拿不到")
    except OSError:
        print("  （本系统不能建软链接，跳过）")
    finally:
        if link.is_symlink():
            link.unlink()

# ───────── ⑤ 权限 ─────────
print("⑤ 文件权限")
if os.name == "nt":
    print("  （Windows 无 POSIX 权限，跳过）")
else:
    mode = lambda p: stat.S_IMODE(p.stat().st_mode)
    check(mode(TMP / "current.home") == 0o600, "current.home 是 600")
    check(all(mode(f) == 0o600 for f in BK.glob("*.home")), "backups/*.home 都是 600")
    victim = sorted(BK.glob("*.home"))[0]
    os.chmod(victim, 0o644)
    os.chmod(TMP / "current.home", 0o644)
    run._tighten_perms()
    check(mode(victim) == 0o600 and mode(TMP / "current.home") == 0o600, "_tighten_perms 把 644 收成 600")

# ───────── ⑥ backup_keep ─────────
print("⑥ 安全副本")
before = (TMP / "current.home").read_bytes()
rk = run.backup_keep(json.dumps({"__home_backup": 1, "localStorage": {"k": "local-state"}, "baseSavedAt": 123}).encode())
check(rk.get("ok") is True and rk["name"].startswith("keep-恢复前-"), f"存成 {rk.get('name')}")
kf = BK / rk["name"]
kj = json.loads(kf.read_text(encoding="utf-8"))
check(kf.is_file() and kj["localStorage"]["k"] == "local-state" and "baseSavedAt" not in kj, "副本内容正确、baseSavedAt 已剥掉")
check((TMP / "current.home").read_bytes() == before, "current.home 没被碰")
rb = run.backup_keep(b'{"hello": 1}')
check(rb.get("ok") is False, "非本系统数据拒收")
rb2 = run.backup_keep(b"not json")
check(rb2.get("ok") is False, "坏 JSON 拒收（不抛异常）")

# ───────── ⑦ backup_list 顺序 ─────────
print("⑦ 列表顺序")
lst = run.backup_list()["backups"]
names = [it["name"] for it in lst]
stamps = [run._stamp_of(BK / n) for n in names]
check(stamps == sorted(stamps, reverse=True), "按时间倒序（最新在前）")
check(names[0].startswith("keep-"), "刚存的安全副本排在最前（按真实时间穿插，不按文件名分堆）")
check(all(set(it) >= {"name", "bytes", "mtime"} for it in lst), "每项有 name / bytes / mtime")

shutil.rmtree(TMP, ignore_errors=True)
print()
if FAILS:
    print(f"✗ {len(FAILS)} 项失败：")
    for f in FAILS:
        print("   -", f)
    sys.exit(1)
print("全部通过 ✓")
