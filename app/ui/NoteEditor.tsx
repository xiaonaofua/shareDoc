"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { PURIFY_CONFIG, noteCss } from "@/lib/note";
import type { Key } from "@/lib/i18n";
import Sheet from "./Sheet";
import { useT } from "./I18n";

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

const clean = (html: string) => DOMPurify.sanitize(html, PURIFY_CONFIG) as string;

/** 从保存的笔记 HTML 文件里取出正文 */
function bodyOf(fileHtml: string) {
  const doc = new DOMParser().parseFromString(fileHtml, "text/html");
  return clean(doc.body.innerHTML);
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
 * iOS 备忘录风格的笔记编辑器：
 * 标题 / 小标题 / 正文、粗体斜体下划线删除线、列表、清单、表格；
 * 粘贴 iOS 备忘录或邮件里的富文本（含表格）时保留格式，并去掉脚本等危险内容。
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
  const [title, setTitle] = useState(initialTitle);
  const [state, setState] = useState<"loading" | "ready" | "saving">(loadHtml ? "loading" : "ready");
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [inTable, setInTable] = useState(false);
  const [active, setActive] = useState<Record<string, boolean>>({});

  // 读取已有笔记
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

  // 光标位置变化时：判断是否在表格里、哪些格式按钮处于选中状态
  useEffect(() => {
    const onSel = () => {
      const ed = editorRef.current;
      const sel = document.getSelection();
      if (!ed || !sel || !sel.anchorNode || !ed.contains(sel.anchorNode)) return;
      setInTable(!!currentCell());
      setActive({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
        strikeThrough: document.queryCommandState("strikeThrough"),
      });
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

  /* ---------- 格式 ---------- */

  const block = (tag: "h1" | "h2" | "p") => {
    exec("formatBlock", tag);
    changed();
  };
  const inline = (cmd: string) => {
    exec(cmd);
    changed();
  };

  function checklist() {
    const ul = elAtCaret()?.closest("ul");
    if (ul && ul.classList.contains("checklist")) {
      exec("insertUnorderedList"); // 再按一次取消清单
    } else {
      if (!ul) exec("insertUnorderedList");
      const el = elAtCaret();
      const now = el?.closest("ul") ?? (el?.tagName === "UL" ? el : el?.querySelector("ul"));
      now?.classList.add("checklist");
    }
    changed();
  }

  function insertTable() {
    const cells = (n: number) => Array.from({ length: n }, () => "<td><br></td>").join("");
    const html = `<table><tbody>${[1, 2, 3].map(() => `<tr>${cells(3)}</tr>`).join("")}</tbody></table><p><br></p>`;
    // 光标在列表或表格里时，把新表格直接放到它后面，不拆开原来的列表
    const container = elAtCaret()?.closest("ul,ol,table");
    if (container && editorRef.current?.contains(container)) {
      const tpl = document.createElement("template");
      tpl.innerHTML = html;
      const table = tpl.content.querySelector("td")!;
      container.after(tpl.content);
      placeCaret(table);
    } else {
      exec("insertHTML", html);
    }
    setInTable(!!currentCell());
    changed();
  }

  /* ---------- 表格编辑 ---------- */

  function tableOp(op: "rowAdd" | "colAdd" | "rowDel" | "colDel" | "tableDel") {
    const cell = currentCell();
    if (!cell) return;
    const row = cell.parentElement as HTMLTableRowElement;
    const table = cell.closest("table") as HTMLTableElement;
    const col = cell.cellIndex;
    if (op === "rowAdd") {
      const tr = document.createElement("tr");
      for (let i = 0; i < row.cells.length; i++) tr.appendChild(Object.assign(document.createElement("td"), { innerHTML: "<br>" }));
      row.after(tr);
      placeCaret(tr.cells[Math.min(col, tr.cells.length - 1)]);
    } else if (op === "colAdd") {
      for (const tr of Array.from(table.rows)) {
        const ref = tr.cells[Math.min(col, tr.cells.length - 1)];
        const td = document.createElement(ref?.tagName === "TH" ? "th" : "td");
        td.innerHTML = "<br>";
        if (ref) ref.after(td);
        else tr.appendChild(td);
      }
      placeCaret(row.cells[col + 1]);
    } else if (op === "rowDel") {
      if (table.rows.length <= 1) table.remove();
      else row.remove();
    } else if (op === "colDel") {
      if (row.cells.length <= 1) table.remove();
      else for (const tr of Array.from(table.rows)) tr.cells[col]?.remove();
    } else {
      table.remove();
    }
    setInTable(!!currentCell());
    changed();
  }

  /* ---------- 粘贴：保留富文本和表格，清除危险内容 ---------- */

  function onPaste(e: React.ClipboardEvent) {
    const html = e.clipboardData.getData("text/html");
    if (html) {
      e.preventDefault();
      exec("insertHTML", clean(html));
      changed();
      return;
    }
    const img = Array.from(e.clipboardData.files).find((f) => f.type.startsWith("image/"));
    if (img && img.size <= MAX_IMAGE_BYTES) {
      e.preventDefault();
      const reader = new FileReader();
      reader.onload = () => {
        exec("insertHTML", clean(`<img src="${reader.result}">`));
        changed();
      };
      reader.readAsDataURL(img);
    }
    // 纯文本走浏览器默认行为
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

  // 点清单前面的圆圈：勾选 / 取消
  function onClick(e: React.MouseEvent) {
    const li = (e.target as Element).closest?.("ul.checklist > li") as HTMLElement | null;
    if (!li) return;
    if (e.clientX - li.getBoundingClientRect().left < 30) {
      li.classList.toggle("done");
      changed();
    }
  }

  /* ---------- 保存 / 关闭 ---------- */

  const save = useCallback(async () => {
    if (!editorRef.current) return;
    setState("saving");
    setError("");
    try {
      await onSave(title.trim(), clean(editorRef.current.innerHTML));
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

  const Btn = ({ label, onPress, on, children }: { label: Key; onPress: () => void; on?: boolean; children: React.ReactNode }) => (
    <button
      type="button"
      className={on ? "tb on" : "tb"}
      title={t(label)}
      aria-label={t(label)}
      onMouseDown={(e) => e.preventDefault()} // 不让按钮抢走光标
      onClick={onPress}
    >
      {children}
    </button>
  );

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
        <Btn label="fmtTitle" onPress={() => block("h1")}>
          <b style={{ fontSize: 17 }}>T</b>
        </Btn>
        <Btn label="fmtHeading" onPress={() => block("h2")}>
          <b style={{ fontSize: 14 }}>H</b>
        </Btn>
        <Btn label="fmtBody" onPress={() => block("p")}>
          <span style={{ fontSize: 14 }}>¶</span>
        </Btn>
        <span className="tb-sep" />
        <Btn label="fmtBold" on={active.bold} onPress={() => inline("bold")}>
          <b>B</b>
        </Btn>
        <Btn label="fmtItalic" on={active.italic} onPress={() => inline("italic")}>
          <i style={{ fontFamily: "Georgia, serif" }}>I</i>
        </Btn>
        <Btn label="fmtUnderline" on={active.underline} onPress={() => inline("underline")}>
          <u>U</u>
        </Btn>
        <Btn label="fmtStrike" on={active.strikeThrough} onPress={() => inline("strikeThrough")}>
          <s>S</s>
        </Btn>
        <span className="tb-sep" />
        <Btn label="fmtBullets" onPress={() => inline("insertUnorderedList")}>
          •≡
        </Btn>
        <Btn label="fmtNumbers" onPress={() => inline("insertOrderedList")}>
          1≡
        </Btn>
        <Btn label="fmtChecklist" onPress={checklist}>
          ◯✓
        </Btn>
        <Btn label="fmtTable" onPress={insertTable}>
          ⊞
        </Btn>
      </div>

      {inTable && (
        <div className="toolbar table-tools" role="toolbar">
          {(["rowAdd", "colAdd", "rowDel", "colDel", "tableDel"] as const).map((op) => (
            <button
              key={op}
              type="button"
              className={op === "tableDel" ? "tb text danger" : "tb text"}
              onMouseDown={(e) => e.preventDefault()}
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
        onClick={onClick}
        spellCheck={false}
      />
    </Sheet>
  );
}
