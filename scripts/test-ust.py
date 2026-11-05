#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""美债收益率取数的单元测试。用假的财政部 CSV 喂进去（本机跑测试时不联网），
验证解析、区间裁剪、曲线对比、降级这些逻辑；最后如果能联网，再打一次真实数据源看看形状对不对。
用法：python3 scripts/test-ust.py
"""
import importlib.util
import io
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("home_run", ROOT / "run.py")
run = importlib.util.module_from_spec(spec)
spec.loader.exec_module(run)

FAILS = []


def check(cond, msg):
    print(("  ✓ " if cond else "  ✗ ") + msg)
    if not cond:
        FAILS.append(msg)


# ───────── ① 表头解析 ─────────
print("① 表头 → 档位")
cases = [("1 Mo", "1M", 1), ("3 Mo", "3M", 3), ("1.5 Month", "1.5M", 1.5),
         ("6 Mo", "6M", 6), ("1 Yr", "1Y", 12), ("2 Yr", "2Y", 24),
         ("10 Yr", "10Y", 120), ("30 Yr", "30Y", 360), ("20 Year", "20Y", 240)]
for h, key, months in cases:
    got = run._ust_tenor(h)
    check(got == (key, months), f"{h!r} → {key} ({months} 个月)")
for h in ("Date", "", None, "Extrapolation Factor", "8 Wk Bill"):
    check(run._ust_tenor(h) is None, f"{h!r} 不是档位列 → 跳过")

# ───────── ② CSV 解析 ─────────
print("\n② CSV 解析")
DAY = 86400.0


def mkcsv(n_days, end_ts=None, header=None, start_val=4.0):
    """造 n_days 天的假 CSV，最新的在最前（跟财政部一样）。"""
    end_ts = end_ts or time.time()
    head = header or ["Date", "1 Mo", "3 Mo", "6 Mo", "1 Yr", "2 Yr", "5 Yr", "10 Yr", "20 Yr", "30 Yr"]
    lines = [",".join(head)]
    for i in range(n_days):
        t = time.localtime(end_ts - i * DAY)
        d = "%02d/%02d/%04d" % (t.tm_mon, t.tm_mday, t.tm_year)
        vals = [d] + ["%.2f" % (start_val + j * 0.1 + i * 0.001) for j in range(len(head) - 1)]
        lines.append(",".join(vals))
    return "\n".join(lines) + "\n"


FAKE = {}


def fake_ust_year(year):
    if year not in FAKE:
        raise RuntimeError(f"没有 {year} 年的数据")
    rows = list(run.csv.reader(io.StringIO(FAKE[year])))
    cols, months_of = [], {}
    for i, h in enumerate(rows[0]):
        t = run._ust_tenor(h)
        if t:
            cols.append((i, t[0]))
            months_of[t[0]] = t[1]
    out = []
    for row in rows[1:]:
        if not row or not row[0].strip():
            continue
        mo, da, yr = row[0].strip().split("/")
        yr, mo, da = int(yr), int(mo), int(da)
        ms = int(time.mktime((yr, mo, da, 12, 0, 0, 0, 0, -1)) * 1000)
        y = {}
        for i, key in cols:
            if i < len(row) and row[i].strip():
                y[key] = float(row[i].strip())
        if y:
            out.append({"date": "%04d-%02d-%02d" % (yr, mo, da), "t": ms, "y": y})
    out.sort(key=lambda x: x["date"])
    return out, months_of


# 先直接测真正的解析函数（绕开网络，手工喂 CSV 文本）
_orig_urlopen = run.urllib.request.urlopen


class _Resp:
    def __init__(self, text): self._t = text.encode("utf-8")
    def read(self): return self._t
    def __enter__(self): return self
    def __exit__(self, *a): return False


def patch_net(mapping):
    def fake(req, timeout=None):
        url = req.full_url if hasattr(req, "full_url") else str(req)
        for frag, text in mapping.items():
            if frag in url:
                return _Resp(text)
        raise RuntimeError("blocked: " + url)
    run.urllib.request.urlopen = fake


this_year = time.gmtime().tm_year
patch_net({"/%d/all" % this_year: mkcsv(400)})
rows, months_of = run._ust_year(this_year)
check(len(rows) == 400, f"400 行全部解析出来（{len(rows)}）")
check(rows[0]["date"] < rows[-1]["date"], "按日期升序（财政部原文是倒序）")
check(months_of.get("10Y") == 120 and months_of.get("3M") == 3, "档位 → 月数 映射正确")
check(set(rows[-1]["y"]) == {"1M", "3M", "6M", "1Y", "2Y", "5Y", "10Y", "20Y", "30Y"}, "每行取到 9 个档位")
check(isinstance(rows[-1]["y"]["10Y"], float), "收益率是数字")

print("\n  缺值 / 脏行")
messy = ("Date,1 Mo,3 Mo,10 Yr,30 Yr\n"
         "09/10/2026,4.10,,4.30,N/A\n"
         "bad-date,1,2,3,4\n"
         ",,,,\n"
         "09/09/2026,4.05,4.12,4.28,4.55\n")
patch_net({"/%d/all" % this_year: messy})
rows2, _ = run._ust_year(this_year)
check(len(rows2) == 2, f"坏日期行和空行被丢掉（剩 {len(rows2)} 行）")
check("3M" not in rows2[-1]["y"] and rows2[-1]["y"]["1M"] == 4.10, "空单元格跳过，同行其它值照常取")
check("30Y" not in rows2[-1]["y"], "「N/A」这种非数字也跳过，不会让整行报废")

# ───────── ③ 区间裁剪 + 曲线对比 ─────────
print("\n③ fetch_ust 区间与曲线")
patch_net({"/%d/all" % this_year: mkcsv(400)})
for rng, lo, hi in (("1mo", 25, 34), ("3mo", 88, 97), ("6mo", 180, 192), ("1y", 360, 372)):
    r = run.fetch_ust(rng)
    n = len(r["history"]["10Y"])
    check(r["ok"] and lo <= n <= hi, f"{rng}: 走势点数 {n}（期望 {lo}~{hi}）")
r = run.fetch_ust("3mo")
check(r["src"] == "treasury", "标明数据源是财政部")
check([t["key"] for t in r["tenors"]] == ["1M", "3M", "6M", "1Y", "2Y", "5Y", "10Y", "20Y", "30Y"], "档位按期限从短到长排好")
check(set(r["history"]) == {"3M", "2Y", "5Y", "10Y", "30Y"}, f"走势只回常用 5 档（{sorted(r['history'])}）")
check(r["latest"]["date"] > r["prev"]["date"], "latest 是最新一期、prev 是上一交易日（用来算日涨跌）")
check(len(r["curves"]) == 3, f"曲线对比给了 3 条（{[c['date'] for c in r['curves']]}）")
check(r["curves"][0]["date"] == r["latest"]["date"], "第一条就是最新那条")
check(len({c["date"] for c in r["curves"]}) == 3, "三条日期互不相同（去过重）")
gap = (r["curves"][0]["t"] - r["curves"][1]["t"]) / 86400000
check(25 <= gap <= 35, f"第二条大约是一个月前（相差 {gap:.0f} 天）")
check(r["curves"][-1]["date"] == min(c["date"] for c in r["curves"]), "最后一条是区间最早那期")
check(len(r["curves"][0]["y"]) == 9, "曲线是整条（9 个档位），不是只有 10 年期")

print("\n  年初：当年文件只有几天时补上一年")
# 模拟「现在是 1 月初」：当年文件只有最近 5 天，再往前的在上一年文件里。
# （日期仍以真实的今天为锚，因为 fetch_ust 的区间是拿 time.time() 算的。）
patch_net({"/%d/all" % this_year: mkcsv(5), "/%d/all" % (this_year - 1): mkcsv(360, end_ts=time.time() - 5 * DAY)})
r = run.fetch_ust("1y")
check(r["ok"] and len(r["history"]["10Y"]) > 300, f"跨年拼起来了（{len(r['history']['10Y'])} 个点）")
r3 = run.fetch_ust("3mo")
check(len(r3["history"]["10Y"]) < len(r["history"]["10Y"]), "拼完之后区间裁剪照样生效（近3月 < 近1年）")

print("\n  上一年取不到时不至于整个失败")
patch_net({"/%d/all" % this_year: mkcsv(5)})
r = run.fetch_ust("1y")
check(r["ok"] and len(r["history"]["10Y"]) == 5, f"只用当年的 5 天也能出图（{len(r['history']['10Y'])} 个点）")

print("\n  表头换了列（财政部各年列不一样）也能认")
alt = ["Date", "1 Mo", "1.5 Month", "2 Mo", "3 Mo", "4 Mo", "6 Mo", "1 Yr", "2 Yr", "3 Yr", "5 Yr", "7 Yr", "10 Yr", "20 Yr", "30 Yr"]
patch_net({"/%d/all" % this_year: mkcsv(100, header=alt)})
r = run.fetch_ust("3mo")
check(r["ok"] and len(r["tenors"]) == 14, f"14 个档位全认出来（{len(r['tenors'])}）")
check([t["key"] for t in r["tenors"]][:4] == ["1M", "1.5M", "2M", "3M"], "1.5 个月这种也排在正确位置")

# ───────── ④ 降级 ─────────
print("\n④ 财政部取不到时降级 Yahoo")


def yahoo_json(price):
    return ('{"chart":{"result":[{"meta":{"regularMarketPrice":%s,"chartPreviousClose":%s},'
            '"timestamp":[1,2],"indicators":{"quote":[{"close":[%s,%s]}]}}]}}' % (price, price, price, price))


patch_net({"%5EIRX": yahoo_json(4.2), "%5EFVX": yahoo_json(4.0), "%5ETNX": yahoo_json(4.3), "%5ETYX": yahoo_json(4.8)})
r = run.fetch_ust("3mo")
check(r["ok"] and r["src"] == "yahoo", "降级成功，标明数据源是 yahoo")
check(r.get("partial") is True and r.get("note"), f"明确标了「只有现价、没有走势」：{r.get('note')}")
check(r["latest"]["y"]["10Y"] == 4.3 and r["history"] == {}, "现价拿到了，走势为空")
check([t["key"] for t in r["tenors"]] == ["3M", "5Y", "10Y", "30Y"], "降级的档位也排好序")

print("\n  Yahoo 老口径（收益率 ×10）自动换算")
patch_net({"%5EIRX": yahoo_json(42.0), "%5EFVX": yahoo_json(40.0), "%5ETNX": yahoo_json(43.0), "%5ETYX": yahoo_json(48.0)})
r = run.fetch_ust("3mo")
check(r["latest"]["y"]["10Y"] == 4.3, f"43.0 认成 4.30%（实得 {r['latest']['y']['10Y']}）")

print("\n  两个源都不通")
patch_net({})
r = run.fetch_ust("3mo")
check(r["ok"] is False and "需联网" in r["error"], f"明确报错而不是抛异常：{r['error']}")

run.urllib.request.urlopen = _orig_urlopen

# ───────── ⑤ 真实数据源（能联网才跑）─────────
print("\n⑤ 真实数据源")
try:
    r = run.fetch_ust("3mo")
    if r.get("ok"):
        y = r["latest"]["y"]
        print(f"  数据源 {r['src']} · {r['latest']['date']} · {len(r.get('tenors', []))} 个档位")
        print("  " + "  ".join(f"{k}={v}%" for k, v in sorted(y.items(), key=lambda kv: kv[0])))
        check(all(0 <= v <= 25 for v in y.values()), "收益率都在 0~25% 这个合理区间内")
        check("10Y" in y, "有 10 年期")
    else:
        print(f"  取不到（{r.get('error')}）——本容器不通外网属正常，跳过")
except Exception as e:
    print(f"  取不到（{e}）——本容器不通外网属正常，跳过")

print()
if FAILS:
    print(f"✗ {len(FAILS)} 项失败：")
    for f in FAILS:
        print("   -", f)
    sys.exit(1)
print("全部通过 ✓")
