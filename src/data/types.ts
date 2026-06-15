// 统一数据模型 —— 真实数据（由 Excel 导入）与示例数据都遵循此结构。
// 应用的所有视图（总资产 / 趋势 / 构成 / 账户 / 快照）都从这里计算得出。

export type Category = "liquid" | "invest" | "estate" | "debt";

export interface AccountMeta {
  id: string;
  name: string;
  /** 分组：流动资金 / 投资理财 / 不动产 / 负债 */
  cat: Category;
  /** 展示用的细类型，如「储蓄/活期」「证券/股票」 */
  type: string;
  institution?: string;
  owner?: string;
  /** 图表与图例颜色 */
  color: string;
  /** 年化利率（可选，来自表格第二行） */
  rate?: number;
}

export interface Snapshot {
  /** ISO 日期 yyyy-mm-dd */
  date: string;
  /** 账户 id -> 当期余额（null 表示该期无记录） */
  balances: Record<string, number | null>;
  /** 来源：导入 / 手动 */
  source?: "import" | "manual";
}

export interface Dataset {
  vaultName: string;
  userName: string;
  accounts: AccountMeta[];
  /** 按时间升序排列的月度快照 */
  snapshots: Snapshot[];
  /** 是否为真实数据（true）或示例数据（false） */
  real?: boolean;
}
