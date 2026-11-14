"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { ACCEPT, FILE_TYPES, SUPPORTED_LABEL, extOf } from "@/lib/filetypes";
import { daysLeft, formatDate, formatSize, needsPin, type DocumentRow, type SpaceRow } from "@/lib/format";
import QrPanel from "./QrPanel";

const BUCKET = "sharedoc-files";

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

type Msg = { ok: boolean; text: string } | null;

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

/** 按钮操作的通用状态：执行中、结果提示 */
function useAction(onChanged: () => void) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  async function run(fn: () => Promise<unknown>, okText: string) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: okText });
      onChanged();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }
  return { busy, msg, setMsg, run };
}

const Note = ({ msg }: { msg: Msg }) => (msg ? <p className={msg.ok ? "ok" : "error"}>{msg.text}</p> : null);

const PinBadge = ({ required }: { required: boolean }) => (
  <span className={required ? "badge" : "badge open"}>{required ? "需要密码" : "无需密码"}</span>
);

export default function AdminClient(props: Props) {
  const router = useRouter();
  const refresh = () => router.refresh();
  const supabase = useMemo(
    () => createBrowserClient(props.supabaseUrl, props.supabaseAnonKey),
    [props.supabaseUrl, props.supabaseAnonKey],
  );
  // 域名只有浏览器知道；挂载后再读取，避免服务端与浏览器渲染结果不一致
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const [filter, setFilter] = useState<string>("all");

  /** 检查文件 → 取上传地址 → 浏览器直传 Supabase，返回存储路径 */
  async function uploadFile(file: File): Promise<string> {
    const ext = extOf(file.name);
    if (!ext) throw new Error(`「${file.name}」格式不支持。支持：${SUPPORTED_LABEL}`);
    if (file.size > props.maxFileBytes) {
      throw new Error(`「${file.name}」超过 ${Math.round(props.maxFileBytes / 1024 / 1024)} MB`);
    }
    const { path, token } = await api("/api/admin/upload-url", "POST", { fileName: file.name, size: file.size });
    // 手机上 file.type 可能为空，这里按扩展名明确指定类型
    const { error } = await supabase.storage
      .from(BUCKET)
      .uploadToSignedUrl(path, token, file, { contentType: FILE_TYPES[ext].mime });
    if (error) throw new Error(`「${file.name}」上传失败：${error.message}`);
    return path;
  }

  async function logout() {
    await api("/api/admin/logout", "POST");
    window.location.href = "/admin/login";
  }

  const countBySpace = new Map<string, number>();
  for (const d of props.docs) if (d.space_id) countBySpace.set(d.space_id, (countBySpace.get(d.space_id) ?? 0) + 1);

  const shownDocs = props.docs.filter((d) =>
    filter === "all" ? true : filter === "none" ? !d.space_id : d.space_id === filter,
  );

  return (
    <main>
      <div className="spread" style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>文档管理</h1>
        <div className="row">
          <span className="muted">{props.loginId}</span>
          <button onClick={logout}>退出登录</button>
        </div>
      </div>

      <PinSection hasPin={props.hasPin} onSaved={refresh} />

      {props.hasPin && (
        <>
          <SpacesSection spaces={props.spaces} counts={countBySpace} origin={origin} onChanged={refresh} />
          <UploadSection
            spaces={props.spaces}
            uploadFile={uploadFile}
            retentionDays={props.retentionDays}
            onDone={refresh}
          />
        </>
      )}

      <div className="card">
        <div className="spread" style={{ marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>我的文档（{shownDocs.length}）</h2>
          {props.spaces.length > 0 && (
            <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="按空间筛选">
              <option value="all">全部文档</option>
              <option value="none">未放入空间</option>
              {props.spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  空间：{s.title}
                </option>
              ))}
            </select>
          )}
        </div>
        {shownDocs.length === 0 && <p className="muted">没有文档。</p>}
        {shownDocs.map((d) => (
          <DocItem
            key={d.id}
            doc={d}
            spaces={props.spaces}
            origin={origin}
            uploadFile={uploadFile}
            retentionDays={props.retentionDays}
            onChanged={refresh}
          />
        ))}
      </div>
    </main>
  );
}

/* ---------------- 查看密码 ---------------- */

function PinSection({ hasPin, onSaved }: { hasPin: boolean; onSaved: () => void }) {
  const [open, setOpen] = useState(!hasPin);
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState<Msg>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/api/admin/pin", "PUT", { pin });
      setMsg({ ok: true, text: "已保存。之前输入过旧密码的访问者需要重新输入。" });
      setPin("");
      setOpen(false);
      onSaved();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    }
  }

  return (
    <div className="card">
      <div className="spread">
        <div>
          <h2 style={{ marginBottom: 4 }}>查看密码</h2>
          <div className="muted">
            {hasPin
              ? "已设置。对你名下所有“需要密码”的文档和空间生效。"
              : "请先设置 4 位数字密码，访问者打开链接时需要输入。"}
          </div>
        </div>
        {hasPin && !open && <button onClick={() => setOpen(true)}>修改密码</button>}
      </div>
      {open && (
        <form onSubmit={save} className="row" style={{ marginTop: 12 }}>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={4}
            placeholder="4 位数字"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            style={{ maxWidth: 160 }}
          />
          <button className="primary" disabled={pin.length !== 4}>
            保存
          </button>
          {hasPin && (
            <button type="button" onClick={() => setOpen(false)}>
              取消
            </button>
          )}
        </form>
      )}
      <Note msg={msg} />
    </div>
  );
}

/* ---------------- 链接 + 复制 + 二维码（文档和空间共用） ---------------- */

function ShareLink({ link, title, onMsg }: { link: string; title: string; onMsg: (m: Msg) => void }) {
  const [showQr, setShowQr] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      onMsg({ ok: true, text: "链接已复制" });
    } catch {
      window.prompt("复制这个链接", link);
    }
  }
  return (
    <>
      <div className="row" style={{ marginTop: 8 }}>
        <div className="link-box">{link}</div>
        <button onClick={copy}>复制链接</button>
        <button onClick={() => setShowQr((v) => !v)}>{showQr ? "收起二维码" : "二维码"}</button>
      </div>
      {showQr && <QrPanel link={link} title={title} />}
    </>
  );
}

/* ---------------- 空间 ---------------- */

function SpacesSection({
  spaces,
  counts,
  origin,
  onChanged,
}: {
  spaces: SpaceRow[];
  counts: Map<string, number>;
  origin: string;
  onChanged: () => void;
}) {
  const [title, setTitle] = useState("");
  const [requirePin, setRequirePin] = useState(true);
  const { busy, msg, run } = useAction(onChanged);

  function create(e: React.FormEvent) {
    e.preventDefault();
    run(async () => {
      await api("/api/admin/spaces", "POST", { title, requirePin });
      setTitle("");
    }, "空间已创建");
  }

  return (
    <div className="card">
      <h2>空间</h2>
      <p className="muted" style={{ marginTop: -6 }}>
        一个空间可以放多个文件。访问者打开空间链接后，文件以图标平铺显示，点击即可查看。
      </p>
      <form onSubmit={create}>
        <div className="row">
          <input
            type="text"
            placeholder="新空间名称"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            style={{ flex: "1 1 200px", width: "auto" }}
          />
          <button className="primary" disabled={busy || !title.trim()}>
            新建空间
          </button>
        </div>
        <label className="check">
          <input type="checkbox" checked={requirePin} onChange={(e) => setRequirePin(e.target.checked)} />
          进入空间需要输入 4 位密码
        </label>
      </form>
      <Note msg={msg} />
      {spaces.map((s) => (
        <SpaceItem key={s.id} space={s} count={counts.get(s.id) ?? 0} origin={origin} onChanged={onChanged} />
      ))}
    </div>
  );
}

function SpaceItem({
  space,
  count,
  origin,
  onChanged,
}: {
  space: SpaceRow;
  count: number;
  origin: string;
  onChanged: () => void;
}) {
  const { busy, msg, setMsg, run } = useAction(onChanged);
  const patch = (body: object) => api(`/api/admin/spaces/${space.id}`, "PATCH", body);
  const pinRequired = space.require_pin !== false;

  return (
    <div className="doc-item">
      <div className="doc-title">
        📁 {space.title} <PinBadge required={pinRequired} />{" "}
        <span className="muted" style={{ fontWeight: 400 }}>
          {count} 个文件
        </span>
      </div>
      <ShareLink link={`${origin}/s/${space.token}`} title={space.title} onMsg={setMsg} />
      <div className="row actions">
        <button
          disabled={busy}
          onClick={() => {
            const title = window.prompt("新名称", space.title)?.trim();
            if (title && title !== space.title) run(() => patch({ action: "rename", title }), "已修改名称");
          }}
        >
          修改名称
        </button>
        <button
          disabled={busy}
          onClick={() =>
            run(
              () => patch({ action: "access", requirePin: !pinRequired }),
              pinRequired ? "已改为无需密码" : "已改为需要密码",
            )
          }
        >
          {pinRequired ? "改为无需密码" : "改为需要密码"}
        </button>
        <button
          disabled={busy}
          onClick={() => {
            if (window.confirm("生成新链接后，旧的空间链接会立即失效。确定吗？")) {
              run(() => patch({ action: "regenerate" }), "已生成新链接");
            }
          }}
        >
          更换链接
        </button>
        <button
          disabled={busy}
          className="danger"
          onClick={() => {
            if (window.confirm(`删除空间「${space.title}」？\n空间里的文件不会被删除，只是移出空间。`)) {
              run(() => api(`/api/admin/spaces/${space.id}`, "DELETE"), "已删除空间");
            }
          }}
        >
          删除空间
        </button>
      </div>
      <Note msg={msg} />
    </div>
  );
}

/* ---------------- 上传 ---------------- */

function UploadSection({
  spaces,
  uploadFile,
  retentionDays,
  onDone,
}: {
  spaces: SpaceRow[];
  uploadFile: (f: File) => Promise<string>;
  retentionDays: number;
  onDone: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [spaceId, setSpaceId] = useState("");
  const [requirePin, setRequirePin] = useState(true);
  const [progress, setProgress] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const single = files.length === 1;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!files.length) return;
    setMsg(null);
    const failed: string[] = [];
    for (const [i, f] of files.entries()) {
      setProgress(`上传中 ${i + 1}/${files.length}…`);
      try {
        const path = await uploadFile(f);
        await api("/api/admin/documents", "POST", {
          path,
          title: single ? title : f.name.replace(/\.[^.]+$/, ""),
          originalName: f.name,
          requirePin,
          spaceId: spaceId || null,
        });
      } catch (err) {
        failed.push((err as Error).message);
      }
    }
    setProgress("");
    const okCount = files.length - failed.length;
    setMsg(
      failed.length
        ? { ok: false, text: `成功 ${okCount} 个，失败 ${failed.length} 个：${failed.join("；")}` }
        : { ok: true, text: `上传成功 ${okCount} 个文件。` },
    );
    setFiles([]);
    setTitle("");
    if (fileRef.current) fileRef.current.value = "";
    onDone();
  }

  return (
    <div className="card">
      <h2>上传文件</h2>
      <form onSubmit={submit}>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={ACCEPT}
          onChange={(e) => {
            const list = Array.from(e.target.files ?? []);
            setFiles(list);
            setTitle(list.length === 1 ? list[0].name.replace(/\.[^.]+$/, "") : "");
          }}
        />
        {single && (
          <>
            <label htmlFor="title">标题（访问者看到的名称）</label>
            <input id="title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </>
        )}
        {files.length > 1 && <p className="muted">已选择 {files.length} 个文件，标题使用各自的文件名。</p>}
        {spaces.length > 0 && (
          <>
            <label htmlFor="space">放入空间</label>
            <select id="space" value={spaceId} onChange={(e) => setSpaceId(e.target.value)}>
              <option value="">不放入空间</option>
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </>
        )}
        <label className="check">
          <input type="checkbox" checked={requirePin} onChange={(e) => setRequirePin(e.target.checked)} />
          单独打开这个文件的链接时需要 4 位密码（从空间进入时按空间的设置）
        </label>
        <button className="primary full" disabled={!files.length || !!progress}>
          {progress || "上传"}
        </button>
        <p className="muted">
          支持 {SUPPORTED_LABEL}，可一次选择多个。{retentionDays} 天后自动删除（可在列表中点“延长”）。
        </p>
        <Note msg={msg} />
      </form>
    </div>
  );
}

/* ---------------- 文档列表项 ---------------- */

function DocItem({
  doc,
  spaces,
  origin,
  uploadFile,
  retentionDays,
  onChanged,
}: {
  doc: DocumentRow;
  spaces: SpaceRow[];
  origin: string;
  uploadFile: (f: File) => Promise<string>;
  retentionDays: number;
  onChanged: () => void;
}) {
  const pinRequired = needsPin(doc);
  const replaceRef = useRef<HTMLInputElement>(null);
  const { busy, msg, setMsg, run } = useAction(onChanged);
  const left = daysLeft(doc.expires_at);
  const patch = (body: object) => api(`/api/admin/documents/${doc.id}`, "PATCH", body);

  return (
    <div className="doc-item">
      <div className="doc-title">
        {doc.title} <PinBadge required={pinRequired} />
      </div>
      <div className="muted">
        {doc.original_name} · {formatSize(doc.size_bytes)} · 上传于 {formatDate(doc.created_at)} ·{" "}
        <span className={left <= 3 ? "warn" : undefined}>{left > 0 ? `${left} 天后删除` : "即将删除"}</span>
      </div>
      <ShareLink link={`${origin}/d/${doc.token}`} title={doc.title} onMsg={setMsg} />
      <div className="row actions">
        {spaces.length > 0 && (
          <select
            disabled={busy}
            value={doc.space_id ?? ""}
            onChange={(e) =>
              run(
                () => patch({ action: "space", spaceId: e.target.value || null }),
                e.target.value ? "已放入空间" : "已移出空间",
              )
            }
            aria-label="所属空间"
            className="small-select"
          >
            <option value="">不在空间中</option>
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                空间：{s.title}
              </option>
            ))}
          </select>
        )}
        <button
          disabled={busy}
          onClick={() => {
            const title = window.prompt("新标题", doc.title)?.trim();
            if (title && title !== doc.title) run(() => patch({ action: "rename", title }), "已修改标题");
          }}
        >
          修改标题
        </button>
        <button disabled={busy} onClick={() => replaceRef.current?.click()}>
          替换文件
        </button>
        <button
          disabled={busy}
          onClick={() => run(() => patch({ action: "extend" }), `已延长至 ${retentionDays} 天后`)}
        >
          延长 {retentionDays} 天
        </button>
        <button
          disabled={busy}
          onClick={() =>
            run(
              () => patch({ action: "access", requirePin: !pinRequired }),
              pinRequired ? "已改为无需密码" : "已改为需要密码",
            )
          }
        >
          {pinRequired ? "改为无需密码" : "改为需要密码"}
        </button>
        <button
          disabled={busy}
          onClick={() => {
            if (window.confirm("生成新链接后，旧链接会立即失效。确定吗？")) {
              run(() => patch({ action: "regenerate" }), "已生成新链接");
            }
          }}
        >
          更换链接
        </button>
        <button
          disabled={busy}
          className="danger"
          onClick={() => {
            if (window.confirm(`确定删除「${doc.title}」？此操作无法撤销。`)) {
              run(() => api(`/api/admin/documents/${doc.id}`, "DELETE"), "已删除");
            }
          }}
        >
          删除
        </button>
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
              }, "文件已替换，链接不变");
            }
          }}
        />
      </div>
      <Note msg={msg} />
    </div>
  );
}
