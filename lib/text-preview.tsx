import { marked } from "marked";

/** 放进 sandbox iframe 的页面外壳：不允许脚本，与本站隔离 */
const sandboxDoc = (body: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Hiragino Sans","Noto Sans CJK SC",sans-serif;line-height:1.7;max-width:860px;margin:0 auto;padding:20px;color:#1c1f24;background:#fff}
img{max-width:100%}pre{background:#f4f5f7;padding:12px;overflow:auto;border-radius:6px}code{background:#f4f5f7;padding:1px 4px;border-radius:4px}
table{border-collapse:collapse}td,th{border:1px solid #ddd;padding:4px 8px}blockquote{margin:0;padding-left:12px;border-left:4px solid #ddd;color:#555}</style>
</head><body>${body}</body></html>`;

/** 文本类文件的预览：TXT/CSV 原样显示；MD 渲染成网页；HTML 在隔离的框里显示 */
export async function TextPreview({
  kind,
  text,
  truncated,
  title,
  truncatedText,
}: {
  kind: "text" | "markdown" | "html";
  text: string;
  truncated: boolean;
  title: string;
  truncatedText: string;
}) {
  const note = truncated ? <p className="muted">{truncatedText}</p> : null;
  if (kind === "text") {
    return (
      <>
        {note}
        <pre className="text-view">{text}</pre>
      </>
    );
  }
  const html = kind === "markdown" ? sandboxDoc(await marked.parse(text)) : text;
  return (
    <>
      {note}
      {/* sandbox 不带任何权限：不执行脚本、不能提交表单、与本站完全隔离 */}
      <iframe className="preview" sandbox="" srcDoc={html} title={title} />
    </>
  );
}
