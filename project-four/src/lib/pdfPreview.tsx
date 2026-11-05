import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
// eslint-disable-next-line import/no-unresolved
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { dataUrlToBytes } from "./zip";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/** 把 PDF(data:application/pdf 或原始字节)的第一页画到 canvas 上。
 *  不用 <iframe src="data:...">——很多环境(包括不少桌面浏览器/Electron 配置)压根
 *  没启用内置 PDF 查看器插件，那样会一片空白且不报错。纯 JS 解析+画布渲染，
 *  哪都能显示，也完全离线、不发请求。 */
export function PdfPreview({ dataUrl, maxWidth = 900, maxHeight = 1200, style }: {
  dataUrl: string; maxWidth?: number; maxHeight?: number; style?: React.CSSProperties;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pages, setPages] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: ReturnType<import("pdfjs-dist").PDFPageProxy["render"]> | null = null;
    (async () => {
      setErr(null); setPages(0);
      try {
        const { bytes } = dataUrlToBytes(dataUrl);
        const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
        if (cancelled) return;
        setPages(doc.numPages);
        const page = await doc.getPage(1);
        if (cancelled) return;
        const v0 = page.getViewport({ scale: 1 });
        const scale = Math.min(maxWidth / v0.width, maxHeight / v0.height, 3);
        const viewport = page.getViewport({ scale: Math.max(scale, 0.1) });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = viewport.width; canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        renderTask = page.render({ canvasContext: ctx, viewport });
        await renderTask.promise;
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; try { renderTask?.cancel(); } catch { /* 组件卸载时中止渲染，忽略取消异常 */ } };
  }, [dataUrl, maxWidth, maxHeight]);

  if (err) return <div style={{ padding: "30px 16px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 12.5 }}>PDF 预览失败：{err}</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, ...style }}>
      <canvas ref={canvasRef} style={{ maxWidth: "100%", borderRadius: 8, boxShadow: "0 2px 10px rgba(0,0,0,0.12)", background: "#fff" }} />
      {pages > 1 && <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>共 {pages} 页，仅预览第 1 页</div>}
    </div>
  );
}
