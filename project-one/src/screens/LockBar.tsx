import type { LockInfo } from "../lib/compute";

/** 锁定期进度条：起始日 → 解锁日，还剩多久。只是提示，不会锁住任何操作。 */
export default function LockBar({ lock, compact }: { lock: LockInfo; compact?: boolean }) {
  const done = lock.unlocked;
  const col = done ? "var(--green)" : "var(--accent)";
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
        <span style={{ fontSize: compact ? 11.5 : 12.5, fontWeight: 600, color: col }}>{lock.label}</span>
        <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}>
          {lock.start} → {lock.end}
          {!done && `（共 ${lock.months >= 12 && lock.months % 12 === 0 ? `${lock.months / 12} 年` : `${lock.months} 个月`}）`}
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "var(--track)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${(lock.pct * 100).toFixed(1)}%`, background: col, borderRadius: 3, transition: "width .4s ease" }} />
      </div>
    </div>
  );
}
