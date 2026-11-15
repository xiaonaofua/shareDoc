"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { ACCEPT, FILE_TYPES, SUPPORTED_LABEL, extOf, kindOf } from "@/lib/filetypes";
import { daysLeft, formatSize, needsPin, type DocumentRow, type SpaceRow } from "@/lib/format";
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
  | { type: "newText" }
  | { type: "editText"; id: string }
  | { type: "settings" }
  | null;

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `请求失败 (${res.status})`);
  return json;
}

const isEditable = (d: DocumentRow) => ["text", "markdown"].includes(kindOf(d.file_path));
const baseName = (n: string) => n.replace(/\.[^.]+$/, "");

export default function AdminClient(props: Props) {
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

  const notify = useCallback((text: string, error = false) => {
    setToast({ text, error });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), error ? 5000 : 2200);
  }, []);

  /** 检查文件 → 取上传地址 → 浏览器直传 Supabase，返回存储路径 */
  const uploadFile = useCallback(
    async (file: File): Promise<string> => {
      const ext = extOf(file.name);
      if (!ext) throw new Error(`「${file.name}」格式不支持（支持 ${SUPPORTED_LABEL}）`);
      if (file.size > props.maxFileBytes) {
        throw new Error(`「${file.name}」超过 ${Math.round(props.maxFileBytes / 1024 / 1024)} MB`);
      }
      const { path, token } = await api("/api/admin/upload-url", "POST", { fileName: file.name, size: file.size });
      const { error } = await supabase.storage
        .from(BUCKET)
        .uploadToSignedUrl(path, token, file, { contentType: FILE_TYPES[ext].mime });
      if (error) throw new Error(`「${file.name}」上传失败：${error.message}`);
      return path;
    },
    [supabase, props.maxFileBytes],
  );

  const uploadMany = useCallback(
    async (files: File[], spaceId: string | null) => {
      if (!props.hasPin) {
        notify("请先在设置里设定查看密码", true);
        setSheet({ type: "settings" });
        return;
      }
      const failed: string[] = [];
      for (const [i, f] of files.entries()) {
        notify(`正在上传 ${i + 1}/${files.length}…`);
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
      else notify(files.length > 1 ? `已上传 ${files.length} 个文件` : "已上传");
    },
    [props.hasPin, uploadFile, refresh, notify],
  );

  async function moveDoc(docId: string, spaceId: string | null) {
    try {
      await api(`/api/admin/documents/${docId}`, "PATCH", { action: "space", spaceId });
      refresh();
      notify(spaceId ? "已移入文件夹" : "已移出文件夹");
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
  const sheetDoc = sheet && (sheet.type === "doc" || sheet.type === "editText") ? props.docs.find((d) => d.id === sheet.id) : null;
  const sheetSpace = sheet?.type === "space" ? props.spaces.find((s) => s.id === sheet.id) : null;
  const close = () => setSheet(null);

  /** 文件夹（和返回按钮）作为“拖放目标”时需要的事件 */
  const dropProps = (target: string | null, key: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!dragDoc) return;
      e.preventDefault();
      setDropTarget(key);
    },
    onDragLeave: () => setDropTarget((t) => (t === key ? null : t)),
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
              <ChevronLeft /> <span style={{ marginLeft: 4 }}>文件</span>
            </button>
          ) : (
            <button className="icon-btn" onClick={() => setSheet({ type: "settings" })} aria-label="设置" style={{ marginLeft: -10 }}>
              <GearIcon />
            </button>
          )}
        </div>
        <div className="nav-side">
          {folder && (
            <button className="icon-btn" onClick={() => setSheet({ type: "space", id: folder.id })} aria-label="分享文件夹">
              <ShareIcon />
            </button>
          )}
          <button className="icon-btn" onClick={() => setSheet({ type: "add" })} aria-label="添加" style={{ marginRight: -10 }}>
            <PlusIcon />
          </button>
        </div>
      </div>

      <div className="large-title">{folder ? folder.title : "文件"}</div>

      {!props.hasPin && (
        <div className="group">
          <button className="cell" onClick={() => setSheet({ type: "settings" })}>
            <LockGlyph size={18} />
            <span className="grow">设置 4 位查看密码</span>
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
                <div className="item-meta">{counts.get(s.id) ?? 0} 项</div>
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
                <FileIcon name={d.file_path} size={70} />
                {needsPin(d) && <LockBadge />}
              </div>
              <div className="item-name">{d.title}</div>
              <div className="item-meta">{formatSize(d.size_bytes)}</div>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty">
          <TrayIcon />
          <div>{folder ? "空文件夹" : "还没有文件"}</div>
          <button className="btn filled" style={{ marginTop: 18 }} onClick={() => pickerRef.current?.click()}>
            上传文件
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

      {fileDrag && <div className="drop-overlay">松开即可上传{folder ? `到「${folder.title}」` : ""}</div>}
      {toast && (
        <div className={toast.error ? "toast error" : "toast"} role="status">
          {toast.text}
        </div>
      )}

      {/* ---------- 弹出面板 ---------- */}
      {sheet?.type === "add" && (
        <Sheet title="添加" onClose={close}>
          <div className="group">
            <button
              className="cell"
              onClick={() => {
                close();
                pickerRef.current?.click();
              }}
            >
              <span className="cell-icon" style={{ background: "#007aff" }}>⇪</span>
              <span className="grow">上传文件</span>
            </button>
            <button className="cell" onClick={() => setSheet({ type: "newText" })}>
              <span className="cell-icon" style={{ background: "#4b5563" }}>✎</span>
              <span className="grow">新建文本</span>
            </button>
            {!folder && (
              <button className="cell" onClick={() => setSheet({ type: "newFolder" })}>
                <span className="cell-icon" style={{ background: "#34aadc" }}>▣</span>
                <span className="grow">新建文件夹</span>
              </button>
            )}
          </div>
        </Sheet>
      )}

      {sheet?.type === "newFolder" && <NewFolderSheet onClose={close} onDone={refresh} notify={notify} />}

      {sheet?.type === "newText" && (
        <TextEditorSheet
          onClose={close}
          onSave={async (title, text) => {
            if (!props.hasPin) throw new Error("请先在设置里设定查看密码");
            const name = `${title.replace(/[\\/:*?"<>|]/g, "_") || "无标题"}.txt`;
            const path = await uploadFile(textFile(text, name));
            await api("/api/admin/documents", "POST", {
              path,
              title: title || "无标题",
              originalName: name,
              requirePin: true,
              spaceId: folderId,
            });
            refresh();
            notify("已保存");
          }}
        />
      )}

      {sheet?.type === "editText" && sheetDoc && (
        <TextEditorSheet
          doc={sheetDoc}
          onClose={() => setSheet({ type: "doc", id: sheetDoc.id })}
          onSave={async (_title, text) => {
            const path = await uploadFile(textFile(text, sheetDoc.original_name));
            await api(`/api/admin/documents/${sheetDoc.id}`, "PATCH", {
              action: "replace",
              path,
              originalName: sheetDoc.original_name,
            });
            refresh();
            notify("已保存");
          }}
        />
      )}

      {sheet?.type === "doc" && sheetDoc && (
        <DocSheet
          doc={sheetDoc}
          spaces={props.spaces}
          origin={origin}
          retentionDays={props.retentionDays}
          uploadFile={uploadFile}
          onEdit={() => setSheet({ type: "editText", id: sheetDoc.id })}
          onClose={close}
          onChanged={refresh}
          notify={notify}
        />
      )}

      {sheet?.type === "space" && sheetSpace && (
        <SpaceSheet
          space={sheetSpace}
          count={counts.get(sheetSpace.id) ?? 0}
          origin={origin}
          onOpen={folder ? undefined : () => {
            close();
            openFolder(sheetSpace.id);
          }}
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
        <SettingsSheet loginId={props.loginId} hasPin={props.hasPin} onClose={close} onChanged={refresh} notify={notify} />
      )}
    </main>
  );
}

/** 文本存成 UTF-8（带 BOM，Windows 记事本旧版本也能正确识别） */
function textFile(text: string, name: string) {
  return new File(["﻿" + text], name, { type: "text/plain" });
}

type Notify = (text: string, error?: boolean) => void;

/* ---------------- 分享区：链接 + 复制 + 二维码 ---------------- */

function ShareGroup({ link, title, notify }: { link: string; title: string; notify: Notify }) {
  const [qr, setQr] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      notify("链接已复制");
    } catch {
      window.prompt("复制这个链接", link);
    }
  }
  return (
    <>
      <div className="group-title">分享</div>
      <div className="group">
        <div className="cell link-row">
          <span className="link-text">{link}</span>
          <button className="icon-btn" onClick={copy} style={{ fontWeight: 600 }}>
            复制
          </button>
        </div>
        <button className="cell" onClick={() => setQr((v) => !v)}>
          <span className="grow">二维码</span>
          <span style={{ transform: qr ? "rotate(90deg)" : "none", transition: "transform .2s", display: "flex" }}>
            <ChevronRight />
          </span>
        </button>
        {qr && <QrPanel link={link} title={title} />}
      </div>
    </>
  );
}

/* ---------------- 文件详情 ---------------- */

function DocSheet({
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
  const [busy, setBusy] = useState(false);
  const replaceRef = useRef<HTMLInputElement>(null);
  const patch = (body: object) => api(`/api/admin/documents/${doc.id}`, "PATCH", body);
  const left = daysLeft(doc.expires_at);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      onChanged();
      notify(ok);
    } catch (err) {
      notify((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title="" onClose={onClose}>
      <div className="sheet-hero">
        <a className="item-art" href={`/preview/${doc.id}`} style={{ width: 90, height: 96 }} aria-label="预览">
          <FileIcon name={doc.file_path} size={92} />
        </a>
        <div className="name">{doc.title}</div>
        <div className="muted">
          {formatSize(doc.size_bytes)} · {left > 0 ? `${left} 天后自动删除` : "即将删除"}
        </div>
        <a className="btn filled" href={`/preview/${doc.id}`} style={{ marginTop: 10, minWidth: 160 }}>
          预览
        </a>
      </div>

      <ShareGroup link={`${origin}/d/${doc.token}`} title={doc.title} notify={notify} />

      <div className="group">
        <div className="cell">
          <span className="grow">需要密码</span>
          <Switch
            label="需要密码"
            checked={needsPin(doc)}
            disabled={busy}
            onChange={(v) => run(() => patch({ action: "access", requirePin: v }), v ? "已开启密码" : "已关闭密码")}
          />
        </div>
        {spaces.length > 0 && (
          <label className="cell">
            <span className="grow">文件夹</span>
            <select
              value={doc.space_id ?? ""}
              disabled={busy}
              onChange={(e) =>
                run(() => patch({ action: "space", spaceId: e.target.value || null }), e.target.value ? "已移入文件夹" : "已移出文件夹")
              }
            >
              <option value="">无</option>
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
        {isEditable(doc) && (
          <button className="cell action" disabled={busy} onClick={onEdit}>
            编辑文本
          </button>
        )}
        <button
          className="cell action"
          disabled={busy}
          onClick={() => {
            const title = window.prompt("重命名", doc.title)?.trim();
            if (title && title !== doc.title) run(() => patch({ action: "rename", title }), "已重命名");
          }}
        >
          重命名
        </button>
        <button className="cell action" disabled={busy} onClick={() => replaceRef.current?.click()}>
          替换文件
        </button>
        <button className="cell action" disabled={busy} onClick={() => run(() => patch({ action: "extend" }), `已延长到 ${retentionDays} 天后`)}>
          延长 {retentionDays} 天
        </button>
        <button
          className="cell action"
          disabled={busy}
          onClick={() => window.confirm("换成新链接后，旧链接立即失效。") && run(() => patch({ action: "regenerate" }), "已换新链接")}
        >
          更换链接
        </button>
      </div>

      <div className="group">
        <button
          className="cell destructive"
          disabled={busy}
          onClick={() => {
            if (window.confirm(`删除「${doc.title}」？`)) {
              run(() => api(`/api/admin/documents/${doc.id}`, "DELETE"), "已删除").then(onClose);
            }
          }}
        >
          删除
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
            }, "已替换");
          }
        }}
      />
    </Sheet>
  );
}

/* ---------------- 文件夹（空间）详情 ---------------- */

function SpaceSheet({
  space,
  count,
  origin,
  onOpen,
  onDeleted,
  onClose,
  onChanged,
  notify,
}: {
  space: SpaceRow;
  count: number;
  origin: string;
  onOpen?: () => void;
  onDeleted: () => void;
  onClose: () => void;
  onChanged: () => void;
  notify: Notify;
}) {
  const [busy, setBusy] = useState(false);
  const patch = (body: object) => api(`/api/admin/spaces/${space.id}`, "PATCH", body);
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

  return (
    <Sheet title="" onClose={onClose}>
      <div className="sheet-hero">
        <FolderIcon size={96} />
        <div className="name">{space.title}</div>
        <div className="muted">{count} 项</div>
      </div>

      <ShareGroup link={`${origin}/s/${space.token}`} title={space.title} notify={notify} />

      <div className="group">
        <div className="cell">
          <span className="grow">需要密码</span>
          <Switch
            label="需要密码"
            checked={space.require_pin !== false}
            disabled={busy}
            onChange={(v) => run(() => patch({ action: "access", requirePin: v }), v ? "已开启密码" : "已关闭密码")}
          />
        </div>
      </div>

      <div className="group">
        {onOpen && (
          <button className="cell action" onClick={onOpen}>
            打开
          </button>
        )}
        <button
          className="cell action"
          disabled={busy}
          onClick={() => {
            const title = window.prompt("重命名", space.title)?.trim();
            if (title && title !== space.title) run(() => patch({ action: "rename", title }), "已重命名");
          }}
        >
          重命名
        </button>
        <button
          className="cell action"
          disabled={busy}
          onClick={() => window.confirm("换成新链接后，旧链接立即失效。") && run(() => patch({ action: "regenerate" }), "已换新链接")}
        >
          更换链接
        </button>
      </div>

      <div className="group">
        <button
          className="cell destructive"
          disabled={busy}
          onClick={() => {
            if (window.confirm(`删除文件夹「${space.title}」？\n里面的文件会保留，移到外面。`)) {
              run(() => api(`/api/admin/spaces/${space.id}`, "DELETE"), "已删除文件夹", onDeleted);
            }
          }}
        >
          删除文件夹
        </button>
      </div>
    </Sheet>
  );
}

/* ---------------- 新建文件夹 ---------------- */

function NewFolderSheet({ onClose, onDone, notify }: { onClose: () => void; onDone: () => void; notify: Notify }) {
  const [title, setTitle] = useState("");
  const [requirePin, setRequirePin] = useState(true);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      await api("/api/admin/spaces", "POST", { title, requirePin });
      onDone();
      notify("已新建文件夹");
      onClose();
    } catch (err) {
      notify((err as Error).message, true);
      setBusy(false);
    }
  }

  return (
    <Sheet
      title="新建文件夹"
      onClose={onClose}
      left={
        <button className="icon-btn" onClick={onClose}>
          取消
        </button>
      }
      right={
        <button className="icon-btn" style={{ fontWeight: 600 }} disabled={busy || !title.trim()} onClick={create}>
          完成
        </button>
      }
    >
      <div className="sheet-hero">
        <FolderIcon size={96} />
      </div>
      <div className="group">
        <input
          className="field"
          placeholder="文件夹名称"
          value={title}
          maxLength={100}
          autoFocus
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && title.trim() && create()}
        />
      </div>
      <div className="group">
        <div className="cell">
          <span className="grow">需要密码</span>
          <Switch label="需要密码" checked={requirePin} onChange={setRequirePin} />
        </div>
      </div>
    </Sheet>
  );
}

/* ---------------- 文本编辑器 ---------------- */

function TextEditorSheet({
  doc,
  onClose,
  onSave,
}: {
  doc?: DocumentRow;
  onClose: () => void;
  onSave: (title: string, text: string) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [original, setOriginal] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "saving">(doc ? "loading" : "ready");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!doc) return;
    api(`/api/admin/documents/${doc.id}/content`, "GET")
      .then(({ text }) => {
        setText(text);
        setOriginal(text);
        setState("ready");
      })
      .catch((err) => setError((err as Error).message));
  }, [doc]);

  const dirty = text !== original || (!doc && title !== "");
  const save = useCallback(async () => {
    setState("saving");
    setError("");
    try {
      await onSave(title.trim(), text);
      setOriginal(text);
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setState("ready");
    }
  }, [onSave, title, text, onClose]);

  const cancel = () => {
    if (!dirty || window.confirm("不保存就关闭？")) onClose();
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
      title={doc ? doc.title : "新建文本"}
      onClose={cancel}
      left={
        <button className="icon-btn" onClick={cancel}>
          取消
        </button>
      }
      right={
        <button className="icon-btn" style={{ fontWeight: 600 }} disabled={state !== "ready" || (!!doc && !dirty)} onClick={save}>
          {state === "saving" ? "保存中" : "保存"}
        </button>
      }
    >
      {!doc && (
        <input
          className="field"
          style={{ marginBottom: 10, fontWeight: 600 }}
          placeholder="标题"
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
        />
      )}
      {error && <p className="error" style={{ marginBottom: 10 }}>{error}</p>}
      <textarea
        className="editor"
        value={state === "loading" ? "" : text}
        placeholder={state === "loading" ? "正在读取…" : "在这里输入内容"}
        disabled={state === "loading"}
        autoFocus={!!doc}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
      />
    </Sheet>
  );
}

/* ---------------- 设置 ---------------- */

function SettingsSheet({
  loginId,
  hasPin,
  onClose,
  onChanged,
  notify,
}: {
  loginId: string;
  hasPin: boolean;
  onClose: () => void;
  onChanged: () => void;
  notify: Notify;
}) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  async function savePin() {
    setBusy(true);
    try {
      await api("/api/admin/pin", "PUT", { pin });
      setPin("");
      onChanged();
      notify("密码已保存");
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
    <Sheet title="设置" onClose={onClose}>
      <div className="group">
        <div className="cell">
          <span className="grow">账号</span>
          <span className="value">{loginId}</span>
        </div>
      </div>

      <div className="group-title">查看密码{hasPin ? "（已设置）" : ""}</div>
      <div className="group">
        <div className="cell">
          <input
            className="field"
            style={{ padding: 0, height: 32, background: "none", letterSpacing: pin ? "0.4em" : undefined }}
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            placeholder={hasPin ? "输入新的 4 位数字" : "设定 4 位数字"}
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          />
          <button className="icon-btn" style={{ fontWeight: 600 }} disabled={busy || pin.length !== 4} onClick={savePin}>
            保存
          </button>
        </div>
      </div>

      <div className="group">
        <button className="cell destructive" onClick={logout}>
          退出登录
        </button>
      </div>
    </Sheet>
  );
}
