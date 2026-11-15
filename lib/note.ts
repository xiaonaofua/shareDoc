/**
 * 笔记的样式。编辑器里（作用域 .note-body）和保存出来的 HTML 文件（作用域 body.note）共用同一套，
 * 这样编辑时看到的样子和访问者看到的完全一样。
 */
const CHECK_SVG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath d='M5 10.5l3.2 3.2L15 7' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")";

export function noteCss(s: string) {
  return `
${s}{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue","PingFang SC","Hiragino Sans","Noto Sans CJK SC",sans-serif;font-size:17px;line-height:1.55;color:#1c1c1e;background:#fff;word-wrap:break-word}
${s} *{font-family:inherit !important;font-size:inherit}
${s} h1{font-size:28px;font-weight:700;line-height:1.25;margin:.3em 0 .4em}
${s} h2{font-size:21px;font-weight:600;line-height:1.3;margin:.8em 0 .3em}
${s} h3{font-size:18px;font-weight:600;margin:.8em 0 .3em}
${s} p{margin:0 0 .35em}
${s} ul,${s} ol{margin:.2em 0 .5em;padding-left:1.6em}
${s} li{margin:.15em 0}
${s} ul.checklist{list-style:none;padding-left:2px}
${s} ul.checklist li{position:relative;padding-left:32px;min-height:24px}
${s} ul.checklist li::before{content:"";position:absolute;left:0;top:.18em;width:20px;height:20px;box-sizing:border-box;border:1.5px solid #c7c7cc;border-radius:50%;cursor:pointer}
${s} ul.checklist li.done::before{background:#f5a623 ${CHECK_SVG} center/16px no-repeat;border-color:#f5a623}
${s} ul.checklist li.done{color:#8e8e93}
${s} table{border-collapse:collapse;margin:10px 0;max-width:100%}
${s} td,${s} th{border:1px solid #d1d1d6;padding:7px 10px;vertical-align:top;min-width:64px;text-align:left}
${s} th{background:#f2f2f7;font-weight:600}
${s} img{max-width:100%;height:auto;border-radius:6px}
${s} blockquote{margin:.5em 0;padding-left:12px;border-left:3px solid #d1d1d6;color:#3a3a3c}
${s} a{color:#007aff}
${s} hr{border:0;border-top:1px solid #e5e5ea;margin:1em 0}
`;
}

/** 粘贴 / 读取笔记时用的 HTML 清理规则：去掉脚本、表单、外部样式表等，保留表格和行内格式 */
export const PURIFY_CONFIG = {
  FORBID_TAGS: [
    "style", "script", "iframe", "frame", "object", "embed", "form", "input", "button",
    "textarea", "select", "option", "meta", "link", "base", "svg", "math", "video", "audio",
  ],
  FORBID_ATTR: ["id", "contenteditable", "draggable", "tabindex"],
  ALLOW_DATA_ATTR: false,
};

const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** 把编辑器里的内容包装成一个可以单独打开的完整 HTML 文件 */
export function wrapNote(title: string, bodyHtml: string) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>html{background:#fff}body.note{max-width:860px;margin:0 auto;padding:24px 20px}${noteCss("body.note")}</style>
</head><body class="note">
${bodyHtml}
</body></html>`;
}
