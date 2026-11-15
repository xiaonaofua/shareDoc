import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { findSharedDoc } from "@/lib/docs";
import { redirectToDownload } from "@/lib/download";
import { needsPin } from "@/lib/format";
import { checkUnlockCookie, unlockCookieName } from "@/lib/security";

/** 下载单个文档：必须开启了“允许下载”，需要密码时还要已输入过密码 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await findSharedDoc(token);
  if (!found || found.doc.allow_download !== true) return new NextResponse("Not found", { status: 404 });

  if (needsPin(found.doc)) {
    const store = await cookies();
    if (!checkUnlockCookie(store.get(unlockCookieName(token))?.value, token, found.pinHash)) {
      return NextResponse.redirect(new URL(`/d/${token}`, req.url));
    }
  }
  return redirectToDownload(found.doc);
}
