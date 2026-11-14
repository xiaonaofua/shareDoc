import { BUCKET, ENABLE_OFFICE_PREVIEW } from "./config";
import { kindOf } from "./filetypes";
import { formatDate, formatSize, type DocumentRow } from "./format";
import { adminDb } from "./supabase";
import { decodeText } from "./text";
import { TextPreview } from "./text-preview";

const TEXT_PREVIEW_BYTES = 1024 * 1024; // 文本预览最多显示前 1MB

async function readText(path: string): Promise<{ text: string; truncated: boolean } | null> {
  const { data } = await adminDb().storage.from(BUCKET).download(path);
  if (!data) return null;
  const all = new Uint8Array(await data.arrayBuffer());
  const truncated = all.length > TEXT_PREVIEW_BYTES;
  return { text: decodeText(truncated ? all.subarray(0, TEXT_PREVIEW_BYTES) : all), truncated };
}

async function signedUrl(path: string, seconds: number) {
  const { data } = await adminDb().storage.from(BUCKET).createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}

async function Preview({ doc }: { doc: DocumentRow }) {
  const kind = kindOf(doc.file_path);

  if (kind === "word" || kind === "excel" || kind === "ppt") {
    if (!ENABLE_OFFICE_PREVIEW) return <p className="muted">在线预览已关闭，请下载后查看。</p>;
    const url = await signedUrl(doc.file_path, 30 * 60);
    if (!url) return null;
    const src = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
    return <iframe className="preview" src={src} title={doc.title} />;
  }

  if (kind === "pdf") {
    const url = await signedUrl(doc.file_path, 60 * 60);
    return url ? <iframe className="preview" src={url} title={doc.title} /> : null;
  }

  if (kind === "image") {
    const url = await signedUrl(doc.file_path, 60 * 60);
    // eslint-disable-next-line @next/next/no-img-element
    return url ? <img className="image-view" src={url} alt={doc.title} /> : null;
  }

  if (kind === "text" || kind === "markdown" || kind === "html") {
    const res = await readText(doc.file_path);
    if (!res) return <p className="muted">文件暂时无法读取，请下载查看。</p>;
    return <TextPreview kind={kind} text={res.text} truncated={res.truncated} title={doc.title} />;
  }

  return <p className="muted">这种格式不支持在线预览，请下载后查看。</p>;
}

export async function DocViewer({
  doc,
  downloadHref,
  back,
}: {
  doc: DocumentRow;
  downloadHref: string;
  back?: { href: string; label: string };
}) {
  return (
    <main className="wide">
      {back && (
        <a className="back-link" href={back.href}>
          ← {back.label}
        </a>
      )}
      <div className="card">
        <div className="spread">
          <div>
            <h1 style={{ marginBottom: 4, wordBreak: "break-all" }}>{doc.title}</h1>
            <div className="muted">
              {doc.original_name} · {formatSize(doc.size_bytes)} · 有效期至 {formatDate(doc.expires_at)}
            </div>
          </div>
          <a className="btn primary" href={downloadHref}>
            下载
          </a>
        </div>
      </div>
      <Preview doc={doc} />
    </main>
  );
}

/** 密码页、未设置密码页的通用外框 */
export function CenterCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main>
      <div className="card center">
        <h1>{title}</h1>
        {children}
      </div>
    </main>
  );
}
