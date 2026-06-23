import { useEffect, useMemo, useState } from "react";
import { useVault } from "../vault/VaultContext";
import type { DevWorld as DW } from "../vault/types";
import { sampleDevWorld } from "../data/devSample";
import { Segmented } from "../ui";
import Overview from "./dev/Overview";
import Tasks from "./dev/Tasks";
import Notes from "./dev/Notes";
import Snippets from "./dev/Snippets";
import Bookmarks from "./dev/Bookmarks";

type Tab = "overview" | "tasks" | "notes" | "snippets" | "links";

export default function DevWorld({ userName }: { userName: string }) {
  const { data, update } = useVault();
  const [tab, setTab] = useState<Tab>("overview");

  // 老金库首次进入：写入示例工作台内容
  useEffect(() => { if (data && !data.devWorld) update((d) => { d.devWorld = sampleDevWorld(); }); }, [data, update]);

  const fallback = useMemo(() => sampleDevWorld(), []);
  const dw: DW = data?.devWorld ?? fallback;
  const mut = (fn: (dw: DW) => void) => update((d) => { if (!d.devWorld) d.devWorld = sampleDevWorld(); fn(d.devWorld); });

  return (
    <div style={{ padding: "20px 28px 36px" }}>
      <div style={{ marginBottom: 18, maxWidth: 540 }}>
        <Segmented
          value={tab}
          onChange={(v) => setTab(v as Tab)}
          options={[
            { value: "overview", label: "概览" },
            { value: "tasks", label: "任务" },
            { value: "notes", label: "笔记" },
            { value: "snippets", label: "片段" },
            { value: "links", label: "书签" },
          ]}
        />
      </div>
      {tab === "overview" && <Overview dw={dw} mut={mut} userName={userName} goto={(t) => setTab(t)} />}
      {tab === "tasks" && <Tasks dw={dw} mut={mut} />}
      {tab === "notes" && <Notes dw={dw} mut={mut} />}
      {tab === "snippets" && <Snippets dw={dw} mut={mut} />}
      {tab === "links" && <Bookmarks dw={dw} mut={mut} />}
    </div>
  );
}
