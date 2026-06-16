import React, { useEffect, useState } from "react";
import { useLibrary } from "../lib/library";
import { useTheme } from "../lib/theme";
import { clearAll, requestPersist, storageInfo } from "../lib/store";
import { fmtSize } from "../lib/format";
import { Btn, card } from "../ui";

export default function Settings() {
  const { items } = useLibrary();
  const { theme, toggle } = useTheme();
  const images = items.filter((m) => m.kind === "image").length;
  const videos = items.filter((m) => m.kind === "video").length;
  const bytes = items.reduce((s, m) => s + (m.size || 0), 0);
  const [info, setInfo] = useState<{ usage: number; quota: number; persisted: boolean } | null>(null);
  const refreshInfo = () => storageInfo().then(setInfo);
  useEffect(() => { void refreshInfo(); }, [items.length]);

  const wipe = async () => {
    if (!confirm("确定删除本机全部照片/视频和相册吗？此操作不可恢复。")) return;
    await clearAll();
    location.reload();
  };

  return (
    <div style={{ padding: "24px 32px 40px", animation: "fvFade 0.3s ease", maxWidth: 720, display: "flex", flexDirection: "column", gap: 16 }}>
      <Section title="存储">
        <Row label="本地媒体" hint={`${images} 张照片 · ${videos} 个视频 · 约 ${fmtSize(bytes)}`}>{null}</Row>
        <Row label="存储用量" hint={info ? `${fmtSize(info.usage)} / ${fmtSize(info.quota)}（已用 / 可用）` : "查询中…"}>{null}</Row>
        <Row label="持久化存储" hint={info?.persisted ? "已开启：系统不会自动清理你的照片库" : "未开启：空间紧张时可能被系统清理，建议开启"}>
          {!info?.persisted && <Btn variant="ghost" onClick={async () => { await requestPersist(); refreshInfo(); }}>申请开启</Btn>}
        </Row>
        <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", paddingTop: 8 }}>所有照片/视频与缩略图都保存在本机（IndexedDB），不联网、不上传。海量/大视频库建议后续用桌面版（直接存磁盘）。</div>
      </Section>

      <Section title="外观">
        <Row label="主题" hint="浅色 / 深色"><Btn variant="ghost" onClick={toggle}>{theme === "light" ? "🌙 切换深色" : "☀️ 切换浅色"}</Btn></Row>
      </Section>

      <Section title="危险区">
        <Row label="清空全部影像" hint="删除本机所有照片/视频/相册，不可恢复"><Btn variant="danger" onClick={wipe}>全部删除</Btn></Row>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ ...card, padding: "18px 22px" }}>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}
function Row({ label, hint, children }: { label: string; hint?: string; children?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "8px 0" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{label}</div>
        {hint && <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 2 }}>{hint}</div>}
      </div>
      <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>{children}</div>
    </div>
  );
}
