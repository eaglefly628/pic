// 首次创建时的示例内容（可随时编辑/删除）。
import type { DevData } from "../types";
import { presetCollections } from "./lifeSample";

let _n = 0;
const id = (p: string) => p + "_" + (Date.now() + _n++).toString(36);
const day = (offset: number) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); };

export function sampleData(): DevData {
  const now = Date.now();
  const life = presetCollections();
  return {
    settings: { autoLockMin: 5 },
    updatedAt: now,
    collections: life.collections,
    lifeItems: life.items,
    tasks: [
      { id: id("t"), title: "梳理本周需求 & 排优先级", status: "doing", priority: "high", due: day(0), tags: ["计划"], createdAt: now, updatedAt: now },
      { id: id("t"), title: "Review 同事的 PR（支付模块）", status: "todo", priority: "high", due: day(1), tags: ["代码评审"], createdAt: now, updatedAt: now },
      { id: id("t"), title: "把 OneNote 旧笔记迁进「笔记」", status: "todo", priority: "med", tags: ["整理"], createdAt: now, updatedAt: now },
      { id: id("t"), title: "写本周日报 / 数据汇总", status: "todo", priority: "med", due: day(2), createdAt: now, updatedAt: now },
      { id: id("t"), title: "升级生产环境依赖并回归", status: "done", priority: "low", tags: ["运维"], createdAt: now, updatedAt: now },
    ],
    notes: [
      {
        id: id("n"), title: "本地开发环境 Checklist", category: "环境", tags: ["环境", "新机器"], pinned: true,
        body: "新机器一把梭：\n1. 安装 nvm + node 22\n2. 配置 git 用户名/邮箱、SSH key\n3. pnpm i 安装依赖\n4. 复制 .env.example → .env，填好密钥\n5. 启动：pnpm dev\n\n常踩的坑：端口被占 → lsof -i:5173 杀掉。",
        createdAt: now, updatedAt: now,
      },
      {
        id: id("n"), title: "周会要点（2026 上半年）", category: "工作", tags: ["会议"],
        body: "- 主线：把家庭系统扩成「我家里的一切」\n- 新世界：男主的开发世界（任务/笔记/片段/书签）\n- 待办：把散落在 OneNote 的资料按主题归类\n- 风险：第三方行情 API 免费额度受限，考虑自建小代理",
        createdAt: now, updatedAt: now,
      },
    ],
    snippets: [
      { id: id("s"), title: "查端口占用并杀进程", lang: "bash", code: "lsof -i :5173\nkill -9 <PID>", tags: ["bash"], createdAt: now, updatedAt: now },
      { id: id("s"), title: "Git 撤销上一次提交（保留改动）", lang: "bash", code: "git reset --soft HEAD~1", tags: ["git"], createdAt: now, updatedAt: now },
      { id: id("s"), title: "数组去重", lang: "ts", code: "const uniq = <T,>(a: T[]) => [...new Set(a)];", tags: ["ts"], createdAt: now, updatedAt: now },
    ],
    links: [
      { id: id("l"), title: "GitHub", url: "https://github.com", category: "代码", createdAt: now },
      { id: id("l"), title: "MDN Web Docs", url: "https://developer.mozilla.org", category: "文档", createdAt: now },
      { id: id("l"), title: "Can I use", url: "https://caniuse.com", category: "文档", createdAt: now },
      { id: id("l"), title: "Excalidraw 画图", url: "https://excalidraw.com", category: "工具", createdAt: now },
    ],
  };
}
