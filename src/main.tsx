import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import { sampleDataset } from "./data/sample";
import type { Dataset } from "./data/types";

// 若本机存在由 Excel 导入生成的 history.json（真实数据，不进仓库），则优先使用；
// 否则回退到脱敏示例数据。import.meta.glob 在文件缺失时返回空对象，不会报错。
const real = import.meta.glob<{ default: Dataset }>("./data/history.json", { eager: true });
const found = Object.values(real)[0]?.default;
const dataset: Dataset = found ?? sampleDataset;

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App dataset={dataset} />
  </React.StrictMode>
);
