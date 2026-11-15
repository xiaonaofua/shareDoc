"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { PURIFY_CONFIG, noteCss } from "@/lib/note";
import Sheet from "./Sheet";
import { useT } from "./I18n";

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

/** 可选的文字颜色（黑色 = 默认） */
const COLORS = ["#1c1c1e", "#8e8e93", "#ff3b30", "#ff9500", "#34c759", "#007aff", "#af52de"];

const DROP_ATTRS = [
  "face", "size", "color", "bgcolor", "background", "align", "valign", "width", "height",
  "border", "cellpadding", "cellspacing", "dir",
];

/**
 * 清理 HTML：
 *  - 去掉脚本等危险内容（DOMPurify）
 *  - 统一字体：去掉字体、字号、对齐、背景色；标题变成粗体段落
 *  - 粘贴时（paste）连文字颜色也去掉：iPhone 暗色模式复制来的白色字会变回黑色
 *  - 读取已保存的笔记时（stored）只保留文字颜色（用户自己设的）
 */
function sanitize(html: string, mode: "paste" | "stored"): string {
  const frag = DOMPurify.sanitize(html, { ...PURIFY_CONFIG, RETURN_DOM_FRAGMENT: true }) as DocumentFragment;
  for (const el of Array.from(frag.querySelectorAll("*"))) {
    if (/^H[1-6]$/.test(el.tagName)) {
      const p = document.createElement("p");
      const b = document.createElement("strong");
      b.append(...Array.from(el.childNodes));
      p.append(b);
      el.replaceWith(p);
      continue;
    }
    const fontColor = el.tagName === "FONT" ? el.getAttribute("color") : null;
    for (const a of DROP_ATTRS) el.removeAttribute(a);
    el.removeAttribute("class");

    let color = "";
    if (mode === "stored") {
      const m = /(?:^|;)\s*color\s*:\s*([^;]+)/i.exec(el.getAttribute("style") ?? "");
      color = m?.[1]?.trim() ?? fontColor ?? "";
    }
    if (color) el.setAttribute("style", `color: ${color}`);
    else el.removeAttribute("style");

    if (el.tagName === "FONT") {
      const span = document.createElement("span");
      if (color) span.setAttribute("style", `color: ${color}`);
      span.append(...Array.from(el.childNodes));
      el.replaceWith(span);
    }
  }
  const box = document.createElement("div");
  box.append(frag);
  return box.innerHTML;
}

/** 从保存的笔记 HTML 文件里取出正文 */
function bodyOf(fileHtml: string) {
  const doc = new DOMParser().parseFromString(fileHtml, "text/html");
  return sanitize(doc.body.innerHTML, "stored");
}

const exec = (cmd: string, value?: string) => document.execCommand(cmd, false, value);

/** 光标所在的元素（光标落在元素“之间”时，取它旁边的子元素） */
function elAtCaret(): Element | null {
  const sel = document.getSelection();
  if (!sel?.rangeCount) return null;
  const r = sel.getRangeAt(0);
  let n: Node = r.startContainer;
  if (n.nodeType === Node.ELEMENT_NODE) {
    const kids = n.childNodes;
    n = kids[r.startOffset] ?? kids[r.startOffset - 1] ?? n;
  }
  return n instanceof Element ? n : n.parentElement;
}

/**
 * 简单的笔记编辑器：白纸黑字、统一字体。
 * 工具只有：全选、文字颜色、表格（加 / 删行列、删除表格）。
 * 粘贴 iPhone 备忘录或邮件里的内容时保留表格和粗体，其余格式统一。
 */
export default function NoteEditor({
  initialTitle = "",
  loadHtml,
  onClose,
  onSave,
}: {
  initialTitle?: string;
  loadHtml?: () => Promise<string>;
  onClose: () => void;
  onSave: (title: string, bodyHtml: string) => Promise<void>;
}) {
  const t = useT();
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [title, setTitle] = useState(initialTitle);
  const [state, setState] = useState<"loading" | "ready" | "saving">(loadHtml ? "loading" : "ready");
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [inTable, setInTable] = useState(false);
  const [showColors, setShowColors] = useState(false);

  useEffect(() => {
    if (!loadHtml) {
      editorRef.current?.focus();
      return;
    }
    loadHtml()
      .then((html) => {
        if (editorRef.current) editorRef.current.innerHTML = bodyOf(html);
        setState("ready");
      })
      .catch((err) => setError((err as Error).message));
  }, [loadHtml]);

  // 记住编辑器里的选区（点颜色按钮时不会丢），并判断光标是否在表格里
  useEffect(() => {
    const onSel = () => {
      const ed = editorRef.current;
      const sel = document.getSelection();
      if (!ed || !sel?.rangeCount || !sel.anchorNode || !ed.contains(sel.anchorNode)) return;
      savedRange.current = sel.getRangeAt(0).cloneRange();
      setInTable(!!currentCell());
    };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, []);

  const changed = () => setDirty(true);

  function currentCell(): HTMLTableCellElement | null {
    const cell = elAtCaret()?.closest("td,th") as HTMLTableCellElement | null;
    return cell && editorRef.current?.contains(cell) ? cell : null;
  }

  function placeCaret(el: Node) {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(true);
    const sel = document.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  function restoreSelection() {
    const r = savedRange.current;
    if (!r) return;
    const sel = document.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(r);
  }

  /* ---------- 全选 / 颜色 ---------- */

  function selectAll() {
    const ed = editorRef.current;
    if (!ed) return;
    ed.focus();
    const range = document.createRange();
    range.selectNodeContents(ed);
    const sel = document.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  function applyColor(color: string) {
    restoreSelection();
    exec("styleWithCSS", "true");
    exec("foreColor", color);
    setShowColors(false);
    changed();
  }

  /* ---------- 表格 ---------- */

  function insertTable() {
    const cells = (n: number) => Array.from({ length: n }, () => "<td><br></td>").join("");
    const html = `<table><tbody>${[1, 2, 3].map(() => `<tr>${cells(3)}</tr>`).join("")}</tbody></table><p><br></p>`;
    // 光标在列表或表格里时，把新表格直接放到它后面，不拆开原来的内容
    const container = elAtCaret()?.closest("ul,ol,table");
    if (container && editorRef.current?.contains(container)) {
      const tpl = document.createElement("template");
      tpl.innerHTML = html;
      const first = tpl.content.querySelector("td")!;
      container.after(tpl.content);
      placeCaret(first);
    } else {
      exec("insertHTML", html);
    }
    setInTable(!!currentCell());
    changed();
  }

  function tableOp(op: "rowAdd" | "rowDel" | "colAdd" | "colDel" | "tableDel") {
    const cell = currentCell();
    if (!cell) return;
    const row = cell.parentElement as HTMLTableRowElement;
    const table = cell.closest("table") as HTMLTableElement;
    const col = cell.cellIndex;
    const blank = (tag = "td") => Object.assign(document.createElement(tag), { innerHTML: "<br>" });
    if (op === "rowAdd") {
      const tr = document.createElement("tr");
      for (let i = 0; i < row.cells.length; i++) tr.appendChild(blank());
      row.after(tr);
      placeCaret(tr.cells[Math.min(col, tr.cells.length - 1)]);
    } else if (op === "colAdd") {
      for (const tr of Array.from(table.rows)) {
        const ref = tr.cells[Math.min(col, tr.cells.length - 1)];
        const td = blank(ref?.tagName === "TH" ? "th" : "td");
        if (ref) ref.after(td);
        else tr.appendChild(td);
      }
      placeCaret(row.cells[col + 1]);
    } else if (op === "rowDel") {
      if (table.rows.length <= 1) table.remove();
      else {
        // 删除后把光标放到相邻行的同一列，可以继续操作
        const next = (row.nextElementSibling ?? row.previousElementSibling) as HTMLTableRowElement;
        row.remove();
        placeCaret(next.cells[Math.min(col, next.cells.length - 1)]);
      }
    } else if (op === "colDel") {
      if (row.cells.length <= 1) table.remove();
      else {
        for (const tr of Array.from(table.rows)) tr.cells[col]?.remove();
        placeCaret(row.cells[Math.min(col, row.cells.length - 1)]);
      }
    } else {
      table.remove();
    }
    setInTable(!!currentCell());
    changed();
  }

  /* ---------- 粘贴 ---------- */

  function onPaste(e: React.ClipboardEvent) {
    const html = e.clipboardData.getData("text/html");
    if (html) {
      e.preventDefault();
      exec("insertHTML", sanitize(html, "paste"));
      changed();
      return;
    }
    const img = Array.from(e.clipboardData.files).find((f) => f.type.startsWith("image/"));
    if (img && img.size <= MAX_IMAGE_BYTES) {
      e.preventDefault();
      const reader = new FileReader();
      reader.onload = () => {
        exec("insertHTML", sanitize(`<img src="${reader.result}">`, "paste"));
        changed();
      };
      reader.readAsDataURL(img);
      return;
    }
    // 纯文本：按纯文本插入，不带任何格式
    const text = e.clipboardData.getData("text/plain");
    if (text) {
      e.preventDefault();
      exec("insertText", text);
      changed();
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    // 表格里按 Tab 跳到下一格
    if (e.key === "Tab") {
      const cell = currentCell();
      if (!cell) return;
      e.preventDefault();
      const all = Array.from(cell.closest("table")!.querySelectorAll("td,th"));
      const next = all[all.indexOf(cell) + (e.shiftKey ? -1 : 1)];
      if (next) placeCaret(next);
      else if (!e.shiftKey) tableOp("rowAdd");
    }
  }

  /* ---------- 保存 / 关闭 ---------- */

  const save = useCallback(async () => {
    if (!editorRef.current) return;
    setState("saving");
    setError("");
    try {
      await onSave(title.trim(), sanitize(editorRef.current.innerHTML, "stored"));
      setDirty(false);
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setState("ready");
    }
  }, [onSave, onClose, title]);

  const cancel = () => {
    if (!dirty || window.confirm(t("discardConfirm"))) onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (state === "ready") void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save, state]);

  // 工具栏按钮：按下时不让编辑器失去光标
  const keep = (e: React.MouseEvent) => e.preventDefault();

  return (
    <Sheet
      tall
      title={initialTitle || t("newNote")}
      onClose={cancel}
      left={
        <button className="icon-btn" onClick={cancel}>
          {t("cancel")}
        </button>
      }
      right={
        <button className="icon-btn" style={{ fontWeight: 600 }} disabled={state !== "ready"} onClick={save}>
          {state === "saving" ? t("saving") : t("save")}
        </button>
      }
    >
      <style>{noteCss(".note-body")}</style>
      <input
        className="field"
        style={{ marginBottom: 10, fontWeight: 600 }}
        placeholder={t("titlePh")}
        value={title}
        maxLength={200}
        onChange={(e) => {
          setTitle(e.target.value);
          changed();
        }}
      />

      <div className="toolbar" role="toolbar">
        <button type="button" className="tb text" onMouseDown={keep} onClick={selectAll}>
          {t("selectAll")}
        </button>
        <span className="tb-sep" />
        <button
          type="button"
          className={showColors ? "tb text on" : "tb text"}
          onMouseDown={keep}
          onClick={() => setShowColors((v) => !v)}
        >
          <span className="color-dot" /> {t("textColor")}
        </button>
        <span className="tb-sep" />
        <button type="button" className="tb text" onMouseDown={keep} onClick={insertTable}>
          ⊞ {t("fmtTable")}
        </button>
      </div>

      {showColors && (
        <div className="toolbar" role="toolbar" aria-label={t("textColor")}>
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className="swatch"
              style={{ background: c }}
              aria-label={c}
              onMouseDown={keep}
              onClick={() => applyColor(c)}
            />
          ))}
        </div>
      )}

      {inTable && (
        <div className="toolbar table-tools" role="toolbar">
          {(["rowAdd", "rowDel", "colAdd", "colDel", "tableDel"] as const).map((op) => (
            <button
              key={op}
              type="button"
              className={op === "tableDel" ? "tb text danger" : "tb text"}
              onMouseDown={keep}
              onClick={() => tableOp(op)}
            >
              {t(op)}
            </button>
          ))}
        </div>
      )}

      {error && <p className="error" style={{ marginBottom: 10 }}>{error}</p>}

      <div
        ref={editorRef}
        className="note-body note-paper"
        contentEditable={state !== "loading"}
        suppressContentEditableWarning
        data-placeholder={state === "loading" ? t("loading") : t("noteStart")}
        onInput={changed}
        onPaste={onPaste}
        onKeyDown={onKeyDown}
        spellCheck={false}
      />
    </Sheet>
  );
}
