import { useState } from "react";
import { useVault } from "../vault/VaultContext";
import { CAT_TITLE, latestBalances } from "../lib/compute";
import type { Dataset } from "../data/types";
import { fmt } from "../lib/format";
import { card } from "../ui";
import { useCountUp, rise } from "../lib/anim";

/** 可复用的利息预测视图（主账户与私房钱共用） */
export function InterestView({ dataset, onSetRate }: { dataset: Dataset; onSetRate: (id: string, dec: number) => void }) {
  const [rates, setRates] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const a of dataset.accounts) o[a.id] = a.rate != null ? String(+(a.rate * 100).toFixed(4)) : "0";
    return o;
  });
  const lb = latestBalances(dataset);
  const commit = (id: string, val: string) => onSetRate(id, (parseFloat(val) || 0) / 100);

  const rows = dataset.accounts
    .map((a) => {
      const ratePct = parseFloat(rates[a.id] ?? "0") || 0;
      const bal = lb[a.id];
      return { a, bal, ratePct, annual: (bal * ratePct) / 100 };
    })
    .sort((x, y) => Math.abs(y.annual) - Math.abs(x.annual));
  const totalAnnual = rows.reduce((s, r) => s + r.annual, 0);
  const yAnim = useCountUp(totalAnnual);
  const mAnim = useCountUp(totalAnnual / 12);
  const dAnim = useCountUp(totalAnnual / 365);

  return (
    <div style={{ padding: "24px 32px 40px" }}>
      <div className="fv-rise" style={{ ...rise(0), display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 18 }}>
        <div style={{ position: "relative", overflow: "hidden", background: "linear-gradient(155deg, var(--accent), #b08a5e)", borderRadius: 14, padding: "18px 22px", color: "#fff", boxShadow: "0 8px 20px -6px var(--accent-soft)" }}>
          <div aria-hidden className="fv-sheen" />
          <div style={{ position: "relative" }}>
            <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.82)", fontWeight: 500 }}>预计年利息合计</div>
            <div style={{ fontSize: 25, fontWeight: 700, marginTop: 8, fontVariantNumeric: "tabular-nums" }}>{fmt(yAnim)}</div>
          </div>
        </div>
        <Metric label="预计月利息" value={fmt(mAnim)} />
        <Metric label="预计日利息" value={fmt(dAnim)} />
      </div>

      {rows.length === 0 ? (
        <div style={{ ...card, padding: "40px 22px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>还没有账户，先去添加账户。</div>
      ) : (
        <div className="fv-rise" style={{ ...rise(110), ...card, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "15px 22px 13px" }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>当前利息预测（按账户）</div>
            <div style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>在「年利率」列直接为每个账户设置利率，默认 0</div>
          </div>
          <div style={{ display: "flex", padding: "8px 22px", fontSize: 11, color: "var(--text-tertiary)", borderTop: "0.5px solid var(--separator)", background: "var(--bg-card-2)" }}>
            <span style={{ flex: 1 }}>账户</span>
            <span style={{ width: 80 }}>分类</span>
            <span style={{ width: 140, textAlign: "right" }}>当前余额</span>
            <span style={{ width: 110, textAlign: "right" }}>年利率(%)</span>
            <span style={{ width: 140, textAlign: "right" }}>预计年利息</span>
            <span style={{ width: 120, textAlign: "right" }}>预计月利息</span>
          </div>
          {rows.map((r) => (
            <div key={r.a.id} style={{ display: "flex", alignItems: "center", padding: "10px 22px", borderTop: "0.5px solid var(--separator)", fontSize: 13 }}>
              <span style={{ flex: 1, display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: r.a.color, flex: "none" }} />
                <span style={{ color: "var(--text-primary)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.a.name}</span>
              </span>
              <span style={{ width: 80, fontSize: 11.5, color: "var(--text-secondary)" }}>{CAT_TITLE[r.a.cat]}</span>
              <span style={{ width: 140, textAlign: "right", color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{fmt(r.bal)}</span>
              <span style={{ width: 110, display: "flex", justifyContent: "flex-end" }}>
                <input
                  value={rates[r.a.id] ?? "0"} inputMode="decimal"
                  onChange={(e) => setRates((m) => ({ ...m, [r.a.id]: e.target.value }))}
                  onBlur={(e) => commit(r.a.id, e.target.value)}
                  style={{ width: 72, height: 30, textAlign: "right", padding: "0 8px", borderRadius: 7, background: "var(--fill-quaternary)", border: "0.5px solid var(--separator-strong)", color: "var(--text-primary)", fontSize: 13, outline: "none", fontVariantNumeric: "tabular-nums" }}
                />
              </span>
              <span style={{ width: 140, textAlign: "right", fontWeight: 600, color: r.annual < 0 ? "var(--red)" : r.annual > 0 ? "var(--green)" : "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}>{fmt(r.annual)}</span>
              <span style={{ width: 120, textAlign: "right", color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>{fmt(r.annual / 12)}</span>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", padding: "12px 22px", borderTop: "0.5px solid var(--separator-strong)", fontSize: 13, background: "var(--bg-card-2)" }}>
            <span style={{ flex: 1, fontWeight: 600, color: "var(--text-primary)" }}>合计</span>
            <span style={{ width: 140 }} />
            <span style={{ width: 110 }} />
            <span style={{ width: 140, textAlign: "right", fontWeight: 700, color: totalAnnual < 0 ? "var(--red)" : "var(--green)", fontVariantNumeric: "tabular-nums" }}>{fmt(totalAnnual)}</span>
            <span style={{ width: 120, textAlign: "right", fontWeight: 600, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>{fmt(totalAnnual / 12)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Interest() {
  const { data, update } = useVault();
  if (!data) return null;
  return (
    <InterestView
      dataset={data.dataset}
      onSetRate={(id, dec) => update((d) => { const a = d.dataset.accounts.find((x) => x.id === id); if (a) a.rate = dec; })}
    />
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ ...card, padding: "18px 22px" }}>
      <div style={{ fontSize: 12.5, color: "var(--text-secondary)", fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 25, fontWeight: 600, color: "var(--text-primary)", marginTop: 8, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}
