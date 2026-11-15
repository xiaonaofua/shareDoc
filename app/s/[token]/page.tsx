import { notFound } from "next/navigation";
import PinPad from "@/app/ui/PinPad";
import SpaceGrid from "@/app/ui/SpaceGrid";
import { BUCKET } from "@/lib/config";
import { kindOf } from "@/lib/filetypes";
import { spaceAccess } from "@/lib/space-access";
import { adminDb } from "@/lib/supabase";
import { Notice } from "@/lib/viewer";

export const dynamic = "force-dynamic";

/** 空间页：像打开一个文件夹，里面的文件平铺显示 */
export default async function SpacePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const access = await spaceAccess(token);
  if (!access) notFound();
  const { space, docs, status } = access;

  if (status === "nopin") return <Notice title="暂时无法查看" text="空间所有者尚未设置查看密码。" />;
  if (status === "pin") return <PinPad action={`/api/s/${token}/unlock`} title={space.title} />;

  // 图片显示缩略图
  const images = docs.filter((d) => kindOf(d.file_path) === "image");
  const thumbs = new Map<string, string>();
  if (images.length) {
    const { data } = await adminDb()
      .storage.from(BUCKET)
      .createSignedUrls(images.map((d) => d.file_path), 60 * 60);
    data?.forEach((r) => r.signedUrl && r.path && thumbs.set(r.path, r.signedUrl));
  }

  return (
    <main>
      <div className="large-title" style={{ marginTop: 20 }}>{space.title}</div>
      <SpaceGrid token={token} docs={docs} thumbs={thumbs} />
    </main>
  );
}
