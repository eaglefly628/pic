import React, { useMemo, useState } from "react";
import type { MediaItem } from "../types";
import { useLibrary } from "../lib/library";
import { hamming, isScreenshot } from "../lib/analyze";
import { fmtSize, dateLabel } from "../lib/format";
import { Btn, card, EmptyState } from "../ui";
import { IconTrash, IconPhoto } from "../icons";

const BLUR_T = 70; // 清晰度阈值（拉普拉斯方差），低于视为疑似模糊

function Thumb({ id, dim, badge, badgeColor }: { id: string; dim?: boolean; badge?: string; badgeColor?: string }) {
  const { thumbUrl } = useLibrary();
  const url = thumbUrl(id);
  return (
    <div style={{ position: "relative", aspectRatio: "1/1", borderRadius: 8, overflow: "hidden", background: "var(--fill-quaternary)", opacity: dim ? 0.55 : 1 }}>
      {url && <img src={url} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
      {badge && <span style={{ position: "absolute", left: 4, top: 4, fontSize: 9.5, fontWeight: 600, color: "#fff", background: badgeColor || "var(--accent)", padding: "1px 5px", borderRadius: 4 }}>{badge}</span>}
    </div>
  );
}

type Tab = "dup" | "similar" | "blur" | "shot" | "small";

export default function Cleanup() {
  const { items, removeMany, scanHashes, analyze } = useLibrary();
  const [tab, setTab] = useState<Tab>("dup");
  const [scan, setScan] = useState<{ done: number; total: number; label: string } | null>(null);

  const visible = useMemo(() => items.filter((m) => !m.private), [items]); // 私密照片不进入清理数据源
  const needAnalyze = useMemo(() => items.filter((m) => !m.hash || m.phash === undefined).length, [items]);

  const dupGroups = useMemo(() => {
    const m = new Map<string, MediaItem[]>();
    for (const it of visible) if (it.hash) (m.get(it.hash) ?? m.set(it.hash, []).get(it.hash)!).push(it);
    return [...m.values()].filter((g) => g.length > 1).map((g) => g.slice().sort((a, b) => a.addedAt - b.addedAt));
  }, [visible]);

  const similarGroups = useMemo(() => {
    const wp = visible.filter((m) => m.phash);
    const used = new Set<string>();
    const groups: MediaItem[][] = [];
    for (let i = 0; i < wp.length; i++) {
      if (used.has(wp[i].id)) continue;
      const g = [wp[i]]; used.add(wp[i].id);
      for (let j = i + 1; j < wp.length; j++) {
        if (used.has(wp[j].id)) continue;
        if (hamming(wp[i].phash, wp[j].phash) <= 8) { g.push(wp[j]); used.add(wp[j].id); }
      }
      if (g.length > 1) groups.push(g.sort((a, b) => a.addedAt - b.addedAt));
    }
    return groups;
  }, [visible]);

  const blurry = useMemo(() => visible.filter((m) => m.kind === "image" && m.blur !== undefined && m.blur < BLUR_T).sort((a, b) => (a.blur || 0) - (b.blur || 0)), [visible]);
  const shots = useMemo(() => visible.filter((m) => isScreenshot(m)), [visible]);
  const small = useMemo(() => visible.filter((m) => m.kind === "image" && ((m.width && m.height && m.width < 300 && m.height < 300) || m.size < 50 * 1024)), [visible]);

  const groupDeletable = (gs: MediaItem[][]) => gs.reduce((n, g) => n + g.length - 1, 0);

  const doAnalyze = async () => {
    setScan({ done: 0, total: needAnalyze, label: "指纹" });
    await scanHashes((d, t) => setScan({ done: d, total: t, label: "内容指纹" }));
    await analyze((d, t) => setScan({ done: d, total: t, label: "清晰度/相似度" }));
    setScan(null);
  };
  const delGroups = async (gs: MediaItem[][], what: string) => {
    const ids = gs.flatMap((g) => g.slice(1).map((x) => x.id));
    if (ids.length && confirm(`将删除 ${ids.length} 张${what}（每组保留最早导入的 1 张），不可恢复。继续？`)) await removeMany(ids);
  };
  const delFlat = async (list: MediaItem[], what: string) => {
    const ids = list.map((x) => x.id);
    if (ids.length && confirm(`将删除 ${ids.length} 张「${what}」，不可恢复。请确认已核对。继续？`)) await removeMany(ids);
  };

  const TABS: { k: Tab; label: string; n: number }[] = [
    { k: "dup", label: "完全重复", n: groupDeletable(dupGroups) },
    { k: "similar", label: "相似/近重复", n: groupDeletable(similarGroups) },
    { k: "blur", label: "疑似模糊", n: blurry.length },
    { k: "shot", label: "疑似截屏", n: shots.length },
    { k: "small", label: "过小/无用", n: small.length },
  ];

  return (
    <div style={{ padding: "20px 32px 40px", animation: "fvFade 0.3s ease" }}>
      {needAnalyze > 0 && (
        <div style={{ ...card, padding: "14px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ flex: 1, fontSize: 13, color: "var(--text-secondary)" }}>
            有 {needAnalyze} 张待分析（指纹 + 清晰度 + 相似度）。{scan && `${scan.label} ${scan.done}/${scan.total}…`}
          </div>
          <Btn onClick={doAnalyze} disabled={!!scan}>{scan ? "分析中…" : "智能分析"}</Btn>
        </div>
      )}

      <div style={{ display: "flex", gap: 2, background: "var(--fill-quaternary)", borderRadius: 8, padding: 2, marginBottom: 16, width: "fit-content", flexWrap: "wrap" }}>
        {TABS.map((t) => <button key={t.k} onClick={() => setTab(t.k)} style={seg(tab === t.k)}>{t.label}（{t.n}）</button>)}
      </div>

      {tab === "dup" && <GroupView groups={dupGroups} empty={needAnalyze ? "请先「智能分析」再查重" : "没有完全重复 🎉"} onDelete={() => delGroups(dupGroups, "重复照片")} note="按内容指纹完全相同" />}
      {tab === "similar" && <GroupView groups={similarGroups} empty={needAnalyze ? "请先「智能分析」" : "没有发现相似照片"} onDelete={() => delGroups(similarGroups, "相似照片")} note="画面高度相似（如连拍、轻微编辑）" />}
      {tab === "blur" && <FlatView list={blurry} empty="没有发现明显模糊的照片" onDelete={() => delFlat(blurry, "疑似模糊")} render={(m) => `清晰度 ${m.blur}`} />}
      {tab === "shot" && <FlatView list={shots} empty="没有发现疑似截屏" onDelete={() => delFlat(shots, "疑似截屏")} render={(m) => `${m.width}×${m.height}`} />}
      {tab === "small" && <FlatView list={small} empty="没有过小/无用的小图" onDelete={() => delFlat(small, "过小/无用")} render={(m) => `${m.width}×${m.height} · ${fmtSize(m.size)}`} />}
    </div>
  );
}

function GroupView({ groups, empty, onDelete, note }: { groups: MediaItem[][]; empty: string; onDelete: () => void; note: string }) {
  if (groups.length === 0) return <EmptyState icon={<IconPhoto size={26} stroke="var(--green)" />} text={empty} />;
  const deletable = groups.reduce((n, g) => n + g.length - 1, 0);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{groups.length} 组 · 可删除 {deletable} 张（每组保留最早导入的 1 张）· {note}</div>
        <div style={{ flex: 1 }} />
        <Btn variant="danger" onClick={onDelete}><IconTrash stroke="var(--red)" />删除全部</Btn>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {groups.map((g, gi) => (
          <div key={gi} style={{ ...card, padding: "12px 14px" }}>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 8 }}>{g.length} 张 · {dateLabel(g[0].takenAt)}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(96px,1fr))", gap: 8 }}>
              {g.map((it, i) => <Thumb key={it.id} id={it.id} dim={i > 0} badge={i === 0 ? "保留" : "删除"} badgeColor={i === 0 ? "var(--green)" : "var(--red)"} />)}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function FlatView({ list, empty, onDelete, render }: { list: MediaItem[]; empty: string; onDelete: () => void; render: (m: MediaItem) => string }) {
  if (list.length === 0) return <EmptyState icon={<IconPhoto size={26} stroke="var(--text-tertiary)" />} text={empty} />;
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{list.length} 张 · 这是<strong>启发式判断</strong>，删除前请核对</div>
        <div style={{ flex: 1 }} />
        <Btn variant="danger" onClick={onDelete}><IconTrash stroke="var(--red)" />全部删除</Btn>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))", gap: 10 }}>
        {list.map((m) => <div key={m.id} title={`${m.name} · ${render(m)} · ${dateLabel(m.takenAt)}`}><Thumb id={m.id} badge={render(m)} /></div>)}
      </div>
    </>
  );
}

function seg(active: boolean): React.CSSProperties {
  return {
    border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 500, padding: "5px 12px", borderRadius: 6, whiteSpace: "nowrap",
    background: active ? "var(--bg-card)" : "transparent", color: active ? "var(--text-primary)" : "var(--text-secondary)",
    boxShadow: active ? "0 1px 2px rgba(0,0,0,0.12)" : "none",
  };
}
