import { notFound } from "next/navigation";
import SpaceGrid from "@/app/ui/SpaceGrid";
import { LangSwitch } from "@/app/ui/I18n";
import { BUCKET } from "@/lib/config";
import { findSpace } from "@/lib/docs";
import { kindOf } from "@/lib/filetypes";
import { needsPin } from "@/lib/format";
import { adminDb } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * 文件夹页：文件夹只是一个分组，打开不需要密码。
 * 里面的每个文件按各自的设置（需要密码 / 允许下载）显示和打开。
 */
export default async function SpacePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await findSpace(token);
  if (!found) notFound();
  const { space, docs } = found;

  // 不需要密码的图片显示缩略图（需要密码的不提前露出内容）
  const images = docs.filter((d) => kindOf(d.file_path) === "image" && !needsPin(d));
  const thumbs = new Map<string, string>();
  if (images.length) {
    const { data } = await adminDb()
      .storage.from(BUCKET)
      .createSignedUrls(images.map((d) => d.file_path), 60 * 60);
    data?.forEach((r) => r.signedUrl && r.path && thumbs.set(r.path, r.signedUrl));
  }

  return (
    <main>
      <div className="viewer-bar" style={{ minHeight: 44 }}>
        <span style={{ flex: 1 }} />
        <LangSwitch compact />
      </div>
      <div className="large-title">{space.title}</div>
      <SpaceGrid token={token} docs={docs} thumbs={thumbs} />
    </main>
  );
}
