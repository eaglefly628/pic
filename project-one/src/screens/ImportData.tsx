import { useRef, useState } from "react";
import { useVault } from "../vault/VaultContext";
import { parseWorkbook, type ParseResult } from "../lib/parseExcel";
import { exportDatasetToExcel } from "../lib/exportExcel";
import { Btn, Field, Select, TextField, card } from "../ui";
import { IconImport, IconCheck, IconDownload } from "../icons";

export default function ImportData() {
  const { data, update } = useVault();
  const fileRef = useRef<HTMLInputElement>(null);
  const [sheet, setSheet] = useState("Sheet2");
  const [result, setResult] = useState<ParseResult | null>(null);
  const [err, setErr] = useState("");
  const [fileName, setFileName] = useState("");
  const [done, setDone] = useState(false);
  const [expMonths, setExpMonths] = useState(12);

  const onFile = async (file: File) => {
    setErr(""); setResult(null); setDone(false); setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      setResult(await parseWorkbook(buf, sheet));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const apply = () => {
    if (!result || !data) return;
    // 这是全站最容易误伤的操作：会把现有全部账户和快照整个换掉。
    // 把「现在有什么、会变成什么」都写进确认框，让人看清楚再点。
    const cur = data.dataset;
    const msg =
      `确定用这份 Excel 替换全部数据？\n\n` +
      `现在：${cur.accounts.length} 个账户、${cur.snapshots.length} 期快照\n` +
      `替换后：${result.accountCount} 个账户、${result.snapshotCount} 期快照` +
      (result.from ? `（${result.from} ～ ${result.to}）` : "") + `\n\n` +
      `现有的账户、快照、手工补录都会被覆盖，不可撤销。建议先到「设置 · 程序内备份」建一个还原点。`;
    if (!confirm(msg)) return;
    update((d) => { d.dataset.accounts = result.dataset.accounts; d.dataset.snapshots = result.dataset.snapshots; d.dataset.real = true; });
    setDone(true);
  };

  const accCount = data?.dataset.accounts.length ?? 0;
  const snapCount = data?.dataset.snapshots.length ?? 0;

  return (
    <div style={{ padding: "24px 32px 40px", animation: "fvFade 0.3s ease", maxWidth: 760 }}>
      {/* 导出 */}
      <div style={{ ...card, padding: "20px 26px", marginBottom: 18, display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>导出 Excel（仅主账户）</div>
          <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>当前 {accCount} 个账户 · {snapCount} 条快照。导出「净资产历史 + 账户」两张表，<strong>首行冻结</strong>，可再次导入。</div>
        </div>
        <div style={{ width: 132 }}>
          <Select value={String(expMonths)} onChange={(e) => setExpMonths(Number(e.target.value))}
            options={[{ value: "6", label: "近 6 个月" }, { value: "12", label: "近 12 个月" }, { value: "24", label: "近 24 个月" }, { value: "0", label: "全部历史" }]} />
        </div>
        <Btn onClick={() => data && exportDatasetToExcel(data.dataset, expMonths)}><IconDownload />导出 Excel</Btn>
      </div>

      <div style={{ ...card, padding: "24px 26px" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>从 Excel 导入历史数据</div>
        <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 18 }}>
          选择理财表格，读取指定工作表（每行一个日期、各列为账户余额）。导入将<strong>替换</strong>当前的资金账户与历史快照（密码、个人信息不受影响），并自动加密保存。
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 12, alignItems: "end" }}>
          <Field label="工作表名称"><TextField value={sheet} onChange={(e) => setSheet(e.target.value)} placeholder="Sheet2" /></Field>
          <Btn variant="ghost" onClick={() => fileRef.current?.click()} style={{ height: 36 }}><IconImport size={15} stroke="currentColor" />选择 Excel 文件</Btn>
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />

        {fileName && <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 }}>已选择：{fileName}</div>}
        {err && <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 9, background: "color-mix(in srgb, var(--red) 12%, transparent)", color: "var(--red)", fontSize: 12.5 }}>{err}</div>}

        {result && (
          <div style={{ marginTop: 18, padding: "16px 18px", borderRadius: 11, background: "var(--fill-quaternary)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 10 }}>解析预览</div>
            <div style={{ display: "flex", gap: 28 }}>
              <Stat label="账户数" value={String(result.accountCount)} />
              <Stat label="快照数" value={String(result.snapshotCount)} />
              <Stat label="时间范围" value={result.from && result.to ? `${result.from} ~ ${result.to}` : "—"} />
            </div>
            <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
              <Btn onClick={apply} disabled={done}>{done ? <><IconCheck stroke="#fff" /> 已导入</> : "确认导入并替换"}</Btn>
              {done && <span style={{ fontSize: 12.5, color: "var(--green)" }}>导入成功，已加密保存。</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}
