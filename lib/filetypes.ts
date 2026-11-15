/** 可上传的文件类型（前后端共用，不含任何服务器专用代码） */

export type Kind = "word" | "excel" | "ppt" | "pdf" | "image" | "text" | "markdown" | "html" | "other";

export const FILE_TYPES: Record<string, { mime: string; kind: Kind }> = {
  doc: { mime: "application/msword", kind: "word" },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", kind: "word" },
  xls: { mime: "application/vnd.ms-excel", kind: "excel" },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", kind: "excel" },
  ppt: { mime: "application/vnd.ms-powerpoint", kind: "ppt" },
  pptx: { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", kind: "ppt" },
  pdf: { mime: "application/pdf", kind: "pdf" },
  rtf: { mime: "application/rtf", kind: "other" },
  txt: { mime: "text/plain", kind: "text" },
  log: { mime: "text/plain", kind: "text" },
  csv: { mime: "text/csv", kind: "text" },
  md: { mime: "text/markdown", kind: "markdown" },
  markdown: { mime: "text/markdown", kind: "markdown" },
  html: { mime: "text/html", kind: "html" },
  htm: { mime: "text/html", kind: "html" },
  png: { mime: "image/png", kind: "image" },
  jpg: { mime: "image/jpeg", kind: "image" },
  jpeg: { mime: "image/jpeg", kind: "image" },
  gif: { mime: "image/gif", kind: "image" },
  bmp: { mime: "image/bmp", kind: "image" },
  webp: { mime: "image/webp", kind: "image" },
};

export const EXTENSIONS = Object.keys(FILE_TYPES);
export const ACCEPT = EXTENSIONS.map((e) => `.${e}`).join(",");
export const SUPPORTED_LABEL = "Word / Excel / PowerPoint / PDF / TXT / CSV / MD / HTML / RTF / PNG / JPG / GIF / BMP / WEBP";

export function extOf(name: string): string | null {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  return ext && ext in FILE_TYPES ? ext : null;
}

export const kindOf = (name: string): Kind => FILE_TYPES[extOf(name) ?? ""]?.kind ?? "other";

/** 图标上显示的文字和颜色 */
export const KIND_STYLE: Record<Kind, { color: string }> = {
  word: { color: "#2b579a" },
  excel: { color: "#217346" },
  ppt: { color: "#c43e1c" },
  pdf: { color: "#d93025" },
  image: { color: "#7c3aed" },
  text: { color: "#4b5563" },
  markdown: { color: "#0f766e" },
  html: { color: "#e44d26" },
  other: { color: "#6b7280" },
};

/** 笔记：用富文本编辑器创建，保存为 HTML，原始文件名以 .note.html 结尾 */
export const NOTE_SUFFIX = ".note.html";
export const isNoteName = (originalName: string) => originalName.toLowerCase().endsWith(NOTE_SUFFIX);
export const NOTE_COLOR = "#e0a800";
