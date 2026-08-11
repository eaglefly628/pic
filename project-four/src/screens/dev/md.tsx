// 零依赖的精简 Markdown 渲染：标题/列表/引用/代码块/分隔线/粗体/斜体/行内代码/链接。
import React from "react";

const codeStyle: React.CSSProperties = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "0.88em", background: "var(--fill-q)", border: "0.5px solid var(--separator)", borderRadius: 5, padding: "1px 5px" };

// 只放行 http/https/mailto（容忍前导空白、大小写不敏感）；javascript:/data: 等一律不渲染成链接，防存储型 XSS
const safeHref = (u: string) => (/^\s*(https?:\/\/|mailto:)/i.test(u) ? u.trim() : null);

function inline(s: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/g;
  let last = 0, k = 0, m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) nodes.push(s.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("`")) nodes.push(<code key={k++} style={codeStyle}>{tok.slice(1, -1)}</code>);
    else if (tok.startsWith("**")) nodes.push(<strong key={k++}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("*")) nodes.push(<em key={k++}>{tok.slice(1, -1)}</em>);
    else { const mm = tok.match(/\[([^\]]+)\]\(([^)]+)\)/); if (mm) { const href = safeHref(mm[2]); nodes.push(href ? <a key={k++} href={href} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>{mm[1]}</a> : tok); } }
    last = m.index + tok.length;
  }
  if (last < s.length) nodes.push(s.slice(last));
  return nodes;
}

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: React.ReactNode[] = [];
  let i = 0, k = 0;
  const H = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;
  const hSize = [21, 18, 16, 14.5, 13.5, 13];
  while (i < lines.length) {
    const line = lines[i];
    // 代码块
    if (/^```/.test(line)) {
      const buf: string[] = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(<pre key={k++} style={{ ...codeStyle, display: "block", padding: "10px 12px", borderRadius: 8, overflow: "auto", whiteSpace: "pre", margin: "8px 0", lineHeight: 1.6 }}>{buf.join("\n")}</pre>);
      continue;
    }
    // 标题
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { const lv = h[1].length - 1; out.push(React.createElement(H[lv], { key: k++, style: { fontSize: hSize[lv], fontWeight: 700, margin: "14px 0 6px", lineHeight: 1.3 } }, inline(h[2]))); i++; continue; }
    // 分隔线
    if (/^(---|\*\*\*|___)\s*$/.test(line)) { out.push(<hr key={k++} style={{ border: "none", borderTop: "0.5px solid var(--separator)", margin: "14px 0" }} />); i++; continue; }
    // 引用
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ""));
      out.push(<blockquote key={k++} style={{ borderLeft: "3px solid var(--separator)", padding: "2px 0 2px 12px", margin: "8px 0", color: "var(--text-secondary)" }}>{inline(buf.join(" "))}</blockquote>);
      continue;
    }
    // 无序列表
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) items.push(<li key={items.length} style={{ margin: "2px 0" }}>{inline(lines[i++].replace(/^\s*[-*+]\s+/, ""))}</li>);
      out.push(<ul key={k++} style={{ margin: "6px 0", paddingLeft: 22 }}>{items}</ul>);
      continue;
    }
    // 有序列表
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) items.push(<li key={items.length} style={{ margin: "2px 0" }}>{inline(lines[i++].replace(/^\s*\d+\.\s+/, ""))}</li>);
      out.push(<ol key={k++} style={{ margin: "6px 0", paddingLeft: 24 }}>{items}</ol>);
      continue;
    }
    // 空行
    if (!line.trim()) { i++; continue; }
    // 段落（合并连续行）
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6})\s|^```|^>\s?|^\s*[-*+]\s|^\s*\d+\.\s|^(---|\*\*\*|___)\s*$/.test(lines[i])) buf.push(lines[i++]);
    out.push(<p key={k++} style={{ margin: "6px 0", lineHeight: 1.7 }}>{buf.map((b, j) => <React.Fragment key={j}>{j > 0 && <br />}{inline(b)}</React.Fragment>)}</p>);
  }
  return <div style={{ fontSize: 13.5, color: "var(--text-primary)" }}>{out}</div>;
}
