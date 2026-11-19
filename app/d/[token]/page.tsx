import { notFound } from "next/navigation";
import PinPad from "@/app/ui/PinPad";
import { docAccess } from "@/lib/doc-access";
import { findSharedDoc } from "@/lib/docs";
import { getT } from "@/lib/i18n-server";
import { DocViewer, Notice } from "@/lib/viewer";

export const dynamic = "force-dynamic";

/** 单个文档的分享页 */
export default async function SharedDocPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await findSharedDoc(token);
  if (!found) notFound();
  const { doc, pinHash } = found;

  const status = await docAccess(doc, pinHash);
  if (status === "nopin") {
    const { t } = await getT();
    return <Notice title={t("unavailable")} text={t("ownerNoPin")} />;
  }
  if (status === "pin") return <PinPad action={`/api/d/${token}/unlock`} title={doc.title} />;

  return <DocViewer doc={doc} downloadHref={doc.allow_download ? `/api/d/${token}/file` : undefined} />;
}
