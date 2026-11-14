import { notFound, redirect } from "next/navigation";
import { findSpaceDoc } from "@/lib/docs";
import { spaceAccess } from "@/lib/space-access";
import { DocViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";

/** 从空间里打开的单个文档 */
export default async function SpaceDocPage({ params }: { params: Promise<{ token: string; docId: string }> }) {
  const { token, docId } = await params;
  const access = await spaceAccess(token);
  if (!access) notFound();
  if (access.status !== "ok") redirect(`/s/${token}`);

  const doc = await findSpaceDoc(access.space.id, docId);
  if (!doc) notFound();

  return (
    <DocViewer
      doc={doc}
      downloadHref={`/api/s/${token}/file/${doc.id}`}
      back={{ href: `/s/${token}`, label: access.space.title }}
    />
  );
}
