"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { daysLeft, formatDate, formatSize, needsPin, type DocumentRow } from "@/lib/format";
import QrPanel from "./QrPanel";

const BUCKET = "sharedoc-files";
const MIME: Record<string, string> = {
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
const ACCEPT = ".doc,.docx,.xls,.xlsx," + Object.values(MIME).join(",");
const extOf = (name: string) => /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? "";

type Props = {
  loginId: string;
  docs: DocumentRow[];
  hasPin: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
  maxFileBytes: number;
  retentionDays: number;
};

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

export default function AdminClient(props: Props) {
  const router = useRouter();
  const supabase = useMemo(
    () => createBrowserClient(props.supabaseUrl, props.supabaseAnonKey),
    [props.supabaseUrl, props.supabaseAnonKey],
  );
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  /** 检查文件 → 取上传地址 → 浏览器直传 Supabase，返回存储路径 */
  async function uploadFile(file: File): Promise<string> {
    const ext = extOf(file.name);
    if (!MIME[ext]) throw new Error("只支持 .doc / .docx / .xls / .xlsx");
    if (file.size > props.maxFileBytes) {
      throw new Error(`文件不能超过 ${Math.round(props.maxFileBytes / 1024 / 1024)} MB`);
    }
    const { path, token } = await api("/api/admin/upload-url", "POST", { fileName: file.name, size: file.size });
    // 手机上 file.type 可能为空，这里按扩展名明确指定类型
    const { error } = await supabase.storage
      .from(BUCKET)
      .uploadToSignedUrl(path, token, file, { contentType: MIME[ext] });
    if (error) throw new Error(`上传失败：${error.message}`);
    return path;
  }

  async function logout() {
    await api("/api/admin/logout", "POST");
    window.location.href = "/admin/login";
  }

  return (
    <main>
      <div className="spread" style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>文档管理</h1>
        <div className="row">
          <span className="muted">{props.loginId}</span>
          <button onClick={logout}>退出登录</button>
        </div>
      </div>

      <PinSection hasPin={props.hasPin} onSaved={() => router.refresh()} />
      {props.hasPin && (
        <UploadSection uploadFile={uploadFile} retentionDays={props.retentionDays} onDone={() => router.refresh()} />
      )}

      <div className="card">
        <h2>我的文档（{props.docs.length}）</h2>
        {props.docs.length === 0 && <p className="muted">还没有文档。</p>}
        {props.docs.map((d) => (
          <DocItem
            key={d.id}
            doc={d}
            origin={origin}
            uploadFile={uploadFile}
            retentionDays={props.retentionDays}
            onChanged={() => router.refresh()}
          />
        ))}
      </div>
    </main>
  );
}

function PinSection({ hasPin, onSaved }: { hasPin: boolean; onSaved: () => void }) {
  const [open, setOpen] = useState(!hasPin);
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

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
            {hasPin ? "已设置。对你名下的所有文档链接生效。" : "请先设置 4 位数字密码，访问者打开链接时需要输入。"}
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
      {msg && <p className={msg.ok ? "ok" : "error"}>{msg.text}</p>}
    </div>
  );
}

function UploadSection({
  uploadFile,
  retentionDays,
  onDone,
}: {
  uploadFile: (f: File) => Promise<string>;
  retentionDays: number;
  onDone: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [requirePin, setRequirePin] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const path = await uploadFile(file);
      await api("/api/admin/documents", "POST", { path, title, originalName: file.name, requirePin });
      setMsg({ ok: true, text: "上传成功，链接已生成。" });
      setFile(null);
      setTitle("");
      if (fileRef.current) fileRef.current.value = "";
      onDone();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2>上传文档</h2>
      <form onSubmit={submit}>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ""));
          }}
        />
        <label htmlFor="title">标题（访问者看到的名称）</label>
        <input id="title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        <label className="check">
          <input type="checkbox" checked={requirePin} onChange={(e) => setRequirePin(e.target.checked)} />
          需要输入 4 位密码才能查看（取消勾选 = 拿到链接的人都能直接看）
        </label>
        <button className="primary full" disabled={!file || busy}>
          {busy ? "上传中…" : "上传"}
        </button>
        <p className="muted">支持 Word / Excel。{retentionDays} 天后自动删除（可在列表中点“延长”）。</p>
        {msg && <p className={msg.ok ? "ok" : "error"}>{msg.text}</p>}
      </form>
    </div>
  );
}

function DocItem({
  doc,
  origin,
  uploadFile,
  retentionDays,
  onChanged,
}: {
  doc: DocumentRow;
  origin: string;
  uploadFile: (f: File) => Promise<string>;
  retentionDays: number;
  onChanged: () => void;
}) {
  const [showQr, setShowQr] = useState(false);
  const pinRequired = needsPin(doc);
  const replaceRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const link = `${origin}/d/${doc.token}`;
  const left = daysLeft(doc.expires_at);

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

  const patch = (body: object) => api(`/api/admin/documents/${doc.id}`, "PATCH", body);

  function rename() {
    const title = window.prompt("新标题", doc.title)?.trim();
    if (title && title !== doc.title) run(() => patch({ action: "rename", title }), "已修改标题");
  }

  function regenerate() {
    if (window.confirm("生成新链接后，旧链接会立即失效。确定吗？")) {
      run(() => patch({ action: "regenerate" }), "已生成新链接");
    }
  }

  function remove() {
    if (window.confirm(`确定删除「${doc.title}」？此操作无法撤销。`)) {
      run(() => api(`/api/admin/documents/${doc.id}`, "DELETE"), "已删除");
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setMsg({ ok: true, text: "链接已复制" });
    } catch {
      window.prompt("复制这个链接", link);
    }
  }

  return (
    <div className="doc-item">
      <div className="doc-title">
        {doc.title}{" "}
        <span className={pinRequired ? "badge" : "badge open"}>{pinRequired ? "需要密码" : "无需密码"}</span>
      </div>
      <div className="muted">
        {doc.original_name} · {formatSize(doc.size_bytes)} · 上传于 {formatDate(doc.created_at)} ·{" "}
        <span className={left <= 3 ? "warn" : undefined}>
          {left > 0 ? `${left} 天后删除` : "即将删除"}
        </span>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <div className="link-box">{link}</div>
        <button onClick={copy}>复制链接</button>
        <button onClick={() => setShowQr((v) => !v)}>{showQr ? "收起二维码" : "二维码"}</button>
      </div>
      {showQr && <QrPanel link={link} title={doc.title} />}
      <div className="row actions">
        <button disabled={busy} onClick={rename}>修改标题</button>
        <button disabled={busy} onClick={() => replaceRef.current?.click()}>替换文件</button>
        <button disabled={busy} onClick={() => run(() => patch({ action: "extend" }), `已延长至 ${retentionDays} 天后`)}>
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
        <button disabled={busy} onClick={regenerate}>更换链接</button>
        <button disabled={busy} className="danger" onClick={remove}>删除</button>
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
      {msg && <p className={msg.ok ? "ok" : "error"}>{msg.text}</p>}
    </div>
  );
}
