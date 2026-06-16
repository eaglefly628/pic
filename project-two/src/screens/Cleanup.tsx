import React, { useMemo, useState } from "react";
import type { MediaItem } from "../types";
import { useLibrary } from "../lib/library";
import { fmtSize, dateLabel } from "../lib/format";
import { Btn, card, EmptyState } from "../ui";
import { IconTrash, IconPhoto } from "../icons";

function Thumb({ id, dim }: { id: string; dim?: boolean }) {
  const { thumbUrl } = useLibrary();
  const url = thumbUrl(id);
  return (
    <div style={{ aspectRatio: "1/1", borderRadius: 8, overflow: "hidden", background: "var(--fill-quaternary)", opacity: dim ? 0.5 : 1 }}>
      {url && <img src={url} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
    </div>
  );
}

export default function Cleanup() {
  const { items, removeMany, scanHashes } = useLibrary();
  const [tab, setTab] = useState<"dup" | "junk">("dup");
  const [scan, setScan] = useState<{ done: number; total: number } | null>(null);

  const needScan = useMemo(() => items.filter((m) => !m.hash).length, [items]);

  const dupGroups = useMemo(() => {
    const m = new Map<string, MediaItem[]>();
    for (const it of items) if (it.hash) (m.get(it.hash) ?? m.set(it.hash, []).get(it.hash)!).push(it);
    return [...m.values()]
      .filter((g) => g.length > 1)
      .map((g) => g.slice().sort((a, b) => a.addedAt - b.addedAt)); // 最早导入在前（保留）
  }, [items]);
  const dupDeletable = dupGroups.reduce((n, g) => n + (g.length - 1), 0);

  const junk = useMemo(
    () => items.filter((m) => m.kind === "image" && ((m.width && m.height && m.width < 300 && m.height < 300) || m.size < 50 * 1024)),
    [items]
  );

  const doScan = async () => {
    setScan({ done: 0, total: needScan });
    await scanHashes((done, total) => setScan({ done, total }));
    setScan(null);
  };
  const delDuplicates = async () => {
    const ids = dupGroups.flatMap((g) => g.slice(1).map((x) => x.id));
    if (ids.length && confirm(`将删除 ${ids.length} 张重复照片（每组保留最早导入的 1 张），不可恢复。继续？`)) await removeMany(ids);
  };
  const delJunk = async () => {
    const ids = junk.map((x) => x.id);
    if (ids.length && confirm(`将删除 ${ids.length} 张「可能无用」的小图，不可恢复。继续？`)) await removeMany(ids);
  };

  return (
    <div style={{ padding: "20px 32px 40px", animation: "fvFade 0.3s ease" }}>
      {needScan > 0 && (
        <div style={{ ...card, padding: "14px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ flex: 1, fontSize: 13, color: "var(--text-secondary)" }}>
            有 {needScan} 张尚未计算内容指纹（去重需要）。{scan && `扫描中 ${scan.done}/${scan.total}…`}
          </div>
          <Btn onClick={doScan} disabled={!!scan}>{scan ? "扫描中…" : "扫描指纹"}</Btn>
        </div>
      )}

      <div style={{ display: "flex", gap: 2, background: "var(--fill-quaternary)", borderRadius: 8, padding: 2, marginBottom: 16, width: "fit-content" }}>
        <button onClick={() => setTab("dup")} style={seg(tab === "dup")}>重复（{dupDeletable}）</button>
        <button onClick={() => setTab("junk")} style={seg(tab === "junk")}>可能无用（{junk.length}）</button>
      </div>

      {tab === "dup" ? (
        dupGroups.length === 0 ? (
          <EmptyState icon={<IconPhoto size={26} stroke="var(--green)" />} text={needScan ? "请先扫描指纹后再查重" : "没有发现重复照片 🎉"} />
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{dupGroups.length} 组重复，共可删除 {dupDeletable} 张（每组保留最早导入的 1 张）</div>
              <div style={{ flex: 1 }} />
              <Btn variant="danger" onClick={delDuplicates}><IconTrash stroke="var(--red)" />删除全部重复</Btn>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {dupGroups.map((g, gi) => (
                <div key={gi} style={{ ...card, padding: "12px 14px" }}>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 8 }}>{g.length} 张相同 · {g[0].name} · {fmtSize(g[0].size)}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(96px,1fr))", gap: 8 }}>
                    {g.map((it, i) => (
                      <div key={it.id} style={{ position: "relative" }}>
                        <Thumb id={it.id} dim={i > 0} />
                        <span style={{ position: "absolute", left: 4, top: 4, fontSize: 9.5, fontWeight: 600, color: "#fff", background: i === 0 ? "var(--green)" : "var(--red)", padding: "1px 5px", borderRadius: 4 }}>{i === 0 ? "保留" : "删除"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )
      ) : junk.length === 0 ? (
        <EmptyState icon={<IconPhoto size={26} stroke="var(--text-tertiary)" />} text="没有发现明显无用的小图" />
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{junk.length} 张疑似无用（很小的图片，常是图标/表情/截图缩略）。请先核对再删。</div>
            <div style={{ flex: 1 }} />
            <Btn variant="danger" onClick={delJunk}><IconTrash stroke="var(--red)" />全部删除</Btn>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(110px,1fr))", gap: 10 }}>
            {junk.map((it) => (
              <div key={it.id} title={`${it.name} · ${it.width}×${it.height} · ${fmtSize(it.size)} · ${dateLabel(it.takenAt)}`}><Thumb id={it.id} /></div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function seg(active: boolean): React.CSSProperties {
  return {
    border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 500, padding: "5px 14px", borderRadius: 6, whiteSpace: "nowrap",
    background: active ? "var(--bg-card)" : "transparent", color: active ? "var(--text-primary)" : "var(--text-secondary)",
    boxShadow: active ? "0 1px 2px rgba(0,0,0,0.12)" : "none",
  };
}
