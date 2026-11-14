import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { findSharedDoc } from "@/lib/docs";
import { checkUnlockCookie, unlockCookieName } from "@/lib/security";
import { adminDb } from "@/lib/supabase";
import { BUCKET, ENABLE_OFFICE_PREVIEW } from "@/lib/config";
import { formatDate, formatSize } from "@/lib/format";
import PinForm from "./PinForm";

export const dynamic = "force-dynamic";

export default async function SharedDocPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await findSharedDoc(token);
  if (!found) notFound();
  const { doc, pinHash } = found;

  if (!pinHash) {
    return (
      <main>
        <div className="card center">
          <h1>暂时无法查看</h1>
          <p className="muted">文档所有者尚未设置查看密码。</p>
        </div>
      </main>
    );
  }

  const store = await cookies();
  const unlocked = checkUnlockCookie(store.get(unlockCookieName(token))?.value, token, pinHash);
  if (!unlocked) {
    return (
      <main>
        <div className="card center">
          <h1>请输入查看密码</h1>
          <p className="muted">此文档受 4 位数字密码保护。</p>
          <PinForm token={token} />
        </div>
      </main>
    );
  }

  // 在线预览：生成一个 30 分钟有效的签名地址交给 Office Online 读取
  let previewUrl: string | null = null;
  if (ENABLE_OFFICE_PREVIEW) {
    const { data } = await adminDb().storage.from(BUCKET).createSignedUrl(doc.file_path, 30 * 60);
    if (data?.signedUrl) {
      previewUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(data.signedUrl)}`;
    }
  }

  return (
    <main>
      <div className="card">
        <div className="spread">
          <div>
            <h1 style={{ marginBottom: 4 }}>{doc.title}</h1>
            <div className="muted">
              {doc.original_name} · {formatSize(doc.size_bytes)} · 有效期至 {formatDate(doc.expires_at)}
            </div>
          </div>
          <a className="btn primary" href={`/api/d/${token}/file`}>
            下载
          </a>
        </div>
      </div>
      {previewUrl ? (
        <iframe className="preview" src={previewUrl} title={doc.title} />
      ) : (
        <p className="muted">在线预览已关闭，请下载后查看。</p>
      )}
    </main>
  );
}
