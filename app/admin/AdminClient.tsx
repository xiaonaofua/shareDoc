"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { ACCEPT, FILE_TYPES, NOTE_SUFFIX, SUPPORTED_LABEL, extOf, isNoteName, kindOf } from "@/lib/filetypes";
import { daysLeft, formatSize, needsPin, type DocumentRow, type SpaceRow } from "@/lib/format";
import { wrapNote } from "@/lib/note";
import {
  ChevronLeft,
  ChevronRight,
  FileIcon,
  FolderIcon,
  GearIcon,
  LockBadge,
  LockGlyph,
  PlusIcon,
  ShareIcon,
  TrayIcon,
} from "@/app/ui/icons";
import { LangSwitch, useApi, useT } from "@/app/ui/I18n";
import NoteEditor from "@/app/ui/NoteEditor";
import QrPanel from "@/app/ui/QrPanel";
import Sheet, { Switch } from "@/app/ui/Sheet";

const BUCKET = "sharedoc-files";
const DOC_DRAG = "application/x-sharedoc-doc";

type Props = {
  loginId: string;
  docs: DocumentRow[];
  spaces: SpaceRow[];
  hasPin: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
  maxFileBytes: number;
  retentionDays: number;
};

type SheetState =
  | { type: "doc"; id: string }
  | { type: "space"; id: string }
  | { type: "add" }
  | { type: "newFolder" }
  | { type: "newNote" }
  | { type: "edit"; id: string }
  | { type: "settings" }
  | null;

type Api = ReturnType<typeof useApi>;
type Notify = (text: string, error?: boolean) => void;

const isNote = (d: DocumentRow) => isNoteName(d.original_name);

/** 图标下方的小标签：可下载 / 仅查看 */
function StateTag({ download }: { download: boolean }) {
  const t = useT();
  return <span className={download ? "state-tag dl" : "state-tag view"}>{download ? t("badgeDownload") : t("badgeViewOnly")}</span>;
}
const isPlainEditable = (d: DocumentRow) => !isNote(d) && ["text", "markdown"].includes(kindOf(d.file_path));
const baseName = (n: string) => n.replace(/\.[^.]+$/, "");
const safeName = (n: string) => n.replace(/[\\/:*?"<>|]/g, "_").slice(0, 100);

/** 文本存成 UTF-8（带 BOM，Windows 记事本旧版本也能正确识别） */
const textFile = (text: string, name: string) => new File(["﻿" + text], name, { type: "text/plain" });
const noteFile = (title: string, body: string, name: string) =>
  new File([wrapNote(title, body)], name, { type: "text/html" });

export default function AdminClient(props: Props) {
  const t = useT();
  const api = useApi();
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);
  const supabase = useMemo(
    () => createBrowserClient(props.supabaseUrl, props.supabaseAnonKey),
    [props.supabaseUrl, props.supabaseAnonKey],
  );
  const [origin, setOrigin] = useState("");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const [fileDrag, setFileDrag] = useState(false);
  const [dragDoc, setDragDoc] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // 当前打开的文件夹记在网址 # 后面，刷新页面不会丢
  useEffect(() => {
    setOrigin(window.location.origin);
    const fromHash = () => setFolderId(window.location.hash.slice(1) || null);
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);
  const openFolder = (id: string | null) => {
    window.location.hash = id ?? "";
    setFolderId(id);
  };

  const notify: Notify = useCallback((text, error = false) => {
    setToast({ text, error });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), error ? 5000 : 2200);
  }, []);

  /** 检查文件 → 取上传地址 → 浏览器直传 Supabase，返回存储路径 */
  const uploadFile = useCallback(
    async (file: File): Promise<string> => {
      const ext = extOf(file.name);
      if (!ext) throw new Error(t("unsupportedFile", { name: file.name, types: SUPPORTED_LABEL }));
      const mb = Math.round(props.maxFileBytes / 1024 / 1024);
      if (file.size > props.maxFileBytes) throw new Error(t("fileTooLargeName", { name: file.name, mb }));
      const { path, token } = await api("/api/admin/upload-url", "POST", { fileName: file.name, size: file.size });
      const { error } = await supabase.storage
        .from(BUCKET)
        .uploadToSignedUrl(path, token, file, { contentType: FILE_TYPES[ext].mime });
      if (error) throw new Error(t("uploadFailed", { name: file.name, msg: error.message }));
      return path;
    },
    [supabase, props.maxFileBytes, api, t],
  );

  const requirePinFirst = useCallback(() => {
    if (props.hasPin) return false;
    notify(t("needPinFirst"), true);
    setSheet({ type: "settings" });
    return true;
  }, [props.hasPin, notify, t]);

  const uploadMany = useCallback(
    async (files: File[], spaceId: string | null) => {
      if (requirePinFirst()) return;
      const failed: string[] = [];
      for (const [i, f] of files.entries()) {
        notify(t("uploading", { i: i + 1, n: files.length }));
        try {
          const path = await uploadFile(f);
          await api("/api/admin/documents", "POST", {
            path,
            title: baseName(f.name),
            originalName: f.name,
            requirePin: true,
            spaceId,
          });
        } catch (err) {
          failed.push((err as Error).message);
        }
      }
      refresh();
      if (failed.length) notify(failed.join("；"), true);
      else notify(files.length > 1 ? t("uploadedN", { n: files.length }) : t("uploaded"));
    },
    [requirePinFirst, uploadFile, refresh, notify, api, t],
  );

  async function moveDoc(docId: string, spaceId: string | null) {
    try {
      await api(`/api/admin/documents/${docId}`, "PATCH", { action: "space", spaceId });
      refresh();
      notify(spaceId ? t("movedIn") : t("movedOut"));
    } catch (err) {
      notify((err as Error).message, true);
    }
  }

  // 从电脑把文件拖进页面 → 上传到当前文件夹
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes("Files");
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setFileDrag(true);
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) setFileDrag(false);
    };
    const over = (e: DragEvent) => hasFiles(e) && e.preventDefault();
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setFileDrag(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length) void uploadMany(files, folderId);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, [folderId, uploadMany]);

  const folder = props.spaces.find((s) => s.id === folderId) ?? null;
  const counts = new Map<string, number>();
  for (const d of props.docs) if (d.space_id) counts.set(d.space_id, (counts.get(d.space_id) ?? 0) + 1);
  const visibleDocs = props.docs.filter((d) => (folder ? d.space_id === folder.id : !d.space_id));
  const sheetDoc =
    sheet && (sheet.type === "doc" || sheet.type === "edit") ? props.docs.find((d) => d.id === sheet.id) : null;
  const sheetSpace = sheet?.type === "space" ? props.spaces.find((s) => s.id === sheet.id) : null;
  const close = () => setSheet(null);

  /** 文件夹（和返回按钮）作为“拖放目标”时需要的事件 */
  const dropProps = (target: string | null, key: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!dragDoc) return;
      e.preventDefault();
      setDropTarget(key);
    },
    onDragLeave: () => setDropTarget((v) => (v === key ? null : v)),
    onDrop: (e: React.DragEvent) => {
      const id = e.dataTransfer.getData(DOC_DRAG);
      if (!id) return;
      e.preventDefault();
      e.stopPropagation();
      setDropTarget(null);
      setDragDoc(null);
      void moveDoc(id, target);
    },
  });

  const loadContent = useCallback(
    (id: string) => async () => (await api(`/api/admin/documents/${id}/content`, "GET")).text as string,
    [api],
  );

  return (
    <main>
      {/* 导航栏 */}
      <div className="navbar">
        <div className="nav-side">
          {folder ? (
            <button
              className={dropTarget === "root" ? "icon-btn item drop-target" : "icon-btn"}
              onClick={() => openFolder(null)}
              style={{ marginLeft: -10 }}
              {...dropProps(null, "root")}
            >
              <ChevronLeft /> <span style={{ marginLeft: 4 }}>{t("files")}</span>
            </button>
          ) : (
            <button
              className="icon-btn"
              onClick={() => setSheet({ type: "settings" })}
              aria-label={t("settings")}
              style={{ marginLeft: -10 }}
            >
              <GearIcon />
            </button>
          )}
        </div>
        <div className="nav-side">
          {folder && (
            <button
              className="icon-btn"
              onClick={() => setSheet({ type: "space", id: folder.id })}
              aria-label={t("shareFolder")}
            >
              <ShareIcon />
            </button>
          )}
          <button
            className="icon-btn"
            onClick={() => setSheet({ type: "add" })}
            aria-label={t("add")}
            style={{ marginRight: -10 }}
          >
            <PlusIcon />
          </button>
        </div>
      </div>

      <div className="large-title">{folder ? folder.title : t("files")}</div>

      {!props.hasPin && (
        <div className="group">
          <button className="cell" onClick={() => setSheet({ type: "settings" })}>
            <LockGlyph size={18} />
            <span className="grow">{t("setPinPrompt")}</span>
            <ChevronRight />
          </button>
        </div>
      )}

      {/* 文件夹 + 文件 平铺 */}
      {(!folder && props.spaces.length) || visibleDocs.length ? (
        <div className="grid">
          {!folder &&
            props.spaces.map((s) => (
              <button
                key={s.id}
                className={dropTarget === s.id ? "item drop-target" : "item"}
                onClick={() => openFolder(s.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setSheet({ type: "space", id: s.id });
                }}
                {...dropProps(s.id, s.id)}
              >
                <div className="item-art">
                  <FolderIcon size={76} />
                  {s.require_pin !== false && <LockBadge />}
                </div>
                <div className="item-name">{s.title}</div>
                <div className="item-meta">{t("items", { n: counts.get(s.id) ?? 0 })}</div>
                <StateTag download={s.allow_download === true} />
              </button>
            ))}
          {visibleDocs.map((d) => (
            <button
              key={d.id}
              className={dragDoc === d.id ? "item dragging" : "item"}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(DOC_DRAG, d.id);
                e.dataTransfer.effectAllowed = "move";
                setDragDoc(d.id);
              }}
              onDragEnd={() => {
                setDragDoc(null);
                setDropTarget(null);
              }}
              onClick={() => setSheet({ type: "doc", id: d.id })}
            >
              <div className="item-art">
                <FileIcon name={d.file_path} note={isNote(d)} size={70} />
                {needsPin(d) && <LockBadge />}
              </div>
              <div className="item-name">{d.title}</div>
              <div className="item-meta">{formatSize(d.size_bytes)}</div>
              <StateTag download={d.allow_download === true} />
            </button>
          ))}
        </div>
      ) : (
        <div className="empty">
          <TrayIcon />
          <div>{folder ? t("emptyFolder") : t("noFiles")}</div>
          <button className="btn filled" style={{ marginTop: 18 }} onClick={() => pickerRef.current?.click()}>
            {t("uploadFiles")}
          </button>
        </div>
      )}

      <input
        ref={pickerRef}
        type="file"
        multiple
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) void uploadMany(files, folderId);
        }}
      />

      {fileDrag && (
        <div className="drop-overlay">
          {folder ? t("dropToUploadInto", { name: folder.title }) : t("dropToUpload")}
        </div>
      )}
      {toast && (
        <div className={toast.error ? "toast error" : "toast"} role="status">
          {toast.text}
        </div>
      )}

      {/* ---------- 弹出面板 ---------- */}
      {sheet?.type === "add" && (
        <Sheet title={t("add")} onClose={close}>
          <div className="group">
            <button
              className="cell"
              onClick={() => {
                close();
                pickerRef.current?.click();
              }}
            >
              <span className="cell-icon" style={{ background: "#007aff" }}>⇪</span>
              <span className="grow">{t("uploadFiles")}</span>
            </button>
            <button className="cell" onClick={() => !requirePinFirst() && setSheet({ type: "newNote" })}>
              <span className="cell-icon" style={{ background: "#f5b700" }}>✎</span>
              <span className="grow">{t("newNote")}</span>
            </button>
            {!folder && (
              <button className="cell" onClick={() => setSheet({ type: "newFolder" })}>
                <span className="cell-icon" style={{ background: "#34aadc" }}>▣</span>
                <span className="grow">{t("newFolder")}</span>
              </button>
            )}
          </div>
        </Sheet>
      )}

      {sheet?.type === "newFolder" && <NewFolderSheet api={api} onClose={close} onDone={refresh} notify={notify} />}

      {sheet?.type === "newNote" && (
        <NoteEditor
          onClose={close}
          onSave={async (title, body) => {
            const name = `${safeName(title) || t("untitled")}${NOTE_SUFFIX}`;
            const path = await uploadFile(noteFile(title, body, name));
            await api("/api/admin/documents", "POST", {
              path,
              title: title || t("untitled"),
              originalName: name,
              requirePin: true,
              spaceId: folderId,
            });
            refresh();
            notify(t("saved"));
          }}
        />
      )}

      {sheet?.type === "edit" && sheetDoc && isNote(sheetDoc) && (
        <NoteEditor
          initialTitle={sheetDoc.title}
          loadHtml={loadContent(sheetDoc.id)}
          onClose={() => setSheet({ type: "doc", id: sheetDoc.id })}
          onSave={async (title, body) => {
            const path = await uploadFile(noteFile(title || sheetDoc.title, body, sheetDoc.original_name));
            await api(`/api/admin/documents/${sheetDoc.id}`, "PATCH", {
              action: "replace",
              path,
              originalName: sheetDoc.original_name,
            });
            if (title && title !== sheetDoc.title) {
              await api(`/api/admin/documents/${sheetDoc.id}`, "PATCH", { action: "rename", title });
            }
            refresh();
            notify(t("saved"));
          }}
        />
      )}

      {sheet?.type === "edit" && sheetDoc && !isNote(sheetDoc) && (
        <TextEditorSheet
          doc={sheetDoc}
          loadText={loadContent(sheetDoc.id)}
          onClose={() => setSheet({ type: "doc", id: sheetDoc.id })}
          onSave={async (text) => {
            const path = await uploadFile(textFile(text, sheetDoc.original_name));
            await api(`/api/admin/documents/${sheetDoc.id}`, "PATCH", {
              action: "replace",
              path,
              originalName: sheetDoc.original_name,
            });
            refresh();
            notify(t("saved"));
          }}
        />
      )}

      {sheet?.type === "doc" && sheetDoc && (
        <DocSheet
          api={api}
          doc={sheetDoc}
          spaces={props.spaces}
          origin={origin}
          retentionDays={props.retentionDays}
          uploadFile={uploadFile}
          onEdit={() => setSheet({ type: "edit", id: sheetDoc.id })}
          onClose={close}
          onChanged={refresh}
          notify={notify}
        />
      )}

      {sheet?.type === "space" && sheetSpace && (
        <SpaceSheet
          api={api}
          space={sheetSpace}
          count={counts.get(sheetSpace.id) ?? 0}
          origin={origin}
          onOpen={
            folder
              ? undefined
              : () => {
                  close();
                  openFolder(sheetSpace.id);
                }
          }
          onDeleted={() => {
            close();
            openFolder(null);
          }}
          onClose={close}
          onChanged={refresh}
          notify={notify}
        />
      )}

      {sheet?.type === "settings" && (
        <SettingsSheet
          api={api}
          loginId={props.loginId}
          hasPin={props.hasPin}
          onClose={close}
          onChanged={refresh}
          notify={notify}
        />
      )}
    </main>
  );
}

/* ---------------- 分享区：链接 + 复制 + 二维码 ---------------- */

function ShareGroup({ link, title, notify }: { link: string; title: string; notify: Notify }) {
  const t = useT();
  const [qr, setQr] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      notify(t("linkCopied"));
    } catch {
      window.prompt(t("copyPrompt"), link);
    }
  }
  return (
    <>
      <div className="group-title">{t("share")}</div>
      <div className="group">
        <div className="cell link-row">
          <span className="link-text">{link}</span>
          <button className="icon-btn" onClick={copy} style={{ fontWeight: 600 }}>
            {t("copy")}
          </button>
        </div>
        <button className="cell" onClick={() => setQr((v) => !v)}>
          <span className="grow">{t("qrCode")}</span>
          <span style={{ transform: qr ? "rotate(90deg)" : "none", transition: "transform .2s", display: "flex" }}>
            <ChevronRight />
          </span>
        </button>
        {qr && <QrPanel link={link} title={title} />}
      </div>
    </>
  );
}

/** 面板里按钮操作的通用处理：执行 → 刷新 → 提示 */
function useRunner(onChanged: () => void, notify: Notify) {
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<unknown>, ok: string, after?: () => void) {
    setBusy(true);
    try {
      await fn();
      onChanged();
      notify(ok);
      after?.();
    } catch (err) {
      notify((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return { busy, run };
}

/* ---------------- 文件详情 ---------------- */

function DocSheet({
  api,
  doc,
  spaces,
  origin,
  retentionDays,
  uploadFile,
  onEdit,
  onClose,
  onChanged,
  notify,
}: {
  api: Api;
  doc: DocumentRow;
  spaces: SpaceRow[];
  origin: string;
  retentionDays: number;
  uploadFile: (f: File) => Promise<string>;
  onEdit: () => void;
  onClose: () => void;
  onChanged: () => void;
  notify: Notify;
}) {
  const t = useT();
  const { busy, run } = useRunner(onChanged, notify);
  const replaceRef = useRef<HTMLInputElement>(null);
  const patch = (body: object) => api(`/api/admin/documents/${doc.id}`, "PATCH", body);
  const left = daysLeft(doc.expires_at);
  const note = isNote(doc);

  return (
    <Sheet title="" onClose={onClose}>
      <div className="sheet-hero">
        <a className="item-art" href={`/preview/${doc.id}`} style={{ width: 90, height: 96 }} aria-label={t("preview")}>
          <FileIcon name={doc.file_path} note={note} size={92} />
        </a>
        <div className="name">{doc.title}</div>
        <div className="muted">
          {formatSize(doc.size_bytes)} · {left > 0 ? t("daysLeft", { n: left }) : t("deletingSoon")}
        </div>
        <StateTag download={doc.allow_download === true} />
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <a className="btn filled" href={`/preview/${doc.id}`} style={{ minWidth: 130 }}>
            {t("preview")}
          </a>
          {(note || isPlainEditable(doc)) && (
            <button className="btn" style={{ minWidth: 130 }} disabled={busy} onClick={onEdit}>
              {note ? t("editNote") : t("editText")}
            </button>
          )}
        </div>
      </div>

      <ShareGroup link={`${origin}/d/${doc.token}`} title={doc.title} notify={notify} />

      <div className="group">
        <div className="cell">
          <span className="grow">{t("requirePin")}</span>
          <Switch
            label={t("requirePin")}
            checked={needsPin(doc)}
            disabled={busy}
            onChange={(v) => run(() => patch({ action: "access", requirePin: v }), v ? t("pinOn") : t("pinOff"))}
          />
        </div>
        <div className="cell">
          <span className="grow">{t("allowDownload")}</span>
          <Switch
            label={t("allowDownload")}
            checked={doc.allow_download === true}
            disabled={busy}
            onChange={(v) =>
              run(() => patch({ action: "download", allowDownload: v }), v ? t("downloadOn") : t("downloadOff"))
            }
          />
        </div>
        {spaces.length > 0 && (
          <label className="cell">
            <span className="grow">{t("folder")}</span>
            <select
              value={doc.space_id ?? ""}
              disabled={busy}
              onChange={(e) =>
                run(
                  () => patch({ action: "space", spaceId: e.target.value || null }),
                  e.target.value ? t("movedIn") : t("movedOut"),
                )
              }
            >
              <option value="">{t("none")}</option>
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="group">
        <button
          className="cell action"
          disabled={busy}
          onClick={() => {
            const title = window.prompt(t("rename"), doc.title)?.trim();
            if (title && title !== doc.title) run(() => patch({ action: "rename", title }), t("renamed"));
          }}
        >
          {t("rename")}
        </button>
        {!note && (
          <button className="cell action" disabled={busy} onClick={() => replaceRef.current?.click()}>
            {t("replaceFile")}
          </button>
        )}
        <button
          className="cell action"
          disabled={busy}
          onClick={() => run(() => patch({ action: "extend" }), t("extended", { n: retentionDays }))}
        >
          {t("extend", { n: retentionDays })}
        </button>
        <button
          className="cell action"
          disabled={busy}
          onClick={() =>
            window.confirm(t("changeLinkConfirm")) && run(() => patch({ action: "regenerate" }), t("linkChanged"))
          }
        >
          {t("changeLink")}
        </button>
      </div>

      <div className="group">
        <button
          className="cell destructive"
          disabled={busy}
          onClick={() => {
            if (window.confirm(t("deleteConfirm", { name: doc.title }))) {
              run(() => api(`/api/admin/documents/${doc.id}`, "DELETE"), t("deleted"), onClose);
            }
          }}
        >
          {t("delete")}
        </button>
      </div>

      <input
        ref={replaceRef}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) {
            run(async () => {
              const path = await uploadFile(f);
              await patch({ action: "replace", path, originalName: f.name });
            }, t("replaced"));
          }
        }}
      />
    </Sheet>
  );
}

/* ---------------- 文件夹（空间）详情 ---------------- */

function SpaceSheet({
  api,
  space,
  count,
  origin,
  onOpen,
  onDeleted,
  onClose,
  onChanged,
  notify,
}: {
  api: Api;
  space: SpaceRow;
  count: number;
  origin: string;
  onOpen?: () => void;
  onDeleted: () => void;
  onClose: () => void;
  onChanged: () => void;
  notify: Notify;
}) {
  const t = useT();
  const { busy, run } = useRunner(onChanged, notify);
  const patch = (body: object) => api(`/api/admin/spaces/${space.id}`, "PATCH", body);

  return (
    <Sheet title="" onClose={onClose}>
      <div className="sheet-hero">
        <FolderIcon size={96} />
        <div className="name">{space.title}</div>
        <div className="muted">{t("items", { n: count })}</div>
        <StateTag download={space.allow_download === true} />
        {onOpen && (
          <button className="btn filled" style={{ marginTop: 10, minWidth: 130 }} onClick={onOpen}>
            {t("open")}
          </button>
        )}
      </div>

      <ShareGroup link={`${origin}/s/${space.token}`} title={space.title} notify={notify} />

      <div className="group">
        <div className="cell">
          <span className="grow">{t("requirePin")}</span>
          <Switch
            label={t("requirePin")}
            checked={space.require_pin !== false}
            disabled={busy}
            onChange={(v) => run(() => patch({ action: "access", requirePin: v }), v ? t("pinOn") : t("pinOff"))}
          />
        </div>
        <div className="cell">
          <span className="grow">{t("allowDownload")}</span>
          <Switch
            label={t("allowDownload")}
            checked={space.allow_download === true}
            disabled={busy}
            onChange={(v) =>
              run(() => patch({ action: "download", allowDownload: v }), v ? t("downloadOn") : t("downloadOff"))
            }
          />
        </div>
      </div>

      <div className="group">
        <button
          className="cell action"
          disabled={busy}
          onClick={() => {
            const title = window.prompt(t("rename"), space.title)?.trim();
            if (title && title !== space.title) run(() => patch({ action: "rename", title }), t("renamed"));
          }}
        >
          {t("rename")}
        </button>
        <button
          className="cell action"
          disabled={busy}
          onClick={() =>
            window.confirm(t("changeLinkConfirm")) && run(() => patch({ action: "regenerate" }), t("linkChanged"))
          }
        >
          {t("changeLink")}
        </button>
      </div>

      <div className="group">
        <button
          className="cell destructive"
          disabled={busy}
          onClick={() => {
            if (window.confirm(t("deleteFolderConfirm", { name: space.title }))) {
              run(() => api(`/api/admin/spaces/${space.id}`, "DELETE"), t("folderDeleted"), onDeleted);
            }
          }}
        >
          {t("deleteFolder")}
        </button>
      </div>
    </Sheet>
  );
}

/* ---------------- 新建文件夹 ---------------- */

function NewFolderSheet({
  api,
  onClose,
  onDone,
  notify,
}: {
  api: Api;
  onClose: () => void;
  onDone: () => void;
  notify: Notify;
}) {
  const t = useT();
  const [title, setTitle] = useState("");
  const [requirePin, setRequirePin] = useState(true);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      await api("/api/admin/spaces", "POST", { title, requirePin });
      onDone();
      notify(t("folderCreated"));
      onClose();
    } catch (err) {
      notify((err as Error).message, true);
      setBusy(false);
    }
  }

  return (
    <Sheet
      title={t("newFolder")}
      onClose={onClose}
      left={
        <button className="icon-btn" onClick={onClose}>
          {t("cancel")}
        </button>
      }
      right={
        <button className="icon-btn" style={{ fontWeight: 600 }} disabled={busy || !title.trim()} onClick={create}>
          {t("done")}
        </button>
      }
    >
      <div className="sheet-hero">
        <FolderIcon size={96} />
      </div>
      <div className="group">
        <input
          className="field"
          placeholder={t("folderName")}
          value={title}
          maxLength={100}
          autoFocus
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && title.trim() && create()}
        />
      </div>
      <div className="group">
        <div className="cell">
          <span className="grow">{t("requirePin")}</span>
          <Switch label={t("requirePin")} checked={requirePin} onChange={setRequirePin} />
        </div>
      </div>
    </Sheet>
  );
}

/* ---------------- 纯文本编辑器（编辑已有的 TXT / MD） ---------------- */

function TextEditorSheet({
  doc,
  loadText,
  onClose,
  onSave,
}: {
  doc: DocumentRow;
  loadText: () => Promise<string>;
  onClose: () => void;
  onSave: (text: string) => Promise<void>;
}) {
  const t = useT();
  const [text, setText] = useState("");
  const [original, setOriginal] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "saving">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    loadText()
      .then((v) => {
        setText(v);
        setOriginal(v);
        setState("ready");
      })
      .catch((err) => setError((err as Error).message));
  }, [loadText]);

  const dirty = text !== original;
  const save = useCallback(async () => {
    setState("saving");
    setError("");
    try {
      await onSave(text);
      setOriginal(text);
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setState("ready");
    }
  }, [onSave, text, onClose]);

  const cancel = () => {
    if (!dirty || window.confirm(t("discardConfirm"))) onClose();
  };

  // Ctrl / ⌘ + S 保存
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

  return (
    <Sheet
      tall
      title={doc.title}
      onClose={cancel}
      left={
        <button className="icon-btn" onClick={cancel}>
          {t("cancel")}
        </button>
      }
      right={
        <button
          className="icon-btn"
          style={{ fontWeight: 600 }}
          disabled={state !== "ready" || !dirty}
          onClick={save}
        >
          {state === "saving" ? t("saving") : t("save")}
        </button>
      }
    >
      {error && <p className="error" style={{ marginBottom: 10 }}>{error}</p>}
      <textarea
        className="editor"
        value={state === "loading" ? "" : text}
        placeholder={state === "loading" ? t("loading") : t("typeHere")}
        disabled={state === "loading"}
        autoFocus
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
      />
    </Sheet>
  );
}

/* ---------------- 设置 ---------------- */

function SettingsSheet({
  api,
  loginId,
  hasPin,
  onClose,
  onChanged,
  notify,
}: {
  api: Api;
  loginId: string;
  hasPin: boolean;
  onClose: () => void;
  onChanged: () => void;
  notify: Notify;
}) {
  const t = useT();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  async function savePin() {
    setBusy(true);
    try {
      await api("/api/admin/pin", "PUT", { pin });
      setPin("");
      onChanged();
      notify(t("pinSaved"));
    } catch (err) {
      notify((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await api("/api/admin/logout", "POST");
    window.location.href = "/";
  }

  return (
    <Sheet title={t("settings")} onClose={onClose}>
      <div className="group">
        <div className="cell">
          <span className="grow">{t("account")}</span>
          <span className="value">{loginId}</span>
        </div>
      </div>

      <div className="group-title">
        {t("viewPasscode")}
        {hasPin ? t("pinIsSet") : ""}
      </div>
      <div className="group">
        <div className="cell">
          <input
            className="field"
            style={{ padding: 0, height: 32, background: "none", letterSpacing: pin ? "0.4em" : undefined }}
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            placeholder={hasPin ? t("newPinPh") : t("setPinPh")}
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          />
          <button
            className="icon-btn"
            style={{ fontWeight: 600 }}
            disabled={busy || pin.length !== 4}
            onClick={savePin}
          >
            {t("save")}
          </button>
        </div>
      </div>

      <div className="group-title">{t("language")}</div>
      <div className="group">
        <div className="cell" style={{ justifyContent: "center" }}>
          <LangSwitch />
        </div>
      </div>

      <div className="group">
        <button className="cell destructive" onClick={logout}>
          {t("logout")}
        </button>
      </div>
    </Sheet>
  );
}
