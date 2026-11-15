import { BUCKET, ENABLE_OFFICE_PREVIEW } from "./config";
import { kindOf } from "./filetypes";
import { formatSize, type DocumentRow } from "./format";
import { formatDateFor, type T } from "./i18n";
import { getT } from "./i18n-server";
import { LangSwitch } from "@/app/ui/I18n";
import { adminDb } from "./supabase";
import { decodeText } from "./text";
import { TextPreview } from "./text-preview";
import PdfViewer from "@/app/ui/PdfViewer";
import { ChevronLeft } from "@/app/ui/icons";

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

async function Preview({ doc, t }: { doc: DocumentRow; t: T }) {
  const kind = kindOf(doc.file_path);

  if (kind === "word" || kind === "excel" || kind === "ppt") {
    if (!ENABLE_OFFICE_PREVIEW) return <p className="muted" style={{ marginTop: 24 }}>{t("previewOff")}</p>;
    const url = await signedUrl(doc.file_path, 30 * 60);
    if (!url) return null;
    const src = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
    return <iframe className="preview" src={src} title={doc.title} />;
  }

  if (kind === "pdf") {
    const url = await signedUrl(doc.file_path, 60 * 60);
    return url ? <PdfViewer url={url} /> : null;
  }

  if (kind === "image") {
    const url = await signedUrl(doc.file_path, 60 * 60);
    // eslint-disable-next-line @next/next/no-img-element
    return url ? <img className="image-view" src={url} alt={doc.title} /> : null;
  }

  if (kind === "text" || kind === "markdown" || kind === "html") {
    const res = await readText(doc.file_path);
    if (!res) return <p className="muted">{t("unreadable")}</p>;
    return <TextPreview kind={kind} text={res.text} truncated={res.truncated} title={doc.title} truncatedText={t("truncated")} />;
  }

  return <p className="muted" style={{ marginTop: 24 }}>{t("cannotView")}</p>;
}

/** 访问者看到的文档页：只能浏览，没有下载按钮 */
export async function DocViewer({
  doc,
  back,
  downloadHref,
}: {
  doc: DocumentRow;
  back?: { href: string; label: string };
  /** 只有开启“允许下载”时才传，才显示下载按钮 */
  downloadHref?: string;
}) {
  const { lang, t } = await getT();
  return (
    <main style={{ maxWidth: 1100 }}>
      <div className="viewer-bar">
        {back && (
          <a className="icon-btn" href={back.href} style={{ marginLeft: -10 }}>
            <ChevronLeft /> <span style={{ marginLeft: 4 }}>{back.label}</span>
          </a>
        )}
        <span style={{ flex: 1 }} />
        <LangSwitch compact />
      </div>
      <div className="spread-row">
        <div className="viewer-title">{doc.title}</div>
        {downloadHref && (
          <a className="btn filled small" href={downloadHref}>
            {t("download")}
          </a>
        )}
      </div>
      <div className="muted">
        {formatSize(doc.size_bytes)} · {t("availableUntil", { date: formatDateFor(lang, doc.expires_at) })}
      </div>
      <Preview doc={doc} t={t} />
    </main>
  );
}

/** 提示页（未设置密码等） */
export function Notice({ title, text }: { title: string; text: string }) {
  return (
    <div className="center-screen">
      <div className="corner">
        <LangSwitch compact />
      </div>
      <h1>{title}</h1>
      <p className="muted">{text}</p>
    </div>
  );
}
