import { notFound } from "next/navigation";
import PinPad from "@/app/ui/PinPad";
import { docAccess } from "@/lib/doc-access";
import { findSpace, findSpaceDoc } from "@/lib/docs";
import { getT } from "@/lib/i18n-server";
import { DocViewer, Notice } from "@/lib/viewer";

export const dynamic = "force-dynamic";

/** 从文件夹里打开的文件：按这个文件自己的“需要密码 / 允许下载”设置 */
export default async function SpaceDocPage({ params }: { params: Promise<{ token: string; docId: string }> }) {
  const { token, docId } = await params;
  const found = await findSpace(token);
  if (!found) notFound();
  const doc = await findSpaceDoc(found.space.id, docId);
  if (!doc) notFound();

  const status = await docAccess(doc, found.pinHash);
  if (status === "nopin") {
    const { t } = await getT();
    return <Notice title={t("unavailable")} text={t("ownerNoPin")} />;
  }
  if (status === "pin") return <PinPad action={`/api/s/${token}/unlock/${doc.id}`} title={doc.title} />;

  return (
    <DocViewer
      doc={doc}
      back={{ href: `/s/${token}`, label: found.space.title }}
      downloadHref={doc.allow_download ? `/api/s/${token}/file/${doc.id}` : undefined}
    />
  );
}
