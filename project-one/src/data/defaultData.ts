// 默认数据库：优先使用仓库内提交的真实数据 history.json，否则回退示例数据。
import { sampleDataset } from "./sample";
import { sampleDevWorld } from "./devSample";
import type { Dataset } from "./types";
import type { VaultData } from "../vault/types";
import { DEFAULT_SETTINGS } from "../vault/types";

const real = import.meta.glob<{ default: Dataset }>("./history.json", { eager: true });
const found = Object.values(real)[0]?.default;

export const defaultDataset: Dataset = found ?? sampleDataset;

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

/** 首次创建金库时的初始内容 */
export function initialVaultData(): VaultData {
  return {
    dataset: clone(defaultDataset),
    passwords: [],
    infos: [],
    settings: { ...DEFAULT_SETTINGS },
    devWorld: sampleDevWorld(),
  };
}
