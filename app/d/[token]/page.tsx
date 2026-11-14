import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import PinForm from "@/app/components/PinForm";
import { findSharedDoc } from "@/lib/docs";
import { needsPin } from "@/lib/format";
import { checkUnlockCookie, unlockCookieName } from "@/lib/security";
import { CenterCard, DocViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";

/** 单个文档的分享页 */
export default async function SharedDocPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await findSharedDoc(token);
  if (!found) notFound();
  const { doc, pinHash } = found;

  if (needsPin(doc)) {
    if (!pinHash) {
      return (
        <CenterCard title="暂时无法查看">
          <p className="muted">文档所有者尚未设置查看密码。</p>
        </CenterCard>
      );
    }
    const store = await cookies();
    if (!checkUnlockCookie(store.get(unlockCookieName(token))?.value, token, pinHash)) {
      return (
        <CenterCard title="请输入查看密码">
          <p className="muted">此文档受 4 位数字密码保护。</p>
          <PinForm action={`/api/d/${token}/unlock`} />
        </CenterCard>
      );
    }
  }

  return <DocViewer doc={doc} downloadHref={`/api/d/${token}/file`} />;
}
