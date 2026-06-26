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
    secrets: [
      { id: id("k"), title: "OpenAI API", kind: "api", tags: ["AI"], entries: [{ label: "API Key", value: "sk-demo-xxxxxxxxxxxxxxxx", secret: true }, { label: "Org", value: "org-demo", secret: false }], createdAt: now, updatedAt: now },
      { id: id("k"), title: "生产服务器", kind: "server", entries: [{ label: "Host", value: "10.0.0.12", secret: false }, { label: "User", value: "deploy", secret: false }, { label: "Password", value: "S3cr3t!demo", secret: true }, { label: "Port", value: "22", secret: false }], notes: "跳板机进，勿直连", createdAt: now, updatedAt: now },
      { id: id("k"), title: "主数据库", kind: "db", entries: [{ label: "连接串", value: "postgres://app:pw@db.internal:5432/main", secret: true }], createdAt: now, updatedAt: now },
    ],
    accounts: [
      // 工作账户：订阅 + 预付额度
      { id: id("a"), domain: "work", name: "Claude Code", category: "AI 模型", kind: "subscription", currency: "$", cycle: "month", price: 100, renewAt: day(24), login: "you@example.com", url: "https://claude.ai/code", note: "Max 订阅，主力用它写代码", createdAt: now, updatedAt: now },
      { id: id("a"), domain: "work", name: "DeepSeek", category: "AI 模型", kind: "prepaid", currency: "¥", balance: 12.4, balanceAt: now - 9 * 86400000, lowBalance: 20, login: "you@example.com", url: "https://platform.deepseek.com", note: "API 充值，余额快用完了", createdAt: now, updatedAt: now },
      { id: id("a"), domain: "work", name: "阿里云", category: "云服务", kind: "prepaid", currency: "¥", balance: 326.5, balanceAt: now - 20 * 86400000, expireAt: day(9), login: "138****8888", url: "https://ecs.console.aliyun.com", note: "有张代金券快过期，记得用", createdAt: now, updatedAt: now },
      { id: id("a"), domain: "work", name: "GitHub Copilot", category: "代码托管", kind: "subscription", currency: "$", cycle: "month", price: 10, renewAt: day(3), login: "your-handle", secret: "ghp_demoXXXXXXXXXXXXXXXX", url: "https://github.com", createdAt: now, updatedAt: now },
      // 生活储值卡
      { id: id("a"), domain: "life", name: "楼下川菜馆", category: "餐饮", kind: "prepaid", currency: "¥", balance: 380, balanceAt: now - 38 * 86400000, login: "138****8888", note: "充 500 送 50，菜还不错", createdAt: now, updatedAt: now },
      { id: id("a"), domain: "life", name: "Tony 理发店", category: "美发美容", kind: "prepaid", currency: "¥", balance: 1200, balanceAt: now - 60 * 86400000, expireAt: day(300), note: "剪发卡，别一直不去", createdAt: now, updatedAt: now },
      { id: id("a"), domain: "life", name: "小区门口洗车", category: "洗车养车", kind: "prepaid", currency: "¥", balance: 30, balanceAt: now - 15 * 86400000, lowBalance: 50, note: "一次 15，快不够了", createdAt: now, updatedAt: now },
      { id: id("a"), domain: "life", name: "动岚健身", category: "健身", kind: "prepaid", currency: "¥", expireAt: day(18), login: "会员卡 8842", note: "年卡，快到期了考虑续不续", createdAt: now, updatedAt: now },
    ],
    company: {
      name: "示例科技有限公司",
      taxId: "91110108MA00EXAMPLE",
      legalPerson: "张三",
      address: "北京市海淀区中关村大街 1 号",
      bank: "招商银行 北京中关村支行",
      bankAccount: "1109 0812 3456 7890",
      phone: "010-8888 8888",
      note: "开票用公司全称；专管员王会计。",
    },
    invoices: [
      { id: id("inv"), date: day(-1), amount: 88, currency: "¥", category: "差旅交通", purpose: "打车去机场", status: "pending", handler: "张三", createdAt: now, updatedAt: now },
      { id: id("inv"), date: day(-2), amount: 420, currency: "¥", category: "餐饮", purpose: "客户午餐（签约庆祝）", status: "pending", handler: "张三", seller: "海底捞", createdAt: now, updatedAt: now },
      { id: id("inv"), date: day(-5), amount: 1299, currency: "¥", category: "办公用品", purpose: "显示器一台", status: "submitted", handler: "张三", seller: "京东", invoiceNo: "88990011", tax: 149.6, createdAt: now, updatedAt: now },
      { id: id("inv"), date: day(-8), amount: 200, currency: "¥", category: "软件订阅", purpose: "团队协作工具月费", status: "paid", handler: "张三", seller: "某 SaaS", invoiceNo: "20260601", createdAt: now, updatedAt: now },
      { id: id("inv"), date: day(-20), amount: 553, currency: "¥", category: "差旅交通", purpose: "上海出差高铁往返", status: "paid", handler: "李四", invoiceNo: "01234567", createdAt: now, updatedAt: now },
      { id: id("inv"), date: day(-22), amount: 680, currency: "¥", category: "住宿", purpose: "出差酒店两晚", status: "pending", handler: "李四", createdAt: now, updatedAt: now },
    ],
  };
}
