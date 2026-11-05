#!/usr/bin/env python3
"""Checkpointed, read-only exact-duplicate check for indexed S300 photos/videos.

Equal file sizes are only candidates. A 64 KiB head/tail probe splits most
candidates; complete SHA-256 is required before reporting an exact duplicate.
The source index and media are never modified. Progress lives in a private
local SQLite database and can resume after a disconnect or interruption.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import contextlib
import datetime as dt
import hashlib
import json
import os
import re
import sqlite3
import stat
import sys
import time
from pathlib import Path, PurePosixPath


PROBE_BYTES = 64 * 1024
READ_BYTES = 4 * 1024 * 1024
MONTH_PATH = re.compile(r"^家庭影像库/(\d{4})/(\d{4})-(0[1-9]|1[0-2])/(.+)$")


def month_bucket(relative: str) -> str | None:
    match = MONTH_PATH.fullmatch(relative)
    if not match or match.group(1) != match.group(2):
        return None
    return f"家庭影像库/{match.group(1)}/{match.group(2)}-{match.group(3)}"


def source_path(root: Path, relative: str) -> Path:
    rel = PurePosixPath(relative)
    if rel.is_absolute() or not rel.parts or any(p in ("", ".", "..") for p in rel.parts):
        raise ValueError(f"不安全的索引路径：{relative}")
    return root.joinpath(*rel.parts)


def read_hash(root: Path, row: tuple, stage: str) -> tuple[str, str | None, str | None]:
    relative, expected_size, prior_mtime = row
    try:
        path = source_path(root, str(relative))
        before = path.stat(follow_symlinks=False)
        if not stat.S_ISREG(before.st_mode) or before.st_size != int(expected_size):
            raise OSError("源文件类型或大小与索引不一致")
        if stage == "full" and prior_mtime is not None and before.st_mtime_ns != int(prior_mtime):
            raise OSError("片段检查后文件修改时间发生变化")
        digest = hashlib.sha256()
        read_total = 0
        with path.open("rb", buffering=0) as stream:
            if stage == "probe":
                if before.st_size <= 2 * PROBE_BYTES:
                    block = stream.read(before.st_size)
                    digest.update(block)
                    read_total = len(block)
                    if read_total != before.st_size:
                        raise OSError("片段读取不完整")
                else:
                    first = stream.read(PROBE_BYTES)
                    stream.seek(-PROBE_BYTES, os.SEEK_END)
                    last = stream.read(PROBE_BYTES)
                    if len(first) != PROBE_BYTES or len(last) != PROBE_BYTES:
                        raise OSError("片段读取不完整")
                    digest.update(first)
                    digest.update(last)
                    read_total = len(first) + len(last)
            else:
                while block := stream.read(READ_BYTES):
                    digest.update(block)
                    read_total += len(block)
                if read_total != before.st_size:
                    raise OSError("完整读取字节数不符")
        after = path.stat(follow_symlinks=False)
        if after.st_size != before.st_size or after.st_mtime_ns != before.st_mtime_ns:
            raise OSError("读取过程中源文件发生变化")
        return str(relative), digest.hexdigest(), str(after.st_mtime_ns)
    except (OSError, ValueError) as exc:
        return str(relative), None, str(exc)


def init(index_db: Path, work_db: Path) -> dict:
    if work_db.exists():
        raise RuntimeError(f"进度数据库已存在，不会覆盖：{work_db}")
    uri = index_db.resolve().as_uri() + "?mode=ro"
    with contextlib.closing(sqlite3.connect(uri, uri=True)) as source:
        run = source.execute("SELECT id,status,source_root FROM organize_runs ORDER BY id DESC LIMIT 1").fetchone()
        if not run or run[1] != "completed":
            raise RuntimeError("照片归档尚未完成")
        root = Path(str(run[2]))
        if not root.is_dir() or not os.path.ismount(root):
            raise RuntimeError("S300 尚未挂载")
        media = source.execute(
            """SELECT rel_path,kind,size,mtime_ns FROM media_files
               WHERE status='active' AND kind IN ('image','video') AND size>0"""
        ).fetchall()
    by_month_size: dict[tuple[str, int], list[tuple]] = {}
    monthly_files = 0
    for relative, kind, size, mtime in media:
        month = month_bucket(relative)
        if month is not None:
            monthly_files += 1
            by_month_size.setdefault((month, size), []).append((relative, month, kind, size, mtime))
    rows = [row for group in by_month_size.values() if len(group) > 1 for row in group]
    rows.sort(key=lambda row: (row[1], -row[3], row[0].casefold()))
    work_db.parent.mkdir(parents=True, exist_ok=True)
    with contextlib.closing(sqlite3.connect(work_db)) as conn:
        conn.executescript(
            """CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
               CREATE TABLE items(
                 rel_path TEXT PRIMARY KEY,bucket TEXT NOT NULL,kind TEXT NOT NULL,size INTEGER NOT NULL,index_mtime_ns INTEGER,
                 actual_mtime_ns INTEGER,probe_hash TEXT,probe_status TEXT NOT NULL DEFAULT 'pending',
                 full_hash TEXT,full_status TEXT NOT NULL DEFAULT 'not_needed',error TEXT
               );
               CREATE INDEX items_probe_idx ON items(bucket,probe_status,size);
               CREATE INDEX items_full_idx ON items(bucket,full_status,size,probe_hash);"""
        )
        conn.executemany("INSERT INTO meta VALUES (?,?)", [
            ("root", str(root)), ("index_db", str(index_db)), ("created_at", dt.datetime.now().isoformat()),
            ("organize_run_id", str(run[0])),
            ("scope", "same-year-same-month"),
            ("monthly_files", str(monthly_files)),
            ("outside_month", str(len(media)-monthly_files)),
        ])
        conn.executemany("INSERT INTO items(rel_path,bucket,kind,size,index_mtime_ns) VALUES (?,?,?,?,?)", rows)
        conn.commit()
    os.chmod(work_db, 0o600)
    return {"candidates": len(rows), "monthlyFiles": monthly_files,
            "outsideMonth": len(media)-monthly_files, "workDb": str(work_db), "root": str(root)}


def status(work_db: Path) -> dict:
    with contextlib.closing(sqlite3.connect(work_db)) as conn:
        probe = dict(conn.execute("SELECT probe_status,count(*) FROM items GROUP BY probe_status"))
        full = dict(conn.execute("SELECT full_status,count(*) FROM items GROUP BY full_status"))
        size_bound = conn.execute(
            "SELECT coalesce(sum((n-1)*size),0) FROM (SELECT size,count(*) n FROM items GROUP BY bucket,size HAVING n>1)"
        ).fetchone()[0]
        full_bytes = conn.execute("SELECT coalesce(sum(size),0) FROM items WHERE full_status IN ('pending','done')").fetchone()[0]
        months = conn.execute("SELECT count(DISTINCT bucket) FROM items").fetchone()[0]
        completed_months = conn.execute(
            """SELECT count(*) FROM (SELECT bucket FROM items GROUP BY bucket
               HAVING sum(probe_status!='done')=0 AND sum(full_status IN ('pending','error'))=0
               AND sum(full_status='not_needed')=0)"""
        ).fetchone()[0]
        current = conn.execute(
            """SELECT bucket,count(*),sum(probe_status='done'),
               sum(full_status IN ('done','skipped')) FROM items GROUP BY bucket
               HAVING sum(probe_status!='done')>0 OR sum(full_status NOT IN ('done','skipped'))>0
               ORDER BY bucket LIMIT 1"""
        ).fetchone()
        current_month = None
        if current:
            bucket, count, probed, finished = current
            current_month = {"month": bucket.rsplit('/',1)[-1],"total": count,
                             "probed": probed,"fullyResolved": finished,
                             "percent": round(100 * (probed + finished) / (2 * count),1)}
        return {"total": sum(probe.values()), "months": months, "completedMonths": completed_months,
                "monthPercent": round(100 * completed_months / months,1) if months else 100,
                "currentMonth": current_month,"probe": probe, "full": full,
                "sizeOnlyMaxReclaimBytes": size_bound, "fullCandidateReadBytes": full_bytes}


def run_stage(work_db: Path, stage: str, workers: int, batch_size: int, limit: int,
              retry_errors: bool, bucket: str | None = None) -> dict:
    conn = sqlite3.connect(work_db)
    try:
        root = Path(conn.execute("SELECT value FROM meta WHERE key='root'").fetchone()[0])
        if not root.is_dir() or not os.path.ismount(root):
            raise RuntimeError("S300 尚未挂载")
        if stage == "full":
            pending, errors = conn.execute(
                "SELECT sum(probe_status='pending'),sum(probe_status='error') FROM items WHERE (? IS NULL OR bucket=?)",
                (bucket, bucket),
            ).fetchone()
            if pending or errors:
                raise RuntimeError("片段检查尚未完整结束；先处理错误项")
            conn.execute(
                """UPDATE items SET full_status='pending'
                   WHERE full_status='not_needed' AND (? IS NULL OR bucket=?)
                   AND (bucket,size,probe_hash) IN
                     (SELECT bucket,size,probe_hash FROM items WHERE probe_status='done'
                      GROUP BY bucket,size,probe_hash HAVING count(*)>1)""",
                (bucket, bucket),
            )
            conn.execute(
                """UPDATE items SET full_status='skipped' WHERE full_status='not_needed'
                   AND (? IS NULL OR bucket=?)""",
                (bucket, bucket),
            )
            conn.commit()
        column = "probe_status" if stage == "probe" else "full_status"
        hash_column = "probe_hash" if stage == "probe" else "full_hash"
        query_statuses = ("pending", "error") if retry_errors else ("pending",)
        handled = 0
        with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
            while True:
                take = min(batch_size, limit - handled) if limit else batch_size
                if take <= 0:
                    break
                marks = ",".join("?" for _ in query_statuses)
                rows = conn.execute(
                    f"SELECT rel_path,size,actual_mtime_ns FROM items WHERE {column} IN ({marks}) "
                    "AND (? IS NULL OR bucket=?) ORDER BY bucket,size DESC,rel_path COLLATE NOCASE LIMIT ?",
                    (*query_statuses, bucket, bucket, take),
                ).fetchall()
                if not rows:
                    break
                started = time.monotonic()
                results = list(pool.map(lambda row: read_hash(root, row, stage), rows))
                failures = 0
                for relative, digest, mtime_or_error in results:
                    if digest:
                        if stage == "probe":
                            conn.execute(
                                "UPDATE items SET probe_hash=?,actual_mtime_ns=?,probe_status='done',error=NULL WHERE rel_path=?",
                                (digest, int(mtime_or_error), relative),
                            )
                        else:
                            conn.execute(
                                "UPDATE items SET full_hash=?,full_status='done',error=NULL WHERE rel_path=?",
                                (digest, relative),
                            )
                    else:
                        failures += 1
                        conn.execute(f"UPDATE items SET {column}='error',error=? WHERE rel_path=?",
                                     (mtime_or_error, relative))
                conn.commit()
                handled += len(rows)
                print(json.dumps({"month": bucket, "stage": stage, "handledThisCall": handled,
                                  "batch": len(rows), "failed": failures,
                                  "seconds": round(time.monotonic()-started, 2)},ensure_ascii=False),flush=True)
                if failures:
                    raise RuntimeError(f"{stage} 发生 {failures} 个读取错误；进度已保存")
        return {"stage": stage, "handledThisCall": handled, **status(work_db)}
    finally:
        conn.close()


def report(work_db: Path, output: Path) -> dict:
    with contextlib.closing(sqlite3.connect(work_db)) as conn:
        state = status(work_db)
        if state["probe"].get("pending",0) or state["probe"].get("error",0):
            raise RuntimeError("片段检查未完成")
        if state["full"].get("pending",0) or state["full"].get("error",0):
            raise RuntimeError("完整哈希未完成")
        rows = conn.execute(
            """SELECT rel_path,bucket,kind,size,full_hash FROM items WHERE full_status='done'
               ORDER BY bucket,size DESC,full_hash,rel_path COLLATE NOCASE"""
        ).fetchall()
        scope = dict(conn.execute("SELECT key,value FROM meta WHERE key IN ('monthly_files','outside_month')"))
    groups: dict[tuple[str,int,str],list[dict]] = {}
    for path,bucket,kind,size,digest in rows:
        groups.setdefault((bucket,size,digest),[]).append({"path":path,"kind":kind})
    groups = {key:members for key,members in groups.items() if len(members)>1}
    months: dict[str,dict] = {}
    for (bucket,size,_digest),members in groups.items():
        item = months.setdefault(bucket,{"exactGroups":0,"duplicateFiles":0,"reclaimableBytes":0})
        item["exactGroups"] += 1
        item["duplicateFiles"] += len(members)-1
        item["reclaimableBytes"] += (len(members)-1)*size
    output.parent.mkdir(parents=True,exist_ok=True)
    result = {"generatedAt":dt.datetime.now().isoformat(),
              "exactGroups":len(groups),"duplicateFiles":sum(len(m)-1 for m in groups.values()),
              "reclaimableBytes":sum((len(m)-1)*key[1] for key,m in groups.items()),
              "sourceCandidates":state["total"],"fullCandidateReadBytes":state["fullCandidateReadBytes"],
              "monthlyFiles":int(scope["monthly_files"]),"outsideMonth":int(scope["outside_month"]),
              "months":months,
              "groups":[{"month":key[0],"size":key[1],"sha256":key[2],"members":members}
                        for key,members in sorted(groups.items(),key=lambda x:(len(x[1])-1)*x[0],reverse=True)]}
    fd=os.open(output,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,"w",encoding="utf-8") as handle:json.dump(result,handle,ensure_ascii=False,indent=2)
    return {key:result[key] for key in ("exactGroups","duplicateFiles","reclaimableBytes","sourceCandidates","fullCandidateReadBytes")}


def run_all(work_db: Path, workers: int, batch_size: int, output: Path) -> dict:
    with contextlib.closing(sqlite3.connect(work_db)) as conn:
        buckets = [row[0] for row in conn.execute("SELECT DISTINCT bucket FROM items ORDER BY bucket")]
    for bucket in buckets:
        with contextlib.closing(sqlite3.connect(work_db)) as conn:
            probe_pending, probe_errors, _full_pending, full_errors = conn.execute(
                """SELECT sum(probe_status='pending'),sum(probe_status='error'),
                   sum(full_status='pending'),sum(full_status='error') FROM items WHERE bucket=?""",
                (bucket,),
            ).fetchone()
        if probe_pending or probe_errors:
            run_stage(work_db,"probe",workers,batch_size,0,bool(probe_errors),bucket)
        run_stage(work_db,"full",workers,batch_size,0,bool(full_errors),bucket)
        print(json.dumps({"completedMonth":bucket},ensure_ascii=False),flush=True)
    return report(work_db,output)


def main() -> None:
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--index-db",type=Path,required=True)
    parser.add_argument("--work-db",type=Path,required=True)
    parser.add_argument("--workers",type=int,default=8)
    parser.add_argument("--batch-size",type=int,default=128)
    parser.add_argument("--limit",type=int,default=0)
    parser.add_argument("--retry-errors",action="store_true")
    parser.add_argument("--output",type=Path)
    parser.add_argument("--month")
    parser.add_argument("command",choices=("init","status","probe","full","report","all"))
    args=parser.parse_args()
    if args.command=="init":result=init(args.index_db,args.work_db)
    elif args.command=="status":result=status(args.work_db)
    elif args.command in ("probe","full"):
        result=run_stage(args.work_db,args.command,max(1,min(args.workers,32)),max(1,args.batch_size),args.limit,args.retry_errors,args.month)
    elif args.command=="all":
        if not args.output:raise RuntimeError("all 需要 --output")
        result=run_all(args.work_db,max(1,min(args.workers,32)),max(1,args.batch_size),args.output)
    else:
        if not args.output:raise RuntimeError("report 需要 --output")
        result=report(args.work_db,args.output)
    print(json.dumps(result,ensure_ascii=False),flush=True)


if __name__=="__main__":
    try:main()
    except (RuntimeError,sqlite3.Error) as exc:
        print(str(exc),file=sys.stderr)
        raise SystemExit(2)
