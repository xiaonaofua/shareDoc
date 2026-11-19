import { NextResponse } from "next/server";
import { docAccess } from "@/lib/doc-access";
import { findSpace, findSpaceDoc } from "@/lib/docs";
import { redirectToDownload } from "@/lib/download";

/** 从文件夹下载某个文件：看这个文件自己的“允许下载”，需要密码时还要已输入过密码 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string; docId: string }> }) {
  const { token, docId } = await params;
  const found = await findSpace(token);
  const doc = found && (await findSpaceDoc(found.space.id, docId));
  if (!found || !doc || doc.allow_download !== true) return new NextResponse("Not found", { status: 404 });
  if ((await docAccess(doc, found.pinHash)) !== "ok") {
    return NextResponse.redirect(new URL(`/s/${token}/${doc.id}`, req.url));
  }
  return redirectToDownload(doc);
}
