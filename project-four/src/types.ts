// 「男主的开发世界」数据模型：个人工作台（任务 / 笔记 / 代码片段 / 书签）。
export type TaskStatus = "todo" | "doing" | "done";
export type TaskPriority = "low" | "med" | "high";

export interface DevTask {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due?: string;        // YYYY-MM-DD
  dueTime?: string;    // HH:MM，可选的到期具体时间（不填就只到"天"）
  tags?: string[];
  note?: string;
  createdAt: number;
  updatedAt: number;
}
export interface DevNote {
  id: string;
  title: string;
  body: string;        // 纯文本 / Markdown
  category?: string;
  tags?: string[];
  pinned?: boolean;
  createdAt: number;
  updatedAt: number;
}
export interface DevSnippet {
  id: string;
  title: string;
  lang?: string;
  code: string;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
}
export interface DevLink {
  id: string;
  title: string;
  url: string;
  category?: string;
  createdAt: number;
}

export interface DevSettings {
  autoLockMin: number; // 闲置自动锁定（分钟），0 = 不自动锁
}

// 开发密钥库：API key / 服务器 / 数据库 / 环境变量
export type SecretKind = "api" | "server" | "db" | "env" | "other";
export interface SecretEntry {
  label: string;
  value: string;
  secret?: boolean;   // 是否打码（默认值字段打码）
}
export interface DevSecret {
  id: string;
  title: string;
  kind: SecretKind;
  entries: SecretEntry[];
  tags?: string[];
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

// ── 账户 · 余额：工作账户（订阅/预付额度）+ 生活储值卡 ──────────────
export type AccountDomain = "work" | "life";   // 工作账户 / 生活储值卡
export type AccountKind = "subscription" | "prepaid"; // 订阅型 / 预付余额型
export type AccountCycle = "month" | "year";   // 订阅续费周期

export interface Account {
  id: string;
  domain: AccountDomain;
  name: string;          // Claude Code / 阿里云 / 那家川菜馆
  category?: string;     // AI 模型 / 云服务 / 餐饮 …（自由文本，带建议）
  kind: AccountKind;
  currency: string;      // ¥ / $ / € …
  balance?: number;      // 当前余额
  balanceAt?: number;    // 余额更新时间
  lowBalance?: number;   // 预付：低余额预警阈值
  // 订阅型
  cycle?: AccountCycle;  // 月 / 年
  price?: number;        // 每期费用
  renewAt?: string;      // YYYY-MM-DD 下次续费日
  // 通用 / 生活卡
  expireAt?: string;     // YYYY-MM-DD 有效期 / 到期日
  // 账户信息
  login?: string;        // 登录账号 / 卡号 / 绑定手机
  secret?: string;       // 密码 / Key（打码 + 复制）
  url?: string;          // 控制台 / 官网链接（工作）
  phone?: string;        // 商家电话（生活）
  note?: string;
  createdAt: number;
  updatedAt: number;
}

// ── 看球 · 下注台账 ───────────────────────────────────────────
export type BetSport = "football" | "basketball" | "other";
export type BetStatus = "pending" | "won" | "lost" | "void"; // 待结算 / 赢 / 输 / 取消(退还)

/** 一笔下注：压了哪支队、赔率多少、压了多少钱，结算后算盈亏。纯手填——没人能替你记你押了什么。 */
export interface Bet {
  id: string;
  sport: BetSport;
  league?: string;       // fifa.world / nba …（用于关联赛事面板）
  match: string;         // 比赛，如「阿根廷 vs 法国」自由文本
  pick: string;          // 压哪个：队名或玩法（如「阿根廷」「大 2.5」）
  odds: number;          // 十进制赔率，如 2.10
  stake: number;         // 压了多少钱（本金）
  currency?: string;     // 默认 ¥
  status: BetStatus;
  eventDate?: string;    // YYYY-MM-DD 比赛日（可选）
  note?: string;
  createdAt: number;
  updatedAt: number;
}

// ── 意外资金池 · 花光计划（只记开销，把意外之财一池一池花掉） ──────
/** 一个意外资金池（赌球赢的 / 奖金 / 回款…），目标是把它花完。 */
export interface FundPool {
  id: string;
  name: string;        // 池子名（赌球赢的钱 / 年终奖 …）
  amount: number;      // 这池有多少钱（意外之财）
  targetDate?: string; // YYYY-MM-DD 打算花完的日期（规划）
  createdAt: number;
}
/** 一笔开销：属于某个资金池，花了多少、买了什么。没有收入——只往外花。 */
export interface SpendItem {
  id: string;
  poolId: string;      // 归属哪个资金池
  amount: number;      // 花了多少（正数）
  label: string;       // 买了什么
  date: string;        // YYYY-MM-DD
  createdAt: number;
}
export interface SpendLog {
  pools: FundPool[];
  items: SpendItem[];
  pot?: number;        // @deprecated 旧单池格式，迁移用
  title?: string;      // @deprecated
}

// ── 爱车 · 保养 / 油耗 / 里程 ────────────────────────────────────
export interface Vehicle {
  id: string;
  name: string;          // 车辆昵称，如「Model 3」
  plate?: string;        // 车牌
  note?: string;
  createdAt: number;
}
export type VehicleLogType = "fuel" | "maintenance" | "other";
/** 一条用车记录：加油(里程+升数+花费，算油耗) / 保养(项目+花费) / 其它。 */
export interface VehicleLog {
  id: string;
  vehicleId: string;
  type: VehicleLogType;
  date: string;           // YYYY-MM-DD
  odometer?: number;      // 里程表读数(km)
  liters?: number;        // 加油：升数
  cost?: number;          // 花费
  label?: string;         // 保养项目 / 简短标题
  note?: string;
  createdAt: number;
}
export interface VehicleData { vehicles: Vehicle[]; logs: VehicleLog[] }

// ── 健身 · 体重管理 ──────────────────────────────────────────────
export interface WeightEntry {
  id: string;
  date: string;            // YYYY-MM-DD
  weight: number;          // kg
  bodyFat?: number;        // 体脂率 %
  note?: string;
  createdAt: number;
}
export interface FitnessGoal {
  heightCm?: number;       // 身高(算 BMI)
  targetWeight?: number;   // 目标体重 kg
  targetDate?: string;     // YYYY-MM-DD 目标日期
}
export interface FitnessData { goal?: FitnessGoal; entries: WeightEntry[] }

// ── 健康记录 · 血压 / 血脂 / 饮食 ─────────────────────────────────
/** 血压：收缩压(高压)/舒张压(低压)/脉搏。 */
export interface BPReading {
  id: string;
  date: string;
  systolic: number;
  diastolic: number;
  pulse?: number;
  note?: string;
  createdAt: number;
}
/** 血脂四项，单位 mmol/L。 */
export interface LipidReading {
  id: string;
  date: string;
  tc?: number;    // 总胆固醇
  tg?: number;    // 甘油三酯
  ldl?: number;   // 低密度脂蛋白胆固醇
  hdl?: number;   // 高密度脂蛋白胆固醇
  note?: string;
  createdAt: number;
}
export type MealType = "早餐" | "午餐" | "晚餐" | "加餐";
export interface DietEntry {
  id: string;
  date: string;
  meal: MealType;
  items: string;   // 吃了什么，自由文本
  note?: string;
  createdAt: number;
}
export interface HealthData { bp: BPReading[]; lipids: LipidReading[]; diet: DietEntry[] }

// ── 旅游计划 · 世界景点清单 + 示意地图 ─────────────────────────────
export type TravelStatus = "wishlist" | "planned" | "done";
export interface TravelSpot {
  id: string;
  name: string;
  country: string;
  continent: string;
  lat?: number;
  lon?: number;
  status: TravelStatus;
  visitDate?: string;   // YYYY-MM-DD
  note?: string;
  createdAt: number;
}
export interface TravelData { spots: TravelSpot[] }

// ── 看球 · 世界杯淘汰赛数据模型（大小球 / 波胆 统计） ─────────────
export interface KnockoutMatch {
  id: string;
  round: string;        // R32 / R16 / QF / SF / F
  date?: string;        // YYYY-MM-DD
  home: string;
  away: string;
  hg: number;           // 90 分钟主队进球（大小球/波胆按常规时间算）
  ag: number;           // 90 分钟客队进球
  aet?: boolean;        // 进加时
  pens?: boolean;       // 点球大战
  note?: string;
}
/** 世界杯淘汰赛分析所需的可调参数（比赛数据 + 历史先验 + 下注计划）。 */
export interface WcModel {
  matches?: KnockoutMatch[];   // 未设置时用内置的 2026 R32 真实数据
  priorYears?: number[];       // 选中的历届（作为先验来源）
  priorLambda?: number;        // 历史先验 λ（不设时由选中历届池化得到）
  priorWeight?: number;        // 先验等效场次（锚定强度）
  tilt?: number;               // 均值回归微调强度 0..1（默认 0=关）
  useReg?: boolean;            // 用“逐届回归”预测值当基准
  stakeTotal?: number;         // 波胆总筹码
  picks?: string[];            // 选中的比分（如 "1-1"）
  odds?: Record<string, number>; // 各比分赔率（手填）
  evMode?: "even" | "kelly";   // 筹码分配：均分 / 凯利
  matchOdds?: Record<string, MatchOdds>; // 各场盘口（按 fixture id）
}

/** 一场比赛录入的盘口（十进制/欧赔）。 */
export interface MatchOdds {
  ou?: Record<string, { o?: number; u?: number }>; // 盘口线 "2.5" -> { 大, 小 }
  win?: { h?: number; d?: number; a?: number };     // 独赢 主/和/客
  cs?: Record<string, number>;                       // 波胆 "主-客" -> 赔率
}

/** 解锁后内存中的完整数据 */
export interface DevData {
  tasks: DevTask[];
  notes: DevNote[];
  snippets: DevSnippet[];
  links: DevLink[];
  collections: CollectionDef[];   // 生活：自定义集合（数据格式由用户自己定）
  lifeItems: LifeItem[];          // 生活：各集合下的条目
  secrets: DevSecret[];           // 开发密钥库
  accounts: Account[];            // 账户 · 余额（工作账户 + 生活储值卡）
  company: CompanyInfo;           // 公司资料（单家）
  invoices: Invoice[];            // 公司：发票 / 报销记录
  bets: Bet[];                    // 看球：下注台账
  wc?: WcModel;                   // 看球：世界杯淘汰赛数据模型
  spend?: SpendLog;               // 临时小记账（只记开销）
  vehicle?: VehicleData;          // 爱车：保养 / 油耗 / 里程
  fitness?: FitnessData;          // 健身：体重管理
  health?: HealthData;            // 健康记录：血压 / 血脂 / 饮食
  travel?: TravelData;            // 旅游计划：世界景点清单 + 地图
  settings: DevSettings;
  updatedAt: number;
}

// ── 公司 · 发票报销 ───────────────────────────────────────────
/** 公司基本资料（一家公司，自由填） */
export interface CompanyInfo {
  name?: string;         // 公司名称
  taxId?: string;        // 统一社会信用代码 / 税号
  legalPerson?: string;  // 法人
  address?: string;      // 注册地址
  bank?: string;         // 开户行
  bankAccount?: string;  // 银行账号
  phone?: string;        // 联系电话
  note?: string;
}

/** 一张发票：核心是图片，按月份归档、按类别归类 */
export interface Invoice {
  id: string;
  date: string;       // YYYY-MM-DD 归属日期（默认上传当天），用于按月归档
  photo?: string;     // 发票图片（压缩后的 data URL，随保险库加密）—— 核心
  category?: string;  // 归类：差旅交通 / 餐饮 / 办公用品 …
  note?: string;      // 备注 / 简短标题（选填）
  createdAt: number;
  updatedAt: number;
}

// ── 生活 · 通用「集合 + 字段 + 条目」数据格式 ──────────────────
export type FieldType =
  | "text" | "longtext" | "number" | "money" | "rating"
  | "date" | "select" | "tags" | "phone" | "url" | "location" | "bool" | "email";

export interface FieldDef {
  id: string;
  label: string;
  type: FieldType;
  secret?: boolean;     // 私密：列表/详情里打码显示
  unit?: string;        // number / money 的单位（如 ¥、kg）
  options?: string[];   // select 的可选项
}

export interface CollectionDef {
  id: string;
  name: string;
  emoji: string;
  color: string;
  fields: FieldDef[];   // 这个集合的字段模板 = 它的数据格式
  createdAt: number;
  updatedAt: number;
}

/** 字段取值：按类型分别为 string / number / boolean / string[] */
export type FieldValue = string | number | boolean | string[] | undefined;

export interface LifeItem {
  id: string;
  collectionId: string;
  title: string;
  favorite?: boolean;
  rating?: number;                    // 0–5
  tags?: string[];
  notes?: string;
  values: Record<string, FieldValue>; // fieldId → 值
  createdAt: number;
  updatedAt: number;
}
