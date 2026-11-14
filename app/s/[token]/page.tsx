import { notFound } from "next/navigation";
import PinForm from "@/app/components/PinForm";
import { BUCKET } from "@/lib/config";
import { kindOf } from "@/lib/filetypes";
import SpaceGrid from "@/app/components/SpaceGrid";
import { spaceAccess } from "@/lib/space-access";
import { adminDb } from "@/lib/supabase";
import { CenterCard } from "@/lib/viewer";

export const dynamic = "force-dynamic";

/** 空间页：空间里的文档以图标平铺显示 */
export default async function SpacePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const access = await spaceAccess(token);
  if (!access) notFound();
  const { space, docs, status } = access;

  if (status === "nopin") {
    return (
      <CenterCard title="暂时无法查看">
        <p className="muted">空间所有者尚未设置查看密码。</p>
      </CenterCard>
    );
  }
  if (status === "pin") {
    return (
      <CenterCard title={space.title}>
        <p className="muted">请输入 4 位数字密码进入空间。</p>
        <PinForm action={`/api/s/${token}/unlock`} />
      </CenterCard>
    );
  }

  // 图片文件显示缩略图
  const images = docs.filter((d) => kindOf(d.file_path) === "image");
  const thumbs = new Map<string, string>();
  if (images.length) {
    const { data } = await adminDb()
      .storage.from(BUCKET)
      .createSignedUrls(images.map((d) => d.file_path), 60 * 60);
    data?.forEach((r) => r.signedUrl && r.path && thumbs.set(r.path, r.signedUrl));
  }

  return (
    <main className="wide">
      <h1>{space.title}</h1>
      <SpaceGrid token={token} docs={docs} thumbs={thumbs} />
    </main>
  );
}
