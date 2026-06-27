import { useVault } from "../lib/vault";
import { card } from "../ui";

export default function SettingsScreen() {
  const { data } = useVault();
  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "26px 24px 50px", animation: "fvFade .25s ease" }}>
      <Section title="工作台概况">
        <Row k="任务" v={`${data.tasks.length} 条`} />
        <Row k="笔记" v={`${data.notes.length} 篇`} />
        <Row k="代码片段" v={`${data.snippets.length} 个`} />
        <Row k="书签" v={`${data.links.length} 个`} />
        <Row k="生活集合 / 条目" v={`${data.collections.length} 集合 · ${data.lifeItems.length} 条`} />
        <Row k="密钥" v={`${data.secrets.length} 条`} />
        <Row k="发票 / 公司" v={`${(data.invoices ?? []).length} 张发票`} />
        <Row k="存储位置" v="本机浏览器（IndexedDB）" />
      </Section>

      <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", lineHeight: 1.7, marginTop: 8 }}>
        开发世界不单独上锁、也不单独备份。<strong>备份与恢复在大厅「设置 · 数据」里统一进行</strong>（一个文件含全家所有世界 + 设置）。数据只存本机、不联网。
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="fv-rise" style={{ ...card, padding: "18px 20px", marginBottom: 16 }}>
      <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13.5 }}>
      <span style={{ color: "var(--text-secondary)" }}>{k}</span>
      <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{v}</span>
    </div>
  );
}
