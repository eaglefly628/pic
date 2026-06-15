import { useRef, useState } from "react";
import { useVault } from "../vault/VaultContext";
import { parseWorkbook, type ParseResult } from "../lib/parseExcel";
import { Btn, Field, TextField, card } from "../ui";
import { IconImport, IconCheck } from "../icons";

export default function ImportData() {
  const { update } = useVault();
  const fileRef = useRef<HTMLInputElement>(null);
  const [sheet, setSheet] = useState("Sheet2");
  const [result, setResult] = useState<ParseResult | null>(null);
  const [err, setErr] = useState("");
  const [fileName, setFileName] = useState("");
  const [done, setDone] = useState(false);

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
    if (!result) return;
    update((d) => { d.dataset.accounts = result.dataset.accounts; d.dataset.snapshots = result.dataset.snapshots; d.dataset.real = true; });
    setDone(true);
  };

  return (
    <div style={{ padding: "24px 32px 40px", animation: "fvFade 0.3s ease", maxWidth: 760 }}>
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
