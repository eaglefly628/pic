import { useMemo } from "react";
import type { MediaItem } from "../types";
import { useLibrary } from "../lib/library";
import { groupByMonth } from "../lib/format";
import { MediaGrid } from "../components/Media";
import { EmptyState, Btn } from "../ui";
import { IconPhoto } from "../icons";

export default function Gallery({ onOpen, goImport }: { onOpen: (list: MediaItem[], i: number) => void; goImport: () => void }) {
  const { items } = useLibrary();
  const visible = useMemo(() => items.filter((m) => !m.private), [items]);
  const groups = useMemo(() => groupByMonth(visible), [visible]);

  if (visible.length === 0) {
    return (
      <div style={{ padding: "40px 32px" }}>
        <EmptyState icon={<IconPhoto size={30} stroke="var(--text-tertiary)" />} text="还没有照片/视频" action={<Btn variant="soft" onClick={goImport}>导入照片 / 视频</Btn>} />
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 32px 40px", animation: "fvFade 0.3s ease" }}>
      {groups.map((g) => (
        <div key={g.key} style={{ marginBottom: 26 }}>
          <div style={{ position: "sticky", top: 0, zIndex: 1, background: "var(--bg-content)", padding: "4px 0 10px", fontSize: 14, fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "baseline", gap: 10 }}>
            {g.label}<span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-tertiary)" }}>{g.items.length} 项</span>
          </div>
          <MediaGrid items={g.items} onOpenIndex={(li) => onOpen(visible, visible.findIndex((x) => x.id === g.items[li].id))} />
        </div>
      ))}
    </div>
  );
}
