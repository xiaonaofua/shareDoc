import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import PinPad from "@/app/ui/PinPad";
import { findSharedDoc } from "@/lib/docs";
import { needsPin } from "@/lib/format";
import { checkUnlockCookie, unlockCookieName } from "@/lib/security";
import { DocViewer, Notice } from "@/lib/viewer";

export const dynamic = "force-dynamic";

/** 单个文档的分享页 */
export default async function SharedDocPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await findSharedDoc(token);
  if (!found) notFound();
  const { doc, pinHash } = found;

  if (needsPin(doc)) {
    if (!pinHash) return <Notice title="暂时无法查看" text="文档所有者尚未设置查看密码。" />;
    const store = await cookies();
    if (!checkUnlockCookie(store.get(unlockCookieName(token))?.value, token, pinHash)) {
      return <PinPad action={`/api/d/${token}/unlock`} title={doc.title} />;
    }
  }

  return <DocViewer doc={doc} />;
}
