import { NextResponse } from "next/server";
import { docAccess } from "@/lib/doc-access";
import { findSharedDoc } from "@/lib/docs";
import { redirectToDownload } from "@/lib/download";

/** 下载单个文档：必须开启了“允许下载”，需要密码时还要已输入过密码 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await findSharedDoc(token);
  if (!found || found.doc.allow_download !== true) return new NextResponse("Not found", { status: 404 });
  if ((await docAccess(found.doc, found.pinHash)) !== "ok") {
    return NextResponse.redirect(new URL(`/d/${token}`, req.url));
  }
  return redirectToDownload(found.doc);
}
